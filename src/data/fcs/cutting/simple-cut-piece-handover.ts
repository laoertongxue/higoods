import { getOnboardingPpicOptionById } from '../factory-onboarding-ppic.ts'
import { getCurrentSewingPickupSlip } from '../sewing-pickup-slips.ts'
import { getBrowserLocalStorage } from '../../browser-storage.ts'
import { runCuttingEventAction } from './cutting-event-repository.ts'
import { validateReplacementFabricEventBatch } from './replacement-fabric-event-validation.ts'
import { loadReplacementFabricState } from './replacement-fabric-repository.ts'
import { replacementFabricBagTicket } from './mixed-transfer-bag-ticket.ts'
import { resolveDispatchTaskSheet, dispatchTaskSheetFingerprint, type DispatchTaskSheetData } from '../dispatch-task-sheet.ts'
import { listEffectiveTaskAssignments } from '../effective-task-assignments.ts'
import { getProductionOrderCutPieceParts } from '../production-order-tech-pack-runtime.ts'
import { DEDICATED_CUTTING_FACTORY_ID } from '../factory-mock-data.ts'
import { getSewingCutPieceResponsibilityProjection, initializeSewingCutPieceResponsibility, listSewingCutPieceHandoverEvents } from '../sewing-cut-piece-responsibility.ts'
import { listSpreadingResultGeneratedFeiTickets, type GeneratedFeiTicketSourceRecord } from './generated-fei-tickets.ts'
import { findCuttingSewingDispatchByFeiTicketNo } from './sewing-dispatch.ts'
import { resolveTransferBagCurrentUse } from './transfer-bag-operations.ts'
import { getSpecialCraftFeiTicketSummary } from './special-craft-fei-ticket-flow.ts'
import {
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, appendCuttingRuntimeEventIdempotentValidated,
  listCuttingRuntimeEvents, listSimpleCutPieceHandoverEvents,
  type SimpleCutPieceRequirementSnapshot, type SimpleCutPieceTicketSnapshot, type SimpleCutPieceHandoverPayload,
} from './cutting-runtime-event-ledger.ts'

export interface SimpleCutPieceHandoverActor {
  factoryId: string
  operatorId: string
  operatorName: string
  operatorRole: string
  source: 'WEB' | 'PDA'
}
export function assertSimpleCutPieceWarehouseActor(actor: SimpleCutPieceHandoverActor): void {
  if (actor.factoryId !== DEDICATED_CUTTING_FACTORY_ID
    || !['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CUTTING_WAREHOUSE', 'FACTORY_ADMIN', '仓管', '裁床仓管'].includes(actor.operatorRole)) {
    throw new Error('仅裁床待交出仓的仓管可以确认交出，请使用裁床仓管账号。')
  }
  if (!actor.operatorId.trim() || !actor.operatorName.trim()) throw new Error('请确认实际交出人后再提交。')
}
const key = (line: { skuCode: string; color: string; size: string; partCode: string }) =>
  [line.skuCode, line.color, line.size, line.partCode].join('::')
const sameText = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase()

export interface SimpleCutPieceSummaryLine extends SimpleCutPieceRequirementSnapshot {
  requiredPieceQty: number
  handedOverPieceQty: number
  availablePieceQty: number
  remainingPieceQty: number
}
export interface SimpleCutPieceHandoverPreview {
  sheet: DispatchTaskSheetData
  requirementSnapshotId: string
  requirementSnapshotAt: string
  requirements: SimpleCutPieceRequirementSnapshot[]
  lines: SimpleCutPieceSummaryLine[]
  tickets: SimpleCutPieceTicketSnapshot[]
  excluded: Array<{ feiTicketNo: string; reason: string }>
  blockingReasons: string[]
  totalRequiredPieceQty: number
  totalHandedOverPieceQty: number
  totalAvailablePieceQty: number
  totalRemainingPieceQty: number
  candidateFingerprint: string
}

/** Pure whole-ticket selection; counts never infer assignment from color alone. */
export function selectSimpleCutPieceTickets(input: {
  sheet: DispatchTaskSheetData
  requirements: SimpleCutPieceRequirementSnapshot[]
  tickets: GeneratedFeiTicketSourceRecord[]
  handedOver: Map<string, number>
  consumedIds: Set<string>
  occupiedIds: Set<string>
  occupiedBagNumbers?: Map<string, string>
  unavailableReasons: Map<string, string>
  ambiguousSkuCodes: Set<string>
  legacyQuantityWithoutTickets: boolean
}) {
  const selected: SimpleCutPieceTicketSnapshot[] = []
  const excluded: SimpleCutPieceHandoverPreview['excluded'] = []
  const allocated = new Map(input.sheet.assignment.skuLines.map((line) => [line.skuCode, line]))
  const requirements = new Map(input.requirements.map((line) => [key(line), line]))
  const running = new Map(input.handedOver)
  for (const ticket of [...input.tickets].sort((a, b) => a.feiTicketNo.localeCompare(b.feiTicketNo))) {
    if (ticket.productionOrderId !== input.sheet.assignment.productionOrderId) continue
    let reason = ''
    const sku = allocated.get(ticket.skuCode)
    const identity = { skuCode: ticket.skuCode, color: sku?.color || ticket.skuColor, size: sku?.size || ticket.skuSize, partCode: ticket.partCode }
    const requirement = requirements.get(key(identity))
    const qty = ticket.actualCutPieceQty
    if (!sku || !sameText(sku.color, ticket.skuColor) || !sameText(sku.size, ticket.skuSize)) reason = '不属于本工厂分配的 SKU / 颜色 / 尺码'
    else if (input.consumedIds.has(ticket.feiTicketId)) reason = '已交出，不可重复交出'
    else if (input.legacyQuantityWithoutTickets) reason = '本任务存在未对应菲票的历史实交，请主管先核对历史交出范围'
    else if (input.ambiguousSkuCodes.has(ticket.skuCode)) reason = '同一 SKU 分给多个任务，现有编号范围不能唯一确定本票归属，请计划人员核对'
    else if (ticket.sourceBasisType !== 'ACTUAL_CUTTING_OUTPUT' && ticket.sourceBasisType !== 'SPREADING_RESULT') reason = '尚无有效的实际裁剪完成来源'
    else if (ticket.printStatus === 'VOIDED') reason = '菲票已作废'
    else if (!Number.isInteger(qty) || qty <= 0 || !ticket.sourceOutputLineId) reason = '实际裁剪片数或产出来源不完整'
    else if (!requirement) reason = '未在当前任务冻结部位中找到本票，请核对技术资料'
    else if (input.occupiedIds.has(ticket.feiTicketId)) reason = `已装入中转袋${input.occupiedBagNumbers?.get(ticket.feiTicketId) ? ` ${input.occupiedBagNumbers.get(ticket.feiTicketId)}` : ''}，请按中转袋交出流程处理`
    else if (input.unavailableReasons.has(ticket.feiTicketId)) reason = input.unavailableReasons.get(ticket.feiTicketId)!
    else if (qty + (running.get(key(identity)) || 0) > requirement.allocatedGarmentQty * requirement.piecesPerGarment) reason = '整票超过本任务该 SKU / 部位剩余应交量，请主管核对；不能直接拆票交出'
    if (reason) { excluded.push({ feiTicketNo: ticket.feiTicketNo, reason }); continue }
    selected.push({ feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo,
      sourceOutputLineId: ticket.sourceOutputLineId, cutOrderId: ticket.cutOrderId, cutOrderNo: ticket.cutOrderNo,
      ...identity, partName: requirement!.partName, pieceRange: ticket.pieceSequenceLabel || ticket.pieceSetNoRange || '原票未维护编号范围', pieceQty: qty, unit: '片' })
    running.set(key(identity), (running.get(key(identity)) || 0) + qty)
  }
  return { tickets: selected, excluded }
}

export function resolveSimpleCutPieceHandover(raw: string): SimpleCutPieceHandoverPreview {
  const sheet = resolveDispatchTaskSheet(raw)
  if (!sheet.supportsCutPieceHandover) throw new Error('简易裁片交出仅用于独立车缝、车缝+烫包任务；三合一任务请到面辅料仓接收。')
  if (!sheet.ppicId || !sheet.ppicName) throw new Error('任务尚未确定有效 PPIC，请计划人员补齐后重新打印。')
  if (getOnboardingPpicOptionById(sheet.ppicId)?.status !== '启用') throw new Error('当前 PPIC 已停用，请计划人员重新安排后打印。')
  const { assignment } = sheet
  getCurrentSewingPickupSlip(assignment.assignmentId, 'CUT_PIECE') // Hydrate historical handovers before computing remaining quantities.
  let context
  try { context = getSewingCutPieceResponsibilityProjection(assignment.assignmentId).context } catch {
    const parts = getProductionOrderCutPieceParts(assignment.productionOrderId)
    const requirements = assignment.skuLines.flatMap((sku) => parts.filter((part) =>
      (!part.applicableColorList.length || part.applicableColorList.some((color) => sameText(color, sku.color)))
      && (!part.applicableSizeList.length || part.applicableSizeList.some((size) => sameText(size, sku.size))))
      .map((part) => ({ skuCode: sku.skuCode, color: sku.color, size: sku.size, partCode: part.partCode,
        partName: part.partNameCn, piecesPerGarment: part.pieceCountPerGarment, allocatedGarmentQty: sku.qty })))
    context = initializeSewingCutPieceResponsibility({ assignmentId: assignment.assignmentId,
      requirementSnapshotId: sheet.techPack?.snapshotId || `TASK-REQUIREMENTS-${assignment.assignmentId}`,
      requirementSnapshotAt: assignment.businessAssignedAt, requirementSnapshotBy: '分配技术资料', requirementLines: requirements })
  }
  const requirements = context.requirementLines
  const events = listCuttingRuntimeEvents()
  const simpleEvents = listSimpleCutPieceHandoverEvents()
  const allHandover = listSewingCutPieceHandoverEvents(assignment.assignmentId).filter((event) => event.status === 'CONFIRMED')
  const handedOver = new Map<string, number>()
  allHandover.forEach((event) => event.lines.forEach((line) => handedOver.set(key(line), (handedOver.get(key(line)) || 0) + line.pieceQty)))
  const consumedIds = new Set(simpleEvents.flatMap((event) => event.payload.tickets.map((ticket) => ticket.feiTicketId)))
  events.filter((event) => event.eventType === '新增交出记录' && event.eventStatus !== '已取消')
    .forEach((event) => event.refs.feiTicketIds?.forEach((id) => consumedIds.add(id)))
  const occupiedIds = new Set<string>()
  const occupiedBagNumbers = new Map<string, string>()
  const bagCodes = new Set(events.flatMap((event) => [event.refs.transferBagCode || '', ...(event.refs.transferBagCodes || [])]).filter(Boolean))
  for (const bagCode of bagCodes) {
    const use = resolveTransferBagCurrentUse(bagCode)
    use.tickets.forEach((ticket) => { occupiedIds.add(ticket.feiTicketId); occupiedBagNumbers.set(ticket.feiTicketId, bagCode) })
  }
  const tickets = listSpreadingResultGeneratedFeiTickets().filter((ticket) => ticket.productionOrderId === assignment.productionOrderId)
  const unavailableReasons = new Map<string, string>()
  tickets.forEach((ticket) => {
    const dispatch = findCuttingSewingDispatchByFeiTicketNo(ticket.feiTicketNo)
    if (['已交出', '已回写', '差异', '异议中'].includes(dispatch.feiTicketSewingStatus)) consumedIds.add(ticket.feiTicketId)
    else if (dispatch.transferBag) { occupiedIds.add(ticket.feiTicketId); occupiedBagNumbers.set(ticket.feiTicketId, dispatch.transferBag.transferBagNo) }
    const craft = getSpecialCraftFeiTicketSummary(ticket.feiTicketNo)
    if ((ticket.hasSpecialCraft || craft.needSpecialCraft) && craft.returnStatus !== '已回仓') unavailableReasons.set(ticket.feiTicketId, '特殊工艺尚未全部回仓')
    else if (craft.needSpecialCraft && craft.currentQty !== ticket.actualCutPieceQty) unavailableReasons.set(ticket.feiTicketId, '特殊工艺回仓数量有差异，请主管先核对菲票实际数量')
  })
  const otherAssignments = listEffectiveTaskAssignments().filter((item) => item.assignmentId !== assignment.assignmentId
    && item.status === 'EFFECTIVE' && item.productionOrderId === assignment.productionOrderId
    && item.processCodes.some((code) => ['SEW', 'SEWING', 'PROC_SEW'].includes(code)))
  const ambiguousSkuCodes = new Set(otherAssignments.flatMap((item) => item.skuLines.map((line) => line.skuCode)))
  const knownRecordIds = new Set(simpleEvents.map((event) => event.payload.handoverRecordId))
  const legacyQuantityWithoutTickets = allHandover.some((event) => !knownRecordIds.has(event.handoverRecordId)
    && !events.some((fact) => fact.refs.handoverRecordId === event.handoverRecordId && fact.refs.feiTicketIds?.length))
  const selection = selectSimpleCutPieceTickets({ sheet, requirements, tickets, handedOver, consumedIds, occupiedIds, occupiedBagNumbers, unavailableReasons, ambiguousSkuCodes, legacyQuantityWithoutTickets })
  const lines = requirements.map((line) => ({ ...line, requiredPieceQty: line.allocatedGarmentQty * line.piecesPerGarment,
    handedOverPieceQty: handedOver.get(key(line)) || 0,
    availablePieceQty: selection.tickets.filter((ticket) => key(ticket) === key(line)).reduce((sum, ticket) => sum + ticket.pieceQty, 0),
    remainingPieceQty: Math.max(0, line.allocatedGarmentQty * line.piecesPerGarment - (handedOver.get(key(line)) || 0)) }))
  const blockingReasons = legacyQuantityWithoutTickets ? ['历史实交尚未对应菲票，请主管核对后再交出。'] : []
  return { sheet, requirementSnapshotId: context.requirementSnapshotId, requirementSnapshotAt: context.requirementSnapshotAt,
    requirements, lines, ...selection, blockingReasons,
    totalRequiredPieceQty: lines.reduce((sum, line) => sum + line.requiredPieceQty, 0),
    totalHandedOverPieceQty: lines.reduce((sum, line) => sum + line.handedOverPieceQty, 0),
    totalAvailablePieceQty: selection.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0),
    totalRemainingPieceQty: lines.reduce((sum, line) => sum + line.remainingPieceQty, 0),
    candidateFingerprint: dispatchTaskSheetFingerprint(JSON.stringify(selection.tickets)), }
}

// A same-origin Web Lock closes the check/write gap between two browser tabs.
// The synchronous fallback supports environments without Web Locks; no offline queue is introduced.
export async function confirmSimpleCutPieceHandover(input: {
  taskSheetNo: string; candidateFingerprint: string; commandId: string; actor: SimpleCutPieceHandoverActor
  replacementFabricTicketIds?: string[]
}) {
  assertSimpleCutPieceWarehouseActor(input.actor)
  if (!input.commandId.trim()) throw new Error('本次确认编号缺失，请重新读取任务单。')
  const replacementTickets = input.replacementFabricTicketIds?.length
    ? (await loadReplacementFabricState()).tickets.filter(ticket => input.replacementFabricTicketIds!.includes(ticket.id)).map(replacementFabricBagTicket) : []
  if (replacementTickets.length !== (input.replacementFabricTicketIds || []).length) throw new Error('换片布票不存在或重复，请重新扫描。')
  const commit = () => {
    const storage = getBrowserLocalStorage()
    if (!storage?.setItem) throw new Error('尚未保存：浏览器存储不可用，请恢复后重试。')
    const saved = listSimpleCutPieceHandoverEvents(storage).find((event) => event.idempotencyKey === input.commandId)
    if (saved) {
      if (saved.payload.taskSheetNo !== input.taskSheetNo) throw new Error('确认编号已用于另一任务，请重新读取。')
      return { event: saved, appended: false }
    }
    const rawLedger = storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
    if (rawLedger) {
      try { if (!Array.isArray(JSON.parse(rawLedger).events)) throw new Error() } catch { throw new Error('尚未保存：现有交出记录无法读取，请联系主管恢复记录。') }
    }
    const preview = resolveSimpleCutPieceHandover(input.taskSheetNo)
    if (preview.blockingReasons.length) throw new Error(preview.blockingReasons[0])
    if (preview.candidateFingerprint !== input.candidateFingerprint) throw new Error('可交菲票已变化，请重新读取任务单并核对清单。')
    if (!preview.tickets.length) throw new Error('当前没有可交出的裁片，请查看排除原因或等待裁剪完成。')
    const { sheet } = preview
    const now = new Date().toISOString()
    const suffix = dispatchTaskSheetFingerprint(input.commandId)
    const orderId = `SIMPLE-ORDER-${dispatchTaskSheetFingerprint(sheet.assignment.assignmentId)}`
    const recordId = `SIMPLE-RECORD-${suffix}`
    const payload: SimpleCutPieceHandoverPayload = {
      replacementFabricTickets: replacementTickets,
      schemaVersion: 1, assignmentId: sheet.assignment.assignmentId, runtimeTaskId: sheet.assignment.runtimeTaskId,
      taskNo: sheet.taskNo, taskSheetNo: sheet.taskSheetNo, taskSheetVersion: sheet.version, taskTypeLabel: sheet.taskTypeLabel,
      productionOrderId: sheet.assignment.productionOrderId, productionOrderNo: sheet.productionOrderNo,
      styleCode: sheet.styleCode, styleName: sheet.styleName, styleImageUrl: sheet.styleImageUrl,
      factoryId: sheet.assignment.factoryId, factoryName: sheet.assignment.factoryName, ppicId: sheet.ppicId, ppicName: sheet.ppicName,
      warehouseFactoryId: input.actor.factoryId, handoverOrderId: orderId, handoverOrderNo: orderId,
      handoverRecordId: recordId, handoverRecordNo: `JYJC-${suffix}`,
      requirementSnapshotId: preview.requirementSnapshotId, requirementSnapshotAt: preview.requirementSnapshotAt,
      skuLines: sheet.assignment.skuLines.map((line) => ({ ...line })), requirements: preview.requirements.map((line) => ({ ...line })),
      previousHandedOverLines: preview.lines.filter((line) => line.handedOverPieceQty > 0).map((line) => ({ skuCode: line.skuCode, color: line.color, size: line.size, partCode: line.partCode, partName: line.partName, pieceQty: line.handedOverPieceQty })),
      tickets: preview.tickets, totalPieceQty: preview.totalAvailablePieceQty, receiptStatus: 'RECEIVED', confirmationBasis: 'WAREHOUSE_CONFIRMATION',
    }
    return appendCuttingRuntimeEventIdempotentValidated(() => ({
      eventType: '简易裁片交出', idempotencyKey: input.commandId, eventSource: input.actor.source, eventStatus: '已同步',
      occurredAt: now, operatorId: input.actor.operatorId, operatorName: input.actor.operatorName, operatorRole: input.actor.operatorRole,
      refs: { productionOrderId: payload.productionOrderId, productionOrderNo: payload.productionOrderNo,
        handoverOrderId: orderId, handoverRecordId: recordId, sewingTaskIds: [payload.runtimeTaskId], sewingTaskNos: [payload.taskNo],
        feiTicketIds: [...payload.tickets, ...replacementTickets].map((ticket) => ticket.feiTicketId), feiTicketNos: [...payload.tickets, ...replacementTickets].map((ticket) => ticket.feiTicketNo) },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'OUT', qty: payload.totalPieceQty, unit: '片' }, payload,
    }), () => {
      const current = resolveSimpleCutPieceHandover(input.taskSheetNo)
      if (current.candidateFingerprint !== input.candidateFingerprint) throw new Error('菲票状态已变化，请重新核对。')
    }, storage)
  }
  const save = () => typeof document === 'undefined' ? commit() : runCuttingEventAction({
    id: input.commandId, intent: JSON.stringify(['simple-cut-piece', input]), action: commit, validate: validateReplacementFabricEventBatch,
  })
  if (typeof window !== 'undefined' && window.navigator?.locks) return window.navigator.locks.request('higood-cut-piece-handover', save)
  return save()
}
