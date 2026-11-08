import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';

// A local database and a mocked mail transport: no production orders or emails.
function fixture(t, stock) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  sql.prepare('INSERT INTO products(id,name,brand,category,reference_price_fils,price_fils,stock,approved,active) VALUES(?,?,?,?,?,?,?,?,?)')
    .run('TS9001','منتج اختبار محلي','QA','البشرة',1000,1000,stock,1,1);
  t.after(()=>sql.close());
  // D1 serializes its primary's operations and executes each batch atomically.
  let tail = Promise.resolve();
  const schedule = fn => {
    const result = tail.then(fn);
    tail = result.catch(()=>{});
    return result;
  };
  const statement = (text, params=[]) => ({
    bind(...values) { return statement(text,values); },
    first() { return schedule(()=>sql.prepare(text).get(...params)||null); },
    all() { return schedule(()=>({results:sql.prepare(text).all(...params)})); },
    run() { return schedule(()=>({meta:sql.prepare(text).run(...params)})); },
    runInsideBatch() { return {meta:sql.prepare(text).run(...params)}; },
  });
  const env = {
    DB: {prepare:text=>statement(text),batch:rows=>schedule(()=>{
      sql.exec('BEGIN');
      try {const result=rows.map(row=>row.runInsideBatch());sql.exec('COMMIT');return result;}
      catch(error) {sql.exec('ROLLBACK');throw error;}
    })},
    SESSION_SECRET:'local-concurrency-fixture-secret-over-32-characters',
    ADMIN_PASSWORD_HASH:'local-fixture-hash',STORE_LIVE:'true',SHORT_ORDER_IDS:'true',
    MAIL_WEBHOOK_URL:'https://mail.example.test/fixture',
    MAIL_WEBHOOK_TOKEN:'local-mail-fixture-secret-over-32-characters',
  };
  const emails=[],pending=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,env.MAIL_WEBHOOK_URL);
    emails.push(JSON.parse(options.body));
    return Response.json({ok:true,ownerSent:true,customerSent:true});
  });
  const send = (index,key) => worker.fetch(new Request('https://trend.test/api/orders',{
    method:'POST',headers:{origin:'https://trend.test','content-type':'application/json',
      'x-idempotency-key':key,'cf-connecting-ip':'198.51.100.'+(index+1)},
    body:JSON.stringify({name:'اختبار محلي '+index,phone:'0791234567',email:'qa@example.test',
      governorate:'عمّان',address:'اختبار محلي',payment:'cod',items:[{id:'TS9001',qty:1}]}),
  }),env,{waitUntil:p=>pending.push(p)});
  return {sql,send,emails,pending};
}

test('Fifty simultaneous local customers cannot oversell the last three units or send mail for rejected orders',async t=>{
  const f=fixture(t,3);
  const responses=await Promise.all(Array.from({length:50},(_,i)=>f.send(i,'concurrent-distinct-order-'+i)));
  await Promise.all(f.pending);
  assert.equal(responses.filter(r=>r.status===201).length,3);
  assert.equal(responses.filter(r=>r.status===409).length,47);
  assert.equal(f.sql.prepare('SELECT stock FROM products WHERE id=?').get('TS9001').stock,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,3);
  assert.equal(f.sql.prepare('SELECT SUM(qty) n FROM order_items').get().n,3);
  assert.equal(f.emails.length,3);
});

test('Fifty simultaneous local retries of one order preserve one receipt, one stock deduction and one mail dispatch',async t=>{
  const f=fixture(t,1);
  const responses=await Promise.all(Array.from({length:50},(_,i)=>f.send(i,'concurrent-one-logical-order-key')));
  const receipts=await Promise.all(responses.map(r=>r.json()));
  await Promise.all(f.pending);
  assert.equal(responses.filter(r=>r.status===201).length,1);
  assert.equal(responses.filter(r=>r.status===200).length,49);
  assert.equal(new Set(receipts.map(r=>r.orderId)).size,1);
  assert.match(receipts[0].orderId,/^TR-[1-9A-HJ-NP-Z]{4}$/);
  assert.equal(f.sql.prepare('SELECT stock FROM products WHERE id=?').get('TS9001').stock,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
  assert.equal(f.sql.prepare('SELECT SUM(qty) n FROM order_items').get().n,1);
  assert.equal(f.emails.length,1);
});
