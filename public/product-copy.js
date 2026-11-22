export function productMetaDescription(product,language='ar'){
 let d={};try{d=product.details||JSON.parse(product.details_json||'{}')}catch{}
 const name=language==='en'?(d.en?.name||product.name):(d.nameAr||product.name),copy=language==='en'?(d.en?.description||product.description||d.en?.tagline):(product.description||d.tagline);
 const size=d.size?' · '+d.size:'';
 return (String(name||'Trend Shop')+size+' — '+String(copy||'').replace(/\s+/g,' ').trim()).replace(/كوسركس/g,'كوزركس').slice(0,240);
}
