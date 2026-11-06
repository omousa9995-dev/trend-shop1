import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {mountProductStory,storyContent,productStoryOffers} from '../public/product-story.js';
import {mountArenciaServiceCard} from '../public/arencia-pilot.js';
import {setLocale} from '../public/i18n.js?v=5.1.0';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const catalog=read('public/catalog.json');
function page(t,{id='TS0098',language='ar'}={}){
 setLocale(language);const dom=new JSDOM('<main></main>',{url:'https://trend.test/',pretendToBeVisual:true});
 const w=dom.window;w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const root=w.document.querySelector('main'),product=catalog.find(p=>p.id===id),profile=read(`public/product-stories/${id}.json`);
 mountProductStory(root,{product,name:product.name,profile,cap:10,live:true,promotions:productStoryOffers});
 t.after(()=>{root.querySelector('[data-product-videos]')?.aquaFreshRail?.destroy();dom.window.close();setLocale('ar');});
 return {root,product,content:storyContent(product,profile)};
}
test('Arencia restores its previous copy, gallery, benefit order and FAQ with only the requested card added',t=>{
 const {root,product,content}=page(t);
 assert.equal(root.querySelector('.story-tagline').textContent,content.tagline);
 assert.equal(root.querySelector('.story-lead').textContent,content.description);
 assert.equal(root.querySelectorAll('.touch-media-thumbs button').length,2);
 assert.equal(root.querySelector('#storyMainImage').getAttribute('src'),product.image);
 assert.ok(root.querySelector('.story-quick-benefits').compareDocumentPosition(root.querySelector('.story-purchase'))&4);
 assert.equal(root.querySelector('.arencia-pilot,.arencia-quick-order,.arencia-hero-price,.arencia-step-icon,.arencia-full-intro'),null);
 assert.equal(root.querySelectorAll('#storyFaq details').length,4);
 assert.equal(root.querySelector('.story-purchase').previousElementSibling,root.querySelector('.arencia-service-card'));
 const rows=[...root.querySelectorAll('.arencia-service-row')];assert.equal(rows.length,3);
 assert.deepEqual(rows.map(row=>[row.querySelector('strong').textContent,row.querySelector('span').textContent]),[
  ['خلال 24 ساعة','لجميع مناطق المملكة'],['تفقدي طلبكِ قبل الدفع','عند الاستلام'],['منتجات أصلية 100%','تسوّقي بثقة']
 ]);
 mountArenciaServiceCard(root,{product});assert.equal(root.querySelectorAll('.arencia-service-card').length,1);
});
test('The card supports English while retaining the normal quantity quotation',t=>{
 const {root}=page(t,{language:'en'});
 assert.match(root.querySelector('.arencia-service-card').textContent,/Within 24 hours/);
 assert.match(root.querySelector('.arencia-service-card').textContent,/Inspect before paying/);
 assert.match(root.querySelector('.arencia-service-card').textContent,/100% authentic products/);
 root.querySelector('[name=storyOffer][value="2"]').click();assert.match(root.querySelector('#storyStickyPrice').textContent,/19.99/);
});
test('Other products do not receive the Arencia service-card addition',t=>{
 const {root}=page(t,{id:'TS0091'});assert.equal(root.querySelector('.arencia-service-card'),null);
 assert.equal(root.querySelectorAll('.touch-media-thumbs button').length,2);
});
