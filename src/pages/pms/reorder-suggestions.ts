// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsReorderRestockMark,
  type PmsReorderSuggestion,
  actPmsReorder,
  filterPmsReorderSuggestions,
  listPmsReorderSuggestions,
  totalPmsReorderRestockQty,
  updatePmsReorderMark,
  updatePmsReorderRegularQty,
} from '../../data/pms/reorder-suggestions.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsBusinessImage, renderPmsFeedback, renderPmsOverlayError } from './shared.ts'

const EVENT_PREFIX = 'pms-ros'
const ROOT_SELECTOR = '[data-pms-ros-root]'

interface SuggestPageState extends ProcessOrderListControllerState {
  spu: string
  restockMarked: '' | PmsReorderRestockMark
  recent3DaySalesAtLeast: string
  recent5DaySalesAtLeast: string
  stockQtyAtMost: string
  sortBy: '' | 'restockCount' | 'recent3DaySales' | 'recent7DaySales' | 'totalSales'
  selectedSpus: string[]
  overlay:
    | null
    | { kind: 'regular'; spu: string; clientActionId: string; regularQty: number }
    | { kind: 'remark'; spu: string; clientActionId: string; remark: string }
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const state: SuggestPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  spu: '',
  restockMarked: '',
  recent3DaySalesAtLeast: '',
  recent5DaySalesAtLeast: '',
  stockQtyAtMost: '',
  sortBy: '',
  selectedSpus: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsReorderSuggestion[] {
  return filterPmsReorderSuggestions({
    spu: state.spu,
    restockMarked: state.restockMarked,
    recent3DaySalesAtLeast: state.recent3DaySalesAtLeast ? Number(state.recent3DaySalesAtLeast) : undefined,
    recent5DaySalesAtLeast: state.recent5DaySalesAtLeast ? Number(state.recent5DaySalesAtLeast) : undefined,
    stockQtyAtMost: state.stockQtyAtMost ? Number(state.stockQtyAtMost) : undefined,
    sortBy: state.sortBy || undefined,
  })
}

const columns: StandardListColumn<PmsReorderSuggestion>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.map((r) => r.spu), new Set(state.selectedSpus), EVENT_PREFIX),
    render: (row) => {
      const checked = state.selectedSpus.includes(row.spu)
      return `<input type="checkbox" aria-label="选择 ${escapeHtml(row.spu)}" data-${EVENT_PREFIX}-field="select-row" data-spu="${escapeHtml(row.spu)}" ${checked ? 'checked' : ''} data-skip-page-rerender="true" />`
    },
  },
  {
    key: 'product',
    title: 'SPU',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.spu,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.imageUrl, `${row.productName} 款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.spu)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.productName)}</div></div></div>`,
  },
  {
    key: 'restockCount',
    title: '翻单次数',
    width: 88,
    sortable: true,
    sortValue: (row) => row.restockCount,
    render: (row) => `<span class="tabular-nums">${row.restockCount}</span>`,
  },
  {
    key: 'restockMarked',
    title: '是否备货款',
    width: 110,
    render: (row) => row.restockMarked === '已标记'
      ? '<span class="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">是</span>'
      : '<span class="inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">否</span>',
  },
  {
    key: 'purchasingQty',
    title: '采购中数量',
    width: 100,
    render: (row) => `<span class="tabular-nums">${row.purchasingQty}</span>`,
  },
  {
    key: 'auditQty',
    title: '待审核数量',
    width: 100,
    render: (row) => `<span class="tabular-nums">${row.auditQty}</span>`,
  },
  {
    key: 'stockQty',
    title: '库存',
    width: 80,
    render: (row) => `<span class="tabular-nums">${row.stockQty}</span>`,
  },
  {
    key: 'pendingDeliveryAndPackQty',
    title: '待发货+待打单',
    width: 130,
    render: (row) => `<span class="tabular-nums">${row.pendingDeliveryAndPackQty}</span>`,
  },
  {
    key: 'restockQty',
    title: '备货数量',
    width: 160,
    render: (row) => `<div class="space-y-1 text-xs"><div>常备数量 <strong class="tabular-nums">${row.regularRestockQty}</strong></div><div>建议备货数量 <strong class="tabular-nums">${row.suggestedRestockQty}</strong></div></div>`,
  },
  {
    key: 'totalSales',
    title: '总销量',
    width: 88,
    sortable: true,
    sortValue: (row) => row.totalSales,
    render: (row) => `<span class="tabular-nums">${row.totalSales}</span>`,
  },
  {
    key: 'recentSales',
    title: '近3/5/7天销量',
    width: 130,
    sortable: true,
    sortValue: (row) => row.recent7DaySales,
    render: (row) => `<span class="tabular-nums">${row.recent3DaySales}/${row.recent5DaySales}/${row.recent7DaySales}</span>`,
  },
  {
    key: 'remark',
    title: '备注',
    width: 140,
    render: (row) => row.remark ? `<span class="text-xs text-slate-600">${escapeHtml(row.remark)}</span>` : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    actionColumn: true,
    render: (row) => {
      const isMarked = row.restockMarked === '已标记'
      const markAction = isMarked ? 'unmark' : 'mark'
      const markLabel = isMarked ? '取消标记' : '标记备货'
      return `<div class="flex flex-wrap items-center justify-end gap-1.5"><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-remark" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">备注</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="toggle-mark" data-spu="${escapeHtml(row.spu)}" data-mark-action="${markAction}" data-skip-page-rerender="true">${markLabel}</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-regular" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">设置常备数量</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:text-slate-300" data-${EVENT_PREFIX}-action="act-restock" data-spu="${escapeHtml(row.spu)}" ${isMarked ? '' : 'disabled'}>备货</button></div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/reorder',
  pageSizeOptions: [10, 20, 50, 100],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-ros-table-surface]',
  paginationSurfaceSelector: '[data-pms-ros-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-ros-overlays]',
  defaultFrozenKeys: ['product'],
  columnSettingsTitle: '备货列表列设置',
  emptyText: '当前条件下暂无备货参考',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function syncSelectionButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="act-restock-selected"]`).forEach((button) => {
    button.disabled = state.selectedSpus.length === 0
  })
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedSpus.length ? ` · 已选 ${state.selectedSpus.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const restockOptions = ['', '已标记', '未标记']
    .map((value) => `<option value="${value}" ${state.restockMarked === value ? 'selected' : ''}>${value || '全部'}</option>`)
    .join('')
  const sortOptions = [
    { value: '', label: '默认' },
    { value: 'restockCount', label: '翻单次数' },
    { value: 'recent3DaySales', label: '近3天销量' },
    { value: 'recent7DaySales', label: '近7天销量' },
    { value: 'totalSales', label: '总销量' },
  ].map((opt) => `<option value="${opt.value}" ${state.sortBy === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')
  const advancedCount = [state.recent3DaySalesAtLeast, state.recent5DaySalesAtLeast, state.stockQtyAtMost, state.sortBy].filter((v) => v !== '').length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">SPU</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="款号" value="${escapeHtml(state.spu)}" data-${EVENT_PREFIX}-field="spu" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">是否备货款</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="restockMarked" data-skip-page-rerender="true">${restockOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">近3天销量大于</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" step="1" value="${escapeHtml(state.recent3DaySalesAtLeast)}" data-${EVENT_PREFIX}-field="recent3DaySalesAtLeast" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">近5天销量大于</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" step="1" value="${escapeHtml(state.recent5DaySalesAtLeast)}" data-${EVENT_PREFIX}-field="recent5DaySalesAtLeast" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">库存数量小于</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" step="1" value="${escapeHtml(state.stockQtyAtMost)}" data-${EVENT_PREFIX}-field="stockQtyAtMost" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">排序</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="sortBy" data-skip-page-rerender="true">${sortOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('新增备货SPU', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const items = [
    { label: '款式总数', value: rows.length },
    { label: '已标记备货', value: rows.filter((r) => r.restockMarked === '已标记').length },
    { label: '总销量', value: rows.reduce((sum, r) => sum + r.totalSales, 0) },
    { label: '常备总量', value: totalPmsReorderRestockQty() },
  ]
  return renderProcessOrderStats(items)
}

function renderRegularOverlay(spu: string, regularQty: number, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="设置常备数量"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[480px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">设置常备数量</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(spu)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">常备数量
      <input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" value="${regularQty}" data-${EVENT_PREFIX}-regular-qty="1" data-skip-page-rerender="true" />
    </label>
    </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-ros-regular="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存', { prefix: EVENT_PREFIX, action: 'submit-regular' }, 'check-check')}</footer></section></div>`
}

function renderRemarkOverlay(spu: string, remark: string, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="备货备注"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[480px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">备货备注</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(spu)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">备注
      <textarea class="min-h-32 rounded-md border bg-background p-2 text-sm" placeholder="选填,例如紧急备货原因" data-${EVENT_PREFIX}-remark-input="1" data-skip-page-rerender="true">${escapeHtml(remark)}</textarea>
    </label>
    </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-ros-remark="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存', { prefix: EVENT_PREFIX, action: 'submit-remark' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-ros-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  if (state.overlay.kind === 'regular') {
    const clientActionId = state.overlay.clientActionId
    return `${columnSettings}${renderRegularOverlay(state.overlay.spu, state.overlay.regularQty, clientActionId)}`
  }
  const clientActionId = state.overlay.clientActionId
  return `${columnSettings}${renderRemarkOverlay(state.overlay.spu, state.overlay.remark, clientActionId)}`
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: false,
    title: '备货列表',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: stats,
    listTitle: `共 ${filteredRows().length} 条${state.selectedSpus.length ? ` · 已选 ${state.selectedSpus.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-ros-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-ros-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-ros-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.dataset[`${EVENT_PREFIX}Field`]
  if (!field) return
  if (field === 'select-row') return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'spu': state.spu = value; break
    case 'restockMarked': state.restockMarked = value as '' | PmsReorderRestockMark; break
    case 'recent3DaySalesAtLeast': state.recent3DaySalesAtLeast = value; break
    case 'recent5DaySalesAtLeast': state.recent5DaySalesAtLeast = value; break
    case 'stockQtyAtMost': state.stockQtyAtMost = value; break
    case 'sortBy': state.sortBy = value as SuggestPageState['sortBy']; break
  }
}

function handleActionEvent(target: HTMLElement): void {
  const action = target.dataset[`${EVENT_PREFIX}Action`]
  if (!action) return
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset': {
      state.spu = ''
      state.restockMarked = ''
      state.recent3DaySalesAtLeast = ''
      state.recent5DaySalesAtLeast = ''
      state.stockQtyAtMost = ''
      state.sortBy = ''
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    }
    case 'export': {
      const rows = listPmsReorderSuggestions()
      downloadPmsCsv(
        'higood-pms-reorder-suggestions.csv',
        ['SPU', '款号', '翻单次数', '是否备货款', '采购中', '待审核', '库存', '待发货+待打单', '常备数量', '建议备货数量', '总销量', '近3/5/7天销量', '备注'],
        rows.map((r) => [r.spu, r.productName, r.restockCount, r.restockMarked, r.purchasingQty, r.auditQty, r.stockQty, r.pendingDeliveryAndPackQty, r.regularRestockQty, r.suggestedRestockQty, `${r.recent3DaySales}/${r.recent5DaySales}/${r.recent7DaySales}`, r.totalSales, r.remark]),
      )
      state.feedback = '已导出备货参考 CSV'
      state.feedbackOk = true
      break
    }
    case 'open-create':
      state.feedback = '新增备货 SPU 由 manage.higood.ai 后台处理,原型暂以 mock 数据演示'
      state.feedbackOk = true
      break
    case 'open-regular': {
      const spu = target.dataset.spu ?? ''
      state.overlay = { kind: 'regular', spu, clientActionId: `ros-${Date.now()}`, regularQty: 0 }
      state.overlayError = ''
      break
    }
    case 'open-remark': {
      const spu = target.dataset.spu ?? ''
      const row = listPmsReorderSuggestions().find((r) => r.spu === spu)
      state.overlay = { kind: 'remark', spu, clientActionId: `ros-${Date.now()}`, remark: row?.remark ?? '' }
      state.overlayError = ''
      break
    }
    case 'submit-regular': {
      if (!state.overlay || state.overlay.kind !== 'regular') return
      const overlayEl = document.querySelector<HTMLElement>(`[data-pms-ros-regular="${state.overlay.clientActionId}"]`)
      const qtyEl = overlayEl?.parentElement?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-regular-qty]`)
      const value = Number(qtyEl?.value ?? '0')
      try {
        updatePmsReorderRegularQty(state.overlay.spu, value)
        state.feedback = `已更新 ${state.overlay.spu} 常备数量为 ${value}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'submit-remark': {
      if (!state.overlay || state.overlay.kind !== 'remark') return
      const overlayEl = document.querySelector<HTMLElement>(`[data-pms-ros-remark="${state.overlay.clientActionId}"]`)
      const remarkEl = overlayEl?.parentElement?.querySelector<HTMLTextAreaElement>(`[data-${EVENT_PREFIX}-remark-input]`)
      const value = remarkEl?.value ?? ''
      try {
        const overlay = state.overlay
        if (overlay.kind !== 'remark') return
        const row = listPmsReorderSuggestions().find((r) => r.spu === overlay.spu)
        if (row) row.remark = value
        state.feedback = `已保存 ${overlay.spu} 备注`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'toggle-mark': {
      const spu = target.dataset.spu ?? ''
      const markAction = target.dataset.markAction ?? 'mark'
      try {
        updatePmsReorderMark(spu, markAction === 'mark' ? '已标记' : '未标记')
        state.feedback = markAction === 'mark' ? `已将 ${spu} 标记为备货款` : `已取消 ${spu} 备货标记`
        state.feedbackOk = true
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '标记失败'
      }
      break
    }
    case 'act-restock': {
      const spu = target.dataset.spu ?? ''
      try {
        actPmsReorder({ spu })
        state.feedback = `已为 ${spu} 触发备货,生成商品采购单(原型仅留痕,真实生成由 manage.higood.ai 处理)`
        state.feedbackOk = true
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '备货失败'
      }
      break
    }
    case 'close-overlay':
      state.overlay = null
      state.overlayError = ''
      break
  }
}

function handleChangeEvent(target: HTMLElement): void {
  if (target.dataset[`${EVENT_PREFIX}Field`] === 'select-row') {
    const spu = target.dataset.spu ?? ''
    if (target instanceof HTMLInputElement && target.checked) {
      if (!state.selectedSpus.includes(spu)) state.selectedSpus.push(spu)
    } else {
      state.selectedSpus = state.selectedSpus.filter((s) => s !== spu)
    }
    syncSelectionButtons()
  }
}

export function renderPmsReorderSuggestionsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = renderBody()
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
    syncSelectionButtons()
  })
  return html
}

export function handlePmsReorderSuggestionsEvent(event: Event): void {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable || !rootElement()?.contains(actionable)) return
  if (actionable.dataset[`${EVENT_PREFIX}Action`]) {
    handleActionEvent(actionable)
  } else if (actionable.dataset[`${EVENT_PREFIX}Field`]) {
    if (event.type === 'change') handleChangeEvent(actionable)
    else handleFieldEvent(actionable)
  }
}

export function closePmsReorderSuggestionsOverlays(): void {
  state.overlay = null
  state.overlayError = ''
}
