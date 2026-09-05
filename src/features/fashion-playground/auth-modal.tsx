"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { modalRegisterAction, modalSignInAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/types";
import { trackServerMirroredPixelEvent } from "@/lib/analytics/meta-browser";

export function FashionAuthModal({ open, onOpenChange, onAuthenticated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [registerState, registerAction, registerPending] = useActionState(modalRegisterAction, initialAuthActionState);
  const [loginState, loginAction, loginPending] = useActionState(modalSignInAction, initialAuthActionState);
  const [registrationEventId] = useState(() => crypto.randomUUID());
  const completed = useRef(false);

  useEffect(() => {
    if (!registerState.ok || !registerState.trackingEventId) return;
    trackServerMirroredPixelEvent("CompleteRegistration", registerState.trackingEventId, { content_name: "AI Fashion Photoshoot registration", content_category: "account" });
    sessionStorage.removeItem("airveek:pending-registration-event");
  }, [registerState]);

  useEffect(() => {
    if (completed.current || (!registerState.authenticated && !loginState.authenticated)) return;
    completed.current = true;
    onAuthenticated();
  }, [registerState.authenticated, loginState.authenticated, onAuthenticated]);

  const state = mode === "register" ? registerState : loginState;
  const pending = mode === "register" ? registerPending : loginPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={mode === "register" ? "Create your free account" : "Welcome back"} description="Your selected images stay on this device until you sign in. We’ll resume the photoshoot automatically.">
      <div className="grid grid-cols-2 rounded-xl bg-surface-muted p-1" role="tablist" aria-label="Account action">
        <button className={`min-h-11 rounded-lg px-3 text-sm font-bold ${mode === "register" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"}`} type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Create account</button>
        <button className={`min-h-11 rounded-lg px-3 text-sm font-bold ${mode === "login" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"}`} type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Log in</button>
      </div>
      <form action={mode === "register" ? registerAction : loginAction} className="mt-5 space-y-4" onSubmit={() => {
        if (mode === "register") sessionStorage.setItem("airveek:pending-registration-event", registrationEventId);
      }}>
        <input type="hidden" name="next" value="/playground/fashion-photoshoot?resume=1" />
        <input type="hidden" name="trackingEventId" value={registrationEventId} />
        <input type="hidden" name="sourceUrl" value="/playground/fashion-photoshoot" />
        {mode === "register" ? <Field label="Name" id="fashion-auth-name"><Input id="fashion-auth-name" name="displayName" autoComplete="name" required /></Field> : null}
        <Field label="Email" id="fashion-auth-email"><Input id="fashion-auth-email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" id="fashion-auth-password">
          <Input id="fashion-auth-password" name="password" type="password" minLength={6} autoComplete={mode === "register" ? "new-password" : "current-password"} required />
          {mode === "register" ? <span className="mt-1 block text-xs text-muted-foreground">Use at least 6 characters. Password managers and paste are supported.</span> : null}
        </Field>
        {mode === "register" ? <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground"><input className="mt-0.5 h-5 w-5 shrink-0 accent-primary" name="legalAcceptance" required type="checkbox" value="accepted" /><span>I agree to the <Link className="font-semibold text-primary underline" href="/terms" target="_blank">Terms</Link> and acknowledge the <Link className="font-semibold text-primary underline" href="/privacy" target="_blank">Privacy Policy</Link>.</span></label> : null}
        <Button className="w-full" disabled={pending} type="submit" variant="primary">{pending ? "Please wait…" : mode === "register" ? "Create account & generate" : "Log in & generate"}</Button>
        {state.message ? <p className={`text-sm leading-6 ${state.ok ? "text-success" : "text-danger"}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      </form>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label className="mb-2 block text-sm font-semibold" htmlFor={id}>{label}</label>{children}</div>;
}
