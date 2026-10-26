// Keep a touch selection alive until click. Mobile browsers may blur the field
// after pointerup and before the compatibility click, with relatedTarget=null.
export function bindProductAutocomplete(field,box,{matches,renderOption,onSelect,onSearch,onInput=()=>{}}){
 let active=-1,composing=false,selecting=false,blurTimer,releaseTimer;
 const close=()=>{clearTimeout(blurTimer);clearTimeout(releaseTimer);selecting=false;box.hidden=true;field.setAttribute('aria-expanded','false');field.removeAttribute('aria-activedescendant');active=-1};
 const options=()=>[...box.querySelectorAll('[role="option"]')];
 const update=()=>{clearTimeout(blurTimer);active=-1;field.removeAttribute('aria-activedescendant');const term=field.value.trim();if(!term){close();return}const list=matches(term).slice(0,6);box.innerHTML=list.length?list.map((p,i)=>renderOption(p,box.id+'-'+i)).join(''):'<p class="search-empty">لم نجد هذا الاسم، جرّبي اسم الماركة أو المنتج.</p>';box.hidden=false;field.setAttribute('aria-expanded','true')};
 const deferBlur=()=>{clearTimeout(blurTimer);blurTimer=setTimeout(()=>{const focused=field.ownerDocument.activeElement;if(!selecting&&focused!==field&&!box.contains(focused))close()},0)};
 box.addEventListener('pointerdown',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||!e.target.closest('[role="option"]'))return;clearTimeout(releaseTimer);selecting=true;if(e.pointerType!=='touch')e.preventDefault()});
 box.addEventListener('pointerup',()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{selecting=false;deferBlur()},800)});
 box.addEventListener('pointercancel',()=>{selecting=false;deferBlur()});
 box.addEventListener('focusout',deferBlur);
 box.addEventListener('click',e=>{const option=e.target.closest('[role="option"]');if(!option||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();const href=option.getAttribute('href');close();onSelect(href)});
 field.addEventListener('compositionstart',()=>{composing=true});field.addEventListener('compositionend',()=>{composing=false;update();onInput(field.value)});
 field.addEventListener('input',()=>{if(composing)return;update();onInput(field.value)});
 field.addEventListener('focus',()=>{if(field.value.trim())update()});
 field.addEventListener('blur',deferBlur);
 field.addEventListener('keydown',e=>{if(e.isComposing||composing)return;if(e.key==='Escape'){close();return}const list=options();if((e.key==='ArrowDown'||e.key==='ArrowUp')&&list.length){e.preventDefault();box.hidden=false;field.setAttribute('aria-expanded','true');active=(active+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;list.forEach((x,i)=>{x.setAttribute('aria-selected',String(i===active));x.classList.toggle('selected',i===active)});field.setAttribute('aria-activedescendant',list[active].id);list[active].scrollIntoView({block:'nearest'});return}if(e.key==='Enter'){e.preventDefault();const href=active>=0&&!box.hidden?list[active]?.getAttribute('href'):null;close();href?onSelect(href):onSearch(field.value.trim())}});
 return close;
}
