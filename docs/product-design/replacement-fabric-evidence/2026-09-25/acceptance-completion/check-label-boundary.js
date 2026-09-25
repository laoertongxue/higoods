async page=>{
 const c=await page.context().browser().newContext({viewport:{width:1024,height:768}}),p=await c.newPage();await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
 const expected=await p.evaluate(async()=>{
  const r=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');const t=(await r.loadReplacementFabricState()).tickets[0];
  const label=await import('/src/pages/print/templates/replacement-fabric-label-template.ts');
  const variants=[t,{...t,id:'HPB-boundary-1001',sequence:1001,productionOrderNo:'PO-2026-OVERSEAS-JAKARTA-PRODUCTION-000000000001',ticketNo:'HPB/PO-2026-OVERSEAS-JAKARTA-PRODUCTION-000000000001/MATERIAL-GREY-2026-0001/Grey/1001',material:{...t.material,name:'雾霾灰双面抓绒高克重弹力复合卫衣主面料（长名称票面可读性边界验收）',code:'MATERIAL-GREY-2026-0001'}}];
  document.body.innerHTML='<main class="hpb-print-root">'+label.replacementFabricPrintStyles()+variants.map(label.renderReplacementFabricLabel).join('')+'</main>';
  (await import('/src/components/real-qr.ts')).hydrateRealQRCodes(document);
  return variants.map(t=>'HIG:HPB:1:'+encodeURIComponent(t.id));
 });
 await p.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] svg').length===2&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));
 const geometry=await p.locator('[data-hpb-label]').evaluateAll(ns=>ns.map(n=>({height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width,scrollHeight:n.scrollHeight,scrollWidth:n.scrollWidth,sequence:n.querySelector('.hpb-sequence').textContent})));
 if(geometry.some(g=>g.height>379||g.scrollWidth>379))throw Error('标签溢出 '+JSON.stringify(geometry));
 await p.screenshot({path:'output/playwright/hpb/label-boundary.png',fullPage:true});await p.pdf({path:'output/playwright/hpb/label-boundary.pdf',preferCSSPageSize:true,printBackground:true});
 const data=await p.locator('[data-real-qr]').evaluateAll(ns=>ns.map(n=>n.dataset));
 await c.close();return {expected,geometry,data,physicalPrint:'未验收'};
}
