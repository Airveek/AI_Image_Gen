"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initialAuthActionState,
  type AuthAction,
} from "@/features/auth/types";
import type { FirstTouchAttribution } from "@/features/account/types";
import { trackGa4Event } from "@/lib/analytics/browser";

type AuthFormProps = {
  mode: "login" | "register";
  action: AuthAction;
  nextPath?: string;
  initialMessage?: string;
  attribution?: FirstTouchAttribution;
};

export function AuthForm({
  mode,
  action,
  nextPath = "/dashboard",
  initialMessage = "",
  attribution,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    ...initialAuthActionState,
    message: initialMessage,
  });
  const isRegister = mode === "register";

  useEffect(() => {
    if (isRegister && state.ok) trackGa4Event("sign_up");
  }, [isRegister, state.ok]);

  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-surface/95 p-6 shadow-[0_24px_80px_rgba(var(--theme-shadow))] sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Airveek account</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-foreground">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isRegister
            ? "Start creating more with Airveek."
            : "Sign in to continue creating with Airveek."}
        </p>
      </div>

      <form action={formAction} className="mt-7 space-y-5">
        <input type="hidden" name="next" value={nextPath} />
        {isRegister && attribution ? (
          <>
            <input type="hidden" name="firstTouchSource" value={attribution.source} />
            <input type="hidden" name="firstTouchMedium" value={attribution.medium} />
            <input type="hidden" name="firstTouchCampaign" value={attribution.campaign} />
          </>
        ) : null}
        {isRegister ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="display-name">
              Name
            </label>
            <Input id="display-name" name="displayName" autoComplete="name" required />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="email">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={6}
            required
          />
          {isRegister ? <p className="text-xs text-muted-foreground">Use at least 6 characters.</p> : null}
        </div>

        {isRegister ? (
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted-foreground">
            <input className="mt-1 h-5 w-5 shrink-0 accent-primary" name="legalAcceptance" required type="checkbox" value="accepted" />
            <span>I agree to the <Link className="font-semibold text-primary underline underline-offset-4" href="/terms" target="_blank">Terms</Link> and acknowledge the <Link className="font-semibold text-primary underline underline-offset-4" href="/privacy" target="_blank">Privacy Policy</Link>.</span>
          </label>
        ) : null}

        <Button className="w-full" disabled={pending} type="submit" variant="primary">
          {pending ? "Please wait..." : isRegister ? "Create account" : "Log in"}
        </Button>

        {state.message ? (
          <p
            aria-live="polite"
            className={state.ok ? "text-sm text-success" : "text-sm text-danger"}
          >
            {state.message}
          </p>
        ) : null}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isRegister ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          className="font-semibold text-primary underline-offset-4 hover:underline"
          href={isRegister ? "/login" : "/register"}
        >
          {isRegister ? "Log in" : "Register"}
        </Link>
      </p>
    </div>
  );
}
