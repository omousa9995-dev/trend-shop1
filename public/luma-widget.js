import {consumeLumaStream,appendLumaHistory} from './luma-stream.js?v=5.20.0';
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const money=n=>(n/1000).toLocaleString('ar-JO',{minimumFractionDigits:2,maximumFractionDigits:2})+' د.أ';
let instance;
export async function mountLumaWidget({status:initial,standalone=false}={}){
 if(instance)return instance;
 const status=initial||await fetch('/api/care/status',{cache:'no-store'}).then(r=>r.json());
 if(!status.available)throw Error('لُمى غير متاحة حاليًا. تقدري تتواصلي مع المتجر.');
 if(!document.querySelector('[data-luma-styles]')){const css=make('link');css.rel='stylesheet';css.href='/luma-widget.css?v=5.20.0';css.dataset.lumaStyles='1';document.head.append(css)}
 const dialog=make('dialog',undefined,'luma-chat');dialog.id='lumaChat';dialog.dir='rtl';dialog.lang='ar';dialog.setAttribute('aria-labelledby','lumaChatTitle');
 dialog.innerHTML=`<header class="luma-head"><span class="luma-avatar" aria-hidden="true"><img src="/images/editorial/beauty-hero-v2.webp" alt=""/></span><div><h2 id="lumaChatTitle">لُمى <span lang="en">Luma</span></h2><p>معكِ للعناية والجمال</p></div><button type="button" data-luma-close aria-label="إغلاق محادثة لُمى">×</button></header>
 <div class="luma-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="محادثتكِ مع لُمى" tabindex="0"></div>
 <div class="luma-notice" role="status" aria-live="polite"></div>
 <div class="luma-quick" aria-label="اختيارات سريعة"></div>
 <form class="luma-composer">
 <div class="luma-image-preview" hidden><img alt="معاينة الصورة على جهازكِ"/><button type="button" data-luma-remove-photo>إزالة الصورة</button><p>صورة اختيارية تُرسل مع سؤالكِ لفهم ما يظهر فيها. تجنّبي أي معلومات شخصية أو مناطق خاصة.</p></div>
 <label class="luma-input-label" for="lumaMessage">احكيلي شو محتاجة</label><div class="luma-input-row"><textarea id="lumaMessage" rows="2" maxlength="1500" placeholder="سؤالكِ، روتينكِ أو اختيارات مكياجكِ…"></textarea><button class="luma-send" type="submit" aria-label="إرسال إلى لُمى">←</button></div>
 <div class="luma-actions"><label class="luma-photo-button">＋ صورة<input type="file" accept="image/*,.heic,.heif" data-luma-photo aria-label="إرفاق صورة اختيارية"/></label><button type="button" data-luma-stop hidden>إيقاف الرد</button><button type="button" data-luma-retry hidden>إعادة المحاولة</button><button type="button" data-luma-reset>محادثة جديدة</button></div></form>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),log=$('.luma-log'),quick=$('.luma-quick'),notice=$('.luma-notice'),form=$('form'),message=$('#lumaMessage');
 const removers=[];const listen=(target,event,fn)=>{target?.addEventListener(event,fn);removers.push(()=>target?.removeEventListener(event,fn))};let destroyed=false;
 let busy=false,controller,requestSequence=0,lastFailedText=null,history=[],profile={area:'unknown',skinType:'unknown',sensitive:'unknown'},budgetFils=null,image=null,photoBusy=false,photoSequence=0,returnFocus,scrollFrame=0,pinned=true,locked=null;
 function scroll(force=false){if(!force&&!pinned)return;cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight})}
 log.addEventListener('scroll',()=>{pinned=log.scrollHeight-log.scrollTop-log.clientHeight<65},{passive:true});
 function bubble(text,side='model'){const item=make('article',undefined,'luma-bubble luma-'+side);item.append(make('span',side==='user'?'أنتِ':'لُمى','luma-speaker'),make('p',text));log.append(item);while(log.children.length>48)log.firstElementChild.remove();scroll();return item}
 function refresh(){
  $('.luma-send').disabled=busy||photoBusy;for(const b of quick.querySelectorAll('button'))b.disabled=busy||photoBusy;
  $('[data-luma-photo]').disabled=busy;$('.luma-photo-button').hidden=!status.imagesAvailable;
  $('[data-luma-stop]').hidden=!busy;$('[data-luma-retry]').hidden=busy||lastFailedText===null;
  $('.luma-head p').textContent=busy?'لُمى بتحضّر إجابتكِ…':'معكِ للعناية والجمال';dialog.setAttribute('aria-busy',String(busy));
 }
 function payload(){let existingIds=[];try{existingIds=JSON.parse(localStorage.getItem('trend-shop-cart-v1')||'[]').map(x=>x.id).filter(x=>typeof x==='string'&&/^TS[A-Z0-9-]{4,64}$/.test(x)).slice(0,20)}catch{}return {message:message.value.trim(),history,budgetFils,includeDelivery:true,profile,existingIds,...(image?{image}:{})}}
 function welcome(){bubble('يا هلا فيكي ♡ شو بتحبّي أساعدكِ اليوم؟');quick.replaceChildren();for(const text of ['روتين لبشرتي','حبوب الوجه أو الظهر','جفاف اليدين والكعب','اختيار المكياج']){const button=make('button',text);button.type='button';button.onclick=()=>send(text);quick.append(button)}}
 function clearPhoto(){photoSequence++;image=null;photoBusy=false;const preview=$('.luma-image-preview');preview.hidden=true;preview.querySelector('img').removeAttribute('src');$('[data-luma-photo]').value='';refresh()}
 async function preparePhoto(file){const sequence=++photoSequence;photoBusy=true;notice.textContent='نجهّز الصورة على جهازكِ…';refresh();try{if(file.size>15*1024*1024||!/^image\//.test(file.type)&&!/(heic|heif)$/i.test(file.name))throw Error('اختاري صورة بحجم أقل من 15 ميغابايت.');const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode()}finally{URL.revokeObjectURL(url)}if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>70000000)throw Error('تعذّر فتح الصورة. جرّبي JPG أو لقطة شاشة.');const scale=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78);if(data.length>1400000)throw Error('جرّبي صورة أصغر.');if(sequence!==photoSequence)return;image={mimeType:'image/jpeg',data:data.split(',')[1]};$('.luma-image-preview img').src=data;$('.luma-image-preview').hidden=false;notice.textContent='الصورة جاهزة؛ اضغطي إرسال لمشاركتها مع سؤالكِ.'}catch(e){if(sequence===photoSequence){clearPhoto();notice.textContent=e.message||'تعذّر فتح الصورة؛ جرّبي JPG أو لقطة شاشة.'}}finally{if(sequence===photoSequence){photoBusy=false;refresh()}}}
 function renderQuestion(q){if(q?.field==='budget'||!q?.text&&!q?.choices?.length)return;quick.replaceChildren();if(q.text)bubble(q.text);for(const choice of (q.choices||[]).slice(0,5)){const button=make('button',choice.label);button.type='button';button.disabled=busy||photoBusy;button.onclick=()=>{if(['area','skinType','sensitive','ageGroup','lifeStage'].includes(q.field))profile[q.field]=choice.value;send((q.text||'اختياري:')+' '+choice.label)};quick.append(button)}}
 function renderCards(data){if(!Array.isArray(data.routine)||!data.routine.length){if(data.message)bubble(data.message);return}quick.replaceChildren();const group=make('section',undefined,'luma-products');group.setAttribute('aria-label','منتجات لُمى المقترحة');
  for(const p of data.routine.slice(0,6)){if(!/^TS[A-Z0-9-]{4,64}$/.test(p.id)||!Number.isInteger(p.priceFils))continue;const card=make('article',undefined,'luma-product'),photo=make('img');photo.src=p.image;photo.alt=p.name;photo.loading='lazy';const body=make('div'),title=make('h3',p.name),price=make('strong',money(p.priceFils),'luma-price');body.append(title,make('span',p.brand,'luma-brand'),price);if(p.period)body.append(make('span',({am:'صباحًا',pm:'مساءً',both:'صباحًا ومساءً',makeup:'خطوة مكياج'})[p.period],'luma-period'));if(p.reason)body.append(make('p',p.reason));card.append(photo,body);if(p.howToUse){const guide=make('details');guide.append(make('summary','طريقة الاستخدام'),make('p',p.howToUse));card.append(guide)}const actions=make('div',undefined,'luma-card-actions'),link=make('a','عرض المنتج');link.href=p.href;link.onclick=()=>close();actions.append(link);const add=make('button',p.options?.length?'اختاري الدرجة أو النسخة':'أضيفي للسلة');add.type='button';add.onclick=()=>{const event=new CustomEvent('trend:luma-add',{cancelable:true,detail:{id:p.id,respond:result=>{if(result.needsOptions)close();else if(result.added){add.textContent='أضيفت لسلتكِ ✓';notice.textContent='أضفنا '+p.name+' لسلتكِ.'}else notice.textContent=result.message||'راجعي المنتج قبل الإضافة.'}}});document.dispatchEvent(event);if(!event.defaultPrevented)location.href=p.href};actions.append(add);card.append(actions);group.append(card)}
  const totals=make('p',undefined,'luma-total');totals.append(document.createTextNode('المنتجات '+money(data.subtotalFils)+' · التوصيل '+money(data.shippingFeeFils)+'\n'),make('strong','الإجمالي '+money(data.totalFils)));group.append(totals);log.append(group);if(data.area&&data.area!=='unknown')profile.area=data.area;scroll();
 }
 function renderTool(data){if(Number.isInteger(data.confirmedBudgetFils)&&data.confirmedBudgetFils>=500&&data.confirmedBudgetFils<=100000)budgetFils=data.confirmedBudgetFils;if(data.profile){const allowed={area:['face','body','hands','feet','hair','makeup'],skinType:['dry','oily','combination','balanced','unknown'],sensitive:['yes','no','unknown'],ageGroup:['18-24','25-34','35-44','45+'],lifeStage:['neither','pregnant','nursing','prefer-not']};for(const [field,values]of Object.entries(allowed))if(values.includes(data.profile[field]))profile[field]=data.profile[field]}if(data.type==='profile')return;if(data.type==='followup'){appendTeam(data.team);return}if(data.type==='question')renderQuestion(data.question);else if(data.type==='products')renderCards(data);else if(data.type==='handoff'){quick.replaceChildren();if(data.message)bubble(data.message);appendTeam(data.team)}else if(data.type==='answer'&&data.message)bubble(data.message);else if(data.message)bubble(data.message)}
 function appendTeam(team){const link=make('a',team?.label||'تواصلي مع صيدلانيات Trend Shop','luma-team');link.href=team?.href?.startsWith('https://wa.me/962790025430')?team.href:'https://wa.me/962790025430';link.target='_blank';link.rel='noopener noreferrer';log.append(link);scroll()}
 function stopRequest({retry=false}={}){requestSequence++;controller?.abort();controller=null;busy=false;if(!retry)lastFailedText=null;refresh()}
 async function send(value){
  if(destroyed||busy||photoBusy)return;notice.textContent='';delete notice.dataset.lumaErrorCode;
  const text=typeof value==='string'?value:message.value.trim();if(!text&&!image){message.focus();return}pinned=true;
  const data={...payload(),message:text},user=bubble(text||'أرفقت صورة مع سؤالي.','user');if(image)user.append(make('small','صورة مرفقة لهذه الرسالة فقط'));
  quick.replaceChildren();if(message.value.trim()===text)message.value='';busy=true;lastFailedText=text;
  const sequence=++requestSequence,requestController=new AbortController();controller=requestController;refresh();
  const timeout=setTimeout(()=>requestController.abort(),45000);let answer='',reply,failed=false,done=false;const attempts=[];dialog.dataset.lumaProviderTrace='[]';
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body:JSON.stringify(data),signal:requestController.signal});
   if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'تعذّر إكمال المحادثة الآن.')}
   await consumeLumaStream(response,(event,data)=>{
    if(sequence!==requestSequence)return;
    if(event==='provider'){attempts.push({round:data.round,model:data.model,api:data.api,attempt:data.attempt,ok:data.ok,status:data.status||0,reason:data.reason||'',elapsedMs:data.elapsedMs});dialog.dataset.lumaProviderTrace=JSON.stringify(attempts.slice(-8));dialog.dataset.lumaResponseModel=data.model;dialog.dataset.lumaProviderReason=data.reason||'';dialog.dataset.lumaTransport=data.transport||'';dialog.dataset.lumaProviderStatus=data.ok?'ok':String(data.status||data.reason)}
    else if(event==='delta'){if(!reply)reply=bubble('');answer+=data.text||'';reply.querySelector('p').textContent=answer;scroll()}
    else if(['products','question','handoff','notice','followup','profile'].includes(event)){renderTool({...data,type:event});if(event==='question')answer+=' '+data.question.text;if(event==='products')answer+='\nالمنتجات المقترحة: '+(data.routine||[]).map(p=>p.id).join(', ');if(event==='handoff')answer+=' '+data.message}
    else if(event==='error'){failed=true;if(reply)reply.querySelector('p').textContent='ما اكتمل الرد. تقدري تعيدي المحاولة.';notice.textContent=data.message||'جرّبي مرة ثانية.';notice.dataset.lumaErrorCode=String(data.code||'UNKNOWN')}
    else if(event==='done'){done=true;if(Number.isFinite(data.durationMs))dialog.dataset.lumaResponseMs=String(data.durationMs)}
   },requestController.signal);
   if(sequence!==requestSequence)return;
   if(!done&&!failed)throw Error('انقطع الاتصال قبل اكتمال الإجابة.');
   if(!failed){history=appendLumaHistory(history,text||'سؤال مع صورة اختيارية.',answer);lastFailedText=null;clearPhoto()}
  }catch(error){if(sequence===requestSequence)notice.textContent=error.name==='AbortError'?'تأخر الرد. اضغطي إعادة المحاولة أو اكتبي سؤالكِ من جديد.':error.message}
  finally{clearTimeout(timeout);if(sequence===requestSequence){busy=false;controller=null;refresh()}}
 }
 function lockPage(){if(locked)return;locked={x:window.scrollX,y:window.scrollY,body:document.body.getAttribute('style'),html:document.documentElement.getAttribute('style')};Object.assign(document.body.style,{position:'fixed',top:-locked.y+'px',left:-locked.x+'px',width:'100%',overflow:'hidden'});document.documentElement.style.overflow='hidden';document.documentElement.style.overscrollBehavior='none'}
 function unlockPage(){if(!locked)return;const saved=locked;locked=null;for(const [el,value]of [[document.body,saved.body],[document.documentElement,saved.html]]){if(value===null)el.removeAttribute('style');else el.setAttribute('style',value)}const behavior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';window.scrollTo({left:saved.x,top:saved.y,behavior:'instant'});document.documentElement.style.scrollBehavior=behavior}
 function close(){stopRequest();if(dialog.open)dialog.close();unlockPage();returnFocus?.focus?.({preventScroll:true})}
 function fitViewport(){if(!dialog.open)return;const v=window.visualViewport;const height=v?.height||window.innerHeight,top=v?.offsetTop||0;const next=Math.max(180,Math.min(750,height-16));dialog.style.height=next+'px';dialog.style.maxHeight=next+'px';dialog.style.top=(top+Math.max(8,height-next-8))+'px';dialog.style.bottom='auto'}
 let viewportFrame=0;const scheduleFit=()=>{cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(fitViewport)};
 listen(window.visualViewport,'resize',scheduleFit);listen(window.visualViewport,'scroll',scheduleFit);listen(window,'resize',scheduleFit);
 function open(){if(destroyed)return;returnFocus=document.activeElement;if(!dialog.open){lockPage();dialog.showModal()}fitViewport();$('[data-luma-close]').focus({preventScroll:true});refresh();scroll()}
 $('[data-luma-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close()});dialog.addEventListener('close',()=>{stopRequest();unlockPage()});
 form.onsubmit=event=>{event.preventDefault();send()};message.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send()}});
 $('[data-luma-photo]').onchange=()=>{const file=$('[data-luma-photo]').files[0];if(file)preparePhoto(file)};$('[data-luma-remove-photo]').onclick=clearPhoto;
 $('[data-luma-stop]').onclick=()=>{stopRequest({retry:true});notice.textContent='أوقفنا الرد. تقدري تعيدي المحاولة أو تكمّلي بسؤال جديد.'};
 $('[data-luma-retry]').onclick=()=>{if(lastFailedText!==null)send(lastFailedText)};
 $('[data-luma-reset]').onclick=()=>{stopRequest();history=[];profile={area:'unknown',skinType:'unknown',sensitive:'unknown'};budgetFils=null;clearPhoto();message.value='';notice.textContent='';log.replaceChildren();welcome();refresh()};
 const cleanup=()=>{close();history=[];photoSequence++;image=null;message.value='';$('.luma-image-preview img').removeAttribute('src');log.replaceChildren()};listen(window,'pagehide',cleanup);listen(window,'pageshow',event=>{if(event.persisted&&!log.children.length){welcome();refresh()}});
 function destroy(){if(destroyed)return;destroyed=true;cleanup();for(const remove of removers)remove();cancelAnimationFrame(viewportFrame);cancelAnimationFrame(scrollFrame);dialog.remove();if(instance?.dialog===dialog)instance=undefined}
 welcome();refresh();instance={open,close,destroy,dialog};if(standalone)open();return instance;
}
if(document.querySelector('[data-luma-standalone]'))mountLumaWidget({standalone:true}).catch(error=>{const el=document.querySelector('[data-luma-standalone]');el.textContent=error.message});
