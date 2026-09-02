"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  applyTheme,
  getStoredTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from "@/lib/theme";

function subscribeToTheme(onStoreChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getServerTheme(): Theme {
  return "light";
}

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const nextTheme: Theme = theme === "light" ? "dark" : "light";
  const label = `Switch to ${nextTheme} theme`;

  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => applyTheme(nextTheme)}
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:border-primary/45 hover:bg-surface-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={label}
        aria-pressed={theme === "dark"}
        title={label}
      >
        {theme === "light" ? <Moon className="size-[18px]" aria-hidden="true" /> : <Sun className="size-[18px]" aria-hidden="true" />}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-50 hidden whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-lg group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}
