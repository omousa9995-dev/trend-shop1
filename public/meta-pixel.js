// Browser tracking is disabled until the live store has an ID and the visitor opts in.
export function createMetaPixel(win=window){
 const consentKey='trend-shop-marketing-consent-v1',ordersKey='trend-shop-tracked-orders-v1';
 const hosts=new Set(['trendjo.pages.dev','trend-shop-jo.trend-shop-jo.workers.dev']);
 let id='',live=false,started=false,current=null,lastPath=null,choice=null;
 const sentOrders=new Set();
 try{choice=win.localStorage.getItem(consentKey);for(const key of JSON.parse(win.localStorage.getItem(ordersKey)||'[]'))if(typeof key==='string')sentOrders.add(key)}catch{}
 const allowed=()=>live&&/^\d{5,25}$/.test(id)&&win.location.protocol==='https:'&&hosts.has(win.location.hostname);
 const active=()=>allowed()&&choice==='accepted';
 const doc=win.document;
 function panel(){
  let el=doc.getElementById('marketingConsent');if(el)return el;
  el=doc.createElement('section');el.id='marketingConsent';el.className='marketing-consent';el.hidden=true;el.setAttribute('aria-label','خيارات ملفات تعريف الارتباط');
  el.innerHTML='<div><b>اختياركِ للخصوصية</b><p>بموافقتكِ، نستخدم Meta Pixel لقياس الزيارات والمنتجات والسلة والطلبات وتحسين إعلاناتنا. قد تستخدم Meta ملفات تعريف الارتباط ومعلومات المتصفح وعنوان الإنترنت. يمكنكِ التسوق دون الموافقة. <a href="#/privacy">التفاصيل</a></p></div><div class="marketing-consent-actions"><button type="button" data-marketing-accept>أوافق على القياس الإعلاني</button><button type="button" data-marketing-reject>متابعة دون قياس إعلاني</button></div>';
  el.querySelector('[data-marketing-accept]').onclick=()=>consent('accepted');el.querySelector('[data-marketing-reject]').onclick=()=>consent('rejected');doc.body.append(el);return el;
 }
 function start(){
  if(!active())return false;if(started)return true;
  if(typeof win.fbq!=='function'){
   const fbq=function(){if(fbq.callMethod)fbq.callMethod.apply(fbq,arguments);else fbq.queue.push(arguments)};
   fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];win.fbq=fbq;if(!win._fbq)win._fbq=fbq;
   const script=doc.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';doc.head.append(script);
  }
  // No automatic field matching or button/form inference: send only explicit events.
  win.fbq('set','autoConfig',false,id);win.fbq('consent','grant');win.fbq('init',id);started=true;return true;
 }
 function emit(name,data={},eventId){
  try{if(!start())return false;win.fbq(name==='OrderPlaced'?'trackSingleCustom':'trackSingle',id,name,data,...(eventId?[{eventID:eventId}]:[]));return true}catch{return false}
 }
 function commerce(lines=[],totalFils){
  const contents=lines.filter(x=>/^TS[A-Z0-9-]{4,64}$/.test(x?.id)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=10&&Number.isInteger(x.priceFils)&&x.priceFils>=0).map(x=>({id:x.id,quantity:x.qty,item_price:x.priceFils/1000}));
  const amount=Number.isInteger(totalFils)&&totalFils>=0?totalFils:Math.round(contents.reduce((n,x)=>n+x.item_price*1000*x.quantity,0));
  return{content_type:'product',content_ids:[...new Set(contents.map(x=>x.id))],contents,num_items:contents.reduce((n,x)=>n+x.quantity,0),value:amount/1000,currency:'JOD'};
 }
 function view(){
  if(!current||!active()||lastPath===current.path)return;
  if(!emit('PageView'))return;lastPath=current.path;
  if(current.product)emit('ViewContent',commerce([current.product]));
  if(current.path==='/checkout'&&current.lines?.length)emit('InitiateCheckout',commerce(current.lines,current.totalFils));
 }
 function consent(value){
  choice=value;try{win.localStorage.setItem(consentKey,value)}catch{}panel().hidden=true;lastPath=null;
  if(value==='accepted'){if(started){try{win.fbq('consent','grant')}catch{}}view()}else if(started){try{win.fbq('consent','revoke')}catch{}for(const key of ['_fbp','_fbc']){for(const domain of ['',`; Domain=${win.location.hostname}`])doc.cookie=`${key}=; Path=/; Max-Age=0; SameSite=Lax${domain}`}}
 }
 doc.addEventListener('click',e=>{if(e.target.closest('[data-marketing-preferences]')&&allowed()){panel().hidden=false;panel().querySelector('button').focus()}});
 return{
  configure(config={}){id=typeof config.id==='string'?config.id:'';live=config.live===true;if(allowed()){panel().hidden=choice==='accepted'||choice==='rejected';doc.querySelectorAll('[data-marketing-preferences]').forEach(el=>el.hidden=false)}},
  page(path,{product=null,lines=[],totalFils}={}){current={path,product,lines,totalFils};view()},
  added(lines){const data=commerce(lines);if(data.num_items)emit('AddToCart',data)},
  order(result,lines){
   if(result?.received!==true||!/^TR-[A-Z0-9-]{5,40}$/.test(result.orderId||'')||!Number.isInteger(result.totalFils)||result.totalFils<0||sentOrders.has(result.orderId))return;
   // COD and manual CliQ are submitted orders, never evidence of collected revenue.
   if(emit('OrderPlaced',{...commerce(lines,result.totalFils),payment_status:'pending'},'order-'+result.orderId)){
    sentOrders.add(result.orderId);try{win.localStorage.setItem(ordersKey,JSON.stringify([...sentOrders].slice(-100)))}catch{}
   }
  }
 };
}
