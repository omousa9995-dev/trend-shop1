// Reviewed 2026-11-12 against https://www.nhs.uk/conditions/cuts-and-grazes/.
// Explicit injury signals get immediate first-aid guidance even if inference is
// unavailable. This is a narrow emergency response, never a skin diagnosis.
export function urgentCareReply(message){
 const text=String(message||'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
 const withoutNegations=text
  .replace(/(?:ما\s*في|ما\s*عندي|لا\s+يوجد|لا\s+اعاني\s+من|بدون|دون|ولا|مش|مو)\s*(?:اي\s+)?(?:جرح\s+عميق|جروح\s+عميقه|نزيف(?:\s+(?:مستمر|شديد|غزير))?)(?:\s*او\s*نزيف(?:\s+(?:مستمر|شديد|غزير))?)?/g,' ')
  .replace(/(?:no|without|not|don'?t have)\s+(?:a\s+|any\s+)?(?:deep\s+(?:wound|cut)|(?:heavy|persistent|uncontrolled)\s+bleeding)(?:\s+or\s+(?:heavy|persistent|uncontrolled)\s+bleeding)?/g,' ');
 if(!/(?:جرح\s+عميق|جروح\s+عميقه|نزيف\s+(?:مستمر|شديد|غزير)|(?:نزيف|الدم)\s+(?:ما\s*بوقف|لا\s+يتوقف)|deep\s+(?:wound|cut)|(?:heavy|persistent|uncontrolled)\s+bleeding|bleeding\s+(?:won'?t|will not|does not)\s+stop)/.test(withoutNegations))return null;
 return 'الجرح العميق أو النزيف اللي ما بوقف يحتاج رعاية طبية عاجلة. توجهي للطوارئ الآن ولا تنتظري رد المتجر. اضغطي على مكان النزيف بضماد أو قماش نظيف إذا ما في جسم غريب داخل الجرح؛ إذا في جسم غريب لا تشيليه ولا تضغطي عليه. لا تضعي كريم عناية على الجرح. بعد تلقي الرعاية، صيدلانيات Trend Shop بيساعدوكِ بالمتابعة الشخصية.';
}
