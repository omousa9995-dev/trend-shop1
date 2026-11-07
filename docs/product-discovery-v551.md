# Trend Shop 5.5.1

Remove shopping by care need from home, shop navigation, applied filters and the filter sidebar. Old need links normalize to the remaining collection, brand, search and sort without continuing to filter by the removed feature.

Retain v5.5 brand browsing, product benefits, sizes and savings, existing categories, checkout and product video behavior. Replace only the home Korean care card artwork with an original 1536×1024 illustration featuring an adult woman, skincare and subtle celestial details. The Korean category banner stays the same. The card keeps the full 3:2 image on desktop and mobile; the mobile card places text beneath it.

Validation: all 290 automated tests passed; JavaScript syntax and diff whitespace checks passed. Chromium preview verified the 3:2 frame and no page overflow at a 390px frame; desktop preview verified the category card. A preview uses read-only catalog data and cannot accept orders.

Deployment changes static assets only, retaining the existing Worker server modules, bindings, database and uploaded media. Existing v5.4 backup and v5.5 source/deployment remain available for rollback. Never restore old order or stock data as part of an interface rollback.
