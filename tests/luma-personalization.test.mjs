import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import {quizSkinProfile,LUMA_PREFERENCES_KEY,lumaBudgetFils} from '../public/luma-profile.js';
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
 assert.equal(lumaBudgetFils('١٢٫٥ دينار'),12500);
 assert.equal(lumaBudgetFils('110'),null);
});

test('Quiz and guided routine pass only chosen preferences and remember them with consent',async t=>{
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
 api.open({quiz:true});
 const choose=text=>{
  const match=[...api.dialog.querySelectorAll('.luma-quick button')].find(button=>button.textContent===text);
  assert.ok(match,'Missing choice '+text);
  match.click();
 };
 choose('بتشدّ أو بتحسّسني بالجفاف');
 choose('على الأنف والجبهة والذقن');
 choose('غالبًا');
 assert.match(api.dialog.querySelector('.luma-quiz-result').textContent,/مختلطة/);
 assert.equal(w.localStorage.getItem(LUMA_PREFERENCES_KEY),null);
 const remember=api.dialog.querySelector('[data-luma-remember]');
 remember.checked=true;remember.dispatchEvent(new w.Event('change'));
 choose('رتّبي لي روتين صباحي ومسائي');
 choose('اللمعان');
 choose('25–34');
 choose('12 د.أ');
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(sent.guided,true);
 assert.equal(sent.intent,'routine');
 assert.equal(sent.budgetFils,12000);
 assert.equal(sent.profile.skinType,'combination');
 assert.equal(sent.profile.ageGroup,'25-34');
 assert.equal(sent.profile.goal,'shine');
 assert.deepEqual(JSON.parse(w.localStorage.getItem(LUMA_PREFERENCES_KEY)),{
  version:1,profile:{skinType:'combination',sensitive:'yes',ageGroup:'25-34',goal:'shine'},budgetFils:12000
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
