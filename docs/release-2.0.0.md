# Trend Shop 2.0.0 — photographed intake and customer choices

The five owner collages map to 70 product families: 59 new SKUs (TS0301–TS0359) and 11 existing products. Repeated packages are consolidated; tinted Bioderma and invisible body milk are separate. New SKUs start at 24 units each. Existing stock, prices, approval, publication flags and historical orders must remain intact.

New products have individual Arabic copy, introductory regular-price comparisons, optimized WebP photos and larger zoom images. The audit trail is in `data/intake-2026-10-27-b/`; provenance stays internal. Customer-facing technical image captions are removed. Some unreadable colors and corset sizing still require store confirmation, stated on those product pages.

All 18 face foundations and face powders offer four store tone preferences (1 light, 2 light-medium, 3 medium, 4 wheat). These are approximate store classifications, not manufacturer codes. Admin can optionally map verified manufacturer codes. The stock is shared by the parent SKU; there are no invented per-shade quantities. Scent families have required choices; collection photos show alternatives and the price is per piece unless explicitly a set.

The cart keeps separate `(id, variant)` lines. The server validates option IDs against current product metadata, aggregates by parent, caps 10 total pieces per parent and uses the existing atomic stock triggers. Each order item freezes the selected labels and quantities in `options_snapshot`. Admin, invoice and order email display that snapshot. Existing orders retain `[]`, without guessed historical shades. Combo eligibility also aggregates parent quantities.

## Deployment order

1. Upload the 118 immutable WebP files to GitHub and MEDIA KV, preserving existing keys.
2. Run the complete test suite and desktop/mobile-width isolated preview. Preview has public catalog copies only, no production DB or secrets, and write endpoints disabled.
3. Check current production schema. Apply `0009_order_item_options.sql` **once** only if the column is absent. Fresh databases already include it in `schema.sql`.
4. Publish all 12 packaged Worker modules with DB, MEDIA, STORE_LIVE and `keep_bindings: ["secret_text"]`. Do not replace or print secrets. Publishing option-aware validation before adding new catalog rows avoids a window in which new choices could be accepted by the old server without a snapshot.
5. Apply `0010_catalog_intake_2026_10_27_b.sql`. It inserts only missing new IDs, conditionally updates unchanged legacy foundation metadata, adds missing types to matched products and removes only technical image captions. It never restocks or changes old sale prices.
6. Verify 317 active products, 59 new rows, unchanged old stock/prices/flags and unchanged order counts. Verify live pages, options, image loads, and CI. Disable the isolated review endpoint.

## Recovery

Source backup: `backup/v1.9.0-before-shades-2026-10-27`, commit `7c9ed172455f27ccbadd57870a3a857acee40486`. Previous production Worker version: `242b297a-397e-4acf-9147-ef47ce94acfc`.

Prefer fixing forward. A code rollback can keep the additive column safely; **never drop it or replay seed data**, because new order snapshots and sales must survive. If catalog additions need hiding, set only TS0301–TS0359 `active=0` (do not delete rows or reset stock). A storefront rollback does not itself restore catalog content: review later admin edits before restoring old product metadata from the intake audit file. Preserve current order and stock state during every recovery action.

## Validation

104 automated checks cover historical behavior and new options: real SQLite atomic stock handling, invalid/duplicate/over-cap choices, multiple tones, snapshot preservation after product edits, idempotency, email payloads, invoice content, combo aggregation, additive migration replays, required selection, cart persistence and merges, optional email, one-word address, search, sharing, zoom and image provenance. Browser review exercises the isolated desktop flow and a 390px wide layout; this is not a physical iPhone test. No test order or test email is sent to production.

## Published verification — 2026-10-27

- Implementation commit: `4d1a7843b71c811009c8019ce99a0e5560ea7ce8`; tree `28c5f70f1bfedb88de1a5aea1b6edf7aa924e1c4`.
- GitHub Actions: `https://github.com/omousa9995-dev/trend-shop1/actions/runs/40490316746` — all 104 checks passed.
- Production Worker: `014ad218-3155-4da5-a5eb-eb3515fb457e`.
- D1: 334 total rows, 317 active approved products, 59 additions each with 24 units, 18 products with four tone choices. All active prices are in the authorized range.
- Pre/post comparison confirmed unchanged old stock, prices, approval and publication flags. Four existing orders and seven historical items were retained; their options default to `[]`.
- All 118 new immutable MEDIA keys matched expected filenames and byte sizes. No technical image captions remain in product metadata.
- Production browser review confirmed live ordering is enabled, the newest-products filter returns 59 products, direct `/p/TS0313` loads its image and four choices, and the old extra WhatsApp-confirmation notice is absent from selectable products.
- The isolated preview tested two tones in the cart, a recommendation that unlocks free delivery, optional email and a one-word address through demo confirmation. Its write endpoints never connect to the production database. The preview was disabled after review.
- Pre-migration D1 Time Travel bookmark: `00000058-00000000-00005111-498c48944d29f646a6dd2940be1a5336`. Its availability follows the account retention window; it is not a permanent database export. Never restore an old database blindly over later customer orders.
