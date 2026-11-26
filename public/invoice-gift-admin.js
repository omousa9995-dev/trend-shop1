import {requestWithDeadline} from './checkout-request.js';

export function createInvoiceGiftControl({root=document,call}) {
  const request=(method='GET',data)=>requestWithDeadline((_,options)=>call('site-settings',method,data,options),'invoice-settings',{},8000);
  const checkbox=root.querySelector('#invoiceGiftEnabled');
  const status=root.querySelector('#invoiceGiftSettingStatus');
  let settings=null,loading=null,saving=null;
  const message=(text,error=false)=>{
    status.textContent=text;
    status.classList.toggle('error',error);
  };
  const savedText=enabled=>enabled
    ? 'بطاقة الهدية مفعّلة للفواتير التي تطبعها لاحقًا.'
    : 'تم إخفاء رمز الخصم والأفاتار وعبارة الهدية من الطباعة التالية.';
  function load() {
    if(loading)return loading;
    checkbox.disabled=true;
    loading=(async()=>{
      try {
        const data=await request();
        if(!data.settings)throw Error('تعذّر تحميل إعداد الفواتير. حاول مجددًا.');
        settings=data.settings;
        checkbox.checked=settings.invoiceGiftEnabled!==false;
        message(savedText(checkbox.checked));
        return checkbox.checked;
      } catch(error) {
        settings=null;
        message(error.message,true);
        throw error;
      } finally {
        loading=null;
        checkbox.disabled=!settings;
      }
    })();
    return loading;
  }
  checkbox.addEventListener('change',()=>{
    if(saving||!settings)return;
    const enabled=checkbox.checked,previous=settings.invoiceGiftEnabled!==false;
    checkbox.disabled=true;
    message('جارٍ حفظ اختيارك…');
    saving=(async()=>{
      try {
        const result=await request('POST',{action:'invoice-gift',revision:settings.revision,enabled});
        settings={...settings,invoiceGiftEnabled:enabled,revision:result.revision};
        message(savedText(enabled));
      } catch(error) {
        checkbox.checked=previous;
        settings=null;
        message('تعذّر حفظ الاختيار. حدّث الطلبات وحاول مجددًا. '+error.message,true);
        throw error;
      } finally {
        saving=null;
        checkbox.disabled=!settings;
      }
    })();
    saving.catch(()=>{});
  });
  return {
    load:async()=>{if(saving)await saving;return load();},
    async prepare(orders) {
      if(saving)await saving;
      const enabled=await load();
      return enabled?orders:orders.map(order=>({...order,invoice_gift_token:null}));
    }
  };
}
