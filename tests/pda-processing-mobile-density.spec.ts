import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  APF_PDA_SESSION,
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'

async function expectBefore(first: Locator, second: Locator): Promise<void> {
  const order = await first.evaluate((firstNode, secondNode) => {
    return Boolean(firstNode.compareDocumentPosition(secondNode) & Node.DOCUMENT_POSITION_FOLLOWING)
  }, await second.elementHandle())
  expect(order).toBe(true)
}

async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
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
  await expect(tabs.getByRole('button')).toHaveCount(2)
  await expect(tabs.getByRole('button', { name: /^加工中/ })).toBeVisible()
  await expect(tabs.getByRole('button', { name: /^已完成/ })).toBeVisible()
  await expect(tabs).not.toContainText('待接收')
  await expect(tabs).not.toContainText('待交出')
  await expect(scanner).toBeVisible()
  await expect(firstCardOrEmpty).toBeVisible()
  await expectBefore(tabs, scanner)
  await expectBefore(scanner, firstCardOrEmpty)

  await expect(page.locator('body')).not.toContainText('工艺加工单')
  await expect(page.locator('body')).not.toContainText('任务仅作来源追溯')
  await expect(page.getByRole('button', { name: '查生产', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '确认接收', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发起交出', exact: true })).toHaveCount(0)
  await expect(page.getByText(/第\s*\d+\s*\/\s*\d+\s*页/)).toHaveCount(0)

  await page.screenshot({ path: 'output/playwright/pda-density-fix/exec-final-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})

test('执行页只拦截待接收单，已有加工填报的待交出单仍可继续填报和完成', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/exec')
  const tabs = page.getByTestId('pda-exec-special-craft-tabs')
  const scanner = page.locator('[data-pda-exec-special-craft-scan]')
  const input = scanner.locator('[data-pda-exec-field="specialCraftScanKeyword"]')
  const countsBeforeScan = await tabs.textContent()

  await input.fill('AUX-PO14672-0001-01')
  await scanner.getByRole('button', { name: '识别加工单', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec(?:\?|$)/)
  await expect(scanner).toContainText('该加工单待接收，请到“交接-待接收”处理。')
  await expect(scanner.locator('[data-pda-special-craft-scan-candidate]')).toHaveCount(0)
  expect(await tabs.textContent()).toBe(countsBeforeScan)

  await input.fill('AUX-PO14672-0002-02')
  await scanner.getByRole('button', { name: '识别加工单', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\/SPECIAL_CRAFT\/AUX-TASK-PO202603083-TING-02-6b1424b3/)
  const processScanPanel = page.locator('[data-pda-physical-scan-panel][data-scan-action="PROCESS_REPORT"]')
  await expect(processScanPanel).toBeVisible({ timeout: 30_000 })
  await expect(processScanPanel.locator('[data-pda-physical-code-input]')).toHaveAttribute('placeholder', '扫描或输入裁片菲票')
  await expect(page.getByRole('button', { name: '完成加工单', exact: true })).toBeVisible()
  await expect(page.getByTestId('pda-work-order-details')).not.toHaveAttribute('open', '')
  await expectNoPageErrors(errors)
})

test('裁片加工填报逐张扫菲票并填数量，填报后可在未交出时完成加工单', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  const order = listSpecialCraftTaskOrders().find((item) => item.taskOrderNo === 'AUX-PO14672-0002-02')
  const line = order?.lineProgress?.find((item) => item.feiTicketNo && item.receivedQty > item.completedQty)
  if (!order || !line?.feiTicketNo) throw new Error('缺少可继续加工填报的裁片加工单')

  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}`)
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const scanPanel = actionPanel.locator('[data-pda-physical-scan-panel][data-scan-action="PROCESS_REPORT"]')
  await expect(scanPanel).toBeVisible({ timeout: 30_000 })
  await expect(actionPanel.locator('header')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('执行 · 加工填报')

  const scanInput = page.getByLabel('扫描或输入裁片菲票')
  await scanInput.fill(line.feiTicketNo)
  await scanInput.press('Enter')
  await page.getByLabel(`${line.feiTicketNo}本次数量`).fill('1')
  const reportButton = page.locator('[data-pda-execd-action="special-process-report"]')
  await expect(reportButton).toHaveText('确认本批加工填报（1 张）')
  await expect(page.locator('#pda-exec-detail-toast-root')).toHaveCount(0, { timeout: 5_000 })
  await page.screenshot({ path: 'output/playwright/pda-density-fix/process-report-fei-ticket-ready-360x640.png', fullPage: true })
  await reportButton.click()

  await expect(page.locator('#app')).toContainText(`累计完工：${order.completedQty + 1} 片`)
  await expect(page.locator('#app')).toContainText('累计交出：0 片')
  const completeButton = page.getByRole('button', { name: '完成加工单', exact: true })
  await expect(completeButton).toBeVisible()
  await completeButton.click()
  await expect(page.locator('#app')).toContainText('已完结')
  await expect(page.locator('[data-pda-physical-scan-panel]')).toHaveCount(0)
  await expect(page.locator('#app')).toContainText('加工单已完成')
  await expect(page.locator('#pda-exec-detail-toast-root')).toHaveCount(0, { timeout: 5_000 })

  await page.screenshot({ path: 'output/playwright/pda-density-fix/process-report-fei-ticket-final-360x640.png', fullPage: true })

  await navigateInApp(page, `/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}?surface=handover&handoverAction=handout`)
  const handoutInput = page.getByLabel('扫描或输入加工后裁片菲票')
  await expect(handoutInput).toBeVisible({ timeout: 30_000 })
  await handoutInput.fill(line.feiTicketNo)
  await handoutInput.press('Enter')
  await page.getByLabel(`${line.feiTicketNo}本次数量`).fill('1')
  await page.locator('[data-pda-execd-action="special-submit-handover"]').click()
  await expect(page.locator('#app')).toContainText('累计交出：1 片')
  const completedDetails = page.getByTestId('pda-work-order-details')
  await expect(completedDetails).toContainText('已完结')
  await expect(page.locator('#pda-exec-detail-toast-root')).toHaveCount(0, { timeout: 5_000 })
  await completedDetails.locator('summary').click()
  await page.screenshot({ path: 'output/playwright/pda-density-fix/completed-order-handout-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})

test('交接页只保留待接收和待交出，进入加工单后扫码置顶且详情默认收起', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover?tab=pickup')

  const tabs = page.getByTestId('pda-handover-tabs')
  const scanner = page.locator('[data-pda-handover-special-craft-scan]')
  await expect(tabs).toBeVisible()
  await expect(tabs.getByRole('button')).toHaveCount(2)
  await expect(tabs.getByRole('button', { name: /^待接收/ })).toBeVisible()
  await expect(tabs.getByRole('button', { name: /^待交出/ })).toBeVisible()
  await expect(tabs).not.toContainText('已完成')
  await expect(scanner).toBeVisible()
  await expectBefore(tabs, scanner)
  await expect(page.getByTestId('pickup-head-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '查生产', exact: true })).toHaveCount(0)

  const pendingOrder = listSpecialCraftTaskOrders().find((item) => item.factoryId === 'FAC-APF' && item.status === '待接收' && item.lineProgress?.some((line) => line.feiTicketNo))
  if (!pendingOrder) throw new Error('缺少 APF 待接收裁片加工单')
  await scanner.locator('[data-pda-handover-field="specialCraftScanKeyword"]').fill(pendingOrder.taskOrderNo)
  await scanner.getByRole('button', { name: '识别加工单', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(pendingOrder.taskOrderId)}`))
  const physicalPanel = page.locator('[data-pda-physical-scan-panel]')
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const workOrderDetails = page.getByTestId('pda-work-order-details')
  await expect(physicalPanel).toBeVisible()
  await expect(actionPanel).toBeVisible()
  await expect(actionPanel.locator('header')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('交接 · 确认接收')
  await expect(workOrderDetails).toBeVisible()
  await expect(workOrderDetails).not.toHaveAttribute('open', '')
  await expect(workOrderDetails.getByText(pendingOrder.taskOrderId)).toBeHidden()
  await expectBefore(actionPanel, workOrderDetails)
  await expect(page.locator('body')).not.toContainText('查看历史和流转')
  const physicalScanner = physicalPanel.locator('input[data-physical-input-method="SCANNER"]')
  await expect(physicalScanner).toBeFocused()
  await expect(physicalScanner).toHaveAttribute('placeholder', /扫描.*菲票/)
  await expect(page.locator('[data-pda-execd-action="special-confirm-receive"]')).toBeDisabled()

  await page.screenshot({ path: 'output/playwright/pda-density-fix/handover-final-360x640.png', fullPage: true })
  await expectNoPageErrors(errors)
})

test('发起交出进入具体加工单，逐张扫码后完成一笔部分交出', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  const order = listSpecialCraftTaskOrders().find((item) => item.taskOrderNo === 'AUX-PO14672-0002-02')
  const line = order?.lineProgress?.find((item) => item.feiTicketNo && item.completedQty > item.returnedQty)
  if (!order || !line?.feiTicketNo) throw new Error('缺少可部分交出的压褶加工单')
  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}?surface=handover&handoverAction=handout`)

  const scanInput = page.getByLabel('扫描或输入加工后裁片菲票')
  await scanInput.fill(line.feiTicketNo)
  await scanInput.press('Enter')
  await page.getByLabel(`${line.feiTicketNo}本次数量`).fill('1')
  const submit = page.locator('[data-pda-execd-action="special-submit-handover"]')
  await expect(submit).toHaveText('确认本批交出（1 张）')
  await submit.click()

  await expect(page.locator('#app')).toContainText('累计交出：1 片')
  await expect(page.locator('#app')).not.toContainText('业务记录 ID：')
  await expect(page.locator('#app')).not.toContainText('最近扫码批次')
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
