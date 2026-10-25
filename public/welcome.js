const SEEN_KEY='trend-shop-welcome-v1';

export function initWelcome() {
  const dialog=document.querySelector('#welcomeDialog');
  const atHome=()=>['','/'].includes((location.hash.slice(1)||'/').split('?')[0]);
  if(!dialog||typeof dialog.showModal!=='function'||!atHome())return;
  try{if(sessionStorage.getItem(SEEN_KEY)==='seen')return;}catch{}
  let stopEffect=()=>{},closed=false,shown=false,previousOverflow='';
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const remember=()=>{try{sessionStorage.setItem(SEEN_KEY,'seen')}catch{}};
  const finish=()=>{if(dialog.open)dialog.close();else if(!shown)cleanup();};
  const cleanup=()=>{
    if(closed)return;closed=true;remember();stopEffect();if(shown)document.body.style.overflow=previousOverflow;
    window.removeEventListener('hashchange',finish);motion.removeEventListener?.('change',motionChanged);
  };
  const startEffect=async()=>{
    if(motion.matches){dialog.querySelector('.welcome-art').dataset.effectReason='reduced-motion';return;}if(closed||!dialog.open)return;
    dialog.querySelector('.welcome-art').dataset.effectReason='loading';try{const {renderWelcomePearl}=await import('./welcome-orb.js?v=1.6.0-r2');if(dialog.open&&!closed&&!motion.matches)stopEffect=renderWelcomePearl(dialog.querySelector('canvas'));}catch{dialog.querySelector('.welcome-art').dataset.effectReason='module-unavailable';}
  };
  const motionChanged=()=>{stopEffect();stopEffect=()=>{};const art=dialog.querySelector('.welcome-art');art.dataset.renderer='fallback';dialog.querySelector('canvas').hidden=true;if(!motion.matches)void startEffect();};
  dialog.addEventListener('close',cleanup,{once:true});
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
  dialog.querySelectorAll('[data-welcome-dismiss],a').forEach(el=>el.addEventListener('click',finish));
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)finish();});
  window.addEventListener('hashchange',finish);motion.addEventListener?.('change',motionChanged);
  // Do not interrupt a link, drawer, or search the customer opened while loading.
  window.setTimeout(()=>{
    if(closed||shown||!atHome()||!document.querySelector('#drawer').hidden||!document.querySelector('#searchPanel').hidden){cleanup();return;}
    previousOverflow=document.body.style.overflow;
    try{dialog.showModal();shown=true;document.body.style.overflow='hidden';remember();void startEffect();}catch{cleanup();}
  },450);
}
