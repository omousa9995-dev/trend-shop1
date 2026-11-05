// Approved product experience: physical products and complete bundles.
export const AQUA_FRESH_PILOT_ID = 'TS0081';
export const isAquaFreshPilot = id => typeof id==='string' && (/^TS[A-Z0-9-]{4,64}$/.test(id)||/^PROMO[A-Z0-9-]{6,64}$/.test(id));
export const AQUA_FRESH_COVERS = [
  '/images/catalog/TS0081-6d2d6b7dbd3c.jpg',
  '/images/catalog/marketing/TS0081-kcare-scene-b4a755f4ae2e.webp',
];
export function validVideoPoster(value) {
  return typeof value === 'string' && value.length <= 400 &&
    (value === '' || /^\/(?:images|media)\/[a-zA-Z0-9_./-]+\.(?:webp|jpe?g|png)$/i.test(value) &&
      !value.split('/').some(part => part === '..' || part === '.'));
}
