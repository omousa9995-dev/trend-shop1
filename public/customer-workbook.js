// Fill an artifact-tool authored, data-free template. No third-party workbook
// writer or remote service is needed; customer records stay in the admin session.
import {customerWorkbookModel,columnName} from './customer-workbook-model.js?v=5.7.1';
const encode=value=>new TextEncoder().encode(value);
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
export function zipXmlParts(parts){
 const chunks=[],central=[];let offset=0;
 for(const [path,content] of Object.entries(parts)){
  const name=encode(path),data=encode(content),crc=crc32(data),head=new Uint8Array(30+name.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);head.set(name,30);
  const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);chunks.push(head,data);central.push(dir);offset+=head.length+data.length;
 }
 const size=central.reduce((n,c)=>n+c.length,0),tail=new Uint8Array(22),v=new DataView(tail.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const result=new Uint8Array(offset+size+22);let at=0;for(const c of [...chunks,...central,tail]){result.set(c,at);at+=c.length;}return result;
}
function makeCell(address,cell,style){
 const s=` r="${address}" s="${style}"`;
 if(cell.f){const value=typeof cell.v==='number'&&Number.isFinite(cell.v)?cell.v:0;return `<x:c${s}><x:f>${xml(cell.f)}</x:f><x:v>${value}</x:v></x:c>`;}
 if(cell.v===''||cell.v==null)return `<x:c${s} />`;
 if(typeof cell.v==='number'&&Number.isFinite(cell.v))return `<x:c${s}><x:v>${cell.v}</x:v></x:c>`;
 return `<x:c${s} t="inlineStr"><x:is><x:t xml:space="preserve">${xml(cell.v)}</x:t></x:is></x:c>`;
}
export function fillCustomerWorkbook(report,template){
 if(template.version!==1||template.sheets.length!==5)throw Error('قالب Excel غير متوافق؛ حدّث صفحة الإدارة');
 const model=customerWorkbookModel(report),parts={...template.parts},defined=[];
 for(const [si,def] of model.sheets.entries()){
  const layout=template.sheets[si],last=columnName(def.headers.length-1),end=def.rows.length+6;
  const row=(r,cells,style,height)=>`<x:row r="${r}" ht="${height}" customHeight="1">${cells.map((c,i)=>makeCell(columnName(i)+r,c,typeof style==='function'?style(c):style)).join('')}</x:row>`;
  const cells=[row(1,[{v:def.title}],layout.title,43),row(2,[{v:model.sourceText}],layout.metadata,32),row(3,[{v:model.filterText}],layout.metadata,32),row(4,[{v:def.note}],layout.metadata,36),row(6,def.headers.map(v=>({v})),layout.header,38)];
  def.rows.forEach((data,i)=>cells.push(row(i+7,data,c=>template.styles[i%2][c.style],!def.table&&i>14?52:48)));
  let sheet=parts[layout.path].replace('__TREND_SHEET_DATA__',`<x:sheetData>${cells.join('')}</x:sheetData>`);
  if(/<x:dimension\b/.test(sheet))sheet=sheet.replace(/<x:dimension[^>]*\/>/,`<x:dimension ref="A1:${last}${end}" />`);
  parts[layout.path]=sheet;
  if(layout.tablePath){let table=parts[layout.tablePath].replace(/ref="[^"]*"/g,`ref="A6:${last}${end}"`);if(!table.includes('<x:autoFilter'))table=table.replace('<x:tableColumns',`<x:autoFilter ref="A6:${last}${end}" /><x:tableColumns`);parts[layout.tablePath]=table;}
  const name=xml(def.name.replace(/'/g,"''"));defined.push(`<x:definedName name="_xlnm.Print_Area" localSheetId="${si}">'${name}'!$A$1:$${columnName(def.printLast-1)}$${end}</x:definedName>`,`<x:definedName name="_xlnm.Print_Titles" localSheetId="${si}">'${name}'!$6:$6</x:definedName>`);
 }
 parts['xl/workbook.xml']=parts['xl/workbook.xml'].replace('</x:workbook>',`<x:definedNames>${defined.join('')}</x:definedNames><x:calcPr calcMode="auto" fullCalcOnLoad="1" /></x:workbook>`);
 return zipXmlParts(parts);
}
export async function downloadCustomerWorkbook(report,{fetchImpl=fetch,download}={}){
 const response=await fetchImpl('/customer-workbook-template.json?v=5.7.1',{credentials:'same-origin',cache:'no-cache'});if(!response.ok)throw Error('تعذر تحميل قالب Excel؛ حاول مجددًا');
 const bytes=fillCustomerWorkbook(report,await response.json());
 const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const name=`Trend-Shop-Customers-${new Date(report.asOf).toISOString().slice(0,10)}.xlsx`;
 if(download)return download(blob,name);return saveCustomerFile(blob,name);
}
export function saveCustomerFile(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
