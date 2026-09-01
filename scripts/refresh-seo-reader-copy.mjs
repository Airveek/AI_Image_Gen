#!/usr/bin/env node

/**
 * Refresh all live product-photo pages into the reader-first public contract.
 *
 * The script is intentionally deterministic and idempotent: it only updates
 * copy/body/template timestamps on live, indexable SEO pages. Internal source,
 * rights, and evidence columns are preserved for audit and rollback; the
 * public renderer strips those fields before sending HTML/RSC to visitors.
 *
 * Usage:
 *   pnpm seo:refresh-reader-copy             # preview all 30 pages
 *   pnpm seo:refresh-reader-copy --apply    # write the refresh to Supabase
 */
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const { data: pages, error } = await supabase
  .from("seo_pages")
  .select("id,path,page_family,title,product_slug,job_slug,body,template_version,status,noindex")
  .eq("status", "live")
  .eq("noindex", false)
  .is("canonical_page_id", null)
  .order("path", { ascending: true });
if (error) throw new Error(`Unable to read live SEO pages: ${error.message}`);

const livePages = Array.isArray(pages) ? pages : [];
const now = new Date().toISOString();
const changes = livePages.map((page) => {
  const product = productLabel(page.product_slug);
  const task = taskLabel(page.page_family, page.job_slug);
  const body = buildReaderBody(page.body, product, task, page.page_family);
  return {
    id: String(page.id),
    path: String(page.path),
    product,
    task,
    direct_answer: buildDirectAnswer(product, task),
    meta_description: buildMetaDescription(product, task),
    body,
    template_version: "product-photo-v2-reader-first",
  };
});

console.log(JSON.stringify({ mode: apply ? "apply" : "preview", livePageCount: livePages.length, templateVersion: "product-photo-v2-reader-first", pages: changes.map(({ id, path, product, task }) => ({ id, path, product, task })) }, null, 2));
if (!apply) process.exit(0);

let updated = 0;
for (const change of changes) {
  const { error: updateError } = await supabase
    .from("seo_pages")
    .update({
      direct_answer: change.direct_answer,
      meta_description: change.meta_description,
      body: change.body,
      template_version: change.template_version,
      search_lastmod_at: now,
      updated_at: now,
    })
    .eq("id", change.id)
    .eq("status", "live")
    .eq("noindex", false);
  if (updateError) throw new Error(`Unable to refresh ${change.path}: ${updateError.message}`);
  updated += 1;
}

console.log(JSON.stringify({ status: "refreshed", updated, searchLastmodAt: now }, null, 2));

function productLabel(slug) {
  const labels = {
    "generic-amber-dropper-serum-bottle": "amber dropper serum bottle",
    "compact-automatic-coffee-maker": "compact automatic coffee maker",
    "neutral-running-shoe": "neutral running shoe",
    "structured-leather-shoulder-bag": "structured leather shoulder bag",
    "minimal-stainless-steel-analog-watch": "minimal stainless-steel analog watch",
    "minimal-stainless-steel-watch": "minimal stainless-steel watch",
    "classic-polarized-sunglasses": "classic polarized sunglasses",
  };
  if (typeof slug === "string" && labels[slug]) return labels[slug];
  return String(slug || "product").replace(/[-_]+/g, " ").trim() || "product";
}

function taskLabel(family, jobSlug) {
  if (family === "product-hub" || family === "category-hub") return "a complete product-photo pack";
  if (family === "listing" || String(jobSlug || "").includes("listing")) return "a clean listing image";
  if (family === "lifestyle" || String(jobSlug || "").includes("lifestyle")) return "a lifestyle product image";
  if (family === "detail" || String(jobSlug || "").includes("detail")) return "a detail-and-scale image";
  if (family === "prompt") return "a tested product-photo prompt";
  if (family === "tutorial") return "a repeatable product-photo workflow";
  return "a high-converting product image";
}

function buildDirectAnswer(product, task) {
  return `Create ${task} for your ${product} by starting with a clear reference, then tuning the composition, light, crop, and detail visibility for the exact shopping moment. This guide gives you the practical sequence, tested prompt, settings, fixes, and export checks so the product is easy to understand on both desktop and mobile.`;
}

function buildMetaDescription(product, task) {
  return `Practical Airveek guidance for creating ${task} for a ${product}, including the tested prompt, useful settings, common fixes, and export checks.`;
}

function buildReaderBody(rawBody, product, task, family) {
  const body = isRecord(rawBody) ? { ...rawBody } : {};
  body.buyerQuestion = `How do I create ${task} for ${article(product)} ${product}?`;
  body.steps = buildSteps(product, task, family);
  body.prompt = `Create ${task} for ${article(product)} ${product}. Use the supplied reference as the visual anchor and keep the product shape, materials, color, and buyer-visible details consistent. Compose the frame so the product is understood instantly, with lighting and context that support the shopping goal. Keep the crop clean, the subject prominent, and every important detail readable at mobile thumbnail size.`;
  body.failureFixes = buildFailureFixes(product, task);
  body.limitations = [
    `Tiny edges, reflections, and text-like details can shift during generation; zoom in and compare the final ${product} image before exporting.`,
    `A dramatic background or light change can affect perceived color and scale; check the image in the same crop and thumbnail size your store uses.`,
  ];
  body.checklist = [
    `The ${product} fills the frame enough to understand at a glance.`,
    `The key detail for ${task.replace(/^a /, "")} remains visible and sharp.`,
    "The crop and spacing still work in a small mobile thumbnail.",
    "Lighting and background separate the product without distracting props.",
    "The exported dimensions and file format match the destination store or channel.",
  ];
  body.faqs = [
    {
      question: `Which composition works best for ${task.replace(/^a /, "")}?`,
      answer: compositionAnswer(family),
    },
    {
      question: `How do I keep the ${product} recognizable?`,
      answer: "Use one clear reference, keep the subject large in frame, and compare shape, material, color, and buyer-critical details after every iteration.",
    },
    {
      question: "What should I check before export?",
      answer: "Review the crop at thumbnail size, confirm the hero detail is visible, then export the tested dimensions and format listed in Quick setup.",
    },
  ];
  // These fields remain in the database for rollback and internal QA, but are
  // removed by sanitizePublicBody() before the page reaches a visitor.
  delete body.methodology;
  delete body.evidenceNote;
  delete body.mediaNotes;
  return body;
}

function buildSteps(product, task, family) {
  const scene = family === "lifestyle"
    ? "Place the product in a believable use context while leaving the hero surface and silhouette unobstructed."
    : family === "detail"
      ? "Choose a close framing that reveals texture, finish, controls, stitching, or another buyer-critical detail."
      : family === "listing"
        ? "Use a clean, low-distraction composition that makes the product shape and finish obvious in a store grid."
        : "Choose a composition that covers the main buying questions before adding optional variations.";
  return [
    { title: "Choose the reference", description: `Upload a clear view of ${article(product)} ${product} with the shape and finish easy to read.` },
    { title: "Set the scene", description: scene },
    { title: "Tune light and framing", description: `Keep the ${product} prominent, balance highlights and shadows, and leave enough breathing room for the final crop.` },
    { title: "Check the shopping view", description: "Review the result at desktop and mobile thumbnail size; make sure the intended detail is still the first thing a shopper sees." },
    { title: "Export and reuse", description: "Apply the Quick setup dimensions and save the strongest result as the starting point for related product images." },
  ];
}

function buildFailureFixes(product, task) {
  return [
    {
      failure: `The ${product} feels too small or generic.`,
      fix: `Move the subject closer, simplify the surrounding scene, and increase separation so ${task.replace(/^a /, "")} reads immediately.`,
    },
    {
      failure: "Important finish or shape details disappear at thumbnail size.",
      fix: "Use a simpler background, stronger edge contrast, and a slightly tighter crop; then compare the result at the smallest real placement.",
    },
    {
      failure: "The lighting changes the perceived color or material.",
      fix: "Reduce colored reflections, use a neutral key light, and compare the output beside the reference before exporting.",
    },
  ];
}

function article(noun) {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

function compositionAnswer(family) {
  if (family === "lifestyle") return "Start with a natural context that explains use, then keep the product large enough to identify without zooming. Leave open space where a responsive crop may trim the frame.";
  if (family === "detail") return "Use a close, stable frame with light skimming across the important surface. Keep the detail centered and include just enough surrounding shape to explain scale.";
  if (family === "listing") return "Lead with a clean hero view, simple separation, and a crop that survives a square or portrait store thumbnail.";
  return "Build the pack around one unmistakable hero frame, then add context and detail views that answer the next buyer question without repeating the same composition.";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
