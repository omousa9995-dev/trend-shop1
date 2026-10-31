/** Package a preview for API connections that cannot authorize Workers Assets uploads.
 * The normal production path remains `wrangler deploy` with the ASSETS binding.
 * This preview adapter invokes the Worker for static files too.
 */
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
const entries={};
function walk(dir){for(const file of readdirSync(dir,{withFileTypes:true})){
 const path=join(dir,file.name);
 if(file.isDirectory()){walk(path);continue;}
 if(file.name.startsWith('_')||path.startsWith(join('public','images','catalog')))continue;
 const bytes=readFileSync(path),ext=extname(path),binary=['.webp','.png','.ico'].includes(ext);
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
const entry="import worker from './worker.js';\nimport {assets} from './preview-assets.js';\nexport default {fetch(request,env,ctx){return worker.fetch(request,{...env,ASSETS:assets},ctx)}};\n";
mkdirSync('deployment-private',{recursive:true});
writeFileSync('deployment-private/preview-assets.js',adapter);
writeFileSync('deployment-private/preview-entry.js',entry);
const modules=[['preview-entry.js',entry],['preview-assets.js',adapter],['worker.js',readFileSync('src/worker.js','utf8').replace("'../public/commerce.js'","'./commerce.js'").replace("'../public/product-variants.js'","'./product-variants.js'").replace("'../public/contact-phone.js'","'./contact-phone.js'")],['commerce.js',readFileSync('public/commerce.js','utf8')],...['product-variants.js','product-types.js','shop-tools.js','contact-phone.js'].map(f=>[f,readFileSync('public/'+f,'utf8')]),['product-page.js',readFileSync('src/product-page.js','utf8').replace("'../public/product-links.js'","'./product-links.js'")],['product-links.js',readFileSync('public/product-links.js','utf8')],['promotions.js',readFileSync('src/promotions.js','utf8').replace("'../public/commerce.js'","'./commerce.js'").replace("'../public/product-variants.js'","'./product-variants.js'").replace("'../public/contact-phone.js'","'./contact-phone.js'")],['admin-setup.js',readFileSync('src/admin-setup.js','utf8')],['media.js',readFileSync('src/media.js','utf8')]];
writeFileSync('deployment-private/modules.json',JSON.stringify(modules));
console.log(JSON.stringify({files:Object.keys(entries).length,modules:modules.length,bytes:modules.reduce((n,[_,s])=>n+Buffer.byteLength(s),0)}));
