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

test("private auth pages are noindex and public SEO hubs are indexable", async ({ request }) => {
  const login = await request.get("/login");
  expect(login.status()).toBe(200);
  expect(login.headers()["x-robots-tag"]).toContain("noindex");
  expect(await login.text()).toContain('name="robots" content="noindex');

  for (const path of ["/product-photography", "/product-photo-prompts", "/features", "/use-cases", "/authors"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const body = await response.text();
    expect(body, path).toContain("<link rel=\"canonical\"");
    expect(body, path).toContain("<h1");
  }
});
