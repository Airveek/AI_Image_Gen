import type {
  ProductFashionScene,
  ProductProfileSnapshot,
  StudioRecipe,
  StudioRecipeId,
} from "@/features/creator/types";

type UnknownRecord = Record<string, unknown>;

export const studioRecipes = {
  "clean-studio": {
    id: "clean-studio",
    label: "Clean studio",
    scene: "a clean premium studio with a simple neutral background",
    composition: "the complete product is centered with balanced negative space and natural grounding shadows",
    camera: "a straight-on commercial product camera angle with realistic perspective",
    lighting: "controlled softbox lighting with clean highlights and soft shadows",
    constraints: [
      "Keep the background quiet and free of distracting props.",
      "Make the product the only visual focal point.",
    ],
  },
  "warm-stone": {
    id: "warm-stone",
    label: "Warm stone",
    scene: "a warm stone surface with a refined neutral backdrop",
    composition: "the product is placed naturally with intentional clean space for campaign copy",
    camera: "a slightly elevated three-quarter product camera angle with realistic perspective",
    lighting: "soft directional daylight with warm natural depth and gentle shadows",
    constraints: [
      "Use restrained styling and only a few supporting materials when they improve the product story.",
      "Keep all supporting elements behind the product in visual priority.",
    ],
  },
  "editorial-lifestyle": {
    id: "editorial-lifestyle",
    label: "Editorial lifestyle",
    scene: "a believable editorial lifestyle setting that supports the product category",
    composition: "the product remains clearly visible in a natural full or three-quarter composition with deliberate negative space",
    camera: "a natural editorial camera angle with realistic scale and perspective",
    lighting: "soft natural light with flattering contrast and believable ambient shadows",
    constraints: [
      "Use lifestyle details only when they support the selected product and campaign goal.",
      "Do not let people, props, or scenery obscure the product.",
    ],
  },
} satisfies Record<StudioRecipeId, StudioRecipe>;

export function getStudioRecipe(id: StudioRecipeId | undefined): StudioRecipe | undefined {
  return id ? studioRecipes[id] : undefined;
}

export function studioRecipeIdForScene(scene: ProductFashionScene): StudioRecipeId {
  if (scene === "studio") return "clean-studio";
  if (scene === "lifestyle" || scene === "outdoor") return "editorial-lifestyle";
  return "warm-stone";
}

export function createProductProfileSnapshot(name: string): ProductProfileSnapshot {
  return {
    name: name.trim().slice(0, 100),
    category: "",
    material: "",
    colors: "",
    identityNotes: "",
    prohibitedChanges: "",
  };
}

export function parseProductProfileSnapshot(settings: unknown): ProductProfileSnapshot | undefined {
  if (!isRecord(settings) || !isRecord(settings.productProfile)) return undefined;
  const profile = settings.productProfile;
  const name = readProfileString(profile, "name");
  const category = readProfileString(profile, "category");
  const material = readProfileString(profile, "material");
  const colors = readProfileString(profile, "colors");
  const identityNotes = readProfileString(profile, "identityNotes");
  const prohibitedChanges = readProfileString(profile, "prohibitedChanges");
  if (
    name === undefined ||
    category === undefined ||
    material === undefined ||
    colors === undefined ||
    identityNotes === undefined ||
    prohibitedChanges === undefined
  ) {
    return undefined;
  }

  const parsed = {
    name: name.trim().slice(0, 100),
    category: category.trim().slice(0, 120),
    material: material.trim().slice(0, 160),
    colors: colors.trim().slice(0, 160),
    identityNotes: identityNotes.trim().slice(0, 500),
    prohibitedChanges: prohibitedChanges.trim().slice(0, 500),
  } satisfies ProductProfileSnapshot;

  return parsed.name ? parsed : undefined;
}

function readProfileString(profile: UnknownRecord, key: string): string | undefined {
  const value = profile[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
