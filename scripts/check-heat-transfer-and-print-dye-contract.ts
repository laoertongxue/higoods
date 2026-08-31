#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSpecialCraftMenuGroups } from '../src/data/app-shell-config.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { getProcessActionDefinition } from '../src/data/fcs/process-action-writeback-service.ts'
import {
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskOrdersPath,
  getSpecialCraftWorkOrderBusinessType,
  listEnabledSpecialCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftPdaCandidateByTaskId,
  getSpecialCraftPdaCandidatesByTaskId,
  resolveSpecialCraftPdaScan,
} from '../src/data/fcs/special-craft-pda-scan.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets } from '../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { renderPdaWorkOrderExecDetailPage } from '../src/pages/pda-exec-detail.ts'
import { getFastSpecialCraftWebActions } from '../src/pages/process-factory/special-craft/shared.ts'
import { renderSpecialCraftTaskOrdersPage } from '../src/pages/process-factory/special-craft/task-orders.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

const operations = listEnabledSpecialCraftOperationDefinitions()
const heat = operations.find((item) => item.operationId === 'AUX-OP-HEAT-TRANSFER')
const direct = operations.find((item) => item.operationId === 'AUX-OP-DIRECT-PRINT')
assert(heat, '缺少烫画工艺操作')
assert(direct, '缺少直喷工艺操作')

const taskOrders = listSpecialCraftTaskOrders()
assert.equal(new Set(taskOrders.map((item) => item.taskOrderId)).size, taskOrders.length, '所有辅助或特种工艺加工单 ID 必须全局唯一')
assert.equal(new Set(taskOrders.map((item) => item.taskOrderNo)).size, taskOrders.length, '所有辅助或特种工艺加工单号必须全局唯一')

const heatOrders = taskOrders.filter((item) => item.operationId === heat.operationId)
const directOrders = taskOrders.filter((item) => item.operationId === direct.operationId)
assert(heatOrders.length > 0, '必须存在独立烫画加工单')
assert(directOrders.length > 0, '必须存在独立直喷加工单')
assert(heatOrders.every((item) => item.businessType === 'HEAT_TRANSFER'), '烫画加工单必须使用 HEAT_TRANSFER 业务类型')
assert(directOrders.every((item) => item.businessType === 'DIRECT_PRINT'), '直喷加工单必须使用 DIRECT_PRINT 业务类型')
assert.equal(getSpecialCraftWorkOrderBusinessType('AUX-OP-HEAT-TRANSFER'), 'HEAT_TRANSFER')
assert.equal(getSpecialCraftWorkOrderBusinessType('AUX-OP-DIRECT-PRINT'), 'DIRECT_PRINT')
assert.equal(getSpecialCraftWorkOrderBusinessType('AUX-OP-BUTTON-LOOP'), 'BUTTON_LOOP')
assert.equal(getSpecialCraftWorkOrderBusinessType('AUX-OP-UNKNOWN'), 'OTHER_SPECIAL_CRAFT')

for (const [craftName, orders] of [['烫画', heatOrders], ['直喷', directOrders]] as const) {
  const garmentOrders = orders.filter((item) => item.targetObject === '成衣')
  assert(garmentOrders.length >= 3, `${craftName}必须至少包含 3 张成衣加工单`)
  assert.equal(garmentOrders.length, orders.length, `${craftName}不得继续保留裁片加工单`)
  assert(garmentOrders.every((item) => item.unit === '件'), `${craftName}成衣加工单必须按件执行`)
  assert(garmentOrders.every((item) => item.receiverWarehouseName === '后道待加工仓'), `${craftName}成衣加工后必须去后道待加工仓`)
  assert(garmentOrders.every((item) => item.feiTicketNos.length === 0), `${craftName}成衣加工单不得伪造菲票`)
  garmentOrders.forEach((order) => {
    const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
    assert(snapshot, `${order.taskOrderNo}缺少冻结技术包`)
    order.demandLines?.forEach((line) => {
      const garmentBom = snapshot.bomItems.find((item) => item.id === line.sourceBomItemId && item.type === '成衣')
      assert(garmentBom, `${order.taskOrderNo}成衣明细必须关联正式成衣 BOM`)
      assert.equal(garmentBom.unit, '件')
      assert.equal(garmentBom.unitConsumption, 1)
      assert.equal(garmentBom.lossRate, 0)
      assert.equal(line.patternFileId, '', `${order.taskOrderNo}成衣明细不得伪造纸样`)
      assert.equal(line.pieceRowId, '', `${order.taskOrderNo}成衣明细不得伪造裁片部位`)
    })
  })
}

const feiBindingResult = buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets({
  specialCraftTaskOrders: taskOrders,
})
for (const order of [...heatOrders, ...directOrders].filter((item) => item.targetObject === '已裁部位')) {
  const concreteBindings = feiBindingResult.bindings.filter((item) => item.taskOrderId === order.taskOrderId)
  const pendingBindings = feiBindingResult.pendingBindingViews.filter((item) => item.taskOrderId === order.taskOrderId)
  assert(concreteBindings.length + pendingBindings.length > 0, `${order.taskOrderNo}必须有真实菲票绑定或明确待绑定记录`)
  assert(concreteBindings.every((item) => item.workOrderId === order.taskOrderId && item.workOrderNo === order.taskOrderNo), `${order.taskOrderNo}菲票绑定不得改写具体加工单身份`)
  assert(pendingBindings.every((item) => item.workOrderId === order.taskOrderId && item.workOrderNo === order.taskOrderNo), `${order.taskOrderNo}待绑定记录不得丢失具体加工单身份`)
}

const expectedActions = [
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_COMPLETE_ORDER',
]
const forbiddenActions = [
  'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  'SPECIAL_CRAFT_START_PROCESS',
  'SPECIAL_CRAFT_FINISH_PROCESS',
]
for (const order of [...heatOrders, ...directOrders]) {
  const actionCodes = getFastSpecialCraftWebActions(order).map((item) => item.actionCode)
  assert(actionCodes.every((code) => expectedActions.includes(code)), `${order.taskOrderNo} Web 只能暴露四个加工单动作`)
  assert(actionCodes.every((code) => !forbiddenActions.includes(code)), `${order.taskOrderNo} 不得暴露旧开工/完工动作`)
  assert(order.sourceTaskId && order.sourceTaskNo, `${order.taskOrderNo}必须保留来源任务追溯`)
  assert.notEqual(order.taskOrderId, order.sourceTaskId, `${order.taskOrderNo}执行身份不得退化为任务`)
}
expectedActions.forEach((actionCode) => {
  assert(getProcessActionDefinition('SPECIAL_CRAFT', actionCode), `缺少当前加工单动作定义：${actionCode}`)
})
forbiddenActions.forEach((actionCode) => {
  assert.equal(getProcessActionDefinition('SPECIAL_CRAFT', actionCode), undefined, `不得保留可执行旧动作：${actionCode}`)
})

const actionableOrder = taskOrders.find((item) => item.status === '加工中')
assert(actionableOrder, '缺少 PDA 精确扫码回归加工单')
const exactResolution = resolveSpecialCraftPdaScan(actionableOrder.taskOrderNo, actionableOrder.factoryId, 'EXECUTION')
assert.equal(exactResolution.status, 'MATCH')
assert.equal(exactResolution.candidates[0]?.workOrderId, actionableOrder.taskOrderId, '扫码加工单号必须保真到具体 workOrderId')
assert.equal(exactResolution.candidates[0]?.sourceTaskId, actionableOrder.sourceTaskId, '扫码候选必须同时保留来源任务 ID')
const pdaHtml = renderPdaWorkOrderExecDetailPage('SPECIAL_CRAFT', actionableOrder.taskOrderId)
assert(pdaHtml.includes(actionableOrder.taskOrderNo), 'PDA 加工单详情必须展示具体加工单号')
assert(pdaHtml.includes(actionableOrder.sourceTaskNo || ''), 'PDA 加工单基本信息必须展示来源任务号')

const multiOrderTask = taskOrders
  .map((item) => item.sourceTaskId)
  .find((taskId) => Boolean(taskId) && getSpecialCraftPdaCandidatesByTaskId(taskId || '').length > 1)
if (multiOrderTask) {
  const candidates = getSpecialCraftPdaCandidatesByTaskId(multiOrderTask)
  assert(candidates.length > 1, '一任务多加工单回归场景至少应有两张加工单')
  assert.equal(getSpecialCraftPdaCandidateByTaskId(multiOrderTask), null, '一任务多加工单时不得静默取第一张加工单')
  assert.equal(new Set(candidates.map((item) => item.workOrderId)).size, candidates.length, '一任务多加工单候选必须逐单保留身份')
}

const menuItems = buildSpecialCraftMenuGroups().flatMap((group) => group.items)
for (const operation of [heat, direct]) {
  const pathName = buildSpecialCraftTaskOrdersPath(operation)
  assert(menuItems.some((item) => item.href === pathName), `${operation.operationName}缺少独立加工单菜单`)
  const html = renderSpecialCraftTaskOrdersPage(buildSpecialCraftOperationSlug(operation))
  assert(html.includes(`${operation.operationName}加工单`), `${operation.operationName}加工单列表标题错误`)
  assert(html.includes('加工单号'), `${operation.operationName}列表核心身份必须是加工单号`)
}

assert(operations.every((item) => item.operationName !== '印花' && item.operationName !== '染色'), '印花、染色不得混入通用辅助/特种加工单')
assert(listPrintWorkOrders().length > 0, '印花必须继续由独立印花加工单领域承接')
assert(listDyeWorkOrders().length > 0, '染色必须继续由独立染色加工单领域承接')

const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const pdaSource = read('src/pages/pda-exec-detail.ts')
assert(taskOrdersSource.includes("return `${PREF_STORAGE_KEY}:${operationId}`"), '列表列偏好键必须按 operation 隔离')
assert(taskOrdersSource.includes('loadListColumnPreferences') && taskOrdersSource.includes('saveListColumnPreferences'), '加工单列表必须使用标准列偏好能力')
assert(pdaSource.includes('renderPdaWorkOrderExecDetailPage(sourceType: string, workOrderId: string)'), 'PDA 必须提供按具体加工单 ID 渲染入口')

console.log(`[check-heat-transfer-and-print-dye-contract] 通过：烫画 ${heatOrders.length} 单，直喷 ${directOrders.length} 单；四动作、加工单身份、BOM/菲票和印染边界已核验`)
