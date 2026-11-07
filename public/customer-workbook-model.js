import {customerOrderDate,META_CUSTOMER_HEADERS} from './customer-report.js';

export const columnName=index=>{let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const cell=(v,style='text',f)=>({v:v??'',style,...(f?{f}:{})});
const text=v=>cell(v),num=v=>cell(v,'number'),money=v=>cell(v==null?'':v/1000,'money'),date=v=>cell(v,'date');
const formula=(f,v,style='number')=>cell(v,style,f);
const sheet=(name,title,headers,widths,rows,note,printLast)=>({name,title,headers,widths,rows:rows.length?rows:[headers.map(()=>text(''))],note,printLast:printLast||headers.length,table:true});
const quoted=name=>`'${name}'`;
export function customerWorkbookModel(report){
 const {orders,contacts,items,metaRows,summary:s}=report,end=Math.max(7,orders.length+6),contactEnd=Math.max(7,contacts.length+6),itemEnd=Math.max(7,items.length+6);
 const o=(col)=>`${quoted('الطلبات')}!$${col}$7:$${col}$${end}`,c=(col)=>`${quoted('الزبائن')}!$${col}$7:$${col}$${contactEnd}`;
 const notes=Object.values(report.notes),filterText=`الفترة: ${report.filters.from||'البداية'} ← ${report.filters.to||'الآن'} | الحالة: ${{all:'جميع الحالات',completed:'تم',new:'جديد',processing:'قيد التجهيز'}[report.filters.status||'all']||'جميع الحالات'}`;
 const sourceText=`المصدر: فواتير Trend Shop | آخر استخراج: ${customerOrderDate(report.asOf).dateLocal} بتوقيت عمّان | JOD`;
 const orderRows=orders.map(r=>[text(r.id),date(r.dateSerial),text(r.status),text(r.fullName),text(r.phone),text(r.email),text(r.governorate),text(r.address),text(r.types),text(r.products),money(r.totalFils),money(r.goodsFils),money(r.shippingFils),money(r.discountFils),text(r.contactKey),text(r.flags.join('؛ ')),text(r.phoneOriginal)]);
 const contactRows=contacts.map((r,i)=>{const row=i+7,key=`A${row}`;return [text(r.key),text(r.fullName),text(r.firstName),text(r.lastName),text(r.phone),text(r.email),text(r.governorate),text(r.address),formula(`COUNTIF(${o('O')},${key})`,r.orderCount),formula(`COUNTIFS(${o('O')},${key},${o('C')},"تم")`,r.completedCount),formula(`SUMIF(${o('O')},${key},${o('L')})`,r.goodsFils/1000,'money'),formula(`SUMIFS(${o('L')},${o('O')},${key},${o('C')},"تم")`,r.completedGoodsFils/1000,'money'),date(r.firstDateSerial),date(r.lastDateSerial),text(r.types),text([r.nameNote,...r.flags].join('؛ ')),text(r.marketingPermission)];});
 const productRows=items.map(r=>[text(r.orderId),text(r.productId),text(r.name),text(r.type),text(r.category),text(r.brand),num(r.qty),money(r.unitPriceFils)]);
 const metaData=metaRows.map(r=>META_CUSTOMER_HEADERS.map(k=>k==='value'?cell(r[k],'money'):text(r[k])));
 const rows=[
  [text('المؤشر'),text('القيمة'),text('التفسير')],
  [text('إجمالي الفواتير'),formula(`COUNTIF(${o('A')},"?*")`,s.orderCount),text('حسب الفترة والحالة المختارتين')],
  [text('جهات الاتصال'),formula(`COUNTIF(${c('A')},"?*")`,s.contactCount),text('حسب الهاتف الدولي أو البريد؛ ليست عدد أشخاص مؤكدًا')],
  [text('فواتير حالتها تم'),formula(`COUNTIF(${o('C')},"تم")`,s.completedCount),text('بحسب حالة الفاتورة المسجلة')],
  [text('قيمة منتجات فواتير تم'),formula(`SUMIF(${o('C')},"تم",${o('L')})`,s.completedGoodsFils/1000,'money'),text('بعد خصومات الفواتير، دون التوصيل؛ ليست إثبات تحصيل')],
  [text('إجمالي المنتجات لكل الحالات'),formula(`SUM(${o('L')})`,s.goodsFils/1000,'money'),text('لا يمثل مبيعات مكتملة لجميع الحالات')],
  [text('إجمالي الطلبات المعروف'),formula(`SUM(${o('K')})`,s.knownTotalFils/1000,'money'),text('يشمل التوصيل للطلبات ذات الإجمالي المعروف فقط')],
  [text('إجمالي غير مكتمل'),num(s.unknownTotalCount),text('توجد قيمة منتجات أو توصيل غير مسجلة')],
  [text('متوسط الطلب المعروف'),formula(`IF(COUNT(${o('K')})=0,0,AVERAGE(${o('K')}))`,s.averageKnownOrderFils==null?0:s.knownTotalFils/(orders.length-s.unknownTotalCount)/1000,'money'),text('فقط الفواتير التي تحتوي قيمة المنتجات والتوصيل')],
  [text('جهات اتصال متكررة'),formula(`COUNTIF(${c('I')},">1")`,s.repeatContacts),text('جهة اتصال لها أكثر من فاتورة ضمن الفترة')],
  [text('هواتف تحتاج مراجعة'),num(s.invalidPhones),text('العدد حسب الفواتير؛ الهاتف الأصلي محفوظ')],
  [text('بريد غير متوفر أو غير صالح'),num(s.missingEmails),text('البريد الإلكتروني اختياري')],
  [text('اسم عائلة غير متوفر'),num(s.missingLastNames),text('من جهات الاتصال المجمعة؛ التقسيم آلي')],
  [text('جهات اتصال في ملف Meta'),num(s.metaContacts),text('فواتير تم فقط ومعرّف هاتف أو بريد صالح')],
  [text('عدد القطع المطلوبة'),formula(`SUM('المنتجات'!$G$7:$G$${itemEnd})`,s.quantity),text('جميع الحالات ضمن الفترة المختارة')],
  [text(''),text(''),text('')],
  [text('نوع المنتج'),text('القطع المطلوبة'),text('من جميع الفواتير المحددة')],
  ...report.topTypes.map(r=>[text(r.name),formula(`SUMIF('المنتجات'!$D$7:$D$${itemEnd},A${23+report.topTypes.indexOf(r)},'المنتجات'!$G$7:$G$${itemEnd})`,r.count),text('تصنيف الكتالوج الحالي')]),
  [text(''),text(''),text('')],
  [text('المحافظة'),text('عدد الطلبات'),text('من جميع الفواتير المحددة')],
  ...report.topGovernorates.map(r=>[text(r.name),num(r.count),text('حسب عنوان التوصيل')]),
  [text(''),text(''),text('')],
  ...notes.map((v,i)=>[text(`ملاحظة ${i+1}`),text(''),text(v)])
 ];
 // Header is row 6; type rows start at row 23 (index 17 in rows).
 const overview=sheet('ملخص','Trend Shop | تقرير الزبائن والطلبات',rows[0].map(x=>x.v),[35,24,94],rows.slice(1),'تقرير قراءة فقط. يتجدد عند كل تنزيل؛ الملف المحمّل لقطة وقتية. لا يرسل بيانات إلى أي جهة.',3);overview.table=false;
 const sheets=[overview,
  sheet('الطلبات','الفواتير | البيانات الأصلية المطلوبة',['رقم الفاتورة','تاريخ الطلب — عمّان','الحالة','الاسم الكامل','الهاتف الدولي','البريد الإلكتروني','المحافظة','العنوان التفصيلي','أنواع المنتجات','المنتجات والكميات','قيمة الطلب JOD','المنتجات بعد الخصم JOD','التوصيل JOD','الخصم JOD','مفتاح جهة الاتصال','مراجعة البيانات','الهاتف الأصلي'],[23,24,18,29,22,32,18,45,32,65,19,22,18,18,28,48,24],orderRows,notes[1],11),
  sheet('الزبائن','جهات الاتصال | تجميع الطلبات المتكررة',['مفتاح جهة الاتصال','الاسم الكامل','الاسم الأول — آلي','العائلة — آلي','الهاتف الدولي','البريد الإلكتروني','المحافظة','آخر عنوان مسجل','عدد الطلبات','عدد فواتير تم','قيمة المنتجات JOD','قيمة منتجات تم JOD','أول طلب — عمّان','آخر طلب — عمّان','أنواع المنتجات','مراجعة البيانات والاسم','الموافقة التسويقية'],[28,28,22,22,22,32,18,44,17,18,22,23,24,24,34,52,30],contactRows,notes[0]+' '+notes[3],12),
  sheet('المنتجات','تفاصيل المنتجات | من سطور الفواتير',['رقم الفاتورة','رمز المنتج','اسم المنتج في الفاتورة','نوع المنتج','الفئة','الماركة','الكمية','سعر الوحدة JOD'],[23,20,57,29,22,27,16,21],productRows,'سعر الوحدة من الفاتورة وقبل توزيع خصم الطلب، والتصنيف من الكتالوج الحالي.',8),
  sheet('Meta','Meta | معاينة ملف قائمة العملاء',META_CUSTOMER_HEADERS,[34,24,26,26,22,16,20],metaData,notes[4]+' قيمة value بالدينار الأردني دون التوصيل. استخدم زر CSV للرفع.',7)
 ];
 return {sheets,sourceText,filterText};
}
