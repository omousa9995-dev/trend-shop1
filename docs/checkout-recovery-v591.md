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

The production deployment and byte-verification record is saved separately in
`checkout-recovery-v591-verification.json` after publication.
