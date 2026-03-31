import { expect, test, type Locator, type Page } from '@playwright/test'

import { listFactoryCapacitySupportedCraftRows } from '../src/data/fcs/factory-capacity-profile-mock.ts'
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

async function switchDrawerTab(drawer: Locator, label: string): Promise<void> {
  await drawer.getByRole('button', { name: label, exact: true }).click()
}

test('工厂档案能力结果保持不变，产能档案工厂来源与只读能力引用正确', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()
  await page.locator('[data-factory-id="ID-F001"] [data-factory-action="edit"]').click()
  const factoryForm = page.locator('form[data-factory-form="true"]')
  await expect(factoryForm.getByTestId('factory-process-abilities')).toBeVisible()
  await expect(factoryForm.getByRole('heading', { name: '工序工艺能力', exact: true })).toBeVisible()
  await factoryForm.getByRole('button', { name: '取消', exact: true }).click()

  await page.goto('/fcs/factories/capacity-profile')
  await expect(page.getByRole('heading', { name: '产能档案', exact: true })).toBeVisible()

  const factoryNamesFromMaster = [
    'PT Prima Printing Center',
    'PT Cahaya Dyeing Sejahtera',
    'PT Mulia Cutting Center',
    'PT Sinar Garment Indonesia',
    'PT Denim Wash Nusantara',
    'CV Satellite Cluster Malang A',
  ]

  for (const factoryName of factoryNamesFromMaster) {
    const drawer = await openFactoryCapacityDrawer(page, factoryName)
    const readonlySection = drawer.getByTestId('factory-capacity-readonly-abilities')
    await expect(readonlySection).toBeVisible()
    await expect(readonlySection).toContainText('工序工艺能力（来自工厂档案）')
    await expect(readonlySection).toContainText('只读引用')
    await expect(readonlySection.locator('input')).toHaveCount(0)
    await closeFactoryCapacityDrawer(page)
  }

  await expectNoPageErrors(errors)
})

test('产能档案字段由 samFactoryFieldKeys 驱动，且 mock 覆盖全部工序工艺并分布在多个工厂', async ({ page }) => {
  const errors = collectPageErrors(page)

  const craftCoverage = new Map<string, Set<string>>()
  const coverageSummary = listFactoryMasterRecords().map((factory) => {
    const supportedRows = listFactoryCapacitySupportedCraftRows(factory.id)
    supportedRows.forEach((row) => {
      if (!craftCoverage.has(row.craftCode)) craftCoverage.set(row.craftCode, new Set())
      craftCoverage.get(row.craftCode)?.add(factory.id)
    })
    return { factoryId: factory.id, craftCount: supportedRows.length }
  })

  const missingCrafts = processCraftDictRows.filter((row) => !craftCoverage.has(row.craftCode))
  expect(missingCrafts).toEqual([])
  expect(Math.max(...coverageSummary.map((item) => item.craftCount))).toBeLessThan(processCraftDictRows.length)

  await page.goto('/fcs/factories/capacity-profile')

  const printDrawer = await openFactoryCapacityDrawer(page, 'PT Prima Printing Center')
  const readonlySection = printDrawer.getByTestId('factory-capacity-readonly-abilities')
  await expect(readonlySection).toContainText('丝网印')
  await expect(readonlySection).toContainText('数码印')

  const printDeviceTab = printDrawer.getByTestId('factory-capacity-device-tab')
  const printCraftCard = printDeviceTab.locator('[data-capacity-craft-card]').filter({ hasText: '丝网印' }).first()
  await expect(printCraftCard).toBeVisible()
  await expect(printCraftCard).toContainText('设备数量')
  await expect(printCraftCard).toContainText('设备标准效率值')
  await expect(printCraftCard).not.toContainText('人数')

  await switchDrawerTab(printDrawer, '人员台账')
  const printStaffTab = printDrawer.getByTestId('factory-capacity-staff-tab')
  const printStaffCard = printStaffTab.locator('[data-capacity-craft-card]').filter({ hasText: '丝网印' }).first()
  await expect(printStaffCard).toContainText('人数')
  await expect(printStaffCard).not.toContainText('设备数量')

  await switchDrawerTab(printDrawer, '工厂工时修正')
  const printAdjustmentTab = printDrawer.getByTestId('factory-capacity-adjustment-tab')
  const printAdjustmentCard = printAdjustmentTab.locator('[data-capacity-craft-card]').filter({ hasText: '丝网印' }).first()
  await expect(printAdjustmentCard).toContainText('固定准备分钟')
  await expect(printAdjustmentCard).toContainText('切换准备分钟')
  await expect(printAdjustmentCard).toContainText('工厂效率系数')
  await closeFactoryCapacityDrawer(page)

  const dyeDrawer = await openFactoryCapacityDrawer(page, 'PT Cahaya Dyeing Sejahtera')
  const dyeDeviceTab = dyeDrawer.getByTestId('factory-capacity-device-tab')
  const dyeCraftCard = dyeDeviceTab.locator('[data-capacity-craft-card]').filter({ hasText: '匹染' }).first()
  await expect(dyeCraftCard).toBeVisible()
  await expect(dyeCraftCard).toContainText('单次有效装载量')
  await expect(dyeCraftCard).toContainText('装载量单位')
  await expect(dyeCraftCard).toContainText('单次循环分钟')
  await closeFactoryCapacityDrawer(page)

  const finishingDrawer = await openFactoryCapacityDrawer(page, 'CV Satellite Cluster Malang A')
  const finishingDeviceTab = finishingDrawer.getByTestId('factory-capacity-device-tab')
  await expect(finishingDeviceTab.locator('[data-capacity-craft-card]').filter({ hasText: '包装' })).toHaveCount(0)
  await switchDrawerTab(finishingDrawer, '人员台账')
  const finishingStaffTab = finishingDrawer.getByTestId('factory-capacity-staff-tab')
  const packagingCard = finishingStaffTab.locator('[data-capacity-craft-card]').filter({ hasText: '包装' }).first()
  await expect(packagingCard).toBeVisible()
  await expect(packagingCard).toContainText('人数')
  await expect(packagingCard).not.toContainText('设备数量')
  await switchDrawerTab(finishingDrawer, '工厂工时修正')
  const finishingAdjustmentTab = finishingDrawer.getByTestId('factory-capacity-adjustment-tab')
  const packagingAdjustmentCard = finishingAdjustmentTab.locator('[data-capacity-craft-card]').filter({ hasText: '包装' }).first()
  await expect(packagingAdjustmentCard).toContainText('工厂效率系数')
  await closeFactoryCapacityDrawer(page)

  await expectNoPageErrors(errors)
})
