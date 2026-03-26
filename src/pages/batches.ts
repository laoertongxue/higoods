import {
  initialSettlementBatches,
  initialStatementDrafts,
} from '../data/fcs/store-domain-settlement-seeds'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import type {
  SettlementBatch,
  SettlementBatchItem,
  StatementDraft,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'

type PoolPartyFilter = '__all__' | string
type BatchWorkbenchView = 'IN_PROGRESS' | 'PAYMENT' | 'COMPLETED' | 'HISTORY'
type PaymentSyncStatus = 'UNSYNCED' | 'SUCCESS' | 'FAILED' | 'PARTIAL'

interface PaymentForm {
  paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | ''
  paymentAmount: string
  paymentAt: string
  paymentReferenceNo: string
  paymentRemark: string
}

interface BatchWorkbenchCounts {
  candidateCount: number
  inProgressCount: number
  paymentCount: number
  completedCount: number
  historyCount: number
  candidateAmount: number
}

interface BatchLifecycleRecord {
  title: string
  time: string
  detail: string
}

interface BatchDetailViewModel {
  batch: SettlementBatch
  statementCount: number
  settlementPartyCount: number
  paidAmount: number
  pendingAmount: number
  paymentStatus: PaymentSyncStatus
  lifecycleRecords: BatchLifecycleRecord[]
  profileVersionSummary: string
}

interface BatchesState {
  activeView: BatchWorkbenchView
  lastRouteSyncKey: string
  poolKeyword: string
  poolParty: PoolPartyFilter
  batchKeyword: string
  selected: Set<string>
  batchName: string
  remark: string
  detailBatchId: string | null
  paymentDialogBatchId: string | null
  paymentForm: PaymentForm
  paymentFormError: string
  paymentSaving: boolean
}

const PARTY_LABEL: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const VIEW_LABEL: Record<BatchWorkbenchView, string> = {
  IN_PROGRESS: '进行中',
  PAYMENT: '待打款/待回写',
  COMPLETED: '已完成',
  HISTORY: '历史',
}

const VIEW_NOTE: Record<BatchWorkbenchView, string> = {
  IN_PROGRESS: '查看已入批、尚未进入打款处理阶段的批次，并继续从已确认对账单装配新批次。',
  PAYMENT: '查看待打款与待回写批次，统一承接原打款结果更新页的执行动作。',
  COMPLETED: '查看近期已完成打款与回写的批次，快速回看批次结果。',
  HISTORY: '查看归档批次，统一承接原历史页的批次归档视图。',
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getFactoryFeedbackLabel(
  status: StatementDraft['factoryFeedbackStatus'],
): string {
  if (status === 'NOT_SENT') return '未下发'
  if (status === 'PENDING_FACTORY_CONFIRM') return '待工厂反馈'
  if (status === 'FACTORY_CONFIRMED') return '工厂已确认'
  if (status === 'FACTORY_APPEALED') return '工厂已申诉'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理完成'
}

const BATCH_STATUS_LABEL: Record<string, string> = {
  PENDING: '进行中',
  PROCESSING: '待打款/待回写',
  COMPLETED: '已完成',
}

const BATCH_STATUS_BADGE: Record<string, string> = {
  PENDING: 'border border-slate-200 bg-slate-50 text-slate-700',
  PROCESSING: 'border border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border border-green-200 bg-green-50 text-green-700',
}

const SYNC_STATUS_LABEL: Record<PaymentSyncStatus, string> = {
  UNSYNCED: '待回写',
  SUCCESS: '已回写',
  FAILED: '回写失败',
  PARTIAL: '部分回写',
}

const SYNC_STATUS_BADGE: Record<PaymentSyncStatus, string> = {
  UNSYNCED: 'border bg-muted text-muted-foreground',
  SUCCESS: 'border border-green-200 bg-green-50 text-green-700',
  FAILED: 'border border-red-200 bg-red-50 text-red-700',
  PARTIAL: 'border border-blue-200 bg-blue-50 text-blue-700',
}

const EMPTY_PAYMENT_FORM: PaymentForm = {
  paymentSyncStatus: '',
  paymentAmount: '',
  paymentAt: '',
  paymentReferenceNo: '',
  paymentRemark: '',
}

const state: BatchesState = {
  activeView: 'IN_PROGRESS',
  lastRouteSyncKey: '',
  poolKeyword: '',
  poolParty: '__all__',
  batchKeyword: '',
  selected: new Set<string>(),
  batchName: '',
  remark: '',
  detailBatchId: null,
  paymentDialogBatchId: null,
  paymentForm: { ...EMPTY_PAYMENT_FORM },
  paymentFormError: '',
  paymentSaving: false,
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function formatAmount(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getCurrentBatchSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function buildBatchesHref(view: BatchWorkbenchView = state.activeView): string {
  if (view === 'IN_PROGRESS') return '/fcs/settlement/batches'
  const params = new URLSearchParams()
  params.set(
    'view',
    view === 'PAYMENT' ? 'payment' : view === 'COMPLETED' ? 'completed' : 'history',
  )
  return `/fcs/settlement/batches?${params.toString()}`
}

function syncBatchesStateFromRoute(): void {
  const routeKey = appStore.getState().pathname
  if (state.lastRouteSyncKey === routeKey) return

  const view = getCurrentBatchSearchParams().get('view')
  if (view === 'payment') state.activeView = 'PAYMENT'
  else if (view === 'completed') state.activeView = 'COMPLETED'
  else if (view === 'history') state.activeView = 'HISTORY'
  else state.activeView = 'IN_PROGRESS'

  state.lastRouteSyncKey = routeKey
}

function showBatchesToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'batches-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2200)
}

function partyLabel(type: string, id: string): string {
  return `${PARTY_LABEL[type] ?? type} / ${id}`
}

function getEffectivePaymentSyncStatus(batch: SettlementBatch): PaymentSyncStatus {
  return batch.paymentSyncStatus ?? 'UNSYNCED'
}

function getPaidAmount(batch: SettlementBatch): number {
  const status = getEffectivePaymentSyncStatus(batch)
  if (status === 'SUCCESS') return batch.paymentAmount ?? batch.totalAmount
  if (status === 'PARTIAL') return batch.paymentAmount ?? 0
  return 0
}

function getPendingAmount(batch: SettlementBatch): number {
  return Math.max(0, batch.totalAmount - getPaidAmount(batch))
}

function isHistoryBatch(batch: SettlementBatch): boolean {
  if (batch.archivedAt) return true
  const anchor = batch.completedAt ?? batch.updatedAt ?? batch.createdAt
  return batch.status === 'COMPLETED' && anchor.slice(0, 7) < nowTimestamp().slice(0, 7)
}

function isPaymentViewBatch(batch: SettlementBatch): boolean {
  if (batch.status === 'PROCESSING') return true
  if (batch.status !== 'COMPLETED') return false
  return getEffectivePaymentSyncStatus(batch) !== 'SUCCESS'
}

function isCompletedViewBatch(batch: SettlementBatch): boolean {
  return (
    batch.status === 'COMPLETED' &&
    getEffectivePaymentSyncStatus(batch) === 'SUCCESS' &&
    !isHistoryBatch(batch)
  )
}

function isInProgressBatch(batch: SettlementBatch): boolean {
  return batch.status === 'PENDING'
}

function isStatementEligibleForBatch(statement: StatementDraft): boolean {
  return statement.status === 'CONFIRMED'
}

function getOccupiedStatementIds(): Set<string> {
  return new Set(
    initialSettlementBatches
      .filter((item) => item.status !== 'COMPLETED')
      .flatMap((item) => item.statementIds),
  )
}

function getCandidateStatements(): StatementDraft[] {
  const occupiedIds = getOccupiedStatementIds()
  return initialStatementDrafts.filter(
    (item) => isStatementEligibleForBatch(item) && !occupiedIds.has(item.statementId),
  )
}

function getPartyOptions(
  candidates: StatementDraft[],
): Array<{ key: string; label: string }> {
  const seen = new Map<string, string>()
  for (const item of candidates) {
    const key = `${item.settlementPartyType}|${item.settlementPartyId}`
    if (!seen.has(key)) {
      seen.set(key, partyLabel(item.settlementPartyType, item.settlementPartyId))
    }
  }
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label }))
}

function getFilteredPool(candidates: StatementDraft[]): StatementDraft[] {
  const keyword = state.poolKeyword.trim().toLowerCase()

  return candidates.filter((item) => {
    if (keyword) {
      const matched =
        item.statementId.toLowerCase().includes(keyword) ||
        item.settlementPartyId.toLowerCase().includes(keyword) ||
        (item.remark ?? '').toLowerCase().includes(keyword)
      if (!matched) return false
    }

    if (state.poolParty !== '__all__') {
      const key = `${item.settlementPartyType}|${item.settlementPartyId}`
      if (key !== state.poolParty) return false
    }

    return true
  })
}

function matchesBatchKeyword(batch: SettlementBatch): boolean {
  const keyword = state.batchKeyword.trim().toLowerCase()
  if (!keyword) return true
  return [
    batch.batchId,
    batch.batchName ?? '',
    batch.remark ?? '',
    batch.paymentReferenceNo ?? '',
    batch.paymentRemark ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword)
}

function sortBatches(items: SettlementBatch[], anchor: 'created' | 'updated' | 'completed'): SettlementBatch[] {
  const getAnchor = (item: SettlementBatch) => {
    if (anchor === 'completed') return item.archivedAt ?? item.completedAt ?? item.updatedAt ?? item.createdAt
    if (anchor === 'updated') return item.paymentUpdatedAt ?? item.updatedAt ?? item.createdAt
    return item.createdAt
  }
  return [...items].sort((a, b) => getAnchor(b).localeCompare(getAnchor(a)))
}

function getBatchesByView(view: BatchWorkbenchView, includeKeyword = true): SettlementBatch[] {
  const all = includeKeyword
    ? initialSettlementBatches.filter((item) => matchesBatchKeyword(item))
    : [...initialSettlementBatches]
  if (view === 'IN_PROGRESS') {
    return sortBatches(all.filter((item) => isInProgressBatch(item)), 'created')
  }
  if (view === 'PAYMENT') {
    return sortBatches(all.filter((item) => isPaymentViewBatch(item)), 'updated')
  }
  if (view === 'COMPLETED') {
    return sortBatches(all.filter((item) => isCompletedViewBatch(item)), 'completed')
  }
  return sortBatches(all.filter((item) => isHistoryBatch(item)), 'completed')
}

function getWorkbenchCounts(candidates: StatementDraft[]): BatchWorkbenchCounts {
  return {
    candidateCount: candidates.length,
    inProgressCount: getBatchesByView('IN_PROGRESS', false).length,
    paymentCount: getBatchesByView('PAYMENT', false).length,
    completedCount: getBatchesByView('COMPLETED', false).length,
    historyCount: getBatchesByView('HISTORY', false).length,
    candidateAmount: candidates.reduce((sum, item) => sum + item.totalAmount, 0),
  }
}

function getSelectedAmount(candidates: StatementDraft[]): number {
  return Array.from(state.selected).reduce((sum, statementId) => {
    const statement = candidates.find((item) => item.statementId === statementId)
    return sum + (statement?.totalAmount ?? 0)
  }, 0)
}

function createSettlementBatch(
  input: { statementIds: string[]; remark?: string; batchName?: string },
  by: string,
): { ok: boolean; batchId?: string; message?: string } {
  const { statementIds, remark, batchName } = input
  if (!statementIds.length) return { ok: false, message: '请至少选择一张对账单' }

  for (const statementId of statementIds) {
    const statement = initialStatementDrafts.find((item) => item.statementId === statementId)
    if (!statement) return { ok: false, message: `对账单 ${statementId} 不存在` }
    if (statement.status !== 'CONFIRMED') {
      return { ok: false, message: `对账单 ${statementId} 当前不可纳入结算批次` }
    }
  }

  const occupiedIds = getOccupiedStatementIds()
  if (statementIds.some((statementId) => occupiedIds.has(statementId))) {
    return { ok: false, message: '存在已纳入未完成结算批次的对账单' }
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let batchId = `SB-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialSettlementBatches.some((item) => item.batchId === batchId)) {
    batchId = `SB-${month}-${randomSuffix(4)}`
  }

  const items: SettlementBatchItem[] = statementIds.map((statementId) => {
    const statement = initialStatementDrafts.find((item) => item.statementId === statementId)!
    return {
      statementId,
      settlementPartyType: statement.settlementPartyType,
      settlementPartyId: statement.settlementPartyId,
      totalAmount: statement.totalAmount,
      settlementProfileVersionNo: statement.settlementProfileVersionNo,
      settlementProfileSnapshot: statement.settlementProfileSnapshot,
      factoryFeedbackStatus: statement.factoryFeedbackStatus,
    }
  })

  const settlementProfileSnapshotRefs = Array.from(
    new Map(
      items
        .filter((item) => item.settlementProfileSnapshot)
        .map((item) => [item.settlementProfileSnapshot!.versionNo, item.settlementProfileSnapshot!]),
    ).values(),
  )

  const batch: SettlementBatch = {
    batchId,
    batchName,
    itemCount: items.length,
    totalAmount: items.reduce((sum, item) => sum + item.totalAmount, 0),
    status: 'PENDING',
    statementIds,
    items,
    remark,
    createdAt: timestamp,
    createdBy: by,
    settlementProfileSnapshotRefs,
    settlementProfileVersionSummary:
      settlementProfileSnapshotRefs.length === 0
        ? '未绑定结算资料版本'
        : settlementProfileSnapshotRefs.length === 1
          ? settlementProfileSnapshotRefs[0].versionNo
          : `${settlementProfileSnapshotRefs.length} 个版本快照`,
  }

  initialSettlementBatches.push(batch)
  return { ok: true, batchId }
}

function startSettlementBatch(batchId: string, by: string): { ok: boolean; message?: string } {
  const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `结算批次 ${batchId} 不存在` }
  if (batch.status === 'PROCESSING') return { ok: true }
  if (batch.status === 'COMPLETED') return { ok: false, message: '已完成的结算批次不可重新开始' }

  batch.status = 'PROCESSING'
  batch.updatedAt = nowTimestamp()
  batch.updatedBy = by
  return { ok: true }
}

function completeSettlementBatch(batchId: string, by: string): { ok: boolean; message?: string } {
  const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
  if (!batch) return { ok: false, message: `结算批次 ${batchId} 不存在` }
  if (batch.status === 'COMPLETED') return { ok: true }

  const timestamp = nowTimestamp()
  batch.status = 'COMPLETED'
  batch.completedAt = timestamp
  batch.updatedAt = timestamp
  batch.updatedBy = by

  for (const statementId of batch.statementIds) {
    const statement = initialStatementDrafts.find((item) => item.statementId === statementId)
    if (!statement) continue
    statement.status = 'CLOSED' as StatementStatus
    statement.updatedAt = timestamp
    statement.updatedBy = by
  }

  return { ok: true }
}

function syncSettlementPaymentResult(
  input: {
    batchId: string
    paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL'
    paymentAmount?: number
    paymentAt?: string
    paymentReferenceNo?: string
    paymentRemark?: string
  },
  by: string,
): { ok: boolean; message?: string } {
  const batch = initialSettlementBatches.find((item) => item.batchId === input.batchId)
  if (!batch) return { ok: false, message: `结算批次 ${input.batchId} 不存在` }
  if (batch.status !== 'COMPLETED') {
    return { ok: false, message: '仅已完成批次允许更新打款结果' }
  }

  if (input.paymentAmount !== undefined && input.paymentAmount < 0) {
    return { ok: false, message: '打款金额不能为负数' }
  }
  if (input.paymentSyncStatus === 'PARTIAL' && (!input.paymentAmount || input.paymentAmount <= 0)) {
    return { ok: false, message: '部分打款必须填写大于 0 的打款金额' }
  }

  const timestamp = nowTimestamp()
  batch.paymentSyncStatus = input.paymentSyncStatus
  batch.paymentAmount = input.paymentAmount
  batch.paymentAt = input.paymentAt
  batch.paymentReferenceNo = input.paymentReferenceNo
  batch.paymentRemark = input.paymentRemark
  batch.paymentUpdatedAt = timestamp
  batch.paymentUpdatedBy = by
  batch.updatedAt = timestamp
  batch.updatedBy = by
  return { ok: true }
}

function getSettlementPartyCount(batch: SettlementBatch): number {
  return new Set(batch.items.map((item) => `${item.settlementPartyType}|${item.settlementPartyId}`)).size
}

function getBatchLifecycleRecords(batch: SettlementBatch): BatchLifecycleRecord[] {
  const records: BatchLifecycleRecord[] = [
    {
      title: '创建批次',
      time: batch.createdAt,
      detail: `${batch.createdBy} 创建批次，并装配 ${batch.statementIds.length} 张已确认对账单。`,
    },
  ]

  if (batch.status === 'PENDING') {
    records.push({
      title: '进行中',
      time: batch.updatedAt ?? batch.createdAt,
      detail: '当前批次仍在平台执行中心处理中，尚未进入打款阶段。',
    })
  }

  if (batch.status === 'PROCESSING') {
    records.push({
      title: '待打款/待回写',
      time: batch.updatedAt ?? batch.createdAt,
      detail: '批次已进入打款结果处理阶段，待补录回写信息。',
    })
  }

  if (batch.completedAt) {
    records.push({
      title: '已完成',
      time: batch.completedAt,
      detail: '批次已完成结算执行，可继续登记打款与回写结果。',
    })
  }

  if (batch.paymentAt || batch.paymentUpdatedAt || batch.paymentSyncStatus) {
    records.push({
      title: '打款与回写',
      time: batch.paymentUpdatedAt ?? batch.paymentAt ?? batch.completedAt ?? batch.updatedAt ?? batch.createdAt,
      detail: `${SYNC_STATUS_LABEL[getEffectivePaymentSyncStatus(batch)]}，${batch.paymentReferenceNo ? `参考号 ${batch.paymentReferenceNo}` : '当前未填写参考号'}`,
    })
  }

  if (isHistoryBatch(batch)) {
    records.push({
      title: '历史归档',
      time: batch.archivedAt ?? batch.updatedAt ?? batch.completedAt ?? batch.createdAt,
      detail: '该批次已转入历史视图，保留归档查看。',
    })
  }

  return records
}

function getBatchDetailViewModel(batch: SettlementBatch): BatchDetailViewModel {
  return {
    batch,
    statementCount: batch.statementIds.length,
    settlementPartyCount: getSettlementPartyCount(batch),
    paidAmount: getPaidAmount(batch),
    pendingAmount: getPendingAmount(batch),
    paymentStatus: getEffectivePaymentSyncStatus(batch),
    lifecycleRecords: getBatchLifecycleRecords(batch),
    profileVersionSummary: batch.settlementProfileVersionSummary ?? '未绑定结算资料版本',
  }
}

function getDetailBatch(): BatchDetailViewModel | null {
  if (!state.detailBatchId) return null
  const batch = initialSettlementBatches.find((item) => item.batchId === state.detailBatchId)
  if (!batch) return null
  return getBatchDetailViewModel(batch)
}

function openPaymentDialog(batchId: string): void {
  const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
  if (!batch) return

  state.paymentDialogBatchId = batchId
  state.paymentForm = {
    paymentSyncStatus:
      getEffectivePaymentSyncStatus(batch) === 'UNSYNCED'
        ? ''
        : (getEffectivePaymentSyncStatus(batch) as PaymentForm['paymentSyncStatus']),
    paymentAmount: batch.paymentAmount !== undefined ? String(batch.paymentAmount) : '',
    paymentAt: batch.paymentAt ?? '',
    paymentReferenceNo: batch.paymentReferenceNo ?? '',
    paymentRemark: batch.paymentRemark ?? '',
  }
  state.paymentFormError = ''
  state.paymentSaving = false
}

function closePaymentDialog(): void {
  state.paymentDialogBatchId = null
  state.paymentForm = { ...EMPTY_PAYMENT_FORM }
  state.paymentFormError = ''
  state.paymentSaving = false
}

function renderWorkbenchCard(
  label: string,
  value: string,
  note: string,
  active: boolean,
  action?: string,
): string {
  return `
    <article class="${toClassName(
      'rounded-lg border bg-card transition-colors',
      active ? 'border-blue-300 shadow-sm' : '',
    )}">
      <button
        class="flex w-full flex-col gap-1 px-4 py-4 text-left"
        ${action ? `data-batch-action="${escapeHtml(action)}"` : ''}
      >
        <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
        <p class="text-2xl font-semibold tabular-nums">${escapeHtml(value)}</p>
        <p class="text-xs text-muted-foreground">${escapeHtml(note)}</p>
      </button>
    </article>
  `
}

function renderStatsSection(counts: BatchWorkbenchCounts): string {
  return `
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      ${renderWorkbenchCard(
        '待入批对账单',
        String(counts.candidateCount),
        `候选金额 ${formatAmount(counts.candidateAmount)}`,
        state.activeView === 'IN_PROGRESS',
        'switch-view-in-progress',
      )}
      ${renderWorkbenchCard(
        '进行中批次',
        String(counts.inProgressCount),
        '已装配对账单，待进入打款处理。',
        state.activeView === 'IN_PROGRESS',
        'switch-view-in-progress',
      )}
      ${renderWorkbenchCard(
        '待打款/待回写',
        String(counts.paymentCount),
        '承接打款结果更新与回写登记。',
        state.activeView === 'PAYMENT',
        'switch-view-payment',
      )}
      ${renderWorkbenchCard(
        '已完成',
        String(counts.completedCount),
        '查看近期已完成批次。',
        state.activeView === 'COMPLETED',
        'switch-view-completed',
      )}
      ${renderWorkbenchCard(
        '历史',
        String(counts.historyCount),
        '查看归档批次记录。',
        state.activeView === 'HISTORY',
        'switch-view-history',
      )}
    </section>
  `
}

function renderViewSwitcher(counts: BatchWorkbenchCounts): string {
  const entries: Array<{ view: BatchWorkbenchView; count: number }> = [
    { view: 'IN_PROGRESS', count: counts.inProgressCount },
    { view: 'PAYMENT', count: counts.paymentCount },
    { view: 'COMPLETED', count: counts.completedCount },
    { view: 'HISTORY', count: counts.historyCount },
  ]

  return `
    <section class="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div class="inline-flex flex-wrap gap-2">
        ${entries
          .map(
            (entry) => `
              <button
                class="${toClassName(
                  'inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors',
                  state.activeView === entry.view
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}"
                data-batch-action="switch-view"
                data-view="${entry.view}"
              >
                ${escapeHtml(VIEW_LABEL[entry.view])}
                <span class="ml-2 inline-flex rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                  ${entry.count}
                </span>
              </button>
            `,
          )
          .join('')}
      </div>
      <p class="text-sm text-muted-foreground">${escapeHtml(VIEW_NOTE[state.activeView])}</p>
    </section>
  `
}

function renderCandidatePool(candidates: StatementDraft[]): string {
  const partyOptions = getPartyOptions(candidates)
  const filteredPool = getFilteredPool(candidates)
  const selectedAmount = getSelectedAmount(candidates)
  const allSelected =
    filteredPool.length > 0 && filteredPool.every((item) => state.selected.has(item.statementId))

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-medium">待入批对账单</h2>
          <p class="mt-1 text-sm text-muted-foreground">从已确认对账单中选择同一结算对象，创建新的结算批次。</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <input
          class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
          data-batch-field="poolKeyword"
          placeholder="搜索对账单号/结算对象/备注"
          value="${escapeHtml(state.poolKeyword)}"
        />
        <select class="h-9 w-56 rounded-md border bg-background px-3 text-sm" data-batch-field="poolParty">
          <option value="__all__" ${state.poolParty === '__all__' ? 'selected' : ''}>全部结算对象</option>
          ${partyOptions
            .map(
              (item) =>
                `<option value="${escapeHtml(item.key)}" ${state.poolParty === item.key ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
            )
            .join('')}
        </select>
      </div>

      ${
        state.selected.size > 0
          ? `
            <div class="rounded-lg border bg-muted/30 p-3">
              <div class="mb-3 text-sm text-muted-foreground">
                已选 <span class="font-medium text-foreground">${state.selected.size}</span> 张对账单，
                合计 <span class="font-medium text-foreground">${formatAmount(selectedAmount)}</span>
              </div>
              <div class="flex flex-wrap items-end gap-3">
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">批次名称</label>
                  <input
                    class="h-8 w-48 rounded-md border bg-background px-2 text-sm"
                    data-batch-field="batchName"
                    placeholder="可选"
                    value="${escapeHtml(state.batchName)}"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-muted-foreground">说明</label>
                  <input
                    class="h-8 w-56 rounded-md border bg-background px-2 text-sm"
                    data-batch-field="remark"
                    placeholder="可选"
                    value="${escapeHtml(state.remark)}"
                  />
                </div>
                <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-batch-action="create-batch">生成结算批次</button>
              </div>
            </div>
          `
          : ''
      }

      ${
        filteredPool.length === 0
          ? `<p class="py-8 text-center text-sm text-muted-foreground">暂无可纳入批次的对账单</p>`
          : `
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="w-10 px-4 py-2">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-border align-middle"
                        data-batch-action="toggle-select-all"
                        ${allSelected ? 'checked' : ''}
                      />
                    </th>
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">结算对象</th>
                    <th class="px-4 py-2 text-right font-medium">条目数</th>
                    <th class="px-4 py-2 text-right font-medium">总数量</th>
                    <th class="px-4 py-2 text-right font-medium">总金额</th>
                    <th class="px-4 py-2 font-medium">更新时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredPool
                    .map(
                      (item) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3">
                            <input
                              type="checkbox"
                              class="h-4 w-4 rounded border-border align-middle"
                              data-batch-action="toggle-select"
                              data-statement-id="${escapeHtml(item.statementId)}"
                              ${state.selected.has(item.statementId) ? 'checked' : ''}
                            />
                          </td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementId)}</td>
                          <td class="px-4 py-3">${escapeHtml(
                            partyLabel(item.settlementPartyType, item.settlementPartyId),
                          )}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${item.totalQty}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.totalAmount)}</td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.updatedAt ?? item.createdAt)}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">前往对账单</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </section>
  `
}

function renderBatchRows(view: BatchWorkbenchView, items: SettlementBatch[]): string {
  if (items.length === 0) {
    return `<p class="py-10 text-center text-sm text-muted-foreground">${
      view === 'IN_PROGRESS'
        ? '暂无进行中的结算批次'
        : view === 'PAYMENT'
          ? '暂无待打款或待回写的结算批次'
          : view === 'COMPLETED'
            ? '暂无近期已完成批次'
            : '暂无历史批次'
    }</p>`
  }

  const header =
    view === 'PAYMENT'
      ? `
        <tr class="border-b bg-muted/40 text-left">
          <th class="px-4 py-2 font-medium">批次号</th>
          <th class="px-4 py-2 font-medium">批次名称</th>
          <th class="px-4 py-2 text-center font-medium">对账单数</th>
          <th class="px-4 py-2 font-medium">批次状态</th>
          <th class="px-4 py-2 font-medium">总金额</th>
          <th class="px-4 py-2 font-medium">已打款金额</th>
          <th class="px-4 py-2 font-medium">回写状态</th>
          <th class="px-4 py-2 font-medium">回写时间</th>
          <th class="px-4 py-2 font-medium">操作</th>
        </tr>
      `
      : `
        <tr class="border-b bg-muted/40 text-left">
          <th class="px-4 py-2 font-medium">批次号</th>
          <th class="px-4 py-2 font-medium">批次名称</th>
          <th class="px-4 py-2 text-center font-medium">对账单数</th>
          <th class="px-4 py-2 text-center font-medium">结算对象数</th>
          <th class="px-4 py-2 font-medium">总金额</th>
          <th class="px-4 py-2 font-medium">批次状态</th>
          <th class="px-4 py-2 font-medium">${
            view === 'HISTORY' ? '归档时间' : view === 'COMPLETED' ? '完成时间' : '创建时间'
          }</th>
          <th class="px-4 py-2 font-medium">操作</th>
        </tr>
      `

  const rows = items
    .map((item) => {
      const statementCount = item.statementIds.length
      const paymentStatus = getEffectivePaymentSyncStatus(item)
      const primaryTime =
        view === 'HISTORY'
          ? item.archivedAt ?? item.updatedAt ?? item.completedAt ?? item.createdAt
          : view === 'COMPLETED'
            ? item.completedAt ?? item.updatedAt ?? item.createdAt
            : view === 'PAYMENT'
              ? item.paymentUpdatedAt ?? item.updatedAt ?? item.createdAt
              : item.createdAt

      if (view === 'PAYMENT') {
        return `
          <tr class="border-b last:border-b-0">
            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.batchId)}</td>
            <td class="px-4 py-3">${escapeHtml(item.batchName ?? '未命名批次')}</td>
            <td class="px-4 py-3 text-center">${statementCount}</td>
            <td class="px-4 py-3">
              <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${BATCH_STATUS_BADGE[item.status]}">
                ${escapeHtml(BATCH_STATUS_LABEL[item.status])}
              </span>
            </td>
            <td class="px-4 py-3">${formatAmount(item.totalAmount)}</td>
            <td class="px-4 py-3">${formatAmount(getPaidAmount(item))}</td>
            <td class="px-4 py-3">
              <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${SYNC_STATUS_BADGE[paymentStatus]}">
                ${escapeHtml(SYNC_STATUS_LABEL[paymentStatus])}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(primaryTime)}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-batch-action="open-detail" data-batch-id="${escapeHtml(item.batchId)}">查看详情</button>
                ${
                  item.status === 'PROCESSING'
                    ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="complete-batch" data-batch-id="${escapeHtml(item.batchId)}">完成批次</button>`
                    : `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="open-payment-dialog" data-batch-id="${escapeHtml(item.batchId)}">更新打款结果</button>`
                }
              </div>
            </td>
          </tr>
        `
      }

      return `
        <tr class="border-b last:border-b-0">
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.batchId)}</td>
          <td class="px-4 py-3">${escapeHtml(item.batchName ?? '未命名批次')}</td>
          <td class="px-4 py-3 text-center">${statementCount}</td>
          <td class="px-4 py-3 text-center">${getSettlementPartyCount(item)}</td>
          <td class="px-4 py-3">${formatAmount(item.totalAmount)}</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${BATCH_STATUS_BADGE[item.status]}">
              ${escapeHtml(BATCH_STATUS_LABEL[item.status])}
            </span>
          </td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(primaryTime)}</td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-batch-action="open-detail" data-batch-id="${escapeHtml(item.batchId)}">查看详情</button>
              ${
                view === 'IN_PROGRESS'
                  ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="start-batch" data-batch-id="${escapeHtml(item.batchId)}">进入待打款</button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[1100px] text-sm">
        <thead>${header}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

function renderCurrentViewList(): string {
  const items = getBatchesByView(state.activeView)

  if (state.activeView === 'IN_PROGRESS') {
    const candidates = getCandidateStatements()
    return `
      <section class="space-y-4">
        ${renderCandidatePool(candidates)}
        <section class="space-y-3 rounded-lg border bg-card p-4">
          <div>
            <h2 class="text-base font-medium">进行中批次</h2>
            <p class="mt-1 text-sm text-muted-foreground">查看已组批、仍在平台执行中的结算批次。</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <input
              class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
              data-batch-field="batchKeyword"
              placeholder="搜索批次号/名称/备注"
              value="${escapeHtml(state.batchKeyword)}"
            />
          </div>
          ${renderBatchRows('IN_PROGRESS', items)}
        </section>
      </section>
    `
  }

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 class="text-base font-medium">${escapeHtml(VIEW_LABEL[state.activeView])}</h2>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(VIEW_NOTE[state.activeView])}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <input
          class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
          data-batch-field="batchKeyword"
          placeholder="搜索批次号/名称/备注"
          value="${escapeHtml(state.batchKeyword)}"
        />
      </div>
      ${renderBatchRows(state.activeView, items)}
    </section>
  `
}

function renderPaymentDialog(): string {
  if (!state.paymentDialogBatchId) return ''
  const batch = initialSettlementBatches.find((item) => item.batchId === state.paymentDialogBatchId)
  if (!batch) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-batch-action="close-payment-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-batch-action="close-payment-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
        <header class="mb-3">
          <h3 class="text-lg font-semibold">更新打款结果</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(batch.batchId)} · ${escapeHtml(batch.batchName ?? '未命名批次')}</p>
        </header>

        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">回写状态 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-batch-field="paymentSyncStatus">
              <option value="" ${state.paymentForm.paymentSyncStatus === '' ? 'selected' : ''}>请选择回写状态</option>
              <option value="SUCCESS" ${state.paymentForm.paymentSyncStatus === 'SUCCESS' ? 'selected' : ''}>已回写</option>
              <option value="FAILED" ${state.paymentForm.paymentSyncStatus === 'FAILED' ? 'selected' : ''}>回写失败</option>
              <option value="PARTIAL" ${state.paymentForm.paymentSyncStatus === 'PARTIAL' ? 'selected' : ''}>部分回写</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">打款金额</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="0"
              data-batch-field="paymentAmount"
              placeholder="请输入打款金额"
              value="${escapeHtml(state.paymentForm.paymentAmount)}"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">打款时间</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-batch-field="paymentAt"
              placeholder="例：2026-03-26 10:30:00"
              value="${escapeHtml(state.paymentForm.paymentAt)}"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">打款参考号</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-batch-field="paymentReferenceNo"
              placeholder="银行流水号或参考号"
              value="${escapeHtml(state.paymentForm.paymentReferenceNo)}"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">说明</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-batch-field="paymentRemark"
              placeholder="可选说明"
            >${escapeHtml(state.paymentForm.paymentRemark)}</textarea>
          </div>
          ${
            state.paymentFormError
              ? `<p class="text-sm text-red-600">${escapeHtml(state.paymentFormError)}</p>`
              : ''
          }
        </div>

        <footer class="mt-2 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="close-payment-dialog">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.paymentSaving ? 'pointer-events-none opacity-50' : ''
          }" data-batch-action="save-payment-dialog">保存</button>
        </footer>
      </section>
    </div>
  `
}

function renderDetailDialog(detail: BatchDetailViewModel | null): string {
  if (!detail) return ''

  const statementRows = detail.batch.statementIds
    .map((statementId) => initialStatementDrafts.find((item) => item.statementId === statementId))
    .filter(Boolean) as StatementDraft[]

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-batch-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-batch-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="mb-4">
          <h3 class="text-lg font-semibold">${escapeHtml(detail.batch.batchId)}${detail.batch.batchName ? ` · ${escapeHtml(detail.batch.batchName)}` : ''}</h3>
          <p class="mt-1 text-sm text-muted-foreground">结算批次负责装配已确认对账单，并统一承接打款、回写和历史归档。</p>
        </header>

        <div class="grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">基本信息</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">批次号</dt>
                <dd class="font-mono text-xs">${escapeHtml(detail.batch.batchId)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">批次状态</dt>
                <dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${BATCH_STATUS_BADGE[detail.batch.status]}">${escapeHtml(BATCH_STATUS_LABEL[detail.batch.status])}</span></dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">创建时间</dt>
                <dd>${escapeHtml(detail.batch.createdAt)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">完成时间</dt>
                <dd>${escapeHtml(detail.batch.completedAt ?? '当前未完成')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">对账单数</dt>
                <dd>${detail.statementCount}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">结算对象数</dt>
                <dd>${detail.settlementPartyCount}</dd>
              </div>
              ${
                detail.batch.remark
                  ? `
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">说明</dt>
                      <dd class="max-w-[70%] text-right">${escapeHtml(detail.batch.remark)}</dd>
                    </div>
                  `
                  : ''
              }
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">金额信息</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">批次总金额</dt>
                <dd class="font-medium">${formatAmount(detail.batch.totalAmount)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">已打款金额</dt>
                <dd>${formatAmount(detail.paidAmount)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">待打款/待回写金额</dt>
                <dd>${formatAmount(detail.pendingAmount)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">回写状态</dt>
                <dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${SYNC_STATUS_BADGE[detail.paymentStatus]}">${escapeHtml(SYNC_STATUS_LABEL[detail.paymentStatus])}</span></dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">打款时间</dt>
                <dd>${escapeHtml(detail.batch.paymentAt ?? '当前未登记')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">参考号</dt>
                <dd>${escapeHtml(detail.batch.paymentReferenceNo ?? '当前未填写')}</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">结算资料快照</h4>
            <p class="mt-1 text-xs text-muted-foreground">结算批次沿用关联对账单生成时冻结的结算资料版本，不会被后续主数据新版本直接覆盖。</p>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">版本概况</dt>
                <dd>${escapeHtml(detail.profileVersionSummary)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">默认币种</dt>
                <dd>${escapeHtml(detail.batch.settlementProfileSnapshotRefs?.[0]?.settlementConfigSnapshot.currency ?? 'IDR')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">收款账户</dt>
                <dd class="text-right text-xs">${escapeHtml(
                  detail.batch.settlementProfileSnapshotRefs?.[0]
                    ? `${detail.batch.settlementProfileSnapshotRefs[0].receivingAccountSnapshot.bankName} · ${maskBankAccountNo(
                        detail.batch.settlementProfileSnapshotRefs[0].receivingAccountSnapshot.bankAccountNo,
                      )}`
                    : '当前未绑定',
                )}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">生效说明</dt>
                <dd class="max-w-[70%] text-right text-xs text-muted-foreground">后续主数据新增版本只影响未来新对账单与新批次，当前批次继续保留生成时快照。</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4 md:col-span-2">
            <h4 class="text-sm font-medium">关联对账单</h4>
            <div class="mt-3 overflow-x-auto rounded-md border">
              <table class="w-full min-w-[860px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">结算对象</th>
                    <th class="px-4 py-2 font-medium">版本号</th>
                    <th class="px-4 py-2 font-medium">状态</th>
                    <th class="px-4 py-2 font-medium">工厂反馈</th>
                    <th class="px-4 py-2 font-medium">金额</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${statementRows
                    .map(
                      (statement) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(statement.statementId)}</td>
                          <td class="px-4 py-3">${escapeHtml(partyLabel(statement.settlementPartyType, statement.settlementPartyId))}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(statement.settlementProfileVersionNo)}</td>
                          <td class="px-4 py-3">${escapeHtml(statement.status === 'CONFIRMED' ? '已确认' : statement.status === 'CLOSED' ? '已关闭' : '草稿中')}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}</td>
                          <td class="px-4 py-3">${formatAmount(statement.totalAmount)}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">前往对账单</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">打款与回写</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">回写状态</dt>
                <dd>${escapeHtml(SYNC_STATUS_LABEL[detail.paymentStatus])}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">回写时间</dt>
                <dd>${escapeHtml(detail.batch.paymentUpdatedAt ?? '当前未回写')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">回写人</dt>
                <dd>${escapeHtml(detail.batch.paymentUpdatedBy ?? '当前未填写')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">打款说明</dt>
                <dd class="max-w-[70%] text-right">${escapeHtml(detail.batch.paymentRemark ?? '当前未填写')}</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">生命周期记录</h4>
            <ol class="mt-3 space-y-3 text-sm">
              ${detail.lifecycleRecords
                .map(
                  (record) => `
                    <li class="rounded-md border bg-muted/30 p-3">
                      <div class="flex items-center justify-between gap-3">
                        <span class="font-medium">${escapeHtml(record.title)}</span>
                        <span class="text-xs text-muted-foreground">${escapeHtml(record.time)}</span>
                      </div>
                      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.detail)}</p>
                    </li>
                  `,
                )
                .join('')}
            </ol>
          </section>
        </div>

        <footer class="mt-4 flex flex-wrap justify-end gap-2">
          ${
            detail.batch.status === 'PENDING'
              ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="start-batch" data-batch-id="${escapeHtml(detail.batch.batchId)}">进入待打款</button>`
              : ''
          }
          ${
            detail.batch.status === 'PROCESSING'
              ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="complete-batch" data-batch-id="${escapeHtml(detail.batch.batchId)}">完成批次</button>`
              : ''
          }
          ${
            detail.batch.status === 'COMPLETED' && detail.paymentStatus !== 'SUCCESS'
              ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="open-payment-dialog" data-batch-id="${escapeHtml(detail.batch.batchId)}">更新打款结果</button>`
              : ''
          }
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="close-detail">关闭</button>
        </footer>
      </section>
    </div>
  `
}

export function renderBatchesPage(): string {
  syncBatchesStateFromRoute()

  const pageBoundary = getSettlementPageBoundary('batches')
  const candidates = getCandidateStatements()
  const counts = getWorkbenchCounts(candidates)
  const detailBatch = getDetailBatch()

  return `
    <div class="flex flex-col gap-6 p-6">
      <section>
        <h1 class="text-xl font-semibold">结算批次</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
      </section>

      ${renderStatsSection(counts)}
      ${renderViewSwitcher(counts)}
      ${renderCurrentViewList()}
      ${renderDetailDialog(detailBatch)}
      ${renderPaymentDialog()}
    </div>
  `
}

export function handleBatchesEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-batch-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.batchField
    if (!field) return true

    if (field === 'poolKeyword') {
      state.poolKeyword = fieldNode.value
      return true
    }
    if (field === 'poolParty') {
      state.poolParty = fieldNode.value
      return true
    }
    if (field === 'batchKeyword') {
      state.batchKeyword = fieldNode.value
      return true
    }
    if (field === 'batchName') {
      state.batchName = fieldNode.value
      return true
    }
    if (field === 'remark') {
      state.remark = fieldNode.value
      return true
    }
    if (field === 'paymentSyncStatus') {
      state.paymentForm.paymentSyncStatus = fieldNode.value as PaymentForm['paymentSyncStatus']
      return true
    }
    if (field === 'paymentAmount') {
      state.paymentForm.paymentAmount = fieldNode.value
      return true
    }
    if (field === 'paymentAt') {
      state.paymentForm.paymentAt = fieldNode.value
      return true
    }
    if (field === 'paymentReferenceNo') {
      state.paymentForm.paymentReferenceNo = fieldNode.value
      return true
    }
    if (field === 'paymentRemark') {
      state.paymentForm.paymentRemark = fieldNode.value
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-batch-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.batchAction
  if (!action) return false

  if (action === 'switch-view-in-progress') {
    appStore.navigate(buildBatchesHref('IN_PROGRESS'))
    return true
  }
  if (action === 'switch-view-payment') {
    appStore.navigate(buildBatchesHref('PAYMENT'))
    return true
  }
  if (action === 'switch-view-completed') {
    appStore.navigate(buildBatchesHref('COMPLETED'))
    return true
  }
  if (action === 'switch-view-history') {
    appStore.navigate(buildBatchesHref('HISTORY'))
    return true
  }
  if (action === 'switch-view') {
    const view = actionNode.dataset.view as BatchWorkbenchView | undefined
    if (view) appStore.navigate(buildBatchesHref(view))
    return true
  }

  if (action === 'toggle-select') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    if (state.selected.has(statementId)) state.selected.delete(statementId)
    else state.selected.add(statementId)
    return true
  }

  if (action === 'toggle-select-all') {
    const filteredPool = getFilteredPool(getCandidateStatements())
    const allSelected =
      filteredPool.length > 0 && filteredPool.every((item) => state.selected.has(item.statementId))
    if (allSelected) state.selected = new Set<string>()
    else state.selected = new Set<string>(filteredPool.map((item) => item.statementId))
    return true
  }

  if (action === 'create-batch') {
    if (!state.selected.size) {
      showBatchesToast('请先选择对账单', 'error')
      return true
    }

    const result = createSettlementBatch(
      {
        statementIds: Array.from(state.selected),
        batchName: state.batchName.trim() || undefined,
        remark: state.remark.trim() || undefined,
      },
      'Admin',
    )

    if (!result.ok) {
      showBatchesToast(result.message ?? '生成失败', 'error')
      return true
    }

    showBatchesToast('已生成结算批次')
    state.selected = new Set<string>()
    state.batchName = ''
    state.remark = ''
    state.detailBatchId = result.batchId ?? null
    appStore.navigate(buildBatchesHref('IN_PROGRESS'))
    return true
  }

  if (action === 'start-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = startSettlementBatch(batchId, 'Admin')
    if (!result.ok) {
      showBatchesToast(result.message ?? '操作失败', 'error')
      return true
    }
    showBatchesToast('批次已进入待打款/待回写')
    appStore.navigate(buildBatchesHref('PAYMENT'))
    return true
  }

  if (action === 'complete-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = completeSettlementBatch(batchId, 'Admin')
    if (!result.ok) {
      showBatchesToast(result.message ?? '操作失败', 'error')
      return true
    }
    showBatchesToast('批次已完成，待更新打款结果')
    appStore.navigate(buildBatchesHref('PAYMENT'))
    return true
  }

  if (action === 'open-detail') {
    const batchId = actionNode.dataset.batchId
    if (batchId) state.detailBatchId = batchId
    return true
  }

  if (action === 'close-detail') {
    state.detailBatchId = null
    return true
  }

  if (action === 'open-payment-dialog') {
    const batchId = actionNode.dataset.batchId
    if (batchId) openPaymentDialog(batchId)
    return true
  }

  if (action === 'close-payment-dialog') {
    closePaymentDialog()
    return true
  }

  if (action === 'save-payment-dialog') {
    if (!state.paymentDialogBatchId) return true
    if (!state.paymentForm.paymentSyncStatus) {
      state.paymentFormError = '请选择回写状态'
      return true
    }
    if (
      state.paymentForm.paymentSyncStatus === 'PARTIAL' &&
      (!state.paymentForm.paymentAmount || Number(state.paymentForm.paymentAmount) <= 0)
    ) {
      state.paymentFormError = '部分回写必须填写大于 0 的打款金额'
      return true
    }
    if (state.paymentForm.paymentAmount && Number(state.paymentForm.paymentAmount) < 0) {
      state.paymentFormError = '打款金额不能为负数'
      return true
    }

    state.paymentSaving = true
    const result = syncSettlementPaymentResult(
      {
        batchId: state.paymentDialogBatchId,
        paymentSyncStatus: state.paymentForm.paymentSyncStatus,
        paymentAmount: state.paymentForm.paymentAmount ? Number(state.paymentForm.paymentAmount) : undefined,
        paymentAt: state.paymentForm.paymentAt || undefined,
        paymentReferenceNo: state.paymentForm.paymentReferenceNo || undefined,
        paymentRemark: state.paymentForm.paymentRemark || undefined,
      },
      '财务A',
    )
    state.paymentSaving = false

    if (!result.ok) {
      state.paymentFormError = result.message ?? '保存失败'
      return true
    }

    const currentBatch = initialSettlementBatches.find((item) => item.batchId === state.paymentDialogBatchId)
    closePaymentDialog()
    showBatchesToast('打款结果已更新')
    if (currentBatch && isHistoryBatch(currentBatch)) appStore.navigate(buildBatchesHref('HISTORY'))
    else if (currentBatch && getEffectivePaymentSyncStatus(currentBatch) === 'SUCCESS') {
      appStore.navigate(buildBatchesHref('COMPLETED'))
    } else {
      appStore.navigate(buildBatchesHref('PAYMENT'))
    }
    return true
  }

  return true
}

export function isBatchesDialogOpen(): boolean {
  return state.detailBatchId !== null || state.paymentDialogBatchId !== null
}
