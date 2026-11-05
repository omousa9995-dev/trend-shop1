import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';
import {pairPriceFils,quantityPriceFils,withPairPricing} from '../public/pair-pricing.js';
import {quoteCart} from '../public/commerce.js';
import {bundleProduct,quotePurchase,purchaseSnapshot,expandPurchaseCart,purchaseCartError} from '../public/bundles.js';
import {orderDisplayItems,orderLineTotal} from '../public/order-presentation.js';
import {invoice} from '../public/invoice.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const products=[
 {id:'TS0001',name:'Foundation',brand:'Test',category:'المكياج',details_json:JSON.stringify({productType:'foundation'}),price_fils:9500,reference_price_fils:9500,image_url:'/images/TS0001.svg',stock:30,approved:1,active:1},
 {id:'TS0002',name:'Mascara',brand:'Test',category:'المكياج',details_json:'{}',price_fils:5000,reference_price_fils:5000,image_url:'/images/TS0002.svg',stock:30,approved:1,active:1},
 {id:'TS0003',name:'Cream',brand:'Test',category:'البشرة',details_json:'{}',price_fils:4000,reference_price_fils:4000,image_url:'/images/TS0003.svg',stock:30,approved:1,active:1}
];
const priced=()=>withPairPricing(products,true);
const offer={id:'PROMOV5-BEAUTY',kind:'combo',title:'باكيج الإطلالة',en:{title:'The beauty pair'},active:true,items:[{id:'TS0001',qty:1},{id:'TS0002',qty:1}],priceFils:8000,image:'/images/catalog/marketing/bundle-1.webp'};
const bundle={id:offer.id,qty:1,options:{TS0001:'tone-2'}};
const customer={name:'سارة أحمد',phone:'0791234567',address:'العبدلي',governorate:'عمّان',payment:'cod'};

function fixture(t,{enabled=true,promotions=[]}={}){
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));
 if(enabled)sql.exec(read('db/migrations/0025_storefront_controls.sql'));
 for(const p of products)sql.prepare('INSERT INTO products(id,brand,name,category,details_json,price_fils,reference_price_fils,image_url,stock,approved,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(p.id,p.brand,p.name,p.category,p.details_json,p.price_fils,p.reference_price_fils,p.image_url,p.stock,p.approved,p.active);
 for(const p of promotions)sql.prepare('INSERT INTO promotions(id,kind,title,description,config_json,active) VALUES(?,?,?,?,?,1)').run(p.id,p.kind,p.title,'',JSON.stringify(p));
 const wrap=(query,params=[])=>({bind(...values){return wrap(query,values)},async all(){return{results:sql.prepare(query).all(...params)}},async first(){return sql.prepare(query).get(...params)||null},async run(){return sql.prepare(query).run(...params)},_run(){return sql.prepare(query).run(...params)}});
 const DB={prepare:query=>wrap(query),async batch(rows){sql.exec('BEGIN');try{const result=rows.map(row=>row._run());sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}}};
 const env={DB,SESSION_SECRET:'test-session-secret-longer-than-thirty-two-characters',ADMIN_PASSWORD_HASH:'already-configured',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://mail.invalid',MAIL_WEBHOOK_TOKEN:'private-test-mail-token-longer-than-thirty-two'};
 const pending=[],mail=[];
 t.mock.method(globalThis,'fetch',async(_url,options)=>{mail.push(JSON.parse(options.body).order);return Response.json({ok:true,ownerSent:true})});
 t.after(async()=>{await Promise.all(pending);sql.close()});
 return{sql,DB,env,pending,mail,ctx:{waitUntil:promise=>pending.push(promise)}};
}
const stock=f=>f.sql.prepare('SELECT id,stock FROM products ORDER BY id').all().map(row=>({...row}));
const counts=f=>({orders:f.sql.prepare('SELECT count(*) n FROM orders').get().n,items:f.sql.prepare('SELECT count(*) n FROM order_items').get().n});
const order=(f,body,key='pricing-v5-unique-request-key')=>worker.fetch(new Request('https://trend.test/api/orders',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-idempotency-key':key},body:JSON.stringify({...customer,...body})}),f.env,f.ctx);
const catalog=f=>worker.fetch(new Request('https://trend.test/api/catalog'),f.env,f.ctx);
function assertReceiptTotals(quote,cart,catalogProducts,promotions=[]){
 assert.equal(quote.lines.reduce((sum,line)=>sum+line.lineTotalFils,0),quote.subtotalFils);
 assert.equal(quote.itemsSubtotalFils-quote.discountFils,quote.subtotalFils);
 assert.equal(quote.totalFils,quote.subtotalFils+quote.shippingFeeFils);
 const snapshot=purchaseSnapshot(quote,expandPurchaseCart(cart,catalogProducts,promotions),catalogProducts);
 assert.equal(snapshot.reduce((sum,row)=>sum+orderLineTotal(row),0),quote.subtotalFils);
 assert.ok(snapshot.every(row=>Number.isInteger(row.line_total_fils)&&row.line_total_fils>=0));
 return snapshot;
}

test('Pair rounding uses the exact 0.60 boundary after the raw ten-percent discount',()=>{
 // 1.999 × 2 × .9 = 3.5982, while 2.000 × 2 × .9 = 3.6000.
 for(const [unit,expected] of [[1999,2990],[2000,3990],[2001,3990],[6999,11990],[7000,12990],[7001,12990],[4999,8990],[5000,8990],[5001,8990],[9500,16990]]){
  assert.equal(pairPriceFils(unit),expected,`unit price ${unit} fils`);
  assert.equal(expected%1000,990);
 }
});

test('Low pair prices remain positive and never exceed buying two individual units',()=>{
 for(let unit=500;unit<=2000;unit++){
  const pair=pairPriceFils(unit);
  assert.ok(Number.isSafeInteger(pair)&&pair>0,`positive integer for ${unit}`);
  assert.ok(pair<unit*2,`a pair must save money at unit price ${unit}`);
 }
 assert.equal(pairPriceFils(500),990);
 assert.equal(pairPriceFils(750),990);
 // At these low prices, a .99 tag would cost at least two single units.
 // Preserve the raw ten-percent saving instead, rounded down to display cents.
 for(const [unit,expected] of [[888,990],[889,1600],[990,1780],[995,1790],[996,1990],[1444,1990],[1445,2600],[1490,2680],[1495,2690],[1496,2990]])assert.equal(pairPriceFils(unit),expected,`no-surcharge boundary ${unit}`);
 for(let unit=500;unit<=20000;unit++){
  const raw=unit*18,whole=Math.floor(raw/10000),tag=(whole+(raw%10000>=6000?1:0))*1000-10;
  if(tag<unit*2)assert.equal(pairPriceFils(unit)%1000,990,`.99 ending at ${unit}`);
  else assert.equal(pairPriceFils(unit),Math.floor(raw/100)*10,`raw saving exception at ${unit}`);
 }
 for(const invalid of [-1,0,499,NaN,Infinity,9500.5,Number.MAX_SAFE_INTEGER,'9500',null,undefined])assert.equal(pairPriceFils(invalid),null);
});

test('Every complete pair is priced again and an odd remaining item keeps its single price',()=>{
 const catalogProducts=priced(),product=catalogProducts[0];
 for(const [qty,expected] of [[1,9500],[2,16990],[3,26490],[4,33980],[5,43480],[6,50970],[9,77460],[10,84950]]){
  assert.equal(quantityPriceFils(product,qty),expected);
  const cart=[{id:product.id,qty,variant:'tone-1'}],quote=quotePurchase(cart,catalogProducts);
  assert.equal(quote.subtotalFils,expected,`quantity ${qty}`);
  assert.equal(quote.promotions.find(row=>row.id==='AUTOPAIR-TS0001')?.count||0,Math.floor(qty/2));
  assertReceiptTotals(quote,cart,catalogProducts);
 }
 assert.equal(quantityPriceFils(products[0],5),47500,'unconfigured products keep their existing price');
 assert.deepEqual(withPairPricing(products,false),products);
 assert.ok(products.every(product=>!Object.hasOwn(product,'automaticPairPriceFils')),'enabling pricing does not mutate catalog input');
});

test('Different variants of the same product form pairs and retain their selected options',()=>{
 const catalogProducts=priced(),cart=[{id:'TS0001',qty:1,variant:'tone-1'},{id:'TS0001',qty:2,variant:'tone-3'},{id:'TS0003',qty:1}];
 assert.equal(purchaseCartError(cart,catalogProducts,[]),'');
 const quote=quotePurchase(cart,catalogProducts);
 assert.equal(quote.subtotalFils,30490);
 assert.equal(quote.lines[2].lineTotalFils,4000,'an unrelated product receives no pair discount');
 assert.equal(quote.lines[0].offerSavingFils+quote.lines[1].offerSavingFils,2010);
 const snapshot=assertReceiptTotals(quote,cart,catalogProducts);
 assert.equal(snapshot.length,2);
 const foundation=snapshot.find(row=>row.product_id==='TS0001');
 assert.equal(foundation.qty,3);assert.equal(foundation.line_total_fils,26490);
 assert.deepEqual(JSON.parse(foundation.options_snapshot).map(row=>row.qty),[1,2]);
 assert.match(foundation.options_snapshot,/فاتح/);assert.match(foundation.options_snapshot,/وسط عادي/);
 const reversed=quotePurchase([...cart].reverse(),catalogProducts);
 assert.equal(reversed.subtotalFils,quote.subtotalFils,'variant insertion order cannot change the amount payable');
 assertReceiptTotals(reversed,[...cart].reverse(),catalogProducts);
});

test('A product-wide pair policy replaces stale same-product pair promotions',()=>{
 const stale={id:'PROMOV5-OLDPAIR',kind:'offer',title:'Old pair',active:true,items:[{id:'TS0001',qty:2}],priceFils:15000};
 const cart=[{id:'TS0001',qty:2,variant:'tone-1'}];
 const quote=quoteCart(cart,priced(),[stale]);
 assert.equal(quote.subtotalFils,16990);assert.deepEqual(quote.promotions.map(row=>row.id),['AUTOPAIR-TS0001']);
 assert.equal(quoteCart(cart,products,[stale]).subtotalFils,15000,'legacy behavior remains available until pricing is enabled');
});

test('Automatic pairs and multi-product combos consume different units',()=>{
 const catalogProducts=priced(),cart=[{id:'TS0001',qty:3,variant:'tone-2'},{id:'TS0002',qty:1}];
 const quote=quotePurchase(cart,catalogProducts,[offer]);
 assert.equal(quote.subtotalFils,24990);
 assert.deepEqual(quote.promotions.map(row=>[row.id,row.count]).sort(),[['AUTOPAIR-TS0001',1],[offer.id,1]].sort());
 for(const id of ['TS0001','TS0002']){
  const consumed=quote.promotions.reduce((sum,promotion)=>sum+promotion.items.filter(item=>item.id===id).reduce((sum,item)=>sum+item.qty*promotion.count,0),0);
  assert.ok(consumed<=cart.find(item=>item.id===id).qty,`${id} cannot be reused by two discounts`);
 }
 assertReceiptTotals(quote,cart,catalogProducts,[offer]);
 const overlapping=quotePurchase([{id:'TS0001',qty:2,variant:'tone-1'},{id:'TS0002',qty:1}],catalogProducts,[offer]);
 assert.equal(overlapping.subtotalFils,17500);
 assert.deepEqual(overlapping.promotions.map(row=>row.id),[offer.id]);
});

test('An explicit bundle owns its components and repeated whole bundles receive pair pricing',()=>{
 const catalogProducts=priced(),bundleItem=bundleProduct(offer,catalogProducts);
 assert.equal(bundleItem.automaticPairPriceFils,13990);
 for(const [qty,expected] of [[1,8000],[2,13990],[3,21990],[4,27980],[5,35980]]){
  const cart=[{...bundle,qty}],quote=quotePurchase(cart,catalogProducts,[offer]);
  assert.equal(purchaseCartError(cart,catalogProducts,[offer]),'');
  assert.equal(quote.lines.length,1);assert.equal(quote.subtotalFils,expected);
  assert.equal(quote.lines[0].kind,'bundle');
  assert.deepEqual(expandPurchaseCart(cart,catalogProducts,[offer]).map(item=>[item.id,item.qty]),[['TS0001',qty],['TS0002',qty]]);
  const snapshot=assertReceiptTotals(quote,cart,catalogProducts,[offer]);
  assert.equal(snapshot.length,1);assert.equal(snapshot[0].qty,qty);assert.equal(snapshot[0].line_total_fils,expected);
 }
 const loose=[bundle,{id:'TS0001',qty:1,variant:'tone-1'}];
 const quote=quotePurchase(loose,catalogProducts,[offer]);
 assert.equal(quote.subtotalFils,17500);
 assert.equal(quote.lines[0].lineTotalFils,9500,'one loose item cannot pair with a reserved bundle component');
 assert.equal(quote.promotions.filter(row=>row.id.startsWith('AUTOPAIR-')).length,0);
 assertReceiptTotals(quote,loose,catalogProducts,[offer]);
});

test('A single bundle invoice displays one final bundle row with matching subtotal and delivery',()=>{
 const catalogProducts=priced(),cart=[bundle],quote=quotePurchase(cart,catalogProducts,[offer]);
 const rows=assertReceiptTotals(quote,cart,catalogProducts,[offer]);
 const saved={id:'TR-TEST-V5',created_at:'2026-11-05 00:00:00',...customer,payment_method:'cod',status:'جديد',subtotal_fils:quote.subtotalFils,discount_fils:quote.discountFils,shipping_fee_fils:quote.shippingFeeFils,presentation_json:JSON.stringify(rows),items:[]};
 assert.equal(orderDisplayItems(saved).length,1);
 assert.equal(orderDisplayItems(saved)[0].unit_price_fils,8000);
 const html=invoice(saved),body=html.match(/<tbody>(.*?)<\/tbody>/s)?.[1];
 assert.equal((body.match(/<tr>/g)||[]).length,1);assert.match(body,/باكيج الإطلالة/);assert.match(body,/bundle-1\.webp/);assert.match(body,/8\.00/);
 assert.match(html,/مجموع المنتجات: 8\.00/);assert.match(html,/الإجمالي شامل التوصيل: 9\.00/);
});

test('An empty pre-migration database preserves legacy prices; migration enables matching catalog and checkout prices',async t=>{
 const f=fixture(t,{enabled:false});
 let response=await catalog(f);assert.equal(response.status,200);
 let data=await response.json();assert.equal(data.siteSettings.pairPricing,false);
 assert.ok(data.products.every(product=>!Object.hasOwn(product,'automaticPairPriceFils')));
 const cart=[{id:'TS0001',qty:2,variant:'tone-1'}];
 response=await order(f,{items:cart,expectedSubtotalFils:19000,expectedTotalFils:20000},'pricing-v5-legacy-order-key');
 assert.equal(response.status,201,await response.clone().text());
 assert.equal((await response.json()).subtotalFils,19000);
 f.sql.exec(read('db/migrations/0025_storefront_controls.sql'));
 response=await catalog(f);data=await response.json();assert.equal(data.siteSettings.pairPricing,true);
 assert.equal(data.products.find(product=>product.id==='TS0001').automaticPairPriceFils,16990);
 response=await order(f,{items:cart,expectedSubtotalFils:16990,expectedTotalFils:17990},'pricing-v5-enabled-order-key');
 assert.equal(response.status,201,await response.clone().text());
 const receipt=await response.json();assert.equal(receipt.subtotalFils,16990);assert.equal(receipt.discountFils,2010);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,26);
});

test('Authoritative checkout prices pairs across variants and freezes exact receipt and stock totals',async t=>{
 const f=fixture(t),cart=[{id:'TS0001',qty:1,variant:'tone-1'},{id:'TS0001',qty:2,variant:'tone-3'}];
 const response=await order(f,{items:cart,expectedSubtotalFils:26490,expectedTotalFils:26490});
 assert.equal(response.status,201,await response.clone().text());
 const receipt=await response.json();assert.equal(receipt.subtotalFils,26490);assert.equal(receipt.shippingFeeFils,0);assert.equal(receipt.discountFils,2010);
 await Promise.all(f.pending);
 const saved=f.sql.prepare('SELECT * FROM orders').get(),internal=f.sql.prepare('SELECT * FROM order_items').all(),display=orderDisplayItems({...saved,items:internal});
 assert.deepEqual(counts(f),{orders:1,items:1});assert.equal(internal[0].qty,3);assert.equal(internal[0].unit_price_fils,9500);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,27);
 assert.equal(display.length,1);assert.equal(display[0].qty,3);assert.equal(display[0].line_total_fils,26490);
 assert.equal(display.reduce((sum,row)=>sum+orderLineTotal(row),0),saved.subtotal_fils);
 assert.deepEqual(JSON.parse(internal[0].options_snapshot).map(row=>[row.id,row.qty]),[['tone-1',1],['tone-3',2]]);
 assert.equal(f.mail.length,1);assert.equal(f.mail[0].items.length,1);assert.equal(f.mail[0].items[0].line_total_fils,26490);
});

test('Whole-bundle checkout saves one receipt row while debiting each component exactly once per bundle',async t=>{
 const f=fixture(t,{promotions:[offer]}),response=await order(f,{items:[{...bundle,qty:3}],expectedSubtotalFils:21990,expectedTotalFils:21990});
 assert.equal(response.status,201,await response.clone().text());await Promise.all(f.pending);
 const saved=f.sql.prepare('SELECT * FROM orders').get(),internal=f.sql.prepare('SELECT * FROM order_items ORDER BY product_id').all(),display=orderDisplayItems({...saved,items:internal});
 assert.equal(display.length,1);assert.equal(display[0].kind,'bundle');assert.equal(display[0].qty,3);assert.equal(display[0].line_total_fils,21990);
 assert.deepEqual(internal.map(item=>[item.product_id,item.qty]),[['TS0001',3],['TS0002',3]]);
 assert.deepEqual(stock(f),[{id:'TS0001',stock:27},{id:'TS0002',stock:27},{id:'TS0003',stock:30}]);
 assert.equal(f.mail[0].items.length,1);assert.equal(f.mail[0].items[0].line_total_fils,21990);
});

for(const scenario of [
 {name:'stale single-unit subtotal',changes:{expectedSubtotalFils:19000,expectedTotalFils:20000}},
 {name:'stale delivery-inclusive total',changes:{expectedSubtotalFils:16990,expectedTotalFils:16990}},
 {name:'forged client pair price',changes:{items:[{id:'TS0001',qty:2,variant:'tone-1',automaticPairPriceFils:1000,price_fils:500}],expectedSubtotalFils:1000,expectedTotalFils:2000}}
])test(`Checkout rejects ${scenario.name} without consuming stock or an idempotency key`,async t=>{
 const f=fixture(t),before=stock(f),body={items:[{id:'TS0001',qty:2,variant:'tone-1'}],expectedSubtotalFils:16990,expectedTotalFils:17990},key='pricing-v5-stale-retry-request';
 const rejected=await order(f,{...body,...scenario.changes},key);
 assert.equal(rejected.status,409,await rejected.clone().text());assert.deepEqual(counts(f),{orders:0,items:0});assert.deepEqual(stock(f),before);assert.equal(f.mail.length,0);
 const corrected=await order(f,body,key);assert.equal(corrected.status,201,await corrected.clone().text());assert.deepEqual(counts(f),{orders:1,items:1});
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,28);
});

test('Idempotency replays frozen pair totals after prices, policy and stock have changed',async t=>{
 const f=fixture(t),body={items:[{id:'TS0001',qty:2,variant:'tone-2'}],expectedSubtotalFils:16990,expectedTotalFils:17990},key='pricing-v5-frozen-idempotency';
 let response=await order(f,body,key);assert.equal(response.status,201,await response.clone().text());const original=await response.json();await Promise.all(f.pending);
 f.sql.exec("UPDATE products SET price_fils=12000,stock=0,image_url='/changed.svg' WHERE id='TS0001';DELETE FROM site_settings");
 const before=stock(f);response=await order(f,body,key);assert.equal(response.status,200,await response.clone().text());const replay=await response.json();
 assert.equal(replay.duplicate,true);assert.equal(replay.orderId,original.orderId);assert.equal(replay.subtotalFils,16990);assert.equal(replay.totalFils,17990);
 assert.deepEqual(counts(f),{orders:1,items:1});assert.deepEqual(stock(f),before);assert.equal(f.mail.length,1);
 const saved=f.sql.prepare('SELECT * FROM orders').get();assert.equal(orderDisplayItems(saved)[0].image_snapshot,'/images/TS0001.svg');assert.equal(orderDisplayItems(saved)[0].line_total_fils,16990);
});

for(const mode of ['stock','price'])test(`A ${mode} race during pair-and-combo checkout rolls back the order and every earlier stock debit`,async t=>{
 const f=fixture(t,{promotions:[offer]}),originalBatch=f.DB.batch;
 f.DB.batch=async rows=>{
  f.sql.exec(mode==='stock'?"UPDATE products SET stock=0 WHERE id='TS0002'":"UPDATE products SET price_fils=5500 WHERE id='TS0002'");
  return originalBatch(rows);
 };
 const response=await order(f,{items:[{id:'TS0001',qty:3,variant:'tone-1'},{id:'TS0002',qty:1}],expectedSubtotalFils:24990,expectedTotalFils:24990});
 assert.equal(response.status,409,await response.clone().text());assert.deepEqual(counts(f),{orders:0,items:0});assert.equal(f.mail.length,0);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,30,'a failed second component restores the first stock debit');
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0002'").get().stock,mode==='stock'?0:30);
});
