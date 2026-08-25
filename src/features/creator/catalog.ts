import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Camera,
  Eraser,
  Expand,
  ImageIcon,
  Layers3,
  LayoutTemplate,
  Megaphone,
  Palette,
  PenTool,
  Shirt,
  ShoppingBag,
  Sparkles,
  Type as TypeIcon,
  Users,
  WandSparkles,
} from "lucide-react";

import { featureArtworks, type Artwork } from "@/components/airveek/landing-data";
import type {
  CreatorArenaId,
  CreatorCategoryId,
  ReferenceRole,
} from "@/features/creator/types";

export type CreatorCategory = {
  id: CreatorCategoryId;
  label: string;
};

export type CreatorArena = {
  id: CreatorArenaId;
  title: string;
  shortTitle: string;
  description: string;
  categoryId: CreatorCategoryId;
  artwork: Artwork;
  icon: LucideIcon;
};

export type CreatorCatalogItem = {
  id: string;
  title: string;
  description: string;
  categoryId: CreatorCategoryId;
  artwork: Artwork;
  icon: LucideIcon;
  availability: "available" | "coming-next";
  arenaId: CreatorArenaId | null;
};

export const creatorCategories: CreatorCategory[] = [
  { id: "product-ecommerce", label: "Product & Ecommerce" },
  { id: "people-fashion", label: "People & Fashion" },
  { id: "marketing-business", label: "Marketing & Business" },
  { id: "books-education", label: "Books & Education" },
  { id: "art-printables", label: "Art & Printables" },
  { id: "edit-improve", label: "Edit & Improve" },
];

export const creatorArenas: CreatorArena[] = [
  {
    id: "general-image",
    title: "General Image",
    shortTitle: "General Image",
    description: "Create polished images, posters, illustrations, social graphics, and thumbnails.",
    categoryId: "marketing-business",
    artwork: featureArtworks.unlimitedAiImageCreator,
    icon: WandSparkles,
  },
  {
    id: "product-fashion",
    title: "Product & Fashion Photoshoot",
    shortTitle: "Product & Fashion",
    description: "Turn a product or garment photo into studio, lifestyle, and on-model campaigns.",
    categoryId: "product-ecommerce",
    artwork: featureArtworks.aiProductPhotographer,
    icon: Camera,
  },
  {
    id: "storybook-page",
    title: "Storybook Page",
    shortTitle: "Storybook Page",
    description: "Create one illustrated story page with a consistent character and clear scene direction.",
    categoryId: "books-education",
    artwork: featureArtworks.personalizedStorybookMaker,
    icon: BookOpen,
  },
  {
    id: "image-to-sketch",
    title: "Image to Sketch",
    shortTitle: "Image to Sketch",
    description: "Turn a rough photo or low-quality sketch into a clean black-line sketch.",
    categoryId: "edit-improve",
    artwork: featureArtworks.aiFashionDesigner,
    icon: PenTool,
  },
];

export const creatorCatalog: CreatorCatalogItem[] = [
  ...creatorArenas.map((arena) => ({
    id: arena.id,
    title: arena.title,
    description: arena.description,
    categoryId: arena.categoryId,
    artwork: arena.artwork,
    icon: arena.icon,
    availability: "available" as const,
    arenaId: arena.id,
  })),
  {
    id: "perfect-text",
    title: "Perfect Text in Images",
    description: "Create posters and ads with readable text.",
    categoryId: "marketing-business",
    artwork: featureArtworks.perfectTextInAiImages,
    icon: TypeIcon,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "product-mockup",
    title: "Product Mockup Creator",
    description: "Place designs on products and packaging.",
    categoryId: "product-ecommerce",
    artwork: featureArtworks.aiProductMockupCreator,
    icon: ShoppingBag,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "scene-background",
    title: "Scene Background Editor",
    description: "Replace backgrounds and rebuild natural lighting.",
    categoryId: "edit-improve",
    artwork: featureArtworks.instantSceneBackgroundEditor,
    icon: ImageIcon,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "image-expander",
    title: "Smart Image Expander",
    description: "Extend an image beyond its current edges.",
    categoryId: "edit-improve",
    artwork: featureArtworks.smartImageExpander,
    icon: Expand,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "logo-maker",
    title: "AI Logo Maker",
    description: "Build logo directions and brand marks.",
    categoryId: "marketing-business",
    artwork: featureArtworks.aiLogoMaker,
    icon: PenTool,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "canvas-editor",
    title: "Canvas-Style Editor",
    description: "Arrange images, text, and graphics on a canvas.",
    categoryId: "edit-improve",
    artwork: featureArtworks.canvasStyleImageEditor,
    icon: LayoutTemplate,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "coloring-book",
    title: "Coloring Book Generator",
    description: "Create clean, printable coloring pages.",
    categoryId: "art-printables",
    artwork: featureArtworks.coloringBookGenerator,
    icon: Palette,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "consistent-character",
    title: "Consistent Character",
    description: "Keep one character recognizable across scenes.",
    categoryId: "books-education",
    artwork: featureArtworks.consistentCharacter,
    icon: Users,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "image-upscaler",
    title: "AI Image Upscaler",
    description: "Increase image size and restore sharp detail.",
    categoryId: "edit-improve",
    artwork: featureArtworks.aiImageUpscaler,
    icon: Sparkles,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "human-inpainting",
    title: "Human Inpainting",
    description: "Change clothing, hair, accessories, or surroundings.",
    categoryId: "people-fashion",
    artwork: featureArtworks.aiHumanInpainting,
    icon: Eraser,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "style-replicator",
    title: "Style Replicator",
    description: "Use a visual reference to keep a consistent look.",
    categoryId: "art-printables",
    artwork: featureArtworks.aiStyleReplicator,
    icon: Palette,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "talking-storybook",
    title: "Talking Storybook",
    description: "Add narration to illustrated story pages.",
    categoryId: "books-education",
    artwork: featureArtworks.talkingStorybookCreator,
    icon: WandSparkles,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "multilingual-storybook",
    title: "Multilingual Storybook",
    description: "Prepare stories for bilingual readers.",
    categoryId: "books-education",
    artwork: featureArtworks.multilingualStorybookMaker,
    icon: BookOpen,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "virtual-model",
    title: "Virtual Model Creator",
    description: "Place garments on realistic virtual models.",
    categoryId: "people-fashion",
    artwork: featureArtworks.virtualModelCreator,
    icon: Users,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "fashion-designer",
    title: "AI Fashion Designer",
    description: "Explore garments, colors, materials, and styling.",
    categoryId: "people-fashion",
    artwork: featureArtworks.aiFashionDesigner,
    icon: Shirt,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "thumbnail-maker",
    title: "AI Thumbnail Maker",
    description: "Create bold thumbnails from a topic or title.",
    categoryId: "marketing-business",
    artwork: featureArtworks.aiThumbnailMaker,
    icon: Megaphone,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "character-creator",
    title: "AI Character Creator",
    description: "Design an original hero, sidekick, or villain.",
    categoryId: "art-printables",
    artwork: featureArtworks.aiCharacterCreator,
    icon: Users,
    availability: "coming-next",
    arenaId: null,
  },
  {
    id: "bulk-clipart",
    title: "Bulk Clipart Designer",
    description: "Generate matching clipart collections.",
    categoryId: "art-printables",
    artwork: featureArtworks.bulkClipartDesigner,
    icon: Layers3,
    availability: "coming-next",
    arenaId: null,
  },
];

const allReferenceRoles: readonly ReferenceRole[] = ["product", "model", "character", "style", "reference"];

export function referenceRolesForArena(arenaId: CreatorArenaId): readonly ReferenceRole[] {
  if (arenaId === "product-fashion") return ["product", "model", "style", "reference"];
  if (arenaId === "storybook-page") return ["character", "style", "reference"];
  if (arenaId === "image-to-sketch") return ["reference"];
  return allReferenceRoles;
}

export function getCreatorArena(arenaId: string): CreatorArena | null {
  return creatorArenas.find((arena) => arena.id === arenaId) ?? null;
}

export function getCategoryLabel(categoryId: CreatorCategoryId): string {
  return creatorCategories.find((category) => category.id === categoryId)?.label ?? "Create";
}
