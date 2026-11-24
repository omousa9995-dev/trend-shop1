import {INVOICE_GIFT_DAYS} from '../public/invoice-gift-rules.js';

const lifetime = INVOICE_GIFT_DAYS * 24 * 60 * 60;
const tokenPattern = /^[a-f0-9]{32}$/;

export async function giftWalletHash(request) {
  const key = request.headers.get('x-invoice-gift-wallet');
  if (!tokenPattern.test(key || '')) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function activeInvoiceGift(db, walletHash) {
  if (!walletHash) return null;
  return db.prepare(`SELECT g.source_order_id, (g.claimed_at + ?) * 1000 AS expiresAt
    FROM invoice_gifts g LEFT JOIN invoice_gift_redemptions r USING(source_order_id)
    WHERE g.wallet_hash = ? AND g.claimed_at > unixepoch() - ? AND r.order_id IS NULL
    ORDER BY g.claimed_at, g.source_order_id LIMIT 1`).bind(lifetime, walletHash, lifetime).first();
}

export function redeemInvoiceGift(db, gift, walletHash, orderId, amount) {
  // Part of the order + stock transaction. An expired grant selects NULL and
  // the NOT NULL constraint aborts the batch. The primary key prevents double use.
  return db.prepare(`INSERT INTO invoice_gift_redemptions(source_order_id, order_id, discount_fils)
    VALUES ((SELECT source_order_id FROM invoice_gifts
      WHERE source_order_id=? AND wallet_hash=? AND claimed_at > unixepoch() - ?), ?, ?)`)
    .bind(gift.source_order_id, walletHash, lifetime, orderId, amount);
}

export async function invoiceGiftEndpoint(request, env, {json, error, sameOrigin, throttle, content}, claim) {
  if (!sameOrigin(request)) return error('طلب غير مصرح', 403);
  const wallet = await giftWalletHash(request);
  if (!wallet) return error('تعذّر تحديد متصفح الهدية.', 400);
  if (!(await throttle(request, env, claim ? 'gift-claim' : 'gift-status', claim ? 30 : 120, 600))) {
    return error('جرّبي مرة ثانية بعد قليل.',429);
  }
  let status = 'status';
  if (claim) {
    const body = await content(request, 512).catch(() => null);
    if (!tokenPattern.test(body?.token || '')) return error('رمز الفاتورة غير صالح.', 400);
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE invoice_gifts SET wallet_hash=?, claimed_at=unixepoch() WHERE scan_token=? AND claimed_at IS NULL').bind(wallet, body.token),
      env.DB.prepare(`SELECT wallet_hash, claimed_at + ? AS expiry, r.order_id AS used,
        unixepoch() AS now FROM invoice_gifts g LEFT JOIN invoice_gift_redemptions r USING(source_order_id)
        WHERE g.scan_token=?`).bind(lifetime, body.token)
    ]);
    const grant = results[1].results[0];
    if (!grant) status = 'invalid';
    else if (grant.wallet_hash !== wallet) status = 'claimed';
    else if (grant.used) status = 'used';
    else if (grant.expiry <= grant.now) status = 'expired';
    else status = results[0].meta.changes ? 'activated' : 'active';
  }
  const active = await activeInvoiceGift(env.DB, wallet);
  return json({status, active: active ? {expiresAt: active.expiresAt} : null, serverTime: Date.now()});
}
