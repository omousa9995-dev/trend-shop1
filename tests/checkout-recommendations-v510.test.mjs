import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkoutRecommendations} from '../public/checkout-recommendations.js';
import {productType} from '../public/product-types.js';
const products=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url)));
const promotions=JSON.parse(fs.readFileSync(new URL('../public/campaign-offers.json',import.meta.url)));
const bag=(...ids)=>ids.map(id=>({id,qty:1}));
const rows=groups=>groups.flatMap(g=>g.items);
const ids=groups=>rows(groups).map(r=>r.product.id);

test('Foundation receives complementary base steps, mascara and colour without another foundation or unrelated skincare',()=>{
 const groups=checkoutRecommendations(products,bag('TS0347')),types=rows(groups).map(x=>x.type);
 assert.ok(types.includes('powder'));assert.ok(types.includes('concealer'));assert.ok(types.includes('mascara'));
 assert.ok(groups.every(g=>g.family==='makeup'));assert.ok(!types.includes('foundation'));assert.ok(!types.includes('bb-cc'));assert.ok(!ids(groups).includes('TS0347'));assert.equal(new Set(ids(groups)).size,ids(groups).length);
});

test('The whole bag informs mixed-family suggestions independently of line order, quantities and repeated tone lines',()=>{
 const cart=bag('TS0347','TS0079','TS0243'),groups=checkoutRecommendations(products,cart);
 assert.deepEqual(new Set(groups.map(g=>g.family)),new Set(['makeup','skin','hair']));
 assert.deepEqual(ids(groups),ids(checkoutRecommendations(products,[...cart].reverse().map(x=>({...x,qty:5})))));
 assert.deepEqual(ids(checkoutRecommendations(products,bag('TS0347'))),ids(checkoutRecommendations(products,[{id:'TS0347',qty:1,variant:'tone-1'},{id:'TS0347',qty:3,variant:'tone-4'}])));
});

test('Existing care steps are excluded and a skincare set receives a daytime complement',()=>{
 const groups=checkoutRecommendations(products,bag('TS0079','TS0080','TS0075')),ownedTypes=new Set(['essence','moisturizer',productType(products.find(p=>p.id==='TS0075'))]);
 assert.ok(rows(groups).every(x=>!ownedTypes.has(x.type)));assert.ok(rows(groups).every(x=>['cleanser','sunscreen'].includes(x.type)));
 const kit=checkoutRecommendations(products,bag('TS0106'));assert.ok(rows(kit).length);assert.ok(rows(kit).every(x=>x.type==='sunscreen'));
});

test('Bundle components count as owned products and steps; unavailable bundles do not generate unrelated suggestions',()=>{
 const offer=promotions.find(p=>p.id==='PROMONOV3-MAYBELLINE');assert.ok(offer);
 const groups=checkoutRecommendations(products,[{id:offer.id,qty:1}],{promotions}),owned=new Set(offer.items.map(x=>x.id)),ownedTypes=new Set(offer.items.map(x=>productType(products.find(p=>p.id===x.id))));
 assert.ok(rows(groups).length);assert.ok(rows(groups).every(x=>!owned.has(x.product.id)&&!ownedTypes.has(x.type)));
 assert.deepEqual(checkoutRecommendations(products,[{id:offer.id,qty:1}],{promotions:[]}),[]);
});

test('Stock, approval, retirement, existing items and specialised treatments filter candidates before ranking',()=>{
 const base={...products.find(p=>productType(p)==='moisturizer'),brand:'COSRX',stock:4,approved:true,active:true};
 const candidates=[{...base,id:'TS9001',name:'Basic moisturiser',details:{productType:'moisturizer'}},{...base,id:'TS9002',stock:0},{...base,id:'TS9003',approved:false},{...base,id:'TS9004',active:0},{...base,id:'TS9005',name:'Retinol cream',details:{productType:'moisturizer'}},{...base,id:'TS9006',name:'Whitening cream',details:{productType:'moisturizer'}},{...base,id:'TS9007',priceFils:0},{...base,id:'TS0232'}];
 const groups=checkoutRecommendations([products.find(p=>p.id==='TS0079'),...candidates],bag('TS0079'));
 assert.deepEqual(ids(groups),['TS9001']);
});

test('A shampoo receives different haircare steps with no makeup and no duplicate shampoo',()=>{
 const groups=checkoutRecommendations(products,bag('TS0243')),types=rows(groups).map(x=>x.type);
 assert.ok(types.includes('conditioner'));assert.ok(types.includes('hair-mask'));assert.ok(types.includes('hair-oil'));assert.ok(groups.every(g=>g.family==='hair'));assert.ok(!types.includes('shampoo'));
});

test('An empty bag has bounded starter choices; a fully covered or unsupported selection has an honest empty result',()=>{
 const groups=checkoutRecommendations(products,[]);assert.ok(groups.length>0&&groups.length<=4);assert.ok(groups.every(g=>g.items.length<=3));
 assert.deepEqual(checkoutRecommendations(products,bag('TS0346')),[]);
 assert.deepEqual(checkoutRecommendations(products,bag('TS0079','TS0080','TS0098','TS0076')),[]);
});
