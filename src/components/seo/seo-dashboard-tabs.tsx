"use client";

import { useId, useState, type ReactNode } from "react";

type SeoDashboardTab = {
  id: string;
  label: string;
  panel: ReactNode;
};

export function SeoDashboardTabs({ tabs }: { tabs: SeoDashboardTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const tabListId = useId();

  return (
    <div className="space-y-6">
      <div className="sticky top-2 z-10 rounded-2xl border border-border bg-brand-panel/95 p-2 backdrop-blur">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="SEO dashboard sections" id={tabListId}>
          {tabs.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                aria-controls={`${tab.id}-panel`}
                aria-selected={selected}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${selected ? "bg-brand-neon text-brand-black" : "text-muted hover:bg-white/10 hover:text-brand-white"}`}
                id={`${tab.id}-tab`}
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          aria-labelledby={`${tab.id}-tab`}
          hidden={tab.id !== activeId}
          id={`${tab.id}-panel`}
          key={tab.id}
          role="tabpanel"
          tabIndex={0}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
