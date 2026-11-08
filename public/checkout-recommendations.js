import {productType} from './product-types.js';
import {productDetails,normalizeSearch} from './shop-tools.js';
import {brandKey} from './brand-tools.js';
import {productPrice} from './commerce.js';
import {expandPurchaseCart} from './bundles.js';
import {isRetiredProduct} from './catalog-policy.js';

// Complement missing steps across the whole bag. Quantities and line order do
// not turn one item into a stronger signal than another customer selection.
const skin=['moisturizer','sunscreen','cleanser'];
const relations={
 foundation:['concealer','powder','mascara','primer','blush'],
 'bb-cc':['concealer','powder','mascara','blush'],
 concealer:['powder','mascara','foundation','blush'],
 powder:['mascara','concealer','blush','primer'],
 primer:['foundation','concealer','powder','mascara'],
 mascara:['eyeliner','lips','eyeshadow','concealer'],
 eyeliner:['mascara','eyeshadow','lips'],eyeshadow:['mascara','eyeliner','lips'],
 lips:['mascara','blush','eyeliner'],blush:['mascara','lips','highlighter'],
 contour:['blush','powder','highlighter'],highlighter:['blush','lips','mascara'],
 brows:['mascara','concealer','eyeliner'],'setting-spray':['mascara','lips','concealer'],
 cleanser:['moisturizer','sunscreen'],toner:skin,serum:skin,essence:skin,
 exfoliant:skin,'eye-care':skin,'face-mask':skin,'face-oil':skin,mist:skin,
 moisturizer:['sunscreen','cleanser'],sunscreen:['moisturizer','cleanser'],
 'skincare-set':['sunscreen'],
 shampoo:['conditioner','hair-mask','hair-oil'],conditioner:['hair-mask','hair-oil','shampoo'],
 'hair-mask':['shampoo','conditioner','hair-oil'],'hair-oil':['shampoo','hair-mask','conditioner'],
 'hair-styling':['shampoo','hair-mask','hair-oil'],'hair-treatment':['shampoo','hair-mask'],
 'hair-tools':['hair-mask','hair-oil'],
 'body-care':['body-cleansing','body-oil'],'body-cleansing':['body-care','body-oil'],
 deodorant:['body-cleansing','body-care'],'body-oil':['body-care','body-cleansing'],
 'body-scrub':['body-care','body-oil'],'body-sunscreen':['body-care','body-cleansing'],
 'foot-tools':['foot-care'],'foot-care':['foot-tools'],
};
const groups=[
 ['skin-moisture','skin',['moisturizer'],'خطوة ترطيب لروتينكِ','A moisturising step','لتكملي خطوات العناية الموجودة في سلتكِ.','To complement the skincare steps in your bag.'],
 ['skin-day','skin',['sunscreen'],'لروتين النهار','For your daytime routine','اختيارات حماية شمسية لخطوة النهار.','Sun protection choices for your daytime step.'],
 ['skin-cleanse','skin',['cleanser'],'بداية روتين العناية','Start with cleansing','خطوة تنظيف تسبق منتجات العناية التي اخترتِها.','A cleansing step before the skincare you selected.'],
 ['makeup-base','makeup',['concealer','powder','primer','foundation','bb-cc','setting-spray'],'لمسات للبشرة والإطلالة','Complete your base','خطوات مختلفة تكمّل مكياج البشرة في طلبكِ.','Different steps to complement your selected makeup.'],
 ['makeup-eyes','makeup',['mascara','eyeliner','eyeshadow','brows'],'لإكمال مكياج العين','Complete your eye makeup','لمسات للعين تنسجم مع اختيارات المكياج.','Eye makeup touches to go with your selections.'],
 ['makeup-colour','makeup',['lips','blush','highlighter','contour'],'لمسة لون أخيرة','A finishing touch of colour','خيارات للون تكمّل الإطلالة، بحسب ذوقكِ.','Colour choices to finish the look, in your own style.'],
 ['hair-wash','hair',['shampoo','conditioner'],'لخطوات غسل الشعر','For your hair wash','اختيارات تكمّل خطوات عناية الشعر في سلتكِ.','Choices to complement the haircare in your bag.'],
 ['hair-care','hair',['hair-mask','hair-oil'],'للعناية بخصلاتكِ','Care for your lengths','خطوة عناية إضافية للشعر الذي دلّلتِه باختياراتكِ.','Another haircare step to complement your choices.'],
 ['body-care','body',['body-care','body-oil','body-cleansing'],'لتكملي عناية الجسم','Complete your bodycare','خطوات مختلفة للتنظيف والعناية بالجسم.','Different cleansing and bodycare steps.'],
 ['foot-care','feet',['foot-care','foot-tools'],'لإكمال عناية القدمين','Complete your foot care','اختيار مكمّل لأدوات أو عناية القدمين في طلبكِ.','A complement to your selected footcare or tools.'],
].map(([id,family,types,titleAr,titleEn,reasonAr,reasonEn])=>({id,family,types,titleAr,titleEn,reasonAr,reasonEn}));

// Broad routine complements only. Do not infer skin conditions or automatically
// combine concentrated treatments, exfoliants or specialised intimate products.
function routineCandidate(p){
 const d=productDetails(p),name=normalizeSearch(`${p.name||''} ${d.nameAr||''}`);
 return !/retinol|retinal|tretinoin|adapalene|\b(?:aha|bha|pha)\b|glycolic|salicylic|lactic|exfoliat|peeling|hydroquinone|kojic|whitening|brightening|snow.?white|dark.?spot|acne|anti.?spot|intimate|ريتين|جلايكولي|جليكولي|ساليسيليك|تقشير|مقشر|تفتيح|تبييض|حميم|كوجي/.test(name);
}
const available=p=>p&&!isRetiredProduct(p)&&p.active!==0&&p.active!==false&&p.approved!==false&&p.approved!==0&&Number(p.stock)>0&&Number.isInteger(productPrice(p))&&productPrice(p)>0;

export function checkoutRecommendations(products,cart,{promotions=[],maxGroups=4,perGroup=3}={}){
 const byId=new Map(products.map(p=>[p.id,p]));let expanded;
 try{expanded=expandPurchaseCart(cart,products,promotions)}catch{return []}
 const owned=new Set(expanded.map(x=>x.id)),selected=[...owned].map(id=>byId.get(id)).filter(Boolean);
 const steps=new Set(selected.map(productType)),brands=new Set(selected.map(p=>brandKey(p.brand)).filter(Boolean));
 if(steps.has('foundation')||steps.has('bb-cc')){steps.add('foundation');steps.add('bb-cc')}
 const wanted=new Map();
 for(const step of [...steps].sort())for(const [rank,type]of (relations[step]||[]).entries()){
  if(steps.has(type))continue;
  const signal=wanted.get(type)||{score:0,support:0};signal.score=Math.max(signal.score,120-rank*10);signal.support++;wanted.set(type,signal);
 }
 // An empty bag can still be rebuilt from this control, without opening search.
 if(!selected.length&&!cart.length)for(const type of ['cleanser','moisturizer','mascara','lips'])wanted.set(type,{score:60,support:1});
 const prices=selected.map(productPrice).filter(x=>x>0).sort((a,b)=>a-b),budget=prices[Math.floor(prices.length/2)]||5000;
 const seen=new Set(),candidates=[];
 for(const p of products){
  const type=productType(p),signal=wanted.get(type);
  if(!signal||steps.has(type)||owned.has(p.id)||seen.has(p.id)||!available(p)||!routineCandidate(p))continue;
  seen.add(p.id);const score=signal.score+Math.min(3,signal.support-1)*8+(brands.has(brandKey(p.brand))?4:0)+6/(1+Math.abs(Math.log(productPrice(p)/budget)));
  candidates.push({product:p,type,score});
 }
 candidates.sort((a,b)=>b.score-a.score||a.product.id.localeCompare(b.product.id));
 const result=groups.map(group=>{
  const rows=candidates.filter(x=>group.types.includes(x.type)),chosen=[],types=new Set();
  // First offer different complementary steps, then a second brand/price choice.
  for(const row of rows)if(!types.has(row.type)&&chosen.length<perGroup){chosen.push(row);types.add(row.type)}
  for(const row of rows)if(chosen.length<perGroup&&!chosen.includes(row))chosen.push(row);
  return {...group,items:chosen,score:chosen[0]?.score||0};
 }).filter(g=>g.items.length).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 // Give each relevant family a place in a mixed bag before filling spare groups.
 const picked=[],families=new Set();
 for(const group of result)if(!families.has(group.family)&&picked.length<maxGroups){picked.push(group);families.add(group.family)}
 for(const group of result)if(picked.length<maxGroups&&!picked.includes(group))picked.push(group);
 return picked;
}
