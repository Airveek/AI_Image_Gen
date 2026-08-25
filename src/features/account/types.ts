export type UserType = "brand-owner" | "designer" | "agency" | "marketer" | "hobbyist" | "other";

export type PrimaryGoal = "product-photos" | "social-content" | "client-work" | "storybook" | "sketches" | "other";

export type UserProfile = {
  userId: string;
  userType: UserType | null;
  primaryGoal: PrimaryGoal | null;
  industry: string | null;
  targetMarket: string | null;
  firstTouchSource: string | null;
  firstTouchMedium: string | null;
  firstTouchCampaign: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type UserProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type FirstTouchAttribution = {
  source: string;
  medium: string;
  campaign: string;
};

export const USER_TYPE_OPTIONS: Array<{ value: UserType; label: string }> = [
  { value: "brand-owner", label: "Brand owner" },
  { value: "designer", label: "Designer" },
  { value: "agency", label: "Agency or freelancer" },
  { value: "marketer", label: "Marketer" },
  { value: "hobbyist", label: "Personal projects" },
  { value: "other", label: "Other" },
];

export const PRIMARY_GOAL_OPTIONS: Array<{ value: PrimaryGoal; label: string }> = [
  { value: "product-photos", label: "Product photos" },
  { value: "social-content", label: "Social content and ads" },
  { value: "client-work", label: "Client work" },
  { value: "storybook", label: "Storybooks" },
  { value: "sketches", label: "Fashion sketches" },
  { value: "other", label: "Something else" },
];

export function isUserType(value: unknown): value is UserType {
  return typeof value === "string" && USER_TYPE_OPTIONS.some((option) => option.value === value);
}

export function isPrimaryGoal(value: unknown): value is PrimaryGoal {
  return typeof value === "string" && PRIMARY_GOAL_OPTIONS.some((option) => option.value === value);
}
