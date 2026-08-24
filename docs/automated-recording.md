# Automated use-case recording handoff

Updated: 2026-08-24

## Simple explanation

Before, someone had to open Artistly, upload an image, fill the form, click Generate, record the screen, and collect every result by hand.

Now, one command performs that real workflow with Playwright. It records the browser and saves the original input, generated images, video, and a small manifest together. The output is raw material for clippers; it does not edit or publish videos.

## What was implemented

- `scripts/save-recording-auth.mjs` saves a reusable login session outside Git.
- `scripts/record-usecase.mjs` performs the configured creator workflow and records it.
- `recording/use-cases/*.json` contains the reusable inputs and field values.
- Stable `data-testid` hooks mark the creator workspace, upload input, loading state, Generate button, and final image.
- `content-kits/` is ignored by Git and receives one timestamped folder per run.
- The personal Codex skill is installed at `~/.codex/skills/artistly-usecase-recording`.

## Current pilot use cases

| ID | Demonstration |
| --- | --- |
| `PRODUCT01` | Plain product reference to premium studio advertisement |
| `POD01` | One visual idea to a coordinated shirt, mug, and hoodie presentation |
| `TEXT01` | AI image with supplied exact marketing text |
| `GUIDED01` | Simple guided setup to a polished general image |

## First-time setup

Start Artistly at its normal local URL:

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

The runner performs this sequence:

```text
open configured creator route
→ upload prepared image
→ fill/select the configured fields
→ click Generate
→ wait for the real result
→ save each result image
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
        ├── raw-demo.webm
        └── manifest.json
```

Use `RECORDING_BASE_URL` for another local/staging URL. Use `RECORDING_HEADED=1` to watch the browser. Every variation is a real generation, so it consumes one request from the configured Gemini account pool. The four pilot configs use one variation each so they also work with the default one-request-per-60-seconds setting and a single ready account.

## Add another use case

Copy one file in `recording/use-cases/` and change only:

- its uppercase ID;
- creator route;
- repository-relative input image;
- one to three variations;
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
