// Keep only browsing state in memory; never store checkout/customer fields.
export function createBrowsePosition({view=window,getCount,getFilters}={}){
 const pages=new Map();let current=null,lastBrowse='',restoring=0,frame,resize,settle;
 if('scrollRestoration' in view.history)view.history.scrollRestoration='manual';
 const isBrowse=path=>['/','/shop','/saved','/offers'].includes(path||'/')||path.startsWith('/collections/');
 function capture(force=false){if(!current?.browse||restoring&&!force)return;pages.set(current.key,{y:Math.max(0,view.scrollY||0),count:getCount(),filters:getFilters()});lastBrowse=current.key;if(pages.size>20)pages.delete(pages.keys().next().value)}
 view.addEventListener('scroll',()=>capture(),{passive:true});
 view.addEventListener('pagehide',()=>capture(true));
 // Async review blocks and images can resize after the first paint on Back.
 // Keep the saved position through that layout work, until the shopper scrolls.
 function stopRestore(){if(frame)view.cancelAnimationFrame(frame);frame=null;resize?.disconnect();resize=null;if(settle)view.clearTimeout(settle);settle=null;restoring=0}
 for(const name of ['wheel','touchstart','pointerdown'])view.addEventListener(name,stopRestore,{passive:true});
 view.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))stopRestore()});
 view.document.addEventListener('click',event=>{if(event.target.closest?.('a[href]')){stopRestore();capture(true)}},true);
 function enter(path,query,{history,resetPosition=false}={}){
  capture(true);stopRestore();
  const key=(path.startsWith('/collections/')?'':'#')+(path||'/')+(query?.size?'?'+query.toString():''),browse=isBrowse(path),fromDetail=current?.detail;
  const saved=!resetPosition&&browse&&(history==='pop'||fromDetail||current?.key===key)?pages.get(key):null;
  current={key,browse,detail:path.startsWith('/product/')||path.startsWith('/bundle/')};
  if(browse)lastBrowse=key;
  return saved||{y:0,count:24,filters:getFilters()};
 }
 function restore(saved){
  const key=current?.key;stopRestore();restoring=1;
  const move=()=>{if(current?.key!==key)return;view.scrollTo({top:saved.y||0,left:0,behavior:'instant'})};
  const schedule=()=>{if(frame)view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(()=>{frame=null;move()})};
  const finish=()=>{move();stopRestore();capture()};
  move();
  if(saved.y>0&&typeof view.ResizeObserver==='function'){
   resize=new view.ResizeObserver(schedule);resize.observe(view.document.getElementById('app')||view.document.body);
   settle=view.setTimeout(finish,2000);schedule();
  }else frame=view.requestAnimationFrame(()=>{frame=null;finish()});
 }
 return {enter,restore,capture,returnHref:()=>current?.detail&&pages.has(lastBrowse)?lastBrowse:null};
}
