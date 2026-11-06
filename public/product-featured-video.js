import {mountSilentVideo} from './silent-video.js?v=5.4.0';
import {isRetiredProduct} from './catalog-policy.js';
import {tx} from './i18n.js?v=5.1.0';

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export async function mountFeaturedVideo(region,{productId,fetcher=fetch}={}){
 if(!region||!/^TS[A-Z0-9-]{4,64}$/.test(productId||'')||isRetiredProduct(productId))return null;
 region.featuredVideo?.destroy();
 region.hidden=true;region.replaceChildren();
 const controller=new AbortController();let player=null,destroyed=false;
 const timeout=setTimeout(()=>controller.abort(),8000);
 const lifecycle={destroy(){destroyed=true;clearTimeout(timeout);controller.abort();player?.destroy();region.replaceChildren();region.hidden=true;}};
 region.featuredVideo=lifecycle;
 try{
  const response=await fetcher('/api/product-feature-video?product='+productId,{cache:'no-store',signal:controller.signal});
  if(!response.ok)return lifecycle;
  const data=(await response.json()).video;
  if(destroyed||!region.isConnected||!data||data.productId!==productId||!ID.test(data.id)||data.url!=='/product-feature-videos/'+data.id||!['video/mp4','video/quicktime','video/webm'].includes(data.mime))return lifecycle;
  region.hidden=false;player=mountSilentVideo(region,{...data,label:tx('فيديو المنتج','Product video')});
  player.video.addEventListener('error',()=>{region.hidden=true;},{once:true});
 }catch{/* Optional video never blocks the product or purchase buttons. */}
 finally{clearTimeout(timeout);}
 return lifecycle;
}
