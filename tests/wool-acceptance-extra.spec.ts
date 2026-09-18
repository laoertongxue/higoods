import {test,expect,type Page} from '@playwright/test'
const facts=(page:Page)=>page.evaluate(async()=>(await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore())
async function receive(page:Page,qty:number){await page.locator('[data-wool-receiving-action="receive"]').first().click();await page.locator('[data-wool-receiving-field="pieceQty"]').fill(String(qty));await page.locator('[data-wool-receiving-action="review"]').click();await page.locator('[data-wool-receiving-action="save"]').click();await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')}

test.use({actionTimeout:12_000})

test('A13 计划80实际100的合法外发片经过各工艺真实接收加工交出并缝盘最终交出',async({page},info)=>{
 test.setTimeout(120_000)
 await page.goto('/fcs/craft/wool/knitting-orders')
 const groups=await page.evaluate(async()=>{
  const {readWoolStore,replaceWoolStore}=await import('/src/data/fcs/wool-domain/store.ts');const s=readWoolStore()
  // Source fixture: plan 80, already knitted/handed over/received 100 (125%, below the 150% cap).
  // All existing actual quantities stay 100; only the independent demand plan is 80.
  for(const id of ['WOOL-STAGE-009:KNITTING','WOOL-STAGE-009:LINKING'])s.workOrders[id].outputPlanLines.forEach((line:any)=>line.plannedQty=80)
  replaceWoolStore(s)
  const {listWoolCraftTaskOrders}=await import('/src/data/fcs/wool-domain/craft-flow.ts');const {buildSpecialCraftTaskDetailPath}=await import('/src/data/fcs/special-craft-operations.ts')
  const tasks=listWoolCraftTaskOrders().filter((t:any)=>t.woolOrderId==='WOOL-STAGE-009:KNITTING')
  return [...new Set(tasks.map((t:any)=>t.woolPieceKey))].map(key=>tasks.filter((t:any)=>t.woolPieceKey===key).map((t:any)=>({id:t.taskOrderId,path:buildSpecialCraftTaskDetailPath(t,t.taskOrderId)})))
 })
 for(const steps of groups){for(const [index,step]of steps.entries()){
  await page.goto(step.path)
  if(index){await page.locator('[data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click();await receive(page,100);await page.goto(step.path)}
  for(const code of ['SPECIAL_CRAFT_PROCESS_REPORT','SPECIAL_CRAFT_SUBMIT_HANDOVER']){await page.locator(`[data-action-code="${code}"]`).click();await page.getByRole('spinbutton',{name:'本次数量（片）'}).fill('100');await page.locator('[data-wool-craft-save]').click();await expect(page.locator('#wool-craft-dialog')).toHaveCount(0)}
 }
 await page.goto('/fcs/craft/wool/pending-receipts?workOrderId=WOOL-STAGE-009%3ALINKING');await receive(page,100)
 }
 const id='WOOL-STAGE-009:LINKING',a=(name:string)=>`[data-wool-work-orders-action="${name}"][data-wool-order-id="${id}"]`
 await page.goto('/fcs/craft/wool/linking-orders');await page.locator(a('open-report')).click();await page.locator('[data-wool-dialog-field="qty"]').fill('100');await page.locator('[data-wool-work-orders-action="save-report"]').click();await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
 await page.locator(a('open-handover')).click();await page.locator('[data-wool-dialog-field="qty"]').fill('100');await page.locator('[data-wool-work-orders-action="save-handover"]').click();await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
 await page.reload();const s=await facts(page)
 expect(s.pieceReceipts.filter((r:any)=>r.woolOrderId===id).map((r:any)=>r.qty)).toEqual([100,100])
 expect(s.processReports.filter((r:any)=>r.woolOrderId===id).map((r:any)=>r.reportedQty)).toEqual([100])
 expect(s.handovers.filter((r:any)=>r.woolOrderId===id).map((r:any)=>r.handoverQty)).toEqual([100])
 await page.screenshot({path:info.outputPath('legal-overplan-final-handover.png'),fullPage:true})
})

test('A19 1024仓库领退移库与设备关联释放及状态修改可操作',async({page},info)=>{
 test.setTimeout(120_000);page.on('pageerror',error=>console.error('PAGEERROR',error.message));await page.setViewportSize({width:1024,height:768})
 await page.goto('/fcs/craft/wool/pending-receipts?workOrderId=WOOL-STAGE-001%3AKNITTING');await page.locator('[data-wool-receiving-action="receive"]').first().click();await page.locator('[data-wool-receiving-field="pcs"]').fill('1');await page.locator('[data-wool-receiving-field="grossKg"]').fill('2.062');await page.locator('[data-wool-receiving-field="PAPER"]').fill('1');await page.locator('[data-wool-receiving-action="review"]').click();await page.locator('[data-wool-receiving-action="save"]').click();await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')
 const w=(name:string)=>`[data-wool-warehouse-action="${name}"]`
 for(const mode of ['process','handover']){
  await page.goto(`/fcs/craft/wool/wait-${mode}-warehouse`);await expect(page.locator('[data-wool-warehouse-root]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.locator(w('open-detail')).first().click();await expect(page.locator('[data-wool-warehouse-dialog]')).toBeVisible();await page.locator(w('close-overlay')).first().click()
  const tabCount=await page.locator('[data-wool-warehouse-action^="tab:"]').count()
  expect(tabCount).toBeGreaterThan(0)
  for(let i=0;i<tabCount;i++)await page.locator('[data-wool-warehouse-action^="tab:"]').nth(i).click()
  await page.locator('[data-wool-warehouse-action^="tab:"]').first().click()
  if(mode==='process'){
   await expect(page.locator(w('open-issue')).first()).toHaveAttribute('data-row-id',/WOOL-STAGE-001/)
   const row=await page.locator(w('open-issue')).first().getAttribute('data-row-id'),by=(n:string)=>w(n)+`[data-row-id="${row}"]`
   for(const n of ['issue','return']){await page.locator(by('open-'+n)).click();await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('1');await page.locator(w('save-'+n)).click();await expect(page.locator('[data-wool-warehouse-dialog]')).toHaveCount(0)}
   await page.locator(by('open-transfer-out')).click();const target='[data-wool-warehouse-dialog-field="target"]';await page.locator(target).waitFor();const options=await page.locator(target+' option').evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value).filter(Boolean));await page.locator(target).selectOption(options.at(-1)!);await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('1');await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('1024库位整理');await page.locator(w('save-transfer-out')).click();await expect(page.locator('[data-wool-warehouse-dialog]')).toHaveCount(0)
  }
  await page.screenshot({path:info.outputPath(`warehouse-${mode}-1024.png`),fullPage:true})
 }
 await page.goto('/fcs/process-factory/wool/machine-associations?woolOrderId=WOOL-STAGE-002%3AKNITTING');await page.locator('[data-wool-machine-associations-machine-id="WM-003"]').check();await page.locator('[data-wool-machine-associations-action="save-association"]').click();await expect(page.locator('[data-wool-machine-association-dialog]')).toHaveCount(0)
 await page.locator('[data-wool-machine-associations-action="open-association"][data-machine-id="WM-003"]').click();await page.locator('[data-wool-machine-associations-machine-id="WM-003"]').uncheck();await page.locator('[data-wool-machine-associations-action="save-association"]').click();await expect(page.locator('[data-wool-machine-association-dialog]')).toHaveCount(0)
 await page.goto('/fcs/craft/wool/machines');await page.locator('[data-wool-machines-action="open-status"][data-machine-id="WM-003"]').click();await page.locator('[data-wool-machines-dialog-field="nextStatus"]').selectOption('REPAIR');await page.locator('[data-wool-machines-dialog-field="reason"]').fill('1024验收保养');await page.locator('[data-wool-machines-action="save-status"]').click();await expect(page.locator('[data-wool-machines-dialog-field="nextStatus"]')).toHaveCount(0);await page.reload()
 const s=await facts(page);expect(s.machines.find((m:any)=>m.machineId==='WM-003')?.status).toBe('REPAIR');expect(s.machineAssociations.some((m:any)=>m.machineId==='WM-003')).toBe(false)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('machines-1024.png'),fullPage:true})
})


test('A19 仓库筛选切换和重置取消迟到刷新且不覆盖每页条数',async({page})=>{
 await page.goto('/fcs/craft/wool/wait-process-warehouse')
 await expect(page.locator('[data-wool-warehouse-root]')).toBeVisible()
 await page.clock.install()
 await page.clock.pauseAt(new Date())
 // Drive the real page handler against its rendered controls in a fixed order.
 // Advancing the fake clock exposes pending work; it does not hide it with a sleep.
 const run=async(kind:'change'|'reset'|'select-after-change')=>{
  await page.evaluate(async(kind)=>{
   const {handleCraftWoolWarehouseEvent:handle}=await import('/src/pages/process-factory/wool/warehouse.ts')
   const text=document.querySelector<HTMLInputElement>('[data-wool-warehouse-filter="woolOrderNo"]')!
   const completion=document.querySelector<HTMLSelectElement>('[data-wool-warehouse-filter="completion"]')!
   text.value='NO-MATCH'
   await handle(text,new Event('input'))
   if(kind==='change'){
    text.value=''
    await handle(text,new Event('change'))
   }else{
    completion.value='COMPLETED'
    await handle(completion,new Event('input'))
    await handle(completion,new Event('change'))
    await handle(document.querySelector<HTMLElement>('[data-wool-warehouse-action="reset-filters"]')!,new Event('click'))
    // Global input dispatch has more awaits than change; exercise that late order.
    if(kind==='select-after-change')await handle(completion,new Event('input'))
   }
   const pageSize=document.querySelector<HTMLSelectElement>('[data-wool-warehouse-field="pageSize"]')!
   pageSize.value='20'
   await handle(pageSize,new Event('change'))
   ;(window as any).__woolDebounceNodes={table:document.querySelector('[data-wool-warehouse-table-surface]')!.firstElementChild,pager:document.querySelector('[data-wool-warehouse-field="pageSize"]')}
  },kind)
  await expect(page.locator('[data-wool-warehouse-field="pageSize"]')).toHaveValue('20')
  await page.clock.runFor(181)
  expect(await page.evaluate(()=>{
   const before=(window as any).__woolDebounceNodes
   return {sameTable:before.table===document.querySelector('[data-wool-warehouse-table-surface]')!.firstElementChild,samePager:before.pager===document.querySelector('[data-wool-warehouse-field="pageSize"]'),rows:document.querySelectorAll('[data-wool-warehouse-table-surface] tbody tr').length}
  })).toEqual({sameTable:true,samePager:true,rows:13})
  await expect(page.locator('[data-wool-warehouse-field="pageSize"]')).toHaveValue('20')
 }
 for(const kind of ['change','reset','select-after-change'] as const)await run(kind)
 // A late select input must not cancel a newer text filter's debounce.
 await page.evaluate(async()=>{
  const {handleCraftWoolWarehouseEvent:handle}=await import('/src/pages/process-factory/wool/warehouse.ts')
  const completion=document.querySelector<HTMLSelectElement>('[data-wool-warehouse-filter="completion"]')!
  completion.value='ACTIVE'
  await handle(completion,new Event('change'))
  const text=document.querySelector<HTMLInputElement>('[data-wool-warehouse-filter="woolOrderNo"]')!
  text.value='NO-MATCH'
  await handle(text,new Event('input'))
  await handle(completion,new Event('input'))
 })
 await page.clock.runFor(181)
 expect(await page.locator('[data-wool-warehouse-table-surface] tbody').innerText()).toContain('当前筛选条件下暂无仓库事实')
 await expect(page.locator('[data-wool-warehouse-filter="woolOrderNo"]')).toHaveValue('NO-MATCH')
})
