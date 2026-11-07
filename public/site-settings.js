import {DEFAULT_SITE_SETTINGS} from './site-defaults.js?v=5.6.0';
export {DEFAULT_SITE_SETTINGS};
export const HOME_SECTIONS={hero:'الواجهة الرئيسية',benefits:'مميزات التسوق',categories:'أقسام المنتجات',offers:'العروض والباكجات',picks:'اختيارات المتجر',moments:'لحظات الجمال',korean:'العناية الكورية',callout:'رسالة المتجر',deals:'أسعار لطيفة',reviews:'تجارب الزبائن',trust:'بطاقات الثقة'};
export const PRODUCT_SECTIONS={hero:'الصور والسعر والاختيارات',navigation:'التنقل بين تفاصيل المنتج',about:'عن المنتج',fit:'هل يناسبكِ؟',usage:'طريقة الاستخدام',media:'الصور والفيديوهات',reviews:'التجارب الموثقة',faq:'الأسئلة الشائعة',recommendations:'المنتجات المقترحة',last:'دعوة الاختيار الأخيرة'};
export const SITE_IMAGE_SLOTS=[
 {id:'hero',label:'صورة الواجهة الرئيسية',note:'الصورة الكبيرة أعلى المتجر',ratio:'3:2',url:'/images/editorial/beauty-hero-v2.webp'},
 {id:'skincare',label:'بطاقة العناية بالبشرة',ratio:'4:3',url:'/images/editorial/skincare-ritual.webp'},
 {id:'makeup',label:'بطاقة المكياج',ratio:'4:3',url:'/images/editorial/makeup-moment.webp'},
 {id:'hair',label:'بطاقة العناية بالشعر',ratio:'4:3',url:'/images/editorial/hair-ritual.webp'},
 {id:'body',label:'بطاقة العناية بالجسم',ratio:'4:3',url:'/images/editorial/body-ritual.webp'},
 {id:'fragrance',label:'بطاقة العطور',ratio:'4:3',url:'/images/editorial/fragrance-moment.webp'},
 {id:'tools',label:'بطاقة أدوات الجمال',ratio:'4:3',url:'/images/catalog/marketing/beauty-tools-gateway-nov3-462930c88ef9.webp'},
 {id:'koreanCard',label:'بطاقة Korean care',note:'البطاقة أسفل الأقسام الستة',ratio:'3:2',url:'/images/editorial/korean-care-brands-card-v552.webp'},
 {id:'koreanCover',label:'غلاف صفحة Korean care',note:'الغلاف داخل صفحة العناية الكورية',ratio:'16:9',url:'/images/editorial/korean-care-brands-cover-v552.webp'},
 {id:'callout',label:'صورة رسالة المتجر',note:'الصورة بجانب «ابتسمي، فلا جميلة إلا أنتِ»',ratio:'4:5',url:'/images/editorial/makeup-moment.webp'}
];
export function isSiteImagePath(path){return typeof path==='string'&&path.length<=400&&!path.includes('..')&&!path.includes('//')&&(/^\/images\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp|avif|svg)$/.test(path)||/^\/media\/uploads\/\d{4}-\d{2}\/[a-f0-9-]{36}\.(?:jpe?g|png|webp)$/.test(path));}
export function siteImageUrl(settings,id){const value=settings?.siteImages?.[id];return isSiteImagePath(value)?value:SITE_IMAGE_SLOTS.find(slot=>slot.id===id)?.url||'';}
const strings={storeName:60,sloganAr:180,sloganEn:180,heroTitleAr:180,heroTitleEn:180,heroTextAr:600,heroTextEn:600,privacyAr:7000,privacyEn:7000};
export function normalizeSiteSettings(raw,{productIds}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('إعدادات غير صالحة');
 const value={...DEFAULT_SITE_SETTINGS,version:5,pairPricing:true};
 const images=raw.siteImages===undefined?{}:raw.siteImages;if(!images||typeof images!=='object'||Array.isArray(images))throw Error('صور الموقع غير صالحة');
 value.siteImages={};for(const[id,path]of Object.entries(images)){if(!SITE_IMAGE_SLOTS.some(slot=>slot.id===id)||!isSiteImagePath(path))throw Error('رابط صورة الموقع غير صالح');value.siteImages[id]=path;}
 if(raw.reviewSubmissionsEnabled!==undefined&&typeof raw.reviewSubmissionsEnabled!=='boolean')throw Error('خيار مشاركة التجارب غير صالح');
 value.reviewSubmissionsEnabled=raw.reviewSubmissionsEnabled??false;
 for(const[key,max]of Object.entries(strings)){
  const text=raw[key]??value[key];if(typeof text!=='string'||text.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw Error('راجعي طول النص في '+key);
  value[key]=text.trim();
 }
 if(!value.storeName||!value.privacyAr||!value.privacyEn)throw Error('اسم المتجر ونصا الخصوصية مطلوبان');
 for(const[key,allowed]of [['desktopColumns',[2,3,4]],['mobileColumns',[1,2]]]){value[key]=raw[key]??value[key];if(!allowed.includes(value[key]))throw Error('عدد الأعمدة غير صالح');}
 const order=raw.productOrder??[];if(!Array.isArray(order)||order.length>1000||new Set(order).size!==order.length||order.some(id=>typeof id!=='string'||!/^TS[A-Z0-9-]{4,64}$/.test(id)||productIds&&!productIds.has(id)))throw Error('ترتيب المنتجات غير صالح');value.productOrder=order;
 for(const[key,labels]of [['homeSections',HOME_SECTIONS],['productSections',PRODUCT_SECTIONS]]){
  const rows=raw[key]??value[key];if(!Array.isArray(rows)||rows.length>Object.keys(labels).length||new Set(rows.map(x=>x?.id)).size!==rows.length||rows.some(x=>typeof x?.id!=='string'||!Object.hasOwn(labels,x.id)||typeof x.enabled!=='boolean'))throw Error('ترتيب الأقسام غير صالح');
  value[key]=[...rows.map(x=>({id:x.id,enabled:x.enabled})),...Object.keys(labels).filter(id=>!rows.some(x=>x.id===id)).map(id=>({id,enabled:true}))];
 }
 value.productSections=[{id:'hero',enabled:true},...value.productSections.filter(x=>x.id!=='hero')];
 if(new TextEncoder().encode(JSON.stringify(value)).length>60000)throw Error('الإعدادات أكبر من الحد المسموح');
 return value;
}
export function settingsProductCompare(settings,fallback){
 const ranks=new Map((settings?.productOrder||[]).map((id,i)=>[id,i]));
 return (a,b)=>(ranks.get(a.id)??100000)-(ranks.get(b.id)??100000)||fallback(a,b);
}
export function arrangeSections(container,rows,selectors){
 const nodes=[];for(const row of rows||[]){const node=container.querySelector(selectors[row.id]||':not(*)');if(!node)continue;node.hidden=!row.enabled;node.dataset.settingsDisabled=String(!row.enabled);node.dataset.storeSection=row.id;nodes.push(node);}
 for(const node of nodes)container.append(node);
}
