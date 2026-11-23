import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {LUMA_PREFERENCES_KEY} from '../public/luma-profile.js';
import {quizSkinProfile,installSkinQuiz} from '../public/skin-quiz.js';
import {whatsappChannelUrl,normalizeSiteSettings,DEFAULT_SITE_SETTINGS} from '../public/site-settings.js';
import {channelDraft} from '../public/whatsapp-channel.js';

const bundle=buildSync({
 entryPoints:[new URL('../public/luma-widget.js',import.meta.url).pathname],bundle:true,
 format:'iife',globalName:'LumaWidget',write:false,logLevel:'silent'
}).outputFiles[0].text;

test('Quiz uses oil distribution and tightness; sensitivity is independent',()=>{
 assert.equal(quizSkinProfile({afterWash:'tight',midday:'none'}).skinType,'dry');
 assert.equal(quizSkinProfile({afterWash:'shine',midday:'all'}).skinType,'oily');
 assert.equal(quizSkinProfile({afterWash:'tight',midday:'all'}).skinType,'unknown');
 assert.deepEqual(quizSkinProfile({afterWash:'tight',midday:'tzone',sensitive:'yes'}),{skinType:'combination',sensitive:'yes',area:'face'});
});

test('The avatar card opens its own three-question quiz and gives a result outside Luma',t=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://trend.test/'}),d=dom.window.document;
 t.after(()=>dom.window.close());
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))};
 const update=installSkinQuiz(d);
 update(true,'ar');
 const card=d.querySelector('[data-skin-quiz-entry]');
 assert.equal(card.hidden,false);
 assert.ok(card.querySelector('img'));
 assert.equal(card.closest('[data-care-region]'),null);
 card.querySelector('button').click();
 for(const label of ['مشدودة أو جافة','على الأنف والجبهة والذقن','غالبًا']){
  const answer=[...d.querySelectorAll('.skin-quiz-answers button')].find(button=>button.textContent===label);
  assert.ok(answer);
  answer.click();
 }
 assert.match(d.querySelector('.skin-quiz-dialog').textContent,/مختلطة/);
 assert.equal(d.querySelector('#lumaChat'),null);
 update(false,'ar');
 assert.equal(d.querySelector('.skin-quiz-dialog'),null);
 assert.equal(card.hidden,true);
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
 const remember=api.dialog.querySelector('[data-luma-remember]');
 remember.checked=true;remember.dispatchEvent(new w.Event('change'));
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
  version:1,profile:{skinType:'combination',ageGroup:'25-34',goal:'shine'},budgetFils:null
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
