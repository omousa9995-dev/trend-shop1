import fs from 'node:fs';
import {retailPrice,actualDiscount} from '../public/commerce.js';
const before=JSON.parse(fs.readFileSync('data/retail-prices-before.json','utf8')),catalog=JSON.parse(fs.readFileSync('public/catalog.json','utf8'));
const release='retail-prices-2026-10-26-v1';
const changes=before.map(p=>({...p,previous_price_fils:p.price_fils,price_fils:retailPrice(p.price_fils),discount_percent:actualDiscount(p.reference_price_fils,retailPrice(p.price_fils))}));
for(const p of catalog){const next=changes.find(x=>x.id===p.id);if(next){p.priceFils=next.price_fils;p.reference=next.reference_price_fils;p.discount=next.discount_percent}}
fs.writeFileSync('public/catalog.json',JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync('data/retail-pricing-policy.json',JSON.stringify({release,rule:'Nearest clear ending .00, .49, .50 or .99; .75 also kept for small amounts. Actual discount is rounded down for truthful badges. Stock and past orders are never reset.',changes},null,2)+'\n');
const sql=["-- Clear retail amounts; never changes stock or historical orders.","CREATE TABLE IF NOT EXISTS catalog_releases (id TEXT PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT(datetime('now')));"];
for(const p of changes)sql.push(`UPDATE products SET price_fils=${p.price_fils},discount_percent=${p.discount_percent},updated_at=datetime('now') WHERE id='${p.id}' AND active=1 AND approved=1 AND price_fils=${p.previous_price_fils} AND reference_price_fils=${p.reference_price_fils} AND NOT EXISTS(SELECT 1 FROM catalog_releases WHERE id='${release}');`);
sql.push(`INSERT OR IGNORE INTO catalog_releases(id) VALUES('${release}');`);fs.writeFileSync('db/migrations/0007_retail_prices.sql',sql.join('\n')+'\n');
console.log(JSON.stringify({products:changes.length,min:Math.min(...changes.map(x=>x.price_fils)),max:Math.max(...changes.map(x=>x.price_fils)),sample:changes.slice(0,5).map(({id,previous_price_fils,price_fils})=>({id,previous_price_fils,price_fils}))}));
