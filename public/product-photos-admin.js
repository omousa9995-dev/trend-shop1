import {prepareSiteImage} from './site-image-upload.js?v=5.11.0';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createProductPhotoManager({call,root=document,prepare=prepareSiteImage,fetcher=(...args)=>fetch(...args),onChange=()=>{}}){
 const panel=root.querySelector('#productPhotosPanel');if(!panel)return {select(){},cancel(){},get busy(){return false}};
 const input=panel.querySelector('[data-photo-files]'),upload=panel.querySelector('[data-upload-photos]'),list=panel.querySelector('[data-photo-list]'),status=panel.querySelector('[data-photo-status]'),refresh=panel.querySelector('[data-refresh-photos]');
 let productId='',sequence=0,busy=false,controller,state=null;
 function lock(value){busy=value;input.disabled=upload.disabled=!productId||value;refresh.disabled=!productId||value;list.querySelectorAll('button').forEach(b=>b.disabled=value)}
 function cancel(){sequence++;controller?.abort();controller=null;lock(false)}
 function render(){
  const photos=state?.photos||[];panel.querySelector('[data-photo-count]').textContent=photos.length+' / '+(state?.maxPhotos||24)+' صورة';
  list.innerHTML=photos.length?photos.map((ph,i)=>`<article class="admin-photo-card"><a href="${safe(ph.url)}" target="_blank" rel="noopener noreferrer"><img src="${safe(ph.thumbnail||ph.url)}" alt="صورة الصفحة ${i+1}" loading="lazy" width="140" height="140"/></a><b>صورة ${i+1}${i===0?' · الأولى بالصفحة':''}</b><div><button type="button" class="minor" data-photo-move="-1" data-photo-index="${i}" ${i===0?'disabled':''} aria-label="تقديم الصورة ${i+1}">↑</button><button type="button" class="minor" data-photo-move="1" data-photo-index="${i}" ${i===photos.length-1?'disabled':''} aria-label="تأخير الصورة ${i+1}">↓</button><button type="button" class="minor" data-remove-photo="${i}">إزالة من الصفحة</button></div></article>`).join(''):'<p class="micro">لا توجد صور في صفحة المنتج. أضف الصور من ألبوم الهاتف.</p>';
  list.querySelectorAll('[data-remove-photo]').forEach(b=>b.onclick=()=>mutate({action:'remove',scope:'gallery',url:photos[Number(b.dataset.removePhoto)].url},'أُزيلت الصورة من صفحة المنتج. صورة البطاقة مستقلة.'));
  list.querySelectorAll('[data-photo-move]').forEach(b=>b.onclick=()=>{const urls=photos.map(x=>x.url),from=Number(b.dataset.photoIndex),to=from+Number(b.dataset.photoMove);if(to<0||to>=urls.length)return;[urls[from],urls[to]]=[urls[to],urls[from]];mutate({action:'reorder',urls},'حُفظ ترتيب صور الصفحة. صورة البطاقة مستقلة.')});
 }
 async function load(id,token){const next=await call('product-photos?product='+encodeURIComponent(id));if(token!==sequence||id!==productId)return false;state=next;render();return true}
 async function select(product){cancel();productId=product?.id||'';state=null;input.value='';status.textContent='';lock(false);const token=sequence;render();if(!productId){status.textContent='احفظ المنتج الجديد أولًا، ثم افتحه لإضافة صور الصفحة.';return}lock(true);try{await load(productId,token)}catch(e){if(token===sequence)status.textContent=e.message}finally{if(token===sequence)lock(false)}}
 async function mutate(data,message){if(busy||!state)return;const token=sequence,id=productId;lock(true);try{const next=await call('product-photos','POST',{...data,productId:id,revision:state.revision});onChange(id);if(token===sequence){state=next;render();status.textContent=message}}catch(e){if(token===sequence){status.textContent=e.message;await load(id,token).catch(()=>{})}}finally{if(token===sequence)lock(false)}}
 refresh.onclick=()=>select({id:productId});
 upload.onclick=async()=>{
  if(busy||!state)return;const files=Array.from(input.files||[]),id=productId,token=sequence;
  if(!files.length){status.textContent='اختر صورة أو عدة صور من ألبوم الهاتف أولًا.';return}
  if(files.length+state.photos.length>(state.maxPhotos||24)){status.textContent='تجاوزت سعة الصفحة. المتاح '+Math.max(0,(state.maxPhotos||24)-state.photos.length)+' صورة إضافية.';return}
  lock(true);controller=new AbortController();let added=0;
  try{
   for(let i=0;i<files.length;i++){
    status.textContent='جارٍ تجهيز ورفع الصورة '+(i+1)+' من '+files.length+'…';
    const blob=await prepare(files[i]);if(token!==sequence||id!==productId)return;
    const body=new FormData();body.append('product',id);body.append('uploadId',crypto.randomUUID());body.append('image',blob,'product-page.jpg');
    const response=await fetcher('/api/admin/product-photos',{method:'POST',credentials:'same-origin',headers:{'x-trend-admin':'1'},body,signal:controller.signal});
    const next=await response.json().catch(()=>({}));if(!response.ok)throw Error(next.error||'تعذر رفع الصورة');
    onChange(id);if(token!==sequence||id!==productId)return;state=next;added++;render();lock(true);
   }
   input.value='';status.textContent='أُضيفت '+added+' صورة إلى صفحة المنتج مباشرة. صورة البطاقة لم تتغير.';
  }catch(e){if(token===sequence&&e.name!=='AbortError'){status.textContent='اكتمل رفع '+added+' من '+files.length+'. '+e.message+' حدّث القائمة للتحقق قبل إعادة اختيار الصور المتبقية.';await load(id,token).catch(()=>{})}}
  finally{if(token===sequence){controller=null;lock(false)}}
 };
 return {select,cancel,get busy(){return busy}};
}
