import {productDetails} from './shop-tools.js';
import {productType} from './product-types.js';

export function discoveryHref(query={},patch={}){
 const params=new URLSearchParams(query);
 for(const [key,value] of Object.entries(patch))value===null||value===undefined||value===''?params.delete(key):params.set(key,String(value));
 params.delete('need');
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
