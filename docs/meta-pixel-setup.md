# Meta Pixel setup — prepared 2026-11-01

Status: source prepared and tested; not deployed. No Pixel/dataset was created by this change. The Meta creation dialog is ready with the name `Trend Shop Website` in portfolio `trend_shop.jo` (`467583567928517`), with the portfolio-wide automatic Conversions API option unchecked. Creation includes acceptance of Meta Business Tools Terms and awaits the owner's action-time confirmation.

## Behavior

- `/api/catalog` returns `metaPixelId` only when the store is live and `META_PIXEL_ID` is a valid public numerical ID. An absent ID keeps tracking disabled. This ID is not an access token.
- Only the existing production hosts `trendjo.pages.dev` and `trend-shop-jo.trend-shop-jo.workers.dev` may run this integration. Add a future replacement hostname explicitly when moving the store; retain the same Pixel ID.
- Visitors choose whether to allow advertising measurement. The Meta script is loaded only after consent. Refusal leaves shopping and checkout available; the footer allows changing the choice. Preview/demo stores never send events.
- `PageView` follows actual SPA page transitions; `ViewContent` includes the SKU and current price; `AddToCart` includes only newly accepted quantities, including drawer increments and bundles; `InitiateCheckout` includes the current quote. Fil values are divided by 1,000 for `JOD`.
- `OrderPlaced` is a custom event emitted only after the server confirms an order. Its total comes from the server response. COD/manual CliQ remain `payment_status: pending`. There is deliberately no `Purchase` event or representation of paid revenue. A future card integration must use verified payment success, with a matching event ID if server-side tracking is added.
- Order event IDs use the persisted order reference. A bounded local record suppresses duplicates after retries/reloads. Prior browsing, cart actions and orders are not replayed when a visitor later accepts tracking.
- No customer name, phone, email, delivery address, Maps location, notes or CliQ alias is passed to the Pixel integration. Automatic configuration/form matching is disabled. Meta can still receive normal browser/cookie/URL/IP data once the visitor opts in, as disclosed in the consent notice and privacy text.
- The CSP allows the official Meta script and event destinations on the storefront. Administrative pages retain their existing stricter policy.

## Complete activation after confirmation

1. Create the prepared dataset/Pixel once, record its ID, and connect the existing Smart Shop ad account (`1494709724216142`). Do not create another ad account or catalog.
2. Set public `META_PIXEL_ID` in the existing Worker's deployment configuration and commit the same non-secret ID to `wrangler.jsonc` for later deploys. Preserve all existing bindings and secrets without reading their values.
3. Recheck the current main branch and deployed version before publishing to avoid replacing concurrent site changes. The last observed deployed version is `712fb2da-ebd6-4d19-86ee-cd5c1d912388`, serving 100% of traffic. Pages `trendjo` forwards to that Worker through its existing `STORE` service binding.
4. Publish the validated source/assets using the existing deployment adapter or normal Workers Assets path. No schema migration, seed, catalog update, stock mutation or secret rotation is required.
5. Verify actual Meta Test Events for consent, product view, accepted cart increments and checkout. Validate order tracking with isolated synthetic orders, never by creating a production order or triggering an owner/customer notification. Do not claim live event receipt until Meta visibly confirms it.
6. Save the final Pixel ID, connected asset and deployment version in this document. Campaign budgets and publishing remain a separate task.

## Verification

`npm test`: **132 passed, 0 failed**, including seven new behavioral checks for consent/revocation, blocked/preview/foreign hosts, SKU quantities and JOD amounts, successful/failed order submission, duplicate conversion suppression, absence of customer fields, analytics failure isolation and the administrative CSP. Existing stock, security, order, variant and notification tests also passed. `node --check` and `git diff --check` passed.

Live Meta event testing and visual checks after publication remain pending activation. All current checkout tests use local synthetic data and no real notification destination.
