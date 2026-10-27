import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker,{_test} from '../src/worker.js';

const root=new URL('../',import.meta.url);
function file(f){return fs.readFileSync(new URL(f,root),'utf8')}
function mockDB(){
 const sql=new DatabaseSync(':memory:');sql.exec(file('db/schema.sql'));
 const wrap=(query,params=[])=>({
   bind(...x){return wrap(query,x)},
   async all(){return {results:sql.prepare(query).all(...params)}},
   async first(){return sql.prepare(query).get(...params)||null},
   async run(){return sql.prepare(query).run(...params)},
   _run(){return sql.prepare(query).run(...params)}
 });
 return {prepare(q){return wrap(q)},async batch(list){sql.exec('BEGIN');try{const r=list.map(q=>q._run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}},sql};
}
const password='safe-unique-long-password-2026',salt=randomBytes(16),hash=`pbkdf2_sha256$100000$${salt.toString('base64url')}$${pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url')}`;
function fixture(){const DB=mockDB();DB.sql.prepare(`INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,discount_percent,image_url,stock,approved,active) VALUES ('TS0001','TEST','Tester','البشرة',10000,8000,20,'/images/TS0001.svg',1,1,1)`).run();
 const env={DB,SESSION_SECRET:'some-long-test-crypto-secret-that-should-never-ship',ADMIN_PASSWORD_HASH:hash,STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://mail.example.invalid',MAIL_WEBHOOK_TOKEN:'test-random-mail-token-longer-than-32-bytes'};
 const pending=[];const ctx={waitUntil(p){pending.push(p)}};
 return {DB,env,ctx,pending}
}
async function api(url,env,ctx,body,headers={}){const opts={method:body?'POST':'GET',headers:{...headers}};if(body){opts.headers['content-type']='application/json';opts.headers.origin='https://trend.test';opts.body=JSON.stringify(body)}return await worker.fetch(new Request('https://trend.test'+url,opts),env,ctx)}
const cart={name:'سارة أحمد',phone:'0791234567',email:'sara@example.com',governorate:'عمّان',address:'شارع الجامعة، عمارة 25، الطابق الثاني',payment:'cod',items:[{id:'TS0001',qty:1}]};

test('Delivery is server-calculated after discounts, strictly above 19 JOD, saved and replayed unchanged',async()=>{
 const originalFetch=globalThis.fetch;let mailed;
 globalThis.fetch=async(_,options)=>{mailed=JSON.parse(options.body).order;return Response.json({ok:true,ownerSent:true})};
 try{for(const [subtotal,expected] of [[18999,1000],[19000,1000],[19001,0],[20000,0]]){
  const f=fixture();f.DB.sql.prepare('UPDATE products SET price_fils=?,stock=3').run(subtotal);
  const key='delivery-boundary-'+subtotal;
  const payload={...cart,email:'',address:'العبدلي',expectedSubtotalFils:subtotal,shippingFeeFils:999999,items:[{id:'TS0001',qty:1}]};
  const response=await api('/api/orders',f.env,f.ctx,payload,{'x-idempotency-key':key});
  assert.equal(response.status,201,await response.clone().text());assert.equal((await response.json()).shippingFeeFils,expected);
  const saved=f.DB.sql.prepare('SELECT * FROM orders').get();assert.equal(saved.shipping_fee_fils,expected);assert.equal(saved.email,null);
  await Promise.all(f.pending);assert.equal(mailed.shipping_fee_fils,expected);assert.equal(mailed.subtotal_fils,subtotal);assert.match(mailed.notes,expected===0?/التوصيل: مجاني/:/1\.00 دينار/);
  f.DB.sql.prepare('UPDATE products SET price_fils=500').run();
  const repeated=await api('/api/orders',f.env,f.ctx,payload,{'x-idempotency-key':key});const data=await repeated.json();
  assert.equal(data.duplicate,true);assert.equal(data.subtotalFils,subtotal);assert.equal(data.shippingFeeFils,expected);assert.equal(f.DB.sql.prepare('SELECT stock FROM products').get().stock,2);
 }}finally{globalThis.fetch=originalFetch}
});
test('A stale cart cannot silently confirm a changed price or debit stock',async()=>{
 const f=fixture();const response=await api('/api/orders',f.env,f.ctx,{...cart,expectedSubtotalFils:100}, {'x-idempotency-key':'stale-price-test-20261026'});
 assert.equal(response.status,409);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(f.DB.sql.prepare('SELECT stock FROM products').get().stock,1);
});

test('Order notifications explicitly record successful owner and customer confirmations',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,ownerSent:true,customerSent:true});
 try{assert.equal((await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':'mail-both-20261025'})).status,201);await Promise.all(f.pending);assert.equal(f.DB.sql.prepare('SELECT notification_status FROM orders').get().notification_status,'تم الإرسال للمتجر والزبونة');}finally{globalThis.fetch=originalFetch;}
});

test('A customer confirmation failure is visible without losing the saved order or its owner notice',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,ownerSent:true,customerSent:false,customerError:'customer_quota_exhausted'});
 try{assert.equal((await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':'mail-partial-20261025'})).status,201);await Promise.all(f.pending);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.equal(f.DB.sql.prepare('SELECT notification_status FROM orders').get().notification_status,'تم الإرسال للمتجر؛ تعذر إشعار الزبونة');}finally{globalThis.fetch=originalFetch;}
});

test('The order notification cannot report success when its owner notice was explicitly refused',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,ownerSent:false,customerSent:true});
 try{assert.equal((await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':'mail-owner-failed-20261025'})).status,201);await Promise.all(f.pending);assert.equal(f.DB.sql.prepare('SELECT notification_status FROM orders').get().notification_status,'فشل الإرسال');}finally{globalThis.fetch=originalFetch;}
});

test('Mail health is available before owner activation and fails closed when mail is unconfigured',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;delete f.env.MAIL_WEBHOOK_TOKEN;delete f.env.ADMIN_PASSWORD_HASH;f.env.STORE_LIVE='false';
 globalThis.fetch=async()=>{throw Error('must not contact an unconfigured endpoint')};
 try{const response=await api('/api/mail-health',f.env,f.ctx);assert.equal(response.status,503);const data=await response.json();assert.equal(data.configured,false);assert.equal(data.reachable,false);assert.equal(data.canSend,false);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);}finally{globalThis.fetch=originalFetch;}
});

test('Mail health authenticates a read-only upstream check, caches success, and invalidates cache on token changes',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;f.env.STORE_LIVE='false';delete f.env.ADMIN_PASSWORD_HASH;const cache=new Map();let calls=0;
 f.env.MEDIA={async get(key){return cache.has(key)?JSON.parse(cache.get(key)):null},async put(key,value,options){assert.equal(options.expirationTtl,300);cache.set(key,value)}};
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,f.env.MAIL_WEBHOOK_URL);assert.deepEqual(JSON.parse(options.body),{token:f.env.MAIL_WEBHOOK_TOKEN,action:'health'});assert.ok(options.signal);return Response.json({ok:true,service:'trend-shop-mail',ownerEmail:calls===1?'stpostpo470@gmail.com':'wrong@example.org',remainingRecipients:99,extra:f.env.MAIL_WEBHOOK_TOKEN});};
 try{
  const first=await api('/api/mail-health',f.env,f.ctx);assert.equal(first.status,200);const data=await first.json();assert.equal(data.canSend,true);assert.equal(data.reachable,true);assert.deepEqual(Object.keys(data).sort(),['canSend','checkedAt','configured','reachable']);assert.ok(!JSON.stringify(data).includes(f.env.MAIL_WEBHOOK_TOKEN));
  assert.equal((await api('/api/mail-health',f.env,f.ctx)).status,200);assert.equal(calls,1);
  f.env.MAIL_WEBHOOK_TOKEN+='rotated';assert.equal((await api('/api/mail-health',f.env,f.ctx)).status,503);assert.equal(calls,2);
  assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 }finally{globalThis.fetch=originalFetch;}
});

test('Mail health reports exhausted quota and upstream failures without exposing credentials or sending mail',async()=>{
 const originalFetch=globalThis.fetch;
 try{for(const mode of ['quota','http','network']){const f=fixture();globalThis.fetch=async()=>{if(mode==='network')throw Error(f.env.MAIL_WEBHOOK_TOKEN);return Response.json({ok:true,service:'trend-shop-mail',ownerEmail:'stpostpo470@gmail.com',remainingRecipients:0,token:f.env.MAIL_WEBHOOK_TOKEN},{status:mode==='http'?500:200});};const response=await api('/api/mail-health',f.env,f.ctx);assert.equal(response.status,503);const data=await response.json();assert.equal(data.canSend,false);assert.equal(data.reachable,mode==='quota');assert.ok(!JSON.stringify(data).includes(f.env.MAIL_WEBHOOK_TOKEN));assert.ok(!JSON.stringify(data).includes(f.env.MAIL_WEBHOOK_URL));assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);}}
 finally{globalThis.fetch=originalFetch;}
});

test('Checkout accepts an omitted email, persists the order, and still notifies the store',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;let notification;
 globalThis.fetch=async(_url,options)=>{notification=JSON.parse(options.body);return new Response('{"ok":true}',{status:200})};
 try{
  const body={...cart};delete body.email;
  const response=await api('/api/orders',f.env,f.ctx,body,{'x-idempotency-key':'optional-email-checkout-123456'});
  assert.equal(response.status,201,await response.text());
  assert.equal(f.DB.sql.prepare('SELECT email FROM orders').get().email,null);
  await Promise.all(f.pending);assert.equal(notification.storeEmail,'stpostpo470@gmail.com');assert.equal(notification.order.email,'');
  assert.equal(f.DB.sql.prepare('SELECT count(*) AS n FROM orders').get().n,1);
 }finally{globalThis.fetch=originalFetch}
});

test('A one-word neighborhood and governorate are enough for COD and manual CliQ orders',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,ownerSent:true});
 try{for(const [address,payment] of [['الياسمين','cod'],['حي','cliq']]){
  const f=fixture();const response=await api('/api/orders',f.env,f.ctx,{...cart,email:'',address:'  '+address+'  ',payment,cliqAlias:'TEST-ALIAS'},{'x-idempotency-key':'short-address-'+payment+'-123456'});
  assert.equal(response.status,201,await response.text());
  const stored=f.DB.sql.prepare('SELECT address,governorate,email,payment_method FROM orders').get();
  assert.equal(stored.address,address);assert.equal(stored.governorate,'عمّان');assert.equal(stored.email,null);assert.equal(stored.payment_method,payment);
  await Promise.all(f.pending);assert.equal(f.DB.sql.prepare('SELECT notification_status FROM orders').get().notification_status,'تم الإرسال');
 }}finally{globalThis.fetch=originalFetch}
});
test('An empty or punctuation-only address still cannot create an undeliverable order',async()=>{
 for(const address of ['', '   ', '---', '\u200b']){
  const f=fixture();const response=await api('/api/orders',f.env,f.ctx,{...cart,address},{'x-idempotency-key':'empty-address-rejected-123456'});
  assert.equal(response.status,400);assert.equal(f.DB.sql.prepare('SELECT count(*) AS n FROM orders').get().n,0);
 }
});
test('Checkout still rejects an invalid nonempty email without saving an order',async()=>{
 const f=fixture();const response=await api('/api/orders',f.env,f.ctx,{...cart,email:'not-an-email'},{'x-idempotency-key':'invalid-optional-email-123456'});
 assert.equal(response.status,400);assert.equal(f.DB.sql.prepare('SELECT count(*) AS n FROM orders').get().n,0);
});

test('Admin saves an uploaded photo with individual Arabic details, then hides it without losing the content',async()=>{
 const f=fixture();const cookie='ts_admin='+await _test.makeSession(f.env);
 const image='/media/uploads/2026-10/01234567-89ab-4cde-8fab-0123456789ab.jpg';
 const details={nameAr:'كريم اختبار',tagline:'عناية خاصة',benefits:['ترطيب','نعومة','راحة'],howToUse:'على بشرة نظيفة',notes:'اختبار',collection:'k-beauty',featuredOrder:9,imageType:'photo',productType:'moisturizer',size:'30 ml',shade:'',variantNote:'تأكيد النسخة',introductoryOffer:true,intakeBatch:'2026-10-27',imageEditedWithAI:false,imageNote:''};
 const body={id:'TSPHOTO1',name:'Photo Product',brand:'TEST',category:'البشرة',subcategory:'مرطب',description:'وصف فردي للاختبار',reference_price_fils:10000,discount_percent:20,stock:0,approved:false,active:true,image_url:image,details};
 const headers={cookie,'x-trend-admin':'1'};
 const response=await api('/api/admin/products',f.env,f.ctx,body,headers);assert.equal(response.status,200,await response.text());
 const stored=f.DB.sql.prepare("SELECT * FROM products WHERE id='TSPHOTO1'").get();
 assert.equal(stored.image_url,image);assert.deepEqual(JSON.parse(stored.details_json),details);
 const hidden=await api('/api/admin/products',f.env,f.ctx,{...stored,active:false},headers);assert.equal(hidden.status,200);
 const after=f.DB.sql.prepare("SELECT * FROM products WHERE id='TSPHOTO1'").get();assert.equal(after.active,0);assert.deepEqual(JSON.parse(after.details_json),details);assert.equal(after.image_url,image);
});

test('Admin enforces the owner sale-price range including the exact 0.500 and 20.000 boundaries',async()=>{
 const f=fixture(),cookie='ts_admin='+await _test.makeSession(f.env),headers={cookie,'x-trend-admin':'1'};
 const product={id:'TSPRICECHECK',name:'Price Check',brand:'TEST',category:'البشرة',stock:24,approved:true,active:true,discount_percent:0};
 for(const reference_price_fils of [499,20001]){
  const response=await api('/api/admin/products',f.env,f.ctx,{...product,reference_price_fils},headers);assert.equal(response.status,400);
 }
 for(const reference_price_fils of [500,20000]){
  const response=await api('/api/admin/products',f.env,f.ctx,{...product,reference_price_fils},headers);assert.equal(response.status,200,await response.text());
  assert.equal(f.DB.sql.prepare("SELECT price_fils FROM products WHERE id='TSPRICECHECK'").get().price_fils,reference_price_fils);
 }
});

test('Admin can create and edit a tools product while preserving its type and variant information',async()=>{
 const f=fixture(),headers={cookie:'ts_admin='+await _test.makeSession(f.env),'x-trend-admin':'1'};
 const body={id:'TSTOOLTEST',name:'Foot file',brand:'Test',category:'الأدوات',subcategory:'العناية بالقدمين',description:'أداة قدمين للاختبار',reference_price_fils:3000,price_fils:1500,discount_percent:50,stock:24,approved:true,active:true,image_url:'/images/test.webp',details:{productType:'foot-tools',size:'1 piece',shade:'yellow',variantNote:'Test variant',introductoryOffer:true,imageEditedWithAI:true,imageNote:'صورة محسنة'}};
 const response=await api('/api/admin/products',f.env,f.ctx,body,headers);assert.equal(response.status,200,await response.text());const stored=f.DB.sql.prepare("SELECT * FROM products WHERE id='TSTOOLTEST'").get(),details=JSON.parse(stored.details_json);assert.equal(details.productType,'foot-tools');assert.equal(details.size,'1 piece');assert.equal(details.variantNote,'Test variant');assert.equal(details.introductoryOffer,true);assert.equal(details.imageEditedWithAI,true);
});

test('The curated catalog preserves auditable reference prices and uses reviewed product photos',()=>{
 const c=JSON.parse(file('public/catalog.json'));
 assert.equal(c.length,258);assert.equal(new Set(c.map(p=>p.id)).size,c.length);
 const shops=new Set(c.map(p=>p.source));assert.ok(shops.has('LeoMarka'));assert.ok([...shops].some(s=>s.includes('Ksecret')));
 for(const p of c){assert.ok(p.name&&p.brand&&p.source_url);assert.match(p.image,/^\/images\/catalog\//);assert.ok(fs.existsSync(new URL('public'+p.image,root)));assert.equal(p.discount,Math.floor((p.reference-p.priceFils)*100/p.reference+1e-8));assert.equal(p.approved,true);assert.equal(p.stock,24)}
 assert.ok(fs.existsSync(new URL('public/images/hero.webp',root)));
});
test('No actual sensitive customer data or forbidden card processors are bundled',()=>{
 const publicFiles=['public/index.html','public/app.js','public/admin.html'];
 for(const f of publicFiles){const s=file(f);assert.doesNotMatch(s,/(stripe\.com|paypal\.com|checkout\.com|paytabs|credit-card-number|card-number)/i)}
 assert.doesNotMatch(file('src/worker.js'),/12345678/);
});
test('Session verification rejects tampered sessions and wrong password',async()=>{
 const {env}=fixture();assert.equal(await _test.digestPassword(password,hash),true);assert.equal(await _test.digestPassword('12345678',hash),false);
 const token=await _test.makeSession(env);
 assert.equal(await _test.checkSession(new Request('https://trend.test/',{headers:{cookie:'ts_admin='+token}}),env),true);
 assert.equal(await _test.checkSession(new Request('https://trend.test/',{headers:{cookie:'ts_admin='+token+'altered'}}),env),false);
});
test('Real orders are blocked until all free-service and security secrets are configured',async()=>{
 const f=fixture();delete f.env.MAIL_WEBHOOK_TOKEN;assert.equal(_test.isProductionConfigured(f.env),false);
 const r=await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':'any-unique-value-123456'});assert.equal(r.status,503);
});
test('An order is server-priced, atomic, idempotent, and prevents overselling',async()=>{
 const f=fixture();const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}});
 try{
  const key='test-valid-idempotency-key-12345';const r=await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':key});assert.equal(r.status,201,await r.text().catch(()=>''));
  // Body must be read once; get order ID from DB.
  const first=f.DB.sql.prepare('select * from orders').all();assert.equal(first.length,1);assert.equal(first[0].subtotal_fils,8000);
  assert.equal(f.DB.sql.prepare("select stock from products where id='TS0001'").get().stock,0);
  assert.equal(f.DB.sql.prepare('select count(*) as n from order_items').get().n,1);
  const dup=await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':key});assert.equal(dup.status,200);assert.equal((await dup.json()).duplicate,true);
  assert.equal(f.DB.sql.prepare('select count(*) as n from orders').get().n,1);
  const r2=await api('/api/orders',f.env,f.ctx,cart,{'x-idempotency-key':'another-idempotency-key-12345'});assert.equal(r2.status,409);
  assert.equal(f.DB.sql.prepare('select count(*) as n from orders').get().n,1);
  await Promise.all(f.pending);
  assert.equal(f.DB.sql.prepare('select notification_status from orders').get().notification_status,'تم الإرسال');
 }finally{globalThis.fetch=originalFetch}
});
test('Database trigger refuses invalid prices and rolls back the order entirely',async()=>{
 const f=fixture();const sql=f.DB.sql;assert.throws(()=>{
  sql.exec('BEGIN');try{
   sql.prepare("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils) VALUES ('TR-1','KEY-1','Sara','0791234567','عمّان','Amman','cod',0)").run();
   sql.prepare("INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES ('TR-1','TS0001','Test',1,10)").run();sql.exec('COMMIT')
  }catch(e){sql.exec('ROLLBACK');throw e}
 });assert.equal(sql.prepare('select count(*) as n from orders').get().n,0);assert.equal(sql.prepare('select stock from products').get().stock,1)
});
test('Login is origin protected and admin orders are never readable without a signed cookie',async()=>{
 const f=fixture();const get=await api('/api/admin/orders',f.env,f.ctx);assert.equal(get.status,401);
 const evil=await worker.fetch(new Request('https://trend.test/api/admin/login',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({password})}),f.env,f.ctx);assert.equal(evil.status,403);
 const good=await api('/api/admin/login',f.env,f.ctx,{password});assert.equal(good.status,200);const cookie=good.headers.get('set-cookie').split(';')[0];assert.match(good.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const authed=await api('/api/admin/orders',f.env,f.ctx,null,{cookie});assert.equal(authed.status,200);
});
test('100 concurrent simulated distinct customers cannot corrupt order totals or inventory',async()=>{
 const f=fixture();f.DB.sql.prepare("UPDATE products SET stock=100 WHERE id='TS0001'").run();
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response('{"ok":true}',{status:200});
 try{
  const attempts=Array.from({length:100},(_,i)=>{
   const req={...cart,name:'زبونة '+(i+1),email:`customer${i}@example.com`};
   const headers={'x-idempotency-key':'customer-load-test-'+String(i).padStart(6,'0'), 'cf-connecting-ip':'203.0.113.'+i};
   return api('/api/orders',f.env,f.ctx,req,headers);
  });
  const responses=await Promise.all(attempts);
  assert.equal(responses.filter(r=>r.status===201).length,100,JSON.stringify(responses.map(x=>x.status)));
  assert.equal(f.DB.sql.prepare('select count(*) as count from orders').get().count,100);
  assert.equal(f.DB.sql.prepare('select stock from products').get().stock,0);
  assert.equal(f.DB.sql.prepare('select sum(subtotal_fils) as total from orders').get().total,800000);
  await Promise.all(f.pending);
 } finally {globalThis.fetch=originalFetch}
});

test('Admin offers and bulk discounts require a signed session and same-origin writes',async()=>{
 const f=fixture();
 assert.equal((await api('/api/admin/promotions',f.env,f.ctx)).status,401);
 assert.equal((await api('/api/admin/discounts',f.env,f.ctx,{ids:['TS0001'],percent:25})).status,401);
 const cookie='ts_admin='+await _test.makeSession(f.env);
 const bad=new Request('https://trend.test/api/admin/promotions',{method:'POST',headers:{cookie,origin:'https://evil.test','x-trend-admin':'1','content-type':'application/json'},body:JSON.stringify({})});
 assert.equal((await worker.fetch(bad,f.env,f.ctx)).status,403);
});
test('An admin can create, edit, and deactivate a real combo without changing product inventory',async()=>{
 const f=fixture(),cookie='ts_admin='+await _test.makeSession(f.env),headers={cookie,'x-trend-admin':'1'};
 f.DB.sql.exec("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES ('TS0002','TEST','Mascara','المكياج',2000,2000,5,1,1)");
 const combo={kind:'combo',title:'إطلالة متكاملة',description:'منتجان معًا',items:[{id:'TS0001',qty:1},{id:'TS0002',qty:1}],priceFils:8990,active:true};
 const response=await api('/api/admin/promotions',f.env,f.ctx,combo,headers);assert.equal(response.status,200,await response.clone().text());const {id}=await response.json();
 const catalog=await (await api('/api/catalog',f.env,f.ctx)).json();assert.equal(catalog.promotions[0].id,id);assert.equal(catalog.promotions[0].priceFils,8990);
 assert.equal(f.DB.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,1);
 assert.equal((await api('/api/admin/promotions',f.env,f.ctx,{...combo,id,title:'اسم جديد',priceFils:8490},headers)).status,200);
 assert.equal((await api('/api/admin/promotions',f.env,f.ctx,{action:'toggle',id,active:false},headers)).status,200);
 assert.equal((await (await api('/api/catalog',f.env,f.ctx)).json()).promotions.length,0);
 const all=await (await api('/api/admin/promotions',f.env,f.ctx,null,{cookie})).json();assert.equal(all.promotions[0].active,false);
});
test('Combo checkout stores the discount and final delivery, debits original products once and ignores forged totals',async()=>{
 const f=fixture(),originalFetch=globalThis.fetch;let mailed;globalThis.fetch=async(_,options)=>{mailed=JSON.parse(options.body).order;return Response.json({ok:true,ownerSent:true})};
 f.DB.sql.exec("UPDATE products SET stock=3;INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES ('TS0002','TEST','Mascara','المكياج',2000,2000,5,1,1);INSERT INTO promotions(id,kind,title,config_json,active) VALUES ('PROMOTEST001','combo','إطلالة','{\"items\":[{\"id\":\"TS0001\",\"qty\":1},{\"id\":\"TS0002\",\"qty\":1}],\"priceFils\":8990}',1)");
 try{
  const payload={...cart,email:'',address:'العبدلي',items:[{id:'TS0001',qty:1},{id:'TS0002',qty:1}],expectedSubtotalFils:8990,expectedTotalFils:9990,discountFils:99999,shippingFeeFils:0};
  const response=await api('/api/orders',f.env,f.ctx,payload,{'x-idempotency-key':'combo-order-integration-001'});assert.equal(response.status,201,await response.clone().text());const receipt=await response.json();assert.equal(receipt.totalFils,9990);assert.equal(receipt.discountFils,1010);assert.equal(receipt.shippingFeeFils,1000);
  const saved=f.DB.sql.prepare('SELECT * FROM orders').get();assert.equal(saved.subtotal_fils,8990);assert.equal(saved.discount_fils,1010);assert.equal(saved.shipping_fee_fils,1000);assert.equal(JSON.parse(saved.promotion_snapshot)[0].id,'PROMOTEST001');assert.equal(f.DB.sql.prepare('SELECT SUM(qty*unit_price_fils) value FROM order_items').get().value,10000);assert.equal(f.DB.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,2);
  await Promise.all(f.pending);assert.match(mailed.notes,/9\.99/);assert.match(mailed.notes,/1\.01/);
  f.DB.sql.exec('UPDATE promotions SET active=0');const replay=await api('/api/orders',f.env,f.ctx,payload,{'x-idempotency-key':'combo-order-integration-001'});const repeated=await replay.json();assert.equal(repeated.duplicate,true);assert.equal(repeated.totalFils,9990);assert.equal(repeated.discountFils,1010);assert.equal(f.DB.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
 }finally{globalThis.fetch=originalFetch}
});
test('Bulk discount pricing preserves stock and historical orders, and an ordinary edit preserves the explicit retail price',async()=>{
 const f=fixture(),cookie='ts_admin='+await _test.makeSession(f.env),headers={cookie,'x-trend-admin':'1'};
 const response=await api('/api/admin/discounts',f.env,f.ctx,{ids:['TS0001'],percent:25},headers);assert.equal(response.status,200,await response.clone().text());
 const p=f.DB.sql.prepare('SELECT * FROM products').get();assert.equal(p.stock,1);assert.equal(p.reference_price_fils,8000);assert.equal(p.price_fils,6000);
 assert.equal((await api('/api/admin/products',f.env,f.ctx,{...p,approved:true,active:true,description:'Updated only',price_fils:5990,discount_percent:25},headers)).status,200);
 assert.equal(f.DB.sql.prepare('SELECT price_fils FROM products').get().price_fils,5990);
 assert.equal((await api('/api/admin/promotions',f.env,f.ctx,{kind:'combo',title:'Bad combo',items:[{id:'TS0001',qty:1},{id:'TS0001',qty:1}],priceFils:500},headers)).status,400);
});

test('Bulk discounts work for more than 100 products without exceeding D1 bound-parameter limits',async()=>{
 const f=fixture(),cookie='ts_admin='+await _test.makeSession(f.env),ids=[];
 for(let i=0;i<150;i++){const id='TSBULK'+String(i).padStart(4,'0');ids.push(id);f.DB.sql.prepare("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES (?, 'TEST','Bulk product','البشرة',5000,5000,24,1,1)").run(id)}
 const prepare=f.DB.prepare;f.DB.prepare=function(sql){const statement=prepare(sql),bind=statement.bind;statement.bind=(...args)=>{assert.ok(args.length<=100,'D1 permits at most 100 bound parameters');return bind(...args)};return statement};
 const response=await api('/api/admin/discounts',f.env,f.ctx,{ids,percent:25},{cookie,'x-trend-admin':'1'});assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).updated,150);assert.equal(f.DB.sql.prepare("SELECT SUM(stock) n FROM products WHERE id LIKE 'TSBULK%'").get().n,3600);
});
