import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Environment may already be loaded by the caller.
}

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(process.cwd());
const graphPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const statusPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-batch-status-v1.json");
const graph = JSON.parse(await readFile(graphPath, "utf8"));
const options = parseOptions(process.argv.slice(2));
const allIds = (graph.opportunities ?? []).map((opportunity) => opportunity.id);
const startIndex = options.from ? allIds.indexOf(options.from) : 0;
if (options.from && startIndex < 0) throw new Error(`Opportunity not found: ${options.from}`);
const selectedIds = options.only?.length
  ? options.only
  : allIds.slice(startIndex, options.limit ? startIndex + options.limit : undefined);

for (const id of selectedIds) {
  if (!allIds.includes(id)) throw new Error(`Opportunity not found: ${id}`);
}
if (selectedIds.length === 0) throw new Error("No opportunity IDs selected.");

const status = {
  version: 1,
  brand: "Airveek",
  startedAt: new Date().toISOString(),
  sourceGraph: path.relative(projectDirectory, graphPath),
  policy: {
    oneKitPerAttempt: "Never combine files across content-kit timestamps.",
    order: "preview image → image review → record → compile from actual timeline → generate ElevenLabs → compile framing → render 16x9 → QA → inspect and log",
    stopOnFailure: options.continueOnError !== true,
  },
  selectedIds,
  results: [],
};
await writeStatus(status);

for (const id of selectedIds) {
  const startedAt = new Date().toISOString();
  try {
    await run("node", ["scripts/run-opportunity-production.mjs", id]);
    status.results.push({ id, status: "complete", startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    status.results.push({ id, status: "failed", startedAt, finishedAt: new Date().toISOString(), error: message });
    await writeStatus(status);
    if (options.continueOnError !== true) throw error;
  }
  await writeStatus(status);
}

status.finishedAt = new Date().toISOString();
status.status = status.results.every((result) => result.status === "complete") ? "complete" : "partial";
await writeStatus(status);
console.log(JSON.stringify({ status: status.status, selected: selectedIds.length, results: status.results }, null, 2));

async function run(command, args) {
  const result = await execFileAsync(command, args, { cwd: projectDirectory, maxBuffer: 20 * 1024 * 1024 });
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}

async function writeStatus(value) {
  await writeFile(statusPath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseOptions(args) {
  const options = { only: [], continueOnError: false, from: null, limit: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--only") options.only = (args[++index] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    else if (argument === "--from") options.from = args[++index] ?? null;
    else if (argument === "--limit") options.limit = Number.parseInt(args[++index] ?? "", 10);
    else if (argument === "--continue-on-error") options.continueOnError = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit must be a positive integer.");
  return options;
}
