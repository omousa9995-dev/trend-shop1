# Arencia upper video — v5.3.0

The Arencia cleanser page (TS0098) now omits its “Find this product in a bundle” card and contents. The two-item quantity offer and all other product pages remain as before.

A separate upper video slot sits below “Delivery & order details” and its delivery note. It displays one 9:16 video uploaded by the owner, with muted inline autoplay and continuous looping. The customer has no playback buttons, seeking, tap-to-open, fullscreen or picture-in-picture controls in this slot. The slot stays hidden until a valid video is uploaded; autoplay is subject to device/browser settings.

The admin product editor includes “الفيديو العلوي لأرينسيا — فيديو واحد فقط”, visible for TS0098. It uploads directly from the device (MP4, MOV or WebM, up to 20 MiB), shows progress and a preview, and offers replacement/removal. Replacement uses the last loaded video ID to reject stale or competing uploads. The UNIQUE product constraint enforces one video; successful replacement removes the previous media file. A new additive table, `product_featured_videos`, and independent authenticated endpoints keep this slot separate from the original `product_videos` table and its three-video allowance. Existing lower video UI and playback are unchanged.

An “أضيفي المنتج للسلة” button appears immediately above WhatsApp help, using the existing selected quantity and purchase validation. It stops delegated clicks to avoid adding twice, updates the cart through the same callback as the original button, and is disabled when the product cannot be purchased.

Validation: 280 automated tests passed, including nine new cases for one-video capacity, replacement, simultaneous uploads, authentication, origin checks, file validation, streaming ranges, upper/lower isolation, customer controls, quantity selection and admin progress/cancellation. Browser QA used an isolated in-memory SQLite/KV fixture with no customer data or order submission. A two-second test clip uploaded through the new admin UI played at 339 × 603 pixels in a phone frame, muted and looping without controls. No video was added to production; the owner will supply it.

The release changes no product, price, stock, order, promotion, email or existing video records. Deployment and before/after integrity evidence are recorded in `arencia-featured-video-v53-verification.json`.
