"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function Sidebar({ children, className }: { children: ReactNode; className?: string }) {
  const context = useSidebar();

  return (
    <>
      {context.open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => context.setOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-background transition-transform duration-200 lg:translate-x-0",
          context.open ? "translate-x-0" : "-translate-x-full",
          className,
        )}
      >
        <div className="flex items-center justify-end p-3 lg:hidden">
          <button
            aria-label="Close navigation"
            className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => context.setOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function SidebarInset({ children }: { children: ReactNode }) {
  return <div className="min-h-screen lg:pl-72">{children}</div>;
}

export function SidebarTrigger() {
  const context = useSidebar();

  return (
    <button
      aria-label={context.open ? "Close navigation" : "Open navigation"}
      className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus lg:hidden"
      onClick={() => context.setOpen(!context.open)}
      type="button"
    >
      <Menu aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider.");
  }

  return context;
}
