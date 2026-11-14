# Trend Shop 5.21 — timed product offers and genuine Luma streaming

Owner request, 15 November 2026 (Jordan): remove the three large trust tiles; replace their position with three compact timed product cards managed in a dedicated admin area; keep prices consistent across discovery, product pages, assistant and checkout; create a new product and its campaign together when needed. Improve Luma streaming, image reliability, general help, cosmetic shade guidance and clear controls.

## Offers

- Removed the trust tiles from the homepage. The replacement uses a distinct plum/gold treatment and a fixed three-column grid, including on narrow mobile screens. Days and HH:MM:SS count down to the real end time. A section with no actual active campaigns stays hidden: no invented discounts, campaigns or restarting urgency clocks.
- Dedicated admin tab **عروض لفترة محدودة**, also reachable through `admin.html#limited`, with three editable slots. Existing products retain their regular price and stock. Start/end inputs explicitly use Jordan time, independent of the administrator device timezone.
- The shared effective-price function drives storefront cards/lists, product detail, Luma's live catalog, cart and order calculation. The customer's browser uses server-clock offset and restores regular prices at campaign boundaries. Lightweight campaign refresh discovers later admin edits without refreshing the whole catalog every second.
- The order-item database trigger validates the effective price again inside the stock transaction. Expired or changed-price carts cannot silently purchase at a stale promotional price. Existing pair/bundle pricing policy remains intact.
- New-product fields select the category and product type, stock, ordinary price, picture, optional Korean-care membership and usage text. Product insertion plus campaign insertion runs in one guarded D1 transaction. Retries do not duplicate products; stale slot revisions cannot leave an orphan new product. The product remains in its normal catalog section after expiry.
- Migration 0033 adds an empty campaign table and updates price validation only. It creates no commercial campaign, order, review, stock or selling price.

## Luma

- Genuine upstream SSE via stateless Interactions, with streaming generateContent fallback. Customer-visible text is decoded from the action string as chunks arrive; raw JSON, thought signatures and reasoning are never forwarded. Product selections are validated before their practical care plan may stream. Completion does not wait on EOF or a stalled cancel hook.
- Request/sequence isolation is preserved. Replacing partial fallback output cannot concatenate two answers. Retry reuses the exact failed text/photo payload without duplicating the customer's bubble or losing the next typed draft.
- Local image decoding has a deadline and bitmap fallback. Images are resized and re-encoded to JPEG below 768 KiB; the upload does not include the original EXIF. A failed decode releases the composer, and a later picture can be selected normally. Unsupported browser HEIC decoding gives a clear JPG/screenshot alternative.
- Camera icon replaces the photo text control. A visible new-conversation button is in the chat header. Recording and audio playback remain absent.
- Practical general assistance comes first; products are optional and last. An adult's own hand/wrist photo is explicitly supported for tentative cosmetic depth/undertone guidance. A suggested tone is only an actual available option; no invented manufacturer shade number. Lighting, hand/face differences and a final jaw/daylight check remain relevant.
- Exact discount/previous-displayed-price and timed-offer FAQs read current store data. Authenticity replies are courteous and let the Trend team verify the particular source/batch, without inventing a universal guarantee or authorization claim. Ordinary support uses the store-team contact; actual clinical warning signs retain professional assessment.

## Validation

`npm test`: **507 passed, 0 failed**. The deployment graph builds successfully: 46 modules and 642 static files. `git diff --check` passes.

New regressions cover scheduling/expiry, exact cents, Jordan timezone conversion, timed checkout validation, campaign replacement/stop, simultaneous edits, atomic product creation, replay preservation, three-slot admin interaction, real partial upstream output before terminal completion, Unicode/JSON boundaries, hidden thoughts, streaming API fallback, exact shade options, current promotion FAQs, image-decode timeout recovery and photo-preserving retry.

Production verification and rollback identifiers are recorded alongside this release after activation. No claim of native iPhone hardware testing or zero possible future provider errors is made.

Technical references: [Google Interactions streaming](https://ai.google.dev/gemini-api/docs/streaming), [generateContent streaming](https://ai.google.dev/api/generate-content), [Cloudflare versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/).
