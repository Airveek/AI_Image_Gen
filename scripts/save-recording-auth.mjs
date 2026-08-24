import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.RECORDING_BASE_URL ?? "http://127.0.0.1:3001";
const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");
const email = process.env.RECORDING_EMAIL?.trim();
const password = process.env.RECORDING_PASSWORD?.trim();

await mkdir(path.dirname(authPath), { recursive: true });
const browser = await chromium.launch({ headless: Boolean(email && password) });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
if (email && password) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}

await page.waitForURL(
  (url) => ["/dashboard", "/create", "/library"].some((route) => url.pathname.startsWith(route)),
  { timeout: 300_000 },
);
await context.storageState({ path: authPath });
await browser.close();

console.log(`Saved recording login state to ${authPath}`);
