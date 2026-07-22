import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  upsertFactoryWaitHandoverStockItem,
  upsertFactoryWaitProcessStockItem,
} from './factory-internal-warehouse.ts'
import {
  executeMobileProcessAction,
  type ProcessActionWritebackResult,
} from './process-action-writeback-service.ts'
import {
  getSpecialCraftTaskWorkOrderById,
} from './special-craft-task-orders.ts'
import { getProcessHandoverRecordById } from './process-warehouse-domain.ts'
import { findFactoryPdaRoleById, getPdaSession } from './store-domain-pda.ts'

export interface SpecialCraftPdaWarehouseActionTarget {
  stockItemId: string
  workOrderId: string
  skuCode: string
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function getAuthorizedActor(permission: 'TASK_START' | 'HANDOUT_CREATE', factoryId: string) {
  const session = getPdaSession()
  if (!session) throw new Error('当前账号未登录，不能执行仓动作。')
  if (session.factoryId !== factoryId) throw new Error('当前账号无权操作其他工厂库存。')
  const role = findFactoryPdaRoleById(session.roleId, session.factoryId)
  if (!role || role.status !== 'ACTIVE' || !role.permissionKeys.includes(permission)) {
    throw new Error('当前账号角色无权执行该仓动作。')
  }
  return {
    operatorName: session.userName,
    operatorUserId: session.userId,
    operatorFactoryId: session.factoryId,
    operatorRoleId: session.roleId,
    operatorRoleName: role.roleName,
  }
}

function assertTargetMatches(
  target: SpecialCraftPdaWarehouseActionTarget,
  actual: { stockItemId: string; taskId?: string; materialSku?: string },
): void {
  if (
    actual.stockItemId !== target.stockItemId
    || actual.taskId !== target.workOrderId
    || (actual.materialSku || '') !== target.skuCode
  ) {
    throw new Error('仓动作对象与库存、加工单或 SKU 不一致。')
  }
}

export function executeSpecialCraftWaitProcessIssue(
  target: SpecialCraftPdaWarehouseActionTarget,
): ProcessActionWritebackResult {
  const selected = listFactoryWaitProcessStockItems().find((item) => item.stockItemId === target.stockItemId)
  if (!selected || selected.itemKind !== '成衣') throw new Error('未找到可加工领用的成衣库存。')
  assertTargetMatches(target, selected)
  if (selected.status === '已领用' || Number(selected.availableQty ?? selected.receivedQty) <= 0) {
    throw new Error('该成衣库存已领用，不能重复操作。')
  }
  const workOrder = getSpecialCraftTaskWorkOrderById(target.workOrderId)
  if (!workOrder || workOrder.factoryId !== selected.factoryId || workOrder.status !== '已入待加工仓') {
    throw new Error('加工单当前状态不能执行加工领用。')
  }
  const actor = getAuthorizedActor('TASK_START', selected.factoryId)
  const taskStocks = listFactoryWaitProcessStockItems()
    .filter((item) => item.taskId === target.workOrderId && item.itemKind === '成衣')
  if (!taskStocks.length || taskStocks.some((item) => item.status === '已领用')) {
    throw new Error('加工单库存已领用或不完整，不能重复开工。')
  }
  const result = executeMobileProcessAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: workOrder.workOrderId,
    taskId: workOrder.taskOrderId,
    actionCode: 'SPECIAL_CRAFT_START_PROCESS',
    ...actor,
    operatedAt: nowText(),
    objectType: '成衣',
    objectQty: taskStocks.reduce((sum, item) => sum + Number(item.availableQty ?? item.receivedQty), 0),
    qtyUnit: '件',
    remark: `PDA 待加工仓按 ${target.skuCode} 定位并领用整单成衣库存`,
  })
  taskStocks.forEach((item) => upsertFactoryWaitProcessStockItem({
    ...item,
    availableQty: 0,
    issuedQty: item.receivedQty,
    status: '已领用',
    remark: `${actor.operatorName}已加工领用`,
  }))
  return result
}

export function executeSpecialCraftWaitHandoverSubmit(
  target: SpecialCraftPdaWarehouseActionTarget,
): ProcessActionWritebackResult {
  const selected = listFactoryWaitHandoverStockItems().find((item) => item.stockItemId === target.stockItemId)
  if (!selected || selected.itemKind !== '成衣') throw new Error('未找到可交出的成衣库存。')
  assertTargetMatches(target, selected)
  if (selected.status === '已交出' || selected.waitHandoverQty <= 0) throw new Error('该成衣库存已交出，不能重复操作。')
  const workOrder = getSpecialCraftTaskWorkOrderById(target.workOrderId)
  if (!workOrder || workOrder.factoryId !== selected.factoryId || workOrder.status !== '待交出') {
    throw new Error('加工单当前状态不能执行交出。')
  }
  const actor = getAuthorizedActor('HANDOUT_CREATE', selected.factoryId)
  const taskStocks = listFactoryWaitHandoverStockItems()
    .filter((item) => item.taskId === target.workOrderId && item.itemKind === '成衣')
  if (!taskStocks.length || taskStocks.some((item) => item.status === '已交出')) {
    throw new Error('加工单待交出库存已处理或不完整，不能重复交出。')
  }
  const result = executeMobileProcessAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: workOrder.workOrderId,
    taskId: workOrder.taskOrderId,
    actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
    ...actor,
    operatedAt: nowText(),
    objectType: '成衣',
    objectQty: taskStocks.reduce((sum, item) => sum + item.waitHandoverQty, 0),
    qtyUnit: '件',
    remark: `PDA 待交出仓按 ${target.skuCode} 定位并交出整单成衣`,
  })
  const handover = getProcessHandoverRecordById(result.affectedHandoverRecordId)
  if (!handover) throw new Error('交出记录未生成，不能完成待交出库存扣减。')
  taskStocks.forEach((item) => upsertFactoryWaitHandoverStockItem({
    ...item,
    handoverRecordId: handover.handoverRecordId,
    handoverRecordNo: handover.handoverRecordNo,
    waitHandoverQty: 0,
    status: '已交出',
    remark: `${actor.operatorName}已交出至${handover.receiveFactoryName}`,
  }))
  return result
}
