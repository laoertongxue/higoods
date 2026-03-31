import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  auditAllFactoryCapacityProfiles,
  listFactoryCapacityEntries,
  listFactoryCapacityProfileStoreIds,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { processCraftDictRows } from '../src/data/fcs/process-craft-dict.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openFactoryCapacityDrawer(page: Page, factoryName: string): Promise<Locator> {
  const search = page.locator('[data-capacity-filter="search"]')
  await search.fill(factoryName)

  const row = page.locator('[data-capacity-factory-id]').filter({ hasText: factoryName }).first()
  await expect(row).toBeVisible()
  await row.locator('[data-capacity-action="open-detail"]').click()

  const drawer = page.getByTestId('factory-capacity-profile-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText(factoryName)
  return drawer
}

async function closeFactoryCapacityDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByTestId('factory-capacity-profile-drawer')).toBeHidden()
}

function getCraftCard(drawer: Locator, craftName: string): Locator {
  return drawer.locator('[data-capacity-entry-card]').filter({ hasText: craftName }).first()
}

async function expectResultToChange(card: Locator, fieldKey: string, nextValue: string): Promise<void> {
  const resultNode = card.locator('[data-capacity-result-value]').first()
  const previousResult = (await resultNode.textContent())?.trim()
  await card.locator(`[data-capacity-field-key="${fieldKey}"]`).fill(nextValue)
  await expect(resultNode).not.toHaveText(previousResult ?? '')
}

test('产能档案已收口为当前阶段最小必要字段维护，工厂与工艺来源仍然来自工厂档案', async ({ page }) => {
  const errors = collectPageErrors(page)
  const auditIssues = auditAllFactoryCapacityProfiles()
  expect(auditIssues).toEqual([])

  const coverage = new Map<string, Set<string>>()
  listFactoryMasterRecords().forEach((factory) => {
    listFactoryCapacityEntries(factory.id).forEach(({ row }) => {
      if (!coverage.has(row.craftCode)) coverage.set(row.craftCode, new Set())
      coverage.get(row.craftCode)?.add(factory.id)
    })
  })
  expect(processCraftDictRows.filter((row) => !coverage.has(row.craftCode))).toEqual([])
  expect(listFactoryCapacityProfileStoreIds().length).toBe(listFactoryMasterRecords().length)

  await page.goto('/fcs/factories/capacity-profile')
  await expect(page.getByRole('heading', { name: '产能档案', exact: true })).toBeVisible()

  const scenarios = [
    { factoryName: 'PT Sinar Garment Indonesia', crafts: ['基础连接', '曲牙'] },
    { factoryName: 'PT Prima Printing Center', crafts: ['丝网印'] },
    { factoryName: 'PT Cahaya Dyeing Sejahtera', crafts: ['匹染'] },
    { factoryName: 'PT Mulia Cutting Center', crafts: ['定位裁'] },
    { factoryName: 'PT Denim Wash Nusantara', crafts: ['洗水'] },
    { factoryName: 'CV Satellite Cluster Malang A', crafts: ['手缝扣', '包装'] },
  ] as const

  for (const scenario of scenarios) {
    const drawer = await openFactoryCapacityDrawer(page, scenario.factoryName)
    const readonlySection = drawer.getByTestId('factory-capacity-readonly-abilities')
    const currentStageSection = drawer.getByTestId('factory-capacity-current-stage-section')

    await expect(readonlySection).toContainText('工序工艺能力（来自工厂档案）')
    await expect(readonlySection).toContainText('只读引用')
    await expect(currentStageSection).toContainText('当前阶段最小必要字段与自动计算结果')
    await expect(drawer.getByRole('button', { name: '设备台账', exact: true })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: '人员台账', exact: true })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: '班次日历', exact: true })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: '工厂工时修正', exact: true })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: '校准记录', exact: true })).toHaveCount(0)
    await expect(drawer).not.toContainText('白班时长')
    await expect(drawer).not.toContainText('夜班时长')
    await expect(drawer).not.toContainText('当前状态')
    await expect(drawer).not.toContainText('校准记录')

    for (const craftName of scenario.crafts) {
      await expect(readonlySection).toContainText(craftName)
      const card = getCraftCard(drawer, craftName)
      await expect(card).toBeVisible()
      await expect(card).toContainText('当前阶段最小必要字段')
      await expect(card).toContainText('当前阶段公式')
      await expect(card).toContainText('当前输入值代入后的计算过程')
      await expect(card.locator('[data-capacity-result-value]')).toBeVisible()
    }

    await closeFactoryCapacityDrawer(page)
  }

  await expectNoPageErrors(errors)
})

test('不同模板工艺会根据当前阶段字段自动计算默认日可供给发布工时 SAM', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/factories/capacity-profile')

  const sewingDrawer = await openFactoryCapacityDrawer(page, 'PT Sinar Garment Indonesia')
  const baseConnectCard = getCraftCard(sewingDrawer, '基础连接')
  await expect(baseConnectCard).toContainText('默认日可供给发布工时 SAM')
  await expect(baseConnectCard.locator('[data-capacity-result-block] input')).toHaveCount(0)
  await expect(baseConnectCard).toContainText('基础日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue')
  await expectResultToChange(baseConnectCard, 'staffCount', '9')
  await expectResultToChange(baseConnectCard, 'efficiencyFactor', '0.91')

  const quyaCard = getCraftCard(sewingDrawer, '曲牙')
  await expect(quyaCard).toContainText('设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue')
  await expect(quyaCard).toContainText('人员侧日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue')
  await expect(quyaCard).toContainText('固定准备分钟')
  await expect(quyaCard).toContainText('切换准备分钟')
  await expectResultToChange(quyaCard, 'staffCount', '7')
  await closeFactoryCapacityDrawer(page)

  const printDrawer = await openFactoryCapacityDrawer(page, 'PT Prima Printing Center')
  const printCard = getCraftCard(printDrawer, '丝网印')
  await expect(printCard).toContainText('设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue')
  await expect(printCard).toContainText('当前输入值代入后的计算过程')
  await expectResultToChange(printCard, 'deviceEfficiencyValue', '0.92')
  await closeFactoryCapacityDrawer(page)

  const dyeDrawer = await openFactoryCapacityDrawer(page, 'PT Cahaya Dyeing Sejahtera')
  const dyeCard = getCraftCard(dyeDrawer, '匹染')
  await expect(dyeCard).toContainText('单台默认日可运行批数 = deviceShiftMinutes ÷ cycleMinutes')
  await expect(dyeCard).toContainText('设备侧日能力 = 单台默认日可运行批数 × batchLoadCapacity × deviceCount')
  await expectResultToChange(dyeCard, 'staffCount', '6')
  await expectResultToChange(dyeCard, 'efficiencyFactor', '0.95')
  await closeFactoryCapacityDrawer(page)

  await expectNoPageErrors(errors)
})
