"""Build the reviewed additive release. Never connects to a production database."""
from pathlib import Path
import json,math
root=Path(__file__).resolve().parents[1];folder=root/'data/intake-2026-10-27'
def read(p):return json.loads((root/p).read_text())
def write(p,v):(root/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
manifest=read('data/intake-2026-10-27/manifest.json');images={x['id']:x for x in read('data/intake-2026-10-27/images.json')}
copy={}
for line in (folder/'copy-ar.txt').read_text().splitlines():
 if not line.strip():continue
 n,type,tag,description,benefits=line.split('|');copy['TS'+n.zfill(4)]={'productType':type,'tagline':tag,'description':description,'benefits':benefits.split('~')}
how={
 'eye-care':'ربّتي كمية صغيرة على محيط العين دون ملامسة العين أو خط الرموش، بحسب تعليمات العبوة.',
 'moisturizer':'وزعي كمية مناسبة على بشرة نظيفة بعد السيروم، ودلكي بلطف حتى الامتصاص وفق إرشادات العبوة.',
 'foundation':'حضّري البشرة بالمرطب، ثم ادمجي طبقة رقيقة بفرشاة أو إسفنجة نظيفة. أضيفي طبقة صغيرة عند الحاجة.',
 'mascara':'مرري الفرشاة من جذور الرموش إلى الأطراف بحركات خفيفة. زيدي طبقة بحسب الإطلالة وأزيلي المكياج بلطف مساءً.',
 'body-care':'طبقي كمية مناسبة على جلد سليم ودلكي بلطف، مع اتباع تعليمات العبوة الخاصة بالمنتج.',
 'sunscreen':'طبقي كمية كافية ومتجانسة قبل التعرض للشمس وفق تعليمات العبوة. أعيدي التطبيق كل ساعتين وبعد السباحة أو التعرق أو التجفيف.',
 'cleanser':'بللي الوجه، ودلكي كمية مناسبة بلطف بعيدًا عن العينين، ثم اشطفي جيدًا بالماء واتبعيه بمرطب.',
 'primer':'وزعي طبقة رقيقة على المناطق المطلوبة بعد المرطب، واتركيها تستقر قبل كريم الأساس.',
 'exfoliant':'اتبعي تعليمات العبوة وابدئي بوتيرة متباعدة على بشرة سليمة. استخدمي مرطبًا وواقي شمس صباحًا.',
 'serum':'وزعي بضع قطرات على بشرة نظيفة، ثم اتبعيها بالمرطب. التزمي بكمية ووتيرة الاستخدام على العبوة.',
 'face-oil':'ربّتي قطرات قليلة على البشرة ضمن روتينك بحسب تعليمات العبوة، وتجنبي العينين.',
 'essence':'وزعي كمية قليلة على بشرة نظيفة بعد التنظيف وقبل السيروم أو المرطب، وفق إرشادات العبوة.',
 'toner':'وزعي كمية قليلة بعد تنظيف البشرة وفق تعليمات العبوة، ثم تابعي بالمرطب. ابدئي بوتيرة متباعدة إذا كانت التركيبة مقشرة.',
 'hair-styling':'انثري مقدارًا قليلًا على شعر جاف في المناطق المطلوبة وادمجي بلطف، مع تجنب الاستنشاق والعينين.',
 'hair-oil':'وزعي كمية قليلة على الأطوال أو المناطق المسموح بها على العبوة. لا تفرطي بالكمية وراقبي ملاءمة فروة الرأس.',
 'shampoo':'دلكي كمية مناسبة على شعر مبلل وفروة الرأس ثم اشطفي جيدًا. كرري فقط عند الحاجة.',
 'conditioner':'وزعي على أطوال الشعر بعد الشامبو، واتركي للمدة المكتوبة على العبوة ثم اشطفي جيدًا.',
 'hair-mask':'ضعي على أطوال الشعر بعد التنظيف، واتركي للمدة المحددة على العبوة ثم اشطفي جيدًا.',
 'powder':'خذي كمية قليلة بفرشاة أو إسفنجة نظيفة، وانفضي الزائد ثم طبقي طبقة خفيفة على المناطق المطلوبة.',
 'blush':'ابدئي بنقاط قليلة على الخدين وادمجي بسرعة ولطف. أضيفي المزيد بالتدريج حسب درجة اللون المطلوبة.',
 'highlighter':'ضعي كمية صغيرة على نقاط الإضاءة مثل أعلى الخدين وادمجي بلطف بعيدًا عن العينين.',
 'contour':'حددي المناطق المطلوبة بكمية قليلة ثم ادمجي الحواف جيدًا بفرشاة أو إسفنجة نظيفة.',
 'lips':'طبقي كمية قليلة على الشفاه السليمة وزيدي بالتدريج. نظفي أداة التطبيق وأغلقي العبوة بعد الاستخدام.',
 'brows':'اختاري الطرف أو الدرجة المناسبة وارسمي خطوطًا خفيفة باتجاه الشعر، ثم ادمجي للمظهر المطلوب.',
 'eyeshadow':'وزعي الظلال على الجفن بفرشاة نظيفة وادمجي بالتدريج. تجنبي دخول المنتج إلى العين.',
 'bb-cc':'ادمجي طبقة رقيقة على بشرة مرطبة وقارني اللون في إضاءة طبيعية. استخدمي واقي شمس مستقلًا بكمية كافية.',
 'hair-removal':'اتبعي دليل الأداة واختبري مساحة صغيرة أولًا. استخدمي ضغطًا خفيفًا ونظفي الأداة وجففيها بعد الاستخدام.',
 'foot-tools':'استخدمي المبرد بلطف على مناطق الجلد الخشن المناسبة وفق دليله، دون إفراط. نظفيه وجففيه بعد الاستخدام.',
 'concealer':'ضعي نقاطًا قليلة على المناطق المطلوبة وادمجي بالتربيت بفرشاة أو إسفنجة نظيفة، ثم ثبتي بخفة إذا رغبتِ.'}
overrides={
 'TS0206':'استخدمي مساءً وفق ملصق العبوة. ابدئي بكمية صغيرة وبوتيرة متباعدة حول عظمة العين بعيدًا عن الجفن المتحرك وخط الرموش، ثم رطبي البشرة.',
 'TS0211':'وزعي على مناطق الجسم ذات الملمس الخشن حسب تعليمات العبوة. ابدئي على مساحة صغيرة ولا تضعيه على جلد مجروح أو متهيج.',
 'TS0212':'رجّي العبوة جيدًا وفق الملصق ووزعي كمية كافية ومتجانسة. جددي التطبيق كل ساعتين وبعد الماء أو التعرق أو التجفيف.',
 'TS0214':'بعد التنظيف، وزعي طبقة رقيقة وفق تعليمات العبوة بعيدًا عن العينين. يُترك على البشرة ولا يُشطف؛ ابدئي بوتيرة متباعدة واتبعيه بمرطب.',
 'TS0216':'اتبعي مسافة الرش والتعليمات على العبوة ووزعي المنتج بيديك لتغطية متجانسة. لا ترشي مباشرة على الوجه ولا تستنشقي الرذاذ. جددي الحماية بانتظام.',
 'TS0217':'وزعي الحليب على الوجه ودلكي بلطف لرفع المكياج. أزيليه واشطفيه بالطريقة المحددة على العبوة قبل متابعة روتينك.',
 'TS0220':'استخدمي مساءً على بشرة نظيفة وجافة حسب ملصق العبوة. ابدئي بوتيرة متباعدة وبكمية قليلة، ثم ضعي المرطب وواقي الشمس صباحًا.',
 'TS0230':'اتبعي ملصق بنزويل بيروكسيد 4% على العبوة بدقة من حيث المدة وعدد مرات الاستخدام. بللي المنطقة ودلكي بلطف ثم اشطفي جيدًا؛ ابدئي تدريجيًا إذا سمحت التعليمات.',
 'TS0231':'طبقي على اليدين النظيفتين بالطريقة والمدة المحددتين على العبوة، ثم أزيلي الماسك بلطف. لا تسخنيه أو تستخدميه قرب الحرارة إلا إذا نص الدليل على ذلك.',
 'TS0241':'أكدي صيغة المنتج مع المتجر أولًا، ثم اتبعي طريقة التوزيع المطبوعة على العبوة نفسها. لا ترشي المنتج قرب الوجه بناءً على اسم Brume فقط.',
 'TS0261':'ضعي نقاطًا قليلة على الخدود أو الشفاه السليمة وادمجي مباشرة. زيدي اللون تدريجيًا وأغلقي العبوة بعد الاستخدام.',
 'TS0260':'اتبعي دليل الأداة واختبري مساحة صغيرة من الجسم أولًا. استخدمي حركة وضغطًا خفيفين فقط على المناطق المسموح بها، وتوقفي عند الاحمرار.',
 'TS0273':'اتبعي تعليمات العبوة لتوزيع طبقة رقيقة على الساقين السليمتين. اتركي اللون يستقر قبل ارتداء الملابس واختبري احتمال انتقاله للقماش.',
 'TS0277':'استخدمي شفرة نظيفة بحركات قصيرة وخفيفة حسب تعليمات العبوة، بعيدًا عن الجلد المتهيج والحبوب. لا تشاركي الشفرة وتخلّصي منها إذا تلفت.'}
shade_ids={204,208,222,223,228,248,250,251,252,253,255,256,259,262,264,265,266,267,268,273,274,285}
shades={202:'Very Black',219:'Dark Brown — بني داكن',240:'Light — فاتح',246:'52',261:'Rose',272:'120 Classic Ivory',275:'200 Ivory'}
general='للاستخدام الخارجي. اختبري الملاءمة على مساحة صغيرة، وتوقفي عند التهيج. اتبعي تعليمات العبوة وتحققي من الصلاحية.'
products=[]
for r in manifest:
 if r['existing']:r['imageStatus']='existing_verified';continue
 id=r['id'];n=int(id[2:]);c=copy[id];im=images[id]
 if id=='TS0241':r.update(name='Cicaplast B5 Care — Photographed Pack 40 ml',nameAr='عناية سيكابلاست B5 من لاروش بوزيه — العبوة المصوّرة',subcategory='المرطبات والكريمات')
 if id=='TS0256':r.update(name='Ultra HD Invisible Cover Foundation 30 ml',nameAr='كريم أساس ألترا HD من ميك أب فور إيفر',subcategory='كريم الأساس',size='30 ml')
 if id=='TS0257':r['size']='16 ml'
 if id=='TS0211':r.update(category='الجسم',subcategory='مرطبات الجسم والتنعيم')
 note=general
 if c['productType']=='sunscreen':note+=' تجنبي شمس الظهيرة والتعرض الطويل؛ الواقي لا يوفر حماية كاملة بمفرده.'
 if c['productType'] in ['foundation','bb-cc']:note+=' عامل الحماية في المكياج لا يغني عن واقي شمس مستقل بكمية كافية.'
 if n in [206,220]:note+=' يحتوي ريتينول؛ يُتجنب أثناء الحمل والتخطيط له، واستشيري مختصًا عند الرضاعة أو استخدام علاجات بشرة. لا تبدئيه مع مقشرات أخرى في الجلسة نفسها.'
 if n in [214,236,270,211]:note+=' تدرجي في الاستخدام وتجنبي جمعه مع مقشرات قوية في الروتين نفسه، واستخدمي واقي الشمس نهارًا.'
 if n==230:note+=' قد يسبب جفافًا أو يبهت الأقمشة والشعر. لا يُترك على الجلد ككريم. عند التحسس أو استمرار الحبوب استشيري الصيدلي أو الطبيب.'
 if n in [219,242,249]:note+=' نتيجة تجميلية للعناية والمظهر، وليس علاجًا مثبتًا لتساقط الشعر.'
 if n in [276,260]:note+=' لا يستخدم على الجروح أو الجلد الملتهب؛ استشيري مختصًا قبل استخدامه عند السكري أو ضعف الإحساس أو الدورة الدموية.'
 if n==218:note+=' تجنبيه عند التحسس من البروبوليس أو منتجات النحل.'
 variant=''
 if n in shade_ids:variant='الدرجة اللونية غير محددة في الصور المرسلة. أكدي اللون المتاح مع المتجر عبر واتساب قبل تثبيت الطلب؛ الصورة لا تمثل وعدًا بدرجة بعينها.'
 if n in [257,258]:variant='لون الأخضر/الأزرق يصف العبوة فقط؛ أكدي لون تركيبة الماسكارا مع المتجر قبل الطلب.'
 if n==241:variant='صيغة العبوة تحتاج تأكيدًا مع المتجر قبل الطلب؛ الوصف لا يفترض أنها بخاخ.'
 d=dict(nameAr=r['nameAr'],tagline=c['tagline'],benefits=c['benefits'],howToUse=overrides.get(id,how[c['productType']]),notes=note,imageType='photo',collection='k-beauty' if r['brand'] in ['Dr. Althea','Some By Mi','Beauty of Joseon','Farmstay','Arencia'] else 'beauty',featuredOrder=100,productType=c['productType'],size=r['size'],shade=shades.get(n,''),variantNote=variant,introductoryOffer=True,intakeBatch='2026-10-27',imageEditedWithAI=im['aiEdited'])
 if im['aiEdited']:d['imageNote']='صورة محسّنة بالذكاء الاصطناعي اعتمادًا على العبوة المصوّرة؛ تُراجع التفاصيل على العبوة الفعلية.'
 elif variant:d['imageNote']='صورة توضيحية للمنتج؛ الدرجة أو تفاصيل الإصدار تُؤكّد مع المتجر.'
 price=r['priceFils'];base=r['regularPriceFils'];discount=math.floor((base-price)*100/base+1e-8)
 r.update(discountPercent=discount,imageStatus='ready',productType=c['productType'])
 p=dict(id=id,brand=r['brand'],name=r['name'],category=r['category'],subcat=r['subcategory'],description=c['description'],reference=base,priceFils=price,discount=discount,image=im['primary'],approved=True,active=1,stock=24,details=d,source='Owner intake 2026-10-27',source_url=im['sourcePage'])
 assert len(p['description'])>90 and len(d['benefits'])==3 and 500<=price<=20000
 products.append(p)
assert len(products)==85 and len({p['id'] for p in products})==85
write('data/intake-2026-10-27/products.json',products);write('data/intake-2026-10-27/manifest.json',manifest)
catalog=[p for p in read('public/catalog.json') if p['id'] not in images]+products
write('public/catalog.json',catalog)
thumbs=read('public/catalog-thumbnails.json');thumbs.update({id:{k:r[k] for k in ['primary','thumbnail','highResolution','width','height']} for id,r in images.items()});write('public/catalog-thumbnails.json',thumbs)
def sql(v):return "'"+str(v).replace("'","''")+"'" if isinstance(v,str) else str(int(v))
statements=['-- Add only the 85 reviewed new SKUs. Never reseed, reset stock, or modify existing products/orders.','-- The comparison amount is an owner-approved regular price, not a historical sale price.']
for p in products:
 values=[p['id'],p['brand'],p['name'],p['category'],p['subcat'],p['description'],json.dumps(p['details'],ensure_ascii=False,separators=(',',':')),p['reference'],p['priceFils'],p['discount'],p['image'],p['source_url'],p['source'],24,1,1]
 statements.append('INSERT INTO products (id,brand,name,category,subcategory,description,details_json,reference_price_fils,price_fils,discount_percent,image_url,source_url,source_shop,stock,approved,active) VALUES ('+','.join(sql(x) for x in values)+') ON CONFLICT(id) DO NOTHING;')
(root/'db/migrations/0008_catalog_intake_2026_10_27.sql').write_text('\n'.join(statements)+'\n')
print(json.dumps({'new':len(products),'catalog':len(catalog),'existingMapped':sum(p['existing'] for p in manifest),'priceMin':min(p['priceFils'] for p in products),'priceMax':max(p['priceFils'] for p in products)},ensure_ascii=False))
