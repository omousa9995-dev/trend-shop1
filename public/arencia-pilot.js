import {locale,tx,formatMoney as money} from './i18n.js?v=5.1.0';
import {productPrice} from './commerce.js?v=5.0.0';

export const ARENCIA_PILOT_ID='TS0098';
const pack='/images/catalog/TS0098-ca6be2972b93.jpg';
const texture='/images/catalog/TS0098-f2845e64e480.webp';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=paths=>`<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const icons={
 delivery:icon('<path d="M3 9h16v14H3zM19 14h6l4 5v4H19"/><path d="M22 14v5h7"/><circle cx="9" cy="24" r="3"/><circle cx="24" cy="24" r="3"/><path d="M7 5h9M5 2h7"/>'),
 inspect:icon('<path d="m4 10 12-6 12 6v15l-12 5-12-5zM4 10l12 6 12-6M16 16v14"/><path d="m11 7 12 6"/><path d="m11 21 3 3 6-6"/>'),
 authentic:icon('<path d="M16 3 28 8v8c0 7-6 11-12 14C10 27 4 23 4 16V8z"/><path d="m10 16 4 4 8-9"/>'),
 lather:icon('<path d="M4 23c4-5 7-5 11-3l5 2 7-3M4 27h13l10-5"/><circle cx="12" cy="12" r="4"/><circle cx="20" cy="9" r="3"/><circle cx="23" cy="15" r="2"/>'),
 cleanse:icon('<path d="M11 5c-3 3-5 6-5 10 0 8 6 13 10 13s10-5 10-13c0-4-2-7-5-10M11 12h1M20 12h1M12 21c3 2 5 2 8 0"/><circle cx="4" cy="7" r="2"/><circle cx="27" cy="4" r="2"/>'),
 rinse:icon('<path d="M16 3C12 9 7 14 7 19a9 9 0 0 0 18 0c0-5-5-10-9-16Z"/><path d="M12 21c0 3 2 4 4 4M25 5v5M29 9v5"/>')
};

export function arenciaPhotos(product,photos){
 if(product?.id!==ARENCIA_PILOT_ID||(product.image||product.image_url)!==pack)return photos;
 if(photos.some(photo=>photo.url===texture))return photos;
 return [...photos,{url:texture,thumbnail:texture,kind:'texture',label:tx('قوام الموتشي','Mochi texture'),alt:tx('لقطة مقرّبة لقوام غسول أرينسيا','A close-up of Arencia cleanser texture')}].slice(0,7);
}

export function arenciaFaq(product,faq){
 if(product?.id!==ARENCIA_PILOT_ID)return faq;
 const rows=faq.slice(0,-2);
 return [...rows,
  {question:tx('متى يصل طلبي، وكم تكلفة التوصيل؟','When will my order arrive, and what does delivery cost?'),answer:tx('التوصيل لجميع مناطق المملكة خلال 24 ساعة. رسوم التوصيل دينار واحد، ومجاني إذا تجاوز مجموع المنتجات بعد الخصم 19 دينارًا. يظهر الإجمالي قبل تأكيد الطلب.','Delivery to every area of Jordan within 24 hours. Delivery is 1 JOD, free when products after discounts total more than 19 JOD. Your final total is shown before confirmation.')},
  {question:tx('هل أستطيع تفقد طلبي قبل الدفع؟','Can I inspect my order before paying?'),answer:tx('نعم، بإمكانكِ تفقد طلبكِ قبل الدفع عند الاستلام. راجعي المنتجات والكميات، وتواصلي معنا عند وجود أي ملاحظة. يتوفر أيضًا CliQ اليدوي بالتنسيق مع المتجر.','Yes. You can inspect your order before paying on delivery. Check the products and quantities, and contact us if anything needs attention. Manual CliQ is also available by arrangement with the store.')},
  {question:tx('هل المنتجات أصلية؟','Are the products authentic?'),answer:tx('نعم، منتجات Trend Shop أصلية 100%. يمكنكِ مشاهدة صورة العبوة والحجم بوضوح، والتواصل معنا لأي استفسار قبل الطلب.','Yes. Trend Shop products are 100% authentic. View the pack and size clearly, and contact us with any questions before ordering.')}
 ];
}

export function mountArenciaPilot(root,{product,content={}}={}){
 if(product?.id!==ARENCIA_PILOT_ID)return null;
 const article=root.querySelector('.product-story');
 if(!article||article.classList.contains('arencia-pilot'))return null;
 article.classList.add('arencia-pilot');article.dataset.productPilot='arencia-v52';
 const doc=root.ownerDocument,intro=article.querySelector('.story-intro');
 const tagline=intro.querySelector('.story-tagline');
 tagline.textContent=tx('نظافة تحبّينها، وبداية ناعمة لروتينكِ.','A fresh cleanse. A soft start to your ritual.');
 const lead=intro.querySelector('.story-lead');
 if(lead){
  const original=lead.textContent;
  lead.textContent=content.benefits?.[0]||tx('يساعد على إزالة الشوائب والزيوت الزائدة.','Helps wash away daily impurities and excess oil.');
  const about=article.querySelector('.story-editorial-copy');
  if(about&&original&&!about.textContent.includes(original)){
   const paragraph=doc.createElement('p');paragraph.className='arencia-full-intro';paragraph.textContent=original;
   about.querySelector('p')?.after(paragraph);
  }
 }
 const heroPrice=intro.querySelector('.aqua-hero-price');
 if(heroPrice){
  heroPrice.classList.add('arencia-hero-price');
  heroPrice.innerHTML=`<div><small>${tx('سعر القطعة','Single item price')}</small><strong>${money(productPrice(product))}</strong></div><span>${safe(content.size||'')}</span>`;
  const fast=doc.createElement('button');fast.type='button';fast.className='btn story-order arencia-quick-order';fast.dataset.storyCheckout='';
  fast.disabled=!!intro.querySelector('.story-purchase [data-story-checkout]')?.disabled;
  fast.textContent=fast.disabled?tx('غير متوفر حاليًا','Currently unavailable'):tx('راجعي طلبكِ ←','Review your order →');heroPrice.after(fast);
 }
 const policies=[
  ['delivery',tx('خلال 24 ساعة','Within 24 hours'),tx('لجميع مناطق المملكة','Every area of Jordan')],
  ['inspect',tx('تفقدي طلبكِ قبل الدفع','Inspect before paying'),tx('عند الاستلام','On delivery')],
  ['authentic',tx('منتجات أصلية 100%','100% authentic products'),tx('تسوّقي بثقة','Shop with confidence')]
 ];
 const service=doc.createElement('div');service.className='arencia-service';service.setAttribute('aria-label',tx('خدمة Trend Shop','Trend Shop service'));
 service.innerHTML=policies.map(([name,title,text])=>`<div>${icons[name]}<span><strong>${safe(title)}</strong><small>${safe(text)}</small></span></div>`).join('');
 intro.querySelector('.story-purchase').before(service);
 const quickBenefits=intro.querySelector('.story-quick-benefits');
 if(quickBenefits){
  const headings=locale()==='en'?['A fresh cleanse','An everyday fresh start','A soft finish']:['بداية نظيفة','انتعاش لروتينكِ اليومي','لمسة ناعمة'];
  quickBenefits.classList.add('arencia-benefits');
  quickBenefits.querySelectorAll('li').forEach((li,i)=>{const text=li.lastElementChild?.textContent||'';li.innerHTML=`<span class="arencia-benefit-number" aria-hidden="true">0${i+1}</span><span><b>${safe(headings[i]||'')}</b>${safe(text)}</span>`;});
  intro.querySelector('.story-purchase').after(quickBenefits);
 }
 const delivery=intro.querySelector('.aqua-delivery-note');
 if(delivery)delivery.textContent=tx('التوصيل لجميع مناطق المملكة خلال 24 ساعة · دينار واحد، ومجاني للطلبات فوق 19 دينارًا بعد الخصم.','Delivery to every area of Jordan within 24 hours · 1 JOD, free for orders above 19 JOD after discounts.');
 const steps=article.querySelectorAll('.story-steps li');
 if(steps.length===3)steps.forEach((li,i)=>{const picture=doc.createElement('span');picture.className='arencia-step-icon';picture.innerHTML=icons[['lather','cleanse','rinse'][i]];li.prepend(picture);});
 const last=article.querySelector('.story-last-cta h2');
 if(last)last.textContent=tx('لحظة نظافة، وخطوة أقرب لروتينكِ.','A fresh little moment for your routine.');
 return {productId:ARENCIA_PILOT_ID};
}
