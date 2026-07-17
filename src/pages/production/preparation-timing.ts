// @page-pattern: list

import { escapeHtml, formatDateTime } from '../../utils.ts'
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { renderMultiSelectFilter } from '../../components/ui/filter-bar.ts'
import { renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../components/ui/list-table.ts'
import {
  appendDownloadRecord,
  buildUploadRecordsFromFiles,
  isBasePatternItem,
  loadPreparationRuntimeState,
  mergePreparationRuntimeRecords,
  savePreparationRuntimeState,
} from '../../data/fcs/production-preparation-timing-runtime.ts'
import {
  buildMonthlyPreparationCompletionDetails,
  buildProductionPreparationKpis,
  externalPreparationMaterials,
  filterProductionPreparationRecords,
  flattenProductionPreparationItems,
  getProductionPreparationFilterOptions,
  getProductionPreparationRecord,
  hasValidPreparationCompletionEvidence,
  preparationOwnerRoleRules,
  preparationItemOwnerTeamMap,
  preparationItemTypes,
  preparationTypeDefaultItems,
  productionPreparationRecords,
  type MonthlyPreparationCompletionDetail,
  type MonthlyPreparationStatRow,
  type ExternalPreparationMaterial,
  type PreparationDyeRequirement,
  type PreparationItemType,
  type PreparationItemProgress,
  type PreparationMaterialLine,
  type PreparationRecordStatus,
  type PreparationUploadRecord,
  type ProductPrepType,
  type ProductionPreparationFilter,
  type ProductionPreparationItem,
  type ProductionPreparationRecord,
} from '../../data/fcs/production-preparation-timing.ts'

const PAGE_PATH = '/fcs/production/preparation-timing'
const STATS_PAGE_PATH = '/fcs/production/preparation-timing-statistics'
const DEFAULT_MONTH = '2026-03'
const MONTHLY_STATS_PAGE_SIZE = 5
const DETAIL_STATS_PAGE_SIZE = 8
const LEDGER_FILTER_KEYS = [
  'startDate',
  'endDate',
  'merchandiserName',
  'recordStatus',
  'itemType',
  'itemProgress',
  'ownerTeam',
  'keyword',
] as const
const STATS_FILTER_KEYS = [
  'merchandiserName',
  'recordStatus',
  'itemType',
  'ownerTeam',
  'keyword',
] as const
const ITEM_PROGRESS_OPTIONS: PreparationItemProgress[] = ['不满足开始条件', '未开始', '已完成']

const ledgerPageSizes = [5, 10, 20, 50]
const ledgerStorageKey = 'higood:list-page:/fcs/production/preparation-timing:ledger'
const ledgerMaxFrozenWidth = 620
const statsPageSizes = [5, 8, 10, 20, 50]
const monthlyStorageKey = 'higood:list-page:/fcs/production/preparation-timing-statistics:monthly'
const detailStorageKey = 'higood:list-page:/fcs/production/preparation-timing-statistics:detail'
const statsMaxFrozenWidth = 620
const ledgerColumnRules: StandardListColumnRule[] = [
  { key: 'product', required: true, freezeable: true },
  { key: 'people', required: true, freezeable: true },
  { key: 'timing', required: true, freezeable: true },
  { key: 'status', required: true, freezeable: true },
  { key: 'completion' },
  { key: 'outputs' },
  { key: 'actions', required: true, actionColumn: true },
]
const defaultLedgerColumnPreferences: StandardListColumnPreferences = {
  order: ledgerColumnRules.map((column) => column.key),
  visibleKeys: ledgerColumnRules.map((column) => column.key),
  frozenKeys: [],
  pageSize: 5,
}

interface LedgerListState {
  page: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  preferencesLoaded: boolean
  records: ProductionPreparationRecord[]
  month: string
  params: URLSearchParams
  filterSignature: string
}

const ledgerListState: LedgerListState = {
  page: 1,
  sort: null,
  columnPreferences: normalizeListColumnPreferences(
    ledgerColumnRules,
    defaultLedgerColumnPreferences,
    ledgerPageSizes,
  ),
  columnSettingsOpen: false,
  draggedColumnKey: '',
  preferencesLoaded: false,
  records: [],
  month: DEFAULT_MONTH,
  params: new URLSearchParams(),
  filterSignature: '',
}

export function enterProductionPreparationTimingRoute(): void {
  ledgerListState.page = 1
  ledgerListState.sort = null
  ledgerListState.columnSettingsOpen = false
  ledgerListState.draggedColumnKey = ''
  ledgerListState.filterSignature = ''
}

function getLedgerFilterSignature(params: URLSearchParams, month: string): string {
  const signature = new URLSearchParams()
  signature.set('month', month)
  for (const key of LEDGER_FILTER_KEYS) {
    for (const value of valuesOf(params, key)) signature.append(key, value)
  }
  return signature.toString()
}

function syncLedgerFilterContext(params: URLSearchParams, month: string): void {
  const nextSignature = getLedgerFilterSignature(params, month)
  if (ledgerListState.filterSignature && ledgerListState.filterSignature !== nextSignature) {
    ledgerListState.page = 1
    ledgerListState.sort = null
  }
  ledgerListState.filterSignature = nextSignature
}

const PREPARATION_ACTION_LABELS: Record<PreparationItemType, string> = {
  梭织基码纸样: '上传梭织基码纸样',
  毛织基码纸样: '上传毛织基码纸样',
  版衣制作: '上传版衣结果',
  梭织齐码纸样: '上传梭织齐码纸样',
  毛织齐码纸样: '上传毛织齐码纸样',
  '数码印/DTF/DTG花型': '上传花型文件',
  '确认染色要求（纱线）': '确认纱线染色要求',
  '染色调色（纱线）': '上传纱线调色结果',
  '确认染色要求（面料）': '确认面料染色要求',
  '染色调色（面料）': '上传面料调色结果',
  辅料下单: '登记辅料下单',
}

interface StatsTableRow extends MonthlyPreparationStatRow {
  ownerTeamText: string
  basisText: string
}

type StatsListKind = 'monthly' | 'detail'

interface StatsListState {
  page: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  preferencesLoaded: boolean
  filterSignature: string
}

const monthlyColumnRules: StandardListColumnRule[] = [
  { key: 'month', required: true, freezeable: true },
  { key: 'itemType', required: true, freezeable: true },
  { key: 'completedCount' },
  { key: 'onTimeCompletedCount' },
  { key: 'overdueCompletedCount' },
  { key: 'averageDurationHours' },
  { key: 'ownerTeamText', freezeable: true },
  { key: 'latestFinishedAt' },
  { key: 'basisText' },
]
const detailColumnRules: StandardListColumnRule[] = [
  { key: 'month', freezeable: true },
  { key: 'recordNo', required: true, freezeable: true },
  { key: 'spuCode', required: true, freezeable: true },
  { key: 'spuName' },
  { key: 'productionOrderNo', required: true, freezeable: true },
  { key: 'confirmedProductPrepType' },
  { key: 'buyerName' },
  { key: 'merchandiserName' },
  { key: 'itemType', required: true, freezeable: true },
  { key: 'requiredKind' },
  { key: 'ownerTeam', freezeable: true },
  { key: 'ownerName' },
  { key: 'plannedFinishAt' },
  { key: 'actualFinishAt', required: true, freezeable: true },
  { key: 'onTime' },
  { key: 'evidenceSummary' },
]

function createDefaultStatsPreferences(rules: StandardListColumnRule[], pageSize: number): StandardListColumnPreferences {
  return {
    order: rules.map((column) => column.key),
    visibleKeys: rules.map((column) => column.key),
    frozenKeys: [],
    pageSize,
  }
}

const defaultMonthlyPreferences = createDefaultStatsPreferences(monthlyColumnRules, MONTHLY_STATS_PAGE_SIZE)
const defaultDetailPreferences = createDefaultStatsPreferences(detailColumnRules, DETAIL_STATS_PAGE_SIZE)

function createStatsListState(rules: StandardListColumnRule[], defaults: StandardListColumnPreferences): StatsListState {
  return {
    page: 1,
    sort: null,
    columnPreferences: normalizeListColumnPreferences(rules, defaults, statsPageSizes),
    columnSettingsOpen: false,
    draggedColumnKey: '',
    preferencesLoaded: false,
    filterSignature: '',
  }
}

const monthlyStatsListState = createStatsListState(monthlyColumnRules, defaultMonthlyPreferences)
const detailStatsListState = createStatsListState(detailColumnRules, defaultDetailPreferences)
let activeStatsListKind: StatsListKind = 'monthly'

export function enterProductionPreparationTimingStatisticsRoute(): void {
  for (const state of [monthlyStatsListState, detailStatsListState]) {
    state.page = 1
    state.sort = null
    state.columnSettingsOpen = false
    state.draggedColumnKey = ''
    state.filterSignature = ''
  }
  activeStatsListKind = 'monthly'
}

function valueOf(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim() ?? ''
}

function valuesOf(params: URLSearchParams, key: string): string[] {
  return Array.from(new Set(params.getAll(key).map((value) => value.trim()).filter(Boolean)))
}

type HrefValues = Record<string, string | number | boolean | null | undefined>

function buildPathHref(path: string, values: HrefValues, source?: URLSearchParams): string {
  const params = new URLSearchParams(source)
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') {
      params.delete(key)
      continue
    }
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

function buildHref(values: HrefValues, source?: URLSearchParams): string {
  return buildPathHref(PAGE_PATH, values, source)
}

function buildStatsHref(values: HrefValues, source?: URLSearchParams): string {
  return buildPathHref(STATS_PAGE_PATH, values, source ? getStatsQueryParams(source) : undefined)
}

function getStatsQueryParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  const tab = valueOf(params, 'tab') === 'detail' ? 'detail' : 'monthly'
  const month = valueOf(params, 'month')
  next.set('tab', tab)
  if (month) next.set('month', month)
  for (const key of STATS_FILTER_KEYS) {
    for (const value of valuesOf(params, key)) next.append(key, value)
  }
  const pageKey = tab === 'detail' ? 'detailPage' : 'monthlyPage'
  const page = valueOf(params, pageKey)
  if (page) next.set(pageKey, page)
  return next
}

function renderBadge(label: string, tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' = 'slate'): string {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[tone]}">${escapeHtml(label)}</span>`
}

function statusTone(status: string): 'slate' | 'blue' | 'green' | 'amber' | 'red' {
  if (status === '已完成' || status === '已通过') return 'green'
  if (status === '进行中' || status === '待确认') return 'blue'
  if (status === '部分超时' || status === '已超时' || status === '需调整') return 'red'
  if (status === '待分配' || status === '待开始' || status === '待判断' || status === '未开始') return 'amber'
  return 'slate'
}

function parseFilter(params: URLSearchParams): ProductionPreparationFilter {
  const filter: ProductionPreparationFilter = {}
  const startDate = valueOf(params, 'startDate')
  const endDate = valueOf(params, 'endDate')
  const merchandiserNames = valuesOf(params, 'merchandiserName')
  const recordStatuses = valuesOf(params, 'recordStatus').filter((value) => value !== '全部') as PreparationRecordStatus[]
  const itemTypes = valuesOf(params, 'itemType').filter((value) => value !== '全部') as PreparationItemType[]
  const ownerTeams = valuesOf(params, 'ownerTeam')
  const itemProgresses = valuesOf(params, 'itemProgress') as PreparationItemProgress[]
  const keyword = valueOf(params, 'keyword')

  if (startDate) filter.startDate = startDate
  if (endDate) filter.endDate = endDate
  filter.merchandiserNames = merchandiserNames
  filter.recordStatuses = recordStatuses
  filter.itemTypes = itemTypes
  filter.ownerTeams = ownerTeams
  filter.itemProgresses = itemProgresses
  if (keyword) filter.keyword = keyword
  return filter
}

function startDateOfMonth(month: string): string {
  return `${month || DEFAULT_MONTH}-01`
}

function endDateOfMonth(month: string): string {
  const [year, monthValue] = (month || DEFAULT_MONTH).split('-').map((part) => Number(part))
  if (!year || !monthValue) return `${DEFAULT_MONTH}-31`
  return new Date(year, monthValue, 0).toISOString().slice(0, 10)
}

function getLedgerQueryParams(params: URLSearchParams, month: string): URLSearchParams {
  const next = new URLSearchParams()
  next.set('tab', 'ledger')
  next.set('month', month)
  for (const key of LEDGER_FILTER_KEYS) {
    for (const value of valuesOf(params, key)) next.append(key, value)
  }
  const page = valueOf(params, 'page')
  if (page) next.set('page', page)
  return next
}

function buildLedgerHrefFromParams(params: URLSearchParams, month: string): string {
  return buildHref({}, getLedgerQueryParams(params, month))
}

function buildLedgerActionHref(
  params: URLSearchParams,
  month: string,
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  return buildHref(values, getLedgerQueryParams(params, month))
}

function filterLedgerRecords(
  filter: ProductionPreparationFilter,
  month: string,
  records: ProductionPreparationRecord[],
): ProductionPreparationRecord[] {
  if (filter.startDate || filter.endDate) return filterProductionPreparationRecords(filter, records)
  return filterProductionPreparationRecords(filter, records).filter((record) => record.enteredAt.startsWith(month))
}

function requiredItems(record: ProductionPreparationRecord): ProductionPreparationItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
}

function hasConfirmedWorkItems(record: ProductionPreparationRecord): boolean {
  return Boolean(record.workItemsConfirmedBy && record.workItemsConfirmedAt)
}

const hasCompletionEvidence = hasValidPreparationCompletionEvidence

function canOperateItem(item: ProductionPreparationItem, record: ProductionPreparationRecord): boolean {
  if (!item.dependsOnItemIds.length) return true
  return item.dependsOnItemIds.every((depId) => {
    const dep = record.items.find((i) => i.itemId === depId)
    return dep && hasCompletionEvidence(dep)
  })
}

function actualPreparationFinishAt(record: ProductionPreparationRecord): string {
  return requiredItems(record)
    .filter(hasCompletionEvidence)
    .map((item) => item.actualFinishAt)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? ''
}

function isPreparationOutputReady(record: ProductionPreparationRecord): boolean {
  if (!hasConfirmedWorkItems(record) || record.outputs.length === 0) return false
  const items = requiredItems(record)
  return items.length > 0 && items.every(hasCompletionEvidence)
}

function renderItemStatusBadge(item: ProductionPreparationItem): string {
  if (item.status === '已完成' && !hasCompletionEvidence(item)) return renderBadge('证据缺失', 'red')
  return renderBadge(item.status, statusTone(item.status))
}

function outputGeneratedAt(record: ProductionPreparationRecord): string {
  if (!isPreparationOutputReady(record)) return ''
  if (record.outputPublishedAt) return record.outputPublishedAt
  return requiredItems(record)
    .map((item) => item.actualFinishAt)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? ''
}

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value)
  const safeText = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text
  if (/[",\n\r]/.test(safeText)) return `"${safeText.replaceAll('"', '""')}"`
  return safeText
}

export function buildProductionPreparationCsvDataUri(rows: string[][]): string {
  const lines = rows.map((row) => row.map(escapeCsvValue).join(','))
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${lines.join('\n')}`)}`
}

function renderHeaderActions(params: URLSearchParams, month: string): string {
  const externalMaterialsHref = buildLedgerActionHref(params, month, { action: 'external-materials' })
  return `
    <button type="button" class="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm hover:bg-muted" data-nav="${escapeHtml(externalMaterialsHref)}">维护非系统内物料</button>
  `
}

function renderStatsHeader(activeTab: 'monthly' | 'detail', month: string, params: URLSearchParams): string {
  const tabs = [
    { key: 'monthly', label: '月度统计', href: buildStatsHref({ tab: 'monthly', month, monthlyPage: 1, detailPage: null }, params) },
    { key: 'detail', label: '明细统计', href: buildStatsHref({ tab: 'detail', month, detailPage: 1, monthlyPage: null }, params) },
  ] as const

  return `
    <nav class="flex rounded-lg border bg-background p-1 text-sm">
      ${tabs.map((tab) => `
        <button
          type="button"
          data-nav="${escapeHtml(tab.href)}"
          class="rounded-md px-4 py-2 ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}"
        >${escapeHtml(tab.label)}</button>
      `).join('')}
    </nav>
  `
}

function renderPreparationMultiSelect(config: {
  label: string
  field: 'merchandiserName' | 'recordStatus' | 'itemType' | 'itemProgress' | 'ownerTeam'
  selectedValues: string[]
  options: string[]
  visibleOptions?: Set<string>
}): string {
  const options = Array.from(new Set([...config.options, ...config.selectedValues]))
  return renderMultiSelectFilter({
    label: config.label,
    field: config.field,
    selectedValues: config.selectedValues,
    options,
    actionAttr: 'data-prep-filter-checkbox',
    skipPageRerender: true,
    inputName: config.field,
    containerAttributes: { 'data-prep-filter-group': config.field },
    summaryAttributes: {
      'data-prep-filter-summary': config.field,
      'data-prep-filter-label': config.label,
    },
    optionAttributes: (option) => {
      const hidden = config.visibleOptions && !config.visibleOptions.has(option) && !config.selectedValues.includes(option)
      const attributes: Record<string, string> = {
        'data-prep-filter-option-label': '',
        'data-prep-filter-field': config.field,
        'data-prep-filter-value': option,
      }
      if (config.field === 'itemType') {
        attributes['data-related-owner-team'] = preparationItemOwnerTeamMap[option as PreparationItemType] ?? ''
      }
      if (config.field === 'ownerTeam') {
        attributes['data-related-item-types'] = JSON.stringify(
          preparationItemTypes.filter((itemType) => preparationItemOwnerTeamMap[itemType] === option),
        )
      }
      if (hidden) attributes.hidden = ''
      return attributes
    },
  })
}

function getDependencyOptions(params: URLSearchParams): {
  selectedItemTypes: PreparationItemType[]
  selectedOwnerTeams: string[]
  visibleItemTypes: Set<string>
  visibleOwnerTeams: Set<string>
} {
  const selectedItemTypes = valuesOf(params, 'itemType')
    .filter((value) => value !== '全部') as PreparationItemType[]
  const selectedOwnerTeams = valuesOf(params, 'ownerTeam')
  const visibleItemTypes = new Set<string>(selectedItemTypes)
  const visibleOwnerTeams = new Set<string>(selectedOwnerTeams)

  for (const itemType of preparationItemTypes) {
    const ownerTeam = preparationItemOwnerTeamMap[itemType]
    if (!selectedOwnerTeams.length || selectedOwnerTeams.includes(ownerTeam)) visibleItemTypes.add(itemType)
    if (!selectedItemTypes.length || selectedItemTypes.includes(itemType)) visibleOwnerTeams.add(ownerTeam)
  }
  return { selectedItemTypes, selectedOwnerTeams, visibleItemTypes, visibleOwnerTeams }
}

function renderLedgerFilter(params: URLSearchParams, month: string): string {
  const options = getProductionPreparationFilterOptions()
  const startDate = valueOf(params, 'startDate') || startDateOfMonth(month)
  const endDate = valueOf(params, 'endDate') || endDateOfMonth(month)
  const dependencyOptions = getDependencyOptions(params)

  return `
    <section data-prep-filter-scope class="rounded-xl border bg-card p-3">
      <input type="hidden" name="tab" value="ledger" />
      <input type="hidden" name="month" value="${escapeHtml(month)}" />
      <div class="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
        <label class="flex min-w-[300px] flex-col gap-1 text-sm">
          <span class="text-muted-foreground">日期</span>
          <span class="flex items-center gap-1">
            <input type="date" name="startDate" value="${escapeHtml(startDate)}" class="h-9 min-w-0 flex-1 rounded-md border bg-background px-2" />
            <span class="text-xs text-muted-foreground">至</span>
            <input type="date" name="endDate" value="${escapeHtml(endDate)}" class="h-9 min-w-0 flex-1 rounded-md border bg-background px-2" />
          </span>
        </label>
        ${renderPreparationMultiSelect({ label: '跟单', field: 'merchandiserName', selectedValues: valuesOf(params, 'merchandiserName'), options: options.merchandiserNames })}
        ${renderPreparationMultiSelect({ label: '记录状态', field: 'recordStatus', selectedValues: valuesOf(params, 'recordStatus').filter((value) => value !== '全部'), options: options.recordStatuses.filter((value) => value !== '全部') })}
        ${renderPreparationMultiSelect({ label: '准备项', field: 'itemType', selectedValues: dependencyOptions.selectedItemTypes, options: preparationItemTypes, visibleOptions: dependencyOptions.visibleItemTypes })}
        ${renderPreparationMultiSelect({ label: '准备项进度', field: 'itemProgress', selectedValues: valuesOf(params, 'itemProgress'), options: ITEM_PROGRESS_OPTIONS })}
        ${renderPreparationMultiSelect({ label: '责任团队', field: 'ownerTeam', selectedValues: dependencyOptions.selectedOwnerTeams, options: options.ownerTeams, visibleOptions: dependencyOptions.visibleOwnerTeams })}
        <label class="flex min-w-[240px] flex-col gap-1 text-sm">
          <span class="text-muted-foreground">关键词</span>
          <input name="keyword" value="${escapeHtml(valueOf(params, 'keyword'))}" placeholder="商品 / 生产单 / 准备项 / 跟单" class="h-9 rounded-md border bg-background px-3" />
        </label>
        <button type="button" class="inline-flex h-9 shrink-0 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-nav-from-fields="[data-prep-filter-scope]" data-nav-base="${PAGE_PATH}">筛选</button>
        <button type="button" class="inline-flex h-9 shrink-0 items-center rounded-md border px-4 text-sm hover:bg-muted" data-nav="${PAGE_PATH}?tab=ledger&month=${escapeHtml(DEFAULT_MONTH)}&startDate=${escapeHtml(startDateOfMonth(DEFAULT_MONTH))}&endDate=${escapeHtml(endDateOfMonth(DEFAULT_MONTH))}">重置</button>
      </div>
    </section>
  `
}

function renderKpis(records: ProductionPreparationRecord[], month: string, filter: ProductionPreparationFilter): string {
  const helperKpis = new Map(buildProductionPreparationKpis(records).map((kpi) => [kpi.key, kpi]))
  const items = flattenProductionPreparationItems(records).filter(
    (item) => item.selectedByMerchandiser !== false && item.status !== '无需' && item.recordStatus !== '已关闭',
  )
  const monthCompletedCount = buildMonthlyPreparationCompletionDetails(month, filter).length
  const todayKey = `${month}-10`
  const cards = [
    {
      label: '准备记录总数',
      value: records.length,
      unit: '条',
      hint: helperKpis.get('active-records')?.hint ?? '按进入准备月份统计',
    },
    {
      label: '进行中',
      value: records.filter((record) => record.status === '进行中').length,
      unit: '条',
      hint: '仍有准备项未完成',
    },
    {
      label: '部分超时',
      value: records.filter((record) => record.status === '部分超时').length,
      unit: '条',
      hint: '存在超时或超计划准备项',
    },
    {
      label: '今日应完成准备项',
      value: items.filter((item) => item.plannedFinishAt.startsWith(todayKey)).length,
      unit: '项',
      hint: `${todayKey} 计划完成`,
    },
    {
      label: '本月已完成准备项',
      value: monthCompletedCount,
      unit: '项',
      hint: '按实际完成时间统计',
    },
  ]

  return `
    <section class="grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-5">
      ${cards.map((card) => `
        <div class="rounded-lg border bg-card px-3 py-2">
          <div class="flex min-w-0 items-center justify-between gap-2 text-sm">
            <span class="truncate text-muted-foreground">${escapeHtml(card.label)}</span>
            <span class="shrink-0 font-semibold">${card.value.toLocaleString()}<span class="ml-0.5 text-xs font-normal text-muted-foreground">${escapeHtml(card.unit)}</span></span>
          </div>
        </div>
      `).join('')}
    </section>
  `
}

function renderProductTypeCell(record: ProductionPreparationRecord, confirmed: boolean): string {
  const label = confirmed ? record.confirmedProductPrepType : '待跟单确认'
  return `
    <span class="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">${escapeHtml(label)}</span>
  `
}

function renderCompletionSituation(record: ProductionPreparationRecord): string {
  const items = requiredItems(record)
  if (!items.length) return '<div class="text-xs text-muted-foreground">待跟单确认准备项</div>'
  return `
    <div class="flex max-w-[280px] flex-wrap gap-1">
      ${items.map((item) => {
        const completed = hasCompletionEvidence(item)
        const classes = completed
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
        return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${classes}">${escapeHtml(item.itemType)}</span>`
      }).join('')}
    </div>
  `
}

function materialLines(record: ProductionPreparationRecord): PreparationMaterialLine[] {
  if (record.materialRequirement.items?.length) return record.materialRequirement.items
  const {
    materialNo,
    materialName,
    materialType = '主面料',
    imageUrl = '',
    requiredQty = 0,
    preparedQty = 0,
    issuedQty = 0,
    unit = '米',
  } = record.materialRequirement
  if (!materialNo && !materialName) return []
  return [{ materialNo, materialName, materialType, imageUrl, requiredQty, preparedQty, issuedQty, unit }]
}

function renderMaterialRequirementTable(record: ProductionPreparationRecord): string {
  const lines = materialLines(record)
  if (!lines.length) {
    return '<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">待跟单维护本次用料。</div>'
  }

  return `
    <div class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            ${['图片', '物料名称', '物料编码', '物料类型'].map((head) => `<th class="px-3 py-2 text-left font-medium">${escapeHtml(head)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${lines.map((material) => `
            <tr class="border-t">
              ${material.materialSource === '非系统内物料'
                ? `
                  <td class="px-3 py-2 text-xs text-muted-foreground">非系统内物料</td>
                  <td class="px-3 py-2 font-medium">${escapeHtml(material.materialName)}</td>
                  <td class="px-3 py-2">序号 ${material.externalSerialNo ?? '-'}</td>
                  <td class="px-3 py-2 text-muted-foreground">-</td>
                `
                : `
                  <td class="px-3 py-2">
                    ${material.imageUrl ? `<img src="${escapeHtml(material.imageUrl)}" alt="${escapeHtml(material.materialName)}" class="h-12 w-12 rounded-md border object-cover" />` : '<div class="h-12 w-12 rounded-md border bg-muted" />'}
                  </td>
                  <td class="px-3 py-2 font-medium">${escapeHtml(material.materialName)}</td>
                  <td class="px-3 py-2 font-mono text-xs">${escapeHtml(material.materialNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(material.materialType)}</td>
                `}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function materialCatalog(): PreparationMaterialLine[] {
  const unique = new Map<string, PreparationMaterialLine>()
  for (const record of productionPreparationRecords) {
    for (const material of materialLines(record)) {
      if (!unique.has(material.materialNo)) unique.set(material.materialNo, material)
    }
  }
  return Array.from(unique.values())
}

function renderMaterialDatalist(): string {
  return `
    <datalist id="prep-material-options">
      ${materialCatalog().map((material) => `
        <option
          value="${escapeHtml(material.materialNo)}"
          label="${escapeHtml(`${material.materialName} / ${material.materialType}`)}"
          data-material-name="${escapeHtml(material.materialName)}"
          data-material-type="${escapeHtml(material.materialType)}"
          data-image-url="${escapeHtml(material.imageUrl)}"
          data-required-qty="${material.requiredQty}"
          data-prepared-qty="${material.preparedQty}"
          data-issued-qty="${material.issuedQty}"
          data-unit="${escapeHtml(material.unit)}"
        ></option>
      `).join('')}
    </datalist>
  `
}

function allExternalMaterials(): ExternalPreparationMaterial[] {
  const runtime = loadPreparationRuntimeState()
  return [...externalPreparationMaterials, ...runtime.externalMaterials]
}

function renderExternalMaterialDatalist(): string {
  return `
    <datalist id="prep-external-material-options">
      ${allExternalMaterials().map((material) => `
        <option value="${escapeHtml(material.materialName)}" label="序号 ${material.serialNo}" data-external-serial-no="${material.serialNo}"></option>
      `).join('')}
    </datalist>
  `
}

function renderExternalMaterialsDialog(params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'external-materials') return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 flex max-h-[calc(100vh-80px)] w-[720px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
        <div class="border-b p-5">
          <h3 class="text-lg font-semibold">非系统内物料</h3>
        </div>
        <form class="border-b p-5" data-prep-external-material-form>
          <label class="block text-sm">
            <span class="text-muted-foreground">物料名称</span>
            <input name="materialName" class="mt-1 h-10 w-full rounded-md border px-3" required />
          </label>
          <button type="submit" class="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white">新增</button>
        </form>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          <table class="w-full text-sm">
            <thead class="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">序号</th>
                <th class="px-3 py-2 text-left font-medium">物料名称</th>
              </tr>
            </thead>
            <tbody data-prep-external-material-list>
              ${allExternalMaterials().map((material) => `
                <tr class="border-t">
                  <td class="px-3 py-2">${material.serialNo}</td>
                  <td class="px-3 py-2">${escapeHtml(material.materialName)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderConfirmMaterialRow(material: PreparationMaterialLine): string {
  const materialSource = material.materialSource === '非系统内物料' ? '非系统内物料' : '系统内物料'
  const isExternalMaterial = materialSource === '非系统内物料'
  return `
    <tr class="border-t" data-prep-material-row>
      <td class="px-3 py-2 align-middle">
        <select name="materialSource" class="h-9 rounded-md border px-2 text-sm" data-prep-material-source>
          <option value="系统内物料" ${materialSource === '系统内物料' ? 'selected' : ''}>系统内物料</option>
          <option value="非系统内物料" ${materialSource === '非系统内物料' ? 'selected' : ''}>非系统内物料</option>
        </select>
      </td>
      <td class="px-3 py-2 align-middle">
        <div data-prep-system-material-picker ${isExternalMaterial ? 'hidden' : ''}>
          <input name="materialNo" list="prep-material-options" value="${escapeHtml(material.materialNo)}" placeholder="输入编号或名称搜索" class="h-9 w-56 rounded-md border px-3 text-sm" data-prep-material-input />
        </div>
        <div data-prep-external-material-picker ${isExternalMaterial ? '' : 'hidden'}>
          <input name="externalMaterialName" list="prep-external-material-options" value="${escapeHtml(isExternalMaterial ? material.materialName : '')}" placeholder="输入非系统内物料名称搜索" class="h-9 w-56 rounded-md border px-3 text-sm" data-prep-external-material-input />
          <input type="hidden" name="externalSerialNo" value="${material.externalSerialNo ?? ''}" data-prep-external-serial-no />
        </div>
        <input type="hidden" name="materialName" value="${escapeHtml(material.materialName)}" data-prep-material-name />
        <input type="hidden" name="materialType" value="${escapeHtml(material.materialType)}" data-prep-material-type />
        <input type="hidden" name="materialImageUrl" value="${escapeHtml(material.imageUrl)}" data-prep-material-image />
        <input type="hidden" name="materialRequiredQty" value="${material.requiredQty}" data-prep-material-required />
        <input type="hidden" name="materialPreparedQty" value="${material.preparedQty}" data-prep-material-prepared />
        <input type="hidden" name="materialIssuedQty" value="${material.issuedQty}" data-prep-material-issued />
        <input type="hidden" name="materialUnit" value="${escapeHtml(material.unit)}" data-prep-material-unit />
      </td>
      <td class="px-3 py-2 align-middle">
        ${materialSource === '非系统内物料'
          ? '<div class="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">外部</div>'
          : `<img src="${escapeHtml(material.imageUrl)}" alt="${escapeHtml(material.materialName)}" class="h-12 w-12 rounded-md border object-cover" data-prep-material-preview-image />`}
      </td>
      <td class="px-3 py-2 align-middle font-medium" data-prep-material-preview-name>${escapeHtml(material.materialName)}</td>
      <td class="px-3 py-2 align-middle font-mono text-xs text-muted-foreground" data-prep-material-preview-no>${escapeHtml(material.materialNo)}</td>
      <td class="px-3 py-2 align-middle text-sm" data-prep-material-preview-type>${escapeHtml(material.materialType)}</td>
      <td class="px-3 py-2 align-middle">
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-prep-action="remove-material-row">删除</button>
      </td>
    </tr>
  `
}

function renderConfirmMaterialRows(record: ProductionPreparationRecord): string {
  const lines = materialLines(record)
  return `
    ${renderMaterialDatalist()}
    ${renderExternalMaterialDatalist()}
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[760px] text-sm">
        <thead class="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            ${['来源', '选择物料', '图片', '物料名称', '物料编号', '物料类型', '操作'].map((head) => `<th class="px-3 py-2 font-medium">${escapeHtml(head)}</th>`).join('')}
          </tr>
        </thead>
        <tbody data-prep-material-rows>
          ${lines.map((material) => renderConfirmMaterialRow(material)).join('')}
        </tbody>
      </table>
    </div>
    <button type="button" class="mt-3 rounded-md border px-3 py-2 text-sm text-blue-600 hover:bg-muted" data-prep-action="add-material-row">新增物料行</button>
  `
}

function renderLedgerOutputList(record: ProductionPreparationRecord): string {
  const productionOrderLink = record.productionOrderNo
    ? `<button type="button" class="block text-left text-xs text-blue-600 hover:underline" data-nav="${escapeHtml(`/fcs/production/orders?keyword=${encodeURIComponent(record.productionOrderNo)}`)}">生产单：${escapeHtml(record.productionOrderNo)}</button>`
    : ''

  if (!record.outputs.length) {
    if (productionOrderLink) {
      return `
        <div class="space-y-1 text-xs">
          ${productionOrderLink}
          <div class="text-xs text-muted-foreground">${hasConfirmedWorkItems(record) ? '待全部准备项完成后生成其他产出' : '待跟单确认'}</div>
        </div>
      `
    }
    return `<div class="text-xs text-muted-foreground">${hasConfirmedWorkItems(record) ? '待全部准备项完成后生成' : '待跟单确认'}</div>`
  }

  return `
    <div class="space-y-1 text-xs">
      ${productionOrderLink}
      ${record.outputs.map((output) => {
        const text = `${output.outputType}：${output.outputNo} ${formatDateTime(output.outputGeneratedAt)}`
        return `<button type="button" class="block text-left text-blue-600 hover:underline" data-nav="${escapeHtml(output.outputHref)}">${escapeHtml(text)}</button>`
      }).join('')}
    </div>
  `
}

function preparationActionLabel(item: ProductionPreparationItem): string {
  return PREPARATION_ACTION_LABELS[item.itemType]
}

function isDyeItem(item: ProductionPreparationItem): boolean {
  return item.itemType.includes('染色调色')
}

function isDyeRequirementItem(item: ProductionPreparationItem): boolean {
  return item.itemType === '确认染色要求（纱线）' || item.itemType === '确认染色要求（面料）'
}

function isSelectedPreparationItem(item: ProductionPreparationItem): boolean {
  return item.selectedByMerchandiser !== false && item.status !== '无需'
}

function normalizeSelectedPreparationItemTypes(itemTypes: PreparationItemType[]): PreparationItemType[] {
  const normalized = new Set(itemTypes)
  if (normalized.has('染色调色（纱线）')) normalized.add('确认染色要求（纱线）')
  if (normalized.has('染色调色（面料）')) normalized.add('确认染色要求（面料）')
  return [...normalized]
}

function renderLedgerActions(
  record: ProductionPreparationRecord,
  confirmed: boolean,
  month: string,
  params: URLSearchParams,
): string {
  const detailHref = buildLedgerActionHref(params, month, { recordId: record.recordId })
  const confirmHref = buildLedgerActionHref(params, month, { recordId: record.recordId, action: 'confirm-items' })
  const itemButtons = confirmed
    ? requiredItems(record).map((item) => {
        const operable = canOperateItem(item, record) && (!isDyeRequirementItem(item) || item.status !== '已完成')
        const operateHref = buildLedgerActionHref(params, month, {
          recordId: record.recordId,
          itemId: item.itemId,
          action: 'operate-item',
        })
        return `
          ${
            operable
              ? `<button type="button" class="text-left text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(operateHref)}">${escapeHtml(preparationActionLabel(item))}</button>`
              : `<span class="text-sm text-muted-foreground opacity-60">${escapeHtml(preparationActionLabel(item))}</span>`
          }
        `
      }).join('')
    : ''

  if (!confirmed) {
    return `
      <div class="flex min-w-[160px] flex-col items-start gap-2">
        <button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(confirmHref)}">确认工作项</button>
      </div>
    `
  }

  return `
    <div class="flex min-w-[180px] flex-col items-start gap-2">
      <button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(detailHref)}">查看详情</button>
      ${itemButtons}
    </div>
  `
}

function renderLedgerProductCell(record: ProductionPreparationRecord): string {
  const confirmed = hasConfirmedWorkItems(record)
  return `
    <div class="flex min-w-[260px] gap-3">
      <img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.spuName)}" class="h-14 w-14 rounded-md border object-cover" />
      <div>
        <div class="font-medium text-foreground">${escapeHtml(record.spuName)}</div>
        <div class="mt-1">${renderProductTypeCell(record, confirmed)}</div>
        <div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(record.spuCode)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.sourceReason)}</div>
        <div class="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <div>达到做大货要求：${escapeHtml(formatDateTime(record.largeGoodsReachedAt))}</div>
          <div>阈值 ${record.largeGoodsThresholdQty} 件 / 达到 ${record.largeGoodsReachedQty} 件 / ${record.largeGoodsReachedDays} 天</div>
        </div>
      </div>
    </div>
  `
}

function renderLedgerPeopleCell(record: ProductionPreparationRecord): string {
  return `
    <div class="min-w-[170px]">
      <div>选品：${escapeHtml(record.selectionName)}</div>
      <div class="mt-1 text-xs text-muted-foreground">买手：${escapeHtml(record.buyerName)}</div>
      <div class="mt-1 text-xs text-muted-foreground">跟单：${escapeHtml(record.merchandiserName)}</div>
    </div>
  `
}

function renderLedgerTimingCell(record: ProductionPreparationRecord): string {
  const actualFinishAt = actualPreparationFinishAt(record)
  return `
    <div class="min-w-[180px] whitespace-nowrap text-xs">
      <div>进入：${escapeHtml(formatDateTime(record.enteredAt))}</div>
      <div class="mt-1 text-muted-foreground">预计：${escapeHtml(formatDateTime(record.expectedFinishAt))}</div>
      <div class="mt-1 text-muted-foreground">实际：${escapeHtml(actualFinishAt ? formatDateTime(actualFinishAt) : '-')}</div>
    </div>
  `
}

function createLedgerColumns(month: string, params: URLSearchParams): StandardListColumn<ProductionPreparationRecord>[] {
  return [
    {
      key: 'product', title: '商品', width: 300, minWidth: 280, required: true, freezeable: true, sortable: true,
      sortValue: (record) => record.spuCode,
      render: renderLedgerProductCell,
    },
    {
      key: 'people', title: '选品/买手/跟单', width: 210, minWidth: 190, required: true, freezeable: true, sortable: true,
      sortValue: (record) => `${record.merchandiserName}-${record.buyerName}-${record.selectionName}`,
      render: renderLedgerPeopleCell,
    },
    {
      key: 'timing', title: '准备时间', width: 220, minWidth: 210, required: true, freezeable: true, sortable: true,
      sortValue: (record) => record.enteredAt,
      render: renderLedgerTimingCell,
    },
    {
      key: 'status', title: '整体状态', width: 130, minWidth: 120, required: true, freezeable: true, sortable: true,
      sortValue: (record) => record.status,
      render: (record) => renderBadge(record.status, statusTone(record.status)),
    },
    {
      key: 'completion', title: '完成情况', width: 250, minWidth: 230, sortable: true,
      sortValue: (record) => requiredItems(record).filter(hasCompletionEvidence).length,
      render: renderCompletionSituation,
    },
    {
      key: 'outputs', title: '产出', width: 300, minWidth: 280, sortable: true,
      sortValue: (record) => record.outputs.filter((output) => output.outputStatus === '已生成').length,
      render: renderLedgerOutputList,
    },
    {
      key: 'actions', title: '操作', width: 220, minWidth: 210, required: true, actionColumn: true,
      render: (record) => renderLedgerActions(record, hasConfirmedWorkItems(record), month, params),
    },
  ]
}

function getLedgerStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function ensureLedgerPreferences(): void {
  if (ledgerListState.preferencesLoaded) return
  ledgerListState.preferencesLoaded = true
  const storage = getLedgerStorage()
  ledgerListState.columnPreferences = storage
    ? loadListColumnPreferences(storage, ledgerStorageKey, ledgerColumnRules, defaultLedgerColumnPreferences, ledgerPageSizes)
    : normalizeListColumnPreferences(ledgerColumnRules, defaultLedgerColumnPreferences, ledgerPageSizes)
}

function saveLedgerPreferences(): void {
  const storage = getLedgerStorage()
  if (storage) saveListColumnPreferences(storage, ledgerStorageKey, ledgerListState.columnPreferences)
}

function getLedgerListView(): StandardListPageSlice<ProductionPreparationRecord> {
  const columns = createLedgerColumns(ledgerListState.month, ledgerListState.params)
  const sorted = sortStandardListRows(ledgerListState.records, ledgerListState.sort, (record, key) =>
    columns.find((column) => column.key === key)?.sortValue?.(record),
  )
  const paging = paginateStandardListRows(sorted, ledgerListState.page, ledgerListState.columnPreferences.pageSize)
  ledgerListState.page = paging.currentPage
  return paging
}

function renderLedgerStandardTable(paging: StandardListPageSlice<ProductionPreparationRecord>): string {
  return renderStandardListTable({
    columns: createLedgerColumns(ledgerListState.month, ledgerListState.params),
    rows: paging.rows,
    preferences: ledgerListState.columnPreferences,
    sort: ledgerListState.sort,
    eventPrefix: 'production-preparation-ledger',
    emptyText: '当前筛选条件下暂无生产准备记录',
  })
}

function renderLedgerStandardPagination(paging: StandardListPageSlice<ProductionPreparationRecord>): string {
  return renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'production-preparation-ledger',
    fieldPrefix: 'production-preparation-ledger',
    pageSizeOptions: ledgerPageSizes,
  })
}

function renderLedgerColumnSettings(): string {
  if (!ledgerListState.columnSettingsOpen) return ''
  return renderStandardListColumnSettings({
    title: '准备台账列设置',
    columns: createLedgerColumns(ledgerListState.month, ledgerListState.params),
    preferences: ledgerListState.columnPreferences,
    eventPrefix: 'production-preparation-ledger',
    maxFrozenWidth: ledgerMaxFrozenWidth,
  })
}

function renderLedgerTab(params: URLSearchParams, month: string): string {
  ensureLedgerPreferences()
  syncLedgerFilterContext(params, month)
  const filter = parseFilter(params)
  const runtime = loadPreparationRuntimeState()
  const recordsWithRuntime = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
  const records = filterLedgerRecords(filter, month, recordsWithRuntime)
  const recordId = valueOf(params, 'recordId')
  const sourceFallbackRecord = recordId ? getProductionPreparationRecord(recordId) : null
  const fallbackRecord = recordId
    ? recordsWithRuntime.find((record) => record.recordId === recordId) ??
      (sourceFallbackRecord ? mergePreparationRuntimeRecords([sourceFallbackRecord], runtime)[0] : null)
    : null
  const detailRecord = recordId
    ? records.find((record) => record.recordId === recordId) ??
      fallbackRecord ??
      null
    : null
  const activeItemId = valueOf(params, 'itemId')
  const activeItem = detailRecord && hasConfirmedWorkItems(detailRecord)
    ? detailRecord.items.find((item) => item.itemId === activeItemId) ?? null
    : null
  const action = valueOf(params, 'action')
  ledgerListState.records = records
  ledgerListState.month = month
  ledgerListState.params = new URLSearchParams(params)
  const paging = getLedgerListView()
  const columnSettingsButton = `
    <span data-skip-page-rerender="true">
      ${renderSecondaryButton('列设置', { prefix: 'production-preparation-ledger', action: 'open-column-settings' }, 'columns-3')}
    </span>
  `
  const businessOverlays = `
    ${detailRecord && !action ? renderDetailDrawer(detailRecord, params, month) : ''}
    ${detailRecord ? renderConfirmItemsDialog(detailRecord, params, month) : ''}
    ${detailRecord && activeItem ? renderDyeRequirementDialog(detailRecord, activeItem, params, month) : ''}
    ${detailRecord && activeItem ? renderAccessoryOrderDialog(detailRecord, activeItem, params, month) : ''}
    ${detailRecord && activeItem ? renderOperateItemDialog(detailRecord, activeItem, params, month) : ''}
    ${renderExternalMaterialsDialog(params, month)}
  `

  return renderStandardListPage({
    title: '生产准备时效',
    primaryActionsHtml: renderHeaderActions(params, month),
    filtersHtml: renderLedgerFilter(params, month),
    statsHtml: renderKpis(records, month, filter),
    listTitle: '准备台账',
    listActionsHtml: columnSettingsButton,
    tableHtml: `<div data-prep-list-kind="ledger" data-prep-list-region="table" data-skip-page-rerender="true">${renderLedgerStandardTable(paging)}</div>`,
    paginationHtml: `<div data-prep-list-region="pagination" data-skip-page-rerender="true">${renderLedgerStandardPagination(paging)}</div>`,
    overlaysHtml: `
      <div data-prep-list-region="column-settings" data-skip-page-rerender="true">${renderLedgerColumnSettings()}</div>
      <div data-prep-list-region="business-overlays">${businessOverlays}</div>
    `,
    className: 'min-w-0',
  })
}

function renderDetailDrawer(record: ProductionPreparationRecord, params: URLSearchParams, month: string): string {
  const activeItemId = valueOf(params, 'itemId')
  const closeHref = buildLedgerHrefFromParams(params, month)

  return `
    <aside class="fixed inset-y-0 right-0 z-40 flex w-full max-w-3xl flex-col border-l bg-background shadow-2xl">
      <div class="flex items-start justify-between border-b p-5">
        <div>
          <div class="text-xs text-muted-foreground">${escapeHtml(record.recordNo)}</div>
          <h2 class="mt-1 text-xl font-semibold">${escapeHtml(record.spuName)}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuCode)}｜${escapeHtml(record.productionOrderNo)}</p>
        </div>
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(closeHref)}">关闭</button>
      </div>
      <div class="flex-1 space-y-5 overflow-y-auto p-5">
        ${renderSourceInfo(record)}
        ${renderProductTypeConfirmation(record)}
        ${renderConfirmationRequirementSection(record)}
        ${renderPreparationSelection(record)}
        ${renderTimeline(record)}
        <section id="prep-items" class="rounded-xl border bg-card p-4">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="font-semibold">准备项明细卡片</h3>
            <span class="text-xs text-muted-foreground">已选择 ${requiredItems(record).length} 项</span>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            ${record.items.map((item) => renderItemCard(record, item, item.itemId === activeItemId)).join('')}
          </div>
        </section>
        ${renderPreparationOutputs(record)}
        ${renderOperationLogs(record)}
      </div>
    </aside>
  `
}

function renderBasicInfo(record: ProductionPreparationRecord): string {
  const fields = [
    ['买手', record.buyerName],
    ['跟单', record.merchandiserName],
    ['进入准备时间', formatDateTime(record.enteredAt)],
    ['销量达标/加入时间', formatDateTime(record.reachedThresholdAt)],
    ['正式技术包', record.techPackVersionLabel],
    ['预计完成时间', formatDateTime(record.expectedFinishAt)],
    ['整体状态', record.status],
    ['关闭原因', record.closedReason || '未关闭'],
  ]
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">基础信息</h3>
      <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        ${fields.map(([label, value]) => `
          <div class="rounded-lg bg-muted/40 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderSourceInfo(record: ProductionPreparationRecord): string {
  const fields = [
    ['选品', record.selectionName],
    ['买手', record.buyerName],
    ['跟单', record.merchandiserName],
    ['做大货阈值', `${record.largeGoodsThresholdQty} 件`],
    ['达到数量', `${record.largeGoodsReachedQty} 件`],
    ['达到做大货要求', formatDateTime(record.largeGoodsReachedAt)],
    ['达到天数', `${record.largeGoodsReachedDays} 天`],
    ['进入准备时间', formatDateTime(record.enteredAt)],
  ]
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">来源信息</h3>
      <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        ${fields.map(([label, value]) => `
          <div class="rounded-lg bg-muted/40 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderTagList(tags: string[]): string {
  return tags.length
    ? tags.map((tag) => `<span class="rounded-full bg-muted px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('')
    : '<span class="text-xs text-muted-foreground">无</span>'
}

function renderProductTypeConfirmation(record: ProductionPreparationRecord): string {
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">商品类型确认</h3>
        ${renderBadge(record.prepTypeSource, record.prepTypeSource === '人工修正' ? 'amber' : 'green')}
      </div>
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">工艺标签</div>
          <div class="mt-2 flex flex-wrap gap-1">${renderTagList(record.craftTags)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">品类标签</div>
          <div class="mt-2 flex flex-wrap gap-1">${renderTagList(record.categoryTags)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">系统建议类型</div>
          <div class="mt-1 font-medium">${escapeHtml(record.derivedProductPrepType)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">跟单确认类型</div>
          <div class="mt-1 font-medium">${escapeHtml(record.confirmedProductPrepType)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">确认人</div>
          <div class="mt-1 font-medium">${escapeHtml(record.prepTypeConfirmedBy)}</div>
        </div>
        <div class="rounded-lg bg-muted/40 p-3">
          <div class="text-xs text-muted-foreground">确认时间</div>
          <div class="mt-1 font-medium">${escapeHtml(formatDateTime(record.prepTypeConfirmedAt))}</div>
        </div>
      </div>
    </section>
  `
}

function renderConfirmationRequirementSection(record: ProductionPreparationRecord): string {
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="font-semibold">跟单确认要求</h3>
      <div class="mt-3">
        <p class="mb-2 text-xs text-muted-foreground">本次用料</p>
        ${renderMaterialRequirementTable(record)}
      </div>
      <div class="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div><p class="text-xs text-muted-foreground">做款/打板要求</p><p>${escapeHtml(record.sampleRequirementText || '-')}</p></div>
        <div><p class="text-xs text-muted-foreground">通用备注</p><p>${escapeHtml(record.confirmationRemark || '-')}</p></div>
      </div>
    </section>
  `
}

function renderPreparationSelection(record: ProductionPreparationRecord): string {
  const required = record.items.filter((item) => item.requiredKind === '必做')
  const optional = record.items.filter((item) => item.requiredKind === '选填')
  const renderSelectionItem = (item: ProductionPreparationItem) => `
    <div class="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
      <div>
        <div class="font-medium">${escapeHtml(item.itemType)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sequenceGroup)}｜${escapeHtml(item.parallelGroup)}</div>
        <div class="mt-1 text-xs text-muted-foreground">确认时间：${escapeHtml(item.selectedAt ? formatDateTime(item.selectedAt) : '未选择')}</div>
      </div>
      ${renderBadge(item.requiredKind === '必做' ? '必做' : item.selectedByMerchandiser ? '已选择' : '未选择', item.requiredKind === '必做' || item.selectedByMerchandiser ? 'green' : 'slate')}
    </div>
  `
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">准备项确认</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <div class="mb-2 text-sm font-medium">必做项</div>
          <div class="space-y-2">${required.map(renderSelectionItem).join('')}</div>
        </div>
        <div>
          <div class="mb-2 text-sm font-medium">选填项</div>
          <div class="space-y-2">${optional.map(renderSelectionItem).join('') || '<div class="rounded-lg border bg-background p-3 text-sm text-muted-foreground">无选填项</div>'}</div>
        </div>
      </div>
    </section>
  `
}

function renderTimeline(record: ProductionPreparationRecord): string {
  const items = [...record.items].sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt))
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">准备项时间线</h3>
      <div class="space-y-3">
        ${items.map((item) => `
          <div class="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
            <div class="text-xs text-muted-foreground">${escapeHtml(item.plannedStartAt ? formatDateTime(item.plannedStartAt) : '未排期')}</div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full ${hasCompletionEvidence(item) ? 'bg-green-500' : item.status === '已超时' || item.overdueHours > 0 || (item.status === '已完成' && !hasCompletionEvidence(item)) ? 'bg-red-500' : 'bg-blue-500'}" style="width:${hasCompletionEvidence(item) ? 100 : item.status === '无需' ? 0 : 56}%"></div>
            </div>
            <div class="flex min-w-[180px] items-center justify-between gap-2">
              <span>${escapeHtml(item.itemType)}</span>
              ${renderItemStatusBadge(item)}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function dependencyText(record: ProductionPreparationRecord, item: ProductionPreparationItem): string {
  if (!item.dependsOnItemIds.length) return '无前置准备项'
  return item.dependsOnItemIds
    .map((depId) => record.items.find((candidate) => candidate.itemId === depId)?.itemType)
    .filter(Boolean)
    .join('、') || '无前置准备项'
}

function renderItemCard(record: ProductionPreparationRecord, item: ProductionPreparationItem, active: boolean): string {
  const ownerRoleRule = preparationOwnerRoleRules.find((rule) => rule.ownerTeam === item.ownerTeam)
  return `
    <article class="rounded-xl border p-4 ${active ? 'border-blue-300 bg-blue-50/40' : 'bg-background'}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-medium">${escapeHtml(item.itemType)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.ownerTeam)}｜${escapeHtml(item.ownerName)}</div>
        </div>
        ${renderItemStatusBadge(item)}
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt class="text-muted-foreground">计划开始</dt><dd>${escapeHtml(item.plannedStartAt ? formatDateTime(item.plannedStartAt) : '-')}</dd></div>
        <div><dt class="text-muted-foreground">计划完成</dt><dd>${escapeHtml(item.plannedFinishAt ? formatDateTime(item.plannedFinishAt) : '-')}</dd></div>
        <div><dt class="text-muted-foreground">实际完成</dt><dd>${escapeHtml(item.actualFinishAt ? formatDateTime(item.actualFinishAt) : '-')}</dd></div>
        <div><dt class="text-muted-foreground">凭证类型</dt><dd>${escapeHtml(item.evidenceType || '-')}</dd></div>
      </dl>
      <div class="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        <span class="text-muted-foreground">前置准备项：</span>${escapeHtml(dependencyText(record, item))}
      </div>
      ${
        item.status === '已完成' && !hasCompletionEvidence(item)
          ? `<p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${item.itemType === '辅料下单' ? '异常：已完成但采购单号或逐单下单时间不完整，请补充登记。' : '异常：已完成但缺少上传文件、上传人或上传时间，请补传完成凭证。'}</p>`
          : ''
      }
      <p class="mt-3 text-xs text-muted-foreground">${escapeHtml(item.evidenceSummary || item.remark || '暂无说明')}</p>
      ${
        ownerRoleRule
          ? `<div class="mt-3 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div><span class="font-medium text-foreground">责任角色：</span>${escapeHtml(ownerRoleRule.roleLabels.join('、'))}</div>
              <div class="mt-1"><span class="font-medium text-foreground">操作范围：</span>${escapeHtml(ownerRoleRule.actionScope)}</div>
            </div>`
          : ''
      }
      ${item.itemType === '数码印/DTF/DTG花型' ? renderPatternFields(item) : ''}
      ${isDyeItem(item) || isDyeRequirementItem(item) ? renderDyeRequirementFields(item) : ''}
      ${item.itemType === '辅料下单' ? renderAccessoryPurchaseOrderFields(item) : `<div class="mt-3">${renderItemUploadHistory(item)}</div>`}
    </article>
  `
}

function renderAccessoryPurchaseOrderFields(item: ProductionPreparationItem): string {
  const orderNos = item.accessoryPurchaseOrderNos ?? []
  const orderedAts = item.accessoryPurchaseOrderedAts ?? []
  return `
    <div class="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
      <div class="text-sm font-medium">面辅料采购单号</div>
      ${
        orderNos.length
          ? `
            <div class="mt-2 space-y-1">
              ${orderNos.map((orderNo, index) => `<div class="flex items-center justify-between gap-3"><span>${escapeHtml(orderNo)}</span><span class="text-muted-foreground">${escapeHtml(formatDateTime(orderedAts[index]))}</span></div>`).join('')}
            </div>
            <div class="mt-2 text-muted-foreground">完成时间：${escapeHtml(formatDateTime(item.accessoryPurchaseUpdatedAt ?? item.actualFinishAt))}</div>
          `
          : '<div class="mt-2 text-muted-foreground">暂未登记</div>'
      }
    </div>
  `
}

function renderPatternFields(item: ProductionPreparationItem): string {
  return `
    <div class="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-muted-foreground">花型任务：</span>${escapeHtml(item.patternTaskNo || '未生成')}</div>
        <div><span class="text-muted-foreground">花型团队：</span>${escapeHtml(item.patternTeamName || '-')}</div>
        <div><span class="text-muted-foreground">花型师：</span>${escapeHtml(item.patternDesignerName || '待分配')}</div>
        <div><span class="text-muted-foreground">买手确认：</span>${escapeHtml(item.buyerReviewStatus || '未提交')}</div>
        <div><span class="text-muted-foreground">完成图：</span>${item.completionImageIds?.length ?? 0} 张</div>
        <div><span class="text-muted-foreground">花型文件：</span>${item.patternFileIds?.length ?? 0} 个</div>
      </div>
    </div>
  `
}

function renderDyeRequirementFields(item: ProductionPreparationItem): string {
  const requirement = item.dyeRequirement
  return `
    <div class="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
      <div class="text-sm font-medium">染色要求</div>
      ${
        requirement
          ? `
            <div class="mt-2 grid grid-cols-2 gap-2">
              <div><span class="text-muted-foreground">潘通色号：</span>${escapeHtml(requirement.pantoneCode || '-')}</div>
              <div><span class="text-muted-foreground">色样/色卡说明：</span>${escapeHtml(requirement.colorName || '-')}</div>
              <div class="col-span-2"><span class="text-muted-foreground">染色要求：</span>${escapeHtml(requirement.remark || '-')}</div>
              <div><span class="text-muted-foreground">维护人：</span>${escapeHtml(requirement.maintainedBy || '-')}</div>
              <div><span class="text-muted-foreground">维护时间：</span>${escapeHtml(requirement.maintainedAt ? formatDateTime(requirement.maintainedAt) : '-')}</div>
            </div>
          `
          : '<div class="mt-2 text-muted-foreground">跟单未维护</div>'
      }
    </div>
  `
}

function renderItemUploadHistory(item: ProductionPreparationItem): string {
  const uploads = item.uploads ?? []
  const downloads = item.downloads ?? []
  const missingCompletionEvidence = item.status === '已完成' && !hasCompletionEvidence(item)
  return `
    <div class="rounded-lg border bg-muted/30 p-3">
      <div class="text-sm font-medium">上传记录</div>
      <div class="mt-2 space-y-2">
        ${
          uploads.length
            ? uploads.map((upload) => `
              <div class="rounded-md bg-background p-2 text-xs">
                <div class="font-medium">${escapeHtml(upload.fileName)}</div>
                <div class="mt-1 text-muted-foreground">${escapeHtml(upload.uploadedBy)}｜${escapeHtml(formatDateTime(upload.uploadedAt))}｜${Math.ceil(upload.fileSize / 1024)}KB</div>
                ${upload.note ? `<div class="mt-1 text-muted-foreground">${escapeHtml(upload.note)}</div>` : ''}
                <button type="button" class="mt-2 text-blue-600 hover:underline" data-prep-action="download-upload" data-upload-id="${escapeHtml(upload.uploadId)}" data-item-id="${escapeHtml(item.itemId)}">下载</button>
              </div>
            `).join('')
            : missingCompletionEvidence
              ? '<div class="text-xs text-red-600">异常：已完成但没有可用上传记录</div>'
              : '<div class="text-xs text-muted-foreground">暂无上传记录</div>'
        }
      </div>
      ${
        isBasePatternItem(item.itemType)
          ? `
            <div class="mt-3 text-sm font-medium">下载记录</div>
            <div class="mt-2 space-y-1 text-xs text-muted-foreground" data-prep-download-history>
              ${
                downloads.length
                  ? downloads.map((download) => `<div data-prep-download-record>${escapeHtml(download.fileName)}｜${escapeHtml(download.downloadedBy)}｜${escapeHtml(formatDateTime(download.downloadedAt))}</div>`).join('')
                  : '<div>暂无下载记录</div>'
              }
            </div>
          `
          : ''
      }
    </div>
  `
}

const PRODUCT_PREP_TYPES = Object.keys(preparationTypeDefaultItems) as ProductPrepType[]

function isDefaultTypeItemChecked(
  record: ProductionPreparationRecord,
  blockType: ProductPrepType,
  itemType: PreparationItemType,
  defaultSelected: boolean,
): boolean {
  if (blockType !== record.confirmedProductPrepType) return defaultSelected
  const item = record.items.find((candidate) => candidate.itemType === itemType)
  return item?.selectedByMerchandiser ?? defaultSelected
}

function renderPreparationTypeItem(
  record: ProductionPreparationRecord,
  blockType: ProductPrepType,
  templateItem: { itemType: PreparationItemType; defaultSelected: boolean; canUnselect: boolean },
  active: boolean,
): string {
  const item = record.items.find((candidate) => candidate.itemType === templateItem.itemType)
  const locked = !templateItem.canUnselect
  const checked = locked || isDefaultTypeItemChecked(record, blockType, templateItem.itemType, templateItem.defaultSelected)
  const disabledAttr = active ? '' : 'disabled'
  const checkedAttr = checked ? 'checked' : ''
  const input = locked
    ? `
      <input type="hidden" name="selectedItemType" value="${escapeHtml(templateItem.itemType)}" ${disabledAttr} />
      <input type="checkbox" value="${escapeHtml(templateItem.itemType)}" data-prep-fixed-item ${checkedAttr} ${disabledAttr} />
    `
    : `<input type="checkbox" name="selectedItemType" value="${escapeHtml(templateItem.itemType)}" data-prep-item-checkbox ${checkedAttr} ${disabledAttr} />`
  const tagText = locked ? '默认必选' : templateItem.defaultSelected ? '默认勾选，可取消' : '可选'
  const detailText = item
    ? `${item.requiredKind}｜${item.sequenceGroup}`
    : '类型模板项，当前记录暂无历史节点'
  return `
    <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
      ${input}
      <span>
        <span class="font-medium">${escapeHtml(templateItem.itemType)}</span>
        <span class="mt-1 block text-xs text-muted-foreground">${escapeHtml(tagText)}｜${escapeHtml(detailText)}</span>
      </span>
    </label>
  `
}

function renderConfirmItemsDialog(record: ProductionPreparationRecord, params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'confirm-items') return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 flex max-h-[calc(100vh-80px)] w-[820px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
        <div class="border-b p-5">
          <h3 class="text-lg font-semibold">确认生产准备工作项</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuName)}｜${escapeHtml(record.spuCode)}</p>
        </div>
        <form class="flex min-h-0 flex-1 flex-col" data-prep-confirm-items-form>
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
            <input type="hidden" name="overrideReason" value="${escapeHtml(record.prepTypeOverrideReason || record.confirmationRemark)}" />
            <section class="rounded-lg border p-4">
              <div class="text-sm font-semibold">1. 确认商品类型</div>
              <div class="mt-3 grid gap-2 md:grid-cols-2">
                ${PRODUCT_PREP_TYPES.map((type) => `
                  <label class="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <input type="radio" name="confirmedProductPrepType" data-prep-type-radio value="${escapeHtml(type)}" ${type === record.confirmedProductPrepType ? 'checked' : ''} />
                    <span>${escapeHtml(type)}</span>
                  </label>
                `).join('')}
              </div>
            </section>
            <section class="rounded-lg border p-4">
              <div class="text-sm font-semibold">2. 确认准备项</div>
              <div class="mt-3 space-y-3">
                ${PRODUCT_PREP_TYPES.map((type) => {
                  const active = type === record.confirmedProductPrepType
                  return `
                    <div data-prep-type-block="${escapeHtml(type)}" ${active ? '' : 'hidden'}>
                      <div class="grid gap-3 md:grid-cols-2">
                        ${preparationTypeDefaultItems[type].map((item) => renderPreparationTypeItem(record, type, item, active)).join('')}
                      </div>
                    </div>
                  `
                }).join('')}
              </div>
            </section>
            <section class="rounded-lg border p-4">
              <div class="text-sm font-semibold">3. 维护物料和做款要求</div>
              <div class="mt-3">
                ${renderConfirmMaterialRows(record)}
              </div>
              <label class="mt-3 block text-sm">
                <span class="text-muted-foreground">做款/打板要求</span>
                <textarea name="sampleRequirementText" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2" required>${escapeHtml(record.sampleRequirementText)}</textarea>
              </label>
            </section>
            <label class="block text-sm">
              <span class="text-muted-foreground">通用备注</span>
              <textarea name="confirmationRemark" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2">${escapeHtml(record.confirmationRemark)}</textarea>
            </label>
          </div>
          <div class="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">确认工作项</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderDyeRequirementDialog(
  record: ProductionPreparationRecord,
  item: ProductionPreparationItem,
  params: URLSearchParams,
  month: string,
): string {
  if (valueOf(params, 'action') !== 'operate-item' || !isDyeRequirementItem(item) || !isSelectedPreparationItem(item)) return ''
  if (!hasConfirmedWorkItems(record) || item.status === '已完成' || !canOperateItem(item, record)) return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  const requirement = item.dyeRequirement
  const materialNo = requirement?.materialNo || record.materialRequirement.materialNo
  const materialName = requirement?.materialName || record.materialRequirement.materialName
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[720px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">确认染色要求</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.spuName)}｜${escapeHtml(item.itemType)}</p>
        <form class="mt-4 space-y-4" data-prep-dye-requirement-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          <input type="hidden" name="materialNo" value="${escapeHtml(materialNo)}" />
          <input type="hidden" name="materialName" value="${escapeHtml(materialName)}" />
          <div class="grid gap-3 md:grid-cols-2">
            <label class="block text-sm">
              <span class="text-muted-foreground">潘通色号</span>
              <input name="pantoneCode" value="${escapeHtml(requirement?.pantoneCode ?? '')}" class="mt-1 w-full rounded-md border px-3 py-2" required />
            </label>
            <label class="block text-sm">
              <span class="text-muted-foreground">色样/色卡说明</span>
              <input name="colorSampleName" value="${escapeHtml(requirement?.colorName ?? '')}" class="mt-1 w-full rounded-md border px-3 py-2" required />
            </label>
          </div>
          <label class="block text-sm">
            <span class="text-muted-foreground">染色要求说明</span>
            <textarea name="requirementText" class="mt-1 min-h-24 w-full rounded-md border px-3 py-2" required>${escapeHtml(requirement?.remark ?? '')}</textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">确认染色要求</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderOperateItemDialog(
  record: ProductionPreparationRecord,
  item: ProductionPreparationItem,
  params: URLSearchParams,
  month: string,
): string {
  if (valueOf(params, 'action') !== 'operate-item') return ''
  if (isDyeRequirementItem(item)) return ''
  if (item.itemType === '辅料下单') return ''
  if (!hasConfirmedWorkItems(record) || !isSelectedPreparationItem(item) || !canOperateItem(item, record)) return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[760px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">${escapeHtml(item.itemType)}</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.spuName)}</p>
        <form class="mt-4 space-y-4" data-prep-operate-item-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          <label class="block text-sm">
            <span class="text-muted-foreground">上传文件</span>
            <input type="file" name="files" class="mt-1 w-full rounded-md border px-3 py-2" multiple required />
          </label>
          <label class="block text-sm">
            <span class="text-muted-foreground">样衣制作人</span>
            <input name="sampleMaker" class="mt-1 h-10 w-full rounded-md border px-3" placeholder="填写样衣制作人" />
          </label>
          <label class="block text-sm">
            <span class="text-muted-foreground">说明</span>
            <textarea name="note" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2"></textarea>
          </label>
          ${renderItemUploadHistory(item)}
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">提交</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderAccessoryOrderDialog(
  record: ProductionPreparationRecord,
  item: ProductionPreparationItem,
  params: URLSearchParams,
  month: string,
): string {
  if (valueOf(params, 'action') !== 'operate-item') return ''
  if (item.itemType !== '辅料下单') return ''
  if (!hasConfirmedWorkItems(record) || !isSelectedPreparationItem(item) || !canOperateItem(item, record)) return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  const orderNos = item.accessoryPurchaseOrderNos?.length ? item.accessoryPurchaseOrderNos : ['']
  const orderedAts = item.accessoryPurchaseOrderedAts ?? []
  const completionAt = item.accessoryPurchaseUpdatedAt ?? item.actualFinishAt
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">登记辅料下单</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.spuName)}</p>
        <form class="mt-4 space-y-4" data-prep-accessory-order-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium">面辅料采购单号</span>
              <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-prep-action="add-accessory-order-row">新增单号</button>
            </div>
            <div class="space-y-2" data-prep-accessory-order-rows>
              ${orderNos.map((orderNo, index) => `
                <div class="grid gap-2 md:grid-cols-[1fr_210px]" data-prep-accessory-order-row>
                  <input name="accessoryPurchaseOrderNo" value="${escapeHtml(orderNo)}" class="w-full rounded-md border px-3 py-2 text-sm" required placeholder="填写面辅料采购单号" />
                  <input type="datetime-local" name="accessoryPurchaseOrderedAt" value="${escapeHtml(orderedAts[index] ?? (orderNo ? '' : currentIsoMinute()))}" class="w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
              `).join('')}
            </div>
            <p class="mt-2 text-xs text-muted-foreground">可填写多个面辅料采购单号；每次提交都会覆盖当前列表，并以最晚下单时间作为完成时间。</p>
          </div>
          <div class="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            当前完成时间：${escapeHtml(formatDateTime(completionAt))}
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">保存</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderPreparationOutputs(record: ProductionPreparationRecord): string {
  const outputReady = isPreparationOutputReady(record)
  const missingItems = requiredItems(record).filter((item) => !hasCompletionEvidence(item))
  const generatedAt = outputGeneratedAt(record)
  const emptyText = hasConfirmedWorkItems(record) ? '待全部准备项完成后生成' : '待跟单确认'
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">产出</h3>
        ${renderBadge(outputReady ? '已生成' : '待生成', outputReady ? 'green' : 'amber')}
      </div>
      ${!outputReady && missingItems.length ? `<p class="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">仍需完成：${escapeHtml(missingItems.map((item) => item.itemType).join('、'))}</p>` : ''}
      ${
        record.outputs.length
          ? `
            <div class="overflow-hidden rounded-lg border">
              <table class="w-full text-sm">
                <thead class="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">产出对象名称</th>
                    <th class="px-3 py-2 text-left">产出对象编号</th>
                    <th class="px-3 py-2 text-left">状态</th>
                    <th class="px-3 py-2 text-left">产出时间</th>
                  </tr>
                </thead>
                <tbody>
                  ${record.outputs.map((output) => `
                    <tr class="border-t">
                      <td class="px-3 py-2">${escapeHtml(output.outputType)}</td>
                      <td class="px-3 py-2">
                        <button type="button" class="text-blue-600 hover:underline" data-nav="${escapeHtml(output.outputHref)}">${escapeHtml(output.outputNo)}</button>
                      </td>
                      <td class="px-3 py-2">${renderBadge(output.outputStatus, output.outputStatus === '已生成' ? 'green' : 'amber')}</td>
                      <td class="px-3 py-2">${escapeHtml(formatDateTime(output.outputGeneratedAt || generatedAt))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
          : `<div class="rounded-lg border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
      }
    </section>
  `
}

function renderOperationLogs(record: ProductionPreparationRecord): string {
  const logs = [
    [`${formatDateTime(record.enteredAt)}`, `${record.merchandiserName} 创建生产准备记录`],
    ...record.items
      .filter((item) => item.assignedAt)
      .map((item) => [formatDateTime(item.assignedAt ?? ''), `${item.itemType} 分配给 ${item.ownerName}`]),
    ...record.items
      .filter((item) => item.actualFinishAt)
      .map((item) => [formatDateTime(item.actualFinishAt), `${item.itemType} 已完成：${item.evidenceSummary || item.evidenceType}`]),
  ].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8)

  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">操作记录</h3>
      <div class="space-y-3">
        ${logs.map(([time, text]) => `
          <div class="flex gap-3 text-sm">
            <div class="w-32 shrink-0 text-xs text-muted-foreground">${escapeHtml(time)}</div>
            <div>${escapeHtml(text)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderStatsFilter(params: URLSearchParams, month: string, activeTab: 'monthly' | 'detail'): string {
  const options = getProductionPreparationFilterOptions()
  const dependencyOptions = getDependencyOptions(params)
  return `
    <section data-prep-stats-filter-scope class="rounded-xl border bg-card p-3">
      <input type="hidden" name="tab" value="${escapeHtml(activeTab)}" />
      <div class="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
        <label class="flex min-w-[150px] flex-col gap-1 text-sm">
          <span class="text-muted-foreground">月份</span>
          <input type="month" name="month" value="${escapeHtml(month)}" class="h-9 rounded-md border bg-background px-2" />
        </label>
        ${renderPreparationMultiSelect({ label: '跟单', field: 'merchandiserName', selectedValues: valuesOf(params, 'merchandiserName'), options: options.merchandiserNames })}
        ${renderPreparationMultiSelect({ label: '记录状态', field: 'recordStatus', selectedValues: valuesOf(params, 'recordStatus').filter((value) => value !== '全部'), options: options.recordStatuses.filter((value) => value !== '全部') })}
        ${renderPreparationMultiSelect({ label: '准备项', field: 'itemType', selectedValues: dependencyOptions.selectedItemTypes, options: preparationItemTypes, visibleOptions: dependencyOptions.visibleItemTypes })}
        ${renderPreparationMultiSelect({ label: '责任团队', field: 'ownerTeam', selectedValues: dependencyOptions.selectedOwnerTeams, options: options.ownerTeams, visibleOptions: dependencyOptions.visibleOwnerTeams })}
        <label class="flex min-w-[240px] flex-col gap-1 text-sm">
          <span class="text-muted-foreground">关键词</span>
          <input name="keyword" value="${escapeHtml(valueOf(params, 'keyword'))}" placeholder="商品 / 生产单 / 准备项 / 跟单" class="h-9 rounded-md border bg-background px-3" />
        </label>
        <button type="button" class="inline-flex h-9 shrink-0 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-nav-from-fields="[data-prep-stats-filter-scope]" data-nav-base="${STATS_PAGE_PATH}">筛选</button>
        <button type="button" class="inline-flex h-9 shrink-0 items-center rounded-md border px-4 text-sm hover:bg-muted" data-nav="${STATS_PAGE_PATH}?tab=${escapeHtml(activeTab)}&month=${escapeHtml(DEFAULT_MONTH)}">重置</button>
      </div>
    </section>
  `
}

function getStatsDetails(month: string, filter: ProductionPreparationFilter): MonthlyPreparationCompletionDetail[] {
  return buildMonthlyPreparationCompletionDetails(month, filter)
}

function buildStatsRows(month: string, details: MonthlyPreparationCompletionDetail[]): StatsTableRow[] {
  return preparationItemTypes.map((itemType) => {
    const rows = details.filter((detail) => detail.itemType === itemType)
    const durationTotal = rows.reduce((sum, row) => sum + row.durationHours, 0)
    const ownerTeamText = Array.from(new Set(rows.map((row) => row.ownerTeam).filter(Boolean))).join('、') || '-'
    return {
      itemType,
      completedCount: rows.length,
      onTimeCompletedCount: rows.filter((row) => row.onTime).length,
      overdueCompletedCount: rows.filter((row) => !row.onTime).length,
      averageDurationHours: rows.length ? Number((durationTotal / rows.length).toFixed(1)) : 0,
      latestFinishedAt: rows.reduce((latest, row) => (row.actualFinishAt > latest ? row.actualFinishAt : latest), ''),
      ownerTeamText,
      basisText: `${month} 实际完成，已关闭记录、无需项和未选择选填项不计入`,
    }
  })
}

function getGroupedCompletedCount(stats: StatsTableRow[], itemTypes: PreparationItemType[]): number {
  return itemTypes.reduce((sum, itemType) => sum + (stats.find((row) => row.itemType === itemType)?.completedCount ?? 0), 0)
}

function renderStatsSummary(details: MonthlyPreparationCompletionDetail[], stats: StatsTableRow[]): string {
  const onTime = details.filter((detail) => detail.onTime).length
  const overdue = details.length - onTime
  const averageHours = details.length
    ? Number((details.reduce((sum, detail) => sum + detail.durationHours, 0) / details.length).toFixed(1))
    : 0
  const cards = [
    ['本月完成准备项', details.length, '项'],
    ['完成基码', getGroupedCompletedCount(stats, ['梭织基码纸样', '毛织基码纸样']), '项'],
    ['完成齐码', getGroupedCompletedCount(stats, ['梭织齐码纸样', '毛织齐码纸样']), '项'],
    ['完成花型', getGroupedCompletedCount(stats, ['数码印/DTF/DTG花型']), '项'],
    ['完成染色', getGroupedCompletedCount(stats, ['染色调色（纱线）', '染色调色（面料）']), '项'],
    ['按时完成', onTime, '项'],
    ['超时完成', overdue, '项'],
    ['平均耗时', averageHours, '小时'],
  ]

  return `
    <section class="grid grid-cols-1 gap-2 md:grid-cols-4 2xl:grid-cols-8">
      ${cards.map(([label, value, unit]) => `
        <div class="rounded-lg border bg-card px-3 py-2">
          <div class="flex min-w-0 items-center justify-between gap-2 text-sm">
            <span class="truncate text-muted-foreground">${escapeHtml(label)}</span>
            <span class="shrink-0 font-semibold">${escapeHtml(value)}<span class="ml-0.5 text-xs font-normal text-muted-foreground">${escapeHtml(unit)}</span></span>
          </div>
        </div>
      `).join('')}
    </section>
  `
}

function statsState(kind: StatsListKind): StatsListState {
  return kind === 'monthly' ? monthlyStatsListState : detailStatsListState
}

function statsRules(kind: StatsListKind): StandardListColumnRule[] {
  return kind === 'monthly' ? monthlyColumnRules : detailColumnRules
}

function statsDefaults(kind: StatsListKind): StandardListColumnPreferences {
  return kind === 'monthly' ? defaultMonthlyPreferences : defaultDetailPreferences
}

function statsStorageKey(kind: StatsListKind): string {
  return kind === 'monthly' ? monthlyStorageKey : detailStorageKey
}

function statsEventPrefix(kind: StatsListKind): string {
  return `production-preparation-stats-${kind}`
}

function ensureStatsPreferences(kind: StatsListKind): void {
  const state = statsState(kind)
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const storage = getLedgerStorage()
  state.columnPreferences = storage
    ? loadListColumnPreferences(storage, statsStorageKey(kind), statsRules(kind), statsDefaults(kind), statsPageSizes)
    : normalizeListColumnPreferences(statsRules(kind), statsDefaults(kind), statsPageSizes)
}

function saveStatsPreferences(kind: StatsListKind): void {
  const storage = getLedgerStorage()
  if (storage) saveListColumnPreferences(storage, statsStorageKey(kind), statsState(kind).columnPreferences)
}

function getStatsFilterSignature(params: URLSearchParams, month: string): string {
  const signature = new URLSearchParams()
  signature.set('month', month)
  for (const key of STATS_FILTER_KEYS) {
    for (const value of valuesOf(params, key)) signature.append(key, value)
  }
  return signature.toString()
}

function syncStatsListContext(kind: StatsListKind, params: URLSearchParams, month: string): void {
  const state = statsState(kind)
  const nextSignature = getStatsFilterSignature(params, month)
  if (activeStatsListKind !== kind || (state.filterSignature && state.filterSignature !== nextSignature)) {
    state.page = 1
    state.sort = null
    state.columnSettingsOpen = false
    state.draggedColumnKey = ''
  }
  state.filterSignature = nextSignature
  activeStatsListKind = kind
}

function buildMonthlyDetailHref(params: URLSearchParams, month: string): string {
  return buildStatsHref({ tab: 'detail', month, detailPage: 1, monthlyPage: null }, params)
}

function createMonthlyStatsColumns(month: string, params: URLSearchParams): StandardListColumn<StatsTableRow>[] {
  const detailHref = buildMonthlyDetailHref(params, month)
  return [
    {
      key: 'month', title: '统计月份', width: 120, required: true, freezeable: true, sortable: true,
      sortValue: () => month,
      render: () => `<button type="button" data-nav="${escapeHtml(detailHref)}" class="font-medium text-blue-600 hover:underline">${escapeHtml(month)}</button>`,
    },
    { key: 'itemType', title: '准备项', width: 220, required: true, freezeable: true, sortable: true, sortValue: (row) => row.itemType, render: (row) => escapeHtml(row.itemType) },
    { key: 'completedCount', title: '完成数量', width: 120, sortable: true, sortValue: (row) => row.completedCount, render: (row) => String(row.completedCount) },
    { key: 'onTimeCompletedCount', title: '按时完成数量', width: 140, sortable: true, sortValue: (row) => row.onTimeCompletedCount, render: (row) => String(row.onTimeCompletedCount) },
    { key: 'overdueCompletedCount', title: '超时完成数量', width: 140, sortable: true, sortValue: (row) => row.overdueCompletedCount, render: (row) => String(row.overdueCompletedCount) },
    { key: 'averageDurationHours', title: '平均耗时小时', width: 140, sortable: true, sortValue: (row) => row.averageDurationHours, render: (row) => String(row.averageDurationHours) },
    { key: 'ownerTeamText', title: '责任团队', width: 160, freezeable: true, sortable: true, sortValue: (row) => row.ownerTeamText, render: (row) => escapeHtml(row.ownerTeamText) },
    { key: 'latestFinishedAt', title: '最近完成时间', width: 180, sortable: true, sortValue: (row) => row.latestFinishedAt, render: (row) => escapeHtml(row.latestFinishedAt ? formatDateTime(row.latestFinishedAt) : '-') },
    { key: 'basisText', title: '口径说明', width: 360, render: (row) => `<span class="text-xs text-muted-foreground">${escapeHtml(row.basisText)}</span>` },
  ]
}

function createDetailStatsColumns(month: string): StandardListColumn<MonthlyPreparationCompletionDetail>[] {
  return [
    { key: 'month', title: '统计月份', width: 120, freezeable: true, sortable: true, sortValue: () => month, render: () => escapeHtml(month) },
    { key: 'recordNo', title: '准备记录编号', width: 170, required: true, freezeable: true, sortable: true, sortValue: (row) => row.recordNo, render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.recordNo)}</span>` },
    { key: 'spuCode', title: 'SPU', width: 160, required: true, freezeable: true, sortable: true, sortValue: (row) => row.spuCode, render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.spuCode)}</span>` },
    { key: 'spuName', title: '商品名', width: 200, sortable: true, sortValue: (row) => row.spuName, render: (row) => `<span class="font-medium">${escapeHtml(row.spuName)}</span>` },
    { key: 'productionOrderNo', title: '生产单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: (row) => row.productionOrderNo, render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.productionOrderNo)}</span>` },
    { key: 'confirmedProductPrepType', title: '商品类型', width: 180, sortable: true, sortValue: (row) => row.confirmedProductPrepType, render: (row) => escapeHtml(row.confirmedProductPrepType) },
    { key: 'buyerName', title: '买手', width: 110, sortable: true, sortValue: (row) => row.buyerName, render: (row) => escapeHtml(row.buyerName) },
    { key: 'merchandiserName', title: '跟单', width: 110, sortable: true, sortValue: (row) => row.merchandiserName, render: (row) => escapeHtml(row.merchandiserName) },
    { key: 'itemType', title: '准备项', width: 220, required: true, freezeable: true, sortable: true, sortValue: (row) => row.itemType, render: (row) => escapeHtml(row.itemType) },
    { key: 'requiredKind', title: '必做/选填', width: 120, sortable: true, sortValue: (row) => row.requiredKind, render: (row) => escapeHtml(row.requiredKind) },
    { key: 'ownerTeam', title: '责任团队', width: 140, freezeable: true, sortable: true, sortValue: (row) => row.ownerTeam, render: (row) => escapeHtml(row.ownerTeam) },
    { key: 'ownerName', title: '责任人', width: 120, sortable: true, sortValue: (row) => row.ownerName, render: (row) => escapeHtml(row.ownerName) },
    { key: 'plannedFinishAt', title: '计划完成时间', width: 180, sortable: true, sortValue: (row) => row.plannedFinishAt, render: (row) => escapeHtml(formatDateTime(row.plannedFinishAt)) },
    { key: 'actualFinishAt', title: '实际完成时间', width: 180, required: true, freezeable: true, sortable: true, sortValue: (row) => row.actualFinishAt, render: (row) => escapeHtml(formatDateTime(row.actualFinishAt)) },
    { key: 'onTime', title: '是否超时', width: 110, sortable: true, sortValue: (row) => row.onTime ? 0 : 1, render: (row) => renderBadge(row.onTime ? '否' : '是', row.onTime ? 'green' : 'red') },
    { key: 'evidenceSummary', title: '证据摘要', width: 280, sortable: true, sortValue: (row) => row.evidenceSummary, render: (row) => `<span class="text-xs text-muted-foreground">${escapeHtml(row.evidenceSummary || '-')}</span>` },
  ]
}

function getMonthlyStatsView(rows: StatsTableRow[], month: string, params: URLSearchParams): StandardListPageSlice<StatsTableRow> {
  const columns = createMonthlyStatsColumns(month, params)
  const state = monthlyStatsListState
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find((column) => column.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.page, state.columnPreferences.pageSize)
  state.page = paging.currentPage
  return paging
}

function getDetailStatsView(rows: MonthlyPreparationCompletionDetail[], month: string): StandardListPageSlice<MonthlyPreparationCompletionDetail> {
  const columns = createDetailStatsColumns(month)
  const state = detailStatsListState
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find((column) => column.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.page, state.columnPreferences.pageSize)
  state.page = paging.currentPage
  return paging
}

function renderStatsStandardTable(kind: StatsListKind, month: string, params: URLSearchParams, details: MonthlyPreparationCompletionDetail[], stats: StatsTableRow[]): string {
  if (kind === 'monthly') {
    const paging = getMonthlyStatsView(stats, month, params)
    return renderStandardListTable({ columns: createMonthlyStatsColumns(month, params), rows: paging.rows, preferences: monthlyStatsListState.columnPreferences, sort: monthlyStatsListState.sort, eventPrefix: statsEventPrefix(kind), emptyText: '当前筛选条件下暂无月度统计' })
  }
  const paging = getDetailStatsView(details, month)
  return renderStandardListTable({ columns: createDetailStatsColumns(month), rows: paging.rows, preferences: detailStatsListState.columnPreferences, sort: detailStatsListState.sort, eventPrefix: statsEventPrefix(kind), emptyText: '当前月份暂无完成明细' })
}

function renderStatsStandardPagination(kind: StatsListKind, month: string, params: URLSearchParams, details: MonthlyPreparationCompletionDetail[], stats: StatsTableRow[]): string {
  const paging = kind === 'monthly' ? getMonthlyStatsView(stats, month, params) : getDetailStatsView(details, month)
  return renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: statsEventPrefix(kind), fieldPrefix: statsEventPrefix(kind), pageSizeOptions: statsPageSizes })
}

function renderStatsColumnSettings(kind: StatsListKind, month: string, params: URLSearchParams): string {
  const state = statsState(kind)
  if (!state.columnSettingsOpen) return ''
  const columns = kind === 'monthly' ? createMonthlyStatsColumns(month, params) : createDetailStatsColumns(month)
  return renderStandardListColumnSettings({ title: kind === 'monthly' ? '月度统计列设置' : '明细统计列设置', columns, preferences: state.columnPreferences, eventPrefix: statsEventPrefix(kind), maxFrozenWidth: statsMaxFrozenWidth })
}

function buildStatsCsvRows(month: string, rows: StatsTableRow[]): string[][] {
  const baseCodeCount = getGroupedCompletedCount(rows, ['梭织基码纸样', '毛织基码纸样'])
  const fullSizeCount = getGroupedCompletedCount(rows, ['梭织齐码纸样', '毛织齐码纸样'])
  const patternCount = getGroupedCompletedCount(rows, ['数码印/DTF/DTG花型'])
  const dyeCount = getGroupedCompletedCount(rows, ['染色调色（纱线）', '染色调色（面料）'])
  return [
    ['统计月份', '准备项', '完成数量', '按时完成数量', '超时完成数量', '平均耗时小时', '责任团队', '最近完成时间', '口径说明', '完成基码', '完成齐码', '完成花型', '完成染色'],
    ...rows.map((row) => [
      month,
      row.itemType,
      String(row.completedCount),
      String(row.onTimeCompletedCount),
      String(row.overdueCompletedCount),
      String(row.averageDurationHours),
      row.ownerTeamText,
      row.latestFinishedAt,
      row.basisText,
      String(baseCodeCount),
      String(fullSizeCount),
      String(patternCount),
      String(dyeCount),
    ]),
  ]
}

function buildDetailCsvRows(month: string, rows: MonthlyPreparationCompletionDetail[]): string[][] {
  return [
    ['统计月份', '准备记录编号', 'SPU', '商品名', '生产单号', '商品类型', '买手', '跟单', '准备项', '必做/选填', '责任团队', '责任人', '计划完成时间', '实际完成时间', '是否超时', '证据摘要'],
    ...rows.map((row) => [
      month,
      row.recordNo,
      row.spuCode,
      row.spuName,
      row.productionOrderNo,
      row.confirmedProductPrepType,
      row.buyerName,
      row.merchandiserName,
      row.itemType,
      row.requiredKind,
      row.ownerTeam,
      row.ownerName,
      row.plannedFinishAt,
      row.actualFinishAt,
      row.onTime ? '否' : '是',
      row.evidenceSummary,
    ]),
  ]
}

function getStatsViewData(params: URLSearchParams, month: string): {
  details: MonthlyPreparationCompletionDetail[]
  stats: StatsTableRow[]
} {
  const filter = parseFilter(params)
  delete filter.startDate
  delete filter.endDate
  delete filter.itemProgresses
  const details = getStatsDetails(month, filter)
  const stats = buildStatsRows(month, details)
  return { details, stats }
}

function renderStatsBasisNotice(): string {
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      顶部口径说明：统计完成数量时，以准备项实际完成时间所在月份为准；已关闭记录、无需项、未选择选填项不计入完成数量。
    </section>
  `
}

function renderStatsListActions(kind: StatsListKind, month: string, details: MonthlyPreparationCompletionDetail[], stats: StatsTableRow[]): string {
  const monthKey = month.replace('-', '')
  const exportLink = kind === 'monthly'
    ? `<a class="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm hover:bg-muted" href="${escapeHtml(buildProductionPreparationCsvDataUri(buildStatsCsvRows(month, stats)))}" download="${escapeHtml(`生产准备时效月度统计-${monthKey}.csv`)}">导出月度统计</a>`
    : `<a class="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm hover:bg-muted" href="${escapeHtml(buildProductionPreparationCsvDataUri(buildDetailCsvRows(month, details)))}" download="${escapeHtml(`生产准备时效完成明细-${monthKey}.csv`)}">导出完成明细</a>`
  return `
    <div class="flex flex-wrap items-center gap-2" data-skip-page-rerender="true">
      ${exportLink}
      ${renderSecondaryButton('列设置', { prefix: statsEventPrefix(kind), action: 'open-column-settings' }, 'columns-3')}
    </div>
  `
}

export function renderProductionPreparationTimingPage(pathname?: string): string {
  const currentPathname = pathname || appStore.getState().pathname || PAGE_PATH
  const url = new URL(currentPathname, 'http://higoods.local')
  const params = url.searchParams
  const month = valueOf(params, 'month') || DEFAULT_MONTH

  return renderLedgerTab(params, month)
}

export function renderProductionPreparationTimingStatisticsPage(pathname?: string): string {
  const currentPathname = pathname || appStore.getState().pathname || STATS_PAGE_PATH
  const url = new URL(currentPathname, 'http://higoods.local')
  const params = url.searchParams
  const activeTab = params.get('tab') === 'detail' ? 'detail' : 'monthly'
  const month = valueOf(params, 'month') || DEFAULT_MONTH
  ensureStatsPreferences(activeTab)
  syncStatsListContext(activeTab, params, month)
  const { details, stats } = getStatsViewData(params, month)

  return renderStandardListPage({
    title: '生产准备时效统计',
    primaryActionsHtml: renderStatsHeader(activeTab, month, params),
    feedbackHtml: renderStatsBasisNotice(),
    filtersHtml: renderStatsFilter(params, month, activeTab),
    statsHtml: activeTab === 'monthly' ? renderStatsSummary(details, stats) : '',
    listTitle: activeTab === 'monthly' ? '统计表' : '明细表',
    listActionsHtml: renderStatsListActions(activeTab, month, details, stats),
    tableHtml: `<div data-prep-list-kind="${activeTab}" data-prep-stats-region="table" data-skip-page-rerender="true">${renderStatsStandardTable(activeTab, month, params, details, stats)}</div>`,
    paginationHtml: `<div data-prep-stats-region="pagination" data-skip-page-rerender="true">${renderStatsStandardPagination(activeTab, month, params, details, stats)}</div>`,
    overlaysHtml: `<div data-prep-stats-region="column-settings" data-skip-page-rerender="true">${renderStatsColumnSettings(activeTab, month, params)}</div>`,
    className: 'min-w-0',
  })
}

function currentIsoMinute(): string {
  return new Date().toISOString().slice(0, 16)
}

function requestPreparationTimingRender(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('higood:request-render'))
}

function appendPreparationUploads(records: PreparationUploadRecord[]): void {
  if (!records.length) return
  const runtime = loadPreparationRuntimeState()
  savePreparationRuntimeState({
    ...runtime,
    uploads: [...runtime.uploads, ...records],
  })
  requestPreparationTimingRender()
}

function closePreparationDialog(): void {
  const currentPathname = appStore.getState().pathname || PAGE_PATH
  const params = new URLSearchParams(new URL(currentPathname, 'http://higoods.local').searchParams)
  params.delete('action')
  params.delete('itemId')
  params.delete('recordId')
  const query = params.toString()
  appStore.navigate(query ? `${PAGE_PATH}?${query}` : PAGE_PATH, { historyMode: 'replace' })
}

export async function handleProductionPreparationTimingSubmit(form: HTMLFormElement): Promise<boolean> {
  const formData = new FormData(form)

  if (form.matches('[data-prep-external-material-form]')) {
    const materialName = String(formData.get('materialName') ?? '').trim()
    if (!materialName) return true
    const runtime = loadPreparationRuntimeState()
    const maxSerialNo = Math.max(
      0,
      ...externalPreparationMaterials.map((item) => item.serialNo),
      ...runtime.externalMaterials.map((item) => item.serialNo),
    )
    savePreparationRuntimeState({
      ...runtime,
      externalMaterials: [
        ...runtime.externalMaterials,
        { serialNo: maxSerialNo + 1, materialName },
      ],
    })
    closePreparationDialog()
    return true
  }

  if (form.matches('[data-prep-confirm-items-form]')) {
    const recordId = String(formData.get('recordId') ?? '').trim()
    if (!recordId) return true
    const confirmedProductPrepType = String(formData.get('confirmedProductPrepType') ?? '').trim() as ProductPrepType
    const selectedItemTypes = normalizeSelectedPreparationItemTypes(formData.getAll('selectedItemType')
      .map((itemType) => String(itemType).trim() as PreparationItemType)
      .filter(Boolean))
    const materialSources = formData.getAll('materialSource').map((value) => String(value).trim())
    const externalSerialNos = formData.getAll('externalSerialNo').map((value) => Number(String(value).trim()) || 0)
    const externalMaterialNames = formData.getAll('externalMaterialName').map((value) => String(value).trim())
    const materialNos = formData.getAll('materialNo').map((value) => String(value).trim())
    const materialNames = formData.getAll('materialName').map((value) => String(value).trim())
    const materialTypes = formData.getAll('materialType').map((value) => String(value).trim())
    const materialImageUrls = formData.getAll('materialImageUrl').map((value) => String(value).trim())
    const materialRequiredQtys = formData.getAll('materialRequiredQty').map((value) => Number(value) || 0)
    const materialPreparedQtys = formData.getAll('materialPreparedQty').map((value) => Number(value) || 0)
    const materialIssuedQtys = formData.getAll('materialIssuedQty').map((value) => Number(value) || 0)
    const materialUnits = formData.getAll('materialUnit').map((value) => String(value).trim() || '米')
    const materialItems = materialNos
      .map((materialNo, index) => {
        if (materialSources[index] === '非系统内物料') {
          const externalMaterial = allExternalMaterials().find((item) =>
            item.serialNo === externalSerialNos[index] || item.materialName === externalMaterialNames[index])
          if (!externalMaterial) return null
          return {
            materialSource: '非系统内物料' as const,
            externalSerialNo: externalMaterial.serialNo,
            materialNo: '',
            materialName: externalMaterial.materialName,
            materialType: '',
            imageUrl: '',
            requiredQty: 0,
            preparedQty: 0,
            issuedQty: 0,
            unit: '',
          }
        }
        return {
          materialSource: '系统内物料' as const,
          materialNo,
          materialName: materialNames[index] ?? '',
          materialType: materialTypes[index] ?? '',
          imageUrl: materialImageUrls[index] ?? '',
          requiredQty: materialRequiredQtys[index] ?? 0,
          preparedQty: materialPreparedQtys[index] ?? 0,
          issuedQty: materialIssuedQtys[index] ?? 0,
          unit: materialUnits[index] ?? '米',
        }
      })
      .filter((material): material is PreparationMaterialLine => Boolean(material && material.materialName && (material.materialSource === '非系统内物料' || material.materialNo)))
    const firstMaterial = materialItems[0]
    const materialRequirement = {
      materialNo: firstMaterial?.materialNo ?? '',
      materialName: firstMaterial?.materialName ?? '',
      materialType: firstMaterial?.materialType,
      imageUrl: firstMaterial?.imageUrl,
      requiredQty: firstMaterial?.requiredQty,
      preparedQty: firstMaterial?.preparedQty,
      issuedQty: firstMaterial?.issuedQty,
      unit: firstMaterial?.unit,
      items: materialItems,
    }
    const sampleRequirementText = String(formData.get('sampleRequirementText') ?? '').trim()
    const confirmationRemark = String(formData.get('confirmationRemark') ?? '').trim()
    const runtime = loadPreparationRuntimeState()
    savePreparationRuntimeState({
      ...runtime,
      confirmedRecords: {
        ...runtime.confirmedRecords,
        [recordId]: {
          confirmedBy: '当前跟单',
          confirmedAt: currentIsoMinute(),
          confirmedProductPrepType,
          selectedItemTypes,
          materialRequirement,
          sampleRequirementText,
          confirmationRemark,
          overrideReason: confirmationRemark,
        },
      },
    })
    closePreparationDialog()
    return true
  }

  if (form.matches('[data-prep-dye-requirement-form]')) {
    const recordId = String(formData.get('recordId') ?? '').trim()
    const itemId = String(formData.get('itemId') ?? '').trim()
    if (!recordId || !itemId) return true

    const runtime = loadPreparationRuntimeState()
    const record = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
      .find((item) => item.recordId === recordId)
    if (!record || !hasConfirmedWorkItems(record)) return true
    const item = record.items.find((candidate) => candidate.itemId === itemId)
    if (!item || !isDyeRequirementItem(item) || !isSelectedPreparationItem(item) || item.status === '已完成' || !canOperateItem(item, record)) return true
    const maintainedAt = currentIsoMinute()

    const dyeRequirement: PreparationDyeRequirement = {
      materialNo: String(formData.get('materialNo') ?? record.materialRequirement.materialNo).trim(),
      materialName: String(formData.get('materialName') ?? record.materialRequirement.materialName).trim(),
      colorName: String(formData.get('colorSampleName') ?? '').trim(),
      pantoneCode: String(formData.get('pantoneCode') ?? '').trim(),
      remark: String(formData.get('requirementText') ?? '').trim(),
      maintainedBy: '当前用户',
      maintainedAt,
    }
    const dependentDyeItemIds = record.items
      .filter((candidate) => isDyeItem(candidate) && candidate.dependsOnItemIds.includes(itemId))
      .map((candidate) => candidate.itemId)
    const dyeRequirements = {
      ...runtime.dyeRequirements,
      [itemId]: dyeRequirement,
      ...Object.fromEntries(dependentDyeItemIds.map((dependentItemId) => [dependentItemId, dyeRequirement])),
    }

    savePreparationRuntimeState({
      ...runtime,
      dyeRequirements,
      uploads: [
        ...runtime.uploads,
        {
          uploadId: `dye-requirement-${Date.now()}`,
          recordId,
          itemId,
          itemType: item.itemType,
          fileName: '染色要求确认记录',
          fileType: 'text/plain',
          fileSize: 1,
          fileDataUrl: 'data:text/plain;base64,',
          uploadedBy: '当前用户',
          uploadedAt: maintainedAt,
          note: `${dyeRequirement.colorName} / ${dyeRequirement.pantoneCode}`,
        },
      ],
    })
    closePreparationDialog()
    return true
  }

  if (form.matches('[data-prep-accessory-order-form]')) {
    const recordId = String(formData.get('recordId') ?? '').trim()
    const itemId = String(formData.get('itemId') ?? '').trim()
    const orderNos = formData.getAll('accessoryPurchaseOrderNo')
      .map((value) => String(value).trim())
    const orderedAts = formData.getAll('accessoryPurchaseOrderedAt')
      .map((value) => String(value).trim())
    const orderRows = orderNos.map((orderNo, index) => ({ orderNo, orderedAt: orderedAts[index] ?? '' }))
    if (!recordId || !itemId || !orderRows.length || orderRows.some((row) => !row.orderNo || !row.orderedAt)) return true
    const completedAt = orderRows.map((row) => row.orderedAt).sort().at(-1)!

    const runtime = loadPreparationRuntimeState()
    const record = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
      .find((item) => item.recordId === recordId)
    if (!record || !hasConfirmedWorkItems(record)) return true
    const item = record.items.find((candidate) => candidate.itemId === itemId)
    if (!item || item.itemType !== '辅料下单' || !isSelectedPreparationItem(item) || !canOperateItem(item, record)) return true

    savePreparationRuntimeState({
      ...runtime,
      accessoryPurchaseOrders: {
        ...runtime.accessoryPurchaseOrders,
        [itemId]: {
          orderNos: orderRows.map((row) => row.orderNo),
          orderedAts: orderRows.map((row) => row.orderedAt),
          updatedAt: completedAt,
          updatedBy: '当前跟单',
        },
      },
    })
    closePreparationDialog()
    return true
  }

  if (!form.matches('[data-prep-operate-item-form]')) return false

  const recordId = String(formData.get('recordId') ?? '').trim()
  const itemId = String(formData.get('itemId') ?? '').trim()
  if (!recordId || !itemId) return true

  const runtime = loadPreparationRuntimeState()
  const record = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
    .find((item) => item.recordId === recordId)
  if (!record || !hasConfirmedWorkItems(record)) return true
  const item = record?.items.find((candidate) => candidate.itemId === itemId)
  if (!item) return true

  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"][name="files"]')
  const files = Array.from(fileInput?.files ?? [])
  const note = String(formData.get('note') ?? '').trim()
  const sampleMaker = String(formData.get('sampleMaker') ?? '').trim()
  const uploadNote = [sampleMaker ? `样衣制作人：${sampleMaker}` : '', note].filter(Boolean).join('；')

  if (!files.length) {
    return true
  }

  try {
    const uploadRecords = await buildUploadRecordsFromFiles({
      recordId,
      itemId,
      itemType: item.itemType,
      files,
      uploadedBy: '当前用户',
      note: uploadNote,
    })
    appendPreparationUploads(uploadRecords)
    closePreparationDialog()
  } catch (error) {
    console.error('生产准备上传失败', error)
  }

  return true
}

function syncPreparationTypeBlocks(typeRadio: HTMLInputElement): void {
  if (!typeRadio.checked) return
  const form = typeRadio.closest<HTMLFormElement>('[data-prep-confirm-items-form]')
  if (!form) return
  const selectedType = typeRadio.value
  form.querySelectorAll<HTMLElement>('[data-prep-type-block]').forEach((block) => {
    const active = block.dataset.prepTypeBlock === selectedType
    block.hidden = !active
    block.querySelectorAll<HTMLInputElement>('input[name="selectedItemType"], input[type="checkbox"]').forEach((input) => {
      input.disabled = !active
    })
    if (active) {
      block.querySelectorAll<HTMLInputElement>('[data-prep-fixed-item]').forEach((input) => {
        input.checked = true
      })
    }
  })
}

function syncMaterialRow(input: HTMLInputElement): void {
  const row = input.closest<HTMLElement>('[data-prep-material-row]')
  const form = input.closest<HTMLFormElement>('[data-prep-confirm-items-form]')
  const datalist = form?.querySelector<HTMLDataListElement>('#prep-material-options')
  if (!row || !datalist) return
  const option = Array.from(datalist.options).find((item) => item.value === input.value)
  const materialName = option?.dataset.materialName ?? ''
  const materialType = option?.dataset.materialType ?? ''
  const imageUrl = option?.dataset.imageUrl ?? ''
  row.querySelector<HTMLInputElement>('[data-prep-material-name]')!.value = materialName
  row.querySelector<HTMLInputElement>('[data-prep-material-type]')!.value = materialType
  row.querySelector<HTMLInputElement>('[data-prep-material-image]')!.value = imageUrl
  row.querySelector<HTMLInputElement>('[data-prep-material-required]')!.value = option?.dataset.requiredQty ?? '0'
  row.querySelector<HTMLInputElement>('[data-prep-material-prepared]')!.value = option?.dataset.preparedQty ?? '0'
  row.querySelector<HTMLInputElement>('[data-prep-material-issued]')!.value = option?.dataset.issuedQty ?? '0'
  row.querySelector<HTMLInputElement>('[data-prep-material-unit]')!.value = option?.dataset.unit ?? '米'
  const image = row.querySelector<HTMLImageElement>('[data-prep-material-preview-image]')
  const name = row.querySelector<HTMLElement>('[data-prep-material-preview-name]')
  const no = row.querySelector<HTMLElement>('[data-prep-material-preview-no]')
  const type = row.querySelector<HTMLElement>('[data-prep-material-preview-type]')
  if (image) {
    image.src = imageUrl
    image.alt = materialName
  }
  if (name) name.textContent = materialName || '请选择物料'
  if (no) no.textContent = input.value || '-'
  if (type) type.textContent = materialType || '-'
}

function syncExternalMaterialRow(input: HTMLInputElement): void {
  const row = input.closest<HTMLElement>('[data-prep-material-row]')
  const form = input.closest<HTMLFormElement>('[data-prep-confirm-items-form]')
  const datalist = form?.querySelector<HTMLDataListElement>('#prep-external-material-options')
  if (!row || !datalist) return
  const option = Array.from(datalist.options).find((item) => item.value === input.value)
  const materialName = input.value
  row.querySelector<HTMLInputElement>('[data-prep-external-serial-no]')!.value = option?.dataset.externalSerialNo ?? ''
  row.querySelector<HTMLInputElement>('[data-prep-material-name]')!.value = materialName
  row.querySelector<HTMLInputElement>('[data-prep-material-type]')!.value = ''
  row.querySelector<HTMLInputElement>('[data-prep-material-image]')!.value = ''
  row.querySelector<HTMLInputElement>('[data-prep-material-required]')!.value = '0'
  row.querySelector<HTMLInputElement>('[data-prep-material-prepared]')!.value = '0'
  row.querySelector<HTMLInputElement>('[data-prep-material-issued]')!.value = '0'
  row.querySelector<HTMLInputElement>('[data-prep-material-unit]')!.value = ''
  const name = row.querySelector<HTMLElement>('[data-prep-material-preview-name]')
  const no = row.querySelector<HTMLElement>('[data-prep-material-preview-no]')
  const type = row.querySelector<HTMLElement>('[data-prep-material-preview-type]')
  if (name) name.textContent = materialName || '请选择物料'
  if (no) no.textContent = option?.dataset.externalSerialNo ? `序号 ${option.dataset.externalSerialNo}` : '-'
  if (type) type.textContent = '-'
}

function syncMaterialSource(select: HTMLSelectElement): void {
  const row = select.closest<HTMLElement>('[data-prep-material-row]')
  if (!row) return
  const isExternal = select.value === '非系统内物料'
  row.querySelector<HTMLElement>('[data-prep-system-material-picker]')!.hidden = isExternal
  row.querySelector<HTMLElement>('[data-prep-external-material-picker]')!.hidden = !isExternal
}

function addMaterialRow(button: HTMLElement): void {
  const form = button.closest<HTMLFormElement>('[data-prep-confirm-items-form]')
  const rows = form?.querySelector<HTMLElement>('[data-prep-material-rows]')
  const source = rows?.querySelector<HTMLElement>('[data-prep-material-row]')
  if (!rows || !source) return
  const row = source.cloneNode(true) as HTMLElement
  row.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    input.value = input.name === 'materialUnit' ? '米' : input.name.includes('Qty') ? '0' : ''
  })
  row.querySelectorAll<HTMLSelectElement>('select[name="materialSource"]').forEach((select) => {
    select.value = '系统内物料'
    syncMaterialSource(select)
  })
  row.querySelectorAll<HTMLElement>('[data-prep-material-preview-name], [data-prep-material-preview-no], [data-prep-material-preview-type]').forEach((node) => {
    node.textContent = node.matches('[data-prep-material-preview-name]') ? '请选择物料' : '-'
  })
  const image = row.querySelector<HTMLImageElement>('[data-prep-material-preview-image]')
  if (image) {
    image.removeAttribute('src')
    image.alt = '请选择物料'
  }
  rows.appendChild(row)
}

function addAccessoryOrderRow(button: HTMLElement): void {
  const rows = button.closest<HTMLFormElement>('[data-prep-accessory-order-form]')?.querySelector<HTMLElement>('[data-prep-accessory-order-rows]')
  if (!rows) return
  const row = document.createElement('div')
  row.className = 'grid gap-2 md:grid-cols-[1fr_210px]'
  row.dataset.prepAccessoryOrderRow = ''
  row.innerHTML = `
    <input name="accessoryPurchaseOrderNo" class="w-full rounded-md border px-3 py-2 text-sm" required placeholder="填写面辅料采购单号" />
    <input type="datetime-local" name="accessoryPurchaseOrderedAt" value="${currentIsoMinute()}" class="w-full rounded-md border px-3 py-2 text-sm" required />
  `
  rows.appendChild(row)
}

function syncPreparationFilterDependencies(checkbox: HTMLInputElement): void {
  const scope = checkbox.closest<HTMLElement>('[data-prep-filter-scope], [data-prep-stats-filter-scope]')
  if (!scope) return
  const checkedValues = (field: string) => Array.from(
    scope.querySelectorAll<HTMLInputElement>(`[data-prep-filter-checkbox="${field}"]:checked`),
    (input) => input.value,
  )
  const selectedItemTypes = checkedValues('itemType') as PreparationItemType[]
  const selectedOwnerTeams = checkedValues('ownerTeam')
  scope.querySelectorAll<HTMLElement>('[data-prep-filter-option-label]').forEach((label) => {
    const field = label.dataset.prepFilterField
    if (field !== 'itemType' && field !== 'ownerTeam') return
    const value = label.dataset.prepFilterValue ?? ''
    const selected = checkedValues(field).includes(value)
    const relatedOwnerTeam = label.dataset.relatedOwnerTeam ?? ''
    const relatedItemTypes = label.dataset.relatedItemTypes
      ? JSON.parse(label.dataset.relatedItemTypes) as string[]
      : []
    const compatible = field === 'itemType'
      ? selectedOwnerTeams.length === 0 || selectedOwnerTeams.includes(relatedOwnerTeam)
      : selectedItemTypes.length === 0 || relatedItemTypes.some((itemType) => selectedItemTypes.includes(itemType as PreparationItemType))
    label.hidden = !selected && !compatible
  })

  scope.querySelectorAll<HTMLElement>('[data-prep-filter-summary]').forEach((summary) => {
    const field = summary.dataset.prepFilterSummary ?? ''
    const label = summary.dataset.prepFilterLabel ?? ''
    const count = checkedValues(field).length
    const text = summary.querySelector<HTMLElement>('span')
    if (text) text.textContent = `${label}${count ? `（${count}）` : ''}`
  })
}

function setLedgerRegion(region: string, html: string): void {
  if (typeof document === 'undefined') return
  const element = document.querySelector<HTMLElement>(`[data-prep-list-region="${region}"]`)
  if (!element) return
  element.innerHTML = html
  hydrateIcons(element)
}

function refreshLedgerTableAndPagination(): void {
  const paging = getLedgerListView()
  setLedgerRegion('table', renderLedgerStandardTable(paging))
  setLedgerRegion('pagination', renderLedgerStandardPagination(paging))
}

function refreshLedgerTable(): void {
  setLedgerRegion('table', renderLedgerStandardTable(getLedgerListView()))
}

function refreshLedgerColumnSettings(): void {
  setLedgerRegion('column-settings', renderLedgerColumnSettings())
}

function ledgerColumnWidth(column: StandardListColumn<ProductionPreparationRecord>): number {
  return Math.max(column.width, column.minWidth ?? 0)
}

function canFreezeLedgerColumn(columnKey: string): boolean {
  const columns = createLedgerColumns(ledgerListState.month, ledgerListState.params)
  const visibleKeys = new Set(ledgerListState.columnPreferences.visibleKeys)
  const frozenKeys = new Set(ledgerListState.columnPreferences.frozenKeys)
  const candidate = columns.find((column) => column.key === columnKey)
  if (!candidate?.freezeable || !visibleKeys.has(columnKey)) return false
  frozenKeys.add(columnKey)
  return columns.reduce((total, column) =>
    total + (visibleKeys.has(column.key) && frozenKeys.has(column.key) ? ledgerColumnWidth(column) : 0), 0) <= ledgerMaxFrozenWidth
}

function isCurrentPreparationTimingRoute(routePath: string): boolean {
  return (appStore.getState().pathname || '').split('?')[0].split('#')[0] === routePath
}

function isLedgerListEventTarget(target: HTMLElement, event?: Event): boolean {
  if (event?.type === 'dragend' && !(event as DragEvent & { higoodStandardListColumnDrag?: true }).higoodStandardListColumnDrag) {
    return false
  }
  return Boolean(target.closest<HTMLElement>([
    '[data-production-preparation-ledger-action]',
    '[data-production-preparation-ledger-field]',
    '[data-production-preparation-ledger-column-key]',
  ].join(',')))
}

function handleLedgerListEvent(target: HTMLElement, event?: Event): boolean {
  if (!isCurrentPreparationTimingRoute(PAGE_PATH)) return false
  if (!isLedgerListEventTarget(target, event)) return false
  const dragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined
  if (event?.type === 'dragend') {
    if (!dragEvent?.higoodStandardListColumnDrag) return false
    ledgerListState.draggedColumnKey = ''
    return true
  }

  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && dragEvent?.higoodStandardListColumnDrag && ['dragstart', 'dragover', 'drop'].includes(event?.type ?? '')) {
    const columnKey = dragNode.dataset.productionPreparationLedgerColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    const column = createLedgerColumns(ledgerListState.month, ledgerListState.params)
      .find((item) => item.key === columnKey && !item.actionColumn)
    if (event?.type === 'dragstart') {
      ledgerListState.draggedColumnKey = column?.key ?? ''
      return Boolean(column)
    }
    const sourceKey = dragEvent.higoodStandardListColumnKey ?? ''
    const targetKey = column?.key ?? ''
    if (!sourceKey || !targetKey || sourceKey === targetKey || ledgerListState.draggedColumnKey !== sourceKey) return false
    if (event?.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event?.preventDefault()
    ledgerListState.draggedColumnKey = ''
    const order = ledgerListState.columnPreferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    ledgerListState.columnPreferences = normalizeListColumnPreferences(
      ledgerColumnRules,
      { ...ledgerListState.columnPreferences, order },
      ledgerPageSizes,
    )
    saveLedgerPreferences()
    refreshLedgerTable()
    refreshLedgerColumnSettings()
    return true
  }

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-production-preparation-ledger-field]')
  if (fieldNode?.dataset.productionPreparationLedgerField === 'pageSize') {
    if (event?.type !== 'change') return false
    const pageSize = Number(fieldNode.value)
    if (ledgerPageSizes.includes(pageSize)) {
      ledgerListState.columnPreferences = normalizeListColumnPreferences(
        ledgerColumnRules,
        { ...ledgerListState.columnPreferences, pageSize },
        ledgerPageSizes,
      )
      ledgerListState.page = 1
      saveLedgerPreferences()
      refreshLedgerTableAndPagination()
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-production-preparation-ledger-action]')
  const action = actionNode?.dataset.productionPreparationLedgerAction
  if (!actionNode || !action) return false

  if (action === 'prev-page' || action === 'next-page') {
    ledgerListState.page += action === 'prev-page' ? -1 : 1
    const paging = getLedgerListView()
    setLedgerRegion('table', renderLedgerStandardTable(paging))
    setLedgerRegion('pagination', renderLedgerStandardPagination(paging))
    return true
  }
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey ?? ''
    const column = createLedgerColumns(ledgerListState.month, ledgerListState.params)
      .find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    ledgerListState.sort = ledgerListState.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : ledgerListState.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    ledgerListState.page = 1
    refreshLedgerTableAndPagination()
    return true
  }
  if (action === 'open-column-settings') {
    ledgerListState.columnSettingsOpen = true
    refreshLedgerColumnSettings()
    return true
  }
  if (action === 'close-column-settings') {
    ledgerListState.columnSettingsOpen = false
    refreshLedgerColumnSettings()
    return true
  }
  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.productionPreparationLedgerColumnKey ?? actionNode.dataset.columnKey ?? ''
    const rule = ledgerColumnRules.find((item) => item.key === columnKey)
    if (!rule || rule.required || rule.actionColumn) return true
    const visibleKeys = new Set(ledgerListState.columnPreferences.visibleKeys)
    const frozenKeys = new Set(ledgerListState.columnPreferences.frozenKeys)
    if (visibleKeys.has(columnKey)) {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    } else {
      visibleKeys.add(columnKey)
    }
    ledgerListState.columnPreferences = normalizeListColumnPreferences(
      ledgerColumnRules,
      { ...ledgerListState.columnPreferences, visibleKeys: [...visibleKeys], frozenKeys: [...frozenKeys] },
      ledgerPageSizes,
    )
    if (!visibleKeys.has(columnKey) && ledgerListState.sort?.key === columnKey) ledgerListState.sort = null
    saveLedgerPreferences()
    refreshLedgerTable()
    refreshLedgerColumnSettings()
    return true
  }
  if (action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.productionPreparationLedgerColumnKey ?? actionNode.dataset.columnKey ?? ''
    const frozenKeys = new Set(ledgerListState.columnPreferences.frozenKeys)
    if (frozenKeys.has(columnKey)) frozenKeys.delete(columnKey)
    else if (canFreezeLedgerColumn(columnKey)) frozenKeys.add(columnKey)
    ledgerListState.columnPreferences = normalizeListColumnPreferences(
      ledgerColumnRules,
      { ...ledgerListState.columnPreferences, frozenKeys: [...frozenKeys] },
      ledgerPageSizes,
    )
    saveLedgerPreferences()
    refreshLedgerTable()
    refreshLedgerColumnSettings()
    return true
  }
  if (action === 'restore-column-settings') {
    ledgerListState.columnPreferences = normalizeListColumnPreferences(
      ledgerColumnRules,
      defaultLedgerColumnPreferences,
      ledgerPageSizes,
    )
    ledgerListState.page = 1
    ledgerListState.sort = null
    const storage = getLedgerStorage()
    if (storage) clearListColumnPreferences(storage, ledgerStorageKey)
    refreshLedgerTableAndPagination()
    refreshLedgerColumnSettings()
    return true
  }
  return false
}

function getCurrentStatsContext(): {
  kind: StatsListKind
  month: string
  params: URLSearchParams
  details: MonthlyPreparationCompletionDetail[]
  stats: StatsTableRow[]
} {
  const url = new URL(appStore.getState().pathname || STATS_PAGE_PATH, 'http://higoods.local')
  const params = url.searchParams
  const kind: StatsListKind = params.get('tab') === 'detail' ? 'detail' : 'monthly'
  const month = valueOf(params, 'month') || DEFAULT_MONTH
  const { details, stats } = getStatsViewData(params, month)
  return { kind, month, params, details, stats }
}

function setStatsRegion(region: string, html: string): void {
  if (typeof document === 'undefined') return
  const element = document.querySelector<HTMLElement>(`[data-prep-stats-region="${region}"]`)
  if (!element) return
  element.innerHTML = html
  hydrateIcons(element)
}

function refreshStatsTableAndPagination(context = getCurrentStatsContext()): void {
  setStatsRegion('table', renderStatsStandardTable(context.kind, context.month, context.params, context.details, context.stats))
  setStatsRegion('pagination', renderStatsStandardPagination(context.kind, context.month, context.params, context.details, context.stats))
}

function refreshStatsTable(context = getCurrentStatsContext()): void {
  setStatsRegion('table', renderStatsStandardTable(context.kind, context.month, context.params, context.details, context.stats))
}

function refreshStatsColumnSettings(context = getCurrentStatsContext()): void {
  setStatsRegion('column-settings', renderStatsColumnSettings(context.kind, context.month, context.params))
}

function statsColumnMetadata(kind: StatsListKind, month: string, params: URLSearchParams): Array<{
  key: string
  width: number
  minWidth?: number
  freezeable?: boolean
  actionColumn?: boolean
  sortable?: boolean
}> {
  const columns = kind === 'monthly' ? createMonthlyStatsColumns(month, params) : createDetailStatsColumns(month)
  return columns.map(({ key, width, minWidth, freezeable, actionColumn, sortable }) => ({ key, width, minWidth, freezeable, actionColumn, sortable }))
}

function canFreezeStatsColumn(kind: StatsListKind, columnKey: string, month: string, params: URLSearchParams): boolean {
  const state = statsState(kind)
  const columns = statsColumnMetadata(kind, month, params)
  const visibleKeys = new Set(state.columnPreferences.visibleKeys)
  const frozenKeys = new Set(state.columnPreferences.frozenKeys)
  const candidate = columns.find((column) => column.key === columnKey)
  if (!candidate?.freezeable || !visibleKeys.has(columnKey)) return false
  frozenKeys.add(columnKey)
  return columns.reduce((total, column) =>
    total + (visibleKeys.has(column.key) && frozenKeys.has(column.key) ? Math.max(column.width, column.minWidth ?? 0) : 0), 0) <= statsMaxFrozenWidth
}

function currentStatsListKind(): StatsListKind {
  const pathname = appStore.getState().pathname || STATS_PAGE_PATH
  return new URL(pathname, 'http://higoods.local').searchParams.get('tab') === 'detail' ? 'detail' : 'monthly'
}

function isStatsListEventTarget(target: HTMLElement, event?: Event): boolean {
  const prefix = statsEventPrefix(currentStatsListKind())
  if (event?.type === 'dragend' && !(event as DragEvent & { higoodStandardListColumnDrag?: true }).higoodStandardListColumnDrag) {
    return false
  }
  return Boolean(target.closest<HTMLElement>([
    `[data-${prefix}-action]`,
    `[data-${prefix}-field]`,
    `[data-${prefix}-column-key]`,
  ].join(',')))
}

function handleStatsListEvent(target: HTMLElement, event?: Event): boolean {
  if (!isCurrentPreparationTimingRoute(STATS_PAGE_PATH)) return false
  if (!isStatsListEventTarget(target, event)) return false
  const context = getCurrentStatsContext()
  const { kind, month, params } = context
  const prefix = statsEventPrefix(kind)
  const state = statsState(kind)
  const rules = statsRules(kind)
  const defaults = statsDefaults(kind)
  const dragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined

  if (event?.type === 'dragend') {
    if (!dragEvent?.higoodStandardListColumnDrag) return false
    state.draggedColumnKey = ''
    return true
  }

  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && dragEvent?.higoodStandardListColumnDrag && ['dragstart', 'dragover', 'drop'].includes(event?.type ?? '')) {
    const columnKey = dragNode.getAttribute(`data-${prefix}-column-key`)
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    const column = statsColumnMetadata(kind, month, params).find((item) => item.key === columnKey && !item.actionColumn)
    if (event?.type === 'dragstart') {
      state.draggedColumnKey = column?.key ?? ''
      return Boolean(column)
    }
    const sourceKey = dragEvent.higoodStandardListColumnKey ?? ''
    const targetKey = column?.key ?? ''
    if (!sourceKey || !targetKey || sourceKey === targetKey || state.draggedColumnKey !== sourceKey) return false
    if (event?.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event?.preventDefault()
    state.draggedColumnKey = ''
    const order = state.columnPreferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    state.columnPreferences = normalizeListColumnPreferences(rules, { ...state.columnPreferences, order }, statsPageSizes)
    saveStatsPreferences(kind)
    refreshStatsTable(context)
    refreshStatsColumnSettings(context)
    return true
  }

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`)
  if (fieldNode?.getAttribute(`data-${prefix}-field`) === 'pageSize') {
    if (event?.type !== 'change') return false
    const pageSize = Number(fieldNode.value)
    if (statsPageSizes.includes(pageSize)) {
      state.columnPreferences = normalizeListColumnPreferences(rules, { ...state.columnPreferences, pageSize }, statsPageSizes)
      state.page = 1
      saveStatsPreferences(kind)
      refreshStatsTableAndPagination(context)
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${prefix}-action]`)
  const action = actionNode?.getAttribute(`data-${prefix}-action`) ?? ''
  if (!actionNode || !action) return false

  if (action === 'prev-page' || action === 'next-page') {
    state.page += action === 'prev-page' ? -1 : 1
    refreshStatsTableAndPagination(context)
    return true
  }
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey ?? ''
    const sortable = statsColumnMetadata(kind, month, params).some((column) => column.key === columnKey && column.sortable)
    if (!sortable) return true
    state.sort = state.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.page = 1
    refreshStatsTableAndPagination(context)
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    state.columnSettingsOpen = action === 'open-column-settings'
    refreshStatsColumnSettings(context)
    return true
  }

  const columnKey = actionNode.getAttribute(`data-${prefix}-column-key`) ?? actionNode.dataset.columnKey ?? ''
  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const rule = rules.find((item) => item.key === columnKey)
    if (!rule || rule.required || rule.actionColumn) return true
    const visibleKeys = new Set(state.columnPreferences.visibleKeys)
    const frozenKeys = new Set(state.columnPreferences.frozenKeys)
    if (visibleKeys.has(columnKey)) {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    } else visibleKeys.add(columnKey)
    state.columnPreferences = normalizeListColumnPreferences(rules, { ...state.columnPreferences, visibleKeys: [...visibleKeys], frozenKeys: [...frozenKeys] }, statsPageSizes)
    if (!visibleKeys.has(columnKey) && state.sort?.key === columnKey) state.sort = null
    saveStatsPreferences(kind)
    refreshStatsTable(context)
    refreshStatsColumnSettings(context)
    return true
  }
  if (action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const frozenKeys = new Set(state.columnPreferences.frozenKeys)
    if (frozenKeys.has(columnKey)) frozenKeys.delete(columnKey)
    else if (canFreezeStatsColumn(kind, columnKey, month, params)) frozenKeys.add(columnKey)
    state.columnPreferences = normalizeListColumnPreferences(rules, { ...state.columnPreferences, frozenKeys: [...frozenKeys] }, statsPageSizes)
    saveStatsPreferences(kind)
    refreshStatsTable(context)
    refreshStatsColumnSettings(context)
    return true
  }
  if (action === 'restore-column-settings') {
    state.columnPreferences = normalizeListColumnPreferences(rules, defaults, statsPageSizes)
    state.page = 1
    state.sort = null
    const storage = getLedgerStorage()
    if (storage) clearListColumnPreferences(storage, statsStorageKey(kind))
    refreshStatsTableAndPagination(context)
    refreshStatsColumnSettings(context)
    return true
  }
  return false
}

export function handleProductionPreparationTimingEvent(target: HTMLElement, event?: Event): boolean {
  if (handleLedgerListEvent(target, event)) return true
  if (handleStatsListEvent(target, event)) return true

  const filterCheckbox = target.closest<HTMLInputElement>('[data-prep-filter-checkbox]')
  if (filterCheckbox) {
    syncPreparationFilterDependencies(filterCheckbox)
    return false
  }

  const materialSourceSelect = target.closest<HTMLSelectElement>('[data-prep-material-source]')
  if (materialSourceSelect) {
    syncMaterialSource(materialSourceSelect)
    return false
  }

  const materialInput = target.closest<HTMLInputElement>('[data-prep-material-input]')
  if (materialInput) {
    syncMaterialRow(materialInput)
    return false
  }

  const externalMaterialInput = target.closest<HTMLInputElement>('[data-prep-external-material-input]')
  if (externalMaterialInput) {
    syncExternalMaterialRow(externalMaterialInput)
    return false
  }

  const typeRadio = target.closest<HTMLInputElement>('[data-prep-type-radio]')
  if (typeRadio) {
    syncPreparationTypeBlocks(typeRadio)
    return false
  }

  const fixedItemCheckbox = target.closest<HTMLInputElement>('[data-prep-fixed-item]')
  if (fixedItemCheckbox) {
    fixedItemCheckbox.checked = true
    return false
  }

  const actionNode = target.closest<HTMLElement>('[data-prep-action]')
  if (actionNode?.dataset.prepAction === 'add-material-row') {
    addMaterialRow(actionNode)
    return false
  }
  if (actionNode?.dataset.prepAction === 'add-accessory-order-row') {
    addAccessoryOrderRow(actionNode)
    return false
  }
  if (actionNode?.dataset.prepAction === 'remove-material-row') {
    const rows = actionNode.closest<HTMLFormElement>('[data-prep-confirm-items-form]')?.querySelectorAll('[data-prep-material-row]')
    if ((rows?.length ?? 0) > 1) actionNode.closest('[data-prep-material-row]')?.remove()
    return false
  }
  if (!actionNode || actionNode.dataset.prepAction !== 'download-upload') return false

  const uploadId = actionNode.dataset.uploadId
  if (!uploadId) return true

  const runtime = loadPreparationRuntimeState()
  const upload = runtime.uploads.find((item) => item.uploadId === uploadId) ??
    mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
      .flatMap((record) => record.items)
      .flatMap((item) => item.uploads ?? [])
      .find((item) => item.uploadId === uploadId)
  if (!upload) return true

  savePreparationRuntimeState(appendDownloadRecord(runtime, {
    recordId: upload.recordId,
    itemId: upload.itemId,
    uploadId: upload.uploadId,
    fileName: upload.fileName,
    downloadedBy: '当前用户',
  }))

  if (upload.fileDataUrl) {
    const link = document.createElement('a')
    link.href = upload.fileDataUrl
    link.download = upload.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  requestPreparationTimingRender()
  return true
}
