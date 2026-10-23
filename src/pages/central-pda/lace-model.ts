import { listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { parseFcsQrValue } from '../../data/fcs/task-qr.ts'
import {
  PLATFORM_ADMIN, listLaceProductionOrders, captureLaceFactoryRuntime, confirmLaceProductionReceipt,
  createLaceCompletionReport, createLaceHandover, completeLaceProduction,
  type LaceActor, type LaceProductionOrderView,
} from '../../data/fcs/lace-factory-domain.ts'
import { runLaceFactoryRecordCommand } from '../../data/fcs/lace-factory-records.ts'

export type CentralLaceAction = 'receive' | 'work' | 'handoff' | 'finish'
export function centralLaceOrders(factoryId: string) {
  const factory = listFactoryMasterRecords().find(factory => factory.id === factoryId && factory.status === 'active' && isCentralPdaFactory(factory))
  return factory ? listLaceProductionOrders(PLATFORM_ADMIN).filter(order => order.factoryOrgId === factory.id) : []
}
/** The original Web accepts the production task, not a fabricated material receipt. */
export function centralLaceActions(order: LaceProductionOrderView): CentralLaceAction[] {
  if (order.status === '待接收') return ['receive']
  const actions: CentralLaceAction[] = []
  if (order.status === '加工中') actions.push('work')
  if (['加工中', '已完结'].includes(order.status) && order.remainingHandoverQty > 0) actions.push('handoff')
  if (order.status === '加工中' && order.completedQty > 0) actions.push('finish')
  return actions
}
export function centralLaceScan(raw: string, factoryId: string) {
  let key = raw.trim()
  if (/^FCS:/i.test(key)) {
    const qr = parseFcsQrValue(key.replace(/^fcs:work_order:v1:/i, 'FCS:WORK_ORDER:v1:'))
    if (qr.type !== 'WORK_ORDER' || qr.version !== 'v1') return []
    key = qr.id || ''
  }
  key = key.toLowerCase()
  if (!key) return []
  return centralLaceOrders(factoryId).filter(order => [order.workOrderId, order.workOrderNo, order.purchaseOrderNo, order.skuCode]
    .some(value => value.toLowerCase() === key))
}
export function centralLaceActor(user: FactoryPdaUser): LaceActor {
  const actual = readFactoryPdaExecutionUsers(user.factoryId).find(row => row.userId === user.userId)
  const factory = listFactoryMasterRecords().find(row => row.id === user.factoryId && row.status === 'active' && isCentralPdaFactory(row))
  if (!factory || !actual || actual.status !== 'ACTIVE' || actual.name !== user.name || actual.factoryId !== user.factoryId) throw new Error('实际操作账号与本厂不一致，请重新登录。')
  return { actorId: actual.userId, actorName: actual.name, factoryOrgId: actual.factoryId, role: '花边厂业务员' }
}
export function centralLaceRevision(workOrderId: string) {
  return JSON.stringify(captureLaceFactoryRuntime().workOrders.find(order => order.workOrderId === workOrderId))
}
export interface CentralLaceCommand {
  workOrderId: string; action: CentralLaceAction; operationId: string; expectedRevision: string
  qty?: number; note?: string; overproductionConfirmed?: boolean
  deliveryNo?: string; packageCount?: number; expectedReceiverName?: string; packageNote?: string
}
/** Delegate all quantities/statuses to the current Web domain, retaining actual
 * account identity and independent receiver records in the same record command. */
export function centralLaceCommandIntent(command: CentralLaceCommand, user: FactoryPdaUser) {
  const { workOrderId, action, operationId: _operationId, expectedRevision: _revision, ...payload } = command
  return JSON.stringify({ workOrderId, action, payload, userId: user.userId, factoryId: user.factoryId })
}
export async function saveCentralLaceCommand(command: CentralLaceCommand, user: FactoryPdaUser) {
  const { workOrderId, action, operationId, expectedRevision, ...payload } = command
  const intent = centralLaceCommandIntent(command, user)
  await runLaceFactoryRecordCommand(operationId, intent, () => {
    const actor = centralLaceActor(user), order = centralLaceOrders(user.factoryId).find(order => order.workOrderId === workOrderId)
    if (!order) throw new Error('本厂没有这张花边生产单。')
    if (!centralLaceActions(order).includes(action)) throw new Error('当前状态不能执行此操作，请重新读取单据。')
    if (action === 'receive') return confirmLaceProductionReceipt(workOrderId, actor)
    if (action === 'work') return createLaceCompletionReport({ workOrderId, qty: payload.qty ?? NaN, note: payload.note,
      overproductionConfirmed: payload.overproductionConfirmed, clientActionId: operationId, actor })
    if (action === 'handoff') return createLaceHandover({ workOrderId, qty: payload.qty ?? NaN,
      deliveryNo: payload.deliveryNo || '', packageCount: payload.packageCount ?? NaN,
      expectedReceiverName: payload.expectedReceiverName || '', packageNote: payload.packageNote || '', clientActionId: operationId, actor })
    return completeLaceProduction(workOrderId, payload.note || '', actor)
  }, { workOrderId, expected: expectedRevision })
}
