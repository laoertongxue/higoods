import { listFactoryReceipts, listReceivingAllocations, getFactoryReceivingSource, listFactoryReceivingSources, eligibleReceivingSource, prepareFactoryReceipt, type FactoryReceiptInput, type ReceivingAllocation } from '../../data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt, allocateReceivedMaterialToOrder, listReceivingAllocationTargets, remainingReceivingAllocationQty } from '../../data/fcs/factory-receiving-links.ts'
import { runPrintingRecordCommand } from '../../data/fcs/printing-records.ts'
import { assertCentralPrintingActor } from '../../data/fcs/printing-task-domain.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { centralPrintEntryFactory, centralPrintFact } from './print-model.ts'

/** Original Web preparation: allocation transfers received stock, never receives it again. */
export function centralPrintPreparation(factoryId: string) {
  return withFactoryProcessStaticRead(() => {
    const allocations = listReceivingAllocations()
    return listFactoryReceipts(factoryId).flatMap(receipt => receipt.lines
      .filter(line => getFactoryReceivingSource(line.sourceId)?.processCode === 'PRINT' && line.qty > 0 && line.material.kind !== 'WOOL_PIECE'
        && !line.printingOrderId && !line.dyeOrderId && !line.waterOrderId && !line.woolOrderId)
      .map(line => ({ receipt, line, remaining: remainingReceivingAllocationQty(line.id),
        allocations: allocations.filter(allocation => allocation.receiptLineId === line.id),
        targets: listReceivingAllocationTargets(line.id).flatMap(target => {
          const fact = target.kind === 'printing' ? centralPrintFact(target.id, factoryId) : undefined
          return fact && !fact.closed ? [fact] : []
        }) })))
  })
}
export type PrintPreparation = ReturnType<typeof centralPrintPreparation>[number]
export const centralPrintAllocationSource = (row: PrintPreparation, orderId: string) =>
  JSON.stringify([row.receipt.id, row.receipt.factoryId, row.line, row.allocations, row.targets.find(fact => fact.order.workOrderId === orderId)])
export interface PrintAllocationRequest { input: ReceivingAllocation; actorId: string; expected: string }
export function centralPrintAllocationRequest(row: PrintPreparation, orderId: string, quantity: number,
  actor: FactoryPdaUser, id: string, at: string): PrintAllocationRequest {
  assertCentralPrintingActor(orderId, actor)
  if (row.receipt.factoryId !== actor.factoryId) throw Error('PRINT_wrongActor')
  if (!row.targets.some(fact => fact.order.workOrderId === orderId)) throw Error('PRINT_allocationTarget')
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > row.remaining + .000001) throw Error('PRINT_allocationQuantity')
  return { actorId: actor.userId, expected: centralPrintAllocationSource(row, orderId),
    input: { id, receiptLineId: row.line.id, printingOrderId: orderId, qty: quantity, operatorName: actor.name, at } }
}
export async function saveCentralPrintAllocation(request: PrintAllocationRequest, actor: FactoryPdaUser) {
  const id = request.input.printingOrderId || ''
  assertCentralPrintingActor(id, actor)
  if (request.actorId !== actor.userId || request.input.operatorName !== actor.name) throw Error('PRINT_wrongActor')
  return runPrintingRecordCommand(id, () => {
    assertCentralPrintingActor(id, actor)
    const row = centralPrintPreparation(actor.factoryId).find(row => row.line.id === request.input.receiptLineId)
    if (!row) throw Error('PRINT_sourceChanged')
    if (!row.allocations.some(allocation => allocation.id === request.input.id)) {
      if (centralPrintAllocationSource(row, id) !== request.expected) throw Error('PRINT_sourceChanged')
      centralPrintAllocationRequest(row, id, request.input.qty, actor, request.input.id, request.input.at)
    }
    allocateReceivedMaterialToOrder(request.input, actor)
  }, request.input.id, JSON.stringify(request))
}

export function centralPrintStockIncoming(factoryId: string) {
  if (centralPrintEntryFactory([factoryId]) !== factoryId) throw Error('PRINT_centralOnly')
  return withFactoryProcessStaticRead(() => {
    const receipts = listFactoryReceipts(factoryId).flatMap(receipt => receipt.lines)
    return listFactoryReceivingSources(factoryId).filter(source => source.processCode === 'PRINT' && eligibleReceivingSource(source))
      .flatMap(source => source.lines.filter(line => line.material.kind !== 'WOOL_PIECE' && !line.printingOrderId && !line.dyeOrderId && !line.waterOrderId && !line.woolOrderId && !line.woolCraftOrderId)
        .map(line => { const received = receipts.filter(receipt => receipt.sourceId === source.id && receipt.sourceLineId === line.id), codes = new Set(received.flatMap(receipt => receipt.rolls?.map(roll => roll.barcode) || []))
          return { key: source.id + '|' + line.id, orderId: '', source, line, received, remainingRolls: line.rolls.filter(roll => !codes.has(roll.barcode)) }
        }))
  })
}
export async function saveCentralPrintStockReceipt(input: FactoryReceiptInput, actor: FactoryPdaUser) {
  const { runPrintingPreparationRecordCommand } = await import('../../data/fcs/printing-joint-records.ts')
  const sources = [...new Set(input.lines.map(line => line.sourceId))]
  return runPrintingPreparationRecordCommand(sources, () => {
    const rows = centralPrintStockIncoming(actor.factoryId), prepared = prepareFactoryReceipt(input)
    if (!prepared.lines.length || prepared.lines.some(line => !rows.some(row => row.source.id === line.sourceId && row.line.id === line.sourceLineId))) throw Error('PRINT_wrongSource')
    confirmFactoryMaterialReceipt(input, actor)
  }, input.id, JSON.stringify({ input, actorId: actor.userId }))
}
