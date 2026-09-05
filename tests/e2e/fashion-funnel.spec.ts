import path from "node:path";

import { expect, request as playwrightRequest, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const PRODUCT_IMAGE = path.resolve("public/images/airveek/mark-square.png");
const MODEL_IMAGE = path.resolve("public/images/airveek/features/ai-fashion-designer-v2.png");

test("fashion landing is canonical, focused, and routes every CTA to the playground", async ({ page, request }) => {
  const response = await request.get("/ai-fashion-photoshoot");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<link rel="canonical" href="https://airveek.com/ai-fashion-photoshoot"');
  expect(html).toContain("Your next fashion photoshoot starts with two photos.");
  expect(html).toMatch(/\$49(?: lifetime|\/month)/);
  expect(html).not.toContain("customer testimonial");

  await page.goto("/ai-fashion-photoshoot");
  const callsToAction = page.getByRole("link", { name: /Create 2 Images Free/i });
  expect(await callsToAction.count()).toBeGreaterThanOrEqual(3);
  for (const link of await callsToAction.all()) await expect(link).toHaveAttribute("href", "/playground/fashion-photoshoot");
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`fashion landing fits ${viewport.width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/ai-fashion-photoshoot");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}

test("anonymous references remain in IndexedDB and no upload starts before authentication", async ({ page }) => {
  let serverUploads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/creator/assets") && request.method() === "POST") serverUploads += 1;
  });
  const response = await page.goto("/playground/fashion-photoshoot");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await page.locator("#fashion-product").setInputFiles(PRODUCT_IMAGE);
  await page.locator("#fashion-model").setInputFiles(MODEL_IMAGE);
  await page.getByRole("button", { name: "Generate 2 Free Images" }).click();
  await expect(page.getByRole("heading", { name: "Create your free account" })).toBeVisible();
  expect(serverUploads).toBe(0);

  await expect.poll(() => page.evaluate(async () => {
    const id = localStorage.getItem("airveek:fashion-photoshoot-draft");
    if (!id) return null;
    return await new Promise<string[] | null>((resolve) => {
      const open = indexedDB.open("airveek-private-drafts", 1);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const get = open.result.transaction("drafts", "readonly").objectStore("drafts").get(id);
        get.onerror = () => resolve(null);
        get.onsuccess = () => resolve(get.result ? [get.result.productFile?.type, get.result.modelFile?.type] : null);
      };
    });
  })).toEqual(["image/png", "image/png"]);
});

test("Meta endpoint gates consent and rejects unknown properties and cross-origin URLs", async ({ request }) => {
  const eventId = "00000000-0000-4000-8000-000000000001";
  const withoutConsent = await request.post("/api/analytics/meta", { data: { eventName: "ViewContent", eventId, sourceUrl: "http://127.0.0.1:3001/ai-fashion-photoshoot" } });
  expect(await withoutConsent.json()).toEqual({ ok: true, skipped: "consent" });

  const context = await playwrightRequest.newContext({
    baseURL: "http://127.0.0.1:3001",
    extraHTTPHeaders: { "x-airveek-analytics-consent": "granted", cookie: "airveek_analytics_consent=granted" },
  });
  const unknownEvent = await context.post("/api/analytics/meta", { data: { eventName: "AddPaymentInfo", eventId, sourceUrl: "http://127.0.0.1:3001/ai-fashion-photoshoot" } });
  expect(unknownEvent.status()).toBe(400);
  const sensitiveProperty = await context.post("/api/analytics/meta", { data: { eventName: "ViewContent", eventId, sourceUrl: "http://127.0.0.1:3001/ai-fashion-photoshoot", properties: { prompt: "secret" } } });
  expect(sensitiveProperty.status()).toBe(400);
  const crossOrigin = await context.post("/api/analytics/meta", { data: { eventName: "ViewContent", eventId, sourceUrl: "https://example.com/private-image.png", properties: { prompt: "secret" } } });
  expect(crossOrigin.status()).toBe(400);
  await context.dispose();
});

test("a first visit pairs browser and server ViewContent with one event ID", async ({ page }) => {
  const serverEvents: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    (window as typeof window & { airveekPixelCalls: unknown[][] }).airveekPixelCalls = [];
    window.fbq = Object.assign((...args: unknown[]) => {
      (window as typeof window & { airveekPixelCalls: unknown[][] }).airveekPixelCalls.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
  });
  await page.route("**/api/analytics/meta", async (route) => {
    serverEvents.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/ai-fashion-photoshoot");
  await expect.poll(() => serverEvents.some((event) => event.eventName === "ViewContent")).toBe(true);
  const serverEvent = serverEvents.find((event) => event.eventName === "ViewContent");
  const pixelCalls = await page.evaluate(() => (window as typeof window & { airveekPixelCalls: unknown[][] }).airveekPixelCalls);
  const pixelEvent = pixelCalls.find((call) => call[1] === "ViewContent");
  expect(pixelEvent?.[3]).toEqual({ eventID: serverEvent?.eventId });
  await expect(page.getByRole("button", { name: "Allow measurement" })).toHaveCount(0);
});

test("registration requires explicit Terms acceptance", async ({ page }) => {
  await page.goto("/register");
  const checkbox = page.getByRole("checkbox", { name: /I agree to the Terms/i });
  await expect(checkbox).toBeVisible();
  await expect(checkbox).toHaveAttribute("required", "");
});
