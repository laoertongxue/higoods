import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('按生产业务查询并为具体唛架编号生成一张铺布单', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/cutting/spreading-create')

  const search = page.getByTestId('cutting-spreading-create-business-search').getByRole('textbox')
  await expect(search).toHaveAttribute('placeholder', '生产需求单 / 生产单 / SPU / 裁片单')
  await search.fill('DEM-202603-0014')

  const scheme = page.getByTestId('cutting-spreading-create-scheme-group')
  await expect(scheme).toHaveCount(1)
  await expect(scheme).toContainText('MKP-20260403-007')
  await expect(scheme).toContainText('S × 75 件/层 + M × 75 件/层 + L × 75 件/层 + XL × 75 件/层')

  await scheme.getByRole('button', { name: /查看.*款式大图/ }).click()
  await expect(page.getByRole('dialog', { name: '款式大图' })).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()

  await scheme.getByRole('button', { name: '选中' }).click()
  await expect(page.getByTestId('cutting-spreading-create-action-bar')).toContainText('生成 1 张铺布单')
  await page.getByRole('button', { name: '生成铺布单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await expect(page.getByRole('heading', { level: 1, name: '铺布编辑' })).toBeVisible()

  await page.goto('/fcs/craft/cutting/spreading-create')
  await page.getByTestId('cutting-spreading-create-business-search').getByRole('textbox').fill('DEM-202603-0014')
  const createdScheme = page.getByTestId('cutting-spreading-create-scheme-group')
  await expect(createdScheme).toContainText('1 个已生成')
  await expect(createdScheme.getByRole('button', { name: '已生成' })).toBeDisabled()
  await expect(createdScheme.getByRole('button', { name: 'PB-MKP-20260403-007-A-1' })).toBeVisible()
  await expect(createdScheme).toContainText('待铺布')

  await expectNoPageErrors(errors)
})

test('铺布列表支持拖拽调整列顺序并持久化', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.getByRole('button', { name: '列设置' }).click()

  const sourceColumn = page.locator('[data-standard-list-column-key="material"]')
  const targetColumn = page.locator('[data-standard-list-column-key="source"]')
  await sourceColumn.dragTo(targetColumn)

  const persistedOrder = await page.evaluate(() => {
    const raw = window.localStorage.getItem('higood:list-page:/fcs/craft/cutting/spreading-list')
    return raw ? (JSON.parse(raw) as { order?: string[] }).order || [] : []
  })
  expect(persistedOrder.indexOf('material')).toBeLessThan(persistedOrder.indexOf('source'))

  await page.reload()
  await page.getByRole('button', { name: '列设置' }).click()
  const orderedKeys = await page.locator('[data-standard-list-column-key]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-standard-list-column-key')),
  )
  expect(orderedKeys.indexOf('material')).toBeLessThan(orderedKeys.indexOf('source'))
  await expectNoPageErrors(errors)
})
