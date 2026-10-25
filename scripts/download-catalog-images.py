"""Download the exact matched packshot for each source entry; preserve provenance."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlparse,urlunparse,parse_qsl,urlencode,quote
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image
from io import BytesIO
import json,hashlib,re
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'deployment-private'/'research';OUT=ROOT/'public'/'images'/'catalog';OUT.mkdir(parents=True,exist_ok=True)
CACHE.mkdir(parents=True,exist_ok=True)
selection_file=ROOT/'data'/'image-selections.json'
if selection_file.exists():
    matches=[{'id':r['id'],'candidates':[{'score':100,'title':r['source_title'],'url':r['source_page'],'images':[r['source_image']],'source':'reviewed selection'}]} for r in json.loads(selection_file.read_text())]
else:
    matches=json.loads((CACHE/'matches.json').read_text())

def get(url):
    parsed=urlparse(url)
    url=urlunparse(parsed._replace(path=quote(parsed.path,safe='/%:@'),fragment=''))
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:return r.read(5_000_000)

try:
    official=json.loads(get('https://www.nishman.com.au/products/260212.js'))
    nish=next(m for m in matches if m['id']=='TS0051')
    nish['candidates']=[{'score':100,'title':official['title'],'url':'https://www.nishman.com.au/products/260212','images':['https:'+x if x.startswith('//') else x for x in official['images']],'source':'Nishman official','body_html':official.get('description','')}]
    (CACHE/'matches.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2))
except Exception as e:print(json.dumps({'official_nishman_error':str(e)}),flush=True)

def download(m):
    candidates=m.get('candidates',[])
    if not candidates:return {'id':m['id'],'status':'missing','reason':'no_matching_source'}
    selected=candidates[0]
    errors=[]
    for image_url in selected.get('images',[])[:5]:
        try:
            parsed=urlparse(image_url)
            if 'shopify.com' in parsed.netloc or '/cdn/shop/' in parsed.path:
                params=dict(parse_qsl(parsed.query));params['width']='900';image_url=urlunparse(parsed._replace(query=urlencode(params)))
            cache=CACHE/('image-'+hashlib.sha256(image_url.encode()).hexdigest())
            data=cache.read_bytes() if cache.exists() else get(image_url)
            with Image.open(BytesIO(data)) as image:
                image.verify();kind=image.format;dimensions=image.size
            if min(dimensions)<160:raise ValueError('Image too small: '+str(dimensions))
            ext={'JPEG':'jpg','PNG':'png','WEBP':'webp','AVIF':'avif'}.get(kind)
            if not ext:raise ValueError('Unsupported image format '+str(kind))
            if len(data)>4_500_000:raise ValueError('Image too large')
            cache.write_bytes(data)
            digest=hashlib.sha256(data).hexdigest();name=m['id']+'-'+digest[:12]+'.'+ext
            (OUT/name).write_bytes(data)
            return {'id':m['id'],'status':'downloaded','image':'/images/catalog/'+name,'source_page':selected['url'],'source_title':selected['title'],'source_image':image_url,'match_score':selected['score'],'sha256':digest,'width':dimensions[0],'height':dimensions[1],'bytes':len(data),'content_type':{'jpg':'image/jpeg','png':'image/png','webp':'image/webp','avif':'image/avif'}[ext]}
        except Exception as e:errors.append(str(e))
    return {'id':m['id'],'status':'missing','reason':'; '.join(errors),'source_page':selected['url']}

results=[]
with ThreadPoolExecutor(max_workers=8) as pool:
    futures={pool.submit(download,m):m['id'] for m in matches}
    for future in as_completed(futures):
        result=future.result();results.append(result)
        print(json.dumps({'id':result['id'],'status':result['status'],'bytes':result.get('bytes'),'reason':result.get('reason')},ensure_ascii=False),flush=True)
        (CACHE/'image-progress.json').write_text(json.dumps(sorted(results,key=lambda x:x['id']),ensure_ascii=False,indent=2))
results.sort(key=lambda x:x['id'])
(ROOT/'data'/'image-provenance.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps({'complete':True,'downloaded':sum(r['status']=='downloaded' for r in results),'total':len(results),'bytes':sum(r.get('bytes',0) for r in results)}),flush=True)
