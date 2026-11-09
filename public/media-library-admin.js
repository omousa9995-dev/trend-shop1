const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createMediaLibrary({call,root=document,onChange=()=>{},onEdit=()=>{}}){
 const section=root.querySelector('#mediaSection');if(!section)return {load(){}};
 const list=section.querySelector('[data-media-groups]'),status=section.querySelector('[data-media-status]'),search=section.querySelector('[data-media-search]');
 let groups=[],limit=12,busy=false,sequence=0;
 function render(){
  const q=search.value.trim().toLocaleLowerCase(),filtered=groups.filter(g=>(g.name+' '+g.brand+' '+g.productId).toLocaleLowerCase().includes(q));
  list.innerHTML=filtered.slice(0,limit).map(g=>`<article class="media-product-group" data-media-product="${safe(g.productId)}"><header><div><small dir="ltr">${safe(g.productId)}</small><h3 dir="auto">${safe(g.name)}</h3><p>${g.photos.length} صورة · ${g.videos.length} فيديو${g.active?'':' · المنتج مخفي'}</p></div><button type="button" class="minor" data-media-edit="${safe(g.productId)}">إضافة وسائط / تعديل المنتج</button></header><div class="admin-media-grid">${g.photos.map((p,i)=>`<article class="admin-photo-card"><a href="${safe(p.url)}" target="_blank" rel="noopener noreferrer"><img src="${safe(p.thumbnail||p.url)}" alt="${safe(g.name)} — صورة ${i+1}" loading="lazy" width="160" height="160"/></a><small>${p.card&&p.gallery?'البطاقة وصفحة المنتج':p.card?'صورة البطاقة':'صفحة المنتج'}</small><button type="button" class="minor" data-library-photo="${i}" data-library-product="${safe(g.productId)}">إزالة من المنتج</button></article>`).join('')}${g.videos.map((v,i)=>`<article class="admin-photo-card"><video src="${safe(v.url)}" controls playsinline preload="none" aria-label="فيديو ${safe(g.name)}"></video><small>${v.kind==='featured'?'الفيديو العلوي':'فيديو أسفل الصفحة'}${v.active?'':' · مخفي'} · ${(v.bytes/1048576).toFixed(1)} MB</small><button type="button" class="minor" data-library-video="${i}" data-library-product="${safe(g.productId)}">حذف الفيديو من المنتج</button></article>`).join('')}</div></article>`).join('')||'<p class="empty-msg">لا توجد منتجات مطابقة.</p>';
  if(filtered.length>limit)list.insertAdjacentHTML('beforeend','<button type="button" class="btn" data-more-media>عرض المزيد من المنتجات</button>');
  list.querySelector('[data-more-media]')?.addEventListener('click',()=>{limit+=12;render()});
  list.querySelectorAll('[data-media-edit]').forEach(b=>b.onclick=()=>onEdit(b.dataset.mediaEdit));
  list.querySelectorAll('[data-library-photo]').forEach(b=>b.onclick=()=>remove(b,'photo'));
  list.querySelectorAll('[data-library-video]').forEach(b=>b.onclick=()=>remove(b,'video'));
  if(busy)list.querySelectorAll('button').forEach(b=>b.disabled=true);
 }
 function totals(){section.querySelector('[data-media-totals]').textContent=groups.reduce((n,g)=>n+g.photos.length,0)+' صورة · '+groups.reduce((n,g)=>n+g.videos.length,0)+' فيديو · '+groups.length+' منتج'}
 async function load(){const token=++sequence;busy=true;status.textContent='جارٍ تحميل الصور والفيديوهات…';section.querySelector('[data-refresh-media]').disabled=true;try{const r=await call('media-library');if(token!==sequence)return;groups=r.groups||[];totals();render();status.textContent=''}catch(e){if(token===sequence){status.textContent=e.message;list.replaceChildren()}}finally{if(token===sequence){busy=false;section.querySelector('[data-refresh-media]').disabled=false;render()}}}
 async function remove(button,kind){
  if(busy)return;const g=groups.find(x=>x.productId===button.dataset.libraryProduct);if(!g)return;
  const item=kind==='photo'?g.photos[Number(button.dataset.libraryPhoto)]:g.videos[Number(button.dataset.libraryVideo)];
  const confirm=root.defaultView?.confirm||globalThis.confirm;
  if(!confirm(kind==='photo'?'إزالة هذه الصورة من البطاقة وصفحة هذا المنتج؟ تبقى صور الفواتير السابقة محفوظة.':'حذف هذا الفيديو من صفحة المنتج؟'))return;
  busy=true;list.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='جارٍ إزالة الوسائط…';
  try{
   if(kind==='photo')await call('product-photos','POST',{productId:g.productId,action:'remove',scope:'all',url:item.url,revision:g.revision,expectedCard:g.card});
   else await call(item.kind==='featured'?'product-feature-video':'product-videos','POST',{productId:g.productId,id:item.id,action:'remove'});
   onChange(g.productId);await load();status.textContent='أُزيلت الوسائط من المنتج. تظهر النتيجة للزبونة عند تحميل الصفحة مجددًا.';
  }catch(e){status.textContent=e.message+' اضغط تحديث الوسائط للتحقق من القائمة.'}
  finally{busy=false;list.querySelectorAll('button').forEach(b=>b.disabled=false)}
 }
 search.oninput=()=>{limit=12;render()};section.querySelector('[data-refresh-media]').onclick=load;
 return {load};
}
