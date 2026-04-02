import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const CAPACITY_MENU_TITLES = ['供需总览', '工厂日历', '任务工时风险', '工艺瓶颈与待分配', '暂停例外']

async function getSelectedOptionText(select: Locator): Promise<string> {
  return ((await select.locator('option:checked').textContent()) ?? '').trim()
}

async function getCapacityMenuTexts(page: Page): Promise<string[]> {
  return page.locator('aside').first().locator('button').evaluateAll((nodes, targets) => {
    const targetSet = new Set(targets as string[])
    const result: string[] = []
    for (const node of nodes) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (!targetSet.has(text)) continue
      if (result[result.length - 1] === text) continue
      result.push(text)
    }
    return result
  }, CAPACITY_MENU_TITLES)
}

async function ensureCapacityMenuExpanded(page: Page): Promise<void> {
  const sidebar = page.locator('aside').first()
  const overviewButton = sidebar.getByRole('button', { name: '供需总览' })
  if (await overviewButton.count()) return
  await sidebar.getByRole('button', { name: '产能日历' }).click()
  await expect(overviewButton).toBeVisible()
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

test('产能日历菜单与供需总览已收口成统一标题和三 Tab 结构', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/capacity/overview')

  await expect(page.getByRole('heading', { name: '供需总览', exact: true })).toBeVisible()
  await expect(page.locator('[data-capacity-supply-demand-summary]')).toBeVisible()
  await expect(page.locator('[data-capacity-calendar-rules]')).toContainText('时间窗口口径')

  await ensureCapacityMenuExpanded(page)
  const menuTexts = await getCapacityMenuTexts(page)
  expect(menuTexts).toEqual(CAPACITY_MENU_TITLES)

  const tabsSection = page.getByTestId('capacity-overview-tabs-section')
  await expect(tabsSection.getByRole('button', { name: '工厂供需明细' })).toBeVisible()
  await expect(tabsSection.getByRole('button', { name: '待分配需求' })).toBeVisible()
  await expect(tabsSection.getByRole('button', { name: '未排期需求' })).toBeVisible()

  await expect(page.locator('[data-capacity-overview-panel]')).toHaveCount(1)
  await expect(page.locator('[data-capacity-overview-panel="comparison"]')).toBeVisible()
  await expect(page.locator('[data-capacity-overview-panel="comparison"] [data-capacity-comparison-row]').first()).toBeVisible()
  await expect(page.locator('[data-capacity-overview-panel="unallocated"]')).toHaveCount(0)
  await expect(page.locator('[data-capacity-overview-panel="unscheduled"]')).toHaveCount(0)

  await tabsSection.getByRole('button', { name: '待分配需求' }).click()
  await expect(page.locator('[data-capacity-overview-panel]')).toHaveCount(1)
  await expect(page.locator('[data-capacity-overview-panel="unallocated"]')).toBeVisible()
  await expect(page.locator('[data-capacity-overview-panel="unallocated"] [data-capacity-unallocated-row]').first()).toBeVisible()
  await expect(page.locator('[data-capacity-overview-panel="comparison"]')).toHaveCount(0)
  await expect(page.locator('[data-capacity-overview-panel="unscheduled"]')).toHaveCount(0)

  await tabsSection.getByRole('button', { name: '未排期需求' }).click()
  await expect(page.locator('[data-capacity-overview-panel]')).toHaveCount(1)
  await expect(page.locator('[data-capacity-overview-panel="unscheduled"]')).toBeVisible()
  await expect(page.locator('[data-capacity-overview-panel="unscheduled"] [data-capacity-unscheduled-row]').first()).toBeVisible()
  await expect(page.locator('[data-capacity-overview-panel="comparison"]')).toHaveCount(0)
  await expect(page.locator('[data-capacity-overview-panel="unallocated"]')).toHaveCount(0)

  await page.goto('/fcs/capacity/constraints')
  await expect(page.getByRole('heading', { name: '工厂日历', exact: true })).toBeVisible()
  await page.goto('/fcs/capacity/risk')
  await expect(page.getByRole('heading', { name: '任务工时风险', exact: true })).toBeVisible()
  await page.goto('/fcs/capacity/bottleneck')
  await expect(page.getByRole('heading', { name: '工艺瓶颈与待分配', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('暂停例外页已收口成轻量规则提示加唯一人工入口主表，并保留新增编辑删除失效能力', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/capacity/policies')

  await expect(page.locator('h1').filter({ hasText: '暂停例外' })).toBeVisible()
  await expect(page.getByTestId('capacity-policies-tips-section')).toContainText('供给来自产能档案自动计算的默认日可供给标准工时')
  await expect(page.getByTestId('capacity-policies-tips-section')).toContainText('当前阶段人工动态例外只支持整厂、工序、工艺三级暂停')
  await expect(page.getByTestId('capacity-policies-overrides-section')).toContainText('暂停例外')
  await expect(page.getByRole('button', { name: '新增暂停例外' })).toBeVisible()

  await expect(page.locator('[data-testid="capacity-policies-rules-section"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="capacity-policies-thresholds-section"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('当前生效规则')
  await expect(page.locator('body')).not.toContainText('阈值说明')
  await expect(page.locator('body')).not.toContainText('供给来源')
  await expect(page.locator('body')).not.toContainText('紧张阈值')
  await expect(page.locator('body')).not.toContainText('超载定义')
  await expect(page.locator('body')).not.toContainText('加班')
  await expect(page.locator('body')).not.toContainText('调额')

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
