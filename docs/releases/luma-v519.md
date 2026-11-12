# Luma 5.19.0

Recording starts on a microphone click, subject only to the browser's microphone permission. Stopping (or reaching 45 seconds) transcribes and submits one message automatically. Cancelling never submits; separately typed drafts survive. Recordings, photos and conversations are not written to the store database.

The only storefront entry points are beside the header wordmark and in the footer. Product, checkout and order routes hide both entries and destroy any mounted chat, microphone and page lock. Product SSR strips the entries from the HTML. No floating or Korean-care navigation entry remains.

Chat now uses bounded `generateContent` JSON responses, retaining the storefront SSE transport. A transient first-model failure can use a bounded alternate from Gemini 3.8 Flash / 3.5 Flash-Lite. Function continuations stay on the successful model to preserve tool IDs and thought signatures. Authentication, billing and invalid input are not blindly retried; long Retry-After hints are respected. Safe attempt categories contain no credentials or raw provider bodies. Admin connection testing makes a real small inference and records its aggregate usage instead of checking metadata alone.

Product cards still re-read approved live stock/prices, enforce confirmed budgets and supported areas, and use the existing cart integration. Acute injury guidance is immediate and provider independent. Cosmetic care stays useful without inventing diagnoses, ingredients or treatment guarantees.

Validation before publication: 456 passing tests, including atomic daily caps, exact product prices, function signatures, aborts, alternative-model bounds, automatic voice submission, cancellation, draft preservation, product-route cleanup and SSR exclusion. Actual production verification is documented separately after deployment; local tests alone do not prove upstream availability. Native microphone and device speech need hardware/browser verification.
