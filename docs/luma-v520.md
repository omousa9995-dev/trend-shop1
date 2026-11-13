# Luma 5.20.0 — conversation stability and faster text care

Owner request: eliminate the freeze after a few messages; prioritize response speed; remove all recording and playback; give useful everyday care without a budget questionnaire or compulsory pharmacist referral; use the site girl's avatar; apply the confirmed Jordan delivery/management facts.

## Implementation

- Complete a chat turn on terminal SSE `done`/`error` rather than waiting for TCP EOF or a possibly stalled cancel hook. Each request owns its abort controller and sequence. Stop, reset, close and retry cannot let a stale finalizer lock a newer request. Preserve drafts typed during a response.
- Keep up to eight paired turns in memory, with a 12,000-character server/client history ceiling. Persist resolved care preferences and canonical displayed IDs in their proper turn order. No chat localStorage or transcript database.
- Seed at most eight relevant live products with full canonical usage/ingredient facts. Ordinary advice/routines can finish in one model call; missing facts can use at most two further rounds. Remove duplicate history/prompt content. Per-provider attempt 12 seconds, whole inference 40 seconds, browser 45 seconds. Preserve the existing bounded provider fallback and daily quota.
- Delivery and management FAQs use exact owner-approved local facts without paid inference. All Jordan in 24 hours after order confirmation; a 7pm order is estimated tomorrow around/before 3pm; preferred appointment in checkout notes; WhatsApp +962790025430.
- No budget questions. Ignore invented model spending limits; optionally respect a voluntarily stated limit. Block explicit budget question actions before display. Preserve canonical stock/price and pregnancy/active-ingredient checks.
- Practical dry-skin and mild face/back acne guidance, balanced hydration advice, gentle pat drying and moisturizing while slightly damp, sweat/clothing/no-scrubbing advice; clinical escalation retained for actual warning signs. Remove routine pharmacist pitches.
- Remove the recording/import/playback code and controls from the mounted widget, set dictation capability false and retire transcription with HTTP 410. Disable microphone permissions. Existing optional image support remains.
- Reuse the existing girl image with a circular CSS crop in the header/footer and dialog. Preserve product-page exclusion and no floating assistant entry.

## Local validation — 2026-11-13

`npm test`: 484 passed, 0 failed. Deployment source graph built successfully (40 modules). `git diff --check`: clean.

New regressions include 20 sequential UI sends against never-closing SSE streams and never-resolving cancel hooks, explicit abort, stale request isolation after close/reopen/reset, network retry with a pending draft, correct history pairs/size, exact management/delivery facts, seeded body-care selection, no audio APIs and budget-question repair. Obsolete audio/budget tests now verify their explicitly requested retirement rather than the previous behavior.

## Live validation

To be recorded after publication using the real storefront. No customer orders or customer records are needed for this assistant regression.
