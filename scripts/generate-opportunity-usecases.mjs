import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const useCaseDirectory = path.join(root, "recording", "use-cases");
const items = [
  ["ECO01", "generic-serum.png", "skincare serum", "a clear shop listing, a calm bathroom routine scene, and a close view of the bottle and dropper", "the exact bottle shape, cap, label, and amber glass"],
  ["ECO02", "generic-coffee-maker.png", "coffee maker", "a clear front listing, a simple kitchen counter scene, and a close view of the buttons and carafe", "the exact machine shape, buttons, carafe, and finish"],
  ["ECO03", "generic-running-shoe.png", "running shoe", "a clean side listing, a natural walking scene, and a close view of the sole and heel", "the exact shoe shape, sole, laces, mesh, and colors"],
  ["ECO04", "generic-handbag.png", "leather handbag", "a clean shape listing, a natural carried scene for scale, and a close view of the strap and inside", "the exact bag shape, color, strap, and hardware"],
  ["ECO05", "generic-watch.png", "analog watch", "a clear dial listing, a natural wrist scene for scale, and a close view of the metal finish and crown", "the exact dial, hands, case, bracelet, and colors"],
  ["ECO06", "generic-sunglasses.png", "sunglasses", "a clean front listing, a natural worn scene, and a close view of the frame and lens", "the exact frame shape, lens color, and arms"],
  ["ECO07", "generic-tumbler.png", "insulated tumbler", "a clean product listing, a desk or car use scene, and a close view of the handle and lid", "the exact tumbler shape, handle, lid, and color"],
  ["ECO08", "generic-earbuds.png", "wireless earbuds", "a clear case listing, a natural wearing scene, and a close view of the case and controls", "the exact earbuds, case shape, and included parts"],
  ["ECO09", "generic-phone-case.png", "phone case", "a clean front and back listing, a hand-use scene, and a close view of the edges and ports", "the exact case shape, camera cutout, buttons, and color"],
  ["ECO10", "generic-desk-lamp.png", "desk lamp", "a clear full-product listing, a simple desk scene, and a close view of the hinge and controls", "the exact lamp shape, base, shade, and controls"],
  ["ECO11", "generic-frying-pan.png", "nonstick frying pan", "a clean pan listing, a simple stovetop scene, and a close view of the cooking surface and handle", "the exact pan shape, surface, handle, and finish"],
  ["ECO12", "generic-candle.png", "scented candle", "a clear label listing, a calm home scene, and a close view of the jar, wick, and wax", "the exact jar shape, label, wick, and wax"],
  ["ECO13", "generic-throw-blanket.png", "throw blanket", "a folded listing, a sofa scene for size, and a close view of the weave and edge", "the exact blanket color, texture, and edge"],
  ["ECO14", "generic-dog-harness.png", "dog harness", "a flat product listing, a natural dog-wearing scene, and a close view of the straps and clips", "the exact harness shape, straps, buckles, and leash ring"],
  ["ECO15", "generic-baby-bottle.png", "baby bottle", "a parts listing, a simple held-use scene, and a close view of the cap and nipple", "the exact bottle, cap, nipple, and included parts"],
  ["ECO16", "generic-yoga-mat.png", "yoga mat", "a full mat listing, a simple exercise scene, and a close view of the surface and edge", "the exact mat color, thickness, surface, and strap"],
  ["ECO17", "generic-luggage.png", "carry-on luggage", "a clear full-suitcase listing, an airport scene, and a close view of the wheels, handle, and inside", "the exact suitcase shape, wheels, handle, and finish"],
  ["ECO18", "generic-wall-art.png", "wall art print", "a clean flat print listing, a room-wall scene for scale, and a close view of the paper and edge", "the exact artwork, colors, paper, and proportions"],
  ["ECO19", "generic-storage-container.png", "food storage container", "an empty product listing, a pantry scene, and a close view of the lid, seal, and stack", "the exact container shape, lid, seal, and transparency"],
  ["ECO20", "generic-necklace.png", "pendant necklace", "a clean jewelry listing, a natural worn scene for scale, and a close view of the pendant and clasp", "the exact pendant, chain, clasp, and metal color"],
];

await mkdir(useCaseDirectory, { recursive: true });
for (const [id, image, product, jobs, invariants] of items) {
  const config = {
    id,
    route: "/create/product-fashion",
    input: `public/images/airveek/content-reference/${image}`,
    variations: 3,
    fields: [
      { label: "Mode", action: "select", value: "product-scene" },
      { label: "Scene", action: "select", value: "studio" },
      { label: "Goal", action: "select", value: "store-listing" },
      { label: "Describe the image you want", action: "fill", value: `Create three useful product photos for one ${product}: ${jobs}. Keep ${invariants} unchanged. Do not add readable text or claims.` },
    ],
  };
  await writeFile(path.join(useCaseDirectory, `${id}.json`), `${JSON.stringify(config, null, 2)}\n`);
}
console.log(`Generated ${items.length} Airveek ecommerce recording specs.`);
