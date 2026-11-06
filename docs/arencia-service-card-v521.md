# Arencia service card — v5.2.1

The owner rejected the v5.2 Arencia redesign and requested the previous page with only the service card in the supplied screenshot.

- Restored `product-story.js` from pre-pilot commit `0af449f773b734b8180e881472eabe07c7e5843d`, with only the import and mount call for the card added.
- Removed the v5.2 title/intro/gallery, early purchase button, price, benefits, usage-step and FAQ overrides. The original two-photo gallery and product content are restored.
- Replaced all Arencia pilot styling with the screenshot's cream, rounded, three-row card. Its truck, package and shield icons use inline SVG; the card sits immediately before the quantity and purchase panel on TS0098 only.
- Arabic text follows the screenshot: “خلال 24 ساعة / لجميع مناطق المملكة”، “تفقدي طلبكِ قبل الدفع / عند الاستلام”، “منتجات أصلية 100% / تسوّقي بثقة”. These service statements were provided by the owner. English translations follow the existing language toggle.
- Existing v5.1 search, editable order summary and owner settings remain intact. No catalog, price, inventory, order, video or email changes are included.

Validation: all 271 automated tests passed. The regression tests cover restored content/gallery/order of sections, exact Arabic card text, idempotent mounting, English and pair pricing, and exclusion of other products. A read-only managed preview confirmed the card at phone width without horizontal overflow.

The rejected v5.2 implementation remains in Git history. Live deployment and integrity evidence are recorded in `arencia-service-card-v521-verification.json`.
