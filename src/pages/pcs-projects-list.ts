// @page-pattern: list

import { renderSecondaryButton } from '../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../components/ui/list-table.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  getChannelNamesByCodes,
  listProjectListRecords,
  type PcsProjectListRecord,
} from '../data/pcs-project-list-store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type ProjectDateRange = '全部时间' | '今天' | '最近一周' | '最近一月'

interface ProjectListState {
  search: string
  status: string
  owner: string
  phase: string
  riskStatus: string
  dateRange: ProjectDateRange
  pendingDecisionOnly: boolean
  advancedOpen: boolean
  currentPage: number
  pageSize: number
}

interface ProjectListViewModel {
  project: PcsProjectListRecord
  channelNames: string[]
}

const PROJECT_STATUS_OPTIONS = ['全部', '已立项', '进行中', '已终止', '已归档']
const RISK_STATUS_OPTIONS = ['全部', '正常', '延期']
const DATE_RANGE_OPTIONS: ProjectDateRange[] = ['全部时间', '今天', '最近一周', '最近一月']
const PROJECT_LIST_STORAGE_KEY = 'higood:list-page:/pcs/projects'
const PROJECT_LIST_PAGE_SIZES = [8, 20, 50]
const PROJECT_LIST_MAX_FROZEN_WIDTH = 520
const PROJECT_LIST_COLUMN_RULES = [
  { key: 'project', required: true, freezeable: true },
  { key: 'image' },
  { key: 'code', freezeable: true },
  { key: 'category' },
  { key: 'style' },
  { key: 'phase', required: true, freezeable: true },
  { key: 'progress' },
  { key: 'risk', required: true, freezeable: true },
  { key: 'owner', freezeable: true },
  { key: 'updated', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]

const initialState: ProjectListState = {
  search: '',
  status: '全部',
  owner: '全部负责人',
  phase: '全部阶段',
  riskStatus: '全部',
  dateRange: '全部时间',
  pendingDecisionOnly: false,
  advancedOpen: false,
  currentPage: 1,
  pageSize: PROJECT_LIST_PAGE_SIZES[0]!,
}

const state: { list: ProjectListState } = {
  list: { ...initialState },
}

const projectListUiState: {
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  preferencesLoaded: boolean
} = {
  sort: null,
  preferences: normalizeListColumnPreferences(
    PROJECT_LIST_COLUMN_RULES,
    {
      order: PROJECT_LIST_COLUMN_RULES.map((rule) => rule.key),
      visibleKeys: PROJECT_LIST_COLUMN_RULES.map((rule) => rule.key),
      frozenKeys: [],
      pageSize: PROJECT_LIST_PAGE_SIZES[0]!,
    },
    PROJECT_LIST_PAGE_SIZES,
  ),
  columnSettingsOpen: false,
  draggedColumnKey: '',
  preferencesLoaded: false,
}

function getProjectStatusBadgeClass(status: PcsProjectListRecord['projectStatus']): string {
  if (status === '已立项') return 'bg-blue-100 text-blue-700'
  if (status === '进行中') return 'bg-emerald-100 text-emerald-700'
  if (status === '已终止') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function buildProjectListViewModels(): ProjectListViewModel[] {
  return listProjectListRecords().map((project) => ({
    project,
    channelNames: getChannelNamesByCodes(project.targetChannelCodes),
  }))
}

function matchesDateRange(updatedAt: string, range: ProjectDateRange): boolean {
  if (range === '全部时间') return true
  const targetDate = new Date(updatedAt.replace(' ', 'T'))
  if (Number.isNaN(targetDate.getTime())) return false
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === '今天') return targetDate >= todayStart
  const from = new Date(todayStart)
  from.setDate(from.getDate() - (range === '最近一周' ? 6 : 29))
  return targetDate >= from
}

function getFilteredProjects(): ProjectListViewModel[] {
  const keyword = state.list.search.trim().toLowerCase()
  return buildProjectListViewModels()
    .filter((item) => {
      const project = item.project
      if (state.list.status !== '全部' && project.projectStatus !== state.list.status) return false
      if (state.list.owner !== '全部负责人' && project.ownerName !== state.list.owner) return false
      if (state.list.phase !== '全部阶段' && (project.currentPhaseName || '-') !== state.list.phase) return false
      if (state.list.riskStatus !== '全部' && project.riskStatus !== state.list.riskStatus) return false
      if (state.list.pendingDecisionOnly && !project.pendingDecisionFlag) return false
      if (!matchesDateRange(project.updatedAt, state.list.dateRange)) return false
      if (!keyword) return true
      return [
        project.projectName,
        project.projectCode,
        project.categoryName,
        project.subCategoryName,
        project.brandName,
        project.ownerName,
        project.currentPhaseName,
        project.nextWorkItemName,
        ...project.styleTagNames,
        ...item.channelNames,
      ].join('|').toLowerCase().includes(keyword)
    })
    .sort((left, right) => right.project.updatedAt.localeCompare(left.project.updatedAt))
}

function buildOwnerOptions(projects: ProjectListViewModel[]): string[] {
  return ['全部负责人', ...Array.from(new Set(projects.map((item) => item.project.ownerName).filter(Boolean)))]
}

function buildPhaseOptions(projects: ProjectListViewModel[]): string[] {
  return ['全部阶段', ...Array.from(new Set(projects.map((item) => item.project.currentPhaseName || '-')))]
}

function renderProjectProgress(item: ProjectListViewModel): string {
  const project = item.project
  const percent = project.progressTotal === 0 ? 0 : Math.round((project.progressDone / project.progressTotal) * 100)
  return `
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="h-2 w-24 rounded-full bg-slate-100">
          <div class="h-2 rounded-full bg-blue-600" style="width:${percent}%"></div>
        </div>
        <span class="text-xs text-slate-500">${project.progressDone}/${project.progressTotal}</span>
      </div>
      ${project.nextWorkItemName && project.nextWorkItemName !== '-'
        ? `<p class="text-xs text-slate-500">下一步：${escapeHtml(project.nextWorkItemName)}${project.nextWorkItemStatus !== '-' ? `（${escapeHtml(project.nextWorkItemStatus)}）` : ''}</p>`
        : '<p class="text-xs text-slate-500">已完成全部节点</p>'}
    </div>
  `
}

function renderProjectCoverImage(item: ProjectListViewModel): string {
  const imageUrl = item.project.mainImageUrl.trim()
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.project.projectName)}" class="h-16 w-12 rounded-md object-cover ring-1 ring-slate-200" loading="eager" referrerpolicy="no-referrer" />`
  }
  return '<div class="flex h-16 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-100 text-[10px] text-slate-400">图片</div>'
}

const PROJECT_LIST_COLUMNS: StandardListColumn<ProjectListViewModel>[] = [
  {
    key: 'project',
    title: '项目名称',
    width: 260,
    required: true,
    freezeable: true,
    sortable: true,
    render: (item) => `
      <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">${escapeHtml(item.project.projectName)}</button>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span class="inline-flex rounded-full px-2 py-0.5 ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(item.project.projectStatus)}</span>
        ${item.project.pendingDecisionFlag ? '<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">待决策</span>' : ''}
      </div>
    `,
    sortValue: (item) => item.project.projectName,
  },
  { key: 'image', title: '图片', width: 80, render: (item) => renderProjectCoverImage(item) },
  { key: 'code', title: '项目编码', width: 150, freezeable: true, sortable: true, render: (item) => escapeHtml(item.project.projectCode), sortValue: (item) => item.project.projectCode },
  {
    key: 'category',
    title: '分类',
    width: 160,
    render: (item) => `<p>${escapeHtml(item.project.categoryName)}</p><p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.subCategoryName || '-')}</p>`,
  },
  {
    key: 'style',
    title: '风格',
    width: 180,
    render: (item) => `<div class="flex flex-wrap gap-1">${item.project.styleTagNames.length
      ? item.project.styleTagNames.map((tag) => `<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(tag)}</span>`).join('')
      : '<span class="text-slate-400">-</span>'}</div>`,
  },
  {
    key: 'phase',
    title: '当前阶段',
    width: 180,
    required: true,
    freezeable: true,
    sortable: true,
    render: (item) => `<p>${escapeHtml(item.project.currentPhaseName || '-')}</p><p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.nextWorkItemName || '无待执行节点')}</p>`,
    sortValue: (item) => item.project.currentPhaseName || '',
  },
  { key: 'progress', title: '项目进度', width: 190, render: (item) => renderProjectProgress(item) },
  {
    key: 'risk',
    title: '风险',
    width: 180,
    required: true,
    freezeable: true,
    sortable: true,
    render: (item) => `
      <div class="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${item.project.riskStatus === '延期' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}">
        <span class="h-1.5 w-1.5 rounded-full ${item.project.riskStatus === '延期' ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
        ${escapeHtml(item.project.riskStatus)}
      </div>
      ${item.project.riskReason ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(item.project.riskReason)}</p>` : ''}
    `,
    sortValue: (item) => item.project.riskStatus === '延期' ? 1 : 0,
  },
  { key: 'owner', title: '负责人', width: 130, freezeable: true, sortable: true, render: (item) => escapeHtml(item.project.ownerName), sortValue: (item) => item.project.ownerName },
  { key: 'updated', title: '最近更新', width: 170, freezeable: true, sortable: true, render: (item) => escapeHtml(formatDateTime(item.project.updatedAt)), sortValue: (item) => item.project.updatedAt },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    render: (item) => `<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">查看</button>`,
  },
]

function getProjectListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function normalizeProjectListPreferences(
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(PROJECT_LIST_COLUMN_RULES, raw, PROJECT_LIST_PAGE_SIZES)
  const columnsByKey = new Map(PROJECT_LIST_COLUMNS.map((column) => [column.key, column]))
  const visibleKeys = new Set(normalized.visibleKeys)
  const requestedFrozen = new Set(normalized.frozenKeys)
  const frozen = normalized.order
    .map((key) => columnsByKey.get(key))
    .filter((column): column is StandardListColumn<ProjectListViewModel> => Boolean(
      column && column.freezeable && !column.actionColumn && visibleKeys.has(column.key) && requestedFrozen.has(column.key),
    ))
  let width = frozen.reduce((sum, column) => sum + Math.max(column.width, column.minWidth ?? 0), 0)
  while (width > PROJECT_LIST_MAX_FROZEN_WIDTH && frozen.length > 0) {
    const removed = frozen.pop()
    if (removed) width -= Math.max(removed.width, removed.minWidth ?? 0)
  }
  return { ...normalized, frozenKeys: frozen.map((column) => column.key) }
}

function ensureProjectListPreferences(): void {
  if (projectListUiState.preferencesLoaded) return
  projectListUiState.preferencesLoaded = true
  const storage = getProjectListStorage()
  projectListUiState.preferences = storage
    ? loadListColumnPreferences(
        storage,
        PROJECT_LIST_STORAGE_KEY,
        PROJECT_LIST_COLUMN_RULES,
        projectListUiState.preferences,
        PROJECT_LIST_PAGE_SIZES,
      )
    : projectListUiState.preferences
  projectListUiState.preferences = normalizeProjectListPreferences(projectListUiState.preferences)
  state.list.pageSize = projectListUiState.preferences.pageSize
}

function saveProjectListPreferences(): void {
  const storage = getProjectListStorage()
  if (storage) saveListColumnPreferences(storage, PROJECT_LIST_STORAGE_KEY, projectListUiState.preferences)
}

function withLocalInteractions(html: string): string {
  return html
    .replace(/data-pcs-project-list-action="([^"]+)"/g, (attribute, action: string) => {
      const localActions = new Set([
        'query',
        'reset-list',
        'toggle-advanced',
        'set-status-filter',
        'set-risk-filter',
        'toggle-pending-decision',
        'sort-column',
        'prev-page',
        'next-page',
        'open-column-settings',
        'close-column-settings',
        'restore-column-settings',
        'toggle-column-visibility',
        'toggle-column-freeze',
      ])
      return localActions.has(action)
        ? `data-skip-page-rerender="true" data-pcs-project-list-root="true" ${attribute}`
        : attribute
    })
    .replace(/data-pcs-project-list-field="([^"]+)"/g, (attribute) =>
      `data-skip-page-rerender="true" data-pcs-project-list-root="true" ${attribute}`)
}

function getStandardProjectListView(): StandardListPageSlice<ProjectListViewModel> {
  ensureProjectListPreferences()
  const sorted = sortStandardListRows(
    getFilteredProjects(),
    projectListUiState.sort,
    (item, key) => PROJECT_LIST_COLUMNS.find((column) => column.key === key)?.sortValue?.(item),
  )
  const paging = paginateStandardListRows(sorted, state.list.currentPage, projectListUiState.preferences.pageSize)
  state.list.currentPage = paging.currentPage
  state.list.pageSize = paging.pageSize
  return paging
}

function renderProjectListTable(paging: StandardListPageSlice<ProjectListViewModel>): string {
  return withLocalInteractions(renderStandardListTable({
    columns: PROJECT_LIST_COLUMNS,
    rows: paging.rows,
    preferences: projectListUiState.preferences,
    sort: projectListUiState.sort,
    eventPrefix: 'pcs-project-list',
    emptyText: '暂无符合条件的商品项目',
  }))
}

function renderProjectListPagination(paging: StandardListPageSlice<ProjectListViewModel>): string {
  return withLocalInteractions(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'pcs-project-list',
    fieldPrefix: 'pcs-project-list',
    pageSizeOptions: PROJECT_LIST_PAGE_SIZES,
  }))
}

function renderProjectColumnSettings(): string {
  if (!projectListUiState.columnSettingsOpen) return ''
  return withLocalInteractions(renderStandardListColumnSettings({
    title: '列设置',
    columns: PROJECT_LIST_COLUMNS,
    preferences: projectListUiState.preferences,
    eventPrefix: 'pcs-project-list',
    maxFrozenWidth: PROJECT_LIST_MAX_FROZEN_WIDTH,
  }))
}

function renderToolbar(filteredCount: number, projects: ProjectListViewModel[]): string {
  const ownerOptions = buildOwnerOptions(projects)
  const phaseOptions = buildPhaseOptions(projects)
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 xl:grid-cols-[minmax(240px,1.5fr)_auto_auto]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索项目</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="搜索项目名称、编码或关键词" value="${escapeHtml(state.list.search)}" data-pcs-project-list-field="list-search" />
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-list-action="query">查询</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-list-action="reset-list">重置筛选</button>
        </div>
        <div class="flex items-end justify-end">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-list-action="toggle-advanced">${state.list.advancedOpen ? '收起高级筛选' : '高级筛选'}</button>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">状态</span>
          ${PROJECT_STATUS_OPTIONS.map((option) => `
            <button type="button" class="${toClassName('inline-flex h-8 items-center rounded-md px-3 text-xs', state.list.status === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}" data-pcs-project-list-action="set-status-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
          `).join('')}
        </div>
        <button type="button" class="${toClassName('inline-flex h-8 items-center rounded-md px-3 text-xs', state.list.pendingDecisionOnly ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}" data-pcs-project-list-action="toggle-pending-decision">待决策</button>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">风险</span>
          ${RISK_STATUS_OPTIONS.map((option) => `
            <button type="button" class="${toClassName('inline-flex h-8 items-center rounded-md px-3 text-xs', state.list.riskStatus === option ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}" data-pcs-project-list-action="set-risk-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
          `).join('')}
        </div>
      </div>
      ${state.list.advancedOpen ? `
        <div class="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
          <label class="space-y-1">
            <span class="text-xs text-slate-500">负责人</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" data-pcs-project-list-field="list-owner">
              ${ownerOptions.map((option) => `<option value="${escapeHtml(option)}" ${state.list.owner === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">当前阶段</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" data-pcs-project-list-field="list-phase">
              ${phaseOptions.map((option) => `<option value="${escapeHtml(option)}" ${state.list.phase === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">最近更新范围</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" data-pcs-project-list-field="list-date-range">
              ${DATE_RANGE_OPTIONS.map((option) => `<option value="${escapeHtml(option)}" ${state.list.dateRange === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
            </select>
          </label>
        </div>
      ` : ''}
      <div class="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p class="text-sm text-slate-500">共 ${filteredCount} 个项目</p>
        <span class="text-xs text-slate-400">点击列标题可排序，列设置可调整显示与冻结</span>
      </div>
    </section>
  `
}

function refreshProjectListRegions(options: { filters?: boolean; settings?: boolean } = {}): void {
  if (typeof document === 'undefined') return
  const paging = getStandardProjectListView()
  const tableHost = document.querySelector<HTMLElement>('[data-pcs-project-list-region="table"]')
  const paginationHost = document.querySelector<HTMLElement>('[data-pcs-project-list-region="pagination"]')
  if (tableHost) tableHost.innerHTML = renderProjectListTable(paging)
  if (paginationHost) paginationHost.innerHTML = renderProjectListPagination(paging)
  if (options.filters) {
    const filtered = getFilteredProjects()
    const filtersHost = document.querySelector<HTMLElement>('[data-pcs-project-list-region="filters"]')
    if (filtersHost) filtersHost.innerHTML = withLocalInteractions(renderToolbar(filtered.length, filtered))
  }
  if (options.settings) {
    const settingsHost = document.querySelector<HTMLElement>('[data-pcs-project-list-region="column-settings"]')
    if (settingsHost) settingsHost.innerHTML = renderProjectColumnSettings()
  }
}

export async function renderPcsProjectListPage(): Promise<string> {
  ensureProjectListPreferences()
  const transient = { currentPage: state.list.currentPage, sort: projectListUiState.sort }
  const hasMountedRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector('[data-pcs-project-list-page]'))
  resetStandardListEntryTransientStateOnRouteEntry(transient, hasMountedRoot)
  state.list.currentPage = transient.currentPage
  projectListUiState.sort = transient.sort

  const allProjects = buildProjectListViewModels()
  const filtered = getFilteredProjects()
  const paging = getStandardProjectListView()
  const page = renderStandardListPage({
    title: '商品项目列表',
    primaryActionsHtml: `
      <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/create">
        <i data-lucide="plus" class="h-4 w-4"></i>新建商品项目
      </button>
    `,
    filtersHtml: `<div data-pcs-project-list-region="filters">${withLocalInteractions(renderToolbar(filtered.length, filtered))}</div>`,
    statsHtml: renderStandardListStats([
      { label: '全部项目', value: allProjects.length },
      { label: '进行中', value: allProjects.filter((item) => item.project.projectStatus === '进行中').length },
      { label: '待决策', value: allProjects.filter((item) => item.project.pendingDecisionFlag).length },
      { label: '延期风险', value: allProjects.filter((item) => item.project.riskStatus === '延期').length },
    ]),
    listTitle: '商品项目',
    listActionsHtml: withLocalInteractions(
      renderSecondaryButton('列设置', { prefix: 'pcs-project-list', action: 'open-column-settings' }, 'settings-2'),
    ),
    tableHtml: `<div data-pcs-project-list-region="table">${renderProjectListTable(paging)}</div>`,
    paginationHtml: `<div data-pcs-project-list-region="pagination">${renderProjectListPagination(paging)}</div>`,
    overlaysHtml: `<div data-pcs-project-list-region="column-settings">${renderProjectColumnSettings()}</div>`,
    className: 'min-w-0 max-w-full',
  })
  return `<div class="min-w-0 max-w-full" data-pcs-project-list-page>${page}</div>`
}

export function handlePcsProjectListInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-list-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsProjectListField
  if (!field) return false

  if (field === 'pageSize' && fieldNode instanceof HTMLSelectElement) {
    projectListUiState.preferences = normalizeProjectListPreferences({
      ...projectListUiState.preferences,
      pageSize: Number(fieldNode.value),
    })
    state.list.currentPage = 1
    state.list.pageSize = projectListUiState.preferences.pageSize
    saveProjectListPreferences()
    refreshProjectListRegions()
    return true
  }
  if (field === 'list-search' && fieldNode instanceof HTMLInputElement) {
    state.list.search = fieldNode.value
    state.list.currentPage = 1
    refreshProjectListRegions()
    return true
  }
  if (field === 'list-owner' && fieldNode instanceof HTMLSelectElement) state.list.owner = fieldNode.value
  else if (field === 'list-phase' && fieldNode instanceof HTMLSelectElement) state.list.phase = fieldNode.value
  else if (field === 'list-date-range' && fieldNode instanceof HTMLSelectElement) state.list.dateRange = fieldNode.value as ProjectDateRange
  else return false
  state.list.currentPage = 1
  refreshProjectListRegions({ filters: true })
  return true
}

export function handlePcsProjectListEvent(target: HTMLElement, event?: Event): boolean {
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop', 'dragend'].includes(event.type)) {
    const columnKey = dragNode.dataset.pcsProjectListColumnKey || dragNode.dataset.dragSource || dragNode.dataset.dropTarget || ''
    if (event.type === 'dragstart') {
      projectListUiState.draggedColumnKey = columnKey
      ;(event as DragEvent).dataTransfer?.setData('application/x-higood-list-column-key', columnKey)
      return Boolean(columnKey)
    }
    if (event.type === 'dragend') {
      projectListUiState.draggedColumnKey = ''
      return true
    }
    const sourceKey = projectListUiState.draggedColumnKey
    if (!sourceKey || !columnKey || sourceKey === columnKey) return false
    if (event.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event.preventDefault()
    const order = projectListUiState.preferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(columnKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    projectListUiState.preferences = normalizeProjectListPreferences({ ...projectListUiState.preferences, order })
    projectListUiState.draggedColumnKey = ''
    saveProjectListPreferences()
    refreshProjectListRegions({ settings: true })
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-project-list-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectListAction
  if (!action) return false

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = PROJECT_LIST_COLUMNS.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    const currentSort = projectListUiState.sort
    projectListUiState.sort = currentSort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : currentSort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.list.currentPage = 1
    refreshProjectListRegions()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredProjects().length / projectListUiState.preferences.pageSize))
    state.list.currentPage = action === 'prev-page'
      ? Math.max(1, state.list.currentPage - 1)
      : Math.min(totalPages, state.list.currentPage + 1)
    refreshProjectListRegions()
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    projectListUiState.columnSettingsOpen = action === 'open-column-settings'
    refreshProjectListRegions({ settings: true })
    return true
  }
  if (action === 'restore-column-settings') {
    projectListUiState.preferences = normalizeProjectListPreferences({
      order: PROJECT_LIST_COLUMNS.map((column) => column.key),
      visibleKeys: PROJECT_LIST_COLUMNS.map((column) => column.key),
      frozenKeys: [],
      pageSize: PROJECT_LIST_PAGE_SIZES[0],
    })
    projectListUiState.sort = null
    state.list.currentPage = 1
    state.list.pageSize = projectListUiState.preferences.pageSize
    const storage = getProjectListStorage()
    if (storage) clearListColumnPreferences(storage, PROJECT_LIST_STORAGE_KEY)
    refreshProjectListRegions({ settings: true })
    return true
  }
  if (
    (action === 'toggle-column-visibility' || action === 'toggle-column-freeze')
    && (!event || event.type === 'change')
  ) {
    const columnKey = actionNode.dataset.pcsProjectListColumnKey || actionNode.dataset.columnKey || ''
    const column = PROJECT_LIST_COLUMNS.find((item) => item.key === columnKey)
    if (!column || column.actionColumn) return true
    const visibleKeys = new Set(projectListUiState.preferences.visibleKeys)
    const frozenKeys = new Set(projectListUiState.preferences.frozenKeys)
    if (action === 'toggle-column-visibility' && !column.required) {
      if (visibleKeys.has(columnKey)) {
        visibleKeys.delete(columnKey)
        frozenKeys.delete(columnKey)
      } else {
        visibleKeys.add(columnKey)
      }
      if (!visibleKeys.has(columnKey) && projectListUiState.sort?.key === columnKey) projectListUiState.sort = null
    }
    if (action === 'toggle-column-freeze' && column.freezeable) {
      if (frozenKeys.has(columnKey)) frozenKeys.delete(columnKey)
      else frozenKeys.add(columnKey)
    }
    projectListUiState.preferences = normalizeProjectListPreferences({
      ...projectListUiState.preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    })
    saveProjectListPreferences()
    refreshProjectListRegions({ settings: true })
    return true
  }
  if (action === 'query') {
    state.list.currentPage = 1
    refreshProjectListRegions({ filters: true })
    return true
  }
  if (action === 'reset-list') {
    state.list = { ...initialState, pageSize: projectListUiState.preferences.pageSize }
    refreshProjectListRegions({ filters: true })
    return true
  }
  if (action === 'toggle-advanced') {
    state.list.advancedOpen = !state.list.advancedOpen
    refreshProjectListRegions({ filters: true })
    return true
  }
  if (action === 'set-status-filter' || action === 'set-risk-filter') {
    if (action === 'set-status-filter') state.list.status = actionNode.dataset.value || '全部'
    else state.list.riskStatus = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    refreshProjectListRegions({ filters: true })
    return true
  }
  if (action === 'toggle-pending-decision') {
    state.list.pendingDecisionOnly = !state.list.pendingDecisionOnly
    state.list.currentPage = 1
    refreshProjectListRegions({ filters: true })
    return true
  }
  return false
}

export function isPcsProjectListDialogOpen(): boolean {
  return projectListUiState.columnSettingsOpen
}
