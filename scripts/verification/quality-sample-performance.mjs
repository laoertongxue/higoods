#!/usr/bin/env node
// 本轮性能依据：用户2026-10-22确认不超过2秒、功能优先；保留原负载及逐样本验证。
/** Original PPIC sample page performance. Only isolated native IndexedDB fixtures; no product hooks or /src browser imports. */
import { buildQualityPerformanceFixture, QUALITY_PERFORMANCE_SHAPE, QUALITY_PERFORMANCE_SEED, startQualityPerformanceFixtureServer, installQualityPerformanceNativeFixture } from './quality-performance-fixture.mjs'
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpus, platform, totalmem, freemem, loadavg } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || fallback
const base = (option('--base', process.env.BASE_URL || 'http://127.0.0.1:43527')).replace(/\/$/, '')
const dist = resolve(option('--dist-dir', 'dist'))
const diagnosticPair = args.includes('--diagnostic-pair')
const cpuProfile = args.includes('--cpu-profile')
const output = resolve(option('--output', 'output/qc-implementation-20261022/sample-performance'))
const diagnostic = args.includes('--diagnostic'), required = 5, limitMs = Number(option('--limit-ms','2000'))
if(!Number.isFinite(limitMs)||limitMs<1||limitMs>2000)throw Error('The per-sample limit must tighten the approved 2000ms ceiling, never raise it')
const trials = Number(option('--trials', diagnostic ? '1' : '5'))
const root = '/fcs/sewing-outsourcing/sample-approval-suggestions'
const modes = ['COLD', 'REFRESH', 'SPA']
const modalKinds = ['receive', 'claim', 'opinion', 'card']
const states = ['receive', 'received', 'handed', 'claimed', 'opinion', 'feedback']
const tabs = ['PENDING_RETURN', 'PENDING_APPROVAL', 'PENDING_FEEDBACK', 'COMPLETED']
const stageTab = { receive: 'PENDING_RETURN', received: 'PENDING_APPROVAL', handed: 'PENDING_APPROVAL', claimed: 'PENDING_APPROVAL', opinion: 'PENDING_FEEDBACK', feedback: 'COMPLETED' }
const modal = { receive: ['receive', 'receive-sample', 'PPIC接收产前版样衣'], claim: ['handed', 'start-approval', '领取批版'], opinion: ['claimed', 'open-approval', '填写批版建议'], card: ['feedback', 'show-card', '批版建议卡'] }
const descriptions = {
  ...Object.fromEntries(modes.map(mode => [`entry:list:${mode}`, `Original single sample-list route, ${mode.toLowerCase()} document/application entry.`])),
  ...Object.fromEntries(modes.flatMap(mode => modalKinds.map(kind => [`open:${kind}:${mode}`, `Actual ${kind} button after an independently measured ${mode.toLowerCase()} list entry. Modal has no independent URL; start is its trusted click.`]))),
  ...Object.fromEntries(tabs.map(tab => [`state-list:${tab}`, `Real ${tab} tab click and current full-source count/paginated list.`])),
  'action:query': 'Original keyword query over all 2000 persisted historical samples.',
  'action:pagination': 'Original next page, changed first sample; no reduced history.',
  'select:receipt-photo-2MiB': 'Actual original file-input selection event through FileReader, matching-image preview and stable DOM.',
  'save:receive': 'Original PPIC receive with 2MiB image; cutting transaction complete and independent native record/Blob readback.',
  'save:handoff': 'Original PPIC physical handoff record through transaction complete and native readback.',
  'save:claim': 'Actual name/responsibility confirmation, current effective 40-item standard fixed once, transaction complete and readback.',
  'select:opinion-10x512KiB': 'Actual original input selects ten different matching-style 512KiB images; preview handling and decode.',
  'save:first-opinion': 'Original claimant, associated issue and required confirmation; ten original Blobs + single first opinion saved and independently read.',
  'save:feedback': 'Original PPIC feedback registration, original first opinion preserved; no extra paper or external receipt invented.',
  'action:card-image-zoom': 'Original suggestion-card actual related image opens at full size and decodes.',
}
const plan = {
  originalRoute: root, inheritedFixture: { seed: QUALITY_PERFORMANCE_SEED, shape: QUALITY_PERFORMANCE_SHAPE, baselineNeverRemoved: true },
  appendedSource: '30 canonical samples (five per six actual stages), original effective assignments/current indexes, formal production-order copies with the same bound source product/technical version, original sample commands and original cutting Blob store. Added records are isolated performance copies, not field work.',
  imagePolicy: 'All upload bytes retain the exact matching original garment JPEG. Only trailing performance bytes distinguish fixtures and reach 2MiB or512KiB; the visible garment is unchanged. Native business records persist original Blob references, never Base64. This does not claim field photography or physical signature.',
  cacheBoundary: 'COLD uses a fresh browser/HTTP context and a real fixed-preview static blank document only for native fixture installation. REFRESH is actual reload. SPA uses a trusted ordinary data-nav link. Modals are measured from actual original-row clicks after each entry mode; they are not advertised as cold URL routes.',
  endpoint: 'navigationStart or actual capture-phase click/file-change → original reads/computation/FileReader → saving native cutting transaction complete → independent exact original record/Blob reference,size,type,SHA readback → required visible/selected image decode → unchanged business DOM for two animation frames. Controller polling/screenshots excluded.',
  families: descriptions, requiredSamplesPerFamily: required, perSampleMaxMs: limitMs, viewport: { width: 1366, height: 768 },
  devices: 'This collector measures original desktop PPIC UI. Functional 1024/1280/1366 and printed-card evidence remain in sample-approval-quality.spec.ts, separate from this raw performance result.',
}
if (!args.includes('--prepare') && !args.includes('--run')) {
  console.log(JSON.stringify({ prepared: true, executed: false, plan,
    usage: 'node --import tsx scripts/verification/quality-sample-performance.mjs --prepare|--run --base=http://127.0.0.1:<fixed-preview> [--diagnostic --trials=1] [--output=PATH]' }, null, 2))
  process.exit(0)
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw Error('Only a local isolated prototype service is allowed.')
if (diagnosticPair && (!diagnostic || trials !== 1)) throw Error('The cold/receive pair is a one-trial diagnostic only.')
if (cpuProfile && !diagnostic) throw Error('CPU profiling is diagnostic-only and cannot supply formal performance acceptance samples.')
if (!Number.isSafeInteger(trials) || trials < 1 || !diagnostic && trials < required) throw Error('Formal samples require at least five trials for every family.')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sourceFiles = ['src/data/fcs/sample-quality-read-source.ts', 'src/data/fcs/sewing-sample-approval-suggestion.ts', 'src/data/fcs/sewing-outsourcing-demo.ts', 'src/data/fcs/effective-task-assignments.ts', 'src/data/fcs/production-context-records.ts', 'src/data/fcs/production-context-actions.ts', 'src/data/fcs/cutting/cutting-record-repository.ts', 'src/pages/sewing-outsourcing/sample-approval-suggestions.ts', 'src/main.ts', 'scripts/verification/quality-performance-fixture.mjs']
const sourceHashes = () => Object.fromEntries(sourceFiles.map(path => [path, sha(readFileSync(path))]))
const beforeHashes = sourceHashes()
mkdirSync(output, { recursive: true })

function matchingJpeg(source, size, marker) {
  if (!source.subarray(0, 2).equals(Buffer.from([255, 216])) || source.length > size - marker.length) throw Error('Matching original JPEG is absent or too large; do not substitute unrelated material.')
  const bytes = Buffer.alloc(size, 0)
  source.copy(bytes); bytes.write(marker, source.length, 'utf8')
  return { name: `${marker}.jpg`, mimeType: 'image/jpeg', buffer: bytes, size, sha256: sha(bytes), fileId: `production-context-file:${sha(bytes)}` }
}

async function buildSampleFixture() {
  const fixture = await buildQualityPerformanceFixture()
  const inherited = structuredClone(fixture.manifest)
  const samples = await import('../../src/data/fcs/sewing-sample-approval-suggestion.ts')
  const assignments = await import('../../src/data/fcs/effective-task-assignments.ts')
  const context = await import('../../src/data/fcs/production-context-records.ts')
  const orders = await import('../../src/data/fcs/production-orders.ts')
  const q = await import('../../src/data/fcs/quality-management-records.ts')
  const { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC: allocationPpic } = await import('../../src/data/fcs/factory-onboarding-ppic.ts')
  const sampleTemplate = samples.listSewingSampleApprovalRecords().find(record => record.suggestionVersions.length)
  const assignmentTemplate = assignments.getEffectiveTaskAssignment(sampleTemplate.assignmentId)
  const orderTemplate = orders.productionOrders.find(order => order.productionOrderId === sampleTemplate.sample.productionOrderId)
  if (!assignmentTemplate || !orderTemplate?.techPackSnapshot || !sampleTemplate.sample.styleImageUrl.startsWith('/')) throw Error('Original bound product, technical pack, sample and assignment are required.')
  const originalJpeg = readFileSync(resolve('public', sampleTemplate.sample.styleImageUrl.slice(1)))
  const receipt = matchingJpeg(originalJpeg, 2 * 1024 * 1024, 'PPERF-receipt-2MiB')
  const receiptUploads = Array.from({ length: trials }, (_, trial) => matchingJpeg(originalJpeg, 2 * 1024 * 1024, `PPERF-new-receipt-${trial}`))
  const cardFiles = Array.from({ length: 10 }, (_, n) => matchingJpeg(originalJpeg, 512 * 1024, `PPERF-card-${n}`))
  const actionFiles = Array.from({ length: trials }, (_, trial) => Array.from({ length: 10 }, (_, n) => matchingJpeg(originalJpeg, 512 * 1024, `PPERF-opinion-${trial}-${n}`)))
  const configs = fixture.pcs.filter(row => row.collection === 'quality/config').map(row => row.value)
  const ids = [], sourceOrders = [], nativeFileMap = new Map([[receipt.fileId, receipt], ...cardFiles.map(file => [file.fileId, file])])
  const knownTime = '2026-10-22T01:00:00.000Z'
  for (let trial = 0; trial < required; trial++) {
    const group = { trial, approver: `隔离性能批版人${trial}` }
    for (let stageIndex = 0; stageIndex < states.length; stageIndex++) {
      const state = states[stageIndex], id = `PPERF-ASG-${state}-${trial}`, taskId = `PPERF-TASK-${state}-${trial}`
      const orderId = `PPERF-ORDER-${state}-${trial}`, taskNo = `PPERF-${state.toUpperCase()}-${trial}`
      const order = structuredClone(orderTemplate)
      order.productionOrderId = orderId; order.productionOrderNo = orderId
      order.techPackSnapshot.productionOrderId = orderId; order.techPackSnapshot.productionOrderNo = orderId
      order.selectedTechPackVersionId = order.techPackSnapshot.sourceTechPackVersionId
      orders.validatePersistedProductionOrders([order])
      orders.productionOrders.push(order); sourceOrders.push(order)
      const assignment = assignments.createEffectiveTaskAssignment({ ...assignmentTemplate, assignmentId: id, runtimeTaskId: taskId,
        productionOrderId: orderId, productionOrderNo: orderId, taskNo, operatedAt: knownTime, businessAssignedAt: knownTime,
        operatedBy: allocationPpic.ppicName, allocationOperatorPpicId: allocationPpic.ppicId, allocationOperatorPpicName: allocationPpic.ppicName })
      group.ppicId = assignment.ppicId; group.ppicName = assignment.ppicName
      const ppic = { actorId: assignment.ppicId, actorName: assignment.ppicName, role: 'PPIC' }
      const approver = { actorId: `PPERF-CLAIMANT-${trial}`, actorName: group.approver, role: 'SAMPLE_APPROVER' }
      if (stageIndex >= 1) samples.receivePreProductionSampleByPpic({ assignmentId: id, commandId: `${id}:receive`, actor: ppic, receivedAt: knownTime, receivedSamplePhotoUrls: [sampleTemplate.sample.styleImageUrl] })
      if (stageIndex >= 2) samples.handoffPreProductionSampleToApprover({ assignmentId: id, commandId: `${id}:handoff`, actor: ppic, handedAt: knownTime, approverTeamName: '隔离性能批版组' })
      if (stageIndex >= 3) samples.startSampleApproval({ assignmentId: id, commandId: `${id}:claim`, actor: approver, receivedAt: knownTime,
        inspectionStandardSnapshot: q.buildInspectionSnapshotFromConfigurations({ sourceKind: 'PRE_PRODUCTION_SAMPLE', stage: 'PRE_PRODUCTION_SAMPLE_APPROVAL', objectType: 'GARMENT', styleId: order.techPackSnapshot.styleId, styleCode: order.techPackSnapshot.styleCode }, configs, 1) })
      if (stageIndex >= 4) {
        const record = samples.getSewingSampleApprovalRecord(id)
        samples.submitSampleApprovalSuggestion({ assignmentId: id, commandId: `${id}:opinion`, actor: approver, uploadedAt: knownTime,
          conclusion: 'HAS_PROBLEM', issues: [{ itemId: record.inspectionStandardSnapshot.items[0].id, note: '隔离性能来源意见：核对本件尺寸。' }],
          structuredComments: { processComment: '隔离性能样衣意见，非现场批版事实。' }, approvalSheetPhotoUrls: [] })
      }
      if (stageIndex >= 5) samples.recordSampleApprovalFeedbackToFactory({ assignmentId: id, commandId: `${id}:feedback`, actor: ppic, feedbackAt: knownTime, feedbackNote: '隔离性能已反馈阶段夹具，非外部消息或收悉回执。' })
      group[state] = { assignmentId: id, taskId, taskNo, orderId, sampleId: samples.getSewingSampleApprovalRecord(id).sample.sampleId, state }
    }
    ids.push(group)
  }
  const selected = new Set(ids.flatMap(group => states.map(state => group[state].assignmentId)))
  const sampleState = samples.captureSewingSampleState(), assignmentState = assignments.captureEffectiveTaskAssignmentState()
  const appendedSamples = sampleState.records.filter(([id]) => selected.has(id)).map(([, record]) => {
    if (record.sample.ppicReceivedAt) record.sample.ppicReceivedSamplePhotoUrls = [{ $productionFile: receipt.fileId }]
    for (const suggestion of record.suggestionVersions) suggestion.approvalSheetPhotoUrls = cardFiles.map(file => ({ $productionFile: file.fileId }))
    return record
  })
  const extra = [
    ...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.orders, JSON.stringify({ version: 1, orders: sourceOrders })),
    ...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.samples, JSON.stringify({ version: 3, records: appendedSamples,
      commands: sampleState.commands.filter(([, result]) => selected.has(result.assignmentId)), sequence: Math.max(2000, sampleState.sequence) + selected.size })),
    ...context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.assignments, JSON.stringify({ version: 2,
      assignments: assignmentState.assignments.filter(([id]) => selected.has(id)), current: assignmentState.current.filter(([, values]) => values.some(id => selected.has(id))),
      auditLogs: assignmentState.auditLogs.filter(log => selected.has(log.assignmentId)), assignmentSeq: 2000 + selected.size, auditSeq: assignmentState.auditSeq })),
  ]
  const originalCutting = fixture.cutting
  fixture.cutting = [...new Map([...fixture.cutting, ...extra].map(row => [row.id, row])).values()]
  const historical = fixture.cutting.filter(row => row.collection === 'production-context:samples' && row.value.assignmentId.startsWith('QPERF-ASG-'))
  if (historical.length !== 2000 || fixture.manifest.actual.rounds !== 20000 || fixture.manifest.actual.production + fixture.manifest.actual.inventory + historical.length !== 10000 || appendedSamples.length !== 30) throw Error('Historical performance load or appended canonical source count was lost.')
  const digest = createHash('sha256'); let rowBytes = 0
  for (const row of [...fixture.pcs, ...fixture.cutting]) { const value = JSON.stringify(row); digest.update(value); rowBytes += Buffer.byteLength(value) }
  return { ...fixture, originalCutting, appendedCutting: extra, nativeFiles: [...nativeFileMap.values()], receipt, receiptUploads, cardFiles, actionFiles, ids,
    manifest: { inherited, appended: { samples: 30, states, records: extra.length, distinctOrders: sourceOrders.length,
      sharedNativeBlobBytes: [...nativeFileMap.values()].reduce((n, file) => n + file.size, 0), actionOpinionBytesPerTrial: 10 * 512 * 1024, actionReceiptUploads: receiptUploads.map(({ fileId, size, sha256 }) => ({ fileId, size, sha256, preloaded: false })) },
      rowBytes, sha256: digest.digest('hex'), sourceImage: { path: sampleTemplate.sample.styleImageUrl, sha256: sha(originalJpeg), styleCode: sampleTemplate.sample.styleCode, technicalVersionId: orderTemplate.techPackSnapshot.sourceTechPackVersionId },
      nativeFileMetadata: [...nativeFileMap.values()].map(({ name, fileId, size, sha256, mimeType }) => ({ name, fileId, size, sha256, mimeType })) } }
}

const fixture = await buildSampleFixture()
if (JSON.stringify(beforeHashes) !== JSON.stringify(sourceHashes())) throw Error('Source changed while building the fixture; regenerate in a fixed-source window.')
writeFileSync(resolve(output, 'fixture-manifest.json'), JSON.stringify({ ...fixture.manifest, sourceHashes: beforeHashes }, null, 2))
if (!args.includes('--run')) { console.log(JSON.stringify({ prepared: true, executed: false, manifest: fixture.manifest, plan }, null, 2)); process.exit(0) }

const response = await fetch(base + '/'), index = await response.text()
if (!response.ok || index.includes('/@vite/client') || !/\/assets\/[^"']+\.js/.test(index)) throw Error('Use a fixed built preview. Vite development pages cannot establish formal performance.')
const runId = new Date().toISOString().replaceAll(':', '-'), runDir = resolve(output, runId)
mkdirSync(runDir, { recursive: true })
const buildHashes = () => Object.fromEntries(['index.html', ...readdirSync(resolve(dist, 'assets')).map(name => 'assets/' + name)].filter(name => /(?:index\.html|\.(?:js|css))$/.test(name)).map(name => [name, sha(readFileSync(resolve(dist, name)))]))
const buildAtStart = buildHashes(), preloadPath = '/__quality-sample-preload.html', preloadFile = resolve(dist, preloadPath.slice(1))
const preloadHtml = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>原样衣隔离夹具预装</title><link rel="icon" href="data:,"></head><body>只预装原库；不加载应用资源</body></html>'
const preloadCreated = !existsSync(preloadFile)
if (preloadCreated) writeFileSync(preloadFile, preloadHtml, { flag: 'wx' })
else if (readFileSync(preloadFile, 'utf8') !== preloadHtml) throw Error('Refusing to overwrite a different existing preload document.')
const preloadResponse = await fetch(base + preloadPath), preloadBytes = await preloadResponse.text()
if (!preloadResponse.ok || preloadBytes !== preloadHtml) throw Error('Fixed preview must serve the exact verification blank HTML as a real GET, without app fallback.')
const transport = await startQualityPerformanceFixtureServer({ fixture: { pcs: fixture.pcs, cutting: fixture.originalCutting, manifest: fixture.manifest.inherited }, allowedOrigin: new URL(base).origin, overlays: { sample: [] } })
const report = { runId, startedAt: new Date().toISOString(), diagnostic, plan, fixture: fixture.manifest, sourceHashes: beforeHashes,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scriptSha256: sha(readFileSync(new URL(import.meta.url))),
  servedIndexSha256: sha(index), dist, distMatches: sha(readFileSync(resolve(dist,'index.html'))) === sha(index), applicationBuildAtStart: buildAtStart, diagnosticPair, preloadDocument: { url: base + preloadPath, path: preloadFile, sha256: sha(preloadHtml), kind: 'real fixed-preview static GET; no route interception or app assets' }, fixtureTransport: transport.manifest, preloadDocuments: [],
  host: { platform: platform(), cpu: cpus()[0]?.model, cores: cpus().length, ram: totalmem(), free: freemem(), load: loadavg() },
  assets: [], samples: [], errors: [], completed: false, passed: false }
function checkpoint() {
  report.families = Object.keys(descriptions).map(family => {
    const samples = report.samples.filter(sample => sample.family === family), values = samples.filter(sample => sample.valid).map(sample => sample.ms).sort((a, b) => a - b)
    return { family, required, actual: samples.length, valid: values.length, p50: values[Math.floor(values.length * .5)] ?? null,
      p95: values[Math.min(values.length - 1, Math.floor(values.length * .95))] ?? null, max: values.at(-1) ?? null,
      pass: samples.length >= required && samples.every(sample => sample.valid && sample.ms <= limitMs) }
  })
  writeFileSync(resolve(runDir, 'report.json'), JSON.stringify(report, null, 2))
  writeFileSync(resolve(output, 'latest.json'), JSON.stringify({ report: resolve(runDir, 'report.json'), completed: report.completed, passed: report.passed }, null, 2))
}

/** Observer only: native transaction events and capture-phase UI events, never a business command. */
function installCollector() {
  const c = window.__qualitySamplePerf = { samples: [], armed: null, active: null, mutations: 0, transactions: [], longTasks: [], reads: [] }
  new MutationObserver(() => { c.mutations++ }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  try { new PerformanceObserver(list => c.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true }) } catch {}
  for (const method of ['get', 'getAll', 'getAllKeys', 'count', 'openCursor']) {
    const original = IDBObjectStore.prototype[method]
    IDBObjectStore.prototype[method] = function (...args) {
      const key = args[0], row = { database: this.transaction.db.name, store: this.name, method, mode: this.transaction.mode, start: performance.now(), end: null,
        key: key instanceof IDBKeyRange ? { lower: key.lower, upper: key.upper, lowerOpen: key.lowerOpen, upperOpen: key.upperOpen } : key ?? null }
      c.reads.push(row)
      const request = original.apply(this, args)
      request.addEventListener('success', () => { row.end = performance.now(); row.resultCount = Array.isArray(request.result) ? request.result.length : request.result === undefined ? 0 : 1 })
      request.addEventListener('error', () => { row.end = performance.now(); row.error = request.error?.message })
      return request
    }
  }
  const transaction = IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction = function (...args) {
    const tx = transaction.apply(this, args), row = { database: this.name, mode: tx.mode, stores: [...tx.objectStoreNames], start: performance.now(), end: null, status: 'pending' }
    c.transactions.push(row)
    tx.addEventListener('complete', () => { row.end = performance.now(); row.status = 'complete' })
    tx.addEventListener('abort', () => { row.end = performance.now(); row.status = 'abort' })
    return tx
  }
  const byPath = (value, path) => path.split('.').reduce((current, key) => current?.[key], value)
  async function readback(spec) {
    if (!spec) return null
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-cutting-records-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try {
      const saved = await new Promise((resolve, reject) => {
        const tx = db.transaction(['records', 'files'], 'readonly'), values = new Map(), files = new Map()
        const request = tx.objectStore('records').get(`production-context:samples:${spec.assignmentId}`)
        request.onsuccess = () => values.set('record', request.result?.value)
        for (const file of spec.files || []) { const request = tx.objectStore('files').get(file.fileId); request.onsuccess = () => files.set(file.fileId, request.result) }
        tx.oncomplete = () => resolve({ record: values.get('record'), files }); tx.onabort = () => reject(tx.error)
      })
      if (!saved.record || Object.entries(spec.fields || {}).some(([path, expected]) => byPath(saved.record, path) !== expected)) return false
      if ((spec.nonEmptyFields || []).some(path => !byPath(saved.record, path))) return false
      if (spec.standardItems && saved.record.inspectionStandardSnapshot?.items.length !== spec.standardItems) return false
      if (spec.opinionCount !== undefined && saved.record.suggestionVersions?.length !== spec.opinionCount) return false
      const metadata = []
      for (const expected of spec.files || []) {
        const file = saved.files.get(expected.fileId)
        if (!file?.blob || file.blob.size !== expected.size || file.blob.type !== expected.mimeType) return false
        const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
        if (actual !== expected.sha256) throw Error('Saved original sample Blob bytes do not match the selected file.')
        metadata.push({ id: expected.fileId, bytes: file.blob.size, type: file.blob.type, sha256: actual })
      }
      if (spec.referencePath) {
        const refs = byPath(saved.record, spec.referencePath)
        if (!Array.isArray(refs) || refs.length !== (spec.files || []).length || refs.some((ref, i) => ref?.$productionFile !== spec.files[i].fileId)) return false
      }
      return { assignmentId: saved.record.assignmentId, status: saved.record.sample.status, fixedStandardId: saved.record.inspectionStandardSnapshot?.id,
        opinions: saved.record.suggestionVersions.length, firstSubmittedAt: saved.record.suggestionVersions[0]?.uploadedInstant, files: metadata }
    } finally { db.close() }
  }
  function begin(spec, time, event) {
    const active = c.active = { spec, time, event, previous: -1, frames: 0, checking: false }
    const frame = async () => {
      if (c.active !== active) return
      const host = document.querySelector('[data-sample-approval-page]'), text = host?.textContent || ''
      if (!host && [...document.querySelectorAll('h1,h2')].some(node => /页面加载失败|资料无法读取/.test(node.textContent || ''))) {
        c.samples.push({ family: spec.family, mode: spec.mode, valid: false, failureKind: 'actual-page-load-failure', error: document.body.textContent.slice(-5000), diagnosticElapsedMs: performance.now() - time, reads: c.reads.filter(row => (row.end || performance.now()) >= time), transactions: c.transactions.filter(row => (row.end || performance.now()) >= time), longTasks: c.longTasks.filter(row => row.start + row.duration >= time) }); c.active = null; return
      }
      let ready = !!host && (!spec.path || location.pathname + location.search === spec.path)
        && (!spec.selector || !!host.querySelector(spec.selector)) && (!spec.absent || !host.querySelector(spec.absent))
        && (!spec.text || text.replace(/\s/g, '').includes(spec.text.replace(/\s/g, ''))) && !host?.querySelector('[role="alert"]') && document.fonts.status !== 'loading'
      if (spec.changedFirst && host?.querySelector('tbody tr')?.textContent === spec.changedFirst) ready = false
      if (spec.count && host?.querySelectorAll(spec.count.selector).length !== spec.count.value) ready = false
      const images = [...(host?.querySelectorAll('img') || [])].filter(image => {
        const bounds = image.getBoundingClientRect()
        const visible = bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth
        const selectedPreview = spec.eventType === 'change' && (image.src.startsWith('data:') || image.src.startsWith('blob:'))
        return !image.hidden && bounds.width > 0 && bounds.height > 0 && (visible || selectedPreview)
      })
      const decodedImages = new Map()
      if (ready) {
        try {
          await Promise.all(images.map(async image => {
            const bounds = image.getBoundingClientRect()
            const offscreen = bounds.bottom <= 0 || bounds.top >= innerHeight || bounds.right <= 0 || bounds.left >= innerWidth
            // Decode every newly selected file inside the original timed event.
            // An offscreen lazy element does not request its bytes yet; validate
            // those same bytes with a detached eager decoder, without changing
            // application DOM/loading policy or warming any later measurement.
            if (spec.eventType === 'change' && offscreen && image.loading === 'lazy') {
              const decoder = new Image(); decoder.src = image.src; await decoder.decode()
              if (!decoder.complete || !decoder.naturalWidth) throw Error('Selected sample preview failed to decode.')
              decodedImages.set(image, {width:decoder.naturalWidth,height:decoder.naturalHeight,detached:true})
            } else { await image.decode(); if (!image.complete || !image.naturalWidth) throw Error('Visible sample image failed to decode.'); decodedImages.set(image, {width:image.naturalWidth,height:image.naturalHeight,detached:false}) }
          }))
        } catch { ready = false }
      }
      const writes = c.transactions.filter(tx => tx.database === 'higood-cutting-records-v1' && tx.mode === 'readwrite' && tx.start >= time)
      if (spec.saving && (!writes.some(tx => tx.status === 'complete') || writes.some(tx => tx.status === 'pending'))) ready = false
      active.frames = ready && active.previous === c.mutations ? active.frames + 1 : 0; active.previous = c.mutations
      if (active.frames >= 2 && !active.checking) {
        active.checking = true
        try {
          const settledMutation = c.mutations
          const saved = await readback(spec.readback)
          if (saved === false || settledMutation !== c.mutations) { active.checking = false; active.frames = 0; requestAnimationFrame(frame); return }
          c.samples.push({ family: spec.family, mode: spec.mode, ms: performance.now() - time, valid: true, event,
            path: location.pathname + location.search, images: images.map(image => ({ srcKind: image.currentSrc.startsWith('data:') ? 'data-preview' : image.currentSrc.startsWith('blob:') ? 'original-Blob' : 'static-matching', naturalWidth: decodedImages.get(image).width, naturalHeight: decodedImages.get(image).height, selectedOffscreenByteDecode: decodedImages.get(image).detached })),
            allRenderedImageCount: host.querySelectorAll('img').length, imagePolicy: 'Visible identifying images decode in their original elements; every newly selected data/Blob preview is decoded inside this same timed event (offscreen lazy previews use detached same-URL decoders). Existing offscreen references are measured when opened, never forced eager.',
            domNodes: host.querySelectorAll('*').length, reads: c.reads.filter(row => (row.end || performance.now()) >= time), nativeReadback: saved, transactions: c.transactions.filter(tx => (tx.end || performance.now()) >= time), longTasks: c.longTasks.filter(task => task.start + task.duration >= time) })
          c.active = null
        } catch (error) { c.samples.push({ family: spec.family, mode: spec.mode, valid: false, error: String(error), event }); c.active = null }
      } else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
  c.arm = spec => { c.armed = spec }
  c.navigate = spec => begin(spec, 0, { type: 'navigation', isTrusted: null })
  for (const type of ['click', 'change']) document.addEventListener(type, event => {
    const spec = c.armed
    if (!spec || (spec.eventType || 'click') !== event.type || spec.eventSelector && !event.target.closest(spec.eventSelector)) return
    c.armed = null; begin(spec, performance.now(), { type: event.type, isTrusted: event.isTrusted, selector: spec.eventSelector || null, automationFileSelection: type === 'change' })
  }, true)
}

const browser = await chromium.launch({ headless: true }); report.browser = browser.version(); checkpoint()
async function openContext() {
  const context = await browser.newContext({ viewport: plan.viewport, timezoneId: 'Asia/Jakarta' }), blank = await context.newPage()
  const preloadEvidence = { requests: [], document: null }
  blank.on('request', request => preloadEvidence.requests.push({ url: request.url(), type: request.resourceType() }))
  const documentResponse = await blank.goto(base + preloadPath, { waitUntil: 'load' })
  const documentBytes = await documentResponse.body()
  preloadEvidence.document = { url: documentResponse.url(), status: documentResponse.status(), bytes: documentBytes.length, sha256: sha(documentBytes), serverAddress: await documentResponse.serverAddr(), match: sha(documentBytes) === sha(preloadHtml) }
  if (!preloadEvidence.document.match || documentResponse.status() !== 200) throw Error('Actual preload document differs from declared static bytes.')
  const nativeInstallation = await blank.evaluate(installQualityPerformanceNativeFixture, transport.descriptor('sample'))
  await blank.evaluate(async rows => {
    const db = await new Promise((resolve,reject) => { const request=indexedDB.open('higood-cutting-records-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error) })
    try { await new Promise((resolve,reject) => { const tx=db.transaction('records','readwrite');for(const row of rows)tx.objectStore('records').put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error) }) } finally {db.close()}
  }, fixture.appendedCutting)
  for (const file of fixture.nativeFiles) await blank.evaluate(async file => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-cutting-records-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); const bytes = Uint8Array.from(atob(file.bytes), byte => byte.charCodeAt(0)); tx.objectStore('files').put({ id: file.fileId, blob: new Blob([bytes], { type: file.mimeType }) }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) }) } finally { db.close() }
  }, { fileId: file.fileId, mimeType: file.mimeType, bytes: file.buffer.toString('base64') })
  const installed = await blank.evaluate(async () => {
    const count = async (database, lower, upper = `${lower}\uffff`) => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(database); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      try { return await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').count(IDBKeyRange.bound(lower, upper)); let result; request.onsuccess = () => { result = request.result }; tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
    }
    return { historicalSamples: await count('higood-cutting-records-v1', 'production-context:samples:QPERF-ASG-'), appendedSamples: await count('higood-cutting-records-v1', 'production-context:samples:PPERF-ASG-'),
      allQc: await count('higood-pcs-records', 'higood-fcs-post-finishing-records/flow/qcTasks/QPERF-QC-'), configurations: await count('higood-pcs-records', 'higood-fcs-quality-management/config/') }
  })
  if (installed.historicalSamples !== 2000 || installed.appendedSamples !== 30 || installed.allQc !== 8000 || installed.configurations !== 402) throw Error(`Installed original-source cardinality mismatch: ${JSON.stringify(installed)}`)
  preloadEvidence.noApplicationAssets = preloadEvidence.requests.every(request => request.url === base + preloadPath || new URL(request.url).origin === transport.baseUrl)
  if (!preloadEvidence.noApplicationAssets) throw Error('Fixture preload requested application assets and invalidated the cold entry.')
  report.preloadDocuments.push({ ...preloadEvidence, nativeInstallation })
  await blank.close(); await context.addInitScript(installCollector)
  const page = await context.newPage()
  page.on('pageerror', error => { report.errors.push({ type: 'pageerror', message: error.message }); checkpoint() })
  page.on('response', response => { const url = new URL(response.url()); if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@vite')) report.errors.push({ type: 'source-import-forbidden', url: url.pathname }); if (/\/assets\/.*\.(js|css)$/.test(url.pathname) && !report.assets.includes(url.href)) report.assets.push(url.href) })
  page.on('console', message => { if (message.type() === 'error') { report.errors.push({ type: 'console', route: page.url(), message: message.text() }); checkpoint() } })
  page.on('requestfailed', request => { report.errors.push({ type: 'requestfailed', url: request.url(), failure: request.failure() }); checkpoint() })
  page.on('dialog', dialog => dialog.accept())
  return { context, page, installed }
}
const action = (page, name, id) => page.locator(`[data-sample-approval-action="${name}"]${id ? `[data-assignment-id="${id}"]` : ''}`)
const field = (page, name) => page.locator(`[data-sample-approval-field="${name}"]`)
const fileMeta = file => ({ fileId: file.fileId, size: file.size, mimeType: file.mimeType, sha256: file.sha256 })
async function measure(page, spec, work, navigation = false) {
  const before = navigation ? 0 : await page.evaluate(() => window.__qualitySamplePerf.samples.length)
  let profiler
  if (cpuProfile) {
    profiler = await page.context().newCDPSession(page)
    await profiler.send('Profiler.enable'); await profiler.send('Profiler.setSamplingInterval', { interval: 1000 }); await profiler.send('Profiler.start')
  }
  try {
    if (navigation) { await work(); await page.evaluate(spec => window.__qualitySamplePerf.navigate(spec), spec) }
    else { await page.evaluate(spec => window.__qualitySamplePerf.arm(spec), spec); await work() }
    await page.waitForFunction(before => window.__qualitySamplePerf.samples.length > before, before, { timeout: 90000 })
    const sample = await page.evaluate(() => window.__qualitySamplePerf.samples.at(-1))
    if (sample.event?.type === 'click' && sample.event.isTrusted !== true) { sample.valid = false; sample.error = 'Expected a trusted actual original UI click.' }
    report.samples.push(sample)
  } catch (error) {
    const state = await page.evaluate(() => ({ active: window.__qualitySamplePerf?.active, headings: [...document.querySelectorAll('h1,h2')].map(node => node.textContent), alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), url: location.href })).catch(() => null)
    report.samples.push({ family: spec.family, mode: spec.mode, valid: false, error: String(error), state })
    await page.screenshot({ path: resolve(runDir, `${report.samples.length}-failure.png`), fullPage: false }).catch(() => {})
  }
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop')
    const name = `${report.samples.length}-${spec.family.replace(/[^a-zA-Z0-9_-]/g, '-')}.cpuprofile`
    writeFileSync(resolve(runDir, name), JSON.stringify(profile))
    report.samples.at(-1).diagnosticCpuProfile = name
    await profiler.detach()
  }
  checkpoint()
}
async function nativeLink(page, path) {
  await page.evaluate(path => { let link = document.querySelector('[data-sample-performance-link]'); if (!link) { link = document.createElement('a'); link.dataset.samplePerformanceLink = ''; link.style.cssText = 'position:fixed;bottom:0;right:0;z-index:100000;background:white;padding:4px'; document.querySelector('#app').append(link) } link.href = path; link.dataset.nav = path; link.textContent = '性能原路由导航' }, path)
  return page.locator('[data-sample-performance-link]')
}
async function closeModal(page) { if (await page.locator('[data-sample-dialog]').count()) { await action(page, 'close-dialog').first().click(); await page.locator('[data-sample-dialog]').waitFor({ state: 'detached' }) } }
async function selectRecord(page, info) {
  await closeModal(page)
  await action(page, `switch-tab:${stageTab[info.state]}`).click()
  await page.locator('[data-sample-approval-filter="keyword"]').fill(info.taskNo)
  await action(page, 'query').click()
  await page.locator(`tbody [data-assignment-id="${info.assignmentId}"]`).first().waitFor()
}
async function openModal(page, info, name) { await selectRecord(page, info); await action(page, name, info.assignmentId).click(); await page.locator('[data-sample-dialog]').waitFor() }

try {
  for (let trial = 0; trial < trials; trial++) {
    const { context, page, installed } = await openContext(), group = fixture.ids[trial % required], receiptUpload = fixture.receiptUploads[trial]
    if (fixture.nativeFiles.some(file => file.fileId === receiptUpload.fileId)) throw Error('The receipt upload must be a new Blob, not a preloaded entity reused by digest.')
    report.installations ||= []; report.installations.push({ trial, ...installed })
    try {
      if (diagnosticPair) {
        await measure(page, { family: 'entry:list:COLD', mode: 'COLD', path: root, selector: 'tbody tr', text: '批版建议' }, () => page.goto(base + root, { waitUntil: 'commit' }), true)
        if (!report.samples.at(-1)?.valid) throw Error('Cold original page did not load successfully; save action cannot be fabricated.')
        await openModal(page, group.receive, 'receive-sample')
        await action(page, 'select-received-photos', group.receive.assignmentId).setInputFiles({ name: receiptUpload.name, mimeType: receiptUpload.mimeType, buffer: receiptUpload.buffer })
        await page.locator('[data-sample-dialog] img[alt^="待保存实收照片"]').waitFor()
        await measure(page, { family: 'save:receive', mode: 'ACTION', absent: '[data-sample-dialog]', text: '已保存本件实收照片并接收样衣', saving: true,
          readback: { assignmentId: group.receive.assignmentId, fields: { 'sample.status': 'PPIC_RECEIVED' }, files: [fileMeta(receiptUpload)], referencePath: 'sample.ppicReceivedSamplePhotoUrls' } }, () => action(page, 'submit-receive', group.receive.assignmentId).click())
        await page.screenshot({ path: resolve(runDir, 'diagnostic-after-receive.png'), fullPage: false })
        continue
      }
      for (const mode of modes) {
        if (mode === 'COLD') await measure(page, { family: `entry:list:${mode}`, mode, path: root, selector: 'tbody tr', text: '批版建议' }, () => page.goto(base + root, { waitUntil: 'commit' }), true)
        if (mode === 'REFRESH') await measure(page, { family: `entry:list:${mode}`, mode, path: root, selector: 'tbody tr', text: '批版建议' }, () => page.reload({ waitUntil: 'commit' }), true)
        if (mode === 'SPA') {
          await page.goto(base + '/fcs/quality-management/basic-standards'); await page.locator('[data-quality-management-page]').waitFor()
          const link = await nativeLink(page, root)
          await measure(page, { family: `entry:list:${mode}`, mode, path: root, selector: 'tbody tr', text: '批版建议' }, () => link.click())
        }
        for (const kind of modalKinds) {
          const [state, name, title] = modal[kind], info = group[state]
          await selectRecord(page, info)
          await measure(page, { family: `open:${kind}:${mode}`, mode: `${mode}_CONTEXT_TRUSTED_MODAL`, selector: `[data-sample-dialog][aria-label="${title}"]`, text: title }, () => action(page, name, info.assignmentId).click())
          await closeModal(page)
        }
      }
      await action(page, 'reset').click()
      for (const tab of tabs) {
        await action(page, `switch-tab:${tab === 'COMPLETED' ? 'PENDING_RETURN' : 'COMPLETED'}`).click()
        await measure(page, { family: `state-list:${tab}`, mode: 'ACTION', selector: 'tbody tr', text: `${{ PENDING_RETURN: '待PPIC接收', PENDING_APPROVAL: '待批版', PENDING_FEEDBACK: '待反馈工厂', COMPLETED: '已完成' }[tab]}的产前版样衣` }, () => action(page, `switch-tab:${tab}`).click())
      }
      await page.locator('[data-sample-approval-filter="keyword"]').fill('QPERF')
      await measure(page, { family: 'action:query', mode: 'ACTION', selector: 'tbody tr', text: '2000条' }, () => action(page, 'query').click())
      const first = await page.locator('tbody tr').first().textContent()
      await measure(page, { family: 'action:pagination', mode: 'ACTION', selector: 'tbody tr', changedFirst: first }, () => action(page, 'next-page').click())

      await openModal(page, group.receive, 'receive-sample')
      await measure(page, { family: 'select:receipt-photo-2MiB', mode: 'FILE_SELECTION', eventType: 'change', eventSelector: '[data-sample-approval-action="select-received-photos"]',
        count: { selector: '[data-sample-dialog] img[alt^="待保存实收照片"]', value: 1 } }, () => action(page, 'select-received-photos', group.receive.assignmentId).setInputFiles({ name: receiptUpload.name, mimeType: receiptUpload.mimeType, buffer: receiptUpload.buffer }))
      await measure(page, { family: 'save:receive', mode: 'ACTION', absent: '[data-sample-dialog]', text: '已保存本件实收照片并接收样衣', saving: true,
        readback: { assignmentId: group.receive.assignmentId, fields: { 'sample.status': 'PPIC_RECEIVED' }, files: [fileMeta(receiptUpload)], referencePath: 'sample.ppicReceivedSamplePhotoUrls' } }, () => action(page, 'submit-receive', group.receive.assignmentId).click())

      await selectRecord(page, group.received)
      await measure(page, { family: 'save:handoff', mode: 'ACTION', text: '已记录实物转交', saving: true,
        readback: { assignmentId: group.received.assignmentId, fields: { 'sample.status': 'HANDED_TO_APPROVER' } } }, () => action(page, 'handoff-approver', group.received.assignmentId).click())
      await openModal(page, group.handed, 'start-approval')
      await field(page, 'startApproverName').fill(group.approver); await field(page, 'startConfirmed').check()
      await measure(page, { family: 'save:claim', mode: 'ACTION', absent: '[data-sample-dialog]', text: '领取已保存，本次要求已固定', saving: true,
        readback: { assignmentId: group.handed.assignmentId, fields: { 'sample.status': 'APPROVAL_IN_PROGRESS', currentApproverName: group.approver, 'sample.factoryTimeZone': 'Asia/Jakarta', 'inspectionStandardSnapshot.ruleSnapshot': null }, nonEmptyFields: ['currentApproverId', 'sample.approverReceivedInstant'], standardItems: 40, opinionCount: 0 } }, () => action(page, 'confirm-start-approval', group.handed.assignmentId).click())

      await openModal(page, group.claimed, 'open-approval')
      await field(page, 'conclusion').selectOption('HAS_PROBLEM')
      const issue = page.locator('[data-sample-issue-id]').first(), itemId = await issue.getAttribute('data-sample-issue-id')
      await issue.check(); await page.locator(`[data-sample-issue-note="${itemId}"]`).fill('原本件标准项目的隔离性能问题。')
      await field(page, 'approverName').fill(group.approver); await field(page, 'approverConfirmed').check()
      const uploads = fixture.actionFiles[trial]
      await measure(page, { family: 'select:opinion-10x512KiB', mode: 'FILE_SELECTION', eventType: 'change', eventSelector: '[data-sample-approval-action="select-approval-sheet-photos"]',
        count: { selector: '[data-sample-dialog] img[alt^="补充批版资料"]', value: 10 } }, () => action(page, 'select-approval-sheet-photos', group.claimed.assignmentId).setInputFiles(uploads.map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer }))))
      await measure(page, { family: 'save:first-opinion', mode: 'ACTION', absent: '[data-sample-dialog]', text: '批版意见已保存，等待PPIC登记反馈工厂', saving: true,
        readback: { assignmentId: group.claimed.assignmentId, fields: { 'sample.status': 'SUGGESTION_UPLOADED', 'suggestionVersions.0.conclusion': 'HAS_PROBLEM', 'suggestionVersions.0.issues.0.itemId': itemId },
          nonEmptyFields: ['suggestionVersions.0.uploadedInstant'], standardItems: 40, opinionCount: 1, files: uploads.map(fileMeta), referencePath: 'suggestionVersions.0.approvalSheetPhotoUrls' } }, () => action(page, 'submit-approval', group.claimed.assignmentId).click())

      await selectRecord(page, group.opinion)
      await measure(page, { family: 'save:feedback', mode: 'ACTION', text: '已登记截图反馈时间和责任人', saving: true,
        readback: { assignmentId: group.opinion.assignmentId, fields: { 'sample.status': 'FEEDBACK_SENT', 'suggestionVersions.0.uploadedInstant': '2026-10-22T01:00:00.000Z', 'suggestionVersions.0.feedbackSentByPpicId': group.ppicId }, nonEmptyFields: ['suggestionVersions.0.feedbackSentAt'], opinionCount: 1 } }, () => action(page, 'feedback-factory', group.opinion.assignmentId).click())
      await openModal(page, group.feedback, 'show-card')
      await measure(page, { family: 'action:card-image-zoom', mode: 'ACTION', selector: '[role="dialog"][aria-label="图片大图"] img' }, () => page.locator('[data-sample-dialog] [data-sample-approval-action="preview-image"]').first().click())
      await page.screenshot({ path: resolve(runDir, `trial-${trial}-card-zoom.png`), fullPage: false })
    } finally { await context.close() }
  }
  report.completed = true
} catch (error) { report.errors.push({ type: 'collector', message: String(error) }) }
finally { await browser.close(); await transport.close(); report.applicationBuildAtEnd = buildHashes(); report.applicationBuildUnchanged = JSON.stringify(buildAtStart) === JSON.stringify(report.applicationBuildAtEnd); if (preloadCreated && readFileSync(preloadFile,'utf8') === preloadHtml) unlinkSync(preloadFile); checkpoint() }
report.passed = !diagnostic && report.completed && report.errors.length === 0 && report.families.every(family => family.pass)
checkpoint()
console.log(JSON.stringify({ executed: true, completed: report.completed, diagnostic, passed: report.passed, report: resolve(runDir, 'report.json'), families: report.families }, null, 2))
process.exitCode = report.passed || diagnostic && report.completed && !report.errors.length ? 0 : 1
