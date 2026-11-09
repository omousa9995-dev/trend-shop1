import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import worker,{_test} from '../src/worker.js';
import {mountProductStory,storyGallery} from '../public/product-story.js';
import {productGallery} from '../public/shop-tools.js';
import {PRODUCT_MEDIA_BASELINE} from '../src/product-media-baseline.js';
import {isKoreanCare} from '../public/korean-care.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=','base64');
test('Independent initial galleries retain exactly the reviewed photos previously displayed for every current product',()=>{
 const products=JSON.parse(read('public/catalog.json')),galleries=JSON.parse(read('public/product-galleries.json'));
 for(const p of products){const profile=isKoreanCare(p)?JSON.parse(read('public/product-stories/'+p.id+'.json')):null;assert.deepEqual(PRODUCT_MEDIA_BASELINE[p.id].map(x=>x.url),storyGallery(p,profile,productGallery(p,galleries)).map(x=>x.url),p.id)}
});
async function fixture(t){
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));sql.exec(read('db/migrations/0026_arencia_featured_video.sql'));
 for(const id of ['TS9001','TS9002'])sql.prepare("INSERT INTO products(id,name,brand,category,image_url,reference_price_fils,price_fils,stock,approved,active) VALUES(?,'Test product','Test','البشرة','/images/test-card.png',5000,3990,24,1,1)").run(id);
 const statement=(q,args=[])=>({bind:(...args)=>statement(q,args),all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args)||null,run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}}),execute:()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})});
 const values=new Map(),env={DB:{prepare:q=>statement(q),batch:async rows=>{sql.exec('BEGIN');try{const out=[];for(const r of rows)out.push(r.execute());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}},MEDIA:{get:async()=>null,put:async(k,v,o)=>values.set(k,{bytes:v,metadata:o?.metadata}),delete:async k=>values.delete(k)},ADMIN_PASSWORD_HASH:'configured',SESSION_SECRET:'private-product-media-fixture-not-production'};
 const cookie='ts_admin='+await _test.makeSession(env);t.after(()=>sql.close());
 const api=(path,options={})=>worker.fetch(new Request('https://trend.test'+path,{...options,headers:{cookie,...options.headers}}),env,{});
 const get=id=>api('/api/admin/product-photos?product='+id).then(r=>r.json());
 const mutate=data=>api('/api/admin/product-photos',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1'},body:JSON.stringify(data)});
 const upload=(id='TS9001',{uploadId=crypto.randomUUID(),bytes=png,type='image/png',headers={}}={})=>{const body=new FormData();body.append('product',id);body.append('uploadId',uploadId);body.append('image',new Blob([bytes],{type}),'photo.png');return api('/api/admin/product-photos',{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1',...headers},body})};
 return {sql,env,values,cookie,api,get,mutate,upload};
}
test('Multiple page photos append independently, survive card edits and product saves, and reach real product rendering',async t=>{
 const f=await fixture(t),before=f.sql.prepare('SELECT * FROM products').all();
 const a=await f.upload(),b=await f.upload();assert.equal(a.status,200);assert.equal(b.status,200);const state=await f.get('TS9001');assert.equal(state.photos.length,3);assert.equal(state.card,before[0].image_url);
 const p=before[0],saved=await f.api('/api/admin/products',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1'},body:JSON.stringify({...p,image_url:'/images/replacement-card.png'})});assert.equal(saved.status,200);
 const catalog=await(await f.api('/api/catalog')).json(),product=catalog.products.find(x=>x.id===p.id);assert.equal(product.image_url,'/images/replacement-card.png');assert.deepEqual(product.galleryPhotos,state.photos);assert.deepEqual(productGallery(product),state.photos.map(x=>x.url));assert.deepEqual(storyGallery(product,null).map(x=>x.url),state.photos.map(x=>x.url));
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());mountProductStory(dom.window.document.querySelector('main'),{product,cap:10,name:product.name,image:product.image_url});assert.equal(dom.window.document.querySelector('#storyMainImage').getAttribute('src'),state.photos[0].url);assert.equal(dom.window.document.querySelectorAll('[data-story-photo]').length,3);
 assert.equal(f.sql.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,24);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.deepEqual(f.sql.prepare('SELECT * FROM products WHERE id=?').get('TS9002'),before[1]);
});
test('Gallery removal and card replacement are separate; library removal clears both roles and keeps historical files',async t=>{
 const f=await fixture(t);let s=await f.get('TS9001');
 const removed=await f.mutate({productId:s.productId,revision:s.revision,action:'remove',scope:'gallery',url:s.card});assert.equal(removed.status,200);s=await removed.json();assert.equal(s.photos.length,0);assert.equal(s.card,'/images/test-card.png');
 await f.upload();s=await f.get('TS9001');const uploaded=s.photos[0].url;
 f.sql.prepare('UPDATE products SET image_url=? WHERE id=?').run(uploaded,'TS9001');
 const library=await(await f.api('/api/admin/media-library')).json(),g=library.groups.find(g=>g.productId==='TS9001');assert.equal(g.photos.length,1);assert.equal(g.photos[0].gallery,true);assert.equal(g.photos[0].card,true);
 const response=await f.mutate({productId:g.productId,revision:g.revision,action:'remove',scope:'all',url:uploaded,expectedCard:g.card});assert.equal(response.status,200);
 const after=await f.get('TS9001');assert.equal(after.photos.length,0);assert.equal(after.card,'/images/TS0001.svg');assert.equal(f.values.size,1,'binary remains available to existing invoice snapshots/shared uses');
 const product=(await(await f.api('/api/catalog')).json()).products.find(p=>p.id==='TS9001');assert.equal(storyGallery(product,null).some(x=>x.url===uploaded),false);
});
test('Upload retry IDs deduplicate; racing uploads and stale edits cannot replace another gallery or card',async t=>{
 const f=await fixture(t),uploadId=crypto.randomUUID();assert.equal((await f.upload('TS9001',{uploadId})).status,200);assert.equal((await f.upload('TS9001',{uploadId})).status,200);assert.equal(f.values.size,1);
 const stale=await f.get('TS9001');await f.upload();assert.equal((await f.mutate({productId:'TS9001',revision:stale.revision,action:'remove',scope:'all',url:stale.card,expectedCard:stale.card})).status,409);
 const s=await f.get('TS9001');f.sql.prepare('UPDATE products SET image_url=? WHERE id=?').run('/images/concurrent-card.png','TS9001');assert.equal((await f.mutate({productId:s.productId,revision:s.revision,action:'remove',scope:'all',url:s.photos[0].url,expectedCard:s.card})).status,409);
 let arrive=0,release;const gate=new Promise(r=>release=r),put=f.env.MEDIA.put;f.env.MEDIA.put=async(...args)=>{await put(...args);if(++arrive===2)release();await gate};
 const races=await Promise.all([f.upload('TS9002'),f.upload('TS9002')]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);assert.equal((await f.get('TS9002')).photos.length,2);assert.equal(f.values.size,3);
});
test('Photo routes require login and same origin, reject disguised/oversized uploads, missing/retired scope and forged actions',async t=>{
 const f=await fixture(t);for(const path of ['/api/admin/media-library','/api/admin/product-photos?product=TS9001'])assert.equal((await worker.fetch(new Request('https://trend.test'+path),f.env,{})).status,401);
 assert.equal((await f.upload('TS9001',{headers:{origin:'https://evil.test'}})).status,403);assert.equal((await f.upload('TS9001',{bytes:Buffer.from('<svg onload="run()">bad</svg>'),type:'image/png'})).status,415);
 assert.equal((await f.upload('TS9001',{bytes:Buffer.alloc(1536*1024+65537)})).status,413);assert.equal((await f.upload('TSMISSING')).status,404);assert.equal((await f.upload('TS0023')).status,404);
 assert.equal((await f.mutate({productId:'TS9001',revision:0,action:'remove',scope:'all',url:'javascript:alert(1)'})).status,400);assert.equal(f.values.size,0);
});
test('The 24-photo cap and complete reordering preserve order, other products and prices',async t=>{
 const f=await fixture(t);const photos=Array.from({length:23},(_,i)=>({url:'/images/test-'+i+'.png',kind:'pack'}));f.sql.prepare('INSERT INTO product_photo_galleries(product_id,photos_json,revision,change_token) VALUES(?,?,1,?)').run('TS9001',JSON.stringify(photos),'fixture');
 await f.upload();assert.equal((await f.upload()).status,409);let s=await f.get('TS9001');assert.equal(s.photos.length,24);assert.equal((await f.mutate({productId:s.productId,revision:s.revision,action:'reorder',urls:[s.photos[0].url]})).status,400);
 const urls=s.photos.map(x=>x.url).reverse();assert.equal((await f.mutate({productId:s.productId,revision:s.revision,action:'reorder',urls})).status,200);assert.deepEqual((await f.get('TS9001')).photos.map(x=>x.url),urls);assert.equal(f.sql.prepare('SELECT price_fils FROM products WHERE id=?').get('TS9001').price_fils,3990);
});
test('The media library includes both video locations and deleting each removes it from its real public endpoint',async t=>{
 const f=await fixture(t),a=crypto.randomUUID(),b=crypto.randomUUID();f.sql.prepare('INSERT INTO product_videos(id,product_id,media_key,mime,size) VALUES(?,?,?,?,?)').run(a,'TS9001','fixture-lower','video/mp4',128);f.sql.prepare('INSERT INTO product_featured_videos(id,product_id,media_key,mime,size) VALUES(?,?,?,?,?)').run(b,'TS9001','fixture-upper','video/mp4',128);
 const r=await f.api('/api/admin/media-library');assert.match(r.headers.get('cache-control'),/no-store/);const lib=await r.json(),g=lib.groups.find(g=>g.productId==='TS9001');assert.equal(g.videos.length,2);assert.equal(lib.totals.videos,2);assert.equal(JSON.stringify(lib).includes('media_key'),false);
 for(const [endpoint,id] of [['product-videos',a],['product-feature-video',b]]){const removed=await f.api('/api/admin/'+endpoint,{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1','content-type':'application/json'},body:JSON.stringify({productId:'TS9001',action:'remove',id})});assert.equal(removed.status,200)}
 assert.deepEqual((await(await f.api('/api/product-videos?product=TS9001')).json()).videos,[]);assert.equal((await(await f.api('/api/product-feature-video?product=TS9001')).json()).video,null);
});
test('Rerunning the additive migration preserves saved galleries and all commerce records',async t=>{
 const f=await fixture(t);await f.upload();const before=f.sql.prepare('SELECT * FROM product_photo_galleries').all(),products=f.sql.prepare('SELECT * FROM products').all();
 f.sql.exec(read('db/migrations/0028_product_photo_galleries.sql'));f.sql.exec(read('db/migrations/0028_product_photo_galleries.sql'));
 assert.deepEqual(f.sql.prepare('SELECT * FROM product_photo_galleries').all(),before);assert.deepEqual(f.sql.prepare('SELECT * FROM products').all(),products);
});
