import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const base = process.env.FULL_FUNCTION_TEST_URL || 'http://127.0.0.1:43271'
const output = resolve(process.env.FULL_FUNCTION_TEST_OUTPUT || 'output/verification/full-function-20261020/role-entrypoints')
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, environment: 'isolated browser fixtures and actual exported page handlers', evidence }, null, 2)) })
async function run(name: string, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__full-function-role-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>' }))
  try { await page.goto(base + '/__full-function-role-harness'); await fn(page); assert.deepEqual(errors, []) }
  catch (error) { await writeFile(resolve(output, `${name}-failure.json`), JSON.stringify({ error: String(error), errors }, null, 2)); await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
}

test('中转区域独立直达可读取毛织交出依赖，无需先访问其他业务页', { timeout: 90000 }, async () => run('transit-direct-entry', async page => {
  await page.goto(base + '/wls/inbound')
  await expect(page.locator('[data-wls-inbound-root]')).toBeVisible()
  await expect(page.locator('[data-wls-inbound-field="actorRole"]')).toHaveCount(0)
  await expect(page.locator('[data-wls-inbound-field="actorName"]')).toBeVisible()
  evidence['transit-direct-entry'] = { passed: true, coldDirectEntry: true }
}))

test('印厂待接收共用入口独立直达，业务功能直接展示且无假身份', { timeout: 90000 }, async () => run('printing-direct-entry', async page => {
  await page.goto(base + '/fcs/craft/printing/pending-receipts')
  await expect(page.locator('[data-factory-receiving-root]')).toBeVisible()
  await expect(page.locator('[data-rfield="identity"]')).toHaveCount(0)
  await expect(page.getByLabel('实际接收人', { exact: true })).toBeVisible()
  evidence['printing-direct-entry'] = { passed: true, coldDirectEntry: true }
}))

test('中转区域无需原型身份，收货人、数量上限和少收原因仍阻断；成功只更新原交出批次', { timeout: 90000 }, async () => run('transit', async page => {
  await page.evaluate(async () => {
    const api = await import('/src/data/fcs/pda-handover-events.ts'), ui = await import('/src/pages/wls-inbound.ts')
    const head: any = { handoverId: 'FULL-ROLE-HEAD', handoverOrderNo: 'HO-FULL-ROLE', headType: 'HANDOUT', qrCodeValue: 'HO-FULL-ROLE', taskId: 'FULL-ROLE-TASK', taskNo: 'FULL-ROLE-TASK', productionOrderId: 'FULL-ROLE-PO', productionOrderNo: 'PO-FULL-ROLE', processName: '普通加工', sourceFactoryName: '来源工厂', targetName: '中转区域', targetKind: 'WAREHOUSE', receiverKind: 'WAREHOUSE', receiverId: 'WH-TRANSFER', receiverName: '中转区域', qtyUnit: '件', factoryId: 'FULL-ROLE-FACTORY', taskStatus: 'IN_PROGRESS', summaryStatus: '待接收', recordCount: 0, pendingWritebackCount: 0, writtenBackQtyTotal: 0, objectionCount: 0, completionStatus: 'IN_PROGRESS', qtyExpectedTotal: 10, qtyActualTotal: 0, qtyDiffTotal: 0 }
    api.upsertPdaHandoverHeadMock(head)
    api.upsertPdaHandoutRecordMock({ recordId: 'FULL-ROLE-RECORD', handoverId: head.handoverId, taskId: head.taskId, sequenceNo: 1, submittedQty: 10, qtyUnit: '件', materialName: '测试交出成品', materialCode: 'FULL-ROLE-SKU', factorySubmittedAt: new Date(Date.now() - 3_600_000).toISOString(), factorySubmittedBy: '交出员', factoryProofFiles: [], status: 'PENDING_WRITEBACK' } as any)
    document.body.innerHTML = ui.renderWlsInboundPage()
    for (const type of ['click', 'input', 'change']) document.body.addEventListener(type, event => { if (event.target instanceof HTMLElement) ui.handleWlsInboundEvent(event.target, event) })
  })
  await expect(page.locator('[data-wls-inbound-field="actorRole"]')).toHaveCount(0)
  const open = page.locator('[data-wls-inbound-action="open"][data-record-id="FULL-ROLE-RECORD"]')
  await expect(open).toBeEnabled(); await open.click()
  const dialog = page.locator('[data-wls-inbound-overlays] > div').filter({ has: page.getByRole('heading', { name: '确认实际收货', exact: true }) })
  await dialog.getByRole('button', { name: '确认并保存实收', exact: true }).click()
  await expect(dialog.locator('[data-wls-inbound-dialog-feedback]')).toContainText('实际收货员姓名')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.locator('[data-wls-inbound-field="actorName"]').fill('中转核收员')
  await open.click(); await dialog.locator('[data-wls-inbound-field="qty"]').fill('11')
  await dialog.getByRole('button', { name: '确认并保存实收', exact: true }).click()
  await expect(dialog.locator('[data-wls-inbound-dialog-feedback]')).toContainText('不能超过')
  await dialog.locator('[data-wls-inbound-field="qty"]').fill('8')
  await dialog.getByRole('button', { name: '确认并保存实收', exact: true }).click()
  await expect(dialog.locator('[data-wls-inbound-dialog-feedback]')).toContainText('少收原因')
  await dialog.locator('[data-wls-inbound-field="reason"]').fill('清点实到 8 件，余量未到')
  await dialog.getByRole('button', { name: '确认并保存实收', exact: true }).click()
  await expect(page.locator('[data-wls-inbound-feedback]')).toContainText('已保存到原交出单')
  const saved = await page.evaluate(async () => (await import('/src/data/fcs/pda-handover-events.ts')).findPdaHandoverRecord('FULL-ROLE-RECORD'))
  assert.equal(saved?.receiverWrittenQty, 8); assert.match(saved?.receiverWrittenBy || '', /中转核收员/); assert.match(saved?.diffReason || '', /余量未到/)
  await expect(open).toHaveCount(0)
  evidence.transit = { passed: true, directlyAvailable: true, actualReceiverAndQuantityAndReasonRequired: true, savedQty: 8 }
}))

test('染厂待接收直接办理MJS单据，按原单确定工厂，错误库位不入库并保留实际接收人', { timeout: 90000 }, async () => run('factory', async page => {
  await page.goto(base + '/fcs/craft/dyeing/pending-receipts')
  await page.locator('[data-factory-receiving-root]').waitFor()
  const fixture = await page.evaluate(async () => {
    const api = await import('/src/data/fcs/factory-receiving.ts')
    const source = api.getFactoryReceivingSource('RCV-SRC-014')!, correct = api.getFactoryReceiptLocations('ID-F002')[0], wrong = api.getFactoryReceiptLocations('ID-F003')[0]
    return { sourceId: source.id, correct: `${correct.warehouse.warehouseId}|${correct.location.locationId}`, wrong: `${wrong.warehouse.warehouseId}|${wrong.location.locationId}` }
  })
  await expect(page.locator('[data-rfield="identity"]')).toHaveCount(0)
  await page.locator('[data-rfield="keyword"]').fill('DB-260911-014'); await page.locator('[data-factory-receiving-action="query"]').click()
  await page.locator(`[data-factory-receiving-action="receive"][data-id="${fixture.sourceId}"]`).click()
  await expect(page.locator('[data-receiving-actor]')).toContainText('MJS')
  const line = page.locator('[data-receipt-line]').first()
  await line.locator('[data-rinclude]').check(); await line.locator('[data-rfield="weightKg"]').fill('1')
  await page.locator('[data-factory-receiving-action="review"]').click()
  await expect(page.locator('[data-receiving-feedback]')).toContainText('实际接收人姓名')
  await page.getByLabel('实际接收人', { exact: true }).fill('MJS核收员')
  await line.locator('[data-rfield="position"]').evaluate((select: HTMLSelectElement, value) => { select.add(new Option('错误工厂库位', value)); select.value = value }, fixture.wrong)
  await page.locator('[data-factory-receiving-action="review"]').click()
  await expect(page.locator('[data-receiving-feedback]')).not.toBeEmpty()
  assert.equal(await page.evaluate(async () => (await import('/src/data/fcs/factory-receiving.ts')).getSourceActualReceipts('RCV-SRC-014').length), 0)
  await line.locator('[data-rfield="position"]').selectOption(fixture.correct)
  await page.locator('[data-factory-receiving-action="review"]').click()
  await expect(page.locator('[data-factory-receiving-action="save"]')).toBeVisible()
  await expect(page.getByLabel('实际接收人', { exact: true })).toBeDisabled()
  await page.locator('[data-factory-receiving-action="edit"]').click()
  await expect(page.getByLabel('实际接收人', { exact: true })).toBeEnabled()
  await page.locator('[data-factory-receiving-action="review"]').click()
  await page.locator('[data-factory-receiving-action="save"]').click()
  await expect(page.locator('[data-factory-receiving-content]')).toContainText('接收已保存')
  const receipts = await page.evaluate(async () => (await import('/src/data/fcs/factory-receiving.ts')).listFactoryReceipts('ID-F002').filter(row => row.lines.some(line => line.sourceId === 'RCV-SRC-014')))
  assert.equal(receipts.length, 1); assert.equal(receipts[0].operatorName, 'MJS核收员'); assert.equal(receipts[0].lines[0].qty, 1)
  await page.screenshot({ path: resolve(output, 'factory-full-function-1366.png'), fullPage: true })
  evidence.factory = { passed: true, targetFactoryFromSource: 'ID-F002', wrongFactoryLocationRejected: true, actualReceiver: receipts[0].operatorName, actualKg: 1 }
}))

test('TMF生产领料直接显示不同组织的发料单；错包、超领和质量未核对阻断，分次实收按原单留责任', { timeout: 90000 }, async () => run('tmf', async page => {
  await page.evaluate(async () => {
    const tmf = await import('/src/data/pms/tmf-material-purchases.ts'), db = await import('/src/data/pms/idb-storage.ts')
    await (await import('/src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords()
    const spec = { usage: '腰带', endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' } }
    const demands = [1, 2].map(index => ({ id: `ROLE-DEMAND-${index}`, productionOrderId: `ROLE-PO-${index}`, productionOrderNo: `PO-ROLE-${index}`, garmentSize: index === 1 ? 'S' : 'M', specification: spec, requiredPieces: 10 }))
    const packages = demands.map((demand, index) => ({ id: `ROLE-PACK-${index + 1}`, demandId: demand.id, materialSkuId: 'ROLE-WEBBING', pieces: 10, unit: '条', actualCutLengthMm: 500, actualFinishedLengthMm: 500, endA: spec.endA, endB: spec.endB, createdAt: '2026-10-20T01:00:00Z' }))
    const issues = packages.map((pkg, index) => ({ id: `ROLE-ISSUE-${index + 1}`, packageId: pkg.id, demandId: pkg.demandId, receiverOrganizationId: `ORG-${index + 1}`, receiverId: `RECEIVER-${index + 1}`, dispatchedPieces: 10, receivedPieces: 0, dispatchedAt: '2026-10-20T01:00:00Z' }))
    await db.pmsTx([db.PMS_STORES.pmsTmfProduction], 'readwrite', tx => tx.objectStore(db.PMS_STORES.pmsTmfProduction).put({ singleton: 'singleton', section: { demands, packages, productionIssues: issues, reservations: [], processingIssues: [], cutOutputs: [], continuousReturns: [], tipMaterialReturns: [], tipMaterialLots: [], tipMaterialIssues: [], tipResults: [], outputHandovers: [], outputAllocations: [], productionControls: [] } }))
    await tmf.hydratePmsTmfPurchaseStateFromIdb()
    const ui = await import('/src/pages/process-factory/accessory/webbing/production-receipts.ts')
    document.body.innerHTML = ui.renderTmfProductionReceiptsPage()
  })
  await expect(page.locator('[name="receiverIdentity"]')).toHaveCount(0)
  await expect(page.locator('[data-tmf-production-receipts-action="open"]')).toHaveCount(2)
  await expect(page.locator('[data-tmf-prod-content]')).toContainText('ORG-1'); await expect(page.locator('[data-tmf-prod-content]')).toContainText('ORG-2')
  await page.locator('[data-tmf-production-receipts-action="open"][data-id="ROLE-ISSUE-1"]').click()
  await page.locator('[name="package"]').fill('ROLE-PACK-2'); await page.locator('[name="pieces"]').fill('3')
  await page.locator('[data-tmf-production-receipts-action="confirm"]').click(); await expect(page.locator('[data-tmf-prod-error]')).toContainText('核对长度')
  await page.locator('[name="checked"]').check()
  await page.locator('[data-tmf-production-receipts-action="confirm"]').click(); await expect(page.locator('[data-tmf-prod-error]')).toContainText('不符')
  await page.locator('[name="package"]').fill('ROLE-PACK-1'); await page.locator('[name="pieces"]').fill('11')
  await page.locator('[data-tmf-production-receipts-action="confirm"]').click(); await expect(page.locator('[data-tmf-prod-error]')).toContainText('超过')
  await page.locator('[name="pieces"]').fill('3'); await page.locator('[data-tmf-production-receipts-action="confirm"]').click()
  await expect(page.locator('[data-tmf-prod-feedback]')).toContainText('已保存本次 3 条')
  const facts = await page.evaluate(async () => (await import('/src/data/pms/tmf-material-purchases.ts')).getTmfPurchaseState())
  assert.equal(facts.productionIssues.find(row => row.id === 'ROLE-ISSUE-1')?.receivedPieces, 3); assert.equal(facts.productionIssues.find(row => row.id === 'ROLE-ISSUE-2')?.receivedPieces, 0)
  const last = facts.operations.at(-1)!; assert.equal(last.actor.id, 'RECEIVER-1'); assert.equal(last.actor.role, '生产领料人')
  evidence.tmf = { passed: true, allOrganizationsDirectlyVisible: true, packageAndQuantityAndPhysicalCheckPreserved: true, actualReceived: 3, otherIssueReceived: 0, actor: last.actor }
}))
