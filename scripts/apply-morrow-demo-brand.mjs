#!/usr/bin/env node

/**
 * Apply the single fictional MORROW demo brand to every reusable ecommerce
 * recording spec and SEO brief candidate. This is a deterministic config
 * update; it does not generate images, publish pages, or change database
 * approval state.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectDirectory = path.resolve(process.cwd());
const logoPath = "public/images/morrow/morrow-logo.png";
const brand = {
  name: "morrow",
  logoAssetPath: logoPath,
  logoPolicy: "inherent_product_branding",
  logoRightsStatus: "approved",
  requiresLogo: true,
  purpose: "Fictional demo brand used to show how a consistent product brand appears across Airveek examples.",
};
const brandPrompt = "Use the supplied fictional MORROW logo reference (second input) as the product's only brand mark. Apply the exact lowercase wordmark \"morrow\" with its two sparkle stars naturally to the product label, package, or product surface; preserve the mark without inventing other words.";
const brandConstraint = "Use only the supplied fictional MORROW logo; do not add other readable text, claims, watermarks, retailer logos, or competing brand marks.";

const recordingDirectory = path.join(projectDirectory, "recording", "use-cases");
const recordingFiles = (await readdir(recordingDirectory)).filter((name) => /^ECO\d+\.json$/i.test(name)).sort();
for (const file of recordingFiles) {
  const filePath = path.join(recordingDirectory, file);
  const config = JSON.parse(await readFile(filePath, "utf8"));
  config.additionalInputs = [...new Set([...(Array.isArray(config.additionalInputs) ? config.additionalInputs : []), logoPath])];
  config.brand = brand;
  config.fields = updateFields(config.fields);
  config.negativeConstraints = updateConstraints(config.negativeConstraints);
  if (config.jobs && typeof config.jobs === "object" && !Array.isArray(config.jobs)) {
    for (const job of Object.values(config.jobs)) {
      if (!job || typeof job !== "object" || Array.isArray(job)) continue;
      job.fields = updateFields(job.fields);
      job.negativeConstraints = updateConstraints(job.negativeConstraints);
    }
  }
  await writeJson(filePath, config);
}

const candidateDirectory = path.join(projectDirectory, "docs", "research", "seo-brief-candidates");
const candidateFiles = (await readdir(candidateDirectory)).filter((name) => name.endsWith(".json")).sort();
for (const file of candidateFiles) {
  const filePath = path.join(candidateDirectory, file);
  const candidate = JSON.parse(await readFile(filePath, "utf8"));
  candidate.brand = brand;
  await writeJson(filePath, candidate);
}

for (const relativePath of [
  "docs/research/airveek-production-queue-v1.json",
  "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json",
]) {
  const filePath = path.join(projectDirectory, relativePath);
  const document = JSON.parse(await readFile(filePath, "utf8"));
  document.demoProductBrand = brand;
  await writeJson(filePath, document);
}

console.log(JSON.stringify({ status: "complete", recordingSpecs: recordingFiles.length, briefCandidates: candidateFiles.length, logoPath, brand: brand.name }, null, 2));

function updateFields(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) return field;
    if (field.label !== "Describe the image you want" || typeof field.value !== "string") return field;
    let value = field.value.trim();
    if (!/MORROW|morrow/.test(value)) value = `${brandPrompt} ${value}`;
    value = value.replaceAll("Do not add readable text", "Do not add any other readable text");
    value = value.replaceAll("Do not invent readable text", "Do not invent any other readable text");
    value = value.replaceAll("Do not invent text", "Do not invent any other readable text");
    return { ...field, value };
  });
}

function updateConstraints(constraints) {
  const list = Array.isArray(constraints) ? constraints.filter((item) => typeof item === "string" && item.trim()) : [];
  const normalized = list.map((item) => item.replaceAll("Do not add readable text", "Do not add any other readable text").replaceAll("Do not invent readable text", "Do not invent any other readable text"));
  return normalized.some((item) => item.includes("fictional MORROW logo")) ? normalized : [...normalized, brandConstraint];
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
