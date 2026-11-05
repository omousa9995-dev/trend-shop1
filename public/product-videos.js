import {locale,tx} from './i18n.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountProductVideos(region,{productId,fetcher=fetch}={}){
 if(!region)return;
 region.hidden=true;region.replaceChildren();const language=locale();
 try{
  const response=await fetcher('/api/product-videos?product='+encodeURIComponent(productId),{cache:'no-store'});if(!response.ok)return;
  const data=await response.json();if(!region.isConnected||locale()!==language)return;
  const videos=(data.videos||[]).filter(v=>/^\/product-videos\/[a-f0-9-]{36}$/.test(v.url||'')&&['video/mp4','video/quicktime','video/webm'].includes(v.mime)).slice(0,3);
  if(!videos.length)return;
  region.innerHTML=`<div class="story-section-title"><span class="story-eyebrow">SEE IT IN YOUR ROUTINE</span><h2>${tx('شاهدي خطوة العناية','See the care step')}</h2><p>${tx('فيديوهات يضيفها المتجر لتتعرفي أكثر على المنتج.','Videos selected by the store to help you explore the product.')}</p></div><div class="product-video-grid">${videos.map((v,i)=>`<figure><video controls playsinline preload="none" aria-label="${safe(language==='en'?v.titleEn||v.title||'Product video '+(i+1):v.title||'فيديو المنتج '+(i+1))}"><source src="${safe(v.url)}" type="${safe(v.mime)}"/></video><figcaption>${safe(language==='en'?v.titleEn||v.title:v.title)} <a href="${safe(v.url)}" target="_blank" rel="noopener noreferrer">${tx('افتحي الفيديو ↗','Open video ↗')}</a></figcaption><p class="product-video-error" hidden>${tx('تعذّر تشغيل الفيديو هنا. افتحيه مباشرة أو جرّبي MP4 متوافقًا.','This browser could not play the video. Open it directly or try a compatible MP4.')}</p></figure>`).join('')}</div>`;
  region.hidden=false;region.querySelectorAll('video').forEach(v=>v.addEventListener('error',()=>{v.closest('figure').querySelector('.product-video-error').hidden=false}));
 }catch{/* Optional media must never block product information or checkout. */}
}
