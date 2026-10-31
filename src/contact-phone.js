import parsePhoneNumber from 'libphonenumber-js/min';

// Normalize both Arabic digit sets and pasted RTL marks before strict parsing.
// A possible number is structurally plausible; this does not verify ownership.
export function normalizeContactPhone(value){
 if(typeof value!=='string'||value.length>80)return '';
 let text=value.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?0x660:0x6f0)))
  .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 if(!/^[+\d\s().-]+$/.test(text))return '';
 text=text.replace(/[\s().-]/g,'');
 if(text.startsWith('00'))text='+'+text.slice(2);
 if(/^9627\d{8}$/.test(text))text='+'+text;
 if(/^7[789]\d{7}$/.test(text))text='0'+text;
 if(!/^(?:\+?[1-9]\d{6,14}|0\d{6,14})$/.test(text))return '';
 try{
  const phone=parsePhoneNumber(text,{defaultCountry:'JO',extract:false});
  if(!phone?.country||!phone.isPossible()||phone.ext)return '';
  // Keep Jordan's mobile-only rule while allowing overseas contact numbers.
  if(phone.country==='JO'&&!/^7[789]\d{7}$/.test(phone.nationalNumber))return '';
  return phone.number;
 }catch{return ''}
}
