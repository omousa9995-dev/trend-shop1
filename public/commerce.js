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
// One best eligible offer is applied automatically. Offers never stack or reuse units.
export function quoteCart(cart, products, promotions = []) {
  const byId=new Map(products.map(p=>[p.id,p])),available=new Map(cart.map(x=>[x.id,x.qty]));
  const itemsSubtotalFils=cart.reduce((n,x)=>n+productPrice(byId.get(x.id))*x.qty,0);
  let best=null,discountFils=0,bestTotal=itemsSubtotalFils+shippingFee(itemsSubtotalFils),bestShipping=shippingFee(itemsSubtotalFils);
  for(const raw of promotions){
    const p=promotionData(raw);if(!p?.active||!Array.isArray(p.items)||!p.items.length||!Number.isInteger(p.priceFils))continue;
    if(new Set(p.items.map(x=>x.id)).size!==p.items.length||p.items.some(x=>!Number.isInteger(x.qty)||x.qty<1||!byId.has(x.id)))continue;
    const count=Math.min(...p.items.map(x=>Math.floor((available.get(x.id)||0)/x.qty)));
    const before=p.items.reduce((n,x)=>n+productPrice(byId.get(x.id))*x.qty,0);
    if(count<1||p.priceFils<500||p.priceFils>=before)continue;
    for(let uses=1;uses<=count;uses++){const saving=(before-p.priceFils)*uses,subtotal=itemsSubtotalFils-saving,delivery=shippingFee(subtotal),total=subtotal+delivery;
    if(total<bestTotal||total===bestTotal&&delivery<bestShipping||total===bestTotal&&delivery===bestShipping&&saving>discountFils){discountFils=saving;bestTotal=total;bestShipping=delivery;best={id:p.id,title:p.title,count:uses,savingFils:saving,priceFils:p.priceFils,items:p.items};}}
  }
  const subtotalFils=itemsSubtotalFils-discountFils,shippingFeeFils=shippingFee(subtotalFils);
  return {itemsSubtotalFils,discountFils,subtotalFils,shippingFeeFils,totalFils:subtotalFils+shippingFeeFils,promotions:best?[best]:[]};
}
export function deliveryNudge(quote) {
  return quote.shippingFeeFils>0&&quote.totalFils>15000 ? {remainingFils:FREE_DELIVERY_ABOVE_FILS+10-quote.subtotalFils} : null;
}
function traits(product) {
  let d=product?.details;try{d ||= JSON.parse(product?.details_json||'{}')}catch{d={}}
  const text=`${d?.nameAr||''} ${product?.name||''} ${product?.subcategory||product?.subcat||''}`.toLowerCase().replace(/[أإآ]/g,'ا');
  if(product?.category==='الجسم')return 'bodycare';
  if(product?.category==='الشعر'&&!/shampoo|شامبو|hair mask|ماسك.*شعر|قناع.*شعر/.test(text))return 'haircare';
  const rules=[['foundation',/foundation|كريم\s+(?:ال)?اساس|فاونديشن/],['mascara',/mascara|مسكارا|ماسكارا/],['powder',/powder|بودرة|بودره/],['primer',/primer|برايمر/],['eyes',/eyeshadow|ظلال|باليت/],['lips',/lip|شفاه|شفايف|جلوس/],['sunscreen',/sunscreen|sun cream|sun serum|واقي.*شمس|ريليف صن/],['cleanser',/cleanser|cleansing|غسول/],['serum',/serum|سيروم/],['shampoo',/shampoo|شامبو/],['hairmask',/hair mask|ماسك.*شعر|قناع.*شعر/],['moisturizer',/moist|cream|مرطب|ترطيب|كريم/]];
  return rules.find(([,r])=>r.test(text))?.[0]||product?.category||'';
}
const pairs={bodycare:['bodycare','العطور'],haircare:['hairmask','shampoo','haircare'],'العطور':['bodycare'],foundation:['mascara','powder','primer','lips'],mascara:['eyes','lips','foundation'],powder:['foundation','mascara','primer'],primer:['foundation','powder','mascara'],eyes:['mascara','lips','foundation'],lips:['mascara','eyes','foundation'],moisturizer:['sunscreen','cleanser','serum'],cleanser:['moisturizer','sunscreen','serum'],serum:['moisturizer','sunscreen','cleanser'],sunscreen:['cleanser','moisturizer','serum'],shampoo:['hairmask','moisturizer'],hairmask:['shampoo']};
export function recommendations(products, cart, {promotions=[],anchorId,limit=3,deliveryGoal=false}={}) {
  const ids=new Set(cart.map(x=>x.id)),anchor=products.find(p=>p.id===anchorId)||products.find(p=>p.id===cart.at(-1)?.id);
  const wanted=pairs[traits(anchor)]||[],quote=quoteCart(cart,products,promotions),nudge=deliveryNudge(quote);
  return products.filter(p=>!ids.has(p.id)&&p.active!==0&&p.approved!==false&&p.approved!==0&&Number(p.stock)>0&&productPrice(p)>0).map(p=>{
    const type=traits(p),rank=wanted.indexOf(type),next=quoteCart([...cart,{id:p.id,qty:1}],products,promotions);
    const related=rank>=0?100-rank*12:p.category===anchor?.category?20:0;
    const unlocksFreeDelivery=!!nudge&&next.shippingFeeFils===0;
    const fit=deliveryGoal&&nudge?(unlocksFreeDelivery?120-Math.min(80,Math.max(0,productPrice(p)-nudge.remainingFils)/150):Math.min(20,productPrice(p)/1000)):0;
    return {product:p,unlocksFreeDelivery,totalFils:next.totalFils,score:related+fit};
  }).sort((a,b)=>b.score-a.score||productPrice(a.product)-productPrice(b.product)||a.product.id.localeCompare(b.product.id)).slice(0,limit);
}
