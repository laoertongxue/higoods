import { test, expect, type Page } from '@playwright/test'
import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'
import { mkdirSync } from 'node:fs'
import { createLegacyPostFinishingFixture, partitionLegacyPostFinishingMigrationFixture } from './helpers/post-finishing-legacy-fixture.ts'

const namespace = 'higood-fcs-post-finishing-records'
const oldKey = 'higood-fcs-post-finishing-full-flow-v1'
const evidence = `${process.env.POST_FINISHING_EVIDENCE_ROOT || 'docs/product-design/post-finishing-partial-flow-20261019/evidence'}/migration`

// Historical schema2 is explicitly encoded after public current source/QC/item commands.
// Retired recheck commands are never called by the fixture.
const legacyFixture = createLegacyPostFinishingFixture

async function openLegacy(page: Page, fixture: Awaited<ReturnType<typeof legacyFixture>>) {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.locator('main h1')).toHaveText('后道加工单')
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw: JSON.stringify(fixture.snapshot) })
  await page.reload()
  await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
}

async function migrate(page: Page) {
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-post-finishing-action="storage-migrate"]').click()
  await expect(page.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
}

test('A20/A21/A30: explicit old-source conversion and supervised carryover preserve H/N, old child and unknown item history', async ({ page }) => {
  const fixture = await legacyFixture()
  await openLegacy(page, fixture)
  expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBe(JSON.stringify(fixture.snapshot))
  const before = await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records.length, namespace)
  expect(before).toBe(0)
  await migrate(page)
  expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBeNull()
  await page.goto(`/fcs/craft/post-finishing/work-orders/${fixture.taskId}`)
  await expect(page.locator('[data-post-process-card]').first()).toContainText('历史未分项')
  await expect(page.locator('[data-post-prototype-actor], [data-post-finishing-work-order-detail-action="switch-actor"]')).toHaveCount(0)
  await expect(page.locator('[data-post-finishing-work-order-detail-action="open-legacy"]')).toBeEnabled()
  const beforeCarryover = await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records, namespace)
  const originalParent = await page.evaluate(async id => (await import('/src/data/fcs/post-finishing-full-flow.ts')).getPostFinishingFullFlowPostTask(id), fixture.taskId)
  await page.locator('[data-post-finishing-work-order-detail-action="open-legacy"]').click()
  await expect(page.locator('[data-post-entry-supervisor]')).toHaveValue('')
  await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('请选择本次实际核对主管')
  expect(await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records, namespace)).toEqual(beforeCarryover)
  await page.locator('[data-post-entry-supervisor]').selectOption('PF-USER-POST-MGR')
  for (const item of ['装扣子','包装']) await page.locator(`[data-post-legacy-process-item][value="${item}"]`).check()
  const skuRows = page.locator('[data-post-legacy-sku]')
  for (let i=0; i<await skuRows.count(); i++) for (const item of ['装扣子','包装']) await skuRows.nth(i).locator(`[data-post-legacy-baseline="${item}"]`).fill(i === 0 ? item === '装扣子' ? '200' : '100' : '0')
  await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('请填写核对依据与原因')
  await expect(page.locator('[data-post-entry-supervisor]')).toHaveValue('PF-USER-POST-MGR')
  await expect(skuRows.first().locator('[data-post-legacy-baseline="包装"]')).toHaveValue('100')
  expect(await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records, namespace)).toEqual(beforeCarryover)
  await page.locator('[data-post-entry-reason]').fill('根据保留的历史合并结果及现场分项核对承接，确认人不冒充加工人')
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  const result = await page.evaluate(async id => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const v = await import('/src/data/fcs/post-finishing-current-read-model.ts')
    return { progress: f.getPostFinishingProcessProgress(id), rechecks: f.listPostFinishingFullFlowRecheckOrders(), outbounds: f.listPostFinishingFullFlowOutboundOrders(), order: v.getPostFinishingWorkOrderById(id), parent: f.getPostFinishingFullFlowPostTask(id) }
  }, fixture.taskId)
  expect(result.progress.totalCompletedQty).toBe(500)
  expect(result.progress.availableForOutboundQty).toBe(100)
  expect(result.progress.processes.find(p => p.processItem === '包装')?.expectedQty).toBe(600)
  expect(result.order?.postProjectLines.find(row => row.projectName === '包装')?.plannedQty).toBe(600)
  expect(result.rechecks).toHaveLength(0)
  expect(result.outbounds).toHaveLength(1)
  expect(result.outbounds[0].status).toBe('待出货')
  expect(result.outbounds[0].retiredRecheckId).toBe(fixture.oldRecheckId)
  expect(result.outbounds[0].retiredRecheck!.recheckOrderNo).toBe(fixture.recheckNo)
  expect(result.outbounds[0].lines.reduce((sum,line)=>sum+line.outboundQty,0)).toBe(400)
  expect(result.progress.records).toHaveLength(0)
  expect(result.parent?.legacyCarryover?.confirmedBy.actorId).toBe('PF-USER-POST-MGR')
  expect(result.parent?.results).toEqual(originalParent?.results)
  await page.reload()
  await expect(page.locator('[data-web-post-task]')).toContainText('历史整套后道完成 400 件')
  mkdirSync(evidence, { recursive: true })
  await page.screenshot({ path: `${evidence}/legacy-carryover.png`, fullPage: true })
  const forged = await page.evaluate(async ns => {
    const r = await import('/src/data/fcs/post-finishing-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
    const before = JSON.stringify((await db.readPcsRecords([ns])).records)
    const parent = backup.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted)
    parent.value.legacyCarryover.history[0].completedQty = 800
    // Remove the old value in a second isolated target below; here a conflict
    // must already refuse to overwrite the valid existing parent.
    try { await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'forged-H.json')); return false } catch { return before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  }, namespace)
  expect(forged).toBe(true)
  const forgedBackup = await page.evaluate(async () => {
    const r = await import('/src/data/fcs/post-finishing-records.ts')
    const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
    backup.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted).value.legacyCarryover.history[0].completedQty=800
    return backup
  })
  const isolated = await page.context().browser()!.newContext()
  const isolatedPage = await isolated.newPage()
  await isolatedPage.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
  await expect(isolatedPage.locator('main h1')).toHaveText('后道加工单')
  const rejected = await isolatedPage.evaluate(async backup => {
    const r = await import('/src/data/fcs/post-finishing-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    await r.ensurePostFinishingRecordState()
    try { await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'forged-history.json')); return false } catch(e) { return String(e).includes('历史承接') && !(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records.length }
  }, forgedBackup)
  expect(rejected).toBe(true)
  await isolated.close()
})

test('A20: schema2 IndexedDB marker upgrade writes no static seeds or invented completion records', async ({ page }) => {
  const fixture = await legacyFixture()
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await page.evaluate(async ({ snapshot, ns }) => {
    const db = await import('/src/data/pcs-record-db.ts')
    await db.commitPcsRecords({ puts: [
      { id: `${ns}/flow/schemaVersion/value`, collection: 'flow/schemaVersion', value: 2, expectedVersion: 0 },
      { id: `${ns}/flow/postTasks/${encodeURIComponent(snapshot.postTasks[0].postTaskId)}`, collection: 'flow/postTasks', value: snapshot.postTasks[0], expectedVersion: 0 },
      // This old user order was generated from public return/QC commands; its
      // source is not a static QC seed. Keep those two source overlays instead
      // of accidentally relying on a previously unvalidated orphan parent.
      { id: `${ns}/flow/deliveries/${encodeURIComponent(snapshot.deliveries[0]!.deliveryId)}`, collection: 'flow/deliveries', value: snapshot.deliveries[0], expectedVersion: 0 },
      { id: `${ns}/flow/qcTasks/${encodeURIComponent(snapshot.qcTasks[0]!.qcTaskId)}`, collection: 'flow/qcTasks', value: snapshot.qcTasks[0], expectedVersion: 0 },
    ], deletes: [], operationId: 'OLD-INDEXEDDB-INPUT', intent: 'isolated old version overlay fixture' })
  }, { snapshot: fixture.snapshot, ns: namespace })
  await page.reload()
  await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
  await migrate(page)
  const records = await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records, namespace)
  expect(records.filter(row => row.collection === 'flow/processCompletions')).toHaveLength(0)
  expect(records.filter(row => row.id !== `${namespace}/revision`)).toHaveLength(4)
  expect(records.filter(row => row.collection === 'flow/deliveries')).toHaveLength(1)
  expect(records.filter(row => row.collection === 'flow/qcTasks')).toHaveLength(1)
  expect(records.find(row => row.collection === 'flow/schemaVersion')?.value).toBe(4)
})

test('A30: H600 plus the remaining N400 completes only Q1000 and releases exactly 400 new supply', async ({ page }) => {
  const fixture = await legacyFixture(600)
  await openLegacy(page, fixture)
  await migrate(page)
  const result = await page.evaluate(async ({ id, skuId }) => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const r = await import('/src/data/fcs/post-finishing-records.ts')
    const task=f.getPostFinishingFullFlowPostTask(id)!
    await r.runPostFinishingCommand(() => f.confirmPostFinishingLegacyCarryover({ postTaskId:id, processItems:['装扣子','包装'],
      history:task.lines.map(line=>({skuId:line.sku.skuId,completedQty:line.sku.skuId===skuId?600:0})),
      baselines:['装扣子','包装'].map(processItem=>({processItem:processItem as '装扣子'|'包装',quantities:task.lines.map(line=>({skuId:line.sku.skuId,quantity:line.sku.skuId===skuId?400:0}))})),
      actor:Object.values(f.POST_FINISHING_ACCEPTANCE_ACTORS).find(actor=>actor.roleName==='后道主管')!, reason:'验收核对历史600与剩余400分离，不重复累计历史' }))
    const progress=f.getPostFinishingProcessProgress(id)
    return { expected:progress.totalExpectedQty, completed:progress.totalCompletedQty, reserved:progress.totalReservedQty, available:progress.availableForOutboundQty,
      remaining:progress.processes.find(row=>row.processItem==='包装')?.expectedQty, invented:progress.records.length }
  }, {id:fixture.taskId,skuId:fixture.skuId})
  expect(result).toEqual({expected:1000,completed:1000,reserved:600,available:400,remaining:400,invented:0})
  await page.reload()
  await expect(page.locator('main h1')).toHaveText('后道加工单')
})

test('A22: complete restore retains records, while future/duplicate/orphan/overquantity backup leaves database unchanged', async ({ page }) => {
  const fixture = await legacyFixture()
  await openLegacy(page, fixture)
  await migrate(page)
  const result = await page.evaluate(async ns => {
    const records = await import('/src/data/fcs/post-finishing-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    const backup = JSON.parse(await (await records.exportPostFinishingBackup()).text())
    const before = JSON.stringify((await db.readPcsRecords([ns])).records)
    await records.importPostFinishingBackup(new File([JSON.stringify(backup)], 'valid.json'))
    const errors: string[] = []
    for (const bad of [{ ...backup, version: 99 }, { ...backup, records: [...backup.records, backup.records[0]] }]) {
      try { await records.importPostFinishingBackup(new File([JSON.stringify(bad)], 'bad.json')); errors.push('UNEXPECTED_SUCCESS') } catch (e) { errors.push(String(e)) }
    }
    const badRecord = { id: `${ns}/flow/processCompletions/ORPHAN`, collection: 'flow/processCompletions', version: 1, value: {
      recordId: 'ORPHAN', operationId: 'ORPHAN', intent: 'orphan fixture', postTaskId: 'MISSING', processItem: '包装', quantities: [{ skuId: 'MISSING', quantity: 1001 }],
      responsible: { actorId: 'PF-USER-POST', actorName: '操作员', roleName: '后道操作员' }, recordedBy: { actorId: 'PF-USER-POST', actorName: '操作员', roleName: '后道操作员' }, recordedAt: '2026-10-19T08:00:00+08:00' } }
    try { await records.importPostFinishingBackup(new File([JSON.stringify({ ...backup, records: [...backup.records, badRecord] })], 'orphan.json')); errors.push('UNEXPECTED_SUCCESS') } catch (e) { errors.push(String(e)) }
    return { errors, backup, unchanged: before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  }, namespace)
  expect(result.errors).toHaveLength(3)
  expect(result.errors.every(error => !error.includes('UNEXPECTED_SUCCESS'))).toBe(true)
  expect(result.unchanged).toBe(true)
  // Backup restore remains an existing external-tool action. Normal business
  // pages have retired their maintenance inputs; do not recreate them for tests.
  const retryContext = await page.context().browser()!.newContext()
  try {
    const retry = await retryContext.newPage()
    await retry.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/audit-records`)
    await expect(retry.locator('main h1')).toHaveText('差异与操作日志')
    await expect(retry.locator('[data-post-finishing-field="storage-import"]')).toHaveCount(0)
    const restoredByTool = await retry.evaluate(async backup => {
      const records = await import('/src/data/fcs/post-finishing-records.ts')
      const db = await import('/src/data/pcs-record-db.ts')
      const initial = JSON.stringify((await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records)
      const invalid = new File(['{}'], 'invalid-format.json', {type:'application/json'})
      let error = ''
      try { await records.importPostFinishingBackup(invalid) } catch (cause) {error=String(cause)}
      const failedUnchanged = initial === JSON.stringify((await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records)
      const inputPreserved = await invalid.text() === '{}'
      await records.importPostFinishingBackup(new File([JSON.stringify(backup)],'verified-backup.json',{type:'application/json'}))
      return {error,failedUnchanged,inputPreserved,boundary:'公开外部工具File导入；非已退役的业务维护表单'}
    }, result.backup)
    expect(restoredByTool.error).toContain('后道备份格式或版本无效')
    expect(restoredByTool.failedUnchanged && restoredByTool.inputPreserved).toBe(true)
    await retry.reload()
    await expect(retry.locator('[data-post-finishing-action-error]')).toHaveCount(0)
    await expect(retry.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
    const taskNo = fixture.snapshot.postTasks[0].postTaskNo
    await retry.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
    await expect(retry.locator('main h1')).toHaveText('后道加工单')
    await expect(retry.locator('tbody tr').filter({ hasText: taskNo })).toHaveCount(1)
    const restored = await retry.evaluate(async id => {
      const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
      const task = f.getPostFinishingFullFlowPostTask(id)!
      return { no: task.postTaskNo, expected: task.lines.reduce((sum, line) => sum + line.expectedQty, 0) }
    }, fixture.taskId)
    expect(restored).toEqual({ no: taskNo, expected: 1000 })
    mkdirSync(evidence, { recursive: true })
    await retry.screenshot({ path: `${evidence}/backup-external-tool-failure-retry-restored.png`, fullPage: true })
  } finally { await retryContext.close() }

  // Old HEAD upsertOutboundFromRecheck used record.lines.map, preserving zero
  // lines. Build the positive facts through public commands, then encode that
  // explicit schema-2 representation; omitted historical WH/receipt is unknown,
  // not permission to invent a current warehouse fact or historical person.
  const old = await legacyFixture()
  const actor = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  // Public direct-outbound dispatch/receipt establish positive current facts.
  // The following completed RC is only their explicit old-schema representation,
  // preserving old zero rows and absent downstream history; no retired action runs.
  const generated = flow.getPostFinishingFullFlowOutboundOrder(old.activeOutboundId)!
  flow.dispatchPostFinishingOutboundOrder({ outboundOrderId: generated.outboundOrderId, actor: actor.postOperator })
  flow.receivePostFinishingOutboundOrder({ outboundOrderNo: generated.outboundOrderNo, actor: actor.warehouseReceiver,
    receivedQuantities: generated.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })) })
  const historical: any = structuredClone(old.snapshot.recheckOrders[0])
  historical.status = '复检完成'
  historical.claimedBy = structuredClone(actor.recheckerA)
  historical.claimedAt = historical.createdAt
  historical.completedAt = generated.createdAt
  historical.outboundOrderId = generated.outboundOrderId; historical.outboundOrderNo = generated.outboundOrderNo
  historical.lines = old.snapshot.postTasks[0].lines.map((line:any) => ({ sku: structuredClone(line.sku),
    expectedQty: line.sku.skuId === old.skuId ? 400 : 0, handoverQty: line.sku.skuId === old.skuId ? 400 : 0,
    barcodeStatus: line.sku.skuId === old.skuId ? '正确' : '未扫描', barcodeEvents: [] }))
  const oldOutbound = flow.getPostFinishingFullFlowOutboundOrder(generated.outboundOrderId)!
  delete oldOutbound.executionModel; delete oldOutbound.operationId; delete oldOutbound.operationIntent; delete oldOutbound.sequence
  oldOutbound.recheckOrderId = historical.recheckOrderId; oldOutbound.recheckOrderNo = historical.recheckOrderNo
  oldOutbound.lines = historical.lines.map((line: any) => ({ sku: line.sku, outboundQty: line.handoverQty, receivedQty: line.handoverQty }))
  old.snapshot.recheckOrders = [historical]
  old.snapshot.postTasks[0].recheckOrderNo = historical.recheckOrderNo
  old.snapshot.outboundOrders = [oldOutbound]
  const oldContext = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const historicalPage = await oldContext.newPage()
    await historicalPage.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
    await openLegacy(historicalPage, old)
    await migrate(historicalPage)
    const preserved = await historicalPage.evaluate(async ns => {
      const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
      const r = await import('/src/data/fcs/post-finishing-records.ts')
      const db = await import('/src/data/pcs-record-db.ts')
      const before = JSON.stringify((await db.readPcsRecords([ns])).records)
      const backup = await r.exportPostFinishingBackup()
      await r.importPostFinishingBackup(new File([await backup.text()], 'valid-schema2-legacy-zero.json'))
      return { outbounds: f.listPostFinishingFullFlowOutboundOrders(), rechecks: f.listPostFinishingFullFlowRecheckOrders(),
        waiting: f.listPostFinishingWaitHandoverWarehouseRecords(), receipts: f.listPostFinishingWarehouseReceipts(),
        unchanged: before === JSON.stringify((await db.readPcsRecords([ns])).records) }
    }, namespace)
    expect(preserved.rechecks).toHaveLength(1)
    expect(preserved.rechecks[0].status).toBe('复检完成')
    expect(preserved.rechecks[0].recheckOrderNo).toBe(historical.recheckOrderNo)
    expect(preserved.outbounds).toHaveLength(1)
    expect(preserved.outbounds[0].lines).toHaveLength(5)
    expect(preserved.outbounds[0].lines.filter(line => line.outboundQty === 0)).toHaveLength(4)
    expect(preserved.outbounds[0].lines.reduce((sum, line) => sum + line.outboundQty, 0)).toBe(400)
    expect(preserved.waiting).toHaveLength(0)
    expect(preserved.receipts).toHaveLength(0)
    expect(preserved.unchanged).toBe(true)
    const { writeFileSync } = await import('node:fs')
    writeFileSync(`${evidence}/schema2-legacy-zero-missing-downstream-control.json`, JSON.stringify(preserved, null, 2))
  } finally { await oldContext.close() }
})

test('A20/A21/A22: interrupted independent schema1 groups resume with archive Blob, common records and legacy sources preserved', async ({ page }) => {
  const fixture = partitionLegacyPostFinishingMigrationFixture(await legacyFixture())
  expect(fixture.snapshot.recheckOrders).toHaveLength(151)
  expect(fixture.snapshot.postTasks.reduce((sum:number,task:any)=>sum+task.lines.reduce((qty:number,line:any)=>qty+line.expectedQty,0),0)).toBe(1000)
  expect(fixture.snapshot.postTasks.reduce((sum:number,task:any)=>sum+task.results.reduce((qty:number,line:any)=>qty+line.processedQty,0),0)).toBe(400)
  expect(fixture.snapshot.recheckOrders.reduce((sum:number,rc:any)=>sum+rc.lines.reduce((qty:number,line:any)=>qty+line.expectedQty,0),0)).toBe(250)
  const archiveKey = 'higood-fcs-post-finishing-outbound-orders-v1:archive'
  const inline = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  await openLegacy(page, fixture)
  const result = await page.evaluate(async ({ ns, archiveKey, inline, oldKey }) => {
    const r = await import('/src/data/fcs/post-finishing-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    localStorage.setItem(archiveKey, JSON.stringify({ raw: JSON.stringify({ oldDraft: { quantity: 600, image: inline }, oldOutbound: { no: 'OLD-OUT', image: inline } }) }))
    await db.commitPcsRecords({ puts: [{ id: 'pcs-common/KEEP', collection: 'pcs-common', value: { quantity: 7 }, expectedVersion: 0 }], deletes: [], operationId: 'TEST-COMMON', intent: 'preserve unrelated record' })
    const original = IDBObjectStore.prototype.put
    let writes = 0
    IDBObjectStore.prototype.put = function (...args: any[]) {
      if (this.name === 'records' && ++writes === 110) throw new DOMException('验收中断第二批转换', 'AbortError')
      return original.apply(this, args as any)
    }
    let error = ''
    try { await r.migratePostFinishingLegacyData() } catch (e) { error=String(e) }
    finally { IDBObjectStore.prototype.put = original }
    const partial = await db.readPcsRecords([ns])
    const oldPreserved = Boolean(localStorage.getItem(oldKey) && localStorage.getItem(archiveKey))
    let oldWriteRejected = false
    try { await r.runPostFinishingCommand(() => true) } catch { oldWriteRejected=true }
    await r.migratePostFinishingLegacyData()
    const final = await db.readPcsRecords([ns])
    const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
    await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'archive-with-blob.json'))
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const parents=flow.listPostFinishingFullFlowPostTasks(),outbounds=flow.listPostFinishingFullFlowOutboundOrders()
    const totals={expected:parents.reduce((sum,task)=>sum+task.lines.reduce((qty,line)=>qty+line.expectedQty,0),0),
      historical:parents.reduce((sum,task)=>sum+(task.results||[]).reduce((qty,line)=>qty+(line.processedQty||0),0),0),
      pending:outbounds.reduce((sum,order)=>sum+order.lines.reduce((qty,line)=>qty+line.outboundQty,0),0),outbounds:outbounds.length,
      rechecks:flow.listPostFinishingFullFlowRecheckOrders().length,uniqueSources:new Set(outbounds.map(order=>order.retiredRecheckId)).size,
      allWaiting:outbounds.every(order=>order.status==='待出货')}
    return { error, partialCount: partial.records.length, oldPreserved, oldWriteRejected, totals,
      common: (await db.readPcsRecords(['pcs-common'])).records[0]?.value,
      idsUnique: new Set(final.records.map(row => row.id)).size===final.records.length,
      archives: final.records.filter(row => row.collection==='archive').map(row=>row.value), fileCount: final.files.length,
      bytes: await Promise.all(final.files.map(async row => (await row.blob.arrayBuffer()).byteLength)),
      noInline: !JSON.stringify(final.records).includes('data:image'), sourcesRemoved: !localStorage.getItem(oldKey) && !localStorage.getItem(archiveKey) }
  }, { ns: namespace, archiveKey, inline, oldKey })
  expect(result.error).toContain('AbortError')
  expect(result.partialCount).toBeGreaterThan(0)
  expect(result.oldPreserved).toBe(true)
  expect(result.oldWriteRejected).toBe(true)
  expect(result.common).toEqual({ quantity: 7 })
  expect(result.idsUnique && result.noInline && result.sourcesRemoved).toBe(true)
  expect(result.fileCount).toBe(1)
  expect(result.bytes[0]).toBeGreaterThan(0)
  expect(result.totals).toEqual({expected:1000,historical:400,pending:250,outbounds:151,rechecks:0,uniqueSources:151,allWaiting:true})
  mkdirSync(evidence, { recursive: true })
  const {writeFileSync}=await import('node:fs')
  writeFileSync(`${evidence}/interrupted-independent-groups.json`,JSON.stringify(result,null,2))
})

for (const entry of [
  { name: 'Web', route: '/fcs/craft/post-finishing/work-orders', heading: '后道加工单', file: 'two-tab-upgrade-recovery' },
  { name: 'PDA', route: '/fcs/pda/post-finishing/execute', heading: '后道加工', file: 'two-tab-upgrade-pda-recovery' },
]) test(`A20: two isolated tabs report a blocked database upgrade and preserve old records after the old connection closes (${entry.name})`, async ({ page, context }) => {
  // A static same-origin asset starts no application bootstrap. The version-1
  // connection is an explicit old-storage fixture, held by a separate old tab.
  await page.goto('/shirt-sample.jpg')
  if (entry.name === 'PDA') {
    await page.evaluate(() => localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'ID-F002_operator', loginId: 'ID-F002_operator', userName: '后道工厂_操作工', roleId: 'ROLE_OPERATOR',
      factoryId: 'ID-F002', factoryName: '后道工厂', loggedAt: '2026-09-03 10:00:00',
    })))
  }
  const initial = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records', { keyPath: 'id' })
        request.result.createObjectStore('files', { keyPath: 'id' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    ;(window as any).__pfOldUpgradeConnection = db
    ;(window as any).__pfVersionChangeEvents = []
    db.onversionchange = event => {
      ;(window as any).__pfVersionChangeEvents.push({ oldVersion: event.oldVersion, newVersion: event.newVersion })
      // Simulate an old tab that has not yet obeyed the close/reload instruction.
    }
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ id: 'pcs-common/upgrade-sentinel', collection: 'pcs-common', value: { quantity: 7 }, version: 1 })
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
    })
    return db.version
  })
  expect(initial).toBe(1)
  const newTab = await context.newPage()
  if (entry.name === 'PDA') await newTab.setViewportSize({ width: 390, height: 844 })
  const pageErrors: string[] = []
  newTab.on('pageerror', error => pageErrors.push(error.message))
  await newTab.goto(entry.route)
  const notice = newTab.locator('[data-post-finishing-storage-notice]')
  await expect(notice).toHaveAttribute('data-post-finishing-entry-storage-failure', '')
  await expect(notice).toContainText('数据库升级被其他标签页阻止')
  await expect(notice).toContainText('关闭旧页面后重试')
  await expect(notice.locator('[data-pcs-storage-retry]')).toHaveText('重新读取')
  const blocked = await notice.innerText()
  mkdirSync(evidence, { recursive: true })
  await newTab.screenshot({ path: `${evidence}/${entry.file}-blocked.png`, fullPage: true })
  const versionChanges = await page.evaluate(() => (window as any).__pfVersionChangeEvents)
  expect(versionChanges).toEqual([{ oldVersion: 1, newVersion: 4 }])
  await page.evaluate(() => {
    ;(window as any).__pfOldUpgradeConnection.close()
    delete (window as any).__pfOldUpgradeConnection
  })
  await newTab.locator('[data-pcs-storage-retry]').click()
  await expect(notice).toHaveCount(0)
  await expect(newTab.getByRole('heading', { name: entry.heading, exact: true })).toBeVisible()
  const recovered = await newTab.evaluate(async ns => {
    const records = await import('/src/data/pcs-record-db.ts')
    const data = await records.readPcsRecords(['pcs-common'])
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const result = { version: db.version, stores: [...db.objectStoreNames], common: data.records[0]?.value,
      postRows: (await records.readPcsRecords([ns])).records.length }
    db.close()
    return result
  }, namespace)
  expect(recovered.version).toBe(4)
  expect(recovered.stores).toEqual(expect.arrayContaining(['records', 'files', 'operations', 'meta']))
  expect(recovered.common).toEqual({ quantity: 7 })
  expect(recovered.postRows).toBe(0)
  expect(pageErrors).toEqual([])
  await newTab.screenshot({ path: `${evidence}/${entry.file}-recovered.png`, fullPage: true })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(`${evidence}/${entry.file}.json`, JSON.stringify({ entry: entry.name, route: entry.route, blocked, versionChanges, recovered, pageErrors }, null, 2))
  await newTab.close()
})
