# Automated use-case recording handoff

Updated: 2026-08-24

## Simple explanation

Before, someone had to open Airveek, upload an image, fill the form, click Generate, record the screen, and collect every result by hand.

Now, one command performs that real workflow with Playwright. It records the browser and saves the original input, generated images, video, and a small manifest together. The output is raw material for clippers; it does not edit or publish videos.

## What was implemented

- `scripts/save-recording-auth.mjs` saves a reusable login session outside Git.
- `scripts/record-usecase.mjs` performs the configured creator workflow and records it.
- `recording/use-cases/*.json` contains the reusable inputs and field values.
- Stable `data-testid` hooks mark the creator workspace, upload input, loading state, generation-count selector, Generate button, batch results, and final images.
- `content-kits/` is ignored by Git and receives one timestamped folder per run.
- The personal Codex recording skill is installed in the local Codex skills directory.

## Current pilot use cases

| ID | Demonstration |
| --- | --- |
| `PRODUCT01` | Product reference to three visible image variations |
| `POD01` | One visual idea to a coordinated shirt, mug, and hoodie presentation |
| `TEXT01` | AI image with supplied exact marketing text |
| `GUIDED01` | Simple guided setup to a polished general image |
| `SKETCH01` | One uploaded fashion image to a clean black-line sketch |

## First-time setup

Start Airveek at its normal local URL:

```bash
pnpm dev
```

In another terminal, save the recording account login:

```bash
pnpm recording:auth
```

The browser waits until login reaches Dashboard, Create, or Library, then saves `.recording-auth/user.json`. This file contains sensitive browser state and must never be committed or shared.

For a fully automated login, provide credentials only through local environment variables:

```bash
RECORDING_EMAIL="user@example.com" RECORDING_PASSWORD="local-secret" pnpm recording:auth
```

## Record a content kit

```bash
pnpm record:usecase PRODUCT01
```

The runner performs this visible sequence:

```text
open configured creator route
→ upload prepared image
→ for Image to Sketch, optionally upload a second detail image through the visible Add image menu
→ fill/select the configured fields
→ choose the visible generation count and click the primary Generate icon
  → stay on the same creator page
  → wait for the visible Image 1, Image 2, and Image 3 cards
  → wait until each card says Saved to your library
→ save the visible result images as recording artifacts
→ close the recorded browser
→ save the content kit
```

Output example:

```text
content-kits/
└── PRODUCT01/
    └── 2026-08-24T10-30-00-000Z/
        ├── input.png
        ├── result-1.jpg
        ├── result-2.jpg
        ├── result-3.jpg
        ├── raw-demo.webm
        └── manifest.json
```

Use `RECORDING_BASE_URL` for another local/staging URL. Use `RECORDING_HEADED=1` to watch the browser. Set `variations` from one to three to select the number of independent images. The recorder selects that count in the visible menu, clicks Generate once, and waits for each saved result. Each image is a real generation request, so three variations consume three requests from the configured Gemini account pool. Keep the page open while they are running.

## Recorder rules

The recording must match the page shown to a viewer:

- Use visible labels, menus, buttons, and the existing stable test IDs. Do not use coordinate clicks or hidden form values.
- Never call the generation API directly, inject a hidden request, or navigate between results. The visible composer is the only way to start generation.
- Select the desired `1x`, `2x`, or `3x` option from the visible generation-count menu, click the primary Generate icon once, and wait on the same creator page for each visible result card. A result is complete only when its card is visible and says `Saved to your library`.
- For Image to Sketch, upload the prepared image through the visible picker, optionally choose `Add image` for a second detail view, then click the visible Generate icon and wait for the normal saved result on the same page.
- The request helper is used only after a visible result to copy that image into the content kit. It must never start generation or bypass the UI.
- If a visible step fails, stop and report the exact step. Do not substitute a mock image.

## Add another use case

Copy one file in `recording/use-cases/` and change only:

- its uppercase ID;
- creator route;
- repository-relative input image;
- optional `additionalInputs` image paths for a second visible reference upload;
- one to three variations for any current creator arena;
- the visible field labels, action (`fill` or `select`), and value.

Prefer accessible labels and the existing stable test IDs. Do not add coordinate-based clicking or visual guessing.

## Verification

After a run, verify:

- `raw-demo.webm` plays from start to finish;
- the uploaded input appears in the video;
- the loading state is visible rather than skipped;
- each `result-N` file opens as an image;
- `manifest.json` matches the config and recorded result names;
- no login state, cookies, or passwords appear in the kit.

The workflow follows Playwright's official guidance to reuse stored authentication state outside source control and to close the browser context before treating a recorded video as complete.

## Official references used

- [Gemini image generation and multiple reference images](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini image understanding and ordered multi-image prompts](https://ai.google.dev/gemini-api/docs/image-understanding)
- [OpenAI image inputs](https://platform.openai.com/docs/quickstart/make-your-first-api-request)
- [Playwright authentication state](https://playwright.dev/docs/auth)
- [Playwright recorded video](https://playwright.dev/docs/next/api/class-video)
