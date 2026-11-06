// Native modal focus and viewport sizing keep results usable above a phone keyboard.
export function createSearchDialog({panel,trigger,field,box,onClose=()=>{}}){
 let previousFocus,overflow='',purpose='browse';
 const fit=()=>{const viewport=window.visualViewport;panel.dataset.compact=String((viewport?.height||window.innerHeight)<520);panel.style.setProperty('--search-height',(viewport?.height||window.innerHeight)+'px');panel.style.setProperty('--search-top',(viewport?.offsetTop||0)+'px');};
 function close({restoreFocus=true}={}){if(panel.hidden)return;const focus=previousFocus;panel.hidden=true;if(panel.open)panel.close();box.hidden=true;trigger.setAttribute('aria-expanded','false');field.setAttribute('aria-expanded','false');field.removeAttribute('aria-activedescendant');document.body.style.overflow=overflow;window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit);purpose='browse';onClose();if(restoreFocus&&focus?.isConnected)focus.focus({preventScroll:true});}
 function open(mode='browse'){if(!panel.hidden)return;purpose=mode;previousFocus=document.activeElement;overflow=document.body.style.overflow;fit();panel.hidden=false;trigger.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);window.addEventListener('resize',fit);if(panel.showModal)panel.showModal();else panel.setAttribute('open','');field.focus({preventScroll:true});}
 panel.addEventListener('cancel',event=>{event.preventDefault();close()});
 panel.addEventListener('click',event=>{if(event.target!==panel)return;const rect=panel.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()});
 return {open,close,get purpose(){return purpose}};
}
