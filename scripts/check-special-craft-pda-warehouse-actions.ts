#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  executeProcessAction,
  getProcessActionOperationRecordsBySource,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  getSpecialCraftTaskOrderById,
  listSpecialCraftTaskOrders,
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
import { dispatchPdaPageEvent } from '../src/main-handlers/pda-handlers.ts'

const runtime = installPdaContractRuntime()
runtime.reset()

const taskOrder = listSpecialCraftTaskOrders().find((item) => item.targetObject === '成衣' && item.operationName === '烫画')
assert(taskOrder, '缺少成衣烫画任务单')
const lines = taskOrder.demandLines ?? []
const qtyBySku = Object.fromEntries(lines.map((line) => [line.skuCode, line.planPieceQty]))
const totalQty = Object.values(qtyBySku).reduce((sum, qty) => sum + qty, 0)

executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: taskOrder.taskOrderId,
  taskId: taskOrder.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  objectType: '成衣',
  objectQty: totalQty,
  qtyUnit: '件',
  skuQtyBySkuCode: qtyBySku,
})
executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: taskOrder.taskOrderId,
  taskId: taskOrder.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  objectType: '成衣',
  objectQty: totalQty,
  qtyUnit: '件',
  skuQtyBySkuCode: qtyBySku,
})

const auxiliaryUser = listAllFactoryPdaUsers().find((user) => user.status === 'ACTIVE' && user.factoryId === taskOrder.factoryId)
assert(auxiliaryUser, '缺少辅助工艺 PDA 账号')
setPdaSession(createPdaSessionFromUser(auxiliaryUser))

const waitProcessStocks = listFactoryWaitProcessStockItems()
  .filter((item) => item.taskId === taskOrder.taskOrderId && item.itemKind === '成衣')
assert(waitProcessStocks.length >= 2, '缺少多 SKU 成衣待加工库存')
const [selectedWaitProcess, secondWaitProcess] = waitProcessStocks
const waitProcessHtml = renderPdaWarehouseWaitProcessPage()
assert(waitProcessHtml.includes('来源仓：') && waitProcessHtml.includes('下一动作：加工领料'), '待加工仓必须展示来源仓和真实下一动作')
assert.match(
  waitProcessHtml,
  new RegExp(`data-pda-warehouse-action="special-craft-wait-process-issue"[^>]*data-stock-item-id="${selectedWaitProcess.stockItemId}"[^>]*data-work-order-id="${taskOrder.taskOrderId}"[^>]*data-sku-code="${selectedWaitProcess.materialSku}"`),
  '待加工仓主按钮必须绑定明确库存、加工单和 SKU',
)
setPdaSession(null)
assert.equal(await dispatchPdaPageEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-process-issue',
  { stockItemId: selectedWaitProcess.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: selectedWaitProcess.materialSku || '' },
)), true, '未登录加工领用必须由真实 PDA dispatch 消费')
assert(runtime.visibleMessages.some((message) => message.includes('未登录')), '权限不足必须显示中文 Toast')
assert.notEqual(
  listFactoryWaitProcessStockItems().find((item) => item.stockItemId === selectedWaitProcess.stockItemId)?.status,
  '已领用',
  '权限失败不得修改库存状态',
)
setPdaSession(createPdaSessionFromUser(auxiliaryUser))
assert.equal(handlePdaWarehouseWaitProcessEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-process-issue',
  { stockItemId: selectedWaitProcess.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: selectedWaitProcess.materialSku || '' },
)), true, '待加工仓加工领用必须由真实 handler 处理')
const waitProcessAfterFirst = listFactoryWaitProcessStockItems()
  .filter((item) => item.taskId === taskOrder.taskOrderId && item.itemKind === '成衣')
assert.equal(waitProcessAfterFirst.find((item) => item.stockItemId === selectedWaitProcess.stockItemId)?.status, '已领用', '点 SKU A 只能领用 A')
assert.equal(waitProcessAfterFirst.find((item) => item.stockItemId === selectedWaitProcess.stockItemId)?.operatorUserId, auxiliaryUser.userId, 'SKU 行领用必须保留真实登录账号')
assert.notEqual(waitProcessAfterFirst.find((item) => item.stockItemId === secondWaitProcess.stockItemId)?.status, '已领用', '点 SKU A 不得连带领用 SKU B')
assert.equal(getSpecialCraftTaskOrderById(taskOrder.taskOrderId)?.status, '已入待加工仓', '部分 SKU 领用时加工单必须保持待加工阶段')
const partialWaitProcessHtml = renderPdaWarehouseWaitProcessPage()
assert(!partialWaitProcessHtml.includes(selectedWaitProcess.stockItemId), '已领用 SKU A 必须退出 PDA 待加工操作列表')
assert(partialWaitProcessHtml.includes(secondWaitProcess.stockItemId), '未领用 SKU B 必须继续留在 PDA 待加工操作列表')
assert(partialWaitProcessHtml.includes(`1 / ${waitProcessStocks.length} SKU`), '部分领用必须显示整单 SKU 进度')
assert.equal(await dispatchPdaPageEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-process-issue',
  { stockItemId: selectedWaitProcess.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: selectedWaitProcess.materialSku || '' },
)), true, '重复加工领用必须由真实 PDA dispatch 消费')
assert(runtime.visibleMessages.some((message) => /重复|已领用/.test(message)), '重复加工领用必须显示中文 Toast')
waitProcessStocks.slice(1).forEach((item) => {
  assert.equal(handlePdaWarehouseWaitProcessEvent(buildPdaWarehouseActionTarget(
    'special-craft-wait-process-issue',
    { stockItemId: item.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: item.materialSku || '' },
  )), true, `SKU ${item.materialSku} 加工领用必须成功`)
})
assert.equal(getSpecialCraftTaskOrderById(taskOrder.taskOrderId)?.status, '加工中', '最后一个 SKU 领用后加工单才能推进加工中')
assert(
  listFactoryWaitProcessStockItems()
    .filter((item) => item.taskId === taskOrder.taskOrderId && item.itemKind === '成衣')
    .every((item) => item.status === '已领用' && item.availableQty === 0 && item.issuedQty === item.receivedQty),
  '全部 SKU 领用后必须逐行扣清待加工库存',
)

executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: taskOrder.taskOrderId,
  taskId: taskOrder.taskOrderId,
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

const waitHandoverStocks = listFactoryWaitHandoverStockItems()
  .filter((item) => item.taskId === taskOrder.taskOrderId && item.itemKind === '成衣')
assert(waitHandoverStocks.length >= 2, '缺少多 SKU 成衣待交出库存')
const [selectedWaitHandover, secondWaitHandover] = waitHandoverStocks
const waitHandoverHtml = renderPdaWarehouseWaitHandoverPage()
assert(waitHandoverHtml.includes('下一站：') && waitHandoverHtml.includes('下一动作：交出确认'), '待交出仓必须展示后道下一站和真实下一动作')
assert.match(
  waitHandoverHtml,
  new RegExp(`data-pda-warehouse-action="special-craft-wait-handover-submit"[^>]*data-stock-item-id="${selectedWaitHandover.stockItemId}"[^>]*data-work-order-id="${taskOrder.taskOrderId}"[^>]*data-sku-code="${selectedWaitHandover.materialSku}"`),
  '待交出仓主按钮必须绑定明确库存、加工单和 SKU',
)
assert.equal(handlePdaWarehouseWaitHandoverEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-handover-submit',
  { stockItemId: selectedWaitHandover.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: selectedWaitHandover.materialSku || '' },
)), true, '待交出仓交出必须由真实 handler 处理')
const waitHandoverAfterFirst = listFactoryWaitHandoverStockItems().filter((item) => item.taskId === taskOrder.taskOrderId)
assert.equal(waitHandoverAfterFirst.find((item) => item.stockItemId === selectedWaitHandover.stockItemId)?.status, '已交出', '点 SKU A 只能确认交出 A')
assert.notEqual(waitHandoverAfterFirst.find((item) => item.stockItemId === secondWaitHandover.stockItemId)?.status, '已交出', '点 SKU A 不得连带交出 SKU B')
assert.equal(getSpecialCraftTaskOrderById(taskOrder.taskOrderId)?.status, '待交出', '部分 SKU 交出时加工单必须保持待交出阶段')
const partialWaitHandoverHtml = renderPdaWarehouseWaitHandoverPage()
assert(!partialWaitHandoverHtml.includes(selectedWaitHandover.stockItemId), '已交出 SKU A 必须退出 PDA 待交出操作列表')
assert(partialWaitHandoverHtml.includes(secondWaitHandover.stockItemId), '未交出 SKU B 必须继续留在 PDA 待交出操作列表')
assert(partialWaitHandoverHtml.includes(`1 / ${waitHandoverStocks.length} SKU`), '部分交出必须显示整单 SKU 进度')
assert.equal(await dispatchPdaPageEvent(buildPdaWarehouseActionTarget(
  'special-craft-wait-handover-submit',
  { stockItemId: selectedWaitHandover.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: selectedWaitHandover.materialSku || '' },
)), true, '重复交出必须由真实 PDA dispatch 消费')
assert(runtime.visibleMessages.some((message) => /重复|已交出/.test(message)), '重复交出必须显示中文 Toast')
waitHandoverStocks.slice(1).forEach((item) => {
  assert.equal(handlePdaWarehouseWaitHandoverEvent(buildPdaWarehouseActionTarget(
    'special-craft-wait-handover-submit',
    { stockItemId: item.stockItemId, workOrderId: taskOrder.taskOrderId, skuCode: item.materialSku || '' },
  )), true, `SKU ${item.materialSku} 交出确认必须成功`)
})
const handover = getHandoverRecordsByWorkOrderId(taskOrder.taskOrderId).at(0)
assert(handover, '交出主按钮必须创建真实交出记录')
assert.equal(handover.receiveFactoryId, DEDICATED_POST_FACTORY_ID, '交出记录必须指向真实后道主体')
assert.equal(handover.operatorUserId, auxiliaryUser.userId, '交出记录必须保存登录账号审计主体')
assert.equal(handover.operatorFactoryId, auxiliaryUser.factoryId, '交出记录必须保存登录工厂审计主体')
const taskWaitHandoverAfterSubmit = listFactoryWaitHandoverStockItems().filter((item) => item.taskId === taskOrder.taskOrderId)
assert(
  taskWaitHandoverAfterSubmit.every((item) => item.status === '已交出'),
  `交出后不得继续滞留待交出仓：${JSON.stringify(taskWaitHandoverAfterSubmit.map((item) => ({ id: item.stockItemId, sku: item.materialSku, status: item.status })))}`,
)
assert.equal(getSpecialCraftTaskOrderById(taskOrder.taskOrderId)?.status, '交出待收货', '最后一个 SKU 交出后加工单才能推进交出待收货')
assert(
  !renderPdaWarehouseWaitHandoverPage().includes(selectedWaitHandover.stockItemId),
  '已交出的成衣库存不得继续出现在 PDA 待交出操作列表',
)
const handoverAudit = getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', taskOrder.taskOrderId).at(0)
assert.equal(handoverAudit?.operatorUserId, auxiliaryUser.userId, '交出动作必须保存登录账号审计主体')
assert.equal(handoverAudit?.operatorFactoryId, auxiliaryUser.factoryId, '交出动作必须保存登录工厂审计主体')

console.log('special craft PDA warehouse actions passed')
