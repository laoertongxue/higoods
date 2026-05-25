import { expect, test, type Page } from '@playwright/test'

import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function readDataNav(page: Page, selector: string): Promise<string> {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  const nav = await target.getAttribute('data-nav')
  expect(nav, `缺少 data-nav: ${selector}`).toBeTruthy()
  return nav!
}

test('菲票打印按铺布单展示，并在详情中展开该铺布单下全部部位明细', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fei-tickets', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('body')).toContainText('菲票打印', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('铺布单', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('菲票明细', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('编号范围', { timeout: 20_000 })
  await expect(page.locator('button[data-nav*="/fcs/craft/cutting/fei-tickets/spreading%3A"]').first()).toBeVisible({ timeout: 20_000 })

  const detailPath = await readDataNav(page, 'button[data-nav*="/fcs/craft/cutting/fei-tickets/spreading%3A"]')
  await page.goto(detailPath)
  await expect(page.locator('body')).toContainText('铺布单菲票明细', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('该铺布单下全部部位明细', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('部位裁片编号范围', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('单条详情', { timeout: 20_000 })
  await expect(page.locator('body')).not.toContainText('根据计划数量生成菲票')
  await expect(page.locator('body')).not.toContainText('根据需求数量生成菲票')

  await expectNoPageErrors(errors)
})

test('菲票打印投影不再包含参考理论值兜底', async ({ page }) => {
  const errors = collectPageErrors(page)
  const projection = buildFeiTicketPrintProjection()
  const fallbackUnit = projection.printableViewModel.units.find(
    (unit) => unit.ticketCountBasisType === 'THEORETICAL_FALLBACK',
  )

  expect(fallbackUnit).toBeFalsy()

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.locator('body')).toContainText('菲票打印', { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('铺布单', { timeout: 20_000 })
  await expect(page.locator('body')).not.toContainText('参考理论值')
  await expect(page.locator('body')).not.toContainText('当前尚未形成完整铺布完成结果')
  expect(projection.printableViewModel.units.every((unit) => unit.ticketCountBasisType !== 'THEORETICAL_FALLBACK')).toBeTruthy()

  await expectNoPageErrors(errors)
})
