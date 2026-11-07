"""Extract a public, data-free OpenXML template authored with artifact-tool.

Only XML/package metadata is processed here. This does not author spreadsheet
values or formulas. Input must be the synthetic template, never a customer file.
"""
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

source, model_path, destination = sys.argv[1:]
model = json.loads(Path(model_path).read_text())
ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
parts, sheets, styles = {}, [], [{}, {}]
with ZipFile(source) as archive:
    for name in archive.namelist():
        if name == 'xl/sharedStrings.xml':
            continue
        text = archive.read(name).decode('utf-8')
        if name in ('[Content_Types].xml', 'xl/_rels/workbook.xml.rels'):
            text = re.sub(r'<[^<>]*(?:sharedStrings)[^<>]*/>', '', text)
        parts[name] = text
    for index, definition in enumerate(model['sheets']):
        name = f'xl/worksheets/sheet{index+1}.xml'
        xml = parts[name]
        root = ET.fromstring(xml)
        cells = {c.attrib['r']: c.attrib.get('s', '0') for c in root.findall('.//x:sheetData/x:row/x:c', ns)}
        for ri, row in enumerate(definition['rows']):
            for ci, cell in enumerate(row):
                col = chr(65+ci)
                style = cells.get(f'{col}{ri+7}')
                if style:
                    styles[ri % 2].setdefault(cell['style'], style)
        title, metadata, header = cells['A1'], cells['A2'], cells['A6']
        xml = re.sub(r'<x:sheetData>.*?</x:sheetData>', '__TREND_SHEET_DATA__', xml)
        xml = xml.replace('<x:sheetView ', f'<x:sheetView rightToLeft="{0 if index == 4 else 1}" ')
        xml = xml.replace('</x:sheetPr>', '<x:pageSetUpPr fitToPage="1" /></x:sheetPr>')
        # Repeat the table header on each printed page. No customer values remain.
        xml = xml.replace('<x:tableParts', '<x:pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15" /><x:pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" /><x:tableParts') if '<x:tableParts' in xml else xml.replace('</x:worksheet>', '<x:pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.15" /><x:pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" /></x:worksheet>')
        parts[name] = xml
        sheets.append({'path': name, 'title': title, 'metadata': metadata, 'header': header, 'tablePath': f'xl/tables/table{index}.xml' if index else None})
    for parity in styles:
        assert all(k in parity for k in ('text', 'number', 'money', 'date')), parity
    assert not any('<x:sheetData>' in parts[s['path']] for s in sheets)
Path(destination).write_text(json.dumps({'version':1, 'authoring':'artifact-tool', 'parts':parts, 'sheets':sheets, 'styles':styles}, ensure_ascii=False, separators=(',', ':')))
print(json.dumps({'templateBytes':Path(destination).stat().st_size,'sheets':len(sheets),'dataFree':True}))
