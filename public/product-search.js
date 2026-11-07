import {normalizeSearch,productDetails} from './shop-tools.js';
// Local vocabulary only: no customer search text is sent to another service.
const groups=[
 ['cosrx','كوسركس','كوزركس','كوسريكس','كوزريكس'],['arencia','ارينسيا','ارنسيا','ارنسيا','ارينشيا'],['anua','انوا','انوه'],['skin1004','skin 1004','سكين1004','سكين 1004'],
 ['loreal','l oreal','لوريال','لوريل'],['maybelline','ميبلين','مايبلين','ميبيلين'],['sheglam','شيجلام','شيغلام','شيقلام'],['hudabeauty','huda beauty','هدي بيوتي','هودا بيوتي'],['theordinary','the ordinary','اوريدناري','اورديناري','اوريناري'],['beautyofjoseon','beauty of joseon','بيوتي اوف جوسون','جوسون'],['tarte','تارت'],['bourjois','بورجوا','برجوا'],['kiko','كيكو'],['note','نوت'],['dior','ديور'],['clinique','كلينيك'],['esteelauder','estee lauder','استي لودر','استي لودر'],
 ['mascara','ماسكارا','مسكارا'],['foundation','فاونديشن','فوندشن','كريم اساس'],['concealer','كونسيلر','كنسيلر'],['powder','بودرة','بودره'],['sunscreen','واقي شمس','واقي الشمس','واقيشمس','صن سكرين'],['toner','تونر'],['serum','سيروم'],['cleanser','غسول'],['moisturizer','مرطب'],['lipstick','روج','احمر شفاه'],['eyeliner','ايلاينر','اي لاينر'],['shampoo','شامبو']
];
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliases=groups.flatMap(([canonical,...names])=>[canonical,...names].map(n=>({from:normalizeSearch(n),to:canonical}))).sort((a,b)=>b.from.length-a.from.length);
export function canonicalProductSearch(value){let out=' '+normalizeSearch(value)+' ';for(const {from,to} of aliases)out=out.replace(new RegExp(' '+escapeRegExp(from)+'(?= )','g'),' '+to);return out.trim();}
const indexes=new WeakMap();
function indexFor(products){
 let index=indexes.get(products);if(index)return index;
 const rows=products.map((product,order)=>{const d=productDetails(product),title=canonicalProductSearch(`${d.nameAr||''} ${d.en?.name||''} ${product.name}`),text=canonicalProductSearch(`${title} ${product.brand||''} ${product.category||''} ${product.subcat||product.subcategory||''} ${d.productType||''}`);return {product,title,text,words:text.split(' '),order};});
 const vocabulary=[...new Set(rows.flatMap(r=>r.words))].filter(w=>w.length>=3&&w.length<=30);index={rows,vocabulary,corrections:new Map()};indexes.set(products,index);return index;
}
function exact(index,query){const words=query.split(' ').filter(Boolean);if(!words.length)return index.rows.map(r=>r.product);return index.rows.filter(r=>words.every(word=>r.text.includes(word))).map(r=>({...r,score:words.reduce((n,w)=>n+(r.title.startsWith(w)?12:r.title.split(' ').some(x=>x.startsWith(w))?8:r.title.includes(w)?4:1),0)})).sort((a,b)=>b.score-a.score||a.order-b.order).map(r=>r.product);}
function distance(a,b,max){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let older,previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const current=[i];for(let j=1;j<=b.length;j++){current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])current[j]=Math.min(current[j],older[j-2]+1);}older=previous;previous=current;}
 return previous[b.length];
}
function correction(index,query){
 if(index.corrections.has(query))return index.corrections.get(query);
 const words=query.split(' ').filter(Boolean);let total=0,changed=false;
 if(words.length>6||query.length>90)return '';
 const corrected=words.map(word=>{
  if(index.rows.some(r=>r.text.includes(word)))return word;
  if(word.length<4||/\d/.test(word)){total=99;return word;}
  const max=word.length>=8?2:1;let best='',score=max+1;
  for(const candidate of index.vocabulary){if(/\d/.test(candidate)||candidate[0]!==word[0]&&word.length<6)continue;const d=distance(word,candidate,max);if(d<score){score=d;best=candidate;}}
  if(!best||score>max){total=99;return word;}total+=score;changed=true;return best;
 }).join(' ');
 const result=changed&&total<=2&&exact(index,corrected).length?corrected:'';if(index.corrections.size>100)index.corrections.clear();index.corrections.set(query,result);return result;
}
export function searchCorrection(products,query){const index=indexFor(products),key=canonicalProductSearch(query);return exact(index,key).length?'':correction(index,key);}
export function searchProducts(products,query){const index=indexFor(products),key=canonicalProductSearch(query),rows=exact(index,key);return rows.length?rows:exact(index,correction(index,key)||'\u0000');}
export function nearbyAvailableProducts(products,anchor,{limit=4}={}){
 const category=anchor?.category,brand=canonicalProductSearch(anchor?.brand),base=Number(anchor?.priceFils??anchor?.price_fils)||0;
 return products.filter(p=>p.id!==anchor?.id&&p.active!==0&&p.approved!==false&&p.approved!==0&&Number(p.stock)>0&&(!category||p.category===category)).map(p=>({p,score:(canonicalProductSearch(p.brand)===brand?100:0)+(productDetails(p).productType&&productDetails(p).productType===productDetails(anchor||{}).productType?200:0)-Math.abs((p.priceFils??p.price_fils??0)-base)/100})).sort((a,b)=>b.score-a.score||String(a.p.id).localeCompare(String(b.p.id))).slice(0,limit).map(x=>x.p);
}
