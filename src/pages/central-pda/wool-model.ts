import { ensurePcsRecordState, refreshPcsRecordStateAfterExternalChange } from '../../data/pcs-record-runtime.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { WOOL_DOMAIN_STORE_KEY, readWoolStore, runWoolRecordCommand } from '../../data/fcs/wool-domain/store.ts'
import { listWoolWorkOrders, readWoolQuerySnapshot, getWoolAllowedActionsFromStore,
  getWoolWorkOrderReadinessProjectionFromStore, type WoolReadinessOutputProjection } from '../../data/fcs/wool-domain/queries.ts'
import { addWoolProcessReport, type AddWoolProcessReportInput } from '../../data/fcs/wool-domain/commands.ts'
import { woolSkuGenerationIssues } from '../../data/fcs/wool-domain/stage-rules.ts'
import { eligibleReceivingSource, listFactoryReceivingSources, listFactoryReceipts, prepareFactoryReceipt,
  type FactoryReceiptInput, type FactoryReceivingSource, type FactoryReceivingSourceLine } from '../../data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../data/fcs/factory-receiving-links.ts'
import type { WoolWorkOrder, WoolExternalPiece, WoolOutputPlanLine, WoolCommandReceiptValue } from '../../data/fcs/wool-domain/types.ts'
import { calculateYarnWeight, type YarnTubeCounts } from '../../data/fcs/yarn-weight.ts'
import { hydrateProductionContextRecords } from '../../data/fcs/production-context-records.ts'

const collections = [WOOL_DOMAIN_STORE_KEY, 'higood-pcs-fcs-design-revision-receiving-v1'] as const
export async function prepareCentralWool() {
  await ensurePcsRecordState(collections)
  await hydrateProductionContextRecords()
  await refreshPcsRecordStateAfterExternalChange()
}
export function centralWoolFactories() {
  return listFactoryMasterRecords().filter(factory => factory.status === 'active'
    && factory.factoryType === 'CENTRAL_WOOL' && isCentralPdaFactory(factory))
}
/** Keep an existing factory/account choice. For the anonymous prototype's first
 * visit, prefer an actual current order owner over an empty legacy factory. */
export function centralWoolInitialFactory(preferredFactoryIds: readonly string[]) {
  const factories = centralWoolFactories()
  for (const id of preferredFactoryIds) {
    const factory = factories.find(factory => factory.id === id)
    if (factory) return factory
  }
  const owners = new Set(listWoolWorkOrders().map(order => order.factoryId))
  return factories.find(factory => owners.has(factory.id)) || factories[0]
}
export function assertCentralWoolActor(actor: FactoryPdaUser) {
  const factory = getFactoryMasterRecordById(actor.factoryId)
  const actual = readFactoryPdaExecutionUsers(actor.factoryId).find(user => user.userId === actor.userId)
  if (!factory || factory.status !== 'active' || factory.factoryType !== 'CENTRAL_WOOL' || !isCentralPdaFactory(factory)
    || !actual || actual.status !== 'ACTIVE' || actual.name !== actor.name) throw new Error('WOOL_actor')
  return actual
}
export function centralWoolOrders(factoryId: string) {
  if (!centralWoolFactories().some(factory => factory.id === factoryId)) return []
  return listWoolWorkOrders().filter(order => order.factoryId === factoryId)
}
export interface CentralWoolIncoming {
  key: string
  source: FactoryReceivingSource
  line: FactoryReceivingSourceLine
  receivedQty: number
  remainingQty: number
  expectedQty: number
  canReceive: boolean
  orderCompleted: boolean
  order?: WoolWorkOrder
  piece?: WoolExternalPiece
  receipts: Array<{ id: string; qty: number; unit: string; at: string; operatorId: string; operatorName: string; warehouseId: string; locationId: string }>
}
export function centralWoolIncoming(factoryId: string): CentralWoolIncoming[] {
  const orders = centralWoolOrders(factoryId), completed = new Set(readWoolQuerySnapshot().completions.map(record=>record.woolOrderId))
  if (!centralWoolFactories().some(factory => factory.id === factoryId)) return []
  const receipts = listFactoryReceipts(factoryId)
  return listFactoryReceivingSources(factoryId).flatMap(source => source.lines
    .filter(line => line.material.kind === 'YARN' || (line.material.kind === 'WOOL_PIECE' && !!line.woolOrderId && !line.woolCraftOrderId))
    .map(line => {
      const actual = receipts.flatMap(receipt => receipt.lines.filter(item => item.sourceId === source.id && item.sourceLineId === line.id)
        .map(item => ({ id: receipt.id, qty: item.qty, unit: item.unit, at: receipt.receivedAt,
          operatorId: receipt.operatorId, operatorName: receipt.operatorName, warehouseId: item.warehouseId, locationId: item.locationId })))
      const receivedQty = actual.reduce((sum, item) => sum + item.qty, 0)
      const expectedQty = line.material.kind === 'YARN' && line.yarn ? line.yarn.netGrams / 1000 : line.sentQty
      const order=orders.find(order=>order.woolOrderId===line.woolOrderId),piece=order?.externalPieces.find(piece=>piece.pieceKey===line.woolPieceKey)
      const orderCompleted=!!line.woolOrderId&&completed.has(line.woolOrderId)
      const canReceive=eligibleReceivingSource(source)&&(!line.woolOrderId||!!order&&!orderCompleted)
      return { key: JSON.stringify([source.id, line.id]), source, line, order, piece, canReceive, orderCompleted, receivedQty,
        expectedQty, remainingQty: Math.max(0, expectedQty - receivedQty), receipts: actual }
    }))
}
export function centralWoolFacts(factoryId: string) {
  if (!centralWoolFactories().some(factory => factory.id === factoryId)) throw new Error('WOOL_actor')
  const orders = centralWoolOrders(factoryId)
  return { orders, incoming: centralWoolIncoming(factoryId), store: readWoolQuerySnapshot() }
}
export function centralWoolExecutionRows(facts: ReturnType<typeof centralWoolFacts>, woolOrderId?: string): CentralWoolExecution[] {
  const { store } = facts
  return facts.orders.filter(order => !woolOrderId || order.woolOrderId === woolOrderId).map(order => {
    const projection = getWoolWorkOrderReadinessProjectionFromStore(store, order.woolOrderId)
    return { order, completed: store.completions.some(record => record.woolOrderId === order.woolOrderId),
      actions: getWoolAllowedActionsFromStore(store, order.woolOrderId),
      lines: order.outputPlanLines.map(line => ({ line, ...projection.outputsBySku.get(line.outputSkuCode)!,
        issues: woolSkuGenerationIssues(order, line.outputSkuCode),
        automatic: order.stage === 'LINKING' && !order.externalPieces.some(piece => piece.skuCode === line.outputSkuCode) })) }
  })
}

export interface CentralWoolExecutionLine extends WoolReadinessOutputProjection {
  line: WoolOutputPlanLine
  issues: string[]
  automatic: boolean
}
export interface CentralWoolExecution {
  order: WoolWorkOrder
  completed: boolean
  actions: ReturnType<typeof getWoolAllowedActionsFromStore>
  lines: CentralWoolExecutionLine[]
}
export function centralWoolReportSource(row: CentralWoolExecution, line: CentralWoolExecutionLine) {
  return JSON.stringify([row.order, row.completed, line.line, line.readiness, line.issues])
}
export interface CentralWoolReportRequest {
  woolOrderId: string
  input: AddWoolProcessReportInput
  actorId: string
  expectedSource: string
}
export function centralWoolReportRequest(row: CentralWoolExecution, sku: string, quantity: number,
  actor: FactoryPdaUser, commandId: string, reportedAt: string): CentralWoolReportRequest {
  assertCentralWoolActor(actor)
  if (row.order.factoryId !== actor.factoryId) throw new Error('WOOL_actor')
  const line = row.lines.find(item => item.line.outputSkuCode === sku)
  if (!line) throw new Error('WOOL_reportSource')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('WOOL_reportQuantity')
  if (row.completed) throw new Error('WOOL_changed')
  if (line.automatic) throw new Error('WOOL_automatic')
  if (row.order.stage === 'KNITTING' && line.readiness.missingYarnSkus.length) throw new Error('WOOL_missingYarn')
  if (!line.readiness.canReport || !row.actions.includes('REPORT_PROCESS')) throw new Error('WOOL_reportBlocked')
  if (quantity > line.readiness.remainingReportQty) throw new Error('WOOL_reportLimit')
  return { woolOrderId: row.order.woolOrderId, actorId: actor.userId, expectedSource: centralWoolReportSource(row, line),
    input: { commandId, outputSkuCode: sku, reportedQty: quantity, reportedAt, reportedBy: actor.name } }
}
export async function saveCentralWoolReport(request: CentralWoolReportRequest, actor: FactoryPdaUser) {
  await prepareCentralWool()
  assertCentralWoolActor(actor)
  if (request.actorId !== actor.userId || request.input.reportedBy !== actor.name) throw new Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    const facts = centralWoolFacts(actor.factoryId), row = centralWoolExecutionRows(facts, request.woolOrderId)[0]
    if (!row || row.order.factoryId !== actor.factoryId) throw new Error('WOOL_reportSource')
    const retry = facts.store.operationLogs.some(log => {
      const receipt = log.afterValue as WoolCommandReceiptValue | undefined
      return receipt?.commandId === request.input.commandId && receipt.commandType === 'ADD_WOOL_PROCESS_REPORT'
        && receipt.targetId === request.woolOrderId
    })
    if (!retry) {
      const line = row.lines.find(line => line.line.outputSkuCode === request.input.outputSkuCode)
      if (!line || centralWoolReportSource(row, line) !== request.expectedSource) throw new Error('WOOL_changed')
      centralWoolReportRequest(row, request.input.outputSkuCode, request.input.reportedQty, actor, request.input.commandId, request.input.reportedAt)
    }
    return addWoolProcessReport(request.woolOrderId, request.input)
  }) } catch (error) {
    if (!(error as {committed?:boolean})?.committed && error instanceof Error
      && /记录已被其他页面修改|其他标签页已更新/.test(error.message)) throw new Error('WOOL_changed', { cause: error })
    throw error
  }
}
export const centralWoolReceiptSource = (row: CentralWoolIncoming) => JSON.stringify([row.source, row.line, row.receipts])
export type CentralWoolReceiptValues = { warehouseId: string; locationId: string } & (
  { kind: 'YARN'; grossKg: number; tubes: YarnTubeCounts } | { kind: 'WOOL_PIECE'; quantity: number }
)
export function centralWoolReceiptRequest(row: CentralWoolIncoming, values: CentralWoolReceiptValues,
  actor: FactoryPdaUser, operationId: string, receivedAt: string) {
  assertCentralWoolActor(actor)
  if (!row.canReceive) throw new Error('WOOL_changed')
  if (row.source.targetFactoryId !== actor.factoryId || row.line.material.kind !== values.kind) throw new Error('WOOL_source')
  const base = { sourceId: row.source.id, sourceLineId: row.line.id, warehouseId: values.warehouseId, locationId: values.locationId }
  const line = values.kind === 'YARN' ? { ...base, grossKg: values.grossKg, tubes: { ...values.tubes },
    pcs: calculateYarnWeight(values.grossKg, values.tubes).pcs } : { ...base, businessQty: values.quantity, businessUnit: '片' }
  const input: FactoryReceiptInput = { id: operationId, factoryId: actor.factoryId, operatorId: actor.userId,
    operatorName: actor.name, receivedAt, remark: '', lines: [line] }
  const prepared = prepareFactoryReceipt(input)
  return { input, sourceKey: row.key, expectedSource: centralWoolReceiptSource(row), prepared }
}
export type CentralWoolReceiptRequest = ReturnType<typeof centralWoolReceiptRequest>
export async function saveCentralWoolReceipt(request: CentralWoolReceiptRequest, actor: FactoryPdaUser) {
  await prepareCentralWool()
  assertCentralWoolActor(actor)
  const input = request.input
  if (input.factoryId !== actor.factoryId || input.operatorId !== actor.userId || input.operatorName !== actor.name) throw new Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    // A stable retry returns the actual saved receipt even after its source was
    // consumed. The original receipt fingerprint still checks identical input.
    if (!listFactoryReceipts(actor.factoryId).some(receipt => receipt.id === input.id)) {
      const current = centralWoolIncoming(actor.factoryId).find(row => row.key === request.sourceKey)
      if (!current || !current.canReceive || centralWoolReceiptSource(current) !== request.expectedSource) throw new Error('WOOL_changed')
    }
    const saved = confirmFactoryMaterialReceipt(input, actor)
    // The original wool ledger derives the receipt. No second receipt or
    // separately writable inventory is created by the Central PDA adapter.
    readWoolStore()
    return saved
  }) } catch (error) {
    if (!(error as {committed?:boolean})?.committed && error instanceof Error
      && /记录已被其他页面修改|其他标签页已更新/.test(error.message)) throw new Error('WOOL_changed', { cause: error })
    throw error
  }
}
