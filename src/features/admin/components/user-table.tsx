"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, PauseCircle, PlayCircle, Trash2 } from "lucide-react";

import { deleteUserAction, restoreUserAction, suspendUserAction } from "@/app/(admin)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUser, AdminUserStatus } from "@/features/admin/types";

export function UserTable({ users }: { users: AdminUser[] }) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function runAction(user: AdminUser, action: (userId: string) => Promise<{ ok: boolean; message?: string }>, successMessage: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action(user.id);

      if (!result.ok) {
        setFeedback(result.message ?? "The action could not be completed.");
        return;
      }

      setFeedback(successMessage);
      setDeleteUser(null);
      router.refresh();
    });
  }

  return (
    <>
      {feedback ? <p aria-live="polite" className="mb-4 rounded-xl border border-brand-neon/20 bg-brand-neon/10 px-4 py-3 text-sm text-brand-soft" role="status">{feedback}</p> : null}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>User</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Provider</TableHeader>
              <TableHeader>Today</TableHeader>
              <TableHeader>Requests</TableHeader>
              <TableHeader>Joined</TableHeader>
              <TableHeader>Last sign in</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell className="py-12 text-center text-muted" colSpan={8}>No users match these filters.</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  onDelete={() => setDeleteUser(user)}
                  onDetails={() => setSelectedUser(user)}
                  onStatusChange={() => {
                    const action = user.status === "suspended" ? restoreUserAction : suspendUserAction;
                    const message = user.status === "suspended" ? "User restored." : "User suspended.";
                    runAction(user, action, message);
                  }}
                  pending={pending}
                  user={user}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog
        description="Account information from Supabase Auth."
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
        open={selectedUser !== null}
        title={selectedUser?.displayName ?? "User details"}
      >
        {selectedUser ? <UserDetails user={selectedUser} /> : null}
      </Dialog>
      <Dialog
        description="This permanently removes the user from Supabase Auth."
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null);
        }}
        open={deleteUser !== null}
        title="Delete this user?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-muted">{deleteUser?.email ?? "This account"} will no longer be able to sign in.</p>
          <div className="flex justify-end gap-3">
            <Button disabled={pending} onClick={() => setDeleteUser(null)} type="button" variant="ghost">Cancel</Button>
            <Button disabled={pending || deleteUser === null} onClick={() => { if (deleteUser) runAction(deleteUser, deleteUserAction, "User deleted."); }} type="button" variant="danger">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function UserRow({ user, pending, onDetails, onStatusChange, onDelete }: { user: AdminUser; pending: boolean; onDetails: () => void; onStatusChange: () => void; onDelete: () => void }) {
  const statusVariant = getStatusVariant(user.status);

  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold">{user.displayName}</div>
        <div className="mt-1 text-xs text-muted">{user.email ?? "No email address"}</div>
      </TableCell>
      <TableCell><Badge variant={statusVariant}>{capitalize(user.status)}</Badge></TableCell>
      <TableCell className="text-muted">{user.provider}</TableCell>
      <TableCell><span className="font-semibold">{user.generationsToday}</span><span className="ml-1 text-xs text-muted">today</span></TableCell>
      <TableCell><span className="font-semibold">{user.generationRequests}</span>{user.failedGenerations ? <span className="ml-1 text-xs text-red-200">· {user.failedGenerations} failed</span> : null}</TableCell>
      <TableCell className="text-muted">{formatDate(user.createdAt)}</TableCell>
      <TableCell className="text-muted">{user.lastSignInAt ? formatDate(user.lastSignInAt) : "Never"}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button aria-label={`View ${user.displayName}`} onClick={onDetails} size="icon" title="View details" type="button" variant="ghost"><Eye aria-hidden="true" className="h-4 w-4" /></Button>
          <Button aria-label={`${user.status === "suspended" ? "Restore" : "Suspend"} ${user.displayName}`} disabled={pending} onClick={onStatusChange} size="icon" title={user.status === "suspended" ? "Restore user" : "Suspend user"} type="button" variant="ghost">
            {user.status === "suspended" ? <PlayCircle aria-hidden="true" className="h-4 w-4" /> : <PauseCircle aria-hidden="true" className="h-4 w-4" />}
          </Button>
          <Button aria-label={`Delete ${user.displayName}`} disabled={pending} onClick={onDelete} size="icon" title="Delete user" type="button" variant="ghost"><Trash2 aria-hidden="true" className="h-4 w-4 text-red-300" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function UserDetails({ user }: { user: AdminUser }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <Detail label="Email" value={user.email ?? "Not provided"} />
      <Detail label="Status" value={capitalize(user.status)} />
      <Detail label="Provider" value={user.provider} />
      <Detail label="Email verified" value={user.emailConfirmedAt ? formatDate(user.emailConfirmedAt) : "Not verified"} />
      <Detail label="Joined" value={formatDate(user.createdAt)} />
      <Detail label="Last sign in" value={user.lastSignInAt ? formatDate(user.lastSignInAt) : "Never"} />
      <Detail label="Generations today" value={String(user.generationsToday)} />
      <Detail label="All generation requests" value={String(user.generationRequests)} />
      <Detail label="Failed generations" value={String(user.failedGenerations)} />
      <Detail label="Last generation" value={user.lastGenerationAt ? formatDateTime(user.lastGenerationAt) : "Never"} />
      <Detail className="sm:col-span-2" label="User ID" value={user.id} />
    </dl>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><dt className="text-xs uppercase tracking-[0.12em] text-brand-gray">{label}</dt><dd className="mt-1 break-all text-brand-white">{value}</dd></div>;
}

function getStatusVariant(status: AdminUserStatus): "success" | "danger" {
  return status === "suspended" ? "danger" : "success";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}
