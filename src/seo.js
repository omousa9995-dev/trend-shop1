import {detailsOf,productName,priceOf,priceText,publicImage,productStructuredData} from '../public/product-seo.js';
export {detailsOf,productName,priceOf,priceText,publicImage,productStructuredData};
import {productUrl,STORE_ORIGIN} from '../public/product-links.js';
import {globalRatingHtml} from '../public/global-product-ratings.js';

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const jsonLd=data=>'<script type="application/ld+json" data-store-seo>'+JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'</script>';
export function replaceShellMetadata(shell,{title,description,url,image,type='website',language='ar',structuredData='',content=''}){
 let html=shell.replace(/<title>[\s\S]*?<\/title>/i,()=>'<title>'+escapeHtml(title)+'</title>');
 const meta=(attr,key,value)=>{
  const expression=new RegExp('<meta\\s+(?:'+attr+'=["\\\']'+key+'["\\\'])[^>]*>','i'),tag='<meta '+attr+'="'+key+'" content="'+escapeHtml(value)+'"/>';
  html=expression.test(html)?html.replace(expression,()=>tag):html.replace('</head>',tag+'</head>');
 };
 meta('name','description',description);
 for(const[key,value]of Object.entries({'og:title':title,'og:description':description,'og:type':type,'og:url':url,'og:image':image}))meta('property',key,value);
 for(const[key,value]of Object.entries({'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':description,'twitter:image':image}))meta('name',key,value);
 html=html.replace(/<link\s+rel=["']canonical["'][^>]*>/i,()=>'<link rel="canonical" href="'+escapeHtml(url)+'"/>');
 html=html.replace(/<html\b[^>]*>/i,()=>'<html lang="'+language+'" dir="'+(language==='en'?'ltr':'rtl')+'">');
 html=html.replace(/<script[^>]*data-store-seo[^>]*>[\s\S]*?<\/script>/g,'');
 html=html.replace('</head>',structuredData+'</head>');
 return html.replace(/<main\b[^>]*id=["']app["'][^>]*>[\s\S]*?<\/main>/i,()=>'<main id="app" tabindex="-1">'+content+'</main>');
}
export function seoProductCard(p,language='ar'){
 const e=escapeHtml,name=productName(p,language),href=productUrl(p.id,language),available=Number(p.stock)>0;
 return `<article class="product-card seo-product-card"><a href="${e(href)}"><img src="${e(publicImage(p))}" alt="${e(name)}" width="360" height="420" loading="lazy"/><span class="brand">${e(p.brand)}</span><h3>${e(name)}</h3></a><strong>${priceText(p)} ${language==='en'?'JOD':'د.أ'}</strong><p>${available?(language==='en'?'Available':'متوفر'):(language==='en'?'Currently unavailable':'غير متوفر حاليًا')}</p><a class="btn btn-light" href="${e(href)}">${language==='en'?'Product details':'تفاصيل المنتج'}</a></article>`;
}
export function seoProductContent(p,language='ar',summary=null,globalRating=null){
 const e=escapeHtml,d=detailsOf(p),en=language==='en',copy=en?{...d,...d.en}:d,name=productName(p,language),desc=en?(d.en?.description||p.description):p.description,price=priceOf(p)>0?`${priceText(p)} ${en?'JOD':'د.أ'}`:'';
 return `<article class="product-story seo-product" data-product-loading="${e(p.id)}" data-server-product><nav class="wrap story-breadcrumb"><a href="/#/">${en?'Home':'الرئيسية'}</a><span> / </span><a href="/#/shop">${en?'Shop':'المتجر'}</a></nav><section class="wrap story-hero"><div class="story-gallery"><img class="seo-main-image" src="${e(publicImage(p))}" alt="${e(name)}" width="700" height="700" fetchpriority="high" decoding="async"/></div><div class="story-intro detail-content"><p class="story-eyebrow">${e(p.brand)}</p><h1>${e(name)}</h1>${copy.size?'<p>'+e(copy.size)+'</p>':''}<p class="story-tagline">${e(copy.tagline||'')}</p><p class="seo-current-price"><strong>${e(price)}</strong></p><p>${Number(p.stock)>0?(en?'Available to order':'متوفر للطلب'):(en?'Currently unavailable':'غير متوفر حاليًا')}</p>${summary?.count?`<p class="reviews-summary" aria-label="${e(summary.average)} ${en?'out of 5':'من 5'}">${e(summary.average)} / 5 · ${e(summary.count)} ${en?'verified purchase reviews':'تقييم من طلبات مكتملة'}</p>`:''}<p class="story-lead">${e(desc||'')}</p>${Array.isArray(copy.benefits)?'<ul class="story-quick-benefits">'+copy.benefits.map(b=>'<li>'+e(b)+'</li>').join('')+'</ul>':''}<a class="btn" href="#seoUsage">${en?'Usage and details':'طريقة الاستخدام والتفاصيل'}</a><p>${en?'Delivery is 1 JOD across Jordan, free on orders above 19 JOD.':'التوصيل دينار واحد لجميع الأردن، ومجاني للطلبات فوق 19 دينارًا.'}</p><noscript><p>${en?'Enable JavaScript to choose options and checkout, or contact the store.':'فعّلي JavaScript لاختيار الدرجة والكمية وإتمام الطلب، أو تواصلي مع المتجر.'}</p><a href="https://wa.me/962790025430">${en?'Contact Trend on WhatsApp':'تواصلي مع Trend على واتساب'}</a></noscript></div></section><div class="wrap">${globalRatingHtml(globalRating,{language})}</div><section class="wrap section" id="seoUsage"><h2>${en?'How to use':'طريقة الاستخدام'}</h2><p class="seo-paragraph">${e(copy.howToUse||'')}</p>${copy.notes?'<h2>'+(en?'Before use':'قبل الاستخدام')+'</h2><p>'+e(copy.notes)+'</p>':''}</section></article>`;
}
