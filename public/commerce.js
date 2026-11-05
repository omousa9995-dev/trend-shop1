import {productType} from './product-types.js';
import {isRetiredProduct} from './catalog-policy.js';
import {planPromotions} from './promotion-planner.js';
// Shared, deterministic rules used by the storefront and the order server.
export const FREE_DELIVERY_ABOVE_FILS = 19000;
export const DELIVERY_FILS = 1000;
export const money = value => `${(Number(value || 0) / 1000).toFixed(2)} د.أ`;
export const productPrice = p => Number(p?.priceFils ?? p?.price_fils ?? 0);
export function shippingFee(subtotalFils) {
  return Number.isInteger(subtotalFils) && subtotalFils > FREE_DELIVERY_ABOVE_FILS ? 0 : DELIVERY_FILS;
}
export function shippingMessage(subtotalFils) {
  return shippingFee(subtotalFils) === 0 ? 'التوصيل مجاني لطلبكِ ♡' : 'التوصيل 1 دينار لكل الأردن، ومجاني للطلبات فوق 19 دينارًا بعد الخصم.';
}
export function retailPrice(value, maximum = 20000) {
  const raw = Math.max(500, Math.min(maximum, Number(value) || 500));
  const candidates = new Set([500, 750].filter(n=>n<=maximum));
  for (let whole = Math.max(0, Math.floor(raw / 1000) - 1); whole <= Math.ceil(raw / 1000) + 1; whole++) {
    for (const tail of [0, 490, 500, 990]) {const n=whole*1000+tail;if(n>=500&&n<=maximum)candidates.add(n);}
  }
  return [...candidates].sort((a,b)=>Math.abs(a-raw)-Math.abs(b-raw)||a-b)[0];
}
export function actualDiscount(reference, price) {
  return reference > price && reference > 0 ? Math.floor((reference-price)*100/reference + 1e-8) : 0;
}
export function thumbnailFor(product, thumbnails = {}) {
  const primary = product.image || product.image_url, reviewed = thumbnails[product.id];
  return reviewed?.primary === primary ? reviewed.thumbnail : primary;
}
export function largeImageFor(product, image, thumbnails = {}) {
  const primary=product.image||product.image_url,reviewed=thumbnails[product.id];
  return image===primary&&reviewed?.primary===primary ? reviewed.highResolution||image : image;
}
export function promotionData(p) {
  try {const data=typeof p.config_json==='string'?JSON.parse(p.config_json):p;return {...data,id:p.id,kind:p.kind||data.kind,title:p.title||data.title,description:p.description||data.description||'',active:p.active!==0&&p.active!==false};} catch{return null;}
}
// Compatible bundles combine automatically; the same units are never reused.
export function quoteCart(cart, products, promotions = [], {fixedSubtotalFils=0}={}) {
  const byId=new Map(products.map(p=>[p.id,p])),available=new Map();for(const item of cart)available.set(item.id,(available.get(item.id)||0)+item.qty);
  const itemsSubtotalFils=cart.reduce((n,x)=>n+productPrice(byId.get(x.id))*x.qty,0);
  const eligible=[];
  for(const raw of promotions){
    const p=promotionData(raw);if(!p?.active||!Array.isArray(p.items)||!p.items.length||!Number.isInteger(p.priceFils))continue;
    if(new Set(p.items.map(x=>x.id)).size!==p.items.length||p.items.some(x=>!Number.isInteger(x.qty)||x.qty<1||!byId.has(x.id)))continue;
    const count=Math.min(...p.items.map(x=>Math.floor((available.get(x.id)||0)/x.qty)));
    const before=p.items.reduce((n,x)=>n+productPrice(byId.get(x.id))*x.qty,0);
    if(count<1||p.priceFils<500||p.priceFils>=before)continue;
    eligible.push({id:p.id,title:p.title,priceFils:p.priceFils,items:p.items,saving:before-p.priceFils});
  }
  const {discountFils,promotions:applied}=planPromotions(available,eligible,itemsSubtotalFils+fixedSubtotalFils,shippingFee);
  const subtotalFils=itemsSubtotalFils-discountFils,shippingFeeFils=shippingFee(subtotalFils);
  return {itemsSubtotalFils,discountFils,subtotalFils,shippingFeeFils,totalFils:subtotalFils+shippingFeeFils,promotions:applied};
}
export function deliveryNudge(quote) {
  return quote.shippingFeeFils>0&&quote.totalFils>15000 ? {remainingFils:FREE_DELIVERY_ABOVE_FILS+10-quote.subtotalFils} : null;
}
const pairs={
 foundation:['concealer','mascara','powder','primer','blush'],concealer:['foundation','mascara','powder','blush'],powder:['concealer','foundation','mascara','primer'],primer:['foundation','concealer','powder','mascara'],
 mascara:['eyeliner','lips','eyeshadow','concealer'],eyeliner:['mascara','eyeshadow','lips'],eyeshadow:['mascara','eyeliner','lips'],lips:['mascara','blush','brows'],blush:['highlighter','lips','mascara'],contour:['blush','highlighter','powder'],highlighter:['blush','lips','mascara'],brows:['mascara','concealer','eyeliner'],'bb-cc':['concealer','mascara','powder'],
 'skincare-set':['sunscreen','moisturizer','cleanser'],'setting-spray':['foundation','mascara','lips'],sunscreen:['moisturizer','cleanser','lips'],cleanser:['moisturizer','sunscreen','toner'],toner:['moisturizer','sunscreen','cleanser'],serum:['moisturizer','sunscreen','cleanser'],essence:['moisturizer','sunscreen','cleanser'],moisturizer:['sunscreen','cleanser','toner'],exfoliant:['moisturizer','sunscreen','cleanser'],'eye-care':['moisturizer','sunscreen','cleanser'],'face-mask':['moisturizer','cleanser','sunscreen'],'face-oil':['moisturizer','cleanser','sunscreen'],mist:['moisturizer','sunscreen','cleanser'],
 'hair-tools':['hair-mask','conditioner','shampoo'],shampoo:['conditioner','hair-mask','hair-oil'],conditioner:['shampoo','hair-mask','hair-oil'],'hair-mask':['shampoo','conditioner','hair-oil'],'hair-oil':['shampoo','hair-mask','conditioner'],'hair-styling':['shampoo','hair-oil','conditioner'],'hair-treatment':['shampoo','hair-oil','conditioner'],
 'body-care':['body-cleansing','body-oil','body-sunscreen'],deodorant:['body-cleansing','body-care'],'body-oil':['body-care','body-cleansing'],'body-cleansing':['body-care','body-oil'],'body-sunscreen':['body-care','body-cleansing']
};
const reasons={concealer:'لتكميل تغطية الإطلالة',mascara:'لمسة للرموش تكمل المكياج',powder:'لمسة نهائية لإطلالتكِ',primer:'خطوة تسبق كريم الأساس',foundation:'قاعدة لإطلالتكِ',eyeliner:'تفاصيل تُبرز إطلالة العين',eyeshadow:'ألوان تنسجم مع مكياج العين',lips:'لمسة لون للشفاه',blush:'لمسة لون للخدود',highlighter:'لمسة إضاءة للمكياج',sunscreen:'خيار لروتين النهار',moisturizer:'خطوة ترطيب لروتينكِ',cleanser:'بداية روتين التنظيف',toner:'اختيار آخر لروتين العناية',shampoo:'لإكمال خطوات غسل الشعر',conditioner:'خطوة عناية بعد الشامبو','hair-mask':'لتفحّص عناية إضافية للشعر','hair-oil':'لمسة عناية لخصلاتكِ'};
export function recommendations(products, cart, {promotions=[],anchorId,limit=3,deliveryGoal=false}={}) {
  const ids=new Set(cart.map(x=>x.id)),anchor=products.find(p=>p.id===anchorId)||products.find(p=>p.id===cart.at(-1)?.id);
  if(!anchor||isRetiredProduct(anchor))return [];
  const anchorType=productType(anchor),wanted=pairs[anchorType]||[],quote=quoteCart(cart,products,promotions),nudge=deliveryNudge(quote),steps=new Set(cart.map(x=>products.find(p=>p.id===x.id)).filter(Boolean).map(productType));
  const candidates=products.filter(p=>!ids.has(p.id)&&!isRetiredProduct(p)&&p.active!==0&&p.active!==false&&p.approved!==false&&p.approved!==0&&Number(p.stock)>0&&productPrice(p)>0).map(p=>{
    const type=productType(p),rank=wanted.indexOf(type),next=quoteCart([...cart,{id:p.id,qty:1}],products,promotions);
    const related=rank>=0?160-rank*16:p.category===anchor.category?20:0;
    const unlocksFreeDelivery=!!nudge&&next.shippingFeeFils===0;
    const fit=deliveryGoal&&nudge?(unlocksFreeDelivery?75-Math.min(45,Math.max(0,productPrice(p)-nudge.remainingFils)/150):Math.min(10,productPrice(p)/1000)):0;
    const sameBrand=String(p.brand||'').toLowerCase()===String(anchor.brand||'').toLowerCase()&&p.brand?5:0;
    return {product:p,type,unlocksFreeDelivery,totalFils:next.totalFils,reason:reasons[type]||'اختيار يكمل مجموعتكِ',score:related+fit+sameBrand-(steps.has(type)?90:0),related};
  }).filter(x=>x.related>0).sort((a,b)=>b.score-a.score||productPrice(a.product)-productPrice(b.product)||a.product.id.localeCompare(b.product.id));
  // Show different complementary steps before more products of the same type.
  const result=[],types=new Set();for(const row of candidates){if(types.has(row.type))continue;types.add(row.type);result.push(row);if(result.length>=limit)return result}
  for(const row of candidates){if(!result.includes(row))result.push(row);if(result.length>=limit)break}return result;
}
