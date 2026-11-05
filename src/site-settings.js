import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings} from '../public/site-settings.js';
export async function readSiteSettings(env){
 let row;try{row=await env.DB.prepare("SELECT * FROM site_settings WHERE id='storefront'").first()}catch(e){if(!/no such table.*site_settings/i.test(e.message))throw e;}
 // Existing installations activate the pricing policy through migration 0025.
 if(!row)return {...DEFAULT_SITE_SETTINGS,pairPricing:false,revision:0};
 return {...normalizeSiteSettings(JSON.parse(row.config_json)),revision:row.revision};
}
export async function adminSiteSettings(req,env,{json,error,sameOrigin,content}){
 const current=await env.DB.prepare("SELECT * FROM site_settings WHERE id='storefront'").first();
 if(req.method==='GET')return json({settings:await readSiteSettings(env),history:current?JSON.parse(current.history_json||'[]').map(x=>({revision:x.revision,updatedAt:x.updatedAt})):[]});
 if(!sameOrigin(req)||req.headers.get('x-trend-admin')!=='1')return error('غير مصرح',403);
 let body;try{body=await content(req,65536)}catch{return error('تعذر قراءة الإعدادات')}
 if(!current||!Number.isInteger(body.revision)||body.revision!==current.revision)return error('هناك تعديل أحدث. أعيدي تحميل الإعدادات قبل الحفظ.',409);
 const history=JSON.parse(current.history_json||'[]');
 let input=body.settings;if(body.action==='restore'){const old=history.find(x=>x.revision===body.restoreRevision);if(!old)return error('النسخة المطلوبة غير متاحة',404);input=old.settings;}
 let next;try{const products=await env.DB.prepare('SELECT id FROM products').all();next=normalizeSiteSettings(input,{productIds:new Set(products.results.map(x=>x.id))})}catch(e){return error(e.message||'راجعي الإعدادات')}
 const savedHistory=[{revision:current.revision,updatedAt:current.updated_at,settings:JSON.parse(current.config_json)},...history].slice(0,5);
 const result=await env.DB.prepare("UPDATE site_settings SET config_json=?,history_json=?,revision=revision+1,updated_at=datetime('now') WHERE id='storefront' AND revision=?").bind(JSON.stringify(next),JSON.stringify(savedHistory),body.revision).run();
 if(Number(result.meta?.changes)!==1)return error('سبقك تعديل آخر؛ أعيدي تحميل الإعدادات.',409);
 return json({ok:true,revision:body.revision+1});
}
