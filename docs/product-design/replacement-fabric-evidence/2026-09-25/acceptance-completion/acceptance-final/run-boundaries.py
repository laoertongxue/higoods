from pathlib import Path
import subprocess,json,sys
out=Path('output/playwright/hpb/acceptance-final')
for name in sys.argv[2:]:
 script=out/('check-'+name+'-boundaries.js')
 code=script.read_text();wrapped='async page=>{const b=page.context().browser(),existing=new Set(b.contexts());try{return await ('+code+')(page)}finally{for(const c of b.contexts())if(!existing.has(c))await c.close()}}'
 r=subprocess.run(['node','/Users/laoer/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js','-s=hpb-root-chain','run-code',wrapped],capture_output=True,text=True)
 raw=r.stdout+'\n'+r.stderr;(out/(name+'-boundaries-'+sys.argv[1]+'.txt')).write_text(raw)
 try:
  data=json.loads(raw.split('### Result\n')[1].split('\n###')[0]);(out/(name+'-boundaries-'+sys.argv[1]+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2))
  for v in data.get('scenarios',data.get('results',[])): print(name,v.get('scene',v.get('requirement',v.get('requirements'))),v.get('passed'),v.get('error','')[:450],flush=True)
 except Exception as e:print(name,'SCRIPT_ERROR',raw[:500],flush=True)
