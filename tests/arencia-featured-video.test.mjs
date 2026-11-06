import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import worker,{_test} from '../src/worker.js';
import {mountProductStory,productStoryOffers} from '../public/product-story.js';
import {mountProductVideos} from '../public/product-videos.js';
import {mountFeaturedVideo} from '../public/product-featured-video.js';
import {createFeaturedVideoManager} from '../public/product-featured-video-admin.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mp4=Buffer.alloc(128);mp4.writeUInt32BE(24,0);mp4.write('ftyp',4);mp4.write('isom',8);mp4.write('isom',16);mp4.write('mp42',20);mp4.writeUInt32BE(104,24);mp4.write('mdat',28);
const clip={id:'00000000-0000-4000-8000-000000000001',productId:'TS0098',url:'/product-feature-videos/00000000-0000-4000-8000-000000000001',mime:'video/mp4',bytes:128};
function fixture(t){
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));sql.exec(read('db/migrations/0026_arencia_featured_video.sql'));
 sql.exec("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,approved,active) VALUES('TS0098','Arencia','Cleanser','البشرة',13950,11000,24,1,1),('TS0079','COSRX','Essence','البشرة',12000,7000,24,1,1)");
 const statement=(q,params=[])=>({bind:(...p)=>statement(q,p),all:async()=>({results:sql.prepare(q).all(...params)}),first:async()=>sql.prepare(q).get(...params)||null,run:async()=>({meta:{changes:Number(sql.prepare(q).run(...params).changes)}})});
 const values=new Map(),env={DB:{prepare:q=>statement(q)},MEDIA:{put:async(k,v)=>values.set(k,new Uint8Array(v)),get:async k=>values.has(k)?new Blob([values.get(k)]).stream():null,delete:async k=>values.delete(k)},SESSION_SECRET:'featured-video-test-secret-never-production',ADMIN_PASSWORD_HASH:'configured'};
 t.after(()=>sql.close());return {sql,env,values};
}
const api=(f,path,options={})=>worker.fetch(new Request('https://trend.test'+path,options),f.env,{});
async function upload(f,{path='product-feature-video',product='TS0098',replaceId='',origin='https://trend.test',authenticated=true,bytes=mp4,type='video/mp4'}={}){
 const form=new FormData();form.append('product',product);form.append('video',new Blob([bytes],{type}),'clip.mp4');form.append('replaceId',replaceId);
 return api(f,'/api/admin/'+path,{method:'POST',headers:{origin,'x-trend-admin':'1',...(authenticated?{cookie:'ts_admin='+await _test.makeSession(f.env)}:{})},body:form});
}
async function remove(f,id){return api(f,'/api/admin/product-feature-video',{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1','content-type':'application/json',cookie:'ts_admin='+await _test.makeSession(f.env)},body:JSON.stringify({action:'remove',productId:'TS0098',id})});}

test('The single upper slot uploads, replaces and deletes independently of all three lower videos and commerce',async t=>{
 const f=fixture(t),before=f.sql.prepare('SELECT * FROM products ORDER BY id').all();
 for(let i=0;i<3;i++)assert.equal((await upload(f,{path:'product-videos'})).status,201);
 const lower=f.sql.prepare('SELECT * FROM product_videos ORDER BY id').all();
 const first=await upload(f);assert.equal(first.status,201);const a=(await first.json()).video;
 assert.equal((await upload(f)).status,409);
 const replacement=await upload(f,{replaceId:a.id});assert.equal(replacement.status,201);const b=(await replacement.json()).video;assert.notEqual(a.id,b.id);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM product_featured_videos').get().n,1);
 assert.equal(f.values.size,4);assert.equal((await api(f,a.url)).status,404);
 const data=await(await api(f,'/api/product-feature-video?product=TS0098')).json();assert.equal(data.video.id,b.id);assert.doesNotMatch(JSON.stringify(data),/media_key|product-feature-videos\/TS0098/);
 assert.deepEqual((await(await api(f,'/api/product-videos?product=TS0098')).json()).videos.map(v=>v.id).sort(),lower.map(v=>v.id).sort());
 assert.equal((await remove(f,a.id)).status,409);assert.equal((await remove(f,b.id)).status,200);assert.equal((await api(f,b.url)).status,404);assert.equal(f.values.size,3);
 assert.deepEqual(f.sql.prepare('SELECT * FROM product_videos ORDER BY id').all(),lower);assert.deepEqual(f.sql.prepare('SELECT * FROM products ORDER BY id').all(),before);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
});
test('Simultaneous initial and replacement uploads leave one video with no orphan test media',async t=>{
 const f=fixture(t);
 const initial=await Promise.all([upload(f),upload(f)]);assert.deepEqual(initial.map(r=>r.status).sort(),[201,409]);assert.equal(f.values.size,1);
 const id=f.sql.prepare('SELECT id FROM product_featured_videos').get().id;
 const next=await Promise.all([upload(f,{replaceId:id}),upload(f,{replaceId:id})]);assert.deepEqual(next.map(r=>r.status).sort(),[201,409]);assert.equal(f.values.size,1);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM product_featured_videos').get().n,1);
});
test('The upper upload enforces authentication, same origin, valid product scope and file validation',async t=>{
 const f=fixture(t);
 assert.equal((await upload(f,{authenticated:false})).status,401);assert.equal((await upload(f,{origin:'https://evil.test'})).status,403);
 assert.equal((await upload(f,{product:'TS0023'})).status,400);assert.equal((await upload(f,{bytes:Buffer.from('<html>executable payload</html>')})).status,415);
 const tooLarge=new Request('https://trend.test/api/admin/product-feature-video',{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1',cookie:'ts_admin='+await _test.makeSession(f.env),'content-type':'multipart/form-data; boundary=x'},body:new Uint8Array(20*1024*1024+65537)});
 assert.equal((await worker.fetch(tooLarge,f.env,{})).status,413);assert.equal(f.values.size,0);
 assert.equal((await api(f,'/api/admin/product-feature-video?product=TS0098')).status,401);assert.equal((await api(f,'/api/product-feature-video?product=TS0023')).status,404);
});
test('Upper playback supports range and HEAD and follows product visibility without exposing lower video IDs',async t=>{
 const f=fixture(t),v=(await(await upload(f)).json()).video;
 const ranged=await api(f,v.url,{headers:{range:'bytes=20-39'}});assert.equal(ranged.status,206);assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),mp4.subarray(20,40));
 const head=await api(f,v.url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'128');assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await api(f,v.url,{headers:{range:'bytes=900-'}})).status,416);
 const lower=(await(await upload(f,{path:'product-videos'})).json()).video;assert.equal((await api(f,lower.url.replace('/product-videos/','/product-feature-videos/'))).status,404);
 f.sql.exec("UPDATE products SET approved=0 WHERE id='TS0098'");assert.equal((await api(f,v.url)).status,404);assert.equal((await(await api(f,'/api/product-feature-video?product=TS0098')).json()).video,null);
});
function page(t,id='TS0098',onAdd=()=>true){
 setLocale('ar');const dom=new JSDOM('<main></main>',{url:'https://trend.test',pretendToBeVisual:true}),w=dom.window;
 w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false});
 const root=w.document.querySelector('main'),p=JSON.parse(read('public/catalog.json')).find(p=>p.id===id),profile=JSON.parse(read('public/product-stories/'+id+'.json'));
 mountProductStory(root,{product:p,name:p.name,profile,cap:10,live:true,promotions:productStoryOffers,bundles:'<section class="product-bundles">bundle contents</section>',onAdd});
 t.after(()=>{root.querySelector('[data-featured-video]')?.featuredVideo?.destroy();root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();w.close();setLocale('ar');});return {root,w};
}
test('Arencia removes its bundle card, adds an independent upper slot and cart button using the selected quantity once',async t=>{
 const added=[],{root}=page(t,'TS0098',q=>added.push(q)),upper=root.querySelector('[data-featured-video]'),lower=root.querySelector('[data-product-videos]');
 assert.equal(root.querySelector('.product-bundles'),null);assert.ok(root.querySelector('.story-assurance').compareDocumentPosition(upper)&4);assert.ok(upper.compareDocumentPosition(root.querySelector('.arencia-extra-add'))&4);
 assert.equal(upper.hidden,true);assert.equal(root.querySelectorAll('[data-story-add]').length,2);assert.equal(root.querySelector('.arencia-extra-add').textContent,'أضيفي المنتج للسلة');
 root.querySelector('[name=storyOffer][value="2"]').click();root.querySelector('.arencia-extra-add').click();assert.deepEqual(added,[2]);assert.match(root.querySelector('.arencia-extra-add').textContent,/تمت إضافة/);
 const existingLower=lower.innerHTML;await mountFeaturedVideo(upper,{productId:'TS0098',fetcher:async()=>Response.json({video:clip})});assert.equal(lower.innerHTML,existingLower);
 const video=upper.querySelector('video');assert.ok(video);assert.equal(video.width/video.height,9/16);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.autoplay,true);assert.equal(video.playsInline,true);assert.equal(video.controls,false);assert.equal(video.tabIndex,-1);assert.equal(video.disablePictureInPicture,true);assert.equal(upper.querySelectorAll('button,a,input').length,0);
 await mountProductVideos(lower,{productId:'TS0098',fetcher:async()=>Response.json({videos:[]})});assert.equal(upper.querySelector('video'),video);assert.equal(lower.hidden,false);
});
test('Other products receive the same layout; empty or untrusted upper video results stay invisible',async t=>{
 const {root}=page(t,'TS0079');assert.equal(root.querySelector('.product-bundles'),null);assert.ok(root.querySelector('[data-featured-video]'));assert.ok(root.querySelector('.arencia-extra-add'));
 const region=root.ownerDocument.createElement('div');root.append(region);
 for(const video of [null,{...clip,url:'https://evil.test/video.mp4'},{...clip,productId:'TS0079'}]){await mountFeaturedVideo(region,{productId:'TS0098',fetcher:async()=>Response.json({video})});assert.equal(region.hidden,true);assert.equal(region.querySelector('video'),null);}
});
test('Leaving a product cancels a pending upper-video response before it can mount',async t=>{
 const {root}=page(t),region=root.querySelector('[data-featured-video]');let finish;
 const mounted=mountFeaturedVideo(region,{productId:'TS0098',fetcher:()=>new Promise(resolve=>{finish=resolve;})});region.featuredVideo.destroy();finish(Response.json({video:clip}));await mounted;assert.equal(region.querySelector('video'),null);assert.equal(region.hidden,true);
});
test('The admin has two distinct upload areas; the upper area follows the selected saved product and preserves stale-selection safety',async t=>{
 const dom=new JSDOM(read('public/admin.html'),{url:'https://trend.test/admin.html'}),w=dom.window;w.HTMLMediaElement.prototype.pause=()=>{};t.after(()=>w.close());const root=w.document,panel=root.querySelector('#productFeaturedVideoPanel'),lower=root.querySelector('#productVideoPanel');
 assert.match(panel.textContent,/فيديو واحد فقط/);assert.match(panel.textContent,/9:16/);assert.match(lower.textContent,/حتى 3 فيديوهات/);assert.equal(panel.querySelector('input[type=file]').multiple,false);
 let finish;const manager=createFeaturedVideoManager({root,call:()=>new Promise(resolve=>{finish=resolve;})});const pending=manager.select({id:'TS0098'});assert.equal(panel.hidden,false);assert.equal(panel.querySelector('[data-featured-upload]').disabled,true);
 await manager.select(null);finish({video:clip});await pending;assert.equal(panel.hidden,true);assert.equal(panel.querySelector('video'),null);assert.equal(lower.hidden,false);
});
test('Admin upload progress, replacement and cancel use the separate single-video endpoint',async t=>{
 const dom=new JSDOM(read('public/admin.html'),{url:'https://trend.test/admin.html'}),w=dom.window;w.HTMLMediaElement.prototype.pause=()=>{};t.after(()=>w.close());const root=w.document,panel=root.querySelector('#productFeaturedVideoPanel'),input=panel.querySelector('[data-featured-file]'),button=panel.querySelector('[data-featured-upload]'),requests=[];
 const original=globalThis.XMLHttpRequest;
 class XHR{constructor(){this.upload={};requests.push(this);}open(method,path){this.path=path;}setRequestHeader(){}send(form){this.form=form;}abort(){this.onabort?.();}}
 globalThis.XMLHttpRequest=XHR;t.after(()=>{globalThis.XMLHttpRequest=original;});
 const manager=createFeaturedVideoManager({root,call:async()=>({video:null})});await manager.select({id:'TS0098'});Object.defineProperty(input,'files',{configurable:true,value:[new File([mp4],'upper.mp4',{type:'video/mp4'})]});
 const uploading=button.onclick();assert.equal(manager.busy,true);assert.equal(requests[0].path,'/api/admin/product-feature-video');assert.equal(requests[0].form.get('replaceId'),'');requests[0].upload.onprogress({lengthComputable:true,loaded:1,total:2});assert.match(panel.querySelector('[data-featured-status]').textContent,/50%/);
 requests[0].status=201;requests[0].responseText=JSON.stringify({video:clip});requests[0].onload();await uploading;assert.equal(manager.busy,false);assert.match(button.textContent,/استبدال/);
 const replacing=button.onclick();assert.equal(requests[1].form.get('replaceId'),clip.id);manager.cancel();await replacing;assert.equal(manager.busy,false);
});
