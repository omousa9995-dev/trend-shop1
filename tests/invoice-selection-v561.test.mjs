import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';
import {DEFAULT_SITE_SETTINGS} from '../public/site-settings.js';
const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const bundle=buildSync({entryPoints:[new URL('../public/admin.js',import.meta.url).pathname],bundle:true,format:'iife',write:false,target:'es2022',logLevel:'silent'}).outputFiles[0].text;
const orders=['A','B','C'].map((letter,i)=>({id:'TR-SELECT-'+letter,created_at:'2026-11-07 09:00:00',name:'بيانات اختبار '+letter,phone:'0790000000',governorate:'عمّان',address:'عنوان تجريبي',notes:'ملاحظة اختبار',status:['جديد','قيد التجهيز','تم'][i],payment_method:'cod',subtotal_fils:5000+i*1000,shipping_fee_fils:1000,items:[{name_snapshot:'منتج اختبار '+letter,image_snapshot:'/images/TS0001.svg',qty:1,unit_price_fils:5000+i*1000}]}));
const defaults=filter=>filter==='today'?[orders[1]]:filter==='new'?[orders[0]]:orders;
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.ok(fn(),'expected invoice UI state');}
async function open(t,fetchOrders=defaults){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://trend.test/admin.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,requests=[],printed=[],alerts=[];w.structuredClone=structuredClone;w.scrollTo=()=>{};Object.defineProperty(w.HTMLImageElement.prototype,'complete',{get:()=>true});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};w.alert=msg=>alerts.push(msg);w.print=()=>printed.push(d.querySelector('#printRoot').innerHTML);
 w.fetch=async(url,options={})=>{requests.push({url:String(url),method:options.method||'GET'});assert.equal(options.method||'GET','GET','selection and printing must never mutate orders');let data={};const u=new URL(url,'https://trend.test');
  if(u.pathname.endsWith('/me'))data={authenticated:true,live:true};
  else if(u.pathname.endsWith('/orders'))data={orders:await fetchOrders(u.searchParams.get('filter'))};
  else if(u.pathname.endsWith('/products'))data={products:[]};
  else if(u.pathname.endsWith('/promotions'))data={promotions:[]};
  else if(u.pathname.endsWith('/site-settings'))data={settings:DEFAULT_SITE_SETTINGS,history:[]};
  return {ok:true,json:async()=>structuredClone(data)};
 };
 w.eval(bundle);await until(()=>d.querySelectorAll('[data-select-invoice]').length===3&&!d.querySelector('#selectAllInvoices').disabled);d.querySelector('#ordersTab').click();assert.deepEqual(errors,[]);return {d,w,requests,printed,alerts,errors};
}
async function runPrint(d){await until(()=>!d.querySelector('#printInvoicesNow').disabled);d.querySelector('#printInvoicesNow').click()}
const closePrint=d=>d.querySelector('#closeInvoicePrint').click();
const pick=(d,letter)=>d.querySelector(`[data-select-invoice="TR-SELECT-${letter}"]`);
const printedIds=markup=>{const doc=new JSDOM(markup);try{return [...doc.window.document.querySelectorAll('.invoice-header [dir=ltr]')].map(el=>el.textContent)}finally{doc.window.close()}};

test('Selected invoices print together once in displayed order and individual printing remains independent',async t=>{
 const {d,printed,requests}=await open(t);assert.equal(d.querySelector('#printSelectedInvoices').disabled,true);d.querySelector('#printSelectedInvoices').click();assert.equal(printed.length,0);
 pick(d,'C').click();pick(d,'A').click();assert.equal(d.querySelector('#selectAllInvoices').indeterminate,true);assert.match(d.querySelector('#invoiceSelectionCount').textContent,/2 من 3/);
 d.querySelector('#printSelectedInvoices').click();assert.equal(printed.length,0);await runPrint(d);assert.equal(printed.length,1);assert.deepEqual(printedIds(printed[0]),['TR-SELECT-A','TR-SELECT-C']);assert.equal(pick(d,'A').checked,true,'printing or cancelling the print dialog keeps the selection');
 closePrint(d);d.querySelector('[data-print-order="TR-SELECT-B"]').click();await runPrint(d);assert.equal(printed.length,2);assert.deepEqual(printedIds(printed[1]),['TR-SELECT-B']);assert.ok(requests.every(r=>r.method==='GET'));
});

test('Select all, partial selection and clearing stay synchronized without duplicate invoices',async t=>{
 const {d,printed}=await open(t),all=d.querySelector('#selectAllInvoices');all.click();assert.equal(all.checked,true);assert.equal(all.indeterminate,false);assert.equal([...d.querySelectorAll('[data-select-invoice]')].every(input=>input.checked),true);
 pick(d,'B').click();assert.equal(all.checked,false);assert.equal(all.indeterminate,true);all.click();assert.equal(all.checked,true);d.querySelector('#printSelectedInvoices').click();await runPrint(d);assert.deepEqual(printedIds(printed[0]),orders.map(o=>o.id));closePrint(d);
 d.querySelector('#clearInvoiceSelection').click();assert.equal(all.checked,false);assert.equal(all.indeterminate,false);assert.equal(d.querySelector('#printSelectedInvoices').disabled,true);assert.equal([...d.querySelectorAll('[data-select-invoice]')].some(input=>input.checked),false);
});

test('Today printing keeps its original query while refreshing preserves selection and filters clear it',async t=>{
 let current=structuredClone(orders);const {d,printed,requests}=await open(t,filter=>filter==='all'?current:defaults(filter));pick(d,'A').click();
 d.querySelector('#printToday').click();await until(()=>!d.querySelector('#invoicePrintToolbar').hidden);assert.equal(printed.length,0);await runPrint(d);closePrint(d);assert.deepEqual(printedIds(printed[0]),['TR-SELECT-B']);assert.ok(requests.some(r=>r.url.endsWith('orders?filter=today')));assert.equal(pick(d,'A').checked,true);
 current[0].notes='ملاحظة محدّثة للاختبار';d.querySelector('#refreshOrders').click();await until(()=>!d.querySelector('#selectAllInvoices').disabled&&d.querySelector('#ordersList').textContent.includes('ملاحظة محدّثة للاختبار'));
 assert.equal(pick(d,'A').checked,true);d.querySelector('#printSelectedInvoices').click();await runPrint(d);closePrint(d);assert.match(printed[1],/ملاحظة محدّثة للاختبار/);
 d.querySelector('[data-filter=new]').click();await until(()=>d.querySelectorAll('[data-select-invoice]').length===1&&!d.querySelector('#selectAllInvoices').disabled);assert.equal(pick(d,'A').checked,false);assert.equal(d.querySelector('#printSelectedInvoices').disabled,true);
});

test('Late filter responses and failed refreshes cannot print old or hidden selections',async t=>{
 let release,fail=false;const pending=new Promise(r=>release=r);const {d,printed,errors}=await open(t,filter=>{if(fail)throw Error('انقطاع تجريبي');return filter==='today'?pending:defaults(filter)});
 pick(d,'C').click();d.querySelector('[data-filter=today]').click();assert.equal(d.querySelector('#printSelectedInvoices').disabled,true);d.querySelector('[data-filter=new]').click();await until(()=>d.querySelectorAll('[data-select-invoice]').length===1&&!d.querySelector('#selectAllInvoices').disabled);pick(d,'A').click();
 release([orders[1]]);await new Promise(r=>setTimeout(r,10));assert.equal(pick(d,'A').checked,true);assert.equal(pick(d,'B'),null);d.querySelector('#printSelectedInvoices').click();await runPrint(d);closePrint(d);assert.deepEqual(printedIds(printed[0]),['TR-SELECT-A']);
 fail=true;d.querySelector('#refreshOrders').click();await until(()=>d.querySelector('#ordersList').textContent==='انقطاع تجريبي');assert.equal(d.querySelector('#printSelectedInvoices').disabled,true);assert.equal(d.querySelector('#selectAllInvoices').disabled,true);assert.match(d.querySelector('#invoiceSelectionCount').textContent,/0 من 0/);assert.deepEqual(errors,[]);
});

test('Today-load failures display a recoverable error, restore the button and never start printing',async t=>{
 const {d,printed,errors}=await open(t,filter=>{if(filter==='today')throw Error('offline fixture');return defaults(filter)});pick(d,'A').click();d.querySelector('#printToday').click();await until(()=>!d.querySelector('#printToday').disabled);assert.match(d.querySelector('#orderStatusMessage').textContent,/تعذّر تحميل/);assert.equal(d.querySelector('#invoicePrintToolbar').hidden,true);assert.equal(printed.length,0);assert.equal(pick(d,'A').checked,true);assert.deepEqual(errors,[]);
});
test('Today preparation deduplicates rapid clicks and prints only after a new explicit preview click',async t=>{
 let finish,requests=0;const gate=new Promise(resolve=>finish=resolve);const {d,printed}=await open(t,filter=>{if(filter==='today'){requests++;return gate}return defaults(filter)});
 d.querySelector('#printToday').click();d.querySelector('#printToday').click();assert.equal(requests,1);assert.equal(d.querySelector('#printToday').disabled,true);finish([orders[1]]);await until(()=>!d.querySelector('#invoicePrintToolbar').hidden);assert.equal(printed.length,0);await runPrint(d);assert.equal(printed.length,1);assert.deepEqual(printedIds(printed[0]),['TR-SELECT-B']);
});
