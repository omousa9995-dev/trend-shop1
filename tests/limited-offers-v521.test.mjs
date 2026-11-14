import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
import worker,{_test} from '../src/worker.js';
import {applyLimitedOffers,countdown,limitedOffersHtml} from '../public/limited-offers.js';
import {jordanTime,jordanEpoch} from '../public/limited-offers-admin.js';
import {quoteCart} from '../public/commerce.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec(read('db/schema.sql'));
 const stmt=(q,args=[])=>({bind:(...v)=>stmt(q,v),all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args)||null,run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}}),execute:()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})});
 const DB={prepare:q=>stmt(q),batch:async rows=>{sql.exec('BEGIN');try{const out=rows.map(r=>r.execute());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 for(const id of ['TS9001','TS9002','TS9003'])sql.prepare("INSERT INTO products(id,brand,name,category,subcategory,price_fils,reference_price_fils,stock,active,approved,details_json) VALUES(?,'Fixture','Gentle fixture cleanser','البشرة','غسول',12000,15000,5,1,1,'{\"productType\":\"cleanser\",\"nameAr\":\"غسول اختبار\"}')").run(id);
 const env={DB,SESSION_SECRET:'local-test-secret-for-limited-offers-123456789',ADMIN_PASSWORD_HASH:'test-only',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://example.test',MAIL_WEBHOOK_TOKEN:'test-only-not-a-real-token-longer-than-32'};
 const api=async(path,body,headers={})=>worker.fetch(new Request('https://trend.test/api/'+path,{method:body?'POST':'GET',headers:{cookie:'ts_admin='+await _test.makeSession(env),...(body?{'content-type':'application/json',origin:'https://trend.test','x-trend-admin':'1'}:{}),...headers},body:body?JSON.stringify(body):undefined}),env,{});
 const offer=(overrides={})=>({slot:1,revision:0,requestId:crypto.randomUUID(),productId:'TS9001',priceFils:8010,startsAt:Math.floor(Date.now()/1000)-60,endsAt:Math.floor(Date.now()/1000)+3600,active:true,...overrides});
 return {sql,env,api,offer};
}
test('A scheduled price is exact everywhere, expires without overwriting the regular price, and never stacks with itself',()=>{
 const now=Date.UTC(2026,10,15),p={id:'TS9001',price_fils:12000,reference_price_fils:15000,discount_percent:20,stock:4,approved:1,active:1},o={slot:1,productId:p.id,priceFils:8010,startsAt:now/1000+60,endsAt:now/1000+120,active:true};
 assert.equal(applyLimitedOffers([p],[o],now)[0].price_fils,12000);
 const live=applyLimitedOffers([p],[o],now+60000);assert.equal(live[0].price_fils,8010);assert.equal(live[0].reference_price_fils,12000);assert.equal(quoteCart([{id:p.id,qty:1}],live).subtotalFils,8010);
 assert.deepEqual(applyLimitedOffers(live,[o],now+61000),live);const end=applyLimitedOffers(live,[o],now+120000)[0];assert.equal(end.price_fils,12000);assert.equal(end.reference_price_fils,15000);assert.equal(end.discount_percent,20);assert.equal(end.limitedOffer,undefined);assert.equal(p.price_fils,12000);
 assert.deepEqual(countdown(o.endsAt,now+60000),{days:0,time:'00:01:00',expired:false});assert.equal(countdown(o.endsAt,now+120000).expired,true);
 assert.equal(limitedOffersHtml([p]),'');const html=limitedOffersHtml(live,{now:now+60000});assert.match(html,/عروض لفترة محدودة جدًا/);assert.match(html,/8\.01/);assert.match(html,/12\.00/);assert.equal((html.match(/class="limited-card"/g)||[]).length,1);
});
test('Jordan date/time values round-trip independent of browser timezone',()=>{
 for(const value of ['2026-11-15T01:15','2027-07-01T19:30'])assert.equal(jordanTime(jordanEpoch(value)),value);assert.equal(jordanEpoch('2026-11-15T01:15'),Date.parse('2026-11-14T22:15:00Z')/1000);assert.ok(Number.isNaN(jordanEpoch('2026-02-30T10:00')));
});
test('The admin publishes existing products to exactly three slots; catalog and stock trigger enforce the live price',async t=>{
 const f=fixture(t),body=f.offer();const before=f.sql.prepare("SELECT * FROM products WHERE id='TS9001'").get();assert.equal((await f.api('admin/limited-offers',body)).status,200);
 assert.deepEqual(f.sql.prepare("SELECT * FROM products WHERE id='TS9001'").get(),before);
 const catalog=await(await f.api('catalog')).json();assert.equal(catalog.products.find(p=>p.id==='TS9001').price_fils,8010);assert.equal(catalog.limitedOffers.length,1);
 f.sql.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils) VALUES('LOCAL','test-local-offer','Fixture','0790000000','عمّان','Fixture','cod',8010)");
 assert.throws(()=>f.sql.exec("INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('LOCAL','TS9001','fixture',1,12000)"),/PRICE_CHANGED/);
 f.sql.exec("INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('LOCAL','TS9001','fixture',1,8010)");assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS9001'").get().stock,4);
 f.sql.prepare('UPDATE limited_offers SET ends_at=?').run(Math.floor(Date.now()/1000)-1);
 f.sql.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils) VALUES('LOCAL2','test-local-offer2','Fixture','0790000000','عمّان','Fixture','cod',12000)");
 assert.throws(()=>f.sql.exec("INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('LOCAL2','TS9001','fixture',1,8010)"),/PRICE_CHANGED/);
 assert.equal((await(await f.api('catalog')).json()).products.find(p=>p.id==='TS9001').price_fils,12000);
 assert.equal((await f.api('admin/limited-offers',f.offer({slot:4}))).status,400);
});
test('Creating a product and its timed card is atomic, idempotent and preserves later owner edits',async t=>{
 const f=fixture(t),body=f.offer({productId:undefined,product:{name:'New toner',nameAr:'تونر جديد',brand:'Medicube',category:'البشرة',productType:'toner',regularPriceFils:9990,stock:8,image:'/images/catalog/TS0362-1afccabe3904.webp',description:'وصف المنتج',koreanCare:true},priceFils:6490});
 const saved=await(await f.api('admin/limited-offers',body)).json();assert.equal(saved.ok,true);assert.equal(saved.createdProduct,true);
 const p=f.sql.prepare('SELECT * FROM products WHERE id=?').get(saved.productId);assert.equal(p.category,'البشرة');assert.equal(JSON.parse(p.details_json).collection,'k-beauty');assert.equal(p.price_fils,9990);assert.equal(p.stock,8);assert.equal(p.approved,1);
 assert.equal((await(await f.api('catalog')).json()).products.find(row=>row.id===p.id).price_fils,6490);
 f.sql.prepare('UPDATE products SET stock=3 WHERE id=?').run(p.id);const again=await(await f.api('admin/limited-offers',body)).json();assert.equal(again.duplicate,true);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM products').get().n,4);assert.equal(f.sql.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,3);
 const stale={...body,requestId:crypto.randomUUID()};assert.equal((await f.api('admin/limited-offers',stale)).status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM products').get().n,4);
});
test('Rejected campaigns, conflicting slots and stopping never change stock, ordinary prices or historical orders',async t=>{
 const f=fixture(t),first=f.offer();await f.api('admin/limited-offers',first);
 for(const change of [{priceFils:12000},{priceFils:499},{endsAt:1},{productId:'TSMISSING'},{slot:2}])assert.ok((await f.api('admin/limited-offers',f.offer(change))).status>=400);
 const old=f.sql.prepare('SELECT * FROM products ORDER BY id').all();const stopped=await f.api('admin/limited-offers',{action:'stop',slot:1,revision:1,requestId:crypto.randomUUID()});assert.equal(stopped.status,200);
 assert.deepEqual(f.sql.prepare('SELECT * FROM products ORDER BY id').all(),old);assert.equal((await(await f.api('catalog')).json()).products[0].price_fils,12000);
 const request=new Request('https://trend.test/api/admin/limited-offers');assert.equal((await worker.fetch(request,f.env,{})).status,401);
 assert.equal((await f.api('admin/limited-offers',f.offer(),{origin:'https://other.test'})).status,403);
 f.sql.exec(read('db/migrations/0033_limited_offers.sql'));assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM limited_offers').get().n,1);assert.deepEqual(f.sql.prepare('SELECT * FROM products ORDER BY id').all(),old);
});
test('A racing slot edit cannot leave a newly created product without its campaign',async t=>{
 const f=fixture(t),batch=f.env.DB.batch;let raced=false;
 f.env.DB.batch=async rows=>{if(!raced){raced=true;const now=Math.floor(Date.now()/1000);f.sql.prepare("INSERT INTO limited_offers(slot,product_id,price_fils,starts_at,ends_at,request_id) VALUES(1,'TS9002',7000,?,?,?)").run(now-10,now+3600,'other-request');}return batch(rows)};
 const r=await f.api('admin/limited-offers',f.offer({productId:undefined,product:{name:'Racing toner',nameAr:'تونر اختبار',brand:'Fixture',category:'البشرة',productType:'toner',regularPriceFils:9990,stock:3,image:'/images/catalog/TS0362-1afccabe3904.webp'},priceFils:6490}));
 assert.equal(r.status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM products').get().n,3);assert.equal(f.sql.prepare('SELECT product_id FROM limited_offers WHERE slot=1').get().product_id,'TS9002');
});
test('The dedicated admin UI renders three slots and submits exact price, Jordan times and new-product classification',async t=>{
 const bundle=buildSync({entryPoints:[new URL('../public/limited-offers-admin.js',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'Manager',logLevel:'silent'}).outputFiles[0].text;
 const dom=new JSDOM('<section id="limitedSection"></section>',{url:'https://trend.test',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window;w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(bundle);const calls=[];
 const products=[{id:'TS9001',name:'Existing cleanser',brand:'Fixture',category:'البشرة',price_fils:9990,stock:5,approved:1,active:1,details_json:'{}'}];
 const manager=w.Manager.createLimitedOfferManager({getProducts:()=>products,refreshProducts:async()=>{},call:async(path,method,body)=>{if(body){calls.push(JSON.parse(JSON.stringify(body)));return {ok:true,createdProduct:!!body.product}}return {offers:[]}}});await manager.load();assert.equal(w.document.querySelectorAll('.limited-admin-slot').length,3);
 w.document.querySelector('[data-limited-edit="1"]').click();const form=w.document.querySelector('form'),f=form.elements;f.price.value='6.49';f.startsAt.value='2027-01-01T19:00';f.endsAt.value='2027-01-02T15:00';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));
 assert.equal(calls[0].productId,'TS9001');assert.equal(calls[0].priceFils,6490);assert.equal(calls[0].endsAt,Date.parse('2027-01-02T12:00Z')/1000);
 w.document.querySelector('[data-limited-edit="2"]').click();w.document.querySelector('[name="mode"][value="new"]').click();assert.equal(w.document.querySelector('[data-limited-new]').hidden,false);f.name.value='New rice toner';f.nameAr.value='تونر أرز جديد';f.brand.value='Medicube';f.category.value='البشرة';f.category.dispatchEvent(new w.Event('change'));f.productType.value='toner';f.regularPrice.value='9.99';f.price.value='6.49';f.stock.value='7';f.image.value='/images/catalog/TS0362-1afccabe3904.webp';f.koreanCare.checked=true;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));
 assert.equal(calls[1].slot,2);assert.equal(calls[1].product.productType,'toner');assert.equal(calls[1].product.stock,7);assert.equal(calls[1].product.regularPriceFils,9990);assert.equal(calls[1].product.koreanCare,true);
});
