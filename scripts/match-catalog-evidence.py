from pathlib import Path
from urllib.parse import urljoin
import json,re,unicodedata,difflib
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'deployment-private'/'research'
original=json.loads((ROOT/'data'/'catalog-original.json').read_text());feeds=json.loads((CACHE/'shopify-products.json').read_text());pages=json.loads((CACHE/'other-pages.json').read_text())
queries={
'TS0026':'The Ordinary Hyaluronic Acid 2 B5','TS0027':'The Ordinary Caffeine Solution 5 EGCG','TS0029':'Bioderma Photoderm Max SPF100','TS0031':'Eucerin Oil Control','TS0034':'Dr Rashel Vitamin E Retinol Eye Cream','TS0037':'Bioderma Sebium Gel Moussant','TS0039':'Dr Rashel Makeup Remover','TS0040':'COSRX Hyaluronic Acid Intensive Cream','TS0042':'Dr Rashel Aloe Vera Scrub','TS0044':'COSRX Galactomyces95 Tone Balancing Essence','TS0158':'ETUDE Soon Jung 2x Barrier Intensive Cream','TS0159':'COSRX Salicylic Acid Daily Gentle Cleanser','TS0160':'COSRX Low pH Good Morning Gel Cleanser','TS0161':'ROUND LAB Birch Juice Moisturizing Sunscreen','TS0170':'Isntree Hyaluronic Acid Watery Sun Gel','TS0175':'Haruharu Wonder Black Rice Bakuchiol Eye Cream','TS0186':"d'Alba White Truffle First Spray Serum"
}
def norm(s):
 s=unicodedata.normalize('NFKD',s).lower();s=''.join(c for c in s if not unicodedata.combining(c));return ' '.join(re.findall(r'[a-z0-9]+|[\u0600-\u06ff]+',s))
def words(s):return set(norm(s).split())-{'by','the','of','for','and','with','original','ml','g','an','a','to'}
def score(a,b):
 aa,bb=words(a),words(b);f=2*len(aa&bb)/max(1,len(aa)+len(bb));return round(100*(0.65*f+0.35*difflib.SequenceMatcher(None,norm(a),norm(b)).ratio()),1)
catalog=[]
for p in feeds:
 images=[i.get('src') for i in p.get('images',[]) if i.get('src')]
 catalog.append({'title':p['title'],'url':p['url'],'images':images,'source':p['source'],'body_html':p.get('body_html',''),'variants':[{'title':v.get('title'),'sku':v.get('sku')} for v in p.get('variants',[])]})
for page in pages:
 if page.get('error'):continue
 if 'farahglow.shop' in page['url']:
  for image in page['images']:
   if image.get('alt') and image['alt'] not in ['Farah Glow','Luxury Beauty']:
    catalog.append({'title':image['alt'],'url':page['url'],'images':[urljoin(page['url'],image['url'])],'source':'Farah Glow','body_html':''})
 if 'myeasyorders.com/products/' in page['url']:
  meta=page['meta'];image=meta.get('og:image')
  catalog.append({'title':meta.get('og:title') or meta.get('twitter:title') or '', 'url':page['url'],'images':[urljoin(page['url'],image)] if image else [urljoin(page['url'],i['url']) for i in page['images'] if i.get('alt')], 'source':'Ksecret reference','body_html':meta.get('description') or meta.get('og:description') or ''})
 for link in page['links']:
  if re.search(r'product(?:\.php)?\?id=|/product/',link['url']) and link['text'] and link['images']:
   catalog.append({'title':link['text'],'url':link['url'],'images':link['images'],'source':'Farah Glow','body_html':''})
matches=[]
for p in original:
 q=queries.get(p['id'],p['name']);brand=words(p['brand']);candidates=[]
 for c in catalog:
  brand_text=norm(p['brand']).replace(' ','')
  branded=brand<=words(c['title']) or (len(brand_text)>=4 and brand_text in norm(c['title']).replace(' ',''))
  exact=score(p['name'],c['title'])
  if not branded and exact<97:continue
  value=max(score(q,c['title']),exact)+(2 if p['source']==c['source'] else 0)
  if c['images']:candidates.append((value,c))
 candidates.sort(key=lambda x:x[0],reverse=True)
 matches.append({'id':p['id'],'query':q,'name':p['name'],'candidates':[{'score':value,**c} for value,c in candidates[:5]]})
(CACHE/'matches.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2))
for m in matches:
 c=m['candidates'][0] if m['candidates'] else {}
 print(m['id'],'|',m['name'],'=>',c.get('score'),c.get('title','NO MATCH'))
print(json.dumps({'evidence_records':len(catalog),'matched':sum(bool(m['candidates']) for m in matches)}))
