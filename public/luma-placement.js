export function careEntriesAllowed(location){
 return !/^\/p(?:\/|$)/.test(location.pathname)&&!/^#\/(?:product|checkout|success|order)(?:[/?]|$)/.test(location.hash);
}
export function installCareEntries({status,loadWidget=()=>import('./luma-widget.js?v=5.19.1').then(m=>m.mountLumaWidget({status}))}){
 let widget,loading,version=0,stopped=false;
 const regions=[...document.querySelectorAll('[data-care-region]')];
 function update(){
  const allowed=!stopped&&status.available&&careEntriesAllowed(location),en=document.documentElement.lang==='en';
  for(const region of regions){region.hidden=!allowed;const footer=region.dataset.careRegion==='footer';region.querySelector('[data-luma-entry-title]').textContent=footer?(en?'Talk to Luma':'احكي مع لُمى'):(en?'Luma':'لُمى');const note=region.querySelector('[data-luma-entry-note]');if(note)note.textContent=en?'Your skincare, makeup and product questions, one conversation away.':'روتينكِ، مكياجكِ واختياراتكِ… نرتّبها سوا، خطوة بخطوة.';const cta=region.querySelector('[data-luma-entry-cta]');if(cta)cta.textContent=en?'Start chatting →':'ابدئي المحادثة ←'}
  if(!allowed){version++;widget?.destroy();widget=undefined;loading=undefined}
 }
 async function click(event){
  const entry=event.target.closest?.('[data-care-entry]');if(!entry||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(stopped||!careEntriesAllowed(location))return;event.preventDefault();const ticket=version;
  try{const api=widget||await(loading||=Promise.resolve(loadWidget()));if(stopped||ticket!==version||!careEntriesAllowed(location)){api.destroy();return}widget=api;api.open()}catch{loading=undefined;if(!stopped&&ticket===version&&careEntriesAllowed(location))location.href='/care-assistant.html'}
 }
 const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.addEventListener('hashchange',update);window.addEventListener('popstate',update);document.addEventListener('click',click);update();
 return {update,destroy(){stopped=true;update();observer.disconnect();window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);document.removeEventListener('click',click)}};
}
