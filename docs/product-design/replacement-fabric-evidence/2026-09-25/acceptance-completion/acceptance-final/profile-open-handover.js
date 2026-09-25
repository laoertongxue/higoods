// Diagnostic only: one isolated context, explicit existing Mock prerequisite, one real open-handover click.
// Do not run until the main agent releases the strict performance window. No handover is submitted.
async root => {
 const base='http://127.0.0.1:43236';
 const context=await root.context().browser().newContext({viewport:{width:1366,height:768}});
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
 let client,profiling=false;
 try {
  await page.goto(base+'/fcs/pda/auth/login');
  await page.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');
  await page.getByRole('textbox',{name:'密码',exact:true}).fill('123456');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForURL('**/fcs/pda/exec');
  await page.goto(base+'/fcs/craft/cutting/replacement-fabric-fei-tickets');
  await page.locator('[data-hpb-page]').waitFor();
  await page.locator('[data-hpb-action=data-tools]').click();
  await page.locator('[data-hpb-restore-file]').setInputFiles('output/playwright/hpb/acceptance-final/batch-prerequisite-unbound-fabric-omission-and-retry.higcut');
  await page.waitForFunction(()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('已恢复并读回确认。'));
  await page.goto(base+'/fcs/craft/cutting/warehouse-management/wait-handover');
  const selector='[data-wait-handover-action=open-handover]';
  await page.locator(selector).waitFor({state:'visible'});
  const before=await page.evaluate(()=>({now:performance.now(),resources:performance.getEntriesByType('resource').map(entry=>entry.toJSON()),url:location.href}));
  await page.evaluate(selector=>{
   window.__openProfile={start:0,rootAt:0,imagesAt:0,ready:0,longTasks:[]};
   const data=window.__openProfile;
   const observer=new PerformanceObserver(list=>data.longTasks.push(...list.getEntries().map(entry=>({start:entry.startTime,duration:entry.duration,name:entry.name,attribution:entry.attribution}))));
   observer.observe({type:'longtask'});
   const listener=event=>{if(!event.target.closest(selector))return;data.start=performance.now();document.removeEventListener('click',listener,true)};
   document.addEventListener('click',listener,true);
   let scheduled=false;
   const tick=()=>{
    if(data.ready||scheduled||!data.start)return;
    const modal=document.querySelector('[data-wait-handover-modal="handover"]');
    const step=modal?.querySelector('[data-wait-handover-repack-step="sources"]');
    if(!step||!step.getClientRects().length)return;
    if(!data.rootAt)data.rootAt=performance.now();
    const images=[...modal.querySelectorAll('img')].filter(image=>{const r=image.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0});
    if(images.some(image=>!image.complete||!image.naturalWidth))return;
    data.imagesAt=performance.now();scheduled=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>data.ready=performance.now()));
   };
   const mutation=new MutationObserver(tick);mutation.observe(document,{subtree:true,childList:true,attributes:true});document.addEventListener('load',tick,true);
   const poll=()=>{tick();if(!data.ready)requestAnimationFrame(poll)};requestAnimationFrame(poll);
   window.__stopOpenProfile=()=>{observer.disconnect();mutation.disconnect();document.removeEventListener('load',tick,true);document.removeEventListener('click',listener,true)};
  },selector);
  client=await context.newCDPSession(page);
  await client.send('Profiler.enable');await client.send('Profiler.setSamplingInterval',{interval:1000});
  await client.send('Profiler.start');profiling=true;
  await page.locator(selector).click();
  await page.waitForFunction(()=>window.__openProfile?.ready>0,null,{timeout:15000});
  const {profile}=await client.send('Profiler.stop');profiling=false;
  const after=await page.evaluate(()=>{
   window.__stopOpenProfile();
   const modal=document.querySelector('[data-wait-handover-modal="handover"]');
   return {now:performance.now(),timing:window.__openProfile,resources:performance.getEntriesByType('resource').map(entry=>entry.toJSON()),body:modal?.innerText,
    taskOptions:[...modal.querySelectorAll('[data-wait-handover-field=handoverTaskSelection] option')].map(n=>({value:n.value,label:n.textContent})),
    bagOptions:[...modal.querySelectorAll('[data-wait-handover-field=sourceBagCodes] option')].map(n=>({value:n.value,label:n.textContent,selected:n.selected}))};
  });
  const nodes=new Map(profile.nodes.map(node=>[node.id,node])),parent=new Map(),self=new Map(),total=new Map();
  for(const node of profile.nodes)for(const id of node.children||[])parent.set(id,node.id);
  for(let i=0;i<(profile.samples||[]).length;i++){
   let id=profile.samples[i];const duration=profile.timeDeltas[i]/1000;
   self.set(id,(self.get(id)||0)+duration);
   while(id){total.set(id,(total.get(id)||0)+duration);id=parent.get(id)}
  }
  const rows=[...nodes.values()].map(node=>({id:node.id,parentId:parent.get(node.id),name:node.callFrame.functionName,url:node.callFrame.url,line:node.callFrame.lineNumber+1,column:node.callFrame.columnNumber+1,self:self.get(node.id)||0,total:total.get(node.id)||0}));
  const previousResources=new Set(before.resources.map(resource=>resource.name+'|'+resource.startTime));
  return {kind:'one-real-open-handover-diagnostic-not-strict-acceptance',base,prerequisite:'Existing explicit Mock backup; real data-tools restore. No handover submitted.',errors,
   milliseconds:after.timing.ready-after.timing.start,before,after,
   addedResources:after.resources.filter(resource=>!previousResources.has(resource.name+'|'+resource.startTime)),
   clickLongTasks:after.timing.longTasks.filter(task=>task.start+task.duration>=after.timing.start&&task.start<=after.timing.ready),
   topSelf:rows.toSorted((a,b)=>b.self-a.self).slice(0,60),topTotal:rows.filter(row=>row.url.includes('/assets/')).toSorted((a,b)=>b.total-a.total).slice(0,100),profile};
 } catch(error) {
  let profile;if(profiling&&client){try{profile=(await client.send('Profiler.stop')).profile}catch{}}
  return {error:String(error),errors,url:page.url(),body:(await page.locator('body').innerText()).slice(-10000),profile};
 } finally {await context.close()}
}
