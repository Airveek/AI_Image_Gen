import "server-only";

import type { User } from "@supabase/supabase-js";

import { getCreatorArena } from "@/features/creator/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/admin/server/authorization";
import { listAllUsers } from "@/features/admin/server/users";
import type {
  AdminInsightArena,
  AdminInsightCohort,
  AdminInsightsData,
  AdminInsightUser,
} from "@/features/admin/types";

const PAGE_SIZE = 1_000;
const MAX_PAGES = 100;
const REPORT_DAYS = 365;

type EventRow = {
  user_id: string;
  event_name: string;
  occurred_at: string;
  arena_id: string | null;
  plan_key: string | null;
};

type AssetRow = {
  user_id: string;
  status: string;
  arena_id: string | null;
  created_at: string;
};

type EntitlementRow = {
  user_id: string;
  provider_plan_id: string;
  plan_key: string | null;
  status: string;
  updated_at: string;
};

type ProfileRow = {
  user_id: string;
  user_type: string | null;
  primary_goal: string | null;
  first_touch_source: string | null;
};

type Entitlement = {
  plan: string;
  status: string;
  updatedAt: string;
};

type UserAggregate = {
  user: User;
  events: EventRow[];
  assets: AssetRow[];
  entitlement: Entitlement | null;
  profile: ProfileRow | null;
};

export async function getAdminInsights(): Promise<AdminInsightsData> {
  await requireAdminUser();

  const [users, events, assets, entitlements, profiles] = await Promise.all([
    listAllUsers(),
    listEvents(),
    listGenerationAssets(),
    listEntitlements(),
    listProfiles(),
  ]);

  const aggregates = buildAggregates(users, events, assets, entitlements, profiles);
  const now = Date.now();
  const active7Cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const active30Cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const paidUsers = new Set(
    aggregates.filter((aggregate) => isPaidStatus(aggregate.entitlement?.status)).map((aggregate) => aggregate.user.id),
  );
  const activatedUsers = new Set(
    aggregates
      .filter((aggregate) => aggregate.assets.some((asset) => asset.status === "ready"))
      .map((aggregate) => aggregate.user.id),
  );
  const checkoutStarters = new Set(
    aggregates
      .filter((aggregate) => aggregate.events.some((event) => event.event_name === "checkout_started"))
      .map((aggregate) => aggregate.user.id),
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      registered: users.length,
      verified: users.filter((user) => user.email_confirmed_at !== null).length,
      activated: activatedUsers.size,
      checkoutStarters: checkoutStarters.size,
      paid: paidUsers.size,
      paidConversionRate: percentage(paidUsers.size, users.length),
      active7Days: aggregates.filter((aggregate) => activityTimestamp(aggregate) >= active7Cutoff).length,
      active30Days: aggregates.filter((aggregate) => activityTimestamp(aggregate) >= active30Cutoff).length,
    },
    arenas: buildArenaInsights(aggregates, paidUsers),
    cohorts: buildCohorts(aggregates),
    users: aggregates
      .map((aggregate) => mapInsightUser(aggregate))
      .sort((first, second) => (second.lastActivityAt ?? second.createdAt).localeCompare(first.lastActivityAt ?? first.createdAt))
      .slice(0, 100),
  };
}

async function listEvents(): Promise<EventRow[]> {
  const cutoff = new Date(Date.now() - REPORT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return listRows<EventRow>("user_events", "user_id,event_name,occurred_at,arena_id,plan_key", "occurred_at", cutoff);
}

async function listGenerationAssets(): Promise<AssetRow[]> {
  const cutoff = new Date(Date.now() - REPORT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await listRows<AssetRow>("creator_assets", "user_id,status,arena_id,created_at", "created_at", cutoff, [
    { column: "kind", value: "generation" },
  ]);
  return rows;
}

async function listEntitlements(): Promise<EntitlementRow[]> {
  return listRows<EntitlementRow>("billing_entitlements", "user_id,provider_plan_id,plan_key,status,updated_at", "updated_at");
}

async function listProfiles(): Promise<ProfileRow[]> {
  return listRows<ProfileRow>("user_profiles", "user_id,user_type,primary_goal,first_touch_source", "user_id");
}

async function listRows<T>(
  table: string,
  columns: string,
  orderColumn: string,
  cutoff?: string,
  filters?: Array<{ column: string; value: string }>,
): Promise<T[]> {
  const rows: T[] = [];
  const client = createSupabaseAdminClient();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE;
    let query = client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (cutoff) {
      query = query.gte(orderColumn, cutoff);
    }

    for (const filter of filters ?? []) {
      query = query.eq(filter.column, filter.value);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Could not load ${table} for admin insights: ${error.message}`);
    }

    const pageRows = (data ?? []) as unknown as T[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
  }

  throw new Error(`The ${table} insight data is larger than the prototype limit.`);
}

function buildAggregates(
  users: User[],
  events: EventRow[],
  assets: AssetRow[],
  entitlements: EntitlementRow[],
  profiles: ProfileRow[],
): UserAggregate[] {
  const eventsByUser = groupBy(events, (row) => row.user_id);
  const assetsByUser = groupBy(assets, (row) => row.user_id);
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const entitlementByUser = new Map<string, Entitlement>();

  for (const row of entitlements) {
    const current = entitlementByUser.get(row.user_id);
    if (!current || row.updated_at > current.updatedAt) {
      entitlementByUser.set(row.user_id, {
        plan: row.plan_key === "premium" ? "Premium" : row.plan_key === "commercial" ? "Commercial" : planLabel(row.provider_plan_id),
        status: row.status,
        updatedAt: row.updated_at,
      });
    }
  }

  return users.map((user) => ({
    user,
    events: eventsByUser.get(user.id) ?? [],
    assets: assetsByUser.get(user.id) ?? [],
    entitlement: entitlementByUser.get(user.id) ?? null,
    profile: profilesByUser.get(user.id) ?? null,
  }));
}

function buildArenaInsights(aggregates: UserAggregate[], paidUsers: Set<string>): AdminInsightArena[] {
  const arenaIds = ["general-image", "product-fashion", "storybook-page", "image-to-sketch"];
  return arenaIds.map((arenaId) => {
    const rows = aggregates.flatMap((aggregate) => aggregate.assets.filter((asset) => asset.arena_id === arenaId));
    const users = new Set(rows.map((row) => row.user_id));
    const repeatUsers = new Set(
      [...users].filter((userId) => rows.filter((row) => row.user_id === userId).length > 1),
    );
    const successes = rows.filter((row) => row.status === "ready").length;
    const failures = rows.filter((row) => row.status === "failed").length;
    return {
      arenaId,
      label: getCreatorArena(arenaId)?.shortTitle ?? arenaId,
      uniqueUsers: users.size,
      attempts: rows.length,
      successes,
      failures,
      successRate: percentage(successes, rows.length),
      repeatUserRate: percentage(repeatUsers.size, users.size),
      paidUsers: [...users].filter((userId) => paidUsers.has(userId)).length,
    };
  });
}

function buildCohorts(aggregates: UserAggregate[]): AdminInsightCohort[] {
  const cutoff = Date.now() - REPORT_DAYS * 24 * 60 * 60 * 1000;
  const cohorts = new Map<string, AdminInsightCohort>();

  for (const aggregate of aggregates) {
    const createdAt = new Date(aggregate.user.created_at);
    if (createdAt.getTime() < cutoff) continue;
    const week = startOfWeek(createdAt);
    const cohort = cohorts.get(week) ?? { week, registered: 0, generated: 0, paid: 0, retained: 0 };
    cohort.registered += 1;
    if (aggregate.assets.some((asset) => asset.status === "ready")) cohort.generated += 1;
    if (isPaidStatus(aggregate.entitlement?.status)) cohort.paid += 1;
    const lastActivity = activityTimestamp(aggregate);
    if (lastActivity >= createdAt.getTime() + 7 * 24 * 60 * 60 * 1000) cohort.retained += 1;
    cohorts.set(week, cohort);
  }

  return [...cohorts.values()].sort((first, second) => second.week.localeCompare(first.week));
}

function mapInsightUser(aggregate: UserAggregate): AdminInsightUser {
  const arenaCounts = new Map<string, number>();
  for (const asset of aggregate.assets) {
    if (asset.arena_id) arenaCounts.set(asset.arena_id, (arenaCounts.get(asset.arena_id) ?? 0) + 1);
  }
  const mostUsedArena = [...arenaCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] ?? null;
  const activity = activityDates(aggregate);

  return {
    id: aggregate.user.id,
    email: aggregate.user.email ?? null,
    displayName: displayName(aggregate.user),
    createdAt: aggregate.user.created_at,
    verified: aggregate.user.email_confirmed_at !== null,
    paidPlan: aggregate.entitlement?.plan ?? null,
    paidStatus: aggregate.entitlement?.status ?? null,
    firstActivityAt: activity.length > 0 ? new Date(Math.min(...activity)).toISOString() : null,
    lastActivityAt: activity.length > 0 ? new Date(Math.max(...activity)).toISOString() : null,
    generationCount: aggregate.assets.length,
    mostUsedArena: mostUsedArena ? getCreatorArena(mostUsedArena)?.shortTitle ?? mostUsedArena : null,
    acquisitionSource: aggregate.profile?.first_touch_source ?? null,
    userType: aggregate.profile?.user_type ?? null,
    primaryGoal: aggregate.profile?.primary_goal ?? null,
  };
}

function activityDates(aggregate: UserAggregate): number[] {
  return [
    ...aggregate.events.map((event) => Date.parse(event.occurred_at)).filter(Number.isFinite),
    ...aggregate.assets.map((asset) => Date.parse(asset.created_at)).filter(Number.isFinite),
    ...(aggregate.user.last_sign_in_at ? [Date.parse(aggregate.user.last_sign_in_at)] : []),
  ];
}

function activityTimestamp(aggregate: UserAggregate): number {
  return Math.max(aggregate.user.last_sign_in_at ? Date.parse(aggregate.user.last_sign_in_at) : 0, ...activityDates(aggregate), 0);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row)) ?? [];
    group.push(row);
    groups.set(key(row), group);
  }
  return groups;
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function isPaidStatus(status: string | undefined): boolean {
  return status === "active" || status === "trialing" || status === "canceling" || status === "completed";
}

function planLabel(planId: string): string {
  if ([process.env.WHOP_PREMIUM_PLAN_ID, process.env.WHOP_PREMIUM_MONTHLY_PLAN_ID,
    process.env.STRIPE_PREMIUM_ONE_TIME_PRICE_ID, process.env.STRIPE_PREMIUM_SUBSCRIPTION_PRICE_ID].includes(planId)) return "Premium";
  if ([process.env.WHOP_COMMERCIAL_PLAN_ID, process.env.WHOP_COMMERCIAL_MONTHLY_PLAN_ID,
    process.env.STRIPE_COMMERCIAL_ONE_TIME_PRICE_ID, process.env.STRIPE_COMMERCIAL_SUBSCRIPTION_PRICE_ID].includes(planId)) return "Commercial";
  return "Paid plan";
}

function startOfWeek(date: Date): string {
  const result = new Date(date);
  const day = result.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + offset);
  result.setUTCHours(0, 0, 0, 0);
  return result.toISOString().slice(0, 10);
}

function displayName(user: User): string {
  const metadata = toMetadata(user.user_metadata);
  return readString(metadata, "name")
    ?? readString(metadata, "display_name")
    ?? readString(metadata, "full_name")
    ?? user.email?.split("@")[0]
    ?? "Unnamed user";
}

function toMetadata(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
