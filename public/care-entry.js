import {installCareEntries} from './luma-placement.js?v=5.19.7';
// Capability metadata only; messages and cart details are sent after a user action.
if(document.querySelector('[data-care-region]')){
 let entries;
 const start=()=>fetch('/api/care/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(status=>{if(status?.available){entries?.destroy();entries=installCareEntries({status})}}).catch(()=>{});
 start();window.addEventListener('pagehide',()=>entries?.destroy());window.addEventListener('pageshow',event=>{if(event.persisted)start()});
}
