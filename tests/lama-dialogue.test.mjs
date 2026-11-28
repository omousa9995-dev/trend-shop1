import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';
import {consumeLumaStream,appendLumaHistory} from '../public/luma-stream.js';
import {latestSuggestedIds} from '../src/lama-catalog.js';

const encoder=new TextEncoder();
function fixture(t){
 const db=new DatabaseSync(':memory:');
 t.after(()=>db.close());
 db.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 db.prepare('UPDATE care_assistant_settings SET config_json=? WHERE id=1').run(JSON.stringify({enabled:true,billingConfirmed:true,imagesEnabled:false}));
 db.prepare(`INSERT INTO products(id,brand,name,category,details_json,stock,price_fils,reference_price_fils,approved,active)
 VALUES('TSCTX001','Example','Night Essence','البشرة',?,3,5500,5500,1,1)`).run(JSON.stringify({
   nameAr:'إيسنس الليل التجريبي',productType:'essence',howToUse:'استخدميه قبل المرطب حسب العبوة.',benefits:['قوام خفيف']
 }));
 const statement=(sql,args=[])=>({
  bind:(...values)=>statement(sql,values),
  all:async()=>({results:db.prepare(sql).all(...args)}),
  first:async()=>db.prepare(sql).get(...args)||null,
  run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})
 });
 const env={DB:{prepare:statement},SESSION_SECRET:'lama-context-fixture-secret-at-least-32-bytes',GEMINI_API_KEY:'local-fixture-key'};
 return {db,env,ask:(message,extra={})=>worker.fetch(new Request('https://trend.test/api/chat',{
  method:'POST',headers:{origin:'https://trend.test','x-trend-care':'1','content-type':'application/json'},
  body:JSON.stringify({contract:'lama-2',message,...extra})
 }),env,{})};
}
const frame=(parts,finishReason)=>'data: '+JSON.stringify({candidates:[{content:{role:'model',parts},...(finishReason?{finishReason}:{})}]})+'\n\n';
const json=parts=>Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts}}]});
const sse=body=>new Response(body,{headers:{'content-type':'text/event-stream'}});
const collect=async response=>{
 const events=[];
 await consumeLumaStream(response,(name,data)=>events.push({name,data}));
 return events;
};
const textOf=events=>events.reduce((text,{name,data})=>name==='delta'?text+data.text:name==='replace'?data.text:text,'');
const spin=async fn=>{for(let i=0;i<160&&!fn();i++)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(fn());};
function stub(t,f){const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;});globalThis.fetch=f;}
function addProduct(db,{id,name,type,benefit,stock=3}){
 db.prepare(`INSERT INTO products(id,brand,name,category,description,details_json,price_fils,reference_price_fils,stock,approved,active)
 VALUES(?,'Example',?,'البشرة',?,?,6490,6490,?,1,1)`).run(id,name,benefit,
  JSON.stringify({nameAr:name,productType:type,benefits:[benefit],howToUse:'اتبعي الإرشادات على العبوة.'}),stock);
}

test('The screenshot’s pore-product question directly returns documented live recommendations',async t=>{
 const f=fixture(t);
 addProduct(f.db,{id:'TSPORE01',name:'جل الترطيب الخفيف',type:'moisturizer',benefit:'ترطيب وعناية بمظهر المسام'});
 addProduct(f.db,{id:'TSPORE02',name:'غسول بور كلير',type:'cleanser',benefit:'تنظيف لطيف للبشرة المختلطة والعناية بمظهر المسام'});
 addProduct(f.db,{id:'TSPORE03',name:'سيروم خفيف للمسام',type:'serum',benefit:'مظهر أنعم للمسام',stock:0});
 addProduct(f.db,{id:'TSPORE04',name:'سيروم سبكيول مكثف',type:'serum',benefit:'العناية بمظهر المسام'});
 let calls=0;
 stub(t,async()=>{calls++;throw Error('Known concern can use the current catalog');});
 const events=await collect(await f.ask('شو منتجات المسامات؟',{profile:{skinType:'combination'}}));
 const products=events.find(e=>e.name==='products')?.data.routine;
 assert.deepEqual(products?.map(p=>p.id).sort(),['TSPORE01','TSPORE02']);
 assert.ok(products.every(p=>p.reason.includes('المسام')&&p.href.startsWith('/product/')));
 assert.equal(textOf(events),'تفضّلي، هاي المنتجات.');
 assert.equal(events.at(-1).data.source,'live-catalog');
 assert.equal(calls,0);
});

test('وينهم shows both named sunscreens as alternatives and respects a later stock change',async t=>{
 const f=fixture(t);
 const first='واقي الشمس المرطّب بعصارة البتولا من راوند لاب',second='واقي الشمس ريليف صن من بيوتي أوف جوسون';
 addProduct(f.db,{id:'TSSUN001',name:first,type:'sunscreen',benefit:'واقي شمس بلمسة مرطبة'});
 addProduct(f.db,{id:'TSSUN002',name:second,type:'sunscreen',benefit:'حماية شمسية بحسب العبوة'});
 const history=appendLumaHistory([],'شو عندكم واقيات؟','عنا كمان '+first+'، بالإضافة ل'+second+'.');
 let calls=0;
 stub(t,async()=>{calls++;throw Error('The previous product names are present');});
 const events=await collect(await f.ask('وينهم؟',{history,profile:{skinType:'dry'}}));
 const choices=events.find(e=>e.name==='products')?.data;
 assert.deepEqual(choices?.routine.map(p=>p.id),['TSSUN001','TSSUN002']);
 assert.equal(choices.alternatives,true);
 assert.equal(textOf(events),'تفضّلي، هاي المنتجات.');
 f.db.prepare("UPDATE products SET stock=0 WHERE id='TSSUN001'").run();
 const remaining=await collect(await f.ask('ارسليهم',{history}));
 assert.deepEqual(remaining.find(e=>e.name==='products')?.data.routine.map(p=>p.id),['TSSUN002']);
 assert.equal(textOf(remaining),'تفضّلي، هاد المنتج.');
 assert.equal(calls,0);
});

test('Product photos and an earlier shade discussion resolve to the real packshot and selected option',async t=>{
 const f=fixture(t);
 const name='كريم أساس دبل وير من إستيه لودر';
 const image='/images/foundation.webp';
 f.db.prepare(`INSERT INTO products(id,brand,name,category,details_json,image_url,stock,price_fils,reference_price_fils,approved,active)
 VALUES('TSFOUND1','Estée Lauder','Double Wear Foundation','المكياج',?,?,5,8500,8500,1,1)`).run(JSON.stringify({
  nameAr:name,productType:'foundation'
 }),image);
 let calls=0;
 stub(t,async()=>{calls++;throw Error('Photo and shade resolve from the current catalog');});
 const history=appendLumaHistory([],'بدي أشوف '+name,'متوفر عنا '+name+'.');
 const photo=await collect(await f.ask('ممكن تبعتيلي صورة المنتج؟',{history}));
 const productEvent=events=>events.find(e=>e.name==='products')?.data;
 assert.equal(productEvent(photo)?.photoRequested,true);
 assert.equal(productEvent(photo).routine[0].image,image);
 assert.equal(productEvent(photo).routine[0].options.length,4);
 const withShades=appendLumaHistory(appendLumaHistory(history,'عندك صورة؟','درجة بشرتك عادةً قريبة لأي مستوى؟'),'نعم',
  'اختاري الدرجة من الخيارات الأربعة: 1 فاتح، 2 وسط فاتح، 3 وسط عادي أو 4 حنطي.');
 for(const query of ['1','١','فاتح','صورة المنتج بدرجة ١','صورة TSFOUND1 بدرجة ١']){
  const reply=await collect(await f.ask(query,{history:withShades}));
  const result=productEvent(reply);
  assert.equal(result?.photoRequested,true,query);
  assert.equal(result.routine[0].image,image,query);
  assert.deepEqual(result.routine[0].selectedOption,{id:'tone-1',label:'1 — فاتح'},query);
  assert.equal(result.routine[0].href,'/product/TSFOUND1?variant=tone-1',query);
  assert.equal(textOf(reply),'تفضّلي، هاد المنتج.',query);
 }
 const unknown=await collect(await f.ask('صورة منتج افتراضي غير معروف بدرجة ١',{history:withShades}));
 assert.equal(productEvent(unknown),undefined);
 assert.equal(unknown.find(e=>e.name==='question')?.data.question.mode,'photo');
 assert.equal(calls,0);
});

test('Internal actions appended to normal text are withheld even across provider chunks',async t=>{
 const f=fixture(t);
 stub(t,async()=>sse([
  frame([{text:'ابدئي بترطيب خفيف (TSCTX001) بعد التنظيف.'}]),
  frame([{text:'\n\nعشان تكملي العناية، هي الخِيار المناسب:\n\n:ik'}]),
  frame([{text:'tib/show_products:\n\u0060\u0060\u0060json\n{ "carePlan": [{ "productId": "", "reason": "نص داخلي" }]}'}]),
  frame([{text:'\n\u0060\u0060\u0060'}],'STOP')
 ].join('')));
 const events=await collect(await f.ask('كيف أرتّب الترطيب لو وجهي بيشد بنص اليوم؟'));
 assert.equal(textOf(events),'ابدئي بترطيب خفيف بعد التنظيف.');
 assert.doesNotMatch(JSON.stringify(events),/iktib|show_products|carePlan|productId|نص داخلي|:\\s?ik|TSCTX001|\(\)/i);
 assert.equal(events.some(e=>e.name==='products'),false);
});

test('A shopping reply in prose with a stray tool wrapper displays the confirmed product in the first response',async t=>{
 const f=fixture(t);
 let calls=0;
 const name='جل الترطيب اليومي الخفيف';
 addProduct(f.db,{id:'TSCREAM01',name,type:'moisturizer',benefit:'ترطيب بقوام خفيف'});
 stub(t,async(_url,{body})=>{
  calls++;
  assert.equal(JSON.parse(body).toolConfig.functionCallingConfig.mode,'ANY');
  return sse(frame([{text:'بنصحكِ ب'+name+' (TSCREAM01).\n\n<show_products>{"productIds":[""],"reason":"نص داخلي"}</show_products>'}],'STOP'));
 });
 const events=await collect(await f.ask('شو منتجات الترطيب المتوفرة عندكم؟',{profile:{skinType:'combination'}}));
 assert.deepEqual(events.find(e=>e.name==='products')?.data.routine.map(p=>p.id),['TSCREAM01']);
 assert.equal(textOf(events),'تفضّلي، هاد المنتج.');
 assert.doesNotMatch(textOf(events),/بطاق|show_products|productIds|نص داخلي|TSCREAM01/);
 assert.equal(calls,1);
});

test('A real product tool call can show same-type choices and strips the tool markup from visible fields',async t=>{
 const f=fixture(t);
 addProduct(f.db,{id:'TSSUN011',name:'واقي شمس يومي خفيف',type:'sunscreen',benefit:'حماية شمسية بحسب العبوة'});
 addProduct(f.db,{id:'TSSUN012',name:'واقي شمس يومي مرطّب',type:'sunscreen',benefit:'قوام مرطّب'});
 stub(t,async()=>sse(frame([{functionCall:{name:'show_products',args:{
  area:'face',productIds:['TSSUN011','TSSUN012'],carePlan:'تفضّلي، هاي بطاقات المنتجات.\n<show_products>{"foo":123}</show_products>',
  selections:[{productId:'TSSUN011',reason:'خيار خفيف.\n:iktib/show_products: []'},{productId:'TSSUN012',reason:'{"foo":"internal"}'}]
 }}}],'STOP')));
 const events=await collect(await f.ask('شو خيارات واقي الشمس من عندكم؟',{profile:{skinType:'dry'}}));
 const result=events.find(e=>e.name==='products')?.data;
 assert.deepEqual(result?.routine.map(p=>p.reason),['خيار خفيف.','قوام مرطّب']);
 assert.equal(result.alternatives,true);
 assert.equal(textOf(events),'تفضّلي، هاي المنتجات.');
 assert.doesNotMatch(JSON.stringify(events),/show_products|iktib|internal|بطاق/);
});

test('A clear cleanser request and an explicit product-card follow-up use live stock without a model round trip',async t=>{
 const f=fixture(t);
 const insert=f.db.prepare(`INSERT INTO products(id,brand,name,category,description,details_json,stock,price_fils,reference_price_fils,approved,active)
 VALUES(?,?,?,'البشرة',?,?,3,4490,4490,1,1)`);
 const name='غسول سيبيوم جل موسان من بيوديرما';
 insert.run('TSCTX002','Bioderma','Sebium Gel Moussant','غسول يومي للبشرة المختلطة والدهنية',JSON.stringify({
  nameAr:name,productType:'cleanser',howToUse:'دلّكيه على وجه مبلل واشطفيه.',benefits:['تنظيف الشوائب اليومية']
 }));
 let calls=0;
 stub(t,async()=>{calls++;throw Error('Clear product requests use the local catalog');});
 const simple=await collect(await f.ask('غسول',{profile:{skinType:'combination'}}));
 const card=simple.find(e=>e.name==='products')?.data.routine[0];
 assert.equal(card?.id,'TSCTX002');
 assert.equal(card.href,'/product/TSCTX002');
 assert.equal(card.priceFils,4490);
 assert.match(card.howToUse,/واشطفيه/);
 assert.equal(simple.at(-1).data.source,'live-catalog');
 const fromHistory=await collect(await f.ask('غسول',{history:appendLumaHistory([],'بشرتي مختلطة.','أي خطوة بتحبّي تبدئي فيها؟')}));
 assert.equal(fromHistory.find(e=>e.name==='products')?.data.routine[0].id,'TSCTX002');
 const intake=await collect(await f.ask('غسول'));
 const question=intake.find(e=>e.name==='question')?.data.question;
 assert.equal(question?.field,'skinType');
 const reply=await collect(await f.ask('مختلطة',{history:appendLumaHistory([],'غسول',question.text)}));
 assert.equal(reply.find(e=>e.name==='products')?.data.routine[0].id,'TSCTX002');
 const history=appendLumaHistory([],'غسول',name+' خيار للبشرة المختلطة. اغسلي وجهكِ بلطف واشطفيه.');
 const requested=await collect(await f.ask('ارسلي المنتج',{history,existingIds:['TSCTX002']}));
 assert.equal(requested.find(e=>e.name==='products')?.data.routine[0].id,'TSCTX002');
 const two=appendLumaHistory([],'شو عندكم؟','هاي الخيارات',['TSCTX001','TSCTX002']);
 const ambiguous=await collect(await f.ask('ارسلي المنتج',{history:two}));
 assert.equal(ambiguous.some(e=>e.name==='products'),false);
 assert.deepEqual(ambiguous.find(e=>e.name==='question')?.data.question.choices.map(c=>c.value),['TSCTX001','TSCTX002']);
 const second=await collect(await f.ask('رابط المنتج الثاني',{history:two}));
 assert.equal(second.find(e=>e.name==='products')?.data.routine[0].id,'TSCTX002');
 const prose=appendLumaHistory([],'شو عندكم؟',name+' خيار للتنظيف، وبعده إيسنس الليل التجريبي.');
 const requestedFirst=await collect(await f.ask('رابط المنتج الأول',{history:prose}));
 assert.equal(requestedFirst.find(e=>e.name==='products')?.data.routine[0].id,'TSCTX002');
 f.db.prepare("UPDATE products SET stock=0 WHERE id='TSCTX002'").run();
 const soldOut=await collect(await f.ask('ارسلي المنتج',{history}));
 assert.equal(soldOut.some(e=>e.name==='products'),false);
 assert.match(textOf(soldOut),/نافد/);
 assert.equal(calls,0);
});

test('A short cleanser follow-up about the body retains the conversation area',async t=>{
 const f=fixture(t);
 let request;
 stub(t,async(_url,{body})=>{
  request=JSON.parse(body);
  return json([{functionCall:{name:'answer_customer',args:{text:'للجسم، اختاري غسولًا مناسبًا لطبيعة بشرتكِ.'}}}]);
 });
 const history=appendLumaHistory([],'بدي عناية للجسم','أي خطوة بتهمكِ أكتر؟');
 const events=await collect(await f.ask('غسول',{history,profile:{area:'body',skinType:'combination'}}));
 assert.equal(request.toolConfig.functionCallingConfig.mode,'ANY');
 assert.match(request.systemInstruction.parts[0].text,/"area":"body"/);
 assert.match(textOf(events),/للجسم/);
 assert.equal(events.some(e=>e.name==='products'),false);
});

test('An open follow-up uses earlier turns and live references, and streams regular text while Gemini is still working',async t=>{
 const f=fixture(t);
 let upstream,cancelled=false,attempts=0;
 stub(t,async(url,{body})=>{
  attempts++;
  assert.match(url,/gemini-3\.5-flash-lite:streamGenerateContent/);
  const payload=JSON.parse(body),prompt=payload.systemInstruction.parts[0].text;
  assert.deepEqual(payload.contents.map(turn=>turn.role),['user','model','user']);
  assert.match(payload.contents[0].parts[0].text,/إيسنس الليل/);
  assert.doesNotMatch(payload.contents[1].parts[0].text,/TSCTX001/);
  assert.match(payload.contents[2].parts[0].text,/حطيته بالليل/);
  assert.match(prompt,/TSCTX001.*قبل المرطب/);
  assert.ok(!payload.tools[0].functionDeclarations.some(tool=>tool.name==='handoff_to_team'));
  return sse(new ReadableStream({start(c){upstream=c;},cancel(){cancelled=true;return new Promise(()=>{});}}));
 });
 const history=[
  {role:'user',text:'بشرتي جافة، عندي إيسنس الليل التجريبي ومرطب.'},
  {role:'model',text:'حطي الإيسنس قبل المرطب.\nالمنتجات المقترحة: TSCTX001'}
 ];
 const received=[];
 const reply=await f.ask('طيب وإذا حطيته بالليل لازم أتغيّر ترتيب الخطوات؟',{history,profile:{skinType:'dry'}});
 const consuming=consumeLumaStream(reply,(name,data)=>received.push({name,data}));
 await spin(()=>!!upstream);
 upstream.enqueue(encoder.encode(frame([{thought:true,text:'Hidden provider reasoning'},{text:'إذا قصدك الإيسنس، بالليل ضلّيه قبل المرطب.'}])));
 await spin(()=>textOf(received).includes('قبل المرطب'));
 assert.ok(!received.some(e=>e.name==='done'));
 upstream.enqueue(encoder.encode(frame([{text:'\n\nبعد ما تنظّفي البشرة، خليه يستقر وبعدين رطّبي. تواصلي مع فريق Trend Shop.'}],'STOP')));
 await consuming;
 assert.equal(attempts,1);
 assert.equal(received.at(-1).data.source,'gemini');
 assert.match(textOf(received),/بعد ما تنظّفي/);
 assert.doesNotMatch(textOf(received),/Trend|reasoning|TSCTX001/);
 assert.equal(received.some(e=>['question','handoff','followup'].includes(e.name)),false);
 await spin(()=>cancelled);
});

test('Gemini uses an optional live lookup with its original tool signature, then answers the comparison',async t=>{
 const f=fixture(t);
 let attempts=0;
 stub(t,async(_url,{body})=>{
  const req=JSON.parse(body);
  if(++attempts===1)return sse(frame([{functionCall:{id:'call-strong',name:'get_catalog',args:{productIds:['TSCTX001']}},thoughtSignature:'opaque-server-signature'}],'STOP'));
  const [model,tools]=req.contents.slice(-2);
  assert.equal(model.parts[0].thoughtSignature,'opaque-server-signature');
  assert.equal(tools.parts[0].functionResponse.id,'call-strong');
  const product=tools.parts[0].functionResponse.response.products[0];
  assert.equal(product.id,'TSCTX001');
  assert.equal(product.priceJod,5.5);
  assert.match(product.howToUse,/قبل المرطب/);
  return json([{text:'الإيسنس خطوة خفيفة قبل المرطب حسب تعليماته. إذا بدك تختصري، اكتفي بالمرطب اللي بتعرفي إن بشرتك بتتحمّله.'}]);
 });
 const events=await collect(await f.ask('هل أحتاج الإيسنس إذا المرطب موجود؟ الاقتراح كان TSCTX001'));
 assert.equal(attempts,2);
 assert.match(textOf(events),/خطوة خفيفة/);
 assert.doesNotMatch(JSON.stringify(events),/opaque-server-signature/);
 assert.equal(events.at(-1).name,'done');
});

test('Tool-format rejection recovers as natural Gemini prose, and an outage never injects store contact',async t=>{
 const f=fixture(t);
 let attempts=0;
 stub(t,async(_url,{body})=>{
  const req=JSON.parse(body);
  if(++attempts===1){
   assert.equal(req.toolConfig.functionCallingConfig.mode,'AUTO');
   return Response.json({error:{message:'Private invalid tool payload'}},{status:400});
  }
  if(attempts===2){
   assert.equal(req.tools,undefined);
   return json([{text:'للجامعة خففي طبقة المكياج وثبّتي بس حول الأنف. خدي معك منديل لو احتجت تشيلي اللمعة.'}]);
  }
  return Response.json({error:{message:'Private service failure'}},{status:503,headers:{'retry-after':'60'}});
 });
 const recovered=await collect(await f.ask('كيف أرتب المظهر للجامعة وبعدين عزومة؟'));
 assert.match(textOf(recovered),/ثبّتي بس حول الأنف/);
 assert.equal(recovered.at(-1).name,'done');
 const failure=await collect(await f.ask('إذا صار المكياج يتغيّر تحت إنارة القاعة شو أعمل؟'));
 assert.equal(failure.at(-1).name,'error');
 assert.match(failure.at(-1).data.message,/إعادة المحاولة/);
 assert.equal(failure.some(e=>['products','followup','handoff'].includes(e.name)),false);
 assert.doesNotMatch(JSON.stringify(failure),/Private service failure|wa\.me/);
});

test('References survive a long reply and remain available to the very next turn',()=>{
 const history=appendLumaHistory([],'قارنيلي الاختيارات','رد مفصل '.repeat(720),['TSCTX001','TSCTX002','TSCTX001']);
 assert.deepEqual(latestSuggestedIds(history),['TSCTX001','TSCTX002']);
 assert.equal(history[1].text.length,2400);
});
