import { expect, test } from '@playwright/test'

test('印花两批接收产出交出保留首批条码和未人工完单状态', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-002')
  const root = page.locator('[data-printing-work-order-detail-root]')
  await expect(root).toBeVisible({ timeout: 30_000 })
  const fill = async (title: string, values: Record<string, string>, confirm: string) => {
    const dialog = page.getByRole('dialog', { name: title, exact: true })
    await expect(dialog).toBeVisible()
    for (const [key, value] of Object.entries(values)) await dialog.locator(`[data-printing-dialog-field="${key}"]`).fill(value)
    await dialog.getByRole('button', { name: confirm, exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
  const assertOnePrimary = async () => expect(root.locator('[data-printing-detail-workspace] > header [data-printing-action].bg-blue-600')).toHaveCount(1)
  const facts = () => page.evaluate(async () => {
    const module = await import('/src/data/fcs/printing-work-order-business.ts')
    return module.getPrintingWorkOrderById('PWO-PRINT-002')!
  })
  await root.getByRole('button', { name: '接收加工投入', exact: true }).click()
  await fill('接收加工投入', { receivedQty: '100', receivedRollCount: '2' }, '确认接收')
  for (const [used, rolls] of [['50', '1'], ['150', '3']]) {
    await assertOnePrimary()
    await root.getByRole('button', { name: '填报加工完成', exact: true }).click()
    await fill('填报加工完成', { usedQty: used, usedRollCount: rolls, completedQty: used, completedRollCount: rolls }, '确认加工完成')
    await root.locator('[data-printing-detail-workspace] > header').getByRole('button', { name: '交出', exact: true }).click()
    await fill('交出加工产出', {}, '确认交出')
    await root.locator('[data-printing-detail-workspace] > header').getByRole('button', { name: '接收', exact: true }).click()
    await fill('接收加工产出', {}, '确认接收')
    if (used === '50') {
      await page.evaluate((roll) => { (window as any).__firstPrintingRoll = roll }, (await facts()).barcodes[0])
      await root.getByRole('button', { name: '继续接收投入', exact: true }).click()
      await fill('接收加工投入', { receivedQty: '100', receivedRollCount: '2' }, '确认接收')
    }
  }
  const result = await facts()
  expect(result.actualInput.receivedQty).toBe(200)
  expect(result.output.completedQty).toBe(150)
  expect(result.handover.receivedQty).toBe(150)
  expect(result.manuallyCompletedAt).toBeUndefined()
  expect(result.barcodes[0]).toEqual(await page.evaluate(() => (window as any).__firstPrintingRoll))
  await page.screenshot({ path: 'output/playwright/process-route-review/printing-two-batches.png', fullPage: true })
})
