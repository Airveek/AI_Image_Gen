"use client";

import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
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
  presentation?: "icon" | "menu";
  onChange?: (theme: Theme) => void;
};

export function ThemeToggle({ className = "", presentation = "icon", onChange }: ThemeToggleProps) {
  const [choicesOpen, setChoicesOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const nextTheme: Theme = theme === "light" ? "dark" : "light";
  const label = `Switch to ${nextTheme} theme`;

  function changeTheme(selectedTheme: Theme) {
    applyTheme(selectedTheme);
    onChange?.(selectedTheme);
  }

  if (presentation === "menu") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setChoicesOpen((current) => !current)}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-foreground transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-expanded={choicesOpen}
          aria-controls="account-theme-choices"
        >
          {theme === "light" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          <span className="flex-1">Theme</span>
          <span className="text-xs font-medium text-muted-foreground">{theme === "light" ? "Light" : "Dark"}</span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${choicesOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {choicesOpen ? (
          <div id="account-theme-choices" role="radiogroup" aria-label="Theme" className="ml-8 grid grid-cols-2 gap-2 px-2 pb-2 pt-1">
            {(["light", "dark"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={theme === choice}
                onClick={() => changeTheme(choice)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold capitalize text-foreground transition hover:border-primary/50 hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {choice}
                {theme === choice ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => changeTheme(nextTheme)}
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
