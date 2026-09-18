// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import type { AppState } from '../../../state/store'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type LabelTemplate = { name: string; sourceSystem: string; scene: string; processType: string; materialType: string; factoryType: string; size: string; qrRule: string; packageRule: string; status: 'ENABLED' | 'DISABLED'; updated: string }

const seedTemplates: LabelTemplate[] = [
  { name: '成衣出库标签', sourceSystem: 'WMS', scene: '出库', processType: '打包', materialType: '成衣', factoryType: '成衣仓', size: '100×150mm', qrRule: '{shipNo}|{orderNo}', packageRule: 'PKG-{YYYYMMDD}-{SEQ4}', status: 'ENABLED', updated: '2026-08-20 10:00' },
  { name: '退货收货标签', sourceSystem: 'WMS', scene: '退货', processType: '收货', materialType: '成衣', factoryType: '成衣仓', size: '100×150mm', qrRule: '{returnNo}|{lineSku}', packageRule: 'RET-{YYYYMMDD}-{SEQ3}', status: 'ENABLED', updated: '2026-08-22 14:00' },
  { name: '中转仓入库标签', sourceSystem: 'WMS-TRANSIT', scene: '入库', processType: '收货', materialType: '面辅料', factoryType: '中转仓', size: '80×120mm', qrRule: '{inboundNo}', packageRule: 'TR-IN-{YYYYMMDD}-{SEQ3}', status: 'ENABLED', updated: '2026-08-25 09:00' },
  { name: '原料仓领料标签', sourceSystem: 'WMS-RAW', scene: '领料', processType: '发料', materialType: '面料', factoryType: '原料仓', size: '80×120mm', qrRule: '{reqNo}|{sku}', packageRule: 'RAW-REQ-{YYYYMMDD}-{SEQ3}', status: 'DISABLED', updated: '2026-08-26 11:00' },
]

const EVENT_PREFIX = 'wls-basic-label-config'
const PREFERENCE_KEY = '/wls/finished/basic-label-config:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  sourceFilter: '' as string,
  sceneFilter: '' as string,
  statusFilter: '' as string,
}

const columns: StandardListColumn<LabelTemplate>[] = [
  { key: 'name', title: '模板名称', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.name,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.name)}</span>` },
  { key: 'sourceSystem', title: '来源系统', width: 130, sortable: true, sortValue: r => r.sourceSystem,
    render: r => `<span class="text-slate-600">${escapeHtml(r.sourceSystem)}</span>` },
  { key: 'scene', title: '业务场景', width: 100, sortable: true, sortValue: r => r.scene,
    render: r => `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">${escapeHtml(r.scene)}</span>` },
  { key: 'processType', title: '工序类型', width: 100, sortable: true, sortValue: r => r.processType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.processType)}</span>` },
  { key: 'materialType', title: '物料类型', width: 100, sortable: true, sortValue: r => r.materialType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.materialType)}</span>` },
  { key: 'factoryType', title: '工厂类型', width: 100, sortable: true, sortValue: r => r.factoryType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.factoryType)}</span>` },
  { key: 'size', title: '标签尺寸', width: 110, sortable: true, sortValue: r => r.size,
    render: r => `<span class="text-slate-600">${escapeHtml(r.size)}</span>` },
  { key: 'qrRule', title: '二维码规则', width: 180, sortable: true, sortValue: r => r.qrRule,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.qrRule)}</span>` },
  { key: 'packageRule', title: '包装号规则', width: 200, sortable: true, sortValue: r => r.packageRule,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.packageRule)}</span>` },
  { key: 'status', title: '状态', width: 80, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.status === 'ENABLED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${r.status === 'ENABLED' ? '启用' : '停用'}</span>` },
  { key: 'updated', title: '更新时间', width: 150, sortable: true, sortValue: r => r.updated,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.updated)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="edit">编辑</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="preview">预览</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['name'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): LabelTemplate[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedTemplates.filter(t => {
    if (state.sourceFilter && t.sourceSystem !== state.sourceFilter) return false
    if (state.sceneFilter && t.scene !== state.sceneFilter) return false
    if (state.statusFilter && t.status !== state.statusFilter) return false
    if (!kw) return true
    return t.name.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索模板名称" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">来源系统</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="source"><option value="">全部来源系统</option><option value="WMS" ${state.sourceFilter === 'WMS' ? 'selected' : ''}>WMS</option><option value="WMS-TRANSIT" ${state.sourceFilter === 'WMS-TRANSIT' ? 'selected' : ''}>WMS-TRANSIT</option><option value="WMS-RAW" ${state.sourceFilter === 'WMS-RAW' ? 'selected' : ''}>WMS-RAW</option></select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">业务场景</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="scene"><option value="">全部业务场景</option><option value="出库" ${state.sceneFilter === '出库' ? 'selected' : ''}>出库</option><option value="入库" ${state.sceneFilter === '入库' ? 'selected' : ''}>入库</option><option value="退货" ${state.sceneFilter === '退货' ? 'selected' : ''}>退货</option><option value="领料" ${state.sceneFilter === '领料' ? 'selected' : ''}>领料</option></select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option><option value="ENABLED" ${state.statusFilter === 'ENABLED' ? 'selected' : ''}>启用</option><option value="DISABLED" ${state.statusFilter === 'DISABLED' ? 'selected' : ''}>停用</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '标签配置',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '启用', value: `${seedTemplates.filter(t => t.status === 'ENABLED').length} 条` },
      { label: '停用', value: `${seedTemplates.filter(t => t.status === 'DISABLED').length} 条` },
    ]),
    listTitle: '标签模板列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('新增模板', { prefix: EVENT_PREFIX, action: 'add' }, 'plus')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无标签模板' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '标签配置列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

export function renderBasicLabelConfig(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleBasicLabelConfigEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'source') { state.sourceFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'scene') { state.sceneFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'status') { state.statusFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.preferences.pageSize = Number((field as HTMLSelectElement).value)
      state.currentPage = 1
      saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const sourceSelect = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="source"]`)
    if (sourceSelect) state.sourceFilter = sourceSelect.value
    const sceneSelect = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="scene"]`)
    if (sceneSelect) state.sceneFilter = sceneSelect.value
    const statusSelect = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (statusSelect) state.statusFilter = statusSelect.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.sourceFilter = ''
    state.sceneFilter = ''
    state.statusFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  return false
}
