import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");

test.beforeEach(() => {
  test.skip(!existsSync(authPath), "Run pnpm recording:auth to create the local test login state.");
});

test("offers only working account options and closes predictably", async ({ page }) => {
  await page.goto("/dashboard");

  const creatorNavigation = page.getByRole("navigation", { name: "Creator navigation" });
  await expect(creatorNavigation.getByRole("link", { name: "Settings" })).toHaveCount(0);

  const trigger = page.getByRole("button", { name: /Open account menu/ });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Account" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
  await expect(panel.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  await expect(panel.getByRole("link", { name: "Help and resources" })).toHaveAttribute("href", "/support");
  await expect(panel.getByRole("link", { name: "Plans and pricing" })).toHaveAttribute("href", "/plans");
  await expect(panel.getByRole("link", { name: "Purchase history" })).toHaveAttribute("href", "/purchase-history");
  await expect(panel.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(panel.getByText("Create team", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Advanced tools", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Open in desktop app", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Theme" }).click();
  await expect(page.getByRole("radio", { name: "Light" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("main").click({ position: { x: 8, y: 8 } });
  await expect(panel).toHaveCount(0);
});

test("keeps the account panel inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Open account menu/ }).click();
  await expect(page.getByRole("dialog", { name: "Account" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
