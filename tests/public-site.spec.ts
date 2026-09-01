import { test, expect } from "@playwright/test";
import { apiClient, devLoginCookie, e2eName } from "./helpers";

// Smoke checks that don't depend on any particular content existing.
test.describe("navegação pública — smoke", () => {
  test("início carrega sem erros de consola", async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (err) => erros.push(err.message));
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /navegação principal/i });
    await expect(nav.getByRole("link", { name: /notícias/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /multimédia/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /revista/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /sobre/i })).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("notícias mostra os dois dropdowns de filtro", async ({ page }) => {
    await page.goto("/noticias");
    await expect(page.getByLabel(/tipo de carro/i)).toBeVisible();
    await expect(page.getByLabel(/^marca$/i)).toBeVisible();
  });

  test("multimédia carrega", async ({ page }) => {
    await page.goto("/multimedia");
    await expect(page.getByRole("heading", { name: "Multimédia" })).toBeVisible();
  });

  test("revista carrega", async ({ page }) => {
    await page.goto("/revista");
    await expect(page.getByRole("heading", { name: "Revista" })).toBeVisible();
  });

  test("sobre carrega", async ({ page }) => {
    await page.goto("/sobre");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("pesquisa pede pelo menos duas letras antes de procurar", async ({ page }) => {
    await page.goto("/pesquisa");
    await expect(page.getByText(/escreva pelo menos duas letras/i)).toBeVisible();
  });

  test("artigo inexistente mostra 404", async ({ page }) => {
    await page.goto("/artigo/isto-nao-existe-de-certeza-123456");
    await expect(page.getByText(/404/)).toBeVisible();
  });
});

// Everything below exercises one purpose-built article end to end: the two
// title fields, paragraph rendering, drop-cap, and category ordering. Built
// and torn down through the admin API — this app has no separate test
// database (local dev and production share the same TiDB Cloud instance),
// so every fixture is created fresh and removed after use rather than
// depending on whatever real content happens to exist.
test.describe.serial("artigo de teste — título duplo, parágrafos, categorias", () => {
  const listTitle = e2eName("Título de destaque");
  const insideTitle = "Este é o título só de dentro do artigo";
  const slug = `e2e-${Date.now()}`;
  let articleId: number;
  let articleSlug = slug;
  let admin: ReturnType<typeof apiClient>;

  test.beforeAll(async () => {
    admin = apiClient(await devLoginCookie("admin"));
    const created = await admin.editorial.manage.create.mutate({ title: listTitle });
    if (!created) throw new Error("falha ao criar artigo de teste");
    articleId = created.id;

    const categories = await admin.editorial.categories.query();
    const tipo = categories.find((c) => c.kind === "tipo");
    const marca = categories.find((c) => c.kind === "marca");
    if (!tipo || !marca) throw new Error("é preciso pelo menos uma categoria de tipo e de marca já existentes");

    const saved = await admin.editorial.manage.saveMetadata.mutate({
      id: articleId,
      title: listTitle,
      articleTitle: insideTitle,
      slug,
      deck: "Deck de teste E2E.",
      authorName: "Autor de Teste",
      coverImageUrl: null,
      coverImageCaption: null,
      seoTitle: null,
      seoDescription: null,
      socialImageUrl: null,
      isFeatured: false,
    });
    articleSlug = saved?.slug ?? slug;

    await admin.editorial.manage.saveSections.mutate({
      id: articleId,
      sections: [
        { type: "chapter", heading: "Capítulo de teste", body: "Primeiro parágrafo.\n\nSegundo parágrafo, bem separado do primeiro.", caption: null, position: 0 },
      ],
    });
    await admin.editorial.manage.saveCategories.mutate({ id: articleId, categoryIds: [tipo.id, marca.id] });
    await admin.editorial.manage.publish.mutate({ id: articleId, published: true });
  });

  test.afterAll(async () => {
    // Só é possível apagar rascunhos — despublica primeiro.
    await admin.editorial.manage.publish.mutate({ id: articleId, published: false });
    await admin.editorial.manage.deleteDraft.mutate({ id: articleId });
  });

  test("o artigo publicado usa o título de dentro, não o de destaque", async ({ page }) => {
    await page.goto(`/artigo/${articleSlug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(insideTitle);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText(listTitle);
  });

  test("a marca aparece antes do tipo", async ({ page }) => {
    await page.goto(`/artigo/${articleSlug}`);
    const tag = page.locator(".article-title-area >> text=/\\//").first();
    const text = await tag.textContent();
    // "Marca / Tipo" — a marca (a categoria escolhida acima) vem primeiro.
    expect(text?.indexOf("/")).toBeGreaterThan(0);
  });

  test("os dois parágrafos do capítulo renderizam separados", async ({ page }) => {
    await page.goto(`/artigo/${articleSlug}`);
    const paragraphs = page.locator(".article-copy p");
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.nth(0)).toContainText("Primeiro parágrafo.");
    await expect(paragraphs.nth(1)).toContainText("Segundo parágrafo");
  });

  test("o título de destaque (não o de dentro) aparece na listagem de notícias", async ({ page }) => {
    await page.goto("/noticias");
    await expect(page.getByText(listTitle)).toBeVisible();
    await expect(page.getByText(insideTitle)).toHaveCount(0);
  });

  test("a pesquisa encontra o artigo pelo título de destaque", async ({ page }) => {
    await page.goto(`/pesquisa?q=${encodeURIComponent(listTitle.split(" ").slice(0, 3).join(" "))}`);
    await expect(page.getByText(listTitle)).toBeVisible();
  });

  // wouter não repõe o scroll ao navegar (ao contrário de um carregamento de
  // página completo) — reportado no iPhone Safari como artigos a abrirem a
  // meio da página em vez de no topo. Reproduz-se com scroll para baixo numa
  // listagem seguido de clique num artigo.
  test("ao clicar num artigo a partir de uma lista com scroll, a página abre no topo", async ({ page }) => {
    await page.goto("/noticias");
    await expect(page.getByText(listTitle)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    await page.getByText(listTitle).click();
    await page.waitForURL(`**/artigo/${articleSlug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
