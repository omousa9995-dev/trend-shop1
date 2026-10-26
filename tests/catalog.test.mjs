import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const dir=new URL('../public/',import.meta.url);const catalog=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url),'utf8'));
test('All source entries have a review decision and the published catalog contains only selected, distinct products',()=>{
 const original=JSON.parse(fs.readFileSync(new URL('../data/catalog-original.json',import.meta.url),'utf8'));
 const audit=JSON.parse(fs.readFileSync(new URL('../data/catalog-decisions.json',import.meta.url),'utf8'));
 assert.equal(original.length,190);assert.equal(audit.decisions.length,190);
 assert.equal(catalog.length,audit.selected);assert.equal(catalog.length,173);
 assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length);
 for(const row of audit.decisions)assert.equal(catalog.some(p=>p.id===row.id),row.decision==='selected');
 assert.ok(catalog.some(p=>p.id==='TS0065'));assert.ok(catalog.some(p=>p.id==='TS0081'));assert.ok(catalog.some(p=>p.id==='TS0101'),'Original sunscreen, Aqua Fresh and mini size are distinct choices');
});
test('Every selected product has a real local packshot and complete individual Arabic copy',()=>{
 assert.equal(new Set(catalog.map(p=>p.description)).size,catalog.length);
 for(const p of catalog){assert.ok(p.brand&&p.name&&p.category&&p.description.length>90);assert.match(p.image,/^\/images\/catalog\/TS[A-Z0-9-]+-[a-f0-9]{12}\.(jpg|png|webp|avif)$/);assert.ok(fs.existsSync(new URL('../public'+p.image,import.meta.url)));assert.ok(p.details.nameAr&&p.details.tagline&&p.details.howToUse);assert.equal(p.details.benefits.length,3);assert.equal(p.details.imageType,'photo')}
});
test('All selected products use authorized final prices within the owner range and 24 initial units',()=>{for(const p of catalog){assert.ok(Number.isInteger(p.priceFils)&&p.priceFils>=500&&p.priceFils<=20000);assert.equal(p.discount,Math.floor((p.reference-p.priceFils)*100/p.reference+1e-8));assert.equal(p.priceFils%10,0);assert.equal(p.approved,true);assert.equal(p.stock,24);assert.ok(Number.isInteger(p.researchReferenceFils))}assert.equal(Math.min(...catalog.map(p=>p.priceFils)),500);assert.equal(catalog.reduce((n,p)=>n+p.stock,0),4152)});
test('payment only COD or CliQ, correct support contact and no card integrations',()=>{const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.match(ui,/TRUSTTREND/);assert.ok(ui.includes('value="cod"'));assert.ok(ui.includes('value="cliq"'));assert.match(html,/962790025430/);assert.doesNotMatch(ui,/stripe|paypal|visa|mastercard/i)});
