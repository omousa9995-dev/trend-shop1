import {INVOICE_GIFT_DAYS, INVOICE_GIFT_PERCENT} from './invoice-gift-rules.js';

const walletKey = 'trend_invoice_gift_wallet';
const syncKey = 'trend_invoice_gift_update';
const validKey = value => /^[a-f0-9]{32}$/.test(value || '');

function readWallet(view) {
  try {
    const key = view.localStorage.getItem(walletKey);
    if (validKey(key)) return key;
  } catch {}
  try { return view.document.cookie.match(/(?:^|;\s*)trend_invoice_gift_wallet=([a-f0-9]{32})(?:;|$)/)?.[1] || ''; }
  catch { return ''; }
}

function ensureWallet(view) {
  const key = readWallet(view) || Array.from(view.crypto.getRandomValues(new Uint8Array(16)),
    value => value.toString(16).padStart(2, '0')).join('');
  try { view.localStorage.setItem(walletKey, key); } catch {}
  try { view.document.cookie = walletKey + '=' + key + '; Path=/; SameSite=Lax; Max-Age=950400' +
    (view.location.protocol === 'https:' ? '; Secure' : ''); } catch {}
  return readWallet(view);
}

const noticeText = {
  claimed: ['تم تفعيل هالهدية من قبل. افتحي المتجر من نفس المتصفح اللي مسحتِ منه الفاتورة أول مرة.', 'This gift was activated in another browser. Open the store in the browser used for the first scan.'],
  used: ['استخدمتِ هدية هالفاتورة في طلب سابق.', 'You already used this invoice gift on an order.'],
  expired: ['انتهت مدة هدية هالفاتورة.', 'This invoice gift has expired.'],
  invalid: ['ما تعرّفنا على هالكود. جرّبي مسح الكود المطبوع على فاتورة Trend Shop.', 'We couldn’t recognise this code. Scan the code printed on your Trend Shop invoice.'],
  offline: ['تعذّر التحقق من الهدية هالمرة. تحقّقي من الاتصال وجرّبي من جديد.', 'We couldn’t check your gift. Check your connection and try again.'],
  storage: ['افتحي الكود بمتصفح يسمح بحفظ الهدية على جهازكِ.', 'Open this code in a browser that can save your gift on this device.']
};

function showGiftDialog(view, status, language, retry) {
  const doc = view.document, english = language === 'en';
  doc.querySelector('.invoice-gift-dialog')?.close();
  const success = status === 'activated' || status === 'active';
  const modal = doc.createElement('dialog');
  modal.className = 'invoice-gift-dialog' + (success ? ' invoice-gift-welcome' : '');
  modal.setAttribute('aria-labelledby', 'invoiceGiftTitle');
  modal.setAttribute('aria-describedby', 'invoiceGiftCopy');
  modal.dir = english ? 'ltr' : 'rtl';
  modal.lang = english ? 'en' : 'ar';
  const pick = (ar,en) => english ? en : ar;
  const title = success ? pick('مبروك!','Congratulations!') : pick('هدية فاتورتكِ','Your invoice gift');
  const percent = '<strong class="gift-percent" dir="ltr">'+INVOICE_GIFT_PERCENT+'%</strong>';
  const copy = success ? pick('لقد حصلتِ على خصم '+percent+' على طلبكِ المقبل.','You’ve unlocked '+percent+' off your next order.') :
    noticeText[status][english ? 1 : 0];
  modal.innerHTML = `<button type="button" class="gift-close" aria-label="${pick('إغلاق','Close')}">×</button>
    ${success ? '<div class="gift-ribbon" aria-hidden="true"><i></i></div>' : ''}
    <h2 id="invoiceGiftTitle">${title}</h2>
    <p id="invoiceGiftCopy">${copy}</p>
    <button type="button" class="gift-continue">${status === 'offline' ? pick('جرّبي من جديد','Try again') : pick('متابعة التسوّق','Continue shopping')}</button>
    ${success ? '<small>'+pick('مدة الخصم '+INVOICE_GIFT_DAYS+' أيام من أول مسح','Valid for '+INVOICE_GIFT_DAYS+' days from your first scan')+'</small>' : ''}`;
  doc.body.append(modal);
  const close = () => modal.close();
  const action = modal.querySelector('.gift-continue');
  modal.querySelector('.gift-close').onclick = close;
  action.onclick = () => { close(); if (status === 'offline') retry(); };
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  modal.showModal();
  let timer;
  if (success) {
    timer = view.setTimeout(close, 7000);
    for (const event of ['pointerdown','keydown']) {
      modal.addEventListener(event, () => view.clearTimeout(timer), {once:true});
    }
  }
  modal.addEventListener('close', () => { view.clearTimeout(timer); modal.remove(); }, {once:true});
}

export function createInvoiceGift({view = window, language, onChange}) {
  let expiresAt = 0, clockOffset = 0, expiryTimer, generation = 0, pending = null;
  const active = () => expiresAt > Date.now() + clockOffset;
  const notifyTabs = () => {
    try { view.localStorage.setItem(syncKey, String(Date.now())); } catch {}
  };
  function update(expiry) {
    view.clearTimeout(expiryTimer);
    const changed = expiresAt !== expiry;
    expiresAt = expiry;
    if (active()) expiryTimer = view.setTimeout(() => { update(0); refresh(); }, expiresAt - Date.now() - clockOffset);
    if (changed) onChange();
  }
  function refresh() {
    const hash = view.location.hash;
    const scanned = hash.startsWith('#gift=') ? hash.slice(6) : null;
    const wallet = scanned !== null ? ensureWallet(view) : readWallet(view);
    const welcome = status => showGiftDialog(view, status, language(), refresh);
    const clearLink = () => {
      if (view.location.hash === hash) view.history.replaceState(view.history.state, '', view.location.pathname + view.location.search);
    };
    if (scanned !== null && !validKey(scanned)) { clearLink(); welcome('invalid'); return Promise.resolve(); }
    if (!wallet) { if (scanned !== null) welcome('storage'); return Promise.resolve(); }
    const identity = wallet + '/' + (scanned || '');
    if (pending?.identity === identity) return pending.promise;
    const sequence = ++generation;
    const controller = new AbortController();
    const timeout = view.setTimeout(() => controller.abort(), 8000);
    const perform = async () => {
      try {
        const response = await fetch('/api/invoice-gift/' + (scanned ? 'claim' : 'status'), {
          method: 'POST', cache: 'no-store', signal: controller.signal,
          headers: {'content-type':'application/json', 'x-invoice-gift-wallet':wallet},
          body: JSON.stringify(scanned ? {token:scanned} : {})
        });
        if (!response.ok) throw Error('GIFT_UNAVAILABLE');
        const data = await response.json();
        if (sequence !== generation) return;
        clockOffset = data.serverTime - Date.now();
        update(data.active?.expiresAt || 0);
        if (scanned) {
          clearLink();
          welcome(data.status);
          if (data.status === 'activated') notifyTabs();
        }
      } catch {
        if (scanned && sequence === generation) welcome('offline');
      } finally {
        view.clearTimeout(timeout);
        if (pending?.sequence === sequence) pending = null;
      }
    };
    const promise = perform();
    pending = {identity,sequence,promise};
    return promise;
  }
  view.addEventListener('hashchange', () => { if (view.location.hash.startsWith('#gift=')) refresh(); });
  view.addEventListener('storage', event => { if (event.key === syncKey) refresh(); });
  view.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  view.document.addEventListener('visibilitychange', () => { if (!view.document.hidden) refresh(); });
  return {
    active, refresh, ready: () => pending?.promise || Promise.resolve(),
    headers() { const key = readWallet(view); return key ? {'x-invoice-gift-wallet':key} : {}; },
    used() { ++generation; pending = null; update(0); notifyTabs(); refresh(); }
  };
}
