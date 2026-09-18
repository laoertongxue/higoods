import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const baseUrl = process.env.TECH_PACK_BOM_BASE_URL
  || 'http://127.0.0.1:4176/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo'
const sampleCount = 5
const limitMs = 200

function assertSamplesBelowLimit(label, samples) {
  assert.equal(samples.length, sampleCount, `${label}必须保留 ${sampleCount} 次原始样本`)
  const max = Math.max(...samples)
  assert.ok(max < limitMs, `${label}最大耗时 ${max}ms，必须严格低于 ${limitMs}ms`)
}

async function measureBomTab(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const button = document.querySelector('[data-tech-action="switch-tab"][data-tab="bom"]')
    if (!(button instanceof HTMLElement)) {
      reject(new Error('未找到物料清单 Tab'))
      return
    }
    const startedAt = performance.now()
    const finish = async () => {
      const table = document.querySelector('[data-testid="tech-pack-regular-bom-table"]')
      if (!(table instanceof HTMLElement)) return false
      const image = table.querySelector('img')
      if (image instanceof HTMLImageElement && !image.complete) {
        await new Promise((done) => {
          image.addEventListener('load', done, { once: true })
          image.addEventListener('error', done, { once: true })
        })
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        resolve(Number((performance.now() - startedAt).toFixed(2)))
      }))
      return true
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-testid="tech-pack-regular-bom-table"]')) {
        observer.disconnect()
        void finish()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    button.click()
    void finish().then((done) => {
      if (done) observer.disconnect()
    })
    setTimeout(() => {
      observer.disconnect()
      reject(new Error('物料清单 Tab 响应超时'))
    }, 2_000)
  }))
}

async function measureScroll(page) {
  return page.evaluate(async () => {
    const container = document.querySelector('[data-testid="tech-pack-regular-bom-table"]')
    if (!(container instanceof HTMLElement)) throw new Error('未找到物料清单表格容器')
    const startedAt = performance.now()
    container.scrollLeft = container.scrollWidth
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    return Number((performance.now() - startedAt).toFixed(2))
  })
}

async function measurePreview(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const button = document.querySelector('[data-tech-action="open-material-image-preview"]')
    if (!(button instanceof HTMLElement)) {
      reject(new Error('未找到物料图片预览按钮'))
      return
    }
    const startedAt = performance.now()
    const finish = async () => {
      const image = document.querySelector('#tech-pack-pattern-image-preview-modal img')
      if (!(image instanceof HTMLImageElement)) return false
      if (!image.complete) {
        await new Promise((done) => {
          image.addEventListener('load', done, { once: true })
          image.addEventListener('error', done, { once: true })
        })
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        resolve(Number((performance.now() - startedAt).toFixed(2)))
      }))
      return true
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector('#tech-pack-pattern-image-preview-modal img')) {
        observer.disconnect()
        void finish()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    button.click()
    void finish().then((done) => {
      if (done) observer.disconnect()
    })
    setTimeout(() => {
      observer.disconnect()
      reject(new Error('物料图片大图响应超时'))
    }, 2_000)
  }))
}

async function readLayout(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="tech-pack-regular-bom-table"]')
    const table = container?.querySelector('table')
    const firstCells = table ? Array.from(table.querySelectorAll('tbody tr:first-child td')).slice(0, 3) : []
    if (!(container instanceof HTMLElement) || !(table instanceof HTMLTableElement)) {
      throw new Error('物料清单表格未就绪')
    }
    container.scrollLeft = container.scrollWidth
    const actionCell = table.querySelector('tbody tr:first-child td:last-child')
    const containerRect = container.getBoundingClientRect()
    const actionRect = actionCell?.getBoundingClientRect()
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      containerWidth: Math.round(containerRect.width),
      tableWidth: Math.round(table.getBoundingClientRect().width),
      scrollWidth: container.scrollWidth,
      maxScrollLeft: container.scrollWidth - container.clientWidth,
      firstCellWidths: firstCells.map((cell) => Math.round(cell.getBoundingClientRect().width)),
      firstCellOverflow: firstCells.map((cell) => cell.scrollWidth - cell.clientWidth),
      actionVisibleAtRight: Boolean(actionRect && actionRect.left >= containerRect.left && actionRect.right <= containerRect.right + 1),
    }
  })
}

const browser = await chromium.launch({ headless: true })
const results = {
  environment: {
    baseUrl,
    browser: 'Chromium headless',
    viewport: '1366x768',
    cache: '每个首次进入样本使用全新 BrowserContext',
    sampleCount,
    limitMs,
  },
  navigation: [],
  reload: [],
  tab: [],
  scroll: [],
  preview: [],
  layout: {},
}

try {
  for (let index = 0; index < sampleCount; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const page = await context.newPage()

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: /技术包版本/ }).waitFor()
    results.navigation.push(await page.evaluate(() => Number(performance.now().toFixed(2))))

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: /技术包版本/ }).waitFor()
    results.reload.push(await page.evaluate(() => Number(performance.now().toFixed(2))))

    results.tab.push(await measureBomTab(page))
    results.scroll.push(await measureScroll(page))
    results.preview.push(await measurePreview(page))
    await context.close()
  }

  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 900 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: /技术包版本/ }).waitFor()
    await measureBomTab(page)
    results.layout[`${viewport.width}x${viewport.height}`] = await readLayout(page)
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(results, null, 2))

for (const [label, samples] of Object.entries({
  '首次进入': results.navigation,
  '整页刷新': results.reload,
  '切换物料清单': results.tab,
  '表格横向滚动': results.scroll,
  '查看物料大图': results.preview,
})) {
  assertSamplesBelowLimit(label, samples)
}

for (const [viewport, layout] of Object.entries(results.layout)) {
  assert.equal(layout.documentWidth, layout.viewportWidth, `${viewport} 页面主体不得横向溢出`)
  assert.ok(layout.tableWidth >= 2_180, `${viewport} 表格宽度必须保留 18 列可读空间`)
  assert.ok(layout.scrollWidth > layout.containerWidth, `${viewport} 宽表必须在表格容器内部滚动`)
  assert.deepEqual(layout.firstCellWidths, [181, 157, 133], `${viewport} SPU、颜色和成本列宽不符合基线`)
  assert.ok(layout.firstCellOverflow.every((value) => value <= 0), `${viewport} 首组单元格存在内容重叠`)
  assert.equal(layout.actionVisibleAtRight, true, `${viewport} 横向滚动后操作列必须完整可见`)
}

console.log('check-tech-pack-bom-table-layout-performance PASS')
