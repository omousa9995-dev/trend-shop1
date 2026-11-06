import {mountSilentVideo} from './silent-video.js?v=5.4.0';
import {tx,formatMoney as money} from './i18n.js?v=5.1.0';
import {productPrice} from './commerce.js?v=5.0.0';
import {validProductVideo} from './media-gallery.js?v=5.4.0';
import {isAquaFreshPilot,validVideoPoster} from './product-video-presentation.js?v=5.0.0';

const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localPhoto=value=>typeof value==='string'&&(/^\/(?:images|media)\/[A-Za-z0-9_./-]+\.(?:svg|webp|png|jpe?g)$/.test(value))&&!value.split('/').includes('..');

export function mountAquaFreshPilot(root,{product,content={},photos=[]}={}) {
  if(!isAquaFreshPilot(product?.id))return null;
  const article=root.querySelector('.product-story'),region=root.querySelector('[data-product-videos]');
  if(!article||!region)return null;
  article.classList.add('aqua-fresh-pilot');
  article.querySelectorAll('.story-lead,.story-quick-benefits li>span:last-child').forEach(el=>{
    el.innerHTML=el.innerHTML.replace(/SPF50\+ PA\+\+\+\+/g,'<bdi dir="ltr">SPF50+ PA++++</bdi>');
  });
  const price=root.ownerDocument.createElement('div');
  price.className='aqua-hero-price';
  price.innerHTML=`<strong>${money(productPrice(product))}</strong><span>${tx(product._bundle?'للباكيج · اختاري كميتكِ بالأسفل':'للقطعة · اختاري كميتكِ بالأسفل',product._bundle?'per bundle · choose your quantity below':'per item · choose your quantity below')}</span>`;
  article.querySelector('.story-tagline').after(price);
  const assurance=root.ownerDocument.createElement('p');
  assurance.className='aqua-delivery-note';
  assurance.textContent=tx('الدفع عند الاستلام · التوصيل دينار، ومجاني فوق 19 دينارًا بعد الخصم.','Pay on delivery · Delivery is 1 JOD, free above 19 JOD after discounts.');
  article.querySelector('.story-assurance').after(assurance);
  const ingredientCards=content.ingredientCards||[];
  if(ingredientCards.length){
    const cards=root.ownerDocument.createElement('div');cards.className='aqua-ingredient-cards';
    cards.innerHTML=ingredientCards.map(card=>`<div><span>${safe(card.label)}</span><h3>${safe(card.title)}</h3><p>${safe(card.text)}</p></div>`).join('');
    article.querySelector('.story-editorial-copy').append(cards);
  }
  const jump=root.ownerDocument.createElement('button');jump.type='button';jump.dataset.aquaJump='';
  jump.textContent=tx('شوفيه عن قرب','See it up close');
  jump.onclick=()=>region.scrollIntoView({block:'start',behavior:root.ownerDocument.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  article.querySelector('.story-section-nav').insertBefore(jump,article.querySelector('.story-section-nav').children[3]||null);
  const rail=createAquaFreshRail(region,{product,photos,onChoose:()=>{
    const purchase=article.querySelector('#storyPurchase');purchase.scrollIntoView({block:'start',behavior:'auto'});
    purchase.querySelector('input:checked,button:not(:disabled)')?.focus({preventScroll:true});
  }});
  article.aquaFreshPilot=rail;
  return rail;
}

export function createAquaFreshRail(region,{product,photos=[],onChoose}={}) {
 if(!isAquaFreshPilot(product?.id))return null;
 const doc=region.ownerDocument,view=doc.defaultView,pictures=photos.filter(p=>localPhoto(p.url));
 let videos=[],players=[],dialog=null,opener=null,position=0,oldOverflow='',dead=false;
 const motion=()=>view.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
 function restore(){if(!opener)return;doc.body.style.overflow=oldOverflow;const previous=opener;opener=null;if(previous.isConnected)previous.focus({preventScroll:true});}
 function close(){if(!dialog?.open)return;dialog.close?.();dialog.removeAttribute('open');restore();}
 function show(index){
  if(!pictures.length)return;position=(index+pictures.length)%pictures.length;const item=pictures[position];
  dialog.querySelector('[data-aqua-view]').innerHTML=`<img src="${safe(item.url)}" alt="${safe(item.alt||product.name)}" width="700" height="1000"/><small>${item.kind==='promotional'?tx('مشهد دعائي للمنتج','Product promotional scene'):tx('تفاصيل العبوة','Pack detail')}</small>`;
  dialog.querySelector('[data-aqua-counter]').textContent=`${position+1} / ${pictures.length}`;
  dialog.querySelector('[data-aqua-dialog-caption]').textContent=item.label||tx('تفاصيل المنتج','Product details');
  dialog.querySelector('[data-aqua-next]').hidden=dialog.querySelector('[data-aqua-previous]').hidden=pictures.length<2;
 }
 function open(index,button){
  if(dead||!pictures.length)return;
  if(!dialog){
   dialog=doc.createElement('dialog');dialog.className='aqua-media-dialog is-photo';dialog.setAttribute('aria-labelledby','aquaMediaTitle');
   dialog.innerHTML=`<div class="aqua-dialog-shell"><header><h2 id="aquaMediaTitle">${tx('تفاصيل اختياركِ','Your choice, up close')}</h2><button type="button" data-aqua-close aria-label="${tx('إغلاق عارض الصور','Close photo viewer')}">×</button></header><div class="aqua-dialog-stage" data-aqua-view></div><div class="aqua-dialog-navigation"><button type="button" data-aqua-previous>${tx('السابق','Previous')}</button><span data-aqua-counter aria-live="polite"></span><button type="button" data-aqua-next>${tx('التالي','Next')}</button></div><p data-aqua-dialog-caption></p><footer><span><small>${tx(product._bundle?'سعر الباكيج':'سعر القطعة',product._bundle?'Bundle price':'Item price')}</small><b>${money(productPrice(product))}</b></span><button type="button" data-aqua-choose>${tx('اختاري كميتكِ','Choose your quantity')}</button></footer></div>`;
   doc.body.append(dialog);dialog.querySelector('[data-aqua-close]').onclick=close;dialog.querySelector('[data-aqua-previous]').onclick=()=>show(position-1);dialog.querySelector('[data-aqua-next]').onclick=()=>show(position+1);dialog.querySelector('[data-aqua-choose]').onclick=()=>{close();onChoose?.();};
   dialog.addEventListener('close',restore);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
   dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();show(position+(event.key==='ArrowRight'?1:-1));}
    if(event.key==='Tab'){const buttons=[...dialog.querySelectorAll('button')].filter(b=>!b.hidden),first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}}
   });
  }
  opener=button;oldOverflow=doc.body.style.overflow;show(index);if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');doc.body.style.overflow='hidden';dialog.querySelector('[data-aqua-close]').focus();
 }
 function render(){
  if(dead)return;close();players.forEach(p=>p.destroy());players=[];region.replaceChildren();
  region.hidden=(!pictures.length&&!videos.length)||region.dataset.settingsDisabled==='true';if(!pictures.length&&!videos.length)return;
  region.classList.add('aqua-showcase');
  region.innerHTML=`<div class="aqua-showcase-heading"><div><span class="story-eyebrow">THE TREND SHOP</span><h2>${tx('شوفيه عن قرب… وعلى راحتكِ.','A closer look. At your own pace.')}</h2><p>${videos.length?tx('لحظات من العناية، على راحتكِ.','A few moments of care, at your own pace.'):tx('تعرّفي إلى العبوة ولمسة العناية. اضغطي على الصورة لتشاهدي التفاصيل.','Meet the pack and the care moment. Tap a photo to explore the details.')}</p></div></div>${videos.length?`<div class="product-silent-video-grid" aria-label="${tx('فيديوهات المنتج','Product videos')}">${videos.map((v,i)=>`<figure class="product-silent-video-card"><div class="product-silent-video-frame" data-silent-clip="${i}"></div>${v.title?`<figcaption>${safe(v.title)}</figcaption>`:''}</figure>`).join('')}</div>`:''}${pictures.length?`<div class="aqua-media-rail" aria-label="${tx('صور المنتج؛ اسحبي للتنقل','Product photos; swipe to explore')}">${pictures.map((item,index)=>`<button type="button" class="aqua-media-card ${item.kind!=='promotional'?'is-pack':''}" data-aqua-card="${index}" aria-label="${safe(tx('تكبير','Open')+' '+(item.label||tx('الصورة','photo')))}"><span class="aqua-card-media"><img src="${safe(item.url)}" alt="${safe(item.alt||product.name)}" width="270" height="480" loading="lazy" decoding="async"/><span class="aqua-video-badge">${tx('صورة · اضغطي للتكبير','Photo · tap to explore')}</span></span><span class="aqua-card-caption">${safe(item.label||tx('تفاصيل اختياركِ','Your choice, up close'))}</span></button>`).join('')}</div>`:''}${onChoose?`<div class="aqua-showcase-foot"><p>${pictures.length?tx('اسحبي بين الصور لاكتشاف التفاصيل','Swipe through the photos to explore the details'):''}</p><button type="button" data-aqua-select>${tx('أحببتِه؟ اختاري كميتكِ','Found your fit? Choose your quantity')}</button></div>`:''}`;
  region.querySelectorAll('[data-aqua-card]').forEach(button=>button.onclick=()=>open(Number(button.dataset.aquaCard),button));
  region.querySelector('[data-aqua-select]')?.addEventListener('click',()=>onChoose?.());
  region.querySelectorAll('[data-silent-clip]').forEach(host=>{const v=videos[Number(host.dataset.silentClip)];players.push(mountSilentVideo(host,{...v,poster:validVideoPoster(v.poster)?v.poster:'',label:v.title||tx('فيديو المنتج','Product video')}));});
 }
 const controller={setVideos(rows){const next=(rows||[]).filter(v=>v.productId===product.id&&validProductVideo(v)).slice(0,3);if(JSON.stringify(next)===JSON.stringify(videos))return;videos=next;render();},destroy(){if(dead)return;close();dead=true;players.forEach(p=>p.destroy());players=[];dialog?.remove();region.aquaFreshRail=null;}};
 region.aquaFreshRail=controller;render();return controller;
}
