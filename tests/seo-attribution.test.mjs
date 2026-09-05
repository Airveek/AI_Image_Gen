import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildSeoAttributionCookieMutation,
  parseSeoAttributionCookie,
} = await import("../src/lib/analytics/seo-attribution-core.ts");

const secret = "test-attribution-signing-secret-32-bytes-minimum";
const now = new Date("2026-08-30T10:00:00.000Z");

test("attribution records a signed first touch and parses it back", () => {
  const mutation = buildSeoAttributionCookieMutation({
    currentUrl: "https://airveek.com/product-photography/serum/?utm_source=google&utm_medium=organic&utm_campaign=launch&utm_content=hero&utm_term=fashion&fbclid=MetaClick_123&contentId=serum-guide",
    referrer: "https://www.google.com/search?q=serum+product+photo",
    consentState: "granted",
    existingCookieValue: null,
    signingSecret: secret,
    siteHostname: "airveek.com",
    now,
    fbp: "fb.1.1720000000000.123456789",
    fbc: "fb.1.1720000000000.MetaClick_123",
  });

  assert.equal(mutation.action, "set");
  if (mutation.action !== "set") return;
  assert.equal(mutation.attribution.firstTouch.source, "google");
  assert.equal(mutation.attribution.firstTouch.medium, "organic");
  assert.equal(mutation.attribution.firstTouch.contentId, "serum-guide");
  assert.equal(mutation.attribution.lastNonDirectTouch?.campaign, "launch");
  assert.equal(mutation.attribution.version, 2);
  assert.equal(mutation.attribution.firstTouch.utmContent, "hero");
  assert.equal(mutation.attribution.firstTouch.utmTerm, "fashion");
  assert.equal(mutation.attribution.firstTouch.fbclid, "MetaClick_123");
  assert.equal(mutation.attribution.firstTouch.fbp, "fb.1.1720000000000.123456789");
  assert.deepEqual(parseSeoAttributionCookie(mutation.cookieValue, secret), mutation.attribution);
});

test("a direct return retains the original non-direct touch", () => {
  const first = buildSeoAttributionCookieMutation({
    currentUrl: "https://airveek.com/use-cases/?utm_source=reddit&utm_medium=referral",
    referrer: "https://www.reddit.com/r/productphotography/",
    consentState: "granted",
    existingCookieValue: null,
    signingSecret: secret,
    siteHostname: "airveek.com",
    now,
  });
  assert.equal(first.action, "set");
  if (first.action !== "set") return;

  const second = buildSeoAttributionCookieMutation({
    currentUrl: "https://airveek.com/register",
    referrer: "https://airveek.com/use-cases/",
    consentState: "granted",
    existingCookieValue: first.cookieValue,
    signingSecret: secret,
    siteHostname: "airveek.com",
    now: new Date("2026-08-30T11:00:00.000Z"),
  });
  assert.deepEqual(second, { action: "none" });
  const retained = parseSeoAttributionCookie(first.cookieValue, secret);
  assert.equal(retained?.firstTouch.source, "reddit");
  assert.equal(retained?.lastNonDirectTouch?.source, "reddit");
});

test("denial clears an existing cookie and invalid signatures are rejected", () => {
  const mutation = buildSeoAttributionCookieMutation({
    currentUrl: "https://airveek.com/",
    referrer: null,
    consentState: "denied",
    existingCookieValue: "some-cookie",
    signingSecret: secret,
    siteHostname: "airveek.com",
    now,
  });
  assert.deepEqual(mutation, { action: "clear" });
  assert.equal(parseSeoAttributionCookie("tampered.value", secret), null);
});
