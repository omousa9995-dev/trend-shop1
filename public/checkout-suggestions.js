import {checkoutRecommendations} from './checkout-recommendations.js';
import {brandHref,brandName} from './brand-tools.js';

const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createCheckoutSuggestions({document:doc,getContext,onAdd}){
 const panel=doc.createElement('dialog');panel.id='checkoutSuggestions';panel.className='checkout-suggestions';
 panel.setAttribute('aria-labelledby','checkoutSuggestionsTitle');panel.setAttribute('data-no-translate','');doc.body.append(panel);
 let previousFocus,overflow='',choices=new Map();
 const text=(ar,en)=>getContext().language==='en'?en:ar;
 function close({restoreFocus=true}={}){
  if(!panel.open)return;panel.close();doc.body.style.overflow=overflow;
  if(restoreFocus){const focus=previousFocus?.isConnected?previousFocus:doc.querySelector('[data-checkout-add]');focus?.focus({preventScroll:true})}
 }
 function render(){
  const ctx=getContext(),language=ctx.language==='en'?'En':'Ar',scroll=panel.querySelector('[data-suggestions-content]')?.scrollTop||0;
  const list=checkoutRecommendations(ctx.products,ctx.cart,{promotions:ctx.promotions});
  panel.innerHTML=`<header class="suggestions-heading"><div><span lang="en">A LITTLE MORE, CHOSEN FOR YOU</span><h2 id="checkoutSuggestionsTitle" tabindex="-1">${text('اختيارات تكمّل طلبكِ ♡','A few touches to complete your order ♡')}</h2><p>${text(ctx.cart.length?'اختيارات بحسب سلتكِ؛ أضيفي ما تحبّين، أو أكملي طلبكِ كما هو.':'ابدئي باختيار تحبّينه؛ تفاصيل التوصيل تبقى مكانها.',ctx.cart.length?'Based on your bag. Add what you like, or continue with your current order.':'Start with a favourite. Your delivery details stay in place.')}</p></div><button type="button" class="suggestions-close" data-suggestions-close aria-label="${text('إغلاق الاقتراحات','Close suggestions')}">×</button></header><p class="suggestions-status" data-suggestions-status role="status" aria-live="polite"></p><div class="suggestions-content" data-suggestions-content>${list.length?list.map(group=>`<section class="suggestions-group" data-suggestion-group="${group.id}" aria-labelledby="suggestion-${group.id}"><h3 id="suggestion-${group.id}">${safe(group['title'+language])}</h3><p>${safe(group['reason'+language])}</p><div class="suggestions-grid">${group.items.map(({product:p,type})=>{
   const options=ctx.options(p),name=ctx.name(p),selected=choices.get(p.id)||'';
   return `<article class="suggestion-card" data-suggestion-product="${safe(p.id)}" data-suggestion-type="${safe(type)}"><img src="${safe(ctx.image(p))}" alt="${safe(name)}" width="84" height="100" loading="lazy" decoding="async"/><div class="suggestion-card-copy"><a class="brand-link suggestion-brand" href="${safe(brandHref(p.brand))}" target="_blank" rel="noopener noreferrer" aria-label="${safe(text('جميع منتجات ','All products by ')+brandName(p.brand))}">${safe(brandName(p.brand))}</a><h4>${safe(name)}</h4><strong>${safe(ctx.price(p))}</strong>${options.length?`<label class="suggestion-option" for="suggestion-option-${safe(p.id)}">${text('اختاري الدرجة أو النسخة','Choose your shade or option')}<select id="suggestion-option-${safe(p.id)}" data-suggestion-option="${safe(p.id)}"><option value="">${text('اختاري قبل الإضافة','Choose before adding')}</option>${options.map(o=>`<option value="${safe(o.id)}" ${selected===o.id?'selected':''}>${safe(o.label)}</option>`).join('')}</select></label>`:''}<button type="button" class="suggestion-add" data-suggestion-add="${safe(p.id)}" aria-label="${safe(text('أضيفي ','Add ')+name)}">+ ${text('أضيفي لطلبي','Add to my order')}</button></div></article>`;
  }).join('')}</div></section>`).join(''):`<div class="suggestions-empty"><span aria-hidden="true">♡</span><h3>${text('اختياراتكِ جاهزة','Your choices are ready')}</h3><p>${text('لا توجد حاليًا إضافات مكمّلة متوفرة لهذه السلة. يمكنكِ إكمال طلبكِ كما هو.','There are no available complementary additions for this bag right now. You can continue with your order as it is.')}</p></div>`}</div><footer class="suggestions-footer"><p>${text('إجمالي طلبكِ مع التوصيل','Your order including delivery')} <strong>${safe(ctx.total())}</strong></p><button type="button" class="btn" data-suggestions-close>${text('العودة لإكمال طلبي','Back to my order')}</button></footer>`;
  panel.querySelector('[data-suggestions-content]').scrollTop=scroll;
 }
 function open(trigger){
  if(panel.open)return;previousFocus=trigger||doc.activeElement;overflow=doc.body.style.overflow;choices=new Map();render();
  panel.showModal();doc.body.style.overflow='hidden';panel.querySelector('#checkoutSuggestionsTitle').focus({preventScroll:true});
 }
 panel.addEventListener('change',event=>{const field=event.target.closest('[data-suggestion-option]');if(field){choices.set(field.dataset.suggestionOption,field.value);field.removeAttribute('aria-invalid')}});
 panel.addEventListener('click',event=>{
  if(event.target.closest('[data-suggestions-close]')){close();return}
  const button=event.target.closest('[data-suggestion-add]');if(!button)return;
  const ctx=getContext(),id=button.dataset.suggestionAdd,p=ctx.products.find(x=>x.id===id);if(!p)return;
  const field=panel.querySelector(`[data-suggestion-option="${id}"]`),status=panel.querySelector('[data-suggestions-status]');
  if(field&&!ctx.options(p).some(o=>o.id===field.value)){field.setAttribute('aria-invalid','true');status.textContent=text('اختاري الدرجة أو النسخة أولًا، ثم أضيفي المنتج.','Choose a shade or option first, then add the item.');field.focus();return}
  const group=button.closest('[data-suggestion-group]').dataset.suggestionGroup;
  if(!onAdd(id,field?.value||'')){status.textContent=text('تعذّرت الإضافة؛ راجعي الكمية وتوفّر المنتج في السلة.','The item could not be added. Review its quantity and availability.');return}
  render();panel.querySelector('[data-suggestions-status]').textContent=text('أُضيف '+ctx.name(p)+' إلى طلبكِ.','Added '+ctx.name(p)+' to your order.');
  (panel.querySelector(`[data-suggestion-group="${group}"] [data-suggestion-add]`)||panel.querySelector('#checkoutSuggestionsTitle')).focus({preventScroll:true});
 });
 panel.addEventListener('cancel',event=>{event.preventDefault();close()});
 panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close()});
 return {open,close,get isOpen(){return panel.open}};
}
