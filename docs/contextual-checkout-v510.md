# Trend Shop 5.10.0 — brand links and contextual checkout additions

## Behaviour

The existing upper product-brand link remains active. The second brand name
under it and the brand breadcrumb now use the same normalized brand collection
URL. Opening either position displays the complete brand collection, without
retaining category or search filters that could hide some of that brand.

The existing «+ أضيفي منتجات لطلبكِ» control opens an optional suggestion dialog
instead of product search. The delivery form stays mounted, with its current
values, underneath the dialog. The customer can close it and confirm the current
order without adding anything.

The suggestion rules inspect every distinct selected product and expand bundle
components. Quantities, line order and repeated shade lines do not over-weight
one product. Suggestions cover missing complementary steps and are grouped into
skincare, makeup, haircare, bodycare or footcare steps as relevant. Mixed bags give
each relevant family space. There are at most four groups and three products per
group. Existing steps, purchased bundle components, unavailable, unapproved,
inactive and retired products are excluded. Concentrated treatments and
specialised care are not inferred from a shopper's skin or health; name-based
filters also exclude named exfoliants and targeted treatment products from these
broad routine suggestions. These are shopping complements, not a clinical
compatibility assessment.

Examples: foundation suggests concealer/powder, mascara and a colour touch;
skincare essence suggests moisturizer, sunscreen and cleansing; shampoo suggests
conditioner, a hair mask or hair oil. Candidates favour relevant steps before
same-brand and price-proximity tie breakers. Selecting a step removes other
products of that step on the next refresh. A complete or unsupported bag has an
honest empty state. An emptied bag has starter choices to rebuild the order.

Products use their existing real catalog images and current prices. A shade or
variant must be selected explicitly before adding a product that requires one.
Adding uses the existing stock, cart-size and pending-order locks; final totals
use the existing promotion and shipping calculation. No new order, email,
database schema or customer tracking link is introduced by this UI change.

## Validation

All 346 automated tests pass. Tests cover brand positions and normalized complete
collections, mixed baskets and bundle members, quantity/order invariance, stock
and eligibility filters, explicit powder shades, refreshed suggestions, retained
delivery details, nested quick checkout, focus restoration, empty bags, Arabic
and English, and no order submission from the suggestions.

Modal behaviour follows the native HTML dialog focus pattern:
https://www.w3.org/WAI/WCAG22/Techniques/html/H102 and
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ .

## Production publication

Published on 9 November 2026 at 00:40 Jordan time (8 November 21:40:46 UTC).
Worker version `fa6182bc-4960-49af-aed9-407a3f2027e9` serves 100% under deployment
`c7a69a70-2597-42bf-bfd0-478878d1e639`. Implementation commit:
`3cce9b4b80cff453c1849e5498be1354a52c91c2`; GitHub validation passed.

The six changed/added public assets match the tested source byte for byte. The
existing 29 server modules and all bindings were preserved; the embedded asset
set now contains 606 files. Catalog remains live with 302 products; mail health is
configured/reachable/canSend and unauthenticated order administration returns 401.

Live browser checks confirmed the lower Anua brand link opens all 10 products,
and the retained upper SHEGLAM link opens its three products. A foundation in
shade 2 opened makeup-base, eye-makeup and colour suggestions. Powder could not
be added without selecting a shade. Adding powder shade 3 updated the delivered
total from 9.99 to 18.98 JOD, removed further powder suggestions, and retained the
synthetic delivery name and address. Returning to checkout retained focus and the
selected powder shade. The temporary two-item browser cart was emptied and the
page reloaded to clear synthetic form values. No order or email was submitted.
The suggestion layout and product images were visually inspected in the browser;
a physical iPhone was not available.

See `contextual-checkout-v510-verification.json`. Roll back code with Worker
version `9871c423-ff7f-4dfc-9413-327f3700b74e`; do not reset business data.
