import { listPmsSuppliers, hydratePmsSuppliersFromIdb } from '../../data/pms/suppliers.ts'
import { listPurchaseWarehouses } from '../../data/pms/canonical-purchase-references.ts'
// @page-pattern: list
import { refreshPmsCoreRegion, refreshPmsCoreOverlay, setPmsCoreSavePending, handlePmsCoreListControls, renderPmsCorePagination } from './core-interactions.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  createPmsProductPurchaseOrders,
  defaultPmsSkuPrice, listPmsPurchaseProductCandidates,
  type PmsCreatePurchaseOrderInput,
} from '../../data/pms/product-purchase-orders.ts'
import {
  getPmsSuggestionView,
  hydratePmsPurchaseSuggestionsFromIdb,
  generatePmsSuggestionPurchases,
  setPmsSuggestionNeedProduction,
  listPmsSuggestionViews,
  markSuggestionConverted,
  type PmsPurchaseType,
  type PmsSuggestionStatus,
  type PmsSuggestionView,
} from '../../data/pms/purchase-suggestions.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  nextPmsClientActionId,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

function suggestionSkuImage(sku:{sku:string;imageUrl?:string}):string{return sku.imageUrl||listPmsPurchaseProductCandidates().flatMap(row=>row.skus).find(row=>row.sku===sku.sku)?.imageUrl||''}

interface GenerateLineDraft {
  suggestionNo: string
  spu: string
  productName: string
  imageUrl: string
  purchaseType: PmsPurchaseType
  area: '国内' | '印尼'
  sku: string
  color: string
  size: string
  qty: number
  price: number
}

interface SuggestPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsSuggestionStatus
  purchaseType: '' | PmsPurchaseType
  searchField: 'spu' | 'sku' | 'name'
  firstOrder: '' | '是' | '否'
  needProduction: '' | '是' | '否'
  minQty: string
  maxQty: string
  selectedSuggestionNos: string[]
  overlay:
    | null
    | { kind: 'detail'; suggestionNo: string; clientActionId: string }
    | { kind: 'generate'; suggestionNos: string[]; clientActionId: string; lines: GenerateLineDraft[] }
    | { kind: 'make'; suggestionNo: string; clientActionId: string; value: boolean }
  overlayError: string
  feedback: string
  feedbackOk: boolean
  saving: boolean
}

const EVENT_PREFIX = 'pms-psk'
const ROOT_SELECTOR = '[data-pms-psk-root]'

export const PMS_SUGGESTION_SUPPLIERS = [
  '广州华盛制衣有限公司',
  '佛山成衣加工厂',
  '中山针织制衣有限公司',
  '苏州户外服饰有限公司',
  '宁波衬衫制造有限公司',
  '杭州女装制衣有限公司',
  '杭州样衣开发中心',
]

export const PMS_SUGGESTION_WAREHOUSES = ['印尼雅加达成品仓', '广州原料仓', '杭州样衣仓']

const state: SuggestPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 5 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  purchaseType: '',
  searchField: 'spu', firstOrder: '', needProduction: '', minQty: '', maxQty: '',
  selectedSuggestionNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  saving: false,
}

function filteredRows(): PmsSuggestionView[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsSuggestionViews().filter((row) => {
    if (state.status && row.status !== state.status) return false
    if (state.purchaseType && row.purchaseType !== state.purchaseType) return false
    if (state.firstOrder && row.firstOrder !== (state.firstOrder === '是')) return false
    if (state.needProduction && row.needProduction !== (state.needProduction === '是')) return false
    if (state.minQty && row.totalAvailableQty < Number(state.minQty)) return false
    if (state.maxQty && row.totalAvailableQty > Number(state.maxQty)) return false
    if (!keyword) return true
    const values = state.searchField === 'spu' ? [row.spu] : state.searchField === 'sku' ? row.skuItems.map(sku => sku.sku) : [row.productName]
    return values.some(value => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsSuggestionStatus): 'blue' | 'green' | 'yellow' | 'slate' {
  if (status === '待生成') return 'yellow'
  if (status === '部分生成') return 'blue'
  if (status === '已生成') return 'green'
  return 'slate'
}

const columns: StandardListColumn<PmsSuggestionView>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.filter((row) => row.totalAvailableQty > 0).map((row) => row.suggestionNo), new Set(state.selectedSuggestionNos), EVENT_PREFIX),
    render: (row) => {
      const disabled = row.totalAvailableQty <= 0 || !row.needProduction
      const checked = state.selectedSuggestionNos.includes(row.suggestionNo)
      return `<input type="checkbox" data-preserve-native-click="true" aria-label="选择 ${escapeHtml(row.productName)}" data-${EVENT_PREFIX}-field="select-row" data-suggestion-no="${escapeHtml(row.suggestionNo)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} data-skip-page-rerender="true" />`
    },
  },
  {
    key: 'suggestion',
    title: '建议单 / 采购类型',
    width: 180,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.suggestionNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.suggestionNo)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.area)} · ${escapeHtml(row.purchaseType)}${row.firstOrder ? ' · 首单' : ''}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.demandLevel)} · 折扣 ${row.skuItems[0]?.discount ?? 1}</div>`,
  },
  {
    key: 'product',
    title: '款式与 SPU',
    width: 220,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.imageUrl, `${row.productName}（${row.spu}）款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.spu)}</div><div class="text-xs text-slate-500">${row.skuItems.length} 个 SKU</div></div></div>`,
  },
  {
    key: 'gap',
    title: '缺口构成',
    width: 210,
    render: (row) => `<div class="space-y-1 text-xs"><div>待发货 <strong>${formatPmsQty(row.totalPendingDeliveryQty, '件')}</strong></div><div>KOL 申请 <strong>${formatPmsQty(row.totalKolApplyQty, '件')}</strong></div><div>采购中 <strong>${formatPmsQty(row.totalPurchasingQty, '件')}</strong></div><div>可用库存 <strong>${formatPmsQty(row.totalStockQty, '件')}</strong></div></div>`,
  },
  {
    key: 'suggested',
    title: '建议采购量',
    width: 170,
    sortable: true,
    sortValue: (row) => row.totalSuggestedQty,
    render: (row) => `<div class="text-base font-semibold tabular-nums">${formatPmsQty(row.totalSuggestedQty, '件')}</div><div class="mt-1 text-xs text-slate-500">待生成 ${formatPmsQty(row.totalAvailableQty, '件')}</div><div class="mt-1 text-xs text-slate-500">已转单 ${row.convertedOrderNos.length ? escapeHtml(row.convertedOrderNos.join('、')) : '—'}</div>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 120,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, statusTone(row.status)),
  },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center justify-end gap-1.5"><button type="button" class="rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-suggestion-no="${escapeHtml(row.suggestionNo)}" data-skip-page-rerender="true">查看SKU</button><button type="button" class="rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:text-slate-400" data-${EVENT_PREFIX}-action="open-generate" data-suggestion-no="${escapeHtml(row.suggestionNo)}" data-skip-page-rerender="true" ${row.totalAvailableQty <= 0 || !row.needProduction ? 'disabled' : ''}>生成商品采购单</button><button type="button" class="rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-make" data-suggestion-no="${escapeHtml(row.suggestionNo)}" data-skip-page-rerender="true">${row.needProduction ? '设置不需要做货' : '恢复做货'}</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/purchase-suggestions',
  pageSizeOptions: [5, 10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-psk-table-surface]',
  paginationSurfaceSelector: '[data-pms-psk-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-psk-overlays]',
  defaultFrozenKeys: ['suggestion', 'product'],
  columnSettingsTitle: '商品采购建议列设置',
  emptyText: '当前条件下暂无采购建议',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function syncSelectionButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="open-generate-selected"]`).forEach((button) => {
    button.disabled = state.selectedSuggestionNos.length === 0
  })
  const countNode = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selected-count]`)
  if (countNode) countNode.textContent = `已选 ${state.selectedSuggestionNos.length} 个款式`
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedSuggestionNos.length ? ` · 已选 ${state.selectedSuggestionNos.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function buildGenerateLines(suggestionNos: string[]): GenerateLineDraft[] {
  const lines: GenerateLineDraft[] = []
  suggestionNos.forEach((suggestionNo) => {
    const view = getPmsSuggestionView(suggestionNo)
    if (!view) return
    view.skuItems
      .filter((sku) => sku.availableQty > 0)
      .forEach((sku) => {
        lines.push({
          suggestionNo,
          spu: view.spu,
          productName: view.productName,
          imageUrl: suggestionSkuImage(sku),
          purchaseType: view.purchaseType,
          area: view.area,
          sku: sku.sku,
          color: sku.color,
          size: sku.size,
          qty: sku.availableQty,
          price: defaultPmsSkuPrice(sku.sku),
        })
      })
  })
  return lines
}

function renderFilters(): string {
  const statusOptions = ['', '待生成', '部分生成', '已生成', '无需采购']
    .map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`)
    .join('')
  const typeOptions = ['', '做货', '成衣', '样衣']
    .map((value) => `<option value="${value}" ${state.purchaseType === value ? 'selected' : ''}>${value || '全部采购类型'}</option>`)
    .join('')
  const advancedCount = [state.purchaseType, state.firstOrder, state.needProduction, state.minQty, state.maxQty].filter(Boolean).length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">检索字段</span><select class="h-9 w-full rounded-md border px-3 text-sm" data-${EVENT_PREFIX}-field="searchField" data-skip-page-rerender="true">${[['spu','SPU'],['sku','SKU'],['name','商品名称']].map(([value,label])=>`<option value="${value}" ${state.searchField===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="建议单号 / 款号 / 款式 / SKU" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">建议状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="purchaseType" data-skip-page-rerender="true">${typeOptions}</select></label>
    ${[['firstOrder','首翻单'],['needProduction','是否需要做货']].map(([key,label])=>`<label><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-9 w-full rounded-md border px-3 text-sm" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true">${['','是','否'].map(value=>`<option value="${value}" ${state[key as 'firstOrder'|'needProduction']===value?'selected':''}>${value||'全部'}</option>`).join('')}</select></label>`).join('')}
    ${[['minQty','建议量最小'],['maxQty','建议量最大']].map(([key,label])=>`<label><span class="mb-1 block text-xs text-muted-foreground">${label}（件）</span><input type="number" min="0" class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state[key as 'minQty'|'maxQty'])}" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true" /></label>`).join('')}
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出SPU商品', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('导出SKU商品', { prefix: EVENT_PREFIX, action: 'export-sku' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const items = [
    { label: '款式总数', value: rows.length },
    { label: '待生成', value: rows.filter((row) => row.status === '待生成').length },
    { label: '部分生成', value: rows.filter((row) => row.status === '部分生成').length },
    { label: '建议采购总量', value: formatPmsQty(rows.reduce((sum, row) => sum + row.totalSuggestedQty, 0), '件') },
  ]
  return renderProcessOrderStats(items)
}

function renderDetailOverlay(suggestionNo: string): string {
  const view = getPmsSuggestionView(suggestionNo)
  if (!view) return ''
  const skuRows = view.skuItems
    .map(
      (sku) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${renderPmsBusinessImage(suggestionSkuImage(sku),`${view.productName} ${sku.color} ${sku.size}`,'h-10 w-10')}<div>${escapeHtml(sku.sku)}</div></td><td class="px-3 py-2 text-sm">${escapeHtml(sku.color)} / ${escapeHtml(sku.size)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(sku.pendingDeliveryQty, '件')}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(sku.kolApplyQty, '件')}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(sku.purchasingQty, '件')}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(sku.stockQty, '件')}</td><td class="px-3 py-2 text-sm font-semibold tabular-nums">${formatPmsQty(sku.gapQty, '件')}</td><td class="px-3 py-2 text-sm font-semibold tabular-nums">${formatPmsQty(sku.suggestedQty, '件')}</td></tr>`,
    )
    .join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="采购建议明细"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭明细"></button><section class="relative z-10 flex h-full w-[720px] max-w-[92vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(view.productName)} · ${escapeHtml(view.spu)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(view.suggestionNo)} · ${escapeHtml(view.purchaseType)} · ${escapeHtml(view.demandLevel)}折扣 ${view.skuItems[0]?.discount ?? 1}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(view.imageUrl, `${view.productName}（${view.spu}）款式图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(view.status, statusTone(view.status))}</dd></div><div><dt class="text-xs text-muted-foreground">建议采购合计</dt><dd class="mt-1 font-semibold tabular-nums">${formatPmsQty(view.totalSuggestedQty, '件')}</dd></div><div><dt class="text-xs text-muted-foreground">已转采购单</dt><dd class="mt-1">${view.convertedOrderNos.length ? escapeHtml(view.convertedOrderNos.join('、')) : '—'}</dd></div><div><dt class="text-xs text-muted-foreground">生成时间</dt><dd class="mt-1 text-xs text-slate-500">${escapeHtml(view.createdAt)}</dd></div></dl></div>
    <div class="overflow-hidden rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">颜色 / 尺码</th><th class="px-3 py-2">待发货</th><th class="px-3 py-2">KOL 申请</th><th class="px-3 py-2">采购中</th><th class="px-3 py-2">库存</th><th class="px-3 py-2">缺口</th><th class="px-3 py-2">建议采购</th></tr></thead><tbody>${skuRows}</tbody></table></div>
    <p class="text-xs text-slate-500">缺口 = max(0, 待发货 + KOL 申请 − 采购中 − 实时库存)；建议采购量 = 向上取整(缺口 × 折扣)。</p>
  </div></section></div>`
}

function renderGenerateOverlay(lines: GenerateLineDraft[], clientActionId: string): string {
  const supplierOptions = listPmsSuppliers().filter(row=>row.status==='已启用').map(row=>row.supplierName).map((supplier) => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join('')
  const warehouseOptions = listPurchaseWarehouses().filter(row=>row.businessType==='FINISHED').map(row=>row.name).map((warehouse) => `<option value="${escapeHtml(warehouse)}">${escapeHtml(warehouse)}</option>`).join('')
  const grouped = new Map<string, GenerateLineDraft[]>()
  lines.forEach((line) => {
    const bucket = grouped.get(line.suggestionNo)
    if (bucket) bucket.push(line)
    else grouped.set(line.suggestionNo, [line])
  })
  const groupsHtml = [...grouped.entries()]
    .map(([suggestionNo, groupLines]) => {
      const first = groupLines[0]
      return `<section class="rounded-lg border"><header class="flex items-center gap-3 border-b bg-muted/40 px-3 py-2"><span class="text-sm font-semibold">${escapeHtml(first.productName)}</span><span class="text-xs text-slate-500">${escapeHtml(first.spu)} · ${escapeHtml(suggestionNo)}</span></header><div class="overflow-x-auto"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th class="w-12 px-3 py-2">选择</th><th class="w-48 px-3 py-2">SKU</th><th class="w-32 px-3 py-2">颜色 / 尺码</th><th class="w-28 px-3 py-2">建议量</th><th class="w-32 px-3 py-2">实际采购数量</th><th class="w-32 px-3 py-2">采购单价</th><th class="w-32 px-3 py-2">金额</th></tr></thead><tbody>${groupLines.map((line) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2"><input type="checkbox" checked data-preserve-native-click="true" aria-label="选择 ${escapeHtml(line.sku)}" data-${EVENT_PREFIX}-gen-select="${escapeHtml(line.sku)}" data-suggestion-no="${escapeHtml(line.suggestionNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2 text-sm">${renderPmsBusinessImage(line.imageUrl,`${line.sku} ${line.color} ${line.size}`,'h-10 w-10')}<div>${escapeHtml(line.sku)}</div></td><td class="px-3 py-2 text-sm">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.qty, '件')}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="1" step="1" value="${line.qty}" data-${EVENT_PREFIX}-gen-qty="${escapeHtml(line.sku)}" data-${EVENT_PREFIX}-gen-suggestion="${escapeHtml(suggestionNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.1" value="${line.price}" data-${EVENT_PREFIX}-gen-price="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2 text-sm tabular-nums" data-pms-psk-line-amount>${formatPmsMoney(line.qty*line.price)}</td></tr>`).join('')}</tbody></table></div></section>`
    })
    .join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="生成商品采购单" data-pms-psk-generate="${escapeHtml(clientActionId)}"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭生成采购单"></button><section class="relative z-10 flex h-full w-[860px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">生成商品采购单</h2><p class="mt-1 text-xs text-slate-500">共 ${grouped.size} 个款式 · ${lines.length} 个 SKU · 生成后进入“待采购”</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">供应商
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-gen-field="supplierName" data-skip-page-rerender="true"><option value="">请选择</option>${supplierOptions}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购区域
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-gen-field="area" data-skip-page-rerender="true"><option value="印尼">印尼</option><option value="国内">国内</option></select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">目标仓库
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-gen-field="warehouse" data-skip-page-rerender="true">${warehouseOptions}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">期望交期
        <input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-07-15" data-${EVENT_PREFIX}-gen-field="expectedDeliveryDate" data-skip-page-rerender="true" />
      </label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">采购地址
        <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="采购链接或线下地址" data-${EVENT_PREFIX}-gen-field="purchaseAddress" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购专员<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(PMS_BUYER_ACTOR.name)}" data-${EVENT_PREFIX}-gen-field="purchaser" data-skip-page-rerender="true" /></label>
      ${[['isUrgent','是否加急','否'],['isFirstOrder','是否首单','是']].map(([key,label,defaultValue])=>`<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-gen-field="${key}" data-skip-page-rerender="true">${['否','是'].map(value=>`<option ${value===defaultValue?'selected':''}>${value}</option>`).join('')}</select></label>`).join('')}
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注
        <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填，如返场备货" data-${EVENT_PREFIX}-gen-field="remark" data-skip-page-rerender="true" />
      </label>
    </div>
    <div class="flex flex-wrap gap-2">${renderSecondaryButton('全选SKU',{prefix:EVENT_PREFIX,action:'generate-select-all'},'check-check')}${renderSecondaryButton('清空SKU选择',{prefix:EVENT_PREFIX,action:'generate-select-none'},'x')}${renderSecondaryButton('爆款 (70%)',{prefix:EVENT_PREFIX,action:'generate-preset70'},'trending-up')}${renderSecondaryButton('热销 (60%)',{prefix:EVENT_PREFIX,action:'generate-preset60'},'trending-up')}${renderSecondaryButton('重置采购数量',{prefix:EVENT_PREFIX,action:'generate-reset'},'rotate-ccw')}</div>
    ${groupsHtml}
    <p class="text-sm font-semibold" data-pms-psk-generate-summary>已选 ${lines.length} 个 SKU · ${lines.reduce((sum,line)=>sum+line.qty,0)} 件 · ${formatPmsMoney(lines.reduce((sum,line)=>sum+line.qty*line.price,0))}</p>
    <p class="text-xs text-slate-500">实际采购数量必须为大于 0 的整数；单价不能为负数。生成后建议单会标记为“部分生成/已生成”。</p>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('生成采购单', { prefix: EVENT_PREFIX, action: 'submit-generate' }, 'check-check')}</footer></section></div>`
}

function updateGenerateSummary(): void {
  const surface=rootElement()?.querySelector<HTMLElement>('[data-pms-psk-generate]');if(!surface)return
  let count=0,total=0,amount=0
  surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-qty]`).forEach(input=>{
    const row=input.closest('tr'),qty=Number(input.value),price=Number(row?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-price]`)?.value??0),selected=row?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-select]`)?.checked
    const lineAmount=row?.querySelector<HTMLElement>('[data-pms-psk-line-amount]');if(lineAmount)lineAmount.textContent=Number.isFinite(qty*price)?formatPmsMoney(qty*price):'—'
    if(selected){count+=1;total+=Number.isFinite(qty)?qty:0;amount+=Number.isFinite(qty*price)?qty*price:0}
  })
  const summary=surface.querySelector<HTMLElement>('[data-pms-psk-generate-summary]');if(summary)summary.textContent=`已选 ${count} 个 SKU · ${total} 件 · ${formatPmsMoney(amount)}`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-psk-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'make') {
    const row = getPmsSuggestionView(state.overlay.suggestionNo)
    return `${columnSettings}<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="${state.overlay.value ? '恢复做货' : '设置不需要做货'}"><section class="w-full max-w-md rounded-xl bg-white p-5"><h2 class="font-semibold">${state.overlay.value ? '恢复做货' : '设置不需要做货'}</h2><p class="my-4 text-sm">${escapeHtml(row?.productName ?? '')} · ${escapeHtml(row?.spu ?? '')}。${state.overlay.value ? '恢复后可按建议数量生成采购单。' : '此款将不再生成新的做货采购单。'}</p>${renderPmsOverlayError(state.overlayError)}<footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消', {prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${renderPrimaryButton(state.overlay.value?'恢复做货':'设置不需要做货',{prefix:EVENT_PREFIX,action:'submit-make'},'check')}</footer></section></div>`
  }
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.suggestionNo)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderGenerateOverlay(state.overlay.lines, state.overlay.clientActionId)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: true,
    title: '商品采购建议',
    primaryActionsHtml: '',
    feedbackHtml: `<div data-pms-psk-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-pms-psk-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-pms-psk-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条${state.selectedSuggestionNos.length ? ` · 已选 ${state.selectedSuggestionNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground" data-pms-psk-selected-count>已选 ${state.selectedSuggestionNos.length} 个款式</span>${renderPrimaryButton('生成采购单', { prefix: EVENT_PREFIX, action: 'open-generate-selected' }, 'check-check').replace('<button', `<button ${state.selectedSuggestionNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-psk-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-psk-pagination-surface>${renderPmsCorePagination(view.paginationHtml, EVENT_PREFIX, state.currentPage)}</div>`,
    overlaysHtml: `<div data-pms-psk-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  refreshPmsCoreRegion(root, '[data-pms-psk-filters]', renderFilters())
  refreshPmsCoreRegion(root, '[data-pms-psk-stats]', renderStats())
  refreshPmsCoreRegion(root, '[data-pms-psk-feedback]', renderPmsFeedback(state.feedback, state.feedbackOk))
  controller.refresh({ overlays: false })
  refreshOverlays()
  syncSelectionButtons()
}

function refreshTable(): void {
  controller.refresh({ pagination: false, overlays: false })
}

function refreshOverlays(): void {
  refreshPmsCoreOverlay(rootElement(), '[data-pms-psk-overlays]', renderOverlays(), state.overlay?.clientActionId ?? '', state.saving)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(skuDetail = false): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的采购建议。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  if (skuDetail) {
    downloadPmsCsv('商品采购建议SKU.csv', ['SPU', '商品名称', 'SKU', '颜色', '尺码', '待发货', 'KOL申请', '采购中', '库存', '建议采购数量'], rows.flatMap(row => row.skuItems.map(sku => [row.spu, row.productName, sku.sku, sku.color, sku.size, sku.pendingDeliveryQty, sku.kolApplyQty, sku.purchasingQty, sku.stockQty, sku.suggestedQty])))
    state.feedback = `已生成SKU导出文件，共${rows.reduce((sum,row)=>sum+row.skuItems.length,0)}条`
    state.feedbackOk = true; refreshAll(); return
  }
  downloadPmsCsv(
    '商品采购建议.csv',
    ['建议单号', '款式', 'SPU', '采购类型', '区域', '需求等级', '状态', '待发货', 'KOL申请', '采购中', '库存', '建议采购量', '已转采购单'],
    rows.map((row) => [
      row.suggestionNo,
      row.productName,
      row.spu,
      row.purchaseType,
      row.area,
      row.demandLevel,
      row.status,
      row.totalPendingDeliveryQty,
      row.totalKolApplyQty,
      row.totalPurchasingQty,
      row.totalStockQty,
      row.totalSuggestedQty,
      row.convertedOrderNos.join('、'),
    ]),
  )
  state.feedback = `已导出 ${rows.length} 条采购建议（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function openGenerate(suggestionNos: string[]): void {
  const lines = buildGenerateLines(suggestionNos)
  if (lines.length === 0) {
    state.feedback = '所选款式没有可生成的采购数量，请刷新后重试。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  state.overlay = { kind: 'generate', suggestionNos, clientActionId: nextPmsClientActionId('pms-psk'), lines }
  state.overlayError = ''
  refreshOverlays()
}

async function submitGenerate(overlay: Extract<NonNullable<SuggestPageState['overlay']>, { kind: 'generate' }>): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-psk-generate]')
  if (!surface) return
  const supplierName = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-gen-field="supplierName"]`)
  const areaField = surface.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-gen-field="area"]`)
  const warehouse = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-gen-field="warehouse"]`)
  const expectedDeliveryDate = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-gen-field="expectedDeliveryDate"]`)
  const remark = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-gen-field="remark"]`)
  const area = areaField?.value === '国内' ? '国内' : '印尼'

  const lineInputs = new Map<string, { qty: number; price: number }>()
  surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-qty]`).forEach((input) => {
    const sku = input.dataset.pmsPskGenQty || ''
    const priceInput = surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-price="${sku}"]`)
    const qty = Number(input.value)
    const price = Number.parseFloat(priceInput?.value ?? '')
    lineInputs.set(`${input.dataset.pmsPskGenSuggestion || ''}|${sku}`, { qty, price })
  })

  try {
  const inputs: PmsCreatePurchaseOrderInput[] = overlay.suggestionNos.map((suggestionNo) => {
    const view = getPmsSuggestionView(suggestionNo)
    if (!view) throw new PmsDomainError('SUGGESTION_NOT_FOUND', `采购建议 ${suggestionNo} 不存在`)
    return {
      spu: view.spu,
      productName: view.productName,
      imageUrl: view.imageUrl,
      purchaseType: view.purchaseType,
      area,
      supplierName,
      warehouse,
      expectedDeliveryDate,
      sourceSuggestionNo: suggestionNo,
      remark,
      purchaseAddress: readTextField(surface, `[data-${EVENT_PREFIX}-gen-field="purchaseAddress"]`),
      purchaser: readTextField(surface, `[data-${EVENT_PREFIX}-gen-field="purchaser"]`),
      isUrgent: readTextField(surface, `[data-${EVENT_PREFIX}-gen-field="isUrgent"]`) as '是'|'否',
      isFirstOrder: readTextField(surface, `[data-${EVENT_PREFIX}-gen-field="isFirstOrder"]`) as '是'|'否',
      lines: overlay.lines
        .filter((line) => line.suggestionNo === suggestionNo && [...surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-select]:checked`)].some(input=>input.dataset.pmsPskGenSelect===line.sku&&input.dataset.suggestionNo===suggestionNo))
        .map((line) => ({
          sku: line.sku,
          color: line.color,
          size: line.size,
          qty: lineInputs.get(`${suggestionNo}|${line.sku}`)?.qty ?? 0,
          standardPrice: line.price,
          actualPrice: lineInputs.get(`${suggestionNo}|${line.sku}`)?.price ?? -1,
        })),
    }
  })

    state.saving = true; setPmsCoreSavePending(rootElement(), true)
    const created = await generatePmsSuggestionPurchases(inputs, PMS_BUYER_ACTOR, overlay.clientActionId)
    state.feedback = `已生成 ${created.length} 张商品采购单：${created.map((order) => order.purchaseOrderNo).join('、')}`
    state.feedbackOk = true
    state.selectedSuggestionNos = state.selectedSuggestionNos.filter((no) => !overlay.suggestionNos.includes(no))
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof Error ? error.message : '生成商品采购单失败，当前输入未保存'
  } finally { state.saving = false; refreshOverlays() }
}

export async function renderPmsPurchaseSuggestionsPage(): Promise<string> {
  try { await Promise.all([hydratePmsPurchaseSuggestionsFromIdb(),hydratePmsSuppliersFromIdb()]) } catch (error) { state.feedback = error instanceof Error ? error.message : '用户采购资料不可读取，当前为固定演示记录'; state.feedbackOk = false }
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-psk-root data-skip-page-rerender="true"><style>[data-pms-psk-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsPurchaseSuggestionsOverlays(): boolean {
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

export async function handlePmsPurchaseSuggestionsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
if(target.closest('summary'))return true
   if (state.saving) return true
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (handlePmsCoreListControls(target, EVENT_PREFIX, state, controller, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  if (target.closest(`[data-${EVENT_PREFIX}-gen-qty],[data-${EVENT_PREFIX}-gen-price],[data-${EVENT_PREFIX}-gen-select]`)) {updateGenerateSummary();return true}
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsPskField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'searchField') { state.searchField = field.value as SuggestPageState['searchField']; return true }
    if (fieldName === 'firstOrder' || fieldName === 'needProduction') { state[fieldName] = field.value as ''|'是'|'否'; return true }
    if (fieldName === 'minQty' || fieldName === 'maxQty') { state[fieldName] = field.value; return true }
    if (fieldName === 'status') {
      state.status = field.value as SuggestPageState['status']
      return true
    }
    if (fieldName === 'purchaseType') {
      state.purchaseType = field.value as SuggestPageState['purchaseType']
      return true
    }
    if (fieldName === 'select-row') {
      const suggestionNo = field.dataset.suggestionNo || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedSuggestionNos = [...new Set([...state.selectedSuggestionNos, suggestionNo])]
      } else {
        state.selectedSuggestionNos = state.selectedSuggestionNos.filter((no) => no !== suggestionNo)
      }
      controller.refresh({ overlays: false })
      syncSelectionButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') {
        state.selectedSuggestionNos = []
      } else if (scope === 'page') {
        const pageNos = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`) ?? [])].filter((box) => !box.disabled).map((box) => box.dataset.suggestionNo || '')
        state.selectedSuggestionNos = pageNos
      } else {
        state.selectedSuggestionNos = filteredRows().filter((row) => row.totalAvailableQty > 0).map((row) => row.suggestionNo)
      }
      controller.refresh({ overlays: false })
      syncSelectionButtons()
      return true
    }
    if (fieldName === 'pageSize') {
      const value = Number.parseInt((field as HTMLSelectElement).value, 10)
      controller.setPageSize(value)
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsPskAction
  if (!action) return false

  if (action === 'toggle-page') {
    const checked = actionNode instanceof HTMLInputElement && actionNode.checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const suggestionNo = box.dataset.suggestionNo || ''
      if (checked) {
        if (!box.disabled) state.selectedSuggestionNos = [...new Set([...state.selectedSuggestionNos, suggestionNo])]
      } else {
        state.selectedSuggestionNos = state.selectedSuggestionNos.filter((no) => no !== suggestionNo)
      }
    })
    controller.refresh({ overlays: false })
    syncSelectionButtons()
    return true
  }
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
    state.purchaseType = ''; state.searchField = 'spu'; state.firstOrder = ''; state.needProduction = ''; state.minQty = ''; state.maxQty = ''
    state.selectedSuggestionNos = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export' || action === 'export-sku') {
    exportRows(action === 'export-sku')
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-psk-column-key]')?.dataset.pmsPskColumnKey || ''
    const desired = actionNode?.closest('input')?.checked
    controller.updateColumnPreference(action, key, desired)
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
  if (action === 'open-detail') {
    state.overlay = { kind: 'detail', suggestionNo: actionNode?.dataset.suggestionNo || '', clientActionId: nextPmsActionId('pms-psk-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-make') {
    const row = getPmsSuggestionView(actionNode?.dataset.suggestionNo ?? '')
    if (!row) return true
    state.overlay = { kind: 'make', suggestionNo: row.suggestionNo, value: !row.needProduction, clientActionId: nextPmsActionId('pms-psk-make') }
    state.overlayError = ''; refreshOverlays(); return true
  }
  if (action === 'submit-make' && state.overlay?.kind === 'make') {
    const overlay = state.overlay; state.saving = true; setPmsCoreSavePending(rootElement(), true)
    try { await setPmsSuggestionNeedProduction(overlay.suggestionNo, overlay.value, PMS_BUYER_ACTOR, overlay.clientActionId); state.overlay = null; state.feedback = overlay.value ? '已恢复做货' : '已设置不需要做货'; state.feedbackOk = true; refreshAll() }
    catch(error) { state.overlayError = error instanceof Error ? error.message : '设置未保存' }
    finally { state.saving = false; refreshOverlays() }
    return true
  }
  if (action === 'open-generate') {
    openGenerate([actionNode?.dataset.suggestionNo || ''])
    return true
  }
  if (action === 'open-generate-selected') {
    openGenerate([...state.selectedSuggestionNos])
    return true
  }
  if ((action==='generate-select-all'||action==='generate-select-none') && state.overlay?.kind==='generate') {
    rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-select]`).forEach(input=>input.checked=action==='generate-select-all');updateGenerateSummary();return true
  }
  if ((action === 'generate-preset70' || action === 'generate-preset60' || action === 'generate-reset') && state.overlay?.kind === 'generate') {
    const overlay=state.overlay, factor=action==='generate-preset70'?0.7:action==='generate-preset60'?0.6:1
    rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-gen-qty]`).forEach(input=>{
      const line=overlay.lines.find(row=>row.suggestionNo===input.dataset.pmsPskGenSuggestion&&row.sku===input.dataset.pmsPskGenQty)
      if(line)input.value=String(Math.floor(line.qty*factor))
    })
    updateGenerateSummary();return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'submit-generate') {
    if (!state.overlay || state.overlay.kind !== 'generate') return true
    if (state.overlay.suggestionNos.length === 0) {
      state.overlayError = '请至少选择一个款式'
      refreshOverlays()
      return true
    }
    await submitGenerate(state.overlay)
    return true
  }
  return false
}

export function getPmsPurchaseSuggestionRowCountForTest(): number {
  return filteredRows().length
}
