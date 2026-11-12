import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import worker,{_test} from '../src/worker.js';
import {publicLumaSession,publicLumaChat,publicLumaTool,publicLumaProducts,runLumaTool,readSSE,lumaSystem} from '../src/luma-assistant.js';
import {validateCareInput} from '../src/care-assistant.js';
import {publicLumaTranscribe,validateDictation} from '../src/luma-dictation.js';
import {careCatalog,publicCareStatus} from '../src/care-assistant.js';
import {LumaDictation,LumaSpeech} from '../public/luma-speech.js';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const helpers={json,error:(message,status=400,extra={})=>json({error:message,...extra},status),sameOrigin:req=>req.headers.get('origin')===new URL(req.url).origin,content:_test.content,throttle:async()=>true};
const payload=(extra={})=>({adultConfirmed:true,googleConsent:true,audioConsent:true,consentVersion:'care-2026-11-v2',message:'أحتاج غسولًا ومرطبًا',budgetFils:15000,profile:{area:'face',skinType:'balanced',sensitive:'no'},...extra});
const request=data=>new Request('https://trend.test/api/chat',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-trend-care':'1'},body:JSON.stringify(data)});
function fixture(settings={enabled:true,billingConfirmed:true,imagesEnabled:true,voiceEnabled:true,voiceDailyLimit:2,dailyLimit:50,model:'gemini-3.5-flash-lite'}){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));db.prepare('UPDATE care_assistant_settings SET config_json=? WHERE id=1').run(JSON.stringify(settings));
 for(const [id,type,price]of [['TSDEMO1','cleanser',3000],['TSDEMO2','moisturizer',4000],['TSDEMO3','sunscreen',5000]])db.prepare("INSERT INTO products(id,brand,name,category,details_json,reference_price_fils,price_fils,stock,approved,active,image_url) VALUES(?,?,?,'البشرة',?,?,?,10,1,1,'/images/test.webp')").run(id,'Example',type,JSON.stringify({productType:type,nameAr:type,howToUse:'تعليمات العبوة'}),price,price);
 const DB={
  prepare(query){
   let args=[];const statement=db.prepare(query);
   return {
    bind(...values){args=values;return this},
    async first(){return statement.get(...args)||null},
    async all(){return {results:statement.all(...args)}},
    async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}
   };
  }
 };
 return {db,env:{DB,SESSION_SECRET:'synthetic-session-secret-01234567890123456789',GEMINI_API_KEY:'synthetic-test-key-never-a-real-credential'},close:()=>db.close()};
}
const stream=chunks=>new Response(chunks.map(c=>'data: '+JSON.stringify(c)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
const chunk=parts=>({candidates:[{finishReason:'STOP',content:{role:'model',parts}}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:10}});
const show={name:'show_products',id:'call-1',args:{productIds:['FAKE','TSDEMO1','TSDEMO2'],area:'face',budgetFils:15000,selections:[]}};
const q={name:'ask_question',id:'q-1',args:{field:'preference',text:'هل بتحبي القوام الخفيف؟',choices:[{label:'نعم',value:'yes'},{label:'لا',value:'no'}]}};
async function events(response){const text=await response.text();return text.split('\n\n').filter(Boolean).map(block=>({event:block.split('\n')[0].slice(7),data:JSON.parse(block.split('\n').slice(1).join('\n').slice(6))}))}

const wav=()=>{const b=Buffer.alloc(80);b.write('RIFF');b.writeUInt32LE(72,4);b.write('WAVEfmt ',8);return b.toString('base64')};
const clip=(extra={})=>({audioConsent:true,durationSeconds:1,audio:{mimeType:'audio/wav',data:wav()},...extra});

test('New text API accepts a direct message without adult/provider acknowledgements and never fabricates them',async()=>{
 const f=fixture(),old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return stream([chunk([{text:'من عيوني، رطبي إيديكِ بعد الغسل.'}])])};
 try{const out=await events(await publicLumaChat(request({message:'إيدي ناشفة، كيف أعتني فيها؟'}),f.env,helpers,{}));assert.equal(out.at(-1).event,'done');assert.doesNotMatch(JSON.stringify(sent.contents),/adultConfirmed|googleConsent/);assert.match(out.find(e=>e.event==='delta').data.text,/رطبي/)}finally{globalThis.fetch=old;f.close()}
});
test('Retired Live and public tool endpoints cannot mint tokens or spend requests even if old settings enabled voice',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('No external request allowed')};
 try{assert.equal((await publicLumaSession(request({}),f.env,helpers)).status,410);assert.equal((await publicLumaTool(request({}),f.env,helpers)).status,410);const status=await(await publicCareStatus(null,f.env,helpers)).json();assert.equal(status.liveAvailable,false);assert.equal(status.dictationAvailable,true);assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});
test('Dictation validates separate recording approval, real container signatures, duration and byte limits',()=>{
 assert.equal(validateDictation(clip()).mimeType,'audio/wav');
 for(const body of [clip({audioConsent:false}),clip({durationSeconds:46}),clip({durationSeconds:0}),clip({audio:{mimeType:'image/jpeg',data:wav()}}),clip({audio:{mimeType:'audio/wav',data:Buffer.alloc(100).toString('base64')}}),clip({audio:{mimeType:'audio/wav',data:'A'.repeat(1400004)}})])assert.throws(()=>validateDictation(body));
 const mp4=Buffer.alloc(100);mp4.write('ftypM4A ',4);assert.equal(validateDictation(clip({audio:{mimeType:'audio/mp4;codecs=mp4a.40.2',data:mp4.toString('base64')}})).mimeType,'audio/m4a');
 const webm=Buffer.alloc(100);webm.set([0x1a,0x45,0xdf,0xa3]);assert.equal(validateDictation(clip({audio:{mimeType:'audio/webm',data:webm.toString('base64')}})).mimeType,'audio/webm');
});
test('Dictation rejects cross-origin, unapproved or disabled audio before calling the model',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Must not call')};
 try{const req=request(clip());req.headers.set('origin','https://foreign.test');assert.equal((await publicLumaTranscribe(req,f.env,helpers)).status,403);assert.equal((await publicLumaTranscribe(request(clip({audioConsent:false})),f.env,helpers)).status,400);f.db.prepare('UPDATE care_assistant_settings SET config_json=?').run(JSON.stringify({enabled:true,billingConfirmed:true,dictationEnabled:false}));assert.equal((await publicLumaTranscribe(request(clip()),f.env,helpers)).status,503);assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});
test('Recorded audio returns a transcript only, with a bounded model request and one aggregate outcome',async()=>{
 const f=fixture(),old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{assert.match(url,/gemini-3\.5-flash-lite:generateContent$/);sent=JSON.parse(options.body);return json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'عندي حبوب خفيفة بظهري، مش مؤلمة.'})}]}}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:10}})};
 try{const r=await publicLumaTranscribe(request(clip()),f.env,helpers);assert.equal(r.status,200);assert.deepEqual(await r.json(),{text:'عندي حبوب خفيفة بظهري، مش مؤلمة.'});assert.equal(sent.contents[0].parts[1].inlineData.mimeType,'audio/wav');assert.equal(sent.generationConfig.maxOutputTokens,1200);assert.equal(sent.tools,undefined);assert.equal(f.db.prepare('SELECT successes FROM care_assistant_usage').get().successes,1);assert.equal(f.db.prepare('SELECT name FROM sqlite_master WHERE name LIKE ?').all('%audio%').length,0)}finally{globalThis.fetch=old;f.close()}
});
test('Silence, malformed transcripts and upstream failures never expose provider diagnostics or create advice',async()=>{
 for(const value of ['',null]){const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:value})}]}}]});try{const r=await publicLumaTranscribe(request(clip()),f.env,helpers);assert.equal(r.status,503);assert.equal((await r.json()).text,undefined);assert.equal(f.db.prepare('SELECT failures FROM care_assistant_usage').get().failures,1)}finally{globalThis.fetch=old;f.close()}}
});
test('Simultaneous text requests respect the atomic shared daily cap instead of overspending',async()=>{
 const f=fixture({enabled:true,billingConfirmed:true,dailyLimit:2}),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return stream([chunk([{text:'أهلًا فيكِ.'}])])};
 try{const responses=await Promise.all(Array.from({length:15},()=>publicLumaChat(request({message:'عناية لليدين'}),f.env,helpers,{})));await Promise.all(responses.map(r=>r.text()));assert.equal(calls,2);assert.equal(responses.filter(r=>r.status===429).length,13);assert.equal(f.db.prepare('SELECT requests FROM care_assistant_usage').get().requests,2)}finally{globalThis.fetch=old;f.close()}
});
test('Live catalog includes exact approved PanOxyl 4% and 10% washes for face/body but excludes prescriptions and unknown strength',()=>{
 const product=(id,name,brand='PanOxyl')=>({id,name,brand,category:'البشرة',approved:1,active:1,stock:4,price_fils:8990,details_json:'{"productType":"cleanser"}'});
 const catalog=careCatalog([product('TSPAN04','Benzoyl Peroxide Wash 4%'),product('TSPAN10','Benzoyl Peroxide Wash 10%'),product('TSUNKN1','Benzoyl Peroxide Wash'),product('TSPRES1','Clindamycin antibiotic wash','Other')]);
 assert.equal(catalog[0].cosmeticCandidate,false);assert.equal(catalog[0].lumaCandidate,true);assert.equal(catalog[0].activeStrength,'4%');assert.deepEqual(catalog[0].areas,['face','body']);assert.match(catalog[0].assistantHowToUse,/اشطفي/);assert.equal(catalog[1].activeStrength,'10%');assert.equal(catalog[2].lumaCandidate,false);assert.equal(catalog[3].lumaCandidate,false);
});
test('A practical routine is emitted before canonical cards and pharmacy WhatsApp is the final supplementary action',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>stream([chunk([{functionCall:{...show,args:{...show.args,carePlan:'١. غسل لطيف.\n٢. ترطيب بعد الغسل.',profile:{area:'face'}}}}])]);
 try{const out=await events(await publicLumaChat(request(payload()),f.env,helpers,{}));const plan=out.findIndex(e=>e.event==='delta'&&e.data.text.includes('غسل لطيف')),cards=out.findIndex(e=>e.event==='products'),follow=out.findIndex(e=>e.event==='followup');assert.ok(plan<cards);assert.ok(follow>cards);assert.match(out[follow].data.team.label,/صيدلانيات/);assert.equal(out.at(-1).event,'done')}finally{globalThis.fetch=old;f.close()}
});

async function ui({fetch:network,speech=false}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body style="color: red"><button id="launch">فتح</button></body></html>',{url:'https://trend.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.scrollTo=()=>{};w.TextDecoder=TextDecoder;w.AbortController=AbortController;
 w.fetch=network||(async()=>new Response('event: delta\ndata: {"text":"رطبي بشرتكِ بلطف."}\n\nevent: done\ndata: {}\n\n'));
 if(speech){w.SpeechSynthesisUtterance=class{};w.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'ar-JO'}]}}
 w.eval(buildSync({entryPoints:[new URL('../public/luma-widget.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'LumaWidget',write:false,logLevel:'silent',target:'es2022'}).outputFiles[0].text);
 const api=await w.LumaWidget.mountLumaWidget({status:{available:true,dictationAvailable:true,imagesAvailable:true}});return {dom,w,api};
}
test('Widget starts immediately with no consent checkboxes, provider preface or live call controls',async()=>{
 let sent;const {w,api}=await ui({fetch:async(url,options)=>{sent=JSON.parse(options.body);return new Response('event: delta\ndata: {"text":"من عيوني."}\n\nevent: done\ndata: {}\n\n')}});
 try{api.open();const dialog=w.document.querySelector('dialog');assert.equal(dialog.querySelectorAll('input[type=checkbox]').length,0);assert.doesNotMatch(dialog.textContent,/Google|\bAI\b|قبل أول رسالة|عمري 18|مكالمة مباشرة/);w.document.querySelector('#lumaMessage').value='مرحبًا';dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(sent.message,'مرحبًا');assert.equal(sent.adultConfirmed,undefined);assert.equal(sent.googleConsent,undefined);assert.equal(w.document.querySelector('.luma-record-consent').hidden,true);w.document.querySelector('[data-luma-record]').click();assert.equal(w.document.querySelector('.luma-record-consent').hidden,false);assert.match(w.document.querySelector('.luma-record-consent').textContent,/راجعي|لتراجعي/)}finally{w.close()}
});
test('Page scroll/style are locked and restored; typing a next draft does not resize the frame or lose the draft',async()=>{
 let producer;const {w,api}=await ui({fetch:async()=>new Response(new ReadableStream({start(c){producer=c;c.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"لحظة."}\n\n'))}}))});
 try{const original=w.document.body.getAttribute('style');api.open();assert.equal(w.document.body.style.position,'fixed');const height=api.dialog.style.height,textarea=w.document.querySelector('textarea');textarea.value='سؤال أول';api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,20));assert.equal(textarea.disabled,false);textarea.value='مسودة السؤال الثاني';producer.enqueue(new TextEncoder().encode('event: done\ndata: {}\n\n'));producer.close();await new Promise(r=>setTimeout(r,20));assert.equal(textarea.value,'مسودة السؤال الثاني');assert.equal(api.dialog.style.height,height);api.close();assert.equal(w.document.body.getAttribute('style'),original)}finally{w.close()}
});
test('Each completed model message has an on-demand listening control and no speech starts automatically',async()=>{
 const {w,api}=await ui({speech:true});let spoken=0;w.speechSynthesis.speak=()=>{spoken++};
 try{api.open();assert.equal(spoken,0);w.document.querySelector('#lumaMessage').value='كيف أرطب؟';api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));const buttons=api.dialog.querySelectorAll('.luma-listen');assert.equal(buttons.length,2);buttons[1].click();assert.equal(spoken,1);assert.equal(buttons[1].getAttribute('aria-pressed'),'true');buttons[1].click();assert.equal(buttons[1].getAttribute('aria-pressed'),'false')}finally{w.close()}
});
test('Pending microphone approval can be cancelled safely and late granted tracks are released without upload',async()=>{
 const keys=['navigator','MediaRecorder'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let resolve,stops=0;
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});Object.defineProperty(globalThis,'MediaRecorder',{configurable:true,value:class{}});const recorder=new LumaDictation();const pending=recorder.start();recorder.cancel();resolve({getTracks:()=>[{stop(){stops++}}]});await pending;assert.equal(stops,1);assert.equal(recorder.active,false)}finally{for(const [k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
});
test('A full catalog is sent as a compact index while exact usage and ingredients are retrieved by requested IDs',async()=>{
 const f=fixture();try{
  const base=careCatalog([{id:'TSBASE1',name:'Gentle cream',brand:'Test',category:'البشرة',approved:1,active:1,stock:2,price_fils:3000,description:'وصف '.repeat(100),details_json:JSON.stringify({productType:'moisturizer',howToUse:'تعليمات '.repeat(100),notes:'ملاحظة '.repeat(100)})}])[0];
  const input=validateCareInput(payload(),false),many=Array.from({length:350},(_,i)=>({...base,id:'TSINDEX'+i})),prompt=lumaSystem(input,many);assert.ok(prompt.length<160000);assert.match(prompt,/TSINDEX349/);assert.doesNotMatch(prompt,/تعليمات تعليمات تعليمات/);
  const result=await runLumaTool({name:'get_catalog',args:{productIds:['TSDEMO2']}},input,f.env);assert.deepEqual(result.products.map(p=>p.id),['TSDEMO2']);assert.equal(result.products[0].howToUse,'تعليمات العبوة');
 }finally{f.close()}
});
test('An incomplete provider answer returns a bounded non-sensitive diagnostic and never marks the response done',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>stream([{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'خطوة غير مكتملة.'}]}}]}]);
 try{const out=await events(await publicLumaChat(request({message:'كيف أعتني ببشرتي؟'}),f.env,helpers,{}));assert.equal(out.at(-1).event,'error');assert.equal(out.at(-1).data.code,'FINISH_MAX_TOKENS');assert.equal(out.filter(e=>e.event==='done').length,0);assert.equal(f.db.prepare('SELECT failures FROM care_assistant_usage').get().failures,1)}finally{globalThis.fetch=old;f.close()}
});
test('Every real request requires a response tool; a care-only answer needs no budget and can end with pharmacy follow-up',async()=>{
 const f=fixture(),old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return stream([chunk([{functionCall:{name:'answer_customer',args:{text:'رطبي إيديكِ بعد الغسل وارتدي قفازات عند استخدام المنظفات.',followUp:true,profile:{area:'hands'}}}}])])};
 try{const out=await events(await publicLumaChat(request({message:'إيدي ناشفة، كيف أعتني فيها؟'}),f.env,helpers,{}));assert.equal(sent.toolConfig.functionCallingConfig.mode,'ANY');assert.equal(out.filter(e=>e.event==='question').length,0);assert.match(out.find(e=>e.event==='delta').data.text,/رطبي/);assert.equal(out.at(-2).event,'followup');assert.equal(out.at(-1).event,'done');assert.equal(f.db.prepare('SELECT successes FROM care_assistant_usage').get().successes,1)}finally{globalThis.fetch=old;f.close()}
});

