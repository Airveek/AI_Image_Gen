"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  creatorCatalog,
  creatorCategories,
  getCategoryLabel,
} from "@/features/creator/catalog";
import type { CreatorAsset, CreatorCategoryId } from "@/features/creator/types";
import { cn } from "@/lib/utils";

export function CreatorDashboard({
  recent,
  storageMessage,
}: {
  recent: CreatorAsset[];
  storageMessage: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const category = readCategory(searchParams.get("category"));
  const normalizedSearch = search.trim().toLowerCase();
  const items = creatorCatalog.filter((item) => {
    const matchesCategory = category === "all" || item.categoryId === category;
    const haystack = `${item.title} ${item.description} ${getCategoryLabel(item.categoryId)}`.toLowerCase();
    return matchesCategory && (!normalizedSearch || haystack.includes(normalizedSearch));
  });

  function updateParams(next: { search?: string; category?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.replace(params.size ? `/dashboard?${params.toString()}` : "/dashboard", { scroll: false });
  }

  function resetFilters() {
    router.replace("/dashboard", { scroll: false });
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">Airveek Creator</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          What do you want to create?
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          Choose an outcome. Airveek asks the useful questions and builds the technical prompt for you.
        </p>
      </section>

      <section className="mt-9" aria-label="Find a creation tool">
        <label className="sr-only" htmlFor="creator-search">Search creation tools</label>
        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="creator-search"
            type="search"
            value={search}
            onChange={(event) => updateParams({ search: event.target.value })}
            placeholder="Search product photos, storybooks, thumbnails…"
            className="min-h-14 w-full rounded-2xl border border-white/12 bg-white/[0.05] pl-12 pr-12 text-base text-white placeholder:text-brand-gray focus:border-brand-neon/60 focus:outline-none focus-visible:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => updateParams({ search: "" })}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Creation categories">
          <FilterButton active={category === "all"} onClick={() => updateParams({ category: "all" })}>
            All tools
          </FilterButton>
          {creatorCategories.map((item) => (
            <FilterButton
              key={item.id}
              active={category === item.id}
              onClick={() => updateParams({ category: item.id })}
            >
              {item.label}
            </FilterButton>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="tools-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="tools-heading" className="font-display text-2xl font-bold">Creation tools</h2>
            <p className="mt-1 text-sm text-muted">{items.length} of {creatorCatalog.length} tools</p>
          </div>
          <p className="hidden text-sm text-muted sm:block">3 available now</p>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <div className="relative aspect-[16/9] overflow-hidden bg-brand-panel-raised">
                    <Image
                      src={item.artwork.src}
                      alt={item.artwork.alt}
                      fill
                      className={cn("object-cover transition-transform duration-300 group-hover:scale-[1.02]", item.artwork.fit === "contain" && "object-contain")}
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" aria-hidden="true" />
                    <Badge className="absolute left-3 top-3" variant={item.availability === "available" ? "success" : "default"}>
                      {item.availability === "available" ? "Available" : "Coming next"}
                    </Badge>
                  </div>
                  <div className="flex min-h-36 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-neon/10 text-brand-neon">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{getCategoryLabel(item.categoryId)}</p>
                        <h3 className="mt-1 font-display text-xl font-bold">{item.title}</h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
                    {item.availability === "available" ? (
                      <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-bold text-brand-neon">
                        Start creating <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                </>
              );

              return item.arenaId ? (
                <Link
                  key={item.id}
                  href={`/create/${item.arenaId}`}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-colors hover:border-brand-neon/40 hover:bg-white/[0.055]"
                >
                  {content}
                </Link>
              ) : (
                <article key={item.id} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] opacity-80">
                  {content}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-16 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-brand-neon" aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl font-bold">No matching tool yet</h3>
            <p className="mt-2 text-sm text-muted">Try another word or show all creation tools.</p>
            <button type="button" onClick={resetFilters} className="mt-5 min-h-11 rounded-xl bg-brand-neon px-5 text-sm font-bold text-black hover:bg-brand-soft">
              Reset filters
            </button>
          </div>
        )}
      </section>

      <section className="mt-14 border-t border-white/10 pt-10" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="recent-heading" className="font-display text-2xl font-bold">Recent creations</h2>
            <p className="mt-1 text-sm text-muted">Your private Airveek images.</p>
          </div>
          <Link className="text-sm font-bold text-brand-neon hover:text-brand-soft" href="/library">Open library</Link>
        </div>
        {storageMessage ? (
          <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">{storageMessage}</p>
        ) : recent.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((asset) => (
              <Link key={asset.id} href="/library" className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-brand-panel">
                {asset.imageUrl ? <Image src={asset.imageUrl} alt={asset.name} fill unoptimized className="object-cover transition-transform group-hover:scale-[1.03]" sizes="20vw" /> : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 text-xs font-semibold">{asset.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-sm text-muted">
            Your first successful generation will appear here automatically.
          </div>
        )}
      </section>
    </div>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors",
        active
          ? "border-brand-neon/50 bg-brand-neon/12 text-brand-soft"
          : "border-white/10 bg-white/[0.035] text-muted hover:border-white/20 hover:text-white",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function readCategory(value: string | null): "all" | CreatorCategoryId {
  return creatorCategories.some((category) => category.id === value)
    ? (value as CreatorCategoryId)
    : "all";
}
