import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM,VirtualConsole} from 'jsdom';
import {productType,matchesProductType} from '../public/product-types.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('public/catalog.json')),products=JSON.parse(read('data/intake-2026-10-27/products.json')),manifest=JSON.parse(read('data/intake-2026-10-27/manifest.json')),images=JSON.parse(read('data/intake-2026-10-27/images.json'));
test('Every photographed item maps to one of 85 new SKUs or 9 existing SKUs, with distinct sizes and brands retained',()=>{
 assert.equal(manifest.length,94);assert.equal(manifest.filter(p=>p.existing).length,9);assert.equal(products.length,85);assert.equal(catalog.length,317);assert.equal(new Set(catalog.map(p=>p.id)).size,317);
 for(const r of manifest)assert.equal(catalog.filter(p=>p.id===r.id).length,1,r.id);
 assert.match(products.find(p=>p.id==='TS0215').details.size,/100/);assert.ok(catalog.some(p=>p.id==='TS0059'));
 for(const id of ['TS0202','TS0257','TS0258'])assert.equal(productType(catalog.find(p=>p.id===id)),'mascara');
 assert.notEqual(products.find(p=>p.id==='TS0202').brand,products.find(p=>p.id==='TS0257').brand);
 assert.equal(productType(products.find(p=>p.id==='TS0256')),'foundation');assert.match(products.find(p=>p.id==='TS0256').name,/Foundation/);
 assert.equal(products.find(p=>p.id==='TS0275').details.shade,'200 Ivory');assert.equal(products.find(p=>p.id==='TS0246').details.shade,'52');
});
test('All new products have individual copy, honest introductory comparisons, clear retail prices and 24 initial units',()=>{
 assert.equal(new Set(products.map(p=>p.description)).size,85);
 for(const p of products){assert.ok(p.description.length>90,p.id);assert.equal(p.details.benefits.length,3);assert.ok(p.details.howToUse&&p.details.notes);assert.equal(p.stock,24);assert.equal(p.approved,true);assert.ok(p.priceFils>=500&&p.priceFils<=20000);assert.ok(p.reference<=20000&&p.reference>p.priceFils);assert.ok([0,490,500,750,990].includes(p.priceFils%1000));assert.equal(p.discount,Math.floor((p.reference-p.priceFils)*100/p.reference+1e-8));assert.equal(p.details.introductoryOffer,true);assert.ok(productType(p),p.id)}
 assert.match(products.find(p=>p.id==='TS0241').details.variantNote,/تأكيد/);
 assert.match(products.find(p=>p.id==='TS0257').details.variantNote,/العبوة فقط/);
 assert.match(products.find(p=>p.id==='TS0230').description,/4%/);
 assert.match(products.find(p=>p.id==='TS0214').details.howToUse,/لا يُشطف/);
});
test('Every new image has reviewed provenance, genuine WebP bytes, a compact thumbnail and a larger zoom image',()=>{
 assert.equal(images.length,85);const thumbs=JSON.parse(read('public/catalog-thumbnails.json'));
 for(const r of images){assert.equal(r.visuallyReviewed,true);assert.ok(r.sourcePage&&r.sourceImage&&r.sourcePhotoSha256);assert.ok(Math.min(r.width,r.height)>=500,r.id);assert.ok(r.thumbnailWidth<=600&&r.thumbnailHeight<=600);assert.equal(thumbs[r.id].primary,r.primary);
  for(const path of [r.primary,r.thumbnail]){const b=fs.readFileSync(new URL('../public'+path,import.meta.url));assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP')}
  const p=products.find(p=>p.id===r.id);assert.equal(p.image,r.primary);assert.equal(p.details.imageEditedWithAI,r.aiEdited);if(r.aiEdited)assert.match(p.details.imageNote,/بالذكاء الاصطناعي/);
 }
 assert.ok(images.reduce((n,p)=>n+p.thumbnailBytes,0)<images.reduce((n,p)=>n+p.bytes,0)*.45);
});
test('Additive migration can be repeated after sales and edits without restocking or changing any order',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));db.exec(read('db/seed.sql'));db.exec("UPDATE products SET stock=7 WHERE id='TS0060'");
 const before=db.prepare('SELECT * FROM products').all(),sql=read('db/migrations/0008_catalog_intake_2026_10_27.sql');db.exec(sql);
 for(const old of before)assert.deepEqual({...db.prepare('SELECT * FROM products WHERE id=?').get(old.id)},{...old});
 assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n,275);
 db.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils,shipping_fee_fils) VALUES('TEST-INTAKE','intake-key','Test','0790000000','عمّان','العبدلي','cod',6990,1000); INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('TEST-INTAKE','TS0202','Saved product name',1,6990); UPDATE products SET price_fils=6500,description='Admin edit' WHERE id='TS0202'");
 const saved=db.prepare('SELECT * FROM products ORDER BY id').all(),order=db.prepare('SELECT * FROM orders').get(),item=db.prepare('SELECT * FROM order_items').get();db.exec(sql);
 assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),saved);assert.deepEqual(db.prepare('SELECT * FROM orders').get(),order);assert.deepEqual(db.prepare('SELECT * FROM order_items').get(),item);assert.equal(db.prepare("SELECT stock FROM products WHERE id='TS0202'").get().stock,23);db.close();
});
const pause=()=>new Promise(r=>setTimeout(r,5));
async function open(t,hash){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM(read('public/index.html'),{url:'https://trendjo.pages.dev/'+hash,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());const w=dom.window,d=w.document;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};let sends=0;
 w.fetch=async url=>{const path=String(url).split('?')[0];if(path==='/api/orders'){sends++;throw Error('Tests must not send orders')};return{ok:true,json:async()=>path==='/api/catalog'?{products:catalog,promotions:[],storeLive:false}:path==='/catalog-thumbnails.json'?JSON.parse(read('public/catalog-thumbnails.json')):path==='/product-galleries.json'?JSON.parse(read('public/product-galleries.json')):catalog}};
 w.eval(['product-links.js','commerce.js','shop-tools.js','image-zoom.js','autocomplete.js','product-share.js','product-types.js','product-variants.js','app.js'].map(f=>read('public/'+f).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n'));
 for(let i=0;i<60&&!d.querySelector('.product-card,.detail-content');i++)await pause();assert.deepEqual(errors.map(e=>e.message),[]);return{w,d,sends:()=>sends};
}
test('Dedicated mascara page lists only mascara and keeps type, query and sorting together',async t=>{
 const {w,d}=await open(t,'#/shop?type=mascara');assert.equal(d.querySelector('h1').textContent,'المسكارا');assert.equal(d.querySelector('#typeSelect').value,'mascara');const expected=catalog.filter(p=>matchesProductType(p,'mascara'));assert.equal(d.querySelector('#resultCount').textContent,expected.length+' منتج');
 const field=d.querySelector('#queryInput');field.value='ميس لارا';field.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,130));assert.equal(d.querySelector('#resultCount').textContent,'2 منتج');
 const sort=d.querySelector('#sortSelect');sort.value='price-asc';sort.dispatchEvent(new w.Event('change',{bubbles:true}));for(let i=0;i<40&&!w.location.hash.includes('sort=price-asc');i++)await pause();await pause();assert.match(w.location.hash,/type=mascara/);assert.equal(d.querySelector('#typeSelect').value,'mascara');assert.equal(d.querySelector('#queryInput').value,'ميس لارا');assert.equal(d.querySelector('#resultCount').textContent,'2 منتج');
});
test('New arrivals show the latest 59 additions; details offer tone choices without technical image captions',async t=>{
 const {w,d,sends}=await open(t,'#/shop?new=1');assert.equal(d.querySelector('#resultCount').textContent,'59 منتج');
 w.location.hash='#/product/TS0275';for(let i=0;i<40&&!d.querySelector('.detail-content');i++)await pause();assert.equal(d.querySelectorAll('.variant-picker input').length,4);assert.doesNotMatch(d.body.textContent,/بالذكاء الاصطناعي/);assert.ok(d.querySelector('#shareProduct'));assert.ok(d.querySelector('#openImageZoom'));assert.match(d.querySelector('.intro-price-note').textContent,/السعر العادي/);assert.equal(d.querySelector('.old-price').getAttribute('aria-label'),'السعر العادي');assert.equal(sends(),0);
});
test('Tools are available as their own category and cannot leak into the face powder section',async t=>{
 const {d}=await open(t,'#/shop?cat=الأدوات');assert.equal(d.querySelector('#resultCount').textContent,'4 منتج');for(const id of ['TS0260','TS0276','TS0277'])assert.equal(catalog.find(p=>p.id===id).category,'الأدوات');assert.equal(matchesProductType(catalog.find(p=>p.id==='TS0219'),'powder'),false);
});
