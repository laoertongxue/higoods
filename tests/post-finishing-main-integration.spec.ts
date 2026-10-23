import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'

const namespace = 'higood-fcs-post-finishing-records'
const oldKey = 'higood-fcs-post-finishing-full-flow-v1'
const evidence = `${process.env.POST_FINISHING_EVIDENCE_ROOT || 'docs/product-design/post-finishing-partial-flow-20261019/evidence'}/main-integration-browser`
const postFixture = JSON.parse(readFileSync('tests/fixtures/accessory-warehouse/post.json', 'utf8'))
const legacyMaterials = JSON.parse(readFileSync('tests/fixtures/accessory-warehouse/postLegacy.json', 'utf8'))
const legacyMaterialRows = legacyMaterials.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((s: any) => s.name === 'records').rows.filter((row: any) => /flow\/material(TransferOrders|Stocks)$/.test(row.value.collection))
const legacyFile = legacyMaterials.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((s: any) => s.name === 'files').rows[0].value

// Frozen AW initial states are main's isolated input fixtures, not upstream
// factory operation evidence. All garment facts below use public commands.
async function installFixture(page: Page, fixture: any): Promise<void> {
  await page.route('**/__post-main-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/__post-main-fixture')
  await page.evaluate(async fixture => {
    function decode(value: any): any {
      if (value?.__fixtureType === 'Blob') return new Blob([new Uint8Array(value.bytes)], { type: value.type })
      if (Array.isArray(value)) return value.map(decode)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]))
      return value
    }
    if ((await indexedDB.databases()).length) throw new Error('integration input requires an isolated empty context')
    for (const info of fixture.databases) {
      const db = await new Promise<IDBDatabase>((ok, fail) => {
        const request = indexedDB.open(info.name, info.version)
        request.onupgradeneeded = () => { for (const s of info.stores) { const store = request.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const index of s.indexes || []) store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry }) } }
        request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error)
      })
      const tx = db.transaction(info.stores.map((s: any) => s.name), 'readwrite')
      const done = new Promise<void>((ok, fail) => { tx.oncomplete = () => ok(); tx.onabort = () => fail(tx.error) })
      for (const s of info.stores) for (const row of s.rows) { const store = tx.objectStore(s.name); store.keyPath === null ? store.put(decode(row.value), decode(row.key)) : store.put(decode(row.value)) }
      await done; db.close()
    }
    for (const [key, value] of Object.entries(fixture.localStorage || {})) localStorage.setItem(key, String(value))
  }, fixture)
}


async function durable(page: Page) {
  return page.evaluate(async () => {
    const pcs = await (await import('/src/data/pcs-record-db.ts')).readPcsRecords(['higood-fcs-post-finishing-records'])
    const accessory = await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()
    const cutting = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
    const files = async (rows: any[]) => Promise.all(rows.map(async row => ({ id: row.id, type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) })))
    return { pcs: { records: pcs.records, files: await files(pcs.files) }, accessory: { records: accessory.records, files: await files(cutting.files) } }
  })
}
async function archiveAccessory(page: Page) {
  await page.goto('/fcs/craft/post-finishing/material-transfers')
  await expect(page.locator('[data-post-material-root]')).toBeVisible()
  await expect(page.locator('[data-post-material-migration], [data-post-finishing-material-transfers-action="migrate"]')).toHaveCount(0)
  // main retired the business-page maintenance panel. This authorized isolated
  // conversion uses the existing external-tool boundary, then reads the page.
  const converted = await page.evaluate(async () => {
    const auxiliary = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
    return auxiliary.migrateLegacyAccessoryPost({ commandId: 'POST-MAIN-INTEGRATION-ARCHIVE', at: new Date().toISOString(), actor: '集成验收原资料核对员' })
  })
  expect(converted.state).toBe('已完成')
  await page.reload()
  await expect(page.locator('[data-post-material-root]')).toBeVisible()
}
async function materialReadback(page: Page) {
  return page.evaluate(async () => {
    const auxiliary = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
    await auxiliary.prepareAccessoryPostFinishing()
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const backup = auxiliary.readLegacyAccessoryPostBackup()
    return { inspection: auxiliary.inspectLegacyAccessoryPostMigration(), sourceKeys: backup.sources.map(row => ({ key: row.key, fingerprint: row.fingerprint })), stocks: flow.listPostFinishingMaterialStocks().filter(row => row.transferOrderId === 'OLD-POST-1'), transfer: flow.getPostFinishingMaterialTransferOrder('OLD-POST-1') }
  })
}
async function artifact(page: Page, name: string, value: unknown) {
  mkdirSync(evidence, { recursive: true })
  writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(value, null, 2))
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true })
}

async function publicPostTask(page: Page) {
  return page.evaluate(async () => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts')
    await (await import('/src/data/fcs/quality-management-records.ts')).ensureQualityManagementRecords()
    const source = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0], prior = source.skus[0].plannedQty, a = f.POST_FINISHING_ACCEPTANCE_ACTORS
    // The seed's qcA already owns another task; this isolated source uses a
    // separate complete prototype identity without releasing unrelated work.
    const qcActor = { ...a.qcA, actorId: 'INTEGRATED-QC-ACTOR', actorName: '整合验证独立质检员' }
    source.skus[0].plannedQty = prior + 1000
    try {
      const d = await r.runPostFinishingCommand(() => f.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 77, triggerSource: '车缝正常交出', idempotencyKey: 'INTEGRATED-BACKUP-SOURCE', quantities: source.skus.map((sku, i) => ({ skuId: sku.skuId, registeredQty: i ? 0 : 1000 })), deliveryPersonName: '整合备份隔离送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: a.factoryCourier }))
      await r.runPostFinishingCommand(() => f.confirmPostFinishingFactoryReturn({ deliveryId: d.deliveryId, firstCounts: d.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: a.returnConfirmer }))
      const qc = await r.runPostFinishingCommand(() => f.sendPostFinishingFactoryReturnToQc({ deliveryId: d.deliveryId, actor: a.sender }))
      await r.runPostFinishingCommand(() => f.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: qcActor }))
      await r.runPostFinishingCommand(() => f.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:qcActor,operationId:'INTEGRATED-BACKUP-ROUND',lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0,issues:[]}))}))
      await r.runPostFinishingCommand(() => f.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:qcActor,url:source.skus[0].imageUrl,name:'隔离夹具纸单素材；不代表现场双签'}))
      const result = await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: qcActor, processItems: [...f.POST_FINISHING_PROCESS_ITEMS] }))
      for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: result.postTaskId!, processItem: item, quantities: [{ skuId: source.skus[0].skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `INTEGRATED-BACKUP-${item}` }))
      return { parentId: result.postTaskId!, skuId: source.skus[0].skuId }
    } finally { source.skus[0].plannedQty = prior }
  })
}

/** Existing external-tool boundary; normal business pages intentionally have no backup form. */
async function importBackup(page: Page, value: unknown, name = '混合旧备份.json') {
  return page.evaluate(async ({ value, name }) => {
    const records = await import('/src/data/fcs/post-finishing-records.ts')
    const input = new File([JSON.stringify(value)], name, {type:'application/json'})
    const before = await input.text()
    let error = ''
    try { await records.importPostFinishingBackup(input) } catch (cause) { error=String(cause) }
    return { ok:!error,error,inputName:input.name,inputPreserved:before===await input.text() }
  }, { value, name })
}

test('main integration: actual restore keeps managed originals readonly, failed input retry and existing auxiliary stock unchanged', async ({ page }) => {
  test.setTimeout(90000)
  await installFixture(page, postFixture)
  await page.goto('/fcs/craft/post-finishing/material-transfers')
  await expect(page.locator('[data-post-material-root]')).toBeVisible()
  await page.evaluate(async id => {
    const api = await import('/src/data/wls/accessory-warehouse-post-finishing.ts'), f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const order = f.getPostFinishingMaterialTransferOrder(id)!
    await api.receiveAccessoryPostTransfer({ id, commandId: 'INTEGRATED-AUX-RECEIVE', at: '2026-10-20T00:00:00Z', actor: { role: '仓管', warehouseCode: 'DLN', name: '整合验证DLN仓管' }, lines: order.lines.map(line => ({ lineId: line.transferLineId, qty: line.preparedQty, locationId: api.listAccessoryPostLocations()[0].id })) })
  }, postFixture.pendingPostTransferId)
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.locator('main h1')).toHaveText('后道加工单')
  const task = await publicPostTask(page)
  const backup = await page.evaluate(async () => JSON.parse(await (await (await import('/src/data/fcs/post-finishing-records.ts')).exportPostFinishingBackup()).text()))
  for (const row of legacyMaterialRows) backup.records.push(structuredClone(row.value))
  backup.files.push({ id: legacyFile.id, type: legacyFile.blob.type, bytes: legacyFile.blob.bytes })
  await page.goto('/fcs/craft/post-finishing/audit-records')
  await expect(page.locator('[data-post-finishing-field="storage-import"]')).toHaveCount(0)
  const before = await durable(page)
  const invalid = await importBackup(page, { invalid: true }, '错误格式.json')
  expect(invalid.error).toContain('格式'); expect(invalid.inputPreserved).toBe(true)
  expect(await durable(page)).toEqual(before)
  const imported = await importBackup(page, backup)
  expect(imported.ok).toBe(true)
  await expect.poll(async () => (await durable(page)).pcs.records.filter(row => row.collection === 'archive' && (row.value as any)?.format === 'post-finishing-readonly-material-original').length).toBe(2)
  await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  const restored = await durable(page)
  expect(restored.accessory).toEqual(before.accessory)
  expect(restored.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection))).toEqual(before.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection)))
  expect(restored.pcs.files.some(file => file.id === legacyFile.id && file.bytes.length === legacyFile.blob.bytes.length)).toBe(true)
  const repeat = await importBackup(page, backup, '同一备份重试.json')
  expect(repeat.ok, repeat.error).toBe(true)
  await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  expect((await durable(page)).pcs.records).toEqual(restored.pcs.records)
  const conflict = structuredClone(backup)
  conflict.records.find((row: any) => row.collection === 'flow/materialStocks').value.currentQty = 6
  const rejected = await importBackup(page, conflict, '相同原记录不同内容.json')
  expect(rejected.error).toContain('冲突'); expect(rejected.inputName).toBe('相同原记录不同内容.json'); expect(rejected.inputPreserved).toBe(true)
  expect(await durable(page)).toEqual(restored)
  const continued = await page.evaluate(async input => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts'), a = f.POST_FINISHING_ACCEPTANCE_ACTORS
    await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: input.parentId, processItem: '开扣眼', quantities: [{ skuId: input.skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: 'AFTER-READONLY-RESTORE' }))
    return r.runPostFinishingCommand(() => f.submitPostFinishingForOutbound({ postTaskId: input.parentId, quantities: [{ skuId: input.skuId, quantity: 100 }], actor: a.postOperator, operationId: 'AFTER-READONLY-RESTORE-OUTBOUND' }))
  }, task)
  expect(continued.lines.reduce((sum, line) => sum + line.outboundQty, 0)).toBe(100)
  expect((await durable(page)).accessory).toEqual(before.accessory)
  await artifact(page, 'readonly-backup-restore', { restored, continued, auxiliaryUnchanged: true, invalid, imported, repeat, rejected, boundary:'公开外部工具File导入失败/重试/冲突保护；正常业务页不恢复维护控件，不冒称原file input UI操作' })
})

async function session(page: Page, roleId: string, factoryId = 'ID-F002') {
  return page.evaluate(async ({ roleId, factoryId }) => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const users = pda.listFactoryPdaUsers(factoryId)
    const selected = users.find(user => user.factoryId === factoryId && user.roleId === roleId)
      || users.find(user => user.factoryId === factoryId && user.roleId === 'ROLE_ADMIN')

    if (!selected) throw new Error('No existing prototype identity for the isolated role control')
    if (selected.roleId !== roleId) pda.setFactoryPdaUserRole(selected.userId, roleId)
    const current = pda.getFactoryPdaUserById(selected.userId)!
    pda.setPdaSession(pda.createPdaSessionFromUser(current))
    return { factoryId: current.factoryId, roleId: current.roleId, userId: current.userId }
  }, { roleId, factoryId })
}

test('main integration: managed PDA real route respects factory/roles, preserves failed receipt input and commits one auxiliary source', async ({ browser, baseURL }) => {
  test.setTimeout(120000)
  const results: any[] = []
  for (const [roleId, factoryId] of [['ROLE_OPERATOR', 'ID-F002'], ['ROLE_ADMIN', 'ID-F002'], ['ROLE_HANDOVER', 'ID-F002'], ['ROLE_DISPATCH', 'ID-F002'], ['ROLE_ADMIN', 'ID-F004']]) {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } }), page = await context.newPage()
    try {
      await installFixture(page, postFixture)
      const identity = await session(page, roleId, factoryId)
      await page.goto('/fcs/craft/post-finishing/material-transfers')
      await expect(page.locator('[data-post-material-root]')).toBeVisible()
      const no = await page.evaluate(id => import('/src/data/fcs/post-finishing-full-flow.ts').then(f => f.getPostFinishingMaterialTransferOrder(id)!.transferOrderNo), postFixture.pendingPostTransferId)
      await page.goto(`/fcs/pda/handover?tab=pickup&materialOrderNo=${encodeURIComponent(no)}`)
      const before = await durable(page)
      if (factoryId !== 'ID-F002') {
        await expect(page.locator('[data-managed-accessory-post-access-blocked]')).toBeVisible()
        await expect(page.locator('[data-pda-post-qty]')).toHaveCount(0)
      } else {
        await expect(page.locator('[data-managed-accessory-post-root]')).toBeVisible()
        const quantities = page.locator('[data-pda-post-qty]'), locations = page.locator('[data-pda-post-location]'), save = page.locator('[data-pda-handover-action="confirm-material-inbound"]')
        if (roleId === 'ROLE_OPERATOR') {
          for (const input of await quantities.all()) await expect(input).toBeDisabled()
          await expect(save).toHaveCount(0)
          const blocked = await page.evaluate(async no => { try { const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts'); await r.runPostFinishingCommand(() => f.receivePostFinishingMaterialTransfer({ transferOrderNo: no, actor: { actorId: 'old', actorName: '旧入口', roleName: '仓管' } })); return '' } catch (error) { return String(error) } }, no)
          expect(blocked).toContain('原整单入库入口不可')
        } else {
          await expect(save).toBeVisible()
          for (const input of await quantities.all()) await expect(input).toBeEnabled()
          if (roleId === 'ROLE_ADMIN') {
            await quantities.nth(0).fill('9'); await quantities.nth(1).fill('20')
            await save.click(); await expect(page.locator('[data-pda-post-error]')).toContainText('逐行')
            expect(await durable(page)).toEqual(before)
            for (const select of await locations.all()) await select.selectOption({ label: 'PF-MAT-A01-01' })
            page.once('dialog', dialog => dialog.accept()); await save.click()
            await expect(page.locator('[data-pda-post-error]')).toContainText('整单')
            expect(await quantities.nth(0).inputValue()).toBe('9')
            expect(await durable(page)).toEqual(before)
            await quantities.nth(0).fill('10')
            await page.evaluate(() => { (window as any).__integratedPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args: any[]) { if (this.name === 'records') throw new DOMException('integrated PDA abort', 'QuotaExceededError'); return (window as any).__integratedPut.apply(this, args) } })
            page.once('dialog', dialog => dialog.accept()); await save.click()
            await expect(page.locator('[data-pda-post-error]')).toContainText('integrated PDA abort')
            expect(await quantities.nth(0).inputValue()).toBe('10')
            expect(await durable(page)).toEqual(before)
            await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__integratedPut })
            await save.click()
            await expect(page.getByRole('heading', { name: '辅料已收货上架', exact: true })).toBeVisible()
            const after = await durable(page)
            expect(after.pcs).toEqual(before.pcs)
            const readback = await page.evaluate(async () => { const f = await import('/src/data/fcs/post-finishing-full-flow.ts'); return { stocks: f.listPostFinishingMaterialStocks().filter(row => row.productionOrderNo === 'PO-AW-202610-F01'), ready: f.getPostFinishingMaterialReadiness('PO-AW-202610-F01') } })
            expect(readback.stocks.map(row => row.currentQty).sort((a, b) => a - b)).toEqual([10, 20])
            expect(readback.ready.status).toBe('已入库')
            await page.reload(); await expect(page.getByRole('heading', { name: '辅料已收货上架', exact: true })).toBeVisible()
            expect(await durable(page)).toEqual(after)
            await artifact(page, 'managed-pda-receipt', { roleId, no, readback, before, after })
            await page.setViewportSize({ width: 480, height: 800 })
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
            await artifact(page, 'managed-pda-receipt-480', { roleId, no, readback })
          } else {
            await quantities.nth(0).fill('10'); await quantities.nth(1).fill('20')
            for (const select of await locations.all()) await select.selectOption({ label: 'PF-MAT-A01-01' })
            page.once('dialog', dialog => dialog.accept()); await save.click()
            await expect(page.getByRole('heading', { name: '辅料已收货上架', exact: true })).toBeVisible()
            expect((await durable(page)).pcs).toEqual(before.pcs)
            const stocks = await page.evaluate(async () => (await import('/src/data/fcs/post-finishing-full-flow.ts')).listPostFinishingMaterialStocks().filter(row => row.productionOrderNo === 'PO-AW-202610-F01').map(row => row.currentQty).sort((a, b) => a - b))
            expect(stocks).toEqual([10, 20])
          }
        }
      }
      if (roleId === 'ROLE_OPERATOR' || factoryId !== 'ID-F002') expect(await durable(page)).toEqual(before)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      results.push({ ...identity, requestedFactoryId: factoryId, actualRoute: page.url(), result: factoryId !== 'ID-F002' ? 'blocked' : roleId === 'ROLE_OPERATOR' ? 'readonly, old managed receive rejected' : roleId === 'ROLE_ADMIN' ? 'failure retry and receipt complete' : 'receipt complete' })
    } finally { await context.close() }
  }
  mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, 'managed-role-results.json'), JSON.stringify(results, null, 2))
})
