# Trend Shop v3.0.0 — bilingual storefront and reliable checkout

Published at https://trendjo.pages.dev/ with Arabic and English browsing, product content, options, checkout, support and privacy text. The existing store design now includes product-led promotional photography and a curated opening selection of Korean skincare, foundations and mascara.

## Customer experience

- Product descriptions lead with the daily ritual and the customer’s choices, keeping product identity and usage notes clear. Nineteen priority products have individually rewritten feature copy. The curated fallback catalog contains 304 product families; three additional sold-out legacy rows were also given complete bilingual content. All 302 active approved production rows now include English descriptions.
- Default sorting is an editorial selection, followed by other available products, with sold-out items lower down. Search continues to prioritize matching names. Snail products, lip contour, primer, removers, skincare sets, foot care and body sunscreen have corrected classifications.
- Twelve reference-based promotional scenes show fictional adult models with the relevant product. The original packshot stays first, and secondary scenes are captioned “مشهد دعائي / Promotional scene.” Three six-second silent animated promotional clips have controls, a poster and `preload="none"`. Compact gallery thumbnails load before the full scene is selected. These scenes are promotional material, not customer experiences or demonstrations of guaranteed results.
- Arabic/English switching preserves the bag and the in-page checkout draft. Product share links and WhatsApp messages retain the selected language. Every WhatsApp bag item has its own product URL, quantity, selected option and price in one message.
- Website order confirmation is the primary checkout action. WhatsApp assistance follows the full form and summary at the bottom. The floating shortcut is hidden during checkout. Clearing filters also closes the filter panel and restores the full listing.

## Checkout reliability

The browser and server share the same rules for names, phones, governorates, addresses, email and CliQ aliases. Two-letter names, one-word areas and optional email are supported. Jordanian Arabic, Persian and English digits, pasted direction marks and international/WhatsApp numbers are normalized consistently. English governorate labels submit canonical governorate values.

Fields show actionable errors, retain other entered values and focus the first invalid input. The form uses custom validation instead of conflicting native validation and has no autofill-prone website honeypot input. The server retains its existing trap for older clients.

The confirm button indicates progress during validation and submission. Phone loading and network requests have deadlines. An uncertain response triggers a receipt lookup using the same idempotency key, without automatically submitting another order. A manual retry preserves that key. Session storage contains only a random key and timestamp; checkout contact information stays in page memory. Receipt recovery returns the actual saved payment method and totals.

Shipping remains 1 JOD across Jordan, free only when merchandise after discounts totals **more than 19 JOD**. Prices, discounts, quantities, approvals, hidden products and historical order snapshots were preserved.

## Genuine purchase reviews

Customers can use https://trendjo.pages.dev/#/reviews or a product review form after receiving an order. Verification requires the order number and its normalized phone number, and the order must have status `تم`. A short-lived signed capability permits one review per purchased product and order.

The submission includes a real rating, the customer’s own words and explicit publication consent. Customers may attach up to two photos, prepared in the browser without original file metadata, and an optional HTTPS social-video link. The administrator reviews submissions, images and video links in **مراجعات الزبائن**, then publishes or hides them. The moderation endpoint does not change the customer’s rating or words. Approved media is publicly accessible only while its review is approved and its purchase remains completed.

Public review data includes the first name, broad governorate, original rating/text, date and approved media. Order identifiers, phone numbers, addresses and emails are private. No customer reviews or verified ratings were invented. The initial production review count is zero; genuine submissions appear after approval.

## Validation

**153 automated tests passed**, including shared contact validation, English/Arabic flows, search selection, tone selection, cart preservation, shipping boundaries, request deadlines, uncertain-response recovery, repeated-order protection, filter reset, review authorization/moderation/privacy, and content migrations that protect concurrent edits, stock, pricing and order snapshots.

The live browser review covered desktop and a 390-pixel mobile layout, language changes, opening a product from search, secondary image navigation and zoom, video playback, cart recommendations, field-specific phone errors and a successful isolated demo checkout with a two-letter name, Arabic phone digits, blank email and a one-word address. Production smoke checks used read-only requests and deliberately invalid checkout/review requests. No test order, notification email or WhatsApp message was sent from production.

All 27 new media files were fetched and matched against the source bytes. Video byte ranges returned HTTP 206. Scripts and connections remain restricted to the store origin; administrator pages and APIs keep their authentication and cache restrictions.

The production audit after content updates retained **321 product rows, 302 active approved rows, 7,234 stock units, 10 orders and 56 historical order item rows**. Prices, discounts, active flags and approvals matched the before-snapshot. There were 307 updated content rows, including the three sold-out legacy records, and no production review rows.

![Live Arabic storefront with product promotional scenes](verification/trend-shop-v3-live.jpg)

## Source, assets and rollback

- Image/video files: `public/images/catalog/marketing/`. Reference paths, prompts, generation mode and promotional classification: `data/marketing-assets-2026-11-02.json`. Gallery provenance: `data/gallery-provenance.json`. Product media index: `public/product-media.json`. The final website uses optimized WebP images and MP4 clips.
- Shared checkout rules: `public/checkout-rules.js`; deadlines and safe pending keys: `public/checkout-request.js`; localization: `public/i18n.js`; review service: `src/reviews.js`; customer and moderator interfaces: `public/reviews.js` and `public/reviews-admin.js`.
- Additive schema migrations: `0013_order_locale.sql` and `0014_verified_reviews.sql`. Guarded copy migrations: `0015_product_copy_v3.sql` and `0016_legacy_copy_v3.sql`. Exact before-values protect concurrent copy edits; repeating the copy migrations changes no rows. These migrations do not reset inventory, prices, flags or orders.
- Source backup: `backup/v2.3.0-before-bilingual-2026-11-02` at `bca2e7153bf940b65d39a30b8d784c52424e8675`. Previous Worker version: `d11531fc-d298-4b9b-a385-94635a916295`. A private, integrity-checked product-content snapshot is retained in MEDIA under `internal:backup:catalog-v2.3.0-2026-11-02`; public media routes cannot serve this key. Restoring content must preserve stock and orders recorded since the backup.
- Final Worker version: `db7ef005-f65d-46de-930d-94180d8fe7cc`, 100% traffic, startup 3 ms. Deployment retained the existing secret bindings, database, media storage and live order setting.

Product-specific reference checks used official COSRX, Beauty of Joseon, Anua, SKIN1004 and The Ordinary pages and the PanOxyl label/FAQ. Directions remain tied to the exact product packaging; no clinical, exclusivity or sales-ranking claims were invented. Reference examples: [COSRX Snail 96](https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence), [The Ordinary peeling directions](https://theordinary.com/on/demandware.store/Sites-deciem-global-Site/en_GB/Product-Show?pid=100400), [PanOxyl FAQ](https://panoxyl.com/faq/).
