import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const graph = JSON.parse(await readFile(path.join(root, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json"), "utf8"));

const directions = {
  "ECO01": ["lifestyle", "social-post", "warm ivory stone beside clear water with one soft botanical leaf in the background and gentle window light", "bottle, black dropper, amber glass, and blank label"],
  "ECO02": ["lifestyle", "social-post", "a bright, calm kitchen counter with a fresh cup of coffee, a few coffee beans, and soft morning window light", "whole machine, carafe, water level, and control panel"],
  "ECO03": ["outdoor", "social-post", "a clean urban morning running path with textured ground and low directional light", "side shape, heel, true color, and sole edge"],
  "ECO04": ["lifestyle", "social-post", "a warm entryway console with a folded neutral scarf and soft daylight, kept sparse and premium", "bag silhouette, strap, opening, and believable scale"],
  "ECO05": ["lifestyle", "social-post", "a dark walnut or charcoal stone surface with one soft highlight and a quiet premium watch setting", "readable dial, hands, case edge, crown, and finish without glare"],
  "ECO06": ["outdoor", "social-post", "a bright terrace beside pale stone with a soft sky reflection and one restrained shadow", "full frame shape, lens color, bridge, and hinge edge"],
  "ECO07": ["lifestyle", "social-post", "a tidy work desk with a notebook and a drink nearby, warm natural light, and enough room around the product", "body size, lid, handle, and drinking opening"],
  "ECO08": ["lifestyle", "social-post", "a minimal travel desk or charging station with a soft cool highlight and no visual clutter", "charging case, both earbuds, fit shape, and control surface"],
  "ECO09": ["lifestyle", "social-post", "a clean desk beside a window with the phone installed in the case and one subtle everyday object for scale", "exact phone fit, camera cutout, buttons, ports, and edge thickness"],
  "ECO10": ["lifestyle", "social-post", "a calm late-afternoon desk scene where the lamp casts a believable pool of light on the work surface", "full base, stem, hinge, shade, and control"],
  "ECO11": ["lifestyle", "social-post", "a bright home stovetop with a simple meal in the pan, controlled steam, and no crowded props", "cooking surface, pan size, handle, and edge"],
  "ECO12": ["lifestyle", "social-post", "a warm evening bedside or living-room setting with one lit candle and soft amber light", "jar shape, readable label area, wax level, and wick"],
  "ECO13": ["lifestyle", "social-post", "a calm modern sofa with the blanket naturally folded and draped, warm daylight, and a quiet background", "true color, weave, edge, and believable room scale"],
  "ECO14": ["outdoor", "social-post", "a calm green park path with a friendly dog standing naturally in soft daylight", "every strap, clip, adjustment point, and the harness fit"],
  "ECO15": ["lifestyle", "social-post", "a bright kitchen table with the bottle standing beside its cap and nipple parts, clean and uncluttered", "bottle size, included parts, nipple, cap, and grip"],
  "ECO16": ["lifestyle", "social-post", "a sunlit quiet studio floor with the mat partly unrolled and one soft exercise cue in the background", "full length, surface texture, thickness edge, and roll-up size"],
  "ECO17": ["lifestyle", "social-post", "a bright airport lounge with the suitcase upright on a clean floor and a soft travel background", "full size, wheels, handle, shell, and opening"],
  "ECO18": ["lifestyle", "social-post", "a modern living-room wall with the print framed or mounted above simple furniture, with natural side light", "true artwork color, border, paper edge, and wall scale"],
  "ECO19": ["lifestyle", "social-post", "an organized pantry counter with the container open beside its lid and a small amount of dry food inside", "empty shape, lid seal, stack height, and what fits inside"],
  "ECO20": ["lifestyle", "social-post", "a close, elegant neckline or neutral jewelry display with soft light and a clean background", "pendant shape, chain, clasp, and believable worn scale"],
};

const inputFiles = {
  "ECO01": "content-kits/ECO01/2026-08-25T20-37-12-534Z/input.png",
  "ECO02": "public/images/airveek/content-reference/generic-coffee-maker.png",
  "ECO03": "public/images/airveek/content-reference/generic-running-shoe.png",
  "ECO04": "public/images/airveek/content-reference/generic-handbag.png",
  "ECO05": "public/images/airveek/content-reference/generic-watch.png",
  "ECO06": "public/images/airveek/content-reference/generic-sunglasses.png",
  "ECO07": "public/images/airveek/content-reference/generic-tumbler.png",
  "ECO08": "public/images/airveek/content-reference/generic-earbuds.png",
  "ECO09": "public/images/airveek/content-reference/generic-phone-case.png",
  "ECO10": "public/images/airveek/content-reference/generic-desk-lamp.png",
  "ECO11": "public/images/airveek/content-reference/generic-frying-pan.png",
  "ECO12": "public/images/airveek/content-reference/generic-candle.png",
  "ECO13": "public/images/airveek/content-reference/generic-throw-blanket.png",
  "ECO14": "public/images/airveek/content-reference/generic-dog-harness.png",
  "ECO15": "public/images/airveek/content-reference/generic-baby-bottle.png",
  "ECO16": "public/images/airveek/content-reference/generic-yoga-mat.png",
  "ECO17": "public/images/airveek/content-reference/generic-luggage.png",
  "ECO18": "public/images/airveek/content-reference/generic-wall-art.png",
  "ECO19": "public/images/airveek/content-reference/generic-storage-container.png",
  "ECO20": "public/images/airveek/content-reference/generic-necklace.png",
};

for (const opportunity of graph.opportunities ?? []) {
  const direction = directions[opportunity.id];
  if (!direction) throw new Error(`Missing image direction for ${opportunity.id}`);
  const [scene, goal, setting, detail] = direction;
  const inputName = inputFiles[opportunity.id];
  if (!inputName) throw new Error(`Missing input image for ${opportunity.id}`);
  const config = {
    id: opportunity.id,
    route: "/create/product-fashion",
    input: inputName,
    variations: 1,
    fields: [
      { label: "Mode", action: "select", value: "product-scene" },
      { label: "Scene", action: "select", value: scene },
      { label: "Goal", action: "select", value: goal },
      {
        label: "Describe the image you want",
        action: "fill",
        value: `Create one premium ecommerce lifestyle photo for this ${opportunity.category}. Keep the exact product shape, materials, color, label, and proportions unchanged. Place it in ${setting}. Keep the ${detail} fully visible and sharp. Make the product the main focus with realistic light, believable shadows, clean composition, and room for a crop. Do not add invented readable text, claims, extra products, watermarks, retailer logos, or a plain empty background.`,
      },
    ],
  };
  await writeFile(path.join(root, "recording", "use-cases", `${opportunity.id}.json`), `${JSON.stringify(config, null, 2)}\n`);
}

console.log(`Updated ${Object.keys(directions).length} ecommerce use cases for one-image category-specific production.`);
