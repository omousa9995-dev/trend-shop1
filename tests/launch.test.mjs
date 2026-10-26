import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {invoice} from '../public/invoice.js';
import {thumbnailFor} from '../public/commerce.js';
import worker,{_test} from '../src/worker.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Launch discounts use genuine old prices; repeat migration preserves sales, order snapshots and later edits',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));db.exec(read('db/seed.sql'));
 const before=db.prepare('SELECT * FROM products WHERE active=1').all();
 db.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils) VALUES ('TR-OLD','old-key','Test','0790000000','عمّان','العبدلي','cod',2950); INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES ('TR-OLD','TS0001','Snapshot',1,2950)");
 db.exec(read('db/migrations/0005_launch_sale.sql'));
 const offers=JSON.parse(read('data/launch-sale.json')).offers;
 const rates=new Set();
 for(const offer of offers){const old=before.find(p=>p.id===offer.id),now=db.prepare('SELECT * FROM products WHERE id=?').get(offer.id);assert.equal(offer.previous_price_fils,old.price_fils);assert.equal(now.reference_price_fils,old.price_fils);assert.equal(now.price_fils,old.price_fils*(100-now.discount_percent)/100);assert.ok(now.price_fils>=500);rates.add(now.discount_percent)}
 assert.ok([25,30,50].every(rate=>rates.has(rate)));
 assert.equal(db.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,23);
 assert.equal(db.prepare('SELECT unit_price_fils FROM order_items').get().unit_price_fils,2950);
 assert.equal(db.prepare('SELECT shipping_fee_fils FROM orders').get().shipping_fee_fils,null);
 db.exec("UPDATE products SET price_fils=2000,reference_price_fils=2000,discount_percent=0 WHERE id='TS0001'");db.exec(read('db/migrations/0005_launch_sale.sql'));
 assert.equal(db.prepare("SELECT price_fils FROM products WHERE id='TS0001'").get().price_fils,2000);
 assert.equal(db.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,23);
});
test('Existing orders gain a nullable delivery snapshot without changing their historical totals',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql').replace(/ shipping_fee_fils[^\n]+\n/,''));
 db.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils) VALUES ('TR-OLD','old-key','Test','0790000000','عمّان','العبدلي','cod',20000)");
 db.exec(read('db/migrations/0004_shipping_snapshot.sql'));const saved=db.prepare('SELECT * FROM orders').get();assert.equal(saved.subtotal_fils,20000);assert.equal(saved.shipping_fee_fils,null);
});
test('Invoices use الزبونة, escape text, and honor the saved delivery promise rather than repricing old orders',()=>{
 const order={id:'TR-TEST',created_at:'2026-10-26 00:00:00',name:'<script>alert(1)</script>',phone:'0790000000',address:'العبدلي',governorate:'عمّان',payment_method:'cod',status:'جديد',subtotal_fils:20000,shipping_fee_fils:0,items:[{name_snapshot:'Product',qty:2,unit_price_fils:10000}]};
 const html=invoice(order);assert.match(html,/معلومات الزبونة/);assert.doesNotMatch(html,/العميلة|<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/التوصيل: مجاني/);assert.match(html,/20\.00/);
 const legacy=invoice({...order,shipping_fee_fils:null});assert.doesNotMatch(legacy,/التوصيل: مجاني/);assert.match(legacy,/تُؤكّد للطلب السابق/);
});
test('Compact card images retain originals and never override an admin replacement photo',()=>{
 const map=JSON.parse(read('public/catalog-thumbnails.json')),provenance=JSON.parse(read('data/thumbnail-provenance.json'));
 assert.equal(provenance.length,173);let before=0,after=0;
 for(const entry of provenance){assert.ok(fs.existsSync(new URL('../public'+entry.original,import.meta.url)));assert.ok(fs.existsSync(new URL('../public'+entry.thumbnail,import.meta.url)));before+=entry.original_bytes;after+=entry.thumbnail_bytes;assert.equal(thumbnailFor({id:entry.id,image_url:entry.original},map),map[entry.id].thumbnail);assert.equal(thumbnailFor({id:entry.id,image_url:'/media/new.jpg'},map),'/media/new.jpg')}
 assert.ok(after<before*.15,`Thumbnails ${after}, originals ${before}`);
});
test('Streamed JSON is bounded by bytes without trusting Content-Length; normal Arabic remains valid',async()=>{
 const oversized=new Request('https://trend.test/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(15001));c.close()}}),duplex:'half'});
 await assert.rejects(()=>_test.content(oversized),/PAYLOAD_TOO_LARGE/);
 const normal=new Request('https://trend.test/api/orders',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({address:'العبدلي'})});assert.equal((await _test.content(normal)).address,'العبدلي');
});
test('Static responses enforce HTTPS, same-origin isolation and restricted scripts; admin is never cached',async()=>{
 const env={ASSETS:{fetch:async()=>new Response('<html></html>',{headers:{'content-type':'text/html'}})}};
 const response=await worker.fetch(new Request('https://trend.test/admin.html'),env,{});
 assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('strict-transport-security'),/max-age=31536000/);assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(response.headers.get('x-robots-tag'),/noindex/);
});
