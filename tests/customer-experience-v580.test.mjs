import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {searchProducts,searchCorrection} from '../public/product-search.js';
import {createCustomerCollections,collectionStorageKey} from '../public/customer-collections.js';
import {normalizeShadeGuide} from '../public/shade-guide-config.js';
import {productOptions,usesSkinTones,optionSummary} from '../public/product-variants.js';
import {createShadeGuide,shadeAdvice} from '../public/shade-guide.js';
import {createShadeGuideManager} from '../public/shade-guide-admin.js';
import {createExperienceMetrics} from '../public/experience-metrics.js';
import {productPageHtml} from '../src/product-page.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';
import worker,{_test} from '../src/worker.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),json=p=>JSON.parse(read(p));
const catalog=json('public/catalog.json'),references=json('public/shade-references.json');
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
test('Shade reference coverage includes all 21 face families and all five powders, excludes hair powder, and uses existing source images',()=>{
 const eligible=catalog.filter(usesSkinTones);assert.equal(eligible.length,21);assert.deepEqual(Object.keys(references.products).sort(),eligible.map(p=>p.id).sort());
 for(const id of ['TS0151','TS0246','TS0262','TS0275','TS0313'])assert.ok(references.products[id]);
 for(const id of ['TS0315','TS0316'])assert.equal(usesSkinTones(catalog.find(p=>p.id===id)),false);
 for(const p of eligible){const ref=references.products[p.id];assert.equal(ref.brand,p.brand);assert.equal(ref.productName,p.name);assert.ok(ref.note&&ref.noteEn);for(const image of ref.images)assert.ok(existsSync(new URL('../public'+image.url,import.meta.url)));assert.ok(productOptions(p).every(x=>!x.code&&!x.image),'No invented stock mapping: '+p.id);}
 assert.match(shadeAdvice(catalog.find(p=>p.id==='TS0313')),/لا تعني وجود أربع درجات/);assert.match(shadeAdvice(catalog.find(p=>p.id==='TS0275')),/بودرة فاونديشن/);
});
test('Shade configuration validates unique choices and safe URLs; owner codes survive into historical order labels',()=>{
 const guide=normalizeShadeGuide({entries:[{id:'tone-2',label:'فاتح محايد',code:'TEST-N2',image:'/images/shades/huda-easy-bake-official-shade-guide.webp'}],referenceUrl:'https://example.test/product'}),p={...catalog.find(p=>p.id==='TS0313'),details:{productType:'powder',shadeGuide:guide}};
 const option=productOptions(p)[1];assert.equal(option.code,'TEST-N2');assert.match(option.label,/TEST-N2/);assert.ok(option.image);
 assert.match(optionSummary({options_snapshot:JSON.stringify([{label:option.label,qty:2}])}),/TEST-N2 × 2/);
 for(const image of ['javascript:alert(1)','data:image/svg+xml,x','/images/../secret','https://user:password@example.test/a'])assert.throws(()=>normalizeShadeGuide({entries:[{id:'tone-1',image}]}));
 assert.throws(()=>normalizeShadeGuide({entries:[{id:'tone-1'},{id:'tone-1'}]}));assert.throws(()=>normalizeShadeGuide({referenceUrl:'http://example.test'}));
});
test('Shade dialog selects without adding to cart, restores focus, renders all Tarte reference panels, and rejects wrong-product references',async t=>{
 const dom=new JSDOM('<button id="start">Open</button>',{pretendToBeVisual:true});t.after(()=>dom.window.close());const d=dom.window.document;dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false};
 const selected=[],guide=createShadeGuide({document:d,fetcher:async()=>({ok:true,json:async()=>references}),onChoose:(p,id)=>selected.push([p.id,id])});
 d.querySelector('#start').focus();await guide.open(catalog.find(p=>p.id==='TS0285'));assert.equal(guide.dialog.querySelectorAll('[data-guide-choice]').length,4);assert.equal(guide.dialog.querySelectorAll('.shade-chart-open').length,6);
 guide.dialog.querySelector('[data-guide-choice="tone-2"]').click();assert.deepEqual(selected,[['TS0285','tone-2']]);assert.equal(guide.dialog.hidden,true);assert.equal(d.activeElement.id,'start');
 await guide.open({...catalog.find(p=>p.id==='TS0285'),name:'A different product'});assert.equal(guide.dialog.querySelectorAll('.shade-chart-open').length,0);guide.close();
 setLocale('en');t.after(()=>setLocale('ar'));await guide.open(catalog.find(p=>p.id==='TS0285'));assert.match(guide.dialog.querySelector('.shade-product-name').textContent,/Shape Tape/);assert.match(guide.dialog.querySelector('[data-guide-choice="tone-2"]').textContent,/Light medium/);guide.close();setLocale('ar');
});
test('Owner shade editor exposes one photo/code per preference, retains saved content, and hides for unrelated products',t=>{
 const dom=new JSDOM('<form id="productForm"><div id="toneEditor"></div></form>');t.after(()=>dom.window.close());const d=dom.window.document,manager=createShadeGuideManager({root:d.querySelector('form')});
 manager.select(catalog.find(p=>p.id==='TS0151'),{shadeCodes:{'tone-2':'TEST02'}});assert.equal(d.querySelectorAll('[data-shade-file]').length,4);assert.equal(manager.read().entries[1].code,'TEST02');
 d.querySelector('[data-shade-row="tone-2"] [data-shade-image]').value='javascript:alert(1)';assert.throws(()=>manager.read());manager.select(catalog.find(p=>p.id==='TS0098'));assert.equal(d.querySelector('.shade-admin-panel').hidden,true);
});
async function openStore(t,{products=catalog,hash='#/product/TS0313'}={}){
 const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(read('public/index.html'),{url:'https://trend.test/'+hash,pretendToBeVisual:true,runScripts:'outside-only',virtualConsole:vc});t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const sent=[];w.fetch=async(u,options)=>{const path=String(u).split('?')[0];if(options?.method==='POST')sent.push({path,options});return {ok:true,json:async()=>path==='/api/catalog'?{products,storeLive:false,promotions:[]}:path==='/shade-references.json'?references:path==='/catalog-thumbnails.json'?json('public/catalog-thumbnails.json'):path==='/product-galleries.json'?json('public/product-galleries.json'):{}}};
 w.eval(storefrontBundle);for(let i=0;i<80&&!d.querySelector('.detail-content');i++)await pause();assert.ok(d.querySelector('.detail-content'));assert.deepEqual(errors,[]);return {w,d,sent};
}
test('Product shade photo updates gallery and zoom, choice persists in the bag, and broken photos fall back',async t=>{
 const p=catalog.find(p=>p.id==='TS0313'),photo='/images/shades/huda-easy-bake-official-shade-guide.webp',products=catalog.map(x=>x.id===p.id?{...x,details:{...x.details,shadeGuide:{entries:[{id:'tone-2',code:'TEST-N2',image:photo}]}}}:x),{w,d,sent}=await openStore(t,{products});
 const field=d.querySelector('[data-select-option][value="tone-2"]');field.checked=true;field.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelector('#storyMainImage').getAttribute('src'),photo);d.querySelector('[data-story-add]').click();assert.equal(JSON.parse(w.localStorage.getItem('trend-shop-cart-v1'))[0].variant,'tone-2');
 d.querySelector('#storyMainImage').dispatchEvent(new w.Event('error'));assert.notEqual(d.querySelector('#storyMainImage').getAttribute('src'),photo);assert.equal(sent.length,0);
});
test('Accordions preserve content and jump links open target; favorites and visits appear in their customer pages',async t=>{
 const {w,d}=await openStore(t);for(const id of ['storyTexture','storyFit','storyHow']){const section=d.querySelector('#'+id);assert.ok(section.querySelector('details'));assert.ok(section.querySelector('.product-detail-accordion-body').textContent.trim());}
 d.querySelector('[data-story-scroll="storyHow"]').click();assert.equal(d.querySelector('#storyHow details').open,true);
 d.querySelector('.detail-favorite').click();assert.equal(d.querySelector('.detail-favorite').getAttribute('aria-pressed'),'true');w.location.hash='#/saved';for(let i=0;i<60&&!d.querySelector('.saved-products');i++)await pause();assert.equal(d.querySelectorAll('.saved-products .product-card').length,1);
 w.location.hash='#/saved?view=recent';for(let i=0;i<60&&!d.querySelector('[data-clear-collection="recent"]');i++)await pause();assert.equal(d.querySelectorAll('.saved-products .product-card').length,1);d.querySelector('[data-clear-collection="recent"]').click();assert.ok(d.querySelector('.saved-empty'));
});
test('Product HTML keeps a stable-size initial hero, escaped metadata and a visible language control before script loads',()=>{
 const html=productPageHtml(read('public/index.html'),{...catalog.find(p=>p.id==='TS0151'),details:{nameAr:'اختبار <img onerror=x>'}});assert.match(html,/data-product-loading="TS0151"/);assert.match(html,/width="700" height="700" fetchpriority="high"/);assert.match(html,/اختبار &lt;img onerror=x&gt;/);assert.match(html,/id="languageToggle"/);assert.match(html,/commerce\.js\?v=5\.8\.0|commerce\.js\?v=5\.0\.0/);
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
test('Owner can save confirmed shade data; unsafe links are rejected before changing product or inventory',async t=>{
 const {env,db}=fixture(t),data={id:'TS9001',name:'Test Powder',brand:'Test',category:'المكياج',reference_price_fils:5000,price_fils:5000,stock:8,discount_percent:0,image_url:'/images/TS0001.svg',approved:true,active:true,details:{productType:'powder',shadeGuide:{entries:[{id:'tone-1',code:'TEST01',image:'/images/TS0001.svg'}]}}},cookie='ts_admin='+await _test.makeSession(env);
 const send=body=>worker.fetch(new Request('https://trend.test/api/admin/products',{method:'POST',headers:{cookie,origin:'https://trend.test','x-trend-admin':'1','content-type':'application/json'},body:JSON.stringify(body)}),env,{});
 assert.equal((await send(data)).status,200);assert.equal(JSON.parse(db.prepare('SELECT details_json FROM products').get().details_json).shadeGuide.entries[0].code,'TEST01');const before=db.prepare('SELECT * FROM products').get();assert.equal((await send({...data,details:{...data.details,shadeGuide:{entries:[{id:'tone-1',image:'javascript:alert(1)'}]}}})).status,400);assert.deepEqual(db.prepare('SELECT * FROM products').get(),before);
});
test('Only a persisted order records a server success, and retrying the same order key preserves stock and metrics',async t=>{
 const {db,env}=fixture(t);db.prepare('INSERT INTO products(id,name,brand,category,reference_price_fils,price_fils,stock,approved,active) VALUES(?,?,?,?,?,?,?,?,?)').run('TS9001','Test product','Test','البشرة',5000,5000,8,1,1);
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({ok:true,ownerSent:true}),{headers:{'content-type':'application/json'}}));const pending=[],ctx={waitUntil:p=>pending.push(p)},data={name:'اسم اختبار',phone:'0791234567',governorate:'عمّان',address:'العبدلي',payment:'cod',items:[{id:'TS9001',qty:1}],experienceSession:'anonymous-checkout-session-12345',experienceDevice:'mobile'};
 const send=()=>worker.fetch(new Request('https://trend.test/api/orders',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-idempotency-key':'order-experience-test-12345'},body:JSON.stringify(data)}),env,ctx);
 assert.equal((await send()).status,201);await Promise.all(pending);assert.equal((await send()).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.equal(db.prepare('SELECT stock FROM products').get().stock,7);assert.equal(db.prepare("SELECT amount FROM experience_counts WHERE metric='order_success'").get().amount,1);
});
