const $=s=>document.querySelector(s);
const money=n=>(n/1000).toFixed(2)+' د.أ';
const normalDigits=x=>String(x).replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace('٫','.');
let status=null,image=null,photoBusy=false,busy=false,history=[],photoSequence=0,controller;
const fieldset=$('#careControls'),form=$('#careForm'),conversation=$('#careConversation');
const make=(tag,value,className)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(className)el.className=className;return el};
function refresh(){fieldset.disabled=busy||!status?.available;$('#careSubmit').disabled=busy||photoBusy||!status?.available;$('#careSubmit').textContent=busy?'نراجع اختياراتكِ…':'اكتشفي اختياراتكِ ✦';$('#careReset').disabled=busy;}
function clearPhoto(){photoSequence++;image=null;photoBusy=false;$('#carePhoto').value='';$('#carePhotoConsent').checked=false;$('#carePhotoImage').removeAttribute('src');$('#carePhotoPreview').hidden=true;$('#carePhotoStatus').textContent='';refresh();}
$('#careRemovePhoto').onclick=clearPhoto;
async function preparePhoto(file){
 const sequence=++photoSequence;image=null;photoBusy=true;$('#carePhotoStatus').textContent='نجهّز الصورة على جهازكِ…';refresh();
 try{
  if(file.size>15*1024*1024||!/^image\//.test(file.type)&&!/(?:heic|heif)$/i.test(file.name))throw Error('اختاري صورة بحجم أقل من 15 ميغابايت.');
  const url=URL.createObjectURL(file);let img;
  try{img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>70000000)throw Error();}catch{throw Error('تعذّر فتح الصورة في هذا المتصفح. جرّبي JPG أو لقطة شاشة للصورة.')}finally{URL.revokeObjectURL(url)}
  const ratio=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  // Canvas re-encodes pixels only: no original EXIF, GPS, name or file metadata is sent.
  const dataUrl=canvas.toDataURL('image/jpeg',.78);if(dataUrl.length>1400000)throw Error('الصورة كبيرة جدًا بعد التجهيز. جرّبي صورة أصغر.');
  if(sequence!==photoSequence)return;image={mimeType:'image/jpeg',data:dataUrl.split(',')[1]};$('#carePhotoImage').src=dataUrl;$('#carePhotoPreview').hidden=false;$('#carePhotoStatus').textContent='الصورة جاهزة محليًا؛ تُرسل فقط عند الضغط على زر الاقتراح مع موافقتكِ.';
 }catch(e){if(sequence!==photoSequence)return;$('#carePhotoStatus').textContent=e.message;$('#carePhotoPreview').hidden=true;$('#carePhotoImage').removeAttribute('src');$('#carePhoto').value='';}
 finally{if(sequence===photoSequence){photoBusy=false;refresh()}}
}
$('#carePhoto').onchange=()=>{const file=$('#carePhoto').files[0];if(file)preparePhoto(file);else clearPhoto()};
function existingProducts(){try{return ($('#careCart').checked?JSON.parse(localStorage.getItem('trend-shop-cart-v1')||'[]'):[]).map(x=>x.id).slice(0,20)}catch{return []}}
function addList(parent,title,items){if(!items?.length)return;parent.append(make('h3',title));const ul=make('ul');for(const item of items)ul.append(make('li',item));parent.append(ul)}
function renderReply(data){
 if(conversation.querySelector('.care-empty'))conversation.replaceChildren();
 const reply=make('article',undefined,'care-reply');reply.append(make('p',data.message));addList(reply,'ملاحظات من الصورة — غير تشخيصية',data.observations);addList(reply,'لأفهم تفضيلاتكِ أكثر',data.questions);
 if(data.routine?.length){reply.append(make('h3','اختيارات من المتوفر الآن'));
  for(const p of data.routine){const card=make('article',undefined,'care-product'),img=make('img');img.src=p.image;img.alt=p.name;img.loading='lazy';const detail=make('div');detail.append(make('h4',p.name),make('p',[p.brand,p.size].filter(Boolean).join(' · ')),make('p',money(p.priceFils),'care-price'));if(p.benefits?.[0])detail.append(make('p',p.benefits[0]));const link=make('a','تفاصيل المنتج وإضافته للسلة ←');link.href=p.href;card.append(img,detail,link);if(p.howToUse){const guide=make('details');guide.append(make('summary','طريقة الاستخدام على صفحة المنتج'),make('p',p.howToUse));detail.append(guide)}reply.append(card)}
  const total=make('div',undefined,'care-total');total.append(make('p','مجموع المنتجات: '+money(data.subtotalFils)),make('p','التوصيل: '+money(data.shippingFeeFils)),make('strong','الإجمالي: '+money(data.totalFils)));reply.append(total);
 }
 conversation.append(reply);$('#careResultsTitle').focus({preventScroll:true});reply.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
form.onsubmit=async event=>{
 event.preventDefault();if(busy||photoBusy||!status?.available)return;$('#careError').textContent='';
 const jod=Number(normalDigits($('#careBudget').value)),budgetFils=Math.round(jod*1000);
 if(!Number.isFinite(jod)||jod<.5||jod>100){$('#careError').textContent='اكتبي ميزانية بين نصف دينار و100 دينار.';$('#careBudget').focus();return}
 if(image&&!$('#carePhotoConsent').checked){$('#careError').textContent='وافقي على إرسال الصورة أو أزيليها للمتابعة دون صورة.';$('#carePhotoConsent').focus();return}
 const message=$('#careMessage').value.trim(),payload={budgetFils,includeDelivery:$('#careDelivery').checked,message,profile:{skinType:$('#careSkin').value,goal:$('#careGoal').value,sensitive:$('#careSensitive').value,warningSigns:$('#careWarnings').checked},adultConfirmed:$('#careAdult').checked,googleConsent:$('#careGoogleConsent').checked,consentVersion:status.consentVersion,existingIds:existingProducts(),history,...(image?{image,photoConsent:true}:{})};
 busy=true;refresh();conversation.setAttribute('aria-busy','true');controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),42000);
 try{
  const response=await fetch('/api/care/chat',{method:'POST',headers:{'content-type':'application/json','x-trend-care':'1'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'تعذّر إكمال الطلب الآن.');renderReply(data);history=[...history,{role:'user',text:message||JSON.stringify(payload.profile)},{role:'model',text:data.message+(data.questions||[]).join(' ')}].slice(-6);$('#careMessage').value='';clearPhoto();
 }catch(e){$('#careError').textContent=e.name==='AbortError'?'استغرقت الإجابة وقتًا أطول. حاولي مجددًا بعد قليل.':e.message;$('#careError').scrollIntoView({block:'nearest'})}
 finally{clearTimeout(timeout);busy=false;controller=null;conversation.removeAttribute('aria-busy');refresh()}
};
$('#careReset').onclick=()=>{if(busy)return;history=[];clearPhoto();form.reset();conversation.replaceChildren(make('p','بدأنا محادثة جديدة. اختاري تفضيلاتكِ من النموذج.','care-empty'));$('#careError').textContent='';$('#careSkin').focus()};
window.addEventListener('pagehide',()=>{controller?.abort();image=null;history=[]});
fetch('/api/care/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{status=data;$('#careAvailability').textContent=data.available?'الأسعار والتوفر تُقرأ مباشرة من المتجر مع كل اقتراح.':'مساعد العناية غير متاح حاليًا. يمكنك متابعة التسوق من رابط المتجر أعلاه.';$('#carePhotoSection').hidden=!data.imagesAvailable;refresh()}).catch(()=>{$('#careAvailability').textContent='تعذّر الاتصال بالمساعد. يمكنك متابعة التسوق كالمعتاد.';refresh()});
