import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCreatorUser } from "@/features/creator/server/authorization";
import type {
  FirstTouchAttribution,
  PrimaryGoal,
  UserProfile,
  UserType,
} from "@/features/account/types";

type UserProfileRow = {
  user_id: string;
  user_type: string | null;
  primary_goal: string | null;
  industry: string | null;
  target_market: string | null;
  first_touch_source: string | null;
  first_touch_medium: string | null;
  first_touch_campaign: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = await requireCreatorUser();
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapUserProfile(data as UserProfileRow);
  } catch {
    return null;
  }
}

export async function upsertCurrentUserProfile(input: {
  userType: UserType;
  primaryGoal: PrimaryGoal;
  industry: string;
  targetMarket: string;
}): Promise<UserProfile> {
  const user = await requireCreatorUser();
  const now = new Date().toISOString();
  const { data, error } = await createSupabaseAdminClient()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        user_type: input.userType,
        primary_goal: input.primaryGoal,
        industry: input.industry || null,
        target_market: input.targetMarket || null,
        completed_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Your profile could not be saved. Please try again.");
  }

  return mapUserProfile(data as UserProfileRow);
}

export async function saveInitialAttribution(userId: string, attribution: FirstTouchAttribution): Promise<void> {
  if (!isUuid(userId) || (!attribution.source && !attribution.medium && !attribution.campaign)) {
    return;
  }

  try {
    const { error } = await createSupabaseAdminClient()
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          first_touch_source: attribution.source || null,
          first_touch_medium: attribution.medium || null,
          first_touch_campaign: attribution.campaign || null,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("Unable to save initial user attribution.", error.message);
    }
  } catch (error) {
    console.error(
      "Unable to save initial user attribution.",
      error instanceof Error ? error.message : "Unknown profile error.",
    );
  }
}

function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    userId: row.user_id,
    userType: readUserType(row.user_type),
    primaryGoal: readPrimaryGoal(row.primary_goal),
    industry: row.industry,
    targetMarket: row.target_market,
    firstTouchSource: row.first_touch_source,
    firstTouchMedium: row.first_touch_medium,
    firstTouchCampaign: row.first_touch_campaign,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function readUserType(value: string | null): UserType | null {
  if (value && ["brand-owner", "designer", "agency", "marketer", "hobbyist", "other"].includes(value)) {
    return value as UserType;
  }
  return null;
}

function readPrimaryGoal(value: string | null): PrimaryGoal | null {
  if (value && ["product-photos", "social-content", "client-work", "storybook", "sketches", "other"].includes(value)) {
    return value as PrimaryGoal;
  }
  return null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
