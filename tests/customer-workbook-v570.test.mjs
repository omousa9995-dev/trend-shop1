import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {buildCustomerReport} from '../public/customer-report.js';
import {fillCustomerWorkbook} from '../public/customer-workbook.js';
import {createCustomerReportManager} from '../public/customer-report-admin.js';

const template=JSON.parse(readFileSync(new URL('../public/customer-workbook-template.json',import.meta.url),'utf8'));
const row=(id='TEST',extra={})=>({id,name:'سارة النموذج',phone:'0791234567',email:'test@example.test',governorate:'عمّان',address:'عنوان <img src=x onerror=alert(1)>',status:'تم',subtotal_fils:7250,shipping_fee_fils:1000,discount_fils:0,created_at:'2026-11-07 21:30:00',items:[{name_snapshot:'تونر اختبار',product_id:'TEST',category:'البشرة',product_type:'toner',qty:2,unit_price_fils:4000}],...extra});
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.ok(fn(),'expected report UI state');};
function inspectXlsx(bytes){
 const script=`import io,json,sys,zipfile,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));assert z.testzip() is None
n={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
roots={p:E.fromstring(z.read(p)) for p in z.namelist()}
def value(sheet,cell):
 c=roots['xl/worksheets/sheet'+str(sheet)+'.xml'].find('.//x:c[@r="'+cell+'"]',n)
 return {'type':c.get('t'),'value':''.join(c.itertext()),'formula':c.find('x:f',n).text if c.find('x:f',n) is not None else None}
print(json.dumps({'names':[s.get('name') for s in roots['xl/workbook.xml'].findall('x:sheets/x:sheet',n)],'phone':value(2,'E7'),'name':value(2,'D7'),'date':value(2,'B7'),'value':value(2,'K7'),'count':value(1,'B7'),'table':roots['xl/tables/table1.xml'].get('ref'),'filter':roots['xl/tables/table1.xml'].find('x:autoFilter',n).get('ref'),'rtl':roots['xl/worksheets/sheet2.xml'].find('x:sheetViews/x:sheetView',n).get('rightToLeft'),'landscape':roots['xl/worksheets/sheet2.xml'].find('x:pageSetup',n).get('orientation'),'printAreas':len(roots['xl/workbook.xml'].findall('x:definedNames/x:definedName',n))}))`;
 const result=spawnSync('python3',['-c',script],{input:Buffer.from(bytes),encoding:'buffer'});assert.equal(result.status,0,result.stderr.toString());return JSON.parse(result.stdout.toString());
}
test('Real XLSX export preserves literal international phones, dates, money, formulas, filters and print setup',()=>{
 const report=buildCustomerReport([row('A',{name:'=HYPERLINK("https://bad.invalid")'}),row('B')],{asOf:'2026-11-07T12:00:00Z'}),data=inspectXlsx(fillCustomerWorkbook(report,template));
 assert.deepEqual(data.names,['ملخص','الطلبات','الزبائن','المنتجات','Meta']);assert.equal(data.phone.type,'inlineStr');assert.equal(data.phone.value,'+962791234567');assert.equal(data.name.type,'inlineStr');assert.equal(data.name.formula,null);assert.equal(data.date.type,null);assert.ok(Number(data.date.value)>46000);assert.equal(Number(data.value.value),8.25);assert.ok(data.count.formula.startsWith('COUNTIF('));assert.equal(data.table,'A6:Q8');assert.equal(data.filter,'A6:Q8');assert.equal(data.rtl,'1');assert.equal(data.landscape,'landscape');assert.equal(data.printAreas,10);
 const empty=inspectXlsx(fillCustomerWorkbook(buildCustomerReport([]),template));assert.equal(empty.table,'A6:Q7');assert.equal(empty.count.value.endsWith('0'),true);
});
test('Customer preview escapes source text; printing refreshes all rows and CSV stays completed-only',async t=>{
 const dom=new JSDOM('<section id="customersSection"></section><div id="printRoot"></div>',{pretendToBeVisual:true,url:'https://trend.test'}),previous=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=previous;dom.window.close();});
 let orders=[row('A')],requests=0,fail=false;const downloads=[],printed=[];
 const call=async path=>{requests++;assert.ok(path.startsWith('customer-report?'));if(fail)throw Error('تعذر الاتصال التجريبي');return {orders:structuredClone(orders),snapshot:orders.length,generatedAt:'2026-11-07T12:00:00Z',nextCursor:null};};
 const manager=createCustomerReportManager({call,download:(blob,name)=>downloads.push({blob,name}),print:()=>printed.push(document.querySelector('#printRoot').innerHTML),refreshMs:100000});t.after(()=>manager.destroy());manager.setActive(true);
 await until(()=>manager.report?.orders.length===1&&!document.querySelector('[data-customer-action=print]').disabled);
 assert.equal(document.querySelector('[data-customer-body] img'),null);assert.match(document.querySelector('[data-customer-body]').textContent,/<img/);
 orders.push(row('B',{phone:'0791234568',name:'ليان النموذج',email:'second@example.test'}));document.querySelector('[data-customer-search]').value='NO-MATCH';document.querySelector('[data-customer-search]').dispatchEvent(new dom.window.Event('input'));assert.match(document.querySelector('[data-customer-body]').textContent,/لا توجد نتائج/);
 document.querySelector('[data-customer-action=print]').click();await until(()=>printed.length===1);assert.equal(requests,2);assert.match(printed[0],/A/);assert.match(printed[0],/B/);assert.equal(new JSDOM(printed[0]).window.document.querySelector('img'),null);
 document.querySelector('[data-customer-action=csv]').click();await until(()=>downloads.length===1);assert.equal(downloads[0].name,'Trend-Shop-Meta-2026-11-07.csv');assert.match(await downloads[0].blob.text(),/962791234567/);
 fail=true;document.querySelector('[data-customer-action=csv]').click();await until(()=>document.querySelector('[data-customer-error]').textContent.includes('الاتصال'));assert.equal(downloads.length,1,'failed refresh must not export stale data');assert.equal(printed.length,1);
});
test('Leaving customer tab discards a late response and no customer data is stored in localStorage',async t=>{
 const dom=new JSDOM('<section id="customersSection"></section><div id="printRoot"></div>',{pretendToBeVisual:true,url:'https://trend.test'}),previous=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=previous;dom.window.close();});
 let resolve;const pending=new Promise(r=>resolve=r),manager=createCustomerReportManager({call:()=>pending,refreshMs:100000});t.after(()=>manager.destroy());manager.setActive(true);manager.setActive(false);resolve({orders:[row()],snapshot:1,nextCursor:null,generatedAt:new Date().toISOString()});await new Promise(r=>setTimeout(r,10));assert.equal(manager.report,null);assert.equal(dom.window.localStorage.length,0);assert.equal(document.querySelector('[data-customer-body]').textContent,'');
});
