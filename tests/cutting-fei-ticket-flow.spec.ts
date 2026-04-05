import { expect, test, type Page } from '@playwright/test'

import { buildGeneratedFeiTicketTraceMatrix } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function getStageTab(page: Page, label: string) {
  return page
    .getByTestId('cutting-spreading-stage-tabs')
    .getByRole('button', { name: new RegExp(`^${label}（`) })
}

async function getStageCount(page: Page, label: string) {
  const text = (await (await getStageTab(page, label)).textContent()) || ''
  const matched = text.match(/（(\d+)）/)
  return matched ? Number(matched[1]) : 0
}

test('待打印菲票的铺布 session 可进入打印菲票，打印单元能追溯到 spreadingSessionId', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  expect(await getStageCount(page, '待打印菲票')).toBeGreaterThan(0)

  await (await getStageTab(page, '待打印菲票')).click()
  const row = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: '去打印菲票' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fei-tickets\?/)
  await expect(page).toHaveURL(/spreadingSessionId=/)
  const listUrl = new URL(page.url())
  const expectedSessionNo = listUrl.searchParams.get('spreadingSessionNo') || ''
  const expectedSessionId = listUrl.searchParams.get('spreadingSessionId') || ''
  expect(expectedSessionNo || expectedSessionId).not.toBe('')
  expect(buildGeneratedFeiTicketTraceMatrix().some((row) => row.sourceSpreadingSessionId === expectedSessionId)).toBeTruthy()
  await expect(page.getByRole('heading', { level: 1, name: '打印菲票' })).toBeVisible()
  await expect(page.locator('body')).toContainText('来源铺布')
  await expect(page.locator('body')).toContainText(expectedSessionNo || expectedSessionId)

  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page.locator('body')).toContainText('来源铺布')
  await expect(page.locator('body')).toContainText(expectedSessionNo || expectedSessionId)

  await expectNoPageErrors(errors)
})
