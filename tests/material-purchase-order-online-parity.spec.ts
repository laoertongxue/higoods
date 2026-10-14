import { test, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pmsBusinessNumber } from '../src/utils/pms-business-number.ts'

const route='/pms/material-purchase-orders'
const evidence=process.env.MPO_PARITY_EVIDENCE||'output/playwright/mpo-parity-20261014'
const root='[data-pms-mpo-root]'
const dialog='[data-mpo-parity-dialog]'
const button=(name:string)=>`[data-pms-mpo-action="parity-${name}"]`
const performanceSamples:Array<{family:string;milliseconds:number;viewport:string;scale:string}>=[]
test.beforeEach(async({page})=>{await page.addInitScript(()=>{document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('button'))(window as any).__mpoParityEventStart=performance.now()},true);document.addEventListener('keydown',event=>{if(event.key==='Escape')(window as any).__mpoParityEventStart=performance.now()},true);document.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement&&event.target.type==='file')(window as any).__mpoParityEventStart=performance.now()},true);document.addEventListener('change',event=>{if(event.target instanceof HTMLInputElement&&event.target.type==='file')(window as any).__mpoParityEventStart=performance.now()},true)})})
async function measured(page:Page,family:string,scale='2 SKU',start:'click'|'navigation'='click'){
 if(process.env.MPO_PARITY_PERF!=='1')return
 await imagesReady(page);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 const ms=await page.evaluate(start=>{const begin=start==='navigation'?0:(window as any).__mpoParityEventStart;if(begin===undefined)throw Error('Missing real event start');return performance.now()-begin},start)
 performanceSamples.push({family,milliseconds:ms,viewport:`${page.viewportSize()!.width}×${page.viewportSize()!.height}`,scale})
 mkdirSync(evidence,{recursive:true});writeFileSync(`${evidence}/performance-${test.info().line}-${test.info().repeatEachIndex}.json`,JSON.stringify(performanceSamples,null,2))
 expect(ms,`${family} complete response`).toBeLessThanOrEqual(1000)
}
const records=async(page:Page,store:string)=>page.evaluate(async(store)=>new Promise<any[]>((resolve,reject)=>{const open=indexedDB.open('higood-pms');open.onupgradeneeded=()=>{open.transaction?.abort();reject(Error('Readonly evidence cannot initialize data'))};open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction(store,'readonly'),request=tx.objectStore(store).getAll();let rows:any[]=[];request.onsuccess=()=>rows=request.result;tx.oncomplete=()=>{db.close();resolve(rows)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)}}}),store)
async function ready(page:Page){await expect(page.locator(`${root} h1`)).toHaveText('面辅料采购单');await expect(page.locator('[data-pms-mpo-table-surface] tbody tr').first()).toBeVisible()}
async function imagesReady(page:Page,scope=root){await expect.poll(()=>page.locator(scope).evaluate(el=>[...el.querySelectorAll('img')].filter(img=>img.getBoundingClientRect().width>0).every(img=>img.complete&&img.naturalWidth>0))).toBe(true)}
async function save(page:Page){const family=await page.locator(dialog).getAttribute('aria-label');await page.locator(button('save')).click();await expect(page.locator(dialog)).toHaveCount(0);await expect(page.locator('[data-pms-mpo-feedback]')).toContainText('已保存');await records(page,'pmsMaterialPurchaseOrderDeltas');await measured(page,`保存：${family}`)}
async function create(page:Page){
 await page.locator(`${button('new')}[data-purchase-kind="面料"]`).click()
 const form=page.locator('[data-mpo-parity-form]')
 await form.locator('[name="supplierName"]').selectOption('SUP-2026-0001');await form.locator('[name="warehouse"]').selectOption('中央总仓-面料仓')
 await form.locator('[name="spu"]').selectOption('CNIDML360');await page.locator(button('load-skus')).click();await measured(page,'载入 SPU 的 SKU','4 SKU / 图片')
 for(let i=0;i<2;i++){const row=form.locator('[data-parity-line]').nth(i);await row.locator('[name="selected"]').check();await row.locator('[name="quantity"]').fill(String((i+1)*100));await row.locator('[name="plannedRolls"]').fill(String(i+1));await row.locator('[name="unitPrice"]').fill(String(i+3));await row.locator('[name="weightKg"]').fill('0.2');await row.locator('[name="volumeM3"]').fill('0.001')}
 await form.locator('[name="remark"]').fill('采购对齐浏览器验证')
 await page.locator(button('load-skus')).click();await expect(form.locator('[data-parity-line]').first().locator('[name="quantity"]')).toHaveValue('100');await save(page)
 const orders=await records(page,'pmsMaterialPurchaseOrderDeltas'),order=orders.find(row=>row.remark==='采购对齐浏览器验证')
 expect(order.lines).toHaveLength(2);expect(order.lines[0].weightKg).toBe(0.2);expect(order.lines[0].volumeM3).toBe(0.001)
 return order
}
async function filterOrder(page:Page,code:string){await page.locator('[data-pms-mpo-field="keyword"]').fill(code);await page.locator('[data-pms-mpo-action="query"]').click();await expect(page.locator('[data-pms-mpo-table-surface] tbody tr')).toHaveCount(1);await measured(page,'查询与统计','9 主单 / 1 匹配')}
async function selectOrder(page:Page,no:string){await page.locator(`[data-pms-mpo-field="select-row"][data-order-no="${no}"]`).check()}
async function rowAction(page:Page,no:string,name:string){const row=page.locator('[data-pms-mpo-table-surface] tbody tr').filter({has:page.locator(`[data-order-no="${no}"]`)});await row.locator(button('row-menu')).click();await expect(page.locator('[data-mpo-row-menu]')).toBeVisible();await measured(page,'行操作菜单',`${await page.locator('[data-mpo-row-menu] button').count()} 个操作`);await page.locator('[data-mpo-row-menu]').locator(button(name==='field'?'note':name)).click();if(!['print','copy','convert-raw','convert-accessory'].includes(name)){await expect(page.locator(dialog)).toBeVisible();await measured(page,`打开：${await page.locator(dialog).getAttribute('aria-label')}`)}}

test('多SKU采购：实采、物流、抽检凭证、分SKU入库、刷新、导出和打印',async({page})=>{
 mkdirSync(evidence,{recursive:true});await page.setViewportSize({width:1366,height:768});await page.goto(route);await ready(page);await measured(page,'首次访问','8 主单 / 5 行','navigation')
 const order=await create(page);await filterOrder(page,order.lines[1].materialCode);await selectOrder(page,order.purchaseOrderNo)
 await page.locator(button('placed')).click();await page.getByRole('button',{name:'设置为已下单',exact:true}).click();await expect(page.locator('[data-pms-mpo-table-surface]')).toContainText('已下单');await records(page,'pmsMaterialPurchaseOrderDeltas');await measured(page,'保存下单事实')
 await rowAction(page,order.purchaseOrderNo,'logistics')
 const form=page.locator('[data-mpo-parity-form]');await form.locator('[name="company"]').fill('本地测试物流');await form.locator('[name="trackingNo"]').fill('PARITY-SHIP-001');await form.locator('[name="shipDate"]').fill('2026-10-14');await form.locator('[name="estimatedArrival"]').fill('2026-10-17');await form.locator('[name="fee"]').fill('12')
 for(let i=0;i<2;i++){const line=form.locator('[data-parity-shipment]').nth(i);await line.locator('[name="selected"]').check();await line.locator('[name="quantity"]').fill(String((i+1)*110));await line.locator('[name="actualPurchasedQty"]').fill(String((i+1)*110));await line.locator('[name="rolls"]').fill(String(i+1));await line.locator('[name="actualPurchasedRolls"]').fill(String(i+1))}
 await save(page)
 let stored=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo)
 expect(stored.lines.map((line:any)=>line.actualPurchasedQty)).toEqual([110,220]);expect(stored.lines.every((line:any)=>line.priceConfirmed)).toBe(true)
 const shipments=(await records(page,'pmsPurchaseTracking')).filter(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(shipments).toHaveLength(2);expect(shipments.reduce((sum,row)=>sum+row.fee,0)).toBe(12)
 await page.locator(`[data-pms-mpo-action="open-detail"][data-order-no="${order.purchaseOrderNo}"]`).last().click()
 await page.locator(`${button('quantity')}[data-stage="sellerReceived"]`).click()
 for(let i=0;i<2;i++)await form.locator('[data-parity-line]').nth(i).locator('[name="value"]').fill(String((i+1)*110))
 await save(page)
 await rowAction(page,order.purchaseOrderNo,'inspection')
 await form.locator('[name="purchaseLineId"]').selectOption(order.lines[0].lineId);await form.locator('[name="sampleQty"]').fill('10');await form.locator('[name="defectQty"]').fill('1');await form.locator('[name="conclusion"]').selectOption('部分合格');await form.locator('[name="labelLength"]').fill('100');await form.locator('[name="actualLength"]').fill('98');await form.locator('[name="remark"]').fill('局部瑕疵检查')
 const asset=path.join('public',order.lines[0].imageUrl),bytes=readFileSync(asset)
 await form.locator('[name="files"]').setInputFiles({name:'抽检物料.jpg',mimeType:'image/jpeg',buffer:bytes});await save(page)
 await rowAction(page,order.purchaseOrderNo,'attachment');await form.locator('[name="transferDate"]').fill('2026-10-14');await form.locator('[name="transferFee"]').fill('25');await form.locator('[name="files"]').setInputFiles([{name:'转运凭证1.jpg',mimeType:'image/jpeg',buffer:bytes},{name:'转运凭证2.jpg',mimeType:'image/jpeg',buffer:bytes}]);await save(page)
 await page.locator(button('inbound')).click()
 for(let i=0;i<2;i++){const row=form.locator('[data-parity-inbound='+JSON.stringify(shipments.find(row=>row.purchaseLineId===order.lines[i].lineId).recordNo)+']');await row.locator('[name="selected"]').check();await row.locator('[name="quantity"]').fill(String((i+1)*110));await row.locator('[name="warehouse"]').selectOption('中央总仓-面料仓')}
 await save(page)
 stored=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo)
 expect(stored.status).toBe('已入库');expect(stored.lines.map((line:any)=>line.inboundQty)).toEqual([110,220]);expect(stored.inventoryPostings.reduce((sum:number,post:any)=>sum+post.qty,0)).toBe(330);expect(stored.inventoryPostings.find((post:any)=>post.quality==='瑕疵').qty).toBe(1)
 expect(stored.inspections[0].shortageRate).toBe(2);expect(stored.transferVouchers[0].fileIds).toHaveLength(2)
 await page.reload();await ready(page);await measured(page,'刷新回读','9 主单 / 5 行','navigation');await filterOrder(page,order.lines[1].materialCode)
 await page.locator('[data-process-filter-toggle]').click().catch(()=>page.getByRole('button',{name:/更多筛选/}).click())
 await page.locator('[data-pms-mpo-field="date:inboundFrom"]').fill('2026-10-14');await page.locator('[data-pms-mpo-field="date:inboundTo"]').fill('2026-10-14');await page.locator('[data-pms-mpo-action="query"]').click();await expect(page.locator('[data-pms-mpo-table-surface] tbody tr')).toHaveCount(1)
 await page.locator(`[data-pms-mpo-action="open-detail"][data-order-no="${order.purchaseOrderNo}"]`).last().click();await expect(page.locator('[data-pms-mpo-detail-root]')).toContainText('SKU 抽检结果');await expect(page.locator('[data-pms-mpo-detail-root]')).toContainText('空差率 2.00%');await expect(page.locator('[data-pms-mpo-detail-root]')).toContainText('凭证转运费用 25.00');await imagesReady(page,'[data-pms-mpo-detail-root]');await measured(page,'打开采购详情','2 SKU / 20字段 / 图片 / 3附件');await page.screenshot({path:`${evidence}/flow-detail-1366.png`})
 await page.locator('[data-pms-mpo-detail-root] header [data-pms-mpo-action="close-overlay"]').click()
 await rowAction(page,order.purchaseOrderNo,'defect');await form.locator('[name="purchaseLineId"]').selectOption(order.lines[1].lineId);await form.locator('[name="defectQty"]').fill('1');await form.locator('[name="remark"]').fill('追加瑕疵事实核验');await save(page);const disposed=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(disposed.defectDisposals).toHaveLength(1);expect(disposed.inventoryPostings.reduce((sum:number,row:any)=>sum+row.qty,0)).toBe(330)
 await rowAction(page,order.purchaseOrderNo,'price');await form.locator('[data-parity-line]').first().locator('[name="value"]').fill('3.2');await save(page);const priced=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(priced.lines[0].unitPrice).toBe(3.2);expect(priced.inventoryPostings).toEqual(stored.inventoryPostings);expect(priced.status).toBe('已入库')
 for(const kind of ['订单明细','订单','结算单','原料入库']){await page.locator('[data-mpo-export-kind]').selectOption(kind);const downloadPromise=page.waitForEvent('download');await page.locator('[data-pms-mpo-action="export"]').click();const download=await downloadPromise;const destination=`${evidence}/export-${kind}.csv`;await download.saveAs(destination);const csv=readFileSync(destination,'utf8');expect(csv).toContain(kind==='订单'?pmsBusinessNumber(order.purchaseOrderNo):order.lines[1].materialCode);expect(csv.split('\n')[0].split(',')).not.toContain('操作');await measured(page,`导出：${kind}`)}
 const popupPromise=page.context().waitForEvent('page');await rowAction(page,order.purchaseOrderNo,'print');const popup=await popupPromise;await popup.waitForLoadState();await expect(popup.getByRole('heading',{name:'面辅料采购单'})).toBeVisible();await imagesReady(popup,'body');expect(await popup.locator('tbody tr').count()).toBe(2);await popup.screenshot({path:`${evidence}/print-purchase.png`});await measured(page,'采购打印预览','2 SKU / 对应原图');await popup.close()
 writeFileSync(`${evidence}/flow-persisted.json`,JSON.stringify({orderNo:order.purchaseOrderNo,lines:stored.lines,postings:stored.inventoryPostings,inspections:stored.inspections,vouchers:stored.transferVouchers},null,2))
})

test('表单图片预览保持输入，取消与保存中止无写入，1366/1280布局不溢出',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await page.goto(route);await ready(page);expect(await records(page,'pmsMaterialPurchaseOrderDeltas')).toHaveLength(0)
 await page.locator(`${button('new')}[data-purchase-kind="面料"]`).click();const form=page.locator('[data-mpo-parity-form]');await form.locator('[name="spu"]').selectOption('CNIDML360');await page.locator(button('load-skus')).click();await form.locator('[name="remark"]').fill('未保存的采购备注');await imagesReady(page,dialog)
 await form.locator('[data-parity-line]').first().locator('img').click();await expect(page.locator('[data-pms-image-preview]')).toBeVisible();await measured(page,'物料原图预览','对应实际素材');await page.keyboard.press('Escape');await expect(form.locator('[name="remark"]')).toHaveValue('未保存的采购备注')
 await page.locator(button('save')).click();await expect(page.locator('[data-parity-error]')).toContainText('至少选择一个');await expect(form.locator('[name="remark"]')).toHaveValue('未保存的采购备注');expect(await records(page,'pmsMaterialPurchaseOrderDeltas')).toHaveLength(0);await measured(page,'保存校验阻断','未选 SKU / 不写入')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/form-1280.png`})
 await page.locator(button('close')).first().click();await page.getByRole('button',{name:'放弃修改',exact:true}).click();await expect(page.locator(dialog)).toHaveCount(0);expect(await records(page,'pmsMaterialPurchaseOrderDeltas')).toHaveLength(0);await measured(page,'放弃未保存修改','取消 / 不写入')
 const order=await create(page);await filterOrder(page,order.lines[0].materialCode);await rowAction(page,order.purchaseOrderNo,'field');await form.locator('[name="value"]').fill('保留失败输入')
 await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;let fail=true;IDBDatabase.prototype.transaction=function(...args:any[]){const tx=original.apply(this,args as any);if(fail&&this.name==='higood-pms'&&args[1]==='readwrite'){fail=false;queueMicrotask(()=>tx.abort())}return tx}})
 await page.locator(button('save')).click();await expect(page.locator('[data-parity-error]')).toBeVisible();await expect(form.locator('[name="value"]')).toHaveValue('保留失败输入');const stored=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(stored.remark).toBe('采购对齐浏览器验证');await measured(page,'事务失败保留输入','readwrite abort / 不假成功')
})

test('主入口与条件动作可达，查询排序及两页演示保持',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await page.goto(route);await ready(page);await expect(page.locator('[data-pms-mpo-pagination-surface]')).toContainText('1 / 2')
 const labels=['批量设置采购员','批量驳回','批量采购备注','批量设置采购区域','批量设置面辅料供应商','批量添加快递','批量补录快递','批量确认实际采购价','批量设置为已下单']
 for(const label of labels){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('[data-pms-mpo-feedback]')).toContainText('选择要操作的采购单')}
 await selectOrder(page,'CGF-2026-0001')
 for(const name of ['field','price','logistics']){await page.locator(button(name)).first().click();await expect(page.locator(dialog)).toBeVisible();await page.locator(button('close')).first().click()}
 for(const name of ['inbound','logistics-select']){await page.locator(button(name)).click();await expect(page.locator(dialog)).toBeVisible();await page.locator(button('close')).first().click()}
 for(const name of ['logs','inspection','attachment','edit']){await rowAction(page,'CGF-2026-0001',name);await expect(page.locator(dialog)).toBeVisible();await page.locator(button('close')).first().click()}
 const fields=await page.locator('[data-pms-mpo-field="keywordField"] option').allTextContents();expect(fields).toEqual(expect.arrayContaining(['商品识别码','申请人','选品人','物料 SPU','源采购单']))
 await page.locator('[data-pms-mpo-field="listSort"]').selectOption('create-desc');await page.locator('[data-pms-mpo-action="query"]').click();await expect(page.locator('[data-pms-mpo-table-surface]')).toBeVisible();await measured(page,'排序结果','8 主单')
 await page.locator('[data-pms-mpo-action="reset"]').click();await expect(page.locator('[data-pms-mpo-field="listSort"]')).toHaveValue('');await measured(page,'重置查询','8 主单 / 全部统计')
 await imagesReady(page);await page.screenshot({path:`${evidence}/list-1366.png`})
})


test('其余对齐操作：批量字段、分类建单、复制转换驳回与20行文件导入',async({page})=>{
 await page.goto(route);await ready(page)
 const order=await create(page);await filterOrder(page,order.lines[0].materialCode);await selectOrder(page,order.purchaseOrderNo)
 const form=page.locator('[data-mpo-parity-form]')
 const updates=[['buyerName','李采购'],['remark','批量备注回读'],['purchaseRegion','印尼'],['supplierName','SUP-2026-0001']]
 for(const [key,value] of updates){
  await page.locator(`${button('field')}[data-field="${key}"]`).first().click()
  const input=form.locator(key==='supplierName'?'[name="supplierName"]':'[name="value"]')
  if(key==='supplierName'||key==='purchaseRegion')await input.selectOption(value);else await input.fill(value)
  await save(page)
  const stored=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo)
  if(key==='supplierName')expect(stored.supplierName).toBeTruthy();else expect(stored[key]).toBe(value)
 }
 for(const [name,key,value] of [['cutting-factory','cuttingFactory','裁片工厂 A'],['printing-factory','printingFactory','印花工厂 B'],['printing-process','printingProcess','活性印染'],['dye','dyeFee','20']]){
  await rowAction(page,order.purchaseOrderNo,name);await form.locator('[name="value"]').fill(value);await save(page)
  const stored=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(String(stored[key])).toBe(value)
 }
 await rowAction(page,order.purchaseOrderNo,'convert-raw');await page.getByRole('button',{name:'转原料',exact:true}).click();expect((await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo).materialType).toBe('原料');await measured(page,'确认分类转换')
 await rowAction(page,order.purchaseOrderNo,'convert-accessory');await page.getByRole('button',{name:'转辅料',exact:true}).click();expect((await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo).materialType).toBe('辅料');await measured(page,'确认分类转换')
 await rowAction(page,order.purchaseOrderNo,'edit');await form.locator('[name="usageType"]').selectOption('样衣做货');await form.locator('[name="supplementReason"]').fill('用途核验');await form.locator('[name="dedicatedSpu"]').fill('DEDICATED-001');await form.locator('[data-parity-line]').first().locator('[name="weightKg"]').fill('0.25');await form.locator('[data-parity-line]').first().locator('[name="volumeM3"]').fill('0.002');await save(page)
 const edited=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(edited.usageType).toBe('样衣做货');expect(edited.lines[0].weightKg).toBe(0.25);expect(edited.lines[0].volumeM3).toBe(0.002)
 await page.getByRole('button',{name:'批量补录快递',exact:true}).click();await form.locator('[name="company"]').fill('补录物流');await form.locator('[name="trackingNo"]').fill('SUPPLEMENT-ONLY');await form.locator('[name="shipDate"]').fill('2026-10-14');await form.locator('[data-parity-shipment]').first().locator('[name="selected"]').check();await form.locator('[data-parity-shipment]').first().locator('[name="quantity"]').fill('2');await form.locator('[data-parity-shipment]').first().locator('[name="actualPurchasedQty"]').fill('100');await save(page)
 const supplement=(await records(page,'pmsPurchaseTracking')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo&&row.trackingNo==='SUPPLEMENT-ONLY');expect(supplement.qty).toBe(2)
 await page.locator(button('logistics-select')).click();await form.locator(`[data-record-no="${supplement.recordNo}"]${button('logistics')}`).click();await form.locator('[name="trackingNo"]').fill('SUPPLEMENT-EDIT');await save(page);expect((await records(page,'pmsPurchaseTracking')).find(row=>row.recordNo===supplement.recordNo).trackingNo).toBe('SUPPLEMENT-EDIT')
 await page.locator(button('logistics-select')).click();await form.locator(`[data-record-no="${supplement.recordNo}"]${button('delete-logistics')}`).click();await page.getByRole('button',{name:'删除物流记录',exact:true}).click();await expect(page.locator('[data-pms-mpo-feedback]')).toContainText('物流记录已删除');expect((await records(page,'pmsPurchaseTracking')).find(row=>row.recordNo===supplement.recordNo)?.deleted).toBe(true);await measured(page,'删除未执行物流并回读');await page.locator(button('close')).first().click()
 await rowAction(page,order.purchaseOrderNo,'copy');await page.getByRole('button',{name:'复制采购单',exact:true}).click();const copy=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.sourceCopyOrderNo===order.purchaseOrderNo);expect(copy.lines).toHaveLength(2);expect(copy.lines.every((line:any)=>line.actualPurchasedQty===0&&!line.priceConfirmed)).toBe(true);await measured(page,'复制计划并保存')
 await page.locator('[data-pms-mpo-action="open-import"]').click();await expect(page.locator('[data-pms-mpo-import-root]')).toBeVisible()
 const csv=['采购单号,SKU,物流公司,物流单号,发货日期,预计到达日期,箱数,卷数,数量,运费,备注',...Array.from({length:20},(_,i)=>[pmsBusinessNumber(order.purchaseOrderNo),order.lines[i%2].materialCode,'文件物流',`CSV-PARITY-${i}`,'2026-10-14','2026-10-17',1,1,2,1,'文件批量验证'].join(','))].join('\n')
 await page.locator('[data-pms-mpo-field="import-file"]').setInputFiles({name:'20行多SKU快递.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
 await expect(page.locator('[data-pms-mpo-import-root]')).toContainText('共解析 20 行');await expect(page.locator('[data-pms-mpo-action="submit-import"]')).toBeEnabled();await measured(page,'文件导入解析与预览','20 CSV 行 / 多SKU')
 await page.locator('[data-pms-mpo-action="submit-import"]').click();await expect(page.locator('[data-pms-mpo-feedback]')).toContainText('已导入 20 条');expect((await records(page,'pmsPurchaseTracking')).filter(row=>row.purchaseOrderNo===order.purchaseOrderNo&&!row.deleted)).toHaveLength(20);await measured(page,'文件导入原子保存','20 物流记录 / 多SKU')
 await page.reload();await ready(page);await page.locator('[data-pms-mpo-field="keyword"]').fill(pmsBusinessNumber(copy.purchaseOrderNo));await page.locator('[data-pms-mpo-action="query"]').click();await expect(page.locator('[data-pms-mpo-table-surface] tbody tr')).toHaveCount(1)
 const exactCopyRow=page.locator('[data-pms-mpo-table-surface] tbody tr').filter({has:page.locator(`[data-pms-mpo-field="select-row"][data-order-no="${copy.purchaseOrderNo}"]`)});await exactCopyRow.locator(button('row-menu')).click();await page.locator('[data-mpo-row-menu]').locator(button('reject')).click();await form.locator('[name="value"]').fill('供应方无法交付');await save(page);expect((await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===copy.purchaseOrderNo).rejectedReason).toBe('供应方无法交付')
 await page.locator('[data-pms-mpo-action="reset"]').click()
 for(const kind of ['物料','辅料']){
  await page.locator(`${button('new')}[data-purchase-kind="${kind}"]`).click();await form.locator('[name="supplierName"]').selectOption('SUP-2026-0001');await form.locator('[name="warehouse"]').selectOption('中央总仓-面料仓')
  const spu=await form.locator('[name="spu"] option').nth(1).getAttribute('value');await form.locator('[name="spu"]').selectOption(spu!);await page.locator(button('load-skus')).click()
  const row=form.locator('[data-parity-line]').first();await row.locator('[name="selected"]').check();await row.locator('[name="quantity"]').fill('10');await row.locator('[name="unitPrice"]').fill('2');await form.locator('[name="remark"]').fill(`${kind}采购核验`);await save(page)
  expect((await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.remark===`${kind}采购核验`).materialType).toBe(kind)
 }
 await page.screenshot({path:`${evidence}/additional-actions.png`})
})


test('物流相邻动作与文件事件最终采样：五个有效循环',async({page})=>{
 await page.goto(route);await ready(page);const order=await create(page);await filterOrder(page,order.lines[0].materialCode);await selectOrder(page,order.purchaseOrderNo)
 const form=page.locator('[data-mpo-parity-form]')
 for(let i=0;i<5;i++){
  await rowAction(page,order.purchaseOrderNo,'edit');await form.locator('[name="usageType"]').selectOption('样衣做货');await form.locator('[name="supplementReason"]').fill('用途核验');await form.locator('[name="dedicatedSpu"]').fill('DEDICATED-001');await form.locator('[data-parity-line]').first().locator('[name="weightKg"]').fill('0.25');await form.locator('[data-parity-line]').first().locator('[name="volumeM3"]').fill('0.002');await save(page)
  const edited=(await records(page,'pmsMaterialPurchaseOrderDeltas')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo);expect(edited.usageType).toBe('样衣做货');expect(edited.lines[0].weightKg).toBe(0.25);expect(edited.lines[0].volumeM3).toBe(0.002)
  await page.getByRole('button',{name:'批量补录快递',exact:true}).click();await form.locator('[name="company"]').fill('补录物流');await form.locator('[name="trackingNo"]').fill(`SUPPLEMENT-FINAL-${i}`);await form.locator('[name="shipDate"]').fill('2026-10-14');await form.locator('[data-parity-shipment]').first().locator('[name="selected"]').check();await form.locator('[data-parity-shipment]').first().locator('[name="quantity"]').fill('2');await form.locator('[data-parity-shipment]').first().locator('[name="actualPurchasedQty"]').fill('100');await save(page)
  const supplement=(await records(page,'pmsPurchaseTracking')).find(row=>row.purchaseOrderNo===order.purchaseOrderNo&&row.trackingNo===`SUPPLEMENT-FINAL-${i}`);expect(supplement.qty).toBe(2)
  await page.locator(button('logistics-select')).click();await form.locator(`[data-record-no="${supplement.recordNo}"]${button('logistics')}`).click();await form.locator('[name="trackingNo"]').fill(`SUPPLEMENT-EDIT-${i}`);await save(page);expect((await records(page,'pmsPurchaseTracking')).find(row=>row.recordNo===supplement.recordNo).trackingNo).toBe(`SUPPLEMENT-EDIT-${i}`)
  await page.locator(button('logistics-select')).click();await form.locator(`[data-record-no="${supplement.recordNo}"]${button('delete-logistics')}`).click();await page.getByRole('button',{name:'删除物流记录',exact:true}).click();await expect(page.locator('[data-pms-mpo-feedback]')).toContainText('物流记录已删除');expect((await records(page,'pmsPurchaseTracking')).find(row=>row.recordNo===supplement.recordNo)?.deleted).toBe(true);await measured(page,'删除未执行物流并回读',`${i*20} 活跃装运记录`);await page.locator(button('close')).first().click()
  await page.locator('[data-pms-mpo-action="open-import"]').click()
  const csv=['采购单号,SKU,物流公司,物流单号,发货日期,预计到达日期,箱数,卷数,数量,运费,备注',...Array.from({length:20},(_,j)=>[pmsBusinessNumber(order.purchaseOrderNo),order.lines[j%2].materialCode,'文件物流',`FINAL-CSV-${i}-${j}`,'2026-10-14','2026-10-17',1,1,2,1,'文件批量验证'].join(','))].join('\n')
  await page.locator('[data-pms-mpo-field="import-file"]').setInputFiles({name:'20行多SKU快递.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  await expect(page.locator('[data-pms-mpo-import-root]')).toContainText('共解析 20 行');await expect(page.locator('[data-pms-mpo-action="submit-import"]')).toBeEnabled();await measured(page,'文件导入解析与预览','20 CSV 行 / 最终实文件 input事件')
  await page.locator('[data-pms-mpo-action="submit-import"]').click();await expect(page.locator('[data-pms-mpo-feedback]')).toContainText('已导入 20 条');expect((await records(page,'pmsPurchaseTracking')).filter(row=>row.purchaseOrderNo===order.purchaseOrderNo&&!row.deleted)).toHaveLength((i+1)*20);await measured(page,'文件导入原子保存',`20本次 / ${(i+1)*20}累计物流记录`)
 }
 await page.reload();await ready(page);await filterOrder(page,order.lines[0].materialCode);await page.locator(button('logistics-select')).click();await expect(form).not.toContainText('SUPPLEMENT-EDIT');await page.screenshot({path:`${evidence}/final-logistics-readback.png`})
})
