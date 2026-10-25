// Shared storefront helpers: Arabic search, stock limits, and authentic galleries.
export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('ar')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function productDetails(product) {
  if (product.details && typeof product.details === 'object') return product.details;
  try { return JSON.parse(product.details_json || '{}'); } catch { return {}; }
}
export function searchProducts(products, query) {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (!words.length) return products.slice();
  return products.map((product, index) => {
    const details = productDetails(product);
    const title = normalizeSearch(`${details.nameAr || ''} ${product.name}`);
    const text = normalizeSearch(`${title} ${product.brand} ${product.category} ${product.subcat || product.subcategory || ''}`);
    if (!words.every(word => text.includes(word))) return null;
    const score = words.reduce((sum, word) => sum + (title.startsWith(word) ? 12 : title.split(' ').some(part => part.startsWith(word)) ? 8 : title.includes(word) ? 4 : 1), 0);
    return { product, score, index };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.product);
}
export function nextQuantity(current, change, available, live) {
  const cap = live ? Math.max(0, Math.min(10, Number(available) || 0)) : 10;
  return Math.max(0, Math.min(cap, (Number(current) || 0) + change));
}
export function productGallery(product, galleries = {}) {
  const primary = product.image || product.image_url;
  const details = productDetails(product);
  const reviewed = galleries[product.id];
  // An administrator's replacement photo takes precedence over the old gallery.
  const extras = reviewed?.primary === primary ? reviewed.images || [] : [];
  return [...new Set([primary, ...(Array.isArray(details.gallery) ? details.gallery : []), ...extras])]
    .filter(url => typeof url === 'string' && (/^\/(?:images|media)\/[a-zA-Z0-9_./-]+$/.test(url) || /^https:\/\//.test(url))).slice(0, 7);
}
