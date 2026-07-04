// Wave-7 mandatory Playwright smoke (TSD §8 / wave-7.md):
// F1 register→OTP→checklist · F9 six-step publish · F4 accept with
// acknowledgment · refund-preview figures match the API.
// Requires: backend :8000 (DEBUG, E2E_FIXED_OTP=123456, seed_e2e run),
// portal :3000 proxying to it.
import { expect, test } from "@playwright/test";

const SUPPLIER = { email: "supplier@e2e.terminal.test", password: "e2e-password-1234" };
const FIXED_OTP = process.env.E2E_FIXED_OTP ?? "123456";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(SUPPLIER.email);
  await page.getByRole("textbox", { name: "Password" }).fill(SUPPLIER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test("F1: register → fixed OTP (both channels) → dashboard checklist", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Newcomer");
  await page.getByLabel("Email").fill(`newcomer+${stamp}@e2e.terminal.test`);
  // Local NG shape: 0 + 10 digits (normalize_ng_phone); stamp keeps it unique.
  await page.getByLabel("Phone number").fill(`0705${String(stamp).slice(-7)}`);
  await page.getByRole("textbox", { name: "Password" }).fill("Sufficient1");
  await page.getByText("I accept the Terms of Service").click();
  await page.getByText("I accept the Privacy Policy (NDPR)").click();
  await page.getByRole("button", { name: "Create account" }).click();

  // phone then email — same 6-cell input, fixed code
  for (const step of ["phone", "email"]) {
    await expect(
      page.getByText(step === "phone" ? "Verify your phone" : "Verify your email"),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Digit 1").click();
    await page.keyboard.type(FIXED_OTP);
  }
  await page.waitForURL(/dashboard|login/);
  if (page.url().includes("login")) {
    await expect(page.getByText("Account verified")).toBeVisible();
  } else {
    // Registration creates a hirer; the supplier journey starts at activation.
    await expect(page.getByText("Start supplying on Terminal")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Become a supplier" }).click();
    await expect(page.getByText("Get set up")).toBeVisible({ timeout: 15_000 });
  }
});

test("F9: six-step create → publish → Live", async ({ page }) => {
  await login(page);
  await page.goto("/assets/new");

  // ① class & type
  await page.getByRole("button", { name: /Plant & Machinery/ }).click();
  await page.getByLabel("Asset type").selectOption("Generator");
  await page.getByRole("button", { name: "Next" }).click();

  // ② details & specs
  await page.getByLabel("Title").fill("E2E 100kVA Generator");
  await page
    .getByLabel("Description")
    .fill("Smoke-test generator with fresh service history, delivery available across Lagos corridors.");
  await page.getByLabel(/Make/).first().fill("Perkins");
  await page.getByLabel(/Model/).first().fill("P100");
  await page.getByLabel(/Year/).first().fill("2021");
  // required plant-common selects (spec_data.py)
  await page.locator("select#spec-condition").selectOption("Good");
  await page.locator("select#spec-operator_included").selectOption("Not available");
  await page.getByRole("button", { name: "Next" }).click();

  // ③ pricing — creates the server draft
  await page.getByLabel(/Daily rate/).fill("150,000");
  await page.getByRole("button", { name: /Save draft & continue|Next/ }).click();

  // ④ photos — upload one generated file through the real presign pipeline
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAF0lEQVR4nGP8z4AAmDBYowJDXQAAWi0DHShTRUUAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: png });
  await expect(page.locator("figure img")).toHaveCount(1, { timeout: 30_000 });
  await page.getByRole("button", { name: "Next" }).click();

  // ⑤ location — the seeded yard chip
  await page.getByRole("button", { name: /E2E|yard/i }).first().click();
  await page.getByRole("button", { name: "Next" }).click();

  // ⑥ review → publish → the Live beat
  await expect(page.getByText("Ready to go live")).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Live. Your asset is now on the map.")).toBeVisible({ timeout: 15_000 });
});

test("F4: accept the seeded request with acknowledgment", async ({ page }) => {
  await login(page);
  await page.goto("/hires");
  const needs = page.getByRole("tab", { name: /Needs response/ });
  await needs.click();
  await page.getByRole("link", { name: /E2E/ }).first().click();
  await page.waitForURL(/hires\//);
  await page.getByRole("button", { name: "Accept hire" }).click();
  const ack = page.getByRole("checkbox");
  if (await ack.count()) await ack.first().check();
  await page.getByRole("dialog").getByRole("button", { name: "Accept hire" }).click();
  await expect(page.getByText("Awaiting payment").first()).toBeVisible({ timeout: 15_000 });
});

test("refund preview figures match the API", async ({ page }) => {
  await login(page);
  await page.goto("/hires");
  await page.getByRole("tab", { name: "Upcoming" }).click();
  // the seeded CONFIRMED hire (Upcoming also holds the F4-accepted one)
  const row = page.getByRole("row").filter({ hasText: "Confirmed" }).first();
  await row.getByRole("link").first().click();
  await page.waitForURL(/hires\/(.+)/);
  const hireId = page.url().split("/hires/")[1];

  // page.request shares the browser context's auth cookies
  const apiResp = await page.request.get(`/bff/hires/${hireId}/refund-preview`);
  expect(apiResp.ok()).toBeTruthy();
  const preview = (await apiResp.json()) as { amount_display: string; hire_value_display: string };

  await page.getByRole("button", { name: "Cancel hire" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(preview.hire_value_display).first()).toBeVisible();
  await expect(dialog.getByText(preview.amount_display).first()).toBeVisible();
  // close without cancelling — the manifest was the assertion
  await dialog.getByRole("button", { name: "Keep hire" }).click();
});
