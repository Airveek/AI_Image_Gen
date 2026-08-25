# Kive Product Generation: Public-Evidence Research and Airveek Comparison

Date: 2026-08-26  
Scope: Kive’s product-image workflow and the current Airveek Product & Fashion creator flow  
Research depth: 36 targeted web queries, live product inspection already completed in the authenticated Kive Chrome session, repository inspection, and review of official Kive documentation/news plus primary image-generation research.

## 1. Executive conclusion

Kive’s quality does not appear to come from one unusually long prompt. Its public product shows a layered system:

1. It turns a product into reusable model state instead of treating the product as a disposable reference image on every request.
2. It turns lighting, camera, background, props, and composition into reusable Studio presets instead of asking users to describe all of them.
3. It keeps the user brief short and uses the product model, Studio, style reference, aspect ratio, and quality as structured generation inputs.
4. It stores prompts, settings, model configuration, versions, and history so successful work can be repeated.
5. It treats generation as a reviewable workflow: draft, inspect, edit, save, version, and only then reuse at scale.

Airveek currently has a good first layer of the UI and a good typed prompt foundation, but most of its quality controls are still expressed as text. The largest gap is not the composer. It is the absence of persistent product conditioning and reusable visual recipes.

The practical recommendation is not to copy Kive’s private prompts or assume its hidden model provider. Build the smallest equivalent control system:

- Product profile: one saved product with validated source images, a generated visual description, and category-specific facts.
- Studio recipe: one reusable typed recipe for background, lighting, camera/composition, palette, and intended channel.
- Prompt compiler: combine the product profile, Studio recipe, user brief, ratio, and role-labelled references into one provider request.
- Review loop: preserve the request snapshot, show the result, support retry/edit as a new version, and keep metadata.

## 2. Evidence boundaries

### Verified from Kive’s public product and documentation

- Kive supports product creation from a store URL, image URL, local file, or upload handle through its public MCP surface.
- Product models use 1–4 product images; Kive recommends sharp, high-resolution, simple-background inputs.
- Product models have Standard and Advanced modes. Kive says Advanced takes longer but integrates the product more deeply and supports new angles.
- Studios bundle lighting, camera angle, props, background, and composition. Studios can be remixed as modular blocks and saved for reuse.
- Kive’s documented prompt formula is `[Subject], [Context], [Style], [Lighting/Composition detail]`.
- Kive recommends short, clear prompts, positive descriptions, model references, and style references.
- Kive exposes generation inputs such as product/model, brief, Studio, aspect ratio, samples, mode, style image URLs, and an `estimateOnly` option through MCP.
- Generation is represented as a durable job in the MCP workflow: create/import, recommend Studios, generate, check status, then show the finished result.
- Kive stores prompts, settings, model configuration, and creation history for saved generated assets.
- Kive has non-destructive editing, new-version saving, image masking for targeted fixes, and a review step before publishing.
- Kive has batch/catalog generation with shared direction and per-shot overrides.

### Strongly implied, but not publicly confirmed

- Product creation likely produces an embedding, adapter, fine-tuned subject representation, or another reusable visual-conditioning artifact. The public “model training” workflow proves reusable state exists; it does not reveal the implementation.
- Studio selection likely compiles structured scene metadata into provider-specific instructions or conditioning. Kive’s public material does not expose the compiler or system prompt.
- Kive likely combines an image-understanding step with generation because it can generate prompts from uploaded images and recommend Studios for a product. The exact vision model and ranking logic are unknown.
- Kive likely performs some internal validation, retry, or routing around generation jobs, but public docs do not disclose the exact evaluator, seed policy, provider routing, or post-processing graph.

### Unknown and should not be invented

- Kive’s hidden system prompt.
- Its model provider, checkpoint, fine-tuning method, LoRA/adaptor design, control-net usage, seeds, sampling settings, or negative-prompt strategy.
- Whether product identity is preserved through fine-tuning, reference encoders, image editing, compositing, or a hybrid pipeline.
- Any private API, private source code, or private prompt templates.

## 3. Reconstructed Kive workflow

### Step A — Ingest and prepare the subject

Kive starts with a product object, not merely a prompt. The public workflow accepts product images or a product URL, names the product model, and waits for preparation. It recommends a clean, sharp, high-resolution source and warns that poor input quality causes poor product detail, including label text. For bags, jewellery, and other scale-sensitive products, it recommends at least one worn or held image.

This is important: Kive makes the product a reusable asset with a name and lifecycle before the user asks for a scene. The generation step can then refer to the model by name or select it from the asset UI.

Source: [Kive AI Product Shots guide](https://kive.ai/docs/guides/ai-product-shots), [Kive custom model guide](https://kive.ai/docs/creating-with-ai/train-a-custom-model), [Kive Product Shots announcement](https://kive.ai/news/introducing-product-shots).

### Step B — Select a reusable visual setup

Kive Studios are described as virtual photo sets. They bundle lighting, camera angles, props, backgrounds, and composition. The user selects a Studio, can remix individual blocks, and can save the result as a reusable Studio for the workspace.

The key product decision is that the user changes one visible creative block at a time. This gives non-technical users control without requiring them to know terms such as key light, focal length, negative space, or color grading.

Source: [Kive Studios guide](https://kive.ai/docs/guides/ai-studios), [Introducing Kive Studios](https://kive.ai/news/introducing-kive-studios).

### Step C — Add a short brief and typed references

Kive explicitly says to keep prompts short and clear. Its public formula is subject, context, style, and a lighting/composition hint. Models and style references are structured inputs, not just words in the prompt. Kive also supports generating a starting prompt from an uploaded photo and reusing a successful prompt from a prior image.

This means the user’s text is the creative delta, not the entire technical specification. A user can say “on warm stone with clean space on the left” while the product model and Studio carry identity, lighting, framing, and scene defaults.

Source: [Kive writing prompts guide](https://kive.ai/docs/creating-with-ai/writing-prompts), [Kive image generation guide](https://kive.ai/docs/creating-with-ai/generate-an-image).

### Step D — Compile and enqueue a generation job

Kive’s public MCP documentation exposes the clearest view of the orchestration layer. A product-image call is workspace-scoped and can receive a saved product, saved model, or brief, plus Studio, ratio, samples, mode, style-image URLs, and an estimate-only flag. The documented headless flow is:

`resolve workspace → import/create product → recommend Studios → generate product image → poll status → show result`

That is materially different from a single request that blocks until an image is returned. It supports background work, status polling, previews, and a clean place for cost estimation and retries.

Source: [Kive MCP overview](https://kive.ai/mcp), [Kive MCP tool reference](https://kive.ai/mcp/tools), [Kive Chat mode guide](https://kive.ai/docs/creating-with-ai/chat-mode).

### Step E — Review, edit, and preserve the winning version

Kive’s output does not end at the first render. Generated content first appears in drafts; users can inspect it, save it to a Library or board, reuse its prompt/settings, and edit it non-destructively. Kive’s editing documentation describes save-as-new-item and save-as-new-version behavior. For difficult logos or details, it supports a targeted crop/mask plus a close-up reference.

This is a quality mechanism, not only a convenience feature. It lets the system preserve a good result and make a narrow correction instead of asking the generator to recreate the whole scene from scratch.

Source: [Kive editing overview](https://kive.ai/docs/editing-tools/editing-tools-overview), [Kive general edit tool](https://kive.ai/docs/editing-tools/general-edit-tool), [Kive library and boards](https://kive.ai/docs/library-asset-management/library-and-boards).

### Step F — Scale only after a direction works

Kive’s bulk-generation announcement describes a review step before spending credits, one shared visual direction across many products, and per-shot customization for Studio and character. The product is therefore optimized for “approve one direction, then scale it,” rather than “generate many unrelated shots and hope one works.”

Source: [Kive Bulk Generate](https://kive.ai/news/bulk-generate-is-live).

## 4. What Kive is doing better than Airveek

| Area | Kive public behavior | Airveek today | Impact |
|---|---|---|---|
| Product identity | Reusable Product model created once from 1–4 images or a URL | Raw saved references are attached to each request | Kive has a persistent identity layer; Airveek asks the provider to rediscover identity every time |
| Visual direction | Reusable Studio with scene blocks | Flat Product settings: scene, goal, background mood, lighting | Airveek has fields, but no reusable visual recipe or one-click creative direction |
| Prompt burden | Short brief; Studio and model carry technical detail | Typed prompt builder supplies a strong fixed template, but the user still selects several enums | Airveek is safer than a blank prompt, but less reusable and less visual |
| Reference semantics | Named model references and style references | Numeric image labels plus typed roles | Airveek’s role labels are a good base, but no persistent model/profile semantics |
| Input preparation | URL import, input guidance, model preparation, category/scale advice | Upload and save asset; no product-specific quality gate or profile preparation | Bad source images can directly reduce Airveek output quality |
| Generation lifecycle | Durable job, status polling, background work, cost estimate | One request per variation; client waits on HTTP responses; partial failure/retry exists | Airveek works for a prototype but is less resilient for slow or large batches |
| Quality choices | Default/Premium/Max tied to resolution/model/cost | Fixed `1K` image configuration | Airveek has no explicit exploration/final-quality decision |
| Review loop | Drafts, metadata, boards, edit tools, new versions | Saved generation, viewer, download, retry | Airveek can preserve results but cannot yet make targeted corrections |
| Scale | Bulk catalog setup, shared direction, per-shot overrides | 1–3 identical request snapshots in parallel | Airveek’s batch count is useful, but it creates variations rather than a controlled campaign batch |
| Reuse | Saved prompts, settings, model configuration, Studios, boards | Request settings are persisted with generation assets | Airveek stores history, but does not yet make successful settings easy to reuse |
| Asset discovery | Natural-language and visual search, filters, boards | Right rail search/sort/groups in the creator flow | Airveek’s rail is now visually aligned, but its search remains basic asset filtering |

## 5. Airveek’s current strengths

Airveek is not starting from zero. The current implementation already has several correct foundations:

- `GenerationRequest` is a strict discriminated union.
- Product/reference roles are typed and validated.
- Product generation is blocked when a product reference is missing.
- The server loads owned reference bytes and sends them as inline image data.
- The server writes a generation asset before provider work, then marks it ready or failed.
- The prompt explicitly maps Image 1, Image 2, and role names to the attached images.
- Product prompts preserve shape, proportions, material, color, branding, labels, and garment construction.
- The client snapshots each request for batch items and uses `Promise.allSettled`, so successful images survive a partial failure.
- The parallel-generation migration removes the old single-processing-row restriction.
- The UI now has one image-only Kive-style composer, a compact 1x/2x/3x selector, selected reference chips, settings behind progressive disclosure, and a progressive asset rail.
- Prompt, settings, source asset IDs, provider kind, and provider model are persisted with generated assets.

These are strong prototype foundations. The quality gap is mostly the conditioning and iteration layer around the provider, not TypeScript strictness or the generate-button interaction.

## 6. Airveek prompt-engineering comparison

### What Airveek already does well

The current Product prompt has the right high-level sections:

- task/mode;
- scene;
- campaign goal;
- background/mood;
- lighting;
- aspect ratio/composition;
- product-preservation constraints;
- user direction;
- output contract.

The server-side reference manifest is also valuable. It tells the provider that attached images follow a numeric order, assigns each image a role, and warns against swapping roles. That is much safer than simply passing unlabeled images.

### What Kive’s public guidance suggests changing

1. Keep the user-facing brief short. Do not expose the full internal prompt or ask users to fill every photography parameter.
2. Move recurring visual direction from prose into a saved Studio recipe.
3. Move recurring product facts from prose into a Product profile/model.
4. Use positive, desired outcomes first. Keep only a small number of hard product-truth constraints. Kive publicly recommends positive prompting rather than long lists of negatives.
5. Let the system create a detailed starting description from an uploaded product image, then let the user edit it.
6. Make the generation request a structured object that the provider adapter compiles, rather than making one large free-form string the only source of truth.

### Recommended internal prompt shape for Airveek

This is a new Airveek structure, not a copy of a private Kive prompt:

```text
Task: Create one commercial product photograph.

Product identity:
- Use the supplied Product profile and Product reference as the source of truth.
- Preserve the exact silhouette, materials, colors, construction, logo, label, and visible details.

Creative direction:
- Studio recipe: {studio name}
- Environment: {background and props}
- Lighting: {direction, softness, color temperature}
- Camera/composition: {shot type, angle, focal relationship, negative space}
- Channel: {store listing, social post, ad banner, lookbook}

User brief:
{short user request}

Output:
- {aspect ratio}
- one finished image
- keep the product readable and commercially usable
```

The important change is not the exact words. It is that `Product profile` and `Studio recipe` are typed, reusable inputs that can be tested independently.

## 7. Likely quality stack behind Kive

The following is the most defensible reconstruction from public evidence:

```text
source photos / URL
        ↓
product ingest + visual understanding + named reusable model
        ↓
Studio recipe: lighting + camera + background + props + composition
        ↓
short user brief + role-labelled references + ratio + quality
        ↓
provider-specific generation job
        ↓
status + preview + human review
        ↓
targeted edit / new version / save metadata
        ↓
approved recipe reused across a batch or catalog
```

The model itself is only one part of this system. Product identity research supports the same conclusion: identity preservation is a separate technical problem from generic visual quality, and product-image evaluation should measure subject fidelity, text/OCR fidelity, and commercial usability rather than only “looks realistic.” See [AAAI’s product-image consistency evaluation](https://ojs.aaai.org/index.php/AAAI/article/view/32027), [ProductConsistency research](https://arxiv.org/abs/2606.19103), and the [WACV identity-preservation study](https://openaccess.thecvf.com/content/WACV2025/papers/He_A_Data_Perspective_on_Enhanced_Identity_Preservation_for_Diffusion_Personalization_WACV_2025_paper.pdf).

## 8. Prioritized improvement plan for Airveek

### P0 — Product profile and input quality gate

Build the smallest persistent product layer:

- product name and category;
- one primary source image plus optional supporting angles;
- image dimensions, MIME type, and basic sharpness/background checks;
- a generated or manually reviewed product description containing visible materials, colors, shape, construction, labels, and scale cues;
- a readiness state: `needs-review`, `ready`, or `needs-better-source`.

Do not begin with custom model training infrastructure. For the prototype, store the profile and use it to create a consistent reference manifest. Later, the provider adapter can replace the reference implementation with a trained model or reference encoder without changing the UI contract.

### P0 — Studio recipes

Add a small typed recipe table for Product & Fashion, for example:

- Clean commerce
- Soft editorial
- Warm lifestyle
- Premium dark studio

Each recipe should contain only the fields the provider needs: environment, lighting, camera/composition, props, palette, and channel intent. The user sees a card or menu; the provider receives the recipe. Allow one “custom direction” field for the user’s brief.

This gives Airveek Kive’s biggest advantage without building a visual drag-and-drop editor yet.

### P1 — Prompt compiler and provider adapter

Refactor `buildGenerationPrompt()` to compile a typed request containing:

- product profile ID;
- Studio recipe ID;
- user brief;
- ratio and channel;
- role-labelled references;
- output quality mode when the provider supports it.

Keep the current provider route stable. The request parser and database settings can accept the new fields behind optional, validated properties so existing saved requests continue to work.

### P1 — Minimal output review

Keep the current result viewer, then add only:

- “Use prompt/settings” to start another generation from the same snapshot;
- save as a new version rather than overwriting the original;
- a focused retry/edit action that targets one failure or one region;
- full-resolution inspection before download.

Do not build a full Kive-style board system for this prototype unless the product team explicitly needs collaboration in this use case.

### P1 — Async generation status

The existing client batch works for 1–3 prototype requests. If provider latency or server timeouts become a problem, move to a durable job record and polling model. Keep the current `GenerationRequest` as the job payload and return a job ID from the route. This is the right next step for background generation, not a new UI control.

### P2 — Product-specific evaluation

Before calling an image “ready,” evaluate the dimensions that matter:

- product present;
- product count correct;
- rough product similarity to the source;
- logo/label crop for OCR review;
- output ratio and resolution;
- no obvious duplicate or severe artifact.

Start with a human review checklist and logged failure reasons. Add automated scoring only after a small labeled set exists. This avoids over-engineering an evaluator with no calibration data.

### P2 — Batch by direction, not only by count

Keep 1x/2x/3x for user simplicity. Internally, a batch should eventually carry:

- one immutable Product profile;
- one immutable Studio recipe;
- a variation index/seed if the provider supports it;
- one request snapshot per image;
- a shared batch ID.

That makes future catalog generation possible without changing the current composer.

## 9. Simple before / after

### Before

The user chooses a product, fills several product-scene fields, writes a prompt, and sends raw references to a general image provider. Airveek’s server writes a strong instruction prompt, but the provider must infer the product identity and the visual direction again for every image.

### After

The user chooses a saved product, chooses a Studio card, writes one short direction, selects 1x/2x/3x, and generates. Airveek sends the provider a product profile, a reusable Studio recipe, the short user brief, and role-labelled references. The result is saved with its exact snapshot and can be reviewed, retried, edited as a new version, and reused.

## 10. What not to build yet

- Do not try to discover or reproduce Kive’s private system prompt.
- Do not claim to match Kive’s hidden model or training pipeline without provider evidence.
- Do not add video controls to this Airveek use case.
- Do not add quality tiers until Airveek has a real provider/credit difference to support them.
- Do not build a full agent, board collaboration system, visual Studio editor, or catalog bulk workflow in the prototype.
- Do not add a large negative-prompt library. Use typed constraints and a short positive brief.
- Do not build automated quality scoring before collecting real failure examples from Airveek users.

## 11. Research sources

Primary Kive sources:

- [Generate an image](https://kive.ai/docs/creating-with-ai/generate-an-image)
- [AI Product Shots](https://kive.ai/docs/guides/ai-product-shots)
- [Train a custom model](https://kive.ai/docs/creating-with-ai/train-a-custom-model)
- [Writing prompts](https://kive.ai/docs/creating-with-ai/writing-prompts)
- [AI Studios](https://kive.ai/docs/guides/ai-studios)
- [Introducing Kive Studios](https://kive.ai/news/introducing-kive-studios)
- [Introducing Kive Product Shots](https://kive.ai/news/introducing-product-shots)
- [AI Product Shots for Fashion](https://kive.ai/news/ai-product-shots-for-fashion-major-accuracy-upgrades)
- [Multi-Product Shots](https://kive.ai/news/introducing-multi-product-shots)
- [Bulk Generate](https://kive.ai/news/bulk-generate-is-live)
- [Chat mode](https://kive.ai/docs/creating-with-ai/chat-mode)
- [Kive MCP tools](https://kive.ai/mcp/tools)
- [Editing tools overview](https://kive.ai/docs/editing-tools/editing-tools-overview)
- [General edit tool](https://kive.ai/docs/editing-tools/general-edit-tool)
- [Upload assets](https://kive.ai/docs/library-asset-management/upload-assets)
- [Search your library](https://kive.ai/docs/library-asset-management/search-your-library)

Independent and primary technical sources:

- [AAAI: product-image background inpainting and product consistency](https://ojs.aaai.org/index.php/AAAI/article/view/32027)
- [ProductConsistency: product identity and OCR preservation](https://arxiv.org/abs/2606.19103)
- [WACV: data perspective on identity preservation](https://openaccess.thecvf.com/content/WACV2025/papers/He_A_Data_Perspective_on_Enhanced_Identity_Preservation_for_Diffusion_Personalization_WACV2025_paper.pdf)
- [DreamBooth: subject-driven generation](https://arxiv.org/abs/2208.12242)
- [OpenAI image prompting guidance](https://openai.com/academy/image-generation/)
- [Google Gemini image prompting guidance](https://blog.google/products-and-platforms/products/gemini/image-generation-prompting-tips/)
- [Google Imagen prompt guide](https://ai.google.dev/gemini-api/docs/imagen-prompt-guide)
- [Photoroom product-fidelity benchmark](https://www.photoroom.com/blog/top-editing-image-models-maintain-product-details-only-28-of-the-time)

## 12. Final assessment

Kive is best understood as a product-visual operating system, not only an image generator. Its advantage comes from remembering the product, remembering the look, and making the user review and reuse both. Airveek’s next quality improvement should therefore be a small product-profile plus Studio-recipe layer on top of the existing typed request and provider adapter. That is the simplest path to better fidelity, smoother progress, and more consistent images without copying unknown internals or overbuilding the prototype.
