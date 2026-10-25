import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  function prepare(query, params=[]) {
    return {bind(...args) { return prepare(query,args); }, async first() { return sql.prepare(query).get(...params) || null; }, async run() { return sql.prepare(query).run(...params); }};
  }
  const env={DB:{prepare}, SESSION_SECRET:'test-session-secret-that-is-longer-than-32-characters', SETUP_TOKEN:'test-private-bootstrap-token-that-is-longer-than-32-characters', STORE_LIVE:'false'};
  const call = (path, body, origin='https://trend.test') => worker.fetch(new Request('https://trend.test'+path, {method:'POST', headers:{origin,'content-type':'application/json'}, body:JSON.stringify(body)}), env, {});
  return {sql,env,call};
}

test('Owner setup rejects cross-origin, wrong keys, and short passwords without creating an account', async()=>{
  const {sql,env,call}=fixture();
  assert.equal((await call('/api/admin/setup',{token:env.SETUP_TOKEN,password:'a-long-password-for-testing'},'https://other.test')).status,403);
  assert.equal((await call('/api/admin/setup',{token:'wrong',password:'a-long-password-for-testing'})).status,403);
  assert.equal((await call('/api/admin/setup',{token:env.SETUP_TOKEN,password:'short'})).status,400);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM admin_credentials').get().n,0);
});

test('Private owner setup stores a salted hash, signs in, allows future login, and cannot be replayed', async()=>{
  const {sql,env,call}=fixture();
  const password='unique-password-for-the-owner';
  const first=await call('/api/admin/setup',{token:env.SETUP_TOKEN,password});
  assert.equal(first.status,201,await first.text());
  assert.match(first.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  const cookie=first.headers.get('set-cookie').split(';')[0];
  const hash=sql.prepare('SELECT password_hash FROM admin_credentials').get().password_hash;
  assert.match(hash,/^pbkdf2_sha256\$100000\$/); assert.ok(!hash.includes(password));
  assert.equal((await call('/api/admin/setup',{token:env.SETUP_TOKEN,password:'a-different-password-for-the-owner'})).status,409);
  const login=await call('/api/admin/login',{password}); assert.equal(login.status,200);
  const me=await worker.fetch(new Request('https://trend.test/api/admin/me',{headers:{cookie}}),env,{});
  assert.deepEqual(await me.json(),{authenticated:true,live:false});
});
