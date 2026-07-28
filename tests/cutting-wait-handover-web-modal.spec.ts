import { expect, test, type Page } from '@playwright/test'

const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'

async function openModalAndMeasure(
  page: Page,
  action: 'bagging' | 'inbound' | 'handover',
): Promise<number> {
  return page.evaluate(async (actionName) => {
    const trigger = document.querySelector<HTMLButtonElement>(
      `[data-wait-handover-web-action="open-${actionName}"]`,
    )
    if (!trigger) throw new Error(`未找到弹窗入口：${actionName}`)
    const startedAt = performance.now()
    return new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        observer.disconnect()
        reject(new Error(`弹窗未及时出现：${actionName}`))
      }, 3_000)
      const finishIfReady = () => {
        if (!document.querySelector(`[data-wait-handover-modal="${actionName}"]`)) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve(performance.now() - startedAt)
      }
      const observer = new MutationObserver(finishIfReady)
      observer.observe(document.body, { childList: true, subtree: true })
      trigger.click()
      finishIfReady()
    })
  }, action)
}

test('待交出仓保留原工作台，三个中转袋操作均在当前页面打开弹窗', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(WAIT_HANDOVER_PATH, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  if ((await page.locator('body').innerText()).trim().length < 20) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  await expect(page.getByRole('heading', { name: '裁床待交出仓' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: '库存明细', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '特种工艺回收入仓', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '库区库位', exact: true })).toBeVisible()
  await expect(page.locator('[data-wait-handover-web-selector]')).toHaveCount(0)
  await page.getByRole('heading', { name: '裁床待交出仓' }).evaluate((heading) => {
    heading.dataset.waitHandoverWorkbenchStable = 'true'
  })

  const actions = [
    { label: '菲票装袋', action: 'bagging' },
    { label: '中转袋入仓', action: 'inbound' },
    { label: '中转袋交出', action: 'handover' },
  ] as const

  for (const item of actions) {
    const urlBefore = page.url()
    const openDurationMs = await openModalAndMeasure(page, item.action)

    const dialog = page.locator(`[data-wait-handover-modal="${item.action}"]`)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: item.label, exact: true })).toBeVisible()
    expect(page.url()).toBe(urlBefore)
    expect(openDurationMs, `${item.label}弹窗响应必须低于 200ms`).toBeLessThan(200)
    await dialog.getByText('关闭', { exact: true }).click()
    await expect(dialog).toHaveCount(0)

    await page
      .locator(`[data-wait-handover-web-action="open-${item.action}"]`)
      .click()
    await expect(dialog).toBeVisible()

    if (item.action === 'bagging') {
      await dialog.locator('[data-wait-handover-web-field="bagCode"]').fill('WEB-BAG-001')
      await dialog.locator('[data-wait-handover-web-field="ticketCode"]').fill('WEB-FEI-001')
      await dialog.getByRole('button', { name: '加入', exact: true }).click()
      await expect(dialog).toContainText('WEB-FEI-001')
      await dialog.getByRole('button', { name: '确认装袋', exact: true }).click()
      await expect(dialog).toContainText('装袋成功')
    } else if (item.action === 'inbound') {
      await dialog.locator('[data-wait-handover-web-field="bagCode"]').fill('WEB-BAG-002')
      await dialog.locator('[data-wait-handover-web-field="locationCode"]').fill('裁床仓 A-01')
      await dialog.getByRole('button', { name: '确认入仓', exact: true }).click()
      await expect(dialog).toContainText('入仓成功')
    } else {
      await dialog.locator('[data-wait-handover-web-field="bagCode"]').fill('WEB-BAG-003')
      await dialog.locator('[data-wait-handover-web-field="sewingTaskCode"]').fill('SEW-TASK-001')
      await dialog.getByRole('button', { name: '查询任务', exact: true }).click()
      await expect(
        dialog.locator('[data-wait-handover-web-field="productionOrderNo"]'),
      ).toHaveValue('PO-H000123')
      await expect(
        dialog.locator('[data-wait-handover-web-field="receiverFactoryName"]'),
      ).toHaveValue('印尼一厂')
      await dialog.getByRole('button', { name: '确认整袋交出', exact: true }).click()
      await expect(dialog).toContainText('交出成功')
    }
    expect(page.url()).toBe(urlBefore)
    await expect(page.locator('[data-wait-handover-workbench-stable="true"]')).toHaveCount(1)

    await dialog.getByText('关闭', { exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
})
