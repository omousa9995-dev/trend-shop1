import {PRODUCT_MEDIA_BASELINE} from './product-media-baseline.js';
import {isRetiredProduct} from '../public/catalog-policy.js';
import {readLimitedBody,sniffImage,MAX_IMAGE_BYTES} from './media.js';

export const MAX_PRODUCT_PHOTOS=24;
export const PHOTO_PLACEHOLDER='/images/TS0001.svg';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const validProduct=id=>/^TS[A-Z0-9-]{4,64}$/.test(id||'')&&!isRetiredProduct(id);
export function validPhotoUrl(url){
 if(typeof url!=='string'||url.length>400)return false;
 if(/^\/(?:images|media)\/[A-Za-z0-9_./-]+$/.test(url))return !url.split('/').some(x=>x==='.'||x==='..');
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}
}
function cleanPhotos(photos){return (Array.isArray(photos)?photos:[]).filter(x=>x&&validPhotoUrl(x.url)).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).slice(0,MAX_PRODUCT_PHOTOS)}
function defaults(product){
 let details;try{details=JSON.parse(product.details_json||'{}')}catch{details={}}
 return cleanPhotos([...(PRODUCT_MEDIA_BASELINE[product.id]||[{url:product.image_url||PHOTO_PLACEHOLDER,kind:'pack'}]),...(Array.isArray(details.gallery)?details.gallery:[]).map(url=>({url,kind:'pack'}))]);
}
const publicPhotos=photos=>photos.map(({url,kind,label,thumbnail})=>({url,kind:kind||'pack',...(label?{label}:{}),...(validPhotoUrl(thumbnail)?{thumbnail}:{})}));
function mediaState(product,row){return {productId:product.id,card:product.image_url||PHOTO_PLACEHOLDER,photos:row?cleanPhotos(JSON.parse(row.photos_json)):defaults(product),revision:row?.revision||0}}
async function readState(env,product){const row=await env.DB.prepare('SELECT * FROM product_photo_galleries WHERE product_id=?').bind(product.id).first();return mediaState(product,row)}
export async function withProductPhotos(products,env){
 let rows;try{rows=await env.DB.prepare('SELECT * FROM product_photo_galleries').all()}catch(e){if(/no such table.*product_photo_galleries/i.test(e.message||''))return products;throw e}
 const byId=new Map((rows.results||[]).map(x=>[x.product_id,x]));
 return products.map(p=>({...p,galleryPhotos:publicPhotos(mediaState(p,byId.get(p.id)).photos)}));
}
export async function preserveProductPhotos(env,id,nextCard){
 const p=await env.DB.prepare('SELECT id,image_url,details_json FROM products WHERE id=?').bind(id).first();
 if(!p||p.image_url===nextCard)return;
 await env.DB.prepare('INSERT OR IGNORE INTO product_photo_galleries(product_id,photos_json,revision,change_token) VALUES(?,?,1,?)').bind(id,JSON.stringify(defaults(p)),crypto.randomUUID()).run();
}
async function saveState(env,state,photos,{removeCard=false}={}){
 const token=crypto.randomUUID(),revision=state.revision+1;
 // A unique token links the conditional card update to this exact gallery write.
 const update=env.DB.prepare(`INSERT INTO product_photo_galleries(product_id,photos_json,revision,change_token) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM products WHERE id=? AND image_url=?) ON CONFLICT(product_id) DO UPDATE SET photos_json=excluded.photos_json,revision=excluded.revision,change_token=excluded.change_token,updated_at=datetime('now') WHERE product_photo_galleries.revision=?`).bind(state.productId,JSON.stringify(photos),revision,token,state.productId,state.card,state.revision);
 const statements=[update];
 if(removeCard)statements.push(env.DB.prepare("UPDATE products SET image_url=?,updated_at=datetime('now') WHERE id=? AND image_url=? AND EXISTS(SELECT 1 FROM product_photo_galleries WHERE product_id=? AND change_token=?)").bind(PHOTO_PLACEHOLDER,state.productId,state.card,state.productId,token));
 const results=await env.DB.batch(statements);
 return Number(results[0].meta?.changes)===1;
}
export async function adminProductPhotos(request,env,{json,error,sameOrigin,content,throttle}){
 const url=new URL(request.url);let data;
 const multipart=request.headers.get('content-type')?.startsWith('multipart/form-data;');
 if(request.method!=='GET'&&(!sameOrigin(request)||request.headers.get('x-trend-admin')!=='1'))return error('غير مصرح',403);
 if(request.method==='GET')data={productId:url.searchParams.get('product')};
 else if(multipart){
  if(!env.MEDIA)return error('رفع الصور غير متاح مؤقتًا',503);
  if(!(await throttle(request,env,'product-photo-upload',100,900)))return error('ارفعي بقية الصور بعد قليل',429);
  try{const bytes=await readLimitedBody(request,MAX_IMAGE_BYTES+65536);const f=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')}}).formData();data={productId:f.get('product'),uploadId:f.get('uploadId'),file:f.get('image')}}catch(e){return error(e.message==='TOO_LARGE'?'الصورة أكبر من الحجم المسموح':'تعذر قراءة الصورة',e.message==='TOO_LARGE'?413:400)}
 }else{try{data=await content(request)}catch{return error('بيانات غير صالحة')}}
 if(!validProduct(data.productId))return error('احفظ المنتج أولًا ثم أضف صور الصفحة',404);
 const product=await env.DB.prepare('SELECT id,image_url,details_json FROM products WHERE id=?').bind(data.productId).first();
 if(!product)return error('المنتج غير موجود',404);
 const state=await readState(env,product);
 const result=()=>json({...state,photos:publicPhotos(state.photos),maxPhotos:MAX_PRODUCT_PHOTOS});
 if(request.method==='GET')return result();
 if(multipart){
  if(!UUID.test(data.uploadId||''))return error('أعد اختيار الصورة');
  if(state.photos.some(x=>x.uploadId===data.uploadId))return result();
  if(state.photos.length>=MAX_PRODUCT_PHOTOS)return error('يمكن حفظ 24 صورة في صفحة كل منتج؛ أزل صورة لإضافة بديل',409);
  const file=data.file;if(!file||typeof file.arrayBuffer!=='function'||file.size<12||file.size>MAX_IMAGE_BYTES)return error('اختر صورة JPEG أو PNG أو WebP ضمن الحجم المسموح',413);
  const bytes=new Uint8Array(await file.arrayBuffer()),mime=sniffImage(bytes),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
  if(!ext||file.type!==mime)return error('صيغة الصورة غير مدعومة؛ اختر JPEG أو PNG أو WebP',415);
  const key='uploads/'+new Date().toISOString().slice(0,7)+'/'+crypto.randomUUID()+'.'+ext;
  await env.MEDIA.put(key,bytes,{metadata:{contentType:mime,size:bytes.length}});
  const photos=[...state.photos,{url:'/media/'+key,kind:'pack',uploadId:data.uploadId}];
  try{if(!await saveState(env,state,photos)){await env.MEDIA.delete(key).catch(()=>{});return error('تغيرت الصور أثناء الرفع؛ حدّث القائمة للتحقق ثم أعد المحاولة',409)}}catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
  state.photos=photos;state.revision++;return result();
 }
 if(!Number.isInteger(data.revision)||data.revision!==state.revision)return error('تغيرت الوسائط؛ حدّث القائمة قبل التعديل',409);
 let photos=state.photos,removeCard=false;
 if(data.action==='remove'&&['gallery','card','all'].includes(data.scope)&&validPhotoUrl(data.url)){
  if(!photos.some(x=>x.url===data.url)&&state.card!==data.url)return error('الصورة غير موجودة لهذا المنتج',404);
  if(data.scope!=='card')photos=photos.filter(x=>x.url!==data.url);
  removeCard=data.scope!=='gallery'&&state.card===data.url;
  if(data.scope!=='gallery'&&data.expectedCard!==state.card)return error('تغيرت صورة البطاقة؛ حدّث القائمة',409);
 }else if(data.action==='reorder'&&Array.isArray(data.urls)&&data.urls.length===photos.length&&new Set(data.urls).size===photos.length&&data.urls.every(u=>photos.some(x=>x.url===u))){photos=data.urls.map(u=>photos.find(x=>x.url===u))}
 else return error('اختر الصورة والإجراء الصحيح');
 if(!await saveState(env,state,photos,{removeCard}))return error('تغيرت الوسائط؛ حدّث القائمة قبل التعديل',409);
 state.photos=photos;state.revision++;if(removeCard)state.card=PHOTO_PLACEHOLDER;return result();
}
export async function adminMediaLibrary(request,env,{json}){
 const [products,galleries,videos,featured]=await Promise.all([
  env.DB.prepare('SELECT id,name,brand,image_url,details_json,active FROM products ORDER BY updated_at DESC,id LIMIT 1000').all(),
  env.DB.prepare('SELECT * FROM product_photo_galleries').all(),
  env.DB.prepare('SELECT id,product_id,mime,size,active FROM product_videos ORDER BY sort_order,created_at,id').all(),
  env.DB.prepare('SELECT id,product_id,mime,size FROM product_featured_videos').all()
 ]);
 const byId=new Map(galleries.results.map(x=>[x.product_id,x]));
 const groups=products.results.filter(p=>!isRetiredProduct(p)).map(p=>{
  const state=mediaState(p,byId.get(p.id)),photos=new Map();
  if(state.card!==PHOTO_PLACEHOLDER)photos.set(state.card,{url:state.card,card:true,gallery:false});
  for(const ph of state.photos){const photo=photos.get(ph.url)||{url:ph.url,card:false,gallery:false,...(validPhotoUrl(ph.thumbnail)?{thumbnail:ph.thumbnail}:{})};photo.gallery=true;photos.set(ph.url,photo)}
  const clips=[...featured.results.filter(v=>v.product_id===p.id).map(v=>({...v,kind:'featured',url:'/product-feature-videos/'+v.id,active:true})),...videos.results.filter(v=>v.product_id===p.id).map(v=>({...v,kind:'video',url:'/product-videos/'+v.id,active:!!v.active}))].map(({id,kind,url,active,mime,size})=>({id,kind,url,active,mime,bytes:size}));
  return {productId:p.id,name:p.name,brand:p.brand,active:!!p.active,card:state.card,revision:state.revision,photos:[...photos.values()],videos:clips};
 });
 return json({groups,totals:{photos:groups.reduce((n,g)=>n+g.photos.length,0),videos:groups.reduce((n,g)=>n+g.videos.length,0),products:groups.length}});
}
