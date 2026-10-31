const BRAND_ALIASES={cosrex:'cosrx',kiko:'kikomilano',vt:'vtcosmetics',loreal:'lorealparis'};
const BRAND_NAMES={cosrx:'COSRX',anua:'Anua',kikomilano:'KIKO Milano',vtcosmetics:'VT Cosmetics',lorealparis:"L'Oreal Paris",misslara:'Miss Lara'};
export function brandKey(value){const key=String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');return BRAND_ALIASES[key]||key}
export function brandName(value){return BRAND_NAMES[brandKey(value)]||String(value||'').trim()}
export function availableBrands(products){const names=new Map();for(const p of products){const key=brandKey(p.brand);if(key&&!names.has(key))names.set(key,brandName(p.brand))}return [...names.values()].sort((a,b)=>a.localeCompare(b,'ar'))}
export function matchesBrand(product,value){return !value||brandKey(product.brand)===brandKey(value)}
export function brandHref(value){return '#/shop?brand='+encodeURIComponent(brandName(value))}
