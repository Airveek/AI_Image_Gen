#!/usr/bin/env node

/**
 * Attach an existing Supabase Auth account to the SEO content team.
 *
 * This command never creates Auth users, sends invitations, enables
 * automation, or changes page state. It is dry-run by default; --apply is an
 * explicit service-role mutation for one already-verified user.
 */
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const args = process.argv.slice(2).filter((value) => value !== "--");
if (args.includes("--help") || args.length === 0) {
  console.log(`Usage: pnpm seo:member -- --user-id <uuid> --role <writer|brief_lead|editor|publisher|seo_admin> --display-name <name> --slug <slug> [--pod <pod>] [--expertise <a,b>] [--apply]\n       pnpm seo:member -- --list-users\n\nDry-run is the default. The user must already exist in Supabase Auth. --list-users is read-only. --apply only upserts content_members; it does not create accounts or enable automation.`);
  process.exit(args.includes("--help") ? 0 : 2);
}

if (args.includes("--list-users")) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) fail(["supabase_service_role_not_configured"]);
  const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const [{ data, error }, { data: members, error: memberError }] = await Promise.all([
    client.auth.admin.listUsers({ page: 1, perPage: 100 }),
    client.from("content_members").select("user_id,role,display_name,is_active"),
  ]);
  if (error) fail([`auth_user_list_failed:${error.message}`]);
  if (memberError) fail([`content_member_list_failed:${memberError.message}`]);
  const memberByUserId = new Map((members ?? []).map((member) => [String(member.user_id), member]));
  console.log(JSON.stringify({
    status: "listed",
    users: (data?.users ?? []).map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      contentMember: (() => {
        const member = memberByUserId.get(user.id);
        return member ? { role: member.role, displayName: member.display_name, active: member.is_active === true } : null;
      })(),
    })),
    note: "Read-only. No Auth users, content_members, pages, or automation switches were changed.",
  }, null, 2));
  process.exit(0);
}

const userId = optionValue("--user-id");
const role = optionValue("--role");
const displayName = optionValue("--display-name");
const slug = optionValue("--slug");
const podId = optionValue("--pod");
const expertise = (optionValue("--expertise") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .slice(0, 20);
const apply = args.includes("--apply");
const roles = new Set(["writer", "brief_lead", "editor", "publisher", "seo_admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const blockers = [];

if (!UUID_PATTERN.test(userId ?? "")) blockers.push("user_id_must_be_a_uuid");
if (!roles.has(role ?? "")) blockers.push("role_invalid");
if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 100) blockers.push("display_name_must_be_2_to_100_characters");
if (!SLUG_PATTERN.test(slug ?? "")) blockers.push("slug_must_be_lowercase_kebab_case");
if (podId && (podId.length < 1 || podId.length > 40)) blockers.push("pod_must_be_1_to_40_characters");
if (blockers.length) fail(blockers);

const payload = {
  user_id: userId,
  display_name: displayName.trim(),
  slug,
  role,
  pod_id: podId?.trim() || null,
  expertise,
  is_active: true,
};

if (!apply) {
  console.log(JSON.stringify({
    status: "validated",
    action: "dry_run",
    payload,
    next: "Confirm the Auth user ID and rerun with --apply to upsert this content-team membership.",
  }, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) fail(["supabase_service_role_not_configured"]);
const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });

const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);
if (authError || !authUser?.user) fail([`auth_user_not_found:${authError?.message ?? "unknown_error"}`]);

const { data, error } = await client
  .from("content_members")
  .upsert(payload, { onConflict: "user_id" })
  .select("user_id,display_name,slug,role,pod_id,expertise,is_active")
  .single();
if (error || !data) fail([`content_member_upsert_failed:${error?.message ?? "unknown_error"}`]);

console.log(JSON.stringify({
  status: "applied",
  user: { id: authUser.user.id, email: authUser.user.email ?? null },
  member: data,
  note: "Only the content_members role record was changed. Auth credentials, SEO pages, and automation switches were not changed.",
}, null, 2));

function optionValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function fail(values) {
  console.error(JSON.stringify({ status: "fail", blockers: values }, null, 2));
  process.exit(1);
}
