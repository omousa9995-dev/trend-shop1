import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';
const base=new URL('../',import.meta.url);
const file=name=>fs.readFileSync(new URL(name,base),'utf8');
const fakeDB=()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(file('db/schema.sql'));
 sql.prepare(`INSERT INTO products (id,brand,name,category,reference_price_fils,price_fils,discount_percent,approved,active,stock) VALUES ('TS1001','ACME','Approved','البشرة',10000,8000,20,1,1,5),('TS1002','ACME','Draft','البشرة',10000,8000,20,0,1,0),('TS1003','ACME','Archived','البشرة',10000,8000,20,1,0,5)`).run();
 return {prepare(query){let args=[];return {bind(...params){args=params;return this},async all(){return {results:sql.prepare(query).all(...args)}}}}};
};
test('Live catalog never exposes unapproved or archived products',async()=>{
 const DB=fakeDB(),url='https://trend.test/api/catalog';
 const env={DB,SESSION_SECRET:'a-very-long-random-secret-value-for-test',ADMIN_PASSWORD_HASH:'exists',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://example.com/script',MAIL_WEBHOOK_TOKEN:'this-is-a-very-long-random-mail-secret'};
 const live=await worker.fetch(new Request(url),env,{});assert.equal(live.status,200);const data=await live.json();assert.equal(data.storeLive,true);assert.deepEqual(data.products.map(x=>x.id),['TS1001']);
 const preview=await worker.fetch(new Request(url),{...env,STORE_LIVE:'false'},{});const draft=await preview.json();assert.equal(draft.storeLive,false);assert.deepEqual(draft.products.map(x=>x.id),['TS1001','TS1002']);
});
test('Cloudflare static assets have CSP and administrative screens disallow indexing and caching',()=>{
 const headers=file('public/_headers');
 for(const x of ["script-src 'self'","frame-ancestors 'none'",'X-Content-Type-Options: nosniff','X-Frame-Options: DENY','/admin.html','Cache-Control: no-store','X-Robots-Tag: noindex']) assert.ok(headers.includes(x),x);
 assert.ok(file('src/worker.js').includes("'cache-control':'no-store'"),'API responses must be no-store');
});
test('Admin UI offers safe reversible removal from storefront',()=>{
 const script=file('public/admin.js');assert.ok(script.includes('حذف من العرض'));assert.ok(script.includes('استعادة للعرض'));assert.ok(script.includes('active:next'));
});
