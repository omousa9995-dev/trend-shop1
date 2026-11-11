import {isKoreanCare,isKoreanBrand} from './korean-care.js?v=5.14.0';
import {productDetails,normalizeSearch} from './shop-tools.js';

export function koreanCareChoice(product){
 const value=productDetails(product||{}).koreanCare;
 return value===true?'include':value===false?'exclude':'auto';
}
export function applyKoreanCareChoice(details,choice,brand){
 const next={...details};delete next.koreanCare;
 if(choice==='include')next.koreanCare=true;
 else if(choice==='exclude')next.koreanCare=false;
 next.collection=isKoreanCare({brand,details:next})?'k-beauty':'beauty';
 return next;
}
export function filterAdminProducts(products,{query='',collection='',category='',status=''}={}){
 const words=normalizeSearch(query).split(' ').filter(Boolean);
 return products.filter(p=>{
  const d=productDetails(p),text=normalizeSearch(`${p.id} ${p.name} ${d.nameAr||''} ${d.en?.name||''} ${p.brand} ${p.subcategory||''}`);
  if(!words.every(w=>text.includes(w)))return false;
  if(collection==='korean'&&!isKoreanCare(p)||collection==='other'&&isKoreanCare(p))return false;
  if(category&&p.category!==category)return false;
  const stock=Number(p.stock)||0,active=p.active!==false&&p.active!==0,approved=p.approved===true||p.approved===1;
  if(status==='ready'&&(!active||!approved||stock<=0))return false;
  if(status==='draft'&&approved||status==='hidden'&&active||status==='out'&&stock>0||status==='low'&&(stock<=0||stock>5))return false;
  return true;
 });
}
export function collectionHint(choice,brand){
 const included=choice==='include'||choice==='auto'&&isKoreanBrand(brand);
 if(choice==='auto')return included?'تلقائيًا: سيظهر في Korean care بحسب الماركة. يمكنك تغيير الاختيار.':'تلقائيًا: لن يظهر في Korean care. اختر «إضافة إلى Korean care» لإدراج ماركة كورية جديدة.';
 return included?'سيظهر في Korean care بالإضافة إلى فئته ونوعه، بعد حفظه وإظهاره واعتماده.':'لن يظهر في Korean care، ويبقى في فئته ونوعه المعتادين.';
}
export function publicationHint({active,approved,stock,korean}){
 const destination=korean?'Korean care وفئة المنتج':'فئة المنتج';
 if(!active)return 'المنتج مخفي عن الزبونة. يمكنك حفظه والعمل عليه ثم إظهاره لاحقًا.';
 if(!approved)return 'مسودة غير منشورة: فعّل «السعر والمنتج والمخزون معتمدة» عندما يصبح جاهزًا.';
 if(Number(stock)<=0)return `سيظهر في ${destination} كغير متوفر؛ أضف المخزون المؤكد لإتاحة الشراء.`;
 return `جاهز للظهور والشراء في ${destination} بعد الحفظ.`;
}
