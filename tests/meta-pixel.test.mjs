import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createMetaPixel} from '../public/meta-pixel.js';
import {loadContactPhone} from '../public/checkout-phone.js';
import worker from '../src/worker.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='123456789012345',line={id:'TS0064',qty:1,priceFils:11000};
function client(t,{url='https://trendjo.pages.dev/',choice}={}){
 const dom=new JSDOM('<button data-marketing-preferences hidden>خيارات</button>',{url});t.after(()=>dom.window.close());const w=dom.window,calls=[];
 if(choice)w.localStorage.setItem('trend-shop-marketing-consent-v1',choice);
 w.fbq=(...args)=>calls.push(args);return{w,d:w.document,calls,pixel:createMetaPixel(w)};
}
const events=calls=>calls.filter(x=>['trackSingle','trackSingleCustom'].includes(x[0]));
test('No Meta script or event is created before visitor consent, after refusal, in preview, or on an unrelated host',t=>{
 for(const config of [{},{choice:'rejected'},{live:false,choice:'accepted'},{id:'',choice:'accepted'},{url:'https://preview.example/',choice:'accepted'}]){
  const {w,d,calls,pixel}=client(t,config);delete w.fbq;pixel.configure({id:config.id??id,live:config.live??true});pixel.page('/product/TS0064',{product:line});pixel.added([line]);pixel.order({received:true,orderId:'TR-20261101-ABC1234',totalFils:12000},[line]);assert.equal(d.querySelector('script'),null);assert.equal(w.fbq,undefined);assert.deepEqual(events(calls),[]);
 }
 const {d,pixel}=client(t);pixel.configure({id,live:true});pixel.page('/');d.querySelector('[data-marketing-reject]').click();assert.equal(d.querySelector('#marketingConsent').hidden,true);d.querySelector('[data-marketing-preferences]').click();assert.equal(d.querySelector('#marketingConsent').hidden,false);
});
test('Consent starts one official script, records only the current product, and supports revoke/reaccept without duplicate initialization',t=>{
 const {w,d,pixel}=client(t);delete w.fbq;pixel.configure({id,live:true});pixel.page('/product/TS0064',{product:line});pixel.added([line]);d.querySelector('[data-marketing-accept]').click();
 const calls=()=>w.fbq.queue.map(x=>Array.from(x));assert.equal(d.querySelectorAll('script').length,1);assert.equal(d.querySelector('script').src,'https://connect.facebook.net/en_US/fbevents.js');assert.deepEqual(events(calls()).map(x=>x[2]),['PageView','ViewContent']);assert.deepEqual(calls()[0],['set','autoConfig',false,id]);
 d.querySelector('[data-marketing-preferences]').click();d.querySelector('[data-marketing-reject]').click();const count=events(calls()).length;pixel.page('/checkout',{lines:[line],totalFils:12000});pixel.added([line]);assert.equal(events(calls()).length,count);assert.ok(calls().some(x=>x[0]==='consent'&&x[1]==='revoke'));
 d.querySelector('[data-marketing-preferences]').click();d.querySelector('[data-marketing-accept]').click();assert.equal(calls().filter(x=>x[0]==='init').length,1);assert.deepEqual(events(calls()).slice(-2).map(x=>x[2]),['PageView','InitiateCheckout']);assert.equal(calls().filter(x=>x[0]==='consent'&&x[1]==='grant').length,2);
});
test('SPA events preserve SKU quantities and JOD values; reload/retry cannot turn pending orders into paid purchases or duplicate them',t=>{
 const {w,calls,pixel}=client(t,{choice:'accepted'});pixel.configure({id,live:true});pixel.page('/product/TS0064',{product:line});pixel.page('/product/TS0064',{product:line});pixel.added([{...line,qty:2}]);pixel.page('/checkout',{lines:[{...line,qty:2}],totalFils:20000});
 const response={received:true,orderId:'TR-20261101-ABC1234',totalFils:20000,name:'PRIVATE NAME',phone:'PRIVATE PHONE',email:'private@example.test',mapsUrl:'PRIVATE MAP',notes:'PRIVATE NOTE'};pixel.order(response,[{...line,qty:2}]);pixel.order({...response,duplicate:true},[{...line,qty:2}]);
 const again=createMetaPixel(w);again.configure({id,live:true});again.order(response,[line]);const data=events(calls);assert.deepEqual(data.map(x=>x[2]),['PageView','ViewContent','AddToCart','PageView','InitiateCheckout','OrderPlaced']);
 assert.equal(data[2][3].value,22);assert.equal(data[4][3].value,20);assert.equal(data[5][3].currency,'JOD');assert.equal(data[5][3].payment_status,'pending');assert.deepEqual(data[5][4],{eventID:'order-TR-20261101-ABC1234'});assert.doesNotMatch(JSON.stringify(data),/PRIVATE|private@|Purchase/);
});
test('An analytics failure never interrupts store actions and invalid or unsuccessful orders emit no conversion',t=>{
 const {w,calls,pixel}=client(t,{choice:'accepted'});pixel.configure({id,live:true});for(const result of [{received:false,orderId:'TR-20261101-ABC1234',totalFils:12000},{received:true,orderId:'DEMO-1234',totalFils:12000},{received:true,orderId:'TR-20261101-ABC1234',totalFils:null}])pixel.order(result,[line]);assert.deepEqual(events(calls),[]);w.fbq=()=>{throw Error('Blocked analytics')};assert.doesNotThrow(()=>pixel.page('/product/TS0064',{product:line}));assert.doesNotThrow(()=>pixel.order({received:true,orderId:'TR-20261101-ABC1234',totalFils:12000},[line]));
});
async function storefront(t,{orderOk=true,live=true}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(read('public/index.html'),{url:'https://trendjo.pages.dev/#/product/TS0064',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());const w=dom.window,d=w.document,calls=[],sent=[];
 w.fbq=(...args)=>calls.push(args);w.localStorage.setItem('trend-shop-marketing-consent-v1','accepted');w.loadContactPhone=loadContactPhone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const products=JSON.parse(read('public/catalog.json'));
 w.fetch=async(url,options)=>{const path=String(url).split('?')[0];if(path==='/api/orders'){sent.push(JSON.parse(options.body));return{ok:orderOk,json:async()=>orderOk?{received:true,orderId:'TR-20261101-ABC1234',totalFils:12000,shippingFeeFils:1000}:{error:'تعذّر تسجيل الطلب'}}}return{ok:true,json:async()=>path==='/api/catalog'?{products,promotions:[],storeLive:live,metaPixelId:id}:path==='/catalog-thumbnails.json'?JSON.parse(read('public/catalog-thumbnails.json')):path==='/product-galleries.json'?JSON.parse(read('public/product-galleries.json')):{}}};
 w.eval(['product-links.js','commerce.js','shop-tools.js','image-zoom.js','autocomplete.js','product-share.js','product-types.js','product-variants.js','order-location.js','brand-tools.js','meta-pixel.js','app.js'].map(f=>read('public/'+f).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n'));
 for(let i=0;i<50&&!d.querySelector('.detail-content');i++)await new Promise(r=>setTimeout(r,5));assert.deepEqual(errors,[]);return{w,d,calls,sent};
}
test('Actual storefront actions record product, accepted cart delta, checkout, and only a server-accepted order; form data never enters Pixel',async t=>{
 const {w,d,calls,sent}=await storefront(t);d.querySelector('.detail-content [data-add]').click();d.querySelector('#cartBtn').click();d.querySelector('#drawer a[href="#/checkout"]').click();for(let i=0;i<50&&!d.querySelector('#checkoutForm');i++)await new Promise(r=>setTimeout(r,5));
 d.querySelector('#customerName').value='PRIVATE NAME';d.querySelector('#customerPhone').value='0791234567';d.querySelector('#governorate').value='عمّان';d.querySelector('#address').value='PRIVATE ADDRESS';d.querySelector('#notes').value='PRIVATE NOTE';d.querySelector('#checkoutForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));for(let i=0;i<50&&!d.querySelector('.success-panel');i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(sent.length,1);assert.deepEqual(events(calls).map(x=>x[2]),['PageView','ViewContent','AddToCart','PageView','InitiateCheckout','OrderPlaced']);assert.doesNotMatch(JSON.stringify(calls),/PRIVATE|0791234567|962791234567|Purchase/);assert.equal(d.querySelector('#cartCount').textContent,'0');
});
test('Failed order submission retains the cart and produces no OrderPlaced; demo orders never contact Meta',async t=>{
 for(const config of [{orderOk:false},{live:false}]){
  const {w,d,calls}=await storefront(t,config);d.querySelector('.detail-content [data-add]').click();w.location.hash='#/checkout';for(let i=0;i<50&&!d.querySelector('#checkoutForm');i++)await new Promise(r=>setTimeout(r,5));d.querySelector('#customerName').value='تجربة محلية';d.querySelector('#customerPhone').value='0791234567';d.querySelector('#governorate').value='عمّان';d.querySelector('#address').value='العبدلي';d.querySelector('#checkoutForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));for(let i=0;i<50&&!d.querySelector('#checkoutError')?.textContent&&!d.querySelector('.success-panel');i++)await new Promise(r=>setTimeout(r,5));assert.equal(events(calls).some(x=>x[2]==='OrderPlaced'),false);if(config.live===false)assert.deepEqual(calls,[]);else{assert.equal(d.querySelector('#cartCount').textContent,'1');assert.match(d.querySelector('#checkoutError').textContent,/تعذّر/)}
 }
});
test('Public catalog exposes only a validated Pixel ID for a live store; administrative pages retain their stricter CSP',async()=>{
 const DB={prepare(){return{async all(){return{results:[]}}}}};
 const env={DB,SESSION_SECRET:'a-very-long-random-secret-value-for-test',ADMIN_PASSWORD_HASH:'exists',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://example.test/script',MAIL_WEBHOOK_TOKEN:'this-is-a-very-long-random-mail-secret',META_PIXEL_ID:id};
 for(const [vars,expected]of [[env,id],[{...env,STORE_LIVE:'false'},''],[{...env,META_PIXEL_ID:'<script>'},'']]){const r=await worker.fetch(new Request('https://trendjo.pages.dev/api/catalog'),vars,{});assert.equal((await r.json()).metaPixelId,expected)}
 for(const path of ['/','/admin.html']){const r=await worker.fetch(new Request('https://trendjo.pages.dev'+path),{ASSETS:{async fetch(){return new Response('ok')}}},{});const csp=r.headers.get('content-security-policy');if(path.startsWith('/admin'))assert.doesNotMatch(csp,/facebook/);else assert.match(csp,/script-src 'self' https:\/\/connect.facebook.net/);assert.doesNotMatch(csp,/unsafe-eval/);assert.match(csp,/frame-ancestors 'none'/)}
});
