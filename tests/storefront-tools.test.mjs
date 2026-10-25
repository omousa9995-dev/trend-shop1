import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeSearch, searchProducts, nextQuantity, productGallery} from '../public/shop-tools.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url),'utf8'));

test('A first Arabic letter suggests the nude palette and a full name narrows the catalog',()=>{
 const first=searchProducts(catalog,'ن');
 assert.ok(first.slice(0,6).some(p=>p.id==='TS0002'));
 const nude=searchProducts(catalog,'نود دودو');
 assert.deepEqual(nude.map(p=>p.id),['TS0002']);
 assert.ok(searchProducts(catalog,'Nude').some(p=>p.id==='TS0002'));
});
test('Arabic search accepts harakat, tatweel, and alternate alef forms without changing the query field',()=>{
 assert.equal(normalizeSearch(' إِشْرَاقَةُ  '),'اشراقة');
 const p={id:'TSSEARCH',name:'Cream',brand:'TEST',details:{nameAr:'كريم ألوفيرا'}};
 assert.deepEqual(searchProducts([p],'كريـم الوْفيرا'),[p]);
 assert.deepEqual(searchProducts([p],'عطر'),[]);
 assert.deepEqual(searchProducts([p],' '),[p]);
});
test('Inline quantity changes respect inventory and per-order limits, and can remove the last piece',()=>{
 assert.equal(nextQuantity(1,1,24,true),2);
 assert.equal(nextQuantity(2,1,2,true),2);
 assert.equal(nextQuantity(10,1,24,true),10);
 assert.equal(nextQuantity(0,1,0,true),0);
 assert.equal(nextQuantity(1,-1,24,true),0);
});
test('An admin replacement photo takes precedence and galleries cannot repeat a primary photo',()=>{
 const p={id:'TSGALLERY',image_url:'/images/catalog/one.webp'};
 const galleries={TSGALLERY:{primary:p.image_url,images:[p.image_url,'/images/catalog/two.webp','/images/catalog/two.webp']}};
 assert.deepEqual(productGallery(p,galleries),[p.image_url,'/images/catalog/two.webp']);
 assert.deepEqual(productGallery({...p,image_url:'/media/uploads/2026-10/new.jpg'},galleries),['/media/uploads/2026-10/new.jpg']);
});
test('Every alternate product photo is reviewed, distinct, local, and belongs to a selected product',()=>{
 const galleries=JSON.parse(fs.readFileSync(new URL('../public/product-galleries.json',import.meta.url),'utf8'));
 const provenance=JSON.parse(fs.readFileSync(new URL('../data/gallery-provenance.json',import.meta.url),'utf8'));
 assert.ok(Object.keys(galleries).length>=10);
 for(const [id,gallery] of Object.entries(galleries)){
  const product=catalog.find(p=>p.id===id);assert.ok(product);assert.equal(gallery.primary,product.image);
  assert.equal(new Set([gallery.primary,...gallery.images]).size,gallery.images.length+1);
  for(const image of gallery.images){assert.ok(fs.existsSync(new URL('../public'+image,import.meta.url)));assert.ok(provenance.some(r=>r.product_id===id&&r.image===image&&r.source_page&&r.source_image));}
 }
});
