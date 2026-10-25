import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../integrations/google-apps-script.gs',import.meta.url),'utf8');
const token='genuine-unique-secret-for-webhook-2026-one';
function testBridge(body,quota=99){
 const sent=[];
 const ctx={
  PropertiesService:{getScriptProperties(){return {getProperty(k){return k==='TREND_WEBHOOK_TOKEN'?token:null}}}},
  MailApp:{getRemainingDailyQuota(){return quota},sendEmail(x){sent.push(x)}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput(s){return {getContent(){return s},setMimeType(){return this}}}},
  console:{error(){}},JSON,String,Number,Array,Error,RegExp
 };
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const response=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(body)}}).getContent());
 return {sent,response}
}
const order={id:'TR-20261025-ABC1234',name:'سارة',phone:'0791234567',email:'sara@example.org',governorate:'عمّان',address:'عنوان تجريبي',payment:'cliq',subtotal_fils:18400,items:[{name:'خاص - كريم',qty:2,price_fils:9200}]};
test('Only a valid server token allows two messages, no detailed invoice in customer email',()=>{
 const {sent,response}=testBridge({token,order});assert.equal(response.ok,true);assert.equal(sent.length,2);
 assert.equal(sent[0].to,'stpostpo470@gmail.com');assert.equal(sent[1].to,'sara@example.org');
 assert.match(sent[0].body,/خاص - كريم/);assert.match(sent[0].body,/عنوان تجريبي/);
 assert.match(sent[1].body,/TR-20261025-ABC1234/);assert.match(sent[1].body,/TRUSTTREND/);
 assert.doesNotMatch(sent[1].body,/خاص - كريم|18\.400|فاتورة/);
});
test('Invalid token and exhausted daily quota cannot send mail',()=>{
 assert.equal(testBridge({token:'invalid',order}).sent.length,0);
 assert.equal(testBridge({token,order},0).sent.length,0);
});
test('The owner is notified when only one recipient slot remains, even if the customer provided email',()=>{
 const {sent,response}=testBridge({token,order},1);assert.equal(sent.length,1);assert.equal(sent[0].to,'stpostpo470@gmail.com');assert.equal(response.ok,true);assert.equal(response.ownerSent,true);assert.equal(response.customerSent,false);
});
test('Authenticated health checks send nothing and connection tests only email the store',()=>{
 const health=testBridge({token,action:'health'});assert.equal(health.response.ok,true);assert.equal(health.sent.length,0);
 const check=testBridge({token,action:'test'});assert.equal(check.response.test,true);assert.equal(check.sent.length,1);assert.equal(check.sent[0].to,'stpostpo470@gmail.com');
 assert.equal(testBridge({token:'wrong',action:'test'}).sent.length,0);
 assert.equal(testBridge({token,action:'unsupported'}).response.ok,false);
});
test('An order without customer email sends only the owner notice, including with one recipient slot left',()=>{
 const {sent,response}=testBridge({token,order:{...order,email:''}},1);
 assert.equal(response.ok,true);assert.equal(sent.length,1);assert.equal(sent[0].to,'stpostpo470@gmail.com');
 assert.equal(response.customerSent,false);assert.match(sent[0].body,/لم تضف الزبونة بريدًا/);
});
test('An invalid nonempty customer email cannot reach the mail sender',()=>{
 const {sent,response}=testBridge({token,order:{...order,email:'invalid'}});
 assert.equal(response.ok,false);assert.equal(sent.length,0);
});

test('Owner initialization preserves an existing secret and logs no secret while sending the store test',()=>{
 const properties=new Map(),sent=[],logs=[];let generated=0;
 const ctx={PropertiesService:{getScriptProperties(){return {getProperty:k=>properties.get(k),setProperty(k,v){properties.set(k,v)}}}},Utilities:{getUuid(){generated++;return 'random-owner-uuid-0123456789-'+generated}},MailApp:{getRemainingDailyQuota(){return 99},sendEmail(x){sent.push(x)}},ContentService:{MimeType:{JSON:'application/json'},createTextOutput(s){return {getContent(){return s},setMimeType(){return this}}}},console:{log(s){logs.push(s)},error(){}},JSON,String,Number,Array,Error,RegExp};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 assert.equal(JSON.parse(ctx.initializeMailBridge().getContent()).ok,true);
 const created=properties.get('TREND_WEBHOOK_TOKEN');assert.ok(created.length>=32);assert.equal(generated,2);
 assert.equal(JSON.parse(ctx.initializeMailBridge().getContent()).ok,true);assert.equal(generated,2);assert.equal(properties.get('TREND_WEBHOOK_TOKEN'),created);
 assert.equal(JSON.parse(ctx.checkMailBridge().getContent()).ok,true);assert.equal(sent.length,2);assert.ok(sent.every(x=>x.to==='stpostpo470@gmail.com'));
 assert.ok(logs.every(x=>!x.includes(created)));
});
