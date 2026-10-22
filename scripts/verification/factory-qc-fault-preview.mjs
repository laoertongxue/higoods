#!/usr/bin/env node
/** Fixed-asset UI faults; native API fault injection is explicit and isolated.
 * The GC phase calls an existing production-bundle export as an API diagnostic,
 * separately from UI timing. No source-module imports or target QC seeding. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { cpus, platform, release } from 'node:os'
import ts from 'typescript'
import { chromium } from 'playwright'

const arg = key => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1] }
const calibration = process.argv.includes('--calibration'), trials = Number(arg('--trials') || (calibration ? 1 : 5))
const baseURL = arg('--base-url') || 'http://127.0.0.1:43222', viewport = { width: 1366, height: 768 }, maxMs = 1000
const runId = new Date().toISOString().replace(/[:.]/g, '-'), output = resolve(arg('--output') || `output/playwright/factory-qc-fault-preview/${runId}`)
const DB = 'higood-pcs-records', QC = 'fcs.factory-qc.v1', PROCESS = 'fcs.factory-qc.process-records.v1', LIST = '/fcs/craft/printing/qc-orders'
const selector = action => `[data-factory-qc-action="${action}"]`, field = name => `[data-factory-qc-field="${name}"]`
const families = [
  { id: 'indexeddb-open-failure-retry', ac: 'AC-035/036/038', boundary: '真实已存 QC/Blob 后，下一次业务 indexedDB.open 同步抛 SecurityError 一次；实际保存须失败、输入和原资料保留，再通过真实重新读取及同意图保存恢复' },
  { id: 'quota-file-add-same-operation-retry', ac: 'AC-035/036/038', boundary: '仅真实 QC 保存的新 FQC-PHOTO 文件 add 抛 QuotaExceededError 一次；模拟 API 异常，并非物理磁盘容量测量；原记录/Blob/操作无半套，原输入相同 operation 重试成功' },
  { id: 'commit-complete-read-failure-recovery', ac: 'AC-035/036/038', boundary: '仅真实 QC 卷与新 Blob 共事务 complete 后的第一个 readonly transaction 抛 UnknownError 一次；要求提示已保存但回读失败，保留输入，经实际重新读取恢复已提交资料' },
  { id: 'local-storage-preferences-and-native-source-read', ac: 'AC-035/036/038', boundary: '偏好 get/set 的 SecurityError 必须回默认且已迁移 QC 能保存；另仅真实 PROCESS 来源的精确旧 native ledger 副本 get 抛 SecurityError，不能静默当空或覆盖，恢复后同输入重试' },
  { id: 'upgrade-blocked-old-connection-retry', ac: 'AC-038', boundary: '隔离旧 v2 连接保留无业务目标的技术记录/Blob，不响应 versionchange；真实 v4 页面打开须提示 blocked；关闭旧页后由真实重读恢复，原技术记录/字节不变，再实际 UI 保存 QC' },
  { id: 'photo-reference-removal-public-safe-gc', ac: 'AC-033/036/ATM-063/STORE-03', boundary: '真实 UI 在未完成卷移除一张照片并保存引用；然后调用精确识别的现有生产 bundle cleanupUnreferencedPcsFiles 公共导出，仅作 API 诊断。只回收无引用 FQC-PHOTO 字节，仍引用及完成卷照片不误删；无自动立即回收承诺' },
]
const phasePlans = {
  'indexeddb-open-failure-retry': ['open-failure', 'actual-reread-recovery', 'save-retry'],
  'quota-file-add-same-operation-retry': ['quota-rejection', 'same-operation-retry'],
  'commit-complete-read-failure-recovery': ['committed-but-read-failed', 'actual-reread-after-complete', 'same-operation-after-commit-retry'],
  'local-storage-preferences-and-native-source-read': ['optional-preference-set-failure', 'business-save-with-preference-disabled', 'native-business-source-unreadable', 'native-source-retry'],
  'upgrade-blocked-old-connection-retry': ['upgrade-blocked-native-event', 'close-old-tab-actual-retry'],
  'photo-reference-removal-public-safe-gc': ['ui-remove-photo-reference-save'],
}
const selected = arg('--family') ? families.filter(f => arg('--family').split(',').includes(f.id)) : families
assert.ok(selected.length, '没有匹配的故障家族')
const config = { baseURL, output, calibration, trials, maxMs, viewport, families: selected.map(f => ({ ...f, phases: phasePlans[f.id] })), scope: '固定生产资产的实际 UI 与原生 IndexedDB 隔离；只证明原型异常恢复，不代表真实工厂或物理容量验收', fixtureBoundary: 'QC/照片/检查结果只由产品实际 UI 创建；唯一预置为明确旧 v2 技术记录，或由本次真实 UI PROCESS 记录重建的同内容旧原档案副本，不注入目标 QC 完成/保存事实', timingBoundary: '真实 UI 点击或导航起点→实际提示/页面与同一持久快照及 Blob SHA256 核对→必要图/字体/两帧；故障等待与恢复动作分别计时。公开安全 GC API 耗时单列，不冒充产品 UI 性能', plan: '每家族先 calibration 1，再 formal 每个命名phase至少5；失败和慢样本全部保留；不以注入成功代替业务断言', noRunByDefault: true }
if (!process.argv.includes('--run')) { console.log(JSON.stringify({ prepared: true, executed: false, ...config }, null, 2)); process.exit(0) }
assert.ok(Number.isSafeInteger(trials) && trials > 0 && (calibration || trials >= 5), '正式至少5次；校准须显式 --calibration')
await mkdir(output, { recursive: true })
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function manifest() { const names = ['dist/index.html', ...(await readdir('dist/assets')).filter(n => /\.(?:js|css)$/.test(n)).map(n => 'dist/assets/' + n)]; return Object.fromEntries(await Promise.all(names.sort().map(async n => [n, digest(await readFile(n))]))) }
const assetManifest = await manifest(), assetVersion = digest(JSON.stringify(assetManifest))
const report = { runId, ...config, startedAt: new Date().toISOString(), HEAD: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), collectorVersion: digest(await readFile(new URL(import.meta.url))), assetManifest, assetVersion, environment: { os: platform(), release: release(), cpu: cpus()[0]?.model }, samples: [], cases: [], apiDiagnostics: [], failures: [], browserErrors: [], forbiddenRequests: [], status: 'running' }
await writeFile(join(output, 'collector-at-run.mjs'), await readFile(new URL(import.meta.url)))
async function persist() { await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2)) }
const browser = await chromium.launch({ headless: true }); report.browser = { engine: 'Chromium', version: browser.version(), headless: true }
const clickStarts = new WeakMap(), boundPages = new WeakSet(), currentPhases = new WeakMap()

async function newContext() {
  const context = await browser.newContext({ viewport })
  context.on('page', page => {
    page.on('pageerror', error => report.browserErrors.push({ url: page.url(), error: error.message }))
    page.on('request', request => { const u = new URL(request.url()); if (u.origin === new URL(baseURL).origin && (u.pathname.startsWith('/src/') || u.pathname.includes('@vite'))) report.forbiddenRequests.push(u.pathname) })
  })
  await context.addInitScript(() => {
    const nativeOpen = IDBFactory.prototype.open, nativeTx = IDBDatabase.prototype.transaction, nativePut = IDBObjectStore.prototype.put, nativeAdd = IDBObjectStore.prototype.add, nativeGet = IDBObjectStore.prototype.get, nativeStorageGet = Storage.prototype.getItem, nativeStorageSet = Storage.prototype.setItem, nativeUuid = Crypto.prototype.randomUUID
    const txs = new WeakMap()
    let saved
    if (window.name.startsWith('QC-FAULT-CONFIG:')) { saved = JSON.parse(window.name.slice('QC-FAULT-CONFIG:'.length)); window.name = '' }
    const f = window.__qcFault = { mode: saved?.mode || '', armed: !!saved?.mode, key: saved?.key || '', events: [], transactions: [], operationReads: [], uuidCalls: [], nativeWrites: [], committed: false, prefGets: 0, prefSets: 0, nativeReads: 0 }
    const log = (type, extra = {}) => f.events.push({ type, at: performance.now(), ...extra })
    window.__qcFaultArm = (mode, key = '') => { f.mode = mode; f.armed = true; f.key = key; f.committed = false; f.operationReads = []; f.uuidCalls = []; f.nativeWrites = []; log('armed', { mode, key }) }
    window.__qcFaultOff = () => { f.armed = false; f.mode = ''; log('disabled') }
    window.__qcFaultNativeStorageGet = key => nativeStorageGet.call(localStorage, key)
    Crypto.prototype.randomUUID = function () { const id = nativeUuid.call(this); if (f.mode) f.uuidCalls.push({ id, at: performance.now() }); return id }
    IDBFactory.prototype.open = function (name, ...rest) {
      if (name === 'higood-pcs-records' && f.armed && f.mode === 'open') { f.armed = false; log('injected-open-SecurityError'); throw new DOMException('collector: exact open boundary', 'SecurityError') }
      return nativeOpen.call(this, name, ...rest)
    }
    IDBDatabase.prototype.transaction = function (...args) {
      if (this.name === 'higood-pcs-records' && args[1] === 'readonly' && f.armed && f.mode === 'post-commit-read' && f.committed) { f.armed = false; log('injected-post-complete-read-UnknownError'); throw new DOMException('collector: first read after actual complete', 'UnknownError') }
      const tx = nativeTx.apply(this, args)
      if (this.name === 'higood-pcs-records') {
        const row = { id: f.transactions.length + 1, at: performance.now(), mode: args[1] || 'readonly', stores: [...tx.objectStoreNames], puts: [], adds: [], operationReads: [], status: 'pending' }
        txs.set(tx, row); f.transactions.push(row)
        tx.addEventListener('complete', () => { row.status = 'complete'; row.end = performance.now(); if (f.armed && f.mode === 'post-commit-read' && row.puts.some(p => p.collection === 'fcs.factory-qc.v1' && p.kind === 'roll') && row.adds.some(p => p.store === 'files' && p.id.startsWith('FQC-PHOTO-'))) { f.committed = true; log('actual-QC-and-Blob-tx-complete', { txId: row.id }) } })
        tx.addEventListener('abort', () => { row.status = 'abort'; row.end = performance.now() })
      }
      return tx
    }
    IDBObjectStore.prototype.get = function (key) {
      const tx = txs.get(this.transaction)
      if (this.name === 'operations' && tx?.mode === 'readwrite') { const item = { key, txId: tx.id, at: performance.now() }; f.operationReads.push(item); tx.operationReads.push(key) }
      return nativeGet.call(this, key)
    }
    IDBObjectStore.prototype.put = function (value, ...args) {
      const tx = txs.get(this.transaction)
      if (tx) tx.puts.push({ store: this.name, id: value?.id, collection: value?.collection, kind: value?.value?.kind, rollId: value?.value?.data?.id })
      return nativePut.call(this, value, ...args)
    }
    IDBObjectStore.prototype.add = function (value, ...args) {
      const tx = txs.get(this.transaction)
      if (tx) tx.adds.push({ store: this.name, id: value?.id })
      if (this.name === 'files' && value?.id?.startsWith('FQC-PHOTO-') && f.armed && f.mode === 'quota') { f.armed = false; log('injected-file-add-QuotaExceededError', { id: value.id, txId: tx?.id }); throw new DOMException('collector: simulated exact file add quota boundary', 'QuotaExceededError') }
      return nativeAdd.call(this, value, ...args)
    }
    Storage.prototype.getItem = function (key) {
      if (this === localStorage && f.armed && f.mode === 'preferences' && key === '/fcs/craft/printing/qc-orders:columns') { f.prefGets++; log('injected-preference-get-SecurityError', { key }); throw new DOMException('collector: optional preference get', 'SecurityError') }
      if (this === localStorage && f.armed && f.mode === 'native-source' && key === f.key) { f.nativeReads++; log('injected-native-source-get-SecurityError', { key }); throw new DOMException('collector: unreadable actual old source', 'SecurityError') }
      return nativeStorageGet.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && f.armed) f.nativeWrites.push({ key, size: value.length, at: performance.now() })
      if (this === localStorage && f.armed && f.mode === 'preferences' && key === '/fcs/craft/printing/qc-orders:columns') { f.prefSets++; log('injected-preference-set-SecurityError', { key }); throw new DOMException('collector: optional preference set', 'SecurityError') }
      if (this === localStorage && f.armed && f.mode === 'native-source' && key === f.key) log('unexpected-native-source-write', { key, size: value.length })
      return nativeStorageSet.call(this, key, value)
    }
  })
  return context
}
async function navigate(page, path, ready) {
  const response = await page.goto(baseURL + path, { waitUntil: 'domcontentloaded' }); assert.ok(response?.ok())
  const html = await response.text(); assert.equal(digest(Buffer.from(html)), assetManifest['dist/index.html']); assert.doesNotMatch(html, /\/src\/main|@vite\/client/)
  if (ready) await page.locator(ready).first().waitFor({ timeout: 20000 })
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-pcs-records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    try {
      const values = await new Promise((resolve, reject) => { const tx = db.transaction(['records', 'files', 'operations', 'meta'], 'readonly'), requests = ['records', 'files', 'operations', 'meta'].map(name => tx.objectStore(name).getAll()); tx.oncomplete = () => resolve({ records: requests[0].result, files: requests[1].result, operations: requests[2].result, meta: requests[3].result }); tx.onabort = () => reject(tx.error) })
      const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
      const files = await Promise.all(values.files.map(async file => ({ id: file.id, size: file.blob.size, type: file.blob.type, sha256: await sha(await file.blob.arrayBuffer()) })))
      return { ...values, files: files.sort((a, b) => a.id.localeCompare(b.id)), dbVersion: db.version }
    } finally { db.close() }
  })
}
const active = data => data.records.filter(row => !row.deleted)
const roll = (data, id) => active(data).find(row => row.collection === QC && row.value.kind === 'roll' && row.value.data.id === id)?.value.data
function samePersistent(before, after) { assert.deepEqual(after.records, before.records, '失败不能改变任何原业务记录'); assert.deepEqual(after.files, before.files, '失败不能遗留/改写照片字节'); assert.deepEqual(after.operations, before.operations, '失败不能伪造完成操作收据'); assert.deepEqual(after.meta, before.meta) }
async function paint(page, root = '[data-factory-qc-root]') {
  return page.locator(root).first().evaluate(async node => { await Promise.all([...node.querySelectorAll('img')].filter(img => img.offsetParent !== null).map(async img => { await img.decode(); if (!img.naturalWidth) throw new Error('必要图加载失败：' + img.alt) })); await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.timeOrigin + performance.now() })
}
async function inputState(page) { return page.evaluate(() => ({ notes: document.querySelector('[data-factory-qc-field="notes"]')?.value, results: Object.fromEntries(['color', 'handfeel', 'material'].map(key => [key, document.querySelector(`[data-factory-qc-field="${key}"]`)?.value])), photoIds: [...document.querySelectorAll('[data-factory-qc-action="remove-photo"]')].map(n => n.dataset.photoId), unsaved: document.querySelector('[data-factory-qc-unsaved-state]')?.textContent })) }
async function errorVisible(page, expression = /未保存|无法读取|空间不足|已保存.*读取失败|SecurityError|阻止/) { await page.waitForFunction(source => [...document.querySelectorAll('[role="alert"], [data-factory-qc-roll-error], [data-factory-qc-error]')].some(node => new RegExp(source).test(node.textContent || '')), expression.source, { timeout: 10000 }) }
async function diagnostics(page) { return page.evaluate(() => ({ fault: window.__qcFault, error: [...document.querySelectorAll('[role="alert"]')].map(n => n.textContent).filter(Boolean), notice: document.querySelector('[data-factory-qc-notice]')?.textContent })) }
async function measure(page, family, iteration, phase, action, verify, root) {
  currentPhases.set(page, phase)
  if (!boundPages.has(page)) { await page.exposeBinding('__qcFaultReportClick', (_source, start) => { clickStarts.set(page, start) }); boundPages.add(page) }
  clickStarts.delete(page)
  await page.evaluate(() => { const start = () => { window.__qcFaultReportClick(performance.timeOrigin + performance.now()); document.removeEventListener('click', start, true) }; document.addEventListener('click', start, true) })
  await action(); const checks = await verify(), end = await paint(page, root), start = clickStarts.get(page)
  assert.ok(Number.isFinite(start), '需真实点击起点')
  const value = { family: family.id, ac: family.ac, iteration, phase, route: page.url(), start, end, durationMs: end - start, valid: true, result: end - start <= maxMs ? 'passed' : 'slow', checks, assetVersion, collectorVersion: report.collectorVersion, HEAD: report.HEAD, viewport }
  report.samples.push(value); console.log(JSON.stringify({ family: family.id, iteration, phase, durationMs: value.durationMs, result: value.result })); await persist(); return value
}
async function photo(page, label) {
  const reference = await page.locator('[data-factory-qc-editor] [data-image-url]').first().getAttribute('data-image-url')
  assert.ok(reference && !reference.startsWith('blob:'), '本次上传使用明确对应默认面料的静态正式图作为原型测试文件')
  const bytes = await readFile(resolve('public', new URL(reference, baseURL).pathname.slice(1))), extension = /\.jpe?g$/i.test(reference) ? 'jpg' : /\.webp$/i.test(reference) ? 'webp' : 'png'
  const mimeType = extension === 'jpg' ? 'image/jpeg' : 'image/' + extension
  await page.locator(field('photos')).setInputFiles({ name: `故障隔离验证-${label}.${extension}`, mimeType, buffer: bytes })
  return { reference, size: bytes.length, sha256: digest(bytes), purpose: '对应面料静态图复用为明确原型测试上传，不冒称工厂现场实拍' }
}
async function fill(page, notes) { for (const key of ['color', 'handfeel', 'material']) await page.locator(field(key)).selectOption(key === 'handfeel' ? '有差异' : '符合要求'); await page.locator(field('notes')).fill(notes) }
async function saved(page, id, notes, completed = false) {
  await page.waitForFunction(({ id, completed }) => { const editor = document.querySelector('[data-factory-qc-roll-editor]'); if (editor?.getAttribute('data-factory-qc-roll-editor') !== id) return false; return completed ? editor.textContent.includes('记录只读') : editor.querySelector('[data-factory-qc-unsaved-state]')?.textContent === '未完成质检' }, { id, completed })
  const data = await snapshot(page), actual = roll(data, id); assert.ok(actual); assert.equal(actual.notes, notes); assert.equal(!!actual.completedAt, completed); assert.ok(actual.photos.length); assert.ok(Object.values(actual.results).every(Boolean)); for (const p of actual.photos) assert.ok(data.files.some(file => file.id === p.id && file.size === p.size)); return data
}
async function prepare(page, count = 1) {
  await navigate(page, LIST, '[data-factory-qc-root="list"]')
  await page.locator('a[aria-label="查看全部卷的质检详情"]').first().click(); await page.locator('[data-factory-qc-root="detail"]').waitFor()
  const qcId = await page.locator('[data-factory-qc-root]').getAttribute('data-factory-qc-id'), detailPath = new URL(page.url()).pathname
  const rollIds = await page.locator(selector('select-roll')).evaluateAll(nodes => nodes.map(n => n.dataset.rollId)); assert.ok(rollIds.length >= 2, '默认实际来源至少2卷')
  await page.locator(selector('select-roll')).first().click(); const photos = []
  for (let i = 0; i < count; i++) photos.push(await photo(page, '基准-' + i))
  const notes = '故障隔离基准：已保存的原始检查事实'; await fill(page, notes); await page.locator(selector('save-roll')).click()
  const baseline = await saved(page, rollIds[0], notes); await paint(page)
  return { qcId, rollIds, detailPath, notes, photos, baseline, fixtureVersion: 'default-source-real-QC-UI-save-v1' }
}
async function arm(page, mode, key) { await page.evaluate(({ mode, key }) => window.__qcFaultArm(mode, key), { mode, key }) }
async function off(page) { await page.evaluate(() => window.__qcFaultOff()) }
async function sameOperation(page, failedIds, beforeOperations) {
  const d = await diagnostics(page), reads = d.fault.operationReads.map(row => row.key), data = await snapshot(page), added = data.operations.filter(row => !beforeOperations.some(before => before.id === row.id))
  assert.equal(added.length, 1, '同意图重试只提交一份操作收据'); assert.ok(failedIds.includes(added[0].id), '重试须复用失败前稳定 operation'); assert.ok(reads.filter(id => id === added[0].id).length >= 2); return { stableOperationId: added[0].id, operationReadAttempts: reads, singleReceipt: true }
}

async function openFailure(page, family, iteration) {
  const p = await prepare(page), notes = '打开失败保留的待保存说明'; await fill(page, notes); const input = await inputState(page)
  let failedIds
  await arm(page, 'open')
  await measure(page, family, iteration, 'open-failure', () => page.locator(selector('save-roll')).click(), async () => { await errorVisible(page); const d = await diagnostics(page); assert.ok(d.fault.events.some(e => e.type === 'injected-open-SecurityError')); failedIds = d.fault.uuidCalls.map(call => call.id); assert.ok(failedIds.length, '观察真实 UI 为未提交意图生成的 operation 候选，不伪造 ID'); samePersistent(p.baseline, await snapshot(page)); assert.deepEqual(await inputState(page), input); return { originalRecordsAndBlobHashes: p.baseline, inputRetained: true, failure: d } })
  await measure(page, family, iteration, 'actual-reread-recovery', () => page.locator(selector('refresh')).click(), async () => { await page.waitForFunction(() => document.querySelector('[data-factory-qc-notice]')?.textContent?.includes('已重新读取')); assert.deepEqual(await inputState(page), input); return { originalDataUnchanged: true, inputRetained: true, recoveryViaExistingButton: true } })
  await measure(page, family, iteration, 'save-retry', () => page.locator(selector('save-roll')).click(), async () => { const after = await saved(page, p.rollIds[0], notes), added = after.operations.filter(a => !p.baseline.operations.some(b => b.id === a.id)); assert.deepEqual(after.files, p.baseline.files); assert.equal(added.length, 1); assert.ok(failedIds.includes(added[0].id), '打开失败前 UI 生成的同 operation 在恢复后复用'); return { saved: true, noNewAttachment: true, stableOperationId: added[0].id, operationBoundary: '打开阶段尚未进入 commit；以原生 UUID 观察与实际新收据核对 UI 同意图 ID 复用' } })
}
async function quota(page, family, iteration) {
  const p = await prepare(page), notes = '配额异常后原输入相同操作重试'; await photo(page, '配额新图'); await fill(page, notes); const input = await inputState(page)
  await arm(page, 'quota'); let failedIds
  await measure(page, family, iteration, 'quota-rejection', () => page.locator(selector('save-roll')).click(), async () => { await errorVisible(page, /空间不足/); const d = await diagnostics(page); assert.ok(d.fault.events.some(e => e.type === 'injected-file-add-QuotaExceededError')); failedIds = d.fault.operationReads.map(e => e.key); assert.ok(failedIds.length); samePersistent(p.baseline, await snapshot(page)); assert.deepEqual(await inputState(page), input); return { simulatedAPIQuota: true, transactionAborted: d.fault.transactions.filter(t => t.status === 'abort'), inputRetained: true, originalBlobHashes: p.baseline.files, failure: d } })
  await measure(page, family, iteration, 'same-operation-retry', () => page.locator(selector('save-roll')).click(), async () => { const after = await saved(page, p.rollIds[0], notes); assert.equal(roll(after, p.rollIds[0]).photos.length, 2); assert.deepEqual(after.files.filter(f => p.baseline.files.some(b => b.id === f.id)), p.baseline.files); return { ...await sameOperation(page, failedIds, p.baseline.operations), inputPhotosSavedOnce: true, beforeFiles: p.baseline.files, afterFiles: after.files } })
}
async function postCommit(page, family, iteration) {
  const p = await prepare(page), notes = '事务已 complete 后读取失败的真实已存说明'; await photo(page, '已提交新图'); await fill(page, notes); const input = await inputState(page); let committed, operationId
  await arm(page, 'post-commit-read')
  await measure(page, family, iteration, 'committed-but-read-failed', () => page.locator(selector('save-roll')).click(), async () => { await errorVisible(page, /记录已保存.*重新读取失败/); const d = await diagnostics(page); assert.ok(d.fault.events.some(e => e.type === 'actual-QC-and-Blob-tx-complete')); assert.ok(d.fault.events.some(e => e.type === 'injected-post-complete-read-UnknownError')); committed = await snapshot(page); const r = roll(committed, p.rollIds[0]); assert.equal(r.notes, notes); assert.equal(r.photos.length, 2); assert.deepEqual(await inputState(page), input); const added = committed.operations.filter(a => !p.baseline.operations.some(b => b.id === a.id)); assert.equal(added.length, 1); operationId = added[0].id; return { persistedDespiteReadFailure: true, noFalseRollbackClaim: true, operationId, inputRetained: true, before: p.baseline, committed, failure: d } })
  await measure(page, family, iteration, 'actual-reread-after-complete', () => page.locator(selector('refresh')).click(), async () => { await page.waitForFunction(() => document.querySelector('[data-factory-qc-notice]')?.textContent?.includes('已重新读取')); const now = await snapshot(page); samePersistent(committed, now); assert.deepEqual(await inputState(page), input); return { actualRefreshRecovers: true, committedExactlyOnce: operationId, originalPhotoPreserved: true } })
  await measure(page, family, iteration, 'same-operation-after-commit-retry', () => page.locator(selector('save-roll')).click(), async () => { const after = await saved(page, p.rollIds[0], notes); samePersistent(committed, after); return { ...await sameOperation(page, [operationId], p.baseline.operations), alreadyCommittedRetryNoDuplicate: true } })
}
async function storage(page, family, iteration) {
  const p = await prepare(page), before = p.baseline
  await page.evaluate(() => { window.name = 'QC-FAULT-CONFIG:' + JSON.stringify({ mode: 'preferences' }) })
  await navigate(page, LIST, '[data-factory-qc-root="list"]'); await page.locator(selector('columns')).click()
  await measure(page, family, iteration, 'optional-preference-set-failure', () => page.locator('[data-factory-qc-action="column-visible"][data-column-key="created"]').click(), async () => { const d = await diagnostics(page); assert.ok(d.fault.prefGets > 0 && d.fault.prefSets > 0); assert.equal(await page.locator('[data-factory-qc-root="list"]').count(), 1); samePersistent(before, await snapshot(page)); return { boundedPreferencesGetAndSetThrow: true, usableDefaultList: true, businessUnchanged: true, fault: d } })
  await page.locator(selector('close-columns')).first().click(); await navigate(page, p.detailPath, '[data-factory-qc-root="detail"]'); await arm(page, 'preferences'); await page.locator(selector('select-roll')).first().click()
  const notes = '偏好不可用时已迁移的质检仍正常保存'; await fill(page, notes)
  await measure(page, family, iteration, 'business-save-with-preference-disabled', () => page.locator(selector('save-roll')).click(), async () => { const after = await saved(page, p.rollIds[0], notes), d = await diagnostics(page); assert.deepEqual(after.files, before.files); const sourceKeys = ['higoods.formal-dye-execution.v1', 'higoods.formal-print-execution.v1', 'higood.formal-merged-handout-actions.v1', 'higood-factory-material-receiving-v1', 'higoods.formal-water-execution.v1']; assert.ok(!d.fault.nativeWrites.some(w => sourceKeys.includes(w.key))); return { migratedBusinessSaveWorks: true, originalBlobHashes: after.files, nativeWrites: d.fault.nativeWrites, noLocalStorageBusinessFallback: true } })
  await off(page)
  const baseline = await snapshot(page), sourceRows = active(baseline).filter(row => row.collection === PROCESS && row.value.legacyKey === 'higoods.formal-print-execution.v1'); assert.ok(sourceRows.length, '须先真实 UI 保存产生可追溯 PROCESS 来源')
  const nativeFixture = await page.evaluate(rows => {
    const key = 'higoods.formal-print-execution.v1', original = window.__qcFaultNativeStorageGet(key), ledger = { version: 1, state: { workOrders: [], nodeRecords: [], reviewRecords: [] }, tasks: [], designRevisionHandovers: [] }
    for (const { value: row } of rows) { const target = row.path.startsWith('state.') ? ledger.state : ledger, path = row.path.startsWith('state.') ? row.path.slice(6) : row.path; (target[path] ??= []).push(row.tuple ? [row.key, row.value] : row.value) }
    const raw = JSON.stringify(ledger); localStorage.setItem(key, raw); return { key, raw, original, rowCount: rows.length }
  }, sourceRows)
  // Exercise the application's actual old parser on a cold route before the
  // injected failure. A collector-generated shape must not manufacture a bug.
  await navigate(page, p.detailPath, '[data-factory-qc-root="detail"]'); await page.locator(selector('select-roll')).first().click()
  samePersistent(baseline, await snapshot(page)); assert.equal(await page.evaluate(key => window.__qcFaultNativeStorageGet(key), nativeFixture.key), nativeFixture.raw)
  const protectedInputNotes = '旧原档案不可读时不能按空来源继续保存'; await fill(page, protectedInputNotes); const input = await inputState(page); await arm(page, 'native-source', nativeFixture.key); let failedIds
  await measure(page, family, iteration, 'native-business-source-unreadable', () => page.locator(selector('save-roll')).click(), async () => { await errorVisible(page, /\S/); const d = await diagnostics(page); failedIds = d.fault.uuidCalls.map(call => call.id); assert.ok(failedIds.length); assert.ok(d.fault.nativeReads > 0); assert.ok(!d.fault.events.some(e => e.type === 'unexpected-native-source-write')); samePersistent(baseline, await snapshot(page)); assert.equal(await page.evaluate(key => window.__qcFaultNativeStorageGet(key), nativeFixture.key), nativeFixture.raw); assert.deepEqual(await inputState(page), input); return { explicitOldArchiveCopyFromRealUI: { key: nativeFixture.key, sha256: digest(nativeFixture.raw), rows: nativeFixture.rowCount, actualColdOldParserSucceededBeforeInjection: true }, unreadSourceBlocked: true, allOriginalFactsAndBytesPreserved: true, inputRetained: true, fault: d } })
  await off(page)
  // The actual source copy remains present for normal verified adoption/retry.
  await measure(page, family, iteration, 'native-source-retry', () => page.locator(selector('save-roll')).click(), async () => { const after = await saved(page, p.rollIds[0], protectedInputNotes), added = after.operations.filter(a => !baseline.operations.some(b => b.id === a.id)); assert.deepEqual(after.files, baseline.files); assert.equal(added.length, 1); assert.ok(failedIds.includes(added[0].id)); return { actualOldSourceReadableAgain: true, originalBytesUnchanged: true, stableOperationId: added[0].id, noDoubleRecord: true } })
}
async function blocked(page, family, iteration, context) {
  const old = await context.newPage(), oldPath = '/__qc-fault-v2-old-connection__'
  await old.route('**' + oldPath, route => route.fulfill({ contentType: 'text/html', body: '<title>显式旧 v2 技术资料连接</title><p>仅技术记录，不含 QC 或来源完成事实</p>' }))
  await old.goto(baseURL + oldPath)
  await old.evaluate(async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-pcs-records', 2); r.onupgradeneeded = () => { for (const name of ['records', 'files', 'operations', 'meta']) r.result.createObjectStore(name, { keyPath: 'id' }); r.transaction.objectStore('operations').createIndex('createdAt', 'createdAt') }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) }); await new Promise((resolve, reject) => { const tx = db.transaction(['records', 'files'], 'readwrite'); tx.objectStore('records').put({ id: 'qc-fault-unrelated-technical/original', collection: 'qc-fault-unrelated-technical', version: 1, value: { purpose: '隔离旧连接升级保留测试技术档案', fileId: 'QC-FAULT-OLD-TECHNICAL-FILE' } }); tx.objectStore('files').put({ id: 'QC-FAULT-OLD-TECHNICAL-FILE', blob: new Blob(['old technical original bytes'], { type: 'text/plain' }) }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }); db.onversionchange = () => { window.__qcOldVersionchangeObserved = true }; window.__qcOldHeldConnection = db })
  const baseline = await snapshot(old)
  currentPhases.set(page, 'upgrade-blocked-native-event')
  await navigate(page, LIST)
  await errorVisible(page, /升级被其他标签页阻止/)
  const navigationEnd = await page.locator('[role="alert"]').first().evaluate(async node => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.timeOrigin + performance.now() })
  const start = await page.evaluate(() => performance.timeOrigin + performance.getEntriesByType('navigation')[0].startTime)
  assert.ok(await old.evaluate(() => window.__qcOldVersionchangeObserved)); assert.match(await page.locator('body').innerText(), /旧|重试|重新读取/)
  report.samples.push({ family: family.id, ac: family.ac, iteration, phase: 'upgrade-blocked-native-event', start, end: navigationEnd, durationMs: navigationEnd - start, valid: true, result: navigationEnd - start <= maxMs ? 'passed' : 'slow', checks: { actualOldV2HeldConnection: true, actualNativeBlocked: true, originalTechnicalRecord: baseline.records, originalBlobSha256: baseline.files, noTargetQcFixture: true }, assetVersion, collectorVersion: report.collectorVersion, HEAD: report.HEAD, viewport })
  await old.close()
  await measure(page, family, iteration, 'close-old-tab-actual-retry', () => page.getByRole('button', { name: '重新读取', exact: true }).click(), async () => { await page.locator('[data-factory-qc-root="list"]').waitFor({ timeout: 20000 }); const current = await snapshot(page); assert.equal(current.dbVersion, 4); assert.deepEqual(current.records.find(r => r.id === baseline.records[0].id), baseline.records[0]); assert.deepEqual(current.files.find(f => f.id === baseline.files[0].id), baseline.files[0]); return { actualRetryAfterOldClose: true, upgradedTo4: true, originalTechnicalRecordAndBytesPreserved: true, noQcWriteDuringOpen: !active(current).some(r => r.collection === QC) } })
  const p = await prepare(page); assert.ok(roll(p.baseline, p.rollIds[0])); assert.ok(p.baseline.files.some(f => f.id === baseline.files[0].id && f.sha256 === baseline.files[0].sha256))
}
async function gcExport() {
  const matches = []
  for (const path of Object.keys(assetManifest).filter(p => p.endsWith('.js'))) {
    const code = await readFile(path, 'utf8'); if (!code.includes('getAllKeys') || !code.includes('objectStore("files").delete')) continue
    const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    for (const node of file.statements) if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const body = node.body.getText(file)
      if (!body.includes('objectStore("records").getAll()') || !body.includes('objectStore("files").getAllKeys()') || !body.includes('objectStore("files").delete(') || !body.includes('.startsWith(') || !body.includes('.deleted') || body.includes('.put(')) continue
      const aliases = file.statements.filter(ts.isExportDeclaration).flatMap(n => n.exportClause && ts.isNamedExports(n.exportClause) ? n.exportClause.elements.filter(e => (e.propertyName || e.name).text === node.name.text).map(e => e.name.text) : [])
      for (const alias of aliases) matches.push({ path: '/' + path.replace(/^dist\//, ''), exportedName: alias, localName: node.name.text, sha256: assetManifest[path], bodySha256: digest(body), sourceVersion: digest(await readFile('src/data/pcs-record-db.ts')), identification: '唯一顶层实际函数：readwrite、读取全部 records/file keys、检查 deleted/全部引用、ownedPrefix startsWith、只 delete 文件、无 put；由 AST 解析 named export 的精确对应，不猜 minified 名称' })
    }
  }
  assert.equal(matches.length, 1, '必须唯一识别现有公共安全 GC 导出；不允许猜测或新实现'); return matches[0]
}
async function gc(page, family, iteration) {
  const p = await prepare(page, 2)
  await page.locator(`${selector('select-roll')}[data-roll-id="${p.rollIds[1]}"]`).click(); await photo(page, '已完成卷保留'); await fill(page, '已完成卷照片必须保留'); await page.locator(selector('complete-roll')).click(); const completeData = await saved(page, p.rollIds[1], '已完成卷照片必须保留', true), locked = roll(completeData, p.rollIds[1])
  await page.locator(`${selector('select-roll')}[data-roll-id="${p.rollIds[0]}"]`).click(); const original = roll(completeData, p.rollIds[0]), removedId = original.photos[0].id, keptId = original.photos[1].id
  await page.locator(`${selector('remove-photo')}[data-photo-id="${removedId}"]`).click(); const notes = '真实 UI 已移除一张未完成卷照片引用'; await fill(page, notes)
  let removed
  await measure(page, family, iteration, 'ui-remove-photo-reference-save', () => page.locator(selector('save-roll')).click(), async () => { removed = await saved(page, p.rollIds[0], notes); assert.ok(!roll(removed, p.rollIds[0]).photos.some(f => f.id === removedId)); assert.ok(roll(removed, p.rollIds[0]).photos.some(f => f.id === keptId)); assert.deepEqual(roll(removed, p.rollIds[1]), locked); return { removedReference: removedId, stillReferenced: keptId, completedPhotoIds: locked.photos.map(p => p.id), noImmediateReclamationRequirement: true, filesAfterReferenceSave: removed.files } })
  const entry = await gcExport(), before = await snapshot(page), beforeFile = before.files.find(f => f.id === removedId); assert.ok(beforeFile, '生命周期 API 诊断需要实际无引用文件存在；产品没有自动立即回收承诺')
  const result = await page.evaluate(async entry => { const module = await import(entry.path); if (typeof module[entry.exportedName] !== 'function') throw new Error('实际生产公共导出不存在'); const start = performance.now(), count = await module[entry.exportedName]('FQC-PHOTO-'), end = performance.now(), again = await module[entry.exportedName]('FQC-PHOTO-'); return { count, again, start, end, durationMs: end - start } }, entry)
  const after = await snapshot(page); assert.equal(result.count, 1); assert.equal(result.again, 0); assert.ok(!after.files.some(f => f.id === removedId)); assert.deepEqual(after.files, before.files.filter(f => f.id !== removedId), '全部其他附件，包括仍引用/完成卷/其他前缀原字节均须保留'); assert.deepEqual(after.records, before.records); assert.deepEqual(roll(after, p.rollIds[1]), locked)
  report.apiDiagnostics.push({ family: family.id, iteration, kind: 'existing-public-safe-GC-API', productUiPerformance: false, entry, result, checks: { exactRemovedFile: removedId, reclaimedBytes: beforeFile.size, reclaimedSha256: beforeFile.sha256, allStillReferencedFilesPreserved: true, completedRollPhotoAndRecordUnchanged: true, repeatedCleanupZero: true }, beforeFiles: before.files, afterFiles: after.files })
  await navigate(page, p.detailPath, '[data-factory-qc-root="detail"]'); await page.locator(`${selector('select-roll')}[data-roll-id="${p.rollIds[1]}"]`).click(); assert.equal(await page.locator(selector('remove-photo')).count(), 0); await paint(page)
}
const implementations = { 'indexeddb-open-failure-retry': openFailure, 'quota-file-add-same-operation-retry': quota, 'commit-complete-read-failure-recovery': postCommit, 'local-storage-preferences-and-native-source-read': storage, 'upgrade-blocked-old-connection-retry': blocked, 'photo-reference-removal-public-safe-gc': gc }
try {
  for (const family of selected) {
    for (let iteration = 1; iteration <= trials; iteration++) {
      const context = await newContext(), page = await context.newPage(), errorsBefore = report.browserErrors.length
      try {
        await implementations[family.id](page, family, iteration, context)
        assert.equal(report.browserErrors.length, errorsBefore, '故障应有明确产品反馈，不能出现未处理浏览器异常'); assert.equal(report.forbiddenRequests.length, 0)
        report.cases.push({ family: family.id, iteration, result: 'passed', actualUi: true, diagnostics: await diagnostics(page) })
        await page.screenshot({ path: join(output, `${family.id}-${iteration}-endpoint.png`), fullPage: true })
      } catch (error) {
        const start = clickStarts.get(page), failure = { family: family.id, iteration, phase: currentPhases.get(page) || 'preparation', failedAttemptElapsedMs: Number.isFinite(start) ? Date.now() - start : null, validPerformanceSample: false, error: error.stack || String(error), url: page.url(), at: new Date().toISOString(), body: (await page.locator('body').innerText().catch(() => '')).slice(-12000), input: await inputState(page).catch(() => undefined), diagnostics: await diagnostics(page).catch(() => undefined), persisted: await snapshot(page).catch(e => ({ readFailure: String(e) })) }
        report.failures.push(failure); for (const sample of report.samples.filter(s => s.family === family.id && s.iteration === iteration)) sample.caseResult = 'failed'
        console.log(JSON.stringify({ family: family.id, iteration, failed: failure.error })); await page.screenshot({ path: join(output, `${family.id}-${iteration}-failure.png`), fullPage: true }).catch(() => undefined)
      } finally { await context.close(); await persist() }
      if (report.failures.some(f => f.family === family.id)) break
    }
    if (report.failures.length) break
  }
} finally {
  await browser.close(); report.finishedAt = new Date().toISOString(); report.assetManifestAfter = await manifest(); report.assetsStable = JSON.stringify(report.assetManifestAfter) === JSON.stringify(assetManifest)
  report.summary = selected.map(f => { const cases = report.cases.filter(c => c.family === f.id), samples = report.samples.filter(s => s.family === f.id), slow = samples.filter(s => s.result === 'slow'); return { family: f.id, expectedCases: trials, validCases: cases.length, measuredUiPhases: samples.length, maximumMs: samples.length ? Math.max(...samples.map(s => s.durationMs)) : null, slow: slow.length, allWithinThreshold: cases.length === trials && !slow.length, apiDiagnosticCount: report.apiDiagnostics.filter(d => d.family === f.id).length } })
  report.phaseSummary = selected.flatMap(f => phasePlans[f.id].map(phase => { const samples = report.samples.filter(s => s.family === f.id && s.phase === phase && s.valid), failures = report.failures.filter(e => e.family === f.id && e.phase === phase); return { family: f.id, phase, expected: trials, valid: samples.length, maximumMs: samples.length ? Math.max(...samples.map(s => s.durationMs)) : null, slow: samples.filter(s => s.result === 'slow').length, failedAttempts: failures.length, allWithinThreshold: samples.length === trials && samples.every(s => s.durationMs <= maxMs) && !failures.length } }))
  report.status = !report.failures.length && !report.browserErrors.length && !report.forbiddenRequests.length && report.assetsStable && report.summary.every(s => s.allWithinThreshold) && report.phaseSummary.every(s => s.allWithinThreshold) ? 'passed' : 'failed'
  await persist(); console.log(JSON.stringify({ output, status: report.status, assetsStable: report.assetsStable, summary: report.summary, failures: report.failures.length })); process.exitCode = report.status === 'passed' ? 0 : 1
}
