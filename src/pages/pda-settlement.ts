import { appStore } from '../state/store'
import { renderPdaFrame } from './pda-shell'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import {
  getFutureMobileFactoryQcSummary,
  getFutureMobileFactoryQcDetail,
  listFutureMobileFactoryQcBuckets,
  listFutureMobileFactorySoonOverdueQcItems,
  listFutureSettlementAdjustmentItems,
  listPdaSettlementWritebackItems,
  type FutureMobileFactoryQcListItem,
  type FutureMobileFactoryQcDetail,
  type FutureSettlementAdjustmentListItem,
} from '../data/fcs/quality-deduction-selectors'
import { listQualityDeductionCaseFacts } from '../data/fcs/quality-deduction-repository'
import {
  buildDeductionEntryHrefByBasisId,
} from '../data/fcs/quality-chain-adapter'
import { escapeHtml, formatDateTime, toClassName } from '../utils'
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
  type SettlementEffectiveInfoSnapshot,
  type SettlementVersionRecord,
} from '../data/fcs/settlement-change-requests'

type SettlementPageMode = 'cycles' | 'cycle-detail'
type DetailTab = 'overview' | 'quality' | 'tasks' | 'deductions'
type TaskView = 'week' | 'all'
type DedView = 'week' | 'all'
type QualityView = 'pending' | 'soon' | 'disputing' | 'processed' | 'history'
type LedgerSourceView = 'all' | 'quality' | 'other'
type LedgerFinancialView = 'all' | 'blocked' | 'effective' | 'adjustment' | 'reversed'
type SettlementLedgerSourceType = 'QUALITY' | 'OTHER'
type SettlementLedgerFinancialStatus = 'BLOCKED' | 'EFFECTIVE' | 'NEXT_CYCLE_ADJUSTMENT_PENDING' | 'REVERSED'

type SettlementStatus = '待结算' | '部分结算' | '已结算'
type PaymentStatus = '待付款' | '部分付款' | '已付款'
type DeductionSettlementStatus = '待计入结算' | '已计入结算' | '处理中'
type CycleStatus = '待生成' | '待付款' | '部分付款' | '已付款'
type DeductionReason = '质量不合格' | '质量问题扣款' | '数量差异扣款' | '交接异常扣款' | '其他扣款'
type DeductionSource = '接收质检不合格' | '完工质检不合格' | '交接争议确认扣款' | '逾期违约扣款' | '辅料超耗扣款' | '数量短缺扣款'
type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'orange'

interface TaskIncome {
  taskId: string
  productionOrderId: string
  spuName: string
  process: string
  completedQty: number
  qualifiedQty: number
  defectQty: number
  qtyUnit: string
  unitPrice: number
  grossIncome: number
  deductionAmount: number
  netIncome: number
  settlementStatus: SettlementStatus
  paymentStatus: PaymentStatus
  cycleId: string
  shouldPayAmount: number
  paidAmount: number
  unpaidAmount: number
  isCurrentWeek?: boolean
  lastPaymentDate?: string
  payments?: Array<{ seq: string; date: string; amount: number }>
  linkedQualityQcIds?: string[]
}

interface DeductionRecord {
  deductionId: string
  taskId: string
  productionOrderId: string
  spuName: string
  process: string
  reason: DeductionReason
  source: DeductionSource
  defectQty: number
  qtyUnit: string
  unitDeductPrice?: number
  deductQty?: number
  amount: number
  includedInSettlement: boolean
  settlementStatus: DeductionSettlementStatus
  cycleId?: string
  cycleIncludedAt?: string
  problemSummary: string
  responsibilitySummary: string
  currentStatus: string
  isCurrentWeek?: boolean
  linkedQcIds?: string[]
}

interface TaskIncomeListItemViewModel {
  task: TaskIncome
  hasLinkedQualityCases: boolean
  hasAdjustment: boolean
}

interface TaskLinkedDeductionItemViewModel {
  record: DeductionRecord
  sourceLabel: string
  isQualityDeduction: boolean
  linkedQcIds: string[]
}

interface TaskLinkedQualityCaseViewModel {
  qcId: string
  qcNo: string
  productionOrderNo: string
  returnInboundBatchNo: string
  processLabel: string
  inspectedAt: string
  qcResultLabel: string
  factoryLiabilityQty: number
  factoryResponseStatusLabel: string
  disputeStatusLabel: string
  settlementImpactStatusLabel: string
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  adjustmentSummary?: string
  detailHref: string
}

interface TaskSettlementImpactViewModel {
  taskLedgerQualityDeductionAmount: number
  taskLedgerOtherDeductionAmount: number
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  includedCurrentCycleCount: number
  pendingCurrentCycleCount: number
  nextCycleAdjustmentAmount: number
  adjustmentItems: FutureSettlementAdjustmentListItem[]
  statusSummary: string
  unlinkedDeductionAmount: number
}

interface TaskIncomeDetailViewModel {
  task: TaskIncome
  linkedDeductionItems: TaskLinkedDeductionItemViewModel[]
  linkedQualityCases: TaskLinkedQualityCaseViewModel[]
  settlementImpact: TaskSettlementImpactViewModel
}

interface PaymentRecord {
  paymentId: string
  cycleId: string
  paymentDate: string
  amount: number
  method: string
  status: '已完成' | '处理中'
  remark: string
}

interface SettlementCycle {
  cycleId: string
  periodStart: string
  periodEnd: string
  taskCount: number
  completedQty: number
  qualifiedQty: number
  defectQty: number
  grossIncome: number
  deductionAmount: number
  shouldPayAmount: number
  paidAmount: number
  unpaidAmount: number
  status: CycleStatus
  isCurrentWeek?: boolean
  lastPaymentDate?: string
  nextPaymentNote?: string
  paymentCount: number
  paidCount: number
  tasks: TaskIncome[]
  payments: PaymentRecord[]
}

interface PdaSettlementState {
  lastRouteSyncKey: string
  pageMode: SettlementPageMode
  selectedCycleId: string | null
  detailTab: DetailTab
  qualityView: QualityView
  qualitySearch: string
  taskView: TaskView
  dedView: DedView
  dedSourceView: LedgerSourceView
  dedFinanceView: LedgerFinancialView
  taskSearch: string
  dedSearch: string
  showHistory: boolean
  showInfo: boolean
  taskDrawerTaskId: string | null
  dedDrawerId: string | null
  cycleDrawerId: string | null
  settlementRequestDrawerMode: 'create' | 'detail' | 'profile' | 'history' | 'versions' | null
  settlementRequestDetailId: string | null
  settlementRequestErrors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>>
  settlementRequestErrorText: string
  settlementRequestForm: SettlementEffectiveInfoSnapshot & { submitRemark: string }
}

interface PlatformQcWritebackItem {
  basisId: string
  qcId: string
  productionOrderId: string
  taskId?: string
  batchId?: string
  processLabel: string
  warehouseName: string
  returnFactoryName: string
  summary: string
  liabilityStatusText: string
  settlementStatusText: string
  settlementVariant: BadgeVariant
  deductionQty: number
  deductionAmountCny: number
  inspectedAt: string
}

interface SettlementLedgerCurrencyDisplay {
  settlementCurrency: string
  settlementAmount: number
  settlementAmountLabel: string
  originalCurrency: string
  originalAmount: number
  originalAmountLabel: string
  rate: number
  rateLabel: string
  fxAppliedAt: string
  isConverted: boolean
}

interface SettlementLedgerItemViewModel {
  ledgerId: string
  ledgerNo: string
  sourceType: SettlementLedgerSourceType
  sourceTypeLabel: string
  financialStatus: SettlementLedgerFinancialStatus
  financialStatusLabel: string
  financialStatusVariant: BadgeVariant
  reason: string
  sourceSummary: string
  summary: string
  currentStatusText: string
  cycleId?: string
  targetCycleId?: string
  taskId?: string
  productionOrderId: string
  spuName?: string
  processLabel: string
  qcId?: string
  qcNo?: string
  basisId?: string
  adjustmentId?: string
  adjustmentNo?: string
  adjustmentTypeLabel?: string
  writebackStatusLabel?: string
  includedInCurrentCycle: boolean
  isCurrentWeek: boolean
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  adjustmentAmount: number
  currencyDisplay: SettlementLedgerCurrencyDisplay
  keyTime: string
  keyTimeLabel: string
}

interface SettlementLedgerOverviewViewModel {
  itemCount: number
  settlementCurrency: string
  totalAmount: number
  blockedAmount: number
  adjustmentAmount: number
}

interface SettlementLedgerDetailViewModel {
  item: SettlementLedgerItemViewModel
  linkedTask: TaskIncome | null
  linkedQualityCase: FutureMobileFactoryQcDetail | null
}

type QualityCaseFact = (ReturnType<typeof listQualityDeductionCaseFacts>)[number]

const CURRENT_FACTORY_ID = 'ID-FAC-0001'
const CURRENT_FACTORY_OPERATOR = '工厂财务-Adi'

applyQualitySeedBootstrap()

const state: PdaSettlementState = {
  lastRouteSyncKey: '',
  pageMode: 'cycles',
  selectedCycleId: null,
  detailTab: 'overview',
  qualityView: 'pending',
  qualitySearch: '',
  taskView: 'week',
  dedView: 'week',
  dedSourceView: 'all',
  dedFinanceView: 'all',
  taskSearch: '',
  dedSearch: '',
  showHistory: false,
  showInfo: false,
  taskDrawerTaskId: null,
  dedDrawerId: null,
  cycleDrawerId: null,
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
}

function fmtIDR(n: number): string {
  return `${n.toLocaleString('id-ID')} IDR`
}

function fmtRate(n: number, unit = '件'): string {
  return `${n.toLocaleString('id-ID')} IDR/${unit}`
}

function fmtQty(n: number, unit = '件'): string {
  return `${n.toLocaleString('id-ID')} ${unit}`
}

function fmtCny(n: number): string {
  return `${n.toLocaleString('zh-CN')} CNY`
}

function formatCurrencyByCode(amount: number, currency: string): string {
  if (currency === 'IDR') return fmtIDR(amount)
  if (currency === 'CNY') return fmtCny(amount)
  return `${amount.toLocaleString('zh-CN')} ${currency}`
}

function fmtFxRate(rate: number, fromCurrency: string, toCurrency: string): string {
  return `1 ${fromCurrency} = ${formatCurrencyByCode(rate, toCurrency)}`
}

function getCurrentSettlementEffectiveInfo() {
  return getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
}

function getSettlementDisplayCurrency(): string {
  return getCurrentSettlementEffectiveInfo()?.settlementConfigSnapshot.currency ?? 'IDR'
}

const SETTLEMENT_FX_RATE_TABLE: Record<string, { rate: number; appliedAt: string }> = {
  'CNY->IDR': { rate: 2_250, appliedAt: '2026-03-13 13:26' },
}

function getLedgerCurrencyDisplay(input: {
  amount: number
  originalCurrency?: string
  referenceAt?: string
}): SettlementLedgerCurrencyDisplay {
  const settlementCurrency = getSettlementDisplayCurrency()
  const originalCurrency = input.originalCurrency ?? settlementCurrency
  const originalAmount = input.amount

  if (originalCurrency === settlementCurrency) {
    const appliedAt = input.referenceAt || getCurrentSettlementEffectiveInfo()?.effectiveAt || '—'
    return {
      settlementCurrency,
      settlementAmount: originalAmount,
      settlementAmountLabel: formatCurrencyByCode(originalAmount, settlementCurrency),
      originalCurrency,
      originalAmount,
      originalAmountLabel: formatCurrencyByCode(originalAmount, originalCurrency),
      rate: 1,
      rateLabel: `1 ${settlementCurrency} = 1 ${settlementCurrency}`,
      fxAppliedAt: appliedAt,
      isConverted: false,
    }
  }

  const fxKey = `${originalCurrency}->${settlementCurrency}`
  const fxMeta =
    SETTLEMENT_FX_RATE_TABLE[fxKey] ??
    ({
      rate: 1,
      appliedAt: input.referenceAt || getCurrentSettlementEffectiveInfo()?.effectiveAt || '—',
    } as const)
  const settlementAmount = Math.round(originalAmount * fxMeta.rate)

  return {
    settlementCurrency,
    settlementAmount,
    settlementAmountLabel: formatCurrencyByCode(settlementAmount, settlementCurrency),
    originalCurrency,
    originalAmount,
    originalAmountLabel: formatCurrencyByCode(originalAmount, originalCurrency),
    rate: fxMeta.rate,
    rateLabel: fmtFxRate(fxMeta.rate, originalCurrency, settlementCurrency),
    fxAppliedAt: fxMeta.appliedAt,
    isConverted: true,
  }
}

function formatSettlementAwareAmount(amount: number, originalCurrency = 'CNY', referenceAt?: string): string {
  if (!amount) return '—'
  const display = getLedgerCurrencyDisplay({ amount, originalCurrency, referenceAt })
  if (!display.isConverted) return display.settlementAmountLabel
  return `${display.settlementAmountLabel}（原 ${display.originalAmountLabel} · ${display.rateLabel} · ${formatDateTime(display.fxAppliedAt)}）`
}

function getQualityFxReferenceAt(items: Array<{ inspectedAt?: string }>): string | undefined {
  return items
    .map((item) => item.inspectedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getChangedSettlementFields(request: SettlementChangeRequest): string {
  const changed: string[] = []
  if (request.before.accountHolderName !== request.after.accountHolderName) changed.push('开户名')
  if (request.before.idNumber !== request.after.idNumber) changed.push('证件号')
  if (request.before.bankName !== request.after.bankName) changed.push('银行名称')
  if (request.before.bankAccountNo !== request.after.bankAccountNo) changed.push('银行账号')
  if (request.before.bankBranch !== request.after.bankBranch) changed.push('开户支行')
  return changed.length > 0 ? changed.join('、') : '信息确认'
}

function getRequestNextStepText(request: SettlementChangeRequest): string {
  if (request.status === 'PENDING_REVIEW') return '平台正在审核申请，待上传签字证明后完成通过处理'
  if (request.status === 'APPROVED') return '申请已通过，当前结算资料已更新为新版本'
  return request.rejectReason || '申请未通过，可重新发起申请'
}

function getSettlementRequestListByCurrentFactory(): SettlementChangeRequest[] {
  return listSettlementRequestsByFactory(CURRENT_FACTORY_ID)
}

function getSettlementRequestForDrawer(): SettlementChangeRequest | null {
  if (state.settlementRequestDetailId) {
    return (
      getSettlementRequestListByCurrentFactory().find((item) => item.requestId === state.settlementRequestDetailId) ?? null
    )
  }

  return getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID) ?? getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)
}

function getVersionStatusLabel(status: SettlementVersionRecord['status']): string {
  return status === 'EFFECTIVE' ? '生效中' : '已失效'
}

function getVersionStatusClass(status: SettlementVersionRecord['status']): string {
  return status === 'EFFECTIVE'
    ? 'border-green-200 bg-green-50 text-green-700'
    : 'border-slate-200 bg-slate-50 text-slate-600'
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
              class="w-full rounded-md border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/30"
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
                  <p class="mt-1 text-[10px] text-muted-foreground">提交时间：${escapeHtml(request.submittedAt)} · 提交人：${escapeHtml(
                    request.submittedBy,
                  )}</p>
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
  const orderedRecords = records.slice().sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))

  if (records.length === 0) {
    return '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无结算资料版本沿革</div>'
  }

  return `
    <div class="space-y-2">
      ${orderedRecords
        .map(
          (record) => `
            <div class="rounded-md border bg-background px-3 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold">${escapeHtml(record.versionNo)}</span>
                    <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getVersionStatusClass(record.status)}">${escapeHtml(
                      getVersionStatusLabel(record.status),
                    )}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">生效时间：${escapeHtml(record.effectiveAt)} · 生效人：${escapeHtml(record.effectiveBy)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">版本来源：${escapeHtml(record.changeSource)}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">变更项：${escapeHtml(record.changeItems.join('、') || '—')}</p>
                  <p class="mt-1 text-[10px] text-muted-foreground">收款账户：${escapeHtml(record.bankName)} · 尾号 ${escapeHtml(
                    record.bankAccountNo.slice(-4),
                  )}</p>
                  ${
                    record.expiryAt
                      ? `<p class="mt-1 text-[10px] text-muted-foreground">失效时间：${escapeHtml(record.expiryAt)}</p>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function getCurrentFactoryIdentity() {
  const current =
    indonesiaFactories.find((item) => item.code === CURRENT_FACTORY_ID || item.id === CURRENT_FACTORY_ID) ?? null
  return {
    current,
    keys: new Set([CURRENT_FACTORY_ID, current?.id, current?.code].filter(Boolean) as string[]),
  }
}

function getCurrentQualityFactoryId(): string {
  return getCurrentFactoryIdentity().current?.id ?? CURRENT_FACTORY_ID
}

function getCurrentSettlementSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function getDefaultSettlementCycleId(): string {
  return CW.cycleId
}

function resolveSettlementCycleId(candidate?: string | null): string {
  const resolved = candidate ? getCycleById(candidate)?.cycleId : null
  return resolved ?? getDefaultSettlementCycleId()
}

function buildSettlementListHref(): string {
  return '/fcs/pda/settlement'
}

function buildSettlementDetailHref(
  detailTab: DetailTab = state.detailTab,
  cycleId: string = resolveSettlementCycleId(state.selectedCycleId),
  options?: { qualityView?: QualityView },
): string {
  const params = new URLSearchParams()
  params.set('tab', detailTab)
  params.set('cycleId', resolveSettlementCycleId(cycleId))
  if (detailTab === 'quality' && options?.qualityView) {
    params.set('view', options.qualityView)
  }
  return `${buildSettlementListHref()}?${params.toString()}`
}

function syncSettlementStateFromRoute(): void {
  const routeKey = appStore.getState().pathname
  if (state.lastRouteSyncKey === routeKey) return

  const params = getCurrentSettlementSearchParams()
  const tab = params.get('tab')
  const cycleId = params.get('cycleId')

  if (tab === 'cycles' || (!tab && !cycleId)) {
    state.pageMode = 'cycles'
    state.selectedCycleId = null
  } else if (tab && ['overview', 'quality', 'tasks', 'deductions'].includes(tab)) {
    state.pageMode = 'cycle-detail'
    state.detailTab = tab as DetailTab
    state.selectedCycleId = resolveSettlementCycleId(cycleId)
  } else if (cycleId) {
    state.pageMode = 'cycle-detail'
    state.detailTab = 'overview'
    state.selectedCycleId = resolveSettlementCycleId(cycleId)
  } else {
    state.pageMode = 'cycles'
    state.selectedCycleId = null
  }

  const view = params.get('view')
  if (view && ['pending', 'soon', 'disputing', 'processed', 'history'].includes(view)) {
    state.qualityView = view as QualityView
  }

  state.lastRouteSyncKey = routeKey
}

function buildPdaQualityDetailHref(qcId: string): string {
  return `/fcs/pda/quality/${encodeURIComponent(qcId)}`
}

function getRemainingDeadlineSummary(deadline?: string): string {
  if (!deadline) return '无需响应'
  const diff = new Date(deadline.replace(' ', 'T')).getTime() - Date.now()
  if (diff <= 0) return '已超时'
  const hours = Math.ceil(diff / (3600 * 1000))
  if (hours < 24) return `剩余 ${hours} 小时`
  const days = Math.floor(hours / 24)
  return `剩余 ${days} 天 ${hours % 24} 小时`
}

function matchesQualityKeyword(item: FutureMobileFactoryQcListItem, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return [item.qcNo, item.returnInboundBatchNo, item.productionOrderNo, item.processLabel].some((value) =>
    value.toLowerCase().includes(normalized),
  )
}

function getPlatformQcWritebackItems(): PlatformQcWritebackItem[] {
  const identity = getCurrentFactoryIdentity()
  return listPdaSettlementWritebackItems(identity.keys)
    .map((item) => {
      const settlementVariant: BadgeVariant =
        item.settlementStatusText.includes('已结算') || item.settlementStatusText.includes('可结算')
          ? 'green'
          : item.liabilityStatusText === '争议中'
            ? 'amber'
            : 'orange'

      return {
        basisId: item.basisId,
        qcId: item.qcId,
        productionOrderId: item.productionOrderId,
        taskId: item.taskId,
        batchId: item.batchId,
        processLabel: item.processLabel,
        warehouseName: item.warehouseName,
        returnFactoryName: item.returnFactoryName || identity.current?.name || '-',
        summary: item.summary,
        liabilityStatusText: item.liabilityStatusText,
        settlementStatusText: item.settlementStatusText,
        settlementVariant,
        deductionQty: item.deductionQty,
        deductionAmountCny: item.deductionAmountCny,
        inspectedAt: item.inspectedAt,
      }
    })
    .sort((left, right) => {
      return new Date(right.inspectedAt.replace(' ', 'T')).getTime() - new Date(left.inspectedAt.replace(' ', 'T')).getTime()
    })
}

function getCompactPlatformQcWritebackItems(items: PlatformQcWritebackItem[]): PlatformQcWritebackItem[] {
  if (items.length <= 3) return items

  const picks: PlatformQcWritebackItem[] = []
  const pushIfPresent = (item?: PlatformQcWritebackItem) => {
    if (!item) return
    if (picks.some((current) => current.basisId === item.basisId)) return
    picks.push(item)
  }

  pushIfPresent(items.find((item) => item.liabilityStatusText === '争议中'))
  pushIfPresent(items.find((item) => item.liabilityStatusText === '改判生效'))
  pushIfPresent(items.find((item) => item.settlementStatusText.includes('已结算')))

  for (const item of items) {
    pushIfPresent(item)
    if (picks.length >= 3) break
  }

  return picks.slice(0, 3)
}

function renderPlatformQcWritebackSection(compact = false): string {
  const items = getPlatformQcWritebackItems()
  const identity = getCurrentFactoryIdentity()
  if (items.length === 0) return ''

  const visibleItems = compact ? getCompactPlatformQcWritebackItems(items) : items
  const readyCount = items.filter((item) => item.settlementVariant === 'green').length
  const frozenCount = items.filter((item) => item.settlementVariant !== 'green').length
  const disputedCount = items.filter((item) => item.liabilityStatusText === '争议中').length
  const totalQty = items.reduce((sum, item) => sum + item.deductionQty, 0)
  const totalAmountCny = items.reduce((sum, item) => sum + item.deductionAmountCny, 0)
  const fxReferenceAt = getQualityFxReferenceAt(items)

  return `
    <article class="rounded-lg border border-sky-200 bg-sky-50/40 shadow-none">
      <header class="border-b border-sky-100 px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-sky-900">平台回写的仓库质检扣款</h3>
            <p class="mt-0.5 text-[10px] text-sky-700">${escapeHtml(
              `${identity.current?.name ?? CURRENT_FACTORY_ID} 的仓库质检结果已同步到平台运营系统，PDA 结算可直接看到对应扣款依据。`,
            )}</p>
          </div>
          ${
            compact && items.length > visibleItems.length
              ? `
                <button class="rounded-md border border-sky-200 bg-white px-3 py-1.5 text-[10px] text-sky-700 hover:bg-sky-50" data-pda-sett-action="open-platform-quality-deductions">
                  查看全部 ${items.length} 条
                </button>
              `
              : ''
          }
        </div>
      </header>

      <div class="grid grid-cols-2 gap-2 border-b border-sky-100 px-4 py-3 md:grid-cols-4">
        <div class="rounded-md border bg-white/80 px-3 py-2">
          <div class="text-[10px] text-muted-foreground">质检扣款条数</div>
          <div class="mt-0.5 text-sm font-semibold">${items.length}</div>
        </div>
        <div class="rounded-md border bg-white/80 px-3 py-2">
          <div class="text-[10px] text-muted-foreground">影响数量</div>
          <div class="mt-0.5 text-sm font-semibold">${totalQty} 件</div>
        </div>
        <div class="rounded-md border bg-white/80 px-3 py-2">
          <div class="text-[10px] text-muted-foreground">平台判责金额</div>
          <div class="mt-0.5 text-sm font-semibold">${escapeHtml(formatSettlementAwareAmount(totalAmountCny, 'CNY', fxReferenceAt))}</div>
        </div>
        <div class="rounded-md border bg-white/80 px-3 py-2">
          <div class="text-[10px] text-muted-foreground">结算状态</div>
          <div class="mt-0.5 text-sm font-semibold">${readyCount} 条可结算 / ${frozenCount} 条冻结</div>
          <div class="mt-0.5 text-[10px] text-muted-foreground">争议中 ${disputedCount} 条</div>
        </div>
      </div>

      <div class="space-y-2 px-4 py-3">
        ${visibleItems
          .map(
            (item) => `
              <div class="rounded-md border bg-background px-3 py-2.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-[11px] font-medium text-primary">${escapeHtml(item.basisId)}</span>
                  ${renderStatusBadge(item.settlementStatusText, item.settlementVariant)}
                  <span class="text-[10px] text-muted-foreground">质检单 ${escapeHtml(item.qcId)}</span>
                </div>
                <div class="mt-1 text-xs font-medium">${escapeHtml(item.summary)}</div>
                <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>${escapeHtml(item.processLabel)} · ${escapeHtml(item.batchId || '-')}</span>
                  <span>${escapeHtml(item.returnFactoryName)} / ${escapeHtml(item.warehouseName)}</span>
                  <span>责任状态 ${escapeHtml(item.liabilityStatusText)}</span>
                  <span>可扣款数量 ${item.deductionQty} 件</span>
                  <span>平台金额 ${escapeHtml(formatSettlementAwareAmount(item.deductionAmountCny, 'CNY', item.inspectedAt))}</span>
                  <span>${escapeHtml(formatDateTime(item.inspectedAt))}</span>
                </div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button class="rounded-md border px-3 py-1.5 text-[10px] hover:bg-muted" data-nav="/fcs/pda/quality/${escapeHtml(item.qcId)}?back=settlement">
                    查看质检
                  </button>
                  <button class="rounded-md border px-3 py-1.5 text-[10px] hover:bg-muted" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(item.basisId))}">
                    查看扣款依据
                  </button>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `
}

function renderPlatformQcWritebackSummaryCard(): string {
  const items = getPlatformQcWritebackItems()
  if (items.length === 0) return ''

  const totalQty = items.reduce((sum, item) => sum + item.deductionQty, 0)
  const totalAmountCny = items.reduce((sum, item) => sum + item.deductionAmountCny, 0)
  const fxReferenceAt = getQualityFxReferenceAt(items)
  const disputedCount = items.filter((item) => item.liabilityStatusText === '争议中').length
  const readyCount = items.filter((item) => item.settlementVariant === 'green').length
  const targetView: QualityView = disputedCount > 0 ? 'disputing' : readyCount > 0 ? 'processed' : 'pending'

  return `
    <button
      class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-left"
      data-pda-sett-action="open-quality-workbench"
      data-view="${targetView}"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-medium text-sky-900">平台回写质检扣款</div>
        ${renderStatusBadge(`${items.length} 条`, 'blue')}
      </div>
      <div class="mt-1 text-[10px] leading-5 text-sky-700">已回写 ${totalQty} 件，平台判责 ${escapeHtml(formatSettlementAwareAmount(totalAmountCny, 'CNY', fxReferenceAt))}；${
        disputedCount > 0 ? `其中 ${disputedCount} 条待处理异议` : `${readyCount} 条已进入可结算`
      }</div>
      <div class="mt-2 text-[10px] font-medium text-sky-800">去看质检扣款</div>
    </button>
  `
}

function getLedgerSourceTypeLabel(sourceType: SettlementLedgerSourceType): string {
  return sourceType === 'QUALITY' ? '质量扣款' : '其它扣款'
}

function getLedgerFinancialStatusMeta(status: SettlementLedgerFinancialStatus): {
  label: string
  variant: BadgeVariant
} {
  if (status === 'BLOCKED') return { label: '冻结中', variant: 'orange' }
  if (status === 'NEXT_CYCLE_ADJUSTMENT_PENDING') return { label: '待下周期调整', variant: 'amber' }
  if (status === 'REVERSED') return { label: '已冲回', variant: 'gray' }
  return { label: '已生效', variant: 'green' }
}

function parseDateValue(value?: string): number {
  if (!value) return 0
  return new Date(value.replace(' ', 'T')).getTime()
}

function isDateWithinCyclePeriod(value: string | undefined, cycle: SettlementCycle): boolean {
  if (!value) return false
  const at = parseDateValue(value)
  const start = parseDateValue(`${cycle.periodStart} 00:00:00`)
  const end = parseDateValue(`${cycle.periodEnd} 23:59:59`)
  return at >= start && at <= end
}

function getQualityLinkedDeductionMap(): Map<string, DeductionRecord[]> {
  const mapping = new Map<string, DeductionRecord[]>()
  DEDUCTION_RECORDS.filter((record) => isQualityDeductionRecord(record)).forEach((record) => {
    dedupeStringList(record.linkedQcIds ?? []).forEach((qcId) => {
      const current = mapping.get(qcId) ?? []
      current.push(record)
      mapping.set(qcId, current)
    })
  })
  return mapping
}

function resolveQualityLedgerCycleId(caseFact: QualityCaseFact, linkedRecords: DeductionRecord[]): string | undefined {
  const linkedCycle = linkedRecords.find((record) => record.cycleId)?.cycleId
  if (linkedCycle) return linkedCycle
  if (caseFact.settlementImpact.includedSettlementBatchId && getCycleById(caseFact.settlementImpact.includedSettlementBatchId)) {
    return caseFact.settlementImpact.includedSettlementBatchId
  }
  if (caseFact.settlementImpact.candidateSettlementCycleId && getCycleById(caseFact.settlementImpact.candidateSettlementCycleId)) {
    return caseFact.settlementImpact.candidateSettlementCycleId
  }
  if (caseFact.settlementAdjustment?.targetSettlementCycleId && getCycleById(caseFact.settlementAdjustment.targetSettlementCycleId)) {
    return caseFact.settlementAdjustment.targetSettlementCycleId
  }
  return undefined
}

function mapQualityCaseToLedgerItem(caseFact: QualityCaseFact, linkedRecords: DeductionRecord[]): SettlementLedgerItemViewModel {
  const { qcRecord, deductionBasis, settlementImpact, settlementAdjustment } = caseFact
  const linkedRecord = linkedRecords[0] ?? null
  const originalAmount = settlementImpact.blockedProcessingFeeAmount + settlementImpact.effectiveQualityDeductionAmount
  const currencyDisplay = getLedgerCurrencyDisplay({
    amount: originalAmount,
    originalCurrency: 'CNY',
    referenceAt:
      settlementAdjustment?.generatedAt ??
      settlementImpact.lastWrittenBackAt ??
      settlementImpact.eligibleAt ??
      qcRecord.inspectedAt,
  })
  const financialStatus =
    settlementImpact.status === 'BLOCKED'
      ? 'BLOCKED'
      : settlementImpact.status === 'NO_IMPACT' && originalAmount === 0
        ? 'REVERSED'
        : 'EFFECTIVE'
  const statusMeta = getLedgerFinancialStatusMeta(financialStatus)
  const cycleId = resolveQualityLedgerCycleId(caseFact, linkedRecords)

  return {
    ledgerId: linkedRecord?.deductionId ?? deductionBasis?.basisId ?? qcRecord.qcId,
    ledgerNo: linkedRecord?.deductionId ?? deductionBasis?.basisId ?? qcRecord.qcNo,
    sourceType: 'QUALITY',
    sourceTypeLabel: getLedgerSourceTypeLabel('QUALITY'),
    financialStatus,
    financialStatusLabel: statusMeta.label,
    financialStatusVariant: statusMeta.variant,
    reason: deductionBasis?.summary ?? qcRecord.unqualifiedReasonSummary ?? '质量扣款',
    sourceSummary: deductionBasis?.basisId ? `质检 ${qcRecord.qcNo} / 扣款依据 ${deductionBasis.basisId}` : `质检 ${qcRecord.qcNo}`,
    summary: settlementImpact.summary,
    currentStatusText:
      settlementImpact.status === 'BLOCKED'
        ? '当前仍冻结中'
        : settlementImpact.status === 'SETTLED'
          ? '已进入结算并完成付款'
          : settlementImpact.status === 'INCLUDED_IN_STATEMENT'
            ? '已纳入当前周期'
            : '当前已生效',
    cycleId,
    targetCycleId: settlementAdjustment?.targetSettlementCycleId,
    taskId: linkedRecord?.taskId,
    productionOrderId: linkedRecord?.productionOrderId ?? qcRecord.productionOrderNo,
    spuName: linkedRecord?.spuName,
    processLabel: linkedRecord?.process ?? qcRecord.processLabel,
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    basisId: deductionBasis?.basisId,
    includedInCurrentCycle: Boolean(
      settlementImpact.includedSettlementBatchId ||
        settlementImpact.status === 'INCLUDED_IN_STATEMENT' ||
        settlementImpact.status === 'SETTLED',
    ),
    isCurrentWeek: linkedRecords.some((record) => Boolean(record.isCurrentWeek)) || isDateWithinCyclePeriod(qcRecord.inspectedAt, CW),
    blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount: settlementImpact.effectiveQualityDeductionAmount,
    adjustmentAmount: 0,
    currencyDisplay,
    keyTime:
      settlementImpact.lastWrittenBackAt ??
      settlementImpact.eligibleAt ??
      settlementImpact.includedAt ??
      qcRecord.inspectedAt,
    keyTimeLabel:
      settlementImpact.status === 'BLOCKED'
        ? '质检时间'
        : settlementImpact.status === 'SETTLED'
          ? '结算完成时间'
          : '生效时间',
  }
}

function mapQualityFallbackDeductionToLedgerItem(record: DeductionRecord): SettlementLedgerItemViewModel {
  const financialStatus: SettlementLedgerFinancialStatus = record.includedInSettlement ? 'EFFECTIVE' : 'BLOCKED'
  const statusMeta = getLedgerFinancialStatusMeta(financialStatus)
  return {
    ledgerId: record.deductionId,
    ledgerNo: record.deductionId,
    sourceType: 'QUALITY',
    sourceTypeLabel: getLedgerSourceTypeLabel('QUALITY'),
    financialStatus,
    financialStatusLabel: statusMeta.label,
    financialStatusVariant: statusMeta.variant,
    reason: record.reason,
    sourceSummary: `任务 ${record.taskId}`,
    summary: record.problemSummary,
    currentStatusText: record.currentStatus,
    cycleId: record.cycleId,
    taskId: record.taskId,
    productionOrderId: record.productionOrderId,
    spuName: record.spuName,
    processLabel: record.process,
    qcId: dedupeStringList(record.linkedQcIds ?? [])[0],
    qcNo: dedupeStringList(record.linkedQcIds ?? [])[0],
    includedInCurrentCycle: record.includedInSettlement,
    isCurrentWeek: Boolean(record.isCurrentWeek),
    blockedProcessingFeeAmount: record.includedInSettlement ? 0 : record.amount,
    effectiveQualityDeductionAmount: record.includedInSettlement ? record.amount : 0,
    adjustmentAmount: 0,
    currencyDisplay: getLedgerCurrencyDisplay({
      amount: record.amount,
      originalCurrency: getSettlementDisplayCurrency(),
      referenceAt: record.cycleIncludedAt,
    }),
    keyTime: record.cycleIncludedAt ?? (record.isCurrentWeek ? `${CW.periodEnd} 18:00:00` : ''),
    keyTimeLabel: record.includedInSettlement ? '计入周期时间' : '待计入状态',
  }
}

function mapOtherDeductionToLedgerItem(record: DeductionRecord): SettlementLedgerItemViewModel {
  const financialStatus: SettlementLedgerFinancialStatus = record.includedInSettlement ? 'EFFECTIVE' : 'BLOCKED'
  const statusMeta = getLedgerFinancialStatusMeta(financialStatus)
  return {
    ledgerId: record.deductionId,
    ledgerNo: record.deductionId,
    sourceType: 'OTHER',
    sourceTypeLabel: getLedgerSourceTypeLabel('OTHER'),
    financialStatus,
    financialStatusLabel: statusMeta.label,
    financialStatusVariant: statusMeta.variant,
    reason: record.reason,
    sourceSummary: record.source,
    summary: record.problemSummary,
    currentStatusText: record.currentStatus,
    cycleId: record.cycleId,
    taskId: record.taskId,
    productionOrderId: record.productionOrderId,
    spuName: record.spuName,
    processLabel: record.process,
    includedInCurrentCycle: record.includedInSettlement,
    isCurrentWeek: Boolean(record.isCurrentWeek),
    blockedProcessingFeeAmount: record.includedInSettlement ? 0 : record.amount,
    effectiveQualityDeductionAmount: record.includedInSettlement ? record.amount : 0,
    adjustmentAmount: 0,
    currencyDisplay: getLedgerCurrencyDisplay({
      amount: record.amount,
      originalCurrency: getSettlementDisplayCurrency(),
      referenceAt: record.cycleIncludedAt,
    }),
    keyTime: record.cycleIncludedAt ?? (record.isCurrentWeek ? `${CW.periodEnd} 18:00:00` : ''),
    keyTimeLabel: record.includedInSettlement ? '计入周期时间' : '待计入状态',
  }
}

function mapAdjustmentToLedgerItem(adjustment: FutureSettlementAdjustmentListItem): SettlementLedgerItemViewModel {
  const financialStatus: SettlementLedgerFinancialStatus =
    adjustment.adjustmentType === 'REVERSAL' && adjustment.writebackStatus === 'WRITTEN'
      ? 'REVERSED'
      : 'NEXT_CYCLE_ADJUSTMENT_PENDING'
  const statusMeta = getLedgerFinancialStatusMeta(financialStatus)
  const currencyDisplay = getLedgerCurrencyDisplay({
    amount: adjustment.adjustmentAmount,
    originalCurrency: 'CNY',
    referenceAt: adjustment.generatedAt,
  })
  return {
    ledgerId: adjustment.adjustmentId,
    ledgerNo: adjustment.adjustmentNo,
    sourceType: 'QUALITY',
    sourceTypeLabel: getLedgerSourceTypeLabel('QUALITY'),
    financialStatus,
    financialStatusLabel: statusMeta.label,
    financialStatusVariant: statusMeta.variant,
    reason: adjustment.adjustmentTypeLabel,
    sourceSummary: `质检 ${adjustment.qcNo} / 调整项`,
    summary: adjustment.summary,
    currentStatusText: adjustment.writebackStatusLabel,
    cycleId: adjustment.targetSettlementCycleId,
    targetCycleId: adjustment.targetSettlementCycleId,
    productionOrderId: adjustment.productionOrderNo,
    processLabel: '质量调整',
    qcId: adjustment.qcId,
    qcNo: adjustment.qcNo,
    basisId: adjustment.basisId,
    adjustmentId: adjustment.adjustmentId,
    adjustmentNo: adjustment.adjustmentNo,
    adjustmentTypeLabel: adjustment.adjustmentTypeLabel,
    writebackStatusLabel: adjustment.writebackStatusLabel,
    includedInCurrentCycle: false,
    isCurrentWeek: adjustment.targetSettlementCycleId === CW.cycleId || isDateWithinCyclePeriod(adjustment.generatedAt, CW),
    blockedProcessingFeeAmount: 0,
    effectiveQualityDeductionAmount: 0,
    adjustmentAmount: adjustment.adjustmentAmount,
    currencyDisplay,
    keyTime: adjustment.generatedAt,
    keyTimeLabel: '调整生成时间',
  }
}

function isLedgerMatchedToCycle(item: SettlementLedgerItemViewModel, cycle: SettlementCycle): boolean {
  if (item.cycleId === cycle.cycleId || item.targetCycleId === cycle.cycleId) return true
  if (isDateWithinCyclePeriod(item.keyTime, cycle)) return true
  if (cycle.isCurrentWeek && item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING') return true
  if (cycle.isCurrentWeek && item.sourceType === 'QUALITY' && !item.cycleId && item.financialStatus !== 'REVERSED') {
    return true
  }
  return false
}

function matchesLedgerKeyword(item: SettlementLedgerItemViewModel, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return [
    item.ledgerNo,
    item.taskId,
    item.productionOrderId,
    item.qcNo,
    item.basisId,
    item.reason,
    item.sourceSummary,
    item.spuName,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized))
}

function sortSettlementLedgerItems(left: SettlementLedgerItemViewModel, right: SettlementLedgerItemViewModel): number {
  const rank = (item: SettlementLedgerItemViewModel) =>
    item.financialStatus === 'BLOCKED'
      ? 0
      : item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING'
        ? 1
        : item.financialStatus === 'EFFECTIVE'
          ? 2
          : 3
  if (rank(left) !== rank(right)) return rank(left) - rank(right)
  return parseDateValue(right.keyTime) - parseDateValue(left.keyTime)
}

function getSettlementLedgerItems(options: {
  cycle: SettlementCycle | null
  timeView: DedView
  sourceView: LedgerSourceView
  financeView: LedgerFinancialView
  keyword: string
}): SettlementLedgerItemViewModel[] {
  const linkedQualityRecords = getQualityLinkedDeductionMap()
  const qualityCaseItems = listQualityDeductionCaseFacts({ includeLegacy: false })
    .filter((caseFact) => {
      const qc = caseFact.qcRecord
      return qc.returnFactoryId === getCurrentQualityFactoryId() && Boolean(caseFact.deductionBasis)
    })
    .map((caseFact) => mapQualityCaseToLedgerItem(caseFact, linkedQualityRecords.get(caseFact.qcRecord.qcId) ?? []))

  const coveredQualityDeductionIds = new Set(
    Array.from(linkedQualityRecords.values())
      .flat()
      .map((record) => record.deductionId),
  )

  const qualityFallbackItems = DEDUCTION_RECORDS.filter((record) => isQualityDeductionRecord(record))
    .filter((record) => !coveredQualityDeductionIds.has(record.deductionId))
    .map((record) => mapQualityFallbackDeductionToLedgerItem(record))

  const otherItems = DEDUCTION_RECORDS.filter((record) => !isQualityDeductionRecord(record)).map((record) =>
    mapOtherDeductionToLedgerItem(record),
  )

  const adjustmentItems = listFutureSettlementAdjustmentItems({ includeLegacy: false }).map((item) =>
    mapAdjustmentToLedgerItem(item),
  )

  return [...qualityCaseItems, ...qualityFallbackItems, ...adjustmentItems, ...otherItems]
    .filter((item) => {
      if (options.cycle) return isLedgerMatchedToCycle(item, options.cycle)
      return options.timeView === 'all' ? true : item.isCurrentWeek
    })
    .filter((item) => {
      if (options.sourceView === 'quality') return item.sourceType === 'QUALITY'
      if (options.sourceView === 'other') return item.sourceType === 'OTHER'
      return true
    })
    .filter((item) => {
      if (options.financeView === 'blocked') return item.financialStatus === 'BLOCKED'
      if (options.financeView === 'effective') return item.financialStatus === 'EFFECTIVE'
      if (options.financeView === 'adjustment') return item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING'
      if (options.financeView === 'reversed') return item.financialStatus === 'REVERSED'
      return true
    })
    .filter((item) => matchesLedgerKeyword(item, options.keyword))
    .sort(sortSettlementLedgerItems)
}

function getSettlementLedgerOverview(items: SettlementLedgerItemViewModel[]): SettlementLedgerOverviewViewModel {
  const settlementCurrency = getSettlementDisplayCurrency()
  return {
    itemCount: items.length,
    settlementCurrency,
    totalAmount: items.reduce((sum, item) => sum + item.currencyDisplay.settlementAmount, 0),
    blockedAmount: items
      .filter((item) => item.financialStatus === 'BLOCKED')
      .reduce((sum, item) => sum + item.currencyDisplay.settlementAmount, 0),
    adjustmentAmount: items
      .filter((item) => item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING')
      .reduce((sum, item) => sum + item.currencyDisplay.settlementAmount, 0),
  }
}

function getSettlementLedgerDetailViewModel(ledgerId: string | null): SettlementLedgerDetailViewModel | null {
  if (!ledgerId) return null
  const item =
    getSettlementLedgerItems({
      cycle: null,
      timeView: 'all',
      sourceView: 'all',
      financeView: 'all',
      keyword: '',
    }).find((entry) => entry.ledgerId === ledgerId) ?? null
  if (!item) return null

  return {
    item,
    linkedTask: item.taskId ? getTaskById(item.taskId) : null,
    linkedQualityCase: item.qcId ? getFutureMobileFactoryQcDetail(item.qcId) : null,
  }
}

function getQualityBadgeVariant(label: string): BadgeVariant {
  if (label.includes('合格')) return 'green'
  if (label.includes('不合格')) return 'red'
  return 'amber'
}

function getQualityResponseVariant(label: string): BadgeVariant {
  if (label.includes('自动确认')) return 'blue'
  if (label.includes('已确认')) return 'green'
  if (label.includes('已发起异议')) return 'amber'
  return 'orange'
}

function getQualityDisputeVariant(label: string): BadgeVariant {
  if (label.includes('维持原判') || label.includes('已关闭')) return 'green'
  if (label.includes('改判') || label.includes('部分调整')) return 'blue'
  if (label.includes('待平台') || label.includes('处理中') || label.includes('异议')) return 'amber'
  return 'gray'
}

function getQualitySettlementVariant(label: string): BadgeVariant {
  if (label.includes('已结算')) return 'green'
  if (label.includes('可结算') || label.includes('已纳入')) return 'blue'
  if (label.includes('待下周期调整')) return 'amber'
  return 'orange'
}

function getSettlementQualityViewItems(factoryId: string, view: QualityView): FutureMobileFactoryQcListItem[] {
  const buckets = listFutureMobileFactoryQcBuckets(factoryId)
  if (view === 'soon') return listFutureMobileFactorySoonOverdueQcItems(factoryId)
  if (view === 'disputing') return buckets.disputing
  if (view === 'processed') return buckets.processed
  if (view === 'history') return buckets.history
  return buckets.pending
}

function getQualitySortTime(value?: string, fallback = 0): number {
  if (!value) return fallback
  const parsed = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) ? parsed : fallback
}

function sortSettlementQualityItems(view: QualityView, items: FutureMobileFactoryQcListItem[]): FutureMobileFactoryQcListItem[] {
  const rows = items.slice()
  if (view === 'pending' || view === 'soon') {
    return rows.sort((left, right) => {
      const leftTime = getQualitySortTime(left.responseDeadlineAt, Number.MAX_SAFE_INTEGER)
      const rightTime = getQualitySortTime(right.responseDeadlineAt, Number.MAX_SAFE_INTEGER)
      if (leftTime !== rightTime) return leftTime - rightTime
      return getQualitySortTime(right.inspectedAt) - getQualitySortTime(left.inspectedAt)
    })
  }

  if (view === 'disputing') {
    return rows.sort((left, right) => {
      const leftTime =
        getQualitySortTime(left.resultWrittenBackAt) ||
        getQualitySortTime(left.adjudicatedAt) ||
        getQualitySortTime(left.submittedAt) ||
        getQualitySortTime(left.respondedAt) ||
        getQualitySortTime(left.inspectedAt)
      const rightTime =
        getQualitySortTime(right.resultWrittenBackAt) ||
        getQualitySortTime(right.adjudicatedAt) ||
        getQualitySortTime(right.submittedAt) ||
        getQualitySortTime(right.respondedAt) ||
        getQualitySortTime(right.inspectedAt)
      return rightTime - leftTime
    })
  }

  if (view === 'processed') {
    return rows.sort((left, right) => {
      const leftTime =
        getQualitySortTime(left.respondedAt) ||
        getQualitySortTime(left.autoConfirmedAt) ||
        getQualitySortTime(left.adjudicatedAt) ||
        getQualitySortTime(left.resultWrittenBackAt) ||
        getQualitySortTime(left.inspectedAt)
      const rightTime =
        getQualitySortTime(right.respondedAt) ||
        getQualitySortTime(right.autoConfirmedAt) ||
        getQualitySortTime(right.adjudicatedAt) ||
        getQualitySortTime(right.resultWrittenBackAt) ||
        getQualitySortTime(right.inspectedAt)
      return rightTime - leftTime
    })
  }

  return rows.sort((left, right) => {
    const leftTime =
      getQualitySortTime(left.resultWrittenBackAt) ||
      getQualitySortTime(left.adjudicatedAt) ||
      getQualitySortTime(left.autoConfirmedAt) ||
      getQualitySortTime(left.respondedAt) ||
      getQualitySortTime(left.inspectedAt)
    const rightTime =
      getQualitySortTime(right.resultWrittenBackAt) ||
      getQualitySortTime(right.adjudicatedAt) ||
      getQualitySortTime(right.autoConfirmedAt) ||
      getQualitySortTime(right.respondedAt) ||
      getQualitySortTime(right.inspectedAt)
    return rightTime - leftTime
  })
}

function renderQualityQuickActionCards(factoryId: string, options: { workbench?: boolean } = {}): string {
  const summary = getFutureMobileFactoryQcSummary(factoryId)
  const soonItems = listFutureMobileFactorySoonOverdueQcItems(factoryId)
  const pendingBuckets = listFutureMobileFactoryQcBuckets(factoryId).pending
  const nearestPending = summary.nearestPendingDeadlineAt ?? pendingBuckets[0]?.responseDeadlineAt
  const nearestSoon = summary.nearestSoonOverdueDeadlineAt ?? soonItems[0]?.responseDeadlineAt

  return `
    <div>
      <h3 class="mb-2 text-xs font-semibold text-muted-foreground">重点待办</h3>
      <div class="grid grid-cols-2 gap-2.5">
        <button
          class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-left"
          data-pda-sett-action="open-quality-workbench"
          data-view="pending"
        >
          <div class="text-[10px] text-amber-700">质检扣款待处理</div>
          <div class="mt-1 text-lg font-bold text-amber-800">${summary.pendingCount}</div>
          <div class="mt-1 text-[10px] leading-5 text-amber-700">${
            nearestPending ? `最晚截止 ${escapeHtml(formatDateTime(nearestPending))}` : '当前暂无待处理记录'
          }</div>
        </button>
        <button
          class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-left"
          data-pda-sett-action="open-quality-workbench"
          data-view="soon"
        >
          <div class="text-[10px] text-rose-700">质检扣款即将逾期</div>
          <div class="mt-1 text-lg font-bold text-rose-800">${summary.soonOverdueCount}</div>
          <div class="mt-1 text-[10px] leading-5 text-rose-700">${
            nearestSoon ? `最紧急 ${escapeHtml(getRemainingDeadlineSummary(nearestSoon))}` : '当前无 48 小时内到期记录'
          }</div>
        </button>
      </div>
      ${
        options.workbench
          ? ''
          : `<div class="mt-2 grid grid-cols-1 gap-2">
              <button
                class="rounded-md border bg-background px-3 py-2 text-left"
                data-pda-sett-action="open-quality-workbench"
                data-view="disputing"
              >
                <div class="text-[10px] text-muted-foreground">异议中</div>
                <div class="mt-0.5 text-sm font-semibold">${summary.disputingCount}</div>
              </button>
            </div>`
      }
    </div>
  `
}

function renderSettlementQualityCard(item: FutureMobileFactoryQcListItem, compact = false): string {
  const urgentView = state.qualityView === 'pending' || state.qualityView === 'soon'
  const disputingView = state.qualityView === 'disputing'
  const resultView = state.qualityView === 'processed' || state.qualityView === 'history'
  const detailLabel = disputingView
    ? '查看异议进度'
    : resultView
      ? item.disputeStatus !== 'NONE'
        ? '查看裁决结果'
        : '查看处理结果'
      : '查看详情'
  const workflowHint = urgentView
    ? item.responseDeadlineAt
      ? `请在 ${formatDateTime(item.responseDeadlineAt)} 前完成确认或发起异议。`
      : '当前记录仍待工厂处理，请尽快完成确认或发起异议。'
    : disputingView
      ? '当前已提交异议，请关注平台裁决进度与回写结果。'
      : resultView
        ? '当前记录已完成处理，以下信息用于查看结果与结算影响。'
        : '可查看当前责任认定、冻结影响与处理进展。'
  const workflowHintClass = urgentView
    ? state.qualityView === 'soon'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
    : disputingView
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-border bg-muted/20 text-muted-foreground'
  const detailAction = `
    <button
      class="rounded-md border px-3 py-1.5 text-[10px] hover:bg-muted"
      data-nav="${escapeHtml(`${buildPdaQualityDetailHref(item.qcId)}?back=settlement&view=${state.qualityView}`)}"
    >
      ${detailLabel}
    </button>
  `
  const primaryActions = `
    ${
      item.canDispute
        ? `
          <button
            class="rounded-md border border-primary px-3 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/5"
            data-nav="${escapeHtml(`${buildPdaQualityDetailHref(item.qcId)}?back=settlement&view=${state.qualityView}`)}"
          >
            发起异议
          </button>
        `
        : ''
    }
    ${
      item.canConfirm
        ? `
          <button
            class="rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground"
            data-nav="${escapeHtml(`${buildPdaQualityDetailHref(item.qcId)}?back=settlement&view=${state.qualityView}`)}"
          >
            确认处理
          </button>
        `
        : ''
    }
  `
  const secondaryActions = compact
    ? ''
    : `<button class="rounded-md border px-3 py-1.5 text-[10px] hover:bg-muted" data-nav="/fcs/pda/settlement?tab=deductions">查看冻结影响</button>`
  const actionRow = urgentView
    ? `${primaryActions}${detailAction}${secondaryActions}`
    : `${detailAction}${primaryActions}${secondaryActions}`

  return `
    <article class="rounded-lg border bg-card px-3 py-3 shadow-none">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.qcNo)}</div>
          <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`${item.returnInboundBatchNo} · ${item.productionOrderNo}`)}</div>
          <div class="text-[10px] text-muted-foreground">${escapeHtml(`${item.processLabel} · ${formatDateTime(item.inspectedAt)}`)}</div>
        </div>
        ${renderStatusBadge(item.qcResultLabel, getQualityBadgeVariant(item.qcResultLabel))}
      </div>

      <div class="mt-2 flex flex-wrap gap-1.5">
        ${renderStatusBadge(item.factoryResponseStatusLabel, getQualityResponseVariant(item.factoryResponseStatusLabel))}
        ${renderStatusBadge(item.disputeStatusLabel, getQualityDisputeVariant(item.disputeStatusLabel))}
        ${renderStatusBadge(item.settlementImpactStatusLabel, getQualitySettlementVariant(item.settlementImpactStatusLabel))}
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div class="rounded-md bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">数量概况</div>
          <div class="mt-0.5 font-medium text-foreground">${item.inspectedQty} / 合格 ${item.qualifiedQty} / 不合格 ${item.unqualifiedQty}</div>
        </div>
        <div class="rounded-md bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">工厂责任数量</div>
          <div class="mt-0.5 font-medium text-foreground">${item.factoryLiabilityQty} 件</div>
        </div>
        <div class="rounded-md bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">冻结加工费</div>
          <div class="mt-0.5 font-medium text-foreground">${escapeHtml(formatSettlementAwareAmount(item.blockedProcessingFeeAmount, 'CNY', item.inspectedAt))}</div>
        </div>
        <div class="rounded-md bg-muted/30 px-2.5 py-2">
          <div class="text-muted-foreground">生效质量扣款</div>
          <div class="mt-0.5 font-medium text-foreground">${escapeHtml(formatSettlementAwareAmount(item.effectiveQualityDeductionAmount, 'CNY', item.inspectedAt))}</div>
        </div>
      </div>

      <div class="mt-3 rounded-md border px-2.5 py-2 text-[10px] ${workflowHintClass}">${escapeHtml(workflowHint)}</div>

      ${
        item.responseDeadlineAt
          ? `<div class="mt-2 rounded-md border border-dashed px-2.5 py-2 text-[10px] text-muted-foreground">响应截止：${escapeHtml(formatDateTime(item.responseDeadlineAt))} · ${escapeHtml(getRemainingDeadlineSummary(item.responseDeadlineAt))}</div>`
          : ''
      }

      <div class="mt-3 flex flex-wrap gap-2">
        ${actionRow}
      </div>
    </article>
  `
}

function renderSettlementQualityContent(factoryId: string): string {
  const summary = getFutureMobileFactoryQcSummary(factoryId)
  const items = sortSettlementQualityItems(
    state.qualityView,
    getSettlementQualityViewItems(factoryId, state.qualityView).filter((item) =>
      matchesQualityKeyword(item, state.qualitySearch),
    ),
  )
  const viewTabs: Array<{ key: QualityView; label: string; count: number }> = [
    { key: 'pending', label: '待处理', count: summary.pendingCount },
    { key: 'soon', label: '即将逾期', count: summary.soonOverdueCount },
    { key: 'disputing', label: '异议中', count: summary.disputingCount },
    { key: 'processed', label: '已处理', count: summary.processedCount },
    { key: 'history', label: '历史', count: summary.historyCount },
  ]
  const currentViewLabel = viewTabs.find((item) => item.key === state.qualityView)?.label ?? '待处理'
  const emptyStateText =
    state.qualityView === 'pending'
      ? '当前没有待处理的质检扣款记录'
      : state.qualityView === 'soon'
        ? '当前没有即将逾期的质检扣款记录'
        : state.qualityView === 'disputing'
          ? '当前没有异议中的质检扣款记录'
          : state.qualityView === 'processed'
            ? '当前没有已处理的质检扣款记录'
            : '当前没有历史质检扣款记录'

  return `
    <div class="space-y-3 p-4">
      ${renderQualityQuickActionCards(factoryId, { workbench: true })}

      <section class="rounded-lg border bg-card px-4 py-4 shadow-none">
        <div class="mb-3">
          <div class="text-xs font-semibold text-foreground">处理工作台</div>
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">先处理待确认与即将逾期记录，再查看异议进度、已处理结果与历史归档。</div>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          ${viewTabs
            .map(
              (view) => `
                <button
                  class="inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium ${
                    state.qualityView === view.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground'
                  }"
                  data-pda-sett-action="set-quality-view"
                  data-view="${view.key}"
                >
                  <span>${escapeHtml(view.label)}</span>
                  ${
                    view.key === 'pending' || view.key === 'soon'
                      ? ''
                      : `<span class="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] ${state.qualityView === view.key ? 'bg-primary-foreground/15 text-primary-foreground' : 'text-muted-foreground'}">${view.count}</span>`
                  }
                </button>
              `,
            )
            .join('')}
        </div>
        <div class="mt-3">
          <label class="text-[11px] text-muted-foreground">关键词</label>
          <input
            class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
            placeholder="输入质检单号 / 回货批次号 / 生产单号"
            data-pda-sett-field="quality-search"
            value="${escapeHtml(state.qualitySearch)}"
          />
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <div class="text-xs font-semibold text-foreground">${escapeHtml(currentViewLabel)}记录</div>
          <div class="text-[11px] text-muted-foreground">共 ${items.length} 条</div>
        </div>
        ${
          items.length > 0
            ? items.map((item) => renderSettlementQualityCard(item)).join('')
            : `<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">${escapeHtml(emptyStateText)}</div>`
        }
      </section>
    </div>
  `
}

function resetSettlementRequestForm(): void {
  const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
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

const PAYMENT_RECORDS: PaymentRecord[] = [
  { paymentId: 'PAY-2026-001', cycleId: 'STL-2026-01-001', paymentDate: '2026-01-25', amount: 28_750_000, method: '银行转账', status: '已完成', remark: '1月全额付款' },
  { paymentId: 'PAY-2026-002', cycleId: 'STL-2026-02-001', paymentDate: '2026-02-20', amount: 15_000_000, method: '银行转账', status: '已完成', remark: '2月第1笔' },
  { paymentId: 'PAY-2026-003', cycleId: 'STL-2026-02-001', paymentDate: '2026-02-25', amount: 15_000_000, method: '银行转账', status: '已完成', remark: '2月第2笔，已付清' },
  { paymentId: 'PAY-2026-004', cycleId: 'STL-2026-02-002', paymentDate: '2026-02-28', amount: 12_400_000, method: '银行转账', status: '已完成', remark: '2月第2周期全额付款' },
  { paymentId: 'PAY-2026-005', cycleId: 'STL-2026-03-001', paymentDate: '2026-03-10', amount: 15_000_000, method: '银行转账', status: '已完成', remark: '3月第1周期第1笔' },
  { paymentId: 'PAY-2026-006', cycleId: 'STL-2026-03-001', paymentDate: '2026-03-18', amount: 11_500_000, method: '银行转账', status: '已完成', remark: '3月第1周期第2笔' },
  { paymentId: 'PAY-2026-007', cycleId: 'STL-2026-03-001', paymentDate: '2026-03-28', amount: 6_950_000, method: '银行转账', status: '处理中', remark: '尾款，银行处理中，预计3~5工作日到账' },
  { paymentId: 'PAY-2026-008', cycleId: 'STL-2026-03-002', paymentDate: '2026-04-05', amount: 8_000_000, method: '银行转账', status: '处理中', remark: '预付款处理中，尾款预计4月20日付清' },
  { paymentId: 'PAY-2026-W12-01', cycleId: 'STL-2026-W12', paymentDate: '2026-03-20', amount: 12_500_000, method: '银行转账', status: '已完成', remark: '本周第1笔，覆盖车缝任务' },
  { paymentId: 'PAY-2026-W12-02', cycleId: 'STL-2026-W12', paymentDate: '2026-03-25', amount: 9_800_000, method: '银行转账', status: '已完成', remark: '本周第2笔，覆盖裁片+整烫任务' },
  { paymentId: 'PAY-2026-W12-03', cycleId: 'STL-2026-W12', paymentDate: '2026-04-02', amount: 7_450_000, method: '银行转账', status: '处理中', remark: '本周尾款，银行处理中，预计3~5工作日到账' },
]

const TASK_INCOMES: TaskIncome[] = [
  { taskId: 'PDA-EXEC-W01', productionOrderId: 'PO-2026-0040', spuName: '基础款衬衫', process: '车缝', completedQty: 1600, qualifiedQty: 1580, defectQty: 20, qtyUnit: '件', unitPrice: 8500, grossIncome: 13_600_000, deductionAmount: 200_000, netIncome: 13_400_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 13_400_000, paidAmount: 13_400_000, unpaidAmount: 0, lastPaymentDate: '2026-03-25', payments: [{ seq: '第1笔', date: '2026-03-20', amount: 6_700_000 }, { seq: '第2笔', date: '2026-03-25', amount: 6_700_000 }], linkedQualityQcIds: ['QC-RIB-202603-0002'] },
  { taskId: 'PDA-EXEC-W02', productionOrderId: 'PO-2026-0041', spuName: '工装裤', process: '裁片', completedQty: 2200, qualifiedQty: 2200, defectQty: 0, qtyUnit: '件', unitPrice: 3200, grossIncome: 7_040_000, deductionAmount: 0, netIncome: 7_040_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 7_040_000, paidAmount: 7_040_000, unpaidAmount: 0, lastPaymentDate: '2026-03-25', payments: [{ seq: '第1笔', date: '2026-03-25', amount: 7_040_000 }] },
  { taskId: 'PDA-EXEC-W03', productionOrderId: 'PO-2026-0042', spuName: '休闲外套', process: '整烫', completedQty: 980, qualifiedQty: 960, defectQty: 20, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_960_000, deductionAmount: 80_000, netIncome: 1_880_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 1_880_000, paidAmount: 900_000, unpaidAmount: 980_000, lastPaymentDate: '2026-03-25', payments: [{ seq: '第1笔', date: '2026-03-25', amount: 900_000 }] },
  { taskId: 'PDA-EXEC-W04', productionOrderId: 'PO-2026-0043', spuName: '牛仔裤C', process: '车缝', completedQty: 1200, qualifiedQty: 1160, defectQty: 40, qtyUnit: '件', unitPrice: 8500, grossIncome: 10_200_000, deductionAmount: 280_000, netIncome: 9_920_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 9_920_000, paidAmount: 4_500_000, unpaidAmount: 5_420_000, lastPaymentDate: '2026-03-20', payments: [{ seq: '第1笔', date: '2026-03-20', amount: 4_500_000 }], linkedQualityQcIds: ['QC-NEW-004'] },
  { taskId: 'PDA-EXEC-W05', productionOrderId: 'PO-2026-0044', spuName: '连衣裙A款', process: '包装', completedQty: 1500, qualifiedQty: 1500, defectQty: 0, qtyUnit: '件', unitPrice: 1500, grossIncome: 2_250_000, deductionAmount: 0, netIncome: 2_250_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 2_250_000, paidAmount: 0, unpaidAmount: 2_250_000, payments: [] },
  { taskId: 'PDA-EXEC-W06', productionOrderId: 'PO-2026-0045', spuName: '商务衬衫B', process: '整烫', completedQty: 800, qualifiedQty: 800, defectQty: 0, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_600_000, deductionAmount: 60_000, netIncome: 1_540_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 1_540_000, paidAmount: 0, unpaidAmount: 1_540_000, payments: [] },
  { taskId: 'PDA-EXEC-W07', productionOrderId: 'PO-2026-0046', spuName: '运动套装', process: '裁片', completedQty: 1800, qualifiedQty: 1800, defectQty: 0, qtyUnit: '件', unitPrice: 3200, grossIncome: 5_760_000, deductionAmount: 0, netIncome: 5_760_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 5_760_000, paidAmount: 0, unpaidAmount: 5_760_000, payments: [] },
  { taskId: 'PDA-EXEC-W08', productionOrderId: 'PO-2026-0047', spuName: '基础款T恤', process: '包装', completedQty: 2400, qualifiedQty: 2380, defectQty: 20, qtyUnit: '件', unitPrice: 1500, grossIncome: 3_600_000, deductionAmount: 100_000, netIncome: 3_500_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 3_500_000, paidAmount: 0, unpaidAmount: 3_500_000, payments: [] },
  { taskId: 'PDA-EXEC-001', productionOrderId: 'PO-2024-0012', spuName: '基础款衬衫', process: '裁片', completedQty: 1800, qualifiedQty: 1800, defectQty: 0, qtyUnit: '件', unitPrice: 3500, grossIncome: 6_300_000, deductionAmount: 0, netIncome: 6_300_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 6_300_000, paidAmount: 6_300_000, unpaidAmount: 0, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-10', amount: 3_150_000 }, { seq: '第2笔', date: '2026-03-18', amount: 3_150_000 }] },
  { taskId: 'PDA-EXEC-003', productionOrderId: 'PO-2024-0012', spuName: '基础款衬衫', process: '车缝', completedQty: 1800, qualifiedQty: 1755, defectQty: 45, qtyUnit: '件', unitPrice: 8500, grossIncome: 15_300_000, deductionAmount: 510_000, netIncome: 14_790_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 14_790_000, paidAmount: 14_790_000, unpaidAmount: 0, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-10', amount: 7_395_000 }, { seq: '第2笔', date: '2026-03-18', amount: 7_395_000 }], linkedQualityQcIds: ['QC-RIB-202603-0003'] },
  { taskId: 'PDA-EXEC-014', productionOrderId: 'PO-2024-0024', spuName: '工装裤', process: '裁片', completedQty: 2000, qualifiedQty: 2000, defectQty: 0, qtyUnit: '件', unitPrice: 3200, grossIncome: 6_400_000, deductionAmount: 0, netIncome: 6_400_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 6_400_000, paidAmount: 6_400_000, unpaidAmount: 0, lastPaymentDate: '2026-03-10', payments: [{ seq: '第1笔', date: '2026-03-10', amount: 6_400_000 }] },
  { taskId: 'PDA-EXEC-016', productionOrderId: 'PO-2024-0026', spuName: '休闲外套', process: '裁片', completedQty: 1100, qualifiedQty: 1080, defectQty: 20, qtyUnit: '件', unitPrice: 3800, grossIncome: 4_180_000, deductionAmount: 80_000, netIncome: 4_100_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 4_100_000, paidAmount: 2_000_000, unpaidAmount: 2_100_000, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-18', amount: 2_000_000 }] },
  { taskId: 'PDA-EXEC-007', productionOrderId: 'PO-2024-0017', spuName: '基础款T恤', process: '裁片', completedQty: 1500, qualifiedQty: 1465, defectQty: 35, qtyUnit: '件', unitPrice: 3500, grossIncome: 5_250_000, deductionAmount: 175_000, netIncome: 5_075_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 5_075_000, paidAmount: 2_700_000, unpaidAmount: 2_375_000, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-18', amount: 2_700_000 }], linkedQualityQcIds: ['QC-NEW-010'] },
  { taskId: 'PDA-EXEC-008', productionOrderId: 'PO-2024-0018', spuName: '基础款T恤', process: '车缝', completedQty: 800, qualifiedQty: 800, defectQty: 0, qtyUnit: '件', unitPrice: 8500, grossIncome: 6_800_000, deductionAmount: 255_000, netIncome: 6_545_000, settlementStatus: '部分结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 6_545_000, paidAmount: 0, unpaidAmount: 6_545_000, payments: [] },
  { taskId: 'PDA-EXEC-009', productionOrderId: 'PO-2024-0019', spuName: '连衣裙A款', process: '整烫', completedQty: 800, qualifiedQty: 720, defectQty: 80, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_600_000, deductionAmount: 360_000, netIncome: 1_240_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 1_240_000, paidAmount: 0, unpaidAmount: 1_240_000, payments: [] },
  { taskId: 'PDA-EXEC-010', productionOrderId: 'PO-2024-0020', spuName: '运动套装', process: '包装', completedQty: 1200, qualifiedQty: 1200, defectQty: 0, qtyUnit: '件', unitPrice: 1500, grossIncome: 1_800_000, deductionAmount: 0, netIncome: 1_800_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 1_800_000, paidAmount: 0, unpaidAmount: 1_800_000, payments: [] },
  { taskId: 'PDA-EXEC-011', productionOrderId: 'PO-2024-0021', spuName: '商务衬衫B', process: '车缝', completedQty: 600, qualifiedQty: 600, defectQty: 0, qtyUnit: '件', unitPrice: 8500, grossIncome: 5_100_000, deductionAmount: 60_000, netIncome: 5_040_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 5_040_000, paidAmount: 0, unpaidAmount: 5_040_000, payments: [] },
  { taskId: 'PDA-EXEC-012', productionOrderId: 'PO-2024-0022', spuName: '商务衬衫B', process: '整烫', completedQty: 965, qualifiedQty: 917, defectQty: 48, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_930_000, deductionAmount: 192_000, netIncome: 1_738_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 1_738_000, paidAmount: 0, unpaidAmount: 1_738_000, payments: [] },
  { taskId: 'PDA-EXEC-020', productionOrderId: 'PO-2024-0030', spuName: '休闲外套', process: '车缝', completedQty: 950, qualifiedQty: 950, defectQty: 0, qtyUnit: '件', unitPrice: 8500, grossIncome: 8_075_000, deductionAmount: 0, netIncome: 8_075_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-02-001', shouldPayAmount: 8_075_000, paidAmount: 8_075_000, unpaidAmount: 0, lastPaymentDate: '2026-02-25', payments: [{ seq: '第1笔', date: '2026-02-20', amount: 4_000_000 }, { seq: '第2笔', date: '2026-02-25', amount: 4_075_000 }] },
]

const DEDUCTION_RECORDS: DeductionRecord[] = [
  { deductionId: 'DED-W12-001', taskId: 'PDA-EXEC-W01', productionOrderId: 'PO-2026-0040', spuName: '基础款衬衫', process: '车缝', reason: '质量不合格', source: '接收质检不合格', defectQty: 20, qtyUnit: '件', unitDeductPrice: 10_000, deductQty: 20, amount: 200_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-19 09:00', isCurrentWeek: true, problemSummary: '20件车缝线迹跳针，前片缝合不达标', responsibilitySummary: '工厂操作问题，质检已留证，工厂签认', currentStatus: '已确认，已计入本周结算', linkedQcIds: ['QC-RIB-202603-0002'] },
  { deductionId: 'DED-W12-002', taskId: 'PDA-EXEC-W03', productionOrderId: 'PO-2026-0042', spuName: '休闲外套', process: '整烫', reason: '质量不合格', source: '完工质检不合格', defectQty: 20, qtyUnit: '件', unitDeductPrice: 4_000, deductQty: 20, amount: 80_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-22 10:00', isCurrentWeek: true, problemSummary: '20件整烫后肩部定型不达标，需质量处理', responsibilitySummary: '温度设置不当，质检记录已存档', currentStatus: '已确认，已计入本周结算' },
  { deductionId: 'DED-W12-003', taskId: 'PDA-EXEC-W04', productionOrderId: 'PO-2026-0043', spuName: '牛仔裤C', process: '车缝', reason: '质量问题扣款', source: '完工质检不合格', defectQty: 40, qtyUnit: '件', unitDeductPrice: 5_000, deductQty: 40, amount: 200_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-21 14:00', isCurrentWeek: true, problemSummary: '40件裤脚缝边不均，需质量处理后复核', responsibilitySummary: '工厂自检上报，扣款已协商一致', currentStatus: '已确认，已计入本周结算', linkedQcIds: ['QC-NEW-004'] },
  { deductionId: 'DED-W12-004', taskId: 'PDA-EXEC-W04', productionOrderId: 'PO-2026-0043', spuName: '牛仔裤C', process: '车缝', reason: '数量差异扣款', source: '数量短缺扣款', defectQty: 0, qtyUnit: '件', amount: 80_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-23 11:00', isCurrentWeek: true, problemSummary: '实交1200件，应交1220件，差20件，按合同扣款', responsibilitySummary: '交接签收单确认差异，工厂已认可', currentStatus: '已确认，已计入本周结算' },
  { deductionId: 'DED-W12-005', taskId: 'PDA-EXEC-W06', productionOrderId: 'PO-2026-0045', spuName: '商务衬衫B', process: '整烫', reason: '其他扣款', source: '辅料超耗扣款', defectQty: 0, qtyUnit: '件', amount: 60_000, includedInSettlement: false, settlementStatus: '待计入结算', isCurrentWeek: true, problemSummary: '辅料超耗12%，超耗部分按合同扣款', responsibilitySummary: '领料记录核实，超耗责任认定', currentStatus: '待计入本周结算' },
  { deductionId: 'DED-W12-006', taskId: 'PDA-EXEC-W08', productionOrderId: 'PO-2026-0047', spuName: '基础款T恤', process: '包装', reason: '质量不合格', source: '接收质检不合格', defectQty: 20, qtyUnit: '件', unitDeductPrice: 5_000, deductQty: 20, amount: 100_000, includedInSettlement: false, settlementStatus: '待计入结算', isCurrentWeek: true, problemSummary: '20件包装破损，不符合交付标准', responsibilitySummary: '工厂操作问题，已拍照留证', currentStatus: '待计入本周结算' },
  { deductionId: 'DED-2026-001', taskId: 'PDA-EXEC-003', productionOrderId: 'PO-2024-0012', spuName: '基础款衬衫', process: '车缝', reason: '质量不合格', source: '接收质检不合格', defectQty: 45, qtyUnit: '件', unitDeductPrice: 10_000, deductQty: 45, amount: 450_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-03-001', cycleIncludedAt: '2026-03-05 09:00', problemSummary: '车缝线迹跳针，45件前片缝合不达标', responsibilitySummary: '工厂生产操作问题，质检留证，工厂已签认', currentStatus: '已确认，已计入3月第1周期', linkedQcIds: ['QC-RIB-202603-0003'] },
  { deductionId: 'DED-2026-002', taskId: 'PDA-EXEC-007', productionOrderId: 'PO-2024-0017', spuName: '基础款T恤', process: '裁片', reason: '质量不合格', source: '完工质检不合格', defectQty: 35, qtyUnit: '件', unitDeductPrice: 5_000, deductQty: 35, amount: 175_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-03-001', cycleIncludedAt: '2026-03-06 10:30', problemSummary: '裁片前片肩宽偏大1.5cm，35件不合格', responsibilitySummary: '裁剪操作失误，完工质检发现，已留证', currentStatus: '已确认，已计入3月第1周期', linkedQcIds: ['QC-NEW-010'] },
  { deductionId: 'DED-2026-003', taskId: 'PDA-EXEC-008', productionOrderId: 'PO-2024-0018', spuName: '基础款T恤', process: '车缝', reason: '其他扣款', source: '逾期违约扣款', defectQty: 0, qtyUnit: '件', amount: 255_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-03-001', cycleIncludedAt: '2026-03-07 14:00', problemSummary: '任务逾期2天，按合同扣除违约金', responsibilitySummary: '设备故障导致逾期，已提交生产暂停记录', currentStatus: '已确认，已计入3月第1周期' },
]

const SETTLEMENT_CYCLES: SettlementCycle[] = [
  { cycleId: 'STL-2026-W12', periodStart: '2026-03-16', periodEnd: '2026-03-22', taskCount: 8, completedQty: 12480, qualifiedQty: 12380, defectQty: 100, grossIncome: 46_010_000, deductionAmount: 720_000, shouldPayAmount: 45_290_000, paidAmount: 29_750_000, unpaidAmount: 15_540_000, status: '部分付款', isCurrentWeek: true, lastPaymentDate: '2026-03-25', nextPaymentNote: '尾款 7,450,000 IDR 银行处理中，预计3~5工作日到账', paymentCount: 3, paidCount: 2, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-W12'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-W12') },
  { cycleId: 'STL-2026-03-001', periodStart: '2026-03-01', periodEnd: '2026-03-15', taskCount: 6, completedQty: 9000, qualifiedQty: 8900, defectQty: 100, grossIncome: 44_230_000, deductionAmount: 960_000, shouldPayAmount: 43_270_000, paidAmount: 26_500_000, unpaidAmount: 16_770_000, status: '部分付款', lastPaymentDate: '2026-03-18', nextPaymentNote: '尾款 6,950,000 IDR 银行处理中，预计3~5工作日到账', paymentCount: 3, paidCount: 2, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-03-001'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-03-001') },
  { cycleId: 'STL-2026-03-002', periodStart: '2026-03-16', periodEnd: '2026-03-31', taskCount: 10, completedQty: 9695, qualifiedQty: 9547, defectQty: 148, grossIncome: 27_897_000, deductionAmount: 820_000, shouldPayAmount: 27_077_000, paidAmount: 8_000_000, unpaidAmount: 19_077_000, status: '待付款', nextPaymentNote: '预计4月10日结算，4月20日付款', paymentCount: 1, paidCount: 0, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-03-002'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-03-002') },
  { cycleId: 'STL-2026-02-002', periodStart: '2026-02-16', periodEnd: '2026-02-28', taskCount: 4, completedQty: 5800, qualifiedQty: 5800, defectQty: 0, grossIncome: 12_400_000, deductionAmount: 0, shouldPayAmount: 12_400_000, paidAmount: 12_400_000, unpaidAmount: 0, status: '已付款', lastPaymentDate: '2026-02-28', paymentCount: 1, paidCount: 1, tasks: [], payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-02-002') },
  { cycleId: 'STL-2026-02-001', periodStart: '2026-02-01', periodEnd: '2026-02-15', taskCount: 5, completedQty: 7200, qualifiedQty: 7170, defectQty: 30, grossIncome: 30_240_000, deductionAmount: 240_000, shouldPayAmount: 30_000_000, paidAmount: 30_000_000, unpaidAmount: 0, status: '已付款', lastPaymentDate: '2026-02-25', paymentCount: 2, paidCount: 2, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-02-001'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-02-001') },
  { cycleId: 'STL-2026-01-001', periodStart: '2026-01-01', periodEnd: '2026-01-31', taskCount: 8, completedQty: 11200, qualifiedQty: 11200, defectQty: 0, grossIncome: 28_750_000, deductionAmount: 0, shouldPayAmount: 28_750_000, paidAmount: 28_750_000, unpaidAmount: 0, status: '已付款', lastPaymentDate: '2026-01-25', paymentCount: 1, paidCount: 1, tasks: [], payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-01-001') },
]

const CW = SETTLEMENT_CYCLES.find((c) => c.isCurrentWeek) || SETTLEMENT_CYCLES[0]
const CW_TASKS = TASK_INCOMES.filter((t) => t.isCurrentWeek)
const CW_DEDUCTIONS = DEDUCTION_RECORDS.filter((d) => d.isCurrentWeek)
const CW_GROSS = CW_TASKS.reduce((s, t) => s + t.grossIncome, 0)
const CW_DEDUCT = CW_DEDUCTIONS.reduce((s, d) => s + d.amount, 0)
const CW_PAID = CW.paidAmount
const CW_UNPAID = CW.unpaidAmount
const CW_SHOULD = CW.shouldPayAmount
const CW_DEDUCT_COUNT = CW_DEDUCTIONS.length
const CW_DEDUCT_INCLUDED = CW_DEDUCTIONS.filter((d) => d.includedInSettlement)
const CW_DEDUCT_PENDING = CW_DEDUCTIONS.filter((d) => !d.includedInSettlement)

const ALL_GROSS = TASK_INCOMES.reduce((s, t) => s + t.grossIncome, 0)
const ALL_DEDUCT = DEDUCTION_RECORDS.reduce((s, d) => s + d.amount, 0)
const ALL_SHOULD = TASK_INCOMES.reduce((s, t) => s + t.shouldPayAmount, 0)
const ALL_PAID = PAYMENT_RECORDS.filter((p) => p.status === '已完成').reduce((s, p) => s + p.amount, 0)
const ALL_UNPAID = ALL_SHOULD - ALL_PAID

function paymentVariant(s: PaymentStatus): BadgeVariant {
  return s === '已付款' ? 'green' : s === '部分付款' ? 'amber' : 'gray'
}

function settlementVariant(s: SettlementStatus): BadgeVariant {
  return s === '已结算' ? 'green' : s === '部分结算' ? 'amber' : 'blue'
}

function cycleVariant(s: CycleStatus): BadgeVariant {
  return s === '已付款' ? 'green' : s === '部分付款' ? 'amber' : s === '待付款' ? 'orange' : 'gray'
}

function deductVariant(s: DeductionSettlementStatus): BadgeVariant {
  return s === '已计入结算' ? 'green' : s === '处理中' ? 'amber' : 'gray'
}

function renderStatusBadge(text: string, variant: BadgeVariant): string {
  return `<span class="inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${
    variant === 'green'
      ? 'bg-green-50 text-green-700'
      : variant === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : variant === 'red'
          ? 'bg-red-50 text-red-700'
          : variant === 'blue'
            ? 'bg-blue-50 text-blue-700'
            : variant === 'orange'
              ? 'bg-orange-50 text-orange-700'
              : 'bg-muted text-muted-foreground'
  }">${escapeHtml(text)}</span>`
}

function renderRow(
  label: string,
  value: string,
  opts: { bold?: boolean; red?: boolean; green?: boolean; orange?: boolean } = {},
): string {
  return `
    <div class="flex items-center justify-between py-0.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <span class="text-xs tabular-nums ${toClassName(
        opts.bold ? 'font-semibold' : '',
        opts.red ? 'font-semibold text-red-600' : '',
        opts.green ? 'font-semibold text-green-600' : '',
        opts.orange ? 'font-semibold text-orange-600' : '',
      )}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderProgress(value: number, heightClass = 'h-2'): string {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  return `
    <div class="${heightClass} w-full overflow-hidden rounded-full bg-muted">
      <div class="h-full bg-primary transition-all" style="width:${normalized}%"></div>
    </div>
  `
}

function renderSCard(title: string, body: string, className = ''): string {
  return `
    <article class="rounded-lg border bg-card shadow-none ${className}">
      <header class="px-4 pb-1.5 pt-3">
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
      </header>
      <div class="space-y-1.5 px-4 pb-3">${body}</div>
    </article>
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

function getTaskById(taskId: string | null): TaskIncome | null {
  if (!taskId) return null
  return TASK_INCOMES.find((item) => item.taskId === taskId) ?? null
}

function getDedById(deductionId: string | null): DeductionRecord | null {
  if (!deductionId) return null
  return DEDUCTION_RECORDS.find((item) => item.deductionId === deductionId) ?? null
}

function getCycleById(cycleId: string | null): SettlementCycle | null {
  if (!cycleId) return null
  return SETTLEMENT_CYCLES.find((item) => item.cycleId === cycleId) ?? null
}

function getSelectedSettlementCycle(): SettlementCycle {
  return getCycleById(state.selectedCycleId) ?? CW
}

function getCycleTasks(cycle: SettlementCycle): TaskIncome[] {
  return TASK_INCOMES.filter((item) => item.cycleId === cycle.cycleId)
}

function getCycleDeductions(cycle: SettlementCycle): DeductionRecord[] {
  return DEDUCTION_RECORDS.filter((item) => item.cycleId === cycle.cycleId)
}

function getCyclePaidRate(cycle: SettlementCycle): number {
  return cycle.shouldPayAmount > 0 ? Math.round((cycle.paidAmount / cycle.shouldPayAmount) * 100) : 0
}

function isQualityDeductionRecord(record: DeductionRecord): boolean {
  if ((record.linkedQcIds?.length ?? 0) > 0) return true
  return record.reason.includes('质量') || record.source.includes('质检')
}

function dedupeStringList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function listTaskLinkedDeductionItems(taskId: string): TaskLinkedDeductionItemViewModel[] {
  return DEDUCTION_RECORDS.filter((record) => record.taskId === taskId)
    .map((record) => {
      const isQualityDeduction = isQualityDeductionRecord(record)
      return {
        record,
        sourceLabel: isQualityDeduction ? '质量扣款' : '其它扣款',
        isQualityDeduction,
        linkedQcIds: dedupeStringList(record.linkedQcIds ?? []),
      }
    })
    .sort((left, right) => {
      if (left.isQualityDeduction !== right.isQualityDeduction) return left.isQualityDeduction ? -1 : 1
      return right.record.amount - left.record.amount
    })
}

function collectTaskLinkedQcIds(task: TaskIncome, linkedDeductions: TaskLinkedDeductionItemViewModel[]): string[] {
  const explicitIds = new Set<string>(task.linkedQualityQcIds ?? [])
  linkedDeductions.forEach((item) => item.linkedQcIds.forEach((qcId) => explicitIds.add(qcId)))

  if (explicitIds.size > 0) return Array.from(explicitIds)

  listQualityDeductionCaseFacts({ includeLegacy: true }).forEach((caseFact) => {
    const sameTask =
      caseFact.qcRecord.taskId === task.taskId ||
      caseFact.qcRecord.refTaskId === task.taskId ||
      caseFact.qcRecord.refId === task.taskId
    const sameProductionAndProcess =
      caseFact.qcRecord.productionOrderNo === task.productionOrderId && caseFact.qcRecord.processLabel === task.process
    if (sameTask || sameProductionAndProcess) {
      explicitIds.add(caseFact.qcRecord.qcId)
    }
  })

  return Array.from(explicitIds)
}

function listTaskLinkedQualityCases(taskId: string): TaskLinkedQualityCaseViewModel[] {
  const task = getTaskById(taskId)
  if (!task) return []

  const linkedDeductions = listTaskLinkedDeductionItems(taskId)
  const qcIds = collectTaskLinkedQcIds(task, linkedDeductions)

  return qcIds
    .map((qcId) => {
      const detail = getFutureMobileFactoryQcDetail(qcId)
      if (!detail) return null
      return {
        qcId: detail.qcId,
        qcNo: detail.qcNo,
        productionOrderNo: detail.productionOrderNo,
        returnInboundBatchNo: detail.returnInboundBatchNo,
        processLabel: detail.processLabel,
        inspectedAt: detail.inspectedAt,
        qcResultLabel: detail.qcResultLabel,
        factoryLiabilityQty: detail.factoryLiabilityQty,
        factoryResponseStatusLabel: detail.factoryResponseStatusLabel,
        disputeStatusLabel: detail.disputeStatusLabel,
        settlementImpactStatusLabel: detail.settlementImpactStatusLabel,
        blockedProcessingFeeAmount: detail.blockedProcessingFeeAmount,
        effectiveQualityDeductionAmount: detail.effectiveQualityDeductionAmount,
        adjustmentSummary: detail.settlementAdjustmentSummary,
        detailHref: `${buildPdaQualityDetailHref(detail.qcId)}?back=settlement`,
      }
    })
    .filter((item): item is TaskLinkedQualityCaseViewModel => item !== null)
    .sort((left, right) => getQualitySortTime(right.inspectedAt) - getQualitySortTime(left.inspectedAt))
}

function getTaskSettlementImpactViewModel(taskId: string): TaskSettlementImpactViewModel {
  const task = getTaskById(taskId)
  const linkedDeductions = listTaskLinkedDeductionItems(taskId)
  const linkedQualityCases = listTaskLinkedQualityCases(taskId)
  const linkedQcIds = new Set(linkedQualityCases.map((item) => item.qcId))
  const adjustmentItems = listFutureSettlementAdjustmentItems({ includeLegacy: true }).filter((item) =>
    linkedQcIds.has(item.qcId),
  )
  const taskLedgerQualityDeductionAmount = linkedDeductions
    .filter((item) => item.isQualityDeduction)
    .reduce((sum, item) => sum + item.record.amount, 0)
  const linkedOtherDeductionAmount = linkedDeductions
    .filter((item) => !item.isQualityDeduction)
    .reduce((sum, item) => sum + item.record.amount, 0)
  const linkedDeductionAmount = linkedDeductions.reduce((sum, item) => sum + item.record.amount, 0)
  const unlinkedDeductionAmount = task ? Math.max(0, task.deductionAmount - linkedDeductionAmount) : 0
  const taskLedgerOtherDeductionAmount = linkedOtherDeductionAmount + unlinkedDeductionAmount
  const blockedProcessingFeeAmount = linkedQualityCases.reduce((sum, item) => sum + item.blockedProcessingFeeAmount, 0)
  const effectiveQualityDeductionAmount = linkedQualityCases.reduce(
    (sum, item) => sum + item.effectiveQualityDeductionAmount,
    0,
  )
  const nextCycleAdjustmentAmount = adjustmentItems.reduce((sum, item) => sum + item.adjustmentAmount, 0)
  const includedCurrentCycleCount = linkedDeductions.filter((item) => item.record.includedInSettlement).length
  const pendingCurrentCycleCount = linkedDeductions.filter((item) => !item.record.includedInSettlement).length
  const statusSummary =
    adjustmentItems.length > 0
      ? `存在 ${adjustmentItems.length} 条下周期调整`
      : blockedProcessingFeeAmount > 0
        ? '当前仍有冻结加工费影响'
        : effectiveQualityDeductionAmount > 0
          ? '质量扣款已进入当前周期影响'
          : '当前无额外质量冻结或调整影响'

  return {
    taskLedgerQualityDeductionAmount,
    taskLedgerOtherDeductionAmount,
    blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount,
    includedCurrentCycleCount,
    pendingCurrentCycleCount,
    nextCycleAdjustmentAmount,
    adjustmentItems,
    statusSummary,
    unlinkedDeductionAmount,
  }
}

function getTaskIncomeDetailViewModel(taskId: string): TaskIncomeDetailViewModel | null {
  const task = getTaskById(taskId)
  if (!task) return null

  const linkedDeductionItems = listTaskLinkedDeductionItems(taskId)
  const linkedQualityCases = listTaskLinkedQualityCases(taskId)
  const settlementImpact = getTaskSettlementImpactViewModel(taskId)

  return {
    task,
    linkedDeductionItems,
    linkedQualityCases,
    settlementImpact,
  }
}

function getTaskIncomeListItems(tasks: TaskIncome[]): TaskIncomeListItemViewModel[] {
  return tasks.map((task) => {
    const detail = getTaskIncomeDetailViewModel(task.taskId)
    return {
      task,
      hasLinkedQualityCases: (detail?.linkedQualityCases.length ?? 0) > 0,
      hasAdjustment: (detail?.settlementImpact.adjustmentItems.length ?? 0) > 0,
    }
  })
}

function getTaskQualityEntryView(detail: TaskIncomeDetailViewModel): QualityView {
  if (
    detail.linkedQualityCases.some(
      (item) => item.disputeStatusLabel.includes('待平台') || item.disputeStatusLabel.includes('处理中') || item.disputeStatusLabel === '异议中',
    )
  ) {
    return 'disputing'
  }
  if (detail.linkedQualityCases.some((item) => item.factoryResponseStatusLabel.includes('待响应'))) return 'pending'
  return 'processed'
}

function renderTaskDrawer(task: TaskIncome): string {
  const detail = getTaskIncomeDetailViewModel(task.taskId)
  if (!detail) {
    return renderDrawer(
      `任务收入 · ${task.taskId}`,
      `<div class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">当前任务明细暂不可用</div>`,
      'close-task-drawer',
    )
  }

  const { settlementImpact, linkedDeductionItems, linkedQualityCases } = detail

  const linkedDeductionSection =
    linkedDeductionItems.length > 0
      ? linkedDeductionItems
          .map(
            (item) => `
              <div class="rounded-md border bg-muted/20 px-3 py-2">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-xs font-medium">${escapeHtml(item.record.deductionId)}</span>
                      ${renderStatusBadge(item.sourceLabel, item.isQualityDeduction ? 'amber' : 'gray')}
                      ${renderStatusBadge(item.record.settlementStatus, deductVariant(item.record.settlementStatus))}
                    </div>
                    <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`${item.record.reason} · ${item.record.currentStatus}`)}</div>
                    <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`${item.record.productionOrderId} · ${item.record.process} · ${item.record.cycleId || '待分配周期'}`)}</div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-xs font-semibold ${item.record.amount > 0 ? 'text-red-600' : 'text-foreground'}">${escapeHtml(fmtIDR(item.record.amount))}</div>
                    <button
                      class="mt-2 rounded-md border px-2.5 py-1 text-[10px] hover:bg-muted"
                      data-pda-sett-action="open-ded-drawer"
                      data-ded-id="${escapeHtml(item.record.deductionId)}"
                    >
                      查看扣款项
                    </button>
                  </div>
                </div>
              </div>
            `,
          )
          .join('')
      : '<div class="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">当前任务没有关联扣款项</div>'

  const linkedQualitySection =
    linkedQualityCases.length > 0
      ? linkedQualityCases
          .map(
            (item) => `
              <div class="rounded-md border bg-muted/20 px-3 py-2">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-xs font-medium">${escapeHtml(item.qcNo)}</span>
                      ${renderStatusBadge(item.qcResultLabel, getQualityBadgeVariant(item.qcResultLabel))}
                      ${renderStatusBadge(item.factoryResponseStatusLabel, getQualityResponseVariant(item.factoryResponseStatusLabel))}
                    </div>
                    <div class="mt-1 flex flex-wrap gap-1.5">
                      ${renderStatusBadge(item.disputeStatusLabel, getQualityDisputeVariant(item.disputeStatusLabel))}
                      ${renderStatusBadge(item.settlementImpactStatusLabel, getQualitySettlementVariant(item.settlementImpactStatusLabel))}
                    </div>
                    <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`${item.productionOrderNo} · ${item.returnInboundBatchNo} · ${item.processLabel}`)}</div>
                    <div class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(`工厂责任 ${item.factoryLiabilityQty} 件 · 冻结 ${formatSettlementAwareAmount(item.blockedProcessingFeeAmount, 'CNY', item.inspectedAt)} · 生效扣款 ${formatSettlementAwareAmount(item.effectiveQualityDeductionAmount, 'CNY', item.inspectedAt)}`)}</div>
                    ${item.adjustmentSummary ? `<div class="mt-1 text-[10px] text-blue-700">${escapeHtml(item.adjustmentSummary)}</div>` : ''}
                  </div>
                  <div class="shrink-0">
                    <button class="rounded-md border px-2.5 py-1 text-[10px] hover:bg-muted" data-nav="${escapeHtml(item.detailHref)}">
                      查看质检详情
                    </button>
                  </div>
                </div>
              </div>
            `,
          )
          .join('')
      : '<div class="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">当前任务没有关联质检记录</div>'

  const payments =
    task.payments && task.payments.length > 0
      ? renderSCard(
          '付款记录',
          task.payments
            .map(
              (p) => `
                <div class="flex items-center justify-between py-0.5 text-xs">
                  <span class="text-muted-foreground">${escapeHtml(`${p.seq} · ${p.date}`)}</span>
                  <span class="font-medium text-green-700">${escapeHtml(fmtIDR(p.amount))}</span>
                </div>
              `,
            )
            .join(''),
        )
      : ''

  return renderDrawer(
    `任务收入 · ${task.taskId}`,
    `
      ${renderSCard(
        '金额情况',
        `${task.isCurrentWeek ? renderRow('是否纳入本周结算', task.settlementStatus === '待结算' ? '待纳入' : '已纳入') : ''}
         ${task.isCurrentWeek ? renderRow('本周计入金额', fmtIDR(task.shouldPayAmount), { bold: true }) : ''}
         ${task.isCurrentWeek ? renderRow('本周扣款', task.deductionAmount > 0 ? fmtIDR(task.deductionAmount) : '—', { red: task.deductionAmount > 0 }) : ''}
         ${task.isCurrentWeek ? renderRow('本周已付', fmtIDR(task.paidAmount), { green: task.paidAmount > 0 }) : ''}
         ${task.isCurrentWeek ? renderRow('本周未付', task.unpaidAmount > 0 ? fmtIDR(task.unpaidAmount) : '—', { red: task.unpaidAmount > 0 }) : ''}
         ${renderRow('任务毛收入', fmtIDR(task.grossIncome))}
         ${renderRow('扣款总额', task.deductionAmount > 0 ? fmtIDR(task.deductionAmount) : '—', { red: task.deductionAmount > 0 })}
         ${renderRow('任务净额', fmtIDR(task.netIncome), { bold: true })}
         ${renderRow('应结金额', fmtIDR(task.shouldPayAmount), { bold: true })}
         ${renderRow('已付金额', fmtIDR(task.paidAmount), { green: task.paidAmount > 0 })}
         ${renderRow('未付金额', task.unpaidAmount > 0 ? fmtIDR(task.unpaidAmount) : '已付清', {
           red: task.unpaidAmount > 0,
           green: task.unpaidAmount === 0,
         })}`,
      )}
      ${renderSCard(
        '扣款来源与结算影响',
        `${renderRow('质量扣款（任务台账）', settlementImpact.taskLedgerQualityDeductionAmount > 0 ? fmtIDR(settlementImpact.taskLedgerQualityDeductionAmount) : '—', {
          red: settlementImpact.taskLedgerQualityDeductionAmount > 0,
        })}
         ${renderRow('其它扣款（任务台账）', settlementImpact.taskLedgerOtherDeductionAmount > 0 ? fmtIDR(settlementImpact.taskLedgerOtherDeductionAmount) : '—', {
           red: settlementImpact.taskLedgerOtherDeductionAmount > 0,
         })}
         ${renderRow('当前冻结加工费影响', formatSettlementAwareAmount(settlementImpact.blockedProcessingFeeAmount, 'CNY', task.lastPaymentDate || task.payments[task.payments.length - 1]?.date), {
           orange: settlementImpact.blockedProcessingFeeAmount > 0,
         })}
         ${renderRow('当前生效质量扣款', formatSettlementAwareAmount(settlementImpact.effectiveQualityDeductionAmount, 'CNY', task.lastPaymentDate || task.payments[task.payments.length - 1]?.date), {
           red: settlementImpact.effectiveQualityDeductionAmount > 0,
         })}
         ${renderRow('下周期调整', formatSettlementAwareAmount(settlementImpact.nextCycleAdjustmentAmount, 'CNY', task.lastPaymentDate || task.payments[task.payments.length - 1]?.date), {
           orange: settlementImpact.nextCycleAdjustmentAmount !== 0,
         })}
         ${renderRow('当前冻结加工费影响', formatSettlementAwareAmount(settlementImpact.blockedProcessingFeeAmount, 'CNY', task.lastPaymentDate || task.payments[task.payments.length - 1]?.date), {
           orange: settlementImpact.blockedProcessingFeeAmount > 0,
         })}
         ${renderRow('当前生效质量扣款', formatSettlementAwareAmount(settlementImpact.effectiveQualityDeductionAmount, 'CNY', task.lastPaymentDate || task.payments[task.payments.length - 1]?.date), {
           red: settlementImpact.effectiveQualityDeductionAmount > 0,
         })}
         ${renderRow('已纳入当前周期的扣款项', `${settlementImpact.includedCurrentCycleCount} 笔`)}
         ${renderRow('待计入当前周期的扣款项', `${settlementImpact.pendingCurrentCycleCount} 笔`)}
         ${renderRow('下周期调整金额', formatSettlementAwareAmount(settlementImpact.nextCycleAdjustmentAmount, 'CNY', task.lastPaymentDate || task.payments[task.payments.length - 1]?.date), {
           orange: settlementImpact.nextCycleAdjustmentAmount !== 0,
         })}
         ${renderRow('状态说明', settlementImpact.statusSummary)}
         ${
           settlementImpact.adjustmentItems.length > 0
             ? `<div class="mt-2 space-y-2">
                 ${settlementImpact.adjustmentItems
                   .map(
                     (item) => `
                       <div class="rounded-md border bg-muted/20 px-2.5 py-2 text-[10px]">
                         <div class="flex items-center justify-between gap-2">
                           <span class="font-medium">${escapeHtml(item.adjustmentTypeLabel)}</span>
                           <span class="font-semibold text-amber-700">${escapeHtml(formatSettlementAwareAmount(item.adjustmentAmount, 'CNY', item.generatedAt))}</span>
                         </div>
                         <div class="mt-0.5 text-muted-foreground">${escapeHtml(`${item.adjustmentNo} · 目标周期 ${item.targetSettlementCycleId}`)}</div>
                       </div>
                     `,
                   )
                   .join('')}
               </div>`
             : ''
         }
         <p class="pt-1 text-[10px] leading-5 text-muted-foreground">任务收入主金额按当前结算币种展示；质量影响优先展示结算币种金额，原始币种、汇率与换算时点作为辅助信息保留。</p>`,
      )}
      ${renderSCard(
        '数量与基础信息',
        `${renderRow('完成数量', fmtQty(task.completedQty, task.qtyUnit))}
         ${renderRow('合格数量', fmtQty(task.qualifiedQty, task.qtyUnit))}
         ${renderRow('不合格数量', task.defectQty > 0 ? fmtQty(task.defectQty, task.qtyUnit) : '—')}
         ${renderRow('单价', fmtRate(task.unitPrice, task.qtyUnit))}
         ${renderRow('任务编号', task.taskId)}
         ${renderRow('生产单号', task.productionOrderId)}
         ${renderRow('款式', task.spuName)}
         ${renderRow('工序', task.process)}
         ${renderRow('结算周期', task.cycleId)}
         ${renderRow('结算状态', task.settlementStatus)}
         ${renderRow('付款状态', task.paymentStatus)}`,
      )}
      ${renderSCard(
        '关联扣款项',
        `${linkedDeductionSection}
         ${
           settlementImpact.unlinkedDeductionAmount > 0
             ? `<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">任务结果口径仍有 ${escapeHtml(fmtIDR(settlementImpact.unlinkedDeductionAmount))} 扣款未拆到单笔台账项，请后续在扣款台账补录。</div>`
             : ''
         }`,
      )}
      ${renderSCard('关联质检记录', linkedQualitySection)}
      ${payments}
      <div class="flex flex-wrap gap-2">
        <button
          class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="goto-cycle-from-task"
          data-cycle-id="${escapeHtml(task.cycleId)}"
        >
          <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>查看所属周期
        </button>
        <button
          class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="goto-deductions-from-task"
          data-task-id="${escapeHtml(task.taskId)}"
          data-cycle-id="${escapeHtml(task.cycleId)}"
        >
          <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>去扣款台账
        </button>
        ${
          linkedQualityCases.length > 0
            ? `
              <button
                class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
                data-pda-sett-action="goto-quality-from-task"
                data-task-id="${escapeHtml(task.taskId)}"
                data-cycle-id="${escapeHtml(task.cycleId)}"
              >
                <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>去质检扣款
              </button>
            `
            : ''
        }
      </div>
    `,
    'close-task-drawer',
  )
}

function renderDeductionDrawer(detail: SettlementLedgerDetailViewModel): string {
  const { item, linkedTask, linkedQualityCase } = detail
  const hasBasis = Boolean(item.basisId)
  const hasQuality = Boolean(item.qcId && linkedQualityCase)
  const blockedLabel = item.sourceType === 'QUALITY' ? '当前冻结加工费影响' : '当前冻结扣款'
  const effectiveLabel = item.sourceType === 'QUALITY' ? '当前生效质量扣款' : '当前已生效扣款'
  const settlementAmountLabel =
    item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING'
      ? '下周期调整金额'
      : item.financialStatus === 'BLOCKED'
        ? '当前冻结影响金额'
        : item.financialStatus === 'REVERSED'
          ? '已冲回金额'
          : '当前已生效金额'
  return renderDrawer(
    `扣款台账 · ${item.ledgerNo}`,
    `
      ${renderSCard(
        '基本信息',
        `${renderRow('台账单号', item.ledgerNo, { bold: true })}
         ${renderRow('来源类型', item.sourceTypeLabel)}
         ${renderRow('所属周期', item.cycleId || '待分配')}
         ${renderRow('当前状态', item.financialStatusLabel, {
           green: item.financialStatus === 'EFFECTIVE',
           orange: item.financialStatus === 'BLOCKED' || item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING',
         })}
         ${item.targetCycleId ? renderRow('目标周期', item.targetCycleId) : ''}`,
        item.isCurrentWeek ? 'border-amber-200 bg-amber-50/30' : '',
      )}
      ${renderSCard(
        '金额信息',
        `${renderRow(`结算主币种金额（${item.currencyDisplay.settlementCurrency}）`, item.currencyDisplay.settlementAmountLabel, { bold: true, red: true })}
         ${
           item.currencyDisplay.isConverted
             ? renderRow('原始币种金额', item.currencyDisplay.originalAmountLabel)
             : ''
         }
         ${item.currencyDisplay.isConverted ? renderRow('汇率', item.currencyDisplay.rateLabel) : ''}
         ${item.currencyDisplay.isConverted ? renderRow('换算时点', formatDateTime(item.currencyDisplay.fxAppliedAt)) : ''}
         ${renderRow(settlementAmountLabel, item.currencyDisplay.settlementAmountLabel, {
           red: item.financialStatus !== 'REVERSED',
         })}
         ${
           item.blockedProcessingFeeAmount > 0
             ? renderRow(
                 blockedLabel,
                 item.currencyDisplay.isConverted
                   ? `${formatCurrencyByCode(Math.round(item.blockedProcessingFeeAmount * item.currencyDisplay.rate), item.currencyDisplay.settlementCurrency)}（原 ${fmtCny(item.blockedProcessingFeeAmount)}）`
                   : formatCurrencyByCode(item.blockedProcessingFeeAmount, item.currencyDisplay.settlementCurrency),
                 { orange: true },
               )
             : ''
         }
         ${
           item.effectiveQualityDeductionAmount > 0
             ? renderRow(
                 effectiveLabel,
                 item.currencyDisplay.isConverted
                   ? `${formatCurrencyByCode(Math.round(item.effectiveQualityDeductionAmount * item.currencyDisplay.rate), item.currencyDisplay.settlementCurrency)}（原 ${fmtCny(item.effectiveQualityDeductionAmount)}）`
                   : formatCurrencyByCode(item.effectiveQualityDeductionAmount, item.currencyDisplay.settlementCurrency),
                 { red: true },
               )
             : ''
         }
         ${
           item.adjustmentAmount > 0
             ? renderRow(
                 '下周期调整金额',
                 item.currencyDisplay.isConverted
                   ? `${formatCurrencyByCode(Math.round(item.adjustmentAmount * item.currencyDisplay.rate), item.currencyDisplay.settlementCurrency)}（原 ${fmtCny(item.adjustmentAmount)}）`
                   : formatCurrencyByCode(item.adjustmentAmount, item.currencyDisplay.settlementCurrency),
                 { orange: true },
               )
             : ''
         }`,
      )}
      ${renderSCard(
        '来源链路',
        `${renderRow('扣款原因', item.reason)}
         ${renderRow('来源说明', item.sourceSummary)}
         ${renderRow('关联任务', item.taskId ?? '—')}
         ${renderRow('生产单号', item.productionOrderId)}
         ${renderRow('关联质检', item.qcNo ?? '—')}
         ${hasBasis ? renderRow('关联扣款依据', item.basisId!) : ''}`,
      )}
      ${renderSCard(
        '结算影响',
        `${renderRow('是否已纳入当前周期', item.includedInCurrentCycle ? '已纳入' : '未纳入')}
         ${renderRow('是否待下周期调整', item.financialStatus === 'NEXT_CYCLE_ADJUSTMENT_PENDING' ? '是' : '否')}
         ${renderRow('关键时间', item.keyTime ? `${item.keyTimeLabel} · ${formatDateTime(item.keyTime)}` : '—')}
         ${item.adjustmentTypeLabel ? renderRow('调整类型', item.adjustmentTypeLabel) : ''}
         ${item.writebackStatusLabel ? renderRow('调整写回', item.writebackStatusLabel) : ''}
         ${renderRow('状态说明', item.currentStatusText)}`,
      )}
      ${
        linkedQualityCase
          ? renderSCard(
              '关联质检记录',
              `${renderRow('质检单号', linkedQualityCase.qcNo)}
               ${renderRow('质检结果', linkedQualityCase.qcResultLabel)}
               ${renderRow('工厂响应', linkedQualityCase.factoryResponseStatusLabel)}
               ${renderRow('异议状态', linkedQualityCase.disputeStatusLabel)}
               ${renderRow('结算影响', linkedQualityCase.settlementImpactStatusLabel)}
               ${renderRow('冻结加工费金额', formatSettlementAwareAmount(linkedQualityCase.blockedProcessingFeeAmount, 'CNY', linkedQualityCase.inspectedAt))}
               ${renderRow('生效质量扣款金额', formatSettlementAwareAmount(linkedQualityCase.effectiveQualityDeductionAmount, 'CNY', linkedQualityCase.inspectedAt))}
               ${
                 linkedQualityCase.settlementAdjustmentSummary
                   ? renderRow('下周期调整', linkedQualityCase.settlementAdjustmentSummary)
                   : ''
               }`,
            )
          : ''
      }
      ${
        linkedTask || hasQuality || hasBasis
          ? `
            <div class="flex gap-2">
              ${
                linkedTask
                  ? `
                    <button
                      class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
                      data-pda-sett-action="goto-task-from-ded"
                      data-task-id="${escapeHtml(linkedTask.taskId)}"
                    >
                      <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>查看任务
                    </button>
                  `
                  : ''
              }
              ${
                hasQuality
                  ? `
                    <button class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(`${buildPdaQualityDetailHref(item.qcId!)}?back=settlement`)}">
                      <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>查看质检
                    </button>
                  `
                  : ''
              }
              ${
                hasBasis
                  ? `
                    <button class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(item.basisId!))}">
                      <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>查看扣款依据
                    </button>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }
    `,
    'close-ded-drawer',
  )
}

function renderCycleDrawer(cycle: SettlementCycle): string {
  const paidRate = cycle.shouldPayAmount > 0 ? Math.round((cycle.paidAmount / cycle.shouldPayAmount) * 100) : 0

  const payments =
    cycle.payments.length > 0
      ? renderSCard(
          cycle.isCurrentWeek ? '本周付款记录' : '付款记录',
          cycle.payments
            .map(
              (p) => `
                <div class="border-b py-1 last:border-0">
                  <div class="flex items-start justify-between">
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-medium">${escapeHtml(p.paymentId)}</div>
                      <div class="text-[10px] text-muted-foreground">${escapeHtml(`${p.paymentDate} · ${p.method}`)}</div>
                      <div class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(p.remark)}</div>
                    </div>
                    <div class="ml-3 flex shrink-0 flex-col items-end">
                      <span class="text-xs font-semibold text-green-700">${escapeHtml(fmtIDR(p.amount))}</span>
                      ${renderStatusBadge(p.status, p.status === '已完成' ? 'green' : 'amber')}
                    </div>
                  </div>
                </div>
              `,
            )
            .join(''),
        )
      : ''

  const tasks =
    cycle.tasks.length > 0
      ? renderSCard(
          cycle.isCurrentWeek ? '本周覆盖任务' : '覆盖任务',
          cycle.tasks
            .map(
              (t) => `
                <button
                  class="w-full border-b py-1.5 text-left last:border-0"
                  data-pda-sett-action="goto-task-from-cycle"
                  data-task-id="${escapeHtml(t.taskId)}"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-xs font-medium">${escapeHtml(t.taskId)}</span>
                      <span class="ml-2 text-[10px] text-muted-foreground">${escapeHtml(`${t.spuName} · ${t.process}`)}</span>
                    </div>
                    <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                  </div>
                  <div class="mt-0.5 flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground">净额 ${escapeHtml(fmtIDR(t.netIncome))}</span>
                    ${renderStatusBadge(t.paymentStatus, paymentVariant(t.paymentStatus))}
                  </div>
                </button>
              `,
            )
            .join(''),
        )
      : ''

  return renderDrawer(
    `结算周期 · ${cycle.cycleId}`,
    `
      ${renderSCard(
        cycle.isCurrentWeek ? '本周付款状态' : '付款状态',
        `${renderRow('应付金额', fmtIDR(cycle.shouldPayAmount), { bold: true })}
         ${renderRow('已付金额', fmtIDR(cycle.paidAmount), { green: cycle.paidAmount > 0 })}
         ${renderRow('未付金额', cycle.unpaidAmount > 0 ? fmtIDR(cycle.unpaidAmount) : '已付清', {
           red: cycle.unpaidAmount > 0,
           green: cycle.unpaidAmount === 0,
         })}
         <div class="pt-1">
           <div class="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
             <span>付款进度</span>
             <span>${paidRate}%</span>
           </div>
           ${renderProgress(paidRate, 'h-1.5')}
         </div>
         ${
           cycle.unpaidAmount > 0
             ? `<div class="mt-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">还差 ${escapeHtml(fmtIDR(cycle.unpaidAmount))} 未付</div>`
             : ''
         }
         ${cycle.nextPaymentNote ? `<p class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(cycle.nextPaymentNote)}</p>` : ''}`,
        cycle.unpaidAmount > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-green-200 bg-green-50/30',
      )}
      ${payments}
      ${tasks}
      ${renderSCard(
        '金额汇总',
        `${renderRow('毛收入', fmtIDR(cycle.grossIncome))}
         ${renderRow('扣款', cycle.deductionAmount > 0 ? fmtIDR(cycle.deductionAmount) : '—', { red: cycle.deductionAmount > 0 })}
         ${renderRow('应结金额', fmtIDR(cycle.shouldPayAmount), { bold: true })}
         ${renderRow('覆盖任务数', `${cycle.taskCount} 个`)}
         ${renderRow('完成数量', fmtQty(cycle.completedQty))}
         ${renderRow('不合格数量', cycle.defectQty > 0 ? fmtQty(cycle.defectQty) : '—')}
         ${renderRow('周期起止', `${cycle.periodStart} ~ ${cycle.periodEnd}`)}`,
      )}
    `,
    'close-cycle-drawer',
  )
}

function renderSettlementMaterialEntry(): string {
  const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
  if (!effective) {
    return `
      <button
        class="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
        data-pda-sett-action="open-settlement-change-request"
      >
        结算资料
      </button>
    `
  }

  const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
  const latestRequest = getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)
  const currentRequest = activeRequest ?? latestRequest

  return `
    <button
      class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs hover:bg-muted"
      data-pda-sett-action="open-settlement-profile"
    >
      <span>结算资料</span>
      <span class="text-muted-foreground">${escapeHtml(effective.versionNo)}</span>
      ${
        currentRequest
          ? `<span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(currentRequest.status)}">${escapeHtml(getSettlementStatusLabel(currentRequest.status))}</span>`
          : ''
      }
    </button>
  `
}

function renderSettlementProfileEntryCard(): string {
  const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
  const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
  const latestRequest = getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)
  const currentRequest = activeRequest ?? latestRequest

  if (!effective) {
    return `
      <section class="rounded-lg border bg-card px-4 py-4 shadow-none">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold">结算资料</h3>
            <p class="mt-0.5 text-[10px] text-muted-foreground">当前工厂尚未初始化结算资料，可先补齐收款账户与版本信息。</p>
          </div>
        </div>
        <div class="mt-3">
          <button
            class="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-sett-action="open-settlement-change-request"
          >
            去维护结算资料
          </button>
        </div>
      </section>
    `
  }

  const accountNo = effective.bankAccountNo.replace(/\s+/g, '')
  const accountTail = accountNo.length >= 4 ? accountNo.slice(-4) : accountNo

  return `
    <section class="rounded-lg border bg-card px-4 py-4 shadow-none">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">结算资料</h3>
          <p class="mt-0.5 text-[10px] text-muted-foreground">当前周期外维护入口，仅展示收款资料概况，完整信息在独立资料页查看。</p>
        </div>
        ${
          currentRequest
            ? `<span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(currentRequest.status)}">${escapeHtml(getSettlementStatusLabel(currentRequest.status))}</span>`
            : ''
        }
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div class="rounded-md bg-muted/30 px-3 py-2">
          <div class="text-muted-foreground">收款户名</div>
          <div class="mt-0.5 text-xs font-medium text-foreground">${escapeHtml(effective.accountHolderName)}</div>
        </div>
        <div class="rounded-md bg-muted/30 px-3 py-2">
          <div class="text-muted-foreground">银行</div>
          <div class="mt-0.5 text-xs font-medium text-foreground">${escapeHtml(effective.bankName)}</div>
        </div>
        <div class="rounded-md bg-muted/30 px-3 py-2">
          <div class="text-muted-foreground">账号尾号</div>
          <div class="mt-0.5 text-xs font-medium text-foreground">尾号 ${escapeHtml(accountTail)}</div>
        </div>
        <div class="rounded-md bg-muted/30 px-3 py-2">
          <div class="text-muted-foreground">当前版本 / 生效时间</div>
          <div class="mt-0.5 text-xs font-medium text-foreground">${escapeHtml(`${effective.versionNo} · ${effective.effectiveAt}`)}</div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          data-pda-sett-action="open-settlement-profile"
        >
          查看结算资料
        </button>
        <button
          class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          data-pda-sett-action="${activeRequest ? 'open-settlement-request-detail' : 'open-settlement-change-request'}"
        >
          ${activeRequest ? '查看修改申请' : '申请修改结算资料'}
        </button>
      </div>
    </section>
  `
}

function renderSettlementRequestDrawer(): string {
  const mode = state.settlementRequestDrawerMode
  if (!mode) return ''

  const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
  const requestHistory = getSettlementRequestListByCurrentFactory()
  const versionHistory = getSettlementVersionHistory(CURRENT_FACTORY_ID)
  const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
  const latestRequest = getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)
  const currentRequest = getSettlementRequestForDrawer()
  const summaryRequest = activeRequest ?? latestRequest

  if (mode === 'profile') {
    if (!effective) return ''

    const activeSummary = activeRequest
      ? `
        <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-medium text-amber-800">当前进行中的申请</p>
              <p class="mt-1 text-[10px] text-amber-700">${escapeHtml(activeRequest.requestId)} · ${escapeHtml(
                getChangedSettlementFields(activeRequest),
              )}</p>
              <p class="mt-1 text-[10px] text-amber-700">提交时间：${escapeHtml(activeRequest.submittedAt)}</p>
            </div>
            <button
              class="rounded-md border border-amber-200 bg-background px-3 py-1.5 text-xs text-amber-800 hover:bg-muted"
              data-pda-sett-action="open-settlement-request-detail"
              data-request-id="${escapeHtml(activeRequest.requestId)}"
            >
              查看申请
            </button>
          </div>
        </div>
      `
      : summaryRequest
        ? `
          <div class="rounded-md border bg-muted/20 px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium">最近一次申请</p>
                <p class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(summaryRequest.requestId)} · ${escapeHtml(
                  getSettlementStatusLabel(summaryRequest.status),
                )}</p>
                <p class="mt-1 text-[10px] text-muted-foreground">提交时间：${escapeHtml(summaryRequest.submittedAt)}</p>
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

    return renderDrawer(
      '查看结算资料',
      `
        <div class="rounded-md border bg-muted/20 px-3 py-3">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">当前版本</span>
            <span class="font-medium">${escapeHtml(effective.versionNo)}</span>
          </div>
          <div class="mt-1.5 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <div>最近生效：${escapeHtml(effective.effectiveAt)}</div>
            <div>生效人：${escapeHtml(effective.effectiveBy)}</div>
            <div>最近更新：${escapeHtml(effective.updatedBy)}</div>
            <div>结算币种：${escapeHtml(effective.settlementConfigSnapshot.currency)}</div>
          </div>
        </div>

        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-700">
          工厂端仅可查看当前生效结算资料并发起变更申请，当前主数据仍以平台审核通过后的版本为准，不会在提交申请后立即覆盖。
        </div>

        <div class="rounded-md border p-3">
          <p class="mb-2 text-xs font-medium">当前生效资料</p>
          <div class="grid gap-2 md:grid-cols-2">
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
              <p class="text-xs">结算日规则：${escapeHtml(effective.settlementConfigSnapshot.settlementDayRule)}</p>
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

        ${activeSummary}

        <div class="grid grid-cols-2 gap-2">
          <button
            class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
            data-pda-sett-action="open-settlement-request-history"
          >
            历史申请（${requestHistory.length}）
          </button>
          <button
            class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
            data-pda-sett-action="open-settlement-version-history"
          >
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
          工厂端只能查看与发起变更申请，当前生效资料仍以平台审核通过后的版本为准。
        </div>
        ${renderSettlementRequestHistoryList(requestHistory)}
        <button
          class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="back-to-settlement-profile"
        >
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
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
          仅查看版本沿革，不支持工厂端直接修改当前生效版本。
        </div>
        ${renderSettlementVersionHistoryList(versionHistory)}
        <button
          class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="back-to-settlement-profile"
        >
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
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">提交后进入待审核，当前生效信息不会立即变更。</div>
        ${
          state.settlementRequestErrorText
            ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.settlementRequestErrorText)}</div>`
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
            <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-xs" placeholder="可填写变更原因" data-pda-sett-field="request.submitRemark">${escapeHtml(
              state.settlementRequestForm.submitRemark,
            )}</textarea>
          </label>
        </div>
        <button class="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" data-pda-sett-action="submit-settlement-change-request">提交申请</button>
      `,
      'close-settlement-request-drawer',
    )
  }

  if (!currentRequest) {
    return renderDrawer(
      '查看结算资料申请',
      `
        <div class="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">当前暂无申请记录</div>
        <button
          class="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="back-to-settlement-profile"
        >
          返回结算资料
        </button>
      `,
      'close-settlement-request-drawer',
    )
  }

  return renderDrawer(
    '查看结算资料申请',
    `
      <div class="rounded-md border bg-muted/20 px-3 py-2">
        <div class="flex items-center justify-between">
          <p class="text-xs font-medium">${escapeHtml(currentRequest.requestId)}</p>
          <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(currentRequest.status)}">
            ${escapeHtml(getSettlementStatusLabel(currentRequest.status))}
          </span>
        </div>
        <p class="mt-1 text-[10px] text-muted-foreground">申请时间：${escapeHtml(currentRequest.submittedAt)} · 提交人：${escapeHtml(currentRequest.submittedBy)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">当前版本：${escapeHtml(currentRequest.currentVersionNo)} · 目标版本：${escapeHtml(currentRequest.targetVersionNo)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">签字证明：${currentRequest.signedProofFiles.length > 0 ? `已上传 ${currentRequest.signedProofFiles.length} 份` : '未上传'}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">变更内容：${escapeHtml(getChangedSettlementFields(currentRequest))}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">下一步：${escapeHtml(getRequestNextStepText(currentRequest))}</p>
        ${
          currentRequest.reviewRemark
            ? `<p class="mt-1 text-[10px] text-muted-foreground">审核意见：${escapeHtml(currentRequest.reviewRemark)}</p>`
            : ''
        }
        ${
          currentRequest.rejectReason
            ? `<p class="mt-1 text-[10px] text-red-600">驳回原因：${escapeHtml(currentRequest.rejectReason)}</p>`
            : ''
        }
      </div>

      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">变更前后</p>
        <div class="grid gap-2 md:grid-cols-2">
          <div class="space-y-1 rounded-md border bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">变更前（生效）</p>
            <p class="text-xs">开户名：${escapeHtml(currentRequest.before.accountHolderName)}</p>
            <p class="text-xs">证件号：${escapeHtml(currentRequest.before.idNumber)}</p>
            <p class="text-xs">银行：${escapeHtml(currentRequest.before.bankName)}</p>
            <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(currentRequest.before.bankAccountNo))}</p>
            <p class="text-xs">支行：${escapeHtml(currentRequest.before.bankBranch || '—')}</p>
          </div>
          <div class="space-y-1 rounded-md border bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">申请修改后</p>
            <p class="text-xs">开户名：${escapeHtml(currentRequest.after.accountHolderName)}</p>
            <p class="text-xs">证件号：${escapeHtml(currentRequest.after.idNumber)}</p>
            <p class="text-xs">银行：${escapeHtml(currentRequest.after.bankName)}</p>
            <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(currentRequest.after.bankAccountNo))}</p>
            <p class="text-xs">支行：${escapeHtml(currentRequest.after.bankBranch || '—')}</p>
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
        <button
          class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="back-to-settlement-profile"
        >
          返回结算资料
        </button>
        <button
          class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="open-settlement-request-history"
        >
          查看历史申请
        </button>
      </div>
    `,
    'close-settlement-request-drawer',
  )
}

function renderOverviewContent(cycle: SettlementCycle, qualityFactoryId: string): string {
  const cycleTasks = getCycleTasks(cycle)
  const cycleDeductions = getCycleDeductions(cycle)
  const cycleGross = cycleTasks.reduce((sum, item) => sum + item.grossIncome, 0)
  const cycleDeduct = cycleDeductions.reduce((sum, item) => sum + item.amount, 0)
  const cyclePaidRate = getCyclePaidRate(cycle)
  const cycleDeductIncluded = cycleDeductions.filter((item) => item.includedInSettlement)
  const cycleDeductPending = cycleDeductions.filter((item) => !item.includedInSettlement)
  const cycleScopeLabel = cycle.isCurrentWeek ? '本周期' : '该周期'
  const cycleTitle = cycle.isCurrentWeek ? '本周期能拿多少钱' : '该周期结算总览'
  const qualitySummary = getFutureMobileFactoryQcSummary(qualityFactoryId)
  const qualityEntryView: QualityView =
    qualitySummary.pendingCount > 0 ? 'pending' : qualitySummary.disputingCount > 0 ? 'disputing' : 'processed'

  return `
    <div class="space-y-4 p-4">
      <div class="overflow-hidden rounded-xl border-2 border-primary bg-primary/5">
        <div class="flex items-center justify-between px-4 pb-1 pt-3">
          <div>
            <h2 class="text-base font-bold">${cycleTitle}</h2>
            <p class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(`${cycle.cycleId} · ${cycle.periodStart} ~ ${cycle.periodEnd}`)}</p>
          </div>
          ${renderStatusBadge(cycle.status, cycleVariant(cycle.status))}
        </div>

        <div class="border-y border-primary/20 bg-primary/10 px-4 py-3">
          <div class="text-[10px] text-muted-foreground">${cycleScopeLabel}预计到账（应结金额）</div>
          <div class="mt-0.5 text-2xl font-bold tabular-nums text-primary">${escapeHtml(fmtIDR(cycle.shouldPayAmount))}</div>
          <button class="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground" data-pda-sett-action="toggle-info">
            <i data-lucide="info" class="h-3 w-3"></i>
            ${cycleScopeLabel}预计到账 = 毛收入 ${escapeHtml(fmtIDR(cycleGross))} − 扣款 ${escapeHtml(fmtIDR(cycleDeduct))}
            <i data-lucide="${state.showInfo ? 'chevron-up' : 'chevron-down'}" class="h-3 w-3"></i>
          </button>
          ${
            state.showInfo
              ? `
                <div class="mt-1.5 rounded-md bg-background/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  <p>· ${cycleScopeLabel}毛收入 ${escapeHtml(fmtIDR(cycleGross))}，覆盖 ${cycle.taskCount} 个任务</p>
                  <p>· ${cycleScopeLabel}扣款 ${escapeHtml(fmtIDR(cycleDeduct))}，其中待计入 ${cycleDeductPending.length} 笔</p>
                </div>
              `
              : ''
          }
        </div>

        <div class="grid grid-cols-3 divide-x">
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-muted-foreground">${cycleScopeLabel}已到账</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-green-600">${escapeHtml(fmtIDR(cycle.paidAmount))}</div>
          </div>
          <button class="px-3 py-2.5 text-center" data-pda-sett-action="open-current-week-cycle">
            <div class="text-[10px] text-muted-foreground">${cycleScopeLabel}未到账</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-red-600">${escapeHtml(fmtIDR(cycle.unpaidAmount))}</div>
          </button>
          <button class="px-3 py-2.5 text-center" data-pda-sett-action="open-week-deductions">
            <div class="text-[10px] text-muted-foreground">${cycleScopeLabel}扣款</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-red-600">${escapeHtml(fmtIDR(cycleDeduct))}</div>
          </button>
        </div>

        <div class="px-4 pb-3 pt-2">
          <div class="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>付款进度</span>
            <span>${escapeHtml(`${fmtIDR(cycle.paidAmount)} / ${fmtIDR(cycle.shouldPayAmount)} · ${cyclePaidRate}%`)}</span>
          </div>
          ${renderProgress(cyclePaidRate, 'h-2')}
        </div>

        ${
          cycle.unpaidAmount > 0
            ? `
              <button
                class="flex w-full items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
                data-pda-sett-action="open-current-week-cycle"
              >
                <i data-lucide="alert-triangle" class="h-3.5 w-3.5 shrink-0"></i>
                ${cycleScopeLabel}仍有 ${escapeHtml(fmtIDR(cycle.unpaidAmount))} 未到账 · 去看周期
                <i data-lucide="chevron-right" class="ml-auto h-3.5 w-3.5"></i>
              </button>
            `
            : ''
        }
      </div>

      <section class="space-y-3">
        ${renderQualityQuickActionCards(qualityFactoryId)}
        <div class="grid gap-2.5 md:grid-cols-2">
          ${
            cycle.unpaidAmount > 0
              ? `
                <button
                  class="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-left"
                  data-pda-sett-action="open-current-week-cycle"
                >
                  <div class="text-xs font-medium text-orange-800">${cycleScopeLabel}未付风险</div>
                  <div class="mt-1 text-sm font-bold tabular-nums text-orange-800">${escapeHtml(fmtIDR(cycle.unpaidAmount))}</div>
                  <div class="mt-1 text-[10px] leading-5 text-orange-700">${escapeHtml(cycle.nextPaymentNote || '当前还有未付金额，去查看周期付款进度')}</div>
                </button>
              `
              : ''
          }
          ${
            cycleDeductPending.length > 0
              ? `
                <button
                  class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-left"
                  data-pda-sett-action="open-week-deductions"
                >
                  <div class="text-xs font-medium text-amber-800">待计入扣款</div>
                  <div class="mt-1 text-sm font-bold tabular-nums text-amber-800">${cycleDeductPending.length} 笔 / ${escapeHtml(
                    fmtIDR(cycleDeductPending.reduce((sum, item) => sum + item.amount, 0)),
                  )}</div>
                  <div class="mt-1 text-[10px] leading-5 text-amber-700">确认后会进入当前周期结算，去看扣款台账</div>
                </button>
              `
              : ''
          }
          ${renderPlatformQcWritebackSummaryCard()}
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-xs font-semibold text-muted-foreground">周期内快捷入口</h3>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            class="rounded-lg border bg-background px-3 py-3 text-left shadow-none transition-colors hover:bg-muted/40"
            data-pda-sett-action="open-quality-workbench"
            data-view="${qualityEntryView}"
          >
            <div class="text-[10px] text-muted-foreground">查看质检扣款</div>
            <div class="mt-0.5 text-sm font-bold">${qualitySummary.pendingCount + qualitySummary.disputingCount} 条待跟进</div>
            <div class="mt-0.5 text-[10px] text-muted-foreground">待处理 ${qualitySummary.pendingCount} · 异议中 ${qualitySummary.disputingCount}</div>
          </button>
          <button
            class="rounded-lg border bg-background px-3 py-3 text-left shadow-none transition-colors hover:bg-muted/40"
            data-pda-sett-action="open-week-tasks"
          >
            <div class="text-[10px] text-muted-foreground">查看任务收入</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums">${escapeHtml(fmtIDR(cycleGross))}</div>
            <div class="mt-0.5 text-[10px] text-muted-foreground">${cycle.taskCount} 个任务 · 完成 ${escapeHtml(fmtQty(cycle.completedQty))}</div>
          </button>
          <button
            class="rounded-lg border bg-background px-3 py-3 text-left shadow-none transition-colors hover:bg-muted/40"
            data-pda-sett-action="open-week-deductions"
          >
            <div class="text-[10px] text-muted-foreground">查看扣款台账</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-red-600">${escapeHtml(fmtIDR(cycleDeduct))}</div>
            <div class="mt-0.5 text-[10px] text-muted-foreground">${cycleDeductions.length} 笔扣款 · 已计入 ${cycleDeductIncluded.length} 笔</div>
          </button>
          <button
            class="rounded-lg border bg-background px-3 py-3 text-left shadow-none transition-colors hover:bg-muted/40"
            data-pda-sett-action="open-current-week-cycle"
          >
            <div class="text-[10px] text-muted-foreground">查看当前周期</div>
            <div class="mt-0.5 text-sm font-bold">${escapeHtml(CW.cycleId)}</div>
            <div class="mt-0.5 text-[10px] text-muted-foreground">已付 ${escapeHtml(fmtIDR(CW.paidAmount))} · 未付 ${escapeHtml(fmtIDR(CW.unpaidAmount))}</div>
          </button>
        </div>
      </section>

      ${renderSettlementProfileEntryCard()}
    </div>
  `
}

function renderTasksContent(visibleTasks: TaskIncome[], cycle: SettlementCycle | null = null): string {
  const cycleScoped = Boolean(cycle)
  const cycleTaskCount = cycle ? getCycleTasks(cycle).length : CW.taskCount
  const cycleShouldPayAmount = cycle ? cycle.shouldPayAmount : CW_SHOULD
  const cycleUnpaidAmount = cycle ? cycle.unpaidAmount : CW_UNPAID
  const taskItems = getTaskIncomeListItems(visibleTasks)

  return `
    <div class="space-y-3 p-4">
      <div class="flex items-center gap-2">
        ${
          cycleScoped
            ? `
              <div class="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                ${escapeHtml(`${cycle?.cycleId} · ${cycle?.periodStart} ~ ${cycle?.periodEnd}`)}
              </div>
            `
            : `
              <div class="shrink-0 overflow-hidden rounded-lg border bg-background">
                <button class="px-3 py-1.5 text-xs font-medium ${state.taskView === 'week' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-task-view" data-value="week">本周</button>
                <button class="px-3 py-1.5 text-xs font-medium ${state.taskView === 'all' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-task-view" data-value="all">全部</button>
              </div>
            `
        }
        <div class="relative flex-1">
          <i data-lucide="search" class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs"
            placeholder="搜索任务/款式/工序"
            value="${escapeHtml(state.taskSearch)}"
            data-pda-sett-field="task-search"
          />
        </div>
      </div>

      ${
        cycleScoped || state.taskView === 'week'
          ? `
            <div class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span>${cycleScoped ? '本周期' : '本周'} ${cycleTaskCount} 个任务</span>
              <span>·</span>
              <span>净额 ${escapeHtml(fmtIDR(cycleShouldPayAmount))}</span>
              <span>·</span>
              <span class="${cycleUnpaidAmount > 0 ? 'font-medium text-red-600' : 'text-green-600'}">${escapeHtml(
                cycleUnpaidAmount > 0 ? `未付 ${fmtIDR(cycleUnpaidAmount)}` : '已付清',
              )}</span>
            </div>
          `
          : ''
      }

      ${
        taskItems.length === 0
          ? '<div class="py-10 text-center text-xs text-muted-foreground">暂无符合条件的任务</div>'
          : taskItems
              .map(
                ({ task, hasLinkedQualityCases, hasAdjustment }) => `
                  <button class="w-full text-left" data-pda-sett-action="open-task-drawer" data-task-id="${escapeHtml(task.taskId)}">
                    <article class="rounded-lg border bg-card shadow-none transition-colors hover:bg-muted/30">
                      <div class="px-4 py-3">
                        <div class="mb-1.5 flex items-center justify-between">
                          <div class="flex min-w-0 items-center gap-2">
                            <span class="truncate text-xs font-semibold">${escapeHtml(task.taskId)}</span>
                            ${task.isCurrentWeek ? renderStatusBadge('本周', 'blue') : ''}
                            ${hasLinkedQualityCases ? renderStatusBadge('有关联质检', 'amber') : ''}
                            ${hasAdjustment ? renderStatusBadge('含下周期调整', 'blue') : ''}
                          </div>
                          <div class="flex shrink-0 items-center gap-1.5">
                            ${renderStatusBadge(task.paymentStatus, paymentVariant(task.paymentStatus))}
                            <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                          </div>
                        </div>
                        <div class="mb-2 text-[10px] text-muted-foreground">${escapeHtml(`${task.spuName} · ${task.process} · ${task.cycleId}`)}</div>
                        <div class="grid grid-cols-3 gap-x-2 text-xs">
                          <div>
                            <div class="text-[10px] text-muted-foreground">应结金额</div>
                            <div class="font-semibold tabular-nums">${escapeHtml(fmtIDR(task.shouldPayAmount))}</div>
                          </div>
                          <div>
                            <div class="text-[10px] text-muted-foreground">扣款</div>
                            <div class="font-semibold tabular-nums ${task.deductionAmount > 0 ? 'text-red-600' : 'text-muted-foreground'}">${escapeHtml(
                              task.deductionAmount > 0 ? fmtIDR(task.deductionAmount) : '—',
                            )}</div>
                          </div>
                          <div>
                            <div class="text-[10px] text-muted-foreground">未付</div>
                            <div class="font-semibold tabular-nums ${task.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'}">${escapeHtml(
                              task.unpaidAmount > 0 ? fmtIDR(task.unpaidAmount) : '已付清',
                            )}</div>
                          </div>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                          <span>完成 ${escapeHtml(fmtQty(task.completedQty, task.qtyUnit))}</span>
                          <span>单价 ${escapeHtml(fmtRate(task.unitPrice, task.qtyUnit))}</span>
                          ${task.lastPaymentDate ? `<span>最近付款 ${escapeHtml(task.lastPaymentDate)}</span>` : ''}
                        </div>
                      </div>
                    </article>
                  </button>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderDeductionsContent(
  visibleLedgerItems: SettlementLedgerItemViewModel[],
  cycle: SettlementCycle | null = null,
): string {
  const cycleScoped = Boolean(cycle)
  const ledgerOverview = getSettlementLedgerOverview(visibleLedgerItems)
  return `
    <div class="space-y-3 p-4">
      <div class="rounded-lg border bg-background px-4 py-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-xs font-medium text-foreground">扣款台账</div>
            <div class="mt-0.5 text-[10px] leading-5 text-muted-foreground">
              当前结算展示币种：${escapeHtml(ledgerOverview.settlementCurrency)}。原始为 CNY 的质量扣款已按汇率折算展示，可在台账项详情查看原币种、汇率与换算时点。
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div class="rounded-md border bg-muted/40 px-3 py-2">
              <div class="text-[10px] text-muted-foreground">台账项数量</div>
              <div class="mt-1 font-semibold">${ledgerOverview.itemCount} 条</div>
            </div>
            <div class="rounded-md border bg-muted/40 px-3 py-2">
              <div class="text-[10px] text-muted-foreground">扣款总额</div>
              <div class="mt-1 font-semibold text-red-600">${escapeHtml(formatCurrencyByCode(ledgerOverview.totalAmount, ledgerOverview.settlementCurrency))}</div>
            </div>
            <div class="rounded-md border bg-muted/40 px-3 py-2">
              <div class="text-[10px] text-muted-foreground">当前冻结影响</div>
              <div class="mt-1 font-semibold text-orange-600">${escapeHtml(formatCurrencyByCode(ledgerOverview.blockedAmount, ledgerOverview.settlementCurrency))}</div>
            </div>
            <div class="rounded-md border bg-muted/40 px-3 py-2">
              <div class="text-[10px] text-muted-foreground">待下周期调整</div>
              <div class="mt-1 font-semibold text-amber-700">${escapeHtml(formatCurrencyByCode(ledgerOverview.adjustmentAmount, ledgerOverview.settlementCurrency))}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-2 rounded-lg border bg-background px-3 py-3">
        <div class="flex flex-wrap items-center gap-2">
        ${
          cycleScoped
            ? `
              <div class="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                ${escapeHtml(`${cycle?.cycleId} · ${cycle?.periodStart} ~ ${cycle?.periodEnd}`)}
              </div>
            `
            : `
              <div class="shrink-0 overflow-hidden rounded-lg border bg-background">
                <button class="px-3 py-1.5 text-xs font-medium ${state.dedView === 'week' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-ded-view" data-value="week">本周</button>
                <button class="px-3 py-1.5 text-xs font-medium ${state.dedView === 'all' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-ded-view" data-value="all">全部</button>
              </div>
            `
        }
          <div class="shrink-0 overflow-hidden rounded-lg border bg-background">
            ${([
              ['all', '全部'],
              ['quality', '质量扣款'],
              ['other', '其它扣款'],
            ] as Array<[LedgerSourceView, string]>)
              .map(
                ([value, label]) => `
                  <button class="px-3 py-1.5 text-xs font-medium ${
                    state.dedSourceView === value ? 'bg-primary text-white' : 'text-muted-foreground'
                  }" data-pda-sett-action="set-ledger-source-view" data-value="${value}">${label}</button>
                `,
              )
              .join('')}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="shrink-0 overflow-hidden rounded-lg border bg-background">
            ${([
              ['all', '全部'],
              ['blocked', '冻结中'],
              ['effective', '已生效'],
              ['adjustment', '待下周期调整'],
              ['reversed', '已冲回'],
            ] as Array<[LedgerFinancialView, string]>)
              .map(
                ([value, label]) => `
                  <button class="px-3 py-1.5 text-xs font-medium ${
                    state.dedFinanceView === value ? 'bg-primary text-white' : 'text-muted-foreground'
                  }" data-pda-sett-action="set-ledger-finance-view" data-value="${value}">${label}</button>
                `,
              )
              .join('')}
          </div>
        <div class="relative flex-1">
          <i data-lucide="search" class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs"
            placeholder="搜索台账单/任务/质检/扣款原因"
            value="${escapeHtml(state.dedSearch)}"
            data-pda-sett-field="ded-search"
          />
        </div>
      </div>
      </div>

      ${
        visibleLedgerItems.length === 0
          ? '<div class="rounded-lg border border-dashed bg-background px-4 py-10 text-center text-xs text-muted-foreground">当前筛选下暂无扣款台账项</div>'
          : visibleLedgerItems
              .map(
                (item) => `
                  <button class="w-full text-left" data-pda-sett-action="open-ded-drawer" data-ded-id="${escapeHtml(item.ledgerId)}">
                    <article class="rounded-lg border bg-card shadow-none transition-colors hover:bg-muted/30">
                      <div class="px-4 py-3">
                        <div class="mb-1.5 flex items-start justify-between">
                          <div class="flex min-w-0 items-center gap-2">
                            <span class="text-xs font-semibold">${escapeHtml(item.ledgerNo)}</span>
                            ${renderStatusBadge(item.sourceTypeLabel, item.sourceType === 'QUALITY' ? 'blue' : 'gray')}
                            ${item.isCurrentWeek ? renderStatusBadge('本期关注', 'blue') : ''}
                          </div>
                          <div class="flex shrink-0 items-center gap-1.5">
                            ${renderStatusBadge(item.financialStatusLabel, item.financialStatusVariant)}
                            <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                          </div>
                        </div>
                        <div class="mb-1.5 flex items-center gap-3">
                          <div>
                            <div class="text-[10px] text-muted-foreground">结算主币种金额</div>
                            <div class="text-sm font-bold tabular-nums text-red-600">${escapeHtml(item.currencyDisplay.settlementAmountLabel)}</div>
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="text-[10px] text-muted-foreground">来源与原因</div>
                            <div class="text-xs font-medium">${escapeHtml(item.reason)}</div>
                            <div class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(item.sourceSummary)}</div>
                          </div>
                        </div>
                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          ${item.taskId ? `<span>关联任务：${escapeHtml(item.taskId)}</span>` : ''}
                          <span>${escapeHtml(`${item.productionOrderId} · ${item.processLabel}`)}</span>
                          ${item.qcNo ? `<span>关联质检：${escapeHtml(item.qcNo)}</span>` : ''}
                          ${item.basisId ? `<span>扣款依据：${escapeHtml(item.basisId)}</span>` : ''}
                        </div>
                        <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          ${
                            item.blockedProcessingFeeAmount > 0
                              ? `<span>${escapeHtml(item.sourceType === 'QUALITY' ? '冻结加工费' : '冻结扣款')} ${escapeHtml(
                                  item.currencyDisplay.isConverted
                                    ? `${formatCurrencyByCode(Math.round(item.blockedProcessingFeeAmount * item.currencyDisplay.rate), item.currencyDisplay.settlementCurrency)}（原 ${fmtCny(item.blockedProcessingFeeAmount)}）`
                                    : formatCurrencyByCode(item.blockedProcessingFeeAmount, item.currencyDisplay.settlementCurrency),
                                )}</span>`
                              : ''
                          }
                          ${
                            item.effectiveQualityDeductionAmount > 0
                              ? `<span>${escapeHtml(item.sourceType === 'QUALITY' ? '已生效质量扣款' : '已生效扣款')} ${escapeHtml(
                                  item.currencyDisplay.isConverted
                                    ? `${formatCurrencyByCode(Math.round(item.effectiveQualityDeductionAmount * item.currencyDisplay.rate), item.currencyDisplay.settlementCurrency)}（原 ${fmtCny(item.effectiveQualityDeductionAmount)}）`
                                    : formatCurrencyByCode(item.effectiveQualityDeductionAmount, item.currencyDisplay.settlementCurrency),
                                )}</span>`
                              : ''
                          }
                          ${
                            item.adjustmentAmount > 0
                              ? `<span>${escapeHtml(item.adjustmentTypeLabel || '下周期调整')} ${escapeHtml(
                                  item.currencyDisplay.isConverted
                                    ? `${formatCurrencyByCode(Math.round(item.adjustmentAmount * item.currencyDisplay.rate), item.currencyDisplay.settlementCurrency)}（原 ${fmtCny(item.adjustmentAmount)}）`
                                    : formatCurrencyByCode(item.adjustmentAmount, item.currencyDisplay.settlementCurrency),
                                )}</span>`
                              : ''
                          }
                        </div>
                        <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          ${
                            item.currencyDisplay.isConverted
                              ? `<span>原始金额 ${escapeHtml(item.currencyDisplay.originalAmountLabel)}</span><span>汇率 ${escapeHtml(item.currencyDisplay.rateLabel)}</span>`
                              : `<span>结算币种 ${escapeHtml(item.currencyDisplay.settlementCurrency)}</span>`
                          }
                          ${item.keyTime ? `<span>${escapeHtml(item.keyTimeLabel)}：${escapeHtml(formatDateTime(item.keyTime))}</span>` : ''}
                        </div>
                      </div>
                    </article>
                  </button>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderCyclesContent(visibleCycles: SettlementCycle[]): string {
  return `
    <div class="space-y-3 p-4">
      ${visibleCycles
        .map((cycle) => {
          const paidRate = cycle.shouldPayAmount > 0 ? Math.round((cycle.paidAmount / cycle.shouldPayAmount) * 100) : 100
          return `
            <button class="w-full text-left" data-pda-sett-action="open-cycle-detail" data-cycle-id="${escapeHtml(cycle.cycleId)}">
              <article class="rounded-lg border bg-card shadow-none transition-colors hover:bg-muted/30 ${cycle.isCurrentWeek ? 'border-2 border-primary' : ''}">
                <div class="px-4 py-3">
                  <div class="mb-2 flex items-center justify-between">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="truncate text-xs font-semibold">${escapeHtml(cycle.cycleId)}</span>
                      ${cycle.isCurrentWeek ? renderStatusBadge('本周期', 'blue') : ''}
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      ${renderStatusBadge(cycle.status, cycleVariant(cycle.status))}
                      <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                    </div>
                  </div>

                  <div class="mb-2 grid grid-cols-3 gap-x-2 text-xs">
                    <div>
                      <div class="text-[10px] text-muted-foreground">应结</div>
                      <div class="font-semibold tabular-nums">${escapeHtml(fmtIDR(cycle.shouldPayAmount))}</div>
                    </div>
                    <div>
                      <div class="text-[10px] text-muted-foreground">已付</div>
                      <div class="font-semibold tabular-nums ${cycle.paidAmount > 0 ? 'text-green-600' : 'text-muted-foreground'}">${escapeHtml(
                        cycle.paidAmount > 0 ? fmtIDR(cycle.paidAmount) : '—',
                      )}</div>
                    </div>
                    <div>
                      <div class="text-[10px] text-muted-foreground">未付</div>
                      <div class="font-semibold tabular-nums ${cycle.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'}">${escapeHtml(
                        cycle.unpaidAmount > 0 ? fmtIDR(cycle.unpaidAmount) : '已付清',
                      )}</div>
                    </div>
                  </div>

                  ${renderProgress(paidRate, 'h-1.5')}

                  <div class="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                    <span>${escapeHtml(`${cycle.periodStart} ~ ${cycle.periodEnd}`)}</span>
                    <span>${cycle.taskCount} 个任务</span>
                    ${cycle.lastPaymentDate ? `<span>最近付款 ${escapeHtml(cycle.lastPaymentDate)}</span>` : ''}
                    <span>${paidRate}% 已付</span>
                  </div>

                  ${
                    cycle.unpaidAmount > 0 && cycle.isCurrentWeek
                      ? `<div class="mt-1.5 text-[10px] font-medium text-red-600">还差 ${escapeHtml(fmtIDR(cycle.unpaidAmount))} 未付</div>`
                      : ''
                  }
                </div>
              </article>
            </button>
          `
        })
        .join('')}
    </div>
  `
}

function renderPageContent(): string {
  syncSettlementStateFromRoute()

  const selectedCycle = getSelectedSettlementCycle()

  const taskSource = state.pageMode === 'cycle-detail' ? getCycleTasks(selectedCycle) : TASK_INCOMES
  const visibleTasks = taskSource
    .filter((t) => (state.pageMode === 'cycle-detail' ? true : state.taskView === 'week' ? t.isCurrentWeek : true))
    .filter(
      (t) =>
        !state.taskSearch ||
        t.taskId.includes(state.taskSearch) ||
        t.spuName.includes(state.taskSearch) ||
        t.process.includes(state.taskSearch),
    )
    .slice()
    .sort((a, b) => {
      const rank = (t: TaskIncome) => (t.paymentStatus === '待付款' ? 0 : t.paymentStatus === '部分付款' ? 1 : 2)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      if (a.deductionAmount !== b.deductionAmount) return b.deductionAmount - a.deductionAmount
      return b.shouldPayAmount - a.shouldPayAmount
    })

  const visibleLedgerItems = getSettlementLedgerItems({
    cycle: state.pageMode === 'cycle-detail' ? selectedCycle : null,
    timeView: state.dedView,
    sourceView: state.dedSourceView,
    financeView: state.dedFinanceView,
    keyword: state.dedSearch,
  })

  const visibleCycles = SETTLEMENT_CYCLES.slice().sort((a, b) => {
    if (a.isCurrentWeek) return -1
    if (b.isCurrentWeek) return 1
    return 0
  })

  const qualityFactoryId = getCurrentQualityFactoryId()
  const settlementMaterialEntry = renderSettlementMaterialEntry()

  return `
    <div class="flex min-h-[760px] flex-col bg-muted/30">
      <div class="shrink-0 border-b bg-background px-4 pb-2 pt-4">
        ${
          state.pageMode === 'cycles'
            ? `
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h1 class="text-base font-bold">结算周期</h1>
                  <p class="mt-0.5 text-xs text-muted-foreground">先选择一个结算周期，再进入周期内查看总览、质检扣款、任务收入和扣款台账。</p>
                </div>
                <div class="shrink-0">${settlementMaterialEntry}</div>
              </div>
            `
            : `
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <button class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-pda-sett-action="back-to-cycles">
                    <i data-lucide="chevron-left" class="h-3.5 w-3.5"></i>
                    返回结算周期
                  </button>
                  <h1 class="mt-2 text-base font-bold">${escapeHtml(`结算周期 ${selectedCycle.cycleId}`)}</h1>
                  <p class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(`${selectedCycle.periodStart} ~ ${selectedCycle.periodEnd} · ${selectedCycle.taskCount} 个任务 · 状态 ${selectedCycle.status}`)}</p>
                </div>
                <div class="shrink-0">${settlementMaterialEntry}</div>
              </div>
            `
        }
      </div>

      ${
        state.pageMode === 'cycle-detail'
          ? `
            <div class="shrink-0 border-b bg-background">
              ${([
                ['overview', '总览'],
                ['quality', '质检扣款'],
                ['tasks', '任务收入'],
                ['deductions', '扣款台账'],
              ] as Array<[DetailTab, string]>)
                .map(
                  ([key, label]) => `
                    <button
                      class="w-1/4 border-b-2 py-2.5 text-xs font-medium transition-colors ${
                        state.detailTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                      }"
                      data-pda-sett-action="switch-detail-tab"
                      data-tab="${key}"
                    >${escapeHtml(label)}</button>
                  `,
                )
                .join('')}
            </div>
          `
          : ''
      }

      <div class="min-h-0 flex-1 overflow-y-auto">
        ${
          state.pageMode === 'cycles'
            ? renderCyclesContent(visibleCycles)
            : state.detailTab === 'overview'
              ? renderOverviewContent(selectedCycle, qualityFactoryId)
              : state.detailTab === 'quality'
                ? renderSettlementQualityContent(qualityFactoryId)
                : state.detailTab === 'tasks'
                  ? renderTasksContent(visibleTasks, selectedCycle)
                  : renderDeductionsContent(visibleLedgerItems, selectedCycle)
        }
      </div>

      ${(() => {
        const task = getTaskById(state.taskDrawerTaskId)
        if (!task) return ''
        return renderTaskDrawer(task)
      })()}

      ${(() => {
        const ded = getSettlementLedgerDetailViewModel(state.dedDrawerId)
        if (!ded) return ''
        return renderDeductionDrawer(ded)
      })()}

      ${(() => {
        const cycle = getCycleById(state.cycleDrawerId)
        if (!cycle) return ''
        return renderCycleDrawer(cycle)
      })()}

      ${renderSettlementRequestDrawer()}
    </div>
  `
}

function validateSettlementRequestForm(): Partial<
  Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>
> {
  const errors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>> = {}
  if (!state.settlementRequestForm.accountHolderName.trim()) errors.accountHolderName = '请填写开户名'
  if (!state.settlementRequestForm.idNumber.trim()) errors.idNumber = '请填写证件号'
  if (!state.settlementRequestForm.bankName.trim()) errors.bankName = '请填写银行名称'
  if (!state.settlementRequestForm.bankAccountNo.trim()) {
    errors.bankAccountNo = '请填写银行账号'
  } else if (!/^[0-9]{8,30}$/.test(state.settlementRequestForm.bankAccountNo.trim())) {
    errors.bankAccountNo = '银行账号格式不正确'
  }
  return errors
}

export function renderPdaSettlementPage(): string {
  return renderPdaFrame(renderPageContent(), 'settlement')
}

export function handlePdaSettlementEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-sett-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.pdaSettField
    if (field === 'task-search') {
      state.taskSearch = fieldNode.value
      return true
    }
    if (field === 'ded-search') {
      state.dedSearch = fieldNode.value
      return true
    }
    if (field === 'quality-search') {
      state.qualitySearch = fieldNode.value
      return true
    }
    if (field === 'request.accountHolderName') {
      state.settlementRequestForm.accountHolderName = fieldNode.value
      state.settlementRequestErrors.accountHolderName = undefined
      return true
    }
    if (field === 'request.idNumber') {
      state.settlementRequestForm.idNumber = fieldNode.value
      state.settlementRequestErrors.idNumber = undefined
      return true
    }
    if (field === 'request.bankName') {
      state.settlementRequestForm.bankName = fieldNode.value
      state.settlementRequestErrors.bankName = undefined
      return true
    }
    if (field === 'request.bankAccountNo') {
      state.settlementRequestForm.bankAccountNo = fieldNode.value
      state.settlementRequestErrors.bankAccountNo = undefined
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

  const actionNode = target.closest<HTMLElement>('[data-pda-sett-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaSettAction
  if (!action) return false

  if (action === 'back-to-cycles') {
    state.pageMode = 'cycles'
    state.selectedCycleId = null
    appStore.navigate(buildSettlementListHref())
    return true
  }

  if (action === 'switch-detail-tab') {
    const tab = actionNode.dataset.tab as DetailTab | undefined
    if (tab === 'overview' || tab === 'quality' || tab === 'tasks' || tab === 'deductions') {
      const cycleId = resolveSettlementCycleId(state.selectedCycleId)
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = cycleId
      state.detailTab = tab
      appStore.navigate(
        buildSettlementDetailHref(tab, cycleId, {
          qualityView: tab === 'quality' ? state.qualityView : undefined,
        }),
      )
    }
    return true
  }

  if (action === 'set-quality-view') {
    const view = actionNode.dataset.view as QualityView | undefined
    if (view === 'pending' || view === 'soon' || view === 'disputing' || view === 'processed' || view === 'history') {
      const cycleId = resolveSettlementCycleId(state.selectedCycleId)
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = cycleId
      state.detailTab = 'quality'
      state.qualityView = view
      appStore.navigate(buildSettlementDetailHref('quality', cycleId, { qualityView: view }))
    }
    return true
  }

  if (action === 'open-quality-workbench') {
    const view = actionNode.dataset.view as QualityView | undefined
    const cycleId = resolveSettlementCycleId(state.selectedCycleId)
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'quality'
    if (view === 'pending' || view === 'soon' || view === 'disputing' || view === 'processed' || view === 'history') {
      state.qualityView = view
    }
    state.taskDrawerTaskId = null
    state.dedDrawerId = null
    state.cycleDrawerId = null
    appStore.navigate(buildSettlementDetailHref('quality', cycleId, { qualityView: state.qualityView }))
    return true
  }

  if (action === 'set-task-view') {
    const value = actionNode.dataset.value
    state.taskView = value === 'all' ? 'all' : 'week'
    return true
  }

  if (action === 'set-ded-view') {
    const value = actionNode.dataset.value
    state.dedView = value === 'all' ? 'all' : 'week'
    return true
  }

  if (action === 'set-ledger-source-view') {
    const value = actionNode.dataset.value
    state.dedSourceView = value === 'quality' || value === 'other' ? value : 'all'
    return true
  }

  if (action === 'set-ledger-finance-view') {
    const value = actionNode.dataset.value
    state.dedFinanceView =
      value === 'blocked' || value === 'effective' || value === 'adjustment' || value === 'reversed' ? value : 'all'
    return true
  }

  if (action === 'toggle-info') {
    state.showInfo = !state.showInfo
    return true
  }

  if (action === 'toggle-history') {
    state.showHistory = !state.showHistory
    return true
  }

  if (action === 'open-week-tasks') {
    const cycleId = resolveSettlementCycleId(state.selectedCycleId)
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'tasks'
    state.taskView = 'week'
    appStore.navigate(buildSettlementDetailHref('tasks', cycleId))
    return true
  }

  if (action === 'open-week-deductions') {
    const cycleId = resolveSettlementCycleId(state.selectedCycleId)
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'deductions'
    state.dedView = 'week'
    state.dedSourceView = 'all'
    state.dedFinanceView = 'all'
    appStore.navigate(buildSettlementDetailHref('deductions', cycleId))
    return true
  }

  if (action === 'open-platform-quality-deductions') {
    const cycleId = resolveSettlementCycleId(state.selectedCycleId)
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = cycleId
    state.detailTab = 'quality'
    state.taskDrawerTaskId = null
    state.dedDrawerId = null
    state.cycleDrawerId = null
    appStore.navigate(buildSettlementDetailHref('quality', cycleId, { qualityView: state.qualityView }))
    return true
  }

  if (action === 'open-current-week-cycle') {
    state.pageMode = 'cycle-detail'
    state.selectedCycleId = CW.cycleId
    state.detailTab = 'overview'
    state.taskDrawerTaskId = null
    state.dedDrawerId = null
    state.cycleDrawerId = null
    appStore.navigate(buildSettlementDetailHref('overview', CW.cycleId))
    return true
  }

  if (action === 'open-task-drawer') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      state.taskDrawerTaskId = taskId
      state.dedDrawerId = null
      state.cycleDrawerId = null
    }
    return true
  }

  if (action === 'open-ded-drawer') {
    const dedId = actionNode.dataset.dedId
    if (dedId) {
      state.dedDrawerId = dedId
      state.taskDrawerTaskId = null
      state.cycleDrawerId = null
    }
    return true
  }

  if (action === 'open-cycle-detail' || action === 'open-cycle-drawer' || action === 'open-cycle-by-id') {
    const cycleId = actionNode.dataset.cycleId
    if (cycleId) {
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = resolveSettlementCycleId(cycleId)
      state.detailTab = 'overview'
      state.taskDrawerTaskId = null
      state.dedDrawerId = null
      state.cycleDrawerId = null
      appStore.navigate(buildSettlementDetailHref('overview', resolveSettlementCycleId(cycleId)))
    }
    return true
  }

  if (action === 'close-task-drawer') {
    state.taskDrawerTaskId = null
    return true
  }

  if (action === 'close-ded-drawer') {
    state.dedDrawerId = null
    return true
  }

  if (action === 'close-cycle-drawer') {
    state.cycleDrawerId = null
    return true
  }

  if (action === 'goto-cycle-from-task') {
    const cycleId = actionNode.dataset.cycleId
    if (cycleId) {
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = resolveSettlementCycleId(cycleId)
      state.detailTab = 'overview'
      state.taskDrawerTaskId = null
      state.dedDrawerId = null
      state.cycleDrawerId = null
      appStore.navigate(buildSettlementDetailHref('overview', resolveSettlementCycleId(cycleId)))
    }
    return true
  }

  if (action === 'goto-deductions-from-task') {
    const taskId = actionNode.dataset.taskId
    const cycleId = actionNode.dataset.cycleId
    if (taskId && cycleId) {
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = resolveSettlementCycleId(cycleId)
      state.detailTab = 'deductions'
      state.dedSourceView = 'all'
      state.dedFinanceView = 'all'
      state.dedSearch = taskId
      state.taskDrawerTaskId = null
      state.dedDrawerId = null
      state.cycleDrawerId = null
      appStore.navigate(buildSettlementDetailHref('deductions', resolveSettlementCycleId(cycleId)))
    }
    return true
  }

  if (action === 'goto-quality-from-task') {
    const taskId = actionNode.dataset.taskId
    const cycleId = actionNode.dataset.cycleId
    if (taskId && cycleId) {
      const detail = getTaskIncomeDetailViewModel(taskId)
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = resolveSettlementCycleId(cycleId)
      state.detailTab = 'quality'
      state.qualityView = detail ? getTaskQualityEntryView(detail) : 'processed'
      state.taskDrawerTaskId = null
      state.dedDrawerId = null
      state.cycleDrawerId = null
      appStore.navigate(buildSettlementDetailHref('quality', resolveSettlementCycleId(cycleId), { qualityView: state.qualityView }))
    }
    return true
  }

  if (action === 'goto-task-from-ded' || action === 'goto-task-from-cycle') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      const cycleId = resolveSettlementCycleId(state.selectedCycleId)
      state.pageMode = 'cycle-detail'
      state.selectedCycleId = cycleId
      state.detailTab = 'tasks'
      state.cycleDrawerId = null
      state.dedDrawerId = null
      state.taskDrawerTaskId = taskId
      appStore.navigate(buildSettlementDetailHref('tasks', cycleId))
    }
    return true
  }

  if (action === 'open-settlement-change-request') {
    const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
    if (!effective) {
      state.settlementRequestDrawerMode = null
      state.settlementRequestDetailId = null
      state.settlementRequestErrorText = '当前工厂尚未初始化结算资料'
      return true
    }

    const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
    if (activeRequest) {
      state.settlementRequestDrawerMode = 'detail'
      state.settlementRequestDetailId = activeRequest.requestId
      state.settlementRequestErrorText = '当前已有结算资料修改申请处理中'
      return true
    }

    resetSettlementRequestForm()
    state.settlementRequestDrawerMode = 'create'
    state.settlementRequestDetailId = null
    return true
  }

  if (action === 'open-settlement-profile') {
    const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
    if (!effective) {
      state.settlementRequestDrawerMode = null
      state.settlementRequestDetailId = null
      state.settlementRequestErrorText = '当前工厂尚未初始化结算资料'
      return true
    }
    state.settlementRequestDrawerMode = 'profile'
    state.settlementRequestDetailId = null
    state.settlementRequestErrorText = ''
    return true
  }

  if (action === 'open-settlement-request-detail') {
    const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
    if (!effective) {
      state.settlementRequestDrawerMode = null
      state.settlementRequestDetailId = null
      state.settlementRequestErrorText = '当前工厂尚未初始化结算资料'
      return true
    }
    const requestId =
      actionNode.dataset.requestId ||
      getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)?.requestId ||
      getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)?.requestId ||
      null
    if (!requestId) {
      state.settlementRequestDrawerMode = 'detail'
      state.settlementRequestDetailId = null
      state.settlementRequestErrorText = '当前暂无申请记录'
      return true
    }
    state.settlementRequestDrawerMode = 'detail'
    state.settlementRequestDetailId = requestId
    state.settlementRequestErrorText = ''
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
    const errors = validateSettlementRequestForm()
    if (Object.keys(errors).length > 0) {
      state.settlementRequestErrors = errors
      state.settlementRequestErrorText = '请先补全必填项'
      return true
    }

    const result = createSettlementChangeRequest({
      factoryId: CURRENT_FACTORY_ID,
      submittedBy: CURRENT_FACTORY_OPERATOR,
      submitRemark: state.settlementRequestForm.submitRemark,
      after: {
        accountHolderName: state.settlementRequestForm.accountHolderName.trim(),
        idNumber: state.settlementRequestForm.idNumber.trim(),
        bankName: state.settlementRequestForm.bankName.trim(),
        bankAccountNo: state.settlementRequestForm.bankAccountNo.trim(),
        bankBranch: state.settlementRequestForm.bankBranch.trim(),
      },
    })

    if (!result.ok) {
      state.settlementRequestErrorText = result.message
      return true
    }

    state.settlementRequestErrors = {}
    state.settlementRequestErrorText = result.message
    state.settlementRequestDrawerMode = 'detail'
    state.settlementRequestDetailId = result.data.requestId
    return true
  }

  return false
}
