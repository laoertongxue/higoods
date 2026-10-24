import { test, expect, type Page } from '@playwright/test'
import mock from '../src/data/wls/finished-inventory-quality-mock.json' with {type:'json'}
import { fillPostQcRow } from './helpers/post-finishing-qc-form.ts'
import { inventoryClick, inventoryNavigation, saveInventoryTimings } from './helpers/inventory-quality-timing.ts'
test.use({timezoneId:'Asia/Jakarta'})
const WLS='/wls/finished/inventory-quality',POST='/fcs/craft/post-finishing/inventory-quality'
const app=(stage:string)=>mock.inventory.applications.find(row=>row.id===mock.cases.find(row=>row.stage===stage)!.id)!
async function saved(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('higood-pcs-records'),db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
 try{return await new Promise<any[]>((resolve,reject)=>{const read=db.transaction('records').objectStore('records').getAll();read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error)})}finally{db.close()}
})}
test('Mock默认11条申请打开即见，两页与状态统计一致，刷新不整包写种子',async({page},info)=>{
 await page.setViewportSize({width:1366,height:768})
 await inventoryNavigation(page,'Mock申请列表冷启动',WLS,async()=>{await expect(page.getByRole('heading',{name:'成衣库存质检',exact:true})).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(10);await expect(page.getByText('申请总数',{exact:true}).locator('..')).toContainText('11')})
 expect((await saved(page)).filter(row=>row.id.startsWith('higood-finished-inventory/'))).toHaveLength(0)
 await page.screenshot({path:info.outputPath('mock-default-first-page.png'),fullPage:true})
 await inventoryClick(page,'Mock申请第二页',page.getByRole('button',{name:'下一页',exact:true}),async()=>{await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody')).toContainText(mock.cases[0].applicationNo)})
 await page.screenshot({path:info.outputPath('mock-default-second-page.png'),fullPage:true})
 await page.reload();await expect(page.locator('tbody tr')).toHaveCount(10)
 expect((await saved(page)).filter(row=>row.id.startsWith('higood-finished-inventory/'))).toHaveLength(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await saveInventoryTimings(page,info)
})
test('Mock出库、质检、加工、分类出货、返仓和返工入口均可直接看到关联数据',async({page},info)=>{
 await page.goto('/wls/finished/outbound-orders');await page.getByRole('combobox',{name:'出库类型',exact:true}).selectOption('成衣质检');await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(11)
 await page.goto('/fcs/craft/post-finishing/qc-orders?sourceKind=WAREHOUSE_STOCK');await expect(page.locator('tbody tr')).toHaveCount(10);await expect(page.locator('tbody')).toContainText('成衣库存质检')
 await page.goto('/fcs/craft/post-finishing/work-orders?sourceKind=WAREHOUSE_STOCK');await expect(page.locator('tbody tr')).toHaveCount(2)
 await page.goto('/fcs/craft/post-finishing/outbound-orders?sourceKind=WAREHOUSE_STOCK');const total=mock.inventory.transfers.filter(row=>row.category!=='送后道').length;await expect(page.locator('tbody tr')).toHaveCount(Math.min(20,total));await expect(page.getByText(new RegExp(`共 ${total} 条，当前`))).toBeVisible();await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(total-20)
 await page.goto('/wls/finished/pre-inbound');await expect(page.locator('[data-fiq-form="receive-transfer"]').first()).toBeVisible()
 await page.goto('/wls/finished/putaway');await expect(page.locator('[data-fiq-form="putaway"]').first()).toBeVisible()
 await page.goto('/fcs/production/inventory-rework-receipts');await expect(page.locator('tbody')).toContainText(app('待goto_global返工接收').applicationNo)
 await page.screenshot({path:info.outputPath('mock-rework-entry.png'),fullPage:true})
 const rows=await saved(page);expect(rows.filter(row=>row.id.startsWith('higood-finished-inventory/'))).toHaveLength(0);expect(rows.filter(row=>!row.deleted&&row.value?.inventoryApplicationId?.startsWith('FI-APP-MOCK-'))).toHaveLength(0)
})
test('Mock待办从现有节点继续实收、QC、包装、交出、返仓接收、上架及返工接收，刷新保留',async({page},info)=>{
 test.setTimeout(120000)
 page.on('dialog',dialog=>dialog.accept())
 await page.addInitScript(()=>localStorage.setItem('higood-fcs-post-finishing-current-actor-v1','PF-USER-QC-MGR'))
 const pending=app('待后道实收')
 await page.goto(POST+'?id='+encodeURIComponent(pending.id))
 const receive=page.locator('[data-fiq-form="receive"]');await expect(receive).toBeVisible()
 for(const line of pending.lines)await receive.locator(`[data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty))
 await inventoryClick(page,'Mock待收记录实际接收',receive.getByRole('button',{name:'确认整批实收并形成库存QC'}),()=>expect(page.getByRole('link',{name:'进入后道原质检工作台'})).toBeVisible())
 await page.goto(WLS+'?id='+encodeURIComponent(pending.id));await expect(page.locator('[data-fiq-form="receive"]')).toHaveCount(0);await expect(page.getByText('待完成QC',{exact:true})).toBeVisible()
 const waiting=app('待质检');await page.goto(POST+'?id='+encodeURIComponent(waiting.id));await page.getByRole('link',{name:'进入后道原质检工作台'}).click();await page.getByRole('button',{name:'领取并固定本次检查要求'}).click()
 let remaining=Math.ceil(waiting.lines.reduce((n,row)=>n+row.receivedQty!,0)*0.3)
 for(const line of waiting.lines){const amount=Math.min(remaining,line.receivedQty!);remaining-=amount;await fillPostQcRow(page.locator(`[data-qc-result-line="${line.skuId}"]`),amount)}
 await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click();for(const item of await page.locator('[data-qc-process-item]').all())await item.uncheck()
 await inventoryClick(page,'Mock待检记录完成QC',page.getByRole('button',{name:'确认完成QC并生成对应去向'}),()=>expect(page.locator('[data-fiq-form="ship"]')).toHaveCount(1))
 const processing=app('待后道加工（熨烫已完成）'),task=mock.post.postTasks.find(row=>row.inventoryApplicationId===processing.id)!
 await page.goto('/fcs/craft/post-finishing/work-orders/'+encodeURIComponent(task.postTaskId));await expect(page.locator('[data-web-post-task]')).toContainText('成衣库存质检');await page.getByRole('button',{name:'登记包装',exact:true}).click()
 const form=page.locator('[data-post-entry-form]');for(const line of task.lines)await form.locator(`[data-post-entry-line="${line.sku.skuId}"] [data-post-entry-quantity]`).fill(String(line.expectedQty))
 await inventoryClick(page,'Mock包装完成并回写',form.getByRole('button',{name:'保存本次完成',exact:true}),()=>expect(form).toHaveCount(0));await page.reload();await expect(page.locator('[data-web-post-task]')).toContainText('后道完成')
 const direct=app('待分类交出（无需加工）'),normal=mock.inventory.transfers.find(row=>row.applicationId===direct.id&&row.category==='正常返仓')!
 await page.goto(POST+'?id='+encodeURIComponent(direct.id));const shipping=page.locator(`[data-fiq-form="ship"][data-transfer-id="${normal.id}"]`)
 await inventoryClick(page,'Mock正常货整批交出',shipping.getByRole('button'),()=>expect(shipping).toHaveCount(0))
 const inbound=app('待返仓接收'),inboundTransfer=mock.inventory.transfers.find(row=>row.applicationId===inbound.id&&row.category==='正常返仓')!
 await page.goto('/wls/finished/pre-inbound');const receiving=page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${inboundTransfer.id}"]`)
 for(const line of inboundTransfer.lines)await receiving.locator(`[data-sku-id="${line.skuId}"]`).fill(String(line.quantity))
 await inventoryClick(page,'Mock返仓待收记录实收',receiving.getByRole('button'),()=>expect(receiving).toHaveCount(0))
 const putaway=app('待返仓上架'),putawayTransfer=mock.inventory.transfers.find(row=>row.applicationId===putaway.id&&row.category==='正常返仓')!
 await page.goto('/wls/finished/putaway');const shelving=page.locator(`[data-fiq-form="putaway"][data-transfer-id="${putawayTransfer.id}"]`)
 await expect(shelving).toBeVisible();await expect(shelving.locator('select')).toHaveCount(putawayTransfer.lines.length)
 for(const select of await shelving.locator('select').all())await select.selectOption({index:1})
 await inventoryClick(page,'Mock待上架记录上架',shelving.getByRole('button'),()=>expect(shelving).toHaveCount(0))
 const rework=app('待goto_global返工接收');await page.goto('/fcs/production/inventory-rework-receipts?id='+encodeURIComponent(rework.id));const returning=page.locator('[data-fiq-form="receive-transfer"]')
 const reworkTransfer=mock.inventory.transfers.find(row=>row.applicationId===rework.id&&row.category==='返工交接')!;for(const line of reworkTransfer.lines)await returning.locator(`[data-sku-id="${line.skuId}"]`).fill(String(line.quantity))
 await inventoryClick(page,'Mock返工待收记录接收完成',returning.getByRole('button'),()=>expect(page.getByText('已完成',{exact:true}).first()).toBeVisible())
 await page.reload();await expect(page.getByText('已完成',{exact:true}).first()).toBeVisible()
 const rows=await saved(page);expect(rows.find(row=>row.value?.id===rework.id)?.value.completedAt).toBeTruthy();expect(rows.find(row=>row.value?.id===processing.id)?.value.postCompletedAt).toBeTruthy()
 await page.screenshot({path:info.outputPath('mock-continued-and-saved.png'),fullPage:true});await saveInventoryTimings(page,info)
})
