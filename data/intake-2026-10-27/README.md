# Product intake · 27 October 2026

94 distinct products were transcribed from owner photographs IMG_0323–IMG_0342. Nine match existing SKUs; 85 new SKUs use TS0201–TS0285. The live approved catalog grows from 173 to 258 products. Different sizes, brands, and identifiable editions are retained.

- `manifest.json`: reviewed mapping for all 94 products, including the nine existing IDs.
- `products.json`: 85 new, individually described products with owner-authorized regular and introductory prices, 24 initial units per new SKU.
- `copy-ar.txt`: Arabic product copy and explicit product types.
- `prices.csv`: readable pricing and classification review.
- `images.json`: source URLs, original photograph hashes, image dimensions, content hashes and AI cleanup disclosures.
- `manifest-source.txt`: initial transcription; reviewed corrections are in `manifest.json`. In particular TS0256 is a 30 ml foundation, not a concealer; TS0241's Brume/Baume packaging needs formula confirmation.

New prices range from JOD 1.50 to JOD 17.99. Crossed-out amounts are the store's approved **regular prices**. The UI labels them as introductory comparisons, never as previously charged prices. Discount percentages are calculated from the actual prices.

Color products with unreadable shade numbers clearly require shade confirmation and link to the store's WhatsApp. Green/blue Miss Lara tubes describe packaging, not the mascara color. Both 16 ml labels were checked against the owner photograph. No claim of authenticity, unseen shade assortment or guaranteed cosmetic/medical result is inferred from a photograph.

All 85 primary images were visually reviewed. Twenty-three were cleaned up with ImageGen from owner photographs and carry a visible AI enhancement caption on the product page. Other packshots were matched to the product/edition/volume; shade differences are disclosed. WebP thumbnails cap at 600 px; zoom uses the larger source up to 1600 px without artificial upscaling.

`scripts/build-intake-2026-10-27.py` deterministically rebuilds JSON, thumbnail references, and the additive SQL from reviewed data. It never connects to production. `0008_catalog_intake_2026_10_27.sql` inserts only the new IDs with `ON CONFLICT DO NOTHING`: running it again cannot replenish sold stock or overwrite administrator edits. Existing products, stock, orders, notifications and promotion records are untouched.

The prior release is preserved in `backup/v1.8.1-before-new-products-2026-10-27` at commit `9589bc16c1dc0d37f872eeec40fe4ef2f086cdab` (Worker version `f4fcced3-f6c3-4569-b4c1-4a94bad1ae2d`). A rollback restores that storefront; if additions must be removed from sale, deactivate this batch rather than deleting products or restoring old inventory snapshots.
