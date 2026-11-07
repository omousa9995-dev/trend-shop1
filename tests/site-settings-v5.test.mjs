import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM,VirtualConsole} from 'jsdom';
import worker,{_test} from '../src/worker.js';
import {readSiteSettings} from '../src/site-settings.js';
import {DEFAULT_SITE_SETTINGS,HOME_SECTIONS,PRODUCT_SECTIONS,normalizeSiteSettings,settingsProductCompare} from '../public/site-settings.js';
import {applyAppearance,applyHomeLayout,applyProductSections} from '../public/storefront-settings.js';
import {createSiteSettingsManager} from '../public/site-settings-admin.js';
import {pairPriceFils} from '../public/pair-pricing.js';
import {storefrontBundle} from './helpers/storefront-bundle.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const clone=value=>structuredClone(value);
const productIds=['TS9001','TS9002','TS9003'];
const products=productIds.map((id,index)=>({id,name:['Serum','Mask','Cream'][index],brand:['Alpha','Beta','Gamma'][index],category:'البشرة',price_fils:[5000,4000,7000][index],reference_price_fils:[6000,5000,8000][index],image_url:'/images/'+id+'.svg',stock:10,approved:1,active:1,details_json:'{}'}));
const settings=overrides=>normalizeSiteSettings({...clone(DEFAULT_SITE_SETTINGS),...overrides},{productIds:new Set(productIds)});

function fixture(t,{migrated=true}={}){
 const sql=new DatabaseSync(':memory:');sql.exec(read('db/schema.sql'));
 for(const p of products)sql.prepare('INSERT INTO products(id,name,brand,category,price_fils,reference_price_fils,image_url,stock,approved,active,details_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(p.id,p.name,p.brand,p.category,p.price_fils,p.reference_price_fils,p.image_url,p.stock,p.approved,p.active,p.details_json);
 if(migrated)sql.exec(read('db/migrations/0025_storefront_controls.sql'));
 const f={sql};
 const statement=(query,args=[])=>({
  bind(...params){return statement(query,params)},
  async first(){return sql.prepare(query).get(...args)||null},
  async all(){return {results:sql.prepare(query).all(...args)}},
  async run(){
   if(/^UPDATE site_settings SET config_json=/.test(query)&&f.beforeSettingsUpdate){const before=f.beforeSettingsUpdate;delete f.beforeSettingsUpdate;before();}
   const result=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(result.changes)}};
  }
 });
 f.env={DB:{prepare:query=>statement(query)},SESSION_SECRET:'site-settings-test-session-secret-longer-than-32-characters',ADMIN_PASSWORD_HASH:'configured-test-hash',STORE_LIVE:'true',MAIL_WEBHOOK_URL:'https://mail.invalid',MAIL_WEBHOOK_TOKEN:'site-settings-test-mail-token-longer-than-32-characters'};
 f.stored=()=>({...sql.prepare("SELECT * FROM site_settings WHERE id='storefront'").get()});
 t.after(()=>sql.close());return f;
}
async function adminClient(f){
 const cookie='ts_admin='+await _test.makeSession(f.env);
 return (method='GET',body,overrides={})=>{
  const headers={cookie,...(method==='POST'?{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1'}:{}),...overrides};
  for(const key of Object.keys(headers))if(headers[key]===null)delete headers[key];
  return worker.fetch(new Request('https://trend.test/api/admin/site-settings',{method,headers,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),f.env,{});
 };
}
async function jsonOk(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json();}

test('Site settings accept bounded plain text and discard unknown fields and section metadata',()=>{
 const markup='<script>window.settingsExecuted=true</script><img src=x onerror=alert(1)>';
 const normalized=settings({storeName:'  Shop & smile  ',heroTitleAr:markup,privacyAr:'السطر الأول\n\n'+markup,privacyEn:'First paragraph\n\n'+markup,desktopColumns:3,mobileColumns:1,extraScript:markup,homeSections:[{id:'reviews',enabled:false,html:markup}],productSections:[{id:'faq',enabled:false},{id:'hero',enabled:false}],productOrder:['TS9003','TS9001']});
 assert.equal(normalized.storeName,'Shop & smile');assert.equal(normalized.heroTitleAr,markup);
 assert.equal(normalized.privacyAr,'السطر الأول\n\n'+markup);assert.equal(normalized.privacyEn,'First paragraph\n\n'+markup);
 assert.equal(Object.hasOwn(normalized,'extraScript'),false);
 assert.deepEqual(normalized.homeSections[0],{id:'reviews',enabled:false});
 assert.equal(normalized.homeSections.length,Object.keys(HOME_SECTIONS).length);
 assert.deepEqual(normalized.productSections.slice(0,2),[{id:'hero',enabled:true},{id:'faq',enabled:false}]);
 assert.deepEqual(normalized.productOrder,['TS9003','TS9001']);
 assert.equal(DEFAULT_SITE_SETTINGS.homeSections[0].id,'hero','normalization must not change defaults');
});

test('Validation rejects invalid columns, unknown products, duplicate sections and inherited object keys',()=>{
 const invalid=[null,[],{storeName:''},{privacyAr:' '},{privacyEn:''},{storeName:'x'.repeat(61)},{heroTextEn:'x'.repeat(601)},{privacyAr:'x'.repeat(7001)},{sloganAr:'bad\u0000text'},
  {desktopColumns:1},{desktopColumns:'4'},{mobileColumns:3},{productOrder:['TS9001','TS9001']},{productOrder:['TS9999']},{productOrder:['javascript:alert(1)']},
  {homeSections:[{id:'hero',enabled:'true'}]},{homeSections:[{id:'unknown',enabled:true}]},{homeSections:[{id:'hero',enabled:true},{id:'hero',enabled:false}]},
  ...['constructor','__proto__','toString'].flatMap(id=>[{homeSections:[{id,enabled:true}]},{productSections:[{id,enabled:true}]}])];
 for(const input of invalid)assert.throws(()=>normalizeSiteSettings(input,{productIds:new Set(productIds)}),undefined,JSON.stringify(input));
});

test('Manual ranking takes precedence, with deterministic fallback for unranked products',()=>{
 const ranked=[...products].sort(settingsProductCompare({productOrder:['TS9003','TS9002']},(a,b)=>a.id.localeCompare(b.id)));
 assert.deepEqual(ranked.map(p=>p.id),['TS9003','TS9002','TS9001']);
 const partial=[...products].reverse().sort(settingsProductCompare({productOrder:['TS9002']},(a,b)=>a.id.localeCompare(b.id)));
 assert.deepEqual(partial.map(p=>p.id),['TS9002','TS9001','TS9003']);
 assert.deepEqual(products.map(p=>p.id),productIds);
});

test('Admin settings require a signed session and every mutation requires both CSRF protections',async t=>{
 const f=fixture(t),admin=await adminClient(f),before=clone(f.stored());
 for(const method of ['GET','POST']){
  const response=await worker.fetch(new Request('https://trend.test/api/admin/site-settings',{method,headers:method==='POST'?{origin:'https://trend.test','content-type':'application/json','x-trend-admin':'1'}:{},...(method==='POST'?{body:JSON.stringify({revision:1,settings:settings({})})}:{})}),f.env,{});
  assert.equal(response.status,401);
 }
 assert.equal((await admin('GET',undefined,{cookie:'ts_admin=forged.signature'})).status,401);
 const loaded=await jsonOk(await admin());assert.equal(loaded.settings.revision,1);assert.deepEqual(loaded.history,[]);
 for(const headers of [{origin:null},{origin:'https://foreign.test'},{origin:'http://trend.test'},{'x-trend-admin':null},{'x-trend-admin':'0'}]){
  assert.equal((await admin('POST',{revision:1,settings:settings({storeName:'Untrusted change'})},headers)).status,403);
  assert.deepEqual(f.stored(),before);
 }
});

test('The server rejects malformed and oversized JSON and invalid product references without changing settings',async t=>{
 const f=fixture(t),admin=await adminClient(f),before=clone(f.stored());
 for(const [body,headers] of [['{',{}],['x'.repeat(65537),{}],[JSON.stringify({revision:1,settings:settings({})}),{'content-type':'text/plain'}],[{revision:1,settings:{...settings({}),productOrder:['TS9999']}},{}]]){
  const response=await admin('POST',body,headers);assert.equal(response.status,400,await response.clone().text());assert.deepEqual(f.stored(),before);
 }
});

test('Save and restore advance revisions, expose only history metadata and preserve the prior version',async t=>{
 const f=fixture(t),admin=await adminClient(f),original=(await jsonOk(await admin())).settings;
 const edited=settings({storeName:'Edited shop',heroTitleEn:'Our new welcome',privacyAr:'سياسة خاصة جديدة',privacyEn:'New private terms',productOrder:['TS9003','TS9001'],desktopColumns:2,mobileColumns:1,homeSections:[{id:'reviews',enabled:false}]});
 assert.deepEqual(await jsonOk(await admin('POST',{revision:1,settings:edited})),{ok:true,revision:2});
 const saved=await jsonOk(await admin());assert.equal(saved.settings.storeName,'Edited shop');assert.equal(saved.settings.revision,2);
 assert.deepEqual(saved.settings.productOrder,['TS9003','TS9001']);assert.equal(saved.history.length,1);assert.equal(saved.history[0].revision,1);
 assert.deepEqual(Object.keys(saved.history[0]).sort(),['revision','updatedAt']);
 const publicResponse=await worker.fetch(new Request('https://trend.test/api/site-settings'),f.env,{}),publicData=await jsonOk(publicResponse);
 assert.deepEqual(publicData.settings,saved.settings);assert.equal(Object.hasOwn(publicData,'history'),false);assert.equal(publicResponse.headers.get('cache-control'),'no-store');
 const before=clone(f.stored());assert.equal((await admin('POST',{action:'restore',revision:2,restoreRevision:999})).status,404);assert.deepEqual(f.stored(),before);
 assert.deepEqual(await jsonOk(await admin('POST',{action:'restore',revision:2,restoreRevision:1})),{ok:true,revision:3});
 const restored=await jsonOk(await admin());assert.deepEqual(restored.settings,{...original,revision:3});assert.deepEqual(restored.history.map(row=>row.revision),[2,1]);
 assert.equal(JSON.parse(f.stored().history_json)[0].settings.storeName,'Edited shop','restoring must preserve the version it replaces');
});

test('Stale, missing and racing revisions cannot overwrite a more recent save',async t=>{
 const f=fixture(t),admin=await adminClient(f);
 await jsonOk(await admin('POST',{revision:1,settings:settings({storeName:'Current owner edit'})}));
 const before=clone(f.stored());
 for(const revision of [undefined,1,'2',null]){
  assert.equal((await admin('POST',{revision,settings:settings({storeName:'Stale edit'})})).status,409);assert.deepEqual(f.stored(),before);
 }
 const concurrent=settings({storeName:'Concurrent owner edit'});
 f.beforeSettingsUpdate=()=>f.sql.prepare("UPDATE site_settings SET config_json=?,revision=revision+1 WHERE id='storefront'").run(JSON.stringify(concurrent));
 assert.equal((await admin('POST',{revision:2,settings:settings({storeName:'Lost race'})})).status,409);
 assert.equal(f.stored().revision,3);assert.equal(JSON.parse(f.stored().config_json).storeName,'Concurrent owner edit');assert.equal(f.stored().history_json,before.history_json);
});

test('Only the most recent five saved revisions remain restorable',async t=>{
 const f=fixture(t),admin=await adminClient(f);
 for(let revision=1;revision<=7;revision++)await jsonOk(await admin('POST',{revision,settings:settings({storeName:'Version '+(revision+1)})}));
 const loaded=await jsonOk(await admin());assert.equal(loaded.settings.revision,8);assert.deepEqual(loaded.history.map(row=>row.revision),[7,6,5,4,3]);
 assert.equal((await admin('POST',{action:'restore',revision:8,restoreRevision:2})).status,404);
 await jsonOk(await admin('POST',{action:'restore',revision:8,restoreRevision:3}));assert.equal((await jsonOk(await admin())).settings.storeName,'Version 3');
});

test('The migration activates the server pair policy without changing prices or replacing saved settings',async t=>{
 const f=fixture(t,{migrated:false}),before=f.sql.prepare('SELECT id,price_fils,reference_price_fils,stock FROM products ORDER BY id').all();
 const catalog=async()=>jsonOk(await worker.fetch(new Request('https://trend.test/api/catalog'),f.env,{}));
 const legacy=await catalog();assert.equal(legacy.siteSettings.pairPricing,false);assert.equal(legacy.siteSettings.revision,0);assert.ok(legacy.products.every(p=>!Object.hasOwn(p,'automaticPairPriceFils')));
 f.sql.exec(read('db/migrations/0025_storefront_controls.sql'));
 const activated=await catalog();assert.equal(activated.siteSettings.pairPricing,true);assert.equal(activated.siteSettings.revision,1);assert.equal(activated.storeLive,true);
 for(const product of activated.products)assert.equal(product.automaticPairPriceFils,pairPriceFils(product.price_fils));
 assert.deepEqual(f.sql.prepare('SELECT id,price_fils,reference_price_fils,stock FROM products ORDER BY id').all(),before);
 const admin=await adminClient(f);await jsonOk(await admin('POST',{revision:1,settings:settings({storeName:'Owner edits survive migration'})}));
 const saved=clone(f.stored());f.sql.exec(read('db/migrations/0025_storefront_controls.sql'));assert.deepEqual(f.stored(),saved);
});

test('An installation without the settings table retains default copy with the pricing policy inactive',async t=>{
 const f=fixture(t,{migrated:false});f.sql.exec('DROP TABLE site_settings');
 const loaded=await readSiteSettings(f.env);assert.equal(loaded.storeName,DEFAULT_SITE_SETTINGS.storeName);assert.equal(loaded.pairPricing,false);assert.equal(loaded.revision,0);
});

test('Appearance and home layout apply language, density, ordering and visibility using safe text nodes',t=>{
 const dom=new JSDOM('<header><a class="logo"><strong>Old name</strong><small>Old slogan</small></a></header><footer><span class="footer-logo">Old name</span><div class="footer-grid"><div><p>Old slogan</p></div></div></footer><main><section class="hero"><div class="hero-content"><h1>Old title</h1><p>Old intro</p></div></section><div class="benefits">Benefits</div><section><div id="homeReviews">Reviews</div></section><section><div class="cat-grid">Categories</div></section></main>');t.after(()=>dom.window.close());
 const d=dom.window.document,main=d.querySelector('main'),markup='<img src=x onerror="window.executed=true">';
 const configured=settings({storeName:markup,sloganAr:'شعار <b>عربي</b>',sloganEn:'An <b>English</b> slogan',heroTitleAr:'عنوان <script>alert(1)</script>',heroTitleEn:'A <script>alert(1)</script> title',heroTextAr:'شرح <img src=x>',heroTextEn:'An <img src=x> intro',desktopColumns:3,mobileColumns:1,homeSections:[{id:'reviews',enabled:false},{id:'categories',enabled:true},{id:'hero',enabled:true},{id:'benefits',enabled:false}]});
 for(const language of ['ar','en']){
  applyAppearance(d,configured,language);applyHomeLayout(main,configured,language);
  assert.equal(d.querySelector('.logo strong').textContent,markup);assert.equal(d.querySelector('.footer-logo').textContent,markup);
  assert.equal(d.querySelector('.logo small').textContent,configured[language==='en'?'sloganEn':'sloganAr']);
  assert.equal(d.querySelector('.footer-grid p').textContent,configured[language==='en'?'sloganEn':'sloganAr']);
  assert.equal(d.querySelector('.hero h1').textContent,configured[language==='en'?'heroTitleEn':'heroTitleAr']);
  assert.equal(d.querySelector('.hero-content>p').textContent,configured[language==='en'?'heroTextEn':'heroTextAr']);
 }
 assert.equal(d.documentElement.dataset.desktopColumns,'3');assert.equal(d.documentElement.dataset.mobileColumns,'1');
 assert.deepEqual([...main.children].map(node=>node.dataset.storeSection),['reviews','categories','hero','benefits']);
 for(const id of ['reviews','benefits']){const node=main.querySelector(`[data-store-section="${id}"]`);assert.equal(node.hidden,true);assert.equal(node.dataset.settingsDisabled,'true');}
 assert.equal(main.querySelector('[data-store-section="categories"]').hidden,false);assert.equal(d.querySelectorAll('script,img,b').length,0);
});

test('Product section order keeps purchasing first, hides disabled sections and removes their jump controls',t=>{
 const dom=new JSDOM('<main><article class="product-story"><section class="story-hero"><button data-story-scroll="productReviews">Reviews</button><button data-story-scroll="storyFaq">Questions</button><button data-aqua-jump>Video</button></section><nav class="story-section-nav"><button data-story-scroll="storyTexture">About</button></nav><section id="storyTexture"></section><section id="storyFit"></section><section id="storyHow"></section><section id="storyVideos"></section><section id="productReviews"></section><section id="storyFaq"></section><section id="detailRecommendations"></section><section class="story-last-cta"></section><div data-story-sticky></div></article></main>');t.after(()=>dom.window.close());
 const d=dom.window.document,configured=settings({productSections:[{id:'faq',enabled:true},{id:'media',enabled:false},{id:'hero',enabled:false},{id:'reviews',enabled:false},{id:'about',enabled:true}]});
 applyProductSections(d.querySelector('main'),configured);
 const article=d.querySelector('.product-story');assert.deepEqual([...article.children].filter(node=>node.dataset.storeSection).map(node=>node.dataset.storeSection),configured.productSections.map(row=>row.id));
 assert.equal(article.firstElementChild.className,'story-hero');assert.equal(article.firstElementChild.hidden,false);assert.ok(article.lastElementChild.hasAttribute('data-story-sticky'));
 assert.equal(d.querySelector('#storyVideos').hidden,true);assert.equal(d.querySelector('#productReviews').hidden,true);
 assert.equal(d.querySelector('[data-story-scroll="productReviews"]').hidden,true);assert.equal(d.querySelector('[data-aqua-jump]').hidden,true);
 assert.equal(d.querySelector('[data-story-scroll="storyFaq"]').hidden,false);assert.equal(d.querySelector('[data-story-scroll="storyTexture"]').hidden,false);
 assert.equal(configured.productSections.length,Object.keys(PRODUCT_SECTIONS).length);
});

async function editor(t,initial={}){
 const f=fixture(t),admin=await adminClient(f),requests=[];
 f.sql.prepare("UPDATE site_settings SET config_json=? WHERE id='storefront'").run(JSON.stringify(settings(initial)));
 const dom=new JSDOM('<section id="siteSection"></section>');t.after(()=>dom.window.close());
 const root=dom.window.document;
 const manager=createSiteSettingsManager({root,getProducts:()=>products,call:async(path,method,body)=>{
  assert.equal(path,'site-settings');requests.push({method:method||'GET',body:clone(body)});
  const response=await admin(method||'GET',body),data=await response.json();if(!response.ok)throw Error(data.error);return data;
 }});
 await manager.load();return {f,root,w:dom.window,manager,requests,admin};
}
const productRows=root=>[...root.querySelectorAll('[data-product-place]')].map(node=>node.dataset.productPlace);
const setField=(root,name,value)=>{root.querySelector(`[name="${name}"]`).value=value;};

test('Admin draft filtering and product moves retain global positions and save all settings together',async t=>{
 const {f,root,w,requests}=await editor(t,{productOrder:['TS9003']});
 assert.deepEqual(productRows(root),['TS9003','TS9001','TS9002']);
 const search=root.querySelector('[data-order-search]');search.value='Beta';search.oninput({target:search});assert.deepEqual(productRows(root),['TS9002']);assert.equal(root.querySelector('[data-product-position]').value,'3');
 setField(root,'heroTitleEn','A draft title preserved while moving');
 root.querySelector('[data-product-move="TS9002"][data-step="-1"]').onclick();
 search.value='';search.oninput({target:search});assert.deepEqual(productRows(root),['TS9003','TS9002','TS9001']);
 root.querySelector('[data-product-position="TS9002"]').value='1';root.querySelector('[data-product-place="TS9002"]').onclick();assert.deepEqual(productRows(root),['TS9002','TS9003','TS9001']);
 const disabledHero=root.querySelector('[data-section-enabled="productSections"][data-section-id="hero"]');assert.equal(disabledHero.disabled,true);
 const reviews=root.querySelector('[data-section-enabled="homeSections"][data-section-id="reviews"]');reviews.checked=false;reviews.onchange();
 root.querySelector('[data-section-move="homeSections"][data-section-id="reviews"][data-step="-1"]').onclick();
 const media=root.querySelector('[data-section-enabled="productSections"][data-section-id="media"]');media.checked=false;media.onchange();
 root.querySelector('[data-section-move="productSections"][data-section-id="about"][data-step="-1"]').onclick();
 setField(root,'desktopColumns','3');setField(root,'mobileColumns','1');setField(root,'storeName','My edited shop');setField(root,'privacyAr','سياسة عربية مستقلة');setField(root,'privacyEn','Independent English policy');
 assert.equal(requests.filter(request=>request.method==='POST').length,0);assert.equal(f.stored().revision,1,'draft moves do not publish automatically');
 await root.querySelector('[data-site-form]').onsubmit(new w.Event('submit',{cancelable:true}));
 const saved=JSON.parse(f.stored().config_json);assert.equal(f.stored().revision,2);assert.deepEqual(saved.productOrder,['TS9002','TS9003','TS9001']);
 assert.equal(saved.storeName,'My edited shop');assert.equal(saved.heroTitleEn,'A draft title preserved while moving');assert.equal(saved.privacyAr,'سياسة عربية مستقلة');assert.equal(saved.privacyEn,'Independent English policy');
 assert.equal(saved.desktopColumns,3);assert.equal(saved.mobileColumns,1);assert.equal(saved.homeSections.find(row=>row.id==='reviews').enabled,false);assert.ok(saved.homeSections.findIndex(row=>row.id==='reviews')<saved.homeSections.findIndex(row=>row.id==='deals'));
 assert.deepEqual(saved.productSections.slice(0,2).map(row=>row.id),['hero','about']);assert.equal(saved.productSections.find(row=>row.id==='media').enabled,false);
 assert.equal(requests.filter(request=>request.method==='POST').length,1);assert.match(root.querySelector('[data-site-status]').textContent,/حُفظت/);
 await root.querySelector('[data-site-undo]').onclick();assert.equal(f.stored().revision,3);assert.deepEqual(JSON.parse(f.stored().config_json).productOrder,['TS9003']);assert.equal(root.querySelector('[name="storeName"]').value,DEFAULT_SITE_SETTINGS.storeName);assert.match(root.querySelector('[data-site-status]').textContent,/استُعيدت/);
});

test('The admin editor keeps markup literal and preserves unsaved text after a revision conflict',async t=>{
 const markup='</textarea><script>window.settingsExecuted=true</script><img src=x onerror=alert(1)>';
 const {f,root,w,admin}=await editor(t,{heroTextAr:markup,privacyEn:markup});
 assert.equal(root.querySelector('[name="heroTextAr"]').value,markup);assert.equal(root.querySelector('[name="privacyEn"]').value,markup);assert.equal(root.querySelectorAll('script,img[onerror]').length,0);
 setField(root,'storeName','My unsaved draft');
 await jsonOk(await admin('POST',{revision:1,settings:settings({storeName:'Another tab saved'})}));
 await root.querySelector('[data-site-form]').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal(f.stored().revision,2);assert.equal(JSON.parse(f.stored().config_json).storeName,'Another tab saved');assert.equal(root.querySelector('[name="storeName"]').value,'My unsaved draft');assert.equal(root.querySelector('[data-site-save]').disabled,false);assert.match(root.querySelector('[data-site-status]').textContent,/تعديل أحدث/);
 await root.querySelector('[data-site-reload]').onclick();assert.equal(root.querySelector('[name="storeName"]').value,'Another tab saved');
});

for(const language of ['ar','en'])test(`The actual ${language} privacy route renders saved paragraphs as literal text`,async t=>{
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM(read('public/index.html'),{url:'https://trend.test/?lang='+language+'#/privacy',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,markup='<script>window.settingsExecuted=true</script><img src=x onerror=alert(1)>',copy={ar:'سياسة خاصة\nسطر ثانٍ\n\n'+markup,en:'Private terms\nSecond line\n\n'+markup};
 const configured=settings({privacyAr:copy.ar,privacyEn:copy.en});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async url=>({ok:true,json:async()=>String(url).split('?')[0]==='/api/catalog'?{products:[],promotions:[],storeLive:false,siteSettings:configured}:{}});
 w.eval(storefrontBundle);
 for(let i=0;i<40&&!d.querySelector('.privacy p');i++)await new Promise(resolve=>setTimeout(resolve,5));
 const privacy=d.querySelector('.privacy');assert.ok(privacy);assert.equal(privacy.querySelectorAll('p').length,2);assert.equal(privacy.querySelectorAll('br').length,1);assert.equal(privacy.querySelectorAll('script,img').length,0);assert.equal(privacy.lastElementChild.textContent,markup);assert.equal(privacy.firstElementChild.textContent,copy[language].split('\n\n')[0].replace('\n',''));assert.equal(w.settingsExecuted,undefined);assert.deepEqual(errors.map(error=>error.message),[]);
});

test('Owner image overrides reject unsafe paths and save and restore with the existing authenticated revision flow',async t=>{
 const path='/media/uploads/2026-11/12345678-1234-1234-1234-123456789abc.jpg';
 for(const siteImages of [{hero:'https://foreign.test/x.jpg'},{hero:'javascript:alert(1)'},{hero:'/images/../admin.html'},{hero:'/images/%2e%2e/x.jpg'},{hero:'/images/x.jpg?tracking=1'},{hero:'//foreign.test/x.jpg'},{unknown:'/images/x.webp'},[],null]){
  assert.throws(()=>settings({siteImages}));
 }
 const f=fixture(t),admin=await adminClient(f),initial=(await jsonOk(await admin())).settings;
 const draft={...initial,siteImages:{koreanCard:path,hero:'/images/editorial/skincare-ritual.webp'}};delete draft.revision;
 await jsonOk(await admin('POST',{revision:1,settings:draft}));
 const saved=(await jsonOk(await admin())).settings;assert.equal(saved.siteImages.koreanCard,path);
 assert.equal(saved.heroTitleAr,initial.heroTitleAr);assert.equal(saved.productSections.length,initial.productSections.length);
 const catalog=await jsonOk(await worker.fetch(new Request('https://trend.test/api/catalog'),f.env,{}));assert.equal(catalog.siteSettings.siteImages.hero,draft.siteImages.hero);
 await jsonOk(await admin('POST',{action:'restore',revision:2,restoreRevision:1}));assert.deepEqual((await jsonOk(await admin())).settings.siteImages,{});
 assert.equal(f.sql.prepare('SELECT count(*) n FROM orders').get().n,0);
});

test('Image upload stays in the owner draft, retains text, saves once and can restore the approved image',async t=>{
 const dom=new JSDOM('<section id="siteSection"></section>');t.after(()=>dom.window.close());const root=dom.window.document,posts=[];
 let stored={...clone(DEFAULT_SITE_SETTINGS),revision:3},release;const pending=new Promise(resolve=>release=resolve);
 const manager=createSiteSettingsManager({root,getProducts:()=>products,uploadImage:()=>pending,call:async(path,method,body)=>{if(method==='POST'){posts.push(body);stored={...clone(body.settings),revision:4};return {ok:true}}return {settings:stored,history:[]}}});
 await manager.load();manager.focus('images');assert.equal(root.querySelector('[data-site-panel=images]').open,true);
 setField(root,'heroTitleEn','Keep this unsaved heading');
 const input=root.querySelector('[data-site-image-file=koreanCard]');Object.defineProperty(input,'files',{value:[{name:'phone.jpg',size:10}]});const upload=input.onchange();
 assert.equal(root.querySelector('[data-site-save]').disabled,true);await root.querySelector('[data-site-form]').onsubmit(new dom.window.Event('submit',{cancelable:true}));assert.equal(posts.length,0);
 const path='/media/uploads/2026-11/12345678-1234-1234-1234-123456789abc.jpg';release(path);await upload;
 assert.equal(posts.length,0);assert.equal(root.querySelector('[data-image-preview=koreanCard]').getAttribute('src'),path);
 assert.equal(root.querySelector('[name=heroTitleEn]').value,'Keep this unsaved heading');
 await root.querySelector('[data-site-form]').onsubmit(new dom.window.Event('submit',{cancelable:true}));assert.equal(posts.length,1);assert.equal(posts[0].settings.siteImages.koreanCard,path);assert.equal(posts[0].settings.heroTitleEn,'Keep this unsaved heading');
 root.querySelector('[data-site-image-reset=koreanCard]').click();assert.match(root.querySelector('[data-image-preview=koreanCard]').getAttribute('src'),/korean-care-brands-card-v552/);assert.equal(posts.length,1);
});
