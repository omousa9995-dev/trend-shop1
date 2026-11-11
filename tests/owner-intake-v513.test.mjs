import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {productType} from '../public/product-types.js';
import {isKoreanCare} from '../public/korean-care.js';
import {storyGallery} from '../public/product-story.js';
import {mountReviews} from '../public/reviews.js';
import worker from '../src/worker.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),json=p=>JSON.parse(read(p));
const items=json('data/intake-2026-11-11/products.json');
test('The two owner-supplied items have separate appropriate sections, bilingual copy and no invented size or discount',()=>{
 const catalog=json('public/catalog.json');assert.equal(items.length,2);
 for(const p of items){assert.equal(catalog.filter(x=>x.id===p.id).length,1);assert.ok(p.details.nameAr&&p.details.en.description&&p.details.howToUse&&p.details.en.howToUse);assert.equal(p.details.size,'');assert.equal(p.priceFils,p.reference);assert.equal(p.discount,0);assert.equal(p.stock,24);assert.equal(isKoreanCare(p),false);assert.equal(p.galleryPhotos[0].kind,'pack');assert.ok(p.galleryPhotos.slice(1).every(x=>x.kind==='promotional'));assert.deepEqual(storyGallery(p,null).map(x=>x.url),p.galleryPhotos.map(x=>x.url));}
 assert.equal(productType(items[0]),'moisturizer');assert.equal(productType(items[1]),'body-cleansing');assert.equal(items[1].category,'الجسم');assert.match(items[1].description,/لا تعني وحدها/);assert.equal(items[0].priceFils,19990);assert.equal(items[1].priceFils,3990);
});
test('All seven owner-pack and promotional photos keep real image bytes, compact thumbnails and visible promotional metadata',()=>{
 const images=json('data/intake-2026-11-11/images.json'),promos=json('data/intake-2026-11-11/marketing.json').images;assert.equal(images.length,7);assert.equal(promos.length,5);
 for(const image of images){for(const path of [image.url,image.thumbnail]){assert.ok(existsSync(new URL('../public'+path,import.meta.url)));const b=readFileSync(new URL('../public'+path,import.meta.url));assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}assert.ok(image.width>=1000&&image.height>=1000);assert.ok(image.thumbnailBytes<image.bytes)}
 for(const p of promos){assert.ok(p.reference&&p.prompt&&p.generator&&p.visuallyReviewed);assert.ok(items.find(x=>x.id===p.id).galleryPhotos.some(x=>x.url===p.image&&x.kind==='promotional'))}
});
test('The new intake is additive and repeatable after a sale or owner edit, without creating any review',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(read('db/schema.sql'));db.exec(read('db/seed.sql'));const before=db.prepare('SELECT * FROM products ORDER BY id').all(),reviews=db.prepare('SELECT COUNT(*) n FROM reviews').get().n;
 db.exec(read('db/migrations/0029_owner_intake_2026_11_11.sql'));assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,before.length+2);
 db.prepare('UPDATE products SET stock=7,price_fils=18990 WHERE id=?').run('TS0360');db.exec(read('db/migrations/0029_owner_intake_2026_11_11.sql'));assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get('TS0360').stock,7);assert.equal(db.prepare('SELECT price_fils FROM products WHERE id=?').get('TS0360').price_fils,18990);
 for(const old of before)assert.deepEqual(db.prepare('SELECT * FROM products WHERE id=?').get(old.id),old);assert.equal(db.prepare('SELECT COUNT(*) n FROM reviews').get().n,reviews);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 }finally{db.close()}
});
test('Public pages contain no launch/price-approval or simulated-order success copy, and retain honest connection feedback',()=>{
 const source=['public/index.html','public/app.js','public/product-story.js','public/i18n.js'].map(read).join('\n');assert.doesNotMatch(source,/DEMO-|Demo preview|demo only|معاينة تجريبية|نسخة تجريبية|محاكاة تأكيد|الأسعار والخصومات المرجعية لم تعتمد|الطلبات الحقيقية غير مفع/);assert.match(read('public/app.js'),/response\.ok&&j\.orderId/);assert.match(read('public/app.js'),/Your details and bag are preserved/);
});
test('Genuine review cards retain a low rating and literal feedback while naming and linking the purchased product',async t=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({summary:{count:1,average:2},reviews:[{id:'review-fixture',product_id:'TS0360',product_name:'Actual product <tag>',product_brand:'Clinique',display_name:'اسم اختبار',rating:2,body:'A real critical review <script>never run</script>',governorate:'عمّان',created_at:'2026-11-11 10:00:00',images:[]}]});t.after(()=>globalThis.fetch=original);
 const dom=new JSDOM('<section></section>');t.after(()=>dom.window.close());const section=dom.window.document.querySelector('section');await mountReviews(section,{productId:'TS0360',allowSubmissions:false});assert.equal(section.hidden,false);assert.match(section.querySelector('.review-stars').textContent,/★★☆☆☆/);assert.match(section.querySelector('blockquote').textContent,/critical review/);assert.equal(section.querySelector('script'),null);assert.equal(section.querySelector('.review-product-name').getAttribute('href'),'#/product/TS0360');assert.match(section.querySelector('.review-product-name').textContent,/Actual product <tag>/);
});
