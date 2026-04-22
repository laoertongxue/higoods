import { appStore } from '../state/store'
import { renderPdaFrame } from './pda-shell'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import {
  getFutureMobileFactoryQcSummary,
  listFutureMobileFactoryQcBuckets,
  listFutureMobileFactorySoonOverdueQcItems,
  type FutureMobileFactoryQcListItem,
} from '../data/fcs/quality-deduction-selectors'
import {
  getPreSettlementLedgerById,
  listPreSettlementLedgers,
  tracePreSettlementLedgerSource,
} from '../data/fcs/pre-settlement-ledger-repository'
import {
  createSettlementChangeRequest,
  getSettlementActiveRequestByFactory,
  getSettlementEffectiveInfoByFactory,
  getSettlementLatestRequestByFactory,
  getSettlementStatusClass,
  getSettlementStatusLabel,
  getSettlementVersionHistory,
  listSettlementRequestsByFactory,
  type SettlementChangeRequest,
  type SettlementEffectiveInfo,
  type SettlementEffectiveInfoSnapshot,
  type SettlementVersionRecord,
} from '../data/fcs/settlement-change-requests'
import {
  getPrepaymentBatchById,
  getStatementDraftById,
  getStatementSettlementProgressView,
  listFeishuPaymentApprovals,
  listPaymentWritebacks,
  listSettlementBatchesByParty,
  listSettlementBatchesByStatement,
  listSettlementStatementsByParty,
  submitStatementFactoryAppeal,
  submitStatementFactoryConfirmation,
} from '../data/fcs/store-domain-settlement-seeds'
import { deriveSettlementCycleFields } from '../data/fcs/store-domain-statement-grain'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import { escapeHtml, formatDateTime, toClassName } from '../utils'
import {
  ensurePdaSessionForAction,
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'
import type {
  FactoryFeedbackStatus,
  FeishuPaymentApproval,
  FeishuPaymentApprovalStatus,
  PaymentWriteback,
  PreSettlementLedger,
  PreSettlementLedgerPriceSourceType,
  PreSettlementLedgerStatus,
  PrepaymentBatchStatus,
  SettlementBatch,
  StatementAppealRecord,
  StatementDraft,
  StatementDraftItem,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'

applyQualitySeedBootstrap()

type SettlementPageMode = 'cycles' | 'cycle-detail'
type DetailTab = 'overview' | 'quality' | 'ledgers' | 'statements'
type QualityView = 'pending' | 'soon' | 'disputing' | 'processed' | 'history'
type LedgerTypeView = 'all' | 'task-earning' | 'quality-deduction'
type LedgerStatusView = 'all' | 'open' | 'in-statement' | 'in-prepayment-batch' | 'prepaid'

interface StatementAppealForm {
  reason: string
  description: string
  evidenceSummary: string
}

interface PdaSettlementState {
  lastRouteSyncKey: string
  pageMode: SettlementPageMode
  selectedCycleId: string | null
  detailTab: DetailTab
  qualityView: QualityView
  qualitySearch: string
  ledgerTypeView: LedgerTypeView
  ledgerStatusView: LedgerStatusView
  ledgerKeyword: string
  ledgerDrawerId: string | null
  settlementRequestDrawerMode: 'create' | 'detail' | 'profile' | 'history' | 'versions' | null
  settlementRequestDetailId: string | null
  settlementRequestErrors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>>
  settlementRequestErrorText: string
  settlementRequestForm: SettlementEffectiveInfoSnapshot & { submitRemark: string }
  statementDrawerMode: 'detail' | 'appeal' | 'payment' | null
  statementDetailId: string | null
  statementErrorText: string
  statementAppealForm: StatementAppealForm
}

interface FactoryContext {
  factoryId: string
  factoryCode: string
  factoryName: string
  settlementPartyId: string
  operatorName: string
}

interface SettlementCycleSummary {
  cycleId: string
  cycleLabel: string
  cycleStartAt: string
  cycleEndAt: string
  ledgers: PreSettlementLedger[]
  taskLedgers: PreSettlementLedger[]
  qualityLedgers: PreSettlementLedger[]
  statements: StatementDraft[]
  batches: SettlementBatch[]
  pendingQualityItems: FutureMobileFactoryQcListItem[]
  soonQualityItems: FutureMobileFactoryQcListItem[]
  disputingQualityItems: FutureMobileFactoryQcListItem[]
  processedQualityItems: FutureMobileFactoryQcListItem[]
  historyQualityItems: FutureMobileFactoryQcListItem[]
  taskEarningAmount: number
  qualityDeductionAmount: number
  netPayableAmount: number
  pendingQualityCount: number
  soonOverdueCount: number
  disputingCount: number
  hasPendingOrDisputing: boolean
  primaryStatement: StatementDraft | null
  primaryBatch: SettlementBatch | null
  latestApproval: FeishuPaymentApproval | null
  latestWriteback: PaymentWriteback | null
  currentEffectiveVersionNo?: string
  statementSnapshotVersionNo?: string
  batchSnapshotVersionNo?: string
  hasSnapshotVersionDiff: boolean
  snapshotDifferenceNote?: string
}

interface SettlementLedgerDetailViewModel {
  ledger: PreSettlementLedger
  statement: StatementDraft | null
  batch: SettlementBatch | null
  approval: FeishuPaymentApproval | null
  writeback: PaymentWriteback | null
  trace: ReturnType<typeof tracePreSettlementLedgerSource>
}

const FX_RATE_TABLE: Record<string, { rate: number; appliedAt: string }> = {
  'CNY->IDR': { rate: 2175, appliedAt: '2026-03-12 10:00:00' },
  'IDR->CNY': { rate: 0.00046, appliedAt: '2026-03-12 10:00:00' },
}

const state: PdaSettlementState = {
  lastRouteSyncKey: '',
  pageMode: 'cycles',
  selectedCycleId: null,
  detailTab: 'overview',
  qualityView: 'pending',
  qualitySearch: '',
  ledgerTypeView: 'all',
  ledgerStatusView: 'all',
  ledgerKeyword: '',
  ledgerDrawerId: null,
  settlementRequestDrawerMode: null,
  settlementRequestDetailId: null,
  settlementRequestErrors: {},
  settlementRequestErrorText: '',
  settlementRequestForm: {
    accountHolderName: '',
    idNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankBranch: '',
    submitRemark: '',
  },
  statementDrawerMode: null,
  statementDetailId: null,
  statementErrorText: '',
  statementAppealForm: {
    reason: '',
    description: '',
    evidenceSummary: '',
  },
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value?: string): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function getCurrentSettlementSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function getCurrentFactoryContext(): FactoryContext {
  const runtime = getPdaRuntimeContext()
  const currentFactoryId = runtime?.factoryId || ''
  const matchedFactory =
    indonesiaFactories.find((item) => item.id === currentFactoryId || item.code === currentFactoryId) ??
    indonesiaFactories[0]

  const operatorName = runtime?.userName || '工厂处理人'

  return {
    factoryId: matchedFactory.id,
    factoryCode: matchedFactory.code,
    factoryName: matchedFactory.name,
    settlementPartyId: matchedFactory.id,
    operatorName,
  }
}

function getCurrentEffectiveSettlementInfo(factoryCode: string): SettlementEffectiveInfo | null {
  return getSettlementEffectiveInfoByFactory(factoryCode)
}

function formatAmount(amount: number, currency = 'IDR'): string {
  return `${amount.toLocaleString('zh-CN')} ${currency}`
}

function getConvertedCurrencyDisplay(input: {
  amount: number
  originalCurrency: string
  settlementCurrency: string
  referenceAt?: string
}): {
  settlementAmount: number
  settlementAmountLabel: string
  originalAmountLabel: string
  fxRate: number
  fxAppliedAt: string
  isConverted: boolean
  rateLabel: string
} {
  const { amount, originalCurrency, settlementCurrency, referenceAt } = input
  if (originalCurrency === settlementCurrency) {
    return {
      settlementAmount: amount,
      settlementAmountLabel: formatAmount(amount, settlementCurrency),
      originalAmountLabel: formatAmount(amount, originalCurrency),
      fxRate: 1,
      fxAppliedAt: referenceAt || '—',
      isConverted: false,
      rateLabel: `1 ${originalCurrency} = 1 ${settlementCurrency}`,
    }
  }

  const fx = FX_RATE_TABLE[`${originalCurrency}->${settlementCurrency}`] ?? {
    rate: 1,
    appliedAt: referenceAt || '—',
  }
  const settlementAmount = Number((amount * fx.rate).toFixed(2))
  return {
    settlementAmount,
    settlementAmountLabel: formatAmount(settlementAmount, settlementCurrency),
    originalAmountLabel: formatAmount(amount, originalCurrency),
    fxRate: fx.rate,
    fxAppliedAt: fx.appliedAt,
    isConverted: true,
    rateLabel: `1 ${originalCurrency} = ${formatAmount(fx.rate, settlementCurrency)}`,
  }
}

function formatAmountWithSettlement(input: {
  amount: number
  originalCurrency: string
  settlementCurrency: string
  referenceAt?: string
}): string {
  const display = getConvertedCurrencyDisplay(input)
  if (!display.isConverted) return display.settlementAmountLabel
  return `${display.settlementAmountLabel}（原 ${display.originalAmountLabel} · ${display.rateLabel} · ${formatDateTime(display.fxAppliedAt)}）`
}

function getBadgeClass(kind: 'blue' | 'amber' | 'red' | 'green' | 'gray' | 'purple'): string {
  switch (kind) {
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'green':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'purple':
      return 'border-purple-200 bg-purple-50 text-purple-700'
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-700'
  }
}

function renderStatusBadge(text: string, variant: 'blue' | 'amber' | 'red' | 'green' | 'gray' | 'purple'): string {
  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${getBadgeClass(variant)}">${escapeHtml(text)}</span>`
}

function renderRow(
  label: string,
  value: string,
  opts: { bold?: boolean; red?: boolean; green?: boolean; orange?: boolean } = {},
): string {
  return `
    <div class="flex items-center justify-between gap-3 py-0.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <span class="${toClassName(
        'text-xs text-right tabular-nums',
        opts.bold ? 'font-semibold text-foreground' : 'text-foreground',
        opts.red ? 'text-red-600' : '',
        opts.green ? 'text-emerald-700' : '',
        opts.orange ? 'text-amber-700' : '',
      )}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderCard(title: string, body: string, className = ''): string {
  return `
    <section class="${toClassName('rounded-lg border bg-card shadow-none', className)}">
      <header class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </header>
      <div class="space-y-2 px-4 py-3">${body}</div>
    </section>
  `
}

function renderDrawer(title: string, body: string, closeAction: string): string {
  return `
    <div class="fixed inset-0 z-50 flex flex-col bg-background">
      <div class="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <button class="rounded p-1 hover:bg-muted" data-pda-sett-action="${closeAction}">
          <i data-lucide="x" class="h-5 w-5"></i>
        </button>
        <h2 class="flex-1 truncate text-sm font-semibold">${escapeHtml(title)}</h2>
      </div>
      <div class="flex-1 space-y-4 overflow-y-auto p-4">${body}</div>
    </div>
  `
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getRemainingDeadlineSummary(deadline?: string): string {
  const deadlineMs = parseDateMs(deadline)
  if (!deadlineMs) return '无需响应'
  const diff = deadlineMs - Date.now()
  if (diff <= 0) return '已超时'
  const hours = Math.ceil(diff / (3600 * 1000))
  if (hours < 24) return `剩余 ${hours} 小时`
  const days = Math.floor(hours / 24)
  return `剩余 ${days} 天 ${hours % 24} 小时`
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function getStatementStatusLabel(status: StatementStatus): string {
  if (status === 'DRAFT') return '草稿中'
  if (status === 'PENDING_FACTORY_CONFIRM') return '待工厂确认'
  if (status === 'FACTORY_CONFIRMED') return '工厂已确认'
  if (status === 'READY_FOR_PREPAYMENT') return '待入预付款'
  if (status === 'IN_PREPAYMENT_BATCH') return '已入预付款批次'
  if (status === 'PREPAID') return '已预付'
  return '已关闭'
}

function getStatementStatusVariant(status: StatementStatus): 'blue' | 'amber' | 'green' | 'gray' {
  if (status === 'DRAFT') return 'amber'
  if (status === 'PENDING_FACTORY_CONFIRM') return 'blue'
  if (status === 'FACTORY_CONFIRMED' || status === 'READY_FOR_PREPAYMENT' || status === 'PREPAID') return 'green'
  if (status === 'IN_PREPAYMENT_BATCH') return 'blue'
  return 'gray'
}

function getFactoryFeedbackLabel(status: FactoryFeedbackStatus): string {
  if (status === 'NOT_SENT') return '未下发'
  if (status === 'PENDING_FACTORY_CONFIRM') return '待工厂反馈'
  if (status === 'FACTORY_CONFIRMED') return '工厂已确认'
  if (status === 'FACTORY_APPEALED') return '工厂已申诉'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理完成'
}

function getFactoryFeedbackVariant(status: FactoryFeedbackStatus): 'blue' | 'amber' | 'red' | 'green' | 'gray' {
  if (status === 'PENDING_FACTORY_CONFIRM') return 'amber'
  if (status === 'FACTORY_CONFIRMED') return 'green'
  if (status === 'FACTORY_APPEALED') return 'red'
  if (status === 'PLATFORM_HANDLING') return 'blue'
  return 'gray'
}

function getLedgerTypeLabel(type: PreSettlementLedger['ledgerType']): string {
  return type === 'TASK_EARNING' ? '任务收入流水' : '质量扣款流水'
}

function getLedgerStatusLabel(status: PreSettlementLedgerStatus): string {
  if (status === 'OPEN') return '待入对账单'
  if (status === 'IN_STATEMENT') return '已入对账单'
  if (status === 'IN_PREPAYMENT_BATCH') return '已入预付款批次'
  if (status === 'PREPAID') return '已预付'
  return '预留后续最终分账'
}

function getLedgerStatusVariant(status: PreSettlementLedgerStatus): 'blue' | 'amber' | 'green' | 'gray' | 'purple' {
  if (status === 'OPEN') return 'amber'
  if (status === 'IN_STATEMENT') return 'blue'
  if (status === 'IN_PREPAYMENT_BATCH') return 'purple'
  if (status === 'PREPAID') return 'green'
  return 'gray'
}

function getLedgerPriceSourceLabel(type?: PreSettlementLedgerPriceSourceType): string {
  if (type === 'DISPATCH') return '派单价'
  if (type === 'BID') return '中标价'
  return '兼容口径'
}

function getPrepaymentBatchStatusLabel(status: PrepaymentBatchStatus): string {
  if (status === 'DRAFT') return '草稿'
  if (status === 'READY_TO_APPLY_PAYMENT') return '待申请付款'
  if (status === 'FEISHU_APPROVAL_CREATED') return '已提交飞书付款审批'
  if (status === 'FEISHU_PAID_PENDING_WRITEBACK') return '飞书已付款待回写'
  if (status === 'PREPAID') return '已预付'
  if (status === 'CLOSED') return '已关闭'
  if (status === 'FEISHU_APPROVAL_REJECTED') return '审批已驳回'
  return '审批已取消'
}

function getPrepaymentBatchStatusVariant(status: PrepaymentBatchStatus): 'blue' | 'amber' | 'green' | 'gray' | 'purple' | 'red' {
  if (status === 'DRAFT' || status === 'READY_TO_APPLY_PAYMENT') return 'amber'
  if (status === 'FEISHU_APPROVAL_CREATED') return 'blue'
  if (status === 'FEISHU_PAID_PENDING_WRITEBACK') return 'purple'
  if (status === 'PREPAID' || status === 'CLOSED') return 'green'
  if (status === 'FEISHU_APPROVAL_REJECTED') return 'red'
  return 'gray'
}

function getFeishuStatusLabel(status: FeishuPaymentApprovalStatus): string {
  if (status === 'CREATED') return '已创建'
  if (status === 'APPROVING') return '审批中'
  if (status === 'APPROVED_PENDING_PAYMENT') return '审批通过待付款'
  if (status === 'PAID') return '已付款'
  if (status === 'REJECTED') return '已驳回'
  return '已取消'
}

function getFeishuStatusVariant(status: FeishuPaymentApprovalStatus): 'blue' | 'amber' | 'green' | 'gray' | 'purple' | 'red' {
  if (status === 'CREATED' || status === 'APPROVING' || status === 'APPROVED_PENDING_PAYMENT') return 'blue'
  if (status === 'PAID') return 'green'
  if (status === 'REJECTED') return 'red'
  return 'gray'
}

function getQualityResponseVariant(label: string): 'blue' | 'amber' | 'red' | 'green' | 'gray' {
  if (label.includes('待工厂处理')) return 'amber'
  if (label.includes('自动确认')) return 'blue'
  if (label.includes('已确认')) return 'green'
  if (label.includes('异议')) return 'red'
  return 'gray'
}

function getQualityDisputeVariant(label: string): 'blue' | 'amber' | 'red' | 'green' | 'gray' | 'purple' {
  if (label.includes('待平台处理') || label.includes('平台处理中') || label.includes('异议')) return 'amber'
  if (label.includes('最终维持工厂责任')) return 'red'
  if (label.includes('最终部分工厂责任')) return 'blue'
  if (label.includes('最终非工厂责任')) return 'purple'
  if (label.includes('已关闭') || label.includes('无异议')) return 'gray'
  return 'gray'
}

function getQualitySettlementVariant(label: string): 'blue' | 'amber' | 'green' | 'gray' | 'purple' {
  if (label.includes('正式质量扣款流水') || label.includes('预结算单')) return 'blue'
  if (label.includes('预付款批次') || label.includes('已预付')) return 'purple'
  if (label.includes('待确认') || label.includes('待平台处理')) return 'amber'
  if (label.includes('已生成正式质量扣款流水')) return 'green'
  return 'gray'
}

function getQualityCycleCollections(factoryId: string) {
  const buckets = listFutureMobileFactoryQcBuckets(factoryId)
  const soonItems = listFutureMobileFactorySoonOverdueQcItems(factoryId)
  const grouped = {
    pending: new Map<string, FutureMobileFactoryQcListItem[]>(),
    soon: new Map<string, FutureMobileFactoryQcListItem[]>(),
    disputing: new Map<string, FutureMobileFactoryQcListItem[]>(),
    processed: new Map<string, FutureMobileFactoryQcListItem[]>(),
    history: new Map<string, FutureMobileFactoryQcListItem[]>(),
  }

  const push = (view: keyof typeof grouped, item: FutureMobileFactoryQcListItem) => {
    const cycleId = deriveSettlementCycleFields(factoryId, item.inspectedAt).settlementCycleId
    const current = grouped[view].get(cycleId) ?? []
    current.push(item)
    grouped[view].set(cycleId, current)
  }

  buckets.pending.forEach((item) => push('pending', item))
  soonItems.forEach((item) => push('soon', item))
  buckets.disputing.forEach((item) => push('disputing', item))
  buckets.processed.forEach((item) => push('processed', item))
  buckets.history.forEach((item) => push('history', item))

  return grouped
}

function sortByDateDesc<T>(items: T[], selector: (item: T) => string | undefined): T[] {
  return items.slice().sort((left, right) => parseDateMs(selector(right)) - parseDateMs(selector(left)))
}

function getBatchApproval(batch: SettlementBatch | null): FeishuPaymentApproval | null {
  if (!batch) return null
  return sortByDateDesc(listFeishuPaymentApprovals(batch.batchId), (item) => item.latestSyncedAt ?? item.createdAt)[0] ?? null
}

function getBatchWriteback(batch: SettlementBatch | null): PaymentWriteback | null {
  if (!batch) return null
  return sortByDateDesc(listPaymentWritebacks(batch.batchId), (item) => item.writtenBackAt)[0] ?? null
}

function joinVersionText(values: Array<string | undefined>): string | undefined {
  const unique = dedupeStrings(values)
  if (unique.length === 0) return undefined
  return unique.join(' / ')
}

function buildSnapshotDifferenceNote(input: {
  effectiveVersionNo?: string
  statementSnapshotVersionNo?: string
  batchSnapshotVersionNo?: string
}): string | undefined {
  const { effectiveVersionNo, statementSnapshotVersionNo, batchSnapshotVersionNo } = input
  if (!effectiveVersionNo) return undefined
  const different = [statementSnapshotVersionNo, batchSnapshotVersionNo].some(
    (value) => value && value !== effectiveVersionNo,
  )
  if (!different) return undefined
  return `当前生效：${effectiveVersionNo}；单据使用：${statementSnapshotVersionNo ?? batchSnapshotVersionNo ?? '—'}。新版本用于后续新单据，本周期已生成单据继续沿用原快照。`
}

function getSettlementCycleSummaries(factory: FactoryContext): SettlementCycleSummary[] {
  const ledgers = listPreSettlementLedgers({ factoryId: factory.factoryId })
  const statements = listSettlementStatementsByParty(factory.settlementPartyId)
  const batches = listSettlementBatchesByParty(factory.settlementPartyId)
  const effectiveInfo = getCurrentEffectiveSettlementInfo(factory.factoryCode)
  const qualityCollections = getQualityCycleCollections(factory.factoryId)
  const cycleMap = new Map<string, SettlementCycleSummary>()

  const ensureCycle = (cycleId: string, cycleLabel: string, startAt: string, endAt: string): SettlementCycleSummary => {
    const existing = cycleMap.get(cycleId)
    if (existing) return existing
    const summary: SettlementCycleSummary = {
      cycleId,
      cycleLabel,
      cycleStartAt: startAt,
      cycleEndAt: endAt,
      ledgers: [],
      taskLedgers: [],
      qualityLedgers: [],
      statements: [],
      batches: [],
      pendingQualityItems: [],
      soonQualityItems: [],
      disputingQualityItems: [],
      processedQualityItems: [],
      historyQualityItems: [],
      taskEarningAmount: 0,
      qualityDeductionAmount: 0,
      netPayableAmount: 0,
      pendingQualityCount: 0,
      soonOverdueCount: 0,
      disputingCount: 0,
      hasPendingOrDisputing: false,
      primaryStatement: null,
      primaryBatch: null,
      latestApproval: null,
      latestWriteback: null,
      currentEffectiveVersionNo: effectiveInfo?.versionNo,
      hasSnapshotVersionDiff: false,
    }
    cycleMap.set(cycleId, summary)
    return summary
  }

  ledgers.forEach((ledger) => {
    const summary = ensureCycle(
      ledger.settlementCycleId,
      ledger.settlementCycleLabel,
      ledger.settlementCycleStartAt,
      ledger.settlementCycleEndAt,
    )
    summary.ledgers.push(ledger)
    if (ledger.ledgerType === 'TASK_EARNING') summary.taskLedgers.push(ledger)
    if (ledger.ledgerType === 'QUALITY_DEDUCTION') summary.qualityLedgers.push(ledger)
  })

  statements.forEach((statement) => {
    const cycle = deriveSettlementCycleFields(factory.factoryId, statement.createdAt)
    const summary = ensureCycle(
      statement.settlementCycleId || cycle.settlementCycleId,
      statement.settlementCycleLabel || cycle.settlementCycleLabel,
      statement.settlementCycleStartAt || cycle.settlementCycleStartAt,
      statement.settlementCycleEndAt || cycle.settlementCycleEndAt,
    )
    summary.statements.push(statement)
  })

  batches.forEach((batch) => {
    batch.items.forEach((item) => {
      if (!item.settlementCycleId || !item.settlementCycleLabel) return
      const summary = ensureCycle(
        item.settlementCycleId,
        item.settlementCycleLabel,
        item.settlementCycleLabel.slice(-23, -13) || '',
        item.settlementCycleLabel.slice(-10) || '',
      )
      if (!summary.batches.some((current) => current.batchId === batch.batchId)) {
        summary.batches.push(batch)
      }
    })
  })

  const attachQualityItems = (view: keyof ReturnType<typeof getQualityCycleCollections>, targetKey: keyof SettlementCycleSummary) => {
    for (const [cycleId, items] of qualityCollections[view].entries()) {
      const cycle = deriveSettlementCycleFields(factory.factoryId, items[0]?.inspectedAt)
      const summary = ensureCycle(
        cycleId,
        cycle.settlementCycleLabel,
        cycle.settlementCycleStartAt,
        cycle.settlementCycleEndAt,
      )
      ;(summary[targetKey] as FutureMobileFactoryQcListItem[]).push(...items)
    }
  }

  attachQualityItems('pending', 'pendingQualityItems')
  attachQualityItems('soon', 'soonQualityItems')
  attachQualityItems('disputing', 'disputingQualityItems')
  attachQualityItems('processed', 'processedQualityItems')
  attachQualityItems('history', 'historyQualityItems')

  return Array.from(cycleMap.values())
    .map((summary) => {
      summary.ledgers = sortByDateDesc(summary.ledgers, (item) => item.occurredAt)
      summary.taskLedgers = summary.ledgers.filter((item) => item.ledgerType === 'TASK_EARNING')
      summary.qualityLedgers = summary.ledgers.filter((item) => item.ledgerType === 'QUALITY_DEDUCTION')
      summary.statements = sortByDateDesc(summary.statements, (item) => item.createdAt)
      summary.batches = sortByDateDesc(summary.batches, (item) => item.prepaidAt ?? item.updatedAt ?? item.createdAt)
      summary.pendingQualityItems = sortByDateDesc(summary.pendingQualityItems, (item) => item.responseDeadlineAt ?? item.inspectedAt)
      summary.soonQualityItems = sortByDateDesc(summary.soonQualityItems, (item) => item.responseDeadlineAt ?? item.inspectedAt)
      summary.disputingQualityItems = sortByDateDesc(summary.disputingQualityItems, (item) => item.resultWrittenBackAt ?? item.inspectedAt)
      summary.processedQualityItems = sortByDateDesc(summary.processedQualityItems, (item) => item.respondedAt ?? item.autoConfirmedAt ?? item.inspectedAt)
      summary.historyQualityItems = sortByDateDesc(summary.historyQualityItems, (item) => item.resultWrittenBackAt ?? item.inspectedAt)
      summary.taskEarningAmount = summary.taskLedgers.reduce((sum, item) => sum + item.settlementAmount, 0)
      summary.qualityDeductionAmount = summary.qualityLedgers.reduce((sum, item) => sum + item.settlementAmount, 0)
      summary.netPayableAmount = summary.taskEarningAmount - summary.qualityDeductionAmount
      summary.pendingQualityCount = summary.pendingQualityItems.length
      summary.soonOverdueCount = summary.soonQualityItems.length
      summary.disputingCount = summary.disputingQualityItems.length
      summary.hasPendingOrDisputing = summary.pendingQualityCount > 0 || summary.disputingCount > 0
      summary.primaryStatement = summary.statements[0] ?? null
      summary.primaryBatch = summary.batches[0] ?? null
      summary.latestApproval = getBatchApproval(summary.primaryBatch)
      summary.latestWriteback = getBatchWriteback(summary.primaryBatch)
      summary.statementSnapshotVersionNo = joinVersionText(summary.statements.map((item) => item.settlementProfileVersionNo))
      summary.batchSnapshotVersionNo = joinVersionText(
        summary.batches.flatMap((item) => [item.payeeAccountSnapshotVersion, item.settlementProfileVersionSummary]),
      )
      summary.snapshotDifferenceNote = buildSnapshotDifferenceNote({
        effectiveVersionNo: summary.currentEffectiveVersionNo,
        statementSnapshotVersionNo: summary.statementSnapshotVersionNo,
        batchSnapshotVersionNo: summary.batchSnapshotVersionNo,
      })
      summary.hasSnapshotVersionDiff = Boolean(summary.snapshotDifferenceNote)
      return summary
    })
    .sort((left, right) => {
      if (left.cycleEndAt !== right.cycleEndAt) return left.cycleEndAt < right.cycleEndAt ? 1 : -1
      return left.cycleId.localeCompare(right.cycleId, 'zh-CN')
    })
}

function getDefaultSettlementCycleId(): string {
  const context = getCurrentFactoryContext()
  return getSettlementCycleSummaries(context)[0]?.cycleId ?? ''
}

function resolveSettlementCycleId(candidate?: string | null): string {
  const context = getCurrentFactoryContext()
  const summaries = getSettlementCycleSummaries(context)
  if (candidate && summaries.some((item) => item.cycleId === candidate)) return candidate
  return summaries[0]?.cycleId ?? ''
}

function buildSettlementListHref(): string {
  return '/fcs/pda/settlement'
}

function buildSettlementDetailHref(
  detailTab: DetailTab = state.detailTab,
  cycleId: string = resolveSettlementCycleId(state.selectedCycleId),
  options?: {
    qualityView?: QualityView
    ledgerTypeView?: LedgerTypeView
    ledgerStatusView?: LedgerStatusView
  },
): string {
  const params = new URLSearchParams()
  params.set('tab', detailTab)
  if (cycleId) params.set('cycleId', resolveSettlementCycleId(cycleId))
  if (detailTab === 'quality' && options?.qualityView) params.set('view', options.qualityView)
  if (detailTab === 'ledgers' && options?.ledgerTypeView && options.ledgerTypeView !== 'all') {
    params.set('ledgerType', options.ledgerTypeView)
  }
  if (detailTab === 'ledgers' && options?.ledgerStatusView && options.ledgerStatusView !== 'all') {
    params.set('ledgerStatus', options.ledgerStatusView)
  }
  return `${buildSettlementListHref()}?${params.toString()}`
}

function syncSettlementStateFromRoute(): void {
  const routeKey = appStore.getState().pathname
  if (state.lastRouteSyncKey === routeKey) return

  const params = getCurrentSettlementSearchParams()
  const rawTab = params.get('tab')
  const cycleId = params.get('cycleId')

  if (rawTab === 'cycles' || (!rawTab && !cycleId)) {
    state.pageMode = 'cycles'
    state.selectedCycleId = null
  } else {
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = resolveSettlementCycleId(cycleId)
    if (rawTab === 'tasks') {
      state.detailTab = 'ledgers'
      state.ledgerTypeView = 'task-earning'
    } else if (rawTab === 'deductions') {
      state.detailTab = 'ledgers'
      state.ledgerTypeView = 'quality-deduction'
    } else if (rawTab === 'quality' || rawTab === 'ledgers' || rawTab === 'statements') {
      state.detailTab = rawTab
    } else {
      state.detailTab = 'overview'
    }
  }

  const qualityView = params.get('view')
  if (qualityView && ['pending', 'soon', 'disputing', 'processed', 'history'].includes(qualityView)) {
    state.qualityView = qualityView as QualityView
  }

  const ledgerTypeView = params.get('ledgerType')
  if (ledgerTypeView && ['all', 'task-earning', 'quality-deduction'].includes(ledgerTypeView)) {
    state.ledgerTypeView = ledgerTypeView as LedgerTypeView
  }
  const ledgerStatusView = params.get('ledgerStatus')
  if (ledgerStatusView && ['all', 'open', 'in-statement', 'in-prepayment-batch', 'prepaid'].includes(ledgerStatusView)) {
    state.ledgerStatusView = ledgerStatusView as LedgerStatusView
  }

  state.lastRouteSyncKey = routeKey
}

function getSelectedCycleSummary(): SettlementCycleSummary | null {
  const context = getCurrentFactoryContext()
  const summaries = getSettlementCycleSummaries(context)
  const cycleId = resolveSettlementCycleId(state.selectedCycleId)
  return summaries.find((item) => item.cycleId === cycleId) ?? summaries[0] ?? null
}

function resetStatementAppealForm(): void {
  state.statementAppealForm = {
    reason: '',
    description: '',
    evidenceSummary: '',
  }
}

function resetSettlementRequestForm(): void {
  const context = getCurrentFactoryContext()
  const effective = getCurrentEffectiveSettlementInfo(context.factoryCode)
  if (!effective) return
  state.settlementRequestForm = {
    accountHolderName: effective.accountHolderName,
    idNumber: effective.idNumber,
    bankName: effective.bankName,
    bankAccountNo: effective.bankAccountNo,
    bankBranch: effective.bankBranch,
    submitRemark: '',
  }
  state.settlementRequestErrors = {}
  state.settlementRequestErrorText = ''
}

function validateSettlementRequestForm(): PdaSettlementState['settlementRequestErrors'] {
  const errors: PdaSettlementState['settlementRequestErrors'] = {}
  if (!state.settlementRequestForm.accountHolderName.trim()) errors.accountHolderName = '请填写开户名'
  if (!state.settlementRequestForm.idNumber.trim()) errors.idNumber = '请填写证件号'
  if (!state.settlementRequestForm.bankName.trim()) errors.bankName = '请填写银行名称'
  if (!state.settlementRequestForm.bankAccountNo.trim()) {
    errors.bankAccountNo = '请填写银行账号'
  } else if (!/^[0-9]{8,30}$/.test(state.settlementRequestForm.bankAccountNo.trim())) {
    errors.bankAccountNo = '银行账号需为 8 到 30 位数字'
  }
  return errors
}

function getSettlementRequestListByCurrentFactory(factoryCode: string): SettlementChangeRequest[] {
  return listSettlementRequestsByFactory(factoryCode)
}

function getSettlementRequestForDrawer(factoryCode: string): SettlementChangeRequest | null {
  if (state.settlementRequestDetailId) {
    return getSettlementRequestListByCurrentFactory(factoryCode).find((item) => item.requestId === state.settlementRequestDetailId) ?? null
  }
  return getSettlementActiveRequestByFactory(factoryCode) ?? getSettlementLatestRequestByFactory(factoryCode)
}

function getChangedSettlementFields(request: SettlementChangeRequest): string {
  const changed: string[] = []
  if (request.before.accountHolderName !== request.after.accountHolderName) changed.push('开户名')
  if (request.before.idNumber !== request.after.idNumber) changed.push('证件号')
  if (request.before.bankName !== request.after.bankName) changed.push('银行名称')
  if (request.before.bankAccountNo !== request.after.bankAccountNo) changed.push('银行账号')
  if (request.before.bankBranch !== request.after.bankBranch) changed.push('开户支行')
  return changed.length > 0 ? changed.join('、') : '资料核对'
}

function getRequestNextStepText(request: SettlementChangeRequest): string {
  if (request.status === 'PENDING_REVIEW') return '平台正在审核申请，待线下签字资料齐备后继续处理。'
  if (request.status === 'APPROVED') return '申请已通过，新版本用于后续新单据，已生成单据继续沿用原快照。'
  return request.rejectReason || '申请未通过，可根据平台意见重新发起。'
}

function buildPdaQualityDetailHref(qcId: string, cycleId?: string, qualityView?: QualityView): string {
  const params = new URLSearchParams()
  params.set('back', 'settlement')
  if (qualityView) params.set('view', qualityView)
  if (cycleId) params.set('cycleId', cycleId)
  return `/fcs/pda/quality/${encodeURIComponent(qcId)}?${params.toString()}`
}

function renderSettlementProfileEntryCard(): string {
  const context = getCurrentFactoryContext()
  const effective = getCurrentEffectiveSettlementInfo(context.factoryCode)
  const activeRequest = getSettlementActiveRequestByFactory(context.factoryCode)
  const selectedCycle = getSelectedCycleSummary()
  const snapshotVersion = selectedCycle?.statementSnapshotVersionNo ?? selectedCycle?.batchSnapshotVersionNo

  return `
    <button
      class="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs hover:bg-muted"
      data-pda-sett-action="open-settlement-profile"
    >
      <span>结算资料</span>
      ${
        effective
          ? `<span class="text-muted-foreground">${escapeHtml(`当前 ${effective.versionNo}`)}</span>`
          : '<span class="text-muted-foreground">未初始化</span>'
      }
      ${
        snapshotVersion
          ? `<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">${escapeHtml(`单据 ${snapshotVersion}`)}</span>`
          : ''
      }
      ${
        activeRequest
          ? `<span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(activeRequest.status)}">${escapeHtml(getSettlementStatusLabel(activeRequest.status))}</span>`
          : ''
      }
    </button>
  `
}

function renderSettlementRequestHistoryList(requests: SettlementChangeRequest[]): string {
  if (requests.length === 0) {
    return '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无结算资料申请记录</div>'
  }

  return `
    <div class="space-y-2">
      ${requests
        .map(
          (request) => `
            <button
              class="w-full rounded-md border bg-background px-3 py-3 text-left hover:bg-muted/30"
              data-pda-sett-action="open-settlement-request-detail"
              data-request-id="${escapeHtml(request.requestId)}"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold">${escapeHtml(request.requestId)}</span>
                    <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(request.status)}">${escapeHtml(
                      getSettlementStatusLabel(request.status),
                    )}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">提交时间：${escapeHtml(request.submittedAt)} · 提交人：${escapeHtml(request.submittedBy)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">版本：${escapeHtml(`${request.currentVersionNo} -> ${request.targetVersionNo}`)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">变更字段：${escapeHtml(getChangedSettlementFields(request))}</p>
                </div>
                <i data-lucide="chevron-right" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"></i>
              </div>
            </button>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSettlementVersionHistoryList(records: SettlementVersionRecord[]): string {
  if (records.length === 0) {
    return '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无版本沿革</div>'
  }

  const ordered = records.slice().sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt))
  return `
    <div class="space-y-2">
      ${ordered
        .map(
          (record) => `
            <div class="rounded-md border bg-background px-3 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold">${escapeHtml(record.versionNo)}</span>
                    <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${record.status === 'EFFECTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-700'}">${escapeHtml(
                      record.status === 'EFFECTIVE' ? '生效中' : '已失效',
                    )}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">生效时间：${escapeHtml(record.effectiveAt)} · 生效人：${escapeHtml(record.effectiveBy)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">收款账户：${escapeHtml(record.bankName)} · 尾号 ${escapeHtml(record.bankAccountNo.slice(-4))}</p>
                </div>
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSettlementProfileDiffCard(summary: SettlementCycleSummary | null): string {
  if (!summary) return ''
  const currentVersion = summary.currentEffectiveVersionNo ?? '—'
  const statementVersion = summary.statementSnapshotVersionNo ?? '当前周期无对账单'
  const batchVersion = summary.batchSnapshotVersionNo ?? '当前周期无预付款批次'
  return `
    <div class="rounded-md border bg-muted/20 px-3 py-3">
      <p class="text-xs font-medium text-foreground">当前周期资料快照版本</p>
      <div class="mt-2 space-y-1">
        ${renderRow('当前生效版本', currentVersion)}
        ${renderRow('对账单使用版本', statementVersion)}
        ${renderRow('预付款批次使用版本', batchVersion)}
      </div>
      ${
        summary.snapshotDifferenceNote
          ? `<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-5 text-amber-700">${escapeHtml(summary.snapshotDifferenceNote)}</div>`
          : '<p class="mt-2 text-[10px] leading-5 text-muted-foreground">当前生效版本与本周期已生成单据使用版本一致。</p>'
      }
    </div>
  `
}

function renderSettlementRequestDrawer(): string {
  const mode = state.settlementRequestDrawerMode
  if (!mode) return ''

  const context = getCurrentFactoryContext()
  const effective = getCurrentEffectiveSettlementInfo(context.factoryCode)
  const requestHistory = getSettlementRequestListByCurrentFactory(context.factoryCode)
  const versionHistory = getSettlementVersionHistory(context.factoryCode)
  const activeRequest = getSettlementActiveRequestByFactory(context.factoryCode)
  const latestRequest = getSettlementLatestRequestByFactory(context.factoryCode)
  const currentRequest = getSettlementRequestForDrawer(context.factoryCode)
  const selectedCycle = getSelectedCycleSummary()
  const summaryRequest = activeRequest ?? latestRequest

  if (mode === 'profile') {
    if (!effective) return ''
    return renderDrawer(
      '结算资料',
      `
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-700">
          工厂端只查看当前生效资料并发起变更申请。申请提交后不会立即改写当前生效资料；新版本只影响后续新单据，已生成单据继续沿用原快照。
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-3">
          ${renderRow('当前生效版本', effective.versionNo, { bold: true })}
          ${renderRow('最近生效时间', formatDateTime(effective.effectiveAt))}
          ${renderRow('结算币种', effective.settlementConfigSnapshot.currency)}
          ${renderRow('收款银行', `${effective.bankName} · 尾号 ${effective.bankAccountNo.slice(-4)}`)}
        </div>
        ${renderSettlementProfileDiffCard(selectedCycle)}
        <div class="rounded-md border p-3">
          <p class="mb-2 text-xs font-medium">当前生效资料</p>
          <div class="grid gap-2">
            <div class="space-y-1 rounded-md bg-muted/20 p-2">
              <p class="text-[10px] text-muted-foreground">收款账户</p>
              <p class="text-xs">开户名：${escapeHtml(effective.accountHolderName)}</p>
              <p class="text-xs">证件号：${escapeHtml(effective.idNumber)}</p>
              <p class="text-xs">银行：${escapeHtml(effective.bankName)}</p>
              <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(effective.bankAccountNo))}</p>
              <p class="text-xs">支行：${escapeHtml(effective.bankBranch || '—')}</p>
            </div>
            <div class="space-y-1 rounded-md bg-muted/20 p-2">
              <p class="text-[10px] text-muted-foreground">结算配置快照</p>
              <p class="text-xs">周期类型：${escapeHtml(effective.settlementConfigSnapshot.cycleType)}</p>
              <p class="text-xs">结算规则：${escapeHtml(effective.settlementConfigSnapshot.settlementDayRule)}</p>
              <p class="text-xs">计价方式：${escapeHtml(effective.settlementConfigSnapshot.pricingMode)}</p>
              <p class="text-xs">结算币种：${escapeHtml(effective.settlementConfigSnapshot.currency)}</p>
            </div>
          </div>
        </div>
        <div class="rounded-md border p-3">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-medium">默认扣款规则概况</p>
            <button
              class="rounded-md border px-2.5 py-1 text-[10px] hover:bg-muted"
              data-pda-sett-action="open-settlement-version-history"
            >
              查看版本沿革
            </button>
          </div>
          <div class="space-y-1.5">
            ${effective.defaultDeductionRulesSnapshot
              .map(
                (rule) => `
                  <div class="rounded-md bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
                    <span class="font-medium text-foreground">${escapeHtml(rule.ruleType)}</span>
                    · ${escapeHtml(rule.ruleMode)} · ${escapeHtml(String(rule.ruleValue))}
                    <span class="ml-2">${escapeHtml(rule.effectiveFrom)} 起</span>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
        ${
          summaryRequest
            ? `
              <div class="rounded-md border bg-muted/20 px-3 py-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-medium">${escapeHtml(activeRequest ? '当前申请' : '最近申请')}</p>
                    <p class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(summaryRequest.requestId)} · ${escapeHtml(getSettlementStatusLabel(summaryRequest.status))}</p>
                    <p class="mt-1 text-[10px] text-muted-foreground">变更字段：${escapeHtml(getChangedSettlementFields(summaryRequest))}</p>
                  </div>
                  <button
                    class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                    data-pda-sett-action="open-settlement-request-detail"
                    data-request-id="${escapeHtml(summaryRequest.requestId)}"
                  >
                    查看申请
                  </button>
                </div>
              </div>
            `
            : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">当前暂无结算资料申请记录，可直接发起变更申请。</div>'
        }
        <div class="grid grid-cols-2 gap-2">
          <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-settlement-request-history">
            历史申请（${requestHistory.length}）
          </button>
          <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-settlement-version-history">
            版本沿革（${versionHistory.length}）
          </button>
        </div>
        <button
          class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          data-pda-sett-action="${activeRequest ? 'open-settlement-request-detail' : 'open-settlement-change-request'}"
          ${activeRequest ? `data-request-id="${escapeHtml(activeRequest.requestId)}"` : ''}
        >
          ${activeRequest ? '查看当前申请' : '申请修改结算资料'}
        </button>
      `,
      'close-settlement-request-drawer',
    )
  }

  if (mode === 'history') {
    return renderDrawer(
      '历史申请',
      `
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
          这里仅查看历史申请记录。当前生效资料仍以平台审核通过后的版本为准。
        </div>
        ${renderSettlementRequestHistoryList(requestHistory)}
        <button class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
      `,
      'close-settlement-request-drawer',
    )
  }

  if (mode === 'versions') {
    return renderDrawer(
      '版本沿革',
      `
        ${renderSettlementProfileDiffCard(selectedCycle)}
        ${renderSettlementVersionHistoryList(versionHistory)}
        <button class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
      `,
      'close-settlement-request-drawer',
    )
  }

  if (mode === 'create') {
    return renderDrawer(
      '申请修改结算资料',
      `
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          提交后进入待审核，不会立即改写当前生效资料；已生成对账单和预付款批次继续沿用原快照。
        </div>
        ${
          state.settlementRequestErrorText
            ? `<div class="rounded-md border ${Object.keys(state.settlementRequestErrors).length > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'} px-3 py-2 text-xs">${escapeHtml(
                state.settlementRequestErrorText,
              )}</div>`
            : ''
        }
        <div class="space-y-3">
          <label class="block space-y-1">
            <span class="text-xs font-medium">开户名 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.accountHolderName ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.accountHolderName)}" data-pda-sett-field="request.accountHolderName" />
            ${
              state.settlementRequestErrors.accountHolderName
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.accountHolderName)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">证件号 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.idNumber ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.idNumber)}" data-pda-sett-field="request.idNumber" />
            ${
              state.settlementRequestErrors.idNumber
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.idNumber)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">银行名称 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.bankName ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.bankName)}" data-pda-sett-field="request.bankName" />
            ${
              state.settlementRequestErrors.bankName
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.bankName)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">银行账号 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.bankAccountNo ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.bankAccountNo)}" data-pda-sett-field="request.bankAccountNo" />
            ${
              state.settlementRequestErrors.bankAccountNo
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.bankAccountNo)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">开户支行</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs" value="${escapeHtml(state.settlementRequestForm.bankBranch)}" data-pda-sett-field="request.bankBranch" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">申请说明</span>
            <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-xs" data-pda-sett-field="request.submitRemark">${escapeHtml(
              state.settlementRequestForm.submitRemark,
            )}</textarea>
          </label>
        </div>
        <button class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" data-pda-sett-action="submit-settlement-change-request">
          提交申请
        </button>
      `,
      'close-settlement-request-drawer',
    )
  }

  if (!currentRequest) {
    return renderDrawer(
      '查看申请',
      `
        <div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">当前暂无申请记录</div>
        <button class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
      `,
      'close-settlement-request-drawer',
    )
  }

  return renderDrawer(
    '查看申请',
    `
      <div class="rounded-md border bg-muted/20 px-3 py-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium">${escapeHtml(currentRequest.requestId)}</p>
          <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(currentRequest.status)}">${escapeHtml(
            getSettlementStatusLabel(currentRequest.status),
          )}</span>
        </div>
        <p class="mt-1 text-[10px] text-muted-foreground">申请时间：${escapeHtml(currentRequest.submittedAt)} · 提交人：${escapeHtml(currentRequest.submittedBy)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">当前版本：${escapeHtml(currentRequest.currentVersionNo)} · 目标版本：${escapeHtml(currentRequest.targetVersionNo)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">变更字段：${escapeHtml(getChangedSettlementFields(currentRequest))}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">下一步：${escapeHtml(getRequestNextStepText(currentRequest))}</p>
      </div>
      ${renderSettlementProfileDiffCard(selectedCycle)}
      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">变更前后</p>
        <div class="grid gap-2">
          <div class="space-y-1 rounded-md bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">变更前（当前生效）</p>
            <p class="text-xs">开户名：${escapeHtml(currentRequest.before.accountHolderName)}</p>
            <p class="text-xs">证件号：${escapeHtml(currentRequest.before.idNumber)}</p>
            <p class="text-xs">银行：${escapeHtml(currentRequest.before.bankName)}</p>
            <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(currentRequest.before.bankAccountNo))}</p>
          </div>
          <div class="space-y-1 rounded-md bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">申请修改后</p>
            <p class="text-xs">开户名：${escapeHtml(currentRequest.after.accountHolderName)}</p>
            <p class="text-xs">证件号：${escapeHtml(currentRequest.after.idNumber)}</p>
            <p class="text-xs">银行：${escapeHtml(currentRequest.after.bankName)}</p>
            <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(currentRequest.after.bankAccountNo))}</p>
          </div>
        </div>
      </div>
      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">申请进度</p>
        <div class="space-y-2">
          ${currentRequest.logs
            .map(
              (item) => `
                <div class="rounded-md border bg-muted/20 px-2.5 py-2">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="font-medium">${escapeHtml(item.action)}</span>
                    <span class="text-muted-foreground">${escapeHtml(item.createdAt)}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">操作人：${escapeHtml(item.actor)}</p>
                  <p class="text-[10px] text-muted-foreground">${escapeHtml(item.remark)}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="back-to-settlement-profile">
          返回结算资料
        </button>
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-settlement-request-history">
          查看历史申请
        </button>
      </div>
    `,
    'close-settlement-request-drawer',
  )
}

function getCycleQualityItems(summary: SettlementCycleSummary, view: QualityView): FutureMobileFactoryQcListItem[] {
  if (view === 'pending') return summary.pendingQualityItems
  if (view === 'soon') return summary.soonQualityItems
  if (view === 'disputing') return summary.disputingQualityItems
  if (view === 'processed') return summary.processedQualityItems
  return summary.historyQualityItems
}

function matchesQualityKeyword(item: FutureMobileFactoryQcListItem, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return [item.qcNo, item.returnInboundBatchNo, item.productionOrderNo, item.processLabel]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized))
}

function matchesLedgerKeyword(ledger: PreSettlementLedger, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return [
    ledger.ledgerNo,
    ledger.taskNo,
    ledger.returnInboundBatchNo,
    ledger.qcRecordId,
    ledger.statementId,
    ledger.prepaymentBatchId,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized))
}

function getFilteredCycleLedgers(summary: SettlementCycleSummary): PreSettlementLedger[] {
  return summary.ledgers.filter((ledger) => {
    if (state.ledgerTypeView === 'task-earning' && ledger.ledgerType !== 'TASK_EARNING') return false
    if (state.ledgerTypeView === 'quality-deduction' && ledger.ledgerType !== 'QUALITY_DEDUCTION') return false
    if (state.ledgerStatusView === 'open' && ledger.status !== 'OPEN') return false
    if (state.ledgerStatusView === 'in-statement' && ledger.status !== 'IN_STATEMENT') return false
    if (state.ledgerStatusView === 'in-prepayment-batch' && ledger.status !== 'IN_PREPAYMENT_BATCH') return false
    if (state.ledgerStatusView === 'prepaid' && ledger.status !== 'PREPAID') return false
    return matchesLedgerKeyword(ledger, state.ledgerKeyword)
  })
}

function getLedgerDetailViewModel(ledgerId: string | null): SettlementLedgerDetailViewModel | null {
  if (!ledgerId) return null
  const ledger = getPreSettlementLedgerById(ledgerId)
  if (!ledger) return null
  const statement = ledger.statementId ? getStatementDraftById(ledger.statementId) : null
  const batch = ledger.prepaymentBatchId ? getPrepaymentBatchById(ledger.prepaymentBatchId) : null
  const approval = getBatchApproval(batch)
  const writeback = getBatchWriteback(batch)
  const trace = tracePreSettlementLedgerSource(ledgerId)

  return {
    ledger,
    statement,
    batch,
    approval,
    writeback,
    trace,
  }
}

function renderCycleCard(summary: SettlementCycleSummary): string {
  const statementStatus = summary.primaryStatement ? getStatementStatusLabel(summary.primaryStatement.status) : '未生成对账单'
  const batchStatus = summary.primaryBatch ? getPrepaymentBatchStatusLabel(summary.primaryBatch.status) : '未入预付款'
  const snapshotVersionLabel =
    summary.statementSnapshotVersionNo || summary.batchSnapshotVersionNo
      ? `对账单 ${summary.statementSnapshotVersionNo ?? '—'} / 预付款 ${summary.batchSnapshotVersionNo ?? '—'}`
      : `当前生效 ${summary.currentEffectiveVersionNo ?? '—'}`

  return `
    <button
      class="w-full rounded-xl border bg-card px-4 py-4 text-left shadow-none hover:bg-muted/20"
      data-pda-sett-action="open-cycle-detail"
      data-cycle-id="${escapeHtml(summary.cycleId)}"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-foreground">${escapeHtml(summary.cycleLabel)}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(`${summary.cycleStartAt} ~ ${summary.cycleEndAt}`)}</div>
        </div>
        ${summary.latestWriteback ? renderStatusBadge('已回写打款结果', 'green') : summary.primaryBatch ? renderStatusBadge(batchStatus, getPrepaymentBatchStatusVariant(summary.primaryBatch.status)) : renderStatusBadge(statementStatus, summary.primaryStatement ? getStatementStatusVariant(summary.primaryStatement.status) : 'gray')}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div class="rounded-md bg-muted/20 px-3 py-2">
          <div class="text-muted-foreground">任务收入正式流水金额</div>
          <div class="mt-1 text-xs font-semibold text-foreground">${escapeHtml(formatAmount(summary.taskEarningAmount))}</div>
        </div>
        <div class="rounded-md bg-muted/20 px-3 py-2">
          <div class="text-muted-foreground">质量扣款正式流水金额</div>
          <div class="mt-1 text-xs font-semibold text-red-600">${escapeHtml(summary.qualityDeductionAmount > 0 ? formatAmount(summary.qualityDeductionAmount) : '—')}</div>
        </div>
        <div class="rounded-md bg-muted/20 px-3 py-2">
          <div class="text-muted-foreground">本期预付净额</div>
          <div class="mt-1 text-xs font-semibold text-foreground">${escapeHtml(formatAmount(summary.netPayableAmount))}</div>
        </div>
        <div class="rounded-md bg-muted/20 px-3 py-2">
          <div class="text-muted-foreground">待处理 / 异议中</div>
          <div class="mt-1 text-xs font-semibold text-foreground">${summary.pendingQualityCount} / ${summary.disputingCount}</div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-1.5">
        ${summary.primaryStatement ? renderStatusBadge(statementStatus, getStatementStatusVariant(summary.primaryStatement.status)) : renderStatusBadge('未生成对账单', 'gray')}
        ${summary.primaryBatch ? renderStatusBadge(batchStatus, getPrepaymentBatchStatusVariant(summary.primaryBatch.status)) : renderStatusBadge('未入预付款', 'gray')}
        ${summary.latestApproval ? renderStatusBadge(`飞书 ${getFeishuStatusLabel(summary.latestApproval.status)}`, getFeishuStatusVariant(summary.latestApproval.status)) : renderStatusBadge('未申请飞书付款', 'gray')}
      </div>
      <div class="mt-3 text-[10px] leading-5 text-muted-foreground">
        <div>${escapeHtml(`资料版本：${snapshotVersionLabel}`)}</div>
        <div>${escapeHtml(summary.latestWriteback ? `已登记银行回执与流水 ${summary.latestWriteback.bankSerialNo}` : '当前尚未登记打款回写')}</div>
      </div>
    </button>
  `
}

function renderOverviewTab(summary: SettlementCycleSummary): string {
  const effectiveInfo = getCurrentEffectiveSettlementInfo(getCurrentFactoryContext().factoryCode)
  const activeRequest = getSettlementActiveRequestByFactory(getCurrentFactoryContext().factoryCode)
  const statementProgress = summary.primaryStatement ? getStatementSettlementProgressView(summary.primaryStatement) : null

  return `
    <div class="space-y-3 p-4">
      ${renderCard(
        '本期金额概况',
        `
          ${renderRow('任务收入正式流水金额', formatAmount(summary.taskEarningAmount), { bold: true })}
          ${renderRow('质量扣款正式流水金额', summary.qualityDeductionAmount > 0 ? formatAmount(summary.qualityDeductionAmount) : '—', {
            red: summary.qualityDeductionAmount > 0,
          })}
          ${renderRow('本期预付净额', formatAmount(summary.netPayableAmount), { bold: true })}
        `,
      )}
      ${renderCard(
        '待处理提示',
        `
          ${renderRow('待确认质量扣款记录', `${summary.pendingQualityCount} 条`, { orange: summary.pendingQualityCount > 0 })}
          ${renderRow('即将超时', `${summary.soonOverdueCount} 条`, { red: summary.soonOverdueCount > 0 })}
          ${renderRow('异议中', `${summary.disputingCount} 条`, { orange: summary.disputingCount > 0 })}
          <div class="pt-1">
            <button
              class="inline-flex items-center rounded-md border px-3 py-2 text-xs hover:bg-muted"
              data-pda-sett-action="open-quality-workbench"
              data-cycle-id="${escapeHtml(summary.cycleId)}"
              data-view="${summary.pendingQualityCount > 0 ? 'pending' : summary.disputingCount > 0 ? 'disputing' : 'history'}"
            >
              去处理质检扣款
            </button>
          </div>
        `,
      )}
      ${renderCard(
        '对账与预付款进度',
        `
          ${renderRow('对账单状态', summary.primaryStatement ? getStatementStatusLabel(summary.primaryStatement.status) : '当前未生成对账单')}
          ${renderRow('工厂反馈状态', summary.primaryStatement ? getFactoryFeedbackLabel(summary.primaryStatement.factoryFeedbackStatus) : '当前无反馈')}
          ${renderRow('预付款批次状态', summary.primaryBatch ? getPrepaymentBatchStatusLabel(summary.primaryBatch.status) : '当前未入预付款')}
          ${renderRow('飞书付款审批状态', summary.latestApproval ? getFeishuStatusLabel(summary.latestApproval.status) : '当前未申请')}
          ${renderRow('打款回写', summary.latestWriteback ? `已回写 · ${summary.latestWriteback.bankSerialNo}` : '当前未回写')}
          ${
            statementProgress
              ? `<div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5 text-muted-foreground">${escapeHtml(statementProgress.detail)}</div>`
              : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[10px] leading-5 text-muted-foreground">当前周期尚未生成对账单，暂时无法进入后续预付款链。</div>'
          }
          <div class="grid grid-cols-2 gap-2">
            <button
              class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
              data-pda-sett-action="switch-detail-tab"
              data-tab="statements"
              data-cycle-id="${escapeHtml(summary.cycleId)}"
            >
              查看对账与预付款
            </button>
            <button
              class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
              data-pda-sett-action="open-settlement-profile"
            >
              查看结算资料
            </button>
          </div>
        `,
      )}
      ${renderCard(
        '结算资料轻入口',
        `
          ${renderRow('当前生效版本', effectiveInfo?.versionNo ?? '未初始化')}
          ${renderRow('本周期对账单使用版本', summary.statementSnapshotVersionNo ?? '当前无对账单')}
          ${renderRow('本周期预付款批次使用版本', summary.batchSnapshotVersionNo ?? '当前无预付款批次')}
          ${renderRow('当前申请状态', activeRequest ? getSettlementStatusLabel(activeRequest.status) : '当前无申请中变更')}
          ${
            summary.snapshotDifferenceNote
              ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-700">${escapeHtml(summary.snapshotDifferenceNote)}</div>`
              : '<div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">当前生效版本与本周期已生成单据使用版本一致。</div>'
          }
        `,
      )}
    </div>
  `
}

function renderQualityItemCard(item: FutureMobileFactoryQcListItem, cycleId: string): string {
  const detailHref = buildPdaQualityDetailHref(item.qcId, cycleId, state.qualityView)
  const primaryActionLabel = item.canConfirm ? '去确认' : item.canDispute ? '去发起异议' : '查看详情'
  return `
    <article class="rounded-lg border bg-card px-3 py-3 shadow-none">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-semibold text-foreground">${escapeHtml(item.qcNo)}</div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`${item.productionOrderNo} · ${item.returnInboundBatchNo}`)}</div>
          <div class="text-[10px] text-muted-foreground">${escapeHtml(`${item.processLabel} · ${formatDateTime(item.inspectedAt)}`)}</div>
        </div>
        ${renderStatusBadge(item.qcResultLabel, item.qcResultLabel.includes('不合格') ? 'red' : item.qcResultLabel.includes('部分') ? 'amber' : 'green')}
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        ${renderStatusBadge(item.factoryResponseStatusLabel, getQualityResponseVariant(item.factoryResponseStatusLabel))}
        ${renderStatusBadge(item.disputeStatusLabel, getQualityDisputeVariant(item.disputeStatusLabel))}
        ${renderStatusBadge(item.settlementImpactStatusLabel, getQualitySettlementVariant(item.settlementImpactStatusLabel))}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div class="rounded-md bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">责任数量</div>
          <div class="mt-1 font-medium text-foreground">${item.factoryLiabilityQty} 件</div>
        </div>
        <div class="rounded-md bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">待确认金额</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(formatAmountWithSettlement({
            amount: item.blockedProcessingFeeAmount,
            originalCurrency: 'CNY',
            settlementCurrency: 'IDR',
            referenceAt: item.inspectedAt,
          }))}</div>
        </div>
        <div class="rounded-md bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">截止时间</div>
          <div class="mt-1 font-medium text-foreground">${item.responseDeadlineAt ? escapeHtml(formatDateTime(item.responseDeadlineAt)) : '无需响应'}</div>
        </div>
        <div class="rounded-md bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">剩余时间</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(getRemainingDeadlineSummary(item.responseDeadlineAt))}</div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">${primaryActionLabel}</button>
        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看质检详情</button>
      </div>
    </article>
  `
}

function renderQualityTab(summary: SettlementCycleSummary): string {
  const items = getCycleQualityItems(summary, state.qualityView).filter((item) => matchesQualityKeyword(item, state.qualitySearch))
  const tabItems: Array<{ key: QualityView; label: string; count: number }> = [
    { key: 'pending', label: '待处理', count: summary.pendingQualityItems.length },
    { key: 'soon', label: '即将超时', count: summary.soonQualityItems.length },
    { key: 'disputing', label: '异议中', count: summary.disputingQualityItems.length },
    { key: 'processed', label: '已处理', count: summary.processedQualityItems.length },
    { key: 'history', label: '历史', count: summary.historyQualityItems.length },
  ]

  return `
    <div class="space-y-3 p-4">
      ${renderCard(
        '质检扣款处理区',
        `
          <div class="flex gap-2 overflow-x-auto pb-1">
            ${tabItems
              .map(
                (item) => `
                  <button
                    class="inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium ${
                      state.qualityView === item.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'
                    }"
                    data-pda-sett-action="set-quality-view"
                    data-view="${item.key}"
                    data-cycle-id="${escapeHtml(summary.cycleId)}"
                  >
                    ${escapeHtml(item.label)} · ${item.count}
                  </button>
                `,
              )
              .join('')}
          </div>
          <div>
            <label class="text-[11px] text-muted-foreground">关键词</label>
            <input
              class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
              placeholder="输入质检单号 / 回货批次号 / 生产单号"
              data-pda-sett-field="quality-search"
              value="${escapeHtml(state.qualitySearch)}"
            />
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5 text-muted-foreground">
            这里只展示待确认质量扣款记录与质量异议单。未最终裁决的记录不会进入正式流水。
          </div>
        `,
      )}
      ${
        items.length > 0
          ? items.map((item) => renderQualityItemCard(item, summary.cycleId)).join('')
          : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前分组没有质检扣款记录</div>'
      }
    </div>
  `
}

function renderLedgerCard(ledger: PreSettlementLedger): string {
  const statement = ledger.statementId ? getStatementDraftById(ledger.statementId) : null
  const batch = ledger.prepaymentBatchId ? getPrepaymentBatchById(ledger.prepaymentBatchId) : null
  return `
    <article class="rounded-lg border bg-card px-3 py-3 shadow-none">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-foreground">${escapeHtml(ledger.ledgerNo)}</span>
            ${renderStatusBadge(getLedgerTypeLabel(ledger.ledgerType), ledger.ledgerType === 'TASK_EARNING' ? 'blue' : 'red')}
            ${renderStatusBadge(getLedgerStatusLabel(ledger.status), getLedgerStatusVariant(ledger.status))}
          </div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(
            ledger.ledgerType === 'TASK_EARNING'
              ? `${ledger.taskNo ?? '未绑定任务'} · ${ledger.returnInboundBatchNo ?? '未绑定回货批次'}`
              : `${ledger.qcRecordId ?? '未绑定质检'} · ${ledger.pendingDeductionRecordId ?? '未绑定待确认记录'}`,
          )}</div>
          <div class="text-[10px] text-muted-foreground">${escapeHtml(`对账单 ${statement?.statementNo ?? statement?.statementId ?? '未入单'} · 预付款 ${batch?.batchNo ?? batch?.batchId ?? '未入批'}`)}</div>
        </div>
        <div class="shrink-0 text-right">
          <div class="text-xs font-semibold ${ledger.direction === 'DEDUCTION' ? 'text-red-600' : 'text-foreground'}">${escapeHtml(formatAmount(ledger.settlementAmount, ledger.settlementCurrency))}</div>
          <button class="mt-2 rounded-md border px-2.5 py-1 text-[10px] hover:bg-muted" data-pda-sett-action="open-ledger-detail" data-ledger-id="${escapeHtml(ledger.ledgerId)}">
            查看流水
          </button>
        </div>
      </div>
    </article>
  `
}

function renderLedgerDrawer(): string {
  const detail = getLedgerDetailViewModel(state.ledgerDrawerId)
  if (!detail) return ''
  const { ledger, trace, statement, batch, approval, writeback } = detail

  const sourceSection =
    ledger.ledgerType === 'TASK_EARNING'
      ? `
          ${renderRow('任务号', ledger.taskNo ?? ledger.taskId ?? '—')}
          ${renderRow('生产单号', ledger.productionOrderNo ?? ledger.productionOrderId ?? '—')}
          ${renderRow('回货批次', ledger.returnInboundBatchNo ?? '—')}
          ${renderRow('价格来源', getLedgerPriceSourceLabel(ledger.priceSourceType))}
          ${renderRow('单价', ledger.unitPrice ? formatAmount(ledger.unitPrice, ledger.settlementCurrency) : '—')}
          ${renderRow('数量', `${ledger.qty} 件`)}
        `
      : `
          ${renderRow('质检记录号', trace?.qcRecord?.qcNo ?? ledger.qcRecordId ?? '—')}
          ${renderRow('待确认质量扣款记录号', ledger.pendingDeductionRecordId ?? '—')}
          ${renderRow('质量异议单号', ledger.disputeId ?? '—')}
          ${renderRow('裁决结果', trace?.disputeCase?.adjudicationResult ?? '当前无裁决')}
          ${renderRow('责任数量', trace?.qcRecord ? `${trace.qcRecord.factoryLiabilityQty} 件` : '—')}
          ${renderRow('生成原因', ledger.sourceReason ?? '正式质量扣款流水')}
        `

  const currencyDisplay = getConvertedCurrencyDisplay({
    amount: ledger.originalAmount,
    originalCurrency: ledger.originalCurrency,
    settlementCurrency: ledger.settlementCurrency,
    referenceAt: ledger.fxAppliedAt,
  })

  return renderDrawer(
    `正式流水 · ${ledger.ledgerNo}`,
    `
      ${renderCard(
        '基本信息',
        `
          ${renderRow('流水号', ledger.ledgerNo, { bold: true })}
          ${renderRow('来源类型', getLedgerTypeLabel(ledger.ledgerType))}
          ${renderRow('当前状态', getLedgerStatusLabel(ledger.status))}
          ${renderRow('发生时间', formatDateTime(ledger.occurredAt))}
          ${renderRow('结算周期', ledger.settlementCycleLabel)}
        `,
      )}
      ${renderCard(
        '金额信息',
        `
          ${renderRow('原始币种金额', currencyDisplay.originalAmountLabel)}
          ${renderRow('结算币种金额', currencyDisplay.settlementAmountLabel, { bold: true })}
          ${renderRow('汇率', currencyDisplay.rateLabel)}
          ${renderRow('换算时点', formatDateTime(currencyDisplay.fxAppliedAt))}
        `,
      )}
      ${renderCard('来源链路', sourceSection)}
      ${renderCard(
        '对账单信息',
        `
          ${renderRow('对账单号', statement?.statementNo ?? statement?.statementId ?? '当前未入对账单')}
          ${renderRow('对账单状态', statement ? getStatementStatusLabel(statement.status) : '当前未入对账单')}
          ${renderRow('工厂反馈状态', statement ? getFactoryFeedbackLabel(statement.factoryFeedbackStatus) : '当前无反馈')}
        `,
      )}
      ${renderCard(
        '预付款与打款',
        `
          ${renderRow('预付款批次号', batch?.batchNo ?? batch?.batchId ?? '当前未入预付款批次')}
          ${renderRow('预付款批次状态', batch ? getPrepaymentBatchStatusLabel(batch.status) : '当前未入预付款批次')}
          ${renderRow('飞书付款审批编号', approval?.approvalNo ?? '当前未申请')}
          ${renderRow('飞书付款审批状态', approval ? getFeishuStatusLabel(approval.status) : '当前未申请')}
          ${renderRow('打款结果', writeback ? `已回写 · ${writeback.bankSerialNo}` : '当前未回写')}
          ${
            writeback
              ? `
                ${renderRow('打款时间', formatDateTime(writeback.paidAt))}
                ${renderRow('银行回执', writeback.bankReceiptName)}
                ${renderRow('银行流水号', writeback.bankSerialNo)}
              `
              : ''
          }
        `,
      )}
    `,
    'close-ledger-drawer',
  )
}

function renderLedgersTab(summary: SettlementCycleSummary): string {
  const ledgers = getFilteredCycleLedgers(summary)
  const taskAmount = ledgers.filter((item) => item.ledgerType === 'TASK_EARNING').reduce((sum, item) => sum + item.settlementAmount, 0)
  const qualityAmount = ledgers.filter((item) => item.ledgerType === 'QUALITY_DEDUCTION').reduce((sum, item) => sum + item.settlementAmount, 0)
  return `
    <div class="space-y-3 p-4">
      ${renderCard(
        '正式流水查看区',
        `
          <div class="grid grid-cols-2 gap-2 text-[10px]">
            <div class="rounded-md bg-muted/20 px-3 py-2">
              <div class="text-muted-foreground">任务收入正式流水金额</div>
              <div class="mt-1 text-xs font-semibold text-foreground">${escapeHtml(formatAmount(taskAmount))}</div>
            </div>
            <div class="rounded-md bg-muted/20 px-3 py-2">
              <div class="text-muted-foreground">质量扣款正式流水金额</div>
              <div class="mt-1 text-xs font-semibold text-red-600">${escapeHtml(qualityAmount > 0 ? formatAmount(qualityAmount) : '—')}</div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex flex-wrap gap-2">
              ${[
                ['all', '全部'],
                ['task-earning', '任务收入'],
                ['quality-deduction', '质量扣款'],
              ]
                .map(
                  ([value, label]) => `
                    <button
                      class="rounded-full border px-3 py-1.5 text-xs ${
                        state.ledgerTypeView === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'
                      }"
                      data-pda-sett-action="set-ledger-type-view"
                      data-value="${value}"
                      data-cycle-id="${escapeHtml(summary.cycleId)}"
                    >
                      ${label}
                    </button>
                  `,
                )
                .join('')}
            </div>
            <div class="flex flex-wrap gap-2">
              ${[
                ['all', '全部'],
                ['open', '待入对账单'],
                ['in-statement', '已入对账单'],
                ['in-prepayment-batch', '已入预付款批次'],
                ['prepaid', '已预付'],
              ]
                .map(
                  ([value, label]) => `
                    <button
                      class="rounded-full border px-3 py-1.5 text-xs ${
                        state.ledgerStatusView === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'
                      }"
                      data-pda-sett-action="set-ledger-status-view"
                      data-value="${value}"
                      data-cycle-id="${escapeHtml(summary.cycleId)}"
                    >
                      ${label}
                    </button>
                  `,
                )
                .join('')}
            </div>
            <div>
              <label class="text-[11px] text-muted-foreground">关键词</label>
              <input
                class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                placeholder="输入流水号 / 任务号 / 质检记录号 / 对账单号 / 预付款批次号"
                data-pda-sett-field="ledger-keyword"
                value="${escapeHtml(state.ledgerKeyword)}"
              />
            </div>
            <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5 text-muted-foreground">
              这里只展示已正式成立的任务收入流水和质量扣款流水。待确认质量扣款记录和未最终裁决的质量异议不会进入这里。
            </div>
          </div>
        `,
      )}
      ${
        ledgers.length > 0
          ? ledgers.map((item) => renderLedgerCard(item)).join('')
          : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选条件下没有正式流水</div>'
      }
      ${renderLedgerDrawer()}
    </div>
  `
}

function getStatementSplitAmounts(statement: StatementDraft): {
  earningAmount: number
  deductionAmount: number
  netAmount: number
} {
  return {
    earningAmount: statement.totalEarningAmount ?? statement.items.filter((item) => item.sourceItemType === 'TASK_EARNING').reduce((sum, item) => sum + (item.earningAmount ?? item.deductionAmount), 0),
    deductionAmount: statement.totalDeductionAmount ?? statement.items.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION').reduce((sum, item) => sum + Math.abs(item.qualityDeductionAmount ?? item.deductionAmount), 0),
    netAmount: statement.netPayableAmount ?? statement.totalAmount,
  }
}

function getStatementAppealRecords(statement: StatementDraft): StatementAppealRecord[] {
  if (statement.appealRecords?.length) return statement.appealRecords.slice().reverse()
  if (statement.factoryAppealRecord) return [statement.factoryAppealRecord]
  return []
}

function renderStatementCard(statement: StatementDraft, summary: SettlementCycleSummary): string {
  const amounts = getStatementSplitAmounts(statement)
  const batch = statement.prepaymentBatchId ? getPrepaymentBatchById(statement.prepaymentBatchId) : getBatchByStatement(statement.statementId)
  const approval = getBatchApproval(batch)
  const writeback = getBatchWriteback(batch)
  const canRespond =
    statement.status === 'PENDING_FACTORY_CONFIRM' && statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM'

  return `
    <article class="rounded-lg border bg-card px-3 py-3 shadow-none">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-foreground">${escapeHtml(statement.statementNo ?? statement.statementId)}</span>
            ${renderStatusBadge(getStatementStatusLabel(statement.status), getStatementStatusVariant(statement.status))}
            ${renderStatusBadge(getFactoryFeedbackLabel(statement.factoryFeedbackStatus), getFactoryFeedbackVariant(statement.factoryFeedbackStatus))}
          </div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`正向 ${formatAmount(amounts.earningAmount)} · 反向 ${amounts.deductionAmount > 0 ? formatAmount(amounts.deductionAmount) : '—'} · 本期应付净额 ${formatAmount(amounts.netAmount)}`)}</div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`资料快照版本 ${statement.settlementProfileVersionNo} · 当前生效 ${summary.currentEffectiveVersionNo ?? '—'}`)}</div>
        </div>
        <button class="rounded-md border px-2.5 py-1 text-[10px] hover:bg-muted" data-pda-sett-action="open-statement-detail" data-statement-id="${escapeHtml(statement.statementId)}">
          查看详情
        </button>
      </div>
      <div class="mt-3 rounded-md bg-muted/20 px-3 py-2 text-[10px]">
        ${renderRow('对账单状态', getStatementStatusLabel(statement.status))}
        ${renderRow('工厂反馈状态', getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}
        ${renderRow('预付款批次', batch?.batchNo ?? batch?.batchId ?? '当前未入预付款批次')}
        ${renderRow('飞书付款审批编号', approval?.approvalNo ?? '当前未申请')}
        ${renderRow('飞书付款审批状态', approval ? getFeishuStatusLabel(approval.status) : '当前未申请')}
        ${renderRow('打款回写', writeback ? `已回写 · ${writeback.bankSerialNo}` : '当前未回写')}
      </div>
      ${
        summary.snapshotDifferenceNote && statement.settlementProfileVersionNo !== summary.currentEffectiveVersionNo
          ? `<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-700">${escapeHtml(summary.snapshotDifferenceNote)}</div>`
          : ''
      }
      <div class="mt-3 grid grid-cols-2 gap-2">
        ${
          canRespond
            ? `
              <button
                class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                data-pda-sett-action="confirm-statement"
                data-statement-id="${escapeHtml(statement.statementId)}"
              >
                确认对账单
              </button>
              <button
                class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700"
                data-pda-sett-action="open-statement-appeal"
                data-statement-id="${escapeHtml(statement.statementId)}"
              >
                发起对账单异议
              </button>
            `
            : `
              <button
                class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
                data-pda-sett-action="open-statement-detail"
                data-statement-id="${escapeHtml(statement.statementId)}"
              >
                查看对账单
              </button>
              <button
                class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
                data-pda-sett-action="open-statement-payment"
                data-statement-id="${escapeHtml(statement.statementId)}"
              >
                查看预付款结果
              </button>
            `
        }
      </div>
    </article>
  `
}

function renderPrepaymentBatchCard(batch: SettlementBatch): string {
  const approval = getBatchApproval(batch)
  const writeback = getBatchWriteback(batch)
  return `
    <article class="rounded-lg border bg-card px-3 py-3 shadow-none">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-foreground">${escapeHtml(batch.batchNo ?? batch.batchId)}</span>
            ${renderStatusBadge(getPrepaymentBatchStatusLabel(batch.status), getPrepaymentBatchStatusVariant(batch.status))}
          </div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`关联对账单 ${batch.totalStatementCount} 张 · 金额 ${formatAmount(batch.totalPayableAmount, batch.settlementCurrency)}`)}</div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`飞书付款审批编号 ${approval?.approvalNo ?? '当前未申请'} · 状态 ${approval ? getFeishuStatusLabel(approval.status) : '当前未申请'}`)}</div>
        </div>
      </div>
      <div class="mt-3 rounded-md bg-muted/20 px-3 py-2 text-[10px]">
        ${renderRow('预付款批次号', batch.batchNo ?? batch.batchId)}
        ${renderRow('飞书付款审批编号', approval?.approvalNo ?? '当前未申请')}
        ${renderRow('飞书付款审批状态', approval ? getFeishuStatusLabel(approval.status) : '当前未申请')}
        ${renderRow('打款时间', writeback?.paidAt ? formatDateTime(writeback.paidAt) : '当前未回写')}
        ${renderRow('银行回执', writeback?.bankReceiptName ?? '当前未登记')}
        ${renderRow('银行流水号', writeback?.bankSerialNo ?? '当前未登记')}
      </div>
    </article>
  `
}

function getBatchByStatement(statementId: string): SettlementBatch | null {
  return sortByDateDesc(listSettlementBatchesByStatement(statementId), (item) => item.prepaidAt ?? item.updatedAt ?? item.createdAt)[0] ?? null
}

function renderStatementDetailSection(title: string, rows: string): string {
  return renderCard(title, rows)
}

function renderStatementDrawer(): string {
  if (!state.statementDrawerMode || !state.statementDetailId) return ''
  const statement = getStatementDraftById(state.statementDetailId)
  if (!statement) return ''

  const amounts = getStatementSplitAmounts(statement)
  const batch = statement.prepaymentBatchId ? getPrepaymentBatchById(statement.prepaymentBatchId) : getBatchByStatement(statement.statementId)
  const approval = getBatchApproval(batch)
  const writeback = getBatchWriteback(batch)
  const currentContext = getCurrentFactoryContext()
  const currentEffective = getCurrentEffectiveSettlementInfo(currentContext.factoryCode)
  const appeals = getStatementAppealRecords(statement)
  const progress = getStatementSettlementProgressView(statement)
  const taskItems = statement.items.filter((item) => item.sourceItemType === 'TASK_EARNING')
  const qualityItems = statement.items.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION')
  const snapshotDiffNote =
    currentEffective && currentEffective.versionNo !== statement.settlementProfileVersionNo
      ? `当前生效：${currentEffective.versionNo}；对账单使用：${statement.settlementProfileVersionNo}。新版本用于后续新单据，本期已生成单据继续沿用原快照。`
      : ''

  if (state.statementDrawerMode === 'payment') {
    return renderDrawer(
      `预付款结果 · ${statement.statementNo ?? statement.statementId}`,
      `
        ${renderCard(
          '预付款结果',
          `
            ${renderRow('预付款批次号', batch?.batchNo ?? batch?.batchId ?? '当前未入预付款批次')}
            ${renderRow('预付款批次状态', batch ? getPrepaymentBatchStatusLabel(batch.status) : '当前未入预付款批次')}
            ${renderRow('飞书付款审批编号', approval?.approvalNo ?? '当前未申请')}
            ${renderRow('飞书付款审批状态', approval ? getFeishuStatusLabel(approval.status) : '当前未申请')}
            ${renderRow('打款时间', writeback?.paidAt ? formatDateTime(writeback.paidAt) : '当前未回写')}
            ${renderRow('银行回执', writeback?.bankReceiptName ?? '当前未登记')}
            ${renderRow('银行流水号', writeback?.bankSerialNo ?? '当前未登记')}
          `,
        )}
      `,
      'close-statement-drawer',
    )
  }

  if (state.statementDrawerMode === 'appeal') {
    return renderDrawer(
      `发起对账单异议 · ${statement.statementNo ?? statement.statementId}`,
      `
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-700">
          对账单异议会回写到对账单对象本身。平台处理前，该单不会继续进入后续预付款链。
        </div>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">异议原因</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-xs" value="${escapeHtml(state.statementAppealForm.reason)}" data-pda-sett-field="statement-appeal-reason" />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">异议说明</label>
            <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-xs" data-pda-sett-field="statement-appeal-description">${escapeHtml(
              state.statementAppealForm.description,
            )}</textarea>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">证据说明（选填）</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-xs" value="${escapeHtml(state.statementAppealForm.evidenceSummary)}" data-pda-sett-field="statement-appeal-evidence" />
          </div>
          ${
            state.statementErrorText
              ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700">${escapeHtml(state.statementErrorText)}</div>`
              : ''
          }
          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="close-statement-drawer">取消</button>
            <button class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" data-pda-sett-action="submit-statement-appeal" data-statement-id="${escapeHtml(statement.statementId)}">提交异议</button>
          </div>
        </div>
      `,
      'close-statement-drawer',
    )
  }

  return renderDrawer(
    `对账单 · ${statement.statementNo ?? statement.statementId}`,
    `
      ${renderStatementDetailSection(
        '基本信息 / 概况',
        `
          ${renderRow('对账单号', statement.statementNo ?? statement.statementId, { bold: true })}
          ${renderRow('对账单状态', getStatementStatusLabel(statement.status))}
          ${renderRow('工厂反馈状态', getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}
          ${renderRow('结算周期', statement.settlementCycleLabel ?? '—')}
          ${renderRow('创建时间', formatDateTime(statement.createdAt))}
        `,
      )}
      ${renderStatementDetailSection(
        '金额概况',
        `
          ${renderRow('正向金额', formatAmount(amounts.earningAmount), { bold: true })}
          ${renderRow('反向金额', amounts.deductionAmount > 0 ? formatAmount(amounts.deductionAmount) : '—', { red: amounts.deductionAmount > 0 })}
          ${renderRow('本期应付净额', formatAmount(amounts.netAmount), { bold: true })}
        `,
      )}
      ${renderStatementDetailSection(
        '任务收入流水明细',
        taskItems.length > 0
          ? taskItems
              .map(
                (item) => `
                  <div class="rounded-md border bg-muted/20 px-3 py-2">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs font-medium">${escapeHtml(item.ledgerNo ?? item.sourceItemId)}</div>
                        <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`${item.taskNo ?? item.taskId ?? '未绑定任务'} · ${item.productionOrderNo ?? item.productionOrderId ?? '未绑定生产单'}`)}</div>
                        <div class="text-[10px] text-muted-foreground">${escapeHtml(`回货批次 ${item.returnInboundBatchNo ?? '—'} · 价格来源 ${item.pricingSourceType === 'BIDDING' ? '中标价' : '派单价'}`)}</div>
                      </div>
                      <div class="text-right text-[10px]">
                        <div class="font-semibold text-foreground">${escapeHtml(formatAmount(item.earningAmount ?? item.deductionAmount, statement.settlementCurrency ?? 'IDR'))}</div>
                        <div class="text-muted-foreground">${escapeHtml(`${item.returnInboundQty ?? item.deductionQty} 件 · 单价 ${item.settlementUnitPrice ? formatAmount(item.settlementUnitPrice, statement.settlementCurrency ?? 'IDR') : '—'}`)}</div>
                      </div>
                    </div>
                  </div>
                `,
              )
              .join('')
          : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前对账单没有任务收入流水</div>',
      )}
      ${renderStatementDetailSection(
        '质量扣款流水明细',
        qualityItems.length > 0
          ? qualityItems
              .map(
                (item) => `
                  <div class="rounded-md border bg-muted/20 px-3 py-2">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs font-medium">${escapeHtml(item.ledgerNo ?? item.sourceItemId)}</div>
                        <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`质检记录 ${item.qcRecordId ?? '—'} · 待确认记录 ${item.pendingDeductionRecordId ?? '—'}`)}</div>
                        <div class="text-[10px] text-muted-foreground">${escapeHtml(`质量异议单 ${item.disputeId ?? '—'} · 责任数量 ${item.returnInboundQty ?? item.deductionQty} 件`)}</div>
                      </div>
                      <div class="text-right text-[10px]">
                        <div class="font-semibold text-red-600">${escapeHtml(formatAmount(Math.abs(item.qualityDeductionAmount ?? item.deductionAmount), statement.settlementCurrency ?? 'IDR'))}</div>
                        <div class="text-muted-foreground">${escapeHtml(`裁决结果 ${item.disputeId ? '已关联质量异议' : '无异议'}`)}</div>
                      </div>
                    </div>
                  </div>
                `,
              )
              .join('')
          : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前对账单没有质量扣款流水</div>',
      )}
      ${renderStatementDetailSection(
        '工厂反馈',
        `
          ${renderRow('反馈状态', getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}
          ${renderRow('反馈时间', statement.factoryFeedbackAt ? formatDateTime(statement.factoryFeedbackAt) : '当前未反馈')}
          ${renderRow('反馈人', statement.factoryFeedbackBy ?? '当前未反馈')}
          ${renderRow('处理结果', statement.resolutionResult === 'UPHELD' ? '维持当前口径' : statement.resolutionResult === 'REOPEN_REQUIRED' ? '退回重算' : '当前未处理')}
          ${renderRow('处理意见', statement.resolutionComment || '当前未处理')}
          ${
            appeals.length > 0
              ? `<div class="space-y-2 pt-1">${appeals
                  .map(
                    (record) => `
                      <div class="rounded-md border bg-muted/20 px-2.5 py-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-[10px] font-medium">${escapeHtml(record.reasonName)}</span>
                          <span class="text-[10px] text-muted-foreground">${escapeHtml(record.status === 'RESOLVED' ? '已处理完成' : record.status === 'PLATFORM_HANDLING' ? '平台处理中' : '已提交')}</span>
                        </div>
                        <div class="mt-1 text-[10px] text-muted-foreground">提交时间 ${escapeHtml(record.submittedAt)} · ${escapeHtml(record.submittedBy)}</div>
                        <div class="text-[10px] text-muted-foreground">处理意见 ${escapeHtml(record.resolutionComment || '当前未处理')}</div>
                      </div>
                    `,
                  )
                  .join('')}</div>`
              : ''
          }
        `,
      )}
      ${renderStatementDetailSection(
        '结算资料快照',
        `
          ${renderRow('对账单使用版本', statement.settlementProfileVersionNo)}
          ${renderRow('当前生效版本', currentEffective?.versionNo ?? '当前未初始化')}
          ${renderRow('结算币种', statement.settlementProfileSnapshot.settlementConfigSnapshot.currency)}
          ${renderRow('收款银行', `${statement.settlementProfileSnapshot.receivingAccountSnapshot.bankName} · 尾号 ${statement.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo.slice(-4)}`)}
          ${snapshotDiffNote ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-700">${escapeHtml(snapshotDiffNote)}</div>` : '<p class="text-[10px] leading-5 text-muted-foreground">当前对账单已冻结生成时的资料快照，后续主数据变更不会影响本单。</p>'}
        `,
      )}
      ${renderStatementDetailSection(
        '后续预付款信息',
        `
          ${renderRow('当前阶段', progress.summary)}
          ${renderRow('是否可进入预付款', progress.canEnterSettlement ? '可进入预付款批次' : '暂不可进入预付款批次')}
          ${renderRow('预付款批次号', batch?.batchNo ?? batch?.batchId ?? '当前未入预付款批次')}
          ${renderRow('飞书付款审批编号', approval?.approvalNo ?? '当前未申请')}
          ${renderRow('飞书付款审批状态', approval ? getFeishuStatusLabel(approval.status) : '当前未申请')}
          ${renderRow('打款时间', writeback?.paidAt ? formatDateTime(writeback.paidAt) : '当前未回写')}
          ${renderRow('银行回执', writeback?.bankReceiptName ?? '当前未登记')}
          ${renderRow('银行流水号', writeback?.bankSerialNo ?? '当前未登记')}
          <p class="text-[10px] leading-5 text-muted-foreground">${escapeHtml(progress.detail)}</p>
        `,
      )}
      <div class="grid grid-cols-2 gap-2">
        ${
          statement.status === 'PENDING_FACTORY_CONFIRM' && statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM'
            ? `
              <button class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700" data-pda-sett-action="confirm-statement" data-statement-id="${escapeHtml(statement.statementId)}">确认对账单</button>
              <button class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700" data-pda-sett-action="open-statement-appeal" data-statement-id="${escapeHtml(statement.statementId)}">发起对账单异议</button>
            `
            : `
              <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="open-statement-payment" data-statement-id="${escapeHtml(statement.statementId)}">查看预付款结果</button>
              <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-pda-sett-action="close-statement-drawer">关闭</button>
            `
        }
      </div>
    `,
    'close-statement-drawer',
  )
}

function renderStatementsTab(summary: SettlementCycleSummary): string {
  return `
    <div class="space-y-3 p-4">
      ${renderCard(
        '对账与预付款结果',
        `
          <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5 text-muted-foreground">
            这里只消费平台已成立的对账单、预付款批次、飞书付款审批状态和打款回写结果。工厂端不能在这里创建预付款批次、申请付款或创建打款回写。
          </div>
        `,
      )}
      ${renderCard(
        '对账单',
        summary.statements.length > 0
          ? summary.statements.map((statement) => renderStatementCard(statement, summary)).join('')
          : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前周期尚未生成对账单</div>',
      )}
      ${renderCard(
        '预付款',
        summary.batches.length > 0
          ? summary.batches.map((batch) => renderPrepaymentBatchCard(batch)).join('')
          : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前周期尚未进入预付款批次</div>',
      )}
      ${renderStatementDrawer()}
    </div>
  `
}

function renderCycleDetail(summary: SettlementCycleSummary): string {
  const detailTabs: Array<[DetailTab, string]> = [
    ['overview', '总览'],
    ['quality', '质检扣款'],
    ['ledgers', '正式流水'],
    ['statements', '对账与预付款'],
  ]

  let content = renderOverviewTab(summary)
  if (state.detailTab === 'quality') content = renderQualityTab(summary)
  if (state.detailTab === 'ledgers') content = renderLedgersTab(summary)
  if (state.detailTab === 'statements') content = renderStatementsTab(summary)

  return `
    <div class="flex items-center justify-between border-b bg-background px-4 py-3">
      <div class="min-w-0">
        <button class="inline-flex items-center gap-1 text-xs text-muted-foreground" data-pda-sett-action="back-to-cycles">
          <i data-lucide="chevron-left" class="h-3.5 w-3.5"></i>返回结算周期
        </button>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(summary.cycleLabel)}</div>
        <div class="text-[10px] text-muted-foreground">${escapeHtml(`${summary.cycleStartAt} ~ ${summary.cycleEndAt}`)}</div>
      </div>
      ${renderSettlementProfileEntryCard()}
    </div>
    <div class="border-b bg-background px-4 py-3">
      <div class="flex gap-2 overflow-x-auto pb-1">
        ${detailTabs
          .map(
            ([key, label]) => `
              <button
                class="inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium ${
                  state.detailTab === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'
                }"
                data-pda-sett-action="switch-detail-tab"
                data-tab="${key}"
                data-cycle-id="${escapeHtml(summary.cycleId)}"
              >
                ${escapeHtml(label)}
              </button>
            `,
          )
          .join('')}
      </div>
    </div>
    ${content}
    ${renderSettlementRequestDrawer()}
  `
}

function renderCycleListPage(): string {
  const context = getCurrentFactoryContext()
  const boundary = getSettlementPageBoundary('pda-settlement')
  const summaries = getSettlementCycleSummaries(context)
  return `
    <div class="space-y-3 px-4 py-4">
      <section class="rounded-lg border bg-card px-4 py-4 shadow-none">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-base font-bold">结算周期</h1>
            <p class="mt-1 text-[11px] leading-5 text-muted-foreground">${escapeHtml(boundary.pageIntro)}</p>
          </div>
          ${renderSettlementProfileEntryCard()}
        </div>
      </section>
      ${
        summaries.length > 0
          ? summaries.map((summary) => renderCycleCard(summary)).join('')
          : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前没有可查看的结算周期</div>'
      }
      ${renderSettlementRequestDrawer()}
    </div>
  `
}

function renderSettlementContent(): string {
  syncSettlementStateFromRoute()
  if (state.pageMode === 'cycle-detail') {
    const summary = getSelectedCycleSummary()
    if (summary) return renderCycleDetail(summary)
  }
  return renderCycleListPage()
}

export function renderPdaSettlementPage(): string {
  if (!getPdaRuntimeContext()) {
    return renderPdaLoginRedirect()
  }

  return renderPdaFrame(renderSettlementContent(), 'settlement')
}

export function handlePdaSettlementEvent(target: HTMLElement): boolean {
  if (!ensurePdaSessionForAction()) return true

  const actionNode = target.closest<HTMLElement>('[data-pda-sett-action]')
  const fieldNode = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-pda-sett-field]')

  if (fieldNode) {
    const field = fieldNode.dataset.pdaSettField
    if (field === 'quality-search') {
      state.qualitySearch = fieldNode.value
      return true
    }
    if (field === 'ledger-keyword') {
      state.ledgerKeyword = fieldNode.value
      return true
    }
    if (field === 'statement-appeal-reason') {
      state.statementAppealForm.reason = fieldNode.value
      return true
    }
    if (field === 'statement-appeal-description') {
      state.statementAppealForm.description = fieldNode.value
      return true
    }
    if (field === 'statement-appeal-evidence') {
      state.statementAppealForm.evidenceSummary = fieldNode.value
      return true
    }
    if (field === 'request.accountHolderName') {
      state.settlementRequestForm.accountHolderName = fieldNode.value
      return true
    }
    if (field === 'request.idNumber') {
      state.settlementRequestForm.idNumber = fieldNode.value
      return true
    }
    if (field === 'request.bankName') {
      state.settlementRequestForm.bankName = fieldNode.value
      return true
    }
    if (field === 'request.bankAccountNo') {
      state.settlementRequestForm.bankAccountNo = fieldNode.value
      return true
    }
    if (field === 'request.bankBranch') {
      state.settlementRequestForm.bankBranch = fieldNode.value
      return true
    }
    if (field === 'request.submitRemark') {
      state.settlementRequestForm.submitRemark = fieldNode.value
      return true
    }
  }

  if (!actionNode) return false
  const action = actionNode.dataset.pdaSettAction
  if (!action) return false

  if (action === 'open-cycle-detail') {
    const cycleId = actionNode.dataset.cycleId
    if (!cycleId) return true
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = resolveSettlementCycleId(cycleId)
    state.detailTab = 'overview'
    state.ledgerDrawerId = null
    state.statementDrawerMode = null
    appStore.navigate(buildSettlementDetailHref('overview', state.selectedCycleId))
    return true
  }

  if (action === 'back-to-cycles') {
    state.pageMode = 'cycles'
    state.selectedCycleId = null
    state.ledgerDrawerId = null
    state.statementDrawerMode = null
    appStore.navigate(buildSettlementListHref())
    return true
  }

  if (action === 'switch-detail-tab') {
    const tab = actionNode.dataset.tab as DetailTab | undefined
    const cycleId = resolveSettlementCycleId(actionNode.dataset.cycleId || state.selectedCycleId)
    if (!tab) return true
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = tab
    state.ledgerDrawerId = null
    if (tab === 'quality') {
      appStore.navigate(buildSettlementDetailHref('quality', cycleId, { qualityView: state.qualityView }))
    } else if (tab === 'ledgers') {
      appStore.navigate(buildSettlementDetailHref('ledgers', cycleId, {
        ledgerTypeView: state.ledgerTypeView,
        ledgerStatusView: state.ledgerStatusView,
      }))
    } else {
      appStore.navigate(buildSettlementDetailHref(tab, cycleId))
    }
    return true
  }

  if (action === 'open-quality-workbench') {
    const cycleId = resolveSettlementCycleId(actionNode.dataset.cycleId || state.selectedCycleId)
    const view = (actionNode.dataset.view as QualityView | undefined) ?? 'pending'
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'quality'
    state.qualityView = view
    appStore.navigate(buildSettlementDetailHref('quality', cycleId, { qualityView: view }))
    return true
  }

  if (action === 'set-quality-view') {
    const view = actionNode.dataset.view as QualityView | undefined
    const cycleId = resolveSettlementCycleId(actionNode.dataset.cycleId || state.selectedCycleId)
    if (!view) return true
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'quality'
    state.qualityView = view
    appStore.navigate(buildSettlementDetailHref('quality', cycleId, { qualityView: view }))
    return true
  }

  if (action === 'set-ledger-type-view') {
    const nextValue = actionNode.dataset.value as LedgerTypeView | undefined
    const cycleId = resolveSettlementCycleId(actionNode.dataset.cycleId || state.selectedCycleId)
    if (!nextValue) return true
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'ledgers'
    state.ledgerTypeView = nextValue
    appStore.navigate(buildSettlementDetailHref('ledgers', cycleId, {
      ledgerTypeView: state.ledgerTypeView,
      ledgerStatusView: state.ledgerStatusView,
    }))
    return true
  }

  if (action === 'set-ledger-status-view') {
    const nextValue = actionNode.dataset.value as LedgerStatusView | undefined
    const cycleId = resolveSettlementCycleId(actionNode.dataset.cycleId || state.selectedCycleId)
    if (!nextValue) return true
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'ledgers'
    state.ledgerStatusView = nextValue
    appStore.navigate(buildSettlementDetailHref('ledgers', cycleId, {
      ledgerTypeView: state.ledgerTypeView,
      ledgerStatusView: state.ledgerStatusView,
    }))
    return true
  }

  if (action === 'open-ledger-detail') {
    const ledgerId = actionNode.dataset.ledgerId
    if (!ledgerId) return true
    state.ledgerDrawerId = ledgerId
    return true
  }

  if (action === 'close-ledger-drawer') {
    state.ledgerDrawerId = null
    return true
  }

  if (action === 'open-statement-detail') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    state.statementDrawerMode = 'detail'
    state.statementDetailId = statementId
    state.statementErrorText = ''
    return true
  }

  if (action === 'open-statement-payment') {
    const statementId = actionNode.dataset.statementId || state.statementDetailId
    if (!statementId) return true
    state.statementDrawerMode = 'payment'
    state.statementDetailId = statementId
    state.statementErrorText = ''
    return true
  }

  if (action === 'open-statement-appeal') {
    const statementId = actionNode.dataset.statementId || state.statementDetailId
    if (!statementId) return true
    resetStatementAppealForm()
    state.statementDrawerMode = 'appeal'
    state.statementDetailId = statementId
    state.statementErrorText = ''
    return true
  }

  if (action === 'close-statement-drawer') {
    state.statementDrawerMode = null
    state.statementDetailId = null
    state.statementErrorText = ''
    resetStatementAppealForm()
    return true
  }

  if (action === 'confirm-statement') {
    const statementId = actionNode.dataset.statementId || state.statementDetailId
    if (!statementId) return true
    const context = getCurrentFactoryContext()
    const result = submitStatementFactoryConfirmation({
      statementId,
      by: context.operatorName,
      remark: '工厂端已确认本期对账单口径',
    })
    state.statementErrorText = result.message
    if (result.ok) {
      state.statementDrawerMode = 'detail'
      state.statementDetailId = statementId
    }
    return true
  }

  if (action === 'submit-statement-appeal') {
    const statementId = actionNode.dataset.statementId || state.statementDetailId
    if (!statementId) return true
    if (!state.statementAppealForm.reason.trim() || !state.statementAppealForm.description.trim()) {
      state.statementErrorText = '请先补全异议原因和异议说明'
      return true
    }
    const context = getCurrentFactoryContext()
    const result = submitStatementFactoryAppeal({
      statementId,
      by: context.operatorName,
      reason: state.statementAppealForm.reason.trim(),
      description: state.statementAppealForm.description.trim(),
      evidenceSummary: state.statementAppealForm.evidenceSummary.trim(),
    })
    state.statementErrorText = result.message
    if (result.ok) {
      state.statementDrawerMode = 'detail'
      state.statementDetailId = statementId
      resetStatementAppealForm()
    }
    return true
  }

  if (action === 'open-settlement-change-request') {
    const context = getCurrentFactoryContext()
    const effective = getCurrentEffectiveSettlementInfo(context.factoryCode)
    if (!effective) {
      state.settlementRequestDrawerMode = null
      state.settlementRequestDetailId = null
      state.settlementRequestErrorText = '当前工厂尚未初始化结算资料'
      return true
    }
    const activeRequest = getSettlementActiveRequestByFactory(context.factoryCode)
    if (activeRequest) {
      state.settlementRequestDrawerMode = 'detail'
      state.settlementRequestDetailId = activeRequest.requestId
      state.settlementRequestErrorText = '当前已有申请处理中'
      return true
    }
    resetSettlementRequestForm()
    state.settlementRequestDrawerMode = 'create'
    state.settlementRequestDetailId = null
    return true
  }

  if (action === 'open-settlement-profile') {
    state.settlementRequestDrawerMode = 'profile'
    state.settlementRequestDetailId = null
    state.settlementRequestErrorText = ''
    return true
  }

  if (action === 'open-settlement-request-detail') {
    const context = getCurrentFactoryContext()
    const requestId =
      actionNode.dataset.requestId ||
      getSettlementActiveRequestByFactory(context.factoryCode)?.requestId ||
      getSettlementLatestRequestByFactory(context.factoryCode)?.requestId ||
      null
    state.settlementRequestDrawerMode = 'detail'
    state.settlementRequestDetailId = requestId
    state.settlementRequestErrorText = requestId ? '' : '当前暂无申请记录'
    return true
  }

  if (action === 'open-settlement-request-history') {
    state.settlementRequestDrawerMode = 'history'
    state.settlementRequestDetailId = null
    state.settlementRequestErrorText = ''
    return true
  }

  if (action === 'open-settlement-version-history') {
    state.settlementRequestDrawerMode = 'versions'
    state.settlementRequestDetailId = null
    state.settlementRequestErrorText = ''
    return true
  }

  if (action === 'back-to-settlement-profile') {
    state.settlementRequestDrawerMode = 'profile'
    state.settlementRequestDetailId = null
    state.settlementRequestErrorText = ''
    return true
  }

  if (action === 'close-settlement-request-drawer') {
    state.settlementRequestDrawerMode = null
    state.settlementRequestDetailId = null
    state.settlementRequestErrorText = ''
    state.settlementRequestErrors = {}
    return true
  }

  if (action === 'submit-settlement-change-request') {
    const context = getCurrentFactoryContext()
    const errors = validateSettlementRequestForm()
    if (Object.keys(errors).length > 0) {
      state.settlementRequestErrors = errors
      state.settlementRequestErrorText = '请先补全必填项'
      return true
    }

    const result = createSettlementChangeRequest({
      factoryId: context.factoryCode,
      submittedBy: context.operatorName,
      submitRemark: state.settlementRequestForm.submitRemark,
      after: {
        accountHolderName: state.settlementRequestForm.accountHolderName.trim(),
        idNumber: state.settlementRequestForm.idNumber.trim(),
        bankName: state.settlementRequestForm.bankName.trim(),
        bankAccountNo: state.settlementRequestForm.bankAccountNo.trim(),
        bankBranch: state.settlementRequestForm.bankBranch.trim(),
      },
    })

    state.settlementRequestErrorText = result.message
    if (!result.ok) return true

    state.settlementRequestErrors = {}
    state.settlementRequestDrawerMode = 'detail'
    state.settlementRequestDetailId = result.data.requestId
    return true
  }

  return false
}
