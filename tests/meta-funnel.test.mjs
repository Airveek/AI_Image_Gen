import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { isFunnelEventName, isMetaCapiEventName, isSanitizedFunnelProperties, sanitizeFunnelProperties } = await import("../src/lib/analytics/meta.ts");
const { normalizeAndHashMetaIdentifier } = await import("../src/lib/analytics/meta-matching.ts");

test("Meta event contracts allow only the documented funnel and CAPI events", () => {
  assert.equal(isFunnelEventName("GenerationSucceeded"), true);
  assert.equal(isMetaCapiEventName("GenerationSucceeded"), true);
  assert.equal(isFunnelEventName("AddPaymentInfo"), false);
  assert.equal(isFunnelEventName("arbitrary_event"), false);
});

test("analytics properties drop prompts, image details, URLs, and arbitrary input", () => {
  assert.deepEqual(sanitizeFunnelProperties({
    arena_id: "product-fashion",
    content_name: "AI Fashion Photoshoot",
    value: 49,
    currency: "USD",
    prompt: "private prompt",
    image_url: "https://private.example/image.png",
    filename: "model.jpg",
    face_embedding: [1, 2, 3],
  }), { arena_id: "product-fashion", content_name: "AI Fashion Photoshoot", currency: "USD", value: 49 });
  assert.equal(isSanitizedFunnelProperties({ placement: "hero", generation_count: 2 }), true);
  assert.equal(isSanitizedFunnelProperties({ placement: "hero", prompt: "private" }), false);
  assert.equal(isSanitizedFunnelProperties({ content_name: " <unsafe> " }), false);
});

test("Meta matching normalizes and hashes identifiers before delivery", () => {
  assert.equal(normalizeAndHashMetaIdentifier("  USER@Example.COM "), "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514");
  assert.equal(normalizeAndHashMetaIdentifier("   "), null);
});

test("database migration installs atomic credits, immutable attempts, and private outbox grants", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202609060001_meta_fashion_funnel.sql", import.meta.url), "utf8");
  assert.match(sql, /reserve_creator_generation_credit/);
  assert.match(sql, /consume_creator_generation_credit/);
  assert.match(sql, /release_creator_generation_credit/);
  assert.match(sql, /generation_attempt_id uuid/);
  assert.match(sql, /billing_checkout_attempts/);
  assert.match(sql, /protect_billing_checkout_attempt_snapshot/);
  assert.match(sql, /uses_free_credit boolean/);
  assert.match(sql, /assets\.status = 'ready'/);
  assert.match(sql, /revoke all on public\.meta_event_outbox from anon, authenticated/);
});

test("checkout redirect pages never emit Purchase", async () => {
  const files = [
    "../src/app/checkout/complete/page.tsx",
    "../src/components/checkout/checkout-launcher.tsx",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /track(?:FunnelEvent|PixelEvent)\(["']Purchase["']/);
  }
});
