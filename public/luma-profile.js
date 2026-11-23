// Only explicitly saved preferences live past the chat on this device.
export const LUMA_PREFERENCES_KEY = 'trend-shop-luma-preferences-v1';
export const profileChoices = {
  area: ['face','body','hands','feet','hair','makeup'],
  skinType: ['dry','oily','combination','balanced'],
  sensitive: ['yes','no'],
  ageGroup: ['18-24','25-34','35-44','45+'],
  goal: ['basic','dryness','shine','texture','fine_lines','tone','breakouts'],
  lifeStage: ['neither','pregnant','nursing','prefer-not']
};

export function savedLumaProfile(storage) {
  try {
    const saved = JSON.parse(storage.getItem(LUMA_PREFERENCES_KEY));
    return saved?.version === 1 ? {remember:true,...normalizeLumaPreferences(saved)} : {remember:false,profile:{},budgetFils:null};
  } catch {
    return {remember:false,profile:{},budgetFils:null};
  }
}

export function normalizeLumaPreferences({profile = {}, budgetFils = null} = {}) {
  const fields = ['skinType','sensitive','ageGroup','goal'];
  return {
    profile: Object.fromEntries(fields.filter(field => profileChoices[field].includes(profile?.[field])).map(field => [field,profile[field]])),
    budgetFils: Number.isInteger(budgetFils) && budgetFils >= 500 && budgetFils <= 100000 ? budgetFils : null
  };
}

export function saveLumaPreferences(storage, preferences) {
  try {
    if (preferences) storage.setItem(LUMA_PREFERENCES_KEY, JSON.stringify({version:1,...normalizeLumaPreferences(preferences)}));
    else storage.removeItem(LUMA_PREFERENCES_KEY);
    return true;
  } catch {
    return false;
  }
}

export const lumaShortcuts = [
  {text:'روتين يومي بسيط',area:'face',intent:'routine'},
  {text:'بشرتي جافة ومشدودة',area:'face',intent:'routine',profile:{skinType:'dry',goal:'dryness'}},
  {text:'عندي حبوب وآثار',area:'face',intent:'routine',profile:{goal:'breakouts'}},
  {text:'بدي مكياج يومي خفيف',area:'makeup',intent:'makeup'},
  {text:'شو أفضل واقي شمس؟',area:'face',intent:'sunscreen'},
  {text:'ميزانيتي محدودة',area:'face',intent:'routine'},
  {text:'أفضل كونسيلر لبشرتي',area:'makeup',intent:'concealer'},
  {text:'بشرتي حساسة',area:'face',intent:'routine',profile:{sensitive:'yes'}}
];

const options = pairs => pairs.map(([value,label])=>({value,label}));
export const skinNames = {dry:'جافة',oily:'دهنية',combination:'مختلطة',balanced:'متوازنة'};
export const concernNames = {basic:'روتين أساسي',dryness:'الجفاف والشدّ',shine:'اللمعان',texture:'ملمس البشرة',tone:'مظهر البقع',breakouts:'الحبوب وآثارها',fine_lines:'مظهر الخطوط'};
const skinChoices = options(Object.entries(skinNames));
export const lumaGuideQuestions = [
  {field:'skinType',text:'خلّيني أسألك شوي يا قمر. كيف بتوصفي بشرتكِ أغلب الوقت؟',choices:skinChoices},
  {field:'goal',text:'شو أهم شي بتحبّي نركّز عليه بروتينكِ؟',choices:options(Object.entries(concernNames).filter(([key])=>key!=='fine_lines'))},
  {field:'ageGroup',text:'بأي فئة عمرية تقريبًا؟ هاد بيساعدني أرتّب الخطوات اللي بتناسبكِ.',choices:options([['18-24','18–24'],['25-34','25–34'],['35-44','35–44'],['45+','45 وفوق']])},
  {field:'budget',text:'شو المبلغ اللي بتحبّي نلتزم فيه كامل مع التوصيل؟ فيكي تختاري أو تكتبي رقم بالدينار.',choices:options([[8000,'8 د.أ'],[12000,'12 د.أ'],[18000,'18 د.أ'],[25000,'25 د.أ']])}
];

export const lumaSkinQuiz = [
  {field:'afterWash',text:'بعد غسل وجهكِ بلطف، كيف بشرتكِ عادةً قبل الترطيب؟',choices:options([['tight','بتشدّ أو بتحسّسني بالجفاف'],['shine','بتلمع بسرعة'],['mixed','الخدود جافة والأنف أو الجبهة بيلمعوا'],['comfortable','مرتاحة']])},
  {field:'midday',text:'بنصّ اليوم، وين بتلاحظي اللمعة عادة؟',choices:options([['all','بأغلب الوجه'],['tzone','على الأنف والجبهة والذقن'],['none','لمعة قليلة، مع شدّ أو جفاف'],['balanced','بسيطة وبشرتي مرتاحة']])},
  {field:'sensitive',text:'المنتجات الجديدة بتعمل لكِ احمرار أو لسعة بسهولة؟',choices:options([['yes','غالبًا'],['no','نادرًا'],['unknown','مش متأكدة']])}
];

export function quizSkinProfile({afterWash,midday,sensitive}) {
  let skinType='unknown';
  if (afterWash==='mixed'||midday==='tzone'&&afterWash==='tight') skinType='combination';
  else if (midday==='all'&&afterWash!=='tight') skinType='oily';
  else if (midday==='none'&&afterWash==='tight') skinType='dry';
  else if (midday==='balanced'&&afterWash==='comfortable') skinType='balanced';
  else if (midday==='tzone') skinType='combination';
  return {skinType,sensitive:profileChoices.sensitive.includes(sensitive)?sensitive:'unknown',area:'face'};
}

export function lumaBudgetFils(text) {
  const normalized=String(text).trim().replace(/[٠-٩۰-۹]/g,digit=>'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)%10).replace('٫','.').replace(/\s*(?:د\.?\s*أ|دينار(?:ًا|ا)?|jod)\s*$/i,'');
  if (!/^\d{1,3}(?:\.\d{1,3})?$/.test(normalized)) return null;
  const fils=Math.round(Number(normalized)*1000);
  return fils>=500&&fils<=100000?fils:null;
}
