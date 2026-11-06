import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {mountProductStory,productStoryOffers} from '../public/product-story.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';

const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const catalog=read('public/catalog.json');
function page(t,{id='TS0098',language='ar',cap=10,replacement=false}={}){
 setLocale(language);
 const dom=new JSDOM('<main></main>',{url:'https://trend.test/',pretendToBeVisual:true});
 const w=dom.window;w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const root=w.document.querySelector('main'),product={...catalog.find(p=>p.id===id)};
 if(replacement)product.image='/media/owner-replacement.jpg';
 const selected=[];
 mountProductStory(root,{product,name:product.name,profile:read(`public/product-stories/${id}.json`),cap,live:true,promotions:productStoryOffers,onCheckout:q=>selected.push(q)});
 t.after(()=>{root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();dom.window.close();setLocale('ar');});
 return {root,selected,product};
}
test('Arencia gets the approved service promises, three coherent photos and the unchanged live quotation controls',t=>{
 const {root,selected}=page(t);
 assert.ok(root.querySelector('.arencia-pilot'));
 const service=root.querySelector('.arencia-service').textContent;
 assert.match(service,/24 ساعة/);assert.match(service,/لجميع مناطق المملكة/);assert.match(service,/تفقدي طلبكِ قبل الدفع/);assert.match(service,/أصلية 100%/);
 assert.equal(root.querySelectorAll('.touch-media-thumbs button').length,3);
 assert.equal(root.querySelector('#storyMainImage').getAttribute('src'),'/images/catalog/TS0098-ca6be2972b93.jpg');
 assert.equal(root.querySelectorAll('[name=storyOffer]').length,2);
 const fast=root.querySelector('.arencia-quick-order');fast.click();assert.deepEqual(selected,[1]);
 root.querySelector('[name=storyOffer][value="2"]').click();fast.click();assert.deepEqual(selected,[1,2]);
 assert.match(root.querySelector('#storyStickyPrice').textContent,/19.99/);
 assert.match(root.querySelector('#storySelectionPrice').textContent,/مجاني/);
 assert.match(root.querySelector('#storyFaq').textContent,/خلال 24 ساعة/);
 assert.equal(root.querySelectorAll('#storyHow .arencia-step-icon').length,3);
});
test('An owner replacement pack excludes the old Arencia campaign and texture photos',t=>{
 const {root}=page(t,{replacement:true});
 assert.equal(root.querySelectorAll('.touch-media-thumbs button').length,1);
 assert.equal(root.querySelector('#storyMainImage').getAttribute('src'),'/media/owner-replacement.jpg');
});
test('The early order button respects unavailable stock and English has the same service terms',t=>{
 const {root}=page(t,{language:'en',cap:0});
 assert.equal(root.querySelector('.arencia-quick-order').disabled,true);
 assert.match(root.querySelector('.arencia-service').textContent,/Within 24 hours/);
 assert.match(root.querySelector('.arencia-service').textContent,/Inspect before paying/);
 assert.match(root.querySelector('.arencia-service').textContent,/100% authentic/);
 assert.doesNotMatch(root.querySelector('.arencia-service').textContent,/[\u0600-\u06ff]/);
 assert.match(root.querySelector('#storyFaq').textContent,/inspect my order before paying/);
});
test('A different product retains its existing layout, photos and original service FAQ',t=>{
 const {root}=page(t,{id:'TS0091'});
 assert.equal(root.querySelector('.arencia-pilot'),null);
 assert.equal(root.querySelector('.arencia-service'),null);
 assert.equal(root.querySelector('.arencia-quick-order'),null);
 assert.equal(root.querySelectorAll('.touch-media-thumbs button').length,2);
 assert.doesNotMatch(root.querySelector('#storyFaq').textContent,/خلال 24 ساعة|أصلية 100%/);
});
