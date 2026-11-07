import {quoteCart,productPrice,promotionData,shippingFee} from './commerce.js?v=5.0.0';
import {productOptions,selectedOption,cartSelectionError,aggregateCart} from './product-variants.js?v=5.8.0';
import {isRetiredProduct} from './catalog-policy.js';
import {productDetails} from './shop-tools.js';
import {pairPriceFils,quantityPriceFils} from './pair-pricing.js?v=5.0.0';

export const isBundleId=id=>typeof id==='string'&&/^PROMO[A-Z0-9-]{6,64}$/.test(id);
const productId=id=>typeof id==='string'&&/^TS[A-Z0-9-]{4,64}$/.test(id);
export const bundleHref=id=>'#/bundle/'+encodeURIComponent(id);
export function bundleData(id,promotions=[]){return promotions.map(promotionData).find(p=>p?.id===id&&p.active)||null}
export function bundleImage(offer,products=[]){
 const byId=new Map(products.map(p=>[p.id,p]));
 return /^\/(?:images|media)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|svg)$/.test(offer?.image||'')&&offer.items?.every(x=>!offer.primaries||offer.primaries[x.id]===(byId.get(x.id)?.image||byId.get(x.id)?.image_url))?offer.image:'';
}
export function bundleProduct(raw,products=[]){
 const offer=promotionData(raw),byId=new Map(products.map(p=>[p.id,p]));
 if(!isBundleId(offer?.id)||!offer.active||!Array.isArray(offer.items)||!offer.items.length||offer.items.length>6||!Number.isInteger(offer.priceFils)||offer.priceFils<500||new Set(offer.items.map(x=>x.id)).size!==offer.items.length||offer.items.some(x=>!productId(x.id)||isRetiredProduct(x.id)||!Number.isInteger(x.qty)||x.qty<1||x.qty>10||!byId.has(x.id)))return null;
 const members=offer.items.map(x=>({...x,product:byId.get(x.id)})),before=members.reduce((n,x)=>n+productPrice(x.product)*x.qty,0);
 if(offer.priceFils>=before)return null;
 const active=members.every(x=>x.product.active!==0&&x.product.active!==false&&x.product.approved!==0&&x.product.approved!==false);
 const stock=active?Math.max(0,Math.min(...members.map(x=>Math.floor(Number(x.product.stock||0)/x.qty)))):0;
 const image=bundleImage(offer,products)||members[0].product.image||members[0].product.image_url;
 return {id:offer.id,_bundle:offer,...(members.every(x=>Number.isInteger(x.product.automaticPairPriceFils))?{automaticPairPriceFils:pairPriceFils(offer.priceFils)}:{}),name:offer.title,brand:'TREND SHOP',category:members[0].product.category,description:offer.description,image,image_url:image,priceFils:offer.priceFils,reference:before,discount:Math.floor((before-offer.priceFils)*100/before),stock,approved:active,details:{nameAr:offer.title,tagline:'اختيارات تنسجم معكِ، في باكيج واحد.',benefits:['اختيارات متكاملة بسعر ألطف','تفاصيل تحبّينها في باكيج واحد','لكِ، أو هدية لمن تحبّين'],howToUse:offer.notes||'استخدمي كل منتج بحسب تعليمات عبوته، كخطوة مستقلة في روتينكِ.',notes:offer.notes||'',en:{name:offer.en?.title||offer.title,description:offer.en?.description||offer.description,tagline:'Your favourites, beautifully together.',benefits:['Thoughtfully paired at a gentler price','Your favourites, together in one bundle','For you, or someone you love'],howToUse:offer.en?.notes||'Use each product separately, following its own pack directions.',notes:offer.en?.notes||''}}};
}
export function purchaseProductIds(cart,promotions){
 const ids=new Set();
 for(const item of cart){
  if(isBundleId(item.id)){const offer=bundleData(item.id,promotions);if(!offer?.items?.length)throw Error('BUNDLE_UNAVAILABLE');for(const x of offer.items){if(!productId(x.id))throw Error('BUNDLE_UNAVAILABLE');ids.add(x.id)}}
  else if(productId(item.id))ids.add(item.id);else throw Error('INVALID_CART');
 }
 return [...ids];
}
export function expandPurchaseCart(cart,products,promotions){
 return cart.flatMap(item=>{
  if(!isBundleId(item.id))return [{id:item.id,qty:item.qty,variant:item.variant||''}];
  const offer=bundleData(item.id,promotions),p=bundleProduct(offer,products);if(!p)throw Error('BUNDLE_UNAVAILABLE');
  return offer.items.map(x=>({id:x.id,qty:x.qty*item.qty,variant:item.options?.[x.id]||''}));
 });
}
export function purchaseCartError(cart,products,promotions,{checkStock=true}={}){
 try{
  if(!Array.isArray(cart)||!cart.length||cart.length>20)return 'السلة غير صالحة';
  const seen=new Set();
  for(const item of cart){
   if(!item||!Number.isInteger(item.qty)||item.qty<1||item.qty>10)return 'الكمية المطلوبة غير متاحة؛ راجعي السلة.';
   const key=item.id+'~'+(item.variant||'');if(seen.has(key))return 'محتويات السلة مكررة؛ حدّثي الكمية من السلة.';seen.add(key);
   if(isBundleId(item.id)){
    const offer=bundleData(item.id,promotions);if(!bundleProduct(offer,products))return 'تغيّر أحد الباكجات؛ راجعي السلة قبل التأكيد.';
    if(item.variant)return 'اختيارات الباكج غير صالحة';
    if(item.options&&(!item.options||typeof item.options!=='object'||Array.isArray(item.options)||Object.keys(item.options).some(id=>!offer.items.some(x=>x.id===id))))return 'اختيارات الباكج غير صالحة';
   }
  }
  const expanded=expandPurchaseCart(cart,products,promotions),merged=[];
  for(const x of expanded){const existing=merged.find(y=>y.id===x.id&&y.variant===x.variant);if(existing)existing.qty+=x.qty;else merged.push({...x})}
  const error=cartSelectionError(merged,products);if(error)return error;
  const byId=new Map(products.map(p=>[p.id,p]));
  if(aggregateCart(merged).some(x=>{const p=byId.get(x.id);return !p||isRetiredProduct(x.id)||p.active===0||p.active===false||p.approved===0||p.approved===false||checkStock&&Number(p.stock)<x.qty}))return 'تغيّر المخزون أو توفر أحد المنتجات؛ راجعي السلة.';
  return '';
 }catch{return 'تغيّر أحد الباكجات؛ راجعي السلة قبل التأكيد.'}
}

// Integer allocation keeps every line total and the receipt total identical.
function allocate(amount,weights){
 const total=weights.reduce((a,b)=>a+b,0);if(!total)return weights.map(()=>0);
 const rows=weights.map((w,i)=>({i,n:Math.floor(amount*w/total),remainder:amount*w%total}));
 let left=amount-rows.reduce((n,x)=>n+x.n,0);for(const row of [...rows].sort((a,b)=>b.remainder-a.remainder||a.i-b.i)){if(!left--)break;row.n++}
 return rows.map(x=>x.n);
}
export function quotePurchase(cart,products,promotions=[],language='ar'){
 const singles=cart.filter(x=>!isBundleId(x.id)),byId=new Map(products.map(p=>[p.id,p]));
 const unavailable=id=>({id,name:language==='en'?'This selection is currently unavailable':'هذا الاختيار غير متاح حاليًا',brand:'TREND SHOP',image:'/images/TS0001.svg',stock:0,approved:false,priceFils:0});
 const bundles=cart.filter(x=>isBundleId(x.id)).map(item=>({item,offer:bundleData(item.id,promotions)})).filter(x=>bundleProduct(x.offer,products));
 const fixed=bundles.reduce((n,{item,offer})=>n+quantityPriceFils(bundleProduct(offer,products),item.qty),0),ordinary=quoteCart(singles,products,promotions,{fixedSubtotalFils:fixed});
 if(language==='en')ordinary.promotions=ordinary.promotions.map(p=>p.id.startsWith('AUTOPAIR-')?{...p,title:'Pair price'}:p);
 const lines=singles.map(item=>{const p=byId.get(item.id)||unavailable(item.id),d=productDetails(p),price=productPrice(p),reference=Math.max(price,Number(p?.reference??p?.reference_price_fils??price));return {...item,kind:'product',product:p,name:language==='en'?(d.en?.name||p?.name):d.nameAr||p?.name,image:p?.image||p?.image_url,lineTotalFils:price*item.qty,originalTotalFils:reference*item.qty,offerSavingFils:0}});
 const remaining=singles.map(x=>x.qty);
 for(const offer of ordinary.promotions){
  const weights=singles.map(()=>0);
  for(const member of offer.items){let needed=member.qty*offer.count;for(let i=0;i<singles.length&&needed;i++){if(singles[i].id!==member.id)continue;const used=Math.min(needed,remaining[i]);remaining[i]-=used;needed-=used;weights[i]+=productPrice(byId.get(member.id))*used}}
  const savings=allocate(offer.savingFils,weights);lines.forEach((line,i)=>{line.lineTotalFils-=savings[i];line.offerSavingFils+=savings[i]});
 }
 let bundleOriginal=0,bundleSavings=0;
 const explicit=[];
 for(const {item,offer} of bundles){
  const p=bundleProduct(offer,products),original=p.reference*item.qty,total=quantityPriceFils(p,item.qty);bundleOriginal+=original;bundleSavings+=original-total;
  lines.push({...item,kind:'bundle',product:p,name:language==='en'?offer.en?.title||offer.title:offer.title,image:p.image,lineTotalFils:total,originalTotalFils:original,offerSavingFils:original-total});
  explicit.push({id:offer.id,title:offer.title,priceFils:offer.priceFils,items:offer.items,count:item.qty,savingFils:original-total,explicit:true});
 }
 for(const item of cart.filter(x=>isBundleId(x.id)&&!bundles.some(b=>b.item===x))){const p={...unavailable(item.id),_bundle:{items:[]}};lines.push({...item,kind:'bundle',product:p,name:p.name,image:p.image,lineTotalFils:0,originalTotalFils:0,offerSavingFils:0,unavailable:true})}
 for(const line of lines)line.savingFils=Math.max(0,line.originalTotalFils-line.lineTotalFils);
 const subtotalFils=ordinary.subtotalFils+fixed,shippingFeeFils=shippingFee(subtotalFils);
 return {itemsSubtotalFils:ordinary.itemsSubtotalFils+bundleOriginal,discountFils:ordinary.discountFils+bundleSavings,subtotalFils,shippingFeeFils,totalFils:subtotalFils+shippingFeeFils,promotions:[...ordinary.promotions,...explicit],lines};
}
export function purchaseSnapshot(quote,expanded,products){
 const byId=new Map(products.map(p=>[p.id,p]));
 const rows=quote.lines.map(line=>{
  const variants=line.kind==='bundle'?(line.product._bundle.items||[]).flatMap(x=>{const p=byId.get(x.id),option=selectedOption(p,line.options?.[x.id]);return option?[{label:p.name+' — '+option.label,qty:x.qty*line.qty}]:[]}):(()=>{const option=selectedOption(line.product,line.variant);return option?[{label:option.label,qty:line.qty}]:[]})();
  return {product_id:line.id,kind:line.kind,name_snapshot:line.name,image_snapshot:line.image,qty:line.qty,unit_price_fils:line.lineTotalFils/line.qty,line_total_fils:line.lineTotalFils,saving_fils:line.savingFils,options_snapshot:JSON.stringify(variants)};
 });
 const grouped=[];for(const row of rows){const old=row.kind==='product'?grouped.find(x=>x.product_id===row.product_id):null;if(old){old.qty+=row.qty;old.line_total_fils+=row.line_total_fils;old.saving_fils+=row.saving_fils;old.unit_price_fils=old.line_total_fils/old.qty;old.options_snapshot=JSON.stringify([...JSON.parse(old.options_snapshot),...JSON.parse(row.options_snapshot)])}else grouped.push(row)}return grouped;
}
