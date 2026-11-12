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

test('Interactions preserves the private thought and tool timeline in stateless continuations and maps output without exposing thoughts',async()=>{
 const {interactionRequest,interactionResponse}=await import('../src/gemini-interactions.js');
 const timeline=[{type:'thought',signature:'opaque-private-signature',summary:[]},{type:'function_call',id:'call-7',name:'get_catalog',arguments:{productIds:['TSDEMO1']},signature:'opaque-tool-signature'}];
 const normalized=interactionResponse({status:'requires_action',steps:timeline,usage:{total_input_tokens:120,total_output_tokens:30}});
 assert.equal(normalized.candidates[0].content.parts[1].functionCall.id,'call-7');assert.equal(normalized.usageMetadata.promptTokenCount,120);
 const payload={systemInstruction:{parts:[{text:'System'}]},tools:[{functionDeclarations:[{name:'get_catalog',parameters:{type:'OBJECT',properties:{area:{type:'STRING'}}}}]}],contents:[{role:'user',parts:[{text:'احتياج تجريبي'},{inlineData:{mimeType:'image/jpeg',data:'synthetic-image'}}]},normalized.candidates[0].content,{role:'user',parts:[{functionResponse:{id:'call-7',name:'get_catalog',response:{products:[]}}}]}]};
 const request=interactionRequest('gemini-3.8-flash',payload);assert.equal(request.store,false);assert.equal(request.previous_interaction_id,undefined);assert.deepEqual(request.input.slice(1,3),timeline);assert.equal(request.input[3].call_id,'call-7');assert.equal(request.input[0].content[1].type,'image');assert.equal(request.tools[0].parameters.type,'object');assert.equal(request.generation_config.tool_choice,'any');assert.throws(()=>interactionResponse({status:'incomplete',steps:timeline}));
});
test('Real chat transport targets the current Interactions endpoint and accepts a complete function response',async()=>{
 const old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');sent=JSON.parse(init.body);return json({status:'requires_action',steps:[{type:'function_call',id:'q1',name:'ask_question',arguments:{text:'شو نوع بشرتكِ؟'}}]})};
 try{const result=await requestGemini({...options,transport:'interactions',payload:{contents:[{role:'user',parts:[{text:'روتين تجريبي'}]}],tools:[{functionDeclarations:[{name:'ask_question',parameters:{type:'OBJECT',properties:{text:{type:'STRING'}}}}]}]}});assert.equal(sent.store,false);assert.equal(sent.model,'gemini-3.8-flash');assert.equal(result.data.candidates[0].content.parts[1].functionCall.name,'ask_question')}finally{globalThis.fetch=old}
});

test('Structured actions retain model-selected functions without the failing native-tool transport, and reject invalid action output',async()=>{
 const {actionRequest,actionResponse}=await import('../src/luma-json-actions.js');
 const req=actionRequest({systemInstruction:{parts:[{text:'Instructions'}]},contents:[{role:'user',parts:[{text:'سؤال'}]},{role:'model',parts:[{functionCall:{name:'get_catalog',args:{productIds:['TSDEMO1']}}}]},{role:'user',parts:[{functionResponse:{name:'get_catalog',id:'old-call',response:{products:[]}}}]}]});
 assert.equal(req.tools,undefined);assert.equal(req.generationConfig.responseMimeType,undefined);assert.equal(req.generationConfig.responseSchema,undefined);assert.equal(req.generationConfig.maxOutputTokens,8192);assert.match(req.systemInstruction.parts[0].text,/ACTION CONTRACT:/);assert.equal(JSON.parse(req.contents[1].parts[0].text).action,'get_catalog');assert.match(req.contents[2].parts[0].text,/STORE ACTION RESULT/);
 const raw={candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({action:'show_products',text:'روتين تجريبي',productIds:['TSDEMO1'],budgetFils:10000})}]}}]};
 const selected=actionResponse(raw).candidates[0].content.parts[0].functionCall;assert.equal(selected.name,'show_products');assert.equal(selected.args.carePlan,'روتين تجريبي');assert.equal(selected.args.budgetFils,10000);assert.throws(()=>actionResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"action":"delete_all","text":""}'}]}}]}));
});

test('Actions use a stateless plain-text Interactions turn and keep private thought steps outside the displayed answer',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(init.headers['Api-Revision'],'2026-05-20');const body=JSON.parse(init.body);assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.equal(body.generation_config.tool_choice,undefined);assert.equal(body.generation_config.response_mime_type,undefined);return json({status:'completed',steps:[{type:'thought',signature:'private-opaque',summary:[]},{type:'model_output',content:[{type:'text',text:JSON.stringify({action:'answer_customer',text:'التوصيل دينار.',profile:{},followUp:false})}]}]})};
 try{const result=await requestGemini({...options,transport:'actions'});const call=result.data.candidates[0].content.parts[0].functionCall;assert.equal(call.name,'answer_customer');assert.equal(call.args.text,'التوصيل دينار.');assert.doesNotMatch(JSON.stringify(result.data),/private-opaque/);assert.equal(calls,1)}finally{globalThis.fetch=old}
});

test('An unavailable action endpoint has one plain-text alternate with the same validated actions and no constrained decoding',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);if(calls===1)return json({error:{message:'Unavailable'}},503);assert.match(url,/gemini-3\.5-flash-lite:generateContent$/);assert.equal(body.tools,undefined);assert.equal(body.generationConfig.responseMimeType,undefined);assert.equal(body.generationConfig.responseSchema,undefined);return json({candidates:[{finishReason:'STOP',content:{parts:[{text:'```json\n'+JSON.stringify({action:'ask_question',text:'شو نوع بشرتكِ؟',field:'skinType',profile:{},choices:[]})+'\n```'}]}}]})};
 try{const result=await requestGemini({...options,transport:'actions'});assert.equal(result.fallback,true);assert.equal(result.data.candidates[0].content.parts[0].functionCall.name,'ask_question');assert.equal(calls,2)}finally{globalThis.fetch=old}
});

test('Malformed plain-text action output never becomes customer text and stops after two attempts',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;const text='```json\n{"action":"delete_all","text":"private provider text"}\n```';return calls===1?json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text}]}]}):json({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]})};
 try{await assert.rejects(requestGemini({...options,transport:'actions'}),/INVALID_ACTION_OUTPUT/);assert.equal(calls,2)}finally{globalThis.fetch=old}
});

test('A selection-only action preserves exact IDs for canonical validation without inventing product identifiers',async()=>{
 const {actionResponse}=await import('../src/luma-json-actions.js');
 const response=value=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
 const call=actionResponse(response({action:'show_products',text:'روتين',selections:[{productId:'TSDEMO1',reason:'مرطب'},{productId:'invented url'}]})).candidates[0].content.parts[0].functionCall;
 assert.deepEqual(call.args.productIds,['TSDEMO1']);
 const explicit=actionResponse(response({action:'show_products',text:'روتين',productIds:['TSDEMO2'],selections:[{productId:'TSDEMO1'}]})).candidates[0].content.parts[0].functionCall;
 assert.deepEqual(explicit.args.productIds,['TSDEMO2']);
});

test('An incomplete thinking turn is reported as incomplete and receives one bounded alternate, without leaking partial text',async()=>{
 const old=globalThis.fetch,attempts=[];let n=0;
 globalThis.fetch=async(url,init)=>{n++;if(n===1){const body=JSON.parse(init.body);assert.equal(body.generation_config.max_output_tokens,8192);return json({status:'incomplete',steps:[{type:'model_output',content:[{type:'text',text:'private partial text'}]}]})}return json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"action":"answer_customer","text":"أهلًا فيكِ"}'}]}}]})};
 try{const result=await requestGemini({...options,transport:'actions',onAttempt:e=>attempts.push(e)});assert.equal(n,2);assert.equal(attempts[0].reason,'OUTPUT_INCOMPLETE');assert.doesNotMatch(JSON.stringify(result.data),/private partial/);assert.equal(result.data.candidates[0].content.parts[0].functionCall.args.text,'أهلًا فيكِ')}finally{globalThis.fetch=old}
});
