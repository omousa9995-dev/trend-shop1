import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {mountProductStory} from '../public/product-story.js';
import {mountProductVideos} from '../public/product-videos.js';
import {createAquaFreshRail,mountAquaFreshPilot} from '../public/aqua-fresh-pilot.js';
import {validVideoPoster} from '../public/product-video-presentation.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';
import {createProductVideoManager} from '../public/product-videos-admin.js';

const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const catalog=read('public/catalog.json'),product=catalog.find(p=>p.id==='TS0081'),profile=read('public/product-stories/TS0081.json');
const clip=n=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,productId:'TS0081',url:`/product-videos/00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,mime:'video/mp4',title:`لقطة ${n}`,titleEn:`Moment ${n}`,poster:profile.images[0].url});
function setup({reduced=false,overflow=''}={}){
  setLocale('ar');const dom=new JSDOM('<main id="app"></main>',{url:'https://trend.test/#/product/TS0081',pretendToBeVisual:true});
  const {window}=dom,doc=window.document,played=[],paused=[],observations=[];let motionListener;
  window.matchMedia=()=>({matches:reduced,addEventListener:(_,fn)=>{motionListener=fn},removeEventListener(){}});
  window.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true';};
  window.HTMLMediaElement.prototype.play=function(){played.push(this);return Promise.resolve();};
  window.HTMLMediaElement.prototype.pause=function(){paused.push(this);};
  window.HTMLMediaElement.prototype.load=()=>{};
  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
  window.IntersectionObserver=class{constructor(callback){this.callback=callback;observations.push(this);this.elements=[];}observe(el){this.elements.push(el);}disconnect(){this.disconnected=true;}};
  doc.body.style.overflow=overflow;
  const root=doc.querySelector('main');mountProductStory(root,{product,name:product.name,profile,cap:24,live:true});
  const region=root.querySelector('[data-product-videos]'),rail=region.aquaFreshRail;
  return {dom,window,doc,root,region,rail,played,paused,observations,close(){rail.destroy();dom.window.close();}};
}
const pointer=(window,type,x,y)=>{const e=new window.Event(type,{bubbles:true});Object.assign(e,{clientX:x,clientY:y,button:0,isPrimary:true});return e;};

test('The product experience leaves the original pack first and has useful real photos before a video is uploaded',t=>{
  const f=setup();t.after(()=>f.close());assert.ok(f.root.querySelector('.aqua-fresh-pilot'));
  assert.equal(f.root.querySelector('#storyMainImage').getAttribute('src'),product.image||product.image_url);
  assert.equal(f.region.hidden,false);assert.equal(f.region.querySelectorAll('[data-aqua-card]').length,2);assert.equal(f.region.querySelectorAll('video').length,0);
  assert.ok(f.root.querySelector('#storyHow').compareDocumentPosition(f.region)&4);
  assert.equal(f.root.querySelectorAll('[name="storyOffer"]').length,2);assert.match(f.root.querySelector('.aqua-hero-price').textContent,/5\.49/);
  assert.equal(f.root.querySelectorAll('.aqua-ingredient-cards>div').length,2);
  assert.equal(mountAquaFreshPilot(f.root,{product:{id:'INVALID'}}),null);
  assert.equal(createAquaFreshRail(f.region,{product:{id:'INVALID'}}),null);
  assert.equal(f.root.querySelectorAll('.aqua-hero-price').length,1);
});
test('A failed or empty optional video request keeps the pilot photos usable',async t=>{
  const f=setup();t.after(()=>f.close());
  await mountProductVideos(f.region,{productId:'TS0081',fetcher:async()=>Response.json({videos:[]})});
  await mountProductVideos(f.region,{productId:'TS0081',fetcher:async()=>new Response('unavailable',{status:503})});
  assert.equal(f.region.hidden,false);assert.equal(f.region.querySelectorAll('[data-aqua-card]').length,2);
  f.region.querySelector('[data-aqua-card]').click();assert.ok(f.doc.querySelector('dialog[open] img'));
});
test('Uploaded clips stay in three fixed lower frames, belong to the selected product and never enter the photo gallery',async t=>{
 const f=setup();t.after(()=>f.close());await mountProductVideos(f.region,{productId:'TS0081',fetcher:async()=>Response.json({videos:[clip(1),{...clip(2),productId:'TS0065'}]})});
 assert.equal(f.region.querySelectorAll('[data-aqua-card]').length,2);assert.equal(f.region.querySelectorAll('video').length,1);assert.equal(f.root.querySelectorAll('.touch-media-thumbs .media-video-thumb').length,0);assert.match(f.region.querySelector('figcaption').textContent,/لقطة 1/);
 f.rail.setVideos([{...clip(2),url:'https://other.example/clip.mp4'}]);assert.equal(f.region.querySelectorAll('video').length,0);
});

test('Previews load only near the viewport, play silently, loop and pause when they leave view',t=>{
  const f=setup();t.after(()=>f.close());f.rail.setVideos([clip(1)]);
  const observer=f.observations.at(-1),video=f.region.querySelector('video');assert.equal(video.preload,'none');assert.equal(video.getAttribute('src'),null);assert.equal(video.muted,true);assert.equal(video.loop,true);
  observer.callback([{target:video,isIntersecting:true,intersectionRatio:.7}]);assert.equal(video.getAttribute('src'),clip(1).url);assert.ok(f.played.includes(video));
  observer.callback([{target:video,isIntersecting:false,intersectionRatio:0}]);assert.ok(f.paused.includes(video));
});
test('The approved silent loop remains inline without opening a player, including on reduced-motion devices',t=>{
 const f=setup({reduced:true});t.after(()=>f.close());f.rail.setVideos([clip(1)]);const video=f.region.querySelector('video');f.observations.at(-1).callback([{target:video,isIntersecting:true}]);
 assert.equal(video.getAttribute('src'),clip(1).url);assert.equal(video.controls,false);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.ok(f.played.includes(video));f.region.querySelector('.product-silent-video-frame').click();assert.equal(f.doc.querySelector('dialog[open]'),null);
});

test('The viewer opens a real photo, traps focus, navigates with the keyboard and restores focus and prior scroll locking on Escape',t=>{
  const f=setup({overflow:'clip'});t.after(()=>f.close());const opener=f.region.querySelector('[data-aqua-card]');opener.click();
  const dialog=f.doc.querySelector('dialog'),first=dialog.querySelector('[data-aqua-close]'),last=dialog.querySelector('[data-aqua-choose]');
  assert.equal(dialog.open,true);assert.equal(f.doc.body.style.overflow,'hidden');assert.equal(f.doc.activeElement,first);
  first.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,last);
  last.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,first);
  first.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(dialog.querySelector('[data-aqua-counter]').textContent,'2 / 2');
  first.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(dialog.open,false);assert.equal(f.doc.activeElement,opener);assert.equal(f.doc.body.style.overflow,'clip');
});
test('Lower video frames have no open, zoom, playback, sound or seeking actions',t=>{
 const f=setup();t.after(()=>f.close());f.rail.setVideos([clip(1),clip(2)]);
 for(const frame of f.region.querySelectorAll('.product-silent-video-frame')){frame.click();frame.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(frame.querySelectorAll('button,a,input').length,0);const video=frame.querySelector('video');assert.equal(video.controls,false);assert.equal(video.disablePictureInPicture,true);assert.equal(video.tabIndex,-1);assert.equal(video.muted,true);}
 assert.equal(f.doc.querySelector('dialog[open]'),null);
});

test('Choosing a quantity from the viewer returns to the existing purchase controls without adding anything or submitting an order',t=>{
  const f=setup();t.after(()=>f.close());f.region.querySelector('[data-aqua-card]').click();f.doc.querySelector('[data-aqua-choose]').click();
  assert.equal(f.doc.querySelector('dialog').open,false);assert.equal(f.doc.body.style.overflow,'');assert.equal(f.root.querySelector('#storyPurchase').dataset.scrolled,'true');
  assert.equal(f.root.querySelector('[name="storyOffer"]:checked').value,'1');assert.equal(f.doc.activeElement,f.root.querySelector('[name="storyOffer"]:checked'));
});
test('A maximum of three fixed silent clips preserves saved ordering and keeps photo enlargement separate',t=>{
 const f=setup();t.after(()=>f.close());f.rail.setVideos([clip(1),clip(2),clip(3),clip(4)]);assert.equal(f.region.querySelectorAll('.product-silent-video-frame').length,3);
 assert.deepEqual([...f.region.querySelectorAll('figcaption')].map(x=>x.textContent),['لقطة 1','لقطة 2','لقطة 3']);assert.equal(f.region.querySelector('[data-aqua-video-tools]'),null);
 f.region.querySelector('[data-aqua-card]').click();assert.ok(f.doc.querySelector('dialog[open] img'));assert.equal(f.doc.querySelector('dialog video'),null);
});

test('Navigation cleanup removes the viewer, pauses media and disconnects observers',()=>{
  const f=setup();f.rail.setVideos([clip(1)]);const observer=f.observations.at(-1);f.region.querySelector('[data-aqua-card]').click();f.rail.destroy();
  assert.equal(f.doc.querySelector('.aqua-media-dialog'),null);assert.equal(f.doc.body.style.overflow,'');assert.equal(observer.disconnected,true);assert.equal(f.region.aquaFreshRail,null);f.dom.window.close();
});
test('English pilot content and captions use the same product, price and quantities',t=>{
  const f=setup();t.after(()=>{setLocale('ar');f.close();});f.rail.destroy();setLocale('en');
  mountProductStory(f.root,{product,name:product.name,profile,cap:24,live:true});const rail=f.root.querySelector('[data-product-videos]').aquaFreshRail;
  assert.match(f.root.querySelector('.aqua-hero-price').textContent,/5\.49 JOD/);assert.match(f.root.querySelector('.aqua-showcase h2').textContent,/closer look/);
  assert.equal(f.root.querySelectorAll('[name="storyOffer"]').length,2);assert.match(f.root.querySelector('.aqua-ingredient-cards').textContent,/Rice seed water/);rail.destroy();
});
test('Video covers accept bounded local image paths and reject executable, remote and traversal paths',()=>{
  for(const path of ['',profile.primary,profile.images[0].url,'/media/uploads/2026-11/abc.webp'])assert.equal(validVideoPoster(path),true,path);
  for(const path of ['https://other.example/p.jpg','javascript:alert(1)','/images/../admin.html','/media/./foo.jpg','/media/x.svg','/media/x.png?redirect=1',null])assert.equal(validVideoPoster(path),false,String(path));
});
test('The pilot copy migration changes one product, preserves prices, stock and other products, is repeatable and respects concurrent owner edits',()=>{
  const data=read('data/aqua-fresh-pilot-v42.json'),sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const insert=sql.prepare("INSERT INTO products(id,brand,name,category,description,details_json,reference_price_fils,price_fils,stock) VALUES(?,?,?,?,?,?,?,?,?)");
  insert.run('TS0081','Beauty of Joseon',product.name,'البشرة',data.before.description,data.before.details_json,10950,5490,17);insert.run('TS0065','Other','Unchanged','البشرة','Owner text','{}',9000,5000,3);
  const migration=fs.readFileSync(new URL('../db/migrations/0024_aqua_fresh_pilot_copy.sql',import.meta.url),'utf8');sql.exec(migration);
  assert.equal(sql.prepare("SELECT changes() n").get().n,1);assert.equal(sql.prepare("SELECT description FROM products WHERE id='TS0081'").get().description,data.description);
  assert.deepEqual({...sql.prepare("SELECT price_fils,reference_price_fils,stock FROM products WHERE id='TS0081'").get()},{price_fils:5490,reference_price_fils:10950,stock:17});assert.equal(sql.prepare("SELECT description FROM products WHERE id='TS0065'").get().description,'Owner text');
  sql.exec(migration);assert.equal(sql.prepare('SELECT changes() n').get().n,0);
  sql.prepare("UPDATE products SET description=?,details_json=? WHERE id='TS0081'").run('Concurrent owner update',data.before.details_json);sql.exec(migration);assert.equal(sql.prepare("SELECT description FROM products WHERE id='TS0081'").get().description,'Concurrent owner update');sql.close();
});
test('The additive migration preserves existing uploads and works with the upgraded public video shape',()=>{
  const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE product_videos(id TEXT, product_id TEXT, title TEXT); INSERT INTO product_videos VALUES('existing','TS0065','Owner upload')");
  sql.exec(fs.readFileSync(new URL('../db/migrations/0023_aqua_fresh_video_presentation.sql',import.meta.url),'utf8'));
  assert.deepEqual({...sql.prepare('SELECT * FROM product_videos').get()},{id:'existing',product_id:'TS0065',title:'Owner upload',poster_url:'',sort_order:0});sql.close();
});
test('The admin pilot can save a chosen cover and reorder real uploaded clips while other products keep their existing editor',async()=>{
  const dom=new JSDOM(`<section id="productVideoPanel"><input data-video-file type="file"/><input data-video-title/><input data-video-title-en/><p data-video-status></p><button data-video-upload></button><div data-video-list></div></section>`),doc=dom.window.document;
  dom.window.HTMLMediaElement.prototype.pause=()=>{};const calls=[],rows=[{...clip(1),active:true,bytes:128},{...clip(2),active:true,bytes:128}];
  const manager=createProductVideoManager({root:doc,call:async(path,method,data)=>{calls.push({path,method,data});return {videos:rows};}});
  await manager.select({...product,image_url:profile.primary});assert.equal(doc.querySelectorAll('[data-aqua-video-editor]').length,2);
  const editor=doc.querySelector('[data-aqua-video-editor]');editor.querySelector('[data-presentation-title]').value='غلافي الخاص';editor.querySelector('[data-presentation-poster]').value=profile.images[0].url;await editor.querySelector('[data-save-presentation]').onclick();
  assert.equal(calls.find(x=>x.data?.action==='presentation').data.poster,profile.images[0].url);assert.equal(calls.find(x=>x.data?.action==='presentation').data.title,'غلافي الخاص');
  await doc.querySelector('[data-video-move="1"]').onclick();assert.deepEqual(calls.find(x=>x.data?.action==='reorder').data.ids,[clip(2).id,clip(1).id]);
  await manager.select({id:'TS0065'});assert.equal(doc.querySelectorAll('[data-aqua-video-editor]').length,2);manager.cancel();dom.window.close();
});
