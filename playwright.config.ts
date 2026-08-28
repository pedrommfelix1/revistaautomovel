import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STORAGE_STATE, BASE_URL } from "./tests/helpers";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Logs into the backoffice once and saves the session cookie for every
    // other project to reuse.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  // No webServer entry: `npm run dev` is expected to already be running.
  // The dev script's inline `NODE_ENV=development` prefix only works under a
  // POSIX shell (Git Bash) — Playwright would spawn it via cmd.exe on
  // Windows and fail — so auto-starting it here isn't reliable on this
  // machine. Start it yourself first: `npm run dev` (in Git Bash).
});
