import fs from 'node:fs';
import {createHash} from 'node:crypto';
const dir='data/korean-expansion';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const initial=read(dir+'/catalog-input.json'),expected=new Set(initial.map(p=>p.id));
const profiles=[1,2,3,4,5].flatMap(n=>read(dir+'/content-'+n+'.json'));
if(profiles.length!==105||new Set(profiles.map(p=>p.id)).size!==105||profiles.some(p=>!expected.has(p.id)))throw Error('All 105 exact products are required');
const metadata=read(dir+'/before-metadata.json'),timestamps=new Map(metadata.timestamps.flat());
let catalog=read('public/catalog.json');
catalog=catalog.filter(p=>p.id!=='TS0143'); // Legacy live row retains a story without changing the curated offline catalog.
const assets=fs.readdirSync(dir).filter(p=>/^generated-assets(?:-[a-z0-9]+)?\.json$/.test(p)).flatMap(p=>read(dir+'/'+p));
const byId=new Map();for(const a of assets){if(!a.id||!a.image)continue;const rows=byId.get(a.id)||[];if(!rows.some(x=>x.image===a.image))rows.push(a);byId.set(a.id,rows);}
const sqlLiteral=s=>"'"+String(s).replaceAll("'","''")+"'";
const statements=[],changes=[],index=[],coverage=[];
fs.mkdirSync('public/product-stories',{recursive:true});
for(const profile of profiles){
 const original=initial.find(p=>p.id===profile.id),p=catalog.find(p=>p.id===profile.id)||original;if(!p||p.brand!==profile.brand||original.name!==profile.productName)throw Error('Identity mismatch '+profile.id);
 for(const language of ['ar','en']){
  const c=profile[language];for(const k of ['name','tagline','description','textureTitle','textureText','fitText','notes'])if(typeof c?.[k]!=='string'||!c[k].trim())throw Error(profile.id+' missing '+language+'.'+k);
  if(c.benefits.length!==3||c.steps.length!==3||c.faq.length!==2)throw Error(profile.id+' inconsistent content');
  for(const[k,max]of [['name',160],['tagline',180],['description',1200],['notes',1200]])if(c[k].length>max)throw Error(profile.id+' '+language+'.'+k+' too long '+c[k].length);
  if(c.benefits.some(s=>s.length>240))throw Error(profile.id+' benefit too long');
 }
 const ar=profile.ar,en=profile.en,usage=c=>c.steps.map(x=>x.title+': '+x.text).join('\n');
 if(usage(ar).length>1500||usage(en).length>1500)throw Error(profile.id+' usage too long');
 const patch={nameAr:ar.name,tagline:ar.tagline,benefits:ar.benefits,howToUse:usage(ar),notes:ar.notes,contentVersion:'4.0.0',en:{name:en.name,tagline:en.tagline,description:en.description,benefits:en.benefits,howToUse:usage(en),notes:en.notes}};
 p.description=ar.description;p.details={...(p.details||{}),...patch,en:{...(p.details?.en||{}),...patch.en}};
 const scenes=(byId.get(p.id)||[]).filter(a=>fs.existsSync('public'+a.image));
 const images=scenes.map(a=>({url:a.image,thumbnail:a.thumbnail||a.image,kind:'promotional',label:{ar:'لحظة العناية',en:'The ritual'},caption:{ar:a.captionAr||'مشهد دعائي',en:a.captionEn||'Promotional scene'}}));
 const doc={id:p.id,brand:profile.brand,productName:profile.productName,primary:original.image,ar,en,sources:profile.sources,images};
 const bytes=JSON.stringify(doc);fs.writeFileSync('public/product-stories/'+p.id+'.json',bytes+'\n');
 statements.push('UPDATE products SET description='+sqlLiteral(ar.description)+', details_json=json_patch(details_json,'+sqlLiteral(JSON.stringify(patch))+"), updated_at=datetime('now') WHERE id="+sqlLiteral(p.id)+' AND name='+sqlLiteral(profile.productName)+' AND updated_at='+sqlLiteral(timestamps.get(p.id))+" AND COALESCE(json_extract(details_json,'$.contentVersion'),'')<>'4.0.0';");
 changes.push({id:p.id,description:ar.description,patch});
 index.push({id:p.id,brand:p.brand,status:profile.sourceStatus,sources:profile.sources,notes:profile.researchNotes,profileSha256:createHash('sha256').update(bytes).digest('hex')});
 coverage.push({id:p.id,scenes:images.length,bytes:Buffer.byteLength(bytes)});
}
fs.writeFileSync('public/catalog.json',JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync('db/migrations/0020_korean_product_stories.sql','-- Guarded copy-only updates. No price, stock, images, approvals, promotions or order changes.\n'+statements.join('\n')+'\n');
fs.writeFileSync(dir+'/content-updates.json',JSON.stringify(changes,null,2)+'\n');
fs.writeFileSync(dir+'/research-index.json',JSON.stringify(index,null,2)+'\n');
fs.writeFileSync(dir+'/asset-coverage.json',JSON.stringify(coverage,null,2)+'\n');
console.log(JSON.stringify({products:profiles.length,sourceStatuses:index.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),productsWithScenes:coverage.filter(x=>x.scenes).length,selectedScenes:coverage.reduce((n,x)=>n+x.scenes,0),profileBytes:coverage.reduce((n,x)=>n+x.bytes,0),maxProfileBytes:Math.max(...coverage.map(x=>x.bytes)),guardedStatements:statements.length}));
