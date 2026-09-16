import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'

test('任务单固定操作、未分配禁用、已分配范围和历史编号稳定',async({page})=>{
  test.setTimeout(240000)
  await fs.mkdir('output/playwright/task-sheet-workbench',{recursive:true})
  for(const width of [1366,1280]){
    await page.setViewportSize({width,height:width===1280?720:768})
    await page.goto('/fcs/dispatch/workbench?keyword=PO-DEMO-')
    await expect(page.locator('[data-unified-action="print-task-sheet"]').first()).toBeVisible({timeout:120000})
    const buttons=page.locator('[data-unified-action="print-task-sheet"]')
    expect(await buttons.count()).toBeGreaterThan(3)
    await expect(page.locator('[data-unified-action="print-task-sheet"][data-task-id="TASK-PO-DEMO-UNASSIGNED-0916-SEW__ORDER"]')).toBeDisabled()
    const m=page.locator('[data-unified-action="print-task-sheet"][data-task-id="TASK-SIMPLE-0916-PROC_SEW-A01"]')
    await expect(m).toBeEnabled()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    await page.screenshot({path:`output/playwright/task-sheet-workbench/workbench-${width}.png`,fullPage:true})
  }
  const before=await page.evaluate(()=>localStorage.getItem('cuttingRuntimeEventLedger'))
  await page.locator('[data-unified-action="print-task-sheet"][data-task-id="TASK-SIMPLE-0916-PROC_SEW-A01"]').click()
  await expect(page).toHaveURL(/documentType=DISPATCH_TASK_SHEET/)
  await expect(page.locator('body')).toContainText('RW-10CIVDB-0IZLA0Q', {timeout:120000})
  await expect(page.locator('[data-task-sheet-section="task-sku-scope"]')).toContainText('SKU-SIMPLE-M-GRY')
  await expect(page.locator('[data-task-sheet-section="task-sku-scope"]')).not.toContainText('SKU-SIMPLE-L-GRY')
  expect(await page.evaluate(()=>localStorage.getItem('cuttingRuntimeEventLedger'))).toBe(before)
  await page.reload()
  await expect(page.locator('body')).toContainText('RW-10CIVDB-0IZLA0Q', {timeout:120000})
  expect(await page.evaluate(()=>localStorage.getItem('cuttingRuntimeEventLedger'))).toBe(before)
})

test('多有效分配先选择工厂，再打印其独立SKU范围',async({page})=>{
  test.setTimeout(240000)
  await page.goto('/fcs/dispatch/workbench?keyword=PO-DEMO-SIMPLE-0916')
  await expect(page.locator('[data-unified-action="print-task-sheet"]').first()).toBeVisible({timeout:120000})
  const taskId=await page.evaluate(async()=>{
    const path='/src/data/fcs/effective-task-assignments.ts'
    const model=await import(/* @vite-ignore */ path)
    const current=model.listEffectiveTaskAssignments().find((row:any)=>row.runtimeTaskId.startsWith('TASK-SIMPLE-0916-PROC_CUT') && row.status==='EFFECTIVE')
    if(!current) throw new Error('缺少实际裁剪任务分配')
    for(const [index,line] of current.skuLines.entries()){
      model.createEffectiveTaskAssignment({...current,indexedRuntimeSnapshot:undefined,assignmentId:`BROWSER-MULTI-${index}`,factoryId:index?'ID-F022':'ID-F021',factoryName:index?'验收分配工厂B':'验收分配工厂A',skuLines:[line],assignedQty:line.qty,frozenPrice:100,source:'DIRECT_DISPATCH'})
    }
    return current.runtimeTaskId
  })
  await page.reload()
  await page.locator(`[data-unified-action="print-task-sheet"][data-task-id="${taskId}"]`).click({timeout:120000})
  const choices=page.locator('[data-unified-action="print-selected-task-sheet"]')
  await expect(choices).toHaveCount(2)
  await expect(choices.first().locator('..')).toContainText('SKU-SIMPLE-M-GRY')
  await expect(choices.last().locator('..')).toContainText('SKU-SIMPLE-L-GRY')
  await page.screenshot({path:'output/playwright/task-sheet-workbench/multiple-assignment-selection.png',fullPage:true})
  await choices.last().click()
  await expect(page.locator('[data-task-sheet-section="task-sku-scope"]')).toContainText('SKU-SIMPLE-L-GRY',{timeout:120000})
  await expect(page.locator('[data-task-sheet-section="task-sku-scope"]')).not.toContainText('SKU-SIMPLE-M-GRY')
})
