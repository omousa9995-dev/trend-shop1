import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createProductPhotoManager} from '../public/product-photos-admin.js';
import {createMediaLibrary} from '../public/media-library-admin.js';
const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,3))}assert.ok(fn(),'expected media UI state')}
function page(t){const dom=new JSDOM(html,{url:'https://trend.test/admin.html'});t.after(()=>dom.window.close());return dom.window.document}
const initial=id=>({productId:id,revision:0,card:'/images/card.png',photos:[{url:'/images/original.png'}],maxPhotos:24});
test('The iPhone page picker accepts multiple images and uploads each sequentially without writing the card field',async t=>{
 const d=page(t),requests=[],uploads=[],states=new Map([['TS9001',initial('TS9001')]]);d.querySelector('[name=image_url]').value='/images/card.png';
 const m=createProductPhotoManager({root:d,call:async path=>{requests.push(path);return structuredClone(states.get(path.split('=').at(-1)))},prepare:async file=>{uploads.push(file.name);return new Blob(['prepared'],{type:'image/jpeg'})},fetcher:async(url,options)=>{const id=options.body.get('product'),state=states.get(id);assert.equal(url,'/api/admin/product-photos');assert.equal(options.headers['x-trend-admin'],'1');assert.ok(options.body.get('uploadId'));state.photos.push({url:'/images/upload-'+state.photos.length+'.jpg'});state.revision++;return {ok:true,json:async()=>structuredClone(state)}}});
 await m.select({id:'TS9001'});const input=d.querySelector('[data-photo-files]');assert.equal(input.multiple,true);assert.equal(input.accept,'image/*');Object.defineProperty(input,'files',{configurable:true,value:[{name:'iphone1.heic'},{name:'iphone2.jpeg'},{name:'iphone3.png'}]});
 await d.querySelector('[data-upload-photos]').onclick();assert.deepEqual(uploads,['iphone1.heic','iphone2.jpeg','iphone3.png']);assert.equal(d.querySelectorAll('.admin-photo-card').length,4);assert.equal(d.querySelector('[name=image_url]').value,'/images/card.png');assert.equal(m.busy,false);assert.match(d.querySelector('[data-photo-status]').textContent,/أُضيفت 3/);
});
test('Changing products during image preparation cancels the old batch and prevents attaching a photo to the next product',async t=>{
 const d=page(t);let finish;const sent=[];const m=createProductPhotoManager({root:d,call:async path=>initial(path.split('=').at(-1)),prepare:()=>new Promise(r=>finish=r),fetcher:async(...args)=>sent.push(args)});
 await m.select({id:'TS9001'});Object.defineProperty(d.querySelector('[data-photo-files]'),'files',{value:[{name:'iphone.jpg'}]});const pending=d.querySelector('[data-upload-photos]').onclick();assert.equal(m.busy,true);await m.select({id:'TS9002'});finish(new Blob(['prepared']));await pending;assert.equal(sent.length,0);assert.equal(m.busy,false);assert.equal(d.querySelectorAll('.admin-photo-card').length,1);
});
test('A failed second photo keeps the first saved photo and reports partial progress without silently retrying',async t=>{
 const d=page(t),state=initial('TS9001');let uploads=0;
 const m=createProductPhotoManager({root:d,call:async()=>structuredClone(state),prepare:async()=>new Blob(['photo']),fetcher:async()=>{uploads++;if(uploads===2)throw Error('انقطاع اتصال تجريبي');state.photos.push({url:'/images/uploaded.jpg'});return {ok:true,json:async()=>structuredClone(state)}}});
 await m.select({id:'TS9001'});Object.defineProperty(d.querySelector('[data-photo-files]'),'files',{value:[{name:'one.jpg'},{name:'two.jpg'},{name:'three.jpg'}]});await d.querySelector('[data-upload-photos]').onclick();assert.equal(uploads,2);assert.equal(d.querySelectorAll('.admin-photo-card').length,2);assert.match(d.querySelector('[data-photo-status]').textContent,/اكتمل رفع 1 من 3/);assert.equal(m.busy,false);
});
test('Gallery-only removal and reordering send the saved revision and never save product card data',async t=>{
 const d=page(t),state={...initial('TS9001'),revision:8,photos:[{url:'/images/one.png'},{url:'/images/two.png'}]},sent=[];
 const m=createProductPhotoManager({root:d,call:async(path,method,data)=>{if(data){sent.push(data);state.revision++;if(data.action==='remove')state.photos=state.photos.filter(p=>p.url!==data.url);else state.photos=data.urls.map(url=>({url}))}return structuredClone(state)}});
 await m.select({id:'TS9001'});await d.querySelector('[data-photo-move="1"]').onclick();assert.equal(sent[0].revision,8);assert.deepEqual(sent[0].urls,['/images/two.png','/images/one.png']);await d.querySelector('[data-remove-photo="0"]').onclick();assert.equal(sent[1].scope,'gallery');assert.equal(sent[1].revision,9);assert.equal(sent[1].url,'/images/two.png');assert.equal('image_url' in sent[1],false);
});
test('The searchable media library shows totals and both video locations; removal reloads the source and updates product associations',async t=>{
 const d=page(t),sent=[],changed=[];d.defaultView.confirm=()=>true;
 const g={productId:'TS9001',name:'صنف اختبار',brand:'ماركة',active:true,card:'/images/card.png',revision:2,photos:[{url:'/images/card.png',card:true,gallery:true}],videos:[{id:'lower',kind:'video',url:'/product-videos/lower',bytes:1024,active:true},{id:'upper',kind:'featured',url:'/product-feature-videos/upper',bytes:1024,active:true}]};
 const m=createMediaLibrary({root:d,onChange:id=>changed.push(id),call:async(path,method,data)=>{if(data){sent.push({path,data});if(path==='product-photos')g.photos=[];else g.videos=g.videos.filter(v=>v.id!==data.id)}return {groups:[structuredClone(g)]}}});
 await m.load();assert.match(d.querySelector('[data-media-totals]').textContent,/1 صورة · 2 فيديو/);assert.equal(d.querySelectorAll('video[playsinline][preload=none]').length,2);
 d.querySelector('[data-library-photo]').click();await until(()=>sent.length===1&&d.querySelectorAll('[data-library-photo]').length===0);assert.equal(sent[0].data.scope,'all');assert.equal(sent[0].data.expectedCard,'/images/card.png');assert.equal(d.querySelectorAll('[data-library-photo]').length,0);
 d.querySelector('[data-library-video="1"]').click();await until(()=>sent.length===2&&d.querySelectorAll('[data-library-video]').length===1);assert.equal(sent[1].path,'product-feature-video');assert.deepEqual(changed,['TS9001','TS9001']);
 const search=d.querySelector('[data-media-search]');search.value='غير موجود';search.oninput();assert.equal(d.querySelectorAll('[data-media-product]').length,0);search.value='TS9001';search.oninput();assert.equal(d.querySelectorAll('[data-media-product]').length,1);
});
