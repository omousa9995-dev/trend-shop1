import {brandHref,brandName} from './brand-tools.js';
import {mountMediaGallery} from './media-gallery.js?v=5.9.0';
import {fallbackProductProfile} from './product-profiles.js?v=5.0.0';
import {mountAquaFreshPilot} from './aqua-fresh-pilot.js?v=5.9.0';
import {mountArenciaServiceCard} from './arencia-pilot.js?v=5.4.0';
import {locale,tx,translateText,formatMoney as money} from './i18n.js?v=5.1.0';
import {quoteCart,productPrice,promotionData} from './commerce.js?v=5.0.0';
import {isKoreanCare} from './korean-care.js?v=5.14.0';
import {productDetails} from './shop-tools.js';
import {productType} from './product-types.js';
import {limitedClockHtml} from './limited-offers.js?v=5.23.1';
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
 if(!element?.isConnected)return;element.hidden=!allowSubmissions&&!(summary?.count>0);const count=Number(summary?.count),average=Number(summary?.average);
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
function fitDescription(product, content, profile){
 const editorialFit=!profile.liveSource&&content.fitText?.trim();
 if(editorialFit)return editorialFit;
 const details=productDetails(product),localized=locale()==='en'?{...details,...details.en}:details;
 if(typeof localized.skinType==='string'&&localized.skinType.trim())return localized.skinType;
 const type=productType(product);
 if(['foundation','concealer','bb-cc','powder','primer'].includes(type)){
  return tx('اختاري الدرجة واللمسة المذكورتين في تفاصيل المنتج. إذا لم يُذكر نوع البشرة على العبوة، جرّبي كمية صغيرة أولًا لتعرفي مدى ملاءمة القوام لكِ.','Check the shade and finish in the product details. If the pack does not name a skin type, try a little first to see how the texture suits you.');
 }
 if(product.category!=='البشرة'&&product.category!=='الجسم'){
  return tx('الاختيار هنا يعتمد على الغرض وطريقة الاستخدام الموضّحة في تفاصيل المنتج.','Choose this by its purpose and the directions in the product details.');
 }
 return tx('نوع البشرة غير مُحدّد في المعلومات المتوفرة للمنتج. راجعي تعليمات العبوة أو اسألي فريقنا إذا كانت بشرتكِ تتحسس بسهولة.','The product information does not specify a skin type. Check the pack directions or ask our team if your skin is easily irritated.');
}

export function storyGallery(p,profile,images=[]){
 if(Array.isArray(p.galleryPhotos)){const photos=p.galleryPhotos.filter(x=>imageUrl(x.url)).slice(0,24);return (photos.length?photos:[{url:'/images/TS0001.svg',kind:'pack'}]).map(x=>({...x,label:typeof x.label==='object'?x.label[locale()]:x.label||tx('التفاصيل','Details'),alt:p.name}))}
 const primary=p.image||p.image_url;
 const reviewed=profile?.primary===primary;
 const photos=[{url:primary,label:tx('العبوة','The pack'),kind:'pack',alt:p.name},...(reviewed?(profile.images||[]):[]),...images.filter(url=>url!==primary).map(url=>({url,kind:url.includes('/marketing/')?'promotional':'pack',label:tx('التفاصيل','Details'),alt:p.name}))];
 if(p.id==='TS0098'&&primary===arenciaGuide.primary&&!profile)photos.push({url:arenciaGuide.scene,kind:'promotional',label:tx('لحظة العناية','The ritual')},{url:arenciaGuide.texture,kind:'texture',label:tx('التفاصيل','Details')});
 return photos.filter(x=>imageUrl(x.url)).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).slice(0,7).map(x=>({...x,label:typeof x.label==='object'?x.label[locale()]:x.label}));
}
export function mountProductStory(element,{product:p,name,image,cap=0,live,quantity=1,promotions=[],profile=null,images=[],taxonomy='',brand='',bundles='',options='',inBag=0,hasOtherItems=false,getInBag,onCheckout,onAdd,onZoom,onShare,onQuantity,now=Date.now()}={}){
 profile=profile||fallbackProductProfile(p);
 const c=storyContent(p,profile),photos=storyGallery(p,profile,images);if(image&&photos[0]&&!Array.isArray(p.galleryPhotos))photos[0].url=image;
 const canBuy=cap>0;let selected=Math.max(1,Math.min(cap||1,quantity)),observedBag=inBag;
 const bagQuantity=()=>Math.max(0,Number(getInBag?.()??inBag)||0);
 const selectionInBag=()=>canBuy&&bagQuantity()===selected;
 const quantityOffers=promotions.map(promotionData).filter(o=>o?.active&&o.items?.length===1&&o.items[0].id===p.id&&o.items[0].qty>1&&o.items[0].qty<=cap&&selectionQuote(p,o.items[0].qty,promotions).discountFils>0).sort((a,b)=>a.items[0].qty-b.items[0].qty);
 const offerQuantity=2,pair=selectionQuote(p,2,promotions);
 const faq=[...(c.faq||[]),{question:tx('كيف يُحسب الطلب والتوصيل؟','How are my order and delivery calculated?'),answer:tx('التوصيل دينار لكل الأردن، ومجاني إذا تجاوز مجموع المنتجات بعد الخصم 19 دينارًا. راجعي الكمية والعروض والإجمالي قبل التأكيد. الدفع عند الاستلام أو CliQ اليدوي.','Delivery is 1 JOD across Jordan, free when products after discounts total more than 19 JOD. Review quantities, offers and the delivered total before confirming. Pay on delivery or by manual CliQ.')},{question:tx('كيف أتحقق من النسخة والاستبدال؟','How do I check the version and exchange terms?'),answer:tx('راجعي صورة العبوة والحجم، وتواصلي مع المتجر لتأكيد النسخة ومدة التوصيل وشروط الاستبدال قبل الطلب.','Check the pack photo and size, and ask the store to confirm the version, delivery timing and exchange terms before ordering.')}];
 const reasons=c.benefits.filter(Boolean).slice(0,3);
 const suitability=fitDescription(p,c,profile);
 const scene=photos.find(x=>x.kind==='promotional')||photos[1]||photos[0];

 element.innerHTML=`<article class='product-story' data-no-translate>
 <div class='wrap story-breadcrumb'><a href='#/'>${tx('الرئيسية','Home')}</a><span>/</span><a href='${isKoreanCare(p)?'#/shop?collection=korean-care':'#/shop'}'>${isKoreanCare(p)?'Korean care':tx('جميع المنتجات','All products')}</a><span>/</span><a class='story-brand-secondary brand-link' href='${safe(brandHref(p.brand))}'>${safe(brandName(p.brand))}</a></div>
 <section class='wrap story-hero' aria-labelledby='storyTitle'>
 <div class='story-gallery'><div class='story-photo'><span class='story-photo-label'>${isKoreanCare(p)?'KOREAN CARE':'TREND SHOP'}${c.size?' · '+safe(c.size):''}</span><button type='button' data-story-zoom aria-label='${tx('تكبير صورة المنتج','Enlarge product image')}'><img id='storyMainImage' src='${safe(photos[0]?.url)}' alt='${safe(name)}' width='700' height='700' fetchpriority='high'/><span class='story-zoom-label'>⊕ ${tx('شاهدي التفاصيل','See the detail')}</span></button></div><div class='story-thumbs' aria-label='${tx('صور المنتج','Product images')}'>${photos.map((ph,i)=>`<button type='button' data-story-photo='${i}' aria-pressed='${i===0}'><img src='${safe(ph.thumbnail||ph.url)}' alt='' width='68' height='68' ${i?'loading=lazy':''}/><span>${safe(ph.label||tx('التفاصيل','Details'))}</span></button>`).join('')}</div><p class='story-image-caption' id='storyImageCaption'>${tx('صورة العبوة المعروضة في المتجر.','The product pack shown in this store.')}</p></div>
 <div class='story-intro detail-content'><div class='story-brand-row'>${brand}<button type='button' class='story-text-button' id='shareProduct' data-story-share>${tx('مشاركة المنتج ↗','Share product ↗')}</button></div><p class='story-eyebrow'><a class='story-brand-secondary brand-link' href='${safe(brandHref(p.brand))}' aria-label='${safe(tx('جميع منتجات ','All products by ')+brandName(p.brand))}'>${safe(brandName(p.brand))}</a> · THE TREND SHOP</p><h1 id='storyTitle'>${safe(name)}</h1><p class='story-tagline'>${safe(c.tagline)}</p><p class='story-lead'>${safe(c.description)}</p>${taxonomy}${p.limitedOffer?`<div class='limited-product-badge'>${limitedClockHtml(p.limitedOffer.endsAt,{language:locale(),now})}</div>`:''}<div class='story-facts'>${c.size?`<span>${safe(c.size)}</span>`:''}<span>${safe(isKoreanCare(p)?'Korean care':(locale()==='en'?translateText(p.category):p.category)||'TREND SHOP')}</span></div><button type='button' class='story-text-button story-review-link' data-story-scroll='productReviews' id='storyReviewSummary'>${tx('تجارب الشراء الموثّقة','Verified purchase experiences')}</button>
 <h2 class='story-benefits-title'>${tx('لماذا هذا المنتج؟','Why this product?')}</h2>
 ${reasons.length?`<ul class='story-quick-benefits'>${reasons.map(s=>`<li><span aria-hidden='true'>✦</span><span>${safe(s)}</span></li>`).join('')}</ul>`:`<p class='story-benefits-fallback'>${safe(c.textureText||c.description||c.tagline)}</p>`}
 <div class='story-purchase' id='storyPurchase'>${options}<fieldset class='story-offer-selector'><legend>${tx('اختاري الكمية المناسبة لكِ','Choose the quantity for you')}</legend><div class='story-offer-options'><label class='story-offer'><input type='radio' name='storyOffer' value='1' ${selected===1?'checked':''} ${!canBuy?'disabled':''}/><span><b>${tx(p._bundle?'باكيج واحد':'قطعة واحدة',p._bundle?'One bundle':'One item')}</b>${c.size?`<small>${safe(c.size)}</small>`:''}<strong>${money(productPrice(p))}</strong>${(p.reference??p.reference_price_fils)>productPrice(p)?`<del class="old-price" aria-label="${tx('السعر قبل الخصم','Price before discount')}">${money(p.reference??p.reference_price_fils)}</del>`:''}</span></label>${pair?`<label class='story-offer ${cap<2?'is-unavailable':''}'><input type='radio' name='storyOffer' value='${offerQuantity}' ${selected===offerQuantity?'checked':''} ${cap<2?'disabled':''}/><span>${pair.discountFils?`<i>${tx('عرض القطعتين','The pair offer')}</i>`:''}<b>${tx(p._bundle?'باكيجان':'قطعتان',p._bundle?'Two bundles':'Two items')}</b>${cap<2?`<small>${tx('غير متاح بهذه الكمية حاليًا','This quantity is currently unavailable')}</small>`:''}<strong>${money(pair.subtotalFils)}</strong></span></label>`:''}</div></fieldset>
 <div class='story-quantity-row'><span>${tx('الكمية','Quantity')}</span><div class='story-stepper'><button type='button' data-story-step='-1' aria-label='${tx('تقليل الكمية','Fewer items')}'>−</button><output id='storyQuantity' aria-live='polite'>${selected}</output><button type='button' data-story-step='1' aria-label='${tx('زيادة الكمية','More items')}'>+</button></div></div><div id='storySelectionPrice' class='story-selection-price' aria-live='polite'></div><button type='button' class='btn story-bag-button' data-add='${safe(p.id)}' data-story-add ${!canBuy?'disabled':''}>${tx(p._bundle?'أضيفي الباكج للسلة':'أضيفي المنتج للسلة',p._bundle?'Add bundle to bag':'Add product to bag')}</button><button type='button' class='btn btn-light story-order' data-story-checkout disabled>${tx('راجعي طلبكِ','Review your order')}</button><p class='story-selection-note'>${tx('اختاري الكمية وأضيفيها للسلة، ثم راجعي طلبكِ. يُرسل الطلب عند التأكيد فقط.','Choose a quantity, add it to your bag, then review. The order is sent only when you confirm.')}</p><p id='storyBagNote' class='story-bag-note'>${hasOtherItems?tx('باقي منتجات سلتكِ تظهر أيضًا في ملخص الطلب.','Your other bag items also appear in the summary.'):''}</p></div>
 <div class='story-assurance'><span>✓ ${tx('الدفع عند الاستلام','Cash on delivery')}</span><span>✓ ${tx('CliQ يدوي','Manual CliQ')}</span><button type='button' class='story-text-button' data-story-scroll='storyFaq'>${tx('التوصيل وسياسة الطلب','Delivery & order details')} ↓</button></div>${p._bundle?bundles:`<div class='arencia-feature-video' data-featured-video hidden></div>`}<button type='button' class='btn arencia-extra-add' data-story-add ${!canBuy?'disabled':''}>${tx(p._bundle?'أضيفي الباكج للسلة':'أضيفي المنتج للسلة',p._bundle?'Add bundle to bag':'Add product to bag')}</button></div></section>
 <nav class='story-section-nav wrap' aria-label='${tx('دليل المنتج','Product guide')}'>${[['storyTexture',tx('عن المنتج','About the product')],['storyFit',tx('نوع البشرة','Skin suitability')],['storyHow',tx('طريقة الاستخدام','How to use')],['productReviews',tx('التجارب','Experiences')],['storyFaq',tx('أسئلة شائعة','Questions')]].map(([id,label])=>`<button type='button' data-story-scroll='${id}'>${label}</button>`).join('')}</nav>
 <section class='story-editorial wrap' id='storyTexture'><div class='story-editorial-photo'><img src='${safe(scene?.url)}' alt='${safe(scene?.kind==='promotional'?tx('مشهد دعائي للمنتج','Product promotional scene'):name)}' width='960' height='1200' loading='lazy' decoding='async'/><small>${scene?.kind==='promotional'?tx('مشهد دعائي؛ ليس تجربة عميلة أو دليل نتيجة.','Promotional scene; not a customer experience or evidence of results.'):tx('تفاصيل المنتج المعروض في المتجر.','Details of the product shown in this store.')}</small></div><div class='story-editorial-copy'><span class='story-eyebrow'>A MOMENT IN YOUR ROUTINE</span><h2>${safe(c.textureTitle||tx('تعرّفي إلى اختياركِ.','Meet your care step.'))}</h2><p>${safe(c.textureText||c.description)}</p>${c.ingredients?.length?`<div class='story-ingredient-pills'>${c.ingredients.map(s=>`<span>${safe(s)}</span>`).join('')}</div>`:''}</div></section>
 <section class='story-fit wrap' id='storyFit'><div><span class='story-eyebrow'>FIND YOUR FIT</span><h2>${tx('مناسب لأي نوع بشرة؟','Which skin type is it for?')}</h2><p data-story-fit-copy>${safe(suitability)}</p></div><div class='story-fit-note'><h3>${tx('قبل أن تبدئي','Before you begin')}</h3><p>${safe(c.notes||tx('اتبعي تعليمات العبوة واختبري تقبّل بشرتكِ.','Follow your pack and patch test for skin tolerance.'))}</p></div></section>
 <section class='story-how wrap' id='storyHow'><div class='story-section-title'><span class='story-eyebrow'>YOUR CARE, STEP BY STEP</span><h2>${tx('لحظات صغيرة، واهتمام يليق بكِ.','A little time. A little care for you.')}</h2></div><ol class='story-steps'>${c.steps.map((step,i)=>`<li><span aria-hidden='true'>${String(i+1).padStart(2,'0')}</span><h3>${safe(step.title)}</h3><p>${safe(step.text)}</p></li>`).join('')}</ol></section>
 <section id='storyVideos' class='wrap product-video-section' data-product-videos hidden></section>

 <section id='productReviews' class='section wrap reviews-section story-reviews'></section><section class='story-faq wrap' id='storyFaq'><div><span class='story-eyebrow'>A LITTLE MORE CLARITY</span><h2>${tx('قبل أن تختاري.','Before you choose.')}</h2><p>${tx('خذي راحتكِ، هذه التفاصيل تساعدكِ على الاختيار.','Take your time. A few details to help you choose.')}</p></div><div>${faq.map(({question,answer})=>`<details><summary>${safe(question)}</summary><p>${safe(answer)}</p></details>`).join('')}</div></section>
 <section class='story-last-cta wrap'><span class='story-eyebrow'>YOUR RITUAL STARTS HERE</span><h2>${safe(c.tagline)}</h2><button type='button' class='btn story-order' data-story-checkout ${!canBuy?'disabled':''}>${tx('راجعي اختياري وطلبي','Review my selection & order')}</button></section><section class='wrap' id='detailRecommendations' data-related-for='${safe(p.id)}'></section><div class='story-sticky' data-story-sticky><div><small>${tx('سعر المنتجات · التوصيل في السلة','Products price · delivery in bag')}</small><b id='storyStickyPrice'></b></div><button type='button' class='btn story-primary' data-story-primary ${!canBuy?'disabled':''}></button></div></article>`;
 const media=mountMediaGallery(element.querySelector('.story-gallery'),{photos,name,productId:p.id,onZoom,mainImageId:'storyMainImage'});
 mountAquaFreshPilot(element,{product:p,content:c,photos});
 mountArenciaServiceCard(element,{product:p});
 element.querySelector('[data-story-share]').onclick=()=>onShare?.();
 element.querySelectorAll('[data-story-scroll]').forEach(button=>button.onclick=()=>{const target=element.querySelector('#'+button.dataset.storyScroll);if(target){target.scrollIntoView({behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});target.tabIndex=-1;target.focus({preventScroll:true})}});
 function update(){
  const q=selectionQuote(p,selected,promotions),ready=selectionInBag(),count=bagQuantity();onQuantity?.(selected);
  element.querySelector('#storyQuantity').textContent=selected;
  element.querySelectorAll('[name=storyOffer]').forEach(r=>r.checked=Number(r.value)===selected);
  element.querySelector('[data-story-step="-1"]').disabled=!canBuy||selected<=1;
  element.querySelector('[data-story-step="1"]').disabled=!canBuy||selected>=cap;
  element.querySelector('#storySelectionPrice').innerHTML=`<div class='story-choice-price'><span>${tx('سعر المنتجات المختارة','Selected products price')} · ${selected}</span><strong>${money(q.subtotalFils)}</strong></div>`;
  element.querySelector('#storyStickyPrice').textContent=money(q.subtotalFils);
  element.querySelectorAll('[data-story-checkout]').forEach(b=>{b.disabled=!ready;});
  element.querySelectorAll('[data-story-add]').forEach(b=>{
   b.disabled=!canBuy;b.classList.toggle('is-added',ready);
   b.textContent=ready?tx('✓ تمت إضافة المنتج للسلة','✓ Product added to bag'):tx(p._bundle?'أضيفي الباكج للسلة':count?'حدّثي الكمية في السلة':'أضيفي المنتج للسلة',p._bundle?'Add bundle to bag':count?'Update quantity in bag':'Add product to bag');
  });
  const primary=element.querySelector('[data-story-primary]');primary.disabled=!canBuy;primary.textContent=ready?tx('راجعي طلبكِ','Review your order'):tx('أضيفي للسلة','Add to bag');
  element.querySelector('#storyBagNote').textContent=ready?tx(`في سلتكِ الآن ${count} من هذا الاختيار. يمكنكِ مراجعة الطلب متى أحببتِ.`,`Your bag contains ${count} of this selection. Review whenever you are ready.`):count?tx('أضيفي تعديل الكمية للسلة أولًا، ثم راجعي طلبكِ.','Update the quantity in your bag before reviewing.'):tx('أضيفي هذا الاختيار للسلة أولًا، ثم راجعي طلبكِ.','Add this selection to your bag before reviewing.');
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
