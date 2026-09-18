// @page-pattern: list
import { escapeHtml as e, localDateTimeText } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { readWoolStore as syncWoolStore } from '../../../data/fcs/wool-domain/store.ts'
import { readWoolQuerySnapshot as readWoolStore } from '../../../data/fcs/wool-domain/queries.ts'
import { listFactoryReceipts, listReceivingAllocations, type FactoryReceipt, type FactoryReceiptLine, type ReceivingAllocation } from '../../../data/fcs/factory-receiving.ts'
import { listReceivingAllocationTargets, remainingReceivingAllocationQty, allocateReceivedMaterialToOrder } from '../../../data/fcs/factory-receiving-links.ts'
import { renderWoolObjectImage, woolStageDetailPath } from './stage-display.ts'

interface StockRow { receipt: FactoryReceipt; line: FactoryReceiptLine; remainingQty: number; factoryName: string; allocations: ReceivingAllocation[] }
const prefix = 'wool-stock'
const state: ProcessOrderListControllerState & { url: string; keyword: string; factoryId: string; showAll: boolean; feedback: string; rowId: string; draft?: ReceivingAllocation; reviewing: boolean } = {
  currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: ['material'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false,
  url: '', keyword: '', factoryId: '', showAll: false, feedback: '', rowId: '', reviewing: false,
}
const isPda = () => typeof window !== 'undefined' && (window.location.pathname.startsWith('/fcs/pda/') || new URLSearchParams(window.location.search).get('pda') === '1')
const basePath = () => isPda() ? '/fcs/pda/wool/pending-receipts' : '/fcs/craft/wool/pending-receipts'
const button = (label: string, action: string, id = '', primary = false) => (primary ? renderPrimaryButton : renderSecondaryButton)(label, { prefix, action }).replace('<button', `<button data-id="${e(id)}" data-skip-page-rerender="true"`)
const field = (label: string, value: string | number) => `<div class="leading-5"><span class="text-muted-foreground">${e(label)}：</span>${e(String(value))}</div>`
const qty = (value: number) => `${Number(value.toFixed(3))} kg`
const input = (label: string, name: string, value = '', type = 'text') => `<label class="block text-xs">${e(label)}<input class="mt-1 h-9 w-full rounded border px-2 text-sm" data-wool-stock-field="${name}" aria-label="${e(label)}" type="${type}" ${type === 'number' ? 'min="0.001" step="0.001"' : ''} value="${e(value)}"></label>`
const select = (label: string, name: string, options: Array<[string, string]>, value = '') => `<label class="block text-xs">${e(label)}<select class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm" data-wool-stock-field="${name}" aria-label="${e(label)}">${options.map(([id, label]) => `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label>`
const value = (name: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-wool-stock-field="${name}"]`)?.value || ''

export function listWoolStockAllocationRows(): StockRow[] {
  const store = readWoolStore(), session = getPdaSession()
  if (isPda() && !session) return []
  const factories = new Map(Object.values(store.workOrders).filter(order => order.stage === 'KNITTING').map(order => [order.factoryId, order.factoryName]))
  const allocations = listReceivingAllocations()
  return listFactoryReceipts(isPda() ? session?.factoryId : undefined).filter(receipt => factories.has(receipt.factoryId)).flatMap(receipt => receipt.lines
    .filter(line => line.material.kind === 'YARN' && line.unit === 'kg' && !line.woolOrderId && !line.woolCraftOrderId && !line.printingOrderId && !line.dyeOrderId && !line.waterOrderId)
    .map(line => ({ receipt, line, remainingQty: remainingReceivingAllocationQty(line.id), factoryName: factories.get(receipt.factoryId)!, allocations: allocations.filter(item => item.receiptLineId === line.id) })))
}
export function listWoolStockAllocationTargets(receiptLineId: string) {
  const row = listWoolStockAllocationRows().find(item => item.line.id === receiptLineId)
  if (!row) return []
  const store = readWoolStore()
  return listReceivingAllocationTargets(receiptLineId).filter(target => {
    const order = store.workOrders[target.id]
    return target.kind === 'wool' && order?.stage === 'KNITTING' && order.factoryId === row.receipt.factoryId
      && order.outputPlanLines.some(line => line.requiredYarnSkus.includes(row.line.material.sku))
      && !store.completions.some(item => item.woolOrderId === order.woolOrderId)
  }).map(target => ({ ...target, label: `${target.no} · ${store.workOrders[target.id].styleNo} · ${store.workOrders[target.id].factoryName}` }))
}
function rows(): StockRow[] { return listWoolStockAllocationRows().filter(row => (state.showAll || row.remainingQty > 0) && (!state.factoryId || row.receipt.factoryId === state.factoryId) && (!state.keyword || [row.line.sourceDocumentNo, row.line.material.name, row.line.material.sku, row.line.material.batchNo, row.receipt.id].join(' ').toLocaleLowerCase().includes(state.keyword.toLocaleLowerCase()))) }
function identity(row: StockRow): string { return `<div class="flex items-start gap-2">${renderWoolObjectImage(row.line.material.imageUrl, `${row.line.material.name} ${row.line.material.sku}`)}<div class="min-w-0 break-words">${field('纱线', row.line.material.name)}${field('SKU', row.line.material.sku)}${field('颜色 / 规格', `${row.line.material.color} / ${row.line.material.specification}`)}${field('批次', row.line.material.batchNo)}</div></div>` }
function allocationSummary(row: StockRow): string {
  const store = readWoolStore()
  return row.allocations.map(item => {
    const order = store.workOrders[item.woolOrderId || '']
    const href = order ? isPda() ? `/fcs/pda/exec/${encodeURIComponent(order.taskId)}` : woolStageDetailPath(order) : ''
    return `<div>${order ? `<a class="text-blue-700 underline" href="${e(href)}" data-nav="${e(href)}">${e(order.woolOrderNo)}</a>` : e(item.woolOrderId || '其他加工单')} · ${qty(item.qty)}<div class="text-muted-foreground">${e(item.operatorName)} · ${e(item.at)}</div></div>`
  }).join('') || '<span class="text-muted-foreground">尚未分配</span>'
}
const columns: StandardListColumn<StockRow>[] = [
  { key: 'material', title: '纱线备料', width: 275, required: true, freezeable: true, render: identity },
  { key: 'source', title: '实收来源 / 工厂', width: 250, freezeable: true, sortable: true, sortValue: row => row.line.sourceDocumentNo, render: row => field('来源单', row.line.sourceDocumentNo) + field('实收记录', row.receipt.id) + field('上游', row.line.origin.name) + field('接收工厂', row.factoryName) + field('库位', row.line.locationId) },
  { key: 'quantity', title: '数量', width: 175, sortable: true, sortValue: row => row.remainingQty, render: row => field('实际接收', qty(row.line.qty)) + field('已经分配', qty(row.line.qty - row.remainingQty)) + field('可分配余量', qty(row.remainingQty)) },
  { key: 'time', title: '接收时间 / 接收人', width: 200, sortable: true, sortValue: row => row.receipt.receivedAt, render: row => field('实际接收', row.receipt.receivedAt) + field('接收人', row.receipt.operatorName) },
  { key: 'allocations', title: '已关联横机单', width: 235, render: allocationSummary },
  { key: 'actions', title: '操作', width: 150, required: true, actionColumn: true, render: row => row.remainingQty > 0 ? button('分配到横机单', 'allocate', row.line.id, true) : '<span class="text-emerald-700">已全部分配</span>' },
]
// renderStandardListTable and renderTablePagination are provided by the shared controller.
const controller = createProcessOrderListController({ state, columns, preferenceKey: '/fcs/craft/wool/pending-receipts?view=stock', pageSizeOptions: [10, 20, 50], eventPrefix: prefix,
  rootSelector: '[data-wool-stock-page]', tableSurfaceSelector: '[data-wool-stock-table]', paginationSurfaceSelector: '[data-wool-stock-pagination]', overlaysSurfaceSelector: '[data-wool-stock-columns]', defaultFrozenKeys: ['material'],
  columnSettingsTitle: '毛织备料列设置', emptyText: '当前没有符合条件的已收纱线备料。', getRows: rows, locallyManagedEvents: true })
function filters(): string {
  const factories = [...new Map(listWoolStockAllocationRows().map(row => [row.receipt.factoryId, row.factoryName])).entries()]
  return `<div class="space-y-3" data-wool-stock-filters><div class="grid grid-cols-1 gap-3 sm:grid-cols-3">${input('来源单 / 实收记录 / 纱线 SKU', 'keyword', state.keyword)}${!isPda() ? select('接收工厂', 'factory', [['', '全部毛织工厂'], ...factories], state.factoryId) : ''}${select('分配状态', 'availability', [['available', '有可分配余量'], ['all', '全部备料实收']], state.showAll ? 'all' : 'available')}</div><div class="flex gap-2">${button('查询', 'query', '', true)}${button('重置', 'reset')}${!isPda() ? button('导出', 'export') : ''}</div></div>`
}
function stats(): string { const current = rows(); return renderStandardListStats([{ label: '备料实收明细', value: current.length }, { label: '实际接收', value: qty(current.reduce((sum, row) => sum + row.line.qty, 0)) }, { label: '可分配余量', value: qty(current.reduce((sum, row) => sum + row.remainingQty, 0)) }], { compact: true }) }
function pdaView() {
  const current = rows(), totalPages = Math.max(1, Math.ceil(current.length / state.preferences.pageSize)); state.currentPage = Math.min(state.currentPage, totalPages)
  const offset = (state.currentPage - 1) * state.preferences.pageSize
  return { tableHtml: current.slice(offset, offset + state.preferences.pageSize).map(row => `<article class="space-y-2 rounded-lg border bg-white p-3 text-sm">${identity(row)}${field('来源单', row.line.sourceDocumentNo)}${field('实收记录', row.receipt.id)}${field('实际接收', qty(row.line.qty))}${field('可分配余量', qty(row.remainingQty))}${allocationSummary(row)}${row.remainingQty > 0 ? button('分配到横机单', 'allocate', row.line.id, true) : '已全部分配'}</article>`).join('') || '<p class="p-4 text-sm">本厂暂无可分配的已收纱线备料。</p>', paginationHtml: renderTablePagination({ currentPage: state.currentPage, total: current.length, pageSize: state.preferences.pageSize, totalPages, actionPrefix: prefix, from: current.length ? offset + 1 : 0, to: Math.min(offset + state.preferences.pageSize, current.length), skipPageRerender: true }) }
}
function renderTargetIdentity(orderId: string): string {
  const order = readWoolStore().workOrders[orderId]
  return order ? `<div class="mt-2 flex items-start gap-2 rounded border p-2 text-sm">${renderWoolObjectImage(order.styleImageUrl, `${order.styleNo} 款式图`)}<div>${field('目标横机单', order.woolOrderNo)}${field('款式', `${order.styleName} / ${order.styleNo}`)}</div></div>` : ''
}
function renderOverlay(): string {
  if (!state.rowId) return ''
  const row = listWoolStockAllocationRows().find(item => item.line.id === state.rowId)
  if (!row) return ''
  const targets = listWoolStockAllocationTargets(row.line.id), target = targets.find(item => item.id === state.draft?.woolOrderId)
  const summary = `<div class="mb-3 rounded border bg-slate-50 p-3 text-sm">${identity(row)}${field('来源实收', row.receipt.id)}${field('接收工厂', row.factoryName)}${field('可分配余量', qty(row.remainingQty))}</div>`
  return renderDialog({ title: state.reviewing ? '复核备料分配' : '分配纱线到横机单', closeAction: { prefix, action: 'close' }, width: 'lg' }, `${summary}${state.reviewing && state.draft ? `${field('横机加工单', target?.label || '目标已变化，请返回核对')}${renderTargetIdentity(state.draft.woolOrderId || '')}${field('本次分配', qty(state.draft.qty))}${field('操作人', state.draft.operatorName)}<p class="mt-3 text-sm text-blue-700">确认后从本笔备料余量分配到该横机单，不重复登记接收或增加总库存。</p>` : targets.length ? `<div class="space-y-3">${select('本厂横机加工单', 'target', [['', '请选择需要该纱线 SKU 的横机单'], ...targets.map(item => [item.id, item.label] as [string, string])], state.draft?.woolOrderId)}<div data-wool-stock-target-preview>${renderTargetIdentity(state.draft?.woolOrderId || '')}</div>${input('本次分配数量（kg）', 'qty', state.draft ? String(state.draft.qty) : '', 'number')}</div>` : '<p class="text-amber-700">本厂没有需要该纱线 SKU 的未完单横机加工单，继续作为备料保留。</p>'}<p class="mt-2 text-sm text-red-700" data-wool-stock-error></p>`, state.reviewing ? button('返回修改', 'edit') + button('确认分配', 'save', '', true) : button('取消', 'close') + (targets.length ? button('复核分配', 'review', '', true) : ''))
}
function refreshOverlay() { const host = document.querySelector('[data-wool-stock-overlay]'); if (host) host.innerHTML = renderOverlay() }
function refresh() {
  if (isPda()) { const view = pdaView(), table = document.querySelector('[data-wool-stock-table]'), pagination = document.querySelector('[data-wool-stock-pagination]'); if (table) table.innerHTML = view.tableHtml; if (pagination) pagination.innerHTML = view.paginationHtml }
  else controller.refresh()
  const stat = document.querySelector('[data-wool-stock-stats]'), feedback = document.querySelector('[data-wool-stock-feedback]'); if (stat) stat.innerHTML = stats(); if (feedback) feedback.textContent = state.feedback
}
let keyboardInstalled = false
export function renderWoolStockAllocationsPage(): string {
  const url = typeof window === 'undefined' ? '?view=stock' : window.location.pathname + window.location.search
  if (state.url !== url) { state.url = url; state.keyword = state.factoryId = state.rowId = state.feedback = ''; state.currentPage = 1; state.showAll = state.reviewing = false; state.draft = undefined }
  if (isPda() && !getPdaSession()) return '<div data-wool-receiving-page class="p-4 text-sm">请先登录本厂 PDA，再分配备料。</div>'
  controller.ensurePreferencesLoaded(); controller.installColumnDragEvents()
  if (typeof document !== 'undefined' && !keyboardInstalled) { keyboardInstalled = true; document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.rowId && document.querySelector('[data-wool-stock-page]')) { state.rowId = ''; state.draft = undefined; refreshOverlay() } }) }
  const back = `<a href="${basePath()}" data-nav="${basePath()}" class="text-sm text-blue-700 underline">返回待接收</a>`
  const overlays = `<div data-wool-stock-columns>${controller.renderColumnSettings()}</div><div data-wool-stock-overlay>${renderOverlay()}</div>`
  const view = isPda() ? pdaView() : controller.getView()
  const body = isPda() ? `<div class="space-y-3 p-3">${back}<h1 class="text-lg font-semibold">本厂纱线备料分配</h1><p class="text-sm">${e(getPdaSession()!.factoryName)} · ${e(getPdaSession()!.userName)}</p><p class="text-sm text-blue-700" data-wool-stock-feedback>${e(state.feedback)}</p><div class="rounded border bg-white p-3">${filters()}</div><div class="space-y-3" data-wool-stock-table>${view.tableHtml}</div><div data-wool-stock-pagination>${view.paginationHtml}</div>${overlays}</div>`
    : renderStandardListPage({ title: '毛织纱线备料 / 关联横机单', primaryActionsHtml: back, feedbackHtml: `<p class="text-sm text-blue-700" data-wool-stock-feedback>${e(state.feedback)}</p>`, filtersHtml: filters(), statsHtml: `<div data-wool-stock-stats>${stats()}</div>`, listTitle: '已收备料明细', listActionsHtml: button('列设置', 'open-column-settings'), tableHtml: `<div data-wool-stock-table>${view.tableHtml}</div>`, paginationHtml: `<div data-wool-stock-pagination>${view.paginationHtml}</div>`, overlaysHtml: overlays })
  return `<div data-wool-receiving-page data-wool-stock-page data-skip-page-rerender="true">${body}</div>`
}
export function handleWoolStockInput(target: HTMLElement): boolean {
  if (!target.closest('[data-wool-stock-page]')) return false
  const input = target as HTMLInputElement
  if (input.dataset.woolStockField === 'target') { const preview = document.querySelector('[data-wool-stock-target-preview]'); if (preview) preview.innerHTML = renderTargetIdentity(input.value) }
  if (input.dataset.woolStockField === 'pageSize') { controller.setPageSize(Number(input.value)); refresh() }
  return true
}
export function handleWoolStockClick(target: HTMLElement): boolean {
  if (!target.closest('[data-wool-stock-page]')) return false
  const element = target.closest<HTMLElement>('[data-wool-stock-action]'), action = element?.dataset.woolStockAction
  if (!action) return false
  try {
    if (action === 'query') { state.keyword = value('keyword').trim(); state.factoryId = isPda() ? '' : value('factory'); state.showAll = value('availability') === 'all'; state.currentPage = 1; refresh() }
    else if (action === 'reset') { state.keyword = state.factoryId = ''; state.showAll = false; state.currentPage = 1; const filter = document.querySelector('[data-wool-stock-filters]'); if (filter) filter.outerHTML = filters(); refresh() }
    else if (action === 'allocate') { const row = listWoolStockAllocationRows().find(item => item.line.id === element?.dataset.id); if (!row || row.remainingQty <= 0) throw new Error('该笔备料已无可分配余量，请重新查询。'); state.rowId = row.line.id; state.draft = undefined; state.reviewing = false; refreshOverlay() }
    else if (action === 'close') { state.rowId = ''; state.draft = undefined; refreshOverlay() }
    else if (action === 'edit') { state.reviewing = false; refreshOverlay() }
    else if (action === 'review') {
      const row = listWoolStockAllocationRows().find(item => item.line.id === state.rowId), targetId = value('target'), amount = Number(value('qty'))
      if (!row || !listWoolStockAllocationTargets(row.line.id).some(item => item.id === targetId)) throw new Error('请选择本厂需要该纱线 SKU 的未完单横机加工单。')
      if (!Number.isFinite(amount) || amount <= 0 || amount > row.remainingQty + 0.000001) throw new Error(`本次分配须大于 0 且不超过余量 ${qty(row.remainingQty)}。`)
      state.draft = { id: `WOOL-ALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, receiptLineId: row.line.id, woolOrderId: targetId, qty: amount, operatorName: getPdaSession()?.userName || `${row.factoryName}仓管`, at: localDateTimeText() }
      state.reviewing = true; refreshOverlay()
    } else if (action === 'save' && state.reviewing && state.draft) {
      if (!listWoolStockAllocationTargets(state.draft.receiptLineId).some(item => item.id === state.draft!.woolOrderId)) throw new Error('接收工厂或目标横机单已变化，请返回重新核对。')
      const draft = state.draft; allocateReceivedMaterialToOrder(draft); syncWoolStore()
      state.feedback = `已分配 ${qty(draft.qty)}；本笔备料剩余 ${qty(remainingReceivingAllocationQty(draft.receiptLineId))}。接收与总库存未重复增加。`
      state.rowId = ''; state.draft = undefined; state.reviewing = false; refreshOverlay(); refresh()
    } else if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'prev-page' ? -1 : 1); refresh() }
    else if (action === 'sort-column') { controller.cycleSort(element?.dataset.columnKey || ''); refresh() }
    else if (action === 'open-column-settings' || action === 'close-column-settings') { state.showColumnSettings = action === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
    else if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: true }) }
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { controller.updateColumnPreference(action, element?.dataset.woolStockColumnKey || '', (element as HTMLInputElement).checked); controller.refresh({ overlays: true }) }
    else if (action === 'move-column-up' || action === 'move-column-down') { const key = element?.dataset.woolStockColumnKey || '', index = state.preferences.order.indexOf(key), next = index + (action === 'move-column-up' ? -1 : 1); if (next >= 0 && next < state.preferences.order.length) { const order = state.preferences.order; [order[index], order[next]] = [order[next], order[index]]; controller.updateColumnPreference('noop', key); controller.refresh({ overlays: true }) } }
    else if (action === 'export') { const current = rows(); if (!current.length) throw new Error('当前没有可导出的备料。'); const csv = [['来源单', '实收记录', '工厂', '纱线', 'SKU', '实收 kg', '已分配 kg', '余量 kg', '接收时间'], ...current.map(row => [row.line.sourceDocumentNo, row.receipt.id, row.factoryName, row.line.material.name, row.line.material.sku, row.line.qty, row.line.qty - row.remainingQty, row.remainingQty, row.receipt.receivedAt])].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a'); anchor.href = url; anchor.download = '毛织纱线备料分配.csv'; anchor.click(); URL.revokeObjectURL(url) }
  } catch (error) { const message = error instanceof Error ? error.message : '分配未保存，请核对后重试。', host = document.querySelector('[data-wool-stock-error]'); if (host) host.textContent = message; else { state.feedback = message; refresh() } }
  return true
}
