# Trend Shop 2.2.0 — optional delivery map and brand browsing

The phone field now has only `0791234567` as its placeholder. Its label is simply mobile number, and the hint starts with Saudi Arabia's `+966` followed by acceptance of international or WhatsApp numbers. The existing shared validator still accepts Jordanian Arabic/Persian/ASCII digits and international country codes. No country is restricted to Saudi Arabia.

An optional Google Maps share-link field accompanies the one-word street/neighborhood address. It does not request browser geolocation, load a map embed or call an external API. Supported HTTPS links include `maps.app.goo.gl`, older `goo.gl/maps`, normal Google Maps URLs and Jordan Google domains. Client and server use the same local URL validation. Unrelated/executable URLs, credentials, non-default ports and oversized strings are rejected. Empty input remains valid.

New orders freeze this private link in `orders.maps_url`. Signed-in administration and invoices render a validated clickable link. The existing notification integration receives it both as a field and inside order notes, so its current templates retain the delivery information. The public catalog and product-sharing URLs do not receive it.

Product card and detail brand names now link to a dedicated brand-filtered list. Case/spacing/accent variants are grouped, including ANUA/Anua. Existing KIKO/KIKO Milano, VT/VT Cosmetics and L'Oreal labels use canonical groupings. The owner's COSREX spelling resolves to COSRX. Sorting and other filters continue to work with the brand filter, and selecting a brand from a product starts with all available products of that brand rather than retaining a previous category.

## Validation

125 tests pass, covering optional map submission and omission, URL validation and escaping, historical order migration, private admin access, invoice/email map delivery, idempotency, Arabic/English Jordan mobile checkout, the exact phone presentation, brand navigation/grouping and the earlier storefront, stock and security regressions. Browser QA uses isolated demo data and never sends a production test order or email.

## Deployment and recovery

Backup source: `backup/v2.1.0-before-maps-brands-2026-10-31` at `a412f16ad743cb5f2c22b2f6a3ebfed8fd54a162`. Previous Worker: `73a5fec5-a84e-4109-a5a2-01c7768f063a`.

1. Verify current schema with `PRAGMA table_info(orders)`. Apply `0011_optional_order_maps.sql` once only if `maps_url` is absent. Fresh databases already have the column. Historical orders receive an empty string, without changing totals or contact details.
2. Deploy all 14 packaged modules and static files with existing DB, MEDIA and STORE_LIVE bindings and `keep_bindings: ["secret_text"]`.
3. Verify live brand browsing, phone/map fields and old stock/prices/order counts; disable the isolated review endpoint.

Do not replay seeds or catalog migrations. A source/Worker rollback can safely retain the additive column; do not drop it or restore an older database over newer customer orders.
