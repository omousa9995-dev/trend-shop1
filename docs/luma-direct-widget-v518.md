# Luma 5.18.2 — direct chat, recorded dictation and spoken replies

Requested by the store owner on 2026-11-12. Existing Trend Shop Pages/Worker hosting and nine production bindings are preserved.

- Text chat starts immediately without age/provider checkboxes or a preliminary consent panel. The new API validates input directly; it never fabricates an adult or provider acknowledgement. Provider processing remains accurately described in the store privacy page.
- Native Live calls, client PCM/worklet files and the public Google WebSocket CSP permission are removed. Old session/tool URLs return 410 and cannot create tokens, even with stale settings.
- Optional recordings require a separate affirmative recording action. MediaRecorder negotiates WebM/Opus or MP4 for iPhone/Safari. Maximum 45 seconds, 1 MiB; the microphone stops before transcription. An existing M4A/WebM/OGG/WAV recording can also be attached through the same recording choice. The transcript is placed in the editable composer, never sent as a chat message automatically.
- `/api/transcribe` validates same origin, request marker, consent, size, duration bounds and container signature. Gemini 3.5 Flash-Lite returns only a structured transcript. Unclear audio causes a retry message, never invented advice. Both transcription and chat consume the existing atomic daily request cap; no customer audio or transcript is stored.
- Each model bubble has a user-operated Arabic speech button when the device supports speech synthesis. It uses available Arabic device voices, not a call. Recording, hiding/closing the window and starting another reply stop playback. Actual voice availability depends on the user's OS/browser.
- The modal locks and restores the storefront scroll position and original styles. Visual viewport resizing adapts to the keyboard. Text input stays enabled during streaming so a next draft survives; sending is serialized. The launcher sits lower and is smaller on mobile.
- The care playbook covers mild facial/back blemishes, dry hands/heels, sensitivity, ingredient compatibility, known eczema, pitted scars/wounds, pregnancy/nursing and makeup shades. These are reviewed instructions and examples, not fine-tuning or learning from customer data. General care and reasonable documented OTC self-care are allowed; no blanket medicine-word filter suppresses ordinary advice.
- Live inventory includes exact approved PanOxyl 4%/10% washes for face/body, with manufacturer-label facts, current prices/stock and no duplicate cleanser step. Prescription products, unknown benzoyl-peroxide strengths and strong peel solutions remain excluded. Known pregnancy/nursing prevents automatic active-product cards. Model instructions require helpful care first, optional products last, and appropriate medical evaluation for serious signs.
- The owner confirms Trend Shop pharmacists are available. Their fixed WhatsApp action is the final optional follow-up after completed recommendations; no conversation or health profile is placed in the WhatsApp URL.

Validation before release: full `npm test` **442/442 passed**; Wrangler dry run passed. Includes direct messaging, transcript-only behavior, microphone cancellation, body/style restoration, draft preservation, speech opt-in, fresh catalog prices/stock, retired endpoints and concurrent atomic quota checks. These tests do not constitute a real iPhone microphone/keyboard/acoustics test or a 100-browser load test.

Reviewed primary references: `src/luma-care-knowledge.js` lists AAD back acne, face washing, dry skin, cracked heels and pregnancy guidance, and exact manufacturer PanOxyl 4%/10% labels. Dictation follows Gemini audio input documentation; MediaRecorder format negotiation and SpeechSynthesis use the standard browser APIs documented by MDN.

Production verification and exact deployment identifiers are appended after publication.

## Production checks and response refinement

Initial production deployment of 5.18.0 exposed an incomplete care answer despite passing local checks. The dictation endpoint successfully transcribed an 86,638-byte, 2.705-second synthetic WAV into the editable composer ("I need a gentle cleanser for my dry skin.") without automatically sending it. No real voice, customer data or new order was used.

5.18.1 reduces the initial catalog to a compact factual index, retrieves exact detailed facts for at most eight requested IDs, caps general lookups at twenty entries and allows 4096 output tokens per bounded round. This reduces repeated prompt payload for the enlarged eligible catalog. Incomplete answers return only a safe enumerated error code; partial text is replaced with a clear retry message. No upstream diagnostic bodies, customer content or credentials are logged. Final live verification follows the redeployment.

5.18.1 completed the actual care text, but the provider AUTO mode mentioned a product without calling its card tool. 5.18.2 requires a response function on every real turn (`ANY`): `answer_customer` for care-only/FAQ, `ask_question` for one missing detail, and `show_products` for any recommendation. This preserves direct care answers without a budget question and makes cards part of the recommendation contract. The client no longer manufactures a budget confirmation merely because a sentence contains the word budget.
