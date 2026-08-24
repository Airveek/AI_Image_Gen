import type { GenerationRequest, LightingOption } from "@/features/creator/types";

export function buildGenerationPrompt(request: GenerationRequest): string {
  switch (request.arenaId) {
    case "general-image":
      return buildGeneralImagePrompt(request);
    case "product-fashion":
      return buildProductFashionPrompt(request);
    case "storybook-page":
      return buildStorybookPagePrompt(request);
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

function buildProductFashionPrompt(request: Extract<GenerationRequest, { arenaId: "product-fashion" }>): string {
  const modeDirection = {
    "product-scene": "Create a high-end product photograph where the supplied product is the clear hero.",
    "on-model": "Create a high-end fashion photograph with the supplied garment or product worn naturally by a model.",
    "influencer-lifestyle": "Create a believable influencer-style lifestyle campaign photograph using the supplied product.",
  }[request.mode];

  const lines = [
    modeDirection,
    `Scene direction: ${request.scene.replace("-", " ")}.`,
    `Background and mood: ${request.backgroundMood || "clean, premium, commercially useful"}.`,
    `Lighting: ${lightingDirection(request.lighting)}.`,
    `Composition: ${request.aspectRatio} aspect ratio, realistic perspective, natural shadows, controlled highlights, premium campaign finish.`,
    "Preserve the exact product shape, proportions, colors, logo, label, material, garment construction, and important identifying details from the references.",
    "Do not invent extra logos, alter packaging text, deform the product, or add duplicate products unless explicitly requested.",
  ];

  if (request.extraDirection) {
    lines.push(`Extra direction: ${request.extraDirection}.`);
  }

  lines.push("Return one finished photograph only, without an explanation or contact sheet.");
  return lines.join("\n");
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

function lightingDirection(lighting: LightingOption): string {
  return {
    auto: "choose lighting that naturally supports the subject, setting, and requested mood",
    "soft-daylight": "soft natural daylight with gentle contrast and believable shadows",
    "studio-softbox": "controlled studio softbox lighting with clean highlights and soft shadows",
    "golden-hour": "warm golden-hour light with natural depth and flattering highlights",
    dramatic: "dramatic directional light with strong depth while keeping important details clear",
  }[lighting];
}
