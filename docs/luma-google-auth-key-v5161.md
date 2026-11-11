# Google authorization key connection — v5.16.1

The owner supplied a Google credential and explicitly requested connecting it to the store. It was stored through Cloudflare's Secrets API as `GEMINI_API_KEY` on the existing `trend-shop-jo` Worker. No credential value, fragment or fingerprint is included in this repository, public assets or this record.

The server already supports the secret binding. The admin key validator now accepts the dot used by modern Google authorization keys. A replacement key saved by the authenticated owner takes precedence over the environment fallback, so rotating a credential through the admin panel actually changes the key used for requests. Both paths continue using the `x-goog-api-key` header to Google's official API. Read APIs expose key presence only.

On 2026-11-11, an authenticated Google model-metadata request returned Gemini 3.8 Flash successfully. An unauthenticated direct request received a Google permission-denied response. A direct server-side generation check using only a synthetic `READY` prompt received HTTP 503 `UNAVAILABLE`, reporting temporary high model demand. This is not evidence that customer inference works, nor does metadata access verify project billing.

No customer messages, profiles or images were submitted. The paid-project confirmation, customer activation and optional-image settings remain unchanged and off pending the owner's billing confirmation and successful inference validation. No billing account was created or payment made.

A proposed separate public verification Worker was rejected by automatic approval review; no such resource was created. Verification continued through a materially safer direct Google API request, keeping the existing store as the only resource holding the credential. No temporary verification Workers remained after the check.

Validation: all 409 tests passed, including 22 care-assistant tests. The new integration test uses synthetic credentials only, checks modern dotted-key storage, encrypted rotation overriding the environment fallback, absence of key values in read APIs and rejection of newline/header-injection input. No frontend behavior or existing checkout settings changed.

Primary reference: https://aistudio.google.com/docs/api-key (checked 2026-11-11).
