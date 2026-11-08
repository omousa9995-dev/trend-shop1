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

Publication details and live verification are recorded separately after rollout.
