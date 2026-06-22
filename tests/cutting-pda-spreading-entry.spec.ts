import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const allSpreadingModes = new Set(
  listPdaCuttingTaskSourceRecords()
    .flatMap((record) =>
      record.executionOrderIds.flatMap((executionOrderId) => getPdaCuttingTaskSnapshot(record.taskId, executionOrderId)?.spreadingTargets || []),
    )
    .map((target) => target.spreadingMode),
)

const pdaSession = {
  userId: 'PDAU-FACTORY-ONBOARD-0034-ADMIN',
  loginId: 'onboarding_34',
  userName: '申请人34',
  roleId: 'ROLE_ADMIN',
  factoryId: 'FACTORY-ONBOARD-0034',
  factoryName: '定向裁演示工厂34',
  loggedAt: '2026-06-22 10:00:00',
}

const spreadingUrl =
  '/fcs/pda/cutting/spreading/TASK-CUT-000201'
  + '?executionOrderId=CPO-20260318-A1'
  + '&executionOrderNo=CPO-20260318-A1'
  + '&cutOrderId=cut-order%3Apo-202603-0101%3Atdv-demand-spu-2024-010-bom-black-stretch-twill%3Atdv-demand-spu-2024-010-pattern-main%3Av1-0%3A150cm'
  + '&cutOrderNo=CUT-260306-101-01'
  + '&materialSku=tdv_demand_SPU_2024_010-bom-black-stretch-twill'

test('PDA 铺布入口锁定铺布单，现场只选择面料/铺布明细', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: pdaSession,
  })

  expect([...allSpreadingModes].sort()).toEqual(['FOLD_HIGH_LOW', 'FOLD_NORMAL', 'HIGH_LOW', 'NORMAL'])

  await page.goto(spreadingUrl)

  await expect(page.getByTestId('pda-cutting-spreading-core-summary')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-target-selector')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="selectedTargetKey"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="planUnitId"]')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-plan-unit-selector')).toContainText('面料 / 铺布明细')
  await expect(page.locator('[data-pda-cut-spreading-field="fabricRollNo"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="photoProofCount"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('现场照片')
  await expect(page.locator('body')).not.toContainText('来源唛架')
  await expect(page.locator('body')).not.toContainText('计划单元')
  await expect(page.locator('body')).not.toContainText('数据来源')
  await expect(page.locator('body')).not.toContainText('录入来源')
  await expect(page.locator('body')).not.toContainText('sourceWritebackId')
  await expect(page.locator('body')).not.toContainText('enteredByAccountId')
  await expect(page.locator('body')).not.toContainText('operatorAccountId')
  await expect(page.locator('body')).not.toContainText('拆分组')

  await expectNoPageErrors(errors)
})
