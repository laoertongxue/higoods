async root=>{
 const base='http://127.0.0.1:43236',browser=root.context().browser();
 const ac=await browser.newContext(),ap=await ac.newPage();await ap.goto(base+'/fcs/pda/auth/login');await ap.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await ap.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await ap.getByRole('button',{name:'登录',exact:true}).click();await ap.waitForURL('**/fcs/pda/exec');const auth=await ap.evaluate(()=>localStorage.getItem('fcs_pda_session'));await ac.close();
 const results=[];
 for(const [name,path,selector] of [['pda-simple','/fcs/pda/cutting/simple-cut-piece-handover','[data-simple-cut-root=PDA]'],['bags','/fcs/craft/cutting/transfer-bags','[data-transfer-bags-action]']]){
  const c=await browser.newContext({viewport:name==='pda-simple'?{width:390,height:844}:{width:1366,height:768}}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.addInitScript(({auth,selector})=>{
   localStorage.setItem('fcs_pda_session',auth);window.__routeReady=0;window.__rootAt=0;window.__imagesAt=0;window.__longTasks=[];
   new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration,name:e.name,attribution:e.attribution})))).observe({type:'longtask',buffered:true});
   let scheduled=false;const tick=()=>{if(window.__routeReady||scheduled)return;if(!document.querySelector(selector))return;if(!window.__rootAt)window.__rootAt=performance.now();
    if([...document.querySelectorAll('[data-page-content-root] img')].some(i=>!i.complete))return;window.__imagesAt=performance.now();scheduled=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.__routeReady=performance.now()));};
   new MutationObserver(tick).observe(document,{childList:true,subtree:true,attributes:true});document.addEventListener('load',tick,true);
  },{auth,selector});
  const client=await c.newCDPSession(p),trace=[];await client.send('Profiler.enable');await client.send('Profiler.setSamplingInterval',{interval:1000});
  client.on('Tracing.dataCollected',data=>trace.push(...data.value));const tracingDone=new Promise(resolve=>client.once('Tracing.tracingComplete',resolve));
  await client.send('Tracing.start',{categories:'devtools.timeline,v8,disabled-by-default-v8.gc',transferMode:'ReportEvents'});await client.send('Profiler.start');
  await p.goto(base+path);await p.waitForFunction(()=>window.__routeReady>0,null,{timeout:15000});
  const performanceData=await p.evaluate(()=>({ready:window.__routeReady,rootAt:window.__rootAt,imagesAt:window.__imagesAt,timeOrigin:performance.timeOrigin,now:performance.now(),navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>e.toJSON()),longTasks:window.__longTasks,images:[...document.querySelectorAll('[data-page-content-root] img')].map(i=>({src:i.currentSrc,complete:i.complete,width:i.naturalWidth})),body:document.body.innerText.slice(0,1300)}));
  const {profile}=await client.send('Profiler.stop');await client.send('Tracing.end');await tracingDone;
  const byId=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),self=new Map(),total=new Map();for(const n of profile.nodes)for(const ch of n.children||[])parents.set(ch,n.id);
  for(let i=0;i<(profile.samples||[]).length;i++){const d=profile.timeDeltas[i]/1000;let id=profile.samples[i];self.set(id,(self.get(id)||0)+d);while(id){total.set(id,(total.get(id)||0)+d);id=parents.get(id)}}
  const cpu=[...total].map(([id,ms])=>({name:byId.get(id).callFrame.functionName,url:byId.get(id).callFrame.url,line:byId.get(id).callFrame.lineNumber+1,total:ms,self:self.get(id)||0}));
  results.push({name,path,errors,performance:performanceData,topSelf:cpu.toSorted((a,b)=>b.self-a.self).slice(0,35),topTotal:cpu.filter(x=>x.url.includes('/assets/')).toSorted((a,b)=>b.total-a.total).slice(0,35),traceLong:trace.filter(e=>e.ph==='X'&&e.dur>=10000).map(e=>({name:e.name,ts:e.ts,duration:e.dur/1000,args:e.args})),profile,trace});await c.close();
 }
 return {kind:'diagnostic-one-cold-sample-per-route-not-strict-retry',base,results};
}
