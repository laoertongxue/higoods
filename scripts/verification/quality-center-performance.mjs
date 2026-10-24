#!/usr/bin/env node
// 本轮性能依据：用户2026-10-22确认不超过2秒、功能优先；保留原负载及逐样本验证。
/**
 * Quality-center whole-page collector. Run with node --import tsx.
 * Default: describe the prepared run only. --prepare writes validated fixture
 * metadata without opening a browser. --run requires an exclusive browser slot.
 */
import { buildQualityPerformanceFixture, startQualityPerformanceFixtureServer, installQualityPerformanceNativeFixture } from './quality-performance-fixture.mjs'
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpus, loadavg, freemem, totalmem, platform } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1) || fallback
const base = (process.env.BASE_URL || option('--base', 'http://127.0.0.1:43527')).replace(/\/$/, '')
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw Error('This collector only accepts a local, isolated prototype service.')
const diagnostic = args.includes('--diagnostic'), samplesRequired = 5, limitMs = Number(option('--limit-ms','2000')), seed = 20261022
if(!Number.isFinite(limitMs)||limitMs<1||limitMs>2000)throw Error('The per-sample limit must tighten the approved 2000ms ceiling, never raise it')
const buildDirectory = resolve(process.env.BUILD_DIR || option('--build-dir', 'dist'))
const output = resolve(option('--output', 'output/qc-implementation-20261022/center-performance'))
const root = '/fcs/quality-management'
const namespace = 'higood-fcs-quality-management', postNamespace = 'higood-fcs-post-finishing-records', invNamespace = 'higood-finished-inventory'
const kinds = ['PRODUCTION_RETURN', 'WAREHOUSE_STOCK', 'PRE_PRODUCTION_SAMPLE']
const stage = { PRODUCTION_RETURN: 'POST_FINISHING_QC', WAREHOUSE_STOCK: 'WAREHOUSE_STOCK_QC', PRE_PRODUCTION_SAMPLE: 'PRE_PRODUCTION_SAMPLE_APPROVAL' }
const shape = { basicStandards: 100, itemsPerBasic: 40, additionalStandards: 300, productionRecords: 3000, inventoryRecords: 5000, sampleRecords: 2000, rounds: 20000, heavyRecordSkus: 24, warehouses: 10 }
const familyDescriptions = {
  'entry:cold-basic': 'Fresh Chromium context, preinstalled IndexedDB; no app code or HTTP assets loaded before first entry.',
  'entry:cold-records': 'Fresh context, first app entry reads all real domain sources and renders the record list.',
  'entry:refresh-records': 'Existing context and browser HTTP cache, real document reload of the record list.',
  ...Object.fromEntries(['basic-standards', 'additional-standards', 'inspection-rules', 'records', 'audits', 'statistics'].map(name => ['list:spa:' + name, 'Trusted application navigation to ' + name + '.'])),
  ...Object.fromEntries(['basic', 'additional', 'rule', 'production-record', 'inventory-record', 'sample-record', 'audit'].map(name => ['detail:' + name, 'Trusted link navigation to the real ' + name + ' detail.'])),
  ...Object.fromEntries(['basic', 'additional', 'rule'].map(name => ['editor:' + name, 'Trusted link navigation to the real ' + name + ' draft editor.'])),
  'action:query': 'Record keyword/source/party/date query; full filtered total and first page ready.',
  'action:pagination': 'Real next-page control; a different first record and all required images ready.',
  'action:preview-M': 'Draft preview combines basic + category + style requirements and M-only original-item override.',
  'action:preview-L': 'Same composition for L, preserving the original chest requirement.',
  'action:save-draft': 'Real save button through transaction complete, result DOM, and independent IndexedDB readback.',
  'action:publish': 'Real confirmation button, overlap validation, transaction complete, effective DOM and readback.',
  'action:statistics-drilldown': 'Real statistics link retaining source/date/keyword range on its record list.',
}
const config = { base, seed, shape, samplesRequired, limitMs, diagnostic, viewport: { width: 1366, height: 768 },
  cache: 'Cold = fresh browser context/HTTP cache and first app evaluation. Fixture installation necessarily writes local IndexedDB before app entry; it is excluded from timing. Refresh and SPA are separate families.',
  endpoint: 'Browser clock from navigation origin or trusted click capture, through necessary reads/computation and applicable transaction complete, independent saved-record readback, fonts/required images decoded and two mutation-stable animation frames. Tool polling/screenshots are excluded.',
  equivalence: 'Both rule records share the same list/detail/editor renderer; production and inventory details share the renderer but each is sampled; the production detail has 24 SKU snapshots ×40 items. All six center destinations are sampled separately. The production/QC/warehouse/sample execution pages and physical equipment are outside this center collector and need their own acceptance.',
  sourceBoundary: 'No diagnostic provider, runtime import from /src, test hook, in-memory replacement of business sources, production service, or external database. Synthetic original fixtures stream from a GET-only exact-origin localhost fixture server into native browser IndexedDB before loading the fixed preview bundle. Full cardinality/byte/round readback is outside the application timing; no original records are removed.',
  families: familyDescriptions }
if (!args.includes('--run') && !args.includes('--prepare')) {
  console.log(JSON.stringify({ prepared: true, executed: false, config,
    usage: 'BASE_URL=http://127.0.0.1:43527 node --import tsx scripts/verification/quality-center-performance.mjs --prepare|--run [--diagnostic] [--build-dir=FROZEN_BUILD] [--output=PATH]; diagnostic preserves the complete fixture and profiles one cold record entry; it cannot pass formal acceptance.' }, null, 2))
  process.exit(0)
}
const sha = value => createHash('sha256').update(value).digest('hex')


mkdirSync(output, { recursive: true })
const fixture = await buildQualityPerformanceFixture()
writeFileSync(resolve(output, 'fixture-manifest.json'), JSON.stringify(fixture.manifest, null, 2))
if (!args.includes('--run')) { console.log(JSON.stringify({ prepared: true, executed: false, manifest: fixture.manifest, config }, null, 2)); process.exit(0) }

const indexResponse = await fetch(base + '/'), indexText = await indexResponse.text()
if (!indexResponse.ok || indexText.includes('/@vite/client') || !/\/assets\/[^"']+\.js/.test(indexText)) throw Error('Use a fixed built preview, not a Vite HMR development server')
// A genuinely served same-origin document gives Chromium the preview's known
// network address space. A route.fulfill document may have an unknown space
// and must not be used to bypass native loopback fixture permissions.
const preloadName='__quality-center-fixture-preload.html', preloadFile=resolve(buildDirectory,preloadName)
const preloadHtml='<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated quality fixture preload</title><body>Verification fixture installation. No application assets.</body></html>'
const createdPreload=!existsSync(preloadFile)
if(!createdPreload && readFileSync(preloadFile,'utf8')!==preloadHtml)throw Error('Refusing to replace an unrelated built file at '+preloadFile)
if(createdPreload)writeFileSync(preloadFile,preloadHtml)
const preloadResponse=await fetch(base+'/'+preloadName,{cache:'no-store'})
if(!preloadResponse.ok || await preloadResponse.text()!==preloadHtml){if(createdPreload)unlinkSync(preloadFile);throw Error('Fixed preview does not serve the declared verification-only blank document from the supplied build directory')}
const runId = new Date().toISOString().replaceAll(':', '-'), runDir = resolve(output, runId)
mkdirSync(runDir, { recursive: true })
const report = { runId, startedAt: new Date().toISOString(), config, fixture: fixture.manifest,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  scriptSha256: sha(readFileSync(new URL(import.meta.url))), fixtureBuilderSha256: sha(readFileSync(new URL('./quality-performance-fixture.mjs', import.meta.url))), buildDirectory, indexSha256: sha(indexText), distIndexMatches: existsSync(resolve(buildDirectory,'index.html')) && sha(readFileSync(resolve(buildDirectory,'index.html'))) === sha(indexText),
  host: { platform: platform(), cpu: cpus()[0]?.model, cpuCount: cpus().length, ram: totalmem(), freeRam: freemem(), load: loadavg() },
  fixturePreloadDocument:{url:base+'/'+preloadName,path:preloadFile,sha256:sha(preloadHtml),kind:'real HTTP GET from fixed preview; no route.fulfill or application assets'},
  browser: '', assets: [], samples: [], fixtureInstallations: [], errors: [], completed: false, passed: false }
function checkpoint() {
  report.families = Object.keys(familyDescriptions).map(family => { const rows = report.samples.filter(row => row.family === family), values = rows.filter(row => row.valid).map(row => row.ms).sort((a, b) => a - b)
    return { family, valid: values.length, required: 5, p50: values[Math.floor(values.length * .5)] ?? null, p95: values[Math.min(values.length - 1, Math.floor(values.length * .95))] ?? null,
      max: values.at(-1) ?? null, pass: rows.length >= 5 && rows.every(row => row.valid && row.ms <= limitMs) } })
  writeFileSync(resolve(runDir, 'report.json'), JSON.stringify(report, null, 2))
  writeFileSync(resolve(output, 'latest.json'), JSON.stringify({ runId, path: resolve(runDir, 'report.json'), completed: report.completed, passed: report.passed }, null, 2))
}
writeFileSync(resolve(runDir, 'collector-at-run.mjs'), readFileSync(new URL(import.meta.url)))
writeFileSync(resolve(runDir, 'fixture-builder-at-run.mjs'), readFileSync(new URL('./quality-performance-fixture.mjs', import.meta.url)))
writeFileSync(resolve(runDir, 'preload-document-at-run.html'),preloadHtml)
checkpoint()

// Installed before application evaluation. It observes actual transactions and
// trusted DOM events; it never calls a business command or changes product data.
function installCollector() {
  const c = window.__qualityPerf = { samples: [], armed: null, active: null, mutations: 0, longTasks: [], transactions: [], cloneCalls: 0, cloneMs: 0, cloneEvents: [], firstBusinessDom: null, lastBusinessMutation: null }
  new MutationObserver(() => { c.mutations++; if (document.querySelector('[data-quality-management-page]')) { c.firstBusinessDom ??= performance.now(); c.lastBusinessMutation = performance.now() } }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  try { new PerformanceObserver(list => c.longTasks.push(...list.getEntries().map(row => ({ start: row.startTime, duration: row.duration })))).observe({ type: 'longtask', buffered: true }) } catch {}
  const nativeClone = window.structuredClone
  window.structuredClone = function (...args) {
    const start = performance.now()
    try { return nativeClone.apply(this, args) }
    finally { const duration = performance.now() - start; c.cloneCalls++; c.cloneMs += duration
      if (duration >= 1 && c.cloneEvents.length < 2048) c.cloneEvents.push({ start, duration, topLevelArrayLength: Array.isArray(args[0]) ? args[0].length : null }) }
  }
  const transaction = IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction = function (...args) {
    const tx = transaction.apply(this, args), row = { database: this.name, mode: tx.mode, stores: [...tx.objectStoreNames], start: performance.now(), end: null, status: 'pending' }
    c.transactions.push(row)
    tx.addEventListener('complete', () => { row.end = performance.now(); row.status = 'complete'; if (tx.mode === 'readwrite' && c.active) c.active.commits++ })
    tx.addEventListener('abort', () => { row.end = performance.now(); row.status = 'abort' })
    return tx
  }
  const get = (value, path) => path.split('.').reduce((current, part) => current?.[part], value)
  const readback = async spec => {
    if (!spec) return true
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(spec.database); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { return await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').get(spec.id); let row
      request.onsuccess = () => { row = request.result }; tx.oncomplete = () => resolve(Object.entries(spec.fields).every(([key, value]) => get(row, key) === value)); tx.onabort = () => reject(tx.error) }) }
    finally { db.close() }
  }
  function start(spec, startTime) {
    const sample = c.active = { ...spec, startTime, commits: 0, previous: -1, frames: 0, checking: false, previousHost: document.querySelector('[data-quality-management-page]'),
      cloneCallsBefore: startTime === 0 ? 0 : c.cloneCalls, cloneMsBefore: startTime === 0 ? 0 : c.cloneMs }
    const frame = async () => {
      if (c.active !== sample) return
      const host = document.querySelector('[data-quality-management-page]')
      // Editor textareas retain the draft's M-only requirement in textContent.
      // M/L assertions inspect the actual composed result, while page readiness,
      // image decoding and mutation stability still cover the complete host.
      const textHost = spec.textSelector ? host?.querySelector(spec.textSelector) : host, text = textHost?.textContent || ''
      let ready = !!host && (spec.mode !== 'SPA' || host !== sample.previousHost) && (!spec.path || location.pathname + location.search === spec.path) && (!spec.selector || !!host.querySelector(spec.selector))
        && (!spec.textSelector || !!textHost)
        && (!spec.text || text.includes(spec.text)) && (!spec.notText || !text.includes(spec.notText))
        && !host?.querySelector('[role="alert"]') && (!spec.minCommits || sample.commits >= spec.minCommits) && document.fonts?.status !== 'loading'
      const images = [...(host?.querySelectorAll('img') || [])]
      if (images.some(image => !image.complete || !image.naturalWidth || image.hidden)) ready = false
      if (ready && images.some(image => !image.__qualityDecoded)) {
        try { await Promise.all(images.map(async image => { await image.decode(); image.__qualityDecoded = true })) } catch { ready = false }
      }
      if (spec.firstRecordDifferent && host?.querySelector('tbody tr')?.textContent === spec.firstRecordDifferent) ready = false
      sample.frames = ready && sample.previous === c.mutations ? sample.frames + 1 : 0; sample.previous = c.mutations
      if (sample.frames >= 2 && !sample.checking) {
        sample.checking = true
        try {
          if (!await readback(spec.readback)) { sample.checking = false; requestAnimationFrame(frame); return }
          c.samples.push({ family: spec.family, mode: spec.mode, ms: performance.now() - startTime, valid: true, commits: sample.commits,
            route: location.pathname + location.search, bodyReplacedForNavigation: spec.mode === 'SPA' ? host !== sample.previousHost : undefined, images: images.length, domNodes: host.querySelectorAll('*').length,
            longTasks: c.longTasks.filter(row => row.start + row.duration >= startTime),
            phases: { transactions: c.transactions.filter(row => (row.end ?? performance.now()) >= startTime), nativeCloneCalls: c.cloneCalls - sample.cloneCallsBefore,
              nativeCloneMs: c.cloneMs - sample.cloneMsBefore, slowNativeClones: c.cloneEvents.filter(row => row.start + row.duration >= startTime),
              firstBusinessDom: c.firstBusinessDom, lastBusinessMutation: c.lastBusinessMutation,
              interpretation: 'IDB wall intervals can overlap and must not be summed as total latency. Native structuredClone time is measured directly; DOM observation marks actual business render/publication. Other synchronous model/render CPU is attributed with the diagnostic Chrome CPU profile, not guessed by subtraction.' } })
          c.active = null
        } catch (error) { c.samples.push({ family: spec.family, mode: spec.mode, valid: false, error: String(error) }); c.active = null }
      } else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
  c.arm = spec => { c.armed = spec }
  c.navigate = spec => start(spec, 0)
  for (const type of ['click', 'input', 'change']) document.addEventListener(type, event => {
    if (event.isTrusted && c.armed) { const spec = c.armed; c.armed = null; start(spec, performance.now()) }
  }, true)
}

const transport = await startQualityPerformanceFixtureServer({ fixture, allowedOrigin: new URL(base).origin, overlays: { center: [] } })
report.fixtureTransport = transport.manifest
const browser = await chromium.launch({ headless: true }).catch(async error => { await transport.close(); throw error }); report.browser = browser.version()
async function openFixtureContext() {
  const context = await browser.newContext({ viewport: config.viewport, timezoneId: 'Asia/Jakarta' }), blank = await context.newPage()
  const preloadRequests=[];blank.on('request',request=>preloadRequests.push({url:request.url(),type:request.resourceType()}))
  const documentResponse=await blank.goto(base+'/'+preloadName)
  if(!documentResponse || !documentResponse.ok() || sha(await documentResponse.body())!==sha(preloadHtml) || documentResponse.fromServiceWorker())throw Error('Browser preload was not the declared real fixed-preview document')
  const preloadDocument={url:documentResponse.url(),status:documentResponse.status(),headers:documentResponse.headers(),serverAddr:await documentResponse.serverAddr(),sha256:sha(preloadHtml),fromServiceWorker:documentResponse.fromServiceWorker()}
  const installation = await blank.evaluate(installQualityPerformanceNativeFixture, transport.descriptor('center'))
  if(preloadRequests.some(request=>['script','stylesheet'].includes(request.type) || /\/assets\//.test(new URL(request.url).pathname)))throw Error('Fixture installation unexpectedly loaded application code or style assets')
  report.fixtureInstallations.push({...installation,preloadDocument,preloadRequests,observedApplicationAssets:0}); checkpoint()
  const installed = await blank.evaluate(async () => {
    const count = async (database, from, to = from + '\uffff') => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(database); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      try { return await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').count(IDBKeyRange.bound(from, to)); let value
        request.onsuccess = () => { value = request.result }; tx.oncomplete = () => resolve(value); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
    }
    const prefix = 'higood-fcs-post-finishing-records/flow/qcTasks/QPERF-QC-'
    return { production: await count('higood-pcs-records', prefix + '00000', prefix + '02999'), inventory: await count('higood-pcs-records', prefix + '03000', prefix + '07999'),
      samples: await count('higood-cutting-records-v1', 'production-context:samples:QPERF-ASG-'), configurations: await count('higood-pcs-records', 'higood-fcs-quality-management/config/') }
  })
  if (installed.production !== 3000 || installed.inventory !== 5000 || installed.samples !== 2000 || installed.configurations !== 402) throw Error('Actual IndexedDB installation does not contain the agreed fixture cardinalities: ' + JSON.stringify(installed))
  await blank.close(); await context.addInitScript(installCollector)
  const page = await context.newPage()
  if (diagnostic) {
    page.__qualityProfiler = await context.newCDPSession(page)
    await page.__qualityProfiler.send('Profiler.enable'); await page.__qualityProfiler.send('Profiler.setSamplingInterval', { interval: 1000 }); await page.__qualityProfiler.send('Profiler.start')
  }
  page.on('pageerror', error => { report.errors.push({ type: 'pageerror', message: error.message }); checkpoint() })
  page.on('response', response => { if (/\/assets\/.*\.(?:js|css)(?:\?|$)/.test(response.url()) && !report.assets.includes(response.url())) report.assets.push(response.url()) })
  page.on('dialog', dialog => dialog.accept())
  return { context, page }
}
async function collect(page, spec, action, navigation = false) {
  const before = navigation ? 0 : await page.evaluate(() => window.__qualityPerf.samples.length)
  try {
    if (navigation) { await action(); await page.evaluate(spec => window.__qualityPerf.navigate(spec), spec) }
    else { await page.evaluate(spec => window.__qualityPerf.arm(spec), spec); await action() }
    await page.waitForFunction(count => window.__qualityPerf.samples.length > count, before, { timeout: 90000, polling: 100 })
    const sample = await page.evaluate(() => window.__qualityPerf.samples.at(-1)); report.samples.push(sample)
  } catch (error) { report.samples.push({ family: spec.family, mode: spec.mode, valid: false, error: String(error), route: page.url() }) }
  checkpoint()
}
async function navigate(page, family, path, mode = 'SPA', selector = null, text = null) {
  // Setup navigation is separate from the timed trusted link click. A unique
  // offscreen link is an ordinary native data-nav link handled by the real app.
  await page.evaluate(path => { let link = document.querySelector('[data-quality-perf-nav]'); if (!link) { link = document.createElement('a'); link.setAttribute('data-quality-perf-nav', ''); link.style.cssText = 'position:fixed;bottom:0;right:0;z-index:100000;padding:4px;background:white'; const app=document.querySelector('#app');if(!app)throw Error('Actual application root missing');app.append(link) } link.href = path; link.dataset.nav = path; link.textContent = '性能导航' }, path)
  await collect(page, { family, mode, path, selector, text }, () => page.locator('[data-quality-perf-nav]').click())
}
const recordPath = `${root}/records?keyword=QPERF`, basicPath = `${root}/basic-standards`
try {
  for (const family of diagnostic ? ['entry:cold-records'] : ['entry:cold-basic', 'entry:cold-records']) for (let i = 0; i < (diagnostic ? 1 : samplesRequired); i++) {
    const { context, page } = await openFixtureContext(), path = family.endsWith('basic') ? basicPath : recordPath
    try { await collect(page, { family, mode: 'COLD', path, selector: 'tbody', text: family.endsWith('basic') ? '100条' : '10000条' }, () => page.goto(base + path, { waitUntil: 'commit' }), true) }
    finally {
      if (page.__qualityProfiler) { const profile = await page.__qualityProfiler.send('Profiler.stop'); writeFileSync(resolve(runDir, 'cold-records-cpu-profile.json'), JSON.stringify(profile)); report.cpuProfile = resolve(runDir, 'cold-records-cpu-profile.json') }
      await context.close()
    }
  }
  if (!diagnostic) {
  const { context, page } = await openFixtureContext()
  try {
    await page.goto(base + basicPath); await page.locator('[data-quality-management-page] tbody').waitFor()
    for (let i = 0; i < samplesRequired; i++) {
      await page.goto(base + recordPath); await page.locator('[data-quality-management-page] tbody').waitFor()
      await collect(page, { family: 'entry:refresh-records', mode: 'REFRESH', path: recordPath, selector: 'tbody', text: '10000条' }, () => page.reload({ waitUntil: 'commit' }), true)
      for (const name of ['basic-standards', 'additional-standards', 'inspection-rules', 'records', 'audits', 'statistics']) {
        const path = `${root}/${name}${['records', 'audits', 'statistics'].includes(name) ? '?keyword=QPERF' : ''}`
        await navigate(page, 'list:spa:' + name, path, 'SPA', name === 'statistics' ? 'section' : 'tbody')
      }
      const views = [
        ['detail:basic', `${basicPath}/garment-basic-v1`, 'article'],
        ['detail:additional', `${root}/additional-standards/qperf-additional-0`, 'article'], ['editor:additional', `${root}/additional-standards/qperf-additional-150/edit`, '[data-qm-editor]'],
        ['detail:rule', `${root}/inspection-rules/production-return-rule-v1`, 'section'],
        ['detail:production-record', `${root}/records/PRODUCTION_RETURN/QPERF-QC-00000`, 'details'],
        ['detail:inventory-record', `${root}/records/WAREHOUSE_STOCK/QPERF-QC-03000`, 'article'],
        ['detail:sample-record', `${root}/records/PRE_PRODUCTION_SAMPLE/QPERF-SAMPLE-0`, 'article'],
        ['detail:audit', `${root}/audits/${encodeURIComponent('PRODUCTION_RETURN|QPERF-QC-00000|audit:QPERF-QC-00000:round:1')}`, 'section'],
      ]
      for (const [family, path, selector] of views) await navigate(page, family, path, 'SPA', selector)
      await navigate(page, 'setup', `${basicPath}/qperf-basic-${i + 1}`, 'SPA', 'article')
      await page.locator('[data-qm-action="derive"]').click(); await page.locator('[data-qm-editor]').waitFor()
      const basicDraftPath = new URL(page.url()).pathname
      await navigate(page, 'setup', basicPath, 'SPA', 'tbody')
      await navigate(page, 'editor:basic', basicDraftPath, 'SPA', '[data-qm-editor]')
      // The rule effective detail is intentionally rendered instead of an edit
      // route. Derive a real draft via its actual button before timing editor.
      // (An effective version must never be editable in place.)
      await navigate(page, 'setup', `${root}/inspection-rules/production-return-rule-v1`, 'SPA', 'section')
      await page.locator('[data-qm-action="derive"]').click(); await page.locator('[data-qm-editor]').waitFor()
      const ruleDraftPath = new URL(page.url()).pathname
      await navigate(page, 'setup', basicPath, 'SPA', 'tbody')
      await navigate(page, 'editor:rule', ruleDraftPath, 'SPA', '[data-qm-editor]')
      await navigate(page, 'setup', `${root}/additional-standards/qperf-additional-150/edit`, 'SPA', '[data-qm-editor]')
      await page.locator('[data-qm-preview="styleId"]').fill('QPERF-STYLE-0'); await page.locator('[data-qm-preview="styleCategory"]').fill('QPERF-CATEGORY-0')
      for (const size of ['M', 'L']) {
        await page.locator('[data-qm-preview="size"]').fill(size)
        await collect(page, { family: 'action:preview-' + size, mode: 'ACTION', selector: '[data-qm-preview-result] article', textSelector: '[data-qm-preview-result]',
          ...(size === 'M' ? { text: 'M码性能胸围要求150' } : { notText: 'M码性能胸围要求150' }) }, () => page.locator('[data-qm-action="preview"]').click())
      }
      const name = `性能保存草稿${i}`, saveId = 'qperf-additional-150'
      await page.locator('[data-qm-edit="name"]').fill(name)
      await collect(page, { family: 'action:save-draft', mode: 'ACTION', text: '草稿已保存', minCommits: 1,
        readback: { database: 'higood-pcs-records', id: `${namespace}/config/${saveId}`, fields: { 'value.name': name, 'value.status': 'DRAFT' } } }, () => page.locator('[data-qm-action="save"]').click())
      const publishId = `qperf-additional-${295 + i}`
      await navigate(page, 'setup', `${root}/additional-standards/${publishId}/edit`, 'SPA', '[data-qm-editor]')
      await page.locator('[data-qm-action="publish"]').click(); await page.locator('[data-qm-action="confirm-publish"]').waitFor()
      await collect(page, { family: 'action:publish', mode: 'ACTION', text: '有效', minCommits: 1,
        readback: { database: 'higood-pcs-records', id: `${namespace}/config/${publishId}`, fields: { 'value.status': 'EFFECTIVE' } } }, () => page.locator('[data-qm-action="confirm-publish"]').click())
      await navigate(page, 'setup', recordPath, 'SPA', 'tbody')
      await page.locator('[data-qm-filter="keyword"]').fill('QPERF')
      await page.locator('[data-qm-filter="sourceKind"]').selectOption('PRODUCTION_RETURN')
      await page.locator('[data-qm-filter="factoryName"]').fill('性能车缝厂0')
      await page.locator('[data-qm-filter="dateFrom"]').fill('2026-10-22'); await page.locator('[data-qm-filter="dateTo"]').fill('2026-10-22')
      await collect(page, { family: 'action:query', mode: 'ACTION', selector: 'tbody', text: '300条' }, () => page.locator('[data-qm-action="query"]').click())
      const first = await page.locator('[data-quality-management-page] tbody tr').first().textContent()
      await collect(page, { family: 'action:pagination', mode: 'ACTION', selector: 'tbody', firstRecordDifferent: first }, () => page.locator('[data-qm-action="next-page"]').click())
      await navigate(page, 'setup', `${root}/statistics?keyword=QPERF&dateFrom=2026-10-22&dateTo=2026-10-22`, 'SPA', 'section')
      await collect(page, { family: 'action:statistics-drilldown', mode: 'SPA', selector: 'tbody', text: '3000条' }, () => page.locator('[data-quality-management-page] a[data-nav]').filter({ hasText: '查看同范围记录' }).first().click())
    }
    await page.screenshot({ path: resolve(runDir, 'center-final.png'), fullPage: false })
  } finally { await context.close() }
  }
  report.completed = true
} catch (error) { report.errors.push({ type: 'collector', message: String(error) }) }
finally { try { await browser.close() } finally { await transport.close();if(createdPreload && existsSync(preloadFile) && readFileSync(preloadFile,'utf8')===preloadHtml)unlinkSync(preloadFile);checkpoint() } }
report.samples = report.samples.filter(row => row.family !== 'setup')
report.passed = !diagnostic && report.distIndexMatches && report.completed && !report.errors.length && report.families.every(row => row.pass)
checkpoint()
console.log(JSON.stringify({ completed: report.completed, diagnostic, passed: report.passed, report: resolve(runDir, 'report.json'), families: report.families }, null, 2))
process.exitCode = report.passed || (diagnostic && report.completed && !report.errors.length) ? 0 : 1
