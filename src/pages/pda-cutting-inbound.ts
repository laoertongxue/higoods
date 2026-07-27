import { escapeHtml } from '../utils'
import { validateFeiTicketNumberingBeforeBagging } from '../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingPageLayout,
} from './pda-cutting-shared'
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import { buildTransferBagsProjection } from './process-factory/cutting/transfer-bags-projection.ts'
import type { TransferBagTicketCandidate } from './process-factory/cutting/transfer-bags-model.ts'

export type PdaCuttingInboundMode = 'bagging' | 'inbound-location'
export const PDA_CUTTING_INBOUND_SCAN_DEBOUNCE_MS = 150

export interface InboundFormState {
  operatorName: string
  carrierCode: string
  bagProductionOrderNo: string
  scanCode: string
  locationLabel: string
  inboundQty: string
  scannedTicketNos: string[]
  scanFeedbackMessage: string
  resultMessage: string
}

interface ScannedTicketInput {
  ticketNo: string
  pieceQty: number
  productionOrderNo: string
}

interface InboundRoundResult {
  ok: boolean
  message?: string
}

declare global {
  interface Window {
    __higoodPdaCuttingInboundState?: Map<string, InboundFormState>
  }
}

const fallbackInboundState = new Map<string, InboundFormState>()
const ticketScanTimers = new WeakMap<HTMLInputElement, ReturnType<typeof setTimeout>>()

export function createPdaCuttingInboundFormState(): InboundFormState {
  return {
    operatorName: '仓务操作员',
    carrierCode: '',
    bagProductionOrderNo: '',
    scanCode: '',
    locationLabel: '',
    inboundQty: '',
    scannedTicketNos: [],
    scanFeedbackMessage: '',
    resultMessage: '',
  }
}

export function applyPdaCuttingInboundTicketScan(
  state: InboundFormState,
  ticket: ScannedTicketInput,
): { ok: boolean; state: InboundFormState } {
  if (!state.carrierCode.trim()) {
    return {
      ok: false,
      state: {
        ...state,
        scanFeedbackMessage: '请先扫描中转袋。',
      },
    }
  }
  if (state.scannedTicketNos.includes(ticket.ticketNo)) {
    return {
      ok: false,
      state: {
        ...state,
        scanFeedbackMessage: `${ticket.ticketNo} 已扫过，请扫下一张。`,
      },
    }
  }
  if (
    state.bagProductionOrderNo &&
    ticket.productionOrderNo &&
    state.bagProductionOrderNo !== ticket.productionOrderNo
  ) {
    return {
      ok: false,
      state: {
        ...state,
        scanFeedbackMessage: `${ticket.ticketNo} 不属于当前袋生产单，请换一张。`,
      },
    }
  }

  const nextQty = Number(state.inboundQty || 0) + Number(ticket.pieceQty || 0)
  return {
    ok: true,
    state: {
      ...state,
      scanCode: '',
      bagProductionOrderNo: state.bagProductionOrderNo || ticket.productionOrderNo,
      inboundQty: String(nextQty),
      scannedTicketNos: [...state.scannedTicketNos, ticket.ticketNo],
      scanFeedbackMessage: `${ticket.ticketNo} 已加入`,
      resultMessage: '',
    },
  }
}

export function completePdaCuttingInboundRound(
  state: InboundFormState,
  mode: PdaCuttingInboundMode,
  result: InboundRoundResult,
): InboundFormState {
  if (!result.ok) {
    return {
      ...state,
      resultMessage: result.message || (mode === 'bagging' ? '装袋失败，请检查后重试。' : '入仓失败，请检查后重试。'),
    }
  }

  return {
    ...createPdaCuttingInboundFormState(),
    operatorName: state.operatorName,
    resultMessage: mode === 'bagging' ? '装袋成功' : '入仓成功',
  }
}

function getInboundStateStore(): Map<string, InboundFormState> {
  if (typeof window === 'undefined') return fallbackInboundState
  if (!window.__higoodPdaCuttingInboundState) {
    window.__higoodPdaCuttingInboundState = new Map<string, InboundFormState>()
  }
  return window.__higoodPdaCuttingInboundState
}

function getState(
  taskId: string,
  mode: PdaCuttingInboundMode,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): InboundFormState {
  const executionKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const stateKey = `${executionKey}::${mode}`
  const store = getInboundStateStore()
  const existing = store.get(stateKey)
  if (existing) return existing
  const initial = createPdaCuttingInboundFormState()
  store.set(stateKey, initial)
  return initial
}

function replaceState(
  taskId: string,
  mode: PdaCuttingInboundMode,
  state: InboundFormState,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): void {
  const executionKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  getInboundStateStore().set(`${executionKey}::${mode}`, state)
}

function getInboundMode(): PdaCuttingInboundMode {
  if (typeof window === 'undefined') return 'bagging'
  return new URLSearchParams(window.location.search).get('action') === 'inbound-location'
    ? 'inbound-location'
    : 'bagging'
}

function resolveInboundEventState(taskId: string, mode = getInboundMode()): {
  form: InboundFormState
  selectedExecutionOrderId: string | null
  selectedExecutionOrderNo: string | null
} {
  const locationExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const locationExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
  if (locationExecutionOrderId || locationExecutionOrderNo) {
    return {
      form: getState(taskId, mode, locationExecutionOrderId, locationExecutionOrderNo),
      selectedExecutionOrderId: locationExecutionOrderId,
      selectedExecutionOrderNo: locationExecutionOrderNo,
    }
  }
  const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
  return {
    form: getState(taskId, mode, context.selectedExecutionOrderId, context.selectedExecutionOrderNo),
    selectedExecutionOrderId: context.selectedExecutionOrderId,
    selectedExecutionOrderNo: context.selectedExecutionOrderNo,
  }
}

function listInboundTicketCandidates(): TransferBagTicketCandidate[] {
  return buildTransferBagsProjection().viewModel.ticketCandidates
}

export function resolvePdaCuttingInboundScanTrigger(
  event: { type: string; key?: string },
): 'immediate' | 'debounced' | 'none' {
  if (event.type === 'keydown') return event.key === 'Enter' ? 'immediate' : 'none'
  if (event.type === 'input' || event.type === 'compositionend') return 'debounced'
  return 'none'
}

function resolveInboundScanTicketFromCandidates(
  scanCode: string,
  candidates: TransferBagTicketCandidate[],
): TransferBagTicketCandidate | null {
  const normalized = scanCode.trim().toUpperCase()
  if (!normalized) return null
  return (
    candidates.find((ticket) =>
      [ticket.ticketNo, ticket.feiTicketId, ticket.ticketRecordId].some(
        (value) => String(value || '').toUpperCase() === normalized,
      ),
    ) || null
  )
}

function validateInboundScan(
  form: InboundFormState,
  scanCode: string,
  candidates: TransferBagTicketCandidate[],
): { ok: boolean; reason: string; ticket: TransferBagTicketCandidate | null } {
  const normalized = scanCode.trim().toUpperCase()
  if (!normalized) return { ok: false, reason: '请扫描菲票。', ticket: null }
  if (normalized.includes('WAIT') || normalized.includes('未打印')) {
    return { ok: false, reason: '这张菲票未打印，请换一张。', ticket: null }
  }
  if (normalized.includes('VOID') || normalized.includes('作废')) {
    return { ok: false, reason: '这张菲票已作废，请换一张。', ticket: null }
  }
  const ticket = resolveInboundScanTicketFromCandidates(scanCode, candidates)
  if (!ticket) return { ok: false, reason: '没有找到这张菲票，请重新扫描。', ticket: null }
  if (ticket.ticketStatus === 'VOIDED' || ticket.printStatus === 'VOIDED') {
    return { ok: false, reason: '这张菲票已作废，请换一张。', ticket }
  }
  if (ticket.printStatus === 'WAIT_PRINT' && ticket.ticketStatus !== 'PRINTED') {
    return { ok: false, reason: '这张菲票未打印，请换一张。', ticket }
  }
  if (
    form.bagProductionOrderNo &&
    ticket.productionOrderNo &&
    form.bagProductionOrderNo !== ticket.productionOrderNo
  ) {
    return { ok: false, reason: `${ticket.ticketNo} 不属于当前袋生产单，请换一张。`, ticket }
  }
  const numberingValidation = validateFeiTicketNumberingBeforeBagging({
    feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
    feiTicketNo: ticket.ticketNo,
    partName: ticket.partName,
    pieceSequenceLabel: ticket.pieceSequenceLabel,
  })
  if (!numberingValidation.ok) return { ok: false, reason: numberingValidation.reason, ticket }
  if (form.scannedTicketNos.includes(ticket.ticketNo)) {
    return { ok: false, reason: `${ticket.ticketNo} 已扫过，请扫下一张。`, ticket }
  }
  return { ok: true, reason: '', ticket }
}

export function completePdaCuttingInboundTicketScan(
  form: InboundFormState,
  scanCode: string,
  candidates: TransferBagTicketCandidate[],
): { ok: boolean; state: InboundFormState } {
  const validation = validateInboundScan(form, scanCode, candidates)
  if (!validation.ok || !validation.ticket) {
    return {
      ok: false,
      state: {
        ...form,
        scanCode: '',
        scanFeedbackMessage: validation.reason,
        resultMessage: '',
      },
    }
  }
  return applyPdaCuttingInboundTicketScan(form, {
    ticketNo: validation.ticket.ticketNo,
    pieceQty: ticketPieceQty(validation.ticket),
    productionOrderNo: validation.ticket.productionOrderNo,
  })
}

function ticketPieceQty(ticket: TransferBagTicketCandidate): number {
  return Number(ticket.actualCutPieceQty || ticket.qty || 0)
}

function renderResultMessage(form: InboundFormState): string {
  if (!form.resultMessage) return ''
  const success = form.resultMessage === '装袋成功' || form.resultMessage === '入仓成功'
  return renderPdaCuttingFeedbackNotice(form.resultMessage, success ? 'success' : 'warning')
}

function renderBaggingLiveState(form: InboundFormState): string {
  return `
    <div class="rounded-xl border bg-muted/20 px-3 py-2.5">
      <div class="flex items-center justify-between gap-3">
        <span class="font-medium text-foreground">已扫菲票 ${form.scannedTicketNos.length} 张</span>
        <span class="text-muted-foreground">${escapeHtml(form.inboundQty || '0')} 片</span>
      </div>
      ${
        form.scannedTicketNos.length
          ? `<div class="mt-2 flex flex-wrap gap-1.5">${form.scannedTicketNos
              .map(
                (ticketNo) =>
                  `<span class="rounded-lg border bg-background px-2 py-1 text-[11px] text-foreground">${escapeHtml(ticketNo)}</span>`,
              )
              .join('')}</div>`
          : ''
      }
    </div>
    ${form.scanFeedbackMessage ? renderPdaCuttingFeedbackNotice(form.scanFeedbackMessage, 'default') : ''}
  `
}

function renderStepTitle(step: number, label: string): string {
  return `<div class="text-sm font-semibold text-foreground">${step} ${escapeHtml(label)}</div>`
}

export function renderPdaCuttingInboundWorkflow(
  mode: PdaCuttingInboundMode,
  form: InboundFormState,
  taskId = '',
): string {
  const isInboundLocation = mode === 'inbound-location'
  return `
    <section class="space-y-4 rounded-2xl border bg-card px-3 py-3 shadow-sm" data-task-id="${escapeHtml(taskId)}">
      ${renderResultMessage(form)}
      <div class="space-y-2">
        ${renderStepTitle(1, '扫中转袋')}
        <input
          class="h-12 w-full rounded-xl border bg-background px-3 text-base"
          data-pda-cut-inbound-field="carrierCode"
          data-skip-page-rerender="true"
          value="${escapeHtml(form.carrierCode)}"
          placeholder="扫描中转袋"
        />
      </div>
      ${
        isInboundLocation
          ? `
            <div class="space-y-2">
              ${renderStepTitle(2, '扫库区库位')}
              <input
                class="h-12 w-full rounded-xl border bg-background px-3 text-base"
                data-pda-cut-inbound-field="locationLabel"
                data-skip-page-rerender="true"
                value="${escapeHtml(form.locationLabel)}"
                placeholder="扫描库区库位"
              />
            </div>
          `
          : `
            <div class="space-y-2">
              ${renderStepTitle(2, '扫菲票')}
              <input
                class="h-12 w-full rounded-xl border bg-background px-3 text-base"
                data-pda-cut-inbound-field="scanCode"
                data-skip-page-rerender="true"
                value="${escapeHtml(form.scanCode)}"
                placeholder="连续扫描菲票"
              />
              <div class="space-y-2" data-pda-cut-inbound-live>${renderBaggingLiveState(form)}</div>
            </div>
          `
      }
      <div class="space-y-2">
        ${renderStepTitle(3, isInboundLocation ? '确认入仓' : '确认装袋')}
        <button
          class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:opacity-90"
          data-pda-cut-inbound-action="confirm"
          data-task-id="${escapeHtml(taskId)}"
        >
          ${isInboundLocation ? '确认入仓' : '确认装袋'}
        </button>
      </div>
    </section>
  `
}

export function renderPdaCuttingInboundPage(taskId: string): string {
  const mode = getInboundMode()
  const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
  const form = getState(taskId, mode, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageTitle = mode === 'inbound-location' ? '中转袋入仓' : '菲票装袋'

  return renderPdaCuttingPageLayout({
    taskId,
    title: pageTitle,
    subtitle: '',
    activeTab: 'exec',
    body: renderPdaCuttingInboundWorkflow(mode, form, taskId),
    backHref: context.backHref,
  })
}

function resolveInboundFormContainer(node: HTMLElement): HTMLElement | null {
  return node.closest<HTMLElement>('[data-task-id]')
}

function updateBaggingLiveRegion(container: HTMLElement | null, form: InboundFormState): void {
  if (!container) return
  const input = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="scanCode"]')
  if (input) input.value = form.scanCode
  const liveRegion = container.querySelector<HTMLElement>('[data-pda-cut-inbound-live]')
  if (liveRegion) liveRegion.innerHTML = renderBaggingLiveState(form)
}

function completeInboundTicketScan(
  fieldNode: HTMLInputElement,
  taskId: string,
  mode: PdaCuttingInboundMode,
  eventState: ReturnType<typeof resolveInboundEventState>,
): void {
  const next = completePdaCuttingInboundTicketScan(
    eventState.form,
    fieldNode.value,
    listInboundTicketCandidates(),
  )
  replaceState(
    taskId,
    mode,
    next.state,
    eventState.selectedExecutionOrderId,
    eventState.selectedExecutionOrderNo,
  )
  updateBaggingLiveRegion(resolveInboundFormContainer(fieldNode), next.state)
}

function syncFormFromControls(form: InboundFormState, container: HTMLElement | null): void {
  if (!container) return
  const carrierCode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="carrierCode"]')
  const scanCode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="scanCode"]')
  const locationLabel = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="locationLabel"]')
  if (carrierCode) form.carrierCode = carrierCode.value
  if (scanCode) form.scanCode = scanCode.value
  if (locationLabel) form.locationLabel = locationLabel.value
}

export function handlePdaCuttingInboundEvent(target: HTMLElement, event?: Event): boolean {
  const mode = getInboundMode()
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-inbound-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const eventState = resolveInboundEventState(taskId, mode)
    const field = fieldNode.dataset.pdaCutInboundField
    if (!field) return true

    if (field === 'carrierCode') eventState.form.carrierCode = fieldNode.value
    if (field === 'locationLabel') eventState.form.locationLabel = fieldNode.value
    if (field === 'scanCode' && mode === 'bagging' && fieldNode instanceof HTMLInputElement) {
      eventState.form.scanCode = fieldNode.value
      const trigger = resolvePdaCuttingInboundScanTrigger({
        type: event?.type || 'input',
        key: event && 'key' in event ? String(event.key || '') : undefined,
      })
      const pendingTimer = ticketScanTimers.get(fieldNode)
      if (pendingTimer) clearTimeout(pendingTimer)
      if (!fieldNode.value.trim() || trigger === 'none') return true
      if (trigger === 'immediate') {
        completeInboundTicketScan(fieldNode, taskId, mode, eventState)
      } else {
        ticketScanTimers.set(
          fieldNode,
          setTimeout(
            () => completeInboundTicketScan(fieldNode, taskId, mode, eventState),
            PDA_CUTTING_INBOUND_SCAN_DEBOUNCE_MS,
          ),
        )
      }
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action="confirm"]')
  if (!actionNode) return false
  const taskId = actionNode.dataset.taskId
  if (!taskId) return false
  const eventState = resolveInboundEventState(taskId, mode)
  syncFormFromControls(eventState.form, resolveInboundFormContainer(actionNode))

  let result: InboundRoundResult = { ok: true }
  if (!eventState.form.carrierCode.trim()) {
    result = { ok: false, message: '请扫描中转袋。' }
  } else if (mode === 'inbound-location' && !eventState.form.locationLabel.trim()) {
    result = { ok: false, message: '请扫描库区库位。' }
  } else if (mode === 'bagging' && eventState.form.scanCode.trim()) {
    const validation = validateInboundScan(
      eventState.form,
      eventState.form.scanCode,
      listInboundTicketCandidates(),
    )
    result = { ok: false, message: validation.reason }
  } else if (mode === 'bagging' && !eventState.form.scannedTicketNos.length) {
    result = { ok: false, message: '请扫描菲票。' }
  }

  replaceState(
    taskId,
    mode,
    completePdaCuttingInboundRound(eventState.form, mode, result),
    eventState.selectedExecutionOrderId,
    eventState.selectedExecutionOrderNo,
  )
  return true
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/inbound\/([^/]+)/)
  return matched?.[1] ?? ''
}
