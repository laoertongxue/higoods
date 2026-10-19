// Scoped fixed-build acceptance for the 2026-10-20 GTP/complete-function correction.
// Historical full-flow performance stays attached to its original version.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'
const base = process.env.AW_PERF_URL || 'http://127.0.0.1:43272'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Isolated local preview only')
const out = path.resolve(process.env.AW_PERF_OUTPUT || 'output/verification/gtp-online-alignment/performance')
fs.mkdirSync(out, { recursive: true })
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
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
      .map((x) => [x, hash(x)]),
  )
const report = {
  at: new Date().toISOString(),
  base,
  cwd: process.cwd(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  diffSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', 'HEAD']))
    .digest('hex'),
  scriptSha256: hash(new URL(import.meta.url)),
  runtimeAssets: assets(),
  node: process.version,
  machine: { cpu: os.cpus()[0]?.model, load: os.loadavg() },
  thresholdMs: 1000,
  scope: process.env.AW_PERF_LIST_REVALIDATION === 'true'
    ? 'final list-rendering delta: GTP empty results and material-decision list extraction'
    : process.env.AW_PERF_ONLY_LEGACY === 'true' ? 'legacy business compatibility only' : 'GTP and changed full-function entries',
  samples: [],
  failures: [],
  definitions: {},
  conditions:
    'Fixed dist; Chromium headless; Asia/Jakarta; no throttling/prewarm. Five fresh browser processes. Cold, refresh and SPA separate. Action starts at actual trusted UI event. Finish after semantic predicate, durable readback when applicable, visible images/fonts and two animation frames. Fixture setup outside timing. No actual production business or user data touched.',
}
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'collector.mjs'))
const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
let browser,
  iteration = 0
async function finish(page) {
  return page.evaluate(async () => {
    const print = document.querySelector('[data-aw-print]')
    const imgs = print
      ? [...print.querySelectorAll('img')]
      : [...document.images].filter((i) => {
          const r = i.getBoundingClientRect()
          return (
            r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0
          )
        })
    await Promise.all(imgs.map((i) => i.decode()))
    await document.fonts.ready
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { end: performance.now(), images: imgs.length }
  })
}
function record(name, ms, extra = {}) {
  const sample = { iteration, name, ms, ...extra, pass: Number.isFinite(ms) && ms <= 1000 }
  report.samples.push(sample)
  if (!sample.pass) report.failures.push(sample)
  save()
}
async function nav(page, name, url, selector, reload = false) {
  report.definitions[name] = 'navigation start → target semantic content, visible images/fonts ready and two frames'
  if (reload) await page.reload({ waitUntil: 'commit' })
  else await page.goto(base + url, { waitUntil: 'commit' })
  await expect(page.locator(selector).first()).toBeVisible()
  const done = await finish(page)
  record(name, done.end, { ...done, url: page.url(), viewport: page.viewportSize() })
}
async function action(page, name, trigger, predicate, durable, type = 'click') {
  report.definitions[name] =
    'trusted ' + type + ' → semantic assertion, applicable durable readback, visible images/fonts and two frames'
  await page.evaluate((type) => {
    window.__gtpStart = undefined
    document.addEventListener(
      type,
      (e) => {
        if (e.isTrusted) window.__gtpStart = performance.now()
      },
      { once: true, capture: true },
    )
  }, type)
  await trigger()
  await predicate()
  if (durable) await durable()
  const automationDone = await finish(page)
  const observed = name === '后道普通实收兼容原7条并新增10条' ? await page.evaluate(() => window.__gtpPostReady) : null
  if (name === '后道普通实收兼容原7条并新增10条' && !observed?.durable) throw Error('Post browser completion observer missing')
  const done = observed || automationDone,
    start = await page.evaluate(() => window.__gtpStart)
  if (start === undefined) throw Error('Missing trusted event: ' + name)
  record(name, done.end - start, { ...done, automationEndMs: automationDone.end - start, url: page.url(), viewport: page.viewportSize() })
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

const rows = (snapshot, kind) =>
  snapshot.records.filter((r) => r.collection === 'accessory-warehouse:' + kind).map((r) => r.value)
const gtp = '/wls/accessory-warehouses/gtp/preparation',
  root = '[data-accessory-preparation-root]',
  card = '[data-aw-preparation-card]',
  a = (name) => `[data-accessory-action="${name}"]`
async function close(page, name = '关闭弹窗') {
  await action(
    page,
    name,
    () => page.getByRole('dialog').last().getByRole('button', { name: '关闭', exact: true }).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
  )
}
async function query(page, keyword) {
  await page.locator('[data-accessory-field="keyword"]').fill(keyword)
  await action(
    page,
    'GTP查询单据',
    () => page.locator(a('query')).click(),
    () => expect(page.locator(card)).toHaveCount(1),
  )
}
async function flow(page) {
  await action(
    page,
    'GTP更多筛选',
    () => page.locator('[data-aw-more-filters] summary').click(),
    () => expect(page.locator('[data-accessory-field="saleType"]')).toBeVisible(),
  )
  await action(
    page,
    'GTP排序',
    async () => {
      await page.locator('[data-accessory-sort-field]').click()
      await page.locator('[data-accessory-sort-field]').selectOption('number')
      await page.keyboard.press('Tab')
    },
    () => expect(page.locator('[data-accessory-sort-field]')).toHaveValue('number'),
  )
  await action(
    page,
    'GTP每页50条',
    async () => {
      await page.locator('[data-accessory-field="pageSize"]').click()
      await page.locator('[data-accessory-field="pageSize"]').selectOption('50')
      await page.keyboard.press('Tab')
    },
    () => expect(page.locator(card)).toHaveCount(21),
  )
  await action(
    page,
    'GTP重置',
    () => page.locator(a('reset')).click(),
    () => expect(page.locator(card)).toHaveCount(21),
  )
  const download = page.waitForEvent('download')
  await action(
    page,
    'GTP导出全部21单物料',
    () => page.locator(a('export')).click(),
    async () => {
      const file = await download
      const csv = fs.readFileSync(await file.path(), 'utf8')
      if (!csv.includes('PO-AW-202610-F03') || csv.split(/\r?\n/).length <= 22)
        throw Error('Export omitted matching lines')
    },
  )
  await action(
    page,
    'GTP列设置打开',
    () => page.locator(a('open-column-settings')).click(),
    () => expect(page.locator('div[data-accessory-column-key="source"]')).toBeVisible(),
  )
  await action(
    page,
    'GTP列隐藏',
    () =>
      page
        .locator('div[data-accessory-column-key="source"]')
        .getByRole('checkbox', { name: '显示', exact: true })
        .uncheck(),
    () => expect(page.locator('th[data-column-key="source"]')).toHaveCount(0),
  )
  await action(
    page,
    'GTP列设置关闭',
    () => page.locator(a('close-column-settings')).first().click(),
    () => expect(page.locator('div[data-accessory-column-key="source"]')).toHaveCount(0),
  )
  await query(page, 'PO-AW-202610-F02')
  await action(
    page,
    'GTP备注打开',
    () => page.locator(a('remark')).click(),
    () => expect(page.locator('[data-aw-remark]')).toBeVisible(),
  )
  await page.locator('[data-aw-remark]').fill('线上配料对齐验收' + iteration)
  await action(
    page,
    'GTP备注保存',
    () => page.locator(a('save-remark')).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
    async () => {
      if (!rows(await db(page), 'preparation').some((r) => r.remark === '线上配料对齐验收' + iteration))
        throw Error('Remark not durable')
    },
  )
  await action(
    page,
    'GTP单行登记打开',
    () => page.locator(a('prepare-line')).first().click(),
    () => expect(page.locator('[data-aw-qty]')).toHaveCount(1),
  )
  await page.locator('[data-aw-qty]').fill('5')
  await page.locator('[data-aw-location]').selectOption({ label: 'GTP-A-01' })
  await action(
    page,
    'GTP单行部分保存',
    () => page.locator(a('save-preparation')).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
    async () => {
      if (
        !rows(await db(page), 'preparation').some(
          (r) => r.productionOrderNo === 'PO-AW-202610-F02' && r.lines[0].preparedQty === 5,
        )
      )
        throw Error('Partial not durable')
    },
  )
  await action(
    page,
    'GTP整单登记打开',
    () => page.locator(a('prepare')).click(),
    () => expect(page.locator('[data-aw-qty]')).toHaveCount(6),
  )
  const map = {
    拉链: [95, 'GTP-A-01'],
    纽扣: [200, 'GTP-A-02'],
    价格吊牌: [100, 'GTP-A-03'],
    品牌吊牌: [100, 'GTP-B-01'],
    吊粒: [100, 'GTP-B-02'],
    车缝线: [1, 'GTP-B-03'],
  }
  for (const [name, [qty, loc]] of Object.entries(map)) {
    await page.getByLabel(name + '本次配料', { exact: true }).fill(String(qty))
    await page.getByLabel(name + '来源库位', { exact: true }).selectOption({ label: loc })
  }
  await page.evaluate(() => {
    window.__gtpPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'records') throw new DOMException('gtp-perf-abort', 'QuotaExceededError')
      return window.__gtpPut.apply(this, args)
    }
  })
  await action(
    page,
    'GTP保存失败保留输入',
    () => page.locator(a('save-preparation')).click(),
    () => expect(page.locator('[data-aw-modal-error]')).toContainText('gtp-perf-abort'),
    async () => {
      if (rows(await db(page), 'transfer').length) throw Error('Half saved transfer')
    },
  )
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.__gtpPut
  })
  await action(
    page,
    'GTP配齐重试原子创建唯一整单调拨',
    () => page.locator(a('save-preparation')).click(),
    () => expect(page.getByRole('dialog')).toHaveCount(0),
    async () => {
      const s = await db(page)
      if (rows(s, 'transfer').filter((r) => r.productionOrderId === 'PO-AW-202610-F02').length !== 1)
        throw Error('Transfer not unique')
      if (!rows(s, 'preparation').some((r) => r.productionOrderNo === 'PO-AW-202610-F02' && r.status === '已配齐'))
        throw Error('Preparation not durable')
    },
  )
  await action(
    page,
    'GTP流水打开',
    () => page.locator(a('history')).click(),
    () => expect(page.getByRole('dialog')).toContainText('配齐'),
  )
  await close(page)
  await action(
    page,
    'GTP凭证预览',
    () => page.locator(a('print')).click(),
    () => expect(page.locator('[data-aw-print] tbody tr')).toHaveCount(6),
  )
  await page.evaluate(() => {
    window.__gtpAfterPrint = false
    addEventListener(
      'afterprint',
      () => {
        window.__gtpAfterPrint = true
      },
      { once: true },
    )
  })
  await action(
    page,
    'GTP原生打印就绪',
    () => page.locator(a('print-now')).click(),
    () => page.waitForFunction(() => window.__gtpAfterPrint),
  )
  await close(page)
  await action(
    page,
    'GTP款式大图打开',
    () =>
      page
        .locator(card + ' ' + a('image'))
        .first()
        .click(),
    () => expect(page.locator('[data-aw-image] img')).toBeVisible(),
  )
  await action(
    page,
    'GTP图片Esc关闭',
    () => page.keyboard.press('Escape'),
    () => expect(page.locator('[data-aw-image]')).toHaveCount(0),
    undefined,
    'keydown',
  )
  await page.screenshot({ path: path.join(out, 'gtp-' + iteration + '.png'), fullPage: true })
}
const fixture = (name) => JSON.parse(fs.readFileSync('tests/fixtures/accessory-warehouse/' + name + '.json', 'utf8'))
report.fixtureHashes = Object.fromEntries(
  ['gtpLegacy', 'sewingLegacy', 'postLegacy', 'post'].map((name) => [
    name,
    hash('tests/fixtures/accessory-warehouse/' + name + '.json'),
  ]),
)
function mergedFixture(left, right) {
  const result = structuredClone(left)
  result.localStorage = { ...left.localStorage, ...right.localStorage }
  for (const source of right.databases) {
    const target = result.databases.find((d) => d.name === source.name)
    if (!target) {
      result.databases.push(source)
      continue
    }
    const normalize = (d) =>
      Array.isArray(d.stores)
        ? d.stores
        : Object.entries(d.stores).map(([name, rows]) => ({
            name,
            keyPath: 'id',
            rows: rows.map((value) => ({ key: value.id, value })),
          }))
    target.stores = normalize(target)
    for (const store of normalize(source)) {
      const known = target.stores.find((s) => s.name === store.name)
      if (!known) target.stores.push(store)
      else known.rows = [...new Map([...known.rows, ...store.rows].map((r) => [r.key, r])).values()]
    }
  }
  return result
}
async function legacyFlows() {
  let isolated = await context(fixture('gtpLegacy'))
  try {
    const p = isolated.page
    await nav(p, 'GTP旧资料首次读取', gtp, root)
    await query(p, 'PO-202603-0004')
    await p.locator(a('remark')).click()
    await p.locator('[data-aw-remark]').fill('旧资料兼容性能' + iteration)
    await action(
      p,
      'GTP旧资料兼容后保存备注',
      () => p.locator(a('save-remark')).click(),
      () => expect(p.getByRole('dialog')).toHaveCount(0),
      async () => {
        const prep = rows(await db(p), 'preparation').find((r) => r.productionOrderNo === 'PO-202603-0004')
        if (!prep?.history.some((h) => h.action === '旧配料记录' && h.detail.includes('2 条')))
          throw Error('Legacy history omitted')
      },
    )
  } finally {
    await isolated.c.close()
  }
  isolated = await context(fixture('sewingLegacy'))
  try {
    const p = isolated.page
    await nav(p, '车缝旧凭证首次读取', '/wls/accessory-warehouses/hilon/pickups', '[data-accessory-pickup-root]')
    await action(
      p,
      '车缝业务建单兼容原实交并阻断重复扣库',
      () => p.locator('[data-accessory-pickup-action="create"]').click(),
      () => expect(p.getByRole('status')).toContainText('原领料凭证已有辅料实交'),
      async () => {
        if (!rows(await db(p), 'migration').some((r) => r.id === 'sewing-pickup-v1' && r.phase === 'COMPLETE'))
          throw Error('Sewing legacy conversion not durable')
      },
    )
  } finally {
    await isolated.c.close()
  }
  isolated = await context(mergedFixture(fixture('post'), fixture('postLegacy')))
  try {
    const p = isolated.page
    await nav(p, '后道旧资料首次读取', '/fcs/craft/post-finishing/material-transfers', '[data-post-material-workspace]')
    await p.locator('[data-post-finishing-material-transfers-action="detail"][data-id="POST-UI-1"]').click()
    const inputs = p.locator('[data-post-material-qty]')
    await inputs.nth(0).fill('10')
    await inputs.nth(1).fill('20')
    for (const select of await p.locator('[data-post-material-location]').all()) await select.selectOption({ index: 1 })
    // Observe the product result in the browser. Node's assertion retry interval
    // can complete much later than the actual render; retain both raw endpoints.
    await p.evaluate(() => {
      window.__gtpPostReady = null
      window.__gtpTransactions=[]
      const originalTransaction=IDBDatabase.prototype.transaction
      IDBDatabase.prototype.transaction=function(...args){const start=performance.now(),tx=originalTransaction.apply(this,args),name=this.name;tx.addEventListener('complete',()=>window.__gtpTransactions.push({database:name,stores:args[0],mode:args[1],start,end:performance.now()}));return tx}
      let checking = false
      const observer = new MutationObserver(async () => {
        const panel = document.querySelector('[data-post-material-detail]')
        if (checking || panel?.childElementCount || !document.querySelector('[data-post-material-workspace]')?.textContent.includes('整单收货上架已保存')) return
        checking = true; observer.disconnect()
        const database = await new Promise((resolve, reject) => { const r = indexedDB.open('higood-cutting-records-v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        const saved = await new Promise((resolve, reject) => { const tx = database.transaction('records', 'readonly'); let transfer, stocks; const t = tx.objectStore('records').get('accessory-warehouse:transfer:POST-UI-1'); t.onsuccess = () => { transfer = t.result?.value }; const s = tx.objectStore('records').getAll(IDBKeyRange.bound('accessory-warehouse:stock:', 'accessory-warehouse:stock:\uffff')); s.onsuccess = () => { stocks = s.result.map(row => row.value) }; tx.oncomplete = () => resolve({transfer,stocks}); tx.onabort = () => reject(tx.error) })
        database.close()
        if (saved.transfer?.status !== '已收货' || saved.stocks.filter(row => row.warehouseCode === 'DLN' && row.materialSku === 'AW-DEMO-ZIPPER').reduce((n,row) => n + row.onHandQty,0) !== 17) throw Error('Browser observer: receipt not durable')
        const images = [...document.images].filter(image => { const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 })
        await Promise.all(images.map(image => image.decode())); await document.fonts.ready
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        window.__gtpPostReady = { end: performance.now(), images: images.length, durable: true, source: 'browser mutation observer + native IDB transaction complete + image decode + two frames', transactions: window.__gtpTransactions, resources: performance.getEntriesByType('resource').filter(r=>r.startTime>=window.__gtpStart).map(r=>({name:r.name.split('/').at(-1),start:r.startTime,duration:r.duration})) }
      })
      observer.observe(document, {subtree: true, childList: true, characterData: true})
    })
    await action(
      p,
      '后道普通实收兼容原7条并新增10条',
      () => p.locator('[data-post-finishing-material-transfers-action="receive"]').click(),
      () => expect(p.locator('[data-post-material-detail]')).toBeEmpty(),
      async () => {
        const snapshot = await db(p)
        if (!rows(snapshot, 'transfer').some((r) => r.id === 'POST-UI-1' && r.status === '已收货'))
          throw Error('Post receipt not durable')
        const qty = rows(snapshot, 'stock')
          .filter((r) => r.warehouseCode === 'DLN' && r.materialSku === 'AW-DEMO-ZIPPER')
          .reduce((n, r) => n + r.onHandQty, 0)
        if (qty !== 17) throw Error('Post legacy quantity not conserved: ' + qty)
      },
    )
  } finally {
    await isolated.c.close()
  }
}
const routes = [
  ['调拨全功能', '/wls/accessory-warehouses/gtp/transfers', '[data-accessory-transfer-root]'],
  ['HILON领料全功能', '/wls/accessory-warehouses/hilon/pickups', '[data-accessory-pickup-root]'],
  ['Mahameru领料全功能', '/wls/accessory-warehouses/mahameru/pickups', '[data-accessory-pickup-root]'],
  ['后道全功能', '/fcs/craft/post-finishing/material-transfers', '[data-post-material-workspace]'],
  ['物料决策全功能', '/dds/supply-chain/materials/overview', '#md-page'],
  ['成衣仓全功能', '/wls/finished-inbound', '[data-wls-finished-inbound-root]'],
  ['中转收货全功能', '/wls/inbound', '[data-wls-inbound-root]'],
  ['染厂收货全功能', '/fcs/craft/dyeing/pending-receipts', '[data-factory-receiving-root]'],
  ['印厂收货全功能', '/fcs/craft/printing/pending-receipts', '[data-factory-receiving-root]'],
  ['TMF实收全功能', '/wls/accessory-production-receipts', '[data-tmf-production-receipts]'],
]
async function revalidateListRendering() {
  const isolated = await context()
  const page = isolated.page
  try {
    await nav(page, '最终GTP卡片首次访问', gtp, root)
    await nav(page, '最终GTP卡片刷新', '', root, true)
    for (const width of [1366, 1280, 1024]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 768 })
      await page.locator('[data-accessory-field="keyword"]').fill('NO-MATCH-EMPTY-RESULT')
      await action(page, '最终GTP空结果查询' + width,
        () => page.locator(a('query')).click(),
        async () => {
          await expect(page.locator(card)).toHaveCount(0)
          await expect(page.locator('table')).toContainText('暂无符合条件的配料单')
          if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) throw Error('Empty list overflows viewport')
        })
      await action(page, '最终GTP空结果重置' + width,
        () => page.locator(a('reset')).click(),
        () => expect(page.locator(card)).toHaveCount(10))
    }
    await page.setViewportSize({ width: 1366, height: 768 })
    await nav(page, '最终物料决策列表首次访问', '/dds/supply-chain/materials/overview', '#md-page')
    await nav(page, '最终物料决策列表刷新', '', '#md-page', true)
  } finally {
    await isolated.c.close()
  }
}
try {
  const count = Number(process.env.AW_PERF_ITERATIONS || 5)
  for (iteration = 1; iteration <= count; iteration++) {
    browser = await chromium.launch({ headless: true })
    report.browser = browser.version()
    if (process.env.AW_PERF_LIST_REVALIDATION === 'true') {
      try { await revalidateListRendering() } finally { await browser.close() }
      continue
    }
    if (process.env.AW_PERF_ONLY_LEGACY === 'true') {
      try {
        await legacyFlows()
      } finally {
        await browser.close()
      }
      continue
    }
    const { c, page } = await context()
    try {
      await nav(page, 'GTP浏览器冷启动', gtp, root)
      await nav(page, 'GTP整页刷新', '', root, true)
      await flow(page)
      await legacyFlows()
      for (const [name, url, selector] of routes) {
        const isolated = await context()
        try {
          await nav(isolated.page, name + '首次访问', url, selector)
          await nav(isolated.page, name + '刷新', '', selector, true)
        } finally {
          await isolated.c.close()
        }
      }
      for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: width === 1280 ? 720 : 768 })
        await nav(page, 'GTP刷新' + width, '', root, true)
        await page.locator(a('reset')).click()
        await query(page, 'PO-AW-202610-F01')
        await action(
          page,
          'GTP登记打开' + width,
          () => page.locator(a('prepare')).click(),
          () => expect(page.locator('[data-aw-qty]')).toHaveCount(6),
        )
        await close(page, 'GTP弹窗关闭' + width)
      }
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.goto(base + '/wls/accessory-warehouses/gtp/locations')
      await page.locator('[data-accessory-locations="gtp"]').waitFor()
      await action(
        page,
        'GTP站内切换',
        () => page.locator('aside [data-tab-key="wls-accessory-gtp-preparation"]').click(),
        () => expect(page.locator(root)).toBeVisible(),
      )
    } finally {
      await c.close()
      await browser.close()
    }
  }
  report.runtimeAssetsAfter = assets()
  if (JSON.stringify(report.runtimeAssets) !== JSON.stringify(report.runtimeAssetsAfter))
    throw Error('Runtime assets changed')
  report.families = Object.fromEntries(
    [...new Set(report.samples.map((s) => s.name))].map((name) => {
      const values = report.samples.filter((s) => s.name === name).map((s) => s.ms)
      return [
        name,
        {
          count: values.length,
          values,
          max: Math.max(...values),
          pass: values.length >= count && values.every((v) => v <= 1000),
        },
      ]
    }),
  )
  report.accepted = report.failures.length === 0 && count >= 5
  save()
  console.log(
    JSON.stringify(
      {
        out,
        samples: report.samples.length,
        families: Object.keys(report.families).length,
        failures: report.failures,
        accepted: report.accepted,
      },
      null,
      2,
    ),
  )
  process.exitCode = report.failures.length ? 1 : 0
} catch (error) {
  report.failures.push({ iteration, collectorInvalid: true, error: String(error) })
  report.accepted = false
  save()
  console.error(error)
  await browser?.close()
  process.exitCode = 1
}
