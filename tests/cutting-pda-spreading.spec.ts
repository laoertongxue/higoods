import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const pdaSession = {
  userId: 'PDAU-FACTORY-ONBOARD-0034-ADMIN',
  loginId: 'onboarding_34',
  userName: '申请人34',
  roleId: 'ROLE_ADMIN',
  factoryId: 'FACTORY-ONBOARD-0034',
  factoryName: '定向裁演示工厂34',
  loggedAt: '2026-06-22 10:00:00',
}

const taskId = 'TASK-CUT-000201'
const executionOrderId = 'CPO-20260318-A1'
const executionOrderNo = 'CPO-20260318-A1'
const spreadingUrl =
  `/fcs/pda/cutting/spreading/${taskId}`
  + `?executionOrderId=${executionOrderId}`
  + `&executionOrderNo=${executionOrderNo}`
  + '&cutOrderId=cut-order%3Apo-202603-0101%3Atdv-demand-spu-2024-010-bom-black-stretch-twill%3Atdv-demand-spu-2024-010-pattern-main%3Av1-0%3A150cm'
  + '&cutOrderNo=CUT-260306-101-01'
  + '&materialSku=tdv_demand_SPU_2024_010-bom-black-stretch-twill'

test('PDA 铺布页不再手选铺布单、手填布卷号或现场照片', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: pdaSession,
  })

  await page.goto(spreadingUrl)

  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="enteredBy"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="selectedTargetKey"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="planUnitId"]')).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="fabricRollNo"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-cut-spreading-field="photoProofCount"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('现场照片')
  await expect(page.locator(`[data-pda-cut-spreading-root="${taskId}"]`)).not.toContainText('ID-F004_prod')

  await expectNoPageErrors(errors)
})

test('PDA 铺布页录入本卷时连续输入不丢焦点', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: pdaSession,
  })

  await page.goto(spreadingUrl)
  await page.locator('[data-pda-cut-spreading-field="cuttingTableId"]').selectOption({ index: 1 })
  await page.getByRole('button', { name: '开始铺布' }).click()
  await expect(page.getByRole('button', { name: '提交本卷' })).toBeVisible()

  const layerInput = page.locator('[data-pda-cut-spreading-field="layerCount"]')
  await layerInput.click()
  await page.keyboard.type('22')
  await expect(layerInput).toHaveValue('22')
  await expect(page.locator(':focus')).toHaveAttribute('data-pda-cut-spreading-field', 'layerCount')

  const lengthInput = page.locator('[data-pda-cut-spreading-field="actualLength"]')
  await lengthInput.click()
  await page.keyboard.type('33')
  await expect(lengthInput).toHaveValue('33')
  await expect(page.locator(':focus')).toHaveAttribute('data-pda-cut-spreading-field', 'actualLength')
  await expect(page.getByTestId('pda-cutting-gross-length-value')).toContainText('726.00 米')

  const operatorInput = page.locator('[data-pda-cut-spreading-operator-field="operatorName"]').first()
  await operatorInput.click()
  await operatorInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.type('Rini')
  await expect(operatorInput).toHaveValue('Rini')
  await expect(page.locator(':focus')).toHaveAttribute('data-pda-cut-spreading-operator-field', 'operatorName')

  await expectNoPageErrors(errors)
})

test('PDA 裁片任务详情页从铺布单卡片进入锁定铺布单', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: pdaSession,
  })

  await page.goto(
    `/fcs/pda/cutting/task/${taskId}?executionOrderId=${encodeURIComponent(executionOrderId)}&executionOrderNo=${encodeURIComponent(executionOrderNo)}`,
  )

  const spreadingCard = page.locator('article').filter({ hasText: executionOrderId }).first()
  await expect(spreadingCard).toBeVisible()
  await spreadingCard.getByRole('button', { name: /开始铺布|完成铺布/ }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/spreading/${taskId}\\?`))
  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()
  await expect(page.getByTestId('pda-cutting-target-selector')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
