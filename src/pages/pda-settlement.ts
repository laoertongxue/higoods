import { appStore } from '../state/store'
import { renderPdaFrame } from './pda-shell'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
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
  getProxyConfirmationMethodLabel,
  getProxyNotificationStatusLabel,
  getStatementDraftById,
  getStatementConfirmationSourceLabel,
  isStatementProxyConfirmed,
  listSettlementBatchesByStatement,
  listSettlementStatementsByParty,
  submitStatementFactoryAppeal,
  submitStatementFactoryConfirmation,
} from '../data/fcs/store-domain-settlement-seeds'
import { listPreSettlementLedgers } from '../data/fcs/pre-settlement-ledger-repository'
import { cycleTypeConfig, pricingModeConfig } from '../data/fcs/settlement-types'
import {
  getCurrentPdaUser,
  listFactoryPdaRoles,
  type PermissionKey,
} from '../data/fcs/store-domain-pda'
import { escapeHtml, formatDateTime, toClassName } from '../utils'
import {
  ensurePdaSessionForAction,
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'
import { getQcFactDetail, listQcFactRows, type QcFactRow } from './qc-records/fact-view'
import type {
  FactoryFeedbackStatus,
  PreSettlementLedger,
  SettlementBatch,
  StatementAppealRecord,
  StatementDraft,
  StatementDraftItem,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'

applyQualitySeedBootstrap()

type SettlementPageMode = 'home' | 'statement-list' | 'quality-list'
type StatementFilterView = 'all' | 'pending-confirm' | 'disputing' | 'unpaid' | 'paid'
type QualityRecordFilterView = 'all' | 'not-in-statement' | 'in-statement' | 'rework' | 'deducted'

interface StatementAppealForm {
  reason: string
  description: string
  evidenceSummary: string
}

interface PdaSettlementState {
  lastRouteSyncKey: string
  pageMode: SettlementPageMode
  statementFilterView: StatementFilterView
  qualityRecordFilterView: QualityRecordFilterView
  qualitySearch: string
  qualityDrawerId: string | null
  settlementRequestDrawerMode: 'create' | 'detail' | 'profile' | 'history' | 'versions' | null
  settlementRequestDetailId: string | null
  settlementRequestErrors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>>
  settlementRequestErrorText: string
  settlementRequestForm: SettlementEffectiveInfoSnapshot & { submitRemark: string }
  statementDrawerMode: 'detail' | 'appeal' | null
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

const state: PdaSettlementState = {
  lastRouteSyncKey: '',
  pageMode: 'home',
  statementFilterView: 'all',
  qualityRecordFilterView: 'all',
  qualitySearch: '',
  qualityDrawerId: null,
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

function hasPdaSettlementPermission(permissionKey: PermissionKey): boolean {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return false
  const currentUser = getCurrentPdaUser()
  const roleId = currentUser?.roleId || runtime.roleId
  const role = listFactoryPdaRoles(runtime.factoryId).find(
    (item) => item.roleId === roleId && item.status === 'ACTIVE',
  )
  return Boolean(role?.permissionKeys.includes(permissionKey))
}

function renderSettlementNoPermission(): string {
  return `
    <div class="space-y-3 p-4">
      <section class="rounded-lg border bg-card px-4 py-5">
        <h1 class="text-base font-semibold">结算</h1>
        <p class="mt-2 text-xs leading-5 text-muted-foreground">当前账号没有结算查看权限，请联系工厂管理员调整 PDA 角色权限。</p>
      </section>
    </div>
  `
}

function parseDateMs(value?: string): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized).getTime()
  return Number.isFinite(parsed) ? parsed : 0
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

interface SettlementCycleSummary {
  settlementCycleId: string
  settlementCycleLabel: string
  settlementCycleStartAt?: string
  settlementCycleEndAt?: string
  ledgers: PreSettlementLedger[]
  statements: StatementDraft[]
  taskEarningAmount: number
  qualityDeductionAmount: number
}

interface SettlementHomeViewModel {
  accumulatedIncome: number
  accumulatedDeduction: number
  paidAmount: number
  unpaidAmount: number
  unsettledReferenceAmount: number
  statements: Array<{ statement: StatementDraft; summary: SettlementCycleSummary }>
  qcRows: QcFactRow[]
}

function getSettlementCycleSummaries(context: FactoryContext): SettlementCycleSummary[] {
  const summaries = new Map<string, SettlementCycleSummary>()
  const ensureSummary = (cycle: {
    settlementCycleId?: string
    settlementCycleLabel?: string
    settlementCycleStartAt?: string
    settlementCycleEndAt?: string
  }): SettlementCycleSummary => {
    const key = cycle.settlementCycleId || cycle.settlementCycleLabel || '未分组'
    const existed = summaries.get(key)
    if (existed) return existed
    const summary: SettlementCycleSummary = {
      settlementCycleId: cycle.settlementCycleId || key,
      settlementCycleLabel: cycle.settlementCycleLabel || '未分组',
      settlementCycleStartAt: cycle.settlementCycleStartAt,
      settlementCycleEndAt: cycle.settlementCycleEndAt,
      ledgers: [],
      statements: [],
      taskEarningAmount: 0,
      qualityDeductionAmount: 0,
    }
    summaries.set(key, summary)
    return summary
  }

  for (const ledger of listPreSettlementLedgers({ factoryId: context.settlementPartyId })) {
    const summary = ensureSummary(ledger)
    summary.ledgers.push(ledger)
    if (ledger.direction === 'DEDUCTION' || ledger.ledgerType === 'QUALITY_DEDUCTION') {
      summary.qualityDeductionAmount += Math.abs(ledger.settlementAmount)
    } else {
      summary.taskEarningAmount += ledger.settlementAmount
    }
  }

  for (const statement of listSettlementStatementsByParty(context.settlementPartyId)) {
    ensureSummary(statement).statements.push(statement)
  }

  return [...summaries.values()].sort((left, right) =>
    (right.settlementCycleEndAt || '').localeCompare(left.settlementCycleEndAt || ''),
  )
}

function isStatementPaid(statement: StatementDraft): boolean {
  const batch = statement.prepaymentBatchId ? getPrepaymentBatchById(statement.prepaymentBatchId) : getBatchByStatement(statement.statementId)
  return Boolean(
    statement.prepaidAt ||
      statement.paymentWritebackId ||
      statement.status === 'PREPAID' ||
      isPaidOrPaidPendingBatchStatus(statement.prepaymentBatchStatus) ||
      batch?.prepaidAt ||
      batch?.paymentWritebackId ||
      isPaidOrPaidPendingBatchStatus(batch?.status),
  )
}

function isPaidOrPaidPendingBatchStatus(status?: SettlementBatch['status']): boolean {
  return status === 'PREPAID' || status === 'FEISHU_PAID_PENDING_WRITEBACK'
}

function isStatementPaidPendingWriteback(statement: StatementDraft, batch: SettlementBatch | null): boolean {
  return statement.prepaymentBatchStatus === 'FEISHU_PAID_PENDING_WRITEBACK' || batch?.status === 'FEISHU_PAID_PENDING_WRITEBACK'
}

function getStatementPaymentStatusLabel(
  statement: StatementDraft,
  batch: SettlementBatch | null,
): string {
  if (isStatementPaidPendingWriteback(statement, batch)) return '已付款待回写'
  if (isStatementPaid(statement)) return '已付款'
  return '未付款'
}

function getStatementNetAmount(statement: StatementDraft): number {
  return statement.netPayableAmount ?? statement.totalAmount ?? 0
}

function getStatementPaymentTime(statement: StatementDraft, batch: SettlementBatch | null): string | undefined {
  return statement.prepaidAt ?? batch?.paymentAt ?? batch?.prepaidAt
}

function normalizeFactoryName(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function addFactoryNameAlias(aliases: Set<string>, value: string | undefined): void {
  const normalized = normalizeFactoryName(value)
  if (normalized) aliases.add(normalized)
}

function getFactoryNameAliases(context: FactoryContext): Set<string> {
  const aliases = new Set<string>()
  ;[context.factoryName, context.factoryCode].forEach((value) => addFactoryNameAlias(aliases, value))
  const factory = indonesiaFactories.find((item) => item.id === context.factoryId || item.code === context.factoryCode)
  ;[factory?.name, factory?.code].forEach((value) => addFactoryNameAlias(aliases, value))

  const ledgers = listPreSettlementLedgers({ factoryId: context.settlementPartyId })
  const statements = listSettlementStatementsByParty(context.settlementPartyId)
  ledgers.forEach((ledger) => addFactoryNameAlias(aliases, ledger.factoryName))
  statements.forEach((statement) => {
    addFactoryNameAlias(aliases, statement.factoryName)
    addFactoryNameAlias(aliases, statement.settlementProfileSnapshot.sourceFactoryName)
  })
  return aliases
}

function getFactoryQcRows(context: FactoryContext): QcFactRow[] {
  const aliases = getFactoryNameAliases(context)
  return listQcFactRows({ includeLegacy: false }).filter((row) => aliases.has(normalizeFactoryName(row.sourceFactoryName)))
}

function buildSettlementHomeViewModel(context: FactoryContext): SettlementHomeViewModel {
  const summaries = getSettlementCycleSummaries(context)
  const statements = summaries.flatMap((summary) => summary.statements.map((statement) => ({ statement, summary })))
  const statementIds = new Set(statements.map(({ statement }) => statement.statementId))
  const allLedgers = summaries.flatMap((summary) => summary.ledgers)
  const openLedgers = allLedgers.filter((ledger) => !ledger.statementId || !statementIds.has(ledger.statementId))
  const qcRows = getFactoryQcRows(context)

  return {
    accumulatedIncome: statements.reduce((sum, item) => sum + (item.statement.totalEarningAmount ?? item.summary.taskEarningAmount), 0),
    accumulatedDeduction: statements.reduce((sum, item) => sum + (item.statement.totalDeductionAmount ?? item.summary.qualityDeductionAmount), 0),
    paidAmount: statements.filter((item) => isStatementPaid(item.statement)).reduce((sum, item) => sum + getStatementNetAmount(item.statement), 0),
    unpaidAmount: statements.filter((item) => !isStatementPaid(item.statement)).reduce((sum, item) => sum + getStatementNetAmount(item.statement), 0),
    unsettledReferenceAmount: openLedgers.reduce((sum, ledger) => sum + (ledger.direction === 'DEDUCTION' ? -ledger.settlementAmount : ledger.settlementAmount), 0),
    statements,
    qcRows,
  }
}

function formatAmount(amount: number, currency = 'IDR'): string {
  return `${amount.toLocaleString('zh-CN')} ${currency}`
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

function getStatementStatusLabel(status: StatementStatus): string {
  if (status === 'DRAFT') return '草稿中'
  if (status === 'PENDING_FACTORY_CONFIRM') return '待工厂确认'
  if (status === 'FACTORY_CONFIRMED') return '工厂已确认'
  if (status === 'READY_FOR_PREPAYMENT') return '待付款'
  if (status === 'IN_PREPAYMENT_BATCH') return '付款处理中'
  if (status === 'PREPAID') return '已付款'
  return '已关闭'
}

function getFactoryFeedbackLabel(status: FactoryFeedbackStatus): string {
  if (status === 'NOT_SENT') return '未下发'
  if (status === 'PENDING_FACTORY_CONFIRM') return '待工厂反馈'
  if (status === 'FACTORY_CONFIRMED') return '工厂已确认'
  if (status === 'FACTORY_APPEALED') return '工厂已申诉'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理完成'
}

function sortByDateDesc<T>(items: T[], selector: (item: T) => string | undefined): T[] {
  return items.slice().sort((left, right) => parseDateMs(selector(right)) - parseDateMs(selector(left)))
}

function buildSettlementHomeHref(): string {
  return '/fcs/pda/settlement'
}

function buildStatementListHref(view: StatementFilterView = 'all'): string {
  const params = new URLSearchParams()
  params.set('tab', 'statements')
  if (view !== 'all') params.set('view', view)
  return `/fcs/pda/settlement?${params.toString()}`
}

function buildQualityListHref(view: QualityRecordFilterView = 'all'): string {
  const params = new URLSearchParams()
  params.set('tab', 'quality')
  if (view !== 'all') params.set('view', view)
  return `/fcs/pda/settlement?${params.toString()}`
}

function syncSettlementStateFromRoute(): void {
  const rawSearch = typeof window === 'undefined' ? '' : window.location.search
  if (state.lastRouteSyncKey === rawSearch) return
  state.lastRouteSyncKey = rawSearch

  const params = new URLSearchParams(rawSearch)
  const tab = params.get('tab')
  const view = params.get('view')

  if (tab === 'statements') {
    state.pageMode = 'statement-list'
    state.statementFilterView = isStatementFilterView(view) ? view : 'all'
    return
  }

  if (tab === 'quality') {
    state.pageMode = 'quality-list'
    state.qualityRecordFilterView = isQualityRecordFilterView(view) ? view : 'all'
    return
  }

  state.pageMode = 'home'
  state.statementFilterView = 'all'
  state.qualityRecordFilterView = 'all'
}

function isStatementFilterView(value: string | null): value is StatementFilterView {
  return value === 'all' || value === 'pending-confirm' || value === 'disputing' || value === 'unpaid' || value === 'paid'
}

function isQualityRecordFilterView(value: string | null): value is QualityRecordFilterView {
  return value === 'all' || value === 'not-in-statement' || value === 'in-statement' || value === 'rework' || value === 'deducted'
}

function getStatementFilterLabel(view: StatementFilterView): string {
  if (view === 'pending-confirm') return '待确认对账单'
  if (view === 'disputing') return '异议中对账单'
  if (view === 'unpaid') return '未付款对账单'
  if (view === 'paid') return '已付款对账单'
  return '全部对账单'
}

function getQualityRecordFilterLabel(view: QualityRecordFilterView): string {
  if (view === 'not-in-statement') return '未进对账'
  if (view === 'in-statement') return '已进对账'
  if (view === 'rework') return '有返工'
  if (view === 'deducted') return '有扣款'
  return '全部质检记录'
}

function filterStatementRows(
  rows: Array<{ statement: StatementDraft; summary: SettlementCycleSummary }>,
  view: StatementFilterView,
): Array<{ statement: StatementDraft; summary: SettlementCycleSummary }> {
  if (view === 'pending-confirm') return rows.filter(({ statement }) => statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM')
  if (view === 'disputing') return rows.filter(({ statement }) => statement.factoryFeedbackStatus === 'FACTORY_APPEALED')
  if (view === 'paid') return rows.filter(({ statement }) => isStatementPaid(statement))
  if (view === 'unpaid') return rows.filter(({ statement }) => !isStatementPaid(statement))
  return rows
}

function filterQualityRows(rows: QcFactRow[], view: QualityRecordFilterView): QcFactRow[] {
  if (view === 'not-in-statement') return rows.filter((row) => row.settlementTrace.statusLabel !== '已进入对账')
  if (view === 'in-statement') return rows.filter((row) => row.settlementTrace.statusLabel === '已进入对账')
  if (view === 'rework') return rows.filter((row) => row.reworkQty > 0)
  if (view === 'deducted') return rows.filter((row) => row.reworkChargebackAmountText !== '—')
  return rows
}

function matchesQualityRecordKeyword(row: QcFactRow, keyword: string): boolean {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return [
    row.displayNo,
    row.productionOrderNo,
    row.skuSummary,
    row.sourceFactoryName,
    row.reworkReceivers,
    row.settlementTrace.statementNo,
  ].some((value) => String(value ?? '').toLowerCase().includes(text))
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

function renderSettlementProfileEntryCard(): string {
  const context = getCurrentFactoryContext()
  const effective = getCurrentEffectiveSettlementInfo(context.factoryCode)
  const activeRequest = getSettlementActiveRequestByFactory(context.factoryCode)

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
  const summaryRequest = activeRequest ?? latestRequest
  const canChangeSettlementProfile = hasPdaSettlementPermission('SETTLEMENT_CHANGE_REQUEST')

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
              <p class="text-xs">周期类型：${escapeHtml(cycleTypeConfig[effective.settlementConfigSnapshot.cycleType].label)}</p>
              <p class="text-xs">结算规则：${escapeHtml(effective.settlementConfigSnapshot.settlementDayRule)}</p>
              <p class="text-xs">计价方式：${escapeHtml(pricingModeConfig[effective.settlementConfigSnapshot.pricingMode].label)}</p>
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
          class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          data-pda-sett-action="${activeRequest ? 'open-settlement-request-detail' : 'open-settlement-change-request'}"
          ${activeRequest ? `data-request-id="${escapeHtml(activeRequest.requestId)}"` : ''}
          ${activeRequest || canChangeSettlementProfile ? '' : 'disabled'}
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
          提交后进入待处理，不会立即改写当前生效资料；已生成单据继续沿用原快照。
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
        <button class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="submit-settlement-change-request" ${canChangeSettlementProfile ? '' : 'disabled'}>
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

function renderFactoryVisibleStatementLogs(statement: StatementDraft): string {
  const logs = (statement.statementAuditLogs ?? []).filter((log) => log.visibleToFactory).slice().reverse()
  if (!logs.length) {
    return '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-[10px] text-muted-foreground">当前暂无三方工厂可见操作记录</div>'
  }

  return logs
    .map(
      (log) => `
        <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-foreground">${escapeHtml(log.action)}</span>
            <span class="text-muted-foreground">${escapeHtml(log.operatedAt)}</span>
          </div>
          <div class="text-muted-foreground">操作人：${escapeHtml(log.actor)}</div>
          ${
            log.toStatus
              ? `<div class="text-muted-foreground">对账单状态：${escapeHtml(log.fromStatus ? getStatementStatusLabel(log.fromStatus) : '-')} -> ${escapeHtml(getStatementStatusLabel(log.toStatus))}</div>`
              : ''
          }
          ${
            log.toFactoryFeedbackStatus
              ? `<div class="text-muted-foreground">工厂反馈：${escapeHtml(log.fromFactoryFeedbackStatus ? getFactoryFeedbackLabel(log.fromFactoryFeedbackStatus) : '-')} -> ${escapeHtml(getFactoryFeedbackLabel(log.toFactoryFeedbackStatus))}</div>`
              : ''
          }
          ${log.reason ? `<div class="text-muted-foreground">原因：${escapeHtml(log.reason)}</div>` : ''}
          ${log.method ? `<div class="text-muted-foreground">线下确认方式：${escapeHtml(getProxyConfirmationMethodLabel(log.method))}</div>` : ''}
          ${log.notificationStatus ? `<div class="text-muted-foreground">通知状态：${escapeHtml(getProxyNotificationStatusLabel(log.notificationStatus))}</div>` : ''}
          ${log.remark ? `<div class="text-muted-foreground">备注：${escapeHtml(log.remark)}</div>` : ''}
        </div>
      `,
    )
    .join('')
}

function renderProxyConfirmationNotice(statement: StatementDraft): string {
  if (!isStatementProxyConfirmed(statement)) return ''
  const appealed = statement.factoryFeedbackStatus === 'FACTORY_APPEALED'
  return `
    <div class="mt-2 rounded-md border ${appealed ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'} px-3 py-2 text-[10px] leading-5">
      该对账单已由跟单审核代确认，不是工厂本人 PDA 确认。
      跟单：${escapeHtml(statement.proxyConfirmedBy ?? '-')}；
      时间：${escapeHtml(statement.proxyConfirmedAt ? formatDateTime(statement.proxyConfirmedAt) : '-')}；
      方式：${escapeHtml(getProxyConfirmationMethodLabel(statement.proxyConfirmMethod))}；
      通知：${escapeHtml(getProxyNotificationStatusLabel(statement.proxyConfirmNotificationStatus))}。
      ${appealed ? '三方工厂已对代确认结果提出异议，平台处理前该单不会继续进入付款处理。' : ''}
    </div>
  `
}

function getBatchByStatement(statementId: string): SettlementBatch | null {
  return sortByDateDesc(listSettlementBatchesByStatement(statementId), (item) => item.paymentAt ?? item.prepaidAt ?? item.updatedAt ?? item.createdAt)[0] ?? null
}

function getStatementItemTypeLabel(item: StatementDraftItem): string {
  const reason = `${item.remark ?? ''}${item.sourceRefLabel ?? ''}${item.processLabel ?? ''}`
  if (item.deductionLineType === 'DELAY' || reason.includes('延误')) return '延误扣款'
  if (item.qcRecordId || item.deductionLineType || item.sourceItemType === 'QUALITY_DEDUCTION' || reason.includes('瑕疵')) {
    return item.deductionLineType === 'POST_FACTORY_REWORK_CHARGEBACK' || reason.includes('返工') ? '返工扣款' : '瑕疵扣款'
  }
  return '任务收入'
}

function getStatementItemAmount(item: StatementDraftItem): number {
  if (getStatementItemTypeLabel(item) === '任务收入') return item.earningAmount ?? item.deductionAmount ?? 0
  return Math.abs(item.qualityDeductionAmount ?? item.deductionAmount ?? 0)
}

function getStatementItemSkuText(item: StatementDraftItem): string {
  return item.sourceRefLabel ?? item.returnInboundBatchNo ?? item.taskNo ?? item.sourceItemId
}

function renderStatementSettlementItems(statement: StatementDraft): string {
  const groups: Array<ReturnType<typeof getStatementItemTypeLabel>> = ['任务收入', '返工扣款', '瑕疵扣款', '延误扣款']
  const currency = statement.settlementCurrency ?? 'IDR'
  const content = groups
    .map((group) => {
      const items = statement.items.filter((item) => getStatementItemTypeLabel(item) === group)
      if (!items.length) return ''
      return `
        <div class="space-y-2">
          <div class="text-xs font-semibold text-foreground">${escapeHtml(group)}</div>
          ${items
            .map((item) => {
              const amount = getStatementItemAmount(item)
              const amountText = `${group === '任务收入' ? '' : '-'}${formatAmount(amount, currency)}`
              return `
                <div class="rounded-md border bg-muted/20 px-3 py-2 text-[10px] leading-5">
                  ${renderRow('生产单', item.productionOrderNo ?? item.productionOrderId ?? '—')}
                  ${renderRow('SKU', getStatementItemSkuText(item))}
                  ${renderRow('质检记录', item.qcRecordId ?? '—')}
                  ${renderRow('金额', amountText, { bold: true, red: group !== '任务收入' })}
                  ${renderRow('说明', item.remark ?? item.processLabel ?? item.sourceLabelZh ?? group)}
                </div>
              `
            })
            .join('')}
        </div>
      `
    })
    .join('')

  return content || '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前对账单没有结算明细</div>'
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
  const currentContext = getCurrentFactoryContext()
  const currentEffective = getCurrentEffectiveSettlementInfo(currentContext.factoryCode)
  const appeals = getStatementAppealRecords(statement)
  const canRespond =
    statement.status === 'PENDING_FACTORY_CONFIRM' && statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM'
  const canAppeal = canRespond || (isStatementProxyConfirmed(statement) && !statement.prepaymentBatchId)
  const canConfirmStatement = canRespond && hasPdaSettlementPermission('SETTLEMENT_CONFIRM')
  const canAppealStatement = canAppeal && hasPdaSettlementPermission('SETTLEMENT_DISPUTE')
  const statementPaid = isStatementPaid(statement)
  const paymentTime = getStatementPaymentTime(statement, batch)
  const snapshotDiffNote =
    currentEffective && currentEffective.versionNo !== statement.settlementProfileVersionNo
      ? `当前生效：${currentEffective.versionNo}；对账单使用：${statement.settlementProfileVersionNo}。新版本用于后续新单据，本期已生成单据继续沿用原快照。`
      : ''

  if (state.statementDrawerMode === 'appeal') {
    const isProxyAppeal = isStatementProxyConfirmed(statement)
    return renderDrawer(
      `发起申诉 · ${statement.statementNo ?? statement.statementId}`,
      `
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-700">
          ${isProxyAppeal ? '该对账单已由跟单审核代确认。如金额、扣款或确认依据有异议，可在这里提交；平台处理前，该单不会继续进入付款处理。' : '对账单异议会记录在当前对账单上。平台处理前，该单不会继续进入付款处理。'}
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
            <button class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="submit-statement-appeal" data-statement-id="${escapeHtml(statement.statementId)}" ${canAppealStatement ? '' : 'disabled'}>${isProxyAppeal ? '提交代确认异议' : '提交异议'}</button>
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
          ${renderRow('确认来源', getStatementConfirmationSourceLabel(statement))}
          ${renderRow('所属范围', statement.settlementCycleLabel ?? '—')}
          ${renderRow('创建时间', formatDateTime(statement.createdAt))}
          ${
            isStatementProxyConfirmed(statement)
              ? `
                ${renderRow('代确认跟单', statement.proxyConfirmedBy ?? '—')}
                ${renderRow('代确认时间', statement.proxyConfirmedAt ? formatDateTime(statement.proxyConfirmedAt) : '—')}
                ${renderRow('代确认方式', getProxyConfirmationMethodLabel(statement.proxyConfirmMethod))}
                ${renderRow('通知状态', getProxyNotificationStatusLabel(statement.proxyConfirmNotificationStatus))}
              `
              : ''
          }
        `,
      )}
      ${renderProxyConfirmationNotice(statement)}
      ${renderStatementDetailSection(
        '金额概况',
        `
          ${renderRow('应付', formatAmount(amounts.earningAmount), { bold: true })}
          ${renderRow('扣款', amounts.deductionAmount > 0 ? formatAmount(amounts.deductionAmount) : '—', { red: amounts.deductionAmount > 0 })}
          ${renderRow('本期净额', formatAmount(amounts.netAmount), { bold: true })}
          ${renderRow('付款状态', getStatementPaymentStatusLabel(statement, batch), { green: statementPaid, orange: isStatementPaidPendingWriteback(statement, batch) })}
          ${statementPaid ? renderRow('付款金额', formatAmount(getStatementNetAmount(statement), statement.settlementCurrency ?? 'IDR'), { bold: true }) : ''}
          ${paymentTime ? renderRow('付款时间', formatDateTime(paymentTime)) : ''}
        `,
      )}
      ${renderStatementDetailSection(
        '结算明细',
        renderStatementSettlementItems(statement),
      )}
      ${renderStatementDetailSection(
        '工厂反馈',
        `
          ${renderRow('反馈状态', getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}
          ${renderRow('反馈时间', statement.factoryFeedbackAt ? formatDateTime(statement.factoryFeedbackAt) : '当前未反馈')}
          ${renderRow('反馈人', statement.factoryFeedbackBy ?? '当前未反馈')}
          ${isStatementProxyConfirmed(statement) ? renderRow('代确认原因', statement.proxyConfirmReason ?? '未记录') : ''}
          ${isStatementProxyConfirmed(statement) ? renderRow('通知说明', statement.proxyConfirmNotificationRemark ?? '未记录') : ''}
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
        '三方工厂可见操作记录',
        renderFactoryVisibleStatementLogs(statement),
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
      <div class="grid grid-cols-2 gap-2">
        <button
          class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          data-pda-sett-action="confirm-statement"
          data-statement-id="${escapeHtml(statement.statementId)}"
          ${canConfirmStatement ? '' : 'disabled'}
        >
          确认对账单
        </button>
        <button
          class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          data-pda-sett-action="open-statement-appeal"
          data-statement-id="${escapeHtml(statement.statementId)}"
          ${canAppealStatement ? '' : 'disabled'}
        >
          发起申诉
        </button>
        <button class="inline-flex h-10 items-center justify-center rounded-md border px-3 text-xs hover:bg-muted" data-pda-sett-action="close-statement-drawer">关闭</button>
      </div>
    `,
    'close-statement-drawer',
  )
}

function renderSettlementPlaceholderPage(title: string, description: string, drawerContent = ''): string {
  return `
    <div class="space-y-3 px-4 py-4">
      <section class="rounded-lg border bg-card px-4 py-4 shadow-none">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-base font-bold">${escapeHtml(title)}</h1>
            <p class="mt-1 text-[11px] leading-5 text-muted-foreground">${escapeHtml(description)}</p>
          </div>
          ${renderSettlementProfileEntryCard()}
        </div>
      </section>
      ${renderSettlementRequestDrawer()}
      ${drawerContent}
    </div>
  `
}

function renderHomeMetricLink(label: string, value: string, href: string): string {
  const actionAttr = href.includes('tab=quality')
    ? 'data-pda-sett-action="open-quality-list"'
    : 'data-pda-sett-action="open-statement-list"'
  return `
    <button class="rounded-lg border bg-background px-3 py-2 text-left" ${actionAttr} data-nav="${escapeHtml(href)}">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-bold text-foreground">${escapeHtml(value)}</div>
    </button>
  `
}

function renderStatementFilterTabs(): string {
  const tabs: Array<[StatementFilterView, string]> = [
    ['all', '全部'],
    ['pending-confirm', '待确认'],
    ['disputing', '异议中'],
    ['unpaid', '未付款'],
    ['paid', '已付款'],
  ]
  return `<div class="flex gap-2 overflow-x-auto pb-1">${tabs
    .map(
      ([view, label]) => `
        <button class="shrink-0 rounded-full border px-3 py-1.5 text-xs ${state.statementFilterView === view ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}" data-nav="${escapeHtml(buildStatementListHref(view))}">${escapeHtml(label)}</button>
      `,
    )
    .join('')}</div>`
}

function renderQualityRecordFilterTabs(): string {
  const tabs: Array<[QualityRecordFilterView, string]> = [
    ['all', '全部'],
    ['not-in-statement', '未进对账'],
    ['in-statement', '已进对账'],
    ['rework', '有返工'],
    ['deducted', '有扣款'],
  ]
  return `<div class="flex gap-2 overflow-x-auto pb-1">${tabs
    .map(
      ([view, label]) => `
        <button class="shrink-0 rounded-full border px-3 py-1.5 text-xs ${state.qualityRecordFilterView === view ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}" data-nav="${escapeHtml(buildQualityListHref(view))}">${escapeHtml(label)}</button>
      `,
    )
    .join('')}</div>`
}

function renderStatementCard(statement: StatementDraft, summary: SettlementCycleSummary): string {
  const amounts = getStatementSplitAmounts(statement)
  const batch = statement.prepaymentBatchId ? getPrepaymentBatchById(statement.prepaymentBatchId) : getBatchByStatement(statement.statementId)
  const statementPaid = isStatementPaid(statement)
  const paymentTime = getStatementPaymentTime(statement, batch)
  const canRespond =
    statement.status === 'PENDING_FACTORY_CONFIRM' && statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM'
  const canAppeal = canRespond || (isStatementProxyConfirmed(statement) && !statement.prepaymentBatchId)
  const canConfirmStatement = canRespond && hasPdaSettlementPermission('SETTLEMENT_CONFIRM')
  const canAppealStatement = canAppeal && hasPdaSettlementPermission('SETTLEMENT_DISPUTE')

  return `
    <section class="rounded-lg border bg-card px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate text-sm font-semibold">${escapeHtml(statement.statementNo ?? statement.statementId)}</h2>
          <p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(summary.settlementCycleLabel ?? statement.settlementCycleLabel ?? '—')}</p>
        </div>
        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">${escapeHtml(getFactoryFeedbackLabel(statement.factoryFeedbackStatus))}</span>
      </div>
      <div class="mt-3 space-y-1">
        ${renderRow('任务收入', formatAmount(amounts.earningAmount, statement.settlementCurrency ?? 'IDR'))}
        ${renderRow('扣款', amounts.deductionAmount > 0 ? formatAmount(amounts.deductionAmount, statement.settlementCurrency ?? 'IDR') : '—', { red: amounts.deductionAmount > 0 })}
        ${renderRow('本期净额', formatAmount(amounts.netAmount, statement.settlementCurrency ?? 'IDR'), { bold: true })}
        ${renderRow('付款状态', getStatementPaymentStatusLabel(statement, batch), { green: statementPaid, orange: isStatementPaidPendingWriteback(statement, batch) })}
        ${statementPaid ? renderRow('付款金额', formatAmount(getStatementNetAmount(statement), statement.settlementCurrency ?? 'IDR'), { bold: true }) : ''}
        ${paymentTime ? renderRow('付款时间', formatDateTime(paymentTime)) : ''}
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <button class="inline-flex h-9 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="confirm-statement" data-statement-id="${escapeHtml(statement.statementId)}" ${canConfirmStatement ? '' : 'disabled'}>
          确认
        </button>
        <button class="inline-flex h-9 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pda-sett-action="open-statement-appeal" data-statement-id="${escapeHtml(statement.statementId)}" ${canAppealStatement ? '' : 'disabled'}>
          申诉
        </button>
        <button class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground" data-pda-sett-action="open-statement-detail" data-statement-id="${escapeHtml(statement.statementId)}">
          查看详情
        </button>
      </div>
    </section>
  `
}

function renderQualityRecordCard(row: QcFactRow): string {
  const inStatement = row.settlementTrace.statusLabel === '已进入对账'
  return `
    <button class="w-full rounded-lg border bg-card px-4 py-3 text-left" data-pda-sett-action="open-quality-record-detail" data-qc-id="${escapeHtml(row.id)}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">${escapeHtml(row.displayNo)}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.skuSummary)}</div>
        </div>
        <span class="${toClassName(
          'shrink-0 rounded-full border px-2 py-0.5 text-[10px]',
          inStatement ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-background text-muted-foreground',
        )}">${escapeHtml(row.settlementTrace.statusLabel)}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        ${renderRow('质检数量', `${row.inspectedQty} 件`)}
        ${renderRow('合格数量', `${row.qualifiedQty} 件`)}
        ${renderRow('返工数量', `${row.reworkQty} 件`, { orange: row.reworkQty > 0 })}
        ${renderRow('瑕疵数量', `${row.defectQty} 件`, { orange: row.defectQty > 0 })}
      </div>
      <div class="mt-2 text-[11px] leading-5 text-muted-foreground">
        对账单引用：${escapeHtml(row.settlementTrace.statementNo ?? '未进入对账')} · 返工接收对象：${escapeHtml(row.reworkReceivers)}
      </div>
    </button>
  `
}

function renderSettlementHomePage(): string {
  const context = getCurrentFactoryContext()
  const vm = buildSettlementHomeViewModel(context)
  const pendingStatements = vm.statements.filter(({ statement }) => statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM')
  const disputingStatements = vm.statements.filter(({ statement }) => statement.factoryFeedbackStatus === 'FACTORY_APPEALED')
  const paidStatements = vm.statements.filter(({ statement }) => isStatementPaid(statement))
  const unpaidStatements = vm.statements.filter(({ statement }) => !isStatementPaid(statement))
  const inStatementQcRows = vm.qcRows.filter((row) => row.settlementTrace.statusLabel === '已进入对账')
  const notInStatementQcRows = vm.qcRows.filter((row) => row.settlementTrace.statusLabel !== '已进入对账')
  const reworkQcRows = vm.qcRows.filter((row) => row.reworkQty > 0)
  const deductedQcRows = vm.qcRows.filter((row) => row.reworkChargebackAmountText !== '—')

  return `
    <div class="space-y-3 px-4 py-4">
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">结算</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">只看收入、对账单、质检记录和结算资料。付款只显示对账单是否已付款。</p>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">收入</h2>
        <p class="mt-1 text-[11px] text-muted-foreground">未结算为未入单净额参考，不等同于应付款。</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${renderHomeMetricLink('累计收入', formatAmount(vm.accumulatedIncome, 'IDR'), buildStatementListHref('all'))}
          ${renderHomeMetricLink('累计扣款', formatAmount(vm.accumulatedDeduction, 'IDR'), buildStatementListHref('all'))}
          ${renderHomeMetricLink('已付款', formatAmount(vm.paidAmount, 'IDR'), buildStatementListHref('paid'))}
          ${renderHomeMetricLink('未付款', formatAmount(vm.unpaidAmount, 'IDR'), buildStatementListHref('unpaid'))}
          ${renderHomeMetricLink('未结算参考金额', formatAmount(vm.unsettledReferenceAmount, 'IDR'), buildStatementListHref('all'))}
        </div>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">对账单</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${renderHomeMetricLink('全部', String(vm.statements.length), buildStatementListHref('all'))}
          ${renderHomeMetricLink('待确认对账单', String(pendingStatements.length), buildStatementListHref('pending-confirm'))}
          ${renderHomeMetricLink('异议中对账单', String(disputingStatements.length), buildStatementListHref('disputing'))}
          ${renderHomeMetricLink('未付款对账单', String(unpaidStatements.length), buildStatementListHref('unpaid'))}
          ${renderHomeMetricLink('已付款对账单', String(paidStatements.length), buildStatementListHref('paid'))}
        </div>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">质检记录</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${renderHomeMetricLink('全部', String(vm.qcRows.length), buildQualityListHref('all'))}
          ${renderHomeMetricLink('未进对账', String(notInStatementQcRows.length), buildQualityListHref('not-in-statement'))}
          ${renderHomeMetricLink('已进对账', String(inStatementQcRows.length), buildQualityListHref('in-statement'))}
          ${renderHomeMetricLink('有返工', String(reworkQcRows.length), buildQualityListHref('rework'))}
          ${renderHomeMetricLink('有扣款', String(deductedQcRows.length), buildQualityListHref('deducted'))}
        </div>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">结算资料</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="rounded-lg border bg-background px-3 py-2 text-left" data-pda-sett-action="open-settlement-profile">当前版本</button>
          <button class="rounded-lg border bg-background px-3 py-2 text-left" data-pda-sett-action="open-settlement-version-history">历史版本记录</button>
        </div>
      </section>
      ${renderSettlementRequestDrawer()}
    </div>
  `
}

function renderStatementListPage(): string {
  const context = getCurrentFactoryContext()
  const vm = buildSettlementHomeViewModel(context)
  const rows = filterStatementRows(vm.statements, state.statementFilterView)
  return `
    <div class="space-y-3 px-4 py-4">
      <button class="text-xs text-muted-foreground" data-nav="${escapeHtml(buildSettlementHomeHref())}">返回结算首页</button>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">${escapeHtml(getStatementFilterLabel(state.statementFilterView))}</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">付款状态只说明对账单是否付款，工厂端这里只做查看。</p>
        <div class="mt-3">${renderStatementFilterTabs()}</div>
      </section>
      ${rows.length > 0 ? rows.map(({ statement, summary }) => renderStatementCard(statement, summary)).join('') : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选下没有对账单</div>'}
      ${renderStatementDrawer()}
    </div>
  `
}

function renderQualityRecordDrawer(): string {
  if (!state.qualityDrawerId) return ''
  const detail = getQcFactDetail(state.qualityDrawerId)
  if (!detail) return ''
  return renderDrawer(
    `质检记录 · ${detail.displayNo}`,
    `
      ${renderStatementDetailSection('质检事实', `
        ${renderRow('质检单', detail.displayNo, { bold: true })}
        ${renderRow('来源类型', detail.sourceTypeLabel)}
        ${renderRow('生产单', detail.productionOrderNo)}
        ${renderRow('SKU', detail.skuSummary)}
        ${renderRow('来源工厂', detail.sourceFactoryName)}
        ${renderRow('接收对象', detail.receiverName)}
        ${renderRow('质检点', detail.qcStationName)}
        ${renderRow('质检人', detail.inspectorName)}
        ${renderRow('质检时间', formatDateTime(detail.inspectedAt))}
        ${renderRow('质检结果', detail.resultLabel)}
        ${renderRow('质检数量', `${detail.inspectedQty} 件`)}
        ${renderRow('合格数量', `${detail.qualifiedQty} 件`)}
        ${renderRow('返工数量', `${detail.reworkQty} 件`, { orange: detail.reworkQty > 0 })}
        ${renderRow('瑕疵数量', `${detail.defectQty} 件`, { orange: detail.defectQty > 0 })}
        ${renderRow('返工接收对象', detail.reworkReceivers)}
      `)}
      ${renderStatementDetailSection('SKU 明细', detail.skuResults.length > 0 ? detail.skuResults.map((item) => `
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs font-semibold">${escapeHtml(item.skuCode)}</div>
          ${renderRow('颜色 / 尺码', `${item.colorName} / ${item.sizeName}`)}
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
            质检 ${item.inspectedQty} ${escapeHtml(item.qtyUnit)} · 合格 ${item.qualifiedQty} ${escapeHtml(item.qtyUnit)} · 返工 ${item.reworkQty} ${escapeHtml(item.qtyUnit)} · 瑕疵 ${item.defectQty} ${escapeHtml(item.qtyUnit)}
          </div>
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
            返工接收对象：${escapeHtml(item.reworkReceiveFactoryName)} · 瑕疵原因：${escapeHtml(item.defectReasonSummary)}
          </div>
          ${item.reworkChargebackAmountText !== '—' ? `<div class="mt-1 text-[11px] font-medium text-red-600">返工扣款金额：${escapeHtml(item.reworkChargebackAmountText)}</div>` : ''}
        </div>
      `).join('') : '<div class="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无 SKU 明细</div>')}
      ${renderStatementDetailSection('对账引用', `
        ${renderRow('是否进入对账', detail.settlementTrace.statusLabel)}
        ${renderRow('对账单', detail.settlementTrace.statementNo ?? '未进入对账')}
        ${renderRow('扣款明细', detail.settlementTrace.deductionLineNo ?? '—')}
        ${detail.reworkChargebackAmountText !== '—' ? renderRow('返工扣款金额', detail.reworkChargebackAmountText, { red: true }) : ''}
      `)}
    `,
    'close-quality-record-drawer',
  )
}

function renderQualityRecordListPage(): string {
  const context = getCurrentFactoryContext()
  const rows = filterQualityRows(getFactoryQcRows(context), state.qualityRecordFilterView).filter((row) =>
    matchesQualityRecordKeyword(row, state.qualitySearch),
  )
  return `
    <div class="space-y-3 px-4 py-4">
      <button class="text-xs text-muted-foreground" data-nav="${escapeHtml(buildSettlementHomeHref())}">返回结算首页</button>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">${escapeHtml(getQualityRecordFilterLabel(state.qualityRecordFilterView))}</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">只看质检事实和对账单引用，扣款只展示对账引用，不在 PDA 端重新计算。</p>
        <div class="mt-3">${renderQualityRecordFilterTabs()}</div>
        <input class="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="质检单 / 生产单 / SKU / 来源工厂 / 返工接收对象 / 对账单" value="${escapeHtml(state.qualitySearch)}" data-pda-sett-field="quality-search" data-skip-page-rerender="true" />
      </section>
      ${rows.length > 0 ? rows.map(renderQualityRecordCard).join('') : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选下没有质检记录</div>'}
      ${renderQualityRecordDrawer()}
    </div>
  `
}

function renderSettlementContent(): string {
  syncSettlementStateFromRoute()
  if (state.pageMode === 'statement-list') return renderStatementListPage()
  if (state.pageMode === 'quality-list') return renderQualityRecordListPage()
  return renderSettlementHomePage()
}

export function renderPdaSettlementPage(): string {
  if (!getPdaRuntimeContext()) {
    return renderPdaLoginRedirect()
  }
  if (!hasPdaSettlementPermission('SETTLEMENT_VIEW')) {
    return renderPdaFrame(renderSettlementNoPermission(), 'settlement')
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

  if (action === 'open-statement-list') {
    appStore.navigate(actionNode.dataset.nav || buildStatementListHref('all'))
    return true
  }

  if (action === 'open-quality-list') {
    appStore.navigate(actionNode.dataset.nav || buildQualityListHref('all'))
    return true
  }

  if (action === 'open-quality-record-detail') {
    const qcId = actionNode.dataset.qcId
    if (!qcId) return true
    state.qualityDrawerId = qcId
    return true
  }

  if (action === 'close-quality-record-drawer') {
    state.qualityDrawerId = null
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

  if (action === 'open-statement-appeal') {
    if (!hasPdaSettlementPermission('SETTLEMENT_DISPUTE')) {
      state.statementErrorText = '当前账号没有发起申诉权限'
      return true
    }
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
    if (!hasPdaSettlementPermission('SETTLEMENT_CONFIRM')) {
      state.statementErrorText = '当前账号没有确认对账单权限'
      return true
    }
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
    if (!hasPdaSettlementPermission('SETTLEMENT_DISPUTE')) {
      state.statementErrorText = '当前账号没有发起申诉权限'
      return true
    }
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
    if (!hasPdaSettlementPermission('SETTLEMENT_CHANGE_REQUEST')) {
      state.settlementRequestErrorText = '当前账号没有变更结算资料权限'
      return true
    }
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
    if (!hasPdaSettlementPermission('SETTLEMENT_CHANGE_REQUEST')) {
      state.settlementRequestErrorText = '当前账号没有变更结算资料权限'
      return true
    }
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
