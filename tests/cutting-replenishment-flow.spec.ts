import { expect, test } from '@playwright/test'

import { buildReplenishmentProjection } from '../src/pages/process-factory/cutting/replenishment-projection'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('补料审批通过后，会在原裁片任务的仓库配料领料中生成补料待配料', async ({ page }) => {
  const errors = collectPageErrors(page)
  const targetRow =
    buildReplenishmentProjection().viewModel.rows.find((row) => row.statusMeta.key === 'PENDING_REVIEW') ||
    buildReplenishmentProjection().viewModel.rows[0]

  expect(targetRow).toBeTruthy()

  await page.goto(`/fcs/craft/cutting/replenishment?suggestionId=${encodeURIComponent(targetRow!.suggestionId)}`)
  await expect(page.getByRole('heading', { name: new RegExp(targetRow!.suggestionNo) })).toBeVisible()
  await expect(page.getByText('补料明细建议')).toBeVisible()

  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(page.getByText(`已更新 ${targetRow!.suggestionNo} 的审核结果，并在仓库配料领料中生成补料待配料。`)).toBeVisible()

  await page.locator('[data-cutting-replenish-action="go-material-prep"]').click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/material-prep/)
  await expect(page.getByRole('heading', { name: '补料待配料' })).toBeVisible()
  await expect(page.getByText(targetRow!.lines[0].materialSku).first()).toBeVisible()
  await expect(page.getByText(targetRow!.lines[0].originalCutOrderNo || targetRow!.lines[0].originalCutOrderId).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('来源铺布：')
  await expect(page.locator('body')).toContainText('来源补料：')

  await expectNoPageErrors(errors)
})
