import type {
  SeoAnalyticsEvent,
  SeoAnalyticsEventName,
  SeoAnalyticsEventProperties,
} from "@/features/seo/types";

const EVENT_NAMES = new Set<SeoAnalyticsEventName>([
  "seo_page_view",
  "seo_result_gallery_engaged",
  "seo_prompt_copied",
  "seo_preset_opened",
  "seo_upload_started",
  "seo_internal_link_clicked",
]);

export function buildSeoAnalyticsEvent(input: {
  eventName: SeoAnalyticsEventName;
  properties: SeoAnalyticsEventProperties;
}): SeoAnalyticsEvent | null {
  if (!EVENT_NAMES.has(input.eventName)) return null;
  const contentId = safeDimension(input.properties.contentId, 160);
  if (!contentId) return null;

  return {
    eventName: input.eventName,
    properties: compact({
      contentId,
      pageId: safeUuid(input.properties.pageId),
      cohortId: safeDimension(input.properties.cohortId, 80),
      pageFamily: safeDimension(input.properties.pageFamily, 80),
      productEntity: safeDimension(input.properties.productEntity, 160),
      imageJob: safeDimension(input.properties.imageJob, 80),
      templateVersion: safeDimension(input.properties.templateVersion, 40),
      presetId: safeDimension(input.properties.presetId, 160),
      linkTargetContentId: safeDimension(input.properties.linkTargetContentId, 160),
    }),
  };
}

function safeDimension(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/[^a-zA-Z0-9 _./:-]/g, "").slice(0, maxLength);
  return normalized || undefined;
}

function safeUuid(value: string | undefined): string | undefined {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): SeoAnalyticsEventProperties {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as SeoAnalyticsEventProperties;
}
