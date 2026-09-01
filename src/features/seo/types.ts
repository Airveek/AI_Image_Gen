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
    recommendationsEnabled: boolean;
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

export type AdminSeoRecommendation = {
  id: string;
  severity: "p0" | "p1" | "p2";
  category: string;
  title: string;
  message: string;
  recommendedAction: string;
  status: "open" | "acknowledged" | "in_progress" | "completed" | "dismissed" | "expired";
  pageId: string | null;
  canonicalUrl: string | null;
  query: string | null;
  lastSeenAt: string;
  dueAt: string | null;
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

export type AdminSeoVitalMetric = {
  p75: number;
  sampleCount: number;
};

export type AdminSeoImportWatermark = {
  source: "gsc" | "ga4" | "bing";
  status: "idle" | "running" | "succeeded" | "failed";
  lastAttemptedMetricDate: string | null;
  lastSuccessMetricDate: string | null;
  lastError: string | null;
};

export type AdminSeoKeywordEvidenceSummary = {
  totalRows: number;
  measuredRows: number;
  qualitativeRows: number;
  linkedRows: number;
  latestMetricDate: string | null;
  sources: Array<{ source: string; rows: number }>;
};

export type AdminSeoAttributionRow = {
  source: string;
  medium: string;
  users: number;
  signups: number;
  firstGenerations: number;
  checkoutStarts: number;
  activations: number;
  paidUsers: number;
  verifiedPayments: number;
  refundEvents: number;
  verifiedRevenueUsd: number;
};

export type AdminSeoDashboardData = {
  available: boolean;
  setupMessage: string | null;
  generatedAt: string;
  periodDays: number;
  readiness: SeoIntegrationReadiness;
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
    openRecommendations: number;
    overdueRecommendations: number;
    coreWebVitals: Partial<Record<"lcp" | "inp" | "cls", AdminSeoVitalMetric>>;
  };
  alerts: AdminSeoAlert[];
  recommendations: AdminSeoRecommendation[];
  jobs: AdminSeoJobRun[];
  importWatermarks: AdminSeoImportWatermark[];
  keywordEvidence: AdminSeoKeywordEvidenceSummary;
  attribution: {
    firstTouch: AdminSeoAttributionRow[];
    lastNonDirect: AdminSeoAttributionRow[];
  };
  operations: {
    briefsByStatus: Record<string, number>;
    activeAssignments: number;
    reviewQueue: number;
    evidenceQueue: number;
    auditEvents: number;
    contentMembers: {
      writers: number;
      publishers: number;
      seoAdmins: number;
    };
    agentRunsByStatus: Record<string, number>;
    activeAgentRuns: number;
    expiredAgentRuns: number;
    failedAgentRuns: number;
  };
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
  whyThisWorks?: string;
  failureFixes?: Array<{ failure: string; fix: string }>;
  faqs?: Array<{ question: string; answer: string; evidenceSourceIds?: string[] }>;
  platform?: {
    target: string;
    outputDimensions?: string[];
    logoPolicy?: "inherent_product_branding" | "authorized_overlay_branding" | "marketplace_restricted" | "unverified_brand" | string;
    textOverlayPolicy?: string;
  };
  presetId?: string;
  sourceAsset?: {
    assetId?: string;
    checksum?: string;
    rightsStatus?: string;
    rightsEvidenceId?: string;
    rightsApproved?: boolean;
    provenance?: string;
  };
  mediaNotes?: Array<{ assetId?: string; note: string; kind?: "selected" | "rejected" | "correction" | string }>;
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
  checksum?: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  provenance?: string;
  ai_provenance?: string | null;
  generation_metadata?: Record<string, unknown>;
  rights_status?: string;
  logo_policy?: string;
};

export type SeoPageSource = {
  id: string;
  title: string;
  url: string;
  publisher: string | null;
  accessed_at: string;
};

export type SeoPageLink = {
  // Static hubs (for example /product-photography/) do not have a row in
  // seo_pages, so an edge can be crawlable without a content UUID. Keep the
  // analytics target optional instead of manufacturing an identifier.
  target_page_id: string | null;
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
