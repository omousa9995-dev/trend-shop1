import {brandName} from './brand-tools.js';
import {productDetails} from './shop-tools.js';
// Korean beauty brands represented in this store. Other ranges retain their
// existing product category; this collection is an additional browsing route.
export const KOREAN_BRANDS = new Set([
 'Abib','Anua','APRILSKIN','Arencia','AXIS-Y','Beauty of Joseon','Biodance',
 'Celimax','Centellian24','COSRX','Derma:B','Dr. Althea','Dr.Melaxin','Elizavecca',
 'EQQUALBERRY','ETUDE','Farmstay','Haruharu Wonder','Isntree','JUMISO','KSECRET',
 'Mary & May','Medicube','mixsoon','Numbuzin','P.CALM','PURITO SEOUL','ROUND LAB',
 'SEAPURI','Secret Key','SKIN1004','SOME BY MI','TIRTIR','VT','VT Cosmetics'
].map(x=>brandName(x).toLowerCase()));
export const isKoreanBrand = brand => KOREAN_BRANDS.has(brandName(brand).toLowerCase());
export function isKoreanCare(product){
 if(!product)return false;
 const details=productDetails(product);
 // Only the owner's explicit choice overrides brand detection. Historic
 // collection tags keep their previous behavior until deliberately edited.
 return typeof details?.koreanCare==='boolean'?details.koreanCare:isKoreanBrand(product.brand);
}
export const KOREAN_CARE_HREF = '#/shop?collection=korean-care';
