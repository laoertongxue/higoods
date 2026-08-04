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
  assertCuttingHandoverPpic,
  buildCuttingHandoverPpicOptions,
} from '../../../data/fcs/cutting/transfer-bag-handover-mock.ts'
import {
  classifyTransferBagForHandoverTask,
  ensureTransferBagAvailableForUse,
  isCompleteSuccessfulWholeBagHandoverEvent,
  recoverThenScrapTransferBag,
  recoverTransferBag,
  resolveTransferBagAuthoritativeCurrentLocation,
  resolveTransferBagCurrentUse,
  resolveWholeBagHandoverEligibility,
  submitSpecialCraftBagReturn,
  submitTransferBagScrap,
  submitWholeBagHandover,
  type TransferBagCurrentUse,
  type TransferBagHandoverTaskContext,
} from '../../../data/fcs/cutting/transfer-bag-operations.ts'
import {
  appendWaitHandoverBaggingEvent,
  appendWaitHandoverInboundEvent,
  buildWaitHandoverRuntimeTicketFromGeneratedTicket,
  preflightWaitHandoverBaggingEvent,
  resolveWaitHandoverBaggingSnapshot,
  submitWaitHandoverTaskBatch,
} from './wait-handover-runtime.ts'
import {
  renderWaitHandoverActionButtons,
  renderWaitHandoverActionDialog,
  isWaitHandoverRecoveryBlocked,
  isWaitHandoverScrapBlocked,
  renderWaitHandoverBagSummary,
  renderWaitHandoverRecoveryEligibility,
  renderWaitHandoverScrapEligibility,
  type WaitHandoverActionDialogModel,
  type WaitHandoverDialogCurrent,
  type WaitHandoverWebAction,
} from './wait-handover-dialogs.ts'
import { escapeHtml } from '../../../utils.ts'

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
  resolveBagCurrent?(bagCode: string): TransferBagCurrentUse | null
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
    mainStatus: current.mainStatus,
    flowStage: current.flowStage || '',
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

function resolveActionBagCurrent(bagCode: string): TransferBagCurrentUse {
  const runtimeCurrent = resolveTransferBagCurrentUse(bagCode)
  if (runtimeCurrent.mainStatus !== 'IDLE' || runtimeCurrent.tickets.length) return runtimeCurrent
  return actionAdapter?.resolveBagCurrent?.(bagCode) || runtimeCurrent
}

function resolveActionBagLocation(bagCode: string) {
  const current = resolveActionBagCurrent(bagCode)
  if (!current.usageCycleId) return null
  return resolveTransferBagAuthoritativeCurrentLocation({
    bagCode,
    usageCycleId: current.usageCycleId,
    events: listCuttingRuntimeEvents(),
  })
}

function generatedTicketLabel(ticket: GeneratedFeiTicketSourceRecord): string {
  return `${ticket.feiTicketNo} / ${ticket.productionOrderNo} / ${ticket.skuColor} / ${ticket.skuSize} / ${ticket.partName} / ${ticket.actualCutPieceQty || ticket.qty} 片`
}

function buildRepackSourceCurrents(preselectedBagCode = ''): TransferBagCurrentUse[] {
  const byBagCode = new Map<string, TransferBagCurrentUse>()
  collectCurrentBagCodes().forEach((bagCode) => byBagCode.set(bagCode, resolveActionBagCurrent(bagCode)))
  if (preselectedBagCode) byBagCode.set(preselectedBagCode, resolveActionBagCurrent(preselectedBagCode))
  return Array.from(byBagCode.values())
}

function buildModel(action: WaitHandoverWebAction, bagCode = ''): WaitHandoverActionDialogModel {
  const current = bagCode ? resolveActionBagCurrent(bagCode) : null
  const currentUses = buildRepackSourceCurrents(bagCode)
  const activeTicketIds = new Set(currentUses.flatMap((item) => item.tickets.map((ticket) => ticket.feiTicketId)))
  const ticketOptions = listSpreadingResultGeneratedFeiTickets()
    .filter((ticket) => ticket.printStatus !== 'VOIDED')
    .filter((ticket) => !activeTicketIds.has(ticket.feiTicketId))
    .filter((ticket) => validateFeiTicketNumberingBeforeBagging(ticket).ok)
    .map((ticket) => ({ value: ticket.feiTicketId, label: generatedTicketLabel(ticket) }))
  const repackSources = currentUses
    .filter((item) => ['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(item.flowStage || ''))
    .filter((item) => item.tickets.length > 0)
    .map((item) => ({
      value: item.bagCode,
      label: `${item.bagCode} / ${item.productionOrderNo} / ${item.tickets.length} 张 / ${item.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)} 片${item.compatibilityBlockedReason ? ' / 待主管核查' : ''}`,
      disabled: Boolean(item.compatibilityBlockedReason),
    }))
  const specialReturns = actionAdapter?.getSpecialCraftReturnCandidates() || []
  const taskFacts = new Map<string, { taskId: string; taskNo: string; productionOrderNo: string; factoryId: string; factoryName: string }>()
  currentUses.flatMap((item) => item.tickets).forEach((ticket) => {
    if (!ticket.sewingTaskId || !ticket.sewingTaskNo || !ticket.receiverFactoryId || !ticket.receiverFactoryName) return
    taskFacts.set(ticket.sewingTaskId, {
      taskId: ticket.sewingTaskId,
      taskNo: ticket.sewingTaskNo,
      productionOrderNo: ticket.productionOrderNo,
      factoryId: ticket.receiverFactoryId,
      factoryName: ticket.receiverFactoryName,
    })
  })
  const ppicOptions = Array.from(new Map(Array.from(taskFacts.values()).map((task) => [task.factoryId, task])).values()).flatMap((task) =>
    buildCuttingHandoverPpicOptions({ receiverFactoryId: task.factoryId, receiverFactoryName: task.factoryName }))
  return {
    current: dialogCurrent(current),
    ticketOptions,
    repackSources,
    handoverTaskOptions: Array.from(taskFacts.values()).map((task) => ({
      value: task.taskId,
      label: `${task.taskNo} / ${task.productionOrderNo} / ${task.factoryName}`,
    })),
    handoverPpicOptions: ppicOptions.map((item) => ({
      value: `${item.ppicId}|${item.ppicName}|${item.receiverFactoryId}`,
      label: `${item.ppicName} / ${item.receiverFactoryName}`,
    })),
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

function refreshHandoverTaskContext(dialog: HTMLElement): void {
  const taskSelection = dialog.querySelector<HTMLSelectElement>('[data-wait-handover-field="handoverTaskSelection"]')
  const ppicSelection = dialog.querySelector<HTMLSelectElement>('[data-wait-handover-field="handoverPpicSelection"]')
  if (!taskSelection || !ppicSelection) return

  const selectedTaskId = taskSelection.value
  const selectedTicket = selectedTaskId
    ? buildRepackSourceCurrents().flatMap((item) => item.tickets).find((ticket) => ticket.sewingTaskId === selectedTaskId)
    : null
  const taskInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverTaskNo"]')
  const productionOrderInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverProductionOrderNo"]')
  const factoryInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverReceiverFactoryName"]')
  if (selectedTicket) {
    if (taskInput) taskInput.value = selectedTicket.sewingTaskNo
    if (productionOrderInput) productionOrderInput.value = selectedTicket.productionOrderNo
    if (factoryInput) factoryInput.value = selectedTicket.receiverFactoryName
  }

  const currentValue = ppicSelection.value
  ppicSelection.replaceChildren()
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = selectedTicket ? '请选择当前接收工厂的 PPIC' : '请先选择车缝任务'
  ppicSelection.append(placeholder)
  if (!selectedTicket) return

  buildCuttingHandoverPpicOptions({
    receiverFactoryId: selectedTicket.receiverFactoryId,
    receiverFactoryName: selectedTicket.receiverFactoryName,
  }).forEach((item) => {
    const option = document.createElement('option')
    option.value = `${item.ppicId}|${item.ppicName}|${item.receiverFactoryId}`
    option.textContent = `${item.ppicName} / ${item.receiverFactoryName}`
    ppicSelection.append(option)
  })
  if (Array.from(ppicSelection.options).some((option) => option.value === currentValue)) {
    ppicSelection.value = currentValue
  }
}

export function openWaitHandoverAction(action: WaitHandoverWebAction, bagCode = ''): void {
  if (typeof document === 'undefined') return
  modalRoot()?.remove()
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', renderWaitHandoverActionDialog({ action, bagCode, model: buildModel(action, bagCode) }))
  const modal = modalRoot()
  if (modal) {
    modal.dataset.operationKey = `${action}:${Date.now()}`
    if (action === 'repack' || action === 'handover') {
      if (bagCode) {
        const firstTask = resolveActionBagCurrent(bagCode).tickets.find((ticket) => ticket.sewingTaskId && ticket.sewingTaskNo)
        const taskInput = modal.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverTaskNo"]')
        if (taskInput && firstTask) taskInput.value = firstTask.sewingTaskNo
      }
      renderRepackEditor(modal)
    }
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
  const codes = readField(dialog, 'ticketScanInput')
    .split(/[\s,，、;；\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const all = listSpreadingResultGeneratedFeiTickets()
  const requested = [selected, ...codes].filter(Boolean)
  const resolved = requested.map((code) => ({
    code,
    ticket: all.find((ticket) => [ticket.feiTicketId, ticket.feiTicketNo].includes(code)),
  }))
  const missingCodes = unique(resolved.filter((item) => !item.ticket).map((item) => item.code))
  const seenTicketIds = new Set<string>()
  const duplicateCodes: string[] = []
  resolved.forEach(({ code, ticket }) => {
    if (!ticket) return
    if (seenTicketIds.has(ticket.feiTicketId)) duplicateCodes.push(code)
    seenTicketIds.add(ticket.feiTicketId)
  })
  const inputProblems = [
    missingCodes.length ? `以下菲票码未匹配：${missingCodes.join('、')}` : '',
    duplicateCodes.length ? `以下菲票重复输入：${unique(duplicateCodes).join('、')}` : '',
  ].filter(Boolean)
  if (inputProblems.length) throw new Error(inputProblems.join('；'))
  return resolved
    .map((item) => item.ticket)
    .filter((ticket): ticket is GeneratedFeiTicketSourceRecord => Boolean(ticket))
}

function submitBagging(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'bagCode')
  if (!bagCode) throw new Error('请扫描或输入中转袋编号。')
  const tickets = findGeneratedTickets(dialog)
  if (!tickets.length) throw new Error('请选择或扫描可装袋菲票。')
  const numberingBlocked = tickets.filter((ticket) => !validateFeiTicketNumberingBeforeBagging(ticket).ok)
  if (numberingBlocked.length) {
    const reason = validateFeiTicketNumberingBeforeBagging(numberingBlocked[0]).reason
    throw new Error(`${numberingBlocked.map((ticket) => ticket.feiTicketNo).join('、')} 不能装袋：${reason}`)
  }
  const forceReason = readField(dialog, 'forceRecoveryReason')
  const forceRecovery = forceReason ? {
    physicalBagReceived: readChecked(dialog, 'physicalBagReceived'),
    physicalBagEmpty: readChecked(dialog, 'physicalBagEmpty'),
    recoveryNode: '裁床待交出仓',
    recoveryLocation: '装袋操作区',
    reason: forceReason,
    operator: operator(dialog, '裁片仓装袋员'),
    source: 'WEB' as const,
  } : undefined
  const occurredAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const baggingInput = {
    source: 'WEB' as const,
    operator: operator(dialog, '裁片仓装袋员'),
    bagCode,
    tickets: tickets.map(buildWaitHandoverRuntimeTicketFromGeneratedTicket),
    occurredAt,
    idempotencyKey: `web:${modalRoot()?.dataset?.operationKey || bagCode}:bagging`,
  }
  preflightWaitHandoverBaggingEvent(baggingInput, forceRecovery
    ? (temporaryStorage) => ensureTransferBagAvailableForUse({ bagCode, forceRecovery }, temporaryStorage)
    : undefined)
  const availability = ensureTransferBagAvailableForUse({ bagCode, forceRecovery })
  try {
    appendWaitHandoverBaggingEvent(baggingInput)
  } catch (error) {
    if (!availability.recovered) throw error
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`回收已成功，装袋未完成：${reason}`)
  }
  return '装袋成功，请继续中转袋入仓。'
}

function submitInbound(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'bagCode')
  if (!bagCode) throw new Error('请扫描或输入中转袋编号。')
  const warehouseArea = readField(dialog, 'warehouseArea')
  const locationCode = readField(dialog, 'locationCode')
  const locationRef = actionAdapter?.resolveLocation(warehouseArea, locationCode)
  if (!locationRef) throw new Error('库区或库位不存在、已停用或编号不唯一，请重新确认。')
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

function submitSpecialCraftReturn(dialog: HTMLElement): string {
  const specialValue = readField(dialog, 'specialCraftSource')
  const candidate = actionAdapter?.getSpecialCraftReturnCandidates().find((item) => item.value === specialValue)
  if (!candidate) throw new Error('请选择可回仓的特殊工艺交出记录。')
  const bagCode = readField(dialog, 'bagCode')
  if (!bagCode || candidate.bagCode !== bagCode) throw new Error('特殊工艺来源记录与中转袋不一致，请重新确认。')
  const locationRef = actionAdapter?.resolveLocation(readField(dialog, 'warehouseArea'), readField(dialog, 'locationCode'))
  if (!locationRef) throw new Error('请确认有效的回仓库区和库位。')
  const returnedTicketIds = splitCodes(readField(dialog, 'returnedTicketIds'))
  submitSpecialCraftBagReturn({
    sourceHandoverRecordId: candidate.sourceHandoverRecordId,
    bagCode,
    returnedTicketIds: returnedTicketIds.length ? returnedTicketIds : candidate.returnedTicketIds,
    locationRef,
    operator: operator(dialog, '特殊工艺回仓员'),
    source: 'WEB',
  })
  return '特殊工艺回仓成功，已恢复袋票关系并完成入仓。'
}

function resolveHandoverTaskContext(dialog: HTMLElement): TransferBagHandoverTaskContext {
  const selectedTaskId = readField(dialog, 'handoverTaskSelection')
  const taskNo = readField(dialog, 'handoverTaskNo')
  const productionOrderNo = readField(dialog, 'handoverProductionOrderNo')
  const receiverFactoryName = readField(dialog, 'handoverReceiverFactoryName')
  const allTickets = collectCurrentBagCodes().flatMap((bagCode) => resolveActionBagCurrent(bagCode).tickets)
  const matchingTickets = allTickets.filter((ticket) => selectedTaskId
    ? ticket.sewingTaskId === selectedTaskId
    : taskNo
      ? ticket.sewingTaskNo === taskNo
      : ticket.productionOrderNo === productionOrderNo && ticket.receiverFactoryName === receiverFactoryName)
  if (!matchingTickets.length) throw new Error('未找到该生产单和车缝任务的待交出菲票。')
  const taskIds = unique(matchingTickets.map((ticket) => ticket.sewingTaskId))
  const taskNos = unique(matchingTickets.map((ticket) => ticket.sewingTaskNo))
  const productionOrderIds = unique(matchingTickets.map((ticket) => ticket.productionOrderId))
  const productionOrderNos = unique(matchingTickets.map((ticket) => ticket.productionOrderNo))
  const factoryIds = unique(matchingTickets.map((ticket) => ticket.receiverFactoryId))
  const factoryNames = unique(matchingTickets.map((ticket) => ticket.receiverFactoryName))
  if ([taskIds, taskNos, productionOrderIds, productionOrderNos, factoryIds, factoryNames].some((values) => values.length !== 1 || !values[0])) {
    throw new Error('一次只能处理一个生产单的一个车缝任务和一个接收车缝工厂。')
  }
  const [ppicId, ppicName, ppicFactoryId] = readField(dialog, 'handoverPpicSelection').split('|')
  if (ppicFactoryId !== factoryIds[0]) throw new Error('请选择当前接收车缝工厂的 PPIC。')
  const ppic = assertCuttingHandoverPpic({
    ppicId: ppicId || '',
    ppicName: ppicName || '',
    receiverFactoryId: factoryIds[0],
    receiverFactoryName: factoryNames[0],
  })
  return {
    handoverBatchId: readField(dialog, 'handoverBatchId') || `WEB-HANDOVER-${Date.now()}`,
    productionOrderId: productionOrderIds[0],
    productionOrderNo: productionOrderNos[0],
    sewingTaskId: taskIds[0],
    sewingTaskNo: taskNos[0],
    receiverFactoryId: factoryIds[0],
    receiverFactoryName: factoryNames[0],
    receiverPpicId: ppic.ppicId,
    receiverPpicName: ppic.ppicName,
    targetFeiTicketIds: unique(matchingTickets.map((ticket) => ticket.feiTicketId)),
  }
}

function prepareHandoverTask(dialog: HTMLElement): TransferBagHandoverTaskContext {
  const context = resolveHandoverTaskContext(dialog)
  const sourceSelect = dialog.querySelector<HTMLSelectElement>('select[data-wait-handover-field="sourceBagCodes"]')
  if (!sourceSelect) throw new Error('相关中转袋区域不可用，请关闭后重试。')
  Array.from(sourceSelect.options).forEach((option) => { option.selected = false })
  const targetIds = new Set(context.targetFeiTicketIds)
  collectCurrentBagCodes().forEach((bagCode) => {
    const current = resolveActionBagCurrent(bagCode)
    if (!current.tickets.some((ticket) => targetIds.has(ticket.feiTicketId))) return
    let option = Array.from(sourceSelect.options).find((item) => item.value === bagCode)
    if (!option) {
      option = document.createElement('option')
      option.value = bagCode
      option.textContent = bagCode
      sourceSelect.append(option)
    }
    option.selected = true
  })
  if (!readMulti(dialog, 'sourceBagCodes').length) throw new Error('目标菲票没有可追踪的当前中转袋。')
  const taskInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverTaskNo"]')
  const poInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverProductionOrderNo"]')
  const factoryInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="handoverReceiverFactoryName"]')
  if (taskInput) taskInput.value = context.sewingTaskNo
  if (poInput) poInput.value = context.productionOrderNo
  if (factoryInput) factoryInput.value = context.receiverFactoryName
  renderRepackEditor(dialog)
  return context
}

function submitRepack(dialog: HTMLElement): string {
  const handoverContext = resolveHandoverTaskContext(dialog)
  const sourceBagCodes = readMulti(dialog, 'sourceBagCodes')
  if (!sourceBagCodes.length) throw new Error('当前车缝任务没有找到相关中转袋。')
  const sourceCurrents = sourceBagCodes.map((bagCode) => resolveActionBagCurrent(bagCode))
  const resultRows = Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-result-row]'))
  const selectedResultBagCodes = new Set(resultRows
    .map((row) => row.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')?.value.trim() || '')
    .filter(Boolean))
  const directCurrents = sourceCurrents.filter((current) => !selectedResultBagCodes.has(current.bagCode) &&
    classifyTransferBagForHandoverTask({ currentUse: current, handoverContext }).disposition === 'DIRECT_HANDOVER')
  const repackCurrents = sourceCurrents.filter((current) => selectedResultBagCodes.has(current.bagCode) || (
    classifyTransferBagForHandoverTask({ currentUse: current, handoverContext }).disposition === 'REPACK_REQUIRED'
    && current.tickets.some((ticket) => handoverContext.targetFeiTicketIds.includes(ticket.feiTicketId))))
  if (repackCurrents.length && !resultRows.length) throw new Error('需要拆袋的目标菲票尚未指定结果袋。')
  const assignments = Array.from(dialog.querySelectorAll<HTMLSelectElement>('[data-wait-handover-repack-ticket-assignment]'))
  for (const row of resultRows) {
    const bagCode = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')?.value.trim() || ''
    if (!bagCode || sourceBagCodes.includes(bagCode) || row.dataset.waitHandoverForceRecoveryRequired !== 'true') continue
    const physicalBagReceived = Boolean(row.querySelector<HTMLInputElement>('[data-wait-handover-repack-force-received]')?.checked)
    const physicalBagEmpty = Boolean(row.querySelector<HTMLInputElement>('[data-wait-handover-repack-force-empty]')?.checked)
    const reason = row.querySelector<HTMLTextAreaElement>('[data-wait-handover-repack-force-reason]')?.value.trim() || ''
    if (!physicalBagReceived || !physicalBagEmpty || !reason) {
      throw new Error(`${bagCode} 需要先确认实物袋已收到、为空，并填写强制回收原因。`)
    }
    ensureTransferBagAvailableForUse({
      bagCode,
      forceRecovery: {
        physicalBagReceived: true,
        physicalBagEmpty: true,
        recoveryNode: '裁床待交出仓',
        recoveryLocation: '裁床空袋回收点',
        reason,
        operator: operator(dialog, '裁片仓回收员'),
        source: 'WEB',
      },
    })
  }
  const returnDrafts = readRepackSourceReturnDrafts(dialog)
  const retainedSources = repackCurrents.map((current) => {
    const bagCode = current.bagCode
    const feiTicketIds = current.tickets
      .filter((ticket) => !assignments.find((select) => select.dataset.ticketId === ticket.feiTicketId)?.value)
      .map((ticket) => ticket.feiTicketId)
    if (!feiTicketIds.length) return null
    const draft = returnDrafts.get(bagCode)
    const returnLocationRef = draft ? actionAdapter?.resolveLocation(draft.warehouseArea, draft.locationCode) : null
    if (!returnLocationRef) throw new Error(`${bagCode} 仍有菲票，请确认有效的回仓库位。`)
    return { bagCode, feiTicketIds, returnLocationRef }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const repackInput = repackCurrents.length ? {
    repackBatchId: readField(dialog, 'repackBatchId') || `WEB-REPACK-${Date.now()}`,
    handoverContext,
    sourceBagCodes: repackCurrents.map((current) => current.bagCode),
    results: resultRows.map((row) => ({
      bagCode: row.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')?.value.trim() || '',
      feiTicketIds: assignments
        .filter((select) => select.value === row.dataset.waitHandoverRepackResultRow)
        .map((select) => select.dataset.ticketId || ''),
    })).filter((result) => result.feiTicketIds.length),
    retainedSources,
    operator: operator(dialog, '裁片仓重装员'),
    source: 'WEB' as const,
  } : undefined
  const outcome = submitWaitHandoverTaskBatch({
    handoverContext,
    directBags: directCurrents.map((current) => ({
      bagCode: current.bagCode,
      usageCycleId: current.usageCycleId || '',
      assignments: current.tickets.map((ticket) => ({
        feiTicketId: ticket.feiTicketId,
        feiTicketNo: ticket.feiTicketNo,
        sewingTaskId: handoverContext.sewingTaskId,
        sewingTaskNo: handoverContext.sewingTaskNo,
        receiverFactoryId: handoverContext.receiverFactoryId,
        receiverFactoryName: handoverContext.receiverFactoryName,
      })),
      submittedTicketSnapshot: current.tickets.map((ticket) => ({
        ...ticket,
        sewingTaskId: handoverContext.sewingTaskId,
        sewingTaskNo: handoverContext.sewingTaskNo,
        receiverFactoryId: handoverContext.receiverFactoryId,
        receiverFactoryName: handoverContext.receiverFactoryName,
      })),
    })),
    ...(repackInput ? { repack: repackInput } : {}),
    operator: operator(dialog, '裁片仓交出员'),
    source: 'WEB',
  })
  return `本次交出成功：${outcome.handoverEvents.length} 只中转袋已交出待回收，${outcome.inboundEvents.length} 只来源袋已重新入仓。`
}

function submitHandover(dialog: HTMLElement): string {
  const bagCode = readField(dialog, 'handoverBagCode')
  if (!bagCode) throw new Error('请填写需要交出的中转袋编号。')
  const candidate = actionAdapter?.getHandoverCandidates().find((item) => item.bagCode === bagCode)
  if (!candidate) throw new Error(`${bagCode} 当前不能整袋交出，请核对袋号、袋内菲票分配和接收车缝工厂。`)
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
          : action === 'special-craft-return' ? submitSpecialCraftReturn(dialog)
            : action === 'recovery' ? submitRecovery(dialog)
            : submitScrap(dialog)
}

interface RepackResultDraft {
  id: string
  bagCode: string
  groupKey: string
}

interface RepackSourceReturnDraft {
  bagCode: string
  warehouseArea: string
  locationCode: string
}

const REPACK_STEP_KEYS = ['sources', 'groups', 'results', 'returns', 'confirm'] as const

function currentRepackStep(dialog: HTMLElement): number {
  const value = Number(dialog.dataset.repackStep || '1')
  return Number.isInteger(value) && value >= 1 && value <= REPACK_STEP_KEYS.length ? value : 1
}

function setRepackStep(dialog: HTMLElement, step: number): void {
  const normalized = Math.min(REPACK_STEP_KEYS.length, Math.max(1, step))
  dialog.dataset.repackStep = String(normalized)
  REPACK_STEP_KEYS.forEach((key, index) => {
    dialog.querySelector<HTMLElement>(`[data-wait-handover-repack-step="${key}"]`)?.classList.toggle('hidden', index + 1 !== normalized)
  })
  const progressLabel = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-progress-label]')
  if (progressLabel) progressLabel.textContent = `第 ${normalized} 步，共 ${REPACK_STEP_KEYS.length} 步`
  dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-progress-step]').forEach((item) => {
    const itemStep = Number(item.dataset.waitHandoverRepackProgressStep || '0')
    item.classList.toggle('border-violet-500', itemStep === normalized)
    item.classList.toggle('bg-violet-50', itemStep === normalized)
    item.classList.toggle('text-violet-800', itemStep === normalized)
    item.classList.toggle('opacity-60', itemStep > normalized)
  })
}

function readRepackResultDrafts(dialog: HTMLElement): RepackResultDraft[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-result-row]')).map((row) => ({
    id: row.dataset.waitHandoverRepackResultRow || '',
    bagCode: row.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')?.value || '',
    groupKey: row.dataset.waitHandoverRepackGroupKey || '',
  })).filter((row) => row.id)
}

function readRepackAssignments(dialog: HTMLElement): Map<string, string> {
  return new Map(Array.from(dialog.querySelectorAll<HTMLSelectElement>('[data-wait-handover-repack-ticket-assignment]'))
    .map((select) => [select.dataset.ticketId || '', select.value]))
}

function readRepackSourceReturnDrafts(dialog: HTMLElement): Map<string, RepackSourceReturnDraft> {
  return new Map(Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-source-return-row]'))
    .map((row) => {
      const bagCode = row.dataset.sourceBagCode || ''
      return [bagCode, {
        bagCode,
        warehouseArea: row.querySelector<HTMLInputElement>('[data-wait-handover-repack-return-area]')?.value || '',
        locationCode: row.querySelector<HTMLInputElement>('[data-wait-handover-repack-return-location]')?.value || '',
      }] as const
    })
    .filter(([bagCode]) => Boolean(bagCode)))
}

function refreshRepackAssignmentEligibility(dialog: HTMLElement): void {
  let handoverContext: TransferBagHandoverTaskContext | null = null
  let contextError = ''
  try {
    handoverContext = resolveHandoverTaskContext(dialog)
  } catch (error) {
    contextError = error instanceof Error ? error.message : '请先确认车缝任务和接收 PPIC。'
  }
  const assignments = Array.from(dialog.querySelectorAll<HTMLSelectElement>('[data-wait-handover-repack-ticket-assignment]'))
  const sourceBagCodes = readMulti(dialog, 'sourceBagCodes')
  const sourceCurrents = sourceBagCodes.map((bagCode) => resolveActionBagCurrent(bagCode))
  const tickets = sourceCurrents.flatMap((current) => current.tickets)
  const ticketById = new Map(tickets.map((ticket) => [ticket.feiTicketId, ticket]))
  const targetTicketIds = new Set(handoverContext?.targetFeiTicketIds || [])
  const resultRows = Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-result-row]'))
  const resultBagCodes = resultRows.map((row) => row.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')?.value.trim() || '')
  const selectedResultBagCodes = new Set(resultBagCodes.filter(Boolean))
  const directBagCodes = handoverContext
    ? sourceBagCodes.filter((bagCode) => !selectedResultBagCodes.has(bagCode) && classifyTransferBagForHandoverTask({
        currentUse: resolveActionBagCurrent(bagCode),
        handoverContext: handoverContext!,
      }).disposition === 'DIRECT_HANDOVER')
    : []
  const repackBagCodes = sourceBagCodes.filter((bagCode) => !directBagCodes.includes(bagCode))
  const directTickets = directBagCodes.flatMap((bagCode) => resolveActionBagCurrent(bagCode).tickets)
  const repackTickets = repackBagCodes.flatMap((bagCode) => resolveActionBagCurrent(bagCode).tickets)
  const repackTargetTickets = repackTickets.filter((ticket) => targetTicketIds.has(ticket.feiTicketId))
  const retainedTickets = repackTickets.filter((ticket) => !targetTicketIds.has(ticket.feiTicketId))
  const missingBagCount = resultBagCodes.filter((bagCode) => !bagCode).length
  const duplicateBagCount = resultBagCodes.filter((bagCode, index) => bagCode && resultBagCodes.indexOf(bagCode) !== index).length
  const forceRecoveryRows = resultRows.filter((row) => row.dataset.waitHandoverForceRecoveryRequired === 'true')
  const incompleteForceRecoveryCount = forceRecoveryRows.filter((row) => {
    const received = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-force-received]')?.checked
    const empty = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-force-empty]')?.checked
    const reason = row.querySelector<HTMLTextAreaElement>('[data-wait-handover-repack-force-reason]')?.value.trim()
    return !received || !empty || !reason
  }).length
  const invalidResultCount = resultRows.filter((row) => row.dataset.waitHandoverResultBlocked === 'true').length
  const assignedTicketIds = assignments.filter((select) => select.value).map((select) => select.dataset.ticketId || '')
  const unassignedTargetCount = assignments.filter((select) => !select.value).length
  const emptyResultCount = resultRows.filter((row) =>
    !assignments.some((select) => select.value === row.dataset.waitHandoverRepackResultRow)).length
  const resultSourceConflictCount = resultBagCodes.filter((bagCode) => bagCode && sourceBagCodes.includes(bagCode))
    .filter((bagCode) => resolveActionBagCurrent(bagCode).tickets.some((ticket) => !targetTicketIds.has(ticket.feiTicketId))).length
  const returnRows = Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-source-return-row]'))
  const invalidReturnLocationCount = returnRows.filter((row) => {
    const warehouseArea = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-return-area]')?.value.trim() || ''
    const locationCode = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-return-location]')?.value.trim() || ''
    return !actionAdapter?.resolveLocation(warehouseArea, locationCode)
  }).length
  const resultPieceQty = assignedTicketIds.reduce((sum, ticketId) => sum + Number(ticketById.get(ticketId)?.pieceQty || 0), 0)
  const retainedPieceQty = retainedTickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const directPieceQty = directTickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const sourcePieceQty = tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const errors = [
    contextError,
    !sourceBagCodes.length ? '当前任务没有找到相关来源袋。' : '',
    repackTargetTickets.length && !resultRows.length ? '需要重装的菲票必须至少指定一只结果袋。' : '',
    missingBagCount ? `还有 ${missingBagCount} 只结果袋未填写编号。` : '',
    emptyResultCount ? `还有 ${emptyResultCount} 只结果袋没有菲票。` : '',
    duplicateBagCount ? '同一结果袋不能被多个分组重复使用。' : '',
    unassignedTargetCount ? `还有 ${unassignedTargetCount} 张当前任务菲票未装入结果袋。` : '',
    incompleteForceRecoveryCount ? `还有 ${incompleteForceRecoveryCount} 只结果袋需要确认强制回收。` : '',
    invalidResultCount ? `还有 ${invalidResultCount} 只结果袋当前不可使用。` : '',
    resultSourceConflictCount ? `还有 ${resultSourceConflictCount} 只来源袋既作为结果袋又保留菲票，不能同时交出和入仓。` : '',
    invalidReturnLocationCount ? `还有 ${invalidReturnLocationCount} 只剩余来源袋未确认有效库位。` : '',
    repackTargetTickets.length !== assignedTicketIds.length ? '需要重装的当前任务菲票没有全部进入结果袋。' : '',
    sourcePieceQty !== directPieceQty + resultPieceQty + retainedPieceQty ? '直接交出、结果袋与剩余来源袋合计和来源不一致。' : '',
    !directBagCodes.length && !assignedTicketIds.length ? '当前没有可交出的中转袋。' : '',
  ].filter(Boolean)
  const totalPreview = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-total-preview]')
  if (totalPreview) {
    totalPreview.innerHTML = `<div class="grid gap-3 md:grid-cols-4"><div class="rounded-lg border bg-slate-50 p-3 text-sm"><div class="text-xs text-muted-foreground">来源合计</div><div class="mt-1 font-semibold">${sourceBagCodes.length} 袋 · ${tickets.length} 张 · ${sourcePieceQty} 片</div></div><div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><div class="text-xs text-blue-700">整袋直接交出</div><div class="mt-1 font-semibold">${directBagCodes.length} 袋 · ${directTickets.length} 张 · ${directPieceQty} 片</div></div><div class="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm"><div class="text-xs text-violet-700">重装结果袋交出</div><div class="mt-1 font-semibold">${resultBagCodes.filter(Boolean).length} 袋 · ${assignedTicketIds.length} 张 · ${resultPieceQty} 片</div></div><div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><div class="text-xs text-amber-700">剩余来源袋回仓</div><div class="mt-1 font-semibold">${returnRows.length} 袋 · ${retainedTickets.length} 张 · ${retainedPieceQty} 片</div></div></div>${errors.length ? `<div class="mt-3 space-y-1">${errors.map((error) => `<div class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">${escapeHtml(error)}</div>`).join('')}</div>` : '<div class="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">直接交出、重装交出和剩余回仓数量一致，可以确认本次交出。</div>'}`
  }
  const submit = dialog.querySelector<HTMLButtonElement>('[data-wait-handover-action="submit-repack"]')
  if (submit) {
    const ready = Boolean(handoverContext) && errors.length === 0 && (directBagCodes.length > 0 || assignedTicketIds.length > 0)
    submit.disabled = !ready
    submit.dataset.waitHandoverSubmitDisabled = String(!ready)
    submit.classList.toggle('hidden', !ready || currentRepackStep(dialog) !== 5)
  }
}

function validateRepackStepBeforeNext(dialog: HTMLElement, step: number): string {
  if (step === 1) {
    try {
      prepareHandoverTask(dialog)
      return readMulti(dialog, 'sourceBagCodes').length ? '' : '当前任务没有找到相关中转袋。'
    } catch (error) {
      return error instanceof Error ? error.message : '请核对车缝任务、生产单、工厂和接收 PPIC。'
    }
  }
  if (step === 2) {
    return readMulti(dialog, 'sourceBagCodes').length ? '' : '当前任务没有找到相关中转袋。'
  }
  if (step === 3) {
    const resultRows = Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-result-row]'))
    const assignments = Array.from(dialog.querySelectorAll<HTMLSelectElement>('[data-wait-handover-repack-ticket-assignment]'))
    if (!assignments.length) return ''
    if (!resultRows.length) return '请至少新增一只结果袋，并选择要装入的菲票。'
    if (resultRows.some((row) => !row.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')?.value.trim())) {
      return '还有结果袋未填写编号。'
    }
    if (resultRows.some((row) => !assignments.some((select) => select.value === row.dataset.waitHandoverRepackResultRow))) {
      return '每只结果袋都必须至少装入一张菲票。'
    }
    if (assignments.some((select) => !select.value)) return '当前任务菲票必须全部装入结果袋。'
    if (resultRows.some((row) => row.dataset.waitHandoverResultBlocked === 'true')) return '存在当前不可使用的结果袋，请更换袋码。'
    if (resultRows.some((row) => row.dataset.waitHandoverForceRecoveryRequired === 'true'
      && (!row.querySelector<HTMLInputElement>('[data-wait-handover-repack-force-received]')?.checked
        || !row.querySelector<HTMLInputElement>('[data-wait-handover-repack-force-empty]')?.checked
        || !row.querySelector<HTMLTextAreaElement>('[data-wait-handover-repack-force-reason]')?.value.trim()))) {
      return '请完成结果袋的强制回收确认。'
    }
    return ''
  }
  if (step === 4) {
    const invalid = Array.from(dialog.querySelectorAll<HTMLElement>('[data-wait-handover-repack-source-return-row]'))
      .some((row) => {
        const area = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-return-area]')?.value.trim() || ''
        const location = row.querySelector<HTMLInputElement>('[data-wait-handover-repack-return-location]')?.value.trim() || ''
        return !actionAdapter?.resolveLocation(area, location)
      })
    return invalid ? '剩余来源袋必须确认有效回仓库位；默认原库位，也可以修改。' : ''
  }
  return ''
}

function renderRepackEditor(
  dialog: HTMLElement,
  options: { addResultGroupKey?: string; removeResultId?: string } = {},
): void {
  const sourceBagCodes = readMulti(dialog, 'sourceBagCodes')
  const tickets = sourceBagCodes.flatMap((bagCode) => resolveActionBagCurrent(bagCode).tickets)
  let handoverContext: TransferBagHandoverTaskContext | null = null
  if (sourceBagCodes.length) {
    try { handoverContext = resolveHandoverTaskContext(dialog) } catch { handoverContext = null }
  }
  let results = readRepackResultDrafts(dialog)
  if (options.removeResultId) results = results.filter((result) => result.id !== options.removeResultId)
  const selectedResultBagCodes = new Set(results.map((result) => result.bagCode.trim()).filter(Boolean))
  const targetIds = new Set(handoverContext?.targetFeiTicketIds || [])
  const directBagCodes = handoverContext
    ? sourceBagCodes.filter((bagCode) => !selectedResultBagCodes.has(bagCode) && classifyTransferBagForHandoverTask({
        currentUse: resolveActionBagCurrent(bagCode),
        handoverContext: handoverContext!,
      }).disposition === 'DIRECT_HANDOVER')
    : []
  const repackSourceBagCodes = sourceBagCodes.filter((bagCode) => !directBagCodes.includes(bagCode))
  const repackTargetTickets = tickets.filter((ticket) =>
    targetIds.has(ticket.feiTicketId)
    && repackSourceBagCodes.some((bagCode) => resolveActionBagCurrent(bagCode).tickets.some((item) => item.feiTicketId === ticket.feiTicketId)))
  const groups = new Map<string, TransferBagTicketFactSnapshot[]>()
  repackTargetTickets.forEach((ticket) => {
    const key = `${ticket.productionOrderId}|${ticket.productionOrderNo}|${ticket.receiverFactoryId}|${ticket.receiverFactoryName}`
    const records = groups.get(key) || []
    records.push(ticket)
    groups.set(key, records)
  })
  const previousAssignments = readRepackAssignments(dialog)
  const previousReturnDrafts = readRepackSourceReturnDrafts(dialog)
  let nextId = Number(dialog.dataset.nextRepackResultId || '1')
  const groupKeys = Array.from(groups.keys())
  const addDraft = (groupKey: string) => ({ id: `result-${nextId++}`, bagCode: '', groupKey })
  results = tickets.length ? results.filter((result) => groupKeys.includes(result.groupKey)) : []
  if (options.addResultGroupKey && groups.has(options.addResultGroupKey)) {
    results.push(addDraft(options.addResultGroupKey))
  }
  dialog.dataset.nextRepackResultId = String(nextId)
  const selectedSourcesRegion = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-selected-sources]')
  if (selectedSourcesRegion) {
    selectedSourcesRegion.innerHTML = sourceBagCodes.length
      ? sourceBagCodes.map((bagCode) => {
        const current = resolveActionBagCurrent(bagCode)
        const pieceQty = current.tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
        return `<div class="flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm"><div><div class="font-semibold">${escapeHtml(bagCode)}</div><div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(current.productionOrderNo || '待核查')} · ${current.tickets.length} 张 · ${pieceQty} 片</div></div><button type="button" class="shrink-0 rounded border px-2 py-1 text-xs text-rose-700" data-skip-page-rerender="true" data-wait-handover-action="remove-repack-source" data-source-bag-code="${escapeHtml(bagCode)}">移除</button></div>`
      }).join('')
      : '<div class="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">请先确定车缝任务和接收 PPIC，系统会自动显示相关中转袋。</div>'
  }
  const directHandoverRegion = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-direct-handover]')
  if (directHandoverRegion) {
    directHandoverRegion.classList.toggle('hidden', !directBagCodes.length)
    directHandoverRegion.innerHTML = directBagCodes.length
      ? `<div class="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900"><div class="font-semibold">可直接交出 ${directBagCodes.length} 只</div><div class="mt-2 flex flex-wrap gap-2">${directBagCodes.map((bagCode) => `<span class="rounded border border-blue-200 bg-white px-2 py-1">${escapeHtml(bagCode)}</span>`).join('')}</div><div class="mt-2 text-xs">这些袋内全部有效菲票都属于当前车缝任务，将与重装结果袋在同一次确认中交出。</div></div>`
      : ''
  }

  const groupPreview = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-group-preview]')
  if (groupPreview) {
    groupPreview.innerHTML = sourceBagCodes.length && handoverContext
      ? sourceBagCodes.map((bagCode) => {
        const current = resolveActionBagCurrent(bagCode)
        const classification = classifyTransferBagForHandoverTask({ currentUse: current, handoverContext: handoverContext! })
        const targetQty = classification.targetTickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
        const otherQty = classification.otherTickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
        return `<article class="rounded-lg border ${classification.disposition === 'DIRECT_HANDOVER' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'} p-3"><div class="flex items-center justify-between gap-2"><strong>${escapeHtml(bagCode)}</strong><span class="text-xs font-medium">${classification.disposition === 'DIRECT_HANDOVER' ? '直接交出' : '需要拆袋重装'}</span></div><div class="mt-2 text-sm">本任务 ${classification.targetTickets.length} 张 / ${targetQty} 片${classification.otherTickets.length ? ` · 其他菲票 ${classification.otherTickets.length} 张 / ${otherQty} 片` : ''}</div>${classification.otherTickets.length ? '<div class="mt-1 text-xs text-amber-800">其他菲票属于正常重装对象，不是交出异常。</div>' : ''}</article>`
      }).join('')
      : '<div class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">请先确定一个生产单的一个车缝任务。</div>'
  }

  const resultsRegion = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-results]')
  if (resultsRegion) {
    resultsRegion.innerHTML = Array.from(groups.entries()).map(([groupKey, groupTickets]) => {
      const [, productionOrderNo, , receiverFactoryName] = groupKey.split('|')
      const groupResults = results.filter((result) => result.groupKey === groupKey)
      const reusableSourceBagCodes = sourceBagCodes.filter((bagCode) => resolveActionBagCurrent(bagCode).tickets.some((ticket) => ticket.productionOrderNo === productionOrderNo))
      const resultRows = groupResults.map((result, resultIndex) => {
        const current = result.bagCode ? resolveActionBagCurrent(result.bagCode) : null
        const reused = reusableSourceBagCodes.includes(result.bagCode)
        const forceRecoveryRequired = Boolean(current && !reused && current.flowStage === 'HANDED_OVER_WAITING_RETURN' && current.tickets.length === 0)
        const resultBlocked = Boolean(current && !reused && !forceRecoveryRequired && current.mainStatus !== 'IDLE')
        const forceRecovery = forceRecoveryRequired ? `<div class="mt-3 grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"><div class="font-medium text-amber-900">该袋线上显示已交出待回收，确认实物空袋后才能使用。</div><label class="flex items-center gap-2"><input type="checkbox" data-skip-page-rerender="true" data-wait-handover-field="repackForceReceived" data-wait-handover-repack-force-received />实物袋已收到</label><label class="flex items-center gap-2"><input type="checkbox" data-skip-page-rerender="true" data-wait-handover-field="repackForceEmpty" data-wait-handover-repack-force-empty />实物袋为空</label><textarea class="min-h-16 rounded-md border bg-white p-2" data-skip-page-rerender="true" data-wait-handover-field="repackForceReason" data-wait-handover-repack-force-reason placeholder="填写强制回收原因"></textarea></div>` : ''
        const blocked = resultBlocked ? `<div class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">${escapeHtml(`${result.bagCode} 当前不是空闲袋，也不是本次来源袋，请更换结果袋。`)}</div>` : ''
        return `<div class="rounded-md border bg-muted/10 p-3" data-wait-handover-repack-result-row="${escapeHtml(result.id)}" data-wait-handover-repack-group-key="${escapeHtml(groupKey)}" data-wait-handover-force-recovery-required="${forceRecoveryRequired ? 'true' : 'false'}" data-wait-handover-result-blocked="${resultBlocked ? 'true' : 'false'}"><div class="flex items-center justify-between gap-2"><span class="text-sm font-semibold">结果袋 ${resultIndex + 1}</span><button type="button" class="rounded border px-2 py-1 text-xs text-rose-700" data-skip-page-rerender="true" data-wait-handover-action="remove-repack-result" data-result-id="${escapeHtml(result.id)}">移除</button></div><div class="mt-3 grid gap-3 md:grid-cols-2"><label class="space-y-1"><span class="text-xs font-medium">复用来源袋</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-wait-handover-field="repackReuseSourceBag"><option value="">不复用，填写其他袋</option>${reusableSourceBagCodes.map((bagCode) => `<option value="${escapeHtml(bagCode)}" ${bagCode === result.bagCode ? 'selected' : ''}>${escapeHtml(bagCode)}</option>`).join('')}</select></label><div class="space-y-1"><span class="text-xs font-medium">其他结果袋编号</span><div class="grid grid-cols-[1fr_auto] gap-2"><input class="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value="${escapeHtml(result.bagCode)}" placeholder="手工填写其他空闲袋编号" data-skip-page-rerender="true" data-wait-handover-field="repackResultBagCode" data-wait-handover-repack-result-bag-code /><button type="button" class="rounded-md border px-3 text-xs font-medium" data-skip-page-rerender="true" data-wait-handover-action="validate-repack-result">核对袋码</button></div></div></div>${forceRecovery}${blocked}</div>`
      }).join('')
      const assignmentRows = groupTickets.map((ticket) => {
        const hadPreviousAssignment = previousAssignments.has(ticket.feiTicketId)
        const previous = previousAssignments.get(ticket.feiTicketId) || ''
        const sourceBagCode = sourceBagCodes.find((bagCode) => resolveActionBagCurrent(bagCode).tickets.some((item) => item.feiTicketId === ticket.feiTicketId)) || ''
        const reusedSourceResultId = groupResults.find((result) => result.bagCode === sourceBagCode)?.id || ''
        const assignedResultId = groupResults.some((result) => result.id === previous)
          ? previous
          : hadPreviousAssignment ? '' : reusedSourceResultId
        return `<label class="grid gap-2 rounded-md border bg-background p-2 text-xs md:grid-cols-[1fr_14rem] md:items-center"><span>${escapeHtml(`${ticket.feiTicketNo} / ${ticket.pieceQty} 片 / 来源 ${sourceBagCode}`)}</span><select class="h-9 rounded-md border bg-background px-2" data-skip-page-rerender="true" data-wait-handover-field="repackTicketAssignment" data-wait-handover-repack-ticket-assignment data-ticket-id="${escapeHtml(ticket.feiTicketId)}"><option value="" ${assignedResultId ? '' : 'selected'}>请选择结果袋</option>${groupResults.map((result, index) => `<option value="${escapeHtml(result.id)}" ${result.id === assignedResultId ? 'selected' : ''}>装入结果袋 ${index + 1}</option>`).join('')}</select></label>`
      }).join('')
      return `<article class="rounded-lg border bg-background p-3"><div class="flex flex-wrap items-start justify-between gap-3"><div><div class="font-semibold">${escapeHtml(receiverFactoryName || '接收车缝工厂待核对')}</div><div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(productionOrderNo || '待核查')} · ${groupTickets.length} 张 · ${groupTickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)} 片</div></div><button type="button" class="rounded-md border px-3 py-2 text-xs font-medium text-violet-700" data-skip-page-rerender="true" data-wait-handover-action="add-repack-result-for-group" data-group-key="${escapeHtml(groupKey)}">增加结果袋</button></div><div class="mt-3 space-y-3">${resultRows || '<div class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">本组需要指定结果袋，当前任务菲票必须全部进入结果袋后交出。</div>'}</div><div class="mt-3"><div class="mb-2 text-xs font-medium">逐张确认菲票去向</div><div class="space-y-2">${assignmentRows}</div></div></article>`
    }).join('')
  }
  const assignmentsRegion = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-ticket-assignments]')
  if (assignmentsRegion) assignmentsRegion.innerHTML = ''
  const sourceReturnsRegion = dialog.querySelector<HTMLElement>('[data-wait-handover-repack-source-returns]')
  if (sourceReturnsRegion) {
    const assignmentByTicketId = readRepackAssignments(dialog)
    const resultBagCodes = results.map((result) => result.bagCode.trim()).filter(Boolean)
    sourceReturnsRegion.innerHTML = repackSourceBagCodes.map((bagCode) => {
      const current = resolveActionBagCurrent(bagCode)
      const retainedTickets = current.tickets.filter((ticket) => !assignmentByTicketId.get(ticket.feiTicketId))
      const retainedPieceQty = retainedTickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
      if (resultBagCodes.includes(bagCode)) {
        return `<div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm"><div class="font-semibold">${escapeHtml(bagCode)} · 作为结果袋</div><div class="mt-1 text-xs text-blue-800">确认重装后直接交出，不重新入仓。${retainedTickets.length ? ` 当前仍有 ${retainedTickets.length} 张菲票未装入结果袋，请返回上一步处理。` : ''}</div></div>`
      }
      if (!retainedTickets.length) {
        return `<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm"><div class="font-semibold">${escapeHtml(bagCode)} · 重装后空闲</div><div class="mt-1 text-xs text-emerald-800">菲票已全部转出，系统释放原库位。</div></div>`
      }
      const original = resolveActionBagLocation(bagCode)
      const previous = previousReturnDrafts.get(bagCode)
      const warehouseArea = previous?.warehouseArea || original?.warehouseArea || ''
      const locationCode = previous?.locationCode || original?.locationCode || ''
      return `<div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm" data-wait-handover-repack-source-return-row data-source-bag-code="${escapeHtml(bagCode)}"><div class="font-semibold">${escapeHtml(bagCode)} · 剩余 ${retainedTickets.length} 张 / ${retainedPieceQty} 片</div><div class="mt-1 text-xs text-amber-800">原库位：${escapeHtml(original ? `${original.warehouseArea} / ${original.locationCode}` : '无法确认，请填写新库位')}</div><div class="mt-3 grid gap-3 md:grid-cols-2"><label class="space-y-1"><span class="text-xs font-medium">回仓库区</span><input class="h-10 w-full rounded-md border bg-white px-3 text-sm" value="${escapeHtml(warehouseArea)}" placeholder="手工填写或选择有效库区" data-skip-page-rerender="true" data-wait-handover-field="repackReturnArea" data-wait-handover-repack-return-area /></label><label class="space-y-1"><span class="text-xs font-medium">回仓库位</span><input class="h-10 w-full rounded-md border bg-white px-3 text-sm" value="${escapeHtml(locationCode)}" placeholder="默认原库位，可手工修改" data-skip-page-rerender="true" data-wait-handover-field="repackReturnLocation" data-wait-handover-repack-return-location /></label></div></div>`
    }).join('') || '<div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">尚未添加来源袋。</div>'
  }
  setRepackStep(dialog, sourceBagCodes.length ? currentRepackStep(dialog) : 1)
  refreshRepackAssignmentEligibility(dialog)
}

function refreshRepackPreview(dialog: HTMLElement): void {
  renderRepackEditor(dialog)
}

function addRepackSource(dialog: HTMLElement): void {
  const manualInput = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="repackSourceBagCode"]')
  const sourceSelect = dialog.querySelector<HTMLSelectElement>('select[data-wait-handover-field="sourceBagCodes"]')
  if (!sourceSelect) throw new Error('来源袋选择区域不可用，请关闭后重试。')
  const bagCodes = splitCodes(manualInput?.value || '')
  if (!bagCodes.length) throw new Error('请填写来源袋编号。')
  bagCodes.forEach((bagCode) => {
    const current = resolveActionBagCurrent(bagCode)
    if (!['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage || '') || !current.tickets.length) {
      throw new Error(`${bagCode} 当前没有可重装菲票，请核对袋码和流转阶段。`)
    }
    if (current.compatibilityBlockedReason) throw new Error(`${bagCode} ${current.compatibilityBlockedReason}`)
    const productionOrderNos = unique(current.tickets.map((ticket) => ticket.productionOrderNo))
    if (productionOrderNos.length !== 1) {
      throw new Error(`${bagCode} 当前混有 ${productionOrderNos.length} 个生产单，不能重装，请叫主管核查历史袋票关系。`)
    }
    let option = Array.from(sourceSelect.options).find((item) => item.value === bagCode)
    if (!option) {
      option = document.createElement('option')
      option.value = bagCode
      option.textContent = bagCode
      sourceSelect.append(option)
    }
    option.selected = true
  })
  if (manualInput) manualInput.value = ''
  renderRepackEditor(dialog)
  showFeedback(dialog, `已添加来源袋：${bagCodes.join('、')}。`)
}

function removeRepackSource(dialog: HTMLElement, bagCode: string): void {
  const sourceSelect = dialog.querySelector<HTMLSelectElement>('select[data-wait-handover-field="sourceBagCodes"]')
  const option = Array.from(sourceSelect?.options || []).find((item) => item.value === bagCode)
  if (option) option.selected = false
  renderRepackEditor(dialog)
}

function recoveryEligibilityInput(dialog: HTMLElement) {
  return {
    bagCode: readField(dialog, 'bagCode'),
    physicalBagReceived: readChecked(dialog, 'physicalBagReceived'),
    physicalBagEmpty: readChecked(dialog, 'physicalBagEmpty'),
    recoveryMode: (readRadio(dialog, 'recoveryMode') || 'NORMAL') as 'NORMAL' | 'FORCED',
    recoveryNode: readField(dialog, 'recoveryNode'),
    recoveryLocation: readField(dialog, 'recoveryLocation'),
    reason: readField(dialog, 'reason'),
    operatorName: readField(dialog, 'operatorName'),
    secondConfirm: readChecked(dialog, 'secondConfirm'),
  }
}

function scrapEligibilityInput(dialog: HTMLElement) {
  return {
    recoverFirst: readChecked(dialog, 'recoverFirst'),
    physicalBagReceived: readChecked(dialog, 'physicalBagReceived'),
    physicalBagEmpty: readChecked(dialog, 'physicalBagEmpty'),
    reason: readField(dialog, 'reason'),
    authorizedBy: readField(dialog, 'authorizedBy'),
    operatorName: readField(dialog, 'operatorName'),
    secondConfirm: readChecked(dialog, 'secondConfirm'),
  }
}

function refreshRecoveryEligibility(dialog: HTMLElement, current: WaitHandoverDialogCurrent | null): void {
  const input = recoveryEligibilityInput(dialog)
  const eligibility = dialog.querySelector<HTMLElement>('[data-wait-handover-recovery-eligibility]')
  if (eligibility) eligibility.outerHTML = renderWaitHandoverRecoveryEligibility(current, input)
  const submit = dialog.querySelector<HTMLButtonElement>('[data-wait-handover-action="submit-recovery"]')
  if (submit) submit.disabled = isWaitHandoverRecoveryBlocked(current, input)
}

function refreshScrapEligibility(dialog: HTMLElement, current: WaitHandoverDialogCurrent | null): void {
  const input = scrapEligibilityInput(dialog)
  const eligibility = dialog.querySelector<HTMLElement>('[data-wait-handover-eligibility]')
  if (eligibility) eligibility.outerHTML = renderWaitHandoverScrapEligibility(current)
  const submit = dialog.querySelector<HTMLButtonElement>('[data-wait-handover-action="submit-scrap"]')
  if (!submit) return
  const blocked = isWaitHandoverScrapBlocked(current, input)
  submit.disabled = blocked
  submit.dataset.waitHandoverSubmitDisabled = String(blocked)
}

function refreshBagEligibility(dialog: HTMLElement): void {
  const bagCode = readField(dialog, 'bagCode')
  const current = bagCode ? dialogCurrent(resolveActionBagCurrent(bagCode)) : null
  const summary = dialog.querySelector<HTMLElement>('[data-wait-handover-bag-summary]')
  if (summary) summary.outerHTML = renderWaitHandoverBagSummary(current)
  if (dialog.dataset.waitHandoverModal === 'recovery') refreshRecoveryEligibility(dialog, current)
  if (dialog.dataset.waitHandoverModal === 'scrap') refreshScrapEligibility(dialog, current)
}

export function handleWaitHandoverActionEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-wait-handover-field]')
  const bagDialog = fieldNode?.closest<HTMLElement>('[data-wait-handover-modal]')
  const localEligibilityFields = [
    'bagCode', 'recoveryMode', 'physicalBagReceived', 'physicalBagEmpty', 'reason',
    'recoveryNode', 'recoveryLocation', 'secondConfirm', 'recoverFirst', 'authorizedBy', 'operatorName',
  ]
  if (bagDialog && ['recovery', 'scrap'].includes(bagDialog.dataset.waitHandoverModal || '')
    && localEligibilityFields.includes(fieldNode?.dataset.waitHandoverField || '')) {
    refreshBagEligibility(bagDialog)
    return true
  }
  const repackDialogSelector = '[data-wait-handover-modal="repack"], [data-wait-handover-modal="handover"]'
  const fieldDialog = fieldNode?.closest<HTMLElement>(repackDialogSelector)
  if (fieldDialog && fieldNode?.dataset.waitHandoverField === 'handoverTaskSelection') {
    refreshHandoverTaskContext(fieldDialog)
    return true
  }
  if (fieldDialog && fieldNode?.dataset.waitHandoverField === 'sourceBagCodes') {
    refreshRepackPreview(fieldDialog)
    return true
  }
  if (fieldDialog && fieldNode?.dataset.waitHandoverField === 'repackTicketAssignment') {
    renderRepackEditor(fieldDialog)
    return true
  }
  if (fieldDialog && fieldNode?.dataset.waitHandoverField === 'repackReuseSourceBag') {
    const row = fieldNode.closest<HTMLElement>('[data-wait-handover-repack-result-row]')
    const input = row?.querySelector<HTMLInputElement>('[data-wait-handover-repack-result-bag-code]')
    if (input) input.value = (fieldNode as HTMLSelectElement).value
    renderRepackEditor(fieldDialog)
    return true
  }
  if (fieldDialog && ['repackForceRecovery', 'repackForceReceived', 'repackForceEmpty', 'repackForceReason'].includes(fieldNode?.dataset.waitHandoverField || '')) {
    refreshRepackAssignmentEligibility(fieldDialog)
    return true
  }
  if (fieldDialog && ['repackReturnArea', 'repackReturnLocation'].includes(fieldNode?.dataset.waitHandoverField || '')) {
    refreshRepackAssignmentEligibility(fieldDialog)
    return true
  }
  if (fieldDialog && fieldNode?.dataset.waitHandoverField === 'repackResultBagCode') {
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wait-handover-action], [data-wait-handover-web-action]')
  const actionName = actionNode?.dataset.waitHandoverAction || actionNode?.dataset.waitHandoverWebAction || ''
  if (!actionName) return false
  if (actionName === 'close-dialog') {
    modalRoot()?.remove()
    return true
  }
  if (actionName === 'add-repack-source') {
    const dialog = actionNode?.closest<HTMLElement>(repackDialogSelector)
    if (!dialog) return false
    try {
      addRepackSource(dialog)
    } catch (error) {
      showFeedback(dialog, error instanceof Error ? error.message : '来源袋添加失败，请核对后重试。', true)
    }
    return true
  }
  if (actionName === 'remove-repack-source') {
    const dialog = actionNode?.closest<HTMLElement>(repackDialogSelector)
    if (!dialog) return false
    removeRepackSource(dialog, actionNode?.dataset.sourceBagCode || '')
    return true
  }
  if (actionName === 'validate-repack-result') {
    const dialog = actionNode?.closest<HTMLElement>(repackDialogSelector)
    if (!dialog) return false
    renderRepackEditor(dialog)
    return true
  }
  if (actionName === 'add-repack-result-for-group' || actionName === 'remove-repack-result') {
    const dialog = actionNode?.closest<HTMLElement>(repackDialogSelector)
    if (!dialog) return false
    renderRepackEditor(dialog, actionName === 'add-repack-result-for-group'
      ? { addResultGroupKey: actionNode?.dataset.groupKey || '' }
      : { removeResultId: actionNode?.dataset.resultId || '' })
    return true
  }
  if (actionName === 'repack-next' || actionName === 'repack-back') {
    const dialog = actionNode?.closest<HTMLElement>(repackDialogSelector)
    if (!dialog) return false
    const step = currentRepackStep(dialog)
    if (actionName === 'repack-next') {
      const message = validateRepackStepBeforeNext(dialog, step)
      if (message) {
        showFeedback(dialog, message, true)
        return true
      }
      setRepackStep(dialog, step + 1)
    } else {
      setRepackStep(dialog, step - 1)
    }
    refreshRepackAssignmentEligibility(dialog)
    showFeedback(dialog, '')
    return true
  }
  if (actionName.startsWith('open-')) {
    const action = actionName.slice(5) as WaitHandoverWebAction
    if (!['bagging', 'inbound', 'repack', 'handover', 'special-craft-return', 'recovery', 'scrap'].includes(action)) return false
    openWaitHandoverAction(action === 'repack' ? 'handover' : action, actionNode?.dataset.waitHandoverSelection || '')
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
