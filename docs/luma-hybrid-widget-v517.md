# Luma embedded chat and native Live audio — v5.17.3

The owner explicitly requested implementing and activating native bidirectional voice alongside text chat, and authorized the existing Cloudflare and Google resources. Hosting stays on the existing Pages -> private STORE service binding -> trend-shop-jo Worker. Pages advanced mode ignores the functions directory, so the requested Pages adapters share the same Worker implementation; actual production endpoints are also registered in src/worker.js. No parallel credential-bearing test service is created.

## Files and behavior

- functions/api/session.js, chat.js and luma-tools.js: Pages adapters for the same protected server handlers.
- functions/products.json.js and the /products.json Worker route: live factual inventory read from D1, filtered to approved, available cosmetic products. No stale static product export drives recommendations.
- src/luma-assistant.js: shared persona and function declarations, streaming 3.5 Flash-Lite text, constrained 3.8 Live token issuance, canonical product tools and current-catalog refresh during a call.
- public/luma-widget.js and CSS: Arabic RTL floating dialog, phone layout, contextual quick replies, product cards and AM/PM labels, existing-cart integration, optional local photo preparation, generic WhatsApp handoff and explicit processing consents.
- public/luma-live.js, luma-pcm.js and luma-audio-worklet.js: microphone PCM at 16kHz, native PCM output at 24kHz, interruptible Web Audio queue, mute, connection failure handling, duration limit and microphone release on close, navigation or backgrounding. No SpeechRecognition, MediaRecorder or input/output transcription is used.
- Existing launcher entries now open the widget. The existing assistant URL opens the same interface. Legacy handler/source remains available for compatibility.
- Admin controls can enable/disable voice and set its additional daily issuance cap. Text model for the new widget is 3.5 Flash-Lite; native voice is 3.8 Live.

## Boundaries and lifecycle

All paid routes require owner activation, paid-project confirmation, same origin, an explicit request header, adult confirmation and Google-processing consent. Voice also requires separate audio consent. Images require separate photo consent and are locally re-encoded without EXIF/GPS. Unknown ingredients never become invented pregnancy/breastfeeding safety claims. Concerning signs lead to professional assessment and a generic store WhatsApp button, without product sales. Staff clinical qualifications are not asserted.

The permanent key remains a server binding or encrypted owner configuration. Only a one-use auth_tokens resource reaches the browser: 60 seconds to start, 180 seconds overall expiration, with the full model, system instruction, tools and AUDIO-only setup constrained on Google's server. The client cannot override that setup. Session resumption is not enabled. Microphone input streams directly to Google; no audio, transcripts, tokens or customer profiles are saved in D1. Only aggregate daily issuance and request counters are stored. The voice cap initially targets 10 attempts/day, within the existing 50 total customer requests/day; these are request counts, not monetary caps.

show_products re-reads live prices and stock, validates IDs, area, current budget and cosmetic eligibility, then sends cards. get_catalog can discover newly approved products during an existing call. Tool calls do not add to cart: the customer's button delegates to the existing cart logic, including required shade/variant choice and stock checks. Text tools have a bounded three-round inference loop with a shared 40-second deadline; only the initial HTTP 503 may receive one delayed retry, respecting longer Retry-After values. Stream cancellation aborts upstream I/O immediately.

## Verification before publication

The full suite passed 433 tests after the cancellation-lifecycle refinement. The 21 new assistant tests cover native client protocol, PCM resampling, interruption, microphone denial/cleanup, consent, token locking and expiry, daily caps, fresh prices/stock, function response IDs/signatures, one-question quick replies, bounded SSE, cancellation and the Pages binding adapter. The final source must also pass CI before activation. Wrangler dry-run succeeded.

A managed local browser preview at 390 CSS pixels displayed the question, quick replies, product cards and totals. The dialog measured 374px within the 390px viewport, with no horizontal overflow. This preview used clearly identified synthetic fixtures, not Google recommendations. The browser has no microphone; its NotFoundError path correctly kept chat usable and did not mint a token.

A separate direct request to Google's official API, using the provided credential through hidden terminal input and only synthetic data, verified the initial locked Live setup and native audio/tool transport. Results: auth token HTTP 200, setupComplete=true, 6,400 bytes of synthetic 16kHz PCM input, 271,202 bytes of native PCM output and a show_products function call. Input and output audio transcription were absent. No real person's audio or personal information was submitted. This validates Google protocol/native output/tool transport; real iPhone microphone acoustics and interruptions still need a physical-device check.

Primary references checked 2026-11-12:
- https://aistudio.google.com/docs/live-api/ephemeral-tokens
- https://aistudio.google.com/api-reference/live
- https://aistudio.google.com/docs/live-api/tools
- https://aistudio.google.com/docs/live-api/best-practices
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live
- https://developers.cloudflare.com/pages/functions/advanced-mode/

## Conversation refinement — v5.17.3

The first production conversation revealed repeated questions for face area and balanced/non-sensitive skin already stated in the original message. Tool calls now carry a validated profile extracted by Gemini from explicit customer words; the browser retains it only in memory and supplies it in subsequent text/voice tool requests. The server suppresses questions for already known fields while still allowing explicit changes. Budget questions remain separate from inferred preferences. Native voice can acknowledge an explicit oral budget confirmation without speech-to-text or a mandatory click; an already confirmed budget cannot be silently increased. Quick replies remain disabled until the current response finishes. Twenty-four focused integration/client tests pass; the final CI gate covers the whole suite.

## Price presentation — v5.17.3

Production cards showed the correct 11.99 JOD total, but the model re-quoted prices in free text using an ambiguous comma/three-decimal format. Text recommendations now stop after canonical cards and a short plain confirmation, eliminating a redundant generation pass and preventing a second price list. Catalog/tool facts expose decimal priceJod and fixed priceLabel values; internal *Fils fields are removed from function results sent back to Gemini Live, while the UI retains integer-fils arithmetic. Two additional integration tests cover this separation and the single-generation card path.

## Quick reply fallback — v5.17.3

A production model turn asked to confirm the budget in plain text instead of invoking ask_question. The widget now supplies optional 5/10/15/20 JOD choices for this observed budget-clarification case without adding a duplicate question. Product selection remains with Gemini. Twenty-seven focused tests pass; final whole-suite CI remains the release gate.

## Final publication

Commit `06c491c690fb63eead2f962ea314e4f23fecf7f6` passed full CI run 43212196758 (439 tests) and was deployed at 100% as Worker version `63b09e4a-1b00-458f-93f5-a1508543f626`, deployment `07fdbee3-adf2-4726-98b0-a6cd721944f8`. Settings revision 4 keeps the assistant, optional images and native voice enabled, with 50 total customer requests and 10 call-issuance attempts per day. All nine existing binding names/types were retained. The production store launcher opened the dialog without navigation, the native-call button was visible, and the plain-text budget clarification displayed functional quick replies.

The final production conversation moved from the original stated face/balanced/non-sensitive request to budget confirmation and product cards without repeating those preferences. It selected TS0109 at 4.49 JOD and TS0020 at 4.99 JOD: 9.48 JOD subtotal + 1.00 JOD delivery = 10.48 JOD within 15 JOD. The product button changed to the added confirmation and the existing cart count increased from 0 to 1 without navigation or creating an order. Prices were displayed in canonical cards without a second model-generated price list. The native-call button remained visible. Physical iPhone microphone acoustics were not tested; native audio/token/function transport and no-device cleanup were verified separately as described above.
