async root=>{
 const c=await root.context().browser().newContext(),p=await c.newPage();await p.routeWebSocket('**',()=>{});
 const session=await c.newCDPSession(p);await session.send('Profiler.enable');await session.send('Profiler.setSamplingInterval',{interval:500});
 const result=[];
 for(const name of ['manual','spreading','pda']){
  await p.addInitScript(()=>localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'F090_operator',loginId:'F090_operator',userName:'裁片操作工',roleId:'ROLE_OPERATOR',factoryId:'F090',factoryName:'测试工厂',loggedAt:'2026-09-25 11:00:00'})));
  if(name==='manual'){await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/fei-tickets');await p.locator('[data-cutting-fei-action=open-manual-create]').waitFor()}
  await session.send('Profiler.start');
  if(name==='manual'){await p.locator('[data-cutting-fei-action=open-manual-create]').click();await p.locator('[data-cutting-fei-action=confirm-manual-create]').waitFor()}
  else if(name==='spreading'){await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/spreading-list');await p.locator('[data-cutting-marker-action=create-spreading]').waitFor()}
  else {await p.goto('http://127.0.0.1:43235/fcs/pda/cutting/spreading/TASK-CUT-000201?executionOrderId=CPO-20260318-A1&executionOrderNo=CPO-20260318-A1');await p.locator('[data-pda-cut-spreading-action=start-spreading]').waitFor()}
  const {profile}=await session.send('Profiler.stop');const counts=new Map(),nodeById=new Map(profile.nodes.map(n=>[n.id,n]));for(let i=0;i<profile.samples.length;i++)counts.set(profile.samples[i],(counts.get(profile.samples[i])||0)+profile.timeDeltas[i]);
  const parent=new Map();for(const n of profile.nodes)for(const id of n.children||[])parent.set(id,n.id);
  const total=new Map();for(const [id,time] of counts){let n=id;while(n){total.set(n,(total.get(n)||0)+time);n=parent.get(n)}}
  const list=[...nodeById.values()].map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,self:(counts.get(n.id)||0)/1000,total:(total.get(n.id)||0)/1000}));result.push({name,self:list.toSorted((a,b)=>b.self-a.self).slice(0,25),total:list.filter(x=>x.url.includes('/src/')).toSorted((a,b)=>b.total-a.total).slice(0,35)});
 }
 await c.close();return result;
}
