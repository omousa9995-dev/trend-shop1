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

export function explicitLumaBudget(message){
 const t=normalize(message).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
 const amount=t.match(/(?:ميزاني(?:تي|ه|ة|تها)?|ما يزيد عن|بحدود|حد اقصي|اقل من|حدود)\s*(?:هي|حوالي|تقريبا|من|بـ|ب)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:دينار|دنانير|د\.?ا|jod)?/i)?.[1];
 const fils=amount?Math.round(Number(amount.replace(',','.'))*1000):null;return fils>=500&&fils<=100000?fils:null;
}
export function lumaCatalogFacts(p){return {id:p.id,name:p.name,brand:p.brand,type:p.type,areas:p.areas,priceJod:p.priceFils/1000,careClass:p.careClass,ingredients:p.ingredients,howToUse:p.assistantHowToUse||p.howToUse,notes:p.notes,options:p.options,...(p.verifiedLabel?{activeIngredient:p.activeIngredient,activeStrength:p.activeStrength,verifiedLabel:p.verifiedLabel}:{}),...(p.requiresIngredientReview?{reviewIngredients:true}:{})}}

// Seed a few complementary, relevant products so ordinary routines need one turn.
// Exact IDs, ingredient/label facts and final stock validation remain authoritative.
export function shortlistLumaCatalog(products,input){
 const t=normalize([input.message,...input.history.slice(-4).map(x=>x.text)].join(' '));
 const area=/(?:ظهر|جسم|صدر|back|body)/.test(normalize(input.message))?'body':/(?:وجه|وجهي|face)/.test(normalize(input.message))?'face':input.area;
 const available=products.filter(p=>p.lumaCandidate&&!input.existingIds.includes(p.id)&&(area==='unknown'||p.areas.includes(area))&&(input.budgetFils===null||p.priceFils<=input.budgetFils));
 const acne=/حبوب|acne|بثور/.test(t),dry=/جفاف|نشف|جاف|dry/.test(t),words=t.split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2);
 const ranked=available.map(p=>{const name=normalize([p.name,p.brand,p.type].join(' '));let score=words.reduce((s,w)=>s+(name.includes(w)?3:0),0);if(['cleanser','moisturizer','sunscreen'].includes(p.type))score+=2;if(dry&&p.type==='moisturizer')score+=3;if(acne&&p.activeStrength==='4%')score+=7;if(p.careClass==='everyday')score+=2;return {p,score}}).sort((a,b)=>b.score-a.score||a.p.priceFils-b.p.priceFils);
 const chosen=[],counts=new Map();for(const {p}of ranked){const count=counts.get(p.type)||0;if(count>=2)continue;chosen.push(p);counts.set(p.type,count+1);if(chosen.length===8)break}return chosen;
}
