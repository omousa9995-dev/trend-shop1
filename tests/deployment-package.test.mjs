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
 for(const path of ['/','/admin.html']){const r=await get(path);assert.equal(r.status,200);assert.match(await r.text(),/\.js\?v=5\.9\.0/);}
 for(const path of ['/shade-references.json','/shade-guide.js','/images/shades/huda-easy-bake-official-shade-guide.webp'])assert.equal((await get(path)).status,404);
 const license=await get('/licenses/web-vitals-LICENSE.txt');assert.match(license.headers.get('content-type'),/^text\/plain/);assert.match(await license.text(),/Apache License/);
 const graph=JSON.parse(readFileSync(new URL('../deployment-private/modules.json',import.meta.url)));
 assert.ok(graph.some(([name])=>name==='src/customer-report-api.js'));
 assert.ok(graph.some(([name])=>name==='src/experience-metrics.js'));
 assert.equal((await get('/api/admin/customer-report')).status,503);
});
