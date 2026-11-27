import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker,{_test} from '../src/worker.js';
import {runLumaTool} from '../src/luma-assistant.js';

const origin='https://trend.test';
const json=(value,status=200)=>Response.json(value,{status});
const fragranceFixtures=[
 {id:'TSPF-ROSE-DAY',name:'Rose Morning',nameAr:'ورد الصباح',brand:'Designer',fragranceAudience:'women',description:'عطر زهري منعش وخفيف للمشاوير النهارية.',benefits:['ورد وماغنوليا','ليمون خفيف'],price:6990},
 {id:'TSPF-VANILLA-NIGHT',name:'Vanilla Evening',nameAr:'فانيلا المساء',brand:'Designer',fragranceAudience:'women',description:'رائحة دافئة للسهرات الشتوية.',benefits:['فانيلا وقرفة'],price:8990},
 {id:'TSPF-UNISEX',name:'Bright Horizon Unisex',nameAr:'أفق مشرق للجنسين',brand:'Designer',description:'رائحة زهرية ناعمة للنهار.',benefits:['الياسمين'],price:3990},
 {id:'TSPF-MEN',name:'Cedar Night Pour Homme',nameAr:'أرز الليل رجالي',brand:'Designer',description:'طابع خشبي دافئ.',benefits:['خشب الأرز'],price:4490}
];
function fixture(t,{provider=false}={}){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 db.prepare('UPDATE care_assistant_settings SET config_json=? WHERE id=1').run(JSON.stringify({enabled:true,billingConfirmed:provider}));
 const statement=(sql,args=[])=>({
  bind:(...values)=>statement(sql,values),
  all:async()=>({results:db.prepare(sql).all(...args)}),
  first:async()=>db.prepare(sql).get(...args)||null,
  run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})
 });
 const env={DB:{prepare:statement},SESSION_SECRET:'local-inventory-test-session-secret-01234567890123456789',
  ADMIN_PASSWORD_HASH:'configured',STORE_LIVE:'1',...(provider?{GEMINI_API_KEY:'local-fake-model-key'}:{})};
 const product=(item,{active=true,approved=true,stock=24}={})=>({
  id:item.id,name:item.name,brand:item.brand,category:item.category||'العطور',description:item.description,
  price_fils:item.price,reference_price_fils:item.price,discount_percent:0,stock,approved,active,
  details:{nameAr:item.nameAr,fragranceAudience:item.fragranceAudience,benefits:item.benefits,howToUse:item.howToUse,size:'100 مل'}
 });
 async function save(item,options){
  const response=await worker.fetch(new Request(origin+'/api/admin/products',{
   method:'POST',headers:{origin,'x-trend-admin':'1','content-type':'application/json',cookie:'ts_admin='+await _test.makeSession(env)},
   body:JSON.stringify(product(item,options))
  }),env,{});
  assert.equal(response.status,200,await response.text());
 }
 async function ask(message,extra={}){
  const r=await worker.fetch(new Request(origin+'/api/chat',{method:'POST',headers:{origin,'x-trend-care':'1','content-type':'application/json'},body:JSON.stringify({
   contract:'lama-2',message,profile:{area:'face',skinType:'dry',ageGroup:'25-34'},...extra
  })}),env,{});
  assert.equal(r.status,200);
  const result=[];
  for await(const event of readSSEEvents(r))result.push(event);
  assert.equal(result.at(-1)?.event,'done',JSON.stringify(result));
  return result;
 }
 return {db,env,ask,save};
}
async function* readSSEEvents(response){
 for(const frame of (await response.text()).trim().split('\n\n')){
  const [name,...data]=frame.split('\n');
  yield {event:name.slice(7),data:JSON.parse(data.join('\n').slice(6))};
 }
}
const dataOf=(out,event)=>out.find(row=>row.event===event)?.data;
const idsOf=out=>dataOf(out,'products')?.routine.map(p=>p.id)||[];
const followup=(text,ids)=>[{role:'user',text},{role:'model',text:'هاي الخيارات.\nالمنتجات المقترحة: '+ids.join(', ')}];

test('Two appropriate live fragrances are alternatives, even with a skin profile and no provider',async t=>{
 const f=fixture(t);
 for(const item of fragranceFixtures)await f.save(item);
 const request='بدي عطر أنثوي';
 const out=await f.ask(request,{budgetFils:10000});
 const result=dataOf(out,'products');
 assert.equal(result.alternatives,true);
 assert.deepEqual(new Set(idsOf(out)),new Set(['TSPF-ROSE-DAY','TSPF-VANILLA-NIGHT']));
 for(const p of result.routine){
  assert.match(p.href,/^\/product\/TSPF-/);
  assert.match(p.reason,/ورد|فانيلا|قرفة|ماغنوليا/);
 }
 assert.equal(dataOf(out,'question'),undefined);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM care_assistant_usage').get().n,0);
 const day=await f.ask('بدي عطر نسائي للدوام');
 assert.deepEqual(idsOf(day),['TSPF-ROSE-DAY']);
 const warm=await f.ask('شي دافي وحلو للمساء',{history:followup(request,idsOf(out))});
 assert.deepEqual(idsOf(warm),['TSPF-VANILLA-NIGHT']);
 const alternative=await f.ask('عندك خيارات ثانية غيرهم؟',{history:followup(request,idsOf(out))});
 assert.equal(idsOf(alternative).length,0);
});

test('Publishing through admin changes the next reply in an open chat and later stock, price and hiding apply immediately',async t=>{
 const f=fixture(t),first=fragranceFixtures[0],newItem={...fragranceFixtures[1],name:'Orchid Cloud',nameAr:'غيمة الأوركيد',
  description:'عطر زهري ناعم للنهار.',benefits:['أوركيد', 'الياسمين'],howToUse:'رشة واحدة على المعصم حسب بطاقة العطر.'};
 await f.save(first);
 await f.save(newItem,{approved:false,active:false});
 const request='شو عندكم عطور نسائية؟';
 const before=await f.ask(request);
 assert.deepEqual(idsOf(before),[first.id]);
 const history=followup(request,idsOf(before));
 await f.save(newItem);
 const after=await f.ask('بدي أحدث عطر نسائي',{history});
 assert.ok(idsOf(after).includes(newItem.id));
 assert.equal(JSON.parse(f.db.prepare('SELECT details_json FROM products WHERE id=?').get(newItem.id).details_json).fragranceAudience,'women');
 const description=await f.ask('شو نفحات غيمة الأوركيد؟',{history});
 assert.match(dataOf(description,'delta').text,/أوركيد.*الياسمين/s);
 assert.deepEqual(dataOf(description,'reference').productIds,[newItem.id]);
 const usage=await f.ask('كيف أستخدم غيمة الأوركيد؟',{history});
 assert.match(dataOf(usage,'delta').text,/رشة واحدة على المعصم/);
 await f.save({...newItem,price:7990},{stock:0});
 assert.match(dataOf(await f.ask('بكم غيمة الأوركيد؟'),'delta').text,/7\.99.*نافد/s);
 assert.deepEqual(idsOf(await f.ask(request,{history})),[first.id]);
 await f.save(newItem,{active:false});
 const feed=await worker.fetch(new Request(origin+'/products.json'),f.env,{});
 assert.ok((await feed.json()).products.every(p=>p.id!==newItem.id));
});

test('The same live lookup answers a newly published non-fragrance product and supplies detailed facts to Gemini',async t=>{
 const f=fixture(t,{provider:true});
 const newItem={id:'TS-FRESH-TONER',category:'البشرة',brand:'Botanical',name:'Teal Clover Toner',nameAr:'تونر البرسيم الفيروزي',
  benefits:['ملمس خفيف'],price:6990,description:'تونر خفيف للاستخدام اليومي.',howToUse:'بعد التنظيف وفق التعليمات على العبوة.'};
 await f.save(newItem);
 const product=await f.ask('شو فوايد تونر البرسيم الفيروزي؟');
 assert.match(dataOf(product,'delta').text,/ملمس خفيف/);
 assert.deepEqual(dataOf(product,'reference').productIds,[newItem.id]);
 const original=globalThis.fetch;
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(_url,{body})=>{
  const sent=JSON.parse(body);
  assert.equal(sent.toolConfig.functionCallingConfig.mode,'ANY');
  const instruction=sent.systemInstruction.parts[0].text;
  const index=JSON.parse(instruction.match(/^PRODUCTS_JSON=(.+)$/m)[1]);
  const facts=JSON.parse(instruction.match(/^CATALOG=(.+)$/m)[1]);
  assert.ok(index.rows.some(row=>row[0]===newItem.id));
  assert.ok(facts.some(p=>p.id===newItem.id&&p.type==='toner'&&p.howToUse===newItem.howToUse));
  return json({candidates:[{finishReason:'STOP',content:{parts:[{functionCall:{name:'show_products',args:{
   area:'face',productIds:[newItem.id],carePlan:'هاي خطوة خفيفة إذا بتحبي تضيفي تونر بعد التنظيف.',
   selections:[{productId:newItem.id,reason:'قوام خفيف حسب وصفه.'}]
  }}}]}}]});
 };
 assert.deepEqual(idsOf(await f.ask('اقترحيلي تونر خفيف لروتين المساء')), [newItem.id]);
});

test('Catalog tools discover fragrance by category and reject sold-out or unknown product IDs',async t=>{
 const f=fixture(t),[day,night]=fragranceFixtures;
 await f.save(day);await f.save(night,{stock:0});
 const input={message:'بدي عطر',lama:true,area:'face',budgetFils:null,existingIds:[]};
 const lookup=await runLumaTool({name:'get_catalog',args:{query:'العطور',area:'fragrance'}},input,f.env);
 assert.equal(lookup.products.find(p=>p.id===day.id).eligibleForRecommendation,true);
 assert.equal(lookup.products.find(p=>p.id===night.id).eligibleForRecommendation,false);
 const result=await runLumaTool({name:'show_products',args:{area:'fragrance',productIds:[day.id,night.id,'TSPF-UNKNOWN']}},input,f.env);
 assert.deepEqual(result.routine.map(p=>p.id),[day.id]);
});
