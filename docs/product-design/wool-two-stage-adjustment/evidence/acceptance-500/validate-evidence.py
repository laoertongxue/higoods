import json,hashlib,re
from pathlib import Path
root=Path.cwd();b=root/'docs/product-design/wool-two-stage-adjustment/evidence/acceptance-500'
manifest=json.loads((b/'final-source-manifest.json').read_text());sha=hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest();assert sha==manifest['buildSha256']
for f,h in manifest['files'].items():assert hashlib.sha256((root/f).read_bytes()).hexdigest()==h,f
out={'buildSha256':sha,'sourceFiles':len(manifest['files']),'reports':[]}
def load(p):
 d=json.loads(p.read_text());assert d['pass'] and not d['errors'],p.name;assert d.get('buildIndexSha256',d.get('buildSha256'))==sha,p.name;return d
def valid(s,exception=False):
 assert s['pass'] and not s.get('error') and not s.get('visibleImageFailures'),s
 assert s['ms']<=1000 if exception else s['ms']<500,s
r=load(b/'route-performance.json');assert len(r['routes'])==37
vals=[];normal=[];exc=[]
for route in r['routes']:
 for mode in ['cold','refresh','routeSwitch']:
  assert len(route[mode])==5
  for s in route[mode]:
   e=route['name']=='PDA任务队列' and mode=='cold';valid(s,e);vals.append(s['ms']);(exc if e else normal).append(s['ms'])
out['reports'].append({'name':'routes','samples':len(vals),'normalMaxMs':max(normal),'exceptionMaxMs':max(exc)})
for name,count in [('action-performance',71),('extra-action-performance',18),('remaining-action-performance',375),('remaining-action-performance-1024',158)]:
 d=load(b/(name+'.json'));assert len(d['actions'])==count,(name,len(d['actions']));v=[]
 for key,ss in d['actions'].items():
  assert len(ss)==5,(name,key,len(ss))
  for s in ss:valid(s);v.append(s['ms'])
 out['reports'].append({'name':name,'actions':count,'samples':len(v),'maxMs':max(v)})
 if name=='remaining-action-performance':
  assert len(d['downstreamRouteLoads'])==5
  vv=[]
  for row in d['downstreamRouteLoads']:
   assert row['pass']
   for mode in ['cold','refresh','routeSwitch']:valid(row[mode]);vv.append(row[mode]['ms'])
  out['reports'].append({'name':'downstream-detail-loads','samples':len(vv),'maxMs':max(vv)})
d=load(b.parent/'acceptance-500ms/print-extra-performance.json');assert len(d['samples'])==5;v=[]
for s in d['samples']:
 for mode in ['imageFailure','imageRecovery','pdf']:valid(s[mode]);v.append(s[mode]['ms'])
 assert s['pdf']['pages']==4
out['reports'].append({'name':'four-batch-print','samples':len(v),'maxMs':max(v)})
lines=(b.parent.parent/'requirements.md').read_text().splitlines();rows=[l.split('|')[1:-1] for l in lines if re.match(r'^\| [A-Z]+-\d{3} \|',l)]
assert len(rows)==126 and len({r[0].strip() for r in rows})==126
assert all(len(r)==10 and all(c.strip() for c in r) for r in rows)
out['requirements']=126;out['statuses']={s:sum(r[7].strip()==s for r in rows) for s in sorted(set(r[7].strip() for r in rows))};out['pass']=True
(b/'final-evidence-validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
