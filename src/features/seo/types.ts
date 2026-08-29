export type SeoConsentState = "granted" | "denied" | "unknown";

export type SeoAnalyticsEventName =
  | "seo_page_view"
  | "seo_result_gallery_engaged"
  | "seo_prompt_copied"
  | "seo_preset_opened"
  | "seo_upload_started"
  | "seo_internal_link_clicked";

export type SeoAnalyticsEventProperties = {
  contentId: string;
  pageId?: string;
  cohortId?: string;
  pageFamily?: string;
  productEntity?: string;
  imageJob?: string;
  templateVersion?: string;
  presetId?: string;
  linkTargetContentId?: string;
};

export type SeoAnalyticsEvent = {
  eventName: SeoAnalyticsEventName;
  properties: SeoAnalyticsEventProperties;
};

export type SeoTouch = {
  id: string;
  occurredAt: string;
  landingPath: string;
  source: string;
  medium: string;
  campaign: string | null;
  referrerHost: string | null;
  contentId: string | null;
};

export type SeoAttributionCookie = {
  version: 1;
  anonymousId: string;
  firstTouch: SeoTouch;
  lastNonDirectTouch: SeoTouch | null;
  updatedAt: string;
};

export type SeoAttributionCookieMutation =
  | { action: "none" }
  | { action: "clear" }
  | {
      action: "set";
      cookieValue: string;
      attribution: SeoAttributionCookie;
      touchToRecord: SeoTouch | null;
    };

export type SeoJobStatus = "running" | "succeeded" | "failed" | "skipped";

export type SeoJobStart = {
  runId: string | null;
  shouldRun: boolean;
  reason: "ready" | "disabled" | "duplicate" | "schema_unavailable";
  config: {
    crawlEnabled: boolean;
    sourceSyncEnabled: boolean;
    crawlBatchSize: number;
    dailyPublishLimit: number;
    dailyPublishWaveSize: number;
  };
};

export type SeoIntegrationReadiness = {
  gsc: boolean;
  ga4: boolean;
  bing: boolean;
  indexNow: boolean;
};

export type AdminSeoAlert = {
  id: string;
  severity: "p0" | "p1" | "p2";
  category: string;
  title: string;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  lastSeenAt: string;
};

export type AdminSeoJobRun = {
  id: string;
  loopName: string;
  status: SeoJobStatus;
  checkedCount: number;
  actedCount: number;
  note: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type AdminSeoDashboardData = {
  available: boolean;
  setupMessage: string | null;
  generatedAt: string;
  periodDays: number;
  summary: {
    publishedUrls: number;
    crawlableUrls: number;
    verifiedIndexedUrls: number;
    impressionActiveUrls: number;
    googleClicks: number;
    googleImpressions: number;
    organicSessions: number;
    organicSignups: number;
    organicPurchases: number;
    organicRevenue: number;
    bingClicks: number;
    openAlerts: number;
  };
  alerts: AdminSeoAlert[];
  jobs: AdminSeoJobRun[];
};

export type SeoPageFamily = "product-hub" | "category-hub" | "listing" | "lifestyle" | "detail" | "prompt" | "tutorial" | "feature";

export type SeoContentBody = {
  buyerQuestion?: string;
  sourceRequirements?: string[];
  steps?: Array<{ title: string; description: string }>;
  settings?: Record<string, string | number | boolean>;
  prompt?: string;
  negativeConstraints?: string[];
  checklist?: string[];
  limitations?: string[];
  methodology?: string;
  evidenceNote?: string;
};

export type SeoPageSummary = {
  id: string;
  path: string;
  page_family: SeoPageFamily;
  title: string;
  meta_description: string;
  direct_answer: string;
  primary_query: string;
  primary_intent: string;
  product_slug: string | null;
  job_slug: string | null;
  body: SeoContentBody;
  author_id: string | null;
  reviewer_id: string | null;
  template_version: string;
  cohort_id: string | null;
  published_at: string | null;
  search_lastmod_at: string | null;
};

export type SeoPageAsset = {
  id: string;
  role: "source" | "hero" | "selected" | "rejected" | "corrected" | "screenshot" | "video" | "og";
  public_url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
};

export type SeoPageSource = {
  id: string;
  title: string;
  url: string;
  publisher: string | null;
  accessed_at: string;
};

export type SeoPageLink = {
  target_page_id: string;
  target_path: string;
  anchor_text: string;
  link_type: string;
};

export type SeoPageRecord = SeoPageSummary & {
  canonical_url: string;
  assets: SeoPageAsset[];
  sources: SeoPageSource[];
  links: SeoPageLink[];
  author_name: string | null;
  reviewer_name: string | null;
};
