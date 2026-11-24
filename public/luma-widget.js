import {savedLumaProfile,saveLumaPreferences,lumaShortcuts,lumaGuideQuestions,skinNames,concernNames,profileChoices} from './luma-profile.js?v=5.23.3';
import {preparePhotoFile} from './prepare-photo.js?v=5.21.0';
import {consumeLumaStream,appendLumaHistory} from './luma-stream.js?v=5.23.4';
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const TURN_TIMEOUT_MS = 29000;
const STREAM_IDLE_MS = 10000;
const normalizeChoice=value=>value.trim().replace(/[٠-٩]/g,digit=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[–—]/g,'-').replace(/\s+/g,'').replace(/[؟.?!]/g,'');
const money=n=>(n/1000).toLocaleString('ar-JO',{minimumFractionDigits:2,maximumFractionDigits:2})+' د.أ';
let instance;
export async function mountLumaWidget({status:initial,standalone=false}={}){
 if(instance)return instance;
 const status=initial||await fetch('/api/care/status',{cache:'no-store',signal:AbortSignal.timeout(6000)}).then(r=>r.json());
 if(!status.available)throw Error('لُمى غير متاحة حاليًا. تقدري تتواصلي مع المتجر.');
 if(!document.querySelector('[data-luma-styles]')){const css=make('link');css.rel='stylesheet';css.href='/luma-widget.css?v=5.23.3';css.dataset.lumaStyles='1';document.head.append(css)}
 const dialog=make('dialog',undefined,'luma-chat');dialog.id='lumaChat';dialog.dir='rtl';dialog.lang='ar';dialog.setAttribute('aria-labelledby','lumaChatTitle');
 dialog.innerHTML=`<header class="luma-head"><span class="luma-avatar" aria-hidden="true"><img src="/images/editorial/beauty-hero-v2.webp" alt=""/></span><div><h2 id="lumaChatTitle">لُمى <span lang="en">Luma</span></h2><p>معكِ للعناية والجمال</p></div><button type="button" class="luma-new-chat" data-luma-reset title="بدء محادثة جديدة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5H5v14h14v-7M10 14l1-4L19 2l3 3-8 8-4 1Z"/></svg><span>محادثة جديدة</span></button><button type="button" data-luma-close aria-label="إغلاق محادثة لُمى">×</button></header>
 <div class="luma-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="محادثتكِ مع لُمى" tabindex="0"></div>
 <div class="luma-notice" role="status" aria-live="polite"></div>
 <div class="luma-quick" aria-label="اختيارات سريعة"></div>
 <form class="luma-composer">
 <div class="luma-image-preview" hidden><img alt="معاينة الصورة على جهازكِ"/><button type="button" data-luma-remove-photo>إزالة الصورة</button><p>صورة اختيارية تُرسل مع سؤالكِ لفهم ما يظهر فيها. تجنّبي أي معلومات شخصية أو مناطق خاصة.</p></div>
 <label class="luma-input-label" for="lumaMessage">احكيلي شو محتاجة</label><div class="luma-input-row"><textarea id="lumaMessage" rows="2" maxlength="1500" placeholder="سؤالكِ، روتينكِ أو اختيارات مكياجكِ…"></textarea><button class="luma-send" type="submit" aria-label="إرسال إلى لُمى">←</button></div>
 <div class="luma-preference-tools">
  <label><input type="checkbox" data-luma-remember/> تذكّري تفضيلاتي على هالجهاز</label>
  <button type="button" data-luma-forget hidden>امسحي تفضيلاتي</button>
 </div>
 <div class="luma-actions"><label class="luma-photo-button" title="إرفاق صورة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/></svg><input type="file" accept="image/*,.heic,.heif" data-luma-photo aria-label="إرفاق صورة اختيارية"/></label><button type="button" data-luma-stop hidden>إيقاف الرد</button><button type="button" data-luma-retry hidden>إعادة المحاولة</button></div></form>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),log=$('.luma-log'),quick=$('.luma-quick'),notice=$('.luma-notice'),form=$('form'),message=$('#lumaMessage');
 const removers=[];const listen=(target,event,fn)=>{target?.addEventListener(event,fn);removers.push(()=>target?.removeEventListener(event,fn))};let destroyed=false;
 let storage;try{storage=localStorage}catch{}
 const remembered=savedLumaProfile(storage);
 const baseProfile=()=>({area:'unknown',skinType:'unknown',sensitive:'unknown',...savedLumaProfile(storage).profile});
 let guide=null,pendingQuestion=null,skipped=new Set();
 let activeTurn,failedTurn,history=[],profile=baseProfile(),budgetFils=remembered.budgetFils,image=null,photoBusy=false,photoSequence=0,returnFocus,scrollFrame=0,pinned=true,locked=null;
 function scroll(force=false){if(!force&&!pinned)return;cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight})}
 log.addEventListener('scroll',()=>{pinned=log.scrollHeight-log.scrollTop-log.clientHeight<65},{passive:true});
 function bubble(text,side='model'){const item=make('article',undefined,'luma-bubble luma-'+side);item.append(make('span',side==='user'?'أنتِ':'لُمى','luma-speaker'),make('p',text));log.append(item);while(log.children.length>48)log.firstElementChild.remove();scroll();return item}
 function refresh(){
  const busy=!!activeTurn;
  $('.luma-send').disabled=busy||photoBusy;for(const b of dialog.querySelectorAll('.luma-quick button,.luma-plan-next button'))b.disabled=busy||photoBusy;
  $('[data-luma-photo]').disabled=busy;$('.luma-photo-button').hidden=!status.imagesAvailable;
  $('[data-luma-stop]').hidden=!busy;$('[data-luma-retry]').hidden=busy||!failedTurn;
  $('.luma-head p').textContent=busy?'لُمى بتحضّر إجابتكِ…':'معكِ للعناية والجمال';dialog.setAttribute('aria-busy',String(busy));
 }
 function payload(){let existingIds=[];try{existingIds=JSON.parse(localStorage.getItem('trend-shop-cart-v1')||'[]').map(x=>x.id).filter(x=>typeof x==='string'&&/^TS[A-Z0-9-]{4,64}$/.test(x)).slice(0,20)}catch{}return {message:message.value.trim(),history,budgetFils,includeDelivery:true,profile,existingIds,...(image?{image}:{})}}
 function action(target,text,callback){
  const button=make('button',text);button.type='button';button.disabled=!!activeTurn||photoBusy;button.onclick=callback;target.append(button);return button;
 }
 function remember(){
  const checkbox=$('[data-luma-remember]'),ok=saveLumaPreferences(storage,checkbox.checked?{profile,budgetFils}:null);
  if(!ok&&checkbox.checked){checkbox.checked=false;notice.textContent='التخزين غير متاح بهالمتصفح.';}
  $('[data-luma-forget]').hidden=!checkbox.checked;
 }
 function welcome(){
  bubble('يا هلا فيكي 🌸 أنا لمى، مستشارتك في العناية والجمال هون بـ Trend Shop. احكيلي عن بشرتك أو اللي محتاجاه، وبساعدك خطوة بخطوة.');
  quick.replaceChildren();
  for(const shortcut of lumaShortcuts)action(quick,shortcut.text,()=>startGuide(shortcut));
 }
 function startGuide(shortcut){
  if(activeTurn||photoBusy)return;
  guide=shortcut;pendingQuestion=null;skipped=new Set();
  Object.assign(profile,{area:shortcut.area},shortcut.profile);
  bubble(shortcut.text,'user');
  nextGuideQuestion();
 }
 function nextGuideQuestion(){
  const missing=lumaGuideQuestions.find(item=>!skipped.has(item.field)&&(
   item.field==='goal'&&guide.intent!=='routine'?false:
   !profile[item.field]||profile[item.field]==='unknown'
  ));
  quick.replaceChildren();
  if(!missing){finishGuide();return;}
  guide.field=missing.field;
  bubble(missing.text);
  for(const {label,value} of missing.choices)action(quick,label,()=>chooseGuide(label,value));
  action(quick,'تخطّي هالسؤال',()=>chooseGuide('خلّينا نكمّل',null));
 }
 function chooseGuide(label,value){
  const field=guide.field;
  bubble(label,'user');
  if(value===null)skipped.add(field);
  else profile[field]=value;
  nextGuideQuestion();
 }
 function finishGuide(){
  const selection=guide;guide=null;
  if($('[data-luma-remember]').checked)remember();
  const understood=[skinNames[profile.skinType]&&('بشرتكِ '+skinNames[profile.skinType]),profile.sensitive==='yes'&&'بتتحسس بسهولة',concernNames[profile.goal]].filter(Boolean);
  if(understood.length)bubble('تمام، فهمت عليكِ. رح أبني اختياري على '+understood.join('، ')+'.');
  const request=selection.intent==='routine'?'رتّبي لي روتين صباحي ومسائي حسب تفضيلاتي: '+selection.text:'ساعديني أختار حسب تفضيلاتي: '+selection.text;
  send(request,{guided:true,intent:selection.intent});
 }
 function clearPhoto(){photoSequence++;image=null;photoBusy=false;const preview=$('.luma-image-preview');preview.hidden=true;preview.querySelector('img').removeAttribute('src');$('[data-luma-photo]').value='';refresh()}
 async function preparePhoto(file){
  const sequence=++photoSequence;photoBusy=true;notice.textContent='نجهّز الصورة على جهازكِ…';refresh();
  try{const prepared=await preparePhotoFile(file);if(sequence!==photoSequence)return;image={mimeType:prepared.mimeType,data:prepared.data};$('.luma-image-preview img').src=prepared.dataUrl;$('.luma-image-preview').hidden=false;notice.textContent='الصورة جاهزة؛ اكتبي سؤالكِ واضغطي إرسال.';}
  catch(e){if(sequence===photoSequence){clearPhoto();notice.textContent=e.message||'تعذّر فتح الصورة؛ جرّبي لقطة شاشة.';}}
  finally{if(sequence===photoSequence){photoBusy=false;refresh()}}
 }

 function renderQuestion(question){
  if(question?.field==='budget'||(!question?.text&&!question?.choices?.length))return;
  pendingQuestion=question;
  quick.replaceChildren();if(question.text)bubble(question.text);
  for(const choice of (question.choices||[]).slice(0,5))action(quick,choice.label,()=>{
   if(profileChoices[question.field]?.includes(choice.value))profile[question.field]=choice.value;
   if($('[data-luma-remember]').checked)remember();
   send(choice.label);
  });
 }
 function renderCards(data){if(!Array.isArray(data.routine)||!data.routine.length){if(data.message)bubble(data.message);return}quick.replaceChildren();const group=make('section',undefined,'luma-products');group.setAttribute('aria-label','منتجات لُمى المقترحة');
  for(const p of data.routine.slice(0,3)){if(!/^TS[A-Z0-9-]{4,64}$/.test(p.id)||!Number.isInteger(p.priceFils))continue;const card=make('article',undefined,'luma-product'),photo=make('img');photo.src=p.image;photo.alt=p.name;photo.loading='lazy';const body=make('div'),title=make('h3',p.name),price=make('strong',money(p.priceFils),'luma-price');body.append(title,make('span',p.brand,'luma-brand'),price);if(p.recommendedOption?.label)body.append(make('p','الدرجة الأقرب مبدئيًا: '+p.recommendedOption.label,'luma-shade-hint'));if(p.period)body.append(make('span',({am:'صباحًا',pm:'مساءً',both:'صباحًا ومساءً',makeup:'خطوة مكياج'})[p.period],'luma-period'));if(p.reason)body.append(make('p',p.reason));card.append(photo,body);if(p.howToUse){const guide=make('details');guide.append(make('summary','طريقة الاستخدام'),make('p',p.howToUse));card.append(guide)}const actions=make('div',undefined,'luma-card-actions'),link=make('a','عرض المنتج');link.href=p.href;link.onclick=()=>close();actions.append(link);const add=make('button',p.options?.length?'اختاري الدرجة أو النسخة':'أضيفي للسلة');add.type='button';add.onclick=()=>{const event=new CustomEvent('trend:luma-add',{cancelable:true,detail:{id:p.id,respond:result=>{if(result.needsOptions)close();else if(result.added){add.textContent='أضيفت لسلتكِ ✓';notice.textContent='أضفنا '+p.name+' لسلتكِ.'}else notice.textContent=result.message||'راجعي المنتج قبل الإضافة.'}}});document.dispatchEvent(event);if(!event.defaultPrevented)location.href=p.href};actions.append(add);card.append(actions);group.append(card)}
  const totals=make('p',undefined,'luma-total');totals.append(document.createTextNode('المنتجات '+money(data.subtotalFils)+' · التوصيل '+money(data.shippingFeeFils)+'\n'),make('strong','الإجمالي '+money(data.totalFils)));group.append(totals);
  const next=make('div',undefined,'luma-plan-next');
  action(next,'بديل أرخص',()=>send('إذا متوفر، بدّلي آخر اختيار ببديل أرخص يناسب تفضيلاتي.'));
  action(next,'نبدأ بمنتج واحد',()=>send('من اقتراحاتكِ، بأي منتج واحد أبدأ؟'));
  group.append(next);log.append(group);if(data.area&&data.area!=='unknown')profile.area=data.area;scroll();
 }
 function renderTool(data){if(Number.isInteger(data.confirmedBudgetFils)&&data.confirmedBudgetFils>=500&&data.confirmedBudgetFils<=100000)budgetFils=data.confirmedBudgetFils;if(data.profile){const allowed={area:['face','body','hands','feet','hair','makeup'],skinType:['dry','oily','combination','balanced','unknown'],sensitive:['yes','no','unknown'],ageGroup:['18-24','25-34','35-44','45+'],lifeStage:['neither','pregnant','nursing','prefer-not']};for(const [field,values]of Object.entries(allowed))if(values.includes(data.profile[field]))profile[field]=data.profile[field];if($('[data-luma-remember]').checked)remember()}if(data.type==='profile')return;if(data.type==='followup'){appendTeam(data.team);return}if(data.type==='question')renderQuestion(data.question);else if(data.type==='products')renderCards(data);else if(data.type==='handoff'){quick.replaceChildren();if(data.message)bubble(data.message);appendTeam(data.team)}else if(data.type==='answer'&&data.message)bubble(data.message);else if(data.message)bubble(data.message)}
 function appendTeam(team){const link=make('a',team?.label||'تواصلي مع فريق Trend Shop','luma-team');link.href=team?.href?.startsWith('https://wa.me/962790025430')?team.href:'https://wa.me/962790025430';link.target='_blank';link.rel='noopener noreferrer';log.append(link);scroll()}
 function finishTurn(turn,{keepForRetry=false}={}){
  if(activeTurn!==turn)return;
  activeTurn=undefined;
  failedTurn=keepForRetry?turn:undefined;
  if(keepForRetry)turn.reply?.remove();
  refresh();
 }
 function stopRequest({keepForRetry=false}={}){
  if(activeTurn){
   const turn=activeTurn;
   turn.controller.abort();
   finishTurn(turn,{keepForRetry});
  }
  if(!keepForRetry){failedTurn=undefined;refresh();}
 }
 async function send(value,{retry=false,guided=false,intent}={}){
  if(destroyed||activeTurn||photoBusy)return;
  const text=retry&&failedTurn?failedTurn.text:typeof value==='string'?value:message.value.trim();
  if(!retry&&!text&&!image){message.focus();return;}
  if(!retry&&typeof value!=='string'&&(guide||pendingQuestion)){
   const question=guide?lumaGuideQuestions.find(item=>item.field===guide.field):pendingQuestion;
   const choice=(question?.choices||[]).find(item=>[item.label,item.value].some(label=>normalizeChoice(label)===normalizeChoice(text)));
   if(guide&&choice){message.value='';chooseGuide(choice.label,choice.value);return;}
   if(choice&&profileChoices[question.field]?.includes(choice.value)){
    profile[question.field]=choice.value;
    if($('[data-luma-remember]').checked)remember();
   }
  }
  pendingQuestion=null;
  notice.textContent='';delete notice.dataset.lumaErrorCode;
  pinned=true;
  guide=null;
  const data=retry&&failedTurn?failedTurn.data:{...payload(),message:text,...(guided?{guided:true,intent}:{})};
  const anchor=retry&&failedTurn?.anchor?.isConnected?failedTurn.anchor:guided?log.lastElementChild:bubble(text||'أرفقت صورة مع سؤالي.','user');
  if(retry){while(anchor.nextElementSibling)anchor.nextElementSibling.remove();}
  else if(data.image)anchor.append(make('small','صورة مرفقة لهذه الرسالة فقط'));
  quick.replaceChildren();
  if(!retry&&message.value.trim()===text)message.value='';
  const turn={text,data,anchor,controller:new AbortController(),reply:null};
  activeTurn=turn;
  failedTurn=undefined;
  refresh();
  const signal=turn.controller.signal;
  const timeout=setTimeout(()=>turn.controller.abort(),TURN_TIMEOUT_MS);
  const attempts=[];
  dialog.dataset.lumaProviderTrace='[]';
  delete dialog.dataset.lumaResponseMs;
  let failed=false,answer='',historyNotes='',committed=false,done=false;
  const renderText=text=>{
   answer=text;
   if(!text){turn.reply?.remove();turn.reply=null;return;}
   turn.reply??=bubble('');
   turn.reply.querySelector('p').textContent=answer;
   $('.luma-head p').textContent='لُمى تكتب الآن…';
   scroll();
  };
  const onEvent=(event,data)=>{
   if(activeTurn!==turn)return;
   if(event==='provider'){
    attempts.push({round:data.round,model:data.model,api:data.api,attempt:data.attempt,ok:data.ok,status:data.status||0,reason:data.reason||'',elapsedMs:data.elapsedMs});
    dialog.dataset.lumaProviderTrace=JSON.stringify(attempts.slice(-8));
    dialog.dataset.lumaResponseModel=data.model;
    dialog.dataset.lumaProviderReason=data.reason||'';
    dialog.dataset.lumaTransport=data.transport||'';
    dialog.dataset.lumaProviderStatus=data.ok?'ok':String(data.status||data.reason);
   }else if(event==='replace')renderText(data.text||'');
   else if(event==='delta')renderText(answer+(data.text||''));
   else if(['products','question','handoff','notice','followup','profile'].includes(event)){
    renderTool({...data,type:event});
    if(event==='question'&&data.question?.text){committed=true;historyNotes+=' '+data.question.text;}
    if(event==='products'&&data.routine?.length){committed=true;historyNotes+='\nالمنتجات المقترحة: '+data.routine.map(p=>p.id).join(', ');}
    if(event==='handoff'&&data.message){committed=true;historyNotes+=' '+data.message;}
   }else if(event==='error'){
    failed=true;
    notice.textContent=data.message||'جرّبي مرة ثانية.';
    notice.dataset.lumaErrorCode=String(data.code||'UNKNOWN');
   }else if(event==='done'){
    done=true;
    if(Number.isFinite(data.durationMs))dialog.dataset.lumaResponseMs=String(data.durationMs);
   }
  };
  try{
   const body=JSON.stringify(data);
   for(let attempt=0;attempt<2;attempt++){
    const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body,signal});
    if(!response.ok){
     const error=await response.json().catch(()=>({}));
     throw Error(error.error||'تعذّر إكمال المحادثة الآن.');
    }
    try{await consumeLumaStream(response,onEvent,signal,{idleMs:STREAM_IDLE_MS});break;}
    catch(error){
     if(activeTurn!==turn||signal.aborted||attempt>0||committed||data.image||!['LUMA_STREAM_ENDED','LUMA_STREAM_IDLE'].includes(error.message))throw error;
     renderText('');
     $('.luma-head p').textContent='بنحاول نرجّع الاتصال…';
    }
   }
   if(activeTurn!==turn)return;
   if(!done&&!failed)throw Error('LUMA_STREAM_ENDED');
   if(!failed){
    history=appendLumaHistory(history,text||'سؤال مع صورة اختيارية.',answer+historyNotes);
    clearPhoto();
   }
  }catch(error){
   failed=true;
   if(activeTurn===turn){
    notice.textContent=signal.aborted||error.message?.startsWith('LUMA_STREAM_')
     ?'انقطع الرد قبل ما يكتمل. أعيدي المحاولة أو كمّلي بسؤال جديد.'
     :error.name==='TypeError'?'تأكّدي من الاتصال وجربي مرة ثانية.':error.message||'تعذّر إكمال الرد. جرّبي مرة ثانية.';
   }
  }finally{
   clearTimeout(timeout);
   finishTurn(turn,{keepForRetry:failed});
  }
 }
 function lockPage(){if(locked)return;locked={x:window.scrollX,y:window.scrollY,body:document.body.getAttribute('style'),html:document.documentElement.getAttribute('style')};Object.assign(document.body.style,{position:'fixed',top:-locked.y+'px',left:-locked.x+'px',width:'100%',overflow:'hidden'});document.documentElement.style.overflow='hidden';document.documentElement.style.overscrollBehavior='none'}
 function unlockPage(){if(!locked)return;const saved=locked;locked=null;for(const [el,value]of [[document.body,saved.body],[document.documentElement,saved.html]]){if(value===null)el.removeAttribute('style');else el.setAttribute('style',value)}const behavior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';window.scrollTo({left:saved.x,top:saved.y,behavior:'instant'});document.documentElement.style.scrollBehavior=behavior}
 function close(){if(photoBusy)clearPhoto();if(activeTurn){stopRequest({keepForRetry:true});notice.textContent='بتقدري تكمّلي أو تعيدي إرسال آخر سؤال.';}if(dialog.open)dialog.close();unlockPage();returnFocus?.focus?.({preventScroll:true})}
 function fitViewport(){if(!dialog.open)return;const v=window.visualViewport;const height=v?.height||window.innerHeight,top=v?.offsetTop||0;const next=Math.max(180,Math.min(750,height-16));dialog.style.height=next+'px';dialog.style.maxHeight=next+'px';dialog.style.top=(top+Math.max(8,height-next-8))+'px';dialog.style.bottom='auto'}
 let viewportFrame=0;const scheduleFit=()=>{cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(fitViewport)};
 listen(window.visualViewport,'resize',scheduleFit);listen(window.visualViewport,'scroll',scheduleFit);listen(window,'resize',scheduleFit);
 function open(){if(destroyed)return;returnFocus=document.activeElement;if(!dialog.open){lockPage();dialog.showModal()}fitViewport();$('[data-luma-close]').focus({preventScroll:true});refresh();scroll()}
 $('[data-luma-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close()});dialog.addEventListener('close',()=>{if(!dialog.open){if(activeTurn)stopRequest({keepForRetry:true});unlockPage();}});
 form.onsubmit=event=>{event.preventDefault();send()};message.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send()}});
 $('[data-luma-photo]').onchange=()=>{const file=$('[data-luma-photo]').files[0];if(file)preparePhoto(file)};$('[data-luma-remove-photo]').onclick=clearPhoto;
 $('[data-luma-stop]').onclick=()=>{stopRequest({keepForRetry:true});notice.textContent='أوقفنا الرد. تقدري تعيدي المحاولة أو تكمّلي بسؤال جديد.'};
 $('[data-luma-retry]').onclick=()=>{if(failedTurn)send(undefined,{retry:true});};
 $('[data-luma-remember]').checked=remembered.remember;
 $('[data-luma-forget]').hidden=!remembered.remember;
 $('[data-luma-remember]').onchange=remember;
 $('[data-luma-forget]').onclick=()=>{$('[data-luma-remember]').checked=false;profile={area:'unknown',skinType:'unknown',sensitive:'unknown'};budgetFils=null;remember();notice.textContent='انمسحت تفضيلاتكِ من هالجهاز.';};
 $('[data-luma-reset]').onclick=()=>{stopRequest();history=[];guide=null;pendingQuestion=null;profile=baseProfile();budgetFils=savedLumaProfile(storage).budgetFils;clearPhoto();message.value='';notice.textContent='';log.replaceChildren();welcome();refresh()};
 const cleanup=()=>{close();stopRequest();history=[];photoSequence++;image=null;message.value='';$('.luma-image-preview img').removeAttribute('src');log.replaceChildren()};listen(window,'pagehide',cleanup);listen(window,'pageshow',event=>{if(event.persisted&&!log.children.length){welcome();refresh()}});
 function destroy(){if(destroyed)return;destroyed=true;cleanup();for(const remove of removers)remove();cancelAnimationFrame(viewportFrame);cancelAnimationFrame(scrollFrame);dialog.remove();if(instance?.dialog===dialog)instance=undefined}
 welcome();refresh();instance={open,close,destroy,dialog};if(standalone)open();return instance;
}
if(document.querySelector('[data-luma-standalone]'))mountLumaWidget({standalone:true}).catch(error=>{const el=document.querySelector('[data-luma-standalone]');el.textContent=error.message});
