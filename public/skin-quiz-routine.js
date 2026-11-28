import {productType} from './product-types.js?v=5.21.0';
import {productOptions} from './product-variants.js?v=5.9.0';
import {normalizeSearch, productDetails} from './shop-tools.js?v=5.11.0';

const skinMatches = {
  dry: /جفاف|الجافة|جافة|مشدودة|قواما اغني|ترطيب غني|\bdry\b|\brich\b|hydrating/,
  oily: /دهنية|الزيوت الزائدة|الدهون الزائدة|قوام خفيف|اويل كنترول|oil control|oily|lightweight/,
  combination: /مختلطة|قوام خفيف|ترطيب خفيف|combination|lightweight/,
  balanced: /ترطيب يومي|تنظيف يومي|البشرة العادية|all skin types|daily/
};
const goals = {
  dryness: /ترطيب|الرطوبة|الشد|hydrating|moisture/,
  shine: /اللمعان|الزيوت الزائدة|الدهون الزائدة|قوام خفيف|ملمس خفيف|oil control|lightweight/,
  tone: /حماية نهارية|عناية يومية|daily protection|يقي من الشمس/
};
const gentle = /غسول لطيف|تنظيف لطيف|كريمي لطيف|غير رغوي|خالي من العطر|gentle cleansing|gentle cleanser|hydrating cleanser/;
const sensitiveFit = /البشرة الحساسة|بشرة حساسة|خالي من العطر|بدون عطر|sensitive skin|fragrance free|غير معطر/;
const basicCare = {
  moisturizer: /دعم حاجز البشرة|حاجز البشرة|barrier cream/,
  cleanser: gentle,
  sunscreen: /واقي معدني|مرشح معدني|mineral sunscreen/
};
const treatment = /مقشر|مقشرة|تقشير|ساليسيليك|ساليسيلات|ادابالين|ريتينول|تريتينوين|بنزويل|هيدروكينون|whitening|depigment|exfoliat|salicyl|adapalene|retino|glycolic|\bbha\b|\baha\b|benzoyl|hydroquinone/;
const unsuitable = /للمناطق الحساسة|للجسم|للقدم|لليدين|skin peeling|for body|hand cream|foot cream|مزيل المكياج|شرائح تنظيف|ماء ميسيلار|cleansing oil|cleansing balm|makeup remover|nose strips|صابونة|\bsoap\b|واقي بخاخ|واقي الشمس البخاخ|بخاخ الحماية|ماء الحماية|spray sunscreen/;

export const quizSteps = {
  cleanser: {
    time: ['مساءً · قبل الترطيب', 'Evening · before moisturizing'],
    reason: ['تنظيف الوجه من بقايا اليوم قبل الترطيب.', 'An evening cleanse before moisturizing.']
  },
  moisturizer: {
    time: ['صباحًا ومساءً · بعد التنظيف', 'Morning and evening · after cleansing'],
    reason: ['خطوة الترطيب الأساسية بعد التنظيف.', 'A basic moisturizing step after cleansing.']
  },
  sunscreen: {
    time: ['صباحًا · بعد الترطيب', 'Morning · after moisturizing'],
    reason: ['خطوة الحماية الصباحية بعد الترطيب.', 'Your morning protection step after moisturizing.']
  }
};

function rankCandidate(product, profile) {
  if (!/^TS[A-Z0-9-]{4,64}$/.test(product.id) || product.category !== 'البشرة' || Number(product.approved) !== 1 ||
      Number(product.active ?? 1) !== 1 || !(Number(product.stock) > 0) ||
      !Number.isInteger(product.priceFils ?? product.price_fils) ||
      (product.priceFils ?? product.price_fils) <= 0 || productOptions(product).length) return null;
  const type = productType(product);
  if (!Object.hasOwn(quizSteps, type)) return null;
  const details = productDetails(product) || {};
  const benefits = Array.isArray(details.benefits) ? details.benefits : [];
  const title = normalizeSearch([product.name, details.nameAr, product.subcategory].join(' '));
  const evidence = normalizeSearch([title, product.description, details.suitableFor, ...benefits].join(' '));
  const instructions = normalizeSearch([details.notes, details.howToUse, details.ingredients].join(' '));
  if (unsuitable.test(title) || treatment.test(evidence) || treatment.test(instructions)) return null;
  if (type === 'moisturizer' && /\bspf\b|واقي الشمس/.test(title)) return null;
  const types = (Array.isArray(details.skinTypes) ? details.skinTypes : [details.skinType || details.suitableFor])
    .map(normalizeSearch).filter(Boolean);
  const fit = skinMatches[profile.skinType];
  const broadFit = /جميع انواع البشرة|كل انواع البشرة|all skin types/.test(evidence);
  if (fit && types.length && !broadFit && !types.some(value => value === profile.skinType || fit.test(value))) return null;
  const gentleFit = gentle.test(evidence);
  const sensitiveLabel = types.includes('sensitive') || sensitiveFit.test(evidence);
  const basicOption = basicCare[type].test(evidence);
  if (profile.sensitive === 'yes' && ((!sensitiveLabel && !basicOption) ||
      /قد تحتوي.*عطر|يحتوي.*عطر|زيت شجرة الشاي|غير مناسب للبشرة الحساسة/.test(instructions))) return null;
  if (type === 'cleanser' && profile.skinType !== 'oily' && !gentleFit && !sensitiveLabel) return null;
  if (profile.skinType === 'dry' && /oil control|اويل كنترول|للبشرة الدهنية/.test(title)) return null;
  const goal = goals[profile.goal];
  const score = (fit?.test(evidence) ? 7 : 0) + (goal?.test(evidence) ? 4 : 0) +
    (sensitiveLabel ? 3 : 0) + (basicOption ? 2 : 0) + (broadFit ? 1 : 0);
  return {product, type, score, details};
}

export function quizRoutine(products, profile) {
  const candidates = products.map(product => rankCandidate(product, profile)).filter(Boolean);
  const steps = profile.preferredRoutine === 'am-pm'
    ? ['cleanser', 'moisturizer', 'sunscreen']
    : ['moisturizer', 'sunscreen'];
  return steps.flatMap(type => {
    const choice = candidates.filter(candidate => candidate.type === type).sort((a, b) => b.score - a.score)[0];
    if (!choice) return [];
    const {product, details} = choice;
    const [reasonAr, reasonEn] = quizSteps[type].reason;
    const benefit = values => values?.find?.(value => typeof value === 'string' && value.trim() && value.length <= 110);
    return [{
      product, type, time: quizSteps[type].time,
      reason: [benefit(details.benefits) || reasonAr, benefit(details.en?.benefits) || reasonEn]
    }];
  });
}
