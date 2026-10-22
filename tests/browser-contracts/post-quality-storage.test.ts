import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

// Isolated browser contexts exercise the actual IndexedDB transaction boundary.
// These are prototype contracts, not evidence of a real signature or warehouse.
const base = process.env.POST_QUALITY_TEST_URL || process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'
const route = '/__post-quality-contract'
let browser: Browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
async function isolated(run: (page: Page) => Promise<void>) {
  const context = await browser.newContext(), page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**' + route, request => request.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh"><meta charset="utf-8"><body></body></html>' }))
  try { await page.goto(base + route); await run(page); assert.deepEqual(errors, []) }
  finally { await context.close() }
}

async function prepare(page: Page) {
  await page.evaluate(async () => {
    // Mirror main.ts's production-QC entry: hydrate the actual PCS sources
    // before importing its business bridge. The now-complete legacy BOMs
    // resolve genuine material SKU records, so a style-only incidental read
    // cannot stand in for preparing their material archive dependencies.
    await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
    const bridgePath = '/src/data/fcs/post-finishing-inventory-bridge.ts', dbPath = '/src/data/pcs-record-db.ts'
    // One business entry keeps the same imported domain/command instances even
    // while Vite assigns HMR timestamps to its direct dependencies.
    const bridge = await import(bridgePath), db = await import(dbPath), f = bridge, r = bridge, q = bridge
    await r.ensurePostFinishingRecordState(); await q.ensureQualityManagementRecords()
    if (r.getPostFinishingStorageFailure()) throw Error(r.getPostFinishingStorageFailure())
    const actor = { actorId: 'BROWSER-QC', actorName: '隔离契约QC', roleName: 'QC质检员' }
    const linesFor = (id: string, passedQty: number, defectQty = 0, returnQty = 0) => {
      const task = f.getPostFinishingFullFlowQcTask(id), summary = f.getPostFinishingQcInspectionSummary(id)
      let p = passedQty, d = defectQty, ret = returnQty
      const lines = summary.lines.map((line: any) => {
        let available = line.uninspectedQty
        const defect = Math.min(d, available); d -= defect; available -= defect
        const returned = Math.min(ret, available); ret -= returned; available -= returned
        const passed = Math.min(p, available); p -= passed
        const itemId = (task.inspection.snapshot.skuSnapshots?.find((row: any) => row.skuId === line.skuId)?.snapshot || task.inspection.snapshot).items[0].id
        return { skuId: line.skuId, passedQty: passed, defectQty: defect, returnQty: returned,
          issues: defect + returned ? [{ itemId, note: '隔离浏览器标准项目问题' }] : [] }
      })
      if (p + d + ret) throw Error('隔离输入超过真实SKU剩余实物')
      return lines
    }
    ;(window as any).__postContract = { f, r, q, db, actor, linesFor }
  })
}

test('原QC真实30→50→100累计检查、升级纸单失效、固定规则Q01和完成放行持久回读', { timeout: 120000 }, () => isolated(async page => {
  await prepare(page)
  const result = await page.evaluate(async () => {
    const { f, r, q, db, actor, linesFor } = (window as any).__postContract
    await f.hydrateProductionContextRecords()
    const draft = q.buildQualityConfigurationDraft('RULE', 'production-return-rule-v1')
    draft.initialFullInspection = null
    await q.saveQualityConfigurationDraft(draft); await q.publishQualityConfiguration(draft.id)
        const pending = f.listPostFinishingFullFlowQcTasks().find((row: any) => row.status === '待质检' && row.lines.reduce((sum: number, line: any) => sum + line.expectedQty, 0) === 100)
    if (!pending) throw Error('隔离浏览器缺少待开检100件来源')
    const snapshot = q.readPreparedInspectionSnapshot({ sourceKind: 'PRODUCTION_RETURN' })
    const task = await r.runPostFinishingCommand(() => f.claimPostFinishingQcTask({ qcTaskNo: pending.qcTaskNo, actor }), { guards: [q.qualityConfigurationGuard(snapshot)] })
    const id = task.qcTaskId, openedRule = task.inspection.snapshot.ruleSnapshot
    // The newer effective version would inspect 100% with a higher threshold.
    // This already-open QC must continue its frozen 30/50/100, threshold 2 rule.
    const changed = q.buildQualityConfigurationDraft('RULE', draft.id)
    changed.defaultPercent = 100; changed.roundThresholds = [{ roundNumber: 1, unqualifiedQuantity: 9 }]
    await q.saveQualityConfigurationDraft(changed); await q.publishQualityConfiguration(changed.id)
    const freshRule = (await q.readInspectionSnapshot({ sourceKind: 'PRODUCTION_RETURN' })).ruleSnapshot
    const paper = async (name: string) => {
      const url = r.registerPostFinishingFile(new Blob(['isolated signed-paper fixture'], { type: 'image/png' }))
      await r.runPostFinishingCommand(() => f.attachPostFinishingQcSignedPaper({ qcTaskId: id, actor, url, name }))
    }
    await paper('隔离第1版双签测试文件.png')
    await r.runPostFinishingCommand(() => f.submitPostFinishingQcRound({ qcTaskId: id, actor, operationId: 'browser-round-1', lines: linesFor(id, 27, 3) }))
    let auditBlocked = false
    try { await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: id, actor, processItems: [] })) } catch (error) { auditBlocked = /稽查/.test(String(error)) }
    await r.runPostFinishingCommand(() => f.upgradePostFinishingQcInspection({ qcTaskId: id, actor, nextPercent: 50, note: '本批增加抽检' }))
    const after50 = f.getPostFinishingQcInspectionSummary(id)
    await r.runPostFinishingCommand(() => f.submitPostFinishingQcRound({ qcTaskId: id, actor, operationId: 'browser-round-2', lines: linesFor(id, 18, 2) }))
    await r.runPostFinishingCommand(() => f.upgradePostFinishingQcInspection({ qcTaskId: id, actor, nextPercent: 100, note: '本批全检' }))
    const after100 = f.getPostFinishingQcInspectionSummary(id)
    await r.runPostFinishingCommand(() => f.submitPostFinishingQcRound({ qcTaskId: id, actor, operationId: 'browser-round-3', lines: linesFor(id, 50) }))
    let paperBlocked = false
    try { await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: id, actor, processItems: [] })) } catch (error) { paperBlocked = /纸面双签/.test(String(error)) }
    await paper('隔离第3版双签测试文件.png')
    await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: id, actor, processItems: [] }))
    await r.ensurePostFinishingRecordState()
    const completed = f.getPostFinishingFullFlowQcTask(id), summary = f.getPostFinishingQcInspectionSummary(id)
    const outbounds = f.listPostFinishingFullFlowOutboundOrders().filter((row: any) => row.qcTaskId === id)
    const persisted = await db.readPcsRecords(['higood-fcs-post-finishing-records'])
    return { id, auditBlocked, paperBlocked, openedRule, freshRule, after50: after50.remainingQty, after100: after100.remainingQty,
      completed, summary, outbounds, rechecks: f.listPostFinishingFullFlowRecheckOrders().length,
      files: persisted.files.map((row: any) => ({ id: row.id, bytes: row.blob.size })), raw: persisted.records.find((row: any) => row.collection === 'flow/qcTasks' && row.value.qcTaskId === id)?.value }
  })
  assert.equal(result.auditBlocked, true); assert.equal(result.paperBlocked, true)
  assert.equal(result.openedRule.defaultPercent, 30); assert.equal(result.freshRule.defaultPercent, 100)
  assert.equal(result.completed.inspection.snapshot.ruleSnapshot.id, result.openedRule.id)
  assert.deepEqual([result.after50, result.after100], [20, 50])
  assert.deepEqual([result.summary.inspectedQty, result.summary.passedQty, result.summary.defectQty, result.summary.returnQty, result.summary.uninspectedQty, result.summary.releasedQty], [100, 95, 5, 0, 0, 95])
  assert.equal(result.completed.status, '质检完成'); assert.equal(result.completed.inspection.rounds.length, 3)
  assert.equal(result.completed.inspection.paperVersion, 3); assert.deepEqual(result.completed.inspection.papers.map((row: any) => row.version), [1, 3])
  assert.equal(result.outbounds.length, 1); assert.equal(result.outbounds[0].status, '待出货')
  assert.equal(result.outbounds[0].lines.reduce((sum: number, row: any) => sum + row.outboundQty, 0), 95)
  assert.equal(result.rechecks, 0); assert.equal(result.files.length, 2); assert.ok(result.files.every((row: any) => row.bytes > 0))
  assert.ok(result.raw.inspection.papers.every((row: any) => row.url.startsWith('pcs-file:')))
  await page.reload()
  const reloaded = await page.evaluate(async id => {
    const bridgePath = '/src/data/fcs/post-finishing-inventory-bridge.ts'
    const f = await import(bridgePath), r = f; await r.ensurePostFinishingRecordState()
    if (r.getPostFinishingStorageFailure()) throw Error(r.getPostFinishingStorageFailure())
    const task = f.getPostFinishingFullFlowQcTask(id)
    return { status: task.status, rounds: task.inspection.rounds.length, ruleId: task.inspection.snapshot.ruleSnapshot.id,
      papers: task.inspection.papers.map((row: any) => ({ version: row.version, visible: row.url.startsWith('blob:') })),
      outboundCount: f.listPostFinishingFullFlowOutboundOrders().filter((row: any) => row.qcTaskId === id).length }
  }, result.id)
  assert.deepEqual(reloaded, { status: '质检完成', rounds: 3, ruleId: result.openedRule.id, papers: [{ version: 1, visible: true }, { version: 3, visible: true }], outboundCount: 1 })
}))

test('同PCS库存QC完成事务故障：QC/申请/三类交接一起回滚，输入重试只保存一次', { timeout: 120000 }, () => isolated(async page => {
  await prepare(page)
  const result = await page.evaluate(async () => {
    const { f, r, db, actor, linesFor } = (window as any).__postContract
    const inv = f, ir = f, bridge = f
    await bridge.preparePostFinishingInventoryBridge(); await r.ensurePostFinishingRecordState()
    const wh = { actorId: 'BROWSER-WH', actorName: '隔离仓管', roleName: '仓库收货人员' }
    const first = inv.listFinishedInventoryLots()[0], preview = inv.previewFinishedInventoryQuality(first.warehouseId, first.styleId)
    const app = await inv.runFinishedInventoryCommand(() => inv.createFinishedInventoryQualityApplication({ preview, operationId: 'browser-stock-atomic', actor: wh }))
    const received = await inv.runFinishedInventoryCommand(() => inv.receiveFinishedInventoryQualityApplication({ applicationId: app.id,
      quantities: app.lines.map((row: any) => ({ skuId: row.skuId, quantity: row.outboundQty })), actor: wh }))
    const task = await r.runPostFinishingCommand(() => f.claimPostFinishingQcTask({ qcTaskNo: received.qcTaskNo, actor }))
    const summary = f.getPostFinishingQcInspectionSummary(task.qcTaskId)
    await r.runPostFinishingCommand(() => f.submitPostFinishingQcRound({ qcTaskId: task.qcTaskId, actor, operationId: 'browser-stock-round', lines: linesFor(task.qcTaskId, summary.target - 1, 1) }))
    const namespaces = ['higood-fcs-post-finishing-records', ir.FINISHED_INVENTORY_NAMESPACE]
    const before = await db.readPcsRecords(namespaces), stateBefore = ir.captureFinishedInventoryState(), qcBefore = f.getPostFinishingFullFlowQcTask(task.qcTaskId)
    const put = IDBObjectStore.prototype.put; let rejected = false, writtenPostRequests = 0
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === 'records' && String(args[0]?.id).startsWith('higood-fcs-post-finishing-records/')) writtenPostRequests++
      if (this.name === 'records' && String(args[0]?.id).startsWith(ir.FINISHED_INVENTORY_NAMESPACE + '/')) throw new DOMException('isolated inventory completion quota', 'QuotaExceededError')
      return put.apply(this, args)
    }
    const complete = () => inv.runFinishedInventoryCommand(() => f.completePostFinishingQcTask({ qcTaskId: task.qcTaskId, actor }), 'browser-stock-complete', '库存QC完成及分流共同提交')
    try { await complete() } catch { rejected = true } finally { IDBObjectStore.prototype.put = put }
    const failed = await db.readPcsRecords(namespaces), stateFailed = ir.captureFinishedInventoryState(), qcFailed = f.getPostFinishingFullFlowQcTask(task.qcTaskId)
    await complete(); await complete()
    await r.ensurePostFinishingRecordState(); await ir.ensureFinishedInventoryRecords()
    return { rejected, writtenPostRequests, unchangedRows: JSON.stringify(before.records) === JSON.stringify(failed.records),
      unchangedInventory: JSON.stringify(stateBefore) === JSON.stringify(stateFailed), unchangedQc: JSON.stringify(qcBefore) === JSON.stringify(qcFailed),
      app: inv.getFinishedInventoryApplication(app.id), qc: f.getPostFinishingFullFlowQcTask(task.qcTaskId), summary: f.getPostFinishingQcInspectionSummary(task.qcTaskId),
      transfers: inv.listFinishedInventoryTransfers(app.id), noBusinessFallback: !Object.keys(localStorage).some(key => /post-finishing-full-flow|finished-inventory/.test(key)) }
  })
  assert.equal(result.rejected, true); assert.ok(result.writtenPostRequests > 0)
  assert.equal(result.unchangedRows, true); assert.equal(result.unchangedInventory, true); assert.equal(result.unchangedQc, true)
  assert.equal(result.qc.status, '质检完成'); assert.ok(result.app.qcCompletedAt)
  assert.deepEqual([result.summary.quantity, result.summary.inspectedQty, result.summary.passedQty, result.summary.defectQty, result.summary.uninspectedQty, result.summary.releasedQty], [80, 24, 23, 1, 56, 79])
  assert.equal(result.transfers.length, 3)
  assert.equal(result.transfers.find((row: any) => row.category === '正常返仓').lines.reduce((sum: number, row: any) => sum + row.quantity, 0), 79)
  assert.equal(result.transfers.find((row: any) => row.category === '瑕疵入仓').lines.reduce((sum: number, row: any) => sum + row.quantity, 0), 1)
  assert.equal(result.noBusinessFallback, true)
}))

test('显式schema3旧未完复检转待出货，已完历史保留；普通读取不转换，刷新和重试不重复', { timeout: 120000 }, () => isolated(async page => {
  const initial = await page.evaluate(async () => {
    const bridgePath = '/src/data/fcs/post-finishing-inventory-bridge.ts', dbPath = '/src/data/pcs-record-db.ts'
    const f = await import(bridgePath), r = f, db = await import(dbPath)
    const sources = f.listPostFinishingFullFlowOutboundOrders().filter((row: any) => !row.postTaskId && row.sourceType === '质检直达').slice(0, 2)
    if (sources.length !== 2) throw Error('历史隔离fixture缺少两条已完成QC来源')
    const qcTasks = sources.map((row: any) => f.getPostFinishingFullFlowQcTask(row.qcTaskId))
    const deliveryIds = new Set(sources.map((row: any) => row.deliveryId)), deliveries = f.listPostFinishingFactoryReturns().filter((row: any) => deliveryIds.has(row.deliveryId))
    const rechecks = sources.map((source: any, index: number) => ({
      recheckOrderId: index ? 'LEGACY-COMPLETED-RC' : 'LEGACY-PENDING-RC', recheckOrderNo: source.qcTaskNo + '-FJ',
      deliveryId: source.deliveryId, deliveryOrderNo: source.deliveryOrderNo, productionOrderNo: source.productionOrderNo,
      qcTaskId: source.qcTaskId, qcTaskNo: source.qcTaskNo, responsibility: source.responsibility, sourceType: source.sourceType,
      returnIndex: source.returnIndex, createdAt: source.createdAt, status: index ? '复检完成' : '待复检',
      completedAt: index ? source.createdAt : undefined,
      lines: source.lines.map((line: any) => ({ sku: line.sku, expectedQty: line.outboundQty,
        handoverQty: index ? line.outboundQty : undefined, barcodeStatus: index ? '正确' : '待扫描', barcodeEvents: [] })),
    }))
    for (let i = 0; i < qcTasks.length; i++) {
      qcTasks[i].outboundOrderId = undefined; qcTasks[i].outboundOrderNo = undefined
      qcTasks[i].recheckOrderId = rechecks[i].recheckOrderId; qcTasks[i].recheckOrderNo = rechecks[i].recheckOrderNo
    }
    const legacy = { schemaVersion: 3, deliveries, qcTasks, recheckOrders: rechecks, fullCoverages: [], processCompletions: [],
      waitProcessWarehouseRecords: [], waitProcessWarehouseMovements: [], waitHandoverWarehouseRecords: [], waitHandoverWarehouseMovements: [],
      returnConfirmationVersions: f.listPostFinishingReturnConfirmationVersions().filter((row: any) => deliveryIds.has(row.deliveryId)),
      postTasks: [], outboundOrders: [], warehouseReceipts: [], defects: [], materialTransferOrders: [], materialStocks: [] }
    const legacyKey = 'higood-fcs-post-finishing-full-flow-v1', original = JSON.stringify(legacy)
    localStorage.setItem(legacyKey, original)
    let writes = 0; const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) { writes++; return put.apply(this, args) }
    try { await r.ensurePostFinishingRecordState() } finally { IDBObjectStore.prototype.put = put }
    const initialRows = await db.readPcsRecords(['higood-fcs-post-finishing-records'])
    const ordinaryRead = { writes, records: initialRows.records.length, gated: r.hasPostFinishingLegacyData(), sourceUnchanged: localStorage.getItem(legacyKey) === original }
    await r.migratePostFinishingLegacyData()
    const migrated = f.listPostFinishingFullFlowOutboundOrders().filter((row: any) => row.retiredRecheckId === 'LEGACY-PENDING-RC')
    const archived = f.listPostFinishingFullFlowRecheckOrders()
    const beforeRetry = JSON.stringify((await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records)
    await r.migratePostFinishingLegacyData()
    const afterRetry = JSON.stringify((await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records)
    return { ordinaryRead, migrated, archived, sourceRemoved: localStorage.getItem(legacyKey) === null,
      retryUnchanged: beforeRetry === afterRetry, expectedLines: rechecks[0].lines.map((row: any) => ({ skuId: row.sku.skuId, quantity: row.expectedQty })),
      completedHistory: rechecks[1], retiredExports: ['submitPostFinishingForRecheck', 'claimPostFinishingRecheckOrder', 'completePostFinishingRecheckOrder'].filter(key => key in f) }
  })
  assert.deepEqual(initial.ordinaryRead, { writes: 0, records: 0, gated: true, sourceUnchanged: true })
  assert.equal(initial.migrated.length, 1); assert.equal(initial.migrated[0].status, '待出货'); assert.equal(initial.migrated[0].executionModel, 'DIRECT_V2')
  assert.equal(initial.migrated[0].dispatchedAt, undefined); assert.equal(initial.migrated[0].receivedAt, undefined)
  assert.equal(initial.migrated[0].recheckOrderId, undefined); assert.equal(initial.migrated[0].retiredRecheck.status, '待复检')
  assert.deepEqual(initial.migrated[0].lines.map((row: any) => ({ skuId: row.sku.skuId, quantity: row.outboundQty })), initial.expectedLines)
  assert.deepEqual(initial.archived, [initial.completedHistory]); assert.equal(initial.sourceRemoved, true); assert.equal(initial.retryUnchanged, true); assert.deepEqual(initial.retiredExports, [])
  await page.reload()
  const refreshed = await page.evaluate(async () => {
    const bridgePath = '/src/data/fcs/post-finishing-inventory-bridge.ts', dbPath = '/src/data/pcs-record-db.ts'
    const f = await import(bridgePath), r = f, db = await import(dbPath)
    await r.ensurePostFinishingRecordState(); if (r.getPostFinishingStorageFailure()) throw Error(r.getPostFinishingStorageFailure())
    const rows = await db.readPcsRecords(['higood-fcs-post-finishing-records'])
    return { outbounds: f.listPostFinishingFullFlowOutboundOrders().map((row: any) => ({ id: row.outboundOrderId, status: row.status, original: row.retiredRecheckId })),
      completedIds: f.listPostFinishingFullFlowRecheckOrders().map((row: any) => row.recheckOrderId),
      schema: rows.records.find((row: any) => row.id.endsWith('/flow/schemaVersion/value'))?.value, gated: r.hasPostFinishingLegacyData() }
  })
  assert.deepEqual(refreshed, { outbounds: [{ id: initial.migrated[0].outboundOrderId, status: '待出货', original: 'LEGACY-PENDING-RC' }], completedIds: ['LEGACY-COMPLETED-RC'], schema: 4, gated: false })
}))

test('同一旧回货超过100条关联事实：出货保存故障整组撤回，原源保留；重试编号与实物只一套', { timeout: 120000 }, () => isolated(async page => {
  const result = await page.evaluate(async () => {
    const bridgePath = '/src/data/fcs/post-finishing-inventory-bridge.ts', dbPath = '/src/data/pcs-record-db.ts'
    const f = await import(bridgePath), db = await import(dbPath)
    const outbound = f.listPostFinishingFullFlowOutboundOrders().find((row: any) => !row.postTaskId && row.sourceType === '质检直达')
    const qc = f.getPostFinishingFullFlowQcTask(outbound.qcTaskId)
    const delivery = f.listPostFinishingFactoryReturns().find((row: any) => row.deliveryId === outbound.deliveryId)
    const baseConfirmation = f.listPostFinishingReturnConfirmationVersions({ deliveryId: delivery.deliveryId })[0]
    if (!baseConfirmation) throw Error('隔离历史fixture缺少真实格式的回货核数版本')
    const rcId = 'LEGACY-LARGE-PENDING-RC', recheck = {
      recheckOrderId: rcId, recheckOrderNo: qc.qcTaskNo + '-FJ', deliveryId: delivery.deliveryId, deliveryOrderNo: delivery.deliveryOrderNo,
      productionOrderNo: delivery.productionOrderNo, qcTaskId: qc.qcTaskId, qcTaskNo: qc.qcTaskNo, responsibility: outbound.responsibility,
      sourceType: outbound.sourceType, returnIndex: delivery.returnIndex, status: '待复检', createdAt: outbound.createdAt,
      lines: outbound.lines.map((line: any) => ({ sku: line.sku, expectedQty: line.outboundQty, barcodeStatus: '待扫描', barcodeEvents: [] })),
    }
    qc.outboundOrderId = undefined; qc.outboundOrderNo = undefined; qc.recheckOrderId = rcId; qc.recheckOrderNo = recheck.recheckOrderNo
    // One source group has 120 retained count-confirmation revisions, not 120
    // duplicated physical batches. Only its final version remains ACTIVE.
    const confirmations = Array.from({ length: 120 }, (_, index) => ({ ...structuredClone(baseConfirmation),
      confirmationVersionId: `LEGACY-LARGE-CONF-${index}`, status: index === 119 ? 'ACTIVE' : 'SUPERSEDED' }))
    const legacy = { schemaVersion: 3, fullCoverages: [], processCompletions: [], deliveries: [delivery], qcTasks: [qc], recheckOrders: [recheck],
      returnConfirmationVersions: confirmations, waitProcessWarehouseRecords: [], waitProcessWarehouseMovements: [], waitHandoverWarehouseRecords: [],
      waitHandoverWarehouseMovements: [], postTasks: [], outboundOrders: [], warehouseReceipts: [], defects: [], materialTransferOrders: [], materialStocks: [] }
    const legacyKey = 'higood-fcs-post-finishing-full-flow-v1', original = JSON.stringify(legacy), ns = 'higood-fcs-post-finishing-records'
    localStorage.setItem(legacyKey, original); await f.ensurePostFinishingRecordState()
    const put = IDBObjectStore.prototype.put; let requestsBeforeAbort = 0, rejected = false
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const value = args[0]
      if (this.name === 'records' && value?.value?.deliveryId === delivery.deliveryId) requestsBeforeAbort++
      if (this.name === 'records' && value?.collection === 'flow/outboundOrders' && value?.value?.retiredRecheckId === rcId) throw new DOMException('isolated large conversion failure', 'QuotaExceededError')
      return put.apply(this, args)
    }
    try { await f.migratePostFinishingLegacyData() } catch { rejected = true } finally { IDBObjectStore.prototype.put = put }
    const failed = await db.readPcsRecords([ns])
    const groupRows = (rows: any[]) => rows.filter(row => !row.deleted && (row.value?.deliveryId === delivery.deliveryId || row.value?.sourceObjectId === rcId))
    const failedGroupRows = groupRows(failed.records), sourcePreserved = localStorage.getItem(legacyKey) === original
    await f.migratePostFinishingLegacyData(); const saved = await db.readPcsRecords([ns])
    const outbounds = f.listPostFinishingFullFlowOutboundOrders().filter((row: any) => row.retiredRecheckId === rcId)
    const numbered = saved.records.filter((row: any) => !row.deleted && row.value?.sourceObjectId === rcId && row.value?.kind === 'OUTBOUND')
    const stock = saved.records.filter((row: any) => !row.deleted && row.collection === 'flow/waitHandoverWarehouseRecords' && row.value?.outboundOrderId === outbounds[0]?.outboundOrderId)
    const beforeRepeat = JSON.stringify(saved.records); await f.migratePostFinishingLegacyData()
    const afterRepeat = JSON.stringify((await db.readPcsRecords([ns])).records)
    return { rejected, requestsBeforeAbort, failedGroupCount: failedGroupRows.length, sourcePreserved, sourceRemoved: localStorage.getItem(legacyKey) === null,
      outbounds, numberCount: numbered.length, numberNo: numbered[0]?.value?.documentNo, stockCount: stock.length,
      confirmations: f.listPostFinishingReturnConfirmationVersions({ deliveryId: delivery.deliveryId }).length,
      pendingCount: f.listPostFinishingFullFlowRecheckOrders().filter((row: any) => row.recheckOrderId === rcId).length,
      savedGroupCount: groupRows(saved.records).length, unchangedRepeat: beforeRepeat === afterRepeat }
  })
  assert.equal(result.rejected, true); assert.ok(result.requestsBeforeAbort > 100, '故障发生前同组已有超过100个真实put请求')
  assert.equal(result.failedGroupCount, 0, '当前回货不能留下核数、编号、出货或待出实物的半套事实')
  assert.equal(result.sourcePreserved, true); assert.equal(result.sourceRemoved, true)
  assert.equal(result.outbounds.length, 1); assert.equal(result.outbounds[0].status, '待出货')
  assert.equal(result.numberCount, 1); assert.equal(result.numberNo, result.outbounds[0].outboundOrderNo)
  assert.equal(result.stockCount, 1); assert.equal(result.confirmations, 120); assert.equal(result.pendingCount, 0)
  assert.ok(result.savedGroupCount > 100); assert.equal(result.unchangedRepeat, true)
}))

test('同范围新全检覆盖先固化再上传当前纸单，仅一次v2；图文实际参照和两打印始终冻结',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,r,q,db,actor,linesFor}=(window as any).__postContract
  await f.hydrateProductionContextRecords()
  const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1');rule.initialFullInspection=null;await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((n:number,line:any)=>n+line.expectedQty,0)===100)
  if(!pending)throw Error('缺少100件生产回货夹具')
  const reference=await r.runPostFinishingCommand(()=>f.uploadPostFinishingDeliveryQcReference({deliveryId:pending.deliveryId,referenceType:'尺寸判断标准',title:'冻结图文原始依据',description:'原始依据说明同时保留',imageUrl:'/shirt-sample.jpg',source:'买手上传',actor}))
  // The already-sent demo return has no pre-claim reference association. Add
  // that original association as a declared isolated fixture, then open it through the actual claim command.
  const fixtureNamespace='higood-fcs-post-finishing-records',prior=await db.readPcsRecords([fixtureNamespace]),priorRevision=prior.records.find((row:any)=>row.id===fixtureNamespace+'/revision'),priorTask=prior.records.find((row:any)=>row.id===fixtureNamespace+'/flow/qcTasks/'+encodeURIComponent(pending.qcTaskId))
  pending.referenceIds.push(reference.referenceId)
  await db.commitPcsRecords({puts:[{id:fixtureNamespace+'/flow/qcTasks/'+encodeURIComponent(pending.qcTaskId),collection:'flow/qcTasks',value:pending,expectedVersion:priorTask?.version||0},{id:fixtureNamespace+'/revision',collection:'revision',value:{revision:(priorRevision?.version||0)+1},expectedVersion:priorRevision?.version||0}],deletes:[],operationId:'isolated-original-reference-association',intent:'explicit pre-claim image and description reference fixture'})
  await r.ensurePostFinishingRecordState()
  const a=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor})),id=a.qcTaskId
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:id,actor,operationId:'coverage-round-1',lines:linesFor(id,30)}))
  // This is an explicit isolated second-return storage fixture, not a write to a real factory or production database.
  const delivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.deliveryId===pending.deliveryId),other=structuredClone(pending),otherDelivery=structuredClone(delivery)
  other.qcTaskId='COVERAGE-SECOND-QC';other.qcTaskNo='COVERAGE-SECOND-QC';other.deliveryId='COVERAGE-SECOND-DELIVERY';other.deliveryOrderNo='COVERAGE-SECOND-DELIVERY';other.returnIndex+=100;other.referenceIds=[]
  otherDelivery.deliveryId=other.deliveryId;otherDelivery.deliveryOrderNo=other.deliveryOrderNo;otherDelivery.qcTaskId=other.qcTaskId;otherDelivery.qcTaskNo=other.qcTaskNo;otherDelivery.returnIndex=other.returnIndex;otherDelivery.status='已送检'
  const ns='higood-fcs-post-finishing-records',saved=await db.readPcsRecords([ns]),revision=saved.records.find((row:any)=>row.id===ns+'/revision')
  await db.commitPcsRecords({puts:[{id:ns+'/flow/deliveries/'+encodeURIComponent(other.deliveryId),collection:'flow/deliveries',value:otherDelivery,expectedVersion:0},{id:ns+'/flow/qcTasks/'+encodeURIComponent(other.qcTaskId),collection:'flow/qcTasks',value:other,expectedVersion:0},{id:ns+'/revision',collection:'revision',value:{revision:(revision?.version||0)+1},expectedVersion:revision?.version||0}],deletes:[],operationId:'isolated-second-return-fixture',intent:'explicit synthetic same-scope second return'})
  await r.ensurePostFinishingRecordState()
  const newer=q.buildQualityConfigurationDraft('RULE',rule.id);newer.initialFullInspection={basicStyle:false,highDifficulty:false,outsideFabricWhitelist:false,firstFactoryTasks:true,firstTaskCount:999999,fabricSpuWhitelist:[]};await q.saveQualityConfigurationDraft(newer);await q.publishQualityConfiguration(newer.id)
  const b=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:other.qcTaskNo,actor:{...actor,actorId:'BROWSER-SECOND-QC',actorName:'隔离第二QC'}}))
  const beforePaper=f.getPostFinishingQcInspectionSummary(id),url=r.registerPostFinishingFile(new Blob(['isolated current v2 signed paper'],{type:'image/png'}))
  await r.runPostFinishingCommand(()=>f.attachPostFinishingQcSignedPaper({qcTaskId:id,actor,url,name:'只上传一次当前第2版纸单.png'}))
  await r.runPostFinishingCommand(()=>f.uploadPostFinishingQcTaskReference({qcTaskId:id,referenceType:'尺寸判断标准',title:'开检后更新资料',description:'新说明不能覆盖原始依据说明',imageUrl:'/tshirt-sample.jpg',sourceNote:'隔离测试的开检后更新',actor}))
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:id,actor,operationId:'coverage-round-2',lines:linesFor(id,70)}))
  await r.runPostFinishingCommand(()=>f.completePostFinishingQcTask({qcTaskId:id,actor,processItems:[]}))
  await r.ensurePostFinishingRecordState();const completed=f.getPostFinishingFullFlowQcTask(id)
  // Match main.preparePageRouteEntry(postFactReadEntry): the actual print entry
  // prepares its PCS consumers before importing shared production-confirmation templates.
  await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
  const print=await import('/src/pages/print/templates/post-finishing-qc-print-template.ts')
  const master=print.renderPostFinishingQcTaskMaster(completed),detail=print.renderPostFinishingQcTaskDetail(completed,'隔离打印时间')
  return {bPercent:b.inspection.percent,beforePaper,completed,master,detail,persisted:(await db.readPcsRecords([ns])).records.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.qcTaskId===id)?.value}
 })
 assert.equal(result.bPercent,100);assert.equal(result.beforePaper.target,100);assert.equal(result.beforePaper.inspectedQty,30)
 assert.equal(result.completed.status,'质检完成');assert.equal(result.completed.inspection.paperVersion,2);assert.deepEqual(result.completed.inspection.papers.map((row:any)=>row.version),[2]);assert.equal(result.persisted.inspection.papers.length,1)
 const ref=result.completed.inspection.snapshot.references.find((row:any)=>row.name==='冻结图文原始依据');assert.equal(ref.description,'原始依据说明同时保留');assert.equal(ref.imageUrl,'/shirt-sample.jpg')
 for(const html of [result.master,result.detail]){assert.match(html,/原始依据说明同时保留/);assert.match(html,/shirt-sample\.jpg/);assert.doesNotMatch(html,/新说明不能覆盖|tshirt-sample\.jpg/)}
}))

test('原库存80检24结果由中心窄源真实回读：薄列表/单详情/量纲身份不丢；零写及失败不回空种子',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,r,q,db,actor,linesFor}=(window as any).__postContract
  await f.preparePostFinishingInventoryBridge();await r.ensurePostFinishingRecordState()
  const wh={actorId:'READSOURCE-WH',actorName:'隔离仓管',roleName:'仓库收货人员'},lot=f.listFinishedInventoryLots()[0],preview=f.previewFinishedInventoryQuality(lot.warehouseId,lot.styleId)
  const app=await f.runFinishedInventoryCommand(()=>f.createFinishedInventoryQualityApplication({preview,operationId:'readonly-source-80',actor:wh}))
  const quantity=app.lines.reduce((n:number,line:any)=>n+line.outboundQty,0);if(quantity!==80)throw Error('此实际默认库存夹具必须为80件')
  const received=await f.runFinishedInventoryCommand(()=>f.receiveFinishedInventoryQualityApplication({applicationId:app.id,quantities:app.lines.map((line:any)=>({skuId:line.skuId,quantity:line.outboundQty})),actor:wh}))
  const task=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:received.qcTaskNo,actor}))
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor,operationId:'readonly-round-24',lines:linesFor(task.qcTaskId,23,1)}))
  await r.runPostFinishingCommand(()=>f.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor,processItems:[]}))
  const original=f.getPostFinishingQcInspectionSummary(task.qcTaskId)
  await db.commitPcsRecords({puts:[{id:'unrelated-namespace/fixture-file-reference',collection:'unrelated-record',value:{file:'pcs-file:unrelated-readonly-source-file'},expectedVersion:0}],deletes:[],files:[{id:'unrelated-readonly-source-file',blob:new Blob(['unrelated original bytes'],{type:'text/plain'})}],operationId:'unrelated-readonly-sentinel',intent:'isolated unrelated attachment sentinel'})
  const adapter=await import('/src/data/fcs/quality-post-read-source.ts'),read=await import('/src/data/fcs/quality-management-read-model.ts')
  const source=adapter.postQualityReadSource('WAREHOUSE_STOCK'),remove=read.registerQualityInspectionSource('WAREHOUSE_STOCK',source)
  const put=IDBObjectStore.prototype.put,add=IDBObjectStore.prototype.add,del=IDBObjectStore.prototype.delete,get=IDBObjectStore.prototype.get,getAll=IDBObjectStore.prototype.getAll
  let writes=0,fileReads=0,failReads=false
  IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){writes++;return put.apply(this,args)}
  IDBObjectStore.prototype.add=function(...args:Parameters<typeof add>){writes++;return add.apply(this,args)}
  IDBObjectStore.prototype.delete=function(...args:Parameters<typeof del>){writes++;return del.apply(this,args)}
  IDBObjectStore.prototype.get=function(...args:Parameters<typeof get>){if(this.name==='files')fileReads++;if(failReads&&this.name==='records')throw new DOMException('隔离只读失败','UnknownError');return get.apply(this,args)}
  IDBObjectStore.prototype.getAll=function(...args:Parameters<typeof getAll>){if(this.name==='files')fileReads++;if(failReads&&this.name==='records')throw new DOMException('隔离只读失败','UnknownError');return getAll.apply(this,args)}
  try{
   await source.prepare();const list=read.listQualityInspectionRecords({sourceKind:'WAREHOUSE_STOCK'}),thin=list.find(row=>row.id===task.qcTaskId)!
   if(!thin)throw Error('真实原QC未进入中心窄源')
   const notPrepared=source.get(task.qcTaskId)===undefined
   await read.ensureQualityInspectionRecordDetails('WAREHOUSE_STOCK',task.qcTaskId);const detail=read.getQualityInspectionRecord('WAREHOUSE_STOCK',task.qcTaskId)!,otherDetailMissing=list.filter(row=>row.id!==task.qcTaskId).every(row=>source.get(row.id)===undefined)
   let failure='';failReads=true;try{await source.prepare()}catch(error){failure=String(error)}finally{failReads=false}
   const retainedCount=read.listQualityInspectionRecords({sourceKind:'WAREHOUSE_STOCK'}).length
   return {quantity,original,thin,notPrepared,detail,otherDetailMissing,writes,fileReads,failure,listCount:list.length,retainedCount,app:{id:app.id,warehouseName:app.warehouseName,styleId:app.styleId}}
  }finally{IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.add=add;IDBObjectStore.prototype.delete=del;IDBObjectStore.prototype.get=get;IDBObjectStore.prototype.getAll=getAll;remove()}
 })
 assert.deepEqual([result.original.inspectedQty,result.original.passedQty,result.original.defectQty,result.original.uninspectedQty,result.original.releasedQty],[24,23,1,56,79])
 assert.deepEqual([result.thin.quantity,result.thin.inspectedQty,result.thin.passedQty,result.thin.defectQty,result.thin.uninspectedReleaseQty,result.thin.normalReleaseQty],[80,24,23,1,56,79])
 assert.equal(result.thin.sourceKind,'WAREHOUSE_STOCK');assert.equal(result.thin.sourceId,result.app.id);assert.equal(result.thin.warehouseName,result.app.warehouseName);assert.equal(result.thin.styleId,result.app.styleId)
 assert.equal(result.thin.snapshot,undefined);assert.equal(result.thin.rounds,undefined);assert.equal(result.notPrepared,true);assert.equal(result.otherDetailMissing,true);assert.ok(result.detail.snapshot?.items.length);assert.equal(result.detail.rounds?.length,1)
 assert.equal(result.writes,0);assert.equal(result.fileReads,0);assert.match(result.failure,/无法读取|失败|UnknownError/);assert.equal(result.retainedCount,result.listCount)
}))

test('原生窄源拒绝未知非空来源及QC/回货/覆盖/库存申请/交接身份错位及坏SKU，删除标记无需伪造value',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,db}=(window as any).__postContract,adapter=await import('/src/data/fcs/quality-post-read-source.ts'),source=adapter.postQualityReadSource('PRODUCTION_RETURN')
  await source.prepare();const signature=()=>JSON.stringify(source.list().slice().sort((a:any,b:any)=>a.id.localeCompare(b.id))),original=signature(),pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检')
  if(!pending)throw Error('缺少原待检生产来源')
  const post='higood-fcs-post-finishing-records',inv='higood-finished-inventory',id=(prefix:string,key:string)=>prefix+encodeURIComponent(key)
  const cases=[
   {name:'unknown-kind',id:id(post+'/flow/qcTasks/',pending.qcTaskId),collection:'flow/qcTasks',value:{...pending,sourceKind:'UNKNOWN_NONEMPTY_SOURCE'}},
   {name:'qc-path',id:id(post+'/flow/qcTasks/','WRONG-PATH-QC'),collection:'flow/qcTasks',value:pending},
   {name:'qc-collection',id:id(post+'/flow/qcTasks/',pending.qcTaskId),collection:'flow/deliveries',value:pending},
   {name:'missing-sku',id:id(post+'/flow/qcTasks/',pending.qcTaskId),collection:'flow/qcTasks',value:{...pending,lines:[{...pending.lines[0],sku:{...pending.lines[0].sku,skuId:''}}]}},
   {name:'duplicate-sku',id:id(post+'/flow/qcTasks/',pending.qcTaskId),collection:'flow/qcTasks',value:{...pending,lines:[pending.lines[0],pending.lines[0]]}},
   {name:'delivery-path',id:id(post+'/flow/deliveries/','WRONG-PATH-DELIVERY'),collection:'flow/deliveries',value:{deliveryId:'DIFFERENT-DELIVERY'}},
   {name:'coverage-path',id:id(post+'/flow/fullCoverages/','WRONG-PATH-COVERAGE'),collection:'flow/fullCoverages',value:{coverageId:'DIFFERENT-COVERAGE'}},
   {name:'application-path',id:id(inv+'/applications/','WRONG-PATH-APP'),collection:inv+'/applications',value:{id:'DIFFERENT-APP'}},
   {name:'transfer-path',id:id(inv+'/transfers/','WRONG-PATH-TRANSFER'),collection:inv+'/transfers',value:{id:'DIFFERENT-TRANSFER',applicationId:'UNRELATED-APP'}},
  ]
  const outcomes=[]
  for(const fixture of cases){
   const before=await db.readPcsRecords([post,inv]),prior=before.records.find((row:any)=>row.id===fixture.id)
   await db.commitPcsRecords({puts:[{id:fixture.id,collection:fixture.collection,value:fixture.value,expectedVersion:prior?.version||0}],deletes:[],operationId:'source-invalid-'+fixture.name,intent:'declared isolated invalid identity fixture '+fixture.name})
   const put=IDBObjectStore.prototype.put,add=IDBObjectStore.prototype.add,del=IDBObjectStore.prototype.delete;let writes=0,error=''
   IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){writes++;return put.apply(this,args)};IDBObjectStore.prototype.add=function(...args:Parameters<typeof add>){writes++;return add.apply(this,args)};IDBObjectStore.prototype.delete=function(...args:Parameters<typeof del>){writes++;return del.apply(this,args)}
   try{try{await source.prepare()}catch(failure){error=String(failure)}}finally{IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.add=add;IDBObjectStore.prototype.delete=del}
   outcomes.push({name:fixture.name,error,writes,retained:signature()===original})
   const saved=(await db.readPcsRecords([post,inv])).records.find((row:any)=>row.id===fixture.id)
   // Remove only the isolated invalid row, or restore the overridden baseline.
   if(fixture.name==='unknown-kind' || (prior && !prior.deleted))await db.commitPcsRecords({puts:[{id:fixture.id,collection:prior?.collection || fixture.collection,value:prior?.value || pending,expectedVersion:saved.version}],deletes:[],operationId:'source-restore-'+fixture.name,intent:'restore isolated previous row'})
   else await db.commitPcsRecords({puts:[],deletes:[{id:fixture.id,expectedVersion:saved.version}],operationId:'source-remove-'+fixture.name,intent:'delete isolated invalid row with tombstone'})
   await source.prepare()
   if(signature()!==original)throw Error('删除坏夹具后未恢复原来源集合：'+fixture.name)
  }
  return outcomes
 })
 assert.equal(result.length,9);for(const outcome of result){assert.match(outcome.error,/身份|来源|位置|编号/,outcome.name);assert.equal(outcome.writes,0,outcome.name);assert.equal(outcome.retained,true,outcome.name)}
}))

test('中心两份原PCS附件详情切换及离开后释放无人引用URL，旧DOM仍引用时不提前释放且原Blob不删',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const fixture=await page.evaluate(async()=>{
  const {f,r,q,db,actor}=(window as any).__postContract
  await f.hydrateProductionContextRecords()
  const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1');rule.initialFullInspection=null
  await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检')
  if(!pending)throw Error('缺少附件生命周期原待检来源')
  const opened=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor}))
  // Declared isolated fixed-document fixtures. The second QC is a detached
  // copy solely for readonly selection; no real factory or business DB is used.
  const fileIds=['qc-source-lifecycle-a','qc-source-lifecycle-b'],texts=['第一份固定参照原始字节','第二份固定参照原始字节']
  const rows=[structuredClone(opened),structuredClone(opened)]
  rows[1].qcTaskId='QC-SOURCE-LIFECYCLE-B';rows[1].qcTaskNo='QC-SOURCE-LIFECYCLE-B'
  rows.forEach((row:any,index:number)=>{row.inspection.snapshot.references=[{id:'lifecycle-reference-'+index,name:'生命周期原始资料'+(index?'B':'A'),kind:'DOCUMENT',value:'pcs-file:'+fileIds[index],description:'明确保留的原始附件说明'+index}];row.inspection.snapshot.skuSnapshots?.forEach((sku:any)=>{sku.snapshot.references=[]})})
  const ns='higood-fcs-post-finishing-records',prior=(await db.readPcsRecords([ns])).records
  await db.commitPcsRecords({puts:rows.map((row:any)=>{const id=ns+'/flow/qcTasks/'+encodeURIComponent(row.qcTaskId);return{id,collection:'flow/qcTasks',value:row,expectedVersion:prior.find((item:any)=>item.id===id)?.version||0}}),deletes:[],files:fileIds.map((id,index)=>({id,blob:new Blob([texts[index]],{type:'text/plain'})})),operationId:'isolated-two-fixed-source-attachments',intent:'isolated original PCS documents for readonly lifecycle contract'})
  return {taskIds:rows.map((row:any)=>row.qcTaskId),fileIds,texts}
 })
 await page.context().addInitScript(()=>{
  const state=(window as any).__sourceUrlLifecycle={events:[] as any[],writes:0},create=URL.createObjectURL,revoke=URL.revokeObjectURL
  URL.createObjectURL=function(blob:Blob){const url=create.call(URL,blob);state.events.push({operation:'create',url,bytes:blob.size});return url}
  URL.revokeObjectURL=function(url:string){const stillInDom=Array.from(document.querySelectorAll('img[src],a[href],source[src],video[src],audio[src],object[data],[data-qm-image]')).some(node=>['src','href','data','data-qm-image'].some(attribute=>node.getAttribute(attribute)===url));state.events.push({operation:'revoke',url,stillInDom});return revoke.call(URL,url)}
  for(const method of ['put','add','delete'] as const){const original=IDBObjectStore.prototype[method];(IDBObjectStore.prototype as any)[method]=function(...args:any[]){state.writes++;return (original as any).apply(this,args)}}
 })
 const detail=(id:string)=>'/fcs/quality-management/records/PRODUCTION_RETURN/'+encodeURIComponent(id)
 await page.goto(base+detail(fixture.taskIds[0]))
 const fixedLink=page.locator('[data-quality-management-page] a[href^="blob:"]')
 await fixedLink.waitFor();const urlA=await fixedLink.getAttribute('href')
 assert.ok(urlA)
 assert.equal(await page.evaluate(async url=>await (await fetch(url!)).text(),urlA),fixture.texts[0])
 // A native data-nav anchor exercises the original main navigation/prepare and
 // DOM replacement boundary without importing or calling its internal hooks.
 const navigate=async(path:string)=>{await page.evaluate(path=>{const link=document.createElement('a');link.href=path;link.dataset.nav=path;link.dataset.lifecycleNavigation='';link.textContent='切换已声明原资料';const app=document.querySelector('#app');if(!app)throw Error('实际主页面缺少#app');app.append(link)},path);await page.locator('[data-lifecycle-navigation]').last().click()}
 await navigate(detail(fixture.taskIds[1]))
 await page.getByText('生命周期原始资料B',{exact:true}).waitFor();await fixedLink.waitFor()
 const urlB=await fixedLink.getAttribute('href');assert.ok(urlB);assert.notEqual(urlB,urlA)
 assert.equal(await page.evaluate(async url=>await (await fetch(url!)).text(),urlB),fixture.texts[1])
 await page.waitForFunction(url=>(window as any).__sourceUrlLifecycle.events.some((row:any)=>row.operation==='revoke'&&row.url===url),urlA)
 await navigate('/fcs/quality-management/basic-standards')
 await page.locator('[data-quality-management-page] tbody').waitFor()
 await page.waitForFunction(url=>(window as any).__sourceUrlLifecycle.events.some((row:any)=>row.operation==='revoke'&&row.url===url),urlB)
 const result=await page.evaluate(async({fileIds,texts})=>{
  const state=(window as any).__sourceUrlLifecycle,db=await import('/src/data/pcs-record-db.ts'),files=await db.readPcsFiles(fileIds)
  return {events:state.events,writes:state.writes,files:await Promise.all(files.map(async(row:any)=>({id:row.id,text:await row.blob.text()}))),expected:fileIds.map((id,index)=>({id,text:texts[index]}))}
 },fixture)
 assert.equal(result.writes,0,'原详情/换页/离开不能保存业务或删除原附件')
 for(const url of [urlA,urlB]){const revoked=result.events.filter((row:any)=>row.operation==='revoke'&&row.url===url);assert.ok(revoked.length>=1,'离开后已释放临时URL');assert.ok(revoked.every((row:any)=>!row.stillInDom),'仍显示或可点击的旧DOM不能提前失效')}
 assert.deepEqual(result.files.sort((a:any,b:any)=>a.id.localeCompare(b.id)),result.expected.sort((a:any,b:any)=>a.id.localeCompare(b.id)))
}))

test('原稽查冷直达及刷新仅读指定详情，另页原业务升检后重开不复用陈旧列表',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const fixture=await page.evaluate(async()=>{
  const {f,r,q,actor,linesFor}=(window as any).__postContract
  await f.hydrateProductionContextRecords()
  const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1');rule.initialFullInspection=null
  await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((n:number,line:any)=>n+line.expectedQty,0)===100)
  if(!pending)throw Error('缺少100件原稽查待检来源')
  const task=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor}))
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor,operationId:'cold-audit-round',lines:linesFor(task.qcTaskId,27,3)}))
  const saved=f.getPostFinishingFullFlowQcTask(task.qcTaskId),audit=saved.inspection.audits[0]
  if(!audit||audit.status!=='PENDING')throw Error('实际30件检查没有生成预期待稽查')
  return {taskId:task.qcTaskId,taskNo:task.qcTaskNo,auditId:audit.id,actor,path:'/fcs/quality-management/audits/'+encodeURIComponent('PRODUCTION_RETURN|'+task.qcTaskId+'|'+audit.id)}
 })
 await page.context().addInitScript(()=>{
  ;(window as any).__auditReadonlyWrites=0
  for(const method of ['put','add','delete'] as const){const original=IDBObjectStore.prototype[method];(IDBObjectStore.prototype as any)[method]=function(...args:any[]){(window as any).__auditReadonlyWrites++;return (original as any).apply(this,args)}}
 })
 const assertPending=async()=>{const host=page.locator('[data-quality-management-page]');await host.getByText('稽查与升级记录',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[data-quality-management-page]')?.textContent?.includes('待原业务处理'));assert.match(await host.textContent()||'',/触发第1轮；本轮不合格3件；门槛2件/);assert.equal(await page.evaluate(()=>(window as any).__auditReadonlyWrites),0)}
 await page.goto(base+fixture.path);await assertPending()
 await page.reload();await assertPending()
 const other=await page.context().newPage(),otherErrors:string[]=[];other.on('pageerror',error=>otherErrors.push(error.message))
 try{
  await other.route('**'+route,request=>request.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh"><meta charset="utf-8"><body></body></html>'}))
  await other.goto(base+route);await prepare(other)
  await other.evaluate(async({taskId,actor})=>{const {f,r}=(window as any).__postContract;await f.hydrateProductionContextRecords();await r.runPostFinishingCommand(()=>f.upgradePostFinishingQcInspection({qcTaskId:taskId,actor,nextPercent:50,note:'另页原业务完成本批升检'}))},fixture)
 }finally{await other.close()}
 assert.deepEqual(otherErrors,[])
 const navigate=async(path:string)=>{await page.evaluate(path=>{const link=document.createElement('a');link.href=path;link.dataset.nav=path;link.dataset.auditNavigation='';link.textContent='切换原稽查详情';const app=document.querySelector('#app');if(!app)throw Error('实际主页面缺少#app');app.append(link)},path);await page.locator('[data-audit-navigation]').last().click()}
 await navigate('/fcs/quality-management/basic-standards');await page.locator('[data-quality-management-page] tbody').waitFor()
 await navigate(fixture.path)
 await page.waitForFunction(()=>document.querySelector('[data-quality-management-page]')?.textContent?.includes('另页原业务完成本批升检'))
 const text=await page.locator('[data-quality-management-page]').textContent()||''
 assert.match(text,/已升级/);assert.match(text,/30% → 50%/);assert.doesNotMatch(text,/待原业务处理/)
 assert.equal(await page.evaluate(()=>(window as any).__auditReadonlyWrites),0)
}))

test('独立追检保存后原项被新版删除，同操作同意图仍返回原结果，新操作引用删项拒绝',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,r,q,db,actor,linesFor}=(window as any).__postContract,flow=await import('/src/data/fcs/post-finishing-full-flow.ts')
  await f.hydrateProductionContextRecords()
  const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1');rule.initialFullInspection=null;await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((n:number,line:any)=>n+line.expectedQty,0)===100)
  if(!pending)throw Error('缺少追检原100件QC')
  const task=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor}))
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor,operationId:'followup-original-round',lines:linesFor(task.qcTaskId,30)}))
  const paper=r.registerPostFinishingFile(new Blob(['isolated original signed paper'],{type:'image/png'}));await r.runPostFinishingCommand(()=>f.attachPostFinishingQcSignedPaper({qcTaskId:task.qcTaskId,actor,url:paper,name:'原QC双签纸单.png'}))
  const completed=await r.runPostFinishingCommand(()=>f.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor,processItems:[]}))
  const itemId=completed.inspection.snapshot.items[0].id,request={qcTaskId:task.qcTaskId,actor,objectDescription:'原QC对应已完成实物',scopeDescription:'另行明确的本批10件',itemIds:[itemId],reason:'另行安排的指定项目检查',result:'实际检查无新增问题',operationId:'followup-stable-intent'}
  const first=await r.runPostFinishingCommand(()=>flow.recordPostFinishingIndependentCheck(request))
  const next=q.buildQualityConfigurationDraft('BASIC',completed.inspection.snapshot.basicStandard.id);next.items=next.items.filter((item:any)=>item.id!==itemId)
  await q.saveQualityConfigurationDraft(next);await q.publishQualityConfiguration(next.id)
  const before=f.getPostFinishingFullFlowQcTask(task.qcTaskId),outboundBefore=f.listPostFinishingFullFlowOutboundOrders().filter((row:any)=>row.qcTaskId===task.qcTaskId)
  const retried=await r.runPostFinishingCommand(()=>flow.recordPostFinishingIndependentCheck(request));let newError=''
  try{await r.runPostFinishingCommand(()=>flow.recordPostFinishingIndependentCheck({...request,operationId:'followup-new-deleted-item'}))}catch(error){newError=String(error)}
  await r.ensurePostFinishingRecordState()
  const after=f.getPostFinishingFullFlowQcTask(task.qcTaskId),persisted=(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.qcTaskId===task.qcTaskId)?.value
  return {itemId,first:first.independentChecks,retried:retried.independentChecks,before,after,persisted,newError,outboundBefore,outboundAfter:f.listPostFinishingFullFlowOutboundOrders().filter((row:any)=>row.qcTaskId===task.qcTaskId),freshHasItem:(await q.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN'})).items.some((item:any)=>item.id===itemId)}
 })
 assert.equal(result.freshHasItem,false);assert.deepEqual(result.retried,result.first);assert.equal(result.after.independentChecks.length,1);assert.equal(result.persisted.independentChecks.length,1)
 assert.ok(result.persisted.independentChecks[0].snapshot.items.some((item:any)=>item.id===result.itemId),'原已保存追检继续保留当时项目及依据')
 assert.match(result.newError,/本次有效标准/);assert.equal(result.after.status,'质检完成');assert.deepEqual(result.after.results,result.before.results);assert.deepEqual(result.after.inspection,result.before.inspection);assert.deepEqual(result.outboundAfter,result.outboundBefore)
}))

test('旧后道localStorage不可读且版本未核实则拒绝，原生schema4确证后只读正常且不写种子',{timeout:120000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const db=await import('/src/data/pcs-record-db.ts'),adapter=await import('/src/data/fcs/quality-post-read-source.ts'),source=adapter.postQualityReadSource('PRODUCTION_RETURN')
  await source.prepare();const count=source.list().length,getItem=Storage.prototype.getItem,put=IDBObjectStore.prototype.put,add=IDBObjectStore.prototype.add,del=IDBObjectStore.prototype.delete
  let writes=0,unknownError=''
  const observe=()=>{IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){writes++;return put.apply(this,args)};IDBObjectStore.prototype.add=function(...args:Parameters<typeof add>){writes++;return add.apply(this,args)};IDBObjectStore.prototype.delete=function(...args:Parameters<typeof del>){writes++;return del.apply(this,args)}}
  const restoreWrites=()=>{IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.add=add;IDBObjectStore.prototype.delete=del}
  Storage.prototype.getItem=function(){throw new DOMException('isolated inaccessible legacy source','SecurityError')}
  try{
   observe();try{await source.prepare()}catch(error){unknownError=String(error)}finally{restoreWrites()}
   const unknownWrites=writes,retained=source.list().length===count
   // Explicit isolated current-schema evidence, not an ordinary-read migration.
   await db.commitPcsRecords({puts:[{id:'higood-fcs-post-finishing-records/flow/schemaVersion/value',collection:'flow/schemaVersion',value:4,expectedVersion:0}],deletes:[],operationId:'isolated-verified-current-schema',intent:'declared current record format for inaccessible legacy storage contract'})
   writes=0;observe();await source.prepare();restoreWrites()
   return {unknownError,unknownWrites,retained,knownWrites:writes,count,knownCount:source.list().length}
  }finally{Storage.prototype.getItem=getItem;restoreWrites()}
 })
 assert.match(result.unknownError,/旧后道资料无法核查|读取权限/);assert.equal(result.unknownWrites,0);assert.equal(result.retained,true)
 assert.ok(result.count>0);assert.equal(result.knownCount,result.count);assert.equal(result.knownWrites,0)
}))

test('初始本厂覆盖与全生产单覆盖真实跨两厂：已完不追检，在检抵扣，未开及未来持续全检',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,r,q,db,actor,linesFor}=(window as any).__postContract
  await f.hydrateProductionContextRecords()
  // Production main prepares its actual PCS material/style consumers before
  // source-dependent claim; this raw contract entry must do the same.
  await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
  const source=await import('/src/data/fcs/quality-management-source.ts'),orders=await import('/src/data/fcs/production-orders.ts'),materials=await import('/src/data/pcs-material-archive-repository.ts')
  const context=await import('/src/data/fcs/production-context-records.ts'),cutting=await import('/src/data/fcs/cutting/cutting-record-repository.ts')
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((sum:number,line:any)=>sum+line.expectedQty,0)===100)
  if(!pending)throw Error('范围契约缺少原100件生产回货')
  const originalDelivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.deliveryId===pending.deliveryId),otherFactoryDelivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.sewingFactoryId!==originalDelivery.sewingFactoryId)
  if(!otherFactoryDelivery)throw Error('范围契约缺少第二个真实工厂身份')
  // Declared isolated formal-order fixture: bind a real registered material
  // SKU to this order's original technical version. No latest style version,
  // execution substitute or invented sewing-execution history is used.
  const originalOrder=orders.productionOrders.find((row:any)=>row.productionOrderId===pending.productionOrderId),bound=structuredClone(originalOrder)
  const materialSku=materials.listAllMaterialSkuRecords().find((row:any)=>materials.getMaterialArchiveById(row.materialId)?.kind==='fabric')
  if(!bound?.techPackSnapshot || !materialSku)throw Error('范围契约缺少正式技术版本或真实面料SKU')
  const materialRoot=materials.getMaterialArchiveById(materialSku.materialId)
  bound.selectedTechPackVersionId=bound.techPackSnapshot.sourceTechPackVersionId
  const bomTemplate=bound.techPackSnapshot.bomItems.find((row:any)=>row.type==='面料') || bound.techPackSnapshot.bomItems[0]
  bound.techPackSnapshot.bomItems=[{...bomTemplate,id:'SCOPE-FORMAL-FABRIC',type:'面料',materialSkuId:materialSku.materialSkuId,materialCode:materialSku.materialSkuCode}]
  const contextBefore=await cutting.readCuttingRecords(),formalRows=context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:[bound]}))
  await cutting.commitCuttingRecords({revision:contextBefore.revision,change:{puts:formalRows},command:{id:'isolated-two-factory-formal-bom',intent:'declared isolated original version BOM with real registered material identity',result:null,at:new Date().toISOString()}})
  await f.hydrateProductionContextRecords()
  const resolved=source.resolveProductionInspectionSource({productionOrderId:pending.productionOrderId,taskId:originalDelivery.executionTaskId,factoryId:originalDelivery.sewingFactoryId})
  if(resolved.fabrics.length!==1 || resolved.fabrics[0].status!=='RESOLVED' || resolved.fabrics[0].spu!==materialRoot.materialCode)throw Error('必须由正式原BOM精确解析SPU后再测试覆盖')
  const ns='higood-fcs-post-finishing-records',factoryA=originalDelivery.sewingFactoryId,factoryB=otherFactoryDelivery.sewingFactoryId
  const ids={a:pending.qcTaskId,b:'SCOPE-FACTORY-B-OPEN',done:'SCOPE-ALREADY-COMPLETED',aTrigger:'SCOPE-FACTORY-A-TRIGGER',aWait:'SCOPE-A-UNOPENED',bWait:'SCOPE-B-UNOPENED',bTrigger:'SCOPE-ORDER-TRIGGER',future:'SCOPE-FUTURE-BATCH'}
  // Additional return batches are explicitly synthetic native-storage facts
  // in this isolated browser. Real factory IDs and the same bound order/style
  // are retained; no execution fact is added or claimed to have occurred.
  let nextIsolatedReturnIndex=200
  const insertBatches=async(entries:Array<{id:string;factory:string}>)=>{
   const before=(await db.readPcsRecords([ns])).records,revision=before.find((row:any)=>row.id===ns+'/revision'),puts=[]
   for(const entry of entries){
    const qc=structuredClone(pending),delivery=structuredClone(originalDelivery),second=entry.factory===factoryB
    qc.qcTaskId=entry.id;qc.qcTaskNo=entry.id;qc.deliveryId=entry.id+'-DEL';qc.deliveryOrderNo=entry.id+'-DEL';qc.returnIndex=nextIsolatedReturnIndex++;qc.referenceIds=[]
    delivery.deliveryId=qc.deliveryId;delivery.deliveryOrderNo=qc.deliveryOrderNo;delivery.qcTaskId=qc.qcTaskId;delivery.qcTaskNo=qc.qcTaskNo;delivery.returnIndex=qc.returnIndex;delivery.status='已送检'
    delivery.sewingFactoryId=entry.factory;delivery.sewingFactoryName=second?otherFactoryDelivery.sewingFactoryName:originalDelivery.sewingFactoryName
    delivery.executionTaskId=second?'ISOLATED-SCOPE-B-EXECUTION-ALIAS':originalDelivery.executionTaskId
    puts.push({id:ns+'/flow/qcTasks/'+encodeURIComponent(qc.qcTaskId),collection:'flow/qcTasks',value:qc,expectedVersion:0},{id:ns+'/flow/deliveries/'+encodeURIComponent(delivery.deliveryId),collection:'flow/deliveries',value:delivery,expectedVersion:0})
   }
   puts.push({id:ns+'/revision',collection:'revision',value:{format:1},expectedVersion:revision?.version||0})
   await db.commitPcsRecords({puts,deletes:[],operationId:'isolated-scope-batches-'+entries.map(row=>row.id).join('-'),intent:'explicit same style/order return batch fixtures across two registered factories'})
   await r.ensurePostFinishingRecordState();if(r.getPostFinishingStorageFailure())throw Error(r.getPostFinishingStorageFailure())
  }
  await insertBatches([{id:ids.b,factory:factoryB},{id:ids.done,factory:factoryA},{id:ids.aTrigger,factory:factoryA},{id:ids.aWait,factory:factoryA},{id:ids.bWait,factory:factoryB},{id:ids.bTrigger,factory:factoryB}])
  const publish=async(initial:any)=>{const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1');rule.initialFullInspection=initial;await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)}
  await publish(null)
  const actors=new Map<string,any>(),open=async(id:string)=>{const owner={...actor,actorId:'SCOPE-OWNER-'+id,actorName:'隔离范围QC '+id};actors.set(id,owner);return r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:f.getPostFinishingFullFlowQcTask(id).qcTaskNo,actor:owner}))}
  const check=async(id:string,qty:number)=>r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:id,actor:actors.get(id),operationId:'scope-round-'+id+'-'+qty,lines:linesFor(id,qty)}))
  const a=await open(ids.a),b=await open(ids.b);await check(ids.a,30);await check(ids.b,30)
  await open(ids.done);await check(ids.done,30)
  const paper=r.registerPostFinishingFile(new Blob(['isolated completed batch signed-paper fixture'],{type:'image/png'}))
  await r.runPostFinishingCommand(()=>f.attachPostFinishingQcSignedPaper({qcTaskId:ids.done,actor:actors.get(ids.done),url:paper,name:'覆盖前已完成批次纸单.png'}))
  await r.runPostFinishingCommand(()=>f.completePostFinishingQcTask({qcTaskId:ids.done,actor:actors.get(ids.done),processItems:[]}))
  const completedSignature=()=>{const task=f.getPostFinishingFullFlowQcTask(ids.done);return JSON.stringify({...task,inspection:{...task.inspection,papers:task.inspection.papers.map(({url,...paper}:any)=>paper)}})}
  const completedBefore=completedSignature(),fixedA=JSON.stringify(a.inspection.snapshot),fixedB=JSON.stringify(b.inspection.snapshot)
  await publish({basicStyle:false,highDifficulty:false,outsideFabricWhitelist:false,firstFactoryTasks:true,firstTaskCount:3,fabricSpuWhitelist:[]})
  await open(ids.aTrigger)
  const factoryOnly={a:f.getPostFinishingQcInspectionSummary(ids.a),b:f.getPostFinishingQcInspectionSummary(ids.b),doneUnchanged:completedSignature()===completedBefore,aWaiting:(await open(ids.aWait)).inspection.percent,bUnopened:f.getPostFinishingFullFlowQcTask(ids.bWait).inspection===undefined}
  // FULL-031: install only legal NOT_STARTED task/order fixtures, then invoke
  // the original actual-start command four times. Execution facts and ordinal
  // allocation are created solely by that original same-database command.
  const runtime=await import('/src/data/fcs/runtime-process-tasks.ts'),history=await import('/src/data/fcs/sewing-execution-history.ts')
  const runtimeTemplate=runtime.listRuntimeProcessTasks().find((row:any)=>row.processBusinessCode==='SEW'&&!row.isSplitSource)
  if(!runtimeTemplate || history.listSewingExecutionFacts(factoryA).length)throw Error('后续序次契约需要合法原任务模板和未预造执行事实的工厂')
  const taskIds=Array.from({length:4},(_,index)=>'SCOPE-ACTUAL-START-'+(index+1)),extraOrders=taskIds.slice(1).map((_,index)=>{
   const value=structuredClone(bound),id='SCOPE-LATER-REAL-ORDER-'+(index+2);value.productionOrderId=id;value.productionOrderNo=id;value.status='WAIT_ASSIGNMENT';value.auditLogs=[];value.techPackSnapshot.productionOrderId=id;value.techPackSnapshot.productionOrderNo=id;return value
  })
  orders.validatePersistedProductionOrders(extraOrders)
  const runtimeBefore=JSON.parse(context.productionContextStorage.getItem(context.PRODUCTION_CONTEXT_KEYS.runtime)||'{"version":1,"taskOverrides":[],"splitPlans":[],"mergedPlans":[],"reassignedTasks":[],"auditSeq":0}')
  const tasks=taskIds.map((taskId,index)=>({...structuredClone(runtimeTemplate),taskId,baseTaskId:taskId,scopeKey:taskId,productionOrderId:index?extraOrders[index-1].productionOrderId:bound.productionOrderId,executionEnabled:true,isSplitSource:false,isSplitResult:false,mergedIntoTaskId:undefined,assignedFactoryId:factoryA,assignedFactoryName:originalDelivery.sewingFactoryName,assignmentStatus:'ASSIGNED',acceptanceStatus:'ACCEPTED',status:'NOT_STARTED',startedAt:undefined,finishedAt:undefined,dependsOnTaskIds:[],baseDependsOnTaskIds:[],auditLogs:[]}))
  runtimeBefore.reassignedTasks.push(...tasks.map(task=>[task.taskId,task]))
  const futureRows=[...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify(runtimeBefore)),...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:extraOrders}))],beforeStarts=await cutting.readCuttingRecords()
  await cutting.commitCuttingRecords({revision:beforeStarts.revision,change:{puts:futureRows},command:{id:'isolated-future-actual-start-tasks',intent:'explicit legal assigned accepted NOT_STARTED tasks only; no execution facts',result:taskIds,at:new Date().toISOString()}})
  await context.hydrateProductionContextRecords()
  const captureStart=()=>({runtime:runtime.captureRuntimeDirectDispatchState(),orders:orders.captureProductionOrderPersistenceState()}),restoreStart=(value:any)=>{runtime.restoreRuntimeDirectDispatchState(value.runtime,false);orders.restoreProductionOrderPersistenceState(value.orders)}
  const coveragesBeforeMoreTasks=(await db.readPcsRecords([ns])).records.filter((row:any)=>row.collection==='flow/fullCoverages')
  for(const [index,taskId] of taskIds.entries())await context.saveProductionContextAction({id:'scope-original-manual-start-'+taskId,intent:'original actual manual start '+taskId,capture:captureStart,restore:restoreStart,action:()=>runtime.recordRuntimeTaskExecution(taskId,{status:'IN_PROGRESS',startedAt:'2026-10-22T01:00:00Z',updatedAt:'2026-10-22T01:00:00Z',auditLogs:[{id:'SCOPE-START-AUDIT-'+index,by:'隔离原开工人',at:'2026-10-22T01:00:00Z',action:'START',detail:'原公开实际开工命令，不是现场证明'}] as any})})
  const afterMoreTasks={facts:history.listSewingExecutionFacts(factoryA),oldSource:source.resolveProductionInspectionSource({productionOrderId:bound.productionOrderId,taskId:originalDelivery.executionTaskId,factoryId:factoryA}),a:f.getPostFinishingQcInspectionSummary(ids.a),b:f.getPostFinishingQcInspectionSummary(ids.b),coveragesUnchanged:JSON.stringify(coveragesBeforeMoreTasks)===JSON.stringify((await db.readPcsRecords([ns])).records.filter((row:any)=>row.collection==='flow/fullCoverages'))}
  await publish({basicStyle:false,highDifficulty:false,outsideFabricWhitelist:true,firstFactoryTasks:false,firstTaskCount:3,fabricSpuWhitelist:[]})
  await open(ids.bTrigger)
  const wholeOrder={a:f.getPostFinishingQcInspectionSummary(ids.a),b:f.getPostFinishingQcInspectionSummary(ids.b),bWaiting:(await open(ids.bWait)).inspection.percent,doneUnchanged:completedSignature()===completedBefore}
  await insertBatches([{id:ids.future,factory:factoryB}]);const future=await open(ids.future)
  // Disable the source conditions after coverage exists. Persisted coverage
  // remains effective; no source sequence change can revoke this fixed fact.
  await publish(null)
  const persisted=(await db.readPcsRecords([ns])).records,coverages=persisted.filter((row:any)=>row.collection==='flow/fullCoverages').map((row:any)=>row.value)
  return {ids,factoryA,factoryB,factoryOnly,afterMoreTasks,wholeOrder,future:future.inspection.percent,completedBefore,unchangedA:JSON.stringify(f.getPostFinishingFullFlowQcTask(ids.a).inspection.snapshot)===fixedA,unchangedB:JSON.stringify(f.getPostFinishingFullFlowQcTask(ids.b).inspection.snapshot)===fixedB,afterConditionsOff:{a:f.getPostFinishingQcInspectionSummary(ids.a).target,b:f.getPostFinishingQcInspectionSummary(ids.b).target},coverages,techPackVersionId:resolved.techPackVersionId,rootSpu:materialRoot.materialCode}
 })
 assert.deepEqual([result.factoryOnly.a.target,result.factoryOnly.a.inspectedQty,result.factoryOnly.a.remainingQty,result.factoryOnly.b.target,result.factoryOnly.b.inspectedQty,result.factoryOnly.b.remainingQty],[100,30,70,30,30,0])
 assert.equal(result.factoryOnly.doneUnchanged,true);assert.equal(result.factoryOnly.aWaiting,100);assert.equal(result.factoryOnly.bUnopened,true)
 assert.deepEqual(result.afterMoreTasks.facts.map((fact:any)=>fact.ordinal).sort(),[1,2,3,4]);assert.equal(result.afterMoreTasks.oldSource.executionStatus,'RECORDED');assert.equal(result.afterMoreTasks.oldSource.executionOrdinal,1)
 assert.equal(result.afterMoreTasks.coveragesUnchanged,true);assert.equal(result.afterMoreTasks.a.target,100);assert.equal(result.afterMoreTasks.b.target,30)
 for(const summary of [result.wholeOrder.a,result.wholeOrder.b])assert.deepEqual([summary.target,summary.inspectedQty,summary.remainingQty],[100,30,70])
 assert.equal(result.wholeOrder.bWaiting,100);assert.equal(result.wholeOrder.doneUnchanged,true);assert.equal(result.future,100);assert.equal(result.unchangedA,true);assert.equal(result.unchangedB,true);assert.deepEqual(result.afterConditionsOff,{a:100,b:100})
 const factory=result.coverages.filter((row:any)=>row.code==='FIRST_FACTORY_TASKS'),whole=result.coverages.filter((row:any)=>row.code==='OUTSIDE_FABRIC_WHITELIST')
 assert.equal(factory.length,1);assert.equal(factory[0].scope,'FACTORY_PRODUCTION_ORDER');assert.equal(factory[0].factoryId,result.factoryA)
 assert.equal(whole.length,1);assert.equal(whole[0].scope,'PRODUCTION_ORDER');assert.equal(whole[0].factoryId,undefined);assert.deepEqual(whole[0].fabricSpus,[result.rootSpu]);assert.equal(whole[0].techPackVersionId,result.techPackVersionId)
 await page.reload()
 const refreshed=await page.evaluate(async(ids:any)=>{const f=await import('/src/data/fcs/post-finishing-inventory-bridge.ts');await f.ensurePostFinishingRecordState();if(f.getPostFinishingStorageFailure())throw Error(f.getPostFinishingStorageFailure());const done=f.getPostFinishingFullFlowQcTask(ids.done);return {a:f.getPostFinishingQcInspectionSummary(ids.a),b:f.getPostFinishingQcInspectionSummary(ids.b),future:f.getPostFinishingQcInspectionSummary(ids.future),done:JSON.stringify({...done,inspection:{...done.inspection,papers:done.inspection.papers.map(({url,...paper}:any)=>paper)}})}},result.ids)
 for(const summary of [refreshed.a,refreshed.b])assert.deepEqual([summary.target,summary.inspectedQty,summary.remainingQty],[100,30,70])
 assert.equal(refreshed.future.target,100);assert.equal(refreshed.done,result.completedBefore)
}))

test('分环节规则实际发布20/25，生产三轮自定义门槛与20/40/60/80档；普通升检保持另一批/另一申请/产前版原记录不变',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,r,q,db,actor,linesFor}=(window as any).__postContract
  await f.hydrateProductionContextRecords();await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
  const productionRule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1')
  productionRule.initialFullInspection=null;productionRule.defaultPercent=20;productionRule.percentSteps=[20,40,60,80,100]
  productionRule.roundThresholds=[{roundNumber:1,unqualifiedQuantity:2},{roundNumber:2,unqualifiedQuantity:2},{roundNumber:3,unqualifiedQuantity:1}]
  await q.saveQualityConfigurationDraft(productionRule);await q.publishQualityConfiguration(productionRule.id)
  const inventoryRule=q.buildQualityConfigurationDraft('RULE','warehouse-stock-rule-v1')
  inventoryRule.defaultPercent=25;inventoryRule.percentSteps=[25,50,100];inventoryRule.roundThresholds=[{roundNumber:1,unqualifiedQuantity:1},{roundNumber:2,unqualifiedQuantity:3}]
  await q.saveQualityConfigurationDraft(inventoryRule);await q.publishQualityConfiguration(inventoryRule.id)
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((sum:number,line:any)=>sum+line.expectedQty,0)===100)
  if(!pending)throw Error('分环节规则契约缺原100件生产回货')
  const sourceDelivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.deliveryId===pending.deliveryId),peer=structuredClone(pending),peerDelivery=structuredClone(sourceDelivery)
  peer.qcTaskId='SAMPLING-PEER-PRODUCTION-QC';peer.qcTaskNo=peer.qcTaskId;peer.deliveryId='SAMPLING-PEER-PRODUCTION-DEL';peer.deliveryOrderNo=peer.deliveryId;peer.returnIndex=501;peer.referenceIds=[]
  Object.assign(peerDelivery,{deliveryId:peer.deliveryId,deliveryOrderNo:peer.deliveryOrderNo,qcTaskId:peer.qcTaskId,qcTaskNo:peer.qcTaskNo,returnIndex:peer.returnIndex,status:'已送检'})
  const post='higood-fcs-post-finishing-records',beforeFixture=(await db.readPcsRecords([post])).records,revision=beforeFixture.find((row:any)=>row.id===post+'/revision')
  await db.commitPcsRecords({puts:[{id:post+'/flow/qcTasks/'+encodeURIComponent(peer.qcTaskId),collection:'flow/qcTasks',value:peer,expectedVersion:0},{id:post+'/flow/deliveries/'+encodeURIComponent(peerDelivery.deliveryId),collection:'flow/deliveries',value:peerDelivery,expectedVersion:0},{id:post+'/revision',collection:'revision',value:{format:1},expectedVersion:revision?.version||0}],deletes:[],operationId:'sampling-peer-production-return-fixture',intent:'explicit isolated second return of the same production task; no execution history inserted'})
  await r.ensurePostFinishingRecordState()
  const productionActor={...actor,actorId:'SMP-PRODUCTION-A'},productionPeerActor={...actor,actorId:'SMP-PRODUCTION-B'}
  const p=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor:productionActor})),pPeer=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:peer.qcTaskNo,actor:productionPeerActor}))
  const productionInitialTarget=f.getPostFinishingQcInspectionSummary(p.qcTaskId).target
  await f.preparePostFinishingInventoryBridge();await r.ensurePostFinishingRecordState()
  const inventory=[] as any[],seenScopes=new Set<string>(),wh={actorId:'SMP-WH',actorName:'隔离仓管',roleName:'仓库收货人员'}
  for(const lot of f.listFinishedInventoryLots()){
   const key=lot.warehouseId+'::'+lot.styleId;if(seenScopes.has(key))continue;seenScopes.add(key)
   const preview=f.previewFinishedInventoryQuality(lot.warehouseId,lot.styleId);if(!preview.eligibleQty)continue
   const app=await f.runFinishedInventoryCommand(()=>f.createFinishedInventoryQualityApplication({preview,operationId:'sampling-real-application-'+inventory.length,actor:wh}))
   const received=await f.runFinishedInventoryCommand(()=>f.receiveFinishedInventoryQualityApplication({applicationId:app.id,quantities:app.lines.map((line:any)=>({skuId:line.skuId,quantity:line.outboundQty})),actor:wh}))
   const owner={...actor,actorId:'SMP-INVENTORY-'+inventory.length},task=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:received.qcTaskNo,actor:owner}))
   inventory.push({app,task,owner});if(inventory.length===2)break
  }
  if(inventory.length!==2 || inventory[0].app.id===inventory[1].app.id)throw Error('必须由两个真实资格款分别创建不同库存申请，不用复制申请冒充对照')
  // Persist an actual other-stage inspection through its original public claim
  // command. Defaults are only static legal starting states; no sample snapshot
  // is injected directly into the database for this peer-isolation assertion.
  const demo=await import('/src/data/fcs/sewing-outsourcing-demo.ts'),samples=await import('/src/data/fcs/sewing-sample-approval-suggestion.ts'),context=await import('/src/data/fcs/production-context-records.ts'),cutting=await import('/src/data/fcs/cutting/cutting-record-repository.ts')
  demo.ensureSewingOutsourcingSampleDemo()
  const handed=samples.listSewingSampleApprovalRecords().find((row:any)=>row.sample.status==='HANDED_TO_APPROVER')
  if(!handed)throw Error('必须使用原已转交的合法产前版状态作为另一环节对照')
  const sampleSnapshot=q.readPreparedInspectionSnapshot({sourceKind:'PRE_PRODUCTION_SAMPLE',styleId:handed.sample.styleId,styleCode:handed.sample.styleCode})
  const sample=await context.saveProductionContextAction({id:'sampling-peer-original-sample-claim',intent:'原产前版领取形成实际持久另一环节记录',capture:samples.captureSewingSampleState,restore:value=>samples.restoreSewingSampleState(value as any),action:()=>samples.startSampleApproval({commandId:'sampling-peer-original-sample-claim',assignmentId:handed.assignmentId,actor:{actorId:'SMP-PP',actorName:'隔离批版人',role:'SAMPLE_APPROVER'},receivedAt:'2026-10-22T01:00:00Z',inspectionStandardSnapshot:sampleSnapshot})})
  const sampleId='production-context:samples:'+sample.assignmentId
  const originalSampleRows=await cutting.readCuttingRecords();if(!originalSampleRows.records.some(row=>row.id===sampleId))throw Error('产前版必须已经原库真实持久保存')
  const signature=async(ids:string[])=>{
   const rows=(await db.readPcsRecords([post,f.FINISHED_INVENTORY_NAMESPACE])).records
   return JSON.stringify({qc:ids.map(id=>{const row=rows.find((row:any)=>row.id===post+'/flow/qcTasks/'+encodeURIComponent(id));if(!row)throw Error('peer缺少真实持久QC：'+id);return row}),inventory:rows.filter((row:any)=>row.id.startsWith(f.FINISHED_INVENTORY_NAMESPACE+'/')).sort((a:any,b:any)=>a.id.localeCompare(b.id)),sample:await cutting.readCuttingRecords()})
  }
  const peerIds=[pPeer.qcTaskId,inventory[0].task.qcTaskId,inventory[1].task.qcTaskId],allPeersBefore=await signature(peerIds)
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:p.qcTaskId,actor:productionActor,operationId:'custom-stage-r1',lines:linesFor(p.qcTaskId,18,2)}))
  const firstAudit=f.getPostFinishingQcInspectionSummary(p.qcTaskId).pendingAudit
  await r.runPostFinishingCommand(()=>f.upgradePostFinishingQcInspection({qcTaskId:p.qcTaskId,actor:productionActor,nextPercent:40,note:'本批自定义40档'}))
  const firstIsolation=allPeersBefore===await signature(peerIds),after40=f.getPostFinishingQcInspectionSummary(p.qcTaskId)
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:p.qcTaskId,actor:productionActor,operationId:'custom-stage-r2',lines:linesFor(p.qcTaskId,18,0,2)}))
  const secondAudit=f.getPostFinishingQcInspectionSummary(p.qcTaskId).pendingAudit
  await r.runPostFinishingCommand(()=>f.upgradePostFinishingQcInspection({qcTaskId:p.qcTaskId,actor:productionActor,nextPercent:60,note:'本批自定义60档'}))
  const after60=f.getPostFinishingQcInspectionSummary(p.qcTaskId)
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:p.qcTaskId,actor:productionActor,operationId:'custom-stage-r3',lines:linesFor(p.qcTaskId,19,1)}))
  const thirdAudit=f.getPostFinishingQcInspectionSummary(p.qcTaskId).pendingAudit
  await r.runPostFinishingCommand(()=>f.upgradePostFinishingQcInspection({qcTaskId:p.qcTaskId,actor:productionActor,nextPercent:80,note:'本批自定义第三轮门槛1命中后升80档'}))
  const after80=f.getPostFinishingQcInspectionSummary(p.qcTaskId),productionIsolation=allPeersBefore===await signature(peerIds)
  const inv=inventory[0],invPeer=inventory[1],inventoryTarget=f.getPostFinishingQcInspectionSummary(inv.task.qcTaskId).target
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:inv.task.qcTaskId,actor:inv.owner,operationId:'custom-inventory-r1',lines:linesFor(inv.task.qcTaskId,inventoryTarget-1,1)}))
  const stockPeers=[p.qcTaskId,pPeer.qcTaskId,invPeer.task.qcTaskId],stockBefore=await signature(stockPeers)
  await r.runPostFinishingCommand(()=>f.upgradePostFinishingQcInspection({qcTaskId:inv.task.qcTaskId,actor:inv.owner,nextPercent:50,note:'仅本库存申请升50'}))
  const inventoryIsolation=stockBefore===await signature(stockPeers),stockAfter=f.getPostFinishingQcInspectionSummary(inv.task.qcTaskId),saved=(await db.readPcsRecords([post])).records
  return {ids:{production:p.qcTaskId,productionPeer:pPeer.qcTaskId,inventory:inv.task.qcTaskId,inventoryPeer:invPeer.task.qcTaskId,sample:sample.assignmentId},rules:{production:p.inspection.snapshot.ruleSnapshot,inventory:inv.task.inspection.snapshot.ruleSnapshot,sample:sample.inspectionStandardSnapshot.ruleSnapshot},initialTargets:{production:productionInitialTarget,productionPeer:f.getPostFinishingQcInspectionSummary(pPeer.qcTaskId).target,inventory:inventoryTarget,inventoryQuantity:f.getPostFinishingQcInspectionSummary(inv.task.qcTaskId).quantity,inventoryPeer:f.getPostFinishingQcInspectionSummary(invPeer.task.qcTaskId)},firstAudit,secondAudit,thirdAudit,after40,after60,after80,stockAfter,firstIsolation,productionIsolation,inventoryIsolation,savedProduction:saved.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.qcTaskId===p.qcTaskId).value,savedInventory:saved.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.qcTaskId===inv.task.qcTaskId).value}
 })
 // SMP-002: separately published source/stage rules really govern execution.
 assert.equal(result.rules.production.defaultPercent,20);assert.equal(result.rules.inventory.defaultPercent,25);assert.equal(result.rules.sample,null)
 assert.equal(result.initialTargets.production,20);assert.equal(result.initialTargets.productionPeer,20);assert.equal(result.initialTargets.inventory,Math.ceil(result.initialTargets.inventoryQuantity*.25));assert.equal(result.initialTargets.inventoryPeer.target,Math.ceil(result.initialTargets.inventoryPeer.quantity*.25))
 // SMP-014: the configured third-round threshold is reached by that round's
 // new one defective garment, independently of four earlier failed garments.
 assert.deepEqual([result.firstAudit.roundNumber,result.firstAudit.threshold,result.firstAudit.unqualifiedQty],[1,2,2]);assert.deepEqual([result.secondAudit.roundNumber,result.secondAudit.threshold,result.secondAudit.unqualifiedQty],[2,2,2]);assert.deepEqual([result.thirdAudit.roundNumber,result.thirdAudit.threshold,result.thirdAudit.unqualifiedQty],[3,1,1])
 // SMP-020: effective non-default steps 40/60/80 each alter the cumulative target.
 assert.deepEqual([result.after40.target,result.after40.inspectedQty,result.after40.remainingQty],[40,20,20]);assert.deepEqual([result.after60.target,result.after60.inspectedQty,result.after60.remainingQty],[60,40,20]);assert.deepEqual([result.after80.target,result.after80.inspectedQty,result.after80.remainingQty],[80,60,20])
 assert.deepEqual(result.savedProduction.inspection.rounds.map((row:any)=>row.lines.reduce((n:number,line:any)=>n+line.passedQty+line.defectQty+line.returnQty,0)),[20,20,20]);assert.deepEqual(result.savedProduction.inspection.audits.map((row:any)=>[row.roundNumber,row.threshold,row.toPercent]),[[1,2,40],[2,2,60],[3,1,80]])
 // SMP-030/031/032: compare native peer records including their versions,
 // both real inventory applications/transfers and actual other-stage records.
 assert.equal(result.firstIsolation,true);assert.equal(result.productionIsolation,true);assert.equal(result.inventoryIsolation,true)
 assert.equal(result.savedInventory.inspection.percent,50);assert.equal(result.stockAfter.target,Math.ceil(result.stockAfter.quantity*.5));assert.equal(result.stockAfter.inspectedQty,result.initialTargets.inventory)
 await page.reload()
 const refreshed=await page.evaluate(async(ids:any)=>{const f=await import('/src/data/fcs/post-finishing-inventory-bridge.ts');await f.ensurePostFinishingRecordState();if(f.getPostFinishingStorageFailure())throw Error(f.getPostFinishingStorageFailure());const cutting=await import('/src/data/fcs/cutting/cutting-record-repository.ts'),sample=(await cutting.readCuttingRecords()).records.find(row=>row.id==='production-context:samples:'+ids.sample);return {production:f.getPostFinishingFullFlowQcTask(ids.production).inspection,productionPeer:f.getPostFinishingFullFlowQcTask(ids.productionPeer).inspection,inventory:f.getPostFinishingFullFlowQcTask(ids.inventory).inspection,inventoryPeer:f.getPostFinishingFullFlowQcTask(ids.inventoryPeer).inspection,sample:(sample?.value as any)?.inspectionStandardSnapshot.ruleSnapshot}},result.ids)
 assert.equal(refreshed.production.percent,80);assert.equal(refreshed.productionPeer.percent,20);assert.equal(refreshed.inventory.percent,50);assert.equal(refreshed.inventoryPeer.percent,25);assert.equal(refreshed.sample,null)
 assert.deepEqual(refreshed.production.snapshot.ruleSnapshot.percentSteps,[20,40,60,80,100]);assert.deepEqual(refreshed.production.snapshot.ruleSnapshot.roundThresholds.map((row:any)=>[row.roundNumber,row.unqualifiedQuantity]),[[1,2],[2,2],[3,1]])
}))

test('同SKU两标签并发准备出货：原生CAS只一笔占15/20，重读超余量拒绝，余5重试和两待交仓守恒',{timeout:120000},()=>isolated(async first=>{
 const bootstrap=async(page:Page)=>{
  await prepare(page)
  await page.evaluate(async()=>{
   const r=await import('/src/data/fcs/post-finishing-records.ts'),f=await import('/src/data/fcs/post-finishing-full-flow.ts'),db=await import('/src/data/pcs-record-db.ts')
   await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState();await r.ensurePostFinishingRecordState()
   ;(window as any).__outboundRace={r,f,db}
  })
 }
 await bootstrap(first)
 const fixture=await first.evaluate(async()=>{
  const {r,f,db}=(window as any).__outboundRace,{q,linesFor,actor}=(window as any).__postContract
  await (window as any).__postContract.f.hydrateProductionContextRecords()
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((n:number,line:any)=>n+line.expectedQty,0)===100)
  if(!pending)throw Error('并发出货需要原100件已确认生产回货')
  const qc=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor}))
  const summary=f.getPostFinishingQcInspectionSummary(qc.qcTaskId)
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor,operationId:'out-race-qc-round',lines:linesFor(qc.qcTaskId,summary.target)}))
  const paper=r.registerPostFinishingFile(new Blob(['isolated outgoing race paper'],{type:'image/png'}))
  await r.runPostFinishingCommand(()=>f.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor,url:paper,name:'并发出货前原QC纸单.png'}))
  const done=await r.runPostFinishingCommand(()=>f.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor,processItems:['包装']})),post=f.getPostFinishingFullFlowPostTask(done.postTaskId)
  const worker={actorId:'OUT-RACE-WORKER',actorName:'隔离后道人员',roleName:'后道操作员'}
  await r.runPostFinishingCommand(()=>f.appendPostFinishingProcessCompletion({postTaskId:post.postTaskId,processItem:'包装',quantities:post.lines.map((line:any)=>({skuId:line.sku.skuId,quantity:line.expectedQty})),responsible:worker,actor:worker,operationId:'out-race-original-pack'}))
  const firstSku=f.getPostFinishingProcessProgress(post.postTaskId).lines[0]
  if(firstSku.availableForOutboundQty!==20)throw Error('并发契约必须从同一SKU实际可出20件开始')
  const rows=(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
  return {postTaskId:post.postTaskId,qcTaskId:qc.qcTaskId,skuId:firstSku.sku.skuId,worker,processRows:rows.filter((row:any)=>row.collection==='flow/processCompletions'),qcRow:rows.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.qcTaskId===qc.qcTaskId)}
 })
 const second=await first.context().newPage();await second.route('**'+route,request=>request.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh"><body></body></html>'}));await second.goto(base+route);await bootstrap(second)
 const arm=async(page:Page,intent:string)=>page.evaluate(intent=>{
  const digest=crypto.subtle.digest.bind(crypto.subtle);let release:(()=>void)|undefined;const barrier=new Promise<void>(resolve=>{release=resolve})
  ;(window as any).__outboundDigest={blocked:false,release,restore:()=>{crypto.subtle.digest=digest}}
  crypto.subtle.digest=async function(algorithm:AlgorithmIdentifier,data:BufferSource){const bytes=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);if(new TextDecoder().decode(bytes)===intent){(window as any).__outboundDigest.blocked=true;await barrier}return digest(algorithm,data)}
 },intent)
 await arm(first,'OUT-RACE-INTENT-A');await arm(second,'OUT-RACE-INTENT-B')
 const allocate=(page:Page,side:string,quantity:number,operationId='OUT-RACE-ALLOC-'+side)=>page.evaluate(async({fixture,side,quantity,operationId})=>{
  const {f,r}=(window as any).__outboundRace
  try{const order=await r.runPostFinishingCommand(()=>f.submitPostFinishingForOutbound({postTaskId:fixture.postTaskId,quantities:[{skuId:fixture.skuId,quantity}],actor:fixture.worker,operationId}),{operationId:'OUT-RACE-COMMIT-'+side,intent:'OUT-RACE-INTENT-'+side});return{ok:true,order}}
  catch(error){return{ok:false,error:String(error)}}
 },{fixture,side,quantity,operationId})
 const pendingA=allocate(first,'A',15),pendingB=allocate(second,'B',15)
 await first.waitForFunction(()=>(window as any).__outboundDigest.blocked);await second.waitForFunction(()=>(window as any).__outboundDigest.blocked)
 await Promise.all([first.evaluate(()=>(window as any).__outboundDigest.release()),second.evaluate(()=>(window as any).__outboundDigest.release())])
 const outcomes=await Promise.all([pendingA,pendingB])
 await Promise.all([first.evaluate(()=>(window as any).__outboundDigest.restore()),second.evaluate(()=>(window as any).__outboundDigest.restore())])
 assert.equal(outcomes.filter(row=>row.ok).length,1);assert.match(outcomes.find(row=>!row.ok)!.error!,/其他页面|重新读取|版本|冲突/)
 const loserIndex=outcomes.findIndex(row=>!row.ok),loser=loserIndex?second:first,side=loserIndex?'B':'A'
 const capture=(page:Page)=>page.evaluate(async fixture=>{
  const {f,r,db}=(window as any).__outboundRace;await r.ensurePostFinishingRecordState();if(r.getPostFinishingStorageFailure())throw Error(r.getPostFinishingStorageFailure())
  const rows=(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records,orders=f.listPostFinishingFullFlowOutboundOrders().filter((row:any)=>row.postTaskId===fixture.postTaskId),stocks=f.listPostFinishingWaitHandoverWarehouseRecords().filter((row:any)=>row.postTaskId===fixture.postTaskId)
  return {orders,stocks,progress:f.getPostFinishingProcessProgress(fixture.postTaskId),processRows:rows.filter((row:any)=>row.collection==='flow/processCompletions'),qcRow:rows.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.qcTaskId===fixture.qcTaskId)}
 },fixture)
 const one=await capture(loser),selected=one.progress.lines.find((line:any)=>line.sku.skuId===fixture.skuId)
 assert.equal(one.orders.length,1);assert.equal(one.stocks.length,1);assert.equal(one.orders[0].lines[0].outboundQty,15);assert.equal(selected.availableForOutboundQty,5)
 const exceeded=await allocate(loser,side,15);assert.equal(exceeded.ok,false);assert.match(exceeded.error!,/超过.*SKU|超过该SKU|可.*数量/)
 const stillOne=await capture(loser);assert.deepEqual(stillOne,one)
 const retried=await allocate(loser,'REMAINDER',5,'OUT-RACE-REMAINDER-5');assert.equal(retried.ok,true)
 await loser.reload();await bootstrap(loser);const final=await capture(loser)
 assert.equal(final.orders.length,2);assert.equal(final.stocks.length,2);assert.deepEqual(final.processRows,fixture.processRows);assert.deepEqual(final.qcRow,fixture.qcRow)
 assert.deepEqual(final.orders.map((row:any)=>row.sequence).sort(),[1,2]);assert.deepEqual(final.orders.map((row:any)=>row.lines.reduce((n:number,line:any)=>n+line.outboundQty,0)).sort((a:number,b:number)=>a-b),[5,15])
 assert.ok(final.orders.every((row:any)=>row.status==='待出货'&&!row.dispatchedAt&&!row.receivedAt&&row.lines.length===1&&row.lines[0].sku.skuId===fixture.skuId))
 for(const order of final.orders){const stock=final.stocks.find((row:any)=>row.outboundOrderId===order.outboundOrderId);assert.ok(stock);assert.equal(stock.status,'待交出');assert.equal(stock.lines[0].inboundQty,order.lines[0].outboundQty);assert.equal(stock.lines[0].availableQty,order.lines[0].outboundQty);assert.equal(stock.lines[0].handedOverQty,0)}
 const finalLine=final.progress.lines.find((line:any)=>line.sku.skuId===fixture.skuId);assert.deepEqual([finalLine.completedQty,finalLine.reservedQty,finalLine.availableForOutboundQty],[20,20,0])
 assert.ok(final.progress.lines.filter((line:any)=>line.sku.skuId!==fixture.skuId).every((line:any)=>line.reservedQty===0&&line.availableForOutboundQty===line.completedQty))
 await second.close()
}))

test('QC025原历史财务/处罚读取不删：真实旧复检转换及新QC完成前后原数组/结论和无关PCS保护记录均保持',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const bootstrapFinance=async()=>page.evaluate(async()=>{
  const chain=await import('/src/data/fcs/quality-chain-adapter.ts'),repo=await import('/src/data/fcs/quality-deduction-repository.ts'),shared=await import('/src/data/fcs/quality-deduction-shared-facts.ts'),legacy=await import('/src/data/fcs/store-domain-quality-seeds.ts')
  const read=()=>{
   // Original legacy readers synchronize their own existing lifecycle first.
   // This comparison starts after that normal read, never from an artificially
   // frozen/pre-lifecycle default or a newly invented financial amount.
   repo.listQualityDeductionCaseFacts()
   const conclusions=['QC-020','QC-021'].map(qcId=>({qcId,qc:chain.getQcById(qcId),chain:chain.getQcChainFact(qcId),basis:chain.getLinkedBasisItems(qcId),settlement:chain.getSettlementImpactByQcId(qcId)}))
   return {conclusions,originals:{cases:shared.qualityDeductionSharedCaseFacts,qc:shared.qualityDeductionSharedQcRecords,responses:shared.qualityDeductionSharedFactoryResponses,bases:shared.qualityDeductionSharedDeductionBases,disputes:shared.qualityDeductionSharedDisputeCases,pending:shared.qualityDeductionSharedPendingDeductionRecords,ledgers:shared.qualityDeductionSharedFormalLedgers,impacts:shared.qualityDeductionSharedSettlementImpacts,adjustments:shared.qualityDeductionSharedSettlementAdjustments,legacyQc:legacy.initialQualityInspections,legacyBasis:legacy.initialDeductionBasisItems,legacyBatches:legacy.initialReturnInboundBatches}}
  }
  ;(window as any).__financialPreservation={chain,repo,read}
  return structuredClone(read())
 })
 const before=await bootstrapFinance()
 assert.equal(before.conclusions[0].qc!.deductionAmount,600);assert.ok(before.conclusions[0].chain!.formalLedger);assert.equal(before.conclusions[1].qc!.deductionAmount,0)
 const result=await page.evaluate(async baseline=>{
  const {f,r,db,actor,linesFor}=(window as any).__postContract,finance=(window as any).__financialPreservation
  await f.hydrateProductionContextRecords();await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
  // No financial IDB owner exists in these unchanged legacy modules: their
  // real source is the original static/in-memory fact arrays above. This
  // unrelated PCS row is explicitly a test preservation control, not a newly
  // implemented financial persistence layer or additional deduction rule.
  const sentinelId='unrelated-preservation-control/legacy-financial-qc020',control={kind:'ISOLATED_PRESERVATION_CONTROL_NOT_FINANCIAL_SOURCE',qcId:baseline.conclusions[0].qcId,deductionAmount:baseline.conclusions[0].qc.deductionAmount,currency:baseline.conclusions[0].qc.deductionCurrency,originalCaseCount:baseline.originals.cases.length,auditLogs:baseline.conclusions[0].qc.auditLogs}
  await db.commitPcsRecords({puts:[{id:sentinelId,collection:'unrelated-preservation-control',value:control,expectedVersion:0}],deletes:[],operationId:'isolated-old-financial-control',intent:'explicit exact old financial facts preservation control; not a financial source'})
  const controlBefore=(await db.readPcsRecords(['unrelated-preservation-control'])).records
  const pending=f.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检'&&row.lines.reduce((n:number,line:any)=>n+line.expectedQty,0)===100),pendingDelivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.deliveryId===pending.deliveryId)
  const source=f.listPostFinishingFullFlowOutboundOrders().find((row:any)=>!row.postTaskId&&row.sourceType==='质检直达'),oldQc=f.getPostFinishingFullFlowQcTask(source.qcTaskId),delivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.deliveryId===source.deliveryId)
  if(!pending || !pendingDelivery || !source || !oldQc || !delivery)throw Error('历史保护契约必须保留原未检回货和原已完成QC/出货的合法资料')
  const rc={recheckOrderId:'FINANCE-PRESERVE-LEGACY-RC',recheckOrderNo:source.qcTaskNo+'-OLD-RC',deliveryId:source.deliveryId,deliveryOrderNo:source.deliveryOrderNo,productionOrderNo:source.productionOrderNo,qcTaskId:source.qcTaskId,qcTaskNo:source.qcTaskNo,responsibility:source.responsibility,sourceType:source.sourceType,returnIndex:source.returnIndex,createdAt:source.createdAt,status:'待复检',lines:source.lines.map((line:any)=>({sku:line.sku,expectedQty:line.outboundQty,barcodeStatus:'待扫描',barcodeEvents:[]}))}
  oldQc.outboundOrderId=undefined;oldQc.outboundOrderNo=undefined;oldQc.recheckOrderId=rc.recheckOrderId;oldQc.recheckOrderNo=rc.recheckOrderNo
  const legacyPayload={schemaVersion:3,deliveries:[delivery],qcTasks:[oldQc],recheckOrders:[rc],fullCoverages:[],processCompletions:[],waitProcessWarehouseRecords:[],waitProcessWarehouseMovements:[],waitHandoverWarehouseRecords:[],waitHandoverWarehouseMovements:[],returnConfirmationVersions:f.listPostFinishingReturnConfirmationVersions({deliveryId:delivery.deliveryId}),postTasks:[],outboundOrders:[],warehouseReceipts:[],defects:[],materialTransferOrders:[],materialStocks:[]}
  const key='higood-fcs-post-finishing-full-flow-v1';localStorage.setItem(key,JSON.stringify(legacyPayload))
  await r.ensurePostFinishingRecordState();await r.migratePostFinishingLegacyData()
  const afterMigration=structuredClone(finance.read()),migrated=f.listPostFinishingFullFlowOutboundOrders().filter((row:any)=>row.retiredRecheckId===rc.recheckOrderId)
  const ns='higood-fcs-post-finishing-records',rows=(await db.readPcsRecords([ns])).records,revision=rows.find((row:any)=>row.id===ns+'/revision')
  // A separate declared pending-return fixture permits the new QC workflow
  // after the migration of the selected old workspace, without resurrecting
  // deleted seed identities or importing old financial records as new QC.
  pending.qcTaskId='FINANCE-PRESERVE-NEW-QC';pending.qcTaskNo=pending.qcTaskId;pending.deliveryId='FINANCE-PRESERVE-NEW-RETURN';pending.deliveryOrderNo=pending.deliveryId;pending.returnIndex=902;pending.referenceIds=[]
  Object.assign(pendingDelivery,{deliveryId:pending.deliveryId,deliveryOrderNo:pending.deliveryOrderNo,qcTaskId:pending.qcTaskId,qcTaskNo:pending.qcTaskNo,returnIndex:pending.returnIndex,status:'已送检'})
  await db.commitPcsRecords({puts:[{id:ns+'/flow/qcTasks/'+pending.qcTaskId,collection:'flow/qcTasks',value:pending,expectedVersion:0},{id:ns+'/flow/deliveries/'+pending.deliveryId,collection:'flow/deliveries',value:pendingDelivery,expectedVersion:0},{id:ns+'/revision',collection:'revision',value:{format:1},expectedVersion:revision?.version||0}],deletes:[],operationId:'isolated-new-qc-after-financial-preserving-migration',intent:'new independent return fixture preserves original production task and order identity'})
  await r.ensurePostFinishingRecordState()
  const opened=await r.runPostFinishingCommand(()=>f.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor})),target=f.getPostFinishingQcInspectionSummary(opened.qcTaskId).target
  await r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:opened.qcTaskId,actor,operationId:'finance-preserve-new-round',lines:linesFor(opened.qcTaskId,target)}))
  const paper=r.registerPostFinishingFile(new Blob(['isolated financial-preservation QC paper'],{type:'image/png'}))
  await r.runPostFinishingCommand(()=>f.attachPostFinishingQcSignedPaper({qcTaskId:opened.qcTaskId,actor,url:paper,name:'历史保护后新QC测试纸单.png'}))
  const completed=await r.runPostFinishingCommand(()=>f.completePostFinishingQcTask({qcTaskId:opened.qcTaskId,actor,processItems:[]}))
  const afterQc=structuredClone(finance.read()),controlAfter=(await db.readPcsRecords(['unrelated-preservation-control'])).records
  return {afterMigration,afterQc,controlBefore,controlAfter,migrated:migrated.map((row:any)=>({status:row.status,retired:row.retiredRecheckId})),legacyRemoved:localStorage.getItem(key)===null,newQcId:completed.qcTaskId,newQcStatus:completed.status,newFinancialCase:finance.repo.getQualityDeductionCaseFactByQcId(completed.qcTaskId),newLegacyFinancialChain:finance.chain.getQcChainFact(completed.qcTaskId)}
 },before)
 assert.deepEqual(result.afterMigration,before);assert.deepEqual(result.afterQc,before);assert.deepEqual(result.controlAfter,result.controlBefore);assert.equal(result.controlBefore.length,1);assert.equal(result.controlBefore[0].version,1)
 assert.deepEqual(result.migrated,[{status:'待出货',retired:'FINANCE-PRESERVE-LEGACY-RC'}]);assert.equal(result.legacyRemoved,true);assert.equal(result.newQcStatus,'质检完成');assert.equal(result.newFinancialCase,null);assert.equal(result.newLegacyFinancialChain,null)
 await page.reload();await prepare(page);const refreshed=await bootstrapFinance()
 assert.deepEqual(refreshed,before)
 const persistent=await page.evaluate(async()=>{const {f,db}=(window as any).__postContract;return {control:(await db.readPcsRecords(['unrelated-preservation-control'])).records,qc:f.getPostFinishingFullFlowQcTask('FINANCE-PRESERVE-NEW-QC')?.status,outbound:f.listPostFinishingFullFlowOutboundOrders().filter((row:any)=>row.retiredRecheckId==='FINANCE-PRESERVE-LEGACY-RC').length}})
 assert.deepEqual(persistent.control,result.controlBefore);assert.equal(persistent.qc,'质检完成');assert.equal(persistent.outbound,1)
}))

test('旧复检有加工/无加工迁移：复用已有出货，已完复检及实际仓收原样保留且重试不重复',{timeout:120000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const path='/src/data/fcs/post-finishing-full-flow.ts',recordPath='/src/data/fcs/post-finishing-records.ts',dbPath='/src/data/pcs-record-db.ts',f={...await import(path),...await import(recordPath)},db=await import(dbPath)
  const all=f.listPostFinishingFullFlowOutboundOrders(),sources=[all.find((row:any)=>!row.postTaskId&&!row.receivedAt),all.find((row:any)=>row.postTaskId&&!row.receivedAt),all.find((row:any)=>row.receivedAt)]
  if(sources.some(row=>!row))throw Error('隔离旧格式用例缺少三种明确来源')
  const deliveryIds=new Set(sources.map((row:any)=>row.deliveryId)),postIds=new Set(sources.map((row:any)=>row.postTaskId).filter(Boolean))
  const rechecks=sources.map((source:any,i:number)=>({recheckOrderId:`FINAL-LEGACY-RC-${i}`,recheckOrderNo:source.qcTaskNo+'-FJ',deliveryId:source.deliveryId,deliveryOrderNo:source.deliveryOrderNo,productionOrderNo:source.productionOrderNo,qcTaskId:source.qcTaskId,qcTaskNo:source.qcTaskNo,postTaskId:source.postTaskId,postTaskNo:source.postTaskNo,responsibility:source.responsibility,sourceType:source.sourceType,returnIndex:source.returnIndex,createdAt:source.createdAt,status:i===2?'复检完成':'待复检',completedAt:i===2?source.dispatchedAt:undefined,lines:source.lines.map((line:any)=>({sku:line.sku,expectedQty:line.outboundQty,handoverQty:i===2?line.outboundQty:undefined,barcodeStatus:i===2?'正确':'待扫描',barcodeEvents:[]}))}))
  const qcs=sources.map((source:any,i:number)=>{const qc=f.getPostFinishingFullFlowQcTask(source.qcTaskId);qc.recheckOrderId=rechecks[i].recheckOrderId;qc.recheckOrderNo=rechecks[i].recheckOrderNo;if(i!==2){qc.outboundOrderId=undefined;qc.outboundOrderNo=undefined}return qc})
  const posts=[...postIds].map((id:any)=>f.listPostFinishingFullFlowPostTasks().find((post:any)=>post.postTaskId===id)),completions=posts.flatMap((post:any)=>f.getPostFinishingProcessProgress(post).records)
  for(const post of posts){const rc=rechecks.find((row:any)=>row.postTaskId===post.postTaskId)!;post.recheckOrderId=rc.recheckOrderId;post.recheckOrderNo=rc.recheckOrderNo}
  const existing={...sources[0],recheckOrderId:rechecks[0].recheckOrderId,recheckOrderNo:rechecks[0].recheckOrderNo},completed={...sources[2],recheckOrderId:rechecks[2].recheckOrderId,recheckOrderNo:rechecks[2].recheckOrderNo}
  const receipts=f.listPostFinishingWarehouseReceipts().filter((row:any)=>row.outboundOrderId===completed.outboundOrderId)
  if(receipts.length!==1)throw Error('隔离已完来源缺少唯一真实格式仓收')
  const old={schemaVersion:3,deliveries:f.listPostFinishingFactoryReturns().filter((row:any)=>deliveryIds.has(row.deliveryId)),qcTasks:qcs,postTasks:posts,recheckOrders:rechecks,outboundOrders:[existing,completed],warehouseReceipts:receipts,fullCoverages:[],processCompletions:completions,returnConfirmationVersions:f.listPostFinishingReturnConfirmationVersions().filter((row:any)=>deliveryIds.has(row.deliveryId)),waitProcessWarehouseRecords:[],waitProcessWarehouseMovements:[],waitHandoverWarehouseRecords:[],waitHandoverWarehouseMovements:[],defects:[],materialTransferOrders:[],materialStocks:[]}
  const key='higood-fcs-post-finishing-full-flow-v1';localStorage.setItem(key,JSON.stringify(old));await f.ensurePostFinishingRecordState();await f.migratePostFinishingLegacyData()
  const ns=['higood-fcs-post-finishing-records'],first=await db.readPcsRecords(ns);await f.migratePostFinishingLegacyData();const second=await db.readPcsRecords(ns)
  const outs=f.listPostFinishingFullFlowOutboundOrders(),history=f.listPostFinishingFullFlowRecheckOrders()
  return {existingExpected:existing,completedExpected:completed,receiptExpected:receipts,completedActual:outs.find((row:any)=>row.outboundOrderId===completed.outboundOrderId),receiptActual:f.listPostFinishingWarehouseReceipts(),existingActual:outs.find((row:any)=>row.outboundOrderId===existing.outboundOrderId),createdActual:outs.find((row:any)=>row.retiredRecheckId===rechecks[1].recheckOrderId),history,historyExpected:JSON.parse(JSON.stringify(rechecks[2])),total:outs.length,retryUnchanged:JSON.stringify(first.records)===JSON.stringify(second.records),removed:localStorage.getItem(key)===null}
 })
 assert.equal(result.total,3);assert.equal(result.removed,true);assert.equal(result.retryUnchanged,true)
 assert.equal(result.existingActual.outboundOrderId,result.existingExpected.outboundOrderId);assert.equal(result.existingActual.outboundOrderNo,result.existingExpected.outboundOrderNo);assert.deepEqual(result.existingActual.lines,result.existingExpected.lines)
 assert.equal(result.existingActual.retiredRecheckId,'FINAL-LEGACY-RC-0');assert.equal(result.existingActual.status,'待出货');assert.equal(result.createdActual.retiredRecheckId,'FINAL-LEGACY-RC-1');assert.ok(result.createdActual.postTaskId);assert.equal(result.createdActual.status,'待出货')
 assert.deepEqual(result.completedActual,result.completedExpected);assert.deepEqual(result.receiptActual,result.receiptExpected);assert.deepEqual(result.history,[result.historyExpected])
}))


test('抽检30实检合格29而正常出货99，两套SKU条码及吊牌都按实际出货逐SKU生成99张',{timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
 const flowPath='/src/data/fcs/post-finishing-full-flow.ts',configPath='/src/data/fcs/quality-management-records.ts',printPath='/src/pages/print/templates/post-finishing-outbound-template.ts',dedicatedPath='/src/pages/process-factory/post-finishing/full-flow-print.ts'
 const flow=await import(flowPath),config=await import(configPath),{buildPostFinishingOutboundBarcodePrintDocument}=await import(printPath),{renderPostFinishingFullFlowPrintPage}=await import(dedicatedPath)
 const sourcePath='/src/data/fcs/production-context-records.ts';await (await import(sourcePath)).hydrateProductionContextRecords()
 await config.ensureQualityManagementRecords()
 const rule=config.buildQualityConfigurationDraft('RULE','production-return-rule-v1');rule.initialFullInspection=null;await config.saveQualityConfigurationDraft(rule);await config.publishQualityConfiguration(rule.id)
 const recordsPath='/src/data/fcs/post-finishing-records.ts',records=await import(recordsPath)
 return records.runPostFinishingCommand(()=>{flow.resetPostFinishingFullFlow()
 const actors=flow.POST_FINISHING_ACCEPTANCE_ACTORS,source=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
 const delivery=flow.registerPostFinishingFactoryReturn({productionOrderNo:source.productionOrderNo,executionTaskId:source.executionTaskId,returnIndex:1,triggerSource:'车缝正常交出',idempotencyKey:'sampled-label-99',quantities:source.skus.map(sku=>({skuId:sku.skuId,registeredQty:20})),deliveryPersonName:'隔离交出人',deliveryPersonPhone:'',evidenceImageUrls:[source.skus[0].imageUrl],actor:actors.factoryCourier})
 flow.confirmPostFinishingFactoryReturn({deliveryId:delivery.deliveryId,firstCounts:delivery.lines.map(line=>({skuId:line.sku.skuId,actualQty:line.registeredQty})),actor:actors.returnConfirmer})
 const pending=flow.sendPostFinishingFactoryReturnToQc({deliveryId:delivery.deliveryId,actor:actors.sender}),qc=flow.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor:actors.qcSupervisor})
 const itemId=qc.inspection!.snapshot.items[0].id;const target=flow.getPostFinishingQcInspectionSummary(qc)!.target
 flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:actors.qcSupervisor,operationId:'sampled-label-round',lines:qc.lines.map((line,i)=>({skuId:line.sku.skuId,passedQty:i===0?19:i===1?10:0,defectQty:i===0?1:0,returnQty:0,issues:i===0?[{itemId,note:'一件污渍'}]:[]}))})
 flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:actors.qcSupervisor,name:'隔离纸单.png',url:records.registerPostFinishingFile(new Blob(['isolated signed paper bytes'],{type:'image/png'}))})
 const done=flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor:actors.qcSupervisor,processItems:[]}),summary=flow.getPostFinishingQcInspectionSummary(done)!

 const order=flow.listPostFinishingFullFlowOutboundOrders().find(row=>row.qcTaskId===qc.qcTaskId)!

 const doc=buildPostFinishingOutboundBarcodePrintDocument({sourceId:order.outboundOrderId,sourceType:'POST_FINISHING_OUTBOUND_ORDER',documentType:'POST_FINISHING_OUTBOUND_BARCODE'} as any)


 const dedicated=[]
 for(const type of ['OUTBOUND_BARCODE','OUTBOUND_HANGTAG']){
  history.replaceState(null,'',`?type=${type}&id=${order.outboundOrderId}`)
  const html=renderPostFinishingFullFlowPrintPage();dedicated.push({type,count:(html.match(/data-outbound-unit-label /g)||[]).length,skuCounts:order.lines.map((line:any)=>(html.match(new RegExp(`data-sku-id="${line.sku.skuId}"`,'g'))||[]).length)})
 }
 return {target,summary:[summary.inspectedQty,summary.passedQty,summary.uninspectedQty,summary.releasedQty],outbound:order.lines.map((row:any)=>row.outboundQty),copies:doc.totalCopies,generic:doc.labelItems.length,genericSkus:order.lines.map((line:any)=>doc.labelItems.filter((row:any)=>row.labelTitle===line.sku.skuCode).length),dedicated}
 })
 })
 assert.equal(result.target,30);assert.deepEqual(result.summary,[30,29,70,99]);assert.deepEqual(result.outbound,[19,20,20,20,20]);assert.equal(result.copies,99);assert.equal(result.generic,99);assert.deepEqual(result.genericSkus,result.outbound)
 for(const row of result.dedicated){assert.equal(row.count,99);assert.deepEqual(row.skuCounts,result.outbound)}
}))

test('单张执行读取保留同生产单及所有在检QC，保存不删未读取历史/Blob，完整入口可恢复原全量', {timeout:120000},()=>isolated(async page=>{
 await prepare(page)
 const result=await page.evaluate(async()=>{
  const {f,r,q,db,actor,linesFor}=(window as any).__postContract
  await f.hydrateProductionContextRecords()
  const engine=await import('/src/data/fcs/post-finishing-quality.ts')
  const originals=f.listPostFinishingFullFlowQcTasks()
  const targetBase=originals.find((row:any)=>row.status==='待质检')
  const archiveBase=originals.find((row:any)=>row.productionOrderId!==targetBase.productionOrderId)
  if(!targetBase || !archiveBase)throw Error('现有正式来源必须包含两份不同生产单')
  const ns='higood-fcs-post-finishing-records',at='2026-10-22T00:00:00.000Z'
  const sourceSnapshot=q.readPreparedInspectionSnapshot({sourceKind:'PRODUCTION_RETURN'})
  const make=(id:string,base:any,index:number,status:string,owner?:any)=>{
   const delivery=f.listPostFinishingFactoryReturns().find((row:any)=>row.deliveryId===base.deliveryId)
   const qc={...structuredClone(base),qcTaskId:id,qcTaskNo:id,deliveryId:id+'-DELIVERY',deliveryOrderNo:id+'-DELIVERY',returnIndex:index,status,referenceIds:[],independentChecks:[],results:undefined,
    postTaskId:undefined,postTaskNo:undefined,recheckOrderId:undefined,recheckOrderNo:undefined,outboundOrderId:undefined,outboundOrderNo:undefined,claimedBy:owner,claimedAt:owner?at:undefined,completedAt:undefined,
    inspection:owner?engine.createPostQcInspection(sourceSnapshot,['隔离范围契约全检']):undefined}
   const returned={...structuredClone(delivery),deliveryId:qc.deliveryId,deliveryOrderNo:qc.deliveryOrderNo,returnIndex:index,idempotencyKey:id+'-ISOLATED-RETURN',qcTaskId:id,qcTaskNo:id,status:'已送检'}
   return{qc,delivery:returned}
  }
  const target=make('SCOPE-QC-TARGET',targetBase,901,'质检中',actor),sibling=make('SCOPE-QC-SIBLING',targetBase,902,'待质检')
  // Retained older facts have stable identities but may lack display numbers.
  // Reading or saving another QC must neither reject nor rewrite that history.
  delete sibling.qc.qcTaskNo
  const other=make('SCOPE-QC-ACTIVE',targetBase,903,'质检中',{actorId:'ISOLATED-OTHER-QC',actorName:'另一隔离质检员',roleName:'QC质检员'})
  const archive=make('SCOPE-QC-ARCHIVE',archiveBase,904,'质检完成',{actorId:'ISOLATED-HISTORY-QC',actorName:'隔离历史质检员',roleName:'QC质检员'})
  const supply=archive.qc.lines.map((line:any)=>({skuId:line.sku.skuId,quantity:line.expectedQty}))
  engine.submitPostQcRound(archive.qc.inspection,supply,{operationId:'scope-original-history-round',actorId:archive.qc.claimedBy.actorId,submittedAt:at,lines:supply.map((row:any)=>({skuId:row.skuId,passedQty:row.quantity,defectQty:0,returnQty:0,issues:[]}))})
  archive.qc.inspection.papers.push({id:'scope-archive-paper',version:archive.qc.inspection.paperVersion,name:'隔离历史纸单原字节.png',url:'pcs-file:scope-archive-paper',uploadedAt:at})
  archive.qc.results=engine.getPostQcSummary(archive.qc.inspection,supply).lines.map((line:any)=>({...line,expectedQty:line.quantity,sku:archive.qc.lines.find((row:any)=>row.sku.skuId===line.skuId).sku}))
  archive.qc.completedAt=at
  const rows=[target,sibling,other,archive].flatMap(({qc,delivery})=>[{id:`${ns}/flow/qcTasks/${qc.qcTaskId}`,collection:'flow/qcTasks',value:qc,expectedVersion:0},{id:`${ns}/flow/deliveries/${delivery.deliveryId}`,collection:'flow/deliveries',value:delivery,expectedVersion:0}])
  await db.commitPcsRecords({puts:[...rows,{id:ns+'/revision',collection:'revision',value:{format:1},expectedVersion:0}],deletes:[{id:`${ns}/flow/qcTasks/${encodeURIComponent(targetBase.qcTaskId)}`,expectedVersion:0}],files:[{id:'scope-archive-paper',blob:new Blob(['archive original paper bytes'],{type:'image/png'})}],operationId:'scope-fixture',intent:'明确隔离的执行读取边界夹具'})
  const before=(await db.readPcsRecords([ns])).records.find((row:any)=>row.id.endsWith('/SCOPE-QC-ARCHIVE'))
  let forbiddenFileReads=0,writes=0
  const get=IDBObjectStore.prototype.get,put=IDBObjectStore.prototype.put
  IDBObjectStore.prototype.get=function(...args){if(this.name==='files'&&args[0]==='scope-archive-paper'){forbiddenFileReads++;throw Error('Unselected history attachment must not be loaded')}return get.apply(this,args)}
  IDBObjectStore.prototype.put=function(...args){writes++;return put.apply(this,args)}
  let selected:string[],readWrites:number
  try{
   await r.ensurePostFinishingExecutionRecordState('/fcs/craft/post-finishing/qc-workbench?taskNo=SCOPE-QC-TARGET')
   if(r.getPostFinishingStorageFailure())throw Error(r.getPostFinishingStorageFailure())
   selected=f.listPostFinishingFullFlowQcTasks().map((row:any)=>row.qcTaskId)
   readWrites=writes
   const quantity=target.qc.lines.reduce((n:number,row:any)=>n+row.expectedQty,0)
   const options={operationId:'scope-target-command',intent:'本单相同操作真实重试与去重'}
   const lines=linesFor(target.qc.qcTaskId,quantity)
   const save=()=>r.runPostFinishingCommand(()=>f.submitPostFinishingQcRound({qcTaskId:target.qc.qcTaskId,actor,operationId:'scope-target-round',lines}),options)
   // Native revision advance models another tab. The failed command must not
   // publish its round or initial-coverage side effects, including in memory.
   await db.commitPcsRecords({puts:[{id:ns+'/revision',collection:'revision',value:{format:1},expectedVersion:1}],deletes:[],operationId:'scope-other-tab-revision',intent:'隔离并发版本推进'})
   let conflict='';try{await save()}catch(error){conflict=String(error)}
   if(!/已被其他页面|修改|conflict/.test(conflict) || f.getPostFinishingFullFlowQcTask(target.qc.qcTaskId).inspection.rounds.length!==0)throw Error('Scope CAS must reject and roll back the unpublished round: '+conflict)
   await r.ensurePreparedPostFinishingRecordState()
   if(r.getPostFinishingStorageFailure())throw Error(r.getPostFinishingStorageFailure())
   await save();await save()

  }finally{IDBObjectStore.prototype.get=get;IDBObjectStore.prototype.put=put}
  const saved=await db.readPcsRecords([ns]),unchanged=saved.records.find((row:any)=>row.id===before.id)
  const historicalSibling=saved.records.find((row:any)=>row.id===`${ns}/flow/qcTasks/SCOPE-QC-SIBLING`)
  if(!historicalSibling || historicalSibling.version!==1 || Object.hasOwn(historicalSibling.value,'qcTaskNo'))throw Error('旧质检编号缺失必须按原值保留，不能补写或丢失')
  const after=f.getPostFinishingQcInspectionSummary(target.qc.qcTaskId)
  const loaded=performance.getEntriesByType('resource').map(row=>row.name).filter(url=>new URL(url).pathname==='/src/data/fcs/post-finishing-records.ts').at(-1)
  if(!loaded)throw Error('必须复用当前业务实际加载的维护模块身份')
  const maintenance=await import(loaded),backupText=await(await maintenance.exportPostFinishingBackup()).text(),backup=JSON.parse(backupText)
  if(!backup.records.some((row:any)=>row.id.endsWith('/SCOPE-QC-ARCHIVE')) || !backup.files.some((file:any)=>file.id==='scope-archive-paper'))throw Error('导出必须包含未读取的历史正文和原附件')
  let invalidRejected=false,conflictRejected=false
  try{await maintenance.importPostFinishingBackup(new File(['{}'],'invalid.json',{type:'application/json'}))}catch{invalidRejected=true}
  const conflicting=structuredClone(backup);conflicting.records.find((row:any)=>row.id.endsWith('/SCOPE-QC-ARCHIVE')).value.note='不能覆盖原历史的冲突候选'
  try{await maintenance.importPostFinishingBackup(new File([JSON.stringify(conflicting)],'conflict.json',{type:'application/json'}))}catch(error){conflictRejected=/冲突/.test(String(error))}
  if(!invalidRejected || !conflictRejected || JSON.stringify((await db.readPcsRecords([ns])).records)!==JSON.stringify(saved.records))throw Error('无效或冲突恢复必须拒绝并完整保留原记录')
  await r.ensurePostFinishingRecordState()
  if(r.getPostFinishingStorageFailure())throw Error(r.getPostFinishingStorageFailure())
  const restored=f.listPostFinishingFullFlowQcTasks().map((row:any)=>row.qcTaskId)
  return{backupText,backupArchiveValue:backup.records.find((row:any)=>row.id.endsWith('/SCOPE-QC-ARCHIVE')).value,selected,deletedStaticId:targetBase.qcTaskId,readWrites,forbiddenFileReads,unchanged:JSON.stringify(before)===JSON.stringify(unchanged),paper:await saved.files.find((file:any)=>file.id==='scope-archive-paper').blob.text(),restored,actual:after.inspectedQty,expected:target.qc.lines.reduce((n:number,row:any)=>n+row.expectedQty,0),rounds:f.getPostFinishingFullFlowQcTask(target.qc.qcTaskId).inspection.rounds.length}
 })
 assert.ok(result.selected.includes('SCOPE-QC-TARGET'));assert.ok(result.selected.includes('SCOPE-QC-SIBLING'));assert.ok(result.selected.includes('SCOPE-QC-ACTIVE'));assert.ok(!result.selected.includes('SCOPE-QC-ARCHIVE'))
 assert.ok(!result.selected.includes(result.deletedStaticId));assert.ok(!result.restored.includes(result.deletedStaticId));
 assert.equal(result.readWrites,0);assert.equal(result.forbiddenFileReads,0);assert.equal(result.unchanged,true);assert.equal(result.paper,'archive original paper bytes');assert.ok(result.restored.includes('SCOPE-QC-ARCHIVE'));assert.equal(result.actual,result.expected);assert.equal(result.rounds,1)
 const restoredContext=await browser.newContext(),restored=await restoredContext.newPage()
 try{
  await restoredContext.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
  await restored.route('**'+route,request=>request.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}))
  await restored.goto(base+route);await prepare(restored)
  const recovered=await restored.evaluate(async backupText=>{
   const {f,r,db}=(window as any).__postContract
   const loaded=performance.getEntriesByType('resource').map(row=>row.name).filter(url=>new URL(url).pathname==='/src/data/fcs/post-finishing-records.ts').at(-1)
   if(!loaded)throw Error('恢复必须使用实际业务模块')
   const maintenance=await import(loaded),file=new File([backupText],'scope-backup.json',{type:'application/json'})
   await maintenance.importPostFinishingBackup(file);await maintenance.importPostFinishingBackup(file)
   if(r.getPostFinishingStorageFailure())throw Error(r.getPostFinishingStorageFailure())
   const data=await db.readPcsRecords(['higood-fcs-post-finishing-records'])
   return{archive:data.records.find((row:any)=>row.id.endsWith('/SCOPE-QC-ARCHIVE')).value,archiveCount:data.records.filter((row:any)=>row.id.endsWith('/SCOPE-QC-ARCHIVE')).length,files:data.files.length,paper:await data.files.find((file:any)=>file.id==='scope-archive-paper').blob.text(),rounds:f.getPostFinishingFullFlowQcTask('SCOPE-QC-TARGET').inspection.rounds.length}
  },result.backupText)
  assert.deepEqual(recovered.archive,result.backupArchiveValue);assert.equal(recovered.archiveCount,1);assert.equal(recovered.files,1);assert.equal(recovered.paper,'archive original paper bytes');assert.equal(recovered.rounds,1)
 }finally{await restoredContext.close()}
}))

test('范围读取后连续扫码：原页面输入另一张未加载库存QC，先读取该原单再领取；不误用上一张或删除原记录',()=>isolated(async page=>{
 await prepare(page)
 const fixture=await page.evaluate(async()=>{
  const {f,r}= (window as any).__postContract
  const actual=performance.getEntriesByType('resource').map(row=>row.name).find(url=>new URL(url).pathname==='/src/data/fcs/post-finishing-full-flow.ts')
  if(!actual)throw Error('必须使用实际原QC模块')
  const flow=await import(actual);flow.setCurrentPostFinishingActor('PF-USER-QC-MGR')
  const lot=f.listFinishedInventoryLots().find((row:any)=>row.quality==='正常'&&row.quantity>0)
  const created=[]
  for(const id of ['SCAN-ORIGINAL-A'])created.push(await r.runPostFinishingCommand(()=>flow.createInventoryPostFinishingQcTask({applicationId:id,applicationNo:id,warehouseId:lot.warehouseId,warehouseName:lot.warehouseName,styleId:lot.styleId,styleNo:lot.styleNo,styleName:lot.styleName,styleImageUrl:lot.imageUrl,receivedAt:'2026-10-22T01:00:00Z',receivedBy:{actorId:'SCAN-WAREHOUSE',actorName:'隔离接收人',roleName:'成衣仓管'},lines:[{skuId:lot.skuId,skuCode:lot.skuCode,colorName:lot.colorName,sizeName:lot.sizeName,imageUrl:lot.imageUrl,receivedQty:10}]})))
  return{created}
 })
 await page.reload()
 const absentBefore=await page.evaluate(async created=>{
  await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
  const f=await import('/src/data/fcs/post-finishing-inventory-bridge.ts'),r=f
  const actual=performance.getEntriesByType('resource').map(row=>row.name).find(url=>new URL(url).pathname==='/src/data/fcs/post-finishing-full-flow.ts')!
  const flow=await import(actual);flow.setCurrentPostFinishingActor('PF-USER-QC-MGR')
  ;(window as any).__postContract={f,r,db:await import('/src/data/pcs-record-db.ts')}
  await r.ensureQualityManagementRecords()
  await r.ensurePostFinishingExecutionRecordState('/fcs/craft/post-finishing/qc-workbench?taskNo='+created[0].qcTaskNo)
  const absentBefore=!flow.getPostFinishingFullFlowQcTask('INV-QC-SCAN-NEXT-B')
  const workbench=await import('/src/pages/process-factory/post-finishing/qc-workbench.ts')
  document.body.innerHTML=workbench.renderPostFinishingQcWorkbenchPage()
  document.querySelector('[data-post-finishing-action="full-flow-claim-qc"]')!.addEventListener('click',event=>{void workbench.handlePostFinishingQcWorkbenchEvent(event.target as HTMLElement,event).then(()=>{(window as any).__scanClaimFinished=true})})
  return absentBefore
 },fixture.created)
 assert.equal(absentBefore,true,'下一原单必须尚未在当前范围，才能证明补读有效')
 const other=await page.context().newPage()
 try{
  await other.route('**'+route,request=>request.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await other.goto(base+route);await prepare(other)
  const second=await other.evaluate(async()=>{
   const {f,r}=(window as any).__postContract,actual=performance.getEntriesByType('resource').map(row=>row.name).find(url=>new URL(url).pathname==='/src/data/fcs/post-finishing-full-flow.ts')!,flow=await import(actual),lot=f.listFinishedInventoryLots().find((row:any)=>row.quality==='正常'&&row.quantity>0)
   return await r.runPostFinishingCommand(()=>flow.createInventoryPostFinishingQcTask({applicationId:'SCAN-NEXT-B',applicationNo:'SCAN-NEXT-B',warehouseId:lot.warehouseId,warehouseName:lot.warehouseName,styleId:lot.styleId,styleNo:lot.styleNo,styleName:lot.styleName,styleImageUrl:lot.imageUrl,receivedAt:'2026-10-22T01:00:01Z',receivedBy:{actorId:'SCAN-WAREHOUSE',actorName:'另一标签页接收人',roleName:'成衣仓管'},lines:[{skuId:lot.skuId,skuCode:lot.skuCode,colorName:lot.colorName,sizeName:lot.sizeName,imageUrl:lot.imageUrl,receivedQty:10}]}))
  });fixture.created.push(second)
 }finally{await other.close()}
 assert.equal(await page.evaluate(id=>!(window as any).__postContract.f.getPostFinishingFullFlowQcTask(id),fixture.created[1].qcTaskId),true,'新原单已由另一标签页实际提交，当前缓存仍未加载')

 await page.locator('[data-post-finishing-field="qc-task-input"]').fill(fixture.created[1].qcTaskNo)
 await page.locator('[data-post-finishing-action="full-flow-claim-qc"]').click()
 await page.waitForFunction(()=>(window as any).__scanClaimFinished)
 const result=await page.evaluate(async ids=>{
  const {f,r,db}=(window as any).__postContract
  const native=(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
  const rows=ids.map(id=>native.find((row:any)=>row.id.endsWith('/'+id))?.value)
  return{rows,notice:document.querySelector('[data-qc-save-error]')?.textContent,active:f.getPostFinishingFullFlowQcTask(ids[1]),failure:r.getPostFinishingStorageFailure()}
 },fixture.created.map(row=>row.qcTaskId))
 assert.equal(result.notice,undefined);assert.equal(result.failure,'');assert.equal(result.rows[0].status,'待质检');assert.equal(result.rows[1].status,'质检中');assert.ok(result.rows[1].inspection.snapshot);assert.equal(result.active.qcTaskId,fixture.created[1].qcTaskId)
}))
