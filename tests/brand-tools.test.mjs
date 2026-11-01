import test from 'node:test';import assert from 'node:assert/strict';
import {brandKey,brandName,availableBrands,matchesBrand,brandHref} from '../public/brand-tools.js';
test('Brand grouping is case and punctuation tolerant and brand URLs safely encode the label',()=>{
 assert.equal(brandKey('ANUA'),brandKey('Anua'));assert.equal(brandKey('L’Oréal Paris'),brandKey("L'Oreal Paris"));assert.equal(brandName('cosrex'),'COSRX');assert.equal(matchesBrand({brand:'KIKO'},'KIKO Milano'),true);assert.deepEqual(availableBrands([{brand:'ANUA'},{brand:'Anua'},{brand:'COSRX'}]),['Anua','COSRX']);const malicious='\"><img src=x onerror=alert(1)>';assert.equal(brandHref(malicious),'#/shop?brand='+encodeURIComponent(malicious));
});
