export type PublishPropagationResult = {
  published: boolean;
  indexNowQueued: boolean;
};

export type PublishPropagationSummary = {
  published: number;
  indexNowQueued: number;
  indexNowFailed: number;
  indexNowStatus: "submitted" | "failed" | "skipped";
};

/**
 * Keep the publish-batch ledger honest when page publication and IndexNow
 * delivery have different outcomes. A successful page must not imply that
 * its discovery notification was accepted.
 */
export function summarizePublishPropagation(results: readonly PublishPropagationResult[]): PublishPropagationSummary {
  const published = results.filter((result) => result.published).length;
  const indexNowQueued = results.filter((result) => result.published && result.indexNowQueued).length;
  const indexNowFailed = published - indexNowQueued;
  return {
    published,
    indexNowQueued,
    indexNowFailed,
    indexNowStatus: published === 0 ? "skipped" : indexNowFailed > 0 ? "failed" : "submitted",
  };
}
