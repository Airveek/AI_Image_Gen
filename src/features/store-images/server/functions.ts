import "server-only";

import { NonRetriableError } from "inngest";

import { inngest } from "@/features/store-images/server/inngest-client";
import {
  createRunItems,
  getItemForWorker,
  getRunForWorker,
  loadRunProducts,
  markStoreItemPublishFailed,
  publishStoreItemForWorker,
  setItemStatus,
  setRunStatus,
} from "@/features/store-images/server/runs";
import { isPermanentStoreClientError } from "@/features/store-images/server/store-client";
import { generateStoreProductImage } from "@/features/store-images/server/store-generation";

type RunEvent = { runId: string; userId: string };
type ItemEvent = { itemId: string; runId: string; userId: string };

export const dispatchStoreRun = inngest.createFunction(
  {
    id: "store-images-dispatch-run",
    triggers: [{ event: "store/run.requested" }],
    retries: 3,
    onFailure: async ({ event, step }) => {
      const payload = event.data.event.data as unknown as RunEvent;
      const run = await step.run("load-failed-run", () => getRunForWorker(payload.runId, payload.userId));
      if (run?.status !== "cancelled") {
        await step.run("mark-run-failed", () => setRunStatus(payload.runId, payload.userId, "failed"));
      }
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as RunEvent;
    const run = await step.run("load-run", () => getRunForWorker(payload.runId, payload.userId));
    if (!run || run.status === "cancelled") return;

    await step.run("mark-run-running", () => setRunStatus(payload.runId, payload.userId, "running"));

    const products = await step.run("load-store-products", () => loadRunProducts({
      selectionMode: run.selection_mode,
      selectedProductIds: run.selected_product_ids,
      search: run.search,
      status: run.status_filter,
    }));
    const itemIds = await step.run("create-run-items", () => createRunItems({
      runId: payload.runId,
      userId: payload.userId,
      products,
    }));
    await step.run("set-run-total", () => setRunStatus(payload.runId, payload.userId, "running", products.length));

    if (itemIds.length > 0) {
      await step.sendEvent(
        "queue-run-items",
        itemIds.map((itemId: string) => ({
          name: "store/item.requested" as const,
          data: { itemId, runId: payload.runId, userId: payload.userId },
        })),
      );
    } else {
      await step.run("complete-empty-run", () => setRunStatus(payload.runId, payload.userId, "completed", 0));
    }
  },
);

export const generateStoreItem = inngest.createFunction(
  {
    id: "store-images-generate-item",
    triggers: [{ event: "store/item.requested" }],
    retries: 3,
    concurrency: { limit: 3 },
    onFailure: async ({ event, step }) => {
      const payload = event.data.event.data as unknown as ItemEvent;
      const run = await step.run("load-failed-item-run", () => getRunForWorker(payload.runId, payload.userId));
      await step.run("mark-item-failed", () => setItemStatus({
        itemId: payload.itemId,
        userId: payload.userId,
        status: run?.status === "cancelled" ? "cancelled" : "failed",
        errorMessage: run?.status === "cancelled" ? "Run cancelled before generation completed." : "Image generation failed after several retries.",
      }));
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as ItemEvent;
    const item = await step.run("load-item", () => getItemForWorker(payload.itemId, payload.userId));
    if (!item || ["ready", "published", "cancelled"].includes(item.status)) return;
    if (!item.source_image_url) throw new Error("This product has no source image.");

    const run = await step.run("load-item-run", () => getRunForWorker(item.run_id, payload.userId));
    if (!run || run.status === "cancelled") {
      await step.run("mark-item-cancelled", () => setItemStatus({
        itemId: item.id,
        userId: payload.userId,
        status: "cancelled",
        errorMessage: "Run cancelled before generation.",
      }));
      return;
    }

    await step.run("mark-item-generating", () => setItemStatus({
      itemId: item.id,
      userId: payload.userId,
      status: "generating",
      errorMessage: null,
    }));

    const assetId = await step.run("generate-image", async () => {
      const asset = await generateStoreProductImage({
        userId: payload.userId,
        productName: item.product_name,
        sourceImageUrl: item.source_image_url as string,
        prompt: run.prompt,
        referenceAssetId: run.reference_asset_id,
      });
      return asset.id;
    });

    const latestRun = await step.run("check-run-before-ready", () => getRunForWorker(item.run_id, payload.userId));
    if (!latestRun || latestRun.status === "cancelled") {
      await step.run("mark-item-cancelled", () => setItemStatus({
        itemId: item.id,
        userId: payload.userId,
        status: "cancelled",
        generatedAssetId: assetId,
        errorMessage: "Run cancelled after generation.",
      }));
      return;
    }

    await step.run("mark-item-ready", () => setItemStatus({
      itemId: item.id,
      userId: payload.userId,
      status: "ready",
      generatedAssetId: assetId,
      errorMessage: null,
    }));
  },
);

export const publishStoreItem = inngest.createFunction(
  {
    id: "store-images-publish-item",
    triggers: [{ event: "store/item.publish.requested" }],
    retries: 3,
    concurrency: { limit: 10 },
    onFailure: async ({ event, step }) => {
      const payload = event.data.event.data as unknown as ItemEvent;
      await step.run("mark-publish-failed", () => markStoreItemPublishFailed(
        payload.itemId,
        payload.userId,
        "Publishing failed after several retries.",
      ));
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as ItemEvent;
    try {
      await step.run("publish-item", async () => {
        try {
          await publishStoreItemForWorker(payload.itemId, payload.userId, { markFailedOnError: false });
        } catch (error) {
          if (isPermanentStoreClientError(error)) {
            throw new NonRetriableError(error.message);
          }
          throw error;
        }
      });
    } catch (error) {
      await step.run("record-publish-error", () => markStoreItemPublishFailed(
        payload.itemId,
        payload.userId,
        error instanceof Error ? error.message : "Publishing failed after several retries.",
      ));
    }
  },
);

export const storeImageFunctions = [dispatchStoreRun, generateStoreItem, publishStoreItem];
