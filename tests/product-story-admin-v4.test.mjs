import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setLocale} from '../public/i18n.js';
import {storyContent} from '../public/product-story.js';
import {createProductVideoManager} from '../public/product-videos-admin.js';

const PRODUCT_ID='TS0118';
const VIDEO={id:'01234567-89ab-4cde-89ab-0123456789ab',productId:PRODUCT_ID,title:'Store demonstration',titleEn:'Store demonstration',url:'/product-videos/01234567-89ab-4cde-89ab-0123456789ab',mime:'video/mp4',bytes:1024,active:true};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}

function videoEditor(t,call){
 const dom=new JSDOM(`<section id="productVideoPanel"><input type="file" data-video-file><input data-video-title><input data-video-title-en><button type="button" data-video-upload>Upload</button><p data-video-status></p><div data-video-list></div></section>`);
 const requests=[];
 class FakeXHR{
  constructor(){this.upload={};requests.push(this);}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(){}
  send(body){this.body=body;}
  complete(data,status=201){this.status=status;this.responseText=JSON.stringify(data);this.onload();}
  abort(){this.onabort?.();}
 }
 const replacements={FormData:dom.window.FormData,XMLHttpRequest:FakeXHR,confirm:()=>true};
 const original=new Map(Object.keys(replacements).map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 for(const [name,value] of Object.entries(replacements))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 const root=dom.window.document,manager=createProductVideoManager({root,call});
 t.after(()=>{manager.cancel();dom.window.close();for(const [name,descriptor] of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 return {manager,root,requests,
  chooseVideo(){const input=root.querySelector('[data-video-file]');Object.defineProperty(input,'files',{configurable:true,value:[new dom.window.File([new Uint8Array(24)],'routine.mp4',{type:'video/mp4'})]});},
  upload:()=>root.querySelector('[data-video-upload]').onclick(),
  cards:()=>root.querySelectorAll('.admin-video-card'),
  status:()=>root.querySelector('[data-video-status]').textContent
 };
}

for(const language of ['ar','en'])test(`Explicitly cleared administrator fields stay empty in the ${language} product story`,t=>{
 setLocale(language);t.after(()=>setLocale('ar'));
 const old={name:'Existing title',tagline:'Old tagline',description:'Old description',benefits:['Old benefit'],notes:'Old notes',steps:[{title:'Old step',text:'Old instruction'}]};
 const profile={ar:old,en:old};
 const product={id:PRODUCT_ID,name:'KSECRET Eye Cream',brand:'KSECRET',description:'',details:{tagline:'',benefits:[],howToUse:'',notes:'',en:{description:'',tagline:'',benefits:[],howToUse:'',notes:''}}};
 const cleared=storyContent(product,profile);
 assert.equal(cleared.description,'');
 assert.equal(cleared.tagline,'');
 assert.equal(cleared.notes,'');
 assert.deepEqual(cleared.benefits,[]);
 assert.deepEqual(cleared.steps,[]);
 // Missing fields still receive researched copy; clearing a field is a distinct administrator action.
 const missing=storyContent({id:PRODUCT_ID,name:product.name,brand:product.brand,details:{}},profile);
 assert.equal(missing.description,old.description);
 assert.equal(missing.tagline,old.tagline);
 assert.equal(missing.notes,old.notes);
 assert.deepEqual(missing.benefits,old.benefits);
 assert.deepEqual(missing.steps,old.steps);
});

for(const staleResult of ['success','rejection'])test(`A late initial video-list ${staleResult} cannot replace a completed upload`,async t=>{
 const initial=deferred(),refresh=deferred(),refreshStarted=deferred();let lists=0;
 const editor=videoEditor(t,(path,method)=>{
  assert.equal(path,'product-videos?product='+PRODUCT_ID);assert.equal(method,undefined);
  if(++lists===1)return initial.promise;
  assert.equal(lists,2);refreshStarted.resolve();return refresh.promise;
 });
 const selecting=editor.manager.select({id:PRODUCT_ID});
 editor.chooseVideo();
 const uploading=editor.upload();
 assert.equal(editor.manager.busy,true);
 assert.equal(editor.requests.length,1);
 assert.equal(editor.requests[0].method,'POST');
 assert.equal(editor.requests[0].url,'/api/admin/product-videos');
 assert.equal(editor.requests[0].body.get('product'),PRODUCT_ID);
 editor.requests[0].complete({ok:true,video:VIDEO});
 await refreshStarted.promise;
 refresh.resolve({videos:[VIDEO]});
 await uploading;
 assert.equal(editor.manager.busy,false);
 assert.equal(editor.cards().length,1);
 assert.match(editor.cards()[0].textContent,/Store demonstration/);
 const completedStatus=editor.status();assert.match(completedStatus,/رُفع الفيديو/);
 if(staleResult==='success')initial.resolve({videos:[]});else initial.reject(Error('Old list request failed'));
 await selecting;
 assert.equal(editor.cards().length,1);
 assert.match(editor.cards()[0].textContent,/Store demonstration/);
 assert.equal(editor.status(),completedStatus);
});

test('A failed video removal re-enables its button and a deliberate retry can succeed',async t=>{
 const firstDelete=deferred(),mutations=[];
 const editor=videoEditor(t,(path,method,body)=>{
  if(!method){assert.equal(path,'product-videos?product='+PRODUCT_ID);return Promise.resolve({videos:[VIDEO]});}
  assert.equal(path,'product-videos');assert.equal(method,'POST');mutations.push(body);
  return mutations.length===1?firstDelete.promise:Promise.resolve({ok:true});
 });
 await editor.manager.select({id:PRODUCT_ID});
 const remove=editor.root.querySelector('[data-remove-video]');
 const removing=remove.onclick();assert.equal(remove.disabled,true);
 firstDelete.reject(Error('Temporary delete failure'));
 await removing;
 assert.equal(remove.disabled,false);
 assert.equal(editor.cards().length,1);
 assert.equal(editor.status(),'Temporary delete failure');
 await remove.onclick();
 assert.deepEqual(mutations,[{id:VIDEO.id,action:'remove'},{id:VIDEO.id,action:'remove'}]);
 assert.equal(editor.cards().length,0);
 assert.match(editor.status(),/حُذف الفيديو/);
});
