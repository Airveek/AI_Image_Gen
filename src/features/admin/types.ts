export type AdminUserStatus = "active" | "suspended";

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  status: AdminUserStatus;
  provider: string;
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

export type AdminActionResult =
  | { ok: true }
  | { ok: false; message: string };
