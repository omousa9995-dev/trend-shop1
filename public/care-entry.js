// Load only capability metadata. No cart, profile or messages leave this page.
fetch('/api/care/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(status=>{
 if(!status?.available)return;
 for(const link of document.querySelectorAll('[data-care-entry]'))link.hidden=false;
}).catch(()=>{});
