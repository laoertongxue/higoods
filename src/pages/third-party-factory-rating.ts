// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortDirection,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  getThirdPartyFactoryDispatchPolicyLabel,
  getThirdPartyFactorySettlementPolicyLabel,
  getThirdPartyFactoryTimingSummary,
  listThirdPartyFactoryPerformanceRecords,
  listThirdPartyFactoryRatingSnapshots,
  type FactoryRatingPerformanceRecord,
  type FactoryRatingSnapshot,
} from '../data/fcs/third-party-factory-rating.ts'
import {
  listThirdPartyFactoryTrialAssessmentRecords,
  type ThirdPartyFactoryTrialAssessmentRecord,
} from '../data/fcs/third-party-factory-trial-assessment.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_PATH = '/fcs/factories/third-party-rating'
const EVENT_PREFIX = 'third-party-rating'
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const COLUMN_STORAGE_KEY = 'fcs.third-party-factory-rating.columns.v3'
const MAX_FROZEN_WIDTH = 520

type DispatchFilter = 'ALL' | 'ALLOW' | 'LIMITED' | 'BLOCKED'
type SettlementFilter = 'ALL' | 'ALLOW' | 'BLOCKED'

interface RatingQuery {
  keyword: string
  grade: string
  cooperationStatus: string
  scale: string
  dispatch: DispatchFilter
  settlement: SettlementFilter
  page: number
  pageSize: number
  viewFactoryId: string
  sortKey: string
  sortDirection: StandardListSortDirection | ''
  columnSettings: boolean
  refreshKey: string
}

interface RatingRow extends FactoryRatingSnapshot {
  displayFactoryName: string
  displayFactoryCode: string
}

interface RatingPaging {
  total: number
  from: number
  to: number
  currentPage: number
  totalPages: number
  pageSize: number
}

let draggedColumnKey = ''

const columnRules = [
  { key: 'factory', required: true, freezeable: true },
  { key: 'grade', required: true },
  { key: 'score' },
  { key: 'cooperation', required: true },
  { key: 'scale' },
  { key: 'trialSummary' },
  { key: 'assessmentResult' },
  { key: 'dispatch' },
  { key: 'settlement' },
  { key: 'reason' },
  { key: 'actions', required: true, actionColumn: true },
]

const defaultColumnPreferences: StandardListColumnPreferences = normalizeListColumnPreferences(
  columnRules,
  {
    order: columnRules.map((column) => column.key),
    visibleKeys: columnRules.map((column) => column.key),
    frozenKeys: [],
    pageSize: 10,
  },
  PAGE_SIZE_OPTIONS,
)

function getListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function normalizeColumnPreferences(
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, raw, PAGE_SIZE_OPTIONS)
}

function getColumnPreferences(): StandardListColumnPreferences {
  const storage = getListStorage()
  if (!storage) return defaultColumnPreferences
  return normalizeColumnPreferences(loadListColumnPreferences(
    storage,
    COLUMN_STORAGE_KEY,
    columnRules,
    defaultColumnPreferences,
    PAGE_SIZE_OPTIONS,
  ))
}

function saveColumnPreferences(preferences: StandardListColumnPreferences): void {
  const storage = getListStorage()
  if (storage) saveListColumnPreferences(storage, COLUMN_STORAGE_KEY, normalizeColumnPreferences(preferences))
}

function clearColumnPreferences(): void {
  const storage = getListStorage()
  if (storage) clearListColumnPreferences(storage, COLUMN_STORAGE_KEY)
}

function readQuery(): RatingQuery {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const defaultPageSize = getColumnPreferences().pageSize
  const pageSize = Number(params.get('pageSize') ?? String(defaultPageSize))
  const sortDirection = params.get('sortDirection')

  return {
    keyword: params.get('keyword')?.trim() ?? '',
    grade: params.get('grade') ?? 'ALL',
    cooperationStatus: params.get('cooperationStatus') ?? 'ALL',
    scale: params.get('scale') ?? 'ALL',
    dispatch: normalizeDispatchFilter(params.get('dispatch')),
    settlement: normalizeSettlementFilter(params.get('settlement')),
    page: Math.max(1, Number(params.get('page') ?? '1') || 1),
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10,
    viewFactoryId: params.get('viewFactoryId') ?? '',
    sortKey: params.get('sortKey') ?? '',
    sortDirection: sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : '',
    columnSettings: params.get('columnSettings') === '1',
    refreshKey: params.get('refreshKey') ?? '',
  }
}

function normalizeDispatchFilter(value: string | null): DispatchFilter {
  if (value === 'ALLOW' || value === 'LIMITED' || value === 'BLOCKED') return value
  return 'ALL'
}

function normalizeSettlementFilter(value: string | null): SettlementFilter {
  if (value === 'ALLOW' || value === 'BLOCKED') return value
  return 'ALL'
}

function getSortState(query: RatingQuery): StandardListSortState | null {
  if (!query.sortKey || !query.sortDirection) return null
  return { key: query.sortKey, direction: query.sortDirection }
}

function buildHref(query: RatingQuery, patch: Partial<RatingQuery>): string {
  const next: RatingQuery = { ...query, ...patch }
  const params = new URLSearchParams()
  if (next.keyword) params.set('keyword', next.keyword)
  if (next.grade !== 'ALL') params.set('grade', next.grade)
  if (next.cooperationStatus !== 'ALL') params.set('cooperationStatus', next.cooperationStatus)
  if (next.scale !== 'ALL') params.set('scale', next.scale)
  if (next.dispatch !== 'ALL') params.set('dispatch', next.dispatch)
  if (next.settlement !== 'ALL') params.set('settlement', next.settlement)
  if (next.page > 1) params.set('page', String(next.page))
  if (next.pageSize !== 10) params.set('pageSize', String(next.pageSize))
  if (next.viewFactoryId) params.set('viewFactoryId', next.viewFactoryId)
  if (next.columnSettings) params.set('columnSettings', '1')
  if (next.refreshKey) params.set('refreshKey', next.refreshKey)
  if (next.sortKey && next.sortDirection) {
    params.set('sortKey', next.sortKey)
    params.set('sortDirection', next.sortDirection)
  }
  const search = params.toString()
  return search ? `${PAGE_PATH}?${search}` : PAGE_PATH
}

function getRatingRows(): RatingRow[] {
  return listThirdPartyFactoryRatingSnapshots().map((snapshot) => ({
    ...snapshot,
    displayFactoryName: snapshot.factoryName,
    displayFactoryCode: snapshot.factoryCode,
  }))
}

function isDispatchMatch(snapshot: FactoryRatingSnapshot, filter: DispatchFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'BLOCKED') return snapshot.cooperationStatusLabel === '黑名单'
  if (filter === 'LIMITED') return snapshot.cooperationStatusLabel === '考核中' || snapshot.currentGrade === 'B'
  return snapshot.cooperationStatusLabel === '正常合作' && snapshot.currentGrade !== 'B'
}

function isSettlementMatch(snapshot: FactoryRatingSnapshot, filter: SettlementFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'BLOCKED') return snapshot.settlementBlocked
  return !snapshot.settlementBlocked
}

function filterSnapshots(rows: RatingRow[], query: RatingQuery): RatingRow[] {
  const keyword = query.keyword.toLowerCase()

  return rows.filter((snapshot) => {
    const keywordMatched =
      !keyword ||
      snapshot.displayFactoryName.toLowerCase().includes(keyword) ||
      snapshot.factoryName.toLowerCase().includes(keyword) ||
      snapshot.displayFactoryCode.toLowerCase().includes(keyword) ||
      snapshot.factoryCode.toLowerCase().includes(keyword) ||
      snapshot.factoryId.toLowerCase().includes(keyword)

    return (
      keywordMatched &&
      (query.grade === 'ALL' || snapshot.currentGrade === query.grade) &&
      (query.cooperationStatus === 'ALL' || snapshot.cooperationStatusLabel === query.cooperationStatus) &&
      (query.scale === 'ALL' || snapshot.scaleLabel === query.scale) &&
      isDispatchMatch(snapshot, query.dispatch) &&
      isSettlementMatch(snapshot, query.settlement)
    )
  })
}

function renderSelect(name: string, value: string, options: Array<[string, string]>): string {
  return `
    <select name="${escapeHtml(name)}" class="h-9 min-w-0 rounded-md border bg-background px-3 text-sm" data-third-party-rating-field="${escapeHtml(name)}">
      ${options.map(([optionValue, label]) => {
        const formValue = optionValue === 'ALL' ? '' : optionValue
        const selected = optionValue === value ? 'selected' : ''
        return `<option value="${escapeHtml(formValue)}" ${selected}>${escapeHtml(label)}</option>`
      }).join('')}
    </select>
  `
}

function renderFilters(query: RatingQuery): string {
  return `
    <form action="${PAGE_PATH}" method="get" class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 xl:grid-cols-[minmax(240px,1.6fr)_repeat(5,minmax(132px,1fr))_auto]" data-third-party-rating-filters>
      <input type="hidden" name="page" value="1">
      <input type="hidden" name="pageSize" value="${escapeHtml(query.pageSize)}">
      <input name="keyword" value="${escapeHtml(query.keyword)}" class="h-9 min-w-0 rounded-md border bg-background px-3 text-sm" placeholder="工厂名称 / 编码" data-third-party-rating-field="keyword" />
      ${renderSelect('grade', query.grade, [['ALL', '全部评级'], ['S', 'S 级'], ['A', 'A 级'], ['B', 'B 级'], ['C', 'C 级']])}
      ${renderSelect('cooperationStatus', query.cooperationStatus, [['ALL', '全部合作状态'], ['正常合作', '正常合作'], ['考核中', '考核中'], ['黑名单', '黑名单']])}
      ${renderSelect('scale', query.scale, [['ALL', '全部规模'], ['大型工厂', '大型工厂'], ['小型工厂', '小型工厂']])}
      ${renderSelect('dispatch', query.dispatch, [['ALL', '是否允许派单：全部'], ['ALLOW', '是否允许派单：允许'], ['LIMITED', '是否允许派单：限制'], ['BLOCKED', '是否允许派单：禁止']])}
      ${renderSelect('settlement', query.settlement, [['ALL', '是否允许结算：全部'], ['ALLOW', '是否允许结算：允许'], ['BLOCKED', '是否允许结算：禁止新结算']])}
      <div class="flex shrink-0 gap-2">
        <button type="button" class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" data-nav-from-fields="[data-third-party-rating-filters]" data-nav-base="${PAGE_PATH}">筛选</button>
        <button type="button" class="h-9 rounded-md border px-4 text-sm hover:bg-muted" data-nav="${PAGE_PATH}">重置</button>
      </div>
    </form>
  `
}

function renderLinkedStats(rows: RatingRow[]): string {
  const countBy = (predicate: (row: RatingRow) => boolean) => rows.filter(predicate).length
  return `
    <section data-third-party-rating-stats>
      ${renderStandardListStats([
        { label: '全部三方车缝工厂', value: rows.length },
        { label: '正常合作', value: countBy((row) => row.cooperationStatusLabel === '正常合作') },
        { label: '考核中', value: countBy((row) => row.cooperationStatusLabel === '考核中') },
        { label: '黑名单', value: countBy((row) => row.cooperationStatusLabel === '黑名单') },
        { label: 'S 级', value: countBy((row) => row.currentGrade === 'S') },
        { label: 'A 级', value: countBy((row) => row.currentGrade === 'A') },
        { label: 'B 级', value: countBy((row) => row.currentGrade === 'B') },
        { label: 'C 级', value: countBy((row) => row.currentGrade === 'C') },
      ])}
    </section>
  `
}

function renderRatingBadge(row: FactoryRatingSnapshot): string {
  const toneByGrade: Record<FactoryRatingSnapshot['currentGrade'], string> = {
    S: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    A: 'border-blue-200 bg-blue-50 text-blue-700',
    B: 'border-amber-200 bg-amber-50 text-amber-700',
    C: 'border-red-200 bg-red-50 text-red-700',
  }
  return `<span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneByGrade[row.currentGrade]}">${escapeHtml(row.currentGrade)} 级</span>`
}

function renderPolicyTone(text: string): string {
  if (text.includes('禁止')) return 'border-red-200 bg-red-50 text-red-700'
  if (text.includes('仅允许') || text.includes('黄牌') || text.includes('建议')) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function renderTrialLimit(row: FactoryRatingSnapshot): string {
  return row.firstTrialLimitQty === null ? '无首单上限' : `首单上限 ${row.firstTrialLimitQty} 件`
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '未质检'
  return `${(value * 100).toFixed(1)}%`
}

function isOpenTrialAssessment(row: FactoryRatingSnapshot): boolean {
  return (
    row.latestTrialAssessmentStatus === 'WAIT_TRIAL_DISPATCH' ||
    row.latestTrialAssessmentStatus === 'TRIAL_DISPATCHED' ||
    row.latestTrialAssessmentStatus === 'WAIT_QC'
  )
}

function getTrialAssessmentSortDefectRate(row: FactoryRatingSnapshot): number | undefined {
  if (isOpenTrialAssessment(row)) return undefined
  return row.latestTrialDefectRate
}

function formatTrialTiming(row: FactoryRatingSnapshot): string {
  if (row.latestTrialAssessmentStatus === 'WAIT_TRIAL_DISPATCH') return '待派出'
  if (row.latestTrialAssessmentStatus === 'TRIAL_DISPATCHED') return '未交出'
  if (row.latestTrialAssessmentStatus === 'WAIT_QC') return '待质检'
  if (typeof row.latestTrialDelayDays !== 'number') return '未交出'
  return row.latestTrialDelayDays > 0 ? `延期 ${row.latestTrialDelayDays} 天` : '准时'
}

function formatTrialDefectRate(row: FactoryRatingSnapshot): string {
  if (isOpenTrialAssessment(row)) return '未质检'
  return formatPercent(row.latestTrialDefectRate)
}

function renderTrialSummary(row: FactoryRatingSnapshot): string {
  const roundText = row.assessmentRound ? `第 ${row.assessmentRound} 轮` : '未开始'
  const orderText = row.latestTrialOrderNo ?? '等待试产单'
  const delayText = formatTrialTiming(row)
  return `
    <div class="space-y-1">
      <div class="font-medium">试产轮次：${escapeHtml(roundText)} / ${escapeHtml(orderText)}</div>
      <div class="text-xs text-muted-foreground">生产单号：${escapeHtml(row.latestTrialProductionOrderNo ?? '未关联生产单')}</div>
      <div class="text-xs text-muted-foreground">完成时效：${escapeHtml(delayText)}，不良率 ${escapeHtml(formatTrialDefectRate(row))}</div>
    </div>
  `
}

function renderAssessmentResult(row: FactoryRatingSnapshot): string {
  const autoDecision = row.latestTrialAutoDecision ?? '未评级'
  const manualDecision = row.latestTrialManualDecision ?? '未确认'
  return `
    <div class="space-y-1">
      <div class="text-sm">系统建议：${escapeHtml(autoDecision)}</div>
      <div class="text-xs text-muted-foreground">人工结论：${escapeHtml(manualDecision)}</div>
    </div>
  `
}

function formatTrialAssessmentStatus(status: ThirdPartyFactoryTrialAssessmentRecord['status']): string {
  const labelByStatus: Record<ThirdPartyFactoryTrialAssessmentRecord['status'], string> = {
    WAIT_TRIAL_DISPATCH: '待派出',
    TRIAL_DISPATCHED: '已派出未交出',
    WAIT_QC: '待质检',
    AUTO_RATED: '系统已评级',
    MANUAL_CONFIRMED: '人工已确认',
  }
  return labelByStatus[status]
}

function formatTrialAssessmentTiming(record: ThirdPartyFactoryTrialAssessmentRecord): string {
  if (record.status === 'WAIT_TRIAL_DISPATCH') return '待派出'
  if (record.status === 'TRIAL_DISPATCHED') return '未交出'
  if (record.status === 'WAIT_QC') return '待质检'
  return record.delayDays > 0 ? `延期 ${record.delayDays} 天` : '准时'
}

function renderTrialAssessmentDefectReasons(record: ThirdPartyFactoryTrialAssessmentRecord): string {
  if (record.factoryLiabilityDefectReasonItems.length === 0) return '无工厂责任瑕疵'
  return record.factoryLiabilityDefectReasonItems
    .map((item) => `${item.reasonName} ${item.qty} 件`)
    .join('，')
}

function renderTrialAssessmentRecords(records: ThirdPartyFactoryTrialAssessmentRecord[]): string {
  if (records.length === 0) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="font-semibold">试产考核记录</h3>
        <p class="mt-3 rounded-md border bg-background p-4 text-sm text-muted-foreground">暂无试产考核记录</p>
      </section>
    `
  }

  const sortedRecords = [...records].sort((left, right) => right.assessmentRound - left.assessmentRound)

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">试产考核记录</h3>
      <div class="mt-3 space-y-3">
        ${sortedRecords.map((record) => `
          <article class="rounded-md border bg-background p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="text-sm font-medium">第 ${escapeHtml(record.assessmentRound)} 轮 / ${escapeHtml(record.trialOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(record.productionOrderNo)}，状态：${escapeHtml(formatTrialAssessmentStatus(record.status))}</div>
              </div>
              <div class="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">试产数量 ${escapeHtml(record.dispatchQty)} 件</div>
            </div>
            <div class="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <div class="rounded-md border p-2">
                <div class="text-xs text-muted-foreground">完成时效</div>
                <div class="mt-1 font-medium">${escapeHtml(formatTrialAssessmentTiming(record))}</div>
                <div class="mt-1 text-xs text-muted-foreground">计划 ${escapeHtml(record.plannedDeliveryAt)} / 实际 ${escapeHtml(record.actualDeliveryAt || '未交出')}</div>
              </div>
              <div class="rounded-md border p-2">
                <div class="text-xs text-muted-foreground">质检情况</div>
                <div class="mt-1 font-medium">质检 ${escapeHtml(record.inspectedQty)} 件，不良 ${escapeHtml(record.defectiveQty)} 件，不良率 ${escapeHtml(record.inspectedQty > 0 ? formatPercent(record.defectRate) : '未质检')}</div>
                <div class="mt-1 text-xs text-muted-foreground">返工 ${escapeHtml(record.reworkQty)} 件，工厂责任瑕疵 ${escapeHtml(record.factoryLiabilityDefectQty)} 件</div>
              </div>
              <div class="rounded-md border p-2">
                <div class="text-xs text-muted-foreground">评级结论</div>
                <div class="mt-1 font-medium">时效 ${escapeHtml(record.timelinessGrade)} / 质量 ${escapeHtml(record.qualityGrade)} / 自动 ${escapeHtml(record.autoRatingGrade)}</div>
                <div class="mt-1 text-xs text-muted-foreground">系统建议：${escapeHtml(record.autoRatingDecision ?? '待评级')}，人工结论：${escapeHtml(record.manualDecision ?? '未确认')}</div>
              </div>
            </div>
            <div class="mt-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              工厂责任瑕疵原因：${escapeHtml(renderTrialAssessmentDefectReasons(record))}
              ${record.manualReason ? `；人工说明：${escapeHtml(record.manualReason)}` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

function getDeliveryDelayDays(record: FactoryRatingPerformanceRecord): number {
  const planned = new Date(record.plannedDeliveryAt.replace(' ', 'T')).getTime()
  const actual = new Date(record.actualDeliveryAt.replace(' ', 'T')).getTime()
  if (!Number.isFinite(planned) || !Number.isFinite(actual) || actual <= planned) return 0
  return Math.ceil((actual - planned) / 86_400_000)
}

const columns: readonly StandardListColumn<RatingRow>[] = [
  {
    key: 'factory',
    title: '工厂',
    width: 230,
    minWidth: 230,
    required: true,
    freezeable: true,
    sortable: true,
    render: (row) => `
      <div class="space-y-1">
        <div class="font-medium">${escapeHtml(row.displayFactoryName)}</div>
        <div class="font-mono text-xs text-muted-foreground">${escapeHtml(row.displayFactoryCode)}</div>
      </div>
    `,
    sortValue: (row) => row.displayFactoryName,
  },
  {
    key: 'grade',
    title: '评级',
    width: 110,
    required: true,
    sortable: true,
    render: (row) => renderRatingBadge(row),
    sortValue: (row) => row.currentGrade,
  },
  {
    key: 'score',
    title: '分数',
    width: 120,
    align: 'right',
    sortable: true,
    render: (row) => `
      <div class="font-medium tabular-nums">${escapeHtml(row.totalScore)} 分</div>
      <div class="text-xs text-muted-foreground">交期扣 ${escapeHtml(row.deliveryDeductionScore)} / 质量扣 ${escapeHtml(row.qualityDeductionScore)}</div>
    `,
    sortValue: (row) => row.totalScore,
  },
  {
    key: 'cooperation',
    title: '合作状态',
    width: 120,
    required: true,
    sortable: true,
    render: (row) => `<span class="text-sm font-medium">${escapeHtml(row.cooperationStatusLabel)}</span>`,
    sortValue: (row) => row.cooperationStatusLabel,
  },
  {
    key: 'scale',
    title: '规模',
    width: 140,
    sortable: true,
    render: (row) => {
      const sourceLabel = row.sewingSeatSourceLabel ?? '工厂档案 / 产能资料'
      const sourceText = sourceLabel === '工厂档案 / 产能资料' ? '来源：工厂档案 / 产能资料' : `来源：${sourceLabel}`
      return `
        <div>${escapeHtml(row.scaleLabel)}</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(row.sewingSeatCount)} 个车位</div>
        <div class="text-[11px] text-muted-foreground">${escapeHtml(sourceText)}</div>
      `
    },
    sortValue: (row) => row.sewingSeatCount,
  },
  {
    key: 'trialSummary',
    title: '试产单情况',
    width: 260,
    sortable: true,
    render: (row) => renderTrialSummary(row),
    sortValue: (row) => row.assessmentRound ?? 0,
  },
  {
    key: 'assessmentResult',
    title: '试产结论',
    width: 180,
    sortable: true,
    render: (row) => renderAssessmentResult(row),
    sortValue: (row) => getTrialAssessmentSortDefectRate(row),
  },
  {
    key: 'dispatch',
    title: '派单策略',
    width: 260,
    render: (row) => {
      const policyLabel = getThirdPartyFactoryDispatchPolicyLabel(row)
      return `
        <div class="inline-flex rounded-md border px-2 py-1 text-xs ${renderPolicyTone(policyLabel)}">${escapeHtml(policyLabel)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(renderTrialLimit(row))}</div>
      `
    },
  },
  {
    key: 'settlement',
    title: '结算策略',
    width: 220,
    render: (row) => {
      const policyLabel = getThirdPartyFactorySettlementPolicyLabel(row)
      return `
        <div class="inline-flex rounded-md border px-2 py-1 text-xs ${renderPolicyTone(policyLabel)}">${escapeHtml(policyLabel)}</div>
      `
    },
  },
  {
    key: 'reason',
    title: '评级原因',
    width: 280,
    render: (row) => `<p class="line-clamp-2 text-sm text-muted-foreground">${escapeHtml(row.recentRatingReason)}</p>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 110,
    required: true,
    actionColumn: true,
    render: (row) => `
      <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHref(readQuery(), { viewFactoryId: row.factoryId }))}">
        查看评级
      </button>
    `,
  },
]

function getSortValue(row: RatingRow, key: string): unknown {
  return columns.find((column) => column.key === key)?.sortValue?.(row)
}

function renderRatingScoreDetail(snapshot: FactoryRatingSnapshot): string {
  const items = [
    ['当前评级', `${snapshot.currentGrade} 级`],
    ['综合分数', `${snapshot.totalScore} 分`],
    ['交期扣分', `${snapshot.deliveryDeductionScore} 分`],
    ['质量扣分', `${snapshot.qualityDeductionScore} 分`],
    ['人工扣分', `${snapshot.manualDeductionScore} 分`],
    ['首单规则', renderTrialLimit(snapshot)],
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">评级详情</h3>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        ${items.map(([label, value]) => `
          <div class="rounded-md border bg-background p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 text-sm font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
      <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(snapshot.recentRatingReason)}</p>
    </section>
  `
}

function renderAssessmentDecisionDetail(snapshot: FactoryRatingSnapshot): string {
  if (!snapshot.assessmentDecision) return ''
  const statusLabel = snapshot.assessmentDecision === '延长考核' ? '延长考核中' : snapshot.assessmentDecision
  const nextAllowedDocumentType = snapshot.nextAllowedDocumentType ?? '试产单'
  const nextTrialLimitQty = snapshot.nextTrialLimitQty ?? snapshot.firstTrialLimitQty ?? 300
  const items = [
    ['考核结论', statusLabel],
    ['考核轮次', snapshot.assessmentRound ? `第 ${snapshot.assessmentRound} 轮` : '未记录'],
    ['下一单允许单据', nextAllowedDocumentType],
    ['下一单上限', `${nextTrialLimitQty} 件`],
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">考核结论</h3>
      <div class="mt-3 grid gap-3 sm:grid-cols-4">
        ${items.map(([label, value]) => `
          <div class="rounded-md border bg-background p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 text-sm font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
      <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(snapshot.assessmentReason || '暂无考核原因')}</p>
    </section>
  `
}

function renderStrategyDetail(snapshot: FactoryRatingSnapshot): string {
  const dispatchPolicyLabel = getThirdPartyFactoryDispatchPolicyLabel(snapshot)
  const settlementPolicyLabel = getThirdPartyFactorySettlementPolicyLabel(snapshot)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">派单 / 结算策略</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="rounded-md border bg-background p-3">
          <div class="text-xs text-muted-foreground">派单策略</div>
          <p class="mt-1 text-sm">${escapeHtml(dispatchPolicyLabel)}</p>
        </div>
        <div class="rounded-md border bg-background p-3">
          <div class="text-xs text-muted-foreground">结算策略</div>
          <p class="mt-1 text-sm">${escapeHtml(settlementPolicyLabel)}</p>
        </div>
      </div>
    </section>
  `
}

function renderTimingDetail(snapshot: FactoryRatingSnapshot): string {
  const summary = getThirdPartyFactoryTimingSummary(snapshot.factoryId)
  if (!summary) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="font-semibold">近 90 天 / 首单说明</h3>
        <p class="mt-2 text-sm text-muted-foreground">暂无近 90 天或首单考核摘要。</p>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">近 90 天 / 首单说明</h3>
      <div class="mt-3 grid gap-3 sm:grid-cols-4">
        <div class="rounded-md border bg-background p-3">
          <div class="text-xs text-muted-foreground">统计范围</div>
          <div class="mt-1 text-sm font-medium">${escapeHtml(summary.rangeLabel)}</div>
        </div>
        <div class="rounded-md border bg-background p-3">
          <div class="text-xs text-muted-foreground">派单数量</div>
          <div class="mt-1 text-sm font-medium">${escapeHtml(summary.dispatchedOrderCount)} 单</div>
        </div>
        <div class="rounded-md border bg-background p-3">
          <div class="text-xs text-muted-foreground">准时率</div>
          <div class="mt-1 text-sm font-medium">${escapeHtml(summary.onTimeRate)}</div>
        </div>
        <div class="rounded-md border bg-background p-3">
          <div class="text-xs text-muted-foreground">异常单</div>
          <div class="mt-1 text-sm font-medium">${escapeHtml(summary.exceptionOrderCount)} 单</div>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">平均延期 ${escapeHtml(summary.averageDelayDays)} 天，归责瑕疵率 ${escapeHtml(summary.defectRate)}。${escapeHtml(summary.timingNote)}</p>
    </section>
  `
}

function renderPerformanceRecords(records: FactoryRatingPerformanceRecord[]): string {
  if (records.length === 0) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="font-semibold">履约记录</h3>
        <p class="mt-3 rounded-md border bg-background p-4 text-sm text-muted-foreground">暂无履约记录</p>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">履约记录</h3>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[760px] border-collapse text-sm">
          <thead class="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">生产单</th>
              <th class="px-3 py-2 text-left">单据类型</th>
              <th class="px-3 py-2 text-right">发出数量</th>
              <th class="px-3 py-2 text-right">合格数量</th>
              <th class="px-3 py-2 text-right">延期</th>
              <th class="px-3 py-2 text-left">结果</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2 font-medium">${escapeHtml(record.productionOrderNo)}</td>
                <td class="px-3 py-2">${escapeHtml(record.documentTypeLabel)}</td>
                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(record.issuedQty)} 件</td>
                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(record.qualifiedQty)} 件</td>
                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(getDeliveryDelayDays(record))} 天</td>
                <td class="px-3 py-2 text-muted-foreground">${escapeHtml(record.resultSummary)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderRatingDrawer(snapshot: RatingRow | undefined, query: RatingQuery): string {
  if (!snapshot) return ''
  const records = listThirdPartyFactoryPerformanceRecords(snapshot.factoryId)
  const trialRecords = listThirdPartyFactoryTrialAssessmentRecords(snapshot.factoryId)

  return `
    <div class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="third-party-rating-drawer-title">
      <button class="absolute inset-0 bg-black/40" data-nav="${escapeHtml(buildHref(query, { viewFactoryId: '' }))}" aria-label="关闭评级详情"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-background p-5 shadow-xl">
        <header class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="third-party-rating-drawer-title" class="text-lg font-semibold">评级详情</h2>
            <p class="text-sm text-muted-foreground">${escapeHtml(snapshot.displayFactoryName)} / ${escapeHtml(snapshot.displayFactoryCode)}</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(buildHref(query, { viewFactoryId: '' }))}">关闭</button>
        </header>
        <div class="space-y-4">
          ${renderRatingScoreDetail(snapshot)}
          ${renderAssessmentDecisionDetail(snapshot)}
          ${renderStrategyDetail(snapshot)}
          ${renderTrialAssessmentRecords(trialRecords)}
          ${renderTimingDetail(snapshot)}
          ${renderPerformanceRecords(records)}
        </div>
      </aside>
    </div>
  `
}

function renderColumnSettingsOverlay(query: RatingQuery, preferences: StandardListColumnPreferences): string {
  if (!query.columnSettings) return ''
  const closeHref = escapeHtml(buildHref(query, { columnSettings: false, refreshKey: '' }))
  const closeActionAttr = 'data-third-party-rating-action="close-column-settings"'
  return renderStandardListColumnSettings({
    title: '列设置',
    columns,
    preferences,
    eventPrefix: EVENT_PREFIX,
    maxFrozenWidth: MAX_FROZEN_WIDTH,
  }).replaceAll(closeActionAttr, `data-nav="${closeHref}"`)
}

function renderRatingPagination(query: RatingQuery, paging: RatingPaging): string {
  const paginationHtml = renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: EVENT_PREFIX,
    fieldPrefix: EVENT_PREFIX,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  })

  return paginationHtml
    .replace(
      'data-third-party-rating-action="prev-page"',
      `data-nav="${escapeHtml(buildHref(query, { page: Math.max(1, paging.currentPage - 1), refreshKey: '' }))}"`,
    )
    .replace(
      'data-third-party-rating-action="next-page"',
      `data-nav="${escapeHtml(buildHref(query, { page: Math.min(paging.totalPages, paging.currentPage + 1), refreshKey: '' }))}"`,
    )
}

function navigateRatingList(href: string): void {
  appStore.navigate(href)
}

function getCurrentPaging(query: RatingQuery): { currentPage: number, totalPages: number } {
  const filteredRows = filterSnapshots(getRatingRows(), query)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / query.pageSize))
  const currentPage = Math.min(Math.max(1, query.page), totalPages)
  return { currentPage, totalPages }
}

function getNextSortPatch(
  query: RatingQuery,
  columnKey: string,
): Pick<RatingQuery, 'sortKey' | 'sortDirection' | 'page'> {
  if (query.sortKey !== columnKey || !query.sortDirection) {
    return { sortKey: columnKey, sortDirection: 'asc', page: 1 }
  }
  if (query.sortDirection === 'asc') {
    return { sortKey: columnKey, sortDirection: 'desc', page: 1 }
  }
  return { sortKey: '', sortDirection: '', page: 1 }
}

function getActionColumnKey(actionNode: HTMLElement): string {
  return actionNode.dataset.thirdPartyRatingColumnKey || actionNode.dataset.columnKey || ''
}

function getDragColumnKey(dragNode: HTMLElement): string {
  return dragNode.dataset.thirdPartyRatingColumnKey
    || dragNode.dataset.dragSource
    || dragNode.dataset.dropTarget
    || ''
}

function getDraggableColumn(columnKey: string): StandardListColumn<RatingRow> | undefined {
  return columns.find((item) => item.key === columnKey && !item.actionColumn)
}

function refreshColumnSettings(query: RatingQuery, patch: Partial<RatingQuery> = {}): void {
  navigateRatingList(buildHref(query, {
    ...patch,
    columnSettings: patch.columnSettings ?? true,
    refreshKey: String(Date.now()),
  }))
}

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function applyRatingFilters(form: HTMLFormElement): void {
  const formData = new FormData(form)
  const pageSize = Number(readFormValue(formData, 'pageSize'))
  navigateRatingList(buildHref(readQuery(), {
    keyword: readFormValue(formData, 'keyword'),
    grade: readFormValue(formData, 'grade') || 'ALL',
    cooperationStatus: readFormValue(formData, 'cooperationStatus') || 'ALL',
    scale: readFormValue(formData, 'scale') || 'ALL',
    dispatch: normalizeDispatchFilter(readFormValue(formData, 'dispatch')),
    settlement: normalizeSettlementFilter(readFormValue(formData, 'settlement')),
    page: 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : getColumnPreferences().pageSize,
    viewFactoryId: '',
    columnSettings: false,
    refreshKey: '',
  }))
}

export function handleThirdPartyFactoryRatingSubmit(form: HTMLFormElement): boolean {
  if (!form.matches('[data-third-party-rating-filters]')) return false

  applyRatingFilters(form)
  return true
}

export function handleThirdPartyFactoryRatingEvent(target: HTMLElement, event?: Event): boolean {
  const dragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined

  if (event?.type === 'dragend') {
    if (!draggedColumnKey && !dragEvent?.higoodStandardListColumnDrag) return false
    draggedColumnKey = ''
    return true
  }

  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop'].includes(event.type)) {
    const columnKey = getDragColumnKey(dragNode)
    const column = getDraggableColumn(columnKey)

    if (event.type === 'dragstart') {
      draggedColumnKey = column?.key || ''
      if (!column) return false
      dragEvent?.dataTransfer?.setData('application/x-higood-list-column-key', column.key)
      if (dragEvent?.dataTransfer) dragEvent.dataTransfer.effectAllowed = 'move'
      return true
    }

    const sourceKey = dragEvent?.higoodStandardListColumnKey
      || dragEvent?.dataTransfer?.getData('application/x-higood-list-column-key')
      || draggedColumnKey
    const sourceColumn = getDraggableColumn(sourceKey)
    const targetColumn = getDraggableColumn(columnKey)
    if (
      !sourceColumn
      || !targetColumn
      || (draggedColumnKey !== '' && draggedColumnKey !== sourceColumn.key)
      || sourceColumn.key === targetColumn.key
    ) {
      if (event.type === 'drop') draggedColumnKey = ''
      return false
    }

    if (event.type === 'dragover') {
      event.preventDefault()
      if (dragEvent?.dataTransfer) dragEvent.dataTransfer.dropEffect = 'move'
      return true
    }

    draggedColumnKey = ''
    event.preventDefault()
    const preferences = getColumnPreferences()
    const order = preferences.order.filter((key) => key !== sourceColumn.key)
    const targetIndex = order.indexOf(targetColumn.key)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceColumn.key)
    saveColumnPreferences(normalizeColumnPreferences({
      ...preferences,
      order,
    }))
    refreshColumnSettings(readQuery())
    return true
  }

  const query = readQuery()
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-third-party-rating-field]')
  const field = fieldNode?.dataset.thirdPartyRatingField

  if (field === 'pageSize') {
    if (event?.type !== 'change') return false
    if (!fieldNode) return false
    const pageSize = Number(fieldNode.value)
    if (!PAGE_SIZE_OPTIONS.includes(pageSize)) return true
    const preferences = normalizeColumnPreferences({
      ...getColumnPreferences(),
      pageSize,
    })
    saveColumnPreferences(preferences)
    event.preventDefault()
    navigateRatingList(buildHref(query, { page: 1, pageSize, refreshKey: '' }))
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-third-party-rating-action]')
  const action = actionNode?.dataset.thirdPartyRatingAction
  if (!actionNode || !action) return false

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = columns.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    event?.preventDefault()
    navigateRatingList(buildHref(query, { ...getNextSortPatch(query, columnKey), refreshKey: '' }))
    return true
  }

  if (action === 'prev-page' || action === 'next-page') {
    const paging = getCurrentPaging(query)
    const nextPage = action === 'prev-page'
      ? Math.max(1, paging.currentPage - 1)
      : Math.min(paging.totalPages, paging.currentPage + 1)
    event?.preventDefault()
    navigateRatingList(buildHref(query, { page: nextPage, refreshKey: '' }))
    return true
  }

  if (action === 'open-column-settings') {
    event?.preventDefault()
    navigateRatingList(buildHref(query, { columnSettings: true, refreshKey: '' }))
    return true
  }

  if (action === 'close-column-settings') {
    event?.preventDefault()
    navigateRatingList(buildHref(query, { columnSettings: false, refreshKey: '' }))
    return true
  }

  if (action === 'restore-column-settings') {
    event?.preventDefault()
    clearColumnPreferences()
    navigateRatingList(buildHref(query, {
      columnSettings: true,
      page: 1,
      pageSize: 10,
      sortKey: '',
      sortDirection: '',
      refreshKey: String(Date.now()),
    }))
    return true
  }

  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const columnKey = getActionColumnKey(actionNode)
    const rule = columnRules.find((item) => item.key === columnKey)
    if (!rule || rule.required || rule.actionColumn) return true
    const preferences = getColumnPreferences()
    const visibleKeys = new Set(preferences.visibleKeys)
    const frozenKeys = new Set(preferences.frozenKeys)
    if (visibleKeys.has(columnKey)) {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    } else {
      visibleKeys.add(columnKey)
    }
    saveColumnPreferences(normalizeColumnPreferences({
      ...preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    }))
    event.preventDefault()
    refreshColumnSettings(query, visibleKeys.has(columnKey) || query.sortKey !== columnKey
      ? {}
      : { sortKey: '', sortDirection: '', page: 1 })
    return true
  }

  if (action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const columnKey = getActionColumnKey(actionNode)
    const column = columns.find((item) => item.key === columnKey)
    if (!column?.freezeable || column.actionColumn) return true
    const preferences = getColumnPreferences()
    const frozenKeys = new Set(preferences.frozenKeys)
    if (frozenKeys.has(columnKey)) {
      frozenKeys.delete(columnKey)
    } else {
      frozenKeys.add(columnKey)
    }
    saveColumnPreferences(normalizeColumnPreferences({
      ...preferences,
      frozenKeys: [...frozenKeys],
    }))
    event.preventDefault()
    refreshColumnSettings(query)
    return true
  }

  return false
}

export function renderThirdPartyFactoryRatingPage(): string {
  const query = readQuery()
  const rows = getRatingRows()
  const filteredRows = filterSnapshots(rows, query)
  const sortState = getSortState(query)
  const sortedRows = sortStandardListRows(filteredRows, sortState, getSortValue)
  const paging = paginateStandardListRows(sortedRows, query.page, query.pageSize)
  const activeSnapshot = rows.find((row) => row.factoryId === query.viewFactoryId || row.factoryCode === query.viewFactoryId)
  const preferences = getColumnPreferences()

  return renderStandardListPage({
    title: '三方工厂评级',
    filtersHtml: renderFilters(query),
    statsHtml: renderLinkedStats(filteredRows),
    listTitle: '评级标准列表',
    listActionsHtml: `
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(buildHref(query, { columnSettings: true, refreshKey: '' }))}">列设置</button>
    `,
    tableHtml: renderStandardListTable({
      columns,
      rows: paging.rows,
      preferences,
      sort: sortState,
      eventPrefix: EVENT_PREFIX,
      emptyText: '暂无符合条件的三方车缝工厂',
    }),
    paginationHtml: renderRatingPagination(query, paging),
    overlaysHtml: `
      ${renderRatingDrawer(activeSnapshot, query)}
      ${renderColumnSettingsOverlay(query, preferences)}
    `,
  })
}
