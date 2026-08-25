import type {
  GenerationRequest,
  LightingOption,
  ProductFashionRequest,
  PromptContext,
} from "@/features/creator/types";

export function buildGenerationPrompt(request: GenerationRequest, context?: PromptContext): string {
  switch (request.arenaId) {
    case "general-image":
      return buildGeneralImagePrompt(request);
    case "product-fashion":
      return buildProductFashionPrompt(request, context);
    case "storybook-page":
      return buildStorybookPagePrompt(request);
    case "image-to-sketch":
      return buildImageToSketchPrompt(request);
  }
}

function buildGeneralImagePrompt(request: Extract<GenerationRequest, { arenaId: "general-image" }>): string {
  const lines = [
    `Create a polished ${request.outputType.replace("-", " ")} image.`,
    `Main subject and outcome: ${request.subject}.`,
    `Visual style: ${request.style}.`,
    `Lighting: ${lightingDirection(request.lighting)}.`,
    `Composition: ${request.aspectRatio} aspect ratio, clear hierarchy, intentional lighting, professional finish.`,
  ];

  if (request.exactText) {
    lines.push(`Include this exact readable text once: “${request.exactText}”. Do not misspell or repeat it.`);
  }

  if (request.extraDirection) {
    lines.push(`Extra direction: ${request.extraDirection}.`);
  }

  lines.push("Return one finished image only, without an explanation or mockup frame.");
  return lines.join("\n");
}

function buildProductFashionPrompt(request: ProductFashionRequest, context?: PromptContext): string {
  const modeDirection = {
    "product-scene": "Create a high-end product photograph where the supplied product is the clear hero.",
    "on-model": "Create a high-end fashion photograph with the supplied garment or product worn naturally by a model.",
    "influencer-lifestyle": "Create a believable influencer-style lifestyle campaign photograph using the supplied product.",
  }[request.mode];

  const lines = [
    modeDirection,
    ...(context?.productProfile ? productIdentityLines(context.productProfile) : []),
    ...(context?.studioRecipe ? studioRecipeLines(context.studioRecipe) : []),
    `Scene direction: ${request.scene.replace("-", " ")}.`,
    `Campaign goal: ${campaignGoalDirection(request.campaignGoal)}.`,
    `Background and mood: ${request.backgroundMood || "clean, premium, commercially useful"}.`,
    `Lighting: ${lightingDirection(request.lighting)}.`,
    `Composition: ${request.aspectRatio} aspect ratio, realistic perspective, natural shadows, controlled highlights, premium campaign finish.`,
    context
      ? "Preserve the exact product shape, proportions, colors, logo, label, material, garment construction, and important identifying details from the references. Keep the product complete, sharp, correctly scaled, and clearly readable."
      : "Preserve the exact product shape, proportions, colors, logo, label, material, garment construction, and important identifying details from the references.",
    "Do not invent extra logos, alter packaging text, deform the product, replace the selected product, add random text, or add duplicate products unless explicitly requested.",
  ];

  if (request.extraDirection) {
    lines.push(`Extra direction: ${request.extraDirection}.`);
  }

  lines.push("Return one finished photograph only, without an explanation or contact sheet.");
  return lines.join("\n");
}

function productIdentityLines(profile: NonNullable<PromptContext["productProfile"]>): string[] {
  const lines = [`Product identity: use the supplied product reference as the source of truth for “${profile.name}”.`];
  if (profile.category) lines.push(`Product category: ${profile.category}.`);
  if (profile.material) lines.push(`Product material: ${profile.material}.`);
  if (profile.colors) lines.push(`Product colors: ${profile.colors}.`);
  if (profile.identityNotes) lines.push(`Identity details to preserve: ${profile.identityNotes}.`);
  if (profile.prohibitedChanges) lines.push(`Never change these identity details: ${profile.prohibitedChanges}.`);
  return lines;
}

function studioRecipeLines(recipe: NonNullable<PromptContext["studioRecipe"]>): string[] {
  return [
    `Visual recipe: ${recipe.label}.`,
    `Recipe scene: ${recipe.scene}.`,
    `Recipe composition: ${recipe.composition}.`,
    `Recipe camera: ${recipe.camera}.`,
    `Recipe lighting: ${recipe.lighting}.`,
    ...recipe.constraints,
  ];
}

function campaignGoalDirection(goal: Extract<GenerationRequest, { arenaId: "product-fashion" }>["campaignGoal"]): string {
  return {
    "store-listing": "show the complete product clearly on a clean commercial background with no generated copy",
    "social-post": "make the product the main focal point in a believable, mobile-friendly lifestyle composition",
    "ad-banner": "leave intentional clean space on one side for the user's own advertising copy",
    lookbook: "create an editorial fashion frame with a natural full or three-quarter composition",
  }[goal];
}

function buildStorybookPagePrompt(request: Extract<GenerationRequest, { arenaId: "storybook-page" }>): string {
  const lines = [
    "Create one polished children's storybook page illustration.",
    `Scene and action: ${request.scene}.`,
    `Character direction: ${request.characterDescription || "Follow the supplied character reference exactly"}.`,
    `Art style: ${request.artStyle.replace("-", " ")}.`,
    `Lighting: ${lightingDirection(request.lighting)}.`,
    `Page composition: ${request.aspectRatio} aspect ratio, clear focal point, expressive storytelling, age-appropriate detail, and room for readable page content.`,
    "Keep every recurring character recognizable. Preserve face, hair, clothing colors, proportions, and signature features from the reference image.",
  ];

  if (request.pageText) {
    lines.push(`Include this exact page text in a calm, readable area: “${request.pageText}”. Do not change the wording.`);
  }

  if (request.extraDirection) {
    lines.push(`Extra direction: ${request.extraDirection}.`);
  }

  lines.push("Return one complete illustrated page only, without an explanation or book mockup.");
  return lines.join("\n");
}

function buildImageToSketchPrompt(request: Extract<GenerationRequest, { arenaId: "image-to-sketch" }>): string {
  const lines = [
    "Create one high-fidelity technical fashion sketch from the supplied image references.",
    "Use the uploaded images as the only design source. Image 1 is the primary source; if Image 2 is present, use it only as a zoomed detail view of the same design.",
    "Preserve the exact silhouette, proportions, neckline, seams, stitching, construction lines, motifs, and every visible design detail.",
    "If the source is a garment photograph, extract the garment construction into a clean technical flat sketch. If the source is already a rough sketch, clean and reconnect unclear lines only when the design is clearly visible.",
    `Canvas: ${request.aspectRatio} square composition, complete design centered with generous clean white margins.`,
    "Use solid black linework on a pure white canvas. Keep line weights clean, crisp, and suitable for a designer to inspect or print.",
    "Do not add color, gray shading, shadows, fabric texture, a model, mannequin, background, props, text, labels, watermarks, duplicate designs, invented details, cropping, or distortion.",
  ];

  if (request.prompt) {
    lines.push(`Optional user direction: ${request.prompt}. Follow it only when it does not conflict with preserving the supplied design.`);
  }

  lines.push("Return one finished sketch image only, without an explanation or mockup frame.");

  return lines.join("\n");
}

function lightingDirection(lighting: LightingOption): string {
  return {
    auto: "choose lighting that naturally supports the subject, setting, and requested mood",
    "soft-daylight": "soft natural daylight with gentle contrast and believable shadows",
    "studio-softbox": "controlled studio softbox lighting with clean highlights and soft shadows",
    "golden-hour": "warm golden-hour light with natural depth and flattering highlights",
    dramatic: "dramatic directional light with strong depth while keeping important details clear",
  }[lighting];
}
