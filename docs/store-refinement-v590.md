# Trend Shop 5.9.0 — requested store and order refinements

## Published scope

- Restore the four simple skin-depth choices while retaining coverage of all 21 foundation, concealer and face-powder products, including five face powders. Restore the previous owner tone-code editor. Remove the advanced shade guide, manufacturer reference charts, external links and commentary, and shade-photo controls.
- Restore continuously visible product descriptions, ingredients, suitability and directions. Keep the existing FAQ disclosures, search, favorites, recent visits, loading stability and aggregate experience measurements.
- Place a bordered parcel-total box immediately under the invoice status. It repeats the final products-plus-delivery amount without removing or changing the original lower totals. Unknown delivery fees on historical invoices remain explicitly unconfirmed.
- Hide complementary-product choices inside the cart drawer and checkout summary. Keep direct checkout, editable quantities, manual add-product search and shipping information. Product-page recommendations and the existing delayed add-to-bag assist remain independent.
- Reuse order/invoice selection for bulk status changes to new, processing and completed. Select all is scoped to the currently displayed filter. Disable competing order actions during saving, report the result, reload current server data, and retain selected invoice printing.
- Validate bulk IDs/statuses and owner/same-origin access on the server. Reject missing or invalid selections before writing. Groups of at most 90 IDs remain within D1's 100 bound-parameter limit; updates execute in one transactional D1 batch. No inventory, pricing or customer fields are updated.

## Short order IDs: active for new orders

The new generator produces `TR-` plus four characters from `123456789ABCDEFGHJKLMNPQRSTUVWXYZ`. It uses Web Crypto with rejection sampling, retries actual primary-key collisions, and retains the existing idempotent receipt and stock transaction. New and historical IDs remain valid in administration and review verification. Receipts, invoices, customer reports and Excel use the same stored identifier.

On 8 November 2026 the existing Google Apps Script deployment was updated to version 2 with the compatible validator and unified Arabic-English HTML/plain-text confirmation. Its tested source matched the saved editor source exactly, and the owner-only health check reported `orderIdFormat=short4-v1` and `confirmationFormat=bilingual-v2`. Google confirmed the existing deployment update, and the store mail-health endpoint remained connected and ready. The same deployment URL, owner execution, access setting and Script Properties were retained.

`SHORT_ORDER_IDS=true` is now active. Worker version `1111b562-d1a2-4ec8-9b47-af21ee1f5c1b` serves 100% under deployment `a5b386b6-c3ee-46b5-ae18-fe2d9631ceac`. All existing bindings were inherited; no business data migration was needed. Existing identifiers are never renamed. `SHORT_ORDER_IDS=false` remains available to restore the historical format for future orders without undoing any order data.

## Validation

All 330 automated tests passed. Automated tests cover all 21 tone-choice products, removal of the advanced guide and collapsible product sections, preserved customer collections and measurements, invoice totals including free/unknown shipping, real identifier collisions, idempotency replay, a 300-order bulk update, access and origin rejection, Excel identifier/total continuity, and selection/printing behavior during pending mutations.

Browser QA used synthetic local orders only. Select all changed both to processing, and invoice layout was inspected at normal zoom. No production order was created or changed and no test email was sent.

Current Cloudflare D1 reference: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

## Rollback

Restore Worker version `56e59926-889b-4554-9564-756304b97937` and its corresponding source if necessary. No D1 migration is required by 5.9.0. A code rollback must never reset stock or revert real order status changes.
