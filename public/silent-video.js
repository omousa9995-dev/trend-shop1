// Shared customer playback: no customer controls or enlarging wrapper.
export function mountSilentVideo(host,{url,mime,poster='',label=''}={}){
 const doc=host.ownerDocument,view=doc.defaultView,video=doc.createElement('video');
 video.width=540;video.height=960;video.autoplay=true;video.loop=true;video.defaultMuted=true;video.muted=true;video.playsInline=true;video.controls=false;video.preload='none';video.tabIndex=-1;
 for(const attr of ['autoplay','loop','muted','playsinline','webkit-playsinline','disablepictureinpicture','disableremoteplayback'])video.setAttribute(attr,'');
 video.disablePictureInPicture=true;video.disableRemotePlayback=true;video.setAttribute('controlslist','nodownload nofullscreen noremoteplayback noplaybackrate');video.setAttribute('aria-label',label);video.className='silent-product-video';
 if(poster)video.poster=poster;
 let observer,dead=false,near=false,loaded=false;
 const play=()=>{if(dead||!near||doc.hidden)return;if(!loaded){video.src=url;loaded=true;}video.muted=true;video.play()?.catch(()=>{});};
 const visibility=()=>{if(doc.hidden)video.pause();else play();};
 host.oncontextmenu=event=>event.preventDefault();host.append(video);
 const Observer=view?.IntersectionObserver||globalThis.IntersectionObserver;
 if(Observer){observer=new Observer(entries=>{for(const entry of entries){near=entry.isIntersecting;if(near)play();else video.pause();}},{rootMargin:'180px 0px',threshold:0});observer.observe(host);}
 else{near=true;play();}
 doc.addEventListener('visibilitychange',visibility);
 return {video,destroy(){if(dead)return;dead=true;observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);video.pause();video.removeAttribute('src');video.load();video.remove();}};
}
