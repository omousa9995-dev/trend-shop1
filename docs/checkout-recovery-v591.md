# Trend Shop 5.9.1 — interrupted checkout recovery

An order can be saved even when its confirmation response is lost. Previously,
reloading the page discarded the in-memory delivery form, while receipt recovery
ran only after validating that form and the current stock. An already-saved order
could therefore remain hidden behind empty-field or sold-out errors.

The storefront now checks the existing session receipt key once during startup
and before validation on a manual confirmation retry. A recovered receipt shows
the stored reference, payment method and actual total. This lookup never creates
an order or sends mail. Offline or unconfirmed lookups retain the same key and
cart; order submission still requires an explicit confirmation. Session storage
continues to contain only the opaque key and timestamp, with no contact details.

## Validation

- Three regression scenarios failed before the fix and passed after it: reload
  with empty fields and depleted stock, offline reload followed by manual receipt
  recovery, and reload when no server receipt exists.
- All 336 automated tests passed, including packaged Worker import, checkout,
  stock contention, idempotency, order administration, mail and workbook tests.
- Only `public/app.js` and the storefront's versioned script reference change in
  the production package. The admin assets and all server modules are preserved.
- The 50 rendered-browser concurrency test remains unverified: local Chromium
  cannot start because the execution environment disallows its required sockets.
  Prior HTTP-client results must not be described as rendered-browser results.

No new production test order or email is needed for this release. Customer order
tracking remains deferred. This change does not implement a durable mail queue.

## Publication status

Published after explicit user approval on 9 November 2026 at 00:15 Jordan time
(8 November 21:15:11 UTC). Worker version
`9871c423-ff7f-4dfc-9413-327f3700b74e` (number 51) serves 100% of traffic under
deployment `4b279443-6a4b-4c35-934f-d185c5a47bcb`.

The implementation is saved in commit
`76c88d7c607b67af9293419bd07646ac80eb86b2`, whose GitHub validation passed.
The production package was made from the deployed modules by replacing exactly
two embedded assets after checking their baseline SHA-256 hashes against the
repository. All bindings, live-store settings, media and observability remain
inherited. No database migration or production test order was needed.

After publication, storefront HTML and app JavaScript matched the tested source
byte for byte. Store, admin, a server-rendered product, catalog and mail health
returned 200. The catalog has 302 products with live ordering; mail health reports
configured/reachable/canSend. Unauthenticated order administration and customer
reports returned 401. In the live browser, «تونر» search displayed matching
products and selecting Anua opened TS0091. The browser loaded `/app.js?v=5.9.1`.

The prior publication attempt was blocked by automatic approval review. The user
then explicitly approved publication; the same staged version was deployed
through the original API route. No workaround was used.

Rollback code by deploying prior Worker version
`1111b562-d1a2-4ec8-9b47-af21ee1f5c1b`, without restoring or resetting business
data. The staged Version URL had returned 404 before publication; browser
verification here refers to the production store.

See `checkout-recovery-v591-verification.json` for the retained hashes and status.
