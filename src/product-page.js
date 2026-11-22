import {isRetiredProduct,storefrontProduct} from '../public/catalog-policy.js';
import {productIdFromPath,productUrl,STORE_ORIGIN} from '../public/product-links.js';
import {loadLimitedOffers,applyLimitedOffers} from './limited-offers.js';
import {productMetaDescription} from '../public/product-copy.js';
import {jsonLd,replaceShellMetadata,seoProductContent,productStructuredData} from './seo.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notFound=()=>new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>المنتج غير متاح | Trend Shop</title><h1>هذا المنتج غير متاح حاليًا</h1><p><a href="/">تصفّحي منتجات Trend Shop</a></p></html>',{status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'}});
export function productMetadata(product,language='ar'){
 product=storefrontProduct(product);
 let details;try{details=typeof product.details==='object'?product.details:JSON.parse(product.details_json||'{}')}catch{details={}}
 if(language==='en')details={...details,...(details.en||{}),nameAr:details.en?.name||product.name};
 const name=String(details?.nameAr||product.name),title=name+' | Trend Shop',description=productMetaDescription(product,language),url=productUrl(product.id,language);
 let image;try{const value=new URL(product.image_url||product.image,STORE_ORIGIN);if(value.protocol!=='https:')throw new Error('Invalid image');image=value.href}catch{image=STORE_ORIGIN+'/images/editorial/beauty-hero-v2.webp'}
 return {name,title,description,url,image};
}
export function productPageHtml(shell,product,language='ar',summary=null,globalRating=null){
 product=storefrontProduct(product);
 const meta=productMetadata(product,language);
 let html=replaceShellMetadata(shell,{...meta,type:'product',language,structuredData:jsonLd(productStructuredData(product,language,summary)),content:seoProductContent(product,language,summary,globalRating)});
 html=html.replace(/<!-- LUMA_(HEADER|FOOTER)_START -->[\s\S]*?<!-- LUMA_\1_END -->/g,'');
 html=html.replace('</head>','<link rel="alternate" hreflang="ar" href="'+escape(productUrl(product.id))+'"/><link rel="alternate" hreflang="en" href="'+escape(productUrl(product.id,'en'))+'"/></head>')
  .replace(/<link rel="preload" as="image" href="\/images\/editorial\/beauty-hero-v2.webp"\/>/,'<link rel="preload" as="image" href="'+escape(meta.image)+'"/>');
 return html;
}
export async function productPage(request,env){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 const id=productIdFromPath(new URL(request.url).pathname);if(!id||isRetiredProduct(id))return notFound();
 const raw=await env.DB?.prepare('SELECT id,brand,name,category,subcategory,description,details_json,image_url,price_fils,reference_price_fils,discount_percent,stock,approved,active FROM products WHERE id=? AND active=1 AND approved=1').bind(id).first();if(!raw)return notFound();
 if(new URL(request.url).pathname.startsWith('/p/')){const url=new URL(productUrl(id));url.search=new URL(request.url).search;return new Response(null,{status:301,headers:{location:url.href,'cache-control':'no-cache'}})}
 const product=applyLimitedOffers([raw],await loadLimitedOffers(env))[0];
 let summary=null;
 try{const r=await env.DB.prepare("SELECT COUNT(*) count,AVG(r.rating) average FROM reviews r JOIN orders o ON o.id=r.order_id WHERE r.product_id=? AND r.status='approved' AND o.status='تم'").bind(id).first();if(r?.count>0)summary={count:Number(r.count),average:Number(r.average)}}catch{}
 // This fixed, repository-owned HTML shell is small; never buffer arbitrary assets.
 const shell=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url)));
 if(!shell.ok)return shell;
 const headers=new Headers(shell.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','no-cache');headers.delete('etag');headers.delete('last-modified');headers.delete('content-length');
 let globalRating=null;try{const r=await env.ASSETS.fetch(new Request(new URL('/global-product-ratings.json',request.url)));if(r.ok&&r.headers.get('content-type')?.includes('json'))globalRating=(await r.json()).products?.[id]}catch{}
 return new Response(request.method==='HEAD'?null:productPageHtml(await shell.text(),product,new URL(request.url).searchParams.get('lang')==='en'?'en':'ar',summary,globalRating),{headers});
}
