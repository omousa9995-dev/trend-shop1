export const ORDER_STATUSES = ['جديد', 'قيد التجهيز', 'تم'];
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function createOrderId(random = bytes => crypto.getRandomValues(bytes)) {
  // Reject the biased tail rather than giving some characters higher odds.
  const ceiling = 256 - (256 % alphabet.length);
  let suffix = '';
  while (suffix.length < 4) {
    for (const value of random(new Uint8Array(16))) {
      if (value < ceiling) suffix += alphabet[value % alphabet.length];
      if (suffix.length === 4) break;
    }
  }
  return 'TR-' + suffix;
}

export const isOrderId = value => typeof value === 'string' &&
  /^TR-(?:[1-9A-HJ-NP-Z]{4}|[A-Z0-9-]{5,40})$/.test(value);

export function orderIdGenerator(env) {
  // Keep the existing live email bridge compatible until its validator is updated.
  if (env.SHORT_ORDER_IDS === 'false') {
    return () => 'TR-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + crypto.randomUUID().slice(0,7).toUpperCase();
  }
  return createOrderId;
}

export async function persistOrder(db, key, statements, generateId = createOrderId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = generateId();
    try {
      // D1 batches roll back all item/stock changes when any statement fails.
      await db.batch(statements(id));
      return {id};
    } catch (error) {
      const duplicate = await db.prepare('SELECT id,subtotal_fils,shipping_fee_fils,discount_fils,promotion_snapshot,payment_method,locale FROM orders WHERE idempotency_key=?').bind(key).first();
      if (duplicate) return {duplicate};
      const collision = await db.prepare('SELECT id FROM orders WHERE id=?').bind(id).first();
      if (!collision) throw error;
    }
  }
  throw Error('ORDER_NUMBER_UNAVAILABLE');
}

export async function changeOrderStatuses(db, ids, status) {
  if (!ORDER_STATUSES.includes(status) || !Array.isArray(ids) || !ids.length ||
      ids.length > 300 || new Set(ids).size !== ids.length || ids.some(id => !isOrderId(id))) {
    return {error: 'اختاري طلبات صالحة وحالة من القائمة', status: 400};
  }
  // Stay below D1's 100 bound-parameter limit. One batch is atomic even for 300 selections.
  const groups = [];
  for (let start = 0; start < ids.length; start += 90) groups.push(ids.slice(start, start + 90));
  const found = await Promise.all(groups.map(group => db.prepare(`SELECT id FROM orders WHERE id IN (${group.map(() => '?').join(',')})`).bind(...group).all()));
  if (found.reduce((count, result) => count + result.results.length, 0) !== ids.length) {
    return {error: 'تغيّرت قائمة الطلبات؛ حدّثي القائمة ثم أعيدي التحديد', status: 409};
  }
  await db.batch(groups.map(group => db.prepare(`UPDATE orders SET status=? WHERE id IN (${group.map(() => '?').join(',')})`).bind(status, ...group)));
  return {ok: true, updated: ids.length, status};
}
