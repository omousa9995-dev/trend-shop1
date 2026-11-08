import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM, VirtualConsole} from 'jsdom';
import {buildSync} from 'esbuild';
import {createOrderId, isOrderId, orderIdGenerator, persistOrder, changeOrderStatuses} from '../src/order-management.js';
import {invoice} from '../public/invoice.js';
import {buildCustomerReport} from '../public/customer-report.js';
import {customerWorkbookModel} from '../public/customer-workbook-model.js';
import worker, {_test} from '../src/worker.js';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
function database(t) {
  const sql = new DatabaseSync(':memory:'); sql.exec(read('db/schema.sql'));
  t.after(()=>sql.close());
  const query = (text, params=[]) => ({
    bind(...values) { assert.ok(values.length<=100); return query(text,values); },
    async first() { return sql.prepare(text).get(...params)||null; },
    async all() { return {results:sql.prepare(text).all(...params)}; },
    async run() { return {meta:sql.prepare(text).run(...params)}; },
  });
  const db={prepare:text=>query(text),async batch(statements){sql.exec('BEGIN');try{const results=[];for(const q of statements)results.push(await q.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  const insert=(id,key=id)=>db.prepare('INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils,shipping_fee_fils) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,key,'سارة نموذج','+962791234567','عمّان','العبدلي','cod',11990,1000);
  return {db,sql,insert};
}

test('Short order identifiers have four unbiased nonzero characters and legacy identifiers remain valid',()=>{
  assert.equal(createOrderId(bytes=>{bytes.fill(0);return bytes;}),'TR-1111');
  for(let i=0;i<500;i++) assert.match(createOrderId(),/^TR-[1-9A-HJ-NP-Z]{4}$/);
  for(const id of ['TR-7K3M','TR-20261025-ABC1234']) assert.equal(isOrderId(id),true);
  for(const id of ['TR-1A0M','TR-1A3','TR-<img>','TR-0000']) assert.equal(isOrderId(id),false);
});

test('An actual primary-key collision retries atomically, while an idempotency replay returns its original receipt',async t=>{
  const {db,sql,insert}=database(t);await insert('TR-1111').run();
  const codes=['TR-1111','TR-7K3M'];
  const saved=await persistOrder(db,'new-key',id=>[insert(id,'new-key')],()=>codes.shift());
  assert.deepEqual(saved,{id:'TR-7K3M'});assert.equal(sql.prepare('SELECT count(*) n FROM orders').get().n,2);
  const replay=await persistOrder(db,'new-key',id=>[insert(id,'new-key')],()=> 'TR-9ABC');
  assert.equal(replay.duplicate.id,'TR-7K3M');assert.equal(sql.prepare('SELECT count(*) n FROM orders').get().n,2);
  await assert.rejects(persistOrder(db,'bad',()=>[db.prepare('INSERT INTO missing_table VALUES(1)')]),/missing_table/);
});

test('Bulk status changes cover 300 selected legacy orders within D1 binding limits and leave unselected orders untouched',async t=>{
  const {db,sql,insert}=database(t),ids=Array.from({length:300},(_,i)=>'TR-BULK-'+i);
  for(const id of ids)await insert(id).run();await insert('TR-KEEP-OLD').run();
  for(const status of ['قيد التجهيز','تم','جديد']){
    const result=await changeOrderStatuses(db,ids,status);assert.equal(result.updated,300);
    assert.equal(sql.prepare('SELECT count(*) n FROM orders WHERE status=?').get(status).n,status==='جديد'?301:300);
    assert.equal(sql.prepare("SELECT status FROM orders WHERE id='TR-KEEP-OLD'").get().status,'جديد');
  }
  assert.equal((await changeOrderStatuses(db,[ids[0],'TR-NOT-FOUND'],'تم')).status,409);
  assert.equal(sql.prepare('SELECT status FROM orders WHERE id=?').get(ids[0]).status,'جديد');
  for(const selection of [[],[ids[0],ids[0]],['bad'],Array(301).fill(ids[0])])assert.equal((await changeOrderStatuses(db,selection,'تم')).status,400);
  assert.equal((await changeOrderStatuses(db,[ids[0]],'مدفوع')).status,400);
});

test('Bulk status API keeps owner authentication and same-origin protections and accepts both old and short IDs',async t=>{
  const {db,sql,insert}=database(t);await insert('TR-7K3M').run();await insert('TR-20261025-ABC1234').run();
  const env={DB:db,SESSION_SECRET:'test-session-secret-that-is-longer-than-32-characters',ADMIN_PASSWORD_HASH:'test-hash'};
  const cookie='ts_admin='+await _test.makeSession(env);
  const send=(headers={})=>worker.fetch(new Request('https://trend.test/api/admin/orders',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1',...headers},body:JSON.stringify({ids:['TR-7K3M','TR-20261025-ABC1234'],status:'تم'})}),env,{});
  assert.equal((await send()).status,401);assert.equal((await send({cookie,origin:'https://foreign.test'})).status,403);
  const response=await send({cookie});assert.equal(response.status,200);assert.equal((await response.json()).updated,2);
  assert.equal(sql.prepare("SELECT count(*) n FROM orders WHERE status='تم'").get().n,2);
});

test('Invoice top parcel amount includes delivery, matches its lower total and does not invent unknown historical shipping',()=>{
  const order={id:'TR-7K3M',name:'سارة',phone:'+962791234567',status:'قيد التجهيز',created_at:'2026-11-08 10:00:00',subtotal_fils:11990,shipping_fee_fils:1000,items:[]};
  const dom=new JSDOM(invoice(order));const d=dom.window.document;
  assert.match(d.querySelector('.invoice-status-block').firstElementChild.textContent,/الحالة: قيد التجهيز/);
  assert.equal(d.querySelector('.invoice-parcel-total strong').textContent,'12.99 د.أ');
  assert.match(d.querySelector('.invoice-total').nextElementSibling.textContent,/12.99/);dom.window.close();
  assert.match(invoice({...order,shipping_fee_fils:0}),/11\.99/);
  const old=new JSDOM(invoice({...order,shipping_fee_fils:null}));assert.match(old.window.document.querySelector('.invoice-parcel-total').textContent,/تُؤكّد رسوم التوصيل/);old.window.close();
});

test('The same short order number and parcel total reach customer reports and the Excel workbook model unchanged',()=>{
  const report=buildCustomerReport([{id:'TR-7K3M',name:'سارة أحمد',phone:'+962791234567',status:'تم',created_at:'2026-11-08 10:00:00',subtotal_fils:11990,shipping_fee_fils:1000,items:[]}]);
  assert.equal(report.orders[0].id,'TR-7K3M');assert.equal(report.orders[0].totalFils,12990);
  const model=customerWorkbookModel(report);assert.match(JSON.stringify(model),/TR-7K3M/);
});

test('Select all can change every displayed order once; pending requests lock selection and retain invoice printing',async t=>{
  const html=read('public/admin.html'),source=buildSync({entryPoints:[new URL('../public/admin.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,logLevel:'silent'}).outputFiles[0].text;
  const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:'https://trend.test/admin.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document;w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=()=>{};
  let release;const pending=new Promise(resolve=>release=resolve),posts=[],printed=[];
  const rows=['TR-7K3M','TR-8N4P'].map(id=>({id,status:'جديد',created_at:'2026-11-08 10:00:00',name:'سارة',subtotal_fils:11990,shipping_fee_fils:1000,items:[]}));
  w.print=()=>printed.push(d.querySelector('#printRoot').innerHTML);
  w.fetch=async(url,options={})=>{const path=new URL(url,'https://trend.test').pathname;
    if(path.endsWith('/orders')&&options.method==='POST'){const body=JSON.parse(options.body);posts.push(body);await pending;for(const order of rows)if(body.ids.includes(order.id))order.status=body.status;return{ok:true,json:async()=>({ok:true,updated:body.ids.length})};}
    const data=path.endsWith('/me')?{authenticated:true,live:true}:path.endsWith('/orders')?{orders:rows}:path.endsWith('/products')?{products:[]}:path.endsWith('/promotions')?{promotions:[]}:{};
    return {ok:true,json:async()=>structuredClone(data)};
  };
  const until=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.ok(predicate());};
  w.eval(source);await until(()=>d.querySelectorAll('[data-select-invoice]').length===2&&!d.querySelector('#selectAllInvoices').disabled);
  d.querySelector('#selectAllInvoices').click();const status=d.querySelector('#bulkOrderStatus');status.value='قيد التجهيز';status.dispatchEvent(new w.Event('change'));
  d.querySelector('#applyOrderStatus').click();d.querySelector('#applyOrderStatus').click();assert.equal(posts.length,1);assert.equal(d.querySelector('#selectAllInvoices').disabled,true);
  release();await until(()=>!d.querySelector('#selectAllInvoices').disabled&&d.querySelector('[data-status-id]').value==='قيد التجهيز');
  assert.deepEqual(posts[0],{ids:['TR-7K3M','TR-8N4P'],status:'قيد التجهيز'});assert.match(d.querySelector('#orderStatusMessage').textContent,/2 طلب/);
  d.querySelector('#printSelectedInvoices').click();assert.equal(printed.length,1);assert.equal((printed[0].match(/invoice-parcel-total/g)||[]).length,2);assert.deepEqual(errors,[]);
});

test('The production compatibility switch keeps the existing email bridge valid until its matching update is published',()=>{
 assert.match(orderIdGenerator({SHORT_ORDER_IDS:'false'})(),/^TR-[A-Z0-9-]{8,40}$/);
 assert.match(orderIdGenerator({SHORT_ORDER_IDS:'true'})(),/^TR-[1-9A-HJ-NP-Z]{4}$/);
});
