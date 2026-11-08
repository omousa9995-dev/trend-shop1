// Keep invoice preparation separate from the fresh, explicit print click.
// Some browsers ignore print(); a visible preview must remain available.
export async function waitForInvoiceAssets(root,{view=root.ownerDocument.defaultView,timeoutMs=4000}={}){
 const cleanups=[];let timer;
 const images=Array.from(root.querySelectorAll('img')).map(image=>{
  image.loading='eager';if(image.complete)return Promise.resolve();
  return new Promise(resolve=>{
   const done=()=>resolve();image.addEventListener('load',done,{once:true});image.addEventListener('error',done,{once:true});
   cleanups.push(()=>{image.removeEventListener('load',done);image.removeEventListener('error',done)});
  });
 });
 const fonts=Promise.resolve(root.ownerDocument.fonts?.ready).catch(()=>{});
 try{await Promise.race([Promise.all([...images,fonts]),new Promise(resolve=>{timer=view.setTimeout(resolve,timeoutMs)})])}
 finally{view.clearTimeout(timer);for(const clean of cleanups)clean()}
}

export function createInvoicePrinter({root,render,view=root.ownerDocument.defaultView}){
 const doc=root.ownerDocument,toolbar=doc.createElement('section');toolbar.id='invoicePrintToolbar';toolbar.hidden=true;
 toolbar.setAttribute('aria-labelledby','invoicePrintTitle');
 toolbar.innerHTML='<div class="invoice-print-heading"><div><span lang="en">TREND SHOP</span><h1 id="invoicePrintTitle" tabindex="-1">معاينة الفواتير</h1><p id="invoicePrintCount"></p></div><div class="invoice-print-actions"><button type="button" id="printInvoicesNow" class="btn">طباعة / حفظ PDF</button><button type="button" id="closeInvoicePrint" class="minor">العودة للطلبات</button></div></div><p id="invoicePrintStatus" role="status" aria-live="polite"></p><details class="invoice-print-help"><summary>لم تظهر نافذة الطباعة على الآيفون؟</summary><p>افتح لوحة الإدارة في Safari مباشرة، ثم افتح معاينة الفواتير واضغط زر الطباعة أعلاه. يمكنك أيضًا استخدام مشاركة ← طباعة من Safari. للطباعة الورقية، اختر طابعة تدعم AirPrint على شبكة Wi-Fi نفسها.</p><p>الطباعة أو حفظ PDF يتمّان من نافذة الجهاز؛ لا يُرسل الطلب إلى الطابعة تلقائيًا.</p></details>';
 root.before(toolbar);
 const button=toolbar.querySelector('#printInvoicesNow'),status=toolbar.querySelector('#invoicePrintStatus');
 let sequence=0,previousFocus,previousTitle,previousScroll=0;
 function close(){
  if(toolbar.hidden)return;sequence++;toolbar.hidden=true;doc.body.classList.remove('invoice-preview-open');doc.title=previousTitle;
  // Do not remove the invoice DOM immediately after print(): iOS printing may
  // return before its native preview has captured the page.
  view.scrollTo?.(0,previousScroll);if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
 }
 function show(orders){
  if(!Array.isArray(orders)||!orders.length)return false;
  if(toolbar.hidden){previousFocus=doc.activeElement;previousTitle=doc.title;previousScroll=view.scrollY||0}
  const version=++sequence;root.innerHTML=orders.map(render).join('');
  toolbar.hidden=false;doc.body.classList.add('invoice-preview-open');doc.title='Trend Shop — فواتير '+orders.length;
  toolbar.querySelector('#invoicePrintCount').textContent='عدد الفواتير: '+orders.length+' · مقاس A4';
  button.disabled=true;status.textContent='جارٍ تجهيز الصور والخطوط للمعاينة…';status.classList.remove('error');
  view.scrollTo?.(0,0);toolbar.querySelector('#invoicePrintTitle').focus({preventScroll:true});
  waitForInvoiceAssets(root,{view}).then(()=>{
   if(sequence!==version||toolbar.hidden)return;button.disabled=false;status.textContent='الفواتير جاهزة. اضغط «طباعة / حفظ PDF» لفتح خيارات جهازك. إذا لم تظهر، افتح الإرشاد أدناه.';
  });
  return true;
 }
 button.addEventListener('click',()=>{
  if(button.disabled||toolbar.hidden)return;
  status.classList.remove('error');status.textContent='إذا لم تظهر نافذة الطباعة، افتح إرشاد الآيفون أدناه. الفواتير تبقى متاحة للمعاينة.';
  try{
   if(typeof view.print!=='function')throw Error('PRINT_UNAVAILABLE');
   // No fetch, timer, await, popup or window.close between the click and print.
   view.print();
  }catch{
   status.classList.add('error');status.textContent='المتصفح الحالي لم يفتح الطباعة. افتح لوحة الإدارة في Safari واستخدم مشاركة ← طباعة.';toolbar.querySelector('details').open=true;
  }
 });
 toolbar.querySelector('#closeInvoicePrint').addEventListener('click',close);
 return {show,close,get open(){return !toolbar.hidden}};
}
