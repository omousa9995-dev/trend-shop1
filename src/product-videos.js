import {readLimitedBody} from './media.js';
import {isRetiredProduct} from '../public/catalog-policy.js';
import {AQUA_FRESH_PILOT_ID,isAquaFreshPilot,validVideoPoster} from '../public/product-video-presentation.js';

export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_PRODUCT_VIDEOS = 3;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PRODUCT = /^TS[A-Z0-9-]{4,64}$/;
const text = (v,n=120) => typeof v==='string' ? v.trim().slice(0,n) : '';
const videoRow = r => ({id:r.id,productId:r.product_id,title:r.title,titleEn:r.title_en,url:'/product-videos/'+r.id,mime:r.mime,bytes:r.size,active:!!r.active,...(isAquaFreshPilot(r.product_id)?{poster:r.poster_url||'',sortOrder:Number(r.sort_order)||0}:{})});

export function sniffVideo(bytes) {
 if(bytes.length<24)return null;
 const chars=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(chars(4,8)==='ftyp'){
  const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
  if(size<16||size>Math.min(4096,bytes.length))return null;
  const brands=[chars(8,12)];for(let n=16;n+4<=size;n+=4)brands.push(chars(n,n+4));
  if(brands.some(b=>['avif','avis','heic','heix','mif1'].includes(b)))return null;
  if(brands.includes('qt  '))return {mime:'video/quicktime',ext:'mov'};
  if(brands.some(b=>/^(?:isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(b)))return {mime:'video/mp4',ext:'mp4'};
 }
 if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3&&chars(0,Math.min(bytes.length,4096)).includes('webm'))return {mime:'video/webm',ext:'webm'};
 return null;
}

export async function publicProductVideos(request,env,{json,error}) {
 const id=new URL(request.url).searchParams.get('product');
 if(!PRODUCT.test(id||'')||isRetiredProduct(id))return error('المنتج غير موجود',404);
 const rows=await env.DB.prepare('SELECT v.* FROM product_videos v JOIN products p ON p.id=v.product_id WHERE v.product_id=? AND v.active=1 AND p.active=1 AND p.approved=1 ORDER BY v.sort_order,v.created_at,v.id LIMIT 3').bind(id).all();
 return json({videos:(rows.results||[]).map(videoRow)});
}

export async function adminProductVideos(request,env,{json,error,sameOrigin,throttle,content}) {
 const url=new URL(request.url);
 if(request.method==='GET'){
  const product=url.searchParams.get('product');if(!PRODUCT.test(product||'')||isRetiredProduct(product))return error('اختاري منتجًا صالحًا');
  const rows=await env.DB.prepare('SELECT * FROM product_videos WHERE product_id=? ORDER BY sort_order,created_at,id LIMIT 100').bind(product).all();
  return json({videos:(rows.results||[]).map(videoRow),maxBytes:MAX_VIDEO_BYTES,maxVideos:MAX_PRODUCT_VIDEOS});
 }
 if(!sameOrigin(request)||request.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
 if(request.headers.get('content-type')?.startsWith('application/json')){
  let b;try{b=await content(request)}catch{return error('بيانات غير صالحة')}
  if(b.action==='reorder'){
   if((!isAquaFreshPilot(b.productId)||isRetiredProduct(b.productId))||!Array.isArray(b.ids)||!b.ids.length||b.ids.length>MAX_PRODUCT_VIDEOS||b.ids.some(id=>!UUID.test(id))||new Set(b.ids).size!==b.ids.length)return error('اختاري ترتيبًا صالحًا لفيديوهات المنتج');
   const rows=await env.DB.prepare('SELECT id FROM product_videos WHERE product_id=?').bind(b.productId).all();
   if(rows.results.length!==b.ids.length||rows.results.some(row=>!b.ids.includes(row.id)))return error('تغيرت القائمة؛ أعيدي فتح المنتج قبل ترتيب الفيديوهات',409);
   const cases=b.ids.map((_,index)=>'WHEN ? THEN '+index).join(' ');
   const placeholders=b.ids.map(()=>'?').join(',');
   const result=await env.DB.prepare("UPDATE product_videos SET sort_order=CASE id "+cases+" ELSE sort_order END,updated_at=datetime('now') WHERE product_id=? AND (SELECT count(*) FROM product_videos WHERE product_id=?)=? AND (SELECT count(*) FROM product_videos WHERE product_id=? AND id IN ("+placeholders+"))=?").bind(...b.ids,b.productId,b.productId,b.ids.length,b.productId,...b.ids,b.ids.length).run();
   if(Number(result.meta?.changes)!==b.ids.length)return error('تغيرت القائمة؛ أعيدي فتح المنتج قبل ترتيب الفيديوهات',409);
   return json({ok:true});
  }
  if(b.action==='presentation'){
   if(!UUID.test(b.id||'')||(!isAquaFreshPilot(b.productId)||isRetiredProduct(b.productId))||!validVideoPoster(b.poster)||typeof b.title!=='string'||typeof b.titleEn!=='string')return error('تحققي من عنوان الفيديو وصورة الغلاف');
   const row=await env.DB.prepare('SELECT product_id FROM product_videos WHERE id=?').bind(b.id).first();
   if(!row||row.product_id!==b.productId)return error('الفيديو غير موجود لهذا المنتج',404);
   await env.DB.prepare("UPDATE product_videos SET title=?,title_en=?,poster_url=?,updated_at=datetime('now') WHERE id=? AND product_id=?").bind(text(b.title),text(b.titleEn),b.poster,b.id,b.productId).run();
   return json({ok:true});
  }
  if(!UUID.test(b.id||'')||(typeof b.active!=='boolean'&&b.action!=='remove'))return error('اختاري الفيديو والإجراء الصحيح');
  const row=await env.DB.prepare('SELECT * FROM product_videos WHERE id=?').bind(b.id).first();if(!row||isRetiredProduct(row.product_id))return error('الفيديو غير موجود',404);
  if(b.action==='remove'){await env.DB.prepare('DELETE FROM product_videos WHERE id=?').bind(b.id).run();await env.MEDIA?.delete(row.media_key).catch(()=>{});return json({ok:true})}
  if(b.active){const product=await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(row.product_id).first();if(!product)return error('المنتج غير موجود',404);}
  await env.DB.prepare('UPDATE product_videos SET active=?,updated_at=datetime(\'now\') WHERE id=?').bind(b.active?1:0,b.id).run();
  return json({ok:true});
 }
 if(!env.MEDIA)return error('رفع الفيديو غير متاح مؤقتًا',503);
 if(!(await throttle(request,env,'product-video-upload',12,900)))return error('تم تجاوز عدد المحاولات؛ حاولي لاحقًا',429);
 const type=request.headers.get('content-type')||'';if(!type.startsWith('multipart/form-data;'))return error('اختاري ملف فيديو');
 let form;try{const bytes=await readLimitedBody(request,MAX_VIDEO_BYTES+65536);form=await new Response(bytes,{headers:{'content-type':type}}).formData()}catch(e){return error(e.message==='TOO_LARGE'?'الحد الأقصى للفيديو 20 ميغابايت':'تعذر قراءة الفيديو',e.message==='TOO_LARGE'?413:400)}
 const product=text(form.get('product'),70),file=form.get('video');
 if(!PRODUCT.test(product)||isRetiredProduct(product))return error('احفظي المنتج أولًا ثم ارفعي الفيديو');
 const row=await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(product).first();if(!row)return error('المنتج غير موجود',404);
 if(!file||typeof file.arrayBuffer!=='function'||file.size<24)return error('اختاري فيديو MP4 أو MOV أو WebM');
 if(file.size>MAX_VIDEO_BYTES)return error('الحد الأقصى للفيديو 20 ميغابايت',413);
 const count=await env.DB.prepare('SELECT count(*) n FROM product_videos WHERE product_id=?').bind(product).first();
 if(Number(count?.n)>=MAX_PRODUCT_VIDEOS)return error('يمكن حفظ ثلاثة فيديوهات لكل منتج؛ استخدمي الإخفاء والاستعادة للفيديوهات الحالية');
 const bytes=new Uint8Array(await file.arrayBuffer()),format=sniffVideo(bytes);
 if(!format||file.type&&!['video/mp4','video/quicktime','video/webm','application/octet-stream'].includes(file.type))return error('صيغة غير مدعومة. استخدمي MP4 أو MOV أو WebM',415);
 const id=crypto.randomUUID(),key=`product-videos/${product}/${id}.${format.ext}`;
 await env.MEDIA.put(key,bytes,{metadata:{contentType:format.mime,size:bytes.length}});
 try{
  await env.DB.prepare('INSERT INTO product_videos(id,product_id,media_key,mime,size,title,title_en) VALUES(?,?,?,?,?,?,?)').bind(id,product,key,format.mime,bytes.length,text(form.get('title')),text(form.get('titleEn'))).run();
 }catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
 return json({ok:true,video:{id,productId:product,url:'/product-videos/'+id,mime:format.mime,bytes:bytes.length,active:true}},201);
}

export function videoRange(value,size){
 if(!value)return {start:0,end:size-1,status:200};
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||!match[1]&&!match[2])return null;
 let start=0,end=size-1;
 if(!match[1]){const tail=Number(match[2]);if(!Number.isSafeInteger(tail)||tail<1)return null;start=Math.max(0,size-tail)}
 else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<size?{start,end,status:206}:null;
}

export async function serveProductVideo(request,env,id,{admin=false}={}){
 const headers={'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'cache-control':'private, no-store'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
 if(!UUID.test(id)||!env.DB||!env.MEDIA)return new Response(null,{status:404,headers});
 const row=await env.DB.prepare('SELECT v.*,p.active product_active,p.approved FROM product_videos v JOIN products p ON p.id=v.product_id WHERE v.id=?').bind(id).first();
 if(!row||isRetiredProduct(row.product_id)||!admin&&(!row.active||!row.product_active||!row.approved))return new Response(null,{status:404,headers});
 const range=videoRange(request.method==='GET'?request.headers.get('range'):null,row.size);if(!range)return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+row.size}});
 const responseHeaders={...headers,'content-type':row.mime,'accept-ranges':'bytes','content-length':String(range.end-range.start+1),...(range.status===206?{'content-range':`bytes ${range.start}-${range.end}/${row.size}`}:{})};
 if(request.method==='HEAD')return new Response(null,{status:range.status,headers:responseHeaders});
 const stream=await env.MEDIA.get(row.media_key,'stream');if(!stream)return new Response(null,{status:404,headers});
 return new Response(range.status===200?stream:videoSlice(stream,range.start,range.end),{status:range.status,headers:responseHeaders});
}

export function videoSlice(stream,start,end){
 const reader=stream.getReader();let position=0;
 return new ReadableStream({async pull(controller){try{while(true){const{value,done}=await reader.read();if(done){controller.close();return}const from=Math.max(0,start-position),to=Math.min(value.byteLength,end-position+1);position+=value.byteLength;if(to>from)controller.enqueue(value.subarray(from,to));if(position>end){await reader.cancel();controller.close();return}if(to>from)return}}catch(e){controller.error(e)}},cancel(reason){return reader.cancel(reason)}});
}
