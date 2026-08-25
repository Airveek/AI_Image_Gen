# Product Generation Evaluation Set

Use this checklist to compare the current Product & Fashion prompt with the Kive-inspired prompt context. Run both versions with the same source image, settings, and generation count. Review the images at full size.

## Scenarios

| # | Product case | Recipe | Main checks |
| --- | --- | --- | --- |
| 1 | Bottle on a neutral background | Clean studio | Shape, cap, label, color, clean grounding shadow |
| 2 | Boxed cosmetic product | Clean studio | Packaging edges, readable label, no extra text |
| 3 | Small accessory with a detail image | Clean studio | Product scale, clasp or hardware, detail preservation |
| 4 | Folded garment | Warm stone | Garment construction, seams, material, natural folds |
| 5 | Shoe or bag on a warm surface | Warm stone | Silhouette, hardware, logo placement, perspective |
| 6 | Product with a model reference | Editorial lifestyle | Product identity, model role separation, natural scale |
| 7 | Garment on a model | Editorial lifestyle | Garment fit, color, construction, recognizable product |
| 8 | Outdoor lifestyle product scene | Editorial lifestyle | Product visibility, lighting, no distracting props |
| 9 | Store-listing product image | Clean studio | Complete product, no generated copy, commercial clarity |
| 10 | Ad-banner product image | Warm stone | Product fidelity, intentional copy space, no invented branding |

## Review rubric

Each reviewer scores every image from 1 to 5:

- Product shape and proportions
- Product color and material
- Logo and label accuracy
- Correct product count and identity
- Scene, lighting, and composition match
- Unwanted artifacts or invented details
- Overall usability without manual correction

Record one short note for every score below 4. Mark whether the issue came from the source image, the prompt, or the provider output.

## Comparison rule

Use blind labels such as `A` and `B`. Do not treat a higher score as proof that the new prompt always wins. A change is ready for broader use when it shows no regression across all categories and produces a clear improvement in product identity or scene adherence across the majority of scenarios.

Exact logo and packaging text still require human review because ordinary image generation cannot guarantee pixel-perfect text reproduction.
