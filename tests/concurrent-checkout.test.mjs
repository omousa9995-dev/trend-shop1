import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker, {_test} from '../src/worker.js';
import {invoice} from '../public/invoice.js';

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
    runInsideBatch() { const stmt=sql.prepare(text); return stmt.columns().length ? {results:stmt.all(...params)} : {meta:stmt.run(...params)}; },
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
  const send = (index,key,{wallet,expected,qty=1}={}) => worker.fetch(new Request('https://trend.test/api/orders',{
    method:'POST',headers:{origin:'https://trend.test','content-type':'application/json',
      ...(wallet?{'x-invoice-gift-wallet':wallet}:{}),'x-idempotency-key':key,'cf-connecting-ip':'198.51.100.'+(index+1)},
    body:JSON.stringify({name:'اختبار محلي '+index,phone:'0791234567',email:'qa@example.test',
      governorate:'عمّان',address:'اختبار محلي',payment:'cod',expectedGiftDiscountFils:expected,items:[{id:'TS9001',qty}]}),
  }),env,{waitUntil:p=>pending.push(p)});
  const request=(path,init={})=>worker.fetch(new Request('https://trend.test'+path,init),env,{waitUntil:p=>pending.push(p)});
  const gift=(action,wallet,token)=>request('/api/invoice-gift/'+action,{method:'POST',
    headers:{origin:'https://trend.test','content-type':'application/json','x-invoice-gift-wallet':wallet},
    body:JSON.stringify(token?{token}:{})}).then(r=>r.json());
  const admin=async()=>{const cookie='ts_admin='+await _test.makeSession(env);return (await request('/api/admin/orders',{headers:{cookie}})).json();};
  return {sql,send,emails,pending,request,gift,admin};
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

test('Printed gifts start on first scan and survive retries, concurrent checkout, and receipt recovery',async t=>{
  const f=fixture(t,20), wallet='a'.repeat(32), second='b'.repeat(32);
  f.sql.exec('UPDATE products SET price_fils=500,reference_price_fils=500');
  const source=await (await f.send(0,'initial-invoice-source-key')).json();
  const original=(await f.admin()).orders[0];
  assert.equal(original.id,source.orderId);
  const token=original.invoice_gift_token;
  assert.match(invoice(original),new RegExp('https://trendjo.pages.dev/#gift='+token));
  assert.equal(f.sql.prepare('SELECT claimed_at FROM invoice_gifts').get().claimed_at,null);
  assert.equal((await f.gift('status',wallet)).active,null);
  const first=await f.gift('claim',wallet,token);
  assert.equal(first.status,'activated');
  assert.ok(Math.abs(first.active.expiresAt-first.serverTime-10*86400000)<1500);
  const repeat=await f.gift('claim',wallet,token);
  assert.equal(repeat.status,'active'); assert.equal(repeat.active.expiresAt,first.active.expiresAt);
  assert.equal((await f.gift('claim',second,token)).status,'claimed');
  assert.equal((await f.gift('status',second)).active,null);
  assert.equal((await f.gift('claim',second,'f'.repeat(32))).status,'invalid');
  // A rejected checkout cannot spend the gift or create another invoice.
  assert.equal((await f.send(2,'incorrect-gift-expectation',{wallet,expected:0})).status,409);
  assert.ok((await f.gift('status',wallet)).active);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,1);
  f.sql.exec("CREATE TRIGGER fail_fixture_line BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT,'test interruption'); END;");
  assert.equal((await f.send(2,'failed-stock-fixture-order',{wallet,expected:100})).status,409);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM invoice_gift_redemptions').get().n,0);
  f.sql.exec('DROP TRIGGER fail_fixture_line');
  const keys=['gift-checkout-logical-one','gift-checkout-logical-two'];
  const responses=await Promise.all(keys.map((key,i)=>f.send(i+3,key,{wallet,expected:100})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  const winner=responses.findIndex(r=>r.status===201);
  const receipt=await responses[winner].json();
  assert.equal(receipt.giftDiscountFils,100);assert.equal(receipt.subtotalFils,400);
  assert.equal(receipt.shippingFeeFils,1000);assert.equal(receipt.totalFils,1400);
  assert.equal((await responses[1-winner].json()).code,'INVOICE_GIFT_CHANGED');
  const again=await (await f.send(6,keys[winner],{wallet,expected:100})).json();
  assert.equal(again.orderId,receipt.orderId);assert.equal(again.giftDiscountFils,100);
  assert.equal((await f.gift('claim',wallet,token)).status,'used');
  assert.equal((await f.gift('status',wallet)).active,null);
  const discounted=(await f.admin()).orders.find(x=>x.id===receipt.orderId);
  assert.notEqual(discounted.invoice_gift_token,token);assert.match(invoice(discounted),/هدية الفاتورة 20%: − 0\.10/);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM invoice_gift_redemptions').get().n,1);
  const regular=await (await f.send(8,'next-undiscounted-order',{wallet,expected:0})).json();
  assert.equal(regular.totalFils,1500);await Promise.all(f.pending);
});

test('Migration preserves historical orders and a scanned gift expires exactly ten days later',async t=>{
  const f=fixture(t,5), wallet='c'.repeat(32);
  f.sql.exec('DROP TRIGGER issue_invoice_gift; DROP TABLE invoice_gift_redemptions; DROP TABLE invoice_gifts');
  const source=await (await f.send(0,'previous-version-invoice')).json();
  const migration=readFileSync(new URL('../db/migrations/0035_invoice_gifts.sql',import.meta.url),'utf8');
  f.sql.exec(migration);f.sql.exec(migration);
  const row=f.sql.prepare('SELECT * FROM invoice_gifts').get();
  assert.equal(row.source_order_id,source.orderId);
  assert.equal(row.claimed_at,null);
  await f.gift('claim',wallet,row.scan_token);
  f.sql.exec('UPDATE invoice_gifts SET claimed_at=unixepoch()-864000+60');
  assert.ok((await f.gift('status',wallet)).active);
  f.sql.exec('UPDATE invoice_gifts SET claimed_at=unixepoch()-864000');
  assert.equal((await f.gift('claim',wallet,row.scan_token)).status,'expired');
  assert.equal((await f.gift('status',wallet)).active,null);
  assert.equal((await f.send(1,'stale-expired-checkout',{wallet,expected:200})).status,409);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM invoice_gift_redemptions').get().n,0);
  await Promise.all(f.pending);
});
