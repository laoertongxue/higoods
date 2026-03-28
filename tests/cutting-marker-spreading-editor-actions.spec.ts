import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openMarkerEdit(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page.getByRole('heading', { name: '唛架铺布', exact: true })).toBeVisible()
  await page.locator('[data-cutting-marker-action="open-marker-edit"]').first().click()
  await expect(page.getByRole('heading', { name: '唛架编辑', exact: true })).toBeVisible()
}

async function openSpreadingEdit(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-spreading')
  await page.locator('[data-cutting-marker-action="set-tab"][data-tab="spreadings"]').click()
  await page.locator('[data-cutting-marker-action="open-spreading-edit"]').first().click()
  await expect(page.getByRole('heading', { name: '铺布编辑', exact: true })).toBeVisible()
}

test('唛架编辑弹层可新增删除结构行，并支持 Esc 关闭', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openMarkerEdit(page)

  if ((await page.locator('[data-cutting-marker-action="add-line-item"]').count()) === 0) {
    await page.locator('[data-cutting-marker-draft-field="markerMode"]').selectOption('normal')
  }

  const allocationRows = page.locator('[data-cutting-marker-allocation-field="sourceCutOrderId"]')
  const sizeRows = page.locator('[data-cutting-marker-size-field="sizeLabel"]')
  const lineItems = page.locator('[data-cutting-marker-line-field="layoutCode"]')

  const allocationBefore = await allocationRows.count()
  const sizeBefore = await sizeRows.count()
  const lineBefore = await lineItems.count()

  await page.locator('[data-cutting-marker-action="add-allocation-line"]').click()
  await expect(allocationRows).toHaveCount(allocationBefore + 1)

  await page.locator('[data-cutting-marker-action="add-size-row"]').click()
  await expect(sizeRows).toHaveCount(sizeBefore + 1)

  await page.locator('[data-cutting-marker-action="add-line-item"]').click()
  await expect(lineItems).toHaveCount(lineBefore + 1)

  await page.locator('[data-cutting-marker-action="remove-line-item"]').last().click()
  await expect(lineItems).toHaveCount(lineBefore)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: '唛架详情', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('铺布编辑弹层可新增删除卷与卷下人员', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openSpreadingEdit(page)

  const rollRows = page.locator('[data-cutting-spreading-roll-field="rollNo"]')
  const operatorRows = page.locator('[data-cutting-spreading-operator-field="operatorName"]')
  const rollBefore = await rollRows.count()
  const operatorBefore = await operatorRows.count()

  await page.locator('[data-cutting-marker-action="add-roll"]').first().click()
  await expect(rollRows).toHaveCount(rollBefore + 1)

  await page.locator('[data-cutting-marker-action="add-operator-for-roll"]').last().click()
  await expect(operatorRows).toHaveCount(operatorBefore + 1)

  await page.locator('[data-cutting-marker-action="remove-roll"]').last().click()
  await expect(rollRows).toHaveCount(rollBefore)
  await expect(operatorRows).toHaveCount(operatorBefore)

  await expectNoPageErrors(errors)
})

test('唛架与铺布提交链可保存、返回详情、标记进行中并完成铺布', async ({ page }) => {
  const errors = collectPageErrors(page)
  const markerNote = `自动化保存-${Date.now()}`
  const spreadingColorSummary = `铺布颜色摘要-${Date.now()}`

  await openMarkerEdit(page)
  await page.locator('[data-cutting-marker-draft-field="note"]').fill(markerNote)
  await page.locator('[data-cutting-marker-action="save-marker"]').click()
  await expect(page.getByText('已保存', { exact: false }).first()).toBeVisible()

  await page.reload()
  await expect(page.locator('[data-cutting-marker-draft-field="note"]')).toHaveValue(markerNote)

  await page.locator('[data-cutting-marker-action="save-marker-and-view"]').click()
  await expect(page.getByRole('heading', { name: '唛架详情', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText(markerNote)

  await openSpreadingEdit(page)
  await page.locator('[data-cutting-spreading-draft-field="colorSummary"]').fill(spreadingColorSummary)
  await page.locator('[data-cutting-marker-action="save-spreading"]').click()
  await expect(page.getByText('已保存', { exact: false }).first()).toBeVisible()

  await page.reload()
  await expect(page.locator('[data-cutting-spreading-draft-field="colorSummary"]')).toHaveValue(spreadingColorSummary)

  await page.locator('[data-cutting-marker-action="set-spreading-status"][data-status="IN_PROGRESS"]').click()
  await expect(page.locator('body')).toContainText('已标记为“进行中”')

  await page.reload()
  await expect(page.locator('[data-cutting-spreading-draft-field="status"]')).toHaveValue('IN_PROGRESS')

  await page.locator('[data-cutting-marker-action="save-spreading-and-view"]').click()
  await expect(page.getByRole('heading', { name: '铺布详情', exact: true })).toBeVisible()

  await page.locator('[data-cutting-marker-action="open-spreading-edit"]').click()
  await expect(page.getByRole('heading', { name: '铺布编辑', exact: true })).toBeVisible()
  await page.locator('[data-cutting-marker-action="complete-spreading"]').click()
  await expect(page.getByRole('heading', { name: '铺布详情', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('已完成')

  await page.reload()
  await expect(page.locator('body')).toContainText('已完成')

  await expectNoPageErrors(errors)
})

test('占位按钮已退场，编辑弹层骨架保持稳定', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openMarkerEdit(page)
  await expect(page.locator('[data-cutting-marker-action="guide-marker-import"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-marker-action="show-marker-import-status"]')).toHaveCount(0)
  await expect(page.getByText('换一功能占位')).toHaveCount(0)
  await expect(page.locator('[data-cutting-marker-action="save-marker"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="save-marker-and-view"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="cancel-marker-edit"]')).toBeVisible()

  await openSpreadingEdit(page)
  await expect(page.locator('[data-cutting-marker-action="guide-marker-import"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-marker-action="show-marker-import-status"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '从唛架导入铺布', exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="save-spreading"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="save-spreading-and-view"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="cancel-spreading-edit"]')).toBeVisible()

  await expectNoPageErrors(errors)
})
