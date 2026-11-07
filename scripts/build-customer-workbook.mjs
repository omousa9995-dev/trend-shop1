// Canonical artifact-tool authoring path. Run a copied script from a scoped temp
// folder linked to CODEX_PRIMARY_RUNTIME_NODE_MODULES; never install runtime deps.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const [repo,input,output,mode='report']=process.argv.slice(2);
if(!repo||!input||!output)throw Error('Usage: builder repo source.json output.xlsx [report|template]');
const {buildCustomerReport}=await import(pathToFileURL(path.join(repo,'public/customer-report.js')));
const {customerWorkbookModel,columnName}=await import(pathToFileURL(path.join(repo,'public/customer-workbook-model.js')));
const source=JSON.parse(await fs.readFile(input,'utf8'));
const raw=source.orders.map(o=>({...o,items:o.items||source.items?.filter(i=>i.order_id===o.id)||[]}));
const report=buildCustomerReport(raw,{asOf:source.asOf,filters:source.filters});
const model=customerWorkbookModel(report),wb=Workbook.create();
for(const def of model.sheets)wb.worksheets.add(def.name);
for(const [si,def] of model.sheets.entries()){
 const sh=wb.worksheets.getItem(def.name),last=columnName(def.headers.length-1),end=def.rows.length+6,range=sh.getRange(`A1:${last}${end}`);
 sh.showGridLines=false;sh.tabColor=si===0?'#704F60':'#8C9B88';range.format={font:{name:'Arial',size:11,color:'#382F33'},rowHeight:36,verticalAlignment:'center',wrapText:true};
 for(let i=0;i<def.widths.length;i++)sh.getRange(`${columnName(i)}1:${columnName(i)}${end}`).format.columnWidth=def.widths[i];
 for(let r=1;r<=4;r++)sh.getRange(`A${r}:${last}${r}`).merge();
 sh.getRange('A1').values=[[def.title]];sh.getRange(`A1:${last}1`).format={fill:'#503843',font:{name:'Arial',size:18,bold:true,color:'#FFFFFF'},rowHeight:43};
 sh.getRange('A2').values=[[model.sourceText]];sh.getRange('A3').values=[[model.filterText]];sh.getRange('A4').values=[[def.note]];sh.getRange(`A2:${last}4`).format={fill:'#F5F0EB',font:{name:'Arial',size:10,color:'#62545A'},rowHeight:32};
 sh.getRange(`A6:${last}6`).values=[def.headers];sh.getRange(`A6:${last}6`).format={fill:'#704F60',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:38};
 const matrix=def.rows.map(row=>row.map(c=>typeof c.v==='string'&&c.v.startsWith('=')?"'"+c.v:c.v));
 // Text formatting must precede the value write to preserve international phone
 // strings. Formatting a numeric-coerced value afterwards cannot recover its +.
 sh.getRange(`A7:${last}${end}`).setNumberFormat('@');
 sh.getRange(`A7:${last}${end}`).values=matrix;
 for(let ri=0;ri<def.rows.length;ri++){
  const row=def.rows[ri],r=ri+7;sh.getRange(`A${r}:${last}${r}`).format.fill=ri%2?'#F6F3F0':'#FFFFFF';
  if(!def.table&&ri>14)sh.getRange(`A${r}:${last}${r}`).format.rowHeight=52;
  for(let ci=0;ci<row.length;ci++){
   const cell=sh.getRange(`${columnName(ci)}${r}`),c=row[ci];cell.setNumberFormat({text:'@',number:'0',money:'0.000',date:'yyyy-mm-dd hh:mm'}[c.style]);
   if(c.f)cell.formulas=[['='+c.f]];
   if(c.style==='money')cell.format.font.color='#375D49';
  }
 }
 if(def.table){const table=sh.tables.add(`A6:${last}${end}`,true,`TrendCustomers${si}`);table.style='TableStyleLight1';}
 sh.freezePanes.freezeRows(6);
}
wb.recalculate();
await fs.mkdir(path.dirname(output),{recursive:true});await (await SpreadsheetFile.exportXlsx(wb)).save(output);
// No PII in stdout: inspect numerical calculations only; visual QA stays private.
const stats=await wb.inspect({kind:'region',sheetId:'ملخص',range:'B7:B20',maxChars:1600,tableMaxRows:14,tableMaxCols:1});
await fs.writeFile(output+'.inspect.json',JSON.stringify(stats));
if(mode==='report')for(const def of model.sheets){const png=await wb.render({sheetName:def.name,range:`A1:${columnName(def.headers.length-1)}12`,scale:1,format:'png'});await fs.writeFile(output+'.'+def.name+'.png',new Uint8Array(await png.arrayBuffer()));}
console.log(JSON.stringify({output,sheets:model.sheets.map(d=>({name:d.name,rows:d.rows.length})),orders:report.orders.length,contacts:report.contacts.length}));
