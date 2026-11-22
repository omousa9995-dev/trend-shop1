# Trend Shop 5.22 work record

Owner authorized implementation and publication on 22 November 2026.

Base commit: 75ab33bf3095ea22a7cf9001aea770940f98ba81.
Previous Worker version: 671f9492-0c11-425e-96b6-8778933ebe20.
Existing Cloudflare account, Worker, storage and secrets must be preserved.

Scope: clean product routes with legacy compatibility; server HTML and price
metadata; dynamic sitemap and Google product feed; nine distinct buying pages;
COSRX Arabic spelling; Jordan phone hint and delivery copy; mobile WhatsApp
placement; canonical Facebook page; real external product ratings separately
attributed from verified Trend purchase ratings; Facebook cover/bio and one
four-photo Beauty of Joseon post on Facebook and Instagram.

Connection checks: Upload-Post profile `default` has no connected Facebook or
Instagram accounts. Connection URL supplied to owner:
https://app.upload-post.com/manage-users . Do not attempt posting until connected.
Search Console is not connected in LoomaScale; connection URL supplied:
https://loomascale.com/dashboard/connections?connect=search_console . Prepare
sitemap, but do not claim submission until Google acknowledges it.

No made-up ratings, review counts, identities, barcodes or availability.
No production test order or inventory adjustment is needed for this release.

## Continuation on 22 November 2026

Recovered the local 5.22 source commit and completed runtime review. Product
JSON-LD now survives hydration, tracks product and collection navigation, and
uses only verified Trend review totals in aggregateRating. The source badges
continue to identify official brand ratings separately. Corrected the empty
rating prompt and the COSRX FAQ. Added a regression for actual storefront boot
and navigation.

Both Facebook TREND SHOP (104096287731695) and Instagram trend_shop.jo are now
connected under Upload-Post profile default. The four-image carousel was
prepared in the existing Meta Business Suite composer; publication is pending
live product URL verification. The existing record says cover and bio were
published earlier in this session.

Search Console property https://trendjo.pages.dev/ was added through the
connected account. Browser verification uses the signed-in owner account and
its actual downloaded googlee50c1506ec1d889b.html file, now included in public.
Ownership confirmation and sitemap submission follow deployment.

The reviewed deployed base matches the 5.21 repository graph and all 642 asset
contents; its embedded adapter has a different property order only. Rebuilt
5.22 package: 51 modules, 650 assets, SHA-256
f84936ee0c454286b38d4a891b7b22b3d5c83a11737c6b32f658c02984cae25b.
The exact delta was reconstructed and checksum-verified within Cloudflare
without changing traffic.
