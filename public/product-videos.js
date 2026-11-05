import {locale,tx} from './i18n.js';
import {mountMediaGallery,validProductVideo} from './media-gallery.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountProductVideos(region,{productId,fetcher=fetch}={}){
 if(!region)return;
 region.hidden=true;region.replaceChildren();const language=locale();
 try{
  const response=await fetcher('/api/product-videos?product='+encodeURIComponent(productId),{cache:'no-store'});if(!response.ok)return;
  const data=await response.json();if(!region.isConnected||locale()!==language)return;
  const videos=(data.videos||[]).filter(validProductVideo).slice(0,3).map(v=>({...v,title:language==='en'?v.titleEn||v.title:v.title}));
  if(!videos.length)return;
  const gallery=[...region.ownerDocument.querySelectorAll('[data-gallery-product]')].find(el=>el.dataset.galleryProduct===productId);
  gallery?.mediaGallery?.setVideos(videos);
  region.innerHTML=`<div class="story-section-title"><span class="story-eyebrow">A MOMENT FOR YOU</span><h2>${tx('شاهدي لحظة العناية','See the care moment')}</h2><p>${tx('خذي وقتكِ واكتشفي التفاصيل. اسحبي للتنقل بين الصور والفيديوهات.','Take your time with the details. Swipe between photos and videos.')}</p></div><div class="product-video-gallery"></div>`;
  region.hidden=false;mountMediaGallery(region.querySelector('.product-video-gallery'),{photos:gallery?.mediaGallery?.photos||[],videos,productId,name:gallery?.querySelector('img')?.alt||'',startWithVideo:true});
 }catch{/* Optional media must never block product information or checkout. */}
}
