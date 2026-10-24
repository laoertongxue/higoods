#!/usr/bin/env node
// AC-029 follow-up only. No performance samples and no application source imports.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const arg = key => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1] }
const baseURL = arg('--base-url') || 'http://127.0.0.1:43222'
const output = resolve(arg('--output') || 'output/playwright/factory-qc-retired-routes-asset14')
const hash = value => createHash('sha256').update(value).digest('hex')
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const history = execFileSync('git', ['show', 'HEAD:src/router/routes.ts'], { encoding: 'utf8' })
const oldModel = execFileSync('git', ['show', 'HEAD:src/data/fcs/fabric-washing-model.ts'], { encoding: 'utf8' })
const oldTest = execFileSync('git', ['show', 'HEAD:tests/unit/fabric-washing-maintenance.test.ts'], { encoding: 'utf8' })
assert.ok(history.includes('craft\\/dyeing\\/washing\\/work-orders|pda\\/washing'))
assert.ok(oldModel.includes("const id = 'WASH-' + operationId") && oldTest.includes("'BACKUP-TEST'"))
const legacyId = 'WASH-BACKUP-TEST' // Exact identity produced by the retained historical contract, not a claimed live record.
const routes = ['/fcs/craft/dyeing/washing/work-orders', '/fcs/craft/dyeing/washing/work-orders/' + legacyId, '/fcs/pda/washing', '/fcs/pda/washing/' + legacyId]
await mkdir(output, { recursive: true })
const indexBefore = hash(await readFile('dist/index.html'))
const report = { AC: 'AC-029', startedAt: new Date().toISOString(), baseURL, HEAD: head, indexSha256: indexBefore, collectorSha256: hash(await readFile(new URL(import.meta.url))), historicalRouteEvidence: { revision: head, routeFile: 'src/router/routes.ts', routeRegex: '/^\\/fcs\\/(craft\\/dyeing\\/washing\\/work-orders|pda\\/washing)(?:\\/([^/]+))?$/', detailIdentity: legacyId, identityOrigin: 'fabric-washing-model.ts WASH- + operationId; fabric-washing-maintenance.test.ts BACKUP-TEST', detailIdentityIsHistoricalContractFixture: true, currentOldRecordCreated: false }, performance: '不采集性能样本；已退役业务入口只验证实际页面与旧写入消失', cases: [], errors: [], status: 'running' }
const browser = await chromium.launch({ headless: true })
try {
  for (const requestedRoute of routes) {
    const writes = [], context = await browser.newContext({ viewport: requestedRoute.includes('/pda/') ? { width: 390, height: 844 } : { width: 1366, height: 768 } })
    await context.exposeBinding('__retiredWrite', (_source, event) => writes.push({ ...event, observedAt: new Date().toISOString() }))
    await context.addInitScript(() => {
      const emit = event => { void window.__retiredWrite(event) }
      for (const method of ['put', 'add', 'delete', 'clear']) {
        const original = IDBObjectStore.prototype[method]
        IDBObjectStore.prototype[method] = function (value, ...rest) { emit({ storage: 'IndexedDB', database: this.transaction.db.name, store: this.name, method, collection: value?.collection, id: typeof value === 'string' ? value : value?.id }); return original.call(this, value, ...rest) }
      }
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method]
        Storage.prototype[method] = function (key, ...rest) { emit({ storage: this === localStorage ? 'localStorage' : 'sessionStorage', method, key }); return original.call(this, key, ...rest) }
      }
    })
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push({ route: requestedRoute, message: error.message }))
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ route: requestedRoute, message: message.text() }) })
    try {
      let authenticatedFactory
      if (requestedRoute.includes('/pda/')) {
        const returnTo = '/fcs/pda/stenter-handfeel'
        await page.goto(baseURL + '/fcs/pda/auth/login?returnTo=' + encodeURIComponent(returnTo)); await page.waitForSelector('[data-pda-login-field="loginId"]')
        await page.locator('[data-pda-login-field="loginId"]').fill('ID-F003_admin'); await page.locator('[data-pda-login-field="password"]').fill('123456'); await page.locator('[data-pda-login-action="submit"]').click()
        await page.waitForSelector('[data-stenter-list-root]'); authenticatedFactory = await page.evaluate(() => JSON.parse(localStorage.getItem('fcs_pda_session')).factoryId); assert.equal(authenticatedFactory, 'ID-F003')
      }
      const writesBeforeRoute = writes.length
      await page.goto(baseURL + requestedRoute, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: '页面未找到', exact: true }).waitFor()
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      const actualURL = page.url(), heading = await page.locator('h1').allTextContents(), body = await page.locator('body').innerText()
      assert.equal(new URL(actualURL).pathname, requestedRoute); assert.ok(!actualURL.includes('stenter-handfeel'))
      assert.equal(await page.locator('[data-washing-order], [data-washing-list-root], [data-washing-judgment-root], [data-fabric-washing-action]').count(), 0)
      assert.ok(!heading.some(text => text.includes('洗水加工单')))
      const oldWrites = writes.filter(event => /washing|fabric-washing/i.test([event.collection, event.id, event.key, event.database].filter(Boolean).join('|')))
      assert.equal(oldWrites.length, 0, '退役旧地址不得写旧集合/旧业务键')
      const oldRecords = await page.evaluate(async () => {
        const databases = await indexedDB.databases(); if (!databases.some(database => database.name === 'higood-pcs-records')) return []
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
        try { if (!db.objectStoreNames.contains('records')) return []; return await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').getAll(); tx.oncomplete = () => resolve(request.result.filter(record => /washing/i.test(record.collection || '')).map(record => ({ id: record.id, collection: record.collection }))); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
      })
      assert.equal(oldRecords.length, 0)
      report.cases.push({ requestedRoute, actualURL, documentTitle: await page.title(), headings: heading, bodySummary: body.slice(-700), authenticatedFactory: authenticatedFactory || null, oldPageAbsent: true, noRedirectToNewHandfeel: true, oldWrites, oldRecords, nativeWriteObservations: writes, writesObservedAfterRequestedNavigation: writes.slice(writesBeforeRoute), result: 'passed' })
      await page.screenshot({ path: join(output, 'route-' + report.cases.length + '.png'), fullPage: true })
    } finally { await context.close() }
  }
  assert.equal(report.errors.length, 0)
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.failure = { message: error.message, stack: error.stack } }
finally { await browser.close(); report.finishedAt = new Date().toISOString(); report.assetsStable = indexBefore === hash(await readFile('dist/index.html')); if (!report.assetsStable) report.status = 'invalid-assets-changed'; await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ output, status: report.status, cases: report.cases.length, errors: report.errors.length, assetsStable: report.assetsStable })); process.exitCode = report.status === 'passed' ? 0 : 1 }
