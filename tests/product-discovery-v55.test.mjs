import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {productCardSummary,discoveryHref} from '../public/product-discovery.js';
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

test('Product card summaries retain their saved localized benefit after care navigation is removed',()=>{
 for(const p of products)for(const lang of ['ar','en']){const summary=productCardSummary(p,lang);assert.equal(typeof summary,'string');assert.ok(summary.length<=100)}
 const p={name:'Example',details:{productType:'serum',benefits:['ميزة محفوظة'],en:{benefits:['Saved English benefit']}}};
 assert.equal(productCardSummary(p,'ar'),'ميزة محفوظة');assert.equal(productCardSummary(p,'en'),'Saved English benefit');
});

test('Catalog links discard legacy need parameters while retaining brand, search, price and sorting',()=>{
 const q=new URLSearchParams({collection:'korean-care',brand:'COSRX',q:'تونر',max:'15000',sort:'price-asc',need:'hydration'});
 const next=new URLSearchParams(discoveryHref(q,{type:'toner'}).split('?')[1]);
 for(const [key,value] of q)if(key!=='need')assert.equal(next.get(key),value);
 assert.equal(next.has('need'),false);assert.equal(next.get('type'),'toner');assert.equal(q.get('need'),'hydration');
});

test('Home removes all care-need controls while retaining brands, practical cards and the new landscape image',async t=>{
 const {d}=await open(t);assert.equal(d.querySelector('.need-discovery,.need-tile,.discovery-pills,#needSelect'),null);
 assert.doesNotMatch(d.querySelector('#app').textContent,/تسوّقي حسب احتياجكِ|احتياج العناية|Shop by care need/);
 assert.ok(d.querySelectorAll('.brand-tile').length>3);assert.ok(d.querySelector('.product-purpose'));assert.ok(d.querySelector('.product-saving'));
 const image=d.querySelector('.category-korean img');assert.match(image.src,/korean-care-woman-v551\.webp/);assert.equal(Number(image.getAttribute('width'))/Number(image.getAttribute('height')),1.5);
 const settings=structuredClone(DEFAULT_SITE_SETTINGS);for(const section of settings.homeSections)if(['categories','korean'].includes(section.id))section.enabled=false;
 const hidden=await open(t,'#/',settings);assert.equal(hidden.d.querySelector('.category-korean').closest('section').hidden,true);assert.equal(hidden.d.querySelector('.brand-discovery').closest('section').hidden,true);
});

test('Old need bookmarks open the complete selected brand and normalize the URL without losing other filters',async t=>{
 const old=await open(t,'#/shop?collection=korean-care&need=cleansing&brand=Arencia&sort=price-asc');
 const normal=await open(t,'#/shop?collection=korean-care&brand=Arencia&sort=price-asc');
 const ids=d=>[...d.querySelectorAll('.product-name')].map(a=>a.getAttribute('href'));
 assert.deepEqual(ids(old.d),ids(normal.d));const q=new URLSearchParams(old.w.location.hash.split('?')[1]);assert.equal(q.has('need'),false);assert.equal(q.get('brand'),'Arencia');assert.equal(q.get('sort'),'price-asc');
 assert.equal(old.d.querySelector('#needSelect,.discovery-pills'),null);assert.doesNotMatch(old.d.querySelector('#app').textContent,/تسوّقي حسب احتياجكِ/);
});

test('Brand tiles keep Korean care and sorting, and the existing type filter still preserves the bag',async t=>{
 const {w,d}=await open(t,'#/shop?collection=korean-care&sort=price-asc');
 const tile=[...d.querySelectorAll('.brand-tile')].find(a=>a.textContent.trim()==='Arencia');assert.ok(tile);tile.click();await until(()=>d.querySelector('#brandSelect')?.value==='Arencia');
 const q=new URLSearchParams(w.location.hash.split('?')[1]);assert.equal(q.get('collection'),'korean-care');assert.equal(q.get('sort'),'price-asc');
 d.querySelector('.product-card [data-add]').click();assert.equal(d.querySelector('#cartCount').textContent,'1');
 d.querySelector('#typeSelect').value='cleanser';d.querySelector('#typeSelect').dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>w.location.hash.includes('type=cleanser'));
 assert.equal(JSON.parse(w.localStorage.getItem('trend-shop-cart-v1')).length,1);assert.equal(d.querySelector('#cartCount').textContent,'1');
 for(const link of d.querySelectorAll('.type-pills a')){const params=new URLSearchParams(link.getAttribute('href').split('?')[1]);assert.equal(params.get('brand'),'Arencia');assert.equal(params.get('collection'),'korean-care')}
});
