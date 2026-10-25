(()=>{'use strict';
 const input=document.getElementById('productImageFile'),status=document.getElementById('imageUploadStatus'),preview=document.getElementById('imageUploadPreview'),form=document.getElementById('productForm');
 if(!input)return;
 let previewUrl,uploadSequence=0,uploadController;
 async function prepare(file){
  if(file.size>30*1024*1024)throw Error('اختر صورة أصغر من 30 ميغابايت');
  const originalUrl=URL.createObjectURL(file);
  try{
   const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('تعذر فتح الصورة. جرّب اختيار JPEG أو PNG من ألبوم الصور.'));img.src=originalUrl});
   const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
   const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
   if(!blob||blob.size>1536*1024)throw Error('الصورة ما زالت كبيرة. اختر لقطة أصغر.');
   return blob;
  }finally{URL.revokeObjectURL(originalUrl)}
 }
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file)return;
  const sequence=++uploadSequence;uploadController?.abort();uploadController=new AbortController();
  const submit=form.querySelector('button[type="submit"]');submit.disabled=true;input.disabled=true;status.textContent='جاري تهيئة الصورة ورفعها…';
  try{
   const blob=await prepare(file),body=new FormData();body.append('image',blob,'product.jpg');
   if(sequence!==uploadSequence)return;
   const response=await fetch('/api/admin/images',{method:'POST',credentials:'same-origin',headers:{'x-trend-admin':'1'},body,signal:uploadController.signal});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'تعذر رفع الصورة');
   if(sequence!==uploadSequence)return;
   form.elements.image_url.value=data.imageUrl;
   if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);preview.src=previewUrl;preview.hidden=false;
   status.textContent='رُفعت الصورة. اضغط حفظ التغييرات لاعتمادها للمنتج.';
  }catch(error){if(sequence===uploadSequence&&error.name!=='AbortError')status.textContent=error.message}finally{if(sequence===uploadSequence){submit.disabled=false;input.disabled=false;input.value=''}}
 });
 form.addEventListener('reset',()=>{uploadSequence++;uploadController?.abort();input.disabled=false;form.querySelector('button[type="submit"]').disabled=false;status.textContent='';preview.hidden=true;preview.removeAttribute('src');if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}});
})();
