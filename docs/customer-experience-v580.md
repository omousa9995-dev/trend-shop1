# Customer experience 5.8.0 — 8 November 2026

Customer scope: shade guidance, shorter product pages, search, local saved
products, speed/stability improvements and first-party aggregate measurement.
Customer shipment tracking remains deferred. The checkout idempotency recovery
endpoint is retained; it is not a tracking page.

## Product and shade guidance

- All 21 current face foundation, concealer and powder families have a guide,
  including all five loose, pressed and powder-foundation products. Hair colour
  powders are excluded.
- The four existing skin-depth IDs stay compatible with carts and historical
  order snapshots. Concealers now require a depth preference too. A preference
  is explicitly not a manufacturer shade code or a stock claim.
- The owner can supply an Arabic/English name, a confirmed pack code, and one
  real image for each preference in the product editor. Images use the existing
  upload service. Choosing an imaged shade updates the product gallery and zoom;
  a broken image falls back to the product pictures. Codes enter order snapshots.
- Seven manufacturer charts are served locally and loaded only when needed:
  one Huda Easy Bake chart and six Tarte Shape Tape panels. A product ID, brand
  and product-name check prevents a chart being attached to a renamed product.
  Other families have specific guidance and confirmed primary links where
  available. No unverified stock/code mappings are seeded.
- Source provenance and pack/version cautions are in
  `data/shade-reference-provenance-v580.json`. The images have only been resized
  and encoded; their colours have not been regenerated or deliberately altered.
- Product details and how-to sections are collapsible without deleting content;
  navigation links open the target section before scrolling. Existing single
  upper video and three lower silent-loop video slots are retained.

## Discovery and saved products

- Arabic/English brand and type aliases, bounded typo matching, explicit
  correction notices, and clearly separate empty-search exploration choices.
  Numeric terms are never fuzzy-corrected to a different product strength.
- Available alternatives are shown for unavailable products.
- Favorites and recent visits need no login. Only public product IDs and recent
  visit times are saved in this browser. Recent visits expire after 30 days;
  lists can be cleared separately. Blocked storage falls back to memory.

## Performance and measurement

- Shared initial product hero HTML matches the main gallery geometry, retains
  the product image, and avoids the previous small loading-message replacement.
  The language control has reserved space from initial HTML. The stale duplicate
  commerce module preload is corrected. New shade resources are lazy-loaded.
- The pre-change mobile lab audit of `/p/TS0098` was performance 90,
  accessibility 96 and best practices 100; LCP 2.0 s, CLS 0.202, TBT 0 ms.
  This is baseline lab evidence, not a post-release result or field measurement.
- Locally hosted `web-vitals` 5.3.0 measures standard LCP, INP and CLS. Its Apache
  license is retained in source and at `/licenses/web-vitals-LICENSE.txt`.
- First-party customer event enums are product view, cart add and checkout open.
  Order success is recorded by the server only after saving a real order.
  Checkout retries do not create a second order or a second success count.
- Measurements contain only a random short-lived tab token, event enums, coarse
  page/device groups and bounded measurements. No name, phone, address, email,
  typed search, full URL or product/order contents enter these tables. Tokens are
  HMAC-salted per day before persistence; raw IPs are not stored. Browser DNT/GPC
  and the privacy-page opt-out are respected. Analytics failure cannot block cart
  or checkout. There are no new third-party advertising requests.
- Additive migration `0027_customer_experience_metrics.sql` creates two tables
  and a counter trigger. Short-lived deduplication signatures are pruned while
  daily aggregates remain. Existing business tables are not changed.
- The authenticated owner overview shows seven/thirty-day aggregate stages and
  mobile performance counts. p75 values are histogram upper bounds, not exact
  quantiles or Lighthouse scores. A saved order is not a cash collection.

## Validation and rollback

`npm test`: 325 passing tests, including 14 new focused cases for discovery,
browser storage, shade coverage/validation/photo changes, preserved content,
owner saves, measurement privacy/deduplication and real-order idempotency.
Phone UI checked at 320, 390 and 430 CSS pixels, in Arabic and English.
No real test order was created. Existing invoice printing, customer reports,
authentication, media controls, pricing and shared-stock guards remain covered.

The API deployment package resolves the actual Worker import graph, including
customer reports and metrics. Its additional smoke test imports the generated
entrypoint and checks store/admin HTML and the exact bytes of all seven charts.
All seven original chart files remain same-origin static assets with unchanged
bytes. The upload is below the current 64 MiB uncompressed Worker size limit.

Roll back by restoring the previous Worker source and static assets. Leave the
additive metrics tables in place; the previous version does not access them.
No product, price, inventory or customer data migration is necessary to undo
this release.
