import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(projectRoot, "scripts", "provision-seo-member.mjs");
const userId = "00000000-0000-4000-8000-000000000000";

test("SEO member provisioning is dry-run by default", () => {
  const result = spawnSync(process.execPath, [
    script,
    "--user-id", userId,
    "--role", "writer",
    "--display-name", "Test Writer",
    "--slug", "test-writer",
    "--expertise", "product-photo, ecommerce",
  ], { cwd: projectRoot, encoding: "utf8", env: { ...process.env } });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "validated");
  assert.equal(report.action, "dry_run");
  assert.equal(report.payload.user_id, userId);
  assert.deepEqual(report.payload.expertise, ["product-photo", "ecommerce"]);
});

test("SEO member provisioning rejects malformed accounts before touching Supabase", () => {
  const result = spawnSync(process.execPath, [
    script,
    "--user-id", "not-a-uuid",
    "--role", "writer",
    "--display-name", "X",
    "--slug", "Bad Slug",
  ], { cwd: projectRoot, encoding: "utf8", env: { ...process.env } });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.equal(report.status, "fail");
  assert.ok(report.blockers.includes("user_id_must_be_a_uuid"));
});

test("SEO member provisioning documents the read-only Auth user listing", () => {
  const result = spawnSync(process.execPath, [script, "--help"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--list-users/);
  assert.match(result.stdout, /read-only/i);
});
