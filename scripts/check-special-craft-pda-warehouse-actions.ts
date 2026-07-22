#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  executeProcessAction,
  getProcessActionOperationRecordsBySource,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  getSpecialCraftTaskWorkOrderById,
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId,
  listSpecialCraftTaskWorkOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import {
  createPdaSessionFromUser,
  listAllFactoryPdaUsers,
  setPdaSession,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  handlePdaWarehouseWaitProcessEvent,
  renderPdaWarehouseWaitProcessPage,
} from '../src/pages/pda-warehouse-wait-process.ts'
import {
  handlePdaWarehouseWaitHandoverEvent,
  renderPdaWarehouseWaitHandoverPage,
} from '../src/pages/pda-warehouse-wait-handover.ts'
import {
  buildPdaWarehouseActionTarget,
  installPdaContractRuntime,
} from './helpers/pda-contract-runtime.ts'
import { DEDICATED_POST_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'
import { getHandoverRecordsByWorkOrderId } from '../src/data/fcs/process-warehouse-domain.ts'

installPdaContractRuntime().reset()

const workOrder = listSpecialCraftTaskWorkOrders().find((item) => item.targetObject === '成衣' && item.operationName === '烫画')
assert(workOrder, '缺少成衣烫画加工单')
const lines = getSpecialCraftTaskWorkOrderLinesByWorkOrderId(workOrder.workOrderId)
const qtyBySku = Object.fromEntries(lines.map((line) => [line.skuCode, line.planPieceQty]))
const totalQty = Object.values(qtyBySku).reduce((sum, qty) => sum + qty, 0)

executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: workOrder.workOrderId,
  taskId: workOrder.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  objectType: '成衣',
  objectQty: totalQty,
  qtyUnit: '件',
  skuQtyBySkuCode: qtyBySku,
})
executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: workOrder.workOrderId,
  taskId: workOrder.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  objectType: '成衣',
  objectQty: totalQty,
  qtyUnit: '件',
  skuQtyBySkuCode: qtyBySku,
})

const auxiliaryUser = listAllFactoryPdaUsers().find((user) => user.status === 'ACTIVE' && user.factoryId === workOrder.factoryId)
assert(auxiliaryUser, '缺少辅助工艺 PDA 账号')
setPdaSession(createPdaSessionFromUser(auxiliaryUser))

const selectedWaitProcess = listFactoryWaitProcessStockItems()
  .find((item) => item.taskId === workOrder.workOrderId && item.itemKind === '成衣')
assert(selectedWaitProcess, '缺少成衣待加工库存')
const waitProcessHtml = renderPdaWarehouseWaitProcessPage()
assert(waitProcessHtml.includes('来源仓：') && waitProcessHtml.includes('下一动作：加工领料'), '待加工仓必须展示来源仓和真实下一动作')
assert.match(
  waitProcessHtml,
  new RegExp(`data-pda-warehouse-action="special-craft-wait-process-issue"[^>]*data-stock-item-id="${selectedWaitProcess.stockItemId}"[^>]*data-work-order-id="${workOrder.workOrderId}"[^>]*data-sku-code="${selectedWaitProcess.materialSku}"`),
  '待加工仓主按钮必须绑定明确库存、加工单和 SKU',
)
assert.equal(handlePdaWarehouseWaitProcessEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-process-issue',
  { stockItemId: selectedWaitProcess.stockItemId, workOrderId: workOrder.workOrderId, skuCode: selectedWaitProcess.materialSku || '' },
)), true, '待加工仓加工领用必须由真实 handler 处理')
assert.equal(getSpecialCraftTaskWorkOrderById(workOrder.workOrderId)?.status, '加工中', '加工领用必须推进加工单开工')
assert(
  listFactoryWaitProcessStockItems()
    .filter((item) => item.taskId === workOrder.workOrderId && item.itemKind === '成衣')
    .every((item) => item.status === '已领用' && item.availableQty === 0 && item.issuedQty === item.receivedQty),
  '加工领用必须锁定并扣清该加工单成衣待加工库存',
)
assert(!renderPdaWarehouseWaitProcessPage().includes(selectedWaitProcess.stockItemId), '已领用成衣库存不得继续出现在 PDA 待加工操作列表')
assert.throws(() => handlePdaWarehouseWaitProcessEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-process-issue',
  { stockItemId: selectedWaitProcess.stockItemId, workOrderId: workOrder.workOrderId, skuCode: selectedWaitProcess.materialSku || '' },
)), /重复|状态|已领用/, '重复加工领用必须拒绝')

executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: workOrder.workOrderId,
  taskId: workOrder.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  operatorName: auxiliaryUser.name,
  operatorUserId: auxiliaryUser.userId,
  operatorFactoryId: auxiliaryUser.factoryId,
  operatorRoleId: auxiliaryUser.roleId,
  objectType: '成衣',
  objectQty: totalQty,
  qtyUnit: '件',
  skuQtyBySkuCode: qtyBySku,
  skuScrapQtyBySkuCode: Object.fromEntries(lines.map((line) => [line.skuCode, 0])),
  skuDamageQtyBySkuCode: Object.fromEntries(lines.map((line) => [line.skuCode, 0])),
})

const selectedWaitHandover = listFactoryWaitHandoverStockItems()
  .find((item) => item.taskId === workOrder.workOrderId && item.itemKind === '成衣')
assert(selectedWaitHandover, '缺少成衣待交出库存')
const waitHandoverHtml = renderPdaWarehouseWaitHandoverPage()
assert(waitHandoverHtml.includes('下一站：') && waitHandoverHtml.includes('下一动作：交出确认'), '待交出仓必须展示后道下一站和真实下一动作')
assert.match(
  waitHandoverHtml,
  new RegExp(`data-pda-warehouse-action="special-craft-wait-handover-submit"[^>]*data-stock-item-id="${selectedWaitHandover.stockItemId}"[^>]*data-work-order-id="${workOrder.workOrderId}"[^>]*data-sku-code="${selectedWaitHandover.materialSku}"`),
  '待交出仓主按钮必须绑定明确库存、加工单和 SKU',
)
assert.equal(handlePdaWarehouseWaitHandoverEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-handover-submit',
  { stockItemId: selectedWaitHandover.stockItemId, workOrderId: workOrder.workOrderId, skuCode: selectedWaitHandover.materialSku || '' },
)), true, '待交出仓交出必须由真实 handler 处理')
const handover = getHandoverRecordsByWorkOrderId(workOrder.workOrderId).at(0)
assert(handover, '交出主按钮必须创建真实交出记录')
assert.equal(handover.receiveFactoryId, DEDICATED_POST_FACTORY_ID, '交出记录必须指向真实后道主体')
assert.equal(handover.operatorUserId, auxiliaryUser.userId, '交出记录必须保存登录账号审计主体')
assert.equal(handover.operatorFactoryId, auxiliaryUser.factoryId, '交出记录必须保存登录工厂审计主体')
const taskWaitHandoverAfterSubmit = listFactoryWaitHandoverStockItems().filter((item) => item.taskId === workOrder.workOrderId)
assert(
  taskWaitHandoverAfterSubmit.every((item) => item.status === '已交出'),
  `交出后不得继续滞留待交出仓：${JSON.stringify(taskWaitHandoverAfterSubmit.map((item) => ({ id: item.stockItemId, sku: item.materialSku, status: item.status })))}`,
)
assert(
  !renderPdaWarehouseWaitHandoverPage().includes(selectedWaitHandover.stockItemId),
  '已交出的成衣库存不得继续出现在 PDA 待交出操作列表',
)
const handoverAudit = getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', workOrder.workOrderId).at(0)
assert.equal(handoverAudit?.operatorUserId, auxiliaryUser.userId, '交出动作必须保存登录账号审计主体')
assert.equal(handoverAudit?.operatorFactoryId, auxiliaryUser.factoryId, '交出动作必须保存登录工厂审计主体')

console.log('special craft PDA warehouse actions passed')
