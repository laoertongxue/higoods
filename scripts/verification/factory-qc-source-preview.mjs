#!/usr/bin/env node
/** Source-trigger UI performance. Browser executes built assets only, never /src imports. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { cpus, platform, release } from 'node:os'
import { chromium } from 'playwright'
import ts from 'typescript'

const argument = key => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1] }
const calibration = process.argv.includes('--calibration'), trials = Number(argument('--trials') || (calibration ? 1 : 5))
const baseURL = argument('--base-url') || 'http://127.0.0.1:43222', thresholdMs = 1000
const runId = new Date().toISOString().replace(/[:.]/g, '-'), output = resolve(argument('--output') || `output/playwright/factory-qc-source-preview/${runId}`)
const viewport = { width: 1366, height: 768 }, QC = 'fcs.factory-qc.v1', HAND = 'fcs.stenter-handfeel.v1', PROCESS = 'fcs.factory-qc.process-records.v1'
const families = [
  { id: 'printing-first-final-output', requirement: 'AC-001/002/003/033/045', sourceKind: 'PRINTING', sourceId: 'PWO-PRINT-DEMO-01-3', route: '/fcs/craft/printing/work-orders/PWO-PRINT-DEMO-01-3', preparation: '默认实际领用且已开始PRINT的phase3来源；逐项用真实工序弹窗完成PRINT/TRANSFER，首次最终产出前无QC', action: '[data-printing-action="submit-dialog"]', endpoint: '本批实际产出与首张QC同一事务complete、单快照回读来源/卷、产出弹窗关闭且源页QC进度更新并完成绘制' },
  { id: 'dyeing-final-pack', requirement: 'AC-001/004/033/045', sourceKind: 'DYEING', sourceId: 'DWO-013', route: '/fcs/craft/dyeing/work-orders/DWO-013', preparation: '默认真实ROLL结束/PACK已开始、940米、非染厂下游；真实完成包装表单', action: '[data-process-web-status-action="confirm"]', endpoint: 'PACK实际结束与首张QC同一事务complete、来源/节点/QC单快照回读、弹窗关闭和源页待交出状态绘制' },
  { id: 'water-soluble-final-output', requirement: 'AC-001/004/033/045', sourceKind: 'WATER_SOLUBLE', sourceId: 'discover-default-F090-IN_PROGRESS', route: '/fcs/craft/dyeing/water-soluble-orders', preparation: '真实F090_operator登录；默认已有实收和水溶开工的来源，必要时真实投入本批来料后上报最终数量', action: '[data-factory-water-soluble-action="confirm-completion"]', endpoint: '独立水溶实际完工与首张QC同一事务complete、来源/QC单快照回读、原卡片最新完成事实绘制' },
  { id: 'completed-dye-target-backfill', requirement: 'AC-005/007/033/045', sourceKind: 'DYEING', sourceId: 'DYE-DISPATCH-DEMO-2', route: '/fcs/craft/dyeing/work-orders/DYE-DISPATCH-DEMO-2', preparation: '现成真实已包装GTG来源6卷360Yard、目标MJS染厂；先经真实交出单据UI作废共享草稿SJ-DEMO-20260911-001，释放本单原占用卷，再通过目标修改入口改为F090非染厂；不删除草稿、不改实物事实', action: '[data-dyeing-action="recipient-save"]', endpoint: '已完成源下游变更和补建QC同一事务complete、六卷/实际原产出/目标/QC回读及源页目标与调整记录绘制' },
  { id: 'dyeing-pack-barcode-maintenance', requirement: 'AC-001/004/007/009/012/033/045', sourceKind: 'DYEING', sourceId: 'DWO-013', route: '/fcs/craft/dyeing/work-orders/DWO-013', phases: ['barcode-edit-existing', 'barcode-import-missing'], preparation: '真实PACK940米/16卷/58.75米；立即QC应检16、登记1、待补15。真实QC UI保存首卷未完成照片/三结果/说明；在既有条码维护编辑原0长度卷至58.75，再经CSV校验导入15卷，不删除或伪造原码', action: 'existing barcode save / validated CSV commit-import', endpoint: '两个真实动作分别量测：来源条码维护与同一QC补明细同事务complete、保留首卷原ID/草稿照片字节和三结果说明，最终16稳定卷/总长940米、QC分母16、冷页面回读及界面更新' },
]
families.push({ id: 'gtg-internal-transfer', requirement: 'AC-023/022/025/033/045', sourceKind: 'DYEING', sourceId: 'DYE-DISPATCH-DEMO-2', route: '/fcs/craft/dyeing/work-orders/DYE-DISPATCH-DEMO-2', phases: ['internal-create', 'internal-send', 'internal-receive'], preparation: '真实UI作废共享001并保留两来源行→已完成GTG来源改F090补QC；整单需要手感创建固定GTG单、真实GTG账号按原码内部移交和实际库位收料，不注入收发库存', action: 'QC整单决定 / GTG内部转入 / GTG逐卷实收', endpoint: '三个动作分别计时：单据或实际收发/必要来源及接收记录同事务complete、原生回读、实际页状态与图片绘制；同厂来源身份不虚构跨厂运输。后续投入/产出/F090实际实收仅相邻功能合同，不重复计性能家族' })
const selected = argument('--family') ? families.filter(f => argument('--family').split(',').includes(f.id)) : families
assert.ok(selected.length, '没有匹配的来源家族')
const pendingFileDiagnostic = process.argv.includes('--diagnostic-pending-files')
assert.ok(!pendingFileDiagnostic || calibration && selected.length === 1 && selected[0].id === 'dyeing-pack-barcode-maintenance', 'pending附件诊断仅限指定维护校准，不计为正式样本')
const packReadDiagnostic = process.argv.includes('--diagnostic-pack-readback')
assert.ok(!packReadDiagnostic || calibration && selected.length === 1 && selected[0].id === 'dyeing-pack-barcode-maintenance', 'PACK回读诊断仅限指定维护校准，不计为正式样本')
const config = { baseURL, output, calibration, trials, thresholdMs, viewport, families: selected, plannedSamples: trials * selected.reduce((sum, family) => sum + (family.phases?.length || 1), 0), scope: '固定生产资产、真实UI动作、原生IndexedDB隔离回读；四个来源触发家族、一个真实条码维护补卷家族及GTG内部转入三阶段家族，不等于生产/现场验收', preparationBoundary: '不通过/src import调用领域命令，不注入目标完成/QC；默认静态来源事实由应用读取，前置工序、条码维护、CSV校验及账号登录均经真实UI；PACK实报卷数用于分母，不作为自动生成码', endpointBoundary: '操作事件起点→来源和QC在同一readwrite事务complete→同一readonly快照核对→源页实际更新及必要图片/字体/两帧绘制', validity: '每命名phase先独立校准1次；正式每phase至少5个有效样本；valid全部≤1000ms；失败、慢样本及版本变化全部保留' }
if (!process.argv.includes('--run')) { console.log(JSON.stringify({ prepared: true, executed: false, ...config }, null, 2)); process.exit(0) }
assert.ok(Number.isSafeInteger(trials) && trials > 0 && (calibration || trials >= 5), '正式至少5样本；单次校准须显式--calibration')
await mkdir(output, { recursive: true })
const digest = value => createHash('sha256').update(value).digest('hex')
async function manifest() { const names = ['dist/index.html', ...(await readdir('dist/assets')).filter(name => /\.(?:js|css)$/.test(name)).map(name => 'dist/assets/' + name)]; return Object.fromEntries(await Promise.all(names.sort().map(async name => [name, digest(await readFile(name))]))) }
const assetManifest = await manifest(), assetVersion = digest(JSON.stringify(assetManifest))
const report = { runId, ...config, pendingFileDiagnostic, packReadDiagnostic, startedAt: new Date().toISOString(), HEAD: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), collectorVersion: digest(await readFile(new URL(import.meta.url))), assetVersion, assetManifest, environment: { os: platform(), release: release(), cpu: cpus()[0]?.model }, samples: [], maintenance: [], internalTransfers: [], failures: [], requests: [], browserErrors: [], status: 'running' }
await writeFile(join(output, 'collector-at-run.mjs'), await readFile(new URL(import.meta.url)))
const browser = await chromium.launch({ headless: true })
report.browser = { engine: 'Chromium', version: browser.version(), headless: true }
async function persist() { await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2)) }

async function context() {
  const result = await browser.newContext({ viewport })
  result.on('page', page => {
    page.on('pageerror', error => report.browserErrors.push({ at: new Date().toISOString(), url: page.url(), message: error.message }))
    page.on('request', request => { const url = new URL(request.url()); if (url.origin === new URL(baseURL).origin && (url.pathname.startsWith('/src/') || url.pathname.includes('@vite'))) report.requests.push({ forbidden: true, url: url.pathname }) })
  })
  await result.addInitScript(() => {
    window.__sourceTransactions = []; window.__sourceEventStart = null; window.__sourceMissingFiles = []
    const txs = new WeakMap(), originalTx = IDBDatabase.prototype.transaction, originalPut = IDBObjectStore.prototype.put, originalGet = IDBObjectStore.prototype.get
    const references = value => { const found = new Set(), seen = new Set(); const visit = item => { if (typeof item === 'string' && item.startsWith('pcs-file:')) found.add(item.slice(9)); else if (item && typeof item === 'object' && !(item instanceof Blob) && !seen.has(item)) { seen.add(item); if (typeof item.fileId === 'string' && item.fileStorage !== 'static') found.add(item.fileId); Object.values(item).forEach(visit) } }; visit(value); return [...found] }
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = originalTx.apply(this, args)
      if (this.name === 'higood-pcs-records' && args[1] === 'readwrite') {
        const value = { id: window.__sourceTransactions.length + 1, at: performance.now(), stores: [...tx.objectStoreNames], puts: [], status: 'pending' }
        txs.set(tx, value); window.__sourceTransactions.push(value)
        tx.addEventListener('complete', () => { value.status = 'complete'; value.end = performance.now() })
        tx.addEventListener('abort', () => { value.status = 'abort'; value.end = performance.now() })
      }
      return tx
    }
    IDBObjectStore.prototype.put = function (value, ...args) {
      const tx = txs.get(this.transaction)
      if (tx && this.name === 'records') tx.puts.push({ id: value.id, collection: value.collection, kind: value.value?.kind, key: value.value?.key, path: value.value?.path, recordSourceId: value.value?.value?.waterOrderId, sourceKind: value.value?.data?.source?.kind, sourceId: value.value?.data?.source?.id, qcId: value.value?.data?.id, orderId: value.value?.data?.orderId, actionKind: value.value?.data?.kind, fileReferences: references(value.value) })
      return originalPut.call(this, value, ...args)
    }
    IDBObjectStore.prototype.get = function (key) { const request = originalGet.call(this, key), tx = txs.get(this.transaction); if (this.name === 'files') { const stack = new Error('file-reference-read').stack; request.addEventListener('success', () => { if (request.result === undefined) window.__sourceMissingFiles.push({ key, txId: tx?.id, at: performance.now(), stack }) }) }; return request }
  })
  return result
}
async function navigate(page, route, selector) {
  const response = await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' })
  assert.equal(response?.ok(), true, '真实固定资产路由必须成功')
  const html = await response.text(); assert.match(html, /\/assets\/[^"']+\.js/); assert.doesNotMatch(html, /\/src\/main|@vite\/client/)
  assert.equal(digest(Buffer.from(html)), assetManifest['dist/index.html'], '实际服务入口必须对应本次固定dist index版本')
  await page.locator(selector).first().waitFor({ timeout: 20000 })
}
async function readState(page, sourceKind, sourceId) {
  return page.evaluate(async ({ sourceKind, sourceId, QC, PROCESS }) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-pcs-records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['records'], 'readonly'), request = tx.objectStore('records').getAll()
        tx.oncomplete = () => {
          const active = request.result.filter(row => !row.deleted), heads = active.filter(row => row.collection === QC && row.value.kind === 'qc' && row.value.data.source.kind === sourceKind && row.value.data.source.id === sourceId), ids = new Set(heads.map(row => row.value.data.id)), taskIds = new Set(heads.map(row => row.value.data.source.taskId).filter(Boolean))
          // The water ledger has a stable taskId key before waterOrderId in
          // splitFactoryProcessLedger. Match its stored business identity too.
          const state = { heads: heads.map(row => ({ id: row.id, version: row.version, data: row.value.data })), rolls: active.filter(row => row.collection === QC && row.value.kind === 'roll' && ids.has(row.value.qcId)).map(row => row.value.data), source: active.filter(row => row.collection === PROCESS && (row.value.key === sourceId || row.value.value?.waterOrderId === sourceId || row.value.path === 'tasks' && taskIds.has(row.value.key))).map(row => ({ id: row.id, version: row.version, path: row.value.path, value: row.value.value })) }
          window.__sourceEndpointSnapshot = state; resolve(state)
        }; tx.onabort = () => reject(tx.error)
      })
    } finally { db.close() }
  }, { sourceKind, sourceId, QC, PROCESS })
}
async function paint(page, selector) { return page.locator(selector).first().evaluate(async root => { await Promise.all([...root.querySelectorAll('img')].filter(img => img.offsetParent !== null).map(async img => { await img.decode(); if (!img.naturalWidth) throw new Error('来源页必要图片未加载：' + img.alt) })); await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return { end: performance.now(), imageCount: root.querySelectorAll('img').length } }) }
async function arm(page, selector) { await page.evaluate(selector => { window.__sourceEventStart = null; const capture = event => { if (event.target instanceof Element && event.target.closest(selector)) { window.__sourceEventStart = performance.now(); document.removeEventListener('click', capture, true) } }; document.addEventListener('click', capture, true) }, selector) }
async function checkAtomic(page, f, state) {
  assert.equal(state.heads.length, 1, '来源实际动作必须持久创建唯一一张QC')
  assert.ok(state.source.length, '来源动作必须按记录真实持久，不能只建QC')
  const trace = await page.evaluate(({ kind, id }) => ({ start: window.__sourceEventStart, txs: window.__sourceTransactions.filter(tx => tx.at >= window.__sourceEventStart && tx.status === 'complete' && tx.puts.some(put => put.kind === 'qc' && put.sourceKind === kind && put.sourceId === id) && tx.puts.some(put => put.collection === 'fcs.factory-qc.process-records.v1' && (put.key === id || put.recordSourceId === id))) }), { kind: f.sourceKind, id: f.sourceId })
  assert.ok(Number.isFinite(trace.start), '需要真实点击事件起点')
  assert.ok(trace.txs.length, '来源事实与QC必须在同一实际readwrite事务complete')
  assert.equal(state.heads[0].data.source.id, f.sourceId)
  return trace
}
async function measured(page, f, iteration, selector, action, verify, sourceSelector, phase = 'source-trigger') {
  await arm(page, selector); await action(); const verification = await verify()
  const state = await readState(page, f.sourceKind, f.sourceId)
  const atomic = await checkAtomic(page, f, state), painted = await paint(page, sourceSelector), durationMs = painted.end - atomic.start
  const sample = { family: f.id, phase, requirement: f.requirement, iteration, sourceKind: f.sourceKind, sourceId: f.sourceId, route: page.url(), action: selector, fixtureVersion: 'default-static-source-real-ui-preparation-v1', cacheState: '每样本独立新context；实际前置与当前来源页交互已加载', start: atomic.start, end: painted.end, durationMs, result: durationMs <= thresholdMs ? 'passed' : 'slow', valid: true, endpoint: f.endpoint, endpointChecks: { uniqueQc: state.heads[0].data.id, qcRolls: state.rolls.length, sourceRecords: state.source.map(row => ({ id: row.id, version: row.version, path: row.path })), committedSameTransaction: atomic.txs.map(tx => ({ id: tx.id, end: tx.end, stores: tx.stores, puts: tx.puts })), sourcePageUpdated: true, images: painted.imageCount, ...verification }, readback: state, assetVersion, collectorVersion: report.collectorVersion, HEAD: report.HEAD, viewport }
  report.samples.push(sample); console.log(JSON.stringify({ family: f.id, phase, iteration, durationMs, result: sample.result })); await persist()
}
async function submitPrintStage(page, action, qty) {
  await page.locator('[data-printing-action="production-stage"]').click()
  await page.locator('[data-printing-dialog-field="productionAction"]').selectOption(action)
  if (qty !== undefined) await page.locator('[data-printing-dialog-field="productionQty"]').fill(String(qty))
  await page.locator('[data-printing-action="submit-dialog"]').click()
  await page.locator('[data-printing-dialog-panel]').waitFor({ state: 'detached' })
}
async function printing(page, f, iteration) {
  await navigate(page, f.route, '[data-printing-work-order-detail-root]')
  await page.locator('[data-printing-action="complete"]').click()
  const used = Number(await page.locator('[data-printing-dialog-field="usedQty"]').inputValue()), usedRolls = Number(await page.locator('[data-printing-dialog-field="usedRollCount"]').inputValue())
  assert.ok(used > 2 && usedRolls > 0, '静态来源须有真实领用前置')
  await page.locator('[data-printing-dialog-panel] [data-printing-action="close-dialog"]').first().click()
  await submitPrintStage(page, 'PRINT:FINISH', used)
  await page.locator('[data-printing-action="production-stage"]').click()
  await page.locator('[data-printing-dialog-field="productionAction"]').waitFor()
  const transfer = await page.locator('[data-printing-dialog-field="productionAction"] option[value="TRANSFER:START"]').count()
  await page.locator('[data-printing-dialog-panel] [data-printing-action="close-dialog"]').first().click()
  if (transfer) { await submitPrintStage(page, 'TRANSFER:START'); await submitPrintStage(page, 'TRANSFER:FINISH', used - 2) }
  assert.equal((await readState(page, f.sourceKind, f.sourceId)).heads.length, 0, '中间工序完成不可提前建QC')
  await page.locator('[data-printing-action="complete"]').click()
  await page.locator('[data-printing-dialog-field="completedQty"]').fill(String(Math.floor((used - 2) / 2 * 100) / 100))
  await page.locator('[data-printing-dialog-field="completedRollCount"]').fill('1')
  await page.locator('[data-printing-dialog-field="lossQty"]').fill('0')
  if (!(await page.locator('[data-printing-dialog-field="printerNo"]').inputValue()).trim()) await page.locator('[data-printing-dialog-field="printerNo"]').fill('PRN-UI-VERIFY')
  await measured(page, f, iteration, '[data-printing-action="submit-dialog"]', () => page.locator('[data-printing-action="submit-dialog"]').click(), async () => {
    await page.locator('[data-printing-dialog-panel]').waitFor({ state: 'detached' })
    await page.locator('[data-printing-qc-summary] a[href*="/qc-orders/"]').first().waitFor()
  }, '[data-printing-detail-surface]')
  const state = report.samples.at(-1).readback, source = state.source.find(row => row.path === 'state.workOrders')?.value.businessView
  assert.ok(source?.productionBatches?.length === 1 && source.output.completedQty > 0); assert.equal(state.rolls.length, 1)
}
async function dyeing(page, f, iteration) {
  await navigate(page, f.route, '[data-dyeing-action="open-web-status-action-dialog"][data-action-code="DYE_FINISH_PACKING"]')
  assert.equal((await readState(page, f.sourceKind, f.sourceId)).heads.length, 0)
  await page.locator('[data-dyeing-action="open-web-status-action-dialog"][data-action-code="DYE_FINISH_PACKING"]').click()
  await page.locator('[data-process-web-status-action-field="包装完成面料米数"]').fill('940')
  await page.locator('[data-process-web-status-action-field="包装卷数"]').fill('16')
  await page.locator('[data-process-web-status-action-field="每卷长度"]').fill('58.75')
  await measured(page, f, iteration, '[data-process-web-status-action="confirm"]', () => page.locator('[data-process-web-status-action="confirm"]').click(), async () => {
    await page.locator('#process-web-status-action-dialog').waitFor({ state: 'detached' })
    await page.getByText('待交出', { exact: true }).first().waitFor()
  }, 'main')
  const rows = report.samples.at(-1).readback.source
  assert.ok(rows.some(row => row.path === 'state.workOrders' && row.value.status === 'WAIT_HANDOVER'))
  assert.ok(rows.some(row => row.path === 'state.nodeRecords' && row.value.some(node => node.nodeCode === 'PACK' && node.finishedAt && node.outputQty === 940)))
}
async function water(page, f, iteration) {
  const route = f.route
  await navigate(page, '/fcs/pda/auth/login?returnTo=' + encodeURIComponent(route), '[data-pda-login-field="loginId"]')
  await page.locator('[data-pda-login-field="loginId"]').fill('F090_operator')
  await page.locator('[data-pda-login-field="password"]').fill('123456')
  await page.locator('[data-pda-login-action="submit"]').click()
  await page.locator('[data-testid="factory-water-soluble-orders-page"]').waitFor()
  let button = page.locator('[data-factory-water-soluble-action="complete"]').first()
  if (!(await button.count())) {
    const input = page.locator('[data-testid="factory-water-soluble-card"]').filter({ has: page.getByText('水溶中', { exact: true }) }).locator('[data-factory-water-soluble-action="start"]').first()
    await input.click(); button = page.locator('[data-factory-water-soluble-action="complete"]').first()
  }
  await button.waitFor(); f = { ...f, sourceId: await button.getAttribute('data-order-id') }
  assert.ok(f.sourceId && !f.sourceId.startsWith('WATER-OUTPUT-DEMO-'), '必须默认未完工来源，不能用已完工输出样本冒充首次完成')
  assert.equal((await readState(page, f.sourceKind, f.sourceId)).heads.length, 0)
  await button.click()
  const qty = Number(await page.locator('[data-factory-water-soluble-field="completedQty"]').inputValue()); assert.ok(qty > 0)
  const card = `[data-testid="factory-water-soluble-card"][data-order-id="${f.sourceId}"]`
  await measured(page, f, iteration, '[data-factory-water-soluble-action="confirm-completion"]', () => page.locator('[data-factory-water-soluble-action="confirm-completion"]').click(), async () => {
    await page.locator('[data-factory-water-soluble-field="completedQty"]').waitFor({ state: 'detached' })
    await page.locator(card).getByText(/最近操作：.*完成水溶/).waitFor()
  }, card)
  const state = report.samples.at(-1).readback
  assert.ok(state.source.some(row => row.value.waterOrderId === f.sourceId && row.value.completedQty === qty && row.value.status === 'WAIT_HANDOVER'))
}
async function backfill(page, f, iteration) {
  const open = `[data-dyeing-action="recipient-open"][data-dye-order-id="${f.sourceId}"]`, field = '[data-dye-recipient-target]', confirm = '[data-dyeing-action="recipient-save"]'
  await navigate(page, '/fcs/craft/dyeing/handover-documents', '[data-dye-output-page]')
  await page.locator('[data-dye-output-action="detail"][data-id="SJ-DEMO-20260911-001"]').first().click()
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-dye-output-action="void"][data-id="SJ-DEMO-20260911-001"]').click()
  await page.getByText('单据已作废，所选卷已释放。', { exact: true }).waitFor()
  await navigate(page, f.route, open)
  assert.equal((await readState(page, f.sourceKind, f.sourceId)).heads.length, 0, '染厂下游不能预建QC')
  await page.locator(open).click(); await page.locator(field).selectOption('FACTORY:F090')
  await page.locator('[data-dye-recipient-reason]').fill('固定生产资产验证：实际下游由MJS染厂调整到F090工厂')
  await measured(page, f, iteration, confirm, () => page.locator(confirm).click(), async () => {
    await page.locator(field).waitFor({ state: 'detached' })
    await page.locator('[data-dye-recipient-summary]').getByText(/全能力测试工厂|测试专用工厂/, { exact: false }).first().waitFor()
  }, 'main')
  const state = report.samples.at(-1).readback
  assert.equal(state.heads[0].data.source.target.isDyeingFactory, false); assert.equal(state.heads[0].data.source.target.factoryId, 'F090'); assert.equal(state.rolls.length, 6)
  const source = state.source.find(row => row.path === 'state.workOrders')?.value
  assert.ok(source?.outputRolls?.length === 6 && source.status === 'WAIT_HANDOVER'); assert.equal(source.outputRolls.reduce((sum, roll) => sum + roll.qty, 0), 360)
}
async function photoHashes(page, ids) {
  return page.evaluate(async ids => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-pcs-records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    try {
      const files = await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readonly'), requests = ids.map(id => tx.objectStore('files').get(id)); tx.oncomplete = () => resolve(requests.map(r => r.result)); tx.onabort = () => reject(tx.error) })
      return Promise.all(files.map(async file => { if (!file) throw new Error('真实保存照片缺少Blob'); return { id: file.id, size: file.blob.size, type: file.blob.type, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('') } }))
    } finally { db.close() }
  }, ids)
}
function maintenanceState(state, qcId, count, qty, originalId, priorDraft) {
  assert.equal(state.heads.length, 1); assert.equal(state.heads[0].data.id, qcId, '补条码持续进入同一张QC')
  assert.equal(state.heads[0].data.source.reportedRollCount, 16, '分母来自实际PACK实报16卷')
  assert.equal(state.rolls.length, count); assert.equal(new Set(state.rolls.map(r => r.id)).size, count); assert.equal(new Set(state.rolls.map(r => r.barcode)).size, count)
  assert.equal(Math.round(state.rolls.reduce((sum, r) => sum + r.qty, 0) * 100) / 100, qty)
  const source = state.source.find(r => r.path === 'state.workOrders')?.value, first = state.rolls.find(r => r.id === originalId)
  assert.ok(first, '维护原0长度卷保留原ID，不静默删除'); assert.equal(source.outputRolls.length, count)
  assert.ok(state.rolls.every(r => r.qty === 58.75 && r.unit === '米' && r.confirmed && !r.handedOut))
  assert.equal(source.outputRolls.reduce((sum, r) => sum + r.qty, 0), qty)
  assert.ok(source.outputRolls.every(r => r.weightKg === 16.303 && r.gsm === 185 && r.widthCm === 150))
  if (priorDraft) { assert.deepEqual(first.photos, priorDraft.photos); assert.deepEqual(first.results, priorDraft.results); assert.equal(first.notes, priorDraft.notes); assert.ok(!first.completedAt) }
  return { sameQcId: qcId, expectedRolls: 16, registeredRolls: count, missingRollDetails: 16 - count, checkedRolls: 0, actualTotalMeters: qty, originalRollIdPreserved: originalId, savedUncompletedPhotoResultsNotesPreserved: !!priorDraft }
}
async function assertQcCounts(page, registered, missing) {
  const summary = page.locator('[data-factory-qc-summary]')
  await summary.waitFor(); const text = await summary.innerText()
  assert.match(text, /已检\s*0\s*\/\s*应检\s*16\s*卷/, '实际QC页面不得将现有1卷显示成全部应检1卷')
  // Assert existing visible business text; no product-only collector hooks.
  assert.match(text, new RegExp(`来源实报\\s*16\\s*卷，已登记\\s*${registered}\\s*卷`), '实际QC页面必须明确实报数及已登记明细数')
  if (missing) assert.match(text, new RegExp(`待补\\s*${missing}\\s*卷明细`), '缺少明细不能被误称全部检查完成')
  else assert.doesNotMatch(text, /待补\s*[1-9]\d*\s*卷明细/, '补齐后不得仍提示缺卷')
  return { text, expected: 16, registered, missing }
}
async function barcodeSavedOrError(page) {
  await page.waitForFunction(() => !document.querySelector('[data-dye-barcode-inner]') || [...document.querySelectorAll('[data-dye-barcode-error], [data-dye-barcode-inner-error]')].some(node => node.textContent?.trim()))
  const error = await page.locator('[data-dye-barcode-error]').innerText().catch(() => '')
  assert.equal(error.trim(), '', '真实条码保存业务错误：' + error)
  await page.locator('[data-dye-barcode-inner]').waitFor({ state: 'detached' })
}
async function pendingReferenceProbe(page) {
  const matches = []
  for (const path of Object.keys(assetManifest).filter(p => p.endsWith('.js'))) {
    const code = await readFile(path, 'utf8'); if (!code.includes('图片尚未登记为可复用文件，请重新保存图片后导出。')) continue
    const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    for (const node of file.statements) if (ts.isFunctionDeclaration(node) && node.name && node.body?.getText(file).includes('图片尚未登记为可复用文件，请重新保存图片后导出。')) {
      for (const statement of file.statements.filter(ts.isExportDeclaration)) if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const entry of statement.exportClause.elements) if ((entry.propertyName || entry.name).text === node.name.text) matches.push({ path: '/' + path.replace(/^dist\//, ''), exportedName: entry.name.text, localName: node.name.text, sha256: assetManifest[path] })
    }
  }
  assert.equal(matches.length, 1, '仅调用AST精确识别的既有公共getPcsDurableFileReference只读导出')
  return page.evaluate(async entry => {
    const module = await import(entry.path), db = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-pcs-records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    let keys
    try { keys = await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readonly'), r = tx.objectStore('files').getAllKeys(); tx.oncomplete = () => resolve(r.result.map(String)); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
    const persisted = new Set(keys), aborted = window.__sourceTransactions.filter(tx => tx.status === 'abort'), referenced = [...new Set(aborted.flatMap(tx => tx.puts.flatMap(row => row.fileReferences || [])))], ids = [...new Set([...window.__sourceMissingFiles.map(file => String(file.key)), ...referenced.filter(id => !persisted.has(id))])]
    return { entry, diagnosticOnly: true, mutation: false, nativePersistedKeysAtAbort: keys, files: ids.map(id => { try { return { id, registeredInPcsMemory: module[entry.exportedName]('pcs-file:' + id) === 'pcs-file:' + id, nativePersisted: persisted.has(id), referencedBy: aborted.flatMap(tx => tx.puts.filter(row => row.fileReferences?.includes(id)).map(row => ({ txId: tx.id, txStatus: tx.status, ...row }))) } } catch (error) { return { id, registeredInPcsMemory: false, nativePersisted: persisted.has(id), error: String(error), referencedBy: aborted.flatMap(tx => tx.puts.filter(row => row.fileReferences?.includes(id)).map(row => ({ txId: tx.id, txStatus: tx.status, ...row }))) } } }) }
  }, matches[0])
}
async function packPersistenceDiagnostic(page, family) {
  const matches = []
  for (const path of Object.keys(assetManifest).filter(p => p.endsWith('.js'))) {
    const code = await readFile(path, 'utf8'); if (!code.includes('已保存的染色记录无法读取')) continue
    const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    for (const node of file.statements) if (ts.isFunctionDeclaration(node) && node.name && node.body && /^\{return structuredClone\([\w$]+\([\w$]+\)\.outputRolls\?\?\[\]\)\}$/.test(node.body.getText(file))) {
      for (const statement of file.statements.filter(ts.isExportDeclaration)) if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const entry of statement.exportClause.elements) if ((entry.propertyName || entry.name).text === node.name.text) matches.push({ path: '/' + path.replace(/^dist\//, ''), exportedName: entry.name.text, localName: node.name.text, sha256: assetManifest[path] })
    }
  }
  assert.equal(matches.length, 1, 'AST唯一匹配染色domain的既有getDyeOutputRolls公共读取，不调用写命令')
  const summarize = state => {
    const order = state.source.find(r => r.path === 'state.workOrders')?.value, tasks = state.source.filter(r => r.path === 'tasks').map(r => r.value), task = tasks.find(t => t.taskId === order?.taskId), nodes = state.source.filter(r => r.path === 'state.nodeRecords').flatMap(r => r.value)
    const sourceKeys = [...new Set([...Object.keys(order?.sourceSnapshot || {}), ...Object.keys(task?.sourceSnapshot || {})])]
    return { order: order && { id: order.dyeOrderId, no: order.dyeOrderNo, status: order.status, updatedAt: order.updatedAt, taskId: order.taskId, factoryId: order.dyeFactoryId, sourceType: order.sourceType, outputRolls: order.outputRolls?.map(r => ({ id: r.id, qty: r.qty })) }, nodes: nodes.map(n => ({ code: n.nodeCode, status: n.status, startedAt: n.startedAt, finishedAt: n.finishedAt, inputQty: n.inputQty, outputQty: n.outputQty, outputRollCount: n.outputRollCount, taskId: n.taskId })), tasks: tasks.map(t => ({ id: t.taskId, status: t.status, updatedAt: t.updatedAt, factoryId: t.assignedFactoryId, sourceType: t.sourceSnapshot?.sourceType })), sourceIdentity: { orderSource: order?.sourceSnapshot, taskSource: task?.sourceSnapshot, equal: JSON.stringify(order?.sourceSnapshot) === JSON.stringify(task?.sourceSnapshot), differingKeys: sourceKeys.filter(k => JSON.stringify(order?.sourceSnapshot?.[k]) !== JSON.stringify(task?.sourceSnapshot?.[k])) }, demoOutput: state.source.filter(r => r.path === 'demoOutput').map(r => r.value), qc: state.heads.map(h => ({ id: h.data.id, sourceId: h.data.source.id, sourceKind: h.data.source.kind, reportedRollCount: h.data.source.reportedRollCount, hasFinalOutput: h.data.source.hasFinalOutput, completedAt: h.data.source.completedAt })), qcRollCount: state.rolls.length }
  }
  const view = async target => ({ url: target.url(), statusLines: (await target.locator('body').innerText()).split('\n').filter(line => /当前状态|平台聚合状态|完成包装|待交出|已保存的染色|校验|当前记录未能读取|资料暂时无法读取/.test(line)), alerts: await target.locator('[role="alert"]').allTextContents() })
  const probe = target => target.evaluate(async ({ entry, id }) => { const module = await import(entry.path), before = window.__sourceTransactions.length; try { const rolls = module[entry.exportedName](id); return { entry, rolls: rolls.map(r => ({ id: r.id, qty: r.qty })), apiError: null, readApiNoPersistenceWrites: window.__sourceTransactions.length === before } } catch (error) { return { entry, apiError: String(error), readApiNoPersistenceWrites: window.__sourceTransactions.length === before } } }, { entry: matches[0], id: family.sourceId })
  const current = { native: summarize(await readState(page, family.sourceKind, family.sourceId)), ui: await view(page), publicRead: await probe(page) }, coldPage = await page.context().newPage()
  try {
    await navigate(coldPage, family.route, 'main'); await coldPage.waitForFunction(() => /当前状态：|当前记录未能读取|资料暂时无法读取/.test(document.querySelector('main')?.innerText || ''))
    return { diagnosticOnly: true, current, cold: { native: summarize(await readState(coldPage, family.sourceKind, family.sourceId)), ui: await view(coldPage), publicRead: await probe(coldPage) } }
  } finally { await coldPage.close() }
}
async function barcodeMaintenance(page, f, iteration) {
  const packButton = '[data-dyeing-action="open-web-status-action-dialog"][data-action-code="DYE_FINISH_PACKING"]', packConfirm = '[data-process-web-status-action="confirm"]'
  await navigate(page, f.route, packButton); assert.equal((await readState(page, f.sourceKind, f.sourceId)).heads.length, 0)
  await page.locator(packButton).click()
  for (const [label, value] of [['包装完成面料米数', '940'], ['包装卷数', '16'], ['每卷长度', '58.75']]) await page.locator(`[data-process-web-status-action-field="${label}"]`).fill(value)
  await arm(page, packConfirm); await page.locator(packConfirm).click(); await page.locator('#process-web-status-action-dialog').waitFor({ state: 'detached' }); await page.getByText('待交出', { exact: true }).first().waitFor()
  const initial = await readState(page, f.sourceKind, f.sourceId), createAtomic = await checkAtomic(page, f, initial), qcId = initial.heads[0].data.id, firstId = initial.rolls[0]?.id
  assert.equal(initial.heads[0].data.source.reportedRollCount, 16); assert.equal(initial.rolls.length, 1); assert.equal(initial.rolls[0].qty, 0); assert.ok(!initial.rolls[0].confirmed)
  const packs = initial.source.filter(r => r.path === 'state.nodeRecords').flatMap(r => r.value).filter(r => r.nodeCode === 'PACK' && r.finishedAt)
  assert.equal(packs.reduce((sum, r) => sum + r.outputRollCount, 0), 16, '真实PACK上报卷数必须持久，不能读取计划卷数')
  const qcPage = await page.context().newPage(), qcRoute = '/fcs/craft/dyeing/qc-orders/' + encodeURIComponent(qcId)
  try {
    await navigate(qcPage, qcRoute, '[data-factory-qc-root="detail"]'); const initialUi = await assertQcCounts(qcPage, 1, 15)
    await qcPage.locator(`[data-factory-qc-action="select-roll"][data-roll-id="${firstId}"]`).click()
    const reference = await qcPage.locator('[data-factory-qc-editor] [data-image-url]').first().getAttribute('data-image-url'), bytes = await readFile(resolve('public', new URL(reference, baseURL).pathname.slice(1))), extension = /\.jpe?g$/i.test(reference) ? 'jpg' : /\.webp$/i.test(reference) ? 'webp' : 'png'
    await qcPage.locator('[data-factory-qc-field="photos"]').setInputFiles({ name: '首卷未完成草稿对应面料图.' + extension, mimeType: extension === 'jpg' ? 'image/jpeg' : 'image/' + extension, buffer: bytes })
    for (const key of ['color', 'handfeel', 'material']) await qcPage.locator(`[data-factory-qc-field="${key}"]`).selectOption(key === 'handfeel' ? '有差异' : '符合要求')
    const notes = 'PACK后首卷待维护：已存照片与三结果说明必须随同单后补卷保留'
    await qcPage.locator('[data-factory-qc-field="notes"]').fill(notes); await qcPage.locator('[data-factory-qc-action="save-roll"]').click()
    await qcPage.waitForFunction(() => document.querySelector('[data-factory-qc-unsaved-state]')?.textContent === '未完成质检')
    const baseline = await readState(qcPage, f.sourceKind, f.sourceId), priorDraft = baseline.rolls.find(r => r.id === firstId); assert.equal(priorDraft.notes, notes); assert.equal(priorDraft.photos.length, 1); assert.ok(!priorDraft.completedAt)
    const priorBytes = await photoHashes(qcPage, priorDraft.photos.map(p => p.id))
    await navigate(page, '/fcs/craft/dyeing/work-orders', '[data-dye-work-orders-root]')
    await page.locator('[data-dye-work-orders-field="keyword"]').fill(initial.heads[0].data.source.no); await page.locator('[data-dye-work-orders-action="apply-filter"]').click()
    await page.locator(`[data-dye-work-orders-action="barcodes"][data-id="${f.sourceId}"]`).click(); await page.locator('[data-dye-barcode-root]').waitFor()
    await page.locator(`[data-dye-barcode-action="edit"][data-id="${firstId}"]`).click()
    for (const [key, value] of [['qty', '58.75'], ['weightKg', '16.303'], ['gsm', '185'], ['widthCm', '150'], ['vatNo', 'QC-PACK-UI'], ['remark', '原0长度卷由真实维护修正，保留原码']]) await page.locator(`[data-dye-barcode-editor] [data-dye-barcode-field="${key}"]`).fill(value)
    await measured(page, f, iteration, '[data-dye-barcode-action="save"]', () => page.locator('[data-dye-barcode-action="save"]').click(), async () => {
      await barcodeSavedOrError(page); const after = await readState(page, f.sourceKind, f.sourceId), checks = maintenanceState(after, qcId, 1, 58.75, firstId, priorDraft)
      assert.deepEqual(await photoHashes(page, priorDraft.photos.map(p => p.id)), priorBytes); assert.match(await page.locator('[data-dye-barcode-body]').innerText(), /总长度：\s*58\.75/)
      return { ...checks, originalPhotoSha256: priorBytes }
    }, '[data-dye-barcode-root]', 'barcode-edit-existing')
    // The second page's explicit refresh is a contract read, outside the
    // source edit timing; it is not silently combined into one UI action.
    await qcPage.locator('[data-factory-qc-action="refresh"]').click(); const afterEditUi = await assertQcCounts(qcPage, 1, 15)
    await page.locator('[data-dye-barcode-action="import"]').click()
    const csv = '卷长,实称重量KG,克重,幅宽cm,缸号,备注\n' + Array.from({ length: 15 }, (_, i) => `58.75,16.303,185,150,QC-PACK-UI,真实UI导入补第${i + 2}卷`).join('\n')
    await page.locator('[data-dye-barcode-field="importText"]').fill(csv); await page.locator('[data-dye-barcode-action="validate-import"]').click(); await page.locator('[data-dye-barcode-import-preview]').getByText(/校验通过 15 卷，总长度 881\.25/).waitFor()
    await measured(page, f, iteration, '[data-dye-barcode-action="commit-import"]', () => page.locator('[data-dye-barcode-action="commit-import"]').click(), async () => {
      await barcodeSavedOrError(page); const after = await readState(page, f.sourceKind, f.sourceId), checks = maintenanceState(after, qcId, 16, 940, firstId, priorDraft)
      assert.deepEqual(await photoHashes(page, priorDraft.photos.map(p => p.id)), priorBytes); assert.match(await page.locator('[data-dye-barcode-body]').innerText(), /总卷数：\s*16\s*总长度：\s*940\.00/)
      return { ...checks, originalPhotoSha256: priorBytes, csvValidatedRows: 15 }
    }, '[data-dye-barcode-root]', 'barcode-import-missing')
    await navigate(qcPage, qcRoute, '[data-factory-qc-root="detail"]'); const cold = await readState(qcPage, f.sourceKind, f.sourceId), coldChecks = maintenanceState(cold, qcId, 16, 940, firstId, priorDraft), coldUi = await assertQcCounts(qcPage, 16, 0)
    await qcPage.locator(`[data-factory-qc-action="select-roll"][data-roll-id="${firstId}"]`).click(); assert.equal(await qcPage.locator('[data-factory-qc-field="notes"]').inputValue(), notes); await paint(qcPage, '[data-factory-qc-root]'); assert.deepEqual(await photoHashes(qcPage, priorDraft.photos.map(p => p.id)), priorBytes)
    const requirementsCaption = await qcPage.locator('[data-factory-qc-editor]').innerText()
    assert.match(requirementsCaption, /颜色要求：\s*雾蓝/, '冷QC页面须显示可理解的实际颜色要求')
    assert.ok(!requirementsCaption.includes('["FAB-DYE-013","雾蓝",null]'), '质检要求说明不得显示内部JSON数组原串')
    report.maintenance.push({ family: f.id, iteration, actualPackCreate: { atomic: createAtomic, state: initial, ui: initialUi }, afterEditUi, preservedDraft: { photoReference: reference, testPhotoPurpose: '对应面料正式静态图用于明确原型测试上传，不冒称现场实拍', draft: priorDraft, files: priorBytes }, actualCsv: { rows: 15, sha256: digest(csv) }, cold: { ...coldChecks, data: cold, ui: coldUi, requirementsCaption }, boundary: 'PACK实报数不生成卷码；现有原码经真实编辑、其余条码经现有CSV入口生成。重量是原型输入测试值，不冒称现场称重。QC第二页的显式重读/冷入口是额外契约检查，不合入编辑或导入性能样本。' })
    await qcPage.screenshot({ path: join(output, `${f.id}-${iteration}-cold-qc.png`), fullPage: true })
  } catch (error) {
    if (pendingFileDiagnostic) report.pendingReferenceProbe = await pendingReferenceProbe(page).catch(error => ({ diagnosticFailed: String(error) }))
    const persisted = await readState(page, f.sourceKind, f.sourceId).catch(error => ({ readError: String(error) })), persistedPhotoIds = persisted.rolls?.find(r => r.id === firstId)?.photos.map(p => p.id) || []
    report.maintenance.push({ family: f.id, iteration, result: 'failed', persistedReadbackAfterFailure: persisted, persistedPhotosAfterFailure: await photoHashes(page, persistedPhotoIds).catch(error => ({ readError: String(error) })), qcPage: { url: qcPage.url(), body: (await qcPage.locator('body').innerText().catch(() => '')).slice(-8000), counts: await qcPage.locator('[data-factory-qc-summary]').innerText().catch(() => ''), error: await qcPage.locator('[data-factory-qc-roll-error]').innerText().catch(() => '') }, sourcePage: { keyword: await page.locator('[data-dye-work-orders-field="keyword"]').inputValue().catch(() => ''), barcodeErrors: await page.locator('[data-dye-barcode-error]').innerText().catch(() => '') } })
    throw error
  } finally { await qcPage.close() }
}
// This family starts with actual existing GTG production and performs every
// preparation/physical action through UI. Native IDB is a read-only observer.
async function internalState(page, sourceId) {
  return page.evaluate(async ({ sourceId, QC, HAND, PROCESS }) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').getAll()
      tx.oncomplete = () => {
        const rows = request.result.filter(row => !row.deleted), process = rows.filter(row => row.collection === PROCESS), qc = rows.filter(row => row.collection === QC && row.value.kind === 'qc' && row.value.data.source.kind === 'DYEING' && row.value.data.source.id === sourceId).map(row => row.value.data), hands = rows.filter(row => row.collection === HAND && row.value.kind === 'handfeel' && row.value.data.source.kind === 'DYEING' && row.value.data.source.id === sourceId).map(row => row.value.data), handIds = new Set(hands.map(hand => hand.id)), qcIds = new Set(qc.map(head => head.id))
        const sources = process.filter(row => row.value.path === 'sources' && row.value.value.lines?.some(line => handIds.has(line.stenterHandfeelOrderId))).map(row => row.value.value), sourceIds = new Set(sources.map(source => source.id)), receipts = process.filter(row => row.value.path === 'receipts' && row.value.value.lines?.some(line => sourceIds.has(line.sourceId))).map(row => row.value.value), materialUses = process.filter(row => row.value.path === 'materialUses' && handIds.has(row.value.value.stenterHandfeelOrderId)).map(row => row.value.value)
        const value = { qc, hands, sources, receipts, materialUses, sourceOrders: process.filter(row => row.value.path === 'state.workOrders' && row.value.key === sourceId).map(row => row.value.value), sharedDrafts: process.filter(row => row.value.path === 'state.workOrders').flatMap(row => row.value.value.dispatchDocuments || []).filter(doc => doc.id === 'SJ-DEMO-20260911-001'), qcRolls: rows.filter(row => row.collection === QC && row.value.kind === 'roll' && qcIds.has(row.value.qcId)).map(row => row.value.data), handfeelQc: rows.filter(row => row.collection === QC && row.value.kind === 'qc' && row.value.data.source.kind === 'STENTER_HAND_FEEL' && handIds.has(row.value.data.source.id)).map(row => row.value.data), actions: rows.filter(row => row.collection === QC && row.value.kind === 'action' && (handIds.has(row.value.data.orderId) || qcIds.has(row.value.data.qcId))).map(row => row.value.data) }
        window.__sourceInternalSnapshot = value; resolve(value)
      }; tx.onabort = () => reject(tx.error)
    }) } finally { db.close() }
  }, { sourceId, QC, HAND, PROCESS })
}
let quantityReadExport
async function internalQuantities(page, sourceId) {
  if (!quantityReadExport) {
    const candidates = []
    for (const path of Object.keys(assetManifest).filter(path => path.endsWith('.js'))) {
      const code = await readFile(path, 'utf8'); if (!code.includes('handfeelSent:') || !code.includes('nativeHanded:')) continue
      const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      for (const node of file.statements) if (ts.isFunctionDeclaration(node) && node.name && node.body && ['handfeelSent:', 'nativeHanded:', 'availableOutput:', 'pendingReceiptQty:'].every(text => node.body.getText(file).includes(text))) {
        for (const statement of file.statements.filter(ts.isExportDeclaration)) if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const entry of statement.exportClause.elements) if ((entry.propertyName || entry.name).text === node.name.text) candidates.push({ path: '/' + path.replace(/^dist\//, ''), exportedName: entry.name.text, sha256: assetManifest[path] })
      }
    }
    assert.equal(candidates.length, 1, 'AST须唯一识别生产资产的既有getDyeingQuantityFacts公共只读导出'); quantityReadExport = candidates[0]
  }
  return page.evaluate(async ({ entry, sourceId }) => {
    const module = await import(entry.path), before = window.__sourceTransactions.length, value = module[entry.exportedName]().find(row => row.order.dyeOrderId === sourceId)
    if (!value) throw new Error('真实来源数量投影不可读')
    if (window.__sourceTransactions.length !== before) throw new Error('只读数量核对不得产生持久写入')
    const { packed, handed, downstreamReceived, nativeHanded, nativeDownstreamReceived, handfeelSent, handfeelReceived, pendingReceiptQty, availableOutput, handfeelTransfers } = value
    return { entry, packed, handed, downstreamReceived, nativeHanded, nativeDownstreamReceived, handfeelSent, handfeelReceived, pendingReceiptQty, availableOutput, handfeelTransfers, sourceUnit: value.order.qtyUnit, readOnly: true }
  }, { entry: quantityReadExport, sourceId })
}
function internalFacts(state, stage, sourceId, expectedRolls, position) {
  assert.equal(state.qc.length, 1); assert.equal(state.hands.length, 1)
  const order = state.hands[0], source = state.sourceOrders[0], qty = expectedRolls.reduce((sum, roll) => sum + roll.inputQty, 0), codes = expectedRolls.map(roll => roll.barcode).sort(), toSources = state.sources.filter(source => source.lines.some(line => line.handfeelDirection === 'TO_HANDFEEL')), toIds = new Set(toSources.map(source => source.id)), toReceipts = state.receipts.filter(receipt => receipt.lines.some(line => toIds.has(line.sourceId)))
  assert.equal(order.factoryId, 'ID-F003'); assert.equal(order.source.factoryId, 'ID-F003'); assert.equal(order.source.id, sourceId); assert.equal(order.source.target.factoryId, 'F090'); assert.equal(order.rolls.length, 6); assert.equal(qty, 360); assert.ok(order.rolls.every(roll => roll.unit === 'Yard'))
  assert.ok(state.qcRolls.length === 6 && state.qcRolls.every(roll => !roll.completedAt && roll.photos.length === 0 && Object.values(roll.results).every(result => !result)), '内部实物流转不得以QC照片/检查完成作前置')
  assert.ok(state.sharedDrafts.length && state.sharedDrafts.every(doc => doc.status === '已作废' && doc.lines.length === 2), '真实作废共享草稿必须保留两来源明细')
  assert.ok(source && source.outputRolls.length === 6); assert.equal(source.outputRolls.reduce((sum, roll) => sum + roll.qty, 0), qty)
  const originalDocuments = source.dispatchDocuments || []; assert.ok(originalDocuments.every(doc => doc.status !== '已交出'), '内部转入不得伪造原染色外厂运输交出单')
  if (stage === 'create') {
    assert.equal(toSources.length, 0); assert.equal(toReceipts.length, 0); assert.equal(state.materialUses.length, 0)
    assert.ok(order.rolls.every(roll => !roll.sentAt && !roll.receivedAt && !roll.startedAt && !roll.completedAt && !roll.handedOutAt && !roll.downstreamReceivedAt)); assert.ok(source.outputRolls.every(roll => !roll.dispatchId))
  } else {
    assert.equal(toSources.length, 1, '一次内部移交必须形成唯一实际移交来源'); const transfer = toSources[0]
    assert.equal(transfer.type, 'HANDOUT', '共用接收底层HANDOUT是移交身份，不代表跨厂运输'); assert.equal(transfer.origin.id, 'ID-F003'); assert.equal(transfer.targetFactoryId, 'ID-F003'); assert.equal(transfer.processCode, 'STENTER_HANDFEEL'); assert.ok(transfer.handedOutAt)
    assert.ok(!['driver', 'vehicle', 'plate', 'transport', 'transportInfo'].some(key => Object.hasOwn(transfer, key)), '内部移交不虚构运输事实')
    assert.equal(transfer.lines.length, 1); const line = transfer.lines[0]; assert.equal(line.stenterHandfeelOrderId, order.id); assert.equal(line.handfeelDirection, 'TO_HANDFEEL'); assert.equal(line.unit, 'Yard'); assert.equal(line.sentQty, qty); assert.deepEqual(line.rolls.map(roll => roll.barcode).sort(), codes)
    assert.ok(source.outputRolls.every(roll => roll.dispatchId === transfer.id), '只有实际内部转入才扣原阶段可交库存'); assert.ok(order.rolls.every(roll => roll.sentAt))
    if (stage === 'send') { assert.equal(toReceipts.length, 0); assert.ok(order.rolls.every(roll => !roll.receivedAt)); assert.equal(state.materialUses.length, 0) }
    if (stage === 'receive') {
      assert.equal(toReceipts.length, 1, '同厂实际接收只生成一份真实接收记录，不双记库存'); const receipt = toReceipts[0]
      assert.equal(receipt.factoryId, 'ID-F003'); assert.equal(receipt.lines.length, 1); const received = receipt.lines[0]
      assert.equal(received.stenterHandfeelOrderId, order.id); assert.equal(received.handfeelDirection, 'TO_HANDFEEL'); assert.equal(received.unit, 'Yard'); assert.equal(received.qty, qty); assert.equal(received.businessQty, qty); assert.equal(received.warehouseId, position.warehouseId); assert.equal(received.locationId, position.locationId)
      assert.deepEqual(received.rolls.map(roll => roll.barcode).sort(), codes); assert.equal(new Set(received.rolls.map(roll => roll.barcode)).size, 6)
      for (const roll of order.rolls) { assert.equal(roll.receivedQty, roll.inputQty); assert.equal(roll.warehouseId, position.warehouseId); assert.equal(roll.locationId, position.locationId); assert.ok(roll.receivedAt && !roll.startedAt) }
      assert.equal(state.materialUses.length, 0, '内部接收不能同时假记投入')
    }
  }
  return { sameFactoryInternalHandover: true, sourceFactoryId: order.source.factoryId, processingFactoryId: order.factoryId, downstreamFactoryId: order.source.target.factoryId, actualInputQty: qty, originalBarcodes: codes, sourceRollIds: order.rolls.map(roll => roll.sourceRollId), unit: 'Yard', actualTransferRecords: toSources.length, actualReceiptRecords: toReceipts.length, noSyntheticTransport: true, qcUnfinishedAndNoPhotos: true }
}
async function internalMeasured(page, f, iteration, phase, selector, action, verify, root) {
  await arm(page, selector); await action(); const { state, checks } = await verify(), quantities = await internalQuantities(page, f.sourceId)
  const expected = phase === 'internal-create' ? { handfeelSent: 0, handfeelReceived: 0, availableOutput: 360, pendingReceiptQty: 0 } : phase === 'internal-send' ? { handfeelSent: 360, handfeelReceived: 0, availableOutput: 0, pendingReceiptQty: 360 } : { handfeelSent: 360, handfeelReceived: 360, availableOutput: 0, pendingReceiptQty: 0 }
  for (const [key, value] of Object.entries(expected)) assert.equal(quantities[key], value, '真实来源阶段数量守恒：' + key)
  assert.equal(quantities.nativeHanded, 0, '内部转入不能伪造原PDA交出事实'); assert.equal(quantities.nativeDownstreamReceived, 0)
  const handId = state.hands[0].id, trace = await page.evaluate(({ HAND, QC, PROCESS, handId, sourceId, phase }) => {
    const start = window.__sourceEventStart, transactions = window.__sourceTransactions.filter(tx => tx.at >= start && tx.status === 'complete' && tx.puts.some(put => put.collection === HAND && put.qcId === handId) && tx.puts.some(put => put.collection === QC && put.kind === 'action') && (phase === 'internal-create' ? tx.puts.some(put => put.collection === QC && put.kind === 'qc' && put.sourceId === sourceId) : phase === 'internal-send' ? tx.puts.some(put => put.collection === PROCESS && put.path === 'sources' && put.key.startsWith('SHF-TRANSFER-')) && tx.puts.some(put => put.collection === PROCESS && put.path === 'state.workOrders' && put.key === sourceId) : tx.puts.some(put => put.collection === PROCESS && put.path === 'receipts' && put.key.startsWith('SHF-RECEIPT-'))))
    return { start, transactions }
  }, { HAND, QC, PROCESS, handId, sourceId: f.sourceId, phase })
  assert.ok(Number.isFinite(trace.start) && trace.transactions.length, '内部单据与必要实物/操作事实必须同事务complete')
  const painted = await paint(page, root), durationMs = painted.end - trace.start, sample = { family: f.id, phase, requirement: f.requirement, iteration, sourceKind: f.sourceKind, sourceId: f.sourceId, route: page.url(), action: selector, fixtureVersion: 'actual-gtg-six-roll-ui-internal-transfer-v1', cacheState: '独立context；合法实际UI前置/当前页面已加载', start: trace.start, end: painted.end, durationMs, result: durationMs <= thresholdMs ? 'passed' : 'slow', valid: true, endpoint: f.endpoint, endpointChecks: { ...checks, quantities, committedSameTransaction: trace.transactions, actualPageUpdated: true, images: painted.imageCount }, readback: state, assetVersion, collectorVersion: report.collectorVersion, HEAD: report.HEAD, viewport }
  report.samples.push(sample); console.log(JSON.stringify({ family: f.id, phase, iteration, durationMs, result: sample.result })); await persist(); return state.hands[0]
}
async function internalLogin(page, factoryId, returnTo, logout = false) {
  if (logout) { await page.locator('[data-pda-shell-action="open-account-modal"]').click(); await page.locator('[data-pda-shell-action="request-logout"]').click(); await page.locator('[data-pda-shell-action="confirm-logout"]').click(); await page.locator('[data-pda-login-field="loginId"]').waitFor() }
  await navigate(page, '/fcs/pda/auth/login?returnTo=' + encodeURIComponent(returnTo), '[data-pda-login-field="loginId"]'); await page.locator('[data-pda-login-field="loginId"]').fill(factoryId + '_admin'); await page.locator('[data-pda-login-field="password"]').fill('123456'); await page.locator('[data-pda-login-action="submit"]').click(); await page.locator('[data-stenter-detail-root]').waitFor()
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('fcs_pda_session'))); assert.equal(session.factoryId, factoryId); return session
}
async function internalExecution(page, f, iteration, action, order, measuredPhase) {
  const button = `[data-stenter-handfeel-action="${action}"]`; if (action === 'send') assert.equal(await page.locator(button).first().innerText(), 'GTG内部转入')
  await page.locator(button).first().click(); const dialog = page.locator('[data-stenter-dialog]'); await dialog.waitFor(); if (action === 'send') assert.equal(await dialog.locator('h2').innerText(), 'GTG内部转入')
  if (['send', 'receive', 'handout'].includes(action)) for (const roll of order.rolls) { await dialog.locator('[data-stenter-scan]').fill(action === 'handout' ? roll.outputBarcode : roll.barcode); await dialog.locator('[data-stenter-dialog-action="scan"]').click() }
  else for (const input of await dialog.locator('[data-stenter-selected-roll]').all()) await input.check()
  let position
  if (['receive', 'downstream-receive'].includes(action)) { const value = await dialog.locator('[data-stenter-position] option').nth(1).getAttribute('value'); assert.ok(value); const [warehouseId, locationId] = value.split('|'); position = { warehouseId, locationId }; await dialog.locator('[data-stenter-position]').selectOption(value) }
  for (const [index, roll] of order.rolls.entries()) {
    if (['receive', 'output', 'downstream-receive'].includes(action)) await dialog.locator(`[data-stenter-quantity="${roll.id}"]`).fill(String(action === 'receive' ? roll.inputQty : action === 'output' ? roll.receivedQty : roll.outputQty))
    if (action === 'output') await dialog.locator(`[data-stenter-output-code="${roll.id}"]`).fill(`GTG-INTERNAL-UI-${iteration}-${index + 1}`)
  }
  const submit = '[data-stenter-dialog-action="submit"]', verify = async () => {
    await page.waitForFunction(() => !document.querySelector('[data-stenter-dialog]') || !!document.querySelector('[data-stenter-dialog-error]')?.textContent?.trim())
    const error = await page.evaluate(() => document.querySelector('[data-stenter-dialog-error]')?.textContent?.trim() || '')
    assert.equal(error, '', '真实内部操作失败：' + error); await dialog.waitFor({ state: 'detached' })
    const state = await internalState(page, f.sourceId), hand = state.hands[0], field = { send: 'sentAt', receive: 'receivedAt', start: 'startedAt', output: 'completedAt', handout: 'handedOutAt', 'downstream-receive': 'downstreamReceivedAt' }[action]
    assert.ok(hand.rolls.every(roll => !!roll[field]), '真实内部链逐卷事实：' + action)
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('fcs_pda_session'))); assert.ok(state.actions.some(row => row.orderId === hand.id && row.kind === action.toUpperCase().replace('-', '_') && row.by === session.userName))
    const checks = measuredPhase ? internalFacts(state, action, f.sourceId, order.rolls, position) : { action, actualFactory: session.factoryId, position }
    if (action === 'receive') { assert.match(await page.locator('[data-stenter-detail-part="summary"]').innerText(), /待投入/); assert.match(await page.locator('[data-stenter-detail-part="rolls"]').innerText(), /内部转入GTG/) }
    if (action === 'output') { assert.equal(state.handfeelQc.length, 1); assert.ok(!hand.completedAt); assert.ok(!state.handfeelQc[0].decision); assert.equal(state.hands.length, 1, '手感来源QC不能递归新建手感单') }
    return { state, checks }
  }
  if (measuredPhase) return internalMeasured(page, f, iteration, measuredPhase, submit, () => dialog.locator(submit).click(), verify, '[data-stenter-detail-root]')
  await dialog.locator(submit).click(); const { state, checks } = await verify(); await paint(page, '[data-stenter-detail-root]'); return { order: state.hands[0], state, checks }
}
async function gtgInternal(page, f, iteration) {
  const open = `[data-dyeing-action="recipient-open"][data-dye-order-id="${f.sourceId}"]`, draftId = 'SJ-DEMO-20260911-001'
  await navigate(page, f.route, open); assert.ok(await page.locator(open).isDisabled(), '共享草稿仍占用时不能改接收方')
  await navigate(page, '/fcs/craft/dyeing/handover-documents', '[data-dye-output-page]'); await page.locator(`[data-dye-output-action="detail"][data-id="${draftId}"]`).first().click(); page.once('dialog', dialog => dialog.accept()); await page.locator(`[data-dye-output-action="void"][data-id="${draftId}"]`).click(); await page.getByText('单据已作废，所选卷已释放。', { exact: true }).waitFor()
  const released = await internalState(page, f.sourceId); assert.ok(released.sharedDrafts.length && released.sharedDrafts.every(doc => doc.status === '已作废' && doc.lines.length === 2)); assert.deepEqual(new Set(released.sharedDrafts[0].lines.map(line => line.orderId)), new Set(['DYE-DISPATCH-DEMO-1', 'DYE-DISPATCH-DEMO-2']))
  await navigate(page, f.route, open); await page.locator(open).click(); await page.locator('[data-dye-recipient-target]').selectOption('FACTORY:F090'); await page.locator('[data-dye-recipient-reason]').fill('固定资产GTG内部转入校准：实际下游调整为F090，保留原GTG产出。'); await page.locator('[data-dyeing-action="recipient-save"]').click(); await page.locator('[data-dye-recipient-target]').waitFor({ state: 'detached' }); await page.locator('[data-dye-recipient-summary]').getByText(/全能力测试工厂|测试专用工厂/).first().waitFor()
  const prepared = await internalState(page, f.sourceId); assert.equal(prepared.qc.length, 1); assert.equal(prepared.hands.length, 0); assert.equal(prepared.qc[0].source.factoryId, 'ID-F003')
  await navigate(page, '/fcs/craft/dyeing/qc-orders/' + encodeURIComponent(prepared.qc[0].id), '[data-factory-qc-field="needs"]')
  // Resolve the existing production read export before a measured UI event;
  // filesystem/AST discovery is collector setup, never product response time.
  const priorQuantities = await internalQuantities(page, f.sourceId); assert.equal(priorQuantities.availableOutput, 360); assert.equal(priorQuantities.handfeelSent, 0)
  await page.locator('[data-factory-qc-field="needs"]').selectOption('yes'); await page.locator('[data-factory-qc-field="target"]').selectOption('柔软手感')
  let hand = await internalMeasured(page, f, iteration, 'internal-create', '[data-factory-qc-action="decide"]', () => page.locator('[data-factory-qc-action="decide"]').click(), async () => {
    await page.getByRole('link', { name: '查看定型机手感单' }).waitFor(); const state = await internalState(page, f.sourceId), expected = state.hands[0].rolls; const checks = internalFacts(state, 'create', f.sourceId, expected); assert.ok(state.qc[0].decision.needs); assert.equal(state.qc[0].decision.orderId, state.hands[0].id); return { state, checks }
  }, '[data-factory-qc-root]')
  const detailPath = '/fcs/pda/stenter-handfeel/' + encodeURIComponent(hand.id), session = await internalLogin(page, 'ID-F003', detailPath); assert.match(await page.locator('[data-stenter-detail-part="summary"]').innerText(), /待内部转入/)
  hand = await internalExecution(page, f, iteration, 'send', hand, 'internal-send'); hand = await internalExecution(page, f, iteration, 'receive', hand, 'internal-receive')
  const received = await internalState(page, f.sourceId), adjacent = []
  for (const action of ['start', 'output', 'handout']) { const result = await internalExecution(page, f, iteration, action, hand); hand = result.order; adjacent.push({ action, checks: result.checks, state: result.state }) }
  await internalLogin(page, 'F090', detailPath, true); const result = await internalExecution(page, f, iteration, 'downstream-receive', hand); hand = result.order; adjacent.push({ action: 'downstream-receive', checks: result.checks, state: result.state })
  const final = result.state, toSources = final.sources.filter(source => source.lines.some(line => line.handfeelDirection === 'TO_HANDFEEL')), afterSources = final.sources.filter(source => source.lines.some(line => line.handfeelDirection === 'AFTER_HANDFEEL'))
  assert.equal(toSources.length, 1); assert.equal(afterSources.length, 1); assert.equal(afterSources[0].origin.id, 'ID-F003'); assert.equal(afterSources[0].targetFactoryId, 'F090'); assert.equal(final.receipts.length, 2); assert.equal(final.materialUses.length, 1); assert.equal(final.materialUses[0].lines.length, 6)
  const downstream = final.receipts.find(receipt => receipt.factoryId === 'F090'); assert.ok(downstream); assert.equal(downstream.lines.length, 1); assert.equal(downstream.lines[0].qty, 360); assert.equal(downstream.lines[0].unit, 'Yard'); assert.deepEqual(downstream.lines[0].rolls.map(roll => roll.barcode).sort(), hand.rolls.map(roll => roll.outputBarcode).sort()); assert.ok(hand.rolls.every(roll => roll.downstreamQty === roll.outputQty && roll.outputQty === roll.receivedQty)); assert.equal(final.hands.length, 1); assert.equal(final.handfeelQc.length, 1)
  const finalQuantities = await internalQuantities(page, f.sourceId); assert.equal(finalQuantities.handfeelSent, 360); assert.equal(finalQuantities.handfeelReceived, 360); assert.equal(finalQuantities.availableOutput, 0); assert.equal(finalQuantities.nativeHanded, 0)
  await navigate(page, detailPath, '[data-stenter-detail-root]'); const cold = await internalState(page, f.sourceId); assert.deepEqual(cold.hands[0].rolls, hand.rolls); assert.equal(cold.receipts.length, 2); assert.equal(cold.hands.length, 1)
  report.internalTransfers.push({ iteration, preparation: { realUiVoid: true, sharedDrafts: released.sharedDrafts, originalLinesRetained: released.sharedDrafts[0].lines.map(line => ({ orderId: line.orderId, rollIds: line.rolls.map(roll => roll.id) })), actualRecipientChangedTo: 'F090' }, realGtgSession: { factoryId: session.factoryId, userName: session.userName }, internalReceived: received, adjacentFunctionalContracts: adjacent, cold, finalQuantities, boundary: '仅internal-create/send/receive三阶段分别计性能。START/OUTPUT/HANDOUT/真实F090接收为同执行器相邻业务合同；无注入来源/QC/收发库存；内部底层HANDOUT同时以origin==target GTG与TO_HANDFEEL身份表达。' })
}
const implementations = { 'printing-first-final-output': printing, 'dyeing-final-pack': dyeing, 'water-soluble-final-output': water, 'completed-dye-target-backfill': backfill, 'dyeing-pack-barcode-maintenance': barcodeMaintenance, 'gtg-internal-transfer': gtgInternal }
try {
  for (const f of selected) for (let iteration = 1; iteration <= trials; iteration++) {
    const ctx = await context(), page = await ctx.newPage(), errorsBefore = report.browserErrors.length
    try {
      await implementations[f.id](page, f, iteration)
      assert.equal(report.browserErrors.length, errorsBefore, '来源动作不能出现未处理浏览器异常')
      assert.equal(report.requests.filter(row => row.forbidden).length, 0, '固定资产验证禁止加载开发源码')
      await page.screenshot({ path: join(output, `${f.id}-${iteration}-endpoint.png`), fullPage: true })
    } catch (error) {
      if (packReadDiagnostic) report.packPersistenceDiagnostic = await packPersistenceDiagnostic(page, f).catch(error => ({ diagnosticFailed: String(error) }))
      const failure = { family: f.id, iteration, error: error.stack || String(error), route: page.url(), at: new Date().toISOString(), body: (await page.locator('body').innerText().catch(() => '')).slice(-12000), persistedReadback: await readState(page, f.sourceKind, f.sourceId).catch(error => ({ readError: String(error) })), diagnostics: await page.evaluate(() => ({ endpointReadback: window.__sourceEndpointSnapshot, transactions: window.__sourceTransactions, missingFiles: window.__sourceMissingFiles, recipientError: document.querySelector('[data-dye-recipient-error]')?.textContent })).catch(() => undefined) }
      report.failures.push(failure)
      for (const sample of report.samples.filter(row => row.family === f.id && row.iteration === iteration)) { sample.valid = false; sample.result = 'failed'; sample.error = failure.error }
      console.log(JSON.stringify({ family: f.id, iteration, failed: failure.error }))
      await page.screenshot({ path: join(output, `${f.id}-${iteration}-failure.png`), fullPage: true }).catch(() => undefined)
    } finally { await ctx.close(); await persist() }
    if (report.failures.length) break
  }
} finally {
  await browser.close(); report.finishedAt = new Date().toISOString(); report.assetManifestAfter = await manifest(); report.assetsStable = JSON.stringify(report.assetManifestAfter) === JSON.stringify(assetManifest)
  report.summary = selected.map(f => { const expected = trials * (f.phases?.length || 1), samples = report.samples.filter(row => row.family === f.id && row.valid), times = samples.map(row => row.durationMs).sort((a, b) => a - b); return { family: f.id, expected, valid: samples.length, maximumMs: times.at(-1) ?? null, allWithinThreshold: samples.length === expected && times.every(ms => ms <= thresholdMs), slow: samples.filter(row => row.result === 'slow').length } })
  report.phaseSummary = selected.flatMap(f => (f.phases || ['source-trigger']).map(phase => { const samples = report.samples.filter(s => s.family === f.id && s.phase === phase && s.valid); return { family: f.id, phase, expected: trials, valid: samples.length, maximumMs: samples.length ? Math.max(...samples.map(s => s.durationMs)) : null, allWithinThreshold: samples.length === trials && samples.every(s => s.durationMs <= thresholdMs) } }))
  report.status = !report.failures.length && !report.browserErrors.length && report.assetsStable && report.summary.every(row => row.allWithinThreshold) && report.phaseSummary.every(row => row.allWithinThreshold) ? 'passed' : 'failed'
  await persist(); console.log(JSON.stringify({ output, status: report.status, assetsStable: report.assetsStable, summary: report.summary, failures: report.failures.length })); process.exitCode = report.status === 'passed' ? 0 : 1
}
