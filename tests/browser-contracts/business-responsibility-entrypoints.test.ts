import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const base = process.env.BUSINESS_RESPONSIBILITY_TEST_URL || 'http://127.0.0.1:43270'
const output = resolve(process.env.BUSINESS_RESPONSIBILITY_TEST_OUTPUT || 'output/verification/prototype-full-function-cleanup/business-responsibility')
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, evidence }, null, 2)) })
async function run(name: string, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__business-responsibility-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>' }))
  try {
    await page.goto(base + '/__business-responsibility-harness')
    await fn(page)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: resolve(output, `${name}-1366.png`), fullPage: true })
  } catch (error) {
    await writeFile(resolve(output, `${name}-failure.json`), JSON.stringify({ error: String(error), errors }, null, 2))
    await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => {})
    throw error
  } finally { await context.close() }
}
async function setupLace(page: Page) {
  return page.evaluate(async () => {
    await (await import('/src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords()
    const uiPath = '/src/pages/wls-accessory-receipts.ts'
    const transformed = await (await fetch(uiPath)).text()
    const dependency = transformed.match(/from\s+["']([^"']*\/data\/fcs\/lace-factory-domain\.ts(?:\?[^"']*)?)["']/)?.[1] || '/src/data/fcs/lace-factory-domain.ts'
    const api = await import(dependency), ui = await import(uiPath)
    ;(globalThis as any).__laceResponsibilityApi = api
    document.body.innerHTML = ui.renderWlsAccessoryReceiptsPage()
    for (const type of ['click', 'input', 'change']) document.body.addEventListener(type, event => { if (event.target instanceof HTMLElement) ui.handleWlsAccessoryReceiptsEvent(event.target, event) })
    const source = api.listLaceHandovers(undefined, api.WLS_ACCESSORY_CLERK).find(row => row.receiptStatus === '待收货')!
    return { id: source.handoverId, quantity: source.qty }
  })
}
const laceField = (name: string) => `[data-wls-lace-receipts-field="${name}"]`
const laceAction = (name: string) => `[data-wls-lace-receipts-action="${name}"]`

test('花边收货直接开放；实际收货人、数量和少收原因仍阻断，普通收货不自动升主管', { timeout: 90000 }, async () => run('lace-normal', async page => {
  const source = await setupLace(page)
  await expect(page.locator(laceField('actorRole'))).toHaveCount(0)
  await page.locator(`${laceAction('open-receipt')}[data-handover-id="${source.id}"]`).click()
  await page.locator(laceAction('save-receipt')).click()
  await expect(page.getByRole('dialog')).toContainText('实际收货人姓名')
  await page.locator(laceField('receiverName')).fill('辅料实际收货员')
  await page.locator(laceField('actualQty')).fill('-1')
  await page.locator(laceAction('save-receipt')).click()
  await expect(page.getByRole('dialog')).toContainText('不能小于 0')
  await expect(page.locator(laceField('receiverName'))).toHaveValue('辅料实际收货员')
  await page.locator(laceField('actualQty')).fill(String(source.quantity - 1))
  await page.locator(laceAction('save-receipt')).click()
  await expect(page.getByRole('dialog')).toContainText('差异原因')
  await page.locator(laceField('differenceReason')).fill('清点少到 1 Yard，按实际入库')
  await page.locator(laceAction('save-receipt')).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await page.evaluate(async id => {
    const api = (globalThis as any).__laceResponsibilityApi
    const receipt = api.listLaceReceipts().find(row => row.handoverId === id)!
    return { receipt, logs: api.listLaceOperationLogs({ objectId: receipt.receiptId }) }
  }, source.id)
  assert.equal(saved.receipt.actualQty, source.quantity - 1)
  assert.equal(saved.receipt.receivedByName, '辅料实际收货员')
  assert.equal(saved.receipt.overReceiptConfirmedById, undefined)
  assert.ok(saved.logs.some(log => log.actorRole === '中央辅料仓管'))
  evidence['lace-normal'] = { passed: true, noRoleSwitch: true, actualReceiverRequired: true, invalidQuantityAndDifferenceBlocked: true, clerkRolePreserved: true }
}))

test('花边多收仅在二次确认记录实际主管；姓名、凭证、责任勾选缺一不保存', { timeout: 90000 }, async () => run('lace-over', async page => {
  const source = await setupLace(page)
  await page.locator(`${laceAction('open-receipt')}[data-handover-id="${source.id}"]`).click()
  await page.locator(laceField('receiverName')).fill('辅料清点员')
  await page.locator(laceField('actualQty')).fill(String(source.quantity + 1))
  await page.locator(laceField('differenceReason')).fill('实物多到 1 Yard，主管核验后入库')
  await page.locator(laceField('evidence')).fill('')
  await page.locator(laceAction('save-receipt')).click()
  await expect(page.getByRole('dialog')).toContainText('多收须填写或上传收货凭证')
  await page.locator(laceField('evidence')).fill('实际清点凭证.jpg')
  await page.locator(laceAction('save-receipt')).click()
  await expect(page.getByRole('heading', { name: '多收二次确认' })).toBeVisible()
  await expect(page.getByRole('dialog').locator('select')).toHaveCount(0)
  await page.locator(laceAction('confirm-over-receipt')).click()
  await expect(page.getByRole('dialog')).toContainText('实际确认主管姓名')
  await page.locator(laceField('supervisorName')).fill('辅料确认主管')
  await page.locator(laceAction('confirm-over-receipt')).click()
  await expect(page.getByRole('dialog')).toContainText('勾选确认')
  const before = await page.evaluate(async id => (globalThis as any).__laceResponsibilityApi.listLaceReceipts().filter(row => row.handoverId === id), source.id)
  assert.equal(before.length, 0)
  await expect(page.locator(laceField('supervisorName'))).toHaveValue('辅料确认主管')
  await page.locator(laceField('supervisorConfirmed')).check()
  await page.locator(laceAction('confirm-over-receipt')).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await page.evaluate(async id => (globalThis as any).__laceResponsibilityApi.listLaceReceipts().find(row => row.handoverId === id)!, source.id)
  assert.equal(saved.actualQty, source.quantity + 1)
  assert.equal(saved.receivedByName, '辅料清点员')
  assert.notEqual(saved.receivedById, saved.overReceiptConfirmedById)
  assert.equal(saved.overReceiptConfirmedByName, '辅料确认主管')
  assert.equal(saved.evidence, '实际清点凭证.jpg')
  assert.equal(saved.differenceReason, '实物多到 1 Yard，主管核验后入库')
  evidence['lace-over'] = { passed: true, noRoleSwitch: true, actualSupervisorAndExplicitSecondConfirmationRequired: true, quantity: saved.actualQty, actualReceiverAndSupervisorIndependent: true, evidenceAndReasonPreserved: true }
}))

test('批版动作按状态直接开放；领取实名与确认必填，提交保留原领取责任、建议前置和PPIC反馈归属', { timeout: 120000 }, async () => run('sample-approval', async page => {
  const assignmentId = await page.evaluate(async () => {
    await (await import('/src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords()
    await (await import('/src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
    await (await import('/src/data/fcs/cutting/cutting-event-repository.ts')).hydrateCuttingEventRecords()
    const ui = await import('/src/pages/sewing-outsourcing/sample-approval-suggestions.ts')
    const demo = await import('/src/data/fcs/sewing-outsourcing-demo.ts')
    document.body.innerHTML = ui.renderSampleApprovalSuggestionsPage()
    for (const type of ['click', 'input', 'change']) document.body.addEventListener(type, event => { if (event.target instanceof HTMLElement) void ui.handleSampleApprovalSuggestionsEvent(event.target, event) })
    return demo.SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.sewingIronPack
  })
  const field = (name: string) => page.locator(`[data-sample-approval-field="${name}"]`)
  const action = (name: string) => page.locator(`[data-sample-approval-action="${name}"]`)
  await expect(action('switch-role')).toHaveCount(0)
  await expect(page.locator('[data-role]')).toHaveCount(0)
  await action('switch-tab:PENDING_APPROVAL').click()
  await action('start-approval').filter({ hasNot: page.locator('[disabled]') }).first().click()
  await action('confirm-start-approval').click()
  await expect(page.getByRole('dialog')).toContainText('实际领取批版人员姓名')
  await field('startApproverName').fill('本轮批版领取人')
  await action('confirm-start-approval').click()
  await expect(page.getByRole('dialog')).toContainText('勾选责任确认')
  await field('startConfirmed').check()
  await action('confirm-start-approval').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const readRecord = () => page.evaluate(async id => (await import('/src/data/fcs/sewing-sample-approval-suggestion.ts')).getSewingSampleApprovalRecord(id)!, assignmentId)
  const claimed = await readRecord()
  assert.equal(claimed.sample.status, 'APPROVAL_IN_PROGRESS')
  assert.equal(claimed.currentApproverName, '本轮批版领取人')
  assert.match(claimed.currentApproverId || '', /^SAMPLE-APPROVER:CMD-PPIC-SAMPLE-START-/)
  await action('open-approval').click()
  await action('submit-approval').click()
  await expect(page.getByRole('dialog')).toContainText('实际提交人姓名')
  await field('approverName').fill('其他批版人')
  await field('approverConfirmed').check()
  await action('submit-approval').click()
  await expect(page.getByRole('dialog')).toContainText('原领取人提交')
  assert.equal((await readRecord()).currentApproverId, claimed.currentApproverId)
  await field('approverName').fill('本轮批版领取人')
  await field('approverConfirmed').uncheck()
  await action('submit-approval').click()
  await expect(page.getByRole('dialog')).toContainText('勾选确认')
  await field('approverConfirmed').check()
  await field('conclusion').selectOption('HAS_PROBLEM')
  await action('submit-approval').click()
  await expect(page.getByRole('dialog')).toContainText('至少填写一项结构化意见')
  await field('processComment').fill('腰带接头按样衣位置加固')
  await action('submit-approval').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const submitted = await readRecord()
  assert.equal(submitted.currentApproverId, claimed.currentApproverId)
  assert.equal(submitted.suggestionVersions.at(-1)?.uploadedByName, '本轮批版领取人')
  assert.equal(submitted.suggestionVersions.at(-1)?.structuredComments.processComment, '腰带接头按样衣位置加固')
  await action('switch-tab:PENDING_FEEDBACK').click()
  await page.locator(`[data-sample-approval-action="feedback-factory"][data-assignment-id="${assignmentId}"]`).click()
  await expect(page.locator('[role="status"]')).toContainText('PPIC截图反馈工厂')
  const completed = await readRecord()
  assert.equal(completed.sample.status, 'FEEDBACK_SENT')
  evidence['sample-approval'] = { passed: true, noRoleSwitch: true, claimIdentityTiedToCommand: true, originalApproverResponsibilityPreserved: true, commentsAndStateGuardsPreserved: true, taskPpicId: completed.sample.currentPpicId }
}))

test('TMF基础实收无角色选择；普通实收留实际姓名，超计划仅经主管姓名和原二次确认，实交上限保留', { timeout: 90000 }, async () => run('tmf-base-receipt', async page => {
  await page.evaluate(async () => {
    const uiPath = '/src/pages/process-factory/accessory/webbing/semi-finished-orders.ts'
    const transformed = await (await fetch(uiPath)).text()
    const dependency = transformed.match(/from\s+["']([^"']*\/data\/pms\/tmf-material-purchases\.ts(?:\?[^"']*)?)["']/)?.[1] || '/src/data/pms/tmf-material-purchases.ts'
    const tmf = await import(dependency)
    ;(globalThis as any).__tmfResponsibilityApi = tmf
    const data = tmf.getTmfPurchaseState()
    data.orders = [{ purchaseOrderNo:'ROLE-BASE-PO',purchaseLineId:'ROLE-BASE-L1',version:1,supplierId:'MOCK-SUP-TMF',supplierName:'规范供应方',factoryOrgId:'FAC-TMF',materialSkuId:'WB30-WHT',materialSpuId:'WB30',accessoryType:'织带',targetWarehouseId:'MOCK-ACC-WH',productionStandard:'按原交出实物接收',baseMaterialRecipe:{materialSkuId:'YARN-DEMO-01',unit:'kg',quantityPerMeter:0.02,specification:'规范配方'},requirementNo:'',sourceRequirementLineNo:'',sourceProductPurchaseOrderNo:'',materialCode:'WB30-WHT',materialName:'白色织带',materialType:'辅料',materialImageUrl:'/materials/tmf/webbing-real-roll.jpg',unit:'米',styleCode:'',styleName:'',styleImageUrl:'',warehouse:'规范辅料仓',orderedQty:10,receivedQty:0,unitPrice:1,currency:'RMB',status:'已采购',orderDate:'2026-09-20',expectedArrivalDate:'2026-09-25',buyerName:'采购员',supplierConfirmed:true,supplierConfirmedAt:'2026-09-20',remark:'隔离验收中已确认超产实交12米，采购计划10米' }]
    data.baseOrders = [{id:'ROLE-BASE',purchaseOrderNo:'ROLE-BASE-PO',purchaseLineId:'ROLE-BASE-L1',purchaseVersion:1,materialSkuId:'WB30-WHT',targetWarehouseId:'MOCK-ACC-WH',plannedMeters:10,dueDate:'2026-09-25',productionStandard:'规范',producedMeters:12,changePending:false,acceptedAt:'2026-09-20'}]
    data.handovers = [{id:'ROLE-HANDOVER',baseOrderId:'ROLE-BASE',purchaseOrderNo:'ROLE-BASE-PO',purchaseLineId:'ROLE-BASE-L1',materialSkuId:'WB30-WHT',batchId:'ROLE-BATCH',warehouseId:'MOCK-ACC-WH',dispatchedMeters:12,receivedMeters:0,dispatchedAt:'2026-09-25T00:00:00.000Z'}]
    const db = await import('/src/data/pms/idb-storage.ts')
    const orderKeys = ['orders','baseOrders','handovers','purchaseReturns','workPlans','workCosts','supplyPurchaseReceipts','baseMaterialLots','baseMaterialIssues','baseMaterialReturns']
    const scrapKeys = ['defectiveScraps','factoryScraps','continuousScraps','terminationDisposals','terminationClosures']
    const productionKeys = Object.keys(data).filter(key => Array.isArray((data as any)[key]) && !orderKeys.includes(key) && !scrapKeys.includes(key) && key !== 'operations')
    const section = (keys:string[]) => Object.fromEntries(keys.map(key=>[key,(data as any)[key]]))
    await db.pmsTx([db.PMS_STORES.pmsTmfOrders,db.PMS_STORES.pmsTmfProduction,db.PMS_STORES.pmsTmfScrap,db.PMS_STORES.pmsTmfOperations],'readwrite',tx=>{
      tx.objectStore(db.PMS_STORES.pmsTmfOrders).put({singleton:'singleton',section:section(orderKeys)})
      tx.objectStore(db.PMS_STORES.pmsTmfProduction).put({singleton:'singleton',section:section(productionKeys)})
      tx.objectStore(db.PMS_STORES.pmsTmfScrap).put({singleton:'singleton',section:section(scrapKeys)})
      tx.objectStore(db.PMS_STORES.pmsTmfOperations).put({singleton:'singleton',section:{operations:[]}})
    })
    await tmf.hydratePmsTmfPurchaseStateFromIdb()
    const ui = await import(uiPath)
    document.body.innerHTML = ui.renderTmfSemiFinishedFlowPage('base-receipts')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  const reloadTmfReceipt = async () => {
    await page.reload()
    return page.evaluate(async () => {
    const uiPath = '/src/pages/process-factory/accessory/webbing/semi-finished-orders.ts'
    const transformed = await (await fetch(uiPath)).text()
    const dependency = transformed.match(/from\s+["']([^"']*\/data\/pms\/tmf-material-purchases\.ts(?:\?[^"']*)?)["']/)?.[1] || '/src/data/pms/tmf-material-purchases.ts'
    const tmf = await import(dependency)
    ;(globalThis as any).__tmfResponsibilityApi = tmf
    await tmf.hydratePmsTmfPurchaseStateFromIdb()
    const ui = await import(uiPath)
    document.body.innerHTML = ui.renderTmfSemiFinishedFlowPage('base-receipts')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    return tmf.getTmfPurchaseState()
  })
  }
  const action = (name:string) => page.locator(`[data-tmf-base-receipts-action="${name}"]`)
  const input = (name:string) => page.locator(`[data-tmf-dialog] [name="${name}"]`)
  const error = page.locator('[data-tmf-dialog-error]')
  await action('receive').click()
  await expect(page.locator('[name="receiveRole"]')).toHaveCount(0)
  await input('scanBatch').fill('ROLE-BATCH'); await input('scanSku').fill('WB30-WHT'); await input('quantity').fill('5'); await input('location').fill('A-01')
  await action('confirm').click(); await expect(error).toContainText('实际收货人姓名')
  await input('receiverName').fill('织带实收员')
  await page.evaluate(() => {
    ;(globalThis as any).__tmfOriginalTransaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readwrite') throw new Error('专项实收事务故障')
      return (globalThis as any).__tmfOriginalTransaction.apply(this, args)
    }
  })
  await action('confirm').click()
  await expect(error).toContainText('专项实收事务故障')
  await expect(input('quantity')).toHaveValue('5'); await expect(input('receiverName')).toHaveValue('织带实收员')
  const failed = await page.evaluate(() => (globalThis as any).__tmfResponsibilityApi.getTmfPurchaseState())
  assert.equal(failed.orders[0].receivedQty, 0); assert.equal(failed.lots.length, 0); assert.equal(failed.operations.length, 0)
  assert.equal(await page.evaluate(() => localStorage.getItem((globalThis as any).__tmfResponsibilityApi.TMF_PURCHASE_STORAGE_KEY)), null)
  await page.evaluate(() => { IDBDatabase.prototype.transaction = (globalThis as any).__tmfOriginalTransaction })
  // Simulate a newer persisted purchase remark from another tab, while this
  // receipt still holds the earlier validated facts. No real source is used.
  await page.evaluate(async () => {
    const db = await import('/src/data/pms/idb-storage.ts')
    const saved = await db.pmsGet<any>(db.PMS_STORES.pmsTmfOrders, 'singleton')
    ;(globalThis as any).__tmfBeforeConcurrentRemark = structuredClone(saved)
    saved.section.orders[0].remark = '另一页面已经保存的采购备注'
    await db.pmsTx(db.PMS_STORES.pmsTmfOrders, 'readwrite', tx => { tx.objectStore(db.PMS_STORES.pmsTmfOrders).put(saved) })
  })
  await action('confirm').click(); await expect(error).toContainText('已被其他操作更新')
  await expect(input('quantity')).toHaveValue('5')
  const conflict = await page.evaluate(async () => {
    const db = await import('/src/data/pms/idb-storage.ts')
    const saved = await db.pmsGet<any>(db.PMS_STORES.pmsTmfOrders, 'singleton')
    return { persistedRemark: saved.section.orders[0].remark, persistedQty: saved.section.orders[0].receivedQty, memoryQty: (globalThis as any).__tmfResponsibilityApi.getTmfPurchaseState().orders[0].receivedQty }
  })
  assert.deepEqual(conflict, { persistedRemark: '另一页面已经保存的采购备注', persistedQty: 0, memoryQty: 0 })
  await expect(error).toContainText('刷新页面后重新打开收货记录')
  const reread = await reloadTmfReceipt()
  assert.equal(reread.orders[0].remark, '另一页面已经保存的采购备注')
  await action('receive').click()
  await input('scanBatch').fill('ROLE-BATCH'); await input('scanSku').fill('WB30-WHT'); await input('quantity').fill('5'); await input('location').fill('A-01'); await input('receiverName').fill('织带实收员')
  await action('confirm').click()
  await expect(page.locator('[data-tmf-dialog] h2')).toHaveCount(0)
  const read = () => page.evaluate(() => (globalThis as any).__tmfResponsibilityApi.getTmfPurchaseState())
  assert.equal((await read()).orders[0].receivedQty, 5)
  assert.equal((await read()).orders[0].remark, '另一页面已经保存的采购备注')
  assert.equal((await read()).operations.at(-1)?.actor.name, '织带实收员')
  assert.equal((await read()).operations.at(-1)?.actor.role, '仓管')
  await action('receive').click()
  await input('scanBatch').fill('ROLE-BATCH'); await input('scanSku').fill('WB30-WHT'); await input('quantity').fill('8'); await input('receiverName').fill('织带实收员'); await input('supervisorName').fill('织带实收主管'); await input('overReceiptConfirmed').check(); await input('overReceiptReason').fill('按实际超产交出核对')
  await action('confirm').click(); await expect(error).toContainText('超过上游实际交出')
  assert.equal((await read()).orders[0].receivedQty, 5)
  await input('quantity').fill('7'); await input('supervisorName').fill(''); await action('confirm').click(); await expect(error).toContainText('实际确认主管姓名')
  await input('supervisorName').fill('织带实收主管'); await input('overReceiptConfirmed').uncheck(); await action('confirm').click(); await expect(error).toContainText('勾选二次确认')
  await input('overReceiptConfirmed').check(); await input('overReceiptReason').fill(''); await action('confirm').click(); await expect(error).toContainText('超收须填写原因')
  await input('overReceiptReason').fill('实物超产2米，主管核对交出来源'); await action('confirm').click()
  await expect(page.locator('[data-tmf-dialog] h2')).toHaveCount(0)
  const saved = await read()
  assert.equal(saved.orders[0].orderedQty, 10); assert.equal(saved.orders[0].receivedQty, 12); assert.equal(saved.lots[0].onHandMeters, 12)
  assert.equal(saved.orders[0].overReceipts?.[0].meters, 2)
  assert.equal(saved.operations.at(-1)?.actor.name, '织带实收主管'); assert.equal(saved.operations.at(-1)?.actor.role, '仓库主管')
  assert.equal(saved.operations.at(-1)?.receivedBy?.name, '织带实收员')
  assert.notEqual(saved.operations.at(-1)?.receivedBy?.id, saved.operations.at(-1)?.actor.id)
  await expect.poll(() => page.evaluate(async () => {
    const db = await import('/src/data/pms/idb-storage.ts')
    const stored = await db.pmsGet<any>(db.PMS_STORES.pmsTmfOperations, 'singleton')
    const production = await db.pmsGet<any>(db.PMS_STORES.pmsTmfProduction, 'singleton')
    if (production?.section.lots?.find((lot:any) => lot.sourceHandoverId === 'ROLE-HANDOVER')?.onHandMeters !== 12) return null
    return stored?.section.operations.at(-1)?.receivedBy?.name
  })).toBe('织带实收员')
  const refreshed = await reloadTmfReceipt()
  assert.equal(refreshed.orders[0].receivedQty, 12)
  assert.equal(refreshed.lots.find((lot:any) => lot.sourceHandoverId === 'ROLE-HANDOVER')?.onHandMeters, 12, '刷新后实收批次库存必须与采购实收保持一致')
  assert.equal(refreshed.operations.at(-1)?.receivedBy?.name, '织带实收员')
  assert.equal(refreshed.operations.at(-1)?.actor.name, '织带实收主管')
  await action('detail').click()
  await expect(page.locator('[data-tmf-dialog]')).toContainText('实收人 织带实收员')
  await expect(page.locator('[data-tmf-dialog]')).toContainText('超收确认 织带实收主管')
  evidence['tmf-base-receipt'] = { passed: true, noRoleSwitch: true, normalReceiverRole:'仓管',overReceiptActor:'织带实收主管',orderedQty:10,receivedQty:12,actualReceiverAndSupervisorIndependent:true,refreshFromIndexedDbVerified:true,upstreamHardCapPreserved:true }
}))

test('TMF旧单例只读提取保留已有库存批次，不复制种子、不清理旧源', { timeout: 90000 }, async () => run('tmf-legacy-lot-read', async page => {
  const result = await page.evaluate(async () => {
    const storage = await import('/src/data/pms/idb-storage.ts')
    const nativeOpen = indexedDB.open
    indexedDB.open = function(...args: Parameters<IDBFactory['open']>) {
      const request = nativeOpen.apply(this, args)
      request.addEventListener('upgradeneeded', () => {
        if (request.result.name === storage.PMS_IDB_DB_NAME && !request.result.objectStoreNames.contains('pmsTmfPurchaseState')) request.result.createObjectStore('pmsTmfPurchaseState', { keyPath: 'singleton' })
      })
      return request
    }
    try { await storage.pmsTx(storage.PMS_STORES.pmsTmfOrders, 'readonly', () => undefined) }
    finally { indexedDB.open = nativeOpen }
    const api = await import('/src/data/pms/tmf-material-purchases.ts')
    const legacy = api.getTmfPurchaseState()
    const lot = { id: 'LEGACY-LOT-6', materialSkuId: 'WB30-WHT', sourcePurchaseOrderNo: 'LEGACY-PO', sourcePurchaseLineId: 'LEGACY-PO-L1', sourceHandoverId: 'LEGACY-HANDOVER', warehouseId: 'MOCK-ACC-WH', location: 'A-01', receivedMeters: 6, onHandMeters: 6, reservedMeters: 0, frozenMeters: 0 }
    legacy.lots = [lot]
    await storage.pmsTx('pmsTmfPurchaseState' as any, 'readwrite', tx => { tx.objectStore('pmsTmfPurchaseState').put({ singleton: 'singleton', state: legacy }) })
    let writes = 0
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) { writes++; return put.apply(this, args) }
    try { await api.hydratePmsTmfPurchaseStateFromIdb() }
    finally { IDBObjectStore.prototype.put = put }
    const old = await storage.pmsGet<any>('pmsTmfPurchaseState' as any, 'singleton')
    return { actual: api.getTmfPurchaseState().lots, expected: [lot], old: old.state.lots, writes }
  })
  assert.deepEqual(result.actual, result.expected)
  assert.deepEqual(result.old, result.expected)
  assert.equal(result.writes, 0)
  evidence['tmf-legacy-lot-read'] = { passed: true, fixtureScope: 'existing lot record format preservation only; no business execution inferred', noReadWrites: true, oldSourcePreserved: true, receivedMeters: 6, onHandMeters: 6 }
}))
