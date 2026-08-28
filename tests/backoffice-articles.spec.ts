import { test, expect } from "@playwright/test";
import { apiClient, devLoginCookie, e2eName } from "./helpers";

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
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
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

    await page.getByRole("button", { name: "Apagar rascunho" }).click();
    await page.getByRole("button", { name: "Apagar rascunho" }).last().click();
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
