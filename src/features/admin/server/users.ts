import "server-only";

import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanupCreatorAssetsForUser } from "@/features/creator/server/assets";
import { requireAdminUser } from "./authorization";
import type {
  AdminDashboardData,
  AdminUser,
  AdminUserFilters,
  AdminUserList,
  AdminUserStatus,
} from "../types";

const SUPABASE_PAGE_SIZE = 100;
const DISPLAY_PAGE_SIZE = 10;
const MAX_SUPABASE_PAGES = 100;
const USAGE_PAGE_SIZE = 1_000;

type Metadata = Record<string, unknown>;

type GenerationUsage = {
  today: number;
  total: number;
  failed: number;
  lastGenerationAt: string | null;
};

type GenerationUsageRow = {
  user_id: string;
  status: string;
  created_at: string;
};

export async function listAdminUsers(filters: AdminUserFilters): Promise<AdminUserList> {
  await requireAdminUser();

  const normalizedUsers = await listUsersWithGenerationUsage();
  const search = filters.search.trim().toLowerCase();

  const filteredUsers = normalizedUsers.filter((user) => {
    const matchesSearch =
      search.length === 0 ||
      user.email?.toLowerCase().includes(search) ||
      user.displayName.toLowerCase().includes(search);
    const matchesStatus = filters.status === "all" || user.status === filters.status;

    return Boolean(matchesSearch && matchesStatus);
  });

  const pageSize = filters.pageSize > 0 ? filters.pageSize : DISPLAY_PAGE_SIZE;
  const page = filters.page > 0 ? filters.page : 1;
  const start = (page - 1) * pageSize;

  return {
    users: filteredUsers.slice(start, start + pageSize),
    total: filteredUsers.length,
    page,
    pageSize,
  };
}

export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  await requireAdminUser();
  const users = await listUsersWithGenerationUsage();
  return users.find((candidate) => candidate.id === userId) ?? null;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await requireAdminUser();

  const users = await listUsersWithGenerationUsage();
  const recentUsers = [...users]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5);

  return {
    totalUsers: users.length,
    verifiedUsers: users.filter((user) => user.emailConfirmedAt !== null).length,
    activeUsers: users.filter((user) => user.status === "active").length,
    suspendedUsers: users.filter((user) => user.status === "suspended").length,
    recentUsers,
  };
}

export async function suspendAdminUser(userId: string): Promise<void> {
  await requireAdminUser();
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function restoreAdminUser(userId: string): Promise<void> {
  await requireAdminUser();
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const currentAdmin = await requireAdminUser();

  if (currentAdmin.id === userId) {
    throw new Error("You cannot delete the account currently using the admin panel.");
  }

  await cleanupCreatorAssetsForUser(userId);

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId, false);

  if (error) {
    throw new Error(error.message);
  }
}

async function listAllUsers(): Promise<User[]> {
  const adminClient = createSupabaseAdminClient();
  const users: User[] = [];

  for (let page = 1; page <= MAX_SUPABASE_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: SUPABASE_PAGE_SIZE,
    });

    if (error) {
      throw new Error(error.message);
    }

    users.push(...data.users);

    if (data.users.length < SUPABASE_PAGE_SIZE) {
      return users;
    }
  }

  throw new Error("The user list is larger than the prototype limit.");
}

function mapSupabaseUser(user: User): AdminUser {
  const userMetadata = toMetadata(user.user_metadata);
  const appMetadata = toMetadata(user.app_metadata);
  const provider = readString(appMetadata, "provider") ?? "email";
  const displayName =
    readString(userMetadata, "name") ??
    readString(userMetadata, "display_name") ??
    readString(userMetadata, "full_name") ??
    user.email?.split("@")[0] ??
    "Unnamed user";

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    status: getStatus(user.banned_until),
    provider,
    generationsToday: 0,
    generationRequests: 0,
    failedGenerations: 0,
    lastGenerationAt: null,
  };
}

async function listUsersWithGenerationUsage(): Promise<AdminUser[]> {
  const [users, usage] = await Promise.all([listAllUsers(), listGenerationUsage()]);
  return users.map((user) => {
    const mapped = mapSupabaseUser(user);
    const userUsage = usage.get(user.id);
    return userUsage
      ? {
          ...mapped,
          generationsToday: userUsage.today,
          generationRequests: userUsage.total,
          failedGenerations: userUsage.failed,
          lastGenerationAt: userUsage.lastGenerationAt,
        }
      : mapped;
  });
}

async function listGenerationUsage(): Promise<Map<string, GenerationUsage>> {
  const rows = await listAllGenerationUsageRows();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const usage = new Map<string, GenerationUsage>();
  for (const row of rows) {
    const current = usage.get(row.user_id) ?? { today: 0, total: 0, failed: 0, lastGenerationAt: null };
    current.total += 1;
    if (row.status === "failed") current.failed += 1;
    if (row.status !== "failed" && new Date(row.created_at) >= startOfDay) current.today += 1;
    if (!current.lastGenerationAt) current.lastGenerationAt = row.created_at;
    usage.set(row.user_id, current);
  }
  return usage;
}

async function listAllGenerationUsageRows(): Promise<GenerationUsageRow[]> {
  const rows: GenerationUsageRow[] = [];
  const adminClient = createSupabaseAdminClient();
  for (let page = 0; page < MAX_SUPABASE_PAGES; page += 1) {
    const start = page * USAGE_PAGE_SIZE;
    const { data, error } = await adminClient
      .from("creator_assets")
      .select("user_id,status,created_at")
      .eq("kind", "generation")
      .order("created_at", { ascending: false })
      .range(start, start + USAGE_PAGE_SIZE - 1);
    if (error) {
      if (error.message.includes("creator_assets")) return [];
      throw new Error(error.message);
    }
    rows.push(...(data ?? []).map((value) => value as GenerationUsageRow));
    if ((data?.length ?? 0) < USAGE_PAGE_SIZE) return rows;
  }
  throw new Error("Generation usage is larger than the prototype monitoring limit.");
}

function getStatus(bannedUntil: string | undefined): AdminUserStatus {
  if (!bannedUntil) {
    return "active";
  }

  return new Date(bannedUntil).getTime() > Date.now() ? "suspended" : "active";
}

function toMetadata(value: unknown): Metadata {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Metadata)
    : {};
}

function readString(metadata: Metadata, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
