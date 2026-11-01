"""Optimise approved promotional scenes; retain the original packshot first."""
import json,hashlib,subprocess
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=root/'deployment-private/bilingual-2026-11-02/all-generated.json'
rows=json.loads(source.read_text())
output=root/'public/images/catalog/marketing';output.mkdir(parents=True,exist_ok=True)
catalog={p['id']:p for p in json.loads((root/'public/catalog.json').read_text())}
galleries=json.loads((root/'public/product-galleries.json').read_text())
media={};manifest=[]
for row in rows:
    product=catalog[row['id']];id=row['id'];image=Image.open(row['path']).convert('RGB')
    files={}
    for name,width,quality in [('scene',1000,86),('thumb',240,80)]:
        target=image.copy();target.thumbnail((width,round(width*1.25)))
        tmp=output/f'{id}-{name}.webp';target.save(tmp,'WEBP',quality=quality,method=6)
        digest=hashlib.sha256(tmp.read_bytes()).hexdigest()[:12];path=tmp.with_name(f'{id}-{name}-{digest}.webp');tmp.rename(path)
        files[name]='/images/catalog/marketing/'+path.name
    old=galleries.get(id,{});extras=old.get('images',[]) if old.get('primary')==product['image'] else []
    galleries[id]={'primary':product['image'],'images':list(dict.fromkeys([*extras,files['scene']]))[:6]}
    media[id]={'primary':product['image'],'image':files['scene'],'thumbnail':files['thumb'],'caption':{'ar':'مشهد دعائي','en':'Promotional scene'}}
    manifest.append({'productId':id,'mode':'reference-based promotional image generation','reference':product['image'],'prompt':row['prompt'],'image':files['scene'],'thumbnail':files['thumb'],'classification':'Fictional adult promotional model. Not a customer, verified review, outcome demonstration or before/after.','packshotRemainsPrimary':True})
(root/'public/product-galleries.json').write_text(json.dumps(galleries,ensure_ascii=False,indent=2)+'\n')
(root/'public/product-media.json').write_text(json.dumps(media,ensure_ascii=False,indent=2)+'\n')
(root/'data/marketing-assets-2026-11-02.json').write_text(json.dumps({'date':'2026-11-02','images':manifest},ensure_ascii=False,indent=2)+'\n')
provenance=json.loads((root/'data/gallery-provenance.json').read_text())
provenance=[entry for entry in provenance if entry.get('source_kind')!='fictional_promotional_model']
for asset in manifest:
    provenance.append({'product_id':asset['productId'],'image':asset['image'],'source_page':'https://trendjo.pages.dev/p/'+asset['productId'],'source_image':asset['reference'],'source_kind':'fictional_promotional_model','reviewed':True,'not_customer_testimonial':True,'prompt_manifest':'data/marketing-assets-2026-11-02.json'})
(root/'data/gallery-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'images':len(rows),'webBytes':sum(p.stat().st_size for p in output.glob('*.webp'))}))
