"use server";

import { revalidatePath } from "next/cache";

import { upsertCurrentUserProfile } from "@/features/account/server/profile";
import { isPrimaryGoal, isUserType, type PrimaryGoal, type UserProfileActionState, type UserType } from "@/features/account/types";

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
