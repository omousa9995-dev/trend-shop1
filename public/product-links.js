export const STORE_ORIGIN='https://trendjo.pages.dev';
const validId=/^TS[A-Z0-9-]{4,64}$/;
export function productPath(id){if(!validId.test(id))throw new Error('Invalid product');return '/p/'+encodeURIComponent(id)}
export function productUrl(id){return STORE_ORIGIN+productPath(id)}
export function productIdFromPath(path){try{const match=decodeURIComponent(path).match(/^\/p\/(TS[A-Z0-9-]{4,64})\/?$/);return match?.[1]||null}catch{return null}}
export function parseStoreRoute(location){
 const id=productIdFromPath(location.pathname||'/');
 const raw=location.hash?.startsWith('#/')?location.hash.slice(1):id?'/product/'+encodeURIComponent(id):'/';
 const split=raw.indexOf('?');return {path:split<0?raw:raw.slice(0,split),query:new URLSearchParams(split<0?'':raw.slice(split+1))};
}
