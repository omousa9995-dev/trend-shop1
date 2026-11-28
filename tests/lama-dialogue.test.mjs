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
