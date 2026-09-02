"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BadgeDollarSign,
  ChevronDown,
  CircleHelp,
  History,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";

import { signOutAction } from "@/app/(creator)/actions";
import { ThemeToggle } from "@/components/airveek/theme-toggle";
import type { CreatorIdentity } from "@/features/creator/types";

const menuItems = [
  { href: "/account", label: "Your account", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Help and resources", icon: CircleHelp },
  { href: "/plans", label: "Plans and pricing", icon: BadgeDollarSign },
  { href: "/purchase-history", label: "Purchase history", icon: History },
] as const;

export function AccountMenu({ user }: { user: CreatorIdentity }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const focusFirstItemRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    if (focusFirstItemRef.current) {
      focusFirstItemRef.current = false;
      firstItemRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-1.5 text-left transition hover:border-primary/40 hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:pl-2 sm:pr-3"
        aria-expanded={open}
        aria-controls="creator-account-menu"
        aria-haspopup="dialog"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") focusFirstItemRef.current = true;
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-black text-primary" aria-hidden="true">
          {getInitials(user.displayName)}
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-foreground">{user.displayName}</span>
          <span className="block max-w-40 truncate text-xs text-muted-foreground">{user.email ?? "Airveek account"}</span>
        </span>
        <ChevronDown className={`hidden size-4 shrink-0 text-muted-foreground transition-transform lg:block ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        <span className="sr-only">{open ? "Close account menu" : "Open account menu"}</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="creator-account-menu"
          role="dialog"
          aria-modal="false"
          aria-labelledby="creator-account-menu-title"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[calc(100svh-5rem)] w-[min(21rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-foreground shadow-2xl"
        >
          <div className="border-b border-border px-3 py-3">
            <p id="creator-account-menu-title" className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Account</p>
            <p className="mt-2 truncate font-display text-lg font-bold">{user.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email ?? "Signed-in creator"}</p>
          </div>

          <nav className="space-y-1 py-2" aria-label="Account options">
            {menuItems.slice(0, 2).map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  ref={index === 0 ? firstItemRef : undefined}
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <ThemeToggle presentation="menu" onChange={closeMenu} />
            {menuItems.slice(2).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action={signOutAction} className="border-t border-border pt-2">
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-foreground transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <LogOut className="size-5" aria-hidden="true" />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "A";
}
