// All amounts are integer fils. The threshold is strictly above 19 JOD.
export const FREE_DELIVERY_ABOVE_FILS = 19000;
export function shippingFee(subtotalFils) {
  return Number.isInteger(subtotalFils) && subtotalFils > FREE_DELIVERY_ABOVE_FILS ? 0 : null;
}
export function shippingMessage(subtotalFils) {
  return shippingFee(subtotalFils) === 0
    ? 'توصيل مجاني لهذا الطلب ♡'
    : 'توصيل مجاني للطلبات فوق 19 دينارًا. رسوم الطلبات الأخرى تُؤكّد قبل الشحن.';
}
export function thumbnailFor(product, thumbnails = {}) {
  const primary = product.image || product.image_url;
  const reviewed = thumbnails[product.id];
  return reviewed?.primary === primary ? reviewed.thumbnail : primary;
}
