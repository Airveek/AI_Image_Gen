# Recording audio sync

The recorder writes `timeline.json` next to `raw-demo.webm`. The timeline uses
the real visible browser events, so narration does not depend on guessed pauses
or on how long Gemini takes to answer.

Create a `narration-segments.json` file in the content-kit directory:

```json
[
  { "event": "workspace_ready", "file": "audio/01-intro.mp3" },
  { "event": "reference_selected", "index": 1, "file": "audio/02-upload.mp3" },
  { "event": "photoshoot_started", "file": "audio/03-create.mp3" },
  { "event": "shot_ready", "shot": "hero", "file": "audio/04-hero.mp3" },
  { "event": "shot_ready", "shot": "lifestyle", "file": "audio/05-lifestyle.mp3" },
  { "event": "shot_ready", "shot": "on-model", "file": "audio/06-on-model.mp3" }
]
```

Generate each short voice segment with ElevenLabs, then run:

```bash
pnpm render:recording content-kits/PRODUCT01/<run-id>
```

The command places each segment at its real timeline event, keeps the optional
`music-loop.mp3` underneath, and creates both `tutorial-16x9.mp4` and
`tutorial-9x16.mp4`. It also writes `sync-manifest.json` so every audio cue can
be checked later.
