import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { apiClient, devLoginCookie } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

test.describe.serial("multimédia — carregar, guardar e remover uma imagem", () => {
  test.afterAll(async () => {
    // Rede de segurança: garante que a galeria fica exactamente como estava
    // caso um passo intermédio falhe.
    const admin = apiClient(await devLoginCookie("admin"));
    const images = await admin.gallery.list.query();
    const withoutTestImage = images.filter((image) => image.altText !== "test-image");
    if (withoutTestImage.length !== images.length) {
      await admin.gallery.manage.save.mutate({
        images: withoutTestImage.map((image, index) => ({ url: image.url, storageKey: image.storageKey, altText: image.altText, caption: image.caption, position: index })),
      });
    }
  });

  // GalleryEditor sempre acrescenta a imagem nova ao fim da lista, por isso o
  // último cartão é sempre o de teste enquanto não se reordenar nada.
  const altTextInputs = (page: import("@playwright/test").Page) => page.locator('input[placeholder="Descrição alternativa"]');

  test("carregar uma imagem e guardar", async ({ page }) => {
    await page.goto("/redacao/multimedia");
    await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles(TEST_IMAGE);

    await expect(altTextInputs(page).last()).toHaveValue("test-image");

    await page.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText("Galeria do site guardada.")).toBeVisible();
  });

  test("a imagem aparece na página pública", async ({ page }) => {
    await page.goto("/multimedia");
    await expect(page.locator("img")).not.toHaveCount(0);
  });

  test("remover a imagem e guardar", async ({ page }) => {
    await page.goto("/redacao/multimedia");
    const inputs = altTextInputs(page);
    await expect(inputs.last()).toHaveValue("test-image");

    await inputs.last().locator("..").getByRole("button", { name: /remover imagem/i }).click();
    await expect(inputs.last()).not.toHaveValue("test-image");

    await page.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText("Galeria do site guardada.")).toBeVisible();
  });
});
