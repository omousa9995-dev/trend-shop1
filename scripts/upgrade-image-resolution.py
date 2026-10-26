"""Retrieve higher-resolution versions of the same reviewed images; no invented details."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode, quote
from urllib.request import urlopen, Request
from PIL import Image, ImageOps
import io, json, hashlib

root=Path(__file__).resolve().parents[1]
cache=root/'deployment-private'/'high-resolution';cache.mkdir(exist_ok=True,parents=True)
catalog=json.loads((root/'public/catalog.json').read_text())
selected={p['id']:p for p in catalog}
sources=[r for r in json.loads((root/'data/image-provenance.json').read_text()) if r['id'] in selected]
old_map=json.loads((root/'public/catalog-thumbnails.json').read_text())

def process(row):
    parsed=urlparse(row['source_image']);params=dict(parse_qsl(parsed.query))
    if 'shopify.com' in parsed.netloc or '/cdn/shop/' in parsed.path:params['width']='2000'
    url=urlunparse(parsed._replace(path=quote(parsed.path,safe='/%:@'),query=urlencode(params),fragment=''))
    cached=cache/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
    try:
        if cached.exists():data=cached.read_bytes()
        else:
            with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=22) as r:data=r.read(12_000_000)
            if len(data)>=12_000_000:raise ValueError('Source exceeds limit')
            cached.write_bytes(data)
        source=Image.open(io.BytesIO(data));source.load();source=ImageOps.exif_transpose(source)
        if source.width*source.height>24_000_000:raise ValueError('Source dimensions too large')
        old=Image.open(root/'public'/row['image'].lstrip('/'))
        if source.width*source.height < old.width*old.height:source=old.copy()
        if source.mode not in ('RGB','RGBA'):source=source.convert('RGBA' if 'transparency' in source.info else 'RGB')
        urls=[];files=[]
        settings=[(2000,96),(1100,94)]
        if source.width<=old.width and source.height<=old.height:
            urls=[row['image']];settings=[(1100,94)]
        for limit,quality in settings:
            image=source.copy();image.thumbnail((limit,limit),Image.Resampling.LANCZOS)
            buf=io.BytesIO();image.save(buf,format='WEBP',quality=quality,method=6)
            blob=buf.getvalue();digest=hashlib.sha256(blob).hexdigest()
            path=f'/images/catalog/{row["id"]}-{digest[:12]}.webp'
            (root/'public'/path.lstrip('/')).write_bytes(blob)
            urls.append(path);files.append({'image':path,'sha256':digest,'bytes':len(blob),'width':image.width,'height':image.height})
        return {'id':row['id'],'primary':row['image'],'thumbnail':urls[1],'highResolution':urls[0],
                'width':source.width,'height':source.height,'source_image':url,'source_page':row['source_page'],
                'previous_width':row['width'],'previous_height':row['height'],'files':files,'status':'ready'}
    except Exception as e:return {'id':row['id'],**old_map[row['id']],'status':'kept_original','reason':str(e)[:150]}

results=[]
with ThreadPoolExecutor(max_workers=10) as pool:
    for future in as_completed([pool.submit(process,r) for r in sources]):
        results.append(future.result())
        (cache/'progress.json').write_text(json.dumps(results,ensure_ascii=False))
        if len(results)%20==0:print(json.dumps({'processed':len(results),'total':len(sources)}),flush=True)
results.sort(key=lambda x:x['id'])
mapping={r['id']:{k:r[k] for k in ['primary','thumbnail','highResolution','width','height'] if k in r} for r in results}
(root/'public/catalog-thumbnails.json').write_text(json.dumps(mapping,ensure_ascii=False,separators=(',',':'))+'\n')
(root/'data/hd-image-provenance.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'ready':sum(r['status']=='ready' for r in results),'higher_resolution':sum(r.get('width',0)>r.get('previous_width',99999) for r in results),'kept_original':sum(r['status']!='ready' for r in results),'bytes':sum(f['bytes'] for r in results for f in r.get('files',[]))}),flush=True)
