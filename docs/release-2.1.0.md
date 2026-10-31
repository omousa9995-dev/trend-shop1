# Trend Shop 2.1.0 — cart and checkout refinements

The owner requested quieter recommendations, product photos at checkout, Arabic/English phone digits and an alternative for customers without Jordanian numbers, pink add feedback, new search examples and Instagram/Facebook links.

- Recommendations now wait for three seconds after the most recent successful addition. Opening search, cart, a product option dialog, share, zoom, checkout, or hiding the tab cancels a pending prompt. Adding while a prompt is already visible updates its current cart instead of opening another one. This does not delay choosing a required tone or changing cart quantities.
- Checkout has a thumbnail, product title, quantity, choice selector and line total for every cart entry. The image selection respects an administrator's replacement photo. The layout adapts to 390px widths.
- Contact numbers accept Arabic-Indic, Persian and ASCII digits, common separators, international `+` and `00`, and Jordanian local mobile formats. The same validator normalizes new orders to E.164 in both client and server. International numbers require a country code; delivery governorates remain Jordanian. Historical orders are untouched. This checks structural plausibility, not ownership or WhatsApp registration.
- The phone parser uses pinned `libphonenumber-js` minimal metadata, compiled with esbuild to a self-contained local ES module. Browsing pages load only the small loader; the parser downloads on phone-field focus or submission. It does not contact an external validation service. Run `npm run build:phone` after changing its source or pinned dependency; source/bundle equivalence has regression coverage. The license is retained in `docs/licenses/`.
- The add confirmation, bag/check icon, quantity controls and non-empty basket icon use the pink palette. Search help now says toner or sunscreen. Accessible, 44px Instagram and Facebook icons link to the exact supplied URLs in the footer and mobile navigation, with safe external-link attributes.
- Admin and invoice phone values display left-to-right so international prefixes remain readable.

## Verification

114 tests pass, including deterministic three-second timing, rapid additions, cancellation on navigation, correct checkout images, multi-tone merging, replacement photos, Arabic/international normalization, invalid-input rejection, server-saved phone values, email payloads, existing stock/order protections and the prior storefront regression suite. Browser review exercised desktop and a 390px iframe, immediate pink feedback with the prompt still hidden, the later prompt, a successful demo checkout with Arabic international digits, blank email and a one-word address. No test order or email was sent to production.

## Deployment and recovery

No database or catalog migration is needed. Deploy all 13 packaged Worker modules and static assets with the existing DB, MEDIA and STORE_LIVE bindings and `keep_bindings: ["secret_text"]`. Preserve current product/price/stock/admin changes; do not replay seeds or catalog migrations. Disable the isolated preview after review.

Source backup: `backup/v2.0.0-before-checkout-2026-10-31` at `70f06cdb21dcd1721b89eb1e42afcf97b2ea25f6`. Previous Worker version: `014ad218-3155-4da5-a5eb-eb3515fb457e`. A code rollback needs no database restoration; new phone values remain ordinary text.

## Published verification — 2026-10-31

- Implementation commit: `c94972b187e5c236113adc9f36f2baa3fc2b9767`; GitHub Actions run `41204961695` passed all 114 checks.
- Production Worker: `73a5fec5-a84e-4109-a5a2-01c7768f063a`, with all existing secret bindings retained.
- Pre/post fingerprints confirmed unchanged product inventory, prices, approval and publication flags. Existing order and item counts remained 6 and 28. No production test order was submitted.
- Live browser checks verified the new search examples and working product suggestion, immediate pink confirmation while recommendations remain hidden, and two correctly loaded product thumbnails beside the checkout lines. Live ordering remains enabled. The isolated 390px review and Arabic international-number demo completed successfully.
- The previous source version is retained on the backup branch. The isolated review endpoint was disabled after testing.
