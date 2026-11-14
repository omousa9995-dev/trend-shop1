import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import worker from '../src/worker.js';
import {requestGemini} from '../src/gemini-provider.js';
import {readGeminiStream,visibleActionText} from '../src/gemini-stream.js';
import {lumaSystem,runLumaTool} from '../src/luma-assistant.js';
import {lumaLiveFaq} from '../src/luma-faq.js';
const enc=new TextEncoder(),event=(type,data)=>'event: '+type+'\ndata: '+JSON.stringify({...data,event_type:type})+'\n\n';
const tick=()=>new Promise(r=>setTimeout(r,3)),until=async fn=>{for(let i=0;i<200&&!fn();i++)await tick();assert.ok(fn(),'Expected state was not reached')};
function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));db.prepare('UPDATE care_assistant_settings SET config_json=? WHERE id=1').run(JSON.stringify({enabled:true,imagesEnabled:true,billingConfirmed:true,dailyLimit:50,model:'gemini-3.5-flash-lite'}));
 db.exec("INSERT INTO products(id,brand,name,category,price_fils,reference_price_fils,stock,approved,active,details_json) VALUES('TS9001','Fixture','Everyday Foundation','المكياج',9990,12000,5,1,1,'{\"productType\":\"foundation\",\"nameAr\":\"فاونديشن اختبار\",\"options\":[{\"id\":\"tone-1\",\"label\":\"فاتح\"},{\"id\":\"tone-2\",\"label\":\"متوسط\"}]}')");
 const statement=(q,args=[])=>({bind:(...v)=>statement(q,v),all:async()=>({results:db.prepare(q).all(...args)}),first:async()=>db.prepare(q).get(...args)||null,run:async()=>({meta:{changes:Number(db.prepare(q).run(...args).changes)}})});
 return {db,env:{DB:{prepare:q=>statement(q)},GEMINI_API_KEY:'fake-local-key-never-real',SESSION_SECRET:'local-test-secret-longer-than-32-characters'},request:body=>new Request('https://trend.test/api/chat',{method:'POST',headers:{origin:'https://trend.test','x-trend-care':'1','content-type':'application/json'},body:JSON.stringify(body)})};
}
test('Only visible top-level action text streams; escapes, partial Unicode and non-display actions stay private',()=>{
 const json=JSON.stringify({action:'answer_customer',text:'أهلًا "فيكِ"\nترطيب ♡',profile:{area:'face'}});
 let last='';for(let i=1;i<=json.length;i++){const part=visibleActionText(json.slice(0,i));if(part){assert.ok('أهلًا "فيكِ"\nترطيب ♡'.startsWith(part.text));last=part.text;}}
 assert.equal(last,'أهلًا "فيكِ"\nترطيب ♡');assert.equal(visibleActionText('{"action":"get_catalog","text":"private"}'),null);
 assert.deepEqual(visibleActionText('{"action":"answer_customer","text":"hi\\u0627'),{action:'answer_customer',text:'hiا'});
 assert.equal(visibleActionText('{"action":"answer_customer","text":"hi\\u06').text,'hi');assert.equal(visibleActionText('{"action":"answer_customer","text":"\\uD83D').text,'');
 assert.equal(visibleActionText('{"action":"unknown","text":"private"}'),null);
 assert.equal(visibleActionText('{"action":"show_products","productIds":["TS9001"],"area":"makeup","text":"اقتراح').args.productIds[0],'TS9001');
});
test('Provider tokens arrive before completion, thoughts never leak, and terminal events do not wait for EOF or cancellation',async()=>{
 let controller,cancelled=0,finished=false;const seen=[];
 const response=new Response(new ReadableStream({start(c){controller=c},cancel(){cancelled++;return new Promise(()=>{})}}));
 const result=readGeminiStream(response,{api:'interactions',onTextDelta:t=>seen.push(t)}).then(v=>{finished=true;return v});
 controller.enqueue(enc.encode(event('step.start',{index:0,step:{type:'thought'}})+event('step.delta',{index:0,delta:{type:'thought_summary',content:{text:'private'}}})+event('step.start',{index:1,step:{type:'model_output'}})+event('step.delta',{index:1,delta:{type:'text',text:'أهلًا '}})));
 await until(()=>seen.length===1);assert.equal(finished,false);assert.equal(seen[0],'أهلًا ');
 controller.enqueue(enc.encode(event('step.delta',{index:1,delta:{type:'text',text:'فيكِ'}})+event('interaction.completed',{interaction:{status:'completed',usage:{total_input_tokens:10,total_output_tokens:5}}})));
 const value=await result;assert.equal(value.candidates[0].content.parts[0].text,'أهلًا فيكِ');assert.equal(cancelled,1);assert.doesNotMatch(JSON.stringify(value),/private/);
});
test('generateContent SSE and bounded provider fallback keep complete canonical action output',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let calls=0;const seen=[],attempts=[];
 globalThis.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);if(calls===1){assert.equal(body.stream,true);return new Response(event('step.delta',{index:0,delta:{type:'text',text:'{"action":"answer_customer","text":"partial'}})+event('interaction.completed',{interaction:{status:'completed'}}),{headers:{'content-type':'text/event-stream'}})}
  assert.match(url,/:streamGenerateContent\?alt=sse$/);const action=JSON.stringify({action:'answer_customer',text:'نصيحة مكتملة',profile:{}});
  return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:action.slice(0,30)}]}}]})+'\n\ndata: '+JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:action.slice(30)}]}}]})+'\n\n',{headers:{'content-type':'text/event-stream'}});
 };
 const out=await requestGemini({apiKey:'fake-local',primary:'gemini-3.5-flash-lite',transport:'actions',payload:{contents:[]},onTextDelta:t=>seen.push(t),onAttempt:a=>attempts.push(a)});
 assert.equal(calls,2);assert.equal(out.data.candidates[0].content.parts[0].functionCall.args.text,'نصيحة مكتملة');assert.ok(seen.length>=3);assert.equal(attempts[0].ok,false);assert.equal(attempts[1].ok,true);
});
test('The real chat route forwards visible partial text before the provider finishes, then completes normally',async t=>{
 const f=fixture(t),original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let upstream;
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){upstream=c}}),{headers:{'content-type':'text/event-stream'}});
 const response=await worker.fetch(f.request({message:'كيف أرتب صباحي؟'}),f.env,{}),reader=response.body.getReader(),decoder=new TextDecoder();let text='';
 await until(()=>!!upstream);upstream.enqueue(enc.encode(event('step.delta',{index:1,delta:{type:'text',text:'{"action":"answer_customer","text":"ابدئي بخطوة بسيطة'}})));
 while(!text.includes('event: replace')){text+=decoder.decode((await reader.read()).value)}
 assert.match(text,/ابدئي بخطوة بسيطة/);assert.doesNotMatch(text,/event: done|functionCall|ACTION CONTRACT/);
 upstream.enqueue(enc.encode(event('step.delta',{index:1,delta:{type:'text',text:' اليوم.","profile":{},"followUp":false}'}})+event('interaction.completed',{interaction:{status:'completed'}})));
 while(true){const r=await reader.read();if(r.done)break;text+=decoder.decode(r.value)}assert.match(text,/event: done/);assert.doesNotMatch(text,/event: error/);
});
test('A usable own-hand makeup photo can suggest a verified tone family without inventing shades',async t=>{
 const f=fixture(t),input={message:'هذه صورة إيدي، أي درجة فاونديشن أقرب؟',image:{mimeType:'image/jpeg',data:'test'},profile:{},history:[],area:'makeup',skinType:'unknown',sensitive:'unknown',ageGroup:'unknown',lifeStage:'unknown',existingIds:[],budgetFils:null,includeDelivery:true};
 const result=await runLumaTool({name:'show_products',args:{productIds:['TS9001'],area:'makeup',imageDisposition:'usable',carePlan:'اللون الظاهر مبدئيًا متوسط؛ جرّبي الدرجة على الفك بإضاءة النهار.',profile:{area:'makeup'},selections:[{productId:'TS9001',optionId:'tone-2',reason:'أقرب عائلة درجات متاحة'}]}},input,f.env);
 assert.equal(result.type,'products');assert.deepEqual(result.routine[0].recommendedOption,{id:'tone-2',label:result.routine[0].options.find(o=>o.id==='tone-2').label});
 const invalid=await runLumaTool({name:'show_products',args:{productIds:['TS9001'],area:'makeup',imageDisposition:'usable',selections:[{productId:'TS9001',optionId:'unverified-215'}]}},input,f.env);assert.equal(invalid.routine[0].recommendedOption,undefined);
 assert.match(lumaSystem(input,[]),/own hand\/wrist\/face photo/);assert.match(lumaSystem(input,[]),/Product cards come LAST/);
});
test('Authenticity and promotion answers use confirmed facts, current price and real campaign expiry',async t=>{
 const f=fixture(t),input={message:'هل منتجاتكم أصلية؟',history:[]};const authentic=await lumaLiveFaq(input,f.env);assert.match(authentic.text,/تأكيد المصدر/);assert.doesNotMatch(authentic.text,/100%|مضمونة|أصلية بالكامل/);
 const now=Math.floor(Date.now()/1000);f.db.prepare('INSERT INTO limited_offers(slot,product_id,price_fils,starts_at,ends_at,request_id) VALUES(1,\'TS9001\',6490,?,?,\'test\')').run(now-10,now+100);
 let reply=await lumaLiveFaq({message:'عندكم عروض لفترة محدودة؟',history:[]},f.env);assert.match(reply.text,/6\.49/);assert.match(reply.text,/9\.99/);
 f.db.prepare('UPDATE limited_offers SET ends_at=?').run(now-1);reply=await lumaLiveFaq({message:'عندكم عروض لفترة محدودة؟',history:[]},f.env);assert.match(reply.text,/ما في عرض مؤقت مفعّل/);assert.doesNotMatch(reply.text,/6\.49/);
});

const widgetBundle=buildSync({entryPoints:[new URL('../public/luma-widget.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'Widget',write:false,logLevel:'silent'}).outputFiles[0].text;
test('The camera and clear new-chat action remain usable; retry preserves the next draft and avoids duplicate messages',async t=>{
 const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://trend.test',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};let calls=0;const payloads=[];
 w.fetch=async(url,init)=>{calls++;payloads.push(JSON.parse(init.body));if(calls===1)throw Error('temporary');return new Response('event: replace\ndata: {"text":"نصيحة"}\n\nevent: replace\ndata: {"text":"نصيحة مكتملة"}\n\nevent: done\ndata: {}\n\n')};w.eval(widgetBundle);const api=await w.Widget.mountLumaWidget({status:{available:true,imagesAvailable:true}});t.after(()=>{api.destroy();dom.window.close()});api.open();
 assert.ok(api.dialog.querySelector('.luma-photo-button svg'));assert.equal(api.dialog.querySelector('.luma-photo-button').textContent,'');assert.match(api.dialog.querySelector('.luma-head [data-luma-reset]').textContent,/محادثة جديدة/);
 const input=api.dialog.querySelector('textarea');input.value='سؤالي';api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>calls===1&&api.dialog.getAttribute('aria-busy')==='false');input.value='السؤال التالي';api.dialog.querySelector('[data-luma-retry]').click();await until(()=>calls===2&&api.dialog.getAttribute('aria-busy')==='false');
 assert.equal(api.dialog.querySelectorAll('.luma-user').length,1);assert.equal(input.value,'السؤال التالي');assert.deepEqual(payloads[1],payloads[0]);assert.match(api.dialog.querySelector('.luma-model:last-child').textContent,/نصيحة مكتملة/);
 api.dialog.querySelector('[data-luma-reset]').click();assert.equal(api.dialog.querySelectorAll('.luma-user').length,0);assert.equal(input.value,'');assert.equal(api.dialog.querySelector('.luma-send').disabled,false);
});
test('An image decode timeout unlocks the composer, then a valid photo can be sent and retried unchanged',async t=>{
 const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://trend.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;let api;t.after(()=>{api?.destroy();w.close()});
 w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.URL.createObjectURL=()=> 'blob:local-photo';w.URL.revokeObjectURL=()=>{};
 let hang=true;w.Image=class{naturalWidth=800;naturalHeight=600;decode(){return hang?new Promise(()=>{}):Promise.resolve()}};
 const timeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>timeout(fn,ms===8000?5:ms,...args);
 const data=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(200)]).toString('base64');w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,'+data;
 let calls=0;const requests=[];w.fetch=async(url,init)=>{requests.push(JSON.parse(init.body));if(++calls===1)throw Error('temporary');return new Response('event: delta\ndata: {"text":"وصلت الصورة"}\n\nevent: done\ndata: {}\n\n')};
 w.eval(widgetBundle);api=await w.Widget.mountLumaWidget({status:{available:true,imagesAvailable:true}});api.open();const file=api.dialog.querySelector('[data-luma-photo]');Object.defineProperty(file,'files',{configurable:true,value:[new w.File([new Uint8Array([1,2,3])],'photo.jpg',{type:'image/jpeg'})]});file.dispatchEvent(new w.Event('change'));await until(()=>!api.dialog.querySelector('.luma-send').disabled);assert.equal(api.dialog.querySelector('.luma-image-preview').hidden,true);
 hang=false;file.dispatchEvent(new w.Event('change'));await until(()=>!api.dialog.querySelector('.luma-image-preview').hidden);const message=api.dialog.querySelector('textarea');message.value='ساعديني بدرجة الفاونديشن';api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>calls===1&&api.dialog.getAttribute('aria-busy')==='false');message.value='مسودة السؤال التالي';api.dialog.querySelector('[data-luma-retry]').click();await until(()=>calls===2&&api.dialog.getAttribute('aria-busy')==='false');
 assert.equal(requests[0].image.data,data);assert.equal(requests[1].image.data,data);assert.equal(message.value,'مسودة السؤال التالي');assert.equal(api.dialog.querySelector('.luma-image-preview').hidden,true);assert.equal(api.dialog.querySelectorAll('.luma-user').length,1);
});
