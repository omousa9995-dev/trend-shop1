import {loadCareCatalog} from './care-assistant.js';
import {MANAGEMENT_WHATSAPP} from './luma-store-facts.js';
const normalize=s=>String(s||'').normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const money=n=>(n/1000).toFixed(2)+' دينار';
export async function lumaLiveFaq(input,env,catalog){
 const t=normalize(input.message);
 if(/(?:^|\s)(?:ال)?اصلي(?:ة|ه)?(?=$|\s|[؟?.,!])|authentic|genuine|original products/.test(t))return {text:'من حقكِ تتأكدي قبل الطلب ♡ صور العبوة ومعلومات المنتج متاحة على صفحته. تأكيد المصدر ورقم التشغيلة لأي منتج بيكون مع فريق Trend مباشرة، وما بقدر أحكم على أصالته من صورة وحدها. احكيلي أي منتج تقصدي وبساعدكِ بمعلوماته.',team:{label:'اسألي فريق Trend عن مصدر المنتج',href:MANAGEMENT_WHATSAPP}};
 if(!/خصم|عروض|عرض لفتر|السعر|سعره|سعرها|قبل.{0,15}كم|discount|limited.{0,8}offer|previous price/.test(t))return null;
 const products=catalog??await loadCareCatalog(env,{scope:'luma'}),offers=products.filter(p=>p.limitedOffer).sort((a,b)=>a.limitedOffer.slot-b.limitedOffer.slot);
 const stop=new Set(['منتج','المنتج','منتجات','منتجاتكم','بدي','عندكم','السعر','السابق','خصم','فيه','على','بعد','قبل','صار','عرض','عروض','لفترة','محدودة','كم','عليها','سعره','سعرها']);
 const tokens=t.split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>=3&&!stop.has(x));
 const ranked=products.map(p=>{const label=normalize(p.name+' '+p.brand);return {p,score:tokens.reduce((n,w)=>n+(label.includes(w)?1:0),0)}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 let selected=ranked[0]?.score>=2&&(ranked.length===1||ranked[0].score>ranked[1].score)?ranked[0].p:null;
 if(!selected&&tokens.length<2){const last=input.history.filter(x=>x.role==='model').at(-1)?.text||'',ids=[...new Set(last.match(/\bTS[A-Z0-9-]{4,64}\b/g)||[])];if(ids.length===1)selected=products.find(p=>p.id===ids[0]);}
 if(selected){
  const before=selected.referencePriceFils,now=selected.priceFils,discounted=before>now;
  let text=selected.name+'\n'+(discounted?'السعر المعروض قبل الخصم '+money(before)+'، وبعد الخصم '+money(now)+'.':'السعر الحالي '+money(now)+'، وما عليه خصم مفعّل حاليًا.');
  if(selected.limitedOffer)text+='\nهذا عرض لفترة محدودة، ينتهي '+new Intl.DateTimeFormat('ar-JO',{timeZone:'Asia/Amman',dateStyle:'short',timeStyle:'short'}).format(selected.limitedOffer.endsAt*1000)+' بتوقيت الأردن، وبعدها يعود السعر العادي.';
  return {text};
 }
 if(tokens.length>=2&&ranked.length)return null;
 if(/(?:السعر|سعره|سعرها|قبل.{0,15}كم|previous price)/.test(t)&&!/عروض|لفتر/.test(t))return {text:'من عيوني ♡ أي منتج تقصدي؟ احكيلي اسمه أو أرسلي صورته، وبوضح لكِ السعر الحالي والسعر المعروض قبل الخصم إذا كان عليه عرض.'};
 if(offers.length)return {text:'في عروض لفترة محدودة جدًا حاليًا ♡\n'+offers.slice(0,3).map(p=>p.name+' — من '+money(p.limitedOffer.originalPriceFils)+' إلى '+money(p.priceFils)).join('\n')+'\nالوقت المتبقي ظاهر على بطاقات العروض. السعر نفسه يُطبق على المنتج وفي السلة حتى انتهاء العرض.'};
 const discounted=products.some(p=>p.referencePriceFils>p.priceFils);
 return {text:(discounted?'نعم، في خصومات على بعض المنتجات، والسعر قبل الخصم وبعده ظاهر على بطاقة المنتج. ':'')+'حاليًا ما في عرض مؤقت مفعّل. احكيلي اسم المنتج اللي ببالكِ وبوضح لكِ سعره وأي خصم متاح عليه.'};
}
