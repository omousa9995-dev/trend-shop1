"""One-time sale based on the store's genuine pre-launch prices. Never restocks."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
original = json.loads((root/'data/launch-sale-baseline.json').read_text())
catalog = json.loads((root/'public/catalog.json').read_text())
rates = [30, 50, 20, 40]
release = 'launch-sale-2026-10-26-v1'
offers, thumbnails, provenance = [], {}, []
for p in catalog:
    base = original[p['id']]
    rate = 25 if base % 4 == 0 and base > 500 else rates[int(p['id'][2:]) % len(rates)]
    if base*(100-rate)//100 < 500:
        rate = 0
    price = base*(100-rate)//100
    assert base*(100-rate) % 100 == 0
    p.update(reference=base, priceFils=price, discount=rate)
    offers.append(dict(id=p['id'], previous_price_fils=base, price_fils=price, discount_percent=rate))
    source = root/'public'/p['image'].lstrip('/')
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw)
        image.thumbnail((560, 640), Image.Resampling.LANCZOS)
        if image.mode not in ('RGB','RGBA'):
            image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
        import io
        output = io.BytesIO()
        image.save(output, format='WEBP', quality=82, method=6)
        blob = output.getvalue()
    digest = hashlib.sha256(blob).hexdigest()
    url = f'/images/catalog/{p["id"]}-{digest[:12]}.webp'
    (root/'public'/url.lstrip('/')).write_bytes(blob)
    thumbnails[p['id']] = dict(primary=p['image'], thumbnail=url)
    provenance.append(dict(id=p['id'], original=p['image'], thumbnail=url, sha256=digest,
                           original_bytes=source.stat().st_size, thumbnail_bytes=len(blob)))

(root/'public/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
(root/'public/catalog-thumbnails.json').write_text(json.dumps(thumbnails, ensure_ascii=False, separators=(',',':'))+'\n')
(root/'data/thumbnail-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n')
(root/'data/launch-sale.json').write_text(json.dumps(dict(release=release, basis='Actual store prices before this promotion; no invented former prices.', minimum_fils=500, offers=offers), ensure_ascii=False, indent=2)+'\n')

sql = ["-- Genuine launch discounts; prices only. Never resets stock or rewrites orders.",
       "CREATE TABLE IF NOT EXISTS catalog_releases (id TEXT PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT (datetime('now')));"]
for row in offers:
    sql.append(f"UPDATE products SET reference_price_fils={row['previous_price_fils']},price_fils={row['price_fils']},discount_percent={row['discount_percent']},updated_at=datetime('now') WHERE id='{row['id']}' AND active=1 AND approved=1 AND price_fils={row['previous_price_fils']} AND discount_percent=0 AND NOT EXISTS (SELECT 1 FROM catalog_releases WHERE id='{release}');")
sql.append(f"INSERT OR IGNORE INTO catalog_releases(id) VALUES('{release}');")
(root/'db/migrations/0005_launch_sale.sql').write_text('\n'.join(sql)+'\n')
print(json.dumps(dict(products=len(offers), discounted=sum(x['discount_percent']>0 for x in offers), rates=sorted(set(x['discount_percent'] for x in offers)), original_bytes=sum(x['original_bytes'] for x in provenance), thumbnail_bytes=sum(x['thumbnail_bytes'] for x in provenance))))
