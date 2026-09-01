import "server-only";

import { signAgentPayload } from "@/features/seo/server/agent-signature";
import { absoluteUrl } from "@/lib/seo/site";

export { sha256Hex, signAgentPayload, verifyAgentCallbackSignature } from "@/features/seo/server/agent-signature";

export type SeoAgentBrief = {
  id: string;
  briefKey: string;
  topicId: string;
  pageFamily: string;
  productEntity: string;
  primaryQuery: string;
  normalizedIntentKey: string;
  buyerQuestion: string;
  locale: string;
  templateVersion: string;
  priority: number;
  dueAt: string | null;
  brief: Record<string, unknown>;
  demandEvidence: unknown[];
  /**
   * Bounded, reusable query evidence for this handoff. This is deliberately
   * an evidence packet (not a keyword list): the writer can see which source
   * and date support a demand signal without receiving an unbounded export of
   * the measurement tables.
   */
  keywordEvidence: Array<{
    source: string;
    query: string;
    canonicalUrl: string;
    metricDate: string;
    country: string;
    device: string;
    searchType: string;
    clicks: number;
    impressions: number;
    ctr: number | null;
    position: number | null;
    volume: number | null;
    competition: number | null;
    sourceUrl: string | null;
    sourceTitle: string | null;
    confidence: number;
    metadata: Record<string, unknown>;
  }>;
  assignmentId: string;
  assigneeId: string;
};

export type SeoAgentEnvelope = {
  type: "seo.content.brief";
  version: 1;
  dispatchId: string;
  dispatchKey: string;
  createdAt: string;
  brief: SeoAgentBrief;
  contract: {
    callbackPath: string;
    callbackUrl: string;
    publishes: false;
    requires: string[];
  };
};

export type AgentPostResult = {
  accepted: boolean;
  status: number;
  externalRunId: string | null;
  metadata: Record<string, unknown>;
};

export function buildSeoAgentEnvelope(input: {
  dispatchId: string;
  dispatchKey: string;
  brief: SeoAgentBrief;
  callbackPath?: string;
}): SeoAgentEnvelope {
  const callbackPath = input.callbackPath ?? "/api/seo/agent/callback";
  return {
    type: "seo.content.brief",
    version: 1,
    dispatchId: input.dispatchId,
    dispatchKey: input.dispatchKey,
    createdAt: new Date().toISOString(),
    brief: input.brief,
    contract: {
      callbackPath,
      callbackUrl: absoluteUrl(callbackPath),
      publishes: false,
      requires: [
        "product_specific_reader_first_content",
        "structured_page_draft_with_useful_media_when_available",
        "passing_page_contract_qa",
      ],
    },
  };
}

export async function postSeoAgentEnvelope(envelope: SeoAgentEnvelope): Promise<AgentPostResult> {
  const endpoint = process.env.SEO_CONTENT_AGENT_WEBHOOK_URL?.trim();
  const secret = process.env.SEO_CONTENT_AGENT_SIGNING_SECRET?.trim();
  if (!endpoint || !secret) throw new Error("SEO content agent webhook is not configured.");
  if (!isSafeAgentEndpoint(endpoint)) throw new Error("SEO content agent webhook must use HTTPS (localhost is allowed for development).");

  const rawBody = JSON.stringify(envelope);
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "airveek-seo-agent-dispatch/1",
      "x-airveek-agent-timestamp": timestamp,
      "x-airveek-agent-signature": signAgentPayload(rawBody, timestamp, secret),
      "x-airveek-agent-dispatch-id": envelope.dispatchId,
    },
    body: rawBody,
    signal: AbortSignal.timeout(15_000),
  });

  const text = (await response.text()).slice(0, 16_000);
  let parsed: Record<string, unknown> = {};
  try {
    const candidate: unknown = JSON.parse(text);
    if (isRecord(candidate)) parsed = candidate;
  } catch {
    // The response is retained as a bounded diagnostic below; acceptance
    // still requires a JSON `accepted: true` response.
  }
  const accepted = response.ok && parsed.accepted === true;
  return {
    accepted,
    status: response.status,
    externalRunId: typeof parsed.externalRunId === "string" ? parsed.externalRunId.slice(0, 240) : null,
    metadata: {
      status: response.status,
      response: parsed,
      responseText: text && Object.keys(parsed).length === 0 ? text : undefined,
    },
  };
}

function isSafeAgentEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
