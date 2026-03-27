import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import {
  buildStatementDraftLines,
  getStatementDetailViewModel,
  getStatementListItems,
  getStatementSourceItemById,
  listStatementBuildCandidates,
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
  getLatestStatementAppeal,
  getOpenStatementAppeal,
  getStatementSettlementProgressView,
  getStatementDraftById,
  initialStatementDrafts,
  resolveStatementAppeal,
  startStatementAppealHandling,
  syncStatementDraftFromBuild,
} from '../data/fcs/store-domain-settlement-seeds'
import type {
  FactoryFeedbackStatus,
  StatementAppealRecord,
  StatementDraft,
  StatementDraftItem,
  StatementResolutionResult,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type StatementPageView = 'LIST' | 'BUILD'
type StatusFilter = '__ALL__' | StatementStatus
type FeedbackFilter = '__ALL__' | FactoryFeedbackStatus

interface StatementsState {
  activeView: StatementPageView
  keyword: string
  filterParty: string
  filterCycle: string
  filterStatus: StatusFilter
  filterFeedback: FeedbackFilter
  detailStatementId: string | null
  buildFactoryId: string
  buildCycleId: string
  buildRemark: string
  editingStatementId: string | null
  processingAppealStatementId: string | null
  appealResolutionResult: '' | StatementResolutionResult
  appealResolutionComment: string
}

interface StatementOverviewCounts {
  total: number
  draft: number
  pendingFactory: number
  readyForPrepayment: number
  inPrepaymentBatch: number
  prepaid: number
  closed: number
  buildableScopeCount: number
}

const STATUS_ZH: Record<StatementStatus, string> = {
  DRAFT: '草稿',
  PENDING_FACTORY_CONFIRM: '待工厂反馈',
  FACTORY_CONFIRMED: '工厂已确认',
  READY_FOR_PREPAYMENT: '待入预付款',
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

const PRICE_SOURCE_LABEL: Record<string, string> = {
  DISPATCH: '派单价',
  BIDDING: '竞价中标价',
  BID: '竞价中标价',
  OTHER_COMPAT: '兼容价格快照',
  NONE: '不适用',
}

const LINE_GRAIN_LABEL: Record<string, string> = {
  RETURN_INBOUND_BATCH: '回货批次行',
  NON_BATCH_QUALITY: '质量扣款流水行',
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
  detailStatementId: null,
  buildFactoryId: '',
  buildCycleId: '',
  buildRemark: '',
  editingStatementId: null,
  processingAppealStatementId: null,
  appealResolutionResult: '',
  appealResolutionComment: '',
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
  return value.toFixed(2)
}

function getFactoryFeedbackStatusLabel(status: FactoryFeedbackStatus): string {
  return FACTORY_FEEDBACK_LABEL[status]
}

function getFactoryFeedbackStatusBadge(status: FactoryFeedbackStatus): string {
  return FACTORY_FEEDBACK_BADGE[status]
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
    readyForPrepayment: listItems.filter((item) => item.status === 'READY_FOR_PREPAYMENT').length,
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
    if (state.filterStatus !== '__ALL__' && item.status !== state.filterStatus) return false
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

function getEditingDraft(): StatementDraft | null {
  if (!state.editingStatementId) return null
  return getStatementDraftById(state.editingStatementId)
}

function resetAppealResolutionState(): void {
  state.processingAppealStatementId = null
  state.appealResolutionResult = ''
  state.appealResolutionComment = ''
}

function getBuildCandidates(
  scopes: StatementBuildScopeViewModel[],
): StatementSourceItemViewModel[] {
  const editingDraft = getEditingDraft()
  if (editingDraft) {
    return editingDraft.itemSourceIds
      ?.map((itemId) => getStatementSourceItemById(itemId))
      .filter(Boolean) as StatementSourceItemViewModel[]
  }

  const selectedScope = getSelectedBuildScope(scopes)
  if (!selectedScope) return []
  return listStatementBuildCandidates(selectedScope.settlementPartyId, selectedScope.settlementCycleId)
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
    return buildStatementDraftLines(
      selectedScope.settlementPartyId,
      selectedScope.settlementCycleId,
    ).map((item) => ({
      ...item,
      lineTypeZh: LINE_GRAIN_LABEL[item.statementLineGrainType ?? 'OTHER_SOURCE_OBJECT'] ?? '其它来源行',
      sourceTypeZh:
        item.sourceLabelZh ??
        (item.sourceItemType === 'TASK_EARNING'
          ? '任务收入流水'
          : item.sourceItemType === 'QUALITY_DEDUCTION'
            ? '质量扣款流水'
            : '正式流水'),
      productionOrderNoDisplay: item.productionOrderNo ?? item.productionOrderId ?? '-',
      taskNoDisplay: item.taskNo ?? item.taskId ?? '-',
      routeToSourceResolved: item.routeToSource ?? '/fcs/settlement/statements',
    }))
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
    state.buildFactoryId = statement.settlementPartyId
    state.buildCycleId = statement.settlementCycleId ?? ''
    state.buildRemark = statement.remark ?? ''
    return
  }

  const firstScope = scopes[0]
  state.editingStatementId = null
  state.buildFactoryId = firstScope?.settlementPartyId ?? ''
  state.buildCycleId = firstScope?.settlementCycleId ?? ''
  state.buildRemark = ''
}

function resetBuildState(scopes: StatementBuildScopeViewModel[]): void {
  const firstScope = scopes[0]
  state.editingStatementId = null
  state.buildFactoryId = firstScope?.settlementPartyId ?? ''
  state.buildCycleId = firstScope?.settlementCycleId ?? ''
  state.buildRemark = ''
}

function createStatementDraftFromScope(
  scope: StatementBuildScopeViewModel,
  remark: string,
  by: string,
): { ok: boolean; message?: string; statementId?: string; existingStatementId?: string } {
  const lines = buildStatementDraftLines(scope.settlementPartyId, scope.settlementCycleId)
  if (!lines.length) return { ok: false, message: '当前工厂和结算周期暂无可生成的对账明细行' }

  const sourceCandidates = listStatementBuildCandidates(scope.settlementPartyId, scope.settlementCycleId)
  const timestamp = nowTimestamp()
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
    itemSourceIds: sourceCandidates.map((item) => item.sourceItemId),
    itemBasisIds: sourceCandidates
      .filter((item) => item.sourceType === 'QUALITY_DEDUCTION')
      .map((item) => item.sourceItemId),
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

function renderOverviewCard(title: string, value: string, note: string): string {
  return `
    <div class="rounded-xl border bg-background p-4">
      <div class="text-xs text-muted-foreground">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold tabular-nums">${escapeHtml(value)}</div>
      <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(note)}</div>
    </div>
  `
}

function renderStatementListRows(items: StatementListItemViewModel[]): string {
  return items
    .map(
      (item) => `
        <tr class="border-b last:border-b-0">
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementNo)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementPartyLabel)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementCycleLabel ?? '-')}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.currency)}</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[item.status]}">${STATUS_ZH[item.status]}</span>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${getFactoryFeedbackStatusBadge(item.factoryFeedbackStatus)}">${escapeHtml(
              getFactoryFeedbackStatusLabel(item.factoryFeedbackStatus),
            )}</span>
          </td>
          <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
          <td class="px-4 py-3 text-right tabular-nums">${item.totalQty}</td>
          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.totalEarningAmount)}</td>
          <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.totalDeductionAmount)}</td>
          <td class="px-4 py-3 text-right font-medium tabular-nums">${formatAmount(item.netPayableAmount)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.createdAt)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementProfileVersionNo)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.maskedAccountTail)}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${item.prepaymentBatchNo ? `${item.prepaymentBatchNo} · ${item.prepaymentBatchStatus === 'CLOSED' ? '已关闭' : item.prepaymentBatchStatus === 'PREPAID' ? '已预付' : '批次处理中'}` : item.readyForPrepaymentAt ? '已准备' : '未准备'}</td>
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
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

function renderBuildCandidateRows(items: StatementSourceItemViewModel[]): string {
  if (!items.length) {
    return `<p class="py-6 text-center text-sm text-muted-foreground">当前工厂和结算周期暂无可入单的正式流水。</p>`
  }

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[980px] text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">流水号</th>
            <th class="px-4 py-2 font-medium">流水类型</th>
            <th class="px-4 py-2 font-medium">任务号</th>
            <th class="px-4 py-2 font-medium">生产单号</th>
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
                  <td class="px-4 py-3 text-xs">${escapeHtml(item.productionOrderNo ?? item.productionOrderId ?? '-')}</td>
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
    return `<p class="py-6 text-center text-sm text-muted-foreground">当前工厂和结算周期暂无可生成的正式流水明细行。</p>`
  }

  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[1600px] text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            <th class="px-4 py-2 font-medium">明细类型</th>
            <th class="px-4 py-2 font-medium">回货批次号</th>
            <th class="px-4 py-2 font-medium">任务号</th>
            <th class="px-4 py-2 font-medium">生产单号</th>
            <th class="px-4 py-2 text-right font-medium">数量</th>
            <th class="px-4 py-2 font-medium">价格来源</th>
            <th class="px-4 py-2 text-right font-medium">单价</th>
            <th class="px-4 py-2 text-right font-medium">任务收入金额</th>
            <th class="px-4 py-2 text-right font-medium">质量扣款金额</th>
            <th class="px-4 py-2 text-right font-medium">本期应付净额</th>
            <th class="px-4 py-2 font-medium">查看来源详情</th>
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
                  <td class="px-4 py-3 text-xs">${escapeHtml(line.productionOrderNoDisplay)}</td>
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

function renderStatementLedgerSectionRows(
  lines: StatementDetailLineViewModel[],
  ledgerType: 'TASK_EARNING' | 'QUALITY_DEDUCTION',
): string {
  if (!lines.length) {
    return `<p class="py-6 text-center text-sm text-muted-foreground">当前暂无${ledgerType === 'TASK_EARNING' ? '任务收入流水' : '质量扣款流水'}明细。</p>`
  }

  if (ledgerType === 'TASK_EARNING') {
    return `
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1280px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">流水号</th>
              <th class="px-4 py-2 font-medium">任务号</th>
              <th class="px-4 py-2 font-medium">生产单号</th>
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
                    <td class="px-4 py-3 text-xs">${escapeHtml(line.productionOrderNoDisplay)}</td>
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
              (line) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.ledgerNo ?? line.sourceItemId)}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.qcRecordId ?? '-')}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.pendingDeductionRecordId ?? '-')}</td>
                  <td class="px-4 py-3 font-mono text-xs">${escapeHtml(line.disputeId ?? '-')}</td>
                  <td class="px-4 py-3 text-xs">${escapeHtml(line.remark ?? line.sourceTypeZh)}</td>
                  <td class="px-4 py-3 text-right tabular-nums">${line.returnInboundQty ?? line.deductionQty ?? 0}</td>
                  <td class="px-4 py-3 text-right font-medium tabular-nums">${formatAmount(line.qualityDeductionAmount ?? 0)}</td>
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

function renderDetailDialog(detail: StatementDetailViewModel | null): string {
  if (!detail) return ''
  const appealRecords = getStatementAppealRecords(detail.draft).slice().reverse()
  const openAppeal = getOpenStatementAppeal(detail.draft)
  const latestAppeal = getLatestStatementAppeal(detail.draft)
  const progressView = getStatementSettlementProgressView(detail.draft)
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
          <p class="mt-1 text-xs text-muted-foreground">当前详情按正式流水汇总单组织。任务收入流水与质量扣款流水分别展示，未最终裁决的质量异议不会计入当前对账单。</p>
        </header>

        <div class="flex-1 overflow-auto px-6 py-5">
          <section class="rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">基本信息</h4>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">对账单号</dt><dd class="font-mono text-xs">${escapeHtml(detail.draft.statementNo ?? detail.draft.statementId)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">工厂</dt><dd class="text-right text-xs">${escapeHtml(detail.settlementPartyLabel)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算周期</dt><dd class="text-right text-xs">${escapeHtml(detail.draft.settlementCycleLabel ?? '-')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">对账单状态</dt><dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[detail.draft.status]}">${STATUS_ZH[detail.draft.status]}</span></dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">创建时间</dt><dd class="text-xs">${escapeHtml(detail.draft.createdAt)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">创建人</dt><dd class="text-xs">${escapeHtml(detail.draft.createdBy)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算资料版本号</dt><dd class="text-xs font-medium">${escapeHtml(detail.draft.settlementProfileVersionNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算币种</dt><dd class="text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.settlementConfigSnapshot.currency)}</dd></div>
            </dl>
          </section>

          <section class="mt-4 rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">金额概况</h4>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">任务收入流水合计</dt><dd class="font-medium tabular-nums">${formatAmount(detail.totalEarningAmount)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">质量扣款流水合计</dt><dd class="font-medium tabular-nums">${formatAmount(detail.totalQualityDeductionAmount)}</dd></div>
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
                <h4 class="text-sm font-semibold">质量扣款流水明细</h4>
                <p class="mt-1 text-xs text-muted-foreground">仅展示已正式成立的质量扣款流水，未最终裁决的质量异议不会计入当前单据。</p>
              </div>
            </div>
            ${renderStatementLedgerSectionRows(detail.deductionLines, 'QUALITY_DEDUCTION')}
          </section>

          <section class="mt-4 rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">工厂反馈</h4>
            <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">工厂反馈状态</dt><dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${getFactoryFeedbackStatusBadge(detail.draft.factoryFeedbackStatus)}">${escapeHtml(getFactoryFeedbackStatusLabel(detail.draft.factoryFeedbackStatus))}</span></dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">反馈时间</dt><dd class="text-xs">${escapeHtml(detail.draft.factoryFeedbackAt || '当前未反馈')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">反馈人</dt><dd class="text-xs">${escapeHtml(detail.draft.factoryFeedbackBy || '当前未反馈')}</dd></div>
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
                        <textarea class="min-h-[88px] rounded-md border bg-background px-3 py-2 text-sm" data-stm-appeal-field="comment" placeholder="请填写处理意见">${escapeHtml(state.appealResolutionComment)}</textarea>
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
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">币种</dt><dd class="text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.settlementConfigSnapshot.currency)}</dd></div>
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
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前已下发工厂，待工厂确认或申诉后才能决定是否进入后续预付款。</span>`
                  : ''
              }
              ${
                detail.draft.status === 'READY_FOR_PREPAYMENT'
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前已完成正式流水汇总并等待进入后续预付款批次。</span>`
                  : ''
              }
              ${
                detail.draft.status === 'IN_PREPAYMENT_BATCH'
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前单据已进入预付款批次，可从后续预付款执行页继续跟进。</span>`
                  : ''
              }
              ${
                detail.draft.status === 'PREPAID'
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前单据已完成预付款，保留后续回写与历史查看。</span>`
                  : ''
              }
              ${
                detail.draft.status === 'CLOSED'
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">当前已关闭，仅保留口径和历史查看。</span>`
                  : ''
              }
            </div>
          </section>
        </div>
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
  const partyOptions = getStatementPartyOptions(listItems)
  const cycleOptions = getStatementCycleOptions(listItems)

  return `
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      ${renderOverviewCard('对账单总数', String(counts.total), '默认列表先展示所有工厂、所有周期的正式对账单对象。')}
      ${renderOverviewCard('草稿中', String(counts.draft), '草稿可继续编辑、确认或关闭。')}
      ${renderOverviewCard('待工厂反馈', String(counts.pendingFactory), '平台已下发，等待工厂确认或申诉。')}
      ${renderOverviewCard('待入预付款', String(counts.readyForPrepayment), '已完成正式流水汇总并等待后续预付款批次消费。')}
      ${renderOverviewCard('已入预付款批次', String(counts.inPrepaymentBatch), '已被后续预付款批次消费，后续查看批次执行进度。')}
      ${renderOverviewCard('已预付', String(counts.prepaid), '当前周期的预付款已完成，保留打款回写和历史查看。')}
      ${renderOverviewCard('已关闭', String(counts.closed), '已关闭单据仅保留查看，不再继续流转。')}
      ${renderOverviewCard('可新建范围', String(counts.buildableScopeCount), '按工厂 + 结算周期统计可新建对账单的范围。')}
    </section>

    <section class="rounded-xl border bg-background p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">对账单列表</h2>
          <p class="mt-1 text-sm text-muted-foreground">默认主视图先展示所有工厂、所有周期的对账单。新建时必须先选工厂和结算周期，再自动加载该范围内的回货批次明细行。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="open-build">
          新建对账单
        </button>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <input
          class="h-9 w-48 rounded-md border bg-background px-3 text-sm"
          data-stm-list-filter="keyword"
          placeholder="对账单号 / 工厂"
          value="${escapeHtml(state.keyword)}"
        />
        <select class="h-9 w-52 rounded-md border bg-background px-3 text-sm" data-stm-list-filter="party">
          <option value="__ALL__" ${state.filterParty === '__ALL__' ? 'selected' : ''}>全部工厂</option>
          ${partyOptions
            .map(
              (item) => `<option value="${escapeHtml(item.value)}" ${state.filterParty === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
            )
            .join('')}
        </select>
        <select class="h-9 w-56 rounded-md border bg-background px-3 text-sm" data-stm-list-filter="cycle">
          <option value="__ALL__" ${state.filterCycle === '__ALL__' ? 'selected' : ''}>全部结算周期</option>
          ${cycleOptions
            .map(
              (item) => `<option value="${escapeHtml(item.value)}" ${state.filterCycle === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`,
            )
            .join('')}
        </select>
        <select class="h-9 w-40 rounded-md border bg-background px-3 text-sm" data-stm-list-filter="status">
          <option value="__ALL__" ${state.filterStatus === '__ALL__' ? 'selected' : ''}>全部状态</option>
          <option value="DRAFT" ${state.filterStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
          <option value="PENDING_FACTORY_CONFIRM" ${state.filterStatus === 'PENDING_FACTORY_CONFIRM' ? 'selected' : ''}>待工厂反馈</option>
          <option value="FACTORY_CONFIRMED" ${state.filterStatus === 'FACTORY_CONFIRMED' ? 'selected' : ''}>工厂已确认</option>
          <option value="READY_FOR_PREPAYMENT" ${state.filterStatus === 'READY_FOR_PREPAYMENT' ? 'selected' : ''}>待入预付款</option>
          <option value="IN_PREPAYMENT_BATCH" ${state.filterStatus === 'IN_PREPAYMENT_BATCH' ? 'selected' : ''}>已入预付款批次</option>
          <option value="PREPAID" ${state.filterStatus === 'PREPAID' ? 'selected' : ''}>已预付</option>
          <option value="CLOSED" ${state.filterStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
        </select>
        <select class="h-9 w-44 rounded-md border bg-background px-3 text-sm" data-stm-list-filter="feedback">
          <option value="__ALL__" ${state.filterFeedback === '__ALL__' ? 'selected' : ''}>全部工厂反馈</option>
          ${Object.entries(FACTORY_FEEDBACK_LABEL)
            .map(
              ([value, label]) => `<option value="${value}" ${state.filterFeedback === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
            )
            .join('')}
        </select>
      </div>

      ${
        filteredItems.length === 0
          ? `<p class="py-8 text-center text-sm text-muted-foreground">当前筛选条件下暂无对账单</p>`
          : `
            <div class="mt-4 overflow-x-auto rounded-md border">
              <table class="w-full min-w-[1820px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">对账单号</th>
                    <th class="px-4 py-2 font-medium">工厂 / 结算对象</th>
                    <th class="px-4 py-2 font-medium">结算周期</th>
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
                <tbody>${renderStatementListRows(filteredItems)}</tbody>
              </table>
            </div>
          `
      }
    </section>
  `
}

function renderBuildView(scopes: StatementBuildScopeViewModel[]): string {
  const editingDraft = getEditingDraft()
  const factoryOptions = getBuildFactoryOptions(scopes)
  const cycleOptions = getBuildCycleOptions(scopes, state.buildFactoryId)
  const selectedScope = getSelectedBuildScope(scopes)
  const buildCandidates = getBuildCandidates(scopes)
  const buildLines = getBuildLines(scopes)
  const buildSummary = getBuildLineSummary(buildLines)
  const duplicatedStatement =
    selectedScope == null
      ? null
      : findOpenStatementByPartyAndCycle(selectedScope.settlementPartyId, selectedScope.settlementCycleId)
  const blockingStatement =
    duplicatedStatement && duplicatedStatement.statementId !== state.editingStatementId
      ? duplicatedStatement
      : null

  return `
    <section class="rounded-xl border bg-background p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">${editingDraft ? '继续编辑草稿' : '新建对账单'}</h2>
          <p class="mt-1 text-sm text-muted-foreground">必须先选工厂和结算周期，再自动加载该范围内的回货批次明细行。当前阶段车缝领料对账暂不进入对账单生成。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="back-to-list">
          返回列表
        </button>
      </div>

      ${
        scopes.length === 0
          ? `<p class="mt-6 py-8 text-center text-sm text-muted-foreground">当前暂无可新建对账单的工厂和结算周期范围</p>`
          : `
            <div class="mt-4 grid gap-4 lg:grid-cols-[1.1fr,1fr]">
              <section class="rounded-lg border bg-muted/20 p-4">
                <h3 class="text-sm font-semibold">步骤 1：选择工厂与结算周期</h3>
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
                    <span class="text-muted-foreground">结算周期</span>
                    <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="cycle" ${editingDraft ? 'disabled' : ''}>
                      <option value="">请选择结算周期</option>
                      ${cycleOptions
                        .map(
                          (item) => `<option value="${escapeHtml(item.settlementCycleId)}" ${state.buildCycleId === item.settlementCycleId ? 'selected' : ''}>${escapeHtml(item.settlementCycleLabel)}</option>`,
                        )
                        .join('')}
                    </select>
                  </label>
                </div>
                <label class="mt-3 grid gap-1 text-sm">
                  <span class="text-muted-foreground">备注</span>
                  <textarea class="min-h-[84px] rounded-md border bg-background px-3 py-2 text-sm" data-stm-build-field="remark" placeholder="说明当前对账单口径或需要关注的事项">${escapeHtml(state.buildRemark)}</textarea>
                </label>

                ${
                  selectedScope
                    ? `
                      <div class="mt-4 rounded-md border bg-background p-3 text-sm">
                        <div class="flex flex-wrap items-center gap-4">
                          <span>工厂：<strong>${escapeHtml(selectedScope.settlementPartyLabel)}</strong></span>
                          <span>结算周期：<strong>${escapeHtml(selectedScope.settlementCycleLabel)}</strong></span>
                          <span>可纳入正式流水：<strong>${selectedScope.candidateCount}</strong> 条</span>
                          <span>本期应付净额：<strong>${formatAmount(selectedScope.netPayableAmount)}</strong></span>
                        </div>
                      </div>
                    `
                    : ''
                }

                ${
                  blockingStatement
                    ? `
                      <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                        <div>该工厂该结算周期已存在未关闭对账单 <strong>${escapeHtml(blockingStatement.statementId)}</strong>，不能重复生成。</div>
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
                  ${
                    editingDraft
                      ? `<button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="save-build" ${selectedScope == null ? 'disabled' : ''}>保存草稿</button>`
                      : `<button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="generate" ${selectedScope == null || blockingStatement ? 'disabled' : ''}>确认生成草稿</button>`
                  }
                  <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-stm-action="back-to-list">取消</button>
                </div>
              </section>

              <section class="rounded-lg border bg-muted/20 p-4">
                <h3 class="text-sm font-semibold">步骤 2：查看正式流水总览</h3>
                <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">正式流水明细行</dt><dd class="font-medium tabular-nums">${buildLines.length}</dd></div>
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">任务收入流水数</dt><dd class="font-medium tabular-nums">${buildSummary.earningCount}</dd></div>
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">质量扣款流水数</dt><dd class="font-medium tabular-nums">${buildSummary.deductionCount}</dd></div>
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">任务收入流水合计</dt><dd class="font-medium tabular-nums">${formatAmount(buildSummary.totalEarningAmount)}</dd></div>
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">质量扣款流水合计</dt><dd class="font-medium tabular-nums">${formatAmount(buildSummary.totalQualityDeductionAmount)}</dd></div>
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">总数量</dt><dd class="font-medium tabular-nums">${buildSummary.totalQty}</dd></div>
                  <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">本期应付净额</dt><dd class="font-medium tabular-nums">${formatAmount(buildSummary.netPayableAmount)}</dd></div>
                </dl>
              </section>
            </div>

            <section class="mt-4 rounded-lg border bg-card p-4">
              <div class="mb-3">
                <h3 class="text-sm font-semibold">正式流水候选</h3>
                <p class="mt-1 text-xs text-muted-foreground">这里仅展示当前工厂和结算周期下可入单的任务收入流水与质量扣款流水。待确认质量扣款记录和未最终裁决的质量异议不会进入本期对账单。</p>
              </div>
              ${renderBuildCandidateRows(buildCandidates)}
            </section>

            <section class="mt-4 rounded-lg border bg-card p-4">
              <div class="mb-3">
                <h3 class="text-sm font-semibold">正式流水明细预览</h3>
                <p class="mt-1 text-xs text-muted-foreground">任务收入流水和质量扣款流水会分别进入同一张正式流水汇总单，页面只做正向合计、反向合计和本期应付净额的汇总，不再先拼净额行。</p>
              </div>
              ${renderBuildLineRows(buildLines)}
            </section>
          `
      }
    </section>
  `
}

export function renderStatementsPage(): string {
  const pageBoundary = getSettlementPageBoundary('statements')
  const listItems = getStatementListItems()
  const buildScopes = listStatementBuildScopes()
  const detail = state.detailStatementId ? getStatementDetailViewModel(state.detailStatementId) : null

  return `
    <div class="flex flex-col gap-6 p-6">
      <section>
        <h1 class="text-xl font-semibold text-foreground">对账单</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
      </section>

      <section class="rounded-xl border bg-background p-4">
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="inline-flex h-9 items-center rounded-full border px-4 text-sm ${
              state.activeView === 'LIST' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'
            }"
            data-stm-action="switch-page-view"
            data-view="LIST"
            type="button"
          >
            对账单列表
          </button>
          <button
            class="inline-flex h-9 items-center rounded-full border px-4 text-sm ${
              state.activeView === 'BUILD' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'
            }"
            data-stm-action="open-build"
            type="button"
          >
            新建 / 编辑草稿
          </button>
        </div>
      </section>

      ${state.activeView === 'LIST' ? renderListView(listItems, buildScopes) : renderBuildView(buildScopes)}
      ${renderDetailDialog(detail)}
    </div>
  `
}

export function handleStatementsEvent(target: HTMLElement): boolean {
  const listFilterNode = target.closest<HTMLElement>('[data-stm-list-filter]')
  if (listFilterNode instanceof HTMLInputElement || listFilterNode instanceof HTMLSelectElement) {
    const field = listFilterNode.dataset.stmListFilter
    if (field === 'keyword') {
      state.keyword = listFilterNode.value
      return true
    }
    if (field === 'party') {
      state.filterParty = listFilterNode.value
      return true
    }
    if (field === 'cycle') {
      state.filterCycle = listFilterNode.value
      return true
    }
    if (field === 'status') {
      state.filterStatus = listFilterNode.value as StatusFilter
      return true
    }
    if (field === 'feedback') {
      state.filterFeedback = listFilterNode.value as FeedbackFilter
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

  const actionNode = target.closest<HTMLElement>('[data-stm-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.stmAction
  if (!action) return false
  const scopes = listStatementBuildScopes()

  if (action === 'switch-page-view') {
    const view = actionNode.dataset.view as StatementPageView | undefined
    if (!view) return true
    state.activeView = view
    if (view === 'BUILD' && !state.buildFactoryId && scopes.length) {
      resetBuildState(scopes)
    }
    return true
  }

  if (action === 'open-build') {
    openBuildView(scopes)
    return true
  }

  if (action === 'back-to-list') {
    state.activeView = 'LIST'
    resetBuildState(scopes)
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
    return true
  }

  if (action === 'edit-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    openBuildView(scopes, getStatementDraftById(statementId))
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
    const scope = getSelectedBuildScope(scopes)
    if (!scope) {
      showStatementsToast('请先选择工厂和结算周期', 'error')
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
    const scope = getSelectedBuildScope(scopes)
    const statementId = state.editingStatementId
    if (!scope || !statementId) {
      showStatementsToast('当前草稿缺少工厂或结算周期', 'error')
      return true
    }

    const lines = getBuildLines(scopes)
    if (!lines.length) {
      showStatementsToast('当前工厂和结算周期暂无可生成的对账明细行', 'error')
      return true
    }

    const sourceCandidates = getBuildCandidates(scopes)
    const result = syncStatementDraftFromBuild({
      statementId,
      remark: state.buildRemark,
      itemSourceIds: sourceCandidates.map((item) => item.sourceItemId),
      itemBasisIds: sourceCandidates
        .filter((item) => item.sourceType === 'QUALITY_DEDUCTION')
        .map((item) => item.sourceItemId),
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
      resetBuildState(scopes)
    }
    resetAppealResolutionState()
    return true
  }

  return false
}

export function isStatementsDialogOpen(): boolean {
  return state.detailStatementId !== null
}
