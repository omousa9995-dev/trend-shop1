// Reviewed 2026-11-12. Decision support, not training on customer conversations.
// Product selection still comes from approved, available live inventory.
export const CARE_REFERENCES=Object.freeze({
 back:'https://www.aad.org/public/diseases/acne/DIY/back-acne',
 face:'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
 dry:'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
 heels:'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dry-heels',
 pregnancy:'https://www.aad.org/public/diseases/acne/derm-treat/pregnancy/',
 panoxyl4:'https://panoxyl.com/acne-products/acne-creamy-wash/',
 panoxyl10:'https://panoxyl.com/acne-products/acne-foaming-wash-benzoyl-peroxide/'
});
const prescription=/(?:tretinoin|isotretinoin|hydroquinone|hydrocortisone|clobetasol|betamethasone|clindamycin|mometasone|antibiotic|تريتينوين|ايزوتريتينوين|إيزوتريتينوين|هيدروكينون|كورتيزون|كلوبتازول|كليندامايسين|مضاد.{0,8}حيوي)/i;
const active=/(?:retin(?:ol|al|oid)|adapalene|benzoyl|spicule|reedle|exfoliat|peel|\b[abp]ha\b|glycolic|salicylic|kojic|azelaic|ريتين|ادابالين|أدابالين|مقشر|تقشير|ساليسيليك|جليكوليك|كوجيك|ازيليك|أزيليك|بنزويل)/i;
export function lumaProductFacts(p,d,type,cosmeticCandidate){
 const facts=[p.name,d.nameAr,p.description,d.howToUse,d.notes,d.ingredients,...(d.benefits||[])].join(' ');
 // Verified manufacturer labels are matched to an exact brand/strength/form,
 // never to arbitrary marketing claims or a name-only medication guess.
 const benzoyl=/^panoxyl$/i.test((p.brand||'').trim())&&type==='cleanser'&&/benzoyl|بنزويل/i.test(facts)&&/wash|غسول/i.test(facts);
 const strength=benzoyl?(facts.match(/(?:^|\D)(4|10)\s*%/)?.[1]||''):'';
 const knownWash=!!strength;
 const identity=[p.name,d.nameAr,p.subcategory,d.ingredients].join(' ');
 const everydayTypes=['cleanser','moisturizer','sunscreen','toner','serum','essence','face-mask','face-oil','mist','eye-care','body-care','body-cleansing','body-oil','body-sunscreen','foot-care','shampoo','conditioner','hair-mask','hair-oil','exfoliant','body-scrub'];
 const excluded=(type==='exfoliant'&&/peeling solution|(?:30|35|50)\s*%/i.test(identity))||/adapalene|spicule|reedle|ادابالين|أدابالين/i.test(identity)||(/benzoyl|بنزويل/i.test(identity)&&!knownWash);
 const allowed=cosmeticCandidate||knownWash||everydayTypes.includes(type);
 return {lumaCandidate:allowed&&!prescription.test(identity)&&!excluded,careClass:knownWash?'otc-acne-wash':active.test(identity)?'active-cosmetic':'everyday',
  ...(knownWash?{areas:['face','body'],activeIngredient:'benzoyl peroxide',activeStrength:strength+'%',verifiedLabel:CARE_REFERENCES[strength==='4'?'panoxyl4':'panoxyl10'],
   assistantHowToUse:'بللي المنطقة، دلكي الغسول بلطف لمدة دقيقة إلى دقيقتين ثم اشطفيه جيدًا وجففي بالتربيت. اتبعي تعليمات عبوتكِ؛ ابدئي مرة يوميًا وخففي الاستخدام عند الجفاف. تجنبي العينين والشفاه والجلد المجروح. قد يبهت الأقمشة والشعر. لا تجمعيه مع مقشر جديد في البداية.'}:{}),
  requiresIngredientReview:active.test(identity)&&!knownWash};
}
export const LUMA_CARE_KNOWLEDGE=`PRACTICAL CARE PLAYBOOK (reviewed 2026-11-12; adapt, do not recite):
1. Mild back/chest blemishes: first distinguish small superficial bumps from painful deep lumps, sudden itchy uniform rash or infection. Ask ONE missing useful question, not an intake form. Recommend showering after sweat, clean loose clothing, gentle washing, patting dry, no abrasive loofah/picking, and a suitable moisturizer. A documented benzoyl-peroxide rinse-off wash can help mild acne; prefer 4% for a new user and explain irritation/fabric bleaching. Do not combine 4% and 10% washes or assume stronger is better. If no improvement after 6–8 weeks, seek a dermatologist. Water supports ordinary hydration, not an acne cure; never promise water/detox will clear acne.
2. Mild facial blemishes: gentle fingertip cleansing with lukewarm water, moisturizer suited to stated skin type, sun protection; avoid scrubbing/squeezing and starting several actives together. A verified OTC wash may be suggested for a suitable customer, following its exact label. No guarantee that every bump is acne; itchy or unusual bumps need clarification.
3. Dry hands: short lukewarm washing, gentle fragrance-free cleanser, thick cream after washing while slightly damp, gloves for detergents. Cracking without bleeding may benefit from an occlusive layer at night. Persistent rash, oozing or significant pain needs review.
4. Dry heels: gentle short washing, pat dry, thick foot moisturizer; a documented urea product may help intact dry skin according to its label. Plain petrolatum and socks at bedtime can retain moisture. Do not apply exfoliating acids to open fissures; no blades/cutting or aggressive filing. Diabetes, poor circulation, numbness, bleeding/deep cracks or infection need clinical assessment.
5. Sensitive skin/new irritation: simplify to previously tolerated gentle cleanser/moisturizer; stop the new irritating product. Introduce one new product at a time. Do not recommend more acids to solve irritation. Swelling, blistering, breathing difficulty or widespread rapid worsening needs urgent care.
6. Eczema already diagnosed: explain gentle barrier care, avoid fragranced irritants and continue the clinician's existing plan. Do not claim a cosmetic cures eczema or invent steroid/antibiotic treatment. Offer the store pharmacists for personal product/ingredient review, and a dermatologist for an active, infected or persistent flare.
7. Pitted scars/deep wounds: products cannot fill structural pits or close a deep wound. No acids/bleaching product over damaged skin. A deep wound/infection needs timely medical care; pharmacists can help follow-up, not replace necessary care.
8. Pigmentation/normal texture/fine lines: respectful language, regular suitable sun protection and gradual cosmetic care. Avoid promised percentages/time guarantees. Do not identify race, age or disease from a face photo.
9. Makeup: use stated undertone, skin type, coverage, finish and current shade reference. Ask only the missing useful detail; offer actual catalog variants. Photo lighting changes shade; recommend a jawline swatch and daylight check, never a guaranteed match.
10. Pregnancy/nursing, current prescription treatment, known allergy or a child: give useful gentle-care information, verify exact ingredients, and have a pharmacist/clinician review an active product before recommending it. Do not assume pregnancy safety from a brand or name. Never recommend prescription treatment or oral drugs.
OUTPUT: Explain a short ordered practical routine FIRST, then offer the suitable available product cards LAST when relevant. Do not force shopping or a budget questionnaire for a care-only question. Ask a budget only when needed for selecting a purchasable routine and not already stated. A final optional WhatsApp follow-up with صيدلانيات Trend Shop is appropriate after a completed care plan or for a special case, not on every clarification. For red flags, state the needed medical action first and make WhatsApp the final supplementary option. Never delay urgent care for WhatsApp.`;

export function lumaText(value,max=1800){
 if(typeof value!=='string')return '';
 return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\*\*|__|^#{1,6}\s/gm,'').trim().slice(0,max);
}

export function lumaProductAllowed(product,input){
 return product.lumaCandidate&&!(['pregnant','nursing'].includes(input.lifeStage)&&product.careClass!=='everyday');
}
