"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Home, Images, LogOut, Settings, Sparkles, Store } from "lucide-react";

import { signOutAction } from "@/app/(creator)/actions";
import { AirveekLogo } from "@/components/airveek/airveek-logo";
import { cn } from "@/lib/utils";
import type { CreatorIdentity } from "@/features/creator/types";

const navigation = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/create/general-image", label: "Create", icon: Sparkles },
  { href: "/library", label: "Library", icon: Images },
  { href: "/store-images", label: "Store images", icon: Store },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function CreatorShell({
  children,
  user,
}: {
  children: ReactNode;
  user: CreatorIdentity;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-3 px-3 sm:px-5">
          <Link className="hidden shrink-0 rounded-lg sm:block" href="/dashboard" aria-label="Airveek creator home">
            <AirveekLogo className="h-auto w-28 sm:w-32" priority />
          </Link>
          <nav className="mr-auto flex items-center gap-1 sm:mx-auto" aria-label="Creator navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors sm:px-4",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-right lg:block">
              <p className="max-w-40 truncate text-sm font-semibold">{user.displayName}</p>
              <p className="max-w-40 truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/35 hover:bg-surface-muted hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
