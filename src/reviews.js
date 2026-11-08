import {isOrderId} from './order-management.js';
import {normalizeContactPhone} from '../public/contact-phone.js';
import {isRetiredProduct} from '../public/catalog-policy.js';
import {readLimitedBody,sniffImage,MAX_IMAGE_BYTES} from './media.js';
const validProduct=id=>/^TS[A-Z0-9-]{4,64}$/.test(id||'')&&!isRetiredProduct(id);
const validId=id=>/^[a-f0-9-]{36}$/.test(id||'');
const clean=(s,max)=>typeof s==='string'?s.normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,max):'';
export function safeReviewVideo(value){if(!value)return '';try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['youtube.com','www.youtube.com','youtu.be','www.instagram.com','instagram.com','www.facebook.com','facebook.com','www.tiktok.com','tiktok.com'].includes(u.hostname)?u.href.slice(0,500):''}catch{return ''}}
function constant(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
async function sign(env,payload,hmac){const data=btoa(JSON.stringify(payload)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return data+'.'+await hmac(env.SESSION_SECRET,'review:'+data)}
async function verify(env,token,hmac){try{const[data,signature]=String(token).split('.');if(!data||!signature||data.length>1000||!constant(signature,await hmac(env.SESSION_SECRET,'review:'+data)))return null;const p=JSON.parse(atob(data.replace(/-/g,'+').replace(/_/g,'/')));return p.exp>Date.now()&&p.exp<=Date.now()+16*60*1000&&isOrderId(p.orderId)?p:null}catch{return null}}
export async function publicReviews(request,env,{json,error}){
 const id=new URL(request.url).searchParams.get('product');if(id&&!validProduct(id))return error('غير موجود',404);
 const where="r.status='approved' AND o.status='تم' AND p.active=1 AND p.approved=1"+(id?' AND r.product_id=?':'');
 const sql=`SELECT r.id,r.product_id,r.display_name,r.rating,r.body,r.locale,r.video_url,r.created_at,o.governorate FROM reviews r JOIN orders o ON o.id=r.order_id JOIN products p ON p.id=r.product_id WHERE ${where} ORDER BY r.created_at DESC LIMIT 24`;
 const result=await (id?env.DB.prepare(sql).bind(id):env.DB.prepare(sql)).all();const rows=(result.results||[]).filter(r=>!isRetiredProduct(r.product_id));
 const media=rows.length?await env.DB.prepare(`SELECT id,review_id FROM review_media WHERE review_id IN (${rows.map(()=>'?').join(',')}) ORDER BY created_at`).bind(...rows.map(x=>x.id)).all():{results:[]};
 let summary={count:rows.length,average:rows.length?Number((rows.reduce((n,r)=>n+r.rating,0)/rows.length).toFixed(1)):null};
 if(id){const aggregate=await env.DB.prepare(`SELECT COUNT(*) AS count,AVG(r.rating) AS average FROM reviews r JOIN orders o ON o.id=r.order_id JOIN products p ON p.id=r.product_id WHERE ${where}`).bind(id).first();summary={count:aggregate?.count||0,average:aggregate?.average?Number(aggregate.average.toFixed(1)):null}}
 return json({reviews:rows.map(r=>({...r,verifiedPurchase:true,images:(media.results||[]).filter(m=>m.review_id===r.id).map(m=>'/review-media/'+m.id)})),summary});
}
export async function reviewAction(request,env,helpers,action){
 const {json,error,sameOrigin,throttle,content,hmac}=helpers;
 if(!sameOrigin(request)||!env.SESSION_SECRET)return error('غير مصرح',403);
 if(!(await throttle(request,env,'review-'+action,action==='verify'?6:12,900)))return error('انتظري قليلًا ثم حاولي مجددًا.',429,{code:'REVIEW_RATE_LIMIT'});
 let b;try{b=await content(request)}catch{return error('بيانات غير صالحة',400,{code:'REVIEW_INVALID'})}
 if(action==='verify'){
  const phone=normalizeContactPhone(b.phone),orderId=clean(b.orderId,60).toUpperCase();
  const order=phone&&isOrderId(orderId)?await env.DB.prepare("SELECT id,phone FROM orders WHERE id=? AND status='تم'").bind(orderId).first():null;
  if(!order||normalizeContactPhone(order.phone)!==phone)return error('تعذّر التحقق. استخدمي رقم الطلب والهاتف المسجّل معه، بعد اكتمال استلامه.',400,{code:'REVIEW_NOT_ELIGIBLE'});
  const items=await env.DB.prepare('SELECT oi.product_id AS id,oi.name_snapshot AS name,p.image_url AS image,p.details_json FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND p.active=1 AND p.approved=1').bind(orderId).all();
  return json({token:await sign(env,{orderId,exp:Date.now()+15*60*1000},hmac),products:(items.results||[]).filter(p=>validProduct(p.id))});
 }
 const capability=await verify(env,b.token,hmac);if(!capability)return error('انتهت جلسة التحقق؛ أعيدي التحقق من الطلب.',403,{code:'REVIEW_TOKEN_EXPIRED'});
 const productId=clean(b.productId,64),name=clean(b.displayName,40).split(/\s+/)[0]||'زبونة Trend',body=clean(b.body,1500),rating=Number(b.rating),video=safeReviewVideo(b.videoUrl);
 if(!validProduct(productId)||!Number.isInteger(rating)||rating<1||rating>5||body.length<15||!b.consent||b.consent!==true||b.videoUrl&&!video)return error('أضيفي تقييمًا من 1–5 وكلماتكِ عن التجربة (15 حرفًا على الأقل) والموافقة على النشر. رابط الفيديو اختياري ومن منصة اجتماعية معروفة.',400,{code:'REVIEW_INVALID'});
 const purchased=await env.DB.prepare("SELECT oi.product_id FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND oi.product_id=? AND o.status='تم' AND p.active=1 AND p.approved=1").bind(capability.orderId,productId).first();if(!purchased)return error('هذا المنتج غير متاح للمراجعة من هذا الطلب.',403,{code:'REVIEW_NOT_ELIGIBLE'});
 const id=crypto.randomUUID();try{await env.DB.prepare('INSERT INTO reviews(id,order_id,product_id,display_name,rating,body,locale,consent_at,video_url) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,capability.orderId,productId,name,rating,body,b.locale==='en'?'en':'ar',new Date().toISOString(),video).run()}catch(e){if(/unique/i.test(e.message||''))return error('سبق إرسال مراجعة لهذا المنتج من هذا الطلب.',409,{code:'REVIEW_EXISTS'});throw e}
 return json({ok:true,id,uploadToken:await sign(env,{orderId:capability.orderId,reviewId:id,exp:Date.now()+15*60*1000},hmac),status:'pending'},201);
}
export async function uploadReviewMedia(request,env,{json,error,sameOrigin,throttle,hmac}){
 if(!sameOrigin(request)||!env.MEDIA)return error('غير مصرح',403);if(!(await throttle(request,env,'review-media',12,900)))return error('محاولات كثيرة',429);
 const capability=await verify(env,request.headers.get('x-review-token'),hmac);if(!capability?.reviewId||!validId(capability.reviewId))return error('أعيدي التحقق من الطلب.',403);
 const review=await env.DB.prepare("SELECT id FROM reviews WHERE id=? AND order_id=? AND status='pending'").bind(capability.reviewId,capability.orderId).first();if(!review)return error('المراجعة غير متاحة لإضافة الصور.',403);
 const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM review_media WHERE review_id=?').bind(review.id).first();if(count?.count>=2)return error('يمكن إضافة صورتين لكل مراجعة.',409);
 let bytes;try{bytes=await readLimitedBody(request,MAX_IMAGE_BYTES)}catch{return error('الصورة كبيرة جدًا.',413)}const mime=sniffImage(bytes);if(bytes.length<12||!mime||mime!==request.headers.get('content-type'))return error('استخدمي صورة JPEG أو PNG أو WebP.',415);
 const id=crypto.randomUUID(),key='reviews/'+id;await env.MEDIA.put(key,bytes,{metadata:{contentType:mime,size:bytes.length}});
 try{const r=await env.DB.prepare('INSERT INTO review_media(id,review_id,media_key,mime,size) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM review_media WHERE review_id=?)<2').bind(id,review.id,key,mime,bytes.length,review.id).run();if(!r.meta.changes){await env.MEDIA.delete(key);return error('يمكن إضافة صورتين فقط.',409)}}catch(e){await env.MEDIA.delete(key);throw e}
 return json({ok:true,id},201);
}
export async function serveReviewMedia(request,env,id,{admin=false}={}){
 const headers={'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'cross-origin-resource-policy':'same-origin','cache-control':'no-store'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
 if(!validId(id)||!env.DB||!env.MEDIA)return new Response('Not found',{status:404,headers});
 const row=await env.DB.prepare("SELECT m.media_key,m.mime,m.size,r.product_id FROM review_media m JOIN reviews r ON r.id=m.review_id JOIN orders o ON o.id=r.order_id JOIN products p ON p.id=r.product_id WHERE m.id=?"+(admin?'':" AND r.status='approved' AND o.status='تم' AND p.active=1 AND p.approved=1")).bind(id).first();
 if(!row||isRetiredProduct(row.product_id))return new Response('Not found',{status:404,headers});const value=await env.MEDIA.get(row.media_key,{type:'stream'});if(!value)return new Response('Not found',{status:404,headers});if(request.method==='HEAD')await value.cancel?.();return new Response(request.method==='HEAD'?null:value,{headers:{...headers,'content-type':row.mime,'content-length':String(row.size)}});
}
export async function adminReviews(request,env,{json,error,sameOrigin,content}){
 if(request.method==='GET'){const data=await env.DB.prepare('SELECT r.*,o.governorate,p.name AS product_name FROM reviews r JOIN orders o ON o.id=r.order_id JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 200').all();const images=await env.DB.prepare('SELECT m.id,m.review_id FROM review_media m JOIN reviews r ON r.id=m.review_id ORDER BY r.created_at DESC LIMIT 400').all();return json({reviews:(data.results||[]).map(r=>({...r,images:(images.results||[]).filter(m=>m.review_id===r.id).map(m=>'/review-media/'+m.id)}))})}
 if(!sameOrigin(request)||request.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);let b;try{b=await content(request)}catch{return error('بيانات غير صالحة')}
 if(!validId(b.id)||!['approved','hidden'].includes(b.status))return error('حالة غير صالحة');
 const review=await env.DB.prepare("SELECT r.id,r.product_id,o.status FROM reviews r JOIN orders o ON o.id=r.order_id WHERE r.id=?").bind(b.id).first();if(!review||isRetiredProduct(review.product_id)||b.status==='approved'&&review.status!=='تم')return error('لا يمكن اعتماد مراجعة دون طلب مكتمل.',409);
 await env.DB.prepare("UPDATE reviews SET status=?,moderated_at=datetime('now') WHERE id=?").bind(b.status,b.id).run();return json({ok:true});
}
