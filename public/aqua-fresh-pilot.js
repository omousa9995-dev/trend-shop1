import {tx,formatMoney as money} from './i18n.js?v=5.1.0';
import {productPrice} from './commerce.js?v=5.0.0';
import {validProductVideo} from './media-gallery.js?v=5.0.0';
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
  const doc=region.ownerDocument,view=doc.defaultView;
  const reduced=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pictures=photos.filter(p=>localPhoto(p.url)).map(p=>({...p,type:'photo'}));
  let videos=[],items=[],position=0,observer,dialog=null,opener=null,drag=null,oldOverflow='',dead=false;
  const visible=new Set();
  const motionAllowed=()=>!reduced?.matches;
  const play=video=>{if(!video||doc.hidden||!motionAllowed())return;video.play()?.catch(()=>{});};
  const pausePreviews=()=>region.querySelectorAll('video').forEach(v=>v.pause());
  function resumePreviews(){if(dialog?.open||dead)return;for(const video of visible)play(video);}
  function teardownPreviews(){observer?.disconnect();observer=null;pausePreviews();visible.clear();}
  function close(){if(!dialog?.open)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');restore();}
  function restore(){
    if(!opener)return;
    dialog?.querySelector('video')?.pause();
    if(dialog)dialog.querySelector('[data-aqua-view]')?.replaceChildren();
    doc.body.style.overflow=oldOverflow;
    if(opener?.isConnected)opener.focus({preventScroll:true});
    opener=null;drag=null;resumePreviews();
  }
  function show(index){
    position=(index+items.length)%items.length;
    const item=items[position],container=dialog.querySelector('[data-aqua-view]');
    container.querySelector('video')?.pause();
    dialog.classList.toggle('is-photo',item.type==='photo');
    container.innerHTML=item.type==='video'
      ?`<video controls autoplay muted loop playsinline preload="metadata" width="360" height="640" ${item.poster?`poster="${safe(item.poster)}"`:''} aria-label="${safe(item.title||product.name)}"><source src="${safe(item.url)}" type="${safe(item.mime)}"/></video><p class="aqua-video-fallback" hidden>${tx('تعذّر تشغيل المقطع. جرّبي زر التشغيل أو اختاري المقطع التالي.','This clip could not play. Try the play control or the next clip.')}</p>`
      :`<img src="${safe(item.url)}" alt="${safe(item.alt||product.name)}" width="700" height="1000"/><small>${item.kind==='promotional'?tx('مشهد دعائي للمنتج','Product promotional scene'):tx('تفاصيل العبوة','Pack detail')}</small>`;
    const video=container.querySelector('video');
    const tools=dialog.querySelector('[data-aqua-video-tools]');tools.hidden=!video;
    dialog.querySelector('#aquaMediaHelp').textContent=video?tx('اسحبي بين اللقطات، أو اختاري الوقت والصوت من أدوات الفيديو.','Swipe between moments, or choose the time and sound with the video controls.'):tx('اسحبي بين اللقطات، وخذي وقتكِ مع التفاصيل.','Swipe between moments and take your time with the details.');
    if(video){
      video.muted=true;
      const range=tools.querySelector('input'),clock=tools.querySelector('output'),toggle=tools.querySelector('[data-aqua-play]'),sound=tools.querySelector('[data-aqua-sound]');
      const time=value=>{const n=Math.max(0,Math.floor(Number(value)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
      const sync=()=>{
        if(container.querySelector('video')!==video)return;
        const duration=Number.isFinite(video.duration)?video.duration:0;
        range.max=String(duration||1);range.disabled=!duration;range.value=String(video.currentTime||0);
        range.setAttribute('aria-valuetext',time(video.currentTime)+' / '+time(duration));clock.textContent=time(video.currentTime)+' / '+time(duration);
        toggle.textContent=video.paused?tx('تشغيل','Play'):tx('إيقاف مؤقت','Pause');sound.textContent=video.muted?tx('تشغيل الصوت','Sound on'):tx('كتم الصوت','Mute');
      };
      range.oninput=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,Number(range.value)||0));sync();};
      tools.querySelector('[data-aqua-back]').onclick=()=>{video.currentTime=Math.max(0,video.currentTime-5);sync();};
      tools.querySelector('[data-aqua-forward]').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+5);sync();};
      toggle.onclick=()=>{if(video.paused)video.play()?.catch(()=>{});else video.pause();};sound.onclick=()=>{video.muted=!video.muted;sync();};
      for(const event of ['loadedmetadata','durationchange','timeupdate','play','pause','volumechange'])video.addEventListener(event,sync);
      video.addEventListener('error',()=>{container.querySelector('.aqua-video-fallback').hidden=false;});sync();video.play()?.catch(()=>{});
    }
    dialog.querySelector('[data-aqua-dialog-caption]').textContent=item.title||item.label||tx('تفاصيل المنتج','Product details');
    dialog.querySelector('[data-aqua-counter]').textContent=`${position+1} / ${items.length}`;
    dialog.querySelector('[data-aqua-next]').hidden=dialog.querySelector('[data-aqua-previous]').hidden=items.length<2;
  }
  function open(index,button){
    if(dead||!items.length)return;
    if(!dialog){
      dialog=doc.createElement('dialog');dialog.className='aqua-media-dialog';dialog.setAttribute('aria-labelledby','aquaMediaTitle');
      dialog.setAttribute('aria-describedby','aquaMediaHelp');
      dialog.innerHTML=`<div class="aqua-dialog-shell"><header><div><small>${safe(product.brand||'TREND SHOP')}</small><h2 id="aquaMediaTitle">${tx('لحظة أقرب لاختياركِ','A closer look at your choice')}</h2></div><button type="button" data-aqua-close aria-label="${tx('إغلاق عارض الصور والفيديو','Close photo and video viewer')}" autofocus>×</button></header><div class="aqua-dialog-stage" data-aqua-view></div><div class="aqua-video-tools" data-aqua-video-tools hidden><div class="aqua-video-timeline"><input type="range" min="0" max="1" step="0.1" value="0" dir="ltr" aria-label="${tx('تقديم الفيديو أو إرجاعه','Seek video')}"/><output dir="ltr">0:00 / 0:00</output></div><div class="aqua-video-actions"><button type="button" data-aqua-back aria-label="${tx('إرجاع خمس ثوانٍ','Rewind five seconds')}">−5s</button><button type="button" data-aqua-play>${tx('تشغيل','Play')}</button><button type="button" data-aqua-forward aria-label="${tx('تقديم خمس ثوانٍ','Forward five seconds')}">+5s</button><button type="button" data-aqua-sound>${tx('تشغيل الصوت','Sound on')}</button></div></div><div class="aqua-dialog-navigation"><button type="button" data-aqua-previous>${tx('السابق','Previous')}</button><span data-aqua-counter aria-live="polite"></span><button type="button" data-aqua-next>${tx('التالي','Next')}</button></div><p data-aqua-dialog-caption></p><p id="aquaMediaHelp"></p><footer><span><small>${tx(product._bundle?'سعر الباكيج':'سعر القطعة',product._bundle?'Bundle price':'Item price')}</small><b>${money(productPrice(product))}</b></span><button type="button" data-aqua-choose>${tx('اختاري كميتكِ','Choose your quantity')}</button></footer></div>`;
      doc.body.append(dialog);
      dialog.querySelector('[data-aqua-close]').onclick=close;
      dialog.querySelector('[data-aqua-previous]').onclick=()=>show(position-1);
      dialog.querySelector('[data-aqua-next]').onclick=()=>show(position+1);
      dialog.querySelector('[data-aqua-choose]').onclick=()=>{close();onChoose?.();};
      dialog.addEventListener('close',restore);
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
      dialog.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();close();}
        if(event.target.closest('video,input'))return;
        if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();show(position+(event.key==='ArrowRight'?1:-1));}
        if(event.key==='Tab'){
          const targets=[...dialog.querySelectorAll('button:not([hidden]),video[controls],input:not(:disabled)')].filter(el=>!el.disabled&&!el.closest('[hidden]')),first=targets[0],last=targets.at(-1);
          if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
        }
      });
      const stage=dialog.querySelector('[data-aqua-view]');
      stage.addEventListener('pointerdown',event=>{
        if(event.isPrimary===false||event.button>0)return;
        const video=event.target.closest('video'),rect=video?.getBoundingClientRect();
        if(rect&&event.clientY>rect.bottom-80)return;
        drag={x:event.clientX,y:event.clientY};
      });
      stage.addEventListener('pointercancel',()=>{drag=null;});
      stage.addEventListener('pointerup',event=>{
        if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag=null;
        if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)show(position+(dx<0?1:-1));
      });
    }
    opener=button;oldOverflow=doc.body.style.overflow;pausePreviews();
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    doc.body.style.overflow='hidden';show(index);dialog.querySelector('[data-aqua-close]').focus();
  }
  function render(){
    if(dead)return;close();teardownPreviews();
    items=[...videos,...pictures];
    region.hidden=!items.length||region.dataset.settingsDisabled==='true';if(!items.length)return;
    region.classList.add('aqua-showcase');
    region.innerHTML=`<div class="aqua-showcase-heading"><div><span class="story-eyebrow">THE TREND SHOP</span><h2>${tx('شوفيه عن قرب… وعلى راحتكِ.','A closer look. At your own pace.')}</h2><p>${videos.length?tx('لحظات قصيرة، تفاصيل أوضح. اضغطي على أي لقطة لتشاهديها بحجم أكبر.','Short moments, a closer view. Tap a card to open the larger viewer.'):tx('تعرّفي إلى العبوة ولمسة العناية. اضغطي على الصورة لتشاهدي التفاصيل.','Meet the pack and the care moment. Tap a photo to explore the details.')}</p></div><div class="aqua-rail-navigation"><button type="button" data-aqua-rail-prev aria-label="${tx('اللقطة السابقة','Previous moment')}">‹</button><button type="button" data-aqua-rail-next aria-label="${tx('اللقطة التالية','Next moment')}">›</button></div></div><div class="aqua-media-rail" aria-label="${tx('لقطات المنتج؛ اسحبي للتنقل','Product moments; swipe to explore')}">${items.map((item,index)=>`<button type="button" class="aqua-media-card ${item.type==='photo'&&item.kind!=='promotional'?'is-pack':''}" data-aqua-card="${index}" aria-label="${safe(tx('تكبير','Open')+' '+(item.title||item.label||tx('اللقطة','moment')))}"><span class="aqua-card-media">${item.type==='video'?`<video data-aqua-preview="${index}" muted loop playsinline preload="none" poster="${safe(item.poster||pictures[0]?.url||'')}" aria-hidden="true" tabindex="-1" width="270" height="480"></video><span class="aqua-video-badge">${tx('فيديو · اضغطي للمشاهدة','Video · tap to watch')}</span>`:`<img src="${safe(item.url)}" alt="${safe(item.alt||product.name)}" width="270" height="480" loading="lazy" decoding="async"/><span class="aqua-video-badge">${tx('صورة · اضغطي للتكبير','Photo · tap to explore')}</span>`}</span><span class="aqua-card-caption">${safe(item.title||item.label||tx('تفاصيل اختياركِ','Your choice, up close'))}</span></button>`).join('')}</div><div class="aqua-showcase-foot"><p>${tx('اسحبي يمينًا أو يسارًا لاكتشاف اللقطات','Swipe left or right to explore the moments')}</p><button type="button" data-aqua-select>${tx('أحببتِه؟ اختاري كميتكِ','Found your fit? Choose your quantity')}</button></div>`;
    region.querySelectorAll('[data-aqua-card]').forEach(button=>button.onclick=()=>open(Number(button.dataset.aquaCard),button));
    region.querySelector('[data-aqua-select]').onclick=()=>onChoose?.();
    let railIndex=0;
    const move=delta=>{railIndex=(railIndex+delta+items.length)%items.length;region.querySelector(`[data-aqua-card="${railIndex}"]`)?.scrollIntoView({block:'nearest',inline:'center',behavior:motionAllowed()?'smooth':'auto'});};
    region.querySelector('[data-aqua-rail-prev]').onclick=()=>move(-1);region.querySelector('[data-aqua-rail-next]').onclick=()=>move(1);
    if(items.length<2)region.querySelector('.aqua-rail-navigation').hidden=true;
    const Observer=view.IntersectionObserver||globalThis.IntersectionObserver;
    if(Observer){
      observer=new Observer(entries=>{for(const entry of entries){const video=entry.target,item=items[Number(video.dataset.aquaPreview)];
        if(entry.isIntersecting&&entry.intersectionRatio>=.45){visible.add(video);if(motionAllowed()){if(!video.getAttribute('src'))video.src=item.url;if(!dialog?.open)play(video);}}
        else{visible.delete(video);video.pause();}
      }},{threshold:[0,.45]});
      region.querySelectorAll('[data-aqua-preview]').forEach(video=>{video.muted=true;observer.observe(video);});
    }
  }
  function visibility(){if(doc.hidden){pausePreviews();dialog?.querySelector('video')?.pause();}else resumePreviews();}
  function motion(){if(!motionAllowed())pausePreviews();else resumePreviews();}
  doc.addEventListener('visibilitychange',visibility);reduced?.addEventListener?.('change',motion);
  const controller={
    setVideos(rows){
      const next=(rows||[]).filter(v=>v.productId===product.id&&validProductVideo(v)).slice(0,3).map(v=>({...v,type:'video',poster:validVideoPoster(v.poster)?v.poster:''}));
      if(JSON.stringify(next)===JSON.stringify(videos))return;videos=next;render();
    },
    destroy(){if(dead)return;close();dead=true;teardownPreviews();dialog?.remove();doc.removeEventListener('visibilitychange',visibility);reduced?.removeEventListener?.('change',motion);region.aquaFreshRail=null;},
  };
  region.aquaFreshRail=controller;render();return controller;
}
