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
import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../data/browser-storage.ts'
import {
  appendWaitHandoverBaggingEvent,
  appendWaitHandoverInboundEvent,
  buildWaitHandoverLocationOccupancyStates,
  buildWaitHandoverRuntimeTicketFromTransferCandidate,
  listWaitHandoverRuntimeEvents,
  resolveWaitHandoverBaggingSnapshot,
  type WaitHandoverRuntimeTicketInput,
} from './process-factory/cutting/wait-handover-runtime.ts'
import {
  PDA_PAGE_HANDLED_LOCALLY,
  type PdaPageEventResult,
} from '../main-handlers/pda-local-action-result'
import { getCurrentFactoryWarehouseByKind } from './pda-warehouse-shared'
import { loadWarehouseLayoutSnapshot } from './process-factory/cutting/warehouse-location-layout-store.ts'
import {
  buildWarehouseLocationMapProjection,
  listStableWarehouseLocationRefs,
  type StableWarehouseLocationRef,
  type WarehouseLocationOccupancy,
} from './process-factory/cutting/warehouse-location-map-model.ts'
import { renderWarehouseLocationMap } from '../components/ui/warehouse-location-map.ts'

export type PdaCuttingInboundMode = 'bagging' | 'inbound-location'
export type PdaCuttingInboundTicketScanStatus = 'idle' | 'valid' | 'invalid'
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
  lastTicketScanStatus: PdaCuttingInboundTicketScanStatus
  resultMessage: string
  selectedLocationId: string
}

export interface ScannedTicketInput {
  ticketNo: string
  pieceQty: number
  productionOrderNo: string
}

export interface InboundRoundResult {
  ok: boolean
  message?: string
}

export interface PdaCuttingInboundTicketScanResult {
  ok: boolean
  state: InboundFormState
}

export interface PdaCuttingInboundConfirmOutcome {
  result: InboundRoundResult
  nextForm: InboundFormState
  ledger: PdaCuttingInboundMockLedger
}

export type PdaCuttingInboundBagStatus =
  | 'EMPTY_READY'
  | 'BAGGED_WAIT_INBOUND'
  | 'INBOUNDED'
  | 'HANDED_OVER'
  | 'VOIDED'

export type PdaCuttingInboundTicketStatus = 'READY_FOR_BAGGING' | 'BAGGED' | 'VOIDED'

export interface PdaCuttingInboundMockLedger {
  bags: Record<string, {
    bagCode: string
    status: PdaCuttingInboundBagStatus
    ticketNos: string[]
    productionOrderNo: string
    locationLabel: string
  }>
  tickets: Record<string, {
    ticketNo: string
    status: PdaCuttingInboundTicketStatus
    bagCode: string
  }>
  locations: Record<string, {
    locationLabel: string
    enabled: boolean
    warehouseType: 'CUTTING' | 'OTHER'
  }>
}

const DEFAULT_INBOUND_TICKET_NOS = [
  'FT-CUT-260307-102-01-001',
  'FT-CUT-260307-102-01-002',
  'FT-CUT-260307-102-02-017',
]

declare global {
  interface Window {
    __higoodPdaCuttingInboundState?: Map<string, InboundFormState>
    __higoodPdaCuttingInboundMockLedger?: PdaCuttingInboundMockLedger
  }
}

const fallbackInboundState = new Map<string, InboundFormState>()
let fallbackInboundMockLedger: PdaCuttingInboundMockLedger | null = null

export function createPdaCuttingInboundMockLedger(
  ticketNos: string[] = DEFAULT_INBOUND_TICKET_NOS,
): PdaCuttingInboundMockLedger {
  const readyTickets = Object.fromEntries(
    Array.from(new Set([...DEFAULT_INBOUND_TICKET_NOS, ...ticketNos].map(normalizeInboundCode)))
      .map((ticketNo) => [
        ticketNo,
        { ticketNo, status: 'READY_FOR_BAGGING' as const, bagCode: '' },
      ]),
  )
  return {
    bags: {
      'BAG-001': {
        bagCode: 'BAG-001',
        status: 'EMPTY_READY',
        ticketNos: [],
        productionOrderNo: '',
        locationLabel: '',
      },
      'BAG-002': {
        bagCode: 'BAG-002',
        status: 'EMPTY_READY',
        ticketNos: [],
        productionOrderNo: '',
        locationLabel: '',
      },
      'BAG-WAIT-001': {
        bagCode: 'BAG-WAIT-001',
        status: 'BAGGED_WAIT_INBOUND',
        ticketNos: ['FT-DEMO-BAGGED-001'],
        productionOrderNo: 'PO-202603-0004',
        locationLabel: '',
      },
      'BAG-IN-001': {
        bagCode: 'BAG-IN-001',
        status: 'INBOUNDED',
        ticketNos: ['FT-DEMO-INBOUNDED-001'],
        productionOrderNo: 'PO-202603-0004',
        locationLabel: 'A-01-01',
      },
      'BAG-HAND-001': {
        bagCode: 'BAG-HAND-001',
        status: 'HANDED_OVER',
        ticketNos: ['FT-DEMO-HANDED-001'],
        productionOrderNo: 'PO-202603-0004',
        locationLabel: '',
      },
      'BAG-VOID-001': {
        bagCode: 'BAG-VOID-001',
        status: 'VOIDED',
        ticketNos: [],
        productionOrderNo: '',
        locationLabel: '',
      },
    },
    tickets: {
      ...readyTickets,
      'FT-DEMO-BAGGED-001': {
        ticketNo: 'FT-DEMO-BAGGED-001',
        status: 'BAGGED',
        bagCode: 'BAG-WAIT-001',
      },
      'FT-DEMO-INBOUNDED-001': {
        ticketNo: 'FT-DEMO-INBOUNDED-001',
        status: 'BAGGED',
        bagCode: 'BAG-IN-001',
      },
      'FT-DEMO-HANDED-001': {
        ticketNo: 'FT-DEMO-HANDED-001',
        status: 'BAGGED',
        bagCode: 'BAG-HAND-001',
      },
      'FT-DEMO-VOID-001': {
        ticketNo: 'FT-DEMO-VOID-001',
        status: 'VOIDED',
        bagCode: '',
      },
    },
    locations: {
      'A-01-01': {
        locationLabel: 'A-01-01',
        enabled: true,
        warehouseType: 'CUTTING',
      },
      '停用-01': {
        locationLabel: '停用-01',
        enabled: false,
        warehouseType: 'CUTTING',
      },
      '其他仓-01': {
        locationLabel: '其他仓-01',
        enabled: true,
        warehouseType: 'OTHER',
      },
    },
  }
}

function clonePdaCuttingInboundMockLedger(
  ledger: PdaCuttingInboundMockLedger,
): PdaCuttingInboundMockLedger {
  return {
    bags: Object.fromEntries(
      Object.entries(ledger.bags).map(([key, bag]) => [key, { ...bag, ticketNos: [...bag.ticketNos] }]),
    ),
    tickets: Object.fromEntries(
      Object.entries(ledger.tickets).map(([key, ticket]) => [key, { ...ticket }]),
    ),
    locations: Object.fromEntries(
      Object.entries(ledger.locations).map(([key, location]) => [key, { ...location }]),
    ),
  }
}

function getPdaCuttingInboundMockLedger(): PdaCuttingInboundMockLedger {
  if (typeof window === 'undefined') {
    if (!fallbackInboundMockLedger) {
      fallbackInboundMockLedger = createPdaCuttingInboundMockLedger(
        listInboundTicketCandidates().map((ticket) => ticket.ticketNo),
      )
    }
    return fallbackInboundMockLedger
  }
  if (!window.__higoodPdaCuttingInboundMockLedger) {
    window.__higoodPdaCuttingInboundMockLedger = createPdaCuttingInboundMockLedger(
      listInboundTicketCandidates().map((ticket) => ticket.ticketNo),
    )
  }
  return window.__higoodPdaCuttingInboundMockLedger
}

function replacePdaCuttingInboundMockLedger(ledger: PdaCuttingInboundMockLedger): void {
  if (typeof window === 'undefined') {
    fallbackInboundMockLedger = ledger
    return
  }
  window.__higoodPdaCuttingInboundMockLedger = ledger
}

function normalizeInboundCode(value: string): string {
  return value.trim().toUpperCase()
}

function bagStatusMessage(
  status: PdaCuttingInboundBagStatus,
  mode: PdaCuttingInboundMode,
): string {
  if (status === 'VOIDED') return '该中转袋已作废，请重新扫描。'
  if (status === 'HANDED_OVER') return '该中转袋已交出，不能继续操作。'
  if (status === 'INBOUNDED') {
    return mode === 'bagging'
      ? '该中转袋已入仓，不能再次装袋。'
      : '该中转袋已入仓，请勿重复入仓。'
  }
  if (status === 'BAGGED_WAIT_INBOUND') return '该中转袋已装袋，不能重复装袋。'
  return '空袋不能入仓，请先完成装袋。'
}

export function applyPdaCuttingInboundBusinessTransition(
  state: InboundFormState,
  mode: PdaCuttingInboundMode,
  ledger: PdaCuttingInboundMockLedger,
): InboundRoundResult & { ledger: PdaCuttingInboundMockLedger } {
  const bagCode = normalizeInboundCode(state.carrierCode)
  if (!bagCode) return { ok: false, message: '请扫描中转袋。', ledger }
  const bag = ledger.bags[bagCode]
  if (!bag) return { ok: false, message: '中转袋不存在，请重新扫描。', ledger }

  if (mode === 'bagging') {
    if (bag.status !== 'EMPTY_READY') {
      return { ok: false, message: bagStatusMessage(bag.status, mode), ledger }
    }
    if (!state.scannedTicketNos.length) {
      return { ok: false, message: '请扫描菲票。', ledger }
    }
    const normalizedTicketNos = state.scannedTicketNos.map(normalizeInboundCode)
    if (new Set(normalizedTicketNos).size !== normalizedTicketNos.length) {
      return { ok: false, message: '同一张菲票不能重复装袋，请检查后重试。', ledger }
    }
    for (const ticketNo of normalizedTicketNos) {
      const ticket = ledger.tickets[ticketNo]
      if (!ticket) {
        return { ok: false, message: `${ticketNo} 不存在，请重新扫描。`, ledger }
      }
      if (ticket.status === 'VOIDED') {
        return { ok: false, message: `${ticketNo} 已作废，请换一张。`, ledger }
      }
      if (ticket.status === 'BAGGED') {
        return { ok: false, message: `${ticketNo} 已装袋，请换一张。`, ledger }
      }
    }

    const nextLedger = clonePdaCuttingInboundMockLedger(ledger)
    const nextBag = nextLedger.bags[bagCode]
    nextBag.status = 'BAGGED_WAIT_INBOUND'
    nextBag.ticketNos = normalizedTicketNos
    nextBag.productionOrderNo = state.bagProductionOrderNo
    nextBag.locationLabel = ''
    nextBag.ticketNos.forEach((ticketNo) => {
      nextLedger.tickets[ticketNo].status = 'BAGGED'
      nextLedger.tickets[ticketNo].bagCode = bagCode
    })
    return { ok: true, ledger: nextLedger }
  }

  if (bag.status !== 'BAGGED_WAIT_INBOUND') {
    return { ok: false, message: bagStatusMessage(bag.status, mode), ledger }
  }
  const locationLabel = normalizeInboundCode(state.locationLabel)
  if (!locationLabel) return { ok: false, message: '请扫描库区库位。', ledger }
  const location = ledger.locations[locationLabel]
  if (!location) return { ok: false, message: '库位不存在，请重新扫描。', ledger }
  if (!location.enabled) return { ok: false, message: '该库位已停用，请更换库位。', ledger }
  if (location.warehouseType !== 'CUTTING') {
    return { ok: false, message: '该库位不是裁床库位，请更换库位。', ledger }
  }

  const nextLedger = clonePdaCuttingInboundMockLedger(ledger)
  nextLedger.bags[bagCode].status = 'INBOUNDED'
  nextLedger.bags[bagCode].locationLabel = locationLabel
  return { ok: true, ledger: nextLedger }
}

export interface PdaCuttingInboundScanTimerController {
  schedule: (stateKey: string, callback: () => void) => void
  flush: (stateKey: string) => boolean
  cancel: (stateKey: string) => void
  cancelAll: () => void
  hasPending: (stateKey: string) => boolean
}

export function createPdaCuttingInboundScanTimerController(
  scheduleTimer: (callback: () => void, delayMs: number) => unknown = (callback, delayMs) =>
    setTimeout(callback, delayMs),
  cancelTimer: (timer: unknown) => void = (timer) =>
    clearTimeout(timer as ReturnType<typeof setTimeout>),
): PdaCuttingInboundScanTimerController {
  const pendingByStateKey = new Map<string, {
    timer: unknown
    callback: () => void
    round: number
  }>()
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
      }, PDA_CUTTING_INBOUND_SCAN_DEBOUNCE_MS)
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

const ticketScanTimerController = createPdaCuttingInboundScanTimerController()

export function cancelPdaCuttingInboundPendingScans(): void {
  ticketScanTimerController.cancelAll()
  getInboundStateStore().forEach((state, stateKey) => {
    getInboundStateStore().set(stateKey, { ...state, lastTicketScanStatus: 'idle' })
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('higood:pda-cutting-inbound-leave', cancelPdaCuttingInboundPendingScans)
}

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
    lastTicketScanStatus: 'idle',
    resultMessage: '',
    selectedLocationId: '',
  }
}

export function applyPdaCuttingInboundTicketScan(
  state: InboundFormState,
  ticket: ScannedTicketInput,
): PdaCuttingInboundTicketScanResult {
  if (!state.carrierCode.trim()) {
    return {
      ok: false,
      state: {
        ...state,
        scanFeedbackMessage: '请先扫描中转袋。',
        lastTicketScanStatus: 'invalid',
      },
    }
  }
  if (state.scannedTicketNos.includes(ticket.ticketNo)) {
    return {
      ok: false,
      state: {
        ...state,
        scanFeedbackMessage: `${ticket.ticketNo} 已扫过，请扫下一张。`,
        lastTicketScanStatus: 'invalid',
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
        lastTicketScanStatus: 'invalid',
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
      lastTicketScanStatus: 'valid',
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

export function confirmPdaCuttingInboundRound(
  state: InboundFormState,
  mode: PdaCuttingInboundMode,
  ledger: PdaCuttingInboundMockLedger,
): PdaCuttingInboundConfirmOutcome {
  let result: InboundRoundResult
  let nextLedger = ledger

  if (mode === 'bagging' && state.lastTicketScanStatus === 'invalid') {
    result = {
      ok: false,
      message: state.scanFeedbackMessage || '菲票扫码失败，请检查后重试。',
    }
  } else if (mode === 'bagging' && state.scanCode.trim()) {
    result = { ok: false, message: '请先完成当前菲票扫描。' }
  } else {
    const transition = applyPdaCuttingInboundBusinessTransition(state, mode, ledger)
    result = transition
    if (transition.ok) nextLedger = transition.ledger
  }

  return {
    result,
    nextForm: completePdaCuttingInboundRound(state, mode, result),
    ledger: nextLedger,
  }
}

export function appendPdaCuttingInboundRuntimeEvent(
  state: InboundFormState,
  mode: PdaCuttingInboundMode,
  candidates: TransferBagTicketCandidate[] = listInboundTicketCandidates(),
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  locationRefOverride?: StableWarehouseLocationRef,
): void {
  const bagCode = normalizeInboundCode(state.carrierCode)
  if (!bagCode) throw new Error('请扫描中转袋。')
  if (mode === 'bagging') {
    const ticketNos = state.scannedTicketNos.map(normalizeInboundCode)
    const tickets = ticketNos.map((ticketNo) =>
      candidates.find((candidate) =>
        normalizeInboundCode(candidate.ticketNo) === ticketNo))
    if (tickets.some((ticket) => !ticket)) {
      throw new Error('存在无法写入事实账的菲票，请重新扫描。')
    }
    appendWaitHandoverBaggingEvent({
      source: 'PDA',
      operator: {
        operatorName: state.operatorName.trim() || '仓务操作员',
        operatorRole: '裁片仓装袋员',
      },
      bagCode,
      tickets: tickets.map((ticket) =>
        buildWaitHandoverRuntimeTicketFromTransferCandidate(ticket!)),
      storage,
    })
    return
  }

  const snapshot = resolveWaitHandoverBaggingSnapshot(bagCode, storage)
  if (!snapshot) {
    throw new Error('该中转袋尚未完成菲票装袋，不能入仓。')
  }
  const locationRef = locationRefOverride || resolveCurrentWaitHandoverLocationRef(state.locationLabel)
  if (!locationRef) {
    throw new Error('库位不存在、已占用或不属于当前工厂，请重新选择。')
  }
  appendWaitHandoverInboundEvent({
    source: 'PDA',
    operator: {
      operatorName: state.operatorName.trim() || '仓务操作员',
      operatorRole: '裁片仓入仓员',
    },
    bagCode,
    warehouseArea: locationRef.areaName,
    locationCode: locationRef.locationNo,
    locationRef: {
      factoryId: locationRef.factoryId,
      warehouseId: locationRef.warehouseId,
      warehouseKind: 'WAIT_HANDOVER',
      areaId: locationRef.areaId,
      areaName: locationRef.areaName,
      shelfId: locationRef.shelfId,
      shelfNo: locationRef.shelfNo,
      locationId: locationRef.locationId,
      locationNo: locationRef.locationNo,
    },
    usageCycleId: snapshot.usageCycleId,
    idempotencyKey: `temp-bag:${bagCode}:INBOUND`,
    storage,
  })
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
  const stateKey = buildInboundStateKey(taskId, mode, executionOrderId, executionOrderNo)
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
  getInboundStateStore().set(buildInboundStateKey(taskId, mode, executionOrderId, executionOrderNo), state)
}

function buildInboundStateKey(
  taskId: string,
  mode: PdaCuttingInboundMode,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
): string {
  const executionKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  return `${executionKey}::${mode}`
}

function getInboundMode(): PdaCuttingInboundMode {
  if (typeof window === 'undefined') return 'bagging'
  return new URLSearchParams(window.location.search).get('action') === 'inbound-location'
    ? 'inbound-location'
    : 'bagging'
}

function resolveInboundEventState(
  taskId: string,
  mode: PdaCuttingInboundMode = getInboundMode(),
  sourceNode?: HTMLElement,
): {
  form: InboundFormState
  selectedExecutionOrderId: string | null
  selectedExecutionOrderNo: string | null
} {
  const workflowContainer = sourceNode
    ? resolvePdaCuttingInboundFormContainer(sourceNode)
    : null
  if (workflowContainer?.dataset?.pdaCuttingContextReady === 'true') {
    const selectedExecutionOrderId =
      workflowContainer.dataset.executionOrderId?.trim() || null
    const selectedExecutionOrderNo =
      workflowContainer.dataset.executionOrderNo?.trim() || null
    return {
      form: getState(taskId, mode, selectedExecutionOrderId, selectedExecutionOrderNo),
      selectedExecutionOrderId,
      selectedExecutionOrderNo,
    }
  }
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

function listCurrentWaitHandoverLocationRefs(): StableWarehouseLocationRef[] {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return []
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  return listStableWarehouseLocationRefs(warehouse, snapshot)
}

function buildPdaInboundLocationMapProjection() {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return null
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  const occupancies: WarehouseLocationOccupancy[] = buildWaitHandoverLocationOccupancyStates(
    listWaitHandoverRuntimeEvents(),
  )
    .filter((state) =>
      state.locationRef.factoryId === warehouse.factoryId
      && state.locationRef.warehouseId === warehouse.warehouseId,
    )
    .map((state) => ({
      occupancyId: `wait-handover:${state.sourceEventId}`,
      footprintId: `bag:${state.bagCode}`,
      locationId: state.locationRef.locationId,
      productionOrderNo: state.productionOrderNo,
      objectNo: state.bagCode,
      objectName: `中转袋 ${state.bagCode}`,
      qty: state.totalPieceQty,
      unit: '片',
      inboundAt: state.inboundAt,
      inboundBy: state.inboundBy,
    }))
  return buildWarehouseLocationMapProjection(warehouse, snapshot, occupancies)
}

function renderPdaInboundLocationMap(form: InboundFormState): string {
  const projection = buildPdaInboundLocationMapProjection()
  if (!projection) {
    return '<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">当前没有可用的待交出仓库位。</div>'
  }
  return renderWarehouseLocationMap({
    projection,
    mode: 'SELECT',
    factoryName: '当前裁床工厂',
    selectedLocationIds: form.selectedLocationId ? [form.selectedLocationId] : [],
    selectionLimit: 1,
  })
}

function validateCurrentWaitHandoverLocation(
  locationLabel: string,
): { ok: true; ref: StableWarehouseLocationRef } | { ok: false; message: string } {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return { ok: false, message: '当前工厂未设置待交出仓，不能入仓。' }
  const loaded = loadWarehouseLayoutSnapshot(warehouse)
  const qrParts = locationLabel.trim().split('|').map((part) => part.trim())
  if (qrParts.length === 2 && normalizeInboundCode(qrParts[0]) !== normalizeInboundCode(warehouse.factoryId)) {
    return { ok: false, message: '该库位不属于当前工厂，请重新扫描。' }
  }
  const normalized = normalizeInboundCode(qrParts.length === 2 ? qrParts[1] : locationLabel)
  if (!normalized) return { ok: false, message: '请扫描库区库位，或从库位图选择。' }
  const rawMatches = listStableWarehouseLocationRefs(warehouse).filter((location) =>
    normalizeInboundCode(location.locationNo) === normalized,
  )
  if (rawMatches.length > 1) return { ok: false, message: '库位编号不唯一，请从库位图选择。' }
  if (rawMatches[0] && loaded.snapshot.unassignedLocationIds.includes(rawMatches[0].locationId)) {
    return { ok: false, message: '该库位尚未编排到货架，请联系仓务文员。' }
  }
  if (rawMatches[0] && rawMatches[0].status !== 'AVAILABLE') {
    return { ok: false, message: '该库位已停用，请更换库位。' }
  }
  const matches = listStableWarehouseLocationRefs(warehouse, loaded.snapshot).filter((location) =>
    normalizeInboundCode(location.locationNo) === normalized,
  )
  if (!matches.length) return { ok: false, message: '库位不存在，请重新扫描。' }
  if (matches.length > 1) return { ok: false, message: '库位编号不唯一，请从库位图选择。' }
  const occupied = buildWaitHandoverLocationOccupancyStates(listWaitHandoverRuntimeEvents())
    .some((state) => state.locationRef.locationId === matches[0].locationId)
  if (occupied) return { ok: false, message: '该库位已被其他中转袋占用，请更换库位。' }
  return { ok: true, ref: matches[0] }
}

function resolveCurrentWaitHandoverLocationRef(locationLabel: string): StableWarehouseLocationRef | null {
  const result = validateCurrentWaitHandoverLocation(locationLabel)
  return result.ok ? result.ref : null
}

function mergeCurrentWaitHandoverLocations(
  ledger: PdaCuttingInboundMockLedger,
): PdaCuttingInboundMockLedger {
  const next = clonePdaCuttingInboundMockLedger(ledger)
  next.locations = {}
  listCurrentWaitHandoverLocationRefs().forEach((location) => {
    next.locations[normalizeInboundCode(location.locationNo)] = {
      locationLabel: location.locationNo,
      enabled: location.status === 'AVAILABLE',
      warehouseType: 'CUTTING',
    }
  })
  return next
}

function buildInboundRuntimeTickets(
  bag: PdaCuttingInboundMockLedger['bags'][string],
): WaitHandoverRuntimeTicketInput[] {
  const candidates = listInboundTicketCandidates()
  return bag.ticketNos.map((ticketNo) => {
    const candidate = candidates.find((item) => normalizeInboundCode(item.ticketNo) === normalizeInboundCode(ticketNo))
    return {
      feiTicketId: candidate?.feiTicketId || ticketNo,
      feiTicketNo: ticketNo,
      productionOrderId: candidate?.productionOrderId || '',
      productionOrderNo: candidate?.productionOrderNo || bag.productionOrderNo,
      cutOrderId: candidate?.cutOrderId || '',
      cutOrderNo: candidate?.cutOrderNo || '',
      spreadingOrderId: candidate?.sourceSpreadingSessionId || '',
      spreadingOrderNo: candidate?.sourceSpreadingSessionNo || '',
      spuCode: candidate?.spuCode || candidate?.styleCode || '',
      color: candidate?.color || candidate?.fabricColor || '',
      size: candidate?.size || '',
      partCode: candidate?.partCode || '',
      partName: candidate?.partName || '',
      pieceQty: Number(candidate?.actualCutPieceQty || candidate?.qty || 0),
      pieceSequenceLabel: candidate?.pieceSequenceLabel || '',
      hasSpecialCraft: Boolean(candidate?.hasSpecialCraft),
      specialCraftDisplay: candidate?.specialCraftDisplayLabel || '无',
      receiverFactoryDisplay: candidate?.receiverFactoryDisplay || '待分配',
      printStatus: candidate?.printStatus || 'PRINTED',
      voidStatus: candidate?.ticketStatus === 'VOIDED' ? 'VOIDED' : 'VALID',
    }
  })
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
  ledger: PdaCuttingInboundMockLedger,
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
  const ledgerTicket = ledger.tickets[normalizeInboundCode(ticket.ticketNo)]
  if (!ledgerTicket) {
    return { ok: false, reason: '没有找到这张菲票，请重新扫描。', ticket }
  }
  if (ledgerTicket.status === 'VOIDED') {
    return { ok: false, reason: '这张菲票已作废，请换一张。', ticket }
  }
  if (ledgerTicket.status === 'BAGGED') {
    return { ok: false, reason: '这张菲票已装袋，请换一张。', ticket }
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
  ledger: PdaCuttingInboundMockLedger,
): PdaCuttingInboundTicketScanResult {
  const validation = validateInboundScan(form, scanCode, candidates, ledger)
  if (!validation.ok || !validation.ticket) {
    return {
      ok: false,
      state: {
        ...form,
        scanCode: '',
        scanFeedbackMessage: validation.reason,
        lastTicketScanStatus: 'invalid',
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

function renderPdaCuttingInboundWorkflowContent(
  mode: PdaCuttingInboundMode,
  form: InboundFormState,
  taskId = '',
): string {
  const isInboundLocation = mode === 'inbound-location'
  return `
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
            <div class="text-xs text-muted-foreground">扫码不便时，可直接在下方库位图选择一个空闲库位。</div>
            <div data-pda-inbound-location-map>${renderPdaInboundLocationMap(form)}</div>
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
  `
}

export function renderPdaCuttingInboundWorkflow(
  mode: PdaCuttingInboundMode,
  form: InboundFormState,
  taskId = '',
  executionOrderId = '',
  executionOrderNo = '',
): string {
  return `
    <section
      class="space-y-4 rounded-2xl border bg-card px-3 py-3 shadow-sm"
      data-pda-cutting-inbound-workflow
      data-pda-cutting-context-ready="true"
      data-task-id="${escapeHtml(taskId)}"
      data-execution-order-id="${escapeHtml(executionOrderId)}"
      data-execution-order-no="${escapeHtml(executionOrderNo)}"
    >
      ${renderPdaCuttingInboundWorkflowContent(mode, form, taskId)}
    </section>
  `
}

export function updatePdaCuttingInboundWorkflow(
  container: HTMLElement | null,
  mode: PdaCuttingInboundMode,
  form: InboundFormState,
  taskId = '',
  focusField: 'carrierCode' | 'scanCode' | 'locationLabel' = 'carrierCode',
): boolean {
  if (!container) return false
  container.innerHTML = renderPdaCuttingInboundWorkflowContent(mode, form, taskId)
  const focusTarget = container.querySelector<HTMLInputElement>(
    `[data-pda-cut-inbound-field="${focusField}"]`,
  )
  if (!focusTarget) return false
  focusTarget.focus({ preventScroll: true })
  return true
}

export function resolvePdaCuttingInboundConfirmFocus(
  mode: PdaCuttingInboundMode,
  result: InboundRoundResult,
): 'carrierCode' | 'scanCode' | 'locationLabel' {
  if (result.ok) return 'carrierCode'
  const message = result.message || ''
  if (mode === 'inbound-location' && (message.includes('库位') || message.includes('库区'))) {
    return 'locationLabel'
  }
  if (mode === 'bagging' && message.includes('菲票')) return 'scanCode'
  return 'carrierCode'
}

export function renderPdaCuttingInboundPage(taskId: string): string {
  const mode = getInboundMode()
  const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
  getPdaCuttingInboundMockLedger()
  const form = getState(taskId, mode, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageTitle = mode === 'inbound-location' ? '中转袋入仓' : '菲票装袋'

  return renderPdaCuttingPageLayout({
    taskId,
    title: pageTitle,
    subtitle: '',
    activeTab: 'warehouse',
    body: renderPdaCuttingInboundWorkflow(
      mode,
      form,
      taskId,
      context.selectedExecutionOrderId || '',
      context.selectedExecutionOrderNo || '',
    ),
    backHref: '/fcs/pda/warehouse/wait-handover?scope=cutting',
  })
}

export function resolvePdaCuttingInboundFormContainer(node: HTMLElement): HTMLElement | null {
  return node.closest<HTMLElement>('[data-pda-cutting-inbound-workflow]')
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
    getPdaCuttingInboundMockLedger(),
  )
  replaceState(
    taskId,
    mode,
    next.state,
    eventState.selectedExecutionOrderId,
    eventState.selectedExecutionOrderNo,
  )
  updateBaggingLiveRegion(resolvePdaCuttingInboundFormContainer(fieldNode), next.state)
}

export function syncPdaCuttingInboundFormFromControls(
  form: InboundFormState,
  container: HTMLElement | null,
): void {
  if (!container) return
  const carrierCode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="carrierCode"]')
  const scanCode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="scanCode"]')
  const locationLabel = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="locationLabel"]')
  if (carrierCode) form.carrierCode = carrierCode.value
  if (scanCode) form.scanCode = scanCode.value
  if (locationLabel) form.locationLabel = locationLabel.value
}

export function handlePdaCuttingInboundEvent(
  target: HTMLElement,
  event?: Event,
): PdaPageEventResult {
  const mode = getInboundMode()
  const warehouseMapNode = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (mode === 'inbound-location' && warehouseMapNode) {
    const workflowContainer = resolvePdaCuttingInboundFormContainer(warehouseMapNode)
    const taskId = workflowContainer?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const eventState = resolveInboundEventState(taskId, mode, warehouseMapNode)
    if (warehouseMapNode.dataset.warehouseMapAction === 'clear-selection') {
      eventState.form.locationLabel = ''
      eventState.form.selectedLocationId = ''
    } else if (warehouseMapNode.dataset.warehouseMapAction === 'toggle-location') {
      const locationId = warehouseMapNode.dataset.locationId || ''
      const location = listCurrentWaitHandoverLocationRefs()
        .find((item) => item.locationId === locationId)
      if (!location) return true
      eventState.form.locationLabel = location.locationNo
      eventState.form.selectedLocationId = location.locationId
    } else {
      return true
    }
    replaceState(
      taskId,
      mode,
      eventState.form,
      eventState.selectedExecutionOrderId,
      eventState.selectedExecutionOrderNo,
    )
    const input = workflowContainer?.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="locationLabel"]')
    if (input) input.value = eventState.form.locationLabel
    const mapRegion = workflowContainer?.querySelector<HTMLElement>('[data-pda-inbound-location-map]')
    if (mapRegion) mapRegion.innerHTML = renderPdaInboundLocationMap(eventState.form)
    return PDA_PAGE_HANDLED_LOCALLY
  }
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-inbound-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const eventState = resolveInboundEventState(taskId, mode, fieldNode)
    const field = fieldNode.dataset.pdaCutInboundField
    if (!field) return true

    if (field === 'carrierCode') eventState.form.carrierCode = fieldNode.value
    if (field === 'locationLabel') {
      eventState.form.locationLabel = fieldNode.value
      eventState.form.selectedLocationId = resolveCurrentWaitHandoverLocationRef(fieldNode.value)?.locationId || ''
    }
    if (field === 'scanCode' && mode === 'bagging' && fieldNode instanceof HTMLInputElement) {
      eventState.form.scanCode = fieldNode.value
      if (fieldNode.value.trim()) eventState.form.lastTicketScanStatus = 'idle'
      const stateKey = buildInboundStateKey(
        taskId,
        mode,
        eventState.selectedExecutionOrderId,
        eventState.selectedExecutionOrderNo,
      )
      const trigger = resolvePdaCuttingInboundScanTrigger({
        type: event?.type || 'input',
        key: event && 'key' in event ? String(event.key || '') : undefined,
      })
      ticketScanTimerController.cancel(stateKey)
      if (!fieldNode.value.trim() || trigger === 'none') return true
      if (trigger === 'immediate') {
        completeInboundTicketScan(fieldNode, taskId, mode, eventState)
      } else {
        ticketScanTimerController.schedule(
          stateKey,
          () => completeInboundTicketScan(fieldNode, taskId, mode, eventState),
        )
      }
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action="confirm"]')
  if (!actionNode) return false
  const taskId = actionNode.dataset.taskId
  if (!taskId) return false
  const workflowContainer = resolvePdaCuttingInboundFormContainer(actionNode)
  let eventState = resolveInboundEventState(taskId, mode, actionNode)
  const stateKey = buildInboundStateKey(
    taskId,
    mode,
    eventState.selectedExecutionOrderId,
    eventState.selectedExecutionOrderNo,
  )
  syncPdaCuttingInboundFormFromControls(
    eventState.form,
    workflowContainer,
  )
  if (mode === 'bagging' && ticketScanTimerController.flush(stateKey)) {
    eventState = resolveInboundEventState(taskId, mode, actionNode)
  }

  const locationValidation = mode === 'inbound-location'
    ? validateCurrentWaitHandoverLocation(eventState.form.locationLabel)
    : null
  if (locationValidation && !locationValidation.ok) {
    const failedForm = completePdaCuttingInboundRound(eventState.form, mode, {
      ok: false,
      message: locationValidation.message,
    })
    replaceState(
      taskId,
      mode,
      failedForm,
      eventState.selectedExecutionOrderId,
      eventState.selectedExecutionOrderNo,
    )
    return updatePdaCuttingInboundWorkflow(
      workflowContainer,
      mode,
      failedForm,
      taskId,
      'locationLabel',
    ) ? PDA_PAGE_HANDLED_LOCALLY : true
  }

  const currentLedger = mode === 'inbound-location'
    ? mergeCurrentWaitHandoverLocations(getPdaCuttingInboundMockLedger())
    : getPdaCuttingInboundMockLedger()
  let confirmation = confirmPdaCuttingInboundRound(eventState.form, mode, currentLedger)
  if (confirmation.result.ok) {
    try {
      appendPdaCuttingInboundRuntimeEvent(eventState.form, mode)
      ticketScanTimerController.cancel(stateKey)
      replacePdaCuttingInboundMockLedger(confirmation.ledger)
    } catch (error) {
      const message = error instanceof Error ? error.message : '事实账写入失败，请重试。'
      const result = { ok: false, message }
      confirmation = {
        result,
        nextForm: completePdaCuttingInboundRound(
          eventState.form,
          mode,
          result,
        ),
        ledger: currentLedger,
      }
    }
  }
  replaceState(
    taskId,
    mode,
    confirmation.nextForm,
    eventState.selectedExecutionOrderId,
    eventState.selectedExecutionOrderNo,
  )
  const updatedLocally = updatePdaCuttingInboundWorkflow(
    workflowContainer,
    mode,
    confirmation.nextForm,
    taskId,
    resolvePdaCuttingInboundConfirmFocus(mode, confirmation.result),
  )
  return updatedLocally ? PDA_PAGE_HANDLED_LOCALLY : true
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/inbound\/([^/]+)/)
  return matched?.[1] ?? ''
}
