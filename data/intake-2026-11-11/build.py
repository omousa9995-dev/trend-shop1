from pathlib import Path
import json
root=Path(__file__).resolve().parents[2]
def read(p):return json.loads((root/p).read_text())
def write(p,v):(root/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
images=read('data/intake-2026-11-11/images.json')
for r in images:
 r['url']=r['url'].replace('/public/','/');r['thumbnail']=r['thumbnail'].replace('/public/','/');r['source']=Path(r['source']).name
write('data/intake-2026-11-11/images.json',images)
byname={x['name']:x for x in images}
common={'imageType':'photo','collection':'beauty','featuredOrder':3,'merchandisingPriority':0,'size':'','shade':'','variantNote':'','intakeBatch':'2026-11-11','introductoryOffer':False,'contentVersion':'5.13.0'}
items=[
 {'id':'TS0360','brand':'Clinique','name':'Dramatically Different Moisturizing Lotion+','category':'البشرة','subcat':'مرطبات الوجه','reference':19990,'priceFils':19990,'discount':0,'approved':True,'active':1,'stock':24,
 'description':'خطوة ترطيب ناعمة تمنح روتينكِ اليومي إحساسًا بالراحة. لوشن Dramatically Different Moisturizing Lotion+ من كلينيك مخصص للبشرة الجافة جدًا إلى المختلطة المائلة للجفاف، ويُستخدم على الوجه والرقبة صباحًا ومساءً أو بحسب الحاجة. اختاريه إذا كنتِ تبحثين عن لوشن يومي ضمن روتين الترطيب، مع الانتباه إلى أنه إصدار Lotion+ وليس الجل أو الجيلي، ولا يغني عن واقي الشمس.',
 'details':{**common,'nameAr':'لوشن الترطيب اليومي من كلينيك — Dramatically Different Lotion+','tagline':'لحظة ترطيب، وراحة ترافق يومكِ.','productType':'moisturizer','benefits':['مخصص للبشرة الجافة جدًا إلى المختلطة المائلة للجفاف','لوشن لترطيب الوجه والرقبة ضمن الروتين اليومي','يُستخدم صباحًا ومساءً أو على المناطق التي تحتاج الترطيب'],
 'howToUse':'1: نظفي البشرة وجففيها بلطف.\n2: وزعي كمية مناسبة على الوجه والرقبة، بعيدًا عن العينين، صباحًا ومساءً أو حسب الحاجة.\n3: دلكي بلطف، واتبعي روتين الصباح بواقي شمس مناسب. اتبعي تعليمات العبوة الفعلية.',
 'notes':'هذا هو إصدار Lotion+؛ ليس Moisturizing Gel أو Jelly ولا يحتوي اسمه على حماية شمسية. راجعي مكونات العبوة المتاحة لديكِ، وتوقفي عن الاستخدام إذا ظهر تهيج. الحجم غير محدد من الصورة؛ يمكن تأكيده مع المتجر قبل الطلب.',
 'variantNote':'إصدار Lotion+ الأصفر بالمضخة كما في الصورة. تأكدي من حجم العبوة المتاحة مع المتجر عند الحاجة.',
 'en':{'name':'Clinique · Dramatically Different Moisturizing Lotion+','tagline':'A softer moment in your daily routine.','description':'Bring a comfortable moisturizing step to your daily routine. Clinique Dramatically Different Moisturizing Lotion+ is a face and neck lotion for very dry to dry combination skin. Apply morning and evening, or where needed. This is the yellow Lotion+ formula shown in the owner’s product photo, not the Gel or Jelly version. It does not replace sunscreen.',
 'benefits':['For very dry to dry combination skin','A daily moisturizing step for face and neck','Use morning and evening, or where needed'],
 'howToUse':'1: Cleanse and gently pat skin dry.\n2: Apply an appropriate amount to face and neck, avoiding the eyes, morning and evening or where needed.\n3: Smooth gently and follow your morning routine with sunscreen. Follow the directions on your actual pack.',
 'notes':'Lotion+ is distinct from the Gel and Jelly formulas. Check the ingredient list on your actual pack and stop use if irritation occurs. The pack size cannot be confirmed from the supplied front photo; ask the store if needed.','variantNote':'Yellow Lotion+ pump bottle as pictured. Confirm the available pack size with the store if needed.'}}},
 {'id':'TS0361','brand':'June','name':'Bloom Bloom Premium Soap','category':'الجسم','subcat':'صابون وتنظيف الجسم','reference':3990,'priceFils':3990,'discount':0,'approved':True,'active':1,'stock':24,
 'description':'أضيفي إلى روتين جسمكِ خطوة تنظيف بعبوة Bloom Bloom المرحة من June. هذا صابون ضمن العناية الخارجية بالجسم، وتظهر على غلافه عبارة Formulated in Korea؛ وهي وصف للتركيبة ولا تعني وحدها أن المنتج مصنوع في كوريا. استخدميه وفق إرشادات العبوة، واشطفي جيدًا، ثم استكملي روتينكِ بمرطب للجسم عند الحاجة. نقدمه كمنتج تجميلي للتنظيف، دون وعود بتغيير شكل الجسم أو حجمه.',
 'details':{**common,'nameAr':'صابونة جون بلوم بلوم — Bloom Bloom Premium Soap','tagline':'روتين جسمكِ، بلمسة Bloom Bloom.','productType':'body-cleansing','benefits':['صابون للتنظيف الخارجي ضمن روتين عناية الجسم','عبوة June Bloom Bloom كما تظهر في الصورة','خطوة تنظيف يمكن إتباعها بمرطب الجسم المناسب لكِ'],
 'howToUse':'1: راجعي مواضع الاستخدام وتعليمات العبوة قبل الاستعمال.\n2: بللي الصابون وكوّني رغوة بين اليدين، ثم نظفي بلطف جلد الجسم الخارجي السليم.\n3: اشطفي جيدًا وجففي بلطف، واستكملي بالترطيب عند الحاجة. احفظي الصابون في مكان جاف بين الاستعمالات.',
 'notes':'للاستخدام الخارجي بحسب العبوة، بعيدًا عن العينين والمناطق المخاطية والجلد المتهيج. لا نقدمه بوعد بالتكبير أو تغيير شكل الجسم. لا تتوفر صورة خلفية للمكونات أو الوزن؛ راجعي العبوة المتاحة أو اسألي المتجر لتأكيدها.',
 'variantNote':'العبوة المكتوب عليها June Bloom Bloom Premium Soap. عبارة Formulated in Korea تشير إلى التركيبة وليست تأكيدًا لبلد التصنيع.',
 'en':{'name':'June · Bloom Bloom Premium Soap','tagline':'A Bloom Bloom detail for your body-care routine.','description':'Add a cleansing step to your body-care routine with June Bloom Bloom Premium Soap in its distinctive pink and blue pack. The front reads “Formulated in Korea”, which describes the formulation and does not by itself confirm the manufacturing country. Follow your pack’s directions for external body use, rinse thoroughly and moisturize as needed. We present it as a cosmetic cleansing product, without body-shape or enlargement promises.',
 'benefits':['Soap for an external body-cleansing routine','The pictured June Bloom Bloom Premium Soap pack','Follow cleansing with a suitable body moisturizer as needed'],
 'howToUse':'1: Check the intended application areas and directions on your pack.\n2: Wet the soap and lather between your hands, then gently cleanse intact external body skin.\n3: Rinse thoroughly and pat dry. Moisturize as needed and keep the soap dry between uses.',
 'notes':'External use according to the pack directions. Avoid eyes, mucous membranes and irritated skin. No enlargement or body-shape results are promised. Ingredients and net weight are not visible in the supplied front photo; confirm the available pack with the store.','variantNote':'June Bloom Bloom Premium Soap as pictured. “Formulated in Korea” does not by itself confirm manufacturing country.'}}}
]
for item,prefix in zip(items,['clinique','june']):
 pack=byname[prefix+'-pack'];related=[r for r in images if r['id']==item['id']]
 item['image']=pack['url'];item['galleryPhotos']=[{'url':r['url'],'thumbnail':r['thumbnail'],'kind':r['kind'],'label':{'ar':'العبوة' if r['kind']=='pack' else 'مشهد دعائي','en':'The pack' if r['kind']=='pack' else 'Promotional scene'}} for r in related]
 item['source']='Owner intake 2026-11-11';item['source_url']='owner-supplied:'+('IMG_0671.jpeg' if prefix=='clinique' else 'IMG_0670.png')
write('data/intake-2026-11-11/products.json',items)
catalog=read('public/catalog.json');ids={p['id'] for p in catalog};catalog.extend(p for p in items if p['id'] not in ids);write('public/catalog.json',catalog)
thumbs=read('public/catalog-thumbnails.json');galleries=read('public/product-galleries.json');media=read('public/product-media.json')
for p in items:
 pack=p['galleryPhotos'][0];thumbs[p['id']]={'primary':p['image'],'thumbnail':pack['thumbnail'],'large':p['image']};galleries[p['id']]={'primary':p['image'],'images':[x['url'] for x in p['galleryPhotos'][1:]]};scene=p['galleryPhotos'][1];media[p['id']]={'primary':p['image'],'image':scene['url'],'thumbnail':scene['thumbnail'],'caption':{'ar':'مشهد دعائي','en':'Promotional scene'}}
write('public/catalog-thumbnails.json',thumbs);write('public/product-galleries.json',galleries);write('public/product-media.json',media)
def quote(x):return "'"+str(x).replace("'","''")+"'"
lines=['-- Additive owner-supplied intake. Never restocks or replaces an existing product.']
for p in items:
 vals=[p['id'],p['brand'],p['name'],p['category'],p['subcat'],p['description'],json.dumps(p['details'],ensure_ascii=False),p['reference'],p['priceFils'],p['discount'],p['image'],1,24,1,p['source_url']]
 lines.append('INSERT OR IGNORE INTO products(id,brand,name,category,subcategory,description,details_json,reference_price_fils,price_fils,discount_percent,image_url,approved,stock,active,source_url) VALUES('+','.join(str(v) if isinstance(v,int) else quote(v) for v in vals)+');')
sql='\n'.join(lines)+'\n';(root/'db/migrations/0029_owner_intake_2026_11_11.sql').write_text(sql)
