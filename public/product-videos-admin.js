const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MAX_BYTES=20*1024*1024;
export function createProductVideoManager({call,root=document}){
 const panel=root.querySelector('#productVideoPanel');if(!panel)return {select(){},cancel(){},get busy(){return false}};
 const input=panel.querySelector('[data-video-file]'),status=panel.querySelector('[data-video-status]'),list=panel.querySelector('[data-video-list]'),button=panel.querySelector('[data-video-upload]');
 let productId='',sequence=0,listRevision=0,xhr=null,busy=false,rows=[];
 function cancel(){sequence++;listRevision++;xhr?.abort();xhr=null;busy=false;button.disabled=!productId;input.disabled=!productId;}
 function render(){
  list.innerHTML=rows.length?rows.map(v=>`<article class="admin-video-card"><div><b>${safe(v.title||'فيديو المنتج')}</b><small>${(v.bytes/1024/1024).toFixed(1)} ميغابايت · ${v.active?'ظاهر للزبونات':'مخفي'}</small></div><video controls playsinline preload="none" src="${safe(v.url)}" aria-label="معاينة فيديو المنتج"></video><button type="button" class="minor" data-toggle-video="${safe(v.id)}">${v.active?'إخفاء الفيديو':'استعادة الفيديو'}</button><button type='button' class='minor' data-remove-video='${safe(v.id)}'>حذف الفيديو</button></article>`).join(''):'<p class="micro">لا توجد فيديوهات لهذا المنتج. لن يظهر قسم الفيديو للزبونة حتى ترفعي فيديو.</p>';
  list.querySelectorAll('[data-toggle-video]').forEach(b=>b.onclick=async()=>{const v=rows.find(x=>x.id===b.dataset.toggleVideo),token=sequence;b.disabled=true;try{await call('product-videos','POST',{id:v.id,active:!v.active});if(token===sequence){v.active=!v.active;render();status.textContent=v.active?'أُعيد إظهار الفيديو.':'أُخفي الفيديو من صفحة المنتج.'}}catch(e){if(token===sequence)status.textContent=e.message}finally{if(b.isConnected)b.disabled=false}});
  list.querySelectorAll('[data-remove-video]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف الفيديو نهائيًا من هذا المنتج؟'))return;const token=sequence;b.disabled=true;try{await call('product-videos','POST',{id:b.dataset.removeVideo,action:'remove'});if(token===sequence){rows=rows.filter(v=>v.id!==b.dataset.removeVideo);render();status.textContent='حُذف الفيديو ويمكنك رفع بديل.'}}catch(e){if(token===sequence)status.textContent=e.message}finally{if(b.isConnected)b.disabled=false}});
 }
 async function select(product){
  cancel();productId=product?.id||'';const token=sequence,revision=++listRevision;rows=[];input.value='';panel.querySelector('[data-video-title]').value='';panel.querySelector('[data-video-title-en]').value='';status.textContent='';button.disabled=!productId;input.disabled=!productId;
  if(!productId){list.innerHTML='<p class="micro">احفظي المنتج الجديد أولًا، ثم افتحيه مجددًا لإضافة الفيديو.</p>';return;}
  list.innerHTML='<p class="micro">جارٍ تحميل الفيديوهات…</p>';
  try{const r=await call('product-videos?product='+encodeURIComponent(productId));if(token!==sequence||revision!==listRevision)return;rows=r.videos||[];render()}catch(e){if(token===sequence&&revision===listRevision){list.replaceChildren();status.textContent=e.message}}
 }
 button.onclick=async()=>{
  const file=input.files?.[0];if(!file||!productId){status.textContent='اختاري فيديو من ألبوم الصور أولًا.';return}
  if(file.size>MAX_BYTES){status.textContent='الفيديو أكبر من 20 ميغابايت. قصّريه أو احفظيه بدقة أقل ثم ارفعيه.';return}
  if(file.size<24){status.textContent='الملف فارغ أو غير صالح.';return}
  if(rows.length>=3){status.textContent='يمكن حفظ ثلاثة فيديوهات لكل منتج. يمكنك إخفاء الفيديوهات الحالية واستعادتها.';return}
  const token=sequence,id=productId,form=new FormData();form.append('product',id);form.append('video',file,file.name);form.append('title',panel.querySelector('[data-video-title]').value.trim());form.append('titleEn',panel.querySelector('[data-video-title-en]').value.trim());
  listRevision++;busy=true;button.disabled=true;input.disabled=true;status.textContent='جارٍ رفع الفيديو… 0%';
  try{
   const result=await new Promise((resolve,reject)=>{const request=new XMLHttpRequest();xhr=request;request.open('POST','/api/admin/product-videos');request.withCredentials=true;request.timeout=120000;request.setRequestHeader('x-trend-admin','1');request.upload.onprogress=e=>{if(token===sequence&&e.lengthComputable)status.textContent='جارٍ رفع الفيديو… '+Math.min(99,Math.round(e.loaded/e.total*100))+'%'};request.onload=()=>{let data;try{data=JSON.parse(request.responseText)}catch{reject(Error('تعذرت قراءة نتيجة الرفع؛ أعيدي فتح المنتج للتحقق قبل المحاولة مجددًا.'));return}request.status>=200&&request.status<300?resolve(data):reject(Error(data.error||'تعذر رفع الفيديو'))};request.onerror=()=>reject(Error('انقطع الاتصال. أعيدي فتح المنتج للتحقق من الفيديو قبل المحاولة مجددًا.'));request.ontimeout=()=>reject(Error('انتهى انتظار الرفع. أعيدي فتح المنتج للتحقق قبل المحاولة مجددًا.'));request.onabort=()=>reject(new DOMException('Cancelled','AbortError'));request.send(form)});
   if(token!==sequence||id!==productId)return;
   const revision=++listRevision,r=await call('product-videos?product='+encodeURIComponent(id));if(token!==sequence||revision!==listRevision)return;rows=r.videos||[];render();input.value='';status.textContent='رُفع الفيديو ويظهر الآن بعد طريقة الاستخدام. يمكنك إخفاؤه من هنا.';
  }catch(e){if(token===sequence&&e.name!=='AbortError')status.textContent=e.message}
  finally{if(token===sequence){busy=false;xhr=null;button.disabled=false;input.disabled=false}}
 };
 return {select,cancel,get busy(){return busy}};
}
