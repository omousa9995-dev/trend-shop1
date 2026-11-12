# Luma 5.18.4 — direct chat, recorded dictation and spoken replies

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

5.18.2 production checks succeeded for an actual complete back-care routine, PanOxyl 4% (TS0230, 8.99 JOD), body moisturizer (TS0335, 3.50 JOD), delivery (1 JOD) and total 13.49 JOD under the stated 15 JOD budget. The PanOxyl card added to the existing cart. A care-only dry-hands question returned practical steps without purchase/budget questions. A separate hypothetical deep-wound check encountered provider HTTP 503.

5.18.3 therefore adds a narrow, negation-aware immediate response for explicit deep wounds/uncontrolled bleeding before provider inference or paid quota reservation, based on NHS first-aid guidance. It advises timely emergency care before the final supplementary pharmacy follow-up and returns no product cards. This is not a disease classifier. The general specialist message no longer assumes every issue is a photo or a dermatology-only problem.

Speech controls are implemented using device synthesis. The cloud test browser returned a synthesis error; audible Arabic playback and a physical iPhone microphone/keyboard remain unverified on a real device. Recorded synthetic audio transcription was verified successfully on production.

## Final deployment

Published **5.18.3** at https://trendjo.pages.dev/ with 100% traffic on Worker version `4f3f1116-97bb-40a3-a9aa-0b0a84a513b5`, deployment `fcc1c180-feb5-4916-992e-826307164952`, source `3b90fb5ad4f80a943ca5082b6c0437faa981b570`. Package SHA-256: `93ff71db9db82b2e58cb841fe5139ed259dabf94a01be5f87a841e42467271e2`. All nine bindings preserved. Settings revision 5 disables Live and enables optional dictation; the existing 50-request/day cap is retained.

Final full suite **447/447 passed**; CI **43253978452** passed. A production hypothetical deep-wound/continuous-bleeding message immediately produced the intended emergency guidance, no product offer, and a final pharmacy WhatsApp link. Earlier actual production checks verified complete care steps, canonical product cards/cart, direct advice without a shopping questionnaire, and a reviewed transcript from synthetic audio.

Some later ordinary model requests returned provider HTTP 503. This is an observed availability limit, not a guaranteed continuous service. The UI offers a clear retry; urgent explicit injury guidance works independently. Device speech controls were tested, but the cloud browser could not synthesize audio. Do not claim verified audible Arabic output or a real iPhone microphone/keyboard test. No order, payment, customer message or email was created.

5.18.4 adds the fixed pharmacy WhatsApp follow-up when inference is unavailable, while preserving the retry/error state and recording exactly one failed request. No fabricated care answer or product recommendation substitutes for an unavailable provider.
