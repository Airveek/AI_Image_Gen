import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GenerationAccessSummary } from "@/features/creator/types";

type ReservationState = "paid" | "reserved" | "in_progress" | "consumed" | "released" | "exhausted";

export type CreditReservation = GenerationAccessSummary & { state: ReservationState };

export async function reserveGenerationCredit(userId: string, attemptId: string): Promise<CreditReservation> {
  const { data, error } = await createSupabaseAdminClient().rpc("reserve_creator_generation_credit", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (error) throw new Error(`Could not reserve a generation credit: ${error.message}`);
  return readReservation(data);
}

export async function consumeGenerationCredit(userId: string, attemptId: string, assetId: string): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().rpc("consume_creator_generation_credit", {
    p_user_id: userId,
    p_attempt_id: attemptId,
    p_asset_id: assetId,
  });
  if (error || data !== true) throw new Error(error?.message ?? "Generation credit could not be consumed.");
}

export async function releaseGenerationCredit(userId: string, attemptId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient().rpc("release_creator_generation_credit", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (error) console.warn("[creator-credits] release skipped", { code: error.code });
}

export async function getGenerationAccessForUser(userId: string): Promise<GenerationAccessSummary> {
  const client = createSupabaseAdminClient();
  await client.rpc("release_stale_generation_credit_reservations", { p_user_id: userId });
  const [account, reservations, entitlements] = await Promise.all([
    client.from("creator_credit_accounts").select("granted,used").eq("user_id", userId).maybeSingle(),
    client.from("creator_generation_credit_reservations").select("attempt_id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "reserved").eq("uses_free_credit", true),
    client.from("billing_entitlements").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("has_access", true),
  ]);
  if (account.error) throw new Error(`Could not load generation credits: ${account.error.message}`);
  const granted = Number(account.data?.granted ?? 2);
  const used = Number(account.data?.used ?? 0);
  const reserved = Number(reservations.count ?? 0);
  return {
    hasPaidAccess: Number(entitlements.count ?? 0) > 0,
    granted,
    used,
    reserved,
    remaining: Math.max(0, granted - used - reserved),
  };
}

function readReservation(value: unknown): CreditReservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Generation credit response was invalid.");
  const record = value as Record<string, unknown>;
  const state = record.state;
  if (!["paid", "reserved", "in_progress", "consumed", "released", "exhausted"].includes(String(state))) {
    throw new Error("Generation credit state was invalid.");
  }
  return {
    state: state as ReservationState,
    hasPaidAccess: record.paid === true,
    granted: finiteCount(record.granted),
    used: finiteCount(record.used),
    reserved: finiteCount(record.reserved),
    remaining: finiteCount(record.remaining),
  };
}

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
