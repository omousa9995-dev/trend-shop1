import { normalizeSearch } from '../public/shop-tools.js';
import { lumaText } from './luma-care-knowledge.js';
import { careCatalog } from './care-assistant.js';

const columns = ['id','name','priceFils','category','type','skinTypes','concerns','ingredients','steps','available'];
const compact = (value, limit) => lumaText(Array.isArray(value)?value.join('، '):value,limit);

export function productsContext(products, references = []) {
  const byId = new Map(references.map(product=>[product.id,product]));
  return { currency:'JOD', columns, rows:products.map(product => {
    const stored = byId.get(product.id);
    const reference = stored?.name===product.name&&stored?.brand===product.brand?stored:{};
    const skinTypes = product.skinTypes?.length?product.skinTypes:reference.skinTypes;
    const concerns = product.concerns?.length?product.concerns:reference.concerns?.length?reference.concerns:product.benefits;
    return [
      product.id,compact(product.name,112),product.priceFils??null,compact(product.category,40),product.type||'',
      compact(skinTypes,90),compact(concerns,140),
      compact(product.ingredients||product.activeIngredient,155),compact(product.assistantHowToUse||product.howToUse,280),product.available?1:0
    ];
  }) };
}

export async function readProductSnapshot(env) {
  try {
    const response = await env.ASSETS?.fetch(new Request('https://trendjo.pages.dev/lama-products-snapshot.json'));
    if (response?.ok) {
      const rows = await response.json();
      if (Array.isArray(rows)) return rows;
    }
    const original=await env.ASSETS?.fetch(new Request('https://trendjo.pages.dev/catalog.json'));
    if(!original?.ok)return [];
    return snapshotRecords(careCatalog(sourceCatalog(await original.json()),{includeUnavailable:true}));
  } catch { return []; }
}

const stop = new Set('طيب كيف ما شو هل عندك عندكم اشرح اشرحي اشرحلي احكيلي ايش لو سمحتي ممكن طريقة طريقه استعمال استخدام استخدم استخدمه استخدمها استعمل استعمله استعملها يستخدم تستخدم احط احطه احطها ادمج اخلط بماذا امتى متي باي الوقت بالليل النهار يوميا كل مع علي على من في هذا هاد هاي هال هالمنتج المنتج منتجات منتج حطي استخدمي استخدمها مرة مرات كم كمية الكمية اي و او بترتيب ترتيب بشكل بالتفصيل بالتحديد can how do i use usage apply when with for what is the of it this product routine directions per day morning night'.split(' '));
const alias = [
  [/\bcosrx\b|كوزركس|كوسركس/g,' cosrx '],
  [/\barencia\b|ارينسيا|ارنسيا/g,' arencia '],
  [/\banua\b|انوا/g,' anua '],
  [/\bcerave\b|سيرافي|سيرافيه/g,' cerave '],
  [/skin\s?1004|سكين\s?1004/g,' skin1004 '],
  [/beauty of joseon|بيوتي اوف جوسون/g,' beautyofjoseon ']
];
function matchable(value) {
  let text = normalizeSearch(value);
  for (const [pattern, canonical] of alias) text = text.replace(pattern,canonical);
  return text.split(/\s+/).filter(Boolean).map(word=>word.startsWith('ال')&&word.length>=5?word.slice(2):word).join(' ');
}
export const isLamaUsageQuestion = message => /كيف.{0,36}(?:استخد|استعم|احط|اخلط|ادمج)|طريق[هة].{0,8}(?:الاستخدام|استخدام|الاستعمال|استعمال)|كم مر[هة]|مع شو.{0,12}(?:بدمج|ادمج|اخلط)|متي.{0,18}(?:استخدم|استعمل|احط)|(?:how|when).{0,18}(?:use|apply)|how often|directions/i.test(normalizeSearch(message));

export function latestSuggestedIds(history) {
  for (const turn of [...history].reverse()) {
    if (turn.role !== 'model') continue;
    const ids = turn.text.match(/المنتجات المقترحة:\s*((?:TS[A-Z0-9-]{4,64}[,\s]*)+)/)?.[1].match(/TS[A-Z0-9-]{4,64}/g);
    if (ids?.length) return ids;
  }
  return [];
}

export function usageMatches(message, catalog, history = []) {
  const normalized = normalizeSearch(message);
  const explicit = message.match(/\bTS[A-Z0-9-]{4,64}\b/i)?.[0].toUpperCase();
  if (explicit) return catalog.filter(p => p.id === explicit);
  const asksIndex = /(?:اول|اخر|ثاني|ثالث).{0,12}(?:منتج|اقتراح|واحد)|(?:ال)?منتج.{0,12}(?:اول|اخر|ثاني|ثالث)/.test(normalized);
  const pointsBack = asksIndex || /اقترحتي|نفس المنتج|هالمنتج|هاد المنتج|هذا المنتج|last (?:item|product)|your last suggestion/.test(normalized);
  const ids = latestSuggestedIds(history);
  if (ids.length && (pointsBack || ids.length===1 && /استخدمه|استعمله|استخدمها|احطه|احطها|use it|apply it/.test(normalized))) {
    const index = /اول/.test(normalized)?0:/ثاني/.test(normalized)?1:/ثالث/.test(normalized)?2:ids.length-1;
    return catalog.filter(p=>p.id===ids[index]);
  }
  const words = [...new Set(matchable(message).split(' ').filter(word=>word.length>=2&&!stop.has(word)))];
  if (!words.length) return [];
  const ranked = catalog.map(product=>{
    const label = matchable([product.name,product.nameEn,product.brand,product.id].join(' '));
    return {product,score:words.reduce((score,word)=>score+(label.includes(word)?1:0),0)};
  }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score);
  if (!ranked.length) return [];
  const top = ranked[0].score;
  if (top===1&&words.length>1) return [];
  return ranked.filter(row=>row.score===top).slice(0,3).map(row=>row.product);
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
