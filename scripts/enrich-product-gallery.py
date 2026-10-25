"""Build reviewed alternate views without changing prices, stock, or product identities."""
from pathlib import Path
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
selected = json.loads((ROOT/'data/gallery-selections.json').read_text())
catalog = {p['id']: p for p in json.loads((ROOT/'public/catalog.json').read_text())}

def prepare(row):
    row = dict(row)
    if row.get('image'):
        data = (ROOT/('public'+row['image'])).read_bytes()
    else:
        with urlopen(Request(row['source_image'], headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
            original = response.read(4_500_000)
        image = Image.open(BytesIO(original))
        image.load()
        if image.mode not in ('RGB', 'RGBA'): image = image.convert('RGBA')
        output = BytesIO()
        image.save(output, 'WEBP', quality=88, method=6)
        data = output.getvalue()
        digest = hashlib.sha256(data).hexdigest()
        row['image'] = '/images/catalog/'+row['product_id']+'-'+digest[:12]+'.webp'
        (ROOT/('public'+row['image'])).write_bytes(data)
    row['sha256'] = hashlib.sha256(data).hexdigest()
    row['bytes'] = len(data)
    return row

with ThreadPoolExecutor(max_workers=5) as pool:
    rows = list(pool.map(prepare, selected))
galleries = {}
for row in rows:
    p = catalog[row['product_id']]
    gallery = galleries.setdefault(p['id'], {'primary': p['image'], 'images': []})
    if row['image'] != p['image'] and row['image'] not in gallery['images']:
        gallery['images'].append(row['image'])
(ROOT/'public/product-galleries.json').write_text(json.dumps(galleries, ensure_ascii=False, indent=2)+'\n')
(ROOT/'data/gallery-provenance.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'products_with_alternate_views': len(galleries), 'additional_photos': len(rows)}))
