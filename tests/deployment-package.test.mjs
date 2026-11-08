import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('The deployable Worker imports successfully and serves current store, admin and real shade-chart bytes',async()=>{
 const root=new URL('../',import.meta.url);
 execFileSync(process.execPath,['scripts/prepare-api-preview.mjs'],{cwd:root,stdio:'pipe'});
 const {default:worker}=await import(new URL('../deployment-private/preview-entry.js',import.meta.url));
 const provenance=JSON.parse(readFileSync(new URL('../data/shade-reference-provenance-v580.json',import.meta.url)));
 const get=path=>worker.fetch(new Request('https://trend.test'+path),{},{});
 for(const path of ['/','/admin.html']){const r=await get(path);assert.equal(r.status,200);assert.match(await r.text(),/\.js\?v=5\.8\.0/);}
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 for(const asset of provenance.assets){const r=await get(asset.path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.equal(digest(new Uint8Array(await r.arrayBuffer())),asset.derivativeSha256);}
 const license=await get('/licenses/web-vitals-LICENSE.txt');assert.match(license.headers.get('content-type'),/^text\/plain/);assert.match(await license.text(),/Apache License/);
 const graph=JSON.parse(readFileSync(new URL('../deployment-private/modules.json',import.meta.url)));
 assert.ok(graph.some(([name])=>name==='src/customer-report-api.js'));
 assert.ok(graph.some(([name])=>name==='src/experience-metrics.js'));
 assert.equal((await get('/api/admin/customer-report')).status,503);
});
