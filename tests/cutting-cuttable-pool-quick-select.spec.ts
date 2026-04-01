import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

function parseSelectedCount(text: string | null): number {
  const match = text?.match(/已选原始裁片单\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

function parseBucketCount(text: string | null): number {
  const match = text?.match(/可裁\s*(\d+)\s*个/)
  return match ? Number(match[1]) : 0
}

test('快速选择可合并裁剪支持同组追加和异组替换', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  const sidebar = page.getByTestId('cutting-cuttable-pool-selected-sidebar')
  await expect(sidebar).toBeVisible()

  const bucketCards = page.getByTestId('cutting-cuttable-pool-quick-select-entry')
  const bucketCount = await bucketCards.count()
  expect(bucketCount).toBeGreaterThan(1)

  const targetBucket = bucketCards.first()
  const globalQuickButton = targetBucket.locator('[data-cuttable-pool-action="select-quick-bucket"]').first()
  const compatibilityKey = await globalQuickButton.getAttribute('data-compatibility-key')
  expect(compatibilityKey).toBeTruthy()

  const orderScopedButton = page.locator(
    `[data-cuttable-pool-action="select-quick-bucket"][data-order-id][data-compatibility-key="${compatibilityKey}"]`,
  ).first()
  await expect(orderScopedButton).toBeVisible()

  await orderScopedButton.click()

  const countAfterOrderScopedSelect = parseSelectedCount(await sidebar.textContent())

  await globalQuickButton.click()
  const countAfterAppend = parseSelectedCount(await sidebar.textContent())
  expect(countAfterAppend).toBeGreaterThanOrEqual(countAfterOrderScopedSelect)

  let replaceBucketIndex = -1
  for (let index = 0; index < bucketCount; index += 1) {
    if (index === 0) continue
    const button = bucketCards.nth(index).locator('[data-cuttable-pool-action="select-quick-bucket"]').first()
    const nextKey = await button.getAttribute('data-compatibility-key')
    if (nextKey && nextKey !== compatibilityKey) {
      replaceBucketIndex = index
      break
    }
  }

  expect(replaceBucketIndex).toBeGreaterThanOrEqual(0)

  const replaceBucket = bucketCards.nth(replaceBucketIndex)
  const replaceBucketCount = parseBucketCount(await replaceBucket.textContent())
  await replaceBucket.locator('[data-cuttable-pool-action="select-quick-bucket"]').first().click()

  await expect(page.getByText(/已切换到 .* 的可合并裁剪清单。/)).toBeVisible()
  const countAfterReplace = parseSelectedCount(await sidebar.textContent())
  expect(countAfterReplace).toBe(replaceBucketCount)
  await expect(page.getByText('当前生产单下包含多个兼容组，请直接勾选具体原始裁片单，或先选中同一料项后继续扩选。')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
