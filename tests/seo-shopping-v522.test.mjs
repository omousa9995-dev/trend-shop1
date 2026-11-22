import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
import worker from '../src/worker.js';
import {BUYING_GUIDES,guideProducts} from '../public/buying-guides.js';
import {productUrl,productPath,parseStoreRoute} from '../public/product-links.js';
import {productPageHtml} from '../src/product-page.js';
import {validGlobalRating,globalRatingHtml} from '../public/global-product-ratings.js';
import {normalizeSearch} from '../public/shop-tools.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('public/catalog.json'));
function fixture(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec(read('db/schema.sql'));
 for(const id of ['TS0065','TS0079','TS0080','TS0091','TS0109','TS0202','TS0228','TS0001']){
  const p=catalog.find(p=>p.id===id);assert.ok(p,id);
  sql.prepare('INSERT INTO products(id,brand,name,category,subcategory,description,details_json,image_url,price_fils,reference_price_fils,stock,active,approved) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,1)').run(p.id,p.brand,p.name,p.category,p.subcat||'',p.description,JSON.stringify(p.details),p.image,p.priceFils,p.reference,4);
 }
 sql.exec("UPDATE products SET price_fils=12000,reference_price_fils=15000 WHERE id='TS0065'; INSERT INTO products(id,brand,name,category,price_fils,reference_price_fils,stock,approved,active) VALUES('TS9998','Hidden','Hidden private draft','البشرة',8000,8000,5,0,1),('TS0023','Retired','Retired product','البشرة',8000,8000,5,1,1)");
 const stmt=(q,args=[])=>({bind:(...values)=>stmt(q,values),all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args)||null});
 const env={DB:{prepare:q=>stmt(q)},ASSETS:{fetch:async req=>{const p=new URL(req.url).pathname;return new Response(read('public'+p),{headers:{'content-type':p.endsWith('.json')?'application/json':'text/html'}})}}};
 const get=(path,method='GET')=>worker.fetch(new Request('https://trendjo.pages.dev'+path,{method}),env,{});
 return{sql,env,get};
}
test('A first HTTP load contains the selected product, unique description, real price and indexable clean links',async t=>{
 const f=fixture(t),titles=new Set(),descriptions=new Set();
 for(const id of ['TS0065','TS0079','TS0091','TS0228']){
  const response=await f.get(productPath(id));assert.equal(response.status,200);const dom=new JSDOM(await response.text()),d=dom.window.document;t.after(()=>dom.window.close());
  const schema=JSON.parse(d.querySelector('[data-store-seo]').textContent);assert.equal(schema['@type'],'Product');assert.equal(schema.sku,id);assert.equal(schema.offers.priceCurrency,'JOD');assert.ok(Number(schema.offers.price)>0);assert.equal(schema.aggregateRating,undefined);assert.equal(d.querySelector('link[rel=canonical]').href,productUrl(id));assert.ok(d.querySelector('[data-server-product] h1'));assert.ok(d.querySelector('.seo-current-price').textContent.includes(schema.offers.price));assert.doesNotMatch(d.querySelector('#app').textContent,/نجهّز تفاصيل/);titles.add(d.title);descriptions.add(d.querySelector('meta[name=description]').content);
 }
 assert.equal(titles.size,4);assert.equal(descriptions.size,4);
});
test('Sitemap includes all nine buying pages and only public, approved product URLs; robots advertises it',async t=>{
 const f=fixture(t),r=await f.get('/sitemap.xml');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/xml/);const xml=await r.text(),dom=new JSDOM(xml,{contentType:'application/xml'});t.after(()=>dom.window.close());const urls=[...dom.window.document.querySelectorAll('loc')].map(x=>x.textContent);
 for(const guide of BUYING_GUIDES)assert.ok(urls.includes('https://trendjo.pages.dev'+guide.path));
 assert.ok(urls.includes(productUrl('TS0065')));assert.equal(urls.length,18);assert.doesNotMatch(xml,/TS9998|TS0023|#\/product|admin|checkout/);assert.equal(new Set(urls).size,urls.length);assert.match(read('public/robots.txt'),/Sitemap: https:\/\/trendjo.pages.dev\/sitemap.xml/);
});
test('Timed offer price and expiry agree between no-JavaScript product HTML, JSON-LD and the Merchant feed',async t=>{
 const f=fixture(t),now=Math.floor(Date.now()/1000);f.sql.prepare("INSERT INTO limited_offers(slot,product_id,price_fils,starts_at,ends_at,active,request_id) VALUES(1,'TS0065',8010,?,?,1,'seo-fixture')").run(now-60,now+3600);
 let d=new JSDOM(await(await f.get('/product/TS0065')).text()).window.document;let schema=JSON.parse(d.querySelector('[data-store-seo]').textContent);assert.equal(schema.offers.price,'8.01');assert.ok(schema.offers.priceValidUntil);assert.match(d.querySelector('.seo-current-price').textContent,/8\.01/);
 let xml=await(await f.get('/google-products.xml')).text();assert.match(xml,/<g:price>12\.00 JOD<\/g:price><g:sale_price>8\.01 JOD/);assert.doesNotMatch(xml,/TS9998|TS0023|gtin|#\/product/);const feed=new JSDOM(xml,{contentType:'application/xml'});assert.ok(feed.window.document.querySelector('rss channel item'));feed.window.close();
 f.sql.prepare('UPDATE limited_offers SET ends_at=?').run(now-1);
 d=new JSDOM(await(await f.get('/product/TS0065')).text()).window.document;schema=JSON.parse(d.querySelector('[data-store-seo]').textContent);assert.equal(schema.offers.price,'12.00');assert.equal(schema.offers.priceValidUntil,undefined);xml=await(await f.get('/google-products.xml')).text();assert.doesNotMatch(xml,/<g:sale_price>/);
 assert.equal(f.sql.prepare("SELECT price_fils FROM products WHERE id='TS0065'").get().price_fils,12000);
});
test('Each buying page is distinct on its first HTTP load and selects the correct live products',async t=>{
 const f=fixture(t),titles=new Set();assert.equal(BUYING_GUIDES.length,9);
 for(const guide of BUYING_GUIDES){const r=await f.get(guide.path);assert.equal(r.status,200);const dom=new JSDOM(await r.text()),d=dom.window.document;t.after(()=>dom.window.close());assert.equal(d.querySelector('#app h1').textContent,guide.title);assert.ok(d.querySelector('.buying-advice').textContent.length>100);assert.equal(d.querySelector('link[rel=canonical]').href,'https://trendjo.pages.dev'+guide.path);assert.equal(JSON.parse(d.querySelector('[data-store-seo]').textContent)['@type'],'CollectionPage');titles.add(d.title);}
 assert.equal(titles.size,9);assert.ok(guideProducts('estee-lauder-foundation',catalog).some(p=>p.id==='TS0228'));assert.deepEqual(guideProducts('sky-high',catalog).map(p=>p.id),['TS0202']);assert.ok(guideProducts('makeup-under-5',catalog).every(p=>p.category==='المكياج'&&p.priceFils<=5000));
 assert.equal((await f.get('/collections/nonexistent')).status,404);
});
test('Legacy short URLs redirect, hash links remain readable, and unavailable products cannot leak through SEO',async t=>{
 const f=fixture(t),r=await f.get('/p/TS0065?utm_source=facebook');assert.equal(r.status,301);assert.equal(r.headers.get('location'),productUrl('TS0065')+'?utm_source=facebook');assert.equal(parseStoreRoute({pathname:'/',hash:'#/product/TS0065'}).path,'/product/TS0065');
 for(const id of ['TS9998','TS0023','TS9999'])assert.equal((await f.get('/product/'+id)).status,404);
 assert.equal((await f.get('/product/TS0065','POST')).status,405);assert.equal((await f.get('/sitemap.xml','POST')).status,405);assert.equal((await f.get('/google-products.xml','HEAD')).status,200);assert.equal(await(await f.get('/google-products.xml','HEAD')).text(),'');
});
test('External source ratings are clearly attributed, expire, reject unsafe sources and never enter our aggregate rating',()=>{
 const rating={rating:4.78,count:3250,publisher:'COSRX Official',productName:'Snail 96',url:'https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence',checkedAt:'2026-11-22T12:00:00Z'},now=Date.parse('2026-11-22T13:00:00Z');assert.equal(validGlobalRating(rating,now),true);assert.match(globalRatingHtml(rating,{now}),/COSRX Official|منفصلة عن مشتريات Trend/);assert.equal(validGlobalRating({...rating,url:'javascript:alert(1)'},now),false);assert.equal(validGlobalRating({...rating,url:'https://cosrx.com.evil.test/'},now),false);assert.equal(validGlobalRating(rating,now+91*86400000),false);
 const product=catalog.find(p=>p.id==='TS0079'),html=productPageHtml(read('public/index.html'),product,'ar',null,{...rating,checkedAt:new Date().toISOString()}),dom=new JSDOM(html);assert.ok(dom.window.document.querySelector('[data-global-rating]'));assert.equal(JSON.parse(dom.window.document.querySelector('[data-store-seo]').textContent).aggregateRating,undefined);dom.window.close();
 const verified=productPageHtml(read('public/index.html'),product,'ar',{count:2,average:3.5});const d=new JSDOM(verified);assert.deepEqual(JSON.parse(d.window.document.querySelector('[data-store-seo]').textContent).aggregateRating,{'@type':'AggregateRating',ratingValue:3.5,reviewCount:2,bestRating:5,worstRating:1});d.window.close();
});
test('COSRX spelling and both search spellings agree without rewriting unrelated names',()=>{
 assert.equal(normalizeSearch('كوسركس'),normalizeSearch('كوزركس'));assert.ok(catalog.some(p=>p.details?.nameAr.includes('كوزركس')));assert.doesNotMatch(read('public/catalog.json'),/كوسركس/);
});
test('Verified Trend customers choose a real one-to-five-star radio group without a fabricated default',async t=>{
 const bundle=buildSync({stdin:{contents:"export {mountReviews} from './public/reviews.js';",resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'iife',globalName:'ReviewUI',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
 const dom=new JSDOM('<section id="reviews"></section>',{url:'https://trend.test/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/verify')?{token:'local-fixture',products:[{id:'TS0065',name:'Local fixture product'}]}:{reviews:[],summary:{count:0,average:null}}});w.eval(bundle);await w.ReviewUI.mountReviews(w.document.querySelector('#reviews'),{productId:'TS0065',allowSubmissions:true,live:true});
 const verify=w.document.querySelector('.review-verify');verify.elements.orderId.value='TR-TESTA';verify.elements.phone.value='0790000000';verify.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));for(let i=0;i<30&&!w.document.querySelector('.review-rating-stars');i++)await new Promise(r=>setTimeout(r,5));
 const radios=[...w.document.querySelectorAll('input[type=radio][name=rating]')];assert.equal(radios.length,5);assert.deepEqual(radios.map(x=>x.value),['1','2','3','4','5']);assert.ok(radios.every(x=>!x.checked));radios[2].checked=true;radios[2].dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(w.document.querySelectorAll('.review-rating-stars .is-lit').length,3);assert.equal(new w.FormData(w.document.querySelector('.review-form')).get('rating'),'3');
});

test('Rendered product data survives hydration, follows clean navigation and verified ratings, and clears on leaving the product',async t=>{
 const product=catalog.find(p=>p.id==='TS0065');
 const html=productPageHtml(read('public/index.html'),product);
 const dom=new JSDOM(html,{url:productUrl(product.id),runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.fetch=async url=>{const path=String(url).split('?')[0];let data={};
  if(path==='/api/catalog')data={products:catalog,promotions:[],storeLive:false};
  else if(path==='/api/reviews')data={reviews:[],summary:{count:2,average:3.5}};
  else {try{data=JSON.parse(read('public'+path))}catch{}}
  return{ok:true,json:async()=>data};
 };
 const bundle=buildSync({entryPoints:[new URL('../public/app.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
 w.eval(bundle);
 const getSchema=()=>{const script=d.querySelector('[data-store-seo]');return script?JSON.parse(script.textContent):null};
 const settle=async condition=>{for(let i=0;i<80&&!condition();i++)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(condition());};
 await settle(()=>d.querySelector('.product-story:not([data-server-product])')&&getSchema()?.aggregateRating?.reviewCount===2);
 assert.equal(getSchema().sku,'TS0065');assert.equal(getSchema().aggregateRating.ratingValue,3.5);assert.equal(d.querySelectorAll('[data-store-seo]').length,1);
 const click=href=>{const a=d.createElement('a');a.href=href;d.body.append(a);a.click();a.remove();};
 click('/product/TS0079');await settle(()=>getSchema()?.sku==='TS0079'&&getSchema()?.aggregateRating?.reviewCount===2);
 assert.equal(w.location.pathname,'/product/TS0079');assert.equal(w.location.hash,'');assert.equal(getSchema().offers.price,(catalog.find(p=>p.id==='TS0079').priceFils/1000).toFixed(2));
 click('/collections/cosrx');await settle(()=>getSchema()?.['@type']==='CollectionPage');assert.ok(getSchema().mainEntity.itemListElement.length>0);assert.equal(getSchema().sku,undefined);
 click('/#/');await settle(()=>getSchema()===null);assert.ok(d.querySelector('.hero'));
});
