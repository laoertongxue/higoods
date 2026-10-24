import {
  listPrintingWorkOrders, getPrintingWorkOrderById, getPrintWorkOrderById, getPrintingWorkflowFacts, getPrintingProductionQuantities,
  centralPrintingProductionRevision, assertCentralPrintingActor, executeCentralPrintingProduction,
  type CentralPrintingProductionInput
} from '../../data/fcs/printing-task-domain.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import {
  eligibleReceivingSource, listFactoryReceivingSources, listFactoryReceipts, getFactoryReceiptLocations,
  prepareFactoryReceipt, listFactoryMaterialUses, type FactoryReceiptInput
} from '../../data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../data/fcs/factory-receiving-links.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import { runPrintingRecordCommand } from '../../data/fcs/printing-records.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { readCentralPrintWarehouse } from './print-warehouse-model.ts'

export function listCentralPrintFacts(factoryId?: string) {
  return withFactoryProcessStaticRead(() => listPrintingWorkOrders().flatMap(order => {
    const factory = getFactoryMasterRecordById(order.printFactoryId)
    if (!factory || !isCentralPdaFactory(factory) || (factoryId !== undefined && factory.id !== factoryId)) return []
    const workflow = getPrintingWorkflowFacts(order.workOrderId), stages = getPrintingProductionQuantities(order.workOrderId)
    return [{ order, workflow, stages, raw: getPrintWorkOrderById(order.workOrderId)!, closed: !!order.manuallyCompletedAt || order.processingStatus === 'CANCELLED' }]
  }))
}
export type CentralPrintFact = ReturnType<typeof listCentralPrintFacts>[number]
export function centralPrintFact(id: string, factoryId: string): CentralPrintFact | undefined {
  if (!id) return undefined
  return withFactoryProcessStaticRead(() => {
    const order = getPrintingWorkOrderById(id)
    if (!order || order.printFactoryId !== factoryId) return undefined
    const factory = getFactoryMasterRecordById(order.printFactoryId)
    if (!factory || !isCentralPdaFactory(factory)) return undefined
    return { order, workflow: getPrintingWorkflowFacts(id), stages: getPrintingProductionQuantities(id),
      raw: getPrintWorkOrderById(id)!, closed: !!order.manuallyCompletedAt || order.processingStatus === 'CANCELLED' }
  })
}
export function centralPrintFactories() { const ids = new Set(listCentralPrintFacts().map(f => f.order.printFactoryId)); return listFactoryMasterRecords().filter(f => f.status === 'active' && ids.has(f.id)) }
export function centralPrintEntryFactory(candidates: Array<string | undefined | null>) {
  return candidates.find(id => {
    const factory = id && getFactoryMasterRecordById(id)
    return factory && factory.status === 'active' && isCentralPdaFactory(factory)
  }) || ''
}
export const centralPrintPositions = getFactoryReceiptLocations
export const centralPrintRevision = (id: string) => withFactoryProcessStaticRead(() => centralPrintingProductionRevision(id))
export const centralPrintWarehouse = readCentralPrintWarehouse
export function centralPrintIncoming(factoryId: string, id?: string) {
  return withFactoryProcessStaticRead(() => {
    const selected = id ? centralPrintFact(id, factoryId) : undefined
    const facts = id ? selected ? [selected] : [] : listCentralPrintFacts(factoryId)
    const ids = new Set(facts.filter(f => !f.closed).map(f => f.order.workOrderId)), receipts = listFactoryReceipts(factoryId).flatMap(r => r.lines)
    return listFactoryReceivingSources(factoryId).filter(eligibleReceivingSource).flatMap(source => source.lines.flatMap(line => {
      if (!line.printingOrderId || !ids.has(line.printingOrderId)) return []
      const received = receipts.filter(r => r.sourceId === source.id && r.sourceLineId === line.id), codes = new Set(received.flatMap(r => r.rolls?.map(roll => roll.barcode) || []))
      return [{ key: source.id + '|' + line.id, orderId: line.printingOrderId, source, line, remainingRolls: line.rolls.filter(roll => !codes.has(roll.barcode)), received }]
    }))
  })
}
export async function saveCentralPrintReceipt(id: string, input: FactoryReceiptInput, actor: FactoryPdaUser) {
  return runPrintingRecordCommand(id, () => {
    assertCentralPrintingActor(id, actor)
    const fact = centralPrintFact(id, actor.factoryId)
    if (!fact || fact.closed || input.factoryId !== actor.factoryId || input.operatorId !== actor.userId || input.operatorName !== actor.name) throw new Error('PRINT_wrongActor')
    const prepared = prepareFactoryReceipt(input)
    if (prepared.lines.some(line => line.printingOrderId !== id)) throw new Error('PRINT_wrongSource')
    // Original Web confirmation also owns upstream actual receipt and person.
    // Keep it inside this same original-owner transaction.
    confirmFactoryMaterialReceipt(input, actor)
  }, input.id, JSON.stringify({ id, input }))
}
export async function saveCentralPrintProduction(id: string, input: CentralPrintingProductionInput, actor: FactoryPdaUser, operationId: string, revision: string) { return runPrintingRecordCommand(id, () => executeCentralPrintingProduction(id, input, actor, operationId, revision), operationId, JSON.stringify({ id, input, actor: actor.userId, revision })) }
export type CentralPrintChoice = { key: string; kind: 'INPUT' | 'STAGE' | 'OUTPUT'; stage?: 'ARTWORK' | 'SAMPLE' | 'PRINT' | 'TRANSFER'; action?: 'START' | 'FINISH'; max?: number; unit?: string }
export const centralPrintInputReady=(fact:Pick<CentralPrintFact,'raw'>)=>fact.raw.sourceType!=='DESIGN_REVISION'||fact.raw.acceptanceStatus==='ACCEPTED'
export function centralPrintChoices(fact: CentralPrintFact): CentralPrintChoice[] {
  const { order: o, workflow: w, stages } = fact
  if (fact.closed || o.historicalInputQuantityUnknown || w.completedAt) return []
  if (!w.artworkConfirmed) return [{ key: 'artwork', kind: 'STAGE', stage: 'ARTWORK', action: 'FINISH' }]
  if (!w.sampleConfirmed) return [{ key: 'sample', kind: 'STAGE', stage: 'SAMPLE', action: 'FINISH' }]
  const choices: CentralPrintChoice[] = []
  if (w.availableInputQty > 0&&centralPrintInputReady(fact)) choices.push({ key: 'input', kind: 'INPUT', max: w.availableInputQty, unit: o.plannedInput.qtyUnit })
  if (!w.startedAt || o.actualInput.usedQty <= (o.requirementVersionStartUsedQty || 0)) return choices
  const printLeft = Math.max(0, o.actualInput.usedQty - (o.requirementVersionStartUsedQty || 0) - stages.print)
  if (!w.printStartedAt) choices.push({ key: 'print-start', kind: 'STAGE', stage: 'PRINT', action: 'START' })
  else if (printLeft > 0) choices.push({ key: 'print-finish', kind: 'STAGE', stage: 'PRINT', action: 'FINISH', max: printLeft, unit: o.output.qtyUnit })
  if (w.requiresTransfer && stages.print > 0) { if (!w.transferStartedAt) choices.push({ key: 'transfer-start', kind: 'STAGE', stage: 'TRANSFER', action: 'START' }); else if (stages.print > stages.transfer) choices.push({ key: 'transfer-finish', kind: 'STAGE', stage: 'TRANSFER', action: 'FINISH', max: stages.print - stages.transfer, unit: o.output.qtyUnit }) }
  const outputLeft = Math.max(0, (w.requiresTransfer ? stages.transfer : stages.print) + (o.requirementVersionStartOutputQty || 0) - o.output.completedQty)
  if (outputLeft > 0) choices.push({ key: 'output', kind: 'OUTPUT', max: outputLeft, unit: o.output.qtyUnit })
  return choices
}
/** Counts of physical input packages come from actual usage when recorded, otherwise retain the existing recorded count. */
export function centralPrintUsedPackageCount(fact: CentralPrintFact) {
return withFactoryProcessStaticRead(() => {
    const barcodes = new Set(listFactoryMaterialUses(fact.order.workOrderId).flatMap(use => use.lines.map(line => line.barcode).filter(Boolean)))
    return Math.max(fact.order.actualInput.usedRollCount, barcodes.size)
  })
}
