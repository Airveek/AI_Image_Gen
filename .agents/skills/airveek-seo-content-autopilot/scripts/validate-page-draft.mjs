#!/usr/bin/env node

/**
 * Deterministic, network-free contract validator for an Airveek SEO page
 * draft. The implementation is shared with the signed callback so local QA
 * and server-side ingestion cannot silently diverge.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateSeoPageDraft } from "../../../../src/features/seo/server/draft-contract.ts";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node .agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs <draft.json>");
  process.exit(2);
}

let draft;
try {
  draft = JSON.parse(await readFile(path.resolve(input), "utf8"));
} catch (error) {
  emit({ version: 1, status: "fail", valid: false, blockers: [`draft_unreadable:${error instanceof Error ? error.message : "unknown_error"}`], warnings: [], score: 0, checks: [] });
  process.exit(1);
}

const result = validateSeoPageDraft(draft, { reviewOnly: true });
emit(result);
process.exit(result.valid ? 0 : 1);

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
