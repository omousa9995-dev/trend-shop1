# Meta Pixel setup — prepared 2026-11-01

Status: created and published after the owner confirmed acceptance of Meta Business Tools Terms. Pixel/dataset **2055983688451688**, named `Trend Shop Website`, belongs to portfolio `trend_shop.jo` (`467583567928517`) and is connected to Smart Shop (`1494709724216142`). The portfolio-wide automatic Conversions API option and automatic advanced matching remain off. Live browser event receipt is now confirmed in Events Manager for 2026-11-01: PageView, ViewContent, AddToCart and InitiateCheckout are all active. OrderPlaced remains locally tested only; a submitted COD/manual CliQ order is not evidence of collected revenue.

## Behavior

- `/api/catalog` returns `metaPixelId` only when the store is live and `META_PIXEL_ID` is a valid public numerical ID. An absent ID keeps tracking disabled. This ID is not an access token.
- Only the existing production hosts `trendjo.pages.dev` and `trend-shop-jo.trend-shop-jo.workers.dev` may run this integration. Add a future replacement hostname explicitly when moving the store; retain the same Pixel ID.
- Visitors choose whether to allow advertising measurement. The Meta script is loaded only after consent. Refusal leaves shopping and checkout available; the footer allows changing the choice. Preview/demo stores never send events.
- `PageView` follows actual SPA page transitions; `ViewContent` includes the SKU and current price; `AddToCart` includes only newly accepted quantities, including drawer increments and bundles; `InitiateCheckout` includes the current quote. Fil values are divided by 1,000 for `JOD`.
- `OrderPlaced` is a custom event emitted only after the server confirms an order. Its total comes from the server response. COD/manual CliQ remain `payment_status: pending`. There is deliberately no `Purchase` event or representation of paid revenue. A future card integration must use verified payment success, with a matching event ID if server-side tracking is added.
- Order event IDs use the persisted order reference. A bounded local record suppresses duplicates after retries/reloads. Prior browsing, cart actions and orders are not replayed when a visitor later accepts tracking.
- No customer name, phone, email, delivery address, Maps location, notes or CliQ alias is passed to the Pixel integration. Automatic configuration/form matching is disabled. Meta can still receive normal browser/cookie/URL/IP data once the visitor opts in, as disclosed in the consent notice and privacy text.
- The CSP allows the official Meta script and event destinations on the storefront. Administrative pages retain their existing stricter policy.

## Deployment record and remaining verification

1. Creation succeeded and the connected-assets view explicitly lists Smart Shop. The numerical ID is also shown in Events Manager and its official installation snippet.
2. `META_PIXEL_ID` is configured on the deployed Worker and in `wrangler.jsonc` for subsequent deploys. Existing binding types were preserved without reading any secret values. No schema migration, seed, catalog change, stock mutation or credential rotation was performed.
3. The deployment was based on unchanged main commit `4e0044de08f9d8a22504971b470fc0cea185c8f1`. The previous live worker module and the SHA-256 hashes of `/app.js` and `/index.html` were checked against that source before applying the update. The existing asset map was retained, changing only those two files and adding `/meta-pixel.js` and `/meta-pixel.css` (234 → 236 assets; 14 modules retained).
4. Worker version `41d8a9a9-e236-4d0c-b4bf-7ec569582ba6` serves 100% of traffic, in deployment `62f72c79-af1c-4c2c-a695-9ecc76ac7e14`. Recovery version: `712fb2da-ebd6-4d19-86ee-cd5c1d912388`. Pages `trendjo` continues forwarding through its existing `STORE` service binding.
5. Browser QA verified that refusal leaves the store navigable with no Meta script element. Reopening preferences and accepting loads exactly one official Meta script element. Live product `TS0307` (3.99 JOD) was viewed, added to the cart, and checkout displayed 4.99 JOD including delivery. No customer fields were submitted and no real order or notification was created. Meta Test Events had not displayed those events at the time of the first check; live receipt remains pending.
6. Actual `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout` receipt is confirmed in Meta. JOD values and SKU payloads passed local tests; per-event parameters have not been independently inspected in Meta's detail view. `OrderPlaced` has passed local server-accepted/failed/retry tests but has not been tested as a real production order. Keep COD/manual CliQ orders distinct from collected revenue. Campaign budgets and publishing remain a separate task.

## Verification

`npm test`: **132 passed, 0 failed**, including seven new behavioral checks for consent/revocation, blocked/preview/foreign hosts, SKU quantities and JOD amounts, successful/failed order submission, duplicate conversion suppression, absence of customer fields, analytics failure isolation and the administrative CSP. Existing stock, security, order, variant and notification tests also passed. `node --check` and `git diff --check` passed.

Live browser receipt is confirmed; order submission tests use local synthetic data and no real notification destination.

## Live receipt confirmed — 2026-11-01

Events Manager overview for 1 November 2026 (Asia/Amman) lists `trendjo.pages.dev`, the Meta Pixel integration, and four active browser events: **PageView 6**, **InitiateCheckout 2**, **ViewContent 1**, **AddToCart 1**. These are aggregate counts and may include earlier QA; they cannot be attributed exclusively to the owner's phone session. No Purchase or OrderPlaced receipt is claimed. The installation reminder remains at 50% in Meta's optional setup checklist, while the four event rows themselves explicitly show active.

Automatic advanced matching, automatic events, and automatic detailed page/product enrichment are off. Campaign spending has not been started.
