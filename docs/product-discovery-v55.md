# Product discovery — v5.5.0

The owner requested development based on the Glowy review, after receiving a recoverable copy of the current store.

Before source edits, v5.4.0 was pinned at `dbe4f97501848f0703b51d83f85071f5db7c8bfe` in `backup/v5.4.0-before-glowy-2026-11-07`. A privately delivered ZIP includes the source, a verified SQL/SQLite snapshot and a checksum map for 1,223 media objects, including all three uploaded product clips. The archive SHA-256 is `d79eb2e9b759b57e4ecd92081105c87f48d4866085cd5c7c8b78573d47b248ad`. No customer or authentication data from that archive is committed here.

## Customer experience

- Five populated care-need shortcuts appear inside the existing home categories section: cleansing, hydration, sun care, glow/even-looking tone, and hair care. The same needs can be combined with existing catalog search, brand, product type, Korean collection, price and sorting. A selected need, brand, search or type can be removed without clearing the other filters or the bag.
- Product-type quick links retain the current filters and show relevant types. Advanced type selection remains explicit, including when a combination has no matching products. Existing brand links on product cards retain their original all-brand navigation behavior.
- Korean care gains a horizontal brand rail with real product thumbnails and names. Tiles preserve the selected care need and Korean collection. Brands appear only when products are available for the relevant care need; the display is a curated navigation aid and makes no best-selling claim.
- Product cards use their saved first benefit, in the selected language, as a practical short description. The existing admin benefits field controls that text. Current price/reference price and existing calculations drive the displayed saving in JOD. A known saved pack size can also appear; no new prices or benefits are written to the catalog.
- Both new home areas remain inside their existing owner-controlled sections, so hiding categories or Korean care continues to hide their new content. Links have keyboard focus states and touch targets; brand/pill rails scroll within their containers. Narrow English filter controls wrap instead of overflowing.

## Scope preserved

No database migration or production catalog write is needed. Product detail templates, one upper and up to three lower silent looping video slots, uploads, admin authentication, promotions, shipping, stock, checkout, order history, email and the paused review policy retain their existing implementations. No empty miniature-size or gift category is added without suitable products.

## Validation and rollback

All 292 automated tests passed. Automated checks cover the real storefront module graph, combined filters, retained bag contents, removing conflicting filters, owner visibility, saved/localized copy and positive care classification without using warnings or directions. Browser QA uses a read-only preview with isolated order handling, including responsive Arabic/English layouts and a 320px frame. No production order is submitted for testing.

Return to v5.4.0 by redeploying Worker version `c61c3d71-469c-4822-b0a3-9e87e6ecb0d7` at 100%, or rebuild the pinned source. Keep the current DB, MEDIA bindings and secrets. Do not restore the data snapshot or run seed scripts for a design rollback; later orders, sales, owner edits and uploads must remain.
