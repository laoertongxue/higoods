async (initialPage) => {
 const browser=initialPage.context().browser(),base='http://127.0.0.1:4206',root='material-r1-MAT-FB-00000001',sku='material-r1-MAT-FB-00000001-B01';
 const path=`/pcs/materials/fabric/${root}/skus/${sku}/process`,samples=[],errors=[],failures=[];
 const field=(p,key)=>p.locator(`[data-pcs-material-archive-field="${key}"]`);
 const action=(p,key)=>p.locator(`[data-pcs-material-archive-action="${key}"]`);
 const ready=async p=>{await p.locator('[data-pcs-material-process-edit]').waitFor();await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('main img')].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});};
 const settle=async p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const assert=(ok,message)=>{if(!ok)throw new Error(message)};
 const measure=async(p,name,fn)=>{const start=Date.now();await fn();await settle(p);const ms=Date.now()-start;samples.push({name,ms});if(ms>1000)failures.push({name,ms});};
 for(let iteration=0;iteration<5;iteration++){
  const context=await browser.newContext({viewport:{width:1366,height:768}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await measure(p,'cold-navigation',async()=>{await p.goto(base+path,{waitUntil:'domcontentloaded'});await ready(p)});
  await measure(p,'refresh',async()=>{await p.reload({waitUntil:'domcontentloaded'});await ready(p)});
  await measure(p,'cost-tab',async()=>{await p.getByRole('button',{name:'标准费用',exact:true}).click();await p.getByRole('region',{name:'上道成本折算'}).waitFor()});
  assert(await field(p,'unitBridgeVersionId').count()===0,'same-unit generic selector still exists');
  await measure(p,'fee-live-update',async()=>{await field(p,'processStandardCny').fill('2');await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('8 元/码'))});
  await measure(p,'main-unit-change',async()=>{await field(p,'mainUnit').selectOption('KG')});
  await measure(p,'fixed-unit-live-update',async()=>{await field(p,'pricingUnit').selectOption('M');await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('8.5616798 元/米'))});
  assert((await p.locator('[data-material-cost-preview]').innerText()).includes('基础配置 · 固定单位换算'),'fixed source missing');
  if(iteration===0)await p.screenshot({path:'output/playwright/material-cost-folding/fixed-conversion.png',fullPage:true});
  await measure(p,'missing-unit-live-update',async()=>{await field(p,'pricingUnit').selectOption('KG');await p.getByRole('alert').filter({hasText:'尚未维护'}).waitFor()});
  assert((await p.locator('[data-material-cost-total]').innerText()).includes('待补齐'),'missing conversion produced invented total');
  if(iteration===0)await p.screenshot({path:'output/playwright/material-cost-folding/missing-conversion.png',fullPage:true});
  await measure(p,'units-entry-dialog',async()=>{await action(p,'cost-input-units').click();await p.locator('[data-pcs-action-dialog]').waitFor()});
  await measure(p,'units-entry-cancel',async()=>{await p.locator('[data-dialog-cancel]').click();await p.locator('[data-pcs-action-dialog]').waitFor({state:'detached'})});
  await action(p,'cost-input-units').click();
  await measure(p,'units-entry-confirm',async()=>{await p.locator('[data-dialog-confirm]').click();await p.getByRole('heading',{name:'计量单位',exact:true}).waitFor()});
  await measure(p,'internal-route-return',async()=>{await p.goBack({waitUntil:'domcontentloaded'});await ready(p)});
  await p.getByRole('button',{name:'标准费用',exact:true}).click();
  await measure(p,'negative-fee',async()=>{await field(p,'processStandardCny').fill('-1');assert((await p.locator('[data-material-cost-total]').innerText()).includes('待补齐'),'negative fee yielded a total')});
  await measure(p,'zero-fee',async()=>{await field(p,'pricingUnit').selectOption('Yard');await field(p,'processStandardCny').fill('0');await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('6 元/码'))});
  // Add a SKU-specific relationship only in this independent browser context.
  await p.evaluate(async sku=>{const repo=await import('/src/data/pcs-material-archive-repository.ts'),runtime=await import('/src/data/pcs-record-runtime.ts');await runtime.runPcsRecordCommand(()=>repo.saveMaterialUnitRelation(sku,{auxUnitId:'KG',mainQtyPerAux:5,basisType:'SPECIFICATION',basisReference:'验收确认幅宽与克重',uses:['PRICING'],isDefaultForUse:[],status:'ACTIVE',changeReason:'独立浏览器验收'}),crypto.randomUUID())},sku);
  await measure(p,'sku-unit-live-update',async()=>{await field(p,'pricingUnit').selectOption('KG');await field(p,'processStandardCny').fill('2');await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('32 元/千克'))});
  assert((await p.locator('[data-material-cost-preview]').innerText()).includes('验收确认幅宽与克重'),'SKU basis missing');
  await p.evaluate(async sku=>{const repo=await import('/src/data/pcs-material-archive-repository.ts'),runtime=await import('/src/data/pcs-record-runtime.ts');await runtime.runPcsRecordCommand(()=>{const common={packageTypeId:'包',contentUnitId:'Yard',grossWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,volumeM3:null,volumeSource:'UNKNOWN',measurementBasis:'确认每包长度',status:'ACTIVE'};repo.saveMaterialPackageSpec(sku,{...common,contentQty:100});repo.saveMaterialPackageSpec(sku,{...common,contentQty:600})},crypto.randomUUID())},sku);
  await measure(p,'package-choice-required',async()=>{await field(p,'pricingUnit').selectOption('包');await field(p,'unitBridgeVersionId').waitFor();assert((await p.locator('[data-material-cost-total]').innerText()).includes('待补齐'),'ambiguous package guessed')});
  const packageOptions=await field(p,'unitBridgeVersionId').locator('option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>({value:n.value,text:n.textContent})));
  await measure(p,'package-select-600',async()=>{await field(p,'unitBridgeVersionId').selectOption(packageOptions.find(n=>n.text.includes('600')).value);await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('3602 元/包'))});
  await measure(p,'package-select-100',async()=>{await field(p,'unitBridgeVersionId').selectOption(packageOptions.find(n=>n.text.includes('100')).value);await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('602 元/包'))});
  await measure(p,'package-switch-to-sku',async()=>{await field(p,'pricingUnit').selectOption('KG');assert(await field(p,'unitBridgeVersionId').count()===0,'irrelevant package selector retained');await p.waitForFunction(()=>document.querySelector('[data-material-cost-total]')?.textContent?.includes('32 元/千克'))});
  // Complete the actual form and verify its saved cost after refresh.
  await measure(p,'basic-tab',async()=>{await p.getByRole('button',{name:'投入与工艺',exact:true}).click()});await measure(p,'input-confirm',async()=>{await field(p,'inputConfirmed').selectOption('yes')});
  await measure(p,'spec-tab',async()=>{await p.getByRole('button',{name:'交付规格',exact:true}).click()});await measure(p,'color-select',async()=>{await field(p,'colorName').selectOption({label:'Black'})});await measure(p,'color-code-input',async()=>{await field(p,'colorCode').fill(`test-${iteration}`)});await measure(p,'pantone-select',async()=>{await field(p,'pantoneCode').selectOption('19-4003')});
  await measure(p,'images-tab',async()=>{await p.getByRole('button',{name:'识别与资料',exact:true}).click()});await measure(p,'image-upload-preview',async()=>{await p.locator('input[data-image-target="skuImageUrl"]').setInputFiles('public/materials/process-orders/white-black-cotton-jersey.jpg');await p.locator('main img').first().waitFor();await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('main img')].map(i=>i.decode().catch(()=>{})))})});await measure(p,'code-preview-tab',async()=>{await p.getByRole('button',{name:'编码预览',exact:true}).click()});
  await p.getByRole('button',{name:'标准费用',exact:true}).click();
  await measure(p,'save-and-read',async()=>{await action(p,'save-form').click();await p.waitForURL(url=>!url.pathname.endsWith('/process'));await p.locator('[data-pcs-material-sku-detail]').waitFor()});
  const savedId=new URL(p.url()).pathname.split('/').pop();
  const cost=await p.evaluate(async id=>(await import('/src/data/pcs-material-archive-repository.ts')).getMaterialStandardCost(id).totalStandardCny,savedId);assert(cost===32,'saved standard differs from preview: '+cost);
  await measure(p,'saved-refresh',async()=>{await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-pcs-material-sku-detail]').waitFor()});
  const refreshed=await p.evaluate(async id=>(await import('/src/data/pcs-material-archive-repository.ts')).getMaterialStandardCost(id).totalStandardCny,savedId);assert(refreshed===32,'refresh lost standard cost');
  // Same page at minimum supported management viewport.
  if(iteration===0){await p.goto(base+path);await ready(p);await p.setViewportSize({width:1280,height:720});await p.getByRole('button',{name:'标准费用',exact:true}).click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal page overflow');await p.screenshot({path:'output/playwright/material-cost-folding/minimum-viewport.png',fullPage:true})}
  await context.close();
 }
 const report={baseURL:base,viewport:'1366x768',coldContexts:5,samples,maxMs:Math.max(...samples.map(s=>s.ms)),errors,failures};
 return report;
}
