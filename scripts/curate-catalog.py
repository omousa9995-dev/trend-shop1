"""Compile the reviewed Arabic copy, deduplication decisions, and exact product photos."""
from pathlib import Path
from collections import Counter
import json,csv
ROOT=Path(__file__).resolve().parents[1]
duplicates={'TS0104':'TS0038','TS0128':'TS0082','TS0135':'TS0070','TS0143':'TS0067','TS0146':'TS0061','TS0148':'TS0064','TS0159':'TS0086','TS0160':'TS0109','TS0167':'TS0060','TS0170':'TS0076','TS0181':'TS0075'}
held={
'TS0043':'اسم سيروم دكتور راشيل غير محدد بما يكفي لتحديد النسخة والمحتوى بدقة.',
'TS0063':'غسول علاجي ببنزويل بيروكسيد 10%؛ يؤجل لمراجعة متخصصة قبل اعتماده ضمن التشكيلة.',
'TS0096':'أقراص مكمل غذائي وليست مستحضر تجميل موضعيًا؛ خارج التشكيلة التجميلية الأولية.',
'TS0142':'ذُكر اسم العلامة فقط دون تحديد اسم الكريم ونسخته.',
'TS0153':'أداة كهربائية دون علامة أو طراز محددين؛ يلزم تحديد المواصفات والضمان قبل إضافتها.',
'TS0189':'كريم علاجي موضعي؛ يؤجل لمراجعة متخصصة قبل اعتماده ضمن التشكيلة.'}
fixes={'TS0136':{'name':'Medicube PDRN Lip Sleeping Mask'},'TS0155':{'brand':'SEAPURI','name':'SEAPURI Scalpy Hair Serum 20 ml'},'TS0137':{'name':'rhode Peptide Lip Treatment Unscented 10 ml'}}
kbeauty={'dr. althea','celimax','eqqualberry','anua','beauty of joseon','biodance','axis-y','abib','arencia','p.calm','medicube','isntree','skin1004','cosrx','mary & may','aprilskin','dr.melaxin','etude','jumiso','ksecret','some by mi','secret key',"i'm from",'round lab','derma:b','tirtir','purito seoul','vt','vt cosmetics','haruharu wonder','centellian24','numbuzin',"d'alba",'mixsoon','seapuri'}
featured=['TS0059','TS0079','TS0067','TS0065','TS0091','TS0085','TS0075','TS0061']
copy={}
for line in (ROOT/'data/product-copy-ar.txt').read_text().splitlines():
 if not line or line.startswith('#'):continue
 parts=line.split('|');assert len(parts)==7,parts[0]
 pid,name,tagline,overview,benefits,use,note=parts
 assert pid not in copy,pid
 copy[pid]={'nameAr':name,'tagline':tagline,'overview':overview,'benefits':benefits.split(';'),'howToUse':use,'notes':note}
original=json.loads((ROOT/'data/catalog-original.json').read_text());images={p['id']:p for p in json.loads((ROOT/'data/image-provenance.json').read_text())}
pricing_file=ROOT/'data/pricing-stock-policy.json'
pricing_policy=json.loads(pricing_file.read_text()) if pricing_file.exists() else None
prices={p['id']:p for p in pricing_policy['products']} if pricing_policy else {}
curated=[];decisions=[]
for original_product in original:
 p=dict(original_product);pid=p['id'];photo=images[pid]
 if pid in duplicates:
  decisions.append({'id':pid,'name':p['name'],'decision':'duplicate','canonical_id':duplicates[pid],'reason':'نفس المنتج والنسخة؛ اختلاف المصدر أو صياغة الاسم فقط.','image':photo.get('image')});continue
 if pid in held:
  decisions.append({'id':pid,'name':p['name'],'decision':'review','reason':held[pid],'image':photo.get('image')});continue
 assert pid in copy,'Missing copy '+pid
 assert photo['status']=='downloaded','Missing photo '+pid
 assert (ROOT/'public'/photo['image'].lstrip('/')).exists(),'Missing file '+pid
 p.update(fixes.get(pid,{}));details=dict(copy[pid]);p['description']=details.pop('overview')
 details['imageType']='photo';details['collection']='k-beauty' if p['brand'].lower() in kbeauty else 'beauty'
 details['featuredOrder']=featured.index(pid) if pid in featured else 100
 p.update({'image':photo['image'],'details':details,'active':1,'approved':False,'stock':0,'canonicalSources':[q['id'] for q in original if q['id']==pid or duplicates.get(q['id'])==pid]})
 if pid in prices:
  price=prices[pid];p['researchReferenceFils']=p['reference']
  p.update(reference=price['price_fils'],priceFils=price['price_fils'],discount=0,approved=True,stock=price['initial_stock'])
 curated.append(p);decisions.append({'id':pid,'name':p['name'],'decision':'selected','canonical_id':pid,'reason':'هوية وصورة محددتان، وصف فردي، ومناسب للتشكيلة التجميلية الأولية.','image':p['image'],**({'correction':fixes[pid]} if pid in fixes else {})})
assert len(curated)==len(copy),(len(curated),len(copy))
assert len(set(p['description'] for p in curated))==len(curated)
(ROOT/'public/catalog.json').write_text(json.dumps(curated,ensure_ascii=False,indent=2)+'\n')
summary={'original_entries':len(original),'selected':len(curated),'duplicates':len(duplicates),'held_for_review':len(held),'photos_collected':sum(p['status']=='downloaded' for p in images.values()),'all_stock_and_prices_require_owner_approval':not bool(pricing_policy),'pricing_release':pricing_policy['release_id'] if pricing_policy else None,'decisions':decisions}
(ROOT/'data/catalog-decisions.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
with (ROOT/'data/catalog-decisions.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.writer(f);writer.writerow(['الرمز','المنتج','القرار','المنتج المعتمد عند التكرار','السبب'])
 for d in decisions:writer.writerow([d['id'],d['name'],{'selected':'مختار','duplicate':'مكرر','review':'بانتظار مراجعة'}[d['decision']],d.get('canonical_id',''),d['reason']])
def sql(value):return "'"+str(value).replace("'","''")+"'"
updates=[]
for p in curated:
 updates.append('UPDATE products SET name='+sql(p['name'])+',brand='+sql(p['brand'])+',description='+sql(p['description'])+',image_url='+sql(p['image'])+',details_json='+sql(json.dumps(p['details'],ensure_ascii=False))+",active=1,updated_at=datetime('now') WHERE id="+sql(p['id'])+';')
for pid in [*duplicates,*held]:updates.append("UPDATE products SET active=0,image_url="+sql(images[pid]['image'])+",updated_at=datetime('now') WHERE id="+sql(pid)+';')
(ROOT/'deployment-private/catalog-update.sql').write_text('\n'.join(updates))
commercial=[]
if pricing_policy:
 release=sql(pricing_policy['release_id'])
 commercial.append("CREATE TABLE IF NOT EXISTS catalog_releases (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));")
 for p in curated:
  commercial.append(f"UPDATE products SET reference_price_fils={p['priceFils']},price_fils={p['priceFils']},discount_percent=0,stock={p['stock']},approved=1,updated_at=datetime('now') WHERE id={sql(p['id'])} AND active=1 AND NOT EXISTS (SELECT 1 FROM catalog_releases WHERE id={release});")
 commercial.append(f'INSERT OR IGNORE INTO catalog_releases (id) VALUES ({release});')
 (ROOT/'db/migrations/0003_initial_pricing_stock.sql').write_text('\n'.join(commercial)+'\n')
 with (ROOT/'data/pricing-stock.csv').open('w',newline='',encoding='utf-8-sig') as f:
  writer=csv.writer(f);writer.writerow(['الرمز','اسم المنتج','سعر البيع بالدينار','الرصيد الافتتاحي','الاعتماد'])
  for p in curated:writer.writerow([p['id'],p['details']['nameAr'],f"{p['priceFils']/1000:.3f}",p['stock'],'بتفويض المالك'])
seed=ROOT/'db/seed.sql'
if seed.exists():
 original_seed=seed.read_text().split('-- BEGIN CURATED CATALOG')[0].rstrip()
 seed.write_text(original_seed+'\n\n-- BEGIN CURATED CATALOG\n'+'\n'.join(updates)+'\n'+('\n-- INITIAL AUTHORIZED PRICING (ONCE)\n'+'\n'.join(commercial)+'\n' if commercial else ''))
print(json.dumps({k:v for k,v in summary.items() if k!='decisions'},ensure_ascii=False))
