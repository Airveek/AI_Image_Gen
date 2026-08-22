import type {
  CreatorAssetKind,
  GenerationRequest,
  ImageAspectRatio,
} from "@/features/creator/types";

type UnknownRecord = Record<string, unknown>;

export function parseGenerationRequest(value: unknown): GenerationRequest {
  const record = requireRecord(value, "Generation details are missing.");
  const arenaId = readString(record, "arenaId");
  const sourceAssetIds = readSourceAssetIds(record);
  const aspectRatio = readAspectRatio(record);

  if (arenaId === "general-image") {
    return {
      arenaId,
      outputType: readEnum(record, "outputType", ["image", "poster", "illustration", "social", "thumbnail"]),
      subject: readRequiredText(record, "subject", 600),
      exactText: readOptionalText(record, "exactText", 240),
      style: readRequiredText(record, "style", 120),
      aspectRatio,
      extraDirection: readOptionalText(record, "extraDirection", 500),
      sourceAssetIds,
    };
  }

  if (arenaId === "product-fashion") {
    if (sourceAssetIds.length === 0) {
      throw new Error("Add a saved product or garment image before generating.");
    }
    return {
      arenaId,
      mode: readEnum(record, "mode", ["product-scene", "on-model", "influencer-lifestyle"]),
      scene: readEnum(record, "scene", ["studio", "lifestyle", "flat-lay", "outdoor", "custom"]),
      backgroundMood: readOptionalText(record, "backgroundMood", 240),
      aspectRatio,
      extraDirection: readOptionalText(record, "extraDirection", 500),
      sourceAssetIds,
    };
  }

  if (arenaId === "storybook-page") {
    const characterDescription = readOptionalText(record, "characterDescription", 600);
    if (!characterDescription && sourceAssetIds.length === 0) {
      throw new Error("Describe the main character or choose a saved character reference.");
    }
    return {
      arenaId,
      characterDescription,
      scene: readRequiredText(record, "scene", 800),
      artStyle: readEnum(record, "artStyle", ["cartoon", "watercolor", "3d-storybook", "custom"]),
      pageText: readOptionalText(record, "pageText", 500),
      aspectRatio,
      extraDirection: readOptionalText(record, "extraDirection", 500),
      sourceAssetIds,
    };
  }

  throw new Error("Choose a supported creation arena.");
}

export function parseAssetKind(value: unknown): Exclude<CreatorAssetKind, "generation"> {
  if (value === "product" || value === "person" || value === "character" || value === "reference") {
    return value;
  }
  throw new Error("Choose a valid reference type.");
}

export function parseAssetName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Give this image a name.");
  }
  return value.trim().slice(0, 100);
}

function readAspectRatio(record: UnknownRecord): ImageAspectRatio {
  return readEnum(record, "aspectRatio", ["1:1", "4:5", "9:16", "16:9"]);
}

function readSourceAssetIds(record: UnknownRecord): string[] {
  const value = record.sourceAssetIds;
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = [...new Set(value.filter((item): item is string => typeof item === "string"))];
  if (ids.length > 2 || ids.some((id) => !isUuid(id))) {
    throw new Error("Choose no more than two valid reference images.");
  }
  return ids;
}

function readRequiredText(record: UnknownRecord, key: string, maxLength: number): string {
  const value = readOptionalText(record, key, maxLength);
  if (!value) {
    throw new Error(`Complete the ${humanize(key)} field.`);
  }
  return value;
}

function readOptionalText(record: UnknownRecord, key: string, maxLength: number): string {
  const value = record[key];
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`${humanize(key)} must be text.`);
  }
  return value.trim().slice(0, maxLength);
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readEnum<const T extends string>(record: UnknownRecord, key: string, values: readonly T[]): T {
  const value = record[key];
  if (typeof value === "string" && values.includes(value as T)) {
    return value as T;
  }
  throw new Error(`Choose a valid ${humanize(key)}.`);
}

function requireRecord(value: unknown, message: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as UnknownRecord;
}

function humanize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").toLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
