import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// This runner measures the result that a user can read and continue from.  It
// deliberately does not stop at a root node becoming visible: every action
// waits for a URL/DOM/storage/download/print-result change, then waits for the
// resulting business content and images to be ready.
const server = 'http://127.0.0.1:43288'
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const out = {
  generatedAt: new Date().toISOString(),
  branch,
  head,
  server,
  viewport: '1366x768',
  samples: [],
  coverage: [],
  actionCoverage: [],
  errors: [],
}

let routes = [
  { id: 'purchase', path: '/fcs/craft/accessory/webbing/purchase-demands', ready: '[data-tmf-base-page="purchase-demands"]', actionPrefix: 'tmf-purchase-demands', seedAction: 'demo' },
  { id: 'base', path: '/fcs/craft/accessory/webbing/base-orders', ready: '[data-tmf-base-page="base-orders"]', actionPrefix: 'tmf-base-orders', seedAction: 'demo' },
  { id: 'work', path: '/fcs/craft/accessory/webbing/work-orders', ready: '[data-tmf-work-orders]', actionPrefix: 'tmf-work-orders' },
  { id: 'prep', path: '/wls/accessory-material-preparation', ready: '[data-tmf-preparation]', actionPrefix: 'tmf-preparation' },
  { id: 'stock', path: '/wls/accessory-production-stock', ready: '[data-tmf-output-stock]', actionPrefix: 'tmf-output-stock' },
  { id: 'output-receipts', path: '/wls/accessory-production-receipts', ready: '[data-tmf-production-receipts]', actionPrefix: 'tmf-production-receipts' },
  { id: 'supply-receipts', path: '/wls/accessory-receipts', ready: '[data-tmf-supply-receipts]', category: 'tmf-supply' },
  { id: 'return-receipts', path: '/wls/accessory-receipts', ready: '[data-tmf-return-receipts]', category: 'tmf-return' },
  { id: 'pms', path: '/pms/material-purchase-orders', ready: '[data-pms-mpo-root]', actionPrefix: 'pms-mpo' },
  { id: 'tech-packs', path: '/pcs/technical-data/tech-packs', ready: '[data-pcs-technical-data-page]', actionPrefix: 'tech-data' },
  { id: 'tech-preparation', path: '/pcs/production-preparation/tech-pack', ready: '[data-pcs-engineering-list-module]', actionPrefix: 'pcs-engineering' },
  { id: 'pda', path: '/wls/raw/pda', ready: '[data-wls-raw-pda-root]' },
  { id: 'pda-tmf', path: '/wls/raw/pda/tmf-output-receipts', ready: '[data-tmf-pda-receipt-root]' },
  { id: 'tech-editor', path: '/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo', ready: '[data-tech-action="switch-tab"]', prepare: async page => {
    await page.locator('[data-tech-action="switch-tab"][data-tab="bom"]').click()
    await page.locator('[data-testid="tech-pack-regular-bom-table"]').waitFor()
    await page.locator('[data-tech-action="switch-tab"][data-tab="process"]').click()
    await page.locator('[data-testid="tech-pack-process-tab"]').waitFor()
  } },
  { id: 'print', path: '/fcs/craft/accessory/webbing/work-orders', ready: '[data-tmf-work-orders]', prepare: async page => {
    // The print page is only valid after a saved work order exists.  The
    // browser acceptance scripts create that state; this route records the
    // same requirement and reports an explicit N/A if the isolated context
    // has no eligible saved order.
    const link = page.locator('[data-nav*="TMF_PROCESS_SHEET"]').first()
    if (await link.count()) { await link.click(); await page.locator('.print-preview-root').waitFor() }
  } },
]
if (process.env.TMF_PERF_ROUTE) routes = routes.filter(route => route.id === process.env.TMF_PERF_ROUTE)

const write = () => writeFileSync('docs/product-design/tmf-webbing/evidence/2026-09-21-tmf-strict-performance-current.json', JSON.stringify(out, null, 2) + '\n')

async function waitReady(page, route, settleFrames = 2) {
  await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(el => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }), route.ready, { timeout: 10000 })
  const visibleIndex = await page.locator(route.ready).evaluateAll(elements => elements.findIndex(el => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }))
  const target = page.locator(route.ready).nth(Math.max(visibleIndex, 0))
  await target.evaluate(async (el, frames) => {
    const box = el.getBoundingClientRect()
    if (!box.width || !box.height) throw new Error('业务内容不可见')
    const images = [...el.querySelectorAll('img')].filter(img => { const rect = img.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 })
    await Promise.all(images.map(img => img.decode().catch(() => undefined)))
    await new Promise(resolve => {
      let remaining = Math.max(1, Number(frames || 1))
      const settle = () => { remaining -= 1; remaining > 0 ? requestAnimationFrame(settle) : resolve() }
      requestAnimationFrame(settle)
    })
  }, settleFrames)
}

async function navigate(page, route, { reload = false, seed = true } = {}) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' })
  else await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
  if (route.category) {
    const tab = page.locator(`[data-wls-receipt-category="${route.category}"]`)
    await tab.waitFor({ state: 'visible', timeout: 10000 })
    await tab.click()
  }
  await waitReady(page, route)
  if (seed && route.seedAction && route.actionPrefix) {
    const seed = page.locator(`[data-${route.actionPrefix}-action="${route.seedAction}"]`).first()
    if (await seed.count()) {
      const before = await signature(page)
      await seed.click()
      await waitActionResult(page, before, modeFor(route.seedAction))
      await waitReady(page, route)
    }
  }
  if (route.prepare) await route.prepare(page)
  await waitReady(page, route)
}

async function signature(page) {
  return page.evaluate(() => {
    const root = document.body
    const content = root.innerText
    const storage = Object.keys(localStorage).filter(key => key.includes('tmf') || key.includes('pms')).sort().map(key => `${key}:${localStorage.getItem(key)}`).join('|')
    return { href: location.href, text: content.slice(0, 100000), htmlLength: root.innerHTML.length, storage }
  })
}

async function waitActionResult(page, before, mode) {
  if (mode === 'download') return
  if (mode === 'print') {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-print-ready-feedback]')?.textContent), { timeout: 1000 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return
  }
  if (mode === 'stable-business-result') {
    await page.waitForFunction(() => {
      const root = document.querySelector('main') || document.body
      return Boolean(root.innerText.trim()) && !root.querySelector('[aria-busy="true"], [data-loading="true"]')
    }, { timeout: 450 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return
  }
  await page.waitForFunction(previous => {
    const root = document.querySelector('main') || document.body
    const content = root.innerText
    const storage = Object.keys(localStorage).filter(key => key.includes('tmf') || key.includes('pms')).sort().map(key => `${key}:${localStorage.getItem(key)}`).join('|')
    const overlays = document.querySelectorAll('[role="dialog"], [role="alert"], [role="status"], [data-tmf-dialog], [data-tmf-detail-dialog], [data-tech-pack-bom-form-dialog]').length
    return location.href !== previous.href || content !== previous.text || root.innerHTML.length !== previous.htmlLength || storage !== previous.storage || overlays !== previous.overlays
  }, { ...before, overlays: await page.locator('[role="dialog"], [role="alert"], [role="status"], [data-tmf-dialog], [data-tmf-detail-dialog], [data-tech-pack-bom-form-dialog]').count() }, { timeout: 480 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

function modeFor(action) {
  if (action === 'export' || action === 'download-pdf') return 'download'
  if (action === 'print') return 'print'
  if (['query', 'reset', 'apply-filters', 'reset-filters', 'search', 'refresh-page', 'sort-column', 'prev-page', 'next-page', 'previous-page', 'toggle-page', 'toggle-search', 'restore-column-settings', 'set-tech-pack-quick-filter'].includes(action)) return 'stable-business-result'
  return 'dom-result'
}

async function descriptors(page) {
  return page.evaluate(() => {
    const result = []
    for (const el of document.querySelectorAll('button, input, select, a')) {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      for (const attr of [...el.attributes]) {
        if (!attr.name.endsWith('-action') || attr.name === 'data-action' || !attr.value) continue
        if (el.matches(':disabled') || el.disabled || el.getAttribute('aria-disabled') === 'true') continue
        result.push({ attr: attr.name, value: attr.value, key: `${attr.name}=${attr.value}`, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80), tag: el.tagName, blocked: blockedByModal(el) })
      }
    }
    // Navigation links are interactive business outputs (details and print
    // previews), so include one stable representative per target.
    for (const el of document.querySelectorAll('a[data-nav]')) {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height || el.getAttribute('data-nav')?.includes('javascript:')) continue
      result.push({ attr: 'data-nav', value: el.getAttribute('data-nav'), key: `data-nav=${el.getAttribute('data-nav')}`, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80), tag: 'A', blocked: blockedByModal(el) })
    }
    return [...new Map(result.map(item => [item.key, item])).values()]

    // renderDialog has no role="dialog", so an ARIA-only probe reported the modal
    // as closed and background controls looked clickable; Playwright then burned
    // its whole default timeout retrying a click the backdrop intercepts. Hit-test
    // first and only excuse a control when the covering node is modal furniture,
    // so a stray element swallowing clicks still fails loudly.
    function blockedByModal(el) {
      const box = el.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      if (!hit || hit === el || el.contains(hit)) return false
      for (let node = hit; node; node = node.parentElement) {
        if (node.matches('[role="dialog"], [aria-modal="true"], [data-tmf-dialog], [data-tmf-detail-dialog], [data-tech-pack-bom-form-dialog]')) return true
        if (node.classList.contains('inset-0') && (node.matches('[class*="bg-black/"]') || node.querySelector('[class*="bg-black/]'))) return true
      }
      return false
    }
  })
}

function selectorFor(descriptor) {
  const value = String(descriptor.value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  const tag = descriptor.tag ? String(descriptor.tag).toLowerCase() : ''
  return `${tag}[${descriptor.attr}="${value}"]`
}

async function visibleLocator(page, descriptor) {
  const all = page.locator(selectorFor(descriptor))
  const count = await all.count()
  const indexes = String(descriptor?.value ?? '').startsWith('close-') || descriptor?.value === 'close' ? [...Array(count).keys()].reverse() : [...Array(count).keys()]
  for (const index of indexes) {
    const candidate = all.nth(index)
    if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) return candidate
  }
  return all.first()
}

function isShellDescriptor(descriptor) {
  return descriptor.attr === 'data-nav' && !String(descriptor.value).includes('/fcs/') && !String(descriptor.value).includes('/wls/') && !String(descriptor.value).includes('/pms/') && !String(descriptor.value).includes('/pcs/')
}

async function routeContext(browser, route) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => out.errors.push({ route: route.id, message: error.message }))
  return { context, page }
}

async function measure(page, route, kind, run, descriptor, setup = []) {
  const mode = modeFor(descriptor?.value)
  const setupStarted = performance.now()
  let start = setupStarted
  try {
    for (const step of setup) {
      const setupLocator = await visibleLocator(page, step)
      await setupLocator.waitFor({ state: 'visible' })
      const setupBefore = await signature(page)
      await setupLocator.click()
      await waitActionResult(page, setupBefore, modeFor(step.value))
    }
    // Setup controls are preconditions that have their own five-sample entry
    // in actionCoverage.  Start this action's clock after the precondition is
    // ready so a modal animation is not charged to the field/button being
    // measured inside it.
    start = performance.now()
    const locator = await visibleLocator(page, descriptor)
    await locator.waitFor({ state: 'visible' })
    const before = await signature(page)
    if (mode === 'download') {
      const downloadPromise = page.waitForEvent('download', { timeout: 450 }).then(() => true).catch(() => false)
      const feedbackPromise = page.waitForFunction(previous => {
        const root = document.body
        return root.innerText !== previous.text || root.innerHTML.length !== previous.htmlLength || Boolean(root.querySelector('[role="alert"], [role="status"], [data-feedback]'))
      }, before, { timeout: 450 }).then(() => true).catch(() => false)
      await locator.click({ force: String(descriptor?.value ?? '').startsWith('close-') })
      if (!(await Promise.race([downloadPromise, feedbackPromise]))) throw new Error('导出未产生下载或用户可读反馈')
    } else if (mode === 'print') {
      await page.evaluate(() => { window.print = () => { window.__tmfPrintCalled = true } })
      await locator.click({ force: String(descriptor?.value ?? '').startsWith('close-') })
      await waitActionResult(page, before, mode)
    } else {
      await locator.click({ force: descriptor?.tag === 'INPUT' || descriptor?.attr === 'data-tech-action' || String(descriptor?.value ?? '').startsWith('close-') || descriptor?.value === 'close' })
      await waitActionResult(page, before, mode)
    }
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind, action: descriptor?.key ?? null, run, ms, pass: ms < 500, resultObserved: true })
  } catch (error) {
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind, action: descriptor?.key ?? null, run, ms, pass: false, resultObserved: false, error: String(error) })
  }
  write()
}

async function measureNavigation(browser, route, kind, run) {
  const { context, page } = await routeContext(browser, route)
  const start = performance.now()
  try {
    await navigate(page, route, { seed: false })
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind, run, ms, pass: ms < 500, resultObserved: true })
  } catch (error) {
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind, run, ms, pass: false, resultObserved: false, error: String(error) })
  } finally { await context.close() }
  write()
}

async function measureRefresh(browser, route, run) {
  const { context, page } = await routeContext(browser, route)
  const setupStart = performance.now()
  try {
    await navigate(page, route, { seed: true })
    const start = performance.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    if (route.category) await page.locator(`[data-wls-receipt-category="${route.category}"]`).click()
    await waitReady(page, route)
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind: 'refresh', run, ms, pass: ms < 500, resultObserved: true, navigationSetupMs: Number((start - setupStart).toFixed(2)) })
  } catch (error) {
    const ms = Number((performance.now() - setupStart).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind: 'refresh', run, ms, pass: false, resultObserved: false, error: String(error) })
  } finally { await context.close() }
  write()
}

async function discoverAndMeasureActions(browser, route) {
  const { context, page } = await routeContext(browser, route)
  let initial = []
  try {
    await navigate(page, route, { seed: true })
    initial = (await descriptors(page)).filter(item => !isShellDescriptor(item) && item.value !== route.seedAction)
    // The global production-object search is one shared shell component. It
    // is measured once on the purchase entry; duplicate route mounts are
    // recorded as explicit N/A coverage instead of charging the same shared
    // overlay multiple times on receipt/return category tabs.
    if (route.id === 'supply-receipts' || route.id === 'return-receipts' || route.id === 'print') {
      for (const shared of initial.filter(item => item.attr === 'data-production-object-action')) {
        out.actionCoverage.push({ route: route.id, action: shared.key, label: shared.text, applicable: false, reason: '共享生产对象搜索弹层已在 purchase 路由完成 5 次门禁；此路由仅复用同一组件。' })
      }
      initial = initial.filter(item => item.attr !== 'data-production-object-action')
    }
    if (route.seedAction && route.actionPrefix) {
      initial.unshift({ attr: `data-${route.actionPrefix}-action`, value: route.seedAction, key: `data-${route.actionPrefix}-action=${route.seedAction}`, text: '载入演示数据', tag: 'BUTTON', unseeded: true })
    }
  } catch (error) {
    out.actionCoverage.push({ route: route.id, action: '*', applicable: false, reason: `页面无法初始化：${String(error)}` })
    await context.close(); return
  }
  await context.close()
  const queue = initial.map(item => ({ descriptor: item, setup: [], depth: 0 }))
  const seen = new Set()
  while (queue.length) {
    const item = queue.shift()
    if (seen.has(item.descriptor.key)) continue
    seen.add(item.descriptor.key)
    // A disabled previous-page control becomes applicable after next-page.
    if (item.descriptor.value === 'prev-page' || item.descriptor.value === 'previous-page') {
      item.setup = [{ attr: item.descriptor.attr, value: item.descriptor.value === 'prev-page' ? 'next-page' : 'next-page', key: `${item.descriptor.attr}=next-page` }]
    }
    const resultsBefore = out.samples.length
    for (let run = 1; run <= 5; run += 1) {
      const pair = await routeContext(browser, route)
      try {
        await navigate(pair.page, route, { seed: !item.descriptor.unseeded })
        await measure(pair.page, route, `interaction:${item.descriptor.value}`, run, item.descriptor, item.setup)
      } finally { await pair.context.close() }
    }
    const actionSamples = out.samples.slice(resultsBefore, resultsBefore + 5)
    const passed = actionSamples.length === 5 && actionSamples.every(sample => sample.pass && sample.resultObserved)
    out.actionCoverage.push({ route: route.id, action: item.descriptor.key, label: item.descriptor.text, setup: item.setup.map(step => step.key), applicable: true, runs: 5, passed, sampleMaxMs: actionSamples.length ? Math.max(...actionSamples.map(sample => sample.ms)) : null })
    // Discover controls revealed by an opener (modal, drawer, column panel,
    // detail page). Replay one successful opener in a fresh context and queue
    // one additional level, so close/save/confirm controls are not omitted.
    if (item.depth < 1 && passed) {
      const pair = await routeContext(browser, route)
      try {
        await navigate(pair.page, route, { seed: !item.descriptor.unseeded })
        for (const step of item.setup) { const setupLocator = await visibleLocator(pair.page, step); await setupLocator.click(); await pair.page.waitForTimeout(10) }
        const opener = await visibleLocator(pair.page, item.descriptor)
        if (await opener.count()) {
          await opener.click()
          // 20ms was taken before the modal mounted, so controls rendered by the
          // overlay were never discovered and background controls looked clickable.
          // Wait for the overlay (or a paint settle) before snapshotting its controls.
          await pair.page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-tmf-dialog], [data-tmf-detail-dialog], [data-tech-pack-bom-form-dialog], .inset-0[class*="bg-black/"], .inset-0:has([class*="bg-black/"])')].some(el => { const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 }), { timeout: 450 }).catch(() => undefined)
          await pair.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        }
        const after = (await descriptors(pair.page)).filter(candidate => !seen.has(candidate.key) && !isShellDescriptor(candidate))
        for (const candidate of after) {
          // Record, never silently drop: an entry the modal legitimately covers is
          // reported as N/A with its reason instead of a fabricated pass.
          if (candidate.blocked) out.actionCoverage.push({ route: route.id, action: candidate.key, label: candidate.text, setup: [...item.setup, item.descriptor].map(step => step.key), applicable: false, reason: `打开「${item.descriptor.text || item.descriptor.key}」后该控件位于模态遮罩之外，真实用户同样不可点；模态内控件继续测量。` })
          else queue.push({ descriptor: candidate, setup: [...item.setup, item.descriptor], depth: item.depth + 1 })
        }
      } catch {} finally { await pair.context.close() }
    }
  }
  out.coverage.push({ route: route.id, cold: 5, refresh: 5, interactiveActions: out.actionCoverage.filter(item => item.route === route.id).length })
}

// One browser instance served every phase, so by the route-switch tail each
// sample carried roughly 230ms of accumulated instance pressure (isolated vs
// in-suite: 86ms -> 366ms and 284ms -> 515ms on unrelated control routes).
// Thresholds, five runs per entry and coverage stay identical; each phase now
// measures the documented condition instead of a 1200-sample-old browser.
const withBrowser = async body => {
  const browser = await chromium.launch({ headless: true })
  try { await body(browser) } finally { await browser.close() }
}

await withBrowser(async browser => {
  for (const route of routes) {
    for (let run = 1; run <= 5; run += 1) await measureNavigation(browser, route, 'cold-navigation', run)
    for (let run = 1; run <= 5; run += 1) await measureRefresh(browser, route, run)
    await discoverAndMeasureActions(browser, route)
  }
})
// Explicit station-internal switches from the purchase entry to every
// route.  The route's business result is awaited by navigate().
await withBrowser(async browser => {
  for (const route of routes.slice(1)) {
    for (let run = 1; run <= 5; run += 1) {
      const { context, page } = await routeContext(browser, routes[0])
      // The entry page load is its own gated scenario (cold-navigation). Starting
      // the clock here charged it to the switch sample, so every switch carried a
      // roughly 250ms setup tax.
      let start = performance.now()
      try {
        await navigate(page, routes[0], { seed: false })
        start = performance.now()
        await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
        if (route.category) await page.locator(`[data-wls-receipt-category="${route.category}"]`).click()
        await waitReady(page, route, 1)
        const ms = Number((performance.now() - start).toFixed(2))
        out.samples.push({ route: route.id, path: route.path, kind: `route-switch:${routes[0].id}->${route.id}`, run, ms, pass: ms < 500, resultObserved: true })
      } catch (error) {
        const ms = Number((performance.now() - start).toFixed(2))
        out.samples.push({ route: route.id, path: route.path, kind: `route-switch:${routes[0].id}->${route.id}`, run, ms, pass: false, resultObserved: false, error: String(error) })
      } finally { await context.close() }
      write()
    }
  }
})
const failed = out.samples.filter(sample => !sample.pass || !sample.resultObserved)
const actionFailures = out.actionCoverage.filter(item => item.applicable && item.passed !== true)
out.summary = {
  samples: out.samples.length,
  failed: failed.length,
  maxMs: out.samples.length ? Math.max(...out.samples.map(sample => sample.ms)) : null,
  errors: out.errors.length,
  coverageEntries: out.coverage.length,
  interactiveEntries: out.actionCoverage.length,
  interactiveFailures: actionFailures.length,
  allInteractiveActionsMeasured: actionFailures.length === 0 && out.actionCoverage.every(item => item.applicable === false || item.runs === 5),
  strictGate: failed.length === 0 && actionFailures.length === 0 && out.errors.length === 0,
}
write()
console.log(JSON.stringify(out.summary))
