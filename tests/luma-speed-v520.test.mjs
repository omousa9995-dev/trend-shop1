import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import {consumeLumaStream,appendLumaHistory} from '../public/luma-stream.js';
import {lumaStoreReply,lumaDeliveryText,quickLumaAdvice,explicitLumaBudget,shortlistLumaCatalog} from '../src/luma-store-facts.js';
import {validateCareInput} from '../src/care-assistant.js';
const pause=()=>new Promise(r=>setTimeout(r,3));
const until=async check=>{for(let i=0;i<150&&!check();i++)await pause();assert.ok(check(),'UI did not reach expected state')};
const bytes=new TextEncoder(),event=(name,data={})=>'event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n';
const bundle=buildSync({entryPoints:[new URL('../public/luma-widget.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'LumaWidget',write:false,logLevel:'silent',target:'es2022'}).outputFiles[0].text;
async function ui(network){const dom=new JSDOM('<!doctype html><html><head></head><body><button id="outside">المتجر</button></body></html>',{url:'https://trend.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.scrollTo=()=>{};w.fetch=network;w.eval(bundle);const api=await w.LumaWidget.mountLumaWidget({status:{available:true,imagesAvailable:true,dictationAvailable:true}});api.open();return {w,api,send(text){w.document.querySelector('textarea').value=text;w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}))}}}

test('Terminal done releases a reader even if upstream stays open and its cancel never resolves',async()=>{
 let cancelled=0;const body=new ReadableStream({start(c){c.enqueue(bytes.encode(event('delta',{text:'أهلا'})+event('done')))},cancel(){cancelled++;return new Promise(()=>{})}}),seen=[];
 await consumeLumaStream(new Response(body),(name,data)=>seen.push({name,data}));assert.deepEqual(seen.map(e=>e.name),['delta','done']);assert.equal(cancelled,1);
});
test('Explicit abort interrupts a pending read without waiting for EOF',async()=>{
 const controller=new AbortController(),response=new Response(new ReadableStream({start(){},cancel(){return new Promise(()=>{})}}));
 const work=consumeLumaStream(response,()=>{},controller.signal);controller.abort();await assert.rejects(work,{name:'AbortError'});
});
test('Terminal errors ignore trailing events and malformed/incomplete streams remain failures',async()=>{
 const seen=[];await consumeLumaStream(new Response(event('error',{code:'TIMEOUT'})+event('delta',{text:'late'})),e=>seen.push(e));assert.deepEqual(seen,['error']);
 await assert.rejects(consumeLumaStream(new Response('event: delta\ndata: invalid\n\n'),()=>{}));
});
test('Twenty sequential chat turns remain usable without reload, including a network stream that never closes',async()=>{
 const requests=[];let cancels=0;const {w,api,send}=await ui(async(url,init)=>{requests.push(JSON.parse(init.body));return new Response(new ReadableStream({start(c){c.enqueue(bytes.encode(event('profile',{profile:{area:'face',skinType:'dry'}})+event('delta',{text:'نصيحة '+requests.length})+event('products',{area:'face',routine:[{id:'TSDEMO1',name:'مرطب',priceFils:3000}],subtotalFils:3000,shippingFeeFils:1000,totalFils:4000})+event('delta',{text:'متابعة النص بعد البطاقات'})+event('done')))},cancel(){cancels++;return new Promise(()=>{})}}))});
 try{for(let i=1;i<=20;i++){send('سؤال '+i);await until(()=>requests.length===i&&api.dialog.getAttribute('aria-busy')==='false');assert.equal(w.document.querySelector('.luma-send').disabled,false)}
  assert.equal(requests.length,20);assert.equal(cancels,20);assert.equal(requests.at(-1).history.length,16);assert.equal(requests.at(-1).profile.skinType,'dry');
  for(const data of requests)for(let i=0;i<data.history.length;i+=2){assert.equal(data.history[i].role,'user');assert.equal(data.history[i+1].role,'model');assert.match(data.history[i+1].text,/TSDEMO1/)}
  assert.doesNotMatch(api.dialog.querySelector('.luma-log').textContent,/TSDEMO1/);assert.equal(w.localStorage.length,0);assert.equal(api.dialog.querySelectorAll('[data-luma-record],.luma-listen,input[accept*=audio]').length,0);
 }finally{api.destroy();w.close()}
});
test('Cancel, reset and close isolate stale requests from a newly opened conversation and preserve typed drafts',async()=>{
 let first,second,calls=0;const {w,api,send}=await ui(async()=>{calls++;return new Response(new ReadableStream({start(c){if(calls===1)first=c;else second=c},cancel(){return new Promise(()=>{})}}))});
 try{send('أول سؤال');await until(()=>!!first);w.document.querySelector('textarea').value='مسودة';api.close();api.open();assert.equal(w.document.querySelector('.luma-send').disabled,false);assert.equal(w.document.querySelector('textarea').value,'مسودة');send('ثاني سؤال');await until(()=>!!second);first.enqueue(bytes.encode(event('done')));await pause();assert.equal(api.dialog.getAttribute('aria-busy'),'true');second.enqueue(bytes.encode(event('delta',{text:'الرد الثاني'})+event('done')));await until(()=>api.dialog.getAttribute('aria-busy')==='false');assert.match(api.dialog.textContent,/الرد الثاني/);
  send('ثالث');await until(()=>calls===3);w.document.querySelector('[data-luma-reset]').click();assert.equal(api.dialog.getAttribute('aria-busy'),'false');assert.equal(w.document.querySelectorAll('.luma-user').length,0);
 }finally{api.destroy();w.close()}
});
test('A disconnected request can retry without losing the next draft',async()=>{
 let calls=0;const {w,api,send}=await ui(async()=>{calls++;if(calls===1)throw Error('network down');return new Response(event('delta',{text:'تم الرد'})+event('done'))});
 try{send('سؤالي');await until(()=>w.document.querySelector('[data-luma-retry]').hidden===false);w.document.querySelector('textarea').value='السؤال التالي';w.document.querySelector('[data-luma-retry]').click();await until(()=>calls===2&&api.dialog.getAttribute('aria-busy')==='false');assert.equal(w.document.querySelector('textarea').value,'السؤال التالي');assert.equal(w.document.querySelector('[data-luma-retry]').hidden,true)}finally{api.destroy();w.close()}
});
test('Delivery uses Jordan time, including 7pm tomorrow-before-3 estimate and appointment notes',()=>{
 const evening=new Date('2026-11-13T16:00:00Z'),reply=lumaStoreReply('متى بيوصل الطلب للعقبة؟',evening);assert.match(reply.text,/لجميع مناطق/);assert.match(reply.text,/٢٤ ساعة/);assert.match(reply.text,/بكرا.*٣ العصر/);assert.match(reply.text,/الملاحظات/);assert.match(lumaDeliveryText('لو ثبتت الساعة 7 مساء',new Date('2026-11-13T06:00:00Z')),/بكرا.*٣ العصر/);assert.doesNotMatch(lumaDeliveryText('',new Date('2026-11-13T06:00:00Z')),/بكرا/);
});
test('Management contact is exact, mixed care stays with inference and voluntary budgets are optional',()=>{
 assert.equal(lumaStoreReply('بدي رقم الإدارة واتساب').team.href,'https://wa.me/962790025430');assert.match(lumaStoreReply('رقمكم').text,/\+962790025430/);assert.equal(lumaStoreReply('حبوب بظهري والتوصيل متى؟'),null);assert.equal(explicitLumaBudget('ميزانيتي ١٥ دينار'),15000);assert.equal(explicitLumaBudget('ما يزيد عن 12.5 دينار'),12500);assert.equal(explicitLumaBudget('كم سعر الغسول؟'),null);
});
test('Server and client bound long histories by pairs and size',()=>{
 let history=[];for(let i=0;i<30;i++)history=appendLumaHistory(history,'س'.repeat(1500),'ج'.repeat(2400));assert.ok(history.reduce((n,x)=>n+x.text.length,0)<=12000);assert.equal(history.length%2,0);const input=validateCareInput({message:'مرحبا',history},false,{requireConsent:false});assert.ok(input.history.length<=16);assert.ok(input.history.reduce((n,x)=>n+x.text.length,0)<=12000);
});
test('Shortlist includes complementary body acne facts without crossing into face-only items',()=>{
 const base={lumaCandidate:true,priceFils:3000,brand:'Test',careClass:'everyday'},products=[{...base,id:'TSFACE1',name:'Face cream',type:'moisturizer',areas:['face']},{...base,id:'TSBODY1',name:'Body lotion',type:'body-care',areas:['body']},{...base,id:'TSACNE4',name:'PanOxyl 4%',type:'cleanser',areas:['face','body'],careClass:'otc-acne-wash',activeStrength:'4%'}];const chosen=shortlistLumaCatalog(products,{message:'حبوب بالظهر',history:[],existingIds:[],budgetFils:null,area:'unknown'});assert.deepEqual(chosen.map(p=>p.id),['TSACNE4','TSBODY1']);
});
test('Site entry avatar reuses the actual site girl in header, footer and text-only dialog',()=>{const shell=readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),dom=new JSDOM(shell);assert.equal(dom.window.document.querySelectorAll('[data-care-region] img[src="/images/editorial/beauty-hero-v2.webp"]').length,2);dom.window.close();assert.doesNotMatch(bundle,/speechSynthesis|getUserMedia|MediaRecorder|luma-speech/)});

test('Clear non-shopping dryness and hydration questions receive immediate advice while medical constraints stay outside fast advice',()=>{
 const input={message:'كيف نهتم بجفاف البشرة يوميا؟ بدون منتجات حاليا',history:[]};assert.match(quickLumaAdvice(input).text,/رطبة شوي/);input.history=[{role:'user',text:input.message}];input.message='هل شرب الماء وحده بكفي؟';assert.match(quickLumaAdvice(input).text,/ما بتكفي/);input.message='عندي مرض كلى وجفاف، كم أشرب ماء؟';assert.equal(quickLumaAdvice(input),null);input.message='حبوب مؤلمة مع صديد، بدون منتجات';assert.equal(quickLumaAdvice(input),null);
});

test('Current oily-acne intent outranks earlier dryness and repeated assistant prose',()=>{
 const base={lumaCandidate:true,priceFils:3000,brand:'Test',areas:['face'],careClass:'everyday'},products=[{...base,id:'TSDRY01',name:'Rich intensive dry skin cream',type:'moisturizer'},{...base,id:'TSOILY1',name:'Light gel for oily skin',type:'moisturizer'},{...base,id:'TSACNE4',name:'PanOxyl',type:'cleanser',careClass:'otc-acne-wash',activeStrength:'4%'}];const chosen=shortlistLumaCatalog(products,{message:'حبوب الوجه للبشرة الدهنية',history:[{role:'model',text:'جفاف '.repeat(50)}],existingIds:[],budgetFils:null,area:'face',skinType:'unknown'});assert.equal(chosen[0].id,'TSACNE4');assert.ok(chosen.findIndex(p=>p.id==='TSOILY1')<chosen.findIndex(p=>p.id==='TSDRY01'));
});

test('A current acne hydration question takes precedence over earlier dry-skin context',()=>{
 const result=quickLumaAdvice({message:'هل الماء وحده يعالج الحبوب؟',history:[{role:'user',text:'عندي جفاف باليدين'},{role:'model',text:'اشربي ماء بشكل متوازن ورطبي يديك'}]});assert.match(result.text,/مش علاج للحبوب/);assert.doesNotMatch(result.text,/لعلاج جفاف البشرة/);
});
