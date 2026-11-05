# Aqua-Fresh product review pilot — v4.2.0

The requested review product is **TS0081**, Beauty of Joseon Relief Sun Aqua-Fresh Rice + B5. The storefront enhancement, extra copy, video cover editor and video ordering are enabled only for this product. The home page and other product experiences are not enrolled.

## Customer experience

- A concise bilingual introduction, prominent actual single-item price, three specific benefits, size, ingredient explanations, three usage steps and five product questions.
- A mixed portrait card strip after usage, with a partial next card visible on phone layouts. Photos open even when no video has been uploaded. The original pack stays first in the main gallery.
- Uploaded clips appear first in the strip, load near the viewport, play muted and loop. Offscreen, hidden-page and reduced-motion handling limits unsolicited motion and work.
- A modal viewer offers swipe/arrow navigation, native video controls, an always-visible seek slider, rewind/forward five seconds, pause/play, sound control, a close button and an action returning to the existing quantity selector.
- Native dialog behavior plus keyboard controls/focus management, body-scroll restoration, scoped cleanup on route changes, and no gesture navigation over the native seek control area.
- Existing pricing, quantity selection, cart, checkout, verified reviews and delivery calculation remain authoritative. No new discount or unverified customer result is invented.

## Video management

The existing authenticated admin video uploader still accepts the same formats/limits. For TS0081, its video cards additionally let the owner edit captions, choose the pack/care-scene cover and move clips earlier/later. These actions keep existing session/CSRF checks, only accept local image covers, require the exact complete product video list for reordering, and cannot edit another product's presentation.

At pre-publication inspection there were **zero TS0081 video uploads**. The production page uses the two existing product photos until the owner uploads a genuine clip for this product. No competitor clip or other product's clip was attached. A synthetic nine-second color clip was used only in the isolated QA Worker, without production DB or mail bindings. It is excluded from the production package and registry.

## Sources

Manufacturer product information and the official pack-directions page were reviewed on 2026-11-05. References are stored in `public/product-stories/TS0081.json`; they are not rendered as external shopping links. The copy distinguishes this Rice + B5 lotion from original Rice + Probiotics and retains reapplication and water-resistance guidance.

## Validation

- `npm test`: **222 passed**, including new mixed-media interaction, explicit seek/sound, lifecycle, reduced-motion, scoped admin authorization, atomic ordering, cover validation and guarded copy migration cases.
- Browser QA: desktop and a **415 px** phone frame; portrait video measured **0.5625** width/height; actual autoplay/mute/loop, pause, +5/-5 seeking, sound toggle, pointer swipe into a photo, close and return to quantity controls all verified.
- The phone page had no document horizontal overflow; the card strip retained intentional horizontal scrolling and a visible next-card edge.
- No physical iPhone hardware test was performed. No real order was submitted and no test email was sent.

## Data and rollback

`0023_aqua_fresh_video_presentation.sql` adds two backward-compatible columns to existing video rows. `0024_aqua_fresh_pilot_copy.sql` updates only TS0081 description/details when both match the exact reviewed baseline, preserving concurrent owner copy edits. Neither changes product price, stock, orders or order items.

Source backup: `backup/v4.1-before-aqua-fresh-pilot-2026-11-05`, based on `00e07a9a952f833f6b47ad07e289872fc73f6947`. The before-copy record is retained in the versioned pilot data file and a private deployment backup. A source rollback can ignore the two additive columns; a copy rollback must remain conditional so it never overwrites later owner changes.
