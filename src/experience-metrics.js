const sessions=/^[a-zA-Z0-9-]{20,90}$/;
const customerEvents=new Set(['product_view','cart_add','checkout_start']);
const webVitals=new Set(['LCP','INP','CLS']);
const subjects=new Set(['home','catalog','product','checkout','other']);
const dayNow=()=>new Date(Date.now()+3*3600000).toISOString().slice(0,10);
export async function recordExperience(env,{session,metric,subject='all',device='other',value=0},hmac){
 if(!sessions.test(session||''))return;
 const day=dayNow(),bucket=metric==='LCP'?Math.ceil(value/500)*500:metric==='INP'?Math.ceil(value/100)*100:metric==='CLS'?Math.ceil(value*100):0;
 const signature=await hmac(env.SESSION_SECRET,'experience:'+day+':'+session+':'+metric+':'+subject+':'+device);
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO experience_seen(day,signature,metric,subject,device,bucket) VALUES(?,?,?,?,?,?)').bind(day,signature,metric,subject,device,bucket),
  env.DB.prepare("DELETE FROM experience_seen WHERE day<date('now','+3 hours','-2 days')")
 ]);
}
export async function publicExperienceMetrics(req,env,{json,error,sameOrigin,content,throttle,hmac}){
 if(req.method!=='POST')return error('الطريقة غير مسموحة',405);
 if(!sameOrigin(req))return error('غير مصرح',403);
 if(!(await throttle(req,env,'experience',180,600)))return error('حاولي لاحقًا',429);
 let b;try{b=await content(req,1800)}catch{return error('بيانات غير صالحة')}
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['session','metric','subject','device','value'].includes(k))||!sessions.test(b.session||'')||!['mobile','desktop','other'].includes(b.device))return error('قياس غير صالح');
 if(customerEvents.has(b.metric)){if(b.subject!=='all'||b.value!==undefined&&b.value!==0)return error('قياس غير صالح');}
 else if(webVitals.has(b.metric)){if(!subjects.has(b.subject)||typeof b.value!=='number'||!Number.isFinite(b.value)||b.value<0||b.value>(b.metric==='CLS'?10:60000))return error('قياس غير صالح');}
 else return error('قياس غير صالح');
 await recordExperience(env,b,hmac);return json({ok:true});
}
export async function adminExperienceMetrics(req,env,{json,error}){
 if(req.method!=='GET')return error('الطريقة غير مسموحة',405);
 const days=Number(new URL(req.url).searchParams.get('days')||7);if(![7,30].includes(days))return error('الفترة غير صالحة');
 const rows=await env.DB.prepare("SELECT metric,device,bucket,SUM(amount) AS amount FROM experience_counts WHERE day>=date('now','+3 hours',?) GROUP BY metric,device,bucket").bind('-'+(days-1)+' days').all();
 const totals={},performance={};
 for(const metric of ['product_view','cart_add','checkout_start','order_success'])totals[metric]=(rows.results||[]).filter(r=>r.metric===metric).reduce((n,r)=>n+r.amount,0);
 for(const metric of webVitals)for(const device of ['mobile','desktop']){
  const bins=(rows.results||[]).filter(r=>r.metric===metric&&r.device===device).sort((a,b)=>a.bucket-b.bucket),samples=bins.reduce((n,b)=>n+b.amount,0);let at=0,p75=null;for(const bin of bins){at+=bin.amount;if(at>=Math.ceil(samples*.75)){p75=metric==='CLS'?bin.bucket/100:bin.bucket;break;}}
  performance[metric+'_'+device]={samples,p75Upper:p75};
 }
 return json({days,totals,performance,asOf:new Date().toISOString(),notes:'جلسات مجهولة تقريبية؛ تأكيد الطلب لا يعني التحصيل. قياسات الأداء مجموعات تقريبية وليست نتيجة Lighthouse.'});
}
