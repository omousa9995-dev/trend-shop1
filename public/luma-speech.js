export const MAX_RECORDING_SECONDS=45;
const MAX_BYTES=1048576;
const formats=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'];
const normalizeMime=mime=>mime.split(';')[0].toLowerCase();
const supportedMime=mime=>['audio/webm','audio/mp4','audio/m4a','audio/x-m4a','audio/ogg','audio/wav'].includes(normalizeMime(mime||''));
export class LumaDictation{
 constructor({onState=()=>{},onTranscript=()=>{},onNotice=()=>{}}={}){Object.assign(this,{onState,onTranscript,onNotice,sequence:0,state:'idle',chunks:[]})}
 get available(){return !!globalThis.navigator?.mediaDevices?.getUserMedia&&typeof globalThis.MediaRecorder==='function'}
 get active(){return this.state!=='idle'}
 stateTo(value){this.state=value;this.onState(value)}
 release(){clearTimeout(this.timer);clearInterval(this.clock);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null}
 async start(){
  if(this.active)return;if(!this.available)throw Error('التسجيل غير مدعوم هنا؛ تقدري ترفقي تسجيلًا محفوظًا أو تكتبي سؤالكِ.');
  const sequence=++this.sequence;this.stateTo('permission');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
   if(sequence!==this.sequence){stream.getTracks().forEach(t=>t.stop());return}
   this.stream=stream;const mimeType=formats.find(type=>MediaRecorder.isTypeSupported(type));
   this.recorder=new MediaRecorder(stream,mimeType?{mimeType,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000});
   if(!supportedMime(this.recorder.mimeType))throw Error('صيغة التسجيل غير مدعومة؛ جربي إرفاق تسجيل M4A أو WAV.');
   this.chunks=[];this.bytes=0;this.discard=false;
   this.recorder.ondataavailable=event=>{if(sequence!==this.sequence||!event.data.size)return;this.bytes+=event.data.size;if(this.bytes>MAX_BYTES){this.onNotice('التسجيل أكبر من المسموح؛ جرّبي تسجيلًا أقصر.');this.cancel();return}this.chunks.push(event.data)};
   this.recorder.onerror=()=>{this.onNotice('تعذّر التسجيل. تقدري تكتبي سؤالكِ.');this.cancel()};
   this.recorder.onstop=()=>{this.release();if(sequence!==this.sequence||this.discard){this.chunks=[];return}const blob=new Blob(this.chunks,{type:this.recorder.mimeType});this.chunks=[];this.transcribe(blob,Math.min(MAX_RECORDING_SECONDS,(Date.now()-this.started)/1000),sequence).catch(()=>{})};
   this.started=Date.now();this.recorder.start(250);this.stateTo('recording');
   this.clock=setInterval(()=>this.onState('recording',Math.floor((Date.now()-this.started)/1000)),1000);
   this.timer=setTimeout(()=>this.finish(),MAX_RECORDING_SECONDS*1000);
  }catch(error){if(sequence!==this.sequence)return;this.release();this.stateTo('idle');throw Error(error.name==='NotAllowedError'?'اسمحي بالميكروفون من إعدادات المتصفح، أو اكتبي سؤالكِ.':error.name==='NotFoundError'?'لم أجد ميكروفونًا متاحًا. تقدري تكتبي سؤالكِ أو ترفقي تسجيلًا.':error.message||'تعذّر تشغيل الميكروفون.')}
 }
 finish(){if(this.state!=='recording')return;this.stateTo('transcribing');this.release();if(this.recorder?.state!=='inactive')this.recorder.stop()}
 cancel(){++this.sequence;this.discard=true;this.release();this.controller?.abort();this.controller=null;if(this.recorder?.state&&this.recorder.state!=='inactive')this.recorder.stop();this.chunks=[];this.stateTo('idle')}
 async transcribe(blob,durationSeconds,sequence=this.sequence){
  if(sequence!==this.sequence)return;this.stateTo('transcribing');
  let timer;
  try{
   if(blob.size>MAX_BYTES||blob.size<44||!supportedMime(blob.type)||!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>MAX_RECORDING_SECONDS)throw Error('اختاري تسجيلًا لا يتجاوز 45 ثانية وميغابايت واحد.');
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('تعذّرت قراءة التسجيل.'));reader.readAsDataURL(blob)});
   if(sequence!==this.sequence)return;
   const controller=new AbortController();this.controller=controller;timer=setTimeout(()=>controller.abort(),40000);
   const response=await fetch('/api/transcribe',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body:JSON.stringify({audioConsent:true,audio:{mimeType:normalizeMime(blob.type),data},durationSeconds}),signal:controller.signal});
   const result=await response.json().catch(()=>({}));if(!response.ok||typeof result.text!=='string'||!result.text.trim())throw Error(result.error||'ما قدرت أميّز الكلام. جرّبي مرة ثانية.');
   if(sequence===this.sequence){clearTimeout(timer);this.controller=null;this.stateTo('idle');await this.onTranscript(result.text.slice(0,1500))}
  }catch(error){if(sequence===this.sequence)this.onNotice(error.name==='AbortError'?'انتهى انتظار تحويل التسجيل؛ تقدري تكتبي سؤالكِ.':error.message)}
  finally{clearTimeout(timer);if(sequence===this.sequence&&this.state==='transcribing'){this.controller=null;this.stateTo('idle')}}
 }
 async fromFile(file){
  if(this.active)return;
  if(!file||file.size>MAX_BYTES||!supportedMime(file.type))throw Error('اختاري ملف M4A أو WebM أو OGG أو WAV أصغر من ميغابايت.');
  const sequence=++this.sequence;this.stateTo('preparing');
  const url=URL.createObjectURL(file),audio=document.createElement('audio');let timer;
  try{
   const seconds=await new Promise((resolve,reject)=>{audio.preload='metadata';audio.onloadedmetadata=()=>resolve(audio.duration);audio.onerror=()=>reject(Error('تعذّرت قراءة مدة التسجيل.'));timer=setTimeout(()=>reject(Error('تعذّرت قراءة مدة التسجيل. جرّبي M4A أو WAV.')),8000);audio.src=url});
   clearTimeout(timer);if(sequence!==this.sequence)return;await this.transcribe(file,seconds,sequence);
  }finally{clearTimeout(timer);URL.revokeObjectURL(url);audio.removeAttribute('src');audio.load();if(sequence===this.sequence&&this.state==='preparing')this.stateTo('idle')}
 }
}

export class LumaSpeech{
 constructor({onNotice=()=>{}}={}){this.onNotice=onNotice;this.sequence=0}
 get available(){return !!globalThis.speechSynthesis&&typeof globalThis.SpeechSynthesisUtterance==='function'}
 stop(){++this.sequence;globalThis.speechSynthesis?.cancel();this.finish?.();this.finish=null;this.button=null}
 play(text,button){
  if(this.button===button){this.stop();return}
  this.stop();if(!this.available){this.onNotice('الاستماع غير مدعوم في هذا المتصفح.');return}
  const clean=String(text||'').replace(/https?:\/\/\S+/g,'').replace(/[♡✦✓*#]/g,'').trim();if(!clean)return;
  const parts=clean.match(/[^\n.!؟]{1,220}(?:[\n.!؟]+|\s|$)|\S.{0,219}/g)||[clean.slice(0,220)],sequence=this.sequence;
  const voices=speechSynthesis.getVoices(),voice=voices.find(v=>/^ar-JO$/i.test(v.lang))||voices.find(v=>/^ar-SA$/i.test(v.lang))||voices.find(v=>/^ar(?:-|$)/i.test(v.lang));
  this.button=button;button.setAttribute('aria-pressed','true');button.title='إيقاف الاستماع';this.finish=()=>{button.setAttribute('aria-pressed','false');button.title='اسمعي الرد'};
  let index=0;const next=()=>{
   if(sequence!==this.sequence)return;if(index>=parts.length){this.finish?.();this.finish=null;this.button=null;return}
   const utterance=new SpeechSynthesisUtterance(parts[index++]);utterance.lang=voice?.lang||'ar-JO';if(voice)utterance.voice=voice;utterance.rate=.95;utterance.onend=next;
   utterance.onerror=event=>{if(sequence!==this.sequence)return;this.stop();if(!['canceled','interrupted'].includes(event.error))this.onNotice('تعذّر تشغيل الصوت. تأكدي من مستوى صوت الجهاز وتوفّر صوت عربي في إعداداته.')};
   this.utterance=utterance;speechSynthesis.speak(utterance);
  };next();
 }
}
