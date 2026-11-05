import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import worker,{_test} from '../src/worker.js';
import {MAX_VIDEO_BYTES,sniffVideo,videoRange,videoSlice} from '../src/product-videos.js';
import {mountProductVideos} from '../public/product-videos.js';
import {loadProductStory,storyGallery,mountProductStory} from '../public/product-story.js';
const mp4=Buffer.alloc(128);mp4.writeUInt32BE(24,0);mp4.write('ftyp',4);mp4.write('isom',8);mp4.write('isom',16);mp4.write('mp42',20);mp4.writeUInt32BE(104,24);mp4.write('mdat',28);for(let n=32;n<128;n++)mp4[n]=n;
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 sql.exec("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES('TS0079','COSRX','Snail essence','البشرة',12000,7000,24,1,1),('TS0098','Arencia','Cleanser','البشرة',15000,11000,20,1,1)");
 const statement=(q,params=[])=>({bind:(...p)=>statement(q,p),all:async()=>({results:sql.prepare(q).all(...params)}),first:async()=>sql.prepare(q).get(...params)||null,run:async()=>({meta:{changes:Number(sql.prepare(q).run(...params).changes)}})});
 const values=new Map(),env={DB:{prepare:q=>statement(q)},MEDIA:{put:async(k,v)=>values.set(k,new Uint8Array(v)),get:async(k)=>values.has(k)?new Blob([values.get(k)]).stream():null,delete:async k=>values.delete(k)},SESSION_SECRET:'video-unit-fixture-secret-never-used-in-production',ADMIN_PASSWORD_HASH:'configured'};
 return {sql,env,values,close:()=>sql.close()};
}
async function upload(f,{bytes=mp4,type='video/mp4',product='TS0079',authenticated=true,origin='https://trend.test'}={}){
 const form=new FormData();form.append('product',product);form.append('video',new Blob([bytes],{type}),'../untrusted-filename.mp4');form.append('title','طريقة الاستخدام');form.append('titleEn','How to use');
 const cookie=authenticated?'ts_admin='+await _test.makeSession(f.env):'';
 return worker.fetch(new Request('https://trend.test/api/admin/product-videos',{method:'POST',headers:{origin,'x-trend-admin':'1',cookie},body:form}),f.env,{});
}
const api=(f,path,options={})=>worker.fetch(new Request('https://trend.test'+path,options),f.env,{});
async function action(f,body){return api(f,'/api/admin/product-videos',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1',cookie:'ts_admin='+await _test.makeSession(f.env)},body:JSON.stringify(body)});}
test('An authenticated direct video upload attaches to its product, preserves commerce and exposes no internal storage key',async t=>{
 const f=fixture();t.after(f.close);const before=f.sql.prepare('SELECT id,stock,price_fils FROM products ORDER BY id').all();
 const res=await upload(f);assert.equal(res.status,201);const body=await res.json();assert.match(body.video.url,/^\/product-videos\/[a-f0-9-]{36}$/);assert.equal(f.values.size,1);
 const publicData=await(await api(f,'/api/product-videos?product=TS0079')).json();assert.equal(publicData.videos.length,1);assert.equal(publicData.videos[0].titleEn,'How to use');assert.doesNotMatch(JSON.stringify(publicData),/media_key|product-videos\/TS0079|untrusted-filename/);
 assert.equal((await(await api(f,'/api/product-videos?product=TS0098')).json()).videos.length,0);assert.deepEqual(f.sql.prepare('SELECT id,stock,price_fils FROM products ORDER BY id').all(),before);assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,0);
});
test('Unauthenticated, cross-origin, retired and nonexistent product uploads cannot persist media',async t=>{
 const f=fixture();t.after(f.close);assert.equal((await upload(f,{authenticated:false})).status,401);assert.equal((await upload(f,{origin:'https://evil.test'})).status,403);assert.equal((await upload(f,{product:'TS9999'})).status,404);assert.equal((await upload(f,{product:'TS0023'})).status,400);assert.equal(f.values.size,0);
});
test('Sniffing rejects executable/image payloads and accepts real MP4, QuickTime and WebM container signatures',async t=>{
 const f=fixture();t.after(f.close);assert.equal((await upload(f,{bytes:Buffer.from('<html><script>alert(1)</script></html>')})).status,415);
 const avif=Buffer.from(mp4);avif.write('avif',8);assert.equal(sniffVideo(avif),null);
 const mov=Buffer.from(mp4);mov.write('qt  ',8);assert.equal(sniffVideo(mov).mime,'video/quicktime');assert.equal((await upload(f,{bytes:mov,type:'video/quicktime'})).status,201);
 const webm=new Uint8Array(64);webm.set([0x1a,0x45,0xdf,0xa3]);webm.set(new TextEncoder().encode('webm'),8);assert.equal(sniffVideo(webm).mime,'video/webm');
});
test('Upload limits count streamed bytes and three-product cap is enforced by SQLite even under duplicate attempts',async t=>{
 const f=fixture();t.after(f.close);const oversized=new Request('https://trend.test/api/admin/product-videos',{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1',cookie:'ts_admin='+await _test.makeSession(f.env),'content-type':'multipart/form-data; boundary=x'},body:new Uint8Array(MAX_VIDEO_BYTES+65537)});
 assert.equal((await worker.fetch(oversized,f.env,{})).status,413);assert.equal(f.values.size,0);
 for(let n=0;n<3;n++)assert.equal((await upload(f)).status,201);assert.equal((await upload(f)).status,400);assert.equal(f.values.size,3);assert.equal(f.sql.prepare('SELECT count(*) n FROM product_videos').get().n,3);
});
test('Playback supports byte/suffix ranges and HEAD while hidden products and hidden videos are immediately inaccessible',async t=>{
 const f=fixture();t.after(f.close);const video=(await(await upload(f)).json()).video;
 const full=await api(f,video.url);assert.equal(full.status,200);assert.deepEqual(Buffer.from(await full.arrayBuffer()),mp4);assert.equal(full.headers.get('content-type'),'video/mp4');
 const ranged=await api(f,video.url,{headers:{range:'bytes=20-39'}});assert.equal(ranged.status,206);assert.equal(ranged.headers.get('content-range'),'bytes 20-39/128');assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),mp4.subarray(20,40));
 const suffix=await api(f,video.url,{headers:{range:'bytes=-7'}});assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),mp4.subarray(121));
 const head=await api(f,video.url,{method:'HEAD',headers:{range:'bytes=0-15'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'128');assert.equal((await head.arrayBuffer()).byteLength,0);
 for(const range of ['bytes=999-','bytes=-0','bytes=9-3','bytes=0-1,3-4','not-range'])assert.equal((await api(f,video.url,{headers:{range}})).status,416);
 assert.equal((await action(f,{id:video.id,active:false})).status,200);assert.equal((await api(f,video.url)).status,404);assert.equal((await(await api(f,'/api/product-videos?product=TS0079')).json()).videos.length,0);
 assert.equal((await action(f,{id:video.id,active:true})).status,200);f.sql.exec("UPDATE products SET approved=0 WHERE id='TS0079'");assert.equal((await api(f,video.url)).status,404);
});
test('Removing a video releases its slot and media without altering product or order records',async t=>{
 const f=fixture();t.after(f.close);const v=(await(await upload(f)).json()).video;assert.equal((await action(f,{id:v.id,action:'remove'})).status,200);assert.equal(f.values.size,0);assert.equal((await api(f,v.url)).status,404);assert.equal(f.sql.prepare('SELECT stock FROM products WHERE id=?').get('TS0079').stock,24);
});
test('Range streaming bounds the returned slice and cancels the remainder',async()=>{
 let canceled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array([0,1,2,3]));c.enqueue(new Uint8Array([4,5,6,7]));},cancel(){canceled=true}});
 assert.deepEqual([...new Uint8Array(await new Response(videoSlice(stream,2,5)).arrayBuffer())],[2,3,4,5]);assert.equal(canceled,true);assert.equal(videoRange('bytes=-0',128),null);
});
test('A stalled optional enrichment request reaches its deadline and permits a later retry',async()=>{
 const p={id:'TS-LOAD-TEST',brand:'COSRX',name:'Deadline fixture'};let aborted=false;
 const result=await loadProductStory(p,(_,{signal})=>{signal.addEventListener('abort',()=>{aborted=true});return new Promise(()=>{})},{timeoutMs:10});assert.equal(result,null);assert.equal(aborted,true);
 const doc={id:p.id,brand:p.brand,productName:p.name,ar:{},en:{}};assert.deepEqual(await loadProductStory(p,async()=>Response.json(doc)),doc);
});
test('An empty video registry never adds a video or an empty customer section; uploaded media sits after usage',async()=>{
 const dom=new JSDOM('<main id="app"></main>',{url:'https://trend.test'});dom.window.HTMLMediaElement.prototype.play=async()=>{};dom.window.HTMLMediaElement.prototype.pause=()=>{};const root=dom.window.document.querySelector('main');const p=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url))).find(x=>x.id==='TS0079');const profile=JSON.parse(fs.readFileSync(new URL('../public/product-stories/TS0079.json',import.meta.url)));
 mountProductStory(root,{product:p,name:p.name,profile,cap:10,live:true});const region=root.querySelector('[data-product-videos]');assert.ok(root.querySelector('#storyHow').compareDocumentPosition(region)&4);
 await mountProductVideos(region,{productId:p.id,fetcher:async()=>Response.json({videos:[]})});assert.equal(region.hidden,true);assert.equal(root.querySelector('video'),null);
 await mountProductVideos(region,{productId:p.id,fetcher:async()=>Response.json({videos:[{id:'00000000-0000-4000-8000-000000000000',url:'/product-videos/00000000-0000-4000-8000-000000000000',mime:'video/mp4',title:'مرحلة الاستخدام'}]})});assert.equal(region.hidden,false);const video=region.querySelector('video');assert.equal(video.preload,'metadata');assert.equal(video.autoplay,true);assert.equal(video.loop,true);assert.equal(video.muted,true);assert.equal(video.controls,true);assert.equal(video.width/video.height,9/16);dom.window.close();
});

test('Only Aqua-Fresh accepts presentation edits, exposes its cover and keeps pricing, stock and other uploads unchanged',async t=>{
 const f=fixture();t.after(f.close);f.sql.exec("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES('TS0081','Beauty of Joseon','Aqua-Fresh','البشرة',10950,5490,24,1,1)");
 const pilot=(await(await upload(f,{product:'TS0081'})).json()).video,other=(await(await upload(f)).json()).video;
 const before=f.sql.prepare('SELECT id,price_fils,stock FROM products ORDER BY id').all();
 const body={id:pilot.id,productId:'TS0081',action:'presentation',title:'القوام عن قرب',titleEn:'Texture up close',poster:'/images/catalog/TS0081-6d2d6b7dbd3c.jpg'};
 assert.equal((await action(f,body)).status,200);
 const data=(await(await api(f,'/api/product-videos?product=TS0081')).json()).videos[0];assert.equal(data.poster,body.poster);assert.equal(data.title,body.title);assert.equal(data.sortOrder,0);
 assert.equal((await action(f,{...body,id:other.id})).status,404);assert.equal((await action(f,{...body,productId:'TS0079'})).status,400);
 for(const poster of ['https://evil.example/p.jpg','/images/../admin.html','javascript:alert(1)'])assert.equal((await action(f,{...body,poster})).status,400);
 const otherRow=(await(await api(f,'/api/product-videos?product=TS0079')).json()).videos[0];assert.equal('poster' in otherRow,false);assert.deepEqual(f.sql.prepare('SELECT id,price_fils,stock FROM products ORDER BY id').all(),before);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,0);
});
test('Reordering requires the exact complete pilot list and changes only that product in one statement',async t=>{
 const f=fixture();t.after(f.close);f.sql.exec("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES('TS0081','Beauty of Joseon','Aqua-Fresh','البشرة',10950,5490,24,1,1)");
 const first=(await(await upload(f,{product:'TS0081'})).json()).video,second=(await(await upload(f,{product:'TS0081'})).json()).video,other=(await(await upload(f)).json()).video;
 const body={action:'reorder',productId:'TS0081',ids:[second.id,first.id]};assert.equal((await action(f,body)).status,200);
 assert.deepEqual((await(await api(f,'/api/product-videos?product=TS0081')).json()).videos.map(v=>v.id),body.ids);
 assert.equal((await action(f,{...body,ids:[first.id]})).status,409);assert.equal((await action(f,{...body,ids:[first.id,other.id]})).status,409);assert.equal((await action(f,{...body,ids:[first.id,first.id]})).status,400);
 assert.equal((await action(f,{...body,productId:'TS0079',ids:[other.id]})).status,400);assert.equal(f.sql.prepare('SELECT sort_order FROM product_videos WHERE id=?').get(other.id).sort_order,0);
});
test('The pilot presentation and ordering endpoints require the existing authenticated same-origin admin session',async t=>{
 const f=fixture();t.after(f.close);const body={action:'reorder',productId:'TS0081',ids:['00000000-0000-4000-8000-000000000001']};
 assert.equal((await api(f,'/api/admin/product-videos',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1'},body:JSON.stringify(body)})).status,401);
 assert.equal((await api(f,'/api/admin/product-videos',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json','x-trend-admin':'1',cookie:'ts_admin='+await _test.makeSession(f.env)},body:JSON.stringify(body)})).status,403);
});
