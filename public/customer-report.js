import {normalizeContactPhone} from './contact-phone.js';
import {PRODUCT_TYPES,productType} from './product-types.js';

const clean=value=>String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
const amount=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const sum=(rows,key)=>rows.reduce((n,row)=>n+(row[key]??0),0);
const email=value=>{const text=clean(value).toLowerCase();return text.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)&&!/^[-+=@]/.test(text)?text:'';};
const safeName=value=>/^[\p{L}\p{M} .'-]{1,100}$/u.test(value)?value.toLowerCase():'';
export function splitCustomerName(value){
 const fullName=clean(value),parts=fullName.split(' ').filter(Boolean),compound=['عبد','أبو','ابو','أم','ام'].includes(parts[0])&&parts.length>1,firstLength=compound?2:1;
 return {fullName,firstName:parts.slice(0,firstLength).join(' '),lastName:parts.length>firstLength?parts.at(-1):'',nameNote:parts.length>firstLength?'تقسيم آلي للاسم الكامل؛ العائلة غير مسجلة منفصلة':'اسم العائلة غير متوفر'};
}
export function customerOrderDate(raw){
 const source=String(raw??''),date=new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(source)?source:source.replace(' ','T')+'Z');
 if(!Number.isFinite(date.getTime()))return {dateMs:null,dateSerial:null,dateLocal:'',day:''};
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Amman',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date),p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const day=`${p.year}-${p.month}-${p.day}`,dateLocal=`${day} ${p.hour}:${p.minute}`;
 return {dateMs:date.getTime(),dateSerial:Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))/86400000+25569,dateLocal,day};
}
const governorateKey=value=>clean(value).replace(/[أإآ]/g,'ا').replace(/[ًٌٍَُِّْ]/g,'');
const states=new Map([['عمان','amman'],['اربد','irbid'],['الزرقاء','zarqa'],['البلقاء','balqa'],['مادبا','madaba'],['الكرك','karak'],['الطفيلة','tafilah'],['معان','maan'],['العقبة','aqaba'],['المفرق','mafraq'],['جرش','jerash'],['عجلون','ajloun']]);
function normalizeOrder(raw){
 const name=splitCustomerName(raw.name),phone=normalizeContactPhone(String(raw.phone??'')),mail=email(raw.email),goodsFils=amount(raw.subtotal_fils),shippingFils=amount(raw.shipping_fee_fils),discountFils=amount(raw.discount_fils),date=customerOrderDate(raw.created_at),flags=[];
 if(!phone)flags.push('الهاتف مفقود أو تنسيقه غير صالح');if(raw.email&&!mail)flags.push('تنسيق البريد يحتاج مراجعة');if(!name.fullName)flags.push('الاسم مفقود');if(!date.day)flags.push('تاريخ غير صالح');if(shippingFils===null)flags.push('رسوم التوصيل غير مسجلة');if(goodsFils===null)flags.push('قيمة المنتجات غير مسجلة');
 const items=(raw.items||[]).map(item=>{const typeId=productType({name:item.name_snapshot,category:item.category,details:{productType:item.product_type}});return {productId:clean(item.product_id),name:clean(item.name_snapshot),category:clean(item.category)||'غير مصنّف',type:PRODUCT_TYPES.find(x=>x.id===typeId)?.label||clean(item.category)||'غير مصنّف',brand:clean(item.brand),qty:amount(item.qty),unitPriceFils:amount(item.unit_price_fils)};});
 if(!items.length)flags.push('لا توجد تفاصيل منتجات');
 return {id:clean(raw.id),...name,...date,status:clean(raw.status),phone,phoneOriginal:clean(raw.phone),email:mail,emailOriginal:clean(raw.email),governorate:clean(raw.governorate),address:clean(raw.address),goodsFils,shippingFils,discountFils,totalFils:goodsFils!==null&&shippingFils!==null?goodsFils+shippingFils:null,contactKey:phone||mail||'order:'+clean(raw.id),items,types:[...new Set(items.map(x=>x.type))].join('، '),products:items.map(x=>`${x.name} × ${x.qty??'؟'}`).join('؛ '),flags};
}
function contactsFor(orders){
 const groups=new Map();
 for(const order of orders){let group=groups.get(order.contactKey);if(!group){group={key:order.contactKey,fullName:order.fullName,firstName:order.firstName,lastName:order.lastName,nameNote:order.nameNote,phone:order.phone,email:order.email,governorate:order.governorate,address:order.address,orderCount:0,completedCount:0,goodsFils:0,completedGoodsFils:0,firstDateSerial:order.dateSerial,lastDateSerial:order.dateSerial,lastDateLocal:order.dateLocal,types:new Set(),names:new Set(),flags:new Set()};groups.set(order.contactKey,group);}
  group.orderCount++;group.goodsFils+=order.goodsFils??0;if(order.status==='تم'){group.completedCount++;group.completedGoodsFils+=order.goodsFils??0;}
  if(!group.email&&order.email)group.email=order.email;
  if(order.dateSerial!==null){group.firstDateSerial=Math.min(group.firstDateSerial??order.dateSerial,order.dateSerial);group.lastDateSerial=Math.max(group.lastDateSerial??order.dateSerial,order.dateSerial);}
  if(order.fullName)group.names.add(order.fullName);for(const type of order.items.map(x=>x.type))group.types.add(type);for(const flag of order.flags)group.flags.add(flag);
 }
 return [...groups.values()].map(group=>{if(group.names.size>1)group.flags.add('أسماء مختلفة لنفس جهة الاتصال');return {...group,types:[...group.types].join('، '),flags:[...group.flags],nameConflict:group.names.size>1,marketingPermission:'غير مسجلة في بيانات الطلب'};}).sort((a,b)=>b.orderCount-a.orderCount||b.goodsFils-a.goodsFils);
}
export function buildCustomerReport(rawOrders,{asOf=new Date().toISOString(),filters={from:'',to:'',status:'all'}}={}){
 const seen=new Set(),orders=rawOrders.filter(row=>{if(seen.has(row.id))return false;seen.add(row.id);return true;}).map(normalizeOrder).sort((a,b)=>(b.dateMs??0)-(a.dateMs??0)||a.id.localeCompare(b.id));
 const contacts=contactsFor(orders),completed=orders.filter(o=>o.status==='تم'),metaContacts=contactsFor(completed).filter(c=>c.phone||c.email),types=new Map(),regions=new Map();
 const sharedEmails=new Map();for(const c of contacts)if(c.email)sharedEmails.set(c.email,(sharedEmails.get(c.email)||0)+1);
 for(const c of contacts)if((sharedEmails.get(c.email)||0)>1)c.flags.push('البريد مستخدم لجهات اتصال مختلفة؛ يُحذف من CSV لتجنب المطابقة الملتبسة');
 const items=orders.flatMap(order=>order.items.map(item=>({...item,orderId:order.id})));
 for(const item of items)types.set(item.type,(types.get(item.type)||0)+(item.qty??0));
 for(const order of orders)regions.set(order.governorate||'غير محددة',(regions.get(order.governorate||'غير محددة')||0)+1);
 const ranked=map=>[...map].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const unknownValues=new Set(completed.filter(o=>o.goodsFils===null).map(o=>o.contactKey));
 const metaRows=metaContacts.map(c=>({email:(sharedEmails.get(c.email)||0)>1?'':c.email,phone:c.phone.replace(/^\+/,''),fn:c.nameConflict?'':safeName(c.firstName),ln:c.nameConflict?'':safeName(c.lastName),st:states.get(governorateKey(c.governorate))||'',country:'jo',value:unknownValues.has(c.key)?null:c.completedGoodsFils/1000})).filter(c=>c.email||c.phone);
 return {asOf,filters,orders,contacts,items,metaRows,topTypes:ranked(types),topGovernorates:ranked(regions),summary:{orderCount:orders.length,contactCount:contacts.length,completedCount:completed.length,goodsFils:sum(orders,'goodsFils'),shippingFils:sum(orders,'shippingFils'),knownTotalFils:sum(orders,'totalFils'),unknownTotalCount:orders.filter(o=>o.totalFils===null).length,completedGoodsFils:sum(completed,'goodsFils'),averageKnownOrderFils:orders.filter(o=>o.totalFils!==null).length?Math.round(sum(orders,'totalFils')/orders.filter(o=>o.totalFils!==null).length):null,repeatContacts:contacts.filter(c=>c.orderCount>1).length,invalidPhones:orders.filter(o=>!o.phone).length,missingEmails:orders.filter(o=>!o.email).length,missingLastNames:contacts.filter(c=>!c.lastName).length,quantity:sum(items,'qty'),metaContacts:metaRows.length},notes:{names:'الاسم الأصلي محفوظ؛ تقسيم الاسم والعائلة آلي، ويُترك غير المتوفر فارغًا.',money:'جميع القيم بالدينار الأردني. قيمة Meta هي مجموع قيمة المنتجات بعد الخصومات للطلبات المكتملة (تم) فقط، دون التوصيل، ضمن الفترة المختارة.',types:'أسماء المنتجات والأسعار من الفواتير، والتصنيف من كتالوج المتجر الحالي.',contacts:'جهة الاتصال تُجمع حسب الهاتف الدولي، أو البريد عند غياب هاتف صالح. قد يشترك أكثر من شخص برقم واحد.',meta:'ملف قائمة عملاء للرفع اليدوي، وليس أحداث شراء أو ربطًا تلقائيًا بميتا. لا توجد موافقة تسويقية مسجلة ضمن الطلبات الحالية.'}};
}
export const META_CUSTOMER_HEADERS=['email','phone','fn','ln','st','country','value'];
export function metaCustomerCsv(report){const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';return '\ufeff'+[META_CUSTOMER_HEADERS.join(','),...report.metaRows.map(row=>META_CUSTOMER_HEADERS.map(key=>quote(row[key])).join(','))].join('\r\n')+'\r\n';}

export async function fetchCustomerReport(call,filters={},{signal}={}){
 const rows=[];let cursor=null,snapshot=null,generatedAt,previous=Infinity;
 do{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const q=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!==undefined));if(snapshot!==null)q.set('snapshot',snapshot);if(cursor!==null)q.set('cursor',cursor);const page=await call('customer-report?'+q.toString());if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(!Array.isArray(page.orders)||!Number.isSafeInteger(page.snapshot)||page.snapshot<0||snapshot!==null&&snapshot!==page.snapshot)throw Error('تعذر التحقق من اكتمال بيانات التقرير');
  snapshot=page.snapshot;generatedAt??=page.generatedAt;rows.push(...page.orders);cursor=page.nextCursor;
  if(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1||cursor>=previous))throw Error('تعذر متابعة صفحات التقرير');previous=cursor??0;
 }while(cursor!==null);
 return buildCustomerReport(rows,{asOf:generatedAt,filters});
}
