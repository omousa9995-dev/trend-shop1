import {tx} from './i18n.js?v=5.1.0';

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export async function mountFeaturedVideo(region,{productId,fetcher=fetch}={}){
 if(!region||productId!=='TS0098')return null;
 region.featuredVideo?.destroy();
 region.hidden=true;region.replaceChildren();
 const controller=new AbortController();let video=null,destroyed=false;
 const timeout=setTimeout(()=>controller.abort(),8000);
 const lifecycle={destroy(){destroyed=true;clearTimeout(timeout);controller.abort();if(video){video.pause();video.removeAttribute('src');video.load();}region.replaceChildren();region.hidden=true;}};
 region.featuredVideo=lifecycle;
 try{
  const response=await fetcher('/api/product-feature-video?product='+productId,{cache:'no-store',signal:controller.signal});
  if(!response.ok)return lifecycle;
  const data=(await response.json()).video;
  if(destroyed||!region.isConnected||!data||data.productId!==productId||!ID.test(data.id)||data.url!=='/product-feature-videos/'+data.id||!['video/mp4','video/quicktime','video/webm'].includes(data.mime))return lifecycle;
  video=region.ownerDocument.createElement('video');
  video.width=540;video.height=960;video.autoplay=true;video.loop=true;video.defaultMuted=true;video.muted=true;video.playsInline=true;video.controls=false;video.preload='metadata';video.tabIndex=-1;
  video.setAttribute('autoplay','');video.setAttribute('loop','');video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.setAttribute('disablepictureinpicture','');video.disablePictureInPicture=true;video.disableRemotePlayback=true;video.setAttribute('disableremoteplayback','');video.setAttribute('controlslist','nodownload nofullscreen noremoteplayback noplaybackrate');
  video.setAttribute('aria-label',tx('فيديو أرينسيا','Arencia product video'));
  region.oncontextmenu=event=>event.preventDefault();
  video.addEventListener('error',()=>{region.hidden=true;},{once:true});
  video.src=data.url;region.append(video);region.hidden=false;
  video.play()?.catch(()=>{/* Autoplay remains subject to the customer's browser settings. */});
 }catch{/* Optional video never blocks the product or purchase buttons. */}
 finally{clearTimeout(timeout);}
 return lifecycle;
}
