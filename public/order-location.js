// Keep delivery links as private order data. Never fetch or expand them here.
export function normalizeMapsUrl(value){
 if(value===undefined||value===null)return '';
 if(typeof value!=='string')return null;
 const text=value.trim();if(!text)return '';
 if(text.length>2048||/[\u0000-\u001f\u007f]/.test(text))return null;
 try{
  const url=new URL(text);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase(),path=url.pathname;
  const googleHost=['google.com','www.google.com','google.jo','www.google.jo','google.com.jo','www.google.com.jo','maps.google.com'].includes(host);
  const valid=host==='maps.app.goo.gl'?/^\/[a-z0-9_-]+\/?$/i.test(path):
   host==='goo.gl'?/^\/maps\/[a-z0-9_-]+\/?$/i.test(path):
   googleHost&&(/^\/maps(?:\/|$)/.test(path)||host==='maps.google.com'&&path==='/');
  return valid?url.href:null;
 }catch{return null}
}

export function orderMapLink(value){
 const url=normalizeMapsUrl(value);if(!url)return '';
 const safeUrl=url.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return `<a class="order-map-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">فتح موقع التوصيل على خرائط Google ↗</a>`;
}
