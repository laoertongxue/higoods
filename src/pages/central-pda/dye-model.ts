import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { getDyeingQuantityFacts, type DyeQuantityFact } from '../../data/fcs/dyeing-quantity-facts.ts'
import { getDyeWorkOrderById, executeDyePdaProcessing, listDyeVatOptions, getDyeDispatchPartner } from '../../data/fcs/dyeing-task-domain.ts'
import { eligibleReceivingSource, listFactoryReceivingSources, listFactoryReceipts, getFactoryReceiptLocations,
  prepareFactoryReceipt, type FactoryReceiptInput,
  type FactoryReceivingSource, type FactoryReceivingSourceLine } from '../../data/fcs/factory-receiving.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import { confirmFactoryMaterialReceipt } from '../../data/fcs/factory-receiving-links.ts'
import { runDyeingRecordCommand } from '../../data/fcs/dyeing-records.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'

export interface CentralDyeIncoming {
  key: string
  orderId: string
  source: FactoryReceivingSource
  line: FactoryReceivingSourceLine
  remainingRolls: FactoryReceivingSourceLine['rolls']
  receivedQty: number
  receivedUnit?: string
}

/** Fixed demonstrations remain read-only; action commands own all persisted deltas. */
export function listCentralDyeFacts(factoryId?: string): DyeQuantityFact[] {
  return withFactoryProcessStaticRead(() => getDyeingQuantityFacts().filter(fact => {
    const factory = getFactoryMasterRecordById(fact.order.dyeFactoryId)
    return !!factory && isCentralPdaFactory(factory) && (!factoryId || factory.id === factoryId)
  }))
}

export function listCentralDyeFactories() {
  const ids = new Set(listCentralDyeFacts().map(fact => fact.order.dyeFactoryId))
  return listFactoryMasterRecords().filter(factory => isCentralPdaFactory(factory) && factory.status === 'active' && ids.has(factory.id))
}

export function getCentralDyeFact(orderId: string, factoryId: string) {
  return listCentralDyeFacts(factoryId).find(fact => fact.order.dyeOrderId === orderId)
}

export function listCentralDyeIncoming(factoryId: string, orderId?: string): CentralDyeIncoming[] {
  const facts = listCentralDyeFacts(factoryId)
  const ids = new Set(facts.filter(fact => !orderId || fact.order.dyeOrderId === orderId).map(fact => fact.order.dyeOrderId))
  return withFactoryProcessStaticRead(() => {
    const receipts = listFactoryReceipts(factoryId).flatMap(receipt => receipt.lines)
    return listFactoryReceivingSources(factoryId).filter(eligibleReceivingSource).flatMap(source => source.lines
      .filter(line => !!line.dyeOrderId && ids.has(line.dyeOrderId))
      .map(line => {
        const received = receipts.filter(receipt => receipt.sourceId === source.id && receipt.sourceLineId === line.id)
        const usedBarcodes = new Set(received.flatMap(receipt => receipt.rolls?.map(roll => roll.barcode) || []))
        return {
          key: `${source.id}|${line.id}`, orderId: line.dyeOrderId!, source, line,
          remainingRolls: line.rolls.filter(roll => !usedBarcodes.has(roll.barcode)),
          receivedQty: received.reduce((sum, receipt) => sum + receipt.qty, 0), receivedUnit: received[0]?.unit,
        }
      }))
  })
}

export const centralDyeReceiptLocations = getFactoryReceiptLocations
export const centralDyeVatOptions = listDyeVatOptions
export const centralDyeDownstream = (id: string) => withFactoryProcessStaticRead(() => getDyeDispatchPartner(id))
/** Resolve the actual receiver from its saved receipt, never from a role or a
 * record number. Older non-factory receipts retain their recorded person. */
export function centralDyeReceiver(record: { handoverRecordId?: string; recordId: string; receiverWrittenBy?: string; receiverWrittenAt?: string }) {
  return withFactoryProcessStaticRead(() => {
    const id = record.handoverRecordId || record.recordId
    const sources = new Set(listFactoryReceivingSources(undefined, true).filter(source => source.originalRecordId === id).map(source => source.id))
    const receipt = listFactoryReceipts().slice().reverse().find(receipt => receipt.operatorName === record.receiverWrittenBy
      && receipt.receivedAt === record.receiverWrittenAt && receipt.lines.some(line => sources.has(line.sourceId)))
    return { name: record.receiverWrittenBy, id: receipt?.operatorId || record.receiverWrittenBy || '—' }
  })
}

export type CentralDyeProcessing = Omit<Parameters<typeof executeDyePdaProcessing>[0], 'actor'>
export function centralDyeProcessingChoice(orderId: string, factoryId: string) {
  const fact = getCentralDyeFact(orderId, factoryId)
  if (!fact || ['COMPLETED', 'REJECTED', 'CANCELLED', 'PRODUCTION_PAUSED'].includes(fact.order.status)) return undefined
  const currentNodes = fact.order.completedExecutionBatches?.length ? fact.nodes.slice(fact.order.completedExecutionBatches.flat().length) : fact.nodes
  const dye = currentNodes.find(node => node.nodeCode === 'DYE'), pack = currentNodes.find(node => node.nodeCode === 'PACK')
  const water = currentNodes.find(node => node.nodeCode === 'WATER_SOLUBLE')
  const base = { dyeOrderId: orderId, expectedStatus: fact.order.status, expectedBatch: fact.order.completedExecutionBatches?.length || 0 }
  const availableInput = fact.order.requiresWaterSoluble ? Math.min(fact.availableInput, Math.max(0, (fact.order.waterSolubleCompletedQty ?? water?.outputQty ?? 0) - fact.used)) : fact.availableInput
  if ((!dye?.startedAt && fact.order.status === 'WAIT_VAT_PLAN' || pack?.finishedAt) && availableInput > 0
    && (!fact.order.requiresWaterSoluble || water?.finishedAt)) return { ...base, nodeCode: 'DYE' as const, phase: 'START' as const, max: availableInput }
  if (fact.order.status === 'DYEING' && dye?.startedAt && !dye.finishedAt) return { ...base, nodeCode: 'DYE' as const, phase: 'COMPLETE' as const, max: dye.inputQty || 0 }
  const stages = { DEHYDRATING: ['DEHYDRATE', 'DYE'], DRYING: ['DRY', 'DEHYDRATE'], SETTING: ['SET', 'DRY'], ROLLING: ['ROLL', 'SET'], PACKING: ['PACK', 'ROLL'] } as const
  const stage = stages[fact.order.status as keyof typeof stages]
  if (!stage) return undefined
  const node = currentNodes.find(node => node.nodeCode === stage[0]), previous = currentNodes.find(node => node.nodeCode === stage[1])
  if (!previous?.finishedAt || node?.finishedAt) return undefined
  return { ...base, nodeCode: stage[0], phase: node?.startedAt ? 'COMPLETE' as const : 'START' as const, max: previous.outputQty || 0 }
}
export function centralDyeProcessingRevision(orderId: string, factoryId: string) {
  const fact = getCentralDyeFact(orderId, factoryId)
  return JSON.stringify(fact && [fact.order.status, fact.order.completedExecutionBatches?.length || 0, fact.received, fact.used, fact.packed,
    fact.nodes.map(node => [node.nodeRecordId, node.startedAt, node.finishedAt, node.inputQty, node.outputQty])])
}

export function assertCentralDyeActor(orderId: string, actor: FactoryPdaUser) {
  const order = getDyeWorkOrderById(orderId), factory = order && getFactoryMasterRecordById(order.dyeFactoryId)
  if (!order || !factory || !isCentralPdaFactory(factory) || order.dyeFactoryId !== actor.factoryId || actor.status !== 'ACTIVE') throw new Error('接收账号、工厂与染色加工单不一致。')
  return order
}

export function prepareCentralDyeReceipt(orderId: string, input: FactoryReceiptInput, actor: FactoryPdaUser) {
  const order = assertCentralDyeActor(orderId, actor)
  if (input.factoryId !== actor.factoryId || input.operatorId !== actor.userId || input.operatorName !== actor.name) {
    throw new Error('接收账号、工厂与染色加工单不一致。')
  }
  if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(order.status)) throw new Error('当前染色加工单不能继续接收。')
  const receipt = prepareFactoryReceipt(input)
  if (receipt.lines.some(line => line.dyeOrderId !== orderId)) throw new Error('本次来货不属于当前染色加工单。')
  return receipt
}

/** Same-database command. Existing design-revision/washing owners retain their original writer. */
export async function saveCentralDyeReceipt(orderId: string, input: FactoryReceiptInput, actor: FactoryPdaUser) {
  return runCentralDyeCommand(orderId, input.id, JSON.stringify({ orderId, input }), () => {
    prepareCentralDyeReceipt(orderId, input, actor)
    confirmFactoryMaterialReceipt(input, actor)
  })
}

export async function saveCentralDyeProcessing(input: CentralDyeProcessing, actor: FactoryPdaUser, operationId: string, revision: string) {
  const intent = JSON.stringify({ input, actorId: actor.userId, revision })
  return runCentralDyeCommand(input.dyeOrderId, operationId, intent, () => {
    assertCentralDyeActor(input.dyeOrderId, actor)
    if (centralDyeProcessingRevision(input.dyeOrderId, actor.factoryId) !== revision) throw new Error('CHANGED')
    const allowed = centralDyeProcessingChoice(input.dyeOrderId, actor.factoryId)
    if (!allowed || allowed.phase !== input.phase || allowed.nodeCode !== input.nodeCode || allowed.expectedBatch !== input.expectedBatch) throw new Error('CHANGED')
    if ((input.phase === 'COMPLETE' || input.nodeCode === 'DYE') && (!Number.isFinite(input.qty) || input.qty! < 0 || input.qty! > allowed.max)) throw new Error('QUANTITY_MAX')
    return executeDyePdaProcessing({ ...input, actor: { userId: actor.userId, name: actor.name, factoryId: actor.factoryId } })
  })
}

export function runCentralDyeCommand<T>(target: unknown, operationId: string, intent: string, recipe: () => T) {
  return runDyeingRecordCommand(target, recipe, operationId, intent)
}
