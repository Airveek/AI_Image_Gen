"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDisplayNameAction } from "@/features/account/actions";

export function AccountNameForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState(saveDisplayNameAction, {
    status: "idle",
    message: "",
  } satisfies Parameters<typeof saveDisplayNameAction>[0]);

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1 space-y-2 text-sm font-semibold text-foreground" htmlFor="account-display-name">
        <span>Display name</span>
        <Input id="account-display-name" name="displayName" autoComplete="name" defaultValue={displayName} minLength={2} maxLength={80} required />
      </label>
      <Button disabled={pending} type="submit" variant="primary">{pending ? "Saving…" : "Save name"}</Button>
      <p aria-live="polite" className={state.status === "error" ? "text-sm text-danger sm:pb-3" : "text-sm text-success sm:pb-3"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
    </form>
  );
}
