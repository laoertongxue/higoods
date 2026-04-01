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

test('同款同料 mock 能真实支撑快速选择可合并裁剪', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  const bucketCards = page.getByTestId('cutting-cuttable-pool-quick-select-entry')
  const bucketCount = await bucketCards.count()
  expect(bucketCount).toBeGreaterThanOrEqual(3)

  const multiBucketIndexes: number[] = []
  const st081BucketIndexes: number[] = []
  for (let index = 0; index < bucketCount; index += 1) {
    const text = await bucketCards.nth(index).textContent()
    if (parseBucketCount(text) > 1) multiBucketIndexes.push(index)
    if (text?.includes('ST-081')) st081BucketIndexes.push(index)
  }
  expect(multiBucketIndexes.length).toBeGreaterThanOrEqual(2)
  expect(st081BucketIndexes.length).toBeGreaterThanOrEqual(3)

  let sharedOrderBucketCount = 0
  for (const index of st081BucketIndexes.slice(0, 3)) {
    await expect(bucketCards.nth(index)).toContainText('ST-081')
    if ((await bucketCards.nth(index).textContent())?.match(/生产单 [23] 个/)) sharedOrderBucketCount += 1
  }
  expect(sharedOrderBucketCount).toBeGreaterThanOrEqual(2)

  await expect(page.getByText(/生产单状态：整单可裁/).first()).toBeVisible()
  await expect(page.getByText(/生产单状态：部分可裁/).first()).toBeVisible()
  await expect(page.getByText(/生产单状态：整单不可裁/).first()).toBeVisible()

  const sidebar = page.getByTestId('cutting-cuttable-pool-selected-sidebar')

  const firstMultiBucket = bucketCards.nth(multiBucketIndexes[0])
  const firstKey = await firstMultiBucket.locator('[data-cuttable-pool-action="select-quick-bucket"]').first().getAttribute('data-compatibility-key')
  expect(firstKey).toBeTruthy()
  const firstBucketCount = parseBucketCount(await firstMultiBucket.textContent())
  expect(firstBucketCount).toBeGreaterThan(1)

  await firstMultiBucket.getByRole('button', { name: '快速选择' }).click()
  expect(parseSelectedCount(await sidebar.textContent())).toBe(firstBucketCount)

  let secondMultiBucketIndex = multiBucketIndexes[1]
  for (const index of multiBucketIndexes.slice(1)) {
    const nextKey = await bucketCards.nth(index).locator('[data-cuttable-pool-action="select-quick-bucket"]').first().getAttribute('data-compatibility-key')
    if (nextKey && nextKey !== firstKey) {
      secondMultiBucketIndex = index
      break
    }
  }

  const secondMultiBucket = bucketCards.nth(secondMultiBucketIndex)
  const secondBucketCount = parseBucketCount(await secondMultiBucket.textContent())
  expect(secondBucketCount).toBeGreaterThan(1)

  await secondMultiBucket.getByRole('button', { name: '快速选择' }).click()
  await expect(page.getByText(/已切换到 .* 的可合并裁剪清单。/)).toBeVisible()
  expect(parseSelectedCount(await sidebar.textContent())).toBe(secondBucketCount)

  await expectNoPageErrors(errors)
})
