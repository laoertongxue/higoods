import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

async function getAvailableExecTabs(page: Page): Promise<Array<{ index: number; label: string; count: number }>> {
  return page.getByTestId('pda-exec-tabs').getByRole('button').evaluateAll((buttons) =>
    buttons.map((button, index) => {
      const text = button.textContent || ''
      const normalizedText = text.replace(/\s+/g, ' ').trim()
      const matched = normalizedText.match(/^(.*?)[（(]\s*(\d+)\s*[）)]$/)
      return {
        index,
        label: matched?.[1]?.trim() || normalizedText,
        count: matched ? Number(matched[2]) : 0,
      }
    }),
  )
}

async function ensureExecPageHasCards(page: Page): Promise<void> {
  const factorySelect = page.locator('[data-pda-exec-field="factoryId"]')
  const factoryValues = await factorySelect.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
  )

  for (const factoryValue of factoryValues) {
    await factorySelect.selectOption(factoryValue)
    const availableTabs = (await getAvailableExecTabs(page)).filter((tab) => tab.count > 0)
    if (availableTabs.length > 0) return
  }

  throw new Error('PDA 执行页当前没有可展示的任务卡片。')
}

async function expectTabsGapAndCardFields(page: Page): Promise<void> {
  const tabs = page.getByTestId('pda-exec-tabs')
  const firstCard = page.getByTestId('pda-exec-task-card').first()

  await expect(tabs).toBeVisible()
  await expect(firstCard).toBeVisible()

  const tabsBox = await tabs.boundingBox()
  const firstCardBox = await firstCard.boundingBox()
  expect(tabsBox).not.toBeNull()
  expect(firstCardBox).not.toBeNull()
  expect(firstCardBox!.y - (tabsBox!.y + tabsBox!.height)).toBeGreaterThanOrEqual(8)

  const cardText = await firstCard.innerText()
  expect(cardText).toContain('生产单号')
  expect(cardText).toContain('原始任务')
  expect(cardText).toContain('当前工序')
  expect(
    cardText.includes('本单成衣件数（件）')
      || cardText.includes('本单布卷数（卷）')
      || cardText.includes('本单铺布层数（层）'),
  ).toBeTruthy()
  expect(cardText).not.toContain('拆分组')
}

test('PDA 执行页 tab 与卡片之间有明确间距，且执行卡片不再显示拆分组', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })
  await page.setViewportSize({ width: 360, height: 800 })

  await page.goto('/fcs/pda/exec')
  await expect(page.getByRole('heading', { level: 1, name: '执行' })).toBeVisible()
  await ensureExecPageHasCards(page)

  const availableTabs = (await getAvailableExecTabs(page)).filter((tab) => tab.count > 0)
  expect(availableTabs.length).toBeGreaterThan(0)

  const firstTab = page.getByTestId('pda-exec-tabs').getByRole('button').nth(availableTabs[0]!.index)
  await firstTab.click()
  await expectTabsGapAndCardFields(page)

  if (availableTabs.length > 1) {
    const secondTab = page.getByTestId('pda-exec-tabs').getByRole('button').nth(availableTabs[1]!.index)
    await secondTab.click()
    await expectTabsGapAndCardFields(page)
  }

  await expect(page.getByTestId('pda-exec-page')).not.toContainText('拆分组')
  await expectNoPageErrors(errors)
})
