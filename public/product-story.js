import {brandHref,brandName} from './brand-tools.js';
import {mountMediaGallery} from './media-gallery.js?v=5.9.0';
import {fallbackProductProfile} from './product-profiles.js?v=5.0.0';
import {mountAquaFreshPilot} from './aqua-fresh-pilot.js?v=5.25.0';
import {mountArenciaServiceCard} from './arencia-pilot.js?v=5.25.0';
import {locale,tx,formatMoney as money} from './i18n.js?v=5.1.0';
import {quoteCart,productPrice} from './commerce.js?v=5.0.0';
import {isKoreanCare} from './korean-care.js?v=5.14.0';
import {productDetails} from './shop-tools.js';
import {isRetiredProduct} from './catalog-policy.js';

export const arenciaGuide={id:'TS0098',primary:'/images/catalog/TS0098-ca6be2972b93.jpg',scene:'/images/catalog/TS0098-137fa42970f7.webp',texture:'/images/catalog/TS0098-f2845e64e480.webp'};
export const productStoryOffers=[{id:'PROMOARENCIA-PAIR',kind:'offer',active:true,title:'ثنائي أرينسيا',items:[{id:'TS0098',qty:2}],priceFils:19990,en:{title:'The Arencia pair'}}];
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageUrl=s=>typeof s==='string'&&(/^\/(?:images|media)\/[a-zA-Z0-9_./-]+$/.test(s)||/^https:\/\//.test(s));
const documents=new Map();
export const hasProductStory=p=>!!p&&/^TS[A-Z0-9-]{4,64}$/.test(p.id||'')&&!isRetiredProduct(p);
export const selectionQuote=(p,quantity,promotions)=>quoteCart([{id:p.id,qty:quantity}],[p],promotions);
export async function loadProductStory(p,fetcher=fetch,{timeoutMs=4500,clock=globalThis}={}){
 if(!/^TS[A-Z0-9-]{4,64}$/.test(p?.id||''))return null;
 if(!documents.has(p.id)){
  const controller=new AbortController();let timer;
  const deadline=new Promise(resolve=>{timer=clock.setTimeout(()=>{controller.abort();resolve(null)},timeoutMs)});
  const document=Promise.race([Promise.resolve().then(()=>fetcher('/product-stories/'+encodeURIComponent(p.id)+'.json?v=5.0.0',{signal:controller.signal})).then(async r=>r.ok?await r.json():null).catch(()=>null),deadline]).then(value=>{clock.clearTimeout(timer);if(!value)documents.delete(p.id);return value});
  documents.set(p.id,document);
 }
 const doc=await documents.get(p.id);
 return doc?.id===p.id&&doc.brand===p.brand&&doc.productName===p.name?doc:null;
}
export function renderReviewSummary(element,summary,allowSubmissions=false){
 if(!element?.isConnected)return;element.hidden=element.hasAttribute('data-settings-hidden')||(!allowSubmissions&&!(summary?.count>0));const count=Number(summary?.count),average=Number(summary?.average);
 element.innerHTML=count>0&&average>=1&&average<=5?`<span class="review-star-summary"><span aria-hidden="true">${'★'.repeat(Math.round(average))}${'☆'.repeat(5-Math.round(average))}</span><b>${average.toFixed(1)} / 5</b> · ${count} ${tx('تقييم من زبائن Trend','Trend purchase reviews')}</span>`:summary?`<span aria-hidden="true">☆☆☆☆☆</span> ${tx('لا توجد تقييمات من زبائن Trend بعد','No Trend purchase ratings yet')}`:tx('تجارب الشراء الموثّقة','Verified purchase experiences');
}
export function storyContent(p,profile){
 profile=profile||fallbackProductProfile(p);
 const raw=productDetails(p),d=locale()==='en'?{...raw,...raw.en,nameAr:raw.en?.name||p.name}:raw;
 const c=profile?.[locale()]||{};
 const previousUsage=c.steps?.map(x=>x.title+': '+x.text).join('\n');
 const hasUsage=Object.hasOwn(d,'howToUse');
 const steps=hasUsage?(d.howToUse?((d.howToUse===previousUsage||profile.liveSource)?c.steps:[{title:tx('خطوة الاستخدام','Your care step'),text:d.howToUse}]):[]):(c.steps||[]);
 const has=(key)=>Object.hasOwn(d,key);
 const description=locale()==='en'?(Object.hasOwn(raw.en||{},'description')?raw.en.description:c.description||''):(Object.hasOwn(p,'description')?p.description:c.description||'');
 return {...c,name:d.nameAr||c.name||p.name,tagline:has('tagline')?d.tagline:c.tagline||tx('لحظة عناية، على طريقتكِ.','A little care, your way.'),description,benefits:Array.isArray(d.benefits)?d.benefits:c.benefits||[],notes:has('notes')?d.notes:c.notes||'',steps,size:d.size||'',type:d.productType||''};
}
export function storyGallery(p,profile,images=[]){
 if(Array.isArray(p.galleryPhotos)){const photos=p.galleryPhotos.filter(x=>imageUrl(x.url)).slice(0,24);return (photos.length?photos:[{url:'/images/TS0001.svg',kind:'pack'}]).map(x=>({...x,label:typeof x.label==='object'?x.label[locale()]:x.label||tx('التفاصيل','Details'),alt:p.name}))}
 const primary=p.image||p.image_url;
 const reviewed=profile?.primary===primary;
 const photos=[{url:primary,label:tx('العبوة','The pack'),kind:'pack',alt:p.name},...(reviewed?(profile.images||[]):[]),...images.filter(url=>url!==primary).map(url=>({url,kind:url.includes('/marketing/')?'promotional':'pack',label:tx('التفاصيل','Details'),alt:p.name}))];
 if(p.id==='TS0098'&&primary===arenciaGuide.primary&&!profile)photos.push({url:arenciaGuide.scene,kind:'promotional',label:tx('لحظة العناية','The ritual')},{url:arenciaGuide.texture,kind:'texture',label:tx('التفاصيل','Details')});
 return photos.filter(x=>imageUrl(x.url)).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).slice(0,7).map(x=>({...x,label:typeof x.label==='object'?x.label[locale()]:x.label}));
}
export function mountProductStory(element,{product:p,name,image,cap=0,live,quantity=1,promotions=[],profile=null,images=[],taxonomy='',brand='',bundles='',options='',inBag=0,hasOtherItems=false,getInBag,onCheckout,onAdd,onZoom,onShare,onQuantity}={}){
 profile=profile||fallbackProductProfile(p);
 const c=storyContent(p,profile),photos=storyGallery(p,profile,images);if(image&&photos[0]&&!Array.isArray(p.galleryPhotos))photos[0].url=image;
 const canBuy=cap>0;let selected=Math.max(1,Math.min(cap||1,quantity)),observedBag=inBag;
 const bagQuantity=()=>Math.max(0,Number(getInBag?.()??inBag)||0);
 const selectionInBag=()=>canBuy&&bagQuantity()===selected;
 const offerQuantity=2,pair=selectionQuote(p,2,promotions);
 const faq=[...(c.faq||[]),{question:tx('كيف يُحسب الطلب والتوصيل؟','How are my order and delivery calculated?'),answer:tx('التوصيل دينار لكل الأردن، ومجاني إذا تجاوز مجموع المنتجات بعد الخصم 19 دينارًا. راجعي الكمية والعروض والإجمالي قبل التأكيد. الدفع عند الاستلام أو CliQ اليدوي.','Delivery is 1 JOD across Jordan, free when products after discounts total more than 19 JOD. Review quantities, offers and the delivered total before confirming. Pay on delivery or by manual CliQ.')},{question:tx('كيف أتحقق من النسخة والاستبدال؟','How do I check the version and exchange terms?'),answer:tx('راجعي صورة العبوة والحجم، وتواصلي مع المتجر لتأكيد النسخة ومدة التوصيل وشروط الاستبدال قبل الطلب.','Check the pack photo and size, and ask the store to confirm the version, delivery timing and exchange terms before ordering.')}];
 const unitPrice=productPrice(p);
 const fitText=c.fitText&&c.fitText!==c.description&&c.fitText!==c.notes?c.fitText:'';
 const textureText=c.textureText&&c.textureText!==c.description?c.textureText:'';
 const fitTitle=tx('هل يناسبني؟','Is it right for me?'),usageTitle=tx('طريقة الاستخدام','How to use');
 const aboutTitle=tx('عن المنتج','About the product'),faqTitle=tx('الأسئلة الشائعة','Common questions');
 const jumpLinks=[['storyTexture',aboutTitle],['storyFit',fitTitle],['storyHow',usageTitle],['productReviews',tx('التقييمات','Reviews')],['storyFaq',faqTitle]];

 element.innerHTML=`<article class="product-story compact-story" data-no-translate>
 <nav class="wrap story-breadcrumb" aria-label="${tx('مسار التصفح','Breadcrumb')}"><a href="#/">${tx('الرئيسية','Home')}</a><span aria-hidden="true">/</span><a href="${isKoreanCare(p)?'#/shop?collection=korean-care':'#/shop'}">${isKoreanCare(p)?'Korean care':tx('جميع المنتجات','All products')}</a><span aria-hidden="true">/</span><a class="story-brand-secondary brand-link" href="${safe(brandHref(p.brand))}">${safe(brandName(p.brand))}</a></nav>
 <section class="wrap story-hero" aria-labelledby="storyTitle">
 <div class="story-heading detail-content">
  <div class="story-brand-row">${brand}<button type="button" class="story-text-button" id="shareProduct" data-story-share>${tx('مشاركة المنتج ↗','Share product ↗')}</button></div>
  <h1 id="storyTitle" dir="auto">${safe(name)}</h1>
  <div class="story-head-price aqua-hero-price"><strong>${money(unitPrice)}</strong>${c.size?`<span dir="auto">${safe(c.size)}</span>`:''}</div>
 </div>
 <div class="story-gallery"></div>
 <div class="story-intro detail-content">
 <div class='story-purchase' id='storyPurchase'>${options}<fieldset class='story-offer-selector'><legend>${tx('اختاري الكمية المناسبة لكِ','Choose the quantity for you')}</legend><div class='story-offer-options'><label class='story-offer'><input type='radio' name='storyOffer' value='1' ${selected===1?'checked':''} ${!canBuy?'disabled':''}/><span><b>${tx(p._bundle?'باكيج واحد':'قطعة واحدة',p._bundle?'One bundle':'One item')}</b>${c.size?`<small>${safe(c.size)}</small>`:''}<strong>${money(productPrice(p))}</strong>${(p.reference??p.reference_price_fils)>productPrice(p)?`<del class="old-price" aria-label="${tx('السعر قبل الخصم','Price before discount')}">${money(p.reference??p.reference_price_fils)}</del>`:''}</span></label>${pair?`<label class='story-offer ${cap<2?'is-unavailable':''}'><input type='radio' name='storyOffer' value='${offerQuantity}' ${selected===offerQuantity?'checked':''} ${cap<2?'disabled':''}/><span>${pair.discountFils?`<i>${tx('عرض القطعتين','The pair offer')}</i>`:''}<b>${tx(p._bundle?'باكيجان':'قطعتان',p._bundle?'Two bundles':'Two items')}</b>${cap<2?`<small>${tx('غير متاح بهذه الكمية حاليًا','This quantity is currently unavailable')}</small>`:''}<strong>${money(pair.subtotalFils)}</strong></span></label>`:''}</div></fieldset>
 <div class='story-total-row'><div class='story-quantity-row'><span>${tx('الكمية','Quantity')}</span><div class='story-stepper'><button type='button' data-story-step='-1' aria-label='${tx('تقليل الكمية','Fewer items')}'>−</button><output id='storyQuantity' aria-live='polite'>${selected}</output><button type='button' data-story-step='1' aria-label='${tx('زيادة الكمية','More items')}'>+</button></div></div><div id='storySelectionPrice' class='story-selection-price' aria-live='polite'></div></div><button type='button' class='btn story-bag-button' data-add='${safe(p.id)}' data-story-add ${!canBuy?'disabled':''}>${tx(p._bundle?'أضيفي الباكج للسلة':'أضيفي المنتج للسلة',p._bundle?'Add bundle to bag':'Add product to bag')}</button><button type='button' class='btn btn-light story-order' data-story-checkout disabled>${tx('راجعي طلبكِ','Review your order')}</button><p id='storyBagNote' class='story-bag-note' role='status'></p></div>
 <div class='story-after-purchase'><button type='button' class='story-text-button story-review-link' data-story-scroll='productReviews' id='storyReviewSummary'>${tx('تجارب الشراء الموثّقة','Verified purchase experiences')}</button></div>
 <div class='story-assurance'><span>✓ ${tx('الدفع عند الاستلام','Cash on delivery')}</span><span>✓ ${tx('CliQ يدوي','Manual CliQ')}</span><button type='button' class='story-text-button' data-story-scroll='storyFaq'>${tx('التوصيل وسياسة الطلب','Delivery & order details')} ↓</button></div>${p._bundle?bundles:`<div class='arencia-feature-video' data-featured-video hidden></div>`}<button type='button' class='btn arencia-extra-add' data-story-add ${!canBuy?'disabled':''}>${tx(p._bundle?'أضيفي الباكج للسلة':'أضيفي المنتج للسلة',p._bundle?'Add bundle to bag':'Add product to bag')}</button></div></section>
 <nav class="story-section-nav wrap" aria-label="${tx('دليل المنتج','Product guide')}">${jumpLinks.map(([id,label])=>`<button type="button" data-story-scroll="${id}">${label}</button>`).join('')}</nav>
 <section class="story-editorial wrap" id="storyTexture">
  <div class="story-editorial-copy"><h2>${aboutTitle}</h2>
  ${c.tagline?`<p class="story-tagline">${safe(c.tagline)}</p>`:''}
  ${c.description?`<p class="story-lead">${safe(c.description)}</p>`:''}
  ${textureText?`<p>${safe(textureText)}</p>`:''}
  ${c.benefits.length?`<ul class="story-quick-benefits">${c.benefits.slice(0,3).map(s=>`<li><span aria-hidden="true">•</span><span>${safe(s)}</span></li>`).join('')}</ul>`:''}
  ${c.ingredients?.length?`<div class="story-ingredient-pills">${c.ingredients.map(s=>`<span>${safe(s)}</span>`).join('')}</div>`:''}
  ${taxonomy}</div>
 </section>
 <details class="wrap story-disclosure" id="storyFit"><summary>${fitTitle}</summary><div class="story-disclosure-body">
  ${fitText?`<p>${safe(fitText)}</p>`:''}<p>${safe(c.notes||tx('اتبعي تعليمات العبوة واختبري تقبّل بشرتكِ.','Follow the pack directions and patch test for tolerance.'))}</p>
 </div></details>
 <details class="wrap story-disclosure" id="storyHow"><summary>${usageTitle}</summary><div class="story-disclosure-body">
  ${c.steps.length?`<ol class="story-steps story-use-steps">${c.steps.map(step=>`<li><strong>${safe(step.title)}</strong> ${safe(step.text)}</li>`).join('')}</ol>`:`<p>${tx('اتبعي طريقة الاستخدام الموضّحة على عبوتكِ.','Follow the directions on your pack.')}</p>`}
 </div></details>
 <section id="storyVideos" class="wrap product-video-section" data-product-videos hidden></section>
 <section id="productReviews" class="section wrap reviews-section story-reviews"></section>
 <details class="wrap story-disclosure" id="storyFaq"><summary>${faqTitle}</summary><div class="story-disclosure-body">${faq.map(({question,answer})=>`<details><summary>${safe(question)}</summary><p>${safe(answer)}</p></details>`).join('')}</div></details>
 <section class="story-last-cta wrap"><a class="story-brand-secondary brand-link" href="${safe(brandHref(p.brand))}">${safe(brandName(p.brand))}</a><button type="button" class="btn story-order" data-story-checkout ${!canBuy?'disabled':''}>${tx('راجعي طلبي','Review my order')}</button><button type="button" class="story-text-button" data-story-scroll="storyPurchase">${tx('العودة لاختيار الكمية','Back to quantity')}</button></section><section class='wrap' id='detailRecommendations' data-related-for='${safe(p.id)}'></section><div class='story-sticky' data-story-sticky><div><small>${tx('سعر المنتجات · التوصيل في السلة','Products price · delivery in bag')}</small><b id='storyStickyPrice'></b></div><button type='button' class='btn story-primary' data-story-primary ${!canBuy?'disabled':''}></button></div></article>`;
 const media=mountMediaGallery(element.querySelector('.story-gallery'),{photos,name,productId:p.id,onZoom,mainImageId:'storyMainImage'});
 mountAquaFreshPilot(element,{product:p,content:c,photos});
 mountArenciaServiceCard(element,{product:p});
 element.querySelector('[data-story-share]').onclick=()=>onShare?.();
 element.querySelectorAll('[data-story-scroll]').forEach(button=>button.onclick=()=>{const target=element.querySelector('#'+button.dataset.storyScroll);if(target&&!target.hidden){if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});const focus=target.tagName==='DETAILS'?target.querySelector('summary'):target;focus.tabIndex=target.tagName==='DETAILS'?0:-1;focus.focus({preventScroll:true})}});
 function update(){
  const q=selectionQuote(p,selected,promotions),ready=selectionInBag(),count=bagQuantity();onQuantity?.(selected);
  element.querySelector('#storyQuantity').textContent=selected;
  element.querySelectorAll('[name=storyOffer]').forEach(r=>r.checked=Number(r.value)===selected);
  element.querySelector('[data-story-step="-1"]').disabled=!canBuy||selected<=1;
  element.querySelector('[data-story-step="1"]').disabled=!canBuy||selected>=cap;
  element.querySelector('#storySelectionPrice').innerHTML=`<div class='story-choice-price'><span>${tx('مجموع المنتجات','Items subtotal')}</span><strong>${money(q.subtotalFils)}</strong></div>`;
  element.querySelector('#storyStickyPrice').textContent=money(q.subtotalFils);
  element.querySelectorAll('[data-story-checkout]').forEach(b=>{b.disabled=!ready;b.hidden=!ready;});
  element.querySelectorAll('[data-story-add]').forEach(b=>{
   b.disabled=!canBuy;b.classList.toggle('is-added',ready);
   b.textContent=ready?tx('✓ تمت إضافة المنتج للسلة','✓ Product added to bag'):tx(p._bundle?'أضيفي الباكج للسلة':count?'حدّثي الكمية في السلة':'أضيفي المنتج للسلة',p._bundle?'Add bundle to bag':count?'Update quantity in bag':'Add product to bag');
  });
  const primary=element.querySelector('[data-story-primary]');primary.disabled=!canBuy;primary.textContent=ready?tx('راجعي طلبكِ','Review your order'):tx('أضيفي للسلة','Add to bag');
  element.querySelector('#storyBagNote').textContent=ready?tx(`في سلتكِ الآن ${count} من هذا الاختيار. يمكنكِ مراجعة الطلب متى أحببتِ.`,`Your bag contains ${count} of this selection. Review whenever you are ready.`):count?tx('أضيفي تعديل الكمية للسلة أولًا، ثم راجعي طلبكِ.','Update the quantity in your bag before reviewing.'):hasOtherItems?tx('باقي منتجات سلتكِ تظهر في ملخص الطلب.','Your other bag items appear in the order summary.'):'';
 }
 function refreshBag(){const next=bagQuantity();if(next!==observedBag&&selected===observedBag&&next>0)selected=Math.min(cap,next);observedBag=next;update();}
 function addSelection(){if(!canBuy||onAdd?.(selected)===false)return false;inBag=selected;observedBag=selected;update();return true;}

 element.querySelectorAll('[name=storyOffer]').forEach(r=>r.onchange=()=>{selected=Number(r.value);update()});element.querySelectorAll('[data-story-step]').forEach(b=>b.onclick=()=>{selected=Math.max(1,Math.min(cap,selected+Number(b.dataset.storyStep)));update()});
 element.querySelectorAll('[data-story-checkout]').forEach(b=>b.onclick=()=>{if(selectionInBag())onCheckout?.(selected)});
 element.querySelectorAll('[data-story-add]').forEach(button=>button.onclick=event=>{event.stopPropagation();addSelection()});
 element.querySelector('[data-story-primary]').onclick=()=>selectionInBag()?onCheckout?.(selected):addSelection();
 element.querySelectorAll('[data-select-option],.bundle-option input[type=radio]').forEach(input=>input.addEventListener('change',()=>queueMicrotask(update)));
 update();const controller={media,refreshBag,get quantity(){return selected}};element.querySelector('.product-story').productStory=controller;return controller;

}
