# Luma activation and bounded capacity retry — v5.16.2

The owner confirmed Google billing activation and authorized completing the connection. The existing Cloudflare secret supplies the credential; no key is present in this repository. The live singleton settings are revision 3: enabled, optional images enabled, paid-project confirmation recorded, Gemini 3.5 Flash-Lite selected and 50 customer requests per UTC day. Failed customer requests also count. The daily request cap is not a monetary spending cap.

Gemini 3.8 Flash model metadata was accessible, but actual generation repeatedly returned HTTP 503 for high demand. An explicit owner-authorized configuration change selected Gemini 3.5 Flash-Lite after successful generation checks. The application does not silently switch models.

## Live verification

Direct Google requests with the application's real catalog prompt, schema and result normalization succeeded with 3.5 Flash-Lite. A face-care routine selected TS0109 and TS0059 for 14.48 JOD including delivery, within a 15 JOD budget. These were current, approved and in-stock products at verification time.

The production customer page also completed a real conversation. With a confirmed 15 JOD budget including delivery and an explicit request for a cleanser and light moisturizer, Luma displayed TS0109 at 4.49 JOD and TS0103 at 6.50 JOD. The visible subtotal was 10.99 JOD, delivery 1.00 JOD and total 11.99 JOD. Links pointed to the canonical store product pages. An earlier natural conversation successfully extracted and confirmed a budget through quick replies; one intermediate request failed, then a manual retry succeeded.

The actual production photo picker accepted a generated 32×32 white JPEG, showed the local preview and separate Google photo-processing consent, and submitted it through the customer flow. Luma returned the unsupported-image guidance with no product cards; the photo preview was cleared after the request. No real person's face or customer health information was used. This verifies upload and safe handling of an unusable image, not skin-image accuracy or diagnostic capability.

## Reliability change

The observed temporary provider failure motivated one bounded retry for HTTP 503 only. Both attempts use the same model, body, credential and 35-second AbortSignal. The first response body is cancelled, then the server waits one second with abort-aware cleanup. A second 503 ends the request. A longer or invalid Retry-After value prevents retry. Authentication errors, invalid requests, 429 quota errors, network exceptions, timeouts, malformed JSON and truncated replies are not retried. The customer request reserves daily usage once and records one final outcome.

All 412 automated tests passed, including 25 assistant tests. New integration coverage verifies successful retry, persistent capacity failure, response-body cancellation, unchanged request/deadline, single daily reservation, private-error suppression and no retries for authorization/quota failures or longer cooldowns. Frontend asset versions and database schema are unchanged.

Google's official generateContent error reference identifies 503 as temporary capacity unavailability and recommends waiting and retrying: https://aistudio.google.com/docs/api-errors?generate-content=true .

The candidate preserves the existing 32-module embedded-assets deployment with 632 static files. Package SHA-256: `4adeb60f7d72dead8fcdf8ebdeb4e7e5403ceb151ea09645894dea38785c94d5`. Deployment uses the existing Worker and inherited bindings; no credential-bearing verification resource is created.
