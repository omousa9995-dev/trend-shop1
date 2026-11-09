# Storefront typography — v5.12.0

The owner approved Tajawal for Arabic and Manrope for English. The storefront now uses Manrope first in the font stack for Latin/digits and Tajawal for Arabic glyphs. Tajawal weights 400/500/700 and Manrope’s variable 200–800 font are served locally as WOFF2, with swap rendering and two primary preloads. Existing editorial Georgia/system font declarations are overridden by a final scoped storefront stylesheet. Headings use 700, with comfortable Arabic title line height. Product data, layouts, administration and invoices retain their existing behavior.

Fonts are converted losslessly from Google Fonts’ official TTF distributions to WOFF2 without glyph subsetting. The SIL Open Font License files ship under public/licenses. Manrope does not contain Arabic glyphs; font character maps were checked to verify the intended fallback. The four font files total 116,064 bytes.

The embedded assets packager now recognizes WOFF2 as binary and serves font/woff2. Deployment tests compare all four served font bodies against their source bytes and check their wOF2 signature to prevent UTF-8 corruption.

Sources: https://github.com/google/fonts/tree/main/ofl/tajawal and https://github.com/google/fonts/tree/main/ofl/manrope .
