import {productDetails,normalizeSearch} from './shop-tools.js';
import {productType} from './product-types.js';

// Discovery uses the saved product benefits and type, never usage warnings or reviews.
export const SHOPPING_NEEDS = [
 {id:'cleansing',ar:'التنظيف',en:'Cleansing',noteAr:'غسول ومنظفات لروتينكِ',noteEn:'Cleansers for your routine',icon:'cleanse'},
 {id:'hydration',ar:'الترطيب',en:'Hydration',noteAr:'عناية بإحساس الجفاف',noteEn:'Care for a dry skin feel',icon:'drop'},
 {id:'sun-care',ar:'الحماية من الشمس',en:'Sun care',noteAr:'واقي الشمس لخطوة النهار',noteEn:'Sunscreen for your day',icon:'sun'},
 {id:'glow',ar:'الإشراقة وتجانس اللون',en:'Glow & even-looking tone',noteAr:'عناية بمظهر البهتان والبقع',noteEn:'Care for dullness and uneven-looking tone',icon:'spark'},
 {id:'hair-care',ar:'العناية بالشعر',en:'Hair care',noteAr:'اختيارات لخصلاتكِ وروتينها',noteEn:'Choices for your hair routine',icon:'hair'}
];
export const shoppingNeed = id => SHOPPING_NEEDS.find(need=>need.id===id);
export function matchesShoppingNeed(product,id){
 if(!shoppingNeed(id))return true;
 const d=productDetails(product),type=productType(product);
 if(id==='cleansing')return ['cleanser','body-cleansing'].includes(type);
 if(id==='sun-care')return ['sunscreen','body-sunscreen'].includes(type);
 if(id==='hair-care')return product.category==='الشعر';
 if(product.category!=='البشرة'||['cleanser','exfoliant','sunscreen','eye-care'].includes(type))return false;
 const text=normalizeSearch([product.name,d.nameAr,d.en?.name,...(Array.isArray(d.benefits)?d.benefits:[]),...(Array.isArray(d.en?.benefits)?d.en.benefits:[])].join(' '));
 if(id==='hydration')return /ترطيب|مرطب|رطوبه|hydrat|moisturi/.test(text);
 return /اشراق|تجانس|توحيد|تفتيح|تصبغ|بقع|brighten|illuminat|dark spot|glow|even.{0,10}tone/.test(text);
}
export function availableShoppingNeeds(products){return SHOPPING_NEEDS.filter(need=>products.some(p=>matchesShoppingNeed(p,need.id)))}

export function discoveryHref(query={},patch={}){
 const params=new URLSearchParams(query);
 for(const [key,value] of Object.entries(patch))value===null||value===undefined||value===''?params.delete(key):params.set(key,String(value));
 return '#/shop'+(params.size?'?'+params.toString():'');
}

const TYPE_SUMMARIES={
 cleanser:['خطوة تنظيف في بداية روتينكِ','A cleansing step to start your routine'],
 sunscreen:['واقي شمس لروتين النهار','Sunscreen for your daytime routine'],
 'body-sunscreen':['حماية من الشمس للجسم','Sun care for the body'],
 mascara:['لمسة للرموش في إطلالتكِ','A finishing touch for your lashes'],
 foundation:['قاعدة للمكياج؛ اختاري درجتكِ','A makeup base; choose your shade'],
 concealer:['تغطية موضعية لإطلالتكِ','Targeted coverage for your look'],
 lips:['لمسة لون أو عناية للشفاه','A touch of colour or care for lips'],
 shampoo:['تنظيف الشعر ضمن روتينكِ','Hair cleansing for your routine'],
 'hair-mask':['خطوة عناية لخصلاتكِ','A care step for your hair']
};
export function productCardSummary(product,language='ar'){
 const d=productDetails(product),english=language==='en';
 const benefits=english?d.en?.benefits:d.benefits;
 const first=Array.isArray(benefits)?benefits.find(value=>typeof value==='string'&&value.trim()):'';
 const fallback=TYPE_SUMMARIES[productType(product)]?.[english?1:0]||'';
 const summary=String(first||fallback).replace(/\s+/g,' ').trim();
 if(summary.length<=100)return summary;
 const short=summary.slice(0,97),space=short.lastIndexOf(' ');
 return short.slice(0,space>65?space:97).trim()+'…';
}
export function productSizeLabel(product,language='ar'){
 const d=productDetails(product);
 if(language!=='en')return typeof d.size==='string'?d.size:'';
 if(typeof d.en?.size==='string'&&d.en.size.trim())return d.en.size.trim();
 const size=String(d.size||'').replace(/غرام|جرام|غم|جم/g,'g').replace(/ملليلتر|ملليتر|مل/g,'ml').trim();
 return /[\u0600-\u06ff]/.test(size)?'':size;
}
