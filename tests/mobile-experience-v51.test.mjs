import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {loadContactPhone} from '../public/checkout-phone.js';
import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings} from '../public/site-settings.js';
import {createSiteSettingsManager} from '../public/site-settings-admin.js';
import worker,{_test} from '../src/worker.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),json=p=>JSON.parse(read(p));
const catalog=json('public/catalog.json'),offers=json('public/campaign-offers.json'),pause=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let n=0;n<120;n++){if(fn())return;await pause()}assert.ok(fn(),'state did not arrive')}
async function open(t,{path='#/product/TS0081',cart=[],products=catalog,live=false,settings=DEFAULT_SITE_SETTINGS,onOrder,onStatus,onCatalog,beforeReady,reviews=[]}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(read('public/index.html'),{url:'https://trendjo.pages.dev/'+path,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());const w=dom.window,d=w.document,sent=[];
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.loadContactPhone=loadContactPhone;w.localStorage.setItem('trend-shop-cart-v1',JSON.stringify(cart));
 const viewport=new w.EventTarget();viewport.height=760;viewport.offsetTop=0;Object.defineProperty(w,'visualViewport',{value:viewport});
 w.fetch=async(url,options={})=>{const path=String(url).split('?')[0];if(path==='/api/catalog'&&onCatalog)await onCatalog();if(path==='/api/orders'){sent.push(options);if(onOrder)return onOrder(options);throw Error('Real orders are prohibited in DOM tests')}if(path==='/api/order-status')return onStatus?onStatus():Response.json({received:false});const data=path==='/api/catalog'?{products,promotions:offers,storeLive:live,siteSettings:settings}:path==='/api/reviews'?{reviews,summary:{count:reviews.length,average:reviews.length?4:null}}:path==='/api/product-videos'?{videos:[]}:path==='/category-media.json'?json('public/category-media.json'):path==='/product-galleries.json'?json('public/product-galleries.json'):path==='/catalog-thumbnails.json'?json('public/catalog-thumbnails.json'):path==='/product-media.json'?json('public/product-media.json'):{};return{ok:true,json:async()=>data}};
 w.eval(storefrontBundle);await beforeReady?.({w,d});await until(()=>d.querySelector('.product-story,#checkoutForm,.hero .product-card,#app>.hero,#allReviews,#productResults'));if(d.querySelector('.hero'))await until(()=>d.querySelector('.product-card'));await pause();assert.deepEqual(errors,[]);return{w,d,sent,viewport,errors};
}
function fill(d){const f=d.querySelector('#checkoutForm');for(const[k,v]of Object.entries({name:'طلب اختبار محلي',phone:'0791234567',governorate:'عمّان',address:'العبدلي',notes:'اختبار لا يرسل طلبات'}))f.elements[k].value=v;f.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));return f}
function input(w,field,value){field.value=value;field.dispatchEvent(new w.Event('input',{bubbles:true}))}
const cart=(w)=>JSON.parse(w.localStorage.getItem('trend-shop-cart-v1'));

test('Search is a modal, follows the visible keyboard viewport, and releases sizing listeners on close',async t=>{
 const {w,d,viewport}=await open(t);d.querySelector('#searchBtn').click();const panel=d.querySelector('#searchPanel');assert.equal(panel.tagName,'DIALOG');assert.equal(panel.open,true);assert.equal(d.activeElement.id,'globalSearch');assert.equal(d.body.style.overflow,'hidden');viewport.height=360;viewport.offsetTop=18;viewport.dispatchEvent(new w.Event('resize'));assert.equal(panel.style.getPropertyValue('--search-height'),'360px');assert.equal(panel.style.getPropertyValue('--search-top'),'18px');assert.equal(panel.dataset.compact,'true');input(w,d.querySelector('#globalSearch'),'تونر');assert.ok(d.querySelectorAll('#globalSuggestions [role=option]').length>1);assert.ok(d.querySelector('.search-result-price'));d.querySelector('#clearSearch').click();assert.equal(d.querySelector('#globalSearch').value,'');assert.equal(d.querySelector('#globalSuggestions').hidden,true);d.querySelector('#closeSearch').click();assert.equal(panel.hidden,true);assert.equal(panel.open,false);assert.equal(d.body.style.overflow,'');viewport.height=999;viewport.dispatchEvent(new w.Event('resize'));assert.equal(panel.style.getPropertyValue('--search-height'),'360px');
});

test('Quick review edits quantities and shipping in place without remounting delivery details',async t=>{
 const products=catalog.map(p=>p.id==='TS0081'?{...p,priceFils:11000}:p);const {w,d}=await open(t,{products});d.querySelector('.story-order').click();await until(()=>d.querySelector('#checkoutForm'));const f=fill(d);d.querySelector('#checkoutSummary [data-step="1"]').click();assert.equal(d.querySelector('#checkoutForm'),f);assert.equal(f.elements.address.value,'العبدلي');assert.equal(cart(w)[0].qty,2);assert.match(d.querySelector('#checkoutSummary').textContent,/19.99/);assert.match(d.querySelector('#checkoutSummary').textContent,/مجاني/);d.querySelector('#checkoutSummary [data-step="-1"]').click();assert.equal(cart(w)[0].qty,1);assert.match(d.querySelector('#checkoutSummary').textContent,/1.00/);assert.doesNotMatch(d.querySelector('.quick-checkout').textContent,/بتأكيد الطلب توافقين/);assert.equal(d.querySelector('.quick-checkout a[href="#/privacy"]'),null);
});

test('Removing the last item disables confirmation; search adds a replacement and preserves the form',async t=>{
 const {w,d,sent}=await open(t,{path:'#/checkout',cart:[{id:'TS0081',qty:1}]});const f=fill(d);d.querySelector('#checkoutSummary [data-remove-cart]').click();assert.deepEqual(cart(w),[]);assert.equal(d.querySelector('#confirmButton').disabled,true);assert.ok(d.querySelector('.checkout-empty'));d.querySelector('[data-checkout-add]').click();assert.equal(d.querySelector('#searchAllResults').hidden,true);input(w,d.querySelector('#globalSearch'),'جلايكوليك');d.querySelector('#globalSuggestions [role=option]').click();assert.equal(d.querySelector('#searchPanel').hidden,true);assert.equal(w.location.hash,'#/checkout');assert.equal(cart(w)[0].id,'TS0064');assert.equal(d.querySelector('#checkoutForm'),f);assert.equal(f.elements.name.value,'طلب اختبار محلي');assert.equal(f.elements.address.value,'العبدلي');assert.equal(d.querySelector('#confirmButton').disabled,false);assert.equal(sent.length,0);
});

test('Order-review search opens the required tone picker before adding a foundation',async t=>{
 const {w,d}=await open(t,{path:'#/checkout',cart:[{id:'TS0081',qty:1}]});const f=fill(d);d.querySelector('[data-checkout-add]').click();input(w,d.querySelector('#globalSearch'),'كومبلكشن');const option=d.querySelector('#globalSuggestions a[href="/p/TS0347"]');assert.ok(option);option.click();assert.equal(cart(w).length,1);const dialog=d.querySelector('.option-dialog');assert.equal(dialog.open,true);const tone=dialog.querySelector('[value="tone-3"]');tone.checked=true;dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.ok(cart(w).some(x=>x.id==='TS0347'&&x.variant==='tone-3'));assert.equal(f,d.querySelector('#checkoutForm'));assert.equal(f.elements.address.value,'العبدلي');assert.equal(d.querySelector('#checkoutSummary [data-cart-option="TS0347"]').value,'tone-3');
});

test('A bundle stays one image and complete price row while quantities change or it is removed',async t=>{
 const id='PROMONOV3-SUN-TONER';const {w,d}=await open(t,{path:'#/checkout',cart:[{id,qty:1,options:{}}]});const row=()=>d.querySelector('.checkout-product-row');assert.equal(d.querySelectorAll('.checkout-product-row').length,1);assert.match(row().querySelector('img').src,/bundle-1-nov3/);assert.match(row().querySelector('.checkout-product-price').textContent,/11.00/);row().querySelector('[data-step="1"]').click();assert.equal(cart(w)[0].qty,2);assert.equal(d.querySelectorAll('.checkout-product-row').length,1);assert.match(row().querySelector('.checkout-product-price').textContent,/19.99/);row().querySelector('[data-remove-cart]').click();assert.equal(d.querySelector('#confirmButton').disabled,true);
});

test('Merging tones rejects stale quantities beyond current stock instead of changing the cart',async t=>{
 const products=catalog.map(p=>p.id==='TS0347'?{...p,stock:3}:p);const {w,d}=await open(t,{path:'#/checkout',products,live:true,cart:[{id:'TS0347',qty:2,variant:'tone-1'},{id:'TS0347',qty:2,variant:'tone-2'}]});const select=d.querySelector('[data-old-variant="tone-1"]');select.value='tone-2';select.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(cart(w).length,2);assert.equal(cart(w)[0].variant,'tone-1');assert.equal(d.querySelectorAll('.checkout-product-row').length,2);
});

test('An in-flight or unresolved order locks all cart mutations and safely retries its original key',async t=>{
 let rejectFirst;const {w,d,sent}=await open(t,{path:'#/checkout',live:true,cart:[{id:'TS0081',qty:1}],onOrder:()=>sent.length===1?new Promise((_,reject)=>rejectFirst=reject):Response.json({orderId:'TR-V51-LOCAL-RETRY',paymentMethod:'cod',shippingFeeFils:1000,totalFils:12000})});const f=fill(d);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>sent.length===1);const first=JSON.stringify(cart(w));assert.equal(d.querySelector('[data-checkout-add]').disabled,true);d.querySelector('#checkoutSummary [data-step="1"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(JSON.stringify(cart(w)),first);rejectFirst(Error('lost response'));await until(()=>!d.querySelector('#confirmButton').disabled);assert.equal(d.querySelector('[data-checkout-add]').disabled,true);d.querySelector('#checkoutSummary [data-remove-cart]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(JSON.stringify(cart(w)),first);assert.ok(w.sessionStorage.getItem('trend-shop-pending-checkout-v3'));f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>d.querySelector('.success-panel'));assert.equal(sent.length,2);assert.equal(sent[0].headers['x-idempotency-key'],sent[1].headers['x-idempotency-key']);assert.equal(sent[0].body,sent[1].body);assert.equal(w.sessionStorage.getItem('trend-shop-pending-checkout-v3'),null);
});

test('Participation is absent in both languages while existing approved experiences remain readable',async t=>{
 for(const prefix of ['','?lang=en']){for(const page of ['#/','#/product/TS0081','#/reviews']){const {d}=await open(t,{path:prefix+page});assert.equal(d.querySelector('.review-entry'),null);assert.equal(d.querySelector('[data-review-entry-link]').hidden,true);assert.ok([...d.querySelectorAll('[data-story-scroll="productReviews"]')].every(x=>x.hidden));}}
 const approved={id:'test',display_name:'سارة',rating:4,body:'تجربة شراء حقيقية للمراجعة المحلية فقط',governorate:'عمّان',created_at:'2026-11-01 10:00:00',images:[]};const {d}=await open(t,{reviews:[approved]});assert.equal(d.querySelector('#productReviews').hidden,false);assert.ok(d.querySelector('.review-card'));assert.equal(d.querySelector('.review-entry'),null);
});

test('The owner can re-enable participation without changing product, order or media controls',async t=>{
 const {d}=await open(t,{settings:{...DEFAULT_SITE_SETTINGS,reviewSubmissionsEnabled:true}});assert.ok(d.querySelector('.review-entry'));assert.equal(d.querySelector('[data-review-entry-link]').hidden,false);assert.ok(read('public/admin.html').includes('id="reviewsTab"'));assert.equal(normalizeSiteSettings({...DEFAULT_SITE_SETTINGS,reviewSubmissionsEnabled:true}).reviewSubmissionsEnabled,true);assert.throws(()=>normalizeSiteSettings({...DEFAULT_SITE_SETTINGS,reviewSubmissionsEnabled:'true'}));
});

test('Owner settings editor saves the participation switch through its normal explicit save flow',async()=>{
 const dom=new JSDOM('<section id="siteSection"></section>');try{let settings={...DEFAULT_SITE_SETTINGS,revision:4},posted;const manager=createSiteSettingsManager({root:dom.window.document,getProducts:()=>catalog,call:async(path,method,body)=>{if(method==='POST'){posted=body;settings={...body.settings,revision:5};return{ok:true}}return{settings,history:[]}}});await manager.load();const doc=dom.window.document,toggle=doc.querySelector('[name="reviewSubmissionsEnabled"]');assert.equal(toggle.checked,false);toggle.checked=true;doc.querySelector('form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await until(()=>posted);assert.equal(posted.settings.reviewSubmissionsEnabled,true);assert.equal(posted.revision,4);}finally{dom.window.close()}
});

test('Korean gateway and collection use the new universe assets and customer headings omit edit',async t=>{
 const {d}=await open(t,{path:'#/'});assert.match(d.querySelector('.category-korean img').src,/korean-care-woman-v551/);assert.doesNotMatch(d.querySelector('#app').textContent,/\bedit\b/i);assert.ok(d.querySelector('.logo .wordmark-trend'));const page=await open(t,{path:'#/shop?collection=korean-care'});assert.match(page.d.querySelector('.korean-universe-hero img').src,/korean-universe-banner-v51/);assert.equal(page.d.querySelector('h1').textContent,'Korean care');
});

test('Paused review endpoints reject old forms and uploads, while the admin switch and moderation remain available',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));let env;const prepare=(q,args=[])=>({bind:(...v)=>prepare(q,v),first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})});env={DB:{prepare:q=>prepare(q)},SESSION_SECRET:'a-dedicated-local-test-secret-longer-than-thirty-two-characters',ADMIN_PASSWORD_HASH:'local-test-hash'};sql.prepare("INSERT INTO site_settings(id,revision,config_json) VALUES('storefront',1,?)").run(JSON.stringify(DEFAULT_SITE_SETTINGS));const call=(path,body,headers={})=>worker.fetch(new Request('https://test.local'+path,{method:body?'POST':'GET',headers:{origin:'https://test.local','content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined}),env,{});
 try{for(const path of ['/api/reviews','/api/reviews/verify','/api/reviews/media']){const r=await call(path,{token:'an-old-form-token'});assert.equal(r.status,403);assert.equal((await r.json()).code,'REVIEW_SUBMISSIONS_PAUSED');}const cookie='ts_admin='+await _test.makeSession(env);assert.equal((await call('/api/admin/reviews',null,{cookie})).status,200);const saved=await call('/api/admin/site-settings',{revision:1,settings:{...DEFAULT_SITE_SETTINGS,reviewSubmissionsEnabled:true}},{cookie,'x-trend-admin':'1'});assert.equal(saved.status,200);const publicSettings=await(await call('/api/site-settings')).json();assert.equal(publicSettings.settings.reviewSubmissionsEnabled,true);assert.equal((await call('/api/reviews/verify',{orderId:'invalid',phone:'invalid'})).status,400);assert.equal(sql.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM product_videos').get().n,0);}finally{sql.close()}
});


test('A query typed while the catalog is loading stays open and receives results when loading finishes',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const {d}=await open(t,{path:'#/',onCatalog:()=>gate,beforeReady:async({w,d})=>{
  d.querySelector('#searchBtn').click();input(w,d.querySelector('#globalSearch'),'تونر');
  assert.equal(d.querySelector('#searchPanel').open,true);
  assert.match(d.querySelector('#globalSuggestions').textContent,/نجهّز لكِ اختياراتكِ/);
  release();
 }});
 assert.equal(d.querySelector('#searchPanel').open,true);
 assert.equal(d.querySelector('#globalSearch').value,'تونر');
 assert.ok(d.querySelectorAll('#globalSuggestions [role=option]').length>1);
 assert.equal(d.activeElement.id,'globalSearch');
 assert.equal(d.body.style.overflow,'hidden');
});
