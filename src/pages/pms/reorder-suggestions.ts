// @page-pattern: list
import { refreshPmsCoreRegion, refreshPmsCoreOverlay, setPmsCoreSavePending, handlePmsCoreListControls, renderPmsCorePagination } from './core-interactions.ts'
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
  updatePmsReorderRemark,
  createPmsReorderSuggestion,
  hydratePmsReorderSuggestionsFromIdb,
} from '../../data/pms/reorder-suggestions.ts'
import { listPmsPurchaseProductCandidates, hydratePmsProductPurchaseOrdersFromIdb, getPmsProductPurchaseOrder } from '../../data/pms/product-purchase-orders.ts'
import { listPmsSuppliers, hydratePmsSuppliersFromIdb } from '../../data/pms/suppliers.ts'
import { listPurchaseWarehouses } from '../../data/pms/canonical-purchase-references.ts'
import { nextPmsActionId } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { handlePmsCommonImageEvent, hydratePmsSurface, renderPmsBusinessImage, renderPmsFeedback, renderPmsOverlayError, renderPmsImagePreview } from './shared.ts'

const EVENT_PREFIX = 'pms-ros'
const ROOT_SELECTOR = '[data-pms-ros-root]'

interface SuggestPageState extends ProcessOrderListControllerState {
  spu: string
  restockMarked: '' | PmsReorderRestockMark
  recent3DaySalesAtLeast: string
  recent5DaySalesAtLeast: string
  stockQtyAtMost: string
  sortBy: '' | 'restockCount' | 'recent3DaySales' | 'recent7DaySales' | 'totalSales'
  markedFrom: string
  markedTo: string
  remarkFilter: string
  selectedSpus: string[]
  overlay:
    | null
    | { kind: 'regular'; spu: string; clientActionId: string; regularQty: number }
    | { kind: 'remark'; spu: string; clientActionId: string; remark: string }
    | { kind: 'create'; clientActionId: string }
    | { kind: 'restock'; spu: string; clientActionId: string }
    | { kind: 'mark'; spu: string; clientActionId: string; value: PmsReorderRestockMark }
    | { kind: 'chart'; spu: string; clientActionId: string; from: string; to: string }
    | { kind: 'orders'; spu: string; clientActionId: string }
  overlayError: string
  feedback: string
  feedbackOk: boolean
  saving: boolean
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
  markedFrom: '', markedTo: '', remarkFilter: '',
  selectedSpus: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  saving: false,
}

function filteredRows(): PmsReorderSuggestion[] {
  return filterPmsReorderSuggestions({
    spu: state.spu,
    restockMarked: state.restockMarked,
    recent3DaySalesAtLeast: state.recent3DaySalesAtLeast ? Number(state.recent3DaySalesAtLeast) : undefined,
    recent5DaySalesAtLeast: state.recent5DaySalesAtLeast ? Number(state.recent5DaySalesAtLeast) : undefined,
    stockQtyAtMost: state.stockQtyAtMost ? Number(state.stockQtyAtMost) : undefined,
    sortBy: state.sortBy || undefined,
    markedFrom: state.markedFrom, markedTo: state.markedTo, remark: state.remarkFilter,
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
      return `<input type="checkbox" data-preserve-native-click="true" aria-label="选择 ${escapeHtml(row.spu)}" data-${EVENT_PREFIX}-field="select-row" data-spu="${escapeHtml(row.spu)}" ${checked ? 'checked' : ''} data-skip-page-rerender="true" />`
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
      return `<div class="flex flex-wrap items-center justify-end gap-1.5"><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-remark" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">备注</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="toggle-mark" data-spu="${escapeHtml(row.spu)}" data-mark-action="${markAction}" data-skip-page-rerender="true">${markLabel}</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-regular" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">设置常备数量</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:text-slate-300" data-${EVENT_PREFIX}-action="act-restock" data-spu="${escapeHtml(row.spu)}" ${isMarked ? '' : 'disabled'}>备货</button><button type="button" class="rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-chart" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">销量曲线图</button>${row.createdPurchaseOrderNos?.length?`<button type="button" class="rounded px-1.5 py-1 text-xs text-blue-700" data-${EVENT_PREFIX}-action="open-orders" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">关联采购单</button>`:''}</div>`
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
  const advancedCount = [state.recent3DaySalesAtLeast, state.recent5DaySalesAtLeast, state.stockQtyAtMost, state.sortBy,state.markedFrom,state.markedTo,state.remarkFilter].filter((v) => v !== '').length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">SPU</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="款号" value="${escapeHtml(state.spu)}" data-${EVENT_PREFIX}-field="spu" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">是否备货款</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="restockMarked" data-skip-page-rerender="true">${restockOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">近3天销量大于</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" step="1" value="${escapeHtml(state.recent3DaySalesAtLeast)}" data-${EVENT_PREFIX}-field="recent3DaySalesAtLeast" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">近5天销量大于</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" step="1" value="${escapeHtml(state.recent5DaySalesAtLeast)}" data-${EVENT_PREFIX}-field="recent5DaySalesAtLeast" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">库存数量小于</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="number" min="0" step="1" value="${escapeHtml(state.stockQtyAtMost)}" data-${EVENT_PREFIX}-field="stockQtyAtMost" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">排序</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="sortBy" data-skip-page-rerender="true">${sortOptions}</select></label>
    ${[['markedFrom','标记开始'],['markedTo','标记结束'],['remarkFilter','商品备注']].map(([key,label])=>`<label><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input type="${key==='remarkFilter'?'text':'date'}" class="h-9 w-full rounded border px-2 text-sm" value="${escapeHtml(state[key as 'markedFrom'|'markedTo'|'remarkFilter'])}" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true" /></label>`).join('')}
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}

    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const items = [
    { label: '款式总数', value: rows.length },
    { label: '已标记备货', value: rows.filter((r) => r.restockMarked === '已标记').length },
    { label: '总销量', value: rows.reduce((sum, r) => sum + r.totalSales, 0) },
    { label: '常备总量', value: rows.reduce((sum,row)=>sum+row.regularRestockQty,0) },
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

function renderReorderExtraOverlay(overlay: Exclude<NonNullable<SuggestPageState['overlay']>,{kind:'regular'|'remark'}>): string {
  const row='spu' in overlay?listPmsReorderSuggestions().find(item=>item.spu===overlay.spu):undefined
  let title='',body='',submit=''
  if(overlay.kind==='create') {
    title='新增备货SPU';const existing=new Set(listPmsReorderSuggestions().map(item=>item.spu))
    body=`<label class="block text-sm">商品<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-create-spu data-skip-page-rerender="true"><option value="">请选择</option>${listPmsPurchaseProductCandidates().filter(item=>!existing.has(item.spu)).map(item=>`<option value="${escapeHtml(item.spu)}">${escapeHtml(item.spu)} · ${escapeHtml(item.productName)}</option>`).join('')}</select></label><label class="block text-sm">常备数量（件）<input type="number" min="0" step="1" value="0" class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-create-qty data-skip-page-rerender="true" /></label><label class="block text-sm">备注<textarea class="mt-1 min-h-20 w-full rounded border p-2" data-${EVENT_PREFIX}-create-note data-skip-page-rerender="true"></textarea></label>`
    submit='submit-create'
  } else if(overlay.kind==='mark') {
    title=overlay.value==='已标记'?'标记备货':'取消备货标记'
    body=`<p class="text-sm">${escapeHtml(row?.productName??'')} · ${escapeHtml(overlay.spu)}。${overlay.value==='未标记'?'取消后此款不能继续发起备货采购。':'标记后可以分配SKU数量生成备货采购单。'}</p>`
    submit='submit-mark'
  } else if(overlay.kind==='restock') {
    title='备货采购';const product=listPmsPurchaseProductCandidates().find(item=>item.spu===overlay.spu)
    body=`<div class="flex items-center gap-3">${renderPmsBusinessImage(product?.imageUrl??row?.imageUrl??'',product?.productName??row?.productName??'','h-14 w-14')}<div>${escapeHtml(row?.productName??'')}<div class="text-xs text-slate-500">${escapeHtml(overlay.spu)}</div></div></div><div class="flex items-end gap-2"><label class="flex-1 text-sm">备货数量（件）<input type="number" min="1" step="1" value="${row?.regularRestockQty||row?.suggestedRestockQty||10}" class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-restock-total data-skip-page-rerender="true" /></label>${renderSecondaryButton('分配数量',{prefix:EVENT_PREFIX,action:'distribute-restock'},'split')}</div><div class="grid grid-cols-2 gap-3"><label class="text-sm">供应商<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-restock-supplier data-skip-page-rerender="true"><option value="">请选择</option>${listPmsSuppliers().filter(item=>item.status==='已启用').map(item=>`<option value="${escapeHtml(item.supplierName)}">${escapeHtml(item.supplierName)}</option>`).join('')}</select></label><label class="text-sm">目标仓库<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-restock-warehouse data-skip-page-rerender="true">${listPurchaseWarehouses().filter(item=>item.businessType==='FINISHED').map(item=>`<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}</select></label></div><div class="overflow-x-auto rounded border"><table class="w-full text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-2">选择</th><th class="p-2">SKU / 颜色 / 尺码</th><th class="p-2">采购数量（件）</th><th class="p-2">采购单价（CNY）</th></tr></thead><tbody>${product?.skus.map(line=>`<tr class="border-t"><td class="p-2"><input type="checkbox" data-preserve-native-click="true" checked aria-label="选择${escapeHtml(line.sku)}" data-${EVENT_PREFIX}-restock-select="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td><td class="p-2"><div class="flex gap-2">${renderPmsBusinessImage(line.imageUrl,`${line.sku} ${line.color} ${line.size}`,'h-10 w-10')}<div>${escapeHtml(line.sku)}<div class="text-xs text-slate-500">${escapeHtml(line.color)}/${escapeHtml(line.size)}</div></div></div></td><td class="p-2"><input type="number" min="0" step="1" value="0" class="h-9 w-24 rounded border px-2" data-${EVENT_PREFIX}-restock-qty="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td><td class="p-2"><input type="number" min="0" step="0.01" value="${line.price}" class="h-9 w-24 rounded border px-2" data-${EVENT_PREFIX}-restock-price="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td></tr>`).join('')??'<tr><td class="p-4" colspan="4">此款暂无有效SKU</td></tr>'}</tbody></table></div><p class="text-sm" data-pms-ros-allocation-result>分配后核对各SKU数量。</p><label class="block text-sm">备注<textarea class="mt-1 min-h-20 w-full rounded border p-2" data-${EVENT_PREFIX}-restock-note data-skip-page-rerender="true">${escapeHtml(row?.remark??'')}</textarea></label>`
    submit='submit-restock'
  } else if(overlay.kind==='orders') {
    title='关联采购单'
    body=(row?.createdPurchaseOrderNos??[]).map(no=>{const order=getPmsProductPurchaseOrder(no);return `<article class="rounded border p-3 text-sm"><strong>${escapeHtml(no)}</strong><p>${escapeHtml(order?.productName??'采购单未读取')} · ${escapeHtml(order?.status??'')}</p><p>${order?.lines.reduce((sum,line)=>sum+line.qty,0)??0}件</p></article>`}).join('')||'<p class="text-sm text-slate-500">此款还未生成备货采购单。</p>'
  } else {
    title='销量分析'
    const history=(row?.salesHistory??[]).filter(point=>(!overlay.from||point.date>=overlay.from)&&(!overlay.to||point.date<=overlay.to))
    const chart=(key:'qty'|'amount',label:string,color:string)=>{const max=Math.max(1,...history.map(point=>point[key]));const points=history.map((point,index)=>`${40+index*600/Math.max(1,history.length-1)},${180-point[key]/max*140}`).join(' ');return `<section><h3 class="mb-2 text-sm font-medium">${label}</h3><svg viewBox="0 0 680 220" role="img" aria-label="${label}" class="w-full"><line x1="40" y1="180" x2="640" y2="180" stroke="#cbd5e1"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>${history.map((point,index)=>`<text x="${40+index*600/Math.max(1,history.length-1)}" y="205" text-anchor="middle" font-size="11">${point.date.slice(5)}</text>`).join('')}</svg></section>`}
    body=`<div class="flex flex-wrap items-end gap-2"><label class="text-sm">开始日期<input type="date" value="${overlay.from}" class="ml-2 h-9 rounded border px-2" data-${EVENT_PREFIX}-chart-from data-skip-page-rerender="true" /></label><label class="text-sm">结束日期<input type="date" value="${overlay.to}" class="ml-2 h-9 rounded border px-2" data-${EVENT_PREFIX}-chart-to data-skip-page-rerender="true" /></label>${renderSecondaryButton('搜索',{prefix:EVENT_PREFIX,action:'search-chart'},'search')}</div>${history.length?chart('qty','销量（件）','#2563eb')+chart('amount','销售额（CNY）','#0f766e'):'<p class="text-sm text-slate-500">当前日期范围暂无销量记录。</p>'}<table class="w-full text-sm"><thead><tr><th class="text-left">日期</th><th>销量（件）</th><th>销售额（CNY）</th></tr></thead><tbody>${history.map(point=>`<tr class="border-t"><td class="py-2">${point.date}</td><td class="text-center">${point.qty}</td><td class="text-center">${point.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table>`
  }
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="${title}"><button class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" aria-label="关闭" data-skip-page-rerender="true"></button><section class="relative z-10 flex h-full w-[800px] max-w-[96vw] flex-col bg-white"><header class="flex items-center justify-between border-b p-4"><h2 class="font-semibold">${title}</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}${body}</div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton(submit?'取消':'关闭',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${submit?renderPrimaryButton(overlay.kind==='restock'?'生成商品采购单':overlay.kind==='mark'?title:'创建备货款',{prefix:EVENT_PREFIX,action:submit},'check'):''}</footer></section></div>`
}

function refreshReorderRegions(): void {
  const root=rootElement()
  refreshPmsCoreRegion(root,'[data-pms-ros-filters]',renderFilters())
  refreshPmsCoreRegion(root,'[data-pms-ros-stats]',renderStats())
  refreshPmsCoreRegion(root,'[data-pms-ros-feedback]',renderPmsFeedback(state.feedback,state.feedbackOk))
  controller.refresh({overlays:false});refreshReorderOverlays();syncSelectionButtons()
}
function refreshReorderOverlays(): void {
  refreshPmsCoreOverlay(rootElement(),'[data-pms-ros-overlays]',renderOverlays(),state.overlay?.clientActionId??'',state.saving)
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-ros-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings + renderPmsImagePreview()
  if (!["regular","remark"].includes(state.overlay.kind)) return `${columnSettings}${renderReorderExtraOverlay(state.overlay as Exclude<NonNullable<SuggestPageState['overlay']>,{kind:'regular'|'remark'}>)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'regular') {
    const clientActionId = state.overlay.clientActionId
    return `${columnSettings}${renderRegularOverlay(state.overlay.spu, state.overlay.regularQty, clientActionId)}`
  }
  if(state.overlay.kind!=='remark') return columnSettings
  const clientActionId = state.overlay.clientActionId
  return `${columnSettings}${renderRemarkOverlay(state.overlay.spu, state.overlay.remark, clientActionId)}${renderPmsImagePreview()}`
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: true,
    title: '备货列表',
    primaryActionsHtml: renderPrimaryButton('新增备货SPU', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus'),
    feedbackHtml: `<div data-pms-ros-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-pms-ros-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-pms-ros-stats>${stats}</div>`,
    listTitle: `共 ${filteredRows().length} 条${state.selectedSpus.length ? ` · 已选 ${state.selectedSpus.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-ros-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-ros-pagination-surface>${renderPmsCorePagination(view.paginationHtml, EVENT_PREFIX, state.currentPage)}</div>`,
    overlaysHtml: `<div data-pms-ros-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.getAttribute(`data-${EVENT_PREFIX}-field`)
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
    case 'markedFrom': state.markedFrom=value;break
    case 'markedTo': state.markedTo=value;break
    case 'remarkFilter': state.remarkFilter=value;break
  }
}

async function handleActionEvent(target: HTMLElement): Promise<void> {
  const action = target.getAttribute(`data-${EVENT_PREFIX}-action`)
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
      state.sortBy = '';state.markedFrom='';state.markedTo='';state.remarkFilter=''
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    }
    case 'export': {
      const rows = filteredRows()
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
      state.overlay={kind:'create',clientActionId:nextPmsActionId('reorder-create')};state.overlayError=''
      break
    case 'open-regular': {
      const spu = target.dataset.spu ?? ''
      state.overlay = { kind: 'regular', spu, clientActionId: `ros-${Date.now()}`, regularQty: listPmsReorderSuggestions().find(row=>row.spu===spu)?.regularRestockQty??0 }
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
        state.saving=true;setPmsCoreSavePending(rootElement(),true)
        await updatePmsReorderRegularQty(state.overlay.spu, value, state.overlay.clientActionId)
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
        state.saving=true;setPmsCoreSavePending(rootElement(),true)
        if (row) await updatePmsReorderRemark(row.spu,value,overlay.clientActionId)
        state.feedback = `已保存 ${overlay.spu} 备注`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'toggle-mark': {
      const spu=target.dataset.spu??'';const value=target.dataset.markAction==='mark'?'已标记':'未标记'
      state.overlay={kind:'mark',spu,value,clientActionId:nextPmsActionId('reorder-mark')};state.overlayError='';break
    }
    case 'act-restock': { state.overlay={kind:'restock',spu:target.dataset.spu??'',clientActionId:nextPmsActionId('reorder-restock')};state.overlayError='';break }
    case 'close-overlay':
      state.overlay = null
      state.overlayError = ''
      break
  }
}

function handleChangeEvent(target: HTMLElement): void {
  if (target.getAttribute(`data-${EVENT_PREFIX}-field`) === 'select-row') {
    const spu = target.dataset.spu ?? ''
    if (target instanceof HTMLInputElement && target.checked) {
      if (!state.selectedSpus.includes(spu)) state.selectedSpus.push(spu)
    } else {
      state.selectedSpus = state.selectedSpus.filter((s) => s !== spu)
    }
    syncSelectionButtons()
  }
}

export async function renderPmsReorderSuggestionsPage(): Promise<string> {
  try { await Promise.all([hydratePmsReorderSuggestionsFromIdb(),hydratePmsProductPurchaseOrdersFromIdb(),hydratePmsSuppliersFromIdb()]) }
  catch(error) {state.feedback=error instanceof Error?error.message:'备货资料不可读取，当前为固定演示记录';state.feedbackOk=false}
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-ros-root data-skip-page-rerender="true">${renderBody()}</div>`
}

export async function handlePmsReorderSuggestionsEvent(target: HTMLElement,event?: Event): Promise<boolean> {
  const root=rootElement()
  if(!root||!root.contains(target)) return false
  if(target.closest('summary'))return true
 if(state.saving) return true
  if(handlePmsCommonImageEvent(target,event,refreshReorderOverlays)) return true
  if(handlePmsCoreListControls(target,EVENT_PREFIX,state,controller,refreshReorderOverlays)) return true
  if(handleProcessFilterPresentation(root,target)) return true
  if(event?.type==='keydown'&&event instanceof KeyboardEvent&&event.key==='Escape'&&state.overlay){state.overlay=null;state.overlayError='';refreshReorderOverlays();return true}
  const field=target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field]`)
  if(field){
    const name=field.getAttribute(`data-${EVENT_PREFIX}-field`)
    if(name==='select-row'){handleChangeEvent(field);return true}
    if(name==='selection-scope'){
      const scope=(field as HTMLSelectElement).value
      state.selectedSpus=scope==='clear'?[]:scope==='page'?[...root.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`)].map(input=>input.dataset.spu??''):filteredRows().map(row=>row.spu)
      controller.refresh({overlays:false});syncSelectionButtons();return true
    }
    handleFieldEvent(field);return true
  }
  const node=target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action=node?.getAttribute(`data-${EVENT_PREFIX}-action`)
  if(!node||!action)return false
  if(action==='toggle-page'){
    const checked=node instanceof HTMLInputElement&&node.checked
    const ids=[...root.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`)].map(input=>input.dataset.spu??'')
    state.selectedSpus=checked?[...new Set([...state.selectedSpus,...ids])]:state.selectedSpus.filter(id=>!ids.includes(id))
    controller.refresh({overlays:false});syncSelectionButtons();return true
  }
  if(action==='open-chart'||action==='open-orders'){
    const spu=node.dataset.spu??''
    state.overlay=action==='open-chart'?{kind:'chart',spu,clientActionId:nextPmsActionId('reorder-chart'),from:'2026-10-07',to:'2026-10-13'}:{kind:'orders',spu,clientActionId:nextPmsActionId('reorder-orders')}
    state.overlayError='';refreshReorderOverlays();return true
  }
  if(action==='search-chart'&&state.overlay?.kind==='chart'){
    state.overlay.from=root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-chart-from]`)?.value??''
    state.overlay.to=root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-chart-to]`)?.value??''
    state.overlayError=state.overlay.from&&state.overlay.to&&state.overlay.from>state.overlay.to?'开始日期不能晚于结束日期':''
    refreshReorderOverlays();return true
  }
  if(action==='distribute-restock'&&state.overlay?.kind==='restock'){
    const total=Number(root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-total]`)?.value)
    const selected=[...root.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-select]:checked`)]
    if(!Number.isInteger(total)||total<=0||!selected.length){state.overlayError='请填写正整数备货数量并选择SKU';refreshReorderOverlays();return true}
    root.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-qty]`).forEach(input=>{input.value='0'})
    selected.forEach((checkbox,index)=>{
      const sku=checkbox.getAttribute(`data-${EVENT_PREFIX}-restock-select`)??''
      const input=root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-qty="${CSS.escape(sku)}"]`)
      if(input)input.value=String(Math.floor(total/selected.length)+(index<total%selected.length?1:0))
    })
    state.overlayError=''
    const result=root.querySelector<HTMLElement>('[data-pms-ros-allocation-result]')
    if(result)result.textContent=`已分配${total}件至${selected.length}个SKU，请核对各SKU数量。`
    return true
  }
  if(['submit-create','submit-mark','submit-restock'].includes(action)){
    const overlay=state.overlay
    if(!overlay)return true
    state.saving=true;setPmsCoreSavePending(root,true)
    try{
      if(action==='submit-create'&&overlay.kind==='create'){
        const spu=root.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-create-spu]`)?.value??''
        const qty=Number(root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-qty]`)?.value)
        const note=root.querySelector<HTMLTextAreaElement>(`[data-${EVENT_PREFIX}-create-note]`)?.value??''
        await createPmsReorderSuggestion(spu,qty,note,overlay.clientActionId);state.feedback='备货款已创建'
      }else if(action==='submit-mark'&&overlay.kind==='mark'){
        await updatePmsReorderMark(overlay.spu,overlay.value,overlay.clientActionId);state.feedback=overlay.value==='已标记'?'已标记备货':'已取消备货标记'
      }else if(action==='submit-restock'&&overlay.kind==='restock'){
        const lines=[...root.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-select]:checked`)].map(input=>{
          const sku=input.getAttribute(`data-${EVENT_PREFIX}-restock-select`)??''
          return {sku,qty:Number(root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-qty="${CSS.escape(sku)}"]`)?.value),price:Number(root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-restock-price="${CSS.escape(sku)}"]`)?.value)}
        })
        const result=await actPmsReorder({spu:overlay.spu,operationId:overlay.clientActionId,lines,supplierName:root.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-restock-supplier]`)?.value??'',warehouse:root.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-restock-warehouse]`)?.value??'',remark:root.querySelector<HTMLTextAreaElement>(`[data-${EVENT_PREFIX}-restock-note]`)?.value??''})
        state.feedback=`已生成商品采购单${result.createdPurchaseOrderNos?.at(-1)??''}`
      }else return true
      state.overlay=null;state.feedbackOk=true;state.overlayError='';refreshReorderRegions()
    }catch(error){state.overlayError=error instanceof Error?error.message:'当前输入未保存'}
    finally{state.saving=false;refreshReorderOverlays()}
    return true
  }
  try{await handleActionEvent(node)}
  catch(error){state.overlayError=error instanceof Error?error.message:'操作未保存'}
  finally{state.saving=false}
  if(action==='query'||action==='reset'||action==='export'||action==='submit-regular'||action==='submit-remark')refreshReorderRegions()
  else refreshReorderOverlays()
  return true
}

export function closePmsReorderSuggestionsOverlays(): boolean {
  if(state.saving||!state.overlay)return false
  state.overlay=null;state.overlayError='';refreshReorderOverlays();return true
}
