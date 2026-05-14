import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_OWNER_EMAIL ?? "owner1@test.com";
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "test1234!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector('input[id="email"]', { timeout: 5000 });
  await page.fill('input[id="email"]', EMAIL);
  await page.fill('input[id="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("owner happy path", () => {
  test("login → dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
  });

  test("create a draft listing", async ({ page }) => {
    await login(page);
    await page.goto("/listings/new");
    await page.waitForSelector('input[id="title"]', { timeout: 5000 });
    await page.fill('input[id="title"]', "E2E test crane");
    await page.fill(
      'textarea[id="description"]',
      "Created from Playwright e2e. Twenty characters at least.",
    );
    await page.fill('input[id="price_daily"]', "50000");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/listings\/.+\/edit/, { timeout: 10000 });
  });

  test("bookings tabs navigate", async ({ page }) => {
    await login(page);
    await page.goto("/bookings");
    await page.waitForSelector("[data-state=active]", { timeout: 5000 });
    await page.click("text=CONFIRMED");
    await page.waitForTimeout(500);
  });

  test("settings tabs navigate", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("text=Business profile", { timeout: 10000 });
    await page.click('a:has-text("Bank")');
    await expect(page).toHaveURL(/\/settings\/bank/);
    await page.click('a:has-text("Notifications")');
    await expect(page).toHaveURL(/\/settings\/notifications/);
    await page.click('a:has-text("Account")');
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  test("analytics pages load", async ({ page }) => {
    await login(page);
    await page.goto("/analytics");
    await page.waitForSelector("h1", { timeout: 10000 });
    await page.click('a:has-text("Performance")');
    await expect(page).toHaveURL(/\/analytics\/performance/);
  });

  test("messages inbox loads", async ({ page }) => {
    await login(page);
    await page.goto("/messages");
    await expect(page.locator("text=Inbox")).toBeVisible({ timeout: 10000 });
  });
});
