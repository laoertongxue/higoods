import { expect, test, type Locator } from '@playwright/test'

import {
  APF_PDA_SESSION,
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

async function expectBefore(first: Locator, second: Locator): Promise<void> {
  const order = await first.evaluate((firstNode, secondNode) => {
    return Boolean(firstNode.compareDocumentPosition(secondNode) & Node.DOCUMENT_POSITION_FOLLOWING)
  }, await second.elementHandle())
  expect(order).toBe(true)
}

test.use({ viewport: { width: 360, height: 640 } })

test('执行页按状态标签、扫码、加工单顺序展示，且不再显示管理端冗余入口', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/exec')

  const tabs = page.getByTestId('pda-exec-special-craft-tabs')
  const scanner = page.locator('[data-pda-exec-special-craft-scan]')
  const firstCardOrEmpty = page.locator('[data-pda-special-craft-work-order-list] > .space-y-3').first()
  await expect(tabs).toBeVisible()
  await expect(scanner).toBeVisible()
  await expect(firstCardOrEmpty).toBeVisible()
  await expectBefore(tabs, scanner)
  await expectBefore(scanner, firstCardOrEmpty)

  await expect(page.locator('body')).not.toContainText('工艺加工单')
  await expect(page.locator('body')).not.toContainText('任务仅作来源追溯')
  await expect(page.getByRole('button', { name: '查生产', exact: true })).toHaveCount(0)
  await expect(page.getByText(/第\s*\d+\s*\/\s*\d+\s*页/)).toHaveCount(0)

  await page.screenshot({ path: 'output/playwright/pda-density-fix/exec-final-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})

test('交接页只保留状态标签、扫码、关键数量和当前动作', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover?tab=pickup')

  const tabs = page.getByTestId('pda-handover-tabs')
  const scanner = page.locator('[data-pda-handover-special-craft-scan]')
  const card = page.getByTestId('pickup-head-card').first()
  await expect(tabs).toBeVisible()
  await expect(scanner).toBeVisible()
  await expect(card).toBeVisible()
  await expectBefore(tabs, scanner)
  await expectBefore(scanner, card)

  await expect(card).toContainText('应收')
  await expect(card).toContainText('已收')
  await expect(card).toContainText('待收')
  await expect(card.getByRole('button', { name: '完成接收单', exact: true })).toBeVisible()
  for (const hiddenLabel of ['任务编号', '原始任务', '来源类型', '交接范围', '交接方式', '接收记录二维码']) {
    await expect(card).not.toContainText(hiddenLabel)
  }
  await expect(page.getByRole('button', { name: '查生产', exact: true })).toHaveCount(0)

  await page.screenshot({ path: 'output/playwright/pda-density-fix/handover-final-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})

test('发起交出直接进入本次交出操作，并可扫码加数量完成一笔部分交出', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover?tab=handout')

  const handoutButton = page.getByRole('button', { name: '发起交出', exact: true }).first()
  await expect(handoutButton).toBeVisible()
  await handoutButton.click()

  const form = page.getByTestId('handout-new-record-form')
  await expect(form).toBeVisible()
  await form.locator('[data-pda-handoverd-field="newRecordScanCode"]').fill('PDA-PARTIAL-HANDOUT-001')
  await form.locator('[data-pda-handoverd-field="newRecordQty"]').fill('1')
  await form.getByRole('button', { name: '确认交出', exact: true }).click()

  await expect(page.getByText(/已生成(?:后道交出|出库)记录/)).toBeVisible()
  await expect(form).toHaveCount(0)
  await page.screenshot({ path: 'output/playwright/pda-density-fix/handout-created-final-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})

test('确认接收详情只展示当前对象、关键数量、当前动作和折叠记录', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'ID-F001',
    fcs_pda_session: GENERIC_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')

  await expect(page.getByText('确认接收', { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('pickup-current-panel-card')).toBeVisible()
  await expect(page.getByText(/接收记录（\d+）/)).toBeVisible()
  for (const hiddenLabel of ['当前记录处理区', '来源与追溯信息', '接收记录二维码', '入库记录', '来源状态']) {
    await expect(page.locator('body')).not.toContainText(hiddenLabel)
  }

  await page.screenshot({ path: 'output/playwright/pda-density-fix/pickup-detail-final-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})
