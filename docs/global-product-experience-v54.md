# Global product experience — v5.4.0

The owner approved the Arencia layout and requested the same experience on every product, with all customer videos fixed, silent and looping.

- Every physical product page receives the three-row service card, one independent upper video slot below delivery/order details, and the extra “أضيفي المنتج للسلة” button above WhatsApp help. The previous bundle recommendation card is removed from product pages. Existing names, copy, images, shades, quantity pricing and checkout validation are retained.
- The upper uploader is now available for every saved, non-retired product. Its storage keeps one row per product, rejects stale replacement IDs, and cannot consume any of that product’s three independent lower-video slots. No database migration is needed.
- Lower clips remain after usage and display up to three separate 9:16 frames. They have no customer buttons, seeking, sound toggle, fullscreen, picture-in-picture or tap-to-open viewer. They no longer appear in the main image gallery. Photo zoom and the lower photo viewer remain available for still images.
- A shared silent-video helper applies muted inline autoplay and looping to upper and lower videos, defers media loading until near the viewport, pauses offscreen media, and releases sources/listeners on navigation. Existing media files and metadata are not rewritten. Admin previews retain their controls for the owner.
- Virtual bundle pages retain their contents and choices, and receive the service card and additional cart action. Their constituent products own the separate product upload slots.

Validation: 285 automated tests passed. Rendering checks cover every available catalog product and its own copy/image, while integration tests cover two products’ isolated upper slots plus three lower slots each, concurrency, file validation, privacy/visibility, range playback, admin state, quantity/option selection and bundle contents. Browser checks cover mobile search, a foundation tone and two-item selection, adding to the bag, editing/removing in order review, independent admin upload/replacement, and four silent video frames using an isolated local fixture. No production orders, emails or test video uploads are created.

Production deployment, live visual checks and before/after hashes are recorded in `global-product-experience-v54-verification.json`. Current owner edits and uploaded videos are preserved.
