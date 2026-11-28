import {normalizeSearch} from '../public/shop-tools.js';
import {shippingFee} from '../public/commerce.js';
import {latestSuggestedIds, mentionedCatalogProducts, namedCatalogMatches, usageReply} from './lama-catalog.js';
import {lumaProductAllowed, lumaText} from './luma-care-knowledge.js';

export const FRAGRANCE_AUDIENCES = ['women','men','unisex'];
const audiences = {
  women: /(?:^| )(?:نسائي\S*|نسايي\S*|انثوي\S*|بناتي|للنساء|للسيدات|للبنات|لزوجتي|لامي|لصديقتي|(?:for|for my) (?:women|her|ladies|wife|sister|mother|girlfriend)|women\b|feminine\b|(?:pour )?femme\b)/,
  men: /(?:^| )(?:رجالي\S*|للرجال|للشباب|لزوجي|لابوي|لابي|لاخوي|(?:for|for my) (?:men|him|husband|brother|father|boyfriend)|men\b|masculine\b|(?:pour )?homme\b)/,
  unisex: /(?:للجنسين|للنساء والرجال|للرجال والنساء|(?:لل)?كل الجنسين|\bunisex\b|\bfor everyone\b|\bfor both\b|\b(?:men and women|women and men)\b)/
};
const perfumeWord = /(?:^| )(?:ب|ال|بال)?(?:عطر(?:ي|ين|ان|كم)?|عطور(?:كم)?|برفان|بارفان|بيرفيوم)(?= |$)|\b(?:perfumes?|fragrances?|colognes?)\b/;
const shopVerb = /بدي|اريد|ابغي|محتاج|بدور|بدنا|رشح|اقترح|نصح|بتنصح|(?:وين|اي|شو|ايش|شنو).{0,15}(?:في|احلى|افضل|انسب|اختار)|افضل|انسب|عندكم|عندكو|متوفر|شو في|جديد|\b(?:want|looking for|recommend|suggest|best|which|do you have|available|in stock)\b/;
const noProducts = /بدون منتجات|من غير منتجات|مش بدي منتجات|نصائح فقط|نصايح فقط|without products|advice only/;
const nonPerfume = /خالي\S* (?:من )?(?:ال)?عطور|(?:بدون|بلا|من غير) (?:اي )?(?:عطر|عطور)|fragrance free|unscented/;
const noteQuestion = /نفحات|مكونات|نوتات|تركيبته|ريحته|ريحتها|رائحته|رائحتها|شو ريح|كيف ريح|scent notes|ingredients|smell like|what does .+ smell/;
const ingredientQuestion = /مكونات|تركيبته|ingredients/;
const priceQuestion = /سعر|اسعار|كم.{0,10}دينار|بكم|قديش|خصم|\b(?:price|cost|how much|discount)\b/;
const stockQuestion = /موجود|توفر|متوفر|خلص|نفد|عندكم|\b(?:available|in stock|sold out|do you (?:have|sell))\b/;
const detailQuestion = /احكيلي|معلومات|تفاصيل|فوائد|مواصفات|حجم|تركيز|فرق|اشرح|tell me|details|benefits|size|concentration|compare/;
const recentRequest = /وصل حديث|وصل جديد|احدث|اخر.{0,8}(?:عطر|عطور)|عطور جديد|عطر جديد|just arrived|newest|new arrivals|latest perfume/;
const exactlyOne = /عطر واحد|بس واحد|واحد بس|خيار واحد|واحد منهم|\b(?:one perfume|just one|only one|one option)\b/;
const alternatives = /غيرهم|بديل|خيار (?:تاني|ثاني|اخر)|اقتراح (?:تاني|ثاني|اخر)|\b(?:alternatives?|another|something else)\b/;
const asksForSale = /خصم|(?:على|ضمن|بعرض) عرض|\bon sale\b|\bdiscounted\b/;
const scentCaution = /حساسي|حامل|رضاع|صداع|ربو|حرق|allerg|asthma|headache|pregnan/;

const styles = [
  {id:'floral', ar:'زهري', en:'floral', query:/زهر|ورد |ياسمين|فلورا|\b(?:floral|rose|jasmine)\b/, facts:/زهر|ورد(?:ة|ه)?(?= |$)|ياسمين|غاردينيا|ماغنوليا|اوركيد|مسك الروم|floral|magnolia|jasmine|orchid|gardenia|tuberose|orange blossom|\brose\b/},
  {id:'fresh', ar:'منعش', en:'fresh', query:/منعش|انتعاش|حمضي|نظيف|للصيف|صيفي|\b(?:fresh|citrus|clean|summer)\b/, facts:/انتعاش|منعش|حمضي|برغموت|جريب فروت|ليمون|مندرين|نعناع|fresh|citrus|bergamot|grapefruit|lemon|mint|mandarin/},
  {id:'sweet', ar:'حلو', en:'sweet', query:/حلو|حلاو|سكري|فانيلا|كراميل|مارشميلو|غورمان|\b(?:sweet|vanilla|gourmand|caramel|marshmallow)\b/, facts:/حلو|حلاو|سكر|فانيلا|كراميل|مارشميلو|برالين|شوكولات|sweet|vanilla|gourmand|caramel|marshmallow|praline|candy/},
  {id:'fruity', ar:'فاكهي', en:'fruity', query:/فاكه|فواكه|فراولة|توت|\b(?:fruity|fruit|berries|strawberry)\b/, facts:/فاكه|توت|فراول|كشمش|كمثري|استواي|اناناس|تفاح|fruity|fruit|berry|berries|strawberry|blackcurrant|pear|pineapple|apple/},
  {id:'soft', ar:'ناعم', en:'soft', query:/ناعم|خفيف|هادي|هادئ|بودري|\b(?:soft|light|subtle|powdery)\b/, facts:/ناعم|خفيف الاحساس|نعوم|بودري|soft|subtle|light feel|powdery/},
  {id:'warm', ar:'دافئ', en:'warm', query:/داف[يء]|دافي|دفا|بهار|توابل|شرقي|قرفة|\b(?:warm|spicy|oriental|cinnamon)\b/, facts:/داف|دفء|دفا|توابل|قرف|فلفل|عنبر|warm|spice|spicy|cinnamon|amber/},
  {id:'woods', ar:'خشبي', en:'woody', query:/خشب|عود|صندل|\b(?:woody|oud|sandalwood|cedar)\b/, facts:/خشب|عود|صندل|ارز|\b(?:woody|oud|sandalwood|cedar|woods)\b/},
  {id:'day', ar:'للنهار', en:'for daytime', query:/يومي|نهار|دوام|جامعة|صباح|\b(?:daily|daytime|office|work|day wear)\b/, facts:/يومي|نهار|للعمل|مشاوير|صباح|\b(?:daily|daytime|office|workday|day wear)\b/},
  {id:'night', ar:'للمساء', en:'for evenings', query:/سهر|مسا[ءي]|ليلي|عشا|مناسبات|مناسبة خاصة|\b(?:evening|night|dinner|night out|occasion)\b/, facts:/سهر|مسا[ءي]|مناسبه خاصه|مناسبة خاصة|مناسبات|امسي|عشا|\b(?:evening|evenings|night|dinner|occasion)\b/}
];

export const avoidScentSuggestions = input => {
  const message=normalizeSearch(input.message);
  return input.warningSigns||noProducts.test(message)||nonPerfume.test(message)||scentCaution.test(message);
};

function fragranceAudience(normalized, allowBoth = true) {
  if(audiences.unisex.test(normalized))return 'unisex';
  const women=audiences.women.test(normalized),men=audiences.men.test(normalized);
  return women&&men ? (allowBoth?'unisex':'') : women?'women':men?'men':'';
}

export function fragranceFacts(p,d) {
  const title=[p.name,d.nameAr,d.en?.name,p.subcategory,d.variantNote,d.tagline].join(' ');
  const declared=FRAGRANCE_AUDIENCES.includes(d.fragranceAudience)?d.fragranceAudience:
    fragranceAudience(normalizeSearch(title),false);
  // Language in the saved copy can explicitly say for women/men. Actual scent
  // notes and the customer's gender cannot establish how a product is marketed.
  const audience=declared||fragranceAudience(normalizeSearch([p.description,d.en?.description].join(' ')),false);
  const facts=normalizeSearch([p.description,d.en?.description,d.tagline,d.benefits,d.en?.benefits].join(' '));
  return {audience,styles:styles.filter(rule=>rule.facts.test(facts)).map(rule=>rule.id)};
}

export function fragranceRequest(input) {
  const message=normalizeSearch(input.message);
  if(input.image||avoidScentSuggestions(input))return null;
  const ignored=message.match(/(?:بدون|بلا|ما بحب|ما بدي|مش حاب|مش|without|no|not|don t like) (.{2,46})/);
  const positive=ignored?message.slice(0,ignored.index).trimEnd():message;
  const audience=fragranceAudience(positive);
  const hasStyle=styles.some(rule=>rule.query.test(positive));
  const userHistory=input.history.filter(turn=>turn.role==='user');
  const previous=userHistory.slice(-4).reverse().map(turn=>normalizeSearch(turn.text))
    .find(turn=>perfumeWord.test(turn)&&!nonPerfume.test(turn));
  const mentionsPerfume=perfumeWord.test(message)||!!audience&&/ريح[هة]|رائح[هة]|\bscent\b/.test(message);
  const scoped=mentionsPerfume || !!previous && (message.length<90 && (audience||hasStyle||alternatives.test(message))) &&
    !/بشر|غسول|واقي|مرطب|مكياج|روج|سيروم|مسكار|كونسيلر|skincare|makeup|foundation|cleanser|sunscreen|shampoo/.test(message);
  if(!scoped)return null;
  const asksForSuggestion=mentionsPerfume&&(shopVerb.test(positive)||audience||hasStyle||recentRequest.test(message)||/^(?:ال)?(?:عطر(?:ين)?|عطور)$/.test(positive))||
    !mentionsPerfume&&(audience||hasStyle||alternatives.test(message));
  if(!asksForSuggestion||mentionsPerfume&&!shopVerb.test(message)&&(detailQuestion.test(message)||priceQuestion.test(message)||noteQuestion.test(message)))return null;
  // Reuse only the latest explicit fragrance turn, and never inherit it into a
  // new product category or override the current scent request.
  const query=(!mentionsPerfume&&previous?previous+' ':'')+positive;
  const negativePart=ignored?.[1]||'';
  const exclude=styles.filter(rule=>rule.query.test(negativePart)).map(rule=>rule.id);
  const desired=styles.filter(rule=>rule.query.test(query)&&!exclude.includes(rule.id)).map(rule=>rule.id);
  return {
    audience:audience||(!mentionsPerfume&&previous?fragranceAudience(previous):''),
    desired,
    exclude,
    latest:recentRequest.test(message),onSale:asksForSale.test(positive),
    count:exactlyOne.test(message)?1:2,
    excludedIds:alternatives.test(message)?latestSuggestedIds(input.history):[]
  };
}

const isEnglish = message => !/[\u0600-\u06ff]/.test(message);
const nameOf = (p,en) => en?p.nameEn||p.name:p.name;
const money = (fils,en) => (fils/1000).toFixed(2)+(en?' JOD':' د.أ');
const firstSentence = text => lumaText(text,440).split(/(?<=[.!؟])\s+|\n/)[0];

const cardVerb = /^(?:(?:طيب|تمام|ممكن|لو سمحتي|please|okay) )*(?:(?:ارسلي(?:لي)?|ارسل لي|ابعتي(?:لي)?|ابعثي(?:لي)?|فرجيني|ورجيني|وريني|اعرضي(?:لي)?|اعطيني)(?: لي)?|(?:send|show|give) me)(?: |$)/;
const productReference = /^(?:(?:رابط|لينك|بطاق[هة]|the link to) )?(?:المنتج|هالمنتج|هاد المنتج|هدا المنتج|هذا المنتج|هالاختيار|the product|the item|it|the link)(?: (?:الاول|الثاني|التاني|الثالث|الاخير|اللي.{1,24}|you (?:recommended|suggested)))?$/;
const sendPronoun = /^(?:(?:طيب|تمام|ممكن) )?(?:ارسليه|ارسليها|ابعتيه|ابعتيها|ابعثيه|ورجيني اياه|send it|show it)$/;

export function productCardIntent(message) {
  const text = normalizeSearch(message);
  if (noProducts.test(text)) return false;
  const target = text.replace(cardVerb, '');
  return sendPronoun.test(text) || productReference.test(text) ||
    (target !== text && !/طريق[هة]|كيف|قبل|بعد|مكونات|سعر|رد|نص|معلومات|تفاصيل|description|directions|instructions|ingredients|price/.test(target));
}

export function resolveRequestedCard(input, catalog) {
  const text = normalizeSearch(input.message);
  const en = isEnglish(input.message);
  const target = text.replace(cardVerb, '').replace(/^(?:رابط|لينك|بطاق[هة]|the link (?:to|for)) /, '');
  const pointsBack = sendPronoun.test(text) || productReference.test(text) || productReference.test(target);
  let products = pointsBack ? [] : namedCatalogMatches(target, catalog);
  if (pointsBack) {
    const latest = input.history.at(-1);
    if (latest?.role === 'model') {
      const ids = latestSuggestedIds([latest]);
      products = ids.length ? ids.map(id => catalog.find(p => p.id === id)) : mentionedCatalogProducts(latest.text, catalog);
    }
    const index = /الاول|\bfirst\b/.test(target) ? 0 : /الثاني|التاني|\bsecond\b/.test(target) ? 1 :
      /الثالث|\bthird\b/.test(target) ? 2 : /الاخير|\blast\b/.test(target) ? products.length-1 : null;
    if (index !== null) products = products.slice(index < 0 ? products.length : index, index+1);
  }
  if (products.length === 1 && products[0]) return products[0];
  const choices = products.filter(Boolean).map(p => ({label:nameOf(p,en),value:p.id}));
  if (choices.length || pointsBack) return {type:'question',question:{
    field:'catalogProduct',mode:'display',
    text:choices.length?(en?'Which one would you like to open?':'أي واحد فيهم بدك تشوفي بطاقته؟'):
      (en?'Which product should I look up? You can send me its name or brand.':'أي منتج قصدك؟ ابعتيلي اسمه أو ماركته وبفتحه لكِ.'),
    choices
  }};
  return null;
}

function fragranceReason(p,request,en) {
  const profile=p.fragrance?.styles||[];
  const matches=styles.filter(rule=>(request.desired.length?request.desired:profile).includes(rule.id)&&profile.includes(rule.id)).slice(0,2);
  const notes=en&&p.benefitsEn?.length?p.benefitsEn:p.benefits||[];
  const preferredNote=notes.find(note=>matches.some(rule=>rule.facts.test(normalizeSearch(note))));
  const note=lumaText(preferredNote||notes[0],150).replace(/^(?:المقدمة|القلب|القاعدة) من /,'');
  const family=matches.map(rule=>rule[en?'en':'ar']).join(en?' and ':'، ');
  if(note&&family)return en?family+' · '+note:'طابعه '+family+'، ومن نفحاته '+note+'.';
  return note||firstSentence(en?p.descriptionEn||p.description:p.description)||
    (en?'Available in the fragrance range.':'من العطور المتوفرة حاليًا. راجعي وصف العبوة لتفاصيل الرائحة.');
}

export function fragrancePlan(catalog,input,request) {
  const en=isEnglish(input.message);
  const target=request.audience;
  const base=catalog.filter(p=>p.type==='fragrance'&&p.available&&lumaProductAllowed(p,input)&&!input.existingIds.includes(p.id)&&
    !(request.excludedIds||[]).includes(p.id)&&(!target||p.fragrance?.audience===target)&&
    (!request.onSale||p.referencePriceFils>p.priceFils)&&
    !(p.fragrance?.styles||[]).some(style=>request.exclude.includes(style)));
  const fit=base.filter(p=>input.budgetFils===null||p.priceFils+(input.includeDelivery?shippingFee(p.priceFils):0)<=input.budgetFils);
  const ranked=fit.map(p=>({
    p,score:request.desired.filter(tag=>p.fragrance?.styles.includes(tag)).length
  })).filter(({score})=>!request.desired.length||score>0).sort((a,b)=>
    (request.latest?(b.p.createdAt||'').localeCompare(a.p.createdAt||''):0)||
    b.score-a.score||
    Number(!!b.p.fragrance?.audience)-Number(!!a.p.fragrance?.audience)||
    b.p.benefits.length-a.p.benefits.length||
    (b.p.createdAt||'').localeCompare(a.p.createdAt||'')||
    a.p.priceFils-b.p.priceFils);
  if(!ranked.length)return {type:'answer',message:en
    ? 'I couldn’t confirm an in-stock match for that request from the current fragrance range. I can check a different scent style or the unisex options if you like.'
    : 'ما لقيت من المتوفّر حاليًا عطر أقدر أتأكد إنه بطابق هالطلب. إذا بتحبّي، بقدر أشوفلك طابع عطري ثاني أو أعرض خيارات للجنسين.'};
  const products=[ranked[0].p];
  if(request.count>1){
    // For a broad request, give two distinguishable choices, e.g. a light
    // daytime option and a warm evening option from the same audience.
    const first=products[0];
    const other=ranked.slice(1).filter(({p})=>p.id!==first.id);
    const contrasting=!(request.desired.length||request.latest)&&other.find(({p})=>
      p.fragrance?.styles.includes('day')&&first.fragrance?.styles.includes('night')&&!p.fragrance.styles.includes('night')||
      p.fragrance?.styles.includes('night')&&first.fragrance?.styles.includes('day')&&!p.fragrance.styles.includes('day'));
    const second=contrasting||other[0];
    if(second)products.push(second.p);
  }
  const label=target==='women'?(en?'women’s fragrances':'عطور نسائية'):target==='men'?(en?'men’s fragrances':'عطور رجالية'):
    target==='unisex'?(en?'unisex fragrances':'عطور للجنسين'):(en?'fragrances':'عطور');
  const opening=en ? products.length===1?'I found one in-stock option in '+label+'.':'Here are two in-stock options from our '+label+'.'
    : products.length===1?'لقيتلك خيار من قسم '+label+' ومتوفر حاليًا.':'تمام، لقيتلك خيارين من '+label+' المتوفرة حاليًا.';
  const close=request.desired.length>1?(en?'Each card explains which of your preferences it matches.':'تحت كل خيار بتلاقي شو بناسب من ذوقكِ حسب النفحات المسجّلة.'):'';
  return {type:'selection',args:{
    area:'fragrance',productIds:products.map(p=>p.id),carePlan:[opening,close].filter(Boolean).join(' '),
    selections:products.map(p=>({productId:p.id,reason:fragranceReason(p,request,en)}))
  }};
}

export function catalogQuestion(input,catalog) {
  const {message,history}=input,query=normalizeSearch(message),en=isEnglish(message);
  const price=priceQuestion.test(query),stock=stockQuestion.test(query),notes=noteQuestion.test(query);
  const usage=/^طريقه |استعمال|استخدام|apply|directions/.test(query);
  const mode=price?'price':notes?'notes':usage?'usage':'details';
  const isQuestion=price||stock||notes||usage||detailQuestion.test(query)||/\bts[a-z0-9-]{4,64}\b/i.test(message);
  let products=namedCatalogMatches(message,catalog);
  if(!products.length&&(price||stock||notes)&&/^(?:طيب )?(?:كم سعره|سعره|سعرها|قديش سعره|قديش|كم سعرها|متوفر|موجود|موجوده|متوفره|شو نفحاته|شو نفحاتها|كيف ريحته|كيف ريحتها|is it in stock|is it available|how much is it|its price|what does it smell like)$/.test(query)){
    const last=latestSuggestedIds(history).at(-1);
    products=catalog.filter(p=>p.id===last);
  }
  // Match bare names and prices directly. Leave open-ended comparisons and
  // mixed needs to the model with the live products seeded as evidence.
  if(!isQuestion&&!products.length)return null;
  if(!isQuestion&&shopVerb.test(query)&&/تناسب|بناسب|يناسب|compare|which/i.test(query))return null;
  if(products.length>1&&/فرق|مقارنه|compare|difference/.test(query))return null;
  if(products.length>1)return {type:'question',question:{
    field:'catalogProduct',mode,text:en?'Which product did you mean?':'أي واحد فيهم قصدك؟',
    choices:products.map(p=>({label:nameOf(p,en),value:p.id}))
  }};
  const p=products[0];
  if(!p)return null;
  const title=nameOf(p,en),availability=p.available?(en?'In stock.':'متوفر حاليًا.'):(en?'Currently sold out.':'حاليًا نافد من المخزون.');
  const ref='\n'+(p.referencePriceFils>p.priceFils&&price?(en?'Listed price before the discount: ':'السعر المعروض قبل الخصم: ')+money(p.referencePriceFils,en)+'.':'');
  if(price)return {type:'answer',productId:p.id,message:title+'\n'+(en?'Current price: ':'سعره الحالي ')+money(p.priceFils,en)+'. '+availability+ref.trimEnd()};
  if(usage)return {type:'answer',productId:p.id,message:usageReply(p,en)};
  const ingredients=p.type!=='fragrance'&&ingredientQuestion.test(query);
  const facts=en?(p.benefitsEn?.length?p.benefitsEn:p.benefits):p.benefits;
  const description=(en?p.descriptionEn||p.description:p.description);
  const lines=[title, availability+' '+(en?'Current price: ':'السعر الحالي ')+money(p.priceFils,en)+'.'];
  if(p.size)lines.push((en?'Size: ':'الحجم ')+p.size+'.');
  if(p.variantNote)lines.push(p.variantNote);
  if(!stock||notes){
    if(description)lines.push(description);
    if(ingredients)lines.push(p.ingredients?(en?'Listed ingredients: ':'المكونات المذكورة: ')+p.ingredients+'.':
      en?'The store hasn’t listed the ingredients. Check the label on the pack.':'المكونات مش مذكورة بصفحة المنتج. خديها من ملصق العبوة.');
    else if(facts?.length)lines.push((p.type==='fragrance'?(en?'Fragrance notes: ':'أبرز النفحات: '):(en?'From the product page: ':'حسب وصف المنتج: '))+facts.join(en?'; ':'، ')+'.');
    if(!ingredients&&!description&&!facts?.length&&notes)lines.push(en?'The store hasn’t listed these details.':'هاي التفاصيل مش مذكورة عندنا بصفحة المنتج حاليًا.');
  }
  return {type:'answer',productId:p.id,message:lines.join('\n\n')};
}
