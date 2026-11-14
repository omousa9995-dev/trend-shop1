// Decode and resize locally. Only re-encoded pixels leave the device, not EXIF.
function deadline(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('تأخر فتح الصورة. اختاري JPG أو لقطة شاشة وحاولي مجددًا.')),ms)})]).finally(()=>clearTimeout(timer))}
export async function preparePhotoFile(file,{maxDimension=1280,maxBytes=768*1024,timeoutMs=8000}={}){
 if(!file||!file.size||file.size>30*1024*1024||!/^image\//.test(file.type)&&! /\.(?:heic|heif)$/i.test(file.name||''))throw Error('اختاري صورة واضحة بحجم أقل من 30 ميغابايت.');
 const url=URL.createObjectURL(file);let image=new Image(),bitmap;
 try{
  const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('تعذّر فتح هذه الصيغة. جرّبي JPG أو PNG أو لقطة شاشة من الصورة.'))});
  // A load listener remains the fallback on browsers without Image.decode.
  loaded.catch(()=>{});image.src=url;
  try{await deadline(typeof image.decode==='function'?image.decode():loaded,timeoutMs)}catch(e){if(typeof createImageBitmap!=='function')throw e;try{bitmap=await deadline(createImageBitmap(file),timeoutMs);image=bitmap}catch{throw Error('تعذّر فتح هذه الصيغة. على الآيفون جرّبي اختيار صورة JPG أو لقطة شاشة.')}}
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;if(!width||!height||width*height>70000000)throw Error('اختاري صورة بحجم أصغر أو لقطة شاشة.');
  const scale=Math.min(1,maxDimension/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('تعذّرت تهيئة الصورة. جرّبي اختيارها مرة ثانية.');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.86,.76,.64,.5]){
   const dataUrl=canvas.toDataURL('image/jpeg',quality);if(!dataUrl.startsWith('data:image/jpeg;base64,'))continue;
   const data=dataUrl.split(',')[1],bytes=atob(data);if(bytes.length>maxBytes)continue;
   return {dataUrl,data,mimeType:'image/jpeg',blob:new Blob([Uint8Array.from(bytes,c=>c.charCodeAt(0))],{type:'image/jpeg'})};
  }
  throw Error('الصورة كبيرة بعد تهيئتها. جرّبي لقطة شاشة أقرب للمنطقة المطلوبة.');
 }finally{bitmap?.close?.();URL.revokeObjectURL(url)}
}
