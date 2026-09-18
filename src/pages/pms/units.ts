// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  createPmsUnit,
  getPmsUnit,
  listPmsUnits,
  togglePmsUnitStatus,
  updatePmsUnit,
  type PmsUnit,
  type PmsUnitCategory,
  type PmsUnitInput,
} from '../../data/pms/units.ts'
import { PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, readNumberField, readTextField, renderPmsFeedback, renderPmsOverlayError, renderPmsStatusBadge } from './shared.ts'

type UnitOverlay = null | { kind: 'form'; unitCode: string } | { kind: 'toggle'; unitCode: string }

interface UnitPageState extends ProcessOrderListControllerState {
  keyword: string
  category: '' | PmsUnitCategory
  status: '' | '启用' | '停用'
  overlay: UnitOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-unit'
const ROOT_SELECTOR = '[data-pms-unit-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }

const state: UnitPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  category: '',
  status: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsUnit[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsUnits().filter((unit) => {
    if (state.category && unit.category !== state.category) return false
    if (state.status && unit.status !== state.status) return false
    if (!keyword) return true
    return [unit.unitCode, unit.unitName, unit.symbol, unit.remark].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsUnit>[] = [
  {
    key: 'unit',
    title: '单位',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.unitName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.unitName)}（${escapeHtml(row.symbol)}）</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.unitCode)} · ${escapeHtml(row.category)}</div>`,
  },
  {
    key: 'precision',
    title: '精度',
    width: 120,
    sortable: true,
    sortValue: (row) => row.precision,
    render: (row) => `<div class="text-sm">${row.precision} 位小数</div>`,
  },
  {
    key: 'conversion',
    title: '换算',
    width: 240,
    render: (row) => {
      const base = row.baseUnitCode ? getPmsUnit(row.baseUnitCode) : undefined
      return `<div class="text-sm">${escapeHtml(row.conversionRate || '基本单位')}</div>${base ? `<div class="mt-1 text-xs text-slate-500">基准：${escapeHtml(base.unitName)}（${escapeHtml(base.symbol)}）</div>` : ''}`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '启用' ? 'green' : 'slate'),
  },
  {
    key: 'remark',
    title: '备注',
    width: 200,
    render: (row) => `<div class="text-xs text-slate-600">${escapeHtml(row.remark || '—')}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 190,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-edit" data-unit-code="${escapeHtml(row.unitCode)}" data-skip-page-rerender="true">编辑</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="toggle" data-unit-code="${escapeHtml(row.unitCode)}" data-skip-page-rerender="true">${row.status === '启用' ? '停用' : '启用'}</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/units',
  pageSizeOptions: [10, 20, 50, 100],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-unit-table-surface]',
  paginationSurfaceSelector: '[data-pms-unit-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-unit-overlays]',
  defaultFrozenKeys: ['unit'],
  columnSettingsTitle: '单位列设置',
  emptyText: '当前条件下暂无单位',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const categories: Array<'' | PmsUnitCategory> = ['', '长度', '重量', '数量', '包装', '面积', '体积']
  const categoryOptions = categories.map((value) => `<option value="${value}" ${state.category === value ? 'selected' : ''}>${value || '全部类别'}</option>`).join('')
  const statusOptions = ['', '启用', '停用'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="编码 / 名称 / 缩写" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">类别</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="category" data-skip-page-rerender="true">${categoryOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderPrimaryButton('新增单位', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">单位字典不提供删除，仅支持启停</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '单位总数', value: rows.length },
    { label: '启用单位', value: rows.filter((row) => row.status === '启用').length },
    { label: '数量类', value: rows.filter((row) => row.category === '数量').length },
    { label: '含换算关系', value: rows.filter((row) => Boolean(row.conversionRate)).length },
  ])
}

function renderFormOverlay(unitCode: string): string {
  const unit = unitCode ? getPmsUnit(unitCode) : undefined
  const categories: PmsUnitCategory[] = ['长度', '重量', '数量', '包装', '面积', '体积']
  const baseOptions = [`<option value="">无（基本单位）</option>`, ...listPmsUnits().filter((row) => row.unitCode !== unitCode).map((row) => `<option value="${escapeHtml(row.unitCode)}" ${unit?.baseUnitCode === row.unitCode ? 'selected' : ''}>${escapeHtml(row.unitName)}（${escapeHtml(row.symbol)}）</option>`)].join('')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="单位表单" data-pms-unit-form-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">${unit ? `编辑 ${escapeHtml(unit.unitCode)}` : '新增单位'}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">单位名称<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(unit?.unitName ?? '')}" data-${EVENT_PREFIX}-form-field="unitName" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">缩写<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(unit?.symbol ?? '')}" data-${EVENT_PREFIX}-form-field="symbol" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">类别<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-form-field="category" data-skip-page-rerender="true">${categories.map((value) => `<option value="${value}" ${unit?.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">小数位<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" max="4" step="1" value="${unit?.precision ?? 0}" data-${EVENT_PREFIX}-form-field="precision" data-skip-page-rerender="true" /></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">基准单位<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-form-field="baseUnitCode" data-skip-page-rerender="true">${baseOptions}</select></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">换算说明<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 1打=12件" value="${escapeHtml(unit?.conversionRate ?? '')}" data-${EVENT_PREFIX}-form-field="conversionRate" data-skip-page-rerender="true" /></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(unit?.remark ?? '')}" data-${EVENT_PREFIX}-form-field="remark" data-skip-page-rerender="true" /></label>
    </div>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${unit ? renderPrimaryButton('保存修改', { prefix: EVENT_PREFIX, action: 'submit-form' }, 'check-check') : renderPrimaryButton('创建单位', { prefix: EVENT_PREFIX, action: 'submit-form' }, 'plus')}</footer></section></div>`
}

function renderToggleOverlay(unitCode: string): string {
  const unit = getPmsUnit(unitCode)
  const nextStatus = unit?.status === '启用' ? '停用' : '启用'
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="单位启停确认" data-pms-unit-toggle-root><section class="w-full max-w-md rounded-xl bg-background p-5 shadow-2xl"><h2 class="font-semibold">${nextStatus}单位</h2><p class="mt-2 text-sm text-slate-600">确认${nextStatus} <strong>${escapeHtml(unit?.unitName ?? unitCode)}</strong>？单位字典不提供删除，停用不影响历史单据。</p><footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${nextStatus === '停用' ? renderDangerButton(`确认${nextStatus}`, { prefix: EVENT_PREFIX, action: 'confirm-toggle' }, 'check-check') : renderPrimaryButton(`确认${nextStatus}`, { prefix: EVENT_PREFIX, action: 'confirm-toggle' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-unit-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  if (state.overlay.kind === 'form') return `${columnSettings}${renderFormOverlay(state.overlay.unitCode)}`
  return `${columnSettings}${renderToggleOverlay(state.overlay.unitCode)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '单位管理',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-unit-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-unit-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-unit-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-unit-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function readForm(surface: HTMLElement): PmsUnitInput {
  return {
    unitName: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="unitName"]`),
    symbol: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="symbol"]`),
    category: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="category"]`) as PmsUnitCategory,
    precision: readNumberField(surface, `[data-${EVENT_PREFIX}-form-field="precision"]`),
    baseUnitCode: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="baseUnitCode"]`),
    conversionRate: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="conversionRate"]`),
    remark: readTextField(surface, `[data-${EVENT_PREFIX}-form-field="remark"]`),
  }
}

function submitForm(unitCode: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-unit-form-root]')
  if (!surface) return
  try {
    if (unitCode) {
      updatePmsUnit(unitCode, readForm(surface), BUYER)
      state.feedback = `已保存单位 ${unitCode}。`
    } else {
      const unit = createPmsUnit(readForm(surface), BUYER)
      state.feedback = `已创建单位 ${unit.unitCode}。`
    }
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存单位失败，请检查填写内容'
    refreshOverlays()
  }
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的单位。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '单位字典.csv',
    ['单位编码', '单位名称', '缩写', '类别', '小数位', '基准单位', '换算', '状态', '备注'],
    rows.map((row) => [row.unitCode, row.unitName, row.symbol, row.category, row.precision, row.baseUnitCode, row.conversionRate, row.status, row.remark]),
  )
  state.feedback = `已导出 ${rows.length} 个单位（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsUnitsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-unit-root data-skip-page-rerender="true"><style>[data-pms-unit-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsUnitOverlays(): boolean {
  if (state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsUnitsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsUnitField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'category') {
      state.category = field.value as UnitPageState['category']
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as UnitPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsUnitAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.category = ''
    state.status = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-unit-column-key]')?.dataset.pmsUnitColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-create') {
    state.overlay = { kind: 'form', unitCode: '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    state.overlay = { kind: 'form', unitCode: actionNode?.dataset.unitCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'toggle') {
    state.overlay = { kind: 'toggle', unitCode: actionNode?.dataset.unitCode || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'submit-form') {
    if (state.overlay?.kind === 'form') submitForm(state.overlay.unitCode)
    return true
  }
  if (action === 'confirm-toggle') {
    if (state.overlay?.kind !== 'toggle') return true
    try {
      const unit = togglePmsUnitStatus(state.overlay.unitCode, BUYER)
      state.feedback = `单位 ${unit.unitName} 已${unit.status}。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '启停失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  return false
}
