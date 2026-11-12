import {productLoading} from '../public/product-loading.js';
import {isRetiredProduct,storefrontProduct} from '../public/catalog-policy.js';
import {productIdFromPath,productUrl,STORE_ORIGIN} from '../public/product-links.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notFound=()=>new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>المنتج غير متاح | Trend Shop</title><h1>هذا المنتج غير متاح حاليًا</h1><p><a href="/">تصفّحي منتجات Trend Shop</a></p></html>',{status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'}});
export function productMetadata(product,language='ar'){
 product=storefrontProduct(product);
 let details;try{details=typeof product.details==='object'?product.details:JSON.parse(product.details_json||'{}')}catch{details={}}
 if(language==='en')details={...details,...(details.en||{}),nameAr:details.en?.name||product.name};
 const name=String(details?.nameAr||product.name),title=name+' | Trend Shop',description=String(details?.tagline||product.description||name).slice(0,250),url=productUrl(product.id,language);
 let image;try{const value=new URL(product.image_url||product.image,STORE_ORIGIN);if(value.protocol!=='https:')throw new Error('Invalid image');image=value.href}catch{image=STORE_ORIGIN+'/images/editorial/beauty-hero-v2.webp'}
 return {name,title,description,url,image};
}
export function productPageHtml(shell,product,language='ar'){
 const meta=productMetadata(product,language);
 let html=shell.replace(/<!-- LUMA_(HEADER|FOOTER)_START -->[\s\S]*?<!-- LUMA_\1_END -->/g,'').replace(/<html lang="ar" dir="rtl">/,language==='en'?'<html lang="en" dir="ltr">':'<html lang="ar" dir="rtl">').replace(/<title>[^<]*<\/title>/i,()=>'<title>'+escape(meta.title)+'</title>')
  .replace(/<meta name="description"[^>]*\/>/i,()=>'<meta name="description" content="'+escape(meta.description)+'"/>')
  .replace(/<link rel="canonical"[^>]*\/>/i,()=>'<link rel="canonical" href="'+escape(meta.url)+'"/>');
 for(const [name,value]of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:type':'product','og:url':meta.url,'og:image':meta.image}))html=html.replace(new RegExp('<meta property="'+name+'"[^>]*\\/>','i'),()=>'<meta property="'+name+'" content="'+escape(value)+'"/>');
 const twitter='<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="'+escape(meta.title)+'"/><meta name="twitter:description" content="'+escape(meta.description)+'"/><meta name="twitter:image" content="'+escape(meta.image)+'"/>';
 html=html.replace('</head>',twitter+'<link rel="alternate" hreflang="ar" href="'+escape(productUrl(product.id))+'"/><link rel="alternate" hreflang="en" href="'+escape(productUrl(product.id,'en'))+'"/></head>')
  .replace(/<link rel="preload" as="image" href="\/images\/editorial\/beauty-hero-v2.webp"\/>/,'<link rel="preload" as="image" href="'+escape(meta.image)+'"/>');
 return html.replace('<main id="app" tabindex="-1"></main>',()=>'<main id="app" tabindex="-1">'+productLoading(product,language)+'<noscript>'+(language==='en'?'Enable JavaScript to choose quantities and checkout.':'فعّلي JavaScript لاختيار الكمية وإتمام الطلب.')+'</noscript></main>');
}
export async function productPage(request,env){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 const id=productIdFromPath(new URL(request.url).pathname);if(!id||isRetiredProduct(id))return notFound();
 const product=await env.DB?.prepare('SELECT id,name,description,details_json,image_url FROM products WHERE id=? AND active=1 AND approved=1').bind(id).first();if(!product)return notFound();
 // This fixed, repository-owned HTML shell is small; never buffer arbitrary assets.
 const shell=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url)));
 if(!shell.ok)return shell;
 const headers=new Headers(shell.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','no-cache');headers.delete('etag');headers.delete('last-modified');headers.delete('content-length');
 return new Response(request.method==='HEAD'?null:productPageHtml(await shell.text(),product,new URL(request.url).searchParams.get('lang')==='en'?'en':'ar'),{headers});
}
