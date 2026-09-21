import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// AGENTS.md §7.2 evidence for the migrated 物料档案 pages: every load scenario and every
// interactive entry, five runs each in fresh contexts, timed until the result a user can read
// is on screen (page overlays included), never until a node merely appears.
const server = 'http://127.0.0.1:43288'
const kinds = ['fabric', 'accessory', 'yarn', 'consumable', 'packaging', 'parts']
const routes = [
  ...kinds.map((kind, index) => ({
    id: `materials-${kind}`,
    kind,
    path: `/pcs/materials/${kind}`,
    ready: `[data-pcs-material-archive-page="${kind}"]`,
    previous: index > 0 ? `/pcs/materials/${kinds[index - 1]}` : null,
    previousReady: index > 0 ? `[data-pcs-material-archive-page="${kinds[index - 1]}"]` : null,
  })),
  { id: 'detail-webbing', kind: 'accessory', path: '/pcs/materials/accessory/tmf-webbing-reference', ready: '[data-pcs-material-archive-action="set-detail-tab"]', previous: '/pcs/materials/accessory', previousReady: '[data-pcs-material-archive-page="accessory"]' },
  { id: 'detail-fabric', kind: 'fabric', path: '/pcs/materials/fabric/material_fabric_001', ready: '[data-pcs-material-archive-action="set-detail-tab"]', previous: '/pcs/materials/fabric', previousReady: '[data-pcs-material-archive-page="fabric"]' },
]
const out = {
  generatedAt: new Date().toISOString(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() || 'main',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  server,
  viewport: '1366x768',
  environment: 'vite preview 生产构建；每条样本新建隔离浏览器上下文（空缓存）；按阶段使用全新 browser 实例',
  samples: [],
  coverage: [],
  actionCoverage: [],
  errors: [],
}
const write = () => writeFileSync(
  'docs/product-design/tmf-webbing/evidence/2026-09-21-material-archives-performance-current.json',
  `${JSON.stringify(out, null, 2)}\n`,
)

const readyVisible = selector => [...document.querySelectorAll(selector)].some(el => {
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden'
})

async function waitReady(page, readySelector) {
  await page.waitForFunction(readyVisible, readySelector, { timeout: 15000 })
  await page.evaluate(() => {
    const scope = document.body
    const images = [...scope.querySelectorAll('img')].filter(img => {
      const rect = img.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
    })
    return Promise.all(images.map(img => img.decode().catch(() => undefined)))
  })
  await page.evaluate(() => new Promise(resolve => {
    let remaining = 2
    const settle = () => { remaining -= 1; remaining > 0 ? requestAnimationFrame(settle) : resolve() }
    requestAnimationFrame(settle)
  }))
}

// Body-wide: overlays, dialogs and toasts are part of the user-visible result.
async function signature(page) {
  return page.evaluate(() => ({
    href: location.href,
    htmlLength: document.body.innerHTML.length,
    text: document.body.innerText.slice(0, 60000),
  }))
}

async function context(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => out.errors.push({ message: error.message }))
  return { ctx, page }
}

async function measureLoad(route, kind, run) {
  // A virgin browser per load sample: sharing one instance across the whole suite
  // inflated every later sample and, for these routes, eventually stalled the mount.
  const browser = await chromium.launch({ headless: true })
  const { ctx, page } = await context(browser)
  let start = performance.now()
  let phase = kind === 'route-switch' ? 'entry-page' : kind === 'refresh' ? 'first-load' : 'target-load'
  try {
    if (kind === 'route-switch') {
      // Precondition: reach the entry page first, then time the switch itself.
      await page.goto(server + route.previous, { waitUntil: 'domcontentloaded' })
      await waitReady(page, route.previousReady)
      start = performance.now()
      phase = 'target-load'
      await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
    } else if (kind === 'refresh') {
      await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
      await waitReady(page, route.ready)
      await page.reload({ waitUntil: 'domcontentloaded' })
    } else {
      await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
    }
    phase = 'target-ready'
    await waitReady(page, route.ready)
    const ms = Number((performance.now() - start).toFixed(2))
    out.samples.push({ route: route.id, path: route.path, kind, run, ms, pass: ms < 500, resultObserved: true })
  } catch (error) {
    const mounted = await page.evaluate(selector => ({
      phase_selector: selector,
      pathname: location.pathname,
      pages: [...document.querySelectorAll('[data-pcs-material-archive-page]')].map(node => node.dataset.pcsMaterialArchivePage),
      targetRect: (() => {
        const node = document.querySelector(selector)
        if (!node) return null
        const rect = node.getBoundingClientRect()
        return { width: Math.round(rect.width), height: Math.round(rect.height), display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility }
      })(),
      pendingImages: [...document.querySelectorAll('img')].filter(img => !(img.complete && img.naturalWidth > 0)).length,
      bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 60),
    }), phase === 'target-ready' ? route.ready : route.previousReady ?? route.ready).catch(() => null)
    out.samples.push({ route: route.id, path: route.path, kind, run, phase, ms: Number((performance.now() - start).toFixed(2)), pass: false, resultObserved: false, error: String(error).split('\n')[0], mounted })
  } finally { await ctx.close(); await browser.close() }
  write()
}

async function discover(page) {
  return page.evaluate(() => {
    const wanted = new Set(['query', 'reset', 'export', 'prev-page', 'next-page', 'sort-column', 'open-column-settings', 'close-column-settings', 'toggle-column-visibility', 'toggle-column-freeze', 'restore-column-settings', 'open-create', 'close-drawers', 'set-detail-tab', 'open-sku-create', 'open-log', 'open-barcode', 'close-notice'])
    const fields = new Set(['pageSize'])
    const result = []
    for (const el of document.querySelectorAll('button, select, input[type="checkbox"], a[data-nav]')) {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height || el.matches(':disabled')) continue
      if (el.tagName === 'A' && el.hasAttribute('data-nav')) {
        result.push({ key: 'nav-detail', attr: 'data-nav', value: el.getAttribute('data-nav'), tag: el.tagName.toLowerCase(), text: '进入详情' })
        continue
      }
      for (const attr of el.attributes) {
        if (!attr.name.startsWith('data-pcs-material-archive-')) continue
        const isAction = attr.name === 'data-pcs-material-archive-action'
        const isField = attr.name === 'data-pcs-material-archive-field'
        if (!isAction && !isField) continue
        if (isAction && !wanted.has(attr.value)) continue
        if (isField && !fields.has(attr.value)) continue
        if (isField && el.value !== undefined && el.tagName === 'SELECT' && ![...el.options].some(option => option.value === '5')) continue
        result.push({
          key: attr.value === 'set-detail-tab' ? 'detail-tab' : `${attr.name}=${attr.value}`,
          attr: attr.name,
          value: attr.value,
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24),
        })
      }
    }
    const preview = document.querySelector('[data-pda-image-preview-url]')
    if (preview) result.push({ key: 'image-preview', attr: 'data-pda-image-preview-url', value: preview.getAttribute('data-pda-image-preview-url'), tag: 'button', text: '查看大图' })
    const sort = document.querySelector('[data-pcs-material-archive-list-region] th [data-pcs-material-archive-action="sort-column"]')
      || document.querySelector('th [data-pcs-material-archive-action="sort-column"]')
    if (sort) result.push({ key: 'sort-column', attr: 'data-pcs-material-archive-action', value: 'sort-column', tag: sort.tagName.toLowerCase(), text: `排序 ${sort.getAttribute('data-column-key') || ''}` })
    return [...new Map(result.map(item => [item.key, item])).values()]
  })
}

// Preconditions are separate gated scenarios of their own; the clock for the action
// under measurement starts only after they settle. Each precondition also guarantees that
// the measured action has an observable result (a no-op click cannot be timed honestly).
async function prepareAction(page, route, descriptor) {
  const realCode = await page.evaluate(() => {
    const cell = document.querySelector('[data-pcs-material-archive-list-region] tbody tr td button[data-nav]')
    return cell ? cell.textContent.trim() : ''
  })
  const settled = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const clickQuery = async value => {
    await page.locator(`[data-pcs-material-archive-field="filter-search-${route.kind}"]`).fill(value)
    await page.locator('[data-pcs-material-archive-action="query"]').click()
    await page.waitForTimeout(80)
    await settled()
  }

  if (descriptor.value === 'query' && realCode) {
    // Start from an empty result so the measured query visibly restores rows.
    await clickQuery('ZZZ-不存在的关键词')
  }
  if (descriptor.value === 'reset') {
    await clickQuery(realCode || 'ZZZ-不存在的关键词')
  }
  if (descriptor.value === 'prev-page') {
    await page.locator('[data-pcs-material-archive-action="next-page"]').click().catch(() => undefined)
    await page.waitForTimeout(60)
  }
  if (descriptor.value === 'toggle-column-visibility' || descriptor.value === 'toggle-column-freeze' || descriptor.value === 'restore-column-settings') {
    await page.locator('[data-pcs-material-archive-action="open-column-settings"]').click()
    await page.waitForTimeout(60)
  }
  if (descriptor.key === 'detail-tab') {
    await page.locator('[data-pcs-material-archive-action="set-detail-tab"][data-value="overview"]').click().catch(() => undefined)
    await page.waitForTimeout(60)
  }
  return { realCode }
}

async function measureAction(browser, route, descriptor, run) {
  const { ctx, page } = await context(browser)
  const start = performance.now()
  try {
    await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
    await waitReady(page, route.ready)
    const prepared = await prepareAction(page, route, descriptor)
    if (descriptor.value === 'query' && prepared?.realCode) {
      // Reading and typing are the user's time; only the confirmation is timed.
      await page.locator(`[data-pcs-material-archive-field="filter-search-${route.kind}"]`).fill(prepared.realCode)
    }
    const clockFrom = performance.now()
    const before = await signature(page)
    const locator = descriptor.key === 'image-preview'
      ? page.locator('[data-pda-image-preview-url]').first()
      : descriptor.key === 'nav-detail'
        ? page.locator('td button[data-nav]').first()
        : descriptor.key === 'sort-column'
          ? page.locator('th [data-pcs-material-archive-action="sort-column"]').first()
          : descriptor.key === 'detail-tab'
            ? page.locator('[data-pcs-material-archive-action="set-detail-tab"][data-value="skus"]')
            : descriptor.value === 'toggle-column-visibility'
            ? page.locator('[data-pcs-material-archive-columns-region] input[data-pcs-material-archive-action="toggle-column-visibility"]').last()
            : descriptor.value === 'toggle-column-freeze'
              ? page.locator('[data-pcs-material-archive-columns-region] input[data-pcs-material-archive-action="toggle-column-freeze"]').last()
              : page.locator(`${descriptor.tag}[${descriptor.attr}="${descriptor.value}"]`).first()
    if (descriptor.attr === 'data-pcs-material-archive-field') await locator.selectOption('10')
    else await locator.click()
    await page.waitForFunction(previous => (
      location.href !== previous.href
      || document.body.innerHTML.length !== previous.htmlLength
      || document.body.innerText.slice(0, 60000) !== previous.text
    ), before, { timeout: 1200 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const ms = Number((performance.now() - clockFrom).toFixed(2))
    out.samples.push({
      route: route.id, path: route.path, kind: `interaction:${descriptor.text || descriptor.value}`,
      action: descriptor.key, run, ms, totalWindowMs: Number((performance.now() - start).toFixed(2)),
      pass: ms < 500, resultObserved: true,
    })
  } catch (error) {
    out.samples.push({
      route: route.id, path: route.path, kind: `interaction:${descriptor.text || descriptor.value}`,
      action: descriptor.key, run, ms: Number((performance.now() - start).toFixed(2)),
      pass: false, resultObserved: false, error: String(error).split('\n')[0],
    })
  } finally { await ctx.close() }
  write()
}

const withBrowser = async body => {
  const browser = await chromium.launch({ headless: true })
  try { await body(browser) } finally { await browser.close() }
}

for (const route of (process.env.ARCHIVE_ROUTE ? routes.filter(route => route.id === process.env.ARCHIVE_ROUTE) : routes)) {
  for (let run = 1; run <= 5; run += 1) await measureLoad(route, 'cold-navigation', run)
  for (let run = 1; run <= 5; run += 1) await measureLoad(route, 'refresh', run)
  if (route.previous) for (let run = 1; run <= 5; run += 1) await measureLoad(route, 'route-switch', run)
  let descriptors = []
  let recordCount = 0
  await withBrowser(async browser => {
    const { ctx, page } = await context(browser)
    try {
      await page.goto(server + route.path, { waitUntil: 'domcontentloaded' })
      await waitReady(page, route.ready)
      descriptors = await discover(page)
      recordCount = await page.evaluate(() => Number((document.querySelector('[data-pcs-material-archive-pagination-region] p')?.innerText.match(/共 (\d+) 条/) ?? [])[1] ?? 0))
    } finally { await ctx.close() }
  })
  await withBrowser(async browser => {
    for (const descriptor of descriptors) {
      // Record, never silently skip: a page-size switch cannot change the rendered
      // result when the route holds no more records than the current page.
      if (descriptor.value === 'pageSize' && recordCount <= 5) {
        out.actionCoverage.push({
          route: route.id, entry: descriptor.key, label: descriptor.text, applicable: false,
          reason: `该路由真实记录 ${recordCount} 条，不足一个分页，切换每页条数没有可观察结果；分页与持久化在辅料档案（6 条）上出具 5 次实测。`,
        })
        continue
      }
      const from = out.samples.length
      for (let run = 1; run <= 5; run += 1) await measureAction(browser, route, descriptor, run)
      const samples = out.samples.slice(from, from + 5)
      out.actionCoverage.push({
        route: route.id,
        entry: descriptor.key,
        label: descriptor.text || descriptor.value,
        runs: samples.length,
        passed: samples.length === 5 && samples.every(sample => sample.pass && sample.resultObserved),
        sampleMaxMs: samples.length ? Math.max(...samples.map(sample => sample.ms)) : null,
        failures: samples.filter(sample => !sample.pass).map(sample => ({ run: sample.run, ms: sample.ms, error: sample.error ?? null })),
      })
    }
    out.coverage.push({ route: route.id, cold: 5, refresh: 5, routeSwitch: route.previous ? 5 : 0, interactiveEntries: descriptors.length })
  })
}

const failed = out.samples.filter(sample => !sample.pass || !sample.resultObserved)
const measuredEntries = out.actionCoverage.filter(item => item.applicable !== false)
const notApplicable = out.actionCoverage.filter(item => item.applicable === false)
out.summary = {
  samples: out.samples.length,
  failed: failed.length,
  maxMs: out.samples.length ? Math.max(...out.samples.map(sample => sample.ms)) : null,
  pageErrors: out.errors.length,
  routes: out.coverage.length,
  interactiveEntries: measuredEntries.length,
  interactiveNotApplicable: notApplicable.length,
  interactiveFailures: measuredEntries.filter(item => !item.passed).length,
  strictGate: failed.length === 0 && out.errors.length === 0 && measuredEntries.every(item => item.passed),
}
write()
console.log(JSON.stringify(out.summary))
out.actionCoverage.filter(item => item.applicable !== false && !item.passed).slice(0, 10)
  .forEach(item => console.log('ENTRY FAIL', item.route, item.label, item.sampleMaxMs, JSON.stringify((item.failures ?? [])[0] ?? null)))
failed.slice(0, 10).forEach(sample => console.log('SAMPLE FAIL', sample.route, sample.kind, sample.ms, sample.error ?? ''))
