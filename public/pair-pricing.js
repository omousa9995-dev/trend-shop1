// Integer fils only. 60 hundredths rounds up; the final tag ends in .99.
export function pairPriceFils(unitFils){
 if(!Number.isSafeInteger(unitFils)||unitFils<500||unitFils>1000000)return null;
 const numerator=unitFils*18,whole=Math.floor(numerator/10000),remainder=numerator%10000;
 const tagged=Math.max(990,(whole+(remainder>=6000?1:0))*1000-10);
 // A pair must never cost more than two singles: retain the 10% price for
 // the few low prices whose .99 tag would otherwise create a surcharge.
 return tagged>=unitFils*2?Math.floor(numerator/100)*10:tagged;
}
export const withPairPricing=(products,enabled)=>products.map(p=>enabled?{...p,automaticPairPriceFils:pairPriceFils(Number(p.priceFils??p.price_fils))}:p);
export function quantityPriceFils(product,quantity){
 const unit=Number(product?.priceFils??product?.price_fils??0),pair=product?.automaticPairPriceFils;
 return Number.isInteger(pair)&&pair>0&&pair<unit*2?Math.floor(quantity/2)*pair+(quantity%2)*unit:quantity*unit;
}
