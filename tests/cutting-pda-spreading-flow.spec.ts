import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const spreadingStartUrl =
  '/fcs/pda/cutting/spreading/TASK-CUT-000201'
  + '?executionOrderId=CPO-20260318-A1'
  + '&executionOrderNo=CPO-20260318-A1'
  + '&cutOrderId=cut-order%3Apo-202603-0101%3Atdv-demand-spu-2024-010-bom-black-stretch-twill%3Atdv-demand-spu-2024-010-pattern-main%3Av1-0%3A150cm'
  + '&cutOrderNo=CUT-260306-101-01'
  + '&materialSku=tdv_demand_SPU_2024_010-bom-black-stretch-twill'

test('PDA 铺布页按填写后操作的顺序展示开始铺布', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: {
      userId: 'PDAU-FACTORY-ONBOARD-0034-ADMIN',
      loginId: 'onboarding_34',
      userName: '申请人34',
      roleId: 'ROLE_ADMIN',
      factoryId: 'FACTORY-ONBOARD-0034',
      factoryName: '定向裁演示工厂34',
      loggedAt: '2026-06-22 10:00:00',
    },
  })
  await page.setViewportSize({ width: 430, height: 900 })

  await page.goto(spreadingStartUrl, { waitUntil: 'networkidle' })

  await expect(page.getByRole('heading', { name: '铺布录入' })).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-core-summary')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-plan-unit-selector')).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="planUnitId"]')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-start-spreading-confirm')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-submit-bar')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-start-spreading-confirm').locator('[data-pda-cut-spreading-field="note"]')).toBeVisible()

  await expect(page.getByTestId('pda-cutting-target-selector')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="selectedTargetKey"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="fabricRollNo"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="photoProofCount"]')).toHaveCount(0)
  await expect(page.getByText('现场照片')).toHaveCount(0)
  await expect(page.getByTestId('pda-cutting-spreading-latest-summary')).toHaveCount(0)
  await expect(page.getByTestId('pda-cutting-spreading-form-card')).toHaveCount(0)
  await expect(page.getByTestId('pda-cutting-spreading-note-card')).toHaveCount(0)
  await expect(page.getByText('当前要做')).toHaveCount(0)
  await expect(page.getByText('最近卷号')).toHaveCount(0)
  await expect(page.getByText('最近时间')).toHaveCount(0)
  await expect(page.getByText('现场操作员')).toHaveCount(0)
  await expect(page.getByText('当前步骤')).toHaveCount(0)

  const order = await page.evaluate(() => {
    const core = document.querySelector('[data-testid="pda-cutting-spreading-core-summary"]')
    const plan = document.querySelector('[data-testid="pda-cutting-plan-unit-selector"]')
    const confirm = document.querySelector('[data-testid="pda-cutting-start-spreading-confirm"]')
    const submit = document.querySelector('[data-pda-cut-spreading-submit-shell]')
    const detail = document.querySelector('[data-testid="pda-cutting-spreading-extra-detail"]')
    const records = document.querySelector('[data-testid="pda-cutting-spreading-records"]')
    const follows = (left: Element | null, right: Element | null) =>
      Boolean(left && right && (left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING))
    const coreText = core?.textContent || ''

    return {
      planOutsideCore: Boolean(core && plan && !core.contains(plan)),
      corePlanLayerHidden: (coreText.match(/100 层/g) || []).length === 0,
      corePlanQtyHidden: (coreText.match(/6900 件/g) || []).length === 0,
      coreThenPlan: follows(core, plan),
      planThenConfirm: follows(plan, confirm),
      confirmThenSubmit: follows(confirm, submit),
      submitThenDetail: follows(submit, detail),
      detailThenRecords: follows(detail, records),
    }
  })

  expect(order).toEqual({
    planOutsideCore: true,
    corePlanLayerHidden: true,
    corePlanQtyHidden: true,
    coreThenPlan: true,
    planThenConfirm: true,
    confirmThenSubmit: true,
    submitThenDetail: true,
    detailThenRecords: true,
  })

  await expect(page.getByTestId('pda-cutting-spreading-submit-bar')).toContainText('返回')
  await expect(page.getByTestId('pda-cutting-spreading-submit-bar')).toContainText('开始铺布')
  await expectNoPageErrors(errors)
})
