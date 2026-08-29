import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectDirectory = path.resolve(process.cwd());
const graphPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const outputPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-script-briefs-v1.json");
const graph = JSON.parse(await readFile(graphPath, "utf8"));

const briefs = (graph.opportunities ?? []).map((opportunity) => {
  const jobs = opportunity.imageJobs ?? [];
  const jobList = jobs.map((job) => job.replaceAll("listing", "shop picture")).join(", ");
  return {
    opportunityId: opportunity.id,
    category: opportunity.category,
    format: "16x9 horizontal product demo",
    audience: "A non-technical shop owner who wants a clear answer and a useful result.",
    viewerPromise: `By the end, you will know whether these three ${opportunity.category} pictures answer the buyer's main question: ${lowerFirst(opportunity.buyerQuestion)}`,
    script: [
      {
        beat: "hook",
        line: `${opportunity.hook} Stay until the end and use the three-question check on your own product.`,
        visual: "Open on the finished three-image result set; hold long enough to see the difference between the images.",
      },
      {
        beat: "buyer-question",
        line: `Before making anything, ask: ${opportunity.buyerQuestion}`,
        visual: "Show the blank workspace and the product reference.",
      },
      {
        beat: "setup",
        line: `We will make three pictures for three jobs: ${jobList}. Keep the exact product the same in every picture.`,
        visual: "Choose the product-photo mode, show the reference, and fill the category prompt.",
      },
      {
        beat: "first-proof",
        line: `First, make the clear shop picture. The product must be easy to find in one second.`,
        visual: "Start creation; show the product clearly when the first result appears.",
      },
      {
        beat: "practical-check",
        line: `${opportunity.practicalLesson} If this detail is hidden, the picture is not ready yet.`,
        visual: "During generation, keep the relevant product detail centered and visible; show it in the result.",
      },
      {
        beat: "second-proof",
        line: `Next, give the ${opportunity.category} a setting that helps people picture using it. The setting should support the product, not cover it.`,
        visual: "Show the lifestyle result and compare it with the clear shop picture.",
      },
      {
        beat: "third-proof",
        line: `Last, make the close view answer the detail question. More decoration will not fix a detail that cannot be seen.`,
        visual: "Show the detail result at a readable size and keep the product in the center-safe area.",
      },
      {
        beat: "scorecard",
        line: "Now check three things: Is the product clear? Does the setting help? Does each picture have a different job?",
        visual: "Pause on all three results and point the viewer back to the opening question.",
      },
      {
        beat: "payoff",
        line: `If the answer is yes, the set is ready for review. If not, change the scene—not the product—and try again.`,
        visual: "End on the three results with the Airveek logo visible and the practical rule on screen.",
      },
    ],
    researchInputs: {
      buyerQuestion: opportunity.buyerQuestion,
      imageJobs: jobs,
      practicalLesson: opportunity.practicalLesson,
      proofPlan: opportunity.proofPlan,
      source: "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json",
    },
  };
});

await writeFile(outputPath, `${JSON.stringify({
  version: 1,
  brand: "Airveek",
  generatedAt: new Date().toISOString(),
  rule: "This is a planning script. Final narration is compiled again against the actual recording timeline before ElevenLabs generation.",
  briefs,
}, null, 2)}\n`);
console.log(`Generated ${briefs.length} category-specific script briefs at ${path.relative(projectDirectory, outputPath)}.`);

function lowerFirst(value) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}
