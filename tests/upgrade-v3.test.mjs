import {assertCatalogResults} from './helpers/catalog-results.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';
import {validateCheckout,canonicalGovernorate} from '../public/checkout-rules.js';
import {normalizeContactPhone} from '../public/contact-phone.js';
import {requestWithDeadline,readPendingCheckout,savePendingCheckout,newCheckoutKey} from '../public/checkout-request.js';
import {whatsappCheckoutUrl} from '../public/whatsapp-checkout.js';
import {productType} from '../public/product-types.js';
import {curatedProducts} from '../public/merchandising.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),catalog=JSON.parse(read('public/catalog.json'));
const pause=()=>new Promise(resolve=>setTimeout(resolve,5));
async function open(t,{path='/?lang=en#/shop',cart=[],live=false,onOrder,onStatus}={}){
 const dom=new JSDOM(read('public/index.html'),{url:'https://trend.test'+path,runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.localStorage.setItem('trend-shop-cart-v1',JSON.stringify(cart));
 w.fetch=async(url,options={})=>{if(String(url).startsWith('/api/catalog'))return Response.json({products:catalog,promotions:[],storeLive:live});if(String(url).startsWith('/api/reviews'))return Response.json({reviews:[],summary:{count:0,average:null}});if(url==='/api/orders')return onOrder?onOrder(options):Response.json({orderId:'TR-TEST-SAFE',received:true,paymentMethod:'cod',shippingFeeFils:1000,totalFils:11000});if(url==='/api/order-status')return onStatus?onStatus(options):Response.json({received:false});try{return Response.json(JSON.parse(read('public'+String(url).split('?')[0])))}catch{return Response.json({}, {status:404})}};
 w.eval(storefrontBundle);for(let n=0;n<100&&!(d.querySelector('.product-card')||d.querySelector('#checkoutForm')||d.querySelector('.detail-content')||d.querySelector('.product-story'));n++)await pause();await pause();return {w,d};
}
test('Shared checkout accepts two-letter names, one-word areas, optional email and pasted Arabic/English phones',()=>{
 for(const name of ['مي','طه','Li','سارة أحمد'])for(const phone of ['0791234567','٠٧٩١٢٣٤٥٦٧','۰۷۹۱۲۳۴۵۶۷','079\u200b1234567','＋٩٦٢ (٠) ٧٩١٢٣٤٥٦٧','079–123–4567','+966501234567']){
  const r=validateCheckout({name,phone,governorate:'Amman',address:'العبدلي',email:'',payment:'cod',locale:'en'},normalizeContactPhone);assert.equal(r.valid,true,JSON.stringify({name,phone,fields:r.fields}));assert.equal(r.values.governorate,'عمّان');assert.equal(r.values.locale,'en');
 }
 assert.equal(canonicalGovernorate('عمان'),'عمّان');assert.equal(canonicalGovernorate('Irbid'),'إربد');
 const r=validateCheckout({name:'م',phone:'123',governorate:'Unknown',address:'…',email:'bad',payment:'cliq'},normalizeContactPhone);assert.deepEqual(Object.keys(r.fields).sort(),['address','cliqAlias','email','governorate','name','phone']);
});
test('Request deadlines abort and release the button path without creating new order identifiers',async()=>{
 let fired,cleared=false,signal;const clock={setTimeout:fn=>(fired=fn,1),clearTimeout:()=>cleared=true};const request=requestWithDeadline((_,options)=>{signal=options.signal;return new Promise(()=>{})},'/test',{},100,clock);fired();await assert.rejects(request,{code:'REQUEST_TIMEOUT'});assert.equal(signal.aborted,true);assert.equal(cleared,true);
 const data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k),removeItem:k=>data.delete(k)},key=newCheckoutKey();savePendingCheckout(storage,{key,at:100,name:'private',phone:'private'});assert.deepEqual(readPendingCheckout(storage,101),{key,at:100});assert.doesNotMatch([...data.values()][0],/name|phone|private/);assert.equal(readPendingCheckout(storage,86400101),null);
});
test('Every WhatsApp bag line includes its own share URL, option and quantity in one localized message',()=>{
 const lines=['TS0079','TS0347','TS0309'].map((id,i)=>({product:catalog.find(p=>p.id===id),qty:i+1,variantLabel:i===1?'2 — Light medium':''}));
 for(const locale of ['ar','en']){const url=new URL(whatsappCheckoutUrl({lines,locale,quote:{itemsSubtotalFils:25000,subtotalFils:25000,shippingFeeFils:0,totalFils:25000,discountFils:0}}));const text=url.searchParams.get('text');for(const x of lines)assert.match(text,new RegExp('/p/'+x.product.id));assert.match(text,/Light medium/);assert.match(text,locale==='en'?/Free|JOD/:/مجاني|د.أ/)}
});
test('All product families have bilingual content, preserved prices and stock, corrected Snail semantics and curated defaults',()=>{
 for(const p of catalog){assert.ok(p.details.en?.name&&p.details.en?.description&&p.details.en?.howToUse&&p.details.en?.notes,p.id);assert.doesNotMatch(p.details.en.name,/[\u0600-\u06ff]/,p.id);assert.equal(p.stock,24);assert.ok(p.priceFils>=500&&p.priceFils<=20000)}
 for(const [id,type]of [['TS0079','essence'],['TS0080','moisturizer'],['TS0038','eye-care'],['TS0106','skincare-set'],['TS0150','primer'],['TS0119','lips']])assert.equal(productType(catalog.find(p=>p.id===id)),type);
 assert.equal(curatedProducts(catalog)[0].id,'TS0079');assert.ok(curatedProducts(catalog).findIndex(p=>p.id==='TS0001')>20);
});
test('English browsing, product details, variants and language changes preserve the bag and checkout draft',async t=>{
 const {w,d}=await open(t,{path:'/?lang=en#/product/TS0347'});assert.equal(d.documentElement.lang,'en');assert.equal(d.documentElement.dir,'ltr');assert.match(d.querySelector('.detail-content h1').textContent,/SHEGLAM/);assert.match(d.querySelector('.story-lead').textContent,/everyday/);assert.equal(d.querySelector('link[rel="canonical"]').href,'https://trendjo.pages.dev/p/TS0347?lang=en');assert.match(d.querySelector('.variant-options').textContent,/Light medium/);
 const tone=d.querySelector('[data-select-option][value="tone-2"]');tone.checked=true;tone.dispatchEvent(new w.Event('change',{bubbles:true}));d.querySelector('[data-add="TS0347"]').click();w.location.hash='#/checkout';await pause();await pause();d.querySelector('#customerName').value='مي';d.querySelector('#customerName').dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('#address').value='Abdali';d.querySelector('#address').dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('#languageToggle').click();await pause();assert.equal(d.documentElement.lang,'ar');assert.equal(d.querySelector('#customerName').value,'مي');assert.equal(d.querySelector('#address').value,'Abdali');assert.equal(d.querySelector('#cartCount').textContent,'1');d.querySelector('#languageToggle').click();await pause();assert.equal(d.querySelector('#customerName').value,'مي');assert.equal(d.querySelector('#customerPhone').placeholder,'0791234567');
});
test('Clearing selected filters removes every query and closes the filter panel',async t=>{
 const {w,d}=await open(t,{path:'/#/shop?type=mascara&brand=essence'});d.querySelector('#mobileFilters').click();assert.equal(d.querySelector('#filters').hidden,false);d.querySelector('#filterReset').click();await pause();assert.equal(d.querySelector('#filters').hidden,true);assert.equal(d.querySelector('#mobileFilters').getAttribute('aria-expanded'),'false');assert.equal(w.location.hash,'#/shop');assertCatalogResults(d,catalog.length);
});
test('Normal checkout remains first, WhatsApp is last, invalid fields are named and valid fields are retained',async t=>{
 const {w,d}=await open(t,{path:'/?lang=en#/checkout',cart:[{id:'TS0079',qty:1}],live:true});const form=d.querySelector('#checkoutForm');assert.equal(form.noValidate,true);assert.equal(form.elements.website,undefined);assert.equal(d.querySelectorAll('#checkoutSummary [data-whatsapp-cart]').length,0);assert.equal(d.querySelector('.checkout-grid').lastElementChild.id,'checkoutWhatsApp');assert.equal(d.querySelector('#checkoutWhatsApp [data-whatsapp-cart]')!==null,true);
 form.elements.name.value='مي';form.elements.phone.value='123';form.elements.governorate.value='عمّان';form.elements.address.value='Abdali';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();await pause();assert.equal(d.activeElement.id,'customerPhone');assert.match(d.querySelector('#error-phone').textContent,/country code/);assert.equal(form.elements.address.value,'Abdali');assert.equal(form.elements.name.value,'مي');assert.equal(d.querySelector('#confirmButton').disabled,false);
});
test('Review invitation is honest when empty and generated scenes are labelled promotional with packshot first',async t=>{
 const {d}=await open(t,{path:'/?lang=en#/product/TS0079'});assert.equal(d.querySelector('#productReviews').hidden,true);assert.equal(d.querySelector('.review-entry'),null);assert.equal(d.querySelectorAll('.review-stars').length,0);assert.match(d.querySelector('#storyMainImage').src,/TS0079-[a-f0-9]{12}/);const thumbs=d.querySelectorAll('[data-story-photo]');assert.ok(thumbs.length>1);thumbs[1].click();await pause();assert.match(d.querySelector('#storyImageCaption').textContent,/Promotional scene/);assert.equal(d.querySelector('video'),null);assert.equal(d.querySelector('[data-product-videos]').hidden,false);
});
function fillOrder(d){const form=d.querySelector('#checkoutForm');form.elements.name.value='مي';form.elements.phone.value='٠٧٩١٢٣٤٥٦٧';form.elements.governorate.value='عمّان';form.elements.address.value='العبدلي';return form}
test('An uncertain connection keeps the same key on manual retry, retains fields and never automatically resubmits',async t=>{
 const calls=[];const {w,d}=await open(t,{path:'/?lang=en#/checkout',cart:[{id:'TS0079',qty:1}],live:true,onOrder:options=>{calls.push(options);return calls.length===1?Promise.reject(Error('connection lost')):Response.json({orderId:'TR-RETRY-SAFE',received:true,paymentMethod:'cod',shippingFeeFils:1000,totalFils:8000})}});let form=fillOrder(d);form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(d.querySelector('#confirmButton').disabled,true);for(let n=0;n<40&&d.querySelector('#confirmButton')?.disabled;n++)await pause();assert.equal(calls.length,1);assert.equal(form.elements.name.value,'مي');assert.equal(form.elements.address.value,'العبدلي');assert.match(d.querySelector('#checkoutError').textContent,/preserved/);assert.equal(JSON.parse(w.localStorage.getItem('trend-shop-cart-v1')).length,1);assert.doesNotMatch(w.sessionStorage.getItem('trend-shop-pending-checkout-v3'),/مي|العبدلي|791234567/);form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));for(let n=0;n<40&&!d.querySelector('.success-panel');n++)await pause();assert.equal(calls.length,2);assert.equal(calls[0].headers['x-idempotency-key'],calls[1].headers['x-idempotency-key']);assert.match(d.querySelector('.success-panel').textContent,/TR-RETRY-SAFE/);assert.equal(w.sessionStorage.getItem('trend-shop-pending-checkout-v3'),null);
});
test('A saved order recovered after a lost response shows its real receipt without submitting again',async t=>{
 let posts=0,statusCalls=0;const {w,d}=await open(t,{path:'/?lang=en#/checkout',cart:[{id:'TS0079',qty:1}],live:true,onOrder:()=>{posts++;throw Error('lost response')},onStatus:()=>{statusCalls++;return Response.json({received:true,orderId:'TR-ALREADY-RECEIVED',paymentMethod:'cod',shippingFeeFils:1000,totalFils:8000})}});fillOrder(d).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));for(let n=0;n<40&&!d.querySelector('.success-panel');n++)await pause();assert.equal(posts,1);assert.equal(statusCalls,1);assert.match(d.querySelector('.success-panel').textContent,/TR-ALREADY-RECEIVED/);assert.match(d.querySelector('.success-panel').textContent,/8.00 JOD/);assert.doesNotMatch(d.querySelector('.success-panel').textContent,/[\u0600-\u06ff]/);
});
test('English checkout has complete visible translations, including the free-delivery incentive',async t=>{
 const {d}=await open(t,{path:'/?lang=en#/checkout',cart:[{id:'TS0079',qty:2},{id:'TS0035',qty:1}],live:true});await pause();assert.match(d.querySelector('.delivery-goal').textContent,/free delivery|Free delivery/);assert.doesNotMatch(d.querySelector('#app').textContent,/[\u0600-\u06ff]/);
});
