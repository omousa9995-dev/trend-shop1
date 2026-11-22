import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
import {careEntriesAllowed} from '../public/luma-placement.js';
test('Luma stays hidden on canonical and legacy product, bundle and checkout routes',()=>{
 for(const pathname of ['/product/TS0065','/p/TS0065','/bundle/trio','/checkout','/order/1','/success'])assert.equal(careEntriesAllowed({pathname,hash:''}),false,pathname);
 for(const hash of ['#/product/TS0065','#/checkout','#/success'])assert.equal(careEntriesAllowed({pathname:'/',hash}),false,hash);
 for(const pathname of ['/','/collections/toner'])assert.equal(careEntriesAllowed({pathname,hash:''}),true,pathname);
});
test('Luma entries follow SPA page changes without opening the conversation or waiting for a hash event',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><a data-care-region="header" data-care-entry><span data-luma-entry-title></span></a><section data-care-region="footer"><h2 data-luma-entry-title></h2><p data-luma-entry-note></p><a data-care-entry data-luma-entry-cta></a></section></body></html>',{url:'https://trend.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const code=buildSync({entryPoints:[new URL('../public/luma-placement.js',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'Placement',logLevel:'silent'}).outputFiles[0].text;
 try{w.eval(code);let opened=0;const api=w.Placement.installCareEntries({status:{available:true},loadWidget:()=>{opened++;throw Error('No customer action')}});const regions=[...w.document.querySelectorAll('[data-care-region]')];assert.ok(regions.every(e=>!e.hidden));
 w.history.pushState(null,'','/product/TS0065');w.document.body.dataset.pageKind='product';await new Promise(r=>w.queueMicrotask(r));assert.ok(regions.every(e=>e.hidden));
 w.history.pushState(null,'','/');w.document.body.dataset.pageKind='home';await new Promise(r=>w.queueMicrotask(r));assert.ok(regions.every(e=>!e.hidden));assert.equal(opened,0);api.destroy();
 }finally{w.close()}
});
