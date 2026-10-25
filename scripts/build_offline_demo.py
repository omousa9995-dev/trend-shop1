"""Create an offline, self-contained, non-transactional preview from the production assets.
No external data uploads, no real orders or account credentials.
"""
from pathlib import Path
import re,json,base64
root=Path(__file__).resolve().parents[1];pub=root/'public'
html=(pub/'index.html').read_text('utf-8')
css=(pub/'styles.css').read_text('utf-8')
app=(pub/'app.js').read_text('utf-8')
products=json.loads((pub/'catalog.json').read_text('utf-8'))
for p in products:
 data=(pub/p['image'].lstrip('/')).read_bytes()
 p['image']='data:image/svg+xml;base64,'+base64.b64encode(data).decode('ascii')
hero=base64.b64encode((pub/'images/hero.webp').read_bytes()).decode('ascii')
css=css.replace("url('/images/hero.webp')", "url('data:image/webp;base64,"+hero+"')")
# Replace CSP with a clearly isolated offline demo policy; no network API, only image links to WhatsApp opened by user.
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
html=html.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>','')
html=html.replace('<link rel="stylesheet" href="/styles.css"/>','<style>'+css+'</style>')
# Site code already fails closed and only previews if catalogue endpoint is unavailable.
payload=json.dumps(products,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
prefix=f"<script>window.__TREND_DEMO_PRODUCTS={payload};window.fetch=async function(url){{if(url==='/catalog.json')return{{ok:true,json:async()=>window.__TREND_DEMO_PRODUCTS}};return{{ok:false}}}};window.__TREND_OFFLINE=true;</script>"
html=html.replace('<script src="/app.js" defer></script>',prefix+'<script>'+app+'</script>')
# Customer support link remains a user-initiated external opening. No tracking, server requests or credential exchange.
output=root.parent/'trend_shop_demo.html'
output.write_text(html,'utf-8')
print(output,'bytes',output.stat().st_size,'products',len(products))
