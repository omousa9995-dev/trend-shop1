// One price rule for cards, product pages, assistant suggestions and checkout.
export const offerNow=now=>Math.floor((now??Date.now())/1000);
export function limitedOfferActive(offer,now=Date.now()){
 const t=offerNow(now);return !!offer&&offer.active!==false&&offer.active!==0&&Number.isInteger(offer.startsAt)&&Number.isInteger(offer.endsAt)&&offer.startsAt<=t&&t<offer.endsAt;
}
export function applyLimitedOffers(products,offers=[],now=Date.now()){
 const active=new Map(offers.filter(o=>limitedOfferActive(o,now)).map(o=>[o.productId,o]));
 return products.map(p=>{
  const basePrice=p.basePriceFils??p.priceFils??p.price_fils??0,baseReference=p.baseReferencePriceFils??p.reference??p.reference_price_fils??0,baseDiscount=p.baseDiscountPercent??p.discount??p.discount_percent??0;
  const offer=active.get(p.id),available=p.active!==0&&p.active!==false&&p.approved!==0&&p.approved!==false&&Number(p.stock)>0;
  const valid=available&&offer&&Number.isInteger(offer.priceFils)&&offer.priceFils>=500&&offer.priceFils<basePrice;
  const price=valid?offer.priceFils:basePrice,reference=valid?basePrice:baseReference,discount=valid?Math.floor((basePrice-price)*100/basePrice+1e-8):baseDiscount;
  const next={...p,priceFils:price,price_fils:price,reference,reference_price_fils:reference,discount,discount_percent:discount,basePriceFils:basePrice,baseReferencePriceFils:baseReference,baseDiscountPercent:baseDiscount};
  if(valid)next.limitedOffer={slot:offer.slot,startsAt:offer.startsAt,endsAt:offer.endsAt,priceFils:price,originalPriceFils:basePrice};else delete next.limitedOffer;
  return next;
 });
}
export function countdown(endsAt,now=Date.now()){
 const total=Math.max(0,endsAt-offerNow(now)),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
 return {days,time:[hours,minutes,seconds].map(x=>String(x).padStart(2,'0')).join(':'),expired:total===0};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function limitedClockHtml(endsAt,{language='ar',now=Date.now()}={}){
 const en=language==='en',current=countdown(endsAt,now);
 const date=new Intl.DateTimeFormat(en?'en-GB':'ar-JO',{timeZone:'Asia/Amman',dateStyle:'short',timeStyle:'short'}).format(endsAt*1000);
 return `<div class="limited-clock" role="timer" aria-live="off" data-limited-until="${endsAt}" aria-label="${escape((en?'Offer ends ':'ينتهي العرض ')+date)}"><span class="deal-countdown-label">${en?'Ends in':'ينتهي خلال'}</span><span class="deal-days" data-limited-days>${current.days?`${current.days} ${en?'d':'يوم'}`:''}</span><b class="deal-time" dir="ltr" data-limited-time>${current.expired?(en?'Ended':'انتهى'):current.time}</b></div>`;
}
export function limitedOffersHtml(products,{language='ar',now=Date.now(),money=n=>(n/1000).toFixed(2)+' د.أ',name=p=>p.name}={}){
 const list=products.filter(p=>p.limitedOffer&&p.limitedOffer.endsAt>offerNow(now)&&Number(p.stock)>0).sort((a,b)=>a.limitedOffer.slot-b.limitedOffer.slot).slice(0,3),en=language==='en';
 if(!list.length)return '';
 return `<section class="wrap limited-offers" aria-labelledby="limitedOffersTitle" data-limited-section><div class="limited-heading"><div><span class="limited-kicker">TREND · LIMITED EDIT</span><h2 id="limitedOffersTitle">${en?'Flash deals':'عروض لفترة محدودة جدًا'}</h2></div><span class="limited-heading-note">${en?'Before time runs out':'قبل ما يخلص الوقت'} <span aria-hidden="true">◷</span></span></div><div class="limited-grid">${list.map(p=>{const o=p.limitedOffer;return `<article class="limited-card"><a class="limited-image" href="/product/${encodeURIComponent(p.id)}"><img src="${escape(p.image||p.image_url)}" alt="${escape(name(p))}" width="180" height="160" loading="lazy"/><span class="limited-saving">−${p.discount_percent}%</span></a><a class="limited-name" href="/product/${encodeURIComponent(p.id)}">${escape(name(p))}</a><div class="limited-price"><strong>${escape(money(p.price_fils))}</strong><del>${escape(money(o.originalPriceFils))}</del></div>${limitedClockHtml(o.endsAt,{language,now})}<a class="limited-open" href="/product/${encodeURIComponent(p.id)}">${en?'View offer':'شاهدي العرض'} <span aria-hidden="true">←</span></a></article>`}).join('')}</div></section>`;
}
export function updateLimitedClocks(root,{language='ar',now=Date.now()}={}){
 for(const node of root.querySelectorAll('[data-limited-until]')){const c=countdown(Number(node.dataset.limitedUntil),now);node.querySelector('[data-limited-days]').textContent=c.days?c.days+(language==='en'?' d':' يوم'):'';node.querySelector('[data-limited-time]').textContent=c.expired?(language==='en'?'Ended':'انتهى'):c.time;}
}
