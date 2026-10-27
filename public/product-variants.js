import {productDetails} from './shop-tools.js';
import {productType} from './product-types.js';
// Store tone preferences are not invented manufacturer shade numbers.
export const SKIN_TONES=[
 {id:'tone-1',label:'1 — فاتح',swatch:'#efd4bb'},
 {id:'tone-2',label:'2 — وسط فاتح',swatch:'#dfb88e'},
 {id:'tone-3',label:'3 — وسط عادي',swatch:'#c49670'},
 {id:'tone-4',label:'4 — حنطي',swatch:'#a77951'}
];
export const isOptionId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,39}$/.test(value);
export function usesSkinTones(p){return ['foundation','powder'].includes(productType(p))}
export function productOptions(p){
 const d=productDetails(p);
 if(usesSkinTones(p))return SKIN_TONES.map(x=>{const code=typeof d.shadeCodes?.[x.id]==='string'?d.shadeCodes[x.id].trim().slice(0,60):'';return{...x,label:x.label+(code?' · '+code:'')}});
 const seen=new Set();return(Array.isArray(d.options)?d.options:[]).slice(0,12).filter(x=>x&&isOptionId(x.id)&&typeof x.label==='string'&&x.label.trim()&&!seen.has(x.id)&&seen.add(x.id)).map(x=>({id:x.id,label:x.label.trim().slice(0,100),swatch:/^#[a-f0-9]{6}$/i.test(x.swatch||'')?x.swatch:''}));
}
export function optionLabel(p){return usesSkinTones(p)?'الدرجة المطلوبة':String(productDetails(p).optionLabel||'الاختيار').slice(0,60)}
export function selectedOption(p,id){return productOptions(p).find(x=>x.id===id)||null}
export function lineKey(item){return item.id+'~'+(isOptionId(item.variant)?item.variant:'')}
export function aggregateCart(items){const map=new Map();for(const x of items)map.set(x.id,(map.get(x.id)||0)+x.qty);return [...map].map(([id,qty])=>({id,qty}))}
export function cartSelectionError(items,products){
 const byId=new Map(products.map(p=>[p.id,p]));const seen=new Set();
 for(const x of items){const p=byId.get(x.id);if(!p)continue;const key=lineKey(x);if(seen.has(key))return 'محتويات السلة مكررة؛ حدّثي الكمية من السلة.';seen.add(key);const options=productOptions(p);if(options.length&&!selectedOption(p,x.variant))return 'اختاري '+optionLabel(p)+' لكل منتج من السلة.';if(!options.length&&x.variant)return 'أحد اختيارات المنتج غير متاح؛ حدّثي السلة.';}
 if(aggregateCart(items).some(x=>x.qty>10))return 'الحد الأقصى 10 قطع من المنتج نفسه، شامل جميع درجاته.';
 return '';
}
export function optionSnapshots(product,items){return items.filter(x=>x.id===product.id).map(x=>{const option=selectedOption(product,x.variant);return option?{id:option.id,label:option.label,qty:x.qty}:null}).filter(Boolean)}
export function savedOptions(item){try{const rows=typeof item.options_snapshot==='string'?JSON.parse(item.options_snapshot):item.options_snapshot;return(Array.isArray(rows)?rows:[]).filter(x=>x&&typeof x.label==='string'&&Number.isInteger(x.qty)&&x.qty>0).map(x=>({label:x.label.slice(0,180),qty:x.qty}))}catch{return[]}}
export function optionSummary(item){return savedOptions(item).map(x=>x.label+' × '+x.qty).join('، ')}
