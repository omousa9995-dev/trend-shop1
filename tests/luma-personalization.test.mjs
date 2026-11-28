import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {LUMA_PREFERENCES_KEY,shareQuizProfile} from '../public/luma-profile.js';
import {quizSkinProfile,installSkinQuiz} from '../public/skin-quiz.js';
import {whatsappChannelUrl,normalizeSiteSettings,DEFAULT_SITE_SETTINGS} from '../public/site-settings.js';
import {channelDraft} from '../public/whatsapp-channel.js';

const bundle=buildSync({
 entryPoints:[new URL('../public/luma-widget.js',import.meta.url).pathname],bundle:true,
 format:'iife',globalName:'LumaWidget',write:false,logLevel:'silent'
}).outputFiles[0].text;

test('Five-answer quiz uses skin signals independently of sensitivity, goal and routine length',()=>{
 for(const skinType of ['dry','oily','balanced','combination'])assert.equal(quizSkinProfile({afterWash:skinType,midday:skinType}).skinType,skinType);
 assert.equal(quizSkinProfile({afterWash:'dry',midday:'oily',goal:'dryness'}).skinType,'unknown');
 assert.equal(quizSkinProfile({afterWash:'unknown',midday:'oily'}).skinType,'unknown');
 assert.deepEqual(quizSkinProfile({afterWash:'dry',midday:'combination',sensitive:'yes',goal:'shine',routine:'am-pm'}),
  {skinType:'combination',sensitive:'yes',area:'face',goal:'shine',preferredRoutine:'am-pm'});
 assert.equal(quizSkinProfile({sensitive:'yes'}).skinType,'unknown');
});

test('The skincare quiz analyzes five answers before showing the result and a visible Luma handoff',async t=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://trend.test/'}),d=dom.window.document;
 t.after(()=>dom.window.close());
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))};
 let handoff;
 const quiz=installSkinQuiz(d,{continueWithLuma:profile=>{handoff=profile;}});
 quiz.update(true,'ar');
 const card=d.querySelector('[data-skin-quiz-entry]');
 assert.equal(card.hidden,false);
 assert.equal(card.querySelector('.skin-quiz-emoji').textContent,'🧴');
 assert.equal(card.closest('[data-care-region]'),null);
 card.querySelector('button').click();
 const choose=text=>{
  const button=[...d.querySelectorAll('.skin-quiz-dialog button')].find(b=>b.textContent===text);
  assert.ok(button,'Missing choice '+text);
  button.click();
 };
 const labels=['بحسّ بشدّ وبدي أرطّبها فورًا','على الجبهة والأنف والذقن، والخدود أقل','بلاحظ احمرار أو لسعة بسهولة','تخفيف مظهر اللمعة','خطوات للصباح والمساء'];
 for(const [step,label] of labels.entries()){
  const progress=d.querySelector('.skin-quiz-dialog progress');
  assert.equal(progress.max,5);
  assert.equal(progress.value,step+1);
  if(step===2){
   choose('السابق');
   assert.equal(d.querySelector('.skin-quiz-selected').textContent,labels[1]);
   choose(labels[1]);
  }
  choose(label);
 }
 assert.match(d.querySelector('.skin-quiz-analysis').textContent,/بنحلّل إجاباتكِ/);
 assert.equal(d.querySelector('.skin-quiz-summary'),null);
 await new Promise(resolve=>setTimeout(resolve,2010));
 assert.equal(d.querySelector('.skin-quiz-analysis'),null);
 assert.match(d.querySelector('.skin-quiz-dialog').textContent,/مختلطة/);
 assert.match(d.querySelector('.skin-quiz-dialog').textContent,/تتأثر بسهولة/);
 assert.match(d.querySelector('.skin-quiz-dialog').textContent,/تخفيف مظهر اللمعة/);
 assert.equal(d.querySelector('#lumaChat'),null);
 const continuation=d.querySelector('.skin-quiz-luma');
 assert.match(continuation.textContent,/كمّلي مع لُمى/);
 continuation.click();
 assert.equal(handoff.skinType,'combination');
 assert.equal(handoff.sensitive,'yes');
 choose('إعادة الاختبار');
 assert.equal(d.querySelector('.skin-quiz-dialog progress').value,1);
 assert.equal(d.querySelector('.skin-quiz-selected'),null);
 quiz.update(false,'ar');
 assert.equal(d.querySelector('.skin-quiz-dialog'),null);
 assert.equal(card.hidden,true);
});

test('A quiz handoff opens Luma with a one-use profile and waits for the visitor to send a message',async t=>{
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://trend.test/care-assistant.html?from=skin-quiz',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.scrollTo=()=>{};w.TextDecoder=TextDecoder;w.AbortController=AbortController;
 let sent;
 w.fetch=async(_url,{body})=>{
  sent=JSON.parse(body);
  return new Response('event: delta\ndata: {"text":"تمام، نبلش بخطوات بسيطة."}\n\nevent: done\ndata: {}\n\n');
 };
 assert.equal(shareQuizProfile(w.sessionStorage,{skinType:'dry',sensitive:'yes',goal:'dryness',preferredRoutine:'am-pm',ageGroup:'25-34'}),true);
 w.eval(bundle);
 const api=await w.LumaWidget.mountLumaWidget({standalone:true,status:{available:true,imagesAvailable:false}});
 assert.match(api.dialog.textContent,/وصلتني نتيجة الكويز/);
 assert.equal(w.sessionStorage.length,0);
 assert.equal(w.localStorage.getItem(LUMA_PREFERENCES_KEY),null);
 assert.equal(sent,undefined);
 api.dialog.querySelector('textarea').value='احكيلي عن نتيجة الكويز';
 api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(sent.profile.skinType,'dry');
 assert.equal(sent.profile.sensitive,'yes');
 assert.equal(sent.profile.goal,'dryness');
 assert.equal(sent.profile.preferredRoutine,'am-pm');
 assert.equal(sent.profile.ageGroup,undefined);
 await new Promise(resolve=>setTimeout(resolve,20));
 api.destroy();
});

test('Guided Luma remembers chosen preferences without a quiz or a budget question',async t=>{
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://trend.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.scrollTo=()=>{};w.TextDecoder=TextDecoder;w.AbortController=AbortController;
 let sent;
 w.fetch=async(url,{body})=>{
  sent=JSON.parse(body);
  return new Response('event: delta\ndata: {"text":"صباحًا: ترطيب ووقاية. مساءً: تنظيف وترطيب."}\n\nevent: done\ndata: {}\n\n');
 };
 w.eval(bundle);
 const api=await w.LumaWidget.mountLumaWidget({status:{available:true,imagesAvailable:false}});
 api.open();
 assert.doesNotMatch(api.dialog.textContent,/اكتشفي بشرتك|شو المبلغ/);
 const choose=text=>{
  const match=[...api.dialog.querySelectorAll('.luma-quick button')].find(button=>button.textContent===text);
  assert.ok(match,'Missing choice '+text);
  match.click();
 };
 assert.equal(w.localStorage.getItem(LUMA_PREFERENCES_KEY),null);
 assert.equal(api.dialog.querySelector('[data-luma-remember]').checked,true);
 choose('روتين يومي بسيط');
 choose('مختلطة');
 choose('اللمعان');
 choose('25–34');
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(sent.guided,true);
 assert.equal(sent.intent,'routine');
 assert.equal(sent.budgetFils,null);
 assert.equal(sent.profile.skinType,'combination');
 assert.equal(sent.profile.ageGroup,'25-34');
 assert.equal(sent.profile.goal,'shine');
 assert.deepEqual(JSON.parse(w.localStorage.getItem(LUMA_PREFERENCES_KEY)),{
  version:2,profile:{skinType:'combination',ageGroup:'25-34',goal:'shine',preferredRoutine:'simple',concerns:['shine']}
 });
 assert.match(api.dialog.querySelector('.luma-log').textContent,/صباحًا.+مساءً/);
 api.dialog.querySelector('[data-luma-forget]').click();
 assert.equal(w.localStorage.getItem(LUMA_PREFERENCES_KEY),null);
 api.destroy();
});

test('Channel settings accept only WhatsApp Channel URLs and drafts reflect actual available products',()=>{
 const url='https://whatsapp.com/channel/0029VaZzExample01234567';
 assert.equal(whatsappChannelUrl(url+'?source=share'),url);
 assert.equal(whatsappChannelUrl('https://whatsapp.com.example.test/channel/0029VaZzExample01234567'),'');
 assert.throws(()=>normalizeSiteSettings({...DEFAULT_SITE_SETTINGS,whatsappChannelUrl:'https://wa.me/962790012345'}));
 assert.equal(normalizeSiteSettings({...DEFAULT_SITE_SETTINGS,whatsappChannelUrl:url}).whatsappChannelUrl,url);
 const now=Date.UTC(2026,10,24,12),ts=now/1000;
 const product={id:'TS5432',name:'New cleanser',active:1,approved:1,stock:9,price_fils:5000,created_at:'2026-11-23 16:00:00'};
 const offer={productId:product.id,active:true,startsAt:ts-10,endsAt:ts+50,priceFils:3500,slot:1};
 assert.match(channelDraft('recent',[product],[offer],now),/3\.50.*د\.أ/);
 assert.match(channelDraft('flash',[product],[offer],now),/https:\/\/trendjo\.pages\.dev\/product\/TS5432/);
 assert.equal(channelDraft('flash',[product],[offer],now+51000),'');
 assert.equal(channelDraft('recent',[{...product,stock:0}],[offer],now),'');
});

test('Lama automatically keeps explicit preferences and favorites across visits, without retaining chat text',async t=>{
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://trend.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>dom.window.close());
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.scrollTo=()=>{};w.TextDecoder=TextDecoder;w.AbortController=AbortController;
 let latest;
 w.fetch=async(url,{body})=>{
  latest=JSON.parse(body);
  return new Response('event: delta\ndata: {"text":"تمام يا قمر."}\n\nevent: products\ndata: '+JSON.stringify({
   routine:[{id:'TSDEMO1',name:'مرطب',priceFils:3000,href:'/product/TSDEMO1',image:'/images/de.webp'}],
   subtotalFils:3000,shippingFeeFils:1000,totalFils:4000
  })+'\n\nevent: done\ndata: {}\n\n');
 };
 w.eval(bundle);
 let api=await w.LumaWidget.mountLumaWidget({status:{available:true,imagesAvailable:false}});
 api.open();
 assert.deepEqual([...api.dialog.querySelectorAll('.luma-quick button')].map(button=>button.textContent),[
  'روتين يومي بسيط','بشرتي جافة ومشدودة','عندي حبوب وآثار','بدي مكياج يومي خفيف','شو أفضل واقي شمس؟'
 ]);
 async function send(text){
  api.dialog.querySelector('textarea').value=text;
  api.dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  for(let i=0;i<20&&api.dialog.getAttribute('aria-busy')==='true';i++)await new Promise(resolve=>setTimeout(resolve,3));
  assert.equal(api.dialog.getAttribute('aria-busy'),'false');
 }
 await send('عمري ٢٧ وبشرتي جافة وبدي روتين بسيط للجفاف');
 api.dialog.querySelector('[data-lama-favorite]').click();
 const stored=w.localStorage.getItem('lama_user_profile');
 assert.doesNotMatch(stored,/عمري|يا قمر/);
 assert.deepEqual(JSON.parse(stored).profile,{skinType:'dry',ageGroup:'25-34',goal:'dryness',preferredRoutine:'simple',concerns:['dryness'],likedProductIds:['TSDEMO1']});
 api.destroy();
 api=await w.LumaWidget.mountLumaWidget({status:{available:true,imagesAvailable:false}});
 api.open();
 await send('مع شو بدمجه؟');
 assert.equal(latest.history.length,0);
 assert.equal(latest.profile.skinType,'dry');
 assert.deepEqual(Array.from(latest.profile.likedProductIds),['TSDEMO1']);
 api.destroy();
});
