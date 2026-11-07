import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {SHOPPING_NEEDS,matchesShoppingNeed,availableShoppingNeeds,productCardSummary,discoveryHref} from '../public/product-discovery.js';
import {productType} from '../public/product-types.js';
import {DEFAULT_SITE_SETTINGS} from '../public/site-settings.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),json=p=>JSON.parse(read(p));
const products=json('public/catalog.json');
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await pause()}assert.ok(fn(),'expected storefront state did not arrive')}
async function open(t,path='#/',settings=DEFAULT_SITE_SETTINGS){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(read('public/index.html'),{url:'https://trendjo.pages.dev/'+path,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.fetch=async url=>{const path=String(url).split('?')[0];if(path==='/api/orders')throw Error('A discovery test must not place an order');const data=path==='/api/catalog'?{products,promotions:json('public/campaign-offers.json'),storeLive:false,siteSettings:settings}:path==='/api/reviews'?{reviews:[],summary:{count:0,average:null}}:path==='/api/product-videos'?{videos:[]}:['/category-media.json','/product-galleries.json','/catalog-thumbnails.json','/product-media.json'].includes(path)?json('public'+path):{};return {ok:true,json:async()=>data}};
 w.eval(storefrontBundle);await until(()=>d.querySelector('.product-card'));assert.deepEqual(errors,[]);return {w,d,errors};
}
const fixture=(type,benefits=[],extra={})=>({id:'TS-CARE',category:'البشرة',name:'Care step',details:{productType:type,benefits},...extra});

test('Care needs select relevant product types and do not infer a benefit from warnings or directions',()=>{
 assert.equal(matchesShoppingNeed(fixture('cleanser'),'cleansing'),true);
 assert.equal(matchesShoppingNeed(fixture('sunscreen'),'sun-care'),true);
 assert.equal(matchesShoppingNeed(fixture('foundation',[],{category:'المكياج',name:'SPF glow foundation'}),'sun-care'),false);
 assert.equal(matchesShoppingNeed(fixture('serum',['يدعم ترطيب البشرة']),'hydration'),true);
 assert.equal(matchesShoppingNeed(fixture('cleanser',['تنظيف مع الحفاظ على الترطيب']),'hydration'),false);
 const warnings=fixture('serum');warnings.details.notes='لا يعالج التصبغات أو الجفاف';warnings.details.howToUse='اتبعيه بمرطب للعناية بالترطيب';
 assert.equal(matchesShoppingNeed(warnings,'hydration'),false);assert.equal(matchesShoppingNeed(warnings,'glow'),false);
 assert.equal(matchesShoppingNeed(fixture('serum',['يساعد على تجانس اللون بالمظهر']),'glow'),true);
 assert.equal(matchesShoppingNeed(fixture('blush',['لمسة glow'],{category:'المكياج'}),'glow'),false);
 assert.equal(matchesShoppingNeed(fixture('hair-mask',[],{category:'الشعر'}),'hair-care'),true);
 assert.equal(matchesShoppingNeed(warnings,'unknown'),true);
 assert.equal(matchesShoppingNeed({...warnings,details:{productType:'serum',benefits:{bad:true}}},'hydration'),false);
});

test('Every displayed need has catalog products and summaries use the saved localized benefit',()=>{
 for(const need of SHOPPING_NEEDS)assert.ok(products.some(p=>matchesShoppingNeed(p,need.id)),need.id);
 assert.equal(availableShoppingNeeds([]).length,0);
 for(const p of products){for(const lang of ['ar','en']){const summary=productCardSummary(p,lang);assert.equal(typeof summary,'string');assert.ok(summary.length<=100)}}
 const p=fixture('serum',['ميزة محفوظة']);p.details.en={benefits:['Saved English benefit']};
 assert.equal(productCardSummary(p,'ar'),'ميزة محفوظة');assert.equal(productCardSummary(p,'en'),'Saved English benefit');
 assert.equal(productCardSummary(fixture('mascara',['عبارة عربية']),'en'),'A finishing touch for your lashes');
});

test('Discovery links keep the collection, brand, search, price and sort while changing one filter',()=>{
 const q=new URLSearchParams({collection:'korean-care',brand:'COSRX',q:'تونر',max:'15000',sort:'price-asc',need:'hydration'});
 const href=discoveryHref(q,{type:'toner'}),next=new URLSearchParams(href.split('?')[1]);
 for(const [key,value] of q)assert.equal(next.get(key),value);assert.equal(next.get('type'),'toner');
 assert.equal(new URLSearchParams(discoveryHref(next,{need:''}).split('?')[1]).has('need'),false);
 assert.equal(q.get('need'),'hydration','the caller query must not be mutated');
});

test('Home discovery is populated and continues to obey the owner category and Korean section switches',async t=>{
 const {d}=await open(t);assert.equal(d.querySelectorAll('.need-tile').length,5);assert.ok(d.querySelectorAll('.brand-tile').length>3);
 for(const a of d.querySelectorAll('.brand-tile'))assert.match(a.getAttribute('href'),/collection=korean-care/);
 assert.ok(d.querySelector('.product-purpose'));assert.ok(d.querySelector('.product-saving'));
 const settings=structuredClone(DEFAULT_SITE_SETTINGS);for(const section of settings.homeSections)if(['categories','korean'].includes(section.id))section.enabled=false;
 const hidden=await open(t,'#/',settings);assert.equal(hidden.d.querySelector('.need-discovery').closest('section').hidden,true);assert.equal(hidden.d.querySelector('.brand-discovery').closest('section').hidden,true);
});

test('Need, type and Korean collection filters combine; removing the need preserves other choices',async t=>{
 const {w,d}=await open(t,'#/shop?collection=korean-care&need=cleansing&sort=price-asc');
 assert.equal(d.querySelector('#needSelect').value,'cleansing');assert.ok(d.querySelectorAll('.product-card').length>0);
 const links=[...d.querySelectorAll('.type-pills a')];const cleanser=links.find(a=>a.href.includes('type=cleanser'));
 const q=new URLSearchParams(cleanser.getAttribute('href').split('?')[1]);assert.equal(q.get('collection'),'korean-care');assert.equal(q.get('need'),'cleansing');assert.equal(q.get('sort'),'price-asc');
 cleanser.click();await until(()=>d.querySelector('#typeSelect')?.value==='cleanser');
 for(const a of d.querySelectorAll('.product-name')){const id=decodeURIComponent(a.getAttribute('href').split('/').pop());assert.equal(productType(products.find(p=>p.id===id)),'cleanser')}
 const remove=d.querySelector('.discovery-active a[aria-label^="إزالة الفلتر"]');remove.click();await until(()=>d.querySelector('#needSelect')?.value==='');
 const after=new URLSearchParams(w.location.hash.split('?')[1]);assert.equal(after.get('type'),'cleanser');assert.equal(after.get('collection'),'korean-care');assert.equal(after.get('sort'),'price-asc');
});

test('Choosing a brand in Korean care keeps the collection and the need, and filtering keeps the bag',async t=>{
 const {w,d}=await open(t,'#/shop?collection=korean-care&need=cleansing');
 const tile=[...d.querySelectorAll('.brand-tile')].find(a=>a.textContent.trim()==='Arencia');assert.ok(tile);tile.click();await until(()=>d.querySelector('#brandSelect')?.value==='Arencia');
 const href=new URLSearchParams(w.location.hash.split('?')[1]);assert.equal(href.get('need'),'cleansing');assert.equal(href.get('collection'),'korean-care');
 for(const a of d.querySelectorAll('.brand-line'))assert.equal(a.textContent.trim(),'Arencia');
 const add=d.querySelector('.product-card [data-add]');assert.ok(add);add.click();assert.match(d.querySelector('#cartCount').textContent,/1/);
 d.querySelector('#needSelect').value='glow';d.querySelector('#needSelect').dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>w.location.hash.includes('need=glow'));
 assert.equal(JSON.parse(w.localStorage.getItem('trend-shop-cart-v1')).length,1);assert.equal(d.querySelector('#cartCount').textContent,'1');
});

test('An incompatible saved type remains visible and can be removed without losing the care need',async t=>{
 const {w,d}=await open(t,'#/shop?need=cleansing');w.location.hash='#/shop?need=cleansing&type=mascara';await until(()=>d.querySelector('#typeSelect')?.value==='mascara'&&d.querySelector('.empty'));
 assert.equal(d.querySelector('#typeSelect').value,'mascara');assert.ok(d.querySelector('.empty'));
 const remove=[...d.querySelectorAll('.discovery-active a')].find(a=>a.textContent.includes('المسكارا'));assert.ok(remove);remove.click();
 await until(()=>d.querySelectorAll('.product-card').length>0);const q=new URLSearchParams(w.location.hash.split('?')[1]);assert.equal(q.get('need'),'cleansing');assert.equal(q.has('type'),false);
});
