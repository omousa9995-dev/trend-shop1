import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('The deployable Worker imports successfully and serves current store, admin and keeps removed shade references absent',async()=>{
 const root=new URL('../',import.meta.url);
 execFileSync(process.execPath,['scripts/prepare-api-preview.mjs'],{cwd:root,stdio:'pipe'});
 const {default:worker}=await import(new URL('../deployment-private/preview-entry.js',import.meta.url));

 const get=path=>worker.fetch(new Request('https://trend.test'+path),{},{});
 for(const [path,script] of [['/','/app.js?v=5.11.0'],['/admin.html','/admin.js?v=5.11.0']]){const r=await get(path);assert.equal(r.status,200);assert.ok((await r.text()).includes(script));}
 for(const path of ['/shade-references.json','/shade-guide.js','/images/shades/huda-easy-bake-official-shade-guide.webp'])assert.equal((await get(path)).status,404);
 for(const name of ['tajawal-regular','tajawal-medium','tajawal-bold','manrope-variable']){const path='/fonts/'+name+'-v512.woff2',r=await get(path),actual=Buffer.from(await r.arrayBuffer()),expected=readFileSync(new URL('../public'+path,import.meta.url));assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'font/woff2');assert.equal(actual.subarray(0,4).toString(),'wOF2');assert.deepEqual(actual,expected,'The deployed font must retain its original binary bytes');}
 const type=await get('/typography.css');assert.match(await type.text(),/font-display:swap/);
 const license=await get('/licenses/web-vitals-LICENSE.txt');assert.match(license.headers.get('content-type'),/^text\/plain/);assert.match(await license.text(),/Apache License/);
 const graph=JSON.parse(readFileSync(new URL('../deployment-private/modules.json',import.meta.url)));
 assert.ok(graph.some(([name])=>name==='src/customer-report-api.js'));
 assert.ok(graph.some(([name])=>name==='src/experience-metrics.js'));
 assert.equal((await get('/api/admin/customer-report')).status,503);
});
