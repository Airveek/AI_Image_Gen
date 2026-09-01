# Kit promotion contract

Local recordings stay private until a human has reviewed the pixels and made an
explicit rights decision. The promotion command is the only supported bridge
to durable public media.

Create a rights file next to the kit (do not commit it if it contains private
details):

```json
{
  "approvedForPublic": true,
  "rightsStatus": "approved",
  "evidenceId": "rights-2026-08-30-shoe-001",
  "reviewer": "editor@example.com",
  "reviewedAt": "2026-08-30T00:00:00.000Z",
  "provenance": "user-supplied source; Airveek-generated derivatives",
  "logoPolicy": "marketplace_restricted"
}
```

Create a media map with a role, factual alt text, and caption for every asset:

```json
{
  "assets": [
    { "file": "input.png", "role": "source", "assetId": "shoe-source", "alt": "Neutral running shoe source reference", "caption": "Rights-cleared source reference", "qaStatus": "pass" },
    { "file": "result-1.jpg", "role": "selected", "assetId": "shoe-listing-output", "alt": "Running shoe on a clean commercial background", "caption": "Selected listing output", "qaStatus": "pass" }
  ]
}
```

Run a dry check first:

```bash
pnpm seo:promote-kit content-kits/ECO03/<timestamp> rights.json media-map.json
```

Only after the report is correct, use `--apply`. The command computes real
SHA-256 checksums and image dimensions, derives stable HTTPS URLs under
`/images/airveek/seo/`, refuses different-byte overwrites, and writes a
`public-assets.json` sidecar. The sidecar is still not a page draft: the
listing/lifestyle/detail generation records, sources, links, author, reviewer,
and 85-point validator must pass before `seo:ingest-draft`.
