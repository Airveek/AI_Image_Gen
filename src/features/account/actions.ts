"use server";

import { revalidatePath } from "next/cache";

import { upsertCurrentUserProfile } from "@/features/account/server/profile";
import { isPrimaryGoal, isUserType, type AccountNameActionState, type PrimaryGoal, type UserProfileActionState, type UserType } from "@/features/account/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveDisplayNameAction(
  _previousState: AccountNameActionState,
  formData: FormData,
): Promise<AccountNameActionState> {
  void _previousState;
  const displayName = normalizeDisplayName(formData.get("displayName"));
  if (!displayName) {
    return { status: "error", message: "Enter a name between 2 and 80 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", message: "Please sign in again before changing your name." };
  }

  const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
  if (error) {
    return { status: "error", message: "Your name could not be saved. Please try again." };
  }

  revalidatePath("/account", "layout");
  return { status: "success", message: "Your name has been saved." };
}

export async function saveUserProfileAction(
  _previousState: UserProfileActionState,
  formData: FormData,
): Promise<UserProfileActionState> {
  void _previousState;
  const userType = readUserType(formData.get("userType"));
  const primaryGoal = readPrimaryGoal(formData.get("primaryGoal"));
  const industry = readLimitedText(formData.get("industry"), 80);
  const targetMarket = readLimitedText(formData.get("targetMarket"), 80);

  if (!userType || !primaryGoal) {
    return {
      status: "error",
      message: "Choose who you are and what you want to create.",
    };
  }

  try {
    await upsertCurrentUserProfile({ userType, primaryGoal, industry, targetMarket });
    revalidatePath("/dashboard");
    revalidatePath("/account");
    return {
      status: "success",
      message: "Your profile has been saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Your profile could not be saved.",
    };
  }
}

function readUserType(value: FormDataEntryValue | null): UserType | null {
  return isUserType(value) ? value : null;
}

function readPrimaryGoal(value: FormDataEntryValue | null): PrimaryGoal | null {
  return isPrimaryGoal(value) ? value : null;
}

function readLimitedText(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDisplayName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 80 || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}
