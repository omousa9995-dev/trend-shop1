const MAX_BYTES=20*1024*1024;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createFeaturedVideoManager({call,root=document}){
 const panel=root.querySelector('#productFeaturedVideoPanel');
 if(!panel)return {select(){},cancel(){},get busy(){return false}};
 const input=panel.querySelector('[data-featured-file]'),button=panel.querySelector('[data-featured-upload]'),status=panel.querySelector('[data-featured-status]'),preview=panel.querySelector('[data-featured-preview]');
 let productId='',sequence=0,current=null,busy=false,loading=false,xhr=null;
 function controls(){input.disabled=button.disabled=busy||loading||productId!=='TS0098';preview.querySelectorAll('button').forEach(b=>b.disabled=busy||loading);button.textContent=current?'استبدال الفيديو العلوي':'رفع الفيديو العلوي';}
 function cancel(){sequence++;xhr?.abort();xhr=null;busy=false;loading=false;preview.querySelector('video')?.pause();controls();}
 function render(){
  preview.innerHTML=current?`<div class="admin-video-card"><b>الفيديو العلوي — فيديو واحد</b><video controls muted playsinline preload="none" src="${safe(current.url)}" aria-label="معاينة الفيديو العلوي لأرينسيا" style="aspect-ratio:9/16;max-width:220px;object-fit:contain"></video><button type="button" class="minor" data-featured-remove>حذف الفيديو العلوي</button></div>`:'<p class="micro">لم يُرفع الفيديو العلوي بعد. سيظهر مكانه للزبونة بعد رفع فيديو واحد هنا.</p>';
  controls();
  const remove=preview.querySelector('[data-featured-remove]');
  if(remove)remove.onclick=async()=>{
   if(busy||!root.defaultView.confirm('حذف الفيديو العلوي لأرينسيا؟ فيديوهات الأسفل تبقى كما هي.'))return;
   const token=sequence,id=current.id;busy=true;controls();status.textContent='جارٍ حذف الفيديو العلوي…';
   try{await call('product-feature-video','POST',{action:'remove',productId,id});if(token===sequence){current=null;render();status.textContent='حُذف الفيديو العلوي. يمكنك رفع بديل هنا.'}}
   catch(e){if(token===sequence)status.textContent=e.message}
   finally{if(token===sequence){busy=false;controls();}}
  };
 }
 async function select(product){
  cancel();productId=product?.id||'';const token=sequence;current=null;input.value='';status.textContent='';panel.hidden=productId!=='TS0098';preview.replaceChildren();
  if(panel.hidden){controls();return;}
  loading=true;controls();status.textContent='جارٍ تحميل الفيديو العلوي…';
  try{const result=await call('product-feature-video?product='+productId);if(token===sequence){current=result.video||null;render();status.textContent='';}}
  catch(e){if(token===sequence)status.textContent=e.message}
  finally{if(token===sequence){loading=false;controls();}}
 }
 button.onclick=async()=>{
  if(busy||loading||productId!=='TS0098')return;
  const file=input.files?.[0];
  if(!file||file.size<24){status.textContent='اختاري فيديو من ألبوم الصور أولًا.';return;}
  if(file.size>MAX_BYTES){status.textContent='الحد الأقصى 20 ميغابايت. قصّري الفيديو أو احفظيه بدقة أقل.';return;}
  const token=sequence,form=new FormData();form.append('product',productId);form.append('video',file,file.name);form.append('replaceId',current?.id||'');
  busy=true;controls();status.textContent='جارٍ رفع الفيديو العلوي… 0%';
  try{
   const result=await new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();xhr=request;request.open('POST','/api/admin/product-feature-video');request.withCredentials=true;request.timeout=120000;request.setRequestHeader('x-trend-admin','1');
    request.upload.onprogress=e=>{if(token===sequence&&e.lengthComputable)status.textContent='جارٍ رفع الفيديو العلوي… '+Math.min(99,Math.round(e.loaded/e.total*100))+'%';};
    request.onload=()=>{let data;try{data=JSON.parse(request.responseText);}catch{reject(Error('تعذرت قراءة النتيجة. أعيدي فتح أرينسيا للتحقق قبل إعادة الرفع.'));return;}request.status>=200&&request.status<300?resolve(data):reject(Error(data.error||'تعذر رفع الفيديو العلوي'));};
    request.onerror=()=>reject(Error('انقطع الاتصال. أعيدي فتح أرينسيا للتحقق من الفيديو.'));request.ontimeout=()=>reject(Error('انتهى انتظار الرفع. أعيدي فتح أرينسيا للتحقق من الفيديو.'));request.onabort=()=>reject(new DOMException('Cancelled','AbortError'));request.send(form);
   });
   if(token!==sequence)return;
   current=result.video;input.value='';render();status.textContent='رُفع الفيديو العلوي. يظهر تحت التوصيل وسياسة الطلب، صامتًا وبالتكرار. فيديوهات الأسفل لم تتغير.';
  }catch(e){if(token===sequence&&e.name!=='AbortError')status.textContent=e.message;}
  finally{if(token===sequence){busy=false;xhr=null;controls();}}
 };
 return {select,cancel,get busy(){return busy}};
}
