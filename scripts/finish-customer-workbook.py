"""Apply print and RTL package metadata to an artifact-tool authored workbook.

Values, formulas, styles and customer identifiers are never rewritten here.
"""
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

filename, model_file = map(Path, sys.argv[1:])
model = json.loads(model_file.read_text())
def col(n):
    result = ''
    while n:
        n, r = divmod(n-1, 26)
        result = chr(65+r) + result
    return result

with ZipFile(filename) as archive:
    parts = {p:archive.read(p) for p in archive.namelist()}
defined = []
for i, definition in enumerate(model['sheets']):
    path = f'xl/worksheets/sheet{i+1}.xml'
    text = parts[path].decode()
    text = re.sub(r'<x:pageMargins[^>]*/>', '', text)
    text = text.replace('<x:sheetView ', f'<x:sheetView rightToLeft="{0 if i == 4 else 1}" ')
    text = text.replace('</x:sheetPr>', '<x:pageSetUpPr fitToPage="1" /></x:sheetPr>')
    setup = '<x:pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15" /><x:pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" />'
    text = text.replace('<x:tableParts', setup+'<x:tableParts') if '<x:tableParts' in text else text.replace('</x:worksheet>',setup+'</x:worksheet>')
    parts[path] = text.encode()
    end = len(definition['rows'])+6
    name = definition['name']
    defined.extend([f'<x:definedName name="_xlnm.Print_Area" localSheetId="{i}">\'{name}\'!$A$1:${col(definition["printLast"])}${end}</x:definedName>', f'<x:definedName name="_xlnm.Print_Titles" localSheetId="{i}">\'{name}\'!$6:$6</x:definedName>'])
    if i:
        table = f'xl/tables/table{i}.xml'
        text = parts[table].decode()
        if '<x:autoFilter' not in text:
            text=text.replace('<x:tableColumns',f'<x:autoFilter ref="A6:{col(len(definition["headers"]))}{end}" /><x:tableColumns')
        parts[table]=text.encode()
text=parts['xl/workbook.xml'].decode().replace('</x:workbook>','<x:definedNames>'+''.join(defined)+'</x:definedNames><x:calcPr calcMode="auto" fullCalcOnLoad="1" /></x:workbook>')
parts['xl/workbook.xml']=text.encode()
temporary=filename.with_suffix('.printing.xlsx')
with ZipFile(temporary,'w',ZIP_DEFLATED) as archive:
    for path,data in parts.items():
        archive.writestr(path,data)
temporary.replace(filename)
print('Print metadata applied; worksheet values preserved')
