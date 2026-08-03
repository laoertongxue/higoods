import { escapeHtml } from '../utils'
import {
  buildPdaUniversalHandoverRecordDraft,
  listHandoverRecords,
  type HandoverRecord,
  type PdaHandoverRecordDraftProjection,
} from '../data/fcs/cutting/handover-orders.ts'
import { buildPdaCuttingHandoverProjection } from './pda-cutting-handover-projection'
import {
  resolvePdaCuttingRuntimeIdentity,
  resolvePdaCuttingRuntimeOperator,
} from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { validateFeiTicketNumberingBeforeBagging } from '../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  type HandoverRecordSubmitPayload,
  type SpecialCraftHandoverPayload,
  type SpecialCraftReturnPayload,
} from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../data/browser-storage.ts'
import {
  resolveTransferBagCurrentUse,
  resolveWholeBagHandoverEligibility,
  submitWholeBagHandover,
} from '../data/fcs/cutting/transfer-bag-operations.ts'
import {
  appendWaitHandoverHandoverRecordEvent,
  appendWaitHandoverSpecialCraftHandoverEvent,
  appendWaitHandoverSpecialCraftReturnEvent,
  buildWaitHandoverLocationOccupancyStates,
  listWaitHandoverRuntimeEvents,
  runtimeEventHasWaitHandoverTicket,
} from './process-factory/cutting/wait-handover-runtime.ts'
import {
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
} from './pda-cutting-shared'
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'
import {
  PDA_PAGE_HANDLED_LOCALLY,
  type PdaPageEventResult,
} from '../main-handlers/pda-local-action-result'
import { getCurrentFactoryWarehouseByKind } from './pda-warehouse-shared'
import { loadWarehouseLayoutSnapshot } from './process-factory/cutting/warehouse-location-layout-store.ts'
import {
  buildWarehouseLocationMapProjection,
  listWarehouseLocationMapCells,
  revalidateWarehouseLocationSelection,
  toggleWarehouseLocationSelection,
  type StableWarehouseLocationRef,
  type WarehouseLocationMapProjection,
  type WarehouseLocationOccupancy,
} from './process-factory/cutting/warehouse-location-map-model.ts'
import {
  handleWarehouseLocationMapOccupancyEvent,
  renderWarehouseLocationMap,
} from '../components/ui/warehouse-location-map.ts'

interface HandoverFormState {
  operatorName: string
  targetLabel: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
  handoverOrderScan: string
  handoverBagScan: string
  handoverFeiTicketScan: string
  specialCraftOrderScan: string
  specialCraftBagScan: string
  specialCraftFeiTicketScan: string
  specialCraftReturnBagScan: string
  specialCraftReturnFeiTicketScan: string
  specialCraftReturnLocationScan: string
  specialCraftReturnLocationIds: string[]
  specialCraftReturnQty: string
}

const handoverState = new Map<string, HandoverFormState>()

export const PDA_CUTTING_TRANSFER_BAG_SCAN_DEBOUNCE_MS = 150

export interface PdaTransferBagHandoverFormState {
  bagCode: string
  sewingTaskNo: string
  sewingTaskNos: string[]
  usageCycleId: string
  productionOrderNo: string
  receiverFactoryId: string
  receiverFactoryName: string
  ticketCount: number | null
  pieceQty: number | null
  scanFeedbackMessage: string
  resultMessage: string
  resultBagCode: string
  resultFactoryName: string
  handoverRecordNo: string
}

const transferBagHandoverState = new Map<string, PdaTransferBagHandoverFormState>()

export function createPdaTransferBagHandoverFormState(): PdaTransferBagHandoverFormState {
  return {
    bagCode: '',
    sewingTaskNo: '',
    sewingTaskNos: [],
    usageCycleId: '',
    productionOrderNo: '',
    receiverFactoryId: '',
    receiverFactoryName: '',
    ticketCount: null,
    pieceQty: null,
    scanFeedbackMessage: '',
    resultMessage: '',
    resultBagCode: '',
    resultFactoryName: '',
    handoverRecordNo: '',
  }
}

function buildPdaTransferBagHandoverAssignments(
  tickets: ReturnType<typeof resolveTransferBagCurrentUse>['tickets'],
) {
  return tickets.map((ticket) => ({
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    sewingTaskId: ticket.sewingTaskId,
    sewingTaskNo: ticket.sewingTaskNo,
    receiverFactoryId: ticket.receiverFactoryId,
    receiverFactoryName: ticket.receiverFactoryName,
  }))
}

function currentIndonesiaDateTime(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

export function scanPdaTransferBagForHandover(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): { ok: boolean; state: PdaTransferBagHandoverFormState } {
  const normalizedBagCode = normalizeScanValue(bagCode).toUpperCase()
  const failed = (message: string) => ({
    ok: false,
    state: {
      ...createPdaTransferBagHandoverFormState(),
      bagCode: normalizedBagCode,
      scanFeedbackMessage: message,
    },
  })
  if (!normalizedBagCode) return failed('请扫描中转袋。')

  const currentUse = resolveTransferBagCurrentUse(normalizedBagCode, storage)
  if (currentUse.mainStatus === 'DISABLED') return failed('这个中转袋已报废，不能交出。')
  if (!currentUse.usageCycleId) return failed('没有找到这个中转袋的当前装袋记录。')
  if (currentUse.flowStage === 'PACKED') return failed('这个中转袋菲票已装袋，请先入仓。')
  if (currentUse.flowStage === 'HANDED_OVER_WAITING_RETURN') {
    return failed('这个中转袋已交出，正在等待实物袋回收。')
  }
  if (currentUse.flowStage !== 'INBOUND_STORED' && currentUse.flowStage !== 'READY_HANDOVER') {
    return failed('这个中转袋当前不能交出，请先核对袋内菲票和所处阶段。')
  }

  const eligibility = resolveWholeBagHandoverEligibility({
    currentUse,
    assignments: buildPdaTransferBagHandoverAssignments(currentUse.tickets),
    existingHandoverEvents: listWaitHandoverRuntimeEvents(storage),
    submittedTicketSnapshot: currentUse.tickets,
  })
  if (!eligibility.ok) return failed(eligibility.reason)

  return {
    ok: true,
    state: {
      ...createPdaTransferBagHandoverFormState(),
      bagCode: currentUse.bagCode,
      usageCycleId: currentUse.usageCycleId,
      sewingTaskNo: eligibility.sewingTaskNos.join('、'),
      sewingTaskNos: eligibility.sewingTaskNos,
      productionOrderNo: currentUse.productionOrderNo,
      receiverFactoryId: eligibility.receiverFactoryId,
      receiverFactoryName: eligibility.receiverFactoryName,
      ticketCount: eligibility.ticketSnapshot.length,
      pieceQty: eligibility.ticketSnapshot.reduce((sum, ticket) => sum + ticket.pieceQty, 0),
      scanFeedbackMessage: `${currentUse.bagCode} 已识别，可以整袋交出。`,
    },
  }
}

export function submitPdaTransferBagHandover(
  state: PdaTransferBagHandoverFormState,
  taskId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagHandoverFormState {
  const scanned = scanPdaTransferBagForHandover(state.bagCode, storage)
  if (!scanned.ok) {
    return {
      ...scanned.state,
      resultMessage: scanned.state.scanFeedbackMessage,
    }
  }
  const current = resolveTransferBagCurrentUse(scanned.state.bagCode, storage)
  const assignments = buildPdaTransferBagHandoverAssignments(current.tickets)
  const operator = resolvePdaCuttingRuntimeOperator(taskId, '裁片仓交出员')
  const stableKey = current.usageCycleId!.replace(/[^A-Za-z0-9]/g, '-')
  const handoverRecordNo = `PDA-${scanned.state.bagCode}-${stableKey}-整袋交出`
  try {
    submitWholeBagHandover({
      bagCode: scanned.state.bagCode,
      usageCycleId: current.usageCycleId!,
      handoverOrderId: `PDA-HO-${stableKey}`,
      handoverOrderNo: `PDA-${scanned.state.productionOrderNo}-交出`,
      handoverRecordId: `PDA-HR-${stableKey}`,
      handoverRecordNo,
      assignments,
      submittedTicketSnapshot: current.tickets,
      source: 'PDA',
      occurredAt: currentIndonesiaDateTime(),
      operator: {
        operatorId: operator.operatorAccountId,
        operatorName: operator.operatorName,
        operatorRole: operator.operatorRole,
      },
    }, storage)
    return {
      ...createPdaTransferBagHandoverFormState(),
      resultMessage: '交出成功，等待实物袋回收。',
      resultBagCode: scanned.state.bagCode,
      resultFactoryName: scanned.state.receiverFactoryName,
      handoverRecordNo,
    }
  } catch (error) {
    return {
      ...scanned.state,
      resultMessage: error instanceof Error ? error.message : '交出失败，请检查后重试。',
    }
  }
}

function clearPdaTransferBagHandoverScanDraft(
  _state: PdaTransferBagHandoverFormState,
): PdaTransferBagHandoverFormState {
  return createPdaTransferBagHandoverFormState()
}

export function resolvePdaTransferBagHandoverScanTrigger(
  event: { type: string; key?: string },
): 'immediate' | 'debounced' | 'none' {
  if (event.type === 'keydown') return event.key === 'Enter' ? 'immediate' : 'none'
  if (event.type === 'input' || event.type === 'compositionend') return 'debounced'
  return 'none'
}

export interface PdaTransferBagHandoverScanTimerController {
  schedule: (stateKey: string, callback: () => void) => void
  flush: (stateKey: string) => boolean
  cancel: (stateKey: string) => void
  cancelAll: () => void
  hasPending: (stateKey: string) => boolean
}

export function createPdaTransferBagHandoverScanTimerController(
  scheduleTimer: (callback: () => void, delayMs: number) => unknown = (callback, delayMs) =>
    setTimeout(callback, delayMs),
  cancelTimer: (timer: unknown) => void = (timer) =>
    clearTimeout(timer as ReturnType<typeof setTimeout>),
): PdaTransferBagHandoverScanTimerController {
  const pendingByStateKey = new Map<string, { timer: unknown; callback: () => void; round: number }>()
  const roundByStateKey = new Map<string, number>()
  const nextRound = (stateKey: string): number => {
    const round = (roundByStateKey.get(stateKey) || 0) + 1
    roundByStateKey.set(stateKey, round)
    return round
  }
  const cancel = (stateKey: string): void => {
    nextRound(stateKey)
    const pending = pendingByStateKey.get(stateKey)
    if (pending) cancelTimer(pending.timer)
    pendingByStateKey.delete(stateKey)
  }

  return {
    schedule(stateKey, callback) {
      cancel(stateKey)
      const round = nextRound(stateKey)
      const pending = { timer: undefined as unknown, callback, round }
      pending.timer = scheduleTimer(() => {
        if (roundByStateKey.get(stateKey) !== round || pendingByStateKey.get(stateKey) !== pending) return
        pendingByStateKey.delete(stateKey)
        callback()
      }, PDA_CUTTING_TRANSFER_BAG_SCAN_DEBOUNCE_MS)
      pendingByStateKey.set(stateKey, pending)
    },
    flush(stateKey) {
      const pending = pendingByStateKey.get(stateKey)
      if (!pending) return false
      cancel(stateKey)
      pending.callback()
      return true
    },
    cancel,
    cancelAll() {
      Array.from(pendingByStateKey.keys()).forEach(cancel)
    },
    hasPending(stateKey) {
      return pendingByStateKey.has(stateKey)
    },
  }
}

const transferBagScanTimerController = createPdaTransferBagHandoverScanTimerController()

export function cancelPdaTransferBagHandoverPendingScans(): void {
  transferBagScanTimerController.cancelAll()
}

if (typeof window !== 'undefined') {
  window.addEventListener('higood:pda-cutting-handover-leave', cancelPdaTransferBagHandoverPendingScans)
}

function getHandoverDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingHandoverProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): HandoverFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = handoverState.get(stateKey)
  if (existing) return existing
  const detail = getHandoverDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initial: HandoverFormState = {
    operatorName: '交出操作员',
    targetLabel: detail?.handoverTargetLabel && detail.handoverTargetLabel !== '待确定后道去向' ? detail.handoverTargetLabel : '裁片仓交出位',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
    handoverOrderScan: '',
    handoverBagScan: '',
    handoverFeiTicketScan: '',
    specialCraftOrderScan: '',
    specialCraftBagScan: '',
    specialCraftFeiTicketScan: '',
    specialCraftReturnBagScan: '',
    specialCraftReturnFeiTicketScan: '',
    specialCraftReturnLocationScan: '',
    specialCraftReturnLocationIds: [],
    specialCraftReturnQty: '',
  }
  handoverState.set(stateKey, initial)
  return initial
}

function renderHandoverHistory(detail: NonNullable<ReturnType<typeof getHandoverDetail>>): string {
  if (!detail || !detail.handoverRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无交出记录', '')
  }

  return `
    <div class="space-y-2">
      ${detail.handoverRecords
        .map(
          (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.resultLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.handoverAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">交出对象：${escapeHtml(record.targetLabel)}</div>
              <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderHandoverStatus(detail: NonNullable<ReturnType<typeof getHandoverDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前交出状态', value: detail.currentHandoverStatus },
    { label: '当前交出对象', value: detail.handoverTargetLabel },
    { label: '最近交出记录', value: detail.latestHandoverRecordNo || '暂无记录' },
    { label: '最近交出时间', value: detail.latestHandoverAt, hint: detail.latestHandoverBy },
  ])
}

function normalizeScanValue(value: string): string {
  return value.trim()
}

function matchesScannedValue(value: string, candidates: Array<string | undefined>): boolean {
  const normalized = normalizeScanValue(value)
  if (!normalized) return false
  return candidates.some((candidate) => candidate && normalizeScanValue(candidate) === normalized)
}

export function normalizePdaCuttingHandoverAction(action: string): string {
  return action === 'handover-bagging-confirm' ? 'transfer-bag-handover' : action
}

function readPdaCuttingHandoverActionFromLocation(): string {
  if (typeof window === 'undefined') return ''
  return normalizePdaCuttingHandoverAction(
    new URLSearchParams(window.location.search).get('action') || '',
  )
}

function renderPdaScanInput(label: string, field: keyof HandoverFormState, value: string, placeholder: string): string {
  return `
    <label class="block space-y-1">
      <span class="text-muted-foreground">${escapeHtml(label)}</span>
      <input
        class="h-10 w-full rounded-xl border bg-background px-3 text-sm"
        data-pda-cut-handover-field="${escapeHtml(field)}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
      />
    </label>
  `
}

function syncHandoverFormFromControls(form: HandoverFormState, container: ParentNode = document): void {
  container.querySelectorAll<HTMLElement>('[data-pda-cut-handover-field]').forEach((fieldNode) => {
    const field = fieldNode.dataset.pdaCutHandoverField
    if (!field || !(field in form)) return
    if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement) {
      ;(form as unknown as Record<string, string>)[field] = fieldNode.value
    }
  })
}

function runtimeEventHasTicket(eventType: string, feiTicketId: string, specialCraftId?: string): boolean {
  return runtimeEventHasWaitHandoverTicket(eventType, feiTicketId, specialCraftId)
}

function findHandoverRecordForDraft(draft: PdaHandoverRecordDraftProjection): HandoverRecord | undefined {
  return listHandoverRecords().find((record) => record.handoverOrderId === draft.handoverOrderId)
}

function validateUniversalHandoverScans(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord,
  form: HandoverFormState,
):
  | {
      ok: true
      bag: HandoverRecord['transferBagUses'][number]
      ticket: HandoverRecord['feiTicketItems'][number]
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.handoverOrderScan, [draft.handoverOrderNo, draft.handoverOrderId])) {
    return { ok: false, message: '请先扫描当前交出单。' }
  }
  const bag = sourceRecord.transferBagUses.find((item) => matchesScannedValue(form.handoverBagScan, [item.bagCode, item.bagUseId]))
  if (!bag) return { ok: false, message: '该中转袋不属于当前交出单。' }

  const ticket = sourceRecord.feiTicketItems.find((item) => matchesScannedValue(form.handoverFeiTicketScan, [item.feiTicketNo, item.feiTicketId]))
  if (!ticket) return { ok: false, message: '该菲票不属于当前交出单。' }
  if (bag.containedFeiTicketIds.length && !bag.containedFeiTicketIds.includes(ticket.feiTicketId)) {
    return { ok: false, message: '该菲票不在已扫描的交出中转袋中。' }
  }
  const numberingValidation = validateFeiTicketNumberingBeforeBagging({
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    partName: ticket.partName,
    pieceSequenceLabel: ticket.pieceSequenceLabel,
  })
  if (!numberingValidation.ok) return { ok: false, message: numberingValidation.reason }
  if (runtimeEventHasTicket('新增交出记录', ticket.feiTicketId)) {
    return { ok: false, message: '该菲票已有交出记录事件，不能重复交出。' }
  }
  return { ok: true, bag, ticket }
}

function appendRuntimeUniversalHandoverEvent(draft: PdaHandoverRecordDraftProjection, form: HandoverFormState, operatorName: string): string {
  const sourceRecord = findHandoverRecordForDraft(draft)
  if (!sourceRecord || !sourceRecord.feiTicketItems.length) return '当前交出单没有可提交的菲票明细。'
  const validation = validateUniversalHandoverScans(draft, sourceRecord, form)
  if (!validation.ok) return validation.message

  const now = new Date().toISOString()
  const recordId = `PDA-HR-${draft.handoverOrderId}-${now.replace(/\D/g, '')}`
  const recordNo = `${draft.handoverOrderNo}-PDA-${String(draft.nextRecordSequence).padStart(3, '0')}`
  const payload: HandoverRecordSubmitPayload = {
    handoverOrderId: draft.handoverOrderId,
    handoverOrderNo: draft.handoverOrderNo,
    handoverRecordId: recordId,
    handoverRecordNo: recordNo,
    receiverType: draft.receiverType,
    receiverId: sourceRecord.receiverId,
    receiverName: draft.receiverName,
    transferBagUses: [{
      bagUseId: validation.bag.bagUseId,
      bagCode: validation.bag.bagCode,
      containedFeiTicketIds: [validation.ticket.feiTicketId],
      totalPieceQty: validation.ticket.pieceQty,
    }],
    feiTicketItems: [{
      feiTicketId: validation.ticket.feiTicketId,
      feiTicketNo: validation.ticket.feiTicketNo,
      pieceQty: validation.ticket.pieceQty,
      unit: '片',
    }],
    currentHandedOverQty: validation.ticket.pieceQty,
    submittedAt: now,
    submittedBy: operatorName,
  }

  appendWaitHandoverHandoverRecordEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '裁片仓交出员',
    },
    payload,
    fromWarehouseArea: sourceRecord.sourceWarehouseName,
    fromLocationCode: validation.bag.bagCode,
    usageCycleId: validation.bag.bagUseId,
    occurredAt: now,
  })

  return `已同步交出记录：${recordNo}，本次交出 ${payload.currentHandedOverQty} 片。`
}

function validateSpecialCraftHandoverScans(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord,
  form: HandoverFormState,
):
  | {
      ok: true
      bag: HandoverRecord['transferBagUses'][number]
      craftItems: NonNullable<HandoverRecord['specialCraftItems']>
      ticketNo: string
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.specialCraftOrderScan, [draft.handoverOrderNo, draft.handoverOrderId])) {
    return { ok: false, message: '请先扫描当前特殊工艺交出单。' }
  }
  const bag = sourceRecord.transferBagUses.find((item) => matchesScannedValue(form.specialCraftBagScan, [item.bagCode, item.bagUseId]))
  if (!bag) return { ok: false, message: '该中转袋不属于当前特殊工艺交出单。' }

  const ticket = sourceRecord.feiTicketItems.find((item) => matchesScannedValue(form.specialCraftFeiTicketScan, [item.feiTicketNo, item.feiTicketId]))
  if (!ticket) return { ok: false, message: '该菲票不属于当前特殊工艺交出单。' }
  if (bag.containedFeiTicketIds.length && !bag.containedFeiTicketIds.includes(ticket.feiTicketId)) {
    return { ok: false, message: '该菲票不在已扫描的特殊工艺中转袋中。' }
  }

  const bagTicketIds = bag.containedFeiTicketIds.length
    ? bag.containedFeiTicketIds
    : sourceRecord.feiTicketItems.map((item) => item.feiTicketId)
  const craftItems = (sourceRecord.specialCraftItems || []).filter(
    (item) => bagTicketIds.includes(item.feiTicketId),
  )
  if (!craftItems.length) return { ok: false, message: '该中转袋没有当前交出单的特殊工艺明细。' }
  const craftTicketIds = new Set(craftItems.map((item) => item.feiTicketId))
  if (bagTicketIds.some((feiTicketId) => !craftTicketIds.has(feiTicketId))) {
    return { ok: false, message: '该中转袋内存在未归入当前特殊工艺的菲票，不能部分交出。' }
  }
  const firstCraft = craftItems[0]
  if (
    craftItems.some(
      (item) =>
        item.craftCategory !== firstCraft.craftCategory
        || item.craftType !== firstCraft.craftType
        || item.receiverFactoryId !== firstCraft.receiverFactoryId,
    )
  ) {
    return { ok: false, message: '该中转袋内菲票对应不同特殊工艺或接收工厂，请先重新整袋归集。' }
  }
  const repeatedCraft = craftItems.find((item) =>
    runtimeEventHasTicket(
      '特殊工艺交出',
      item.feiTicketId,
      item.specialCraftId,
    ))
  if (repeatedCraft) return { ok: false, message: '该菲票的当前特殊工艺已交出，不能重复交出。' }
  return { ok: true, bag, craftItems, ticketNo: ticket.feiTicketNo }
}

function appendRuntimeSpecialCraftHandoverEvent(draft: PdaHandoverRecordDraftProjection, form: HandoverFormState, operatorName: string): string {
  const sourceRecord = findHandoverRecordForDraft(draft)
  if (!sourceRecord || !sourceRecord.specialCraftItems?.length) return '当前特殊工艺交出单没有工艺明细。'
  const validation = validateSpecialCraftHandoverScans(draft, sourceRecord, form)
  if (!validation.ok) return validation.message

  const now = new Date().toISOString()
  const firstCraft = validation.craftItems[0]
  const payload: SpecialCraftHandoverPayload = {
    handoverOrderId: draft.handoverOrderId,
    handoverRecordId: sourceRecord.handoverRecordId,
    craftCategory: firstCraft.craftCategory,
    craftType: firstCraft.craftType,
    receiverFactoryId: firstCraft.receiverFactoryId,
    receiverFactoryName: firstCraft.receiverFactoryName,
    feiTicketItems: validation.craftItems.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: sourceRecord.feiTicketItems.find((ticket) => ticket.feiTicketId === item.feiTicketId)?.feiTicketNo || item.feiTicketId,
      specialCraftId: item.specialCraftId,
      partName: item.partName,
      size: item.size,
      pieceQty: item.pieceQty,
    })),
    handedOverAt: now,
    handedOverBy: operatorName,
  }
  const totalQty = payload.feiTicketItems.reduce((total, item) => total + item.pieceQty, 0)

  appendWaitHandoverSpecialCraftHandoverEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '特殊工艺交出员',
    },
    payload,
    handoverOrderId: draft.handoverOrderId,
    handoverRecordId: sourceRecord.handoverRecordId,
    specialCraftId: firstCraft.specialCraftId,
    transferBagCode: validation.bag.bagCode,
    fromWarehouseArea: sourceRecord.sourceWarehouseName,
    usageCycleId: validation.bag.bagUseId,
    occurredAt: now,
  })

  return `已同步特殊工艺交出：${validation.ticketNo} / ${firstCraft.craftType}，交出 ${totalQty} 片。`
}

function buildPdaSpecialCraftReturnLocationMapProjection() {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return null
  const snapshot = warehouse.factoryKind === 'CENTRAL_CUTTING'
    ? loadWarehouseLayoutSnapshot(warehouse).snapshot
    : undefined
  const occupancies: WarehouseLocationOccupancy[] = buildWaitHandoverLocationOccupancyStates(
    listWaitHandoverRuntimeEvents(),
  )
    .filter((state) => state.locationRef.factoryId === warehouse.factoryId
      && state.locationRef.warehouseId === warehouse.warehouseId
      && state.locationRef.warehouseKind === warehouse.warehouseKind)
    .map((state) => ({
      occupancyId: `wait-handover:${state.sourceEventId}`,
      footprintId: `bag:${state.bagCode}`,
      locationId: state.locationRef.locationId,
      productionOrderNo: state.productionOrderNo,
      objectNo: state.objectNo || state.bagCode,
      objectName: state.objectName || `中转袋 ${state.bagCode}`,
      qty: state.totalPieceQty,
      unit: '片',
      inboundAt: state.inboundAt,
      inboundBy: state.inboundBy,
    }))
  return buildWarehouseLocationMapProjection(warehouse, snapshot, occupancies)
}

export function validatePdaSpecialCraftReturnLocationSelection(
  selectedLocationIds: string[],
  projectionOverride?: WarehouseLocationMapProjection | null,
) {
  const projection = projectionOverride === undefined
    ? buildPdaSpecialCraftReturnLocationMapProjection()
    : projectionOverride
  return projection
    ? revalidateWarehouseLocationSelection(projection, selectedLocationIds)
    : { ok: false, message: '当前裁床工厂没有可用的待交出仓。', selectedLocationIds: [] }
}

function listSelectedSpecialCraftReturnLocations(selectedLocationIds: string[]): StableWarehouseLocationRef[] {
  const projection = buildPdaSpecialCraftReturnLocationMapProjection()
  if (!projection) return []
  const selected = new Set(selectedLocationIds)
  return listWarehouseLocationMapCells(projection).filter((cell) => selected.has(cell.locationId))
}

export function applyPdaSpecialCraftReturnLocationScan(
  selectedLocationIds: string[],
  scanValue: string,
  projection: WarehouseLocationMapProjection,
): { selectedLocationIds: string[]; message: string } {
  const normalized = normalizeScanValue(scanValue).normalize('NFKC').toUpperCase()
  const stableParts = scanValue.trim().split('|')
  if (stableParts.length === 4 && (
    stableParts[0] !== projection.factoryId
    || stableParts[1] !== projection.warehouseId
    || stableParts[2] !== projection.warehouseKind
  )) {
    return { selectedLocationIds, message: '该库位不属于当前仓库，请重新扫描。' }
  }
  const location = listWarehouseLocationMapCells(projection)
    .find((cell) => cell.locationNo.normalize('NFKC').toUpperCase() === normalized
      || `${cell.factoryId}|${cell.warehouseId}|${cell.warehouseKind}|${cell.locationId}` === scanValue.trim())
  if (!location) return { selectedLocationIds, message: '库位不存在，请重新扫描。' }
  if (location.areaStatus !== 'AVAILABLE') return { selectedLocationIds, message: '库区已停用，请更换库位。' }
  if (location.shelfStatus !== 'AVAILABLE') return { selectedLocationIds, message: '货架已停用，请更换库位。' }
  if (location.status !== 'AVAILABLE') return { selectedLocationIds, message: '库位已停用，请更换库位。' }
  if (location.businessStatus === 'OCCUPIED') return { selectedLocationIds, message: '该库位已占用，请更换库位。' }
  if (selectedLocationIds.includes(location.locationId)) return { selectedLocationIds, message: `${location.locationNo} 已选择。` }
  return { selectedLocationIds: [...selectedLocationIds, location.locationId], message: `${location.locationNo} 已加入。` }
}

function appendPdaSpecialCraftReturnScannedLocation(form: HandoverFormState, scanValue: string): string {
  const projection = buildPdaSpecialCraftReturnLocationMapProjection()
  if (!projection) return '当前裁床工厂没有可用的待交出仓。'
  const result = applyPdaSpecialCraftReturnLocationScan(form.specialCraftReturnLocationIds, scanValue, projection)
  form.specialCraftReturnLocationScan = ''
  form.specialCraftReturnLocationIds = result.selectedLocationIds
  return result.message
}

function validateSpecialCraftReturnScans(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord,
  form: HandoverFormState,
):
  | {
      ok: true
      bag: HandoverRecord['transferBagUses'][number] | null
      craftItems: NonNullable<HandoverRecord['specialCraftItems']>
      ticket: HandoverRecord['feiTicketItems'][number]
      ticketNo: string
      warehouseLocations: StableWarehouseLocationRef[]
      returnedQty: number
    }
  | { ok: false; message: string } {
  if (!matchesScannedValue(form.specialCraftOrderScan, [draft.handoverOrderNo, draft.handoverOrderId])) {
    return { ok: false, message: '请先扫描来源特殊工艺交出单。' }
  }
  const bag = sourceRecord.transferBagUses.length
    ? sourceRecord.transferBagUses.find((item) => matchesScannedValue(form.specialCraftReturnBagScan, [item.bagCode, item.bagUseId])) || null
    : null
  if (sourceRecord.transferBagUses.length && !bag) {
    return { ok: false, message: '请先扫描回仓中转袋。' }
  }
  const ticket = sourceRecord.feiTicketItems.find((item) => matchesScannedValue(form.specialCraftReturnFeiTicketScan, [item.feiTicketNo, item.feiTicketId]))
  if (!ticket) return { ok: false, message: '该菲票不属于当前特殊工艺交出记录。' }
  if (bag?.containedFeiTicketIds.length && !bag.containedFeiTicketIds.includes(ticket.feiTicketId)) {
    return { ok: false, message: '该菲票不在已扫描的回仓中转袋中。' }
  }
  const craftItems = (sourceRecord.specialCraftItems || []).filter((item) => item.feiTicketId === ticket.feiTicketId)
  if (!craftItems.length) return { ok: false, message: '该菲票没有可回仓的特殊工艺明细。' }
  const expectedQty = craftItems.reduce((total, item) => total + item.pieceQty, 0)
  if (expectedQty <= 0) return { ok: false, message: '该菲票没有可回仓数量。' }
  const alreadyReturned = craftItems.find((item) => runtimeEventHasTicket('特殊工艺回仓', ticket.feiTicketId, item.specialCraftId))
  if (alreadyReturned) return { ok: false, message: '该菲票的当前特殊工艺已回仓，不能重复回仓。' }
  const locationSelection = validatePdaSpecialCraftReturnLocationSelection(form.specialCraftReturnLocationIds)
  if (!locationSelection.ok) return { ok: false, message: locationSelection.message }
  const warehouseLocations = listSelectedSpecialCraftReturnLocations(locationSelection.selectedLocationIds)
  if (!warehouseLocations.length) return { ok: false, message: '请选择回仓库位。' }
  const returnedQty = Number(form.specialCraftReturnQty)
  if (!Number.isFinite(returnedQty) || returnedQty <= 0) return { ok: false, message: '请填写大于 0 的实回数量。' }
  return { ok: true, bag, craftItems, ticket, ticketNo: ticket.feiTicketNo, warehouseLocations, returnedQty }
}

function appendRuntimeSpecialCraftReturnEvent(draft: PdaHandoverRecordDraftProjection, form: HandoverFormState, operatorName: string): string {
  const sourceRecord = findHandoverRecordForDraft(draft)
  if (!sourceRecord || !sourceRecord.specialCraftItems?.length) return '当前特殊工艺交出单没有可回仓菲票。'
  const validation = validateSpecialCraftReturnScans(draft, sourceRecord, form)
  if (!validation.ok) return validation.message
  if (validation.bag) {
    return `带袋特殊工艺回仓已并入「中转袋入仓」，请到待交出仓扫描 ${validation.bag.bagCode} 完成入仓。`
  }
  const craftItems = validation.craftItems

  const now = new Date().toISOString()
  const returnRecordId = `PDA-SCR-${sourceRecord.handoverRecordId}-${now.replace(/\D/g, '')}`
  const expectedTotalQty = craftItems.reduce((total, item) => total + item.pieceQty, 0)
  let remainingReturnQty = validation.returnedQty
  const returnedFeiTicketItems = craftItems.map((item, index) => {
    const isLast = index === craftItems.length - 1
    const proportionalQty = expectedTotalQty > 0 ? (validation.returnedQty * item.pieceQty) / expectedTotalQty : validation.returnedQty
    const returnedQty = isLast ? Math.max(0, Number(remainingReturnQty.toFixed(2))) : Math.max(0, Number(proportionalQty.toFixed(2)))
    remainingReturnQty -= returnedQty
    const returnStatus: SpecialCraftReturnPayload['returnedFeiTicketItems'][number]['returnStatus'] =
      returnedQty === item.pieceQty ? '已回仓' : returnedQty < item.pieceQty ? '部分回仓' : '回仓差异'
    return {
      feiTicketId: item.feiTicketId,
      feiTicketNo: sourceRecord.feiTicketItems.find((ticket) => ticket.feiTicketId === item.feiTicketId)?.feiTicketNo || item.feiTicketId,
      specialCraftId: item.specialCraftId,
      craftType: item.craftType,
      partName: item.partName,
      size: item.size,
      expectedQty: item.pieceQty,
      returnedQty,
      unit: '片' as const,
      returnStatus,
    }
  })
  const payload: SpecialCraftReturnPayload = {
    returnRecordId,
    returnRecordNo: `HG-${sourceRecord.handoverRecordNo}-PDA`,
    sourceHandoverOrderId: sourceRecord.handoverOrderId,
    sourceHandoverOrderNo: sourceRecord.handoverOrderNo,
    sourceHandoverRecordId: sourceRecord.handoverRecordId,
    sourceHandoverRecordNo: sourceRecord.handoverRecordNo,
    receiverFactoryId: craftItems[0].receiverFactoryId,
    receiverFactoryName: craftItems[0].receiverFactoryName,
    transferBagCode: validation.bag?.bagCode,
    warehouseName: '裁床待交出仓',
    craftType: craftItems[0].craftType,
    returnedFeiTicketItems,
    warehouseArea: validation.warehouseLocations[0].areaName,
    locationCode: validation.warehouseLocations[0].locationNo,
    warehouseLocations: validation.warehouseLocations.map((location) => ({
      factoryId: location.factoryId,
      warehouseId: location.warehouseId,
      warehouseKind: 'WAIT_HANDOVER',
      areaId: location.areaId,
      areaName: location.areaName,
      shelfId: location.shelfId,
      shelfNo: location.shelfNo,
      locationId: location.locationId,
      locationNo: location.locationNo,
    })),
    returnedAt: now,
    returnedBy: operatorName,
  }
  const returnedQty = payload.returnedFeiTicketItems.reduce((total, item) => total + item.returnedQty, 0)

  appendWaitHandoverSpecialCraftReturnEvent({
    source: 'PDA',
    operator: {
      operatorName,
      operatorRole: '特殊工艺回仓员',
    },
    payload,
    specialCraftId: craftItems[0].specialCraftId,
    occurredAt: now,
  })

  return `特殊工艺回仓成功：${validation.ticketNo}，${returnedQty} 片，入 ${validation.warehouseLocations.map((location) => location.locationNo).join('、')}。`
}

function renderPdaSpecialCraftReturnLocationMap(form: HandoverFormState): string {
  const projection = buildPdaSpecialCraftReturnLocationMapProjection()
  if (!projection) return '<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">当前没有可用库位。</div>'
  return renderWarehouseLocationMap({
    projection,
    mode: 'SELECT',
    factoryName: '当前裁床工厂',
    selectedLocationIds: form.specialCraftReturnLocationIds,
  })
}

function renderPdaSpecialCraftReturnFlow(
  draft: PdaHandoverRecordDraftProjection,
  sourceRecord: HandoverRecord | undefined,
  taskId: string,
  form: HandoverFormState,
): string {
  if (!sourceRecord || !sourceRecord.specialCraftItems?.length) {
    return renderPdaCuttingEmptyState('暂无可回仓特殊工艺菲票', '特殊工艺交出后，回仓扫码任务会出现在这里。')
  }
  const scannedTicket = sourceRecord.feiTicketItems.find((item) =>
    matchesScannedValue(form.specialCraftReturnFeiTicketScan, [item.feiTicketNo, item.feiTicketId]),
  )
  const ticket = scannedTicket || sourceRecord.feiTicketItems.find((item) =>
    sourceRecord.specialCraftItems?.some((craft) => craft.feiTicketId === item.feiTicketId),
  )
  const craftItems = ticket ? sourceRecord.specialCraftItems.filter((item) => item.feiTicketId === ticket.feiTicketId) : []
  const firstCraft = craftItems[0]
  const sourceBag = sourceRecord.transferBagUses.find((item) =>
    form.specialCraftReturnBagScan
      ? matchesScannedValue(form.specialCraftReturnBagScan, [item.bagCode, item.bagUseId])
      : item.containedFeiTicketIds.includes(ticket?.feiTicketId || ''),
  ) || sourceRecord.transferBagUses[0]
  const expectedQty = craftItems.reduce((total, item) => total + item.pieceQty, 0)
  const returnStatus = firstCraft && ticket && runtimeEventHasTicket('特殊工艺回仓', ticket.feiTicketId, firstCraft.specialCraftId)
    ? '已回仓'
    : '待回仓'

  return `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-violet-50 px-3 py-3 text-violet-900">
        <div class="font-medium">特殊工艺回仓扫码</div>
        <div class="mt-1 text-sm font-semibold">${escapeHtml(draft.handoverOrderNo)} / 本次回仓 ${escapeHtml(sourceRecord.handoverRecordNo)}</div>
        <div class="mt-1">有中转袋时先扫中转袋，再扫菲票获取裁片部位，最后扫库区库位并确认入仓。</div>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">扫码顺序</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
          <div>1. 扫来源交出单</div>
          <div>2. 扫回仓中转袋</div>
          <div>3. 扫回仓菲票</div>
          <div>4. 扫库区库位</div>
        </div>
        <div class="mt-3 grid gap-2">
          ${renderPdaScanInput('来源特殊工艺交出单', 'specialCraftOrderScan', form.specialCraftOrderScan, draft.handoverOrderNo)}
          ${renderPdaScanInput('回仓中转袋', 'specialCraftReturnBagScan', form.specialCraftReturnBagScan, sourceBag?.bagCode || '无中转袋则留空')}
          ${renderPdaScanInput('回仓菲票', 'specialCraftReturnFeiTicketScan', form.specialCraftReturnFeiTicketScan, ticket?.feiTicketNo || '扫回仓菲票')}
          ${renderPdaScanInput('扫码加库位', 'specialCraftReturnLocationScan', form.specialCraftReturnLocationScan, '扫描库位后按回车')}
          ${renderPdaScanInput('实回数量', 'specialCraftReturnQty', form.specialCraftReturnQty, String(expectedQty || ticket?.pieceQty || '填写实回数量'))}
        </div>
        <div class="mt-2 text-xs text-muted-foreground" data-pda-special-craft-return-location-feedback>${escapeHtml(form.feedbackMessage)}</div>
      </div>
      <div data-pda-special-craft-return-location-map>${renderPdaSpecialCraftReturnLocationMap(form)}</div>
      ${renderPdaCuttingSummaryGrid([
        { label: '菲票', value: ticket?.feiTicketNo || '待扫描' },
        { label: '裁片部位', value: ticket ? `${ticket.partName} / ${ticket.size}` : '待扫描菲票后获取' },
        { label: '应回数量', value: expectedQty ? `${expectedQty} 片` : '待识别' },
        { label: '回仓状态', value: returnStatus },
        { label: '承接工厂', value: firstCraft?.receiverFactoryName || sourceRecord.receiverName },
        { label: '已选库位', value: listSelectedSpecialCraftReturnLocations(form.specialCraftReturnLocationIds).map((location) => location.locationNo).join('、') || '待选择' },
      ])}
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackMessage.includes('已同步') ? 'success' : 'warning') : ''}
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        data-pda-cut-handover-action="confirm-special-craft-return"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认特殊工艺回仓入仓
      </button>
    </div>
  `
}

function buildTransferBagHandoverStateKey(
  taskId: string,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): string {
  return `${buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)}::transfer-bag-handover`
}

function getTransferBagHandoverState(
  taskId: string,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): PdaTransferBagHandoverFormState {
  const stateKey = buildTransferBagHandoverStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = transferBagHandoverState.get(stateKey)
  if (existing) return existing
  const initial = createPdaTransferBagHandoverFormState()
  transferBagHandoverState.set(stateKey, initial)
  return initial
}

function replaceTransferBagHandoverState(
  taskId: string,
  state: PdaTransferBagHandoverFormState,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): void {
  transferBagHandoverState.set(
    buildTransferBagHandoverStateKey(taskId, executionOrderId, executionOrderNo),
    state,
  )
}

function renderTransferBagHandoverLiveState(state: PdaTransferBagHandoverFormState): string {
  const hasIdentifiedData = Boolean(state.usageCycleId)
  return `
    ${
      hasIdentifiedData
        ? `
          <div class="grid grid-cols-2 gap-2 rounded-xl border bg-muted/20 px-3 py-3 text-xs">
            <div><span class="text-muted-foreground">袋号</span><div class="mt-1 font-medium text-foreground">${escapeHtml(state.bagCode || '待扫描')}</div></div>
            <div><span class="text-muted-foreground">袋内菲票 / 裁片</span><div class="mt-1 font-medium text-foreground">${state.ticketCount === null ? '待识别' : `${state.ticketCount} 张 / ${state.pieceQty ?? 0} 片`}</div></div>
            <div><span class="text-muted-foreground">生产单号</span><div class="mt-1 font-medium text-foreground">${escapeHtml(state.productionOrderNo || '待识别')}</div></div>
            <div><span class="text-muted-foreground">车缝任务</span><div class="mt-1 font-medium text-foreground">${escapeHtml(state.sewingTaskNos.join('、') || '待识别')}</div></div>
            <div class="col-span-2"><span class="text-muted-foreground">接收工厂</span><div class="mt-1 font-medium text-foreground">${escapeHtml(state.receiverFactoryName || '待识别')}</div></div>
          </div>
        `
        : ''
    }
    ${state.scanFeedbackMessage ? renderPdaCuttingFeedbackNotice(state.scanFeedbackMessage, 'default') : ''}
  `
}

function renderPdaTransferBagHandoverWorkflowContent(
  state: PdaTransferBagHandoverFormState,
  taskId = '',
): string {
  const resultTone = state.resultMessage.startsWith('交出成功') ? 'success' : 'warning'
  return `
    ${state.resultMessage ? renderPdaCuttingFeedbackNotice(state.resultMessage, resultTone) : ''}
    ${state.handoverRecordNo ? `
      <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-950">
        <div class="font-semibold">交出记录：${escapeHtml(state.handoverRecordNo)}</div>
        <div class="mt-1">中转袋：${escapeHtml(state.resultBagCode)}</div>
        <div class="mt-1">接收工厂：${escapeHtml(state.resultFactoryName)}</div>
        <div class="mt-1">当前阶段：已交出待回收</div>
      </div>
    ` : ''}
    <div class="space-y-2">
      <div class="text-sm font-semibold text-foreground">1 扫描或填写中转袋</div>
      <input
        class="h-12 w-full rounded-xl border bg-background px-3 text-base"
        data-pda-cut-handover-field="bagCode"
        data-skip-page-rerender="true"
        value="${escapeHtml(state.bagCode)}"
        placeholder="扫描或填写中转袋编号"
      />
    </div>
    <div class="space-y-2" data-pda-transfer-bag-handover-live>
      ${renderTransferBagHandoverLiveState(state)}
    </div>
    <div class="space-y-2">
      <div class="text-sm font-semibold text-foreground">2 核对后确认交出</div>
      <button
        class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:opacity-90"
        data-pda-cut-handover-action="confirm-transfer-bag-handover"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认交出
      </button>
    </div>
  `
}

export function renderPdaTransferBagHandoverWorkflow(
  state: PdaTransferBagHandoverFormState,
  taskId = '',
  executionOrderId = '',
  executionOrderNo = '',
): string {
  return `
    <section
      class="space-y-4 rounded-2xl border bg-card px-3 py-3 shadow-sm"
      data-pda-transfer-bag-handover-workflow
      data-pda-cutting-context-ready="true"
      data-task-id="${escapeHtml(taskId)}"
      data-execution-order-id="${escapeHtml(executionOrderId)}"
      data-execution-order-no="${escapeHtml(executionOrderNo)}"
    >
      ${renderPdaTransferBagHandoverWorkflowContent(state, taskId)}
    </section>
  `
}

export function updatePdaTransferBagHandoverWorkflow(
  container: HTMLElement | null,
  state: PdaTransferBagHandoverFormState,
  taskId = '',
  focusField: 'bagCode' = 'bagCode',
): boolean {
  if (!container) return false
  container.innerHTML = renderPdaTransferBagHandoverWorkflowContent(state, taskId)
  const focusTarget = container.querySelector<HTMLInputElement>(
    `[data-pda-cut-handover-field="${focusField}"]`,
  )
  if (!focusTarget) return false
  focusTarget.focus({ preventScroll: true })
  return true
}

export function resolvePdaTransferBagHandoverConfirmFocus(
  result: { ok: boolean; message?: string },
): 'bagCode' {
  return 'bagCode'
}

export function renderPdaCuttingHandoverPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  const detail = context.detail
  const routeAction = readPdaCuttingHandoverActionFromLocation()
  const isTransferBagHandoverAction = routeAction === 'transfer-bag-handover'
  const isSpecialCraftReturnAction = routeAction === 'special-craft-return'
  const pageTitle = isSpecialCraftReturnAction ? '特殊工艺回仓' : isTransferBagHandoverAction ? '中转袋交出' : '交出确认'
  const pageActiveTab = isTransferBagHandoverAction || isSpecialCraftReturnAction ? 'warehouse' : 'handover'
  const cuttingWaitHandoverBackHref = '/fcs/pda/warehouse/wait-handover?scope=cutting'
  const specialCraftReturnBackHref = cuttingWaitHandoverBackHref

  if (isTransferBagHandoverAction) {
    const transferState = getTransferBagHandoverState(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
    )
    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body: renderPdaTransferBagHandoverWorkflow(
        transferState,
        taskId,
        context.selectedExecutionOrderId || '',
        context.selectedExecutionOrderNo || '',
      ),
      backHref: cuttingWaitHandoverBackHref,
    })
  }

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body: '',
      backHref: isSpecialCraftReturnAction ? specialCraftReturnBackHref : context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body: renderPdaCuttingOrderSelectionPrompt(
        detail,
        isSpecialCraftReturnAction ? specialCraftReturnBackHref : context.backHref,
        context.selectionNotice || undefined,
      ),
      backHref: isSpecialCraftReturnAction ? specialCraftReturnBackHref : context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || (isSpecialCraftReturnAction ? specialCraftReturnBackHref : context.backHref)
  const universalDraft = buildPdaUniversalHandoverRecordDraft()
  const specialCraftDraft = buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001')
  const specialCraftSourceRecord = findHandoverRecordForDraft(specialCraftDraft)

  if (isSpecialCraftReturnAction) {
    const body = `
      ${renderPdaCuttingExecutionHero('特殊工艺回仓', detail)}
      ${renderPdaCuttingSection('扫码回仓入库', '', renderPdaSpecialCraftReturnFlow(specialCraftDraft, specialCraftSourceRecord, taskId, form))}
    `

    return renderPdaCuttingPageLayout({
      taskId,
      title: pageTitle,
      subtitle: '',
      activeTab: pageActiveTab,
      body,
      backHref: pageBackHref,
      hideHeaderToolbar: true,
      titleActionHtml: `
        <button class="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回
        </button>
      `,
    })
  }

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">通用交出记录</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(universalDraft.handoverOrderNo)} / 第 ${universalDraft.nextRecordSequence} 次交出</div>
        <div class="mt-1 text-muted-foreground">接收对象：${escapeHtml(universalDraft.receiverType)} ${escapeHtml(universalDraft.receiverName)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.modelHint)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.submitConditionText)}</div>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">扫码确认</div>
        <div class="mt-2 grid gap-2">
          ${renderPdaScanInput('交出单', 'handoverOrderScan', form.handoverOrderScan, universalDraft.handoverOrderNo)}
          ${renderPdaScanInput('中转袋', 'handoverBagScan', form.handoverBagScan, '扫本次交出中转袋')}
          ${renderPdaScanInput('菲票', 'handoverFeiTicketScan', form.handoverFeiTicketScan, '扫本次交出菲票')}
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交出对象</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="targetLabel" value="${escapeHtml(form.targetLabel)}" placeholder="例如：裁片仓交出位 / 后道工位" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交出备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-handover-field="note" placeholder="填写交出提醒、后续去向和异常记录">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次交出预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.targetLabel || '待填写交出对象')}</div>
        <div class="mt-1 text-muted-foreground">当前位置：${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.riskTips[0]?.tipText || '提交后按交出记录展示累计交出、交出后是否齐套和缺口。')}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-handover-action="confirm" data-task-id="${escapeHtml(taskId)}">
          新增交出记录
        </button>
      </div>
    </div>
  `

  const specialCraftSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-violet-50 px-3 py-3 text-violet-900">
        <div class="font-medium">特殊工艺交出扫码</div>
        <div class="mt-1 text-sm font-semibold">${escapeHtml(specialCraftDraft.handoverOrderNo)} / 第 ${specialCraftDraft.nextRecordSequence} 次交出</div>
        <div class="mt-1">接收对象：${escapeHtml(specialCraftDraft.receiverType)} ${escapeHtml(specialCraftDraft.receiverName)}</div>
        <div class="mt-1">扫特殊工艺交出单 → 扫中转袋 → 扫菲票 → 确认交出</div>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">特殊工艺扫码</div>
        <div class="mt-2 grid gap-2">
          ${renderPdaScanInput('特殊工艺交出单', 'specialCraftOrderScan', form.specialCraftOrderScan, specialCraftDraft.handoverOrderNo)}
          ${renderPdaScanInput('中转袋', 'specialCraftBagScan', form.specialCraftBagScan, '扫特殊工艺交出中转袋')}
          ${renderPdaScanInput('交出菲票', 'specialCraftFeiTicketScan', form.specialCraftFeiTicketScan, '扫交出菲票')}
          ${renderPdaScanInput('回仓中转袋', 'specialCraftReturnBagScan', form.specialCraftReturnBagScan, specialCraftSourceRecord?.transferBagUses[0]?.bagCode || '扫回仓中转袋')}
          ${renderPdaScanInput('回仓菲票', 'specialCraftReturnFeiTicketScan', form.specialCraftReturnFeiTicketScan, '扫回仓菲票')}
          ${renderPdaScanInput('扫码加库位', 'specialCraftReturnLocationScan', form.specialCraftReturnLocationScan, '扫描库位后按回车')}
          ${renderPdaScanInput('实回数量', 'specialCraftReturnQty', form.specialCraftReturnQty, '填写实回数量')}
        </div>
        <div class="mt-2 text-xs text-muted-foreground" data-pda-special-craft-return-location-feedback>${escapeHtml(form.feedbackMessage)}</div>
      </div>
      <div data-pda-special-craft-return-location-map>${renderPdaSpecialCraftReturnLocationMap(form)}</div>
      ${renderPdaCuttingSummaryGrid([
        { label: '本次工艺', value: '绣花' },
        { label: '承接工厂', value: specialCraftDraft.receiverName },
        { label: '同步状态', value: '已同步', hint: '提交后生成通用交出记录' },
        { label: '后续回仓', value: '先扫中转袋再扫菲票' },
      ])}
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackMessage.includes('已同步') ? 'success' : 'warning') : ''}
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        data-pda-cut-handover-action="confirm-special-craft-handover"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认交出
      </button>
      <button
        class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-violet-200 bg-background px-3 py-2 text-sm font-semibold text-violet-700"
        data-pda-cut-handover-action="confirm-special-craft-return"
        data-task-id="${escapeHtml(taskId)}"
      >
        确认回仓
      </button>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('新增交出记录', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderHandoverStatus(detail))}
    ${renderPdaCuttingSection('特殊工艺交出', '', specialCraftSection)}
    ${renderPdaCuttingSection('新增交出记录', '', confirmSection)}
    ${renderPdaCuttingSection('最近交出记录', '', renderHandoverHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '交出记录扫码',
    subtitle: '',
    activeTab: 'handover',
    body,
    backHref: pageBackHref,
  })
}

function resolveTransferBagHandoverContainer(node: HTMLElement): HTMLElement | null {
  return node.closest<HTMLElement>('[data-pda-transfer-bag-handover-workflow]')
}

function resolveTransferBagHandoverExecutionContext(
  taskId: string,
  sourceNode: HTMLElement,
): {
  executionOrderId: string | null
  executionOrderNo: string | null
} {
  const container = resolveTransferBagHandoverContainer(sourceNode)
  if (container?.dataset?.pdaCuttingContextReady === 'true') {
    return {
      executionOrderId: container.dataset.executionOrderId?.trim() || null,
      executionOrderNo: container.dataset.executionOrderNo?.trim() || null,
    }
  }
  const executionOrderId = readSelectedExecutionOrderIdFromLocation()
  const executionOrderNo = readSelectedExecutionOrderNoFromLocation()
  if (executionOrderId || executionOrderNo) {
    return { executionOrderId, executionOrderNo }
  }
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  return {
    executionOrderId: context.selectedExecutionOrderId,
    executionOrderNo: context.selectedExecutionOrderNo,
  }
}

function updateTransferBagHandoverLiveRegion(
  container: HTMLElement | null,
  state: PdaTransferBagHandoverFormState,
  completedField?: 'bagCode',
): void {
  if (!container) return
  const bagInput = container.querySelector<HTMLInputElement>(
    '[data-pda-cut-handover-field="bagCode"]',
  )
  if (!completedField || completedField === 'bagCode') {
    if (bagInput) bagInput.value = state.bagCode
  }
  const liveRegion = container.querySelector<HTMLElement>('[data-pda-transfer-bag-handover-live]')
  if (liveRegion) liveRegion.innerHTML = renderTransferBagHandoverLiveState(state)
}

function completeTransferBagHandoverFieldScan(
  fieldNode: HTMLInputElement,
  taskId: string,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): void {
  const next = scanPdaTransferBagForHandover(fieldNode.value)
  replaceTransferBagHandoverState(taskId, next.state, executionOrderId, executionOrderNo)
  updateTransferBagHandoverLiveRegion(
    resolveTransferBagHandoverContainer(fieldNode),
    next.state,
    'bagCode',
  )
}

export function handlePdaCuttingHandoverEvent(
  target: HTMLElement,
  event?: Event,
): PdaPageEventResult {
  const warehouseMapNode = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (warehouseMapNode) {
    const projection = buildPdaSpecialCraftReturnLocationMapProjection()
    if (!projection) return true
    if (handleWarehouseLocationMapOccupancyEvent(warehouseMapNode, projection)) {
      return PDA_PAGE_HANDLED_LOCALLY
    }
    const taskId = warehouseMapNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const executionContext = resolvePdaHandoverExecutionContext(taskId)
    const form = getState(
      taskId,
      executionContext.executionOrderId,
      executionContext.executionOrderNo,
    )
    if (warehouseMapNode.dataset.warehouseMapAction === 'clear-selection') {
      form.specialCraftReturnLocationIds = []
    } else if (warehouseMapNode.dataset.warehouseMapAction === 'toggle-location') {
      const result = toggleWarehouseLocationSelection(
        projection,
        form.specialCraftReturnLocationIds,
        warehouseMapNode.dataset.locationId || '',
      )
      if (!result.ok) form.feedbackMessage = result.message
      else form.specialCraftReturnLocationIds = result.selectedLocationIds
    } else {
      return true
    }
    const mapRegion = warehouseMapNode.closest<HTMLElement>('[data-task-id]')
      ?.querySelector<HTMLElement>('[data-pda-special-craft-return-location-map]')
    if (mapRegion) mapRegion.innerHTML = renderPdaSpecialCraftReturnLocationMap(form)
    const feedback = warehouseMapNode.closest<HTMLElement>('[data-task-id]')
      ?.querySelector<HTMLElement>('[data-pda-special-craft-return-location-feedback]')
    if (feedback) feedback.textContent = form.feedbackMessage
    return PDA_PAGE_HANDLED_LOCALLY
  }
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-handover-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const executionContext = resolvePdaHandoverExecutionContext(taskId)
    const form = getState(
      taskId,
      executionContext.executionOrderId,
      executionContext.executionOrderNo,
    )
    const field = fieldNode.dataset.pdaCutHandoverField
    if (!field) return true

    if (field === 'specialCraftReturnLocationScan' && fieldNode instanceof HTMLInputElement) {
      form.specialCraftReturnLocationScan = fieldNode.value
      if ((event?.type === 'keydown' && 'key' in event && event.key === 'Enter') || event?.type === 'change') {
        form.feedbackMessage = appendPdaSpecialCraftReturnScannedLocation(form, fieldNode.value)
        fieldNode.value = ''
        const mapRegion = fieldNode.closest<HTMLElement>('[data-task-id]')
          ?.querySelector<HTMLElement>('[data-pda-special-craft-return-location-map]')
        if (mapRegion) mapRegion.innerHTML = renderPdaSpecialCraftReturnLocationMap(form)
        const feedback = fieldNode.closest<HTMLElement>('[data-task-id]')
          ?.querySelector<HTMLElement>('[data-pda-special-craft-return-location-feedback]')
        if (feedback) feedback.textContent = form.feedbackMessage
        return PDA_PAGE_HANDLED_LOCALLY
      }
      return true
    }

    if (
      fieldNode instanceof HTMLInputElement &&
      field === 'bagCode'
    ) {
      const transferContext = resolveTransferBagHandoverExecutionContext(taskId, fieldNode)
      const transferExecutionOrderId = transferContext.executionOrderId
      const transferExecutionOrderNo = transferContext.executionOrderNo
      const stateKey = buildTransferBagHandoverStateKey(
        taskId,
        transferExecutionOrderId,
        transferExecutionOrderNo,
      )
      const trigger = resolvePdaTransferBagHandoverScanTrigger({
        type: event?.type || 'input',
        key: event && 'key' in event ? String(event.key || '') : undefined,
      })
      transferBagScanTimerController.cancel(stateKey)
      if (!fieldNode.value.trim()) {
        const nextState = clearPdaTransferBagHandoverScanDraft(
          getTransferBagHandoverState(
            taskId,
            transferExecutionOrderId,
            transferExecutionOrderNo,
          ),
        )
        replaceTransferBagHandoverState(
          taskId,
          nextState,
          transferExecutionOrderId,
          transferExecutionOrderNo,
        )
        updateTransferBagHandoverLiveRegion(
          resolveTransferBagHandoverContainer(fieldNode),
          nextState,
        )
        return true
      }
      if (trigger === 'none') return true
      if (trigger === 'immediate') {
        completeTransferBagHandoverFieldScan(
          fieldNode,
          taskId,
          transferExecutionOrderId,
          transferExecutionOrderNo,
        )
      } else {
        transferBagScanTimerController.schedule(
          stateKey,
          () => completeTransferBagHandoverFieldScan(
            fieldNode,
            taskId,
            transferExecutionOrderId,
            transferExecutionOrderNo,
          ),
        )
      }
      return true
    }

    if (field in form) {
      ;(form as unknown as Record<string, string>)[field] = fieldNode.value
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-handover-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutHandoverAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false

  if (action === 'confirm-transfer-bag-handover') {
    const transferContext = resolveTransferBagHandoverExecutionContext(taskId, actionNode)
    const stateKey = buildTransferBagHandoverStateKey(
      taskId,
      transferContext.executionOrderId,
      transferContext.executionOrderNo,
    )
    transferBagScanTimerController.flush(stateKey)
    const state = getTransferBagHandoverState(
      taskId,
      transferContext.executionOrderId,
      transferContext.executionOrderNo,
    )
    const nextState = submitPdaTransferBagHandover(state, taskId)
    if (nextState.resultMessage.startsWith('交出成功')) {
      transferBagScanTimerController.cancel(stateKey)
    }
    replaceTransferBagHandoverState(
      taskId,
      nextState,
      transferContext.executionOrderId,
      transferContext.executionOrderNo,
    )
    const updatedLocally = updatePdaTransferBagHandoverWorkflow(
      resolveTransferBagHandoverContainer(actionNode),
      nextState,
      taskId,
      resolvePdaTransferBagHandoverConfirmFocus({
        ok: nextState.resultMessage.startsWith('交出成功'),
        message: nextState.resultMessage,
      }),
    )
    return updatedLocally ? PDA_PAGE_HANDLED_LOCALLY : true
  }

  const executionContext = resolvePdaHandoverExecutionContext(taskId)
  const context = executionContext.context
  const resolvedExecutionOrderId = executionContext.executionOrderId
  const resolvedExecutionOrderNo = executionContext.executionOrderNo

  if (action === 'confirm') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingRuntimeOperator(taskId, form.operatorName.trim() || '交出操作员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前铺布单或操作人无法识别，不能新增交出记录。'
      return true
    }
    form.feedbackMessage = appendRuntimeUniversalHandoverEvent(
      buildPdaUniversalHandoverRecordDraft(),
      form,
      form.operatorName.trim() || operator.name || '交出操作员',
    )
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'handover',
    )
    return true
  }

  if (action === 'confirm-special-craft-handover') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    form.feedbackMessage = appendRuntimeSpecialCraftHandoverEvent(
      buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001'),
      form,
      form.operatorName.trim() || '特殊工艺交出员',
    )
    return true
  }

  if (action === 'confirm-special-craft-return') {
    const form = getState(taskId, resolvedExecutionOrderId, resolvedExecutionOrderNo)
    syncHandoverFormFromControls(form)
    form.feedbackMessage = appendRuntimeSpecialCraftReturnEvent(
      buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001'),
      form,
      form.operatorName.trim() || '特殊工艺回仓员',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/handover\/([^/]+)/)
  return matched?.[1] ?? ''
}

function resolvePdaHandoverExecutionContext(taskId: string): {
  context: ReturnType<typeof buildPdaCuttingExecutionContext>
  executionOrderId: string | null
  executionOrderNo: string | null
} {
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  return {
    context,
    executionOrderId: readSelectedExecutionOrderIdFromLocation() || context.selectedExecutionOrderId,
    executionOrderNo: readSelectedExecutionOrderNoFromLocation() || context.selectedExecutionOrderNo,
  }
}
