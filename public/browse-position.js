// Keep only browsing state in memory; never store checkout/customer fields.
export function createBrowsePosition({view=window,getCount,getFilters}={}){
 const pages=new Map();let current=null,lastBrowse='',restoring=0,frame;
 if('scrollRestoration' in view.history)view.history.scrollRestoration='manual';
 const isBrowse=path=>['/','/shop','/saved','/offers'].includes(path||'/');
 function capture(force=false){if(!current?.browse||restoring&&!force)return;pages.set(current.key,{y:Math.max(0,view.scrollY||0),count:getCount(),filters:getFilters()});lastBrowse=current.key;if(pages.size>20)pages.delete(pages.keys().next().value)}
 view.addEventListener('scroll',()=>capture(),{passive:true});
 view.addEventListener('pagehide',()=>capture(true));
 // Capture before a native link can change the hash or browser scroll position.
 function stopRestore(){if(frame)view.cancelAnimationFrame(frame);frame=null;restoring=0}
 view.addEventListener('wheel',stopRestore,{passive:true});view.addEventListener('touchstart',stopRestore,{passive:true});
 view.document.addEventListener('click',event=>{if(event.target.closest?.('a[href]')){stopRestore();capture(true)}},true);
 function enter(path,query){
  capture(true);if(frame)view.cancelAnimationFrame(frame);restoring=0;
  const key='#'+(path||'/')+(query?.size?'?'+query.toString():''),browse=isBrowse(path),fromDetail=current?.detail;
  const saved=browse&&(fromDetail||current?.key===key)?pages.get(key):null;
  current={key,browse,detail:path.startsWith('/product/')||path.startsWith('/bundle/')};
  if(browse)lastBrowse=key;
  return saved||{y:0,count:24,filters:getFilters()};
 }
 function restore(saved){
  const key=current?.key;restoring++;
  const move=()=>{if(current?.key!==key)return;view.scrollTo({top:saved.y||0,left:0,behavior:'instant'})};
  move();frame=view.requestAnimationFrame(()=>{move();restoring=0;frame=null;capture()});
 }
 return {enter,restore,capture,returnHref:()=>current?.detail&&pages.has(lastBrowse)?lastBrowse:null};
}
