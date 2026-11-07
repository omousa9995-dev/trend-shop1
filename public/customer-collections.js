// Only public product IDs are saved, on this browser. No identity, order/contact
// data or cross-site identifier is stored or transmitted.
const KEY='trend-shop-collections-v1',valid=id=>typeof id==='string'&&/^TS[A-Z0-9-]{4,64}$/.test(id),DAY=86400000;
export function createCustomerCollections({storage,now=()=>Date.now(),onChange=()=>{}}={}){
 let data={favorites:[],recent:[]},persistent=!!storage;
 try{const raw=JSON.parse(storage?.getItem(KEY)||'null');if(raw&&typeof raw==='object'){data.favorites=[...new Set((Array.isArray(raw.favorites)?raw.favorites:[]).filter(valid))].slice(0,100);data.recent=(Array.isArray(raw.recent)?raw.recent:[]).filter(x=>x&&valid(x.id)&&Number.isFinite(x.at)&&now()-x.at>=0&&now()-x.at<=30*DAY).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,20);}}catch{persistent=false;}
 function save(){try{storage?.setItem(KEY,JSON.stringify(data));}catch{persistent=false;}onChange();}
 return {isFavorite:id=>data.favorites.includes(id),toggle(id){if(!valid(id))return false;const index=data.favorites.indexOf(id);if(index>=0)data.favorites.splice(index,1);else{data.favorites.unshift(id);data.favorites=data.favorites.slice(0,100);}save();return data.favorites.includes(id);},visit(id){if(!valid(id))return;data.recent=[{id,at:now()},...data.recent.filter(x=>x.id!==id)].slice(0,20);save();},favorites:()=>data.favorites.slice(),recent:()=>data.recent.filter(x=>now()-x.at<=30*DAY).map(x=>x.id),clear(kind){if(kind==='favorites')data.favorites=[];else if(kind==='recent')data.recent=[];else data={favorites:[],recent:[]};save();},get persistent(){return persistent;}};
}
export const collectionStorageKey=KEY;
