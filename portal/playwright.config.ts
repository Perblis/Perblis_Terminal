import { defineConfig } from "@playwright/test";

// Smoke per TSD §8, run against compose/CI services (backend on :8000 with
// DEBUG + E2E_FIXED_OTP + seed_e2e; portal on :3000 with API_BASE_URL set).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // flows share seeded state; keep them ordered
  use: {
    baseURL: process.env.PORTAL_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
});
