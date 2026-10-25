"""Rebuild local preview data and D1 seed from the researched public price reference sheet.
Requires artifact_tool for source XLSX import. Prices are competitor references, not approved retail prices.
"""
from artifact_tool import Blob,SpreadsheetFile
from pathlib import Path
from html import escape
import json,hashlib,random,re
from decimal import Decimal, ROUND_HALF_UP
ROOT=Path(__file__).resolve().parents[1]
w=SpreadsheetFile.import_xlsx(Blob.load(str(ROOT/'db/source-catalog.xlsx')))
base=w.worksheets.get_item('فهرس المنتجات').get_range('A1:J157').values[1:]
extra=w.worksheets.get_item('Ksecret فرعي 34').get_range('A1:J35').values[1:]
items=[]
for r in base:
 if not r[3] or not isinstance(r[5],(int,float)): continue
 items.append({'source':r[1],'brand':r[2],'name':r[3], 'subcat':r[4], 'reference':int(round(float(r[5])*1000)),'source_url':r[6], 'source_note':r[7]})
for r in extra:
 if not r[2] or not isinstance(r[4],(int,float)): continue
 items.append({'source':'Ksecret (فرعي، غير متحقق)','brand':r[1],'name':r[2], 'subcat':r[3], 'reference':int(round(float(r[4])*1000)), 'source_url':r[6], 'source_note':r[7]})
assert len(items)==190,len(items)

def classify(sub,name):
 s=(str(sub)+' '+str(name)).lower()
 if any(x in s for x in ['عطر','perfume','fragrance','eau de']):return 'العطور'
 if any(x in s for x in ['الشعر','hair ','shampoo','olaplex','scalp','hairspray']):return 'الشعر'
 if any(x in s for x in ['الجسم','الجسم','القدمين','اليدين','body ','deodorant','القدم']):return 'الجسم'
 if any(x in s for x in ['مكياج','شفاه','مكياج','الرموش','حواجب','أظافر','خدود','lipstick','gloss','eyeshadow','mascara','foundation','blush','nail','lip balm','eyelash','brow','concealer']):return 'المكياج'
 return 'البشرة'

def desc(cat,sub,brand):
 text={
 'البشرة':f'امنحي بشرتك لحظة من العناية والاهتمام مع {brand}. خطوة جميلة تضيف إلى روتينك إحساسًا بالراحة والانتعاش وتمنحك وقتًا لنفسك. اختاريه وفق احتياجات بشرتك وتعليمات العبوة الأصلية؛ تختلف النتائج من شخص لآخر.',
 'المكياج':f'لمستك الخاصة تبدأ بالتفاصيل. استمتعي بتجربة {brand} لإطلالة تعبّر عن أسلوبك، من اللمسات اليومية الناعمة إلى اللحظات المميزة. راجعي اللون والتدرج المناسب قبل الطلب.',
 'الشعر':f'حوّلي روتين العناية بالشعر إلى وقت خاص بك مع {brand}. تفاصيل بسيطة قد تجعل يومك أكثر إشراقًا وتمنحك إحساسًا بالانتعاش والاهتمام، مع مراعاة نوع شعرك وطريقة الاستخدام على العبوة.',
 'الجسم':f'دلّلي نفسك بلحظة هادئة من العناية اليومية مع {brand}. إضافة صغيرة لروتينك تساعدك على الإحساس بالنظافة والاهتمام والاسترخاء، وفق طريقة الاستخدام الموضحة على المنتج.',
 'العطور':f'لمسة أنيقة ترافق يومك من {brand}. اختاري الإحساس الذي يعكس شخصيتك ويضيف تفصيلة جميلة إلى إطلالتك، مع الانتباه إلى اختلاف الأذواق.'}
 return text[cat]

palettes=[('#f3dde2','#d890a0','#6e454f'),('#e9dfd4','#c9a986','#6a5548'),('#e5e8e2','#a1b1a2','#55635a'),('#efe4f1','#bda0ca','#63536b'),('#e0ebef','#9fc8d2','#4a6a78'),('#f4e7cf','#dfba82','#795e42')]

def art(p):
 idx=int(p['id'][2:]);bkg,accent,dark=palettes[idx%len(palettes)];brand=escape(p['brand'][:24]); name=escape(p['name'][:38]);cat=p['category']
 # Self-authored illustrative packshots. Not brand's actual commercial packaging.
 form='dropper' if any(t in p['name'].lower() for t in ['serum','ampoule','essence','oil','toner']) else ('jar' if any(t in p['name'].lower() for t in ['cream','mask','balm','gel']) else ('tube' if cat in ['البشرة','الشعر','الجسم'] else 'stick'))
 if form=='dropper':
  shape=f'<rect x="143" y="108" width="34" height="49" rx="7" fill="{dark}"/><rect x="152" y="90" width="16" height="28" rx="5" fill="{dark}"/><rect x="104" y="146" width="112" height="151" rx="20" fill="url(#glass)" stroke="#ffffff" stroke-width="3"/><rect x="112" y="179" width="96" height="90" rx="8" fill="white" opacity=".89"/>'
 elif form=='jar':
  shape=f'<rect x="81" y="155" width="158" height="35" rx="10" fill="{dark}"/><rect x="78" y="186" width="164" height="111" rx="29" fill="url(#glass)" stroke="#ffffff" stroke-width="4"/><rect x="92" y="202" width="136" height="76" rx="7" fill="white" opacity=".90"/>'
 elif form=='tube':
  shape=f'<path d="M110 110 Q160 101 210 110 L201 284 Q160 311 119 284 Z" fill="url(#glass)" stroke="#ffffff" stroke-width="4"/><rect x="124" y="142" width="72" height="95" rx="8" fill="white" opacity=".89"/><rect x="128" y="288" width="64" height="23" rx="5" fill="{dark}"/>'
 else:
  shape=f'<rect x="124" y="172" width="72" height="141" rx="10" fill="url(#glass)"/><rect x="124" y="265" width="72" height="48" rx="7" fill="{dark}"/><path d="M135 172 V121 Q160 94 185 121 V172Z" fill="{accent}"/><rect x="135" y="206" width="50" height="52" rx="6" fill="#fff" opacity=".87"/>'
 # Each card is different yet lightweight. Keep artwork approximate, mark it illustrated.
 brandtxt=escape(re.sub(r'[^\x20-\x7E]', '',p['brand'])[:18])
 if not brandtxt:brandtxt='TREND EDIT'
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="460" viewBox="0 0 320 368" role="img" aria-label="رسم توضيحي لمنتج {name}"><defs><linearGradient id="bg" x2=".7" y2="1"><stop stop-color="{bkg}"/><stop offset="1" stop-color="#fff9f5"/></linearGradient><linearGradient id="glass" x1=".1" x2=".9" y2="1"><stop stop-color="#fffefb"/><stop offset=".55" stop-color="{accent}" stop-opacity=".83"/><stop offset="1" stop-color="#fef8f2"/></linearGradient><filter id="sd"><feGaussianBlur stdDeviation="10"/></filter></defs><rect width="320" height="368" rx="20" fill="url(#bg)"/><circle cx="60" cy="74" r="71" fill="#ffffff" opacity=".33"/><ellipse cx="175" cy="310" rx="105" ry="15" fill="{dark}" opacity=".19" filter="url(#sd)"/><g>{shape}</g><text x="160" y="222" text-anchor="middle" fill="{dark}" font-family="Arial,sans-serif" font-weight="700" font-size="10" textLength="70" lengthAdjust="spacingAndGlyphs">{brandtxt}</text><path d="M145 237h30" stroke="{accent}" stroke-width="1.6"/><text x="160" y="251" text-anchor="middle" fill="{dark}" font-size="7.5" font-family="Arial,sans-serif">CARE EDITION</text><text x="160" y="343" text-anchor="middle" fill="{dark}" font-size="9" font-family="Arial,sans-serif" opacity=".65">ILLUSTRATIVE IMAGE · TREND SHOP</text></svg>'''
 (ROOT/'public/images'/f"{p['id']}.svg").write_text(svg,'utf-8')

for i,p in enumerate(items,1):
 p['id']=f'TS{i:04d}'
 p['category']=classify(p['subcat'],p['name'])
 p['description']=desc(p['category'],p['subcat'],p['brand'])
 p['discount']=20+((i*7)%31)
 p['priceFils']=int((Decimal(p['reference'])*(100-p['discount'])/100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
 p['image']='/images/'+p['id']+'.svg'
 p['approved']=False
 p['stock']=0
 art(p)
(ROOT/'public/catalog.json').write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')),'utf-8')
def esc_sql(s):return "'"+str(s or '').replace("'","''")+"'"
records=[]
for p in items:
 cols=['id','brand','name','category','subcategory','description','reference_price_fils','price_fils','discount_percent','image_url','source_url','source_shop','approved','stock','active']
 vals=[p['id'],p['brand'],p['name'],p['category'],p['subcat'],p['description'],p['reference'],p['priceFils'],p['discount'],p['image'],p['source_url'],p['source'],0,0,1]
 rendered=','.join(str(v) if isinstance(v,int) else esc_sql(v) for v in vals)
 records.append(f"INSERT OR IGNORE INTO products ({','.join(cols)}) VALUES ({rendered});")
(ROOT/'db/seed.sql').write_text('-- Initial demo records. All are unapproved, unavailable for real orders.\n'+'\n'.join(records)+'\n','utf-8')
print('catalog',len(items),'files generated')
