export const MANAGEMENT_WHATSAPP='https://wa.me/962790025430';
const normalize=value=>value.normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْ]/g,'').toLowerCase();
export function lumaDeliveryText(message='',now=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Amman',hour:'numeric',hourCycle:'h23'}).format(now));
 const eveningExample=/(?:7|٧|سبع|السابعه|السابعة)\s*(?:م|مساء|المسا|بالليل|pm)/i.test(message);
 const estimate=eveningExample?'إذا ثبتتي الطلب الساعة ٧ مساءً، متوقّع يوصلكِ بكرا تقريبًا قبل الساعة ٣ العصر.':hour>=15?'إذا ثبتتي الطلب هسا، متوقّع يوصلكِ بكرا تقريبًا قبل الساعة ٣ العصر.':'';
 return 'التوصيل لجميع مناطق المملكة الأردنية خلال ٢٤ ساعة فقط من تثبيت الطلب. '+estimate+' وإذا بتحبي موعدًا معيّنًا، اكتبيه بخانة الملاحظات عند تثبيت الطلب عشان ننسّقه معكِ. الموعد المذكور تقريبي.';
}
// Exact store facts need no inference. Mixed care questions stay with the model.
export function lumaStoreReply(message,now=new Date()){
 const t=normalize(message),care=/حبوب|بشر|جفاف|جاف|نشف|روتين|غسول|مرطب|حساس|مكياج|شعر|سيروم|حمل|حامل/.test(t);
 if(care)return null;
 const delivery=/توصيل|التسليم|يوصل|بيوصل|بوصل|بوصله|بكرا|غدا|موعد.{0,12}طلب|متي.{0,12}طلب|delivery|shipping|arriv/.test(t);
 const management=/(?:رقم|واتس|تواصل|احكي|اكلم|اتصل|whatsapp|contact|phone).{0,30}(?:ادار|متجر|دعم|فريق|trend|شوب)|(?:ادار|دعم|فريق).{0,30}(?:رقم|واتس|تواصل)|رقمكم|واتسابكم/.test(t);
 const text=[delivery?lumaDeliveryText(message,now):'',management?'أكيد، رقم واتساب إدارة Trend Shop هو 0790025430، ومع رمز الدولة: +962790025430.':''].filter(Boolean).join('\n\n');
 return text?{text,...(management?{team:{label:'واتساب إدارة Trend Shop · 0790025430',href:MANAGEMENT_WHATSAPP}}:{})}:null;
}

// Reviewed everyday-care answers avoid inference latency for clear, non-shopping intents.
// Specific products, images, unusual symptoms and individual medical constraints still use the model.
export function quickLumaAdvice(input){
 if(input.image||input.warningSigns)return null;
 const t=normalize(input.message),context=normalize(input.history.slice(-6).map(x=>x.text).join(' '));
 if(/نزيف|دم|جرح|تورم|تورّم|انتفاخ|صديد|قيح|حكه شديده|حكة شديدة|الم شديد|حامل|حمل|رضاع|طفل|سكري|كلي|kidney|heart|قلب|اكزيما|eczema|حساسيه شديده|حساسية شديدة/.test(t))return null;
 if(/(?:الماء|المي|ميه|مياه|water)/.test(t)&&/حبوب|بثور|acne/.test(t))return {text:'شرب المي بشكل كافي ومتوازن مفيد للصحة، لكن المي وحدها أو شربها بكثرة مش علاج للحبوب. للحبوب الخفيفة حافظي على غسل لطيف، ترطيب مناسب بدون سدّ المسام، وتجنّبي العصر والفرك. للظهر غيّري الملابس بعد التعرق وخدي شاور. الروتين المناسب يحتاج استمرارية؛ الحبوب العميقة المؤلمة أو اللي بتترك ندبات تحتاج تقييم جلدية.'};
 if(/(?:الماء|المي|ميه|مياه|water)/.test(t)&&/جفاف|نشف|جاف|dry/.test(t+' '+context))return {text:'شرب مي بشكل كافي ومتوازن مهم للصحة، لكن المي وحدها ما بتكفي لعلاج جفاف البشرة، وزيادتها فوق حاجتكِ مش بديل للترطيب. خدي شاور قصير بمي فاترة، نشّفي بالتربيت بدون فرك، وحطي المرطب مباشرة والبشرة بعدها رطبة شوي. خففي الصابون القاسي والعطور، واحمي إيديكِ بقفازات وقت المنظفات. إذا عندكِ تقييد طبي للسوائل، التزمي بتعليمات طبيبكِ.'};
 const adviceOnly=/بدون منتجات|من غير منتجات|مش بدي منتجات|نصائح فقط|نصايح فقط|نصائح عامه|نصايح عامه/.test(t);
 if(adviceOnly&&/جفاف|نشف|جاف|dry/.test(t))return {text:'أكيد ♡ للجفاف جرّبي هالخطوات اليومية:\n١. شاور قصير بمي فاترة، وابتعدي عن المي الساخنة والصابون القاسي.\n٢. نشّفي بشرتكِ بلطف بالتربيت، ورطبيها مباشرة وهي بعدها رطبة شوي؛ بدون فرك أو تنشيف زائد.\n٣. اشربي مي بشكل كافي ومتوازن خلال اليوم؛ الترطيب الخارجي مهم كمان، والمي وحدها مش علاج للجفاف.\n٤. خففي العطور والمنظفات المهيّجة، واستخدمي قفازات وقت التنظيف.\nإذا ظهر تشقق عميق، نزّ أو ألم واضح، أو استمر الجفاف رغم العناية، الأفضل تقييم طبي.'};
 if(adviceOnly&&/حبوب|بثور|acne/.test(t))return {text:'للحبوب الخفيفة بالوجه أو الظهر: غسل لطيف بمي فاترة بدون فرك أو ليفة خشنة، وتجنّبي عصر الحبوب. رطّبي بمرطب مناسب ما يسدّ المسام، واحمي الوجه من الشمس. بعد التعرّق خدي شاور وغيّري الملابس، واختاري ملابس نظيفة وواسعة للظهر. لا تبدئي عدة مقشرات مع بعض. الحبوب العميقة المؤلمة أو اللي بتترك ندبات تحتاج تقييم جلدية؛ وإذا ما تحسنت الحبوب الخفيفة خلال ٦–٨ أسابيع راجعي طبيب جلدية.'};
 return null;
}

export function explicitLumaBudget(message){
 const t=normalize(message).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
 const amount=t.match(/(?:ميزاني(?:تي|ه|ة|تها)?|ما يزيد عن|بحدود|حد اقصي|اقل من|حدود)\s*(?:هي|حوالي|تقريبا|من|بـ|ب)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:دينار|دنانير|د\.?ا|jod)?/i)?.[1];
 const fils=amount?Math.round(Number(amount.replace(',','.'))*1000):null;return fils>=500&&fils<=100000?fils:null;
}
export function lumaCatalogFacts(p){return {id:p.id,name:p.name,brand:p.brand,type:p.type,areas:p.areas,priceJod:p.priceFils/1000,referencePriceJod:p.referencePriceFils/1000,...(p.limitedOffer?{limitedOffer:{originalPriceJod:p.limitedOffer.originalPriceFils/1000,endsAt:new Date(p.limitedOffer.endsAt*1000).toISOString()}}:{}),careClass:p.careClass,description:p.description,benefits:p.benefits,ingredients:p.ingredients,howToUse:p.assistantHowToUse||p.howToUse,notes:p.notes,options:p.options,...(p.verifiedLabel?{activeIngredient:p.activeIngredient,activeStrength:p.activeStrength,verifiedLabel:p.verifiedLabel}:{}),...(p.requiresIngredientReview?{reviewIngredients:true}:{})}}

// Seed a few complementary, relevant products so ordinary routines need one turn.
// Exact IDs, ingredient/label facts and final stock validation remain authoritative.
export function shortlistLumaCatalog(products,input){
 const current=normalize(input.message),past=normalize(input.history.filter(x=>x.role==='user').slice(-2).map(x=>x.text).join(' '));
 const t=/حبوب|جفاف|نشف|دهن|جاف|acne|dry|oily/.test(current)?current:current+' '+past;
 const area=/(?:ظهر|جسم|صدر|back|body)/.test(normalize(input.message))?'body':/(?:وجه|وجهي|face)/.test(normalize(input.message))?'face':input.area;
 const available=products.filter(p=>p.lumaCandidate&&!input.existingIds.includes(p.id)&&(area==='unknown'||p.areas.includes(area))&&(input.budgetFils===null||p.priceFils<=input.budgetFils));
 const acne=input.goal==='breakouts'||/حبوب|acne|بثور/.test(t),dry=input.skinType==='dry'||/جفاف|نشف|جاف|dry/.test(t),oily=/دهنية|دهنيه|oily/.test(current)||input.skinType==='oily',words=[...new Set(t.split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2))];
 const ranked=available.map(p=>{const name=normalize([p.name,p.brand,p.type].join(' '));let score=words.reduce((s,w)=>s+(name.includes(w)?3:0),0);if(['cleanser','moisturizer','sunscreen'].includes(p.type))score+=2;if((input.intent==='sunscreen'||input.intent==='concealer')&&p.type===input.intent)score+=28;if(dry&&p.type==='moisturizer')score+=3;if(acne&&p.activeStrength==='4%')score+=20;const facts=normalize([p.name,p.description,p.notes].join(' '));if(oily){if(/دهنيه|دهنية|oily|خفيف|light|gel|جل/.test(facts))score+=5;if(/جافه|جافة|dry|مكثف|intens|rich/.test(facts))score-=8;}if(p.careClass==='everyday')score+=2;return {p,score}}).sort((a,b)=>b.score-a.score||a.p.priceFils-b.p.priceFils);
 const chosen=[],counts=new Map();if(input.intent==='routine'&&area==='face'){for(const type of ['cleanser','moisturizer','sunscreen']){const item=ranked.find(({p})=>p.type===type);if(item){chosen.push(item.p);counts.set(type,1);}}}for(const {p}of ranked){const count=counts.get(p.type)||0;if(count>=2||chosen.includes(p))continue;chosen.push(p);counts.set(p.type,count+1);if(chosen.length===6)break}return chosen;
}

// Straightforward order and comparisons work without inference. For named
// items, product-specific directions take priority over these general steps.
const routineSteps = [
 {match:/غسول|منظف الوجه|cleanser|face wash/i,ar:'الغسول',en:'Cleanser',why:'خطوة تنظيف البشرة في البداية.',whyEn:'Starts the routine by cleansing your skin.'},
 {match:/تونر|toner/i,ar:'التونر',en:'Toner',why:'غالبًا قوامه مائي وبيجي بعد الغسول وبحسب وظيفته المكتوبة على العبوة.',whyEn:'Usually watery and used after cleansing, depending on the product directions.'},
 {match:/ايسنس|اسنس|اسينس|essence/i,ar:'الإيسنس',en:'Essence',why:'خطوة عناية خفيفة وإضافية، غالبًا للترطيب. إذا بتستخدميه مع التونر، حطيه بعده.',whyEn:'An optional lightweight care step, often for hydration. If you use both, apply it after toner.'},
 {match:/سيروم|serum/i,ar:'السيروم',en:'Serum',why:'خطوة عناية بحسب مكوّناته، وعادةً تسبق المرطب إذا تعليمات العبوة بتسمح.',whyEn:'A treatment or care step that generally goes before moisturizer. Follow the product directions.'},
 {match:/مرطب|كريم الترطيب|moisturi[sz]er/i,ar:'المرطب',en:'Moisturizer',why:'بيرطّب البشرة وبيجي عادةً بعد خطوات العناية الخفيفة.',whyEn:'Moisturizes the skin and generally follows lighter care products.'},
 {match:/واقي (?:ال)?شمس|sunscreen|sunblock/i,ar:'واقي الشمس',en:'Sunscreen',why:'آخر خطوة من العناية الصباحية حسب تعليمات العبوة، وقبل المكياج إذا رح تحطيه.',whyEn:'Goes at the end of morning skincare, before makeup, following the pack directions.'}
];

export function lamaRoutineOrderReply(input) {
 if(input.image||input.warningSigns)return null;
 const query=normalize(input.message);
 if(!/الفرق بين|شو الفرق|(?:مين|ايهم[ا]?) .{0,14}(?:اول|قبل)|ترتيب|قبل وا?لا بعد|difference between|which .{0,22}first|what order/i.test(query))return null;
 if(/\bts[a-z0-9-]{4,64}\b|حامل|حمل|رضاع|حساس.{0,4}شديد|احمرار|اكزيما|تهيج|pregnan|allerg|eczema|irritat/i.test(query))return null;
 const steps=routineSteps.filter(item=>item.match.test(query));
 if(steps.length<2)return null;
 const en=!/[\u0600-\u06ff]/.test(input.message);
 const order=steps.map(item=>item[en?'en':'ar']).join(en?' → ':'، بعده ');
 const details=steps.map(item=>item[en?'en':'ar']+' — '+item[en?'whyEn':'why']).join('\n');
 const opening=en?'If you’re using these steps together: ':'إذا رح تستخدميهم سوا، الترتيب المعتاد ';
 const guidance=en?'Use the directions on each product, and skip optional steps if your routine already suits you.':'خدي بتعليمات كل عبوة. إذا الروتين الحالي بناسبكِ، تقدري تختصري الخطوات الإضافية.';
 return {text:opening+order+'.\n\n'+details+'\n\n'+guidance};
}
