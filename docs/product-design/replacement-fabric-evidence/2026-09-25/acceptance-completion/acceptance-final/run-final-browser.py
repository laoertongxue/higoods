from pathlib import Path
import subprocess,json,sys,time
root=Path('output/playwright/hpb');out=root/'acceptance-final'
entries=[('part','acceptance-part-tickets/check-performance.js'),('part-stages','acceptance-part-tickets/check-pda-stages.js'),('part-detail','acceptance-part-tickets/check-fei-detail.js'),('routes','acceptance-final/check-routes.js'),('list-actions','acceptance-final/check-list-actions.js'),('extra-controls','check-hpb-extra-controls-preview.js'),('print-controls','acceptance-final/check-print-controls.js'),('print-images','acceptance-final/check-print-images.js'),('backup','check-backup-fresh-browser.js'),('lan','acceptance-final/check-lan-final.js'),('marker','acceptance-final/check-marker-final.js'),('roles','acceptance-final/check-role-boundary.js'),('history-print','acceptance-final/check-history-print.js'),('data-tools','acceptance-final/check-data-tools-controls.js'),('simple-handover','acceptance-final/check-simple-handover-five.js'),('web-detail','acceptance-final/check-web-detail-final.js'),('source-routes','acceptance-source-ui-final/check-perf-final.js'),('batch-ui','acceptance-final/check-batch-ui-preview-five.js'),('bag-lifecycle','acceptance-bag-lifecycle/lifecycle-five-samples.js')]
entries += [('wait-dialogs','acceptance-final/check-wait-dialogs.js'),('hpb-scan','acceptance-bag-lifecycle/hpb-scan-five-samples.js')] + [('source-'+n,'acceptance-source-ui-final/check-'+n+'-final.js') for n in ['actions','pda-accept','contract-transfer','completion','start','generation','breakdown']]
if len(sys.argv)>2: entries=[x for x in entries if x[0] in sys.argv[2:]]
version=sys.argv[1]
for name,script in entries:
 code=(root/script).read_text();wrapped='async page=>{const b=page.context().browser(),existing=new Set(b.contexts());try{return await ('+code+')(page)}finally{for(const c of b.contexts())if(!existing.has(c))await c.close()}}'
 res=subprocess.run(['node','/Users/laoer/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js','-s=hpb-release','run-code',wrapped],capture_output=True,text=True)
 raw=res.stdout+'\n'+res.stderr;(out/f'{name}-{version}.txt').write_text(raw)
 try:
  data=json.loads(raw.split('### Result\n',1)[1].split('\n###',1)[0]);(out/f'{name}-{version}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
  def errors(o):
   if isinstance(o,list):return sum((errors(x) for x in o),[])
   if isinstance(o,dict):
    result=[]
    if o.get('error'):result.append(o['error'])
    if o.get('errors'):result+=o['errors']
    if isinstance(o.get('ms'),(int,float)) and o['ms']>=500:result.append({k:v for k,v in o.items() if k in ['name','scene','sample','ms']})
    for k,v in o.items():
     if k not in ['failed','errors','error']:result+=errors(v)
    return result
   return []
  failures=errors(data);print(name,'PASS' if not failures else 'FAIL',json.dumps(failures,ensure_ascii=False)[:1000],flush=True)
  if failures:break
 except Exception as e: print(name,'TOOL_OR_SCRIPT_ERROR',str(e),raw[:1300],flush=True);break
