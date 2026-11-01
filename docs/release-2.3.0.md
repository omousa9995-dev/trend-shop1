# Trend Shop 2.3.0 — catalog removal and connected shopping

The owner's eight screenshots identify 13 products: TS0023, TS0024, TS0050, TS0051, TS0052, TS0053, TS0055, TS0127, TS0156, TS0157, TS0185, TS0186 and TS0232. Their catalog records and public image indexes are removed, and an application retirement policy prevents old seeds, stale carts, direct links, recommendations, admin edits or new orders from restoring them. The unpictured Dermokil cream TS0021 remains. Source recovery is available on `backup/v2.2.1-before-catalog-refresh-2026-11-01` at `607600b178791c6b9e6f1c1f1ccc3f13d63d0dc5`; the previous Worker is `41d8a9a9-e236-4d0c-b4bf-7ec569582ba6`.

Independent foundation, concealer and sunscreen sections are exposed in the top navigation, mobile menu and existing shop filters. Product type and parent category names on every detail page link to their complete sections, clearing previous brand/search restrictions. The sunscreen section also includes the explicitly classified body sunscreen. Brand links, search suggestions, image zoom and per-product sharing remain available.

Recommendations use the same explicit product classifications as the catalog, show different complementary steps before repeating a type, and favor steps missing from the cart. Foundation suggests concealer, mascara and powder. Hair recommendations stay within hair care, and exfoliant suggestions prioritize moisturizer, sunscreen and cleanser rather than another exfoliant. Availability, stock, current basket contents, promotions and the exact delivery calculation are respected. Recommendations refresh below the product when the basket changes; the existing three-second quiet-period assist remains.

The WhatsApp buttons on product, cart and checkout pages prepare a Click-to-Chat message for the existing store number, including selected variant, quantity, current prices, eligible basket discount and delivery/total from the shared quote. Single-product messages include its share URL. Required variants must be selected first. The message excludes checkout name, phone, address, email and notes. The customer sends the message in WhatsApp; opening it does not create a website order, reserve stock, send an automated message or claim payment. Website COD/manual CliQ ordering continues normally.

The Google Maps field, client module, admin/invoice links and notification payload integration are removed. Legacy submitted map values are ignored; the historical database column remains for safe rollback and old orders, and is omitted from admin responses. Phone handling, optional email, one-word address acceptance and shipping rules are retained.

The consent panel and the entire Meta Pixel integration are removed together, including its modules, events, configuration, preference controls and Facebook script/connect permissions. Old marketing consent settings and Pixel cookies are cleared without changing the cart or admin login. No replacement advertising tracking is introduced. Image-production captions and launch-offer markers are omitted from customer-facing product metadata and copy; ordinary names, decimal strengths, variants, descriptions and prices remain intact.

## Deployment sequence

1. Back up the named source/Worker and retired product records. Apply `0012_retire_owner_products.sql` once; it is safe to repeat. It first deactivates the 13 IDs and deletes unreferenced rows. If an order arrived before removal, its referenced row remains inactive for historical integrity; all public application paths still block it. Never delete orders, item snapshots or unrelated inventory.
2. Deploy the 14 packaged modules/static files with DB, MEDIA, STORE_LIVE and preserved secret bindings. Omit the removed META_PIXEL_ID variable.
3. Verify catalog counts, removal, pricing/stock fingerprint, historical order/item counts, live navigation and WhatsApp links. Do not create a production test order or send a WhatsApp message. Disable the isolated review endpoint after QA.

Tests cover migration/history preservation and idempotent receipts, restored legacy rows, section/brand/search navigation, diversified recommendations, WhatsApp variants and totals, map/Pixel removal, Arabic/English phone checkout, stock, order mail and previous security regressions.

## Pre-deployment verification

All 136 tests pass locally. Desktop and 390px browser QA completed search-to-product navigation, L’Oreal type navigation, all 13 foundations and all 24 sunscreens (including body sunscreen), selected tone/quantity in WhatsApp URLs, complementary suggestions, 150% image zoom, and demo order completion with Arabic and ASCII Jordan mobile numbers. COD and manual CliQ form behavior were checked. No WhatsApp message, production order or customer email was sent.
