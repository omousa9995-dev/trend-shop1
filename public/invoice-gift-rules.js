export const INVOICE_GIFT_DAYS = 10;
export const INVOICE_GIFT_PERCENT = 20;
export const INVOICE_GIFT_ID = 'INVOICE-GIFT-20';

// The storefront displays prices to the piastre. Round once on the basket.
export function invoiceGiftSaving(subtotalFils) {
  return Math.min(subtotalFils, Math.round(subtotalFils * INVOICE_GIFT_PERCENT / 1000) * 10);
}
