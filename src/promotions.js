import {retailPrice,actualDiscount,promotionData,productPrice} from '../public/commerce.js';
const productId=/^TS[A-Z0-9-]{4,64}$/;
export async function loadPromotions(env,all=false){
 const result=await env.DB.prepare(`SELECT id,kind,title,description,config_json,active FROM promotions ${all?'':'WHERE active=1'} ORDER BY created_at DESC,id LIMIT 200`).all();
 return (result.results||[]).map(promotionData).filter(Boolean);
}
export async function adminPromotions(req,env,{json,error,sameOrigin,content}){
 if(req.method==='GET')return json({promotions:await loadPromotions(env,true)});
 if(!sameOrigin(req)||req.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
 let b;try{b=await content(req)}catch{return error('بيانات غير صالحة')}
 if(b.action==='toggle'){
  if(!/^PROMO[A-Z0-9-]{6,64}$/.test(b.id||'')||typeof b.active!=='boolean')return error('العرض غير صالح');
  await env.DB.prepare("UPDATE promotions SET active=?,updated_at=datetime('now') WHERE id=?").bind(b.active?1:0,b.id).run();return json({ok:true});
 }
 const id=b.id||'PROMO'+crypto.randomUUID().slice(0,12).toUpperCase(),title=typeof b.title==='string'?b.title.trim().slice(0,100):'',description=typeof b.description==='string'?b.description.trim().slice(0,300):'';
 if(!/^PROMO[A-Z0-9-]{6,64}$/.test(id)||!['offer','combo'].includes(b.kind)||title.length<3||!Array.isArray(b.items)||b.items.length<1||b.items.length>6||b.kind==='combo'&&b.items.length<2||!Number.isInteger(b.priceFils)||b.priceFils%10||b.priceFils<500||b.priceFils>200000)return error('راجعي اسم العرض والمنتجات والسعر النهائي');
 const items=[];for(const x of b.items){if(!productId.test(x.id||'')||!Number.isInteger(x.qty)||x.qty<1||x.qty>10||items.some(y=>y.id===x.id))return error('اختاري منتجات مختلفة وكميات من 1 إلى 10');items.push({id:x.id,qty:x.qty})}
 const result=await env.DB.prepare(`SELECT id,name,price_fils,active,approved FROM products WHERE id IN (${items.map(()=>'?').join(',')})`).bind(...items.map(x=>x.id)).all();const byId=new Map((result.results||[]).map(x=>[x.id,x]));
 if(items.some(x=>!byId.has(x.id)||!byId.get(x.id).active||!byId.get(x.id).approved))return error('العروض تتطلب منتجات ظاهرة ومعتمدة');
 const price=retailPrice(b.priceFils,200000);
 const original=items.reduce((n,x)=>n+productPrice(byId.get(x.id))*x.qty,0);
 if(price>=original||price<items.reduce((n,x)=>n+x.qty*500,0))return error('سعر العرض يجب أن يكون أقل من مجموع المنتجات وبحد نصف دينار لكل قطعة');
 await env.DB.prepare(`INSERT INTO promotions(id,kind,title,description,config_json,active) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,description=excluded.description,config_json=excluded.config_json,active=excluded.active,updated_at=datetime('now')`).bind(id,b.kind,title,description,JSON.stringify({items,priceFils:price}),b.active===false?0:1).run();
 return json({ok:true,id});
}
export async function adminDiscounts(req,env,{json,error,sameOrigin,content}){
 if(!sameOrigin(req)||req.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
 let b;try{b=await content(req)}catch{return error('بيانات غير صالحة')}
 if(!Array.isArray(b.ids)||b.ids.length<1||b.ids.length>500||b.ids.some(x=>!productId.test(x))||new Set(b.ids).size!==b.ids.length||!Number.isInteger(b.percent)||b.percent<0||b.percent>50)return error('راجعي المنتجات ونسبة الخصم من 0 إلى 50');
 const result=await env.DB.prepare(`SELECT id,reference_price_fils,price_fils FROM products WHERE active=1 AND approved=1 AND id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(b.ids)).all();
 const changes=[];
 for(const p of result.results||[]){
  const reference=b.percent===0?p.reference_price_fils:p.price_fils;
  const price=b.percent===0?Math.floor(reference/10)*10:Math.min(reference,retailPrice(reference*(100-b.percent)/100));
  if(price<500||price>20000||b.percent>0&&price>=reference)continue;
  changes.push(env.DB.prepare("UPDATE products SET reference_price_fils=?,price_fils=?,discount_percent=?,updated_at=datetime('now') WHERE id=? AND price_fils=? AND reference_price_fils=?").bind(reference,price,actualDiscount(reference,price),p.id,p.price_fils,p.reference_price_fils));
 }
 const saved=changes.length?await env.DB.batch(changes):[];const updated=saved.reduce((n,r)=>n+Number(r.meta?.changes??r.changes??0),0);
 return json({ok:true,updated,unchanged:b.ids.length-updated});
}
