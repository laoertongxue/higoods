/**
 * Current accessory-flow UI performance collector. Retired local-data,
 * migration, backup/restore and transfer-cutover controls are not UI families.
 * Their data-protection contracts remain in the migration/records tests;
 * removing the controls does not mark those contracts or timings as passed.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  runAccessoryPerformanceExtras,
  ACCESSORY_PERFORMANCE_EXTRA_FAMILIES,
} from './accessory-warehouse-performance-extras.mjs'
const require = createRequire(path.resolve('package.json'))
const { chromium, expect } = require('@playwright/test')
const base = process.env.AW_PERF_URL || 'http://127.0.0.1:43250'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local isolated preview only')
const out = path.resolve(
  process.env.AW_PERF_OUTPUT ||
    `output/verification/accessory-performance/${new Date().toISOString().replaceAll(':', '-')}`,
)
fs.mkdirSync(out, { recursive: true })
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const indexSha = sha('dist/index.html'),
  report = {
    at: new Date().toISOString(),
    base,
    cwd: process.cwd(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    indexSha256: indexSha,
    thresholdMs: 1000,
    measurements: [],
    definitions: {},
    failures: [],
    browser: '',
    conditions:
      'Fixed dist; local preview; Chromium headless; no network throttle or module prewarm; viewport 1366x768, warehouse 1024x768 and PDA390x844 named per sample; Asia/Jakarta. Five fresh processes for browser-cold GTP. Other first-visits use new contexts. UI actions use trusted events, end after semantic assertion, readonly durable assertion where relevant, visible image decode and two animation frames. No user reading or form filling waits included. Fixture setup is before navigation and never imports source modules into dist.',
  }
const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
const readFixture = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const fixtures = {
  sew: readFixture('tests/fixtures/accessory-warehouse/sew.json'),
  mixed: readFixture('tests/fixtures/accessory-warehouse/mixed.json'),
  post: readFixture('tests/fixtures/accessory-warehouse/post.json'),
}
report.nodeVersion = process.version
report.machine = {
  platform: os.platform(),
  release: os.release(),
  cpu: os.cpus()[0]?.model,
  logicalCpus: os.cpus().length,
  loadAtStart: os.loadavg(),
}
report.scriptSha256 = sha(new URL(import.meta.url))
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'collector.mjs'))
report.extrasSha256 = sha('scripts/accessory-warehouse-performance-extras.mjs')
fs.copyFileSync(
  'scripts/accessory-warehouse-performance-extras.mjs',
  path.join(out, 'accessory-warehouse-performance-extras.mjs'),
)
const assets = () =>
  Object.fromEntries(
    [
      'dist/index.html',
      ...fs
        .readdirSync('dist/assets')
        .filter((x) => /\.(js|css)$/.test(x))
        .map((x) => 'dist/assets/' + x),
    ]
      .sort()
      .map((x) => [x, sha(x)]),
  )
report.runtimeAssets = assets()
for (const [key, value] of Object.entries(fixtures))
  fs.writeFileSync(path.join(out, `fixture-${key}.json`), JSON.stringify(value, null, 2))
report.fixtureDigests = Object.fromEntries(
  Object.entries(fixtures).map(([key, value]) => [
    key,
    createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  ]),
)
let iteration = 0, browser
async function ready(page, predicate) {
  if (typeof predicate === 'string') await page.locator(predicate).first().waitFor({ state: 'visible' })
  else await predicate()
}
async function finish(page) {
  return page.evaluate(async () => {
    const print = document.querySelector('[data-aw-print],.print-preview-root')
    const imgs = print
      ? [...print.querySelectorAll('img')]
      : [...document.images].filter((img) => {
          const r = img.getBoundingClientRect()
          return (
            r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0
          )
        })
    await Promise.all(imgs.map((img) => img.decode()))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { end: performance.now(), imageCount: imgs.length }
  })
}
function record(name, result, extra = {}) {
  const row = { iteration, name, ...result, ...extra, pass: Number.isFinite(result.ms) && result.ms <= 1000 }
  report.measurements.push(row)
  if (!row.pass) report.failures.push(row)
  save()
  return row
}
function installPickupPaperObserver(onlyPickupPage = false) {
  if (onlyPickupPage && new URLSearchParams(location.search).get('documentType') !== 'PICKUP_SLIP') return
  window.__awStopPaperObserver?.()
  window.__awPaperReady = undefined
  let checking = false,
    stopped = false
  const stop = () => {
    stopped = true
    observer.disconnect()
    document.removeEventListener('load', check, true)
    document.removeEventListener('error', check, true)
  }
  const check = async () => {
    if (stopped || checking) return
    const params = new URLSearchParams(location.search),
      sourceId = params.get('sourceId')
    const paper = document.querySelector('.print-preview-root')
    if (
      params.get('documentType') !== 'PICKUP_SLIP' ||
      !sourceId ||
      !paper ||
      paper.textContent.includes('打印预览无法生成') ||
      !paper.querySelector('[data-real-qr] svg')
    )
      return
    const images = [...paper.querySelectorAll('img')]
    if (!images.length || images.some((image) => !image.complete || !image.naturalWidth)) return
    checking = true
    try {
      const version = await new Promise((resolve, reject) => {
        const request = indexedDB.open('higood-cutting-records-v1')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result,
            tx = database.transaction('records', 'readonly')
          let value
          const row = tx.objectStore('records').get(`accessory-warehouse:sewing-slip:${sourceId}`)
          row.onsuccess = () => {
            value = row.result?.value
          }
          tx.oncomplete = () => {
            database.close()
            resolve(value)
          }
          tx.onabort = () => {
            database.close()
            reject(tx.error)
          }
        }
      })
      const requiredImages =
        new Set(version?.lines?.filter((line) => line.objectType !== '裁片').map((line) => line.objectCode)).size + 1
      if (
        !version ||
        version.status !== 'CURRENT' ||
        !paper.textContent.includes(version.versionLabel) ||
        images.length !== requiredImages ||
        paper.querySelectorAll('.print-table tbody tr').length < version.lines.length ||
        version.lines.some((line) => !paper.textContent.includes(line.objectName))
      )
        return
      await Promise.all(images.map((image) => image.decode()))
      await document.fonts.ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (stopped || !paper.isConnected || new URLSearchParams(location.search).get('sourceId') !== sourceId) return
      window.__awPaperReady = {
        end: performance.now(),
        imageCount: images.length,
        sourceId,
        versionLabel: version.versionLabel,
        lines: version.lines.length,
        source:
          'browser observer: semantic paper + QR + native IDB transaction complete/current version + all images decoded + fonts + two frames',
      }
      stop()
    } finally {
      checking = false
    }
  }
  const observer = new MutationObserver(check)
  observer.observe(document, { childList: true, subtree: true, attributes: true })
  document.addEventListener('load', check, true)
  document.addEventListener('error', check, true)
  window.__awStopPaperObserver = stop
  void check()
}
async function action(page, name, trigger, predicate, { type = 'click', durable, definition } = {}) {
  report.definitions[name] ||=
    definition ||
    'Trusted event → named semantic predicate, applicable readonly durable result, visible image decode, two frames'
  const observePaper =
    name === 'PPIC签发领料凭证预览' || name === '合并任务领料凭证预览' || name === '补采PPIC补打签发新版本'
  if (observePaper) {
    report.definitions[name] =
      'Trusted click → browser observer of full semantic paper, QR, native IndexedDB current version transaction complete, all images decoded, fonts and 2 frames. Independent Node assertions still run; their later completion is retained separately.'
    await page.evaluate(installPickupPaperObserver)
  }
  await page.evaluate((type) => {
    window.__awPerfStart = undefined
    document.addEventListener(
      type,
      (event) => {
        if (event.isTrusted) window.__awPerfStart = performance.now()
      },
      { once: true, capture: true },
    )
  }, type)
  try {
    await trigger()
    await ready(page, predicate)
    if (name.includes('凭证预览') && !name.startsWith('GTP')) {
      await expect(page.locator('.print-preview-root')).not.toContainText('打印预览无法生成')
      await expect(page.locator('.print-preview-root img').first()).toBeVisible()
      if (name === '合并任务领料凭证预览') {
        await expect(page.locator('.print-card-title')).toHaveText('面辅料领料单')
        await expect(page.locator('.print-table tbody tr')).toHaveCount(7)
        await expect(page.locator('.print-preview-root img')).toHaveCount(8)
        await expect(page.locator('[data-real-qr] svg')).toHaveCount(1)
      }
    }
    if (durable) await durable()
    const automationDone = await finish(page)
    if (observePaper) await page.waitForFunction(() => window.__awPaperReady)
    const done = observePaper ? await page.evaluate(() => window.__awPaperReady) : automationDone,
      start = await page.evaluate(() => window.__awPerfStart)
    if (start === undefined) throw Error('No trusted start')
    return record(name, {
      ms: done.end - start,
      imageCount: done.imageCount,
      url: page.url(),
      viewport: page.viewportSize(),
      ...(observePaper ? { completionProof: done, automationEndMs: automationDone.end - start } : {}),
    })
  } catch (error) {
    await page.screenshot({ path: path.join(out, `failure-${iteration}-${name}.png`), fullPage: true }).catch(() => {})
    fs.writeFileSync(
      path.join(out, `failure-${iteration}-${name}.json`),
      JSON.stringify(
        {
          body: await page
            .locator('body')
            .innerText()
            .catch(() => ''),
          durable: await db(page).catch(() => null),
        },
        null,
        2,
      ),
    )
    report.failures.push({
      iteration,
      name,
      invalidCollector: !(await page.evaluate(() => window.__awPerfStart !== undefined).catch(() => false)),
      error: String(error),
    })
    save()
    throw error
  }
}
async function nav(page, name, url, selector, method = 'goto') {
  report.definitions[name] =
    `${method === 'reload' ? 'Navigation refresh' : 'Navigation start'} → ${selector}, necessary visible images decoded and 2 frames`
  const observePaper = url.includes('documentType=PICKUP_SLIP')
  if (observePaper) {
    report.definitions[name] +=
      '; intrinsic browser observer includes paper semantics, current version native IDB transaction, all images, fonts, QR and 2 frames; Node assertion completion also retained'
    await page.addInitScript(installPickupPaperObserver, true)
  }
  try {
    if (method === 'reload') await page.reload({ waitUntil: 'commit' })
    else await page.goto(base + url, { waitUntil: 'commit' })
    await ready(page, selector)
    const automationDone = await finish(page)
    if (observePaper) await page.waitForFunction(() => window.__awPaperReady)
    const end = observePaper ? await page.evaluate(() => window.__awPaperReady) : automationDone
    return record(name, {
      ms: end.end,
      imageCount: end.imageCount,
      url: page.url(),
      viewport: page.viewportSize(),
      ...(observePaper ? { completionProof: end, automationEndMs: automationDone.end } : {}),
    })
  } catch (error) {
    report.failures.push({ iteration, name, error: String(error) })
    save()
    throw error
  }
}
async function context(fixture, viewport = { width: 1366, height: 768 }) {
  const c = await browser.newContext({ viewport, timezoneId: 'Asia/Jakarta', acceptDownloads: true }),
    page = await c.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (e) => report.failures.push({ iteration, name: 'uncaught', error: e.message, url: page.url() }))
  page.on('dialog', (d) => d.accept())
  await page.addInitScript(() => {
    globalThis.__name = (value) => value
  })
  if (fixture) {
    await page.route('**/__aw_perf_setup.html', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Isolated test data setup</title>',
      }),
    )
    await page.goto(base + '/__aw_perf_setup.html')
    await page.evaluate(async (fixture) => {
      const revive = (v) => {
        if (!v || typeof v !== 'object') return v
        if (v.__fixtureType === 'Blob') return new Blob([new Uint8Array(v.bytes)], { type: v.type })
        if (Array.isArray(v)) return v.map(revive)
        return Object.fromEntries(Object.entries(v).map(([k, v]) => [k, revive(v)]))
      }
      for (const [key, value] of Object.entries(fixture.localStorage || {})) {
        if (key !== 'higood-tabs') localStorage.setItem(key, value)
      }
      for (const source of fixture.databases) {
        const normalized = Array.isArray(source.stores)
          ? source.stores
          : Object.entries(source.stores).map(([name, rows]) => ({
              name,
              keyPath: 'id',
              rows: rows.map((value) => ({ key: value.id, value })),
            }))
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(source.name, source.version)
          req.onupgradeneeded = () => {
            for (const store of normalized) {
              const s = req.result.createObjectStore(store.name, {
                keyPath: store.keyPath || 'id',
                autoIncrement: store.autoIncrement || false,
              })
              for (const idx of store.indexes || [])
                s.createIndex(idx.name, idx.keyPath, idx.options || { unique: idx.unique, multiEntry: idx.multiEntry })
            }
          }
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = db.transaction(
            normalized.map((s) => s.name),
            'readwrite',
          )
          for (const store of normalized)
            for (const row of store.rows) {
              let value = revive(row.value)
              if (store.name === 'files' && value.bytes) {
                value = { ...value, blob: new Blob([new Uint8Array(value.bytes)], { type: value.type }) }
                delete value.bytes
              }
              tx.objectStore(store.name).put(value)
            }
          tx.oncomplete = resolve
          tx.onabort = () => reject(tx.error)
        })
        db.close()
      }
    }, fixture)
    await page.unroute('**/__aw_perf_setup.html')
  }
  return { c, page }
}
async function db(page) {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((x) => x.name === 'higood-cutting-records-v1'))
      return { records: [], commands: [], revision: 0 }
    const d = await new Promise((res, rej) => {
      const r = indexedDB.open('higood-cutting-records-v1')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
      r.onupgradeneeded = () => {
        r.transaction.abort()
        rej(Error('Readonly assertion cannot initialize DB'))
      }
    })
    const out = await new Promise((res, rej) => {
      const tx = d.transaction(['records', 'meta', 'commands'], 'readonly'),
        out = {}
      for (const n of ['records', 'commands']) {
        const r = tx.objectStore(n).getAll()
        r.onsuccess = () => (out[n] = r.result)
      }
      const r = tx.objectStore('meta').get('revision')
      r.onsuccess = () => (out.revision = r.result?.value || 0)
      tx.oncomplete = () => res(out)
      tx.onabort = () => rej(tx.error)
    })
    d.close()
    return out
  })
}
const rows = (s, k) => s.records.filter((r) => r.collection === `accessory-warehouse:${k}`).map((r) => r.value)
const gtp = '/wls/accessory-warehouses/gtp/preparation',
  root = '[data-accessory-preparation-root]',
  card = `${root} [data-aw-preparation-card]`,
  a = (n) => `[data-accessory-action="${n}"]`,
  t = (n) => `[data-accessory-transfer-action="${n}"]`,
  trRoot = '[data-accessory-transfer-root]'
const query = async (page, order) => {
  await page.locator('[data-accessory-field="keyword"]').fill(order)
  await action(
    page,
    'GTP查询',
    () => page.locator(a('query')).click(),
    () => expect(page.locator(card)).toHaveCount(1),
  )
}
async function close(page, name = 'GTP弹窗关闭') {
  await action(
    page,
    name,
    () => page.getByRole('dialog').last().getByRole('button', { name: '关闭', exact: true }).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
  )
}
async function gtpFlow(page, order = 'PO-AW-202610-F02', exerciseFailure = true) {
  await query(page, order)
  await action(page, 'GTP备注打开', () => page.locator(a('remark')).click(), '[data-aw-remark]')
  await page.locator('[data-aw-remark]').fill('正式性能样本' + iteration)
  await action(
    page,
    'GTP备注保存',
    () => page.locator(a('save-remark')).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
    {
      durable: async () => {
        if (!rows(await db(page), 'preparation').some((r) => r.remark === '正式性能样本' + iteration))
          throw Error('remark not durable')
      },
    },
  )
  await action(page, 'GTP配料打开', () => page.locator(a('prepare')).click(), '[data-aw-qty]')
  await action(
    page,
    'GTP图片打开',
    () => page.getByRole('dialog').locator(a('image')).first().click(),
    () => expect(page.getByRole('dialog')).toHaveCount(2),
  )
  await action(
    page,
    'GTP图片Esc关闭',
    () => page.keyboard.press('Escape'),
    () => expect(page.getByRole('dialog')).toHaveCount(1),
    { type: 'keydown' },
  )
  const map = {
    拉链: [100, 'GTP-A-01'],
    纽扣: [200, 'GTP-A-02'],
    价格吊牌: [100, 'GTP-A-03'],
    品牌吊牌: [100, 'GTP-B-01'],
    吊粒: [100, 'GTP-B-02'],
    车缝线: [1, 'GTP-B-03'],
  }
  const dlg = page.getByRole('dialog', { name: '登记配料', exact: true })
  for (const [name, [qty, loc]] of Object.entries(map)) {
    await dlg.getByLabel(name + '本次配料', { exact: true }).fill(String(qty))
    await dlg.getByLabel(name + '来源库位', { exact: true }).selectOption({ label: loc })
  }
  if (exerciseFailure) {
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put
      window.__awOrigPut = put
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'records') throw new DOMException('perf-abort', 'QuotaExceededError')
        return put.apply(this, args)
      }
    })
    await action(
      page,
      'GTP事务失败保留输入',
      () => dlg.getByRole('button', { name: '保存本次配料', exact: true }).click(),
      () => expect(page.locator('[data-aw-modal-error]')).toContainText('perf-abort'),
    )
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = window.__awOrigPut
    })
  }
  await action(
    page,
    exerciseFailure
      ? 'GTP配齐保存自动建调拨'
      : `GTP首次配齐保存自动建调拨-${order.endsWith('F03') ? '目的待定' : '确认目的'}`,
    () => dlg.getByRole('button', { name: '保存本次配料', exact: true }).click(),
    () => expect(dlg).toHaveCount(0),
    {
      durable: async () => {
        const s = await db(page)
        if (
          rows(s, 'transfer').filter((x) => x.productionOrderId === order).length !== 1 ||
          !rows(s, 'preparation').some((x) => x.productionOrderId === order && x.status === '已配齐')
        )
          throw Error('full result not durable')
      },
    },
  )
  await action(
    page,
    'GTP记录打开',
    () => page.locator(a('history')).click(),
    () => expect(page.getByRole('dialog')).toContainText('配齐'),
  )
  await close(page)
  await action(page, 'GTP凭证预览', () => page.locator(a('print')).click(), '[data-aw-print]')
  await page.evaluate(() => {
    window.__awPrintDone = false
    window.addEventListener(
      'afterprint',
      () => {
        window.__awPrintDone = true
      },
      { once: true },
    )
  })
  await action(
    page,
    'GTP原生打印就绪',
    () => page.locator(a('print-now')).click(),
    () => page.waitForFunction(() => window.__awPrintDone),
  )
  await close(page)
  const down = page.waitForEvent('download')
  await action(
    page,
    'GTP导出筛选',
    () => page.locator(a('export')).click(),
    async () => {
      const d = await down
      if (!(await d.path())) throw Error('download unavailable')
    },
  )
  return rows(await db(page), 'transfer').find((x) => x.productionOrderId === order && x.kind === 'GTP_TO_SITE')
}
async function transferPage(page, key, view, order) {
  await nav(page, `调拨${view}首次导航`, `/wls/accessory-warehouses/${key}/${view}`, trRoot)
  await page.locator('[data-accessory-transfer-field="keyword"]').fill(order)
  const snapshot = await db(page),
    code = key === 'gtp' ? 'WH-FITTING-001' : key === 'hilon' ? 'HILON-2' : 'WH-FITTING-MAHAMERU',
    matching = rows(snapshot, 'transfer').filter((t) => t.productionOrderId === order),
    count =
      view === 'receipts'
        ? rows(snapshot, 'receipt').filter(
            (r) => r.warehouseCode === code && matching.some((t) => t.id === r.transferId),
          ).length
        : matching.filter((t) => t.fromWarehouse === code).length
  await action(
    page,
    `调拨${view}查询`,
    () => page.locator(t('query')).click(),
    () => expect(page.locator(`${trRoot} tbody tr`)).toHaveCount(count),
  )
}
async function dispatch(page, key, order, transfer) {
  await transferPage(page, key, 'transfers', order)
  await action(
    page,
    '调拨出库核对打开',
    () => page.locator(`${t('dispatch')}[data-id="${transfer.id}"]`).click(),
    () => expect(page.getByRole('dialog', { name: '整单确认出库', exact: true })).toBeVisible(),
  )
  await action(
    page,
    transfer.kind === 'SITE_REASSIGN' ? '仓间整单出库保存' : 'GTP整单出库保存',
    () => page.getByRole('dialog').locator(t('save')).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
    {
      durable: async () => {
        if (!rows(await db(page), 'transfer').some((x) => x.id === transfer.id && x.status === '已出库待收货'))
          throw Error('dispatch not durable')
      },
    },
  )
}
async function receive(page, key, order, transfer, name = '两仓收货上架保存', failLate = false) {
  await transferPage(page, key, 'receipts', order)
  const receipt = rows(await db(page), 'receipt').find((x) => x.transferId === transfer.id && x.status === '待收货')
  await action(
    page,
    '两仓收货上架打开',
    () => page.locator(`${t('receive')}[data-id="${receipt.id}"]`).click(),
    '[data-aw-transfer-qty]',
  )
  const dlg = page.getByRole('dialog', { name: '确认收货并上架', exact: true })
  for (const line of transfer.lines) {
    await dlg.locator(`[data-aw-transfer-qty="${line.id}"]`).fill(String(line.qty))
    await dlg
      .locator(`[data-aw-transfer-location="${line.id}"]`)
      .selectOption({ label: key === 'hilon' ? 'HILON-A-01' : 'MAHAMERU-A-01' })
  }
  await dlg.locator('[data-aw-transfer-qty]').first().fill('0')
  await action(
    page,
    '两仓收货差量阻断',
    () => dlg.locator(t('save')).click(),
    () => expect(page.locator('[data-aw-transfer-error]')).toContainText(/整单|大于零/),
  )
  await dlg.locator('[data-aw-transfer-qty]').first().fill(String(transfer.lines[0].qty))
  if (failLate) {
    const before = await db(page)
    await page.evaluate(() => {
      window.__awOrigPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'meta') throw new DOMException('perf-receive-abort', 'QuotaExceededError')
        return window.__awOrigPut.apply(this, args)
      }
    })
    await action(
      page,
      '六物料收货晚事务失败',
      () => dlg.locator(t('save')).click(),
      () => expect(page.locator('[data-aw-transfer-error]')).toContainText('perf-receive-abort'),
      {
        durable: async () => {
          if (JSON.stringify(await db(page)) !== JSON.stringify(before)) throw Error('partial receive on abort')
          await expect(dlg.locator('[data-aw-transfer-qty]').first()).toHaveValue(String(transfer.lines[0].qty))
        },
      },
    )
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = window.__awOrigPut
    })
  }
  await action(
    page,
    name,
    () => dlg.locator(t('save')).click(),
    () => expect(dlg).toHaveCount(0),
    {
      durable: async () => {
        if (!rows(await db(page), 'transfer').some((x) => x.id === transfer.id && x.status === '已收货'))
          throw Error('receipt not durable')
      },
    },
  )
}
async function reassign(page, order, factory, phase, direct = false) {
  await nav(page, '统一工作台进入', '/fcs/dispatch/workbench?type=NON_SEWING', '[data-unified-field="keyword"]')
  await page.locator('[data-unified-field="keyword"]').fill(order)
  const button = page.locator(
    `[data-unified-action="${direct ? 'open-direct' : 'open-reassign'}"][data-task-id="TASKGEN-AW-202610-${order.slice(-3)}-001__ORDER"]`,
  )
  await action(page, '改厂弹窗打开', () => button.click(), '[data-unified-field="factoryId"]')
  await page.locator('[data-unified-field="factoryId"]').selectOption(factory)
  await page.locator('[data-unified-field="price"]').fill('1000')
  if (!direct) await page.locator('[data-unified-field="reassignReason"]').fill('正式性能验证')
  await action(
    page,
    '改厂最终核对打开',
    () => page.locator('[data-unified-action="confirm-dispatch"]').click(),
    () => expect(page.getByRole('button', { name: '确认提交并冻结价格', exact: true })).toBeVisible(),
  )
  const before = await db(page)
  await action(
    page,
    `改厂保存-${phase}`,
    () => page.getByRole('button', { name: '确认提交并冻结价格', exact: true }).click(),
    () => expect(page.locator('[data-unified-action="confirm-dispatch"]')).toHaveCount(0),
    {
      durable: async () => {
        const s = await db(page)
        if (
          s.revision !== before.revision + 1 ||
          !rows(s, 'preparation').some((x) => x.productionOrderId === order && x.cuttingFactoryId === factory)
        )
          throw Error('factory transaction not durable')
      },
    },
  )
}
async function sewingFlow(exerciseFailure = true) {
  const { c, page } = await context(fixtures.sew, { width: 1024, height: 768 })
  try {
    await nav(page, '车缝领料冷直达', '/wls/accessory-warehouses/hilon/pickups', '[data-accessory-pickup-root]')
    await nav(page, '车缝领料刷新', '', '[data-accessory-pickup-root]', 'reload')
    await action(
      page,
      '按任务建领料和后道清单',
      () => page.locator('[data-accessory-pickup-action="create"]').click(),
      () => expect(page.getByRole('status')).toContainText('已按有效车缝任务建立'),
      {
        durable: async () => {
          if (rows(await db(page), 'pickup').length !== 2) throw Error('pickups not durable')
        },
      },
    )
    await page.locator('[data-accessory-pickup-field="keyword"]').fill('测试三方车缝0')
    await action(
      page,
      '车缝领料查询',
      () => page.locator('[data-accessory-pickup-action="query"]').click(),
      () => expect(page.locator('[data-accessory-pickup-root] tbody tr')).toHaveCount(1),
    )
    await action(
      page,
      '车缝领料明细打开',
      () => page.locator('[data-accessory-pickup-action="detail"]').click(),
      () => expect(page.getByRole('dialog')).toBeVisible(),
    )
    await close(page, '车缝领料弹窗关闭')
    await nav(page, 'PPIC车缝任务冷直达', '/fcs/sewing-outsourcing/tasks', '[data-ppic-task-page]')
    await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A')
    await action(
      page,
      'PPIC车缝任务查询',
      () => page.locator('[data-ppic-task-action="query"]').click(),
      () => expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1),
    )
    await action(
      page,
      'PPIC签发领料凭证预览',
      () => page.locator('[data-ppic-task-action="print-pickup"]').click(),
      '.print-preview-root',
      {
        durable: async () => {
          if (!rows(await db(page), 'sewing-slip').some((s) => s.status === 'CURRENT' && s.versionNo === 1))
            throw Error('version not durable')
        },
      },
    )
    let s = await db(page),
      slip = rows(s, 'sewing-slip').find((x) => x.status === 'CURRENT'),
      pickup = rows(s, 'pickup').find((x) => x.assignmentId === 'AW-TEST-ASG-0')
    await nav(
      page,
      '车缝实交凭证直达',
      `/wls/accessory-warehouses/hilon/pickups?pickupId=${encodeURIComponent(pickup.id)}&versionId=${encodeURIComponent(slip.versionId)}`,
      '[data-aw-pickup-qty]',
    )
    await page.getByLabel('价格吊牌本次实交', { exact: true }).fill('5')
    if (exerciseFailure) {
      await page.evaluate(() => {
        const orig = IDBObjectStore.prototype.put
        window.__awOrigPut = orig
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'records') throw new DOMException('perf-sew-abort', 'QuotaExceededError')
          return orig.apply(this, args)
        }
      })
      await action(
        page,
        '车缝实交失败保留输入',
        () => page.getByRole('button', { name: '确认本次实交', exact: true }).click(),
        () => expect(page.locator('[data-aw-pickup-error]')).toContainText('perf-sew-abort'),
      )
      await page.evaluate(() => {
        IDBObjectStore.prototype.put = window.__awOrigPut
      })
    }
    await action(
      page,
      exerciseFailure ? '车缝分次实交保存' : '车缝首次实交保存',
      () => page.getByRole('button', { name: '确认本次实交', exact: true }).click(),
      () => expect(page.getByRole('dialog')).toHaveCount(0),
      {
        durable: async () => {
          const s = await db(page)
          if (
            rows(s, 'sewing-handover').length !== 1 ||
            !rows(s, 'pickup').some((p) => p.lines.some((l) => l.handedQty === 5))
          )
            throw Error('handover not durable')
        },
      },
    )
    await nav(
      page,
      'FCS实交跟进冷直达',
      '/fcs/sewing-outsourcing/material-handover?assignmentId=AW-TEST-ASG-0',
      '[data-sewing-material-page]',
    )
    await nav(page, 'FCS实交跟进刷新', '', '[data-sewing-material-page]', 'reload')
    await nav(page, '后道调拨源仓进入', '/wls/accessory-warehouses/hilon/transfers', trRoot)
    await page.locator('[data-accessory-transfer-field="keyword"]').fill('PO-AW-SEW-CONTRACT')
    await page.locator(t('query')).click()
    const post = rows(await db(page), 'transfer').find((x) => x.kind === 'SITE_TO_POST')
    await action(
      page,
      '后道调拨出库核对',
      () => page.locator(`${t('dispatch')}[data-id="${post.id}"]`).click(),
      () => expect(page.getByRole('dialog')).toBeVisible(),
    )
    await action(
      page,
      '后道整单出库保存',
      () => page.getByRole('dialog').locator(t('save')).click(),
      () => expect(page.getByRole('dialog')).toHaveCount(0),
      {
        durable: async () => {
          if (!rows(await db(page), 'transfer').some((x) => x.id === post.id && x.status === '已出库待收货'))
            throw Error('post not durable')
        },
      },
    )
    await page.screenshot({ path: path.join(out, `sewing-${iteration}.png`), fullPage: true })
  } finally {
    await c.close()
  }
}
async function postFlow(pda = false, exerciseFailure = true) {
  const { c, page } = await context(fixtures.post, pda ? { width: 390, height: 844 } : { width: 1024, height: 768 })
  try {
    if (pda) {
      await nav(
        page,
        '后道PDA冷直达',
        '/fcs/pda/handover?tab=pickup&materialOrderNo=POST-UI-1',
        '[data-managed-accessory-post-root]',
      )
    } else {
      await nav(page, '后道Web冷直达', '/fcs/craft/post-finishing/material-transfers', '[data-post-material-workspace]')
      await page.locator('[data-post-material-query] [name="keyword"]').fill('PO-AW-202610-F01')
      await action(
        page,
        '后道Web查询',
        () => page.locator('[data-post-finishing-material-transfers-action="query"]').click(),
        () => expect(page.locator('[data-post-material-workspace] tbody tr')).toHaveCount(1),
      )
      await action(
        page,
        '后道Web核对打开',
        () => page.locator('[data-post-finishing-material-transfers-action="detail"]').click(),
        '[data-post-material-qty]',
      )
    }
    const qty = pda ? '[data-pda-post-qty]' : '[data-post-material-qty]',
      loc = pda ? '[data-pda-post-location]' : '[data-post-material-location]',
      submit = pda
        ? '[data-pda-handover-action="confirm-material-inbound"]'
        : '[data-post-finishing-material-transfers-action="receive"]',
      err = pda ? '[data-pda-post-error]' : '[data-post-material-error]'
    for (let i = 0; i < 2; i++) {
      await page
        .locator(qty)
        .nth(i)
        .fill(String(i ? 20 : 10))
      await page.locator(loc).nth(i).selectOption({ label: 'PF-MAT-A01-01' })
    }
    if (exerciseFailure) {
      await page.locator(qty).first().fill('9')
      await action(
        page,
        `后道${pda ? 'PDA' : 'Web'}差量阻断`,
        () => page.locator(submit).click(),
        () => expect(page.locator(err)).toContainText('整单'),
      )
      await page.locator(qty).first().fill('10')
      await page.evaluate(() => {
        const orig = IDBObjectStore.prototype.put
        window.__awOrigPut = orig
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'records') throw new DOMException('perf-post-abort', 'QuotaExceededError')
          return orig.apply(this, args)
        }
      })
      await action(
        page,
        `后道${pda ? 'PDA' : 'Web'}事务失败保留输入`,
        () => page.locator(submit).click(),
        () => expect(page.locator(err)).toContainText('perf-post-abort'),
      )
      await page.evaluate(() => {
        IDBObjectStore.prototype.put = window.__awOrigPut
      })
    }
    await action(
      page,
      exerciseFailure ? `后道${pda ? 'PDA' : 'Web'}整单收货上架保存` : `后道${pda ? 'PDA' : 'Web'}首次整单收货上架保存`,
      () => page.locator(submit).click(),
      pda
        ? () => expect(page.locator('[data-managed-accessory-post-root]')).toContainText('辅料已收货上架')
        : () => expect(page.getByRole('dialog')).toHaveCount(0),
      {
        durable: async () => {
          if (!rows(await db(page), 'transfer').some((x) => x.id === 'POST-UI-1' && x.status === '已收货'))
            throw Error('post receipt not durable')
        },
      },
    )
    await page.screenshot({ path: path.join(out, `post-${pda ? 'pda' : 'web'}-${iteration}.png`), fullPage: true })
    await nav(page, '后道库存冷直达', '/fcs/craft/post-finishing/wait-process-warehouse?tab=materials', 'main table')
  } finally {
    await c.close()
  }
}
async function basicFlow() {
  const { c, page } = await context()
  try {
    await nav(page, '库区库位初访', '/wls/basic/zone-location', '[data-wls-basic-zone-location-root]')
    await page.locator('[data-wls-basic-zone-location-field="keyword"]').fill('HILON')
    await action(
      page,
      '库区库位查询',
      () => page.locator('[data-wls-basic-zone-location-action="apply-filter"]').click(),
      '[data-wls-basic-zone-location-root]',
    )
    await action(
      page,
      '基础库位明细打开',
      () => page.locator('[data-wls-basic-zone-location-action="view-locations"]').first().click(),
      () => expect(page.getByRole('dialog')).toBeVisible(),
    )
    await close(page, '基础库位明细关闭')
  } finally {
    await c.close()
  }
}

async function utilityFlow() {
  const { c, page } = await context()
  try {
    await nav(page, 'GTP数据列表初访', gtp, root)
    await action(
      page,
      'GTP翻页下一页',
      () => page.locator(a('next-page')).click(),
      () => expect(page.locator(`${card}[data-production-order-no="PO-AW-202610-F01"]`)).toHaveCount(0),
    )
    await action(
      page,
      'GTP翻页上一页',
      () => page.locator(a('prev-page')).click(),
      () => expect(page.locator(a('prev-page'))).toBeDisabled(),
    )
    await action(
      page,
      'GTP列设置打开',
      () => page.locator(a('open-column-settings')).click(),
      () => expect(page.locator(a('restore-column-settings'))).toBeVisible(),
    )
    await action(
      page,
      'GTP列显隐',
      () => page.locator(`[data-accessory-column-key="source"] ${a('toggle-column-visibility')}`).uncheck(),
      () => expect(page.locator(card).first().getByRole('columnheader', { name: '来源', exact: true })).toHaveCount(0),
      { type: 'change' },
    )
    await action(
      page,
      'GTP列冻结',
      () => page.locator(`[data-accessory-column-key="required"] ${a('toggle-column-freeze')}`).check(),
      () => expect(page.locator(`[data-accessory-column-key="required"] ${a('toggle-column-freeze')}`)).toBeChecked(),
      { type: 'change' },
    )
    await action(
      page,
      'GTP列设置恢复',
      () => page.locator(a('restore-column-settings')).click(),
      () => expect(page.locator(card).first().getByRole('columnheader', { name: '来源', exact: true })).toHaveCount(1),
    )
    await action(
      page,
      'GTP列设置关闭',
      () =>
        page
          .locator('button' + a('close-column-settings'))
          .last()
          .click(),
      () => expect(page.locator(a('restore-column-settings'))).toHaveCount(0),
    )
    await query(page, 'PO-AW-202610-F01')
    await page.locator(a('prepare')).click()
    await page.getByLabel('拉链本次配料', { exact: true }).fill('1')
    await page.getByLabel('拉链来源库位', { exact: true }).selectOption({ label: 'GTP-A-01' })
    await action(
      page,
      'GTP部分配料保存',
      () => page.locator(a('save-preparation')).click(),
      async () => {
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.locator(a('complete'))).toBeDisabled()
      },
      {
        durable: async () => {
          const x = await db(page)
          if (rows(x, 'transfer').length || !rows(x, 'stock').some((s) => s.reservedQty === 1))
            throw Error('partial state wrong')
        },
      },
    )
    await action(
      page,
      'GTP重置筛选',
      () => page.locator(a('reset')).click(),
      () => expect(page.locator(card)).toHaveCount(10),
    )
    const menu = page.locator('aside [data-menu-group-header="辅料中央仓（GTP）管理"]')
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click()
    await action(
      page,
      '仓储菜单组收起',
      () => menu.click(),
      () => expect(menu).toHaveAttribute('aria-expanded', 'false'),
    )
    await action(
      page,
      '仓储菜单组展开',
      () => menu.click(),
      () => expect(menu).toHaveAttribute('aria-expanded', 'true'),
    )
    await action(
      page,
      '仓储站内选择GTP库存',
      () => page.locator('[data-tab-key="wls-accessory-gtp-stock"]').click(),
      () => expect(page.locator(trRoot)).toContainText('辅料库存'),
    )
    await nav(page, '辅料库存刷新', '', trRoot, 'reload')
    await page.locator('[data-accessory-transfer-field="keyword"]').fill('AW-DEMO')
    await action(
      page,
      '辅料库存查询',
      () => page.locator(t('query')).click(),
      () => expect(page.locator(`${trRoot} tbody tr`)).toHaveCount(7),
    )
    await action(
      page,
      '辅料库存重置',
      () => page.locator(t('reset')).click(),
      () => expect(page.locator(`${trRoot} tbody tr`)).toHaveCount(10),
    )
    await action(
      page,
      '辅料库存在途切换',
      async () => {
        const field = page.locator('[data-accessory-transfer-field="stockMode"]')
        await field.click()
        await field.selectOption('transit')
        await page.keyboard.press('Escape')
      },
      () => expect(page.locator(`${trRoot} tbody`)).toContainText('暂无'),
      {
        type: 'click',
        definition:
          'Trusted native-select pointer click → Playwright UI option choice without user wait, application change handler, actual empty in-transit result and frames',
      },
    )
    await action(
      page,
      '仓储侧栏折叠',
      () => page.locator('aside [data-action="toggle-sidebar-collapsed"]').click(),
      () => expect(page.locator('aside [data-menu-group-header]')).toHaveCount(0),
    )
    await action(
      page,
      '仓储侧栏展开',
      () => page.locator('aside [data-action="toggle-sidebar-collapsed"]').click(),
      () => expect(page.locator('aside [data-menu-group-header]')).not.toHaveCount(0),
    )
    await nav(
      page,
      '固定库位初访',
      '/wls/accessory-warehouses/mahameru/locations',
      '[data-accessory-locations="mahameru"]',
    )
  } finally {
    await c.close()
  }
}
async function pendingFlow() {
  const { c, page } = await context()
  try {
    await nav(page, '待定GTP输入进入', gtp, root)
    await gtpFlow(page, 'PO-AW-202610-F03')
    await reassign(page, 'PO-AW-202610-F03', 'SEA-CUTTING-001', '待定后分配', true)
  } finally {
    await c.close()
  }
}
async function loadFlow() {
  const definitions = [
    ['PPIC任务', '/fcs/sewing-outsourcing/tasks', '[data-ppic-task-page]', fixtures.sew],
    ['辅料库存', '/wls/accessory-warehouses/gtp/stock', trRoot],
    ['两仓待收', '/wls/accessory-warehouses/hilon/receipts', trRoot, fixtures.sew],
    ['仓库固定库位', '/wls/accessory-warehouses/mahameru/locations', '[data-accessory-locations="mahameru"]'],
    ['FCS只读配料', '/fcs/material-prep/sewing', '[data-fcs-accessory-readonly]'],
  ]
  for (const [name, url, selector, fixture] of definitions) {
    const { c, page } = await context(fixture)
    try {
      await nav(page, `${name}新上下文首次加载`, url, selector)
      await nav(page, `${name}刷新`, '', selector, 'reload')
      if (url.startsWith('/wls/')) {
        const target = page.locator(`aside [data-tab-href="${url}"]`)
        if (await target.count()) {
          await page.goto(base + gtp)
          await page.locator(root).waitFor()
          const group = target.locator('xpath=ancestor::*[@data-menu-group]')
          await action(page, `${name}站内切换`, () => target.click(), selector)
        }
      }
    } finally {
      await c.close()
    }
  }
}
async function mixedFlow() {
  const fixture = structuredClone(fixtures.mixed)
  fixture.localStorage = {
    ...fixture.localStorage,
    ...Object.fromEntries(Object.entries(fixtures.post.localStorage).filter(([key]) => /pda/.test(key))),
  }
  const { c, page } = await context(fixture, { width: 390, height: 844 })
  try {
    await nav(page, '含裁剪合并任务领料首次', '/wls/accessory-warehouses/hilon/pickups', '[data-accessory-pickup-root]')
    await action(
      page,
      '合并任务建立领料',
      () => page.locator('[data-accessory-pickup-action="create"]').click(),
      () => expect(page.getByRole('status')).toContainText('已按有效车缝任务建立'),
    )
    await page.goto(base + '/fcs/sewing-outsourcing/tasks')
    await page.locator('[data-ppic-task-page]').waitFor()
    await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A')
    await page.locator('[data-ppic-task-action="query"]').click()
    await expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1)
    await action(
      page,
      '合并任务领料凭证预览',
      () => page.locator('[data-ppic-task-action="print-pickup"]').click(),
      '.print-preview-root',
    )
    const slip = rows(await db(page), 'sewing-slip').find((x) => x.status === 'CURRENT')
    await nav(
      page,
      '合并凭证PDA扫码直达',
      `/fcs/pda/handover?tab=handout&sewingPickupVersionId=${encodeURIComponent(slip.versionId)}`,
      '[data-sewing-pickup-scan-page]',
    )
    await page.locator('[data-sewing-pickup-line-id]').fill('10')
    await action(
      page,
      '合并凭证原面料实交保存',
      () => page.locator('[data-pda-handover-action="confirm-sewing-pickup"]').click(),
      () => expect(page.locator('[data-sewing-pickup-scan-page]')).toContainText('此前已领 10 米'),
      {
        durable: async () => {
          if (!rows(await db(page), 'sewing-result').length) throw Error('fabric result missing')
        },
      },
    )
  } finally {
    await c.close()
  }
}

async function recoveryFlow() {
  const { c, page } = await context(fixtures.sew)
  try {
    const before = await db(page)
    await page.addInitScript(() => {
      window.__awOrigOpen = indexedDB.open
      indexedDB.open = function (name, ...args) {
        if (name === 'higood-cutting-records-v1') throw new DOMException('perf-read-denied', 'UnknownError')
        return window.__awOrigOpen.call(this, name, ...args)
      }
    })
    await nav(page, '辅料读取故障页面直达', '/wls/accessory-warehouses/gtp/stock', '[data-accessory-read-error]')
    await page.evaluate(() => {
      indexedDB.open = window.__awOrigOpen
    })
    await action(
      page,
      '读取故障重新读取恢复',
      () => page.locator('[data-accessory-read-error] [data-accessory-action="reload"]').click(),
      trRoot,
      {
        durable: async () => {
          if (JSON.stringify(await db(page)) !== JSON.stringify(before)) throw Error('read recovery mutated records')
        },
      },
    )
  } finally {
    await c.close()
  }
}

const supplementalExpected = {
  'first-success': [
    'GTP首次配齐保存自动建调拨-确认目的',
    'GTP首次配齐保存自动建调拨-目的待定',
    '六物料在途投影切换',
    '六物料收货晚事务失败',
    '六物料收货晚失败重试保存',
    '车缝首次实交保存',
    '后道Web首次整单收货上架保存',
    '后道PDA首次整单收货上架保存',
  ],
  'read-recovery': ['辅料读取故障页面直达', '读取故障重新读取恢复'],
  mixed: [
    '含裁剪合并任务领料首次',
    '合并任务建立领料',
    '合并任务领料凭证预览',
    '合并凭证PDA扫码直达',
    '合并凭证原面料实交保存',
  ],
}
async function main() {
  const count = Number(process.env.AW_PERF_ITERATIONS || 5),
    groups = (process.env.AW_PERF_GROUPS || 'gtp,sew,post-web,post-pda').split(',')
  const supportedGroups = new Set([
    'first-success', 'gtp', 'sew', 'post-web', 'post-pda', 'basic', 'utility',
    'pending', 'read-recovery', 'loads', 'mixed', 'extras',
  ])
  for (const group of groups)
    if (!supportedGroups.has(group)) throw Error(`Unknown or retired UI performance group: ${group}`)
  report.selectedGroups = groups
  report.expectedSupplemental = groups.flatMap((group) => supplementalExpected[group] || [])
  for (iteration = 1; iteration <= count; iteration++) {
    browser = await chromium.launch({ headless: true })
    report.browser = browser.version()
    try {
      if (groups.includes('first-success')) {
        const initial = await context()
        try {
          await nav(initial.page, 'GTP首次成功链路加载', gtp, root)
          const transfer = await gtpFlow(initial.page, 'PO-AW-202610-F02', false)
          await dispatch(initial.page, 'gtp', 'PO-AW-202610-F02', transfer)
          await nav(initial.page, '实际在途库存进入', '/wls/accessory-warehouses/gtp/stock', trRoot)
          await action(
            initial.page,
            '六物料在途投影切换',
            async () => {
              await initial.page.locator('[data-accessory-transfer-field="stockMode"]').click()
              await initial.page.locator('[data-accessory-transfer-field="stockMode"]').selectOption('transit')
              await initial.page.keyboard.press('Escape')
            },
            () => expect(initial.page.locator(`${trRoot} tbody tr`)).toHaveCount(6),
            {
              definition:
                'Trusted select click → native selection change handler → six actual dispatched material rows, images and 2 frames',
            },
          )
          await receive(initial.page, 'mahameru', 'PO-AW-202610-F02', transfer, '六物料收货晚失败重试保存', true)
          await nav(initial.page, '目的待定首次成功链路加载', gtp, root)
          await gtpFlow(initial.page, 'PO-AW-202610-F03', false)
        } finally {
          await initial.c.close()
        }
        await sewingFlow(false)
        await postFlow(false, false)
        await postFlow(true, false)
      }
      if (groups.includes('gtp')) {
        const { c, page } = await context()
        try {
          await nav(page, 'GTP浏览器冷启动', gtp, root)
          await nav(page, 'GTP整页刷新', '', root, 'reload')
          const transfer = await gtpFlow(page)
          await reassign(page, 'PO-AW-202610-F02', 'SEA-CUTTING-001', '未出GTP')
          await dispatch(page, 'gtp', 'PO-AW-202610-F02', transfer)
          await reassign(page, 'PO-AW-202610-F02', 'SEA-CUTTING-002', '在途安排')
          await receive(page, 'hilon', 'PO-AW-202610-F02', transfer, '原仓收货同时建后续调拨')
          let onward = rows(await db(page), 'transfer').find((x) => x.kind === 'SITE_REASSIGN')
          await dispatch(page, 'hilon', 'PO-AW-202610-F02', onward)
          await receive(page, 'mahameru', 'PO-AW-202610-F02', onward)
          await reassign(page, 'PO-AW-202610-F02', 'SEA-CUTTING-001', '已入库')
          await page.screenshot({ path: path.join(out, `gtp-chain-${iteration}.png`), fullPage: true })
        } finally {
          await c.close()
        }
      }
      if (groups.includes('sew')) await sewingFlow()
      if (groups.includes('post-web')) await postFlow(false)
      if (groups.includes('post-pda')) await postFlow(true)
      if (groups.includes('basic')) await basicFlow()
      if (groups.includes('utility')) await utilityFlow()
      if (groups.includes('pending')) await pendingFlow()
      if (groups.includes('read-recovery')) await recoveryFlow()
      if (groups.includes('loads')) await loadFlow()
      if (groups.includes('mixed')) await mixedFlow()
      if (groups.includes('extras')) {
        const extrasGroups = process.env.AW_PERF_EXTRAS_GROUPS?.split(',')
        const extrasNames = process.env.AW_PERF_EXTRAS_NAMES?.split(',')
        report.expectedExtras = ACCESSORY_PERFORMANCE_EXTRA_FAMILIES.filter(
          (row) =>
            (!extrasGroups || extrasGroups.includes(row.group)) && (!extrasNames || extrasNames.includes(row.name)),
        )
        await runAccessoryPerformanceExtras({
          action,
          nav,
          context,
          fixtures,
          db,
          rows,
          expect,
          base,
          extrasGroups,
          extrasNames,
        })
      }
    } finally {
      await browser.close()
    }
  }
  report.indexSha256After = sha('dist/index.html')
  report.runtimeAssetsAfter = assets()
  report.machine.loadAtEnd = os.loadavg()
  report.groups = Object.fromEntries(
    [...new Set(report.measurements.map((x) => x.name))].map((name) => {
      const list = report.measurements.filter((x) => x.name === name)
      return [
        name,
        {
          count: list.length,
          maxMs: Math.max(...list.map((x) => x.ms)),
          pass: list.length >= 5 && list.every((x) => x.pass),
        },
      ]
    }),
  )
  report.valid =
    report.indexSha256After === indexSha &&
    JSON.stringify(report.runtimeAssetsAfter) === JSON.stringify(report.runtimeAssets) &&
    Object.values(report.groups).every((x) => x.pass) &&
    !report.failures.length &&
    (report.expectedExtras || []).every(({ name }) => report.groups[name]?.pass) &&
    (report.expectedSupplemental || []).every((name) => report.groups[name]?.pass)
  save()
  console.log(
    JSON.stringify(
      {
        output: out,
        valid: report.valid,
        samples: report.measurements.length,
        failures: report.failures,
        groups: report.groups,
      },
      null,
      2,
    ),
  )
  if (!report.valid) process.exitCode = 1
}
await main().catch((error) => {
  report.failures.push({ iteration, error: String(error) })
  save()
  console.error(error)
  process.exitCode = 1
})
