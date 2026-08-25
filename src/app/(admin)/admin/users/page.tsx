import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserTable } from "@/features/admin/components/user-table";
import { listAdminUsers } from "@/features/admin/server/users";
import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import type { AdminUserList, AdminUserStatus } from "@/features/admin/types";

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const search = readParam(params.search);
  const status = readStatus(readParam(params.status));
  const page = readPage(readParam(params.page));
  let result: AdminUserList;
  try {
    result = await listAdminUsers({ search, status, page, pageSize: 10 });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/");
    throw error;
  }
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">User management</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-white sm:text-4xl">All users</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Search, review, and manage registered Airveek accounts.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Registered users</CardTitle><CardDescription>{result.total} matching {result.total === 1 ? "user" : "users"}</CardDescription></CardHeader>
        <CardContent>
          <form className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-brand-black/40 p-3 md:grid-cols-[1fr_180px_auto]" method="get">
            <label className="sr-only" htmlFor="user-search">Search users</label>
            <Input defaultValue={search} id="user-search" name="search" placeholder="Search by name or email" type="search" />
            <label className="sr-only" htmlFor="user-status">Filter by status</label>
            <select className="min-h-11 rounded-xl border border-white/10 bg-brand-black px-3 text-sm text-brand-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon" defaultValue={status} id="user-status" name="status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <Button type="submit" variant="primary">Apply filters</Button>
          </form>
          <UserTable users={result.users} />
          <div className="mt-5 flex flex-col justify-between gap-3 border-t border-white/10 pt-4 text-sm text-muted sm:flex-row sm:items-center">
            <p>Page {result.page} of {totalPages}</p>
            <div className="flex gap-2">
              {result.page > 1 ? <Link href={buildPageUrl(search, status, result.page - 1)}><Button type="button" variant="ghost">Previous</Button></Link> : <Button disabled type="button" variant="ghost">Previous</Button>}
              {result.page < totalPages ? <Link href={buildPageUrl(search, status, result.page + 1)}><Button type="button" variant="ghost">Next</Button></Link> : <Button disabled type="button" variant="ghost">Next</Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readStatus(value: string): "all" | AdminUserStatus {
  return value === "active" || value === "suspended" ? value : "all";
}

function readPage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildPageUrl(search: string, status: "all" | AdminUserStatus, page: number): string {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (status !== "all") query.set("status", status);
  query.set("page", String(page));
  return `/admin/users?${query.toString()}`;
}
