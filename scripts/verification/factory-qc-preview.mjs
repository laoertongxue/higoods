#!/usr/bin/env node
/** Fixed-build, isolated-browser UI/performance/PDF verification. No source imports in the browser. */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { resolve, dirname, join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { platform, release, cpus } from 'node:os'
import { chromium } from 'playwright'

const argument = key => { const at = process.argv.indexOf(key); return at < 0 ? undefined : process.argv[at + 1] }
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const baseURL = argument('--base-url') || 'http://127.0.0.1:43222'
const output = resolve(argument('--output') || `output/playwright/factory-qc-preview/${runId}`)
const calibration = process.argv.includes('--calibration')
const trials = Number(argument('--trials') || (calibration ? 1 : 5))
const skipPda = process.argv.includes('--skip-pda')
const onlyPda = process.argv.includes('--only-pda')
const cpuDiagnostic = process.argv.includes('--cpu-diagnostic')
assert.ok(!cpuDiagnostic || calibration && onlyPda, 'CPU诊断只允许显式校准PDA分支，不计为验收样本')
assert.ok(!onlyPda || calibration, '--only-pda仅供新分支校准，不允许省略正式家族')
assert.ok(!(skipPda && onlyPda), '校准分支选择不能相互冲突')
assert.ok(!skipPda || calibration, '--skip-pda仅供校准，不允许省略正式家族')
const maxMs = 1000
const python = argument('--python') || '/Users/laoer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
const viewport = { width: 1366, height: 768 }
const LIST = '/fcs/craft/printing/qc-orders', DYE_LIST = '/fcs/craft/dyeing/qc-orders'
const QC = 'fcs.factory-qc.v1', HAND = 'fcs.stenter-handfeel.v1', PROCESS = 'fcs.factory-qc.process-records.v1'
const family = (id, pf, variant, endpoint, ac, notes = '') => ({ id, pf, variant, endpoint, ac, notes, plannedSamples: trials })
const families = [
  family('print-list-cold', 'PF-01', '印花QC新context冷入口', '来源、统计、全部必要图可用', 'AC-042/043/045'),
  family('dye-list-cold', 'PF-01', '染厂QC新context冷入口', '按原生最终状态展示的染厂来源、卷计数及图可用', 'AC-042/043/045'),
  family('print-list-refresh', 'PF-01', '印花QC整页刷新', '新页面完成读取和图片解码', 'AC-033/045'),
  family('qc-detail-nav', 'PF-01', '同列进度进入QC详情', '正确QC及卷列表/来源图可用', 'AC-012/045'),
  family('qc-detail-refresh', 'PF-01', 'QC已存附件详情刷新', '照片Blob及三结果可读，页面图可用', 'AC-033/045'),
  family('stenter-detail-nav', 'PF-01', '关联手感单站内进入', '同来源、GTG、目标待补及实际卷可用', 'AC-022/045'),
  family('stenter-detail-refresh', 'PF-01', '手感详情刷新', '持久卷状态和来源图可用', 'AC-033/045'),
  family('stenter-list-nav', 'PF-01', '手感详情返回列表', '真实新建单/状态/统计可用', 'AC-028/045'),
  family('pda-login-gate-cold', 'PF-01', '390px无会话PDA直达', '既有工厂登录限制可见且无越权动作', 'AC-043/045', '仅登录守卫，不代替已登录PDA执行'),
  family('qc-query', 'PF-02', 'QC查询无结果', '行数/统计/分页一致', 'AC-012/045', '染厂默认张数与来源按原生最终事实动态登记，不预填4张'),
  family('qc-reset', 'PF-02', 'QC重置', '完整默认结果/统计/分页恢复', 'AC-012/045'),
  family('qc-columns-open', 'PF-02', 'QC打开列设置', '设置可交互且原根节点保留', 'AC-044/045'),
  family('qc-columns-close', 'PF-02', 'QC关闭列设置', '设置关闭且焦点回列设置', 'AC-044/045'),
  family('stenter-query', 'PF-02', '手感列表查询', '目标真实单和统计一致', 'AC-028/045'),
  family('stenter-reset', 'PF-02', '手感列表重置', '默认手感列表恢复', 'AC-028/045'),
  family('roll-editor-open', 'PF-03', '打开单卷检查', '正确卷/参考图/检查项可用', 'AC-009/010/045'),
  family('qc-image-open', 'PF-03', 'QC原图放大', '大图已解码并具有关闭动作', 'AC-042/045'),
  family('qc-image-close', 'PF-03', 'QC关闭大图', '遮罩关闭且焦点回原按钮', 'AC-042/045'),
  family('stenter-image-open', 'PF-03', '手感原图放大', '实际对应图解码可用', 'AC-042/045'),
  family('stenter-image-close', 'PF-03', '手感Esc关闭大图', '关闭并恢复原图焦点', 'AC-042/045'),
  family('execute-dialog-open', 'PF-03', '手感接收弹窗', '真实可操作卷/库位/扫码字段可用', 'AC-022/045'),
  family('execute-dialog-cancel', 'PF-03', '未填写执行弹窗取消', '无业务修改，弹窗移除/焦点归位', 'AC-044/045'),
  family('missing-complete', 'PF-04', '缺照片/三结果的完成拒绝', '真实必填提示且未创建质检完成事实', 'AC-009/011/045'),
  family('multi-photo-select', 'PF-04', '两张同名原始照片选取', '两个独立预览解码；尚未保存', 'AC-010/045'),
  family('single-photo-select', 'PF-04', '第二卷一张原始照片选取', '对应本卷独立预览解码', 'AC-010/045'),
  family('new-photo-save', 'PF-04', '新Blob正常保存未完成', '照片/三结果/说明持久可读，仍未完成', 'AC-033/045'),
  family('roll-complete', 'PF-04', '有差异结果完成本卷', '持久完成锁、进度和只读页面一致', 'AC-011/045'),
  family('save-abort', 'PF-04', '一次真实IDB事务中止', '失败有提示/输入保留/无半套数据', 'AC-035/045'),
  family('stenter-auto-qc', 'PF-05', '真实手感最终产出自动QC', '手感实际产出与对应染厂QC同事务持久可读', 'AC-001/026/045', '复用同次PF07 OUTPUT完整终点，不另造事件'),
  family('needs-no-target', 'PF-06', '整单需要但目标暂缺', '唯一GTG单关联持久成功，无假交出/实收', 'AC-017/019/045'),
  family('target-supplement', 'PF-06', '在手感单补固定目标', '目标要求持久，来源QC目标展示一致', 'AC-016/045'),
  family('no-handfeel', 'PF-06', '第二来源整单无需处理', '决定持久且该来源不建手感单', 'AC-015/045'),
  ...['send', 'receive', 'start', 'output', 'handout', 'downstream-receive', 'complete'].map(action => family(`execute-${action}`, 'PF-07', `真实Web实物操作:${action}`, '相关卷/交接/实际数量持久可读且下一动作正确', 'AC-022/025/027/045')),
  family('order-preview', 'PF-08', '手感加工单预览', '打印动作持久且图片/来源/数量可用', 'AC-028/030/042/045'),
  family('order-pdf', 'PF-08', '实际加工单PDF生成', '产品打印文档生成真实可读PDF文件', 'AC-030/042/045'),
  family('labels-preview', 'PF-08', '产出卷标预览', '真实产出卷码/条码/图片可用', 'AC-028/030/042/045'),
  family('labels-pdf', 'PF-08', '实际产出卷标PDF生成', '产品打印文档生成真实可读PDF文件', 'AC-030/042/045'),
  family('legacy-cleanup', 'PF-09', '一次旧版定向删除及共享引用保留', '旧记录/独占附件退役、共享原事实/附件保留，随后失败QC不半套保存', 'AC-039/040/045', '复用首次真实保存事件完整失败终点：旧资料定向清理已提交，随后QC与照片事务受控中止；两事实明确区分'),
  ...[
    ['pda-list-auth-cold', '已登录 PDA 列表冷入口'], ['pda-detail-auth-nav', '已登录 PDA 详情站内进入'], ['pda-detail-auth-refresh', '已登录 PDA 详情刷新'],
  ].map(([id, label]) => family(id, 'PF-01', label, '真实工厂会话/责任动作/卷及对应图可用', 'AC-022/033/043/045')),
  ...['send', 'receive', 'start', 'output', 'handout', 'downstream-receive', 'complete'].map(action => family(`pda-execute-${action}`, 'PF-07', `390px已登录PDA现场动作:${action}（原型UI）`, '实物/实际数量/责任工厂/操作记录同库持久，下一动作可用', 'AC-022/025/027/043/045')),
  ...[['warehouse-source-after-send', '来源MJS交出后原待交出库存为0'], ['warehouse-gtg-after-receive', 'GTG实收后待加工库存为实际量且未用料'], ['warehouse-gtg-after-output', 'GTG产出后待交出实际卷与数量']].map(([id, label]) => family(id, 'PF-02', label, '命名Web库存页真实工厂/SKU查询完成、对应卷码/实际数/图与持久事实一致', 'AC-022/025/033/042/045', '导航就绪和查询起点分别记录；不把URL factoryId误称为已过滤')),
  family('warehouse-downstream-after-receive', 'PF-01', 'F090实收后390px既有PDA手感待加工入口', '真实F090会话下本单实际数量/原卷关联/输出码/图完整且持久一致', 'AC-022/025/033/042/043/045'),
  family('pda-execute-continue', 'PF-07', 'GTG已人工完单后明确继续新增卷', '原COMPLETE动作与原卷事实保留，实际CONTINUE动作持久，当前completedAt清空，同单同决定', 'AC-007/022/027/043/045', '显式后补卷状态夹具，不冒称自动补批来源'),
  family('pda-quantity-difference-reject', 'PF-07', 'PDA实际数量差异未核对拒绝', '无实收事实，差异提示和输入保留；随后明确核对再保存', 'AC-025/043/045'),
  family('pda-wrong-factory-action-hidden', 'PF-07', '来源厂已交出后不代GTG实收', '真实来源厂会话只读，GTG实收动作不可用且无实收事实', 'AC-022/043/045'),
  ...['order-preview', 'order-pdf', 'labels-preview', 'labels-pdf'].map(action => family('scale30-' + action, 'PF-08', '显式合法30卷夹具:' + action, '固定产品文档真实PDF分页，30卷码/条码/数量和图片匹配，无裁切', 'AC-030/042/045', '隔离模型夹具；不冒称30卷自动来源链或现场分页接受')),
  family('qc-pagination', 'PF-02', '12张隔离QC列表下一页', '第二页行、总数、页码同步，完整图可用', 'AC-044/045'),
  family('qc-sort', 'PF-02', 'QC单号排序', '当前页顺序与排序控件一致', 'AC-044/045'),
  family('qc-column-visibility-freeze', 'PF-02', 'QC隐藏可选列并冻结必需列', '原根保留，实际表头和冻结位置响应', 'AC-044/045', '同一设置change处理器合并两次连续真实事件，从首change到两项完整终点'),
  family('stenter-pagination', 'PF-02', '12张隔离手感列表下一页', '第二页行、总数、页码同步，完整图可用', 'AC-028/044/045'),
  family('photo-replace', 'PF-04', '未完成卷替换原始Blob照片', '新引用/Blob持久、旧照片引用移除，其他照片保持', 'AC-010/033/045'),
  family('completed-stale-editor-reject', 'PF-04', '另一已打开编辑页在本卷完成后保存拒绝', '明确锁定提示，已完卷照片/说明/结果完全不变，页面切为只读', 'AC-011/034/045'),
  family('partial-handout-decision-only', 'PF-06', '来源已有部分实际交出后判断需要手感', '仅保存整单判断，零新增手感单，原实物事实保留', 'AC-018/045'),
  family('abort-retry', 'PF-10', '事务中止后真实UI重试', '相同输入成功持久，无重复记录/半套数据', 'AC-035/045'),
]
const config = { baseURL, output, trials, calibration, skipPda, onlyPda, maxMs, viewport, familyCount: families.length, plannedSamples: families.length * trials, families, scope: '固定生产资产；默认两卷自动来源链、真实六卷PDA链、显式30卷打印与12张列表夹具；真实UI及原生IndexedDB隔离验证，不代表现场接受', coverageSplit: { companionCollector: 'scripts/verification/factory-qc-source-preview.mjs', companionRequiredFamilies: ['印花首最终批次', '染色PACK最终批次', '独立水溶最终批次', '已完成染厂改非染厂补建QC'], companionEvidenceRequired: true }, fixtures: [{ id: 'default-ui-chain-v1', purpose: '默认真实两卷来源经QC UI建GTG并完整执行', sourceClaim: '自动创建链' }, { id: 'scale30-list12-v1', purpose: '30卷打印及12张列表分页', sourceClaim: '显式隔离合法模型夹具，不作自动创建链证据' }, { id: 'pda-real-factory-flow-v1', purpose: '真实工厂账号登录后的七动作/差异/责任校验', sourceClaim: '合法来源夹具经真实QC UI创建手感单' }], exclusions: ['未宣称现场照片、扫码硬件、真实权限后端或工厂现场接受', '未测几百卷/容量上限；本次规模打印为30卷', '不读取测试站数据库；浏览器不导入/src'] }
if (!process.argv.includes('--run')) { console.log(JSON.stringify({ prepared: true, executed: false, ...config }, null, 2)); process.exit(0) }
assert.ok(calibration || trials >= 5, '正式家族至少5个有效样本；校准须显式 --calibration')
await mkdir(output, { recursive: true })
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function assets() {
  const files = ['dist/index.html', ...(await readdir('dist/assets')).filter(file => /\.(js|css)$/.test(file)).map(file => 'dist/assets/' + file)]
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, digest(await readFile(file))])))
}
const manifestBefore = await assets(), assetVersion = digest(JSON.stringify(manifestBefore))
const report = { runId, ...config, diagnosticOnly: cpuDiagnostic, startedAt: new Date().toISOString(), HEAD: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), collectorVersion: digest(await readFile(new URL(import.meta.url))), assetVersion, assetManifest: manifestBefore, environment: { os: platform(), release: release(), cpu: cpus()[0]?.model }, samples: [], cases: [], pdfs: [], browserErrors: [], scale: [], status: 'running' }
const browser = await chromium.launch({ headless: true })
const byFamily = new Map(families.map(item => [item.id, item]))
async function persist() { await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2)) }
function record(id, iteration, timing, checks, extra = {}) {
  const spec = byFamily.get(id)
  assert.ok(spec, id)
  const durationMs = timing.end - timing.start
  assert.ok(Number.isFinite(durationMs) && durationMs >= 0, '采集起止点必须有效')
  const sample = { runId, recordedAt: new Date().toISOString(), AC: spec.ac, family: spec.pf, member: id, variant: spec.variant, iteration, sourceType: checks?.sourceType || null, sourceId: checks?.sourceId || null, rows: checks?.rows ?? null, rolls: checks?.rolls ?? checks?.rollCount ?? null, fileCount: 0, fileBytes: 0, fixtureVersion: checks?.fixtureVersion || 'default-final-output-plus-explicit-retirement-fixture-v1', viewport: extra.viewport || viewport, start: timing.start, end: timing.end, durationMs, endpointChecks: checks, result: durationMs <= maxMs ? 'passed' : 'slow', collectorVersion: report.collectorVersion, HEAD: report.HEAD, assetVersion, ...extra }
  report.samples.push(sample)
  console.log(JSON.stringify({ family: id, iteration, durationMs: Number(durationMs.toFixed(3)), result: sample.result }))
  return sample
}
async function paint(page, selector) {
  const check = await page.locator(selector).evaluate(async root => {
    await Promise.all([...root.querySelectorAll('img')].map(async img => { await img.decode(); if (!img.naturalWidth) throw new Error('必要图片未加载：' + img.alt) }))
    await document.fonts.ready
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { images: root.querySelectorAll('img').length, displayedImages: [...root.querySelectorAll('img')].map(img => ({ src: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight, resourceBytes: performance.getEntriesByName(img.currentSrc).at(-1)?.decodedBodySize ?? null })), readyAt: performance.now() }
  })
  return check
}
async function eventTimer(page, selector, eventType = 'click') {
  await page.evaluate(({ selector, eventType }) => {
    window.__qcPerfTimer = undefined
    const capture = event => { if (!(event.target instanceof Element) || !event.target.closest(selector)) return; window.__qcPerfTimer = { start: performance.now(), event: event.type, selector }; document.removeEventListener(eventType, capture, true) }
    document.addEventListener(eventType, capture, true)
  }, { selector, eventType })
}
async function measured(page, id, iteration, selector, action, verify, extra = {}) {
  await eventTimer(page, selector, extra.eventType || 'click')
  await action()
  const checked = await verify()
  const end = await page.evaluate(() => performance.now())
  const timer = await page.evaluate(() => window.__qcPerfTimer)
  assert.ok(timer, id + '没有真实UI事件起点')
  return record(id, iteration, { start: timer.start, end }, checked, { route: page.url(), action: selector, cacheState: 'existing-context', ...extra })
}
async function navigate(page, id, iteration, url, selector, reload = false, extra = {}, verify) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' }); else await page.goto(baseURL + url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(selector)
  const result = { ...await paint(page, selector), ...(verify ? await verify() : {}) }
  const timing = await page.evaluate(() => ({ start: performance.getEntriesByType('navigation')[0]?.startTime ?? 0, end: performance.now() }))
  const diagnostics = await page.evaluate(() => ({ resourceTimings: performance.getEntriesByType('resource').map(item => ({ name: item.name, startTime: item.startTime, responseEnd: item.responseEnd, duration: item.duration, transferSize: item.transferSize, encodedBodySize: item.encodedBodySize })), longTasks: window.__qcLongTasks || [] }))
  return record(id, iteration, timing, result, { ...diagnostics, route: page.url(), action: reload ? 'browser reload' : 'browser navigation', cacheState: reload ? 'refresh/same-context' : 'new-context/empty-browser-cache', ...extra })
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { return await new Promise((resolve, reject) => { const tx = db.transaction(['records', 'files'], 'readonly'), recordRequest = tx.objectStore('records').getAll(), fileRequest = tx.objectStore('files').getAll(); tx.oncomplete = () => resolve({ records: recordRequest.result, files: fileRequest.result.map(file => ({ id: file.id, size: file.blob.size, type: file.blob.type })) }); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
  })
}
const active = data => data.records.filter(row => !row.deleted)
const heads = data => active(data).filter(row => row.collection === QC && row.value.kind === 'qc')
const rolls = data => active(data).filter(row => row.collection === QC && row.value.kind === 'roll')
const hands = data => active(data).filter(row => row.collection === HAND && row.value.kind === 'handfeel')
async function seedRetiredVersionOnly(page) {
  await page.route('**/__qc-preview-old-fixture__', route => route.fulfill({ contentType: 'text/html', body: '<title>隔离旧版删除验证</title>' }))
  await page.goto(baseURL + '/__qc-preview-old-fixture__')
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records', 2); request.onupgradeneeded = () => { for (const name of ['records', 'files', 'operations', 'meta']) request.result.createObjectStore(name, { keyPath: 'id' }); request.transaction.objectStore('operations').createIndex('createdAt', 'createdAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const old = 'wash-file-preview-exclusive', shared = 'wash-file-preview-shared'
    const sharedRow = { path: 'deliveries', key: 'SHARED-PREVIEW-DELIVERY', tuple: false, legacyKey: 'higood-factory-material-receiving-v1', value: { id: 'SHARED-PREVIEW-DELIVERY', barcode: 'PREVIEW-LEGACY-DELIVERY', deliveredAt: '2026-10-21 09:00:00', createdBy: '隔离旧版资料夹具', lines: [{ id: 'KEEP-ORIGINAL', sourceId: 'RCV-SRC-006', sourceLineId: 'RCV-SRC-006-L1', qty: 12.345, unit: 'kg', rollBarcodes: [], fileId: shared }, { id: 'REMOVE-WASH', washingOrderId: 'WASH-PREVIEW-OLD', sourceId: 'WASH-OLD-SOURCE', sourceLineId: 'WASH-OLD-LINE', qty: 100, unit: 'kg', rollBarcodes: [], fileId: old }] } }
    await new Promise((resolve, reject) => { const tx = db.transaction(['records', 'files'], 'readwrite'); tx.objectStore('records').put({ id: 'fcs.fabric-washing.v1/order/WASH-PREVIEW-OLD', collection: 'fcs.fabric-washing.v1', version: 1, value: { kind: 'order', data: { id: 'WASH-PREVIEW-OLD', fileId: old } } }); tx.objectStore('records').put({ id: 'fcs.fabric-washing.process-records.v1/source/SHARED-PREVIEW-DELIVERY', collection: 'fcs.fabric-washing.process-records.v1', version: 1, value: sharedRow }); tx.objectStore('files').put({ id: old, blob: new Blob(['retired-exclusive'], { type: 'application/octet-stream' }) }); tx.objectStore('files').put({ id: shared, blob: new Blob(['shared-original'], { type: 'application/octet-stream' }) }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }); db.close()
  })
}
async function newContext(options = {}) {
  const context = await browser.newContext({ viewport, ...options })
  context.on('page', page => { page.on('pageerror', error => report.browserErrors.push({ at: new Date().toISOString(), url: page.url(), message: error.message })); page.on('console', message => { if (message.type() === 'error') report.browserErrors.push({ at: new Date().toISOString(), url: page.url(), message: message.text() }) }) })
  await context.addInitScript(() => { window.__qcLongTasks = []; try { new PerformanceObserver(list => window.__qcLongTasks.push(...list.getEntries().map(item => ({ startTime: item.startTime, duration: item.duration, name: item.name })))).observe({ type: 'longtask', buffered: true }) } catch {} ; window.print = () => { window.__qcPrintRequested = { at: performance.now(), html: document.documentElement.outerHTML }; if (window.parent !== window) window.parent.__qcPrintRequested = window.__qcPrintRequested } })
  return context
}
async function qcPhoto(page, count) {
  const reference = await page.locator('[data-factory-qc-editor] [data-image-url]').first().getAttribute('data-image-url')
  const localPath = resolve('public', new URL(reference, baseURL).pathname.slice(1))
  const bytes = await readFile(localPath), metadata = await stat(localPath)
  const extension = /\.jpe?g$/i.test(localPath) ? 'jpg' : /\.webp$/i.test(localPath) ? 'webp' : 'png', mimeType = extension === 'jpg' ? 'image/jpeg' : 'image/' + extension
  const payloads = Array.from({ length: count }, () => ({ name: '同名面料验证图片.' + extension, mimeType, buffer: bytes }))
  return { payloads, path: localPath, fileBytes: metadata.size * count, fileCount: count, sourceImage: reference, imageSha256: digest(bytes) }
}
async function fillResults(page) { for (const key of ['color', 'handfeel', 'material']) await page.locator(`[data-factory-qc-field="${key}"]`).selectOption(key === 'handfeel' ? '有差异' : '符合要求'); await page.locator('[data-factory-qc-field="notes"]').fill('固定预览隔离验收：实际手感偏硬，逐卷保留。') }
async function savedRoll(page, rollId, complete) {
  await page.waitForFunction(({ rollId, complete }) => {
    const editor = document.querySelector('[data-factory-qc-roll-editor]')
    if (editor?.getAttribute('data-factory-qc-roll-editor') !== rollId) return false
    if (complete) return editor.textContent.includes('记录只读')
    const button = editor.querySelector('[data-factory-qc-action="save-roll"]')
    return button && !button.disabled && editor.querySelector('[data-factory-qc-unsaved-state]')?.textContent === '未完成质检' && document.querySelector('[data-factory-qc-notice]')?.textContent === '本卷已保存，仍为未完成质检。'
  }, { rollId, complete })
  const data = await snapshot(page), roll = rolls(data).find(row => row.value.data.id === rollId)?.value.data
  assert.ok(roll, '目标卷必须持久可读')
  assert.equal(!!roll.completedAt, complete)
  assert.ok(roll.photos.length > 0 && Object.values(roll.results).every(Boolean))
  for (const photo of roll.photos) assert.ok(data.files.some(file => file.id === photo.id && file.size === photo.size), 'Blob与照片引用完整')
  await paint(page, '[data-factory-qc-root]')
  return { rollId, photos: roll.photos.length, completedAt: roll.completedAt || null, results: roll.results, blobBytes: roll.photos.reduce((n, photo) => n + photo.size, 0) }
}
async function execute(page, iteration, action, orderId, expected, extra = {}) {
  const { prefix = '', quantities, differenceConfirmed = false, ...sampleExtra } = extra
  const selector = `[data-stenter-handfeel-action="${action}"]`
  await page.locator(selector).first().click()
  const dialog = page.locator('[data-stenter-dialog]'); await dialog.waitFor()
  if (['send', 'receive', 'handout'].includes(action)) for (const roll of expected) { await dialog.locator('[data-stenter-scan]').fill(action === 'handout' ? roll.outputBarcode : roll.barcode); await dialog.locator('[data-stenter-dialog-action="scan"]').click() }
  else for (const checkbox of await dialog.locator('[data-stenter-selected-roll]').all()) await checkbox.check()
  if (action === 'receive' || action === 'downstream-receive' && await dialog.locator('[data-stenter-position]').count()) { const position = await dialog.locator('[data-stenter-position] option').nth(1).getAttribute('value'); assert.ok(position, 'GTG需要真实接收库位'); await dialog.locator('[data-stenter-position]').selectOption(position) }
  if (['receive', 'output', 'downstream-receive'].includes(action)) for (const roll of expected) await dialog.locator(`[data-stenter-quantity="${roll.id}"]`).fill(String(quantities?.[roll.id] ?? (action === 'receive' ? roll.inputQty : action === 'output' ? roll.receivedQty : roll.outputQty)))
  if (action === 'output') for (const [index, roll] of expected.entries()) await dialog.locator(`[data-stenter-output-code="${roll.id}"]`).fill(`SHF-PREVIEW-${prefix || "web-"}${iteration}-${index + 1}`)
  if (differenceConfirmed) await dialog.locator('[data-stenter-difference]').check()
  const rootBefore = await page.locator('[data-stenter-detail-root]').elementHandle()
  const submit = '[data-stenter-dialog-action="submit"]'
  const sample = await measured(page, prefix + 'execute-' + action, iteration, submit, () => dialog.locator(submit).click(), async () => {
    await dialog.waitFor({ state: 'detached' })
    const data = await snapshot(page), order = hands(data).find(row => row.value.data.id === orderId)?.value.data
    assert.ok(order)
    const field = { send: 'sentAt', receive: 'receivedAt', start: 'startedAt', output: 'completedAt', handout: 'handedOutAt', 'downstream-receive': 'downstreamReceivedAt', complete: 'completedAt' }[action]
    if (action === 'complete') assert.ok(order.completedAt); else assert.ok(order.rolls.every(roll => !!roll[field]), action + '每卷事实必须持久')
    if (action === 'output') { const qc = heads(data).find(row => row.value.data.source.kind === 'STENTER_HAND_FEEL' && row.value.data.source.id === orderId); assert.ok(qc, '最终产出须自动建染厂QC'); assert.equal(rolls(data).filter(row => row.value.qcId === qc.value.data.id).length, order.rolls.length) }
    await paint(page, '[data-stenter-detail-root]')
    assert.ok(await rootBefore.evaluate(node => node === document.querySelector('[data-stenter-detail-root]')), '执行确认应局部更新并保留详情根')
    if (prefix) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'PDA主体不可横向溢出'); const session = JSON.parse(await page.evaluate(() => localStorage.getItem('fcs_pda_session'))); assert.ok(active(data).some(row => row.value?.kind === 'action' && row.value.data.orderId === orderId && row.value.data.kind === action.toUpperCase().replace('-', '_') && row.value.data.by === session.userName), '真实会话操作人必须持久记录') }
    return { orderId, rollCount: order.rolls.length, field, amounts: order.rolls.map(roll => ({ id: roll.id, inputQty: roll.inputQty, receivedQty: roll.receivedQty, outputQty: roll.outputQty, downstreamQty: roll.downstreamQty, unit: roll.unit })), automaticQc: action === 'output', sourceType: order.source.kind, sourceId: order.source.id, actorFactoryId: prefix ? JSON.parse(await page.evaluate(() => localStorage.getItem('fcs_pda_session'))).factoryId : undefined }
  }, sampleExtra)
  if (action === 'output' && !prefix) record('stenter-auto-qc', iteration, sample, sample.endpointChecks, { route: page.url(), action: submit, sourceType: 'STENTER_HAND_FEEL', sourceId: orderId, cacheState: 'same-event-as-execute-output', reusedSample: sample.member + ':' + iteration })
  return hands(await snapshot(page)).find(row => row.value.data.id === orderId).value.data
}
async function pdfExport(page, iteration, labels, expectedOrder, familyPrefix = '') {
  const prefix = familyPrefix + (labels ? 'labels' : 'order'), previewAction = `[data-stenter-handfeel-action="${labels ? 'print-labels' : 'print-order'}"]`
  await measured(page, prefix + '-preview', iteration, previewAction, () => page.locator(previewAction).click(), async () => {
    await page.waitForFunction(labels => {
      const root = document.querySelector('[data-stenter-print-document]')
      return root && (labels ? root.querySelector('.stenter-label') && root.querySelector('h2')?.textContent?.includes('卷标') : root.querySelector('.stenter-print-summary') && !root.querySelector('h2')?.textContent?.includes('卷标'))
    }, labels)
    const ready = await paint(page, '[data-stenter-print-document]')
    assert.match(await page.locator('[data-stenter-print-document]').innerText(), /GTG/)
    if (labels) assert.equal(await page.locator('[data-stenter-print-document] svg').count(), expectedOrder.rolls.length)
    return { ...ready, orderId: expectedOrder.id, rows: expectedOrder.rolls.length, barcodeCount: await page.locator('[data-stenter-print-document] svg').count(), sourceType: expectedOrder.source.kind, sourceId: expectedOrder.source.id, fixtureVersion: familyPrefix ? 'scale30-list12-v1' : 'default-ui-chain-v1' }
  })
  const printButton = '[data-stenter-handfeel-action="print-browser"]'
  await eventTimer(page, printButton)
  await page.evaluate(() => { window.__qcPrintRequested = undefined })
  await page.locator(printButton).click()
  await page.waitForFunction(() => !!window.__qcPrintRequested?.html)
  const html = await page.evaluate(() => window.__qcPrintRequested.html)
  assert.match(html, /@page\{size:A4/)
  assert.ok(html.includes(expectedOrder.no), '实际打印模板必须对应当前来源')
  const printPage = await page.context().newPage()
  let bytes
  try { await printPage.setContent(html, { waitUntil: 'domcontentloaded' }); await paint(printPage, 'body'); bytes = await printPage.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }) } finally { await printPage.close() }
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  const file = join(output, `${prefix}-${iteration}.pdf`); await writeFile(file, bytes)
  const inspection = JSON.parse(execFileSync(python, ['-c', 'import json,sys;from pypdf import PdfReader;r=PdfReader(sys.argv[1]);print(json.dumps({"pages":len(r.pages),"images":sum(len(p.images) for p in r.pages),"text":"\\n".join(p.extract_text() or "" for p in r.pages)},ensure_ascii=False))', file], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }))
  assert.ok(inspection.pages > 0 && inspection.images > 0)
  if (expectedOrder.rolls.length >= 30) assert.ok(inspection.pages >= 2, '30卷必须实际跨页，不能仅截首屏')
  assert.ok(inspection.text.includes(expectedOrder.no) && inspection.text.includes('GTG'))
  for (const roll of expectedOrder.rolls) assert.ok(inspection.text.includes(labels ? roll.outputBarcode : roll.barcode), 'PDF缺少对应卷码')
  const normalizedText = inspection.text.replace(/\s+/g, ' ')
  for (const roll of expectedOrder.rolls) assert.ok(normalizedText.includes(`${labels ? roll.outputQty : roll.inputQty} ${roll.unit}`), 'PDF缺少对应卷的实际数量/单位')
  const timer = await page.evaluate(() => ({ start: window.__qcPerfTimer.start, end: performance.now() }))
  record(prefix + '-pdf', iteration, timer, { readablePdfHeader: true, bytes: bytes.length, pages: inspection.pages, embeddedImages: inspection.images, quantityAndBarcodeTextMatched: true, actualProductPrintHtmlSha256: digest(html), orderId: expectedOrder.id, sourceType: expectedOrder.source.kind, sourceId: expectedOrder.source.id }, { route: page.url(), action: printButton, cacheState: 'existing-context/actual-print-iframe', file: relative(output, file), fixtureVersion: familyPrefix ? 'scale30-list12-v1' : 'default-ui-chain-v1', rolls: expectedOrder.rolls.length, rows: expectedOrder.rolls.length, printTransport: '实际产品打印iframe HTML原样交浏览器printToPDF；仅截获原生打印调用，未修改业务模板/来源' })
  if (iteration === 1) { await writeFile(join(output, prefix + '-actual-print.html'), html); for (const pageNumber of [...new Set([1, Math.ceil(inspection.pages / 2), inspection.pages])]) execFileSync('pdftoppm', ['-f', String(pageNumber), '-singlefile', '-scale-to', '1600', '-png', file, join(output, prefix + '-page-' + pageNumber)]) }
  report.pdfs.push({ file: relative(output, file), pages: inspection.pages, embeddedImages: inspection.images, orderId: expectedOrder.id, rows: expectedOrder.rolls.length, text: inspection.text, htmlSha256: digest(html) })
  await page.evaluate(() => document.querySelector('[data-stenter-print-frame]')?.remove())
}
async function seedScaleFixture(page, templateOrder, iteration) {
  const at = '2026-10-22T08:00:00.000Z'
  const documents = Array.from({ length: 12 }, (_, index) => {
    const sourceId = `FIXTURE-SCALE-${iteration}-${String(index + 1).padStart(2, '0')}`, source = structuredClone(templateOrder.source)
    const sourceRolls = Array.from({ length: index === 0 ? 30 : 2 }, (_, rollIndex) => ({ id: sourceId + '-R' + (rollIndex + 1), barcode: sourceId + '-IN-' + (rollIndex + 1), batchId: sourceId, qty: 10 + rollIndex / 10, unit: source.unit, confirmed: true }))
    Object.assign(source, { id: sourceId, no: sourceId, taskId: undefined, sourceNo: '显式隔离规模夹具', productionOrderId: undefined, techPackVersionId: undefined, demo: false, hasFinalOutput: true, completedAt: at, rolls: sourceRolls, handedOutRollIds: [] })
    const qcId = 'FQC-' + encodeURIComponent(source.kind + ':' + sourceId), handId = 'SHF-' + encodeURIComponent(source.kind + ':' + sourceId)
    const qc = { id: qcId, no: 'PQC-' + sourceId, kind: 'PRINTING', source, createdAt: at, version: 1, decision: { needs: true, target: '柔软手感', at, by: '明确隔离规模夹具', orderId: handId } }
    const hand = { id: handId, no: 'SHF-' + sourceId, qcId, source, handFeel: '柔软手感', factoryId: 'ID-F003', factoryName: 'GTG', createdAt: at, createdBy: '明确隔离规模夹具', version: 1, rolls: sourceRolls.map(roll => ({ id: roll.id, sourceRollId: roll.id, barcode: roll.barcode, unit: roll.unit, inputQty: roll.qty, sentAt: at, receivedAt: at, receivedQty: roll.qty, warehouseId: 'FIW-ID-F003-WAIT_PROCESS', locationId: 'LOC-A-01-01', startedAt: at, completedAt: at, outputQty: roll.qty, outputBarcode: roll.barcode.replace('-IN-', '-OUT-') })) }
    return { qc, hand }
  })
  await page.evaluate(async ({ documents, QC, HAND }) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records'); for (const { qc, hand } of documents) { store.put({ id: QC + '/order/' + qc.id, collection: QC, version: 1, value: { kind: 'qc', data: qc } }); for (const roll of qc.source.rolls) store.put({ id: QC + '/roll/' + qc.id + '/' + encodeURIComponent(roll.id), collection: QC, version: 1, value: { kind: 'roll', qcId: qc.id, data: { ...roll, photos: [], results: { color: '', handfeel: '', material: '' }, notes: '', version: 0, referenceImageUrl: qc.source.imageUrl, requiredMaterialSku: qc.source.materialSku, requirementVersion: qc.source.requirementVersion } } }); store.put({ id: HAND + '/order/' + hand.id, collection: HAND, version: 1, value: { kind: 'handfeel', data: hand } }) }; tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }) } finally { db.close() }
  }, { documents, QC, HAND })
  report.cases.push({ iteration, fixtureId: 'scale30-list12-v1', fixturePurpose: '隔离模型资料只用于30卷打印及12张列表分页；未把夹具写入冒充自动生成', orderCount: documents.length, rollCounts: documents.map(item => item.hand.rolls.length), sourceTemplate: templateOrder.source.id, dataSha256: digest(JSON.stringify(documents)) })
  return documents[0].hand
}
async function checkScale(iteration, templateOrder) {
  const context = await newContext(), page = await context.newPage()
  try {
    await page.goto(baseURL + LIST); await page.waitForSelector('[data-factory-qc-root]')
    const large = await seedScaleFixture(page, templateOrder, iteration), fixture = { fixtureVersion: 'scale30-list12-v1', sourceType: large.source.kind, sourceId: large.source.id, rolls: 30, rows: 12, sourceIdentityScope: '12张显式隔离来源，30卷代表单；打印为该代表单，列表为全部12张' }, qcFixture = { ...fixture, rows: 14, sourceIdentityScope: '12张显式隔离来源加2张默认真实印花来源的14张聚合列表' }
    await page.reload(); await page.waitForSelector('[data-factory-qc-root]')
    assert.equal(await page.locator('tbody tr').count(), 10)
    await measured(page, 'qc-pagination', iteration, '[data-factory-qc-action="next-page"]', () => page.locator('[data-factory-qc-action="next-page"]').click(), async () => { await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 4); assert.equal(await page.locator('tbody tr').count(), 4); return { ...await paint(page, '[data-factory-qc-root]'), rows: 14, currentPageRows: 4, page: 2 } }, qcFixture)
    await measured(page, 'qc-sort', iteration, '[data-factory-qc-action="sort-column"][data-column-key="no"]', () => page.locator('[data-factory-qc-action="sort-column"][data-column-key="no"]').click(), async () => { await page.waitForSelector('[data-factory-qc-action="sort-column"][data-column-key="no"] [data-standard-list-sort-icon="asc"]'); const no = await page.locator('tbody tr td:first-child a').allTextContents(); assert.deepEqual(no, [...no].sort((a, b) => a.localeCompare(b, 'zh-CN'))); return { ...await paint(page, '[data-factory-qc-root]'), page: 1, sortedNos: no } }, qcFixture)
    await page.locator('[data-factory-qc-action="columns"]').click()
    await measured(page, 'qc-column-visibility-freeze', iteration, '[data-factory-qc-action="column-visible"][data-column-key="factory"]', async () => { await page.locator('[data-factory-qc-action="column-visible"][data-column-key="factory"]').uncheck(); await page.locator('[data-factory-qc-action="column-freeze"][data-column-key="no"]').check() }, async () => { await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.frozenKeys.includes('no'), LIST + ':columns'); const pref = JSON.parse(await page.evaluate(key => localStorage.getItem(key), LIST + ':columns')); assert.ok(!pref.visibleKeys.includes('factory') && pref.frozenKeys.includes('no')); assert.equal(await page.locator('thead').getByText('现场工厂', { exact: true }).count(), 0); assert.ok(await page.locator('thead th').first().evaluate(node => node.className.includes('sticky'))); return { ...await paint(page, '[data-factory-qc-root]'), hidden: 'factory', frozen: 'no' } }, { ...qcFixture, eventType: 'change' })
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.goto(baseURL + '/fcs/craft/dyeing/stenter-handfeel/work-orders'); await page.waitForSelector('[data-stenter-list-root]')
    assert.equal(await page.locator('tbody tr').count(), 10)
    await measured(page, 'stenter-pagination', iteration, '[data-stenter-handfeel-action="next-page"]', () => page.locator('[data-stenter-handfeel-action="next-page"]').click(), async () => { await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2); assert.equal(await page.locator('tbody tr').count(), 2); return { ...await paint(page, '[data-stenter-list-root]'), rows: 12, currentPageRows: 2, page: 2 } }, fixture)
    await page.goto(baseURL + '/fcs/craft/dyeing/stenter-handfeel/work-orders/' + encodeURIComponent(large.id)); await page.waitForSelector('[data-stenter-detail-root]')
    await pdfExport(page, iteration, false, large, 'scale30-'); await pdfExport(page, iteration, true, large, 'scale30-')
    if (iteration === 1) await page.screenshot({ path: join(output, 'scale30-preview-1366.png'), fullPage: true })
    // A separate caption-only fixture checks the internal signature's actual render,
    // after all measured scale actions. It changes no quantity or execution fact.
    const signature = JSON.stringify([large.source.materialSku, '雾蓝', null])
    await page.evaluate(async ({ QC, HAND, qcId, handId, rollId, signature }) => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      try { await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records'), request = store.getAll(); request.onsuccess = () => { for (const record of request.result) { if (record.collection === HAND && record.value.kind === 'handfeel' && record.value.data.id === handId || record.collection === QC && record.value.kind === 'qc' && record.value.data.id === qcId) { record.value.data.source.requirementVersion = signature; record.value.data.version++; record.version++; store.put(record) } else if (record.collection === QC && record.value.kind === 'roll' && record.value.qcId === qcId && record.value.data.id === rollId) { record.value.data.requirementVersion = signature; record.value.data.version++; record.version++; store.put(record) } } }; tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }) } finally { db.close() }
    }, { QC, HAND, qcId: large.qcId, handId: large.id, rollId: large.rolls[0].id, signature })
    const assertCaption = async selector => { await paint(page, selector); const text = await page.locator(selector).innerText(); assert.match(text, /颜色要求：雾蓝/); assert.ok(!text.includes(signature) && !text.includes('["'), '员工可见要求不能泄露内部JSON比对签名'); return text }
    await page.goto(baseURL + LIST + '/' + encodeURIComponent(large.qcId)); await page.waitForSelector('[data-factory-qc-root="detail"]'); await page.locator(`[data-roll-id="${large.rolls[0].id}"]`).click()
    const qcCaption = await assertCaption('[data-factory-qc-editor]')
    await page.goto(baseURL + '/fcs/craft/dyeing/stenter-handfeel/work-orders/' + encodeURIComponent(large.id)); await page.waitForSelector('[data-stenter-detail-root]')
    const detailCaption = await assertCaption('[data-stenter-detail-part="base"]')
    await page.locator('[data-stenter-handfeel-action="print-order"]').click(); await page.waitForSelector('[data-stenter-print-document]')
    const printCaption = await assertCaption('[data-stenter-print-document]'), samePhysicalOrder = hands(await snapshot(page)).find(row => row.value.data.id === large.id).value.data
    assert.deepEqual(samePhysicalOrder.rolls, large.rolls)
    report.cases.push({ iteration, case: 'requirement-signature-caption-negative', fixtureId: 'scale30-caption-only-v1', changedFieldsOnly: 'QC来源与首卷snapshot/手感来源的requirementVersion显示输入及记录版本；数量、执行阶段、图片均不变', expectedVisibleText: '颜色要求：雾蓝', internalSignatureNotVisible: true, qcRollSnapshotCaption: qcCaption, handfeelDetailCaption: detailCaption, actualPrintPreviewCaption: printCaption, physicalRollsUnchanged: true, separateFromMeasuredFamily: true })
    if (iteration === 1) await page.screenshot({ path: join(output, 'requirement-signature-caption-1366.png'), fullPage: true })
  } finally { await context.close() }
}
async function loginPda(page, factoryId, returnTo, logout = false) {
  if (logout) { await page.locator('[data-pda-shell-action="open-account-modal"]').click(); await page.locator('[data-pda-shell-action="request-logout"]').click(); await page.locator('[data-pda-shell-action="confirm-logout"]').click(); await page.waitForSelector('[data-pda-login-field="loginId"]') }
  await page.goto(baseURL + '/fcs/pda/auth/login?returnTo=' + encodeURIComponent(returnTo)); await page.waitForSelector('[data-pda-login-field="loginId"]')
  await page.locator('[data-pda-login-field="loginId"]').fill(factoryId + '_admin'); await page.locator('[data-pda-login-field="password"]').fill('123456'); await page.locator('[data-pda-login-action="submit"]').click()
  await page.waitForFunction(returnTo => location.pathname === returnTo, returnTo)
  const root = returnTo === '/fcs/pda/stenter-handfeel' ? '[data-stenter-list-root]' : '[data-stenter-detail-root]'
  await page.waitForSelector(root); await paint(page, root)
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('fcs_pda_session')))
  assert.equal(session.factoryId, factoryId)
  return session
}

async function checkPartialHandout(iteration) {
  const context = await newContext(), page = await context.newPage()
  try {
    const sourceId = 'DYE-DISPATCH-DEMO-2'
    const qc = await configureDyeDestination(page, sourceId)
    await page.goto(baseURL + '/fcs/craft/dyeing/pending-handover'); await page.waitForSelector('[data-dye-output-page]')
    const selected = `[data-dye-output-select="${sourceId}|${qc.source.rolls[0].id}"]`
    await page.locator(selected).check(); await page.locator('[data-dye-output-action="create"]').click(); await page.locator('[data-dye-output-field="operator"]').fill('固定构建GTG交接员'); await page.locator('[data-dye-output-action="save-document"]').click(); await page.waitForSelector('[data-dye-output-field="scan"]')
    await page.locator('[data-dye-output-field="scanner"]').fill('固定构建GTG交接员'); await page.locator('[data-dye-output-field="scan"]').fill(qc.source.rolls[0].barcode); await page.locator('[data-dye-output-action="scan"]').click(); await page.waitForFunction(() => document.querySelector('[data-dye-output-page]')?.textContent.includes('本卷核对成功'))
    for (const [key, value] of Object.entries({ driver: 'Agus', vehicle: '货车', plate: 'QC-ISOLATED-001' })) await page.locator(`[data-dye-output-field="${key}"]`).fill(value)
    await page.locator('[data-dye-output-action="save-transport"]').click(); await page.waitForFunction(() => document.querySelector('[data-dye-output-page]')?.textContent.includes('运输信息已保存'))
    page.once('dialog', dialog => dialog.accept()); await page.locator('[data-dye-output-action="confirm"]').click(); await page.waitForFunction(() => document.querySelector('[data-dye-output-page]')?.textContent.includes('交出已保存'))
    await page.goto(baseURL + DYE_LIST + '/' + encodeURIComponent(qc.id)); await page.waitForSelector('[data-factory-qc-field="needs"]'); await page.locator('[data-factory-qc-field="needs"]').selectOption('yes')
    await measured(page, 'partial-handout-decision-only', iteration, '[data-factory-qc-action="decide"]', () => page.locator('[data-factory-qc-action="decide"]').click(), async () => {
      await page.waitForFunction(() => document.querySelector('[data-factory-qc-handfeel]')?.textContent?.includes('本次仅保存判断'))
      const data = await snapshot(page), persisted = heads(data).find(row => row.value.data.id === qc.id).value.data, handedOutRolls = persisted.source.rolls.filter(roll => roll.handedOut)
      assert.equal(persisted.source.rolls.length, 6); assert.equal(handedOutRolls.length, 1); assert.ok(persisted.decision.needs && !persisted.decision.orderId); assert.equal(hands(data).filter(row => row.value.data.qcId === qc.id).length, 0)
      const actualDispatch = active(data).filter(row => row.collection === PROCESS && row.value.path === 'state.workOrders').flatMap(row => row.value.value.dispatchDocuments || []).find(doc => doc.status === '已交出' && doc.lines.some(line => line.orderId === sourceId && line.rolls.length === 1))
      assert.ok(actualDispatch, '必须存在本次实际单卷交出单，不能只有QC快照')
      return { ...await paint(page, '[data-factory-qc-root]'), sourceType: qc.source.kind, sourceId, existingHandoutRolls: 1, remainingUnsentRolls: 5, actualDispatchId: actualDispatch.id, createdHandfeelOrders: 0, judgementOnly: true }
    }, { sourceType: qc.source.kind, sourceId, rows: 1, rolls: 6, fixtureVersion: 'actual-dye-route-one-of-six-ui-handout-v1' })
  } catch (error) { report.partialHandoutFailure = { error: error.message, route: page.url(), body: await page.locator('body').innerText().catch(() => '') }; await page.screenshot({ path: join(output, 'partial-handout-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
}

async function configureDyeDestination(page, sourceId) {
  // These are actual source-page controls; never rewrite source/QC/handfeel facts here.
  const detailRoute = '/fcs/craft/dyeing/work-orders/' + encodeURIComponent(sourceId), open = '[data-dyeing-action="recipient-open"]', sharedDraftId = sourceId === 'DYE-DISPATCH-DEMO-4' ? 'SJ-DEMO-20260911-002' : 'SJ-DEMO-20260911-001', originalLines = sourceId === 'DYE-DISPATCH-DEMO-4' ? 1 : 2
  await page.goto(baseURL + detailRoute); await page.waitForSelector(open); assert.ok(await page.locator(open).isDisabled(), '共享草稿仍占用时，必须禁止改换接收方')
  await page.goto(baseURL + '/fcs/craft/dyeing/handover-documents'); await page.waitForSelector('[data-dye-output-page]'); await page.locator(`[data-dye-output-action="detail"][data-id="${sharedDraftId}"]`).first().click()
  page.once('dialog', dialog => dialog.accept()); await page.locator(`[data-dye-output-action="void"][data-id="${sharedDraftId}"]`).click(); await page.getByText('单据已作废，所选卷已释放。', { exact: true }).waitFor()
  const retiredDraft = active(await snapshot(page)).filter(row => row.collection === PROCESS && row.value.path === 'state.workOrders').flatMap(row => row.value.value.dispatchDocuments || []).find(doc => doc.id === sharedDraftId)
  assert.ok(retiredDraft && retiredDraft.status === '已作废' && retiredDraft.lines.length === originalLines, '只作废并保留原有草稿及全部明细，禁止删除或改掉原明细')
  report.cases.push({ case: 'pda-source-preparation', sourceId, sharedDraft: retiredDraft.id, priorRecipientAdjustmentBlocked: true, actualUiVoid: true, sharedDraftStatus: retiredDraft.status, originalLinesRetained: retiredDraft.lines.map(line => ({ orderId: line.orderId, rollIds: line.rolls.map(roll => roll.id) })) })
  await page.goto(baseURL + '/fcs/craft/dyeing/work-orders/' + encodeURIComponent(sourceId)); await page.waitForSelector('[data-dyeing-action="recipient-open"]')
  await page.locator('[data-dyeing-action="recipient-open"]').click(); await page.locator('[data-dye-recipient-target]').selectOption('FACTORY:F090'); await page.locator('[data-dye-recipient-reason]').fill('固定构建隔离验收：本批实际去向调整为全能力测试工厂，原GTG实物产出保留。'); await page.locator('[data-dyeing-action="recipient-save"]').click()
  await page.waitForFunction(() => document.querySelector('[data-dye-recipient-summary]')?.textContent?.includes('全能力测试工厂') && document.querySelector('[data-dye-recipient-summary]')?.textContent?.includes('固定构建隔离验收'))
  const data = await snapshot(page), qc = heads(data).find(row => row.value.data.source.id === sourceId)?.value.data
  assert.ok(qc && qc.source.target.kind === 'FACTORY' && qc.source.target.isDyeingFactory === false && qc.source.rolls.length === 6)
  assert.equal(qc.source.handedOutRollIds.length, 0)
  return qc
}
async function warehouseRead(page, iteration, id, mode, factoryId, hand, expectedQty) {
  const reader = await page.context().newPage()
  try {
    await reader.setViewportSize(viewport)
    const route = `/fcs/craft/dyeing/wait-${mode}-warehouse?factoryId=${encodeURIComponent(factoryId)}`
    await reader.goto(baseURL + route, { waitUntil: 'domcontentloaded' }); await reader.waitForSelector('[data-dye-wh-page]'); const navigationReady = await paint(reader, '[data-factory-warehouse-tab-panel="inventory"]'), navigation = await reader.evaluate(() => ({ start: performance.getEntriesByType('navigation')[0]?.startTime ?? 0, end: performance.now() }))
    const navigationDurationMs = navigation.end - navigation.start, diagnostics = await reader.evaluate(() => ({ resourceTimings: performance.getEntriesByType('resource').map(item => ({ name: item.name, startTime: item.startTime, responseEnd: item.responseEnd, duration: item.duration, transferSize: item.transferSize, encodedBodySize: item.encodedBodySize })), longTasks: window.__qcLongTasks || [] }))
    report.navigationPreparations ||= []; report.navigationPreparations.push({ member: id, iteration, route: reader.url(), durationMs: navigationDurationMs, ...diagnostics, images: navigationReady.images, result: navigationDurationMs <= maxMs ? 'passed' : 'slow', note: '实际页面导航完成；URL factoryId未被当前页读取，随后另用真实查询控件筛选，不冒称URL已过滤' })
    await reader.locator('[data-dye-wh-filter="factory"]').selectOption(factoryId); await reader.locator('[data-dye-wh-filter="keyword"]').fill(hand.source.materialSku)
    const quantityIndex = mode === 'process' ? 10 : 9, barcodeIndex = mode === 'process' ? 8 : 6, expectedCodes = id === 'warehouse-gtg-after-receive' ? hand.rolls.map(roll => roll.barcode) : id === 'warehouse-gtg-after-output' ? hand.rolls.map(roll => roll.outputBarcode) : []
    await measured(reader, id, iteration, '[data-dye-wh-filter-action="query"]', () => reader.locator('[data-dye-wh-filter-action="query"]').click(), async () => {
      await reader.waitForFunction(({ sku, quantityIndex, expectedQty }) => { const rows = [...document.querySelectorAll('[data-factory-warehouse-tab-panel="inventory"] tbody tr')].filter(row => row.querySelectorAll('td').length > 1); return rows.length > 0 && rows.every(row => row.textContent.includes(sku)) && Math.abs(rows.reduce((sum, row) => sum + Number.parseFloat(row.querySelectorAll('td')[quantityIndex].textContent.replaceAll(',', '')), 0) - expectedQty) < .000001 }, { sku: hand.source.materialSku, quantityIndex, expectedQty })
      const rows = await reader.locator('[data-factory-warehouse-tab-panel="inventory"] tbody tr').evaluateAll((rows, quantityIndex) => rows.filter(row => row.querySelectorAll('td').length > 1).map(row => ({ text: row.textContent, quantity: Number.parseFloat(row.querySelectorAll('td')[quantityIndex].textContent.replaceAll(',', '')) })), quantityIndex)
      const actualQty = rows.reduce((sum, row) => sum + row.quantity, 0), text = rows.map(row => row.text).join('\n'); assert.ok(Math.abs(actualQty - expectedQty) < .000001)
      for (const code of expectedCodes) assert.ok(text.includes(code), '库存页缺少本单对应卷码：' + code)
      if (mode === 'process') { const used = await reader.locator('[data-factory-warehouse-tab-panel="inventory"] tbody tr').evaluateAll(rows => rows.filter(row => row.querySelectorAll('td').length > 1).reduce((sum, row) => sum + Number.parseFloat(row.querySelectorAll('td')[11].textContent.replaceAll(',', '')), 0)); assert.equal(used, 0, '实收尚未投入时不能重复记用料') }
      const ready = await paint(reader, '[data-factory-warehouse-tab-panel="inventory"]'); assert.ok(ready.images > 0, '本单库存必须有对应物料图'); assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      const data = await snapshot(reader), actual = hands(data).find(row => row.value.data.id === hand.id).value.data
      return { ...ready, sourceType: hand.source.kind, sourceId: hand.source.id, orderId: hand.id, actualFactoryId: factoryId, inventoryRows: rows.length, actualQty, expectedQty, unit: hand.rolls[0].unit, expectedCodes, actualQuantities: actual.rolls.map(roll => ({ id: roll.id, inputQty: roll.inputQty, receivedQty: roll.receivedQty, outputQty: roll.outputQty, downstreamQty: roll.downstreamQty })), navigationCompleted: true, navigationDurationMs }
    }, { viewport, sourceType: hand.source.kind, sourceId: hand.source.id, rows: id === 'warehouse-source-after-send' ? 1 : hand.rolls.length, rolls: hand.rolls.length, fixtureVersion: 'actual-three-factory-pda-chain-v1', cacheState: 'same-authenticated-context/fresh-read-page/actual-factory-and-SKU-query', navigationDurationMs })
    if (iteration === 1) await reader.screenshot({ path: join(output, id + '-1366.png'), fullPage: true })
  } catch (error) { report.warehouseFailure = { member: id, iteration, error: error.message, route: reader.url(), body: await reader.locator('body').innerText().catch(() => '') }; await reader.screenshot({ path: join(output, id + '-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await reader.close() }
}
async function downstreamPdaStock(page, iteration, hand) {
  const reader = await page.context().newPage(), expectedQty = hand.rolls.reduce((sum, roll) => sum + roll.downstreamQty, 0), expectedCodes = hand.rolls.map(roll => roll.outputBarcode)
  try {
    await reader.setViewportSize({ width: 390, height: 844 })
    await navigate(reader, 'warehouse-downstream-after-receive', iteration, '/fcs/pda/warehouse/wait-process', '[data-pda-scroll-container="true"]', false, { viewport: { width: 390, height: 844 }, sourceType: hand.source.kind, sourceId: hand.source.id, rows: 1, rolls: hand.rolls.length, fixtureVersion: 'actual-three-factory-pda-chain-v1', requestedRoute: '/fcs/pda/warehouse/wait-process', existingCanonicalRedirect: '/fcs/pda/handover?tab=pickup' }, async () => {
      await reader.waitForFunction(({ sku, expectedCodes }) => { const cards = [...document.querySelectorAll('[data-stenter-handfeel-factory-stock="WAIT_PROCESS"] article')].filter(card => card.textContent.includes(sku)); return cards.length > 0 && expectedCodes.every(code => cards.some(card => card.textContent.includes(code))) }, { sku: hand.source.materialSku, expectedCodes })
      const cards = reader.locator('[data-stenter-handfeel-factory-stock="WAIT_PROCESS"] article').filter({ hasText: hand.source.materialSku }), texts = await cards.allTextContents(), quantities = texts.map(text => { const match = text.match(/手感后待领用\s*·\s*([\d.,]+)/); assert.ok(match, '下游库存必须展示按实际实收形成的可用数量'); return Number(match[1].replaceAll(',', '')) })
      assert.ok(Math.abs(quantities.reduce((sum, qty) => sum + qty, 0) - expectedQty) < .000001); for (const code of expectedCodes) assert.ok(texts.some(text => text.includes(code)))
      assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); const images = await cards.locator('img').count(); assert.ok(images > 0, '下游PDA库存必须有对应物料图')
      const data = await snapshot(reader), current = hands(data).find(row => row.value.data.id === hand.id).value.data, session = JSON.parse(await reader.evaluate(() => localStorage.getItem('fcs_pda_session')))
      assert.equal(session.factoryId, hand.source.target.factoryId); assert.ok(current.rolls.every(roll => roll.downstreamReceivedAt && expectedCodes.includes(roll.outputBarcode)))
      return { orderId: hand.id, actualFactoryId: session.factoryId, actualQty: expectedQty, unit: hand.rolls[0].unit, originalRollIds: current.rolls.map(roll => roll.sourceRollId), outputBarcodes: expectedCodes, inventoryCards: texts.length, actualCanonicalRoute: reader.url(), aggregateCardFromActualReceipt: true, sourceType: hand.source.kind, sourceId: hand.source.id }
    })
    const image = reader.locator('article').filter({ hasText: hand.source.materialSku }).locator('[data-stenter-handfeel-action="image"]').first(), selector = '[data-stenter-handfeel-action="image"]'
    assert.equal(await image.getAttribute('data-image-url'), hand.source.imageUrl)
    await eventTimer(reader, selector); await image.click(); await reader.waitForSelector('dialog[open]'); await paint(reader, 'dialog[open]'); let timing = await reader.evaluate(() => ({ start: window.__qcPerfTimer.start, end: performance.now() })); report.directInteractions ||= []; report.directInteractions.push({ member: 'warehouse-downstream-after-receive', iteration, variant: '新增库存缩略图使用既有stenter大图处理器：原图解码', durationMs: timing.end - timing.start, result: timing.end - timing.start <= maxMs ? 'passed' : 'slow', imageUrl: hand.source.imageUrl, sameHandlerAs: 'stenter-image-open', route: reader.url() })
    await eventTimer(reader, '[data-stenter-handfeel-action="close-image"]'); await reader.locator('dialog[open] [data-stenter-handfeel-action="close-image"]').click(); await reader.locator('dialog[open]').waitFor({ state: 'detached' }); assert.ok(await image.evaluate(node => node === document.activeElement)); timing = await reader.evaluate(() => ({ start: window.__qcPerfTimer.start, end: performance.now() })); report.directInteractions.push({ member: 'warehouse-downstream-after-receive', iteration, variant: '库存大图关闭按钮与焦点恢复', durationMs: timing.end - timing.start, result: timing.end - timing.start <= maxMs ? 'passed' : 'slow', sameHandlerAs: 'stenter-image-close', route: reader.url() })
    await image.click(); await reader.waitForSelector('dialog[open]'); await paint(reader, 'dialog[open]'); await reader.keyboard.press('Escape'); await reader.locator('dialog[open]').waitFor({ state: 'detached' }); assert.ok(await image.evaluate(node => node === document.activeElement))
    report.cases.push({ iteration, case: 'F090实际库存原图交互', sourceId: hand.source.id, orderId: hand.id, thumbnailMatchesOriginal: true, fullImageDecoded: true, buttonCloseAndEscape: true, focusRestored: true, equivalence: '与手感详情复用同一stenterImage/全局image分派及关闭处理器；这里验证新增库存调用面，不新增重复家族' })
    if (iteration === 1) await reader.screenshot({ path: join(output, 'warehouse-downstream-after-receive-390.png'), fullPage: true })
  } catch (error) { report.warehouseFailure = { member: 'warehouse-downstream-after-receive', iteration, error: error.message, route: reader.url(), body: await reader.locator('body').innerText().catch(() => '') }; await reader.screenshot({ path: join(output, 'warehouse-downstream-after-receive-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await reader.close() }
}

async function checkPda(iteration) {
  const origin = await newContext({ viewport: { width: 390, height: 844 } }), setup = await origin.newPage()
  let coldContext, pdaPage
  try {
    const sourceId = 'DYE-DISPATCH-DEMO-4'
    const qc = await configureDyeDestination(setup, sourceId), qcPath = DYE_LIST + '/' + encodeURIComponent(qc.id)
    await setup.goto(baseURL + qcPath); await setup.waitForSelector('[data-factory-qc-field="needs"]'); await setup.locator('[data-factory-qc-field="needs"]').selectOption('yes'); await setup.locator('[data-factory-qc-field="target"]').selectOption('柔软手感'); await setup.locator('[data-factory-qc-action="decide"]').click(); await setup.getByRole('link', { name: '查看定型机手感单' }).waitFor()
    let hand = hands(await snapshot(setup)).find(row => row.value.data.qcId === qc.id).value.data
    assert.equal(hand.factoryId, 'ID-F003'); assert.equal(hand.source.factoryId, 'ID-F002'); assert.equal(hand.rolls.length, 6)
    const pendingQc = rolls(await snapshot(setup)).filter(row => row.value.qcId === qc.id); assert.equal(pendingQc.length, 6); assert.ok(pendingQc.every(row => !row.value.data.completedAt && row.value.data.photos.length === 0 && Object.values(row.value.data.results).every(value => !value)), '本链须真实覆盖未质检且无照片仍可实物交出')
    const pdaList = '/fcs/pda/stenter-handfeel', detailPath = pdaList + '/' + encodeURIComponent(hand.id), sourceSession = await loginPda(setup, hand.source.factoryId, pdaList)
    const state = await origin.storageState({ indexedDB: true })
    coldContext = await newContext({ viewport: { width: 390, height: 844 }, storageState: state }); const page = pdaPage = await coldContext.newPage()
    const meta = { viewport: { width: 390, height: 844 }, sourceType: hand.source.kind, sourceId: hand.source.id, rolls: 6, rows: 1, fixtureVersion: 'actual-dye-route-qc-ui-created-pda-v1' }
    await navigate(page, 'pda-list-auth-cold', iteration, pdaList, '[data-stenter-list-root]', false, meta, async () => { assert.equal(await page.locator('[data-stenter-pda-cards] article').count(), 1); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); return { actualAuthenticatedFactoryId: sourceSession.factoryId, restoredFromActualUiLogin: true } })
    const detailLink = '[data-stenter-pda-cards] a[data-nav="' + detailPath + '"]'
    await measured(page, 'pda-detail-auth-nav', iteration, detailLink, () => page.locator(detailLink).click(), async () => { await page.waitForSelector('[data-stenter-detail-root]'); assert.equal(await page.locator('[data-stenter-handfeel-action="receive"]').count(), 0); return { ...await paint(page, '[data-stenter-detail-root]'), actorFactoryId: sourceSession.factoryId } }, meta)
    await navigate(page, 'pda-detail-auth-refresh', iteration, '', '[data-stenter-detail-root]', true, meta, async () => { assert.ok(await page.locator('[data-stenter-handfeel-action="send"]').count()); return { actorFactoryId: sourceSession.factoryId } })
    hand = await execute(page, iteration, 'send', hand.id, hand.rolls, { prefix: 'pda-', ...meta }); await warehouseRead(page, iteration, 'warehouse-source-after-send', 'handover', hand.source.factoryId, hand, 0)
    await navigate(page, 'pda-wrong-factory-action-hidden', iteration, detailPath, '[data-stenter-detail-root]', false, { ...meta, cacheState: 'existing-context/actual-other-factory-login' }, async () => { assert.equal(await page.locator('[data-stenter-handfeel-action="receive"]').count(), 0); assert.equal(await page.locator('[data-stenter-handfeel-action="send"]').count(), 0); assert.ok(hands(await snapshot(page)).find(row => row.value.data.id === hand.id).value.data.rolls.every(roll => !roll.receivedAt)); return { actualLoggedFactoryId: 'ID-F002', gtgReceiptUnavailable: true, noUnauthorizedReceipt: true } })
    await loginPda(page, 'ID-F003', detailPath, true)
    await page.locator('[data-stenter-handfeel-action="receive"]').first().click(); const dialog = page.locator('[data-stenter-dialog]'); await dialog.waitFor()
    for (const roll of hand.rolls) { await dialog.locator('[data-stenter-scan]').fill(roll.barcode); await dialog.locator('[data-stenter-dialog-action="scan"]').click(); await dialog.locator(`[data-stenter-quantity="${roll.id}"]`).fill(String(roll.inputQty - (roll.id === hand.rolls[0].id ? 1 : 0))) }
    const position = await dialog.locator('[data-stenter-position] option').nth(1).getAttribute('value'); await dialog.locator('[data-stenter-position]').selectOption(position)
    await measured(page, 'pda-quantity-difference-reject', iteration, '[data-stenter-dialog-action="submit"]', () => dialog.locator('[data-stenter-dialog-action="submit"]').click(), async () => { await page.waitForFunction(() => document.querySelector('[data-stenter-dialog-error]')?.textContent?.includes('差异')); assert.ok(hands(await snapshot(page)).find(row => row.value.data.id === hand.id).value.data.rolls.every(roll => !roll.receivedAt)); assert.equal(await dialog.locator(`[data-stenter-quantity="${hand.rolls[0].id}"]`).inputValue(), String(hand.rolls[0].inputQty - 1)); return { actualQuantityDifference: -1, unit: hand.rolls[0].unit, notPersisted: true, inputRetained: true, actorFactoryId: 'ID-F003' } }, meta)
    await dialog.getByRole('button', { name: '取消', exact: true }).click(); await dialog.locator('[data-stenter-dialog-action="discard"]').click(); await dialog.waitFor({ state: 'detached' })
    hand = await execute(page, iteration, 'receive', hand.id, hand.rolls, { prefix: 'pda-', quantities: { [hand.rolls[0].id]: hand.rolls[0].inputQty - 1 }, differenceConfirmed: true, ...meta }); await warehouseRead(page, iteration, 'warehouse-gtg-after-receive', 'process', hand.factoryId, hand, hand.rolls.reduce((sum, roll) => sum + roll.receivedQty, 0))
    hand = await execute(page, iteration, 'start', hand.id, hand.rolls, { prefix: 'pda-', ...meta })
    hand = await execute(page, iteration, 'output', hand.id, hand.rolls, { prefix: 'pda-', ...meta }); await warehouseRead(page, iteration, 'warehouse-gtg-after-output', 'handover', hand.factoryId, hand, hand.rolls.reduce((sum, roll) => sum + roll.outputQty, 0))
    hand = await execute(page, iteration, 'handout', hand.id, hand.rolls, { prefix: 'pda-', ...meta })
    const downstreamFactory = hand.source.target.factoryId || hand.source.target.id
    await loginPda(page, downstreamFactory, detailPath, true)
    hand = await execute(page, iteration, 'downstream-receive', hand.id, hand.rolls, { prefix: 'pda-', ...meta }); await downstreamPdaStock(page, iteration, hand)
    await loginPda(page, 'ID-F003', detailPath, true)
    hand = await execute(page, iteration, 'complete', hand.id, hand.rolls, { prefix: 'pda-', ...meta })
    // Complete one real source QC roll after handover with the actual source factory session.
    await loginPda(page, hand.source.factoryId, detailPath, true)
    await page.goto(baseURL + qcPath); await page.waitForSelector('[data-factory-qc-root]'); await page.locator(`[data-roll-id="${hand.rolls[0].id}"]`).click(); const inspectionPhoto = await qcPhoto(page, 1); await page.locator('[data-factory-qc-field="photos"]').setInputFiles(inspectionPhoto.payloads); await fillResults(page); await page.locator('[data-factory-qc-action="complete-roll"]').click(); await savedRoll(page, hand.rolls[0].id, true)
    await page.goto(baseURL + detailPath); await page.waitForSelector('[data-stenter-detail-root]'); await loginPda(page, 'ID-F003', detailPath, true)
    const before = await snapshot(page), rawHand = hands(before).find(row => row.value.data.id === hand.id), oldPhysicalRolls = structuredClone(hand.rolls), completedAction = active(before).find(row => row.collection === QC && row.value.kind === 'action' && row.value.data.orderId === hand.id && row.value.data.kind === 'COMPLETE'), lockedQcRoll = rolls(before).find(row => row.value.qcId === qc.id && row.value.data.id === hand.rolls[0].id)
    assert.ok(completedAction && hand.completedAt && lockedQcRoll.value.data.completedAt)
    const newRoll = { id: hand.id + '-EXPLICIT-LATE-ROLL', sourceRollId: hand.id + '-EXPLICIT-LATE-ROLL', barcode: 'PDA-EXPLICIT-LATE-' + iteration, unit: hand.rolls[0].unit, inputQty: 25 }
    const newSourceRoll = { id: newRoll.id, barcode: newRoll.barcode, batchId: 'EXPLICIT-LATE-BATCH', qty: newRoll.inputQty, unit: newRoll.unit, confirmed: true }, next = structuredClone(rawHand), nextQc = structuredClone(heads(before).find(row => row.value.data.id === qc.id)); next.version++; next.value.data.version++; next.value.data.rolls.push(newRoll); next.value.data.source.rolls.push(newSourceRoll); nextQc.version++; nextQc.value.data.version++; nextQc.value.data.source.rolls.push(newSourceRoll)
    const newQcRoll = { id: QC + '/roll/' + qc.id + '/' + encodeURIComponent(newRoll.id), collection: QC, version: 1, value: { kind: 'roll', qcId: qc.id, data: { ...newSourceRoll, photos: [], results: { color: '', handfeel: '', material: '' }, notes: '', version: 0, referenceImageUrl: qc.source.imageUrl, requiredMaterialSku: qc.source.materialSku, requirementVersion: qc.source.requirementVersion } } }
    await page.evaluate(async records => { const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); try { await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); records.forEach(record => tx.objectStore('records').put(record)); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }) } finally { db.close() } }, [next, nextQc, newQcRoll])
    await page.reload(); await page.waitForSelector('[data-stenter-handfeel-action="continue"]'); await page.locator('[data-stenter-handfeel-action="continue"]').click(); await page.locator('[data-stenter-dialog]').waitFor()
    await measured(page, 'pda-execute-continue', iteration, '[data-stenter-dialog-action="submit"]', () => page.locator('[data-stenter-dialog-action="submit"]').click(), async () => { await page.locator('[data-stenter-dialog]').waitFor({ state: 'detached' }); const after = await snapshot(page), reopened = hands(after).find(row => row.value.data.id === hand.id).value.data; assert.ok(!reopened.completedAt); assert.deepEqual(reopened.rolls.slice(0, oldPhysicalRolls.length), oldPhysicalRolls); assert.deepEqual(active(after).find(row => row.id === completedAction.id), completedAction); assert.deepEqual(rolls(after).find(row => row.id === lockedQcRoll.id), lockedQcRoll); assert.equal(rolls(after).filter(row => row.value.qcId === qc.id).length, 7); assert.ok(active(after).some(row => row.collection === QC && row.value.kind === 'action' && row.value.data.orderId === hand.id && row.value.data.kind === 'CONTINUE')); assert.equal(reopened.handFeel, hand.handFeel); await page.waitForFunction(() => document.querySelector('[data-stenter-detail-part="summary"]')?.textContent?.includes('待来源交出')); const summaryText = await page.locator('[data-stenter-detail-part="summary"]').innerText(); assert.doesNotMatch(summaryText, /待下游实收/); return { ...await paint(page, '[data-stenter-detail-root]'), orderStatus: '待来源交出', staleDownstreamPendingStatusAbsent: true, previousCompletionActionPreserved: true, oldRollFactsUnchanged: true, completedSourceQcLockUnchanged: true, newQcRolls: 1, sameOrderAndDecision: true, manualContinuation: true, addedRoll: newRoll.id } }, { ...meta, fixtureVersion: 'explicit-late-roll-state-v1', rolls: 7 })
    if (iteration === 1) await page.screenshot({ path: join(output, 'pda-authenticated-continue-390.png'), fullPage: true })
    report.cases.push({ iteration, actualPdaLogin: true, sourceId, handfeelCreatedOnlyFromQcUi: true, sourceFactory: hand.source.factoryId, processingFactory: hand.factoryId, downstreamFactory, rolls: hand.rolls.length, realUiActions: ['SEND', 'RECEIVE', 'START', 'OUTPUT', 'HANDOUT', 'DOWNSTREAM_RECEIVE', 'COMPLETE'], quantityDifferenceConfirmed: -1, qcChecksUnfinishedAndNoPhotosDuringPhysicalChain: true, fixtureNote: '只有CONTINUE使用显式后补卷状态；原7动作来源为真实改去向→QC→GTG创建链。' })
  } catch (error) { const failedPage = pdaPage || setup; report.pdaFailure = { error: error.message, route: failedPage.url(), body: await failedPage.locator('body').innerText().catch(() => '') }; await failedPage.screenshot({ path: join(output, 'pda-endpoint-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await coldContext?.close(); await origin.close() }
}

async function diagnosePdaCpu() {
  const context = await newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage()
  try {
    const qc = await configureDyeDestination(page, 'DYE-DISPATCH-DEMO-4')
    await page.goto(baseURL + DYE_LIST + '/' + encodeURIComponent(qc.id)); await page.waitForSelector('[data-factory-qc-field="needs"]')
    await page.locator('[data-factory-qc-field="needs"]').selectOption('yes'); await page.locator('[data-factory-qc-field="target"]').selectOption('柔软手感'); await page.locator('[data-factory-qc-action="decide"]').click(); await page.getByRole('link', { name: '查看定型机手感单' }).waitFor()
    const hand = hands(await snapshot(page)).find(row => row.value.data.qcId === qc.id).value.data, detailPath = '/fcs/pda/stenter-handfeel/' + encodeURIComponent(hand.id)
    const session = await loginPda(page, hand.source.factoryId, detailPath), cdp = await context.newCDPSession(page)
    await paint(page, '[data-stenter-detail-root]')
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start')
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('[data-stenter-detail-root]'); const checked = await paint(page, '[data-stenter-detail-root]')
    assert.ok(await page.locator('[data-stenter-handfeel-action="send"]').count()); assert.equal(await page.locator('[data-stenter-handfeel-action="receive"]').count(), 0)
    const { profile } = await cdp.send('Profiler.stop'); await cdp.send('Profiler.disable'); await cdp.detach()
    const filename = 'pda-actual-source-detail-refresh.cpuprofile'; await writeFile(join(output, filename), JSON.stringify(profile))
    const nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map(), self = new Map(), inclusive = new Map()
    for (const node of profile.nodes) for (const child of node.children || []) parents.set(child, node.id)
    for (let index = 0; index < (profile.samples || []).length; index++) { const id = profile.samples[index], delta = (profile.timeDeltas?.[index] || 0) / 1000; self.set(id, (self.get(id) || 0) + delta); for (let at = id; at; at = parents.get(at)) inclusive.set(at, (inclusive.get(at) || 0) + delta) }
    const top = values => [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([id, ms]) => ({ ms, id, functionName: nodes.get(id)?.callFrame.functionName || '(anonymous)', url: nodes.get(id)?.callFrame.url, lineNumber: nodes.get(id)?.callFrame.lineNumber, columnNumber: nodes.get(id)?.callFrame.columnNumber }))
    report.cpuDiagnostic = { filename, diagnosticOnly: true, notAcceptanceSample: true, route: page.url(), actualSessionFactoryId: session.factoryId, sourceId: hand.source.id, orderId: hand.id, actualUiCreatedSource: true, checked, navigation: await page.evaluate(() => ({ durationMs: performance.now(), longTasks: window.__qcLongTasks || [], resourceTimings: performance.getEntriesByType('resource').map(item => ({ name: item.name, startTime: item.startTime, responseEnd: item.responseEnd, duration: item.duration, transferSize: item.transferSize })) })), topSelf: top(self), topInclusive: top(inclusive) }
  } finally { await context.close() }
}

async function checkIteration(iteration) {
  const context = await newContext(), page = await context.newPage()
  try {
    await seedRetiredVersionOnly(page)
    // This origin-only upgrade fixture loads no application assets or pictures.
    await navigate(page, 'print-list-cold', iteration, LIST, '[data-factory-qc-root="list"]')
    const printingCount = await page.locator('tbody tr').count()
    assert.ok(await page.locator('a[aria-label="查看全部卷的质检详情"]').count())
    await navigate(page, 'print-list-refresh', iteration, LIST, '[data-factory-qc-root="list"]', true)
    const progress = 'a[aria-label="查看全部卷的质检详情"]'
    await measured(page, 'qc-detail-nav', iteration, progress, () => page.locator(progress).first().click(), async () => { await page.waitForSelector('[data-factory-qc-root="detail"]'); return paint(page, '[data-factory-qc-root]') })
    const qcId = await page.locator('[data-factory-qc-root]').getAttribute('data-factory-qc-id'), detailUrl = page.url()
    const rollButtons = page.locator('[data-factory-qc-action="select-roll"]'), rollIds = await rollButtons.evaluateAll(buttons => buttons.map(button => button.dataset.rollId))
    assert.ok(rollIds.length >= 2, '默认来源须有至少2个真实卷，不能注入来源冒充')
    await measured(page, 'roll-editor-open', iteration, '[data-factory-qc-action="select-roll"]', () => rollButtons.first().click(), async () => { await page.waitForSelector('[data-factory-qc-roll-editor]'); return paint(page, '[data-factory-qc-editor]') })
    const root = await page.locator('[data-factory-qc-root]').elementHandle(), photo = await qcPhoto(page, 2)
    const image = '[data-factory-qc-editor] [data-factory-qc-action="image"]'
    await measured(page, 'qc-image-open', iteration, image, () => page.locator(image).first().click(), async () => { await page.waitForSelector('[data-factory-qc-image-overlay]'); return paint(page, '[data-factory-qc-image-overlay]') })
    await measured(page, 'qc-image-close', iteration, '[data-factory-qc-action="close-image"]', () => page.getByRole('button', { name: '关闭', exact: true }).click(), async () => { await page.locator('[data-factory-qc-image-overlay]').waitFor({ state: 'detached' }); assert.ok(await page.locator(image).first().evaluate(node => node === document.activeElement)); return { focusRestored: true } })
    await measured(page, 'missing-complete', iteration, '[data-factory-qc-action="complete-roll"]', () => page.locator('[data-factory-qc-action="complete-roll"]').click(), async () => { await page.waitForFunction(() => document.querySelector('[data-factory-qc-roll-error]')?.textContent?.includes('三个结果')); assert.equal(rolls(await snapshot(page)).length, 0); return { rejectedBeforeCompletion: true, persistentRolls: 0 } })
    await measured(page, 'multi-photo-select', iteration, '[data-factory-qc-field="photos"]', () => page.locator('[data-factory-qc-field="photos"]').setInputFiles(photo.payloads), async () => { assert.equal(await page.locator('[data-factory-qc-editor] figure').count(), 2); return paint(page, '[data-factory-qc-editor]') }, { eventType: 'change', fileCount: photo.fileCount, fileBytes: photo.fileBytes })
    await fillResults(page)
    let dialogs = 0
    page.once('dialog', async dialog => { dialogs++; await dialog.dismiss() }); await page.getByRole('link', { name: '返回印花 QC 单列表' }).click()
    assert.equal(page.url(), detailUrl); assert.equal(dialogs, 1); assert.match(await page.locator('[data-factory-qc-field="notes"]').inputValue(), /固定预览隔离验收/)
    await page.evaluate(() => { const original = IDBObjectStore.prototype.put; window.__qcRestoreTransaction = () => { IDBObjectStore.prototype.put = original }; window.__qcAbortInjected = false; IDBObjectStore.prototype.put = function (value, ...args) { const request = original.call(this, value, ...args); if (!window.__qcAbortInjected && value?.collection === 'fcs.factory-qc.v1' && value?.value?.kind === 'roll') { window.__qcAbortInjected = true; queueMicrotask(() => this.transaction.abort()) }; return request } })
    const aborted = await measured(page, 'save-abort', iteration, '[data-factory-qc-action="save-roll"]', () => page.locator('[data-factory-qc-action="save-roll"]').click(), async () => { await page.waitForFunction(() => !!document.querySelector('[data-factory-qc-roll-error]')?.textContent?.trim()); await page.evaluate(() => window.__qcRestoreTransaction()); assert.ok(await page.evaluate(() => window.__qcAbortInjected)); const data = await snapshot(page); assert.equal(rolls(data).length, 0); assert.ok(!data.files.some(file => file.id.startsWith('FQC-PHOTO-')), '被中止的QC事务不能遗留新Blob'); assert.equal(active(data).filter(row => row.collection.startsWith('fcs.fabric-washing.')).length, 0); const shared = active(data).find(row => row.collection === PROCESS && row.value.key === 'SHARED-PREVIEW-DELIVERY'); assert.deepEqual(shared?.value.value.lines.map(line => line.id), ['KEEP-ORIGINAL']); assert.equal(shared.value.value.lines[0].qty, 12.345); assert.ok(!data.files.some(file => file.id === 'wash-file-preview-exclusive') && data.files.some(file => file.id === 'wash-file-preview-shared')); assert.equal(await page.locator('[data-factory-qc-editor] figure').count(), 2); return { transactionAborted: true, abortPhase: '真实QC卷/主单/附件共事务', photosAndInputRetained: true, persistentQcRolls: 0, orphanNewBlobs: 0, priorExplicitRetirementCommitted: true, oldBusinessGone: true, sharedOriginalAndAttachmentPreserved: true } }, { fileCount: photo.fileCount, fileBytes: photo.fileBytes })
    record('legacy-cleanup', iteration, aborted, aborted.endpointChecks, { route: page.url(), action: '[data-factory-qc-action="save-roll"]', cacheState: 'old-v2-upgraded/explicit-cleanup-then-qc-abort', reusedSample: 'save-abort:' + iteration })
    const retry = await measured(page, 'abort-retry', iteration, '[data-factory-qc-action="save-roll"]', () => page.locator('[data-factory-qc-action="save-roll"]').click(), async () => {
      const checked = await savedRoll(page, rollIds[0], false), data = await snapshot(page)
      assert.equal(active(data).filter(row => row.collection.startsWith('fcs.fabric-washing.')).length, 0)
      const shared = active(data).find(row => row.collection === PROCESS && row.value.key === 'SHARED-PREVIEW-DELIVERY')
      assert.deepEqual(shared?.value.value.lines.map(line => line.id), ['KEEP-ORIGINAL']); assert.equal(shared.value.value.lines[0].qty, 12.345)
      assert.ok(!data.files.some(file => file.id === 'wash-file-preview-exclusive') && data.files.some(file => file.id === 'wash-file-preview-shared'))
      return { ...checked, oldBusinessGone: true, sharedOriginalAndAttachmentPreserved: true }
    }, { fileCount: photo.fileCount, fileBytes: photo.fileBytes })
    assert.ok(await root.evaluate(node => node === document.querySelector('[data-factory-qc-root]')))
    await navigate(page, 'qc-detail-refresh', iteration, '', '[data-factory-qc-root="detail"]', true)
    await page.locator(`[data-roll-id="${rollIds[0]}"]`).click(); assert.equal(await page.locator('[data-factory-qc-field="handfeel"]').inputValue(), '有差异'); await paint(page, '[data-factory-qc-editor]')
    const beforeReplacement = rolls(await snapshot(page)).find(row => row.value.data.id === rollIds[0]).value.data
    await page.locator('[data-factory-qc-action="remove-photo"]').first().click(); await page.locator('[data-factory-qc-field="photos"]').setInputFiles(photo.payloads.slice(0, 1))
    await measured(page, 'photo-replace', iteration, '[data-factory-qc-action="save-roll"]', () => page.locator('[data-factory-qc-action="save-roll"]').click(), async () => { const check = await savedRoll(page, rollIds[0], false), after = rolls(await snapshot(page)).find(row => row.value.data.id === rollIds[0]).value.data; assert.equal(after.photos.length, 2); assert.ok(!after.photos.some(item => item.id === beforeReplacement.photos[0].id)); assert.ok(after.photos.some(item => item.id === beforeReplacement.photos[1].id)); return { ...check, oldReferenceRemoved: true, otherReferencePreserved: true } }, { fileCount: 1, fileBytes: photo.fileBytes / 2 })
    const stalePage = await context.newPage(); await stalePage.goto(detailUrl); await stalePage.waitForSelector('[data-factory-qc-root="detail"]'); await stalePage.locator(`[data-roll-id="${rollIds[0]}"]`).click(); await stalePage.locator('[data-factory-qc-field="notes"]').fill('另一已打开编辑页草稿，完成后不可覆盖')
    await measured(page, 'roll-complete', iteration, '[data-factory-qc-action="complete-roll"]', () => page.locator('[data-factory-qc-action="complete-roll"]').click(), async () => { await page.waitForFunction(() => document.querySelector('[data-factory-qc-editor]')?.textContent?.includes('记录只读')); assert.equal(await page.locator('[data-factory-qc-action="save-roll"]').count(), 0); return savedRoll(page, rollIds[0], true) })
    const completedBefore = rolls(await snapshot(page)).find(row => row.value.data.id === rollIds[0]).value.data
    await measured(stalePage, 'completed-stale-editor-reject', iteration, '[data-factory-qc-action="save-roll"]', () => stalePage.locator('[data-factory-qc-action="save-roll"]').click(), async () => { await stalePage.waitForFunction(() => document.querySelector('[data-factory-qc-error]')?.textContent?.includes('已完成质检')); assert.deepEqual(rolls(await snapshot(stalePage)).find(row => row.value.data.id === rollIds[0]).value.data, completedBefore); assert.equal(await stalePage.locator('[data-factory-qc-field="notes"]').count(), 0); return { completedLockPreserved: true, staleDraftDidNotOverwrite: true, displayedReadonly: true, ...await paint(stalePage, '[data-factory-qc-editor]') } }); stalePage.on('dialog', dialog => dialog.accept()); await stalePage.close({ runBeforeUnload: false })
    if (iteration === 1) { await page.locator('[data-factory-qc-editor]').scrollIntoViewIfNeeded(); await page.screenshot({ path: join(output, 'completed-roll-1366.png') }); for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 768 }]) { await page.setViewportSize(size); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: join(output, `completed-roll-${size.width}.png`) }) }; await page.setViewportSize(viewport) }
    await page.locator(`[data-roll-id="${rollIds[1]}"]`).click(); const single = await qcPhoto(page, 1)
    await measured(page, 'single-photo-select', iteration, '[data-factory-qc-field="photos"]', () => page.locator('[data-factory-qc-field="photos"]').setInputFiles(single.payloads), async () => { assert.equal(await page.locator('[data-factory-qc-editor] figure').count(), 1); return paint(page, '[data-factory-qc-editor]') }, { eventType: 'change', fileCount: single.fileCount, fileBytes: single.fileBytes })
    await fillResults(page)
    await measured(page, 'new-photo-save', iteration, '[data-factory-qc-action="save-roll"]', () => page.locator('[data-factory-qc-action="save-roll"]').click(), () => savedRoll(page, rollIds[1], false), { fileCount: single.fileCount, fileBytes: single.fileBytes })
    await page.locator('[data-factory-qc-field="needs"]').selectOption('yes')
    await measured(page, 'needs-no-target', iteration, '[data-factory-qc-action="decide"]', () => page.locator('[data-factory-qc-action="decide"]').click(), async () => { await page.getByRole('link', { name: '查看定型机手感单' }).waitFor(); const data = await snapshot(page), order = hands(data).find(row => row.value.data.qcId === qcId)?.value.data; assert.ok(order && order.factoryId === 'ID-F003' && !order.handFeel); assert.equal(hands(data).filter(row => row.value.data.qcId === qcId).length, 1); assert.ok(order.rolls.every(roll => !roll.sentAt && !roll.receivedAt)); return { orderId: order.id, targetMissingAllowed: true, factoryId: order.factoryId, noFakeHandoff: true } })
    let hand = hands(await snapshot(page)).find(row => row.value.data.qcId === qcId).value.data
    report.scale.push({ iteration, printingCount, sourceId: hand.source.id, sourceType: hand.source.kind, sourceRolls: hand.rolls.length, quantities: hand.rolls.map(roll => ({ qty: roll.inputQty, unit: roll.unit })), photoBytes: photo.fileBytes + single.fileBytes, photoFiles: 3, oldRecords: 2, sharedOriginalQty: 12.345 })
    await measured(page, 'stenter-detail-nav', iteration, 'a[data-nav]', () => page.getByRole('link', { name: '查看定型机手感单' }).click(), async () => { await page.waitForSelector('[data-stenter-detail-root]'); assert.match(await page.locator('[data-stenter-detail-root]').innerText(), /GTG/); return paint(page, '[data-stenter-detail-root]') })
    const handImage = '[data-stenter-detail-part="summary"] [data-stenter-handfeel-action="image"]'
    await measured(page, 'stenter-image-open', iteration, handImage, () => page.locator(handImage).first().click(), async () => { await page.getByRole('dialog').waitFor(); return paint(page, 'dialog[open]') })
    await eventTimer(page, 'dialog[open]', 'keydown'); await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' }); assert.ok(await page.locator(handImage).first().evaluate(node => node === document.activeElement)); const imageTimer = await page.evaluate(() => ({ start: window.__qcPerfTimer?.start, end: performance.now() })); record('stenter-image-close', iteration, imageTimer, { focusRestored: true }, { route: page.url(), action: 'Escape', cacheState: 'existing-context' })
    await page.locator('[data-stenter-handfeel-action="target"]').click(); await page.locator('[data-stenter-target]').selectOption('柔软手感')
    await measured(page, 'target-supplement', iteration, '[data-stenter-dialog-action="submit"]', () => page.locator('[data-stenter-dialog-action="submit"]').click(), async () => { await page.locator('[data-stenter-dialog]').waitFor({ state: 'detached' }); const data = await snapshot(page); hand = hands(data).find(row => row.value.data.id === hand.id).value.data; assert.equal(hand.handFeel, '柔软手感'); assert.equal(heads(data).find(row => row.value.data.id === qcId).value.data.decision.target, '柔软手感'); await paint(page, '[data-stenter-detail-root]'); return { target: hand.handFeel, qcTargetSynchronized: true } })
    hand = await execute(page, iteration, 'send', hand.id, hand.rolls)
    await measured(page, 'execute-dialog-open', iteration, '[data-stenter-handfeel-action="receive"]', () => page.locator('[data-stenter-handfeel-action="receive"]').first().click(), async () => { await page.locator('[data-stenter-dialog]').waitFor(); assert.ok(await page.locator('[data-stenter-position] option').count() > 1); return paint(page, '[data-stenter-dialog]') })
    await measured(page, 'execute-dialog-cancel', iteration, '[data-stenter-dialog-action="close"]', () => page.getByRole('button', { name: '取消', exact: true }).click(), async () => { await page.locator('[data-stenter-dialog]').waitFor({ state: 'detached' }); assert.ok(hands(await snapshot(page)).find(row => row.value.data.id === hand.id).value.data.rolls.every(roll => !roll.receivedAt)); return { noReceiptCreated: true } })
    hand = await execute(page, iteration, 'receive', hand.id, hand.rolls)
    hand = await execute(page, iteration, 'start', hand.id, hand.rolls)
    hand = await execute(page, iteration, 'output', hand.id, hand.rolls)
    await pdfExport(page, iteration, false, hand); await pdfExport(page, iteration, true, hand)
    hand = await execute(page, iteration, 'handout', hand.id, hand.rolls)
    hand = await execute(page, iteration, 'downstream-receive', hand.id, hand.rolls)
    hand = await execute(page, iteration, 'complete', hand.id, hand.rolls)
    await navigate(page, 'stenter-detail-refresh', iteration, '', '[data-stenter-detail-root]', true)
    await measured(page, 'stenter-list-nav', iteration, 'a[data-nav]', () => page.getByRole('link', { name: '返回列表', exact: true }).click(), async () => { await page.waitForSelector('[data-stenter-list-root]'); assert.match(await page.locator('[data-stenter-list-root]').innerText(), /已完单/); return paint(page, '[data-stenter-list-root]') })
    await page.locator('[data-stenter-filter="query"]').fill(hand.no)
    await measured(page, 'stenter-query', iteration, '[data-stenter-handfeel-action="query"]', () => page.locator('[data-stenter-handfeel-action="query"]').click(), async () => { assert.equal(await page.locator('[data-stenter-list-root] tbody tr').count(), 1); return paint(page, '[data-stenter-list-root]') })
    await measured(page, 'stenter-reset', iteration, '[data-stenter-handfeel-action="reset"]', () => page.locator('[data-stenter-handfeel-action="reset"]').click(), () => paint(page, '[data-stenter-list-root]'))
    await page.goto(baseURL + LIST); await page.waitForSelector('[data-factory-qc-root]')
    const otherIndex = await page.locator(progress).evaluateAll((anchors, originalId) => anchors.findIndex(anchor => decodeURIComponent(anchor.getAttribute('data-nav').split('/').at(-1)) !== originalId), qcId)
    assert.ok(otherIndex >= 0, '第二个来源必须按稳定QC身份选择，不能依赖静态/已存记录排序')
    await page.locator(progress).nth(otherIndex).click(); await page.waitForSelector('[data-factory-qc-root="detail"]'); await page.locator('[data-factory-qc-field="needs"]').selectOption('no')
    const otherQcId = await page.locator('[data-factory-qc-root]').getAttribute('data-factory-qc-id')
    await measured(page, 'no-handfeel', iteration, '[data-factory-qc-action="decide"]', () => page.locator('[data-factory-qc-action="decide"]').click(), async () => { await page.waitForFunction(() => document.querySelector('[data-factory-qc-handfeel]')?.textContent?.includes('已记录整单决定')); const data = await snapshot(page), qc = heads(data).find(row => row.value.data.id === otherQcId).value.data; assert.equal(qc.decision.needs, false); assert.equal(hands(data).filter(row => row.value.data.qcId === otherQcId).length, 0); return { needs: false, newHandfeelOrders: 0, sourceType: qc.source.kind, sourceId: qc.source.id } })
    await checkScale(iteration, hand)
    report.cases.push({ iteration, status: 'passed', sourceId: hand.source.id, orderId: hand.id, handfeelCreatedOnlyFromUi: true, actualUiChain: ['整单需要', 'GTG目标', '来源交出', 'GTG实收', '投入', '实际产出', '交出', '下游实收', '人工完单'] })
  } catch (error) {
    report.endpointFailure = { route: page.url(), error: error.message, visibleErrors: await page.locator('[role="alert"]').allTextContents().catch(() => []), visibleBody: await page.locator('body').innerText().catch(() => '') }
    await page.screenshot({ path: join(output, 'endpoint-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { await context.close() }
  const mobileContext = await newContext(), mobile = await mobileContext.newPage()
  try {
    await mobile.setViewportSize({ width: 390, height: 844 })
    await mobile.goto(baseURL + '/fcs/pda/stenter-handfeel', { waitUntil: 'domcontentloaded' }); await mobile.waitForFunction(() => location.pathname.startsWith('/fcs/pda/auth/login') && document.body.textContent.includes('登录')); const pdaTiming = await mobile.evaluate(() => ({ start: performance.getEntriesByType('navigation')[0]?.startTime ?? 0, end: performance.now() })); assert.equal(await mobile.locator('[data-stenter-handfeel-action="send"]').count(), 0); assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); record('pda-login-gate-cold', iteration, pdaTiming, { existingLoginGuard: true, noUnauthorizedActions: true }, { route: mobile.url(), action: 'browser navigation', cacheState: 'new-context/empty-browser-cache', viewport: { width: 390, height: 844 } }); if (iteration === 1) await mobile.screenshot({ path: join(output, 'pda-no-session-390.png') })
  } finally { await mobileContext.close() }
  const dyeContext = await newContext(), dyePage = await dyeContext.newPage()
  try {
    await navigate(dyePage, 'dye-list-cold', iteration, DYE_LIST, '[data-factory-qc-root="list"]', false, {}, async () => { const rows = await dyePage.locator('tbody tr').count(), text = await dyePage.locator('tbody').innerText(); assert.ok(rows >= 1 && text.includes('染色')); return { rows, sourceType: text.includes('独立水溶') ? 'DYEING/WATER_SOLUBLE' : 'DYEING', nativeFinalProjection: true } })
    const rowCount = await dyePage.locator('tbody tr').count(), dyeKinds = (await dyePage.locator('tbody').innerText()).includes('独立水溶') ? 'DYEING/WATER_SOLUBLE' : 'DYEING', dyeMeta = { rows: rowCount, sourceType: dyeKinds, sourceIdentityScope: '实际原生最终状态所得默认染厂聚合列表，张数动态读取' }
    report.cases.push({ iteration, case: '默认染厂QC列表实际来源', rows: rowCount, sourceKinds: dyeKinds, visibleRows: await dyePage.locator('tbody tr').allTextContents(), rule: '暂停、继续加工、返工中的正累计量不冒充最终实物' })
    await dyePage.locator('[data-factory-qc-filter="query"]').fill('PREVIEW-NO-MATCH')
    await measured(dyePage, 'qc-query', iteration, '[data-factory-qc-action="query"]', () => dyePage.locator('[data-factory-qc-action="query"]').click(), async () => { assert.match(await dyePage.locator('tbody').innerText(), /暂无符合条件/); return paint(dyePage, '[data-factory-qc-root]') }, { ...dyeMeta, matches: 0 })
    await measured(dyePage, 'qc-reset', iteration, '[data-factory-qc-action="reset"]', () => dyePage.locator('[data-factory-qc-action="reset"]').click(), async () => { assert.equal(await dyePage.locator('tbody tr').count(), rowCount); return paint(dyePage, '[data-factory-qc-root]') }, { ...dyeMeta, matches: rowCount })
    await measured(dyePage, 'qc-columns-open', iteration, '[data-factory-qc-action="columns"]', () => dyePage.locator('[data-factory-qc-action="columns"]').click(), async () => { await dyePage.waitForSelector('[data-factory-qc-action="close-columns"]'); return { settingsInteractive: true } }, dyeMeta)
    await measured(dyePage, 'qc-columns-close', iteration, '[data-factory-qc-action="close-columns"]', () => dyePage.getByRole('button', { name: '关闭', exact: true }).click(), async () => { await dyePage.locator('[data-factory-qc-action="close-columns"]').first().waitFor({ state: 'detached' }); assert.ok(await dyePage.locator('[data-factory-qc-action="columns"]').evaluate(node => node === document.activeElement)); return { focusRestored: true } }, dyeMeta)
    if (iteration === 1) await dyePage.screenshot({ path: join(output, 'dye-qc-list-1366.png') })
  } finally { await dyeContext.close() }
}

try {
  const response = await fetch(baseURL), html = await response.text()
  assert.ok(response.ok && html.includes('/assets/') && !html.includes('/@vite/client'), '必须是固定生产预览资产，不能测dev服务')
  await persist()
  if (cpuDiagnostic) await diagnosePdaCpu()
  else for (let iteration = 1; iteration <= trials; iteration++) { if (!onlyPda) await checkIteration(iteration); if (!skipPda) { await checkPda(iteration); await checkPartialHandout(iteration) }; await persist() }
  report.status = report.samples.some(sample => sample.result !== 'passed') || report.browserErrors.length || report.navigationPreparations?.some(item => item.result === 'slow') || report.directInteractions?.some(item => item.result === 'slow') ? 'failed' : 'passed'
} catch (error) {
  report.status = 'blocked'
  report.failure = { message: error.message, stack: error.stack, rule: '第一处前置/采集/终点错误暂停，不延长等待冒通过；有效慢样本继续保留' }
  console.error(error)
} finally {
  await browser.close()
  report.finishedAt = new Date().toISOString()
  for (const sample of report.samples) {
    const scope = report.scale.find(item => item.iteration === sample.iteration)
    const aggregate = ['dye-list-cold', 'qc-query', 'qc-reset', 'qc-columns-open', 'qc-columns-close'].includes(sample.member)
    if (aggregate) { sample.sourceType ||= 'DYEING/WATER_SOLUBLE'; sample.sourceIdentityScope = '默认染厂QC聚合列表，非单一来源；行数在查询终点登记' }
    else if (sample.member === 'pda-login-gate-cold') sample.sourceIdentityScope = '未登录直达，尚无工厂或来源任务身份'
    else if (scope) { sample.sourceType ||= scope.sourceType; sample.sourceId ||= scope.sourceId; sample.rolls ??= scope.sourceRolls; sample.rows ??= sample.member === 'print-list-cold' || sample.member === 'print-list-refresh' ? scope.printingCount : sample.member.startsWith('stenter-list') || sample.member === 'stenter-query' || sample.member === 'stenter-reset' ? 1 : scope.sourceRolls }
  }
  report.assetsStable = JSON.stringify(await assets()) === JSON.stringify(manifestBefore)
  if (!report.assetsStable) report.status = 'invalid-assets-changed'
  report.summary = families.map(spec => { const samples = report.samples.filter(sample => sample.member === spec.id); return { ...spec, actualSamples: samples.length, maximumMs: samples.length ? Math.max(...samples.map(sample => sample.durationMs)) : null, slowSamples: samples.filter(sample => sample.result === 'slow').map(sample => ({ iteration: sample.iteration, durationMs: sample.durationMs })), status: samples.length < trials ? 'incomplete' : samples.some(sample => sample.result !== 'passed') ? 'failed' : 'passed' } })
  report.slowSamples = report.samples.filter(sample => sample.result === 'slow')
  report.slowPreparations = (report.navigationPreparations || []).filter(item => item.result === 'slow')
  report.slowDirectInteractions = (report.directInteractions || []).filter(item => item.result === 'slow')
  if (!cpuDiagnostic && report.summary.some(item => item.status === 'incomplete') && report.status === 'passed') report.status = 'incomplete'
  await persist()
  console.log(JSON.stringify({ output, status: report.status, families: families.length, samples: report.samples.length, slowSamples: report.slowSamples.length, slowPreparations: report.slowPreparations.length, slowDirectInteractions: report.slowDirectInteractions.length, assetsStable: report.assetsStable, calibration }))
  process.exitCode = report.status === 'passed' ? 0 : 1
}
