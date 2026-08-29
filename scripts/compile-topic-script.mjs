import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const kitDirectory = path.resolve(process.argv[2] ?? "");
const product = (process.argv[3] ?? "product").trim();
if (!kitDirectory || !product) throw new Error("Run: node scripts/compile-topic-script.mjs <kit-directory> <product-name>");

const timeline = JSON.parse(await readFile(path.join(kitDirectory, "timeline.json"), "utf8"));
if (!Array.isArray(timeline.events)) throw new Error("timeline.json must contain events.");

const events = timeline.events;
const at = (name, predicate = () => true, fromEnd = false) => {
  const candidates = fromEnd ? [...events].reverse() : events;
  const match = candidates.find((event) => event.name === name && predicate(event));
  if (!match) throw new Error(`Missing timeline event: ${name}`);
  return Number(match.atMs);
};
const ready = (index) => at("generation_ready", (event) => event.index === index, true);
const started = (index) => at("generation_started", (event) => event.index === index, true);
const field = (label) => at("field_completed", (event) => event.label === label);

const configuredVariations = await getConfiguredVariations(1);
const oneImageMode = configuredVariations === 1 || events.filter((event) => event.name === "generation_started").length === 1;
const generationStart = started(1);
const firstReady = ready(1);
const secondStart = oneImageMode ? null : started(2);
const secondReady = oneImageMode ? null : ready(2);
const finalStart = oneImageMode ? generationStart : started(3);
const finalReady = oneImageMode ? firstReady : ready(3);
const advice = await getAdvice(product);
const productRule = compactRule(advice.rule);
const imageJob = advice.imageJobs?.[1] ?? "a real-use scene";
const buyerUseQuestion = compactRule(advice.useQuestion);
const proofPlan = compactRule(advice.proofPlan);

const segment = (event, sourceStartMs, text, strategyRole, promiseId, visualProof, extra = {}) => ({
  event,
  sourceStartMs,
  text,
  strategyRole,
  promiseId,
  visualProof,
  ...extra,
});

const waitTips = (startMs, readyMs, index, tips, promiseId, visualProof) => {
  // Generation time changes from run to run. Fill only the real wait window so
  // the voice never leaves a long silent hole or talks after the next screen state.
  const usableWindowMs = readyMs - startMs - 4500;
  const result = [];
  if (usableWindowMs < 9000) return result;
  const finalTipOffsetMs = Math.max(9000, usableWindowMs - 1000);
  // Keep practical tips on a predictable five-second beat. The generated
  // clips are short enough to leave a small breath, while avoiding the
  // alternating four/six-second gaps that made the spinner feel abandoned.
  const tipOffsets = [];
  for (let offsetMs = 5000; offsetMs < finalTipOffsetMs; offsetMs += 5000) tipOffsets.push(offsetMs);
  for (const [tipIndex, offsetMs] of tipOffsets.entries()) {
    result.push(segment(
      "generation_started",
      startMs + offsetMs,
      tips[tipIndex % tips.length],
      "practical wait tip",
      promiseId,
      visualProof,
      { index, offsetMs },
    ));
  }
  const lastOffsetMs = result.length ? result[result.length - 1].offsetMs : 0;
  if (finalTipOffsetMs - lastOffsetMs > 2500) {
    result.push(segment(
      "generation_started",
      startMs + finalTipOffsetMs,
      tips[result.length % tips.length],
      "practical wait tip",
      promiseId,
      visualProof,
      { index, offsetMs: finalTipOffsetMs },
    ));
  }
  return result;
};

const rawSegments = oneImageMode ? [
  segment("generation_ready", finalReady, `${advice.hook} In this video, I will show the fast check before you use the image in your store.`, "opening proof and promise", "TOPIC-P1", "The finished product image is visible in the cold open", { index: 1, renderStartMs: 0 }),
  segment("workspace_ready", at("workspace_ready"), `A buyer asks: ${advice.question} Keep that question in mind while we test this one image.`, "simple buyer question", "TOPIC-P1", "The product-photo workspace is visible"),
  segment("field_completed", field("Mode") + 250, `Choose one job: ${imageJob}. Keep the ${product} easy to see.`, "action explanation", "TOPIC-P2", "The product-photo choices are selected", { label: "Mode" }),
  segment("field_completed", field("Describe the image you want"), `Keep the ${product} unchanged. Add a scene that shows ${buyerUseQuestion}.`, "prompt advice", "TOPIC-P2", "The topic-specific prompt is filled on screen", { label: "Describe the image you want" }),
  segment("generation_started", generationStart, `Click Create. We are testing this: ${proofPlan}`, "generation start and test", "TOPIC-P3", "The single-image creation starts", { index: 1 }),
  ...waitTips(generationStart, firstReady, 1, [
    `First, find the ${product} before you notice the background.`,
    productRule,
    `Ask: does this scene show ${buyerUseQuestion} without hiding the product?`,
    `Check it small. Can you still see the ${product} and its important detail?`,
    "Reject extra products, warped details, or made-up words on the label.",
  ], "TOPIC-P3", "The single image is still being created"),
  segment("generation_ready", firstReady, `It is ready. Shrink it to a thumbnail. Can you judge ${buyerUseQuestion}? If not, reject the image.`, "result test and payoff", "TOPIC-P3", "The single result is ready", { index: 1 }),
] : [
  segment("generation_ready", finalReady, `${advice.hook} We will make three useful pictures and check them before we finish.`, "opening proof and promise", "TOPIC-P1", "The completed three-image result set is visible in the cold open", { index: 3, renderStartMs: 0 }),
  segment("workspace_ready", at("workspace_ready"), `Use three checks. Can you see the ${product} quickly? Does the background help? Does each photo have a different job? For this product, remember: ${advice.rule}`, "simple viewer scorecard", "TOPIC-P1", "The product-photo workspace is visible"),
  segment("field_completed", field("Mode") + 250, `Choose the job first. Keep the ${product} clear. Set the place. Choose Shop listing.`, "action explanation", "TOPIC-P2", "The product-photo choices are selected", { label: "Mode" }),
  segment("field_completed", field("Describe the image you want"), `Describe the scene. Keep the exact ${product}. Add this useful rule: ${advice.rule}`, "prompt advice", "TOPIC-P2", "The topic-specific prompt is filled on screen", { label: "Describe the image you want" }),
  segment("generation_started", generationStart, `Click Create. The first test is simple: can the ${product} stay easy to see?`, "generation start and test", "TOPIC-P3", "The three-image creation starts", { index: 1 }),
  ...waitTips(generationStart, firstReady, 1, [
    `First, check the image small. If the ${product} disappears, the background is too busy.`,
    `Next, keep the ${product} the same. Change the place around it.`,
    `Write what to add and what must not change. That protects the ${product}.`,
    "One image, one job. Do not make every picture look the same.",
    `For this product, remember: ${advice.rule} If that detail is hidden, the picture cannot answer the buyer.`,
  ], "TOPIC-P3", "The first image is still being created"),
  segment("generation_ready", firstReady, `The first ${product} picture is ready. It passes the shop test.`, "first result payoff", "TOPIC-P3", "The first result is ready", { index: 1 }),
  segment("generation_started", secondStart, `The first picture is saved. Now the next ${product} picture needs a place to live.`, "next-test setup", "TOPIC-P4", "The first result is saved and the second image starts", { index: 2 }),
  ...waitTips(secondStart, secondReady, 2, [
    `While it works, ask this: does the scene help people imagine using the ${product}?`,
    `If the scene steals your eyes, it is doing too much. Keep the ${product} easy to find.`,
    `A useful scene answers one question: ${advice.useQuestion}`,
  ], "TOPIC-P4", "The second image is being created"),
  segment("generation_ready", secondReady, `The scene passes. The ${product} stays clear.`, "second result payoff", "TOPIC-P4", "The second result is ready", { index: 2 }),
  segment("generation_started", finalStart, `Now the last picture gets a stronger setting. The scene must not hide the ${product}.`, "final test setup", "TOPIC-P5", "The final image starts creating", { index: 3 }),
  ...waitTips(finalStart, finalReady, 3, [
    `Save this rule: keep the ${product} the same, and change the story around it.`,
    "Compare the three pictures. Shop is for seeing. Social is for imagining. The ad is for remembering.",
    "If two pictures do the same job, remove one. More pictures do not always mean more help.",
    `Look at the words too. Say what to add and what to protect on the ${product}.`,
    "Before you finish, ask three questions: Is it clear? Is the scene helpful? Can a buyer see the important detail clearly?",
  ], "TOPIC-P5", "The final image is being created"),
  segment("generation_ready", finalReady, `The set is ready. The first ${product} picture is for the shop. The second is for social. The third is for the ad. One ${product}, three useful pictures. Give each picture one job.`, "final scorecard verdict and transfer", "TOPIC-P5", "All three results are ready and visible", { index: 3 }),
] ;

const script = rawSegments.map((item, index) => ({
  ...item,
  file: `audio/v2-${String(index + 1).padStart(2, "0")}-${slug(item.text)}.mp3`,
}));

await writeFile(path.join(kitDirectory, "narration-script.json"), `${JSON.stringify(script, null, 2)}\n`);
console.log(`Compiled ${script.length} dynamically timed, timeline-anchored segments for ${product}.`);

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "segment";
}

async function getAdvice(name) {
  const fallback = {
    question: "can I understand the product in one glance",
    rule: "Keep the main product detail easy to see.",
    useQuestion: "where I would use this",
    hook: "A pretty product photo can still lose the sale if it hides the answer.",
    imageJobs: ["clear listing", "real-use scene", "detail close-up"],
    proofPlan: "Show the product clearly, then show it in use, then check the key detail.",
  };
  try {
    const graphPath = path.resolve(process.cwd(), "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
    const graph = JSON.parse(await readFile(graphPath, "utf8"));
    const value = name.toLowerCase();
    const match = graph.opportunities?.find((item) => item.category.toLowerCase() === value || value.includes(item.category.toLowerCase()) || item.category.toLowerCase().includes(value));
    if (!match) return fallback;
    return {
      question: lowerFirst(match.buyerQuestion).replace(/[?]$/, ""),
      rule: match.practicalLesson,
      useQuestion: lowerFirst(match.buyerQuestion).replace(/[?]$/, ""),
      hook: match.hook,
      imageJobs: match.imageJobs,
      proofPlan: match.proofPlan,
    };
  } catch {
    return fallback;
  }
}

async function getConfiguredVariations(fallback) {
  try {
    const manifest = JSON.parse(await readFile(path.join(kitDirectory, "manifest.json"), "utf8"));
    return Number.isInteger(manifest.variations) && manifest.variations >= 1 ? manifest.variations : fallback;
  } catch {
    return fallback;
  }
}

function compactRule(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const firstSentence = text.split(/[.!?]/, 1)[0].trim();
  const firstClause = firstSentence.split(";", 1)[0].trim();
  if (firstClause.length <= 56) return firstClause;
  return `${firstClause.slice(0, 53).replace(/[,:;\- ]+$/, "")}…`;
}

function lowerFirst(value) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}
