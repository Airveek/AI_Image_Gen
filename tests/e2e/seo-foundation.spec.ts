import { expect, test } from "@playwright/test";

test("robots and sitemap expose only the public SEO surface", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain("Sitemap: https://airveek.com/sitemap.xml");
  expect(robotsText).toContain("Disallow: /admin/");
  expect(robotsText).toContain("Disallow: /create/");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("https://airveek.com/sitemaps/static.xml");
  expect(sitemapText).not.toContain("/login");
  expect(sitemapText).not.toContain("/checkout");
});

test("sitemap rejects malformed dynamic shard addresses", async ({ request }) => {
  const response = await request.get("/sitemaps/not-a-valid-shard.xml");
  expect(response.status()).toBe(404);
});

test("homepage exposes supported schema and crawlable conversion anchors", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/<link rel="canonical"[^>]+https:\/\/airveek\.com(?:\/)?["']/);
  expect(body).toContain('"@type":"Organization"');
  expect(body).toContain('"@type":"WebSite"');
  expect(body).toContain('"@type":"SoftwareApplication"');
  expect(body).toMatch(/href="\/?#features"/);
  expect(body).toMatch(/href="\/?#pricing"/);
  expect(body).toMatch(/href="\/?#faq"/);
  expect(body).not.toContain('"@type":"FAQPage"');
});

test("reader-first product pages expose useful guidance without compliance-heavy copy", async ({ request }) => {
  const response = await request.get("/product-photography/generic-amber-dropper-serum-bottle/");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/>Quick setup<|>Quick setup\s*</);
  expect(body).toMatch(/>Common problems and fixes<|>Common problems and fixes\s*</);
  expect(body).toMatch(/Written by(?:\s|<!-- -->)+LIKA/);
  expect(body).not.toMatch(/>Source and rights\s*</i);
  expect(body).not.toMatch(/>Platform constraints\s*</i);
  expect(body).not.toMatch(/>Negative constraints\s*</i);
  expect(body).not.toMatch(/>Reviewed by\s/i);
  expect(body).not.toContain("rights_status");
  expect(body).not.toContain("generation_metadata");
  expect(body).not.toContain("rightsEvidenceId");
  expect(body).toContain('rel="canonical"');
  expect(body).toContain('name="description"');
  expect(body).toContain('"@type":"BreadcrumbList"');
  expect(body).toContain("Open in Airveek");
});

test("private auth pages are noindex and public SEO hubs are indexable", async ({ request }) => {
  const login = await request.get("/login");
  expect(login.status()).toBe(200);
  expect(login.headers()["x-robots-tag"]).toContain("noindex");
  expect(await login.text()).toContain('name="robots" content="noindex');

  for (const path of ["/register", "/checkout?plan=starter", "/create/product-photography", "/dashboard", "/admin/seo", "/api/seo/event", "/preview/example"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    expectPrivateCache(response, path);
  }

  const filtered = await request.get("/use-cases?sort=popular");
  expect(filtered.status()).toBe(200);
  expect(filtered.headers()["x-robots-tag"]).toContain("noindex");
  expectPrivateCache(filtered, "/use-cases?sort=popular");

  for (const path of ["/use-cases?color=amber", "/use-cases?utm_source=newsletter&utm_campaign=launch"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    expectPrivateCache(response, path);
  }

  // The proxy is intentionally stricter than the finite list of CDN-matched
  // campaign/filter keys. An unexpected parameter must still be treated as a
  // non-indexable, non-shared variant rather than relying on a future config
  // update to enumerate every possible key.
  const unknownQuery = await request.get("/use-cases?unlisted_filter=amber");
  expect(unknownQuery.status()).toBe(200);
  expect(unknownQuery.headers()["x-robots-tag"]).toContain("noindex");
  expectPrivateCache(unknownQuery, "/use-cases?unlisted_filter=amber");

  for (const path of ["/product-photography", "/product-photo-prompts", "/features", "/use-cases", "/authors"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const body = await response.text();
    expect(body, path).toContain("<link rel=\"canonical\"");
    expect(body, path).toContain("<h1");
    expect(body, path).toMatch(/<title>[^<]+<\/title>/);
    expect(body, path).toMatch(/<meta name="description" content="[^"]{40,}"/);
    expect(body, path).toContain("property=\"og:title\"");
    expect(body, path).toContain("name=\"twitter:card\"");
  }
});

function expectPrivateCache(response: { headers(): Record<string, string> }, path: string) {
  const cacheControl = response.headers()["cache-control"] ?? "";
  // Next's development server emits `no-cache, must-revalidate` for a
  // dynamically rendered query variant. Production is checked separately by
  // scripts/verify-seo-production.mjs and must emit the stricter
  // `private, no-store` policy at the CDN boundary.
  expect(cacheControl, path).toMatch(/private,\s*no-store|no-cache/);
}

test("content-agent callback rejects unsigned payloads", async ({ request }) => {
  const response = await request.post("/api/seo/agent/callback", {
    data: {},
    maxRedirects: 0,
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(await response.json()).toEqual({ error: "invalid_agent_signature" });
});

test("Core Web Vitals endpoint is consent-gated and same-origin", async ({ request }) => {
  const payload = { eventId: "00000000-0000-4000-8000-000000000001", metric: "lcp", value: 1200, pagePath: "/" };
  const withoutConsent = await request.post("/api/seo/vitals", { data: payload });
  expect(withoutConsent.status()).toBe(204);

  const crossOrigin = await request.post("/api/seo/vitals", {
    data: { ...payload, pagePath: "https://example.com/" },
    headers: { "x-airveek-analytics-consent": "granted" },
  });
  expect(crossOrigin.status()).toBe(400);
  expect(crossOrigin.headers()["x-robots-tag"]).toContain("noindex");
  expectPrivateCache(crossOrigin, "/api/seo/vitals");

  const attribution = await request.post("/api/seo/attribution", { data: { currentUrl: "/use-cases" } });
  expect(attribution.status()).toBe(200);
  expect(attribution.headers()["x-robots-tag"]).toContain("noindex");
  expectPrivateCache(attribution, "/api/seo/attribution");
});
