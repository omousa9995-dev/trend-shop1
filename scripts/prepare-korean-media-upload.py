import argparse,base64,hashlib,json,pathlib,re
parser=argparse.ArgumentParser();parser.add_argument('limit',type=int);parser.add_argument('--paths',action='store_true');parser.add_argument('--min-id',type=int,default=0);parser.add_argument('--max-id',type=int,default=10000);args=parser.parse_args()
root=pathlib.Path('.');state={}
for p in (root/'deployment-private').glob('korean-upload-state*.json'):state.update(json.loads(p.read_text()))
paths=set()
for manifest in sorted((root/'data/korean-expansion').glob('generated-assets*.json')):
 for asset in json.loads(manifest.read_text()):
  for field in ['image','thumbnail']:
   path=asset.get(field,'');m=re.fullmatch(r'/images/catalog/marketing/TS([0-9]{4})-kcare-(scene|thumb)-[a-f0-9]{12}\.webp',path)
   if m and args.min_id<=int(m[1])<args.max_id:paths.add('public'+path)
next_paths=[p for p in sorted(paths) if not(state.get(p,{}).get('gitSha') and state.get(p,{}).get('kv'))][:args.limit]
if args.paths:print(json.dumps(next_paths));raise SystemExit()
result=[]
for path in next_paths:
 data=(root/path).read_bytes();sha=hashlib.sha256(data).hexdigest()
 if sha[:12] not in path:raise RuntimeError('Hash mismatch '+path)
 result.append({'path':path,'key':path.replace('public/images/','',1),'bytes':len(data),'sha256':sha,'content':base64.b64encode(data).decode(),'previous':state.get(path,{})})
print(json.dumps(result,separators=(',',':')))
