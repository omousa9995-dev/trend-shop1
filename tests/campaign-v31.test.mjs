import {quotePurchase} from '../public/bundles.js';
import {assertCatalogResults} from './helpers/catalog-results.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {quoteCart} from '../public/commerce.js';
import {isKoreanCare} from '../public/korean-care.js';
import {adminPromotions} from '../src/promotions.js';
import {serveImage} from '../src/media.js';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const products=JSON.parse(read('public/catalog.json')),offers=JSON.parse(read('public/campaign-offers.json'));
const cart=(...rows)=>rows.map(([id,qty])=>({id,qty}));
test('Sky High costs 5 JOD singly and every complete group of three costs 10',()=>{
 const expected=[5000,10000,10000,15000,20000,20000,25000,30000,30000,35000];
 for(let qty=1;qty<=10;qty++){const q=quoteCart(cart(['TS0202',qty]),products,offers);assert.equal(q.subtotalFils,expected[qty-1],String(qty));assert.equal(q.promotions.reduce((n,p)=>n+p.count,0),Math.floor(qty/3))}
});
test('Every advertised bundle has its exact price, and independent bundles combine',()=>{
 for(const p of offers){const q=quoteCart(p.items,products,offers);assert.equal(q.subtotalFils,p.priceFils,p.id)}
 const q=quoteCart(cart(['TS0064',2],['TS0263',1],['TS0205',1],['TS0275',1],['TS0305',1]),products,offers);
 assert.equal(q.subtotalFils,29000);assert.equal(q.shippingFeeFils,0);assert.equal(q.promotions.length,3);
});
test('Overlapping Sky High offers allocate real units once and preserve leftover items',()=>{
 const q=quoteCart(cart(['TS0202',4],['TS0272',1],['TS0304',1]),products,offers);
 assert.equal(q.subtotalFils,18000);assert.equal(q.promotions.length,2);
 const used=q.promotions.flatMap(p=>p.items.map(i=>({...i,qty:i.qty*p.count}))).filter(i=>i.id==='TS0202').reduce((n,x)=>n+x.qty,0);assert.equal(used,4);
 const one=quoteCart(cart(['TS0202',3],['TS0272',1],['TS0304',1]),products,offers);assert.equal(one.subtotalFils,18000);assert.equal(one.promotions.length,1);
});
test('Bounded bundle planning matches exhaustive checkout totals on small varied carts',()=>{
 let seed=311;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n};
 for(let sample=0;sample<70;sample++){
  const ps=Array.from({length:4},(_,i)=>({id:'TSR00'+i,priceFils:2000+rand(7)*1000})),lines=ps.map(p=>({id:p.id,qty:1+rand(3)}));
  const promotions=Array.from({length:4},(_,i)=>{const a=rand(4),b=(a+1+rand(3))%4,items=[{id:ps[a].id,qty:1},{id:ps[b].id,qty:1}],before=ps[a].priceFils+ps[b].priceFils;return{id:'PROMOR'+i,items,priceFils:before-500-rand(3)*500,active:true}});
  const subtotal=ps.reduce((n,p,i)=>n+p.priceFils*lines[i].qty,0),fee=n=>n>19000?0:1000;let best=subtotal+fee(subtotal);
  const walk=(i,remaining,saving)=>{if(i===promotions.length){best=Math.min(best,subtotal-saving+fee(subtotal-saving));return}const p=promotions[i],max=Math.min(...p.items.map(x=>remaining.get(x.id))),discount=p.items.reduce((n,x)=>n+ps.find(p=>p.id===x.id).priceFils,0)-p.priceFils;for(let uses=0;uses<=max;uses++){const next=new Map(remaining);for(const x of p.items)next.set(x.id,next.get(x.id)-uses);walk(i+1,next,saving+discount*uses)}};
  walk(0,new Map(lines.map(x=>[x.id,x.qty])),0);assert.equal(quoteCart(lines,ps,promotions).totalFils,best,'sample '+sample);
 }
});
test('Korean care includes Korean makeup, body and hair ranges while excluding other countries',()=>{
 for(const brand of ['COSRX','AXIS-Y','TIRTIR','ETUDE','Derma:B','SEAPURI','VT Cosmetics','Mary & May'])assert.equal(isKoreanCare({brand}),true,brand);
 for(const brand of ['The Ordinary','Kenta','Maybelline','Fino','BIOAQUA','SADOER','CeraVe'])assert.equal(isKoreanCare({brand}),false,brand);
 assert.ok(products.filter(isKoreanCare).length>80);
});
test('Campaign migration is repeatable and preserves stock, approvals, previous orders and administrator changes',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));
 const ids=new Set(offers.flatMap(p=>p.items.map(x=>x.id)));for(const id of ids){const p=products.find(x=>x.id===id);db.prepare('INSERT INTO products(id,brand,name,category,subcategory,description,details_json,reference_price_fils,price_fils,discount_percent,image_url,stock,active,approved) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,1)').run(id,p.brand,p.name,p.category,p.subcat||'',p.description,JSON.stringify(p.details),p.reference,id==='TS0202'?6990:p.priceFils,id==='TS0202'?30:p.discount,p.image,17)}
 db.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils,shipping_fee_fils) VALUES('TR-PAST','old-order','Test','0791234567','عمّان','العبدلي','cod',6990,1000);INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('TR-PAST','TS0202','Past price',1,6990)");
 const before=db.prepare('SELECT id,stock,active,approved FROM products ORDER BY id').all(),sql=read('db/migrations/0017_campaign_offers.sql');db.exec(sql);db.exec(sql);
 assert.deepEqual(db.prepare('SELECT id,stock,active,approved FROM products ORDER BY id').all(),before);assert.equal(db.prepare('SELECT unit_price_fils FROM order_items').get().unit_price_fils,6990);assert.equal(db.prepare('SELECT count(*) n FROM promotions').get().n,5);
 db.exec("UPDATE products SET price_fils=6500 WHERE id='TS0202';UPDATE promotions SET active=0 WHERE id='PROMONOV3-SKY-TRIO'");db.exec(sql);assert.equal(db.prepare("SELECT price_fils FROM products WHERE id='TS0202'").get().price_fils,6500);assert.equal(db.prepare("SELECT active FROM promotions WHERE id='PROMONOV3-SKY-TRIO'").get().active,0);db.close();
});
async function open(t,path){const dom=new JSDOM(read('public/index.html'),{url:'https://trend.test'+path,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;t.after(()=>w.close());w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.fetch=async url=>{if(String(url).startsWith('/api/catalog'))return Response.json({products,promotions:offers,storeLive:false});if(String(url).startsWith('/api/reviews'))return Response.json({reviews:[],summary:{count:0,average:null}});try{return Response.json(JSON.parse(read('public'+String(url).split('?')[0])))}catch{return Response.json({},{status:404})}};w.eval(storefrontBundle);for(let n=0;n<100&&!d.querySelector('.offer-card,.product-card,.detail-content');n++)await new Promise(r=>setTimeout(r,5));await new Promise(r=>setTimeout(r,20));return{w,d}}
test('Korean collection is reachable and clearing its filters closes the panel and restores all products',async t=>{
 const{w,d}=await open(t,'/?lang=en#/shop?collection=korean-care');assertCatalogResults(d,products.filter(isKoreanCare).length);assert.equal(d.querySelector('#collectionSelect').value,'korean-care');d.querySelector('#mobileFilters').click();d.querySelector('#filterReset').click();await new Promise(r=>setTimeout(r,15));assert.equal(w.location.hash,'#/shop');assert.equal(d.querySelector('#filters').hidden,true);assertCatalogResults(d,products.length);
});
test('Bundle addition waits for tone selection and renders one package with its final price in the drawer',async t=>{
 const{w,d}=await open(t,'/?lang=en#/offers');assert.equal(d.querySelectorAll('.campaign-offer').length,5);assert.ok(d.querySelector('.offer-card h2').textContent.includes('The Ordinary'));
 d.querySelector('[data-add-promotion="PROMONOV3-MAYBELLINE"]').click();const dialog=d.querySelector('.option-dialog');assert.equal(dialog.open,true);assert.equal(d.querySelector('#cartCount').textContent,'0');const tone=dialog.querySelector('[value="tone-3"]');tone.checked=true;dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(d.querySelector('#cartCount').textContent,'1');const bag=JSON.parse(w.localStorage.getItem('trend-shop-cart-v1'));assert.equal(bag.length,1);assert.equal(bag[0].id,'PROMONOV3-MAYBELLINE');assert.equal(bag[0].options.TS0272,'tone-3');assert.equal(quotePurchase(bag,products,offers).subtotalFils,8000);assert.equal(d.querySelectorAll('#drawer .cart-line').length,1);assert.match(d.querySelector('#drawer .cart-final-price').textContent,/8.00/);assert.match(d.querySelector('#drawer [data-whatsapp-cart]').href,/wa.me/);
});
test('Every bundle link opens its own product page and its tone selection reaches a single package row',async t=>{
 const {w,d}=await open(t,'/?lang=en#/bundle/PROMONOV3-MAYBELLINE');assert.match(d.querySelector('#storyTitle').textContent,/Maybelline/);d.querySelector('[value="tone-2"]').checked=true;d.querySelector('[data-story-add]').click();d.querySelector('#cartBtn').click();assert.equal(d.querySelectorAll('#drawer .cart-line').length,1);assert.match(d.querySelector('#drawer .cart-final-price').textContent,/8.00/);assert.match(d.querySelector('#drawer .cart-line img').src,/bundle-4/);assert.equal(d.querySelector('#drawer [data-bundle-option]').value,'tone-2');assert.ok(d.querySelector('#drawer .cart-saving-details'));assert.equal(d.querySelector('#drawer del'),null);
});
test('New media records all nine products, five accurate bundles and two category images',()=>{
 const m=JSON.parse(read('data/marketing-assets-2026-11-03.json'));assert.equal(m.images.length,16);for(const row of m.images){assert.ok(row.prompt||row.final_prompt);assert.ok(fs.existsSync(new URL('../public'+row.image,import.meta.url)),row.image)}
 const media=JSON.parse(read('public/product-media.json'));for(const id of ['TS0263','TS0064','TS0084','TS0265','TS0275','TS0228','TS0202','TS0305','TS0269']){assert.equal(media[id].caption.en,'Promotional scene');assert.equal(media[id].primary,products.find(x=>x.id===id).image)}
});
test('Every new image and thumbnail is served, while backups and arbitrary keys stay private',async()=>{
 const m=JSON.parse(read('data/marketing-assets-2026-11-03.json')),urls=m.images.flatMap(r=>[r.image,r.thumbnail]).filter(Boolean);let reads=0;
 const env={MEDIA:{async getWithMetadata(){reads++;return{value:new Response(new Uint8Array([1,2,3])).body,metadata:{contentType:'image/webp',size:3}}}}};
 for(const url of urls){const key='catalog/'+url.slice('/images/catalog/'.length),response=await serveImage(new Request('https://trend.test'+url),env,{},key);assert.equal(response.status,200,url);assert.equal(response.headers.get('content-type'),'image/webp');await response.arrayBuffer()}
 const safeReads=reads;for(const key of ['internal:backup:catalog-v2.3.0-2026-11-02','catalog/marketing/../../internal:backup','catalog/marketing/bundle-1-nov3.js','catalog/marketing/free-file.webp'])assert.equal((await serveImage(new Request('https://trend.test/media/'+key),env,{},key)).status,404);assert.equal(reads,safeReads);
});
test('Editing campaign prices preserves its image and English copy; changing contents discards stale artwork',async()=>{
 const old=offers.find(x=>x.id==='PROMONOV3-LOREAL'),saved=[];const env={DB:{prepare(sql){let args;return{bind(...v){args=v;return this},async first(){return{config_json:JSON.stringify(old)}},async all(){return{results:products.map(p=>({...p,price_fils:p.priceFils,active:1,approved:1}))}},async run(){saved.push(args);return{success:true}}}}}};
 const call=body=>adminPromotions(new Request('https://trend.test/api/admin/promotions',{method:'POST',headers:{'content-type':'application/json','x-trend-admin':'1'},body:JSON.stringify(body)}),env,{json:x=>x,error:x=>{throw Error(x)},sameOrigin:()=>true,content:r=>r.json()});
 await call({...old,priceFils:7500});let config=JSON.parse(saved.at(-1)[4]);assert.equal(config.image,old.image);assert.equal(config.en.title,old.en.title);
 await call({...old,items:[{id:'TS0275',qty:1},{id:'TS0202',qty:1}],priceFils:7500});config=JSON.parse(saved.at(-1)[4]);assert.equal(config.image,undefined);assert.equal(config.en.title,'');
});
