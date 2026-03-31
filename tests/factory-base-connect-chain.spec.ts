import { expect, test, type Locator, type Page } from '@playwright/test'

import { listFactoryCapacitySupportedCraftRows } from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { processCraftDictRows } from '../src/data/fcs/process-craft-dict.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCraftDetail(page: Page, craftName: string): Promise<Locator> {
  await page.locator('[data-craft-dict-field="keyword"]').fill(craftName)
  const row = page.locator('tbody tr').filter({ hasText: craftName }).first()
  await expect(row).toBeVisible()
  await row.locator('[data-craft-dict-action="open-detail"]').click()
  const sheet = page.getByTestId('craft-dict-detail-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText(craftName)
  return sheet
}

async function closeCraftDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByTestId('craft-dict-detail-sheet')).toBeHidden()
}

async function openFactoryCapacityDrawer(page: Page, factoryName: string): Promise<Locator> {
  await page.locator('[data-capacity-filter="search"]').fill(factoryName)
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

test('基础连接工艺已进入字典，并沿工厂档案能力链进入产能档案', async ({ page }) => {
  const errors = collectPageErrors(page)

  const baseConnectRow = processCraftDictRows.find((row) => row.craftName === '基础连接')
  expect(baseConnectRow).toBeTruthy()
  expect(baseConnectRow?.processCode).toBe('SEW')
  expect(baseConnectRow?.samCalcMode).toBe('DISCRETE')
  expect(baseConnectRow?.samConstraintSource).toBe('STAFF')

  const masterFactories = listFactoryMasterRecords()
  const factoriesWithBaseConnect = masterFactories.filter((factory) =>
    factory.processAbilities.some(
      (ability) => ability.processCode === 'SEW' && ability.craftCodes.includes(baseConnectRow!.craftCode),
    ),
  )
  expect(factoriesWithBaseConnect.length).toBeGreaterThan(0)

  const capacityFactoriesWithBaseConnect = masterFactories.filter((factory) =>
    listFactoryCapacitySupportedCraftRows(factory.id).some((row) => row.craftCode === baseConnectRow!.craftCode),
  )
  expect(capacityFactoriesWithBaseConnect.map((item) => item.id).sort()).toEqual(
    factoriesWithBaseConnect.map((item) => item.id).sort(),
  )

  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  const baseConnectSheet = await openCraftDetail(page, '基础连接')
  await expect(baseConnectSheet.getByTestId('craft-dict-detail-tabs')).toContainText('标准完整口径')
  await expect(baseConnectSheet.getByTestId('craft-dict-detail-tabs')).toContainText('当前阶段口径')
  await baseConnectSheet.getByRole('button', { name: '基础信息', exact: true }).click()
  await expect(baseConnectSheet).toContainText('老系统值')
  await expect(baseConnectSheet).toContainText('262145')
  await expect(baseConnectSheet).toContainText('工艺规则来源')
  await expect(baseConnectSheet).toContainText('继承工序规则')
  await expect(baseConnectSheet).toContainText('车缝')
  await baseConnectSheet.getByRole('button', { name: '当前阶段口径', exact: true }).click()
  await expect(baseConnectSheet.getByTestId('craft-current-section')).toContainText(
    '基础日能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值',
  )
  await closeCraftDetail(page)

  const quyaSheet = await openCraftDetail(page, '曲牙')
  await quyaSheet.getByRole('button', { name: '标准完整口径', exact: true }).click()
  await expect(quyaSheet.getByTestId('craft-ideal-section')).toContainText('设备+人员共同约束')
  await closeCraftDetail(page)

  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()
  const sewingFactoryName = 'CV Micro Sewing Jakarta Pusat'
  await page.locator('[data-factory-filter="search"]').fill(sewingFactoryName)
  const sewingFactoryRow = page.locator('[data-factory-id]').filter({ hasText: sewingFactoryName }).first()
  await expect(sewingFactoryRow).toBeVisible()
  await sewingFactoryRow.locator('[data-factory-action="edit"]').click()
  const factoryForm = page.locator('form[data-factory-form="true"]')
  await expect(factoryForm.getByRole('heading', { name: '工序工艺能力', exact: true })).toBeVisible()
  const baseConnectCheckbox = factoryForm.locator('[data-factory-craft-toggle="CRAFT_262145"]').first()
  const quyaCheckbox = factoryForm.locator('[data-factory-craft-toggle="CRAFT_262144"]').first()
  await expect(baseConnectCheckbox).toBeChecked()
  await expect(quyaCheckbox).toBeChecked()
  await factoryForm.getByRole('button', { name: '取消', exact: true }).click()

  await page.goto('/fcs/factories/capacity-profile')
  await expect(page.getByRole('heading', { name: '产能档案', exact: true })).toBeVisible()

  const sewingDrawer = await openFactoryCapacityDrawer(page, sewingFactoryName)
  const readonlySection = sewingDrawer.getByTestId('factory-capacity-readonly-abilities')
  const currentStageSection = sewingDrawer.getByTestId('factory-capacity-current-stage-section')
  await expect(readonlySection).toContainText('工序工艺能力（来自工厂档案）')
  await expect(readonlySection).toContainText('基础连接')
  await expect(readonlySection).toContainText('曲牙')
  await expect(currentStageSection).toContainText('当前阶段最小必要字段与自动计算结果')
  await expect(sewingDrawer.getByRole('button', { name: '设备台账', exact: true })).toHaveCount(0)
  const baseConnectCard = sewingDrawer.locator('[data-capacity-entry-card]').filter({ hasText: '基础连接' }).first()
  await expect(baseConnectCard).toBeVisible()
  await expect(baseConnectCard).toContainText('人数')
  await expect(baseConnectCard).toContainText('单人默认日有效分钟')
  await expect(baseConnectCard).toContainText('人员标准效率值')
  await expect(baseConnectCard).toContainText('工厂效率系数')
  await expect(baseConnectCard).not.toContainText('设备数量')
  await expect(baseConnectCard).toContainText('默认日可供给发布工时 SAM')
  await expect(baseConnectCard).toContainText('当前输入值代入后的计算过程')

  const quyaCard = sewingDrawer.locator('[data-capacity-entry-card]').filter({ hasText: '曲牙' }).first()
  await expect(quyaCard).toBeVisible()
  await expect(quyaCard).toContainText('设备数量')
  await closeFactoryCapacityDrawer(page)

  const printDrawer = await openFactoryCapacityDrawer(page, 'PT Prima Printing Center')
  await expect(printDrawer.getByTestId('factory-capacity-readonly-abilities')).not.toContainText('基础连接')
  await expect(printDrawer.getByTestId('factory-capacity-current-stage-section').locator('[data-capacity-entry-card]').filter({ hasText: '基础连接' })).toHaveCount(0)
  await closeFactoryCapacityDrawer(page)

  await expectNoPageErrors(errors)
})
