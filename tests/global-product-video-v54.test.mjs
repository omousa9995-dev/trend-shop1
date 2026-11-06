import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import worker,{_test} from '../src/worker.js';
import {mountProductStory,storyContent} from '../public/product-story.js';
import {mountFeaturedVideo} from '../public/product-featured-video.js';
import {mountProductVideos} from '../public/product-videos.js';
import {createFeaturedVideoManager} from '../public/product-featured-video-admin.js';
import {storefrontProducts} from '../public/catalog-policy.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=storefrontProducts(JSON.parse(read('public/catalog.json')));
function dom(){const d=new JSDOM('<main></main>',{url:'https://trend.test',pretendToBeVisual:true});const w=d.window;w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};return d;}
const clip=(productId,n,upper=false)=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,productId,url:`/${upper?'product-feature-videos':'product-videos'}/00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,mime:'video/mp4',title:'تفاصيل '+n,titleEn:'Detail '+n});

test('Every available catalog product retains its own content and images and gets the approved purchase layout',()=>{
 const d=dom(),root=d.window.document.querySelector('main');setLocale('ar');assert.ok(catalog.length>=300);
 try{for(const product of catalog){
  const path=new URL('../public/product-stories/'+product.id+'.json',import.meta.url),profile=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):null;
  root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();
  mountProductStory(root,{product,name:product.details?.nameAr||product.name,profile,cap:10,live:true,bundles:'<section class="product-bundles">old bundle</section>'});
  assert.equal(root.querySelectorAll('.arencia-service-row').length,3,product.id);assert.equal(root.querySelectorAll('[data-featured-video]').length,1,product.id);assert.equal(root.querySelectorAll('.arencia-extra-add').length,1,product.id);assert.equal(root.querySelector('.product-bundles'),null,product.id);
  assert.equal(root.querySelector('.story-lead').textContent,storyContent(product,profile).description,product.id);assert.equal(root.querySelector('#storyMainImage').getAttribute('src'),product.image||product.image_url,product.id);assert.equal(root.querySelectorAll('[name=storyOffer]').length,2,product.id);
  assert.equal(root.querySelector('.arencia-extra-add').disabled,false,product.id);
 }}finally{root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();d.window.close();}
});
test('All four video positions are silent and noninteractive, isolated by product and separate from photo zoom',async()=>{
 const d=dom(),root=d.window.document.querySelector('main'),product=catalog.find(p=>p.id==='TS0079');
 try{
  mountProductStory(root,{product,name:product.name,cap:10,live:true});const upper=root.querySelector('[data-featured-video]'),lower=root.querySelector('[data-product-videos]');
  await mountFeaturedVideo(upper,{productId:product.id,fetcher:async()=>Response.json({video:clip(product.id,9,true)})});
  await mountProductVideos(lower,{productId:product.id,fetcher:async()=>Response.json({videos:[clip(product.id,1),clip(product.id,2),clip(product.id,3),clip(product.id,4),clip('TS0098',5)]})});
  assert.equal(root.querySelectorAll('video').length,4);assert.equal(lower.querySelectorAll('video').length,3);assert.equal(root.querySelectorAll('.media-video-thumb').length,0);
  for(const video of root.querySelectorAll('video')){assert.equal(video.controls,false);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.autoplay,true);assert.equal(video.playsInline,true);assert.equal(video.width/video.height,9/16);assert.equal(video.disablePictureInPicture,true);assert.equal(video.closest('a,button'),null);video.parentElement.click();}
  assert.equal(d.window.document.querySelector('dialog[open]'),null);assert.equal(lower.querySelector('input[type=range]'),null);
 }finally{root.querySelector('[data-featured-video]')?.featuredVideo?.destroy();root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();d.window.close();}
});
test('Upper admin slots follow every saved product, prevent stale SKU responses, and keep previews in the admin only',async()=>{
 const d=new JSDOM(read('public/admin.html'),{url:'https://trend.test/admin.html'}),root=d.window.document;d.window.HTMLMediaElement.prototype.pause=()=>{};
 try{let complete;const manager=createFeaturedVideoManager({root,call:async path=>path.endsWith('TS0098')?new Promise(resolve=>{complete=resolve;}):{video:clip('TS0079',2,true)}});
  const pending=manager.select({id:'TS0098'});await manager.select({id:'TS0079'});complete({video:clip('TS0098',1,true)});await pending;
  assert.equal(root.querySelector('#productFeaturedVideoPanel').hidden,false);assert.match(root.querySelector('[data-featured-preview] video').getAttribute('src'),/000000000002$/);assert.equal(root.querySelector('[data-featured-preview] video').controls,true);assert.equal(root.querySelector('#productVideoPanel').hidden,false);
  await manager.select({id:'TS0023'});assert.equal(root.querySelector('#productFeaturedVideoPanel').hidden,true);manager.cancel();
 }finally{d.window.close();}
});
test('Generalized upper storage enforces one video per SKU without consuming any of its three lower slots',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));sql.exec("INSERT INTO products(id,brand,name,category,reference_price_fils,price_fils,stock,active,approved) VALUES('TS0079','COSRX','Essence','البشرة',12000,7000,24,1,1),('TS0098','Arencia','Cleanser','البشرة',13950,11000,24,1,1)");
 const statement=(q,params=[])=>({bind:(...p)=>statement(q,p),all:async()=>({results:sql.prepare(q).all(...params)}),first:async()=>sql.prepare(q).get(...params)||null,run:async()=>({meta:{changes:Number(sql.prepare(q).run(...params).changes)}})});
 const values=new Map(),env={DB:{prepare:q=>statement(q)},MEDIA:{put:async(k,v)=>values.set(k,new Uint8Array(v)),get:async k=>values.has(k)?new Blob([values.get(k)]).stream():null,delete:async k=>values.delete(k)},SESSION_SECRET:'global-video-test-secret-fixture-only',ADMIN_PASSWORD_HASH:'fixture'};
 const mp4=Buffer.alloc(128);mp4.writeUInt32BE(24,0);mp4.write('ftyp',4);mp4.write('isom',8);mp4.write('isom',16);mp4.write('mp42',20);
 const before=sql.prepare('SELECT * FROM products ORDER BY id').all(),cookie='ts_admin='+await _test.makeSession(env);
 const upload=async(product,path='product-feature-video',replaceId='')=>{const body=new FormData();body.append('product',product);body.append('video',new Blob([mp4],{type:'video/mp4'}),'test.mp4');body.append('replaceId',replaceId);return worker.fetch(new Request('https://trend.test/api/admin/'+path,{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1',cookie},body}),env,{});};
 try{
  const first=(await(await upload('TS0079')).json()).video,second=(await(await upload('TS0098')).json()).video;assert.equal(sql.prepare('SELECT count(*) n FROM product_featured_videos').get().n,2);
  assert.equal((await upload('TS0098','product-feature-video',first.id)).status,409);
  for(const product of ['TS0079','TS0098']){for(let i=0;i<3;i++)assert.equal((await upload(product,'product-videos')).status,201);assert.equal((await upload(product,'product-videos')).status,400);}
  for(const [id,video] of [['TS0079',first],['TS0098',second]]){const response=await worker.fetch(new Request('https://trend.test/api/product-feature-video?product='+id),env,{});assert.equal((await response.json()).video.id,video.id);assert.equal((await worker.fetch(new Request('https://trend.test'+video.url),env,{})).status,200);}
  assert.deepEqual(sql.prepare('SELECT * FROM products ORDER BY id').all(),before);assert.equal(sql.prepare('SELECT count(*) n FROM product_videos').get().n,6);
 }finally{sql.close();}
});
test('Bundle pages retain their contents and selectable options while receiving the service card and extra cart action',()=>{
 const d=dom(),root=d.window.document.querySelector('main');
 try{mountProductStory(root,{product:{id:'PROMOTEST-BUNDLE',brand:'Trend Shop',name:'Test bundle',_bundle:true,priceFils:9990,stock:4},name:'Test bundle',cap:4,live:true,bundles:'<section class="bundle-contents">two products</section>',options:'<select data-select-option><option>Tone</option></select>'});assert.ok(root.querySelector('.bundle-contents'));assert.ok(root.querySelector('[data-select-option]'));assert.equal(root.querySelectorAll('.arencia-service-row').length,3);assert.ok(root.querySelector('.arencia-extra-add'));assert.equal(root.querySelector('[data-featured-video]'),null);}finally{root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();d.window.close();}
});
