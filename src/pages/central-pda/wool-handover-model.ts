import { addWoolHandover, type AddWoolHandoverInput } from '../../data/fcs/wool-domain/commands.ts'
import { runWoolRecordCommand, type WoolDomainStore } from '../../data/fcs/wool-domain/store.ts'
import { pieceAvailableQty, woolSkuGenerationIssues } from '../../data/fcs/wool-domain/stage-rules.ts'
import type { WoolCommandReceiptValue, WoolExternalPiece, WoolHandoverRecord } from '../../data/fcs/wool-domain/types.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../../data/fcs/special-craft-operations.ts'
import { getDedicatedSpecialCraftFactoryId } from '../../data/fcs/special-craft-dedicated-factories.ts'
import { parseWoolHandoverCode } from '../../data/fcs/wool-domain/handover-code.ts'
import { listFactoryReceipts, listFactoryReceivingSources } from '../../data/fcs/factory-receiving.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { assertCentralWoolActor, centralWoolFacts, centralWoolExecutionRows, prepareCentralWool,
  type CentralWoolExecution } from './wool-model.ts'

export interface CentralWoolHandoverTarget {
  key: string; sku: string; piece?: WoolExternalPiece; unit: '片' | '件'; availableQty: number;
  receiverType: WoolHandoverRecord['receiverType']; receiverId: string; receiverName: string;
  craftCode?: string; craftName?: string; targetWorkOrderId?: string; ready: boolean;
}
export interface CentralWoolReceiptActor { operatorId: string; operatorName: string }
/** Read the actual receiving account only when the saved receipt belongs to
 * this exact outgoing batch, part, route node and receiving factory. Historical
 * acknowledgements without that source remain name-only; never guess an ID. */
export function centralWoolHandoverReceiptActors(row: Pick<CentralWoolExecution, 'order'>, store: WoolDomainStore) {
  const handovers = store.handovers.filter(record => record.woolOrderId === row.order.woolOrderId
    && record.pieceKey && record.downstreamReceipt?.receiptConfirmationId)
  const actors = new Map<string, CentralWoolReceiptActor>()
  if (!handovers.length) return actors
  const receipts = new Map(listFactoryReceipts().map(receipt => [receipt.id, receipt]))
  const sources = new Map(listFactoryReceivingSources(undefined, true).map(source => [source.id, source]))
  for (const handover of handovers) {
    const receipt = receipts.get(handover.downstreamReceipt!.receiptConfirmationId)
    if (!receipt || receipt.factoryId !== handover.receiverId
      || receipt.operatorName !== handover.downstreamReceipt!.receivedBy) continue
    if (receipt.lines.some(line => line.material.kind === 'WOOL_PIECE'
      && line.woolPieceKey === handover.pieceKey && line.woolCraftOrderId === handover.targetWorkOrderId
      && line.woolRouteNodeId === handover.routeNodeId
      && sources.get(line.sourceId)?.originalRecordId === handover.handoverId)) {
      actors.set(handover.handoverId, { operatorId: receipt.operatorId, operatorName: receipt.operatorName })
    }
  }
  return actors
}
export function centralWoolHandoverTargets(row: CentralWoolExecution, store: WoolDomainStore): CentralWoolHandoverTarget[] {
  const enabled = !row.completed && row.actions.includes('HANDOVER')
  if (row.order.stage === 'KNITTING') {
    const operations = listEnabledSpecialCraftOperationDefinitions()
    return row.order.externalPieces.map(piece => {
      const node = piece.routeNodes[0], operation = operations.find(operation => operation.craftCode === node?.craftCode)
      const ready = !!node?.factoryId && !!node.factoryName && !piece.issues.length
        && !woolSkuGenerationIssues(row.order, piece.skuCode).length
        && !!operation && node.factoryId === getDedicatedSpecialCraftFactoryId(operation.operationId)
      return { key: piece.pieceKey, sku: piece.skuCode, piece, unit: '片' as const, ready,
        availableQty: enabled && ready ? pieceAvailableQty(store, row.order, piece.pieceKey) : 0,
        receiverType: 'DOWNSTREAM_FACTORY' as const, receiverId: node?.factoryId || '', receiverName: node?.factoryName || '',
        craftCode: node?.craftCode, craftName: node?.craftName, targetWorkOrderId: node?.taskOrderId }
    })
  }
  return row.lines.map(line => {
    const target = row.order.downstreamTarget, ready = !!target.receiverId && !!target.receiverName
    return { key: line.line.outputSkuCode, sku: line.line.outputSkuCode, unit: '件' as const, ...target, ready,
      availableQty: enabled && ready ? line.handoverAvailableQty : 0 }
  })
}
export function centralWoolHandoverSource(row: CentralWoolExecution, target: CentralWoolHandoverTarget) {
  const line = row.lines.find(line => line.line.outputSkuCode === target.sku)
  return JSON.stringify([row.order, row.completed, target, line?.readiness, line?.stockQty, line?.handoverAvailableQty])
}
export interface CentralWoolHandoverRequest {
  woolOrderId: string; actorId: string; targetKey: string; expectedSource: string; input: AddWoolHandoverInput;
}
export function centralWoolHandoverRequest(row: CentralWoolExecution, target: CentralWoolHandoverTarget,
  quantity: number, actor: FactoryPdaUser, commandId: string, handedOverAt: string): CentralWoolHandoverRequest {
  assertCentralWoolActor(actor)
  if (row.order.factoryId !== actor.factoryId) throw new Error('WOOL_actor')
  if (!row.lines.some(line => line.line.outputSkuCode === target.sku)
    || row.order.stage === 'KNITTING' && !row.order.externalPieces.some(piece => piece.pieceKey === target.key && piece.skuCode === target.sku)
    || row.order.stage === 'LINKING' && target.key !== target.sku) throw new Error('WOOL_handoverSource')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('WOOL_handoverQuantity')
  if (row.completed) throw new Error('WOOL_changed')
  if (!row.actions.includes('HANDOVER') || !target.ready || target.availableQty <= 0) throw new Error('WOOL_handoverBlocked')
  if (quantity > target.availableQty) throw new Error('WOOL_handoverLimit')
  return { woolOrderId: row.order.woolOrderId, actorId: actor.userId, targetKey: target.key,
    expectedSource: centralWoolHandoverSource(row, target), input: { commandId, outputSkuCode: target.sku,
      ...(target.piece ? { pieceKey: target.piece.pieceKey } : {}), handoverQty: quantity, handedOverAt, handedOverBy: actor.name } }
}
export async function saveCentralWoolHandover(request: CentralWoolHandoverRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolActor(actor)
  if (request.actorId !== actor.userId || request.input.handedOverBy !== actor.name) throw new Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    const facts = centralWoolFacts(actor.factoryId), row = centralWoolExecutionRows(facts, request.woolOrderId)[0]
    if (!row || row.order.factoryId !== actor.factoryId) throw new Error('WOOL_handoverSource')
    const retry = facts.store.operationLogs.some(log => {
      const receipt = log.afterValue as WoolCommandReceiptValue | undefined
      return receipt?.commandId === request.input.commandId && receipt.commandType === 'ADD_WOOL_HANDOVER'
        && receipt.targetId === request.woolOrderId
    })
    if (!retry) {
      const target = centralWoolHandoverTargets(row, facts.store).find(target => target.key === request.targetKey)
      if (!target || centralWoolHandoverSource(row, target) !== request.expectedSource) throw new Error('WOOL_changed')
      const checked = centralWoolHandoverRequest(row, target, request.input.handoverQty, actor, request.input.commandId, request.input.handedOverAt)
      if (JSON.stringify(checked.input) !== JSON.stringify(request.input)) throw new Error('WOOL_handoverSource')
    }
    return addWoolHandover(request.woolOrderId, request.input)
  }) } catch (error) {
    if (!(error as {committed?:boolean})?.committed && error instanceof Error
      && /记录已被其他页面修改|其他标签页已更新/.test(error.message)) throw new Error('WOOL_changed', { cause: error })
    throw error
  }
}
/** A delivery-note scan selects a saved batch in the sender's own order. It
 * never turns that saved batch into another outgoing draft or receiver action. */
export function centralWoolScannedHandover(facts: ReturnType<typeof centralWoolFacts>, raw: string) {
  const code = raw.trim(), parsed = parseWoolHandoverCode(code)
  const matches = facts.store.handovers.filter(record => parsed ? record.handoverId === parsed.handoverId
    && record.woolOrderId === parsed.woolOrderId : record.handoverId.toUpperCase() === code.toUpperCase())
  if (matches.length !== 1) return undefined
  const record = matches[0]
  const order = record && facts.orders.find(order => order.woolOrderId === record.woolOrderId)
  if (!record || !order || parsed && parsed.stage !== order.stage) return undefined
  return { order, record }
}
