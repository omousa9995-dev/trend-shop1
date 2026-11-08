import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createInvoicePrinter,waitForInvoiceAssets} from '../public/invoice-print.js';

const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(t,{print=()=>{}}={}){
 const dom=new JSDOM('<title>Admin test</title><main id="dashboard"><button id="trigger">Invoices</button></main><div id="printRoot"></div>',{url:'https://trend.test/admin.html',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;w.scrollTo=()=>{};w.print=print;
 const printer=createInvoicePrinter({root:d.querySelector('#printRoot'),view:w,render:order=>`<article class="invoice"><b>${order.id}</b>${order.image?'<img src="/synthetic-test-image.svg"/>':''}</article>`});
 d.querySelector('#trigger').focus();return {w,d,printer};
}

test('Invoice preview remains visible when print is ignored; only an explicit ready button calls print',async t=>{
 let prints=0;const {d,printer}=fixture(t,{print:()=>prints++});assert.equal(printer.show([{id:'LOCAL-A'},{id:'LOCAL-B'}]),true);
 assert.equal(prints,0);assert.equal(printer.open,true);assert.equal(d.body.classList.contains('invoice-preview-open'),true);assert.equal(d.querySelectorAll('#printRoot .invoice').length,2);assert.equal(d.activeElement.id,'invoicePrintTitle');
 await pause();assert.equal(d.querySelector('#printInvoicesNow').disabled,false);d.querySelector('#printInvoicesNow').click();assert.equal(prints,1);assert.equal(printer.open,true);assert.match(d.querySelector('#invoicePrintStatus').textContent,/إذا لم تظهر/);assert.equal(d.querySelectorAll('#printRoot .invoice').length,2);
 d.querySelector('#closeInvoicePrint').click();assert.equal(printer.open,false);assert.equal(d.title,'Admin test');assert.equal(d.activeElement.id,'trigger');assert.equal(d.querySelectorAll('#printRoot .invoice').length,2,'iOS can finish capturing after print() returns');
});

test('Image preparation blocks premature printing and both successful and failed images settle readiness',async t=>{
 let prints=0;const {w,d,printer}=fixture(t,{print:()=>prints++});printer.show([{id:'LOCAL-A',image:true}]);const button=d.querySelector('#printInvoicesNow');button.click();assert.equal(prints,0);assert.equal(button.disabled,true);
 d.querySelector('#printRoot img').dispatchEvent(new w.Event('load'));await pause();assert.equal(button.disabled,false);button.click();assert.equal(prints,1);
 printer.show([{id:'LOCAL-B',image:true}]);d.querySelector('#printRoot img').dispatchEvent(new w.Event('error'));await pause();assert.equal(button.disabled,false);
});

test('Unavailable or throwing print implementations have visible Safari instructions without losing the invoice',async t=>{
 for(const print of [undefined,()=>{throw Error('blocked')}]){
  const {w,d,printer}=fixture(t);w.print=print;printer.show([{id:'LOCAL-A'}]);await pause();d.querySelector('#printInvoicesNow').click();
  assert.equal(printer.open,true);assert.match(d.querySelector('#invoicePrintStatus').textContent,/Safari/);assert.equal(d.querySelector('#invoicePrintToolbar details').open,true);assert.equal(d.querySelectorAll('#printRoot .invoice').length,1);
 }
});

test('Late readiness from a closed preview cannot enable printing or reopen it',async t=>{
 const {w,d,printer}=fixture(t);printer.show([{id:'LOCAL-A',image:true}]);const oldImage=d.querySelector('#printRoot img');printer.close();oldImage.dispatchEvent(new w.Event('load'));await pause();assert.equal(printer.open,false);assert.equal(d.body.classList.contains('invoice-preview-open'),false);
 printer.show([{id:'LOCAL-B'}]);await pause();assert.equal(printer.open,true);assert.equal(d.querySelector('#printInvoicesNow').disabled,false);assert.match(d.querySelector('#printRoot').textContent,/LOCAL-B/);assert.doesNotMatch(d.querySelector('#printRoot').textContent,/LOCAL-A/);
});

test('A missing image or font cannot block invoice readiness indefinitely',async t=>{
 const {w,d}=fixture(t);const root=d.querySelector('#printRoot');root.innerHTML='<img src="/never-finishes.svg"/>';
 Object.defineProperty(d,'fonts',{value:{ready:new Promise(()=>{})}});
 await waitForInvoiceAssets(root,{view:w,timeoutMs:5});assert.ok(root.querySelector('img'));
});

test('An empty invoice selection never replaces an existing preview or starts printing',async t=>{
 let prints=0;const {d,printer}=fixture(t,{print:()=>prints++});assert.equal(printer.show([]),false);assert.equal(printer.open,false);assert.equal(prints,0);assert.equal(d.querySelector('#printRoot').innerHTML,'');
});
