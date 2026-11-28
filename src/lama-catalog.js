import { normalizeSearch } from '../public/shop-tools.js';
import { PRODUCT_TYPES } from '../public/product-types.js';
import { lumaText } from './luma-care-knowledge.js';

const columns = ['id','name','brand','type','priceFils','available'];
const typeLabels = new Map(PRODUCT_TYPES.map(({id,label})=>[id,label]));
const typeWords = {
  fragrance:/عطر|عطور|بارفان|برفان|\bperfumes?\b|\bfragrances?\b/,
  sunscreen:/واقي (?:ال)?شمس|sunscreen|sunblock/,
  cleanser:/غسول|منظف (?:ال)?وجه|cleanser|face wash/,
  moisturizer:/مرطب|كريم ترطيب|moisturi[sz]er/,
  toner:/تونر|\btoner\b/,
  essence:/ايسنس|اسنس|\bessence\b/,
  serum:/سيروم|\bserum\b/,
  mascara:/ماس?كارا|ماسكرا|\bmascara\b/,
  concealer:/كونسيلر|\bconcealer\b/,
  foundation:/فاونديشن|كريم اساس|\bfoundation\b/,
  powder:/بودر[هة]|\bpowder\b/,
  lips:/روج|غلوس|ملمع الشفايف|\blip gloss\b|\blipstick\b/,
  blush:/بلاشر|بلاش|احمر خدود|\bblush\b/,
  shampoo:/شامبو|\bshampoo\b/,
  conditioner:/بلسم|\bconditioner\b/,
  deodorant:/مزيل عرق|\bdeodorant\b/,
  'foot-tools':/مبرد قدم|مبرد للكعب|\bfoot file\b/,
  'hair-removal':/شفر[هة]|ازال[هة] الشعر|\bhair removal\b|\brazor\b/
};

export function requestedProductTypes(query) {
  const text=normalizeSearch(query).replace(/(?:خالي\S* من|بدون|بلا) (?:ال)?(?:عطر|عطور)|fragrance free/g,'');
  return Object.entries(typeWords).filter(([,pattern])=>pattern.test(text)).map(([type])=>type);
}

// The per-turn index is intentionally small. Detailed facts are seeded for
// relevant items, and get_catalog can inspect anything in the live inventory.
export function productsContext(products) {
  return {currency:'JOD',columns,rows:products.map(p=>[
    p.id,lumaText(p.name,96),lumaText(p.brand,48),p.type||p.category,p.priceFils,p.available?1:0
  ])};
}

const stop = new Set(`طيب كيف ما شو شنو هل عندك عندكم اشرح اشرحي اشرحلي احكيلي ايش لو سمحتي ممكن طريقة طريقه استعمال استخدام استخدم استخدمه استخدمها استعمل استعمله استعملها يستخدم تستخدم احط احطه احطها ادمج اخلط بماذا امتى متي باي الوقت بالليل النهار يوميا كل مع علي على من في هذا هاد هاي هال هالمنتج المنتج منتجات منتج حطي استخدمي استخدمها مرة مرات كم كمية الكمية اي و او بترتيب ترتيب بشكل بالتفصيل بالتحديد عندكوا لديكم موجود موجوده موجودة متوفر متوفرة متوفره توفر خلص نفد لسه لسا السعر سعر سعره سعرها بكم قديش ثمن سعرات احكي تعرفي عنه عنها معلومات مكونات مكوناته مكوناتها فوائد فوايده فوائده نفحاته نفحاتها ريحته ريحتها رائحته رائحتها رائحة رايحة يعطيني ميزاته مواصفاته وصف تركيز حجمه حجم مل ملي شوفي تبع بدي اريد ابغي اعطيني اشتري اشوف رشحي رشحيلي اقترحي اختاري تنصحيني انسب افضل حلو كويس منيح طيب can how do i you use usage apply when with for what is the of it this product routine directions per day morning night about tell me please have sell available stock sold out price cost much recommend suggest want buy hello scent smell notes ingredients benefits size ml edp edt edc eaude parfum perfume fragrance eau de toilette`.split(/\s+/));
const generic = new Set(`عطر عطرين عطور نسائي نسائية نسايي نسايية انثوي انثوية رجالي للجنسين للنساء للرجال فام بور ناعم ناعمة خفيف خفيفة حلو حلوة زهري زهرية فاكهي فاكهية يومي يومية صباحي مسائي هدية رومنسيه بودري بودرية دافي دافئ منعش سويت غسول سيروم واقي شمس مرطب كريم تونر كونسيلر مسكارا ماسكارا بلسم شامبو زيت فرشاة مكياج للجسم للبشرة women woman feminine men masculine unisex femme homme floral fresh sweet everyday evening gift light oil cream cleanser sunscreen serum shampoo toner mascara brush concealer`.split(/\s+/));
const alias = [
  [/\bcosrx\b|كوزركس|كوسركس/g,' cosrx '],
  [/\barencia\b|ارينسيا|ارنسيا/g,' arencia '],
  [/\banua\b|انوا/g,' anua '],
  [/\bcerave\b|سيرافي|سيرافيه/g,' cerave '],
  [/skin\s?1004|سكين\s?1004/g,' skin1004 '],
  [/beauty of joseon|بيوتي اوف جوسون/g,' beautyofjoseon '],
  [/كايالي|كيالي|\bkayali\b/g,' kayali '],
  [/لطافة|لطافه|\blattafa\b/g,' lattafa '],
  [/افنان|\bafnan\b/g,' afnan '],
  [/غوتشي|قوتشي|\bgucci\b/g,' gucci '],
  [/لانكوم|\blanc[oô]me\b/g,' lancome '],
  [/\b(9)\s*(am|pm)\b/g,' $1$2 ']
];
function matchable(value) {
  let text = normalizeSearch(value).replace(/[٠-٩۰-۹]/g,n=>String(n.charCodeAt(0)&15));
  for (const [pattern, canonical] of alias) text = text.replace(pattern,canonical);
  return text.split(/\s+/).filter(Boolean).map(word=>word.replace(/^(?:(?:و|ب)?ال|لل)(?=[\u0621-\u064a]{3})/,'')).join(' ');
}
export const isLamaUsageQuestion = message => /كيف.{0,36}(?:استخد|استعم|احط|اخلط|ادمج)|طريق[هة].{0,8}(?:الاستخدام|استخدام|الاستعمال|استعمال)|كم مر[هة]|مع شو.{0,12}(?:بدمج|ادمج|اخلط)|متي.{0,18}(?:استخدم|استعمل|احط)|(?:how|when).{0,18}(?:use|apply)|how often|directions/i.test(normalizeSearch(message));
const tokens = value => matchable(value).split(' ').filter(Boolean);
const identityTerms = value => [...new Set(tokens(value).filter(word=>word.length>=2&&!stop.has(word)))];
const matchesWord = (word, target) => word===target || (word.length>=3 && word.startsWith('ب') && word.slice(1)===target);
function identity(p) {
  return [p.id,p.name,p.nameEn,p.brand].join(' ');
}

export function lookupLamaCatalog(catalog,query,max=20) {
  const words=tokens(query);
  if(!words.length)return [];
  return catalog.map(p=>{
    const names=tokens(identity(p));
    const terms=[...names,...tokens([p.category,p.type?.replace(/-/g,' '),typeLabels.get(p.type),p.description,...(p.benefits||[])].join(' '))];
    const matches=(list,word)=>list.some(term=>matchesWord(word,term));
    if(!words.every(word=>matches(terms,word)))return null;
    const score=words.reduce((sum,word)=>sum+(matches(names,word)?3:1),0);
    return {p,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||Number(b.p.available)-Number(a.p.available)).slice(0,max).map(row=>row.p);
}

// A brand or a generic type is not enough to assert a product's identity.
export function namedCatalogMatches(message,catalog) {
  const id=message.match(/\bTS[A-Z0-9-]{4,64}\b/i)?.[0].toUpperCase();
  if(id)return catalog.filter(p=>p.id===id);
  const words=identityTerms(message);
  if(!words.some(word=>!generic.has(word)))return [];
  const ranked=catalog.flatMap(product=>{
    const label=tokens(identity(product)),brand=tokens(product.brand);
    const brandWord=word=>brand.some(term=>matchesWord(word,term));
    const matched=words.filter(word=>label.some(term=>matchesWord(word,term)));
    const distinctive=matched.filter(word=>!generic.has(word)&&!brandWord(word)&&!/^\d+$/.test(word));
    if(!distinctive.length || (matched.length!==words.length && (matched.length<2 || matched.length*2<words.length)))return [];
    const arabicName=identityTerms(product.name.split('·')[0]).filter(word=>!brandWord(word));
    const englishName=identityTerms(product.nameEn?.split(/\beau de\b|\bextrait\b/i)[0]).filter(word=>!brandWord(word));
    const onlyName=words.filter(word=>!brandWord(word)&&!generic.has(word));
    const exact=[arabicName,englishName].some(name=>name.length&&name.length===onlyName.length&&name.every((term,index)=>matchesWord(onlyName[index],term)));
    return [{product,score:matched.length*2+distinctive.length+(exact?5:0)}];
  }).sort((a,b)=>b.score-a.score);
  return ranked.filter(row=>row.score===ranked[0].score).slice(0,4).map(row=>row.product);
}

export function latestSuggestedIds(history) {
  for (const turn of [...history].reverse()) {
    if (turn.role !== 'model') continue;
    const ids = turn.text.match(/المنتجات المقترحة:\s*((?:TS[A-Z0-9-]{4,64}[,\s]*)+)/)?.[1].match(/TS[A-Z0-9-]{4,64}/g);
    if (ids?.length) return ids;
  }
  return [];
}

export function mentionedCatalogProducts(text, catalog) {
  const passage = ' '+matchable(text)+' ';
  return catalog.flatMap(product => {
    const positions = [product.name, product.nameEn].map(name => {
      const title = matchable(String(name || '').split(/[·—]/)[0]);
      return title.includes(' ') ? passage.indexOf(' '+title+' ') : -1;
    }).filter(index => index >= 0);
    return positions.length ? [{product, index: Math.min(...positions)}] : [];
  }).sort((a, b) => a.index-b.index).slice(0, 4).map(match => match.product);
}

export function usageMatches(message, catalog, history = []) {
  const normalized = normalizeSearch(message);
  const matches=namedCatalogMatches(message,catalog);
  if(matches.length||/\bTS[A-Z0-9-]{4,64}\b/i.test(message))return matches;
  const asksIndex = /(?:اول|اخر|ثاني|ثالث).{0,12}(?:منتج|اقتراح|واحد)|(?:ال)?منتج.{0,12}(?:اول|اخر|ثاني|ثالث)/.test(normalized);
  const pointsBack = asksIndex || /اقترحتي|نفس المنتج|هالمنتج|هاد المنتج|هذا المنتج|last (?:item|product)|your last suggestion/.test(normalized);
  const ids = latestSuggestedIds(history);
  if (ids.length && (pointsBack || ids.length===1 && /استخدمه|استعمله|استخدمها|احطه|احطها|use it|apply it/.test(normalized))) {
    const index = /اول/.test(normalized)?0:/ثاني/.test(normalized)?1:/ثالث/.test(normalized)?2:ids.length-1;
    return catalog.filter(p=>p.id===ids[index]);
  }
  return [];
}

export function usageReply(product, english = false) {
  const instructions = english ? product.howToUseEn||product.assistantHowToUse||product.howToUse : product.assistantHowToUse||product.howToUse;
  const verified = product.usage || {};
  const notes = english ? product.notesEn||product.notes : product.notes;
  const steps = (instructions || '').split(/\r?\n+/).map(step=>step.trim()).filter(Boolean);
  const labels = english ? {amount:'Amount',when:'When',combine:'Pairs with',avoid:'Avoid'} : {amount:'الكمية',when:'التوقيت',combine:'مع شو تستخدمينه',avoid:'شو تتجنّبي'};
  const details = english ? [] : Object.entries(labels).flatMap(([key,label])=>verified[key]?[label+' — '+verified[key]]:[]);
  const name = english ? product.nameEn||product.name : product.name;
  const body = steps.map((step,index)=>steps.length>1?(index+1)+'. '+step:step);
  if (!body.length && !details.length) body.push(english ? 'Please use the directions printed on your exact pack.' : 'اتبعي تعليمات الاستخدام المكتوبة على عبوتكِ.');
  if(notes) details.push((english?'Pack notes':'ملاحظة من بيانات المنتج')+' — '+notes);
  const sourceNote = english
    ? 'For any amount, time of day or pairing that is not listed here, use the instructions on your exact pack.'
    : 'إذا الكمية أو التوقيت أو الدمج مش مذكور، خدي هالتفصيل من تعليمات عبوتكِ بدل التخمين.';
  return [name,[...body,...details].join('\n'),sourceNote].join('\n\n');
}

export function sourceCatalog(source) {
  return source.filter(p=>p.active!==false&&p.active!==0).map(p=>({
    ...p,approved:Number(p.approved),stock:Number(p.stock||0),
    price_fils:p.price_fils??p.priceFils,image_url:p.image_url??p.image
  }));
}

export function snapshotRecords(catalog) {
  return catalog.map(({id,name,nameEn,brand,category,type,skinTypes,concerns,ingredients,howToUse,assistantHowToUse,howToUseEn,notes,notesEn,usage,benefits,priceFils}) => ({
    id,name,nameEn,brand,category,type,skinTypes,concerns,ingredients,howToUse,assistantHowToUse,howToUseEn,notes,notesEn,usage,benefits,
    priceFils,available:false
  }));
}
