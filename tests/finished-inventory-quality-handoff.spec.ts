import { useEmptyInventoryQualityFixture } from './helpers/inventory-quality-empty-fixture.ts'
import inventoryMock from '../src/data/wls/finished-inventory-quality-mock.json' with {type:'json'}
import { writeFile } from 'node:fs/promises'
import { fillPostQcRow as checkRow } from './helpers/post-finishing-qc-form.ts'
import { expect, test, type Page, type Locator } from '@playwright/test'
import { inventoryClick, inventoryNavigation, saveInventoryTimings } from './helpers/inventory-quality-timing.ts'

test.use({ timezoneId:'Asia/Jakarta' })

const WLS = '/wls/finished/inventory-quality'
const POST = '/fcs/craft/post-finishing/inventory-quality'
const REWORK = '/fcs/production/inventory-rework-receipts'
async function snapshot(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const request = indexedDB.open('higood-pcs-records')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { return await new Promise((resolve, reject) => {
      const read = db.transaction('records').objectStore('records').getAll()
      read.onerror = () => reject(read.error)
      read.onsuccess = () => {
        const result: Record<string, any[]> = { lots: [], exclusions: [], applications: [], transfers: [], movements: [], differences: [], scopes: [], postTasks: [], processCompletions: [], qcTasks: [] }
        for (const row of read.result) if (!row.deleted && row.id.startsWith('higood-finished-inventory/')) {
          const collection = row.id.split('/')[1]
          if (result[collection]) result[collection].push(row.value)
        }
        for(const row of read.result) if(!row.deleted && row.id.startsWith('higood-fcs-post-finishing-records/flow/')) { const key=row.id.split('/')[2]; if(['postTasks','processCompletions','qcTasks'].includes(key))result[key].push(row.value) }
        resolve(result)
      }
    }) } finally { db.close() }
  })
}
async function receipt(form: Locator, short = 0) {
  await expect(form).toBeVisible()
  await expect(form.locator('input[name="quantity"]').first()).toBeVisible()
  for (const [index, input] of (await form.locator('input[name="quantity"]').all()).entries()) {
    const label = await input.locator('..').innerText()
    const expected = Number(label.match(/应交(\d+)件/)?.[1])
    expect(Number.isSafeInteger(expected)).toBeTruthy()
    await input.fill(String(expected - (index === 0 ? short : 0)))
  }
}
async function create(page: Page) {
  await inventoryNavigation(page, '冷启动即时库存', '/wls/finished/stock/realtime', async () => { await expect(page.getByRole('heading', { name: '即时库存查询 — 成衣', exact: true })).toBeVisible(); await expect(page.locator('tr').filter({hasText:'SKU-GC-20001'}).first().getByRole('link',{name:'本仓本款全部送检'})).toBeVisible() })
  await inventoryClick(page, '打开整批送检预览', page.locator('tr').filter({ hasText: 'SKU-GC-20001' }).first().getByRole('link', { name: '本仓本款全部送检' }), () => expect(page.getByRole('heading', { name: '确认整批库存送检' })).toBeVisible())
  await expect(page.getByRole('heading', { name: '确认整批库存送检' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '实际出库人' })).toHaveCount(0)
  await inventoryClick(page, '送检下架出库并回读', page.getByRole('button', { name: '确认下架出库 72 件' }), async () => { await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible(); expect((await snapshot(page)).applications).toHaveLength(1) })
  await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible()
  const app = (await snapshot(page)).applications[0]
  expect(app.createdBy).toBe('管理员')
  await expect(page.locator('[data-fiq-form="receive"]')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('待后道实收', { exact: true })).toBeVisible()
  expect((await snapshot(page)).applications).toHaveLength(1)
  return app
}
for (const withProcessing of [false,true]) test(`真实页面完成成衣仓送检、后道接收、QC升检、${withProcessing ? '勾选熨烫包装加工' : '不勾选直接出货'}、三去向交接和返仓上架`, async ({ page }, info) => {
  test.setTimeout(120_000)
  page.on('console', event => { if (event.type() === 'error') console.error('页面错误', event.text()) })
  page.on('pageerror', error => console.error('页面异常', error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.setViewportSize({ width: Number(process.env.INVENTORY_QC_VIEWPORT || 1366), height: 768 })
  // Existing current-account context; use a free QC account while the default static sample is in progress.
  await page.addInitScript(() => localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-QC-MGR'))
  console.log('回放节点：送检')
  const app = await create(page)
  // These two complete branches run against the real 13-application default
  // dataset. Other pending batches remain present throughout this own batch.
  await page.goto(WLS)
  await expect(page.getByRole('heading',{name:'成衣库存质检申请（14条）',exact:true})).toBeVisible()
  const initialMockNos=await page.locator('tbody a').filter({hasText:/^INVQC-/}).allTextContents()
  await page.getByRole('button',{name:'下一页',exact:true}).click()
  await expect(page.locator('tbody tr')).toHaveCount(4)
  initialMockNos.push(...await page.locator('tbody a').filter({hasText:/^INVQC-/}).allTextContents())
  expect(initialMockNos.filter(no=>no!==app.applicationNo).sort()).toEqual(inventoryMock.cases.map(row=>row.applicationNo).sort())
  await page.screenshot({path:info.outputPath('full-mock-baseline-second-page.png'),fullPage:true})
  await inventoryNavigation(page,'成衣出库列表直达','/wls/finished/outbound-orders',async()=>{
    await expect(page.getByRole('combobox',{name:'出库类型',exact:true})).toBeVisible()
    await expect(page.getByText('正在读取已保存的出库单',{exact:true})).toHaveCount(0)
    await expect(page.locator('[data-outbound-feedback] [role="alert"]')).toHaveCount(0)
  })
  await page.getByRole('combobox', { name: '出库类型', exact: true }).selectOption('成衣质检')
  await page.getByRole('textbox',{name:'搜索出库单号 / 关联单号 / 跟踪单号',exact:true}).fill(app.applicationNo)
  await inventoryClick(page,'成衣质检出库筛选',page.getByRole('button',{name:'搜索',exact:true}),()=>expect(page.locator('tbody tr')).toHaveCount(1))
  const outbound = page.locator('tr').filter({ hasText: `${app.applicationNo}-OUT` })
  await expect(outbound).toContainText('72 件')
  await expect(outbound).toContainText('已出库')
  await page.screenshot({ path: info.outputPath('inventory-quality-outbound.png'), fullPage: true })
  await outbound.getByRole('link', { name: '查看', exact: true }).click()
  await expect(page.getByText('管理员', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('link', { name: '查看关联成衣质检流转' })).toBeVisible()
  console.log('回放节点：后道接收')
  await inventoryNavigation(page,'后道收货列表直达',POST,()=>expect(page.getByRole('link',{name:app.applicationNo,exact:true})).toBeVisible())
  await expect(page.getByRole('heading', { name: '成衣质检收货与交接', exact: true })).toBeVisible()
  await page.getByRole('link', { name: app.applicationNo, exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const receive = page.locator('[data-fiq-form="receive"]')
  await receipt(receive)
  await page.screenshot({ path: info.outputPath('post-inventory-quality-receipt.png'), fullPage: true })
  await expect(receive.locator('[name="operator"]')).toHaveCount(0)
  await inventoryClick(page, '后道整批实收并回读', receive.getByRole('button', { name: '确认整批实收并形成库存QC' }), async () => { await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible(); expect((await snapshot(page)).applications[0].receivedAt).toBeTruthy() })
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-fiq-form="receive"]')).toHaveCount(0)
  const receivedQc=(await snapshot(page)).applications[0]
  await inventoryNavigation(page,'库存质检清单直达','/fcs/craft/post-finishing/qc-orders?sourceKind=WAREHOUSE_STOCK',()=>expect(page.locator('tbody tr').filter({hasText:receivedQc.qcTaskNo})).toContainText('成衣库存质检'))
  await page.goto(`${POST}?id=${encodeURIComponent(app.id)}`)
  console.log('回放节点：QC')
  await page.getByRole('link', { name: '进入后道原质检工作台' }).click()
  await inventoryClick(page, '领取库存质检', page.getByRole('button', { name: '领取并固定本次检查要求' }), () => expect(page.locator('[data-qc-workbench-task]')).toBeVisible())
  await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  const black = page.locator('[data-qc-result-line]').filter({ hasText: 'SKU-GC-20001' })
  const white = page.locator('[data-qc-result-line]').filter({ hasText: 'SPU-GC-1001-white-m' })
  console.log('回放节点：首轮检查')
  await checkRow(black, 18, 2, 2)
  await inventoryClick(page, '首轮检查触发稽查', page.getByRole('button', { name: '提交第1轮检查' }), () => expect(page.getByRole('heading', { name: '处理本轮稽查' })).toBeVisible())
  await expect(page.getByRole('heading', { name: '处理本轮稽查' })).toBeVisible()
  await page.locator('[data-qc-upgrade-percent]').selectOption('100')
  await page.locator('[data-qc-upgrade-note]').fill('本轮不合格达到门槛，本批提高到全检')
  await inventoryClick(page, '提高到全检', page.getByRole('button', { name: '确认提高检查比例' }), () => expect(page.getByText('本轮新增检查结果', { exact: true })).toBeVisible())
  await expect(page.getByText('本轮新增检查结果', { exact: true })).toBeVisible()
  await checkRow(black, 0)
  await checkRow(white, 50)
  await inventoryClick(page, '补检达到应检量', page.getByRole('button', { name: '提交第2轮检查' }), () => expect(page.getByRole('button', { name: '确认完成QC并生成对应去向' })).toBeVisible())
  await expect(page.getByRole('button', { name: '确认完成QC并生成对应去向' })).toBeVisible()
  if (withProcessing) { await page.locator('[data-qc-process-item][value="熨烫"]').check(); await page.locator('[data-qc-process-item][value="包装"]').check() }
  console.log('回放节点：完成QC')
  await inventoryClick(page, '完成QC并生成三去向', page.getByRole('button', { name: '确认完成QC并生成对应去向' }), async () => { await expect(page.locator('[data-fiq-form="ship"]')).toHaveCount(withProcessing ? 2 : 3); expect((await snapshot(page)).applications[0].qcCompletedAt).toBeTruthy() })
  await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible()
  if (withProcessing) {
    const afterQc = await snapshot(page), stock = afterQc.applications[0]
    expect(stock.postTaskId).toBeTruthy(); expect(afterQc.postTasks.filter((row: any)=>row.inventoryApplicationId===app.id)).toHaveLength(1)
    await page.goto(`${WLS}?id=${encodeURIComponent(app.id)}`)
    await expect(page.locator('[data-fiq-workspace] p.font-semibold.text-blue-800').first()).toHaveText('待后道加工')
    await page.getByRole('link',{name:'查看后道加工单'}).click()
    await expect(page.locator('[data-web-post-task]')).toContainText('业务类型：成衣库存质检')
    await page.reload()
    await expect(page.getByRole('button',{name:'登记熨烫',exact:true})).toBeVisible()
    for (const processItem of ['熨烫','包装']) {
      await page.getByRole('button',{name:`登记${processItem}`,exact:true}).click()
      const form = page.locator('[data-post-entry-form]')
      await expect(form).toBeVisible()
      for (const line of await form.locator('[data-post-entry-line]').all()) {
        const skuId = await line.getAttribute('data-post-entry-line')
        const quantity = afterQc.postTasks.find((row: any)=>row.inventoryApplicationId===app.id).lines.find((row: any)=>row.sku.skuId===skuId).expectedQty
        await line.locator('[data-post-entry-quantity]').fill(String(quantity))
      }
      if(processItem==='熨烫') await expect(page.getByRole('button',{name:'登记包装',exact:true})).toHaveCount(0)
      if(processItem==='包装') {
        await page.context().storageState({path:info.outputPath('inventory-before-pack.json'),indexedDB:true})
        await writeFile(info.outputPath('inventory-before-pack-reference.json'),JSON.stringify({postTaskId:stock.postTaskId,applicationId:app.id}))
        const before=await snapshot(page)
        await page.evaluate(()=>{ const original=IDBObjectStore.prototype.put;(window as any).__restoreInventoryPut=()=>{IDBObjectStore.prototype.put=original};IDBObjectStore.prototype.put=function(...args:Parameters<typeof original>){if(this.name==='records' && String(args[0]?.id).startsWith('higood-finished-inventory/applications/'))throw new DOMException('隔离加工投影保存失败','QuotaExceededError');return original.apply(this,args)} })
        await form.getByRole('button',{name:'保存本次完成',exact:true}).click()
        await expect(page.locator('[data-post-finishing-action-error]')).toBeVisible()
        expect(await snapshot(page)).toEqual(before)
        await expect(form).toBeVisible()
        await page.evaluate(()=>(window as any).__restoreInventoryPut())
      }
      await inventoryClick(page,`登记${processItem}完成并回读`,form.getByRole('button',{name:'保存本次完成',exact:true}),async()=>{await expect(form).toHaveCount(0);await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0);expect((await snapshot(page)).processCompletions.filter((row:any)=>row.postTaskId===stock.postTaskId && row.processItem===processItem)).toHaveLength(1)})
      if(processItem==='熨烫'){
        await page.goto(`${POST}?id=${encodeURIComponent(app.id)}`)
        await expect(page.locator('[data-fiq-form="ship"]')).toHaveCount(2)
        await expect(page.locator(`[data-fiq-form="ship"][data-transfer-id="${app.id}-正常返仓"]`)).toHaveCount(0)
        expect((await snapshot(page)).applications[0].postCompletedAt).toBeUndefined()
        await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(stock.postTaskId)}`)
        await expect(page.getByRole('button',{name:'登记包装',exact:true})).toBeVisible()
      }
    }
    const processed = await snapshot(page)
    expect(processed.applications[0].postCompletedAt).toBeTruthy()
    await page.reload()
    await expect(page.locator('[data-web-post-task]')).toContainText('后道完成')
    await inventoryNavigation(page,'库存后道加工列表直达','/fcs/craft/post-finishing/work-orders?sourceKind=WAREHOUSE_STOCK',()=>expect(page.locator('tbody tr').filter({hasText:stock.postTaskNo})).toHaveCount(1))
    await page.locator('select[name="factory"]').selectOption({label:afterQc.transfers.find((row:any)=>row.category==='正常返仓').sourceWarehouseName})
    await inventoryClick(page,'库存后道加工类型与工厂查询',page.getByRole('button',{name:'查询',exact:true}),async()=>{await expect(page).toHaveURL(/factory=/);await expect(page.locator('tbody tr').filter({hasText:stock.postTaskNo})).toHaveCount(1)})
    await expect(page.locator('tbody tr').filter({hasText:stock.postTaskNo})).toHaveCount(1)
    await expect(page.locator('tbody')).toContainText('成衣库存质检')
    await expect(page.locator('tbody')).not.toContainText('第 1 次回货')
    const beforePrint=await snapshot(page)
    await page.locator(`a[data-nav*="/post-finishing/print?type=POST_ORDER"]`).first().click()
    await expect(page.getByText('后道加工单流转卡',{exact:true})).toBeVisible()
    await expect(page.getByText('成衣库存质检',{exact:true})).toBeVisible()
    expect(await snapshot(page)).toEqual(beforePrint)
    await page.screenshot({path:info.outputPath('inventory-processing-print.png'),fullPage:true})
    await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(stock.postTaskId)}`)
    await inventoryClick(page,'库存后道出货列表站内进入',page.getByRole('link',{name:'进入后道出货单'}),()=>expect(page.locator('tbody tr').filter({hasText:app.applicationNo})).toHaveCount(3))
    const rows = page.locator('tbody tr').filter({hasText:app.applicationNo})
    await expect(rows).toHaveCount(3)
    await expect(rows.first()).toContainText('成衣库存质检')
    await rows.first().locator('a').first().click()
    await expect(page.getByText('业务类型：成衣库存质检',{exact:true})).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link',{name:'办理或查看分类交接'})).toBeVisible()
    await page.goto(`${POST}?id=${encodeURIComponent(app.id)}`)
  } else expect((await snapshot(page)).applications[0].postTaskId).toBeUndefined()
  await expect(page.locator('[data-fiq-form="ship"]')).toHaveCount(3)
  for (const id of await page.locator('[data-fiq-form="ship"]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.transferId!))) { const form = page.locator(`[data-fiq-form="ship"][data-transfer-id="${id}"]`); await inventoryClick(page, '分类整批交出', form.getByRole('button', { name: /确认整批交出/ }), async () => { await expect(form).toHaveCount(0); expect((await snapshot(page)).transfers.find((row: any) => row.id === id).shippedAt).toBeTruthy() }) }
  await expect(page.locator('[data-fiq-form="ship"]')).toHaveCount(0)
  console.log('回放节点：返仓接收')
  await page.goto('/wls/finished/pre-inbound')
  const ownReceipts=page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id^="${app.id}-"]`)
  await expect(ownReceipts).toHaveCount(2)
  for (const id of await ownReceipts.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.transferId!))) { const form = page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${id}"]`); await receipt(form); await inventoryClick(page, '返仓整批实收', form.getByRole('button', { name: /整批实收/ }), async () => { await expect(form).toHaveCount(0); expect((await snapshot(page)).transfers.find((row: any) => row.id === id).receivedAt).toBeTruthy() }) }
  console.log('回放节点：返仓上架')
  await page.goto('/wls/finished/putaway')
  const ownPutaways=page.locator(`[data-fiq-form="putaway"][data-transfer-id^="${app.id}-"]`)
  await expect(ownPutaways).toHaveCount(2)
  for (const id of await ownPutaways.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.transferId!))) {
    const form = page.locator(`[data-fiq-form="putaway"][data-transfer-id="${id}"]`)
    for (const select of await form.locator('select[name="location"]').all()) await select.selectOption({ index: 1 })
    await inventoryClick(page, '返仓全部上架', form.getByRole('button', { name: '确认本类实收全部上架' }), async () => { await expect(form).toHaveCount(0); expect((await snapshot(page)).transfers.find((row: any) => row.id === id).putawayAt).toBeTruthy() })
    await expect(form).toHaveCount(0)
  }
  await page.goto(`${REWORK}?id=${encodeURIComponent(app.id)}`)
  const reworkForm = page.locator('[data-fiq-form="receive-transfer"]')
  await receipt(reworkForm)
  await inventoryClick(page, '返工实际接收并完成申请', reworkForm.getByRole('button', { name: /goto_global整批实收/ }), async () => { await expect(reworkForm).toHaveCount(0); expect((await snapshot(page)).applications[0].completedAt).toBeTruthy() })
  await expect(reworkForm).toHaveCount(0)
  await inventoryNavigation(page,'成衣库存质检完成详情回读',`${WLS}?id=${encodeURIComponent(app.id)}`,()=>expect(page.locator('[data-fiq-workspace] p.font-semibold.text-blue-800').first()).toContainText('已完成'))
  await expect(page.locator('[data-fiq-workspace] p.font-semibold.text-blue-800').first()).toContainText('已完成')
  await expect(page.locator('[data-fiq-form]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('[data-fiq-workspace] p.font-semibold.text-blue-800').first()).toContainText('已完成')
  const final = await snapshot(page), saved = final.applications.find(row => row.id === app.id)!
  expect(saved.completedAt).toBeTruthy()
  expect(saved.qcResults?.reduce((n, row) => n + row.passedQty, 0)).toBe(68)
  expect(saved.qcResults?.reduce((n, row) => n + row.defectQty, 0)).toBe(2)
  expect(saved.qcResults?.reduce((n, row) => n + row.reworkQty, 0)).toBe(2)
  expect(final.transfers.filter(row => row.applicationId === app.id && row.category !== '送后道')).toHaveLength(3)
  expect(final.applications).toHaveLength(1)
  expect(final.applications.some(row=>row.id.startsWith('FI-APP-MOCK-'))).toBe(false)
  expect(final.transfers.some(row=>row.applicationId.startsWith('FI-APP-MOCK-'))).toBe(false)
  const normalTransfer=final.transfers.find(row=>row.applicationId===app.id&&row.category==='正常返仓')!
  const defectTransfer=final.transfers.find(row=>row.applicationId===app.id&&row.category==='瑕疵入仓')!
  expect(final.lots.filter(row=>row.sourceRef===normalTransfer.id&&row.putaway).reduce((n,row)=>n+row.quantity,0)).toBe(68)
  expect(final.lots.filter(row=>row.sourceRef===defectTransfer.id&&row.putaway).reduce((n,row)=>n+row.quantity,0)).toBe(2)
  await page.screenshot({ path: info.outputPath('completed-inventory-quality.png'), fullPage: true })
  await inventoryNavigation(page,'返仓上架后即时库存回读','/wls/finished/stock/realtime',()=>expect(page.locator('tr').filter({hasText:'SKU-GC-20001'}).first().getByRole('link',{name:'本仓本款全部送检'})).toBeVisible())
  await inventoryClick(page,'复核上架后的正常可用量',page.locator('tr').filter({hasText:'SKU-GC-20001'}).first().getByRole('link',{name:'本仓本款全部送检'}),async()=>{
    await expect(page.getByRole('button',{name:'确认下架出库 68 件',exact:true})).toBeEnabled()
    await expect(page.getByText(/正常已上架 88 件，订单排除 20 件/)).toBeVisible()
  })
  expect(await snapshot(page)).toEqual(final)
  await page.screenshot({path:info.outputPath('returned-stock-available-68.png'),fullPage:true})
  await page.goto(`${WLS}?id=${encodeURIComponent(app.id)}`)
  await expect(page.locator('[data-fiq-workspace] p.font-semibold.text-blue-800').first()).toContainText('已完成')
  await saveInventoryTimings(page, info)
  await info.attach('persisted-inventory', { body: JSON.stringify(final, null, 2), contentType: 'application/json' })
  if(withProcessing){await page.context().storageState({path:info.outputPath('inventory-session.json'),indexedDB:true});await writeFile(info.outputPath('inventory-processing-reference.json'),JSON.stringify({postTaskId:saved.postTaskId,postTaskNo:saved.postTaskNo}))}
})

test('后道实收差异保留真实数量，成衣仓详情没有后道办理按钮', async ({ page }) => {
  console.log('回放节点：送检')
  const app = await create(page)
  await page.goto(`${POST}?id=${encodeURIComponent(app.id)}`)
  const form = page.locator('[data-fiq-form="receive"]')
  await receipt(form, 1)
  await form.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  const saved = await snapshot(page)
  expect(saved.applications[0].lines.reduce((n, row) => n + (row.receivedQty || 0), 0)).toBe(71)
  expect(saved.differences).toHaveLength(1)
  await page.goto(`${WLS}?id=${encodeURIComponent(app.id)}`)
  await expect(page.getByText('原仓实际出库72件；后道实际接收71件')).toBeVisible()
  await expect(page.locator('[data-fiq-form]')).toHaveCount(0)
})

test('成衣质检接入后销售出库取消打单仍能保存和回读', async ({ page }) => {
  await page.goto('/wls/finished/outbound-orders')
  await page.getByRole('button', { name: /^已打单 \(/ }).click()
  const row = page.locator('tr').filter({ has: page.getByRole('button', { name: '取消打单', exact: true }) }).first()
  await expect(row).toBeVisible()
  const id = await row.locator('[data-order-id]').first().getAttribute('data-order-id')
  await row.getByRole('button', { name: '取消打单', exact: true }).click()
  await page.getByRole('button', { name: '确认取消打单', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /^已取消 \(/ }).click()
  await expect(page.locator('tr').filter({ has: page.locator(`[data-order-id="${id}"]`) }).first()).toContainText('已取消')
  await page.reload()
  await page.getByRole('button', { name: /^已取消 \(/ }).click()
  await expect(page.locator('tr').filter({ has: page.locator(`[data-order-id="${id}"]`) }).first()).toContainText('已取消')
})

test('库存QC来源链接保留本批单号，有其他在检单时明确提示而不替换批次', async ({ page }) => {
  const app = await create(page)
  await page.goto(`${POST}?id=${encodeURIComponent(app.id)}`)
  const form = page.locator('[data-fiq-form="receive"]')
  await receipt(form)
  await form.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  const qcNo = (await snapshot(page)).applications[0].qcTaskNo
  await page.getByRole('link', { name: '进入后道原质检工作台' }).click()
  await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toHaveValue(qcNo)
  await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '继续当前质检单' })).toBeVisible()
  await page.getByRole('button', { name: '领取并固定本次检查要求' }).click()
  await expect(page.getByRole('alert')).toContainText('请先完成当前质检单')
})

test('成衣库存质检筛选查询、更多条件和重置联动统计；接收后类型在QC列表中可辨认',async({page},info)=>{
 const app=await create(page)
 await page.goto(WLS)
 const query=()=>page.getByRole('button',{name:'查询',exact:true}).click()
 await expect(page.getByRole('heading',{name:'成衣库存质检',exact:true})).toBeVisible()
 await page.getByLabel('综合查询',{exact:true}).fill('不存在的单据')
 await expect(page.getByRole('link',{name:app.applicationNo,exact:true})).toBeVisible()
 await query();await expect(page.getByText('暂无符合条件的成衣库存质检申请')).toBeVisible()
 await expect(page.getByText('成衣库存质检申请（0条）',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'重置',exact:true}).click()
 await page.getByLabel('综合查询',{exact:true}).fill(app.applicationNo)
 await page.getByLabel('原成衣仓',{exact:true}).selectOption(app.warehouseId)
 await page.getByLabel('申请进度',{exact:true}).selectOption('待后道实收')
 await page.getByLabel('后道接收状态',{exact:true}).selectOption('PENDING')
 await page.getByLabel('质检进度',{exact:true}).selectOption('PENDING')
 await page.getByRole('button',{name:'更多筛选',exact:true}).click()
 await page.getByLabel('出库人',{exact:true}).fill('管理员')
 await page.getByLabel('开始日期',{exact:true}).fill('2099-01-02')
 await page.getByLabel('结束日期',{exact:true}).fill('2000-01-01')
 await query();await expect(page.locator('[data-fiq-feedback]')).toContainText('开始日期不能晚于结束日期')
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date(app.createdAt))
 await page.getByLabel('开始日期',{exact:true}).fill(date);await page.getByLabel('结束日期',{exact:true}).fill(date)
 await query();await expect(page.getByRole('link',{name:app.applicationNo,exact:true})).toBeVisible()
 for(const width of [1366,1280,1024]){
  await page.setViewportSize({width,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await expect(page.getByRole('button',{name:'查询',exact:true})).toBeInViewport()
  await page.screenshot({path:info.outputPath(`inventory-filters-${width}.png`),fullPage:true})
 }
 await page.getByRole('button',{name:'重置',exact:true}).click()
 await expect(page.getByLabel('综合查询',{exact:true})).toHaveValue('')
 await expect(page.getByLabel('原成衣仓',{exact:true})).toHaveValue('')
 await page.goto(`${POST}?id=${encodeURIComponent(app.id)}`)
 const form=page.locator('[data-fiq-form="receive"]');await receipt(form,1)
 await form.getByRole('button',{name:'确认整批实收并形成库存QC'}).click()
 await expect(page.getByRole('link',{name:'进入后道原质检工作台'})).toBeVisible()
 const qc=(await snapshot(page)).applications[0]
 await page.goto('/fcs/craft/post-finishing/qc-orders?sourceKind=WAREHOUSE_STOCK')
 await expect(page.getByRole('combobox',{name:'质检类型',exact:true})).toHaveValue('WAREHOUSE_STOCK')
 await expect(page.locator('tbody tr').filter({hasText:qc.qcTaskNo})).toContainText('成衣库存质检')
 await expect(page.locator('tbody')).not.toContainText('第 1 次回货')
 await page.getByRole('combobox',{name:'质检类型',exact:true}).selectOption('PRODUCTION_RETURN')
 await page.getByRole('button',{name:'查询',exact:true}).click()
 await expect(page.locator('tbody')).not.toContainText(qc.qcTaskNo)
 await page.goto(WLS);await page.getByLabel('后道接收状态',{exact:true}).selectOption('DIFFERENCE');await query()
 await expect(page.getByRole('link',{name:app.applicationNo,exact:true})).toBeVisible()
 await expect(page.locator('tbody')).toContainText('72 / 71')
})

test('成衣库存质检查询、重置与日期错误完整响应',async({page},info)=>{
 await page.setViewportSize({width:1366,height:768})
 const app=await create(page);await page.goto(WLS)
 for(let sample=0;sample<5;sample++){
  await page.getByLabel('综合查询',{exact:true}).fill('本次没有匹配单据')
  await inventoryClick(page,'筛选无结果及统计',page.getByRole('button',{name:'查询',exact:true}),async()=>{await expect(page.getByText('成衣库存质检申请（0条）',{exact:true})).toBeVisible();await expect(page.getByText('暂无符合条件的成衣库存质检申请')).toBeVisible()})
  await inventoryClick(page,'重置筛选及统计',page.getByRole('button',{name:'重置',exact:true}),()=>expect(page.getByRole('link',{name:app.applicationNo,exact:true})).toBeVisible())
 }
 await page.getByRole('button',{name:'更多筛选',exact:true}).click()
 await page.getByLabel('开始日期',{exact:true}).fill('2099-01-02');await page.getByLabel('结束日期',{exact:true}).fill('2000-01-01')
 for(let sample=0;sample<5;sample++)await inventoryClick(page,'日期非法筛选阻断',page.getByRole('button',{name:'查询',exact:true}),()=>expect(page.locator('[data-fiq-feedback]')).toContainText('开始日期不能晚于结束日期'))
 await saveInventoryTimings(page,info)
})

test('即时库存冷启动完整就绪',async({page},info)=>{await page.setViewportSize({width:1366,height:768});await inventoryNavigation(page,'冷启动即时库存','/wls/finished/stock/realtime',async()=>{await expect(page.locator('tr').filter({hasText:'SKU-GC-20001'}).first().getByRole('link',{name:'本仓本款全部送检'})).toBeVisible()});await saveInventoryTimings(page,info)})

test.beforeEach(async ({page,baseURL},info)=>{
  if(!info.title.startsWith('真实页面完成成衣仓送检'))await useEmptyInventoryQualityFixture(page,baseURL)
})
