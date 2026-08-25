"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveUserProfileAction } from "@/features/account/actions";
import {
  PRIMARY_GOAL_OPTIONS,
  USER_TYPE_OPTIONS,
  type UserProfile,
} from "@/features/account/types";

export function UserProfileForm({ profile }: { profile: UserProfile | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction, pending] = useActionState(saveUserProfileAction, {
    status: "idle",
    message: "",
  } satisfies Parameters<typeof saveUserProfileAction>[0]);

  if (dismissed) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-white/10 bg-white/[0.035] p-5" aria-labelledby="profile-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">Optional profile</p>
        <h2 id="profile-heading" className="mt-2 font-display text-2xl font-bold">Help us make Airveek more useful</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Tell us what you do. You can skip this and change it later.</p>
      </div>
      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold" htmlFor="profile-user-type">
          <span>What best describes you?</span>
          <select id="profile-user-type" name="userType" defaultValue={profile?.userType ?? ""} required className="min-h-12 w-full rounded-xl border border-white/10 bg-brand-black px-3 text-sm text-brand-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon">
            <option value="" disabled>Choose one</option>
            {USER_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="profile-primary-goal">
          <span>What do you want to create?</span>
          <select id="profile-primary-goal" name="primaryGoal" defaultValue={profile?.primaryGoal ?? ""} required className="min-h-12 w-full rounded-xl border border-white/10 bg-brand-black px-3 text-sm text-brand-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon">
            <option value="" disabled>Choose one</option>
            {PRIMARY_GOAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="profile-industry">
          <span>Industry <span className="font-normal text-muted">(optional)</span></span>
          <Input id="profile-industry" name="industry" defaultValue={profile?.industry ?? ""} maxLength={80} placeholder="Fashion, beauty, food…" />
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="profile-market">
          <span>Main market <span className="font-normal text-muted">(optional)</span></span>
          <Input id="profile-market" name="targetMarket" defaultValue={profile?.targetMarket ?? ""} maxLength={80} placeholder="India, Canada, worldwide…" />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button disabled={pending} type="submit" variant="primary">{pending ? "Saving…" : "Save profile"}</Button>
          <button type="button" onClick={() => setDismissed(true)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.05] hover:text-brand-white">Skip for now</button>
          <p aria-live="polite" className={state.status === "error" ? "text-sm text-red-200" : "text-sm text-brand-soft"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
        </div>
      </form>
    </section>
  );
}
