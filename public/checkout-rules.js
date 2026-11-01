// Pure rules shared by the browser and order server. Messages are localized separately.
export const GOVERNORATES=[['عمّان','Amman'],['إربد','Irbid'],['الزرقاء','Zarqa'],['البلقاء','Balqa'],['مادبا','Madaba'],['الكرك','Karak'],['معان','Maan'],['الطفيلة','Tafilah'],['العقبة','Aqaba'],['جرش','Jerash'],['عجلون','Ajloun'],['المفرق','Mafraq']];
const fold=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\u0610-\u061a\u064b-\u065f\u0670\u0640'’\s-]/g,'').replace(/[أإآ]/g,'ا');
const contactText=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,'').trim():'';
export function canonicalGovernorate(value){const key=fold(value);return GOVERNORATES.find(([ar,en])=>fold(ar)===key||fold(en)===key)?.[0]||''}
export function validateCheckout(input,normalizePhone){
 const raw=input&&typeof input==='object'?input:{};
 const values={name:contactText(raw.name).replace(/\s+/g,' '),phone:normalizePhone(raw.phone),governorate:canonicalGovernorate(raw.governorate),address:contactText(raw.address),email:contactText(raw.email),notes:contactText(raw.notes),payment:contactText(raw.payment),cliqAlias:contactText(raw.cliqAlias),locale:raw.locale==='en'?'en':'ar'};
 const fields={};
 if(!values.name)fields.name='name_required';else if((values.name.match(/\p{L}/gu)||[]).length<2)fields.name='name_short';else if(values.name.length>90)fields.name='name_long';
 if(!contactText(raw.phone))fields.phone='phone_required';else if(!values.phone)fields.phone='phone_invalid';
 if(!values.governorate)fields.governorate='governorate_required';
 if(!values.address)fields.address='address_required';else if(!/[\p{L}\p{N}]/u.test(values.address))fields.address='address_invalid';else if(values.address.length>350)fields.address='address_long';
 if(values.email&&(values.email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(values.email)))fields.email='email_invalid';
 if(values.notes.length>500)fields.notes='notes_long';
 if(!['cod','cliq'].includes(values.payment))fields.payment='payment_required';
 if(values.payment==='cliq'&&values.cliqAlias.length<2)fields.cliqAlias='cliq_required';else if(values.cliqAlias.length>64)fields.cliqAlias='cliq_long';
 return {values,fields,valid:Object.keys(fields).length===0};
}
