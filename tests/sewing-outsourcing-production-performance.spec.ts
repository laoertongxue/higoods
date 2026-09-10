import { expect, test } from '@playwright/test'

const routes = [
  ['/fcs/sewing-outsourcing/workbench', '我的工作台'],
  ['/fcs/sewing-outsourcing/team-workbench', '团队工作台'],
  ['/fcs/sewing-outsourcing/production-order-duration', '生成单全流程耗时'],
  ['/fcs/sewing-outsourcing/tasks', '车缝任务'],
  ['/fcs/sewing-outsourcing/cut-piece-handover', '交出与欠片'],
  ['/fcs/sewing-outsourcing/sample-approval-suggestions', '批版建议'],
  ['/fcs/sewing-outsourcing/returns', '回货跟进'],
  ['/fcs/sewing-outsourcing/supplements', '补料跟进'],
  ['/fcs/sewing-outsourcing/cut-piece-returns', '裁片退仓'],
  ['/fcs/sewing-outsourcing/responsibility-transfers', '责任移交'],
] as const

test('车缝外发协同全部可见页面首次进入和重新打开均可及时完成', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[browser-${message.type()}] ${message.text()}`)
    }
  })
  const results: Array<{ route: string; firstOpenMs: number; reopenMs: number }> = []

  for (const [route, heading] of routes) {
    const firstStartedAt = Date.now()
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible({ timeout: 60_000 })
    const firstOpenMs = Date.now() - firstStartedAt

    const reopenStartedAt = Date.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible({ timeout: 60_000 })
    const reopenMs = Date.now() - reopenStartedAt

    results.push({ route, firstOpenMs, reopenMs })
  }

  console.log(`[sewing-outsourcing-performance] ${JSON.stringify(results)}`)
  results.forEach(({ route, firstOpenMs, reopenMs }) => {
    expect(firstOpenMs, `${route}首次进入耗时`).toBeLessThan(15_000)
    expect(reopenMs, `${route}重新打开耗时`).toBeLessThan(10_000)
  })
  expect(errors).toEqual([])
})
