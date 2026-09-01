#!/usr/bin/env node

/**
 * Prepare deterministic, reviewable SEO brief files from the researched
 * opportunity graph. This is deliberately a file-generation step: it never
 * creates Supabase rows, generates images, or publishes pages. A brief still
 * needs a human-reviewed source/rights packet and an active assignment before
 * an agent can do any mutating work.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectDirectory = path.resolve(process.cwd());
const graphPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const outputDirectory = path.resolve(optionValue("--out-dir") ?? "docs/research/seo-brief-candidates");
const only = new Set((optionValue("--only") ?? "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean));
const limit = positiveInteger(optionValue("--limit"), Number.MAX_SAFE_INTEGER, 1, 10_000);
const writeFiles = process.argv.includes("--write");
const includePackPages = process.argv.includes("--pack");

const graph = JSON.parse(await readFile(graphPath, "utf8"));
const opportunities = (Array.isArray(graph.opportunities) ? graph.opportunities : [])
  .filter((opportunity) => !only.size || only.has(String(opportunity.id).toUpperCase()))
  .slice(0, limit);
if (!opportunities.length) fail("no_opportunities_selected");

const candidates = opportunities.flatMap((opportunity) => buildCandidates(opportunity));
if (writeFiles) {
  await mkdir(outputDirectory, { recursive: true });
  for (const candidate of candidates) {
    await writeFile(path.join(outputDirectory, `${candidate.opportunityId}-${candidate.job}.json`), `${JSON.stringify(candidate.brief, null, 2)}\n`);
  }
}

console.log(JSON.stringify({
  status: "prepared",
  action: writeFiles ? "wrote_files" : "dry_run",
  opportunityCount: opportunities.length,
  briefCount: candidates.length,
  packPages: includePackPages,
  outputDirectory: writeFiles ? path.relative(projectDirectory, outputDirectory) : null,
  candidates: candidates.map(({ opportunityId, job, path: candidatePath, brief }) => ({
    opportunityId,
    job,
    path: candidatePath,
    briefKey: brief.briefKey,
    intentKey: brief.intentKey,
    sourceAssetPath: brief.sourceAssetPath,
    rightsStatus: brief.rightsStatus,
    demandEvidenceCount: brief.demandEvidence.length,
    communityEvidenceCount: brief.demandEvidence.filter((item) => item.metricType === "Qualitative community").length,
    evidenceBlockers: brief.evidenceBlockers,
  })),
  next: writeFiles
    ? "Review each sourceAssetPath and rightsStatus, add evidence, then run pnpm seo:create-brief <file> [--apply]."
    : "Add --write to create candidate JSON files; no database or page changes were made.",
}, null, 2));

function buildCandidates(opportunity) {
  const id = String(opportunity.id ?? "").trim().toUpperCase();
  const category = String(opportunity.category ?? opportunity.productReference ?? "product").trim();
  const productReference = String(opportunity.productReference ?? category).trim();
  const sourceAssetPath = String(opportunity.assetPlan ?? "").trim() || null;
  const evidenceJobs = [
    { job: "listing", pageFamily: "listing", label: "clean listing image", query: `${category} clean listing product photo`, question: `How do I create a clean listing image for this ${category} while keeping the product identity accurate?` },
    { job: "lifestyle", pageFamily: "lifestyle", label: "lifestyle image", query: `${category} lifestyle product photo`, question: `How do I show this ${category} in a believable setting without hiding its scale or important details?` },
    { job: "detail", pageFamily: "detail", label: "detail and scale image", query: `${category} detail product photo`, question: `Which detail should this ${category} product photo prove before a shopper buys?` },
  ];
  const packJobs = [
    { job: "product-hub", pageFamily: "product-hub", label: "complete product photo set", query: `${category} product photography guide`, question: `How do I plan a complete product-photo set for this ${category} from one accurate source asset?` },
    { job: "prompt", pageFamily: "prompt", label: "copyable product photo prompt", query: `${category} product photo prompt`, question: `What tested Airveek prompt can I use to create a consistent ${category} product-photo set?` },
  ];
  const jobs = includePackPages ? [...evidenceJobs, ...packJobs] : evidenceJobs;
  return jobs.map((spec) => {
    const categorySlug = slugify(category);
    const briefKey = `${categorySlug}-${spec.job}-product-photo`;
    const intentKey = `${categorySlug}-${spec.job}-product-photo-workflow`;
    const sourceSignals = [
      { type: "buyer_question", label: "User-provided buyer question", source: "opportunity-graph", signal: opportunity.buyerQuestion, metricType: "User-provided" },
      { type: "platform_reference", label: "Marketplace/category reference", source: opportunity.amazonReference, signal: `Reference pattern for ${spec.label}; it is not proof of product facts or rights.`, metricType: "Proxy" },
      { type: "platform_requirement", label: "Platform image requirement", source: "https://support.google.com/merchants/answer/6324350?hl=en", signal: "Use a clear, accurate product image and preserve the correct product variant.", metricType: "Primary guidance" },
      { type: "editorial_guidance", label: "Shopify product photography workflow", source: "https://www.shopify.com/blog/product-photography", signal: "Product-photography guidance emphasizes clear product visibility, consistent framing, and angles that answer buyer questions; it does not support product-specific facts or conversion guarantees.", metricType: "Primary guidance" },
      ...(Array.isArray(opportunity.communityEvidence) ? opportunity.communityEvidence.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const source = typeof item.url === "string" && /^https:\/\//.test(item.url) ? item.url : null;
        const signal = typeof item.signal === "string" ? item.signal.trim() : "";
        if (!source || signal.length < 10) return [];
        return [{
          type: typeof item.type === "string" ? item.type : "community",
          label: typeof item.title === "string" ? item.title : "Community discussion",
          source,
          accessedAt: typeof item.accessedAt === "string" ? item.accessedAt : null,
          signal,
          application: typeof item.application === "string" ? item.application : null,
          metricType: "Qualitative community",
        }];
      }) : []),
    ];
    // The brief handoff stores externally verifiable demand evidence. Keep
    // internal/user-provided signals in the research block, but only pass
    // distinct HTTPS sources to the database contract. The handoff RPC is the
    // final guard; this normalization makes generated candidates actionable
    // instead of producing a file that can never be applied.
    const demandEvidence = sourceSignals
      .filter((item) => typeof item.source === "string" && /^https:\/\//.test(item.source))
      .map((item) => ({
        ...item,
        url: item.source,
        title: item.label,
        accessedAt: typeof item.accessedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.accessedAt)
          ? item.accessedAt
          : new Date().toISOString().slice(0, 10),
        claimSupported: item.signal,
      }));
    const internalDemandSignals = sourceSignals.filter((item) => !/^https:\/\//.test(String(item.source ?? "")));
    const brief = {
      briefKey,
      pageFamily: spec.pageFamily,
      productEntity: productReference,
      primaryQuery: spec.query,
      intentKey,
      buyerQuestion: spec.question,
      locale: "en",
      templateVersion: "product-photo-v1",
      priority: opportunity.testBatch === true ? 80 : 50,
      opportunityScore: null,
      demandEvidence,
      sourceAssetPath,
      rightsStatus: "unreviewed",
      research: {
        opportunityId: id,
        category,
        hook: opportunity.hook ?? null,
        practicalLesson: opportunity.practicalLesson ?? null,
        proofPlan: opportunity.proofPlan ?? null,
        imageJob: spec.label,
        productReference,
        internalDemandSignals,
      },
      evidenceBlockers: demandEvidence.length < 3 ? ["demand_evidence_requires_at_least_three_distinct_https_sources"] : [],
      constraints: [
        "Do not fabricate product facts, rights, logos, settings, timestamps, or outputs.",
        "Use a rights-cleared source asset before recording or generating evidence.",
        "Keep this intent distinct from the listing, lifestyle, and detail siblings.",
      ],
    };
    return {
      opportunityId: id,
      job: spec.job,
      path: path.join(path.relative(projectDirectory, outputDirectory), `${id}-${spec.job}.json`),
      brief,
    };
  });
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= minimum ? Math.min(parsed, maximum) : fallback;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "product";
}

function fail(message) {
  console.error(JSON.stringify({ status: "fail", error: message }, null, 2));
  process.exit(1);
}
