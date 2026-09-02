import { MonitorCog } from "lucide-react";

import { ThemeToggle } from "@/components/airveek/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Account settings</p>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Preferences</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Personalize how Airveek looks on this browser.
      </p>

      <section className="mt-8 flex items-center justify-between gap-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="appearance-heading">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MonitorCog className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="appearance-heading" className="font-display text-lg font-bold text-foreground">Appearance</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Switch between the light and dark Airveek themes.</p>
          </div>
        </div>
        <ThemeToggle />
      </section>
    </div>
  );
}
