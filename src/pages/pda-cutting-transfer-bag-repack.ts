// @page-pattern: pda
import { escapeHtml } from '../utils'
import { getBrowserLocalStorage, type BrowserStorageLike } from '../data/browser-storage.ts'
import {
  ensureTransferBagAvailableForUse,
  resolveTransferBagCurrentUse,
  submitTransferBagRepack,
  type RecoverTransferBagInput,
} from '../data/fcs/cutting/transfer-bag-operations.ts'
import type { TransferBagTicketFactSnapshot } from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { renderPdaFrame } from './pda-shell'
import { PDA_PAGE_HANDLED_LOCALLY, type PdaPageEventResult } from '../main-handlers/pda-local-action-result.ts'

export type PdaTransferBagRepackStep = 'SOURCE_BAGS' | 'TICKETS' | 'RESULT_BAGS' | 'CONFIRM' | 'DONE'

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
  sourceBagCodes: string[]
  sourceTicketSnapshotById: Record<string, TransferBagTicketFactSnapshot>
  sourceBagByTicketId: Record<string, string>
  ticketTargetById: Record<string, string>
  scannedResultBagCodes: string[]
  forceRecoveryByBagCode: Record<string, ForceRecoveryConfirmation>
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
}

export interface PdaRepackResultSummary {
  bagCode: string
  productionOrderNo: string
  receiverFactoryName: string
  ticketCount: number
  pieceQty: number
  ticketIds: string[]
}

export interface PdaRepackConfirmationSummary {
  sourceBags: PdaRepackSourceSummary[]
  resultBags: PdaRepackResultSummary[]
  totalSourceTicketCount: number
  totalResultTicketCount: number
  totalSourcePieceQty: number
  totalResultPieceQty: number
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
    sourceBagCodes: [],
    sourceTicketSnapshotById: {},
    sourceBagByTicketId: {},
    ticketTargetById: {},
    scannedResultBagCodes: [],
    forceRecoveryByBagCode: {},
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

function sourceTickets(
  state: PdaTransferBagRepackState,
  _storage: BrowserStorageLike | null,
): Array<{ bagCode: string; ticket: TransferBagTicketFactSnapshot }> {
  return Object.values(state.sourceTicketSnapshotById).map((ticket) => ({
    bagCode: state.sourceBagByTicketId[ticket.feiTicketId] || '',
    ticket,
  }))
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
  const allAssigned = sourceTickets(state, storage).every(({ ticket }) => Boolean(nextTargets[ticket.feiTicketId]))
  return {
    ...state,
    step: allAssigned ? 'CONFIRM' : 'TICKETS',
    ticketTargetById: nextTargets,
    scannedResultBagCodes: state.scannedResultBagCodes.includes(targetBagCode)
      ? state.scannedResultBagCodes
      : [...state.scannedResultBagCodes, targetBagCode],
    pendingTicketId: '',
    pendingForceBagCode: '',
    feedback: allAssigned
      ? '全部来源菲票已分配，请核对重装汇总。'
      : `${matched.ticket.feiTicketNo || matched.ticket.feiTicketId} 已分配到 ${targetBagCode}。`,
  }
}

export function buildPdaRepackConfirmation(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaRepackConfirmationSummary {
  const sourceItems = sourceTickets(state, storage)
  const errors: string[] = []
  if (!state.sourceBagCodes.length) errors.push('至少需要一个来源袋。')
  const unassigned = sourceItems.filter(({ ticket }) => !state.ticketTargetById[ticket.feiTicketId])
  if (unassigned.length) errors.push(`还有 ${unassigned.length} 张来源菲票未分配结果袋。`)
  const unknownTicketIds = Object.keys(state.ticketTargetById)
    .filter((ticketId) => !sourceItems.some(({ ticket }) => ticket.feiTicketId === ticketId))
  if (unknownTicketIds.length) errors.push(`存在 ${unknownTicketIds.length} 张非来源菲票。`)

  const resultGroups = new Map<string, TransferBagTicketFactSnapshot[]>()
  for (const { ticket } of sourceItems) {
    const bagCode = state.ticketTargetById[ticket.feiTicketId]
    if (!bagCode) continue
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
  const sourceBags = state.sourceBagCodes.map((bagCode) => {
    const tickets = sourceItems.filter((item) => item.bagCode === bagCode).map((item) => item.ticket)
    const retained = tickets.filter((ticket) => state.ticketTargetById[ticket.feiTicketId] === bagCode)
    return {
      bagCode,
      transferredTicketCount: tickets.length - retained.length,
      transferredPieceQty: tickets
        .filter((ticket) => state.ticketTargetById[ticket.feiTicketId] !== bagCode)
        .reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
      retainedTicketCount: retained.length,
      retainedPieceQty: retained.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0),
      becomesIdle: retained.length === 0,
    }
  })
  const totalSourcePieceQty = sourceItems.reduce((sum, item) => sum + Number(item.ticket.pieceQty || 0), 0)
  const totalResultPieceQty = resultBags.reduce((sum, bag) => sum + bag.pieceQty, 0)
  if (sourceItems.length !== resultBags.reduce((sum, bag) => sum + bag.ticketCount, 0)) {
    errors.push('来源与结果菲票张数不守恒。')
  }
  if (totalSourcePieceQty !== totalResultPieceQty) errors.push('来源与结果片数不守恒。')
  return {
    sourceBags,
    resultBags,
    totalSourceTicketCount: sourceItems.length,
    totalResultTicketCount: resultBags.reduce((sum, bag) => sum + bag.ticketCount, 0),
    totalSourcePieceQty,
    totalResultPieceQty,
    canSubmit: errors.length === 0 && resultBags.length > 0,
    errors,
  }
}

export function submitPdaTransferBagRepack(
  state: PdaTransferBagRepackState,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
) {
  const summary = buildPdaRepackConfirmation(state, storage)
  if (!summary.canSubmit) throw new Error(summary.errors[0] || '重装汇总未通过，请检查。')
  return submitTransferBagRepack({
    repackBatchId: state.repackBatchId,
    sourceBagCodes: state.sourceBagCodes,
    results: summary.resultBags.map((bag) => ({ bagCode: bag.bagCode, feiTicketIds: bag.ticketIds })),
    operator: { operatorName: 'PDA 仓务操作员', operatorRole: '裁片仓重装员' },
    source: 'PDA',
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
      <div class="text-sm font-semibold">1 扫来源中转袋</div>
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="sourceBag" placeholder="扫描或填写来源袋编号" />
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="add-source" type="button">加入来源袋</button>
      <div class="space-y-2">${state.sourceBagCodes.map((code) => `<div class="rounded-lg border px-3 py-2 text-sm">${escapeHtml(code)}</div>`).join('') || '<div class="text-sm text-muted-foreground">尚未扫描来源袋</div>'}</div>
      ${state.sourceBagCodes.length ? '<button class="w-full py-2 text-sm font-medium text-blue-700" data-pda-repack-action="sources-done" type="button">来源袋已全部扫描，继续</button>' : ''}
    </div>
  `
}

function renderTicketStep(state: PdaTransferBagRepackState): string {
  const assigned = Object.keys(state.ticketTargetById).length
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">2 扫来源袋内菲票</div>
      <div class="text-xs text-muted-foreground">已分配 ${assigned} 张；来源袋 ${state.sourceBagCodes.length} 只。</div>
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="ticket" placeholder="扫描或填写菲票编号" />
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="scan-ticket" type="button">读取菲票</button>
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
        <button class="h-12 w-full rounded-xl bg-amber-600 font-semibold text-white" data-pda-repack-action="force-recover-and-assign" type="button">强制回收并分配</button>
      </div>
    `
    : `
      <input class="h-12 w-full rounded-xl border px-3" data-pda-repack-field="resultBag" placeholder="扫描或填写结果袋编号" />
      <button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="assign-result" type="button">分配到结果袋</button>
    `
  return `
    <div class="space-y-3">
      <div class="text-sm font-semibold">3 扫结果中转袋</div>
      <div class="rounded-xl border bg-slate-50 p-3 text-sm">当前菲票：${escapeHtml(state.pendingTicketId)}</div>
      ${forcePrompt}
    </div>
  `
}

function renderConfirmation(state: PdaTransferBagRepackState): string {
  const summary = buildPdaRepackConfirmation(state)
  return `
    <div class="space-y-4">
      <div class="text-sm font-semibold">4 核对系统汇总</div>
      <div class="grid grid-cols-2 gap-2 text-center text-sm">
        <div class="rounded-xl border p-3">来源<br><b>${summary.totalSourceTicketCount} 张 / ${summary.totalSourcePieceQty} 片</b></div>
        <div class="rounded-xl border p-3">结果<br><b>${summary.totalResultTicketCount} 张 / ${summary.totalResultPieceQty} 片</b></div>
      </div>
      <div class="space-y-2">${summary.sourceBags.map((bag) => `
        <div class="rounded-xl border p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b><br>转出 ${bag.transferredTicketCount} 张 / ${bag.transferredPieceQty} 片；保留 ${bag.retainedTicketCount} 张 / ${bag.retainedPieceQty} 片；${bag.becomesIdle ? '重装后空闲' : '继续使用'}</div>
      `).join('')}</div>
      <div class="space-y-2">${summary.resultBags.map((bag) => `
        <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b><br>${escapeHtml(bag.productionOrderNo)} · ${escapeHtml(bag.receiverFactoryName)}<br>${bag.ticketCount} 张 / ${bag.pieceQty} 片</div>
      `).join('')}</div>
      ${summary.errors.map((error) => `<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(error)}</div>`).join('')}
      ${summary.canSubmit ? '<button class="h-12 w-full rounded-xl bg-blue-600 font-semibold text-white" data-pda-repack-action="confirm" type="button">确认重装</button>' : ''}
    </div>
  `
}

function renderDone(state: PdaTransferBagRepackState): string {
  const summary = buildPdaRepackConfirmation(state)
  return `
    <div class="space-y-4">
      <div class="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
        <div class="font-semibold">重装成功，请继续交出</div>
        <div class="mt-1 text-sm">事实编号：${escapeHtml(state.submittedEventId)}</div>
      </div>
      ${summary.resultBags.map((bag) => `<div class="rounded-xl border p-3 text-sm"><b>${escapeHtml(bag.bagCode)}</b> · ${bag.ticketCount} 张 / ${bag.pieceQty} 片 · 待交出</div>`).join('')}
      <a class="block h-12 rounded-xl bg-blue-600 py-3 text-center font-semibold text-white" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      <button class="w-full py-2 text-sm font-medium text-blue-700" data-pda-repack-action="reset" type="button">开始下一次重装</button>
    </div>
  `
}

function renderRepackWorkflow(state: PdaTransferBagRepackState): string {
  const content = state.step === 'SOURCE_BAGS'
    ? renderSourceStep(state)
    : state.step === 'TICKETS'
      ? renderTicketStep(state)
      : state.step === 'RESULT_BAGS'
        ? renderResultStep(state)
        : state.step === 'CONFIRM'
          ? renderConfirmation(state)
          : renderDone(state)
  return `<section class="space-y-4 rounded-2xl border bg-card p-4" data-pda-transfer-bag-repack><div class="flex items-center justify-between gap-3"><h1 class="text-lg font-semibold">拆袋重装</h1>${state.step !== 'SOURCE_BAGS' && state.step !== 'DONE' ? '<button class="text-xs text-blue-700" data-pda-repack-action="reset" type="button">重新开始</button>' : ''}</div>${renderFeedback(state)}${content}</section>`
}

export function renderPdaCuttingTransferBagRepackPage(): string {
  return renderPdaFrame(`
    <main class="space-y-4 px-4 py-4">
      <a class="text-sm text-blue-700" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      ${renderRepackWorkflow(getRepackState())}
    </main>
  `, 'warehouse', {
    headerTitle: '拆袋重装',
    disableTodoAutoOpen: true,
  })
}

function fieldValue(container: HTMLElement, name: string): string {
  return container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-pda-repack-field="${name}"]`)?.value || ''
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
    action = fieldNode.dataset.pdaRepackField === 'sourceBag'
      ? 'add-source'
      : fieldNode.dataset.pdaRepackField === 'ticket'
        ? 'scan-ticket'
        : fieldNode.dataset.pdaRepackField === 'resultBag'
          ? 'assign-result'
          : ''
  }
  if (!action) return false
  const state = getRepackState()
  try {
    if (action === 'reset') {
      return updateRepackWorkflow(container, createPdaTransferBagRepackState())
    }
    if (action === 'add-source') {
      return updateRepackWorkflow(container, scanRepackSourceBag(state, fieldValue(container, 'sourceBag')))
    }
    if (action === 'sources-done') {
      if (!state.sourceBagCodes.length) throw new Error('请先扫描来源袋。')
      return updateRepackWorkflow(container, { ...state, step: 'TICKETS', feedback: '请逐张扫描来源袋内菲票。' })
    }
    if (action === 'scan-ticket') {
      return updateRepackWorkflow(container, scanRepackTicket(state, fieldValue(container, 'ticket')))
    }
    if (action === 'assign-result') {
      const resultBagCode = normalizeCode(fieldValue(container, 'resultBag'))
      try {
        return updateRepackWorkflow(container, assignRepackTicket(state, state.pendingTicketId, resultBagCode))
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
    if (action === 'force-recover-and-assign') {
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
      const assigned = assignRepackTicket(
        state,
        state.pendingTicketId,
        state.pendingForceBagCode,
        getBrowserLocalStorage(),
        confirmation,
      )
      return updateRepackWorkflow(container, {
        ...assigned,
        forceRecoveryByBagCode: {
          ...assigned.forceRecoveryByBagCode,
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
    if (action === 'confirm') {
      const submitted = submitPdaTransferBagRepack(state)
      return updateRepackWorkflow(container, {
        ...state,
        step: 'DONE',
        submittedEventId: submitted.eventId,
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
