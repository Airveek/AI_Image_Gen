export type AdminUserStatus = "active" | "suspended";

export type AdminSeoRole = "writer" | "brief_lead" | "editor" | "publisher" | "seo_admin";

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  status: AdminUserStatus;
  provider: string;
  seoRole: AdminSeoRole | null;
  seoMemberActive: boolean;
  seoMemberSlug: string | null;
  generationsToday: number;
  generationRequests: number;
  failedGenerations: number;
  lastGenerationAt: string | null;
  paidPlan: string | null;
  paidStatus: string | null;
  userType: string | null;
  primaryGoal: string | null;
  acquisitionSource: string | null;
};

export type AdminUserFilters = {
  search: string;
  status: "all" | AdminUserStatus;
  page: number;
  pageSize: number;
};

export type AdminUserList = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminDashboardData = {
  totalUsers: number;
  verifiedUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  recentUsers: AdminUser[];
};

export type AdminInsightArena = {
  arenaId: string;
  label: string;
  uniqueUsers: number;
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
  repeatUserRate: number;
  paidUsers: number;
};

export type AdminInsightCohort = {
  week: string;
  registered: number;
  generated: number;
  paid: number;
  retained: number;
};

export type AdminInsightUser = {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  verified: boolean;
  paidPlan: string | null;
  paidStatus: string | null;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  generationCount: number;
  mostUsedArena: string | null;
  acquisitionSource: string | null;
  userType: string | null;
  primaryGoal: string | null;
};

export type AdminInsightsData = {
  generatedAt: string;
  summary: {
    registered: number;
    verified: number;
    activated: number;
    checkoutStarters: number;
    paid: number;
    paidConversionRate: number;
    active7Days: number;
    active30Days: number;
  };
  arenas: AdminInsightArena[];
  cohorts: AdminInsightCohort[];
  users: AdminInsightUser[];
};

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };
