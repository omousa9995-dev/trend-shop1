const PAGE_SIZE=250;
const statuses={all:'',completed:'تم',new:'جديد',processing:'قيد التجهيز'};
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export async function adminCustomerReport(req,env,{json,error}){
 if(req.method!=='GET')return error('الطريقة غير مسموحة',405);
 const q=new URL(req.url).searchParams,status=q.get('status')||'all',from=q.get('from')||'',to=q.get('to')||'';
 try{if(!Object.hasOwn(statuses,status)||from&&!day(from)||to&&!day(to)||from&&to&&from>to)return error('راجع فترة التقرير وحالة الطلب');}catch{return error('تاريخ التقرير غير صالح');}
 const integer=(key,fallback)=>{if(!q.has(key))return fallback;const value=q.get(key);if(!/^\d{1,16}$/.test(value))return NaN;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:NaN;};
 let snapshot=integer('snapshot',null),cursor=integer('cursor',null);
 if(Number.isNaN(snapshot)||Number.isNaN(cursor)||cursor!==null&&snapshot===null)return error('مؤشر التقرير غير صالح');
 if(snapshot===null)snapshot=Number((await env.DB.prepare('SELECT COALESCE(MAX(rowid),0) AS last FROM orders').first())?.last||0);
 if(cursor!==null&&(cursor<1||cursor>snapshot))return error('مؤشر التقرير غير صالح');
 const where=['o.rowid<=?'],args=[snapshot];
 if(cursor!==null){where.push('o.rowid<?');args.push(cursor);}
 if(from){where.push("date(o.created_at,'+3 hours')>=?");args.push(from);}
 if(to){where.push("date(o.created_at,'+3 hours')<=?");args.push(to);}
 if(statuses[status]){where.push('o.status=?');args.push(statuses[status]);}
 // One statement keeps each order and its historical line items in the same read snapshot.
 const query=`SELECT o.rowid AS rowId,o.id,o.name,o.phone,o.email,o.governorate,o.address,o.status,o.subtotal_fils,o.shipping_fee_fils,o.discount_fils,o.created_at,
  (SELECT json_group_array(json_object('product_id',oi.product_id,'name_snapshot',oi.name_snapshot,'qty',oi.qty,'unit_price_fils',oi.unit_price_fils,'category',p.category,'brand',p.brand,'product_type',CASE WHEN json_valid(p.details_json) THEN json_extract(p.details_json,'$.productType') ELSE '' END))
   FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id) AS items_json
  FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.rowid DESC LIMIT ${PAGE_SIZE+1}`;
 const result=await env.DB.prepare(query).bind(...args).all(),rows=result.results||[],more=rows.length>PAGE_SIZE;
 const orders=rows.slice(0,PAGE_SIZE).map(({items_json,...row})=>({...row,items:JSON.parse(items_json||'[]')}));
 return json({orders,snapshot,nextCursor:more?orders.at(-1).rowId:null,generatedAt:new Date().toISOString(),timeZone:'Asia/Amman',filters:{from,to,status}});
}

export const CUSTOMER_REPORT_PAGE_SIZE=PAGE_SIZE;
