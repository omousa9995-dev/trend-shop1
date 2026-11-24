import {actionRequest,actionResponse} from './luma-json-actions.js';
import {interactionRequest,interactionResponse} from './gemini-interactions.js';
import {readGeminiStream,untilAbort} from './gemini-stream.js';
// All credentials and inference stay server-side. No request text or raw provider
// diagnostics are logged. A complete bounded JSON turn is validated before UI output.
export const GEMINI_TEXT_MODELS=['gemini-3.8-flash','gemini-3.5-flash-lite'];
export function modelOrder(primary){const first=GEMINI_TEXT_MODELS.includes(primary)?primary:GEMINI_TEXT_MODELS[0];return [first,...GEMINI_TEXT_MODELS.filter(m=>m!==first)]}
async function boundedJson(response,maxBytes,signal){
 const reader=response.body?.getReader();if(!reader)throw Error('PROVIDER_RESPONSE_INVALID');
 let bytes=0,out='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await untilAbort(()=>reader.read(),signal);if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw Error('PROVIDER_RESPONSE_TOO_LARGE');out+=decoder.decode(value,{stream:true})}out+=decoder.decode();return JSON.parse(out)}finally{reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}}
}
function problem(status,data){
 const info=data?.error||{},message=typeof info.message==='string'?info.message:'';
 const reason=status===401||status===403?'AUTH':status===402||/billing|prepay|credit balance/i.test(message)?'BILLING':status===404?'MODEL':status===429?'RATE_LIMIT':/overload|capacity|busy/i.test(message)?'CAPACITY':status>=500?'UNAVAILABLE':'INVALID_REQUEST';
 return Object.assign(Error('PROVIDER_HTTP_'+status),{status,reason});
}
export async function requestGemini({apiKey,primary,model,payload,signal,transport='generateContent',preferredApi,onAttempt=()=>{},onTextDelta,timeoutMs=15000,alternateModel=false}){
 const candidates=model?(alternateModel?modelOrder(model):[model,model]):modelOrder(primary);let last;
 for(let index=0;index<candidates.length;index++){
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  const selected=candidates[index];if(!GEMINI_TEXT_MODELS.includes(selected))throw Error('INVALID_PROVIDER_MODEL');
  const actions=transport==='actions',live=transport==='interactions'||actions&&(preferredApi==='generateContent'?index===1:index===0),api=live?'interactions':'generateContent';
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(new DOMException('Attempt timed out','TimeoutError')),timeoutMs);
  let retryAfter=0;
  try{
   // Use the current stateless API for actions first, then a bounded plain-text
   // generateContent alternate. Neither path enables native tools/JSON decoding.
   const prepared=actions?actionRequest(payload):payload;
   // Flash-Lite supports minimal thinking for latency-sensitive store actions.
   // The alternate 3.8 model supports low, not minimal. Never send an unsupported level.
   if(actions&&selected==='gemini-3.5-flash-lite')prepared.generationConfig.thinkingConfig={thinkingLevel:'minimal'};
   const streaming=typeof onTextDelta==='function',body=live?{...interactionRequest(selected,prepared),...(streaming?{stream:true}:{})}:prepared;
   const combined=signal?AbortSignal.any([signal,timeout.signal]):timeout.signal;
   const response=await untilAbort(()=>fetch(live?'https://generativelanguage.googleapis.com/v1beta/interactions':'https://generativelanguage.googleapis.com/v1beta/models/'+selected+(streaming?':streamGenerateContent?alt=sse':':generateContent'),{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey,...(live?{'Api-Revision':'2026-05-20'}:{})},body:JSON.stringify(body),signal:combined}),combined);
   const hint=response.headers.get('retry-after');if(hint)retryAfter=/^\d+(?:\.\d+)?$/.test(hint)?Number(hint)*1000:Math.max(0,Date.parse(hint)-Date.now());
   if(!response.ok){const info=await untilAbort(()=>boundedJson(response,16000,combined),combined).catch(()=>({}));throw problem(response.status,info)}
   const sse=streaming&&/text\/event-stream/i.test(response.headers.get('content-type')||'');
   const raw=await untilAbort(()=>sse?readGeminiStream(response,{api,signal:combined,onTextDelta}):boundedJson(response,180000,combined),combined),normalized=live&&!sse?interactionResponse(raw):raw,data=actions?actionResponse(normalized):normalized;if(!Array.isArray(data.candidates)||!data.candidates.length)throw Error('PROVIDER_RESPONSE_INVALID');
   onAttempt({model:selected,transport,api,attempt:index+1,ok:true});return {data,model:selected,api,fallback:index>0};
  }catch(error){
   if(signal?.aborted)throw signal.reason||error;
   const timedOut=timeout.signal.aborted;last=timedOut?Object.assign(Error('PROVIDER_TIMEOUT'),{reason:'TIMEOUT'}):error;
   const category=last.reason||({INVALID_ACTION_OUTPUT:'ACTION_FORMAT',PROVIDER_RESPONSE_INVALID:'RESPONSE_FORMAT',PROVIDER_RESPONSE_TOO_LARGE:'RESPONSE_SIZE',EMPTY_REPLY:'EMPTY_REPLY'})[last.message]||'TRANSPORT';
   onAttempt({model:selected,transport,api,attempt:index+1,ok:false,status:last.status||0,reason:category});
   const transient=timedOut||!last.status||[408,429,500,502,503,504].includes(last.status)||last.status===404;
   if(!transient||index===candidates.length-1||retryAfter>2000)throw last;
  }finally{clearTimeout(timer)}
  // Bounded backoff applies before another provider attempt; never retry forever.
  await new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal?.reason||new DOMException('Aborted','AbortError'))};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve()},Math.max(300,Math.min(2000,retryAfter)));signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop()});
 }
 throw last||Error('PROVIDER_UNAVAILABLE');
}
