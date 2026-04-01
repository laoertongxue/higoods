import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function getSelectedOptionText(select: Locator): Promise<string> {
  return ((await select.locator('option:checked').textContent()) ?? '').trim()
}

async function openPoliciesDrawer(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '新增暂停例外' }).click()
  const drawer = page.getByTestId('capacity-policies-override-drawer')
  await expect(drawer).toBeVisible()
  return drawer
}

async function createPauseOverride(
  page: Page,
  input: {
    scope: 'factory' | 'process' | 'craft'
    startDate: string
    endDate: string
    reason: string
    note: string
  },
): Promise<{ factoryLabel: string; processLabel: string; craftLabel: string }> {
  const drawer = await openPoliciesDrawer(page)
  const factorySelect = drawer.locator('[data-capacity-policies-field="factoryId"]')
  const processSelect = drawer.locator('[data-capacity-policies-field="processCode"]')
  const craftSelect = drawer.locator('[data-capacity-policies-field="craftCode"]')

  const factoryLabel = (await getSelectedOptionText(factorySelect)).split('（')[0]
  let processLabel = ''
  let craftLabel = ''

  if (input.scope === 'process' || input.scope === 'craft') {
    await processSelect.selectOption({ index: 1 })
    processLabel = await getSelectedOptionText(processSelect)
  }

  if (input.scope === 'craft') {
    await craftSelect.selectOption({ index: 1 })
    craftLabel = await getSelectedOptionText(craftSelect)
  }

  await drawer.locator('[data-capacity-policies-field="startDate"]').fill(input.startDate)
  await drawer.locator('[data-capacity-policies-field="endDate"]').fill(input.endDate)
  await drawer.locator('[data-capacity-policies-field="reason"]').fill(input.reason)
  await drawer.locator('[data-capacity-policies-field="note"]').fill(input.note)
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect(drawer).toBeHidden()
  await expect(page.getByText('暂停例外已新增。')).toBeVisible()
  return { factoryLabel, processLabel, craftLabel }
}

test('规则与例外页已成为产能日历模块的规则中心，并可维护暂停例外', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/capacity/policies')

  await expect(page.getByRole('heading', { name: '规则与例外', exact: true })).toBeVisible()
  await expect(page.getByTestId('capacity-policies-rules-section')).toContainText('供给来源')
  await expect(page.getByTestId('capacity-policies-rules-section')).toContainText('需求来源')
  await expect(page.getByTestId('capacity-policies-rules-section')).toContainText('冻结 / 占用说明')
  await expect(page.getByTestId('capacity-policies-rules-section')).toContainText('日期落点规则')
  await expect(page.getByTestId('capacity-policies-rules-section')).toContainText('剩余计算规则')
  await expect(page.getByTestId('capacity-policies-overrides-section')).toContainText('暂停例外')
  await expect(page.getByTestId('capacity-policies-thresholds-section')).toContainText('紧张阈值')
  await expect(page.getByTestId('capacity-policies-thresholds-section')).toContainText('超载定义')
  await expect(page.getByTestId('capacity-policies-thresholds-section')).toContainText('当前整个 FCS 不存在复盘工时 SAM')
  await expect(page.locator('body')).not.toContainText('当前页先沿用规则建议骨架')
  await expect(page.locator('body')).not.toContainText('生产单策略')
  await expect(page.locator('body')).not.toContainText('任务策略')

  const factoryPause = await createPauseOverride(page, {
    scope: 'factory',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    reason: '整厂停线测试',
    note: '用于验证整厂暂停例外。',
  })
  const processPause = await createPauseOverride(page, {
    scope: 'process',
    startDate: '2026-04-13',
    endDate: '2026-04-15',
    reason: '工序停线测试',
    note: '用于验证工序暂停例外。',
  })
  const craftPause = await createPauseOverride(page, {
    scope: 'craft',
    startDate: '2026-04-16',
    endDate: '2026-04-18',
    reason: '工艺停线测试',
    note: '用于验证工艺暂停例外。',
  })

  const overridesSection = page.getByTestId('capacity-policies-overrides-section')
  await expect(overridesSection).toContainText(factoryPause.factoryLabel)
  await expect(overridesSection).toContainText('整厂停线测试')
  await expect(overridesSection).toContainText(processPause.processLabel)
  await expect(overridesSection).toContainText('工序停线测试')
  await expect(overridesSection).toContainText(craftPause.processLabel)
  await expect(overridesSection).toContainText(craftPause.craftLabel)
  await expect(overridesSection).toContainText('工艺停线测试')

  const processRow = overridesSection.locator('tr').filter({ hasText: '工序停线测试' }).first()
  await processRow.getByRole('button', { name: '编辑' }).click()
  const drawer = page.getByTestId('capacity-policies-override-drawer')
  await expect(drawer).toBeVisible()
  await drawer.locator('[data-capacity-policies-field="note"]').fill('已更新的工序暂停说明')
  await drawer.getByRole('button', { name: '保存' }).click()
  await expect(processRow).toContainText('已更新的工序暂停说明')

  const activeSeedRow = overridesSection.locator('tr').filter({ hasText: '整厂盘点' }).first()
  await expect(activeSeedRow.getByRole('button', { name: '失效' })).toBeVisible()
  await activeSeedRow.getByRole('button', { name: '失效' }).click()
  await expect
    .poll(async () => {
      const refreshedRow = overridesSection.locator('tr').filter({ hasText: '整厂盘点' })
      const count = await refreshedRow.count()
      if (count === 0) return 'removed'
      const text = (await refreshedRow.first().textContent()) ?? ''
      return text.includes('已过期') ? 'expired' : 'pending'
    })
    .toMatch(/removed|expired/)

  const craftRow = overridesSection.locator('tr').filter({ hasText: '工艺停线测试' }).first()
  await expect(craftRow.getByRole('button', { name: '删除' })).toBeVisible()
  await craftRow.getByRole('button', { name: '删除' }).click()
  await expect(overridesSection).not.toContainText('工艺停线测试')

  await expectNoPageErrors(errors)
})
