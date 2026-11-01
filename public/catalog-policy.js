// Products permanently removed by the store owner on 2026-11-01.
export const RETIRED_PRODUCT_IDS=Object.freeze(['TS0023','TS0024','TS0050','TS0051','TS0052','TS0053','TS0055','TS0127','TS0156','TS0157','TS0185','TS0186','TS0232']);
const retiredIds=new Set(RETIRED_PRODUCT_IDS);
export const isRetiredProduct=value=>retiredIds.has(typeof value==='string'?value:value?.id);
const productionNote=/(?:ذكاء\s*(?:ال)?اصطناع|artificial\s+intelligence|\bAI\b)/i;
const hasProductionNote=value=>productionNote.test(value.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا'));
export function storeCopy(value){const text=String(value??'');if(!hasProductionNote(text))return text;return text.split(/(?<=[.!؟])\s+|\n+/u).filter(sentence=>!hasProductionNote(sentence)).join(' ').trim()}
export function storefrontProduct(product){
 const p={...product};let details;try{details=typeof p.details==='object'&&p.details?{...p.details}:JSON.parse(p.details_json||'{}')}catch{details={}}
 for(const key of ['imageNote','imageEditedWithAI','introductoryOffer'])delete details[key];
 for(const key of ['nameAr','tagline','howToUse','notes','variantNote'])if(typeof details[key]==='string')details[key]=storeCopy(details[key]);
 if(Array.isArray(details.benefits))details.benefits=details.benefits.map(storeCopy).filter(Boolean);
 for(const key of ['name','description','subcategory','subcat'])if(typeof p[key]==='string')p[key]=storeCopy(p[key]);
 if(p.details)p.details=details;if('details_json'in p)p.details_json=JSON.stringify(details);
 return p;
}
export const storefrontProducts=products=>Array.isArray(products)?products.filter(p=>!isRetiredProduct(p)&&p.active!==0&&p.active!==false).map(storefrontProduct):[];
