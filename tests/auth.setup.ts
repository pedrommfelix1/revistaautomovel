import { test as setup, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE, BASE_URL } from "./helpers";

// Logs in once via the dev-only bypass (see server/_core/oauth.ts) and saves
// the resulting cookie for every other test to reuse. Real Manus OAuth can't
// complete against localhost, so this mirrors what a developer does by hand
// every time they open the backoffice locally.
setup("prepare admin session", async ({ page }) => {
  await page.goto(`${BASE_URL}/api/dev/login`);
  await expect(page).toHaveURL(/\/redacao$/);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
