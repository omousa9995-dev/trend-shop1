import {pcmToFloat,bytesToBase64,base64ToBytes} from './luma-pcm.js?v=5.17.1';
const endpoint='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
export class LumaLive {
 constructor({payload,onState,onTool,onNotice}){Object.assign(this,{payload,onState,onTool,onNotice});this.sources=new Set();this.tools=new Map();this.closed=true;this.muted=false;this.sequence=0}
 get active(){return !this.closed}
 state(value){this.onState?.(value)}
 async start(){
  if(!this.closed)return;this.closed=false;const sequence=++this.sequence;this.state('connecting');
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio||!navigator.mediaDevices?.getUserMedia){this.stop();throw Error('الصوت غير متاح في هذا المتصفح. افتحي المتجر في Safari أو Chrome محدث، أو كمّلي كتابةً.')}
  this.abort=new AbortController();
  try{
   this.audio=new Audio({latencyHint:'interactive'});
   await this.audio.resume();if(!this.audio.audioWorklet)throw Error('المتصفح لا يدعم الصوت المباشر. تقدري تكمّلي كتابةً.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(this.closed||sequence!==this.sequence){stream.getTracks().forEach(t=>t.stop());return}this.stream=stream;
   await this.audio.audioWorklet.addModule('/luma-audio-worklet.js?v=5.17.1');
   const initial=this.payload();
   const response=await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body:JSON.stringify({...initial,audioConsent:true,image:undefined}),signal:this.abort.signal});
   const session=await response.json().catch(()=>({}));if(!response.ok)throw Error(session.error||'تعذّر بدء المكالمة الآن.');if(this.closed||sequence!==this.sequence)return;
   if(!/^auth_tokens\//.test(session.token)||session.apiVersion!=='v1beta')throw Error(session.message||'تعذّر بدء المكالمة.');
   this.socket=new WebSocket(endpoint+'?access_token='+encodeURIComponent(session.token));session.token='';
   await new Promise((resolve,reject)=>{
    const wait=setTimeout(()=>reject(Error('تأخر اتصال الصوت. جربي مرة ثانية أو كمّلي كتابةً.')),15000);
    this.socket.onopen=()=>this.send({setup:session.setup});
    this.socket.onerror=()=>{clearTimeout(wait);reject(Error('تعذّر اتصال الصوت. تقدري تكمّلي بالدردشة.'));if(this.connected)this.fail('انقطع اتصال الصوت؛ المحادثة المكتوبة متاحة.')};
    this.socket.onclose=()=>{clearTimeout(wait);reject(Error('انتهى اتصال الصوت.'));if(!this.closed)this.fail('انتهت المكالمة؛ تقدري تكمّلي كتابةً أو تبدئي مكالمة جديدة.')};
    this.socket.onmessage=event=>{Promise.resolve(typeof event.data==='string'?event.data:event.data.text()).then(text=>{
     if(this.closed||sequence!==this.sequence)return;const message=JSON.parse(text);
     if(message.setupComplete){clearTimeout(wait);this.connected=true;resolve()}
     this.message(message);
    }).catch(()=>this.fail('تعذّر قراءة اتصال الصوت. تقدري تكمّلي كتابةً.'))};
   });
   if(this.closed||sequence!==this.sequence)return;
   this.node=new AudioWorkletNode(this.audio,'luma-pcm-capture');this.silent=this.audio.createGain();this.silent.gain.value=0;this.input=this.audio.createMediaStreamSource(this.stream);
   this.node.port.onmessage=e=>{if(this.closed||this.muted||!this.connected)return;if(this.socket.bufferedAmount>131072){this.fail('الاتصال بطيء للصوت حاليًا؛ كمّلي كتابةً.');return}this.send({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:bytesToBase64(new Uint8Array(e.data))}}})};
   this.input.connect(this.node);this.node.connect(this.silent);this.silent.connect(this.audio.destination);this.started=Date.now();this.state('listening');
   this.timer=setTimeout(()=>this.fail('انتهت مدة المكالمة. تقدري تكمّلي كتابةً أو تبدئي مكالمة جديدة.'),Math.max(1000,Math.min((session.maxCallSeconds||180)*1000,Date.parse(session.expiresAt)-Date.now())));
   this.sendText(initial.message?.trim()||'ابدئي بترحيب قصير واسألي سؤالًا واحدًا عن احتياجي، دون اقتراح منتجات الآن.');
  }catch(error){if(sequence!==this.sequence)return;this.stop();if(error.name==='NotAllowedError'||error.name==='PermissionDeniedError')throw Error('الميكروفون غير مسموح. فعّلي إذنه من إعدادات المتصفح أو كمّلي كتابةً.');if(error.name==='NotFoundError')throw Error('لم أجد ميكروفونًا متاحًا. تقدري تكمّلي كتابةً.');throw error}
 }
 send(message){if(this.socket?.readyState===WebSocket.OPEN&&!this.closed)this.socket.send(JSON.stringify(message))}
 sendText(text){this.clearPlayback();this.send({clientContent:{turns:[{role:'user',parts:[{text:String(text).slice(0,1500)}]}],turnComplete:true}})}
 message(message){
  if(message.error){this.fail('تعذّر استمرار المكالمة. كمّلي بالدردشة المكتوبة.');return}
  if(message.goAway){this.fail('اقتربت نهاية اتصال الصوت. تقدري تبدئي مكالمة جديدة أو تكمّلي كتابةً.');return}
  const content=message.serverContent;
  if(content?.interrupted){this.clearPlayback();this.state(this.muted?'muted':'listening')}
  for(const part of content?.modelTurn?.parts||[]){const audio=part.inlineData;if(audio?.mimeType?.startsWith('audio/pcm')&&typeof audio.data==='string'&&audio.data.length<1500000)this.play(audio.data)}
  if(content?.turnComplete&&!this.sources.size)this.state(this.muted?'muted':'listening');
  for(const id of message.toolCallCancellation?.ids||[]){this.tools.get(id)?.abort();this.tools.delete(id)}
  for(const call of (message.toolCall?.functionCalls||[]).slice(0,6))this.tool(call).catch(()=>{});
 }
 async tool(call){
  const id=String(call.id||'').slice(0,200);if(!id||this.tools.has(id))return;const abort=new AbortController();this.tools.set(id,abort);
  try{const response=await fetch('/api/luma-tools',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body:JSON.stringify({...this.payload(),liveMode:true,audioConsent:true,image:undefined,call:{id,name:call.name,args:call.args}}),signal:abort.signal});const result=await response.json().catch(()=>({}));if(this.closed||abort.signal.aborted)return;if(!response.ok)throw Error();this.onTool?.(result);this.send({toolResponse:{functionResponses:[{id,name:call.name,response:result}]}})}catch{if(!this.closed&&!abort.signal.aborted)this.send({toolResponse:{functionResponses:[{id,name:call.name,response:{error:'لم يمكن التحقق من بيانات المتجر الآن؛ لا ترشحي منتجًا غير متحقق.'}}]}})}finally{this.tools.delete(id)}
 }
 play(data){
  if(this.closed||!this.audio||this.audio.state==='closed')return;
  const samples=pcmToFloat(base64ToBytes(data));if(!samples.length)return;
  const buffer=this.audio.createBuffer(1,samples.length,24000);buffer.copyToChannel(samples,0);const source=this.audio.createBufferSource();source.buffer=buffer;source.connect(this.audio.destination);
  this.next=Math.max(this.audio.currentTime+.02,this.next||0);if(this.next-this.audio.currentTime>12){this.clearPlayback();this.next=this.audio.currentTime+.02}
  source.start(this.next);this.next+=buffer.duration;this.sources.add(source);this.state('speaking');source.onended=()=>{this.sources.delete(source);source.disconnect();if(!this.closed&&!this.sources.size)this.state(this.muted?'muted':'listening')};
 }
 clearPlayback(){for(const source of this.sources){source.onended=null;try{source.stop();source.disconnect()}catch{}}this.sources.clear();this.next=0}
 mute(){this.muted=!this.muted;this.node?.port.postMessage({muted:this.muted});for(const track of this.stream?.getAudioTracks()||[])track.enabled=!this.muted;this.state(this.muted?'muted':'listening');return this.muted}
 fail(message){this.stop();this.onNotice?.(message)}
 stop(){
  this.closed=true;this.connected=false;this.sequence++;clearTimeout(this.timer);this.abort?.abort();for(const abort of this.tools.values())abort.abort();this.tools.clear();this.clearPlayback();this.node?.port.close();try{this.input?.disconnect();this.node?.disconnect();this.silent?.disconnect()}catch{}for(const track of this.stream?.getTracks()||[])track.stop();if(this.socket){this.socket.onclose=null;this.socket.onerror=null;this.socket.close(1000);this.socket=null}this.audio?.close().catch(()=>{});this.stream=null;this.muted=false;this.state('idle');
 }
}
