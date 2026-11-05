import {productDetails} from './shop-tools.js';
import {productType} from './product-types.js';
export function fallbackProductProfile(p){
 const d=productDetails(p),profile={id:p.id,brand:p.brand,productName:p.name,primary:p.image||p.image_url,images:[],sources:[],liveSource:true};
 for(const lang of ['ar','en']){
  const english=lang==='en',c=english?{...d,...d.en}:d;
  const usage=String(c.howToUse||'').split(/\n+/).filter(Boolean).map((text,i)=>{const split=text.indexOf(':');return split>0&&split<70?{title:text.slice(0,split),text:text.slice(split+1).trim()}:{title:english?'Your care step '+(i+1):'خطوتكِ '+(i+1),text};});
  const description=english?(d.en?.description||p.description||''):p.description||'';
  profile[lang]={name:english?(d.en?.name||p.name):d.nameAr||p.name,tagline:c.tagline||'',description,benefits:c.benefits||[],textureTitle:english?'A closer look at your choice.':'تفاصيل صغيرة، لاختيار يشبهكِ.',textureText:description,fitText:c.variantNote||c.notes||description,steps:usage,notes:c.notes||'',faq:[{question:english?'How do I use it?':'كيف أستخدمه؟',answer:c.howToUse||(english?'Follow the directions on your actual pack.':'اتبعي إرشادات العبوة المتاحة لديكِ.')},{question:english?'What should I check before choosing?':'ما الذي أراجعه قبل اختياري؟',answer:c.variantNote||c.notes||(english?'Check the pack, size and available options before adding to your bag.':'راجعي صورة العبوة والحجم والخيارات المتاحة قبل إضافته للسلة.')}],productType:productType(p)};
 }
 return profile;
}
