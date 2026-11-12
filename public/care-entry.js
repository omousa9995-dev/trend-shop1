// Capability metadata only: no cart, profile or message is sent from the storefront.
fetch('/api/care/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(status=>{
 if(!status?.available)return;
 if(status.widgetAvailable){let widget;document.addEventListener('click',event=>{const entry=event.target.closest?.('[data-care-entry]');if(!entry||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();(widget?Promise.resolve(widget):import('./luma-widget.js?v=5.17.3').then(module=>module.mountLumaWidget({status}))).then(api=>{widget=api;api.open()}).catch(()=>{location.href='/care-assistant.html'})})}
 const launcher=document.querySelector('[data-care-launcher]');let scheduled=false,frame=0,stopped=false;
 function update(){scheduled=false;frame=0;if(stopped)return;const en=document.documentElement.lang==='en';
  for(const link of document.querySelectorAll('[data-care-entry]')){if(link===launcher)continue;if(link.hidden)link.hidden=false;const label=en?'Ask Luma ✦':'اسألي لُمى ✦';if(link.textContent!==label)link.textContent=label}
  if(!launcher)return;const title=launcher.querySelector('strong'),sub=launcher.querySelector('small');const titleText=en?'Ask Luma':'اسألي لُمى',subText=en?'Let’s find your picks':'نرتّب اختياراتكِ سوا';if(title.textContent!==titleText)title.textContent=titleText;if(sub.textContent!==subText)sub.textContent=subText;const label=en?'Talk to Luma, Trend Shop’s automated shopping assistant':'تحدثي مع لُمى، مساعد المتجر الآلي';if(launcher.getAttribute('aria-label')!==label)launcher.setAttribute('aria-label',label);
  const blocked=/^#\/(?:checkout|success|order)(?:[/?]|$)/.test(location.hash)||[...document.querySelectorAll('dialog[open],[aria-modal="true"],#overlay,#searchPanel,#cartAssist')].some(el=>!el.hidden&&el.getClientRects().length>0);
  if(launcher.hidden!==blocked)launcher.hidden=blocked;
 }
 const schedule=()=>{if(!stopped&&!scheduled){scheduled=true;frame=requestAnimationFrame(update)}};
 const bodyObserver=new MutationObserver(schedule),languageObserver=new MutationObserver(schedule);
 function start(){stopped=false;update();window.addEventListener('hashchange',schedule);bodyObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']})}
 function stop(){stopped=true;cancelAnimationFrame(frame);frame=0;scheduled=false;bodyObserver.disconnect();languageObserver.disconnect();window.removeEventListener('hashchange',schedule)}
 start();window.addEventListener('pagehide',stop);window.addEventListener('pageshow',event=>{if(event.persisted)start()});
}).catch(()=>{});
