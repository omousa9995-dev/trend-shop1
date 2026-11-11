const $=s=>document.querySelector(s),make=(tag,value,className)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(className)el.className=className;return el};
const money=n=>(n/1000).toFixed(2)+' د.أ',normalDigits=x=>String(x).replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace('٫','.');
const areaLabels={face:'الوجه',body:'الجسم',hands:'اليدان',feet:'القدمان',hair:'الشعر',makeup:'المكياج'};
const fieldset=$('#careControls'),form=$('#careForm'),conversation=$('#careConversation'),welcome=conversation.innerHTML;
let status=null,image=null,photoBusy=false,busy=false,history=[],photoSequence=0,controller;
function stage(value){for(const el of document.querySelectorAll('[data-care-stage]')){if(el.dataset.careStage===value)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')}}
function refresh(){fieldset.disabled=busy||!status?.available;$('#careSubmit').disabled=busy||photoBusy||!status?.available;$('#careSubmit').textContent=busy?'لُمى بترتّب اختياراتكِ…':'احكي مع لُمى ←';$('#careReset').disabled=busy;$('#careThinking').hidden=!busy;for(const b of conversation.querySelectorAll('[data-care-choice]'))b.disabled=busy||!status?.available||b.dataset.active!=='1'}
function clearPhoto(){photoSequence++;image=null;photoBusy=false;$('#carePhoto').value='';$('#carePhotoConsent').checked=false;$('#carePhotoConsentRow').hidden=true;$('#carePhotoImage').removeAttribute('src');$('#carePhotoPreview').hidden=true;$('#carePhotoStatus').textContent='';refresh()}
$('#careRemovePhoto').onclick=clearPhoto;
async function preparePhoto(file){
 const sequence=++photoSequence;image=null;photoBusy=true;$('#carePhotoStatus').textContent='نجهّز الصورة على جهازكِ…';$('#carePhotoConsent').checked=false;$('#carePhotoConsentRow').hidden=true;refresh();
 try{
  if(file.size>15*1024*1024||!/^image\//.test(file.type)&&!/(?:heic|heif)$/i.test(file.name))throw Error('اختاري صورة بحجم أقل من 15 ميغابايت.');
  const url=URL.createObjectURL(file);let img;
  try{img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>70000000)throw Error()}catch{throw Error('تعذّر فتح الصورة في هذا المتصفح. جرّبي JPG أو لقطة شاشة للصورة.')}finally{URL.revokeObjectURL(url)}
  const ratio=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  // Pixel-only JPEG: original filename, EXIF and GPS metadata are not transmitted.
  const dataUrl=canvas.toDataURL('image/jpeg',.78);if(dataUrl.length>1400000)throw Error('الصورة كبيرة بعد التجهيز. جرّبي صورة أصغر.');if(sequence!==photoSequence)return;
  image={mimeType:'image/jpeg',data:dataUrl.split(',')[1]};$('#carePhotoImage').src=dataUrl;$('#carePhotoPreview').hidden=false;$('#carePhotoConsentRow').hidden=false;$('#carePhotoStatus').textContent='الصورة جاهزة على جهازكِ؛ تُرسل مع رسالتكِ بعد موافقتكِ أدناه.';
 }catch(e){if(sequence!==photoSequence)return;$('#carePhotoStatus').textContent=e.message;$('#carePhotoPreview').hidden=true;$('#carePhotoImage').removeAttribute('src');$('#carePhoto').value=''}finally{if(sequence===photoSequence){photoBusy=false;refresh()}}
}
$('#carePhoto').onchange=()=>{const file=$('#carePhoto').files[0];if(file)preparePhoto(file);else clearPhoto()};
function existingProducts(){try{return ($('#careCart').checked?JSON.parse(localStorage.getItem('trend-shop-cart-v1')||'[]'):[]).map(x=>x.id).slice(0,20)}catch{return []}}
function addList(parent,title,items){if(!Array.isArray(items)||!items.length)return;parent.append(make('h3',title));const ul=make('ul');for(const item of items)ul.append(make('li',item));parent.append(ul)}
function answerChoice(question,choice){
 if(busy||!status?.available)return;
 const fields={area:'#careArea',skinType:'#careSkin',sensitive:'#careSensitive'};
 if(question.field==='budget')$('#careBudget').value=String(Number(choice.value)/1000);
 else if(fields[question.field])$(fields[question.field]).value=choice.value;
 const draft=$('#careMessage').value.trim();$('#careMessage').value=(question.text+' '+choice.label+(draft?'\n'+draft:'')).slice(0,1500);form.requestSubmit();
}
function renderReply(data){
 for(const old of conversation.querySelectorAll('[data-care-choice]')){old.dataset.active='0';old.disabled=true}
 const reply=make('article',undefined,'care-reply');reply.append(make('span','لُمى','care-speaker'),make('p',data.message));addList(reply,'من الصورة، بشكل مبدئي',data.observations);
 if(data.area&&areaLabels[data.area]){$('#careArea').value=data.area;reply.append(make('p','منطقة العناية: '+areaLabels[data.area]+' · تقدري تغيّري التفضيلات بأي وقت.','care-context'))}
 for(const q of data.questions||[]){const block=make('div',undefined,'care-question');block.append(make('p',typeof q==='string'?q:q.text));if(q&&typeof q==='object'&&q.choices?.length){const choices=make('div',undefined,'care-choices');for(const choice of q.choices){const button=make('button',choice.label);button.type='button';button.dataset.careChoice='1';button.dataset.active='1';button.onclick=()=>answerChoice(q,choice);choices.append(button)}block.append(choices)}reply.append(block)}
 if(data.routine?.length){reply.append(make('h3','خطواتكِ من المتوفر الآن'));
  data.routine.forEach((p,i)=>{const card=make('article',undefined,'care-product'),img=make('img');img.src=p.image;img.alt=p.name;img.loading='lazy';const detail=make('div');detail.append(make('span','الخطوة '+(i+1),'care-step'),make('h4',p.name),make('p',[p.brand,p.size].filter(Boolean).join(' · ')),make('p',money(p.priceFils),'care-price'));if(p.reason)detail.append(make('p',p.reason));else if(p.benefits?.[0])detail.append(make('p',p.benefits[0]));if(p.howToUse){const guide=make('details');guide.append(make('summary','تعليمات استخدام المنتج'),make('p',p.howToUse));detail.append(guide)}const link=make('a','شوفي التفاصيل وأضيفيه للسلة ↗');link.href=p.href;link.target='_blank';link.rel='noopener noreferrer';card.append(img,detail,link);reply.append(card)});
  const total=make('div',undefined,'care-total');total.append(make('p','مجموع المنتجات: '+money(data.subtotalFils)),make('p','التوصيل: '+money(data.shippingFeeFils)),make('strong','الإجمالي: '+money(data.totalFils)));if(!$('#careDelivery').checked)total.append(make('p','ميزانيتكِ المختارة للمنتجات؛ التوصيل يُضاف للإجمالي.'));reply.append(total);
 }
 if(data.guidanceNote)reply.append(make('p',data.guidanceNote,'care-small'));
 conversation.append(reply);while(conversation.children.length>18)conversation.firstElementChild.remove();stage(data.routine?.length?'recommend':'clarify');$('#careResultsTitle').textContent=data.routine?.length?'اختياراتكِ مع لُمى':'خلّينا نوضّح التفاصيل';$('#careResultsTitle').focus({preventScroll:true});reply.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
}
form.onsubmit=async event=>{
 event.preventDefault();if(busy||photoBusy||!status?.available)return;$('#careError').textContent='';
 const message=$('#careMessage').value.trim();if(!message&&!image){$('#careError').textContent='احكيلي شو محتاجة، أو أرفقي صورة مع سؤالكِ.';$('#careMessage').focus();return}
 if(!$('#careAdult').checked||!$('#careGoogleConsent').checked){$('#careConsentDetails').open=true;$('#careError').textContent='قبل أول رسالة، أكّدي العمر والموافقة على معالجة المحادثة.';return}
 const budgetText=normalDigits($('#careBudget').value.trim()),jod=budgetText?Number(budgetText):null,budgetFils=jod===null?null:Math.round(jod*1000);
 if(jod!==null&&(!Number.isFinite(jod)||jod<.5||jod>100)){$('#carePreferences').open=true;$('#careError').textContent='اكتبي ميزانية بين نصف دينار و100 دينار، أو اتركيها فارغة لنحددها معًا.';$('#careBudget').focus();return}
 if(image&&!$('#carePhotoConsent').checked){$('#careError').textContent='وافقي على إرسال الصورة أو أزيليها للمتابعة دونها.';$('#carePhotoConsent').focus();return}
 const payload={budgetFils,includeDelivery:$('#careDelivery').checked,message,profile:{area:$('#careArea').value,skinType:$('#careSkin').value,sensitive:$('#careSensitive').value,warningSigns:$('#careWarnings').checked},adultConfirmed:true,googleConsent:true,consentVersion:status.consentVersion,existingIds:existingProducts(),history,...(image?{image,photoConsent:true}:{})};
 const pending=make('article',undefined,'care-user');pending.append(make('span','أنتِ','care-speaker'),make('p',message||'أرفقتُ صورة وأحتاج مساعدتكِ في اختيار المنتجات.'));if(image)pending.append(make('small','صورة مرفقة لهذه الرسالة فقط'));conversation.append(pending);
 busy=true;refresh();conversation.setAttribute('aria-busy','true');controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),42000);
 try{const response=await fetch('/api/care/chat',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'تعذّر إكمال المحادثة الآن.');renderReply(data);const questions=(data.questions||[]).map(q=>typeof q==='string'?q:q.text).join(' ');history=[...history,{role:'user',text:message||'صورة لمنطقة العناية.'},{role:'model',text:(data.message+' '+(data.observations||[]).join(' ')+' '+questions+' '+(data.routine||[]).map(p=>p.id).join(' ')).slice(0,1500)}].slice(-6);$('#careMessage').value='';$('#careConsentDetails').open=false;$('#careForm .care-starts').hidden=true;clearPhoto()}
 catch(e){pending.remove();$('#careError').textContent=e.name==='AbortError'?'تأخرت الإجابة شوي. تقدري تعيدي إرسال رسالتكِ بعد قليل.':e.message;$('#careError').scrollIntoView({block:'nearest'})}
 finally{clearTimeout(timeout);busy=false;controller=null;conversation.removeAttribute('aria-busy');refresh()}
};
for(const button of document.querySelectorAll('[data-care-start]'))button.onclick=()=>{$('#careMessage').value=button.dataset.careStart;$('#careMessage').focus()};
$('#careReset').onclick=()=>{if(busy)return;history=[];clearPhoto();form.reset();conversation.innerHTML=welcome;$('#careForm .care-starts').hidden=false;$('#careConsentDetails').open=true;$('#careError').textContent='';$('#careResultsTitle').textContent='نبدأ من كلامكِ';stage('start');$('#careMessage').focus()};
window.addEventListener('pagehide',()=>{controller?.abort();photoSequence++;image=null;history=[];$('#carePhotoImage').removeAttribute('src');$('#carePhoto').value='';$('#careMessage').value='';conversation.innerHTML=welcome});
fetch('/api/care/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{status=data;$('#careAvailability').hidden=data.available;$('#careAvailability').textContent=data.available?'':'لُمى غير متاحة حاليًا. تقدري تتابعي التسوق من رابط المتجر أعلاه.';$('#carePhotoSection').hidden=!data.imagesAvailable;refresh()}).catch(()=>{$('#careAvailability').textContent='تعذّر فتح المحادثة الآن. تقدري تتابعي التسوق كالمعتاد.';refresh()});
