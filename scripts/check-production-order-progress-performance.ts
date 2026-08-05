import { chromium, type Page } from '@playwright/test'

const baseUrl = process.argv[2] || process.env.HIGOOD_BASE_URL || 'http://127.0.0.1:5174'
const thresholdMs = Number(process.env.HIGOOD_INTERACTION_THRESHOLD_MS || 200)

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

async function assertServerReady(): Promise<void> {
  try {
    const response = await fetch(baseUrl)
    assert(response.ok, `本地服务不可达：${baseUrl} 返回 ${response.status}`)
  } catch (error) {
    throw new Error(`本地服务不可达：${baseUrl}。请先启动 npm run dev -- --host 0.0.0.0 --port 5174。${String(error)}`)
  }
}

async function markRenderSentinel(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector('[data-production-order-progress-page]')?.setAttribute('data-render-sentinel', 'keep')
  })
}

async function assertRenderSentinelKept(page: Page, name: string): Promise<void> {
  const kept = await page.evaluate(() => document.querySelector('[data-production-order-progress-page]')?.getAttribute('data-render-sentinel') === 'keep')
  assert(kept, `${name} 触发了页面根节点替换，不符合局部交互要求`)
}

async function measureInteraction(
  page: Page,
  name: string,
  action: () => Promise<void>,
  waitForDone: () => Promise<void>,
): Promise<number> {
  await markRenderSentinel(page)
  const startedAt = await page.evaluate(() => performance.now())
  await action()
  await waitForDone()
  const duration = await page.evaluate((start) => performance.now() - start, startedAt)
  await assertRenderSentinelKept(page, name)
  assert(duration <= thresholdMs, `${name} 响应耗时 ${duration.toFixed(1)}ms，超过 ${thresholdMs}ms`)
  return duration
}

async function main(): Promise<void> {
  await assertServerReady()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1792, height: 1048 } })
  const results: Array<[string, number]> = []

  await page.goto(`${baseUrl}/fcs/production_order_track/index`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-production-order-progress-page]')
  // 等待异步页面模块完成首次挂载，避免把初始化替换误判成用户交互重绘。
  await page.waitForTimeout(300)

  results.push([
    '列表展开行',
    await measureInteraction(
      page,
      '列表展开行',
      () => page.locator('[data-progress-action="expand"][data-order-id="PO16234"]').click(),
      () => page.waitForSelector('[data-expanded-order="PO16234"]'),
    ),
  ])

  results.push([
    '列表展开行收起',
    await measureInteraction(
      page,
      '列表展开行收起',
      () => page.locator('[data-progress-action="expand"][data-order-id="PO16234"]').click(),
      () => page.waitForSelector('[data-expanded-order="PO16234"]', { state: 'detached' }),
    ),
  ])

  results.push([
    '详情弹窗打开',
    await measureInteraction(page, '详情弹窗打开', () => page.locator('[data-progress-action="detail"][data-order-id="PO16234"]').click(), () => page.getByRole('heading', { name: 'PO16234 生产进度详情' }).waitFor()),
  ])
  results.push([
    '详情弹窗关闭',
    await measureInteraction(page, '详情弹窗关闭', () => page.locator('[data-progress-action="close-detail"]').last().click(), () => page.getByRole('heading', { name: 'PO16234 生产进度详情' }).waitFor({ state: 'detached' })),
  ])
  results.push([
    '下一页',
    await measureInteraction(page, '下一页', () => page.locator('[data-production-progress-action="next-page"]').click(), () => page.waitForFunction(() => document.body.textContent?.includes('共 43 条，第 2 页 / 共 3 页'))),
  ])
  results.push([
    '上一页',
    await measureInteraction(page, '上一页', () => page.locator('[data-production-progress-action="prev-page"]').click(), () => page.waitForFunction(() => document.body.textContent?.includes('共 43 条，第 1 页 / 共 3 页'))),
  ])
  results.push([
    '生产单号筛选',
    await measureInteraction(page, '生产单号筛选', () => page.locator('[data-progress-field="keyword"]').fill('PO16234'), () => page.waitForFunction(() => document.querySelectorAll('[data-progress-action="detail"]').length === 1)),
  ])

  await browser.close()

  console.log(
    [
      `生产单进度跟踪交互性能验收通过（阈值 ${thresholdMs}ms）`,
      ...results.map(([name, duration]) => `${name}: ${duration.toFixed(1)}ms`),
    ].join('\n'),
  )
}

void main()
