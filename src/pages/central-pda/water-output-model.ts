import { getWaterOutputRolls, listWaterDispatchDocuments, isWaterRollAvailable, saveWaterOutputRolls, markWaterOutputRolls,
  createWaterDispatchDocument, scanWaterDispatchRoll, saveWaterDispatchTransport, finishWaterDispatchDocument } from '../../data/fcs/water-soluble-output.ts'
import { assertCentralWaterSolubleActor } from '../../data/fcs/water-soluble-task-domain.ts'
import { runWaterSolubleRecordCommand } from '../../data/fcs/water-soluble-records.ts'
import { listHandoverOrdersByTaskId, getPdaHandoverRecordsByHead } from '../../data/fcs/pda-handover-events.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import type { ProcessDispatchDocument } from '../../data/fcs/process-output-types.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { centralWaterFact, listCentralWaterFacts } from './water-model.ts'
const actorFact = (actor: FactoryPdaUser) => ({ userId: actor.userId, name: actor.name, factoryId: actor.factoryId })
const intent = (actor: FactoryPdaUser, action: string, input: unknown) => JSON.stringify({ action, actor: actor.userId, input })
function assertOrder(orderId: string, actor: FactoryPdaUser) {
  assertCentralWaterSolubleActor(orderId, actorFact(actor))
  const fact = centralWaterFact(orderId, actor.factoryId)
  if (!fact || fact.order.status === 'DONE') throw new Error('WATER_closed')
  return fact
}
export function centralWaterOutput(orderId: string, factoryId: string) {
  return withFactoryProcessStaticRead(() => {
    const fact = centralWaterFact(orderId, factoryId)
    if (!fact) return undefined
    const documents = listWaterDispatchDocuments().filter(doc => doc.lines.some(line => line.orderId === orderId))
    const rolls = getWaterOutputRolls(orderId).map(roll => ({ ...roll,
      reservedBy: documents.find(doc => doc.status === '草稿' && doc.lines.some(line => line.orderId === orderId && line.rolls.some(row => row.id === roll.id)))?.id,
      canDispatch: isWaterRollAvailable(orderId, roll),
    }))
    return { fact, documents, rolls, available: fact.availableOutput }
  })
}
export function centralWaterDispatch(docId: string, factoryId: string) {
  return withFactoryProcessStaticRead(() => {
    const doc = listWaterDispatchDocuments().find(doc => doc.id === docId)
    return doc?.lines.length && doc.lines.every(line => line.factoryId === factoryId && !!centralWaterFact(line.orderId, factoryId)) ? doc : undefined
  })
}
function assertDocument(docId: string, actor: FactoryPdaUser) {
  const doc = centralWaterDispatch(docId, actor.factoryId)
  if (!doc) throw new Error('WATER_wrongDocument')
  doc.lines.forEach(line => assertOrder(line.orderId, actor))
  return doc
}
export function centralWaterLabelRevision(orderId: string, rollId: string, factoryId: string) {
  const state = centralWaterOutput(orderId, factoryId),roll = state?.rolls.find(row => row.id === rollId)
  return JSON.stringify(state && roll && [state.fact.order.waterOrderNo, state.fact.order.qtyUnit, state.fact.order.materialCode,
    state.fact.order.materialName, state.fact.order.materialSpec, state.fact.image?.material, roll.barcode, roll.rollNo, roll.qty])
}
export async function saveCentralWaterRoll(orderId: string, input: { id?: string; qty: number }, actor: FactoryPdaUser,
  operationId: string, revision?: string) {
  return runWaterSolubleRecordCommand(orderId, () => {
    assertOrder(orderId, actor)
    if (input.id && (!revision || centralWaterLabelRevision(orderId, input.id, actor.factoryId) !== revision)) throw new Error('CHANGED')
    if (!Number.isFinite(input.qty) || input.qty <= 0) throw new Error('QUANTITY_POSITIVE')
    if (Math.abs(input.qty * 100 - Math.round(input.qty * 100)) > 0.000001) throw new Error('QUANTITY_PRECISION')
    const old = new Set(getWaterOutputRolls(orderId).map(roll => roll.id)),saved = saveWaterOutputRolls(orderId, [input], actorFact(actor))
    return saved.filter(roll => input.id ? roll.id === input.id : !old.has(roll.id)).map(roll => roll.id)
  }, operationId, intent(actor, 'water-save-roll', { orderId, input, revision }))
}
export async function markCentralWaterRollsPrinted(orderId: string, rollIds: string[], revisions: Record<string, string>, actor: FactoryPdaUser, operationId: string) {
  return runWaterSolubleRecordCommand(orderId, () => {
    assertOrder(orderId, actor)
    if (!rollIds.length || rollIds.some(id => !revisions[id] || centralWaterLabelRevision(orderId, id, actor.factoryId) !== revisions[id])) throw new Error('CHANGED')
    markWaterOutputRolls(orderId, rollIds, actor.name, actorFact(actor))
    return rollIds
  }, operationId, intent(actor, 'water-label-printed', { orderId, rollIds, revisions }))
}
export async function createCentralWaterDispatch(selections: Array<{ orderId: string; rollIds: string[] }>, actor: FactoryPdaUser,
  operationId: string, options: { docId?: string; scannedBarcode?: string } = {}) {
  return runWaterSolubleRecordCommand({selections,documentId:options.docId}, () => {
    selections.forEach(selection => assertOrder(selection.orderId, actor))
    const existing = options.docId ? assertDocument(options.docId, actor) : undefined
    const onlyExisting = existing && selections.every(selection => selection.rollIds.every(id => existing.lines.some(line => line.orderId === selection.orderId && line.rolls.some(roll => roll.id === id))))
    const doc = onlyExisting ? existing : createWaterDispatchDocument(selections, actor.name, options.docId, actorFact(actor))
    if (options.scannedBarcode !== undefined) scanWaterDispatchRoll(doc.id, options.scannedBarcode, actor.name, actorFact(actor))
    return doc.id
  }, operationId, intent(actor, 'water-create-dispatch', { selections, options }))
}
export async function scanCentralWaterDispatch(docId: string, barcode: string, actor: FactoryPdaUser, operationId: string) {
  return runWaterSolubleRecordCommand(docId, () => {
    assertDocument(docId, actor)
    scanWaterDispatchRoll(docId, barcode, actor.name, actorFact(actor))
    return barcode
  }, operationId, intent(actor, 'water-scan-dispatch', { docId, barcode }))
}
export async function confirmCentralWaterDispatch(docId: string, transport: ProcessDispatchDocument['transport'], actor: FactoryPdaUser, operationId: string) {
  return runWaterSolubleRecordCommand(docId, () => {
    assertDocument(docId, actor)
    saveWaterDispatchTransport(docId, transport, actorFact(actor))
    finishWaterDispatchDocument(docId, 'confirm', actorFact(actor))
    return docId
  }, operationId, intent(actor, 'water-confirm-dispatch', { docId, transport }))
}
export async function voidCentralWaterDispatch(docId: string, actor: FactoryPdaUser, operationId: string) {
  return runWaterSolubleRecordCommand(docId, () => {
    assertDocument(docId, actor)
    finishWaterDispatchDocument(docId, 'void', actorFact(actor))
    return docId
  }, operationId, intent(actor, 'water-void-dispatch', { docId }))
}
export function resolveCentralWaterRoll(code: string, factoryId: string) {
  return withFactoryProcessStaticRead(() => listCentralWaterFacts(factoryId).flatMap(fact => getWaterOutputRolls(fact.order.waterOrderId)
    .filter(roll => roll.barcode === code.trim()).map(roll => ({ orderId: fact.order.waterOrderId, roll }))))
}
export function centralWaterReceiptHistory(orderId: string, factoryId: string) {
  return withFactoryProcessStaticRead(() => {
    const fact = centralWaterFact(orderId, factoryId)
    if (!fact) return []
    const records = listHandoverOrdersByTaskId(fact.order.taskId, { includeWool: false }).flatMap(head => getPdaHandoverRecordsByHead(head.handoverId, head))
    return listWaterDispatchDocuments().filter(doc => doc.status === '已交出').flatMap(doc => doc.lines.filter(line => line.orderId === orderId).map(line => {
      const record = records.find(record => (record.handoverRecordId || record.recordId) === line.handoverRecordId)
      return { doc, line, record, sent: line.historicalQty ?? line.rolls.reduce((sum, roll) => sum + roll.qty, 0),
        actual: record?.receiverWrittenAt || record?.warehouseWrittenAt ? record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0 : undefined,
        receivedAt: record?.receiverWrittenAt || record?.warehouseWrittenAt,
        receiver: record?.receiverWrittenBy, sender: record?.factorySubmittedBy, senderId: record?.factorySubmittedByUserId }
    }))
  })
}
