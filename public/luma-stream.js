// A terminal SSE event completes the turn; network EOF is not a completion signal.
// In particular, server bookkeeping may continue after `done` has been sent.
export async function consumeLumaStream(response,onEvent,signal,{idleMs=0}={}){
 const reader=response.body?.getReader();if(!reader)throw Error('تعذّر استقبال الإجابة.');
 const decoder=new TextDecoder();let pending='',bytes=0,abort,timer;
 const cancelled=new Promise((_,reject)=>{abort=()=>reject(new DOMException('Cancelled','AbortError'));signal?.addEventListener('abort',abort,{once:true})});
 const dispatch=block=>{
  const lines=block.split('\n'),event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim()||'message';
  const raw=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
  if(raw)onEvent(event,JSON.parse(raw));return event==='done'||event==='error';
 };
 try{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  while(true){
   const waits=[reader.read(),cancelled];
   if(idleMs)waits.push(new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('LUMA_STREAM_IDLE')),idleMs)}));
   const {done,value}=await Promise.race(waits);
   clearTimeout(timer);
   if(done){
    pending+=decoder.decode();
    if(pending.trim()&&dispatch(pending))return;
    throw Error('LUMA_STREAM_ENDED');
   }
   bytes+=value.byteLength;if(bytes>300000)throw Error('تجاوزت الإجابة الحجم المتوقع.');
   pending+=decoder.decode(value,{stream:true});pending=pending.replace(/\r\n/g,'\n');
   let at;while((at=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,at);pending=pending.slice(at+2);if(dispatch(block))return}
  }
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener('abort',abort);
  // A broken stream's cancel hook must never keep the composer locked.
  reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}
 }
}

export function appendLumaHistory(history,user,answer,productIds=[]){
 const ids=[...new Set(productIds)].filter(id=>typeof id==='string'&&/^TS[A-Z0-9-]{4,64}$/.test(id)).slice(0,3);
 const references=ids.length?'\nالمنتجات المقترحة: '+ids.join(', '):'';
 const items=[...history,{role:'user',text:user.slice(0,1500)},{role:'model',text:answer.slice(0,2400-references.length)+references}].slice(-10);
 while(items.length>2&&items.reduce((n,item)=>n+item.text.length,0)>10000)items.splice(0,2);
 return items;
}
