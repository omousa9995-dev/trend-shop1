# Luma 5.19.6

The saved 5.19.5 version had not been deployed when this continuation started. It was activated after CI and 462 local tests passed. Live ordinary chat and a two-product routine still returned provider HTTP 503, so activation alone did not establish reliability.

This release sends validated JSON actions as ordinary text through stateless Interactions first, pinned to API revision 2026-05-20. One bounded alternate uses generateContent without native functions, a JSON MIME constraint or a response schema. Authentication, billing, long Retry-After hints, cancellation and the shared daily cap keep their existing limits. Product cards still come only from current server stock and prices. A complete JSON fence is accepted; unknown/malformed actions and partial answers remain failures. Provider thoughts never become visible customer text.

Header/footer placement, product-page exclusion, recording cancellation and automatic transcript submission are unchanged. The temporary diagnostic entry point was never deployed and is absent from this release. No new public diagnostic endpoint or credential is introduced.

Validation before deployment: all 465 unit, DOM and database integration tests pass; git diff --check passes. Tests cover both API formats, bounded fallback, invalid actions, current stock/prices, multi-round routines, automatic audio submission, cancellation and entry-point lifecycle. Live verification follows deployment; physical iPhone microphone capture and device speech are not represented as hardware-tested.

References: [Interactions](https://aistudio.google.com/docs/interactions-overview), [text generation](https://aistudio.google.com/docs/text-generation), [API errors](https://aistudio.google.com/docs/api-errors?generate-content=true).
