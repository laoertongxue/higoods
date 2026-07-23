import assert from 'node:assert/strict'
import { createServer as createNetServer } from 'node:net'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'

type ProcessKind = 'PRINT' | 'DYE'

const processKind = process.argv[2] as ProcessKind
assert.ok(processKind === 'PRINT' || processKind === 'DYE', '必须传入 PRINT 或 DYE')

const config = processKind === 'PRINT'
  ? {
      path: '/fcs/process/print-orders',
      root: '[data-process-print-orders-root]',
      fieldPrefix: 'print-order',
      listPrefix: 'print-order-list',
      detailTitle: '平台印花加工单',
      preferenceKey: '/fcs/process/print-orders:list-columns',
    }
  : {
      path: '/fcs/process/dye-orders',
      root: '[data-process-dye-orders-root]',
      fieldPrefix: 'dye-order',
      listPrefix: 'dye-order-list',
      detailTitle: '平台染色加工单',
      preferenceKey: '/fcs/process/dye-orders:list-columns',
    }

async function allocatePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createNetServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('无法分配浏览器测试端口'))
      const port = address.port
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function rowTexts(page: Page): Promise<string[]> {
  return page.locator(`${config.root} [data-standard-list-table-section] tbody tr`).allTextContents()
}

async function checkFactoryPrintingPage(page: Page, port: number): Promise<void> {
  const factoryPath = '/fcs/craft/printing/work-orders'
  const factoryRoot = '[data-printing-work-orders-root]'
  await page.goto(`http://127.0.0.1:${port}${factoryPath}`)
  await page.locator(factoryRoot).waitFor({ timeout: 90_000 })
  await page.evaluate(() => localStorage.removeItem('/fcs/craft/printing/work-orders:list-columns'))
  await page.reload()
  await page.locator(factoryRoot).waitFor({ timeout: 90_000 })

  await page.evaluate(({ factoryRoot }) => {
    const workspace = document.querySelector(`${factoryRoot} [data-printing-work-orders-workspace]`)
    if (!workspace) throw new Error('工厂印花页缺少预热区域')
    const testWindow = window as typeof window & { __factoryPrintingWarmDone?: boolean }
    testWindow.__factoryPrintingWarmDone = false
    new MutationObserver((_records, observer) => {
      testWindow.__factoryPrintingWarmDone = true
      observer.disconnect()
    }).observe(workspace, { childList: true, subtree: true })
  }, { factoryRoot })
  await page.getByRole('button', { name: '重置' }).click()
  await page.waitForFunction(() => (window as typeof window & { __factoryPrintingWarmDone?: boolean }).__factoryPrintingWarmDone === true)
  await page.locator('[data-printing-work-orders-field="sourceType"]').selectOption('STOCK')
  await page.evaluate(({ factoryRoot }) => {
    const root = document.querySelector(factoryRoot)
    const workspace = root?.querySelector('[data-printing-work-orders-workspace]')
    const filters = root?.querySelector('[data-printing-work-orders-filters-surface]')
    const tableSurface = root?.querySelector('[data-printing-work-orders-table-surface]')
    const paginationSurface = root?.querySelector('[data-printing-work-orders-pagination-surface]')
    if (!root || !workspace || !filters || !tableSurface || !paginationSurface) throw new Error('工厂印花页缺少稳定性检查区域')
    const testWindow = window as typeof window & {
      __factoryPrintingStable?: { root: Element; workspace: Element; filters: Element; tableSurface: Element; paginationSurface: Element; startedAt: number; duration: number }
    }
    testWindow.__factoryPrintingStable = { root, workspace, filters, tableSurface, paginationSurface, startedAt: 0, duration: 0 }
    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-printing-work-orders-action="apply-filter"]') : null
      if (target && testWindow.__factoryPrintingStable) testWindow.__factoryPrintingStable.startedAt = performance.now()
    }, { capture: true })
    new MutationObserver(() => {
      const state = testWindow.__factoryPrintingStable
      if (state?.startedAt && !state.duration) state.duration = performance.now() - state.startedAt
    }).observe(workspace, { childList: true, subtree: true })
  }, { factoryRoot })

  await page.getByRole('button', { name: '查询' }).click()
  await page.waitForFunction(({ factoryRoot }) => {
    const rows = [...document.querySelectorAll(`${factoryRoot} [data-standard-list-table-section] tbody tr`)]
    return rows.length > 0 && rows.every((row) => row.textContent?.includes('备货手动创建'))
  }, { factoryRoot }, { timeout: 90_000 })
  const stable = await page.evaluate(({ factoryRoot }) => {
    const state = (window as typeof window & {
      __factoryPrintingStable?: { root: Element; workspace: Element; filters: Element; tableSurface: Element; paginationSurface: Element; duration: number }
    }).__factoryPrintingStable
    if (!state) throw new Error('缺少工厂印花稳定性状态')
    const root = document.querySelector(factoryRoot)
    return {
      rootSame: root === state.root,
      workspaceSame: root?.querySelector('[data-printing-work-orders-workspace]') === state.workspace,
      filtersSame: root?.querySelector('[data-printing-work-orders-filters-surface]') === state.filters,
      tableSurfaceSame: root?.querySelector('[data-printing-work-orders-table-surface]') === state.tableSurface,
      paginationSurfaceSame: root?.querySelector('[data-printing-work-orders-pagination-surface]') === state.paginationSurface,
      duration: state.duration,
    }
  }, { factoryRoot })
  assert.deepEqual({ ...stable, duration: undefined }, { rootSame: true, workspaceSame: true, filtersSame: true, tableSurfaceSame: true, paginationSurfaceSame: true, duration: undefined }, '工厂印花筛选不得替换工作区及稳定区域')
  assert.ok(stable.duration > 0 && stable.duration < 200, `工厂印花筛选局部响应应低于 200ms，实际 ${stable.duration.toFixed(1)}ms`)

  await page.getByRole('button', { name: '重置' }).click()
  const firstPageRows = await page.locator(`${factoryRoot} [data-standard-list-table-section] tbody tr`).allTextContents()
  await page.locator('[data-printing-work-orders-action="next-page"]').click()
  await page.waitForFunction(({ factoryRoot }) => document.querySelector(`${factoryRoot} [data-standard-list-table-section] footer span`)?.textContent?.trim().startsWith('2 /'), { factoryRoot })
  assert.notDeepEqual(await page.locator(`${factoryRoot} [data-standard-list-table-section] tbody tr`).allTextContents(), firstPageRows, '工厂印花下一页必须更新行')

  await page.getByRole('button', { name: '列设置' }).click()
  await page.getByRole('heading', { name: '印花加工单列设置' }).waitFor()
  assert.equal(await page.locator(`${factoryRoot} [data-standard-list-table-section]`).count(), 1, '工厂印花列设置不得复制表格区域')
  await page.getByRole('button', { name: '关闭' }).last().click()

  await page.locator(`${factoryRoot} [data-standard-list-table-section] tbody tr`).first().getByRole('button', { name: '查看详情' }).click()
  await page.waitForURL(/\/fcs\/craft\/printing\/work-orders\//)
  assert.match(page.url(), /\/fcs\/craft\/printing\/work-orders\//, '工厂印花详情入口必须进入真实加工单详情')
  console.log(`[check-platform-process-order-events] FACTORY_PRINT passed on ${port}`)
}

const port = await allocatePort()
const vite = await createServer({
  root: process.cwd(),
  logLevel: 'error',
  server: { host: '127.0.0.1', port, strictPort: true },
})
await vite.listen()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
page.on('pageerror', (error) => console.error(`[check-platform-process-order-events] pageerror: ${error.message}`))

try {
  await page.goto(`http://127.0.0.1:${port}${config.path}`)
  await page.evaluate((key) => localStorage.removeItem(key), config.preferenceKey)
  await page.reload()

  const main = page.locator('main')
  await main.evaluate((node) => { node.dataset.platformProcessDomMarker = 'stable' })
  const assertStableMain = async (step: string) => {
    assert.equal(await main.getAttribute('data-platform-process-dom-marker'), 'stable', `${processKind} 平台${step}不得整页重绘`)
  }

  await page.locator(`[data-${config.fieldPrefix}-field="sourceFilter"]`).evaluate((node: HTMLSelectElement) => {
    node.value = 'STOCK'
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(({ root }) => {
    const rows = [...document.querySelectorAll(`${root} [data-standard-list-table-section] tbody tr`)]
    return rows.length > 0 && rows.every((row) => row.textContent?.includes('备货手动创建'))
  }, { root: config.root }, { timeout: 90_000 })
  const stockRows = await rowTexts(page)
  assert.ok(stockRows.length > 0, `${processKind} 平台来源筛选后应保留备货单`)
  assert.ok(stockRows.every((text) => text.includes('备货手动创建')), `${processKind} 平台 STOCK 筛选不得混入其他来源`)
  await assertStableMain('筛选')

  await page.locator(`[data-${config.fieldPrefix}-field="sourceFilter"]`).evaluate((node: HTMLSelectElement) => {
    node.value = ''
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await assertStableMain('清空筛选')
  const pageSizeField = page.locator(`[data-${config.listPrefix}-field="pageSize"]`)
  await pageSizeField.selectOption('20')
  await page.waitForFunction(({ root }) => document.querySelectorAll(`${root} [data-standard-list-table-section] tbody tr`).length > 10, { root: config.root })
  assert.equal(await pageSizeField.inputValue(), '20', `${processKind} 平台每页条数必须立即生效`)
  await assertStableMain('切换20条每页')
  await pageSizeField.selectOption('10')
  await page.waitForFunction(({ root }) => document.querySelectorAll(`${root} [data-standard-list-table-section] tbody tr`).length === 10, { root: config.root })
  await assertStableMain('切换10条每页')
  const firstPageRows = await rowTexts(page)
  const nextButton = page.locator(`[data-${config.listPrefix}-action="next-page"]`)
  assert.equal(await nextButton.isEnabled(), true, `${processKind} 平台真实数据应支持下一页`)
  await nextButton.click()
  await page.waitForFunction(({ root }) => document.querySelector(`${root} [data-standard-list-table-section] footer span`)?.textContent?.trim().startsWith('2 /'), { root: config.root })
  const secondPageRows = await rowTexts(page)
  assert.notDeepEqual(secondPageRows, firstPageRows, `${processKind} 平台下一页必须更新列表行`)
  assert.match(await page.locator(`${config.root} [data-standard-list-table-section] footer span`).innerText(), /^2 \/ /, `${processKind} 平台下一页必须更新页码`)
  await assertStableMain('分页')

  await page.locator(`${config.root} [data-column-key="orderNo"] button`).click()
  await page.waitForFunction(({ root }) => document.querySelector(`${root} [data-column-key="orderNo"]`)?.getAttribute('aria-sort') === 'ascending', { root: config.root })
  assert.equal(await page.locator(`${config.root} th[data-column-key="orderNo"]`).getAttribute('aria-sort'), 'ascending', `${processKind} 平台排序必须立即生效`)

  await page.getByRole('button', { name: '列设置' }).click()
  await page.getByRole('heading', { name: `${processKind === 'PRINT' ? '印花' : '染色'}加工单列设置` }).waitFor()
  assert.equal(await page.getByRole('heading', { name: `${processKind === 'PRINT' ? '印花' : '染色'}加工单列设置` }).isVisible(), true, `${processKind} 平台列设置必须打开`)
  const sourceSetting = page.locator(`[data-${config.listPrefix}-column-key="source"]`).first()
  await sourceSetting.locator(`input[data-${config.listPrefix}-action="toggle-column-freeze"]`).click()
  await page.waitForFunction(({ root }) => document.querySelector<HTMLElement>(`${root} th[data-column-key="source"]`)?.style.left === '180px', { root: config.root })
  assert.ok((await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').frozenKeys as string[], config.preferenceKey)).includes('source'), `${processKind} 平台冻结列必须持久化并立即生效`)

  const riskSetting = page.locator(`[data-${config.listPrefix}-column-key="risk"]`).first()
  const factorySetting = page.locator(`[data-${config.listPrefix}-column-key="factory"]`).first()
  await riskSetting.dragTo(factorySetting)
  await page.waitForFunction(({ root }) => {
    const keys = [...document.querySelectorAll(`${root} th[data-column-key]`)].map((node) => node.getAttribute('data-column-key'))
    return keys.indexOf('risk') >= 0 && keys.indexOf('risk') < keys.indexOf('factory')
  }, { root: config.root })
  const storedOrder = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').order as string[], config.preferenceKey)
  assert.ok(storedOrder.indexOf('risk') < storedOrder.indexOf('factory'), `${processKind} 平台拖拽列顺序必须持久化并立即生效`)

  await page.locator(`[data-${config.listPrefix}-column-key="risk"]`).first().locator(`input[data-${config.listPrefix}-action="toggle-column-visibility"]`).click()
  await page.locator(`${config.root} th[data-column-key="risk"]`).waitFor({ state: 'detached' })
  assert.equal(await page.locator(`${config.root} th[data-column-key="risk"]`).count(), 0, `${processKind} 平台列显隐必须立即生效`)

  await page.getByRole('button', { name: '关闭' }).last().click()
  await page.locator(`${config.root} [data-standard-list-table-section] tbody tr`).first().getByRole('button', { name: '查看' }).click()
  await page.getByText(config.detailTitle, { exact: true }).waitFor()
  assert.equal(await page.getByText(config.detailTitle, { exact: true }).isVisible(), true, `${processKind} 平台详情入口必须打开抽屉`)
  await assertStableMain('详情入口')

  if (processKind === 'PRINT') await checkFactoryPrintingPage(page, port)

  console.log(`[check-platform-process-order-events] ${processKind} passed on ${port}`)
} finally {
  await browser.close()
  await vite.close()
}
