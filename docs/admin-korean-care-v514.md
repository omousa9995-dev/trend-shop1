# Korean care owner controls — v5.14.0

The owner can add products from any Korean brand through a dedicated “إضافة منتج إلى Korean care” action on both the overview and products screens. The product editor offers automatic brand detection, explicit inclusion and explicit exclusion. Category and product type remain independent so Korean products can also appear in skincare, bodycare, haircare or makeup as appropriate.

`details.koreanCare` is an optional boolean persisted through the existing authenticated product endpoint. Missing means existing brand detection; true and false override it. Historic `details.collection` tags alone do not reclassify existing products. Saving automatic mode removes the override and aligns the legacy collection tag with current brand detection. Malformed non-boolean choices are rejected. No new endpoint, schema migration or automatic product reclassification is required.

The products list now offers normalized Arabic/English/name/SKU search, collection and category filters, and ready/draft/hidden/sold-out/low-stock filters. Rows show the SKU, a Korean care badge and a storefront preview link. Overview and list counts identify Korean products. Existing brands are suggested without preventing new brand names.

New product drafts start with the owner's previously used 24-unit initial quantity, and remain unapproved until explicitly approved. A readiness message explains whether the product is a draft, hidden, sold out or ready for purchase. “حفظ ومتابعة الصور” saves a stable product ID, reopens the same product and enables its existing multiple-photo editor. Card images, page galleries, upper video and lower videos retain their separate controls. Both save buttons are locked while a card image uploads; resetting/closing an editor cancels stale image responses. A draft keeps its generated ID after a failed save so a deliberate retry does not create a second product.

## Owner workflow

1. Open the admin dashboard and sign in normally.
2. Choose “إضافة منتج إلى Korean care” from the overview or products screen.
3. Enter the brand, product name, category/type, prices and confirmed stock. Fill the Arabic content and optional English content.
4. Upload the card image through its dedicated picker. Mark the product approved and visible when it is ready, or keep it as a draft.
5. Choose “حفظ ومتابعة الصور”; then select several page photos and upload them through the separate gallery panel.
6. Use “معاينة صفحة المنتج” to review the published product. Unapproved or hidden drafts are not public previews.

Validation: all 384 unit/database/UI tests pass. New coverage exercises an unknown Korean brand end to end through the real authenticated Worker handler and public catalog, explicit exclusion of a known brand, automatic reset, retention through hiding, authentication and invalid input, combined filters, save-and-continue, retry preservation and card-upload races. Responsive 390 × 844 visual checks use isolated admin fixtures with synthetic data; no demo product or order is written to production. The website and PWA scope remain separate; no PWA work is included in this release.
