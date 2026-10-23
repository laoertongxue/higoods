import { listFactoryReceipts, listReceivingAllocations, type FactoryReceipt, type FactoryReceiptLine, type ReceivingAllocation } from '../../data/fcs/factory-receiving.ts'
import { allocateReceivedMaterialToOrder, listReceivingAllocationTargets, remainingReceivingAllocationQty } from '../../data/fcs/factory-receiving-links.ts'
import { issueWoolYarn, returnWoolYarn, type IssueWoolYarnInput, type ReturnWoolYarnInput } from '../../data/fcs/wool-domain/commands.ts'
import { readWoolStore, runWoolRecordCommand } from '../../data/fcs/wool-domain/store.ts'
import { getWoolHandoverEffectiveQty, getWoolYarnReceiptLineEffectiveQty, listWoolWarehouseStocksFromStore, listWoolFactoryWarehouseFlows, type WoolWarehouseStockRow } from '../../data/fcs/wool-domain/queries.ts'
import { normalizeWoolBatchNo } from '../../data/fcs/wool-domain/warehouse-ledger.ts'
import { resolveFactoryWarehouseLocation, listFactoryInternalWarehouses } from '../../data/fcs/factory-internal-warehouse-locations.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import type { WoolCommandReceiptValue, WoolWorkOrder } from '../../data/fcs/wool-domain/types.ts'
import { assertCentralWoolActor, centralWoolFacts, prepareCentralWool } from './wool-model.ts'
import { centralWoolHandoverReceiptActors } from './wool-handover-model.ts'

export function centralWoolWarehouseHandovers(facts: ReturnType<typeof centralWoolFacts>) {
  const actors = new Map(facts.orders.flatMap(order => [...centralWoolHandoverReceiptActors({ order }, facts.store)]))
  return facts.store.handovers.filter(record => facts.orders.some(order => order.woolOrderId === record.woolOrderId))
    .map(record => ({ record, quantity: getWoolHandoverEffectiveQty(facts.store, record), receiptActor: actors.get(record.handoverId) }))
}

export function centralWoolWarehouseReceipts(facts: ReturnType<typeof centralWoolFacts>, factoryId: string) {
  const orders = new Map(facts.orders.map(o => [o.woolOrderId, o])), receipts = listFactoryReceipts(factoryId)
  const yarn = facts.store.yarnReceipts.filter(r => r.factoryId === factoryId || orders.has(r.woolOrderId))
    .flatMap(r => r.lines.map(line => {
      const actual = receipts.find(receipt => receipt.id === r.factoryReceiptId), origin = actual?.lines.find(l => l.id === line.lineId)?.origin
      return { id: line.lineId, orderNo: orders.get(r.woolOrderId)?.woolOrderNo, code: line.yarnSkuCode,
        name: line.yarnName, batch: r.batchNo, quantity: getWoolYarnReceiptLineEffectiveQty(facts.store, r, line), unit: 'kg',
        at: r.receivedAt, actorName: r.receivedBy, actorId: actual?.operatorId,
        source: line.sourceDocumentNo || r.deliveryNo || r.receiptNo, origin, piece: undefined }
    }))
  const pieces = facts.store.pieceReceipts.filter(r => orders.has(r.woolOrderId)).map(r => {
    const order = orders.get(r.woolOrderId)!, piece = order.externalPieces.find(p => p.pieceKey === r.pieceKey)!
    const flow = facts.store.warehouseFlows.find(f => f.sourceRecordId === r.receiptId && f.businessType === 'PIECE_RECEIPT')
    const actual = receipts.find(receipt => receipt.id === flow?.factoryReceiptId), handover = facts.store.handovers.find(h => h.handoverId === r.sourceHandoverId)
    return { id: r.receiptId, orderNo: order.woolOrderNo, code: piece.skuCode, name: piece.pieceName,
      batch: undefined, quantity: r.qty, unit: '片', at: r.receivedAt, actorName: r.receivedBy, actorId: actual?.operatorId,
      piece, source: actual?.lines.find(l => l.woolPieceKey === piece.pieceKey)?.sourceDocumentNo || handover?.handoverId || r.sourceHandoverId,
      origin: actual?.lines.find(l => l.woolPieceKey === piece.pieceKey)?.origin }
  })
  return [...yarn, ...pieces].sort((a, b) => {
    const left = Date.parse(a.at.replace(' ', 'T')), right = Date.parse(b.at.replace(' ', 'T'))
    return (Number.isFinite(left) && Number.isFinite(right) ? right - left : b.at.localeCompare(a.at)) || a.id.localeCompare(b.id)
  })
}

export interface CentralWoolStock {
  stock: WoolWarehouseStockRow
  order?: WoolWorkOrder
  imageUrl?: string
  name: string
  code: string
  returnableQty: number
  canIssue: boolean
  canReturn: boolean
  position?: NonNullable<ReturnType<typeof resolveFactoryWarehouseLocation>>
}
export interface CentralWoolPreparation {
  receipt: FactoryReceipt
  line: FactoryReceiptLine
  remainingQty: number
  allocations: ReceivingAllocation[]
  targets: WoolWorkOrder[]
}
export function centralWoolWarehouseFacts(factoryId: string) {
  const facts = centralWoolFacts(factoryId), orders = new Map(facts.orders.map(order => [order.woolOrderId, order]))
  const flows = listWoolFactoryWarehouseFlows(facts.store, factoryId)
  const stocks: CentralWoolStock[] = listWoolWarehouseStocksFromStore({ ...facts.store, warehouseFlows: flows })
    .map(stock => {
      const order = orders.get(stock.woolOrderId), batch = normalizeWoolBatchNo(stock.batchNo)
      const returnableQty = Math.max(0,
        facts.store.yarnIssues.filter(r => r.woolOrderId === stock.woolOrderId && r.yarnSkuCode === stock.objectSkuCode && normalizeWoolBatchNo(r.batchNo) === batch).reduce((n, r) => n + r.issuedQty, 0)
        - facts.store.yarnReturns.filter(r => r.woolOrderId === stock.woolOrderId && r.yarnSkuCode === stock.objectSkuCode && normalizeWoolBatchNo(r.batchNo) === batch).reduce((n, r) => n + r.returnedQty, 0))
      const piece = order?.externalPieces.find(piece => piece.pieceKey === stock.objectSkuCode)
      const yarnLines = facts.store.yarnReceipts.filter(receipt => normalizeWoolBatchNo(receipt.batchNo) === batch
        && (receipt.woolOrderId === stock.woolOrderId || receipt.factoryId === factoryId))
        .flatMap(receipt => receipt.lines).filter(line => line.yarnSkuCode === stock.objectSkuCode)
      const yarn = yarnLines.find(line => !stock.physicalLocationId || line.physicalLocationId === stock.physicalLocationId) || yarnLines.find(line => !!line.imageUrl)
      const eligible = !!order && stock.objectType === 'YARN' && stock.unit === 'kg' && !stock.completed
        && order.outputPlanLines.some(line => line.requiredYarnSkus.includes(stock.objectSkuCode))
      return { stock, order, returnableQty, canIssue: eligible && stock.currentQty > 0, canReturn: eligible && returnableQty > 0,
        name: piece?.pieceName || stock.objectName, code: piece?.skuCode || stock.objectSkuCode,
        imageUrl: stock.objectType === 'YARN' ? yarn?.imageUrl : order?.styleImageUrl,
        position: stock.physicalWarehouseId && stock.physicalLocationId
          ? resolveFactoryWarehouseLocation(stock.physicalWarehouseId, stock.physicalLocationId) : undefined }
    })
  const allocations = listReceivingAllocations()
  const preparation: CentralWoolPreparation[] = listFactoryReceipts(factoryId).flatMap(receipt => receipt.lines
    .filter(line => line.material.kind === 'YARN' && line.unit === 'kg' && !line.woolOrderId && !line.woolCraftOrderId
      && !line.printingOrderId && !line.dyeOrderId && !line.waterOrderId)
    .map(line => ({ receipt, line, remainingQty: remainingReceivingAllocationQty(line.id), allocations: allocations.filter(a => a.receiptLineId === line.id),
      targets: listReceivingAllocationTargets(line.id).flatMap(target => {
        const order = orders.get(target.id)
        return target.kind === 'wool' && order?.stage === 'KNITTING' ? [order] : []
      }) })))
  return { ...facts, stocks, preparation, flows, warehouses: listFactoryInternalWarehouses(factoryId) }
}
export const centralWoolStockSource = (row: CentralWoolStock) => JSON.stringify([row.stock, row.order, row.returnableQty])
export type CentralWoolYarnRequest = {
  actorId: string; stockKey: string; expectedSource: string; woolOrderId: string
} & ({ kind: 'issue'; input: IssueWoolYarnInput } | { kind: 'return'; input: ReturnWoolYarnInput })
export function centralWoolYarnRequest(row: CentralWoolStock, kind: 'issue' | 'return', quantity: number,
  actor: FactoryPdaUser, commandId: string, at: string): CentralWoolYarnRequest {
  assertCentralWoolActor(actor)
  if (!row.order || row.order.factoryId !== actor.factoryId) throw Error('WOOL_actor')
  if (!Number.isFinite(quantity) || quantity <= 0) throw Error('WST_quantity')
  if (kind === 'issue' ? !row.canIssue : !row.canReturn) throw Error('WST_blocked')
  if (quantity > (kind === 'issue' ? row.stock.currentQty : row.returnableQty)) throw Error('WST_limit')
  const base = { actorId: actor.userId, stockKey: row.stock.stockKey, expectedSource: centralWoolStockSource(row), woolOrderId: row.stock.woolOrderId }
  const input = { commandId, yarnSkuCode: row.stock.objectSkuCode, batchNo: row.stock.batchNo,
    physicalWarehouseId: row.stock.physicalWarehouseId, physicalLocationId: row.stock.physicalLocationId }
  return kind === 'issue' ? { ...base, kind, input: { ...input, issuedQty: quantity, issuedAt: at, issuedBy: actor.name } }
    : { ...base, kind, input: { ...input, returnedQty: quantity, returnedAt: at, returnedBy: actor.name } }
}
function conflict(error: unknown): never {
  if (!(error as { committed?: boolean })?.committed && error instanceof Error
    && /(?:记录|分配)已被其他页面修改|其他标签页已更新/.test(error.message)) throw Error('WOOL_changed', { cause: error })
  throw error
}
export async function saveCentralWoolYarn(request: CentralWoolYarnRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolActor(actor)
  if (request.actorId !== actor.userId || (request.kind === 'issue' ? request.input.issuedBy : request.input.returnedBy) !== actor.name) throw Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    const facts = centralWoolWarehouseFacts(actor.factoryId)
    if (!facts.orders.some(order => order.woolOrderId === request.woolOrderId)) throw Error('WOOL_actor')
    const retry = facts.store.operationLogs.some(log => {
      const receipt = log.afterValue as WoolCommandReceiptValue | undefined
      return receipt?.commandId === request.input.commandId && receipt.targetId === request.woolOrderId
        && receipt.commandType === (request.kind === 'issue' ? 'ISSUE_WOOL_YARN' : 'RETURN_WOOL_YARN')
    })
    if (!retry) {
      const row = facts.stocks.find(row => row.stock.stockKey === request.stockKey)
      if (!row || row.stock.woolOrderId !== request.woolOrderId
        || JSON.stringify([row.stock.objectSkuCode, row.stock.batchNo, row.stock.physicalWarehouseId, row.stock.physicalLocationId]) !== JSON.stringify([request.input.yarnSkuCode, request.input.batchNo, request.input.physicalWarehouseId, request.input.physicalLocationId])
        || centralWoolStockSource(row) !== request.expectedSource) throw Error('WOOL_changed')
      centralWoolYarnRequest(row, request.kind, request.kind === 'issue' ? request.input.issuedQty : request.input.returnedQty,
        actor, request.input.commandId, request.kind === 'issue' ? request.input.issuedAt : request.input.returnedAt)
    }
    return request.kind === 'issue' ? issueWoolYarn(request.woolOrderId, request.input) : returnWoolYarn(request.woolOrderId, request.input)
  }) } catch (error) { conflict(error) }
}
export const centralWoolAllocationSource = (row: CentralWoolPreparation, orderId: string) =>
  JSON.stringify([row.receipt.id, row.receipt.factoryId, row.line, row.allocations, row.targets.find(order => order.woolOrderId === orderId)])
export interface CentralWoolAllocationRequest { input: ReceivingAllocation; actorId: string; expectedSource: string }
export function centralWoolAllocationRequest(row: CentralWoolPreparation, orderId: string, quantity: number,
  actor: FactoryPdaUser, commandId: string, at: string): CentralWoolAllocationRequest {
  assertCentralWoolActor(actor)
  if (row.receipt.factoryId !== actor.factoryId) throw Error('WOOL_actor')
  if (!row.targets.some(order => order.woolOrderId === orderId)) throw Error('WST_target')
  if (!Number.isFinite(quantity) || quantity <= 0) throw Error('WST_quantity')
  if (quantity > row.remainingQty + 0.000001) throw Error('WST_limit')
  return { actorId: actor.userId, expectedSource: centralWoolAllocationSource(row, orderId),
    input: { id: commandId, receiptLineId: row.line.id, woolOrderId: orderId, qty: quantity, operatorName: actor.name, at } }
}
export async function saveCentralWoolAllocation(request: CentralWoolAllocationRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolActor(actor)
  if (request.actorId !== actor.userId || request.input.operatorName !== actor.name) throw Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    const facts = centralWoolWarehouseFacts(actor.factoryId), row = facts.preparation.find(row => row.line.id === request.input.receiptLineId)
    if (!row) throw Error('WST_source')
    if (!row.allocations.some(a => a.id === request.input.id)) {
      if (centralWoolAllocationSource(row, request.input.woolOrderId || '') !== request.expectedSource) throw Error('WOOL_changed')
      centralWoolAllocationRequest(row, request.input.woolOrderId || '', request.input.qty, actor, request.input.id, request.input.at)
    }
    allocateReceivedMaterialToOrder(request.input, actor)
    // The original projection transfers ownership in the same transaction.
    // It pairs preparation OUT and order IN without another receipt.
    readWoolStore()
    return request.input
  }) } catch (error) { conflict(error) }
}
