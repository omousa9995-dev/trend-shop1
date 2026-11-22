const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hosts=new Set(['www.cosrx.com','cosrx.com','b2c.cosrx.com','anua.com','www.anua.com','beautyofjoseon.com','www.beautyofjoseon.com','www.maybelline.com','www.esteelauder.com','www.theordinary.com','theordinary.com','www.dr-althea.com','dr-althea.com','skin1004.com','www.skin1004.com','medicube.us','www.medicube.us','global.oliveyoung.com']);
export function validGlobalRating(r,now=Date.now()){
 if(!r||!Number.isFinite(r.rating)||r.rating<1||r.rating>5||!Number.isInteger(r.count)||r.count<1||!r.publisher||!r.productName)return false;
 try{const u=new URL(r.url);if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.username||u.password)return false}catch{return false}
 const date=Date.parse(r.checkedAt);return Number.isFinite(date)&&date<=now+86400000&&now-date<=90*86400000;
}
export function globalRatingHtml(r,{language='ar',now=Date.now()}={}){
 if(!validGlobalRating(r,now))return '';const en=language==='en',date=new Date(r.checkedAt).toLocaleDateString(en?'en-GB':'ar-JO',{timeZone:'Asia/Amman'});
 return `<aside class="global-product-rating" data-global-rating data-no-translate><h3>${en?'Product rating at the brand’s official store':'تقييم المنتج لدى موقع الماركة'}</h3><p><span aria-hidden="true" class="global-rating-stars" style="--rating-fill:${r.rating*20}%">★★★★★</span> <strong>${escape(r.rating)} / 5</strong> · ${escape(r.count.toLocaleString(en?'en-GB':'ar-JO'))} ${en?'ratings':'تقييم'}</p><p class="global-rating-source">${en?'Source':'المصدر'}: ${escape(r.publisher)}</p><small>${en?'Checked':'تم التحقق'}: ${escape(date)}. ${en?'These are external ratings for this product, potentially across pack sizes; they are separate from Trend purchases and do not rate Trend’s stock or service.':'تقييمات خارجية للمنتج قد تشمل أحجامًا مختلفة؛ منفصلة عن مشتريات Trend ولا تقيّم عبوات المتجر أو خدمته.'}</small></aside>`;
}
let loaded;
export function loadGlobalRatings(fetcher=fetch){if(!loaded)loaded=fetcher('/global-product-ratings.json?v=5.22.0').then(r=>r.ok?r.json():{}).catch(()=>{loaded=null;return {}});return loaded}
export async function mountGlobalRating(element,id,language='ar'){
 const data=await loadGlobalRatings();if(!element?.isConnected)return;element.innerHTML=globalRatingHtml(data.products?.[id],{language});element.hidden=!element.innerHTML;
}
