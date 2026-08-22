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

type Metadata = Record<string, unknown>;

export async function listAdminUsers(filters: AdminUserFilters): Promise<AdminUserList> {
  await requireAdminUser();

  const users = await listAllUsers();
  const normalizedUsers = users.map(mapSupabaseUser);
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
  const users = await listAllUsers();
  const user = users.find((candidate) => candidate.id === userId);

  return user ? mapSupabaseUser(user) : null;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await requireAdminUser();

  const users = (await listAllUsers()).map(mapSupabaseUser);
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
  };
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
