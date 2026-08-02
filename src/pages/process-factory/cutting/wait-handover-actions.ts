import {
  listSpreadingResultGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import { validateFeiTicketNumberingBeforeBagging } from '../../../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  listCuttingRuntimeEvents,
  type RuntimeWarehouseLocationRef,
  type TransferBagTicketFactSnapshot,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { FeiTicketSewingAssignment } from '../../../data/fcs/cutting/sewing-dispatch.ts'
import {
  ensureTransferBagAvailableForUse,
  isCompleteSuccessfulWholeBagHandoverEvent,
  recoverThenScrapTransferBag,
  recoverTransferBag,
  resolveTransferBagCurrentUse,
  resolveWholeBagHandoverEligibility,
  submitSpecialCraftBagReturn,
  submitTransferBagRepack,
  submitTransferBagScrap,
  submitWholeBagHandover,
  type TransferBagCurrentUse,
} from '../../../data/fcs/cutting/transfer-bag-operations.ts'
import {
  appendWaitHandoverBaggingEvent,
  appendWaitHandoverInboundEvent,
  buildWaitHandoverRuntimeTicketFromGeneratedTicket,
  resolveWaitHandoverBaggingSnapshot,
} from './wait-handover-runtime.ts'
import {
  renderWaitHandoverActionButtons,
  renderWaitHandoverActionDialog,
  type WaitHandoverActionDialogModel,
  type WaitHandoverDialogCurrent,
  type WaitHandoverWebAction,
} from './wait-handover-dialogs.ts'

export type { WaitHandoverWebAction } from './wait-handover-dialogs.ts'
export { renderWaitHandoverActionButtons }

export interface WaitHandoverHandoverCandidate {
  value: string
  bagCode: string
  handoverOrderId: string
  handoverOrderNo: string
  assignments: FeiTicketSewingAssignment[]
  submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
}

export interface WaitHandoverSpecialCraftReturnCandidate {
  value: string
  sourceHandoverRecordId: string
  bagCode: string
  returnedTicketIds: string[]
}

export interface WaitHandoverActionAdapter {
  getHandoverCandidates(): WaitHandoverHandoverCandidate[]
  getSpecialCraftReturnCandidates(): WaitHandoverSpecialCraftReturnCandidate[]
  resolveLocation(warehouseArea: string, locationCode: string): RuntimeWarehouseLocationRef | null
  renderWorkbenchData(): string
  hydrateRegion?(region: Element): void
}

const submitLocks = new WeakSet<HTMLElement>()
let actionAdapter: WaitHandoverActionAdapter | null = null

export function configureWaitHandoverActionAdapter(adapter: WaitHandoverActionAdapter): void {
  actionAdapter = adapter
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function splitCodes(value: string): string[] {
  return unique(value.split(/[\s,，、;；\n\r]+/))
}

function collectCurrentBagCodes(): string[] {
  const bagCodes: string[] = []
  listCuttingRuntimeEvents().forEach((event) => {
    if (event.eventStatus === '已取消') return
    bagCodes.push(event.refs.transferBagCode || '', ...(event.refs.transferBagCodes || []))
    const payload = event.payload as unknown as Record<string, unknown>
    bagCodes.push(String(payload.bagCode || ''), String(payload.transferBagCode || ''))
    for (const key of ['sourceBags', 'resultBags', 'transferBagUses']) {
      const records = Array.isArray(payload[key]) ? payload[key] as Array<Record<string, unknown>> : []
      records.forEach((record) => bagCodes.push(String(record.bagCode || '')))
    }
  })
  return unique(bagCodes)
}

function statusLabel(current: TransferBagCurrentUse): { main: string; stage: string } {
  const main = current.mainStatus === 'IDLE' ? '空闲' : current.mainStatus === 'DISABLED' ? '已报废' : '使用中'
  const stage = current.flowStage === 'PACKED' ? '菲票已装袋'
    : current.flowStage === 'INBOUND_STORED' ? '入仓暂存中'
      : current.flowStage === 'READY_HANDOVER' ? '待交出'
        : current.flowStage === 'HANDED_OVER_WAITING_RETURN' ? '已交出待回收' : ''
  return { main, stage }
}

function latestHandoverSummary(current: TransferBagCurrentUse): string {
  if (!current.latestHandoverEventId) return ''
  const event = listCuttingRuntimeEvents().find((item) => item.eventId === current.latestHandoverEventId)
  if (!event) return current.latestHandoverEventId
  const payload = event.payload as unknown as Record<string, unknown>
  return `${String(payload.handoverRecordNo || event.eventId)} / ${String(payload.receiverName || '接收方待核对')} / ${event.occurredAt}`
}

function dialogCurrent(current: TransferBagCurrentUse | null): WaitHandoverDialogCurrent | null {
  if (!current) return null
  const labels = statusLabel(current)
  return {
    bagCode: current.bagCode,
    productionOrderNo: current.productionOrderNo,
    mainStatusLabel: labels.main,
    flowStageLabel: labels.stage,
    tickets: current.tickets.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      productionOrderNo: ticket.productionOrderNo,
      receiverFactoryName: ticket.receiverFactoryName,
      pieceQty: ticket.pieceQty,
    })),
    compatibilityBlockedReason: current.compatibilityBlockedReason || '',
    latestHandoverSummary: latestHandoverSummary(current),
  }
}

function generatedTicketLabel(ticket: GeneratedFeiTicketSourceRecord): string {
  return `${ticket.feiTicketNo} / ${ticket.productionOrderNo} / ${ticket.skuColor} / ${ticket.skuSize} / ${ticket.partName} / ${ticket.actualCutPieceQty || ticket.qty} 片`
}

function buildModel(action: WaitHandoverWebAction, bagCode = ''): WaitHandoverActionDialogModel {
  const current = bagCode ? resolveTransferBagCurrentUse(bagCode) : null
  const currentUses = collectCurrentBagCodes().map((code) => resolveTransferBagCurrentUse(code))
  const activeTicketIds = new Set(currentUses.flatMap((item) => item.tickets.map((ticket) => ticket.feiTicketId)))
  const ticketOptions = listSpreadingResultGeneratedFeiTickets()
    .filter((ticket) => ticket.printStatus !== 'VOIDED')
    .filter((ticket) => !activeTicketIds.has(ticket.feiTicketId))
    .filter((ticket) => validateFeiTicketNumberingBeforeBagging(ticket).ok)
    .slice(0, 20)
    .map((ticket) => ({ value: ticket.feiTicketId, label: generatedTicketLabel(ticket) }))
  const repackSources = currentUses
    .filter((item) => ['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(item.flowStage || ''))
    .filter((item) => item.tickets.length > 0)
    .slice(0, 20)
    .map((item) => ({
      value: item.bagCode,
      label: `${item.bagCode} / ${item.productionOrderNo} / ${item.tickets.length} 张 / ${item.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)} 片${item.compatibilityBlockedReason ? ' / 待主管核查' : ''}`,
      disabled: Boolean(item.compatibilityBlockedReason),
    }))
  const handoverCandidates = actionAdapter?.getHandoverCandidates() || []
  const specialReturns = actionAdapter?.getSpecialCraftReturnCandidates() || []
  return {
    current: dialogCurrent(current),
    ticketOptions,
    repackSources,
    handoverOptions: handoverCandidates.map((item) => {
      const factories = unique(item.assignments.map((assignment) => assignment.receiverFactoryName))
      const tasks = unique(item.assignments.map((assignment) => assignment.sewingTaskNo))
      return { value: item.value, label: `${item.bagCode} / ${tasks.join('、')} / ${factories.join('、')}` }
    }),
    specialCraftReturnOptions: specialReturns.map((item) => ({ value: item.value, label: `${item.bagCode} / ${item.sourceHandoverRecordId} / ${item.returnedTicketIds.length} 张菲票` })),
    recoveryNodeOptions: ['裁床待交出仓', '后道工厂空袋回收区'],
    locationOptions: [],
    feedback: '',
    error: '',
    repackBatchId: `WEB-REPACK-${Date.now()}`,
  }
}

function modalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById('cutting-wait-handover-web-action-modal')
}

export function openWaitHandoverAction(action: WaitHandoverWebAction, bagCode = ''): void {
  if (typeof document === 'undefined') return
  modalRoot()?.remove()
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', renderWaitHandoverActionDialog({ action, bagCode, model: buildModel(action, bagCode) }))
  const modal = modalRoot()
  if (modal) {
    modal.dataset.operationKey = `${action}:${Date.now()}`
    const icons = (window as unknown as { lucide?: { createIcons(options?: { attrs?: Record<string, string>; nameAttr?: string }): void } }).lucide
    if (icons) icons.createIcons({ attrs: { 'aria-hidden': 'true' } })
  }
}

function readField(dialog: ParentNode, name: string): string {
  return dialog.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-wait-handover-field="${name}"]`)?.value.trim() || ''
}

function readChecked(dialog: ParentNode, name: string): boolean {
  return Boolean(dialog.querySelector<HTMLInputElement>(`[data-wait-handover-field="${name}"]`)?.checked)
}

function readRadio(dialog: ParentNode, name: string): string {
  return dialog.querySelector<HTMLInputElement>(`[data-wait-handover-field="${name}"]:checked`)?.value || ''
}

function readMulti(dialog: ParentNode, name: string): string[] {
  const select = dialog.querySelector<HTMLSelectElement>(`select[data-wait-handover-field="${name}"]`)
  if (!select) return []
  return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean)
}

function operator(dialog: ParentNode, role: string) {
  const operatorName = readField(dialog, 'operatorName') || '裁片仓操作员'
  return { operatorName, operatorRole: role }
}

function showFeedback(dialog: ParentNode, message: string, error = false): void {
  const region = dialog.querySelector<HTMLElement>('[data-wait-handover-feedback]')
  if (!region) {
    if (error && typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message)
    return
  }
  region.textContent = message
  region.className = `mt-4 rounded-lg border p-3 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`
  region.scrollIntoView({ block: 'nearest' })
}

function refreshWorkbenchData(): void {
  if (typeof document === 'undefined' || !actionAdapter || typeof document.querySelector !== 'function') return
  const current = document.querySelector<HTMLElement>('[data-wait-handover-workbench-data]')
  if (!current) return
  const template = document.createElement('template')
  template.innerHTML = actionAdapter.renderWorkbenchData().trim()
  const next = template.content.querySelector<HTMLElement>('[data-wait-handover-workbench-data]')
  if (!next) return
  current.replaceWith(next)
  actionAdapter.hydrateRegion?.(next)
}

function findGeneratedTickets(dialog: ParentNode): GeneratedFeiTicketSourceRecord[] {
  const selected = readField(dialog, 'feiTicketId')
  const codes = splitCodes(readField(dialog, 'ticketScanInput'))
  const all = listSpreadingResultGeneratedFeiTickets()
  const requested = unique([selected, ...codes])
  return requested.map((code) => all.find((ticket) => [ticket.feiTicketId, ticket.feiTicketNo].includes(code)))
    .filter((ticket): ticket is GeneratedFeiTicketSourceRecord => Boolean(ticket))
}

function submitBagging(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'bagCode')
  if (!bagCode) throw new Error('请扫描或输入中转袋编号。')
  const tickets = findGeneratedTickets(dialog)
  if (!tickets.length) throw new Error('请选择或扫描可装袋菲票。')
  tickets.forEach((ticket) => {
    const numbering = validateFeiTicketNumberingBeforeBagging(ticket)
    if (!numbering.ok) throw new Error(numbering.reason)
  })
  const forceReason = readField(dialog, 'forceRecoveryReason')
  ensureTransferBagAvailableForUse({
    bagCode,
    forceRecovery: forceReason ? {
      physicalBagReceived: readChecked(dialog, 'physicalBagReceived'),
      physicalBagEmpty: readChecked(dialog, 'physicalBagEmpty'),
      recoveryNode: '裁床待交出仓',
      recoveryLocation: '装袋操作区',
      reason: forceReason,
      operator: operator(dialog, '裁片仓装袋员'),
      source: 'WEB',
    } : undefined,
  })
  appendWaitHandoverBaggingEvent({
    source: 'WEB',
    operator: operator(dialog, '裁片仓装袋员'),
    bagCode,
    tickets: tickets.map(buildWaitHandoverRuntimeTicketFromGeneratedTicket),
    idempotencyKey: `web:${modalRoot()?.dataset?.operationKey || bagCode}:bagging`,
  })
  return '装袋成功，请继续中转袋入仓。'
}

function submitInbound(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'bagCode')
  if (!bagCode) throw new Error('请扫描或输入中转袋编号。')
  const warehouseArea = readField(dialog, 'warehouseArea')
  const locationCode = readField(dialog, 'locationCode')
  const locationRef = actionAdapter?.resolveLocation(warehouseArea, locationCode)
  if (!locationRef) throw new Error('库区或库位不存在、已停用或编号不唯一，请重新确认。')
  const specialValue = readField(dialog, 'specialCraftSource')
  if (specialValue) {
    const candidate = actionAdapter?.getSpecialCraftReturnCandidates().find((item) => item.value === specialValue)
    if (!candidate || candidate.bagCode !== bagCode) throw new Error('特殊工艺来源记录与中转袋不一致，请重新扫描。')
    const returnedTicketIds = splitCodes(readField(dialog, 'returnedTicketIds'))
    submitSpecialCraftBagReturn({
      sourceHandoverRecordId: candidate.sourceHandoverRecordId,
      bagCode,
      returnedTicketIds: returnedTicketIds.length ? returnedTicketIds : candidate.returnedTicketIds,
      locationRef,
      operator: operator(dialog, '特殊工艺回仓员'),
      source: 'WEB',
    })
    return '特殊工艺带袋回仓成功，已恢复原袋原票并完成入仓。'
  }
  const snapshot = resolveWaitHandoverBaggingSnapshot(bagCode)
  if (!snapshot) throw new Error(`${bagCode} 尚未完成菲票装袋，不能入仓。`)
  appendWaitHandoverInboundEvent({
    source: 'WEB',
    operator: operator(dialog, '裁片仓入仓员'),
    bagCode,
    warehouseArea: locationRef.areaName,
    locationCode: locationRef.locationNo,
    locationRef,
    usageCycleId: snapshot.usageCycleId,
    idempotencyKey: `${snapshot.usageCycleId}:INBOUND_CONFIRMED`,
  })
  return '入仓成功，可直接交出或拆袋重装。'
}

function submitRepack(dialog: HTMLElement): string {
  const sourceBagCodes = readMulti(dialog, 'sourceBagCodes')
  if (!sourceBagCodes.length) throw new Error('请至少选择一个来源袋。')
  const sources = sourceBagCodes.map((bagCode) => resolveTransferBagCurrentUse(bagCode))
  const groups = new Map<string, TransferBagTicketFactSnapshot[]>()
  sources.flatMap((source) => source.tickets).forEach((ticket) => {
    const key = ticket.receiverFactoryId
    const records = groups.get(key) || []
    records.push(ticket)
    groups.set(key, records)
  })
  const resultCodes = unique([
    readField(dialog, 'resultBagCode'),
    ...splitCodes(readField(dialog, 'resultBagCodes')),
  ])
  if (resultCodes.length < groups.size) throw new Error(`当前有 ${groups.size} 个接收车缝工厂，请扫描 ${groups.size} 个结果袋。`)
  submitTransferBagRepack({
    repackBatchId: readField(dialog, 'repackBatchId') || `WEB-REPACK-${Date.now()}`,
    sourceBagCodes,
    results: Array.from(groups.values()).map((tickets, index) => ({
      bagCode: resultCodes[index],
      feiTicketIds: tickets.map((ticket) => ticket.feiTicketId),
    })),
    operator: operator(dialog, '裁片仓重装员'),
    source: 'WEB',
  })
  return '重装成功，请继续交出。'
}

function submitHandover(dialog: HTMLElement): string {
  const value = readField(dialog, 'handoverSelection')
  const candidate = actionAdapter?.getHandoverCandidates().find((item) => item.value === value)
  if (!candidate) throw new Error('请选择可整袋交出的中转袋。')
  const current = resolveTransferBagCurrentUse(candidate.bagCode)
  if (!current.usageCycleId) throw new Error('当前中转袋缺少使用周期，请刷新后重试。')
  const eligibility = resolveWholeBagHandoverEligibility({
    currentUse: current,
    assignments: candidate.assignments,
    submittedTicketSnapshot: candidate.submittedTicketSnapshot,
  })
  if (!eligibility.ok) throw new Error(eligibility.reason)
  const operationKey = modalRoot()?.dataset?.operationKey || `${candidate.bagCode}:${Date.now()}`
  const event = submitWholeBagHandover({
    bagCode: candidate.bagCode,
    usageCycleId: current.usageCycleId,
    handoverOrderId: candidate.handoverOrderId,
    handoverOrderNo: candidate.handoverOrderNo,
    handoverRecordId: `WEB-HR-${operationKey}`,
    handoverRecordNo: `WEB-交出-${operationKey.split(':').at(-1)}`,
    assignments: candidate.assignments,
    submittedTicketSnapshot: candidate.submittedTicketSnapshot,
    operator: operator(dialog, '裁片仓交出员'),
    source: 'WEB',
  })
  if (!isCompleteSuccessfulWholeBagHandoverEvent(event)) throw new Error('交出事实写入后校验失败，请保留输入并重试。')
  return `交出成功：${event.eventId}，已进入已交出待回收。`
}

function submitRecovery(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'bagCode')
  const recoveryMode = (readRadio(dialog, 'recoveryMode') || 'NORMAL') as 'NORMAL' | 'FORCED'
  if (recoveryMode === 'FORCED' && !readChecked(dialog, 'secondConfirm')) throw new Error('强制回收必须完成二次确认。')
  const event = recoverTransferBag({
    bagCode,
    physicalBagReceived: readChecked(dialog, 'physicalBagReceived'),
    physicalBagEmpty: readChecked(dialog, 'physicalBagEmpty'),
    recoveryMode,
    recoveryNode: readField(dialog, 'recoveryNode'),
    recoveryLocation: readField(dialog, 'recoveryLocation'),
    reason: readField(dialog, 'reason'),
    operator: operator(dialog, '空袋回收员'),
    source: 'WEB',
  })
  return `回收成功：${event.eventId}，中转袋已空闲。`
}

function submitScrap(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'bagCode')
  if (!readChecked(dialog, 'secondConfirm')) throw new Error('报废是危险动作，请完成二次确认。')
  const current = resolveTransferBagCurrentUse(bagCode)
  if (['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage || '') || current.tickets.length) {
    throw new Error(`${bagCode} 当前生产单 ${current.productionOrderNo || '待核查'}，还有 ${current.tickets.length} 张菲票，请先拆袋重装。`)
  }
  const commonScrap = {
    reason: readField(dialog, 'reason'),
    authorizedBy: readField(dialog, 'authorizedBy'),
    operator: operator(dialog, '中转袋主管'),
    source: 'WEB' as const,
  }
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN' && readChecked(dialog, 'recoverFirst')) {
    const nodeAndLocation = readField(dialog, 'recoveryNode').split('/').map((item) => item.trim())
    const outcome = recoverThenScrapTransferBag({
      recovery: {
        bagCode,
        physicalBagReceived: readChecked(dialog, 'physicalBagReceived'),
        physicalBagEmpty: readChecked(dialog, 'physicalBagEmpty'),
        recoveryMode: 'NORMAL',
        recoveryNode: nodeAndLocation[0] || '裁床待交出仓',
        recoveryLocation: nodeAndLocation[1] || '报废区',
        reason: '回收后报废',
        operator: commonScrap.operator,
        source: 'WEB',
      },
      scrap: { reason: commonScrap.reason, authorizedBy: commonScrap.authorizedBy },
    })
    return `回收 ${outcome.recoveryEvent.eventId}、报废 ${outcome.scrapEvent.eventId} 已依次记录。`
  }
  const event = submitTransferBagScrap({ bagCode, ...commonScrap })
  return `报废成功：${event.eventId}，中转袋已停用。`
}

function submitAction(action: WaitHandoverWebAction, dialog: HTMLElement): string {
  return action === 'bagging' ? submitBagging(dialog)
    : action === 'inbound' ? submitInbound(dialog)
      : action === 'repack' ? submitRepack(dialog)
        : action === 'handover' ? submitHandover(dialog)
          : action === 'recovery' ? submitRecovery(dialog)
            : submitScrap(dialog)
}

function refreshRepackPreview(dialog: HTMLElement): void {
  const sourceBagCodes = readMulti(dialog, 'sourceBagCodes')
  const sources = sourceBagCodes.map((bagCode) => resolveTransferBagCurrentUse(bagCode))
  const tickets = sources.flatMap((source) => source.tickets)
  const groups = new Map<string, TransferBagTicketFactSnapshot[]>()
  tickets.forEach((ticket) => {
    const key = `${ticket.receiverFactoryId}|${ticket.receiverFactoryName}`
    const records = groups.get(key) || []
    records.push(ticket)
    groups.set(key, records)
  })
  const groupPreview = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-group-preview]')
  if (groupPreview) {
    groupPreview.textContent = groups.size
      ? Array.from(groups.entries()).map(([key, records], index) => {
          const productionOrders = unique(records.map((ticket) => ticket.productionOrderNo))
          const pieceQty = records.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
          return `${index + 1}. ${key.split('|')[1] || '接收工厂待核对'} / 生产单 ${productionOrders.join('、')} / ${records.length} 张 / ${pieceQty} 片`
        }).join('\n')
      : '请选择来源袋，系统将显示每个接收车缝工厂的生产单、菲票张数和裁片片数。'
  }
  const totalPreview = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-total-preview]')
  if (totalPreview) {
    const pieceQty = tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
    totalPreview.textContent = sourceBagCodes.length
      ? `来源 ${sourceBagCodes.length} 袋 / ${tickets.length} 张 / ${pieceQty} 片；结果 ${groups.size} 个工厂组，确认时校验集合与数量守恒；来源袋全部转出后变为空闲。`
      : '来源和结果数量将在选择来源袋后自动汇总。'
  }
}

export function handleWaitHandoverActionEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-wait-handover-field]')
  const fieldDialog = fieldNode?.closest<HTMLElement>('[data-wait-handover-modal="repack"]')
  if (fieldDialog && fieldNode?.dataset.waitHandoverField === 'sourceBagCodes') {
    refreshRepackPreview(fieldDialog)
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wait-handover-action], [data-wait-handover-web-action]')
  const actionName = actionNode?.dataset.waitHandoverAction || actionNode?.dataset.waitHandoverWebAction || ''
  if (!actionName) return false
  if (actionName === 'close-dialog') {
    modalRoot()?.remove()
    return true
  }
  if (actionName.startsWith('open-')) {
    const action = actionName.slice(5) as WaitHandoverWebAction
    if (!['bagging', 'inbound', 'repack', 'handover', 'recovery', 'scrap'].includes(action)) return false
    openWaitHandoverAction(action, actionNode?.dataset.waitHandoverSelection || '')
    return true
  }
  if (!actionName.startsWith('submit-')) return false
  const dialog = actionNode?.closest<HTMLElement>('[data-wait-handover-modal]')
  if (!dialog) return false
  if (submitLocks.has(dialog) || dialog.dataset?.submitLock === 'true') return true
  submitLocks.add(dialog)
  if (dialog.dataset) dialog.dataset.submitLock = 'true'
  const action = actionName.slice(7) as WaitHandoverWebAction
  try {
    const feedback = submitAction(action, dialog)
    refreshWorkbenchData()
    showFeedback(dialog, feedback)
  } catch (error) {
    if (dialog.dataset) delete dialog.dataset.submitLock
    submitLocks.delete(dialog)
    showFeedback(dialog, error instanceof Error ? error.message : '操作失败，请保留输入并重试。', true)
  }
  return true
}
