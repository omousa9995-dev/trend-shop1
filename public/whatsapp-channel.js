import {applyLimitedOffers} from './limited-offers.js?v=5.23.1';
import {productUrl} from './product-links.js?v=5.23.1';
import {productDetails} from './shop-tools.js';

export function channelDraft(kind, products, offers, now = Date.now()) {
  const known = products.filter(product =>
    product.active === 1 && product.approved === 1 && product.stock > 0 &&
    /^TS[A-Z0-9-]{4,64}$/.test(product.id) &&
    Number.isInteger(product.price_fils) && product.price_fils >= 500
  );
  const priced = applyLimitedOffers(known,offers,now);
  const recentDate = product => Date.parse(String(product.created_at||'').replace(' ','T')+(product.created_at?.endsWith('Z')?'':'Z'));
  const recent = product => {
    const elapsed = now-recentDate(product);
    return elapsed >= 0 && elapsed <= 14*86400000;
  };
  const flash = kind === 'flash';
  const picks = flash
    ? priced.filter(product=>product.limitedOffer).sort((a,b)=>a.limitedOffer.endsAt-b.limitedOffer.endsAt).slice(0,3)
    : priced.filter(recent).sort((a,b)=>recentDate(b)-recentDate(a)).slice(0,3);
  if (!picks.length) return '';
  const headings = flash?'عروض Trend Shop لفترة محدودة ✦':'وصل حديثًا إلى Trend Shop 🌸';
  const formatter = new Intl.DateTimeFormat('ar-JO',{timeZone:'Asia/Amman',dateStyle:'short',timeStyle:'short'});
  const lines = picks.map(product => {
    const name = productDetails(product).nameAr || product.name;
    const price = (product.price_fils/1000).toFixed(2);
    const end = flash?'\nينتهي '+formatter.format(product.limitedOffer.endsAt*1000)+' بتوقيت الأردن':'';
    return `• ${name} · ${price} د.أ${end}\n${productUrl(product.id)}`;
  });
  return [headings,...lines].join('\n\n');
}
