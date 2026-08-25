export type CreatorArenaId =
  | "general-image"
  | "product-fashion"
  | "storybook-page"
  | "image-to-sketch";

export type CreatorCategoryId =
  | "product-ecommerce"
  | "people-fashion"
  | "marketing-business"
  | "books-education"
  | "art-printables"
  | "edit-improve";

export type CreatorAssetKind =
  | "product"
  | "person"
  | "character"
  | "reference"
  | "generation";

export type CreatorAssetStatus = "processing" | "ready" | "failed";
export type ImageProviderKind = "gemini-official" | "gemini-compatible";
export type ImageAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type AllowedImageMimeType = "image/png" | "image/jpeg" | "image/webp";
export type LightingOption =
  | "auto"
  | "soft-daylight"
  | "studio-softbox"
  | "golden-hour"
  | "dramatic";
export type ProductCampaignGoal =
  | "store-listing"
  | "social-post"
  | "ad-banner"
  | "lookbook";
export type ProductFashionMode = "product-scene" | "on-model" | "influencer-lifestyle";
export type ProductFashionScene = "studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom";
export type ReferenceRole =
  | "product"
  | "model"
  | "character"
  | "style"
  | "logo"
  | "reference";

export type GenerationReference = {
  assetId: string;
  role: ReferenceRole;
};

export type GeneralImageRequest = {
  arenaId: "general-image";
  outputType: "image" | "poster" | "illustration" | "social" | "thumbnail";
  subject: string;
  exactText: string;
  style: string;
  lighting: LightingOption;
  aspectRatio: ImageAspectRatio;
  extraDirection: string;
  references: GenerationReference[];
};

export type ProductFashionRequest = {
  arenaId: "product-fashion";
  mode: ProductFashionMode;
  scene: ProductFashionScene;
  campaignGoal: ProductCampaignGoal;
  backgroundMood: string;
  lighting: LightingOption;
  aspectRatio: ImageAspectRatio;
  extraDirection: string;
  references: GenerationReference[];
};

export type StorybookPageRequest = {
  arenaId: "storybook-page";
  characterDescription: string;
  scene: string;
  artStyle: "cartoon" | "watercolor" | "3d-storybook" | "custom";
  pageText: string;
  lighting: LightingOption;
  aspectRatio: ImageAspectRatio;
  extraDirection: string;
  references: GenerationReference[];
};

export type ImageToSketchRequest = {
  arenaId: "image-to-sketch";
  aspectRatio: "1:1";
  prompt: string;
  references: GenerationReference[];
};

export type GenerationRequest =
  | GeneralImageRequest
  | ProductFashionRequest
  | StorybookPageRequest
  | ImageToSketchRequest;

export type GenerationCount = 1 | 2 | 3;
export type CreatorBatchStatus = "idle" | "generating" | "completed" | "completed-with-errors";
export type CreatorBatchItemStatus = "generating" | "ready" | "failed";
export type CreatorBatchItem = {
  index: number;
  request: GenerationRequest;
  status: CreatorBatchItemStatus;
  asset: CreatorAsset | null;
  error: string | null;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
  provider: ImageProviderKind;
  model: string;
};

export type CreatorErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "invalid_file"
  | "daily_limit"
  | "generation_in_progress"
  | "provider_not_configured"
  | "provider_incompatible"
  | "provider_blocked"
  | "provider_unavailable"
  | "provider_rate_limited"
  | "provider_timeout"
  | "storage_not_configured"
  | "storage_failed"
  | "not_found"
  | "unknown";

export type CreatorResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code: CreatorErrorCode };

export type CreatorAsset = {
  id: string;
  userId: string;
  kind: CreatorAssetKind;
  name: string;
  arenaId: CreatorArenaId | null;
  prompt: string | null;
  sourceAssetIds: string[];
  status: CreatorAssetStatus;
  mimeType: AllowedImageMimeType | null;
  createdAt: string;
  imageUrl: string | null;
  providerKind: ImageProviderKind | null;
  providerModel: string | null;
};

export type CreatorAssetRow = {
  id: string;
  user_id: string;
  kind: string;
  name: string;
  arena_id: string | null;
  prompt: string | null;
  settings: unknown;
  source_asset_ids: string[] | null;
  status: string;
  mime_type: string | null;
  drive_file_id: string | null;
  r2_key: string | null;
  r2_expires_at: string | null;
  provider_kind: string | null;
  provider_model: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageProviderSetting = {
  id: string;
  name: string;
  kind: ImageProviderKind;
  baseUrl: string;
  model: string;
  isActive: boolean;
  hasApiKey: boolean;
  supportsTextToImage: boolean;
  supportsReferenceImages: boolean;
  testedAt: string | null;
  lastError: string | null;
};

export type BridgeAccountStatus = {
  id: string;
  label: string;
  enabled: boolean;
  status: "ready" | "busy" | "limited" | "not_ready" | "disabled";
  requestsInWindow: number;
  remainingInWindow: number;
  requestLimit: number;
  windowSeconds: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestAt: string | null;
  lastError: string | null;
};

export type BridgePoolStatus = {
  provider: string;
  model: string;
  rateLimit: {
    requests: number;
    windowSeconds: number;
  };
  summary: {
    total: number;
    ready: number;
    busy: number;
    limited: number;
  };
  accounts: BridgeAccountStatus[];
};

export type ProviderTestResult = {
  models: string[];
  supportsTextToImage: boolean;
  supportsReferenceImages: boolean;
  message: string;
};

export type IntegrationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type ProviderModelResult =
  | { ok: true; models: string[] }
  | { ok: false; message: string };

export type CreatorIdentity = {
  id: string;
  email: string | null;
  displayName: string;
};
