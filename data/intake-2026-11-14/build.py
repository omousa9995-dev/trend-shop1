"""Build four unpublished, additive product drafts from the owner's video.

No sale price, available quantity, discount or review is inferred from the video.
The existing Medicube night wrapping mask (TS0073) is deliberately untouched.
"""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
images = json.loads((folder / 'images.json').read_text())
video = 'ScreenRecording_11-14-2026 19-14-36_1.mov'
specs = [
    dict(id='TS0362', brand='Medicube', name='Triple Collagen Toner', size='140 ml', type='toner', subcat='التونر', second=0,
         nameAr='تونر الكولاجين الثلاثي من ميديكيوب — 140 مل',
         tagline='ابدئي روتينكِ بلمسة ترطيب.',
         description='تونر الكولاجين الثلاثي من ميديكيوب، خطوة ترطيب بعد التنظيف تساعد البشرة على الشعور بالنعومة وتمنحها مظهرًا نضرًا. مناسب ضمن روتين البشرة الجافة والمختلطة، ويُتبع بالسيروم والمرطب.',
         benefits=['ترطيب بعد تنظيف البشرة', 'ثلاثة أنواع من الكولاجين', 'لمظهر ناعم وندي'],
         howToUse='بعد التنظيف، وزعي كمية مناسبة على الوجه بعيدًا عن العينين، وربتي بلطف. أكملي بالسيروم والمرطب، وبواقي الشمس صباحًا.',
         variantNote='Triple Collagen Toner بحجم 140 مل، بالعبوة الوردية كما في الصورة.',
         en=dict(name='Medicube Triple Collagen Toner · 140 ml', tagline='A little hydration to start your routine.',
                 description='A hydrating post-cleanse toner with three forms of collagen for soft, dewy-looking skin. Suits a dry or combination skin routine; follow with serum and moisturizer.',
                 benefits=['Post-cleanse hydration', 'Three forms of collagen', 'A soft, dewy-looking finish'],
                 howToUse='After cleansing, smooth an appropriate amount over the face, avoiding eyes. Pat gently, then apply serum and moisturizer. Follow with sunscreen in the morning.',
                 variantNote='140 ml Triple Collagen Toner in the pictured pink bottle.')),
    dict(id='TS0363', brand='Medicube', name='PDRN Pink Tone Up Sun Cream SPF50+ PA++++', size='50 ml', type='sunscreen', subcat='واقي شمس', second=5,
         nameAr='واقي شمس ميديكيوب PDRN الوردي SPF50+ — 50 مل',
         tagline='حماية يومية، ولمسة خوخية وردية.',
         description='واقي شمس ميديكيوب PDRN Pink Tone Up بلمسة خوخية وردية لمظهر أكثر إشراقًا. يحمل SPF50+ PA++++ حسب العبوة، ويضم PDRN والنياسيناميد وحمض الهيالورونيك ضمن تركيبته.',
         benefits=['SPF50+ PA++++ حسب العبوة', 'لمسة خوخية وردية لتعديل مظهر اللون', 'قوام يومي خفيف'],
         howToUse='ضعيه بوفرة وبالتساوي كآخر خطوة صباحية قبل التعرض للشمس، وفق تعليمات العبوة. جددي التطبيق بانتظام وبعد التعرق أو السباحة، وتجنبي العينين.',
         variantNote='إصدار PDRN Pink Tone Up بحجم 50 مل؛ يختلف عن Collagen Firming Sun Cream الموجود في المتجر.',
         en=dict(name='Medicube PDRN Pink Tone Up Sun Cream SPF50+ PA++++ · 50 ml', tagline='Daily sun care with a peach-pink finish.',
                 description='A lightweight tone-up sunscreen with a peach-pink finish. The pack states SPF50+ PA++++; the formula features PDRN, niacinamide and hyaluronic acid.',
                 benefits=['SPF50+ PA++++ as labelled', 'Peach-pink tone-up finish', 'Light daily texture'],
                 howToUse='Apply generously and evenly as the final morning step before sun exposure, following your pack directions. Reapply regularly and after sweating or swimming. Avoid eyes.',
                 variantNote='50 ml PDRN Pink Tone Up version, distinct from Collagen Firming Sun Cream.')),
    dict(id='TS0364', brand='Dr.Melaxin', name='TX-Astaxanthin Overnight Wrapping Mask', size='80 ml', type='face-mask', subcat='ماسكات البشرة', second=6,
         nameAr='ماسك دكتور ميلاكسين الليلي TX-Astaxanthin — 80 مل',
         tagline='ختام هادئ لروتين المساء.',
         description='ماسك ليلي يتكوّن على البشرة كغشاء قابل للإزالة، للعناية بالترطيب ومظهر الإشراقة وتفاوت اللون. تضم تركيبته الترانيكساميك والأستازانتين والنياسيناميد؛ وهو الأنبوب الأحمر بحجم 80 مل الظاهر في الفيديو.',
         benefits=['غشاء ختامي لروتين المساء', 'عناية بمظهر اللون غير المتجانس', 'ترطيب ومظهر أكثر نعومة'],
         howToUse='كآخر خطوة مساءً، وزعي طبقة متساوية بعيدًا عن العينين والشفاه والحاجبين وخط الشعر. اتركيها تجف تمامًا قبل النوم. صباحًا، أزيلي الغشاء برفق واشطفي البقايا بالماء الفاتر.',
         variantNote='أنبوب الماسك الأحمر 80 مل. ظهور أداة التطبيق في الفيديو لا يؤكد أنها مشمولة مع المنتج.',
         en=dict(name='Dr.Melaxin TX-Astaxanthin Overnight Wrapping Mask · 80 ml', tagline='A quiet finishing step for your evening.',
                 description='An overnight film-forming mask for hydration and the appearance of uneven tone and texture. Features tranexamic acid, astaxanthin and niacinamide in the pictured red 80 ml tube.',
                 benefits=['An evening finishing film', 'Uneven-looking tone care', 'Hydrated, smoother-looking skin'],
                 howToUse='As the final evening step, spread evenly, avoiding eyes, lips, brows and hairline. Allow to dry completely before sleeping. Gently peel away in the morning and rinse residue with lukewarm water.',
                 variantNote='Red 80 ml tube. The video does not confirm whether the pictured applicator is included.')),
    dict(id='TS0365', brand='Dr.Melaxin', name='Peel Shot PS Glow Rice Toner', size='200 ml', type='toner', subcat='التونر', second=7,
         nameAr='تونر الأرز دكتور ميلاكسين Peel Shot Glow Rice — 200 مل',
         tagline='لمسة الأرز لروتين ناعم ومشرق.',
         description='تونر أرز مرطب من دكتور ميلاكسين لخطوة العناية بعد التنظيف. تحمل العبوة عبارة Rice Bran Water H + Ceramide، للعناية بالنعومة والرطوبة ومظهر الإشراقة. هذا التونر يختلف عن أمبولات تقشير الأرز.',
         benefits=['ترطيب بعد التنظيف', 'ماء نخالة الأرز والسيراميد حسب العبوة', 'لمظهر ناعم ومشرق'],
         howToUse='بعد التنظيف، ضعي كمية مناسبة على راحة اليد أو قطعة قطن، ووزعيها بلطف باتجاه نسيج البشرة بعيدًا عن العينين. أكملي بالمرطب، وبواقي الشمس صباحًا.',
         variantNote='Peel Shot PS Glow Rice Toner بحجم 200 مل، بعبوة وغطاء ذهبي كما في الفيديو؛ ليس أمبول White Rice أو Black Rice.',
         en=dict(name='Dr.Melaxin Peel Shot PS Glow Rice Toner · 200 ml', tagline='A rice-care moment for soft, radiant-looking skin.',
                 description='A moisturizing post-cleanse rice toner. The pictured pack reads Rice Bran Water H + Ceramide, for softness, moisture and radiance care. This is distinct from the rice exfoliating ampoules.',
                 benefits=['Post-cleanse moisture care', 'Rice bran water and ceramide as labelled', 'Soft, radiant-looking skin'],
                 howToUse='After cleansing, dispense onto your palm or a cotton pad. Gently smooth along skin texture, avoiding eyes. Follow with moisturizer and morning sunscreen.',
                 variantNote='Pictured 200 ml Peel Shot PS Glow Rice Toner with gold cap; not the White Rice or Black Rice ampoule.')),
]

products = []
for spec in specs:
    photos = [x for x in images if x['id'] == spec['id']]
    en = spec['en'] | {'notes': 'Patch test first. Stop if irritation occurs and follow the directions on your pack.'}
    if spec['id'] == 'TS0364':
        en['notes'] += ' Never force peeling or apply to irritated skin.'
    details = dict(imageType='photo', collection='k-beauty', koreanCare=True,
                   featuredOrder=100, merchandisingPriority=0, size=spec['size'], shade='',
                   intakeBatch='2026-11-14', introductoryOffer=False, contentVersion='5.20.1',
                   imageEditedWithAI=False, nameAr=spec['nameAr'], tagline=spec['tagline'],
                   productType=spec['type'], benefits=spec['benefits'], howToUse=spec['howToUse'],
                   variantNote=spec['variantNote'], notes='اختبريه على منطقة صغيرة. توقفي عند التهيج واتبعي تعليمات العبوة.', en=en)
    if spec['id'] == 'TS0364':
        details['notes'] += ' لا تنزعي الغشاء بقوة أو تضعيه على بشرة متهيجة.'
    products.append(dict(id=spec['id'], brand=spec['brand'], name=spec['name'], category='البشرة',
                         subcat=spec['subcat'], description=spec['description'], details=details,
                         reference=0, priceFils=0, discount=0, approved=False, active=0, stock=0,
                         image=photos[0]['url'],
                         galleryPhotos=[dict(url=x['url'], kind='pack', label={'ar': 'العبوة' if x['origin']=='official' else 'العبوة من فيديو المتجر', 'en': 'The pack' if x['origin']=='official' else 'Pack from the store video'}) for x in photos],
                         source='Owner video intake 2026-11-14', source_url=f'owner-supplied:{video}#t={spec["second"]}'))

(folder / 'products.json').write_text(json.dumps(products, ensure_ascii=False, indent=2) + '\n')
def quote(value):
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return "'" + str(value).replace("'", "''") + "'" if isinstance(value, str) else str(int(value))

lines = ['-- Owner video intake: four unpublished drafts; pricing and inventory await the owner.',
         '-- Additive only: never overwrites an existing ID, restocks it, or touches TS0073.']
columns = 'id,brand,name,category,subcategory,description,details_json,reference_price_fils,price_fils,discount_percent,image_url,approved,stock,active,source_url,source_shop'
for p in products:
    values = [p['id'], p['brand'], p['name'], p['category'], p['subcat'], p['description'], p['details'],
              0, 0, 0, p['image'], 0, 0, 0, p['source_url'], p['source']]
    # A second intake of the same identity cannot create another copy under a new ID.
    identity = f"lower(trim(brand))=lower({quote(p['brand'])}) AND lower(trim(name))=lower({quote(p['name'])})"
    lines.append(f"INSERT OR IGNORE INTO products({columns}) SELECT {','.join(map(quote, values))} WHERE NOT EXISTS(SELECT 1 FROM products WHERE {identity});")
    # A colliding, unrelated ID must never acquire this product's gallery.
    guard = f"id={quote(p['id'])} AND {identity} AND json_extract(details_json,'$.intakeBatch')='2026-11-14'"
    lines.append(f"INSERT OR IGNORE INTO product_photo_galleries(product_id,photos_json,revision,change_token) SELECT {quote(p['id'])},{quote(p['galleryPhotos'])},1,{quote('intake-2026-11-14-'+p['id'])} WHERE EXISTS(SELECT 1 FROM products WHERE {guard});")
(root / 'db/migrations/0032_owner_video_intake_2026_11_14.sql').write_text('\n'.join(lines) + '\n')
