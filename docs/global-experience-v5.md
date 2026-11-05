# Trend Shop v5 — approved product experience, throughout the store

The approved Aqua-Fresh product layout now serves every active physical product and every available bundle. Each product keeps its own brand, photos, live description, options, usage directions and reviewed Korean-care story where present. New narrative profiles use existing product data; no ingredient, review or result claims were invented. No new product videos were seeded.

The ingredients/pack-information box and the privacy/terms link beneath the product FAQ were removed. The store privacy page and checkout privacy link remain accessible. The 9:16 mixed photo/video strip, enlarged viewer, muted inline autoplay while visible, repeat, sound controls and explicit seeking are available to all products. Admin cover, title and order controls now apply to every product's own media.

## Pair prices

All money uses integer fils. For each two identical product units, calculate 90% of their combined current single-unit price. Round the discounted JOD amount upward at a fractional part of 0.60 or higher, downward below 0.60; subtract 0.01 JOD from that whole number for the retail tag. Show the final pair price, without the calculation or a per-piece approximation. Repeated pairs use the same price; any odd unit keeps the single price. Both server and browser use the shared helper.

| Single price | Unrounded discounted pair | Final pair price |
| --- | --- | --- |
| 9.00 | 16.20 | 15.99 |
| 8.50 | 15.30 | 14.99 |
| 10.00 | 18.00 | 17.99 |
| 0.99 | 1.782 | 1.78 |

For the few low prices where that retail tag would equal or exceed two single units, keep the 10% discounted amount floored to cents. A pair never costs more than two singles. Rounding means the actual percentage saved varies; the storefront labels the final pair offer rather than promising an exact percentage. Existing multi-product offers remain eligible without discounting the same unit twice.

Bundles keep one complete package row, image and final package price in the cart, checkout and invoice. Stock accounting still expands the package internally. Reviewing a package selection sets its chosen quantity instead of adding it again.

## Owner controls

Open `/admin.html`, sign in normally, and choose **الموقع وطريقة العرض**. This adds:

- Store name, Arabic/English slogans and home-page title/description.
- Desktop/mobile product columns.
- Home-section visibility and top-to-bottom order.
- Product-section visibility and order, keeping the main photo/price/selection first.
- Product search, arrows and a numbered position field for a manual default display order.
- Plain-text Arabic and English privacy/terms editing.
- Explicit save, reload and undo of the last save, retaining five prior revisions.

Saved settings are validated against fixed fields, section identifiers and actual product identifiers. They render as plain text, never injected markup. Admin session, origin/CSRF and bounded-body validation apply. Revision compare-and-swap prevents stale saves from overwriting another edit and retains the local draft on conflict.

Migration `0025_storefront_controls.sql` only creates/initializes the settings singleton. It does not update product prices, discounts, stock, orders, promotions or uploaded videos. Existing installations activate the pair policy through that explicit migration.

## Validation

255 automated tests pass, including full price-range and rounding boundaries, odd/repeated quantities, multiple shades, package receipts, checkout price/stock races and idempotency; settings validation, stored-text rendering, authentication/CSRF, stale and concurrent saves, undo history and draft preservation. Browser QA uses a separate temporary database with 12 public repository examples, synthetic prices/stock, no customer orders and no mail bindings. The editor save/order/hide/privacy flow and undo were tested there, along with video playback, seeking, and mobile-width product/package checkout presentation. Physical iPhone testing was not available.
