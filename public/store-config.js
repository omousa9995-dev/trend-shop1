// Trend Shop. Shipping amounts are in Jordanian fils (1 JOD = 1000 fils).
export const STORE_CONFIG = {
  storeName: 'Trend Shop',
  payment: {
    cashOnDelivery: true,
    manualCliQ: true
  },
  authenticity: {
    guarantee: 'جميع منتجات Trend Shop أصلية 100% ومضمونة من الوكلاء والمصادر المعتمدة.',
    inspection: 'من حقك تفحصي سلامة الطلب وتتأكدي من ختم العبوة عند الاستلام.'
  },
  shipping: {
    feeFils: 1000,
    freeAboveFils: 19000, // Free strictly above this subtotal, after discounts.
    amman: { minHours: 0, maxHours: 24 }, // 0 means same day is possible.
    governorates: { minHours: 24, maxHours: 48 },
    coordination: 'بنتواصل معكِ هاتفيًا أو على واتساب لتنسيق وقت التسليم قبل وصول المندوب.'
  },
  supportWhatsApp: 'https://wa.me/962790025430'
};
