# Luma 5.20.1 — conversation stability and faster text care

Owner request: eliminate the freeze after a few messages; prioritize response speed; remove all recording and playback; give useful everyday care without a budget questionnaire or compulsory pharmacist referral; use the site girl's avatar; apply the confirmed Jordan delivery/management facts.

## Implementation

- Complete a chat turn on terminal SSE `done`/`error` rather than waiting for TCP EOF or a possibly stalled cancel hook. Each request owns its abort controller and sequence. Stop, reset, close and retry cannot let a stale finalizer lock a newer request. Preserve drafts typed during a response.
- Keep up to eight paired turns in memory, with a 12,000-character server/client history ceiling. Persist resolved care preferences and canonical displayed IDs in their proper turn order. No chat localStorage or transcript database.
- Seed at most eight relevant live products with full canonical usage/ingredient facts. Ordinary advice/routines can finish in one model call; missing facts can use at most two further rounds. Remove duplicate history/prompt content. Flash-Lite uses its supported minimal thinking level for store actions; the 3.8 fallback retains low. The current need outranks old assistant prose when shortlisting products. Explicit face/body and skin-type changes are understood before preparing candidates. Per-provider attempt 18 seconds, whole inference 40 seconds, browser 45 seconds. Preserve the existing bounded provider fallback and daily quota.
- Clear non-shopping dry-skin/acne and hydration questions use reviewed direct care guidance without inference, with medical constraints excluded from the fast path.
- Delivery and management FAQs use exact owner-approved local facts without paid inference. All Jordan in 24 hours after order confirmation; a 7pm order is estimated tomorrow around/before 3pm; preferred appointment in checkout notes; WhatsApp +962790025430.
- No budget questions. Ignore invented model spending limits; optionally respect a voluntarily stated limit. Block explicit budget question actions before display. Preserve canonical stock/price and pregnancy/active-ingredient checks.
- Practical dry-skin and mild face/back acne guidance, balanced hydration advice, gentle pat drying and moisturizing while slightly damp, sweat/clothing/no-scrubbing advice; clinical escalation retained for actual warning signs. Remove routine pharmacist pitches.
- Remove the recording/import/playback code and controls from the mounted widget, set dictation capability false and retire transcription with HTTP 410. Disable microphone permissions. Existing optional image support remains.
- Reuse the existing girl image with a circular CSS crop in the header/footer and dialog. Preserve product-page exclusion and no floating assistant entry.

## Local validation — 2026-11-13

`npm test`: 488 passed, 0 failed. Deployment source graph built successfully (40 modules). `git diff --check`: clean.

New regressions include 20 sequential UI sends against never-closing SSE streams and never-resolving cancel hooks, explicit abort, stale request isolation after close/reopen/reset, network retry with a pending draft, correct history pairs/size, exact management/delivery facts, seeded body-care selection, no audio APIs and budget-question repair. Obsolete audio/budget tests now verify their explicitly requested retirement rather than the previous behavior.

## Live validation

Production: https://trendjo.pages.dev/ — source commit `28e0fafb114d3c70a403c0964a8f3854098ed503`, Worker version `42179dd9-7a45-4890-a694-75ce3a0bf93f` (92), deployment `b191c3ba-cb77-4a8b-a3a1-c612dec3b68c`, 100% active. GitHub validation succeeded for that exact source. Binding names/types and observability retained.

A fresh real storefront conversation completed 12 consecutive successful messages without reloading. Send remained enabled after the twelfth turn; no recording, audio upload or playback controls were present. The test switched between facial acne, exfoliant compatibility, dryness, back acne, sweat care, hydration, delivery and management contact, then selected a lightweight face moisturizer after those topic changes. No budget question or automatic pharmacist handoff occurred. The last routine showed a live canonical product card with no internal catalog ID in the visible answer.

Measured model response durations (server timer, milliseconds): face routine 3445, exfoliant follow-up 2761, mild dryness 2238, back routine 3247, sweat care 1695, last moisturizer 3099. The same face-routine request took 14058 ms in the earlier low-thinking version. This is a small functional latency sample, not a load-test SLA. Quick FAQ/care requests took 626–1046 ms including browser interaction/network overhead.

Delivery answers confirmed all Jordan within 24h, the 7pm → tomorrow approximately before 3pm example, and scheduling via checkout notes. Management contact was the exact existing WhatsApp +962790025430. No orders or customer records were created or modified.

Evidence: [screenshot](verification/luma-v5201-live.jpg), [12-turn observations](verification/luma-v5201-checks.json).

The final publishing attempt succeeded after earlier Cloudflare 500/10013 responses; browser login was not needed to complete activation. The secure login retry timed out without a confirmed signed-in session.

Technical basis for the model-specific latency configuration: https://ai.google.dev/gemini-api/docs/thinking (3.5 Flash-Lite supports minimal; 3.8 uses low). Practical care references remain in `src/luma-care-knowledge.js`.
