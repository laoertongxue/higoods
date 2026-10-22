import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const base = process.env.MAINTENANCE_ENTRYPOINT_TEST_URL || 'http://127.0.0.1:43270'
const output = resolve(process.env.MAINTENANCE_ENTRYPOINT_TEST_OUTPUT || 'output/verification/prototype-full-function-cleanup/storage-tests')
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, evidence }, null, 2)) })
async function run(name: string, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage()
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__maintenance-entrypoint-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>' }))
  try { await page.goto(base + '/__maintenance-entrypoint-harness'); await fn(page); assert.deepEqual(errors, []) }
  catch (error) { await writeFile(resolve(output, `${name}-failure.json`), JSON.stringify({ error: String(error), errors }, null, 2)); await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
}

test('维护页模块与旧入口处理链已删除，数据层保护API保留', async () => {
  for (const path of ['src/pages/process-factory/dyeing/washing/storage-tools.ts', 'src/pages/process-factory/cutting/replacement-fabric-data-tools.ts']) {
    await assert.rejects(readFile(path, 'utf8'), { code: 'ENOENT' })
  }
  for (const path of ['src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts', 'src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts']) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /storage-tools|replacement-fabric-data-tools|renderWashingStorageTools|handleWashingStorageAction|data-hpb-data-action|data-hpb-restore-file/)
  }
  const notice = await readFile('src/pages/process-factory/post-finishing/storage-notice.ts', 'utf8')
  assert.doesNotMatch(notice, /renderPostFinishingBackupActions|exportPostFinishingBackup|importPostFinishingBackup|storage-export|storage-import/)
  await assert.rejects(readFile('src/data/fcs/fabric-washing-maintenance.ts', 'utf8'), { code: 'ENOENT' })
  assert.match(await readFile('src/data/fcs/cutting/cutting-backup-file.ts', 'utf8'), /buildCuttingBackupFile/)
})

test('定型机手感、后道审计、换片布直接展示静态业务，不要求维护或持久化种子', { timeout: 90000 }, async () => run('direct-mock', async page => {
  const result = await page.evaluate(async () => {
    let writes = 0; const put = IDBObjectStore.prototype.put, add = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) { writes++; return put.apply(this, args) }
    IDBObjectStore.prototype.add = function(...args: Parameters<typeof add>) { writes++; return add.apply(this, args) }
    try {
      const handfeel = await import('/src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts')
      const handfeelHtml = await handfeel.renderStenterHandfeelListPage()
      const audit = await import('/src/pages/process-factory/post-finishing/audit-records.ts')
      const post = await import('/src/data/fcs/post-finishing-records.ts')
      await post.ensurePostFinishingRecordState()
      const postHtml = audit.renderPostFinishingAuditRecordsPage(), notice = (await import('/src/pages/process-factory/post-finishing/storage-notice.ts')).renderPostFinishingStorageNotice()
      const production = await import('/src/data/fcs/production-context-records.ts')
      await production.hydrateProductionContextRecords()
      await (await import('/src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
      const replacement = await import('/src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts')
      const replacementHtml = await replacement.renderReplacementFabricFeiTicketsPage()
      document.body.innerHTML = `<main>${handfeelHtml}${postHtml}${replacementHtml}</main>`
      return { handfeelHtml, postHtml, replacementHtml, notice, writes, replacementTickets: (await import('/src/data/fcs/cutting/replacement-fabric-repository.ts')).readReplacementFabricState().tickets.length }
    } finally { IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.add = add }
  })
  assert.equal(result.writes, 0); assert.equal(result.notice, ''); assert.ok(result.replacementTickets > 0)
  for (const html of [result.handfeelHtml, result.postHtml, result.replacementHtml]) assert.doesNotMatch(html, /本机数据|本地资料|storage-export|storage-import|data-tools|迁移并继续/)
  assert.match(result.handfeelHtml, /定型机手感单/); assert.match(result.postHtml, /差异与操作日志/); assert.match(result.replacementHtml, /打印|详情|历史票查询/)
  await expect(page.locator('[data-hpb-page]')).toBeVisible(); await expect(page.locator('[data-stenter-list-root]')).toBeVisible()
  evidence['direct-mock'] = { passed: true, indexedDbRecordWrites: result.writes, replacementTickets: result.replacementTickets }
}))

test('伪造已退役维护事件不会导入导出、写库或导航', { timeout: 90000 }, async () => run('retired-handlers', async page => {
  const result = await page.evaluate(async () => {
    const post = await import('/src/data/fcs/post-finishing-records.ts'), notice = await import('/src/pages/process-factory/post-finishing/storage-notice.ts')
    await post.ensurePostFinishingRecordState()
    const store = (await import('/src/state/store.ts')).appStore
    let navigations = 0, urls = 0, writes = 0
    const navigate = store.navigate, createUrl = URL.createObjectURL, put = IDBObjectStore.prototype.put
    store.navigate = () => { navigations++ }; URL.createObjectURL = () => { urls++; return 'blob:forbidden' }
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) { writes++; return put.apply(this, args) }
    try {
      const handled: boolean[] = []
      for (const action of ['storage-export', 'storage-import', 'storage-cleanup', 'storage-migrate', 'storage-retry']) {
        const button = document.createElement('button'); button.dataset.postFinishingAction = action; document.body.append(button)
        handled.push(await notice.handlePostFinishingStorageEvent(button, new MouseEvent('click')))
      }
      const input = document.createElement('input'); input.dataset.postFinishingField = 'storage-import'; input.type = 'file'; document.body.append(input)
      handled.push(await notice.handlePostFinishingStorageEvent(input, new Event('change')))
      const handfeel = await import('/src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts')
      return { handled, navigations, urls, writes, maintenanceOpened: Boolean(document.querySelector('[data-hpb-data-message]')) }
    } finally { store.navigate = navigate; URL.createObjectURL = createUrl; IDBObjectStore.prototype.put = put }
  })
  assert.deepEqual(result, { handled: [false, false, false, false, false, false], navigations: 0, urls: 0, writes: 0, maintenanceOpened: false })
  evidence['retired-handlers'] = { passed: true, ...result }
}))

test('后道仅真实旧资料出现恢复；取消、事务故障保留原源，重试核对后清理', { timeout: 90000 }, async () => run('post-legacy-recovery', async page => {
  const result = await page.evaluate(async () => {
    const records = await import('/src/data/fcs/post-finishing-records.ts'), notice = await import('/src/pages/process-factory/post-finishing/storage-notice.ts')
    let values: any[] = [{ logId: 'STATIC-LOG', message: '静态示例' }]
    records.registerPostFinishingRepository('logs', 'cleanup-post-legacy', () => values, next => { values = next })
    const raw = JSON.stringify([{ logId: 'USER-LOG', message: '用户原资料' }]); localStorage.setItem('cleanup-post-legacy', raw); localStorage.setItem('cleanup-unrelated', 'keep')
    await records.ensurePostFinishingRecordState()
    let businessBlocked = ''; try { await records.runPostFinishingCommand(() => values.push({ logId: 'SHOULD-NOT-SAVE' })) } catch (cause) { businessBlocked = String(cause) }
    document.body.innerHTML = notice.renderPostFinishingStorageNotice()
    const button = document.querySelector<HTMLElement>('[data-post-finishing-action="storage-migrate"]')!
    const store = (await import('/src/state/store.ts')).appStore, navigate = store.navigate, confirm = window.confirm
    let navigations = 0; store.navigate = () => { navigations++ }; window.confirm = () => false
    const transaction = IDBDatabase.prototype.transaction
    try {
      await notice.handlePostFinishingStorageEvent(button, new MouseEvent('click'))
      const cancelKept = localStorage.getItem('cleanup-post-legacy') === raw && navigations === 0
      window.confirm = () => true
      IDBDatabase.prototype.transaction = function(...args: Parameters<typeof transaction>) { if (args[1] === 'readwrite') throw new Error('专项验收事务故障'); return transaction.apply(this, args) }
      await notice.handlePostFinishingStorageEvent(button, new MouseEvent('click'))
      const failureKept = localStorage.getItem('cleanup-post-legacy') === raw && document.body.textContent!.includes('专项验收事务故障') && navigations === 0
      IDBDatabase.prototype.transaction = transaction
      await notice.handlePostFinishingStorageEvent(document.querySelector<HTMLElement>('[data-post-finishing-action="storage-migrate"]')!, new MouseEvent('click'))
      await records.ensurePostFinishingRecordState()
      const db = await (await import('/src/data/pcs-record-db.ts')).readPcsRecords(['higood-fcs-post-finishing-records'])
      const clearedAfterMigration = notice.renderPostFinishingStorageNotice() === ''
      IDBDatabase.prototype.transaction = function(...args: Parameters<typeof transaction>) { if (args[1] === 'readonly') throw new Error('专项验收读取故障'); return transaction.apply(this, args) }
      await records.ensurePostFinishingRecordState()
      document.body.innerHTML = notice.renderPostFinishingStorageNotice()
      const rereadVisible = Boolean(document.querySelector('[data-post-finishing-action="storage-retry"]')) && document.body.textContent!.includes('专项验收读取故障')
      IDBDatabase.prototype.transaction = transaction
      await notice.handlePostFinishingStorageEvent(document.querySelector<HTMLElement>('[data-post-finishing-action="storage-retry"]')!, new MouseEvent('click'))
      return { businessBlocked, cancelKept, failureKept, clearedAfterMigration, rereadVisible, navigations, legacyRemoved: localStorage.getItem('cleanup-post-legacy') === null, unrelatedKept: localStorage.getItem('cleanup-unrelated') === 'keep', userRecordKept: db.records.some(row => (row.value as any)?.logId === 'USER-LOG'), noticeAfter: notice.renderPostFinishingStorageNotice() }
    } finally { IDBDatabase.prototype.transaction = transaction; store.navigate = navigate; window.confirm = confirm }
  })
  assert.match(result.businessBlocked, /旧后道资料/); assert.ok(result.cancelKept); assert.ok(result.failureKept); assert.equal(result.navigations, 0, 'main已由shell单次重绘，恢复处理器不再额外导航'); assert.ok(result.clearedAfterMigration); assert.ok(result.rereadVisible)
  assert.ok(result.legacyRemoved); assert.ok(result.unrelatedKept); assert.ok(result.userRecordKept); assert.equal(result.noticeAfter, '')
  evidence['post-legacy-recovery'] = { passed: true, ...result }
}))

test('换片布真实旧生产资料由既有全局恢复承接，未确认不迁移，确认后读回继续', { timeout: 90000 }, async () => run('replacement-global-recovery', async page => {
  const fixture = await page.evaluate(async () => {
    const source = await import('/src/data/fcs/production-context-records.ts')
    const raw = JSON.stringify({ version: 1, taskOverrides: [], splitPlans: [], mergedPlans: [], reassignedTasks: [], auditSeq: 11 })
    localStorage.setItem(source.PRODUCTION_CONTEXT_KEYS.runtime, raw); localStorage.setItem('cleanup-unrelated', 'keep')
    return { key: source.PRODUCTION_CONTEXT_KEYS.runtime, raw }
  })
  await page.goto(base + '/fcs/craft/cutting/replacement-fabric-fei-tickets')
  await expect(page.locator('[data-production-context-recovery]')).toBeVisible()
  await expect(page.locator('[data-hpb-page]')).toHaveCount(0)
  await page.locator('[data-production-context-migrate]').click()
  await expect(page.locator('[data-production-context-progress]')).toContainText('关闭其他 HiGood 页面')
  assert.equal(await page.evaluate(key => localStorage.getItem(key), fixture.key), fixture.raw)
  await page.locator('[data-production-context-pages-closed]').check()
  await page.locator('[data-production-context-migrate]').click()
  await expect(page.locator('[data-hpb-page]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-production-context-recovery]')).toHaveCount(0)
  const after = await page.evaluate(async key => {
    const source = await import('/src/data/fcs/production-context-records.ts')
    return { legacy: localStorage.getItem(key), unrelated: localStorage.getItem('cleanup-unrelated'), runtime: JSON.parse(source.readProductionContextValue(key)!) }
  }, fixture.key)
  assert.equal(after.legacy, null); assert.equal(after.unrelated, 'keep'); assert.equal(after.runtime.auditSeq, 11)
  await expect(page.locator('[data-hpb-action="data-tools"]')).toHaveCount(0)
  evidence['replacement-global-recovery'] = { passed: true, preservedAuditSeq: after.runtime.auditSeq, unrelated: after.unrelated }
}))


test('换片布打开后旧来源变化仍阻断新增并给出实际恢复，不丢失旧资料', { timeout: 90000 }, async () => run('replacement-late-legacy', async page => {
  const result = await page.evaluate(async () => {
    const production = await import('/src/data/fcs/production-context-records.ts')
    await production.hydrateProductionContextRecords()
    await (await import('/src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
    const ui = await import('/src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts'), repository = await import('/src/data/fcs/cutting/replacement-fabric-repository.ts')
    document.body.innerHTML = await ui.renderReplacementFabricFeiTicketsPage()
    const first = document.querySelector<HTMLElement>('[data-hpb-action="print"]')!
    await ui.handleReplacementFabricEvent(first, new MouseEvent('click', { cancelable: true }))
    const add = document.querySelector<HTMLElement>('[data-hpb-action="add"]:not([disabled])')!
    if (!add) throw new Error('测试正常生产单缺少可新增菲票的面料')
    const before = repository.readReplacementFabricState().tickets.length
    const raw = JSON.stringify({ version: 1, taskOverrides: [], splitPlans: [], mergedPlans: [], reassignedTasks: [], auditSeq: 19 })
    localStorage.setItem(production.PRODUCTION_CONTEXT_KEYS.runtime, raw)
    await ui.handleReplacementFabricEvent(add, new MouseEvent('click', { cancelable: true }))
    return { before, after: repository.readReplacementFabricState().tickets.length, oldSourceKept: localStorage.getItem(production.PRODUCTION_CONTEXT_KEYS.runtime) === raw, recoveryVisible: Boolean(document.querySelector('[data-production-context-recovery]')), message: document.querySelector('[data-production-context-recovery]')?.textContent }
  })
  assert.equal(result.after, result.before); assert.ok(result.oldSourceKept); assert.ok(result.recoveryVisible); assert.match(result.message!, /旧页面写入了生产来源/)
  evidence['replacement-late-legacy'] = { passed: true, ...result }
}))
