import { test, expect } from "@playwright/test";
import { apiClient, devLoginCookie } from "./helpers";

// The "Sobre" contact block (email / redes sociais) is a single shared
// settings row, not a disposable fixture — every mutation here restores the
// original values in afterAll so real site content survives the run.
test.describe.serial("definições do site — toggle de contacto no Sobre", () => {
  let admin: ReturnType<typeof apiClient>;
  let original: Awaited<ReturnType<ReturnType<typeof apiClient>["settings"]["about"]["query"]>>;

  test.beforeAll(async () => {
    admin = apiClient(await devLoginCookie("admin"));
    original = await admin.settings.about.query();
    await admin.settings.manage.saveAbout.mutate({
      aboutTitle: original.aboutTitle,
      aboutIntro: original.aboutIntro,
      aboutBody: original.aboutBody,
      aboutEmail: "e2e@autoturbo.pt",
      aboutEmailEnabled: true,
      aboutSocial: "@autoturbo-e2e",
      aboutSocialEnabled: true,
    });
  });

  test.afterAll(async () => {
    const cookie = await devLoginCookie("admin");
    await apiClient(cookie).settings.manage.saveAbout.mutate({
      aboutTitle: original.aboutTitle,
      aboutIntro: original.aboutIntro,
      aboutBody: original.aboutBody,
      aboutEmail: original.aboutEmail,
      aboutEmailEnabled: original.aboutEmailEnabled,
      aboutSocial: original.aboutSocial,
      aboutSocialEnabled: original.aboutSocialEnabled,
    });
  });

  test("com os dois campos ativos, email e redes sociais aparecem", async ({ page }) => {
    await page.goto("/sobre");
    await expect(page.getByText("e2e@autoturbo.pt")).toBeVisible();
    await expect(page.getByText("@autoturbo-e2e")).toBeVisible();
  });

  test("desativar o email esconde-o mas mantém as redes sociais visíveis", async ({ page }) => {
    const cookie = await devLoginCookie("admin");
    await apiClient(cookie).settings.manage.saveAbout.mutate({
      aboutTitle: original.aboutTitle,
      aboutIntro: original.aboutIntro,
      aboutBody: original.aboutBody,
      aboutEmail: "e2e@autoturbo.pt",
      aboutEmailEnabled: false,
      aboutSocial: "@autoturbo-e2e",
      aboutSocialEnabled: true,
    });

    await page.goto("/sobre");
    await expect(page.getByText("e2e@autoturbo.pt")).toHaveCount(0);
    await expect(page.getByText("@autoturbo-e2e")).toBeVisible();
  });

  test("desativar os dois campos remove a caixa de contacto por completo", async ({ page }) => {
    const cookie = await devLoginCookie("admin");
    await apiClient(cookie).settings.manage.saveAbout.mutate({
      aboutTitle: original.aboutTitle,
      aboutIntro: original.aboutIntro,
      aboutBody: original.aboutBody,
      aboutEmail: "e2e@autoturbo.pt",
      aboutEmailEnabled: false,
      aboutSocial: "@autoturbo-e2e",
      aboutSocialEnabled: false,
    });

    await page.goto("/sobre");
    await expect(page.getByText("Contacto")).toHaveCount(0);
  });
});
