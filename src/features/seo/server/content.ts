import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo/site";
import { SITEMAP_SHARD_SIZE } from "@/lib/seo/sitemap";
import type { SeoContentBody, SeoPageFamily, SeoPageLink, SeoPageRecord, SeoPageSummary } from "@/features/seo/types";

type PageRow = Omit<SeoPageSummary, "body"> & { body?: unknown };

export async function getLiveSeoPage(path: string): Promise<SeoPageRecord | null> {
  try {
    const client = createSupabaseAdminClient();
    const { data: rawPage, error } = await client
      .from("seo_pages")
      .select("id,path,page_family,title,meta_description,direct_answer,primary_query,primary_intent,product_slug,job_slug,body,author_id,reviewer_id,template_version,cohort_id,published_at,search_lastmod_at")
      .eq("path", normalizePath(path))
      .eq("status", "live")
      .eq("noindex", false)
      .is("canonical_page_id", null)
      .maybeSingle();

    if (error) throw new Error(`SEO page lookup unavailable: ${error.message}`);
    if (!rawPage) return null;
    const page = normalizePage(rawPage as PageRow);
    const [assets, sources, pageLinks, edgeLinks, members] = await Promise.all([
      client.from("seo_assets").select("id,role,public_url,checksum,mime_type,width,height,alt_text,caption,provenance,ai_provenance,generation_metadata,rights_status,logo_policy").eq("page_id", page.id).order("sort_order", { ascending: true }),
      client.from("seo_sources").select("id,title,url,publisher,accessed_at").eq("page_id", page.id).order("accessed_at", { ascending: false }),
      client.from("seo_links").select("target_page_id,anchor_text,link_type,target:target_page_id(path)").eq("source_page_id", page.id).order("sort_order", { ascending: true }).limit(32),
      // The draft graph stores static-hub and not-yet-resolvable targets in
      // seo_link_edges, while seo_links only contains targets that already
      // had a seo_pages row at ingest time. Read both so the public template
      // renders the same crawlable graph that the publish gate audited.
      client.from("seo_link_edges").select("target_page_id,target_url,anchor_text,placement,nofollow").in("source_url", [absoluteUrl(page.path), `${absoluteUrl(page.path)}/`]).eq("nofollow", false).order("first_seen_at", { ascending: true }).limit(32),
      page.author_id || page.reviewer_id
        ? client.from("content_members").select("user_id,display_name").in("user_id", [page.author_id, page.reviewer_id].filter((value): value is string => Boolean(value)))
        : Promise.resolve({ data: [], error: null }),
    ]);
    const relatedError = assets.error ?? sources.error ?? pageLinks.error ?? edgeLinks.error ?? members.error;
    if (relatedError) {
      // A partial page is not a healthy public page. Propagate the failure so
      // the route withholds the document instead of serving an incomplete
      // render or a cacheable 404 that could misrepresent an existing page.
      throw new Error(`SEO page supporting records unavailable: ${relatedError.message}`);
    }
    const memberNames = new Map((members.data ?? []).map((member) => [String(member.user_id), String(member.display_name)]));
    const links = await resolvePublicLinks(client, page.path, pageLinks.data ?? [], edgeLinks.data ?? []);
    const publicAssets = sanitizePublicAssets((assets.data ?? []) as SeoPageRecord["assets"]);

    return {
      ...page,
      canonical_url: absoluteUrl(page.path),
      // Rights, provenance, checksums, generation metadata, and reviewer
      // identity remain available to the admin/worker APIs, but are never
      // serialized into the public SEO page response.
      body: sanitizePublicBody(page.body),
      assets: publicAssets,
      sources: (sources.data ?? []) as SeoPageRecord["sources"],
      links,
      author_name: page.author_id ? memberNames.get(page.author_id) ?? null : null,
      reviewer_name: null,
    };
  } catch (error) {
    console.warn("SEO page lookup unavailable.", error instanceof Error ? error.message : "Unknown error");
    throw error instanceof Error ? error : new Error("SEO page lookup unavailable.");
  }
}

export async function listLiveSeoPages(options: { family?: string; productSlug?: string; limit?: number; offset?: number; strict?: boolean } = {}): Promise<SeoPageSummary[]> {
  try {
    const client = createSupabaseAdminClient();
    let query = client
      .from("seo_pages")
      // Listing and sitemap callers only need summary metadata. Keeping the
      // structured body out of this query prevents a 100k-page sitemap or hub
      // request from loading every content block into application memory.
      .select("id,path,page_family,title,meta_description,direct_answer,primary_query,primary_intent,product_slug,job_slug,author_id,reviewer_id,template_version,cohort_id,published_at,search_lastmod_at,seo_url_state!inner(eligible_for_indexing,last_http_status)")
      .eq("status", "live")
      .eq("noindex", false)
      .is("canonical_page_id", null)
      .eq("seo_url_state.eligible_for_indexing", true)
      .eq("seo_url_state.last_http_status", 200)
      .order("published_at", { ascending: false });
    if (options.family) query = query.eq("page_family", options.family);
    if (options.productSlug) query = query.eq("product_slug", options.productSlug);
    const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(5_000, options.limit as number)) : 500;
    const offset = Number.isInteger(options.offset) ? Math.max(0, options.offset as number) : 0;
    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      if (options.strict) throw new Error(`SEO live-page listing unavailable: ${error.message}`);
      return [];
    }
    return (data ?? []).map((row) => normalizePage(row as PageRow));
  } catch (error) {
    if (options.strict) throw error;
    console.warn("SEO page listing unavailable.", error instanceof Error ? error.message : "Unknown error");
    return [];
  }
}

export type SeoSitemapShardDescriptor = {
  slug: string;
  family: string;
  month: string;
  shardIndex: number;
  urlCount: number;
  lastmod: string | null;
};

/**
 * Read only the sitemap-index descriptors from the database. This keeps the
 * sitemap index bounded even when the live page catalog is very large.
 */
export async function listSeoSitemapShards(): Promise<SeoSitemapShardDescriptor[]> {
  const { data, error } = await createSupabaseAdminClient().rpc("get_seo_sitemap_shard_index", { p_shard_size: SITEMAP_SHARD_SIZE });
  if (error) throw new Error(`SEO sitemap shard index unavailable: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    if (!isRecord(row)) throw new Error("SEO sitemap shard index returned an invalid row.");
    const slug = requiredSitemapValue(row.slug, "slug");
    const family = requiredSitemapValue(row.family, "family");
    const month = requiredSitemapValue(row.month, "month");
    const shardIndex = integerSitemapValue(row.shard_index, "shard_index");
    const urlCount = integerSitemapValue(row.url_count, "url_count");
    const lastmod = row.lastmod == null ? null : requiredSitemapValue(row.lastmod, "lastmod");
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || shardIndex < 1 || urlCount < 1) {
      throw new Error("SEO sitemap shard index returned an invalid descriptor.");
    }
    return { slug, family, month, shardIndex, urlCount, lastmod };
  });
}

/**
 * Fetch one family/month shard only. The database function applies the same
 * canonical/indexable/HTTP-200 filters as the sitemap index and returns at
 * most SITEMAP_SHARD_SIZE paths.
 */
export async function listSeoSitemapShardPages(input: { familySlug: string; month: string; shardIndex: number }): Promise<Array<{ path: string; lastmod: string | null }>> {
  const { data, error } = await createSupabaseAdminClient().rpc("get_seo_sitemap_shard", {
    p_family: input.familySlug,
    p_month: input.month,
    p_shard_index: input.shardIndex,
    p_shard_size: SITEMAP_SHARD_SIZE,
  });
  if (error) throw new Error(`SEO sitemap shard unavailable: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    if (!isRecord(row) || typeof row.path !== "string" || !/^\/[a-z0-9][a-z0-9/-]*\/?$/.test(row.path)) {
      throw new Error("SEO sitemap shard returned an invalid path.");
    }
    const lastmod = row.lastmod == null ? null : requiredSitemapValue(row.lastmod, "lastmod");
    return { path: row.path, lastmod };
  });
}

export type SeoPageArchive = {
  pages: SeoPageSummary[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/**
 * Read one bounded archive page and its exact count. Archive URLs use
 * /page/N rather than query parameters so every page has a stable crawlable
 * address while the application never loads the entire graph for a hub.
 */
export async function listSeoPageArchive(options: {
  family?: SeoPageFamily;
  page?: number;
  pageSize?: number;
  strict?: boolean;
} = {}): Promise<SeoPageArchive> {
  const pageSize = Number.isInteger(options.pageSize) ? Math.max(12, Math.min(100, options.pageSize as number)) : 48;
  const page = Number.isInteger(options.page) ? Math.max(1, options.page as number) : 1;
  const offset = (page - 1) * pageSize;
  try {
    const client = createSupabaseAdminClient();
    let query = client
      .from("seo_pages")
      .select("id,path,page_family,title,meta_description,direct_answer,primary_query,primary_intent,product_slug,job_slug,author_id,reviewer_id,template_version,cohort_id,published_at,search_lastmod_at,seo_url_state!inner(eligible_for_indexing,last_http_status)", { count: "exact" })
      .eq("status", "live")
      .eq("noindex", false)
      .is("canonical_page_id", null)
      .eq("seo_url_state.eligible_for_indexing", true)
      .eq("seo_url_state.last_http_status", 200)
      .order("published_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (options.family) query = query.eq("page_family", options.family);
    const { data, count, error } = await query;
    if (error) {
      if (options.strict) throw new Error(`SEO page archive unavailable: ${error.message}`);
      return { pages: [], page, pageSize, total: 0, pageCount: 0 };
    }
    const total = count ?? 0;
    return {
      pages: (data ?? []).map((row) => normalizePage(row as PageRow)),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  } catch (error) {
    if (options.strict) throw error;
    console.warn("SEO page archive unavailable.", error instanceof Error ? error.message : "Unknown error");
    return { pages: [], page, pageSize, total: 0, pageCount: 0 };
  }
}

function normalizePage(row: PageRow): SeoPageSummary {
  return {
    ...row,
    page_family: row.page_family,
    body: isRecord(row.body) ? row.body as SeoContentBody : {},
  };
}

/**
 * Keep the public contract focused on the reader's job. Internal evidence,
 * rights, and reviewer fields are deliberately stripped at the data boundary
 * so they cannot leak through RSC payloads, HTML, or client-side inspection.
 */
function sanitizePublicBody(body: SeoContentBody): SeoContentBody {
  const publicBody: SeoContentBody = { ...body };
  delete publicBody.sourceRequirements;
  delete publicBody.negativeConstraints;
  delete publicBody.methodology;
  delete publicBody.evidenceNote;
  delete publicBody.mediaNotes;
  delete publicBody.sourceAsset;
  // These legacy blocks are internal persistence details; selected/rejected
  // media are rendered from the sanitized assets list instead.
  delete (publicBody as SeoContentBody & { selectedOutputs?: unknown }).selectedOutputs;
  delete (publicBody as SeoContentBody & { rejectedOutputs?: unknown }).rejectedOutputs;
  delete (publicBody as SeoContentBody & { logoAssetId?: unknown }).logoAssetId;

  if (body.platform) {
    publicBody.platform = {
      target: body.platform.target,
      outputDimensions: body.platform.outputDimensions,
    };
  }

  if (body.settings) {
    const settings = Object.entries(body.settings)
      .filter(([key, value]) => !/(rights?|permission|provenance|checksum|evidence|reviewer|logo|watermark|legal|compliance)/i.test(`${key} ${String(value)}`));
    publicBody.settings = Object.fromEntries(settings);
  }

  if (body.faqs) {
    publicBody.faqs = body.faqs.map(({ question, answer }) => ({ question, answer }));
  }

  return publicBody;
}

function sanitizePublicAssets(assets: SeoPageRecord["assets"]): SeoPageRecord["assets"] {
  return assets.map(({ id, role, public_url, mime_type, width, height, alt_text, caption }) => ({
    id,
    role,
    public_url,
    mime_type,
    width,
    height,
    alt_text: readerSafeAssetText(alt_text, role === "source" ? "Reference product image" : "Product image example"),
    caption: readerSafeAssetText(caption, role === "source" ? "Reference image to start from" : "Example output showing the recommended direction."),
  }));
}

function readerSafeAssetText(value: string | null | undefined, fallback: string): string {
  if (!value || /(rights?|permission|provenance|checksum|evidence|reviewer|logo policy|watermark|legal|compliance)/i.test(value)) return fallback;
  return value;
}

function requiredSitemapValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`SEO sitemap ${name} is missing.`);
  return value.trim();
}

function integerSitemapValue(value: unknown, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`SEO sitemap ${name} is invalid.`);
  return parsed;
}

function normalizePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return "/";
  return `${normalized.replace(/\/+$/, "")}/`;
}

type SeoLinkCandidate = {
  targetPageId: string | null;
  targetPath: string;
  anchorText: string;
  linkType: string;
};

type SeoTargetPage = {
  id: string;
  path: string;
};

// These routes are public application-owned hubs but are not represented in
// seo_pages. They remain valid crawl targets for evidence links recorded by
// the renderer/crawler. Dynamic targets must pass the live URL-state query
// below before being exposed to crawlers.
const STATIC_PUBLIC_LINK_PATHS = new Set([
  "/",
  "/product-photography/",
  "/product-photo-prompts/",
  "/tutorials/",
  "/features/",
  "/use-cases/",
  "/authors/",
  "/support/",
  "/privacy/",
  "/terms/",
  "/disclaimer/",
]);

/**
 * Combine the authored relationship graph with crawler-observed edges.
 * Draft ingestion can only attach seo_links when a target page already
 * exists; crawler edges are therefore the source of truth for static hubs and
 * for links observed after a page was rendered. Resolve only same-origin,
 * public targets so a stale/retired edge never becomes a broken or unsafe
 * public link.
 */
async function resolvePublicLinks(
  client: ReturnType<typeof createSupabaseAdminClient>,
  pagePath: string,
  pageLinkRows: unknown[],
  edgeLinkRows: unknown[],
): Promise<SeoPageLink[]> {
  const candidates: SeoLinkCandidate[] = [];
  for (const value of pageLinkRows) {
    if (!isRecord(value)) continue;
    const target = value.target;
    const nestedTarget = Array.isArray(target) ? target[0] : target;
    const targetPath = isRecord(nestedTarget) && typeof nestedTarget.path === "string"
      ? normalizePath(nestedTarget.path)
      : null;
    const anchorText = typeof value.anchor_text === "string" ? value.anchor_text.trim() : "";
    if (!targetPath || !anchorText) continue;
    candidates.push({
      targetPageId: typeof value.target_page_id === "string" ? value.target_page_id : null,
      targetPath,
      anchorText,
      linkType: typeof value.link_type === "string" && value.link_type.trim() ? value.link_type.trim() : "related",
    });
  }

  for (const value of edgeLinkRows) {
    if (!isRecord(value)) continue;
    const targetPath = typeof value.target_url === "string" ? internalPathFromUrl(value.target_url) : null;
    const anchorText = typeof value.anchor_text === "string" ? value.anchor_text.trim() : "";
    if (!targetPath || !anchorText) continue;
    candidates.push({
      targetPageId: typeof value.target_page_id === "string" ? value.target_page_id : null,
      targetPath,
      anchorText,
      linkType: linkTypeFromPlacement(value.placement),
    });
  }

  const targetPaths = [...new Set(candidates
    .map((candidate) => candidate.targetPath)
    .filter((targetPath) => !STATIC_PUBLIC_LINK_PATHS.has(targetPath) && targetPath !== normalizePath(pagePath)))].slice(0, 64);
  const targetResult = targetPaths.length
    ? await client
      .from("seo_pages")
      .select("id,path,seo_url_state!inner(eligible_for_indexing,last_http_status)")
      .in("path", targetPaths)
      .eq("status", "live")
      .eq("noindex", false)
      .is("canonical_page_id", null)
      .eq("seo_url_state.eligible_for_indexing", true)
      .eq("seo_url_state.last_http_status", 200)
    : { data: [], error: null };
  if (targetResult.error) throw new Error(`SEO linked-page lookup unavailable: ${targetResult.error.message}`);

  const healthyTargets = new Map<string, SeoTargetPage>();
  for (const value of targetResult.data ?? []) {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.path !== "string") continue;
    healthyTargets.set(normalizePath(value.path), { id: value.id, path: normalizePath(value.path) });
  }

  const currentPath = normalizePath(pagePath);
  const seen = new Set<string>();
  const result: SeoPageLink[] = [];
  for (const candidate of candidates) {
    if (candidate.targetPath === currentPath) continue;
    const target = STATIC_PUBLIC_LINK_PATHS.has(candidate.targetPath)
      ? null
      : healthyTargets.get(candidate.targetPath);
    if (!STATIC_PUBLIC_LINK_PATHS.has(candidate.targetPath) && !target) continue;
    const key = `${candidate.targetPath}\u0000${candidate.linkType}\u0000${candidate.anchorText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      target_page_id: target?.id ?? candidate.targetPageId,
      target_path: candidate.targetPath,
      anchor_text: candidate.anchorText,
      link_type: candidate.linkType,
    });
  }
  return result;
}

function internalPathFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== new URL(absoluteUrl("/")).origin || url.search || url.hash) return null;
    return normalizePath(url.pathname);
  } catch {
    return null;
  }
}

function linkTypeFromPlacement(value: unknown): string {
  if (value === "navigation" || value === "breadcrumb" || value === "footer") return String(value);
  return "related";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
