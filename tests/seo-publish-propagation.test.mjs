import test from "node:test";
import assert from "node:assert/strict";

import { summarizePublishPropagation } from "../src/features/seo/server/publish-propagation.ts";

test("publish propagation distinguishes successful IndexNow delivery from page publication", () => {
  assert.deepEqual(summarizePublishPropagation([
    { published: true, indexNowQueued: true },
    { published: true, indexNowQueued: false },
    { published: false, indexNowQueued: false },
  ]), {
    published: 2,
    indexNowQueued: 1,
    indexNowFailed: 1,
    indexNowStatus: "failed",
  });
});

test("publish propagation skips IndexNow when no page became live", () => {
  assert.deepEqual(summarizePublishPropagation([
    { published: false, indexNowQueued: false },
  ]), {
    published: 0,
    indexNowQueued: 0,
    indexNowFailed: 0,
    indexNowStatus: "skipped",
  });
});
