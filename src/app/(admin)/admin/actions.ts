"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage, requireAdminUser } from "@/features/admin/server/authorization";
import {
  deleteAdminUser,
  restoreAdminUser,
  suspendAdminUser,
} from "@/features/admin/server/users";
import type { AdminActionResult } from "@/features/admin/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function suspendUserAction(userId: string): Promise<AdminActionResult> {
  return runUserAction(userId, suspendAdminUser);
}

export async function restoreUserAction(userId: string): Promise<AdminActionResult> {
  return runUserAction(userId, restoreAdminUser);
}

export async function deleteUserAction(userId: string): Promise<AdminActionResult> {
  return runUserAction(userId, deleteAdminUser);
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
