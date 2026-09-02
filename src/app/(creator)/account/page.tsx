import type { Metadata } from "next";
import { Mail, UserRound } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountNameForm } from "@/features/account/components/account-name-form";
import { UserProfileForm } from "@/features/account/components/user-profile-form";
import { getCurrentUserProfile } from "@/features/account/server/profile";
import { requireCreatorUser } from "@/features/creator/server/authorization";

export const metadata: Metadata = { title: "Your Account" };

export default async function AccountPage() {
  const [user, profile] = await Promise.all([
    requireCreatorUser(),
    getCurrentUserProfile(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your account</p>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Account details</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Review the identity connected to your private Airveek workspace.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Signed-in account</CardTitle>
          <CardDescription>Your email comes from your secure Airveek login.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-4">
            <UserRound className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Name</p>
              <p className="mt-1 truncate font-semibold text-foreground">{user.displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-4">
            <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Email</p>
              <p className="mt-1 truncate font-semibold text-foreground">{user.email ?? "No email available"}</p>
            </div>
          </div>
          <div className="sm:col-span-2">
            <AccountNameForm displayName={user.displayName} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <UserProfileForm profile={profile} presentation="account" />
      </div>
    </div>
  );
}
