import {productDetails,normalizeSearch} from './shop-tools.js';
// Stable section URLs; parent categories remain compatible with existing products.
export const PRODUCT_TYPES=[
 ['mascara','المسكارا','المكياج'],['foundation','كريم الأساس','المكياج'],['concealer','الكونسيلر','المكياج'],['powder','البودرة','المكياج'],['primer','البرايمر','المكياج'],['blush','أحمر الخدود','المكياج'],['highlighter','الهايلايتر','المكياج'],['contour','الكونتور','المكياج'],['lips','الشفاه','المكياج'],['brows','الحواجب','المكياج'],['eyeshadow','باليت العيون','المكياج'],['bb-cc','كريمات BB وCC','المكياج'],['nails','الأظافر','المكياج'],
 ['sunscreen','واقي الشمس','البشرة'],['cleanser','الغسول والتنظيف','البشرة'],['toner','التونر','البشرة'],['serum','السيروم','البشرة'],['essence','الإيسنس','البشرة'],['moisturizer','المرطبات والكريمات','البشرة'],['exfoliant','التقشير','البشرة'],['eye-care','العناية بالعين والرموش','البشرة'],['face-mask','ماسكات البشرة','البشرة'],['face-oil','زيوت الوجه','البشرة'],['mist','البخاخات','البشرة'],
 ['shampoo','الشامبو','الشعر'],['conditioner','البلسم','الشعر'],['hair-mask','ماسكات الشعر','الشعر'],['hair-oil','الزيوت والسيروم','الشعر'],['hair-styling','تصفيف الشعر','الشعر'],['body-care','العناية بالجسم','الجسم'],['hair-removal','إزالة الشعر','الأدوات'],['foot-tools','أدوات القدمين','الأدوات']
].map(([id,label,category])=>({id,label,category}));
export function productType(p){
 const d=productDetails(p);if(PRODUCT_TYPES.some(x=>x.id===d.productType))return d.productType;
 const s=normalizeSearch(`${d.nameAr||''} ${p.name||''} ${p.subcategory||p.subcat||''}`),cat=p.category;
 const is=r=>r.test(s);
 if(cat==='الشعر'){if(is(/شامبو|shampoo/))return 'shampoo';if(is(/ماسك|mask/))return 'hair-mask';if(is(/بلسم|conditioner/))return 'conditioner';return is(/زيت|سيروم|oil|serum/)?'hair-oil':'hair-styling'}
 if(cat==='الأدوات')return is(/قدم|foot|pedicure/)?'foot-tools':'hair-removal';
 if(cat==='الجسم')return 'body-care';
 if(cat==='المكياج'){
  const rules=[['mascara',/ماسكارا|مسكارا|mascara/],['bb-cc',/\bbb\b|\bcc\b/],['concealer',/concealer|كونسيلر/],['foundation',/foundation|فاونديشن|كريم اساس/],['primer',/برايمر|primer/],['powder',/بودرة|بودره|powder/],['blush',/بلاشر|بلشر|احمر خدود|blush/],['highlighter',/هايلايتر|highlighter|highlight/],['contour',/كونتور|contour/],['brows',/حواجب|brow/],['lips',/شفاه|شفايف|lip|غلوس|جلوس/],['nails',/اظافر|nail/],['eyeshadow',/عيون|باليت|ظلال|eyeshadow/]];return rules.find(([,r])=>is(r))?.[0]||'';
 }
 if(cat==='البشرة'){
  const rules=[['sunscreen',/واقي|sunscreen|sun block|ريليف صن|relief sun/],['eye-care',/عين|عينين|رموش|eye|lash/],['exfoliant',/تقشير|مقشر|peel|exfoliat/],['cleanser',/غسول|تنظيف|مزيل|cleanser|cleansing/],['toner',/تونر|toner|باد|pad/],['essence',/ايسنس|essence/],['face-oil',/زيت|oil blend/],['mist',/بخاخ|mist|spray/],['face-mask',/ماسك|mask/],['serum',/سيروم|امبول|serum|ampoule|booster/],['moisturizer',/كريم|مرطب|cream|moist/]];return rules.find(([,r])=>is(r))?.[0]||'';
 }
 return '';
}
export function availableTypes(products,category=''){return PRODUCT_TYPES.filter(t=>(!category||t.category===category)&&products.some(p=>productType(p)===t.id))}
export function matchesProductType(p,id){return !id||productType(p)===id}
