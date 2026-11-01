// A request deadline never changes the idempotency key or resubmits an order automatically.
export async function requestWithDeadline(fetcher,url,options={},timeoutMs=18000,clock=globalThis){
 const controller=new AbortController();let timer;
 const deadline=new Promise((_,reject)=>{timer=clock.setTimeout(()=>{controller.abort();const e=new Error('REQUEST_TIMEOUT');e.code='REQUEST_TIMEOUT';reject(e)},timeoutMs)});
 try{return await Promise.race([fetcher(url,{...options,signal:controller.signal}),deadline])}finally{clock.clearTimeout(timer)}
}
export function newCheckoutKey(cryptoApi=globalThis.crypto){if(cryptoApi.randomUUID)return cryptoApi.randomUUID();const bytes=new Uint8Array(20);cryptoApi.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
export const pendingCheckoutStorage='trend-shop-pending-checkout-v3';
export function readPendingCheckout(storage,now=Date.now()){
 try{const value=JSON.parse(storage.getItem(pendingCheckoutStorage)||'null');if(value&&/^[a-zA-Z0-9-]{20,90}$/.test(value.key)&&Number.isFinite(value.at)&&now-value.at>=0&&now-value.at<86400000)return {key:value.key,at:value.at}}catch{}return null;
}
export function savePendingCheckout(storage,value){try{if(value)storage.setItem(pendingCheckoutStorage,JSON.stringify({key:value.key,at:value.at}));else storage.removeItem(pendingCheckoutStorage)}catch{}}
