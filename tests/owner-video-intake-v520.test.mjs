import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker,{_test} from '../src/worker.js';
import {isKoreanCare} from '../public/korean-care.js';
import {productType} from '../public/product-types.js';
import {storyGallery} from '../public/product-story.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const products=JSON.parse(read('data/intake-2026-11-14/products.json'));
const migration=read('db/migrations/0032_owner_video_intake_2026_11_14.sql');
function fixture(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec(read('db/schema.sql'));
 sql.exec("INSERT INTO products(id,brand,name,category,price_fils,reference_price_fils,approved,active,stock) VALUES('TS0073','Medicube','Medicube - Collagen Night Wrapping Mask','البشرة',6990,13950,1,1,8)");
 sql.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils) VALUES('TEST-OLD','test-existing-order','Test fixture','0790000000','عمّان','Test fixture','cod',6990)");
 sql.exec("INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('TEST-OLD','TS0073','Existing snapshot',1,6990)");
 const statement=(q,args=[])=>({bind:(...values)=>statement(q,values),all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args)||null,run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})});
 const env={DB:{prepare:q=>statement(q)},SESSION_SECRET:'local-test-session-secret-for-intake-only-1234',ADMIN_PASSWORD_HASH:'test-only',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://example.test/mail',MAIL_WEBHOOK_TOKEN:'local-test-only-token-longer-than-32-characters'};
 return {sql,env};
}

test('Four distinct video products use bilingual Korean-care profiles and real, hash-verified pack photos',()=>{
 assert.deepEqual(products.map(p=>p.id),['TS0362','TS0363','TS0364','TS0365']);
 assert.deepEqual(products.map(p=>p.details.size),['140 ml','50 ml','80 ml','200 ml']);
 assert.deepEqual(products.map(productType),['toner','sunscreen','face-mask','toner']);
 for(const p of products){
  assert.equal(isKoreanCare(p),true);assert.ok(p.details.nameAr&&p.details.en.description&&p.details.howToUse&&p.details.en.howToUse);
  assert.equal(p.approved,false);assert.equal(p.active,0);assert.equal(p.stock,0);assert.equal(p.priceFils,0);assert.equal(p.reference,0);assert.equal(p.discount,0);
  assert.deepEqual(storyGallery(p,null).map(x=>x.url),p.galleryPhotos.map(x=>x.url));
 }
 assert.doesNotMatch(products[0].name,/4\.0/);assert.match(products[1].name,/PDRN Pink Tone Up/);assert.doesNotMatch(products[1].name,/Collagen Firming/);
 assert.equal(productType(products[3]),'toner','Peel Shot brand wording must not classify this toner as an exfoliant');
 for(const photo of JSON.parse(read('data/intake-2026-11-14/images.json'))){
  const bytes=readFileSync(new URL('../public'+photo.url,import.meta.url));
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);assert.equal(bytes.length,photo.bytes);assert.ok(bytes.length<65536);
 }
});

test('Repeated intake preserves sales, owner pricing, stock, galleries and the existing Medicube mask',t=>{
 const {sql}=fixture(t);const old=sql.prepare("SELECT * FROM products WHERE id='TS0073'").get(),orders=sql.prepare('SELECT * FROM orders').all(),lines=sql.prepare('SELECT * FROM order_items').all();
 sql.exec(migration);assert.equal(sql.prepare('SELECT COUNT(*) n FROM products').get().n,5);assert.equal(sql.prepare('SELECT COUNT(*) n FROM product_photo_galleries').get().n,4);
 sql.exec("UPDATE products SET price_fils=9990,reference_price_fils=9990,stock=5,approved=1,active=1,name='Owner edited name' WHERE id='TS0362'");
 sql.exec("UPDATE product_photo_galleries SET photos_json='[]',revision=2 WHERE product_id='TS0362'");
 const edited=sql.prepare("SELECT * FROM products WHERE id='TS0362'").get();sql.exec(migration);
 assert.deepEqual(sql.prepare("SELECT * FROM products WHERE id='TS0362'").get(),edited);assert.equal(sql.prepare("SELECT photos_json FROM product_photo_galleries WHERE product_id='TS0362'").get().photos_json,'[]');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM products').get().n,5);assert.deepEqual(sql.prepare("SELECT * FROM products WHERE id='TS0073'").get(),old);
 assert.deepEqual(sql.prepare('SELECT * FROM orders').all(),orders);assert.deepEqual(sql.prepare('SELECT * FROM order_items').all(),lines);assert.equal(sql.prepare('SELECT COUNT(*) n FROM reviews').get().n,0);
});

test('An ID collision and an existing identity under another ID cannot overwrite data or attach the wrong gallery',t=>{
 const {sql}=fixture(t);
 sql.exec("INSERT INTO products(id,brand,name,category,price_fils,reference_price_fils,stock) VALUES('TS0362','Other brand','Unrelated product','البشرة',5000,5000,9)");
 const p=products[1];sql.prepare("INSERT INTO products(id,brand,name,category,price_fils,reference_price_fils,stock) VALUES('TS9001',?,?,'البشرة',8000,8000,7)").run(p.brand,p.name);
 sql.exec(migration);
 assert.equal(sql.prepare("SELECT stock FROM products WHERE id='TS0362'").get().stock,9);assert.equal(sql.prepare("SELECT COUNT(*) n FROM product_photo_galleries WHERE product_id IN ('TS0362','TS0363','TS9001')").get().n,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM products WHERE id='TS0363'").get().n,0);assert.equal(sql.prepare("SELECT stock FROM products WHERE id='TS9001'").get().stock,7);
});

test('Drafts appear in admin, stay off the public catalog, and publish through the existing price/stock editor',async t=>{
 const {sql,env}=fixture(t);sql.exec(migration);const cookie='ts_admin='+await _test.makeSession(env);
 const get=path=>worker.fetch(new Request('https://trend.test'+path,{headers:{cookie}}),env,{});
 let catalog=await(await get('/api/catalog')).json();assert.equal(catalog.products.length,1);
 const admin=await(await get('/api/admin/products')).json();for(const p of products)assert.ok(admin.products.some(row=>row.id===p.id&&row.approved===0&&row.active===0));
 for(const p of products){
  assert.throws(()=>sql.prepare("INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('TEST-OLD',?,'Draft must not sell',1,0)").run(p.id),/OUT_OF_STOCK_OR_UNAPPROVED/);
 }
 const p=admin.products.find(x=>x.id==='TS0362');
 const response=await worker.fetch(new Request('https://trend.test/api/admin/products',{method:'POST',headers:{cookie,origin:'https://trend.test','x-trend-admin':'1','content-type':'application/json'},body:JSON.stringify({...p,reference_price_fils:9990,price_fils:9990,stock:8,approved:true,active:true})}),env,{});
 assert.equal(response.status,200);sql.exec(migration);catalog=await(await get('/api/catalog')).json();
 assert.deepEqual(catalog.products.map(p=>p.id),['TS0073','TS0362']);assert.equal(catalog.products[1].stock,8);assert.equal(catalog.products[1].price_fils,9990);
});
