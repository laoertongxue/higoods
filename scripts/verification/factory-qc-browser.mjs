import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'

const argument = key => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1] }
const baseURL = argument('--base-url') || 'http://127.0.0.1:43221'
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const output = resolve(argument('--output') || `output/playwright/factory-qc-contracts/${runId}`)
await mkdir(output, { recursive: true })
const boundFiles = ['src/main.ts', 'src/data/pcs-record-db.ts', 'src/data/fcs/factory-qc-model.ts', 'src/data/fcs/factory-qc.ts', 'src/data/fcs/factory-qc-records.ts', 'src/data/fcs/factory-process-storage.ts', 'src/data/fcs/production-context-records.ts', 'src/data/fcs/legacy-washing-removal.ts', 'src/data/pcs-technical-data-demo-projection.ts', 'src/data/tech-pack-process-route.ts', 'src/data/fcs/design-revision-pcs-storage.ts', 'src/data/fcs/design-revision-pcs-command.ts', 'src/data/fcs/printing-task-domain.ts', 'src/data/fcs/printing-factory-demos.ts', 'src/data/fcs/dyeing-task-domain.ts', 'src/data/fcs/water-soluble-output.ts', 'src/data/fcs/water-soluble-task-domain.ts', 'src/data/fcs/factory-receiving.ts', 'src/pages/process-factory/shared/factory-qc.ts', 'src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts', 'scripts/verification/factory-qc-browser.mjs']
const hashes = async () => Object.fromEntries(await Promise.all(boundFiles.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
const report = { runId, baseURL, output, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Vite原型真实页面模块与IndexedDB隔离验证；不代表生产包、性能、工厂照片或现场业务接受', developmentOnly: '隔离Vite HMR websocket，避免同时开发写文件导致页面重载；业务API、IndexedDB和页面均为实际实现', cases: [] }
report.sourceHashesBefore = await hashes()
const browser = await chromium.launch({ headless: true })

async function load(page) {
  return page.evaluate(async () => {
    // Vite adds version queries to static imports. Reuse those exact URLs so a
    // direct test import does not register a second mutable repository bridge.
    const facadeCode = await (await fetch('/src/data/fcs/factory-qc.ts')).text()
    const dependency = (source, filename) => {
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = source.match(new RegExp('["\']([^"\']*' + escaped + '(?:\\?[^"\']*)?)["\']'))
      if (!match) throw new Error('Vite依赖URL无法定位：' + filename)
      return match[1]
    }
    const qc = await import('/src/data/fcs/factory-qc.ts')
    const recordsUrl = dependency(facadeCode, 'factory-qc-records.ts')
    const records = await import(recordsUrl)
    const repositoryCode = await (await fetch(recordsUrl)).text()
    const db = await import(dependency(repositoryCode, 'pcs-record-db.ts'))
    const receiving = await import(dependency(facadeCode, 'factory-receiving.ts'))
    const printing = await import(dependency(facadeCode, 'printing-task-domain.ts'))
    const dyeing = await import(dependency(facadeCode, 'dyeing-task-domain.ts'))
    const factories = await import(dependency(facadeCode, 'factory-master-store.ts'))
    const commands = await import('/src/data/fcs/design-revision-pcs-command.ts')
    window.__qcVerification = { qc, records, db, receiving, printing, dyeing, factories, commands }
    await qc.ensureFactoryQcRecords(true)
    return { orders: qc.listFactoryQcOrders().length }
  })
}
async function newPage(context, route = '/fcs/craft/printing/qc-orders') {
  const page = await context.newPage()
  await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' })
  // Let the application's own bootstrap finish its source hydration before a
  // verification-only force read. Calling the API at DOMContentLoaded starts
  // a second hydration while main.ts is still acquiring the same source lock.
  await page.locator('[data-factory-qc-root], [data-stenter-list-root], [data-stenter-detail-root]').first().waitFor()
  await load(page)
  return page
}
async function fixture(page, requireUnhanded = false) {
  return page.evaluate(requireUnhanded => {
    const { qc } = window.__qcVerification
    const order = qc.listFactoryQcOrders('PRINTING').find(order => order.rolls.length && (!requireUnhanded || !order.source.handedOutRollIds.length && !order.source.rolls.some(roll => roll.handedOut) && order.source.rolls.some(roll => roll.confirmed && roll.qty > 0)))
    if (!order) throw new Error(requireUnhanded ? '缺少已最终产出且未交出的真实静态印花QC来源，请补合法fixture；测试没有注入来源单。' : '缺少带真实卷的静态印花QC来源。')
    return structuredClone(order)
  }, requireUnhanded)
}
async function photo(page, source, id) {
  const response = await page.request.get(new URL(source.imageUrl, baseURL).href)
  assert.equal(response.ok(), true, '对应面料素材必须可读')
  const bytes = await response.body(), type = response.headers()['content-type']?.split(';')[0]
  assert.ok(['image/jpeg', 'image/png', 'image/webp'].includes(type), '素材须为对应面料图片')
  return { id, name: `prototype-material-${id}.${type.split('/')[1]}`, type, size: bytes.length, bytes: [...bytes] }
}
async function saveRoll(page, order, payload, { complete = false, notes = '原型测试现场说明', operationId = crypto.randomUUID(), version = 0 } = {}) {
  return page.evaluate(async ({ order, payload, complete, notes, operationId, version }) => {
    const { qc } = window.__qcVerification, file = new File([new Uint8Array(payload.bytes)], payload.name, { type: payload.type })
    await qc.saveFactoryQcRoll({ qcId: order.id, rollId: order.rolls[0].id, expectedVersion: version, photos: [{ id: payload.id, name: payload.name, type: payload.type, size: payload.size }], results: { color: '有差异', handfeel: '实际触摸偏硬', material: '符合要求' }, notes, complete, newFiles: [file] }, operationId)
    return structuredClone(qc.getFactoryQcOrder(order.id))
  }, { order, payload, complete, notes, operationId, version })
}
async function databaseSnapshot(page) {
  return page.evaluate(async () => {
    const { db, records } = window.__qcVerification
    const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('')
    const data = await db.readPcsRecords([records.QC_COLLECTION, records.HAND_FEEL_COLLECTION, records.PROCESS_COLLECTION, 'higood-pcs-fcs-design-revision-dye-v1', 'higood-pcs-fcs-design-revision-print-v1', 'higood-pcs-fcs-design-revision-handover-v1', 'higood-pcs-fcs-design-revision-receiving-v1'])
    const rows = await Promise.all(data.records.map(async row => ({ id: row.id, version: row.version, hash: await digest(new TextEncoder().encode(JSON.stringify(row.value))) })))
    const files = await Promise.all(data.files.map(async file => ({ id: file.id, hash: await digest(await file.blob.arrayBuffer()) })))
    const native = await Promise.all(['higoods.formal-dye-execution.v1', 'higoods.formal-print-execution.v1', 'higood.formal-merged-handout-actions.v1', 'higood-factory-material-receiving-v1', 'higoods.formal-water-execution.v1'].map(async key => ({ key, hash: await digest(new TextEncoder().encode(JSON.stringify(localStorage.getItem(key)))) })))
    return { rows: rows.sort((a, b) => a.id.localeCompare(b.id)), files: files.sort((a, b) => a.id.localeCompare(b.id)), native }
  })
}
async function run(name, action) {
  if (argument('--case') && !argument('--case').split(',').includes(name)) return
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await context.routeWebSocket(url => url.host === new URL(baseURL).host, socket => { socket.onMessage(() => undefined) })
  const errors = [], result = { name, status: 'running', errors }
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)))
  try { result.observations = await action(context); result.status = errors.length ? 'failed' : 'passed'; if (errors.length) result.error = '浏览器存在未处理异常' }
  catch (error) { result.status = 'failed'; result.error = error.stack || String(error); const page = context.pages()[0]; if (page) { result.visibleErrors = await page.locator('[data-factory-qc-error],[data-factory-qc-roll-error],[data-factory-qc-decision-error]').allTextContents().catch(() => []); await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => undefined); const editor = page.locator('[data-factory-qc-editor]'); if (await editor.count()) await editor.screenshot({ path: resolve(output, `${name}-editor-failure.png`) }).catch(() => undefined); if (name === 'actual_source_complete_creates_and_appends_qc') result.sourceFlags = await page.evaluate(async () => { const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records', 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); const rows = await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); db.close(); return { memory: window.__qcVerification?.printing.capturePrintProcessMutationState().workOrders.filter(([id, order]) => id.startsWith('PWO-PRINT-DEMO-') && !order.factoryDemoInitialized && (order.manuallyCompletedAt || order.businessView?.productionCompletedAt)).map(([id, order]) => ({ id, initialized: order.factoryDemoInitialized, status: order.status, productionCompletedAt: order.businessView?.productionCompletedAt, manuallyCompletedAt: order.manuallyCompletedAt })), persisted: rows.filter(row => row.value?.path === 'state.workOrders' && row.value?.legacyKey?.includes('formal-print')).map(row => ({ id: row.value.key, initialized: row.value.value.factoryDemoInitialized, status: row.value.value.status, productionCompletedAt: row.value.value.businessView?.productionCompletedAt, actualUsedQty: row.value.value.businessView?.actualInput?.usedQty, batches: row.value.value.businessView?.productionBatches?.length })) } }).catch(() => []) } }
  finally { await context.close(); report.cases.push(result); await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(result)) }
}

try {
  await run('ui_draft_complete_immutable_cold', async context => {
    const page = await newPage(context), order = await fixture(page), uploaded = await photo(page, order.source, 'QC-UI-PHOTO')
    await page.locator('[data-factory-qc-root="list"]').waitFor()
    const progress = page.locator(`a[aria-label="查看全部卷的质检详情"][href$="${encodeURIComponent(order.id)}"]`)
    assert.equal(await progress.count(), 1, '应检和已检卷数在同一个可点击进度入口')
    assert.match(await progress.innerText(), /已检\s+0\s*\/\s*应检\s+\d+\s*卷/)
    await progress.click()
    await page.locator('[data-factory-qc-root="detail"]').waitFor()
    await page.locator(`[data-factory-qc-action="select-roll"][data-roll-id="${order.rolls[0].id}"]`).click()
    await page.locator('[data-factory-qc-field="photos"]').setInputFiles({ name: uploaded.name, mimeType: uploaded.type, buffer: Buffer.from(uploaded.bytes) })
    await page.locator('[data-factory-qc-field="color"]').selectOption('有差异')
    await page.locator('[data-factory-qc-field="handfeel"]').selectOption('有差异')
    await page.locator('[data-factory-qc-field="material"]').selectOption('符合要求')
    await page.locator('[data-factory-qc-field="notes"]').fill('原型真实文件上传与未完成保存验证')
    await page.locator('[data-factory-qc-action="save-roll"]').click()
    await page.waitForFunction(() => document.querySelector('[data-factory-qc-notice]')?.textContent?.includes('已保存') || document.querySelector('[data-factory-qc-roll-error]')?.textContent?.trim())
    assert.equal((await page.locator('[data-factory-qc-roll-error]').textContent())?.trim(), '')
    const draft = await page.evaluate(async id => { const q = await import('/src/data/fcs/factory-qc.ts'); await q.ensureFactoryQcRecords(true); return structuredClone(q.getFactoryQcOrder(id)) }, order.id)
    assert.equal(draft.rolls[0].completedAt, undefined); assert.equal(draft.rolls[0].photos.length, 1)
    await page.locator('[data-factory-qc-action="complete-roll"]').click()
    await page.getByText('已完成质检 · 记录只读', { exact: true }).waitFor()
    await page.locator('[data-factory-qc-roll-editor]').screenshot({ path: resolve(output, 'qc-completed-readonly-editor.png') })
    await page.reload({ waitUntil: 'domcontentloaded' }); await load(page)
    const completed = await page.evaluate(id => structuredClone(window.__qcVerification.qc.getFactoryQcOrder(id)), order.id)
    assert.ok(completed.rolls[0].completedAt); assert.equal(completed.rolls[0].photos.length, 1)
    const edit = await page.evaluate(async order => { const { qc } = window.__qcVerification; try { await qc.saveFactoryQcRoll({ qcId: order.id, rollId: order.rolls[0].id, expectedVersion: order.rolls[0].version, photos: order.rolls[0].photos, results: { color: '覆盖', handfeel: '覆盖', material: '覆盖' }, notes: '不允许覆盖', complete: false }, 'UI-IMMUTABLE'); return 'unexpected-success' } catch (error) { return error.message } }, completed)
    assert.match(edit, /已完成质检.*不允许修改/)
    await page.screenshot({ path: resolve(output, 'qc-completed-cold.png'), fullPage: true })
    return { qcId: order.id, rollId: order.rolls[0].id, draftVersion: draft.rolls[0].version, completedVersion: completed.rolls[0].version, rejection: edit }
  })

  await run('gtg_receipt_use_output_nonrecursive_cold', async context => {
    const page = await newPage(context), qcOrder = await fixture(page, true)
    const created = await page.evaluate(async qcId => { const { qc } = window.__qcVerification; const order = qc.getFactoryQcOrder(qcId); await qc.decideFactoryQcHandfeel({ qcId, expectedVersion: order.version, needs: true }, 'FLOW-DECIDE'); return structuredClone(qc.listStenterHandfeelOrders()[0]) }, qcOrder.id)
    assert.equal(created.factoryId, 'ID-F003'); assert.equal(created.handFeel, undefined)
    assert.equal(created.rolls.some(roll => roll.sentAt || roll.receivedAt || roll.startedAt), false)
    const facts = await page.evaluate(async orderId => {
      const { qc, receiving } = window.__qcVerification
      let order = qc.getStenterHandfeelOrder(orderId), roll = order.rolls[0]
      const submit = async (type, extra) => { order = qc.getStenterHandfeelOrder(orderId); await qc.submitStenterHandfeelCommand({ type, orderId, expectedVersion: order.version, ...extra }, 'FLOW-' + type) }
      await submit('TARGET', { target: '加厚手感' })
      await submit('SEND', { rolls: [{ id: roll.id, barcode: roll.barcode }] })
      const sent = structuredClone(qc.getStenterHandfeelOrder(orderId).rolls[0])
      const position = receiving.getDefaultFactoryReceiptPosition('ID-F003')
      await submit('RECEIVE', { rolls: [{ id: roll.id, barcode: roll.barcode, qty: roll.inputQty, ...position }] })
      const received = structuredClone(qc.getStenterHandfeelOrder(orderId).rolls[0])
      await submit('START', { rolls: [{ id: roll.id }] })
      await submit('OUTPUT', { rolls: [{ id: roll.id, qty: roll.inputQty, barcode: 'QC-TEST-ACTUAL-OUTPUT-1' }] })
      const updated = structuredClone(qc.getStenterHandfeelOrder(orderId)), nextQc = qc.listFactoryQcOrders('DYEING').find(row => row.source.kind === 'STENTER_HAND_FEEL' && row.source.id === orderId)
      if (!nextQc) throw new Error('首批OUTPUT未创建手感来源染厂QC')
      let rejection = ''; try { await qc.decideFactoryQcHandfeel({ qcId: nextQc.id, expectedVersion: nextQc.version, needs: true, target: '柔软手感' }, 'FLOW-RECURSIVE') } catch (error) { rejection = error.message }
      await submit('HANDOUT', { rolls: [{ id: roll.id, barcode: 'QC-TEST-ACTUAL-OUTPUT-1' }] })
      await submit('DOWNSTREAM_RECEIVE', { rolls: [{ id: roll.id, qty: roll.inputQty }] })
      return { sent, received, order: updated, downstream: structuredClone(qc.getStenterHandfeelOrder(orderId).rolls[0]), nextQc: structuredClone(nextQc), rejection, uses: receiving.listFactoryMaterialUses().filter(use => use.stenterHandfeelOrderId === orderId) }
    }, created.id)
    assert.equal(facts.sent.receivedAt, undefined); assert.ok(facts.received.receivedAt); assert.equal(facts.received.startedAt, undefined)
    assert.ok(facts.order.rolls[0].completedAt); assert.equal(facts.order.completedAt, undefined); assert.equal(facts.uses.length, 1)
    assert.equal(facts.nextQc.rolls.length, 1); assert.match(facts.rejection, /只有印花和染色来源/)
    assert.equal(facts.nextQc.rolls[0].completedAt, undefined); assert.equal(facts.nextQc.rolls[0].photos.length, 0)
    assert.ok(facts.downstream.handedOutAt); assert.ok(facts.downstream.downstreamReceivedAt)
    await page.goto(baseURL + '/fcs/craft/dyeing/stenter-handfeel/work-orders/' + encodeURIComponent(created.id), { waitUntil: 'domcontentloaded' }); await load(page)
    const cold = await page.evaluate(id => structuredClone(window.__qcVerification.qc.getStenterHandfeelOrder(id)), created.id)
    assert.equal(cold.rolls[0].outputBarcode, 'QC-TEST-ACTUAL-OUTPUT-1'); assert.equal(cold.factoryId, 'ID-F003')
    await page.screenshot({ path: resolve(output, 'stenter-output-cold.png'), fullPage: true })
    return { sourceQcId: qcOrder.id, handfeelId: created.id, outputQcId: facts.nextQc.id, actualReceiptQty: facts.received.receivedQty, actualUseQty: facts.uses[0].lines.reduce((sum, line) => sum + line.qty, 0), outputQty: cold.rolls[0].outputQty, actualDownstreamQty: cold.rolls[0].downstreamQty, recursionRejection: facts.rejection }
  })

  await run('indexeddb_abort_keeps_original_and_retry', async context => {
    const page = await newPage(context), order = await fixture(page), payload = await photo(page, order.source, 'QC-ABORT-PHOTO')
    const before = await databaseSnapshot(page)
    const aborted = await page.evaluate(async ({ order, payload }) => {
      const { qc } = window.__qcVerification, original = IDBDatabase.prototype.transaction; let injected = false
      IDBDatabase.prototype.transaction = function (...args) { const tx = original.apply(this, args); if (!injected && args[1] === 'readwrite') { injected = true; queueMicrotask(() => tx.abort()) } return tx }
      let message = ''; try { await qc.saveFactoryQcRoll({ qcId: order.id, rollId: order.rolls[0].id, expectedVersion: 0, photos: [{ id: payload.id, name: payload.name, type: payload.type, size: payload.size }], results: { color: '有差异', handfeel: '偏硬', material: '符合要求' }, notes: '必须整体回滚', complete: true, newFiles: [new File([new Uint8Array(payload.bytes)], payload.name, { type: payload.type })] }, 'ABORT-STABLE') } catch (error) { message = error.message } finally { IDBDatabase.prototype.transaction = original }
      return { injected, message }
    }, { order, payload })
    assert.equal(aborted.injected, true); assert.match(aborted.message, /中止|未保存|abort/i)
    await load(page)
    const after = await databaseSnapshot(page)
    assert.deepEqual(after, before, '中止不能留下主单、卷、来源或照片半套事实')
    const retry = await saveRoll(page, order, payload, { complete: true, notes: '中止后真实重试成功', operationId: 'ABORT-STABLE' })
    assert.ok(retry.rolls[0].completedAt)
    return { before, afterAbort: after, rejection: aborted.message, retryCompletedAt: retry.rolls[0].completedAt }
  })

  await run('multitab_stale_and_completed_lock', async context => {
    const first = await newPage(context), order = await fixture(first), second = await newPage(context)
    const oldVersion = (await second.evaluate(id => structuredClone(window.__qcVerification.qc.getFactoryQcOrder(id)), order.id)).rolls[0].version
    const a = await photo(first, order.source, 'QC-TAB-A'), b = await photo(second, order.source, 'QC-TAB-B')
    const firstSave = await saveRoll(first, order, a, { notes: '标签A的原记录' })
    let stale = ''; try { await saveRoll(second, order, b, { notes: '标签B不应覆盖', version: oldVersion }) } catch (error) { stale = error.message }
    assert.match(stale, /其他页面更新|版本/)
    await first.evaluate(async order => { const { qc } = window.__qcVerification, current = qc.getFactoryQcOrder(order.id); await qc.saveFactoryQcRoll({ qcId: order.id, rollId: order.rolls[0].id, expectedVersion: current.rolls[0].version, photos: current.rolls[0].photos, results: current.rolls[0].results, notes: current.rolls[0].notes, complete: true }, 'TAB-A-COMPLETE') }, firstSave)
    let immutable = ''; try { await saveRoll(second, order, b, { notes: '陈旧页不能修改完成卷', version: firstSave.rolls[0].version }) } catch (error) { immutable = error.message }
    assert.match(immutable, /已完成质检.*不允许修改/)
    await second.reload({ waitUntil: 'domcontentloaded' }); await load(second)
    const final = await second.evaluate(async id => { const { qc, db } = window.__qcVerification; const order = qc.getFactoryQcOrder(id); return { roll: structuredClone(order.rolls[0]), rejectedFile: (await db.readPcsFiles(['QC-TAB-B'])).length } }, order.id)
    assert.equal(final.roll.notes, '标签A的原记录'); assert.equal(final.roll.photos[0].id, 'QC-TAB-A'); assert.equal(final.rejectedFile, 0)
    const direct = await second.evaluate(async qcId => {
      const { db, records } = window.__qcVerification
      const before = (await db.readPcsRecords([records.QC_COLLECTION])).records.find(row => row.value.kind === 'roll' && row.value.qcId === qcId)
      if (!before?.value.data.completedAt) throw new Error('直达写入负例必须使用已完成的真实持久卷')
      const photoId = before.value.data.photos[0].id
      const hash = async () => { const files = await db.readPcsFiles([photoId]); if (files.length !== 1) throw new Error('本卷原图文件缺失'); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await files[0].blob.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('') }
      const originalPhotoHash = await hash(), changed = structuredClone(before.value); changed.data.notes = '同版本直达写入也必须拒绝'
      let putRejection = '', deleteRejection = ''
      try { await db.commitPcsRecords({ puts: [{ id: before.id, collection: before.collection, value: changed, expectedVersion: before.version }], deletes: [], operationId: 'DIRECT-FORBIDDEN-COMPLETED-PUT', intent: 'attempt completed roll exact-version rewrite' }) } catch (error) { putRejection = error.message }
      try { await db.commitPcsRecords({ puts: [], deletes: [{ id: before.id, expectedVersion: before.version }], operationId: 'DIRECT-FORBIDDEN-COMPLETED-DELETE', intent: 'attempt completed roll exact-version deletion' }) } catch (error) { deleteRejection = error.message }
      const after = (await db.readPcsRecords([records.QC_COLLECTION])).records.find(row => row.id === before.id)
      return { expectedVersion: before.version, putRejection, deleteRejection, unchanged: JSON.stringify(before) === JSON.stringify(after), originalPhotoHash, finalPhotoHash: await hash() }
    }, order.id)
    assert.match(direct.putRejection, /已完成质检|质检.*锁定|完成.*修改/)
    assert.match(direct.deleteRejection, /已完成质检|质检.*删除|完成.*删除/)
    assert.equal(direct.unchanged, true); assert.equal(direct.finalPhotoHash, direct.originalPhotoHash)
    return { qcId: order.id, staleRejection: stale, completedRejection: immutable, finalVersion: final.roll.version, rejectedFileCount: final.rejectedFile, direct }
  })

  await run('retired_collections_preserve_shared_and_files', async context => {
    const page = await context.newPage()
    await page.route('**/__qc-old-version-fixture__', route => route.fulfill({ contentType: 'text/html', body: '<title>隔离旧版资料夹具</title>' }))
    await page.goto(baseURL + '/__qc-old-version-fixture__')
    await page.evaluate(async () => {
      const retired = ['fcs.fabric-washing.v1', 'fcs.fabric-washing.process-records.v1']
      const oldPhoto = 'wash-file-old-only', sharedPhoto = 'wash-file-shared'
      const sharedRow = { path: 'receipts', key: 'SHARED-REAL-RECEIPT', tuple: false, legacyKey: 'higood-factory-material-receiving-v1', value: { id: 'SHARED-REAL-RECEIPT', lines: [{ id: 'KEEP-PRINT', printingOrderId: 'REAL-PRINT', qty: 12.345, fileId: sharedPhoto }, { id: 'REMOVE-WASH', washingOrderId: 'WASH-OLD', qty: 100, fileId: oldPhoto }] } }
      const database = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records', 2); request.onupgradeneeded = () => { for (const name of ['records', 'files', 'operations', 'meta']) request.result.createObjectStore(name, { keyPath: 'id' }); request.transaction.objectStore('operations').createIndex('createdAt', 'createdAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      await new Promise((resolve, reject) => { const tx = database.transaction(['records', 'files'], 'readwrite'); tx.objectStore('records').put({ id: retired[0] + '/order/WASH-OLD', collection: retired[0], version: 1, value: { kind: 'order', data: { id: 'WASH-OLD', fileId: oldPhoto } } }); tx.objectStore('records').put({ id: retired[1] + '/source/SHARED-REAL-RECEIPT', collection: retired[1], version: 1, value: sharedRow }); tx.objectStore('files').put({ id: oldPhoto, blob: new Blob(['old-only'], { type: 'image/jpeg' }) }); tx.objectStore('files').put({ id: sharedPhoto, blob: new Blob(['still-referenced'], { type: 'image/jpeg' }) }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }); database.close()
    })
    await page.goto(baseURL + '/fcs/craft/printing/qc-orders', { waitUntil: 'domcontentloaded' }); await load(page)
    const result = await page.evaluate(async () => {
      const { db, records } = window.__qcVerification, retired = ['fcs.fabric-washing.v1', 'fcs.fabric-washing.process-records.v1'], oldPhoto = 'wash-file-old-only', sharedPhoto = 'wash-file-shared'
      await records.removeLegacyWashingData()
      await records.removeLegacyWashingData()
      const data = await db.readPcsRecords([...retired, records.PROCESS_COLLECTION, records.HAND_FEEL_COLLECTION]), remaining = data.records.filter(row => !row.deleted)
      const preserved = remaining.find(row => row.collection === records.PROCESS_COLLECTION && row.value.key === 'SHARED-REAL-RECEIPT')
      return { oldActive: remaining.filter(row => retired.includes(row.collection)).length, preserved: preserved?.value, handfeelCount: remaining.filter(row => row.collection === records.HAND_FEEL_COLLECTION).length, oldFileCount: (await db.readPcsFiles([oldPhoto])).length, sharedFileCount: (await db.readPcsFiles([sharedPhoto])).length }
    })
    assert.equal(result.oldActive, 0); assert.equal(result.handfeelCount, 0, '旧单不得转换成新手感单')
    assert.ok(result.preserved, JSON.stringify(result)); assert.deepEqual(result.preserved.value.lines.map(line => line.id), ['KEEP-PRINT']); assert.equal(result.preserved.value.lines[0].qty, 12.345)
    assert.equal(result.oldFileCount, 0); assert.equal(result.sharedFileCount, 1)
    return result
  })

  await run('actual_source_complete_creates_and_appends_qc', async context => {
    const page = await newPage(context)
    const result = await page.evaluate(async () => {
      const { qc, records, db, printing, dyeing, commands } = window.__qcVerification
      const views = printing.listPrintingWorkOrders()
      const initial = views.find(view => /PWO-PRINT-DEMO-\d+-3$/.test(view.workOrderId) && view.output.completedQty === 0 && view.actualInput.usedQty > 2 && printing.getPrintingWorkflowFacts(view.workOrderId).startedAt && !(view.productionBatches || []).length)
      if (!initial) throw new Error('缺少可真实完成首批的phase3静态来源：' + JSON.stringify(views.filter(view => /-3$/.test(view.workOrderId)).map(view => ({ id: view.workOrderId, used: view.actualInput.usedQty, completed: view.output.completedQty, batches: view.productionBatches?.length }))))
      const id = initial.workOrderId
      if (qc.listFactoryQcOrders().some(order => order.source.kind === 'PRINTING' && order.source.id === id)) throw new Error('触发前该phase3来源已存在QC，不能冒充首次创建')
      const mutate = action => commands.runDesignRevisionFcsCommand(id, action)
      const facts = printing.getPrintingWorkflowFacts(id), used = initial.actualInput.usedQty, finalQty = used - 2
      if (!facts.printFinishedAt) await mutate(() => printing.recordPrintingProductionStage(id, { id: 'ACTUAL-TRIGGER-PRINT-FINISH', stage: 'PRINT', action: 'FINISH', qty: used, operatorName: '原型触发测试员' }))
      if (facts.requiresTransfer) {
        if (!facts.transferStartedAt) await mutate(() => printing.recordPrintingProductionStage(id, { id: 'ACTUAL-TRIGGER-TRANSFER-START', stage: 'TRANSFER', action: 'START', operatorName: '原型触发测试员' }))
        await mutate(() => printing.recordPrintingProductionStage(id, { id: 'ACTUAL-TRIGGER-TRANSFER-FINISH', stage: 'TRANSFER', action: 'FINISH', qty: finalQty, operatorName: '原型触发测试员' }))
      }
      if (records.readFactoryQcState().qcOrders.some(order => order.source.kind === 'PRINTING' && order.source.id === id)) throw new Error('PRINT/TRANSFER中间完成提前创建QC')
      const firstQty = Math.floor(finalQty / 2 * 100) / 100, firstInput = { usedQty: used, usedRollCount: initial.actualInput.usedRollCount, completedQty: firstQty, completedRollCount: 1, printerNo: initial.printerNo || '实际原型机', operatorName: '原型触发测试员', batchId: 'ACTUAL-FINAL-BATCH-1', lossQty: 0, finishOrder: false }
      const beforeAbort = await db.readPcsRecords([records.QC_COLLECTION, records.PROCESS_COLLECTION]), nativeBefore = ['higoods.formal-print-execution.v1', 'higood-factory-material-receiving-v1'].map(key => [key, localStorage.getItem(key)])
      const originalTransaction = IDBDatabase.prototype.transaction; let sourceAbortInjected = false, sourceAbortMessage = ''
      IDBDatabase.prototype.transaction = function (...args) { const tx = originalTransaction.apply(this, args); if (!sourceAbortInjected && args[1] === 'readwrite') { sourceAbortInjected = true; queueMicrotask(() => tx.abort()) } return tx }
      try { await mutate(() => printing.completePrintingWorkOrder(id, firstInput)) } catch (error) { sourceAbortMessage = error.message } finally { IDBDatabase.prototype.transaction = originalTransaction }
      if (!sourceAbortInjected || !sourceAbortMessage) throw new Error('首批最终完成的事务中止没有拒绝提交')
      const afterAbort = await db.readPcsRecords([records.QC_COLLECTION, records.PROCESS_COLLECTION])
      if (JSON.stringify(beforeAbort.records) !== JSON.stringify(afterAbort.records) || JSON.stringify(nativeBefore) !== JSON.stringify(nativeBefore.map(([key]) => [key, localStorage.getItem(key)])) || records.readFactoryQcState().qcOrders.some(order => order.source.kind === 'PRINTING' && order.source.id === id) || (printing.getPrintingWorkOrderById(id).productionBatches || []).length) throw new Error('首批最终完成中止后留下来源批次或QC半套事实')
      await mutate(() => printing.completePrintingWorkOrder(id, firstInput))
      const first = structuredClone(records.readFactoryQcState().qcOrders.find(order => order.source.kind === 'PRINTING' && order.source.id === id))
      if (!first || first.rolls.length !== 1) throw new Error('首次最终批次没有持久创建一张一卷QC')
      const rolled = printing.getPrintingWorkOrderById(id)
      await mutate(() => printing.updatePrintingRollBarcode(id, first.rolls[0].id, { lengthY: firstQty, gsm: rolled.output.gsm, widthCm: rolled.output.widthCm, vatNo: 'ACTUAL-BATCH-1', warehouseName: '实际原型待交出仓', remark: '原型真实录入首卷实测数量' }))
      const measured = structuredClone(records.readFactoryQcState().qcOrders.find(order => order.id === first.id))
      if (measured.rolls[0].qty !== firstQty || !measured.rolls[0].confirmed) throw new Error('补实测数量后未完成QC卷仍是旧0值')
      await mutate(() => printing.completePrintingWorkOrder(id, { ...firstInput, completedQty: finalQty, completedRollCount: 2, batchId: 'ACTUAL-FINAL-BATCH-2' }))
      const appended = records.readFactoryQcState().qcOrders.filter(order => order.source.kind === 'PRINTING' && order.source.id === id)
      if (appended.length !== 1 || appended[0].id !== first.id || appended[0].rolls.length !== 2) throw new Error('第二批没有补进同一QC')
      const persisted = await db.readPcsRecords([records.QC_COLLECTION, records.PROCESS_COLLECTION])
      const savedQc = persisted.records.find(row => row.value.kind === 'qc' && row.value.data.id === first.id)
      const savedSource = persisted.records.find(row => row.collection === records.PROCESS_COLLECTION && row.value.key === id && row.value.path === 'state.workOrders')
      if (!savedQc || !savedSource || savedSource.value.value.businessView.productionBatches.length !== 2) throw new Error('来源两批和QC未共同保存')
      const dyeSources = qc.listFactoryQcSources().filter(source => source.kind === 'DYEING' && !source.hasFinalOutput && source.target.isDyeingFactory === false)
      const dyeSource = dyeSources.find(source => { const order = dyeing.getDyeWorkOrderById(source.id), prior = dyeing.getDyeExecutionNodeRecord(source.id, 'ROLL'); return order.status === 'PACKING' && prior?.finishedAt && prior.outputQty > 0 })
      if (!dyeSource) throw new Error('缺少可真实PACK完成的非染厂下游来源：' + JSON.stringify(dyeSources.map(source => ({ id: source.id, status: dyeing.getDyeWorkOrderById(source.id).status, target: source.target }))))
      const dyeId = dyeSource.id, pack = dyeing.getDyeExecutionNodeRecord(dyeId, 'PACK'), priorOutput = dyeing.getDyeExecutionNodeRecord(dyeId, 'ROLL').outputQty
      if (qc.listFactoryQcOrders().some(order => order.source.kind === 'DYEING' && order.source.id === dyeId)) throw new Error('PACK前已有染厂QC，不能冒充首次创建')
      if (!pack?.startedAt) await commands.runDesignRevisionFcsCommand(dyeId, () => dyeing.startDyeNode(dyeId, 'PACK', '原型包装测试员'))
      await commands.runDesignRevisionFcsCommand(dyeId, () => dyeing.completeDyeNode(dyeId, 'PACK', { outputQty: priorOutput, operatorName: '原型包装测试员' }))
      const dyeQc = records.readFactoryQcState().qcOrders.find(order => order.source.kind === 'DYEING' && order.source.id === dyeId)
      if (!dyeQc) throw new Error('真实PACK结束未创建染厂QC')
      return { printSourceId: id, sourceAbortMessage, firstQcId: first.id, firstRolls: first.rolls.length, appendedRolls: appended[0].rolls.length, firstMeasuredQty: measured.rolls[0].qty, manuallyCompleted: !!printing.getPrintingWorkOrderById(id).manuallyCompletedAt, dyeSourceId: dyeId, dyeQcId: dyeQc.id, packOutputQty: priorOutput }
    })
    assert.equal(result.firstRolls, 1); assert.equal(result.appendedRolls, 2); assert.equal(result.manuallyCompleted, false)
    await writeFile(resolve(output, 'actual-source-warm-observations.json'), JSON.stringify(result, null, 2))
    await page.reload({ waitUntil: 'domcontentloaded' }); await load(page)
    const cold = await page.evaluate(({ printId, dyeId }) => { const { records } = window.__qcVerification, state = records.readFactoryQcState(); return { print: state.qcOrders.filter(order => order.id === printId).map(order => ({ id: order.id, rolls: order.rolls.length })), dye: state.qcOrders.filter(order => order.id === dyeId).map(order => order.id) } }, { printId: result.firstQcId, dyeId: result.dyeQcId })
    assert.deepEqual(cold.print, [{ id: result.firstQcId, rolls: 2 }]); assert.deepEqual(cold.dye, [result.dyeQcId])
    return { ...result, cold }
  })

  await run('explicit_produced_fixture_to_factory_receipt', async context => {
    const page = await newPage(context)
    const result = await page.evaluate(async () => {
      const { qc, records, receiving, factories } = window.__qcVerification
      const factory = factories.getFactoryMasterRecordById('F090'), position = receiving.getDefaultFactoryReceiptPosition('F090'), gtgPosition = receiving.getDefaultFactoryReceiptPosition('ID-F003')
      if (!factory || !position.warehouseId || !position.locationId) throw new Error('F090缺少真实工厂或已启用默认仓/库位')
      const material = qc.listFactoryQcSources().find(source => source.imageUrl && source.materialProperties?.composition)
      if (!material) throw new Error('缺少可复用真实物料资料的原型来源')
      const at = '2026-10-22T00:00:00.000Z', source = { kind: 'DYEING', id: 'VERIFICATION-FACTORY-DYE-SOURCE', no: '隔离夹具：已产出手感来源', factoryId: 'ID-F003', factoryName: 'GTG', materialSku: material.materialSku, materialName: material.materialName, imageUrl: material.imageUrl, referenceImageUrl: material.imageUrl, requiredMaterialSku: material.materialSku, requirementVersion: 'VERIFY-METER-V1', materialProperties: structuredClone(material.materialProperties), unit: '米', hasFinalOutput: true, target: { id: factory.id, name: factory.name, kind: 'FACTORY', factoryId: factory.id, isDyeingFactory: false }, handedOutRollIds: [], rolls: [{ id: 'VERIFY-FACTORY-R1', barcode: 'VERIFY-FACTORY-IN-1', batchId: 'VERIFY-PRODUCED', qty: 12.125, unit: '米', confirmed: true }, { id: 'VERIFY-FACTORY-R2', barcode: 'VERIFY-FACTORY-IN-2', batchId: 'VERIFY-PRODUCED', qty: 7.875, unit: '米', confirmed: true }] }
      // Explicit fixture construction only: this is not evidence of source automatic creation.
      let state = qc.emptyFactoryQcState(), n = 0
      const head = qc.upsertFactoryQc(state, source, at)
      state = qc.applyFactoryQcCommand(state, { type: 'DECIDE', qcId: head.id, expectedVersion: head.version, needs: true, target: '柔软手感' }, '隔离验证夹具构造器', 'VERIFY-FIXTURE-DECIDE', at, source)
      const orderId = state.handfeelOrders[0].id
      const fixtureStep = (type, rolls) => { const order = state.handfeelOrders[0]; state = qc.applyFactoryQcCommand(state, { type, orderId, expectedVersion: order.version, rolls }, '隔离验证夹具构造器', 'VERIFY-FIXTURE-' + ++n, at) }
      fixtureStep('SEND', source.rolls.map(roll => ({ id: roll.id, barcode: roll.barcode })))
      fixtureStep('RECEIVE', source.rolls.map(roll => ({ id: roll.id, barcode: roll.barcode, qty: roll.qty, ...gtgPosition })))
      fixtureStep('START', source.rolls.map(roll => ({ id: roll.id })))
      fixtureStep('OUTPUT', source.rolls.map((roll, index) => ({ id: roll.id, qty: roll.qty, barcode: 'VERIFY-FACTORY-OUT-' + (index + 1) })))
      await records.runFactoryQcRecordCommand(() => records.stageFactoryQcState(state), 'VERIFY-PRODUCED-FIXTURE-SAVE', '明确隔离已产出夹具，仅验证手感到工厂后半段')
      let order = qc.getStenterHandfeelOrder(orderId)
      await qc.submitStenterHandfeelCommand({ type: 'HANDOUT', orderId, expectedVersion: order.version, rolls: order.rolls.map(roll => ({ id: roll.id, barcode: roll.outputBarcode })) }, 'VERIFY-FACTORY-ACTUAL-HANDOUT')
      order = qc.getStenterHandfeelOrder(orderId)
      await qc.submitStenterHandfeelCommand({ type: 'DOWNSTREAM_RECEIVE', orderId, expectedVersion: order.version, rolls: order.rolls.map(roll => ({ id: roll.id, qty: roll.outputQty, ...position })) }, 'VERIFY-FACTORY-ACTUAL-RECEIVE')
      const actual = receiving.listFactoryReceipts('F090').flatMap(receipt => receipt.lines.filter(line => line.stenterHandfeelOrderId === orderId)), warehouse = await import('/src/data/fcs/factory-internal-warehouse.ts')
      const stock = warehouse.listFactoryWaitProcessStockItems().filter(row => row.stenterHandfeelOrderId === orderId && row.factoryId === 'F090')
      return { fixtureOnly: '仅手感→工厂后半段；上游由pure model合法步骤构造，不归来源自动建单链', orderId, target: { id: factory.id, name: factory.name, ...position }, receiptLines: actual.map(line => ({ qty: line.qty, unit: line.unit, businessQty: line.businessQty, businessUnit: line.businessUnit, warehouseId: line.warehouseId, locationId: line.locationId, rolls: line.rolls.map(roll => ({ barcode: roll.barcode, originRollId: roll.originRollId, qty: roll.qty, unit: roll.unit, warehouseId: roll.warehouseId, locationId: roll.locationId })) })), stock: stock.map(row => ({ qty: row.availableQty ?? row.receivedQty, unit: row.unit, barcode: row.fabricRollNo })), qcCompleted: records.readFactoryQcState().qcOrders.filter(row => row.source.id === orderId).flatMap(row => row.rolls).some(roll => !!roll.completedAt) }
    })
    assert.equal(result.target.id, 'F090'); assert.equal(result.qcCompleted, false, '实际交出不依赖QC完成')
    assert.equal(result.receiptLines.length, 1, '同一移交行两卷应合并为一个真实接收明细')
    assert.equal(result.receiptLines[0].qty, 20); assert.equal(result.receiptLines[0].unit, '米'); assert.equal(result.receiptLines[0].businessQty, 20); assert.equal(result.receiptLines[0].businessUnit, '米')
    assert.deepEqual(result.receiptLines[0].rolls.map(roll => [roll.barcode, roll.originRollId, roll.qty, roll.unit]), [['VERIFY-FACTORY-OUT-1', 'VERIFY-FACTORY-R1', 12.125, '米'], ['VERIFY-FACTORY-OUT-2', 'VERIFY-FACTORY-R2', 7.875, '米']])
    assert.equal(result.stock.length, 2); assert.equal(result.stock.reduce((sum, row) => sum + row.qty, 0), 20); assert.equal(result.stock.every(row => row.unit === '米'), true)
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-factory-qc-root]').waitFor(); await load(page)
    const cold = await page.evaluate(orderId => { const { qc, receiving } = window.__qcVerification; return { rolls: qc.getStenterHandfeelOrder(orderId).rolls.map(roll => ({ id: roll.id, qty: roll.downstreamQty, received: !!roll.downstreamReceivedAt })), receiptQty: receiving.listFactoryReceipts('F090').flatMap(receipt => receipt.lines).filter(line => line.stenterHandfeelOrderId === orderId).reduce((sum, line) => sum + line.qty, 0) } }, result.orderId)
    assert.equal(cold.receiptQty, 20); assert.equal(cold.rolls.every(roll => roll.received), true)
    return { ...result, cold }
  })

  await run('retirement_technical_conflict_preserves_then_exact_retry', async context => {
    const page = await context.newPage()
    await page.route('**/__qc-technical-retirement-fixture__', route => route.fulfill({ contentType: 'text/html', body: '<title>隔离旧版技术资料退役夹具</title>' }))
    await page.goto(baseURL + '/__qc-technical-retirement-fixture__')
    const seeded = await page.evaluate(async () => {
      const technical = 'higood-pcs-technical-data-version-store-v5', process = 'fcs.factory-qc.process-records.v1', retired = 'fcs.fabric-washing.process-records.v1', legacyKey = 'higood-factory-material-receiving-v1'
      const sharedPhoto = 'wash-file-technical-shared', oldPhoto = 'wash-file-technical-old-only'
      const content = { technicalVersionId: 'TDV-VERIFY-DB', patternFiles: [], patternDesc: '保留原技术说明', processRouteSchemaVersion: 2, processRouteMigrationMarker: 'VERIFY-EXPLICIT-EDGES', processEntries: [
        { id: 'A', stageCode: 'PREP', processCode: 'DYE', routeStepNo: 1, predecessorEntryIds: [] },
        { id: 'B', stageCode: 'PREP', processCode: 'PRINT', routeStepNo: 3, predecessorEntryIds: ['A'] },
        { id: 'W', stageCode: 'PREP', processCode: 'WASH', routeStepNo: 2, predecessorEntryIds: ['A'] },
        { id: 'C', stageCode: 'PROD', processCode: 'CUT', routeStepNo: 4, predecessorEntryIds: ['B'] },
        { id: 'D', stageCode: 'PROD', processCode: 'SEW', routeStepNo: 5, predecessorEntryIds: ['W', 'B'] },
      ], sizeTable: [], bomItems: [{ id: 'BOM-FABRIC', materialSkuId: 'VERIFY-SHARED-FABRIC', usageProcessCodes: ['DYE', 'WASH', 'PRINT', 'craft-wash'], quantity: 12.345 }], qualityRules: [], colorMaterialMappings: [], patternDesigns: [], attachments: [{ id: 'ATTACH-SHARED', fileId: sharedPhoto }], legacyCompatibleCostPayload: { processCostItems: [{ processId: 'W', amount: 19 }, { processId: 'WASH', amount: 2 }, { processId: 'PRINT', amount: 3 }, { processId: 'A', amount: 4 }], otherCost: 6 } }
      const nativeContent = { ...structuredClone(content), technicalVersionId: 'TDV-VERIFY-NATIVE' }, nativeHead = { technicalVersionId: nativeContent.technicalVersionId, processEntryCount: 5, publishedAt: '2026-09-01T00:00:00Z', note: '保留已发布和审核事实' }
      const nativeRaw = JSON.stringify({ version: 5, records: [nativeHead], contents: [nativeContent], pendingItems: [] })
      localStorage.setItem(technical, nativeRaw)
      const sharedRow = { path: 'receipts', key: 'TECH-SHARED-RECEIPT', tuple: false, legacyKey, value: { id: 'TECH-SHARED-RECEIPT', receivedAt: '2026-10-21T00:00:00Z', lines: [{ id: 'KEEP-PRINT', printingOrderId: 'REAL-PRINT', qty: 12.345, unit: '米', fileId: sharedPhoto }, { id: 'REMOVE-WASH', washingOrderId: 'WASH-OLD', qty: 100, fileId: oldPhoto }] } }
      const cleanedRow = structuredClone(sharedRow); cleanedRow.value.lines = [cleanedRow.value.lines[0]]
      const conflictRow = structuredClone(cleanedRow); conflictRow.value.lines[0].qty = 99
      const targetId = process + '/' + encodeURIComponent(legacyKey) + '/' + encodeURIComponent(sharedRow.path + '/' + sharedRow.key)
      const database = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records', 2); request.onupgradeneeded = () => { for (const name of ['records', 'files', 'operations', 'meta']) request.result.createObjectStore(name, { keyPath: 'id' }); request.transaction.objectStore('operations').createIndex('createdAt', 'createdAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      await new Promise((resolve, reject) => {
        const tx = database.transaction(['records', 'files'], 'readwrite'), store = tx.objectStore('records')
        for (const row of [
          { id: retired + '/source/TECH-SHARED-RECEIPT', collection: retired, value: sharedRow },
          { id: targetId, collection: process, value: conflictRow },
          { id: technical + '/contents/TDV-VERIFY-DB', collection: technical + '/contents', value: { kind: 'content', data: content } },
          { id: technical + '/records/TDV-VERIFY-DB', collection: technical + '/records', value: { kind: 'record', data: { technicalVersionId: content.technicalVersionId, processEntryCount: 5, publishedAt: nativeHead.publishedAt, note: nativeHead.note } } },
          { id: process + '/unrelated/REAL-DYE', collection: process, value: { path: 'state.workOrders', key: 'REAL-DYE', tuple: true, legacyKey: 'higoods.formal-dye-execution.v1', value: { id: 'REAL-DYE', actualOutputQty: 8.875, handedOutQty: 7, fileId: sharedPhoto } } },
        ]) store.put({ ...row, version: 1 })
        tx.objectStore('files').put({ id: oldPhoto, blob: new Blob(['old-only-retired-bytes'], { type: 'image/jpeg' }) })
        tx.objectStore('files').put({ id: sharedPhoto, blob: new Blob(['shared-original-bytes'], { type: 'image/jpeg' }) })
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
      }); database.close()
      window.__retirementFixture = { technical, process, retired, targetId, cleanedRow, oldPhoto, sharedPhoto, nativeRaw }
      return { technical, targetId, fixture: '显式隔离历史v2资料；无main启动、无业务种子或生产事实' }
    })
    const result = await page.evaluate(async () => {
      const records = await import('/src/data/fcs/factory-qc-records.ts'), repoCode = await (await fetch('/src/data/fcs/factory-qc-records.ts')).text()
      const dbUrl = repoCode.match(/["']([^"']*pcs-record-db\.ts(?:\?[^"']*)?)["']/)?.[1]
      if (!dbUrl) throw new Error('无法定位同一repo使用的真实DB模块')
      const db = await import(dbUrl), f = window.__retirementFixture, scope = ['fcs.fabric-washing.v1', f.retired, f.process, f.technical]
      const hashBytes = async blob => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      const snapshot = async () => { const data = await db.readPcsRecords(scope); return { records: data.records, files: await Promise.all(data.files.map(async file => ({ id: file.id, hash: await hashBytes(file.blob) }))), nativeRaw: localStorage.getItem(f.technical) } }
      const before = await snapshot()
      let conflict = ''; try { await records.removeLegacyWashingData() } catch (error) { conflict = error.message }
      const blocked = await snapshot()
      if (!/原始来源.*冲突.*尚未删除旧资料/.test(conflict)) throw new Error('不同实际数量来源没有明确拒绝清理：' + conflict)
      if (JSON.stringify(before) !== JSON.stringify(blocked)) throw new Error('冲突拒绝后旧来源、共用照片、技术内容或非洗水实际事实发生改动')
      const target = blocked.records.find(row => row.id === f.targetId)
      // Explicit fixture reconciliation: retain the original source quantity;
      // this is test preparation for a retry, not an automatic conflict choice.
      await db.commitPcsRecords({ puts: [{ id: target.id, collection: target.collection, value: f.cleanedRow, expectedVersion: target.version }], deletes: [], operationId: 'VERIFY-RETIREMENT-RECONCILIATION', intent: '隔离夹具显式解决来源差异，保留原实收12.345米' })
      await records.removeLegacyWashingData()
      const cleaned = await snapshot(), active = cleaned.records.filter(row => !row.deleted)
      const content = active.find(row => row.collection === f.technical + '/contents').value.data, head = active.find(row => row.collection === f.technical + '/records').value.data
      const raw = JSON.parse(cleaned.nativeRaw), nativeContent = raw.contents[0], nativeHead = raw.records[0]
      const preserved = active.find(row => row.id === f.targetId).value, unrelated = active.find(row => row.value?.key === 'REAL-DYE').value
      const shared = cleaned.files.find(file => file.id === f.sharedPhoto), originalShared = before.files.find(file => file.id === f.sharedPhoto)
      const firstNative = cleaned.nativeRaw
      // A later explicit action must inspect a newly discovered legacy native
      // source even though business retirement preparation is already cached.
      localStorage.setItem(f.technical, f.nativeRaw)
      await records.removeLegacyWashingData()
      const secondNative = localStorage.getItem(f.technical)
      return { conflict, conflictUnchanged: JSON.stringify(before) === JSON.stringify(blocked), oldActive: active.filter(row => row.collection.startsWith('fcs.fabric-washing.')).length, content, head, nativeContent, nativeHead, preserved, unrelated, oldFileCount: cleaned.files.filter(file => file.id === f.oldPhoto).length, sharedFileHashBefore: originalShared?.hash, sharedFileHashAfter: shared?.hash, repeatedExplicitRemovedNewlyDiscoveredNative: firstNative === secondNative }
    })
    assert.match(result.conflict, /原始来源.*冲突.*尚未删除旧资料/); assert.equal(result.conflictUnchanged, true); assert.equal(result.oldActive, 0)
    const expectedEdges = { A: [], B: ['A'], C: ['B'], D: ['A', 'B'] }
    for (const content of [result.content, result.nativeContent]) {
      assert.deepEqual(Object.fromEntries(content.processEntries.map(entry => [entry.id, entry.predecessorEntryIds])), expectedEdges, '保留显式边，并仅桥接旧节点的真实前置，不按步骤重新推断路线')
      assert.deepEqual(content.bomItems[0].usageProcessCodes, ['DYE', 'PRINT']); assert.equal(content.bomItems[0].quantity, 12.345)
      assert.deepEqual(content.legacyCompatibleCostPayload.processCostItems, [{ processId: 'PRINT', amount: 3 }, { processId: 'A', amount: 4 }]); assert.equal(content.legacyCompatibleCostPayload.otherCost, 6)
      assert.equal(content.processRouteMigrationMarker, 'VERIFY-EXPLICIT-EDGES'); assert.equal(content.patternDesc, '保留原技术说明'); assert.equal(content.attachments[0].fileId, 'wash-file-technical-shared')
    }
    for (const head of [result.head, result.nativeHead]) { assert.equal(head.processEntryCount, 4); assert.equal(head.publishedAt, '2026-09-01T00:00:00Z'); assert.equal(head.note, '保留已发布和审核事实') }
    assert.deepEqual(result.preserved.value.lines.map(line => [line.id, line.qty, line.unit]), [['KEEP-PRINT', 12.345, '米']])
    assert.equal(result.unrelated.value.actualOutputQty, 8.875); assert.equal(result.unrelated.value.handedOutQty, 7)
    assert.equal(result.oldFileCount, 0); assert.equal(result.sharedFileHashAfter, result.sharedFileHashBefore); assert.equal(result.repeatedExplicitRemovedNewlyDiscoveredNative, true)
    return { ...seeded, ...result }
  })
} finally {
  await browser.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.cases.filter(item => item.status === 'passed').length
  report.failed = report.cases.filter(item => item.status !== 'passed').length
  report.sourceHashesAfter = await hashes()
  report.versionStable = JSON.stringify(report.sourceHashesBefore) === JSON.stringify(report.sourceHashesAfter)
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ output, passed: report.passed, failed: report.failed, versionStable: report.versionStable }))
  process.exitCode = report.failed || !report.versionStable ? 1 : 0
}
