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
import {urgentCareReply} from '../src/luma-urgent-care.js';
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
const stream=chunks=>{const c=chunks.at(-1),v=c.candidates[0],p=v.content.parts[0],f=p.functionCall;const value=f?{action:f.name,text:f.args.text||f.args.carePlan||f.args.reason||'',...f.args}:{action:'answer_customer',text:p.text,profile:{},followUp:false};return json({...c,status:v.finishReason==='STOP'?'completed':'incomplete',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(value)}]}],usage:{total_input_tokens:20,total_output_tokens:10},candidates:[{...v,content:{parts:[{text:JSON.stringify(value)}]}}]})};
const chunk=parts=>({candidates:[{finishReason:'STOP',content:{role:'model',parts}}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:10}});
const show={name:'show_products',id:'call-1',args:{productIds:['FAKE','TSDEMO1','TSDEMO2'],area:'face',budgetFils:15000,selections:[]}};
const q={name:'ask_question',id:'q-1',args:{field:'preference',text:'هل بتحبي القوام الخفيف؟',choices:[{label:'نعم',value:'yes'},{label:'لا',value:'no'}]}};
async function events(response){const text=await response.text();return text.split('\n\n').filter(Boolean).map(block=>({event:block.split('\n')[0].slice(7),data:JSON.parse(block.split('\n').slice(1).join('\n').slice(6))}))}

const wav=()=>{const b=Buffer.alloc(80);b.write('RIFF');b.writeUInt32LE(72,4);b.write('WAVEfmt ',8);return b.toString('base64')};
const clip=(extra={})=>({audioConsent:true,durationSeconds:1,audio:{mimeType:'audio/wav',data:wav()},...extra});

test('New text API accepts a direct message without adult/provider acknowledgements and never fabricates them',async()=>{
 const f=fixture(),old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return stream([chunk([{text:'من عيوني، رطبي إيديكِ بعد الغسل.'}])])};
 try{const out=await events(await publicLumaChat(request({message:'إيدي ناشفة، كيف أعتني فيها؟'}),f.env,helpers,{}));assert.equal(out.at(-1).event,'done');assert.doesNotMatch(JSON.stringify(sent.input),/adultConfirmed|googleConsent/);assert.match(out.find(e=>e.event==='delta').data.text,/رطبي/)}finally{globalThis.fetch=old;f.close()}
});
test('Retired Live and public tool endpoints cannot mint tokens or spend requests even if old settings enabled voice',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('No external request allowed')};
 try{assert.equal((await publicLumaSession(request({}),f.env,helpers)).status,410);assert.equal((await publicLumaTool(request({}),f.env,helpers)).status,410);const status=await(await publicCareStatus(null,f.env,helpers)).json();assert.equal(status.liveAvailable,false);assert.equal(status.dictationAvailable,false);assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});
test('Dictation validates separate recording approval, real container signatures, duration and byte limits',()=>{
 assert.equal(validateDictation(clip()).mimeType,'audio/wav');
 for(const body of [clip({audioConsent:false}),clip({durationSeconds:46}),clip({durationSeconds:0}),clip({audio:{mimeType:'image/jpeg',data:wav()}}),clip({audio:{mimeType:'audio/wav',data:Buffer.alloc(100).toString('base64')}}),clip({audio:{mimeType:'audio/wav',data:'A'.repeat(1400004)}})])assert.throws(()=>validateDictation(body));
 const mp4=Buffer.alloc(100);mp4.write('ftypM4A ',4);assert.equal(validateDictation(clip({audio:{mimeType:'audio/mp4;codecs=mp4a.40.2',data:mp4.toString('base64')}})).mimeType,'audio/m4a');
 const webm=Buffer.alloc(100);webm.set([0x1a,0x45,0xdf,0xa3]);assert.equal(validateDictation(clip({audio:{mimeType:'audio/webm',data:webm.toString('base64')}})).mimeType,'audio/webm');
});
test('Retired dictation rejects foreign requests and returns 410 for cached or disabled clients without quota spend',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Must not call')};
 try{const req=request(clip());req.headers.set('origin','https://foreign.test');assert.equal((await publicLumaTranscribe(req,f.env,helpers)).status,403);for(const body of [clip(),clip({audioConsent:false}),{}])assert.equal((await publicLumaTranscribe(request(body),f.env,helpers)).status,410);assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});

test('Even valid audio is retired before any provider request or transcript',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Must not transcribe')};
 try{const r=await publicLumaTranscribe(request(clip()),f.env,helpers);assert.equal(r.status,410);assert.equal((await r.json()).text,undefined);assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});

test('Malformed and missing audio are retired without disclosing provider details',async()=>{
 const f=fixture();try{for(const body of [{},clip({audio:{}})]){const r=await publicLumaTranscribe(request(body),f.env,helpers);assert.equal(r.status,410);assert.match((await r.json()).error,/أُلغيت/)}}finally{f.close()}
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
test('A practical routine is emitted before canonical cards without a compulsory pharmacy pitch',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>stream([chunk([{functionCall:{...show,args:{...show.args,carePlan:'١. غسل لطيف.\n٢. ترطيب بعد الغسل.\nالمنتجات المقترحة: TSDEMO1, TSDEMO2',profile:{area:'face'}}}}])]);
 try{const out=await events(await publicLumaChat(request(payload()),f.env,helpers,{}));const plan=out.findIndex(e=>e.event==='delta'&&e.data.text.includes('غسل لطيف')),cards=out.findIndex(e=>e.event==='products'),follow=out.findIndex(e=>e.event==='followup');assert.ok(plan<cards);assert.doesNotMatch(out[cards].data.carePlan,/TSDEMO|المنتجات المقترحة/);assert.equal(follow,-1);assert.equal(out.at(-1).event,'done')}finally{globalThis.fetch=old;f.close()}
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
 try{api.open();const dialog=w.document.querySelector('dialog');assert.equal(dialog.querySelectorAll('input[type=checkbox]:not([data-luma-remember])').length,0);assert.equal(dialog.querySelector('[data-luma-remember]').checked,true);assert.doesNotMatch(dialog.textContent,/Google|\bAI\b|قبل أول رسالة|عمري 18|مكالمة مباشرة/);w.document.querySelector('#lumaMessage').value='مرحبًا';dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(sent.message,'مرحبًا');assert.equal(sent.adultConfirmed,undefined);assert.equal(sent.googleConsent,undefined);assert.equal(w.document.querySelector('.luma-record-consent'),null);assert.equal(w.document.querySelector('[data-luma-record-stop]'),null)}finally{w.close()}
});
test('Page scroll/style are locked and restored; typing a next draft does not resize the frame or lose the draft',async()=>{
 let producer;const {w,api}=await ui({fetch:async()=>new Response(new ReadableStream({start(c){producer=c;c.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"لحظة."}\n\n'))}}))});
 try{const original=w.document.body.getAttribute('style');api.open();assert.equal(w.document.body.style.position,'fixed');const height=api.dialog.style.height,textarea=w.document.querySelector('textarea');textarea.value='سؤال أول';api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,20));assert.equal(textarea.disabled,false);textarea.value='مسودة السؤال الثاني';producer.enqueue(new TextEncoder().encode('event: done\ndata: {}\n\n'));producer.close();await new Promise(r=>setTimeout(r,20));assert.equal(textarea.value,'مسودة السؤال الثاني');assert.equal(api.dialog.style.height,height);api.close();assert.equal(w.document.body.getAttribute('style'),original)}finally{w.close()}
});
test('Text conversation never exposes a microphone, audio upload or playback button even with native speech available',async()=>{
 const {w,api}=await ui({speech:true});let spoken=0;w.speechSynthesis.speak=()=>{spoken++};
 try{api.open();w.document.querySelector('#lumaMessage').value='كيف أرطب؟';api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(api.dialog.querySelectorAll('.luma-listen,[data-luma-record],input[accept*=audio]').length,0);assert.equal(spoken,0);assert.match(api.dialog.querySelector('.luma-avatar img').src,/beauty-hero-v2/)}finally{w.close()}
});

test('Pending microphone approval can be cancelled safely and late granted tracks are released without upload',async()=>{
 const keys=['navigator','MediaRecorder'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let resolve,stops=0;
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});Object.defineProperty(globalThis,'MediaRecorder',{configurable:true,value:class{}});const recorder=new LumaDictation();const pending=recorder.start();recorder.cancel();resolve({getTracks:()=>[{stop(){stops++}}]});await pending;assert.equal(stops,1);assert.equal(recorder.active,false)}finally{for(const [k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
});
test('A bounded detailed shortlist is seeded while exact missing items can still be retrieved by ID',async()=>{
 const f=fixture();try{
  const base=careCatalog([{id:'TSBASE1',name:'Gentle cream',brand:'Test',category:'البشرة',approved:1,active:1,stock:2,price_fils:3000,description:'وصف '.repeat(100),details_json:JSON.stringify({productType:'moisturizer',howToUse:'تعليمات '.repeat(100),notes:'ملاحظة '.repeat(100)})}])[0];
  const input=validateCareInput(payload(),false),many=Array.from({length:350},(_,i)=>({...base,id:'TSINDEX'+i})),prompt=lumaSystem(input,many);assert.ok(prompt.length<160000);assert.match(prompt,/TSINDEX7/);assert.doesNotMatch(prompt,/TSINDEX8/);assert.match(prompt,/تعليمات تعليمات تعليمات/);
  const result=await runLumaTool({name:'get_catalog',args:{productIds:['TSDEMO2']}},input,f.env);assert.deepEqual(result.products.map(p=>p.id),['TSDEMO2']);assert.equal(result.products[0].howToUse,'تعليمات العبوة');
 }finally{f.close()}
});
test('An incomplete provider answer returns a bounded non-sensitive diagnostic and never marks the response done',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>stream([{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'خطوة غير مكتملة.'}]}}]}]);
 try{const out=await events(await publicLumaChat(request({message:'كيف أعتني ببشرتي؟'}),f.env,helpers,{}));assert.equal(out.at(-1).event,'error');assert.equal(out.at(-1).data.code,'FINISH_MAX_TOKENS');assert.equal(out.filter(e=>e.event==='done').length,0);assert.equal(f.db.prepare('SELECT failures FROM care_assistant_usage').get().failures,1)}finally{globalThis.fetch=old;f.close()}
});
test('A care-only answer carries resolved profile without a budget or automatic pharmacy follow-up',async()=>{
 const f=fixture(),old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return stream([chunk([{functionCall:{name:'answer_customer',args:{text:'رطبي إيديكِ بعد الغسل وارتدي قفازات عند استخدام المنظفات.',followUp:true,profile:{area:'hands'}}}}])])};
 try{const out=await events(await publicLumaChat(request({message:'إيدي ناشفة، كيف أعتني فيها؟'}),f.env,helpers,{}));assert.equal(sent.generation_config.response_mime_type,undefined);assert.deepEqual(sent.tools,[]);assert.equal(sent.store,false);assert.match(sent.system_instruction,/TSDEMO[123]/);assert.match(sent.system_instruction,/Answer general care and store questions directly/);assert.equal(out.filter(e=>e.event==='question').length,0);assert.match(out.find(e=>e.event==='delta').data.text,/رطبي/);assert.equal(out.some(e=>e.event==='followup'),false);assert.deepEqual(out.find(e=>e.event==='profile').data.profile,{area:'hands'});assert.equal(out.at(-1).event,'done');assert.equal(f.db.prepare('SELECT successes FROM care_assistant_usage').get().successes,1)}finally{globalThis.fetch=old;f.close()}
});
test('Explicit deep wounds or uncontrolled bleeding get immediate guidance and pharmacy follow-up without provider availability or paid quota',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Provider intentionally unavailable')};
 try{for(const message of ['جرح عميق باليد ونزيف مستمر','The bleeding will not stop']){const out=await events(await publicLumaChat(request({message}),f.env,helpers,{}));const reply=out.find(e=>e.event==='handoff').data;assert.match(reply.message,/للطوارئ الآن/);assert.equal(reply.routine.length,0);assert.match(reply.team.label,/صيدلانيات/);assert.equal(out.at(-1).event,'done')}assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});
test('Negated injury signals and ordinary skin concerns do not trigger the emergency path',()=>{
 for(const text of ['ما عندي جرح عميق ولا نزيف مستمر، بس حبوب خفيفة','ما في جرح عميق أو نزيف مستمر','حبوب الظهر مش مؤلمة وبدون جروح عميقة','جفاف اليدين بدون نزيف','No deep wound or heavy bleeding','إيدي ناشفة، ما فيها جروح ولا نزيف ولا ألم'])assert.equal(urgentCareReply(text),null);
});
test('Unavailable inference offers fixed store-team follow-up with a retry state and no invented recommendation',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>new Response('private-provider-detail',{status:503,headers:{'retry-after':'60'}});
 try{const out=await events(await publicLumaChat(request({message:'بدي عناية لبشرتي'}),f.env,helpers,{})),follow=out.find(e=>e.event==='followup');assert.match(follow.data.team.href,/^https:\/\/wa\.me\/962790025430/);assert.match(follow.data.team.label,/فريق/);assert.equal(out.at(-1).event,'error');assert.equal(out.at(-1).data.code,'PROVIDER_HTTP_503');assert.equal(out.filter(e=>e.event==='products').length,0);assert.doesNotMatch(JSON.stringify(out),/private-provider-detail/);assert.equal(f.db.prepare('SELECT failures FROM care_assistant_usage').get().failures,1)}finally{globalThis.fetch=old;f.close()}
});


test('Delivery and management FAQs return exact owner facts without provider inference or daily quota spend',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('FAQ must be immediate')};
 try{for(const [message,pattern]of [['لو طلبت الساعة 7 مساء متى بيوصل الطلب؟',/بكرا.*٣ العصر/],['بدي رقم الادارة واتساب',/0790025430/]]){const out=await events(await publicLumaChat(request({message}),f.env,helpers,{}));assert.equal(out.at(-1).event,'done');assert.match(out.find(e=>e.event==='delta').data.text,pattern)}assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});
test('Luma suppresses budget questions even on explicit shopping requests and still finishes the routine',async()=>{
 const f=fixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;const sent=JSON.parse(options.body);assert.match(sent.system_instruction,/CATALOG=.*TSDEMO1/s);return stream([chunk([{functionCall:calls===1?{name:'ask_question',args:{field:'budget',text:'شو ميزانيتك؟',profile:{area:'face'}}}:{...show,args:{...show.args,carePlan:'غسل لطيف، ترطيب وحماية من الشمس. بدون فرك أو عصر للحبوب.',budgetFils:500,budgetConfirmed:true,profile:{area:'face'}}}}])])};
 try{const out=await events(await publicLumaChat(request({message:'حبوب خفيفة سطحية في وجهي بدون ألم، بدي أشتري منتجات لروتين بسيط',profile:{area:'face'}}),f.env,helpers,{}));assert.equal(out.at(-1).event,'done');assert.equal(calls,2);assert.equal(out.some(e=>e.event==='question'||e.event==='handoff'||e.event==='followup'),false);assert.equal(out.find(e=>e.event==='products').data.routine.length,2);assert.equal(out.find(e=>e.event==='products').data.confirmedBudgetFils,null)}finally{globalThis.fetch=old;f.close()}
});

test('A failed provider still completes an ordinary guided routine using only validated everyday stock',async()=>{
 const f=fixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>json({error:{message:'Unavailable'}},503);
 f.db.prepare("UPDATE products SET description='Gentle hydrating face cleanser' WHERE id='TSDEMO1'").run();
 f.db.prepare("INSERT INTO products(id,brand,name,category,details_json,description,reference_price_fils,price_fils,stock,approved,active,image_url) VALUES('TSDEMO4','Example','Snow White Spot Gel','البشرة','{\"productType\":\"moisturizer\"}','Moisturizing cream',500,500,4,1,1,'/images/test.webp')").run();
 try{
  const out=await events(await publicLumaChat(request({
   message:'بدي روتين صباحي ومسائي لبشرتي الجافة',guided:true,intent:'routine',
   profile:{area:'face',skinType:'dry'},budgetFils:8000
  }),f.env,helpers,{}));
  assert.equal(out.at(-1).event,'done');
  assert.equal(out.at(-1).data.source,'backup');
  assert.equal(out.some(event=>event.event==='error'),false);
  const products=out.find(event=>event.event==='products').data;
  assert.match(products.carePlan,/صباحًا.*مساءً/s);
  assert.deepEqual(products.routine.map(p=>p.id),['TSDEMO1','TSDEMO2']);
  assert.equal(products.totalFils,8000);
  assert.equal(f.db.prepare('SELECT failures FROM care_assistant_usage').get().failures,1);
 }finally{globalThis.fetch=old;f.close();}
});

test('Single-item and cheaper follow-ups use the last rendered recommendations and do not need another provider turn',async()=>{
 const f=fixture(),old=globalThis.fetch;
 let paidCalls=0;
 globalThis.fetch=async()=>{paidCalls++;throw Error('provider unavailable');};
 f.db.prepare('UPDATE products SET price_fils=2000 WHERE id=?').run('TSDEMO2');
 f.db.prepare("INSERT INTO products(id,brand,name,category,details_json,reference_price_fils,price_fils,stock,approved,active,image_url) VALUES('TSDEMO4','Example','Moisturizer','البشرة','{\"productType\":\"moisturizer\"}',1500,1500,4,1,1,'/images/test.webp')").run();
 try{
  const history=[{role:'user',text:'بدي روتين'}, {role:'model',text:'صباحًا ومساءً.\nالمنتجات المقترحة: TSDEMO1, TSDEMO2'}];
  for(const [message,id,total] of [['من اقتراحاتكِ، بأي منتج واحد أبدأ؟','TSDEMO2',3000],['إذا متوفر، بدّلي آخر اختيار ببديل أرخص يناسب تفضيلاتي.','TSDEMO4',2500]]){
   const out=await events(await publicLumaChat(request({message,history,profile:{area:'face',skinType:'dry'}}),f.env,helpers,{}));
   assert.equal(out.at(-1).event,'done');
   const result=out.find(e=>e.event==='products').data;
   assert.deepEqual(result.routine.map(p=>p.id),[id]);
   assert.equal(result.totalFils,total);
  }
  assert.equal(paidCalls,0);
 }finally{globalThis.fetch=old;f.close();}
});

test('Product usage and price follow-ups still work after a text turn when the inference provider is down',async()=>{
 const f=fixture(),old=globalThis.fetch;
 let providerCalls=0;
 globalThis.fetch=async()=>{providerCalls++;throw Error('provider unavailable');};
 try{
  const history=[
   {role:'user',text:'بدي روتين'}, {role:'model',text:'صباحًا ومساءً.\nالمنتجات المقترحة: TSDEMO1, TSDEMO2'},
   {role:'user',text:'طيب'}, {role:'model',text:'تمام، خدي وقتكِ'}
  ];
  const messages=[
   ['طيب كيف أستعمل آخر منتج اقترحتيه؟',/moisturizer\nتعليمات العبوة/],
   ['كيف أستخدم أول منتج؟',/cleanser\nتعليمات العبوة/],
   ['قديش سعر آخر منتج؟',/moisturizer.*4\.00 د\.أ/s]
  ];
  for(const [message,expected] of messages){
   const out=await events(await publicLumaChat(request({message,history,profile:{area:'face'}}),f.env,helpers,{}));
   assert.equal(out.at(-1).event,'done');
   assert.match(out.find(e=>e.event==='delta')?.data.text||'',expected);
  }
  assert.equal(providerCalls,0);
 }finally{globalThis.fetch=old;f.close();}
});

test('Sunscreen follow-up falls back to a single verified sunscreen when the provider times out',async()=>{
 const f=fixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>json({error:{message:'Unavailable'}},503,{'retry-after':'60'});
 try{
  const out=await events(await publicLumaChat(request({message:'بدي واقي شمس للوجه'}),f.env,helpers,{}));
  assert.equal(out.at(-1).data.source,'backup');
  const products=out.find(e=>e.event==='products').data;
  assert.deepEqual(products.routine.map(product=>product.id),['TSDEMO3']);
  assert.equal(products.routine[0].period,'am');
 }finally{globalThis.fetch=old;f.close();}
});

test('Lama answers combined payment, authenticity and delivery questions from store configuration during a provider outage',async()=>{
 const f=fixture({enabled:true,billingConfirmed:false,imagesEnabled:false}),old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Operations answers do not need Gemini');};
 try{
  const response=await publicLumaChat(request({contract:'lama-2',message:'شو طريقة الدفع ومتى التوصيل لإربد؟ وهل المنتجات أصلية وبقدر أفحص الختم؟'}),f.env,helpers,{});
  assert.equal(response.status,200);
  const out=await events(response);
  const answer=out.find(e=>e.event==='delta').data.text;
  assert.match(answer,/الدفع|كاش/);
  assert.match(answer,/CliQ/);
  assert.match(answer,/24–48/);
  assert.match(answer,/فوق 19/);
  assert.match(answer,/أصلية 100%/);
  assert.match(answer,/ختم العبوة/);
  assert.equal(out.at(-1).event,'done');
  assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0);
 }finally{globalThis.fetch=old;f.close();}
});

test('Lama identifies a sold-out named product and explains documented amount, timing, pairings and cautions without guessing',async()=>{
 const f=fixture(),old=globalThis.fetch;
 const details={productType:'serum',nameAr:'سيروم التوت التجريبي من أرينسيا',benefits:['ترطيب'],howToUse:'ضعيه على بشرة نظيفة.\nوزعيه بلطف بعيدًا عن العين.',usage:{amount:'قطرتان',when:'مساءً',combine:'مرطب خفيف بعدها',avoid:'تجنّبي العينين'}};
 f.db.prepare('UPDATE products SET name=?,brand=?,details_json=?,stock=0 WHERE id=?').run('Arencia Berry Serum','Arencia',JSON.stringify(details),'TSDEMO1');
 globalThis.fetch=()=>{throw Error('Product usage does not need Gemini');};
 try{
  const out=await events(await publicLumaChat(request({contract:'lama-2',message:'كيف أستخدم سيروم التوت التجريبي من أرينسيا؟'}),f.env,helpers,{}));
  const text=out.find(e=>e.event==='delta')?.data.text||'';
  assert.match(text,/1\. ضعيه.*2\. وزعيه/s);
  assert.match(text,/قطرتان.*مساءً.*مرطب خفيف.*تجنّبي العينين/s);
  assert.deepEqual(out.find(e=>e.event==='reference')?.data.productIds,['TSDEMO1']);
  assert.equal(out.at(-1).event,'done');
 }finally{globalThis.fetch=old;f.close();}
});

test('Lama sends ten recent messages as ordered Gemini turns, with live facts, preferences and optional tools',async()=>{
 const f=fixture(),old=globalThis.fetch;
 const {LAMA_SYSTEM_INSTRUCTION}=await import('../src/lama-system.js');
 const history=Array.from({length:16},(_,index)=>({role:index%2?'model':'user',text:'رسالة '+index}));
 f.db.prepare("UPDATE products SET stock=0 WHERE id='TSDEMO3'").run();
 let calls=0;
 globalThis.fetch=async(url,init)=>{
  calls++;
  assert.match(url,/models\/gemini-3\.5-flash-lite:streamGenerateContent\?alt=sse$/);
  const payload=JSON.parse(init.body),system=payload.systemInstruction.parts[0].text;
  assert.ok(system.startsWith(LAMA_SYSTEM_INSTRUCTION));
  assert.match(system,/STORE_CONFIG=.*freeAboveFils/s);
  const catalog=JSON.parse(system.match(/^PRODUCTS_JSON=(.+)$/m)[1]);
  assert.deepEqual(catalog.rows,[]);
  assert.deepEqual(payload.tools[0].functionDeclarations.map(tool=>tool.name),['get_catalog']);
  assert.equal(payload.generationConfig.responseMimeType,undefined);
  assert.equal(payload.generationConfig.thinkingConfig.thinkingLevel,'medium');
  assert.equal(payload.toolConfig.functionCallingConfig.mode,'AUTO');
  assert.equal(payload.contents.length,11);
  assert.deepEqual(payload.contents[0],{role:'user',parts:[{text:'رسالة 6'}]});
  assert.deepEqual(payload.contents.at(-2),{role:'model',parts:[{text:'رسالة 15'}]});
  const profile=JSON.parse(system.match(/^VISITOR_PROFILE=(.+)$/m)[1]);
  assert.equal(profile.skinType,'dry');
  assert.deepEqual(profile.likedProductIds,['TSDEMO2']);
  return json(chunk([{text:'أول خطوة اختاري قوامًا مناسبًا. بعد ذلك خدي خطوة واحدة بالتدريج.'}]));
 };
 try{
  const out=await events(await publicLumaChat(request({contract:'lama-2',message:'كيف بجهّز شنطة عناية بسيطة لما أسافر؟',history,profile:{skinType:'dry',ageGroup:'25-34',likedProductIds:['TSDEMO2']}}),f.env,helpers,{}));
  assert.equal(calls,1);
  assert.equal(out.at(-1).event,'done');
  assert.match(out.find(e=>e.event==='delta').data.text,/أول خطوة/);
 }finally{globalThis.fetch=old;f.close();}
});

test('Lama asks for a missing age band without repeating known skin type or concern, and can skip it',async()=>{
 const f=fixture({enabled:true,billingConfirmed:false,imagesEnabled:false}),old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Intake and fallback do not need Gemini');};
 try{
  const saved={skinType:'dry',goal:'dryness'};
  const input={contract:'lama-2',message:'بدي روتين لوجهي',profile:saved};
  const first=await events(await publicLumaChat(request(input),f.env,helpers,{}));
  assert.equal(first.find(e=>e.event==='question').data.question.field,'ageGroup');
  assert.equal(first.some(e=>e.event==='products'),false);
  const skipped=await events(await publicLumaChat(request({...input,message:'خلينا نكمل',intent:'routine',skippedFields:['ageGroup']}),f.env,helpers,{}));
  assert.equal(skipped.some(e=>e.event==='question'),false);
  assert.equal(skipped.at(-1).event,'done');
  const answer=skipped.find(e=>e.event==='delta')?.data.text;
  assert.match(answer,/صباحًا.*مساءً/s);
 }finally{globalThis.fetch=old;f.close();}
});


test('Lama answers a general product-order question immediately even with a routine in progress and Gemini unavailable',async()=>{
 const f=fixture({enabled:true,billingConfirmed:false,imagesEnabled:false}),old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Generic product-order answers do not need Gemini');};
 try{
  const out=await events(await publicLumaChat(request({
   contract:'lama-2',intent:'routine',message:'شو الفرق بين الإيسنس والتونر؟ مين بيجي أول في الروتين؟'
  }),f.env,helpers,{}));
  assert.equal(out.at(-1).event,'done');
  assert.equal(out.some(e=>e.event==='question'||e.event==='provider'),false);
  assert.match(out.find(e=>e.event==='delta').data.text,/التونر، بعده الإيسنس/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0);
 }finally{globalThis.fetch=old;f.close();}
});

test('Lama enlists the hosted model after both Gemini attempts fail and still remembers the conversation',async()=>{
 const f=fixture(),original=globalThis.fetch;
 const attempted=[];
 let hostedCalls=0;
 globalThis.fetch=async url=>{attempted.push(url);return json({error:{status:'UNAVAILABLE',message:'Private provider detail'}},503);};
 f.env.LAMA_AI={run:async(model,body)=>{
  hostedCalls++;
  assert.equal(model,'@cf/google/gemma-4-26b-a4b-it');
  assert.deepEqual(body.chat_template_kwargs,{enable_thinking:false});
  assert.equal(body.response_format.json_schema.strict,true);
  const context=JSON.parse(body.messages[1].content);
  assert.match(context.question,/اجتماع/);
  assert.match(context.history.at(-1).text,/بجفاف/);
  assert.deepEqual(context.products,[]);
  assert.doesNotMatch(JSON.stringify(context.history),/TSDEMO1|المنتجات المقترحة/);
  assert.equal(context.profile.skinType,'dry');
  assert.equal(body.messages.some(row=>row.content.includes('0790012345')),false);
  return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({action:'answer_customer',text:'تمام يا قمر. ربّتي على المناطق اللي تكتلت بمنديل نظيف. وزّعي الزايد بإسفنجة نظيفة، وحطي لمسة خفيفة بس إذا في فراغ واضح. (TSDEMO1)'})}}],usage:{prompt_tokens:900,completion_tokens:155}};
 }};
 try{
  const out=await events(await publicLumaChat(request({
   contract:'lama-2',intent:'routine',message:'مكياجي تكّتَل وعندي اجتماع قريب، كيف بصلّحه؟ للتواصل 0790012345',profile:{skinType:'dry'},
   history:[{role:'user',text:'بشرتي فيها جفاف'},{role:'model',text:'إذا بتحسّي بجفاف خلّينا نختار خطوات لطيفة.\nالمنتجات المقترحة: TSDEMO1'}]
  }),f.env,helpers,{}));
  assert.equal(out.at(-1).event,'done');
  assert.equal(out.at(-1).data.source,'backup-ai');
  assert.equal(out.some(item=>item.event==='error'),false);
  assert.match(out.find(item=>item.event==='delta').data.text,/ربّتي/);
  assert.doesNotMatch(out.find(item=>item.event==='delta').data.text,/TSDEMO1/);
  assert.equal(attempted.length,2);
  assert.match(attempted[1],/gemini-3\.6-flash/);
  assert.equal(hostedCalls,1);
  assert.equal(f.db.prepare('SELECT successes FROM care_assistant_usage').get().successes,1);
 }finally{globalThis.fetch=original;f.close();}
});

test('The text backup keeps the question and recent history within its bounded message envelope',async()=>{
 const {lamaBackupRequest}=await import('../src/lama-backup.js');
 const input={
  message:'عندي طلعة ومحتاجة نصائح. '+('"\\'.repeat(660)),
  intent:'routine',area:'makeup',skinType:'dry',sensitive:'yes',goal:'texture',preferredRoutine:'makeup',
  history:Array.from({length:16},(_,i)=>({role:i%2?'model':'user',text:'متابعة رقم '+i+' '+('تفاصيل '.repeat(300))}))
 };
 const products=Array.from({length:9},(_,i)=>({id:'TSITEM'+i,name:'المنتج التجريبي '.repeat(12),type:'moisturizer',benefits:['تفاصيل '.repeat(60)]}));
 const request=lamaBackupRequest(input,products);
 assert.ok(request.messages.reduce((sum,msg)=>sum+Buffer.byteLength(msg.content),0)<=3750);
 assert.ok(request.max_tokens<=480);
 assert.match(JSON.parse(request.messages[1].content).question,/طلعة/);
});

test('A provider recommendation still rejects fabricated item IDs on the hosted fallback',async()=>{
 const f=fixture();
 const original=globalThis.fetch;
 globalThis.fetch=async()=>json({error:{status:'UNAVAILABLE'}},503);
 f.env.LAMA_AI={run:async()=>({response:{action:'show_products',text:'هذا المنتج من المتجر',area:'face',productIds:['TSMADEUP']}})};
 try{
  const out=await events(await publicLumaChat(request({contract:'lama-2',message:'ممكن ترشحيلي منتج من المتجر يعطي بشرتي مظهر أنعم؟',profile:{area:'face'}}),f.env,helpers,{}));
  assert.equal(out.some(item=>item.event==='products'),false);
  assert.doesNotMatch(JSON.stringify(out),/TSMADEUP|هذا المنتج من المتجر/);
 }finally{globalThis.fetch=original;f.close();}
});

test('Verified shopping cards use the catalog area even if the hosted model guesses the wrong area',async()=>{
 const f=fixture(),original=globalThis.fetch;
 globalThis.fetch=async()=>json({error:{status:'UNAVAILABLE'}},503);
 f.env.LAMA_AI={run:async(_model,body)=>{
  const products=JSON.parse(body.messages[1].content).products;
  assert.ok(products.some(product=>product.id==='TSDEMO2'&&product.type==='moisturizer'&&product.areas.includes('face')));
  return {response:{action:'show_products',text:'حطي المرطب بعد الغسل. (TSDEMO2)',area:'body',productIds:['TSDEMO2','TSMADEUP'],selections:[{productId:'TSDEMO2',reason:'للترطيب بعد الغسل.'}]}};
 }};
 try{
  const out=await events(await publicLumaChat(request({contract:'lama-2',message:'ممكن ترشحيلي مرطب من المتجر للبشرة الجافة؟',profile:{skinType:'dry'}}),f.env,helpers,{}));
  assert.equal(out.at(-1).data.source,'backup-ai');
  assert.deepEqual(out.find(item=>item.event==='products').data.routine.map(product=>product.id),['TSDEMO2']);
  assert.doesNotMatch(out.find(item=>item.event==='delta').data.text,/TSDEMO2/);
 }finally{globalThis.fetch=original;f.close();}
});
