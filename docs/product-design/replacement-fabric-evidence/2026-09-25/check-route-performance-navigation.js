async(page)=>{
 const auth=await page.evaluate(()=>localStorage.getItem('fcs_pda_session'));
 const browser=page.context().browser(),results=[];
 const routes=[
 ['hpb','/fcs/craft/cutting/replacement-fabric-fei-tickets','[data-hpb-page]'],
 ['bags','/fcs/craft/cutting/transfer-bags','[data-transfer-bags-action]'],
 ['wait','/fcs/craft/cutting/warehouse-management/wait-handover','[data-wait-handover-action], [data-cutting-warehouse-map-section]'],
 ['records','/fcs/craft/cutting/handover-orders','[data-handover-list-root]'],
 ['pda-bag','/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307','[data-pda-cutting-inbound-workflow]'],
 ['pda-repack','/fcs/pda/cutting/transfer-bag/repack','[data-pda-transfer-bag-repack]'],
 ['pda-recovery','/fcs/pda/cutting/transfer-bag/recovery','[data-pda-recovery-field]'],
 ['pda-scrap','/fcs/pda/cutting/transfer-bag/scrap','[data-pda-scrap-field]']
 ];
 for(const [name,path,selector] of routes){
  for(let sample=1;sample<=5;sample++){
   const context=await browser.newContext({viewport:name.startsWith('pda')?{width:390,height:844}:{width:1366,height:768}});
   const p=await context.newPage();
   await p.addInitScript(({auth,selector})=>{
    if(auth)localStorage.setItem('fcs_pda_session',auth);
    window.__perfSelector=selector;window.__perfReady=0;window.__perfStart=0;
    let scheduled=false;
    const tick=()=>{if(window.__perfReady||scheduled)return;const root=document.querySelector(window.__perfSelector);if(!root)return;
     const images=[...document.querySelectorAll('[data-page-content-root] img')];if(images.some(i=>!i.complete))return;
     scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__perfReady=performance.now()-window.__perfStart;scheduled=false}));};
    new MutationObserver(tick).observe(document,{childList:true,subtree:true,attributes:true});document.addEventListener('load',tick,true);
   },{auth,selector});
   for(const scene of ['cold','refresh','navigation']){
    try{if(scene==='cold')await p.goto('http://127.0.0.1:43226'+path);else if(scene==='refresh')await p.reload();else{await p.goto('http://127.0.0.1:43226'+(name==='records'?'/fcs/craft/cutting/replacement-fabric-fei-tickets':'/fcs/craft/cutting/handover-orders'));await p.waitForFunction(()=>document.querySelector('[data-hpb-page], [data-handover-list-root]'));await p.evaluate(({path,selector})=>{window.__perfReady=0;window.__perfStart=performance.now();window.__perfSelector=selector;history.pushState(null,'',path);dispatchEvent(new PopStateEvent('popstate'));},{path,selector});}await p.waitForFunction(()=>window.__perfReady>0,{},{timeout:10000});results.push({name,scene,sample,ms:await p.evaluate(()=>window.__perfReady)});}catch(e){results.push({name,scene,sample,error:String(e).slice(0,160)});break;}
   }
   await context.close();
  }
 }
 return {results,failed:results.filter(r=>r.error||r.ms>=500),max:Math.max(...results.filter(r=>r.ms).map(r=>r.ms))};
}
