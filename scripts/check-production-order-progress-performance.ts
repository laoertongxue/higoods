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
    document.querySelector('[data-production-order-progress-root]')?.setAttribute('data-render-sentinel', 'keep')
  })
}

async function assertRenderSentinelKept(page: Page, name: string): Promise<void> {
  const kept = await page.evaluate(() => document.querySelector('[data-production-order-progress-root]')?.getAttribute('data-render-sentinel') === 'keep')
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

  await page.goto(`${baseUrl}/fcs/progress/production-orders/detail?po=SO-PRD-202606-0018&tab=overview`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-production-order-progress-root][data-page-mode="detail"]')

  const tabCases: Array<[string, string]> = [
    ['详情页 Tab 切换到时间追踪', 'timeline'],
    ['详情页 Tab 切换到数量流转', 'quantity'],
    ['详情页 Tab 切换到工单与分支', 'workorders'],
    ['详情页 Tab 切换到交接与质检', 'handover'],
    ['详情页 Tab 切换到结算与复盘', 'settlement'],
    ['详情页 Tab 切回概览', 'overview'],
    ['详情页 Tab 再切到数量流转', 'quantity'],
  ]

  for (const [name, tab] of tabCases) {
    results.push([
      name,
      await measureInteraction(
        page,
        name,
        () => page.locator(`[data-production-order-progress-action="switch-tab"][data-tab="${tab}"]`).click(),
        () => page.waitForFunction((expectedTab) =>
          document.querySelector('[data-production-order-progress-root]')?.getAttribute('data-active-tab') === expectedTab,
        tab),
      ),
    ])
  }

  results.push([
    '数量流转节点切换',
    await measureInteraction(
      page,
      '数量流转节点切换',
      () => page.locator('[data-production-order-progress-action="select-node"][data-node="spreading-a"]').click(),
      () => page.waitForFunction(() =>
        Array.from(document.querySelectorAll('aside h3')).some((node) => node.textContent?.includes('铺布批次 A')),
      ),
    ),
  ])

  results.push([
    '详情页弹窗打开',
    await measureInteraction(
      page,
      '详情页弹窗打开',
      () => page.locator('[data-modal-title="关联数量记录"]').click(),
      () => page.waitForSelector('[data-production-order-progress-modal]'),
    ),
  ])

  results.push([
    '详情页弹窗关闭',
    await measureInteraction(
      page,
      '详情页弹窗关闭',
      () => page.locator('[data-production-order-progress-action="close-modal"]').last().click(),
      () => page.waitForSelector('[data-production-order-progress-modal]', { state: 'detached' }),
    ),
  ])

  await page.goto(`${baseUrl}/fcs/progress/production-orders`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-production-order-progress-root][data-page-mode="list"]')

  results.push([
    '列表展开行收起',
    await measureInteraction(
      page,
      '列表展开行收起',
      () => page.locator('[data-production-order-progress-action="toggle-row"][data-order-no="SO-PRD-202606-0018"]').click(),
      () => page.waitForSelector('[data-production-order-expanded-row="SO-PRD-202606-0018"]', { state: 'detached' }),
    ),
  ])

  results.push([
    '列表展开行展开',
    await measureInteraction(
      page,
      '列表展开行展开',
      () => page.locator('[data-production-order-progress-action="toggle-row"][data-order-no="SO-PRD-202606-0018"]').click(),
      () => page.waitForSelector('[data-production-order-expanded-row="SO-PRD-202606-0018"]'),
    ),
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
