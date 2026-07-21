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
  WOMENSWEAR_CATEGORY_OPTIONS,
  listThirdPartyFactoryComprehensiveAssessments,
  type ComprehensiveAssessmentGrade,
  type ThirdPartyFactoryComprehensiveAssessment,
} from '../data/fcs/third-party-factory-comprehensive-assessment.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'

const PAGE_PATH = '/fcs/factories/third-party-comprehensive-assessment'
const EVENT_PREFIX = 'third-party-comprehensive-assessment'
const COLUMN_STORAGE_KEY = 'fcs.third-party-comprehensive-assessment.columns.v1'
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const MAX_FROZEN_WIDTH = 360

type CompletionFilter = 'ALL' | 'COMPLETE' | 'INCOMPLETE'

export interface ComprehensiveAssessmentQuery {
  keyword: string
  categories: string[]
  grade: 'ALL' | ComprehensiveAssessmentGrade
  ability: CompletionFilter
  capacity: CompletionFilter
  timeliness: CompletionFilter
  quality: CompletionFilter
  rating: CompletionFilter
  page: number
  pageSize: number
  editFactoryId: string
  sortKey: string
  sortDirection: StandardListSortDirection | ''
  columnSettings: boolean
  refreshKey: string
}

let draggedColumnKey = ''

const columnRules = [
  { key: 'factory', required: true, freezeable: true },
  { key: 'craftAbility' },
  { key: 'categoryAbility' },
  { key: 'machineCount' },
  { key: 'workerCount' },
  { key: 'monthlyOutputValue' },
  { key: 'deliveryCompleted' },
  { key: 'return30' },
  { key: 'return70' },
  { key: 'return100' },
  { key: 'defectiveRate' },
  { key: 'defectRate' },
  { key: 'reworkRate' },
  { key: 'grade', required: true },
  { key: 'actions', required: true, actionColumn: true },
]

const defaultColumnPreferences: StandardListColumnPreferences = normalizeListColumnPreferences(
  columnRules,
  {
    order: columnRules.map((column) => column.key),
    visibleKeys: columnRules.map((column) => column.key),
    frozenKeys: ['factory'],
    pageSize: 10,
  },
  PAGE_SIZE_OPTIONS,
)

export function getThirdPartyFactoryComprehensiveAssessmentDefaultColumnPreferences(): StandardListColumnPreferences {
  return {
    order: [...defaultColumnPreferences.order],
    visibleKeys: [...defaultColumnPreferences.visibleKeys],
    frozenKeys: [...defaultColumnPreferences.frozenKeys],
    pageSize: defaultColumnPreferences.pageSize,
  }
}

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
  if (!storage) return getThirdPartyFactoryComprehensiveAssessmentDefaultColumnPreferences()
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

function readQuery(): ComprehensiveAssessmentQuery {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const pageSize = Number(params.get('pageSize') ?? String(getColumnPreferences().pageSize))
  const sortDirection = params.get('sortDirection')
  return {
    keyword: params.get('keyword')?.trim() ?? '',
    categories: [...new Set(params.getAll('categories').filter((value) => WOMENSWEAR_CATEGORY_OPTIONS.includes(value as never)))],
    grade: normalizeGrade(params.get('grade')),
    ability: normalizeCompletionFilter(params.get('ability')),
    capacity: normalizeCompletionFilter(params.get('capacity')),
    timeliness: normalizeCompletionFilter(params.get('timeliness')),
    quality: normalizeCompletionFilter(params.get('quality')),
    rating: normalizeCompletionFilter(params.get('rating')),
    page: Math.max(1, Number(params.get('page') ?? '1') || 1),
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10,
    editFactoryId: params.get('editFactoryId') ?? '',
    sortKey: params.get('sortKey') ?? '',
    sortDirection: sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : '',
    columnSettings: params.get('columnSettings') === '1',
    refreshKey: params.get('refreshKey') ?? '',
  }
}

function normalizeGrade(value: string | null): ComprehensiveAssessmentQuery['grade'] {
  return value === 'S' || value === 'A' || value === 'B' || value === 'C' ? value : 'ALL'
}

function normalizeCompletionFilter(value: string | null): CompletionFilter {
  return value === 'COMPLETE' || value === 'INCOMPLETE' ? value : 'ALL'
}

function matchesCompletion(value: boolean, filter: CompletionFilter): boolean {
  return filter === 'ALL' || (filter === 'COMPLETE' ? value : !value)
}

export function filterThirdPartyFactoryComprehensiveAssessments(
  rows: readonly ThirdPartyFactoryComprehensiveAssessment[],
  query: Pick<ComprehensiveAssessmentQuery, 'keyword' | 'categories' | 'grade' | 'ability' | 'capacity' | 'timeliness' | 'quality' | 'rating'>,
): ThirdPartyFactoryComprehensiveAssessment[] {
  const keyword = query.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesKeyword = !keyword || [row.factoryName, row.factoryCode, row.factoryId]
      .some((value) => value.toLowerCase().includes(keyword))
    const matchesCategory = query.categories.length === 0 || row.categoryAbilities.some((category) => query.categories.includes(category))
    return matchesKeyword && matchesCategory &&
      (query.grade === 'ALL' || row.grade === query.grade) &&
      matchesCompletion(row.completion.ability, query.ability) &&
      matchesCompletion(row.completion.capacity, query.capacity) &&
      matchesCompletion(row.completion.timeliness, query.timeliness) &&
      matchesCompletion(row.completion.quality, query.quality) &&
      matchesCompletion(row.completion.grade, query.rating)
  })
}

function getSortState(query: ComprehensiveAssessmentQuery): StandardListSortState | null {
  return query.sortKey && query.sortDirection ? { key: query.sortKey, direction: query.sortDirection } : null
}

function buildHref(query: ComprehensiveAssessmentQuery, patch: Partial<ComprehensiveAssessmentQuery>): string {
  const next = { ...query, ...patch }
  const params = new URLSearchParams()
  if (next.keyword) params.set('keyword', next.keyword)
  next.categories.forEach((category) => params.append('categories', category))
  if (next.grade !== 'ALL') params.set('grade', next.grade)
  ;(['ability', 'capacity', 'timeliness', 'quality', 'rating'] as const).forEach((key) => {
    if (next[key] !== 'ALL') params.set(key, next[key])
  })
  if (next.page > 1) params.set('page', String(next.page))
  if (next.pageSize !== 10) params.set('pageSize', String(next.pageSize))
  if (next.editFactoryId) params.set('editFactoryId', next.editFactoryId)
  if (next.sortKey && next.sortDirection) {
    params.set('sortKey', next.sortKey)
    params.set('sortDirection', next.sortDirection)
  }
  if (next.columnSettings) params.set('columnSettings', '1')
  if (next.refreshKey) params.set('refreshKey', next.refreshKey)
  const search = params.toString()
  return search ? `${PAGE_PATH}?${search}` : PAGE_PATH
}

function renderSelect(
  name: string,
  value: string,
  options: Array<[string, string]>,
  completionFilter?: string,
): string {
  return `
    <select name="${escapeHtml(name)}" class="h-9 min-w-0 rounded-md border bg-background px-3 text-sm" ${completionFilter ? `data-completion-filter="${completionFilter}"` : ''}>
      ${options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue === 'ALL' ? '' : optionValue)}" ${optionValue === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
    </select>
  `
}

function renderFilters(query: ComprehensiveAssessmentQuery): string {
  return `
    <form action="${PAGE_PATH}" method="get" class="space-y-3 rounded-lg border bg-card p-4" data-third-party-comprehensive-assessment-filters>
      <input type="hidden" name="page" value="1">
      <input type="hidden" name="pageSize" value="${query.pageSize}">
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(230px,1.3fr)_minmax(230px,1.5fr)_repeat(6,minmax(120px,1fr))_auto]">
        <input name="keyword" value="${escapeHtml(query.keyword)}" class="h-9 min-w-0 rounded-md border bg-background px-3 text-sm" placeholder="工厂名称 / 编码" data-third-party-comprehensive-assessment-field="keyword">
        <div class="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-background px-3 text-xs">
          <span class="text-muted-foreground">品类能力</span>
          ${WOMENSWEAR_CATEGORY_OPTIONS.map((category) => `<label class="inline-flex items-center gap-1"><input type="checkbox" name="categories" value="${escapeHtml(category)}" ${query.categories.includes(category) ? 'checked' : ''}>${escapeHtml(category)}</label>`).join('')}
        </div>
        ${renderSelect('grade', query.grade, [['ALL', '综合评级'], ['S', 'S 级'], ['A', 'A 级'], ['B', 'B 级'], ['C', 'C 级']])}
        ${renderSelect('ability', query.ability, [['ALL', '能力全部'], ['COMPLETE', '能力已完善'], ['INCOMPLETE', '能力待完善']], 'ability')}
        ${renderSelect('capacity', query.capacity, [['ALL', '产能全部'], ['COMPLETE', '产能已完善'], ['INCOMPLETE', '产能待完善']], 'capacity')}
        ${renderSelect('timeliness', query.timeliness, [['ALL', '时效全部'], ['COMPLETE', '时效已完善'], ['INCOMPLETE', '时效待完善']], 'timeliness')}
        ${renderSelect('quality', query.quality, [['ALL', '品控全部'], ['COMPLETE', '品控已完善'], ['INCOMPLETE', '品控待完善']], 'quality')}
        ${renderSelect('rating', query.rating, [['ALL', '评级全部'], ['COMPLETE', '评级已完善'], ['INCOMPLETE', '评级待完善']], 'rating')}
        <button type="submit" class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">筛选</button>
      </div>
    </form>
  `
}

function renderSource(label: string, tone: 'system' | 'manual' | 'empty'): string {
  const toneClass = tone === 'system'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'manual'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-slate-200 bg-slate-50 text-slate-500'
  return `<span class="mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] leading-none ${toneClass}">${escapeHtml(label)}</span>`
}

function renderManualValue(value: string | number | null, suffix = ''): string {
  return value === null
    ? `<div class="text-sm text-muted-foreground">—</div>${renderSource('待完善', 'empty')}`
    : `<div class="text-sm tabular-nums">${escapeHtml(value)}${suffix}</div>${renderSource('人工填写', 'manual')}`
}

function renderSystemRate(value: number | null): string {
  return value === null
    ? `<div class="text-sm text-muted-foreground">—</div>${renderSource('暂无业务数据', 'empty')}`
    : `<div class="text-sm tabular-nums">${(value * 100).toFixed(1)}%</div>${renderSource('时效业务数据', 'system')}`
}

function renderQualityRate(value: number | null): string {
  return value === null
    ? `<div class="text-sm text-muted-foreground">—</div>${renderSource('暂无业务数据', 'empty')}`
    : `<div class="text-sm tabular-nums">${(value * 100).toFixed(1)}%</div>${renderSource('质检业务数据', 'system')}`
}

function renderGrade(row: ThirdPartyFactoryComprehensiveAssessment): string {
  return row.grade === null
    ? `<div class="text-sm text-muted-foreground">待评定</div>${renderSource('待完善', 'empty')}`
    : `<div class="font-semibold">${escapeHtml(row.grade)} 级</div>${renderSource('人工填写', 'manual')}`
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return '未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const columns: readonly StandardListColumn<ThirdPartyFactoryComprehensiveAssessment>[] = [
  {
    key: 'factory', title: '工厂', width: 248, minWidth: 248, required: true, freezeable: true, sortable: true,
    render: (row) => `
      <div class="space-y-1">
        <div class="font-medium">${escapeHtml(row.factoryName)}</div>
        <div class="font-mono text-xs text-muted-foreground">${escapeHtml(row.factoryCode)}</div>
        <div class="text-xs ${row.completion.incompleteCount === 0 ? 'text-emerald-700' : 'text-amber-700'}">${row.completion.incompleteCount === 0 ? '评定已完善' : `待完善 ${row.completion.incompleteCount} 项`}</div>
        <div class="text-[11px] text-muted-foreground">${escapeHtml(row.updatedBy ?? '未记录')} / ${escapeHtml(formatUpdatedAt(row.updatedAt))}</div>
        ${renderSource('工厂档案', 'system')}
      </div>`,
    sortValue: (row) => row.factoryName,
  },
  { key: 'craftAbility', title: '工艺能力', width: 150, sortable: true, render: (row) => `<div class="text-sm">${escapeHtml(row.processAbilities.join('、') || '—')}</div>${renderSource('工厂档案', 'system')}`, sortValue: (row) => row.processAbilities.join('、') },
  { key: 'categoryAbility', title: '品类能力', width: 180, sortable: true, render: (row) => renderManualValue(row.categoryAbilities.join('、') || null), sortValue: (row) => row.categoryAbilities.join('、') },
  { key: 'machineCount', title: '机器数', width: 110, align: 'right', sortable: true, render: (row) => renderManualValue(row.machineCount, ' 台'), sortValue: (row) => row.machineCount },
  { key: 'workerCount', title: '工人数', width: 110, align: 'right', sortable: true, render: (row) => renderManualValue(row.workerCount, ' 人'), sortValue: (row) => row.workerCount },
  { key: 'monthlyOutputValue', title: '月产值', width: 160, align: 'right', sortable: true, render: (row) => renderManualValue(row.monthlyOutputValueTenThousandIdr, ' 万印尼盾／月'), sortValue: (row) => row.monthlyOutputValueTenThousandIdr },
  { key: 'deliveryCompleted', title: '交期完成', width: 126, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.deliveryOnTimeRate), sortValue: (row) => row.timeliness.deliveryOnTimeRate },
  { key: 'return30', title: '回货 30%', width: 118, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.receipt30OnTimeRate), sortValue: (row) => row.timeliness.receipt30OnTimeRate },
  { key: 'return70', title: '回货 70%', width: 118, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.receipt70OnTimeRate), sortValue: (row) => row.timeliness.receipt70OnTimeRate },
  { key: 'return100', title: '回货 100%', width: 122, align: 'right', sortable: true, render: (row) => renderSystemRate(row.timeliness.receipt100OnTimeRate), sortValue: (row) => row.timeliness.receipt100OnTimeRate },
  { key: 'defectiveRate', title: '不良率', width: 112, align: 'right', sortable: true, render: (row) => renderQualityRate(row.quality.defectiveRate), sortValue: (row) => row.quality.defectiveRate },
  { key: 'defectRate', title: '工厂责任瑕疵率', width: 146, align: 'right', sortable: true, render: (row) => renderQualityRate(row.quality.defectRate), sortValue: (row) => row.quality.defectRate },
  { key: 'reworkRate', title: '返工率', width: 112, align: 'right', sortable: true, render: (row) => renderQualityRate(row.quality.reworkRate), sortValue: (row) => row.quality.reworkRate },
  { key: 'grade', title: '综合评级', width: 116, required: true, sortable: true, render: renderGrade, sortValue: (row) => row.grade },
  { key: 'actions', title: '操作', width: 108, required: true, actionColumn: true, render: (row) => `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHref(readQuery(), { editFactoryId: row.factoryId }))}">编辑评定</button>` },
]

const headerGroups = [
  { key: 'factory', title: '工厂信息', columnKeys: ['factory'], toneClass: 'bg-slate-50 text-slate-600' },
  { key: 'ability', title: '能力', columnKeys: ['craftAbility', 'categoryAbility'], toneClass: 'bg-emerald-50/70 text-emerald-700' },
  { key: 'capacity', title: '产能', columnKeys: ['machineCount', 'workerCount', 'monthlyOutputValue'], toneClass: 'bg-sky-50/70 text-sky-700' },
  { key: 'timeliness', title: '时效', columnKeys: ['deliveryCompleted', 'return30', 'return70', 'return100'], toneClass: 'bg-amber-50/70 text-amber-700' },
  { key: 'quality', title: '品控', columnKeys: ['defectiveRate', 'defectRate', 'reworkRate'], toneClass: 'bg-violet-50/70 text-violet-700' },
  { key: 'grade', title: '评级', columnKeys: ['grade'], toneClass: 'bg-slate-50 text-slate-600' },
  { key: 'actions', title: '操作', columnKeys: ['actions'], toneClass: 'bg-slate-50 text-slate-600' },
] as const

function getSortValue(row: ThirdPartyFactoryComprehensiveAssessment, key: string): unknown {
  return columns.find((column) => column.key === key)?.sortValue?.(row)
}

function renderStats(rows: readonly ThirdPartyFactoryComprehensiveAssessment[]): string {
  const completeCount = rows.filter((row) => row.completion.incompleteCount === 0).length
  const gradeCounts = ['S', 'A', 'B', 'C'].map((grade) => `${grade} ${rows.filter((row) => row.grade === grade).length}`).join(' / ')
  return renderStandardListStats([
    { label: '全部工厂', value: `${rows.length} 家` },
    { label: '评定已完善', value: `${completeCount} 家` },
    { label: '待完善', value: `${rows.length - completeCount} 家` },
    { label: '评级分布', value: gradeCounts },
  ])
}

function renderPagination(query: ComprehensiveAssessmentQuery, paging: ReturnType<typeof paginateStandardListRows<ThirdPartyFactoryComprehensiveAssessment>>): string {
  const raw = renderTablePagination({
    total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages,
    pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: PAGE_SIZE_OPTIONS,
  })
  return raw
    .replace(`data-${EVENT_PREFIX}-action="prev-page"`, `data-nav="${escapeHtml(buildHref(query, { page: Math.max(1, paging.currentPage - 1) }))}"`)
    .replace(`data-${EVENT_PREFIX}-action="next-page"`, `data-nav="${escapeHtml(buildHref(query, { page: Math.min(paging.totalPages, paging.currentPage + 1) }))}"`)
}

function renderColumnSettingsOverlay(query: ComprehensiveAssessmentQuery, preferences: StandardListColumnPreferences): string {
  if (!query.columnSettings) return ''
  return renderStandardListColumnSettings({
    title: '列设置', columns, preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: MAX_FROZEN_WIDTH,
  }).replaceAll(
    `data-${EVENT_PREFIX}-action="close-column-settings"`,
    `data-nav="${escapeHtml(buildHref(query, { columnSettings: false }))}"`,
  )
}

function nextSortPatch(query: ComprehensiveAssessmentQuery, columnKey: string): Partial<ComprehensiveAssessmentQuery> {
  if (query.sortKey !== columnKey || !query.sortDirection) return { sortKey: columnKey, sortDirection: 'asc', page: 1 }
  if (query.sortDirection === 'asc') return { sortKey: columnKey, sortDirection: 'desc', page: 1 }
  return { sortKey: '', sortDirection: '', page: 1 }
}

function navigateAssessmentList(href: string): void {
  appStore.navigate(href)
}

function refreshColumnSettings(
  query: ComprehensiveAssessmentQuery,
  patch: Partial<ComprehensiveAssessmentQuery> = {},
): void {
  navigateAssessmentList(buildHref(query, {
    ...patch,
    columnSettings: patch.columnSettings ?? true,
    refreshKey: String(Date.now()),
  }))
}

function getActionColumnKey(actionNode: HTMLElement): string {
  return actionNode.dataset.thirdPartyComprehensiveAssessmentColumnKey || actionNode.dataset.columnKey || ''
}

function getDragColumnKey(dragNode: HTMLElement): string {
  return dragNode.dataset.thirdPartyComprehensiveAssessmentColumnKey
    || dragNode.dataset.dragSource
    || dragNode.dataset.dropTarget
    || ''
}

function getDraggableColumn(columnKey: string): StandardListColumn<ThirdPartyFactoryComprehensiveAssessment> | undefined {
  return columns.find((column) => column.key === columnKey && !column.actionColumn)
}

function canFreezeColumn(
  preferences: StandardListColumnPreferences,
  column: StandardListColumn<ThirdPartyFactoryComprehensiveAssessment>,
): boolean {
  if (!column.freezeable || column.actionColumn) return false
  if (preferences.frozenKeys.includes(column.key)) return true
  const currentFrozenWidth = columns.reduce((total, item) =>
    total + (preferences.frozenKeys.includes(item.key) && !item.actionColumn ? item.width : 0), 0)
  return currentFrozenWidth + column.width <= MAX_FROZEN_WIDTH
}

export function handleThirdPartyFactoryComprehensiveAssessmentEvent(target: HTMLElement, event?: Event): boolean {
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
      !sourceColumn ||
      !targetColumn ||
      (draggedColumnKey !== '' && draggedColumnKey !== sourceColumn.key) ||
      sourceColumn.key === targetColumn.key
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
    saveColumnPreferences(normalizeColumnPreferences({ ...preferences, order }))
    refreshColumnSettings(readQuery())
    return true
  }

  const query = readQuery()
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (fieldNode?.dataset.thirdPartyComprehensiveAssessmentField === 'pageSize') {
    if (event?.type !== 'change') return false
    const pageSize = Number(fieldNode.value)
    if (!PAGE_SIZE_OPTIONS.includes(pageSize)) return true
    saveColumnPreferences(normalizeColumnPreferences({ ...getColumnPreferences(), pageSize }))
    event.preventDefault()
    navigateAssessmentList(buildHref(query, { page: 1, pageSize, refreshKey: '' }))
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (!actionNode || !action) return false
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey ?? ''
    if (!columns.some((column) => column.key === columnKey && column.sortable)) return true
    event?.preventDefault()
    navigateAssessmentList(buildHref(query, { ...nextSortPatch(query, columnKey), refreshKey: '' }))
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    event?.preventDefault()
    navigateAssessmentList(buildHref(query, { columnSettings: action === 'open-column-settings', refreshKey: '' }))
    return true
  }
  if (action === 'restore-column-settings') {
    event?.preventDefault()
    const storage = getListStorage()
    if (storage) clearListColumnPreferences(storage, COLUMN_STORAGE_KEY)
    navigateAssessmentList(buildHref(query, { page: 1, pageSize: 10, columnSettings: true, refreshKey: String(Date.now()) }))
    return true
  }
  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const columnKey = getActionColumnKey(actionNode)
    const rule = columnRules.find((column) => column.key === columnKey)
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
    const column = columns.find((item) => item.key === getActionColumnKey(actionNode))
    if (!column || !canFreezeColumn(getColumnPreferences(), column)) return true
    const preferences = getColumnPreferences()
    const frozenKeys = new Set(preferences.frozenKeys)
    if (frozenKeys.has(column.key)) frozenKeys.delete(column.key)
    else frozenKeys.add(column.key)
    saveColumnPreferences(normalizeColumnPreferences({ ...preferences, frozenKeys: [...frozenKeys] }))
    event.preventDefault()
    refreshColumnSettings(query)
    return true
  }
  return false
}

export function renderThirdPartyFactoryComprehensiveAssessmentPage(): string {
  const query = readQuery()
  const filteredRows = filterThirdPartyFactoryComprehensiveAssessments(listThirdPartyFactoryComprehensiveAssessments(), query)
  const sortedRows = sortStandardListRows(filteredRows, getSortState(query), getSortValue)
  const paging = paginateStandardListRows(sortedRows, query.page, query.pageSize)
  const preferences = getColumnPreferences()
  return renderStandardListPage({
    title: '第三方车缝厂综合评定',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2 text-xs"><span class="text-muted-foreground">来源图例</span>${renderSource('系统获取', 'system')}${renderSource('人工填写', 'manual')}</div>`,
    filtersHtml: renderFilters(query),
    statsHtml: renderStats(filteredRows),
    listTitle: '综合评定列表',
    listActionsHtml: `<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-${EVENT_PREFIX}-action="open-column-settings">列设置</button>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences, sort: getSortState(query), eventPrefix: EVENT_PREFIX, headerGroups, emptyText: '暂无符合条件的三方车缝工厂' }),
    paginationHtml: renderPagination(query, paging),
    overlaysHtml: renderColumnSettingsOverlay(query, preferences),
  })
}
