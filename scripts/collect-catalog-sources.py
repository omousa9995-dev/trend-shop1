"""Collect public catalog evidence for matching; raw responses stay in an ignored cache."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
import hashlib, json, re, shutil

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'deployment-private'/'research'
CACHE.mkdir(parents=True,exist_ok=True)
(ROOT/'data').mkdir(exist_ok=True)
ORIGINAL=ROOT/'data'/'catalog-original.json'
if not ORIGINAL.exists(): shutil.copy2(ROOT/'public'/'catalog.json',ORIGINAL)
original=json.loads(ORIGINAL.read_text())

def fetch(url):
    p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.response')
    if p.exists():return p.read_text()
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html,application/json'}),timeout=25) as response:
        data=response.read(8_000_000)
        p.write_bytes(data)
        return data.decode('utf-8','replace')

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__();self.meta={};self.links=[];self.images=[];self.current=None;self.script=None;self.jsonld=[];self.script_text=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='meta' and a.get('content'):self.meta[a.get('property') or a.get('name') or '']=a['content']
        if tag=='a' and a.get('href'):
            self.current={'url':a['href'],'text':[],'images':[]};self.links.append(self.current)
        if tag=='img':
            image=a.get('src') or a.get('data-src')
            if image:
                self.images.append({'url':image,'alt':a.get('alt','')})
                if self.current:self.current['images'].append(image)
        if tag=='script':self.script=a.get('type');self.script_text=[]
    def handle_data(self,text):
        if self.current:self.current['text'].append(text.strip())
        if self.script:self.script_text.append(text)
    def handle_endtag(self,tag):
        if tag=='a':self.current=None
        if tag=='script':
            if self.script=='application/ld+json':
                try:self.jsonld.append(json.loads(''.join(self.script_text)))
                except ValueError:pass
            self.script=None

feeds=[]
feed_jobs=[('LeoMarka',f'https://leomarka.com/products.json?limit=250&page={page}') for page in range(1,9)]
feed_jobs.append(('Glowcery','https://glowceryjo.com/products.json?limit=250'))
with ThreadPoolExecutor(max_workers=5) as pool:
    futures={pool.submit(fetch,url):(source,url) for source,url in feed_jobs}
    for future in as_completed(futures):
        source,url=futures[future]
        try:
            products=json.loads(future.result()).get('products',[])
            host='https://leomarka.com' if source=='LeoMarka' else 'https://glowceryjo.com'
            for product in products:
                feeds.append({'source':source,'url':host+'/products/'+product['handle'],**product})
            print(json.dumps({'feed':source,'url':url,'products':len(products)}),flush=True)
        except Exception as e:print(json.dumps({'feed':source,'url':url,'error':str(e)}),flush=True)
seen=set();feeds=[p for p in feeds if not ((p['source'],p['id']) in seen or seen.add((p['source'],p['id'])))]
(CACHE/'shopify-products.json').write_text(json.dumps(feeds,ensure_ascii=False))

urls=sorted(set(p['source_url'] for p in original if p['source'] not in ['LeoMarka','Glowcery']))
pages=[]
with ThreadPoolExecutor(max_workers=5) as pool:
    futures={pool.submit(fetch,url):url for url in urls}
    for future in as_completed(futures):
        url=futures[future]
        try:
            parser=PageParser();parser.feed(future.result())
            links=[{'url':urljoin(url,l['url']),'text':' '.join(filter(None,l['text'])),'images':[urljoin(url,x) for x in l['images']]} for l in parser.links]
            pages.append({'url':url,'meta':parser.meta,'images':parser.images,'links':links,'jsonld':parser.jsonld})
            print(json.dumps({'page':url,'images':len(parser.images),'links':len(links)},ensure_ascii=False),flush=True)
        except Exception as e:pages.append({'url':url,'error':str(e)});print(json.dumps({'page':url,'error':str(e)}),flush=True)
(CACHE/'other-pages.json').write_text(json.dumps(pages,ensure_ascii=False))
print(json.dumps({'complete':True,'shopify_products':len(feeds),'other_pages':len(pages)}),flush=True)
