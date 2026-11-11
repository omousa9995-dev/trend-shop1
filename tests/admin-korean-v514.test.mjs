import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';
import {isKoreanCare} from '../public/korean-care.js';
import {applyKoreanCareChoice,filterAdminProducts,publicationHint} from '../public/admin-product-tools.js';
import {DEFAULT_SITE_SETTINGS} from '../public/site-settings.js';
import {fallbackProductProfile} from '../public/product-profiles.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bundle=buildSync({entryPoints:[new URL('../public/admin.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
const product=(id,brand,extra={})=>({id,brand,name:'Sample serum',category:'البشرة',subcategory:'',description:'A description',reference_price_fils:5000,price_fils:4990,discount_percent:0,stock:24,approved:1,active:1,image_url:'/images/TS0001.svg',details_json:'{}',...extra});
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.ok(fn());}
async function editor(t,{failFirst=false}={}){
 const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(read('public/admin.html'),{url:'https://trend.test/admin.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,requests=[],products=[product('TSKOREA1','Anua',{details_json:JSON.stringify({nameAr:'تونر أنوا',en:{description:'Existing English copy'}})}),product('TSCUSTOM1','New Korean Brand',{stock:3,details_json:JSON.stringify({koreanCare:true,nameAr:'سيروم أرينسيا الجديد'})}),product('TSOTHER1','Clinique',{stock:0,approved:0})];
 let posts=0;w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};
 w.fetch=async(url,opts={})=>{
  url=String(url);requests.push({url,opts});let data={};
  if(url.endsWith('/products')&&opts.method==='POST'){
   const p=JSON.parse(opts.body);posts++;
   if(failFirst&&posts===1)throw Error('Connection interrupted');
   const saved={...p,details_json:JSON.stringify(p.details),approved:p.approved?1:0,active:p.active?1:0};delete saved.details;
   const at=products.findIndex(x=>x.id===p.id);if(at<0)products.push(saved);else products[at]=saved;data={ok:true,id:p.id};
  }else if(url.endsWith('/me'))data={authenticated:true,live:true};
  else if(url.includes('product-photos'))data={photos:[],revision:0,maxPhotos:24};
  else if(url.includes('product-videos'))data={videos:[]};
  else if(url.includes('product-feature-video'))data={video:null};
  else if(url.endsWith('/products'))data={products};
  else if(url.includes('orders'))data={orders:[]};
  else if(url.includes('promotions'))data={promotions:[]};
  else if(url.includes('site-settings'))data={settings:DEFAULT_SITE_SETTINGS,history:[]};
  return Response.json(data);
 };
 w.eval(bundle);await until(()=>d.querySelector('#productsBody [data-edit]'));return {w,d,requests,products,errors};
}
test('Explicit owner inclusion and exclusion work for arbitrary brands without reclassifying old collection tags',()=>{
 assert.equal(isKoreanCare({brand:'Anua'}),true);
 assert.equal(isKoreanCare({brand:'New Korean Brand',details:{koreanCare:true}}),true);
 assert.equal(isKoreanCare({brand:'Anua',details_json:'{"koreanCare":false}'}),false);
 assert.equal(isKoreanCare({brand:'Clinique',details:{collection:'k-beauty'}}),false);
 const original={koreanCare:true,en:{description:'Keep me'}};
 const auto=applyKoreanCareChoice(original,'auto','New Korean Brand');
 assert.equal(auto.koreanCare,undefined);assert.equal(auto.collection,'beauty');assert.equal(auto.en.description,'Keep me');assert.equal(original.koreanCare,true);
 assert.equal(applyKoreanCareChoice({},'include','New Korean Brand').collection,'k-beauty');
});
test('Arabic/name/ID search combines collection, category and stock filters',()=>{
 const rows=[product('TSCUSTOM1','New Korean Brand',{stock:3,details_json:'{"koreanCare":true,"nameAr":"سيروم أرينسيا"}'}),product('TSOTHER1','Clinique',{approved:0,stock:0}),product('TSHIDDEN1','Anua',{active:0})];
 assert.deepEqual(filterAdminProducts(rows,{query:'ارينسيا',collection:'korean',status:'low'}).map(x=>x.id),['TSCUSTOM1']);
 assert.deepEqual(filterAdminProducts(rows,{query:'tscustom1',category:'البشرة',status:'ready'}).map(x=>x.id),['TSCUSTOM1']);
 assert.deepEqual(filterAdminProducts(rows,{collection:'other',status:'draft'}).map(x=>x.id),['TSOTHER1']);
 assert.deepEqual(filterAdminProducts(rows,{status:'hidden'}).map(x=>x.id),['TSHIDDEN1']);
 assert.deepEqual(filterAdminProducts(rows,{status:'out'}).map(x=>x.id),['TSOTHER1']);
});
test('A new Korean product saves once, remains a draft, and immediately opens its independent photo tools',async t=>{
 const {w,d,requests,products,errors}=await editor(t);d.querySelector('[data-owner-korean]').click();
 const f=d.querySelector('#productForm');assert.equal(f.elements.koreanCare.value,'include');assert.equal(f.elements.stock.value,'24');assert.equal(f.elements.approved.checked,false);assert.equal(d.querySelector('[data-photo-files]').disabled,true);
 f.elements.name.value='New Korean Serum';f.elements.nameAr.value='سيروم كوري جديد';f.elements.brand.value='New Korean Brand';f.elements.priceJod.value='4.99';f.elements.referenceJod.value='5.00';f.elements['en-description'].value='An individual English description';
 f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:d.querySelector('#saveProductMedia')}));
 await until(()=>d.querySelector('#productSaveMessage').textContent.includes('حُفظ'));await until(()=>!d.querySelector('[data-photo-files]').disabled);
 const writes=requests.filter(x=>x.url.endsWith('/products')&&x.opts.method==='POST');assert.equal(writes.length,1);const sent=JSON.parse(writes[0].opts.body);
 assert.equal(sent.details.koreanCare,true);assert.equal(sent.details.en.description,'An individual English description');assert.equal(sent.approved,false);assert.equal(sent.stock,24);assert.match(sent.id,/^TS[A-F0-9]{8}$/);
 assert.equal(f.elements.id.value,sent.id);assert.equal(f.elements.koreanCare.value,'include');assert.equal(d.querySelector('#editorOverlay').hidden,false);assert.equal(d.querySelector('#previewProductLink').hidden,false);assert.equal(d.querySelector('[data-photo-files]').multiple,true);
 assert.ok(requests.some(x=>x.url.includes('product-photos?product='+sent.id)));assert.equal(products.filter(x=>x.id===sent.id).length,1);assert.deepEqual(errors,[]);
 const profile=fallbackProductProfile({...products.at(-1)});assert.equal(profile.ar.name,'سيروم كوري جديد');assert.equal(profile.en.description,'An individual English description');
});
test('A failed save preserves the new product ID and content for a deliberate retry',async t=>{
 const {w,d,requests,errors}=await editor(t,{failFirst:true});d.querySelector('#addKoreanProduct').click();const f=d.querySelector('#productForm');f.elements.name.value='Retry serum';f.elements.brand.value='New Korean Brand';f.elements.priceJod.value='4.99';f.elements.referenceJod.value='5';
 const submit=()=>f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:d.querySelector('#saveProductMedia')}));
 submit();await until(()=>d.querySelector('#editorError').textContent==='Connection interrupted');const id=f.elements.id.value;assert.ok(id);assert.equal(d.querySelector('#saveProductMedia').disabled,false);submit();await until(()=>d.querySelector('#productSaveMessage').textContent.includes('حُفظ'));
 const writes=requests.filter(x=>x.url.endsWith('/products')&&x.opts.method==='POST').map(x=>JSON.parse(x.opts.body));assert.equal(writes.length,2);assert.equal(writes[0].id,id);assert.equal(writes[1].id,id);assert.equal(f.elements.name.value,'Retry serum');assert.deepEqual(errors,[]);
});
test('Existing explicit collection choices survive editing, and owner filters do not write products',async t=>{
 const {w,d,requests,errors}=await editor(t);d.querySelector('#productCollectionFilter').value='korean';d.querySelector('#productCollectionFilter').dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelectorAll('#productsBody [data-edit]').length,2);d.querySelector('[data-edit=TSCUSTOM1]').click();assert.equal(d.querySelector('#productForm').elements.koreanCare.value,'include');d.querySelector('#cancelProductEdit').click();
 d.querySelector('#productStatusFilter').value='low';d.querySelector('#productStatusFilter').dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('#productsBody [data-edit]').length,1);
 d.querySelector('#clearProductFilters').click();assert.equal(d.querySelectorAll('#productsBody [data-edit]').length,3);assert.equal(requests.filter(x=>x.opts.method==='POST').length,0);assert.deepEqual(errors,[]);
});
test('The editor explains drafts, hidden products and sold-out stock without silently publishing',()=>{
 assert.match(publicationHint({active:true,approved:false,stock:24,korean:true}),/مسودة/);
 assert.match(publicationHint({active:false,approved:true,stock:24,korean:true}),/مخفي/);
 assert.match(publicationHint({active:true,approved:true,stock:0,korean:true}),/غير متوفر/);
 assert.match(publicationHint({active:true,approved:true,stock:24,korean:true}),/Korean care/);
});
test('Neither save action can save an old card image while the iPhone upload is in progress',async t=>{
 const {w,d,requests}=await editor(t);d.querySelector('#addKoreanProduct').click();const form=d.querySelector('#productForm');form.dataset.cardUploadBusy='true';
 for(const submitter of form.querySelectorAll('button[type=submit]'))form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter}));
 assert.equal(requests.filter(x=>x.opts.method==='POST').length,0);assert.match(d.querySelector('#editorError').textContent,/انتظر اكتمال/);
});
test('Card uploads lock both save buttons and a late upload cannot change the next editor',async t=>{
 const dom=new JSDOM('<form id="productForm"><input name="image_url" value="/images/old.svg"><input type="file" id="productImageFile"><p id="imageUploadStatus"></p><img id="imageUploadPreview" hidden><button type="submit">Save</button><button type="submit">Save and photos</button></form>',{url:'https://trend.test/admin.html',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,f=d.querySelector('form'),input=d.querySelector('input[type=file]');let finishUpload,started=false;
 w.URL.createObjectURL=()=> 'blob:test-card';w.URL.revokeObjectURL=()=>{};
 w.Image=class{set src(value){this.naturalWidth=1000;this.naturalHeight=1000;this.onload()}};
 w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['test image bytes'],{type:'image/jpeg'}))};
 w.fetch=async()=>{started=true;return await new Promise(resolve=>finishUpload=resolve)};w.eval(read('public/upload-image.js'));
 Object.defineProperty(input,'files',{configurable:true,value:[new w.File(['test'],'photo.jpg',{type:'image/jpeg'})]});input.dispatchEvent(new w.Event('change'));await until(()=>started);
 assert.equal(f.dataset.cardUploadBusy,'true');assert.ok([...f.querySelectorAll('button')].every(b=>b.disabled));
 f.reset();f.elements.image_url.value='/images/next-product.svg';finishUpload(Response.json({imageUrl:'/media/uploads/old-request.jpg'}));await new Promise(r=>setTimeout(r,10));
 assert.equal(f.elements.image_url.value,'/images/next-product.svg');assert.equal(f.dataset.cardUploadBusy,'false');assert.ok([...f.querySelectorAll('button')].every(b=>!b.disabled));assert.equal(d.querySelector('#imageUploadPreview').hidden,true);
});
test('Editing an existing product through category adds Korean care while keeping its skincare category, type and inventory',async t=>{
 const {w,d,requests,products,errors}=await editor(t);d.querySelector('[data-edit=TSOTHER1]').click();await until(()=>!d.querySelector('[data-photo-files]').disabled);
 const f=d.querySelector('#productForm');f.elements.productType.value='serum';f.elements.category.value='korean-care:البشرة';f.elements.category.dispatchEvent(new w.Event('change'));
 assert.equal(f.elements.koreanCare.value,'include');assert.equal(f.elements.productType.value,'serum');assert.match(d.querySelector('#productCategoryHelp').textContent,/Korean care.*العناية بالبشرة/);
 f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:d.querySelector('#saveProductMedia')}));await until(()=>d.querySelector('#productSaveMessage').textContent.includes('حُفظ'));
 const saved=JSON.parse(requests.find(x=>x.opts.method==='POST').opts.body);assert.equal(saved.id,'TSOTHER1');assert.equal(saved.category,'البشرة');assert.equal(saved.details.productType,'serum');assert.equal(saved.details.koreanCare,true);assert.equal(saved.stock,0);assert.equal(saved.price_fils,4990);assert.equal(products.length,3);assert.equal(f.elements.category.value,'korean-care:البشرة');assert.deepEqual(errors,[]);
});
test('The category menu preserves typed shade codes when adding makeup to Korean care',async t=>{
 const {w,d,requests,errors}=await editor(t);d.querySelector('[data-edit=TSOTHER1]').click();await until(()=>!d.querySelector('[data-photo-files]').disabled);
 const f=d.querySelector('#productForm');f.elements.category.value='المكياج';f.elements.category.dispatchEvent(new w.Event('change'));f.elements.productType.value='foundation';f.elements.productType.dispatchEvent(new w.Event('change'));f.elements['shadeCode-tone-2'].value='MY-REAL-CODE';
 f.elements.category.value='korean-care:المكياج';f.elements.category.dispatchEvent(new w.Event('change'));assert.equal(f.elements.productType.value,'foundation');assert.equal(f.elements['shadeCode-tone-2'].value,'MY-REAL-CODE');
 f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:d.querySelector('#saveProductMedia')}));await until(()=>d.querySelector('#productSaveMessage').textContent.includes('حُفظ'));
 const saved=JSON.parse(requests.find(x=>x.opts.method==='POST').opts.body);assert.equal(saved.category,'المكياج');assert.equal(saved.details.koreanCare,true);assert.equal(saved.details.shadeCodes['tone-2'],'MY-REAL-CODE');assert.deepEqual(errors,[]);
});
test('Both category routes and the separate collection control stay synchronized when removing or restoring Korean care',async t=>{
 const {w,d,requests,errors}=await editor(t);d.querySelector('[data-edit=TSCUSTOM1]').click();const f=d.querySelector('#productForm');assert.equal(f.elements.category.value,'korean-care:البشرة');
 f.elements.category.value='البشرة';f.elements.category.dispatchEvent(new w.Event('change'));assert.equal(f.elements.koreanCare.value,'exclude');assert.equal(f.elements.category.value,'البشرة');
 f.elements.koreanCare.value='include';f.elements.koreanCare.dispatchEvent(new w.Event('change'));assert.equal(f.elements.category.value,'korean-care:البشرة');
 f.elements.koreanCare.value='auto';f.elements.koreanCare.dispatchEvent(new w.Event('change'));assert.equal(f.elements.category.value,'البشرة');assert.equal(requests.filter(x=>x.opts.method==='POST').length,0);assert.deepEqual(errors,[]);
});
