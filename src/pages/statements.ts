import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { getSettlementPageBoundary } from '../data/fcs/settlement-flow-boundaries'
import {
  getStatementSourceItemById,
  listStatementSourceItems,
  toStatementDraftItemFromSource,
  type StatementSourceItemViewModel,
} from '../data/fcs/store-domain-statement-source-adapter'
import {
  buildStatementSettlementProfileSnapshot,
  getStatementDraftById,
  initialStatementDrafts,
} from '../data/fcs/store-domain-settlement-seeds'
import type {
  FactoryFeedbackStatus,
  StatementDraft,
  StatementDraftItem,
  StatementFactoryAppealRecord,
  StatementSourceItemType,
  StatementStatus,
} from '../data/fcs/store-domain-settlement-types'
import type { SettlementPartyType } from '../data/fcs/store-domain-quality-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type SourceFilter = '__ALL__' | StatementSourceItemType
type StatusBadgeClass = Record<StatementStatus, string>
type FeedbackBadgeClass = Record<FactoryFeedbackStatus, string>
type StatementWorkbenchView = 'PENDING_BUILD' | 'DRAFT' | 'CONFIRMED' | 'CLOSED'

interface StatementWorkbenchCounts {
  pendingBuild: number
  draft: number
  confirmed: number
  closed: number
  settlementPartyCount: number
  candidateAmount: number
}

interface StatementDetailViewModel {
  draft: StatementDraft
  sourceTypeSummary: string
  sourceTotalAmount: number
  qualitySourceAmount: number
  otherSourceAmount: number
  maskedAccountNo: string
  hasFactoryAppeal: boolean
}

interface StatementsState {
  activeView: StatementWorkbenchView
  keyword: string
  filterParty: string
  filterSource: SourceFilter
  selected: Set<string>
  remark: string
  detailStatementId: string | null
}

const SOURCE_TYPE_ZH: Record<StatementSourceItemType, string> = {
  QUALITY_BASIS: '质量来源',
  PAYABLE_ADJUSTMENT: '应付调整',
  MATERIAL_STATEMENT: '车缝领料对账',
}

const PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

const STATUS_ZH: Record<StatementStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const STATUS_BADGE_CLASS: StatusBadgeClass = {
  DRAFT: 'border bg-muted text-muted-foreground',
  CONFIRMED: 'border border-blue-200 bg-blue-50 text-blue-700',
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

const FACTORY_FEEDBACK_BADGE: FeedbackBadgeClass = {
  NOT_SENT: 'border bg-muted text-muted-foreground',
  PENDING_FACTORY_CONFIRM: 'border border-amber-200 bg-amber-50 text-amber-700',
  FACTORY_CONFIRMED: 'border border-green-200 bg-green-50 text-green-700',
  FACTORY_APPEALED: 'border border-red-200 bg-red-50 text-red-700',
  PLATFORM_HANDLING: 'border border-blue-200 bg-blue-50 text-blue-700',
  RESOLVED: 'border border-slate-200 bg-slate-50 text-slate-700',
}

const state: StatementsState = {
  activeView: 'PENDING_BUILD',
  keyword: '',
  filterParty: '__ALL__',
  filterSource: '__ALL__',
  selected: new Set<string>(),
  remark: '',
  detailStatementId: null,
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

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getFactoryFeedbackStatusLabel(status: FactoryFeedbackStatus): string {
  return FACTORY_FEEDBACK_LABEL[status]
}

function getFactoryFeedbackStatusBadge(status: FactoryFeedbackStatus): string {
  return FACTORY_FEEDBACK_BADGE[status]
}

function formatFactoryAppealBrief(record: StatementFactoryAppealRecord | undefined): string {
  if (!record) return '当前无工厂申诉'
  return `${record.reason} · ${record.submittedAt}`
}

function getFactoryAppealStatusLabel(status: StatementFactoryAppealRecord['status']): string {
  if (status === 'SUBMITTED') return '已提交'
  if (status === 'PLATFORM_HANDLING') return '平台处理中'
  return '已处理完成'
}

function sourceLabel(item: StatementSourceItemViewModel | StatementDraftItem): string {
  if ('sourceLabelZh' in item && item.sourceLabelZh) return item.sourceLabelZh
  if ('sourceItemType' in item && item.sourceItemType) return SOURCE_TYPE_ZH[item.sourceItemType] ?? item.sourceItemType
  if ('sourceType' in item) {
    if (item.sourceType === 'PAYABLE_ADJUSTMENT') return SOURCE_TYPE_ZH.PAYABLE_ADJUSTMENT
    if (item.sourceType === 'MATERIAL_STATEMENT') return SOURCE_TYPE_ZH.MATERIAL_STATEMENT
    return SOURCE_TYPE_ZH.QUALITY_BASIS
  }
  return '其它来源'
}

function sourceKey(item: StatementSourceItemViewModel): SourceFilter {
  return item.sourceType
}

function partyLabel(type?: string, id?: string): string {
  if (!type || !id) return '-'
  return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`
}

function getCandidateItems(): StatementSourceItemViewModel[] {
  return listStatementSourceItems().filter((item) => item.canEnterStatement)
}

function getPartyOptions(candidates: StatementSourceItemViewModel[]): Array<{ key: string; type: string; id: string }> {
  const map = new Map<string, { type: string; id: string }>()
  for (const item of candidates) {
    if (!item.settlementPartyType || !item.settlementPartyId) continue
    const key = `${item.settlementPartyType}|${item.settlementPartyId}`
    map.set(key, { type: item.settlementPartyType, id: item.settlementPartyId })
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, type: value.type, id: value.id }))
}

function getFilteredCandidates(candidates: StatementSourceItemViewModel[]): StatementSourceItemViewModel[] {
  const keyword = state.keyword.trim().toLowerCase()

  return candidates.filter((item) => {
    if (state.filterParty !== '__ALL__') {
      const [type, id] = state.filterParty.split('|')
      if (item.settlementPartyType !== type || item.settlementPartyId !== id) return false
    }

    if (state.filterSource !== '__ALL__' && sourceKey(item) !== state.filterSource) return false

    if (keyword) {
      const haystack = [
        item.sourceItemId,
        item.productionOrderId,
        item.settlementPartyId,
        item.taskId ?? '',
        item.sourceReason ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    return true
  })
}

function getSelectedSources(filtered: StatementSourceItemViewModel[]): StatementSourceItemViewModel[] {
  return filtered.filter((item) => state.selected.has(item.sourceItemId))
}

function getStatementWorkbenchCounts(candidates: StatementSourceItemViewModel[]): StatementWorkbenchCounts {
  const settlementPartyCount = new Set(
    candidates
      .filter((item) => item.settlementPartyType && item.settlementPartyId)
      .map((item) => `${item.settlementPartyType}|${item.settlementPartyId}`),
  ).size

  return {
    pendingBuild: candidates.length,
    draft: initialStatementDrafts.filter((item) => item.status === 'DRAFT').length,
    confirmed: initialStatementDrafts.filter((item) => item.status === 'CONFIRMED').length,
    closed: initialStatementDrafts.filter((item) => item.status === 'CLOSED').length,
    settlementPartyCount,
    candidateAmount: candidates.reduce((sum, item) => sum + item.amount, 0),
  }
}

function getStatementListByView(view: StatementWorkbenchView): StatementDraft[] {
  const sortByCreatedAtDesc = (items: StatementDraft[]) =>
    [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

  if (view === 'DRAFT') {
    return sortByCreatedAtDesc(initialStatementDrafts.filter((item) => item.status === 'DRAFT'))
  }
  if (view === 'CONFIRMED') {
    return sortByCreatedAtDesc(initialStatementDrafts.filter((item) => item.status === 'CONFIRMED'))
  }
  if (view === 'CLOSED') {
    return sortByCreatedAtDesc(initialStatementDrafts.filter((item) => item.status === 'CLOSED'))
  }
  return []
}

function getStatementSourceTypeSummary(items: StatementDraftItem[]): string {
  const summaryMap = new Map<string, number>()
  for (const item of items) {
    const label = sourceLabel(item)
    summaryMap.set(label, (summaryMap.get(label) ?? 0) + 1)
  }

  const summary = Array.from(summaryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count}条`)
    .join(' / ')

  return summary || '当前以质量来源为主，后续继续接入应付调整与车缝领料对账'
}

function getStatementDetailViewModel(detailDraft: StatementDraft): StatementDetailViewModel {
  const qualitySourceAmount = detailDraft.items
    .filter((item) => item.sourceItemType === 'QUALITY_BASIS')
    .reduce((sum, item) => sum + item.deductionAmount, 0)
  const sourceTotalAmount = detailDraft.items.reduce((sum, item) => sum + item.deductionAmount, 0)

  return {
    draft: detailDraft,
    sourceTypeSummary: getStatementSourceTypeSummary(detailDraft.items),
    sourceTotalAmount,
    qualitySourceAmount,
    otherSourceAmount: Math.max(0, sourceTotalAmount - qualitySourceAmount),
    maskedAccountNo: maskBankAccountNo(detailDraft.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo),
    hasFactoryAppeal: Boolean(detailDraft.factoryAppealRecord),
  }
}

function generateStatementDraft(
  input: {
    settlementPartyType: SettlementPartyType
    settlementPartyId: string
    sourceItemIds: string[]
    remark?: string
  },
  by: string,
): { ok: boolean; statementId?: string; message?: string } {
  const { settlementPartyType, settlementPartyId, sourceItemIds, remark } = input
  if (!sourceItemIds.length) return { ok: false, message: '请先选择至少一条来源项' }

  const selectedItems: StatementSourceItemViewModel[] = []
  for (const sourceItemId of sourceItemIds) {
    const source = getStatementSourceItemById(sourceItemId)
    if (!source) return { ok: false, message: `来源项 ${sourceItemId} 不存在` }
    if (!source.canEnterStatement) {
      return { ok: false, message: `来源项 ${sourceItemId} 当前不可纳入对账单` }
    }
    if (
      source.settlementPartyType !== settlementPartyType ||
      source.settlementPartyId !== settlementPartyId
    ) {
      return { ok: false, message: `来源项 ${sourceItemId} 的结算对象与选定对象不一致` }
    }
    selectedItems.push(source)
  }

  const timestamp = nowTimestamp()
  const month = timestamp.slice(0, 7).replace('-', '')
  let statementId = `ST-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  while (initialStatementDrafts.some((item) => item.statementId === statementId)) {
    statementId = `ST-${month}-${randomSuffix(4)}`
  }

  const items: StatementDraftItem[] = selectedItems.map((item) => toStatementDraftItemFromSource(item))
  const settlementProfileSnapshot = buildStatementSettlementProfileSnapshot(settlementPartyType, settlementPartyId)
  const qualityBasisIds = selectedItems
    .filter((item) => item.sourceType === 'QUALITY_BASIS')
    .map((item) => item.sourceItemId)

  const draft: StatementDraft = {
    statementId,
    settlementPartyType,
    settlementPartyId,
    itemCount: items.length,
    totalQty: items.reduce((sum, item) => sum + item.deductionQty, 0),
    totalAmount: items.reduce((sum, item) => sum + item.deductionAmount, 0),
    status: 'DRAFT',
    itemBasisIds: qualityBasisIds,
    itemSourceIds: sourceItemIds,
    items,
    remark,
    settlementProfileSnapshot,
    settlementProfileVersionNo: settlementProfileSnapshot.versionNo,
    statementPartyView: partyLabel(settlementPartyType, settlementPartyId),
    factoryFeedbackStatus: 'NOT_SENT',
    createdAt: timestamp,
    createdBy: by,
  }

  initialStatementDrafts.push(draft)
  return { ok: true, statementId }
}

function confirmStatementDraft(statementId: string, by: string): { ok: boolean; message?: string } {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return { ok: false, message: `对账单 ${statementId} 不存在` }
  if (draft.status === 'CONFIRMED') return { ok: true }
  if (draft.status === 'CLOSED') return { ok: false, message: '已关闭的对账单不可确认' }

  draft.status = 'CONFIRMED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  draft.factoryFeedbackStatus = 'PENDING_FACTORY_CONFIRM'
  draft.factoryFeedbackAt = draft.updatedAt
  draft.factoryFeedbackBy = by
  draft.factoryFeedbackRemark = '平台已确认对账单，等待工厂反馈'
  return { ok: true }
}

function closeStatementDraft(statementId: string, by: string): { ok: boolean; message?: string } {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return { ok: false, message: `对账单 ${statementId} 不存在` }
  if (draft.status === 'CLOSED') return { ok: true }

  draft.status = 'CLOSED'
  draft.updatedAt = nowTimestamp()
  draft.updatedBy = by
  return { ok: true }
}

function renderDetailDialog(detailDraft: StatementDraft | null): string {
  if (!detailDraft) return ''

  const detail = getStatementDetailViewModel(detailDraft)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-stm-action="close-detail" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-stm-action="close-detail" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="mb-4 space-y-1">
          <h3 class="text-lg font-semibold">对账单详情 — ${escapeHtml(detail.draft.statementId)}</h3>
          <p class="text-xs text-muted-foreground">
            当前详情用于查看这张对账单的冻结口径、来源项清单和后续动作，已统一承接质量来源、应付调整和车缝领料对账来源。
          </p>
        </header>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <section class="rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">对账单基本信息</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">对账单号</dt><dd class="font-mono text-xs">${escapeHtml(detail.draft.statementId)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算对象</dt><dd class="text-right text-xs">${escapeHtml(partyLabel(detail.draft.settlementPartyType, detail.draft.settlementPartyId))}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">状态</dt><dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[detail.draft.status]}">${STATUS_ZH[detail.draft.status]}</span></dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算资料版本</dt><dd class="text-xs font-medium">${escapeHtml(detail.draft.settlementProfileVersionNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">收款账号</dt><dd class="text-xs">${escapeHtml(detail.maskedAccountNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">创建时间</dt><dd class="text-xs">${escapeHtml(detail.draft.createdAt)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">创建人</dt><dd class="text-xs">${escapeHtml(detail.draft.createdBy)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">备注</dt><dd class="max-w-[220px] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.remark || '未填写')}</dd></div>
            </dl>
          </section>

          <section class="rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">对账口径概况</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">条目数</dt><dd class="font-medium tabular-nums">${detail.draft.itemCount}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">总数量</dt><dd class="font-medium tabular-nums">${detail.draft.totalQty}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">总金额</dt><dd class="font-medium tabular-nums">${detail.draft.totalAmount.toFixed(2)}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">来源类型概况</dt><dd class="max-w-[220px] text-right text-xs text-muted-foreground">${escapeHtml(detail.sourceTypeSummary)}</dd></div>
            </dl>
          </section>

          <section class="rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">金额构成</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">本单总金额</dt><dd class="font-medium tabular-nums">${detail.draft.totalAmount.toFixed(2)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">来源项总金额</dt><dd class="font-medium tabular-nums">${detail.sourceTotalAmount.toFixed(2)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">质量来源金额</dt><dd class="font-medium tabular-nums">${detail.qualitySourceAmount.toFixed(2)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">其它来源金额</dt><dd class="font-medium tabular-nums">${detail.otherSourceAmount.toFixed(2)}</dd></div>
            </dl>
          </section>

          <section class="rounded-lg border bg-muted/20 p-4">
            <h4 class="text-sm font-semibold">生命周期动作</h4>
            <p class="mt-3 text-xs text-muted-foreground">
              这张对账单当前处于${STATUS_ZH[detail.draft.status]}。草稿可继续确认或关闭；已确认单据会等待工厂反馈，再进入结算批次执行链路。
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              ${
                detail.draft.status === 'DRAFT'
                  ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="confirm-draft" data-statement-id="${escapeHtml(detail.draft.statementId)}">确认对账单</button>`
                  : ''
              }
              ${
                detail.draft.status === 'DRAFT' || detail.draft.status === 'CONFIRMED'
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-stm-action="close-draft" data-statement-id="${escapeHtml(detail.draft.statementId)}">关闭对账单</button>`
                  : ''
              }
              ${
                detail.draft.status === 'CONFIRMED'
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">后续可从结算批次查看执行进度</span>`
                  : ''
              }
              ${
                detail.draft.status === 'CLOSED'
                  ? `<span class="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">已关闭单据仅保留查看口径</span>`
                  : ''
              }
            </div>
          </section>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">结算资料快照</h4>
            <p class="mt-1 text-xs text-muted-foreground">对账单生成时已冻结当前结算资料版本，后续主数据新增版本只影响未来新单据。</p>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">版本号</dt><dd class="font-medium">${escapeHtml(detail.draft.settlementProfileVersionNo)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">生效时间</dt><dd class="text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.effectiveAt)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算币种</dt><dd>${escapeHtml(detail.draft.settlementProfileSnapshot.settlementConfigSnapshot.currency)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">结算周期规则</dt><dd class="max-w-[65%] text-right text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.settlementConfigSnapshot.settlementDayRule)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">收款银行</dt><dd class="max-w-[65%] text-right text-xs">${escapeHtml(detail.draft.settlementProfileSnapshot.receivingAccountSnapshot.bankName)}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">账号尾号</dt><dd class="text-xs">${escapeHtml(detail.maskedAccountNo)}</dd></div>
            </dl>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h4 class="text-sm font-semibold">工厂反馈</h4>
            <p class="mt-1 text-xs text-muted-foreground">平台状态与工厂反馈状态并行记录，工厂端确认或申诉后会直接回写到当前对账单对象。</p>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">反馈状态</dt>
                <dd><span class="inline-flex rounded-md px-2 py-0.5 text-xs ${getFactoryFeedbackStatusBadge(detail.draft.factoryFeedbackStatus)}">${escapeHtml(
                  getFactoryFeedbackStatusLabel(detail.draft.factoryFeedbackStatus),
                )}</span></dd>
              </div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">反馈时间</dt><dd class="text-xs">${escapeHtml(detail.draft.factoryFeedbackAt || '当前未反馈')}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">反馈人</dt><dd class="text-xs">${escapeHtml(detail.draft.factoryFeedbackBy || '当前未反馈')}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">反馈说明</dt><dd class="max-w-[65%] text-right text-xs text-muted-foreground">${escapeHtml(detail.draft.factoryFeedbackRemark || '当前无反馈说明')}</dd></div>
              <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">工厂申诉</dt><dd class="max-w-[65%] text-right text-xs text-muted-foreground">${escapeHtml(
                formatFactoryAppealBrief(detail.draft.factoryAppealRecord),
              )}</dd></div>
            </dl>
          </section>
        </div>

        ${
          detail.draft.factoryAppealRecord
            ? `
              <section class="mt-4 rounded-lg border bg-card p-4">
                <h4 class="text-sm font-semibold">工厂申诉记录</h4>
                <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">申诉编号</dt><dd class="text-right text-xs">${escapeHtml(detail.draft.factoryAppealRecord.appealId)}</dd></div>
                  <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">申诉状态</dt><dd class="text-right text-xs">${escapeHtml(getFactoryAppealStatusLabel(detail.draft.factoryAppealRecord.status))}</dd></div>
                  <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">申诉原因</dt><dd class="text-right text-xs">${escapeHtml(detail.draft.factoryAppealRecord.reason)}</dd></div>
                  <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">提交时间</dt><dd class="text-right text-xs">${escapeHtml(detail.draft.factoryAppealRecord.submittedAt)}</dd></div>
                  <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">提交人</dt><dd class="text-right text-xs">${escapeHtml(detail.draft.factoryAppealRecord.submittedBy)}</dd></div>
                  <div class="flex items-start justify-between gap-3"><dt class="text-muted-foreground">证据说明</dt><dd class="max-w-[65%] text-right text-xs text-muted-foreground">${escapeHtml(
                    detail.draft.factoryAppealRecord.evidenceSummary || '当前未补充证据说明',
                  )}</dd></div>
                  <div class="md:col-span-2 flex items-start justify-between gap-3"><dt class="text-muted-foreground">申诉说明</dt><dd class="max-w-[80%] text-right text-xs text-muted-foreground">${escapeHtml(
                    detail.draft.factoryAppealRecord.description,
                  )}</dd></div>
                </dl>
              </section>
            `
            : ''
        }

        <section class="mt-4">
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <h4 class="text-sm font-semibold">来源项清单</h4>
              <p class="text-xs text-muted-foreground">这里统一展示对账单已纳入的来源项，后续会继续接更多正式来源对象。</p>
            </div>
          </div>
        <div class="max-h-[44vh] overflow-auto rounded-md border">
          <table class="w-full min-w-[940px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-4 py-2 font-medium">来源编号</th>
                <th class="px-4 py-2 font-medium">来源类型</th>
                <th class="px-4 py-2 font-medium">生产单</th>
                <th class="px-4 py-2 font-medium">结算对象</th>
                <th class="px-4 py-2 text-right font-medium">数量</th>
                <th class="px-4 py-2 text-right font-medium">金额</th>
                <th class="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${detail.draft.items
                .map(
                  (item) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.sourceItemId ?? item.basisId)}</td>
                      <td class="px-4 py-3 text-sm">${escapeHtml(sourceLabel(item))}</td>
                      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.productionOrderId ?? '-')}</td>
                      <td class="px-4 py-3 text-xs">${escapeHtml(partyLabel(item.settlementPartyType, item.settlementPartyId))}</td>
                      <td class="px-4 py-3 text-right tabular-nums">${item.deductionQty}</td>
                      <td class="px-4 py-3 text-right tabular-nums">${item.deductionAmount.toFixed(2)}</td>
                      <td class="px-4 py-3">
                        <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(item.routeToSource ?? '/fcs/settlement/statements')}">查看来源对象</button>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
        </section>
      </section>
    </div>
  `
}

function renderWorkbenchCard(
  view: StatementWorkbenchView,
  title: string,
  value: string,
  note: string,
  active = false,
): string {
  return `
    <button
      class="rounded-xl border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 ${
        active ? 'border-blue-300 bg-blue-50/60' : 'bg-background'
      }"
      data-stm-action="switch-view"
      data-view="${view}"
      type="button"
    >
      <div class="text-xs text-muted-foreground">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground tabular-nums">${escapeHtml(value)}</div>
      <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(note)}</div>
    </button>
  `
}

function getStatementWorkbenchViewLabel(view: StatementWorkbenchView): string {
  if (view === 'PENDING_BUILD') return '待生成'
  if (view === 'DRAFT') return '草稿中'
  if (view === 'CONFIRMED') return '已确认'
  return '已关闭'
}

function renderStatementRows(statements: StatementDraft[]): string {
  return statements
    .map(
      (item) => `
        <tr class="border-b last:border-b-0">
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.statementId)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(partyLabel(item.settlementPartyType, item.settlementPartyId))}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(getStatementSourceTypeSummary(item.items))}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementProfileVersionNo)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(item.settlementProfileSnapshot.settlementConfigSnapshot.currency)}</td>
          <td class="px-4 py-3 text-xs">${escapeHtml(maskBankAccountNo(item.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo))}</td>
          <td class="px-4 py-3 text-right tabular-nums">${item.itemCount}</td>
          <td class="px-4 py-3 text-right tabular-nums">${item.totalQty}</td>
          <td class="px-4 py-3 text-right tabular-nums">${item.totalAmount.toFixed(2)}</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[item.status]}">
              ${STATUS_ZH[item.status]}
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${getFactoryFeedbackStatusBadge(item.factoryFeedbackStatus)}">
              ${escapeHtml(getFactoryFeedbackStatusLabel(item.factoryFeedbackStatus))}
            </span>
          </td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${item.factoryAppealRecord ? '有申诉' : '无申诉'}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.createdAt)}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="open-detail" data-statement-id="${escapeHtml(item.statementId)}">查看明细</button>
              ${
                item.status === 'DRAFT'
                  ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="confirm-draft" data-statement-id="${escapeHtml(item.statementId)}">确认</button>`
                  : ''
              }
              ${
                item.status === 'DRAFT' || item.status === 'CONFIRMED'
                  ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-stm-action="close-draft" data-statement-id="${escapeHtml(item.statementId)}">关闭</button>`
                  : ''
              }
              ${
                item.status === 'CONFIRMED'
                  ? `<span class="inline-flex h-7 items-center rounded-md border border-dashed px-2 text-[11px] text-muted-foreground">后续进入结算批次</span>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

export function renderStatementsPage(): string {
  const pageBoundary = getSettlementPageBoundary('statements')
  const candidates = getCandidateItems()
  const filtered = getFilteredCandidates(candidates)
  const partyOptions = getPartyOptions(candidates)
  const selectedSources = getSelectedSources(filtered)
  const firstSelected = selectedSources[0]
  const selectedQty = selectedSources.reduce((sum, item) => sum + item.qty, 0)
  const selectedAmount = selectedSources.reduce((sum, item) => sum + item.amount, 0)
  const counts = getStatementWorkbenchCounts(candidates)
  const viewStatements = getStatementListByView(state.activeView)
  const detailDraft =
    state.detailStatementId == null
      ? null
      : getStatementDraftById(state.detailStatementId)

  return `
    <div class="flex flex-col gap-6 p-6">
      <section>
        <h1 class="text-xl font-semibold text-foreground">对账单</h1>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(pageBoundary.pageIntro)}</p>
      </section>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        ${renderWorkbenchCard('PENDING_BUILD', '待生成', String(counts.pendingBuild), `涉及 ${counts.settlementPartyCount} 个结算对象，可生成来源项金额 ${counts.candidateAmount.toFixed(2)}`, state.activeView === 'PENDING_BUILD')}
        ${renderWorkbenchCard('DRAFT', '草稿中', String(counts.draft), '草稿用于冻结本期口径，待平台确认后进入后续链路。', state.activeView === 'DRAFT')}
        ${renderWorkbenchCard('CONFIRMED', '已确认', String(counts.confirmed), '已确认对账单会作为进入结算批次的直接输入。', state.activeView === 'CONFIRMED')}
        ${renderWorkbenchCard('CLOSED', '已关闭', String(counts.closed), '已关闭对账单只保留口径和历史，不再继续流转。', state.activeView === 'CLOSED')}
      </section>

      <section class="rounded-xl border bg-background p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${(['PENDING_BUILD', 'DRAFT', 'CONFIRMED', 'CLOSED'] as StatementWorkbenchView[])
            .map(
              (view) => `
                <button
                  class="inline-flex h-9 items-center rounded-full border px-4 text-sm ${
                    state.activeView === view ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'
                  }"
                  data-stm-action="switch-view"
                  data-view="${view}"
                  type="button"
                >
                  ${escapeHtml(getStatementWorkbenchViewLabel(view))}
                </button>
              `,
            )
            .join('')}
        </div>
      </section>

      ${
        state.activeView === 'PENDING_BUILD'
          ? `
      <section>
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold">待生成来源项</h2>
            <p class="mt-1 text-sm text-muted-foreground">这里统一承接待纳入对账单的多来源对象，当前已接入质量来源、应付调整和车缝领料对账。</p>
          </div>
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-3">
          <input
            class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
            data-stm-filter="keyword"
            placeholder="关键词"
            value="${escapeHtml(state.keyword)}"
          />

          <select class="h-9 w-52 rounded-md border bg-background px-3 text-sm" data-stm-filter="party">
            <option value="__ALL__" ${state.filterParty === '__ALL__' ? 'selected' : ''}>全部结算对象</option>
            ${partyOptions
              .map(
                (item) =>
                  `<option value="${escapeHtml(item.key)}" ${state.filterParty === item.key ? 'selected' : ''}>${escapeHtml(
                    partyLabel(item.type, item.id),
                  )}</option>`,
              )
              .join('')}
          </select>

          <select class="h-9 w-40 rounded-md border bg-background px-3 text-sm" data-stm-filter="source">
            <option value="__ALL__" ${state.filterSource === '__ALL__' ? 'selected' : ''}>全部来源</option>
            <option value="QUALITY_BASIS" ${state.filterSource === 'QUALITY_BASIS' ? 'selected' : ''}>质量来源</option>
            <option value="PAYABLE_ADJUSTMENT" ${state.filterSource === 'PAYABLE_ADJUSTMENT' ? 'selected' : ''}>应付调整</option>
            <option value="MATERIAL_STATEMENT" ${state.filterSource === 'MATERIAL_STATEMENT' ? 'selected' : ''}>车缝领料对账</option>
          </select>
        </div>

        ${
          selectedSources.length > 0
            ? `
              <div class="mb-3 flex flex-wrap items-center gap-4 rounded-md border bg-muted/40 px-4 py-2 text-sm">
                <span>已选 <strong>${selectedSources.length}</strong> 条</span>
                <span>结算对象：<strong>${escapeHtml(
                  partyLabel(firstSelected?.settlementPartyType, firstSelected?.settlementPartyId),
                )}</strong></span>
                <span>合计数量：<strong>${selectedQty}</strong></span>
                <span>合计金额：<strong>${selectedAmount.toFixed(2)}</strong></span>
                <input
                  class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
                  data-stm-field="remark"
                  placeholder="备注（可选）"
                  value="${escapeHtml(state.remark)}"
                />
                <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-stm-action="generate">
                  生成对账单草稿
                </button>
              </div>
            `
            : ''
        }

        ${
          filtered.length === 0
            ? `
              <p class="py-6 text-center text-sm text-muted-foreground">暂无待纳入对账单的来源项</p>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="w-10 px-4 py-2"></th>
                      <th class="px-4 py-2 font-medium">来源编号</th>
                      <th class="px-4 py-2 font-medium">来源类型</th>
                      <th class="px-4 py-2 font-medium">生产单</th>
                      <th class="px-4 py-2 font-medium">结算对象</th>
                      <th class="px-4 py-2 text-right font-medium">数量</th>
                      <th class="px-4 py-2 text-right font-medium">金额</th>
                      <th class="px-4 py-2 font-medium">更新时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3">
                              <input
                                type="checkbox"
                                class="h-4 w-4 rounded border-border align-middle"
                                data-stm-field="candidate-check"
                                data-source-item-id="${escapeHtml(item.sourceItemId)}"
                                ${state.selected.has(item.sourceItemId) ? 'checked' : ''}
                              />
                            </td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.sourceItemId)}</td>
                            <td class="px-4 py-3 text-sm">${escapeHtml(sourceLabel(item))}</td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(item.productionOrderId ?? '-')}</td>
                            <td class="px-4 py-3 text-xs">${escapeHtml(
                              partyLabel(item.settlementPartyType, item.settlementPartyId),
                            )}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.qty}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${item.amount.toFixed(2)}</td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.updatedAt ?? item.createdAt ?? '-')}</td>
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
      </section>
          `
          : `
      <section>
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold">${escapeHtml(getStatementWorkbenchViewLabel(state.activeView))}对账单</h2>
            <p class="mt-1 text-sm text-muted-foreground">这里统一展示对账单对象，不再把草稿、已确认和已关闭拆成附属表。</p>
          </div>
        </div>
        ${
          viewStatements.length === 0
            ? `
              <p class="py-6 text-center text-sm text-muted-foreground">当前视图暂无对账单</p>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1220px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-4 py-2 font-medium">对账单号</th>
                      <th class="px-4 py-2 font-medium">结算对象</th>
                      <th class="px-4 py-2 font-medium">来源类型概况</th>
                      <th class="px-4 py-2 font-medium">版本号</th>
                      <th class="px-4 py-2 font-medium">结算币种</th>
                      <th class="px-4 py-2 font-medium">收款账号</th>
                      <th class="px-4 py-2 text-right font-medium">条目数</th>
                      <th class="px-4 py-2 text-right font-medium">总数量</th>
                      <th class="px-4 py-2 text-right font-medium">总金额</th>
                      <th class="px-4 py-2 font-medium">平台状态</th>
                      <th class="px-4 py-2 font-medium">工厂反馈</th>
                      <th class="px-4 py-2 font-medium">工厂申诉</th>
                      <th class="px-4 py-2 font-medium">创建时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderStatementRows(viewStatements)}</tbody>
                </table>
              </div>
            `
        }
      </section>
          `
      }

      ${renderDetailDialog(detailDraft)}
    </div>
  `
}

export function handleStatementsEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-stm-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.stmFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'party') {
      state.filterParty = filterNode.value
      return true
    }
    if (field === 'source') {
      state.filterSource = filterNode.value as SourceFilter
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-stm-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.stmField
    if (field === 'remark') {
      state.remark = fieldNode.value
      return true
    }

    if (field === 'candidate-check') {
      const sourceItemId = fieldNode.dataset.sourceItemId
      if (!sourceItemId) return true

      const candidates = getCandidateItems()
      const filtered = getFilteredCandidates(candidates)
      const source = filtered.find((item) => item.sourceItemId === sourceItemId)

      if (!fieldNode.checked) {
        state.selected.delete(sourceItemId)
        return true
      }

      if (!source) {
        state.selected.delete(sourceItemId)
        return true
      }

      const selectedSources = getSelectedSources(filtered)
      const firstSelected = selectedSources[0]
      const sameParty =
        !firstSelected ||
        (firstSelected.settlementPartyType === source.settlementPartyType &&
          firstSelected.settlementPartyId === source.settlementPartyId)

      if (!sameParty) {
        showStatementsToast('一次只能生成同一结算对象的对账单', 'error')
        state.selected.delete(sourceItemId)
        return true
      }

      state.selected.add(sourceItemId)
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-stm-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.stmAction
  if (!action) return false

  if (action === 'switch-view') {
    const view = actionNode.dataset.view as StatementWorkbenchView | undefined
    if (!view) return true

    state.activeView = view
    return true
  }

  if (action === 'generate') {
    const candidates = getCandidateItems()
    const filtered = getFilteredCandidates(candidates)
    const selectedSources = getSelectedSources(filtered)
    const firstSelected = selectedSources[0]

    if (!selectedSources.length || !firstSelected?.settlementPartyType || !firstSelected.settlementPartyId) {
      showStatementsToast('请先选择至少一条来源项', 'error')
      return true
    }

    const result = generateStatementDraft(
      {
        settlementPartyType: firstSelected.settlementPartyType as SettlementPartyType,
        settlementPartyId: firstSelected.settlementPartyId,
        sourceItemIds: selectedSources.map((item) => item.sourceItemId),
        remark: state.remark.trim() ? state.remark.trim() : undefined,
      },
      '操作员',
    )

    if (!result.ok) {
      showStatementsToast(result.message ?? '生成失败', 'error')
      return true
    }

    showStatementsToast('已生成对账单草稿')
    state.activeView = 'DRAFT'
    state.selected = new Set<string>()
    state.remark = ''
    return true
  }

  if (action === 'open-detail') {
    const statementId = actionNode.dataset.statementId
    if (statementId) state.detailStatementId = statementId
    return true
  }

  if (action === 'close-detail') {
    state.detailStatementId = null
    return true
  }

  if (action === 'confirm-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = confirmStatementDraft(statementId, '操作员')
    if (result.ok) {
      state.activeView = 'CONFIRMED'
      showStatementsToast('对账单已确认')
    }
    else showStatementsToast(result.message ?? '操作失败', 'error')
    return true
  }

  if (action === 'close-draft') {
    const statementId = actionNode.dataset.statementId
    if (!statementId) return true
    const result = closeStatementDraft(statementId, '操作员')
    if (result.ok) {
      state.activeView = 'CLOSED'
      showStatementsToast('对账单已关闭')
    }
    else showStatementsToast(result.message ?? '操作失败', 'error')
    return true
  }

  return true
}

export function isStatementsDialogOpen(): boolean {
  return state.detailStatementId !== null
}
