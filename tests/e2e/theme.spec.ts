import { expect, test } from "@playwright/test";

const storageKey = "airveek-theme";

test.use({ storageState: { cookies: [], origins: [] } });

test("light is the public default and a saved authenticated preference persists across routes", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe("light");

  await page.evaluate((key) => window.localStorage.setItem(key, "dark"), storageKey);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe("dark");

  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toHaveCount(0);

  await page.evaluate((key) => window.localStorage.setItem(key, "light"), storageKey);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("an invalid saved value falls back to light", async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, "system"), storageKey);
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe("light");
});
