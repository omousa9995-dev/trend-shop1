import {readFileSync,writeFileSync} from 'node:fs';
import {productDetails} from '../public/shop-tools.js';
import {productType} from '../public/product-types.js';
const baseline=JSON.parse(readFileSync('deployment-private/live-catalog-before.json','utf8'));
const styles={
 cleanser:[['اغسلي تعب اليوم، وابدئي لحظتكِ.','بداية ناعمة لروتين تحبّينه.','خذي نفسًا، ودعي العناية تبدأ.'],'في نهاية يومكِ، تستحقين بداية هادئة للعناية.','A gentle beginning to your own little ritual.','Make a little room for a calm cleansing moment.'],
 sunscreen:[['صباحكِ ألطف مع خطوة تهتم بكِ.','خذي عنايتكِ معكِ، أينما أخذَكِ النهار.','اختيار صغير يرافق يومكِ.'],'قبل أن يبدأ نهاركِ، امنحي العناية مساحة في روتينكِ.','A little care to take into your day.','Give your morning routine a moment of thoughtful care.'],
 moisturizer:[['لحظة ترطيب، وقليل من الدلال.','وقت قصير لكِ، واهتمام يستحقه روتينكِ.','امنحي العناية مكانها بين تفاصيل يومكِ.'],'بين مشاغل يومكِ، خذي لحظة عناية لنفسكِ.','A little moisture. A moment just for you.','Between the busy moments, make a little time for your skincare.'],
 serum:[['خطوة تحبّين العودة إليها.','تفاصيل صغيرة، واهتمام يشبهكِ.','مساحة صغيرة في روتينكِ، لكِ وحدكِ.'],'لا يحتاج روتينكِ إلى التعقيد؛ اختاري خطوة تلائم ما تبحثين عنه.','A thoughtful little addition to your ritual.','Keep your ritual simple and choose a step that suits what you need.'],
 toner:[['بعد التنظيف، تبدأ لحظتكِ التالية.','عنايتكِ، خطوة بهدوء.','امنحي روتينكِ وقتًا ألطف.'],'خذي وقتكِ بين خطوات العناية، واختاري ما ينسجم مع بشرتكِ.','A quiet moment between your care steps.','Take your time between care steps and find what fits your skin.'],
 mascara:[['لمسة للرموش، وابتسامة قبل الخروج.','نظرتكِ الجميلة، على طريقتكِ.','آخر لمسة، وأنتِ جاهزة للحظة.'],'قبل المشوار أو لقاء تحبّينه، اختاري اللمسة التي تشبهكِ.','A little lash detail before you go.','Before a busy day or a favourite evening, choose your own finishing touch.'],
 foundation:[['إطلالتكِ تبدأ باختيار يريحكِ.','قاعدة لإطلالة تحبّين أن تكون لكِ.','لمستكِ الخاصة، من أول خطوة.'],'اختاري القاعدة والدرجة التي تنسجم معكِ، وخذي راحتكِ في بناء إطلالتكِ.','Your look begins with a choice that feels like you.','Choose the base and tone that feel right, then take your time with your look.'],
 concealer:[['تفاصيل إطلالتكِ، بلمسة منكِ.','تغطية تختارينها، وثقة تشبهكِ.','لمسة صغيرة تكمّل استعدادكِ.'],'من مكياجكِ الخفيف إلى إطلالة المساء، اتركي اللمسة الأخيرة لذوقكِ.','A little detail, finished your way.','From a light everyday look to an evening out, make the finishing touch your own.'],
 lips:[['لون لمزاجكِ، وابتسامة ليومكِ.','لمسة تحبّينها في كل حقيبة.','ابتسامتكِ، ولمستكِ المفضلة.'],'لحظة أمام المرآة، واختيار صغير يعبّر عنكِ.','A little colour. A smile that is yours.','A moment at the mirror and a little choice that feels like you.'],
 blush:[['لمسة للخدود، وفرحة في التفاصيل.','لون لطيف للحظاتكِ الحلوة.','إطلالة تحبّينها، بلمستكِ.'],'امنحي إطلالتكِ لمسة لون على ذوقكِ، وابدئي يومكِ بابتسامة.','A touch of colour for your lovely moments.','Add a little colour your way and start your day with a smile.'],
 powder:[['اللمسة الأخيرة، على مزاجكِ.','تفاصيل تُكمل إطلالة تشبهكِ.','خذي وقتكِ مع آخر لمسة.'],'حين تصلين إلى اللمسات الأخيرة، اختاري ما ينسجم مع إطلالتكِ.','Your finishing touch, your way.','When it is time for the finishing touches, choose what feels right for your look.'],
 'body-care':[['دلال صغير بين تفاصيل يومكِ.','لأن وقت العناية، وقت لكِ.','اهتمام يليق بلحظاتكِ الهادئة.'],'اجعلي للعناية وقتًا مريحًا بين تفاصيل يومكِ.','A little care in the quieter moments.','Make a little comfortable space for care in your everyday routine.'],
 'hair-oil':[['لمسة عناية لخصلات تحبّينها.','وقتكِ مع شعركِ، بقليل من الدلال.','تفاصيل صغيرة لروتين شعركِ.'],'خذي لحظة مع خصلاتكِ واختاري ما يناسب روتين شعركِ.','A little care for the hair you love.','Take a moment with your hair and choose what fits your routine.'],
 'face-mask':[['استراحة للعناية، لكِ وحدكِ.','خذي وقتكِ، هذه لحظتكِ.','لحظة هدوء بين يومين مزدحمين.'],'خصصي لنفسكِ استراحة صغيرة، واتبعي خطوات العناية على مهل.','A little pause. A moment for you.','Set aside a little pause and take your care steps at your own pace.']
};
const defaultStyle=[['تفاصيل جميلة، تختارينها لنفسكِ.','اختياركِ، ولمستكِ، ولحظتكِ.','دلال بسيط يرافق يومكِ.'],'اختاري ما ينسجم مع روتينكِ، وخذي لحظتكِ كما تحبّين.','A little detail, chosen just for you.','Choose what fits your routine and make the moment your own.'];
const first=s=>String(s||'').split(/[.!؟]/)[0].trim();const frequencies=new Map();for(const p of baseline.products)frequencies.set(first(p.description),(frequencies.get(first(p.description))||0)+1);
const escape=s=>"'"+String(s).replaceAll("'","''")+"'";
const updates=[];
for(const [i,p] of baseline.products.entries()){
 const d=productDetails(p),style=styles[productType(p)]||defaultStyle;
 const opening=first(p.description),remove=(frequencies.get(opening)||0)>=3,body=remove?p.description.slice(opening.length).replace(/^[.!؟\s]+/,''):p.description;
 const description=style[1]+' '+body,tagline=style[0][i%style[0].length],enDescription=style[3]+' '+(d.en?.description||p.name),enTagline=style[2];
 updates.push({id:p.id,before:{description:p.description,tagline:d.tagline||''},description,tagline,enDescription,enTagline});
}
const sql=updates.map(u=>`UPDATE products SET description=${escape(u.description)},details_json=json_set(details_json,'$.tagline',${escape(u.tagline)},'$.en.tagline',${escape(u.enTagline)},'$.en.description',${escape(u.enDescription)},'$.toneVersion','4.1.0'),updated_at=datetime('now') WHERE id=${escape(u.id)} AND description=${escape(u.before.description)} AND COALESCE(json_extract(details_json,'$.tagline'),'')=${escape(u.before.tagline)};`).join('\n');
writeFileSync('db/migrations/0022_customer_copy_v41.sql','-- Customer wording only. Conditional writes preserve any owner edits made after the baseline.\n'+sql+'\n');
writeFileSync('data/customer-copy-v41.json',JSON.stringify(updates,null,2)+'\n');
const byId=new Map(updates.map(x=>[x.id,x]));
const catalog=JSON.parse(readFileSync('public/catalog.json','utf8'));for(const p of catalog){const u=byId.get(p.id);if(!u)continue;const d=productDetails(p);p.description=u.description;Object.assign(d,{tagline:u.tagline,toneVersion:'4.1.0',en:{...d.en,tagline:u.enTagline,description:u.enDescription}});if(p.details)p.details=d;else p.details_json=JSON.stringify(d)}
writeFileSync('public/catalog.json',JSON.stringify(catalog,null,2)+'\n');
let stories=0;for(const u of updates){let path='public/product-stories/'+u.id+'.json',profile;try{profile=JSON.parse(readFileSync(path,'utf8'))}catch{continue}Object.assign(profile.ar,{tagline:u.tagline,description:u.description});Object.assign(profile.en,{tagline:u.enTagline,description:u.enDescription});writeFileSync(path,JSON.stringify(profile)+'\n');stories++}
console.log(JSON.stringify({products:updates.length,stories}));
