import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {quoteCart,shippingFee,deliveryNudge,recommendations,retailPrice,largeImageFor,money} from '../public/commerce.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const product=(id,price,name='Product',category='المكياج')=>({id,price_fils:price,reference_price_fils:price,name,category,stock:24,approved:1,active:1});
test('Nationwide delivery is 1 JOD, free strictly above 19 after offers, and the 15 JOD nudge includes delivery',()=>{
 assert.equal(shippingFee(19000),1000);assert.equal(shippingFee(19010),0);
 const p=product('TS0001',14000);assert.equal(deliveryNudge(quoteCart([{id:p.id,qty:1}],[p])),null);
 const q=quoteCart([{id:p.id,qty:1}],[{...p,price_fils:14010}]);assert.equal(q.totalFils,15010);assert.equal(deliveryNudge(q).remainingFils,5000);
 const free=quoteCart([{id:p.id,qty:1}],[{...p,price_fils:19990}]);assert.equal(deliveryNudge(free),null);
});
test('The best combo applies automatically without stacking or spending the same units twice',()=>{
 const products=[product('TS0001',3000),product('TS0002',2000)],cart=[{id:'TS0001',qty:2},{id:'TS0002',qty:2}];
 const items=[{id:'TS0001',qty:1},{id:'TS0002',qty:1}],offers=[{id:'PROMOA',title:'First',items,priceFils:4490,active:true},{id:'PROMOB',title:'Better',items,priceFils:3990,active:true}];
 const q=quoteCart(cart,products,offers);assert.equal(q.itemsSubtotalFils,10000);assert.equal(q.discountFils,2020);assert.equal(q.subtotalFils,7980);assert.equal(q.shippingFeeFils,1000);assert.equal(q.totalFils,8980);assert.equal(q.promotions.length,1);assert.equal(q.promotions[0].id,'PROMOB');assert.equal(q.promotions[0].count,2);
 assert.equal(quoteCart(cart,products,offers.map(p=>({...p,active:false}))).discountFils,0);
});
test('Combo savings can change delivery eligibility; the threshold always uses the final merchandise total',()=>{
 const products=[product('TS0001',10000),product('TS0002',10000)],cart=products.map(p=>({id:p.id,qty:1}));
 const q=quoteCart(cart,products,[{id:'PROMOA',items:cart,priceFils:18990,active:true}]);assert.equal(q.shippingFeeFils,1000);assert.equal(q.totalFils,19990);assert.ok(deliveryNudge(q));
});
test('Foundation recommendations prioritize mascara and powder, exclude cart items and unavailable stock',()=>{
 const ps=[product('TSBASE',5000,'كريم الأساس'),product('TSMASC',2000,'ماسكارا'),product('TSPOWD',3000,'بودرة'),product('TSHAIR',1000,'شامبو','الشعر'),{...product('TSZERO',1000,'مسكارا'),stock:0}];
 const result=recommendations(ps,[{id:'TSBASE',qty:1}],{anchorId:'TSBASE'});assert.equal(result[0].product.id,'TSMASC');assert.equal(result[1].product.id,'TSPOWD');assert.ok(result.every(x=>!['TSBASE','TSZERO'].includes(x.product.id)));
});
test('Suggested free delivery is computed with the same quote, rather than merely comparing product prices',()=>{
 const ps=[product('TSCART',17000,'كريم الأساس'),product('TSMASC',2490,'ماسكارا'),product('TSPOWD',1000,'بودرة')];
 const rows=recommendations(ps,[{id:'TSCART',qty:1}],{deliveryGoal:true});assert.equal(rows.find(x=>x.product.id==='TSMASC').unlocksFreeDelivery,true);assert.equal(rows.find(x=>x.product.id==='TSPOWD').unlocksFreeDelivery,false);
});
test('Retail price endings are clear, within bounds, and invoices use two decimal places',()=>{
 assert.equal(retailPrice(13785),13990);assert.equal(retailPrice(1475),1490);assert.equal(retailPrice(2490),2490);assert.equal(money(1490),'1.49 د.أ');
 const catalog=JSON.parse(read('public/catalog.json'));for(const p of catalog){assert.ok(p.priceFils>=500&&p.priceFils<=20000);assert.equal(p.priceFils%10,0);assert.ok([0,490,500,750,990].includes(p.priceFils%1000))}
});
test('High-resolution photos never replace an admin image with an unrelated old primary',()=>{
 const p={id:'TS0001',image_url:'/images/original.jpg'},map={TS0001:{primary:p.image_url,highResolution:'/images/high.webp'}};
 assert.equal(largeImageFor(p,p.image_url,map),'/images/high.webp');assert.equal(largeImageFor({...p,image_url:'/media/new.jpg'},'/media/new.jpg',map),'/media/new.jpg');assert.equal(largeImageFor(p,'/images/other.jpg',map),'/images/other.jpg');
});
test('Retail repricing is idempotent and preserves sold units and historical prices',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));db.exec(read('db/seed.sql'));db.exec(read('db/migrations/0005_launch_sale.sql'));
 db.exec("INSERT INTO orders(id,idempotency_key,name,phone,governorate,address,payment_method,subtotal_fils,shipping_fee_fils) VALUES('TR-OLD','key-old','Test','0790000000','عمّان','العبدلي','cod',1475,0);INSERT INTO order_items(order_id,product_id,name_snapshot,qty,unit_price_fils) VALUES('TR-OLD','TS0001','Old',1,1475)");
 db.exec(read('db/migrations/0007_retail_prices.sql'));db.exec(read('db/migrations/0007_retail_prices.sql'));
 assert.equal(db.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,23);assert.equal(db.prepare('SELECT unit_price_fils FROM order_items').get().unit_price_fils,1475);assert.equal(db.prepare('SELECT subtotal_fils FROM orders').get().subtotal_fils,1475);assert.equal(db.prepare('SELECT shipping_fee_fils FROM orders').get().shipping_fee_fils,0);assert.equal(db.prepare("SELECT price_fils FROM products WHERE id='TS0001'").get().price_fils,1490);
});

test('Best offer includes delivery and never makes the customer pay more than the regular cart',()=>{
 const p=product('TS0001',19490),cart=[{id:p.id,qty:1}];
 assert.equal(quoteCart(cart,[p],[{id:'PROMOBAD',items:cart,priceFils:18990,active:true}]).discountFils,0);
 const ps=[product('TS0001',10000),product('TS0002',10000)],items=ps.map(p=>({id:p.id,qty:1}));
 const q=quoteCart(items,ps,[{id:'PROMOMORE',items,priceFils:18990,active:true},{id:'PROMOBEST',items,priceFils:19010,active:true}]);assert.equal(q.promotions[0].id,'PROMOBEST');assert.equal(q.totalFils,19010);assert.equal(q.shippingFeeFils,0);
});
