import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { listWaterSolubleWorkOrders, getWaterSolubleReceivedMaterialQty, executeCentralWaterSolubleAction,
  assertCentralWaterSolubleActor, waterSolubleReworkBlockReason, type CentralWaterSolubleActionInput } from '../../data/fcs/water-soluble-task-domain.ts'
import { runWaterSolubleRecordCommand } from '../../data/fcs/water-soluble-records.ts'
import { eligibleReceivingSource, listFactoryReceivingSources, listFactoryReceipts, convertReceiptQuantity,
  prepareFactoryReceipt, getFactoryReceiptLocations, getProcessOrderReceivingFacts,
  listFactoryMaterialUses, getHistoricalReceiptPosition, type FactoryReceiptInput } from '../../data/fcs/factory-receiving.ts'
import { getWaterSolubleOrderImageManifest } from '../../data/fcs/process-order-image-manifest.ts'
import { resolveTerminalProcessOrderReceivingTarget } from '../../data/fcs/process-order-receiving-target.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'

const actorFact = (actor: FactoryPdaUser) => ({ userId: actor.userId, name: actor.name, factoryId: actor.factoryId })
export function listCentralWaterFacts(factoryId?: string) {
  return withWashingStaticRead(() => listWaterSolubleWorkOrders().flatMap(order => {
    const factory = order.factoryId && getFactoryMasterRecordById(order.factoryId)
    if (!factory || !isCentralPdaFactory(factory) || (factoryId !== undefined && order.factoryId !== factoryId)) return []
    const received = getWaterSolubleReceivedMaterialQty(order.waterOrderId),input = order.inputQty || 0
    const image = getWaterSolubleOrderImageManifest(order.handoverDemoSourceOrderId || order.waterOrderId)
    const availableInput = Math.max(0, received - input),availableOutput = Math.max(0, order.completedQty - (order.handoverQty || 0))
    return [{ order, received, input, availableInput, availableOutput, image,
      canStart: ['WAIT_WATER_SOLUBLE', 'WATER_SOLUBLE_IN_PROGRESS', 'WAIT_HANDOVER'].includes(order.status)
        && (availableInput > 0 || (order.status === 'WAIT_WATER_SOLUBLE' && !!order.supervisorDecision && input > 0)),
      canComplete: order.status === 'WATER_SOLUBLE_IN_PROGRESS', canResolve: order.status === 'PRODUCTION_PAUSED',
      reworkBlocked: waterSolubleReworkBlockReason(order), canFinish: order.status === 'WAIT_MANUAL_COMPLETION', canReceive: order.status !== 'DONE' }]
  }))
}
export function centralWaterFactories() {
  const ids = new Set(listCentralWaterFacts().map(fact => fact.order.factoryId))
  return listFactoryMasterRecords().filter(factory => factory.status === 'active' && ids.has(factory.id))
}
export function centralWaterFact(orderId: string, factoryId: string) {
  return listCentralWaterFacts(factoryId).find(fact => fact.order.waterOrderId === orderId)
}
export function centralWaterDownstream(orderId: string, factoryId: string) {
  const fact = centralWaterFact(orderId, factoryId)
  return fact && resolveTerminalProcessOrderReceivingTarget({ sourceType: 'PRODUCTION_ORDER', productionOrderNo: fact.order.productionOrderNo })
}
export const centralWaterPositions = getFactoryReceiptLocations
export function centralWaterIncoming(factoryId: string, orderId?: string) {
  const ids = new Set(listCentralWaterFacts(factoryId).filter(fact => fact.canReceive && (!orderId || fact.order.waterOrderId === orderId)).map(fact => fact.order.waterOrderId))
  return withWashingStaticRead(() => {
    const receipts = listFactoryReceipts(factoryId).flatMap(receipt => receipt.lines)
    return listFactoryReceivingSources(factoryId).filter(eligibleReceivingSource).flatMap(source => source.lines.flatMap(line => {
      if (!line.waterOrderId || !ids.has(line.waterOrderId)) return []
      const rows = receipts.filter(row => row.sourceId === source.id && row.sourceLineId === line.id)
      const received = rows.reduce((sum, row) => sum + (convertReceiptQuantity(row.qty, row.unit, line.unit)
        ?? (row.businessUnit === line.unit ? row.businessQty || 0 : 0)), 0)
      return [{ key: source.id + '|' + line.id, orderId: line.waterOrderId, source, line, received,
        remaining: Math.max(0, line.sentQty - received) }]
    }))
  })
}
export function centralWaterRevision(orderId: string, factoryId: string) {
  const fact = centralWaterFact(orderId, factoryId),order = fact?.order
  return JSON.stringify(order && [order.taskId, order.status, fact.received, order.inputQty, order.completedQty,
    order.handoverQty, order.receivedQty, order.supervisorDecision, order.actionLogs.length,
    order.materialReceipts?.map(row => [row.receiptId, row.qty]), order.handoverBatches])
}
export async function saveCentralWaterReceipt(orderId: string, input: FactoryReceiptInput, actor: FactoryPdaUser) {
  // Receiving confirmation is only needed for a save; load it before opening
  // the original atomic command, rather than during entry or inside its recipe.
  const { confirmFactoryMaterialReceipt } = await import('../../data/fcs/factory-receiving-links.ts')
  return runWaterSolubleRecordCommand(orderId, () => {
    assertCentralWaterSolubleActor(orderId, actorFact(actor))
    const fact = centralWaterFact(orderId, actor.factoryId)
    if (!fact?.canReceive || input.factoryId !== actor.factoryId || input.operatorId !== actor.userId || input.operatorName !== actor.name) throw new Error('WATER_wrongActor')
    const prepared = prepareFactoryReceipt(input)
    if (prepared.lines.some(line => line.waterOrderId !== orderId)) throw new Error('WATER_wrongSource')
    return confirmFactoryMaterialReceipt(input, actor)
  }, input.id, JSON.stringify({ orderId, input }))
}
export type CentralWaterAction = { action: 'START' | 'FINISH_DOCUMENT' }
  | { action: 'COMPLETE'; completedQty: number; reason: string }
  | { action: 'RESOLVE_PAUSE'; decision: 'CONTINUE_PROCESSING' | 'CONTINUE_WITH_ACTUAL_QTY' | 'RETURN_FOR_REWORK' }
export async function saveCentralWaterAction(orderId: string, input: CentralWaterAction, actor: FactoryPdaUser,
  operationId: string, expectedRevision: string) {
  return runWaterSolubleRecordCommand(orderId, () => {
    assertCentralWaterSolubleActor(orderId, actorFact(actor))
    const fact = centralWaterFact(orderId, actor.factoryId)
    if (!fact || centralWaterRevision(orderId, actor.factoryId) !== expectedRevision) throw new Error('CHANGED')
    return executeCentralWaterSolubleAction({ ...input, orderId, taskId: fact.order.taskId,
      expectedStatus: fact.order.status, actor: actorFact(actor) } as CentralWaterSolubleActionInput)
  }, operationId, JSON.stringify({ orderId, input, actor: actor.userId, expectedRevision }))
}
export function centralWaterInputStock(factoryId: string) {
  return withWashingStaticRead(() => listCentralWaterFacts(factoryId).flatMap(fact => {
    const facts = getProcessOrderReceivingFacts(fact.order.waterOrderId, 'water', factoryId),uses = listFactoryMaterialUses(fact.order.waterOrderId)
    return facts.receipts.flatMap(receipt => receipt.lines.map(line => {
      const used = uses.reduce((sum, use) => sum + use.lines.filter(row => row.receiptLineId === line.id)
        .reduce((n, row) => n + (convertReceiptQuantity(row.qty, row.unit, line.unit) || 0), 0), 0)
      const allocated = line.waterOrderId === fact.order.waterOrderId ? line.qty : facts.allocations.filter(row => row.receiptLineId === line.id).reduce((sum, row) => sum + row.qty, 0)
      return { order: fact.order, receipt, line, position: getHistoricalReceiptPosition(factoryId, line), qty: Math.max(0, allocated - used) }
    }))
  }))
}
