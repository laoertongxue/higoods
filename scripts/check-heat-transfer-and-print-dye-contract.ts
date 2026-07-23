#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSpecialCraftMenuGroups } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftTaskOrdersPath,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  buildSpecialCraftTaskWorkOrders,
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId,
  getSpecialCraftTaskWorkOrderById,
  getSpecialCraftTaskOrderById,
  getEnabledSpecialCraftOperations,
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { listPdaMobileExecutionTasks } from '../src/data/fcs/process-mobile-task-binding.ts'
import {
  executeProcessAction,
  getProcessActionDefinition,
  getProcessActionOperationRecordsBySource,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  upsertFactoryWaitProcessStockItem,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import {
  listPostFinishingReceiptRecords,
  listPostFinishingTasks,
  listPostFinishingWaitProcessWarehouseRecords,
  receiveAuxiliaryCraftGarmentsAtPostFinishing,
} from '../src/data/fcs/post-finishing-domain.ts'
import {
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
  writeBackProcessHandoverRecord,
} from '../src/data/fcs/process-warehouse-domain.ts'
import { applySpecialCraftWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import {
  buildSpecialCraftTaskListStorageKey,
  readSpecialCraftTaskListPreference,
  renderSpecialCraftTaskOrdersPage,
  writeSpecialCraftTaskListPreference,
} from '../src/pages/process-factory/special-craft/task-orders.ts'
import { renderSpecialCraftWorkOrderDetailPage } from '../src/pages/process-factory/special-craft/work-order-detail.ts'
import { handlePdaExecDetailEvent, renderPdaExecDetailPage } from '../src/pages/pda-exec-detail.ts'
import { renderPdaExecPage } from '../src/pages/pda-exec.ts'
import { clearPdaSession, createPdaSessionFromUser, listAllFactoryPdaUsers, setPdaSession } from '../src/data/fcs/store-domain-pda.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { DEDICATED_POST_FACTORY_ID, DEDICATED_POST_FACTORY_NAME } from '../src/data/fcs/factory-mock-data.ts'
import {
  ContractHtmlInputElement,
  buildPdaExecActionTarget,
  installPdaContractRuntime,
} from './helpers/pda-contract-runtime.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

const operations = getEnabledSpecialCraftOperations()
const heat = operations.find((item) => item.operationId === 'AUX-OP-HEAT-TRANSFER')
const direct = operations.find((item) => item.operationId === 'AUX-OP-DIRECT-PRINT')
assert(heat, '缺少烫画工艺操作')
assert(direct, '缺少直喷工艺操作')

const workOrders = listSpecialCraftTaskWorkOrders()
assert.equal(new Set(workOrders.map((item) => item.workOrderNo)).size, workOrders.length, '所有辅助或特种工艺加工单号必须全局唯一')
const heatOrders = workOrders.filter((item) => item.operationId === heat.operationId)
const directOrders = workOrders.filter((item) => item.operationId === direct.operationId)
assert(heatOrders.length > 0, '必须存在独立烫画加工单')
assert(directOrders.length > 0, '必须保留直喷加工单')
assert(heatOrders.every((item) => item.craftName === '烫画'))
assert(directOrders.every((item) => item.craftName === '直喷'))
assert(heatOrders.every((item) => item.businessType === 'HEAT_TRANSFER'), '烫画加工单必须使用 HEAT_TRANSFER 业务类型')
assert(directOrders.every((item) => item.businessType === 'DIRECT_PRINT'), '直喷加工单必须保留 DIRECT_PRINT 业务类型')
assert(
  workOrders
    .filter((item) => !['烫画', '直喷'].includes(item.craftName))
    .every((item) => item.businessType === 'OTHER_SPECIAL_CRAFT'),
  '其他辅助或特种工艺加工单必须使用 OTHER_SPECIAL_CRAFT 兜底业务类型',
)
assert.equal(
  new Set([...heatOrders, ...directOrders].map((item) => item.workOrderNo)).size,
  heatOrders.length + directOrders.length,
  '烫画与直喷加工单号不得重复',
)

// 任务 5 起点 adc95810 的直喷加工单身份基线；新增烫画不得重编号既有直喷。
const directIdentityBaseline = [
  {
    workOrderId: 'AUX-TASK-PO2026030002-RINT-34bb1b-04-WO-001-',
    workOrderNo: 'AUX-202603-0002-6384-04-部位01',
  },
  {
    workOrderId: 'AUX-TASK-PO2026030004-RINT-1a0949-03-WO-001-',
    workOrderNo: 'AUX-202603-0004-6384-03-部位01',
  },
]
assert.deepEqual(
  directOrders
    .map(({ workOrderId, workOrderNo }) => ({ workOrderId, workOrderNo }))
    .sort((left, right) => left.workOrderId.localeCompare(right.workOrderId)),
  directIdentityBaseline.sort((left, right) => left.workOrderId.localeCompare(right.workOrderId)),
  '直喷既有加工单 ID 与加工单号不得因新增烫画而变化',
)

for (const [operationId, renamedCraftName, expectedBusinessType] of [
  ['AUX-OP-HEAT-TRANSFER', '热转印展示名', 'HEAT_TRANSFER'],
  ['AUX-OP-DIRECT-PRINT', '数码直喷展示名', 'DIRECT_PRINT'],
  ['AUX-OP-UNKNOWN', '未知工艺展示名', 'OTHER_SPECIAL_CRAFT'],
] as const) {
  const sourceTask = listSpecialCraftTaskOrders().find((item) => item.operationId === operationId)
    || listSpecialCraftTaskOrders()[0]
  assert(sourceTask, '缺少业务类型映射测试任务')
  const [renamedWorkOrder] = buildSpecialCraftTaskWorkOrders([{
    ...sourceTask,
    operationId,
    craftName: renamedCraftName,
  }]).workOrders
  assert.equal(renamedWorkOrder.businessType, expectedBusinessType, `${operationId} 业务类型不得依赖中文展示名`)
}

for (const [craftName, orders] of [['烫画', heatOrders], ['直喷', directOrders]] as const) {
  assert(orders.some((item) => item.targetObject === '已裁部位'), `${craftName}必须包含裁片部位加工单`)
  assert(orders.some((item) => item.targetObject === '成衣'), `${craftName}必须包含成衣加工单`)
}

const garmentHeat = heatOrders.find((item) => item.targetObject === '成衣')
assert(garmentHeat, '缺少成衣烫画加工单')
assert(garmentHeat.planQty > 0, '成衣烫画加工单计划件数必须大于 0')
assert.deepEqual(garmentHeat.feiTicketNos, [], '成衣烫画加工单不得生成菲票')
const garmentWaitProcess = getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId)
  .find((item) => item.recordType === 'WAIT_PROCESS')
assert.equal(garmentHeat.status, '待领料', '契约样例必须从尚未出库的成衣加工单开始')
assert.equal(garmentWaitProcess, undefined, '成衣仓尚未出库且辅助工艺尚未收货时不得投影待加工仓')
const garmentSkuLines = getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId)
assert(garmentSkuLines.length > 1, '成衣加工单必须包含真实 SKU 明细')
assert(garmentSkuLines.every((line) => line.skuCode && line.skuCode !== line.demandLineId), '成衣加工单必须携带真实 SKU 编码')
const garmentTaskOrder = getSpecialCraftTaskOrderById(garmentHeat.taskOrderId)
assert(garmentTaskOrder, '成衣烫画加工单必须回溯到辅助工艺任务单')
const garmentMobileTask = listPdaMobileExecutionTasks().find((item) => item.taskId === garmentTaskOrder.sourceTaskId)
assert(garmentMobileTask, '成衣烫画任务必须进入 PDA 执行任务')
assert.equal(garmentMobileTask.qtyUnit, 'PIECE', 'PDA 内部计数单位必须继续使用 PIECE')
assert.equal(garmentMobileTask.qtyDisplayUnit, '件', 'PDA 成衣数量显示单位必须来自加工单事实')
const garmentDirect = directOrders.find((item) => item.targetObject === '成衣')
assert(garmentDirect, '缺少成衣直喷加工单用于统一动作入口回归')
const garmentDirectSkuLines = getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentDirect.workOrderId)
const garmentDirectTaskOrder = getSpecialCraftTaskOrderById(garmentDirect.taskOrderId)
assert(garmentDirectTaskOrder, '成衣直喷加工单必须回溯到辅助工艺任务单')
const garmentDirectMobileTask = listPdaMobileExecutionTasks().find((item) => item.taskId === garmentDirectTaskOrder.sourceTaskId)
assert(garmentDirectMobileTask, '成衣直喷任务必须进入 PDA 执行任务')

const zeroSkuQtyBySkuCode = Object.fromEntries(garmentDirectSkuLines.map((line) => [line.skuCode, 0]))
const directStatusBeforeZeroOutbound = getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status
const directOutboundCountBeforeZeroOutbound = listFactoryWarehouseOutboundRecords()
  .filter((record) => record.sourceTaskId === garmentDirect.workOrderId).length
assert.throws(() => executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentDirect.workOrderId,
  taskId: garmentDirect.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  objectType: '成衣',
  objectQty: 0,
  qtyUnit: '件',
  skuQtyBySkuCode: zeroSkuQtyBySkuCode,
}), /成衣操作至少一个 SKU 件数必须大于 0/, '全 SKU 为 0 的成衣仓出库必须拒绝')
assert.equal(getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status, directStatusBeforeZeroOutbound, '全零出库不得推进加工单状态')
assert.equal(
  listFactoryWarehouseOutboundRecords().filter((record) => record.sourceTaskId === garmentDirect.workOrderId).length,
  directOutboundCountBeforeZeroOutbound,
  '全零出库不得新增成衣仓库存事实',
)
assert(
  getProcessActionDefinition('SPECIAL_CRAFT', 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND'),
  '成衣仓出库必须注册为 Web/PDA 共用动作',
)
assert.throws(
  () => executeProcessAction({
    sourceChannel: '移动端',
    sourceType: 'SPECIAL_CRAFT',
    sourceId: garmentDirect.workOrderId,
    actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
    operatorName: '辅助工艺仓管员',
    operatedAt: '2026-07-22 09:00:00',
    objectType: '成衣',
    objectQty: garmentDirect.planQty,
    qtyUnit: '件',
  }),
  /逐 SKU/,
  '统一动作入口不得用总计划件数代替成衣逐 SKU 实收',
)

const incompleteOutboundQtyBySkuCode = Object.fromEntries(
  garmentDirectSkuLines.map((line, index) => [line.skuCode, line.planPieceQty - (index === 0 ? 1 : 0)]),
)
assert.throws(() => executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentDirect.workOrderId,
  taskId: garmentDirect.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  objectType: '成衣',
  objectQty: garmentDirect.planQty,
  qtyUnit: '件',
  operatorName: '成衣仓管员',
  operatedAt: '2026-07-22 09:10:00',
  skuQtyBySkuCode: incompleteOutboundQtyBySkuCode,
}), /逐 SKU 实出合计/, '成衣仓逐 SKU 实出合计必须等于本次出库总件数')
assert.equal(
  listFactoryWarehouseOutboundRecords().filter((record) => record.sourceTaskId === garmentDirect.workOrderId).length,
  0,
  '逐 SKU 合计不一致时不得写入部分出库记录',
)

const statusBeforeInvalidReceipt = getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status
const lineQtyBeforeInvalidReceipt = garmentDirectSkuLines.map((line) => line.currentQty)
const inboundCountBeforeInvalidReceipt = listFactoryWarehouseInboundRecords().length
const waitProcessCountBeforeInvalidReceipt = listFactoryWaitProcessStockItems().length
assert.throws(() => executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentDirect.workOrderId,
  taskId: garmentDirect.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  objectType: '成衣',
  objectQty: garmentDirect.planQty,
  qtyUnit: '件',
  skuQtyBySkuCode: Object.fromEntries(garmentDirectSkuLines.map((line) => [line.skuCode, line.planPieceQty])),
}), /成衣仓尚未出库/, '成衣仓未出库时统一动作必须拒绝辅助工艺收货')
assert.equal(getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status, statusBeforeInvalidReceipt, '收货联动失败不得污染加工单状态')
assert.deepEqual(getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentDirect.workOrderId).map((line) => line.currentQty), lineQtyBeforeInvalidReceipt, '收货联动失败不得污染 SKU 数量')
assert.equal(listFactoryWarehouseInboundRecords().length, inboundCountBeforeInvalidReceipt, '收货联动失败不得新增入库记录')
assert.equal(listFactoryWaitProcessStockItems().length, waitProcessCountBeforeInvalidReceipt, '收货联动失败不得新增待加工库存')

installPdaContractRuntime()
const buildPdaActionTarget = buildPdaExecActionTarget
const factoryById = new Map(listFactoryMasterRecords().map((factory) => [factory.id, factory]))
const garmentWarehousePdaUser = listAllFactoryPdaUsers().find((user) =>
  user.status === 'ACTIVE'
  && user.roleId === 'ROLE_ADMIN'
  && factoryById.get(user.factoryId)?.factoryType === 'CENTRAL_GARMENT',
)
const directAuxiliaryPdaUser = listAllFactoryPdaUsers().find((user) =>
  user.status === 'ACTIVE' && user.factoryId === garmentDirect.factoryId,
)
const heatAuxiliaryPdaUser = listAllFactoryPdaUsers().find((user) =>
  user.status === 'ACTIVE' && user.factoryId === garmentHeat.factoryId,
)
assert(garmentWarehousePdaUser, '必须复用真实成衣厂 PDA 管理员作为成衣仓出库身份')
assert(directAuxiliaryPdaUser, '必须存在直喷辅助工艺厂 PDA 账号')
assert(heatAuxiliaryPdaUser, '必须存在烫画辅助工艺厂 PDA 账号')

clearPdaSession()
const directPdaWithoutSession = renderPdaExecDetailPage(garmentDirectMobileTask.taskId)
assert(!directPdaWithoutSession.includes('data-pda-execd-action="special-garment-warehouse-outbound"'), '无登录会话不得看到成衣仓出库按钮')
const outboundCountBeforeDeniedActions = listFactoryWarehouseOutboundRecords()
  .filter((record) => record.sourceTaskId === garmentDirect.workOrderId).length
handlePdaExecDetailEvent(buildPdaActionTarget('special-garment-warehouse-outbound', garmentDirectMobileTask.taskId))
assert.equal(getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status, '待领料', '无登录会话直接触发 handler 不得推进加工单')

setPdaSession(createPdaSessionFromUser(directAuxiliaryPdaUser))
const directPdaAsAuxiliaryFactory = renderPdaExecDetailPage(garmentDirectMobileTask.taskId)
assert(!directPdaAsAuxiliaryFactory.includes('data-pda-execd-action="special-garment-warehouse-outbound"'), '辅助工艺厂账号不得看到成衣仓出库按钮')
handlePdaExecDetailEvent(buildPdaActionTarget('special-garment-warehouse-outbound', garmentDirectMobileTask.taskId))
assert.equal(getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status, '待领料', '辅助工艺厂账号不得执行成衣仓出库')
assert.equal(
  listFactoryWarehouseOutboundRecords().filter((record) => record.sourceTaskId === garmentDirect.workOrderId).length,
  outboundCountBeforeDeniedActions,
  '无会话或错厂账号不得写入当前加工单成衣仓出库记录',
)

setPdaSession(createPdaSessionFromUser(garmentWarehousePdaUser))
const garmentWarehouseTaskListHtml = renderPdaExecPage()
assert(
  garmentWarehouseTaskListHtml.includes(garmentDirectMobileTask.taskNo || garmentDirectMobileTask.taskId),
  '成衣仓账号必须可从 PDA 执行任务列表进入待出库加工单',
)
const directPdaAsGarmentWarehouse = renderPdaExecDetailPage(garmentDirectMobileTask.taskId)
assert(directPdaAsGarmentWarehouse.includes('待出库'), '成衣仓账号必须看到待出库状态')
assert(directPdaAsGarmentWarehouse.includes('data-pda-execd-action="special-garment-warehouse-outbound"'), '成衣仓账号必须看到逐 SKU 出库按钮')
assert(!directPdaAsGarmentWarehouse.includes('data-pda-execd-action="special-receive-cut-pieces"'), '成衣仓账号不得执行辅助工艺收货')
assert(directPdaAsGarmentWarehouse.includes('data-pda-execd-sku-field="outboundQty"'), '成衣仓出库必须逐 SKU 输入实出整数')
assert.equal(
  handlePdaExecDetailEvent(buildPdaActionTarget('special-garment-warehouse-outbound', garmentDirectMobileTask.taskId)),
  true,
  'PDA 成衣仓出库按钮必须由真实 handler 处理',
)
assert.equal(getSpecialCraftTaskWorkOrderById(garmentDirect.workOrderId)?.status, '成衣仓已出库待收货', 'PDA 成衣仓出库必须走统一动作推进状态')
assert.equal(
  getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentDirect.workOrderId).at(0)?.actionCode,
  'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  'PDA 成衣仓出库必须写入统一公开动作记录',
)
const garmentWarehouseAudit = getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentDirect.workOrderId).at(0)
assert.equal(garmentWarehouseAudit?.operatorName, garmentWarehousePdaUser.name, 'PDA 动作审计姓名必须来自登录会话')
assert.equal(garmentWarehouseAudit?.operatorUserId, garmentWarehousePdaUser.userId, 'PDA 动作审计账号必须来自登录会话')
assert.equal(garmentWarehouseAudit?.operatorFactoryId, garmentWarehousePdaUser.factoryId, 'PDA 动作审计工厂必须来自登录会话')
assert.equal(garmentWarehouseAudit?.operatorRoleId, garmentWarehousePdaUser.roleId, 'PDA 动作审计角色必须来自登录会话')
assert.equal(
  listFactoryWarehouseOutboundRecords().filter((record) => record.sourceTaskId === garmentDirect.workOrderId).length,
  garmentDirectSkuLines.length,
  'PDA 成衣仓出库必须逐 SKU 写入真实出库记录',
)
assert(
  listFactoryWarehouseOutboundRecords()
    .filter((record) => record.sourceTaskId === garmentDirect.workOrderId)
    .every((record) => (
      record.factoryId === 'ID-F001'
      && record.operatorUserId === garmentWarehousePdaUser.userId
      && record.operatorFactoryId === garmentWarehousePdaUser.factoryId
      && record.operatorRoleId === garmentWarehousePdaUser.roleId
    )),
  '成衣仓逐 SKU 出库事实必须使用真实成衣仓主体及登录审计主体',
)
const directOutboundCount = listFactoryWarehouseOutboundRecords().length
handlePdaExecDetailEvent(buildPdaActionTarget('special-garment-warehouse-outbound', garmentDirectMobileTask.taskId))
assert.equal(listFactoryWarehouseOutboundRecords().length, directOutboundCount, 'PDA 重复出库必须由统一动作状态校验拒绝')
setPdaSession(createPdaSessionFromUser(directAuxiliaryPdaUser))
renderPdaExecDetailPage(garmentDirectMobileTask.taskId)
const directSameSkuDraftKey = `${garmentDirect.workOrderId}::成衣仓已出库待收货::${garmentDirectSkuLines[0].skuCode}`
for (const [field, value] of [['receivedQty', '499'], ['completedQty', '497'], ['scrapQty', '1'], ['damageQty', '1']] as const) {
  assert.equal(
    handlePdaExecDetailEvent(new ContractHtmlInputElement(directSameSkuDraftKey, field, value) as unknown as HTMLElement),
    true,
    `PDA 必须局部保存直喷加工单 ${field} 草稿`,
  )
}

const garmentOutboundAt = '2026-07-22 09:30:00'
const garmentOutboundQtyBySkuCode = Object.fromEntries(
  garmentSkuLines.map((line, index) => [line.skuCode, line.planPieceQty - (index === 0 ? 2 : 0)]),
)
const garmentOutboundQty = Object.values(garmentOutboundQtyBySkuCode).reduce((sum, qty) => sum + qty, 0)
const garmentOutboundResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
  objectType: '成衣',
  objectQty: garmentOutboundQty,
  qtyUnit: '件',
  operatorName: '成衣仓管员',
  operatedAt: garmentOutboundAt,
  skuQtyBySkuCode: garmentOutboundQtyBySkuCode,
})
assert.equal(garmentOutboundResult.success, true)
assert.equal(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status, '成衣仓已出库待收货')
assert.equal(getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentHeat.workOrderId).at(0)?.actionCode, 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND')
const garmentOutboundRecords = listFactoryWarehouseOutboundRecords()
  .filter((record) => record.sourceTaskId === garmentHeat.workOrderId && record.warehouseName === '成衣仓')
assert.equal(garmentOutboundRecords.length, garmentSkuLines.length, '成衣仓必须按真实 SKU 逐行记录出库')
assert.equal(garmentOutboundRecords.reduce((sum, record) => sum + record.outboundQty, 0), garmentOutboundQty)
assert(garmentOutboundRecords.every((record) => Number.isInteger(record.outboundQty)), '成衣仓逐 SKU 实出必须为整数件')
assert(garmentOutboundRecords.every((record) => record.operatorName === '成衣仓管员' && record.outboundAt === garmentOutboundAt))
assert(garmentOutboundRecords.every((record) => record.receiverName === garmentHeat.factoryName), '成衣仓出库接收目标必须为当前辅助工艺工厂')
assert.equal(
  getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId).find((item) => item.recordType === 'WAIT_PROCESS'),
  undefined,
  '成衣仓出库后仍应处于辅助工艺待收货，不得提前进入待加工仓',
)
const heatStatusBeforeZeroReceipt = getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status
const heatInboundCountBeforeZeroReceipt = listFactoryWarehouseInboundRecords()
  .filter((record) => record.taskId === garmentHeat.workOrderId).length
assert.throws(() => executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  objectType: '成衣',
  objectQty: 0,
  qtyUnit: '件',
  skuQtyBySkuCode: Object.fromEntries(garmentSkuLines.map((line) => [line.skuCode, 0])),
}), /成衣操作至少一个 SKU 件数必须大于 0/, '全 SKU 为 0 的辅助工艺收货必须拒绝')
assert.equal(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status, heatStatusBeforeZeroReceipt, '全零收货不得推进加工单状态')
assert.equal(
  listFactoryWarehouseInboundRecords().filter((record) => record.taskId === garmentHeat.workOrderId).length,
  heatInboundCountBeforeZeroReceipt,
  '全零收货不得新增辅助工艺入库事实',
)

setPdaSession(createPdaSessionFromUser(heatAuxiliaryPdaUser))
const garmentPdaAfterPartialOutbound = renderPdaExecDetailPage(garmentMobileTask.taskId)
const partialSkuCode = garmentSkuLines[0].skuCode
const partialSkuCard = garmentPdaAfterPartialOutbound.match(new RegExp(`data-special-craft-garment-sku="${partialSkuCode}"[\\s\\S]*?</section>`))?.[0] || ''
assert(partialSkuCard.includes('应收：498 件'), '计划 500、实出 498 时 PDA 应收必须显示真实实出 498')
assert(partialSkuCard.includes('data-pda-execd-sku-field="receivedQty"'), '部分出库后必须提供逐 SKU 实收输入')
assert(partialSkuCard.includes('max="498"'), 'PDA 默认实收不得允许超过真实实出 498')
assert(partialSkuCard.includes('value="498"'), 'PDA 部分出库后的默认实收必须为真实实出 498')

setPdaSession(createPdaSessionFromUser(directAuxiliaryPdaUser))
const directPdaAfterHeatPartialOutbound = renderPdaExecDetailPage(garmentDirectMobileTask.taskId)
const directSameSkuCard = directPdaAfterHeatPartialOutbound.match(new RegExp(`data-special-craft-garment-sku="${partialSkuCode}"[\\s\\S]*?</section>`))?.[0] || ''
const getSkuFieldValue = (card: string, field: string) => card.match(new RegExp(`data-pda-execd-sku-field="${field}"[^>]*value="([^"]*)"`))?.[1]
assert(directSameSkuCard.includes('应收：500 件'), '同 SKU 的直喷加工单不得串用烫画加工单 498 件草稿')
assert.equal(getSkuFieldValue(directSameSkuCard, 'receivedQty'), '499', '直喷已收草稿必须保留在当前加工单')
assert.equal(getSkuFieldValue(directSameSkuCard, 'completedQty'), '497', '直喷完工草稿必须保留在当前加工单')
assert.equal(getSkuFieldValue(directSameSkuCard, 'scrapQty'), '1', '直喷报废草稿必须保留在当前加工单')
assert.equal(getSkuFieldValue(directSameSkuCard, 'damageQty'), '1', '直喷货损草稿必须保留在当前加工单')
assert.equal(getSkuFieldValue(partialSkuCard, 'receivedQty'), '498', '烫画已收草稿不得串用直喷加工单')
assert.equal(getSkuFieldValue(partialSkuCard, 'completedQty'), '0', '烫画完工草稿不得串用直喷加工单')
assert.equal(getSkuFieldValue(partialSkuCard, 'scrapQty'), '0', '烫画报废草稿不得串用直喷加工单')
assert.equal(getSkuFieldValue(partialSkuCard, 'damageQty'), '0', '烫画货损草稿不得串用直喷加工单')

const auxReceivedQtyBySkuCode = Object.fromEntries(
  garmentSkuLines.map((line, index) => [line.skuCode, garmentOutboundQtyBySkuCode[line.skuCode] - (index === 0 ? 2 : 0)]),
)
const receivedGarmentQty = Object.values(auxReceivedQtyBySkuCode).reduce((sum, qty) => sum + qty, 0)
const heatPartialReceiptDraftKey = `${garmentHeat.workOrderId}::成衣仓已出库待收货::${partialSkuCode}`
handlePdaExecDetailEvent(new ContractHtmlInputElement(heatPartialReceiptDraftKey, 'receivedQty', '496') as unknown as HTMLElement)
setPdaSession(createPdaSessionFromUser(heatAuxiliaryPdaUser))
assert.equal(
  handlePdaExecDetailEvent(buildPdaActionTarget('special-receive-cut-pieces', garmentMobileTask.taskId)),
  true,
  '部分出库后 PDA 默认逐 SKU 实收必须可直接提交成功',
)
assert.equal(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status, '已入待加工仓', 'PDA 实收必须走统一动作推进状态')
const garmentPdaAfterReceipt = renderPdaExecDetailPage(garmentMobileTask.taskId)
const receivedPartialSkuCard = garmentPdaAfterReceipt.match(new RegExp(`data-special-craft-garment-sku="${partialSkuCode}"[\\s\\S]*?</section>`))?.[0] || ''
assert(receivedPartialSkuCard.includes('应收：498 件'), '收货后应收仍必须来自成衣仓实出 498')
assert(receivedPartialSkuCard.includes('已收：496 件'), '收货后已收必须来自辅助工艺实际入库 496')
assert(receivedPartialSkuCard.includes('差异：2 件'), '收货后必须按实出与实收显示差异 2')
assert(receivedPartialSkuCard.includes('可加工：496 件'), '可加工必须来自辅助工艺待加工库存 496')
assert(!receivedPartialSkuCard.includes('data-pda-execd-sku-field="receivedQty"'), '已收货后不得继续展示可提交的实收输入')
const receivedWaitProcess = getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId)
  .find((item) => item.recordType === 'WAIT_PROCESS')
assert(receivedWaitProcess, '辅助工艺确认收货后必须生成待加工仓')
assert.equal(receivedWaitProcess.sourceFactoryName, '成衣仓')
assert.equal(receivedWaitProcess.targetFactoryId, garmentHeat.factoryId)
assert.equal(receivedWaitProcess.targetFactoryName, garmentHeat.factoryName)
assert.equal(receivedWaitProcess.receivedObjectQty, receivedGarmentQty)
assert.equal(receivedWaitProcess.availableObjectQty, receivedGarmentQty)
assert.equal(receivedWaitProcess.relatedFeiTicketIds.length, 0)
const auxiliaryInboundRecords = listFactoryWarehouseInboundRecords()
  .filter((record) => garmentOutboundRecords.some((outbound) => outbound.outboundRecordId === record.sourceRecordId))
const auxiliaryWaitStock = listFactoryWaitProcessStockItems()
  .filter((stock) => garmentOutboundRecords.some((outbound) => outbound.outboundRecordId === stock.sourceRecordId))
assert.equal(auxiliaryInboundRecords.length, garmentSkuLines.length, '辅助工艺必须按 SKU 生成现有入库记录')
assert.equal(auxiliaryWaitStock.length, garmentSkuLines.length, '辅助工艺必须按 SKU 生成现有待加工库存')
assert.equal(auxiliaryInboundRecords.reduce((sum, record) => sum + record.receivedQty, 0), receivedGarmentQty)
assert.equal(auxiliaryWaitStock.reduce((sum, stock) => sum + stock.receivedQty, 0), receivedGarmentQty)
assert(auxiliaryInboundRecords.every((record) => Number.isInteger(record.receivedQty)), '辅助工艺逐 SKU 实收必须为整数件')
assert(auxiliaryInboundRecords.every((record) => record.factoryId === garmentHeat.factoryId && record.sourceObjectName === '成衣仓'))
assert(auxiliaryInboundRecords.every((record) => (
  record.receiverName === heatAuxiliaryPdaUser.name
  && record.operatorUserId === heatAuxiliaryPdaUser.userId
  && record.operatorFactoryId === heatAuxiliaryPdaUser.factoryId
  && record.operatorRoleId === heatAuxiliaryPdaUser.roleId
)), '辅助工艺 PDA 收货记录必须使用登录会话审计主体')
const receivedWorkOrder = listSpecialCraftTaskWorkOrders().find((item) => item.workOrderId === garmentHeat.workOrderId)
assert(receivedWorkOrder)
assert.equal(receivedWorkOrder.receivedQty, receivedGarmentQty)
assert.equal(receivedWorkOrder.currentQty, receivedGarmentQty)
assert.equal(receivedWorkOrder.status, '已入待加工仓')
assert(
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId)
    .every((line) => line.currentQty === auxReceivedQtyBySkuCode[line.skuCode]),
  '加工单 SKU 当前件数必须来自辅助工艺逐 SKU 实收',
)
assert(
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId)
    .every((line) => line.receivedQty === auxReceivedQtyBySkuCode[line.skuCode]),
  '加工单 SKU 必须独立保存已收件数事实',
)
const inboundCountAfterReceipt = listFactoryWarehouseInboundRecords().length
const waitProcessCountAfterReceipt = listFactoryWaitProcessStockItems().length
const operationCountAfterReceipt = getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentHeat.workOrderId).length
assert.throws(() => executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  objectType: '成衣',
  objectQty: receivedGarmentQty,
  qtyUnit: '件',
  skuQtyBySkuCode: auxReceivedQtyBySkuCode,
}), /不能执行|已收货/, '成衣辅助工艺重复收货必须明确拒绝')
assert.equal(listFactoryWarehouseInboundRecords().length, inboundCountAfterReceipt, '重复收货不得覆盖或新增入库记录')
assert.equal(listFactoryWaitProcessStockItems().length, waitProcessCountAfterReceipt, '重复收货不得覆盖或新增待加工库存')
assert.equal(getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentHeat.workOrderId).length, operationCountAfterReceipt, '重复收货不得新增操作记录')

executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_START_PROCESS',
  objectType: '成衣',
  objectQty: receivedGarmentQty,
  qtyUnit: '件',
})
const skuCompletedQtyBySkuCode = Object.fromEntries(
  garmentSkuLines.map((line, index) => [line.skuCode, auxReceivedQtyBySkuCode[line.skuCode] - (index === 0 ? 1 : 0)]),
)
const skuScrapQtyBySkuCode = Object.fromEntries(garmentSkuLines.map((line, index) => [line.skuCode, index === 0 ? 1 : 0]))
const skuDamageQtyBySkuCode = Object.fromEntries(garmentSkuLines.map((line) => [line.skuCode, 0]))
const completedGarmentQty = Object.values(skuCompletedQtyBySkuCode).reduce((sum, qty) => sum + qty, 0)
const heatStatusBeforeZeroCompletion = getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status
const heatWaitHandoverBeforeZeroCompletion = structuredClone(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId))
assert.throws(() => executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  objectType: '成衣',
  objectQty: 0,
  qtyUnit: '件',
  skuQtyBySkuCode: Object.fromEntries(garmentSkuLines.map((line) => [line.skuCode, 0])),
  skuScrapQtyBySkuCode: Object.fromEntries(garmentSkuLines.map((line) => [line.skuCode, 0])),
  skuDamageQtyBySkuCode: Object.fromEntries(garmentSkuLines.map((line) => [line.skuCode, 0])),
}), /成衣操作至少一个 SKU 件数必须大于 0/, '全 SKU 为 0 的成衣完工必须拒绝')
assert.equal(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status, heatStatusBeforeZeroCompletion, '全零完工不得推进加工单状态')
assert.deepEqual(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId), heatWaitHandoverBeforeZeroCompletion, '全零完工不得写入待交出仓事实')
assert.throws(() => executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  objectType: '成衣',
  objectQty: completedGarmentQty,
  qtyUnit: '件',
  skuQtyBySkuCode: { ...skuCompletedQtyBySkuCode, 'EXTRA-SKU': 0 },
  skuScrapQtyBySkuCode: { ...skuScrapQtyBySkuCode, 'EXTRA-SKU': 0 },
  skuDamageQtyBySkuCode: { ...skuDamageQtyBySkuCode, 'EXTRA-SKU': 0 },
}), /全部 SKU|其他 SKU/, '成衣逐 SKU 完工不得包含加工单之外的 SKU')
assert.equal(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId)?.status, '加工中', '逐 SKU 完工校验失败不得污染加工单状态')
assert(getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId).every((line) => line.completedQty === 0), '逐 SKU 完工校验失败不得污染行完工事实')
assert.equal(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId).find((item) => item.recordType === 'WAIT_HANDOVER'), undefined, '逐 SKU 完工校验失败不得生成待交出仓')

const atomicitySourceStock = listFactoryWaitProcessStockItems()
  .find((stock) => stock.taskId === garmentHeat.workOrderId && stock.itemKind === '成衣')
assert(atomicitySourceStock, '缺少用于完工原子性测试的成衣待加工库存')
const workOrderBeforeWarehouseFailure = structuredClone(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId))
const skuLinesBeforeWarehouseFailure = structuredClone(getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId))
const warehouseFactsBeforeWarehouseFailure = structuredClone(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId))
const operationLogsBeforeWarehouseFailure = structuredClone(getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentHeat.workOrderId))
upsertFactoryWaitProcessStockItem({
  ...atomicitySourceStock,
  receivedQty: Math.max(atomicitySourceStock.receivedQty - 2, 0),
})
assert.throws(() => executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  objectType: '成衣',
  objectQty: completedGarmentQty,
  qtyUnit: '件',
  skuQtyBySkuCode: skuCompletedQtyBySkuCode,
  skuScrapQtyBySkuCode,
  skuDamageQtyBySkuCode,
}), /超过辅助工艺实际收货|完工件数无效/, '仓事实不足时必须拒绝超实收完工')
assert.deepEqual(getSpecialCraftTaskWorkOrderById(garmentHeat.workOrderId), workOrderBeforeWarehouseFailure, '仓联动失败不得污染加工单')
assert.deepEqual(getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId), skuLinesBeforeWarehouseFailure, '仓联动失败不得污染 SKU 行')
assert.deepEqual(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId), warehouseFactsBeforeWarehouseFailure, '仓联动失败不得污染统一仓事实')
assert.deepEqual(getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', garmentHeat.workOrderId), operationLogsBeforeWarehouseFailure, '仓联动失败不得污染操作日志')
upsertFactoryWaitProcessStockItem(atomicitySourceStock)

const finishResult = executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  objectType: '成衣',
  objectQty: completedGarmentQty,
  qtyUnit: '件',
  skuQtyBySkuCode: skuCompletedQtyBySkuCode,
  skuScrapQtyBySkuCode,
  skuDamageQtyBySkuCode,
})
assert(finishResult.affectedWarehouseRecordId, '成衣加工合格后必须进入辅助工艺待交出仓')
assert(getSpecialCraftTaskWorkOrderLinesByWorkOrderId(garmentHeat.workOrderId).every((line) => (
  line.completedQty === skuCompletedQtyBySkuCode[line.skuCode]
  && line.scrapQty === skuScrapQtyBySkuCode[line.skuCode]
  && line.damageQty === skuDamageQtyBySkuCode[line.skuCode]
)), '成衣完工、报废和货损必须逐 SKU 保存')
const garmentWaitHandover = getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId)
  .find((item) => item.recordType === 'WAIT_HANDOVER')
assert(garmentWaitHandover, '成衣加工完成后缺少辅助工艺待交出仓记录')
assert.equal(garmentWaitHandover.objectType, '成衣')
assert.equal(garmentWaitHandover.targetFactoryId, DEDICATED_POST_FACTORY_ID, '成衣待交出仓必须指向真实后道主体')
assert.equal(garmentWaitHandover.targetFactoryName, DEDICATED_POST_FACTORY_NAME, '成衣待交出仓接收方必须使用真实后道主体名称')
assert.equal(garmentWaitHandover.relatedFeiTicketIds.length, 0, '成衣待交出仓不得关联菲票')
const garmentWaitHandoverStock = listFactoryWaitHandoverStockItems()
  .filter((stock) => stock.taskId === garmentHeat.workOrderId && stock.itemKind === '成衣')
assert.equal(garmentWaitHandoverStock.length, garmentSkuLines.length, '成衣加工完成后必须按 SKU 进入现有待交出库存')
assert.equal(garmentWaitHandoverStock.reduce((sum, stock) => sum + stock.waitHandoverQty, 0), completedGarmentQty)
assert(garmentWaitHandoverStock.every((stock) => Number.isInteger(stock.waitHandoverQty)))
assert(garmentWaitHandoverStock.every((stock) => stock.receiverName === DEDICATED_POST_FACTORY_NAME && !stock.feiTicketNo))

const submitResult = applySpecialCraftWarehouseLinkageAfterAction({
  success: true,
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: garmentHeat.workOrderId,
  taskId: garmentHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  previousStatus: '待交出',
  nextStatus: '交出待收货',
  objectType: '成衣',
  objectQty: completedGarmentQty,
  qtyUnit: '件',
})
assert(submitResult.createdHandoverRecordId, '成衣必须从辅助工艺待交出仓发起交出')
const garmentHandover = getHandoverRecordsByWorkOrderId(garmentHeat.workOrderId)
  .find((item) => item.handoverRecordId === submitResult.createdHandoverRecordId)
assert(garmentHandover, '缺少成衣交往我方后道工厂的交出记录')
assert.equal(garmentHandover.receiveFactoryId, DEDICATED_POST_FACTORY_ID)
assert.equal(garmentHandover.receiveFactoryName, DEDICATED_POST_FACTORY_NAME)
assert.equal(garmentHandover.objectType, '成衣')
assert.equal(garmentHandover.qtyUnit, '件')
assert.equal(garmentHandover.relatedFeiTicketIds.length, 0, '成衣交出不得关联菲票')

const beforePostReceiptCount = listPostFinishingReceiptRecords().length
const beforePostTaskIds = new Set(listPostFinishingTasks().map((task) => task.postTaskId))
assert.throws(() => receiveAuxiliaryCraftGarmentsAtPostFinishing({
  handoverRecordId: 'INVALID-FRACTIONAL-POST-RECEIPT',
  productionOrderId: garmentHeat.productionOrderId,
  productionOrderNo: garmentHeat.productionOrderNo,
  sourceTaskId: garmentHeat.workOrderId,
  sourceTaskNo: garmentHeat.workOrderNo,
  sourceFactoryId: garmentHeat.factoryId,
  sourceFactoryName: garmentHeat.factoryName,
  receiverName: '后道收货员',
  receivedAt: '2026-07-22 15:00:00',
  skuLines: [{
    skuId: garmentSkuLines[0].skuCode,
    skuCode: garmentSkuLines[0].skuCode,
    colorName: garmentSkuLines[0].colorName,
    sizeName: garmentSkuLines[0].sizeCode,
    plannedQty: 2,
    receivedQty: 1.5,
  }],
}), /整数|实收/, '辅助工艺成衣进入后道的领域 API 必须拒绝小数 SKU 实收')
assert.equal(listPostFinishingReceiptRecords().length, beforePostReceiptCount, '后道领域 API 校验失败不得新增收货记录')
const postReceivedQtyBySkuCode = Object.fromEntries(
  garmentSkuLines.map((line, index) => [line.skuCode, skuCompletedQtyBySkuCode[line.skuCode] - (index === garmentSkuLines.length - 1 ? 1 : 0)]),
)
const postReceivedGarmentQty = Object.values(postReceivedQtyBySkuCode).reduce((sum, qty) => sum + qty, 0)
const handoverBeforeInvalidPostReceipt = { ...garmentHandover }
const downstreamInboundCountBeforeInvalidPostReceipt = listFactoryWarehouseInboundRecords().length
assert.throws(() => writeBackProcessHandoverRecord(garmentHandover.handoverRecordId, {
  receiveObjectQty: completedGarmentQty,
  receivePerson: '后道收货员',
  receiveAt: '2026-07-22 15:20:00',
}), /逐 SKU|SKU/, '后道成衣收货缺少逐 SKU 实收映射时必须拒绝')
assert.deepEqual(getHandoverRecordsByWorkOrderId(garmentHeat.workOrderId).find((item) => item.handoverRecordId === garmentHandover.handoverRecordId), handoverBeforeInvalidPostReceipt, '后道逐 SKU 校验失败不得污染交出记录')
assert.equal(listFactoryWarehouseInboundRecords().length, downstreamInboundCountBeforeInvalidPostReceipt, '后道逐 SKU 校验失败不得新增入库记录')
assert.equal(listPostFinishingReceiptRecords().length, beforePostReceiptCount, '后道逐 SKU 校验失败不得新增后道收货记录')
const postRollbackHandoverSnapshot = structuredClone(getHandoverRecordsByWorkOrderId(garmentHeat.workOrderId))
const postRollbackWarehouseSnapshot = structuredClone(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId))
const postRollbackInboundSnapshot = structuredClone(listFactoryWarehouseInboundRecords())
const postRollbackReceiptSnapshot = structuredClone(listPostFinishingReceiptRecords())
const postRollbackTaskSnapshot = structuredClone(listPostFinishingTasks())
assert.throws(() => writeBackProcessHandoverRecord(garmentHandover.handoverRecordId, {
  receiveObjectQty: postReceivedGarmentQty,
  receivedQtyBySkuCode: postReceivedQtyBySkuCode,
  receivePerson: '后道收货员',
  receiveAt: '2026-07-22 15:25:00',
}, {
  recordPostFactoryInbound: () => { throw new Error('模拟后道入库失败') },
}), /模拟后道入库失败/, '后道入库失败必须中止整笔交接写入')
assert.deepEqual(getHandoverRecordsByWorkOrderId(garmentHeat.workOrderId), postRollbackHandoverSnapshot, '后道入库失败必须回滚交出记录')
assert.deepEqual(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId), postRollbackWarehouseSnapshot, '后道入库失败必须回滚待交出仓')
assert.deepEqual(listFactoryWarehouseInboundRecords(), postRollbackInboundSnapshot, '后道入库失败不得残留后道入库事实')
assert.deepEqual(listPostFinishingReceiptRecords(), postRollbackReceiptSnapshot, '后道入库失败不得残留后道收货事实')
assert.deepEqual(listPostFinishingTasks(), postRollbackTaskSnapshot, '后道入库失败不得残留后道任务')
assert.throws(() => writeBackProcessHandoverRecord(garmentHandover.handoverRecordId, {
  receiveObjectQty: postReceivedGarmentQty,
  receivedQtyBySkuCode: postReceivedQtyBySkuCode,
  receivePerson: '后道收货员',
  receiveAt: '2026-07-22 15:26:00',
}, {
  receiveAtPostFinishing: () => { throw new Error('模拟后道任务创建失败') },
}), /模拟后道任务创建失败/, '后道任务创建失败必须中止整笔交接写入')
assert.deepEqual(getHandoverRecordsByWorkOrderId(garmentHeat.workOrderId), postRollbackHandoverSnapshot, '后道任务创建失败必须回滚交出记录')
assert.deepEqual(getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId), postRollbackWarehouseSnapshot, '后道任务创建失败必须回滚待交出仓')
assert.deepEqual(listFactoryWarehouseInboundRecords(), postRollbackInboundSnapshot, '后道任务创建失败不得残留后道入库事实')
assert.deepEqual(listPostFinishingReceiptRecords(), postRollbackReceiptSnapshot, '后道任务创建失败不得残留后道收货事实')
assert.deepEqual(listPostFinishingTasks(), postRollbackTaskSnapshot, '后道任务创建失败不得残留后道任务')
const received = writeBackProcessHandoverRecord(garmentHandover.handoverRecordId, {
  receiveObjectQty: postReceivedGarmentQty,
  receivePerson: '后道收货员',
  receiveAt: '2026-07-22 15:30:00',
  receivedQtyBySkuCode: postReceivedQtyBySkuCode,
  remark: '后道按逐 SKU 实收件数确认收货',
})
assert(received, '我方后道工厂必须能确认实收')
assert.equal(received.receiveObjectQty, postReceivedGarmentQty, '后道收货必须保存逐 SKU 实收合计')
assert.equal(received.diffObjectQty, -1, '后道指定 SKU 少收 1 件时总差异必须为 -1')
assert.equal(received.receivePerson, '后道收货员', '后道收货必须保存收货人')
assert.equal(received.receiveAt, '2026-07-22 15:30:00', '后道收货必须保存收货时间')
const downstreamInboundRecords = listFactoryWarehouseInboundRecords().filter((item) =>
  item.sourceRecordNo === garmentHandover.handoverRecordNo && item.itemKind === '成衣',
)
assert.equal(downstreamInboundRecords.length, garmentSkuLines.length, '后道收货必须按真实 SKU 形成工厂内部入库记录')
assert.equal(downstreamInboundRecords.reduce((sum, record) => sum + record.expectedQty, 0), completedGarmentQty)
assert.equal(downstreamInboundRecords.reduce((sum, record) => sum + record.receivedQty, 0), postReceivedGarmentQty)
assert(downstreamInboundRecords.every((record) => record.receivedQty === postReceivedQtyBySkuCode[record.materialSku || '']), '后道必须把短收落到用户指定 SKU，不得按总数顺序猜测')
assert(downstreamInboundRecords.every((record) => record.receiverName === '后道收货员'))
assert(downstreamInboundRecords.every((record) => record.receivedAt === '2026-07-22 15:30:00'))
assert(downstreamInboundRecords.every((record) => garmentSkuLines.some((line) => line.skuCode === record.materialSku)))
assert(
  listFactoryWaitProcessStockItems().some((item) =>
    item.sourceRecordNo === garmentHandover.handoverRecordNo
    && item.itemKind === '成衣'
    && item.status === '已入待加工仓',
  ),
  '后道全量收货必须进入成衣待加工库存',
)
assert.equal(listPostFinishingReceiptRecords().length, beforePostReceiptCount + 1, '后道收货必须进入既有后道收货记录')
const newPostReceipt = listPostFinishingReceiptRecords().find((record) => record.sourceTaskNo === garmentHeat.workOrderNo)
assert(newPostReceipt, '后道收货记录必须关联成衣烫画加工单')
assert.equal(newPostReceipt.skuLines.reduce((sum, line) => sum + line.receivedQty, 0), postReceivedGarmentQty, '后道收货必须保留逐 SKU 实收合计')
assert(newPostReceipt.skuLines.every((line) => line.receivedQty === postReceivedQtyBySkuCode[line.skuCode]), '后道收货记录必须保留用户指定的逐 SKU 实收')
assert(newPostReceipt.skuLines.every((line) => garmentSkuLines.some((source) => source.skuCode === line.skuCode)), '后道收货不得使用 demandLineId 伪造 SKU')
assert(newPostReceipt.skuLines.every((line) => Number.isInteger(line.receivedQty)), '后道逐 SKU 实收必须为整数件')
const newPostTasks = listPostFinishingTasks().filter((task) => !beforePostTaskIds.has(task.postTaskId))
assert.equal(newPostTasks.length, 1, '后道收货后必须精确新增一条既有后道任务')
assert.equal(newPostTasks[0].productionOrderNo, garmentHeat.productionOrderNo)
assert(newPostTasks[0].sourceTaskNos.includes(garmentHeat.workOrderNo), '后道任务必须关联成衣烫画加工单')
assert.equal(newPostTasks[0].currentStatus, '待质检', '后道收货后必须推进既有后道任务状态')
const postReceiptCountAfterSuccess = listPostFinishingReceiptRecords().length
const downstreamInboundCountAfterSuccess = listFactoryWarehouseInboundRecords().length
assert.throws(() => writeBackProcessHandoverRecord(garmentHandover.handoverRecordId, {
  receiveObjectQty: postReceivedGarmentQty,
  receivedQtyBySkuCode: postReceivedQtyBySkuCode,
  receivePerson: '后道收货员',
  receiveAt: '2026-07-22 15:40:00',
}), /已完成后道收货|重复收货/, '后道成衣重复收货必须明确拒绝')
assert.equal(listPostFinishingReceiptRecords().length, postReceiptCountAfterSuccess, '后道重复收货不得新增收货记录')
assert.equal(listFactoryWarehouseInboundRecords().length, downstreamInboundCountAfterSuccess, '后道重复收货不得新增或覆盖入库记录')
const downstreamPostWarehouseRecords = listPostFinishingWaitProcessWarehouseRecords()
  .filter((item) => item.sourceProductionOrderNo === garmentHeat.productionOrderNo)
assert(downstreamPostWarehouseRecords.length > 0, '成衣烫画收货后必须进入既有后道待加工仓状态')
assert.equal(
  downstreamPostWarehouseRecords.reduce((sum, item) => sum + item.inboundGarmentQty, 0),
  postReceivedGarmentQty,
  '既有后道待加工仓必须按实收件数承接成衣烫画结果',
)

const cutPieceHeat = heatOrders.find((item) => item.targetObject === '已裁部位')
assert(cutPieceHeat, '缺少裁片烫画回归样例')
const cutPieceReceive = applySpecialCraftWarehouseLinkageAfterAction({
  success: true,
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: cutPieceHeat.workOrderId,
  taskId: cutPieceHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  previousStatus: '待领料',
  nextStatus: '已入待加工仓',
  objectType: '裁片',
  objectQty: cutPieceHeat.planQty,
  qtyUnit: '片',
})
assert.equal(cutPieceReceive.success, true, '裁片旧链必须继续支持确认收货')
const cutPieceWaitProcess = getWarehouseRecordsByWorkOrderId(cutPieceHeat.workOrderId)
  .find((item) => item.recordType === 'WAIT_PROCESS')
assert(cutPieceWaitProcess)
assert.equal(cutPieceWaitProcess.sourceFactoryName, '裁床待交出仓')
assert.equal(cutPieceWaitProcess.targetFactoryId, cutPieceHeat.factoryId)
assert.deepEqual(cutPieceWaitProcess.relatedFeiTicketIds, cutPieceHeat.feiTicketNos, '裁片旧链必须原样保留已有菲票事实')
applySpecialCraftWarehouseLinkageAfterAction({
  success: true,
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: cutPieceHeat.workOrderId,
  taskId: cutPieceHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  previousStatus: '加工中',
  nextStatus: '待交出',
  objectType: '裁片',
  objectQty: cutPieceHeat.planQty,
  qtyUnit: '片',
})
const cutPieceSubmit = applySpecialCraftWarehouseLinkageAfterAction({
  success: true,
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: cutPieceHeat.workOrderId,
  taskId: cutPieceHeat.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  previousStatus: '待交出',
  nextStatus: '交出待收货',
  objectType: '裁片',
  objectQty: cutPieceHeat.planQty,
  qtyUnit: '片',
})
const cutPieceHandover = getHandoverRecordsByWorkOrderId(cutPieceHeat.workOrderId)
  .find((item) => item.handoverRecordId === cutPieceSubmit.createdHandoverRecordId)
assert(cutPieceHandover)
assert.equal(cutPieceHandover.handoverFactoryId, cutPieceHeat.factoryId)
assert.equal(cutPieceHandover.receiveFactoryName, '裁床工厂')
assert.equal(cutPieceHandover.receiveWarehouseName, '裁床待交出仓')
assert.deepEqual(cutPieceHandover.relatedFeiTicketIds, cutPieceHeat.feiTicketNos, '裁片交出不得丢失已有菲票事实')

const menuItems = buildSpecialCraftMenuGroups().flatMap((group) => group.items)
const heatPath = buildSpecialCraftTaskOrdersPath(heat)
const directPath = buildSpecialCraftTaskOrdersPath(direct)
assert.notEqual(heatPath, directPath, '烫画与直喷必须使用独立列表路径')
assert(menuItems.some((item) => item.title === '烫画加工单' && item.href === heatPath), '缺少独立烫画加工单菜单')
assert(menuItems.some((item) => item.title === '直喷加工单' && item.href === directPath), '缺少独立直喷加工单菜单')

const heatSlug = buildSpecialCraftOperationSlug(heat)
const directSlug = buildSpecialCraftOperationSlug(direct)
const garmentDetailHtml = renderSpecialCraftWorkOrderDetailPage(heatSlug, garmentHeat.workOrderId)
assert(garmentDetailHtml.includes('成衣仓'), '成衣加工单详情必须展示上游成衣仓')
assert(garmentDetailHtml.includes('我方后道工厂'), '成衣加工单详情必须展示下游我方后道工厂')
assert(!garmentDetailHtml.includes('菲票记录'), '成衣加工单详情不得展示菲票页签或菲票区块')
assert(!garmentDetailHtml.includes('回裁床'), '成衣加工单详情不得出现回裁床动作')
assert(!garmentDetailHtml.includes('确认接收成衣'), '成衣加工单已收货后不得继续显示重复收货动作')
assert(!garmentDetailHtml.includes('确认接收裁片') && !garmentDetailHtml.includes('接收裁片数量'), '成衣加工单不得残留裁片接收文案')
const heatStorageKey = buildSpecialCraftTaskListStorageKey(heatSlug)
const directStorageKey = buildSpecialCraftTaskListStorageKey(directSlug)
assert.notEqual(heatStorageKey, directStorageKey, '烫画与直喷筛选持久化键不得共用')
assert(heatStorageKey.includes(heatSlug), '烫画筛选持久化键必须包含当前 operation slug')
assert(directStorageKey.includes(directSlug), '直喷筛选持久化键必须包含当前 operation slug')

const preferenceValues = new Map<string, string>()
const preferenceStorage = {
  getItem: (key: string) => preferenceValues.get(key) ?? null,
  setItem: (key: string, value: string) => {
    preferenceValues.set(key, value)
  },
}
writeSpecialCraftTaskListPreference(preferenceStorage, heatSlug, {
  keyword: 'heat-only',
  factoryId: 'FAC-AUX-HEAT-TRANSFER',
  status: '加工中',
  abnormalStatus: '无异常',
  timeRange: '7D',
  page: 8,
  pageSize: 50,
})
writeSpecialCraftTaskListPreference(preferenceStorage, directSlug, {
  keyword: 'direct-only',
  factoryId: 'FAC-AUX-DIRECT-PRINT',
  status: '待领料',
  abnormalStatus: '全部',
  timeRange: '30D',
  page: 6,
  pageSize: 10,
})
assert(!Object.hasOwn(JSON.parse(preferenceValues.get(heatStorageKey) || '{}'), 'page'), '当前页不得写入偏好')
assert.deepEqual(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']),
  {
    keyword: 'heat-only',
    factoryId: 'FAC-AUX-HEAT-TRANSFER',
    status: '加工中',
    abnormalStatus: '无异常',
    timeRange: '7D',
    page: 1,
    pageSize: 50,
  },
  '烫画偏好必须独立读回且当前页重置为 1',
)
assert.equal(
  readSpecialCraftTaskListPreference(preferenceStorage, directSlug, ['FAC-AUX-DIRECT-PRINT']).keyword,
  'direct-only',
  '直喷偏好不得被烫画覆盖',
)

preferenceValues.set(heatStorageKey, JSON.stringify({
  keyword: 12,
  factoryId: 'FAC-REMOVED',
  status: '非法状态',
  abnormalStatus: '非法异常',
  timeRange: 'OLD_RANGE',
  page: 99,
  pageSize: 999,
}))
assert.deepEqual(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']),
  {
    keyword: '',
    factoryId: '全部',
    status: '全部',
    abnormalStatus: '全部',
    timeRange: 'ALL',
    page: 1,
    pageSize: 20,
  },
  '非法或已失效偏好必须回退稳定默认值',
)
preferenceValues.set(heatStorageKey, JSON.stringify({ keyword: '旧偏好', factoryId: 'ALL', status: '', abnormalStatus: 'ALL' }))
assert.deepEqual(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']),
  {
    keyword: '旧偏好',
    factoryId: '全部',
    status: '全部',
    abnormalStatus: '全部',
    timeRange: 'ALL',
    page: 1,
    pageSize: 20,
  },
  '旧版 ALL、空值和残缺偏好必须兼容并补齐默认值',
)
preferenceValues.set(heatStorageKey, '{invalid-json')
assert.equal(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']).page,
  1,
  '损坏偏好不得导致页面崩溃',
)
const heatListHtml = renderSpecialCraftTaskOrdersPage(heatSlug)
const directListHtml = renderSpecialCraftTaskOrdersPage(directSlug)
assert(heatListHtml.includes('烫画加工单'), '烫画列表 H1 或面包屑缺少烫画加工单')
assert(directListHtml.includes('直喷加工单'), '直喷列表 H1 或面包屑缺少直喷加工单')
assert(heatListHtml.includes('aria-label="面包屑"') && heatListHtml.includes('烫画'), '烫画列表必须展示当前工艺面包屑')
assert(directListHtml.includes('aria-label="面包屑"') && directListHtml.includes('直喷'), '直喷列表必须展示当前工艺面包屑')

for (const [operation, order, slug] of [[heat, heatOrders[0], heatSlug], [direct, directOrders[0], directSlug]] as const) {
  const detailHtml = renderSpecialCraftWorkOrderDetailPage(slug, order.workOrderId)
  const returnPath = buildSpecialCraftTaskDetailPath(operation, order.taskOrderId)
  assert(detailHtml.includes(returnPath), `${operation.craftName}加工单详情返回路径必须保留当前 operation slug`)
}

const invalidListHtml = renderSpecialCraftTaskOrdersPage('invalid-operation')
assert(invalidListHtml.includes('未找到对应特殊工艺'), '无效 operation slug 的列表必须展示明确缺失态')
assert(!invalidListHtml.includes('烫画加工单') && !invalidListHtml.includes('直喷加工单'), '无效列表不得串到烫画或直喷')
const invalidDetailHtml = renderSpecialCraftWorkOrderDetailPage('invalid-operation', directOrders[0].workOrderId)
assert(invalidDetailHtml.includes('未找到对应加工单'), '无效 operation slug 的详情必须安全展示空态')
assert(!invalidDetailHtml.includes(directOrders[0].workOrderNo), '无效详情不得泄漏其他工艺加工单')

const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const workOrderDetailSource = read('src/pages/process-factory/special-craft/work-order-detail.ts')
const pdaExecDetailSource = read('src/pages/pda-exec-detail.ts')
const factoryInternalWarehouseSource = read('src/data/fcs/factory-internal-warehouse.ts')
const processWorkOrderDomainSource = read('src/data/fcs/process-work-order-domain.ts')
const processWorkOrderGenerationSource = read('src/data/fcs/process-work-order-generation-service.ts')
const processWorkOrderGenerationKeySource = read('src/data/fcs/process-work-order-generation-key.ts')
const printingTaskDomainSource = read('src/data/fcs/printing-task-domain.ts')
const dyeingTaskDomainSource = read('src/data/fcs/dyeing-task-domain.ts')
assert(processWorkOrderDomainSource.includes("'PRODUCTION_ORDER' | 'STOCK' | 'CUT_PIECE_SUPPLEMENT'"), '印染加工单必须支持生产单、备货和裁片补料三种来源')
assert(processWorkOrderDomainSource.includes('sourceSnapshot: ProcessWorkOrderSourceSnapshot'), '统一加工单必须强制携带来源快照')
for (const sourceKeyField of ['sourceType', 'processCode', 'productionOrderId', 'stockMaterialId', 'supplementRecordId']) {
  assert(processWorkOrderGenerationKeySource.includes(`['${sourceKeyField}',`), `统一创建服务幂等键缺少命名字段 ${sourceKeyField}`)
}
assert(processWorkOrderGenerationKeySource.includes('JSON.stringify(keyFields)'), '统一创建服务幂等键必须使用无歧义稳定序列化')
assert(!processWorkOrderGenerationKeySource.includes(".join('|')"), '统一创建服务幂等键不得继续使用可碰撞的分隔符拼接')
assert(!printingTaskDomainSource.includes("from './process-work-order-generation-service.ts'"), '印花领域不得反向依赖加工单编排服务')
assert(!dyeingTaskDomainSource.includes("from './process-work-order-generation-service.ts'"), '染色领域不得反向依赖加工单编排服务')
assert(factoryInternalWarehouseSource.includes('ProcessWorkOrderSourceType'), '工厂内部仓来源类型必须复用三来源统一类型')
assert(factoryInternalWarehouseSource.includes('sourceSnapshot?: ProcessWorkOrderSourceSnapshot'), '工厂内部仓记录必须保留完整来源快照')
for (const forbidden of ['prerequisiteWorkOrderId', 'lockedByDyeWorkOrderId', 'unlockStatus']) {
  assert(!processWorkOrderDomainSource.includes(forbidden), `印染加工单不得引入运行时互锁字段 ${forbidden}`)
}
assert(!factoryInternalWarehouseSource.includes('pickupFallbackFactories'), '领料入库不得以任意非车缝工厂兜底主体')
assert(!factoryInternalWarehouseSource.includes('fallbackType?: FactoryType'), '工厂名称解析不得按工厂类型兜底主体')
assert(!factoryInternalWarehouseSource.includes('factory.factoryType === fallbackType'), '工厂名称解析缺少精确主体时必须失败关闭')
assert(routeSource.includes('buildSpecialCraftTaskOrdersPath(operation)'), '动态路由必须按 operation 生成独立列表入口')
assert(rendererSource.includes('renderSpecialCraftTaskOrdersPage'), '动态路由缺少公共加工单列表渲染器')
assert(taskOrdersSource.includes('buildSpecialCraftTaskListStorageKey'), '筛选持久化键必须按 operation slug 独立')
assert(workOrderDetailSource.includes('SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND'), '成衣加工单 Web 详情必须提供成衣仓出库入口')
assert(workOrderDetailSource.includes('逐 SKU 实出件数'), '成衣仓出库入口必须逐 SKU 输入并确认')
assert(workOrderDetailSource.includes('confirm-post-garment-receipt'), '成衣交出记录必须提供后道逐 SKU 实收确认入口')
assert(workOrderDetailSource.includes('后道逐 SKU 实收确认'), '后道收货入口必须明确逐 SKU 输入口径')
assert(pdaExecDetailSource.includes('data-special-craft-garment-sku'), 'PDA 成衣加工执行必须逐 SKU 展示')
const garmentHandoverProjectionSource = factoryInternalWarehouseSource.slice(
  factoryInternalWarehouseSource.indexOf('export function recordGarmentReadyToHandoverAtAuxiliaryFactory'),
  factoryInternalWarehouseSource.indexOf('const ONBOARDING_CUTTING_FACTORIES'),
)
assert(!garmentHandoverProjectionSource.includes('remainingQty'), '成衣逐 SKU 完工进入待交出仓不得保留按总数顺序分摊路径')
for (const label of ['应收', '已收', '可加工', '完工', '报废', '货损']) {
  assert(pdaExecDetailSource.includes(label), `PDA 成衣加工逐 SKU 首屏缺少${label}字段`)
}

console.log('[check-heat-transfer-and-print-dye-contract] 独立烫画与直喷加工单契约通过')
