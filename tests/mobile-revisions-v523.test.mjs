import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {BUYING_GUIDES} from '../public/buying-guides.js';
import {globalRatingHtml} from '../public/global-product-ratings.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const data=p=>JSON.parse(read(p));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5))}assert.ok(fn(),'expected storefront state');}
async function open(t,path='/product/TS0065',{resizeEvents=false}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(read('public/index.html'),{url:'https://trendjo.pages.dev'+path,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;t.after(()=>w.close());
 let y=0,scrolled='',queued=[];Object.defineProperty(w,'scrollY',{get:()=>y});w.scrollTo=(a,b)=>{y=typeof a==='object'?a.top:b};w.HTMLElement.prototype.scrollIntoView=function(){scrolled=this.id};
 const resizeCallbacks=new Set();if(resizeEvents)w.ResizeObserver=class{constructor(callback){this.callback=callback}observe(){resizeCallbacks.add(this.callback)}disconnect(){resizeCallbacks.delete(this.callback)}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const schedule=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>ms>=2500?(queued.push(()=>fn(...args)),100000+queued.length):schedule(fn,ms,...args);
 const products=data('public/catalog.json').map(p=>p.id==='TS0065'?{...p,priceFils:8990,price_fils:8990}:p);
 w.fetch=async url=>{const path=String(url).split('?')[0];if(path==='/api/orders')throw Error('Production orders forbidden in DOM tests');if(path==='/api/catalog')return Response.json({products,promotions:data('public/campaign-offers.json'),storeLive:false});if(path.startsWith('/api/'))return Response.json({reviews:[],summary:{count:0,average:null},videos:[]});const file=new URL('../public'+path,import.meta.url);return existsSync(file)?Response.json(JSON.parse(readFileSync(file,'utf8'))):Response.json({});};
 w.eval(storefrontBundle);await until(()=>d.querySelector('.product-story,.buying-guide,#app>.hero'));await new Promise(r=>w.requestAnimationFrame(r));assert.deepEqual(errors,[]);
 return{w,d,errors,cart:()=>JSON.parse(w.localStorage.getItem('trend-shop-cart-v1')),setY:n=>{y=n;w.dispatchEvent(new w.Event('scroll'));},getY:()=>y,scrolled:()=>scrolled,resize:()=>{for(const callback of [...resizeCallbacks])callback();},drain:()=>{const timers=queued;queued=[];timers.forEach(fn=>fn());}};
}
test('Product additions require an explicit click, remain on the product, and review never silently adds a pending quantity',async t=>{
 const {w,d,cart,drain}=await open(t),review=d.querySelector('[data-story-checkout]');
 assert.equal(review.disabled,true);review.click();assert.equal(cart().length,0);assert.equal(d.querySelector('.quick-checkout').open,false);
 const add=d.querySelector('#storyPurchase [data-story-add]');assert.ok(add.compareDocumentPosition(review)&4);
 add.click();assert.equal(cart()[0].qty,1);assert.equal(w.location.pathname,'/product/TS0065');assert.equal(review.disabled,false);assert.equal(d.querySelector('.quick-checkout').open,false);drain();
 assert.equal(d.querySelector('#cartAssist').hidden,true);assert.equal(d.querySelector('#checkoutSuggestions').open,false);
 d.querySelector('[data-story-step="1"]').click();assert.equal(review.disabled,true);review.click();assert.equal(cart()[0].qty,1);assert.equal(d.querySelector('.quick-checkout').open,false);
 add.click();assert.equal(cart()[0].qty,2);assert.equal(review.disabled,false);review.click();assert.equal(d.querySelector('.quick-checkout').open,true);assert.equal(cart()[0].qty,2);
 d.querySelector('[data-close-quick]').click();review.click();assert.equal(cart()[0].qty,2);
});
test('Delivery totals appear in the bag and checkout, product prices exclude delivery, and payment is one combined information block',async t=>{
 const {d,cart}=await open(t);assert.equal(d.querySelector('.story-delivery-price,.story-delivered-price'),null);assert.match(d.querySelector('#storyStickyPrice').textContent,/8.99/);assert.doesNotMatch(d.querySelector('#storySelectionPrice').textContent,/9.99|التوصيل/);
 d.querySelector('[data-story-primary]').click();assert.equal(cart()[0].qty,1);assert.equal(d.querySelector('.quick-checkout').open,false);d.querySelector('[data-story-primary]').click();
 assert.equal(d.querySelector('.quick-checkout').open,true);assert.match(d.querySelector('#checkoutSummary .total').textContent,/9.99/);assert.match(d.querySelector('#checkoutSummary .cart-delivery-policy').textContent,/فوق 19/);
 assert.equal(d.querySelectorAll('[name=payment]').length,1);assert.equal(d.querySelector('[name=payment]').type,'hidden');assert.equal(d.querySelector('[name=payment]').value,'cod');assert.match(d.querySelector('.payment-summary').textContent,/الدفع عند الاستلام.*CliQ/);assert.equal(d.querySelector('#cliqFields'),null);
});
test('Changing a shade after adding preserves existing selections and requires adding the new choice before review',async t=>{
 const {w,d,cart}=await open(t,'/product/TS0347');const add=d.querySelector('#storyPurchase [data-story-add]'),review=d.querySelector('[data-story-checkout]');add.click();assert.equal(cart().length,0);
 const options=d.querySelectorAll('[data-select-option]');options[0].click();await Promise.resolve();add.click();assert.equal(cart().length,1);assert.equal(review.disabled,false);
 options[1].click();await new Promise(r=>w.queueMicrotask(r));assert.equal(review.disabled,true);review.click();assert.equal(cart().length,1);add.click();assert.equal(cart().length,2);assert.equal(review.disabled,false);
});
test('Every buying guide scrolls to its products without remounting or navigating away',async t=>{
 const {w,d,scrolled}=await open(t,'/');
 for(const guide of BUYING_GUIDES){d.querySelector('body>.buying-related a[href="'+guide.path+'"]').click();const article=d.querySelector('.buying-guide');assert.ok(article);assert.equal(w.location.pathname,guide.path);article.querySelector('a[href="#buyingProducts"]').click();assert.equal(d.querySelector('.buying-guide'),article);assert.equal(w.location.pathname,guide.path);assert.equal(scrolled(),'buyingProducts');}
});
test('Back from footer guides restores the home position, and product returns restore the guide position',async t=>{
 const {w,d,setY,getY}=await open(t,'/');setY(8470);d.querySelector('body>.buying-related a[href="/collections/korean-sunscreen"]').click();assert.equal(getY(),0);setY(1960);
 d.querySelector('#buyingProducts a[href^="/product/"]').click();await until(()=>d.querySelector('.product-story'));assert.equal(d.querySelector('[data-browse-back]').getAttribute('href'),'/collections/korean-sunscreen');
 w.history.back();await until(()=>d.querySelector('.buying-guide'));await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),1960);
 w.history.back();await until(()=>d.querySelector('#app>.hero'));await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),8470);
});
test('Product-type shortcuts finish the home content, and social links appear in the header and footer',async t=>{
 const {d}=await open(t,'/');const types=d.querySelector('.product-type-browse');assert.equal(types,d.querySelector('#app').lastElementChild);assert.equal(d.querySelector('.section-browse'),null);assert.ok(types.querySelector('a[href="#/shop?type=mascara"] svg'));assert.ok(types.querySelectorAll('svg').length>=8);
 const top=[...d.querySelectorAll('.header-socials a')],bottom=[...d.querySelectorAll('.footer .brand-socials a')];assert.equal(top.length,2);assert.deepEqual(top.map(a=>a.href),bottom.map(a=>a.href));for(const a of top){assert.ok(a.getAttribute('aria-label'));assert.match(a.rel,/noopener/);}
 const rating=globalRatingHtml({rating:4.9,count:100,publisher:'Beauty of Joseon Official',productName:'Relief Sun',url:'https://beautyofjoseon.com/products/relief-sun',checkedAt:new Date().toISOString()});assert.match(rating,/4.9/);assert.match(rating,/Beauty of Joseon Official/);assert.doesNotMatch(rating,/<a\b|href=/);
});

test('Back keeps the saved position when asynchronous content shrinks, and immediately yields to intentional scrolling',async t=>{
 const {w,d,setY,getY,resize}=await open(t,'/',{resizeEvents:true});setY(8470);d.querySelector('body>.buying-related a[href="/collections/toner"]').click();w.history.back();await until(()=>d.querySelector('#app>.hero'));await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),8470);
 setY(8202);resize();await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),8470);
 w.dispatchEvent(new w.WheelEvent('wheel',{deltaY:200}));setY(7900);resize();await new Promise(r=>w.requestAnimationFrame(r));assert.equal(getY(),7900);
});
