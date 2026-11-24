import {normalizeSearch} from './shop-tools.js';

// Conversation messages and photos stay in memory; only these preferences are saved.
export const LUMA_PREFERENCES_KEY = 'lama_user_profile';
const LEGACY_KEY = 'trend-shop-luma-preferences-v1';
export const profileChoices = {
  area: ['face','body','hands','feet','hair','makeup'],
  skinType: ['dry','oily','combination','balanced'],
  sensitive: ['yes','no'],
  ageGroup: ['18-24','25-34','35-44','45+'],
  goal: ['basic','dryness','shine','texture','fine_lines','tone','breakouts'],
  lifeStage: ['neither','pregnant','nursing','prefer-not'],
  preferredRoutine: ['simple','am-pm','makeup']
};
const allowedId = id => typeof id==='string'&&/^TS[A-Z0-9-]{4,64}$/.test(id);

export function normalizeLamaProfile(profile = {}) {
  const fields = ['skinType','sensitive','ageGroup','goal','preferredRoutine'];
  const clean = Object.fromEntries(fields.filter(field => profileChoices[field].includes(profile?.[field])).map(field=>[field,profile[field]]));
  const concerns = [...new Set([...(Array.isArray(profile?.concerns)?profile.concerns:[]),clean.goal].filter(goal=>profileChoices.goal.includes(goal)&&goal!=='basic'))].slice(-5);
  const likedProductIds = [...new Set((Array.isArray(profile?.likedProductIds)?profile.likedProductIds:[]).filter(allowedId))].slice(-20);
  if(concerns.length)clean.concerns=concerns;
  if(likedProductIds.length)clean.likedProductIds=likedProductIds;
  return clean;
}

export function captureLamaPreferences(message, profile = {}) {
  const query = normalizeSearch(message).replace(/[٠-٩۰-۹]/g,digit=>String('٠١٢٣٤٥٦٧٨٩'.includes(digit)?'٠١٢٣٤٥٦٧٨٩'.indexOf(digit):'۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const changes = {};
  if(!/بشرتي.{0,9}(?:مش|مو|غير|ليست)|my skin is not/.test(query)){
    if(/بشرتي.{0,13}مختلط|my skin.{0,14}combination/.test(query))changes.skinType='combination';
    else if(/بشرتي.{0,13}(?:دهني|زيتي)|my skin.{0,14}oily/.test(query))changes.skinType='oily';
    else if(/بشرتي.{0,13}(?:جاف|ناشف)|my skin.{0,14}dry/.test(query))changes.skinType='dry';
    else if(/بشرتي.{0,13}(?:عادي|طبيعي|متوازن)|my skin.{0,14}(?:normal|balanced)/.test(query))changes.skinType='balanced';
  }
  if(/بشرتي.{0,10}(?:مش حساس|غير حساس|مو حساس)|my skin is not sensitive/.test(query))changes.sensitive='no';
  else if(/بشرتي.{0,9}حساس|my skin.{0,14}sensitive/.test(query))changes.sensitive='yes';
  const age=Number(query.match(/(?:عمري|عمري تقريبا|انا عمري|i am|im) (\d{2})(?= |$)/)?.[1]);
  if(age>=18&&age<=100)changes.ageGroup=age<25?'18-24':age<35?'25-34':age<45?'35-44':'45+';
  if(/عندي|بشرتي|هدفي|مشكلتي|بدي|i have|my skin|i want/.test(query)){
    const goals=[['breakouts',/حبوب|بثور|acne|breakout/],['dryness',/جفاف|ناشفة|جافة|شد|dry/],['tone',/بقع|اثار|تصبغ|dark spot/],['shine',/لمعان|دهنية|oiliness/],['texture',/ملمس|texture/],['fine_lines',/خطوط|fine lines/]];
    const concerns=goals.filter(([,pattern])=>pattern.test(query)).map(([goal])=>goal);
    if(concerns.length){changes.goal=concerns[0];changes.concerns=[...new Set([...(Array.isArray(profile.concerns)?profile.concerns:[]),...concerns])].slice(-5);}
  }
  if(/روتين.{0,10}(?:بسيط|مختصر|خفيف)|simple routine/.test(query))changes.preferredRoutine='simple';
  else if(/مكياج.{0,12}خفيف|light makeup/.test(query))changes.preferredRoutine='makeup';
  else if(/روتين.{0,18}صباح.{0,12}مسا|morning and evening/.test(query))changes.preferredRoutine='am-pm';
  return changes;
}

export function savedLumaProfile(storage) {
  try {
    const saved = JSON.parse(storage.getItem(LUMA_PREFERENCES_KEY));
    if(saved?.version===2)return {remember:saved.remember!==false,profile:normalizeLamaProfile(saved.profile),budgetFils:null};
    const previous=JSON.parse(storage.getItem(LEGACY_KEY));
    const profile=normalizeLamaProfile(previous?.version===1?previous.profile:{});
    if(previous?.version===1)saveLumaPreferences(storage,{profile});
    return {remember:true,profile,budgetFils:null};
  } catch {
    return {remember:true,profile:{},budgetFils:null};
  }
}

export function saveLumaPreferences(storage, preferences) {
  try {
    if(preferences?.remember===false)storage.setItem(LUMA_PREFERENCES_KEY,JSON.stringify({version:2,remember:false}));
    else if(preferences)storage.setItem(LUMA_PREFERENCES_KEY,JSON.stringify({version:2,profile:normalizeLamaProfile(preferences.profile)}));
    else storage.removeItem(LUMA_PREFERENCES_KEY);
    storage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

export const lumaShortcuts = [
  {text:'روتين يومي بسيط',area:'face',intent:'routine',profile:{preferredRoutine:'simple'}},
  {text:'بشرتي جافة ومشدودة',area:'face',intent:'routine',profile:{skinType:'dry',goal:'dryness'}},
  {text:'عندي حبوب وآثار',area:'face',intent:'routine',profile:{goal:'breakouts'}},
  {text:'بدي مكياج يومي خفيف',area:'makeup',intent:'makeup',profile:{preferredRoutine:'makeup'}},
  {text:'شو أفضل واقي شمس؟',area:'face',intent:'sunscreen'}
];

const options = pairs => pairs.map(([value,label])=>({value,label}));
export const skinNames = {dry:'جافة',oily:'دهنية',combination:'مختلطة',balanced:'متوازنة'};
export const concernNames = {basic:'روتين أساسي',dryness:'الجفاف والشدّ',shine:'اللمعان',texture:'ملمس البشرة',tone:'مظهر البقع',breakouts:'الحبوب وآثارها',fine_lines:'مظهر الخطوط'};
const skinChoices = options(Object.entries(skinNames));
export const lumaGuideQuestions = [
  {field:'skinType',text:'خلّيني أسألك شوي يا قمر. كيف بتوصفي بشرتكِ أغلب الوقت؟',choices:skinChoices},
  {field:'goal',text:'شو أهم شي بتحبّي نركّز عليه بروتينكِ؟',choices:options(Object.entries(concernNames).filter(([key])=>key!=='fine_lines'))},
  {field:'ageGroup',text:'بأي فئة عمرية تقريبًا؟ هاد بيساعدني أرتّب الخطوات اللي بتناسبكِ.',choices:options([['18-24','18–24'],['25-34','25–34'],['35-44','35–44'],['45+','45 وفوق']])}
];
