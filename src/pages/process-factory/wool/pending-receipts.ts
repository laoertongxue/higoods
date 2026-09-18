// @page-pattern: list
import { escapeHtml as e, localDateTimeText } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { readWoolStore } from '../../../data/fcs/wool-domain/store.ts'
import { confirmFactoryMaterialReceipt } from '../../../data/fcs/factory-receiving-links.ts'
import {
  listFactoryReceivingSources, listFactoryReceipts, getFactoryReceiptLocations, getDefaultFactoryReceiptPosition,
  prepareFactoryReceipt,
  type FactoryReceivingSource, type FactoryReceivingSourceLine, type FactoryReceiptInput,
} from '../../../data/fcs/factory-receiving.ts'
import { calculateYarnWeight } from '../../../data/fcs/yarn-weight.ts'
import { renderWoolObjectImage } from './stage-display.ts'
import { renderWoolStockAllocationsPage, handleWoolStockClick, handleWoolStockInput } from './stock-allocations.ts'

const prefix = 'wool-receiving'
const path = '/fcs/craft/wool/pending-receipts'
type Kind = 'YARN' | 'WOOL_PIECE'
interface Row { key: string; source: FactoryReceivingSource; line: FactoryReceivingSourceLine; receivedQty: number; remainingQty: number; times: string[] }
const state: ProcessOrderListControllerState & {
  kind: Kind; factoryId: string; keyword: string; workOrderId: string; craftOrderId: string; registration: string
  overlay?: { kind: 'receive' | 'history'; row: Row; confirmationId: string; at: string }
  feedback: string; initializedUrl: string; draft?: FactoryReceiptInput; reviewing: boolean; isPda: boolean
} = {
  currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: ['source'], pageSize: 10 },
  preferencesLoaded: false, showColumnSettings: false, kind: 'YARN', factoryId: '', keyword: '', workOrderId: '',
  registration: 'pending', craftOrderId: '', feedback: '', initializedUrl: '', reviewing: false, isPda: false,
}
const button = (label: string, action: string, id = '', primary = false) => (primary ? renderPrimaryButton : renderSecondaryButton)(label, { prefix, action })
  .replace('<button', `<button data-skip-page-rerender="true" data-id="${e(id)}"`)
const field = (label: string, value: string | number) => `<div class="leading-6"><span class="text-muted-foreground">${e(label)}：</span>${e(String(value))}</div>`
const input = (label: string, name: string, value = '', type = 'text') => `<label class="block text-xs">${e(label)}<input class="mt-1 h-9 w-full rounded border px-2 text-sm" data-wool-receiving-field="${name}" aria-label="${e(label)}" type="${type}" ${type === 'number' ? 'min="0" step="any"' : ''} value="${e(value)}"></label>`
const select = (label: string, name: string, options: Array<[string, string]>, value: string) => `<label class="block text-xs">${e(label)}<select class="mt-1 h-9 w-full rounded border bg-white px-2 text-sm" data-wool-receiving-field="${name}" aria-label="${e(label)}">${options.map(([id, label]) => `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label>`
const quantity = (value: number, unit: string) => `${Number(value.toFixed(3))} ${unit}`

export function listWoolPendingReceiptRows(): Row[] {
  const orders = Object.values(readWoolStore().workOrders)
  const factories = new Set(orders.map(order => order.factoryId))
  const receipts = listFactoryReceipts()
  const session = getPdaSession()
  return listFactoryReceivingSources().flatMap(source => source.lines.filter(line => (
    (line.material.kind === 'YARN' && (Boolean(line.woolOrderId) || factories.has(source.targetFactoryId)))
    || (line.material.kind === 'WOOL_PIECE' && (state.craftOrderId ? line.woolCraftOrderId === state.craftOrderId : Boolean(line.woolOrderId) && !line.woolCraftOrderId))
  )).filter(() => !session || session.factoryId === source.targetFactoryId).map(line => {
    const actual = receipts.flatMap(receipt => receipt.lines.filter(item => item.sourceId === source.id && item.sourceLineId === line.id).map(item => ({ qty: item.qty, at: receipt.receivedAt })))
    const receivedQty = actual.reduce((sum, item) => sum + item.qty, 0)
    const sent = line.material.kind === 'YARN' && line.yarn ? line.yarn.netGrams / 1000 : line.sentQty
    return { key: line.id, source, line, receivedQty, remainingQty: Math.max(0, sent - receivedQty), times: actual.map(item => item.at) }
  }))
}

function rows(): Row[] {
  return listWoolPendingReceiptRows().filter(row => row.line.material.kind === state.kind
    && (!state.factoryId || row.source.targetFactoryId === state.factoryId)
    && (!state.workOrderId || row.line.woolOrderId === state.workOrderId)
    && (!state.keyword || [row.source.documentNo, row.source.origin.name, row.line.material.sku, row.line.material.name, row.line.productionOrderNo, row.line.taskNo].join(' ').toLocaleLowerCase().includes(state.keyword.toLocaleLowerCase()))
    && (state.registration === 'all' || (state.registration === 'pending' ? row.remainingQty > 0 : row.receivedQty > 0)))
}

const columns: StandardListColumn<Row>[] = [
  { key: 'source', title: '待接收单 / 上游', width: 240, required: true, freezeable: true, sortable: true, sortValue: row => row.source.documentNo,
    render: row => `<strong>${e(row.source.documentNo)}</strong>${field('上游', row.source.origin.name)}${field('接收工厂', row.source.targetFactoryName)}${field('交出批次', row.source.originalRecordId || row.source.id)}` },
  { key: 'material', title: '接收对象', width: 255, required: true, freezeable: true, render: row => `<div class="flex items-start gap-2">${renderReceivingImage(row.line)}<div>${field('名称', row.line.material.name)}${field(row.line.material.kind === 'YARN' ? '纱线 SKU' : '片标识', row.line.material.sku)}${field('颜色 / 规格', `${row.line.material.color} / ${row.line.material.specification}`)}</div></div>` },
  { key: 'order', title: '关联加工单 / 需求来源', width: 220, freezeable: true, render: row => `${field(row.line.woolCraftOrderId ? '工艺加工单' : state.kind === 'YARN' ? '横机单' : '缝盘单', row.line.woolCraftOrderId || row.line.woolOrderId || '纱线备料')}${field('生产单', row.line.productionOrderNo || '待关联')}${field('任务', row.line.taskNo || '待关联')}${row.line.woolRouteNodeId ? field(row.line.woolCraftOrderId ? '接收工艺节点' : '末道工艺节点', row.line.woolRouteNodeId) : ''}` },
  { key: 'quantity', title: '数量', width: 190, sortable: true, sortValue: row => row.remainingQty, render: row => `${field('实发', quantity(row.line.material.kind === 'YARN' && row.line.yarn ? row.line.yarn.netGrams / 1000 : row.line.sentQty, row.line.unit))}${field('已实收', quantity(row.receivedQty, row.line.unit))}${field('尚待接收', quantity(row.remainingQty, row.line.unit))}` },
  { key: 'time', title: '时间', width: 205, sortable: true, sortValue: row => row.source.handedOutAt || row.source.approvedAt || row.source.createdAt, render: row => `${field('来源创建', row.source.createdAt)}${field('上游交出 / 审核', row.source.handedOutAt || row.source.approvedAt || '尚未发生')}${field('最近实收', row.times.at(-1) || '尚未接收')}${field('实收次数', row.times.length)}` },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true, render: row => `<div class="flex flex-col gap-2">${row.remainingQty > 0 ? button('确认接收', 'receive', row.key, true) : '<span class="text-emerald-700">本批已收齐</span>'}${button('来源 / 接收记录', 'history', row.key)}</div>` },
]
// renderStandardListTable and renderTablePagination are provided by the shared controller.
const controller = createProcessOrderListController({ state, columns, preferenceKey: path, pageSizeOptions: [10, 20, 50], eventPrefix: prefix,
  rootSelector: '[data-wool-receiving-page]', tableSurfaceSelector: '[data-wool-receiving-table]', paginationSurfaceSelector: '[data-wool-receiving-pagination]', overlaysSurfaceSelector: '[data-wool-receiving-columns]',
  defaultFrozenKeys: ['source'], columnSettingsTitle: '毛织待接收列设置', emptyText: '当前条件下没有来货；自动内部衔接不生成手工待接收。', getRows: rows, locallyManagedEvents: true })

function tabs(): string {
  if (state.craftOrderId) return `<div class="rounded border border-blue-100 bg-blue-50 p-3 text-sm">本次为工艺厂接收毛织片：${e(state.craftOrderId)}。接收后进入该工艺加工，不提前计入缝盘回货。<a class="ml-3 text-blue-700 underline" href="${path}">返回毛织待接收</a></div>`
  const all = listWoolPendingReceiptRows().filter(row => (!state.factoryId || row.source.targetFactoryId === state.factoryId) && row.remainingQty > 0)
  return (['YARN', 'WOOL_PIECE'] as const).map(kind => button(`${kind === 'YARN' ? '纱线待接收 · 横机' : '外加工片待接收 · 缝盘'} ${all.filter(row => row.line.material.kind === kind).length}`, 'kind', kind, kind === state.kind)).join('')
}
function stats(): string {
  const current = rows()
  return renderStandardListStats([{ label: '当前来货明细', value: current.length }, { label: '尚待接收', value: current.filter(row => row.remainingQty > 0).length }, { label: '已有实收', value: current.filter(row => row.receivedQty > 0).length }], { compact: true })
}
function filters(): string {
  const all = listWoolPendingReceiptRows(), factories = [...new Map(all.map(row => [row.source.targetFactoryId, row.source.targetFactoryName])).entries()]
  return `<div class="rounded-lg border bg-white p-3 space-y-3"><div class="grid grid-cols-4 gap-3">${input('单据 / 物料 / 生产单', 'keyword', state.keyword)}${select('接收工厂', 'factory', [['', '全部'], ...factories], state.factoryId)}${input('关联加工单', 'order', state.workOrderId)}${select('接收情况', 'registration', [['pending', '尚待接收'], ['received', '已有实收'], ['all', '全部']], state.registration)}</div><div class="flex gap-2">${button('查询', 'query', '', true)}${button('重置', 'reset')}${button('导出', 'export')}</div></div>`
}

function renderReceivingImage(line: FactoryReceivingSourceLine): string {
  const isPiece = line.material.kind === 'WOOL_PIECE'
  const title = isPiece ? `${line.material.name} · 款式参考图，非片实拍` : line.material.name
  return `<div class="shrink-0">${renderWoolObjectImage(line.material.imageUrl, title)}${isPiece ? '<p class="mt-1 w-16 text-[10px] leading-4 text-muted-foreground">款式参考图<br>非片实拍</p>' : ''}</div>`
}

function pdaList(): { tableHtml: string; paginationHtml: string } {
  const current = rows(), pageSize = state.preferences.pageSize, totalPages = Math.max(1, Math.ceil(current.length / pageSize))
  state.currentPage = Math.min(state.currentPage, totalPages)
  const offset = (state.currentPage - 1) * pageSize
  return {
    tableHtml: current.slice(offset, offset + pageSize).map(row => `<article class="min-w-0 rounded-lg border bg-white p-3 space-y-2">${field('来货', row.source.documentNo)}<div class="flex gap-2">${renderReceivingImage(row.line)}<div class="min-w-0 break-words text-sm"><strong>${e(row.line.material.name)}</strong><div class="break-all text-xs text-muted-foreground">${e(row.line.material.sku)}</div></div></div>${field('上游', row.source.origin.name)}${field('待收', quantity(row.remainingQty, row.line.unit))}<div class="flex flex-wrap gap-2">${row.remainingQty > 0 ? button('接收这批货', 'receive', row.key, true) : '<span class="text-emerald-700">本批已收齐</span>'}${button('接收记录', 'history', row.key)}</div></article>`).join('') || '<div class="rounded border bg-white p-4 text-sm text-muted-foreground">当前没有本厂待接收来货。</div>',
    paginationHtml: renderTablePagination({ currentPage: state.currentPage, total: current.length, pageSize, from: current.length ? offset + 1 : 0, to: Math.min(offset + pageSize, current.length), totalPages, actionPrefix: prefix, fieldPrefix: prefix, pageSizeOptions: [10, 20, 50], skipPageRerender: true }),
  }
}

function refresh(): void {
  if (state.isPda) {
    const view = pdaList(), table = document.querySelector('[data-wool-receiving-table]'), pagination = document.querySelector('[data-wool-receiving-pagination]')
    if (table) table.innerHTML = view.tableHtml
    if (pagination) pagination.innerHTML = view.paginationHtml
  } else controller.refresh()
  const root = document.querySelector('[data-wool-receiving-page]')
  const tab = root?.querySelector('[data-wool-receiving-tabs]'), stat = root?.querySelector('[data-wool-receiving-stats]'), feedback = root?.querySelector('[data-wool-receiving-feedback]')
  if (tab) tab.innerHTML = tabs()
  if (stat) stat.innerHTML = stats()
  if (feedback) feedback.textContent = state.feedback
}
const value = (name: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-wool-receiving-field="${name}"]`)?.value || ''
const number = (name: string) => { const raw = value(name).trim(); if (!raw) throw new Error('请填写本次实收数量；未收到的货物无需提交。'); return Number(raw) }

function renderOverlay(): string {
  const overlay = state.overlay
  if (!overlay) return ''
  const { row } = overlay
  const identity = `${row.source.origin.name} → ${row.source.targetFactoryName}`
  const summary = `<div class="mb-3 rounded border bg-slate-50 p-3 text-sm">${field('交接', identity)}${field('来源单', row.source.documentNo)}${field('关联加工单', row.line.woolCraftOrderId || row.line.woolOrderId || '纱线备料')}${field('尚待接收', quantity(row.remainingQty, row.line.unit))}<div class="mt-2 flex gap-2">${renderReceivingImage(row.line)}<span>${e(row.line.material.name)}<br>${e(row.line.material.sku)}</span></div></div>`
  if (overlay.kind === 'history') {
    const receipts = listFactoryReceipts(row.source.targetFactoryId).flatMap(receipt => receipt.lines.filter(line => line.sourceId === row.source.id && line.sourceLineId === row.line.id).map(line => `${field('接收记录', receipt.id)}${field('实收', quantity(line.qty, line.unit))}${field('接收人 / 时间', `${receipt.operatorName} / ${receipt.receivedAt}`)}${field('库位', line.locationId)}`))
    return renderDialog({ title: '来源 / 实际接收记录', closeAction: { prefix, action: 'close' }, width: 'lg' }, `<div class="max-h-[65vh] overflow-auto">${summary}${receipts.map(record => `<div class="border-t py-2 text-sm">${record}</div>`).join('') || '<p>尚未发生接收。</p>'}</div>`, button('关闭', 'close'))
  }
  if (state.draft && state.reviewing) {
    const line = state.draft.lines[0]
    const qty = row.line.material.kind === 'WOOL_PIECE' ? `${line.businessQty} 片` : `${calculateYarnWeight(line.grossKg!, line.tubes!, line.pcs).netGrams / 1000} kg 净重`
    return renderDialog({ title: '复核本次接收', closeAction: { prefix, action: 'close' }, width: 'lg' }, `${summary}${field('本次实收', qty)}${field('接收人', state.draft.operatorName)}${field('库位', line.locationId)}<p class="mt-2 text-xs text-muted-foreground">确认后形成实际接收与对应库存记录。</p><p class="mt-2 text-sm text-red-600" data-wool-receiving-error></p>`, button('返回修改', 'edit') + button('确认保存', 'save', '', true))
  }
  let defaultPosition = ''
  try { const position = getDefaultFactoryReceiptPosition(row.source.targetFactoryId); defaultPosition = `${position.warehouseId}|${position.locationId}` } catch { /* Explicit select remains required. */ }
  const previous = state.draft?.lines[0]
  if (previous) defaultPosition = `${previous.warehouseId}|${previous.locationId}`
  const locations: Array<[string, string]> = getFactoryReceiptLocations(row.source.targetFactoryId).map(position => [`${position.warehouse.warehouseId}|${position.location.locationId}`, `${position.warehouse.warehouseName} / ${position.location.locationNo}`])
  const quantities = row.line.material.kind === 'WOOL_PIECE' ? input('本次实收（片）', 'pieceQty', previous?.businessQty?.toString() || '', 'number')
    : `${input('实收筒数 pcs', 'pcs', previous?.pcs?.toString() || '', 'number')}${input('实收毛重 kg', 'grossKg', previous?.grossKg?.toString() || '', 'number')}${input('纸管 pcs（62 g/个）', 'PAPER', String(previous?.tubes?.PAPER ?? 0), 'number')}${input('锥形管 pcs（80 g/个）', 'CONICAL', String(previous?.tubes?.CONICAL ?? 0), 'number')}${input('宝塔管 pcs（121 g/个）', 'PAGODA', String(previous?.tubes?.PAGODA ?? 0), 'number')}`
  return renderDialog({ title: row.line.material.kind === 'YARN' ? '横机纱线接收' : row.line.woolCraftOrderId ? '工艺厂毛织片接收' : '缝盘外加工片接收', closeAction: { prefix, action: 'close' }, width: 'lg' }, `<div class="max-h-[62vh] overflow-auto">${summary}<div class="grid grid-cols-2 gap-3">${quantities}</div><p class="my-2 text-sm text-blue-700" data-wool-yarn-weight></p>${select('本厂入库位置', 'position', [['', '请选择本厂启用的库位'], ...locations], defaultPosition)}<div class="mt-3">${input('接收备注', 'remark', state.draft?.remark)}</div><p class="mt-2 text-sm text-red-600" data-wool-receiving-error></p></div>`, button('取消', 'close') + button('复核接收', 'review', '', true))
}
function refreshOverlay(): void { const container = document.querySelector('[data-wool-receiving-overlay]'); if (container) container.innerHTML = renderOverlay() }

let keyboardInstalled = false
export function renderWoolPendingReceiptsPage(): string {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'stock') return renderWoolStockAllocationsPage()
  const url = typeof window === 'undefined' ? path : window.location.pathname + window.location.search
  if (state.initializedUrl !== url) {
    state.initializedUrl = url; state.currentPage = 1; state.sort = null; state.overlay = undefined; state.draft = undefined
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    state.isPda = url.startsWith('/fcs/pda/') || params.get('pda') === '1'
    state.workOrderId = params.get('workOrderId') || ''
    state.craftOrderId = params.get('craftOrderId') || ''
    const order = readWoolStore().workOrders[state.workOrderId]
    if (order) { state.factoryId = order.factoryId; state.kind = order.stage === 'LINKING' ? 'WOOL_PIECE' : 'YARN' }
    if (state.craftOrderId) {
      const node = Object.values(readWoolStore().workOrders).flatMap(order => order.externalPieces.flatMap(piece => piece.routeNodes)).find(node => node.taskOrderId === state.craftOrderId)
      state.kind = 'WOOL_PIECE'; state.factoryId = node?.factoryId || ''; state.workOrderId = ''
    }
    if (state.isPda) state.factoryId = getPdaSession()?.factoryId || ''
  }
  if (typeof document !== 'undefined' && !keyboardInstalled) {
    keyboardInstalled = true
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.overlay && document.querySelector('[data-wool-receiving-page]')) { state.overlay = undefined; state.draft = undefined; refreshOverlay() } })
  }
  controller.ensurePreferencesLoaded(); controller.installColumnDragEvents()
  if (state.isPda) {
    const session = getPdaSession()
    if (!session) return '<div class="p-4 text-sm">请先登录本厂 PDA，再接收来货。</div>'
    const view = pdaList()
    return `<div class="min-w-0 space-y-3 p-3" data-wool-receiving-page data-skip-page-rerender="true"><header><a href="/fcs/pda/handover" data-nav="/fcs/pda/handover" class="mb-2 inline-block text-blue-700">返回交接</a><a href="/fcs/pda/wool/pending-receipts?view=stock" data-nav="/fcs/pda/wool/pending-receipts?view=stock" class="ml-3 inline-block text-blue-700">本厂纱线备料</a><h1 class="text-lg font-semibold">${state.craftOrderId ? '工艺片接收' : state.kind === 'YARN' ? '横机纱线接收' : '缝盘回货接收'}</h1><p class="text-sm text-muted-foreground">${e(session.factoryName)} · ${e(session.userName)}</p></header><p class="text-sm text-blue-700" data-wool-receiving-feedback>${e(state.feedback)}</p><div class="space-y-3" data-wool-receiving-table>${view.tableHtml}</div><div data-wool-receiving-pagination>${view.paginationHtml}</div><div data-wool-receiving-overlay>${renderOverlay()}</div></div>`
  }
  const view = controller.getView()
  return `<div data-wool-receiving-page data-skip-page-rerender="true">${renderStandardListPage({ title: state.craftOrderId ? '工艺厂毛织片待接收' : '毛织待接收', primaryActionsHtml: `<a href="${path}?view=stock" data-nav="${path}?view=stock" class="text-sm text-blue-700 underline">备料 / 关联横机单</a>`, feedbackHtml: `<p class="text-sm text-blue-700" data-wool-receiving-feedback>${e(state.feedback)}</p>`,
    statusTabsHtml: `<div class="flex gap-2" data-wool-receiving-tabs>${tabs()}</div>`, filtersHtml: filters(), statsHtml: `<div data-wool-receiving-stats>${stats()}</div>`, listTitle: '来货接收明细', listActionsHtml: button('列设置', 'open-column-settings'),
    tableHtml: `<div data-wool-receiving-table>${view.tableHtml}</div>`, paginationHtml: `<div data-wool-receiving-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wool-receiving-columns>${controller.renderColumnSettings()}</div><div data-wool-receiving-overlay>${renderOverlay()}</div>`,
  })}</div>`
}

export function handleWoolPendingReceiptsInput(target: HTMLElement): boolean {
  if (target.closest('[data-wool-stock-page]')) return handleWoolStockInput(target)
  if (!target.closest('[data-wool-receiving-page]')) return false
  const element = target as HTMLInputElement | HTMLSelectElement
  if (element.dataset.woolReceivingField === 'pageSize') { controller.setPageSize(Number(element.value)); refresh(); return true }
  if (['pcs', 'grossKg', 'PAPER', 'CONICAL', 'PAGODA'].includes(element.dataset.woolReceivingField || '')) {
    const feedback = document.querySelector('[data-wool-yarn-weight]')
    try { const weight = calculateYarnWeight(number('grossKg'), { PAPER: number('PAPER'), CONICAL: number('CONICAL'), PAGODA: number('PAGODA') }, number('pcs')); if (feedback) feedback.textContent = `管重 ${weight.tareGrams / 1000} kg；净重 ${weight.netGrams / 1000} kg` } catch (error) { if (feedback) feedback.textContent = (error as Error).message }
  }
  return true
}

export function handleWoolPendingReceiptsClick(target: HTMLElement): boolean {
  if (target.closest('[data-wool-stock-page]')) return handleWoolStockClick(target)
  if (!target.closest('[data-wool-receiving-page]')) return false
  const element = target.closest<HTMLElement>('[data-wool-receiving-action]'), action = element?.dataset.woolReceivingAction, id = element?.dataset.id || ''
  if (!action) return false
  try {
    if (action === 'kind') { state.kind = id as Kind; state.workOrderId = ''; state.currentPage = 1; const order = document.querySelector<HTMLInputElement>('[data-wool-receiving-field="order"]'); if (order) order.value = ''; refresh() }
    else if (action === 'query') { state.factoryId = value('factory'); state.keyword = value('keyword').trim(); state.workOrderId = value('order').trim(); state.registration = value('registration'); state.currentPage = 1; refresh() }
    else if (action === 'reset') { state.factoryId = state.keyword = state.workOrderId = ''; state.registration = 'pending'; state.currentPage = 1; const filter = document.querySelector('[data-wool-receiving-page] [data-standard-list-filters]'); if (filter) filter.innerHTML = filters(); refresh() }
    else if (action === 'receive' || action === 'history') { const row = listWoolPendingReceiptRows().find(row => row.key === id); if (!row) throw new Error('来源已变化，请重新查询。'); state.overlay = { kind: action, row, confirmationId: `WOOL-RCV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: localDateTimeText() }; state.draft = undefined; state.reviewing = false; refreshOverlay() }
    else if (action === 'close') { state.overlay = undefined; state.draft = undefined; refreshOverlay() }
    else if (action === 'review' && state.overlay) {
      const row = state.overlay.row, session = getPdaSession(), [warehouseId, locationId] = value('position').split('|')
      if (session && session.factoryId !== row.source.targetFactoryId) throw new Error('只能以本厂身份接收。')
      const line = { sourceId: row.source.id, sourceLineId: row.line.id, warehouseId, locationId,
        ...(row.line.material.kind === 'WOOL_PIECE' ? { businessQty: number('pieceQty'), businessUnit: '片' } : { pcs: number('pcs'), grossKg: number('grossKg'), tubes: { PAPER: number('PAPER'), CONICAL: number('CONICAL'), PAGODA: number('PAGODA') } }) }
      const draft = { id: state.overlay.confirmationId, factoryId: row.source.targetFactoryId, operatorId: session?.userId || 'WOOL-WEB-RECEIVER', operatorName: session?.userName || `${row.source.targetFactoryName}仓管`, receivedAt: state.overlay.at, remark: value('remark'), lines: [line] }
      prepareFactoryReceipt(draft)
      state.draft = draft; state.reviewing = true
      refreshOverlay()
    } else if (action === 'edit') { state.reviewing = false; refreshOverlay() }
    else if (action === 'save' && state.draft) { const receipt = confirmFactoryMaterialReceipt(state.draft); readWoolStore(); state.feedback = `接收记录 ${receipt.id} 已保存；本次实收 ${receipt.lines.map(line => quantity(line.qty, line.unit)).join('、')}。`; state.overlay = undefined; state.draft = undefined; refreshOverlay(); refresh() }
    else if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'prev-page' ? -1 : 1); refresh() }
    else if (action === 'sort-column') { controller.cycleSort(element?.dataset.columnKey || ''); refresh() }
    else if (action === 'open-column-settings' || action === 'close-column-settings') { state.showColumnSettings = action === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
    else if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: true }) }
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { controller.updateColumnPreference(action, element?.dataset.woolReceivingColumnKey || '', (element as HTMLInputElement).checked); controller.refresh({ overlays: true }) }
    else if (action === 'move-column-up' || action === 'move-column-down') { const key = element?.dataset.woolReceivingColumnKey || '', index = state.preferences.order.indexOf(key), next = index + (action === 'move-column-up' ? -1 : 1); if (next >= 0 && next < state.preferences.order.length) { const order = state.preferences.order; [order[index], order[next]] = [order[next], order[index]]; controller.updateColumnPreference('noop', key); controller.refresh({ overlays: true }) } }
    else if (action === 'export') {
      const current = rows(); if (!current.length) throw new Error('当前查询没有可导出的来货。')
      const csv = [['来源单', '接收工厂', '上游', '加工单', '对象', '物料 / 片标识', '实发', '已实收', '待接收', '单位', '时间'], ...current.map(row => [row.source.documentNo, row.source.targetFactoryName, row.source.origin.name, row.line.woolCraftOrderId || row.line.woolOrderId || '备料', row.line.material.name, row.line.material.sku, row.line.material.kind === 'YARN' && row.line.yarn ? row.line.yarn.netGrams / 1000 : row.line.sentQty, row.receivedQty, row.remainingQty, row.line.unit, row.source.handedOutAt || row.source.approvedAt])].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
      const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a'); anchor.href = url; anchor.download = '毛织待接收.csv'; anchor.click(); URL.revokeObjectURL(url)
    }
  } catch (error) { const message = error instanceof Error ? error.message : '接收未保存，请核对后重试。'; const feedback = document.querySelector('[data-wool-receiving-error]'); if (feedback) feedback.textContent = message; else { state.feedback = message; refresh() } }
  return true
}
