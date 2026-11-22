import {BUYING_GUIDES,buyingGuide,buyingGuideHtml,guideProducts} from '../public/buying-guides.js';
import {storefrontProducts} from '../public/catalog-policy.js';
import {productUrl,STORE_ORIGIN} from '../public/product-links.js';
import {loadLimitedOffers,applyLimitedOffers} from './limited-offers.js';
import {escapeHtml as e,jsonLd,replaceShellMetadata,seoProductCard,publicImage,productName,priceOf,priceText,detailsOf} from './seo.js';

export async function seoCatalog(env){
 const result=await env.DB.prepare('SELECT id,brand,name,category,subcategory,description,details_json,image_url,price_fils,reference_price_fils,discount_percent,stock,active,approved,updated_at FROM products WHERE active=1 AND approved=1 ORDER BY id LIMIT 1000').all();
 return applyLimitedOffers(storefrontProducts(result.results||[]),await loadLimitedOffers(env)).filter(p=>priceOf(p)>0);
}
const textResponse=(body,type,request,status=200)=>new Response(request.method==='HEAD'?null:body,{status,headers:{'content-type':type+'; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}});
export async function discoveryPage(request,env){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 const path=new URL(request.url).pathname;
 if(path==='/sitemap.xml'){
  const products=await seoCatalog(env),entries=[{loc:STORE_ORIGIN+'/'},...BUYING_GUIDES.map(g=>({loc:STORE_ORIGIN+g.path})),...products.map(p=>{const date=new Date(String(p.updated_at||'').replace(' ','T')+'Z');return{loc:productUrl(p.id),lastmod:Number.isFinite(date.getTime())?date.toISOString():''}})];
  return textResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(x=>'<url><loc>'+e(x.loc)+'</loc>'+(x.lastmod?'<lastmod>'+e(x.lastmod)+'</lastmod>':'')+'</url>').join('')+'</urlset>','application/xml',request);
 }
 if(path==='/google-products.xml'){
  const products=await seoCatalog(env);
  const items=products.map(p=>{
   const d=detailsOf(p),size=d.size?'; '+d.size:'',base=p.limitedOffer?.originalPriceFils;
   return '<item><g:id>'+e(p.id)+'</g:id><g:title>'+e(productName(p)+size)+'</g:title><g:description>'+e(p.description||d.tagline||productName(p))+'</g:description><g:link>'+e(productUrl(p.id))+'</g:link><g:image_link>'+e(publicImage(p))+'</g:image_link><g:brand>'+e(p.brand)+'</g:brand><g:condition>new</g:condition><g:availability>'+(Number(p.stock)>0?'in_stock':'out_of_stock')+'</g:availability><g:price>'+((base||priceOf(p))/1000).toFixed(2)+' JOD</g:price>'+(base?'<g:sale_price>'+priceText(p)+' JOD</g:sale_price><g:sale_price_effective_date>'+e(new Date(p.limitedOffer.startsAt*1000).toISOString()+'/'+new Date(p.limitedOffer.endsAt*1000).toISOString())+'</g:sale_price_effective_date>':'')+'<g:shipping><g:country>JO</g:country><g:service>توصيل لجميع الأردن</g:service><g:price>'+(priceOf(p)>19000?'0.00':'1.00')+' JOD</g:price></g:shipping></item>';
  }).join('');
  return textResponse('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Trend Shop</title><link>'+STORE_ORIGIN+'/</link><description>منتجات Trend Shop المتوفرة في الأردن</description>'+items+'</channel></rss>','application/xml',request);
 }
 const guide=buyingGuide(path);
 if(!guide)return textResponse('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>الصفحة غير موجودة | Trend Shop</title><h1>هذه الصفحة غير موجودة</h1><a href="/">المتجر</a></html>','text/html',request,404);
 const products=await seoCatalog(env),selected=guideProducts(guide,products),url=STORE_ORIGIN+guide.path,language=new URL(request.url).searchParams.get('lang')==='en'?'en':'ar',title=(language==='en'?guide.titleEn:guide.title)+' | Trend Shop';
 const structured={'@context':'https://schema.org','@type':'CollectionPage',name:guide.title,description:guide.description,url,mainEntity:{'@type':'ItemList',itemListElement:selected.map((p,i)=>({'@type':'ListItem',position:i+1,name:productName(p),url:productUrl(p.id)}))}};
 const shell=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url)));if(!shell.ok)return shell;
 const html=replaceShellMetadata(await shell.text(),{title,description:guide.description,url,image:selected[0]?publicImage(selected[0]):STORE_ORIGIN+'/images/editorial/beauty-hero-v2.webp',language,structuredData:jsonLd(structured),content:buyingGuideHtml(guide,products,{language,renderCard:p=>seoProductCard(p,language)})});
 return textResponse(html,'text/html',request);
}
