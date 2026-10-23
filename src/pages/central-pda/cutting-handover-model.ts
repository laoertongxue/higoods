import { DEDICATED_CUTTING_FACTORY_ID } from '../../data/fcs/factory-mock-data.ts'
import { readFactoryPdaExecutionUsers, findFactoryPdaRoleById, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { resolveSimpleCutPieceHandover, confirmSimpleCutPieceHandover, type SimpleCutPieceHandoverPreview } from '../../data/fcs/cutting/simple-cut-piece-handover.ts'
import { listSimpleCutPieceHandoverEvents } from '../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { assertCentralCuttingActor, prepareCentralCutting } from './cutting-model.ts'
import { readReplacementFabricState } from '../../data/fcs/cutting/replacement-fabric-repository.ts'
import { resolveReplacementFabricTaskContext } from '../../data/fcs/cutting/replacement-fabric-source.ts'
import { evaluateReplacementFabricCoverage, parseReplacementTicketCode, replacementTicketCode } from '../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { resolveReplacementFabricScanFromCurrent } from '../../data/fcs/cutting/replacement-fabric-scan.ts'

export async function prepareCentralSimpleHandout() {
  // The Web task-sheet and wait-handover entries publish these same fixed
  // prototype sources. Registration is read-only; no receipt is pre-confirmed.
  const sources = await import('../../data/fcs/cutting/simple-cut-piece-handover-fixtures.ts')
  sources.ensureSimpleCutPieceHandoverFixtures()
  await prepareCentralCutting()
}

export function centralCutPieceActor(actor: FactoryPdaUser) {
  assertCentralCuttingActor(actor)
  const current = readFactoryPdaExecutionUsers(actor.factoryId).find(user => user.userId === actor.userId)
  if (!current || current.factoryId !== DEDICATED_CUTTING_FACTORY_ID || current.name !== actor.name) throw new Error('CUT_actor')
  const name = findFactoryPdaRoleById(current.roleId, current.factoryId)?.roleName || current.roleName || current.roleId
  const role = /仓管|仓库/.test(name) ? 'WAREHOUSE' : current.roleId === 'ROLE_ADMIN' ? 'FACTORY_ADMIN' : current.roleId
  return { factoryId: current.factoryId, operatorId: current.userId, operatorName: current.name, operatorRole: role, source: 'PDA' as const }
}

export function readCentralSimpleHandout(raw: string, actor: FactoryPdaUser, replacementIds: string[] = []) {
  centralCutPieceActor(actor)
  const preview = resolveSimpleCutPieceHandover(raw)
  const records = listSimpleCutPieceHandoverEvents().filter(event => event.payload.warehouseFactoryId === actor.factoryId
    && event.payload.assignmentId === preview.sheet.assignment.assignmentId && event.eventStatus !== '已取消')
  const state = readReplacementFabricState(), context = resolveReplacementFabricTaskContext(preview.sheet)
  const tickets = replacementIds.flatMap(id => state.tickets.filter(ticket => ticket.id === id))
  const validTicketIds = tickets.filter(ticket => {
    try {
      resolveReplacementFabricScanFromCurrent(replacementTicketCode(ticket), preview.sheet.assignment.productionOrderId)
      return ticket.cuttingFactoryId === actor.factoryId && context.requiredMaterials.some(material => material.key === ticket.material.key)
    } catch { return false }
  }).map(ticket => ticket.id)
  const valid = new Set(replacementIds).size === replacementIds.length && validTicketIds.length === replacementIds.length
  return { preview, records, replacement: { context, tickets, validTicketIds, valid, coverage: evaluateReplacementFabricCoverage(context, state.receipts, tickets) } }
}
export type CentralSimpleHandoutSource = ReturnType<typeof readCentralSimpleHandout>
export function centralSimpleHandoutSnapshot(preview: SimpleCutPieceHandoverPreview) {
  return JSON.stringify({ sheet: preview.sheet.taskSheetNo, assignment: preview.sheet.assignment.assignmentId,
    requirement: preview.requirementSnapshotId, requirements: preview.requirements, candidates: preview.candidateFingerprint,
    tickets: preview.tickets, previous: preview.totalHandedOverPieceQty, remaining: preview.totalRemainingPieceQty, blocking: preview.blockingReasons })
}
export const isCentralReplacementCode = (raw: string) => !!parseReplacementTicketCode(raw) || raw.startsWith('HPB/')
export function scanCentralReplacementFabric(raw: string, source: CentralSimpleHandoutSource, actor: FactoryPdaUser) {
  centralCutPieceActor(actor)
  const ticket = resolveReplacementFabricScanFromCurrent(raw, source.preview.sheet.assignment.productionOrderId)
  if (ticket.cuttingFactoryId !== actor.factoryId || !source.replacement.context.requiredMaterials.some(material => material.key === ticket.material.key)) throw new Error('CUT_replacementWrong')
  return ticket
}
export const centralSimpleHandoutSourceSnapshot = (source: CentralSimpleHandoutSource) => JSON.stringify([
  centralSimpleHandoutSnapshot(source.preview), source.replacement.context, source.replacement.tickets,
  [...source.replacement.coverage.previous], source.replacement.valid,
])
export function centralSimpleHandoutInput(source: CentralSimpleHandoutSource, actor: FactoryPdaUser, commandId: string) {
  if (!source.preview.tickets.length || source.preview.blockingReasons.length) throw new Error('CUT_noHandout')
  if (!source.replacement.valid) throw new Error('CUT_changed')
  if (!source.replacement.coverage.allowed) throw new Error('CUT_replacementMissing')
  return { taskSheetNo: source.preview.sheet.taskSheetNo, candidateFingerprint: source.preview.candidateFingerprint,
    commandId, actor: centralCutPieceActor(actor), replacementFabricTicketIds: source.replacement.tickets.map(ticket => ticket.id),
    expectedSource: centralSimpleHandoutSourceSnapshot(source) }
}
export type CentralSimpleHandoutInput = ReturnType<typeof centralSimpleHandoutInput>
export async function saveCentralSimpleHandout(input: CentralSimpleHandoutInput, actor: FactoryPdaUser) {
  const assertCurrent = () => {
    if (JSON.stringify(centralCutPieceActor(actor)) !== JSON.stringify(input.actor)) throw new Error('CUT_actor')
    const current = readCentralSimpleHandout(input.taskSheetNo, actor, input.replacementFabricTicketIds)
    if (centralSimpleHandoutSourceSnapshot(current) !== input.expectedSource) throw new Error('CUT_changed')
  }
  centralCutPieceActor(actor)
  await prepareCentralCutting()
  // The original command replays an already committed confirmation before checking
  // current candidates. Its durable intent remains identical on a readback retry.
  return confirmSimpleCutPieceHandover({ taskSheetNo: input.taskSheetNo, candidateFingerprint: input.candidateFingerprint,
    commandId: input.commandId, actor: input.actor, replacementFabricTicketIds: input.replacementFabricTicketIds }, { assertCurrent })
}
