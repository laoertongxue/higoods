import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const server = 'http://127.0.0.1:43288'
const out = {
  generatedAt: new Date().toISOString(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  server,
  viewport: '1366x768',
  samples: [],
  coverage: [],
  errors: [],
}

const routes = [
  { id: 'purchase', path: '/fcs/craft/accessory/webbing/purchase-demands', ready: '[data-tmf-base-page="purchase-demands"]', prefix: 'tmf-purchase-demands' },
  { id: 'base', path: '/fcs/craft/accessory/webbing/base-orders', ready: '[data-tmf-base-page="base-orders"]', prefix: 'tmf-base-orders' },
  { id: 'work', path: '/fcs/craft/accessory/webbing/work-orders', ready: '[data-tmf-work-orders]', prefix: 'tmf-work-orders' },
  { id: 'prep', path: '/wls/accessory-material-preparation', ready: '[data-tmf-preparation]', prefix: 'tmf-preparation' },
  { id: 'stock', path: '/wls/accessory-production-stock', ready: '[data-tmf-output-stock]', prefix: 'tmf-output-stock' },
  { id: 'output-receipts', path: '/wls/accessory-production-receipts', ready: '[data-tmf-production-receipts]', prefix: 'tmf-production-receipts' },
  { id: 'supply-receipts', path: '/wls/accessory-receipts', ready: '[data-tmf-supply-receipts]', prefix: 'tmf-supply-receipts', category: 'tmf-supply' },
  { id: 'return-receipts', path: '/wls/accessory-receipts', ready: '[data-tmf-return-receipts]', prefix: 'tmf-return-receipts', category: 'tmf-return' },
  { id: 'pms', path: '/pms/material-purchase-orders', ready: '[data-pms-mpo-root]', prefix: 'pms-mpo' },
  { id: 'tech-packs', path: '/pcs/technical-data/tech-packs', ready: '[data-pcs-technical-data-page]' },
  { id: 'tech-preparation', path: '/pcs/production-preparation/tech-pack', ready: '[data-pcs-engineering-list-module]' },
  { id: 'pda', path: '/wls/raw/pda', ready: '[data-wls-raw-pda-root]' },
  { id: 'pda-tmf', path: '/wls/raw/pda/tmf-output-receipts', ready: '[data-tmf-pda-receipt-root]' },
  { id: 'print', path: '/fcs/print/preview?documentType=TMF_PROCESS_SHEET&sourceType=TMF_WORK_ORDER&sourceId=missing', ready: '.print-preview-root' },
]

function write() { writeFileSync('docs/product-design/tmf-webbing/evidence/2026-09-21-tmf-strict-performance-current.json', JSON.stringify(out, null, 2) + '\n') }
async function ready(page, route) {
  const target = page.locator(route.ready).first()
  await target.waitFor({ state: 'visible', timeout: 10000 })
  await target.evaluate(async (el) => {
    const box = el.getBoundingClientRect()
    if (!box.width || !box.height) throw new Error('业务内容不可见')
    const images = [...el.querySelectorAll('img')].filter((img) => { const r = img.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 })
    await Promise.all(images.map((img) => img.decode().catch(() => undefined)))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
async function navigate(page, route, reload = false) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' })
  else await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
  if (route.category) {
    const tab = page.locator(`[data-wls-receipt-category="${route.category}"]`)
    await tab.waitFor({ state: 'visible', timeout: 10000 })
    await tab.click()
  }
}
async function measure(page, route, kind, run, action) {
  const start = performance.now()
  try {
    await action()
    await ready(page, route)
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind, run, ms, pass: ms < 500 })
  } catch (error) {
    out.samples.push({ route: route.id, path: route.path, kind, run, ms: Number((performance.now() - start).toFixed(2)), pass: false, error: String(error) })
  }
  write()
}
async function routeContext(browser, route) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => out.errors.push({ route: route.id, message: error.message }))
  return { context, page }
}

const browser = await chromium.launch()
try {
  // Every affected entry: five cold navigations and five refreshes.
  for (const route of routes) {
    const cold = []
    for (let run = 1; run <= 5; run += 1) {
      const { context, page } = await routeContext(browser, route)
      await measure(page, route, 'cold-navigation', run, () => navigate(page, route))
      await context.close()
    }
    const { context, page } = await routeContext(browser, route)
    await navigate(page, route)
    await ready(page, route)
    for (let run = 1; run <= 5; run += 1) await measure(page, route, 'refresh', run, () => navigate(page, route, true))
    await context.close()
    out.coverage.push({ route: route.id, cold: 5, refresh: 5 })
  }

  // Five station-internal route switches from the common TMF landing entry to every route.
  const from = routes[0]
  for (const route of routes.slice(1)) {
    for (let run = 1; run <= 5; run += 1) {
      const { context, page } = await routeContext(browser, from)
      await navigate(page, from)
      await ready(page, from)
      await measure(page, route, `route-switch:${from.id}->${route.id}`, run, () => navigate(page, route))
      await context.close()
    }
  }

  // Query/reset/column-settings are the shared management-list actions. Each action is
  // discovered by the page's own data prefix; absent actions are recorded as N/A rather
  // than silently treated as passed.
  for (const route of routes.filter((item) => item.prefix)) {
    const { context, page } = await routeContext(browser, route)
    await navigate(page, route)
    await ready(page, route)
    for (const action of ['query', 'reset', 'open-column-settings']) {
      const actualAction = route.actions?.[action] || action
      const selector = `[data-${route.prefix}-action="${actualAction}"]`
      const button = page.locator(selector).first()
      if (!(await button.count())) {
        out.coverage.push({ route: route.id, action, applicable: false, reason: '当前页面无该入口' })
        continue
      }
      for (let run = 1; run <= 5; run += 1) {
        await measure(page, route, `interaction:${action}`, run, () => button.click())
        if (action === 'open-column-settings') {
          const close = page.locator(`[data-${route.prefix}-action="close-column-settings"]`).first()
          if (await close.count()) await close.click({ force: true })
          else await page.keyboard.press('Escape')
        }
      }
      out.coverage.push({ route: route.id, action, applicable: true, runs: 5 })
    }
    await context.close()
  }
} finally {
  await browser.close()
  const failed = out.samples.filter((sample) => !sample.pass)
  out.summary = { samples: out.samples.length, failed: failed.length, maxMs: out.samples.length ? Math.max(...out.samples.map((sample) => sample.ms)) : null, errors: out.errors.length, coverageEntries: out.coverage.length, strictGate: failed.length === 0 && out.errors.length === 0 }
  write()
  console.log(JSON.stringify(out.summary))
}
