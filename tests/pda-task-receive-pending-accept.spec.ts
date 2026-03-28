import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const REQUIRED_PENDING_ACCEPT_LABELS = ['生产单号', '工序', '任务件数', '接单截止', '任务截止', '派单价'] as const
const REMOVED_PENDING_ACCEPT_LABELS = [
  '原始任务',
  '来源任务',
  '拆分组',
  '直接派单时间',
  '工序标准价',
  '按标准价派单',
  '高于标准价',
  '低于标准价',
  '当前状态',
  '裁片单数量',
  '已完成',
  '未完成',
  '下一步',
  '进度',
  '异常裁片单',
] as const

test('接单页待接单卡片字段统一且 4 个 Tab 排除印花染色', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()

  const cuttingCard = page.locator('article[data-pda-cutting-task-card-id]').first()
  const ordinaryCard = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: '查看详情' }) })
    .first()

  await expect(cuttingCard).toBeVisible()
  await expect(ordinaryCard).toBeVisible()

  for (const label of REQUIRED_PENDING_ACCEPT_LABELS) {
    await expect(cuttingCard).toContainText(label)
    await expect(ordinaryCard).toContainText(label)
  }

  for (const label of REMOVED_PENDING_ACCEPT_LABELS) {
    await expect(cuttingCard).not.toContainText(label)
    await expect(ordinaryCard).not.toContainText(label)
  }

  const processSelect = page.locator('[data-pda-tr-field="processFilter"]')
  await expect(processSelect).not.toContainText('印花')
  await expect(processSelect).not.toContainText('染色')

  const main = page.locator('main')
  for (const tab of ['pending-accept', 'pending-quote', 'quoted', 'awarded'] as const) {
    await page.goto(`/fcs/pda/task-receive?tab=${tab}`)
    await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()
    await expect(main).not.toContainText('印花')
    await expect(main).not.toContainText('染色')
  }

  await expectNoPageErrors(errors)
})
