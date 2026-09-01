#!/usr/bin/env node

/**
 * Verify the response contract emitted by the built Next.js server.
 *
 * The development Playwright server is useful for route behavior, but it does
 * not exercise the production cache/header path. This smoke test starts the
 * already-built app locally and sends the canonical forwarded-host headers a
 * Vercel request receives, so query variants cannot silently lose their
 * noindex/private-cache contract.
 */
import { spawn } from "node:child_process";

const port = 3_021;
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn("pnpm", ["start", "-p", String(port)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });

try {
  await waitForServer();
  await assertResponse("/product-photography", { noindex: false, privateNoStore: false });
  await assertResponse("/sitemap.xml", { noindex: false, privateNoStore: false });
  await assertResponse("/sitemaps/not-a-valid-shard.xml", { status: 404, noindex: false, privateNoStore: false });
  await assertResponse("/product-photography?utm_source=production-smoke", { noindex: true, privateNoStore: true });
  await assertResponse("/use-cases?sort=popular", { noindex: true, privateNoStore: true });
  await assertResponse("/login", { noindex: true, privateNoStore: true });
  await assertResponse("/api/seo/event", { status: 405, noindex: true, privateNoStore: true });
  console.log(JSON.stringify({ status: "pass", checks: 7, port }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: "fail",
    error: error instanceof Error ? error.message : String(error),
    serverOutput: output.slice(-4_000),
  }, null, 2));
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let lastError = "server did not respond";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited with code ${child.exitCode}: ${output.slice(-1_000)}`);
    try {
      const response = await fetch(`${baseUrl}/login`, {
        redirect: "manual",
        headers: canonicalHeaders(),
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status >= 200 && response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for next start: ${lastError}`);
}

async function assertResponse(pathname, expected) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    headers: canonicalHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  const robots = (response.headers.get("x-robots-tag") ?? "").toLowerCase();
  const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
  const hasNoindex = robots.includes("noindex");
  const hasPrivateNoStore = cacheControl.includes("private") && cacheControl.includes("no-store");
  const expectedStatus = expected.status ?? 200;
  if (response.status !== expectedStatus) throw new Error(`${pathname}: expected HTTP ${expectedStatus}, received ${response.status}`);
  if (hasNoindex !== expected.noindex) throw new Error(`${pathname}: expected noindex=${expected.noindex}, received ${robots || "no X-Robots-Tag"}`);
  if (hasPrivateNoStore !== expected.privateNoStore) throw new Error(`${pathname}: expected private/no-store=${expected.privateNoStore}, received ${cacheControl || "no Cache-Control"}`);
}

function canonicalHeaders() {
  return { host: "airveek.com", "x-forwarded-host": "airveek.com", "x-forwarded-proto": "https" };
}
