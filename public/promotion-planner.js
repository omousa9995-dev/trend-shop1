// A unit can belong to one bundle only. Independent bundles may be combined.
// Search is bounded so unusually large administrator-created sets cannot stall
// a checkout. All retained candidates remain valid, even at the safety bound.
const MAX_STATES=6000,MAX_PLANS=12000;
export function planPromotions(available,offers,itemsSubtotalFils,shippingFee){
 const groups=[];
 for(const offer of offers){
  const ids=new Set(offer.items.map(x=>x.id)),touching=groups.filter(g=>[...ids].some(id=>g.ids.has(id)));
  const group={ids,offers:[offer]};
  for(const g of touching){for(const id of g.ids)ids.add(id);group.offers.push(...g.offers);groups.splice(groups.indexOf(g),1)}
  groups.push(group);
 }
 const payable=saving=>itemsSubtotalFils-saving+shippingFee(itemsSubtotalFils-saving);
 const trim=(rows,limit)=>rows.size<=limit?rows:new Map([...rows].sort((a,b)=>payable(a[0])-payable(b[0])||b[0]-a[0]).slice(0,limit));
 let plans=new Map([[0,[]]]);
 for(const group of groups){
  const ids=[...group.ids],caps=ids.map(id=>available.get(id)||0);
  let states=[{used:ids.map(()=>0),saving:0,plan:[]}];
  for(const offer of group.offers){
   const qty=ids.map(id=>offer.items.find(x=>x.id===id)?.qty||0),next=new Map();
   for(const state of states){
    const count=Math.min(...qty.map((q,i)=>q?Math.floor((caps[i]-state.used[i])/q):Infinity));
    for(let uses=0;uses<=count;uses++){
     const used=state.used.map((n,i)=>n+qty[i]*uses),saving=state.saving+offer.saving*uses,key=used.join(',')+'|'+saving;
     if(!next.has(key))next.set(key,{used,saving,plan:uses?[...state.plan,{...offer,count:uses,savingFils:offer.saving*uses}]:state.plan});
    }
   }
   states=[...next.values()];
   if(states.length>MAX_STATES)states=states.sort((a,b)=>payable(a.saving)-payable(b.saving)||b.saving-a.saving).slice(0,MAX_STATES);
  }
  const savings=new Map([[0,[]]]);for(const state of states)if(!savings.has(state.saving))savings.set(state.saving,state.plan);
  let combined=new Map();for(const [a,pa] of plans)for(const [b,pb] of savings){if(!combined.has(a+b))combined.set(a+b,[...pa,...pb]);if(combined.size>MAX_PLANS*2)combined=trim(combined,MAX_PLANS)}
  plans=trim(combined,MAX_PLANS);
 }
 let bestSaving=0,best=[];
 for(const [saving,plan] of plans){const total=payable(saving),bestTotal=payable(bestSaving),delivery=shippingFee(itemsSubtotalFils-saving),bestDelivery=shippingFee(itemsSubtotalFils-bestSaving);
  if(total<bestTotal||total===bestTotal&&delivery<bestDelivery||total===bestTotal&&delivery===bestDelivery&&saving>bestSaving){bestSaving=saving;best=plan}
 }
 return {discountFils:bestSaving,promotions:best.map(({saving,...p})=>p)};
}
