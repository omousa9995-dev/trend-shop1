import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import {requestGemini} from '../src/gemini-provider.js';
import {productPageHtml} from '../src/product-page.js';
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
const answer={candidates:[{finishReason:'STOP',content:{parts:[{text:'أهلًا'}]}}]};
const options={apiKey:'synthetic-test-key',primary:'gemini-3.8-flash',payload:{contents:[]}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await pause(10)}assert.fail('Timed out waiting for the expected UI state')}

test('Unavailable primary uses one bounded alternate, with safe diagnostics and complete JSON transport',async()=>{
 const old=globalThis.fetch,attempts=[],urls=[];globalThis.fetch=async(url,init)=>{urls.push(url);assert.equal(init.headers['x-goog-api-key'],'synthetic-test-key');return urls.length===1?json({error:{message:'private detail capacity overloaded'}},503):json(answer)};
 try{const result=await requestGemini({...options,onAttempt:a=>attempts.push(a)});assert.equal(result.model,'gemini-3.5-flash-lite');assert.equal(result.fallback,true);assert.equal(urls.length,2);assert.ok(urls.every(u=>u.endsWith(':generateContent')));assert.equal(attempts[0].reason,'CAPACITY');assert.doesNotMatch(JSON.stringify(attempts),/private detail|synthetic-test-key/)}finally{globalThis.fetch=old}
});
test('Authentication, billing, invalid requests and long retry hints do not trigger a retry storm',async()=>{
 const old=globalThis.fetch;
 try{for(const status of [400,401,402,403,429,503]){let calls=0;globalThis.fetch=async()=>{calls++;return json({error:{message:'private credential detail'}},status,{'retry-after':'60'})};await assert.rejects(requestGemini(options),new RegExp('PROVIDER_HTTP_'+status));assert.equal(calls,1)}}finally{globalThis.fetch=old}
});
test('A function continuation stays on its successful model and never invalidates thought signatures by switching models',async()=>{
 const old=globalThis.fetch,urls=[];globalThis.fetch=async url=>{urls.push(url);return urls.length===1?json({},503):json(answer)};
 try{const result=await requestGemini({...options,model:'gemini-3.5-flash-lite'});assert.equal(result.model,'gemini-3.5-flash-lite');assert.equal(urls.length,2);assert.ok(urls.every(u=>u.includes('/gemini-3.5-flash-lite:')))}finally{globalThis.fetch=old}
});
test('An attempt timeout can use the alternate, but explicit cancellation ends the whole request immediately',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async(url,init)=>{calls++;if(calls===1)return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));return json(answer)};assert.equal((await requestGemini({...options,timeoutMs:10})).fallback,true);assert.equal(calls,2);const abort=new AbortController();abort.abort();await assert.rejects(requestGemini({...options,signal:abort.signal}));assert.equal(calls,2)}finally{globalThis.fetch=old}
});
function browser(html='<button id="outside">المتجر</button>'){
 const dom=new JSDOM('<!doctype html><html lang="ar"><head></head><body>'+html+'</body></html>',{url:'https://trend.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.scrollTo=()=>{};
 return {dom,w};
}
const script=()=>buildSync({entryPoints:[new URL('../public/luma-widget.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'LumaWidget',write:false,logLevel:'silent',target:'es2022'}).outputFiles[0].text;
function microphone(w,{denied=false}={}){
 const stats={starts:0,stops:0,permissions:0};Object.defineProperty(w.navigator,'mediaDevices',{value:{async getUserMedia(){stats.permissions++;if(denied)throw new w.DOMException('Denied','NotAllowedError');return {getTracks:()=>[{stop(){stats.stops++}}]}}}});
 w.MediaRecorder=class{
  static isTypeSupported(){return true}
  constructor(){this.mimeType='audio/webm';this.state='inactive'}
  start(){this.state='recording';stats.starts++}
  stop(){this.state='inactive';this.ondataavailable?.({data:new w.Blob([new Uint8Array(160)],{type:this.mimeType})});queueMicrotask(()=>this.onstop?.())}
 };
 return stats;
}
test('One microphone click starts recording, stop automatically transcribes and sends exactly once, preserving the typed draft',async()=>{
 const {w}=browser(),stats=microphone(w),calls=[];w.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return url==='/api/transcribe'?json({text:'عندي جفاف بسيط بإيدي'}):new Response('event: provider\ndata: {"model":"gemini-3.8-flash","ok":true}\n\nevent: delta\ndata: {"text":"رطبي إيديكِ بعد الغسل."}\n\nevent: done\ndata: {}\n\n')};
 try{w.eval(script());const api=await w.LumaWidget.mountLumaWidget({status:{available:true,dictationAvailable:true}});api.open();const draft=w.document.querySelector('textarea');draft.value='مسودة مستقلة';w.document.querySelector('[data-luma-record]').click();await until(()=>stats.starts===1);assert.equal(stats.permissions,1);assert.equal(w.document.querySelector('.luma-record-consent'),null);await pause(5);w.document.querySelector('[data-luma-record-stop]').click();await until(()=>calls.length===2&&!api.dialog.hasAttribute('aria-busy')||calls.length===2&&api.dialog.getAttribute('aria-busy')==='false');assert.deepEqual(calls.map(c=>c.url),['/api/transcribe','/api/chat']);assert.equal(calls[1].body.message,'عندي جفاف بسيط بإيدي');assert.equal(calls[0].body.audioConsent,true);assert.equal(draft.value,'مسودة مستقلة');assert.match(w.document.querySelector('.luma-user').textContent,/رسالة صوتية/);assert.equal(stats.stops,1);assert.equal(api.dialog.dataset.lumaProviderStatus,'ok');api.destroy();assert.equal(w.document.querySelector('dialog'),null);const fresh=await w.LumaWidget.mountLumaWidget({status:{available:true}});assert.notEqual(fresh,api);fresh.destroy()}finally{w.close()}
});
test('Recording cancellation and native permission denial never upload or submit a message',async()=>{
 for(const denied of [false,true]){const {w}=browser(),stats=microphone(w,{denied});let calls=0;w.fetch=async()=>{calls++;throw Error('Must not upload')};try{w.eval(script());const api=await w.LumaWidget.mountLumaWidget({status:{available:true}});api.open();w.document.querySelector('[data-luma-record]').click();await pause(15);if(!denied){assert.equal(stats.starts,1);w.document.querySelector('[data-luma-record-cancel]').click()}await pause(15);assert.equal(calls,0);if(denied)assert.match(w.document.querySelector('.luma-notice').textContent,/الميكروفون/);api.destroy()}finally{w.close()}}
});

test('Only header and footer entries exist, no floating/Korean nav entry, and SSR product HTML contains neither',()=>{
 const shell=readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),dom=new JSDOM(shell),d=dom.window.document;
 try{assert.equal(d.querySelectorAll('[data-care-entry]').length,2);assert.ok(d.querySelector('.brand-assistant-group>.logo+[data-care-entry]'));assert.ok(d.querySelector('footer [data-care-entry]'));assert.equal(d.querySelector('.catalog-nav [data-care-entry],[data-care-launcher],.luma-launcher'),null);const product=productPageHtml(shell,{id:'TSDEMO1',name:'Test',details_json:'{}',image_url:'/images/test.webp'});assert.doesNotMatch(product,/data-care-entry|data-care-region|LUMA_(?:HEADER|FOOTER)_START/)}finally{dom.window.close()}
});
test('Product navigation hides both entries, destroys chat, and returning to the catalog restores entries without a mutation loop',async()=>{
 const {w}=browser('<a data-care-region="header" data-care-entry hidden><span data-luma-entry-title></span></a><section data-care-region="footer" hidden><h2 data-luma-entry-title></h2><a data-care-entry>فتح</a></section>');
 const source=buildSync({entryPoints:[new URL('../public/luma-placement.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'Placement',write:false,logLevel:'silent'}).outputFiles[0].text;let opens=0,destroys=0;
 try{w.eval(source);const entries=w.Placement.installCareEntries({status:{available:true},loadWidget:async()=>({open(){opens++},destroy(){destroys++}})});assert.equal(w.document.querySelector('[data-care-region]').hidden,false);w.document.querySelector('[data-care-entry]').click();await pause(10);assert.equal(opens,1);w.location.hash='#/product/TSDEMO1';await pause(15);assert.ok([...w.document.querySelectorAll('[data-care-region]')].every(e=>e.hidden));assert.equal(destroys,1);w.location.hash='#/shop';w.document.documentElement.lang='en';await pause(15);assert.equal(w.document.querySelector('[data-care-region]').hidden,false);assert.equal(w.document.querySelector('[data-luma-entry-title]').textContent,'Luma');assert.equal(destroys,1);entries.destroy();assert.equal(w.document.querySelector('[data-care-region]').hidden,true)}finally{w.close()}
});
test('A delayed widget load cannot open the chat after navigating into a product',async()=>{
 const {w}=browser('<a data-care-region="header" data-care-entry><span data-luma-entry-title></span></a>');let resolve,opens=0,destroys=0;
 try{w.eval(buildSync({entryPoints:[new URL('../public/luma-placement.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'Placement',write:false,logLevel:'silent'}).outputFiles[0].text);const entries=w.Placement.installCareEntries({status:{available:true},loadWidget:()=>new Promise(r=>resolve=r)});w.document.querySelector('a').click();w.location.hash='#/product/TSDEMO1';await pause(15);resolve({open(){opens++},destroy(){destroys++}});await pause(15);assert.equal(opens,0);assert.equal(destroys,1);entries.destroy()}finally{w.close()}
});
