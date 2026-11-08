// No advertising pixels or outside endpoints. Reports contain event enums,
// coarse page/device groups and a short-lived random tab-session token only.
const SESSION='trend-shop-experience-session-v1',OPT_OUT='trend-shop-experience-opt-out';
export function createExperienceMetrics({view=window,fetcher=fetch,now=()=>Date.now()}={}){
 let enabled=false,token='',lastAt=0,vitalsStarted=false;const sent=new Set();
 const permitted=()=>{try{return !view.navigator.globalPrivacyControl&&view.navigator.doNotTrack!=='1'&&view.localStorage.getItem(OPT_OUT)!=='1';}catch{return !view.navigator.globalPrivacyControl&&view.navigator.doNotTrack!=='1';}};
 const device=()=>view.innerWidth<768?'mobile':'desktop';
 function session(){if(!token||now()-lastAt>30*60000){try{const old=JSON.parse(view.sessionStorage.getItem(SESSION)||'null');if(old&&typeof old.id==='string'&&/^[a-zA-Z0-9-]{20,90}$/.test(old.id)&&now()-old.at>=0&&now()-old.at<30*60000)token=old.id;else token=view.crypto.randomUUID();}catch{token=view.crypto?.randomUUID?.()||'';}sent.clear();}lastAt=now();try{view.sessionStorage.setItem(SESSION,JSON.stringify({id:token,at:lastAt}))}catch{}return token;}
 function post(payload){if(!enabled||!permitted())return;try{Promise.resolve(fetcher('/api/experience-metrics',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify(payload)})).catch(()=>{});}catch{}}
 function measure(metric){if(!enabled||!permitted())return;const id=session();if(!id||sent.has(metric))return;sent.add(metric);post({session:id,metric,subject:'all',device:device()});}
 function startVitals(){if(vitalsStarted||!enabled||!permitted()||!view.PerformanceObserver)return;vitalsStarted=true;const run=()=>import('./web-vitals-local.js?v=5.9.0').then(({onLCP,onINP,onCLS})=>{const page=view.document.body.dataset.pageKind||'other';const sample=view.crypto.randomUUID();const send=metric=>post({session:sample,metric:metric.name,subject:page,device:device(),value:metric.value});onLCP(send);onINP(send);onCLS(send);}).catch(()=>{});if(view.requestIdleCallback)view.requestIdleCallback(run,{timeout:3000});else view.setTimeout(run,1000);}
 return {configure(value){enabled=value===true;if(enabled)startVitals();},measure,getSession(){return enabled&&permitted()?session():'';},optOut(value){try{if(value)view.localStorage.setItem(OPT_OUT,'1');else view.localStorage.removeItem(OPT_OUT);if(value)view.sessionStorage.removeItem(SESSION);}catch{}if(value){token='';sent.clear();}else startVitals();},get optedOut(){return !permitted();}};
}
