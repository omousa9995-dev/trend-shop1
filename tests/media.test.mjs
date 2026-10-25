import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadImage,serveImage} from '../src/media.js';
import worker from '../src/worker.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=','base64');
function fixture(){
 const values=new Map();
 const env={MEDIA:{
  async put(key,bytes,opts){values.set(key,{bytes:new Uint8Array(bytes),metadata:opts.metadata})},
  async getWithMetadata(key){const v=values.get(key);return v?{value:new Response(v.bytes).body,metadata:v.metadata}:{value:null}}
 }};
 const helpers={json:(data,status=200)=>new Response(JSON.stringify(data),{status}),error:(error,status=400)=>new Response(JSON.stringify({error}),{status}),sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin,throttle:async()=>true};
 const request=(bytes=png,type='image/png',origin='https://trend.test')=>{const body=new FormData();body.append('image',new Blob([bytes],{type}),'photo.png');return new Request('https://trend.test/api/admin/images',{method:'POST',headers:{origin,'x-trend-admin':'1'},body})};
 return {env,helpers,values,request};
}
test('Admin-uploaded product photo is persisted with a random path and served with safe headers',async()=>{
 const f=fixture();const uploaded=await uploadImage(f.request(),f.env,f.helpers);assert.equal(uploaded.status,201);
 const data=await uploaded.json();assert.match(data.imageUrl,/^\/media\/uploads\/\d{4}-\d{2}\/[a-f0-9-]{36}\.png$/);
 const served=await serveImage(new Request('https://trend.test'+data.imageUrl),f.env,{},data.imageUrl.slice(7));
 assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/png');assert.equal(served.headers.get('x-content-type-options'),'nosniff');assert.match(served.headers.get('cache-control'),/immutable/);
 assert.deepEqual(Buffer.from(await served.arrayBuffer()),png);
});
test('Image endpoint rejects cross-origin requests and disguised SVG uploads',async()=>{
 const f=fixture();assert.equal((await uploadImage(f.request(png,'image/png','https://evil.test'),f.env,f.helpers)).status,403);
 assert.equal((await uploadImage(f.request(Buffer.from('<svg onload="alert(1)"></svg>'),'image/jpeg'),f.env,f.helpers)).status,415);
 assert.equal(f.values.size,0);
});
test('Image endpoint caps a streamed multipart body and rejects traversal paths',async()=>{
 const f=fixture();const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1700000));controller.close()}});
 const oversized=new Request('https://trend.test/api/admin/images',{method:'POST',headers:{origin:'https://trend.test','x-trend-admin':'1','content-type':'multipart/form-data; boundary=test'},body,duplex:'half'});
 assert.equal((await uploadImage(oversized,f.env,f.helpers)).status,413);
 assert.equal((await serveImage(new Request('https://trend.test/media/anything'),f.env,{},'../secrets')).status,404);
 assert.equal(f.values.size,0);
});
test('The public API cannot upload a photo without a signed administrator session',async()=>{
 const f=fixture();const response=await worker.fetch(f.request(),{...f.env,DB:{},ADMIN_PASSWORD_HASH:'configured',SESSION_SECRET:'a-private-test-secret-longer-than-32-characters'},{});
 assert.equal(response.status,401);assert.equal(f.values.size,0);
});
