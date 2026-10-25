import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Fresh catalog has exactly the selected 173 products approved, correctly priced, with 24 units each',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));db.exec(read('db/seed.sql'));
 const summary=db.prepare('SELECT COUNT(*) total,SUM(active) active,SUM(approved) approved,SUM(stock) stock FROM products').get();
 assert.deepEqual({...summary},{total:190,active:173,approved:173,stock:4152});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM products WHERE active=1 AND (price_fils<500 OR price_fils>20000 OR price_fils!=reference_price_fils OR discount_percent!=0 OR stock!=24)').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM products WHERE active=0 AND (stock!=0 OR approved!=0)').get().n,0);
});

test('Reapplying seed and initial pricing migration does not replenish sold units or overwrite later prices',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));db.exec(read('db/seed.sql'));
 db.prepare("UPDATE products SET stock=19,price_fils=2800,reference_price_fils=2800 WHERE id='TS0001'").run();
 db.exec(read('db/seed.sql'));db.exec(read('db/migrations/0003_initial_pricing_stock.sql'));
 const row=db.prepare("SELECT stock,price_fils,reference_price_fils FROM products WHERE id='TS0001'").get();
 assert.deepEqual({...row},{stock:19,price_fils:2800,reference_price_fils:2800});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM catalog_releases').get().n,1);
});
