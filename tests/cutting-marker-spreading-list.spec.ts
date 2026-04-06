import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function getStageTab(page: Page, label: string) {
  return page
    .getByTestId('cutting-spreading-stage-tabs')
    .getByRole('button', { name: new RegExp(`^${label}（`) })
}

async function getStageCount(page: Page, label: string) {
  const text = (await (await getStageTab(page, label)).textContent()) || ''
  const matched = text.match(/（(\d+)）/)
  return matched ? Number(matched[1]) : 0
}

async function countViewportRows(page: Page, tableTestId: string) {
  return page.getByTestId(tableTestId).locator('tbody tr').evaluateAll((rows) => {
    const viewportHeight = window.innerHeight
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect()
      return rect.height > 0 && rect.top < viewportHeight && rect.bottom > 0
    }).length
  })
}

async function expectVerticalOrder(upper: import('@playwright/test').Locator, lower: import('@playwright/test').Locator) {
  const upperBox = await upper.boundingBox()
  const lowerBox = await lower.boundingBox()
  expect(upperBox).toBeTruthy()
  expect(lowerBox).toBeTruthy()
  expect((upperBox?.y ?? 0) + (upperBox?.height ?? 0)).toBeLessThanOrEqual((lowerBox?.y ?? 0) + 2)
}

async function countTripleCardNesting(page: Page, rootSelector: string) {
  return page.locator(rootSelector).evaluate((root) => {
    const isCard = (node: Element) => node.classList.contains('border') && node.classList.contains('bg-card')
    return Array.from(root.querySelectorAll('*')).filter((node) => {
      if (!isCard(node)) return false
      const second = Array.from(node.children).find((child) => isCard(child))
      if (!second) return false
      return Array.from(second.children).some((child) => isCard(child))
    }).length
  })
}

test('铺布列表页使用 supervisor 视图、主按钮 marker-first、行按钮按状态分流', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })

  await page.goto('/fcs/craft/cutting/spreading-list')

  await expect(page.getByTestId('cutting-spreading-list-page')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '铺布列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '按唛架新建铺布' })).toBeVisible()
  await expect(page.getByRole('button', { name: '异常补录铺布' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导出当前视图' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建铺布', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)
  await expect(page.getByText('当前筛选范围内暂无唛架记录')).toHaveCount(0)
  await expect(page.getByTestId('cutting-spreading-list-stats')).toHaveCount(1)
  await expect(page.getByTestId('cutting-spreading-stage-tabs')).toBeVisible()
  await expect(page.getByTestId('cutting-spreading-list-filters')).toBeVisible()
  await expect(page.locator('[data-cutting-spreading-main-card="true"]')).toHaveCount(1)
  await expect(page.getByTestId('cutting-spreading-more-filters')).not.toHaveAttribute('open', '')

  await expectVerticalOrder(page.getByTestId('cutting-spreading-list-stats'), page.getByTestId('cutting-spreading-stage-tabs'))
  await expectVerticalOrder(page.getByTestId('cutting-spreading-stage-tabs'), page.getByTestId('cutting-spreading-list-filters'))
  await expectVerticalOrder(page.getByTestId('cutting-spreading-list-filters'), page.locator('[data-cutting-spreading-main-card="true"]'))
  const statsBox = await page.getByTestId('cutting-spreading-list-stats').boundingBox()
  expect(statsBox?.height ?? 0).toBeLessThan(160)
  const tabsBox = await page.getByTestId('cutting-spreading-stage-tabs').boundingBox()
  expect(tabsBox?.height ?? 0).toBeLessThan(64)
  await expect(page.getByText('待开始数 = 主状态 = 待开始 的铺布数')).toBeVisible()

  const table = page.getByTestId('cutting-spreading-list-table')
  await expect(table).toBeVisible()
  await expect(table.locator('thead')).toBeVisible()
  expect(await countViewportRows(page, 'cutting-spreading-list-table')).toBeGreaterThanOrEqual(6)
  expect(await countTripleCardNesting(page, '[data-testid="cutting-spreading-list-page"]')).toBe(0)
  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  await expect(firstRow.locator('p.font-mono').first()).toBeVisible()

  await page.getByRole('button', { name: '按唛架新建铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create(?:\?|$)/)
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.getByRole('button', { name: '异常补录铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create\?/)
  await expect(page).toHaveURL(/exceptionEntry=1/)

  await page.goto('/fcs/craft/cutting/spreading-list')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出当前视图' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('铺布列表-')

  await page.goto('/fcs/craft/cutting/spreading-list')
  const tableBody = page.getByTestId('cutting-spreading-list-table').locator('tbody')

  const executableStage = (await getStageCount(page, '待开始')) > 0 ? '待开始' : '铺布中'
  await (await getStageTab(page, executableStage)).click()
  let stageRow = tableBody.locator('tr').first()
  await expect(stageRow).toBeVisible()
  await expect(stageRow.getByRole('button', { name: '继续铺布' })).toBeVisible()
  await expect(stageRow.getByRole('button', { name: '查看详情' })).toBeVisible()
  await expect(stageRow.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
  await expect(stageRow.getByRole('button', { name: '去打印菲票' })).toHaveCount(0)
  await expect(stageRow.getByRole('button', { name: '去装袋' })).toHaveCount(0)
  await expect(stageRow.getByRole('button', { name: '去裁片仓' })).toHaveCount(0)

  if ((await getStageCount(page, '待补料确认')) > 0) {
    await (await getStageTab(page, '待补料确认')).click()
    stageRow = tableBody.locator('tr').first()
    await expect(stageRow.getByRole('button', { name: '查看详情' })).toBeVisible()
    await expect(stageRow.getByRole('button', { name: '去补料管理' })).toBeVisible()
  }

  if ((await getStageCount(page, '待打印菲票')) > 0) {
    await (await getStageTab(page, '待打印菲票')).click()
    stageRow = tableBody.locator('tr').first()
    await expect(stageRow.getByRole('button', { name: '去打印菲票' })).toBeVisible()
  }

  if ((await getStageCount(page, '待装袋')) > 0) {
    await (await getStageTab(page, '待装袋')).click()
    stageRow = tableBody.locator('tr').first()
    await expect(stageRow.getByRole('button', { name: '去装袋' })).toBeVisible()
  }

  if ((await getStageCount(page, '待入仓')) > 0) {
    await (await getStageTab(page, '待入仓')).click()
    stageRow = tableBody.locator('tr').first()
    await expect(stageRow.getByRole('button', { name: '去裁片仓' })).toBeVisible()
  }

  if ((await getStageCount(page, '已完成')) > 0) {
    await (await getStageTab(page, '已完成')).click()
    stageRow = tableBody.locator('tr').first()
    await expect(stageRow.getByRole('button', { name: '查看详情' })).toBeVisible()
    await expect(stageRow.getByRole('button', { name: '继续铺布' })).toHaveCount(0)
    await expect(stageRow.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
    await expect(stageRow.getByRole('button', { name: '去打印菲票' })).toHaveCount(0)
    await expect(stageRow.getByRole('button', { name: '去装袋' })).toHaveCount(0)
    await expect(stageRow.getByRole('button', { name: '去裁片仓' })).toHaveCount(0)
  }

  await expectNoPageErrors(errors)
})
