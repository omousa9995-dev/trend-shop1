import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),data=p=>JSON.parse(read(p));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5))}assert.ok(fn(),'expected storefront state')}
async function open(t){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(read('public/index.html'),{url:'https://trend.test/#/shop',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;t.after(()=>w.close());
 let y=0;Object.defineProperty(w,'scrollY',{get:()=>y});w.scrollTo=(a,b)=>{y=typeof a==='object'?a.top:b};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 const products=data('public/catalog.json');w.fetch=async u=>{const path=String(u).split('?')[0];return {ok:true,json:async()=>path==='/api/catalog'?{products,promotions:[],storeLive:false}:path==='/product-galleries.json'?data('public/product-galleries.json'):path==='/catalog-thumbnails.json'?data('public/catalog-thumbnails.json'):path.startsWith('/product-stories/')?data('public'+path):{}}};
 w.eval(storefrontBundle);await until(()=>d.querySelectorAll('#productResults .product-card').length===24);await new Promise(r=>w.requestAnimationFrame(r));assert.deepEqual(errors,[]);return {w,d,errors,setY:value=>{y=value;w.dispatchEvent(new w.Event('scroll'))},getY:()=>y};
}
test('Opening a product after repeated More clicks and browser Back restores loaded products and the exact browsing position',async t=>{
 const {w,d,errors,setY,getY}=await open(t);d.querySelector('#loadMore').click();d.querySelector('#loadMore').click();assert.equal(d.querySelectorAll('#productResults .product-card').length,72);setY(6875);
 const link=[...d.querySelectorAll('#productResults a[href^="#/product/"]')].at(-1);link.click();await until(()=>d.querySelector('#storyTitle'));assert.equal(getY(),0);assert.equal(d.querySelector('[data-browse-back]').getAttribute('href'),'#/shop');
 w.history.back();await until(()=>w.location.hash==='#/shop'&&d.querySelectorAll('#productResults .product-card').length===72);await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),6875);d.querySelector('#loadMore').click();assert.equal(d.querySelectorAll('#productResults .product-card').length,96);assert.deepEqual(errors,[]);
});
test('The return link preserves filters, search and sort; a different filter starts its own first page',async t=>{
 const {w,d,setY,getY}=await open(t);w.location.hash='#/shop?sort=price-asc';await until(()=>d.querySelector('#sortSelect')?.value==='price-asc');d.querySelector('#loadMore').click();setY(3520);d.querySelector('#productResults a[href^="#/product/"]').click();await until(()=>d.querySelector('#storyTitle'));d.querySelector('[data-browse-back]').click();await until(()=>w.location.hash==='#/shop?sort=price-asc'&&d.querySelectorAll('#productResults .product-card').length===48);await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),3520);assert.equal(d.querySelector('#sortSelect').value,'price-asc');
 const sort=d.querySelector('#sortSelect');sort.value='price-desc';sort.dispatchEvent(new w.Event('change'));await until(()=>w.location.hash==='#/shop?sort=price-desc'&&d.querySelectorAll('#productResults .product-card').length===24);assert.equal(getY(),0);
});
