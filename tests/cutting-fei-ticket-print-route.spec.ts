import { expect, test } from '@playwright/test'

import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('菲票首次打印路由命中首次打印页而不是已打印页', async ({ page }) => {
  const errors = collectPageErrors(page)
  const unit = buildFeiTicketPrintProjection().printableViewModel.units.find(
    (item) => item.printableUnitStatus === 'WAITING_PRINT',
  )

  expect(unit).toBeTruthy()

  await page.goto(
    `/fcs/craft/cutting/fei-ticket-print?printableUnitId=${encodeURIComponent(unit!.printableUnitId)}&printableUnitNo=${encodeURIComponent(unit!.printableUnitNo)}`,
  )

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fei-ticket-print\?/)
  await expect(page.locator('body')).toContainText(/确认首次打印|当前存在缺少五维字段的菲票，不能打印/)
  await expect(page.locator('body')).not.toContainText('已打印菲票不能删除，如需取消请作废。')

  await expectNoPageErrors(errors)
})
