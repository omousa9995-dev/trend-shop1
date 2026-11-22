# Trend Shop 5.22 — production release

Product links and purchase pages now expose their own titles, descriptions, images, live prices and availability on the first HTTP response. Clean /product/ URLs retain compatibility with old fragment and /p/ links. The selected Product JSON-LD survives hydration and follows client navigation, with verified Trend review totals kept separate from official brand ratings.

Published 22 November 2026 from source 587defa311e804f761a15733482ab9cf5f9beaa4. Worker version 94 (f53bd24b-b909-4ba9-8815-7f68562928d3), deployment eef01110-a0e5-4bb0-a297-bf698eb7cd1e, serves 100% of traffic. The deployed 51-module, 650-asset package matches the reviewed SHA-256 f84936ee0c454286b38d4a891b7b22b3d5c83a11737c6b32f658c02984cae25b.

Nine buying guides are live: Korean sunscreen, toner, beginner routine, COSRX, Anua, Beauty of Joseon, Sky High, Estée Lauder foundation, and makeup for 5 JOD or less. All nine returned HTTP 200 with distinct metadata and CollectionPage data. The sitemap has 313 unique public URLs; the live Merchant feed has 303 products. Hidden/retired products are excluded. Timed offers update both HTML/JSON-LD and feed pricing, including expiry.

Jordan phone hint is 0791234567; the delivery bar says one dinar. The canonical Facebook page link replaces the share URL. The mobile WhatsApp control is raised; a 390 × 844 live mobile screenshot confirmed it does not cover the main collection CTA. A live product review/checkout smoke check showed 8.99 JOD + 1.00 JOD delivery = 9.99 JOD, then removed the temporary local bag entry. No order was submitted or customer identity entered. Native iPhone hardware was not used.

The COSRX display spelling was corrected in source and 12 production product text records. The checksum of all commercial product fields, stock and approval flags stayed identical. Production counts remained 327 product records, 15 orders and 87 order lines. Existing bindings, secrets and observability were preserved.

Validation: 516 local tests, zero failures; GitHub CI succeeded for the implementation commit. Tests cover first-load prices, hidden-product exclusion, real/expired source scores, verified one-to-five star inputs, price expiry, legacy links, and actual hydration/navigation of the storefront.

Google ownership was verified using the actual downloaded HTML file. Search Console accepted https://trendjo.pages.dev/sitemap.xml at 2026-11-22T14:17:46.233Z. Its current status is pending processing, with no reported errors or warnings; acceptance is not indexing. A Merchant Center account has not yet been created, so the live feed has not been submitted there. Owner connection: https://loomascale.com/dashboard/connections?connect=merchant_center .

The Facebook cover and bio were published earlier in the session. After explicit owner approval, the Beauty of Joseon four-photo carousel and caption were published to both TREND SHOP and trend_shop.jo with paid promotion off. Public pages and the live media connector confirmed both posts; Instagram returned four child images. Facebook: https://www.facebook.com/1619331160237476/posts/1619329586904300 . Instagram: https://www.instagram.com/p/DgDDZu3B3QQ/ .

The owner connected Merchant Center and confirmed an online-only store. Google now accepts the connection but lists zero Merchant Center accounts; the browser likewise opens new-account setup. The website and online-only selection are prepared while account setup continues.

Rollback: backup/v5.21-before-seo-2026-11-22, Worker 671f9492-0c11-425e-96b6-8778933ebe20. The small text-only spelling migration need not be undone when rolling code back.

Evidence: [v522-release.json](../verification/v522-release.json).


Merchant Center setup checkpoint: prepared Trend Shop, Jordan, https://trendjo.pages.dev/, online-only. Both optional email subscriptions are off. The final Continue action explicitly accepts Google Merchant Center Terms of Service (https://support.google.com/merchants/answer/160173); awaiting owner acceptance before account creation.
