// 生产工程专业任务：共享类型、状态、公共渲染与列表公共骨架
// 由 pcs-engineering-tasks.ts（制版、首单样衣）与专业任务页共用。
// 本文件不依赖任何页面模块，避免循环依赖；页面模块只能单向依赖本文件。

import { renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
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
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { findStyleArchiveByProjectId, listStyleArchives } from '../../data/pcs-style-archive-repository.ts'
import { listProjectRelationsBySourceObject } from '../../data/pcs-project-relation-repository.ts'
import { escapeHtml, formatDateTime, toClassName } from '../../utils.ts'

export type ModuleKey = 'plate' | 'pattern' | 'firstSample' | 'color' | 'purchase' | 'techPack'

export interface EngineeringLog {
  time: string
  action: string
  user: string
  detail: string
}

export interface ListState {
  search: string
  status: string
  owner: string
  source: string
  quickFilter: string
  currentPage: number
}

export interface SampleListState extends ListState {
  site: string
}

export interface EngineeringListRow {
  cells: Record<string, string>
  sortValues: Record<string, unknown>
}

export interface EngineeringListUiState {
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
}

export const ENGINEERING_LIST_PAGE_SIZES = [8, 20, 50]
export const ENGINEERING_LIST_MAX_FROZEN_WIDTH = 520
export const ENGINEERING_LIST_STORAGE_KEYS: Record<ModuleKey, string> = {
  plate: 'higood:list-page:/pcs/patterns/plate-making',
  pattern: 'higood:list-page:/pcs/patterns/artwork',
  firstSample: 'higood:list-page:/pcs/samples/first-sample',
  color: 'higood:list-page:/pcs/engineering/color',
  purchase: 'higood:list-page:/pcs/engineering/purchase',
  techPack: 'higood:list-page:/pcs/engineering/tech-pack',
}
export const ENGINEERING_LIST_COLUMN_RULES: Record<ModuleKey, StandardListColumnRule[]> = {
  plate: [
    { key: 'image', required: true, freezeable: true },
    { key: 'task', required: true, freezeable: true },
    { key: 'projectStyle', freezeable: true },
    { key: 'maker' },
    { key: 'stage' },
    { key: 'next' },
    { key: 'pattern' },
    { key: 'sampleReview' },
    { key: 'techPack' },
    { key: 'updated', freezeable: true },
    { key: 'actions', required: true, actionColumn: true },
  ],
  pattern: [
    { key: 'task', required: true, freezeable: true },
    { key: 'image', required: true, freezeable: true },
    { key: 'project', required: true, freezeable: true },
    { key: 'source' },
    { key: 'process' },
    { key: 'fabric' },
    { key: 'qty' },
    { key: 'difficulty' },
    { key: 'team' },
    { key: 'member' },
    { key: 'buyerReview', required: true, freezeable: true },
    { key: 'library' },
    { key: 'techPack' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  firstSample: [
    { key: 'task', required: true, freezeable: true },
    { key: 'project', freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'revision' },
    { key: 'site' },
    { key: 'materialMode' },
    { key: 'sampleCode' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  color: [
    { key: 'task', required: true, freezeable: true },
    { key: 'master', required: true, freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'team' },
    { key: 'material' },
    { key: 'rework' },
    { key: 'started' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  purchase: [
    { key: 'task', required: true, freezeable: true },
    { key: 'master', required: true, freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'team' },
    { key: 'material' },
    { key: 'started' },
    { key: 'actions', required: true, actionColumn: true },
  ],
  techPack: [
    { key: 'task', required: true, freezeable: true },
    { key: 'master', required: true, freezeable: true },
    { key: 'status', required: true, freezeable: true },
    { key: 'team' },
    { key: 'rework' },
    { key: 'started' },
    { key: 'actions', required: true, actionColumn: true },
  ],
}

export function createEngineeringListUiState(module: ModuleKey): EngineeringListUiState {
  const rules = ENGINEERING_LIST_COLUMN_RULES[module]
  return {
    sort: null,
    columnPreferences: normalizeListColumnPreferences(
      rules,
      {
        order: rules.map((rule) => rule.key),
        visibleKeys: rules.map((rule) => rule.key),
        frozenKeys: [],
        pageSize: ENGINEERING_LIST_PAGE_SIZES[0]!,
      },
      ENGINEERING_LIST_PAGE_SIZES,
    ),
    columnSettingsOpen: false,
    draggedColumnKey: '',
  }
}

export const COMMON_STATUS_META: Record<string, { label: string; className: string }> = {
  未启用: { label: '未启用', className: 'bg-slate-100 text-slate-400' },
  待前置: { label: '待前置', className: 'bg-slate-100 text-slate-700' },
  待开始: { label: '待开始', className: 'bg-slate-100 text-slate-700' },
  进行中: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
  待审核: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  返工中: { label: '返工中', className: 'bg-orange-100 text-orange-700' },
  已完成: { label: '已完成', className: 'bg-green-100 text-green-700' },
  因需求变更结束: { label: '因需求变更结束', className: 'bg-slate-100 text-slate-500' },
}

export const ENGINEERING_COMMON_FILTER_STATUS_OPTIONS = ['未启用', '待前置', '待开始', '进行中', '待审核', '返工中', '已完成', '因需求变更结束']
export const state = {
  notice: null as string | null,
  plateList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,

  patternList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,

  firstSampleList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1, site: 'all' } as SampleListState,

  colorList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  purchaseList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
  techPackList: { search: '', status: 'all', owner: 'all', source: 'all', quickFilter: 'all', currentPage: 1 } as ListState,
}

export const engineeringListUiState: Record<ModuleKey, EngineeringListUiState> = {
  plate: createEngineeringListUiState('plate'),
  pattern: createEngineeringListUiState('pattern'),
  firstSample: createEngineeringListUiState('firstSample'),
  color: createEngineeringListUiState('color'),
  purchase: createEngineeringListUiState('purchase'),
  techPack: createEngineeringListUiState('techPack'),
}
export const engineeringListPreferencesLoaded: Record<ModuleKey, boolean> = {
  plate: false,
  pattern: false,
  firstSample: false,
  color: false,
  purchase: false,
  techPack: false,
}

export const runtimeLogs: Record<ModuleKey, Map<string, EngineeringLog[]>> = {
  plate: new Map(),
  pattern: new Map(),
  firstSample: new Map(),
  color: new Map(),
  purchase: new Map(),
  techPack: new Map(),
}

export function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function todayText(): string {
  return nowText().slice(0, 10)
}

export function setNotice(message: string): void {
  state.notice = message
}

export function clearNotice(): void {
  state.notice = null
}

export function pushRuntimeLog(module: ModuleKey, taskId: string, action: string, detail: string, user = '当前用户'): void {
  const logs = runtimeLogs[module].get(taskId) || []
  runtimeLogs[module].set(taskId, [{ time: nowText(), action, detail, user }, ...logs])
}

export function baseLogs(task: { createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; title: string }): EngineeringLog[] {
  const logs: EngineeringLog[] = [
    { time: task.updatedAt, action: '最近更新', user: task.updatedBy || '系统初始化', detail: `已更新：${task.title}` },
    { time: task.createdAt, action: '创建任务', user: task.createdBy || '系统初始化', detail: `已建立正式任务：${task.title}` },
  ]
  return logs.sort((left, right) => right.time.localeCompare(left.time))
}

export function mergeLogs(module: ModuleKey, taskId: string, logs: EngineeringLog[]): EngineeringLog[] {
  return [...(runtimeLogs[module].get(taskId) || []), ...logs].sort((left, right) => right.time.localeCompare(left.time))
}

export function getCommonStatusMeta(status: string): { label: string; className: string } {
  const visibleStatus = normalizeEngineeringVisibleStatus(status)
  return COMMON_STATUS_META[visibleStatus] || { label: visibleStatus || '-', className: 'bg-slate-100 text-slate-600' }
}

export function getStatusFilterLabel(status: string): string {
  return getCommonStatusMeta(status).label
}

export function normalizeEngineeringVisibleStatus(status: string): string {
  return ENGINEERING_COMMON_FILTER_STATUS_OPTIONS.includes(status) ? status : '未启用'
}

export function renderStatusBadge(status: string, sample = false): string {
  void sample
  const meta = getCommonStatusMeta(status)
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', meta.className))}">${escapeHtml(meta.label)}</span>`
}

export function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p>${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-engineering-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

export function renderMetricButton(label: string, value: number, active: boolean, quickFilter: string, actionPrefix: string): string {
  return `
    <button
      type="button"
      class="${escapeHtml(
        toClassName(
          'flex h-12 min-w-[12rem] flex-[1_1_12rem] items-center justify-between gap-3 rounded-lg border px-3 text-left transition hover:border-blue-300',
          active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
        ),
      )}"
      data-pcs-engineering-action="${escapeHtml(actionPrefix)}"
      data-quick-filter="${escapeHtml(quickFilter)}"
    >
      <span class="whitespace-nowrap text-xs text-slate-500">${escapeHtml(label)}</span>
      <strong class="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">${escapeHtml(value)}</strong>
    </button>
  `
}

export function createEngineeringListColumns(
  specs: Array<Omit<StandardListColumn<EngineeringListRow>, 'render' | 'sortValue'>>,
): StandardListColumn<EngineeringListRow>[] {
  return specs.map((spec) => ({
    ...spec,
    render: (row) => row.cells[spec.key] || '<span class="text-slate-400">-</span>',
    sortValue: spec.sortable ? (row) => row.sortValues[spec.key] : undefined,
  }))
}

export function getEngineeringListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function normalizeEngineeringListPreferences(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(
    ENGINEERING_LIST_COLUMN_RULES[module],
    raw,
    ENGINEERING_LIST_PAGE_SIZES,
  )
  const columnsByKey = new Map(columns.map((column) => [column.key, column]))
  const visibleKeys = new Set(normalized.visibleKeys)
  const requestedFrozenKeys = new Set(normalized.frozenKeys)
  const frozenColumns = normalized.order
    .map((key) => columnsByKey.get(key))
    .filter((column): column is StandardListColumn<EngineeringListRow> => Boolean(
      column
      && column.freezeable
      && !column.actionColumn
      && visibleKeys.has(column.key)
      && requestedFrozenKeys.has(column.key),
    ))
  let frozenWidth = frozenColumns.reduce(
    (sum, column) => sum + Math.max(column.width, column.minWidth ?? 0),
    0,
  )
  while (frozenWidth > ENGINEERING_LIST_MAX_FROZEN_WIDTH && frozenColumns.length > 0) {
    const removed = frozenColumns.pop()
    if (removed) frozenWidth -= Math.max(removed.width, removed.minWidth ?? 0)
  }
  return {
    ...normalized,
    frozenKeys: frozenColumns.map((column) => column.key),
  }
}

export function ensureEngineeringListPreferences(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
): void {
  if (engineeringListPreferencesLoaded[module]) return
  engineeringListPreferencesLoaded[module] = true
  const storage = getEngineeringListStorage()
  const loaded = storage
    ? loadListColumnPreferences(
        storage,
        ENGINEERING_LIST_STORAGE_KEYS[module],
        ENGINEERING_LIST_COLUMN_RULES[module],
        engineeringListUiState[module].columnPreferences,
        ENGINEERING_LIST_PAGE_SIZES,
      )
    : engineeringListUiState[module].columnPreferences
  engineeringListUiState[module].columnPreferences = normalizeEngineeringListPreferences(module, columns, loaded)
}

export function saveEngineeringListPreferences(module: ModuleKey): void {
  const storage = getEngineeringListStorage()
  if (storage) {
    saveListColumnPreferences(
      storage,
      ENGINEERING_LIST_STORAGE_KEYS[module],
      engineeringListUiState[module].columnPreferences,
    )
  }
}

export function withEngineeringListLocalInteractions(module: ModuleKey, html: string): string {
  return html
    .replace(/data-pcs-engineering-action="([^"]+)"/g, (attribute, action: string) => {
      const localActions = new Set([
        'sort-column',
        'prev-page',
        'next-page',
        'open-column-settings',
        'close-column-settings',
        'restore-column-settings',
        'toggle-column-visibility',
        'toggle-column-freeze',
      ])
      if (!localActions.has(action) && !/^set-(plate|pattern|first-sample|first-order|color|purchase|tech-pack)-quick-filter$/.test(action)) {
        return attribute
      }
      return `data-skip-page-rerender="true" data-pcs-engineering-list-module="${module}" ${attribute}`
    })
    .replace(/data-pcs-engineering-field="([^"]+)"/g, (attribute, field: string) => {
      if (field !== 'pageSize' && !/^(plate|pattern|first-sample|first-order|color|purchase|tech-pack)-(search|status|owner|source|site)$/.test(field)) {
        return attribute
      }
      return `data-skip-page-rerender="true" data-pcs-engineering-list-module="${module}" ${attribute}`
    })
}

export function renderEngineeringListPrimaryActions(actionLabel: string, action: string): string {
  // 以 nav: 前缀声明的动作渲染为页面导航按钮（走全局 data-nav 处理）
  const isNav = action.startsWith('nav:')
  const navPath = isNav ? action.slice(4) : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="refresh-page">
        <i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新
      </button>
      <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" ${isNav ? `data-nav="${escapeHtml(navPath)}"` : `data-pcs-engineering-action="${escapeHtml(action)}"`}>
        <i data-lucide="plus" class="h-4 w-4"></i>${escapeHtml(actionLabel)}
      </button>
    </div>
  `
}

export interface EngineeringListView {
  rows: EngineeringListRow[]
  paging: StandardListPageSlice<EngineeringListRow>
}

export function getEngineeringListView(
  module: ModuleKey,
  rows: EngineeringListRow[],
  columns: readonly StandardListColumn<EngineeringListRow>[],
  listState: ListState | SampleListState,
): EngineeringListView {
  ensureEngineeringListPreferences(module, columns)
  const uiState = engineeringListUiState[module]
  const sorted = sortStandardListRows(
    rows,
    uiState.sort,
    (row, key) => row.sortValues[key],
  )
  const paging = paginateStandardListRows(
    sorted,
    listState.currentPage,
    uiState.columnPreferences.pageSize,
  )
  listState.currentPage = paging.currentPage
  return { rows: sorted, paging }
}

export function renderEngineeringListTable(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
  paging: StandardListPageSlice<EngineeringListRow>,
  emptyText: string,
): string {
  return withEngineeringListLocalInteractions(module, renderStandardListTable({
    columns,
    rows: paging.rows,
    preferences: engineeringListUiState[module].columnPreferences,
    sort: engineeringListUiState[module].sort,
    eventPrefix: 'pcs-engineering',
    emptyText,
  }))
}

export function renderEngineeringListPagination(
  module: ModuleKey,
  paging: StandardListPageSlice<EngineeringListRow>,
): string {
  return withEngineeringListLocalInteractions(module, renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'pcs-engineering',
    fieldPrefix: 'pcs-engineering',
    pageSizeOptions: ENGINEERING_LIST_PAGE_SIZES,
  }))
}

export function renderEngineeringListColumnOverlay(
  module: ModuleKey,
  columns: readonly StandardListColumn<EngineeringListRow>[],
): string {
  if (!engineeringListUiState[module].columnSettingsOpen) return ''
  return withEngineeringListLocalInteractions(module, renderStandardListColumnSettings({
    title: '列设置',
    columns,
    preferences: engineeringListUiState[module].columnPreferences,
    eventPrefix: 'pcs-engineering',
    maxFrozenWidth: ENGINEERING_LIST_MAX_FROZEN_WIDTH,
  }))
}

export interface EngineeringStandardListPageConfig {
  module: ModuleKey
  title: string
  createLabel: string
  createAction: string
  filtersHtml: string
  statsHtml: string
  rows: EngineeringListRow[]
  columns: readonly StandardListColumn<EngineeringListRow>[]
  listState: ListState | SampleListState
  emptyText: string
  overlaysHtml?: string
}

export function renderEngineeringStandardListPage(config: EngineeringStandardListPageConfig): string {
  ensureEngineeringListPreferences(config.module, config.columns)
  const transient = {
    currentPage: config.listState.currentPage,
    sort: engineeringListUiState[config.module].sort,
  }
  const hasMountedRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector(`[data-pcs-engineering-list-module="${config.module}"]`))
  resetStandardListEntryTransientStateOnRouteEntry(transient, hasMountedRoot)
  config.listState.currentPage = transient.currentPage
  engineeringListUiState[config.module].sort = transient.sort
  const view = getEngineeringListView(config.module, config.rows, config.columns, config.listState)
  const columnSettingsButton = withEngineeringListLocalInteractions(
    config.module,
    renderSecondaryButton(
      '列设置',
      { prefix: 'pcs-engineering', action: 'open-column-settings' },
      'settings-2',
    ),
  )

  return `
    <div class="min-w-0 max-w-full" data-pcs-engineering-list-module="${config.module}">
      ${renderStandardListPage({
        title: config.title,
        primaryActionsHtml: renderEngineeringListPrimaryActions(config.createLabel, config.createAction),
        feedbackHtml: renderNotice(),
        filtersHtml: withEngineeringListLocalInteractions(config.module, config.filtersHtml),
        statsHtml: `<div data-pcs-engineering-list-region="${config.module}-stats">${withEngineeringListLocalInteractions(config.module, config.statsHtml)}</div>`,
        listTitle: `${config.title}列表`,
        listActionsHtml: columnSettingsButton,
        tableHtml: `<div data-pcs-engineering-list-region="${config.module}-table">${renderEngineeringListTable(config.module, config.columns, view.paging, config.emptyText)}</div>`,
        paginationHtml: `<div data-pcs-engineering-list-region="${config.module}-pagination">${renderEngineeringListPagination(config.module, view.paging)}</div>`,
        overlaysHtml: `
          <div data-pcs-engineering-list-region="${config.module}-column-overlay">${renderEngineeringListColumnOverlay(config.module, config.columns)}</div>
          ${config.overlaysHtml || ''}
        `,
        className: 'min-w-0 max-w-full',
      })}
    </div>
  `
}

export function isOverdue(dateTime: string, done: boolean): boolean {
  if (!dateTime || done) return false
  return dateTime.slice(0, 10) < todayText()
}

export function projectButton(projectId: string, projectCode: string, projectName: string): string {
  if (!projectId) return '<span class="text-slate-400">未关联商品项目</span>'
  return `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(projectId)}">${escapeHtml(projectCode || projectName)}</button>`
}

export function hasCompletedProjectRelation(
  sourceModule: string,
  sourceObjectType: string,
  sourceObjectId: string,
): boolean {
  return listProjectRelationsBySourceObject({
    sourceModule,
    sourceObjectType,
    sourceObjectId,
  }).some((relation) => relation.projectId && relation.sourceStatus === '已完成')
}

export function styleArchiveButton(styleId: string, styleCode: string, styleName: string): string {
  if (!styleId) return '<span class="text-slate-400">待选择款式档案</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(styleId)}">${escapeHtml(styleCode || styleName || '查看款式档案')}</button>`
}

export function styleArchiveLinkByProject(projectId: string): string {
  const style = findStyleArchiveByProjectId(projectId)
  if (!style) return '<span class="text-slate-400">待建立</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}">${escapeHtml(style.styleCode)}</button>`
}

export function styleArchiveLink(
  styleId: string,
  styleCode: string,
  styleName: string,
  projectId = '',
): string {
  if (styleId) return styleArchiveButton(styleId, styleCode, styleName)
  if (projectId) return styleArchiveLinkByProject(projectId)
  return '<span class="text-slate-400">未关联款式档案</span>'
}

export function getTaskStyleInfo(task: {
  styleId?: string
  styleCode?: string
  styleName?: string
  projectId: string
  productStyleCode?: string
  spuCode?: string
}): { styleId: string; styleCode: string; styleName: string } {
  if (task.styleId) {
    return {
      styleId: task.styleId,
      styleCode: task.styleCode || task.productStyleCode || task.spuCode || '',
      styleName: task.styleName || '',
    }
  }
  const style = findStyleArchiveByProjectId(task.projectId)
  return {
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || task.styleCode || task.productStyleCode || task.spuCode || '',
    styleName: style?.styleName || task.styleName || '',
  }
}

export function techPackLinkByProject(projectId: string, technicalVersionId: string, fallbackLabel: string): string {
  const style = findStyleArchiveByProjectId(projectId)
  if (!style || !technicalVersionId) return '<span class="text-slate-400">未生成</span>'
  return `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}/technical-data/${escapeHtml(technicalVersionId)}">${escapeHtml(fallbackLabel)}</button>`
}

export function getOwners(items: Array<{ ownerName: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.ownerName).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function getSources(items: Array<{ sourceType: string }>): string[] {
  return Array.from(new Set(items.map((item) => item.sourceType).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function buildStyleArchiveOptions(): Array<{ value: string; label: string }> {
  return listStyleArchives().map((style) => ({
    value: style.styleId,
    label: `${style.styleCode} · ${style.styleName}`,
  }))
}

export function renderListFilters(input: {
  searchPlaceholder: string
  listState: ListState | SampleListState
  searchField: string
  statusField: string
  ownerField: string
  sourceField: string
  statusOptions: readonly string[]
  ownerOptions: readonly string[]
  sourceOptions: readonly string[]
  siteField?: string
  siteOptions?: readonly string[]
}): string {
  const listState = input.listState
  const isSample = 'site' in listState
  return `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-4 ${isSample ? 'xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]' : 'xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]'}">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>搜索</span>
          <input type="search" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="${escapeHtml(input.searchPlaceholder)}" value="${escapeHtml(listState.search)}" data-pcs-engineering-field="${escapeHtml(input.searchField)}" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>状态</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.statusField)}">
            <option value="all" ${listState.status === 'all' ? 'selected' : ''}>全部</option>
            ${input.statusOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.status === option ? 'selected' : ''}>${escapeHtml(getStatusFilterLabel(option))}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>当前需处理的团队</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.ownerField)}">
            <option value="all" ${listState.owner === 'all' ? 'selected' : ''}>全部</option>
            ${input.ownerOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.owner === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>来源</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.sourceField)}">
            <option value="all" ${listState.source === 'all' ? 'selected' : ''}>全部</option>
            ${input.sourceOptions.map((option) => `<option value="${escapeHtml(option)}" ${listState.source === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>
        ${
          isSample && input.siteField && input.siteOptions
            ? `
              <label class="flex flex-col gap-2 text-sm text-slate-600">
                <span>目标站点</span>
                <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-engineering-field="${escapeHtml(input.siteField)}">
                  ${input.siteOptions.map((option) => `<option value="${escapeHtml(option)}" ${String((listState as SampleListState).site) === option ? 'selected' : ''}>${escapeHtml(option === 'all' ? '全部' : option)}</option>`).join('')}
                </select>
              </label>
            `
            : ''
        }
      </div>
    </section>
  `
}

export function renderKeyValueGrid(items: Array<{ label: string; value: string }>, columns = 3): string {
  return `
    <div class="grid gap-4 ${columns === 4 ? 'md:grid-cols-4' : columns === 2 ? 'md:grid-cols-2' : columns === 1 ? 'grid-cols-1' : 'md:grid-cols-3'}">
      ${items.map((item) => `
        <div>
          <p class="text-xs text-slate-500">${escapeHtml(item.label)}</p>
          <div class="mt-1 text-sm text-slate-900">${item.value}</div>
        </div>
      `).join('')}
    </div>
  `
}

export function renderSectionCard(title: string, body: string, subtitle?: string): string {
  return `
    <section class="rounded-xl border bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(subtitle)}</p>` : ''}
        </div>
      </div>
      <div class="mt-4">${body}</div>
    </section>
  `
}

export function renderDialog(open: boolean, title: string, body: string, closeAction: string, submitAction: string, submitLabel: string): string {
  if (!open) return ''
  return `
    <div class="fixed inset-0 z-40">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-engineering-action="${escapeHtml(closeAction)}" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full max-w-2xl flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
            </div>
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" data-pcs-engineering-action="${escapeHtml(closeAction)}" aria-label="关闭侧栏">×</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${body}</div>
        <div class="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="${escapeHtml(closeAction)}">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-engineering-action="${escapeHtml(submitAction)}">${escapeHtml(submitLabel)}</button>
        </div>
      </aside>
    </div>
  `
}

export function splitLines(value: string): string[] {
  return value.split(/\n|,|，|、/).map((item) => item.trim()).filter(Boolean)
}

export function renderLogs(logs: EngineeringLog[]): string {
  return `
    <div class="space-y-3">
      ${logs.map((log) => `
        <div class="rounded-lg border border-slate-200 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-slate-900">${escapeHtml(log.action)}</span>
              <span class="text-xs text-slate-500">${escapeHtml(log.user)}</span>
            </div>
            <span class="text-xs text-slate-500">${escapeHtml(formatDateTime(log.time))}</span>
          </div>
          <p class="mt-2 text-sm text-slate-600">${escapeHtml(log.detail)}</p>
        </div>
      `).join('')}
    </div>
  `
}

export function renderEmptyDetail(title: string, listPath: string): string {
  return `
    <div class="space-y-5 p-4">
      <section class="rounded-xl border bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-slate-900">${escapeHtml(title)}不存在</h1>
            <p class="mt-1 text-sm text-slate-500">未找到对应记录，请返回列表重新选择。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(listPath)}">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
        </div>
      </section>
    </div>
  `
}

export function renderHeaderMeta(title: string, subtitle: string, badges: string, actions: string): string {
  return `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-2">${badges}</div>
          <p class="mt-3 text-sm text-slate-500">${escapeHtml(subtitle)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">${actions}</div>
      </div>
    </section>
  `
}

export function renderProjectContext(task: {
  projectId: string
  projectCode: string
  projectName: string
  sourceType: string
  productStyleCode?: string
  spuCode?: string
  styleId?: string
  styleCode?: string
  styleName?: string
}): string {
  const style = getTaskStyleInfo(task)
  return renderSectionCard(
    '项目与来源',
    renderKeyValueGrid(
      [
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '来源类型', value: escapeHtml(task.sourceType) },
        { label: '款式档案', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
        { label: '款式编码', value: escapeHtml(style.styleCode || task.productStyleCode || task.spuCode || '-') },
      ],
      3,
    ),
  )
}

// 供列表分派使用的公共函数（各模块在 pcs-engineering-tasks.ts / pattern-task.ts 中按模块分派）
export function getEngineeringListModule(node: HTMLElement): ModuleKey | null {
  const value = node.dataset.pcsEngineeringListModule
    || node.closest<HTMLElement>('[data-pcs-engineering-list-module]')?.dataset.pcsEngineeringListModule
  return value === 'plate' || value === 'pattern' || value === 'firstSample' || value === 'color' || value === 'purchase' || value === 'techPack'
    ? value
    : null
}

export function refreshEngineeringList(module: ModuleKey, refreshStats = false): void {
  if (typeof document === 'undefined') return
  const columns = getEngineeringListColumns(module)
  const listState = getEngineeringListState(module)
  const view = getEngineeringListView(module, getEngineeringListRows(module), columns, listState)
  const tableHost = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-table"]`)
  const paginationHost = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-pagination"]`)
  if (tableHost) tableHost.innerHTML = renderEngineeringListTable(module, columns, view.paging, getEngineeringListEmptyText(module))
  if (paginationHost) paginationHost.innerHTML = renderEngineeringListPagination(module, view.paging)
  if (refreshStats) {
    const statsHost = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-stats"]`)
    if (statsHost) statsHost.innerHTML = withEngineeringListLocalInteractions(module, renderEngineeringListStats(module))
  }
}

export function refreshEngineeringColumnOverlay(module: ModuleKey): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>(`[data-pcs-engineering-list-region="${module}-column-overlay"]`)
  if (host) host.innerHTML = renderEngineeringListColumnOverlay(module, getEngineeringListColumns(module))
}

// 列表分派钩子：由主文件与 pattern-task.ts 注册各模块的列定义与数据读取
export interface EngineeringListModuleHooks {
  getColumns: () => readonly StandardListColumn<EngineeringListRow>[]
  getRows: () => EngineeringListRow[]
  getState: () => ListState | SampleListState
  getEmptyText: () => string
  getStatsHtml: () => string
}

const engineeringListModuleHooks: Partial<Record<ModuleKey, EngineeringListModuleHooks>> = {}

export function registerEngineeringListModule(module: ModuleKey, hooks: EngineeringListModuleHooks): void {
  engineeringListModuleHooks[module] = hooks
}

export function getEngineeringListColumns(module: ModuleKey): readonly StandardListColumn<EngineeringListRow>[] {
  return engineeringListModuleHooks[module]?.getColumns() || []
}

export function getEngineeringListRows(module: ModuleKey): EngineeringListRow[] {
  return engineeringListModuleHooks[module]?.getRows() || []
}

export function getEngineeringListState(module: ModuleKey): ListState | SampleListState {
  return engineeringListModuleHooks[module]?.getState() || state.plateList
}

export function getEngineeringListEmptyText(module: ModuleKey): string {
  return engineeringListModuleHooks[module]?.getEmptyText() || '暂无数据'
}

export function renderEngineeringListStats(module: ModuleKey): string {
  return engineeringListModuleHooks[module]?.getStatsHtml() || ''
}

// clearListColumnPreferences 转发：供列表设置恢复使用（restore-column-settings 动作）
export function clearEngineeringListPreferences(module: ModuleKey): void {
  const storage = getEngineeringListStorage()
  if (storage) clearListColumnPreferences(storage, ENGINEERING_LIST_STORAGE_KEYS[module])
}
