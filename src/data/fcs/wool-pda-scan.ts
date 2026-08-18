import {
  getWoolAllowedActions,
  listWoolWorkOrders,
  type WoolAllowedAction,
  type WoolWorkOrder,
} from './wool-task-domain.ts'

export type WoolPdaScanPurpose = 'EXECUTION' | 'RECEIVE' | 'HANDOVER'

export interface WoolPdaScanCandidate {
  order: WoolWorkOrder
  availableActions: WoolAllowedAction[]
}

export type WoolPdaScanResolution =
  | { status: 'EMPTY' | 'NOT_FOUND' | 'FORBIDDEN' | 'UNAVAILABLE'; message: string; candidates: [] }
  | { status: 'MATCH'; message: string; candidates: [WoolPdaScanCandidate] }
  | { status: 'MULTIPLE'; message: string; candidates: WoolPdaScanCandidate[] }

const PURPOSE_ACTIONS: Record<WoolPdaScanPurpose, WoolAllowedAction[]> = {
  EXECUTION: ['REPORT_PROCESS', 'ASSOCIATE_MACHINE', 'COMPLETE'],
  RECEIVE: ['RECEIVE_YARN'],
  HANDOVER: ['HANDOVER'],
}

function normalizeScanCode(value: string): string {
  return value.trim().toLocaleUpperCase()
}

function matchesCode(code: string | undefined, normalizedCode: string): boolean {
  return normalizeScanCode(code || '') === normalizedCode
}

function matchesProcessingOrderCode(order: WoolWorkOrder, normalizedCode: string): boolean {
  return [order.woolOrderNo, order.woolOrderId, order.taskNo, order.taskId]
    .some((code) => matchesCode(code, normalizedCode))
}

function matchesProductionOrderCode(order: WoolWorkOrder, normalizedCode: string): boolean {
  return [order.productionOrderNo, order.productionOrderId]
    .some((code) => matchesCode(code, normalizedCode))
}

function getPurposeActions(order: WoolWorkOrder, purpose: WoolPdaScanPurpose): WoolAllowedAction[] {
  const required = new Set(PURPOSE_ACTIONS[purpose])
  return getWoolAllowedActions(order.woolOrderId).filter((action) => required.has(action))
}

function unavailableMessage(purpose: WoolPdaScanPurpose): string {
  if (purpose === 'RECEIVE') return '该毛织加工单已完成，不能再确认接收。'
  if (purpose === 'HANDOVER') return '当前没有可交出的加工成品，请先到“执行”完成加工填报。'
  return '当前没有可执行动作，请先到“交接”确认接收，或核对加工单是否已完成。'
}

export function resolveWoolPdaScan(
  rawCode: string,
  currentFactoryId: string,
  purpose: WoolPdaScanPurpose,
): WoolPdaScanResolution {
  const normalizedCode = normalizeScanCode(rawCode)
  if (!normalizedCode) {
    return { status: 'EMPTY', message: '请扫描生产单码或毛织加工单码。', candidates: [] }
  }

  const orders = listWoolWorkOrders()
  const processingOrderMatches = orders.filter((order) => matchesProcessingOrderCode(order, normalizedCode))
  const exactMatches = processingOrderMatches.length > 0
    ? processingOrderMatches
    : orders.filter((order) => matchesProductionOrderCode(order, normalizedCode))
  if (exactMatches.length === 0) {
    return { status: 'NOT_FOUND', message: `未识别到生产单或毛织加工单：${rawCode.trim()}`, candidates: [] }
  }

  const ownedMatches = exactMatches.filter((order) => order.factoryId === currentFactoryId)
  if (ownedMatches.length === 0) {
    return { status: 'FORBIDDEN', message: '该单不属于当前登录工厂，不能操作。', candidates: [] }
  }

  const candidates = ownedMatches
    .map((order): WoolPdaScanCandidate => ({
      order,
      availableActions: getPurposeActions(order, purpose),
    }))
    .filter((candidate) => candidate.availableActions.length > 0)
    .sort((left, right) => left.order.woolOrderNo.localeCompare(right.order.woolOrderNo, 'zh-CN'))

  if (candidates.length === 0) {
    return { status: 'UNAVAILABLE', message: unavailableMessage(purpose), candidates: [] }
  }
  if (candidates.length === 1) {
    return { status: 'MATCH', message: '已识别毛织加工单。', candidates: [candidates[0]] }
  }
  return {
    status: 'MULTIPLE',
    message: `该生产单包含 ${candidates.length} 张可操作的毛织加工单，请选择加工单。`,
    candidates,
  }
}

export function isWoolOrderActionableForPurpose(
  order: WoolWorkOrder,
  purpose: WoolPdaScanPurpose,
): boolean {
  return getPurposeActions(order, purpose).length > 0
}
