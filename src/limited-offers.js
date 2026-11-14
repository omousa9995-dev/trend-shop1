import {applyLimitedOffers} from '../public/limited-offers.js';
import {isRetiredProduct} from '../public/catalog-policy.js';
import {PRODUCT_TYPES} from '../public/product-types.js';
import {isKoreanCare} from '../public/korean-care.js';
export {applyLimitedOffers};
const idPattern=/^TS[A-Z0-9-]{4,64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const clean=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
const normalize=o=>({slot:o.slot,productId:o.product_id,priceFils:o.price_fils,startsAt:o.starts_at,endsAt:o.ends_at,active:o.active===1,revision:o.revision,updatedAt:o.updated_at});
export async function loadLimitedOffers(env,{admin=false}={}){
 try{
  const result=await env.DB.prepare(admin?'SELECT * FROM limited_offers ORDER BY slot':"SELECT o.* FROM limited_offers o JOIN products p ON p.id=o.product_id WHERE o.active=1 AND o.ends_at>CAST(strftime('%s','now') AS INTEGER) AND p.active=1 AND p.approved=1 AND p.stock>0 ORDER BY o.slot").all();
  return (result.results||[]).filter(o=>!isRetiredProduct(o.product_id)).map(normalize);
 }catch(error){if(/no such table.*limited_offers/i.test(error.message||''))return [];throw error}
}
function newProduct(raw,requestId){
 const id='TS'+requestId.replace(/-/g,'').slice(0,12).toUpperCase(),name=clean(raw.name,160),nameAr=clean(raw.nameAr,160),brand=clean(raw.brand,80),category=clean(raw.category,30),type=PRODUCT_TYPES.find(t=>t.id===raw.productType&&t.category===category),price=raw.regularPriceFils,stock=raw.stock,image=clean(raw.image,400);
 if(!name||!nameAr||!brand||!type||!Number.isInteger(price)||price<500||price>20000||price%10||!Number.isInteger(stock)||stock<0||stock>100000||!/^\/(?:images|media\/uploads)\/[A-Za-z0-9_./-]+$/.test(image)||image.split('/').some(p=>p==='..'||p==='.')||image.endsWith('.svg'))throw Error('راجعي اسم المنتج والماركة والتصنيف والصورة والسعر والكمية.');
 const korean=typeof raw.koreanCare==='boolean'?raw.koreanCare:isKoreanCare({brand});
 const details={nameAr,tagline:clean(raw.tagline,180),productType:type.id,size:clean(raw.size,80),collection:korean?'k-beauty':'beauty',koreanCare:korean,imageType:'photo',featuredOrder:100,benefits:[],howToUse:clean(raw.howToUse,1500),notes:clean(raw.notes,1200),en:{name,description:clean(raw.descriptionEn,1200)},contentVersion:'5.21.0',intakeBatch:'limited-offers'};
 return {id,name,brand,category,subcategory:type.label,description:clean(raw.description,1200),details_json:JSON.stringify(details),price_fils:price,reference_price_fils:price,stock,image_url:image};
}
export async function adminLimitedOffers(req,env,{json,error,sameOrigin,content}){
 if(req.method==='GET')return json({offers:await loadLimitedOffers(env,{admin:true}),serverTime:Date.now()});
 if(!sameOrigin(req)||req.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
 let b;try{b=await content(req,24000)}catch{return error('بيانات العرض غير صالحة.');}
 if(!Number.isInteger(b.slot)||b.slot<1||b.slot>3||!Number.isInteger(b.revision)||b.revision<0||!uuid.test(b.requestId||''))return error('حدّثي بطاقة العرض ثم أعيدي المحاولة.');
 const previous=await env.DB.prepare('SELECT * FROM limited_offers WHERE slot=?').bind(b.slot).first();
 if(previous?.request_id===b.requestId)return json({ok:true,productId:previous.product_id,revision:previous.revision,duplicate:true});
 if((previous?.revision||0)!==b.revision)return error('سبقك تعديل آخر لهذه البطاقة. حدّثي العروض قبل الحفظ.',409);
 if(b.action==='stop'){
  if(!previous)return error('البطاقة فارغة.',404);
  const saved=await env.DB.prepare("UPDATE limited_offers SET active=0,revision=revision+1,request_id=?,updated_at=datetime('now') WHERE slot=? AND revision=?").bind(b.requestId,b.slot,b.revision).run();
  return Number(saved.meta?.changes)===1?json({ok:true,productId:previous.product_id}):error('تغيّرت البطاقة؛ حدّثي القائمة.',409);
 }
 const now=Math.floor(Date.now()/1000);
 if(!Number.isInteger(b.priceFils)||b.priceFils<500||b.priceFils>20000||b.priceFils%10||!Number.isInteger(b.startsAt)||!Number.isInteger(b.endsAt)||b.startsAt<0||b.endsAt<=Math.max(now,b.startsAt)||b.endsAt>4102444800||typeof b.active!=='boolean')return error('حددي سعر العرض ووقت البداية والنهاية الصحيحين بتوقيت الأردن.');
 let product;
 if(b.product){try{product=newProduct(b.product,b.requestId)}catch(e){return error(e.message)}
  if(await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(product.id).first())return error('هذا الطلب أضاف المنتج مسبقًا؛ حدّثي قائمة العروض.',409);
 }else{
  if(!idPattern.test(b.productId||'')||isRetiredProduct(b.productId))return error('اختاري منتجًا صالحًا.');
  product=await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(b.productId).first();
  if(!product||!product.active||!product.approved)return error('اعتمدي المنتج وأظهريه في المتجر قبل إضافته إلى العرض.');
 }
 if(b.priceFils>=product.price_fils)return error('سعر العرض يجب أن يكون أقل من سعر البيع العادي للمنتج.');
 const occupied=await env.DB.prepare('SELECT slot FROM limited_offers WHERE product_id=? AND slot<>?').bind(product.id,b.slot).first();
 if(occupied)return error('هذا المنتج موجود في بطاقة أخرى؛ عدّلي بطاقته الحالية.');
 const writes=[];
 if(b.product){
  // The revision guard and both writes execute in one D1 transaction. A stale
  // slot cannot leave an orphan product behind. A constraint abort rolls back both.
  writes.push(env.DB.prepare(`INSERT INTO products(id,name,brand,category,subcategory,description,details_json,reference_price_fils,price_fils,discount_percent,image_url,stock,approved,active,source_url,source_shop) SELECT ?,?,?,?,?,?,?,?,?,0,?,?,1,1,?,'Owner limited offer' WHERE COALESCE((SELECT revision FROM limited_offers WHERE slot=?),0)=?`).bind(product.id,product.name,product.brand,product.category,product.subcategory,product.description,product.details_json,product.price_fils,product.price_fils,product.image_url,product.stock,'limited-offer-request:'+b.requestId,b.slot,b.revision));
 }
 const sourceGuard=b.product?" AND EXISTS(SELECT 1 FROM products WHERE id=? AND source_url=?)":" AND EXISTS(SELECT 1 FROM products WHERE id=? AND active=1 AND approved=1 AND price_fils>?)";
 const args=[b.slot,product.id,b.priceFils,b.startsAt,b.endsAt,b.active?1:0,b.requestId,b.slot,b.revision,product.id,b.product?'limited-offer-request:'+b.requestId:b.priceFils,b.revision];
 writes.push(env.DB.prepare(`INSERT INTO limited_offers(slot,product_id,price_fils,starts_at,ends_at,active,request_id,revision) SELECT ?,?,?,?,?,?,?,1 WHERE COALESCE((SELECT revision FROM limited_offers WHERE slot=?),0)=?${sourceGuard} ON CONFLICT(slot) DO UPDATE SET product_id=excluded.product_id,price_fils=excluded.price_fils,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,request_id=excluded.request_id,revision=limited_offers.revision+1,updated_at=datetime('now') WHERE limited_offers.revision=?`).bind(...args));
 try{const result=await env.DB.batch(writes);if(Number(result.at(-1).meta?.changes)!==1)return error('تغيّر المنتج أو البطاقة؛ حدّثي القائمة قبل الحفظ.',409)}catch{return error('تعذّر حفظ العرض. حدّثي القائمة وتحققي من عدم تكرار المنتج.',409)}
 return json({ok:true,productId:product.id,createdProduct:!!b.product,revision:b.revision+1});
}
