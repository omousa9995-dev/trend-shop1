export const MAX_IMAGE_BYTES=1536*1024;
const MIME_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};

export async function readLimitedBody(request,limit){
  if(Number(request.headers.get('content-length')||0)>limit)throw Error('TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)throw Error('EMPTY');
  const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('TOO_LARGE')}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes;
}

export function sniffImage(bytes){
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
  if(bytes.length>=16&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}

export async function uploadImage(request,env,{json,error,sameOrigin,throttle}){
  if(!sameOrigin(request)||request.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
  if(!env.MEDIA)return error('رفع الصور غير متاح مؤقتًا',503);
  if(!(await throttle(request,env,'image-upload',40,900)))return error('تم تجاوز عدد الصور المسموح برفعها؛ حاول لاحقًا',429);
  const type=request.headers.get('content-type')||'';
  if(!type.startsWith('multipart/form-data;'))return error('اختر ملف صورة صالحًا');
  let file;
  try{const body=await readLimitedBody(request,MAX_IMAGE_BYTES+65536);const form=await new Response(body,{headers:{'content-type':type}}).formData();file=form.get('image')}catch(e){return error(e.message==='TOO_LARGE'?'الصورة أكبر من الحجم المسموح':'تعذر قراءة الصورة',e.message==='TOO_LARGE'?413:400)}
  if(!file||typeof file.arrayBuffer!=='function'||file.size<12)return error('اختر صورة JPEG أو PNG أو WebP');
  if(file.size>MAX_IMAGE_BYTES)return error('الصورة أكبر من الحجم المسموح',413);
  const bytes=new Uint8Array(await file.arrayBuffer()),mime=sniffImage(bytes);
  if(!mime||mime!==file.type||!MIME_EXT[mime])return error('صيغة الصورة غير مدعومة. استخدم JPEG أو PNG أو WebP',415);
  const key=`uploads/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}.${MIME_EXT[mime]}`;
  await env.MEDIA.put(key,bytes,{metadata:{contentType:mime,size:bytes.length}});
  return json({ok:true,imageUrl:'/media/'+key,bytes:bytes.length},201);
}

export async function serveImage(request,env,ctx,key){
  const headers={'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'cross-origin-resource-policy':'same-origin'};
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
  const original=/^(?:uploads\/\d{4}-\d{2}\/[a-f0-9-]{36}|catalog\/TS[A-Z0-9-]{4,64}-[a-f0-9]{12})\.(?:jpg|jpeg|png|webp|avif)$/;
  const existingCampaign=/^catalog\/marketing\/TS[A-Z0-9-]{4,64}-(?:scene|thumb|motion)-[a-f0-9]{12}\.(?:webp|mp4)$/;
  const newCampaign=/^catalog\/marketing\/(?:TS[A-Z0-9-]{4,64}-ritual(?:-thumb)?|bundle-[1-5](?:-thumb)?|(?:beauty-tools|korean-care)-gateway)-nov3-[a-f0-9]{12}\.webp$/;
  const koreanScene=/^catalog\/marketing\/TS[A-Z0-9-]{4,64}-kcare-(?:scene|thumb)-[a-f0-9]{12}\.webp$/;
  if(!original.test(key)&&!existingCampaign.test(key)&&!newCampaign.test(key)&&!koreanScene.test(key))return new Response('Not found',{status:404,headers});
  if(!env.MEDIA)return new Response('Image storage unavailable',{status:503,headers:{...headers,'cache-control':'no-store'}});
  const cache=globalThis.caches?.default;
  const cacheKey=new Request(request.url,{method:'GET'});
  if(cache){const cached=await cache.match(cacheKey);if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,headers:cached.headers}):cached;}
  const video=key.endsWith('.mp4');
  const result=await env.MEDIA.getWithMetadata(key,{type:video?'arrayBuffer':'stream',cacheTtl:86400});
  if(!result.value)return new Response('Not found',{status:404,headers:{...headers,'cache-control':'no-store'}});
  const mime=result.metadata?.contentType;
  if(!MIME_EXT[mime]&&!(video&&mime==='video/mp4')){await result.value.cancel?.();return new Response('Invalid image',{status:404,headers});}
  if(video){const bytes=new Uint8Array(result.value),range=request.headers.get('range');let start=0,end=bytes.length-1,status=200;if(range){const match=range.match(/^bytes=(\d*)-(\d*)$/);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+bytes.length}});if(!match[1])start=Math.max(0,bytes.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}if(start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+bytes.length}});status=206}return new Response(request.method==='HEAD'?null:bytes.slice(start,end+1),{status,headers:{...headers,'content-type':'video/mp4','accept-ranges':'bytes','cache-control':'public, max-age=31536000, immutable','content-length':String(end-start+1),...(status===206?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{})}})}
  const response=new Response(request.method==='HEAD'?null:result.value,{headers:{...headers,'content-type':mime,'cache-control':'public, max-age=31536000, immutable',...(Number.isInteger(result.metadata?.size)?{'content-length':String(result.metadata.size)}:{})}});
  if(request.method==='HEAD')await result.value.cancel?.();
  else if(cache&&ctx?.waitUntil)ctx.waitUntil(cache.put(cacheKey,response.clone()));
  return response;
}

export const _mediaTest={sniffImage,MAX_IMAGE_BYTES};
