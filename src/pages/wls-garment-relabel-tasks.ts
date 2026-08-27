// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import { buildUnifiedPrintPreviewLink } from '../data/fcs/print-service.ts'
import {
  completeGarmentWarehouseRelabelTask,
  getGarmentSalesOutboundGuard,
  getGarmentWarehouseRelabelTask,
  listGarmentWarehouseMovements,
  listGarmentWarehouseRelabelTasks,
  startGarmentWarehouseRelabelTask,
  type GarmentWarehouseRelabelTask,
} from '../data/fcs/garment-spu-replacement.ts'
import { escapeHtml } from '../utils.ts'

interface RelabelTaskPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | GarmentWarehouseRelabelTask['status']
  detailTaskId: string
  imagePreview: null | { url: string; label: string }
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'wls-garment-relabel'
const ROOT_SELECTOR = '[data-wls-garment-relabel-root]'
const state: RelabelTaskPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  detailTaskId: '',
  imagePreview: null,
  feedback: '',
  feedbackOk: true,
}

function formatQty(value: number): string {
  return `${value.toLocaleString('zh-CN')} 件`
}

function statusLabel(status: GarmentWarehouseRelabelTask['status']): string {
  if (status === 'COMPLETED') return '<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已完成</span>'
  if (status === 'PROCESSING') return '<span class="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">换码中</span>'
  return '<span class="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">待换码</span>'
}

function renderImage(url: string, label: string): string {
  return `<button type="button" class="relative shrink-0 rounded-md border bg-slate-50" data-wls-garment-relabel-action="open-image" data-image-url="${escapeHtml(url)}" data-image-label="${escapeHtml(label)}" data-skip-page-rerender="true"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="h-12 w-12 rounded-md object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="flex h-12 w-12 items-center justify-center p-1 text-[10px] text-red-700">图片失败</span></button>`
}

function filteredRows(): GarmentWarehouseRelabelTask[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listGarmentWarehouseRelabelTasks().filter((task) => {
    if (state.status && task.status !== state.status) return false
    if (!keyword) return true
    return [task.relabelTaskNo, task.productionOrderNo, task.sourceColor, ...task.lines.flatMap((line) => [line.source.skuCode, line.target.skuCode])]
      .some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<GarmentWarehouseRelabelTask>[] = [
  {
    key: 'task', title: '换码任务／生产单', width: 230, required: true, freezeable: true, sortable: true,
    sortValue: (task) => task.relabelTaskNo,
    render: (task) => `<strong>${escapeHtml(task.relabelTaskNo)}</strong><div class="mt-1 text-xs text-slate-500">${escapeHtml(task.productionOrderNo)}</div><div class="text-xs text-slate-500">来源：成衣 SPU 替换 · ${escapeHtml(task.createdAt)}</div>`,
  },
  {
    key: 'identity', title: '旧商品 → 新商品', width: 330, required: true,
    render: (task) => {
      const line = task.lines[0]
      return line ? `<div class="flex items-center gap-3">${renderImage(line.target.imageUrl, `${line.target.spuName} ${line.target.color} 商品图`)}<div><div class="text-xs text-slate-500">${escapeHtml(line.source.spuCode)} · ${escapeHtml(task.sourceColor)}</div><div class="my-1 text-xs text-blue-700">旧 SKU 出库 → 重新贴码 → 新 SKU 入库</div><strong>${escapeHtml(line.target.spuCode)} · ${escapeHtml(line.target.color)}</strong><div class="text-xs text-slate-500">${escapeHtml(line.target.spuName)}</div></div></div>` : '—'
    },
  },
  {
    key: 'quantity', title: '换码数量／批次', width: 180, sortable: true,
    sortValue: (task) => task.lines.reduce((sum, line) => sum + line.qty, 0),
    render: (task) => `<strong>${formatQty(task.lines.reduce((sum, line) => sum + line.qty, 0))}</strong><div class="mt-1 text-xs text-slate-500">${task.lines.length} 个尺码批次</div>`,
  },
  {
    key: 'progress', title: '处理进度', width: 180, sortable: true,
    sortValue: (task) => task.status,
    render: (task) => `${statusLabel(task.status)}<div class="mt-2 text-xs">已完成 ${task.lines.filter((line) => line.status === 'COMPLETED').length} / ${task.lines.length} 批</div>`,
  },
  {
    key: 'sourceBatch', title: '来源入库批次', width: 250,
    render: (task) => task.lines.map((line) => `<div class="text-xs"><strong>${escapeHtml(line.size)}</strong> · ${escapeHtml(line.sourceInboundBatchId)} · ${formatQty(line.qty)}</div>`).join(''),
  },
  {
    key: 'actions', title: '操作', width: 270, required: true, actionColumn: true,
    render: (task) => {
      const barcodeHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_SKU_BARCODE', sourceType: 'GARMENT_WAREHOUSE_RELABEL_TASK', sourceId: task.relabelTaskId })
      const hangtagHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_HANGTAG', sourceType: 'GARMENT_WAREHOUSE_RELABEL_TASK', sourceId: task.relabelTaskId })
      return `<div class="flex flex-wrap gap-1.5"><button class="rounded-md border px-2 py-1 text-xs" data-wls-garment-relabel-action="open-detail" data-task-id="${escapeHtml(task.relabelTaskId)}" data-skip-page-rerender="true">详情</button><a class="rounded-md bg-blue-600 px-2 py-1 text-xs text-white" href="${escapeHtml(barcodeHref)}" data-nav="${escapeHtml(barcodeHref)}">打印新条码</a><a class="rounded-md bg-amber-500 px-2 py-1 text-xs text-white" href="${escapeHtml(hangtagHref)}" data-nav="${escapeHtml(hangtagHref)}">打印新吊牌</a></div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/wls/garment-relabel-tasks',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-wls-garment-relabel-table]',
  paginationSurfaceSelector: '[data-wls-garment-relabel-pagination]',
  overlaysSurfaceSelector: '[data-wls-garment-relabel-column-settings]',
  defaultFrozenKeys: ['task'],
  columnSettingsTitle: '成衣仓换码任务列设置',
  emptyText: '暂无成衣仓换码任务；后道或仓储发起含 B 类数量的整色替换后会自动进入这里。',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[18rem] flex-1"><span class="mb-1 block text-xs text-slate-500">任务／生产单／新旧 SKU／颜色</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" data-wls-garment-relabel-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-40"><span class="mb-1 block text-xs text-slate-500">状态</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-wls-garment-relabel-field="status" data-skip-page-rerender="true"><option value="">全部</option><option value="PENDING" ${state.status === 'PENDING' ? 'selected' : ''}>待换码</option><option value="PROCESSING" ${state.status === 'PROCESSING' ? 'selected' : ''}>换码中</option><option value="COMPLETED" ${state.status === 'COMPLETED' ? 'selected' : ''}>已完成</option></select></label><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-wls-garment-relabel-action="apply-filters" data-skip-page-rerender="true">查询</button><button class="h-9 rounded-md border px-4 text-sm" data-wls-garment-relabel-action="reset-filters" data-skip-page-rerender="true">重置</button></div>`
}

function renderDetailDialog(): string {
  const task = state.detailTaskId ? getGarmentWarehouseRelabelTask(state.detailTaskId) : null
  if (!task) return ''
  const movements = listGarmentWarehouseMovements(task.replacementId)
  const barcodeHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_SKU_BARCODE', sourceType: 'GARMENT_WAREHOUSE_RELABEL_TASK', sourceId: task.relabelTaskId })
  const hangtagHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_HANGTAG', sourceType: 'GARMENT_WAREHOUSE_RELABEL_TASK', sourceId: task.relabelTaskId })
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><section class="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-4"><div><h2 class="text-lg font-semibold">${escapeHtml(task.relabelTaskNo)}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(task.productionOrderNo)} · 成衣仓 B 类未售库存换码</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-wls-garment-relabel-action="close-detail" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5"><div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">必须按来源入库批次完成“旧 SKU 出库 → 打印并更换新条码和新吊牌 → 新 SKU 入库”。批次数量和来源关系不改变。</div><div class="flex flex-wrap gap-2"><a class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white" href="${escapeHtml(barcodeHref)}" data-nav="${escapeHtml(barcodeHref)}">打印新条码</a><a class="rounded-md bg-amber-500 px-3 py-2 text-sm text-white" href="${escapeHtml(hangtagHref)}" data-nav="${escapeHtml(hangtagHref)}">打印新吊牌</a>${task.status === 'PENDING' ? `<button class="rounded-md border border-blue-600 px-3 py-2 text-sm text-blue-700" data-wls-garment-relabel-action="start-task" data-task-id="${escapeHtml(task.relabelTaskId)}" data-skip-page-rerender="true">开始换码</button>` : ''}${task.status !== 'COMPLETED' ? `<button class="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white" data-wls-garment-relabel-action="complete-task" data-task-id="${escapeHtml(task.relabelTaskId)}" data-skip-page-rerender="true">确认全部完成旧出新入</button>` : '<span class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">旧出新入已完成</span>'}</div><div class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[1180px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">商品／尺码</th><th class="p-3">来源入库批次</th><th class="p-3">旧 SKU 出库</th><th class="p-3">新 SKU 入库</th><th class="p-3">HG 出货条码</th><th class="p-3">零售条码</th><th class="p-3 text-right">数量</th><th class="p-3">状态</th></tr></thead><tbody>${task.lines.map((line) => `<tr class="border-t"><td class="p-3"><div class="flex items-center gap-2">${renderImage(line.target.imageUrl, `${line.target.spuName} ${line.target.color}/${line.size}`)}<div><strong>${escapeHtml(line.target.spuCode)}</strong><div class="text-xs text-slate-500">${escapeHtml(line.target.color)} / ${escapeHtml(line.size)}</div></div></div></td><td class="p-3 font-mono text-xs">${escapeHtml(line.sourceInboundBatchId)}</td><td class="p-3">${escapeHtml(line.source.skuCode)}</td><td class="p-3 font-semibold text-blue-700">${escapeHtml(line.target.skuCode)}</td><td class="p-3 font-mono text-xs">${escapeHtml(line.target.shipmentBarcode)}</td><td class="p-3 font-mono text-xs">${escapeHtml(line.target.retailBarcode)}</td><td class="p-3 text-right font-semibold">${formatQty(line.qty)}</td><td class="p-3">${statusLabel(line.status)}</td></tr>`).join('')}</tbody></table></div><section class="rounded-lg border p-4"><h3 class="font-semibold">库存流水</h3><p class="mt-1 text-xs text-slate-500">同一来源入库批次下保留旧 SKU 出库和新 SKU 入库两笔事实。</p>${movements.length ? `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[900px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-2">流水类型</th><th class="p-2">来源批次</th><th class="p-2">SKU</th><th class="p-2 text-right">数量</th><th class="p-2">操作人／时间</th></tr></thead><tbody>${movements.map((movement) => `<tr class="border-t"><td class="p-2">${movement.movementType === 'OLD_SKU_OUTBOUND' ? '旧 SKU 出库' : '新 SKU 入库'}</td><td class="p-2 font-mono text-xs">${escapeHtml(movement.sourceInboundBatchId)}</td><td class="p-2">${escapeHtml(movement.identity.skuCode)}</td><td class="p-2 text-right">${formatQty(movement.qty)}</td><td class="p-2">${escapeHtml(movement.operatorName)} · ${escapeHtml(movement.occurredAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mt-3 text-sm text-slate-500">任务尚未完成，暂未生成库存流水。</p>'}</section></div></section></div>`
}

function renderImageDialog(): string {
  if (!state.imagePreview) return ''
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true"><button class="absolute right-5 top-5 rounded-md bg-white px-3 py-2 text-sm" data-wls-garment-relabel-action="close-image" data-skip-page-rerender="true">关闭</button><figure><img src="${escapeHtml(state.imagePreview.url)}" alt="${escapeHtml(state.imagePreview.label)}" class="max-h-[82vh] max-w-[90vw] object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div hidden class="rounded-lg bg-white p-8 text-red-700">商品大图加载失败，请检查商品中心图片。</div><figcaption class="mt-2 text-center text-sm text-white">${escapeHtml(state.imagePreview.label)}</figcaption></figure></div>`
}

function renderOverlays(): string {
  return `<div data-wls-garment-relabel-column-settings>${controller.renderColumnSettings()}</div>${renderDetailDialog()}${renderImageDialog()}`
}

function renderInner(): string {
  const rows = filteredRows()
  const blockedSalesLineCount = rows.reduce((sum, task) => sum + task.lines.filter((line) => !getGarmentSalesOutboundGuard({
    productionOrderId: task.productionOrderId,
    skuCode: line.source.skuCode,
  }).allowed).length, 0)
  const view = controller.getView(rows)
  return renderStandardListPage({
    title: '成衣仓换码任务',
    primaryActionsHtml: '<a class="rounded-md border px-4 py-2 text-sm" href="/wls/garment-spu-replacements" data-nav="/wls/garment-spu-replacements">进入成衣 SPU 替换</a>',
    feedbackHtml: state.feedback ? `<div class="rounded-md border p-3 text-sm ${state.feedbackOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '换码任务', value: rows.length },
      { label: '待处理', value: rows.filter((task) => task.status !== 'COMPLETED').length },
      { label: 'B 类换码数量', value: formatQty(rows.reduce((sum, task) => sum + task.lines.reduce((lineSum, line) => lineSum + line.qty, 0), 0)) },
      { label: '库存动作', value: '旧出库＋新入库' },
      { label: '旧 SKU 销售出库', value: blockedSalesLineCount > 0 ? `已阻断 ${blockedSalesLineCount} 个尺码` : '无换码占用' },
    ]),
    listTitle: '成衣仓换码任务列表',
    listActionsHtml: '<button class="rounded-md border px-3 py-1.5 text-sm" data-wls-garment-relabel-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',
    tableHtml: `<div data-wls-garment-relabel-table>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wls-garment-relabel-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wls-garment-relabel-overlays>${renderOverlays()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function hydrate(root: ParentNode): void {
  void import('../components/shell.ts').then(({ hydrateIcons }) => hydrateIcons(root)).catch(() => undefined)
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydrate(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wls-garment-relabel-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrate(surface)
}

export function renderWlsGarmentRelabelTasksPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-wls-garment-relabel-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function closeWlsGarmentRelabelTaskOverlays(): boolean {
  if (!rootElement()) return false
  if (state.imagePreview) state.imagePreview = null
  else if (state.detailTaskId) state.detailTaskId = ''
  else if (state.showColumnSettings) state.showColumnSettings = false
  else return false
  refreshOverlays()
  return true
}

export function handleWlsGarmentRelabelTasksEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape') {
    return closeWlsGarmentRelabelTaskOverlays()
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wls-garment-relabel-field]')
  if (field) {
    if (field.dataset.wlsGarmentRelabelField === 'keyword') state.keyword = field.value
    if (field.dataset.wlsGarmentRelabelField === 'status') state.status = field.value as RelabelTaskPageState['status']
    if (field.dataset.wlsGarmentRelabelField === 'pageSize' && event?.type === 'change') { controller.setPageSize(Number(field.value)); controller.refresh() }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wls-garment-relabel-action]')
  const action = actionNode?.dataset.wlsGarmentRelabelAction
  if (!actionNode || !action) return false
  if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'prev-page' ? -1 : 1); controller.refresh(); return true }
  if (action === 'sort-column') { controller.cycleSort(actionNode.dataset.columnKey || ''); controller.refresh(); return true }
  if (action === 'apply-filters') { state.currentPage = 1; controller.refresh(); return true }
  if (action === 'reset-filters') { state.keyword = ''; state.status = ''; state.currentPage = 1; refreshAll(); return true }
  if (action === 'open-column-settings') state.showColumnSettings = true
  if (action === 'close-column-settings') state.showColumnSettings = false
  if (action === 'restore-column-settings') controller.restorePreferences()
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const checkbox = actionNode.closest<HTMLInputElement>('input')
    const key = actionNode.dataset.wlsGarmentRelabelColumnKey || actionNode.closest<HTMLElement>('[data-wls-garment-relabel-column-key]')?.dataset.wlsGarmentRelabelColumnKey || ''
    controller.updateColumnPreference(action, key, checkbox?.checked)
  }
  if (['open-column-settings', 'close-column-settings', 'restore-column-settings', 'toggle-column-visibility', 'toggle-column-freeze'].includes(action)) { refreshOverlays(); controller.refresh(); return true }
  if (action === 'open-detail') { state.detailTaskId = actionNode.dataset.taskId || ''; refreshOverlays(); return true }
  if (action === 'close-detail') { state.detailTaskId = ''; refreshOverlays(); return true }
  if (action === 'open-image') { state.imagePreview = { url: actionNode.dataset.imageUrl || '', label: actionNode.dataset.imageLabel || '商品大图' }; refreshOverlays(); return true }
  if (action === 'close-image') { state.imagePreview = null; refreshOverlays(); return true }
  if (action === 'start-task') {
    try {
      const task = startGarmentWarehouseRelabelTask(actionNode.dataset.taskId || '')
      state.feedback = `${task.relabelTaskNo} 已开始；请先打印并更换新条码和新吊牌，再确认旧出新入。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.feedback = `任务未开始：${error instanceof Error ? error.message : String(error)}`; state.feedbackOk = false; refreshAll()
    }
    return true
  }
  if (action === 'complete-task') {
    try {
      const task = completeGarmentWarehouseRelabelTask({ taskId: actionNode.dataset.taskId || '', operatorName: '成衣仓换码员' })
      state.feedback = `${task.relabelTaskNo} 已完成：旧 SKU 出库和新 SKU 入库流水已按来源批次记录。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.feedback = `任务未完成：${error instanceof Error ? error.message : String(error)}`; state.feedbackOk = false; refreshAll()
    }
    return true
  }
  return false
}
