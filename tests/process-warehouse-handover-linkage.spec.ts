import { expect, test, type Page } from '@playwright/test'
import { executeMobileProcessAction } from '../src/data/fcs/process-action-writeback-service.ts'
import {
  listProcessHandoverRecords,
  writeBackProcessHandoverRecord,
} from '../src/data/fcs/process-warehouse-domain.ts'
import {
  getSpecialCraftTaskWorkOrderById,
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseOutboundRecords,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { listProcessWorkOrders, type ProcessWorkOrder } from '../src/data/fcs/process-work-order-domain.ts'
import { getAvailableDyeWebActions, getAvailablePrintWebActions } from '../src/data/fcs/process-web-status-actions.ts'

const HEAT_TRANSFER_GARMENT_WORK_ORDER = 'AUX-TASK-PO2026030002-SFER-2ab9e9-03-WO-001-'

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function confirmActionDialog(page: Page, actionName: string) {
  const dialog = page.getByTestId('process-web-status-action-dialog')
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByTestId('process-web-status-action-title')).toHaveText(actionName)
  await dialog.getByTestId('process-web-status-action-confirm').click()
}

function findWorkOrderForWebActions(
  processType: 'PRINT' | 'DYE',
  actionLabels: string[],
): ProcessWorkOrder {
  const getActions = processType === 'PRINT' ? getAvailablePrintWebActions : getAvailableDyeWebActions
  const workOrder = listProcessWorkOrders().find((order) =>
    order.processType === processType
    && actionLabels.includes(getActions(order.workOrderId).find((action) => !action.disabledReason)?.actionLabel || ''),
  )
  if (!workOrder) throw new Error(`未找到可执行 ${actionLabels.join(' / ')} 的真实${processType === 'PRINT' ? '印花' : '染色'}加工单`)
  return workOrder
}

test('烫画和直喷均使用当前辅助工艺入口与真实加工单', async ({ page }) => {
  await page.goto(`/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders/${HEAT_TRANSFER_GARMENT_WORK_ORDER}`)
  await expect(page.getByRole('heading', { name: '加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('烫画')

  await page.goto('/fcs/process-factory/special-craft/aux-op-direct-print/work-orders/AUX-TASK-PO2026030002-RINT-34bb1b-04-WO-001-')
  await expect(page.getByRole('heading', { name: '加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('直喷')
})

test('烫画成衣从成衣仓出库，经辅助待交出仓交我方后道', () => {
  const workOrder = getSpecialCraftTaskWorkOrderById(HEAT_TRANSFER_GARMENT_WORK_ORDER)
  expect(workOrder?.targetObject).toBe('成衣')
  const skuQtyBySkuCode = Object.fromEntries(
    getSpecialCraftTaskWorkOrderLinesByWorkOrderId(HEAT_TRANSFER_GARMENT_WORK_ORDER)
      .map((line) => [line.skuCode, line.planPieceQty]),
  )
  const totalQty = Object.values(skuQtyBySkuCode).reduce((sum, qty) => sum + qty, 0)
  expect(Object.keys(skuQtyBySkuCode)).toHaveLength(4)
  expect(totalQty).toBe(2500)
  const action = (actionCode: string, extra: Record<string, unknown> = {}) => executeMobileProcessAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: HEAT_TRANSFER_GARMENT_WORK_ORDER,
    taskId: workOrder?.taskOrderId,
    actionCode,
    operatorName: '成衣仓与烫画联调员',
    operatorUserId: 'E2E-AUX-OPERATOR',
    operatorFactoryId: actionCode === 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND' ? 'ID-F001' : 'FAC-AUX-HEAT-TRANSFER',
    operatorRoleId: 'ROLE_OPERATOR',
    operatorRoleName: '操作员',
    operatedAt: '2026-07-23 10:00:00',
    objectType: '成衣',
    objectQty: totalQty,
    qtyUnit: '件',
    skuQtyBySkuCode,
    ...extra,
  })

  action('SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND')
  expect(listFactoryWarehouseOutboundRecords().filter((record) => record.sourceTaskId === HEAT_TRANSFER_GARMENT_WORK_ORDER && record.itemKind === '成衣')
    .reduce((sum, record) => sum + record.outboundQty, 0)).toBe(totalQty)
  action('SPECIAL_CRAFT_RECEIVE_CUT_PIECES')
  expect(listFactoryWaitProcessStockItems().filter((item) => item.taskId === HEAT_TRANSFER_GARMENT_WORK_ORDER && item.itemKind === '成衣')
    .reduce((sum, item) => sum + item.receivedQty, 0)).toBe(totalQty)
  action('SPECIAL_CRAFT_START_PROCESS')
  action('SPECIAL_CRAFT_FINISH_PROCESS', {
    skuScrapQtyBySkuCode: Object.fromEntries(Object.keys(skuQtyBySkuCode).map((skuCode) => [skuCode, 0])),
    skuDamageQtyBySkuCode: Object.fromEntries(Object.keys(skuQtyBySkuCode).map((skuCode) => [skuCode, 0])),
  })
  expect(listFactoryWaitHandoverStockItems().filter((item) => item.taskId === HEAT_TRANSFER_GARMENT_WORK_ORDER && item.itemKind === '成衣')
    .reduce((sum, item) => sum + item.waitHandoverQty, 0)).toBe(totalQty)
  const handoverResult = action('SPECIAL_CRAFT_SUBMIT_HANDOVER')
  const handover = listProcessHandoverRecords().find((record) => record.handoverRecordId === handoverResult.affectedHandoverRecordId)
  expect(handover?.receiveFactoryName).toBe('HiGood 后道工厂')
  expect(handover?.handoverObjectQty).toBe(totalQty)
  const received = writeBackProcessHandoverRecord(handoverResult.affectedHandoverRecordId, {
    receiveObjectQty: totalQty,
    receivedQtyBySkuCode: skuQtyBySkuCode,
    receivePerson: '我方后道收货员',
    receiveAt: '2026-07-23 11:00:00',
  })
  expect(received?.receiveObjectQty).toBe(totalQty)
  expect(received?.status).toBe('全部交出')
})

test('印花 Web 完成转印后进入待交出仓', async ({ page }) => {
  const workOrder = findWorkOrderForWebActions('PRINT', ['完成打印'])
  await page.goto(`/fcs/craft/printing/work-orders/${workOrder.workOrderId}`)
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成打印' })).toBeVisible()

  await page.getByRole('button', { name: '完成打印' }).click()
  await confirmActionDialog(page, '完成打印')
  await expect(page.locator('body')).toContainText('待转印')

  await expect(page.getByRole('button', { name: '开始转印' })).toBeVisible()
  await page.getByRole('button', { name: '开始转印' }).click()
  await confirmActionDialog(page, '开始转印')
  await expect(page.locator('body')).toContainText('转印中')

  await expect(page.getByRole('button', { name: '完成转印' })).toBeVisible()
  await page.getByRole('button', { name: '完成转印' }).click()
  await expect(page.getByRole('heading', { name: '完成转印' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('确认执行“完成转印”')
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('完成转印')

  await navigateInApp(page, '/fcs/craft/printing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '印花待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000717')
  await expect(page.locator('body')).toContainText('加工完成数量')
  await expect(page.locator('body')).toContainText('3,000 片')
})

test('染色 Web 完成包装后进入待交出仓', async ({ page }) => {
  const workOrder = findWorkOrderForWebActions('DYE', ['完成烘干'])
  await page.goto(`/fcs/craft/dyeing/work-orders/${workOrder.workOrderId}`)
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()

  for (const actionName of ['完成烘干', '完成定型', '完成打卷']) {
    await expect(page.getByRole('button', { name: actionName })).toBeVisible()
    await page.getByRole('button', { name: actionName }).click()
    await confirmActionDialog(page, actionName)
  }

  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()

  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(page.getByTestId('process-web-status-action-dialog')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: '完成包装' })).toBeVisible()
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('完成包装')

  await navigateInApp(page, '/fcs/craft/dyeing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '染色待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-DYE-000725')
  await expect(page.locator('body')).toContainText('加工完成数量')
  await expect(page.locator('body')).toContainText('米')
  await expect(page.locator('body')).toContainText('卷')
})

test('平台侧仍通过聚合状态展示联动后的风险', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  const printRoot = page.locator('[data-process-print-orders-root]')
  await expect(printRoot).toBeVisible()
  await expect(printRoot.locator('h1')).toHaveText('印花加工单')
  await expect(printRoot).toContainText('平台状态')
  await expect(printRoot).toContainText(/待交出|交出待收货|收货确认中|异常|加工中/)
  await expect(printRoot).not.toContainText('转印中：')

  await page.goto('/fcs/process/dye-orders')
  const dyeRoot = page.locator('[data-process-dye-orders-root]')
  await expect(dyeRoot).toBeVisible()
  await expect(dyeRoot.locator('h1')).toHaveText('染色加工单')
  await expect(dyeRoot).toContainText('平台状态')
  await expect(dyeRoot).toContainText(/待交出|交出待收货|收货确认中|异常|加工中/)
})
