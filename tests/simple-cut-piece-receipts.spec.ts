import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import { GENERIC_PDA_SESSION, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

// Isolated downstream-view fixture, not evidence that the warehouse submission flow succeeded.
const events = Array.from({length: 23}, (_, i) => {
  const id = String(i + 1).padStart(2, '0')
  return {eventId:`WP05-EVENT-${id}`,eventNo:`WP05-EVENT-${id}`,eventType:'简易裁片交出',eventSource:i % 2 ? 'PDA':'WEB',eventStatus:'已记录',ledgerSequence:i+1,occurredAt:`2026-09-${i < 12 ? '15':'16'} 10:00:00`,createdAt:'2026-09-16 10:00:00',operatorId:'WP05-WAREHOUSE-USER',operatorName:'验收仓管',operatorRole:'WAREHOUSE',refs:{},payload:{schemaVersion:1,assignmentId:`WP05-ASG-${id}`,runtimeTaskId:`WP05-TASK-${id}`,taskNo:`WP05-TASK-${id}`,taskSheetNo:`WP05-SHEET-${id}`,taskSheetVersion:'1',taskTypeLabel:i % 2 ? '车缝+烫包':'车缝',productionOrderId:`WP05-PO-${id}`,productionOrderNo:`WP05-PO-${id}`,styleCode:'WP05-GREY-HOODIE',styleName:'灰色连帽拉链卫衣',styleImageUrl:'/production-confirmation-demo/grey-zip-hoodie.png',factoryId:'ID-F001',factoryName:'PT Sinar Garment Indonesia',ppicId:'WP05-PPIC',ppicName:'验收 PPIC',warehouseFactoryId:'CUTTING-TEST',handoverOrderId:`WP05-HO-${id}`,handoverOrderNo:`WP05-HO-${id}`,handoverRecordId:`WP05-HR-${id}`,handoverRecordNo:`WP05-HR-${id}`,requirementSnapshotId:`WP05-REQ-${id}`,requirementSnapshotAt:'2026-09-15 09:00:00',skuLines:[{skuCode:'WP05-SKU',color:'灰',size:'M',qty:10}],requirements:[{skuCode:'WP05-SKU',color:'灰',size:'M',partCode:'FRONT',partName:'前片',piecesPerGarment:1,allocatedGarmentQty:10}],tickets:[{feiTicketId:`WP05-FEI-${id}`,feiTicketNo:`WP05-FEI-${id}`,sourceOutputLineId:`WP05-OUTPUT-${id}`,cutOrderNo:'WP05-CUT',skuCode:'WP05-SKU',color:'灰',size:'M',partCode:'FRONT',partName:'前片',pieceRange:'1—4',pieceQty:4,unit:'片'}],totalPieceQty:4,receiptStatus:'RECEIVED',confirmationBasis:'WAREHOUSE_CONFIRMATION'}}
})
async function seed(page: import('@playwright/test').Page) {
  await seedLocalStorage(page, {cuttingRuntimeEventLedger:{events}, fcs_pda_factory_id:'ID-F001',fcs_pda_session:GENERIC_PDA_SESSION})
}
async function capture(page: import('@playwright/test').Page, name: string) {
  await fs.mkdir('output/playwright/wp05', {recursive:true})
  await page.screenshot({path:`output/playwright/wp05/${name}.png`,fullPage:true})
}
test('接收记录读取失败明确提示，不误报尚未接收',async({page})=>{
  test.setTimeout(180000)
  await seed(page)
  await page.addInitScript(()=>{
    const original=Storage.prototype.getItem
    Storage.prototype.getItem=function(key:string){
      if(key==='cuttingRuntimeEventLedger') throw new Error('验收存储不可读')
      return original.call(this,key)
    }
  })
  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('alert')).toContainText('裁片接收记录暂时无法读取',{timeout:120000})
  await expect(page.getByRole('alert')).toContainText('不能据此判断尚未接收')
  await capture(page,'storage-read-error')
})
for (const width of [1366,1024]) {
  test(`WP05 isolated Web ${width}: filters export paging details images`, async ({page}) => {
    await page.setViewportSize({width,height:768}); await seed(page)
    await page.goto('/fcs/craft/cutting/handover-orders')
    await expect(page.locator('[data-handover-list-root]')).toBeVisible({timeout:60000})
    await page.locator('[data-handover-filter-field="keyword"]').fill('WP05')
    await page.locator('[data-handover-filter-action="apply"]').click()
    await expect(page).toHaveURL(/q=WP05/)
    await expect(page.locator('[data-standard-list-table-section]')).toContainText('23 条')
    await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(20)
    await page.locator('[data-handover-list-action="next-page"]').click()
    await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(3)
    await page.locator('[data-handover-list-field="pageSize"]').selectOption('10')
    await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(10)
    await page.locator('[data-handover-list-action="settings"]').click()
    await expect(page.getByRole('heading',{name:'列设置',exact:true})).toBeVisible()
    await page.locator('[data-handover-list-action="visible"][data-key="production"]').click()
    await page.locator('[data-handover-list-action="close-settings"]').click()
    await expect(page.getByRole('heading',{name:'列设置',exact:true})).toHaveCount(0)
    await expect(page.locator('th').filter({hasText:'生产单'})).toHaveCount(0)
    await page.locator('[data-handover-filter-field="method"]').selectOption('简易裁片交出')
    await expect(page.locator('[data-handover-filter-field="method"]')).toHaveValue('简易裁片交出')
    await page.locator('[data-handover-filter-field="dateFrom"]').fill('2026-09-16')
    await expect(page.locator('[data-handover-filter-field="method"]')).toHaveValue('简易裁片交出')
    await page.locator('[data-handover-filter-action="apply"]').click()
    await expect.poll(() => new URL(page.url()).searchParams.get('method')).toBe('简易裁片交出')
    await expect(page.locator('[data-standard-list-table-section]')).toContainText('11 条')
    const downloadPromise = page.waitForEvent('download')
    await page.locator('[data-handover-list-action="export"]').click()
    const download = await downloadPromise
    await fs.mkdir('output/playwright/wp05', {recursive:true})
    await download.saveAs(`output/playwright/wp05/export-${width}.csv`)
    const csv = await fs.readFile((await download.path())!, 'utf8')
    expect(csv.trim().split('\n')).toHaveLength(12)
    expect(csv).toContain('验收 PPIC'); expect(csv).not.toContain('操作')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.reload()
    await expect(page.locator('[data-handover-filter-field="method"]')).toHaveValue('简易裁片交出')
    await expect(page.locator('[data-handover-list-field="pageSize"]')).toHaveValue('10')
    await expect(page.locator('th').filter({hasText:'生产单'})).toHaveCount(0)
    await page.locator('[data-handover-list-action="next-page"]').click()
    await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(1)
    await page.locator('[data-handover-list-action="prev-page"]').click()
    await capture(page,`web-list-${width}`)
    await page.goto('/fcs/craft/cutting/handover-records/WP05-HR-01')
    await expect(page.getByText('任务与接收信息',{exact:true})).toBeVisible()
    await expect(page.locator('body')).toContainText('WP05-SHEET-01')
    await expect(page.locator('body')).toContainText('验收仓管')
    await expect(page.locator('body')).toContainText('WP05-FEI-01')
    const image = page.locator('img[src="/production-confirmation-demo/grey-zip-hoodie.png"]').first()
    await expect(image).toBeVisible(); await expect.poll(()=>image.evaluate((img: HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true)
    await image.click(); await expect(page.locator('[data-pda-image-preview-root] [role="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape'); await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)
    await capture(page,`web-record-${width}`)
  })
}
for (const width of [360,390]) {
  test(`WP05 isolated PDA ${width}: received history and image details`, async ({page}) => {
    await page.setViewportSize({width,height:width===360?640:844}); await seed(page)
    await page.goto('/fcs/pda/handover?tab=pickup')
    await page.locator('[data-pda-handover-action="switch-tab"][data-tab="received"]').click()
    await expect(page.getByRole('heading',{name:'裁片接收记录',exact:true})).toBeVisible({timeout:60000})
    await expect(page.locator('[data-nav="/fcs/pda/handover/RECEIPT-WP05-HR-01"]')).toContainText('已接收')
    await capture(page,`pda-history-${width}`)
    await page.locator('[data-nav="/fcs/pda/handover/RECEIPT-WP05-HR-01"]').click()
    await expect(page.locator('[data-simple-cut-piece-receipt]')).toBeVisible()
    await expect(page.locator('[data-simple-cut-piece-receipt]')).toContainText('仓库确认即 PPIC 和工厂已接收')
    await expect(page.locator('[data-simple-cut-piece-receipt]')).toContainText('WP05-FEI-01')
    await expect(page.locator('[data-pda-handoverd-action="complete-pickup-head"]')).toHaveCount(0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.locator('[data-simple-cut-piece-receipt] img').click()
    await expect(page.locator('[data-pda-image-preview-root] [role="dialog"]')).toBeVisible()
    await page.locator('[data-pda-image-preview-close]').last().click()
    await capture(page,`pda-record-${width}`)
    await page.reload(); await expect(page.locator('[data-simple-cut-piece-receipt]')).toContainText('WP05-HR-01')
    await page.route('**/production-confirmation-demo/grey-zip-hoodie.png', route => route.abort())
    await page.reload(); await expect(page.getByText('图片加载失败，点击重试预览',{exact:true})).toBeVisible()
    await capture(page,`pda-image-failure-${width}`)
    await page.unroute('**/production-confirmation-demo/grey-zip-hoodie.png')
    await page.getByText('图片加载失败，点击重试预览',{exact:true}).click()
    const retryImage = page.locator('[data-pda-image-preview-root] img')
    await expect.poll(()=>retryImage.evaluate((img: HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true)
  })
}
