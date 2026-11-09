/** Package a preview for API connections that cannot authorize Workers Assets uploads.
 * The normal production path remains `wrangler deploy` with the ASSETS binding.
 * This preview adapter invokes the Worker for static files too.
 */
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,relative,extname,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {buildSync} from 'esbuild';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const entries={};
function walk(dir){for(const file of readdirSync(dir,{withFileTypes:true})){
 const path=join(dir,file.name);
 if(file.isDirectory()){walk(path);continue;}
 if(file.name.startsWith('_')||path.startsWith(join('public','images','catalog')))continue;
 const bytes=readFileSync(path),ext=extname(path),binary=['.webp','.png','.ico','.woff2'].includes(ext);
 entries['/'+relative('public',path).split('\\').join('/')]=[binary?bytes.toString('base64'):bytes.toString('utf8'),types[ext]||'application/octet-stream',binary,createHash('sha256').update(bytes).digest('hex')];
}}
walk('public');
const adapter=`
const files=${JSON.stringify(entries)};
export const assets={async fetch(request){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 let path;try{path=decodeURIComponent(new URL(request.url).pathname)}catch{return new Response('Bad request',{status:400})}
 if(path==='/')path='/index.html';if(path==='/admin'||path==='/admin/')path='/admin.html';
 const file=files[path];if(!file)return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
 const headers={'content-type':file[1],'etag':'"'+file[3]+'"','cache-control':path.startsWith('/admin')||path.endsWith('.html')?'no-store':(/\.(?:webp|png|svg)$/.test(path)?'public, max-age=86400':'public, max-age=300')};
 if(request.headers.get('if-none-match')===headers.etag)return new Response(null,{status:304,headers});
 const body=request.method==='HEAD'?null:file[2]?Uint8Array.from(atob(file[0]),c=>c.charCodeAt(0)):file[0];
 return new Response(body,{headers});
}};`;
const entry="import worker from './src/worker.js';\nimport {assets} from './preview-assets.js';\nexport default {fetch(request,env,ctx){return worker.fetch(request,{...env,ASSETS:assets},ctx)}};\n";
mkdirSync('deployment-private',{recursive:true});
writeFileSync('deployment-private/preview-assets.js',adapter);
writeFileSync('deployment-private/preview-entry.js',entry);
// Resolve the actual Worker graph so newly imported server modules cannot be
// silently left out. Preserve directory names: src/site-settings.js and
// public/site-settings.js are separate modules with different responsibilities.
const graph=buildSync({entryPoints:['src/worker.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,logLevel:'silent'}).metafile;
const sources=[...new Set(Object.keys(graph.inputs).map(p=>p.split('?')[0]))].sort();
if(sources.some(p=>!p.startsWith('src/')&&!p.startsWith('public/')))throw Error('Unexpected deployment dependency');
const modules=[['preview-entry.js',entry],['preview-assets.js',adapter],...sources.map(p=>[p,readFileSync(p,'utf8').replace(/\.js\?v=[^'\"]+/g,'.js')])];
for(const [name,text]of modules){const path=join('deployment-private',name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);}
writeFileSync('deployment-private/modules.json',JSON.stringify(modules));
const hash=createHash('sha256').update(JSON.stringify([...modules].sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
writeFileSync('deployment-private/package-summary.json',JSON.stringify({files:Object.keys(entries).length,modules:modules.length,bytes:modules.reduce((n,[_,s])=>n+Buffer.byteLength(s),0),sha256:hash}));
console.log(readFileSync('deployment-private/package-summary.json','utf8'));
