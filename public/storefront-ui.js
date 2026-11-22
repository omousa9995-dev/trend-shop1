export function mountStorefrontUI(view=window){
 const doc=view.document,header=doc.getElementById('siteHeader'),whatsapp=doc.querySelector('.whatsapp-float');let frame;
 function layout(){
  frame=null;
  if(header)doc.documentElement.style.setProperty('--store-header-height',header.getBoundingClientRect().height+'px');
  if(!whatsapp)return;
  // Lift the lower WhatsApp control only if the main home action overlaps it.
  whatsapp.style.removeProperty('--whatsapp-lift');
  const box=whatsapp.getBoundingClientRect();let lift=0;
  for(const action of doc.querySelectorAll('.hero-ctas .btn')){
   const r=action.getBoundingClientRect();if(r.height&&r.top<view.innerHeight&&r.bottom>0&&box.left<r.right+8&&box.right>r.left-8&&box.top<r.bottom+8&&box.bottom>r.top-8)lift=Math.max(lift,box.bottom-r.top+12);
  }
  if(lift)whatsapp.style.setProperty('--whatsapp-lift',lift+'px');
 }
 const schedule=()=>{if(!frame)frame=view.requestAnimationFrame(layout)};
 view.addEventListener('resize',schedule,{passive:true});view.addEventListener('scroll',schedule,{passive:true});
 const resize=typeof view.ResizeObserver==='function'?new view.ResizeObserver(schedule):null;if(header)resize?.observe(header);
 const changes=new view.MutationObserver(schedule);if(doc.getElementById('app'))changes.observe(doc.getElementById('app'),{childList:true});
 schedule();return()=>{view.removeEventListener('resize',schedule);view.removeEventListener('scroll',schedule);resize?.disconnect();changes.disconnect();if(frame)view.cancelAnimationFrame(frame)};
}
