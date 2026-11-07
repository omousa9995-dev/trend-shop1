import {locale} from './i18n.js?v=5.1.0';
import {validProductVideo} from './media-gallery.js?v=5.8.0';
import {createAquaFreshRail} from './aqua-fresh-pilot.js?v=5.8.0';
export async function mountProductVideos(region,{productId,fetcher=fetch}={}){
 if(!region)return;
 const token=Symbol('video-request'),language=locale();region.productVideoRequest=token;
 try{
  const response=await fetcher('/api/product-videos?product='+encodeURIComponent(productId),{cache:'no-store'});if(!response.ok)return;
  const data=await response.json();if(!region.isConnected||region.productVideoRequest!==token||locale()!==language)return;
  const videos=(data.videos||[]).filter(v=>validProductVideo(v)&&v.productId===productId).slice(0,3).map(v=>({...v,title:language==='en'?v.titleEn||v.title:v.title}));
  const rail=region.aquaFreshRail||createAquaFreshRail(region,{product:{id:productId,name:''}});rail?.setVideos(videos);
 }catch{/* Optional media never blocks product information or checkout. */}
}
