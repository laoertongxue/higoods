import assert from 'node:assert/strict'
import { createServer as createNetServer } from 'node:net'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'

async function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function rootIsStable(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const fixture = (window as typeof window & {
      __woolWarehouseFixture?: { root: Element | null }
    }).__woolWarehouseFixture
    return Boolean(fixture?.root && fixture.root.isConnected)
  })
}

async function assertMode(localUrl: string, mode: 'process' | 'handover'): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    await page.goto(new URL(
      `/scripts/fixtures/wool-warehouse-local-interactions.html?mode=${mode}`,
      localUrl,
    ).toString())
    await page.waitForFunction(() => Boolean(
      (window as typeof window & { __woolWarehouseFixture?: unknown }).__woolWarehouseFixture,
    ))
    const root = page.locator('[data-wool-warehouse-root]')
    assert.equal(await root.count(), 1)
    const sortElapsed = await page.evaluate(() => {
      const sortButton = document.querySelector<HTMLElement>(
        '[data-wool-warehouse-action="sort-column"][data-column-key="object"]',
      )
      if (!sortButton) throw new Error('缺少毛织仓库对象列排序按钮')
      const startedAt = performance.now()
      sortButton.click()
      return performance.now() - startedAt
    })
    assert(sortElapsed < 200, `仓库排序交互必须低于 200ms，实际 ${sortElapsed.toFixed(1)}ms`)
    assert(await rootIsStable(page), '排序不得替换毛织仓库页根节点')

    const tabAction = mode === 'process' ? 'tab:issues' : 'tab:inbounds'
    await page.locator(`[data-wool-warehouse-action="${tabAction}"]`).click()
    assert(await rootIsStable(page), 'Tab 切换不得替换毛织仓库页根节点')
    await page.locator('[data-wool-warehouse-action="tab:inventory"]').click()

    const objectFilter = page.locator('[data-wool-warehouse-filter="objectSkuCode"]')
    await objectFilter.fill(mode === 'process' ? 'YARN-A' : 'HG-WOOL')
    await page.waitForTimeout(220)
    assert(await rootIsStable(page), '筛选输入不得替换毛织仓库页根节点')

    await page.getByRole('button', { name: '列设置', exact: true }).click()
    await page.getByText('毛织仓库列设置', { exact: true }).waitFor()
    await page.evaluate(() => {
      const checkbox = document.querySelector<HTMLInputElement>(
        '[data-wool-warehouse-action="toggle-column-visibility"]:not(:disabled)',
      )
      if (!checkbox) throw new Error('缺少可隐藏的毛织仓库列')
      checkbox.click()
    })
    assert(await rootIsStable(page), '列显示切换不得替换毛织仓库页根节点')
    await page.locator(
      '[data-standard-list-column-key="reason"]',
    ).dragTo(page.locator('[data-standard-list-column-key="operator"]'))
    assert(await rootIsStable(page), '列顺序拖拽不得替换毛织仓库页根节点')
    await page.getByRole('button', { name: '恢复默认', exact: true }).click()
    await page.getByRole('button', { name: '关闭', exact: true }).click()

    await page.locator('[data-wool-warehouse-action="open-detail"]').first().click()
    await page.getByText('库存与流水明细', { exact: true }).waitFor()
    assert(await rootIsStable(page), '库存详情不得替换毛织仓库页根节点')
    await page.getByRole('button', { name: '关闭', exact: true }).first().click()

    if (mode === 'process') {
      await page.locator('[data-wool-warehouse-action="open-issue"]').first().click()
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('0.001')
      await page.getByRole('button', { name: '确认纱线领用', exact: true }).click()
      await page.getByText('已为', { exact: false }).first().waitFor()
      assert(await rootIsStable(page), '纱线领用成功不得替换毛织仓库页根节点')
    }
    assert.deepEqual(pageErrors, [], `毛织仓库真实 DOM 不得抛错：${pageErrors.join('；')}`)
  } finally {
    await browser.close()
  }
}

const browserPort = await findFreeLoopbackPort()
process.stdout.write('RUN task 11 browser: wool warehouse local interactions\n')
const server = await createServer({
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: browserPort, strictPort: true },
})
await server.listen()
const localUrl = server.resolvedUrls?.local[0]
if (!localUrl) throw new Error('Vite 未返回毛织仓库检查地址')
try {
  await assertMode(localUrl, 'process')
  process.stdout.write('PASS task 11 browser process mode\n')
  await assertMode(localUrl, 'handover')
  process.stdout.write('PASS task 11 browser: wool warehouse interactions keep roots and refresh local surfaces\n')
} finally {
  await server.close()
}
