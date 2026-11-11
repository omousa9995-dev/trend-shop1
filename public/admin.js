import {filterAdminProducts,koreanCareChoice,applyKoreanCareChoice,collectionHint,publicationHint,parseCategoryChoice,categoryChoiceValue} from './admin-product-tools.js?v=5.14.1';
import {isKoreanCare} from './korean-care.js?v=5.14.0';
import {availableBrands} from './brand-tools.js';
import {productDetails} from './shop-tools.js';
import {createProductPhotoManager} from './product-photos-admin.js?v=5.11.0';
import {createMediaLibrary} from './media-library-admin.js?v=5.11.0';
import {createInvoicePrinter} from './invoice-print.js?v=5.10.1';
import {createExperienceMetricsPanel} from './experience-metrics-admin.js?v=5.9.0';
import {createCustomerReportManager} from './customer-report-admin.js?v=5.7.2';
import {createFeaturedVideoManager} from './product-featured-video-admin.js?v=5.4.0';
import {pairPriceFils} from './pair-pricing.js?v=5.0.0';
import {createSiteSettingsManager} from './site-settings-admin.js?v=5.6.0';
import {orderDisplayItems,orderLineTotal} from './order-presentation.js';
import {createProductVideoManager} from './product-videos-admin.js?v=5.4.0';
import {createReviewManager} from './reviews-admin.js?v=3.0.0';
import {optionSummary,SKIN_TONES,usesSkinTones} from './product-variants.js?v=5.9.0';
import {PRODUCT_TYPES} from './product-types.js?v=2.3.0';
import {money,retailPrice,actualDiscount} from './commerce.js?v=5.0.0';
import {createPromotionManager} from './promotions-admin.js?v=3.1.0';
import {invoice} from './invoice.js?v=5.9.0';
(()=>{'use strict';const $=(s,r=document)=>r.querySelector(s),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const jordanDate=s=>{try{return new Date(String(s).replace(' ','T')+'Z').toLocaleString('ar-JO',{timeZone:'Asia/Amman',dateStyle:'medium',timeStyle:'short'})}catch{return s}};const state={products:[],orders:[],filter:'all',ordersLoading:false,ordersSaving:false,invoiceSelection:new Set(),logged:false,live:false};let currentProductDetails={},currentProductImage='',productSaving=false;let orderLoadSequence=0,preparingTodayInvoices=false;const cats=['البشرة','المكياج','الشعر','الجسم','العطور','الأدوات'];
const invoicePrinter=createInvoicePrinter({root:$('#printRoot'),render:invoice});
const customerReportManager=createCustomerReportManager({call});
const experiencePanel=createExperienceMetricsPanel({call});
const reviewManager=createReviewManager({call});
const siteManager=createSiteSettingsManager({call,getProducts:()=>state.products});
const photoManager=createProductPhotoManager({call});
const mediaLibrary=createMediaLibrary({call,onChange:()=>loadProducts(),onEdit:id=>{activeTab('products');openEditor(state.products.find(p=>p.id===id))}});
const videoManager=createProductVideoManager({call});
const featuredVideoManager=createFeaturedVideoManager({call});
const promotionManager=createPromotionManager({call,getProducts:()=>state.products,refreshProducts:()=>loadProducts()});
async function call(path,method='GET',data){const response=await fetch('/api/admin/'+path,{method,credentials:'same-origin',headers:{...(data?{'content-type':'application/json','x-trend-admin':'1'}:{})},body:data?JSON.stringify(data):undefined});let result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'تعذر تنفيذ العملية');return result}
async function start(){try{const j=await call('me');state.logged=true;state.live=!!j.live;show();experiencePanel.load();await Promise.all([loadOrders(),loadProducts()]);await promotionManager.load();}catch{$('#loginView').hidden=false;$('#dashboardView').hidden=true}}
function show(){$('#loginView').hidden=true;$('#dashboardView').hidden=false;$('#liveStatus').textContent=state.live?'المتجر يستقبل طلبات':'مرحلة الإعداد — الطلبات غير مفعّلة';$('#liveStatus').classList.toggle('live',state.live)}
$('#loginForm').onsubmit=async e=>{e.preventDefault();const pass=$('#password').value;$('#loginError').textContent='';try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:pass})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'تعذر الدخول');$('#password').value='';await start()}catch(e){$('#loginError').textContent=e.message}};
$('#logoutBtn').onclick=async()=>{await call('logout','POST').catch(()=>{});location.reload()};
function activeTab(tab){if(tab==='media')mediaLibrary.load();if(tab==='overview')experiencePanel.load();customerReportManager.setActive(tab==='customers');for(const name of ['overview','orders','products','promotions','reviews','site','customers','media']){const button=$('#'+name+'Tab');button.classList.toggle('active',tab===name);if(tab===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');$('#'+name+'Section').hidden=tab!==name}}
$('#mediaTab').onclick=()=>activeTab('media');
$('#customersTab').onclick=()=>activeTab('customers');
$('#overviewTab').onclick=()=>activeTab('overview');
document.querySelectorAll('[data-admin-go]').forEach(button=>button.onclick=async()=>{const tab=button.dataset.adminGo;activeTab(tab);if(tab==='site'){await siteManager.load();siteManager.focus(button.dataset.siteFocus||'identity')}if(tab==='reviews')reviewManager.load()});
document.querySelector('[data-owner-new]').onclick=()=>{activeTab('products');openEditor(null)};
document.querySelector('[data-owner-korean]').onclick=()=>{activeTab('products');$('#productCollectionFilter').value='korean';renderProducts();openEditor(null,{korean:true})};
function updateOwnerCounts(){document.querySelector('[data-owner-count=products]').textContent=state.products.length;document.querySelector('[data-owner-count=korean]').textContent=state.products.filter(isKoreanCare).length;document.querySelector('[data-owner-count=newOrders]').textContent=state.orders.filter(o=>o.status==='جديد').length;}
$('#reviewsTab').onclick=()=>{activeTab('reviews');reviewManager.load()};$('#refreshReviews').onclick=()=>reviewManager.load();
$('#siteTab').onclick=()=>{activeTab('site');siteManager.load()};
$('#ordersTab').onclick=()=>activeTab('orders');$('#productsTab').onclick=()=>activeTab('products');$('#promotionsTab').onclick=()=>activeTab('promotions');
function syncInvoiceSelection(){
 const ids=new Set(state.orders.map(order=>order.id));for(const id of state.invoiceSelection)if(!ids.has(id))state.invoiceSelection.delete(id);
 const count=state.invoiceSelection.size,total=state.orders.length,all=$('#selectAllInvoices'),busy=state.ordersLoading||state.ordersSaving;
 all.checked=total>0&&count===total;all.indeterminate=count>0&&count<total;all.disabled=busy||!total;
 $('#invoiceSelectionCount').textContent='الطلبات المحددة: '+count+' من '+total;
 $('#printToday').disabled=busy||preparingTodayInvoices;
 const print=$('#printSelectedInvoices');print.textContent='طباعة الفواتير المحددة ('+count+')';print.disabled=busy||!count;
 $('#clearInvoiceSelection').disabled=busy||!count;
 document.querySelectorAll('[data-select-invoice]').forEach(input=>{input.checked=state.invoiceSelection.has(input.dataset.selectInvoice);input.disabled=busy;input.closest('.order-card').classList.toggle('invoice-selected',input.checked)});
 $('#bulkOrderStatus').disabled=busy||!count;$('#applyOrderStatus').disabled=busy||!count||!$('#bulkOrderStatus').value;
 document.querySelectorAll('[data-status-id]').forEach(input=>input.disabled=busy);
 document.querySelectorAll('[data-filter],#refreshOrders').forEach(button=>button.disabled=state.ordersSaving);
 document.querySelectorAll('[data-print-order]').forEach(button=>button.disabled=busy);
}
async function loadOrders(){const sequence=++orderLoadSequence;state.ordersLoading=true;syncInvoiceSelection();try{const j=await call('orders?filter='+state.filter);if(sequence!==orderLoadSequence)return;state.orders=j.orders||[];renderOrders()}catch(e){if(sequence!==orderLoadSequence)return;state.orders=[];state.invoiceSelection.clear();renderOrders();$('#ordersList').textContent=e.message}finally{if(sequence===orderLoadSequence){state.ordersLoading=false;syncInvoiceSelection()}}}
$('#selectAllInvoices').onchange=e=>{if(state.ordersLoading||state.ordersSaving)return;if(e.target.checked)state.orders.forEach(order=>state.invoiceSelection.add(order.id));else state.invoiceSelection.clear();syncInvoiceSelection()};
$('#clearInvoiceSelection').onclick=()=>{if(state.ordersLoading||state.ordersSaving)return;state.invoiceSelection.clear();syncInvoiceSelection()};
$('#printSelectedInvoices').onclick=()=>{if(state.ordersLoading||state.ordersSaving||!state.invoiceSelection.size)return;printInvoices(state.orders.filter(order=>state.invoiceSelection.has(order.id)))};
const statusOptions=['جديد','قيد التجهيز','تم'];
$('#bulkOrderStatus').onchange=syncInvoiceSelection;
async function saveStatuses(ids,status){
 if(state.ordersLoading||state.ordersSaving)return;
 state.ordersSaving=true;$('#orderStatusMessage').textContent='جارٍ تحديث حالة الطلبات…';$('#orderStatusMessage').classList.remove('error');syncInvoiceSelection();
 try{const result=await call('orders','POST',{ids,status});$('#orderStatusMessage').textContent='تم تحويل '+result.updated+' طلب إلى «'+status+'».';await loadOrders();}
 catch(error){$('#orderStatusMessage').textContent=error.message;$('#orderStatusMessage').classList.add('error');}
 finally{state.ordersSaving=false;syncInvoiceSelection();}
}
$('#applyOrderStatus').onclick=()=>{const status=$('#bulkOrderStatus').value;if(!status||!state.invoiceSelection.size)return;saveStatuses(state.orders.filter(order=>state.invoiceSelection.has(order.id)).map(order=>order.id),status);};

function renderOrders(){updateOwnerCounts();const os=state.orders;$('#metrics').innerHTML=`<div class="metric"><b>${os.length}</b><span>طلبات الفلتر الحالي</span></div><div class="metric"><b>${os.filter(o=>o.status==='جديد').length}</b><span>طلبات جديدة</span></div><div class="metric"><b>${os.filter(o=>o.status==='قيد التجهيز').length}</b><span>قيد التجهيز</span></div><div class="metric"><b>${money(os.reduce((s,o)=>s+o.subtotal_fils,0))}</b><span>قيمة المنتجات (دون التوصيل)</span></div>`;$('#ordersList').innerHTML=os.length?os.map(o=>`<article class="order-card"><div class="order-top"><div><label class="invoice-select"><input type="checkbox" data-select-invoice="${safe(o.id)}" aria-label="تحديد الطلب ${safe(o.id)}"/> تحديد الطلب</label><strong dir="ltr">${safe(o.id)}</strong><small>${safe(jordanDate(o.created_at))} — الأردن · ${safe(o.name)} · <bdi dir="ltr">${safe(o.phone)}</bdi></small></div><div class="order-meta"><b>${money(o.subtotal_fils+Number(o.shipping_fee_fils||0))}</b><select data-status-id="${safe(o.id)}" aria-label="حالة الطلب">${statusOptions.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select><button class="minor" data-toggle-order="${safe(o.id)}">التفاصيل</button><button class="minor" data-print-order="${safe(o.id)}">فاتورة A4</button></div></div><div class="order-detail" id="details-${safe(o.id)}" hidden><div><p><b>الاسم:</b> ${safe(o.name)}</p><p><b>الهاتف:</b> <bdi dir="ltr">${safe(o.phone)}</bdi></p><p><b>التوصيل:</b> ${o.shipping_fee_fils===0?'مجاني':o.shipping_fee_fils===null||o.shipping_fee_fils===undefined?'يُؤكّد للطلب السابق':money(o.shipping_fee_fils)}</p><p><b>المحافظة:</b> ${safe(o.governorate)}</p><p><b>العنوان:</b> ${safe(o.address)}</p></div><div><p><b>الدفع:</b> ${o.payment_method==='cod'?'عند الاستلام':'CliQ يدوي'}</p><p><b>Alias الزبونة:</b> ${safe(o.cliq_alias||'—')}</p><p><b>الإيميل:</b> ${safe(o.email||'—')}</p><p><b>ملاحظة:</b> ${safe(o.notes||'—')}</p><p><b>إرسال البريد:</b> ${safe(o.notification_status)}</p></div><div class="items">${orderDisplayItems(o).map(x=>`<div class="item"><img src="${safe(x.image_snapshot||'/images/TS0001.svg')}" alt=""/><span>${safe(x.name_snapshot)}${optionSummary(x)?`<small class="invoice-options">${safe(optionSummary(x))}</small>`:''}<br/><b>${x.qty} ${x.kind==='bundle'?'باكيج':'قطعة'} · ${money(orderLineTotal(x))}</b></span></div>`).join('')}</div></div></article>`).join(''):'<div class="empty-msg">لا توجد طلبات في هذا القسم حاليًا.</div>';
 syncInvoiceSelection();document.querySelectorAll('[data-select-invoice]').forEach(input=>input.onchange=()=>{if(state.ordersLoading||state.ordersSaving)return;input.checked?state.invoiceSelection.add(input.dataset.selectInvoice):state.invoiceSelection.delete(input.dataset.selectInvoice);syncInvoiceSelection()});
 document.querySelectorAll('[data-status-id]').forEach(el=>el.onchange=async()=>{const original=state.orders.find(order=>order.id===el.dataset.statusId)?.status;await saveStatuses([el.dataset.statusId],el.value);if(el.isConnected&&original)el.value=original;});document.querySelectorAll('[data-toggle-order]').forEach(b=>b.onclick=()=>{const el=document.getElementById('details-'+b.dataset.toggleOrder);el.hidden=!el.hidden});document.querySelectorAll('[data-print-order]').forEach(b=>b.onclick=()=>printInvoices(state.orders.filter(o=>o.id===b.dataset.printOrder)))}
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=async()=>{if(state.ordersSaving)return;if(state.filter!==b.dataset.filter)state.invoiceSelection.clear();state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));await loadOrders()});
$('#refreshOrders').onclick=loadOrders;
function printInvoices(orders){if(invoicePrinter.show(orders))return;const message=$('#orderStatusMessage');message.textContent='لا توجد فواتير للطباعة في الاختيار الحالي.';message.classList.add('error');message.focus?.()}
$('#printToday').onclick=async()=>{if(preparingTodayInvoices||state.ordersLoading||state.ordersSaving)return;preparingTodayInvoices=true;syncInvoiceSelection();const message=$('#orderStatusMessage');message.textContent='جارٍ تحميل فواتير اليوم…';message.classList.remove('error');try{const j=await call('orders?filter=today');message.textContent='';printInvoices(j.orders||[])}catch{message.textContent='تعذّر تحميل فواتير اليوم. تحققي من الاتصال وسجّلي الدخول مجددًا إذا انتهت الجلسة.';message.classList.add('error')}finally{preparingTodayInvoices=false;syncInvoiceSelection()}};
async function loadProducts(){try{const j=await call('products');state.products=j.products||[];renderProducts()}catch(e){$('#productsBody').innerHTML=`<tr><td colspan="6">${safe(e.message)}</td></tr>`}}
function renderProducts(){
 updateOwnerCounts();
 const list=filterAdminProducts(state.products,{query:$('#productSearch').value,collection:$('#productCollectionFilter').value,category:$('#productCategoryFilter').value,status:$('#productStatusFilter').value});
 const koreanCount=state.products.filter(isKoreanCare).length,low=state.products.filter(p=>Number(p.stock)>0&&Number(p.stock)<=5).length;
 $('#productCount').innerHTML=`${list.length} / ${state.products.length} منتج<small>${koreanCount} في Korean care · ${low} بمخزون منخفض</small>`;
 $('#productBrandSuggestions').innerHTML=availableBrands(state.products).map(brand=>`<option value="${safe(brand)}"></option>`).join('');
 $('#productsBody').innerHTML=list.length?list.map(p=>{const d=productDetails(p)||{};return `<tr><td><div><img loading="lazy" width="50" height="50" src="${safe(p.image_url||'/images/TS0001.svg')}" alt=""/><span><b dir="auto">${safe(d.nameAr||p.name)}</b><br/><small>${safe(p.brand)} · ${safe(p.category)}</small><span class="product-row-id" dir="ltr">${safe(p.id)}</span>${isKoreanCare(p)?'<span class="chip product-korean-chip">Korean care</span>':''}</span></div></td><td data-label="السعر">${money(p.price_fils)}</td><td data-label="الخصم">${p.discount_percent}%</td><td data-label="المخزون">${p.stock}</td><td data-label="الحالة"><span class="chip ${p.approved?'ok':''}">${p.approved?'معتمد':'مسودة'}</span> <span class="chip ${p.active?'ok':''}">${p.active?'ظاهر':'مخفي'}</span></td><td class="product-row-actions"><button type="button" class="minor" data-product-discount="${safe(p.id)}">تعديل الخصم %</button> <button type="button" class="minor" data-edit="${safe(p.id)}">تعديل المنتج</button> <a class="minor" href="/#/product/${encodeURIComponent(p.id)}" target="_blank" rel="noopener noreferrer">معاينة ↗</a> <button type="button" class="minor" data-hide="${safe(p.id)}">${p.active?'إخفاء من المتجر':'إظهار في المتجر'}</button></td></tr>`;}).join(''):'<tr><td colspan="6" class="product-empty-state">لا توجد منتجات تطابق الفلاتر. امسح الفلاتر أو أضف منتجًا جديدًا.</td></tr>';
 document.querySelectorAll('[data-product-discount]').forEach(b=>b.onclick=()=>{activeTab('promotions');promotionManager.openDiscount([b.dataset.productDiscount])});
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(state.products.find(p=>p.id===b.dataset.edit)));
 document.querySelectorAll('[data-hide]').forEach(b=>b.onclick=async()=>{const p=state.products.find(x=>x.id===b.dataset.hide);if(!p)return;const next=!p.active;if(!confirm(next?'هل تريد استعادة عرض المنتج في المتجر؟ سيبقى غير متاح للشراء إلا بعد اعتماده وتوفر المخزون.':'سيُخفى المنتج من المتجر، وتبقى بياناته وسجلات الطلبات محفوظة. متابعة؟'))return;try{await call('products','POST',{...p,reference_price_fils:p.reference_price_fils,discount_percent:p.discount_percent,active:next});await loadProducts()}catch(e){alert(e.message)}});
}
$('#productSearch').oninput=renderProducts;
for(const id of ['productCollectionFilter','productCategoryFilter','productStatusFilter'])$('#'+id).onchange=renderProducts;
$('#clearProductFilters').onclick=()=>{for(const id of ['productSearch','productCollectionFilter','productCategoryFilter','productStatusFilter'])$('#'+id).value='';renderProducts()};
$('#addProduct').onclick=()=>openEditor(null);
$('#addKoreanProduct').onclick=()=>openEditor(null,{korean:true});
$('#closeEditor').onclick=()=>{if(productSaving)return;photoManager.cancel();videoManager.cancel();featuredVideoManager.cancel();$('#productForm').reset();$('#editorOverlay').hidden=true};
$('#cancelProductEdit').onclick=()=>$('#closeEditor').click();
function syncProductContext(){
 const f=$('#productForm'),choice=f.elements.koreanCare.value;
 $('#koreanCareHelp').textContent=collectionHint(choice,f.elements.brand.value);
 const details=applyKoreanCareChoice(currentProductDetails,choice,f.elements.brand.value);
 const category=parseCategoryChoice(f.elements.category.value).category,korean=isKoreanCare({brand:f.elements.brand.value,details});
 f.elements.category.value=categoryChoiceValue(category,korean);f.elements.category.dataset.baseCategory=category;
 $('#productCategoryHelp').textContent=korean?'سيظهر في Korean care وفي '+categoryLabel(category)+' معًا بعد الحفظ.':'سيظهر في '+categoryLabel(category)+'. اختر من مجموعة «الفئة + Korean care» لإضافته للقسمين.';
 $('#productPublishStatus').textContent=publicationHint({active:f.elements.active.checked,approved:f.elements.approved.checked,stock:f.elements.stock.value,korean});
}
function categoryLabel(category){return {البشرة:'العناية بالبشرة',الشعر:'العناية بالشعر',الجسم:'العناية بالجسم',المكياج:'المكياج',العطور:'العطور',الأدوات:'أدوات الجمال'}[category]||category}
function categoryOptions(){return '<optgroup label="الفئة فقط">'+cats.map(c=>`<option value="${c}">${categoryLabel(c)}</option>`).join('')+'</optgroup><optgroup label="الفئة + Korean care">'+cats.map(c=>`<option value="${categoryChoiceValue(c,true)}">Korean care + ${categoryLabel(c)}</option>`).join('')+'</optgroup>'}
function openEditor(p,{korean=false}={}){
 const preview=$('#previewProductLink');preview.hidden=!p;if(p)preview.href='/#/product/'+encodeURIComponent(p.id);
 const f=$('#productForm');f.reset();currentProductDetails=productDetails(p||{})||{};
 for(const key of ['name','tagline','description','benefits','howToUse','notes','variantNote'])f.elements['en-'+key].value=key==='benefits'?(currentProductDetails.en?.benefits||[]).join('\n'):currentProductDetails.en?.[key]||'';
 f.elements.nameAr.value=currentProductDetails.nameAr||'';f.elements.tagline.value=currentProductDetails.tagline||'';f.elements.benefits.value=(currentProductDetails.benefits||[]).join('\n');f.elements.howToUse.value=currentProductDetails.howToUse||'';f.elements.productNotes.value=currentProductDetails.notes||'';
 $('#editorTitle').textContent=p?'تعديل المنتج':korean?'إضافة منتج إلى Korean care':'إضافة منتج جديد';$('#editorError').textContent='';$('#productSaveMessage').textContent='';
 f.elements.koreanCare.value=korean?'include':koreanCareChoice(p);
 f.elements.category.innerHTML=categoryOptions();f.elements.id.value=p?.id||'';f.elements.name.value=p?.name||'';f.elements.brand.value=p?.brand||'';f.elements.category.value=p?.category||'البشرة';currentProductImage=p?.image_url||'/images/TS0001.svg';f.elements.size.value=currentProductDetails.size||'';f.elements.shade.value=currentProductDetails.shade||'';f.elements.variantNote.value=currentProductDetails.variantNote||'';
 fillProductTypes(currentProductDetails.productType||'');f.elements.subcategory.value=p?.subcategory||'';f.elements.description.value=p?.description||'';f.elements.referenceJod.value=p?(p.reference_price_fils/1000).toFixed(2):'';f.elements.discount_percent.value=p?.discount_percent||0;f.elements.priceJod.value=p?(p.price_fils/1000).toFixed(2):'';$('#productPricePreview').textContent='';
 f.elements.stock.value=p?.stock??24;f.elements.image_url.value=p?.image_url||'/images/TS0001.svg';f.elements.approved.checked=!!p?.approved;f.elements.active.checked=p?.active!==0;
 renderToneEditor();syncProductContext();$('.editor-card').scrollTop=0;$('#editorOverlay').hidden=false;photoManager.select(p);videoManager.select(p);featuredVideoManager.select(p);
}
for(const name of ['koreanCare','brand','stock','active','approved']){const input=$('#productForm').elements[name];input.addEventListener('input',syncProductContext);input.addEventListener('change',syncProductContext)}
function fillProductTypes(selected=''){const f=$('#productForm'),category=parseCategoryChoice(f.elements.category.value).category;f.elements.productType.innerHTML='<option value="">تلقائي بحسب الاسم</option>'+PRODUCT_TYPES.filter(t=>t.category===category).map(t=>`<option value="${t.id}" ${selected===t.id?'selected':''}>${safe(t.label)}</option>`).join('')}
function renderToneEditor(){const f=$('#productForm'),p={name:f.elements.name.value,category:parseCategoryChoice(f.elements.category.value).category,details:{productType:f.elements.productType.value,nameAr:f.elements.nameAr.value}};$('#toneEditor').hidden=!usesSkinTones(p);if(!$('#toneCodeFields').children.length)$('#toneCodeFields').innerHTML=SKIN_TONES.map(x=>`<label>${safe(x.label)} · كود الشركة (اختياري)<input class="input" name="shadeCode-${x.id}" maxlength="60"/></label>`).join('');for(const x of SKIN_TONES)f.elements['shadeCode-'+x.id].value=currentProductDetails.shadeCodes?.[x.id]||'';}
$('#productForm').elements.category.addEventListener('change',()=>{
 const f=$('#productForm'),previous=f.elements.category.dataset.baseCategory,choice=parseCategoryChoice(f.elements.category.value);
 f.elements.koreanCare.value=choice.korean?'include':'exclude';syncProductContext();
 if(previous!==choice.category){fillProductTypes();renderToneEditor()}
});
$('#productForm').elements.productType.addEventListener('change',renderToneEditor);
$('#productForm').onsubmit=async e=>{
 e.preventDefault();if(productSaving)return;const f=e.currentTarget;
 if(f.dataset.cardUploadBusy==='true'||photoManager.busy||videoManager.busy||featuredVideoManager.busy){$('#editorError').textContent='انتظر اكتمال رفع الصور والفيديو قبل حفظ المنتج.';return}
 // Keep one product ID for a new draft across network failures and retries.
 if(!f.elements.id.value)f.elements.id.value='TS'+crypto.randomUUID().slice(0,8).toUpperCase();
 const details=applyKoreanCareChoice({...currentProductDetails,en:{...(currentProductDetails.en||{}),...Object.fromEntries(['name','tagline','description','benefits','howToUse','notes','variantNote'].map(key=>[key,key==='benefits'?f.elements['en-'+key].value.split('\n').map(x=>x.trim()).filter(Boolean):f.elements['en-'+key].value]))},...(f.elements.image_url.value!==currentProductImage?{imageEditedWithAI:false,imageNote:''}:{}),productType:f.elements.productType.value,shadeCodes:Object.fromEntries(SKIN_TONES.map(x=>[x.id,f.elements['shadeCode-'+x.id]?.value||''])),size:f.elements.size.value,shade:f.elements.shade.value,variantNote:f.elements.variantNote.value,introductoryOffer:false,nameAr:f.elements.nameAr.value,tagline:f.elements.tagline.value,benefits:f.elements.benefits.value.split('\n').map(x=>x.trim()).filter(Boolean),howToUse:f.elements.howToUse.value,notes:f.elements.productNotes.value,imageType:/\.svg(?:\?|$)/.test(f.elements.image_url.value)?'illustration':'photo'},f.elements.koreanCare.value,f.elements.brand.value);
 const data={id:f.elements.id.value,name:f.elements.name.value,brand:f.elements.brand.value,category:parseCategoryChoice(f.elements.category.value).category,subcategory:f.elements.subcategory.value,description:f.elements.description.value,details,reference_price_fils:Math.round(Number(f.elements.referenceJod.value)*1000),price_fils:Math.round(Number(f.elements.priceJod.value)*1000),discount_percent:Number(f.elements.discount_percent.value),stock:Number(f.elements.stock.value),image_url:f.elements.image_url.value||'/images/TS0001.svg',approved:f.elements.approved.checked,active:f.elements.active.checked};
 const keepEditing=e.submitter?.id==='saveProductMedia',buttons=[...f.querySelectorAll('[type=submit]')],labels=buttons.map(b=>b.textContent);
 $('#editorError').textContent='';$('#productSaveMessage').textContent='';productSaving=true;buttons.forEach(b=>{b.disabled=true;b.textContent='جارٍ حفظ المنتج…'});
 try{
  const result=await call('products','POST',data),savedId=result.id||data.id;
  photoManager.cancel();videoManager.cancel();featuredVideoManager.cancel();
  await loadProducts();
  if(keepEditing){
   openEditor(state.products.find(p=>p.id===savedId)||{...data,id:savedId,details_json:JSON.stringify(details)});
   $('#productSaveMessage').textContent='حُفظ المنتج. يمكنك الآن إضافة عدة صور للصفحة من القسم أدناه؛ صورة البطاقة مستقلة.';
   $('#productPhotosPanel').scrollIntoView?.({behavior:'smooth',block:'start'});
  }else $('#editorOverlay').hidden=true;
 }catch(err){$('#editorError').textContent=err.message}
 finally{productSaving=false;buttons.forEach((b,i)=>{b.disabled=false;b.textContent=labels[i]})}
};
const priceForm=$('#productForm');function pricePreview(){const reference=Math.round(Number(priceForm.elements.referenceJod.value)*1000),price=retailPrice(Number(priceForm.elements.priceJod.value)*1000);$('#productPricePreview').textContent=reference?'سعر البيع: '+money(price)+' · الخصم الفعلي: '+actualDiscount(reference,price)+'% · سعر القطعتين: '+money(pairPriceFils(price)):''}for(const name of ['referenceJod','discount_percent'])priceForm.elements[name].addEventListener('input',()=>{const raw=Math.round(Number(priceForm.elements.referenceJod.value)*10*(100-Number(priceForm.elements.discount_percent.value)));priceForm.elements.priceJod.value=(retailPrice(raw)/1000).toFixed(2);pricePreview()});priceForm.elements.priceJod.addEventListener('input',pricePreview);priceForm.elements.priceJod.addEventListener('blur',()=>{if(priceForm.elements.priceJod.value)priceForm.elements.priceJod.value=(retailPrice(Number(priceForm.elements.priceJod.value)*1000)/1000).toFixed(2);pricePreview()});
start()})();
