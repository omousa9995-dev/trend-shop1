import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
import worker,{_test} from '../src/worker.js';
import {careCatalog,normalizeCareResult,validateCareInput,buildCarePrompt,encryptCareKey,decryptCareKey,publicCareChat,adminCare,publicCareStatus} from '../src/care-assistant.js';

const secret='test-care-assistant-encryption-secret-0123456789';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const helpers={json,error:(message,status=400,extra={})=>json({error:message,...extra},status),sameOrigin:req=>req.headers.get('origin')===new URL(req.url).origin,content:async(req,max)=>_test.content(req,max),throttle:async()=>true};
const input=(extra={})=>({adultConfirmed:true,googleConsent:true,consentVersion:'care-2026-11-v2',budgetFils:15000,includeDelivery:true,profile:{area:'face',skinType:'dry',goal:'basic',sensitive:'unknown'},...extra});
const request=(body,path='/api/care/chat')=>new Request('https://trend.test'+path,{method:'POST',headers:{'content-type':'application/json','origin':'https://trend.test','x-trend-care':'1','x-trend-admin':'1'},body:JSON.stringify(body)});
function fixture(settings={enabled:true,billingConfirmed:true,imagesEnabled:true,dailyLimit:50,model:'gemini-3.8-flash'}){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 sql.prepare('UPDATE care_assistant_settings SET config_json=? WHERE id=1').run(JSON.stringify(settings));
 for(const [id,type,price]of [['TSDEMO1','cleanser',3000],['TSDEMO2','moisturizer',4000],['TSDEMO3','sunscreen',5000]])sql.prepare('INSERT INTO products(id,brand,name,category,details_json,reference_price_fils,price_fils,stock,approved,active) VALUES(?,?,?,\'البشرة\',?,?,?,10,1,1)').run(id,'Example',type,JSON.stringify({productType:type,nameAr:type,howToUse:'اتبعي تعليمات العبوة.'}),price,price);
 const DB={prepare(query){
  let args=[];const statement=sql.prepare(query);
  return {
   bind(...values){args=values;return this},
   async first(){return statement.get(...args)||null},
   async all(){return {results:statement.all(...args)}},
   async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}
  };
 }};
 return {sql,env:{DB,SESSION_SECRET:secret,GEMINI_API_KEY:'fake-test-key-not-a-real-google-credential'},close:()=>sql.close()};
}
const modelResponse=value=>json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:60,thoughtsTokenCount:20}});
const proposal={message:'اختيارات عناية أساسية حسب تفضيلاتكِ.',productIds:['TSDEMO1','TSDEMO2','TSDEMO3'],questions:[],observations:[],needsProfessional:false};

test('Personalized Google requests require the owner paid-project confirmation as well as a key and explicit activation',async()=>{
 const f=fixture({enabled:true,billingConfirmed:false,imagesEnabled:true});try{let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error()};try{const response=await publicCareChat(request(input()),f.env,helpers);assert.equal(response.status,503);assert.equal(calls,0);const status=await (await publicCareStatus(null,f.env,helpers)).json();assert.equal(status.available,false);assert.equal(status.imagesAvailable,false)}finally{globalThis.fetch=old}}finally{f.close()}
});
test('Age, processing consent, origin, image consent and image transport are checked before inference',async()=>{
 assert.throws(()=>validateCareInput(input({adultConfirmed:false}),true),/CONSENT/);
 assert.throws(()=>validateCareInput(input({googleConsent:false}),true),/CONSENT/);
 assert.throws(()=>validateCareInput(input({budgetFils:0}),true),/BUDGET/);
 assert.throws(()=>validateCareInput(input({image:{mimeType:'image/jpeg',data:'/9j/'+ 'A'.repeat(200)}}),true),/PHOTO_CONSENT/);
 assert.throws(()=>validateCareInput(input({image:{mimeType:'image/jpeg',data:'/9j/'+ 'A'.repeat(200)},photoConsent:true}),false),/IMAGES_DISABLED/);
 assert.throws(()=>validateCareInput(input({image:{mimeType:'image/jpeg',data:'abcd'.repeat(50)},photoConsent:true}),true),/INVALID_IMAGE/);
 const f=fixture();try{const req=request(input());req.headers.set('origin','https://foreign.test');assert.equal((await publicCareChat(req,f.env,helpers)).status,403)}finally{f.close()}
});
test('The live catalog excludes hidden, unapproved, retired, out-of-stock and unsupported categories; active treatments are not cosmetic candidates',()=>{
 const base={id:'TSDEMO1',brand:'Test',name:'Gentle Cream',category:'البشرة',approved:1,stock:1,active:1,price_fils:5000,details_json:'{"productType":"moisturizer"}'};
 const result=careCatalog([base,{...base,id:'TSDEMO2',stock:0},{...base,id:'TSDEMO3',approved:0},{...base,id:'TSDEMO4',active:0},{...base,id:'TSDEMO5',category:'الأدوات'},{...base,id:'TSDEMO6',name:'Retinal Cream'},{...base,id:'TS0023'}]);
 assert.deepEqual(result.map(x=>x.id),['TSDEMO1','TSDEMO6']);assert.equal(result[0].gentleCandidate,true);assert.equal(result[1].gentleCandidate,false);
});
test('New products, updated prices and stock are read fresh on successive real handler requests; candidate input stays bounded',async()=>{
 const f=fixture(),old=globalThis.fetch;let prompts=[];globalThis.fetch=async(url,options)=>{assert.match(url,/generativelanguage\.googleapis\.com/);assert.equal(options.headers['x-goog-api-key'],f.env.GEMINI_API_KEY);const body=JSON.parse(options.body);prompts.push(body.systemInstruction.parts[0].text);assert.equal(body.generationConfig.maxOutputTokens,3072);return modelResponse({...proposal,productIds:['TSNEW01','TSDEMO2']})};
 try{const a=await (await publicCareChat(request(input()),f.env,helpers)).json();assert.deepEqual(a.routine.map(p=>p.id),['TSDEMO2']);f.sql.prepare('INSERT INTO products(id,brand,name,category,details_json,reference_price_fils,price_fils,stock,approved) VALUES(\'TSNEW01\',\'New\',\'Gentle Cleanser\',\'البشرة\',\'{"productType":"cleanser"}\',2000,2000,4,1)').run();const b=await (await publicCareChat(request(input()),f.env,helpers)).json();assert.deepEqual(b.routine.map(p=>p.id),['TSNEW01','TSDEMO2']);assert.notEqual(a.catalogRevision,b.catalogRevision);assert.match(prompts[1],/TSNEW01/);assert.doesNotMatch(prompts[0],/TSNEW01/)}finally{globalThis.fetch=old;f.close()}
});
test('Mid-inference changes are revalidated against live stock and prices',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>{f.sql.prepare('UPDATE products SET stock=0 WHERE id=\'TSDEMO1\'').run();f.sql.prepare('UPDATE products SET price_fils=19000 WHERE id=\'TSDEMO2\'').run();return modelResponse(proposal)};
 try{const data=await (await publicCareChat(request(input()),f.env,helpers)).json();assert.deepEqual(data.routine.map(p=>p.id),['TSDEMO3']);assert.equal(data.totalFils,6000);assert.equal(data.catalogChanged,true)}finally{globalThis.fetch=old;f.close()}
});
test('Model-invented prices, IDs, duplicate products and out-of-budget combinations never control returned cards',()=>{
 const products=careCatalog([{id:'TSDEMO1',name:'cleanser',brand:'Test',category:'البشرة',approved:1,stock:1,price_fils:5000,details_json:'{"productType":"cleanser"}'},{id:'TSDEMO2',name:'cream',brand:'Test',category:'البشرة',approved:1,stock:1,price_fils:6000,details_json:'{"productType":"moisturizer"}'}]);
 const context=validateCareInput(input({budgetFils:10000}),true);const data=normalizeCareResult({...proposal,productIds:['FAKE','TSDEMO1','TSDEMO1','TSDEMO2'],priceFils:1},products,context);assert.deepEqual(data.routine.map(x=>x.id),['TSDEMO1']);assert.equal(data.totalFils,6000);assert.equal(data.routine[0].priceFils,5000);assert.equal(data.routine[0].href,'/#/product/TSDEMO1');
});
test('Existing cart products, redundant steps and clarification questions prevent unnecessary purchases',()=>{
 const products=careCatalog([{id:'TSDEMO1',name:'cream',brand:'Test',category:'البشرة',approved:1,stock:1,price_fils:5000,details_json:'{"productType":"moisturizer"}'}]);
 const context=validateCareInput(input({existingIds:['TSDEMO1']}),true);assert.equal(normalizeCareResult(proposal,products,context).routine.length,0);assert.equal(normalizeCareResult({...proposal,questions:['ما القوام الذي تفضّلينه؟']},products,context).routine.length,0);
 const pool=Array.from({length:100},(_,i)=>({...products[0],id:'TSNEW'+i}));assert.ok(buildCarePrompt(context,pool).eligible.length<=350);
});
test('Warning signs return a professional referral without an AI request or product sale',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not call')};try{const response=await publicCareChat(request(input({profile:{warningSigns:true}})),f.env,helpers);const data=await response.json();assert.equal(data.needsProfessional,true);assert.deepEqual(data.routine,[]);assert.equal(f.sql.prepare('SELECT count(*) n FROM care_assistant_usage').get().n,0)}finally{globalThis.fetch=old;f.close()}
});
test('Photo output is restricted to tentative allowed observations; diagnostic or medication text is rejected',()=>{
 const context=validateCareInput(input(),true);context.image={};const result=normalizeCareResult({...proposal,message:'استخدمي هيدروكينون',observations:['visible_bumps','eczema','visible_bumps']},[],context);assert.doesNotMatch(result.message,/هيدروكينون/);assert.equal(result.observations.length,1);assert.match(result.observations[0],/لا تكفي الصورة/);assert.equal(normalizeCareResult({...proposal,needsProfessional:true},[],context).needsProfessional,true);
});
test('The aggregate daily cap is reserved atomically; failed attempts also count and do not expose provider details',async()=>{
 const f=fixture({enabled:true,billingConfirmed:true,dailyLimit:2,model:'gemini-3.8-flash'}),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('private provider diagnostics',{status:429})};try{const responses=await Promise.all(Array.from({length:5},()=>publicCareChat(request(input()),f.env,helpers)));assert.equal(calls,2);assert.equal(responses.filter(r=>r.status===429).length,3);assert.equal(responses.filter(r=>r.status===503).length,2);assert.doesNotMatch(await responses[0].text(),/private provider/);const row=f.sql.prepare('SELECT * FROM care_assistant_usage').get();assert.equal(row.requests,2);assert.equal(row.failures,2);assert.deepEqual(Object.keys(row),['day','requests','successes','failures','images','input_tokens','output_tokens'])}finally{globalThis.fetch=old;f.close()}
});
test('A temporary Google 503 is retried once with the same model, request and overall deadline; daily usage counts one customer request',async()=>{
 const f=fixture({enabled:true,billingConfirmed:true,imagesEnabled:true,dailyLimit:50,model:'gemini-3.5-flash-lite'}),old=globalThis.fetch,calls=[];let cancelled=0;
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return calls.length===1?new Response(new ReadableStream({cancel(){cancelled++}}),{status:503}):modelResponse(proposal)};
 try{const response=await publicCareChat(request(input()),f.env,helpers);assert.equal(response.status,200);assert.equal(calls.length,2);assert.match(calls[0].url,/gemini-3\.5-flash-lite:generateContent$/);assert.equal(calls[1].url,calls[0].url);assert.equal(calls[1].options,calls[0].options);assert.ok(calls[0].options.signal instanceof AbortSignal);assert.equal(cancelled,1);assert.deepEqual((await response.json()).routine.map(p=>p.id),['TSDEMO1','TSDEMO2','TSDEMO3']);const row=f.sql.prepare('SELECT * FROM care_assistant_usage').get();assert.equal(row.requests,1);assert.equal(row.successes,1);assert.equal(row.failures,0);assert.equal(row.input_tokens,100);assert.equal(row.output_tokens,80)}finally{globalThis.fetch=old;f.close()}
});
test('Repeated Google 503 errors stop after two attempts, cancel both bodies and record one failure without leaking provider details',async()=>{
 const f=fixture(),old=globalThis.fetch;let calls=0,cancelled=0;globalThis.fetch=async()=>{calls++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('private provider diagnostics'))},cancel(){cancelled++}}),{status:503,headers:{'retry-after':'1'}})};
 try{const response=await publicCareChat(request(input()),f.env,helpers);assert.equal(response.status,503);assert.equal(calls,2);assert.equal(cancelled,2);assert.doesNotMatch(await response.text(),/private provider/);const row=f.sql.prepare('SELECT * FROM care_assistant_usage').get();assert.equal(row.requests,1);assert.equal(row.successes,0);assert.equal(row.failures,1)}finally{globalThis.fetch=old;f.close()}
});
test('Authentication, quota, invalid input, network errors and longer provider cooldowns are never retried',async()=>{
 const old=globalThis.fetch;
 try{for(const [status,retryAfter]of [[400,null],[401,null],[403,null],[429,null],[503,'5'],[503,'not-a-date'],[503,new Date(Date.now()+60000).toUTCString()],[0,null]]){const f=fixture();let calls=0;globalThis.fetch=async()=>{calls++;if(!status)throw Error('private network diagnostics');return new Response('private provider diagnostics',{status,headers:retryAfter===null?{}:{'retry-after':retryAfter}})};try{const response=await publicCareChat(request(input()),f.env,helpers);assert.equal(response.status,503);assert.equal(calls,1,`unexpected retry for ${status}/${retryAfter}`);assert.doesNotMatch(await response.text(),/private/);assert.equal(f.sql.prepare('SELECT requests FROM care_assistant_usage').get().requests,1)}finally{f.close()}}}finally{globalThis.fetch=old}
});
test('Truncated or safety-blocked model replies are not presented as recommendations',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=async()=>json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(proposal)}]}}]});try{assert.equal((await publicCareChat(request(input()),f.env,helpers)).status,503)}finally{globalThis.fetch=old;f.close()}
});
test('Owner API keys are authenticated, encrypted at rest, revision-protected and never returned by status or admin reads',async()=>{
 const encrypted=await encryptCareKey('test-key-only-never-real',secret);assert.doesNotMatch(encrypted,/test-key/);assert.equal(await decryptCareKey(encrypted,secret),'test-key-only-never-real');await assert.rejects(decryptCareKey(encrypted,'different-long-test-secret-01234567890123456789'));
 const f=fixture(),apiKey='test-key-only-never-real';delete f.env.GEMINI_API_KEY;try{const saved=await adminCare(request({revision:1,apiKey,settings:{enabled:false,billingConfirmed:false}}),f.env,helpers);assert.equal(saved.status,200);const row=f.sql.prepare('SELECT * FROM care_assistant_settings').get();assert.doesNotMatch(row.encrypted_key,/test-key/);assert.equal(await decryptCareKey(row.encrypted_key,secret),apiKey);const output=await (await adminCare(new Request('https://trend.test/api/admin/care-assistant'),f.env,helpers)).text();assert.doesNotMatch(output,/test-key|encrypted_key/);const conflict=await adminCare(request({revision:1,settings:{}}),f.env,helpers);assert.equal(conflict.status,409);const response=await worker.fetch(new Request('https://trend.test/api/admin/care-assistant'),f.env,{});assert.equal(response.status,401)}finally{f.close()}
});
test('The customer UI escapes model text, renders only server product cards and never persists profiles or faces',async()=>{
 const html=readFileSync(new URL('./fixtures/care-assistant-legacy.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://trend.test/care-assistant.html',runScripts:'outside-only'}),win=dom.window;
 win.HTMLElement.prototype.scrollIntoView=()=>{};win.matchMedia=()=>({matches:true});
 win.fetch=async(url)=>url==='/api/care/status'?json({available:true,imagesAvailable:true,consentVersion:'care-2026-11-v2'}):json({...proposal,message:'<img src=x onerror=alert(1)>',routine:[],observations:[],subtotalFils:0,shippingFeeFils:0,totalFils:0});
 const script=buildSync({entryPoints:[new URL('../public/care-assistant.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
 try{win.eval(script);await new Promise(r=>setTimeout(r,20));assert.equal(win.document.querySelector('#careControls').disabled,false);win.document.querySelector('#careMessage').value='بدي مرطب لوجهي';win.document.querySelector('#careAdult').checked=true;win.document.querySelector('#careGoogleConsent').checked=true;win.document.querySelector('#careForm').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.match(win.document.querySelector('#careConversation').textContent,/<img/);assert.equal(win.document.querySelector('#careConversation img'),null);assert.equal(win.localStorage.length,0);assert.equal(win.sessionStorage.length,0);win.document.querySelector('#careReset').click();assert.doesNotMatch(win.document.querySelector('#careConversation').textContent,/<img/)}finally{win.close()}
});

test('Modern dotted Google auth keys can be saved and a newly saved owner key takes precedence over the server environment key',async()=>{
 const f=fixture(),old=globalThis.fetch,newKey='AQ.'+'Synthetic_Test_Only_'.repeat(3);let used='';
 globalThis.fetch=async(url,options)=>{used=options.headers['x-goog-api-key'];return json({candidates:[{finishReason:'STOP',content:{parts:[{text:'OK'}]}}]})};
 try{const response=await adminCare(request({revision:1,apiKey:newKey,settings:{enabled:true,billingConfirmed:true}}),f.env,helpers);assert.equal(response.status,200);const row=f.sql.prepare('SELECT * FROM care_assistant_settings').get();assert.equal(await decryptCareKey(row.encrypted_key,secret),newKey);assert.doesNotMatch(row.encrypted_key,/Synthetic/);const checked=await adminCare(request({action:'test'}),f.env,helpers);assert.equal(checked.status,200);assert.equal(used,newKey);const read=await(await adminCare(new Request('https://trend.test/api/admin/care-assistant'),f.env,helpers)).text();assert.doesNotMatch(read,/Synthetic|fake-test-key/);const bad=await adminCare(request({revision:2,apiKey:'AQ.'+'Bad\r\nInjected'.repeat(3),settings:{}}),f.env,helpers);assert.equal(bad.status,400)}finally{globalThis.fetch=old;f.close()}
});

test('Natural conversation can start without a budget; Gemini matches body products and the customer confirms its extracted budget before cards appear',async()=>{
 const f=fixture(),old=globalThis.fetch;const calls=[];
 f.sql.prepare('INSERT INTO products(id,brand,name,category,details_json,reference_price_fils,price_fils,stock,approved) VALUES(\'TSHAND1\',\'Example\',\'Hand Cream\',\'الجسم\',\'{"productType":"body-care","howToUse":"تعليمات العبوة."}\',4000,4000,4,1)').run();
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return modelResponse({...proposal,message:'خلّينا نختار مرطبًا لليدين حسب تفضيلكِ.',area:'hands',budgetFils:10000,selections:[{productId:'TSHAND1',reason:'خطوة ترطيب لليدين حسب طلبكِ.'}],productIds:['TSHAND1']})};
 try{const first=await(await publicCareChat(request(input({message:'إيدي بتنشف وبدي مرطب، ميزانيتي عشرة دنانير.',budgetFils:null,profile:{area:'unknown'}})),f.env,helpers)).json();assert.equal(first.routine.length,0);assert.equal(first.area,'hands');assert.equal(first.questions[0].field,'budget');assert.equal(first.questions[0].choices[0].value,'10000');assert.match(calls[0].contents[0].parts[0].text,/إيدي بتنشف/);assert.match(calls[0].systemInstruction.parts[0].text,/TSHAND1/);assert.match(calls[0].systemInstruction.parts[0].text,/TSDEMO1/);
 const second=await(await publicCareChat(request(input({message:'نعم، عشرة دنانير.',budgetFils:10000,profile:{area:'hands'},history:[{role:'user',text:'إيدي بتنشف وبدي مرطب.'},{role:'model',text:first.message}]})),f.env,helpers)).json();assert.deepEqual(second.routine.map(p=>p.id),['TSHAND1']);assert.equal(second.totalFils,5000);assert.equal(second.routine[0].reason,'خطوة ترطيب لليدين حسب طلبكِ.');assert.equal(second.stage,'recommend');assert.doesNotMatch(calls[1].systemInstruction.parts[0].text,/TSDEMO1/);
 }finally{globalThis.fetch=old;f.close()}
});
test('Area-specific taxonomy blocks face, hand, foot and hair cross-recommendations even when the model returns a real wrong-area SKU',()=>{
 const base={brand:'Example',approved:1,stock:3,active:1,price_fils:3000};const products=careCatalog([{...base,id:'TSFACE1',name:'Face cream',category:'البشرة',details_json:'{"productType":"moisturizer"}'},{...base,id:'TSHAND1',name:'Hand cream',category:'الجسم',details_json:'{"productType":"body-care"}'},{...base,id:'TSFOOT1',name:'Foot cream',category:'الجسم',details_json:'{"productType":"foot-care"}'},{...base,id:'TSHAIR1',name:'Hair conditioner',category:'الشعر',details_json:'{"productType":"conditioner"}'}]);
 const context=validateCareInput(input({profile:{area:'hands'}}),true);const result=normalizeCareResult({...proposal,area:'hands',productIds:['TSFACE1','TSFOOT1','TSHAIR1','TSHAND1']},products,context);assert.deepEqual(result.routine.map(x=>x.id),['TSHAND1']);
});
test('A model-requested change to a confirmed budget or area requires a customer choice and never silently expands the purchase budget',()=>{
 const context=validateCareInput(input({budgetFils:10000}),true);const result=normalizeCareResult({...proposal,budgetFils:25000,area:'body'},[],context);assert.equal(result.routine.length,0);assert.deepEqual(result.questions.map(x=>x.field),['budget','area']);assert.deepEqual(result.questions[0].choices.map(x=>x.value),['25000','10000']);
});
test('Unknown area and budget get priority over optional model follow-ups, with at most two bounded actionable questions',()=>{
 const context=validateCareInput(input({budgetFils:null,profile:{}}),true);const result=normalizeCareResult({...proposal,questions:[{field:'preference',text:'هل تفضّلين قوامًا خفيفًا؟',choices:[]}]},[],context);assert.deepEqual(result.questions.map(q=>q.field),['budget','area']);assert.equal(result.routine.length,0);
});
test('Unsupported photos never produce a shopping routine or retain arbitrary image observations',()=>{
 const context=validateCareInput(input(),true);context.image={};const result=normalizeCareResult({...proposal,imageDisposition:'unsupported',observations:['visible_bumps']},[],context);assert.equal(result.needsProfessional,false);assert.equal(result.routine.length,0);assert.deepEqual(result.observations,[]);assert.match(result.message,/دون أشخاص آخرين/);
});
test('The factual catalog is bounded without preference scoring and does not drop all non-basic cosmetic product types',()=>{
 const products=careCatalog(Array.from({length:500},(_,i)=>({id:'TSITEM'+i,name:'Hydrating toner',category:'البشرة',brand:'Example',approved:1,stock:1,active:1,price_fils:3000,details_json:'{"productType":"toner"}'})));const context=validateCareInput(input({budgetFils:null,profile:{area:'face'}}),true);const prompt=buildCarePrompt(context,products);assert.equal(prompt.eligible.length,350);assert.equal(prompt.eligible[0].type,'toner');assert.match(prompt.system,/semantic understanding and matching/);
});
test('Customer quick replies continue the natural conversation, confirm the budget, preserve context and remain memory-only',async()=>{
 const dom=new JSDOM(readFileSync(new URL('./fixtures/care-assistant-legacy.html',import.meta.url),'utf8'),{url:'https://trend.test/care-assistant.html',runScripts:'outside-only'}),win=dom.window,requests=[];win.HTMLElement.prototype.scrollIntoView=()=>{};win.matchMedia=()=>({matches:true});
 win.fetch=async(url,options)=>{if(url==='/api/care/status')return json({available:true,imagesAvailable:true,consentVersion:'care-2026-11-v2'});requests.push(JSON.parse(options.body));return json({message:'نرتّب اختياراتكِ حسب كلامكِ.',area:'hands',questions:requests.length===1?[{field:'budget',text:'هل نعتمد عشرة دنانير؟',choices:[{label:'١٠ د.أ',value:'10000'}]}]:[],routine:[],observations:[]})};
 const script=buildSync({entryPoints:[new URL('../public/care-assistant.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
 try{win.eval(script);await new Promise(r=>setTimeout(r,20));win.document.querySelector('#careAdult').checked=true;win.document.querySelector('#careGoogleConsent').checked=true;win.document.querySelector('#careMessage').value='بدي عناية لإيدي وبحب القوام الخفيف.';win.document.querySelector('#careForm').requestSubmit();await new Promise(r=>setTimeout(r,30));assert.equal(requests[0].budgetFils,null);assert.equal(requests[0].message,'بدي عناية لإيدي وبحب القوام الخفيف.');win.document.querySelector('[data-care-choice]').click();await new Promise(r=>setTimeout(r,30));assert.equal(requests.length,2);assert.equal(requests[1].budgetFils,10000);assert.equal(requests[1].profile.area,'hands');assert.match(requests[1].history[0].text,/القوام الخفيف/);assert.equal(win.localStorage.length,0);assert.equal(win.sessionStorage.length,0);win.document.querySelector('#careReset').click();assert.equal(win.document.querySelector('#careBudget').value,'');assert.equal(win.document.querySelector('#careMessage').value,'');assert.equal(win.document.querySelector('[data-care-choice]'),null)}finally{win.close()}
});
