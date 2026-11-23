export const STORE_ORIGIN='https://trendjo.pages.dev';
const validId=/^TS[A-Z0-9-]{4,64}$/;
export function productPath(id){if(!validId.test(id))throw new Error('Invalid product');return '/product/'+encodeURIComponent(id)}
export function productUrl(id,language='ar'){return STORE_ORIGIN+productPath(id)+(language==='en'?'?lang=en':'')}
export function productIdFromPath(path){try{const match=decodeURIComponent(path).match(/^\/(?:product|p)\/(TS[A-Z0-9-]{4,64})\/?$/);return match?.[1]||null}catch{return null}}
export function parseStoreRoute(location){
 const id=productIdFromPath(location.pathname||'/');
 const raw=location.hash?.startsWith('#/')?location.hash.slice(1):id?'/product/'+encodeURIComponent(id):(location.pathname?.startsWith('/collections/')?location.pathname:'/');
 const split=raw.indexOf('?');return {path:split<0?raw:raw.slice(0,split),query:new URLSearchParams(split<0?(location.search||''):raw.slice(split+1))};
}
// Fragment routes are still accepted for bookmarked links. Fragments are never
// sent to the server, so their migration must happen in the browser.
export function canonicalizeStoreLocation(view=window){
 const hash=view.location.hash||'',legacy=hash.match(/^#\/product\/(TS[A-Z0-9-]{4,64})(\?.*)?$/);
 if(legacy){const params=new URLSearchParams(view.location.search);for(const [k,v]of new URLSearchParams((legacy[2]||'').slice(1)))params.set(k,v);view.history.replaceState(view.history.state,'',productPath(legacy[1])+(params.size?'?'+params:''));}
 else if(hash.startsWith('#/')&&view.location.pathname!=='/')view.history.replaceState(view.history.state,'','/'+view.location.search+hash);
}
export function installProductNavigation(onNavigate,view=window){
 canonicalizeStoreLocation(view);
 let lastLocation=view.location.href;
 const click=event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.hasAttribute('download')||anchor.target&&anchor.target!=='_self')return;
  let url;try{url=new URL(anchor.href,view.location.href)}catch{return}if(url.origin!==view.location.origin)return;
  // Section links on clean collection/product URLs must keep the current DOM.
  if(url.hash&&!url.hash.startsWith('#/')&&url.pathname===view.location.pathname&&url.search===view.location.search){
   let id;try{id=decodeURIComponent(url.hash.slice(1))}catch{return}
   const section=view.document.getElementById(id);if(!section)return;
   event.preventDefault();section.scrollIntoView({block:'start',behavior:view.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;
  }
  const homeLink=anchor.hasAttribute('data-store-home');
  // Direct product responses omit Luma. Follow the home link as a document
  // navigation so the homepage can restore its full header and footer.
  if(homeLink&&productIdFromPath(view.location.pathname)&&!view.document.querySelector('[data-care-region]'))return;
  if(homeLink&&parseStoreRoute(view.location).path==='/'){
   event.preventDefault();
   view.scrollTo({top:0,left:0,behavior:'instant'});
   return;
  }
  const product=productIdFromPath(url.pathname),collection=url.pathname.startsWith('/collections/'),hash=url.hash.startsWith('#/');
  if(!product&&!collection&&!hash)return;
  event.preventDefault();
  const target=product&&!hash?productPath(product)+url.search:collection&&!hash?url.pathname+url.search:'/'+url.search+url.hash;
  view.history.pushState(null,'',target);canonicalizeStoreLocation(view);lastLocation=view.location.href;onNavigate({history:'push',...(homeLink?{resetPosition:true}:{})});
 };
 const pop=()=>{canonicalizeStoreLocation(view);if(lastLocation===view.location.href)return;lastLocation=view.location.href;onNavigate({history:'pop'})};
 view.document.addEventListener('click',click);view.addEventListener('popstate',pop);view.addEventListener('hashchange',pop);
 return()=>{view.document.removeEventListener('click',click);view.removeEventListener('popstate',pop);view.removeEventListener('hashchange',pop)};
}
