import {tx} from './i18n.js?v=5.1.0';

const icon=paths=>`<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const icons=[
 icon('<path d="M3 9h16v14H3zM19 14h6l4 5v4H19"/><path d="M22 14v5h7"/><circle cx="9" cy="24" r="3"/><circle cx="24" cy="24" r="3"/><path d="M7 5h9M5 2h7"/>'),
 icon('<path d="m4 10 12-6 12 6v15l-12 5-12-5zM4 10l12 6 12-6M16 16v14"/><path d="m11 7 12 6"/><path d="m11 21 3 3 6-6"/>'),
 icon('<path d="M16 3 28 8v8c0 7-6 11-12 14C10 27 4 23 4 16V8z"/><path d="m10 16 4 4 8-9"/>')
];

// The customer's screenshot is the only addition to the pre-pilot Arencia page.
export function mountArenciaServiceCard(root,{product}={}){
 if(product?.id!=='TS0098')return null;
 const purchase=root.querySelector('.story-purchase');
 if(!purchase)return null;
 const existing=root.querySelector('.arencia-service-card');if(existing)return existing;
 const card=root.ownerDocument.createElement('div');card.className='arencia-service-card';
 card.setAttribute('role','group');card.setAttribute('aria-label',tx('خدمة Trend Shop','Trend Shop service'));
 const rows=[
  [tx('خلال 24 ساعة','Within 24 hours'),tx('لجميع مناطق المملكة','Every area of Jordan')],
  [tx('تفقدي طلبكِ قبل الدفع','Inspect before paying'),tx('عند الاستلام','On delivery')],
  [tx('منتجات أصلية 100%','100% authentic products'),tx('تسوّقي بثقة','Shop with confidence')]
 ];
 rows.forEach(([title,caption],i)=>{
  const row=root.ownerDocument.createElement('div');row.className='arencia-service-row';row.innerHTML=icons[i];
  const heading=root.ownerDocument.createElement('strong');heading.textContent=title;
  const note=root.ownerDocument.createElement('span');note.textContent=caption;
  row.append(heading,note);card.append(row);
 });
 purchase.before(card);return card;
}
