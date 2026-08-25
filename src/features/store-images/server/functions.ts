import "server-only";

import { inngest } from "@/features/store-images/server/inngest-client";
import {
  createRunItems,
  getItemForWorker,
  getRunForWorker,
  publishStoreItemForWorker,
  setItemStatus,
  setRunStatus,
} from "@/features/store-images/server/runs";
import { listStoreProducts } from "@/features/store-images/server/store-client";
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
      await step.run("mark-run-failed", () => setRunStatus(payload.runId, payload.userId, "failed"));
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as RunEvent;
    await step.run("mark-run-running", () => setRunStatus(payload.runId, payload.userId, "running"));

    const run = await step.run("load-run", () => getRunForWorker(payload.runId, payload.userId));
    if (!run) throw new Error("The bulk run no longer exists.");

    const products = await step.run("load-store-products", () => loadRunProducts(run));
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
      await step.run("mark-item-failed", () => setItemStatus({
        itemId: payload.itemId,
        userId: payload.userId,
        status: "failed",
        errorMessage: "Image generation failed after several retries.",
      }));
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as ItemEvent;
    const item = await step.run("load-item", () => getItemForWorker(payload.itemId, payload.userId));
    if (!item || item.status === "ready" || item.status === "published") return;
    if (!item.source_image_url) throw new Error("This product has no source image.");

    await step.run("mark-item-generating", () => setItemStatus({
      itemId: item.id,
      userId: payload.userId,
      status: "generating",
      errorMessage: null,
    }));

    const assetId = await step.run("generate-image", async () => {
      const run = await getRunForWorker(item.run_id, payload.userId);
      const asset = await generateStoreProductImage({
        userId: payload.userId,
        productName: item.product_name,
        sourceImageUrl: item.source_image_url as string,
        prompt: run?.prompt ?? "Create a clean product listing image.",
      });
      return asset.id;
    });

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
    concurrency: { limit: 3 },
    onFailure: async ({ event, step }) => {
      const payload = event.data.event.data as unknown as ItemEvent;
      await step.run("mark-publish-failed", () => setItemStatus({
        itemId: payload.itemId,
        userId: payload.userId,
        status: "failed",
        errorMessage: "Publishing failed after several retries.",
      }));
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as ItemEvent;
    await step.run("publish-item", () => publishStoreItemForWorker(payload.itemId, payload.userId));
  },
);

async function loadRunProducts(run: {
  selection_mode: "selected" | "all";
  selected_product_ids: string[];
  search: string;
  status_filter: "active" | "draft" | "archived";
}) {
  const selected = new Set(run.selected_product_ids);
  const products = [];
  let cursor: string | null = null;

  for (let page = 0; page < 500; page += 1) {
    const result = await listStoreProducts({
      cursor,
      limit: 100,
      search: run.search,
      status: run.status_filter,
    });
    products.push(...result.products.filter((product) => run.selection_mode === "all" || selected.has(product.id)));
    cursor = result.nextCursor;
    if (!cursor) break;
  }

  return products;
}

export const storeImageFunctions = [dispatchStoreRun, generateStoreItem, publishStoreItem];
