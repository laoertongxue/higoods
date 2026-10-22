// Fixed-build acceptance for the 2026-10-20 project-wide prototype cleanup.
// Never imports /src into a measured browser or changes default business data.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'

const base = process.env.FF_PERF_URL || 'http://127.0.0.1:43272'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Isolated local dist preview only')
const iterations = Number(process.env.FF_PERF_ITERATIONS || 5)
if (!Number.isSafeInteger(iterations) || iterations < 1) throw Error('FF_PERF_ITERATIONS must be a positive integer')
const outputRoot = path.resolve(process.env.FF_PERF_OUTPUT || 'output/verification/prototype-full-function-cleanup/performance')
const out = path.join(outputRoot, new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-') + '-' + process.pid)
fs.mkdirSync(out, { recursive: true })
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const assetHashes = () => Object.fromEntries(['dist/index.html', ...fs.readdirSync('dist/assets').filter(name => /\.(js|css)$/.test(name)).map(name => 'dist/assets/' + name)].sort().map(name => [name, hash(name)]))
const changedSources = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(name => name.startsWith('src/') && fs.existsSync(name))
const pdaSessionFile = process.env.FF_PERF_PDA_SESSION_FILE || 'output/verification/prototype-full-function-cleanup/pda-session.json'
const pdaSession = process.env.FF_PERF_PDA_SESSION ? JSON.parse(process.env.FF_PERF_PDA_SESSION) : fs.existsSync(pdaSessionFile) ? JSON.parse(fs.readFileSync(pdaSessionFile, 'utf8')) : null
const tmfFixtureFile = process.env.FF_PERF_TMF_FIXTURE_FILE || 'output/verification/prototype-full-function-cleanup/tmf-receipts-fixture.json'
const tmfFixture = fs.existsSync(tmfFixtureFile) ? JSON.parse(fs.readFileSync(tmfFixtureFile, 'utf8')) : null
const report = {
  at: new Date().toISOString(), base, out, cwd: process.cwd(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  diffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD'])).digest('hex'), scriptSha256: hash(new URL(import.meta.url)),
  sourceHashes: Object.fromEntries(changedSources.map(name => [name, hash(name)])), runtimeAssets: assetHashes(),
  node: process.version, machine: { cpu: os.cpus()[0]?.model, load: os.loadavg(), freeMemory: os.freemem(), totalMemory: os.totalmem() },
  thresholdMs: 1000, iterations, mode: iterations < 5 ? 'diagnostic; never formal acceptance' : 'formal',
  environment: 'Existing fixed dist preview; Chromium headless; Asia/Jakarta; no throttling; full default Mock in default-entry families; no source imports in measured contexts; TMF existing-record families use the separately documented native-IDB model fixture; each iteration launches a new browser process, route branches use isolated contexts. Cold means first target entry in an empty context; refresh and actual delegated SPA navigation are separate families. Actual trusted UI event start, semantic business result and applicable native-IDB readback, visible images/fonts and two animation frames. Only existing Mock PDA user session may be provided as an authentication prerequisite, separate from business data.',
  tmfModelFixture: tmfFixture ? { file: tmfFixtureFile, sha256: hash(tmfFixtureFile), construction: tmfFixture.construction, beforeCounts: tmfFixture.beforeCounts, afterCounts: tmfFixture.afterCounts, sourceIds: tmfFixture.sourceIds, timingBoundary: 'Native IDB restoration in a blank intercepted same-origin document before navigation timing; distinct existing-record-entry families, never claimed as default first-read.' } : null,
  pdaAuthentication: pdaSession ? { provided: true, source: process.env.FF_PERF_PDA_SESSION ? 'explicit existing Mock session env' : pdaSessionFile, sha256: createHash('sha256').update(JSON.stringify(pdaSession)).digest('hex') } : { provided: false },
  samples: [], failures: [], collectionErrors: [], definitions: {}, notApplicable: [], notCovered: [], screenshots: [],
}
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'collector.mjs'))
const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
let browser, iteration = 0
const brokenCollections = new Set()
function notApplicable(name, reason, evidence = {}) { report.notApplicable.push({ iteration, name, reason, evidence }); save() }
function notCovered(name, reason, evidence = {}) { report.notCovered.push({ iteration, name, reason, evidence }); save() }
function record(name, ms, extra = {}) {
  if (!Number.isFinite(ms) || ms < 0) throw Error('Invalid measurement for ' + name)
  const sample = { iteration, name, ms, pass: ms <= 1000, ...extra }
  report.samples.push(sample); if (!sample.pass) report.failures.push(sample); save()
}
async function finish(page) {
  return page.evaluate(async () => {
    const images = [...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 })
    await Promise.all(images.map(img => img.decode()))
    await document.fonts.ready
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { end: performance.now(), visibleImages: images.map(img => ({ src: img.currentSrc || img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight })) }
  })
}
async function makeContext(viewport = { width: 1366, height: 768 }, usePdaSession = false, nativeFixture = null) {
  const context = await browser.newContext({ viewport, timezoneId: 'Asia/Jakarta', acceptDownloads: true })
  if (usePdaSession) {
    if (!pdaSession) throw Error('Actual existing Mock PDA session missing')
    await context.addInitScript(({ origin, session }) => { if (location.origin === origin) localStorage.setItem('fcs_pda_session', JSON.stringify(session)) }, { origin: new URL(base).origin, session: pdaSession })
  }
  const page = await context.newPage(); page.setDefaultTimeout(12000)
  page.on('pageerror', error => { report.collectionErrors.push({ iteration, family: 'uncaught', error: error.message, url: page.url() }); save() })
  if (nativeFixture) await restoreNativeFixture(page, nativeFixture)
  return { context, page }
}
async function semantic(page, entry) {
  await expect(page.locator(entry.selector).first()).toBeVisible()
  if (entry.heading) await expect(page.getByRole('heading', { name: entry.heading, exact: true }).first()).toBeVisible()
  if (entry.check) await entry.check(page)
}
async function navigation(page, entry, reload = false) {
  const family = entry.name + (reload ? '刷新' : '首次访问')
  report.definitions[family] = { kind: reload ? 'refresh' : 'cold-context-entry', start: 'browser navigation start', finish: 'target semantic content, full default data, first-screen images/fonts and two animation frames', route: entry.route }
  if (reload) await page.reload({ waitUntil: 'commit' }); else await page.goto(base + entry.route, { waitUntil: 'commit' })
  await semantic(page, entry)
  const done = await finish(page); record(family, done.end, { url: page.url(), viewport: page.viewportSize(), ...done })
}
async function action(page, name, trigger, assertion, readback, type = 'click') {
  report.definitions[name] = { kind: 'action', start: 'actual trusted ' + type, finish: 'business assertion, applicable original-source readback, visible images/fonts and two animation frames' }
  await page.evaluate(type => {
    window.__ffPerfStart = undefined
    const capture = event => { if (!event.isTrusted) return; window.__ffPerfStart = performance.now(); document.removeEventListener(type, capture, true) }
    document.addEventListener(type, capture, true)
  }, type)
  await trigger(); await assertion()
  const readbackEvidence = readback ? await readback() : undefined
  const done = await finish(page), start = await page.evaluate(() => window.__ffPerfStart)
  if (start === undefined) throw Error('Missing actual trusted event: ' + name)
  record(name, done.end - start, { url: page.url(), viewport: page.viewportSize(), ...done, readback: readbackEvidence })
}
async function spa(entry) {
  const { context, page } = await makeContext(entry.viewport, entry.pda, entry.nativeFixture)
  try {
    // No target navigation before this action. The temporary control uses the
    // application's actual delegated data-nav handler; it does not call a router.
    await page.goto(base + '/', { waitUntil: 'commit' }); await expect(page.locator('main').first()).toBeVisible(); await finish(page)
    await page.evaluate(route => {
      const link = document.createElement('a'); link.href = route; link.dataset.nav = route; link.dataset.ffPerfNav = 'true'; link.textContent = '进入目标页面'
      link.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;background:white;padding:10px'; (document.querySelector('main') || document.body).append(link)
    }, entry.route)
    await action(page, entry.name + '站内切换', () => page.locator('[data-ff-perf-nav]').click(), () => semantic(page, entry))
  } finally { await context.close() }
}
async function screenshotEvidence(page, entry) {
  if (iteration !== 1) return
  for (const viewport of entry.pda || entry.name === '入驻申请' ? [{ width: 390, height: 844 }] : [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport); const done = await finish(page)
    const layout = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }))
    const file = entry.key + '-' + viewport.width + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: true })
    report.screenshots.push({ entry: entry.name, file, viewport, layout, visibleImages: done.visibleImages })
    if (layout.overflow) report.failures.push({ iteration, name: entry.name + '主体溢出', viewport, layout })
    save()
  }
  await page.setViewportSize(entry.viewport || { width: 1366, height: 768 }); await finish(page)
}
async function sampleRecord(page, assignmentId) {
  return page.evaluate(async id => {
    if (!(await indexedDB.databases()).some(db => db.name === 'higood-cutting-records-v1')) return null
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-cutting-records-v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onupgradeneeded = () => { r.transaction.abort(); reject(Error('Readback must not initialize a database')) } })
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').getAll(); let records
        request.onsuccess = () => { records = request.result }
        tx.oncomplete = () => resolve(records?.find(row => row.collection === 'production-context:samples' && row.value?.assignmentId === id)?.value || null)
        tx.onabort = () => reject(tx.error)
      })
    } finally { db.close() }
  }, assignmentId)
}
async function progressActions(page) {
  const table = page.locator('[data-material-list-view] > [data-standard-list-page] [data-standard-list-table-section]')
  const buttons = () => table.locator('tbody button[data-material-action="select-po"]')
  const firstId = await buttons().first().getAttribute('data-po-id'), initialRange = await table.locator('footer > p').textContent()
  await action(page, '物料进度关键词查询', () => page.locator('[data-material-field="keyword"]').fill(firstId), async () => {
    await expect(buttons()).toHaveCount(1); await expect(buttons().first()).toHaveAttribute('data-po-id', firstId)
    await expect(table.locator('footer > p')).toContainText('共 1 条')
  }, undefined, 'input')
  await action(page, '物料进度重置查询', () => page.locator('[data-material-action="reset-filters"]').click(), async () => { await expect(page.locator('[data-material-field="keyword"]')).toHaveValue(''); await expect(table.locator('footer > p')).toHaveText(initialRange) })
  if (await table.locator('[data-material-action="next-page"]').isEnabled()) {
    await action(page, '物料进度下一页', () => table.locator('[data-material-action="next-page"]').click(), () => expect(buttons().first()).not.toHaveAttribute('data-po-id', firstId))
    await table.locator('[data-material-action="prev-page"]').click(); await expect(buttons().first()).toHaveAttribute('data-po-id', firstId)
  } else notApplicable('物料进度下一页', '完整默认Mock不足一页；没有缩减数据', { initialRange })
  await action(page, '物料进度每页条数', async () => {
    // macOS headless native popup arrows fail even on a blank select. Use its
    // normal focused type-ahead key, producing trusted input/change events.
    await table.locator('[data-material-field="pageSize"]').focus()
    await page.keyboard.press('2')
  }, async () => { await expect(table.locator('[data-material-field="pageSize"]')).toHaveValue('20'); await expect(buttons()).toHaveCount(20) }, () => page.evaluate(() => ({ preference: localStorage.getItem('/fcs/progress/material:pageSize'), scope: 'discardable route preference only' })), 'keydown')
}
async function onboardingActions(page) {
  const input = page.locator('[data-pda-onboarding-file="identityFile"]'), submit = page.locator('[data-pda-onboarding-action="submit"]')
  await action(page, '入驻缺必填阻断', () => submit.click(), () => expect(page.getByText('请填写工厂简称', { exact: true })).toBeVisible())
  const bytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(16 * 1024, 32), Buffer.from('\n%%EOF')])
  await action(page, '入驻真实文件选择回显', async () => {
    const chooserPromise = page.waitForEvent('filechooser')
    await input.click()
    const chooser = await chooserPromise
    await chooser.setFiles({ name: 'performance-identity.pdf', mimeType: 'application/pdf', buffer: bytes })
  }, () => expect(page.locator('body')).toContainText('当前文件：performance-identity.pdf'))
}
const laceA = name => `[data-wls-lace-receipts-action="${name}"]`
const laceF = name => `[data-wls-lace-receipts-field="${name}"]`
async function laceActions(page) {
  const open = page.locator(laceA('open-receipt')).first()
  if (!await open.count()) { notCovered('LACE实际收货', '完整默认Mock没有待收货；不创建计时业务种子'); return }
  const id = await open.getAttribute('data-handover-id')
  const sourceRow = open.locator('xpath=ancestor::tr'), handoverNo = (await sourceRow.locator('td').first().innerText()).split('\n')[0]
  await action(page, 'LACE打开实际收货', () => open.click(), () => expect(page.getByRole('dialog')).toBeVisible())
  const quantity = Number(await page.locator(laceF('actualQty')).inputValue())
  await action(page, 'LACE取消实际收货', () => page.getByRole('dialog').locator(laceA('close-overlay')).first().click(), () => expect(page.getByRole('dialog')).toHaveCount(0))
  await page.locator(`${laceA('open-receipt')}[data-handover-id="${id}"]`).click(); await expect(page.getByRole('dialog')).toBeVisible()
  await action(page, 'LACE空收货人阻断', () => page.locator(laceA('save-receipt')).click(), () => expect(page.getByRole('dialog')).toContainText('实际收货人姓名'))
  const receiver = '辅料性能验收收货员'; await page.locator(laceF('receiverName')).fill(receiver)
  await action(page, 'LACE普通实际收货', () => page.locator(laceA('save-receipt')).click(), async () => {
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const row = page.locator('[data-wls-lace-receipts-table-surface] tbody tr').filter({ hasText: handoverNo }); await expect(row).toContainText(receiver); await expect(row).toContainText('已收货'); await expect(row).toContainText('数量一致')
  }, async () => ({ originalMemoryProjection: await page.locator('[data-wls-lace-receipts-table-surface] tbody tr').filter({ hasText: handoverNo }).innerText(), quantity, persistence: 'in-memory LACE domain result; no durable claim' }))
  // A separate untouched context keeps the over-receipt branch at the complete
  // default baseline; it does not fabricate or modify a source handover.
  const over = await makeContext()
  try {
    await over.page.goto(base + '/wls/accessory-receipts'); await expect(over.page.locator('[data-wls-lace-receipts-root]')).toBeVisible(); await finish(over.page)
    const target = over.page.locator(laceA('open-receipt')).first()
    if (!await target.count()) { notCovered('LACE主管二次确认', '默认Mock没有真实待收货来源'); return }
    const no = (await target.locator('xpath=ancestor::tr').locator('td').first().innerText()).split('\n')[0]
    await target.click(); const qty = Number(await over.page.locator(laceF('actualQty')).inputValue())
    await over.page.locator(laceF('receiverName')).fill(receiver); await over.page.locator(laceF('actualQty')).fill(String(qty + 1)); await over.page.locator(laceF('differenceReason')).fill('实物多到1单位，主管核验'); await over.page.locator(laceF('evidence')).fill('实物清点凭证.jpg')
    await action(over.page, 'LACE多收进入二次确认', () => over.page.locator(laceA('save-receipt')).click(), () => expect(over.page.getByRole('heading', { name: '多收二次确认', exact: true })).toBeVisible())
    await action(over.page, 'LACE缺主管姓名阻断', () => over.page.locator(laceA('confirm-over-receipt')).click(), () => expect(over.page.getByRole('dialog')).toContainText('实际确认主管姓名'))
    await over.page.locator(laceF('supervisorName')).fill('辅料性能验收主管')
    await action(over.page, 'LACE缺主管勾选阻断', () => over.page.locator(laceA('confirm-over-receipt')).click(), () => expect(over.page.getByRole('dialog')).toContainText('勾选确认'))
    await over.page.locator(laceF('supervisorConfirmed')).check()
    await action(over.page, 'LACE主管确认实际收货', () => over.page.locator(laceA('confirm-over-receipt')).click(), async () => { await expect(over.page.getByRole('dialog')).toHaveCount(0); const row = over.page.locator('[data-wls-lace-receipts-table-surface] tbody tr').filter({ hasText: no }); await expect(row).toContainText('辅料性能验收主管'); await expect(row).toContainText(receiver); await expect(row).toContainText('已收货') }, async () => ({ originalMemoryProjection: await over.page.locator('[data-wls-lace-receipts-table-surface] tbody tr').filter({ hasText: no }).innerText(), persistence: 'in-memory LACE domain result; no durable claim' }))
  } finally { await over.context.close() }
}
const sampleA = name => `[data-sample-approval-action="${name}"]`
const sampleF = name => `[data-sample-approval-field="${name}"]`
async function sampleActions(page) {
  await page.locator(sampleA('switch-tab:PENDING_APPROVAL')).click()
  await expect(page.getByRole('heading', { name: '待批版的产前版样衣', exact: true })).toBeVisible()
  const start = page.locator(sampleA('start-approval')).first()
  if (!await start.count()) { notCovered('批版领取及提交', '完整默认Mock未提供可领取样衣；未造计时种子'); return }
  const id = await start.getAttribute('data-assignment-id'), approver = '本轮性能验收批版员'
  await action(page, '批版打开领取', () => start.click(), () => expect(page.getByRole('dialog', { name: '领取批版', exact: true })).toBeVisible())
  await action(page, '批版领取空姓名阻断', () => page.locator(sampleA('confirm-start-approval')).click(), () => expect(page.getByRole('dialog')).toContainText('实际领取批版人员姓名'))
  await page.locator(sampleF('startApproverName')).fill(approver)
  await action(page, '批版领取缺勾选阻断', () => page.locator(sampleA('confirm-start-approval')).click(), () => expect(page.getByRole('dialog')).toContainText('勾选责任确认'))
  await page.locator(sampleF('startConfirmed')).check()
  await action(page, '批版实名领取保存', () => page.locator(sampleA('confirm-start-approval')).click(), () => expect(page.getByRole('dialog')).toHaveCount(0), async () => {
    await expect.poll(async () => (await sampleRecord(page, id))?.currentApproverName).toBe(approver)
    const row = await sampleRecord(page, id); return { collection: 'production-context:samples', assignmentId: id, status: row.sample.status, currentApproverName: row.currentApproverName }
  })
  await page.locator(`${sampleA('open-approval')}[data-assignment-id="${id}"]`).click(); await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator(sampleF('approverName')).fill('')
  await action(page, '批版提交空姓名阻断', () => page.locator(sampleA('submit-approval')).click(), () => expect(page.getByRole('dialog')).toContainText('实际提交人姓名'))
  await page.locator(sampleF('approverName')).fill('其他批版人'); await page.locator(sampleF('approverConfirmed')).check()
  await action(page, '批版非原领取人阻断', () => page.locator(sampleA('submit-approval')).click(), () => expect(page.getByRole('dialog')).toContainText('原领取人提交'))
  await page.locator(sampleF('approverName')).fill(approver); await page.locator(sampleF('approverConfirmed')).uncheck()
  await action(page, '批版提交缺勾选阻断', () => page.locator(sampleA('submit-approval')).click(), () => expect(page.getByRole('dialog')).toContainText('勾选确认'))
  await page.locator(sampleF('approverConfirmed')).check(); await page.locator(sampleF('conclusion')).selectOption('HAS_PROBLEM'); await page.locator(sampleF('processComment')).fill('腰带接头按样衣位置加固')
  await action(page, '批版原领取人提交保存', () => page.locator(sampleA('submit-approval')).click(), () => expect(page.getByRole('dialog')).toHaveCount(0), async () => {
    await expect.poll(async () => (await sampleRecord(page, id))?.suggestionVersions?.at(-1)?.uploadedByName).toBe(approver)
    const row = await sampleRecord(page, id); return { collection: 'production-context:samples', assignmentId: id, status: row.sample.status, uploader: row.suggestionVersions.at(-1).uploadedByName, processComment: row.suggestionVersions.at(-1).structuredComments.processComment }
  })
}
async function tmfCategory(page) {
  await action(page, 'TMF基础实收分类打开', () => page.locator('[data-wls-receipt-category="tmf-base"]').click(), () => expect(page.locator('[data-tmf-base-page="base-receipts"]')).toBeVisible())
  const count = await page.locator('[data-tmf-base-receipts-action="receive"]').count()
  if (!count) notApplicable('TMF普通及主管超收保存', '完整默认Mock没有已实际交出的基础半成品待收来源；不创建与缩减计时种子。本次普通/超收动作由独立命名的既有真实模型记录家族覆盖，不以默认空首读代替动作验收。', { defaultReceiveActions: count, text: await page.locator('[data-tmf-base-page="base-receipts"]').innerText() })
  else notCovered('TMF普通及主管超收保存', '默认数据存在待收来源，需主代理补原事实源/原生IDB结果计时；本脚本不猜扫码批次或制造采购单。', { defaultReceiveActions: count })
}
async function restoreNativeFixture(page, fixture) {
  await page.route('**/__ff_native_fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Native record restoration before measurement</title>' }))
  await page.goto(base + '/__ff_native_fixture.html')
  await page.evaluate(async fixture => {
    const revive = value => {
      if (value?.__fixtureType === 'Blob') return new Blob([new Uint8Array(value.bytes)], { type: value.type })
      if (Array.isArray(value)) return value.map(revive)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]))
      return value
    }
    for (const source of fixture.databases) {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(source.name, source.version)
        request.onupgradeneeded = () => {
          for (const definition of source.stores) {
            const store = request.result.createObjectStore(definition.name, { keyPath: definition.keyPath, autoIncrement: definition.autoIncrement })
            for (const index of definition.indexes || []) store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry })
          }
        }
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
      })
      try {
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(source.stores.map(store => store.name), 'readwrite')
          for (const definition of source.stores) for (const row of definition.rows) {
            const store = transaction.objectStore(definition.name), value = revive(row.value)
            if (definition.keyPath === null) store.put(value, row.key); else store.put(value)
          }
          transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error)
        })
      } finally { db.close() }
    }
  }, fixture)
  await page.unroute('**/__ff_native_fixture.html')
}
async function readTmfFixtureFacts(page) {
  return page.evaluate(async sourceIds => {
    if (!(await indexedDB.databases()).some(db => db.name === 'higood-pms')) return null
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pms'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { request.transaction.abort(); reject(Error('Readback cannot initialize PMS')) } })
    try {
      return await new Promise((resolve, reject) => {
        const names = ['pmsTmfOrders', 'pmsTmfProduction', 'pmsTmfOperations'], transaction = db.transaction(names, 'readonly'), sections = {}
        for (const name of names) { const request = transaction.objectStore(name).get('singleton'); request.onsuccess = () => { sections[name] = request.result?.section } }
        transaction.oncomplete = () => {
          const orders = sections.pmsTmfOrders || {}, production = sections.pmsTmfProduction || {}, operations = sections.pmsTmfOperations || {}
          resolve({ order: orders.orders?.find(row => row.purchaseOrderNo === sourceIds.purchaseOrderNo), handover: orders.handovers?.find(row => row.id === sourceIds.handoverId), lot: production.lots?.find(row => row.sourceHandoverId === sourceIds.handoverId), operations: (operations.operations || []).filter(row => row.objectId === sourceIds.handoverId) })
        }
        transaction.onabort = () => reject(transaction.error)
      })
    } finally { db.close() }
  }, tmfFixture.sourceIds)
}
async function tmfModelActions(page) {
  const ids = tmfFixture.sourceIds, receiver = '织带性能实收员', supervisor = '织带性能确认主管'
  const root = page.locator('[data-tmf-base-page="base-receipts"]'), actionNode = name => root.locator(`[data-tmf-base-receipts-action="${name}"]`)
  const row = () => root.locator('tbody tr').filter({ hasText: ids.purchaseOrderNo }), input = name => root.locator(`[data-tmf-dialog] [name="${name}"]`), error = root.locator('[data-tmf-dialog-error]')
  await action(page, 'TMF模型记录分类打开', () => page.locator('[data-wls-receipt-category="tmf-base"]').click(), async () => { await expect(root).toBeVisible(); await expect(row()).toHaveCount(1); await expect(row()).toContainText('12 / 0 / 12 米') })
  await screenshotEvidence(page, { key: 'tmf-model-receipts', name: 'TMF模型基础半成品收货' })
  await action(page, 'TMF模型普通实收打开', () => row().locator('[data-tmf-base-receipts-action="receive"]').click(), () => expect(root.locator('[data-tmf-dialog] h2')).toBeVisible())
  await input('scanBatch').fill(ids.batchId); await input('scanSku').fill(ids.sku); await input('quantity').fill('6'); await input('location').fill('A-01')
  await action(page, 'TMF模型实际收货人必填阻断', () => actionNode('confirm').click(), () => expect(error).toContainText('实际收货人姓名'), async () => { const facts = await readTmfFixtureFacts(page); expect(facts.order.receivedQty).toBe(0); expect(facts.operations).toHaveLength(0); return { receivedQty: facts.order.receivedQty, operations: facts.operations.length } })
  await input('receiverName').fill(receiver)
  await action(page, 'TMF模型普通实收6米保存', () => actionNode('confirm').click(), () => expect(root.locator('[data-tmf-dialog] h2')).toHaveCount(0), async () => {
    await expect.poll(async () => (await readTmfFixtureFacts(page))?.order?.receivedQty).toBe(6)
    const facts = await readTmfFixtureFacts(page), operation = facts.operations.at(-1)
    expect(facts.handover.receivedMeters).toBe(6); expect(facts.lot.onHandMeters).toBe(6); expect(operation.actor.name).toBe(receiver); expect(operation.actor.role).toBe('仓管')
    return { orderedQty: facts.order.orderedQty, receivedQty: facts.order.receivedQty, handoverReceived: facts.handover.receivedMeters, onHand: facts.lot.onHandMeters, operation }
  })
  await row().locator('[data-tmf-base-receipts-action="receive"]').click(); await expect(root.locator('[data-tmf-dialog] h2')).toBeVisible()
  await input('scanBatch').fill(ids.batchId); await input('scanSku').fill(ids.sku); await input('quantity').fill('7'); await input('receiverName').fill(receiver); await input('supervisorName').fill(supervisor); await input('overReceiptConfirmed').check(); await input('overReceiptReason').fill('采购计划10米，已核对12米实际交出来源')
  const unchangedSix = async () => { const facts = await readTmfFixtureFacts(page); expect(facts.order.receivedQty).toBe(6); expect(facts.operations).toHaveLength(1); return { receivedQty: facts.order.receivedQty, operations: facts.operations.length } }
  await action(page, 'TMF模型超上游实交阻断', () => actionNode('confirm').click(), () => expect(error).toContainText('超过上游实际交出'), unchangedSix)
  await input('quantity').fill('6'); await input('supervisorName').fill('')
  await action(page, 'TMF模型超收缺主管姓名阻断', () => actionNode('confirm').click(), () => expect(error).toContainText('实际确认主管姓名'), unchangedSix)
  await input('supervisorName').fill(supervisor); await input('overReceiptConfirmed').uncheck()
  await action(page, 'TMF模型超收缺二次确认阻断', () => actionNode('confirm').click(), () => expect(error).toContainText('勾选二次确认'), unchangedSix)
  await input('overReceiptConfirmed').check(); await input('overReceiptReason').fill('')
  await action(page, 'TMF模型超收缺原因阻断', () => actionNode('confirm').click(), () => expect(error).toContainText('超收须填写原因'), unchangedSix)
  await input('overReceiptReason').fill('采购计划10米，原交出12米实物齐全，主管核对超产2米')
  await action(page, 'TMF模型主管确认补收6米保存', () => actionNode('confirm').click(), () => expect(root.locator('[data-tmf-dialog] h2')).toHaveCount(0), async () => {
    await expect.poll(async () => (await readTmfFixtureFacts(page))?.order?.receivedQty).toBe(12)
    const facts = await readTmfFixtureFacts(page), operation = facts.operations.at(-1)
    expect(facts.order.orderedQty).toBe(10); expect(facts.handover.receivedMeters).toBe(12); expect(facts.lot.onHandMeters).toBe(12); expect(facts.order.overReceipts.at(-1).meters).toBe(2)
    expect(operation.actor.name).toBe(supervisor); expect(operation.actor.role).toBe('仓库主管'); expect(operation.receivedBy.name).toBe(receiver); expect(operation.receivedBy.id).not.toBe(operation.actor.id)
    return { orderedQty: facts.order.orderedQty, receivedQty: facts.order.receivedQty, handoverReceived: facts.handover.receivedMeters, onHand: facts.lot.onHandMeters, overReceiptMeters: facts.order.overReceipts.at(-1).meters, operations: facts.operations }
  })
  await action(page, 'TMF模型双人原始操作详情', () => row().locator('[data-tmf-base-receipts-action="detail"]').click(), async () => { await expect(root.locator('[data-tmf-dialog]')).toContainText('实收人 ' + receiver); await expect(root.locator('[data-tmf-dialog]')).toContainText('超收确认 ' + supervisor) }, () => readTmfFixtureFacts(page))
}
const entries = [
  { key: 'material-progress', name: '物料进度', route: '/fcs/progress/material', selector: '[data-material-list-view]', actions: progressActions },
  { key: 'pda-handover', name: 'PDA静态交接明细', route: '/fcs/pda/handover/HOH-MOCK-IRON-PACK-404?demoRole=VIEWER', selector: '[data-handout-record-id]', pda: true, viewport: { width: 390, height: 844 } },
  { key: 'onboarding', name: '入驻申请', route: '/fcs/pda/auth/onboarding', selector: '[data-pda-onboarding-file="identityFile"]', viewport: { width: 390, height: 844 }, actions: onboardingActions },
  { key: 'cutting-daily', name: '裁床日报', route: '/fcs/craft/cutting/statistics/daily-production?includeDemoData=0', selector: '[data-testid="cutting-daily-production-report-page"]' },
  { key: 'stenter-handfeel', name: '定型机手感单', route: '/fcs/craft/dyeing/stenter-handfeel/work-orders', selector: '[data-stenter-list-root]', check: page => expect(page.locator('[data-stenter-handfeel-action="storage"]')).toHaveCount(0) },
  { key: 'post-audit', name: '后道审计', route: '/fcs/craft/post-finishing/audit-records', selector: '[data-standard-list-page]', heading: '差异与操作日志', check: page => expect(page.locator('[data-post-finishing-action="storage-export"], [data-post-finishing-field="storage-import"]')).toHaveCount(0) },
  { key: 'replacement-fabric', name: '换片布菲票', route: '/fcs/craft/cutting/replacement-fabric-fei-tickets', selector: '[data-hpb-page]', check: page => expect(page.locator('[data-hpb-action="data-tools"]')).toHaveCount(0) },
  { key: 'wls-lace', name: 'WLS辅料收货', route: '/wls/accessory-receipts', selector: '[data-wls-lace-receipts-root]', actions: async page => { await laceActions(page); await tmfCategory(page) } },
  { key: 'sample-approval', name: '批版建议', route: '/fcs/sewing-outsourcing/sample-approval-suggestions', selector: '[data-sample-approval-page]', actions: sampleActions },
  { key: 'tmf-fixture', name: 'TMF模型既有记录入口', route: '/wls/accessory-receipts', selector: '[data-wls-lace-receipts-root]', requiresTmfFixture: true, nativeFixture: tmfFixture, actions: tmfModelActions },
]
const selectedKeys = process.env.FF_PERF_ENTRIES?.split(',').filter(Boolean)
if (selectedKeys?.some(key => !entries.some(entry => entry.key === key))) throw Error('Unknown FF_PERF_ENTRIES key')
const selectedEntries = selectedKeys ? entries.filter(entry => selectedKeys.includes(entry.key)) : entries
report.selectedEntryKeys = selectedEntries.map(entry => entry.key)
report.plannedEntries = selectedEntries.map(({ key, name, route, pda, viewport }) => ({ key, name, route, pda: Boolean(pda), viewport: viewport || { width: 1366, height: 768 }, familyKinds: ['first-entry', 'refresh', 'actual SPA navigation'] }))
report.tmfEntryReason = 'TMF基础实收没有独立路由，复用 /wls/accessory-receipts 的cold/refresh/SPA，另按真实分类点击记录独立家族。'
save()
try {
  for (iteration = 1; iteration <= iterations; iteration++) {
    browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version()
    console.log(`Prototype performance ${iteration}/${iterations}; fresh Chromium process; output ${out}`)
    try {
      for (const entry of selectedEntries) {
        if (entry.requiresTmfFixture && !tmfFixture) { notCovered(entry.name, '缺少非计时导出的真实模型原生IDB资料；不能用默认空数据替代收货动作验收'); continue }
        if (entry.pda && !pdaSession) { notCovered(entry.name, '缺少已确认的真实Mock PDA会话。请提供FF_PERF_PDA_SESSION_FILE；不以登录页冒充明细页。'); continue }
        if (brokenCollections.has(entry.key)) continue
        const { context, page } = await makeContext(entry.viewport, entry.pda, entry.nativeFixture)
        try {
          await navigation(page, entry); await navigation(page, entry, true); if (!entry.requiresTmfFixture) await screenshotEvidence(page, entry)
          if (entry.actions) await entry.actions(page)
        } catch (error) {
          const issue = { iteration, family: entry.name, error: String(error), url: page.url(), kind: 'collection/semantic failure; no numeric sample fabricated' }
          report.collectionErrors.push(issue); brokenCollections.add(entry.key); console.error(issue)
          await page.screenshot({ path: path.join(out, `${entry.key}-${iteration}-failure.png`), fullPage: true }).catch(() => {}); save()
        } finally { await context.close() }
        if (!brokenCollections.has(entry.key)) {
          try { await spa(entry) } catch (error) { report.collectionErrors.push({ iteration, family: entry.name + '站内切换', error: String(error), kind: 'collection/semantic failure' }); brokenCollections.add(entry.key); save() }
        }
      }
    } finally { await browser.close(); browser = undefined }
  }
} finally {
  if (browser) await browser.close()
  report.runtimeAssetsAfter = assetHashes(); report.assetsUnchanged = JSON.stringify(report.runtimeAssetsAfter) === JSON.stringify(report.runtimeAssets)
  const families = [...new Set(report.samples.map(sample => sample.name))]
  report.familySummary = families.map(name => { const samples = report.samples.filter(sample => sample.name === name); return { name, count: samples.length, maxMs: Math.max(...samples.map(sample => sample.ms)), allPass: samples.every(sample => sample.pass) } })
  report.validSampleCount = report.samples.length; report.maximumMs = report.samples.length ? Math.max(...report.samples.map(sample => sample.ms)) : null
  report.allCollectedFamiliesHaveFive = report.familySummary.every(family => family.count >= 5)
  report.accepted = iterations >= 5 && report.samples.length > 0 && report.assetsUnchanged && report.allCollectedFamiliesHaveFive && !report.failures.length && !report.collectionErrors.length && !report.notCovered.length
  report.completedAt = new Date().toISOString(); save(); console.log(JSON.stringify({ out, families: families.length, samples: report.samples.length, maximumMs: report.maximumMs, failures: report.failures.length, collectionErrors: report.collectionErrors.length, notCovered: report.notCovered.length, accepted: report.accepted }))
  if (report.failures.length || report.collectionErrors.length || report.notCovered.length || !report.assetsUnchanged || iterations >= 5 && !report.allCollectedFamiliesHaveFive) process.exitCode = 1
}
