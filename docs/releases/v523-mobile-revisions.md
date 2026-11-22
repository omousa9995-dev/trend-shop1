# Trend Shop 5.23 — mobile shopping refinements

The product page now asks the shopper to add their selected quantity before reviewing the order. Reviewing never adds a different quantity or shade. Adding a product or bundle keeps the shopper on the current page; complementary products open only after an explicit request in checkout.

Product pages show product prices; shipping and the delivered total are calculated in the bag and checkout. Checkout shows one combined cash-on-delivery / manual CliQ information block. The record remains an unpaid COD order by default; a CliQ transfer is arranged and checked manually, with existing server-side CliQ compatibility retained.

| Owner reference | Result |
| --- | --- |
| IMG_0846 | Product types moved to the end of the home content, using compact product-shaped icons. |
| IMG_0847 | Browser Back restores the previous home/guide position, and product Back restores guide/filter state. |
| IMG_0848 | WhatsApp lowered on mobile, with collision protection for the main home action. |
| IMG_0849 | All nine guide buttons scroll to their products without remounting or leaving the guide. |
| IMG_0850 | Product totals exclude delivery; the bag and checkout display the delivered total and the free-delivery condition. |
| IMG_0851 | Cash on delivery and arranged CliQ shown together in one payment block. |
| IMG_0852 | Explicit add, then review; no automatic recommendation popup while reading the product. |
| IMG_0853 | Brand source names and genuine scores remain attributed as text, with no outbound commercial brand link. |
| IMG_0854 | Instagram/Facebook icons in the header and footer. Existing Luma entry placement preserved. |

Shipping remains 1 JOD, free strictly above 19 JOD after discounts. No product price, stock, order, email bridge, or database schema is changed.

Before editing, the existing source was backed up at branch `backup/v5.22-before-mobile-revisions-2026-11-22`, source `57c06af72bea120d92236bf2f1aede00409031cf`. Production Worker version `c7219d5c-b3bc-47f7-8bae-22c8279003b9` remains the rollback version.

Implementation prepared for CI and isolated browser review. Publication and final verification are pending.
