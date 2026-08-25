import type {
  CreatorArenaId,
  CreatorErrorCode,
  ProductCampaignGoal,
} from "@/features/creator/types";
import type { PlanKey } from "@/lib/whop/types";

export type UserEventName =
  | "account_created"
  | "login_succeeded"
  | "checkout_started"
  | "membership_activated"
  | "membership_deactivated"
  | "generation_requested"
  | "generation_succeeded"
  | "generation_failed";

export type UserEventProperties = {
  arenaId?: CreatorArenaId;
  planKey?: PlanKey;
  referenceCount?: 0 | 1 | 2;
  campaignGoal?: ProductCampaignGoal;
  errorCode?: CreatorErrorCode;
};

export type RecordUserEventInput = {
  userId: string;
  eventName: UserEventName;
  properties?: UserEventProperties;
  externalEventId?: string;
  occurredAt?: string;
};

export function sanitizeUserEventProperties(properties: UserEventProperties | undefined): UserEventProperties {
  if (!properties) {
    return {};
  }

  const normalized: UserEventProperties = {};
  if (properties.arenaId) normalized.arenaId = properties.arenaId;
  if (properties.planKey) normalized.planKey = properties.planKey;
  if (properties.referenceCount !== undefined) normalized.referenceCount = properties.referenceCount;
  if (properties.campaignGoal) normalized.campaignGoal = properties.campaignGoal;
  if (properties.errorCode) normalized.errorCode = properties.errorCode;
  return normalized;
}
