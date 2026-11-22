import {productUrl,STORE_ORIGIN} from './product-links.js';
import {storefrontProduct} from './catalog-policy.js';

export const detailsOf=p=>{try{return p.details||JSON.parse(p.details_json||'{}')}catch{return {}}};
export const productName=(p,lang='ar')=>{const d=detailsOf(p);return lang==='en'?d.en?.name||p.name:d.nameAr||p.name};
export const priceOf=p=>Number(p.price_fils??p.priceFils??0);
export const priceText=p=>(priceOf(p)/1000).toFixed(2);
export function publicImage(p){try{const u=new URL(p.image_url||p.image,STORE_ORIGIN);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href}catch{}return STORE_ORIGIN+'/images/editorial/beauty-hero-v2.webp'}
export function productStructuredData(raw,language='ar',summary=null){
 const p=storefrontProduct(raw),d=detailsOf(p),data={'@context':'https://schema.org','@type':'Product','@id':productUrl(p.id)+'#product',name:productName(p,language),description:language==='en'?(d.en?.description||p.description||d.tagline||''):(p.description||d.tagline||''),image:[publicImage(p)],sku:p.id,brand:{'@type':'Brand',name:p.brand||'Trend Shop'},url:productUrl(p.id,language)};
 if(priceOf(p)>0){
  data.offers={'@type':'Offer',url:productUrl(p.id,language),price:priceText(p),priceCurrency:'JOD',availability:'https://schema.org/'+(Number(p.stock)>0?'InStock':'OutOfStock'),itemCondition:'https://schema.org/NewCondition',seller:{'@type':'Organization',name:'Trend Shop',url:STORE_ORIGIN+'/'}};
  if(p.limitedOffer?.endsAt)data.offers.priceValidUntil=new Date(p.limitedOffer.endsAt*1000).toISOString().slice(0,10);
  data.offers.shippingDetails={'@type':'OfferShippingDetails',shippingDestination:{'@type':'DefinedRegion',addressCountry:'JO'},shippingRate:{'@type':'MonetaryAmount',currency:'JOD',value:priceOf(p)>19000?'0.00':'1.00'}};
 }
 if(summary?.count>0&&summary.average>=1&&summary.average<=5)data.aggregateRating={'@type':'AggregateRating',ratingValue:Number(summary.average.toFixed(1)),reviewCount:summary.count,bestRating:5,worstRating:1};
 return data;
}
// Keep the selected page's data present after hydration and client navigation.
export function syncStructuredData(document,data){
 const existing=[...document.querySelectorAll('[data-store-seo]')];
 if(!data){existing.forEach(node=>node.remove());return;}
 const script=existing.shift()||document.createElement('script');
 existing.forEach(node=>node.remove());
 script.type='application/ld+json';script.dataset.storeSeo='';
 script.textContent=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 if(!script.isConnected)document.head.append(script);
}
