import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  buildBindingProcessOrders,
  type BindingProcessOrder,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  createPdaSessionFromUser,
  listFactoryPdaUsers,
} from '../src/data/fcs/store-domain-pda.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test.use({ viewport: { width: 360, height: 640 } })

async function setFactorySession(page: Page, factoryId: string): Promise<void> {
  const user = listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && ['ROLE_OPERATOR', 'ROLE_ADMIN'].includes(item.roleId))
  if (!user) throw new Error(`${factoryId} 缺少可用 PDA 账号`)
  const session = createPdaSessionFromUser(user)
  await page.addInitScript((value) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(value))
  }, session)
}

async function expectBefore(first: Locator, second: Locator): Promise<void> {
  const secondHandle = await second.elementHandle()
  if (!secondHandle) throw new Error('缺少用于顺序断言的第二个节点')
  const firstComesBefore = await first.evaluate((firstNode, secondNode) => (
    Boolean(firstNode.compareDocumentPosition(secondNode) & Node.DOCUMENT_POSITION_FOLLOWING)
  ), secondHandle)
  expect(firstComesBefore).toBe(true)
}

function selectBindingReceiveOrder(): BindingProcessOrder {
  const order = buildBindingProcessOrders().find((item) =>
    item.status === '待加工'
    && item.bindingDetails.some((detail) => detail.requiredLength > detail.receivedMaterialLength),
  )
  if (!order) throw new Error('缺少待接收面料的捆条加工单')
  return order
}

test('捆条加工单逐标签接收面料，扫码为主且业务记录与扫码批次关联', async ({ page }) => {
  const errors = collectPageErrors(page)
  const order = selectBindingReceiveOrder()
  const detail = order.bindingDetails.find((item) => item.requiredLength > item.receivedMaterialLength)
  if (!detail) throw new Error(`${order.bindingOrderNo} 缺少待接收规格`)
  await setFactorySession(page, order.factoryId)

  await page.goto(`/fcs/pda/exec/BINDING_PROCESS_ORDER/${encodeURIComponent(order.bindingOrderId)}?surface=handover&handoverAction=receive`)

  const panel = page.locator('[data-pda-physical-scan-panel]')
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const workOrderDetails = page.getByTestId('pda-work-order-details')
  await expect(panel).toBeVisible()
  await expect(actionPanel).toBeVisible()
  await expect(workOrderDetails).toBeVisible()
  await expect(workOrderDetails).not.toHaveAttribute('open', '')
  await expect(workOrderDetails.getByText(order.bindingOrderId)).toBeHidden()
  await expectBefore(actionPanel, workOrderDetails)
  await expect(page.locator('body')).not.toContainText('查看历史和流转')
  const scanner = panel.locator('input[data-physical-input-method="SCANNER"]')
  await expect(scanner).toBeFocused()
  await expect(scanner).toHaveAttribute('placeholder', '扫描或输入面料标签')
  await expect(page.locator('[data-pda-execd-field="bindingQty"]')).toHaveCount(0)
  await expect(panel.locator('details').filter({ hasText: '无法扫码？手动输入' })).toHaveCount(0)

  const code = `MAT-${order.bindingOrderNo}-${detail.bindingStripNo}-01`
  await scanner.fill(code)
  await scanner.press('Enter')
  await expect(panel.locator('[data-pda-physical-scan-line]')).toContainText(code)
  await expect(panel.locator('[data-pda-physical-scan-line]')).toContainText('扫码')
  const submit = page.locator('[data-pda-execd-action="binding-confirm-receive"]')
  await expect(submit).toHaveText('确认本批接收（1 张）')
  await page.screenshot({ path: 'output/playwright/pda-density-fix/binding-receive-physical-scan-360x640.png', fullPage: true })
  await submit.click()

  await expect(page.locator('#app')).not.toContainText('最近扫码批次')
  await expect(page.locator('#app')).not.toContainText('查看历史和流转')
  await expectNoPageErrors(errors)
})

test('捆条加工单交出必须先扫描加工后捆条标签，不能按汇总数量直接提交', async ({ page }) => {
  const errors = collectPageErrors(page)
  const order = buildBindingProcessOrders().find((item) =>
    item.status !== '已取消'
    && item.actualOutputQty > (item.handedOverQty || 0),
  )
  if (!order) throw new Error('缺少可交出的捆条加工单')
  await setFactorySession(page, order.factoryId)

  await page.goto(`/fcs/pda/exec/BINDING_PROCESS_ORDER/${encodeURIComponent(order.bindingOrderId)}?surface=handover&handoverAction=handout`)

  const panel = page.locator('[data-pda-physical-scan-panel]')
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const workOrderDetails = page.getByTestId('pda-work-order-details')
  const submit = page.locator('[data-pda-execd-action="binding-submit-handover"]')
  await expect(panel).toBeVisible()
  await expect(actionPanel).toBeVisible()
  await expect(workOrderDetails).toBeVisible()
  await expect(workOrderDetails).not.toHaveAttribute('open', '')
  await expectBefore(actionPanel, workOrderDetails)
  await expect(submit).toBeDisabled()
  await expect(page.locator('[data-pda-execd-field="bindingQty"]')).toHaveCount(0)

  const code = `OUT-${order.bindingOrderNo}-01`
  const scanner = panel.locator('input[data-physical-input-method="SCANNER"]')
  await scanner.fill(code)
  await scanner.press('Enter')
  await expect(submit).toHaveText('确认本批交出（1 张）')
  await page.screenshot({ path: 'output/playwright/pda-density-fix/binding-handout-physical-scan-360x640.png', fullPage: true })
  await submit.click()

  await expect(page.locator('#app')).not.toContainText('最近扫码批次')
  await expect(page.locator('#app')).not.toContainText('查看历史和流转')
  await expectNoPageErrors(errors)
})
