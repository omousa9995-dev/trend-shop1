import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {searchProducts,searchCorrection} from '../public/product-search.js';
import {createCustomerCollections,collectionStorageKey} from '../public/customer-collections.js';
import {productOptions,usesSkinTones,optionSummary} from '../public/product-variants.js';
import {createExperienceMetrics} from '../public/experience-metrics.js';
import {productPageHtml} from '../src/product-page.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';
import worker,{_test} from '../src/worker.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),json=p=>JSON.parse(read(p));
const catalog=json('public/catalog.json');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}};
const pause=()=>new Promise(r=>setTimeout(r,5));
function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));db.exec(read('db/migrations/0027_customer_experience_metrics.sql'));
 const statement=(sql,args=[])=>({bind(...params){return statement(sql,params)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:db.prepare(sql).run(...args)}}});
 const env={DB:{prepare:sql=>statement(sql),async batch(rows){db.exec('BEGIN');try{const result=[];for(const row of rows)result.push(await row.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}},SESSION_SECRET:'experience-fixture-secret-with-more-than-32-characters',ADMIN_PASSWORD_HASH:'fixture-hash',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://example.test/mail',MAIL_WEBHOOK_TOKEN:'fixture-mail-secret-with-more-than-32-characters'};
 t.after(()=>db.close());return {db,env};
}
test('Arabic brand/type aliases and one-character typos find the same products; unknown strengths stay unmatched',()=>{
 for(const [a,b]of [['كوسركس','COSRX'],['أرينسيا','arencia'],['كريم أساس','foundation'],['بودره','powder'],['كنسيلر','concealer']])assert.deepEqual(searchProducts(catalog,a).map(p=>p.id),searchProducts(catalog,b).map(p=>p.id),a);
 assert.ok(searchProducts(catalog,'mascra').length);assert.ok(searchCorrection(catalog,'mascra'));
 assert.equal(searchProducts(catalog,'niacinamide 97').length,0);assert.equal(searchCorrection(catalog,'niacinamide 97'),'');
 assert.equal(searchProducts(catalog,'منتجغيرموجودنهائيا').length,0);
});
test('Favorites and recent visits persist only public IDs, deduplicate, expire and survive blocked storage in memory',()=>{
 let now=Date.now();const storage=memory(),one=createCustomerCollections({storage,now:()=>now});
 one.toggle('TS0151');one.toggle('0791234567');one.visit('TS0313');one.visit('TS0313');
 assert.deepEqual(one.favorites(),['TS0151']);assert.deepEqual(one.recent(),['TS0313']);assert.deepEqual(Object.keys(JSON.parse(storage.getItem(collectionStorageKey))).sort(),['favorites','recent']);
 const two=createCustomerCollections({storage,now:()=>now});assert.deepEqual(two.favorites(),['TS0151']);now+=31*86400000;assert.deepEqual(two.recent(),[]);assert.deepEqual(two.favorites(),['TS0151']);
 const blocked=createCustomerCollections({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});blocked.toggle('TS0151');assert.equal(blocked.persistent,false);assert.equal(blocked.isFavorite('TS0151'),true);assert.equal(createCustomerCollections().persistent,false);
});
test('All 21 face families retain four simple choices, including all powders and concealers, with no new image or reference data',()=>{
 const eligible=catalog.filter(usesSkinTones);assert.equal(eligible.length,21);
 for(const id of ['TS0151','TS0246','TS0262','TS0275','TS0313'])assert.ok(eligible.some(p=>p.id===id));
 for(const id of ['TS0315','TS0316'])assert.equal(usesSkinTones(catalog.find(p=>p.id===id)),false);
 for(const p of eligible){assert.equal(productOptions(p).length,4);assert.ok(productOptions(p).every(x=>!x.image));}
 const custom={...eligible[0],details:{...eligible[0].details,shadeCodes:{'tone-2':'CONFIRMED2'},shadeGuide:{entries:[{id:'tone-2',image:'/images/retired.webp',code:'OLD'}]}}};
 assert.match(productOptions(custom)[1].label,/CONFIRMED2/);assert.equal(productOptions(custom)[1].image,undefined);
});
async function openStore(t,{products=catalog,hash='#/product/TS0313'}={}){
 const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(read('public/index.html'),{url:'https://trend.test/'+hash,pretendToBeVisual:true,runScripts:'outside-only',virtualConsole:vc});t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const sent=[];w.fetch=async(u,options)=>{const path=String(u).split('?')[0];if(options?.method==='POST')sent.push({path,options});return {ok:true,json:async()=>path==='/api/catalog'?{products,storeLive:false,promotions:[]}:path==='/catalog-thumbnails.json'?json('public/catalog-thumbnails.json'):path==='/product-galleries.json'?json('public/product-galleries.json'):{}}};
 w.eval(storefrontBundle);for(let i=0;i<80&&!d.querySelector('.detail-content');i++)await pause();assert.ok(d.querySelector('.detail-content'));assert.deepEqual(errors,[]);return {w,d,sent};
}
test('Full product content stays expanded and favorites and recent visits remain available',async t=>{
 const {w,d}=await openStore(t);for(const id of ['storyTexture','storyFit','storyHow']){const section=d.querySelector('#'+id);assert.ok(section.textContent.trim());assert.equal(section.querySelector('details'),null);}
 assert.equal(d.querySelector('[data-shade-guide],.product-description-toggle,.product-lead-short'),null);
 d.querySelector('.detail-favorite').click();assert.equal(d.querySelector('.detail-favorite').getAttribute('aria-pressed'),'true');w.location.hash='#/saved';for(let i=0;i<60&&!d.querySelector('.saved-products');i++)await pause();assert.equal(d.querySelectorAll('.saved-products .product-card').length,1);
 w.location.hash='#/saved?view=recent';for(let i=0;i<60&&!d.querySelector('[data-clear-collection="recent"]');i++)await pause();assert.equal(d.querySelectorAll('.saved-products .product-card').length,1);d.querySelector('[data-clear-collection="recent"]').click();assert.ok(d.querySelector('.saved-empty'));
});
test('Product HTML keeps a stable-size initial hero, escaped metadata and a visible language control before script loads',()=>{
 const html=productPageHtml(read('public/index.html'),{...catalog.find(p=>p.id==='TS0151'),details:{nameAr:'اختبار <img onerror=x>'}});assert.match(html,/data-product-loading="TS0151"/);assert.match(html,/width="700" height="700" fetchpriority="high"/);assert.match(html,/اختبار &lt;img onerror=x&gt;/);assert.match(html,/id="languageToggle"/);assert.match(html,/commerce\.js\?v=5\.9\.0|commerce\.js\?v=5\.0\.0/);
});
test('Client measurements are off until enabled, honor privacy preferences, deduplicate and never interrupt purchases on network failure',()=>{
 const calls=[],view={navigator:{},innerWidth:390,localStorage:memory(),sessionStorage:memory(),crypto:{randomUUID:()=>crypto.randomUUID()}},m=createExperienceMetrics({view,fetcher:(url,options)=>{calls.push([url,JSON.parse(options.body)]);throw Error('offline')}});
 m.measure('cart_add');assert.equal(calls.length,0);m.configure(true);assert.doesNotThrow(()=>m.measure('cart_add'));m.measure('cart_add');assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0][1]).sort(),['device','metric','session','subject']);assert.equal(calls[0][1].device,'mobile');
 m.optOut(true);m.measure('checkout_start');assert.equal(m.getSession(),'');assert.equal(calls.length,1);view.navigator.globalPrivacyControl=true;m.optOut(false);m.measure('product_view');assert.equal(calls.length,1);
});
test('Public aggregate endpoint rejects contact data and forged successes, deduplicates visits, and private reports require owner login',async t=>{
 const {db,env}=fixture(t),body={session:'anonymous-test-session-123456789',metric:'cart_add',subject:'all',device:'mobile'};
 const send=b=>worker.fetch(new Request('https://trend.test/api/experience-metrics',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json'},body:JSON.stringify(b)}),env,{});
 for(const bad of [{...body,phone:'0791234567'},{...body,metric:'order_success'},{...body,subject:'/checkout?phone=1'},{...body,session:'x'},{...body,metric:'CLS',subject:'product',value:-1}])assert.equal((await send(bad)).status,400);
 assert.equal((await send(body)).status,200);assert.equal((await send(body)).status,200);assert.equal(db.prepare('SELECT amount FROM experience_counts').get().amount,1);const saved=db.prepare('SELECT * FROM experience_seen').get();assert.equal(JSON.stringify(saved).includes(body.session),false);
 const anon=await worker.fetch(new Request('https://trend.test/api/admin/experience-metrics'),env,{});assert.equal(anon.status,401);
 const cookie='ts_admin='+await _test.makeSession(env),report=await worker.fetch(new Request('https://trend.test/api/admin/experience-metrics?days=7',{headers:{cookie}}),env,{});assert.equal(report.status,200);assert.match(report.headers.get('cache-control'),/no-store/);const data=await report.json();assert.equal(data.totals.cart_add,1);assert.equal(data.performance.LCP_mobile.samples,0);
});
test('Performance summaries aggregate standard measurements into documented p75 upper bounds',async t=>{
 const {env}=fixture(t);for(const [n,value]of [400,1100,2400,3400].entries())await worker.fetch(new Request('https://trend.test/api/experience-metrics',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json'},body:JSON.stringify({session:'anonymous-performance-session-'+n,metric:'LCP',subject:'product',device:'mobile',value})}),env,{});
 const response=await worker.fetch(new Request('https://trend.test/api/admin/experience-metrics?days=30',{headers:{cookie:'ts_admin='+await _test.makeSession(env)}}),env,{});assert.deepEqual((await response.json()).performance.LCP_mobile,{samples:4,p75Upper:2500});
});
test('Only a persisted order records a server success, and retrying the same order key preserves stock and metrics',async t=>{
 const {db,env}=fixture(t);db.prepare('INSERT INTO products(id,name,brand,category,reference_price_fils,price_fils,stock,approved,active) VALUES(?,?,?,?,?,?,?,?,?)').run('TS9001','Test product','Test','البشرة',5000,5000,8,1,1);
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({ok:true,ownerSent:true}),{headers:{'content-type':'application/json'}}));const pending=[],ctx={waitUntil:p=>pending.push(p)},data={name:'اسم اختبار',phone:'0791234567',governorate:'عمّان',address:'العبدلي',payment:'cod',items:[{id:'TS9001',qty:1}],experienceSession:'anonymous-checkout-session-12345',experienceDevice:'mobile'};
 const send=()=>worker.fetch(new Request('https://trend.test/api/orders',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-idempotency-key':'order-experience-test-12345'},body:JSON.stringify(data)}),env,ctx);
 assert.equal((await send()).status,201);await Promise.all(pending);assert.equal((await send()).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.equal(db.prepare('SELECT stock FROM products').get().stock,7);assert.equal(db.prepare("SELECT amount FROM experience_counts WHERE metric='order_success'").get().amount,1);
});
