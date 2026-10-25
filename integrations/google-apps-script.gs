/**
 * Trend Shop free-tier email bridge (Google Apps Script).
 * Script Properties required: TREND_WEBHOOK_TOKEN (unique random 32+ byte secret).
 * Deploy as Web App > Execute as Me > Who has access: Anyone.
 * ALL inbound requests are rejected unless the token matches the secret.
 * Do not print customer PII into logs. The Worker sends only after D1 commits the order.
 */
const STORE_EMAIL = 'stpostpo470@gmail.com';
const CLIQ_STORE_ALIAS = 'TRUSTTREND';

function jsonResult_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function sanitized_(value, max) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').slice(0, max);
}
function doPost(e) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('TREND_WEBHOOK_TOKEN');
    if (!token || token.length < 32) return jsonResult_({ok:false,reason:'not_configured'});
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.token !== token) return jsonResult_({ok:false,reason:'unauthorized'});
    const quota=MailApp.getRemainingDailyQuota();
    if (data.action==='health') return jsonResult_({ok:true,service:'trend-shop-mail',ownerEmail:STORE_EMAIL,remainingRecipients:quota});
    if (data.action==='test') {
      if (quota<1) return jsonResult_({ok:false,reason:'quota_exhausted'});
      MailApp.sendEmail({to:STORE_EMAIL,subject:'Trend Shop | اختبار ربط بريد الطلبات',body:'هذه رسالة اختبار لربط إشعارات Trend Shop. لا تمثل طلب شراء ولا تحتوي بيانات عميل.\n\nإبتسمي فلا جميلة إلا أنتِ ♡',name:'Trend Shop'});
      return jsonResult_({ok:true,ownerSent:true,customerSent:false,test:true});
    }
    if (data.action && data.action!=='order') return jsonResult_({ok:false,reason:'invalid_action'});
    const o = data.order || {};
    if (!/^TR-[A-Z0-9-]{8,40}$/.test(o.id || '') ||
        (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email))) {
      return jsonResult_({ok:false,reason:'invalid_order'});
    }
    // Owner always; customer only when an email is provided. Quotas can change.
    if (quota<1) return jsonResult_({ok:false,reason:'quota_exhausted'});
    const clientEmail = sanitized_(o.email,160);
    const id=sanitized_(o.id,45),name=sanitized_(o.name,95);
    const subtotal = (Number(o.subtotal_fils || 0) / 1000).toFixed(3) + ' د.أ';
    const items = Array.isArray(o.items) ? o.items : [];
    const breakdown = items.slice(0,20).map((x,i) =>
      (i+1) + '. ' + sanitized_(x.name,150) + ' × ' + Number(x.qty || 1) +
      ' — ' + (Number(x.price_fils || 0)/1000).toFixed(3) + ' د.أ'
    ).join('\n');
    const payment=o.payment==='cliq'?'CliQ يدوي — بانتظار التحقق من التحويل':'الدفع عند الاستلام';
    const ownerMessage = [
      'طلب جديد في Trend Shop', 'رقم الطلب: '+id,'الاسم: '+name,
      'الهاتف: '+sanitized_(o.phone,20),'البريد: '+(clientEmail||'لم تضف الزبونة بريدًا إلكترونيًا'),
      'المحافظة: '+sanitized_(o.governorate,35),
      'العنوان: '+sanitized_(o.address,350),
      'الملاحظات: '+sanitized_(o.notes,500),
      'طريقة الدفع: '+payment,
      'CliQ Alias الزبونة: '+sanitized_(o.alias,70),
      'المنتجات:\n'+breakdown,'مجموع المنتجات دون التوصيل: '+subtotal,
      'راجعي الطلب داخل لوحة الإدارة قبل التجهيز أو الشحن.'
    ].join('\n\n');
    const customerMessage = [
      'مرحباً '+name+' ♡',
      'شكراً من القلب لتسوقكِ من Trend Shop! 🌸',
      'استلمنا طلبكِ بنجاح ورقمه: '+id,
      'سنبدأ بتجهيزه بكل حب ونتواصل معكِ إذا احتجنا إلى أي تفاصيل.',
      o.payment==='cliq'?'إذا اخترتِ الدفع عبر CliQ، استخدمي Alias المتجر: '+CLIQ_STORE_ALIAS+'؛ التحويل يدوي ويؤكد صاحب المتجر استلامه.':'',
      'إبتسمي فلا جميلة إلا أنتِ ♡',
      'فريق Trend Shop'
    ].filter(Boolean).join('\n\n');
    // Deliberately no product list, totals, or invoice in the customer message.
    MailApp.sendEmail({to:STORE_EMAIL,subject:'Trend Shop | طلب جديد '+id,body:ownerMessage,name:'Trend Shop'});
    let customerSent=false,customerError='';
    if (clientEmail && quota>=2) {
      try {MailApp.sendEmail({to:clientEmail,subject:'Trend Shop | تأكيد استلام طلبك '+id,body:customerMessage,name:'Trend Shop'});customerSent=true;}
      catch (_) {customerError='customer_mail_error';}
    } else if (clientEmail) customerError='customer_quota_exhausted';
    return jsonResult_({ok:true,ownerSent:true,customerSent,customerError});
  } catch(err) {
    console.error('Trend Shop email bridge error (without customer data)');
    return jsonResult_({ok:false,reason:'mail_error'});
  }
}
