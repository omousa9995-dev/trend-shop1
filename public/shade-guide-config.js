// Pure validation shared by the owner form and Worker. Reference charts never
// declare which manufacturer shades the store has in stock.
const text=(value,max=500)=>String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,max);
export function shadeImageUrl(value){
 if(typeof value!=='string'||value.length>1200)return '';
 if(/^\/(?:images|media)\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('..'))return value;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
export function shadeSourceUrl(value){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&String(value).length<=1200?u.href:'';}catch{return '';}}
export function normalizeShadeGuide(value){
 if(value==null)return undefined;
 if(typeof value!=='object'||Array.isArray(value))throw Error('بيانات دليل الدرجات غير صالحة');
 if(value.entries!==undefined&&(!Array.isArray(value.entries)||value.entries.length>12))throw Error('راجعي عدد درجات المنتج');
 const seen=new Set(),entries=(value.entries||[]).map(row=>{
  if(!row||!/^[a-z0-9][a-z0-9-]{0,39}$/.test(row.id||'')||seen.has(row.id))throw Error('معرّف الدرجة غير صالح أو مكرر');seen.add(row.id);
  const image=shadeImageUrl(row.image||'');if(row.image&&!image)throw Error('رابط صورة الدرجة غير صالح');
  if(row.swatch&&!/^#[a-f0-9]{6}$/i.test(row.swatch))throw Error('لون الدرجة غير صالح');
  return {id:row.id,label:text(row.label,100),labelEn:text(row.labelEn,100),code:text(row.code,60),image,swatch:row.swatch||''};
 });
 const referenceUrl=shadeSourceUrl(value.referenceUrl||''),referenceImage=shadeImageUrl(value.referenceImage||'');
 if(value.referenceUrl&&!referenceUrl||value.referenceImage&&!referenceImage)throw Error('رابط مرجع الدرجات غير صالح');
 return {version:1,note:text(value.note),noteEn:text(value.noteEn),referenceUrl,referenceImage,entries};
}
