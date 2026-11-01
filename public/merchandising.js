import {productDetails} from './shop-tools.js';
// Editorial selection, not sales-based rankings or unverified best-seller claims.
export const PRIORITY_PRODUCTS=['TS0079','TS0065','TS0085','TS0059','TS0091','TS0067','TS0347','TS0309','TS0307','TS0256','TS0250','TS0257','TS0080','TS0061','TS0090','TS0076','TS0301','TS0302','TS0304','TS0313','TS0315','TS0335','TS0348','TS0259','TS0056','TS0084','TS0092','TS0066','TS0038','TS0103'];
const ranks=new Map(PRIORITY_PRODUCTS.map((id,i)=>[id,i]));
export function priorityCompare(a,b){const rank=p=>ranks.get(p.id)??(Number.isFinite(productDetails(p).merchandisingPriority)?productDetails(p).merchandisingPriority:500);return (Number(b.stock>0)-Number(a.stock>0))||rank(a)-rank(b)||a.id.localeCompare(b.id)}
export const curatedProducts=products=>products.slice().sort(priorityCompare);
