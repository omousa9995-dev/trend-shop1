import {requestGemini} from './gemini-provider.js';
import {untilAbort} from './gemini-stream.js';
import {productsContext, namedCatalogMatches, latestSuggestedIds} from './lama-catalog.js';
import {lumaBudgetNeutralText} from './luma-care-knowledge.js';
import {lumaCatalogFacts} from './luma-store-facts.js';
import {lamaSystem} from './lama-system.js';
import {normalizeSearch} from '../public/shop-tools.js';

const textLimit=4000;
const catalogMarker=/^المنتجات المقترحة:.*$/gm;
const codePattern=/\b(?:TS|PROMO)[A-Z0-9-]{4,64}\b/g;
const referral=/واتساب|wa\.me|whatsapp|(?:تواصلي|تواصل|اتصلي|راسلينا|راسلي|تحكي مع|ارجعي ل|reach out|contact).{0,45}(?:فريق|متجر|Trend Shop|الدعم)/i;
export const requestsStoreContact = message=>/واتس|whatsapp|رقمكم|رقم.{0,16}(?:الادارة|الإدارة|الدعم|الفريق|المتجر)|(?:تواصل|اتواصل|أحكي مع|احكي مع|contact|reach).{0,32}(?:فريق|ادار|إدار|متجر|الدعم|support|trend shop)/i.test(message);

export function wantsLamaRecommendations(input){
 const message=normalizeSearch(input.message);
 if(/بدون منتجات|من غير منتجات|مش بدي منتجات|نصايح بس|نصائح فقط|without products|advice only/.test(message))return false;
 return input.guided||['routine','sunscreen','makeup','concealer'].includes(input.intent)||
  /عندكم|من (?:عندكم|المتجر|موقعكم|منتجاتكم)|ترشحي|رشحي|اقترحي|شو اشتري|شو افضل|اي (?:ال)?منتج|اي (?:نوع|خيار) (?:بتنصح|تنصح)|بدي بديل|اريد شراء|\b(?:recommend|suggest|can i buy|from your store)\b/.test(message);
}

export function cleanLamaDialogueText(input,text) {
 const natural=lumaBudgetNeutralText(text,textLimit).replace(catalogMarker,'').replace(codePattern,'').trim();
 const contactRequested=requestsStoreContact(input.message);
 return natural.split(/(?<=[.!؟?])(?=\s)|(?<=\n)/).filter(sentence=>{
  if(!contactRequested&&referral.test(sentence))return false;
  if(!/[?؟]/.test(sentence))return true;
  const question=normalizeSearch(sentence);
  if(input.skinType&&input.skinType!=='unknown'&&/(?:نوع بشرتك|بشرتك.{0,12}(?:جافه|جافة|دهنيه|دهنية|مختلطه|مختلطة)|skin type)/.test(question))return false;
  return !(input.ageGroup&&input.ageGroup!=='unknown'&&/عمرك|فيه عمريه|فئه عمريه|فئة عمرية|age range|how old/.test(question));
 }).join('').trim();
}

// The model reads the turns as conversation, while the product facts in
// recent references are reconstructed from the current database.
function conversationTurns(history,current) {
 const contents=[];
 for(const {role,text} of history){
  const line=text.replace(catalogMarker,'').trim();
  if(!line||(!contents.length&&role==='model'))continue;
  if(contents.at(-1)?.role===role)contents.at(-1).parts.push({text:line});
  else contents.push({role,parts:[{text:line}]});
 }
 let last=contents.at(-1);
 if(last?.role!=='user'){
  last={role:'user',parts:[]};
  contents.push(last);
 }
 last.parts.push({text:current.message||'أرفقت صورة مع سؤالي.'});
 if(current.image)last.parts.push({inlineData:current.image});
 return contents;
}

export function buildLamaDialogue(input,allCatalog,shortlist,tools,catalogLoaded) {
 const shopping=wantsLamaRecommendations(input);
 const byId=new Map(allCatalog.map(p=>[p.id,p]));
 const facts=new Map();
 const add=p=>{if(p&&!facts.has(p.id))facts.set(p.id,p);};
 namedCatalogMatches(input.message,allCatalog).forEach(add);
 const prior=latestSuggestedIds(input.history).slice(0,3);
 prior.map(id=>byId.get(id)).forEach(add);
 for(const turn of input.history.filter(turn=>turn.role==='user').slice(-3).reverse()){
  namedCatalogMatches(turn.text,allCatalog).slice(0,2).forEach(add);
 }
 if(shopping)shortlist.forEach(add);
 const relevant=[...facts.values()].slice(0,10);
 const context={
  area:input.area==='unknown'?undefined:input.area,
  requestedRoutine:input.intent==='routine',shopping,guided:input.guided,
  skippedFields:input.skippedFields,
  language:/[\u0600-\u06ff]/.test(input.message)?'ar-JO':'en',
  cartProductIds:input.existingIds,priceLimitFils:input.budgetFils,
  includesDelivery:input.includeDelivery,catalogReadable:catalogLoaded,
  previousSuggestions:prior.flatMap(id=>byId.has(id)?[{id,name:byId.get(id).name}]:[])
 };
 const system=lamaSystem({
  profile:input.visitorProfile,
  catalog:productsContext(shopping&&allCatalog.length<=12?allCatalog:relevant),
  relevant:relevant.map(lumaCatalogFacts),
  context
 });
 return {
  systemInstruction:{parts:[{text:system}]},contents:conversationTurns(input.history,input),
  tools:shopping?tools:[{functionDeclarations:tools[0].functionDeclarations.filter(tool=>tool.name==='get_catalog')}],
  toolConfig:{functionCallingConfig:{mode:shopping?'ANY':'AUTO'}},
  generationConfig:{maxOutputTokens:5600}
 };
}

function displayable(input,text,{final=false}={}) {
 // Hide provider envelopes and internal markers even if an upstream response
 // disregards the request for natural prose.
 if(/^\s*(?:[`]{3}|\{|\[\s*\{|<\/?(?:tool|function))|\b(?:PRODUCTS_JSON|VISITOR_PROFILE|STORE_CONFIG|ACTION CONTRACT|thoughtSignature|functionCall)\b/i.test(text))return '';
 let clean=cleanLamaDialogueText(input,text);
 // A stray store pitch in prose is not an approved product recommendation.
 // Keep the actual advice instead of leaving a dangling promise of cards.
 const paragraphs=clean.split(/\n{2,}/);
 const pitch=paragraphs.findIndex(part=>/(?:متوفر\S* عنا|عنا بمتجر|منتجات.{0,28}من المتجر|خيار.{0,18}من المتجر|خيارات.{0,18}من المتجر|بضيف.{0,16}لسلت|اضيف.{0,16}لسلت|in stock at trend)/i.test(normalizeSearch(part)));
 if(pitch>=0)clean=paragraphs.slice(0,pitch).join('\n\n').trim();
 if(final)clean=clean.replace(/(?:^|\n)[^\n]+[:：]\s*$/,'').trim();
 return clean;
}
const completes=result=>['products','question','handoff'].includes(result.type)||result.type==='answer'&&result.message;
const finishMessage=parts=>parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');

export async function requestLamaDialogue({
 apiKey,primary,input,allCatalog,shortlist,tools,signal,runTool,onDraft,onAttempt,onProgress,recordTokens,catalogLoaded
}) {
 const request=buildLamaDialogue(input,allCatalog,shortlist,tools,catalogLoaded);
 const shopping=request.toolConfig.functionCallingConfig.mode==='ANY';
 const dialoguePrimary=shopping?primary:'gemini-3.5-flash-lite';
 const supported=new Set(request.tools[0].functionDeclarations.map(tool=>tool.name));
 let contents=request.contents,model;
 const lookups=new Set();

 async function ask(round, options={}){
  const result=await requestGemini({
   apiKey,primary:dialoguePrimary,model:options.repair?undefined:model,signal,transport:'dialogue',
   payload:options.payload||{...request,contents},
   timeoutMs:options.repair?6500:model?11000:[15500,8500],
   maxAttempts:model||options.repair?1:2,
   onTextDelta:raw=>onDraft(displayable(input,raw)),
   onAttempt:attempt=>onAttempt(attempt,round)
  });
  recordTokens(result.data.usageMetadata);
  return result;
 }

 try{
  for(let round=1;round<=3;round++){
   const completion=await ask(round);
   model=completion.model;
   const candidate=completion.data.candidates[0];
   const parts=candidate.content?.parts||[];
   if(!['STOP','TOOL_CALL'].includes(candidate.finishReason))throw Error('FINISH_'+String(candidate.finishReason||'UNSPECIFIED').slice(0,48));
   const calls=parts.filter(p=>p.functionCall).map(p=>p.functionCall);
   if(!calls.length){
    const message=displayable(input,finishMessage(parts),{final:true});
    if(message)return {type:'answer',message};
    throw Error('EMPTY_REPLY');
   }
   if(calls.length>6)throw Error('LAMA_TOOL_LOOP');
   onDraft('');
   onProgress('catalog');
   const responses=[];
   for(const call of calls){
    if(!supported.has(call.name))throw Error('LAMA_TOOL_UNAVAILABLE');
    const key=call.name==='get_catalog'?JSON.stringify([call.args?.query||'',call.args?.productIds||[],call.args?.area||'']):'';
    const result=key&&lookups.has(key)
     ? {type:'catalog',message:'نتيجة هذا البحث موجودة في الدور السابق. استخدميها للإجابة أو اسألي عن اسم ناقص.'}
     : await untilAbort(()=>runTool(call),signal);
    if(key)lookups.add(key);
    if(result.type==='answer')result.message=displayable(input,result.message,{final:true});
    if(completes(result))return result;
    // If a product selection is rejected, Gemini can answer with the
    // validation facts or choose a current product in the next round.
    const response=JSON.parse(JSON.stringify(result,(field,value)=>field.endsWith('Fils')?undefined:value));
    responses.push({functionResponse:{name:call.name,...(call.id?{id:call.id}:{}),response}});
   }
   contents=[...contents,{role:'model',parts},{role:'user',parts:responses}];
  }
  throw Error('LAMA_TOOL_LOOP');
 }catch(error){
  if(signal.aborted||!(error.status===400||/^(?:LAMA_TOOL_(?:LOOP|UNAVAILABLE)|EMPTY_REPLY|FINISH_MALFORMED_FUNCTION_CALL|FINISH_UNEXPECTED_TOOL_CALL)$/.test(error.message)))throw error;
  // A malformed tool response must not block a useful prose answer.
  onDraft('');
  onProgress('retry');
  const prompt=request.systemInstruction.parts[0].text+
   '\nهذا الرد نصي مباشر. أجيبي بالمعلومات المتاحة في الرسائل والسياق، من دون استدعاء أدوات أو اقتراح أصناف غير مؤكدة. إذا لم تتوفر معلومة، قولي ما يمكن التحقق منه واسألي سؤالًا محددًا فقط إذا لزم.';
  const completion=await ask(4,{repair:true,payload:{
   contents:request.contents,systemInstruction:{parts:[{text:prompt}]},generationConfig:request.generationConfig
  }});
  const candidate=completion.data.candidates[0];
  const message=displayable(input,finishMessage(candidate.content?.parts||[]),{final:true});
  if(candidate.finishReason!=='STOP'||!message)throw Error('EMPTY_REPLY');
  return {type:'answer',message};
 }
}
