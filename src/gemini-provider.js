import {actionRequest,actionResponse} from './luma-json-actions.js';
import {interactionRequest,interactionResponse} from './gemini-interactions.js';
// All credentials and inference stay server-side. No request text or raw provider
// diagnostics are logged. A complete bounded JSON turn is validated before UI output.
export const GEMINI_TEXT_MODELS=['gemini-3.8-flash','gemini-3.5-flash-lite'];
export function modelOrder(primary){const first=GEMINI_TEXT_MODELS.includes(primary)?primary:GEMINI_TEXT_MODELS[0];return [first,...GEMINI_TEXT_MODELS.filter(m=>m!==first)]}
async function boundedJson(response,maxBytes){
 const reader=response.body?.getReader();if(!reader)throw Error('PROVIDER_RESPONSE_INVALID');
 let bytes=0,out='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw Error('PROVIDER_RESPONSE_TOO_LARGE');out+=decoder.decode(value,{stream:true})}out+=decoder.decode();return JSON.parse(out)}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
function problem(status,data){
 const info=data?.error||{},message=typeof info.message==='string'?info.message:'';
 const reason=status===401||status===403?'AUTH':status===402||/billing|prepay|credit balance/i.test(message)?'BILLING':status===404?'MODEL':status===429?'RATE_LIMIT':/overload|capacity|busy/i.test(message)?'CAPACITY':status>=500?'UNAVAILABLE':'INVALID_REQUEST';
 return Object.assign(Error('PROVIDER_HTTP_'+status),{status,reason});
}
export async function requestGemini({apiKey,primary,model,payload,signal,transport='generateContent',onAttempt=()=>{},timeoutMs=15000}){
 const candidates=model?[model,model]:modelOrder(primary);let last;
 for(let index=0;index<candidates.length;index++){
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  const selected=candidates[index];if(!GEMINI_TEXT_MODELS.includes(selected))throw Error('INVALID_PROVIDER_MODEL');
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(new DOMException('Attempt timed out','TimeoutError')),timeoutMs);
  let retryAfter=0;
  try{
   const live=transport==='interactions',body=live?interactionRequest(selected,payload):transport==='actions'?actionRequest(payload):payload;
   const response=await fetch(live?'https://generativelanguage.googleapis.com/v1beta/interactions':'https://generativelanguage.googleapis.com/v1beta/models/'+selected+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout.signal]):timeout.signal});
   const hint=response.headers.get('retry-after');if(hint)retryAfter=/^\d+(?:\.\d+)?$/.test(hint)?Number(hint)*1000:Math.max(0,Date.parse(hint)-Date.now());
   if(!response.ok){const info=await boundedJson(response,16000).catch(()=>({}));throw problem(response.status,info)}
   const raw=await boundedJson(response,180000),data=live?interactionResponse(raw):transport==='actions'?actionResponse(raw):raw;if(!Array.isArray(data.candidates)||!data.candidates.length)throw Error('PROVIDER_RESPONSE_INVALID');
   onAttempt({model:selected,transport,attempt:index+1,ok:true});return {data,model:selected,fallback:index>0};
  }catch(error){
   if(signal?.aborted)throw signal.reason||error;
   const timedOut=timeout.signal.aborted;last=timedOut?Object.assign(Error('PROVIDER_TIMEOUT'),{reason:'TIMEOUT'}):error;
   onAttempt({model:selected,transport,attempt:index+1,ok:false,status:last.status||0,reason:last.reason||'TRANSPORT'});
   const transient=timedOut||!last.status||[408,429,500,502,503,504].includes(last.status)||last.status===404;
   if(!transient||index===candidates.length-1||retryAfter>2000)throw last;
  }finally{clearTimeout(timer)}
  // Bounded backoff applies before another provider attempt; never retry forever.
  await new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal?.reason||new DOMException('Aborted','AbortError'))};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve()},Math.max(300,Math.min(2000,retryAfter)));signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop()});
 }
 throw last||Error('PROVIDER_UNAVAILABLE');
}
