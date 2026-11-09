import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {isKoreanCare} from '../public/korean-care.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const products=read('public/catalog.json'),galleries=read('public/product-galleries.json');
const baseline={};
for(const p of products){
 const primary=p.image||p.image_url,profilePath='public/product-stories/'+p.id+'.json';
 const profile=existsSync(profilePath)?read(profilePath):null;
 const photos=[{url:primary,kind:'pack'},...(isKoreanCare(p)&&profile?.primary===primary?profile.images:[])||[],...(galleries[p.id]?.primary===primary?galleries[p.id].images:[]).map(url=>({url,kind:url.includes('/marketing/')?'promotional':'pack'}))];
 baseline[p.id]=photos.filter((x,i,a)=>x?.url&&a.findIndex(y=>y?.url===x.url)===i).slice(0,7).map(({url,kind,label,thumbnail})=>({url,kind:kind||'pack',...(label?{label}:{}),...(thumbnail?{thumbnail}:{})}));
}
writeFileSync('src/product-media-baseline.js','// Generated from reviewed catalog galleries and product profiles.\nexport const PRODUCT_MEDIA_BASELINE='+JSON.stringify(baseline)+';\n');
