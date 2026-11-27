import {money, retailPrice} from './commerce.js?v=5.0.0';
import {prepareSiteImage} from './site-image-upload.js?v=5.11.0';

const placeholder = '/images/TS0001.svg';
const maxPhotos = 24;

export function createFragranceManager({call, onSaved, prepare = prepareSiteImage, fetcher = fetch}) {
 const form = document.querySelector('#fragranceForm');
 const status = form.querySelector('[data-fragrance-status]');
 const result = document.querySelector('#fragranceResult');
 const filesInput = form.elements.photos;
 const price = form.elements.price;
 let id, draftCreated = false, selectedPhotos = [], completedUploads = 0;

 function report(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
 }

 function setPriceNote() {
  const fils = Math.round(Number(price.value) * 1000);
  form.querySelector('[data-fragrance-price]').textContent = price.value && price.validity.valid
   ? 'سعر البيع في المتجر: ' + money(retailPrice(fils)) : '';
 }

 price.addEventListener('input', setPriceNote);
 filesInput.addEventListener('change', () => {
  selectedPhotos = Array.from(filesInput.files || [], file => ({file, uploadId: crypto.randomUUID()}));
  completedUploads = 0;
  form.querySelector('[data-fragrance-photo-count]').textContent = selectedPhotos.length
   ? 'تم اختيار ' + selectedPhotos.length + ' صورة.' : '';
 });

 async function upload(photo, productId) {
  const body = new FormData();
  body.append('product', productId);
  body.append('uploadId', photo.uploadId);
  body.append('image', await prepare(photo.file), 'product-page.jpg');
  const response = await fetcher('/api/admin/product-photos', {
   method: 'POST', credentials: 'same-origin', headers: {'x-trend-admin': '1'},
   body, signal: AbortSignal.timeout(25000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'تعذّر رفع الصورة.');
  return data;
 }

 form.addEventListener('submit', async event => {
  event.preventDefault();
  const publish = event.submitter?.value !== 'draft';
  const fields = form.elements;
  const nameAr = fields.nameAr.value.trim();
  const name = fields.productName.value.trim() || nameAr;
  const brand = fields.brand.value.trim();
  if (nameAr.length < 2 || !brand) {
   report('اكتب اسم العطر والماركة.', true);
   return;
  }
  if (selectedPhotos.length > maxPhotos) {
   report('اختر 24 صورة أو أقل.', true);
   return;
  }
  if (publish && !selectedPhotos.length && !draftCreated) {
   report('اختر صورة واحدة على الأقل لنشر العطر.', true);
   filesInput.focus();
   return;
  }

  id ||= 'TSPF-' + crypto.randomUUID().toUpperCase();
  const priceFils = retailPrice(Math.round(Number(price.value) * 1000));
  const data = {
   id, name, brand, category: 'العطور', subcategory: 'العطور',
   stock: Number(fields.stock.value), price_fils: priceFils, reference_price_fils: priceFils,
   discount_percent: 0, description: fields.description.value.trim(),
   details: {
    nameAr, productType: 'fragrance', koreanCare: false,
    size: Number(fields.volume.value) + ' مل', variantNote: fields.concentration.value,
    benefits: fields.scentNotes.value.split('\n').map(line => line.trim()).filter(Boolean),
    en: {name, description: fields.descriptionEn.value.trim()}
   }
  };
  const request = (path, method, payload) => call(path, method, payload, {signal: AbortSignal.timeout(25000)});
  form.querySelector('fieldset').disabled = true;
  result.hidden = true;
  report('جارٍ حفظ بيانات العطر…');

  try {
   if (!draftCreated) {
    await request('products', 'POST', {...data, active: false, approved: false});
    draftCreated = true;
   }
   let gallery = await request('product-photos?product=' + encodeURIComponent(id), 'GET');
   if (selectedPhotos.length && gallery.photos.some(photo => photo.url === placeholder)) {
    gallery = await request('product-photos', 'POST', {productId: id, action: 'remove', scope: 'gallery', url: placeholder, revision: gallery.revision});
   }
   for (; completedUploads < selectedPhotos.length; completedUploads++) {
    report('جارٍ رفع الصورة ' + (completedUploads + 1) + ' من ' + selectedPhotos.length + '…');
    gallery = await upload(selectedPhotos[completedUploads], id);
   }
   const cover = gallery.photos.find(photo => photo.url !== placeholder)?.url;
   if (publish && !cover) throw Error('اختر صورة واحدة على الأقل لنشر العطر.');

   report(publish ? 'جارٍ نشر العطر…' : 'جارٍ حفظ المسودة…');
   await request('products', 'POST', {...data, image_url: cover || placeholder, active: publish, approved: publish});
   const savedId = id;
   form.reset();
   id = undefined;
   draftCreated = false;
   selectedPhotos = [];
   completedUploads = 0;
   setPriceNote();
   form.querySelector('[data-fragrance-photo-count]').textContent = '';
   report('');
   result.hidden = false;
   result.querySelector('[data-fragrance-message]').textContent = publish
    ? 'تم نشر «' + nameAr + '» في قسم العطور.' : 'حُفظ «' + nameAr + '» كمسودة.';
   const link = result.querySelector('a');
   link.hidden = !publish;
   link.href = '/product/' + encodeURIComponent(savedId);
   result.focus();
   onSaved();
  } catch (error) {
   const message = ['TimeoutError', 'AbortError'].includes(error.name)
    ? 'انتهت مهلة الاتصال. أعد المحاولة.' : error.message;
   report(message + (draftCreated ? ' يمكنك متابعة الرفع من هنا أو فتح المنتج من قائمة العطور.' : ''), true);
  } finally {
   form.querySelector('fieldset').disabled = false;
  }
 });

 setPriceNote();
}
