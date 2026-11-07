import assert from 'node:assert/strict';
export function assertCatalogResults(document,expected){
 const count=typeof expected==='number'?expected:parseInt(expected,10);
 assert.doesNotMatch(document.querySelector('#resultCount').textContent,/[0-9٠-٩]/,'catalog totals are private to admin');
 assert.equal(document.querySelectorAll('#productResults > .products-grid .product-card').length,Math.min(count,24),'the same matching products are still listed');
}
