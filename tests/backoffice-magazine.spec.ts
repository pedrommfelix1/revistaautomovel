import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { apiClient, devLoginCookie, e2eName } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PDF = path.join(__dirname, "fixtures", "test-issue.pdf");

// Exercises the exact path that broke twice in production: cover generation
// in the browser, the chunked upload, and finalize/reassembly server-side.
test.describe.serial("revista — carregar e remover uma edição", () => {
  const title = e2eName("Edição de teste");

  test("carregar um PDF gera a capa e publica a edição", async ({ page }) => {
    await page.goto("/redacao/revista");
    await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(TEST_PDF);

    // A capa é gerada no browser (pdfjs-dist) a partir da primeira página.
    await expect(page.locator('img[alt="Pré-visualização da capa"]')).toBeVisible();

    await page.getByPlaceholder(/título da edição/i).fill(title);
    await page.getByRole("button", { name: /publicar edição/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
  });

  test("a edição aparece na página pública e o leitor abre o PDF", async ({ page }) => {
    await page.goto("/revista");
    await expect(page.getByText(title)).toBeVisible();
    await page.getByText(title).click();
    await page.waitForURL(/\/revista\/\d+/);
    await expect(page.locator("iframe")).toBeVisible();
  });

  test("remover a edição", async ({ page }) => {
    await page.goto("/redacao/revista");
    await page.getByText(title).locator("..").getByRole("button", { name: /remover edição/i }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test.afterAll(async () => {
    const admin = apiClient(await devLoginCookie("admin"));
    const issues = await admin.magazine.list.query();
    const leftover = issues.find((issue) => issue.title === title);
    if (leftover) await admin.magazine.manage.delete.mutate({ id: leftover.id });
  });
});
