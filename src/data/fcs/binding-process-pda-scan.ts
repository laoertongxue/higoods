import {
  buildBindingProcessOrders,
  getBindingProcessOrderById,
} from '../../pages/process-factory/cutting/binding-strip-orders.ts'
import type { BindingProcessOrder } from '../../pages/process-factory/cutting/special-processes-model.ts'

export type BindingProcessPdaScanPurpose = 'EXECUTION' | 'RECEIVE' | 'HANDOVER'

export interface BindingProcessPdaScanCandidate {
  sourceType: 'BINDING_PROCESS_ORDER'
  workOrderId: string
  workOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  factoryId: string
  factoryName: string
  order: BindingProcessOrder
}

export type BindingProcessPdaScanResolution =
  | { status: 'EMPTY' | 'NOT_FOUND' | 'FORBIDDEN' | 'UNAVAILABLE'; message: string; candidates: [] }
  | { status: 'MATCH'; message: string; candidates: [BindingProcessPdaScanCandidate] }
  | { status: 'MULTIPLE'; message: string; candidates: BindingProcessPdaScanCandidate[] }

function normalize(value: string | null | undefined): string {
  const raw = String(value || '').trim().toLocaleUpperCase()
  const workOrderPrefix = 'FCS:WORK_ORDER:V1:'
  return raw.startsWith(workOrderPrefix) ? raw.slice(workOrderPrefix.length) : raw
}

function isActionable(order: BindingProcessOrder, purpose: BindingProcessPdaScanPurpose): boolean {
  if (purpose === 'RECEIVE') {
    return order.status === '待加工' || (order.status === '加工中' && order.receivedMaterialLength < order.requiredMaterialLength)
  }
  if (purpose === 'HANDOVER') {
    return (order.status === '加工中' || order.status === '已完成')
      && order.actualOutputQty > (order.handedOverQty || 0)
  }
  return order.status === '加工中'
}

function toCandidate(order: BindingProcessOrder): BindingProcessPdaScanCandidate {
  return {
    sourceType: 'BINDING_PROCESS_ORDER',
    workOrderId: order.bindingOrderId,
    workOrderNo: order.bindingOrderNo,
    sourceTaskId: order.sourceTaskId,
    sourceTaskNo: order.sourceTaskNo,
    factoryId: order.factoryId,
    factoryName: order.factoryName,
    order,
  }
}

function unavailableMessage(purpose: BindingProcessPdaScanPurpose): string {
  if (purpose === 'RECEIVE') return '该捆条加工单当前没有可接收的面料，请核对状态和累计实收。'
  if (purpose === 'HANDOVER') return '该捆条加工单当前没有可交出的捆条，请先完成加工填报。'
  return '该捆条加工单当前不能加工填报，请先确认接收或核对是否已完成。'
}

export function resolveBindingProcessPdaScan(
  rawCode: string,
  currentFactoryId: string,
  purpose: BindingProcessPdaScanPurpose,
): BindingProcessPdaScanResolution {
  const normalized = normalize(rawCode)
  if (!normalized) return { status: 'EMPTY', message: '请扫描捆条加工单码或捆条菲票。', candidates: [] }

  const orders = buildBindingProcessOrders()
  const exactWorkOrders = orders.filter((order) =>
    [order.bindingOrderId, order.bindingOrderNo].some((value) => normalize(value) === normalized),
  )
  const matches = exactWorkOrders.length
    ? exactWorkOrders
    : orders.filter((order) => [
        order.sourceTaskId,
        order.sourceTaskNo,
        order.sourceProductionOrderId,
        order.sourceProductionOrderNo,
        ...order.sourceFeiTicketIds,
        ...order.sourceFeiTicketNos,
      ].some((value) => normalize(value) === normalized))
  if (!matches.length) {
    return { status: 'NOT_FOUND', message: `未识别到捆条加工单或菲票：${rawCode.trim()}`, candidates: [] }
  }

  const owned = matches.filter((order) => order.factoryId === currentFactoryId)
  if (!owned.length) {
    return { status: 'FORBIDDEN', message: '该捆条加工单不属于当前登录裁床工厂，不能操作。', candidates: [] }
  }
  const candidates = owned
    .filter((order) => isActionable(order, purpose))
    .map(toCandidate)
    .sort((left, right) => left.workOrderNo.localeCompare(right.workOrderNo, 'zh-CN'))
  if (!candidates.length) return { status: 'UNAVAILABLE', message: unavailableMessage(purpose), candidates: [] }
  if (candidates.length === 1) return { status: 'MATCH', message: '已识别捆条加工单。', candidates: [candidates[0]] }
  return {
    status: 'MULTIPLE',
    message: `当前编码对应 ${candidates.length} 张捆条加工单，请按加工单号和规格选择。`,
    candidates,
  }
}

export function hasBindingProcessOrdersForFactory(factoryId: string): boolean {
  return buildBindingProcessOrders().some((order) => order.factoryId === factoryId)
}

export function getBindingProcessPdaCandidateByWorkOrderId(workOrderId: string): BindingProcessPdaScanCandidate | null {
  const order = getBindingProcessOrderById(workOrderId)
  return order ? toCandidate(order) : null
}

export function getBindingProcessPdaCandidatesByTaskId(sourceTaskId: string): BindingProcessPdaScanCandidate[] {
  return buildBindingProcessOrders()
    .filter((order) => order.sourceTaskId === sourceTaskId)
    .map(toCandidate)
    .sort((left, right) => left.workOrderNo.localeCompare(right.workOrderNo, 'zh-CN'))
}
