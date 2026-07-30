import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('中转袋流转只展示三个主状态与三个流转阶段', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '中转袋流转', exact: true })).toBeVisible()

  const body = page.locator('body')
  await expect(body).toContainText('空闲')
  await expect(body).toContainText('使用中')
  await expect(body).toContainText('已报废')

  await expect(body).not.toContainText('待发出口袋数')
  await expect(body).not.toContainText('已签收')
  await expect(body).not.toContainText('待签收')
  await expect(body).not.toContainText('待回仓')
  await expect(body).not.toContainText('回仓验收中')
  await expect(body).not.toContainText('待维修')
  await expect(body).not.toContainText('待清洗')

  const statusSelect = page.locator('select[data-transfer-bags-master-field="status"]')
  await expect(statusSelect.locator('option')).toHaveText([
    '全部状态',
    '空闲',
    '使用中',
    '已报废',
  ])

  const stageSelect = page.locator('select[data-transfer-bags-master-field="useStage"]')
  await expect(stageSelect.locator('option')).toHaveText([
    '全部阶段',
    '菲票已装袋',
    '入仓暂存中',
    '已交出待回收',
  ])
  await expect(page.getByRole('columnheader', { name: '当前状态' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '当前使用' })).toBeVisible()

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')
  await expect(page.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible()

  const summaryStrip = page.locator('[data-transfer-bag-summary-strip]')
  await expect(summaryStrip).toContainText('当前状态')
  await expect(summaryStrip).toContainText('当前流转阶段')
  await expect(summaryStrip).not.toContainText('待签收')
  await expect(summaryStrip).not.toContainText('待清洗')
  await expect(summaryStrip).not.toContainText('待维修')

  await expectNoPageErrors(errors)
})
