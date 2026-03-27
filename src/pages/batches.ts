import {
  applyPrepaymentBatchForPayment,
  canStatementEnterPrepayment,
  closePrepaymentBatch,
  createPaymentWriteback,
  createPrepaymentBatch,
  getFeishuPaymentApprovalById,
  getOpenStatementAppeal,
  getPaymentWritebackById,
  getStatementSettlementProgressView,
  initialSettlementBatches,
  initialStatementDrafts,
  syncFeishuPaymentApprovalStatus,
} from '../data/fcs/store-domain-settlement-seeds'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import type {
  FeishuPaymentApproval,
  PaymentWriteback,
  SettlementBatch,
  StatementDraft,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'

type PoolPartyFilter = '__all__' | string
type BatchWorkbenchView = 'IN_PROGRESS' | 'PAYMENT' | 'COMPLETED' | 'HISTORY'
type WritebackDisplayStatus =
  | 'WAITING_PAYMENT'
  | 'PAID_PENDING_WRITEBACK'
  | 'WRITTEN_BACK'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_CANCELED'

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
  approval: FeishuPaymentApproval | null
  writeback: PaymentWriteback | null
  statementCount: number
  paidAmount: number
  pendingAmount: number
  writebackStatus: WritebackDisplayStatus
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
}

const VIEW_LABEL: Record<BatchWorkbenchView, string> = {
  IN_PROGRESS: '待申请/审批中',
  PAYMENT: '已付款待回写',
  COMPLETED: '已预付',
  HISTORY: '历史',
}

const VIEW_NOTE: Record<BatchWorkbenchView, string> = {
  IN_PROGRESS: '查看待申请付款、已创建飞书付款审批或审批处理中批次，并继续从已满足入批条件的对账单装配新批次。',
  PAYMENT: '查看飞书已付款但尚未完成打款回写的预付款批次，统一承接回执和银行流水登记。',
  COMPLETED: '查看已完成打款回写、已完成预付的批次结果。',
  HISTORY: '查看已关闭归档的预付款批次。',
}

const STATEMENT_STATUS_LABEL: Record<StatementStatus, string> = {
  DRAFT: '草稿',
  PENDING_FACTORY_CONFIRM: '待工厂反馈',
  FACTORY_CONFIRMED: '工厂已确认',
  READY_FOR_PREPAYMENT: '待入预付款',
  IN_PREPAYMENT_BATCH: '已入预付款批次',
  PREPAID: '已预付',
  CLOSED: '已关闭',
}

const BATCH_STATUS_LABEL: Record<SettlementBatch['status'], string> = {
  DRAFT: '草稿',
  READY_TO_APPLY_PAYMENT: '待申请付款',
  FEISHU_APPROVAL_CREATED: '飞书审批中',
  FEISHU_PAID_PENDING_WRITEBACK: '已付款待回写',
  PREPAID: '已预付',
  CLOSED: '已关闭',
  FEISHU_APPROVAL_REJECTED: '审批已驳回',
  FEISHU_APPROVAL_CANCELED: '审批已取消',
}

const BATCH_STATUS_BADGE: Record<SettlementBatch['status'], string> = {
  DRAFT: 'border border-slate-200 bg-slate-50 text-slate-700',
  READY_TO_APPLY_PAYMENT: 'border border-blue-200 bg-blue-50 text-blue-700',
  FEISHU_APPROVAL_CREATED: 'border border-amber-200 bg-amber-50 text-amber-700',
  FEISHU_PAID_PENDING_WRITEBACK: 'border border-orange-200 bg-orange-50 text-orange-700',
  PREPAID: 'border border-green-200 bg-green-50 text-green-700',
  CLOSED: 'border border-slate-200 bg-slate-100 text-slate-700',
  FEISHU_APPROVAL_REJECTED: 'border border-red-200 bg-red-50 text-red-700',
  FEISHU_APPROVAL_CANCELED: 'border border-slate-200 bg-slate-50 text-slate-600',
}

const APPROVAL_STATUS_LABEL: Record<FeishuPaymentApproval['status'], string> = {
  CREATED: '已创建',
  APPROVING: '审批中',
  APPROVED_PENDING_PAYMENT: '已审批待付款',
  PAID: '已付款',
  REJECTED: '已驳回',
  CANCELED: '已取消',
}

const APPROVAL_STATUS_BADGE: Record<FeishuPaymentApproval['status'], string> = {
  CREATED: 'border border-blue-200 bg-blue-50 text-blue-700',
  APPROVING: 'border border-amber-200 bg-amber-50 text-amber-700',
  APPROVED_PENDING_PAYMENT: 'border border-violet-200 bg-violet-50 text-violet-700',
  PAID: 'border border-green-200 bg-green-50 text-green-700',
  REJECTED: 'border border-red-200 bg-red-50 text-red-700',
  CANCELED: 'border border-slate-200 bg-slate-50 text-slate-600',
}

const WRITEBACK_STATUS_LABEL: Record<WritebackDisplayStatus, string> = {
  WAITING_PAYMENT: '待付款',
  PAID_PENDING_WRITEBACK: '待创建回写',
  WRITTEN_BACK: '已完成回写',
  APPROVAL_REJECTED: '审批已驳回',
  APPROVAL_CANCELED: '审批已取消',
}

const WRITEBACK_STATUS_BADGE: Record<WritebackDisplayStatus, string> = {
  WAITING_PAYMENT: 'border border-slate-200 bg-slate-50 text-slate-700',
  PAID_PENDING_WRITEBACK: 'border border-orange-200 bg-orange-50 text-orange-700',
  WRITTEN_BACK: 'border border-green-200 bg-green-50 text-green-700',
  APPROVAL_REJECTED: 'border border-red-200 bg-red-50 text-red-700',
  APPROVAL_CANCELED: 'border border-slate-200 bg-slate-50 text-slate-600',
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
}

function formatAmount(value: number, currency = 'IDR'): string {
  return `${currency} ${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
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

function getCurrentBatchSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
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
    root.className =
      'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
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

function getResolutionResultLabel(result?: StatementDraft['resolutionResult']): string {
  if (result === 'UPHELD') return '维持当前口径'
  if (result === 'REOPEN_REQUIRED') return '退回重算'
  return '当前未处理'
}

function getFactoryFeedbackLabel(status: StatementDraft['factoryFeedbackStatus']): string {
  if (status === 'NOT_SENT') return '未下发'
  if (status === 'PENDING_FACTORY_CONFIRM') return '待工厂反馈'
  if (status === 'FACTORY_CONFIRMED') return '工厂已确认'
  if (status === 'FACTORY_APPEALED') return '工厂已申诉'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理完成'
}

function getAppealStatusLabel(
  status: NonNullable<ReturnType<typeof getOpenStatementAppeal>>['status'] | 'RESOLVED',
): string {
  if (status === 'SUBMITTED') return '已申诉'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理'
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getStatementCurrency(statement: StatementDraft): string {
  return statement.settlementCurrency ?? statement.settlementProfileSnapshot.settlementConfigSnapshot.currency
}

function getBatchApproval(batch: SettlementBatch): FeishuPaymentApproval | null {
  return batch.feishuApprovalId ? getFeishuPaymentApprovalById(batch.feishuApprovalId) : null
}

function getBatchWriteback(batch: SettlementBatch): PaymentWriteback | null {
  return batch.paymentWritebackId ? getPaymentWritebackById(batch.paymentWritebackId) : null
}

function getWritebackStatus(
  batch: SettlementBatch,
  approval: FeishuPaymentApproval | null,
  writeback: PaymentWriteback | null,
): WritebackDisplayStatus {
  if (writeback) return 'WRITTEN_BACK'
  if (approval?.status === 'PAID') return 'PAID_PENDING_WRITEBACK'
  if (approval?.status === 'REJECTED') return 'APPROVAL_REJECTED'
  if (approval?.status === 'CANCELED') return 'APPROVAL_CANCELED'
  return 'WAITING_PAYMENT'
}

function getPaidAmount(
  batch: SettlementBatch,
  approval: FeishuPaymentApproval | null,
  writeback: PaymentWriteback | null,
): number {
  if (writeback) return writeback.amount
  if (approval?.status === 'PAID') return approval.amount
  return batch.paymentAmount ?? 0
}

function getPendingAmount(
  batch: SettlementBatch,
  approval: FeishuPaymentApproval | null,
  writeback: PaymentWriteback | null,
): number {
  return Math.max(0, batch.totalPayableAmount - getPaidAmount(batch, approval, writeback))
}

function getPrimarySnapshot(batch: SettlementBatch) {
  return batch.settlementProfileSnapshotRefs?.[0]
}

function isHistoryBatch(batch: SettlementBatch): boolean {
  return batch.status === 'CLOSED'
}

function isPaymentViewBatch(batch: SettlementBatch): boolean {
  return batch.status === 'FEISHU_PAID_PENDING_WRITEBACK'
}

function isCompletedViewBatch(batch: SettlementBatch): boolean {
  return batch.status === 'PREPAID'
}

function isInProgressBatch(batch: SettlementBatch): boolean {
  return !isPaymentViewBatch(batch) && !isCompletedViewBatch(batch) && !isHistoryBatch(batch)
}

function canApplyPayment(batch: SettlementBatch, approval: FeishuPaymentApproval | null): boolean {
  if (approval && approval.status !== 'REJECTED' && approval.status !== 'CANCELED') return false
  return batch.status === 'READY_TO_APPLY_PAYMENT' || batch.status === 'DRAFT'
}

function canSyncApproval(
  approval: FeishuPaymentApproval | null,
  writeback: PaymentWriteback | null,
): boolean {
  if (!approval || writeback) return false
  return (
    approval.status === 'CREATED' ||
    approval.status === 'APPROVING' ||
    approval.status === 'APPROVED_PENDING_PAYMENT'
  )
}

function canCreateWriteback(
  batch: SettlementBatch,
  approval: FeishuPaymentApproval | null,
  writeback: PaymentWriteback | null,
): boolean {
  return Boolean(batch.feishuApprovalId && approval?.status === 'PAID' && !writeback)
}

function canCloseBatch(batch: SettlementBatch, writeback: PaymentWriteback | null): boolean {
  return batch.status === 'PREPAID' && Boolean(writeback)
}

function getOccupiedStatementIds(): Set<string> {
  return new Set(
    initialSettlementBatches
      .filter((item) => item.status !== 'CLOSED')
      .flatMap((item) => item.statementIds),
  )
}

function getCandidateStatements(): StatementDraft[] {
  const occupiedIds = getOccupiedStatementIds()
  return initialStatementDrafts.filter(
    (item) => canStatementEnterPrepayment(item) && !occupiedIds.has(item.statementId),
  )
}

function getPartyOptions(candidates: StatementDraft[]): Array<{ key: string; label: string }> {
  const seen = new Map<string, string>()
  for (const item of candidates) {
    if (!seen.has(item.settlementPartyId)) {
      seen.set(item.settlementPartyId, item.factoryName ?? item.statementPartyView ?? item.settlementPartyId)
    }
  }
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label }))
}

function getFilteredPool(candidates: StatementDraft[]): StatementDraft[] {
  const keyword = state.poolKeyword.trim().toLowerCase()

  return candidates.filter((item) => {
    if (state.poolParty !== '__all__' && item.settlementPartyId !== state.poolParty) return false

    if (!keyword) return true
    const haystack = [
      item.statementId,
      item.statementNo ?? '',
      item.factoryName ?? '',
      item.settlementCycleLabel ?? '',
      item.remark ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
}

function matchesBatchKeyword(batch: SettlementBatch): boolean {
  const keyword = state.batchKeyword.trim().toLowerCase()
  if (!keyword) return true
  const approval = getBatchApproval(batch)
  const writeback = getBatchWriteback(batch)
  return [
    batch.batchId,
    batch.batchNo,
    batch.batchName ?? '',
    batch.factoryName,
    batch.remark ?? '',
    approval?.approvalNo ?? '',
    writeback?.bankSerialNo ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword)
}

function sortBatches(items: SettlementBatch[], anchor: 'created' | 'updated' | 'closed'): SettlementBatch[] {
  const getAnchor = (item: SettlementBatch) => {
    const approval = getBatchApproval(item)
    const writeback = getBatchWriteback(item)
    if (anchor === 'closed') return item.closedAt ?? item.prepaidAt ?? writeback?.writtenBackAt ?? item.updatedAt ?? item.createdAt
    if (anchor === 'updated') return approval?.latestSyncedAt ?? writeback?.writtenBackAt ?? item.updatedAt ?? item.createdAt
    return item.createdAt
  }
  return [...items].sort((left, right) => getAnchor(right).localeCompare(getAnchor(left)))
}

function getBatchesByView(view: BatchWorkbenchView, includeKeyword = true): SettlementBatch[] {
  const all = includeKeyword
    ? initialSettlementBatches.filter((item) => matchesBatchKeyword(item))
    : [...initialSettlementBatches]

  if (view === 'IN_PROGRESS') return sortBatches(all.filter((item) => isInProgressBatch(item)), 'updated')
  if (view === 'PAYMENT') return sortBatches(all.filter((item) => isPaymentViewBatch(item)), 'updated')
  if (view === 'COMPLETED') return sortBatches(all.filter((item) => isCompletedViewBatch(item)), 'updated')
  return sortBatches(all.filter((item) => isHistoryBatch(item)), 'closed')
}

function getWorkbenchCounts(candidates: StatementDraft[]): BatchWorkbenchCounts {
  return {
    candidateCount: candidates.length,
    inProgressCount: getBatchesByView('IN_PROGRESS', false).length,
    paymentCount: getBatchesByView('PAYMENT', false).length,
    completedCount: getBatchesByView('COMPLETED', false).length,
    historyCount: getBatchesByView('HISTORY', false).length,
    candidateAmount: candidates.reduce((sum, item) => sum + item.netPayableAmount, 0),
  }
}

function getSelectedAmount(candidates: StatementDraft[]): number {
  return Array.from(state.selected).reduce((sum, statementId) => {
    const statement = candidates.find((item) => item.statementId === statementId)
    return sum + (statement?.netPayableAmount ?? 0)
  }, 0)
}

function getBatchLifecycleRecords(
  batch: SettlementBatch,
  approval: FeishuPaymentApproval | null,
  writeback: PaymentWriteback | null,
): BatchLifecycleRecord[] {
  const records: BatchLifecycleRecord[] = [
    {
      title: '创建预付款批次',
      time: batch.createdAt,
      detail: `${batch.createdBy} 以 ${batch.totalStatementCount} 张已确认对账单创建预付款批次。`,
    },
  ]

  if (batch.appliedForPaymentAt) {
    records.push({
      title: '已申请付款',
      time: batch.appliedForPaymentAt,
      detail: approval
        ? `已创建飞书付款审批 ${approval.approvalNo}，等待审批与付款进度同步。`
        : '已发起申请付款，等待生成飞书付款审批信息。',
    })
  }

  if (approval) {
    records.push({
      title: '飞书付款审批',
      time: approval.latestSyncedAt ?? approval.createdAt,
      detail: `${APPROVAL_STATUS_LABEL[approval.status]}，审批编号 ${approval.approvalNo}`,
    })
  }

  if (approval?.paidAt) {
    records.push({
      title: '飞书已付款',
      time: approval.paidAt,
      detail: `飞书付款审批已显示已付款，金额 ${formatAmount(approval.amount, approval.currency)}。`,
    })
  }

  if (writeback) {
    records.push({
      title: '已完成打款回写',
      time: writeback.writtenBackAt,
      detail: `已登记银行回执 ${writeback.bankReceiptName} 与银行流水 ${writeback.bankSerialNo}。`,
    })
  }

  if (batch.closedAt) {
    records.push({
      title: '批次关闭',
      time: batch.closedAt,
      detail: '预付款批次已关闭归档，保留历史查看。',
    })
  }

  return records
}

function getBatchDetailViewModel(batch: SettlementBatch): BatchDetailViewModel {
  const approval = getBatchApproval(batch)
  const writeback = getBatchWriteback(batch)
  return {
    batch,
    approval,
    writeback,
    statementCount: batch.statementIds.length,
    paidAmount: getPaidAmount(batch, approval, writeback),
    pendingAmount: getPendingAmount(batch, approval, writeback),
    writebackStatus: getWritebackStatus(batch, approval, writeback),
    lifecycleRecords: getBatchLifecycleRecords(batch, approval, writeback),
    profileVersionSummary: batch.settlementProfileVersionSummary ?? '未绑定结算资料版本',
  }
}

function getDetailBatch(): BatchDetailViewModel | null {
  if (!state.detailBatchId) return null
  const batch = initialSettlementBatches.find((item) => item.batchId === state.detailBatchId)
  if (!batch) return null
  return getBatchDetailViewModel(batch)
}

function renderWorkbenchCard(
  label: string,
  value: string,
  note: string,
  active: boolean,
  action: string,
): string {
  return `
    <article class="${toClassName(
      'rounded-lg border bg-card transition-colors',
      active ? 'border-blue-300 shadow-sm' : '',
    )}">
      <button class="flex w-full flex-col gap-1 px-4 py-4 text-left" data-batch-action="${escapeHtml(action)}">
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
      ${renderWorkbenchCard('待入预付款对账单', String(counts.candidateCount), `候选金额 ${formatAmount(counts.candidateAmount)}`, state.activeView === 'IN_PROGRESS', 'switch-view-in-progress')}
      ${renderWorkbenchCard('待申请/审批中', String(counts.inProgressCount), '已组批，等待申请付款或同步飞书状态。', state.activeView === 'IN_PROGRESS', 'switch-view-in-progress')}
      ${renderWorkbenchCard('已付款待回写', String(counts.paymentCount), '飞书已付款，等待登记银行回执与流水。', state.activeView === 'PAYMENT', 'switch-view-payment')}
      ${renderWorkbenchCard('已预付', String(counts.completedCount), '已完成打款回写，待关闭归档。', state.activeView === 'COMPLETED', 'switch-view-completed')}
      ${renderWorkbenchCard('历史', String(counts.historyCount), '已关闭的预付款批次。', state.activeView === 'HISTORY', 'switch-view-history')}
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
                <span class="ml-2 inline-flex rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">${entry.count}</span>
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
  const selectedFactoryIds = new Set(
    Array.from(state.selected)
      .map((statementId) => candidates.find((item) => item.statementId === statementId)?.settlementPartyId)
      .filter(Boolean) as string[],
  )
  const hasCrossFactorySelection = selectedFactoryIds.size > 1
  const allSelected =
    filteredPool.length > 0 && filteredPool.every((item) => state.selected.has(item.statementId))

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-medium">待入预付款对账单</h2>
          <p class="mt-1 text-sm text-muted-foreground">这里只展示已确认、已准备进入预付款的正式对账单。创建批次时会强校验同一工厂、同一币种和同一收款资料快照版本。</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <input
          class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
          data-batch-field="poolKeyword"
          placeholder="搜索对账单号/工厂/周期"
          value="${escapeHtml(state.poolKeyword)}"
        />
        <select class="h-9 w-56 rounded-md border bg-background px-3 text-sm" data-batch-field="poolParty">
          <option value="__all__" ${state.poolParty === '__all__' ? 'selected' : ''}>全部工厂</option>
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
              ${
                hasCrossFactorySelection
                  ? `<p class="mb-3 text-xs text-red-600">当前选择跨工厂，对账单创建预付款批次时会被拦截。</p>`
                  : ''
              }
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
                <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-batch-action="create-batch">创建预付款批次</button>
              </div>
            </div>
          `
          : ''
      }

      ${
        filteredPool.length === 0
          ? `<p class="py-8 text-center text-sm text-muted-foreground">暂无可纳入预付款批次的对账单</p>`
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
                    <th class="px-4 py-2 font-medium">工厂</th>
                    <th class="px-4 py-2 font-medium">结算周期</th>
                    <th class="px-4 py-2 font-medium">平台状态</th>
                    <th class="px-4 py-2 font-medium">工厂反馈</th>
                    <th class="px-4 py-2 font-medium">申诉</th>
                    <th class="px-4 py-2 font-medium">预付款说明</th>
                    <th class="px-4 py-2 text-right font-medium">条目数</th>
                    <th class="px-4 py-2 text-right font-medium">净额</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredPool
                    .map((item) => {
                      const openAppeal = getOpenStatementAppeal(item)
                      const progressView = getStatementSettlementProgressView(item)
                      const appealSummary = openAppeal
                        ? `${openAppeal.reasonName} · ${getAppealStatusLabel(openAppeal.status)}`
                        : item.appealRecords?.length
                          ? '已有历史申诉'
                          : '无申诉'
                      return `
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
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementNo ?? item.statementId)}</td>
                          <td class="px-4 py-3">${escapeHtml(item.factoryName ?? item.statementPartyView ?? item.settlementPartyId)}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementCycleLabel ?? '-')}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(STATEMENT_STATUS_LABEL[item.status])}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(getFactoryFeedbackLabel(item.factoryFeedbackStatus))}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(appealSummary)}</td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(progressView.summary)}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.netPayableAmount, getStatementCurrency(item))}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">前往对账单</button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </section>
  `
}

function renderBatchActions(batch: SettlementBatch, approval: FeishuPaymentApproval | null, writeback: PaymentWriteback | null): string {
  const actions = [
    `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-batch-action="open-detail" data-batch-id="${escapeHtml(batch.batchId)}">查看详情</button>`,
  ]

  if (canApplyPayment(batch, approval)) {
    actions.push(
      `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="apply-payment" data-batch-id="${escapeHtml(batch.batchId)}">申请付款</button>`,
    )
  } else if (canSyncApproval(approval, writeback)) {
    actions.push(
      `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="sync-approval" data-batch-id="${escapeHtml(batch.batchId)}">同步飞书状态</button>`,
    )
  } else if (canCreateWriteback(batch, approval, writeback)) {
    actions.push(
      `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="create-writeback" data-batch-id="${escapeHtml(batch.batchId)}">创建打款回写</button>`,
    )
  } else if (canCloseBatch(batch, writeback)) {
    actions.push(
      `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-batch-action="close-batch" data-batch-id="${escapeHtml(batch.batchId)}">关闭批次</button>`,
    )
  }

  return `<div class="flex flex-wrap gap-1">${actions.join('')}</div>`
}

function renderBatchRows(view: BatchWorkbenchView, items: SettlementBatch[]): string {
  if (items.length === 0) {
    const emptyText =
      view === 'IN_PROGRESS'
        ? '暂无待申请或审批中的预付款批次'
        : view === 'PAYMENT'
          ? '暂无已付款待回写的预付款批次'
          : view === 'COMPLETED'
            ? '暂无已预付批次'
            : '暂无历史预付款批次'
    return `<p class="py-10 text-center text-sm text-muted-foreground">${emptyText}</p>`
  }

  const timeLabel =
    view === 'PAYMENT' ? '最近同步' : view === 'COMPLETED' ? '预付时间' : view === 'HISTORY' ? '关闭时间' : '创建时间'

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[1180px] text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">批次号</th>
            <th class="px-4 py-2 font-medium">工厂</th>
            <th class="px-4 py-2 text-center font-medium">对账单数</th>
            <th class="px-4 py-2 font-medium">批次金额</th>
            <th class="px-4 py-2 font-medium">批次状态</th>
            <th class="px-4 py-2 font-medium">飞书付款审批</th>
            <th class="px-4 py-2 font-medium">打款回写</th>
            <th class="px-4 py-2 font-medium">${timeLabel}</th>
            <th class="px-4 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item) => {
              const approval = getBatchApproval(item)
              const writeback = getBatchWriteback(item)
              const writebackStatus = getWritebackStatus(item, approval, writeback)
              const primaryTime =
                view === 'PAYMENT'
                  ? approval?.latestSyncedAt ?? approval?.createdAt ?? item.updatedAt ?? item.createdAt
                  : view === 'COMPLETED'
                    ? item.prepaidAt ?? writeback?.writtenBackAt ?? item.updatedAt ?? item.createdAt
                    : view === 'HISTORY'
                      ? item.closedAt ?? item.updatedAt ?? item.createdAt
                      : item.createdAt

              return `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3">
                    <div class="font-mono text-xs">${escapeHtml(item.batchNo)}</div>
                    <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(item.batchName ?? item.batchNo)}</div>
                  </td>
                  <td class="px-4 py-3">
                    <div>${escapeHtml(item.factoryName)}</div>
                    <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(item.settlementCurrency)} · 版本 ${escapeHtml(item.payeeAccountSnapshotVersion)}</div>
                  </td>
                  <td class="px-4 py-3 text-center">${item.totalStatementCount}</td>
                  <td class="px-4 py-3 tabular-nums">${formatAmount(item.totalPayableAmount, item.settlementCurrency)}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${BATCH_STATUS_BADGE[item.status]}">${escapeHtml(BATCH_STATUS_LABEL[item.status])}</span>
                  </td>
                  <td class="px-4 py-3">
                    ${
                      approval
                        ? `
                          <div class="flex flex-col gap-1">
                            <span class="inline-flex w-fit rounded-md px-2 py-0.5 text-xs ${APPROVAL_STATUS_BADGE[approval.status]}">${escapeHtml(APPROVAL_STATUS_LABEL[approval.status])}</span>
                            <div class="text-[10px] text-muted-foreground">${escapeHtml(approval.approvalNo)}</div>
                          </div>
                        `
                        : '<span class="text-xs text-muted-foreground">当前未申请</span>'
                    }
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-1">
                      <span class="inline-flex w-fit rounded-md px-2 py-0.5 text-xs ${WRITEBACK_STATUS_BADGE[writebackStatus]}">${escapeHtml(WRITEBACK_STATUS_LABEL[writebackStatus])}</span>
                      <div class="text-[10px] text-muted-foreground">${escapeHtml(writeback?.bankSerialNo ?? item.paymentReferenceNo ?? '当前未登记银行流水')}</div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(primaryTime)}</td>
                  <td class="px-4 py-3">${renderBatchActions(item, approval, writeback)}</td>
                </tr>
              `
            })
            .join('')}
        </tbody>
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
            <h2 class="text-base font-medium">待申请/审批中批次</h2>
            <p class="mt-1 text-sm text-muted-foreground">查看已组批、待申请付款或飞书付款审批尚未完成的预付款批次。</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <input
              class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
              data-batch-field="batchKeyword"
              placeholder="搜索批次号/工厂/审批编号"
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
          placeholder="搜索批次号/工厂/审批编号"
          value="${escapeHtml(state.batchKeyword)}"
        />
      </div>
      ${renderBatchRows(state.activeView, items)}
    </section>
  `
}

function renderDetailDialog(detail: BatchDetailViewModel | null): string {
  if (!detail) return ''

  const primarySnapshot = getPrimarySnapshot(detail.batch)
  const statementRows = detail.batch.statementIds
    .map((statementId) => initialStatementDrafts.find((item) => item.statementId === statementId))
    .filter(Boolean) as StatementDraft[]

  const detailActions = [
    canApplyPayment(detail.batch, detail.approval)
      ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="apply-payment" data-batch-id="${escapeHtml(detail.batch.batchId)}">申请付款</button>`
      : '',
    canSyncApproval(detail.approval, detail.writeback)
      ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="sync-approval" data-batch-id="${escapeHtml(detail.batch.batchId)}">同步飞书状态</button>`
      : '',
    canCreateWriteback(detail.batch, detail.approval, detail.writeback)
      ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="create-writeback" data-batch-id="${escapeHtml(detail.batch.batchId)}">创建打款回写</button>`
      : '',
    canCloseBatch(detail.batch, detail.writeback)
      ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="close-batch" data-batch-id="${escapeHtml(detail.batch.batchId)}">关闭批次</button>`
      : '',
    `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-batch-action="close-detail">关闭</button>`,
  ]
    .filter(Boolean)
    .join('')

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-batch-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-batch-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="mb-4">
          <h3 class="text-lg font-semibold">${escapeHtml(detail.batch.batchNo)}${detail.batch.batchName ? ` · ${escapeHtml(detail.batch.batchName)}` : ''}</h3>
          <p class="mt-1 text-sm text-muted-foreground">预付款批次负责装配同一工厂已确认对账单，并承接申请付款、飞书付款审批、打款回写和关闭归档。</p>
        </header>

        <div class="grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">基本信息 / 概况</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">批次号</dt>
                <dd class="font-mono text-xs">${escapeHtml(detail.batch.batchNo)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">工厂</dt>
                <dd>${escapeHtml(detail.batch.factoryName)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">批次状态</dt>
                <dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${BATCH_STATUS_BADGE[detail.batch.status]}">${escapeHtml(BATCH_STATUS_LABEL[detail.batch.status])}</span></dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">对账单数</dt>
                <dd>${detail.statementCount}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">创建时间</dt>
                <dd>${escapeHtml(detail.batch.createdAt)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">申请付款时间</dt>
                <dd>${escapeHtml(detail.batch.appliedForPaymentAt ?? '当前未申请')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">预付时间</dt>
                <dd>${escapeHtml(detail.batch.prepaidAt ?? '当前未完成预付')}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">关闭时间</dt>
                <dd>${escapeHtml(detail.batch.closedAt ?? '当前未关闭')}</dd>
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
            <h4 class="text-sm font-medium">金额构成</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">预付总额</dt>
                <dd class="font-medium">${formatAmount(detail.batch.totalPayableAmount, detail.batch.settlementCurrency)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">任务收入合计</dt>
                <dd>${formatAmount(detail.batch.totalEarningAmount, detail.batch.settlementCurrency)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">质量扣款合计</dt>
                <dd>${formatAmount(detail.batch.totalDeductionAmount, detail.batch.settlementCurrency)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">已打款金额</dt>
                <dd>${formatAmount(detail.paidAmount, detail.batch.settlementCurrency)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">待完成回写金额</dt>
                <dd>${formatAmount(detail.pendingAmount, detail.batch.settlementCurrency)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">回写状态</dt>
                <dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${WRITEBACK_STATUS_BADGE[detail.writebackStatus]}">${escapeHtml(WRITEBACK_STATUS_LABEL[detail.writebackStatus])}</span></dd>
              </div>
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">收款账户快照</h4>
            <p class="mt-1 text-xs text-muted-foreground">预付款批次沿用对账单冻结时的收款资料快照，不会因主数据后续版本变化而漂移。</p>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">版本概况</dt>
                <dd>${escapeHtml(detail.profileVersionSummary)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">快照版本</dt>
                <dd>${escapeHtml(detail.batch.payeeAccountSnapshotVersion)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">收款账户快照 ID</dt>
                <dd class="text-right text-xs">${escapeHtml(detail.batch.payeeAccountSnapshotId)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">默认币种</dt>
                <dd>${escapeHtml(detail.batch.settlementCurrency)}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">收款账户</dt>
                <dd class="text-right text-xs">${escapeHtml(
                  primarySnapshot
                    ? `${primarySnapshot.receivingAccountSnapshot.bankName} · ${maskBankAccountNo(
                        primarySnapshot.receivingAccountSnapshot.bankAccountNo,
                      )}`
                    : '当前未绑定',
                )}</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">飞书付款审批信息</h4>
            ${
              detail.approval
                ? `
                  <dl class="mt-3 space-y-2 text-sm">
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">审批编号</dt>
                      <dd class="font-mono text-xs">${escapeHtml(detail.approval.approvalNo)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">审批状态</dt>
                      <dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${APPROVAL_STATUS_BADGE[detail.approval.status]}">${escapeHtml(APPROVAL_STATUS_LABEL[detail.approval.status])}</span></dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">创建时间</dt>
                      <dd>${escapeHtml(detail.approval.createdAt)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">最近同步</dt>
                      <dd>${escapeHtml(detail.approval.latestSyncedAt ?? detail.approval.createdAt)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">审批金额</dt>
                      <dd>${formatAmount(detail.approval.amount, detail.approval.currency)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">已付款时间</dt>
                      <dd>${escapeHtml(detail.approval.paidAt ?? '当前未付款')}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">付款回执</dt>
                      <dd class="text-right text-xs">${escapeHtml(detail.approval.bankReceiptName ?? '当前未返回')}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">银行流水</dt>
                      <dd class="text-right text-xs">${escapeHtml(detail.approval.bankSerialNo ?? '当前未返回')}</dd>
                    </div>
                  </dl>
                `
                : `<p class="mt-3 text-sm text-muted-foreground">当前未创建飞书付款审批。申请付款后会在这里显示审批编号、审批状态与最近同步时间。</p>`
            }
          </section>

          <section class="rounded-lg border bg-card p-4 md:col-span-2">
            <h4 class="text-sm font-medium">已选对账单列表</h4>
            <div class="mt-3 overflow-x-auto rounded-md border">
              <table class="w-full min-w-[980px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">工厂</th>
                    <th class="px-4 py-2 font-medium">结算周期</th>
                    <th class="px-4 py-2 font-medium">平台状态</th>
                    <th class="px-4 py-2 font-medium">工厂反馈</th>
                    <th class="px-4 py-2 font-medium">申诉</th>
                    <th class="px-4 py-2 font-medium">处理结果</th>
                    <th class="px-4 py-2 font-medium">预付款说明</th>
                    <th class="px-4 py-2 font-medium">金额</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${statementRows
                    .map((statement) => {
                      const openAppeal = getOpenStatementAppeal(statement)
                      const appealLabel = openAppeal
                        ? getAppealStatusLabel(openAppeal.status)
                        : statement.appealRecords?.length
                          ? '已有历史申诉'
                          : '无申诉'
                      const progressView = getStatementSettlementProgressView(statement)
                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(statement.statementNo ?? statement.statementId)}</td>
                          <td class="px-4 py-3">${escapeHtml(statement.factoryName ?? statement.statementPartyView ?? statement.settlementPartyId)}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(statement.settlementCycleLabel ?? '-')}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(STATEMENT_STATUS_LABEL[statement.status])}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(appealLabel)}</td>
                          <td class="px-4 py-3 text-xs">${escapeHtml(getResolutionResultLabel(statement.resolutionResult))}</td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(statement.prepaymentBatchNo ?? progressView.summary)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatAmount(statement.netPayableAmount, getStatementCurrency(statement))}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/settlement/statements">前往对账单</button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">打款回写信息</h4>
            ${
              detail.writeback
                ? `
                  <dl class="mt-3 space-y-2 text-sm">
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">回写单号</dt>
                      <dd class="font-mono text-xs">${escapeHtml(detail.writeback.writebackId)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">关联审批编号</dt>
                      <dd class="text-right text-xs">${escapeHtml(detail.writeback.approvalNo)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">打款金额</dt>
                      <dd>${formatAmount(detail.writeback.amount, detail.writeback.currency)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">打款时间</dt>
                      <dd>${escapeHtml(detail.writeback.paidAt)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">银行回执</dt>
                      <dd class="text-right text-xs">${escapeHtml(detail.writeback.bankReceiptName)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">银行流水号</dt>
                      <dd class="text-right text-xs">${escapeHtml(detail.writeback.bankSerialNo)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">回写时间</dt>
                      <dd>${escapeHtml(detail.writeback.writtenBackAt)}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <dt class="text-muted-foreground">回写人</dt>
                      <dd>${escapeHtml(detail.writeback.writtenBackBy)}</dd>
                    </div>
                  </dl>
                `
                : `<p class="mt-3 text-sm text-muted-foreground">${
                    detail.approval?.status === 'PAID'
                      ? '飞书付款审批已到已付款状态，当前待创建正式打款回写。'
                      : '当前尚未生成打款回写。'
                  }</p>`
            }
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-medium">状态流转区</h4>
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
          ${detailActions}
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
        <h1 class="text-xl font-semibold">预付款批次</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
      </section>

      ${renderStatsSection(counts)}
      ${renderViewSwitcher(counts)}
      ${renderCurrentViewList()}
      ${renderDetailDialog(detailBatch)}
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

    const result = createPrepaymentBatch({
      statementIds: Array.from(state.selected),
      batchName: state.batchName.trim() || undefined,
      remark: state.remark.trim() || undefined,
      by: '财务A',
    })

    if (!result.ok || !result.data) {
      showBatchesToast(result.message ?? '创建预付款批次失败', 'error')
      return true
    }

    showBatchesToast(`已创建预付款批次 ${result.data.batchNo}`)
    state.selected = new Set<string>()
    state.batchName = ''
    state.remark = ''
    state.detailBatchId = result.data.batchId
    appStore.navigate(buildBatchesHref('IN_PROGRESS'))
    return true
  }

  if (action === 'apply-payment') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = applyPrepaymentBatchForPayment({ batchId, by: '财务A' })
    if (!result.ok || !result.data) {
      showBatchesToast(result.message ?? '申请付款失败', 'error')
      return true
    }
    showBatchesToast(`已创建飞书付款审批 ${result.data.approvalNo}`)
    state.detailBatchId = batchId
    appStore.navigate(buildBatchesHref('IN_PROGRESS'))
    return true
  }

  if (action === 'sync-approval') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const batch = initialSettlementBatches.find((item) => item.batchId === batchId)
    if (!batch?.feishuApprovalId) {
      showBatchesToast('当前批次尚未创建飞书付款审批', 'error')
      return true
    }
    const result = syncFeishuPaymentApprovalStatus({
      approvalId: batch.feishuApprovalId,
      by: '财务共享',
    })
    if (!result.ok || !result.data) {
      showBatchesToast(result.message ?? '同步飞书状态失败', 'error')
      return true
    }
    showBatchesToast(`飞书付款审批已同步为${APPROVAL_STATUS_LABEL[result.data.status]}`)
    state.detailBatchId = batchId
    const updatedBatch = initialSettlementBatches.find((item) => item.batchId === batchId)
    if (updatedBatch?.status === 'FEISHU_PAID_PENDING_WRITEBACK') {
      appStore.navigate(buildBatchesHref('PAYMENT'))
    } else {
      appStore.navigate(buildBatchesHref('IN_PROGRESS'))
    }
    return true
  }

  if (action === 'create-writeback') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = createPaymentWriteback({
      batchId,
      by: '财务A',
    })
    if (!result.ok || !result.data) {
      showBatchesToast(result.message ?? '创建打款回写失败', 'error')
      return true
    }
    showBatchesToast(`已完成打款回写，银行流水 ${result.data.bankSerialNo}`)
    state.detailBatchId = batchId
    appStore.navigate(buildBatchesHref('COMPLETED'))
    return true
  }

  if (action === 'close-batch') {
    const batchId = actionNode.dataset.batchId
    if (!batchId) return true
    const result = closePrepaymentBatch({ batchId, by: '财务A' })
    if (!result.ok) {
      showBatchesToast(result.message ?? '关闭批次失败', 'error')
      return true
    }
    showBatchesToast('预付款批次已关闭')
    state.detailBatchId = batchId
    appStore.navigate(buildBatchesHref('HISTORY'))
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

  return true
}

export function isBatchesDialogOpen(): boolean {
  return state.detailBatchId !== null
}
