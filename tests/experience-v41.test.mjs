import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import worker from '../src/worker.js';
import {quotePurchase,purchaseSnapshot,expandPurchaseCart,purchaseCartError} from '../public/bundles.js';
import {orderDisplayItems,orderLineTotal} from '../public/order-presentation.js';
import {invoice} from '../public/invoice.js';
import {serveImage} from '../src/media.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const products=[
 {id:'TS0001',name:'Foundation',category:'المكياج',details_json:JSON.stringify({productType:'foundation'}),price_fils:6000,reference_price_fils:9000,image_url:'/images/TS0001.svg',stock:10,approved:1,active:1},
 {id:'TS0002',name:'Mascara',category:'المكياج',price_fils:5000,reference_price_fils:5000,image_url:'/images/TS0002.svg',stock:10,approved:1,active:1},
 {id:'TS0003',name:'Cream',category:'البشرة',price_fils:4000,reference_price_fils:5000,image_url:'/images/TS0003.svg',stock:10,approved:1,active:1}
];
const offers=[{id:'PROMOV41-PAIR',kind:'combo',title:'باكيج الإطلالة',en:{title:'The beauty pair'},active:true,items:[{id:'TS0001',qty:1},{id:'TS0002',qty:1}],priceFils:8000,image:'/images/catalog/marketing/bundle-1.webp'}];
const pair={id:offers[0].id,qty:1,options:{TS0001:'tone-2'}};
test('A selected package has one final price; extra overlapping items cannot consume its components again',()=>{
 const cart=[pair,{id:'TS0001',qty:1,variant:'tone-3'}],q=quotePurchase(cart,products,offers);
 assert.equal(q.subtotalFils,14000);assert.equal(q.totalFils,15000);assert.equal(q.lines.length,2);
 assert.equal(q.lines.find(x=>x.kind==='bundle').lineTotalFils,8000);
 assert.equal(q.lines.reduce((n,x)=>n+x.lineTotalFils,0),q.subtotalFils);
 assert.equal(purchaseCartError(cart,products,offers),'');
 const frozen=purchaseSnapshot(q,expandPurchaseCart(cart,products,offers),products);
 const bundle=frozen.find(x=>x.kind==='bundle');assert.equal(bundle.qty,1);assert.equal(bundle.unit_price_fils,8000);assert.equal(bundle.image_snapshot,offers[0].image);assert.match(bundle.options_snapshot,/وسط فاتح/);
 const order={subtotal_fils:q.subtotalFils,presentation_json:JSON.stringify(frozen),items:[],shipping_fee_fils:1000};
 assert.equal(orderDisplayItems(order).length,2);const html=invoice(order);assert.match(html,/باكيج الإطلالة/);assert.match(html,/bundle-1.webp/);assert.match(html,/8\.00/);
});
test('Automatic quantity savings appear on the affected final line, never on an unrelated product',()=>{
 const promotions=[{id:'PROMOV41-TRIPLE',kind:'offer',active:true,title:'Three mascaras',items:[{id:'TS0002',qty:3}],priceFils:10000}];
 const q=quotePurchase([{id:'TS0002',qty:3},{id:'TS0003',qty:1}],products,promotions);
 assert.equal(q.lines[0].lineTotalFils,10000);assert.equal(q.lines[1].lineTotalFils,4000);assert.equal(q.subtotalFils,14000);
 const rows=purchaseSnapshot(q,[],products);assert.equal(rows.map(orderLineTotal).reduce((a,b)=>a+b,0),14000);
});
test('A package and loose items share stock caps and require every component option',()=>{
 assert.match(purchaseCartError([{...pair,qty:6},{id:'TS0001',qty:5,variant:'tone-1'}],products,offers),/10/);
 assert.match(purchaseCartError([{...pair,options:{}}],products,offers),/الدرجة/);
 assert.match(purchaseCartError([{...pair,options:{TS0001:'tone-1',TS0003:'fake'}}],products,offers),/غير صالحة/);
 assert.ok(purchaseCartError([pair],products,[{...offers[0],active:false}]));
 assert.match(purchaseCartError([pair],products.map(p=>({...p,stock:0})),offers),/المخزون/);
});
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));
 for(const p of products)sql.prepare('INSERT INTO products(id,brand,name,category,details_json,price_fils,reference_price_fils,image_url,stock,approved,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(p.id,'Test',p.name,p.category,p.details_json||'{}',p.price_fils,p.reference_price_fils,p.image_url,p.stock,p.approved,p.active);
 for(const p of offers)sql.prepare('INSERT INTO promotions(id,kind,title,description,config_json,active) VALUES(?,?,?,?,?,1)').run(p.id,p.kind,p.title,'',JSON.stringify(p));
 const wrap=(q,params=[])=>({bind(...p){return wrap(q,p)},async all(){return{results:sql.prepare(q).all(...params)}},async first(){return sql.prepare(q).get(...params)||null},async run(){return sql.prepare(q).run(...params)},_run(){return sql.prepare(q).run(...params)}});
 const DB={sql,prepare:q=>wrap(q),async batch(rows){sql.exec('BEGIN');try{const r=rows.map(x=>x._run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB,SESSION_SECRET:'test-session-secret-longer-than-thirty-two-characters',ADMIN_PASSWORD_HASH:'already-configured',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://mail.invalid',MAIL_WEBHOOK_TOKEN:'private-test-mail-token-longer-than-thirty-two'};
 const pending=[];return {sql,DB,env,pending,ctx:{waitUntil:p=>pending.push(p)}};
}
const customer={name:'سارة أحمد',phone:'0791234567',address:'العبدلي',governorate:'عمّان',payment:'cod',items:[pair],expectedSubtotalFils:8000,expectedTotalFils:9000};
const order=(f,body=customer,key='test-v41-bundle-unique-key')=>worker.fetch(new Request('https://trend.test/api/orders',{method:'POST',headers:{origin:'https://trend.test','content-type':'application/json','x-idempotency-key':key},body:JSON.stringify(body)}),f.env,f.ctx);
test('Checkout freezes a package receipt, keeps stock entries separate internally and replays safely',async()=>{
 const f=fixture(),original=globalThis.fetch;let mail;globalThis.fetch=async(_,o)=>{mail=JSON.parse(o.body).order;return Response.json({ok:true,ownerSent:true})};
 try{const response=await order(f);assert.equal(response.status,201,await response.clone().text());await Promise.all(f.pending);
  const saved=f.sql.prepare('SELECT * FROM orders').get(),rows=orderDisplayItems({...saved,items:f.sql.prepare('SELECT * FROM order_items').all()});
  assert.equal(rows.length,1);assert.equal(rows[0].name_snapshot,offers[0].title);assert.equal(rows[0].unit_price_fils,8000);assert.equal(rows[0].image_snapshot,offers[0].image);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM order_items').get().n,2);assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,9);
  assert.equal(mail.items.length,1);assert.equal(mail.items[0].price_fils,8000);assert.equal(mail.items[0].image,offers[0].image);
  f.sql.exec("UPDATE promotions SET active=0;UPDATE products SET price_fils=7000,image_url='/changed.svg'");
  const replay=await order(f);assert.equal(replay.status,200);assert.equal((await replay.json()).duplicate,true);assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,1);assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,9);
  assert.equal(orderDisplayItems(saved)[0].image_snapshot,offers[0].image);
 }finally{globalThis.fetch=original;f.sql.close()}
});
test('Stale package totals and stock races fail atomically without orphan orders',async()=>{
 for(const mode of ['stale','race']){const f=fixture();if(mode==='race'){const batch=f.DB.batch;f.DB.batch=async rows=>{f.sql.exec("UPDATE products SET stock=0 WHERE id='TS0002'");return batch(rows)}}
  const r=await order(f,{...customer,...(mode==='stale'?{expectedSubtotalFils:7000}:{})},'v41-'+mode+'-unique-transaction');assert.equal(r.status,409,await r.clone().text());assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(f.sql.prepare('SELECT count(*) n FROM order_items').get().n,0);assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='TS0001'").get().stock,10);f.sql.close();
 }
});
test('A frozen display snapshot with incorrect totals is never trusted',()=>{
 const rows=[{name_snapshot:'Bad bundle',qty:1,line_total_fils:500}];const legacy=[{name_snapshot:'Original product',qty:1,unit_price_fils:8000}];assert.deepEqual(orderDisplayItems({subtotal_fils:8000,presentation_json:JSON.stringify(rows),items:legacy}),legacy);
});
test('Stale selections remain removable rows and cannot silently become a different order',()=>{
 const stale=quotePurchase([pair,{id:'TS9999',qty:1}],products,[]);assert.equal(stale.lines.length,2);assert.ok(stale.lines.every(x=>x.product));assert.ok(purchaseCartError([pair],products,[]));
});
test('New campaign images use permitted media keys and keep their original pack references',async()=>{
 const manifest=JSON.parse(read('data/marketing-assets-v41.json'));
 assert.equal(manifest.images.length,4);
 for(const row of manifest.images){assert.ok(row.prompt.length>100);assert.ok(row.primary);for(const url of [row.image,row.thumbnail]){const bytes=readFileSync(new URL('../public'+url,import.meta.url));const env={MEDIA:{async getWithMetadata(){return {value:new Response(bytes).body,metadata:{contentType:'image/webp',size:bytes.length}}}}};const response=await serveImage(new Request('https://trend.test'+url),env,{},'catalog/'+url.slice('/images/catalog/'.length));assert.equal(response.status,200,url);await response.arrayBuffer()}}
});
test('The wording migration preserves prices, stock and concurrent owner edits and is repeatable',()=>{
 const updates=JSON.parse(read('data/customer-copy-v41.json')).slice(0,3),db=new DatabaseSync(':memory:');db.exec(read('db/schema.sql'));
 for(const u of updates)db.prepare('INSERT INTO products(id,brand,name,category,description,details_json,reference_price_fils,price_fils,image_url,stock,approved) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(u.id,'Test','Original name','المكياج',u.before.description,JSON.stringify({tagline:u.before.tagline,options:[{id:'kept',label:'Kept'}],en:{notes:'Keep this',options:{kept:'Kept'}}}),7000,5000,'/images/pack.webp',7,1);
 db.prepare('UPDATE products SET description=? WHERE id=?').run('Owner changed this',updates[1].id);const before=db.prepare('SELECT id,stock,price_fils,reference_price_fils,image_url FROM products ORDER BY id').all();db.exec(read('db/migrations/0022_customer_copy_v41.sql'));
 assert.equal(db.prepare('SELECT description FROM products WHERE id=?').get(updates[1].id).description,'Owner changed this');const d=JSON.parse(db.prepare('SELECT details_json FROM products WHERE id=?').get(updates[0].id).details_json);assert.equal(d.en.notes,'Keep this');assert.equal(d.en.options.kept,'Kept');assert.equal(d.options[0].id,'kept');assert.deepEqual(db.prepare('SELECT id,stock,price_fils,reference_price_fils,image_url FROM products ORDER BY id').all(),before);
 const after=db.prepare('SELECT * FROM products ORDER BY id').all();db.exec(read('db/migrations/0022_customer_copy_v41.sql'));assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),after);db.close();
});
const galleryBundle=buildSync({stdin:{contents:"export {mountMediaGallery} from './public/media-gallery.js';",resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'iife',globalName:'Gallery',write:false,logLevel:'silent'}).outputFiles[0].text;
test('Photo and portrait video navigation supports touch swipes, silent loops and native seeking controls',()=>{
 const dom=new JSDOM('<div id="gallery"></div>',{url:'https://trend.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;let plays=0;
 w.HTMLMediaElement.prototype.play=async()=>{plays++};w.HTMLMediaElement.prototype.pause=()=>{};w.eval(galleryBundle);
 const controller=w.Gallery.mountMediaGallery(d.querySelector('#gallery'),{photos:[{url:'/images/TS0001.svg'}],videos:[{url:'/product-videos/00000000-0000-4000-8000-000000000001',mime:'video/mp4',title:'Care'}],name:'Test'});
 const stage=d.querySelector('.touch-media-stage'),event=(type,x,y)=>{const e=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:1});stage.dispatchEvent(e)};
 event('pointerdown',250,100);event('pointerup',100,103);assert.equal(controller.index,1);
 const video=d.querySelector('video');assert.ok(video.autoplay&&video.loop&&video.controls&&video.muted&&video.playsInline);assert.ok(plays>0);assert.equal(video.width,360);assert.equal(video.height,640);
 event('pointerdown',100,100);event('pointerup',250,102);assert.equal(controller.index,0);assert.ok(d.querySelector('img'));
 event('pointerdown',100,100);event('pointerup',105,250);assert.equal(controller.index,0,'vertical scrolling does not advance the gallery');controller.destroy();dom.window.close();
});
