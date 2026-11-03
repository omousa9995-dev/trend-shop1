import {brandName} from './brand-tools.js';
// Korean beauty brands represented in this store. Other ranges retain their
// existing product category; this collection is an additional browsing route.
export const KOREAN_BRANDS = new Set([
 'Abib','Anua','APRILSKIN','Arencia','AXIS-Y','Beauty of Joseon','Biodance',
 'Celimax','Centellian24','COSRX','Derma:B','Dr. Althea','Dr.Melaxin','Elizavecca',
 'EQQUALBERRY','ETUDE','Farmstay','Haruharu Wonder','Isntree','JUMISO','KSECRET',
 'Mary & May','Medicube','mixsoon','Numbuzin','P.CALM','PURITO SEOUL','ROUND LAB',
 'SEAPURI','Secret Key','SKIN1004','SOME BY MI','TIRTIR','VT','VT Cosmetics'
].map(x=>brandName(x).toLowerCase()));
export const isKoreanCare = product => KOREAN_BRANDS.has(brandName(product?.brand).toLowerCase());
export const KOREAN_CARE_HREF = '#/shop?collection=korean-care';
