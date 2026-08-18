import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { productionDemands } from './production-demands.ts'
import { productionOrders } from './production-orders.ts'
import {
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from './special-craft-task-orders.ts'

export type SpecialCraftPdaScanPurpose = 'EXECUTION' | 'RECEIVE' | 'HANDOVER'

export interface SpecialCraftPdaScanCandidate {
  order: SpecialCraftTaskOrder
  taskId: string
  styleNo: string
  styleName: string
  styleImageUrl: string
}

export type SpecialCraftPdaScanResolution =
  | { status: 'EMPTY' | 'NOT_FOUND' | 'FORBIDDEN' | 'UNAVAILABLE'; message: string; candidates: [] }
  | { status: 'MATCH'; message: string; candidates: [SpecialCraftPdaScanCandidate] }
  | { status: 'MULTIPLE'; message: string; candidates: SpecialCraftPdaScanCandidate[] }

function normalizeScanCode(value: string): string {
  return value.trim().toLocaleUpperCase()
}

function matchesCode(code: string | undefined, normalizedCode: string): boolean {
  return normalizeScanCode(code || '') === normalizedCode
}

function matchesProcessingOrderCode(order: SpecialCraftTaskOrder, normalizedCode: string): boolean {
  return [order.taskOrderNo, order.taskOrderId, order.sourceTaskNo, order.sourceTaskId]
    .some((code) => matchesCode(code, normalizedCode))
}

function matchesProductionOrderCode(order: SpecialCraftTaskOrder, normalizedCode: string): boolean {
  return [order.productionOrderNo, order.productionOrderId]
    .some((code) => matchesCode(code, normalizedCode))
}

function isActionable(order: SpecialCraftTaskOrder, purpose: SpecialCraftPdaScanPurpose): boolean {
  if (purpose === 'RECEIVE') return order.status === '待接收'
  if (purpose === 'HANDOVER') return order.status === '加工中' && order.completedQty > (order.returnedQty || 0)
  return order.status === '加工中'
}

function getUnavailableMessage(purpose: SpecialCraftPdaScanPurpose): string {
  if (purpose === 'RECEIVE') return '该加工单当前不能确认接收，请核对是否已接收或已完结。'
  if (purpose === 'HANDOVER') return '当前没有可交出的加工成品，请先到“执行”完成加工填报。'
  return '当前没有可执行动作，请先到“交接”确认接收，或核对加工单是否已完成。'
}

function resolveCandidate(order: SpecialCraftTaskOrder): SpecialCraftPdaScanCandidate {
  const productionOrder = productionOrders.find((item) =>
    item.productionOrderId === order.productionOrderId || item.productionOrderNo === order.productionOrderNo,
  )
  const demand = productionDemands.find((item) =>
    item.demandId === productionOrder?.demandId || item.productionOrderId === order.productionOrderId,
  )
  const imageSnapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)?.imageSnapshot
  const styleImageUrl = [
    ...(imageSnapshot?.styleImages || []),
    ...(imageSnapshot?.productImages || []),
    demand?.imageUrl || '',
  ].find((url) => /^(?:https?:\/\/|\/|data:image\/)/i.test(url.trim())) || ''

  return {
    order,
    taskId: order.sourceTaskId || order.taskOrderId,
    styleNo: productionOrder?.demandSnapshot.spuCode || demand?.spuCode || order.productionOrderNo,
    styleName: productionOrder?.demandSnapshot.spuName || demand?.spuName || order.operationName,
    styleImageUrl,
  }
}

export function resolveSpecialCraftPdaScan(
  rawCode: string,
  currentFactoryId: string,
  purpose: SpecialCraftPdaScanPurpose,
): SpecialCraftPdaScanResolution {
  const normalizedCode = normalizeScanCode(rawCode)
  if (!normalizedCode) {
    return { status: 'EMPTY', message: '请扫描生产单码或加工单码。', candidates: [] }
  }

  const orders = listSpecialCraftTaskOrders()
  const processingOrderMatches = orders.filter((order) => matchesProcessingOrderCode(order, normalizedCode))
  const exactMatches = processingOrderMatches.length > 0
    ? processingOrderMatches
    : orders.filter((order) => matchesProductionOrderCode(order, normalizedCode))
  if (exactMatches.length === 0) {
    return { status: 'NOT_FOUND', message: `未识别到生产单或加工单：${rawCode.trim()}`, candidates: [] }
  }

  const ownedMatches = exactMatches.filter((order) => order.factoryId === currentFactoryId)
  if (ownedMatches.length === 0) {
    return { status: 'FORBIDDEN', message: '该单不属于当前登录工厂，不能操作。', candidates: [] }
  }

  const candidates = ownedMatches
    .filter((order) => isActionable(order, purpose))
    .map(resolveCandidate)
    .sort((left, right) => left.order.taskOrderNo.localeCompare(right.order.taskOrderNo, 'zh-CN'))
  if (candidates.length === 0) {
    return { status: 'UNAVAILABLE', message: getUnavailableMessage(purpose), candidates: [] }
  }
  if (candidates.length === 1) {
    return { status: 'MATCH', message: '已识别加工单。', candidates: [candidates[0]] }
  }
  return {
    status: 'MULTIPLE',
    message: `该生产单包含 ${candidates.length} 张可操作加工单，请选择加工单。`,
    candidates,
  }
}

export function hasSpecialCraftOrdersForFactory(factoryId: string): boolean {
  return listSpecialCraftTaskOrders().some((order) => order.factoryId === factoryId)
}

export function getSpecialCraftPdaCandidateByTaskId(taskId: string): SpecialCraftPdaScanCandidate | null {
  const order = listSpecialCraftTaskOrders().find((item) =>
    item.sourceTaskId === taskId || item.taskOrderId === taskId,
  )
  return order ? resolveCandidate(order) : null
}
