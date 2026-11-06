import {readLimitedBody} from './media.js';
import {MAX_VIDEO_BYTES,sniffVideo,videoRange,videoSlice} from './product-videos.js';

const PRODUCT_ID='TS0098';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const publicRow=row=>row?{id:row.id,productId:row.product_id,url:'/product-feature-videos/'+row.id,mime:row.mime,bytes:row.size}:null;

export async function publicFeaturedVideo(request,env,{json,error}){
 if(new URL(request.url).searchParams.get('product')!==PRODUCT_ID)return error('المنتج غير موجود',404);
 const row=await env.DB.prepare('SELECT v.* FROM product_featured_videos v JOIN products p ON p.id=v.product_id WHERE v.product_id=? AND p.active=1 AND p.approved=1').bind(PRODUCT_ID).first();
 return json({video:publicRow(row)});
}

export async function adminFeaturedVideo(request,env,{json,error,sameOrigin,throttle,content}){
 if(request.method==='GET'){
  if(new URL(request.url).searchParams.get('product')!==PRODUCT_ID)return error('الفيديو العلوي مخصص لأرينسيا',404);
  const row=await env.DB.prepare('SELECT * FROM product_featured_videos WHERE product_id=?').bind(PRODUCT_ID).first();
  return json({video:publicRow(row),maxVideos:1,maxBytes:MAX_VIDEO_BYTES});
 }
 if(!sameOrigin(request)||request.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
 if(request.headers.get('content-type')?.startsWith('application/json')){
  let data;try{data=await content(request)}catch{return error('بيانات غير صالحة')}
  if(data.action!=='remove'||data.productId!==PRODUCT_ID||!UUID.test(data.id||''))return error('اختاري الفيديو العلوي والإجراء الصحيح');
  const row=await env.DB.prepare('SELECT * FROM product_featured_videos WHERE product_id=? AND id=?').bind(PRODUCT_ID,data.id).first();
  if(!row)return error('تغير الفيديو؛ أعيدي فتح المنتج',409);
  const result=await env.DB.prepare('DELETE FROM product_featured_videos WHERE product_id=? AND id=?').bind(PRODUCT_ID,data.id).run();
  if(Number(result.meta?.changes)!==1)return error('تغير الفيديو؛ أعيدي فتح المنتج',409);
  await env.MEDIA?.delete(row.media_key).catch(()=>{});
  return json({ok:true});
 }
 if(!env.MEDIA)return error('رفع الفيديو غير متاح مؤقتًا',503);
 if(!(await throttle(request,env,'featured-video-upload',12,900)))return error('تم تجاوز عدد المحاولات؛ حاولي لاحقًا',429);
 const type=request.headers.get('content-type')||'';
 if(!type.startsWith('multipart/form-data;'))return error('اختاري ملف فيديو');
 let form;try{const bytes=await readLimitedBody(request,MAX_VIDEO_BYTES+65536);form=await new Response(bytes,{headers:{'content-type':type}}).formData()}catch(e){return error(e.message==='TOO_LARGE'?'الحد الأقصى للفيديو 20 ميغابايت':'تعذر قراءة الفيديو',e.message==='TOO_LARGE'?413:400)}
 if(form.get('product')!==PRODUCT_ID)return error('الفيديو العلوي مخصص لأرينسيا');
 const product=await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(PRODUCT_ID).first();
 if(!product)return error('المنتج غير موجود',404);
 const file=form.get('video'),replaceId=form.get('replaceId')||'';
 if(replaceId&&!UUID.test(replaceId))return error('أعيدي فتح المنتج قبل استبدال الفيديو');
 const previous=await env.DB.prepare('SELECT * FROM product_featured_videos WHERE product_id=?').bind(PRODUCT_ID).first();
 if((previous?.id||'')!==replaceId)return error('يوجد مكان لفيديو واحد فقط؛ أعيدي فتح المنتج ثم اختاري استبدال الفيديو',409);
 if(!file||typeof file.arrayBuffer!=='function'||file.size<24)return error('اختاري فيديو MP4 أو MOV أو WebM');
 if(file.size>MAX_VIDEO_BYTES)return error('الحد الأقصى للفيديو 20 ميغابايت',413);
 const bytes=new Uint8Array(await file.arrayBuffer()),format=sniffVideo(bytes);
 if(!format||file.type&&!['video/mp4','video/quicktime','video/webm','application/octet-stream'].includes(file.type))return error('صيغة غير مدعومة. استخدمي MP4 أو MOV أو WebM',415);
 const id=crypto.randomUUID(),key=`product-feature-videos/${PRODUCT_ID}/${id}.${format.ext}`;
 await env.MEDIA.put(key,bytes,{metadata:{contentType:format.mime,size:bytes.length}});
 try{
  // The UNIQUE product_id and conditional upsert also guard simultaneous uploads/replacements.
  const result=await env.DB.prepare("INSERT INTO product_featured_videos(id,product_id,media_key,mime,size) VALUES(?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET id=excluded.id,media_key=excluded.media_key,mime=excluded.mime,size=excluded.size,updated_at=datetime('now') WHERE product_featured_videos.id=?").bind(id,PRODUCT_ID,key,format.mime,bytes.length,replaceId).run();
  if(Number(result.meta?.changes)!==1){await env.MEDIA.delete(key).catch(()=>{});return error('تغير الفيديو أثناء الرفع؛ أعيدي فتح المنتج',409)}
 }catch(e){await env.MEDIA.delete(key).catch(()=>{});throw e}
 if(previous)await env.MEDIA.delete(previous.media_key).catch(()=>{});
 return json({ok:true,video:publicRow({id,product_id:PRODUCT_ID,mime:format.mime,size:bytes.length})},201);
}

export async function serveFeaturedVideo(request,env,id,{admin=false}={}){
 const headers={'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'cache-control':'private, no-store'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
 if(!UUID.test(id)||!env.DB||!env.MEDIA)return new Response(null,{status:404,headers});
 const row=await env.DB.prepare('SELECT v.*,p.active product_active,p.approved FROM product_featured_videos v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.product_id=?').bind(id,PRODUCT_ID).first();
 if(!row||!admin&&(!row.product_active||!row.approved))return new Response(null,{status:404,headers});
 const range=videoRange(request.method==='GET'?request.headers.get('range'):null,row.size);
 if(!range)return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+row.size}});
 const responseHeaders={...headers,'content-type':row.mime,'accept-ranges':'bytes','content-length':String(range.end-range.start+1),...(range.status===206?{'content-range':`bytes ${range.start}-${range.end}/${row.size}`}:{})};
 if(request.method==='HEAD')return new Response(null,{status:range.status,headers:responseHeaders});
 const stream=await env.MEDIA.get(row.media_key,'stream');
 if(!stream)return new Response(null,{status:404,headers});
 return new Response(range.status===200?stream:videoSlice(stream,range.start,range.end),{status:range.status,headers:responseHeaders});
}
