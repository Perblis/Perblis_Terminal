import path from "node:path";
import { test, expect } from "@playwright/test";

const FIXTURE = path.join(process.cwd(), "e2e/fixtures/test-upload.png");

const EMAIL = process.env.E2E_OWNER_EMAIL ?? "owner1@test.com";
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "test1234!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector('input[id="email"]', { timeout: 15_000 });
  await page.fill('input[id="email"]', EMAIL);
  await page.fill('input[id="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("image uploads", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("listing photos (new listing → edit → PhotoUploader)", async ({ page }) => {
    await login(page);
    await page.goto("/listings/new");
    await page.waitForSelector('input[id="title"]', { timeout: 15_000 });
    const title = `E2E upload ${Date.now()}`;
    await page.fill('input[id="title"]', title);
    await page.fill(
      'textarea[id="description"]',
      "Playwright image upload test. Twenty characters at least.",
    );
    await page.fill('input[id="price_daily"]', "50000");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/listings\/.+\/edit/, { timeout: 20_000 });

    const upload = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/listings/") &&
        res.url().includes("/media") &&
        res.request().method() === "POST",
      { timeout: 90_000 },
    );
    await page.locator('label:has-text("Choose files") input[type="file"]').setInputFiles(FIXTURE);
    const mediaResp = await upload;
    const mediaBody = await mediaResp.text();
    expect(
      mediaResp.ok(),
      `Listing media upload failed: HTTP ${mediaResp.status()} ${mediaBody.slice(0, 500)}`,
    ).toBeTruthy();
    await expect(page.locator("text=done").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('img[alt=""]').first()).toBeVisible({ timeout: 15_000 });
  });

  test("KYC documents (settings → account)", async ({ page }) => {
    await login(page);
    await page.goto("/settings/account");
    await page.waitForSelector("text=Verification", { timeout: 15_000 });

    const gov = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/users/me/documents/") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 90_000 },
    );
    await page
      .locator('label:has-text("Upload government ID") input[type="file"]')
      .setInputFiles(FIXTURE);
    await gov;
    await expect(page.getByText("Uploaded. We will review")).toBeVisible({ timeout: 10_000 });

    const biz = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/users/me/documents/") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 90_000 },
    );
    await page
      .locator('label:has-text("Upload business registration") input[type="file"]')
      .setInputFiles(FIXTURE);
    await biz;
  });

  test("business logo (settings → business profile)", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("text=Business profile", { timeout: 15_000 });
    const done = page.waitForResponse(
      (res) => {
        if (!res.url().includes("/api/v1/owner/business-profile/")) return false;
        return res.request().method() === "PATCH";
      },
      { timeout: 90_000 },
    );
    await page.locator('label:has-text("Upload logo") input[type="file"]').setInputFiles(FIXTURE);
    await expect(page.getByText(/Uploading/u)).toBeVisible({ timeout: 10_000 });
    const profileResp = await done;
    const errBody = await profileResp.text();
    expect(
      profileResp.ok(),
      `Business profile upload failed: HTTP ${profileResp.status()} ${errBody.slice(0, 500)}`,
    ).toBeTruthy();
  });
});
