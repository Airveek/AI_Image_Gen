"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage, requireAdminUser } from "@/features/admin/server/authorization";
import {
  deleteAdminUser,
  restoreAdminUser,
  suspendAdminUser,
} from "@/features/admin/server/users";
import type { AdminActionResult } from "@/features/admin/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEO_ROLE_PATTERN = /^(writer|brief_lead|editor|publisher|seo_admin)$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function suspendUserAction(userId: string): Promise<AdminActionResult> {
  return runUserAction(userId, suspendAdminUser);
}

export async function restoreUserAction(userId: string): Promise<AdminActionResult> {
  return runUserAction(userId, restoreAdminUser);
}

export async function deleteUserAction(userId: string): Promise<AdminActionResult> {
  return runUserAction(userId, deleteAdminUser);
}

/**
 * Attach an existing Auth account to the SEO content team.
 *
 * This deliberately does not create Auth users, send invitations, change
 * credentials, publish pages, or enable the automation switch. The account
 * must already exist and the membership is the only record mutated.
 */
export async function provisionSeoMemberAction(
  _previousState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  try {
    await requireAdminUser();
    const userId = validateUserId(requiredText(formData, "userId"));
    const role = requiredText(formData, "role");
    const displayName = requiredText(formData, "displayName");
    const slug = requiredText(formData, "slug");
    const podId = optionalText(formData, "podId");
    const isActive = formData.get("isActive") === "true";
    const expertise = (optionalText(formData, "expertise") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (!SEO_ROLE_PATTERN.test(role)) throw new Error("Choose a valid SEO content role.");
    if (displayName.length < 2 || displayName.length > 100) throw new Error("Display name must be 2 to 100 characters.");
    if (!SLUG_PATTERN.test(slug) || slug.length > 120) throw new Error("Slug must use lowercase kebab-case.");
    if (podId && (podId.length < 1 || podId.length > 40)) throw new Error("Pod must be 1 to 40 characters.");

    const client = createSupabaseAdminClient();
    const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) throw new Error("The selected Auth account could not be found.");
    if (isActive && authUser.user.banned_until && new Date(authUser.user.banned_until).getTime() > Date.now()) {
      throw new Error("Suspended accounts cannot be added to the active SEO content team.");
    }

    const { data: existingSlug, error: slugError } = await client
      .from("content_members")
      .select("user_id")
      .eq("slug", slug)
      .neq("user_id", userId)
      .maybeSingle();
    if (slugError) throw new Error("The content-team membership could not be checked.");
    if (existingSlug) throw new Error("That SEO author slug is already in use.");

    const { data: existingMember, error: memberError } = await client
      .from("content_members")
      .select("pod_id,expertise")
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) throw new Error("The existing content-team membership could not be loaded.");

    const { error } = await client.from("content_members").upsert(
      {
        user_id: userId,
        display_name: displayName,
        slug,
        role,
        pod_id: podId || existingMember?.pod_id || null,
        expertise: expertise.length ? expertise : Array.isArray(existingMember?.expertise) ? existingMember.expertise : [],
        is_active: isActive,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`Content-team membership could not be saved: ${error.message}`);

    revalidatePath("/admin/users");
    revalidatePath("/admin/seo");
    return { ok: true, message: "SEO membership saved." };
  } catch (error) {
    return { ok: false, message: getActionErrorMessage(error) };
  }
}

async function runUserAction(
  userId: string,
  action: (userId: string) => Promise<void>,
): Promise<AdminActionResult> {
  try {
    const currentAdmin = await requireAdminUser();
    const validUserId = validateUserId(userId);

    if (action === deleteAdminUser && currentAdmin.id === validUserId) {
      return { ok: false, message: "You cannot delete your own admin account." };
    }

    await action(validUserId);
    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return { ok: true };
  } catch (error) {
    return { ok: false, message: getActionErrorMessage(error) };
  }
}

function validateUserId(userId: string): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("Invalid user id.");
  }

  return userId;
}

function requiredText(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function optionalText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}
