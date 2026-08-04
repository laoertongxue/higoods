// @page-pattern: pda
import { escapeHtml } from '../utils'
import { getBrowserLocalStorage, type BrowserStorageLike } from '../data/browser-storage.ts'
import {
  classifyTransferBagForHandoverTask,
  ensureTransferBagAvailableForUse,
  resolveTransferBagAuthoritativeCurrentLocation,
  resolveTransferBagCurrentUse,
  type RecoverTransferBagInput,
  type TransferBagHandoverTaskContext,
} from '../data/fcs/cutting/transfer-bag-operations.ts'
import {
  listCuttingRuntimeEvents,
  type RuntimeWarehouseLocationRef,
  type TransferBagTicketFactSnapshot,
} from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { ensureTransferBagRepackMockEvents } from '../data/fcs/cutting/transfer-bag-repack-mock.ts'
import { assertCuttingHandoverPpic, buildCuttingHandoverPpicOptions } from '../data/fcs/cutting/transfer-bag-handover-mock.ts'
import { submitWaitHandoverRepackWithSourceReturnsAndResultHandovers, submitWaitHandoverTaskBatch } from './process-factory/cutting/wait-handover-runtime.ts'
import { getCurrentFactoryWarehouseByKind } from './pda-warehouse-shared.ts'
import { loadWarehouseLayoutSnapshot } from './process-factory/cutting/warehouse-location-layout-store.ts'
import { listStableWarehouseLocationRefs } from './process-factory/cutting/warehouse-location-map-model.ts'
import { renderPdaFrame } from './pda-shell'
import { PDA_PAGE_HANDLED_LOCALLY, type PdaPageEventResult } from '../main-handlers/pda-local-action-result.ts'

export type PdaTransferBagRepackStep = 'SOURCE_BAGS' | 'GROUPS' | 'RESULT_BAGS' | 'TICKETS' | 'SOURCE_RETURNS' | 'CONFIRM' | 'DONE'

export interface ForceRecoveryConfirmation {
  physicalBagReceived: true
  physicalBagEmpty: true
  recoveryNode: string
  recoveryLocation: string
  reason: string
}

export interface PdaTransferBagRepackState {
  step: PdaTransferBagRepackStep
  repackBatchId: string
  handoverBatchId: string
  occurredAt: string
  sewingTaskNo: string
  receiverPpicId: string
  productionOrderNo: string
  receiverFactoryId: string
  receiverFactoryName: string
  targetFeiTicketIds: string[]
  sourceBagCodes: string[]
  sourceTicketSnapshotById: Record<string, TransferBagTicketFactSnapshot>
  sourceBagByTicketId: Record<string, string>
  sourceOriginalLocationByBagCode: Record<string, RuntimeWarehouseLocationRef>
  sourceReturnLocationByBagCode: Record<string, RuntimeWarehouseLocationRef>
  ticketTargetById: Record<string, string>
  scannedResultBagCodes: string[]
  forceRecoveryByBagCode: Record<string, ForceRecoveryConfirmation>
  activeGroupKey: string
  activeResultBagCode: string
  pendingTicketId: string
  pendingForceBagCode: string
  feedback: string
  submittedEventId: string
}

export interface PdaRepackSourceSummary {
  bagCode: string
  transferredTicketCount: number
  transferredPieceQty: number
  retainedTicketCount: number
  retainedPieceQty: number
  becomesIdle: boolean
  usedAsResult: boolean
  returnLocationRef?: RuntimeWarehouseLocationRef
}

export interface PdaRepackResultSummary {
  bagCode: string
  productionOrderNo: string
  receiverFactoryName: string
  ticketCount: number
  pieceQty: number
  ticketIds: string[]
}

export interface PdaRepackGroupSummary {
  groupKey: string
  productionOrderNo: string
  receiverFactoryId: string
  receiverFactoryName: string
  totalTicketCount: number
  totalPieceQty: number
  remainingTicketCount: number
  remainingPieceQty: number
}

export interface PdaRepackConfirmationSummary {
  sourceBags: PdaRepackSourceSummary[]
  resultBags: PdaRepackResultSummary[]
  directBagCodes: string[]
  totalSourceTicketCount: number
  totalResultTicketCount: number
  totalSourcePieceQty: number
  totalResultPieceQty: number
  totalRetainedTicketCount: number
  totalRetainedPieceQty: number
  canSubmit: boolean
  errors: string[]
}

declare global {
  interface Window {
    __higoodPdaTransferBagRepackState?: PdaTransferBagRepackState
  }
}

let fallbackState: PdaTransferBagRepackState | null = null

function newRepackBatchId(): string {
  return `PDA-REPACK-${Date.now()}`
}

export function createPdaTransferBagRepackState(): PdaTransferBagRepackState {
  return {
    step: 'SOURCE_BAGS',
    repackBatchId: newRepackBatchId(),
    handoverBatchId: `PDA-HANDOVER-${Date.now()}`,
    occurredAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    sewingTaskNo: '',
    receiverPpicId: '',
    productionOrderNo: '',
    receiverFactoryId: '',
    receiverFactoryName: '',
    targetFeiTicketIds: [],
    sourceBagCodes: [],
    sourceTicketSnapshotById: {},
    sourceBagByTicketId: {},
    sourceOriginalLocationByBagCode: {},
    sourceReturnLocationByBagCode: {},
    ticketTargetById: {},
    scannedResultBagCodes: [],
    forceRecoveryByBagCode: {},
    activeGroupKey: '',
    activeResultBagCode: '',
    pendingTicketId: '',
    pendingForceBagCode: '',
    feedback: '',
    submittedEventId: '',
  }
}

function getRepackState(): PdaTransferBagRepackState {
  if (typeof window === 'undefined') {
    fallbackState ||= createPdaTransferBagRepackState()
    return fallbackState
  }
  window.__higoodPdaTransferBagRepackState ||= createPdaTransferBagRepackState()
  return window.__higoodPdaTransferBagRepackState
}

function replaceRepackState(state: PdaTransferBagRepackState): void {
  if (typeof window === 'undefined') fallbackState = state
  else window.__higoodPdaTransferBagRepackState = state
}

function normalizeCode(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase().replace(/[‐‑‒–—−\s]+/gu, '-')
}

function listCurrentWaitHandoverLocations(): RuntimeWarehouseLocationRef[] {
  const warehouse = getCurrentFactoryWarehouseByKind('WAIT_HANDOVER')
  if (!warehouse) return []
  const snapshot = warehouse.factoryKind === 'CENTRAL_CUTTING'
    ? loadWarehouseLayoutSnapshot(warehouse).snapshot
    : undefined
  return listStableWarehouseLocationRefs(warehouse, snapshot)
}

function resolvePdaRepackReturnLocation(rawValue: string): RuntimeWarehouseLocationRef {
  const value = rawValue.trim()
  if (!value) throw new Error('请扫描或填写回仓库位。')
  const refs = listCurrentWaitHandoverLocations()
  const parts = value.split('|').map((part) => part.trim())
  const normalized = normalizeCode(parts.at(-1) || value)
  const matches = refs.filter((ref) => parts.length === 4
    ? ref.factoryId === parts[0]
      && ref.warehouseId === parts[1]
      && ref.warehouseKind === parts[2]
      && ref.locationId === parts[3]
    : normalizeCode(ref.locationNo) === normalized)
  if (matches.length !== 1) throw new Error(matches.length ? '库位编号不唯一，请扫描完整库位码。' : '库位不存在或不属于当前待交出仓。')
  const ref = matches[0]
  if (ref.areaStatus !== 'AVAILABLE' || ref.shelfStatus !== 'AVAILABLE' || ref.status !== 'AVAILABLE') {
    throw new Error(`${ref.locationNo} 已停用，请更换库位。`)
  }
  return ref
}

function visibleRepackStep(step: PdaTransferBagRepackStep): number {
  if (step === 'SOURCE_BAGS') return 1
  if (step === 'GROUPS') return 2
  if (step === 'RESULT_BAGS' || step === 'TICKETS') return 3
  if (step === 'SOURCE_RETURNS') return 4
  return 5
}

function listCurrentTransferBagCodes(storage: BrowserStorageLike | null): string[] {
  return Array.from(new Set(listCuttingRuntimeEvents(storage)
    .map((event) => event.refs.transferBagCode || '')
    .filter(Boolean)))
}

function resolvePdaHandoverTaskContext(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagHandoverTaskContext {
  const taskNo = normalizeCode(state.sewingTaskNo)
  if (!taskNo) throw new Error('请扫描或填写车缝任务编号。')
  const snapshotTickets = Object.values(state.sourceTicketSnapshotById)
  const tickets = (snapshotTickets.length
    ? snapshotTickets
    : listCurrentTransferBagCodes(storage).flatMap((bagCode) => resolveTransferBagCurrentUse(bagCode, storage).tickets))
    .filter((ticket) => normalizeCode(ticket.sewingTaskNo) === taskNo)
  if (!tickets.length) throw new Error('没有找到这个车缝任务的待交出菲票。')
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
  const taskIds = unique(tickets.map((ticket) => ticket.sewingTaskId))
  const productionOrderIds = unique(tickets.map((ticket) => ticket.productionOrderId))
  const productionOrderNos = unique(tickets.map((ticket) => ticket.productionOrderNo))
  const factoryIds = unique(tickets.map((ticket) => ticket.receiverFactoryId))
  const factoryNames = unique(tickets.map((ticket) => ticket.receiverFactoryName))
  if ([taskIds, productionOrderIds, productionOrderNos, factoryIds, factoryNames].some((items) => items.length !== 1)) {
    throw new Error('一次只能处理一个生产单的一个车缝任务和一个接收车缝工厂。')
  }
  const ppicOptions = buildCuttingHandoverPpicOptions({ receiverFactoryId: factoryIds[0], receiverFactoryName: factoryNames[0] })
  const selectedPpic = ppicOptions.find((item) => normalizeCode(item.ppicId) === normalizeCode(state.receiverPpicId))
  if (!selectedPpic) throw new Error('请扫描或填写当前接收工厂的 PPIC 编号。')
  const ppic = assertCuttingHandoverPpic({
    ppicId: selectedPpic.ppicId,
    ppicName: selectedPpic.ppicName,
    receiverFactoryId: factoryIds[0],
    receiverFactoryName: factoryNames[0],
  })
  return {
    handoverBatchId: state.handoverBatchId,
    productionOrderId: productionOrderIds[0],
    productionOrderNo: productionOrderNos[0],
    sewingTaskId: taskIds[0],
    sewingTaskNo: tickets[0].sewingTaskNo,
    receiverFactoryId: factoryIds[0],
    receiverFactoryName: factoryNames[0],
    receiverPpicId: ppic.ppicId,
    receiverPpicName: ppic.ppicName,
    targetFeiTicketIds: unique(tickets.map((ticket) => ticket.feiTicketId)),
  }
}

export function preparePdaHandoverTask(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  const context = resolvePdaHandoverTaskContext(state, storage)
  let next: PdaTransferBagRepackState = {
    ...state,
    sourceBagCodes: [],
    sourceTicketSnapshotById: {},
    sourceBagByTicketId: {},
    sourceOriginalLocationByBagCode: {},
    sourceReturnLocationByBagCode: {},
    ticketTargetById: {},
    scannedResultBagCodes: [],
    productionOrderNo: context.productionOrderNo,
    receiverFactoryId: context.receiverFactoryId,
    receiverFactoryName: context.receiverFactoryName,
    targetFeiTicketIds: context.targetFeiTicketIds,
  }
  const targetIds = new Set(context.targetFeiTicketIds)
  listCurrentTransferBagCodes(storage).forEach((bagCode) => {
    const current = resolveTransferBagCurrentUse(bagCode, storage)
    if (current.tickets.some((ticket) => targetIds.has(ticket.feiTicketId))) {
      next = scanRepackSourceBag(next, bagCode, storage)
    }
  })
  if (!next.sourceBagCodes.length) throw new Error('目标菲票没有可追踪的当前中转袋。')
  return { ...next, step: 'GROUPS', feedback: `已找到 ${next.sourceBagCodes.length} 只相关中转袋，请核对直接交出与重装处理。` }
}

function sourceTickets(
  state: PdaTransferBagRepackState,
  _storage: BrowserStorageLike | null,
): Array<{ bagCode: string; ticket: TransferBagTicketFactSnapshot }> {
  return Object.values(state.sourceTicketSnapshotById).map((ticket) => ({
    bagCode: state.sourceBagByTicketId[ticket.feiTicketId] || '',
    ticket,
  }))
}

function resolvePdaSourceCurrentUse(
  state: PdaTransferBagRepackState,
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
) {
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  const snapshot = sourceTickets(state, storage)
    .filter((item) => item.bagCode === bagCode)
    .map((item) => item.ticket)
  return snapshot.length ? { ...current, tickets: snapshot } : current
}

function ticketGroupKey(ticket: TransferBagTicketFactSnapshot): string {
  return [ticket.productionOrderNo, ticket.receiverFactoryId, ticket.receiverFactoryName].join('|')
}

export function buildPdaRepackGroups(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaRepackGroupSummary[] {
  const groups = new Map<string, TransferBagTicketFactSnapshot[]>()
  const targetIds = new Set(state.targetFeiTicketIds)
  let repackBagCodes = new Set(state.sourceBagCodes)
  try {
    const context = resolvePdaHandoverTaskContext(state, storage)
    const selectedResultBagCodes = new Set(Object.values(state.ticketTargetById))
    repackBagCodes = new Set(state.sourceBagCodes.filter((bagCode) =>
      selectedResultBagCodes.has(bagCode)
      || classifyTransferBagForHandoverTask({ currentUse: resolvePdaSourceCurrentUse(state, bagCode, storage), handoverContext: context }).disposition === 'REPACK_REQUIRED'))
  } catch {
    // 首步尚未确认任务时不构造可操作分组。
  }
  sourceTickets(state, storage).filter(({ bagCode, ticket }) => repackBagCodes.has(bagCode) && (!targetIds.size || targetIds.has(ticket.feiTicketId))).forEach(({ ticket }) => {
    const groupKey = ticketGroupKey(ticket)
    groups.set(groupKey, [...(groups.get(groupKey) || []), ticket])
  })
  return Array.from(groups, ([groupKey, tickets]) => {
    const remaining = tickets.filter((ticket) => !state.ticketTargetById[ticket.feiTicketId])
    return {
      groupKey,
      productionOrderNo: tickets[0]?.productionOrderNo || '',
      receiverFactoryId: tickets[0]?.receiverFactoryId || '',
      receiverFactoryName: tickets[0]?.receiverFactoryName || tickets[0]?.receiverFactoryId || '接收工厂待核对',
      totalTicketCount: tickets.length,
      totalPieceQty: tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
      remainingTicketCount: remaining.length,
      remainingPieceQty: remaining.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
    }
  })
}

export function selectPdaRepackGroup(
  state: PdaTransferBagRepackState,
  groupKey: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  const group = buildPdaRepackGroups(state, storage).find((item) => item.groupKey === groupKey)
  if (!group) throw new Error('这个分组不存在，请返回重新选择。')
  if (!group.receiverFactoryId) throw new Error('该分组尚未分配接收车缝工厂，不能重装。')
  if (!group.remainingTicketCount) throw new Error('该分组的菲票已全部装入结果袋。')
  return {
    ...state,
    step: 'RESULT_BAGS',
    activeGroupKey: groupKey,
    activeResultBagCode: '',
    pendingForceBagCode: '',
    feedback: `已选择 ${group.productionOrderNo} / ${group.receiverFactoryName}，请扫描结果袋。`,
  }
}

export function scanRepackSourceBag(
  state: PdaTransferBagRepackState,
  rawBagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  const bagCode = normalizeCode(rawBagCode)
  if (!bagCode) throw new Error('请扫描或填写来源中转袋编号。')
  if (state.sourceBagCodes.includes(bagCode)) {
    return { ...state, feedback: `${bagCode} 已加入来源袋。` }
  }
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  if (!['PACKED', 'INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage || '')) {
    throw new Error(`${bagCode} 不是菲票已装袋、入仓暂存中或待交出的袋，不能作为来源袋。`)
  }
  if (!current.tickets.length) throw new Error(`${bagCode} 没有当前菲票，不能作为来源袋。`)
  const sourceTicketSnapshotById = { ...state.sourceTicketSnapshotById }
  const sourceBagByTicketId = { ...state.sourceBagByTicketId }
  const sourceOriginalLocationByBagCode = { ...state.sourceOriginalLocationByBagCode }
  if (current.usageCycleId) {
    const location = resolveTransferBagAuthoritativeCurrentLocation({
      bagCode,
      usageCycleId: current.usageCycleId,
      events: listCuttingRuntimeEvents(storage),
    })
    if (location?.locationRef) sourceOriginalLocationByBagCode[bagCode] = { ...location.locationRef }
  }
  current.tickets.forEach((ticket) => {
    if (sourceTicketSnapshotById[ticket.feiTicketId]) {
      throw new Error(`${ticket.feiTicketNo || ticket.feiTicketId} 已在其他来源袋内，不能重复加入。`)
    }
    sourceTicketSnapshotById[ticket.feiTicketId] = { ...ticket }
    sourceBagByTicketId[ticket.feiTicketId] = bagCode
  })
  return {
    ...state,
    sourceBagCodes: [...state.sourceBagCodes, bagCode],
    sourceTicketSnapshotById,
    sourceBagByTicketId,
    sourceOriginalLocationByBagCode,
    feedback: `已加入来源袋 ${bagCode}，当前 ${state.sourceBagCodes.length + 1} 只。`,
  }
}

function resolveSourceTicket(
  state: PdaTransferBagRepackState,
  rawTicketCode: string,
  storage: BrowserStorageLike | null,
): { bagCode: string; ticket: TransferBagTicketFactSnapshot } {
  const ticketCode = normalizeCode(rawTicketCode)
  if (!ticketCode) throw new Error('请扫描或填写菲票编号。')
  const matches = sourceTickets(state, storage).filter(({ ticket }) =>
    [ticket.feiTicketId, ticket.feiTicketNo].some((value) => normalizeCode(value) === ticketCode))
  if (matches.length !== 1) throw new Error('这张菲票不在已扫描来源袋内，请重新扫描。')
  return matches[0]
}

export function scanRepackTicket(
  state: PdaTransferBagRepackState,
  rawTicketCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  const matched = resolveSourceTicket(state, rawTicketCode, storage)
  if (state.ticketTargetById[matched.ticket.feiTicketId]) {
    throw new Error(`${matched.ticket.feiTicketNo || matched.ticket.feiTicketId} 已分配结果袋。`)
  }
  return {
    ...state,
    step: 'RESULT_BAGS',
    pendingTicketId: matched.ticket.feiTicketId,
    pendingForceBagCode: '',
    feedback: `已读取 ${matched.ticket.feiTicketNo || matched.ticket.feiTicketId}，请扫描结果袋。`,
  }
}

function ensureRepackResultBag(
  state: PdaTransferBagRepackState,
  bagCode: string,
  storage: BrowserStorageLike | null,
  forceRecovery?: Omit<RecoverTransferBagInput, 'bagCode' | 'recoveryMode'>,
): void {
  if (state.sourceBagCodes.includes(bagCode)) return
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  if (current.mainStatus === 'IDLE') return
  if (current.mainStatus === 'DISABLED') throw new Error(`${bagCode} 已报废，不能作为结果袋。`)
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN' && current.tickets.length === 0) {
    if (!forceRecovery) throw new Error(`${bagCode} 尚未回收，请先确认收到实物空袋并强制回收。`)
    ensureTransferBagAvailableForUse({ bagCode, forceRecovery }, storage)
    return
  }
  throw new Error(`${bagCode} 是无关的使用中袋，不能作为结果袋。`)
}

export function activatePdaRepackResultBag(
  state: PdaTransferBagRepackState,
  rawTargetBagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  forceRecovery?: Omit<RecoverTransferBagInput, 'bagCode' | 'recoveryMode'>,
): PdaTransferBagRepackState {
  const group = buildPdaRepackGroups(state, storage).find((item) => item.groupKey === state.activeGroupKey)
  if (!group) throw new Error('请先选择生产单和接收工厂分组。')
  const targetBagCode = normalizeCode(rawTargetBagCode)
  if (!targetBagCode) throw new Error('请扫描或填写结果中转袋编号。')
  ensureRepackResultBag(state, targetBagCode, storage, forceRecovery)
  const assignedToTarget = sourceTickets(state, storage)
    .filter(({ ticket }) => state.ticketTargetById[ticket.feiTicketId] === targetBagCode)
    .map(({ ticket }) => ticket)
  if (assignedToTarget.some((ticket) => ticketGroupKey(ticket) !== state.activeGroupKey)) {
    throw new Error(`${targetBagCode} 已装入其他生产单或接收工厂的菲票，请更换结果袋。`)
  }
  return {
    ...state,
    step: 'TICKETS',
    activeResultBagCode: targetBagCode,
    scannedResultBagCodes: state.scannedResultBagCodes.includes(targetBagCode)
      ? state.scannedResultBagCodes
      : [...state.scannedResultBagCodes, targetBagCode],
    pendingForceBagCode: '',
    feedback: `${targetBagCode} 已作为当前结果袋，请连续扫描菲票。`,
  }
}

export function scanRepackTicketToActiveResult(
  state: PdaTransferBagRepackState,
  rawTicketCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  if (!state.activeGroupKey) throw new Error('请先选择生产单和接收工厂分组。')
  if (!state.activeResultBagCode) throw new Error('请先扫描结果中转袋。')
  const matched = resolveSourceTicket(state, rawTicketCode, storage)
  if (state.ticketTargetById[matched.ticket.feiTicketId]) {
    throw new Error(`${matched.ticket.feiTicketNo || matched.ticket.feiTicketId} 已装入结果袋，不能重复扫描。`)
  }
  if (ticketGroupKey(matched.ticket) !== state.activeGroupKey) {
    throw new Error('这张菲票不属于当前生产单和接收工厂分组，请核对后重扫。')
  }
  const ticketTargetById = {
    ...state.ticketTargetById,
    [matched.ticket.feiTicketId]: state.activeResultBagCode,
  }
  const bagTicketCount = Object.entries(ticketTargetById)
    .filter(([, bagCode]) => bagCode === state.activeResultBagCode).length
  return {
    ...state,
    step: 'TICKETS',
    ticketTargetById,
    pendingTicketId: '',
    feedback: `${matched.ticket.feiTicketNo || matched.ticket.feiTicketId} 已装入 ${state.activeResultBagCode}；当前 ${bagTicketCount} 张。`,
  }
}

export function completePdaRepackResultBag(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  if (!state.activeResultBagCode) throw new Error('当前没有正在装的结果袋。')
  const currentBagTicketCount = Object.values(state.ticketTargetById)
    .filter((bagCode) => bagCode === state.activeResultBagCode).length
  if (!currentBagTicketCount) throw new Error('当前结果袋还没有扫入菲票，不能完成。')
  const cleared = { ...state, activeGroupKey: '', activeResultBagCode: '' }
  if (!state.sewingTaskNo) return { ...cleared, step: 'GROUPS', feedback: '当前结果袋已完成；可继续选择分组或处理剩余来源袋。' }
  const nextGroup = buildPdaRepackGroups(cleared, storage).find((group) => group.remainingTicketCount > 0)
  if (!nextGroup) return beginPdaRepackSourceReturns(cleared, storage)
  return selectPdaRepackGroup(cleared, nextGroup.groupKey, storage)
}

export function assignRepackTicket(
  state: PdaTransferBagRepackState,
  rawTicketCode: string,
  rawTargetBagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  forceRecovery?: Omit<RecoverTransferBagInput, 'bagCode' | 'recoveryMode'>,
): PdaTransferBagRepackState {
  const matched = resolveSourceTicket(state, rawTicketCode, storage)
  const targetBagCode = normalizeCode(rawTargetBagCode)
  if (!targetBagCode) throw new Error('请扫描或填写结果中转袋编号。')
  ensureRepackResultBag(state, targetBagCode, storage, forceRecovery)
  const nextTargets = { ...state.ticketTargetById, [matched.ticket.feiTicketId]: targetBagCode }
  return {
    ...state,
    step: 'TICKETS',
    ticketTargetById: nextTargets,
    scannedResultBagCodes: state.scannedResultBagCodes.includes(targetBagCode)
      ? state.scannedResultBagCodes
      : [...state.scannedResultBagCodes, targetBagCode],
    pendingTicketId: '',
    pendingForceBagCode: '',
    feedback: `${matched.ticket.feiTicketNo || matched.ticket.feiTicketId} 已分配到 ${targetBagCode}。`,
  }
}

function buildLegacyPdaRepackConfirmation(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null,
): PdaRepackConfirmationSummary {
  const items = sourceTickets(state, storage)
  const errors: string[] = []
  const resultGroups = new Map<string, TransferBagTicketFactSnapshot[]>()
  items.forEach(({ ticket }) => {
    const target = state.ticketTargetById[ticket.feiTicketId]
    if (target) resultGroups.set(target, [...(resultGroups.get(target) || []), ticket])
  })
  const resultBags = Array.from(resultGroups, ([bagCode, tickets]) => ({
    bagCode,
    productionOrderNo: tickets[0]?.productionOrderNo || '',
    receiverFactoryName: tickets[0]?.receiverFactoryName || tickets[0]?.receiverFactoryId || '待分配',
    ticketCount: tickets.length,
    pieceQty: tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0),
    ticketIds: tickets.map((ticket) => ticket.feiTicketId),
  }))
  const sourceBags = state.sourceBagCodes.map((bagCode) => {
    const tickets = items.filter((item) => item.bagCode === bagCode).map((item) => item.ticket)
    const retained = tickets.filter((ticket) => !state.ticketTargetById[ticket.feiTicketId])
    const usedAsResult = resultGroups.has(bagCode)
    const returnLocationRef = state.sourceReturnLocationByBagCode[bagCode]
    if (usedAsResult && retained.length) errors.push(`${bagCode} 既作为结果袋又保留菲票，不能同时交出和入仓。`)
    if (!usedAsResult && retained.length && !returnLocationRef) errors.push(`${bagCode} 仍有菲票，请确认回仓库位。`)
    return {
      bagCode,
      transferredTicketCount: tickets.length - retained.length,
      transferredPieceQty: tickets.filter((ticket) => state.ticketTargetById[ticket.feiTicketId]).reduce((sum, ticket) => sum + ticket.pieceQty, 0),
      retainedTicketCount: retained.length,
      retainedPieceQty: retained.reduce((sum, ticket) => sum + ticket.pieceQty, 0),
      becomesIdle: !usedAsResult && !retained.length,
      usedAsResult,
      ...(returnLocationRef ? { returnLocationRef } : {}),
    }
  })
  const totalSourcePieceQty = items.reduce((sum, item) => sum + item.ticket.pieceQty, 0)
  const totalResultPieceQty = resultBags.reduce((sum, bag) => sum + bag.pieceQty, 0)
  const totalRetainedTicketCount = sourceBags.reduce((sum, bag) => sum + bag.retainedTicketCount, 0)
  const totalRetainedPieceQty = sourceBags.reduce((sum, bag) => sum + bag.retainedPieceQty, 0)
  if (items.length !== resultBags.reduce((sum, bag) => sum + bag.ticketCount, 0) + totalRetainedTicketCount) errors.push('结果袋与剩余来源袋合计和来源菲票张数不一致。')
  if (totalSourcePieceQty !== totalResultPieceQty + totalRetainedPieceQty) errors.push('结果袋与剩余来源袋合计和来源裁片数不一致。')
  return {
    sourceBags,
    resultBags,
    directBagCodes: [],
    totalSourceTicketCount: items.length,
    totalResultTicketCount: resultBags.reduce((sum, bag) => sum + bag.ticketCount, 0),
    totalSourcePieceQty,
    totalResultPieceQty,
    totalRetainedTicketCount,
    totalRetainedPieceQty,
    canSubmit: errors.length === 0 && resultBags.length > 0,
    errors,
  }
}

export function buildPdaRepackConfirmation(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaRepackConfirmationSummary {
  if (!state.sewingTaskNo) return buildLegacyPdaRepackConfirmation(state, storage)
  const sourceItems = sourceTickets(state, storage)
  const errors: string[] = []
  if (!state.sourceBagCodes.length) errors.push('至少需要一个来源袋。')
  let handoverContext: TransferBagHandoverTaskContext | null = null
  try { handoverContext = resolvePdaHandoverTaskContext(state, storage) } catch (error) {
    errors.push(error instanceof Error ? error.message : '车缝任务或接收 PPIC 未确认。')
  }
  const targetIds = new Set(handoverContext?.targetFeiTicketIds || state.targetFeiTicketIds)
  const selectedResultBagCodes = new Set(Object.values(state.ticketTargetById))
  const directBagCodes = handoverContext ? state.sourceBagCodes.filter((bagCode) =>
    !selectedResultBagCodes.has(bagCode)
    && classifyTransferBagForHandoverTask({ currentUse: resolvePdaSourceCurrentUse(state, bagCode, storage), handoverContext: handoverContext! }).disposition === 'DIRECT_HANDOVER') : []
  const repackBagCodes = state.sourceBagCodes.filter((bagCode) => !directBagCodes.includes(bagCode))
  const repackSourceItems = sourceItems.filter((item) => repackBagCodes.includes(item.bagCode))
  const unknownTicketIds = Object.keys(state.ticketTargetById)
    .filter((ticketId) => !sourceItems.some(({ ticket }) => ticket.feiTicketId === ticketId))
  if (unknownTicketIds.length) errors.push(`存在 ${unknownTicketIds.length} 张非来源菲票。`)

  const resultGroups = new Map<string, TransferBagTicketFactSnapshot[]>()
  for (const { bagCode: sourceBagCode, ticket } of repackSourceItems) {
    const bagCode = state.ticketTargetById[ticket.feiTicketId]
      || (selectedResultBagCodes.has(sourceBagCode) && targetIds.has(ticket.feiTicketId) ? sourceBagCode : '')
    if (!bagCode) continue
    if (!targetIds.has(ticket.feiTicketId)) {
      errors.push(`${ticket.feiTicketNo} 不是当前车缝任务菲票，不能装入交出结果袋。`)
      continue
    }
    resultGroups.set(bagCode, [...(resultGroups.get(bagCode) || []), ticket])
  }
  const resultBags = Array.from(resultGroups, ([bagCode, tickets]) => {
    const productionOrders = new Set(tickets.map((ticket) => ticket.productionOrderNo).filter(Boolean))
    const receiverFactories = new Set(tickets.map((ticket) => ticket.receiverFactoryId).filter(Boolean))
    if (productionOrders.size !== 1) errors.push(`${bagCode} 混装了不同生产单。`)
    if (receiverFactories.size !== 1) errors.push(`${bagCode} 的菲票要交给不同工厂。`)
    return {
      bagCode,
      productionOrderNo: tickets[0]?.productionOrderNo || '',
      receiverFactoryName: tickets[0]?.receiverFactoryName || tickets[0]?.receiverFactoryId || '待分配',
      ticketCount: tickets.length,
      pieceQty: tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
      ticketIds: tickets.map((ticket) => ticket.feiTicketId),
    }
  })
  const sourceBags = repackBagCodes.map((bagCode) => {
    const tickets = repackSourceItems.filter((item) => item.bagCode === bagCode).map((item) => item.ticket)
    const retained = tickets.filter((ticket) => !targetIds.has(ticket.feiTicketId))
    const usedAsResult = resultGroups.has(bagCode)
    const returnLocationRef = state.sourceReturnLocationByBagCode[bagCode]
    if (usedAsResult && retained.length) errors.push(`${bagCode} 既作为结果袋又保留菲票，不能同时交出和入仓。`)
    if (!usedAsResult && retained.length && !returnLocationRef) errors.push(`${bagCode} 仍有菲票，请确认回仓库位。`)
    return {
      bagCode,
      transferredTicketCount: tickets.filter((ticket) => targetIds.has(ticket.feiTicketId)).length,
      transferredPieceQty: tickets
        .filter((ticket) => targetIds.has(ticket.feiTicketId))
        .reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
      retainedTicketCount: retained.length,
      retainedPieceQty: retained.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
      becomesIdle: !usedAsResult && retained.length === 0,
      usedAsResult,
      ...(returnLocationRef ? { returnLocationRef } : {}),
    }
  })
  const directItems = sourceItems.filter((item) => directBagCodes.includes(item.bagCode))
  const totalSourcePieceQty = sourceItems.reduce((sum, item) => sum + Number(item.ticket.pieceQty || 0), 0)
  const totalResultPieceQty = resultBags.reduce((sum, bag) => sum + bag.pieceQty, 0)
  const totalRetainedTicketCount = sourceBags.reduce((sum, bag) => sum + bag.retainedTicketCount, 0)
  const totalRetainedPieceQty = sourceBags.reduce((sum, bag) => sum + bag.retainedPieceQty, 0)
  const unassignedTargetTickets = repackSourceItems.filter((item) => targetIds.has(item.ticket.feiTicketId)
    && !state.ticketTargetById[item.ticket.feiTicketId]
    && !selectedResultBagCodes.has(item.bagCode))
  if (unassignedTargetTickets.length) errors.push(`还有 ${unassignedTargetTickets.length} 张当前任务菲票未装入结果袋。`)
  if (sourceItems.length !== directItems.length + resultBags.reduce((sum, bag) => sum + bag.ticketCount, 0) + totalRetainedTicketCount) {
    errors.push('直接交出、结果袋和剩余来源袋合计与来源菲票张数不一致。')
  }
  const directPieceQty = directItems.reduce((sum, item) => sum + Number(item.ticket.pieceQty || 0), 0)
  if (totalSourcePieceQty !== directPieceQty + totalResultPieceQty + totalRetainedPieceQty) errors.push('直接交出、结果袋和剩余来源袋合计与来源裁片数不一致。')
  return {
    sourceBags,
    resultBags,
    directBagCodes,
    totalSourceTicketCount: sourceItems.length,
    totalResultTicketCount: resultBags.reduce((sum, bag) => sum + bag.ticketCount, 0),
    totalSourcePieceQty,
    totalResultPieceQty,
    totalRetainedTicketCount,
    totalRetainedPieceQty,
    canSubmit: errors.length === 0 && (directBagCodes.length > 0 || resultBags.length > 0),
    errors,
  }
}

export function submitPdaTransferBagRepack(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
) {
  const summary = buildPdaRepackConfirmation(state, storage)
  if (!summary.canSubmit) throw new Error(summary.errors[0] || '重装汇总未通过，请检查。')
  if (!state.sewingTaskNo) {
    return submitWaitHandoverRepackWithSourceReturnsAndResultHandovers({
      repackBatchId: state.repackBatchId,
      sourceBagCodes: state.sourceBagCodes,
      results: summary.resultBags.map((bag) => ({ bagCode: bag.bagCode, feiTicketIds: bag.ticketIds })),
      retainedSources: summary.sourceBags.filter((bag) => bag.retainedTicketCount && bag.returnLocationRef).map((bag) => ({
        bagCode: bag.bagCode,
        feiTicketIds: sourceTickets(state, storage).filter((item) => item.bagCode === bag.bagCode && !state.ticketTargetById[item.ticket.feiTicketId]).map((item) => item.ticket.feiTicketId),
        returnLocationRef: bag.returnLocationRef!,
      })),
      operator: { operatorName: 'PDA 仓务操作员', operatorRole: '裁片仓重装员' },
      source: 'PDA',
      occurredAt: state.occurredAt,
    }, storage)
  }
  const handoverContext = resolvePdaHandoverTaskContext(state, storage)
  const directBags = summary.directBagCodes.map((bagCode) => {
    const current = resolvePdaSourceCurrentUse(state, bagCode, storage)
    return {
      bagCode,
      usageCycleId: current.usageCycleId || '',
      assignments: current.tickets.map((ticket) => ({
        feiTicketId: ticket.feiTicketId,
        feiTicketNo: ticket.feiTicketNo,
        sewingTaskId: handoverContext.sewingTaskId,
        sewingTaskNo: handoverContext.sewingTaskNo,
        receiverFactoryId: handoverContext.receiverFactoryId,
        receiverFactoryName: handoverContext.receiverFactoryName,
      })),
      submittedTicketSnapshot: current.tickets,
    }
  })
  const repackSourceBagCodes = summary.sourceBags.map((bag) => bag.bagCode)
  return submitWaitHandoverTaskBatch({
    handoverContext,
    directBags,
    ...(repackSourceBagCodes.length ? { repack: {
      repackBatchId: state.repackBatchId,
      handoverContext,
      sourceBagCodes: repackSourceBagCodes,
      results: summary.resultBags.map((bag) => ({ bagCode: bag.bagCode, feiTicketIds: bag.ticketIds })),
      retainedSources: summary.sourceBags
        .filter((bag) => bag.retainedTicketCount > 0 && bag.returnLocationRef)
        .map((bag) => ({
          bagCode: bag.bagCode,
          feiTicketIds: sourceTickets(state, storage)
            .filter((item) => item.bagCode === bag.bagCode && !handoverContext.targetFeiTicketIds.includes(item.ticket.feiTicketId))
            .map((item) => item.ticket.feiTicketId),
          returnLocationRef: bag.returnLocationRef!,
        })),
      operator: { operatorName: 'PDA 仓务操作员', operatorRole: '裁片仓重装员' },
      source: 'PDA' as const,
      occurredAt: state.occurredAt,
    } } : {}),
    operator: { operatorName: 'PDA 仓务操作员', operatorRole: '裁片仓重装员' },
    source: 'PDA',
    occurredAt: state.occurredAt,
  }, storage)
}

function renderFeedback(state: PdaTransferBagRepackState): string {
  return state.feedback
    ? `<div class="rounded-xl border bg-slate-50 p-3 text-sm">${escapeHtml(state.feedback)}</div>`
    : ''
}

function renderSourceStep(state: PdaTransferBagRepackState): string {
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">1 扫描车缝任务和接收 PPIC</div>
      <div class="text-xs text-muted-foreground">优先扫描任务条码 / 二维码；扫码不可用时可以手工填写。一次只处理一个生产单的一个车缝任务。</div>
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="sewingTaskNo" value="${escapeHtml(state.sewingTaskNo)}" placeholder="扫描或填写车缝任务编号" autofocus />
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="receiverPpicId" value="${escapeHtml(state.receiverPpicId)}" placeholder="扫描或填写接收 PPIC 编号" />
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="resolve-task" type="button">查找任务菲票和中转袋</button>
    </div>
  `
}

function renderGroupStep(state: PdaTransferBagRepackState): string {
  const context = resolvePdaHandoverTaskContext(state)
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">2 核对相关中转袋</div>
      <div class="rounded-xl border bg-slate-50 p-3 text-sm"><b>${escapeHtml(context.productionOrderNo)} / ${escapeHtml(context.sewingTaskNo)}</b><br>${escapeHtml(context.receiverFactoryName)} · 接收 PPIC ${escapeHtml(context.receiverPpicName)}</div>
      ${state.sourceBagCodes.map((bagCode) => {
        const classification = classifyTransferBagForHandoverTask({ currentUse: resolveTransferBagCurrentUse(bagCode), handoverContext: context })
        return `<div class="rounded-xl border ${classification.disposition === 'DIRECT_HANDOVER' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'} p-3 text-sm"><b>${escapeHtml(bagCode)}</b><br>本任务 ${classification.targetTickets.length} 张 / ${classification.targetTickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)} 片${classification.otherTickets.length ? `；其他菲票 ${classification.otherTickets.length} 张 / ${classification.otherTickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)} 片` : ''}<div class="mt-1 font-medium">${classification.disposition === 'DIRECT_HANDOVER' ? '整袋直接交出' : '正常拆袋重装（不是异常）'}</div></div>`
      }).join('')}
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="bags-reviewed" type="button">核对完成，继续处理</button>
    </div>
  `
}

function renderTicketStep(state: PdaTransferBagRepackState): string {
  const group = buildPdaRepackGroups(state).find((item) => item.groupKey === state.activeGroupKey)
  const currentBagTickets = Object.values(state.ticketTargetById).filter((bagCode) => bagCode === state.activeResultBagCode).length
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">3 扫结果袋并连续扫描菲票</div>
      <div class="rounded-xl border border-blue-200 bg-blue-50 p-3"><div class="text-xs text-blue-700">当前结果袋</div><div class="mt-1 text-lg font-semibold text-blue-950">${escapeHtml(state.activeResultBagCode)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(group?.productionOrderNo || '')} · ${escapeHtml(group?.receiverFactoryName || '')} · 已装 ${currentBagTickets} 张</div></div>
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="ticket" placeholder="连续扫描菲票；也可手工填写" autofocus />
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="scan-ticket-to-active" type="button">装入当前结果袋</button>
      <button class="h-12 w-full rounded-xl border border-blue-300 font-semibold text-blue-700" data-pda-repack-action="complete-result" type="button">完成这只结果袋</button>
    </div>
  `
}

function renderResultStep(state: PdaTransferBagRepackState): string {
  const forcePrompt = state.pendingForceBagCode
    ? `
      <div class="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
        <div class="font-semibold">${escapeHtml(state.pendingForceBagCode)} 线上尚未回收</div>
        <label class="flex gap-2"><input type="checkbox" data-pda-repack-field="physicalBagReceived" />已收到实物袋</label>
        <label class="flex gap-2"><input type="checkbox" data-pda-repack-field="physicalBagEmpty" />已确认袋内无菲票</label>
        <textarea class="min-h-20 w-full rounded-xl border bg-white p-2" data-pda-repack-field="forceReason" placeholder="强制回收原因"></textarea>
        <button class="h-12 w-full rounded-xl bg-amber-600 font-semibold text-white" data-pda-repack-action="force-recover-and-activate" type="button">强制回收并使用</button>
      </div>
    `
    : `
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="resultBag" placeholder="扫描或填写结果袋编号" />
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="activate-result" type="button">使用这只结果袋</button>
    `
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">3 扫结果袋并连续扫描菲票</div>
      <div class="rounded-xl border bg-slate-50 p-3 text-sm">已选择分组：${escapeHtml(buildPdaRepackGroups(state).find((item) => item.groupKey === state.activeGroupKey)?.receiverFactoryName || '待选择')}</div>
      ${forcePrompt}
    </div>
  `
}

export function beginPdaRepackSourceReturns(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaTransferBagRepackState {
  if (!state.sewingTaskNo) {
    if (!Object.keys(state.ticketTargetById).length) throw new Error('请至少完成一只结果袋。')
  } else {
    const context = resolvePdaHandoverTaskContext(state, storage)
    const repackTargetIds = state.sourceBagCodes.flatMap((bagCode) => {
      const current = resolvePdaSourceCurrentUse(state, bagCode, storage)
      const classification = classifyTransferBagForHandoverTask({ currentUse: current, handoverContext: context })
      return classification.disposition === 'REPACK_REQUIRED' ? classification.targetTickets.map((ticket) => ticket.feiTicketId) : []
    })
    const missing = repackTargetIds.filter((ticketId) => !state.ticketTargetById[ticketId])
    if (missing.length) throw new Error(`还有 ${missing.length} 张当前任务菲票未装入结果袋。`)
  }
  const sourceReturnLocationByBagCode = { ...state.sourceReturnLocationByBagCode }
  const items = sourceTickets(state, storage)
  state.sourceBagCodes.forEach((bagCode) => {
    const retainedCount = items.filter((item) => item.bagCode === bagCode && !state.ticketTargetById[item.ticket.feiTicketId]).length
    const usedAsResult = Object.values(state.ticketTargetById).includes(bagCode)
    if (retainedCount && !usedAsResult && !sourceReturnLocationByBagCode[bagCode]) {
      const original = state.sourceOriginalLocationByBagCode[bagCode]
      if (original) sourceReturnLocationByBagCode[bagCode] = { ...original }
    }
  })
  return {
    ...state,
    step: 'SOURCE_RETURNS',
    sourceReturnLocationByBagCode,
    feedback: '请确认剩余来源袋回仓库位；默认原库位，也可以重新扫描或手工填写。',
  }
}

export function setPdaRepackReturnLocation(
  state: PdaTransferBagRepackState,
  bagCode: string,
  rawValue: string,
): PdaTransferBagRepackState {
  const ref = resolvePdaRepackReturnLocation(rawValue)
  return {
    ...state,
    sourceReturnLocationByBagCode: { ...state.sourceReturnLocationByBagCode, [bagCode]: ref },
    feedback: `${bagCode} 将回到 ${ref.areaName} / ${ref.locationNo}。`,
  }
}

function renderSourceReturns(state: PdaTransferBagRepackState): string {
  const summary = buildPdaRepackConfirmation(state)
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">4 处理剩余来源袋</div>
      <div class="text-xs text-muted-foreground">结果袋不入仓，确认重装后直接交出；没有作为结果袋且仍有菲票的来源袋必须回仓。</div>
      ${summary.sourceBags.map((bag) => {
        if (bag.usedAsResult) return `<div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b><br>作为结果袋，确认重装后直接交出。</div>`
        if (bag.becomesIdle) return `<div class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b><br>菲票已全部转出，重装后空闲并释放原库位。</div>`
        const original = state.sourceOriginalLocationByBagCode[bag.bagCode]
        const current = state.sourceReturnLocationByBagCode[bag.bagCode]
        return `<div class="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" data-pda-repack-return-row data-source-bag-code="${escapeHtml(bag.bagCode)}"><div><b>${escapeHtml(bag.bagCode)}</b> · 剩余 ${bag.retainedTicketCount} 张 / ${bag.retainedPieceQty} 片</div><div class="text-xs text-amber-800">原库位：${escapeHtml(original ? `${original.areaName} / ${original.locationNo}` : '未找到，请扫描实际库位')}</div><input class="h-12 w-full rounded-xl border bg-white px-3" value="${escapeHtml(current?.locationNo || '')}" data-pda-repack-field="returnLocation" data-source-bag-code="${escapeHtml(bag.bagCode)}" placeholder="扫描库位码或手工填写库位编号" /><button class="h-12 w-full rounded-xl border border-amber-400 bg-white font-semibold text-amber-800" data-pda-repack-action="set-return-location" data-source-bag-code="${escapeHtml(bag.bagCode)}" type="button">确认这个回仓库位</button></div>`
      }).join('')}
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="returns-done" type="button">库位已确认，核对汇总</button>
    </div>
  `
}

function renderConfirmation(state: PdaTransferBagRepackState): string {
  const summary = buildPdaRepackConfirmation(state)
  return `
    <div class="space-y-4">
      <div class="text-sm font-semibold">5 核对系统汇总</div>
      <div class="grid grid-cols-2 gap-2 text-center text-xs">
        <div class="rounded-xl border p-3">来源<br><b>${summary.totalSourceTicketCount} 张 / ${summary.totalSourcePieceQty} 片</b></div>
        <div class="rounded-xl border border-blue-200 bg-blue-50 p-3">直接交出<br><b>${summary.directBagCodes.length} 袋</b></div>
        <div class="rounded-xl border border-violet-200 bg-violet-50 p-3">重装结果袋<br><b>${summary.totalResultTicketCount} 张 / ${summary.totalResultPieceQty} 片</b></div>
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3">来源袋保留<br><b>${summary.totalRetainedTicketCount} 张 / ${summary.totalRetainedPieceQty} 片</b></div>
      </div>
      <div class="space-y-2">${summary.sourceBags.map((bag) => `
        <div class="rounded-xl border p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b><br>转出 ${bag.transferredTicketCount} 张 / ${bag.transferredPieceQty} 片；保留 ${bag.retainedTicketCount} 张 / ${bag.retainedPieceQty} 片；${bag.usedAsResult ? '作为结果袋直接交出' : bag.becomesIdle ? '重装后空闲' : `重新入仓 ${escapeHtml(`${bag.returnLocationRef?.areaName || ''} / ${bag.returnLocationRef?.locationNo || ''}`)}`}</div>
      `).join('')}</div>
      <div class="space-y-2">${summary.resultBags.map((bag) => `
        <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b><br>${escapeHtml(bag.productionOrderNo)} · ${escapeHtml(bag.receiverFactoryName)}<br>${bag.ticketCount} 张 / ${bag.pieceQty} 片</div>
      `).join('')}</div>
      ${summary.errors.map((error) => `<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(error)}</div>`).join('')}
      ${summary.canSubmit ? '<button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="confirm" type="button">确认本次交出</button>' : ''}
    </div>
  `
}

function renderDone(state: PdaTransferBagRepackState): string {
  const summary = buildPdaRepackConfirmation(state)
  return `
    <div class="space-y-4">
      <div class="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
        <div class="font-semibold">本次中转袋交出成功</div>
        <div class="mt-1 text-sm">事实编号：${escapeHtml(state.submittedEventId)}</div>
      </div>
      ${summary.directBagCodes.map((bagCode) => `<div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><b>${escapeHtml(bagCode)}</b> · 整袋直接交出 · 已交出待回收</div>`).join('')}
      ${summary.resultBags.map((bag) => `<div class="rounded-xl border p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b> · ${bag.ticketCount} 张 / ${bag.pieceQty} 片 · 已交出待回收</div>`).join('')}
      ${summary.sourceBags.filter((bag) => bag.retainedTicketCount && bag.returnLocationRef).map((bag) => `<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b> · ${bag.retainedTicketCount} 张 / ${bag.retainedPieceQty} 片 · 已入仓 ${escapeHtml(`${bag.returnLocationRef!.areaName} / ${bag.returnLocationRef!.locationNo}`)}</div>`).join('')}
      <button class="w-full py-2 text-sm font-medium text-blue-700" data-pda-repack-action="reset" type="button">开始下一次交出</button>
    </div>
  `
}

function renderRepackWorkflow(state: PdaTransferBagRepackState): string {
  const content = state.step === 'SOURCE_BAGS'
    ? renderSourceStep(state)
    : state.step === 'GROUPS'
      ? renderGroupStep(state)
      : state.step === 'RESULT_BAGS'
        ? renderResultStep(state)
        : state.step === 'TICKETS'
          ? renderTicketStep(state)
          : state.step === 'SOURCE_RETURNS'
            ? renderSourceReturns(state)
            : state.step === 'CONFIRM'
              ? renderConfirmation(state)
              : renderDone(state)
  const visibleStep = visibleRepackStep(state.step)
  return `<section class="space-y-4 rounded-2xl border bg-card p-4" data-pda-transfer-bag-repack><div class="flex items-center justify-between gap-3"><h1 class="text-lg font-semibold">中转袋交出</h1>${state.step !== 'SOURCE_BAGS' && state.step !== 'DONE' ? '<button class="text-xs text-blue-700" data-pda-repack-action="reset" type="button">重新开始</button>' : ''}</div><div class="rounded-xl border border-blue-200 bg-blue-50 p-3"><div class="flex items-center justify-between text-sm"><b>操作进度</b><span class="font-semibold text-blue-700">第 ${visibleStep} 步，共 5 步</span></div><div class="mt-2 grid grid-cols-5 gap-1 text-center text-[10px]">${['1 扫车缝任务', '2 核对相关袋', '3 直接交出或重装', '4 剩余来源袋', '5 汇总确认'].map((label, index) => `<div class="rounded-lg border px-1 py-2 ${index + 1 === visibleStep ? 'border-blue-500 bg-white font-semibold text-blue-700' : 'border-blue-100 text-slate-500'}">${label}</div>`).join('')}</div></div>${renderFeedback(state)}${content}</section>`
}

export function renderPdaCuttingTransferBagRepackPage(): string {
  ensureTransferBagRepackMockEvents()
  return renderPdaFrame(`
    <main class="space-y-4 px-4 py-4">
      <a class="text-sm text-blue-700" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      ${renderRepackWorkflow(getRepackState())}
    </main>
  `, 'warehouse', {
    headerTitle: '中转袋交出',
    disableTodoAutoOpen: true,
  })
}

function fieldValue(container: HTMLElement, name: string): string {
  return container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-pda-repack-field="${name}"]`)?.value || ''
}

function returnLocationFieldValue(container: HTMLElement, bagCode: string): string {
  return Array.from(container.querySelectorAll<HTMLInputElement>('[data-pda-repack-field="returnLocation"]'))
    .find((input) => input.dataset.sourceBagCode === bagCode)?.value || ''
}

function updateRepackWorkflow(container: HTMLElement | null, state: PdaTransferBagRepackState): PdaPageEventResult {
  replaceRepackState(state)
  if (!container) return true
  container.outerHTML = renderRepackWorkflow(state)
  return PDA_PAGE_HANDLED_LOCALLY
}

export function handlePdaCuttingTransferBagRepackEvent(
  target: HTMLElement,
  event?: Event,
): PdaPageEventResult {
  const container = target.closest<HTMLElement>('[data-pda-transfer-bag-repack]')
  if (!container) return false
  const actionNode = target.closest<HTMLElement>('[data-pda-repack-action]')
  const fieldNode = target.closest<HTMLInputElement>('[data-pda-repack-field]')
  let action = actionNode?.dataset.pdaRepackAction || ''
  if (!action && fieldNode && event?.type === 'keydown' && 'key' in event && event.key === 'Enter') {
    action = fieldNode.dataset.pdaRepackField === 'sewingTaskNo' || fieldNode.dataset.pdaRepackField === 'receiverPpicId'
      ? 'resolve-task'
      : fieldNode.dataset.pdaRepackField === 'sourceBag'
      ? 'add-source'
      : fieldNode.dataset.pdaRepackField === 'ticket'
        ? 'scan-ticket-to-active'
      : fieldNode.dataset.pdaRepackField === 'resultBag'
          ? 'activate-result'
          : fieldNode.dataset.pdaRepackField === 'returnLocation'
            ? 'set-return-location'
          : ''
  }
  if (!action) return false
  const state = getRepackState()
  try {
    if (action === 'reset') {
      return updateRepackWorkflow(container, createPdaTransferBagRepackState())
    }
    if (action === 'resolve-task') {
      const next = {
        ...state,
        sewingTaskNo: fieldValue(container, 'sewingTaskNo'),
        receiverPpicId: fieldValue(container, 'receiverPpicId'),
      }
      return updateRepackWorkflow(container, preparePdaHandoverTask(next))
    }
    if (action === 'add-source') {
      return updateRepackWorkflow(container, scanRepackSourceBag(state, fieldValue(container, 'sourceBag')))
    }
    if (action === 'sources-done') {
      if (!state.sourceBagCodes.length) throw new Error('请先扫描来源袋。')
      return updateRepackWorkflow(container, { ...state, step: 'GROUPS', feedback: '来源袋已读取，请选择生产单和接收工厂分组。' })
    }
    if (action === 'bags-reviewed') {
      const group = buildPdaRepackGroups(state).find((item) => item.remainingTicketCount > 0
        && state.sourceBagCodes.some((bagCode) => {
          const context = resolvePdaHandoverTaskContext(state)
          return classifyTransferBagForHandoverTask({ currentUse: resolveTransferBagCurrentUse(bagCode), handoverContext: context }).disposition === 'REPACK_REQUIRED'
        }))
      return group
        ? updateRepackWorkflow(container, selectPdaRepackGroup(state, group.groupKey))
        : updateRepackWorkflow(container, beginPdaRepackSourceReturns(state))
    }
    if (action === 'select-group') {
      return updateRepackWorkflow(container, selectPdaRepackGroup(state, actionNode?.dataset.groupKey || ''))
    }
    if (action === 'activate-result') {
      const resultBagCode = normalizeCode(fieldValue(container, 'resultBag'))
      try {
        return updateRepackWorkflow(container, activatePdaRepackResultBag(state, resultBagCode))
      } catch (error) {
        const current = resolveTransferBagCurrentUse(resultBagCode)
        if (current.flowStage === 'HANDED_OVER_WAITING_RETURN' && current.tickets.length === 0) {
          return updateRepackWorkflow(container, {
            ...state,
            pendingForceBagCode: resultBagCode,
            feedback: error instanceof Error ? error.message : '请先强制回收这个结果袋。',
          })
        }
        throw error
      }
    }
    if (action === 'force-recover-and-activate') {
      const received = container.querySelector<HTMLInputElement>('[data-pda-repack-field="physicalBagReceived"]')?.checked
      const empty = container.querySelector<HTMLInputElement>('[data-pda-repack-field="physicalBagEmpty"]')?.checked
      const reason = fieldValue(container, 'forceReason').trim()
      if (!received || !empty) throw new Error('请确认已收到实物袋且袋内无菲票。')
      if (!reason) throw new Error('请填写强制回收原因。')
      const confirmation: Omit<RecoverTransferBagInput, 'bagCode' | 'recoveryMode'> = {
        physicalBagReceived: true,
        physicalBagEmpty: true,
        recoveryNode: '裁床待交出仓',
        recoveryLocation: '裁床空袋回收点',
        reason,
        operator: { operatorName: 'PDA 仓务操作员', operatorRole: '裁片仓回收员' },
        source: 'PDA',
      }
      const activated = activatePdaRepackResultBag(
        state,
        state.pendingForceBagCode,
        getBrowserLocalStorage(),
        confirmation,
      )
      return updateRepackWorkflow(container, {
        ...activated,
        forceRecoveryByBagCode: {
          ...activated.forceRecoveryByBagCode,
          [state.pendingForceBagCode]: {
            physicalBagReceived: true,
            physicalBagEmpty: true,
            recoveryNode: confirmation.recoveryNode,
            recoveryLocation: confirmation.recoveryLocation,
            reason,
          },
        },
      })
    }
    if (action === 'scan-ticket-to-active') {
      return updateRepackWorkflow(container, scanRepackTicketToActiveResult(state, fieldValue(container, 'ticket')))
    }
    if (action === 'complete-result') {
      return updateRepackWorkflow(container, completePdaRepackResultBag(state))
    }
    if (action === 'finish-results') {
      return updateRepackWorkflow(container, beginPdaRepackSourceReturns(state))
    }
    if (action === 'set-return-location') {
      const bagCode = actionNode?.dataset.sourceBagCode || fieldNode?.dataset.sourceBagCode || ''
      return updateRepackWorkflow(container, setPdaRepackReturnLocation(
        state,
        bagCode,
        returnLocationFieldValue(container, bagCode),
      ))
    }
    if (action === 'returns-done') {
      const summary = buildPdaRepackConfirmation(state)
      if (!summary.canSubmit) throw new Error(summary.errors[0] || '请先确认剩余来源袋回仓库位。')
      return updateRepackWorkflow(container, { ...state, step: 'CONFIRM', feedback: '相关中转袋和回仓库位已核对，请确认本次交出。' })
    }
    if (action === 'confirm') {
      const submitted = submitPdaTransferBagRepack(state)
      return updateRepackWorkflow(container, {
        ...state,
        step: 'DONE',
        submittedEventId: submitted.repackEvent?.eventId || submitted.handoverEvents[0]?.eventId || '',
        feedback: '',
      })
    }
  } catch (error) {
    return updateRepackWorkflow(container, {
      ...state,
      feedback: error instanceof Error ? error.message : '拆袋重装失败，请重试。',
    })
  }
  return false
}
