# Arencia TS0098 — focused purchase experience v5.2.0

Date: 6 November 2026. Product URL: https://trendjo.pages.dev/p/TS0098

The owner approved a pilot on Arencia only following the Vstorat storefront review, and explicitly confirmed these customer-facing terms: delivery to every area of Jordan within 24 hours; customers may inspect their order before paying; products are 100% authentic. These are merchant-provided service statements, not manufacturer certifications.

The scoped `arencia-pilot` module and stylesheet apply only to TS0098. They shorten the introductory copy, keep the complete existing narrative lower on the page, show the unit price clearly, add an early mobile order button using the existing selected quantity, and display the three service assurances beside the purchase area. The normal price/stock caps, offers, checkout validation and idempotency path are reused.

Three photos now form a coherent gallery: the original 120 g pack, the existing promotional usage scene, and the already available manufacturer texture image. The texture photo is included only while the administrator's primary image still matches the reviewed pack. No new raster images or videos were created or seeded. Existing videos and the administrator's upload controls remain available.

The benefits use three compact cards, and the existing three use steps receive decorative SVG icons. The Arencia FAQ repeats the approved service information and the existing shipping charge: 1 JOD, free strictly above 19 JOD after discounts. No inspection-related exchange or refund promise was invented.

## Validation

- Complete existing suite plus four focused pilot tests: **272 passed, 0 failed**. The focused suite passed again after the final mobile spacing adjustment.
- The pilot test covers the early order button using the current pair selection, unchanged delivered prices, out-of-stock disabling, the owner's replacement image, bilingual service copy and a different product retaining its original experience.
- A read-only local preview without production database, media-store or mail bindings was inspected through a 390 × 860 browser iframe (375 px document client width with scrollbar). Horizontal document width matched client width.
- The pair selected in the page reached checkout as quantity 2 with subtotal/total 19.99 JOD and free delivery. No order was submitted.
- Arabic and English service information were inspected in the browser.
- No physical iPhone was available. Conversion improvements have not yet been measured.

## Scope and rollback

Prices, stock, orders, promotions, product copy rows, review settings and authentication are not migrated or reset. The three service assurances are introduced in this product pilot; other products and the home page retain their current layout.

Source backup: `backup/v5.1-before-arencia-v52-2026-11-06` at `0af449f773b734b8180e881472eabe07c7e5843d`. Previous Worker version: `027bd4cb-993d-4a30-a458-2b8067736135`.

Final deployment identifiers, runtime asset hashes and before/after data fingerprints are recorded after publication in `DEPLOYMENT.json` and `docs/arencia-v52-verification.json`.
