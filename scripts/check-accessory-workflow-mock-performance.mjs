import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'
const base = process.env.ACCESSORY_MOCK_PERF_URL || 'http://127.0.0.1:43323'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Isolated local preview only')
const output = process.env.ACCESSORY_MOCK_PERF_OUTPUT || 'output/verification/accessory-workflow-mock/performance'
fs.mkdirSync(output, { recursive: true })
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const assets = () => Object.fromEntries(['dist/index.html', ...fs.readdirSync('dist/assets').filter(f => /\.(js|css)$/.test(f)).map(f => `dist/assets/${f}`)].sort().map(f => [f, hash(f)]))
const entries = [
  ...['preparation', 'transfers', 'stock'].map(view => ({ route: `/wls/accessory-warehouses/gtp/${view}`, key: `wls-accessory-gtp-${view}` })),
  ...['hilon', 'mahameru'].flatMap(site => ['receipts', 'pickups', 'transfers', 'stock'].map(view => ({ route: `/wls/accessory-warehouses/${site}/${view}`, key: `wls-accessory-${site}-${view}` }))),
  { route: '/fcs/craft/post-finishing/material-transfers', key: 'pfos-post-finishing-material-transfers' },
  { route: '/fcs/sewing-outsourcing/tasks', key: 'sewing-outsourcing-tasks' },
]
const report = { at: new Date().toISOString(), cwd: process.cwd(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), base,
  scriptSha256: hash(new URL(import.meta.url)), runtimeAssets: assets(), browser: '', thresholdMs: 1000,
  conditions: 'Fixed production dist; five new Chromium processes, isolated contexts, 1366x768, Asia/Shanghai, default network, no fixture injection or prewarm. New Mock baseline 14 orders/237 records plus original records; all active data and guards. Cold navigation, refresh and SPA separate. Visible photos/fonts plus two frames; successful save includes readonly IndexedDB readback. User filling time excluded. Locations unchanged static master, functionally checked at three widths; no new performance family.',
  families: {}, samples: [], failures: [] }
fs.copyFileSync(new URL(import.meta.url), path.join(output, 'collector.mjs'))
const save = () => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2))
async function finish(page) {
  return page.evaluate(async () => {
    const images = [...document.querySelectorAll('main img')].filter(img => { const r = img.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 })
    await Promise.all(images.map(img => img.decode()))
    await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return performance.now()
  })
}
let iteration = 0
function record(family, ms, details = {}) {
  const sample = { iteration, family, ms, pass: Number.isFinite(ms) && ms <= 1000, ...details }
  report.samples.push(sample); if (!sample.pass) report.failures.push(sample); save()
}
async function ready(page, route) {
  await expect(page).toHaveURL(base + route)
  await expect(page.locator('main table').first()).toBeVisible()
  await expect(page.locator('main tbody tr').first()).toBeVisible()
}
async function navigation(page, entry, mode) {
  if (mode === 'cold') await page.goto(base + entry.route, { waitUntil: 'commit' })
  else await page.reload({ waitUntil: 'commit' })
  await ready(page, entry.route)
  record(`${entry.key}:${mode}`, await finish(page))
}
async function action(page, name, trigger, predicate, durable) {
  await page.evaluate(() => { window.__awStart = undefined; document.addEventListener('click', e => { if (e.isTrusted) window.__awStart = performance.now() }, { capture: true, once: true }) })
  await trigger(); await predicate(); if (durable) await durable()
  const end = await finish(page), start = await page.evaluate(() => window.__awStart)
  if (start === undefined) throw Error('Missing trusted click ' + name)
  record(name, end - start)
}
async function physical(page, predicate) {
  const rows = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('higood-cutting-records-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('records', 'readonly'), read = tx.objectStore('records').getAll(IDBKeyRange.bound('accessory-warehouse:', 'accessory-warehouse:\uffff'))
      tx.oncomplete = () => { db.close(); resolve(read.result) }; tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }))
  if (!predicate(rows)) throw Error('Saved result not durable')
}
async function context(browser, width = 1366) {
  const c = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 768 }, timezoneId: 'Asia/Shanghai' }), page = await c.newPage()
  page.setDefaultTimeout(15000)
  await page.addInitScript(() => { globalThis.__name = value => value })
  page.on('pageerror', e => { report.failures.push({ iteration, error: e.message }); save() })
  page.on('dialog', d => d.accept())
  return { c, page }
}
const button = name => `[data-accessory-transfer-action="${name}"]`
async function operations(browser) {
  const { c, page } = await context(browser)
  try {
    const gtp = '/wls/accessory-warehouses/gtp/preparation'
    await page.goto(base + gtp); await ready(page, gtp)
    await page.locator('[data-accessory-field="keyword"]').fill('PO-AW-202610-C01')
    await page.locator('[data-accessory-action="query"]').click()
    await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(1)
    await action(page, 'gtp-prepare-open:six-lines', () => page.locator('[data-accessory-action="prepare"]').click(), () => expect(page.locator('[data-aw-qty]')).toHaveCount(6))
    for (let i = 0; i < 6; i++) await page.locator('[data-aw-qty]').nth(i).fill(String([50, 100, 50, 50, 50, 0.5][i]))
    await action(page, 'gtp-prepare-complete:auto-transfer', () => page.locator('[data-accessory-action="save-preparation"]').click(), () => expect(page.getByRole('dialog')).not.toBeVisible(), () => physical(page, rows => rows.some(r => r.collection.endsWith(':preparation') && r.value.productionOrderId.endsWith('C01') && r.value.status === '已配齐') && rows.some(r => r.collection.endsWith(':transfer') && r.value.productionOrderId.endsWith('C01'))))
    const gtpTransfers = '/wls/accessory-warehouses/gtp/transfers'
    await page.goto(base + gtpTransfers); await ready(page, gtpTransfers)
    await page.locator('[data-accessory-transfer-field="keyword"]').fill('PO-AW-202610-H01')
    await page.locator('[data-accessory-transfer-action="query"]').click()
    await expect(page.locator('main tbody tr')).toHaveCount(1)
    await page.locator('main tbody tr').filter({ hasText: 'PO-AW-202610-H01' }).locator(button('dispatch')).click()
    await action(page, 'gtp-dispatch:six-lines', () => page.getByRole('dialog').getByRole('button', { name: '整单确认出库', exact: true }).click(), () => expect(page.getByRole('dialog')).not.toBeVisible(), () => physical(page, rows => rows.some(r => r.collection.endsWith(':transfer') && r.value.id === 'AW-MOCK:H01:GTP' && r.value.status === '已出库待收货')))
    // Same handler, six-line scope and data scale for HILON/Mahameru; alternate warehouses.
    const site = iteration % 2 ? 'hilon' : 'mahameru', code = site === 'hilon' ? 'H' : 'M'
    const route = `/wls/accessory-warehouses/${site}/receipts`
    await page.goto(base + route); await ready(page, route)
    const row = page.locator('main tbody tr').filter({ hasText: `PO-AW-202610-${code}02` })
    await action(page, 'receipt-open:six-lines', () => row.locator(button('receive')).click(), () => expect(page.getByRole('dialog')).toBeVisible())
    const dialog = page.getByRole('dialog'), qs = dialog.locator('[data-aw-transfer-qty]'), ls = dialog.locator('[data-aw-transfer-location]')
    for (let i = 0; i < 6; i++) { await qs.nth(i).fill(String([100, 200, 100, 100, 100, 1][i])); await ls.nth(i).selectOption({ index: 1 }) }
    await action(page, 'receipt-save:six-lines', () => dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click(), () => expect(dialog).not.toBeVisible(), () => physical(page, rows => rows.some(r => r.collection.endsWith(':transfer') && r.value.id === `AW-MOCK:${code}02:GTP` && r.value.status === '已收货')))
    const pickups = `/wls/accessory-warehouses/${site}/pickups`
    await page.goto(base + pickups); await ready(page, pickups)
    await action(page, 'pickup-create:sewing-and-post', () => page.locator('main tbody tr').filter({ hasText: `PO-AW-202610-${code}03` }).locator('[data-accessory-pickup-action="create"]').click(), () => expect(page.getByRole('status')).toContainText('已按有效车缝任务建立'), () => physical(page, rows => rows.some(r => r.collection.endsWith(':pickup') && r.value.productionOrderId.endsWith(`${code}03`))))
    const pr = page.locator('main tbody tr').filter({ hasText: `PO-AW-202610-${code}05` })
    await action(page, 'pickup-open:four-lines', () => pr.locator('[data-accessory-pickup-action="handover"]').click(), () => expect(page.getByRole('dialog')).toBeVisible())
    for (let i = 0; i < 4; i++) await page.locator('[data-aw-pickup-qty]').nth(i).fill(String([60, 60, 60, 0.6][i]))
    await action(page, 'pickup-save:remaining-sixty-percent', () => page.getByRole('dialog').getByRole('button', { name: '确认本次实交' }).click(), () => expect(page.getByRole('dialog')).not.toBeVisible(), () => physical(page, rows => rows.some(r => r.collection.endsWith(':pickup') && r.value.productionOrderId.endsWith(`${code}05`) && r.value.status === '已领料')))
    const transfers = `/wls/accessory-warehouses/${site}/transfers`
    await page.goto(base + transfers); await ready(page, transfers)
    await page.locator('main tbody tr').filter({ hasText: `PO-AW-202610-${code}04` }).locator(button('dispatch')).click()
    await action(page, 'post-dispatch:two-lines', () => page.getByRole('dialog').getByRole('button', { name: '整单确认出库', exact: true }).click(), () => expect(page.getByRole('dialog')).not.toBeVisible(), () => physical(page, rows => rows.some(r => r.collection.endsWith(':transfer') && r.value.kind === 'SITE_TO_POST' && r.value.productionOrderId.endsWith(`${code}04`) && r.value.status === '已出库待收货')))
    const post = '/fcs/craft/post-finishing/material-transfers'
    await page.goto(base + post); await ready(page, post)
    await page.locator('main tbody tr').filter({ hasText: `PO-AW-202610-${code}05` }).locator('[data-post-finishing-material-transfers-action="detail"]').click()
    const postDialog = page.getByRole('dialog')
    await expect(postDialog).toBeVisible()
    for (let i = 0; i < 2; i++) { await postDialog.locator('[data-post-material-qty]').nth(i).fill(String([100, 200][i])); await postDialog.locator('[data-post-material-location]').nth(i).selectOption({ index: 1 }) }
    await action(page, 'post-receive:two-lines', () => postDialog.getByRole('button', { name: '确认收货并上架' }).click(), () => expect(page.locator('[data-post-finishing-material-transfers-action="receive"]')).not.toBeVisible(), () => physical(page, rows => rows.some(r => r.collection.endsWith(':transfer') && r.value.kind === 'SITE_TO_POST' && r.value.productionOrderId.endsWith(`${code}05`) && r.value.status === '已收货')))
  } finally { await c.close() }
}
try {
  for (iteration = 1; iteration <= 5; iteration++) {
    const browser = await chromium.launch(); report.browser = browser.version()
    try {
      for (const entry of entries) {
        const { c, page } = await context(browser)
        try {
          await navigation(page, entry, 'cold'); await navigation(page, entry, 'refresh')
          const actualTabKey = await page.locator('[data-action="activate-tab"]').first().getAttribute('data-tab-key')
          const other = entry.key.startsWith('pfos-') ? '/fcs/craft/post-finishing/work-orders' : entry.route.includes('/wls/') ? '/wls/accessory-warehouses/gtp/locations' : '/fcs/progress/material'
          await page.goto(base + other); await expect(page.locator('main table').first()).toBeVisible()
          await action(page, `${entry.key}:spa`, () => page.locator(`[data-action="activate-tab"][data-tab-key="${actualTabKey}"]`).click(), () => ready(page, entry.route))
        } finally { await c.close() }
      }
      for (const width of [1280, 1024]) for (const entry of [entries[0], entries[11]]) {
        const { c, page } = await context(browser, width)
        try { await navigation(page, { ...entry, key: `${entry.key}:${width}` }, 'cold') } finally { await c.close() }
      }
      await operations(browser)
      console.log(`Mock performance iteration ${iteration}: ${report.samples.length} samples, ${report.failures.length} failures`)
    } finally { await browser.close() }
  }
} catch (error) { report.failures.push({ iteration, collectorError: String(error) }); console.error(error); process.exitCode = 1 }
finally {
  report.runtimeAssetsAfter = assets()
  if (JSON.stringify(report.runtimeAssets) !== JSON.stringify(report.runtimeAssetsAfter)) report.failures.push({ error: 'Runtime assets changed' })
  for (const name of new Set(report.samples.map(x => x.family))) {
    const samples = report.samples.filter(x => x.family === name); report.families[name] = { count: samples.length, maxMs: Math.max(...samples.map(x => x.ms)), pass: samples.length >= 5 && samples.every(x => x.pass) }
  }
  if (Object.values(report.families).some(x => !x.pass) || report.failures.length) process.exitCode = 1
  save()
}
