import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo/site";
import type { SeoContentBody, SeoPageRecord, SeoPageSummary } from "@/features/seo/types";

type PageRow = Omit<SeoPageSummary, "body"> & { body: unknown };

export async function getLiveSeoPage(path: string): Promise<SeoPageRecord | null> {
  try {
    const client = createSupabaseAdminClient();
    const { data: rawPage, error } = await client
      .from("seo_pages")
      .select("id,path,page_family,title,meta_description,direct_answer,primary_query,primary_intent,product_slug,job_slug,body,author_id,reviewer_id,template_version,cohort_id,published_at,search_lastmod_at")
      .eq("path", normalizePath(path))
      .eq("status", "live")
      .eq("noindex", false)
      .maybeSingle();

    if (error || !rawPage) return null;
    const page = normalizePage(rawPage as PageRow);
    const [assets, sources, links] = await Promise.all([
      client.from("seo_assets").select("id,role,public_url,mime_type,width,height,alt_text,caption").eq("page_id", page.id).order("sort_order", { ascending: true }),
      client.from("seo_sources").select("id,title,url,publisher,accessed_at").eq("page_id", page.id).order("accessed_at", { ascending: false }),
      client.from("seo_links").select("target_page_id,anchor_text,link_type,target:target_page_id(path)").eq("source_page_id", page.id).order("sort_order", { ascending: true }),
    ]);

    return {
      ...page,
      canonical_url: absoluteUrl(page.path),
      assets: (assets.data ?? []) as SeoPageRecord["assets"],
      sources: (sources.data ?? []) as SeoPageRecord["sources"],
      links: (links.data ?? []).flatMap((row) => {
        const target = (row as { target?: { path?: string } | Array<{ path?: string }> }).target;
        const targetPath = Array.isArray(target) ? target[0]?.path : target?.path;
        return targetPath ? [{ target_page_id: String(row.target_page_id), target_path: targetPath, anchor_text: row.anchor_text, link_type: row.link_type }] : [];
      }),
      author_name: null,
      reviewer_name: null,
    };
  } catch (error) {
    console.warn("SEO page lookup unavailable.", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

export async function listLiveSeoPages(options: { family?: string; productSlug?: string; limit?: number; offset?: number } = {}): Promise<SeoPageSummary[]> {
  try {
    const client = createSupabaseAdminClient();
    let query = client
      .from("seo_pages")
      .select("id,path,page_family,title,meta_description,direct_answer,primary_query,primary_intent,product_slug,job_slug,body,author_id,reviewer_id,template_version,cohort_id,published_at,search_lastmod_at")
      .eq("status", "live")
      .eq("noindex", false)
      .order("published_at", { ascending: false });
    if (options.family) query = query.eq("page_family", options.family);
    if (options.productSlug) query = query.eq("product_slug", options.productSlug);
    const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(5_000, options.limit as number)) : 500;
    const offset = Number.isInteger(options.offset) ? Math.max(0, options.offset as number) : 0;
    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) return [];
    return (data ?? []).map((row) => normalizePage(row as PageRow));
  } catch (error) {
    console.warn("SEO page listing unavailable.", error instanceof Error ? error.message : "Unknown error");
    return [];
  }
}

export async function listAllLiveSeoPages(): Promise<SeoPageSummary[]> {
  const pages: SeoPageSummary[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    const chunk = await listLiveSeoPages({ limit: pageSize, offset });
    pages.push(...chunk);
    if (chunk.length < pageSize) return pages;
  }
}

function normalizePage(row: PageRow): SeoPageSummary {
  return {
    ...row,
    page_family: row.page_family,
    body: isRecord(row.body) ? row.body as SeoContentBody : {},
  };
}

function normalizePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return "/";
  return `${normalized.replace(/\/+$/, "")}/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
