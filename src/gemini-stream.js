// Official step-based Interactions SSE and generateContent SSE adapters.
// Never forward thought summaries, signatures, raw action JSON or provider errors.
// Also bounds work that doesn't natively respect fetch's AbortSignal.
export async function untilAbort(task, signal) {
 if (!signal) return task();
 signal.throwIfAborted();
 let abort;
 const stopped = new Promise((_,reject)=>{
  abort = () => reject(signal.reason ?? new DOMException('Aborted','AbortError'));
  signal.addEventListener('abort',abort,{once:true});
 });
 try { return await Promise.race([task(),stopped]); }
 finally { signal.removeEventListener('abort',abort); }
}
export async function* providerEvents(body,{signal,maxBytes=180000}={}){
 const reader=body?.getReader();if(!reader)throw Error('EMPTY_STREAM');
 const decoder=new TextDecoder();let pending='',total=0,abort;
 const cancelled=new Promise((_,reject)=>{abort=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));signal?.addEventListener('abort',abort,{once:true})});
 const parse=block=>{const raw=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');return !raw||raw==='[DONE]'?null:JSON.parse(raw)};
 try{
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  while(true){
   const {done,value}=await Promise.race([reader.read(),cancelled]);if(done)break;
   total+=value.byteLength;if(total>maxBytes)throw Error('STREAM_TOO_LARGE');pending+=decoder.decode(value,{stream:true});pending=pending.replace(/\r\n/g,'\n');
   let end;while((end=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);const event=parse(block);if(event)yield event;}
  }
  pending+=decoder.decode();if(pending.trim()){const event=parse(pending);if(event)yield event;}
 }finally{signal?.removeEventListener('abort',abort);reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}}
}
export async function readGeminiStream(response,{api,signal,onTextDelta}){
 let text='',completed=false,usage={},finish='';const stepTypes=new Map();
 for await(const event of providerEvents(response.body,{signal})){
  if(event.error||/failed|error/.test(event.event_type||''))throw Error('PROVIDER_STREAM_FAILED');
  let delta='';
  if(api==='interactions'){
   const type=event.event_type||event.type;
   if(type==='step.start')stepTypes.set(event.index,event.step?.type);
   if(type==='step.delta'&&event.delta?.type==='text'&&(!stepTypes.has(event.index)||stepTypes.get(event.index)==='model_output'))delta=event.delta.text||'';
   if(type==='interaction.completed'){if(event.interaction?.status&&event.interaction.status!=='completed')throw Error('PROVIDER_INCOMPLETE');completed=true;usage=event.interaction?.usage||event.usage||{};break;}
  }else{
   const candidate=event.candidates?.[0];delta=(candidate?.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
   if(event.usageMetadata)usage=event.usageMetadata;
   if(candidate?.finishReason){finish=candidate.finishReason;completed=finish==='STOP';if(!completed)throw Error('FINISH_'+finish);}
  }
  if(delta){text+=delta;if(text.length>16000)throw Error('STREAM_TOO_LARGE');await untilAbort(()=>onTextDelta(text),signal);}
  // GenerateContent's final non-empty chunk carries STOP. Do not wait for EOF.
  if(api!=='interactions'&&completed)break;
 }
 if(!completed||!text.trim())throw Error(completed?'EMPTY_REPLY':'PROVIDER_INCOMPLETE');
 return {candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text}]}}],usageMetadata:api==='interactions'?{promptTokenCount:usage.total_input_tokens||0,candidatesTokenCount:usage.total_output_tokens||0,thoughtsTokenCount:usage.total_thought_tokens||0}:usage};
}

// Decode only complete JSON keys and the visible text string. Partial escapes
// are held until complete, including split Unicode surrogate pairs.
function stringAt(raw,start){
 let out='',i=start+1;
 for(;i<raw.length;i++){
  const c=raw[i];if(c==='"')return {value:out,end:i+1,complete:true};
  if(c!=='\\'){out+=c;continue;}
  const e=raw[++i];if(e===undefined)break;
  if(e==='u'){const h=raw.slice(i+1,i+5);if(!/^[a-f0-9]{4}$/i.test(h))break;out+=String.fromCharCode(parseInt(h,16));i+=4;}
  else if('"\\/bfnrt'.includes(e))out+=({'b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'})[e]??e;else return {value:'',complete:false,end:raw.length};
 }
 if(/[\uD800-\uDBFF]$/.test(out))out=out.slice(0,-1);
 return {value:out,end:i,complete:false};
}
export function visibleActionText(raw){
 raw=raw.trimStart().replace(/^```(?:json)?\s*/i,'');if(raw[0]!=='{')return null;
 let depth=0,action,visible,prefixArgs;
 for(let i=0;i<raw.length;i++){
  if(raw[i]==='{')depth++;else if(raw[i]==='}')depth--;
  else if(raw[i]==='"'){
   const key=stringAt(raw,i);if(!key.complete)break;i=key.end-1;
   if(depth!==1)continue;
   let at=key.end;while(/\s/.test(raw[at]||'x'))at++;if(raw[at]!==':')continue;at++;while(/\s/.test(raw[at]||'x'))at++;
   if(raw[at]!=='"')continue;
   const value=stringAt(raw,at);if(key.value==='action'&&value.complete)action=value.value;if(key.value==='text'){visible=value.value;try{prefixArgs=JSON.parse(raw.slice(0,at)+'""}')}catch{}}
   i=value.end-1;if(!value.complete)break;
  }
 }
 return ['answer_customer','show_products'].includes(action)&&typeof visible==='string'?{action,text:visible,...(action==='show_products'&&Array.isArray(prefixArgs?.productIds)?{args:prefixArgs}:{})}:null;
}
