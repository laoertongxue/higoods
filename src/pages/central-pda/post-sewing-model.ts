import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import {
  listPostFinishingFactoryReturns, listPostFinishingReturnRegistrationSources,
  registerPostFinishingFactoryReturn, resolvePostFinishingReturnRegistrationSource,
  discardPostFinishingFactoryReturn, canDiscardPostFinishingFactoryReturn,
  type PostFinishingActor, type PostFinishingFactoryReturnDelivery,
} from '../../data/fcs/post-finishing-full-flow.ts'
import { registerPostFinishingFile, releasePostFinishingPendingFile, runPostFinishingCommand } from '../../data/fcs/post-finishing-records.ts'

function sewingActor(user: FactoryPdaUser): PostFinishingActor {
  const actual = readFactoryPdaExecutionUsers(user.factoryId).find(row => row.userId === user.userId)
  if (!actual || actual.status !== 'ACTIVE' || actual.name !== user.name || actual.factoryId !== user.factoryId) throw new Error('实际操作账号与本厂不一致，请重新登录。')
  return { actorId: actual.userId, actorName: actual.name, roleName: '车缝厂送货人员' }
}
function usedReturn(productionOrderNo: string, returnIndex: number) {
  return listPostFinishingFactoryReturns().some(row => row.productionOrderNo === productionOrderNo && row.returnIndex === returnIndex)
}
export function centralSewingSources(factoryId: string) {
  return listPostFinishingReturnRegistrationSources().filter(source => {
    try {
      if (usedReturn(source.productionOrderNo, source.returnIndex)) return false
      const order = resolvePostFinishingReturnRegistrationSource(source.scanValue).productionOrder
      return order.managedPostFactoryId === factoryId && centralSewingRemaining(order).some(sku => sku.remaining > 0)
    } catch { return false }
  })
}
export function centralSewingSource(scanValue: string, factoryId: string) {
  const resolved = resolvePostFinishingReturnRegistrationSource(scanValue)
  if (resolved.productionOrder.managedPostFactoryId !== factoryId) throw new Error('该回货来源不属于当前后道工厂。')
  if (usedReturn(resolved.productionOrder.productionOrderNo, resolved.returnIndex)) throw new Error(`第 ${resolved.returnIndex} 次回货已登记或已废弃，请扫描新的回货序号。`)
  return resolved
}
export function centralSewingRemaining(order: ReturnType<typeof centralSewingSource>['productionOrder']) {
  const registered = new Map<string, number>()
  for (const delivery of listPostFinishingFactoryReturns()) {
    if (delivery.executionTaskId !== order.executionTaskId || delivery.status === '已废弃') continue
    for (const line of delivery.lines) registered.set(line.sku.skuId, (registered.get(line.sku.skuId) || 0) + line.registeredQty)
  }
  return order.skus.map(sku => ({ ...sku, remaining: Math.max(0, sku.plannedQty - (registered.get(sku.skuId) || 0)) }))
}
export function centralSewingRecent(factoryId: string, userId: string): PostFinishingFactoryReturnDelivery[] {
  return listPostFinishingFactoryReturns().filter(row => row.managedPostFactoryId === factoryId && row.registeredBy.actorId === userId).slice(-3).reverse()
}
export function centralSewingCanDiscard(record: PostFinishingFactoryReturnDelivery, user: FactoryPdaUser) { return user.roleId === 'ROLE_ADMIN' && canDiscardPostFinishingFactoryReturn(record) }
export async function discardCentralSewingReturn(record: PostFinishingFactoryReturnDelivery, reason: string, user: FactoryPdaUser) {
  if (user.roleId !== 'ROLE_ADMIN') throw new Error('废弃登记需后道主管办理。')
  if (!reason.trim()) throw new Error('填写废弃原因。')
  const actual = readFactoryPdaExecutionUsers(user.factoryId).find(row => row.userId === user.userId)
  if (!actual || actual.status !== 'ACTIVE') throw new Error('实际操作账号无效。')
  return runPostFinishingCommand(() => discardPostFinishingFactoryReturn({ deliveryId: record.deliveryId, reason: reason.trim(), actor: { actorId: actual.userId, actorName: actual.name, roleName: '后道回货主管' } }))
}
export function centralSewingPhoto(file: File) { return registerPostFinishingFile(file) }
export function releaseCentralSewingPhoto(url: string | undefined) { if (url) releasePostFinishingPendingFile(url) }
export interface CentralSewingCommand {
  scanValue: string
  quantities: Array<{ skuId: string; registeredQty: number }>
  person: string
  phone: string
  evidenceUrl: string
  operationId: string
}
export async function saveCentralSewingReturn(command: CentralSewingCommand, user: FactoryPdaUser) {
  const actor = sewingActor(user), source = centralSewingSource(command.scanValue, user.factoryId)
  if (!source.productionOrder) throw new Error('回货来源不存在。')
  if (!command.person.trim()) throw new Error('填写本次实际送货人姓名。')
  if (!command.evidenceUrl) throw new Error('拍摄或选择至少 1 张现场凭证。')
  if (!command.quantities.some(line => line.registeredQty > 0)) throw new Error('本次至少登记 1 件。')
  return runPostFinishingCommand(() => registerPostFinishingFactoryReturn({
    productionOrderNo: source.productionOrder.productionOrderNo,
    executionTaskId: source.productionOrder.executionTaskId,
    returnIndex: source.returnIndex,
    triggerSource: '公共PDA自助回货',
    idempotencyKey: command.operationId,
    quantities: command.quantities,
    deliveryPersonName: command.person.trim(), deliveryPersonPhone: command.phone.trim(),
    evidenceImageUrls: [command.evidenceUrl], actor,
  }))
}
