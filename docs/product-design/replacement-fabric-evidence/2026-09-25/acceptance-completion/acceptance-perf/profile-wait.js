async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage();
 await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/warehouse-management/wait-handover');
 await p.locator('[data-wait-handover-workbench-data]').waitFor();
 const client=await c.newCDPSession(p);await client.send('Profiler.enable');await client.send('Profiler.setSamplingInterval',{interval:100});await client.send('Profiler.start');
 const durations=await p.evaluate(async()=>{const m=await import('/src/pages/process-factory/cutting/warehouse-hub.ts');const a=[];for(let i=0;i<5;i++){const s=performance.now();m.renderCraftCuttingWarehouseManagementWaitHandoverPage();a.push(performance.now()-s);}return a;});
 const {profile}=await client.send('Profiler.stop');const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of profile.nodes)for(const ch of n.children||[])parent.set(ch,n.id);const total=new Map(),self=new Map();for(let i=0;i<profile.samples.length;i++){let id=profile.samples[i];const d=profile.timeDeltas[i]/1000;self.set(id,(self.get(id)||0)+d);while(id){total.set(id,(total.get(id)||0)+d);id=parent.get(id)}}const rows=[...total].map(([id,ms])=>({name:nodes.get(id).callFrame.functionName,url:nodes.get(id).callFrame.url,line:nodes.get(id).callFrame.lineNumber+1,total:ms,self:self.get(id)||0})).sort((a,b)=>b.total-a.total);await c.close();return {durations,rows:rows.slice(0,70)};
}
