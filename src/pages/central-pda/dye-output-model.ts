import { getDyeOutputRolls, getDyeOutputRollDefaults, saveDyeOutputRolls, deleteDyeOutputRolls, markDyeOutputRolls,
  getDyeDispatchAvailableQty, getDyeDispatchMaterial, getDyeDispatchPartner, isDyeYarnOrder,
  listDyeDispatchDocuments, isDyeRollAvailable, createDyeDispatchDocument, scanDyeDispatchRoll,
  saveDyeDispatchTransport, finishDyeDispatchDocument, type DyeOutputRoll, type DyeDispatchDocument } from '../../data/fcs/dyeing-task-domain.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { getCentralDyeFact, listCentralDyeFacts, assertCentralDyeActor, runCentralDyeCommand } from './dye-model.ts'

export type CentralDyeRollInput = Partial<Pick<DyeOutputRoll, 'id' | 'qty' | 'weightKg' | 'widthCm' | 'gsm' | 'vatNo' | 'remark'>>
const actorFact = (actor: FactoryPdaUser) => ({ userId: actor.userId, name: actor.name, factoryId: actor.factoryId })
async function revisionDigest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export function centralDyeOutput(orderId: string, factoryId: string) {
  return withWashingStaticRead(() => {
    const fact = getCentralDyeFact(orderId, factoryId)
    if (!fact) return undefined
    const documents = listDyeDispatchDocuments().filter(doc => doc.lines.some(line => line.orderId === orderId))
    const rolls = getDyeOutputRolls(orderId).map(roll => ({ ...roll,
      reservedBy: documents.find(doc => doc.status === '草稿' && doc.lines.some(line => line.orderId === orderId && line.rolls.some(item => item.id === roll.id)))?.id,
      canDispatch: isDyeRollAvailable(orderId, roll),
    }))
    let partner: ReturnType<typeof getDyeDispatchPartner> | undefined, partnerError = ''
    try { partner = getDyeDispatchPartner(orderId) } catch (error) { partnerError = error instanceof Error ? error.message : '' }
    return { fact, rolls, documents, available: getDyeDispatchAvailableQty(orderId),
      material: getDyeDispatchMaterial(orderId), partner, partnerError, defaults: getDyeOutputRollDefaults(orderId), isYarn: isDyeYarnOrder(fact.order) }
  })
}
export function centralDyeDispatch(id: string, factoryId: string) {
  return withWashingStaticRead(() => {
    const doc = listDyeDispatchDocuments().find(doc => doc.id === id)
    return doc?.lines.length && doc.lines.every(line => line.factoryId === factoryId && !!getCentralDyeFact(line.orderId, factoryId)) ? doc : undefined
  })
}
/** Ephemeral exact label content; only its digest goes into command intents. */
export function centralDyeLabelRevision(orderId: string, rollId: string, factoryId: string) {
  const state = centralDyeOutput(orderId, factoryId), roll = state?.rolls.find(row => row.id === rollId)
  return JSON.stringify(state && roll && [state.fact.order.dyeOrderNo, state.fact.order.qtyUnit, state.material,
    roll.barcode, roll.qty, roll.weightKg, roll.widthCm, roll.gsm, roll.vatNo, roll.remark])
}
export function resolveCentralDyeOutputScan(code: string, factoryId: string) {
  const value = code.trim()
  return listCentralDyeFacts(factoryId).flatMap(fact => {
    if (!withWashingStaticRead(() => getDyeOutputRolls(fact.order.dyeOrderId).some(roll => roll.barcode === value))) return []
    const state = centralDyeOutput(fact.order.dyeOrderId, factoryId)
    return state?.rolls.filter(roll => roll.barcode === value).map(roll => ({ orderId: fact.order.dyeOrderId, orderNo: fact.order.dyeOrderNo, roll })) || []
  })
}
function intent(actor: FactoryPdaUser, action: string, input: unknown) { return JSON.stringify({ action, actorId: actor.userId, input }) }
function assertDocument(docId: string, actor: FactoryPdaUser) {
  const doc = centralDyeDispatch(docId, actor.factoryId)
  if (!doc) throw new Error('DYE_OUTPUT_wrongDocument')
  for (const line of doc.lines) assertCentralDyeActor(line.orderId, actor)
  return doc
}

export async function saveCentralDyeRoll(orderId: string, input: CentralDyeRollInput, actor: FactoryPdaUser, operationId: string, expectedRevision?: string) {
  const digest = expectedRevision ? await revisionDigest(expectedRevision) : ''
  return runCentralDyeCommand(orderId, operationId, intent(actor, 'save-roll', { orderId, input, revision: digest }), () => {
    const order = assertCentralDyeActor(orderId, actor)
    if (isDyeYarnOrder(order)) throw new Error('DYE_OUTPUT_yarnSeparate')
    if (input.id && (!expectedRevision || centralDyeLabelRevision(orderId, input.id, actor.factoryId) !== expectedRevision)) throw new Error('CHANGED')
    const before = new Set(getDyeOutputRolls(orderId).map(roll => roll.id))
    const saved = saveDyeOutputRolls(orderId, [input], actorFact(actor))
    return saved.filter(roll => input.id ? roll.id === input.id : !before.has(roll.id)).map(roll => roll.id)
  })
}
export async function printCentralDyeRolls(orderId: string, rollIds: string[], actor: FactoryPdaUser, operationId: string, expectedRevisions: Record<string, string>) {
  const digest = await revisionDigest(expectedRevisions)
  return runCentralDyeCommand(orderId, operationId, intent(actor, 'print-rolls', { orderId, rollIds, revision: digest }), () => {
    assertCentralDyeActor(orderId, actor)
    if (rollIds.some(id => !expectedRevisions[id] || centralDyeLabelRevision(orderId, id, actor.factoryId) !== expectedRevisions[id])) throw new Error('CHANGED')
    markDyeOutputRolls(orderId, rollIds, 'print', actorFact(actor))
    return rollIds
  })
}
export async function deleteCentralDyeRoll(orderId: string, rollId: string, actor: FactoryPdaUser, operationId: string) {
  return runCentralDyeCommand(orderId, operationId, intent(actor, 'delete-roll', { orderId, rollId }), () => {
    assertCentralDyeActor(orderId, actor); deleteDyeOutputRolls(orderId, [rollId]); return rollId
  })
}
export async function stageCentralDyeRoll(orderId: string, rollId: string, actor: FactoryPdaUser, operationId: string) {
  return runCentralDyeCommand(orderId, operationId, intent(actor, 'stage-roll', { orderId, rollId }), () => {
    assertCentralDyeActor(orderId, actor); markDyeOutputRolls(orderId, [rollId], 'stage', actorFact(actor)); return rollId
  })
}
/** A barcode physically read on the PDA is added and verified in one action.
 * Selection from the roll list only creates the document; it does not fabricate a scan. */
export async function addCentralDyeDispatchRoll(orderId: string, rollId: string, actor: FactoryPdaUser,
  operationId: string, options: { docId?: string; scannedBarcode?: string } = {}) {
  if (options.docId) assertDocument(options.docId, actor)
  const target = options.docId ? [orderId, options.docId] : orderId
  return runCentralDyeCommand(target, operationId, intent(actor, 'add-dispatch-roll', { orderId, rollId, ...options }), () => {
    assertCentralDyeActor(orderId, actor)
    const doc = options.docId ? assertDocument(options.docId, actor) : undefined
    const existing = doc?.lines.find(line => line.orderId === orderId)?.rolls.find(roll => roll.id === rollId)
    const next = existing ? doc! : createDyeDispatchDocument([{ orderId, rollIds: [rollId] }], actor.name, options.docId, actorFact(actor))
    if (options.scannedBarcode !== undefined) {
      const roll = next.lines.find(line => line.orderId === orderId)?.rolls.find(roll => roll.id === rollId)
      if (!roll || roll.barcode !== options.scannedBarcode.trim()) throw new Error('DYE_OUTPUT_wrongRoll')
      scanDyeDispatchRoll(next.id, options.scannedBarcode, actor.name, actorFact(actor))
    }
    return next.id
  })
}
export async function scanCentralDyeDispatch(docId: string, barcode: string, actor: FactoryPdaUser, operationId: string) {
  assertDocument(docId, actor)
  const owner = docId
  return runCentralDyeCommand(owner, operationId, intent(actor, 'scan-dispatch', { docId, barcode }), () => {
    assertDocument(docId, actor); scanDyeDispatchRoll(docId, barcode, actor.name, actorFact(actor)); return barcode
  })
}
export async function confirmCentralDyeDispatch(docId: string, transport: DyeDispatchDocument['transport'], actor: FactoryPdaUser, operationId: string) {
  assertDocument(docId, actor)
  const owner = docId
  return runCentralDyeCommand(owner, operationId, intent(actor, 'confirm-dispatch', { docId, transport }), () => {
    const doc = assertDocument(docId, actor)
    if (!doc.lines.every(line => line.rolls.every(roll => doc.scans.some(scan => scan.barcode === roll.barcode)))) throw new Error('DYE_OUTPUT_scanRequired')
    saveDyeDispatchTransport(docId, transport, actorFact(actor))
    finishDyeDispatchDocument(docId, 'confirm', actorFact(actor))
    return docId
  })
}
export async function voidCentralDyeDispatch(docId: string, actor: FactoryPdaUser, operationId: string) {
  assertDocument(docId, actor)
  const owner = docId
  return runCentralDyeCommand(owner, operationId, intent(actor, 'void-dispatch', { docId }), () => {
    assertDocument(docId, actor); finishDyeDispatchDocument(docId, 'void', actorFact(actor)); return docId
  })
}
