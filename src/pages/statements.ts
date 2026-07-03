import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { buildDeductionEntryHrefByBasisId } from '../data/fcs/quality-chain-adapter'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import {
  buildProductionOrderSettlementProjections,
  buildStatementDraftLines,
  buildStatementDraftLinesFromSettlementSelection,
  getStatementDetailViewModel,
  getStatementListItems,
  getStatementSourceItemById,
  listStatementBuildScopes,
  type StatementBuildScopeViewModel,
  type StatementDetailLineViewModel,
  type StatementDetailViewModel,
  type StatementListItemViewModel,
  type StatementSourceItemViewModel,
} from '../data/fcs/store-domain-statement-source-adapter'
import {
  createStatementFromEligibleLedgers,
  findOpenStatementByPartyAndCycle,
  findOpenStatementByPartyAndRange,
  getLatestStatementAppeal,
  getOpenStatementAppeal,
  getProxyConfirmationMethodLabel,
  getProxyNotificationStatusLabel,
  canStatementEnterPrepayment,
  getStatementSettlementProgressView,
  getStatementConfirmationSourceLabel,
  getStatementDraftById,
  initialStatementDrafts,
  isStatementProxyConfirmed,
  resolveStatementAppeal,
  startStatementAppealHandling,
  submitStatementMerchandiserProxyConfirmation,
  syncStatementDraftFromBuild,
} from '../data/fcs/store-domain-settlement-seeds'
import {
  SEWING_FACTORY_LIABILITY_REASONS,
  type ProductionOrderSettlementProjection,
  type SettlementCurrency,
  isSewingFactoryLiabilityReason,
  toStatementProductionOrderSnapshot,
} from '../data/fcs/factory-settlement-reconciliation'
import { listStatementEligiblePreSettlementLedgersByRange } from '../data/fcs/pre-settlement-ledger-repository'
import type {
  FactoryFeedbackStatus,
  StatementAppealRecord,
  StatementAuditLog,
  StatementProxyConfirmationMethod,
  StatementProxyNotificationStatus,
  StatementDraft,
  StatementDraftItem,
  PreSettlementLedger,
  StatementResolutionResult,
  StatementSettlementObjectMode,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type StatementPageView = 'LIST' | 'BUILD'
type StatementBuildTab = 'SCOPE' | 'OBJECTS' | 'QC_DEDUCTIONS' | 'SUMMARY'
type StatusFilter = '__ALL__' | StatementStatus | '__FACTORY_SELF_CONFIRMED__' | '__MERCHANDISER_PROXY_CONFIRMED__'
type FeedbackFilter = '__ALL__' | FactoryFeedbackStatus

interface StatementsState {
  activeView: StatementPageView
  keyword: string
  filterParty: string
  filterCycle: string
  filterStatus: StatusFilter
  filterFeedback: FeedbackFilter
  listPage: number
  listPageSize: number
  detailStatementId: string | null
  buildTab: StatementBuildTab
  buildFactoryId: string
  buildCycleId: string
  buildStartDate: string
  buildEndDate: string
  buildObjectMode: StatementSettlementObjectMode
  buildCurrency: SettlementCurrency
  selectedLedgerIds: string[]
  selectedProductionOrderNos: string[]
  buildRemark: string
  manualDefectProductionOrderDeductions: Record<string, Record<string, ManualDeductionInput>>
  manualDelayProductionOrderDeductions: Record<string, ManualDeductionInput>
  editingStatementId: string | null
  processingAppealStatementId: string | null
  appealResolutionResult: '' | StatementResolutionResult
  appealResolutionComment: string
  proxyConfirmStatementId: string | null
  proxyConfirmReason: string
  proxyConfirmMethod: '' | StatementProxyConfirmationMethod
  proxyConfirmRemark: string
  proxyConfirmNotificationStatus: StatementProxyNotificationStatus
  proxyConfirmNotificationRemark: string
}

interface StatementOverviewCounts {
  total: number
  draft: number
  pendingFactory: number
  readyForPrepayment: number
  financePending: number
  inPrepaymentBatch: number
  prepaid: number
  closed: number
  buildableScopeCount: number
}

interface ManualDeductionInput {
  amount: string
  remark: string
}

interface BuildQcReasonProductionOrderSummary {
  productionOrderNo: string
  productionOrderId?: string
  reasonName: string
  qty: number
}

const STATUS_ZH: Record<StatementStatus, string> = {
  DRAFT: '草稿',
  PENDING_FACTORY_CONFIRM: '待工厂反馈',
  FACTORY_CONFIRMED: '工厂已确认',
  READY_FOR_PREPAYMENT: '确认后处理',
  IN_PREPAYMENT_BATCH: '已入预付款批次',
  PREPAID: '已预付',
  CLOSED: '已关闭',
}

const STATUS_BADGE_CLASS: Record<StatementStatus, string> = {
  DRAFT: 'border border-amber-200 bg-amber-50 text-amber-700',
  PENDING_FACTORY_CONFIRM: 'border border-blue-200 bg-blue-50 text-blue-700',
  FACTORY_CONFIRMED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  READY_FOR_PREPAYMENT: 'border border-green-200 bg-green-50 text-green-700',
  IN_PREPAYMENT_BATCH: 'border border-violet-200 bg-violet-50 text-violet-700',
  PREPAID: 'border border-teal-200 bg-teal-50 text-teal-700',
  CLOSED: 'border border-slate-200 bg-slate-50 text-slate-600',
}

const FACTORY_FEEDBACK_LABEL: Record<FactoryFeedbackStatus, string> = {
  NOT_SENT: '未下发',
  PENDING_FACTORY_CONFIRM: '待工厂反馈',
  FACTORY_CONFIRMED: '工厂已确认',
  FACTORY_APPEALED: '工厂已申诉',
  PLATFORM_HANDLING: '平台处理中',
  RESOLVED: '已处理完成',
}

const FACTORY_FEEDBACK_BADGE: Record<FactoryFeedbackStatus, string> = {
  NOT_SENT: 'border bg-muted text-muted-foreground',
  PENDING_FACTORY_CONFIRM: 'border border-amber-200 bg-amber-50 text-amber-700',
  FACTORY_CONFIRMED: 'border border-green-200 bg-green-50 text-green-700',
  FACTORY_APPEALED: 'border border-red-200 bg-red-50 text-red-700',
  PLATFORM_HANDLING: 'border border-blue-200 bg-blue-50 text-blue-700',
  RESOLVED: 'border border-slate-200 bg-slate-50 text-slate-700',
}

type StatementPrepaymentDisplaySource = Pick<
  StatementDraft,
  'status' | 'factoryFeedbackStatus' | 'resolutionResult'
> &
  Partial<Pick<StatementDraft, 'netPayableAmount' | 'totalAmount'>>

function isStatementReadyForPrepaymentDisplay(statement: StatementPrepaymentDisplaySource): boolean {
  return canStatementEnterPrepayment(statement)
}

function isStatementFinancePendingDisplay(statement: StatementPrepaymentDisplaySource): boolean {
  return statement.status === 'READY_FOR_PREPAYMENT' && !isStatementReadyForPrepaymentDisplay(statement)
}

function getStatementDisplayStatusLabel(statement: StatementPrepaymentDisplaySource): string {
  if (isStatementReadyForPrepaymentDisplay(statement)) return '待入预付款'
  if (isStatementFinancePendingDisplay(statement)) return '财务待处理'
  return STATUS_ZH[statement.status]
}

function getStatementDisplayStatusBadgeClass(statement: StatementPrepaymentDisplaySource): string {
  if (isStatementReadyForPrepaymentDisplay(statement)) return STATUS_BADGE_CLASS.READY_FOR_PREPAYMENT
  if (isStatementFinancePendingDisplay(statement)) return 'border border-amber-200 bg-amber-50 text-amber-700'
  return STATUS_BADGE_CLASS[statement.status]
}

const PRICE_SOURCE_LABEL: Record<string, string> = {
  DISPATCH: '派单价',
  BIDDING: '竞价中标价',
  BID: '竞价中标价',
  OTHER_COMPAT: '兼容价格快照',
  NONE: '不适用',
}

const LINE_GRAIN_LABEL: Record<string, string> = {
  RETURN_INBOUND_BATCH: '回货批次行',
  NON_BATCH_QUALITY: '返工扣款流水行',
  NON_BATCH_ADJUSTMENT: '兼容来源行',
  OTHER_SOURCE_OBJECT: '其它来源行',
}

const state: StatementsState = {
  activeView: 'LIST',
  keyword: '',
  filterParty: '__ALL__',
  filterCycle: '__ALL__',
  filterStatus: '__ALL__',
  filterFeedback: '__ALL__',
  listPage: 1,
  listPageSize: 8,
  detailStatementId: null,
  buildTab: 'SCOPE',
  buildFactoryId: '',
  buildCycleId: '',
  buildStartDate: '',
  buildEndDate: '',
  buildObjectMode: 'PRODUCTION_ORDER',
  buildCurrency: 'IDR',
  selectedLedgerIds: [],
  selectedProductionOrderNos: [],
  buildRemark: '',
  manualDefectProductionOrderDeductions: {},
  manualDelayProductionOrderDeductions: {},
  editingStatementId: null,
  processingAppealStatementId: null,
  appealResolutionResult: '',
  appealResolutionComment: '',
  proxyConfirmStatementId: null,
  proxyConfirmReason: '',
  proxyConfirmMethod: '',
  proxyConfirmRemark: '',
  proxyConfirmNotificationStatus: 'NOTIFIED',
  proxyConfirmNotificationRemark: '已在三方工厂端展示跟单审核代确认结果',
}

const STATEMENT_PAGE_SAMPLE_LIMIT = 15
const STATEMENT_LIST_PAGE_SIZE_OPTIONS = [5, 8, 15]
const STATEMENT_BUILD_BASE_TABS: Array<{ key: StatementBuildTab; label: string; description: string }> = [
  { key: 'SCOPE', label: '基础范围', description: '选工厂、时间段和结算对象' },
  { key: 'OBJECTS', label: '对象反查', description: '反查生产单、流水和完成情况' },
  { key: 'QC_DEDUCTIONS', label: '质检扣款', description: '按质检事实填写扣款' },
  { key: 'SUMMARY', label: '金额确认', description: '核对总金额和明细' },
]
const STATEMENT_PAGE_SAMPLE_IDS = [
  'ST-LINK-2026-0006',
  'ST-LINK-2026-0036',
  'ST-LINK-2026-0017',
  'ST-LINK-2026-0023',
  'ST-LINK-2026-0009',
  'ST-LINK-2026-0013',
  'ST-LINK-2026-0003',
  'ST-LINK-2026-0027',
  'ST-LINK-2026-0032',
  'ST-LINK-2026-0031',
  'ST-LINK-2026-0002',
  'ST-LINK-2026-0016',
  'ST-LINK-2026-0008',
  'ST-LINK-2026-0007',
  'ST-LINK-2026-0021',
]

let statementPageDemoBootstrapped = false

interface DemoSettlementSkuFact {
  skuCode: string
  colorSize: string
  inspectedQty: number
  qualifiedQty: number
  defectReasonQtyByName: Record<string, number>
  reworkQty: number
  reworkReceiveObject: 'ORIGINAL_FACTORY' | 'POST_FACTORY'
  reworkReceiveFactoryName: string
}

interface DemoSettlementQcFact {
  qcOrderId: string
  qcOrderNo: string
  inspectedAt: string
  inspector: string
  sourceFactoryName: string
  postFactoryName: string
  skuFacts: DemoSettlementSkuFact[]
}

interface DemoSettlementProductionOrder {
  productionOrderId: string
  productionOrderNo: string
  cuttingCompletedQty: number
  ledgers: PreSettlementLedger[]
  qcOrders: DemoSettlementQcFact[]
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showStatementsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'statements-toast-root'
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

function formatAmount(value: number): string {
  return `${value.toFixed(2)} IDR`
}

function getFactoryFeedbackStatusLabel(status: FactoryFeedbackStatus): string {
  return FACTORY_FEEDBACK_LABEL[status]
}

function getFactoryFeedbackStatusBadge(status: FactoryFeedbackStatus): string {
  return FACTORY_FEEDBACK_BADGE[status]
}

function appendDemoStatementLog(draft: StatementDraft, log: StatementAuditLog): void {
  if (draft.statementAuditLogs?.some((item) => item.action === log.action && item.operatedAt === log.operatedAt)) return
  draft.statementAuditLogs = [...(draft.statementAuditLogs ?? []), log]
}

function applyStatementPageDemoBootstrap(): void {
  if (statementPageDemoBootstrapped) return
  statementPageDemoBootstrapped = true

  const proxyDraft = getStatementDraftById('ST-LINK-2026-0003')
  if (proxyDraft && !isStatementProxyConfirmed(proxyDraft)) {
    const operatedAt = '2026-03-27 09:10:00'
    const fromStatus = proxyDraft.status
    const fromFactoryFeedbackStatus = proxyDraft.factoryFeedbackStatus

    proxyDraft.status = 'READY_FOR_PREPAYMENT'
    proxyDraft.factoryFeedbackStatus = 'FACTORY_CONFIRMED'
    proxyDraft.factoryFeedbackAt = operatedAt
    proxyDraft.factoryFeedbackBy = '跟单A'
    proxyDraft.factoryFeedbackRemark = '跟单审核代确认：三方工厂连续两日未在 PDA 操作，已通过 WhatsApp 与负责人核对无异议'
    proxyDraft.factoryConfirmedAt = operatedAt
    proxyDraft.confirmationSource = 'MERCHANDISER_PROXY_CONFIRMATION'
    proxyDraft.proxyConfirmedAt = operatedAt
    proxyDraft.proxyConfirmedBy = '跟单A'
    proxyDraft.proxyConfirmReason = '三方工厂连续两日未在 PDA 操作，跟单已通过 WhatsApp 与负责人核对无异议'
    proxyDraft.proxyConfirmMethod = 'WHATSAPP'
    proxyDraft.proxyConfirmRemark = '已核对本期金额、质量扣款和计划预付款日'
    proxyDraft.proxyConfirmNotificationStatus = 'NOTIFIED'
    proxyDraft.proxyConfirmNotificationAt = operatedAt
    proxyDraft.proxyConfirmNotificationRemark = '已在三方工厂端展示跟单审核代确认结果'
    proxyDraft.readyForPrepaymentAt = operatedAt
    proxyDraft.updatedAt = operatedAt
    proxyDraft.updatedBy = '跟单A'
    appendDemoStatementLog(proxyDraft, {
      action: '跟单审核代确认',
      actor: '跟单A',
      operatedAt,
      fromStatus,
      toStatus: proxyDraft.status,
      fromFactoryFeedbackStatus,
      toFactoryFeedbackStatus: proxyDraft.factoryFeedbackStatus,
      reason: proxyDraft.proxyConfirmReason,
      method: proxyDraft.proxyConfirmMethod,
      notificationStatus: proxyDraft.proxyConfirmNotificationStatus,
      notificationRemark: proxyDraft.proxyConfirmNotificationRemark,
      remark: proxyDraft.proxyConfirmRemark,
      visibleToFactory: true,
    })
  }

  const closedDraft = getStatementDraftById('ST-LINK-2026-0036')
  if (closedDraft && closedDraft.status === 'DRAFT') {
    const operatedAt = '2026-03-27 10:20:00'
    const fromStatus = closedDraft.status
    const fromFactoryFeedbackStatus = closedDraft.factoryFeedbackStatus
    closedDraft.status = 'CLOSED'
    closedDraft.updatedAt = operatedAt
    closedDraft.updatedBy = '平台运营'
    appendDemoStatementLog(closedDraft, {
      action: '关闭对账单',
      actor: '平台运营',
      operatedAt,
      fromStatus,
      toStatus: closedDraft.status,
      fromFactoryFeedbackStatus,
      toFactoryFeedbackStatus: closedDraft.factoryFeedbackStatus,
      remark: '样例：本期口径需调整，关闭后重新生成',
      visibleToFactory: false,
    })
  }
}

function getStatementPageListItems(allItems: StatementListItemViewModel[]): StatementListItemViewModel[] {
  const selectedIds = new Set(STATEMENT_PAGE_SAMPLE_IDS)
  const byId = new Map(allItems.map((item) => [item.statementId, item]))
  const runtimeItems = allItems.filter((item) => !selectedIds.has(item.statementId) && !item.statementId.startsWith('ST-LINK-'))
  const sampleItems = STATEMENT_PAGE_SAMPLE_IDS.map((id) => byId.get(id)).filter(Boolean) as StatementListItemViewModel[]

  return [...runtimeItems, ...sampleItems].slice(0, STATEMENT_PAGE_SAMPLE_LIMIT)
}

function getFactoryAppealStatusLabel(status: StatementAppealRecord['status']): string {
  if (status === 'SUBMITTED') return '已提交'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理完成'
}

function getResolutionResultLabel(result?: StatementResolutionResult): string {
  if (result === 'UPHELD') return '维持当前口径'
  if (result === 'REOPEN_REQUIRED') return '退回重算'
  return '当前未处理'
}

function getStatementAppealRecords(draft: StatementDraft): StatementAppealRecord[] {
  if (draft.appealRecords?.length) return draft.appealRecords
  return draft.factoryAppealRecord ? [draft.factoryAppealRecord] : []
}

function getStatementOverviewCounts(
  listItems: StatementListItemViewModel[],
  buildScopes: StatementBuildScopeViewModel[],
): StatementOverviewCounts {
  return {
    total: listItems.length,
    draft: listItems.filter((item) => item.status === 'DRAFT').length,
    pendingFactory: listItems.filter((item) => item.status === 'PENDING_FACTORY_CONFIRM').length,
    readyForPrepayment: listItems.filter((item) => isStatementReadyForPrepaymentDisplay(item)).length,
    financePending: listItems.filter((item) => isStatementFinancePendingDisplay(item)).length,
    inPrepaymentBatch: listItems.filter((item) => item.status === 'IN_PREPAYMENT_BATCH').length,
    prepaid: listItems.filter((item) => item.status === 'PREPAID').length,
    closed: listItems.filter((item) => item.status === 'CLOSED').length,
    buildableScopeCount: buildScopes.length,
  }
}

function getStatementPartyOptions(listItems: StatementListItemViewModel[]): Array<{ value: string; label: string }> {
  return Array.from(
    new Map(listItems.map((item) => [item.settlementPartyId, item.settlementPartyLabel])).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

function getStatementCycleOptions(listItems: StatementListItemViewModel[]): Array<{ value: string; label: string }> {
  return Array.from(
    new Map(
      listItems
        .filter((item) => item.settlementCycleId && item.settlementCycleLabel)
        .map((item) => [item.settlementCycleId as string, item.settlementCycleLabel as string]),
    ).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => right.label.localeCompare(left.label, 'zh-CN'))
}

function getFilteredStatementListItems(items: StatementListItemViewModel[]): StatementListItemViewModel[] {
  const keyword = state.keyword.trim().toLowerCase()
  return items.filter((item) => {
    if (state.filterParty !== '__ALL__' && item.settlementPartyId !== state.filterParty) return false
    if (state.filterCycle !== '__ALL__' && item.settlementCycleId !== state.filterCycle) return false
    if (
      state.filterStatus === '__FACTORY_SELF_CONFIRMED__' &&
      (item.factoryFeedbackStatus !== 'FACTORY_CONFIRMED' || item.confirmationSource === 'MERCHANDISER_PROXY_CONFIRMATION')
    ) {
      return false
    }
    if (
      state.filterStatus === '__MERCHANDISER_PROXY_CONFIRMED__' &&
      (item.factoryFeedbackStatus !== 'FACTORY_CONFIRMED' || item.confirmationSource !== 'MERCHANDISER_PROXY_CONFIRMATION')
    ) {
      return false
    }
    if (
      state.filterStatus !== '__ALL__' &&
      state.filterStatus !== '__FACTORY_SELF_CONFIRMED__' &&
      state.filterStatus !== '__MERCHANDISER_PROXY_CONFIRMED__' &&
      item.status !== state.filterStatus
    ) {
      return false
    }
    if (state.filterFeedback !== '__ALL__' && item.factoryFeedbackStatus !== state.filterFeedback) return false

    if (keyword) {
      const haystack = [
        item.statementId,
        item.statementNo,
        item.settlementPartyLabel,
        item.settlementCycleLabel ?? '',
        item.settlementProfileVersionNo,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    return true
  })
}

function resetStatementListPage(): void {
  state.listPage = 1
}

function getStatementListPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / state.listPageSize))
}

function getCurrentStatementListPage(total: number): number {
  const totalPages = getStatementListPageCount(total)
  const currentPage = Math.min(Math.max(state.listPage, 1), totalPages)
  if (state.listPage !== currentPage) state.listPage = currentPage
  return currentPage
}

function getPaginatedStatementListItems(items: StatementListItemViewModel[]): StatementListItemViewModel[] {
  const currentPage = getCurrentStatementListPage(items.length)
  const start = (currentPage - 1) * state.listPageSize
  return items.slice(start, start + state.listPageSize)
}

function getBuildFactoryOptions(scopes: StatementBuildScopeViewModel[]): Array<{ value: string; label: string }> {
  return Array.from(new Map(scopes.map((item) => [item.settlementPartyId, item.settlementPartyLabel])).entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

function getBuildCycleOptions(scopes: StatementBuildScopeViewModel[], factoryId: string): StatementBuildScopeViewModel[] {
  return scopes.filter((item) => item.settlementPartyId === factoryId)
}

function getSelectedBuildScope(scopes: StatementBuildScopeViewModel[]): StatementBuildScopeViewModel | null {
  if (!state.buildFactoryId || !state.buildCycleId) return null
  return (
    scopes.find(
      (item) =>
        item.settlementPartyId === state.buildFactoryId && item.settlementCycleId === state.buildCycleId,
    ) ?? null
  )
}

function getStatementBuildTabs(): Array<{ key: StatementBuildTab; label: string; description: string }> {
  return STATEMENT_BUILD_BASE_TABS.map((tab) => {
    if (tab.key !== 'OBJECTS') return tab
    if (state.buildObjectMode === 'LEDGER') {
      return { key: 'OBJECTS', label: '预结算流水', description: '查看选择范围内全部预结算流水' }
    }
    return { key: 'OBJECTS', label: '对象反查', description: '反查生产单、流水和完成情况' }
  })
}

const DEMO_SETTLEMENT_ORDER_BLUEPRINTS = [
  {
    productionOrderId: 'MOCK-SETTLE-PO-001',
    productionOrderNo: 'MOCK-SETTLE-PO-001',
    poKey: 'PO1',
    cuttingCompletedQty: 300,
    earningQtys: [135, 135],
    ledgerIds: ['MOCK-PSL-PO1-01', 'MOCK-PSL-PO1-02', 'MOCK-PSL-PO1-03', 'MOCK-PSL-PO1-04', 'MOCK-PSL-PO1-05'],
    qcOrderIds: ['MOCK-QC-PO1-01', 'MOCK-QC-PO1-02', 'MOCK-QC-PO1-03'],
  },
  {
    productionOrderId: 'MOCK-SETTLE-PO-002',
    productionOrderNo: 'MOCK-SETTLE-PO-002',
    poKey: 'PO2',
    cuttingCompletedQty: 330,
    earningQtys: [150, 150],
    ledgerIds: ['MOCK-PSL-PO2-01', 'MOCK-PSL-PO2-02', 'MOCK-PSL-PO2-03', 'MOCK-PSL-PO2-04', 'MOCK-PSL-PO2-05'],
    qcOrderIds: ['MOCK-QC-PO2-01', 'MOCK-QC-PO2-02', 'MOCK-QC-PO2-03'],
  },
  {
    productionOrderId: 'MOCK-SETTLE-PO-003',
    productionOrderNo: 'MOCK-SETTLE-PO-003',
    poKey: 'PO3',
    cuttingCompletedQty: 360,
    earningQtys: [165, 165],
    ledgerIds: ['MOCK-PSL-PO3-01', 'MOCK-PSL-PO3-02', 'MOCK-PSL-PO3-03', 'MOCK-PSL-PO3-04', 'MOCK-PSL-PO3-05'],
    qcOrderIds: ['MOCK-QC-PO3-01', 'MOCK-QC-PO3-02', 'MOCK-QC-PO3-03'],
  },
]

function getDemoBuildScope(): StatementBuildScopeViewModel | null {
  return getSelectedBuildScope(listStatementBuildScopes())
}

function getDemoBuildTimestamp(time: string): string {
  return `${state.buildStartDate || '2026-06-03'} ${time}`
}

function buildDemoQcSkuFacts(input: {
  poKey: string
  qcIndex: number
  sourceFactoryName: string
  postFactoryName: string
}): DemoSettlementSkuFact[] {
  const qcKey = `QC${input.qcIndex + 1}`
  return [
    {
      skuCode: `SKU-SETTLE-${input.poKey}-${qcKey}-A`,
      colorSize: 'Cream / S',
      inspectedQty: 100,
      qualifiedQty: 91,
      defectReasonQtyByName: { 做工原因: 4, 脏污: 5 },
      reworkQty: 8,
      reworkReceiveObject: 'ORIGINAL_FACTORY',
      reworkReceiveFactoryName: input.sourceFactoryName,
    },
    {
      skuCode: `SKU-SETTLE-${input.poKey}-${qcKey}-B`,
      colorSize: 'Cream / M',
      inspectedQty: 100,
      qualifiedQty: 90,
      defectReasonQtyByName: { 抽纱: 6, 做错: 4 },
      reworkQty: 8,
      reworkReceiveObject: 'ORIGINAL_FACTORY',
      reworkReceiveFactoryName: input.sourceFactoryName,
    },
    {
      skuCode: `SKU-SETTLE-${input.poKey}-${qcKey}-C`,
      colorSize: 'Cream / L',
      inspectedQty: 100,
      qualifiedQty: 89,
      defectReasonQtyByName: { 做毁: 5, 破洞: 6 },
      reworkQty: 10,
      reworkReceiveObject: 'POST_FACTORY',
      reworkReceiveFactoryName: input.postFactoryName,
    },
  ]
}

function getSkuDefectQty(item: DemoSettlementSkuFact): number {
  return Object.values(item.defectReasonQtyByName).reduce((sum, qty) => sum + qty, 0)
}

function getQcReworkQty(item: DemoSettlementQcFact, receiveObject?: DemoSettlementSkuFact['reworkReceiveObject']): number {
  return item.skuFacts
    .filter((sku) => !receiveObject || sku.reworkReceiveObject === receiveObject)
    .reduce((sum, sku) => sum + sku.reworkQty, 0)
}

function getDemoSettlementOrders(): DemoSettlementProductionOrder[] {
  if (!isBuildRangeValid()) return []
  const scope = getDemoBuildScope()
  if (!scope) return []

  const factoryId = state.buildFactoryId
  const sourceFactoryName = scope.settlementPartyLabel
  const postFactoryName = 'HiGood 后道工厂'

  return DEMO_SETTLEMENT_ORDER_BLUEPRINTS.map((blueprint, orderIndex) => {
    const taskUnitPrice = 42000 + orderIndex * 1500
    const qcOrders: DemoSettlementQcFact[] = blueprint.qcOrderIds.map((qcOrderId, qcIndex) => ({
      qcOrderId,
      qcOrderNo: qcOrderId,
      inspectedAt: getDemoBuildTimestamp(`1${qcIndex}:30:00`),
      inspector: `后道质检员 ${qcIndex + 1}`,
      sourceFactoryName,
      postFactoryName,
      skuFacts: buildDemoQcSkuFacts({
        poKey: blueprint.poKey,
        qcIndex,
        sourceFactoryName,
        postFactoryName,
      }),
    }))

    const earningLedgers: PreSettlementLedger[] = blueprint.ledgerIds.slice(0, 2).map((ledgerId, ledgerIndex) => {
      const qty = blueprint.earningQtys[ledgerIndex]
      const amount = qty * taskUnitPrice
      return {
        ledgerId,
        ledgerNo: ledgerId,
        ledgerType: 'TASK_EARNING',
        direction: 'INCOME',
        sourceType: 'RETURN_INBOUND_BATCH',
        sourceRefId: `RIB-${blueprint.poKey}-${ledgerIndex + 1}`,
        factoryId,
        factoryName: sourceFactoryName,
        taskId: `TASK-${blueprint.poKey}-${ledgerIndex + 1}`,
        taskNo: `车缝任务-${blueprint.poKey}-${ledgerIndex + 1}`,
        productionOrderId: blueprint.productionOrderId,
        productionOrderNo: blueprint.productionOrderNo,
        returnInboundBatchId: `RIB-${blueprint.poKey}-${ledgerIndex + 1}`,
        returnInboundBatchNo: `回货批次-${blueprint.poKey}-${ledgerIndex + 1}`,
        priceSourceType: 'DISPATCH',
        unitPrice: taskUnitPrice,
        qty,
        originalCurrency: 'IDR',
        originalAmount: amount,
        settlementCurrency: 'IDR',
        settlementAmount: amount,
        occurredAt: getDemoBuildTimestamp(`09:${ledgerIndex}0:00`),
        settlementCycleId: scope.settlementCycleId,
        settlementCycleLabel: scope.settlementCycleLabel,
        settlementCycleStartAt: scope.settlementCycleStartAt,
        settlementCycleEndAt: scope.settlementCycleEndAt,
        plannedPrepaymentAt: scope.plannedPrepaymentAt,
        settlementProfileVersionNo: 'SETTLE-MOCK-V1',
        status: 'OPEN',
        sourceReason: '按生产任务交出数量形成预结算流水',
        remark: '对象反查演示流水',
      }
    })

    const reworkLedgers: PreSettlementLedger[] = qcOrders.map((qcOrder, qcIndex) => {
      const qty = getQcReworkQty(qcOrder, 'POST_FACTORY')
      const amount = qty * (25000 + orderIndex * 1000 + qcIndex * 500)
      const ledgerId = blueprint.ledgerIds[qcIndex + 2]
      return {
        ledgerId,
        ledgerNo: ledgerId,
        ledgerType: 'QUALITY_DEDUCTION',
        direction: 'DEDUCTION',
        sourceType: 'QC_REWORK_CHARGEBACK',
        sourceRefId: qcOrder.qcOrderId,
        factoryId,
        factoryName: sourceFactoryName,
        taskId: `TASK-${blueprint.poKey}-QC-${qcIndex + 1}`,
        taskNo: `质检返工-${blueprint.poKey}-${qcIndex + 1}`,
        productionOrderId: blueprint.productionOrderId,
        productionOrderNo: blueprint.productionOrderNo,
        qcRecordId: qcOrder.qcOrderId,
        priceSourceType: 'OTHER_COMPAT',
        qty,
        originalCurrency: 'IDR',
        originalAmount: amount,
        settlementCurrency: 'IDR',
        settlementAmount: amount,
        occurredAt: qcOrder.inspectedAt,
        settlementCycleId: scope.settlementCycleId,
        settlementCycleLabel: scope.settlementCycleLabel,
        settlementCycleStartAt: scope.settlementCycleStartAt,
        settlementCycleEndAt: scope.settlementCycleEndAt,
        plannedPrepaymentAt: scope.plannedPrepaymentAt,
        settlementProfileVersionNo: 'SETTLE-MOCK-V1',
        status: 'OPEN',
        sourceReason: '后道质检单中返工接收对象为后道工厂，形成返工反扣预结算流水',
        remark: '返工到后道工厂，不重复计入原工厂交出，但需要反扣',
      }
    })

    return {
      productionOrderId: blueprint.productionOrderId,
      productionOrderNo: blueprint.productionOrderNo,
      cuttingCompletedQty: blueprint.cuttingCompletedQty,
      ledgers: [...earningLedgers, ...reworkLedgers],
      qcOrders,
    }
  })
}

function getDemoPreSettlementLedgers(): PreSettlementLedger[] {
  return getDemoSettlementOrders().flatMap((item) => item.ledgers)
}

function getDemoQcFactsByProductionOrderNo(productionOrderNo: string): DemoSettlementQcFact[] {
  return getDemoSettlementOrders().find((item) => item.productionOrderNo === productionOrderNo)?.qcOrders ?? []
}

function mapDemoLedgerToStatementSourceItem(ledger: PreSettlementLedger): StatementSourceItemViewModel {
  const isDeduction = ledger.ledgerType === 'QUALITY_DEDUCTION'
  const netAmount = isDeduction ? -ledger.settlementAmount : ledger.settlementAmount
  return {
    sourceItemId: ledger.ledgerId,
    ledgerNo: ledger.ledgerNo,
    sourceType: ledger.ledgerType,
    sourceLabelZh: isDeduction ? '返工扣款流水' : '任务收入流水',
    direction: ledger.direction,
    settlementPartyType: 'FACTORY',
    settlementPartyId: ledger.factoryId,
    settlementPartyLabel: ledger.factoryName,
    productionOrderId: ledger.productionOrderId,
    productionOrderNo: ledger.productionOrderNo,
    taskId: ledger.taskId,
    taskNo: ledger.taskNo,
    qty: ledger.qty,
    amount: ledger.settlementAmount,
    currency: ledger.settlementCurrency,
    sourceStatus: ledger.status,
    sourceStatusZh: '待入对账单',
    occurredAt: ledger.occurredAt,
    createdAt: ledger.occurredAt,
    updatedAt: ledger.occurredAt,
    routeToSource: isDeduction
      ? `/fcs/quality/qc-records/${encodeURIComponent(ledger.qcRecordId ?? '')}`
      : '/fcs/settlement/adjustments',
    canEnterStatement: ledger.status === 'OPEN',
    sourceReason: ledger.sourceReason,
    remark: ledger.remark,
    deductionLineType: isDeduction ? 'POST_FACTORY_REWORK_CHARGEBACK' : undefined,
    settlementCycleId: ledger.settlementCycleId,
    settlementCycleLabel: ledger.settlementCycleLabel,
    settlementCycleStartAt: ledger.settlementCycleStartAt,
    settlementCycleEndAt: ledger.settlementCycleEndAt,
    plannedPrepaymentAt: ledger.plannedPrepaymentAt,
    statementLineGrainType: isDeduction ? 'NON_BATCH_QUALITY' : 'RETURN_INBOUND_BATCH',
    returnInboundBatchId: ledger.returnInboundBatchId,
    returnInboundBatchNo: ledger.returnInboundBatchNo,
    returnInboundQty: ledger.qty,
    qcRecordId: ledger.qcRecordId,
    pendingDeductionRecordId: ledger.pendingDeductionRecordId,
    basisId: ledger.qcRecordId ?? ledger.ledgerId,
    disputeId: ledger.disputeId,
    processLabel: '后道质检',
    pricingSourceType: isDeduction ? 'NONE' : 'DISPATCH',
    pricingSourceRefId: ledger.sourceRefId,
    settlementUnitPrice: ledger.unitPrice,
    earningAmount: isDeduction ? 0 : ledger.settlementAmount,
    qualityDeductionAmount: isDeduction ? ledger.settlementAmount : 0,
    carryOverAdjustmentAmount: 0,
    otherAdjustmentAmount: 0,
    netAmount,
  }
}

function demoStatementSourceItemToDraftItem(item: StatementSourceItemViewModel): StatementDraftItem {
  return {
    ledgerNo: item.ledgerNo,
    sourceItemId: item.sourceItemId,
    sourceItemType: item.sourceType,
    direction: item.direction,
    sourceLabelZh: item.sourceLabelZh,
    sourceRefLabel: item.sourceItemId,
    routeToSource: item.routeToSource,
    settlementPartyType: item.settlementPartyType,
    settlementPartyId: item.settlementPartyId,
    basisId: item.basisId ?? item.sourceItemId,
    deductionQty: item.qty,
    deductionAmount: item.netAmount,
    currency: item.currency,
    remark: item.remark,
    deductionLineType: item.deductionLineType,
    sourceType: item.sourceType,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    taskId: item.taskId,
    taskNo: item.taskNo,
    settlementCycleId: item.settlementCycleId,
    settlementCycleLabel: item.settlementCycleLabel,
    settlementCycleStartAt: item.settlementCycleStartAt,
    settlementCycleEndAt: item.settlementCycleEndAt,
    plannedPrepaymentAt: item.plannedPrepaymentAt,
    settlementObjectMode: state.buildObjectMode,
    sourceConfirmedByStatement: true,
    statementLineGrainType: item.statementLineGrainType,
    returnInboundBatchId: item.returnInboundBatchId,
    returnInboundBatchNo: item.returnInboundBatchNo,
    returnInboundQty: item.returnInboundQty,
    qcRecordId: item.qcRecordId,
    pendingDeductionRecordId: item.pendingDeductionRecordId,
    disputeId: item.disputeId,
    processLabel: item.processLabel,
    pricingSourceType: item.pricingSourceType === 'NONE' ? 'NONE' : item.pricingSourceType,
    pricingSourceRefId: item.pricingSourceRefId,
    settlementUnitPrice: item.settlementUnitPrice,
    earningAmount: item.earningAmount,
    qualityDeductionAmount: item.qualityDeductionAmount,
    carryOverAdjustmentAmount: item.carryOverAdjustmentAmount,
    otherAdjustmentAmount: item.otherAdjustmentAmount,
    netAmount: item.netAmount,
    occurredAt: item.occurredAt ?? item.createdAt,
  }
}

function buildDemoStatementDraftLines(projections: ProductionOrderSettlementProjection[]): StatementDraftItem[] {
  const demoLedgers = getDemoPreSettlementLedgers()
  const selectedLedgers =
    state.buildObjectMode === 'LEDGER'
      ? demoLedgers.filter((item) => getEffectiveSelectedLedgerIds().includes(item.ledgerId))
      : demoLedgers.filter((item) =>
          getEffectiveSelectedProductionOrderNos(projections).includes(item.productionOrderNo ?? ''),
        )
  return selectedLedgers.map((item) => demoStatementSourceItemToDraftItem(mapDemoLedgerToStatementSourceItem(item)))
}

function buildDemoProductionOrderProjections(): ProductionOrderSettlementProjection[] {
  return getDemoSettlementOrders().map((order) => {
    const defectReasonQtyByName = order.qcOrders.reduce<Record<string, number>>((map, qcOrder) => {
      for (const sku of qcOrder.skuFacts) {
        for (const [reasonName, qty] of Object.entries(sku.defectReasonQtyByName)) {
          map[reasonName] = (map[reasonName] ?? 0) + qty
        }
      }
      return map
    }, {})
    const normalHandoverQty = order.ledgers
      .filter((item) => item.ledgerType === 'TASK_EARNING')
      .reduce((sum, item) => sum + item.qty, 0)
    const originalFactoryReworkQty = order.qcOrders.reduce((sum, item) => sum + getQcReworkQty(item, 'ORIGINAL_FACTORY'), 0)
    const postFactoryReworkQty = order.qcOrders.reduce((sum, item) => sum + getQcReworkQty(item, 'POST_FACTORY'), 0)
    const settlementHandoverQty = normalHandoverQty + postFactoryReworkQty
    const shortageQty = Math.max(0, order.cuttingCompletedQty - settlementHandoverQty)
    const defectQty = Object.values(defectReasonQtyByName).reduce((sum, qty) => sum + qty, 0)
    const sewingFactoryLiabilityDefectQty = Object.entries(defectReasonQtyByName)
      .filter(([reasonName]) => isSewingFactoryLiabilityReason(reasonName))
      .reduce((sum, [, qty]) => sum + qty, 0)
    const isComplete = shortageQty === 0

    return {
      productionOrderNo: order.productionOrderNo,
      productionOrderId: order.productionOrderId,
      cuttingCompletedQty: order.cuttingCompletedQty,
      normalHandoverQty,
      originalFactoryReworkQty,
      postFactoryReworkQty,
      settlementHandoverQty,
      shortageQty,
      isComplete,
      defectQty,
      sewingFactoryLiabilityDefectQty,
      defectReasonQtyByName,
      includedInStatement: isComplete,
      excludedReason: isComplete ? undefined : `差 ${shortageQty} 件`,
      handoverDetailLines: [
        ...order.ledgers.map((ledger) => ({
          recordId: ledger.returnInboundBatchNo ?? ledger.ledgerNo,
          handedOverAt: ledger.occurredAt,
          handedOverQty: ledger.ledgerType === 'TASK_EARNING' ? ledger.qty : 0,
          qcOrderId: ledger.qcRecordId,
          reworkQty: ledger.ledgerType === 'QUALITY_DEDUCTION' ? ledger.qty : undefined,
          reworkReceiveObject: ledger.ledgerType === 'QUALITY_DEDUCTION' ? 'POST_FACTORY' as const : undefined,
        })),
      ],
    }
  })
}

function getEditingDraft(): StatementDraft | null {
  if (!state.editingStatementId) return null
  return getStatementDraftById(state.editingStatementId)
}

function resetAppealResolutionState(): void {
  state.processingAppealStatementId = null
  state.appealResolutionResult = ''
  state.appealResolutionComment = ''
}

function resetProxyConfirmationState(): void {
  state.proxyConfirmStatementId = null
  state.proxyConfirmReason = ''
  state.proxyConfirmMethod = ''
  state.proxyConfirmRemark = ''
  state.proxyConfirmNotificationStatus = 'NOTIFIED'
  state.proxyConfirmNotificationRemark = '已在三方工厂端展示跟单审核代确认结果'
}

function canProxyConfirmStatement(draft: StatementDraft): boolean {
  return (
    draft.status === 'PENDING_FACTORY_CONFIRM' &&
    draft.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM' &&
    !getOpenStatementAppeal(draft)
  )
}

function renderConfirmationSourceText(draft: StatementDraft | StatementListItemViewModel): string {
  return getStatementConfirmationSourceLabel(draft)
}

function renderProxyConfirmationSummary(draft: StatementDraft): string {
  if (!isStatementProxyConfirmed(draft)) return ''
  const appealed = draft.factoryFeedbackStatus === 'FACTORY_APPEALED'
  return `
    <div class="rounded-md border ${appealed ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'} px-3 py-2 text-xs leading-5">
      该对账单已由跟单审核代确认。跟单：${escapeHtml(draft.proxyConfirmedBy ?? '-')}；
      时间：${escapeHtml(draft.proxyConfirmedAt ?? '-')}；
      方式：${escapeHtml(getProxyConfirmationMethodLabel(draft.proxyConfirmMethod))}；
      通知：${escapeHtml(getProxyNotificationStatusLabel(draft.proxyConfirmNotificationStatus))}。
      ${appealed ? '三方工厂已对代确认结果提出异议，平台处理前不会继续进入预付款。' : '三方工厂端会看到该确认来源。'}
    </div>
  `
}

function renderStatementAuditLogList(draft: StatementDraft): string {
  const logs = (draft.statementAuditLogs ?? []).slice().reverse()
  if (!logs.length) {
    return '<p class="rounded-md border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">当前暂无操作日志。</p>'
  }

  return logs
    .map(
      (log) => `
        <div class="rounded-md border bg-muted/20 p-3 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-medium text-foreground">${escapeHtml(log.action)}</span>
            <span class="text-muted-foreground">${escapeHtml(log.operatedAt)}</span>
          </div>
          <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(log.actor)}</div>
          <div class="mt-1 text-muted-foreground">状态：${escapeHtml(log.fromStatus ? STATUS_ZH[log.fromStatus] : '-')} -> ${escapeHtml(log.toStatus ? STATUS_ZH[log.toStatus] : '-')}</div>
          <div class="mt-1 text-muted-foreground">工厂反馈：${escapeHtml(log.fromFactoryFeedbackStatus ? getFactoryFeedbackStatusLabel(log.fromFactoryFeedbackStatus) : '-')} -> ${escapeHtml(log.toFactoryFeedbackStatus ? getFactoryFeedbackStatusLabel(log.toFactoryFeedbackStatus) : '-')}</div>
          ${log.reason ? `<div class="mt-1 text-muted-foreground">原因：${escapeHtml(log.reason)}</div>` : ''}
          ${log.method ? `<div class="mt-1 text-muted-foreground">线下确认方式：${escapeHtml(getProxyConfirmationMethodLabel(log.method))}</div>` : ''}
          ${log.notificationStatus ? `<div class="mt-1 text-muted-foreground">通知状态：${escapeHtml(getProxyNotificationStatusLabel(log.notificationStatus))}</div>` : ''}
          ${log.notificationRemark ? `<div class="mt-1 text-muted-foreground">通知说明：${escapeHtml(log.notificationRemark)}</div>` : ''}
          ${log.remark ? `<div class="mt-1 text-muted-foreground">备注：${escapeHtml(log.remark)}</div>` : ''}
        </div>
      `,
    )
    .join('')
}

function getBuildCandidates(): StatementSourceItemViewModel[] {
  const editingDraft = getEditingDraft()
  if (editingDraft) {
    return editingDraft.itemSourceIds
      ?.map((itemId) => {
        const sourceItem = getStatementSourceItemById(itemId)
        if (sourceItem) return sourceItem
        const demoLedger = getDemoPreSettlementLedgers().find((item) => item.ledgerId === itemId)
        return demoLedger ? mapDemoLedgerToStatementSourceItem(demoLedger) : null
      })
      .filter(Boolean) as StatementSourceItemViewModel[]
  }

  if (!isBuildRangeReady()) return []
  return getBuildRangeLedgers()
    .map((item) => getStatementSourceItemById(item.ledgerId) ?? mapDemoLedgerToStatementSourceItem(item))
    .filter(Boolean) as StatementSourceItemViewModel[]
}

function isBuildRangeReady(): boolean {
  return Boolean(state.buildFactoryId && state.buildStartDate && state.buildEndDate)
}

function isBuildRangeValid(): boolean {
  return isBuildRangeReady() && state.buildStartDate <= state.buildEndDate
}

function getBuildRangeLedgers(): PreSettlementLedger[] {
  if (!isBuildRangeValid()) return []
  const realLedgers = listStatementEligiblePreSettlementLedgersByRange({
    factoryId: state.buildFactoryId,
    occurredFrom: state.buildStartDate,
    occurredTo: state.buildEndDate,
  })
  const realLedgerIds = new Set(realLedgers.map((item) => item.ledgerId))
  const demoLedgers = getDemoPreSettlementLedgers().filter((item) => !realLedgerIds.has(item.ledgerId))
  return [...realLedgers, ...demoLedgers]
}

function getEffectiveBuildCurrency(): SettlementCurrency | null {
  return 'IDR'
}

function getBuildCurrencyDisplayText(_effectiveCurrency: SettlementCurrency | null): string {
  return 'IDR'
}

function parseManualDeductionAmount(value: string): number {
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

function toManualDeductionIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, '-')
}

function getBuildProductionOrderTimingAssist(productionOrderNo: string): { startTime: string; lastHandoverTime: string } {
  const ledgers = getBuildRangeLedgers().filter((item) => item.productionOrderNo === productionOrderNo)
  const times = ledgers.map((item) => item.occurredAt).filter(Boolean).sort()
  const handoverTimes = ledgers
    .filter((item) => item.ledgerType === 'TASK_EARNING')
    .map((item) => item.occurredAt)
    .filter(Boolean)
    .sort()
  return {
    startTime: times[0] ?? '—',
    lastHandoverTime: handoverTimes[handoverTimes.length - 1] ?? '—',
  }
}

function clearBuildManualDeductions(): void {
  state.manualDefectProductionOrderDeductions = {}
  state.manualDelayProductionOrderDeductions = {}
}

function getEmptyManualDeductionInput(): ManualDeductionInput {
  return { amount: '', remark: '' }
}

function getManualDefectProductionOrderDeduction(
  productionOrderNo: string,
  reasonName: string,
): ManualDeductionInput {
  return state.manualDefectProductionOrderDeductions[productionOrderNo]?.[reasonName] ?? getEmptyManualDeductionInput()
}

function setManualDefectProductionOrderDeduction(
  productionOrderNo: string,
  reasonName: string,
  patch: Partial<ManualDeductionInput>,
): void {
  const currentByReason = state.manualDefectProductionOrderDeductions[productionOrderNo] ?? {}
  const current = currentByReason[reasonName] ?? getEmptyManualDeductionInput()
  state.manualDefectProductionOrderDeductions = {
    ...state.manualDefectProductionOrderDeductions,
    [productionOrderNo]: {
      ...currentByReason,
      [reasonName]: { ...current, ...patch },
    },
  }
}

function getManualDelayProductionOrderDeduction(productionOrderNo: string): ManualDeductionInput {
  return state.manualDelayProductionOrderDeductions[productionOrderNo] ?? getEmptyManualDeductionInput()
}

function setManualDelayProductionOrderDeduction(
  productionOrderNo: string,
  patch: Partial<ManualDeductionInput>,
): void {
  const current = getManualDelayProductionOrderDeduction(productionOrderNo)
  state.manualDelayProductionOrderDeductions = {
    ...state.manualDelayProductionOrderDeductions,
    [productionOrderNo]: { ...current, ...patch },
  }
}

function getSelectedProductionOrderNosForQc(projections: ProductionOrderSettlementProjection[]): string[] {
  if (state.buildObjectMode === 'PRODUCTION_ORDER') {
    const selected = new Set(getEffectiveSelectedProductionOrderNos(projections))
    return projections
      .filter((item) => selected.has(item.productionOrderNo) && item.isComplete)
      .map((item) => item.productionOrderNo)
  }

  const selectedLedgerIds = new Set(getEffectiveSelectedLedgerIds())
  return Array.from(
    new Set(
      getBuildRangeLedgers()
        .filter((item) => selectedLedgerIds.has(item.ledgerId))
        .map((item) => item.productionOrderNo)
        .filter(Boolean),
    ),
  ) as string[]
}

function getIncludedBuildProjections(projections: ProductionOrderSettlementProjection[]): ProductionOrderSettlementProjection[] {
  const productionOrderNos = new Set(getSelectedProductionOrderNosForQc(projections))
  return projections.filter((item) => productionOrderNos.has(item.productionOrderNo))
}

function getBuildQcReasonSummariesByProductionOrder(
  projections: ProductionOrderSettlementProjection[],
): BuildQcReasonProductionOrderSummary[] {
  return getIncludedBuildProjections(projections)
    .flatMap((projection) =>
      Object.entries(projection.defectReasonQtyByName)
        .filter(([reasonName, qty]) => isSewingFactoryLiabilityReason(reasonName) && qty > 0)
        .map(([reasonName, qty]) => ({
          productionOrderNo: projection.productionOrderNo,
          productionOrderId: projection.productionOrderId,
          reasonName,
          qty,
        })),
    )
    .sort((left, right) => {
      if (left.productionOrderNo !== right.productionOrderNo) {
        return left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
      }
      const leftIndex = SEWING_FACTORY_LIABILITY_REASONS.indexOf(left.reasonName as (typeof SEWING_FACTORY_LIABILITY_REASONS)[number])
      const rightIndex = SEWING_FACTORY_LIABILITY_REASONS.indexOf(right.reasonName as (typeof SEWING_FACTORY_LIABILITY_REASONS)[number])
      return leftIndex === rightIndex ? left.reasonName.localeCompare(right.reasonName, 'zh-CN') : leftIndex - rightIndex
    })
}

function buildManualStatementDeductionLines(
  scope: StatementBuildScopeViewModel,
  occurredAt: string,
): StatementDraftItem[] {
  const baseId = [
    state.buildFactoryId || scope.settlementPartyId,
    state.buildStartDate || scope.settlementCycleStartAt,
    state.buildEndDate || scope.settlementCycleEndAt,
    state.buildObjectMode,
  ].join('-').replace(/[^A-Za-z0-9-]/g, '-')
  const defectInputs = getBuildQcReasonSummariesByProductionOrder(getBuildProductionOrderProjections()).map(
    (summary, index) => {
      const input = getManualDefectProductionOrderDeduction(summary.productionOrderNo, summary.reasonName)
      return {
        id: `MANUAL-DEFECT-${toManualDeductionIdPart(summary.productionOrderNo)}-${String(index + 1).padStart(2, '0')}-${baseId}`,
        label: `${summary.productionOrderNo} ${summary.reasonName}扣款`,
        productionOrderNo: summary.productionOrderNo,
        productionOrderId: summary.productionOrderId,
        lineType: 'QUALITY_DEFECT' as const,
        amount: parseManualDeductionAmount(input.amount),
        qty: summary.qty,
        remark: input.remark.trim() || `业务人员填写${summary.productionOrderNo} ${summary.reasonName}瑕疵扣款`,
      }
    },
  )
  const delayInputs = getIncludedBuildProjections(getBuildProductionOrderProjections()).map((projection) => {
    const input = getManualDelayProductionOrderDeduction(projection.productionOrderNo)
    return {
      id: `MANUAL-DELAY-${toManualDeductionIdPart(projection.productionOrderNo)}-${baseId}`,
      label: `${projection.productionOrderNo} 延误扣款`,
      productionOrderNo: projection.productionOrderNo,
      productionOrderId: projection.productionOrderId,
      lineType: 'DELAY' as const,
      amount: parseManualDeductionAmount(input.amount),
      qty: 0,
      remark: input.remark.trim() || `业务人员根据${projection.productionOrderNo}开始时间和最后交出时间填写延误扣款`,
    }
  })
  const inputs = [...defectInputs, ...delayInputs]

  return inputs.flatMap((input) => {
    if (input.amount <= 0) return []
    return [{
      sourceItemId: input.id,
      sourceItemType: 'QUALITY_DEDUCTION',
      direction: 'DEDUCTION',
      sourceLabelZh: input.label,
      sourceRefLabel: '对账单内手工填写',
      routeToSource: '/fcs/settlement/statements',
      settlementPartyType: scope.settlementPartyType,
      settlementPartyId: scope.settlementPartyId,
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderNo,
      basisId: input.id,
      deductionLineType: input.lineType,
      deductionQty: input.qty,
      deductionAmount: -input.amount,
      currency: 'IDR',
      remark: input.remark,
      sourceType: 'QUALITY_DEDUCTION',
      settlementCycleId: scope.settlementCycleId,
      settlementCycleLabel: scope.settlementCycleLabel,
      settlementCycleStartAt: scope.settlementCycleStartAt,
      settlementCycleEndAt: scope.settlementCycleEndAt,
      plannedPrepaymentAt: scope.plannedPrepaymentAt,
      settlementObjectMode: state.buildObjectMode,
      statementLineGrainType: 'NON_BATCH_ADJUSTMENT',
      pricingSourceType: 'NONE',
      earningAmount: 0,
      qualityDeductionAmount: input.amount,
      carryOverAdjustmentAmount: 0,
      otherAdjustmentAmount: 0,
      netAmount: -input.amount,
      occurredAt,
      sourceConfirmedByStatement: true,
    }]
  })
}

function getBuildProductionOrderProjections(): ProductionOrderSettlementProjection[] {
  if (!isBuildRangeValid()) return []
  const realProjections = buildProductionOrderSettlementProjections({
    factoryId: state.buildFactoryId,
    occurredFrom: state.buildStartDate,
    occurredTo: state.buildEndDate,
  })
  const realProductionOrderNos = new Set(realProjections.map((item) => item.productionOrderNo))
  const demoProjections = buildDemoProductionOrderProjections().filter(
    (item) => !realProductionOrderNos.has(item.productionOrderNo),
  )
  return [...realProjections, ...demoProjections]
}

function getEffectiveSelectedProductionOrderNos(projections: ProductionOrderSettlementProjection[]): string[] {
  return state.selectedProductionOrderNos.length
    ? state.selectedProductionOrderNos
    : projections.filter((item) => item.isComplete).map((item) => item.productionOrderNo)
}

function getEffectiveSelectedLedgerIds(): string[] {
  return state.selectedLedgerIds.length ? state.selectedLedgerIds : getBuildRangeLedgers().map((item) => item.ledgerId)
}

function toBuildLineViewModel(item: StatementDraftItem): StatementDetailLineViewModel {
  return {
    ...item,
    lineTypeZh: LINE_GRAIN_LABEL[item.statementLineGrainType ?? 'OTHER_SOURCE_OBJECT'] ?? '其它来源行',
    sourceTypeZh:
      item.sourceLabelZh ??
      (item.sourceItemType === 'TASK_EARNING'
        ? '任务收入流水'
        : item.sourceItemType === 'QUALITY_DEDUCTION'
          ? '返工扣款流水'
          : '正式流水'),
    productionOrderNoDisplay: item.productionOrderNo ?? item.productionOrderId ?? '-',
    taskNoDisplay: item.taskNo ?? item.taskId ?? '-',
    routeToSourceResolved: item.routeToSource ?? '/fcs/settlement/statements',
  }
}

function getBuildLines(
  scopes: StatementBuildScopeViewModel[],
): StatementDetailLineViewModel[] {
  const editingDraft = getEditingDraft()
  if (editingDraft) {
    return getStatementDetailViewModel(editingDraft.statementId)?.lines ?? []
  }

  const selectedScope = getSelectedBuildScope(scopes)
  if (!selectedScope) return []
  if (!isBuildRangeValid()) return []
  const projections = getBuildProductionOrderProjections()
  const lines = buildStatementDraftLinesFromSettlementSelection({
    factoryId: state.buildFactoryId,
    occurredFrom: state.buildStartDate,
    occurredTo: state.buildEndDate,
    objectMode: state.buildObjectMode,
    selectedLedgerIds: state.buildObjectMode === 'LEDGER' ? getEffectiveSelectedLedgerIds() : state.selectedLedgerIds,
    selectedProductionOrderNos:
      state.buildObjectMode === 'PRODUCTION_ORDER'
        ? getEffectiveSelectedProductionOrderNos(projections)
        : state.selectedProductionOrderNos,
  })
  const demoLines = buildDemoStatementDraftLines(projections)
  const manualLines = buildManualStatementDeductionLines(selectedScope, state.buildEndDate ? `${state.buildEndDate} 23:59:59` : nowTimestamp())
  return [...lines, ...demoLines, ...manualLines].map(toBuildLineViewModel)
}

function getBuildLineSummary(lines: Array<StatementDraftItem | StatementDetailLineViewModel>) {
  return {
    earningCount: lines.filter((item) => item.sourceItemType === 'TASK_EARNING').length,
    deductionCount: lines.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION').length,
    totalQty: lines.reduce((sum, item) => sum + (item.returnInboundQty ?? item.deductionQty ?? 0), 0),
    totalEarningAmount: lines.reduce((sum, item) => sum + (item.earningAmount ?? 0), 0),
    totalQualityDeductionAmount: lines.reduce((sum, item) => sum + (item.qualityDeductionAmount ?? 0), 0),
    netPayableAmount: lines.reduce((sum, item) => sum + (item.netAmount ?? item.deductionAmount), 0),
  }
}

function openBuildView(scopes: StatementBuildScopeViewModel[], statement?: StatementDraft | null): void {
  state.activeView = 'BUILD'
  resetAppealResolutionState()

  if (statement) {
    state.editingStatementId = statement.statementId
    state.buildTab = 'SCOPE'
    state.buildFactoryId = statement.settlementPartyId
    state.buildCycleId = statement.settlementCycleId ?? ''
    state.buildStartDate = statement.settlementRangeStartAt ?? statement.settlementCycleStartAt ?? ''
    state.buildEndDate = statement.settlementRangeEndAt ?? statement.settlementCycleEndAt ?? ''
    state.buildObjectMode = statement.settlementObjectMode ?? 'LEDGER'
    state.buildCurrency = (statement.settlementCurrency ?? 'IDR') as SettlementCurrency
    state.selectedLedgerIds = []
    state.selectedProductionOrderNos = []
    state.buildRemark = statement.remark ?? ''
    clearBuildManualDeductions()
    return
  }

  const firstScope = scopes[0]
  state.editingStatementId = null
  state.buildTab = 'SCOPE'
  state.buildFactoryId = firstScope?.settlementPartyId ?? ''
  state.buildCycleId = firstScope?.settlementCycleId ?? ''
  state.buildStartDate = ''
  state.buildEndDate = ''
  state.buildObjectMode = 'PRODUCTION_ORDER'
  state.buildCurrency = 'IDR'
  state.selectedLedgerIds = []
  state.selectedProductionOrderNos = []
  state.buildRemark = ''
  clearBuildManualDeductions()
}

function resetBuildState(scopes: StatementBuildScopeViewModel[]): void {
  const firstScope = scopes[0]
  state.editingStatementId = null
  state.buildTab = 'SCOPE'
  state.buildFactoryId = firstScope?.settlementPartyId ?? ''
  state.buildCycleId = firstScope?.settlementCycleId ?? ''
  state.buildStartDate = ''
  state.buildEndDate = ''
  state.buildObjectMode = 'PRODUCTION_ORDER'
  state.buildCurrency = 'IDR'
  state.selectedLedgerIds = []
  state.selectedProductionOrderNos = []
  state.buildRemark = ''
  clearBuildManualDeductions()
}

function createStatementDraftFromScope(
  scope: StatementBuildScopeViewModel,
  remark: string,
  by: string,
): { ok: boolean; message?: string; statementId?: string; existingStatementId?: string } {
  if (!state.buildStartDate || !state.buildEndDate) return { ok: false, message: '请先选择对账时间段' }
  if (!isBuildRangeValid()) return { ok: false, message: '开始日期不能晚于结束日期' }
  const effectiveCurrency = getEffectiveBuildCurrency()
  if (effectiveCurrency === null) {
    return { ok: false, message: '当前时间段存在多个币种，请拆分时间段或按币种分别生成' }
  }

  const projections = getBuildProductionOrderProjections()
  const selectedProductionOrderNos =
    state.buildObjectMode === 'PRODUCTION_ORDER'
      ? getEffectiveSelectedProductionOrderNos(projections)
      : state.selectedProductionOrderNos
  const selectedLedgerIds = state.buildObjectMode === 'LEDGER' ? getEffectiveSelectedLedgerIds() : state.selectedLedgerIds
  const baseLines = buildStatementDraftLinesFromSettlementSelection({
    factoryId: state.buildFactoryId,
    occurredFrom: state.buildStartDate,
    occurredTo: state.buildEndDate,
    objectMode: state.buildObjectMode,
    selectedLedgerIds,
    selectedProductionOrderNos,
  })
  const demoLines = buildDemoStatementDraftLines(projections)
  const timestamp = nowTimestamp()
  const manualLines = buildManualStatementDeductionLines(scope, timestamp)
  const lines = [...baseLines, ...demoLines, ...manualLines]
  if (!lines.length) return { ok: false, message: '当前工厂和时间段暂无可生成的对账明细行' }

  const productionOrderSettlementSnapshots =
    state.buildObjectMode === 'PRODUCTION_ORDER'
      ? projections
          .filter((item) => selectedProductionOrderNos.includes(item.productionOrderNo) && item.isComplete)
          .map(toStatementProductionOrderSnapshot)
      : []
  const month = timestamp.slice(0, 7).replace('-', '')
  let statementId = `ST-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialStatementDrafts.some((item) => item.statementId === statementId)) {
    statementId = `ST-${month}-${randomSuffix(4)}`
  }
  const result = createStatementFromEligibleLedgers({
    statementId,
    settlementPartyType: scope.settlementPartyType,
    settlementPartyId: scope.settlementPartyId,
    settlementPartyLabel: scope.settlementPartyLabel,
    settlementCycleId: scope.settlementCycleId,
    settlementCycleLabel: scope.settlementCycleLabel,
    settlementCycleStartAt: scope.settlementCycleStartAt,
    settlementCycleEndAt: scope.settlementCycleEndAt,
    settlementRangeStartAt: state.buildStartDate,
    settlementRangeEndAt: state.buildEndDate,
    settlementObjectMode: state.buildObjectMode,
    settlementCurrency: effectiveCurrency,
    productionOrderSettlementSnapshots,
    plannedPrepaymentAt: scope.plannedPrepaymentAt,
    itemSourceIds: lines.map((item) => item.sourceItemId).filter(Boolean) as string[],
    itemBasisIds: lines
      .filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION')
      .map((item) => item.sourceItemId ?? item.basisId)
      .filter(Boolean) as string[],
    items: lines,
    remark,
    by,
    at: timestamp,
  })
  return {
    ok: result.ok,
    message: result.message,
    existingStatementId: result.existingStatementId,
    statementId: result.data?.statementId,
  }
}

function confirmStatementDraft(statementId: string, by: string): { ok: boolean; message?: string } {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return { ok: false, message: `对账单 ${statementId} 不存在` }
  if (draft.status === 'PENDING_FACTORY_CONFIRM' || draft.status === 'READY_FOR_PREPAYMENT') return { ok: true }
  if (draft.status === 'CLOSED') return { ok: false, message: '已关闭的对账单不可确认' }

  draft.status = 'PENDING_FACTORY_CONFIRM'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  draft.sentToFactoryAt = draft.updatedAt
  draft.factoryFeedbackStatus = 'PENDING_FACTORY_CONFIRM'
  draft.factoryFeedbackAt = draft.updatedAt
  draft.factoryFeedbackBy = by
  draft.factoryFeedbackRemark = '平台已确认正式流水汇总口径，等待工厂反馈'
  return { ok: true }
}

function closeStatementDraft(statementId: string, by: string): { ok: boolean; message?: string } {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return { ok: false, message: `对账单 ${statementId} 不存在` }
  if (draft.status !== 'DRAFT') return { ok: false, message: '当前仅草稿可关闭' }

  draft.status = 'CLOSED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  return { ok: true }
}

function renderStatementListRows(items: StatementListItemViewModel[]): string {
  return items
    .map((item) => {
      const draft = getStatementDraftById(item.statementId)
      const canProxyConfirm = draft ? canProxyConfirmStatement(draft) : false
      const proxyConfirmed = draft ? isStatementProxyConfirmed(draft) : item.confirmationSource === 'MERCHANDISER_PROXY_CONFIRMATION'
      const statusLabel = getStatementDisplayStatusLabel(item)
      const statusBadgeClass = getStatementDisplayStatusBadgeClass(item)
      const prepaymentReadyText = isStatementFinancePendingDisplay(item)
        ? '待财务处理'
        : item.prepaymentBatchNo
          ? `${item.prepaymentBatchNo} · ${item.prepaymentBatchStatus === 'CLOSED' ? '已关闭' : item.prepaymentBatchStatus === 'PREPAID' ? '已预付' : '批次处理中'}`
          : isStatementReadyForPrepaymentDisplay(item)
            ? '已准备'
            : '未准备'

      return `
        <tr class="border-b last:border-b-0">
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementNo)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementPartyLabel)}</td>
          <td class="px-4 py-3 text-xs">
            <div>${escapeHtml(item.settlementCycleLabel ?? '-')}</div>
            <div class="mt-1 text-[10px] text-muted-foreground">计划预付款：${escapeHtml(item.plannedPrepaymentAt ?? '-')}</div>
          </td>
          <td class="px-4 py-3 text-xs">IDR</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${statusBadgeClass}">${escapeHtml(statusLabel)}</span>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${getFactoryFeedbackStatusBadge(item.factoryFeedbackStatus)}">${escapeHtml(
              getFactoryFeedbackStatusLabel(item.factoryFeedbackStatus),
            )}</span>
            <div class="mt-1 text-[10px] ${item.confirmationSource === 'MERCHANDISER_PROXY_CONFIRMATION' ? 'text-blue-700' : 'text-muted-foreground'}">${escapeHtml(renderConfirmationSourceText(item))}</div>
          </td>
          <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
          <td class="px-4 py-3 text-right tabular-nums">${item.totalQty}</td>
          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.totalEarningAmount)}</td>
          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.totalDeductionAmount)}</td>
          <td class="px-4 py-3 text-right font-medium tabular-nums">${formatAmount(item.netPayableAmount)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.createdAt)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementProfileVersionNo)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.maskedAccountTail)}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(prepaymentReadyText)}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${item.hasFactoryAppeal ? '有申诉' : '无申诉'}</td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1">
              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="open-detail" data-statement-id="${escapeHtml(item.statementId)}">查看详情</button>
              ${
                item.status === 'DRAFT'
                  ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="edit-draft" data-statement-id="${escapeHtml(item.statementId)}">继续编辑</button>`
                  : ''
              }
              ${
                item.status === 'DRAFT'
                  ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="close-draft" data-statement-id="${escapeHtml(item.statementId)}">关闭</button>`
                  : ''
              }
              ${
                item.hasFactoryAppeal
                  ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="open-detail" data-statement-id="${escapeHtml(item.statementId)}">查看工厂反馈</button>`
                  : ''
              }
              ${
                canProxyConfirm
                  ? `<button class="inline-flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700 hover:bg-blue-100" data-stm-action="open-proxy-confirm" data-statement-id="${escapeHtml(item.statementId)}">跟单审核代确认</button>`
                  : ''
              }
              ${
                proxyConfirmed
                  ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-50" data-stm-action="open-detail" data-statement-id="${escapeHtml(item.statementId)}">查看代确认记录</button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderStatementListPagination(total: number): string {
  if (total === 0) return ''

  const totalPages = getStatementListPageCount(total)
  const currentPage = getCurrentStatementListPage(total)
  const start = (currentPage - 1) * state.listPageSize + 1
  const end = Math.min(total, currentPage * state.listPageSize)

  return `
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div class="text-xs text-muted-foreground">共 ${total} 条，当前显示 ${start}-${end} 条</div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          每页
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-stm-list-filter="page-size">
            ${STATEMENT_LIST_PAGE_SIZE_OPTIONS.map(
              (size) => `<option value="${size}" ${state.listPageSize === size ? 'selected' : ''}>${size} 条</option>`,
            ).join('')}
          </select>
        </label>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-stm-action="prev-list-page" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
        <div class="flex items-center gap-1">
          ${Array.from({ length: totalPages }, (_, index) => index + 1)
            .map(
              (page) => `
                <button class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs ${
                  page === currentPage ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'
                }" data-stm-action="set-list-page" data-page="${page}">
                  ${page}
                </button>
              `,
            )
            .join('')}
        </div>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-stm-action="next-list-page" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderBuildCandidateRows(items: StatementSourceItemViewModel[]): string {
  if (!items.length) {
    return `<p class="py-6 text-center text-sm text-muted-foreground">当前工厂和时间段暂无可入单的正式流水。</p>`
  }

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[980px] text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">流水号</th>
            <th class="px-4 py-2 font-medium">流水类型</th>
            <th class="px-4 py-2 font-medium">任务号</th>
            <th class="px-4 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
            <th class="px-4 py-2 font-medium">回货批次号</th>
            <th class="px-4 py-2 font-medium">状态</th>
            <th class="px-4 py-2 text-right font-medium">数量</th>
            <th class="px-4 py-2 text-right font-medium">正式流水金额</th>
            <th class="px-4 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.ledgerNo ?? item.sourceItemId)}</td>
                  <td class="px-4 py-3 text-sm">${escapeHtml(item.sourceLabelZh)}</td>
                  <td class="px-4 py-3 text-xs">${escapeHtml(item.taskNo ?? item.taskId ?? '-')}</td>
                  <td class="px-4 py-3">${renderProductionOrderIdentityCell(item.productionOrderNo ?? item.productionOrderId ?? '-')}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.returnInboundBatchNo ?? '-')}</td>
                  <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.sourceStatusZh)}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${item.qty}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.amount)}</td>
                  <td class="px-4 py-3">
                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(item.routeToSource)}">查看来源对象</button>
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

function renderBuildLineRows(lines: StatementDetailLineViewModel[]): string {
  if (!lines.length) {
    return `<p class="py-6 text-center text-sm text-muted-foreground">当前工厂和时间段暂无可生成的正式流水明细行。</p>`
  }

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[1600px] text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">明细类型</th>
            <th class="px-4 py-2 font-medium">回货批次号</th>
            <th class="px-4 py-2 font-medium">任务号</th>
            <th class="px-4 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
            <th class="px-4 py-2 text-right font-medium">数量</th>
            <th class="px-4 py-2 font-medium">价格来源</th>
            <th class="px-4 py-2 text-right font-medium">单价</th>
            <th class="px-4 py-2 text-right font-medium">任务收入金额</th>
            <th class="px-4 py-2 text-right font-medium">质量扣款金额</th>
            <th class="px-4 py-2 text-right font-medium">本期应付净额</th>
            <th class="px-4 py-2 font-medium">查看依据</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3 text-xs">${escapeHtml(line.lineTypeZh)}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.returnInboundBatchNo ?? '-')}</td>
                  <td class="px-4 py-3 text-xs">${escapeHtml(line.taskNoDisplay)}</td>
                  <td class="px-4 py-3">${renderProductionOrderIdentityCell(line.productionOrderNoDisplay)}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${line.returnInboundQty ?? line.deductionQty ?? 0}</td>
                  <td class="px-4 py-3 text-xs">${escapeHtml(PRICE_SOURCE_LABEL[line.pricingSourceType ?? 'NONE'] ?? '不适用')}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${line.settlementUnitPrice == null ? '-' : formatAmount(line.settlementUnitPrice)}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${formatAmount(line.earningAmount ?? 0)}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${formatAmount(line.qualityDeductionAmount ?? 0)}</td>
                  <td class="px-4 py-3 text-right font-medium tabular-nums">${formatAmount(line.netAmount ?? line.deductionAmount)}</td>
                  <td class="px-4 py-3">
                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(line.routeToSourceResolved)}">查看来源详情</button>
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

function renderBuildTabNav(): string {
  const tabs = getStatementBuildTabs()
  return `
    <div class="mt-4 border-b">
      <div class="flex flex-wrap gap-2">
        ${tabs.map((tab, index) => {
          const active = state.buildTab === tab.key
          return `
            <button class="inline-flex min-h-12 items-center gap-2 border-b-2 px-3 py-2 text-left text-sm ${
              active
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
            }" data-stm-action="set-build-tab" data-build-tab="${tab.key}">
              <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px]">${index + 1}</span>
              <span>
                <span class="block font-medium">${escapeHtml(tab.label)}</span>
                <span class="block text-[11px]">${escapeHtml(tab.description)}</span>
              </span>
            </button>
          `
        }).join('')}
      </div>
    </div>
  `
}

function renderBuildScopeTab(input: {
  editingDraft: StatementDraft | null
  factoryOptions: Array<{ value: string; label: string }>
  selectedScope: StatementBuildScopeViewModel | null
  displayCurrency: string
  buildLines: StatementDetailLineViewModel[]
  buildSummary: ReturnType<typeof getBuildLineSummary>
  effectiveCurrency: SettlementCurrency | null
  blockingStatement: StatementDraft | null
}): string {
  const { editingDraft, factoryOptions, selectedScope, displayCurrency, buildLines, buildSummary, effectiveCurrency, blockingStatement } = input
  const canContinue = selectedScope != null && isBuildRangeValid() && effectiveCurrency !== null && !blockingStatement

  return `
    <section class="mt-4 rounded-lg border bg-muted/20 p-4">
      <h3 class="text-sm font-semibold">步骤 1：选择工厂、时间段和结算对象</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="grid gap-1 text-sm">
          <span class="text-muted-foreground">工厂</span>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="factory" ${editingDraft ? 'disabled' : ''}>
            <option value="">请选择工厂</option>
            ${factoryOptions
              .map(
                (item) => `<option value="${escapeHtml(item.value)}" ${state.buildFactoryId === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="text-muted-foreground">开始日期</span>
          <input type="date" class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="start-date" value="${escapeHtml(state.buildStartDate)}" ${editingDraft ? 'disabled' : ''} />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="text-muted-foreground">结束日期</span>
          <input type="date" class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="end-date" value="${escapeHtml(state.buildEndDate)}" ${editingDraft ? 'disabled' : ''} />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="text-muted-foreground">结算对象</span>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="object-mode" ${editingDraft ? 'disabled' : ''}>
            <option value="PRODUCTION_ORDER" ${state.buildObjectMode === 'PRODUCTION_ORDER' ? 'selected' : ''}>按生产单</option>
            <option value="LEDGER" ${state.buildObjectMode === 'LEDGER' ? 'selected' : ''}>按预结算流水</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="text-muted-foreground">结算币种</span>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="currency" disabled>
            <option value="IDR" selected>IDR</option>
          </select>
        </label>
      </div>
      <label class="mt-3 grid gap-1 text-sm">
        <span class="text-muted-foreground">备注</span>
        <textarea class="min-h-[84px] rounded-md border bg-background px-3 py-2 text-sm" data-stm-build-field="remark" data-skip-page-rerender="true" placeholder="说明当前对账单口径或需要关注的事项">${escapeHtml(state.buildRemark)}</textarea>
      </label>

      ${
        selectedScope
          ? `
            <div class="mt-4 rounded-md border bg-background p-3 text-sm">
              <div class="flex flex-wrap items-center gap-4">
                <span>工厂：<strong>${escapeHtml(selectedScope.settlementPartyLabel)}</strong></span>
                <span>对账范围：<strong>${escapeHtml(state.buildStartDate || '-')} ~ ${escapeHtml(state.buildEndDate || '-')}</strong></span>
                <span>结算对象：<strong>${state.buildObjectMode === 'PRODUCTION_ORDER' ? '按生产单' : '按预结算流水'}</strong></span>
                <span>结算币种：<strong>${escapeHtml(displayCurrency)}</strong></span>
                <span>参考周期：<strong>${escapeHtml(selectedScope.settlementCycleLabel)}</strong></span>
                <span>计划预付款：<strong>${escapeHtml(selectedScope.plannedPrepaymentAt ?? '-')}</strong></span>
                <span>当前明细行：<strong>${buildLines.length}</strong> 条</span>
                <span>当前净额：<strong>${formatAmount(buildSummary.netPayableAmount)}</strong></span>
              </div>
            </div>
          `
          : ''
      }

      ${
        isBuildRangeReady() && !isBuildRangeValid()
          ? '<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">开始日期不能晚于结束日期</div>'
          : ''
      }
      ${
        effectiveCurrency === null
          ? '<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">当前时间段存在多个币种，请拆分时间段或按币种分别生成</div>'
          : ''
      }
      ${
        blockingStatement
          ? `
            <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <div>该工厂该时间段和结算对象已存在未关闭对账单 <strong>${escapeHtml(blockingStatement.statementId)}</strong>，不能重复生成。</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button class="inline-flex h-8 items-center rounded-md border border-amber-300 bg-white px-3 text-xs hover:bg-amber-100" data-stm-action="open-existing-statement" data-statement-id="${escapeHtml(blockingStatement.statementId)}">查看已有单据</button>
                ${
                  blockingStatement.status === 'DRAFT'
                    ? `<button class="inline-flex h-8 items-center rounded-md border border-amber-300 bg-white px-3 text-xs hover:bg-amber-100" data-stm-action="edit-draft" data-statement-id="${escapeHtml(blockingStatement.statementId)}">继续编辑草稿</button>`
                    : ''
                }
              </div>
            </div>
          `
          : ''
      }

      <div class="mt-4 flex flex-wrap gap-2">
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" data-stm-action="set-build-tab" data-build-tab="OBJECTS" ${canContinue ? '' : 'disabled'}>${state.buildObjectMode === 'LEDGER' ? '下一步：预结算流水' : '下一步：对象反查'}</button>
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="back-to-list">取消</button>
      </div>
    </section>
  `
}

function renderBuildObjectsTab(
  projections: ProductionOrderSettlementProjection[],
  buildCandidates: StatementSourceItemViewModel[],
): string {
  if (state.buildObjectMode === 'LEDGER') {
    return `
      <section class="mt-4 rounded-lg border bg-card p-4">
        <div class="mb-3">
          <h3 class="text-sm font-semibold">预结算流水明细</h3>
          <p class="mt-1 text-xs text-muted-foreground">展示选择工厂和时间段内所有可入单预结算流水；下一步会根据这些流水关联的生产单汇总质检事实。</p>
        </div>
        ${renderBuildCandidateRows(buildCandidates)}
      </section>
      <div class="mt-4 flex flex-wrap gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="set-build-tab" data-build-tab="SCOPE">上一步</button>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="set-build-tab" data-build-tab="QC_DEDUCTIONS">下一步：质检扣款</button>
      </div>
    `
  }

  return `
    ${renderProductionOrderProjectionPanel(projections)}
    <div class="mt-4 flex flex-wrap gap-2">
      <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="set-build-tab" data-build-tab="SCOPE">上一步</button>
      <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="set-build-tab" data-build-tab="QC_DEDUCTIONS">下一步：质检扣款</button>
    </div>
  `
}

function renderBuildQcDeductionTab(
  projections: ProductionOrderSettlementProjection[],
  buildLines: StatementDetailLineViewModel[],
): string {
  const reasonRows = getBuildQcReasonSummariesByProductionOrder(projections)
  const includedProjections = getIncludedBuildProjections(projections)
  const reasonRowsByProductionOrder = new Map<string, BuildQcReasonProductionOrderSummary[]>()
  for (const row of reasonRows) {
    const rows = reasonRowsByProductionOrder.get(row.productionOrderNo) ?? []
    rows.push(row)
    reasonRowsByProductionOrder.set(row.productionOrderNo, rows)
  }
  const reworkLines = buildLines.filter(
    (line) =>
      line.sourceItemType === 'QUALITY_DEDUCTION' &&
      !line.sourceItemId.startsWith('MANUAL-') &&
      (line.deductionLineType === 'POST_FACTORY_REWORK_CHARGEBACK' || (line.sourceLabelZh ?? '').includes('返工')),
  )

  return `
    <section class="mt-4 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">质检事实与瑕疵扣款</h3>
          <p class="mt-1 text-xs text-muted-foreground">只汇总归属于车缝工厂的瑕疵原因；不同原因可以填写不同扣款金额，金额统一按 IDR 入账。</p>
        </div>
        <span class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">由业务人员填写</span>
      </div>
      ${
        reasonRows.length
          ? includedProjections
              .filter((projection) => (reasonRowsByProductionOrder.get(projection.productionOrderNo) ?? []).length > 0)
              .map((projection) => {
                const rows = reasonRowsByProductionOrder.get(projection.productionOrderNo) ?? []
                return `
                  <article class="mt-3 rounded-md border bg-background">
                    <div class="border-b bg-muted/30 px-4 py-3">
                      <div class="text-sm font-semibold">${escapeHtml(projection.productionOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">裁片完成 ${projection.cuttingCompletedQty} / 结算口径累计交出 ${projection.settlementHandoverQty} / 瑕疵 ${projection.sewingFactoryLiabilityDefectQty}</div>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[860px] text-sm">
                        <thead>
                          <tr class="border-b bg-muted/20 text-left">
                            <th class="px-4 py-2 font-medium">瑕疵原因</th>
                            <th class="px-4 py-2 text-right font-medium">瑕疵数量</th>
                            <th class="px-4 py-2 font-medium">扣款金额（IDR）</th>
                            <th class="px-4 py-2 font-medium">扣款说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${rows
                            .map((summary) => {
                              const input = getManualDefectProductionOrderDeduction(summary.productionOrderNo, summary.reasonName)
                              return `
                                <tr class="border-b last:border-b-0">
                                  <td class="px-4 py-3 font-medium">${escapeHtml(summary.reasonName)}</td>
                                  <td class="px-4 py-3 text-right tabular-nums">${summary.qty}</td>
                                  <td class="px-4 py-3">
                                    <input type="number" min="0" step="1" class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-defect-production-order-amount" data-production-order-no="${escapeHtml(summary.productionOrderNo)}" data-reason="${escapeHtml(summary.reasonName)}" value="${escapeHtml(input.amount)}" />
                                  </td>
                                  <td class="px-4 py-3">
                                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-defect-production-order-remark" data-production-order-no="${escapeHtml(summary.productionOrderNo)}" data-reason="${escapeHtml(summary.reasonName)}" data-skip-page-rerender="true" value="${escapeHtml(input.remark)}" placeholder="${escapeHtml(summary.productionOrderNo)} ${escapeHtml(summary.reasonName)}扣款说明" />
                                  </td>
                                </tr>
                              `
                            })
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  </article>
                `
              })
              .join('')
          : '<p class="mt-3 rounded-md border bg-muted/20 py-6 text-center text-sm text-muted-foreground">当前纳入对象暂无归车缝工厂原因的瑕疵事实。</p>'
      }
    </section>

    <section class="mt-4 rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">返工反扣</h3>
      <p class="mt-1 text-xs text-muted-foreground">返工接收对象不是来源工厂的返工扣款来自质检记录同步后的预结算流水，这里只做弱展示。</p>
      ${
        reworkLines.length
          ? `
            <div class="mt-3 overflow-x-auto rounded-md border">
              <table class="w-full min-w-[900px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">生产单</th>
                    <th class="px-4 py-2 font-medium">流水号</th>
                    <th class="px-4 py-2 font-medium">质检记录</th>
                    <th class="px-4 py-2 text-right font-medium">返工数量</th>
                    <th class="px-4 py-2 text-right font-medium">扣款金额</th>
                  </tr>
                </thead>
                <tbody>
                  ${reworkLines
                    .map(
                      (line) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-medium">${escapeHtml(line.productionOrderNoDisplay ?? line.productionOrderNo ?? '-')}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.ledgerNo ?? line.sourceItemId)}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.qcRecordId ?? '-')}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${line.returnInboundQty ?? line.deductionQty ?? 0}</td>
                          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(line.qualityDeductionAmount ?? 0)}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '<p class="mt-3 rounded-md border bg-muted/20 py-6 text-center text-sm text-muted-foreground">当前纳入对象暂无返工反扣流水。</p>'
      }
    </section>

    <section class="mt-4 rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">延误扣款</h3>
      <p class="mt-1 text-xs text-muted-foreground">系统只提供开始时间和最后交出时间，是否扣延误款由业务人员判断并填写。</p>
      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[980px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">生产单</th>
              <th class="px-4 py-2 font-medium">开始时间参考</th>
              <th class="px-4 py-2 font-medium">最后交出时间</th>
              <th class="px-4 py-2 font-medium">延误扣款金额（IDR）</th>
              <th class="px-4 py-2 font-medium">延误扣款说明</th>
            </tr>
          </thead>
          <tbody>
            ${includedProjections
              .map((projection) => {
                const input = getManualDelayProductionOrderDeduction(projection.productionOrderNo)
                const timing = getBuildProductionOrderTimingAssist(projection.productionOrderNo)
                return `
                  <tr class="border-b last:border-b-0">
                    <td class="px-4 py-3 font-medium">${escapeHtml(projection.productionOrderNo)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(timing.startTime)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(timing.lastHandoverTime)}</td>
                    <td class="px-4 py-3">
                      <input type="number" min="0" step="1" class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-delay-production-order-amount" data-production-order-no="${escapeHtml(projection.productionOrderNo)}" value="${escapeHtml(input.amount)}" />
                    </td>
                    <td class="px-4 py-3">
                      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-delay-production-order-remark" data-production-order-no="${escapeHtml(projection.productionOrderNo)}" value="${escapeHtml(input.remark)}" data-skip-page-rerender="true" placeholder="${escapeHtml(projection.productionOrderNo)} 延误扣款说明" />
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>

    <div class="mt-4 flex flex-wrap gap-2">
      <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="set-build-tab" data-build-tab="OBJECTS">上一步</button>
      <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="set-build-tab" data-build-tab="SUMMARY">下一步：金额确认</button>
    </div>
  `
}

function renderBuildSummaryTab(input: {
  editingDraft: StatementDraft | null
  selectedScope: StatementBuildScopeViewModel | null
  buildLines: StatementDetailLineViewModel[]
  buildSummary: ReturnType<typeof getBuildLineSummary>
  displayCurrency: string
  canGenerate: boolean
}): string {
  const { editingDraft, selectedScope, buildLines, buildSummary, displayCurrency, canGenerate } = input
  const manualDefectAmount = Object.values(state.manualDefectReasonDeductions).reduce(
    (sum, item) => sum + parseManualDeductionAmount(item.amount),
    0,
  )
  const manualDelayAmount = parseManualDeductionAmount(state.manualDelayDeductionAmount)

  return `
    <section class="mt-4 rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">总结算金额</h3>
      <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">任务收入流水数</dt><dd class="mt-1 font-medium tabular-nums">${buildSummary.earningCount}</dd></div>
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">任务收入流水合计</dt><dd class="mt-1 font-medium tabular-nums">${formatAmount(buildSummary.totalEarningAmount)}</dd></div>
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">瑕疵扣款</dt><dd class="mt-1 font-medium tabular-nums">${formatAmount(manualDefectAmount)}</dd></div>
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">延误扣款</dt><dd class="mt-1 font-medium tabular-nums">${formatAmount(manualDelayAmount)}</dd></div>
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">扣款明细行</dt><dd class="mt-1 font-medium tabular-nums">${buildSummary.deductionCount}</dd></div>
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">扣款合计</dt><dd class="mt-1 font-medium tabular-nums">${formatAmount(buildSummary.totalQualityDeductionAmount)}</dd></div>
        <div class="rounded-md border bg-muted/20 p-3"><dt class="text-xs text-muted-foreground">总数量</dt><dd class="mt-1 font-medium tabular-nums">${buildSummary.totalQty}</dd></div>
        <div class="rounded-md border border-blue-200 bg-blue-50 p-3"><dt class="text-xs text-blue-700">本期应付净额</dt><dd class="mt-1 font-semibold tabular-nums text-blue-700">${formatAmount(buildSummary.netPayableAmount)}</dd></div>
      </dl>
      ${
        selectedScope
          ? `
            <div class="mt-3 rounded-md border bg-background p-3 text-xs text-muted-foreground">
              工厂：<strong class="text-foreground">${escapeHtml(selectedScope.settlementPartyLabel)}</strong>
              <span class="mx-2">/</span>对账范围：<strong class="text-foreground">${escapeHtml(state.buildStartDate || '-')} ~ ${escapeHtml(state.buildEndDate || '-')}</strong>
              <span class="mx-2">/</span>结算对象：<strong class="text-foreground">${state.buildObjectMode === 'PRODUCTION_ORDER' ? '按生产单' : '按预结算流水'}</strong>
              <span class="mx-2">/</span>币种：<strong class="text-foreground">${escapeHtml(displayCurrency)}</strong>
            </div>
          `
          : ''
      }
    </section>

    <section class="mt-4 rounded-lg border bg-card p-4">
      <div class="mb-3">
        <h3 class="text-sm font-semibold">正式流水与扣款明细预览</h3>
        <p class="mt-1 text-xs text-muted-foreground">生成草稿前最后核对任务收入、返工反扣、瑕疵原因扣款和延误扣款。</p>
      </div>
      ${renderBuildLineRows(buildLines)}
    </section>

    <div class="mt-4 flex flex-wrap gap-2">
      <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="set-build-tab" data-build-tab="QC_DEDUCTIONS">上一步</button>
      ${
        editingDraft
          ? `<button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="save-build" ${selectedScope == null ? 'disabled' : ''}>保存草稿</button>`
          : `<button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" data-stm-action="generate" ${canGenerate ? '' : 'disabled'}>确认生成草稿</button>`
      }
      <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="back-to-list">取消</button>
    </div>
  `
}

function renderProductionOrderProjectionRow(item: ProductionOrderSettlementProjection): string {
  return `
    <div class="rounded-md border bg-background p-3 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-medium">${renderProductionOrderIdentityCell(item.productionOrderNo)}</div>
        <span class="rounded-md px-2 py-0.5 ${item.isComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">
          ${item.isComplete ? '可纳入本期对账' : `未完成，不纳入本期对账 · ${escapeHtml(item.excludedReason ?? `差 ${item.shortageQty} 件`)}`}
        </span>
      </div>
      <dl class="mt-3 grid gap-2 md:grid-cols-4">
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">裁片完成数量</dt><dd class="tabular-nums">${item.cuttingCompletedQty}</dd></div>
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">结算口径累计交出</dt><dd class="tabular-nums">${item.settlementHandoverQty}</dd></div>
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">原工厂返工</dt><dd class="tabular-nums">${item.originalFactoryReworkQty}</dd></div>
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">后道工厂返工 / 后道返工反扣</dt><dd class="tabular-nums">${item.postFactoryReworkQty}</dd></div>
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">瑕疵总数</dt><dd class="tabular-nums">${item.defectQty}</dd></div>
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">车缝责任瑕疵</dt><dd class="tabular-nums">${item.sewingFactoryLiabilityDefectQty}</dd></div>
        <div class="flex items-center justify-between gap-2"><dt class="text-muted-foreground">差额</dt><dd class="tabular-nums">差 ${item.shortageQty} 件</dd></div>
      </dl>
      ${renderProductionOrderLedgerDetails(item.productionOrderNo)}
      ${renderProductionOrderQcDetails(item.productionOrderNo)}
    </div>
  `
}

function renderLedgerTypeLabel(ledger: PreSettlementLedger): string {
  return ledger.ledgerType === 'TASK_EARNING' ? '任务收入流水' : '返工反扣流水'
}

function renderProductionOrderLedgerDetails(productionOrderNo: string): string {
  const ledgers = getBuildRangeLedgers().filter((item) => item.productionOrderNo === productionOrderNo)
  if (!ledgers.length) {
    return '<p class="mt-3 rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">当前生产单暂无预结算流水明细。</p>'
  }

  return `
    <div class="mt-3 rounded-md border bg-muted/10">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <h4 class="text-xs font-semibold">预结算流水明细（${ledgers.length} 条）</h4>
        <span class="text-[11px] text-muted-foreground">每张生产单下展示全部收入流水和返工反扣流水</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-xs">
          <thead>
            <tr class="border-b bg-muted/30 text-left">
              <th class="px-3 py-2 font-medium">流水号</th>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">关联对象</th>
              <th class="px-3 py-2 text-right font-medium">数量</th>
              <th class="px-3 py-2 text-right font-medium">金额</th>
              <th class="px-3 py-2 font-medium">发生时间</th>
              <th class="px-3 py-2 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            ${ledgers
              .map(
                (ledger) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-3 py-2 font-mono">${escapeHtml(ledger.ledgerNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(renderLedgerTypeLabel(ledger))}</td>
                    <td class="px-3 py-2">${escapeHtml(ledger.returnInboundBatchNo ?? ledger.qcRecordId ?? ledger.sourceRefId)}</td>
                    <td class="px-3 py-2 text-right tabular-nums">${ledger.qty}</td>
                    <td class="px-3 py-2 text-right tabular-nums">${formatAmount(ledger.ledgerType === 'QUALITY_DEDUCTION' ? -ledger.settlementAmount : ledger.settlementAmount)}</td>
                    <td class="px-3 py-2">${escapeHtml(ledger.occurredAt)}</td>
                    <td class="px-3 py-2 text-muted-foreground">${escapeHtml(ledger.sourceReason ?? ledger.remark ?? '-')}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderSkuDefectSummary(sku: DemoSettlementSkuFact): string {
  return Object.entries(sku.defectReasonQtyByName)
    .map(([reasonName, qty]) => `${escapeHtml(reasonName)} ${qty}`)
    .join('、')
}

function renderProductionOrderQcDetails(productionOrderNo: string): string {
  const qcOrders = getDemoQcFactsByProductionOrderNo(productionOrderNo)
  if (!qcOrders.length) return ''

  return `
    <div class="mt-3 rounded-md border bg-muted/10">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <h4 class="text-xs font-semibold">关联质检单（${qcOrders.length} 张）</h4>
        <span class="text-[11px] text-muted-foreground">每张质检单含 3 个 SKU，按 SKU 展示瑕疵和返工接收对象</span>
      </div>
      <div class="divide-y">
        ${qcOrders
          .map(
            (qcOrder) => `
              <div class="p-3">
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span class="font-medium">${escapeHtml(qcOrder.qcOrderNo)}</span>
                  <span class="text-muted-foreground">质检时间：${escapeHtml(qcOrder.inspectedAt)}</span>
                  <span class="text-muted-foreground">质检员：${escapeHtml(qcOrder.inspector)}</span>
                  <span class="text-muted-foreground">返工接收对象：按 SKU 区分</span>
                </div>
                <div class="mt-2 overflow-x-auto rounded-md border bg-background">
                  <table class="w-full min-w-[980px] text-xs">
                    <thead>
                      <tr class="border-b bg-muted/30 text-left">
                        <th class="px-3 py-2 font-medium">SKU</th>
                        <th class="px-3 py-2 font-medium">颜色 / 尺码</th>
                        <th class="px-3 py-2 text-right font-medium">质检数量</th>
                        <th class="px-3 py-2 text-right font-medium">合格数量</th>
                        <th class="px-3 py-2 text-right font-medium">瑕疵数量</th>
                        <th class="px-3 py-2 font-medium">瑕疵原因</th>
                        <th class="px-3 py-2 text-right font-medium">返工数量</th>
                        <th class="px-3 py-2 font-medium">返工接收对象</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${qcOrder.skuFacts
                        .map(
                          (sku) => `
                            <tr class="border-b last:border-b-0">
                              <td class="px-3 py-2 font-mono">${escapeHtml(sku.skuCode)}</td>
                              <td class="px-3 py-2">${escapeHtml(sku.colorSize)}</td>
                              <td class="px-3 py-2 text-right tabular-nums">${sku.inspectedQty}</td>
                              <td class="px-3 py-2 text-right tabular-nums">${sku.qualifiedQty}</td>
                              <td class="px-3 py-2 text-right tabular-nums">${getSkuDefectQty(sku)}</td>
                              <td class="px-3 py-2">${renderSkuDefectSummary(sku)}</td>
                              <td class="px-3 py-2 text-right tabular-nums">${sku.reworkQty}</td>
                              <td class="px-3 py-2">
                                ${escapeHtml(sku.reworkReceiveFactoryName)}
                                <span class="ml-1 text-muted-foreground">(${sku.reworkReceiveObject === 'ORIGINAL_FACTORY' ? '原工厂' : '后道工厂'})</span>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `
}

function renderProductionOrderProjectionPanel(projections: ProductionOrderSettlementProjection[]): string {
  const includedNos = new Set(getSelectedProductionOrderNosForQc(projections))
  const modeDescription = state.buildObjectMode === 'PRODUCTION_ORDER'
    ? '全部展示反查结果；未完成生产单不进入本期对账。'
    : '按当前可入单预结算流水反查生产单，用于汇总关联质检事实和扣款依据。'
  return `
    <section class="mt-4 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">反查生产单</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(modeDescription)}</p>
        </div>
        <div class="text-xs text-muted-foreground">已完成 ${projections.filter((item) => item.isComplete).length} 张 / 未完成 ${projections.filter((item) => !item.isComplete).length} 张 / 本次扣款关联 ${includedNos.size} 张</div>
      </div>
      <div class="mt-3 space-y-2">
        ${
          projections.length
            ? projections.map((item) => renderProductionOrderProjectionRow(item)).join('')
            : '<p class="py-6 text-center text-sm text-muted-foreground">当前范围暂无可反查的生产单。</p>'
        }
      </div>
    </section>
  `
}

function renderStatementLedgerSectionRows(
  lines: StatementDetailLineViewModel[],
  ledgerType: 'TASK_EARNING' | 'QUALITY_DEDUCTION',
): string {
  if (!lines.length) {
    return `<p class="py-6 text-center text-sm text-muted-foreground">当前暂无${ledgerType === 'TASK_EARNING' ? '任务收入流水' : '返工扣款流水'}明细。</p>`
  }

  if (ledgerType === 'TASK_EARNING') {
    return `
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1280px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">流水号</th>
              <th class="px-4 py-2 font-medium">任务号</th>
              <th class="px-4 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-4 py-2 font-medium">回货批次号</th>
              <th class="px-4 py-2 font-medium">价格来源</th>
              <th class="px-4 py-2 text-right font-medium">数量</th>
              <th class="px-4 py-2 text-right font-medium">单价</th>
              <th class="px-4 py-2 text-right font-medium">金额</th>
              <th class="px-4 py-2 font-medium">查看来源详情</th>
            </tr>
          </thead>
          <tbody>
            ${lines
              .map(
                (line) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.ledgerNo ?? line.sourceItemId)}</td>
                    <td class="px-4 py-3 text-xs">${escapeHtml(line.taskNoDisplay)}</td>
                    <td class="px-4 py-3">${renderProductionOrderIdentityCell(line.productionOrderNoDisplay)}</td>
                    <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.returnInboundBatchNo ?? '-')}</td>
                    <td class="px-4 py-3 text-xs">${escapeHtml(PRICE_SOURCE_LABEL[line.pricingSourceType ?? 'NONE'] ?? '不适用')}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${line.returnInboundQty ?? line.deductionQty ?? 0}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${line.settlementUnitPrice == null ? '-' : formatAmount(line.settlementUnitPrice)}</td>
                    <td class="px-4 py-3 text-right font-medium tabular-nums">${formatAmount(line.earningAmount ?? 0)}</td>
                    <td class="px-4 py-3">
                      <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(line.routeToSourceResolved)}">查看来源详情</button>
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

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[1320px] text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">流水号</th>
            <th class="px-4 py-2 font-medium">质检记录号</th>
            <th class="px-4 py-2 font-medium">待确认质量扣款记录号</th>
            <th class="px-4 py-2 font-medium">质量异议单号</th>
            <th class="px-4 py-2 font-medium">裁决结果</th>
            <th class="px-4 py-2 text-right font-medium">责任数量</th>
            <th class="px-4 py-2 text-right font-medium">金额</th>
            <th class="px-4 py-2 font-medium">查看来源详情</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (item) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.ledgerNo ?? item.sourceItemId)}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.qcRecordId ?? '-')}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.pendingDeductionRecordId ?? '-')}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.disputeId ?? '-')}</td>
                  <td class="px-4 py-3 text-xs">${escapeHtml(item.remark ?? item.sourceTypeZh)}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${item.returnInboundQty ?? item.deductionQty ?? 0}</td>
                  <td class="px-4 py-3 text-right font-medium tabular-nums">${formatAmount(item.qualityDeductionAmount ?? 0)}</td>
                  <td class="px-4 py-3">
                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(item.basisId ? buildDeductionEntryHrefByBasisId(item.basisId) : item.routeToSourceResolved)}">查看依据</button>
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

function renderStatementLifecycleHint(
  draft: StatementDraft,
  progressView: ReturnType<typeof getStatementSettlementProgressView>,
): string {
  if (draft.status === 'READY_FOR_PREPAYMENT') {
    const message = progressView.canEnterSettlement
      ? '当前已完成正式流水汇总并等待进入后续预付款批次。'
      : progressView.detail
    return `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">${escapeHtml(message)}</span>`
  }

  if (draft.status === 'IN_PREPAYMENT_BATCH') {
    return '<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前单据已进入预付款批次，可从后续预付款执行页继续跟进。</span>'
  }

  if (draft.status === 'PREPAID') {
    return '<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前单据已完成预付款，保留后续回写与历史查看。</span>'
  }

  if (draft.status === 'CLOSED') {
    return '<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前已关闭，仅保留口径和历史查看。</span>'
  }

  return ''
}

function renderDetailDialog(detail: StatementDetailViewModel | null): string {
  if (!detail) return ''
  const appealRecords = getStatementAppealRecords(detail.draft).slice().reverse()
  const openAppeal = getOpenStatementAppeal(detail.draft)
  const latestAppeal = getLatestStatementAppeal(detail.draft)
  const progressView = getStatementSettlementProgressView(detail.draft)
  const confirmationSourceLabel = getStatementConfirmationSourceLabel(detail.draft)
  const statusLabel = getStatementDisplayStatusLabel(detail.draft)
  const statusBadgeClass = getStatementDisplayStatusBadgeClass(detail.draft)
  const showAppealProcessing =
    state.processingAppealStatementId === detail.draft.statementId && openAppeal

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-stm-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 flex max-h-[88vh] w-full max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-stm-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="border-b px-6 py-5">
          <h3 class="text-lg font-semibold">对账单详情 — ${escapeHtml(detail.draft.statementNo ?? detail.draft.statementId)}</h3>
          <p class="mt-1 text-xs text-muted-foreground">当前详情按正式流水汇总单组织。任务收入流水与返工扣款流水分别展示，未最终裁决的质量异议不会计入当前对账单。</p>
        </header>

        <div class="flex-1 overflow-auto px-6 py-5">
          <section class="rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">基本信息</h4>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">对账单号</dt><dd class="font-mono text-xs">${escapeHtml(detail.draft.statementNo ?? detail.draft.statementId)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">工厂</dt><dd class="text-right text-xs">${escapeHtml(detail.settlementPartyLabel)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算周期</dt><dd class="text-right text-xs">${escapeHtml(detail.draft.settlementCycleLabel ?? '-')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">计划预付款日</dt><dd class="text-xs">${escapeHtml(detail.draft.plannedPrepaymentAt ?? '-')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">对账单状态</dt><dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${statusBadgeClass}">${escapeHtml(statusLabel)}</span></dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">确认来源</dt><dd class="text-xs ${isStatementProxyConfirmed(detail.draft) ? 'font-medium text-blue-700' : ''}">${escapeHtml(confirmationSourceLabel)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">创建时间</dt><dd class="text-xs">${escapeHtml(detail.draft.createdAt)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">创建人</dt><dd class="text-xs">${escapeHtml(detail.draft.createdBy)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算资料版本号</dt><dd class="text-xs font-medium">${escapeHtml(detail.draft.settlementProfileVersionNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算币种</dt><dd class="text-xs">IDR</dd></div>
            </dl>
          </section>

          <section class="mt-4 rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">金额概况</h4>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">任务收入流水合计</dt><dd class="font-medium tabular-nums">${formatAmount(detail.totalEarningAmount)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">返工扣款流水合计</dt><dd class="font-medium tabular-nums">${formatAmount(detail.totalQualityDeductionAmount)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">本期应付净额</dt><dd class="font-medium tabular-nums">${formatAmount(detail.netPayableAmount)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">总数量</dt><dd class="font-medium tabular-nums">${detail.totalQty}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">正式流水条数</dt><dd class="font-medium tabular-nums">${detail.lines.length}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">来源类型概况</dt><dd class="text-right text-xs">${escapeHtml(detail.sourceTypeSummary)}</dd></div>
            </dl>
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-semibold">任务收入流水明细</h4>
                <p class="mt-1 text-xs text-muted-foreground">任务收入流水按回货批次汇总，保留任务、回货批次、价格来源、数量与金额追溯。</p>
              </div>
            </div>
            ${renderStatementLedgerSectionRows(detail.earningLines, 'TASK_EARNING')}
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-semibold">返工扣款流水明细</h4>
                <p class="mt-1 text-xs text-muted-foreground">仅展示已正式成立的返工扣款流水，未最终裁决的质量异议不会计入当前单据。</p>
              </div>
            </div>
            ${renderStatementLedgerSectionRows(detail.deductionLines, 'QUALITY_DEDUCTION')}
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">工厂反馈</h4>
            <div class="mt-3">${renderProxyConfirmationSummary(detail.draft)}</div>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">工厂反馈状态</dt><dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${getFactoryFeedbackStatusBadge(detail.draft.factoryFeedbackStatus)}">${escapeHtml(getFactoryFeedbackStatusLabel(detail.draft.factoryFeedbackStatus))}</span></dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">确认来源</dt><dd class="text-xs ${isStatementProxyConfirmed(detail.draft) ? 'font-medium text-blue-700' : ''}">${escapeHtml(confirmationSourceLabel)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">反馈时间</dt><dd class="text-xs">${escapeHtml(detail.draft.factoryFeedbackAt || '当前未反馈')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">反馈人</dt><dd class="text-xs">${escapeHtml(detail.draft.factoryFeedbackBy || '当前未反馈')}</dd></div>
              ${
                isStatementProxyConfirmed(detail.draft)
                  ? `
                    <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">线下确认方式</dt><dd class="text-xs">${escapeHtml(getProxyConfirmationMethodLabel(detail.draft.proxyConfirmMethod))}</dd></div>
                    <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">通知状态</dt><dd class="text-xs">${escapeHtml(getProxyNotificationStatusLabel(detail.draft.proxyConfirmNotificationStatus))}</dd></div>
                    <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">代确认原因</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.proxyConfirmReason || '未记录')}</dd></div>
                    <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">通知说明</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.proxyConfirmNotificationRemark || '未记录')}</dd></div>
                  `
                  : ''
              }
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">反馈说明</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.factoryFeedbackRemark || '当前无反馈说明')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">是否有申诉</dt><dd class="text-xs">${detail.hasFactoryAppeal ? '有申诉' : '无申诉'}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">最新申诉</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${
                latestAppeal
                  ? escapeHtml(
                      `${latestAppeal.reasonName} · ${latestAppeal.submittedAt} · ${getFactoryAppealStatusLabel(latestAppeal.status)}`,
                    )
                  : '当前无工厂申诉'
              }</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">处理结果</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(getResolutionResultLabel(detail.draft.resolutionResult))}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">处理时间</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.platformHandledAt || '当前未处理')}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">处理人</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.platformHandledBy || '当前未处理')}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">处理意见</dt><dd class="max-w-[70%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.resolutionComment || '当前未处理')}</dd></div>
            </dl>
            ${
              appealRecords.length
                ? `
                  <div class="mt-3 space-y-2">
                    ${appealRecords
                      .map(
                        (record) => `
                          <div class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                            <div class="flex items-center justify-between gap-3">
                              <span class="font-medium text-foreground">${escapeHtml(record.reasonName)}</span>
                              <span>${escapeHtml(getFactoryAppealStatusLabel(record.status))}</span>
                            </div>
                            <div class="mt-1">申诉时间：${escapeHtml(record.submittedAt)} · 提交人：${escapeHtml(record.submittedBy)}</div>
                            <div class="mt-1">申诉说明：${escapeHtml(record.description)}</div>
                            <div class="mt-1">证据说明：${escapeHtml(record.evidenceSummary || '当前未补充证据说明')}</div>
                            <div class="mt-1">处理结果：${escapeHtml(getResolutionResultLabel(record.resolutionResult))}</div>
                            <div class="mt-1">处理意见：${escapeHtml(record.resolutionComment || '当前未处理')}</div>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>
                `
                : ''
            }
            ${
              openAppeal
                ? `
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-stm-action="open-process-appeal" data-statement-id="${escapeHtml(detail.draft.statementId)}">
                      处理申诉
                    </button>
                  </div>
                `
                : ''
            }
            ${
              showAppealProcessing
                ? `
                  <div class="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                    <div class="text-xs font-medium text-blue-700">平台处理申诉</div>
                    <p class="mt-1 text-xs text-blue-700">处理后会回写工厂端视图，并决定当前单据是否可重新进入后续预付款。</p>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                      <label class="grid gap-1 text-xs">
                        <span class="text-muted-foreground">处理结果</span>
                        <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-appeal-field="result">
                          <option value="" ${state.appealResolutionResult === '' ? 'selected' : ''}>请选择</option>
                          <option value="UPHELD" ${state.appealResolutionResult === 'UPHELD' ? 'selected' : ''}>维持当前口径</option>
                          <option value="REOPEN_REQUIRED" ${state.appealResolutionResult === 'REOPEN_REQUIRED' ? 'selected' : ''}>退回重算 / 关闭当前单</option>
                        </select>
                      </label>
                      <label class="grid gap-1 text-xs md:col-span-2">
                        <span class="text-muted-foreground">处理意见</span>
                        <textarea class="min-h-[88px] rounded-md border bg-background px-3 py-2 text-sm" data-stm-appeal-field="comment" data-skip-page-rerender="true" placeholder="请填写处理意见">${escapeHtml(state.appealResolutionComment)}</textarea>
                      </label>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700" data-stm-action="submit-appeal-resolution" data-statement-id="${escapeHtml(detail.draft.statementId)}">确认处理结果</button>
                      <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-stm-action="cancel-process-appeal">取消</button>
                    </div>
                  </div>
                `
                : ''
            }
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">结算资料快照</h4>
            <p class="mt-1 text-xs text-muted-foreground">这份快照在对账单生成时已冻结。后续结算资料新增版本只影响未来新单据，已生成单据继续保留原版本快照。</p>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">版本号</dt><dd class="text-xs font-medium">${escapeHtml(detail.draft.settlementProfileVersionNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">户名</dt><dd class="text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.receivingAccountSnapshot.accountHolderName)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">银行</dt><dd class="text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.receivingAccountSnapshot.bankName)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">账号尾号</dt><dd class="text-xs">${escapeHtml(detail.maskedAccountNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">币种</dt><dd class="text-xs">IDR</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">生效时间</dt><dd class="text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.effectiveAt)}</dd></div>
            </dl>
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">后续预付款说明</h4>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">当前是否可入预付款</dt><dd class="font-medium">${progressView.canEnterSettlement ? '可进入后续预付款' : '暂不可进入后续预付款'}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">当前所处阶段</dt><dd class="text-xs">${escapeHtml(progressView.summary)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">已关联预付款批次</dt><dd class="text-xs">${escapeHtml(detail.draft.prepaymentBatchNo || detail.draft.prepaymentBatchId || '当前未入预付款批次')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">批次状态</dt><dd class="text-xs">${escapeHtml(detail.draft.prepaymentBatchStatus ? (detail.draft.prepaymentBatchStatus === 'READY_TO_APPLY_PAYMENT' ? '待申请付款' : detail.draft.prepaymentBatchStatus === 'FEISHU_APPROVAL_CREATED' ? '飞书审批中' : detail.draft.prepaymentBatchStatus === 'FEISHU_PAID_PENDING_WRITEBACK' ? '已付款待回写' : detail.draft.prepaymentBatchStatus === 'PREPAID' ? '已预付' : detail.draft.prepaymentBatchStatus === 'CLOSED' ? '已关闭' : detail.draft.prepaymentBatchStatus === 'FEISHU_APPROVAL_REJECTED' ? '审批已驳回' : '审批已取消') : '当前未入预付款批次')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">飞书付款审批编号</dt><dd class="text-xs">${escapeHtml(detail.draft.feishuApprovalNo || '当前未创建')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">计划预付款日</dt><dd class="text-xs">${escapeHtml(detail.draft.plannedPrepaymentAt || '当前未计划')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">准备时间</dt><dd class="text-xs">${escapeHtml(detail.draft.readyForPrepaymentAt || '当前未准备')}</dd></div>
            </dl>
            <p class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(progressView.detail)}</p>
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">生命周期动作</h4>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              ${
                detail.draft.status === 'DRAFT'
                  ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="confirm-draft" data-statement-id="${escapeHtml(detail.draft.statementId)}">确认对账单</button>`
                  : ''
              }
              ${
                detail.draft.status === 'DRAFT'
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-stm-action="edit-draft" data-statement-id="${escapeHtml(detail.draft.statementId)}">继续编辑草稿</button>`
                  : ''
              }
              ${
                detail.draft.status === 'DRAFT'
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-stm-action="close-draft" data-statement-id="${escapeHtml(detail.draft.statementId)}">关闭对账单</button>`
                  : ''
              }
              ${
                detail.draft.status === 'PENDING_FACTORY_CONFIRM'
                  ? `
                    <span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前已下发工厂，待工厂确认或申诉后才能决定是否进入后续预付款。</span>
                    ${
                      canProxyConfirmStatement(detail.draft)
                        ? `<button class="inline-flex h-8 items-center rounded-md border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100" data-stm-action="open-proxy-confirm" data-statement-id="${escapeHtml(detail.draft.statementId)}">跟单审核代确认</button>`
                        : `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">存在申诉或状态不满足时不可代确认。</span>`
                    }
                  `
                  : ''
              }
              ${renderStatementLifecycleHint(detail.draft, progressView)}
            </div>
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">操作日志</h4>
            <div class="mt-3 space-y-2">
              ${renderStatementAuditLogList(detail.draft)}
            </div>
          </section>
        </div>
      </section>
    </div>
  `
}

function renderProxyConfirmationDialog(): string {
  if (!state.proxyConfirmStatementId) return ''
  const draft = getStatementDraftById(state.proxyConfirmStatementId)
  if (!draft) return ''

  return `
    <div class="fixed inset-0 z-[70]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-stm-action="close-proxy-confirm" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-2xl" data-dialog-panel="true">
        <header>
          <h3 class="text-base font-semibold">跟单审核代确认</h3>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            该操作会使对账单进入确认后处理；正向净额单可进入预付款，净额非正向单由财务继续处理。系统会记录“跟单审核代确认”，三方工厂端也会看到该确认来源。
          </p>
        </header>

        <div class="mt-4 rounded-md border bg-muted/20 px-3 py-2 text-xs">
          <div>对账单：<span class="font-mono">${escapeHtml(draft.statementNo ?? draft.statementId)}</span></div>
          <div class="mt-1">工厂：${escapeHtml(draft.factoryName ?? draft.statementPartyView ?? draft.settlementPartyId)}</div>
          <div class="mt-1">结算周期：${escapeHtml(draft.settlementCycleLabel ?? '-')}</div>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <label class="grid gap-1 text-xs">
            <span class="text-muted-foreground">线下确认方式 <span class="text-red-500">*</span></span>
            <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-proxy-field="method">
              <option value="" ${state.proxyConfirmMethod === '' ? 'selected' : ''}>请选择</option>
              <option value="PHONE" ${state.proxyConfirmMethod === 'PHONE' ? 'selected' : ''}>电话确认</option>
              <option value="WHATSAPP" ${state.proxyConfirmMethod === 'WHATSAPP' ? 'selected' : ''}>WhatsApp 确认</option>
              <option value="FEISHU_OR_WECHAT" ${state.proxyConfirmMethod === 'FEISHU_OR_WECHAT' ? 'selected' : ''}>飞书/微信确认</option>
              <option value="ONSITE" ${state.proxyConfirmMethod === 'ONSITE' ? 'selected' : ''}>现场确认</option>
              <option value="LONG_INACTIVE" ${state.proxyConfirmMethod === 'LONG_INACTIVE' ? 'selected' : ''}>长期未操作</option>
              <option value="OTHER" ${state.proxyConfirmMethod === 'OTHER' ? 'selected' : ''}>其他方式</option>
            </select>
          </label>
          <label class="grid gap-1 text-xs">
            <span class="text-muted-foreground">通知三方工厂状态 <span class="text-red-500">*</span></span>
            <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-proxy-field="notification-status">
              <option value="NOTIFIED" ${state.proxyConfirmNotificationStatus === 'NOTIFIED' ? 'selected' : ''}>已通知三方工厂</option>
              <option value="PENDING" ${state.proxyConfirmNotificationStatus === 'PENDING' ? 'selected' : ''}>待补通知三方工厂</option>
              <option value="FAILED" ${state.proxyConfirmNotificationStatus === 'FAILED' ? 'selected' : ''}>通知三方工厂失败</option>
            </select>
          </label>
          <label class="grid gap-1 text-xs md:col-span-2">
            <span class="text-muted-foreground">代确认原因 <span class="text-red-500">*</span></span>
            <textarea class="min-h-[84px] rounded-md border bg-background px-3 py-2 text-sm" data-stm-proxy-field="reason" data-skip-page-rerender="true" placeholder="例如：三方工厂未在 PDA 操作，跟单已通过 WhatsApp 与负责人核对无异议">${escapeHtml(state.proxyConfirmReason)}</textarea>
          </label>
          <label class="grid gap-1 text-xs md:col-span-2">
            <span class="text-muted-foreground">跟单审核备注</span>
            <textarea class="min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm" data-stm-proxy-field="remark" data-skip-page-rerender="true" placeholder="记录审核口径、沟通对象或风险说明">${escapeHtml(state.proxyConfirmRemark)}</textarea>
          </label>
          <label class="grid gap-1 text-xs md:col-span-2">
            <span class="text-muted-foreground">通知说明</span>
            <input class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-proxy-field="notification-remark" data-skip-page-rerender="true" value="${escapeHtml(state.proxyConfirmNotificationRemark)}" />
          </label>
        </div>

        <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          审核通过后，系统将记录原状态、目标状态、跟单人员、时间、代确认依据和通知状态；PDA 端不会显示为工厂本人确认。
        </div>

        <footer class="mt-4 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-stm-action="close-proxy-confirm">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="submit-proxy-confirm" data-statement-id="${escapeHtml(draft.statementId)}">审核通过并代确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderListView(
  listItems: StatementListItemViewModel[],
  buildScopes: StatementBuildScopeViewModel[],
): string {
  const counts = getStatementOverviewCounts(listItems, buildScopes)
  const filteredItems = getFilteredStatementListItems(listItems)
  const pagedItems = getPaginatedStatementListItems(filteredItems)
  const partyOptions = getStatementPartyOptions(listItems)
  const cycleOptions = getStatementCycleOptions(listItems)
  const summaryItems = [
    { label: '对账单', value: counts.total, tone: 'text-foreground' },
    { label: '草稿中', value: counts.draft, tone: 'text-amber-600' },
    { label: '待工厂反馈', value: counts.pendingFactory, tone: 'text-blue-600' },
    { label: '可入预付款', value: counts.readyForPrepayment, tone: 'text-emerald-600' },
    { label: '财务待处理', value: counts.financePending, tone: 'text-amber-600' },
    { label: '已入预付款批次', value: counts.inPrepaymentBatch, tone: 'text-indigo-600' },
    { label: '已预付', value: counts.prepaid, tone: 'text-slate-700' },
    { label: '已关闭', value: counts.closed, tone: 'text-muted-foreground' },
    { label: '可新建范围', value: counts.buildableScopeCount, tone: 'text-violet-600' },
  ]

  return `
    <section class="rounded-xl border bg-background p-3">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[1fr_1fr_1.15fr_1.25fr_1fr]">
        <label class="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
          关键词
          <input
            class="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm font-normal"
            data-stm-list-filter="keyword"
            data-skip-page-rerender="true"
            placeholder="对账单号 / 工厂"
            value="${escapeHtml(state.keyword)}"
          />
        </label>
        <label class="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
          工厂
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm font-normal" data-stm-list-filter="party">
            <option value="__ALL__" ${state.filterParty === '__ALL__' ? 'selected' : ''}>全部工厂</option>
            ${partyOptions
              .map(
                (item) => `<option value="${escapeHtml(item.value)}" ${state.filterParty === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
          结算周期
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm font-normal" data-stm-list-filter="cycle">
            <option value="__ALL__" ${state.filterCycle === '__ALL__' ? 'selected' : ''}>全部结算周期</option>
            ${cycleOptions
              .map(
                (item) => `<option value="${escapeHtml(item.value)}" ${state.filterCycle === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
          对账单状态
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm font-normal" data-stm-list-filter="status">
            <option value="__ALL__" ${state.filterStatus === '__ALL__' ? 'selected' : ''}>全部状态</option>
            <option value="DRAFT" ${state.filterStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
            <option value="PENDING_FACTORY_CONFIRM" ${state.filterStatus === 'PENDING_FACTORY_CONFIRM' ? 'selected' : ''}>待工厂反馈</option>
            <option value="__FACTORY_SELF_CONFIRMED__" ${state.filterStatus === '__FACTORY_SELF_CONFIRMED__' ? 'selected' : ''}>工厂已确认（工厂自己确认）</option>
            <option value="__MERCHANDISER_PROXY_CONFIRMED__" ${state.filterStatus === '__MERCHANDISER_PROXY_CONFIRMED__' ? 'selected' : ''}>工厂已确认（跟单代确认）</option>
            <option value="READY_FOR_PREPAYMENT" ${state.filterStatus === 'READY_FOR_PREPAYMENT' ? 'selected' : ''}>确认后处理</option>
            <option value="IN_PREPAYMENT_BATCH" ${state.filterStatus === 'IN_PREPAYMENT_BATCH' ? 'selected' : ''}>已入预付款批次</option>
            <option value="PREPAID" ${state.filterStatus === 'PREPAID' ? 'selected' : ''}>已预付</option>
            <option value="CLOSED" ${state.filterStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
          </select>
        </label>
        <label class="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
          工厂反馈
          <select class="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm font-normal" data-stm-list-filter="feedback">
            <option value="__ALL__" ${state.filterFeedback === '__ALL__' ? 'selected' : ''}>全部工厂反馈</option>
            ${Object.entries(FACTORY_FEEDBACK_LABEL)
              .map(
                ([value, label]) => `<option value="${value}" ${state.filterFeedback === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
              )
              .join('')}
          </select>
        </label>
      </div>
    </section>

    <section class="rounded-xl border bg-background p-3">
      <div class="flex flex-wrap items-center gap-2">
        ${summaryItems
          .map(
            (item) => `
              <div class="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm shadow-sm">
                <span class="text-muted-foreground">${escapeHtml(item.label)}:</span>
                <strong class="tabular-nums ${item.tone}">${item.value}</strong>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="overflow-hidden rounded-xl border bg-background">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">对账单列表</h2>
          <p class="mt-1 text-xs text-muted-foreground">汇总查看当前对账单在对账、预付款和关闭归档中的推进情况。</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-xs text-muted-foreground">共 ${filteredItems.length} 条对账单</span>
          <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700" data-stm-action="open-build">
            新建对账单
          </button>
        </div>
      </div>
      ${
        filteredItems.length === 0
          ? `<p class="py-8 text-center text-sm text-muted-foreground">当前筛选条件下暂无对账单</p>`
          : `
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1820px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">工厂 / 结算对象</th>
                    <th class="px-4 py-2 font-medium">结算周期 / 计划预付款</th>
                    <th class="px-4 py-2 font-medium">结算币种</th>
                    <th class="px-4 py-2 font-medium">对账单状态</th>
                    <th class="px-4 py-2 font-medium">工厂反馈状态</th>
                    <th class="px-4 py-2 text-right font-medium">条目数</th>
                    <th class="px-4 py-2 text-right font-medium">总数量</th>
                    <th class="px-4 py-2 text-right font-medium">正向金额</th>
                    <th class="px-4 py-2 text-right font-medium">反向金额</th>
                    <th class="px-4 py-2 text-right font-medium">本期应付净额</th>
                    <th class="px-4 py-2 font-medium">创建时间</th>
                    <th class="px-4 py-2 font-medium">结算资料版本号</th>
                    <th class="px-4 py-2 font-medium">收款账户尾号</th>
                    <th class="px-4 py-2 font-medium">预付款批次</th>
                    <th class="px-4 py-2 font-medium">工厂申诉</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>${renderStatementListRows(pagedItems)}</tbody>
              </table>
            </div>
            <div class="border-t px-4 pb-4">
              ${renderStatementListPagination(filteredItems.length)}
            </div>
          `
      }
    </section>
  `
}

function renderBuildView(scopes: StatementBuildScopeViewModel[]): string {
  const editingDraft = getEditingDraft()
  const factoryOptions = getBuildFactoryOptions(scopes)
  const selectedScope = getSelectedBuildScope(scopes)
  const buildCandidates = getBuildCandidates()
  const buildLines = getBuildLines(scopes)
  const buildSummary = getBuildLineSummary(buildLines)
  const projections = getBuildProductionOrderProjections()
  const effectiveCurrency = getEffectiveBuildCurrency()
  const displayCurrency = getBuildCurrencyDisplayText(effectiveCurrency)
  const duplicatedStatement =
    selectedScope == null || !isBuildRangeValid()
      ? null
      : findOpenStatementByPartyAndRange(
          selectedScope.settlementPartyId,
          state.buildStartDate,
          state.buildEndDate,
          state.buildObjectMode,
        )
  const blockingStatement =
    duplicatedStatement && duplicatedStatement.statementId !== state.editingStatementId
      ? duplicatedStatement
      : null
  const canGenerate = selectedScope != null && isBuildRangeValid() && effectiveCurrency !== null && !blockingStatement

  const tabContent =
    state.buildTab === 'SCOPE'
      ? renderBuildScopeTab({
          editingDraft,
          factoryOptions,
          selectedScope,
          displayCurrency,
          buildLines,
          buildSummary,
          effectiveCurrency,
          blockingStatement,
        })
      : state.buildTab === 'OBJECTS'
        ? renderBuildObjectsTab(projections, buildCandidates)
        : state.buildTab === 'QC_DEDUCTIONS'
          ? renderBuildQcDeductionTab(projections, buildLines)
          : renderBuildSummaryTab({
              editingDraft,
              selectedScope,
              buildLines,
              buildSummary,
              displayCurrency,
              canGenerate,
            })

  return `
    <section class="bg-background">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">${editingDraft ? '继续编辑草稿' : '新建对账单'}</h2>
          <p class="mt-1 text-sm text-muted-foreground">业务人员自定义时间段生成对账单；工厂档案结算周期仅作参考。当前阶段车缝领料对账暂不进入对账单生成。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="back-to-list">
          返回列表
        </button>
      </div>

      ${
        scopes.length === 0
          ? `<p class="mt-6 py-8 text-center text-sm text-muted-foreground">当前暂无可新建对账单的工厂、时间段和结算对象范围</p>`
          : `
            ${renderBuildTabNav()}
            ${tabContent}
          `
      }
    </section>
  `
}

export function renderStatementsPage(): string {
  applyStatementPageDemoBootstrap()
  const pageBoundary = getSettlementPageBoundary('statements')
  const listItems = getStatementPageListItems(getStatementListItems())
  const buildScopes = listStatementBuildScopes()
  const detail = state.detailStatementId ? getStatementDetailViewModel(state.detailStatementId) : null

  return `
    <div class="flex flex-col gap-6 p-6" data-fast-page-render="true">
      ${
        state.activeView === 'LIST'
          ? `
            <section>
              <h1 class="text-xl font-semibold text-foreground">对账单</h1>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
            </section>
          `
          : ''
      }

      ${state.activeView === 'LIST' ? renderListView(listItems, buildScopes) : renderBuildView(buildScopes)}
      ${renderDetailDialog(detail)}
      ${renderProxyConfirmationDialog()}
    </div>
  `
}

export function handleStatementsEvent(target: HTMLElement): boolean {
  const listFilterNode = target.closest<HTMLElement>('[data-stm-list-filter]')
  if (listFilterNode instanceof HTMLInputElement || listFilterNode instanceof HTMLSelectElement) {
    const field = listFilterNode.dataset.stmListFilter
    if (field === 'keyword') {
      state.keyword = listFilterNode.value
      resetStatementListPage()
      return true
    }
    if (field === 'party') {
      state.filterParty = listFilterNode.value
      resetStatementListPage()
      return true
    }
    if (field === 'cycle') {
      state.filterCycle = listFilterNode.value
      resetStatementListPage()
      return true
    }
    if (field === 'status') {
      state.filterStatus = listFilterNode.value as StatusFilter
      resetStatementListPage()
      return true
    }
    if (field === 'feedback') {
      state.filterFeedback = listFilterNode.value as FeedbackFilter
      resetStatementListPage()
      return true
    }
    if (field === 'page-size') {
      const nextPageSize = Number(listFilterNode.value)
      if (STATEMENT_LIST_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
        state.listPageSize = nextPageSize
        resetStatementListPage()
      }
      return true
    }
    return true
  }

  const buildFieldNode = target.closest<HTMLElement>('[data-stm-build-field]')
  if (buildFieldNode instanceof HTMLInputElement || buildFieldNode instanceof HTMLTextAreaElement || buildFieldNode instanceof HTMLSelectElement) {
    const field = buildFieldNode.dataset.stmBuildField
    const scopes = listStatementBuildScopes()
    if (field === 'factory' && buildFieldNode instanceof HTMLSelectElement) {
      state.buildFactoryId = buildFieldNode.value
      state.buildCycleId = getBuildCycleOptions(scopes, state.buildFactoryId)[0]?.settlementCycleId ?? ''
      state.selectedLedgerIds = []
      state.selectedProductionOrderNos = []
      clearBuildManualDeductions()
      return true
    }
    if (field === 'start-date' && buildFieldNode instanceof HTMLInputElement) {
      state.buildStartDate = buildFieldNode.value
      state.selectedLedgerIds = []
      state.selectedProductionOrderNos = []
      clearBuildManualDeductions()
      return true
    }
    if (field === 'end-date' && buildFieldNode instanceof HTMLInputElement) {
      state.buildEndDate = buildFieldNode.value
      state.selectedLedgerIds = []
      state.selectedProductionOrderNos = []
      clearBuildManualDeductions()
      return true
    }
    if (field === 'object-mode' && buildFieldNode instanceof HTMLSelectElement) {
      state.buildObjectMode = buildFieldNode.value as StatementSettlementObjectMode
      state.selectedLedgerIds = []
      state.selectedProductionOrderNos = []
      clearBuildManualDeductions()
      return true
    }
    if (field === 'currency' && buildFieldNode instanceof HTMLSelectElement) {
      state.buildCurrency = buildFieldNode.value as SettlementCurrency
      return true
    }
    if (field === 'cycle' && buildFieldNode instanceof HTMLSelectElement) {
      state.buildCycleId = buildFieldNode.value
      return true
    }
    if (field === 'remark' && (buildFieldNode instanceof HTMLTextAreaElement || buildFieldNode instanceof HTMLInputElement)) {
      state.buildRemark = buildFieldNode.value
      return true
    }
    if (field === 'manual-defect-production-order-amount' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      const reasonName = buildFieldNode.dataset.reason
      if (productionOrderNo && reasonName) {
        setManualDefectProductionOrderDeduction(productionOrderNo, reasonName, { amount: buildFieldNode.value })
      }
      return true
    }
    if (field === 'manual-defect-production-order-remark' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      const reasonName = buildFieldNode.dataset.reason
      if (productionOrderNo && reasonName) {
        setManualDefectProductionOrderDeduction(productionOrderNo, reasonName, { remark: buildFieldNode.value })
      }
      return true
    }
    if (field === 'manual-delay-production-order-amount' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      if (productionOrderNo) setManualDelayProductionOrderDeduction(productionOrderNo, { amount: buildFieldNode.value })
      return true
    }
    if (field === 'manual-delay-production-order-remark' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      if (productionOrderNo) setManualDelayProductionOrderDeduction(productionOrderNo, { remark: buildFieldNode.value })
      return true
    }
    return true
  }

  const appealFieldNode = target.closest<HTMLElement>('[data-stm-appeal-field]')
  if (appealFieldNode instanceof HTMLSelectElement || appealFieldNode instanceof HTMLTextAreaElement) {
    const field = appealFieldNode.dataset.stmAppealField
    if (field === 'result' && appealFieldNode instanceof HTMLSelectElement) {
      state.appealResolutionResult = appealFieldNode.value as StatementsState['appealResolutionResult']
      return true
    }
    if (field === 'comment' && appealFieldNode instanceof HTMLTextAreaElement) {
      state.appealResolutionComment = appealFieldNode.value
      return true
    }
    return true
  }

  const proxyFieldNode = target.closest<HTMLElement>('[data-stm-proxy-field]')
  if (
    proxyFieldNode instanceof HTMLSelectElement ||
    proxyFieldNode instanceof HTMLTextAreaElement ||
    proxyFieldNode instanceof HTMLInputElement
  ) {
    const field = proxyFieldNode.dataset.stmProxyField
    if (field === 'method' && proxyFieldNode instanceof HTMLSelectElement) {
      state.proxyConfirmMethod = proxyFieldNode.value as StatementsState['proxyConfirmMethod']
      return true
    }
    if (field === 'notification-status' && proxyFieldNode instanceof HTMLSelectElement) {
      state.proxyConfirmNotificationStatus = proxyFieldNode.value as StatementProxyNotificationStatus
      if (
        proxyFieldNode.value === 'NOTIFIED' &&
        (!state.proxyConfirmNotificationRemark || state.proxyConfirmNotificationRemark === '待补通知三方工厂')
      ) {
        state.proxyConfirmNotificationRemark = '已在三方工厂端展示跟单审核代确认结果'
      }
      if (proxyFieldNode.value === 'PENDING') state.proxyConfirmNotificationRemark = '待补通知三方工厂'
      if (proxyFieldNode.value === 'FAILED') state.proxyConfirmNotificationRemark = '通知三方工厂失败，需补通知'
      return true
    }
    if (field === 'reason' && proxyFieldNode instanceof HTMLTextAreaElement) {
      state.proxyConfirmReason = proxyFieldNode.value
      return true
    }
    if (field === 'remark' && proxyFieldNode instanceof HTMLTextAreaElement) {
      state.proxyConfirmRemark = proxyFieldNode.value
      return true
    }
    if (field === 'notification-remark' && proxyFieldNode instanceof HTMLInputElement) {
      state.proxyConfirmNotificationRemark = proxyFieldNode.value
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-stm-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.stmAction
  if (!action) return false
  let cachedBuildScopes: StatementBuildScopeViewModel[] | null = null
  const getBuildScopesForAction = (): StatementBuildScopeViewModel[] => {
    if (cachedBuildScopes) return cachedBuildScopes
    cachedBuildScopes = listStatementBuildScopes()
    return cachedBuildScopes
  }

  if (action === 'set-list-page') {
    const nextPage = Number(actionNode.dataset.page)
    if (Number.isFinite(nextPage)) state.listPage = Math.max(1, nextPage)
    return true
  }

  if (action === 'prev-list-page') {
    state.listPage = Math.max(1, state.listPage - 1)
    return true
  }

  if (action === 'next-list-page') {
    state.listPage += 1
    return true
  }

  if (action === 'set-build-tab') {
    const nextTab = actionNode.dataset.buildTab as StatementBuildTab | undefined
    if (nextTab && getStatementBuildTabs().some((item) => item.key === nextTab)) state.buildTab = nextTab
    return true
  }

  if (action === 'open-build') {
    openBuildView(getBuildScopesForAction())
    return true
  }

  if (action === 'back-to-list') {
    state.activeView = 'LIST'
    resetBuildState(getBuildScopesForAction())
    return true
  }

  if (action === 'open-detail') {
    const statementId = actionNode.dataset.statementId
    if (statementId) state.detailStatementId = statementId
    if (state.processingAppealStatementId !== statementId) resetAppealResolutionState()
    return true
  }

  if (action === 'close-detail') {
    state.detailStatementId = null
    resetAppealResolutionState()
    resetProxyConfirmationState()
    return true
  }

  if (action === 'edit-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    openBuildView(getBuildScopesForAction(), getStatementDraftById(statementId))
    state.detailStatementId = null
    resetAppealResolutionState()
    return true
  }

  if (action === 'open-existing-statement') {
    const statementId = actionNode.dataset.statementId
    if (statementId) {
      state.detailStatementId = statementId
      state.activeView = 'LIST'
    }
    resetAppealResolutionState()
    return true
  }

  if (action === 'generate') {
    const scopes = getBuildScopesForAction()
    const scope = getSelectedBuildScope(scopes)
    if (!scope) {
      showStatementsToast('请先选择工厂', 'error')
      return true
    }
    if (!isBuildRangeReady()) {
      showStatementsToast('请先选择对账时间段', 'error')
      return true
    }
    if (!isBuildRangeValid()) {
      showStatementsToast('开始日期不能晚于结束日期', 'error')
      return true
    }
    if (getEffectiveBuildCurrency() === null) {
      showStatementsToast('当前时间段存在多个币种，请拆分时间段或按币种分别生成', 'error')
      return true
    }

    const result = createStatementDraftFromScope(scope, state.buildRemark, '平台运营')
    if (!result.ok) {
      showStatementsToast(result.message ?? '生成失败', 'error')
      if (result.existingStatementId) state.detailStatementId = result.existingStatementId
      return true
    }

    showStatementsToast('已生成对账单草稿')
    state.activeView = 'LIST'
    state.detailStatementId = result.statementId ?? null
    resetBuildState(scopes)
    return true
  }

  if (action === 'save-build') {
    const scopes = getBuildScopesForAction()
    const scope = getSelectedBuildScope(scopes)
    const statementId = state.editingStatementId
    if (!scope || !statementId) {
      showStatementsToast('当前草稿缺少工厂或时间段', 'error')
      return true
    }

    const lines = getBuildLines(scopes)
    if (!lines.length) {
      showStatementsToast('当前工厂和时间段暂无可生成的对账明细行', 'error')
      return true
    }

    const result = syncStatementDraftFromBuild({
      statementId,
      remark: state.buildRemark,
      itemSourceIds: lines.map((item) => item.sourceItemId).filter(Boolean) as string[],
      itemBasisIds: lines
        .filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION')
        .map((item) => item.sourceItemId ?? item.basisId)
        .filter(Boolean) as string[],
      items: lines,
      by: '平台运营',
    })

    if (!result.ok) {
      showStatementsToast(result.message ?? '保存失败', 'error')
      return true
    }

    showStatementsToast('草稿已更新')
    state.activeView = 'LIST'
    state.detailStatementId = statementId
    resetBuildState(scopes)
    return true
  }

  if (action === 'confirm-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = confirmStatementDraft(statementId, '平台运营')
    if (!result.ok) {
      showStatementsToast(result.message ?? '操作失败', 'error')
      return true
    }
    showStatementsToast('对账单已下发工厂反馈')
    return true
  }

  if (action === 'open-proxy-confirm') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const statement = getStatementDraftById(statementId)
    if (!statement || !canProxyConfirmStatement(statement)) {
      showStatementsToast('当前对账单不满足跟单审核代确认条件', 'error')
      return true
    }
    resetProxyConfirmationState()
    state.proxyConfirmStatementId = statementId
    return true
  }

  if (action === 'close-proxy-confirm') {
    resetProxyConfirmationState()
    return true
  }

  if (action === 'submit-proxy-confirm') {
    const statementId = actionNode.dataset.statementId || state.proxyConfirmStatementId
    if (!statementId) return true
    if (!state.proxyConfirmMethod) {
      showStatementsToast('请选择线下确认方式', 'error')
      return true
    }
    if (!state.proxyConfirmReason.trim()) {
      showStatementsToast('请填写跟单审核代确认原因', 'error')
      return true
    }
    const result = submitStatementMerchandiserProxyConfirmation({
      statementId,
      by: '跟单A',
      reason: state.proxyConfirmReason.trim(),
      method: state.proxyConfirmMethod,
      remark: state.proxyConfirmRemark.trim(),
      notificationStatus: state.proxyConfirmNotificationStatus,
      notificationRemark: state.proxyConfirmNotificationRemark.trim(),
    })
    if (!result.ok) {
      showStatementsToast(result.message ?? '跟单审核代确认失败', 'error')
      return true
    }
    resetProxyConfirmationState()
    state.detailStatementId = statementId
    showStatementsToast('跟单审核代确认已完成，三方工厂端可见该确认来源')
    return true
  }

  if (action === 'open-process-appeal') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = startStatementAppealHandling({
      statementId,
      by: '平台运营',
      remark: '平台已受理工厂申诉，处理中',
    })
    if (!result.ok) {
      showStatementsToast(result.message ?? '无法受理当前申诉', 'error')
      return true
    }
    state.processingAppealStatementId = statementId
    state.appealResolutionResult = ''
    state.appealResolutionComment = ''
    showStatementsToast('已进入申诉处理')
    return true
  }

  if (action === 'cancel-process-appeal') {
    resetAppealResolutionState()
    return true
  }

  if (action === 'submit-appeal-resolution') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    if (!state.appealResolutionResult) {
      showStatementsToast('请选择处理结果', 'error')
      return true
    }
    if (!state.appealResolutionComment.trim()) {
      showStatementsToast('请填写处理意见', 'error')
      return true
    }
    const result = resolveStatementAppeal({
      statementId,
      by: '平台运营',
      result: state.appealResolutionResult,
      comment: state.appealResolutionComment.trim(),
    })
    if (!result.ok) {
      showStatementsToast(result.message ?? '处理失败', 'error')
      return true
    }
    const resolutionResult = state.appealResolutionResult
    resetAppealResolutionState()
    showStatementsToast(resolutionResult === 'UPHELD' ? '已维持当前口径，可继续进入后续预付款' : '已关闭当前单据，需调整后重算')
    return true
  }

  if (action === 'close-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = closeStatementDraft(statementId, '平台运营')
    if (!result.ok) {
      showStatementsToast(result.message ?? '操作失败', 'error')
      return true
    }
    showStatementsToast('对账单已关闭')
    if (state.editingStatementId === statementId) {
      state.activeView = 'LIST'
      resetBuildState(getBuildScopesForAction())
    }
    resetAppealResolutionState()
    return true
  }

  return false
}

export function isStatementsDialogOpen(): boolean {
  return state.detailStatementId !== null
}
