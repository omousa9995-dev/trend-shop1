/**
 * Trend Shop free-tier email bridge (Google Apps Script).
 * Script Properties required: TREND_WEBHOOK_TOKEN (unique random 32+ byte secret).
 * Deploy as Web App > Execute as Me > Who has access: Anyone.
 * ALL inbound requests are rejected unless the token matches the secret.
 * Do not print customer PII into logs. The Worker sends only after D1 commits the order.
 */
const STORE_EMAIL = 'stpostpo470@gmail.com';
const CLIQ_STORE_ALIAS = 'TRUSTTREND';

/** Run once from the owner's editor. The secret never appears in code or logs. */
function initializeMailBridge() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('TREND_WEBHOOK_TOKEN');
  if (!token) {
    token = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TREND_WEBHOOK_TOKEN', token);
  }
  const result = doPost({postData:{contents:JSON.stringify({token,action:'test'})}});
  console.log(result.getContent());
  return result;
}

/** Owner-only editor check; no email and no secret in its output. */
function checkMailBridge() {
  const token = PropertiesService.getScriptProperties().getProperty('TREND_WEBHOOK_TOKEN');
  const result = doPost({postData:{contents:JSON.stringify({token,action:'health'})}});
  console.log(result.getContent());
  return result;
}

function jsonResult_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function sanitized_(value, max) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').slice(0, max);
}
function mailHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
}
/** The same Arabic/English confirmation for every customer, in one message. */
function customerConfirmationHtml_(o,name,id) {
  const person=mailHtml_(name),reference=mailHtml_(id),alias=mailHtml_(CLIQ_STORE_ALIAS);
  const cliqAr=o.payment==='cliq'?'<p style="padding:12px;background:#f5f0f2">للدفع عبر CliQ، استخدمي Alias المتجر: <b dir="ltr">'+alias+'</b>. التحويل يدوي، ويؤكد المتجر استلامه.</p>':'';
  const cliqEn=o.payment==='cliq'?'<p style="padding:12px;background:#f5f0f2">For manual CliQ payment, use our store alias: <b>'+alias+'</b>. The store will confirm receipt of your transfer.</p>':'';
  return '<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f6f2f3;color:#342a2e;font-family:Arial,Tahoma,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5dce0;border-radius:14px"><tr><td style="padding:28px">'+
    '<div style="text-align:center;font-family:Georgia,serif;font-size:27px;font-weight:bold;letter-spacing:2px">TREND SHOP</div><div style="margin:22px 0;padding:15px;text-align:center;background:#f5eef1;border:1px solid #d6c0ca;border-radius:9px"><div style="font-size:12px">رقم الطلب / Order number</div><strong dir="ltr" style="display:block;margin-top:7px;font-size:24px;letter-spacing:2px">'+reference+'</strong></div>'+
    '<section lang="ar" dir="rtl" style="text-align:right;font-size:15px;line-height:1.9"><h2 style="font-size:20px">مرحبًا '+person+' ♡</h2><p>شكرًا لتسوّقكِ من Trend Shop! استلمنا طلبكِ بنجاح ورقمه <b dir="ltr">'+reference+'</b>.</p><p>سنبدأ بتجهيزه بكل حب، ونتواصل معكِ إذا احتجنا إلى أي تفاصيل.</p>'+cliqAr+'<p style="color:#795563">إبتسمي فلا جميلة إلا أنتِ ♡<br>فريق Trend Shop</p></section><hr style="border:0;border-top:1px solid #e8dee2;margin:24px 0">'+
    '<section lang="en" dir="ltr" style="text-align:left;font-size:15px;line-height:1.8"><h2 style="font-size:20px">Hello '+person+' ♡</h2><p>Thank you for shopping with Trend Shop! We have received your order. Order number: <b>'+reference+'</b>.</p><p>We will prepare it with care and contact you if we need any further details.</p>'+cliqEn+'<p style="color:#795563">With love,<br>The Trend Shop team</p></section></td></tr></table></body></html>';
}
function doPost(e) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('TREND_WEBHOOK_TOKEN');
    if (!token || token.length < 32) return jsonResult_({ok:false,reason:'not_configured'});
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.token !== token) return jsonResult_({ok:false,reason:'unauthorized'});
    const quota=MailApp.getRemainingDailyQuota();
    if (data.action==='health') return jsonResult_({ok:true,service:'trend-shop-mail',ownerEmail:STORE_EMAIL,remainingRecipients:quota,orderIdFormat:'short4-v1',confirmationFormat:'bilingual-v2'});
    if (data.action==='test') {
      if (quota<1) return jsonResult_({ok:false,reason:'quota_exhausted'});
      MailApp.sendEmail({to:STORE_EMAIL,subject:'Trend Shop | اختبار ربط بريد الطلبات',body:'هذه رسالة اختبار لربط إشعارات Trend Shop. لا تمثل طلب شراء ولا تحتوي بيانات عميل.\n\nإبتسمي فلا جميلة إلا أنتِ ♡',name:'Trend Shop'});
      return jsonResult_({ok:true,ownerSent:true,customerSent:false,test:true});
    }
    if (data.action && data.action!=='order') return jsonResult_({ok:false,reason:'invalid_action'});
    const o = data.order || {};
    if (!/^TR-(?:[1-9A-HJ-NP-Z]{4}|[A-Z0-9-]{8,40})$/.test(o.id || '') ||
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
      'فريق Trend Shop',
      '────────────────────────',
      'Hello '+name+' ♡',
      'Thank you for shopping with Trend Shop!',
      'We have received your order. Order number: '+id,
      'We will prepare it with care and contact you if we need any further details.',
      o.payment==='cliq'?'For manual CliQ payments, use the store alias: '+CLIQ_STORE_ALIAS+'. The store will confirm receipt of your transfer.':'',
      'With love,',
      'The Trend Shop team'
    ].filter(Boolean).join('\n\n');
    // Deliberately no product list, totals, or invoice in the customer message.
    MailApp.sendEmail({to:STORE_EMAIL,subject:'Trend Shop | طلب جديد '+id,body:ownerMessage,name:'Trend Shop'});
    let customerSent=false,customerError='';
    if (clientEmail && quota>=2) {
      try {MailApp.sendEmail({to:clientEmail,subject:'Trend Shop | تأكيد الطلب / Order received '+id,body:customerMessage,htmlBody:customerConfirmationHtml_(o,name,id),name:'Trend Shop'});customerSent=true;}
      catch (_) {customerError='customer_mail_error';}
    } else if (clientEmail) customerError='customer_quota_exhausted';
    return jsonResult_({ok:true,ownerSent:true,customerSent,customerError});
  } catch(err) {
    console.error('Trend Shop email bridge error (without customer data)');
    return jsonResult_({ok:false,reason:'mail_error'});
  }
}
