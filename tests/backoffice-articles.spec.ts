import { test, expect } from "@playwright/test";
import { apiClient, devLoginCookie, e2eName, expectErrorCode } from "./helpers";

// Drives the real editor UI end to end — as opposed to public-site.spec.ts's
// fixture article, which is built directly through the API. Between the
// two, both the UI wiring and the underlying API contract get exercised.
//
// Asserts on durable state (the "Publicado"/"Rascunho" badge, the article's
// presence on /noticias) rather than toast text — toasts auto-dismiss after
// a few seconds and are a flaky thing to assert on.
test.describe.serial("editor de artigo — ciclo de vida via UI", () => {
  const title = e2eName("Rascunho de UI");
  let articleId: number;

  test("criar, preencher e publicar um artigo", async ({ page }) => {
    await page.goto("/redacao");
    await page.getByRole("button", { name: "Novo artigo" }).click();
    await page.waitForURL(/\/redacao\/\d+/);
    articleId = Number(page.url().split("/").pop());
    expect(articleId).toBeGreaterThan(0);

    await page.getByLabel(/título \(destaque e notícias\)/i).fill(title);
    await page.getByLabel(/título no artigo/i).fill("Título interno de UI");
    await page.getByLabel(/subtítulo/i).fill("Subtítulo escrito pelo teste.");
    await page.getByLabel(/autoria/i).fill("Autor de Teste UI");

    await page.getByRole("button", { name: "Texto", exact: true }).click();
    await page.getByPlaceholder("Escreva o texto deste bloco…").fill("Corpo do bloco escrito pelo teste de UI.");

    // Publicar guarda tudo antes de publicar (ver ArticleEditor.tsx
    // handlePublish), por isso não é preciso um "Guardar" à parte primeiro.
    await page.getByRole("button", { name: "Publicar agora", exact: true }).click();
    await expect(page.getByText("Publicado", { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test("o artigo publicado é visível no site", async ({ page }) => {
    await page.goto("/noticias");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("despublicar e apagar o rascunho", async ({ page }) => {
    await page.goto(`/redacao/${articleId}`);
    await page.getByRole("button", { name: "Retirar", exact: true }).click();
    await expect(page.getByText("Rascunho", { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Apagar", exact: true }).click();
    await page.getByRole("button", { name: "Apagar", exact: true }).last().click();
    await page.waitForURL(/\/redacao$/);
  });

  test.afterAll(async () => {
    // Rede de segurança: se alguma asserção acima falhar a meio, não deixa o
    // rascunho de teste perdido na lista de artigos reais.
    if (!articleId) return;
    const admin = apiClient(await devLoginCookie("admin"));
    try {
      await admin.editorial.manage.publish.mutate({ id: articleId, published: false });
      await admin.editorial.manage.deleteDraft.mutate({ id: articleId });
    } catch {
      // já tinha sido apagado pelo próprio teste — nada a fazer.
    }
  });
});

// Vercel Hobby's cron minimum interval is once a day, so "scheduled for day
// X" means the daily cron (server/_core/cron.ts, GET /api/cron/publish-scheduled)
// flips it to published sometime that day — this drives that whole path:
// UI scheduling → stays hidden → cron backdated via direct SQL → published.
test.describe.serial("agendamento de artigos", () => {
  const title = e2eName("Agendado de UI");
  let articleId: number;
  let slug: string;

  test("agendar um artigo para uma data futura", async ({ page }) => {
    await page.goto("/redacao");
    await page.getByRole("button", { name: "Novo artigo" }).click();
    await page.waitForURL(/\/redacao\/\d+/);
    articleId = Number(page.url().split("/").pop());

    await page.getByLabel(/título \(destaque e notícias\)/i).fill(title);
    await page.getByLabel(/autoria/i).fill("Autor de Teste Agendamento");

    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel(/ou agendar para uma data/i).fill(future);
    await page.getByRole("button", { name: "Agendar", exact: true }).click();
    await expect(page.getByText(/agendado —/i)).toBeVisible({ timeout: 10000 });

    const admin = apiClient(await devLoginCookie("admin"));
    const detail = await admin.editorial.manage.detail.query({ id: articleId });
    slug = detail!.slug;
  });

  test("artigo agendado não aparece no site nem abre pelo endereço direto", async ({ page }) => {
    await page.goto("/noticias");
    await expect(page.getByText(title)).toHaveCount(0);
    // A app é uma SPA — o servidor devolve sempre 200 (index.html); é o
    // próprio React que decide mostrar "404" quando bySlug não encontra
    // nenhum artigo publicado com este slug.
    await page.goto(`/artigo/${slug}`);
    await expect(page.getByText(/404/)).toBeVisible();
  });

  test("o cron publica assim que a data agendada passa", async ({ page }) => {
    // Sem base de dados de teste separada — recuar a data diretamente é o
    // único jeito de simular "o dia agendado chegou" sem esperar dias reais.
    await import("dotenv/config");
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    await conn.query("UPDATE articles SET scheduledAt = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [articleId]);
    await conn.end();

    const cronResp = await page.request.get("/api/cron/publish-scheduled");
    expect(cronResp.ok()).toBeTruthy();
    const body = await cronResp.json();
    expect(body.published).toBeGreaterThanOrEqual(1);

    await page.goto("/noticias");
    await expect(page.getByText(title)).toBeVisible();
  });

  test.afterAll(async () => {
    if (!articleId) return;
    const admin = apiClient(await devLoginCookie("admin"));
    try {
      await admin.editorial.manage.publish.mutate({ id: articleId, published: false });
      await admin.editorial.manage.deleteDraft.mutate({ id: articleId });
    } catch {
      // já tinha sido apagado — nada a fazer.
    }
  });
});

// A pré-visualização mostra um rascunho com o layout real do artigo, numa
// rota só para a redação (/redacao/:id/preview) — o site público só serve
// artigos publicados, por isso um rascunho nunca se abre por /artigo/:slug.
test.describe.serial("pré-visualização de artigo", () => {
  const title = e2eName("Preview de UI");
  let articleId: number;
  let slug: string;

  test("o botão guarda as alterações e abre a pré-visualização num novo separador", async ({ page }) => {
    await page.goto("/redacao");
    await page.getByRole("button", { name: "Novo artigo" }).click();
    await page.waitForURL(/\/redacao\/\d+/);
    articleId = Number(page.url().split("/").pop());

    await page.getByLabel(/título \(destaque e notícias\)/i).fill(title);
    await page.getByLabel(/título no artigo/i).fill("Título de pré-visualização");
    await page.getByLabel(/autoria/i).fill("Autor de Teste Preview");
    await page.getByRole("button", { name: "Texto", exact: true }).click();
    await page.getByPlaceholder("Escreva o texto deste bloco…").fill("Texto ainda por guardar, escrito no editor.");

    // Sem clicar em "Guardar" antes: o próprio botão tem de guardar.
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Pré-visualizar", exact: true }).click();
    const preview = await popupPromise;
    await preview.waitForURL(new RegExp(`/redacao/${articleId}/preview$`));

    await expect(preview.getByTestId("preview-banner")).toContainText("Rascunho");
    await expect(preview.getByRole("heading", { level: 1, name: "Título de pré-visualização" })).toBeVisible();
    await expect(preview.getByText("Texto ainda por guardar, escrito no editor.")).toBeVisible();
    await expect(preview.getByRole("button", { name: /partilhar/i })).toHaveCount(0);

    const admin = apiClient(await devLoginCookie("admin"));
    slug = (await admin.editorial.manage.detail.query({ id: articleId }))!.slug;
  });

  test("o rascunho continua sem abrir no site público", async ({ page }) => {
    await page.goto(`/artigo/${slug}`);
    await expect(page.getByText(/404/)).toBeVisible();
  });

  test.describe("sem sessão", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a pré-visualização pede sessão e não mostra o rascunho", async ({ page }) => {
      await page.goto(`/redacao/${articleId}/preview`);
      await expect(page.getByText(/inicie sessão na redação/i)).toBeVisible();
      await expect(page.getByText("Texto ainda por guardar, escrito no editor.")).toHaveCount(0);
    });
  });

  test.afterAll(async () => {
    if (!articleId) return;
    const admin = apiClient(await devLoginCookie("admin"));
    try {
      await admin.editorial.manage.deleteDraft.mutate({ id: articleId });
    } catch {
      // já tinha sido apagado — nada a fazer.
    }
  });
});

// O limite da galeria do artigo subiu de 10 para 50 imagens (o antigo max()
// do array E o max() de "position" tinham de subir juntos — este segundo é
// fácil de esquecer, por isso o teste cobre os dois).
test.describe.serial("limite de imagens da galeria do artigo", () => {
  const title = e2eName("Galeria de limite");
  let articleId: number;

  test("aceita exatamente 50 imagens mas rejeita a 51.ª", async () => {
    const admin = apiClient(await devLoginCookie("admin"));
    const created = await admin.editorial.manage.create.mutate({ title });
    articleId = created!.id;

    const fiftyImages = Array.from({ length: 50 }, (_, index) => ({ url: `https://picsum.photos/seed/${articleId}-${index}/800/600`, position: index }));
    await admin.editorial.manage.saveImages.mutate({ id: articleId, images: fiftyImages });
    const detail = await admin.editorial.manage.detail.query({ id: articleId });
    expect(detail!.images).toHaveLength(50);

    const fiftyOneImages = [...fiftyImages, { url: "https://picsum.photos/seed/extra/800/600", position: 50 }];
    await expectErrorCode(admin.editorial.manage.saveImages.mutate({ id: articleId, images: fiftyOneImages }), "BAD_REQUEST");
  });

  test.afterAll(async () => {
    if (!articleId) return;
    const admin = apiClient(await devLoginCookie("admin"));
    try {
      await admin.editorial.manage.deleteDraft.mutate({ id: articleId });
    } catch {
      // já tinha sido apagado — nada a fazer.
    }
  });
});
