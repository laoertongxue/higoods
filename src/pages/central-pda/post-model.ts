import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import {
  listPostFinishingFactoryReturns, listPostFinishingFullFlowQcTasks, listPostFinishingFullFlowOutboundOrders,
  listPostFinishingWaitProcessWarehouseRecords, listPostFinishingWaitProcessWarehouseMovements,
  listPostFinishingWaitHandoverWarehouseMovements, type PostFinishingFactoryReturnDelivery,
} from '../../data/fcs/post-finishing-full-flow.ts'

export type CentralPostTab = 'receive' | 'execute' | 'warehouse'
export function centralPostFactory(factoryId: string) {
  const factory = getFactoryMasterRecordById(factoryId)
  return factory && factory.status === 'active' && isCentralPdaFactory(factory) ? factory : undefined
}
/** The page only reads the post factory's own return facts; registration belongs to the sewing factory. */
export function centralPostDeliveries(factoryId: string): PostFinishingFactoryReturnDelivery[] {
  return centralPostFactory(factoryId) ? listPostFinishingFactoryReturns().filter(row => row.managedPostFactoryId === factoryId) : []
}
export function centralPostDelivery(factoryId: string, id: string) {
  return centralPostDeliveries(factoryId).find(row => row.deliveryId === id || row.deliveryOrderNo === id)
}
export function centralPostReceipts(factoryId: string, deliveryId: string) {
  return listPostFinishingWaitProcessWarehouseRecords().filter(row => row.deliveryId === deliveryId)
}
export function centralPostQcTasks(factoryId: string) {
  const ids = new Set(centralPostDeliveries(factoryId).map(row => row.productionOrderNo))
  return listPostFinishingFullFlowQcTasks().filter(row => ids.has(row.productionOrderNo))
}
export function centralPostOutbound(factoryId: string) {
  const ids = new Set(centralPostDeliveries(factoryId).map(row => row.productionOrderNo))
  return listPostFinishingFullFlowOutboundOrders().filter(row => ids.has(row.productionOrderNo))
}
export function centralPostScan(raw: string, factoryId: string) {
  const key = raw.trim().toLowerCase()
  if (!key) return []
  const deliveries = centralPostDeliveries(factoryId)
  const byNo = deliveries.filter(row => [row.deliveryOrderNo, row.productionOrderNo, row.sewingTaskNo].some(value => value.toLowerCase() === key))
  if (byNo.length) return byNo
  const qc = centralPostQcTasks(factoryId).find(row => row.qcTaskNo.toLowerCase() === key)
  if (qc) return deliveries.filter(row => row.deliveryId === qc.deliveryId)
  const outbound = centralPostOutbound(factoryId).find(row => row.outboundOrderNo.toLowerCase() === key)
  return outbound ? deliveries.filter(row => row.deliveryId === outbound.deliveryId) : []
}
export function postTotal(lines: Array<{ registeredQty?: number; confirmedQty?: number; firstCountQty?: number; secondCountQty?: number }>, field: 'registeredQty' | 'confirmedQty' | 'firstCountQty' | 'secondCountQty') {
  return lines.reduce((sum, line) => sum + (line[field] ?? 0), 0)
}
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { runPostFinishingCommand } from '../../data/fcs/post-finishing-records.ts'
import { confirmPostFinishingFactoryReturn, type PostFinishingActor } from '../../data/fcs/post-finishing-full-flow.ts'
/** The post-finishing confirmation is a supervisor action; the PDA admin is the
 * current supervisor equivalent, while other roles remain read-only. */
export function centralPostConfirmer(user: FactoryPdaUser): PostFinishingActor {
  const actual = readFactoryPdaExecutionUsers(user.factoryId).find(row => row.userId === user.userId)
  if (!actual || actual.status !== 'ACTIVE' || actual.name !== user.name || actual.factoryId !== user.factoryId || actual.roleId !== 'ROLE_ADMIN') {
    throw new Error('当前账号没有后道回货确认岗位。')
  }
  return { actorId: actual.userId, actorName: actual.name, roleName: '后道回货确认人员' }
}
export async function saveCentralPostReceipt(deliveryId: string, firstCounts: Array<{ skuId: string; actualQty: number }>, secondCounts: Array<{ skuId: string; actualQty: number }> | undefined, user: FactoryPdaUser, authorization?: { scanValue: string; differenceReason: string }) {
  const actor = centralPostConfirmer(user)
  return runPostFinishingCommand(() => confirmPostFinishingFactoryReturn({ deliveryId, firstCounts, secondCounts, authorization, actor }))
}
export function centralPostCanConfirm(user: FactoryPdaUser | undefined) {
  if (!user) return false
  try { centralPostConfirmer(user); return true } catch { return false }
}
import { claimPostFinishingQcTask, sendPostFinishingFactoryReturnToQc } from '../../data/fcs/post-finishing-full-flow.ts'
function actualPostUser(user: FactoryPdaUser, roleName: string): PostFinishingActor {
  const actual = readFactoryPdaExecutionUsers(user.factoryId).find(row => row.userId === user.userId)
  if (!actual || actual.status !== 'ACTIVE' || actual.name !== user.name || actual.factoryId !== user.factoryId) throw new Error('实际操作账号与本厂不一致，请重新登录。')
  return { actorId: actual.userId, actorName: actual.name, roleName }
}
/** Warehouse send-to-QC uses the actual account; QC claim maps operator to the
 * execution role and admin to the supervisor role. */
export function centralPostWarehouseActor(user: FactoryPdaUser) { return actualPostUser(user, '后道仓管') }
export function centralPostQcActor(user: FactoryPdaUser) { return actualPostUser(user, user.roleId === 'ROLE_ADMIN' ? 'QC主管' : '质检员') }
export async function sendCentralPostToQc(deliveryId: string, user: FactoryPdaUser) {
  const actor = centralPostWarehouseActor(user)
  return runPostFinishingCommand(() => sendPostFinishingFactoryReturnToQc({ deliveryId, actor }))
}
export async function claimCentralPostQc(qcTaskNo: string, user: FactoryPdaUser) {
  const actor = centralPostQcActor(user)
  return runPostFinishingCommand(() => claimPostFinishingQcTask({ qcTaskNo, actor }))
}
import { completePostFinishingQcTask, listPostFinishingFullFlowPostTasks, listPostFinishingQcReworkFactoryOptions } from '../../data/fcs/post-finishing-full-flow.ts'
export function centralPostTasks(factoryId: string) {
  const ids = new Set(centralPostDeliveries(factoryId).map(row => row.deliveryId))
  return listPostFinishingFullFlowPostTasks().filter(row => ids.has(row.deliveryId))
}
export interface CentralQcResultInput {
  skuId: string
  passedQty: number
  defectQty: number
  returnQty: number
  defectReason?: string
  defectImageUrl?: string
  returnReason?: string
  returnReceiver?: string
}
export function centralPostReworkOptions() { return listPostFinishingQcReworkFactoryOptions() }
/** QC completion keeps the original per-SKU results and difference authorization rules. */
export async function completeCentralPostQc(qcTaskId: string, results: CentralQcResultInput[], processItems: string[], user: FactoryPdaUser, authorization?: { scanValue: string; differenceReason: string }) {
  const actor = centralPostQcActor(user), task = listPostFinishingFullFlowQcTasks().find(row => row.qcTaskId === qcTaskId)
  if (!task) throw new Error('质检任务不存在。')
  if (task.status === '质检完成') return task
  return runPostFinishingCommand(() => completePostFinishingQcTask({ qcTaskId, actor, results, processItems, authorization }))
}
import { POST_FINISHING_QC_DEFECT_REASON_OPTIONS } from '../../data/fcs/post-finishing-full-flow.ts'
export function centralPostDefectReasons() { return POST_FINISHING_QC_DEFECT_REASON_OPTIONS }
import {
  appendPostFinishingProcessCompletion, receivePostFinishingOutboundOrder,
  getPostFinishingProcessProgress, listPostFinishingFullFlowRecheckOrders, listPostFinishingWaitHandoverWarehouseRecords,
} from '../../data/fcs/post-finishing-full-flow.ts'
function processActor(user: FactoryPdaUser): PostFinishingActor { return actualPostUser(user, user.roleId === 'ROLE_ADMIN' ? '后道主管' : '后道操作员') }
function warehouseReceiver(user: FactoryPdaUser): PostFinishingActor { return actualPostUser(user, '仓库收货人员') }
export function centralPostProcessProgress(postTaskId: string) { return getPostFinishingProcessProgress(postTaskId) }
export function centralPostRechecks(factoryId: string) {
  const { ids } = centralPostDeliveryIds(factoryId)
  return listPostFinishingFullFlowRecheckOrders().filter(row => ids.has(row.productionOrderNo))
}
export function centralPostWaitHandovers(factoryId: string) {
  const { ids } = centralPostDeliveryIds(factoryId)
  return listPostFinishingWaitHandoverWarehouseRecords().filter(row => ids.has(row.productionOrderNo))
}
export function centralPostWaitProcess(factoryId: string) {
  const { deliveryIds } = centralPostDeliveryIds(factoryId)
  return listPostFinishingWaitProcessWarehouseRecords().filter(row => deliveryIds.has(row.deliveryId))
}
export function centralPostWaitProcessMovements(factoryId: string) {
  const ids = new Set(centralPostWaitProcess(factoryId).map(row => row.warehouseRecordId))
  return listPostFinishingWaitProcessWarehouseMovements().filter(row => ids.has(row.warehouseRecordId)).slice(-8).reverse()
}
export function centralPostWaitHandoverMovements(factoryId: string) {
  const ids = new Set(centralPostWaitHandovers(factoryId).map(row => row.warehouseRecordId))
  return listPostFinishingWaitHandoverWarehouseMovements().filter(row => ids.has(row.warehouseRecordId)).slice(-8).reverse()
}
function centralPostDeliveryIds(factoryId: string) {
  const deliveries = centralPostDeliveries(factoryId)
  return { ids: new Set(deliveries.map(row => row.productionOrderNo)), deliveryIds: new Set(deliveries.map(row => row.deliveryId)) }
}
export async function registerCentralPostProcess(postTaskId: string, processItem: string, user: FactoryPdaUser, requested?: Array<{ skuId: string; quantity: number }>, unprocessedReason?: string) {
  const actor = processActor(user), progress = getPostFinishingProcessProgress(postTaskId)
  const process = progress.processes.find(row => row.processItem === processItem && row.applicable)
  if (!process) throw new Error('当前后道项目不在质检确认范围内。')
  const quantities = requested?.length
    ? requested.filter(line => line.quantity > 0)
    : process.lines.filter(line => line.availableQty > 0).map(line => ({ skuId: line.sku.skuId, quantity: line.availableQty }))
  if (!quantities.length) throw new Error('当前后道项目没有可登记数量。')
  for (const line of quantities) {
    const available = process.lines.find(row => row.sku.skuId === line.skuId)?.availableQty
    if (available === undefined) throw new Error('SKU 不属于当前后道项目。')
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 0) throw new Error('数量必须是大于等于 0 的整数。')
    if (line.quantity > available) throw new Error(`本 SKU 当前最多可登记 ${available} 件。`)
  }
  return runPostFinishingCommand(() => appendPostFinishingProcessCompletion({ postTaskId, processItem: processItem as never, quantities, responsible: actor, actor, operationId: crypto.randomUUID(), unprocessedReason }))
}
export async function receiveCentralPostOutbound(outboundOrderNo: string, user: FactoryPdaUser, requested?: Array<{ skuId: string; receivedQty: number }>, authorization?: { scanValue: string; differenceReason: string }) {
  const actor = warehouseReceiver(user)
  const order = listPostFinishingFullFlowOutboundOrders().find(row => row.outboundOrderNo === outboundOrderNo)
  if (!order) throw new Error('出库单不存在。')
  const receivedQuantities = order.lines.map(line => {
    const submitted = requested?.find(row => row.skuId === line.sku.skuId)?.receivedQty
    if (submitted !== undefined && (!Number.isSafeInteger(submitted) || submitted < 0)) throw new Error('实收数量必须是大于等于 0 的整数。')
    return { skuId: line.sku.skuId, receivedQty: submitted ?? line.outboundQty }
  })
  return runPostFinishingCommand(() => receivePostFinishingOutboundOrder({ outboundOrderNo, targetWarehouseId: order.targetWarehouseId || 'WH-AC', actor, receivedQuantities, authorization }))
}
