import {tx} from './i18n.js';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const validProductVideo=v=>/^\/product-videos\/[a-f0-9-]{36}$/.test(v?.url||'')&&['video/mp4','video/quicktime','video/webm'].includes(v.mime);
export function mountMediaGallery(host,{photos=[],videos=[],name='',productId='',startWithVideo=false,onZoom,mainImageId=''}={}){
 host.mediaGallery?.destroy();host.classList.add('touch-media-host');host.dataset.galleryProduct=productId;
 const pictures=photos.filter(p=>p?.url).map(p=>({...p,type:'image'}));
 let clips=videos.filter(validProductVideo).map(v=>({...v,type:'video'})),items=[],index=0,drag=null,suppressClick=false,observer,visible=!globalThis.IntersectionObserver;
 host.innerHTML=`<div class="touch-media-stage" tabindex="0" role="group" aria-label="${tx('صور وفيديوهات المنتج','Product photos and videos')}"><div class="touch-media-content"></div><button type="button" class="media-arrow media-prev" aria-label="${tx('الصورة أو الفيديو السابق','Previous photo or video')}">‹</button><button type="button" class="media-arrow media-next" aria-label="${tx('الصورة أو الفيديو التالي','Next photo or video')}">›</button><output class="media-count" aria-live="polite"></output></div><div class="touch-media-thumbs" aria-label="${tx('اختاري صورة أو فيديو','Choose a photo or video')}"></div><p class="media-swipe-hint">${tx('اسحبي يمينًا أو يسارًا لتكتشفي التفاصيل ♡','Swipe left or right to explore ♡')}</p><p class="media-caption" ${mainImageId==='storyMainImage'?'id="storyImageCaption"':''}></p>`;
 const stage=host.querySelector('.touch-media-stage'),content=host.querySelector('.touch-media-content'),thumbs=host.querySelector('.touch-media-thumbs');
 function pause(){content.querySelector('video')?.pause()}
 function play(){const v=content.querySelector('video');if(v&&visible&&!host.ownerDocument.hidden){const promise=v.play();promise?.catch(()=>{})}}
 function show(next){
  if(!items.length)return;pause();index=(next+items.length)%items.length;const item=items[index];
  stage.classList.toggle('is-video',item.type==='video');stage.classList.toggle('is-scene',item.kind==='promotional');
  if(item.type==='video'){
   content.innerHTML=`<video controls autoplay muted loop playsinline preload="metadata" width="360" height="640" aria-label="${safe(item.title||name)}"><source src="${safe(item.url)}" type="${safe(item.mime)}"/></video><p class="media-play-error" hidden>${tx('المتصفح لم يشغّل الفيديو. جرّبي زر التشغيل أو أعيدي تحميل الصفحة.','The video could not play. Try the play button or reload the page.')}</p>`;
   const video=content.querySelector('video');video.muted=true;video.addEventListener('error',()=>{content.querySelector('.media-play-error').hidden=false});
   // Observe the actual stage; videos stop as soon as their gallery leaves view.
   if(globalThis.IntersectionObserver){observer?.disconnect();observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?play():pause()},{threshold:.15});observer.observe(stage)}else play();
  }else{
   observer?.disconnect();content.innerHTML=`<button type="button" class="media-zoom" ${mainImageId==='storyMainImage'?'id="openImageZoom"':''} ${mainImageId==='galleryMain'?'id="openImageZoom"':'data-story-zoom'} aria-label="${tx('تكبير صورة المنتج','Enlarge product image')}"><img ${mainImageId?`id="${safe(mainImageId)}"`:''} src="${safe(item.url)}" alt="${safe(item.alt||name)}" width="700" height="760" draggable="false"/><span>⊕ ${tx('شاهدي التفاصيل','See the detail')}</span></button>`;
   content.querySelector('button').onclick=()=>onZoom?.(pictures.map(p=>p.url),name,pictures.findIndex(p=>p.url===item.url));
  }
  host.querySelector('.media-count').textContent=(index+1)+' / '+items.length;
  host.querySelector('.media-caption').textContent=item.type==='video'?tx('شغّلي الصوت أو حرّكي شريط الفيديو إلى اللحظة التي تحبينها.','Turn on sound or move the video timeline to any moment you like.'):item.kind==='promotional'?tx('لحظة من روتين العناية · مشهد دعائي','A moment in your routine · Promotional scene'):tx('تفاصيل العبوة، لتختاري وأنتِ مطمئنة.','A closer look at the pack, so you can choose with ease.');
  thumbs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  host.querySelectorAll('.media-arrow').forEach(b=>b.hidden=items.length<2);
 }
 function rebuild(){const current=items[index]?.url;items=startWithVideo?[...clips,...pictures]:[...pictures,...clips];
  thumbs.innerHTML=items.map((item,i)=>`<button type="button" data-media-index="${i}" ${mainImageId==='storyMainImage'?`data-story-photo="${i}"`:`data-gallery-index="${i}"`} aria-label="${safe(item.type==='video'?tx('فيديو المنتج','Product video'):tx('صورة المنتج','Product image'))} ${i+1}" aria-pressed="false">${item.type==='video'?`<span class="media-video-thumb" aria-hidden="true">▶</span>`:`<img src="${safe(item.thumbnail||item.url)}" alt="" width="64" height="64" loading="lazy"/>`}<small>${safe(item.label||item.title||(item.type==='video'?tx('الفيديو','Video'):tx('التفاصيل','Details')))}</small></button>`).join('');
  thumbs.querySelectorAll('button').forEach(b=>b.onclick=()=>show(Number(b.dataset.mediaIndex)));show(Math.max(0,items.findIndex(x=>x.url===current)));
 }
 host.querySelector('.media-prev').onclick=()=>show(index-1);host.querySelector('.media-next').onclick=()=>show(index+1);
 stage.addEventListener('keydown',e=>{if(e.target.tagName==='VIDEO')return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowLeft'?1:-1))}});
 stage.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button>0||e.target.closest('.media-arrow'))return;const video=e.target.closest('video'),rect=video?.getBoundingClientRect();if(rect&&e.clientY>rect.bottom-75)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId}});
 stage.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.35){suppressClick=true;show(index+(dx<0?1:-1));setTimeout(()=>suppressClick=false,250)}});
 stage.addEventListener('pointercancel',()=>{drag=null});
 stage.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation()}},true);
 const visibility=()=>host.ownerDocument.hidden?pause():play();host.ownerDocument.addEventListener('visibilitychange',visibility);
 const controller={photos:pictures,get index(){return index},show,setVideos(rows){clips=rows.filter(validProductVideo).map(v=>({...v,type:'video'}));rebuild()},destroy(){pause();observer?.disconnect();host.ownerDocument.removeEventListener('visibilitychange',visibility)}};
 host.mediaGallery=controller;rebuild();return controller;
}
