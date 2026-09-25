from pathlib import Path
import subprocess,json
root=Path('output/playwright/hpb');out=root/'acceptance-final'
entries=[('source-core','acceptance-storage-core/check-core.js'),('source-reload','acceptance-storage-core/check-reload.js'),('source-actions','acceptance-storage-core/check-actions.js'),('source-late','acceptance-final/check-source-core-late.js'),('migration','acceptance-final/check-migration.js'),('retired-history','acceptance-integration/check-retired-history.js'),('files','acceptance-integration/check-file-lifecycle.js'),('storage-extra','check-storage-extra.js')]
for name,path in entries:
 code=(root/path).read_text();wrapped='async page=>{const b=page.context().browser(),existing=new Set(b.contexts());try{return await ('+code+')(page)}finally{for(const c of b.contexts())if(!existing.has(c))await c.close()}}'
 r=subprocess.run(['node','/Users/laoer/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js','-s=hpb-root-chain','run-code',wrapped],capture_output=True,text=True)
 raw=r.stdout+'\n'+r.stderr;(out/(name+'-final.txt')).write_text(raw)
 try:
  data=json.loads(raw.split('### Result\n',1)[1].split('\n###',1)[0]);(out/(name+'-final.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2));print(name,json.dumps(data,ensure_ascii=False)[:1800],flush=True)
 except Exception as e:print(name,'SCRIPT ERROR',raw[:1000],flush=True);break
