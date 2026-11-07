import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{_test} from '../src/worker.js';
import {buildCustomerReport,customerOrderDate,fetchCustomerReport,metaCustomerCsv,splitCustomerName} from '../public/customer-report.js';
import {customerWorkbookModel} from '../public/customer-workbook-model.js';

const row=(id,more={})=>({id,name:'سارة النموذج',phone:'0791234567',email:'SARA@example.test',governorate:'عمّان',address:'عنوان اختبار',status:'تم',subtotal_fils:7250,discount_fils:750,shipping_fee_fils:1000,created_at:'2026-11-07 21:30:00',items:[{product_id:'TS9001',name_snapshot:'تونر اختبار',qty:2,unit_price_fils:4000,category:'البشرة',brand:'Test',product_type:'toner'}],...more});
function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 db.prepare('INSERT INTO products(id,name,brand,category,price_fils,reference_price_fils,image_url,stock,details_json,approved,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('TS9001','تونر اختبار','Test','البشرة',4000,5000,'/images/TS0001.svg',10000,'{"productType":"toner"}',1,1);
 const statement=(sql,args=[])=>({bind(...params){return statement(sql,params)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}}});
 const env={DB:{prepare:sql=>statement(sql)},SESSION_SECRET:'customer-report-test-session-secret-longer-than-32-characters',ADMIN_PASSWORD_HASH:'test-hash',STORE_LIVE:'true'};
 const insert=r=>{db.prepare('INSERT INTO orders(id,idempotency_key,name,phone,email,governorate,address,status,subtotal_fils,shipping_fee_fils,discount_fils,created_at,notes,maps_url,payment_method) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(r.id,r.id,r.name,r.phone,r.email,r.governorate,r.address,r.status,r.subtotal_fils,r.shipping_fee_fils,r.discount_fils,r.created_at,'private note never exported','https://maps.invalid/private','cod');for(const i of r.items)db.prepare('INSERT INTO order_items(order_id,product_id,name_snapshot,image_snapshot,qty,unit_price_fils) VALUES(?,?,?,?,?,?)').run(r.id,i.product_id,i.name_snapshot,'/images/TS0001.svg',i.qty,i.unit_price_fils);};
 const get=async(query='',cookie)=>worker.fetch(new Request('https://trend.test/api/admin/customer-report'+query,{headers:cookie?{cookie}:undefined}),env,{});
 t.after(()=>db.close());return {db,env,insert,get};
}
test('Private customer report requires a valid session, is never cached, and exports only requested fields',async t=>{
 const f=fixture(t);f.insert(row('TR-TEST-1'));
 for(const cookie of [undefined,'ts_admin=forged.signature'])assert.equal((await f.get('',cookie)).status,401);
 const response=await f.get('','ts_admin='+await _test.makeSession(f.env));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 const data=await response.json();assert.equal(data.orders.length,1);assert.equal(data.orders[0].items[0].product_type,'toner');assert.equal(data.orders[0].subtotal_fils,7250);
 for(const field of ['notes','maps_url','idempotency_key','payment_method','cliq_alias'])assert.equal(Object.hasOwn(data.orders[0],field),false);
 assert.equal(f.db.prepare('SELECT stock FROM products').get().stock,9998);
});
test('Complete history pagination exceeds 300 orders without duplicates and keeps newly inserted orders for next extraction',async t=>{
 const f=fixture(t);for(let i=1;i<=607;i++)f.insert(row('TR-PAGE-'+i,{phone:'0791234567'}));
 const cookie='ts_admin='+await _test.makeSession(f.env);let pages=0;
 const call=async p=>{const res=await f.get('?'+p.split('?')[1],cookie);assert.equal(res.status,200);const data=await res.json();if(++pages===1)f.insert(row('TR-NEW-AFTER-SNAPSHOT'));return data;};
 const report=await fetchCustomerReport(call);assert.equal(pages,3);assert.equal(report.orders.length,607);assert.equal(new Set(report.orders.map(r=>r.id)).size,607);assert.equal(report.orders.some(r=>r.id==='TR-NEW-AFTER-SNAPSHOT'),false);
 const fresh=await fetchCustomerReport(async p=>(await f.get('?'+p.split('?')[1],cookie)).json());assert.equal(fresh.orders.length,608);
});
test('Date filtering uses Amman days and status filtering uses the stored status; invalid input is rejected',async t=>{
 const f=fixture(t);f.insert(row('BEFORE',{created_at:'2026-11-06 20:59:59'}));f.insert(row('IN',{created_at:'2026-11-06 21:00:00'}));f.insert(row('AFTER',{created_at:'2026-11-07 21:00:00',status:'جديد'}));
 const cookie='ts_admin='+await _test.makeSession(f.env),res=await f.get('?from=2026-11-07&to=2026-11-07&status=completed',cookie);assert.deepEqual((await res.json()).orders.map(r=>r.id),['IN']);
 for(const query of ['?from=2026-02-30','?from=2026-11-08&to=2026-11-07','?status=constructor','?snapshot=-1','?cursor=3','?snapshot=2&cursor=3','?snapshot=1.2','?snapshot=1&cursor=0'])assert.equal((await f.get(query,cookie)).status,400,query);
});
test('International phone normalization, Amman dates, exact amounts and completed-only Meta aggregation preserve source meaning',()=>{
 const report=buildCustomerReport([row('A',{phone:'٠٧٩١٢٣٤٥٦٧'}),row('B',{phone:'+962 79 123 4567',subtotal_fils:2150,shipping_fee_fils:null,status:'جديد'}),row('C',{phone:'00966501234567',name:'عبد الله النموذج',subtotal_fils:3500,shipping_fee_fils:0})]);
 assert.equal(report.contacts.length,2);assert.equal(report.contacts[0].orderCount,2);assert.equal(report.orders.find(o=>o.id==='B').totalFils,null);assert.equal(report.summary.unknownTotalCount,1);
 assert.equal(report.summary.goodsFils,12900);assert.equal(report.summary.completedGoodsFils,10750);assert.equal(report.metaRows.length,2);
 assert.equal(report.metaRows.find(r=>r.phone==='962791234567').value,7.25);assert.equal(report.metaRows.find(r=>r.phone==='966501234567').fn,'عبد الله');assert.equal(report.metaRows[0].country,'jo');assert.equal(report.metaRows.find(r=>r.phone==='962791234567').st,'amman');
 assert.equal(report.orders.find(r=>r.id==='A').phone,'+962791234567');assert.equal(customerOrderDate('2026-11-07 21:30:00').dateLocal,'2026-11-08 00:30');assert.equal(customerOrderDate('').dateSerial,null);
 assert.deepEqual(splitCustomerName('ليان').lastName,'');assert.equal(report.topTypes[0].name,'التونر');assert.equal(report.topTypes[0].count,6);
});
test('Invalid data stays visible for correction, identifiers are not invented, conflicting names are omitted from Meta',()=>{
 const report=buildCustomerReport([row('A',{name:'شخص أول'}),row('B',{name:'شخص آخر'}),row('C',{name:'اسم',phone:'123',email:'bad-email',shipping_fee_fils:null,created_at:'invalid'}),row('D',{phone:'',email:'VALID@example.test',name:'=HYPERLINK("bad")',address:'<img src=x onerror=alert(1)>'})]);
 assert.equal(report.contacts.find(c=>c.phone==='+962791234567').nameConflict,true);assert.equal(report.metaRows.find(c=>c.phone==='962791234567').fn,'');assert.equal(report.metaRows.find(c=>c.phone==='962791234567').ln,'');assert.equal(report.metaRows.find(c=>c.email==='valid@example.test').fn,'');assert.equal(report.metaRows.length,2);assert.equal(report.orders.find(r=>r.id==='C').phone,'');assert.equal(report.orders.find(r=>r.id==='C').phoneOriginal,'123');
 const csv=metaCustomerCsv(report);assert.ok(csv.startsWith('\ufeffemail,phone,fn,ln,st,country,value\r\n'));assert.equal(csv.includes('العنوان'),false);assert.equal(csv.includes('HYPERLINK'),false);assert.equal(csv.includes('bad-email'),false);
 const model=customerWorkbookModel(report);assert.equal(model.sheets.length,5);assert.equal(model.sheets.find(s=>s.name==='الطلبات').rows.length,4);assert.equal(model.sheets.find(s=>s.name==='الزبائن').rows[0][8].f.startsWith('COUNTIF('),true);
});
test('Report fetch refuses changing snapshots, repeated cursors and aborted requests',async()=>{
 let i=0;await assert.rejects(()=>fetchCustomerReport(async()=>({orders:[row('A')],snapshot:++i,nextCursor:2})),/اكتمال/);
 await assert.rejects(()=>fetchCustomerReport(async()=>({orders:[row('A')],snapshot:5,nextCursor:2})),/متابعة/);
 const control=new AbortController();control.abort();await assert.rejects(()=>fetchCustomerReport(()=>assert.fail('must not fetch'),{},{signal:control.signal}),{name:'AbortError'});
});
test('Shared emails cannot merge different phone contacts in Meta, and unknown purchase values stay empty',()=>{
 const report=buildCustomerReport([row('A'),row('B',{phone:'0791234568',subtotal_fils:null}),row('C',{phone:'',email:'only@example.test'})]);
 assert.equal(report.metaRows.find(r=>r.phone==='962791234567').email,'');assert.equal(report.metaRows.find(r=>r.phone==='962791234568').email,'');assert.equal(report.metaRows.find(r=>r.phone==='962791234568').value,null);assert.equal(report.metaRows.find(r=>r.email==='only@example.test').phone,'');assert.ok(report.contacts.find(c=>c.phone==='+962791234567').flags.some(f=>f.includes('البريد مستخدم')));assert.match(metaCustomerCsv(report),/"962791234568"[^\r\n]*,""\r\n/);
});
test('Explicitly marked test invoices stay in Excel but never enter Meta audiences or values',()=>{
 const report=buildCustomerReport([row('A'),row('B',{name:'سارة تجريبي',subtotal_fils:999000}),row('TR-DEMO-1',{phone:'0791234568',email:'demo@example.test',name:'سارة النموذج'})]);
 assert.equal(report.orders.length,3);assert.equal(report.summary.testOrders,2);assert.equal(report.metaRows.length,1);assert.equal(report.metaRows[0].value,7.25);assert.ok(report.orders.find(o=>o.id==='B').flags.some(f=>f.includes('كتجربة')));assert.equal(customerWorkbookModel(report).sheets.find(s=>s.name==='الطلبات').rows.length,3);
});
