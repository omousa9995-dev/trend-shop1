export async function uploadSiteImage(file,{fetcher=fetch,signal}={}){
 if(!file||file.size>30*1024*1024)throw Error('اختر صورة أصغر من 30 ميغابايت');
 const url=URL.createObjectURL(file);let blob;
 try{
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('تعذر فتح الصورة. اختر JPEG أو PNG من ألبوم الصور.'));img.src=url;});
  const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.94,.9,.86,.8]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=1536*1024)break;}
  if(!blob||blob.size>1536*1024)throw Error('الصورة كبيرة. اختر صورة أصغر ثم حاول مجددًا.');
 }finally{URL.revokeObjectURL(url);}
 const body=new FormData();body.append('image',blob,'store-image.jpg');
 const response=await fetcher('/api/admin/images',{method:'POST',credentials:'same-origin',headers:{'x-trend-admin':'1'},body,signal});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'تعذر رفع الصورة');
 return result.imageUrl;
}
