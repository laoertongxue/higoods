import { renderBadge } from '../../../components/ui/badge.ts'
import { renderButton } from '../../../components/ui/button.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'
import { renderDetailDrawer } from '../../../components/ui/drawer.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderToast, renderToastContainer } from '../../../components/ui/toast.ts'
import { listBusinessFactoryMasterRecords } from '../../../data/fcs/factory-master-store.ts'
import {
  WATER_SOLUBLE_STATUS_LABEL,
  assignWaterSolubleFactory,
  canAssignWaterSolubleFactory,
  completeWaterSoluble,
  getWaterSolubleCurrentAction,
  listWaterSolubleWorkOrders,
  markWaterSolubleMaterialReady,
  resolveWaterSolublePause,
  startWaterSoluble,
  submitWaterSolubleHandover,
  type WaterSolubleActionResult,
  type WaterSolubleWorkOrder,
} from '../../../data/fcs/water-soluble-task-domain.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

type Overlay = { type: 'detail' | 'supervisor' | 'handover'; orderId: string } | null
const state = { status: '', page: 1, pageSize: 10, overlay: null as Overlay }
let demoPrepared = false

function getCurrentFactoryId(): string | null {
  const [, query = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(query)
  return params.get('factoryId') || params.get('currentFactoryId') || params.get('pdaFactoryId')
}

function prepareDemoScenarios(): void {
  if (demoPrepared) return
  demoPrepared = true
  const factory = listBusinessFactoryMasterRecords({ includeTestFactories: true }).find((item) => canAssignWaterSolubleFactory(item.id).ok)
  const orders = listWaterSolubleWorkOrders().filter((order) => order.status === 'WAIT_FACTORY_ASSIGNMENT')
  if (!factory || orders.length < 3) return
  assignWaterSolubleFactory(orders[0].waterOrderId, factory.id)
  markWaterSolubleMaterialReady(orders[0].waterOrderId)
  startWaterSoluble(orders[0].waterOrderId)
  assignWaterSolubleFactory(orders[1].waterOrderId, factory.id)
  markWaterSolubleMaterialReady(orders[1].waterOrderId)
  startWaterSoluble(orders[1].waterOrderId)
  completeWaterSoluble(orders[1].waterOrderId, Math.max(1, orders[1].plannedQty - 100), '现场原料不足，等待主管确认')
}

function scopedOrders(): WaterSolubleWorkOrder[] {
  prepareDemoScenarios()
  const factoryId = getCurrentFactoryId()
  return listWaterSolubleWorkOrders().filter((order) => order.factoryId && (!factoryId || order.factoryId === factoryId) && (!state.status || order.status === state.status))
}

function qty(value: number, unit: string): string { return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} ${escapeHtml(unit)}` }
function difference(order: WaterSolubleWorkOrder): string {
  const value = order.completedQty - order.plannedQty
  if (value === 0) return '数量一致'
  return value < 0 ? `少 ${qty(Math.abs(value), order.qtyUnit)}` : `多 ${qty(value, order.qtyUnit)}`
}

function lastLog(order: WaterSolubleWorkOrder): string {
  const log = order.actionLogs.at(-1)
  return log ? `${escapeHtml(log.action)} · ${escapeHtml(log.at)}` : '暂无操作'
}

function renderPrimaryAction(order: WaterSolubleWorkOrder): string {
  const current = getWaterSolubleCurrentAction(order.waterOrderId)
  if (!current) return ''
  if (order.status === 'PRODUCTION_PAUSED') return renderButton({ label: '主管处理', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'open-supervisor' }, className: 'w-full' }).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_HANDOVER') return renderButton({ label: '现在交出', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'open-handover' }, className: 'w-full' }).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_MATERIAL') return renderButton({ label: '确认原料到位', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'material-ready' }, className: 'w-full' }).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_WATER_SOLUBLE') return renderButton({ label: '开始水溶', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'start' }, className: 'w-full' }).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') return renderButton({ label: '上报完成数量', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'complete' }, className: 'w-full' }).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  return `<div class="rounded-md bg-muted px-3 py-2 text-center text-sm">${escapeHtml(current.actionName)}</div>`
}

function renderCard(order: WaterSolubleWorkOrder): string {
  const current = getWaterSolubleCurrentAction(order.waterOrderId)
  return `<article class="rounded-xl border bg-card p-4 shadow-sm" data-testid="factory-water-soluble-card">
    <div class="flex flex-wrap items-start justify-between gap-2"><div><div class="font-mono text-xs text-muted-foreground">${escapeHtml(order.waterOrderNo)}</div><h2 class="mt-1 font-semibold">${escapeHtml(order.materialName)}</h2><p class="text-xs text-muted-foreground">${escapeHtml(order.materialCode)} · ${escapeHtml(order.productionOrderNo)}</p></div>${renderBadge(WATER_SOLUBLE_STATUS_LABEL[order.status], order.exceptionReason ? 'danger' : order.status === 'WATER_SOLUBLE_IN_PROGRESS' ? 'info' : 'warning')}</div>
    <div class="mt-4 rounded-lg bg-blue-50 p-3"><div class="text-xs text-blue-700">当前要做什么</div><div class="mt-1 font-semibold text-blue-900">${escapeHtml(current?.actionName || '查看状态')}</div><p class="mt-1 text-xs text-blue-700">${escapeHtml(current?.message || '')}</p></div>
    <dl class="mt-4 grid grid-cols-3 gap-2 text-center"><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">计划</dt><dd class="mt-1 font-medium">${qty(order.plannedQty, order.qtyUnit)}</dd></div><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">完成</dt><dd class="mt-1 font-medium">${qty(order.completedQty, order.qtyUnit)}</dd></div><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">差异</dt><dd class="mt-1 font-medium ${order.completedQty < order.plannedQty ? 'text-amber-700' : ''}">${difference(order)}</dd></div></dl>
    <div class="mt-3 text-xs text-muted-foreground">PDA 操作人：领域暂未记录 · 最近操作：${lastLog(order)}</div>${order.exceptionReason ? `<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">${escapeHtml(order.exceptionReason)}</div>` : ''}
    <div class="mt-4 space-y-2">${renderPrimaryAction(order)}<button class="w-full text-center text-sm text-blue-600 hover:underline" data-factory-water-soluble-action="open-detail" data-order-id="${escapeHtml(order.waterOrderId)}">查看任务详情与记录</button></div>
  </article>`
}

function renderListRegion(): string {
  const all = scopedOrders()
  const totalPages = Math.max(1, Math.ceil(all.length / state.pageSize))
  state.page = Math.min(state.page, totalPages)
  const from = (state.page - 1) * state.pageSize
  return `<section data-factory-water-soluble-list-region><div class="grid gap-4 xl:grid-cols-2">${all.slice(from, from + state.pageSize).map(renderCard).join('') || '<div class="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">当前染厂暂无独立水溶加工单</div>'}</div><div class="mt-4 overflow-hidden rounded-lg border bg-card" data-testid="factory-water-soluble-pagination">${renderTablePagination({ total: all.length, from: all.length ? from + 1 : 0, to: Math.min(from + state.pageSize, all.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'factory-water-soluble', fieldPrefix: 'factory-water-soluble', pageSizeOptions: [10,20,50] })}</div></section>`
}

function detailDrawer(order: WaterSolubleWorkOrder): string {
  return renderDetailDrawer({ title: '水溶任务详情', subtitle: order.waterOrderNo, closeAction: { prefix: 'factory-water-soluble', action: 'close-overlay' }, width: 'md' }, `<div class="space-y-4"><section><h3 class="font-semibold">当前任务</h3><p class="mt-2">${escapeHtml(order.materialName)} · ${qty(order.plannedQty, order.qtyUnit)}</p><p>${WATER_SOLUBLE_STATUS_LABEL[order.status]} · ${escapeHtml(order.factoryName || '')}</p></section><section><h3 class="font-semibold">执行记录</h3><ul class="mt-2 space-y-2">${order.actionLogs.map((log) => `<li class="rounded-md bg-muted/40 p-2 text-sm">${escapeHtml(log.action)}<div class="text-xs text-muted-foreground">${escapeHtml(log.detail)} · ${escapeHtml(log.at)}</div></li>`).join('')}</ul></section></div>`)
}

function overlay(): string {
  if (!state.overlay) return ''
  const order = listWaterSolubleWorkOrders().find((item) => item.waterOrderId === state.overlay?.orderId)
  if (!order) return ''
  if (state.overlay.type === 'detail') return detailDrawer(order)
  if (state.overlay.type === 'supervisor') return renderSimpleConfirmDialog({ prefix: 'factory-water-soluble', closeAction: 'close-overlay', confirmAction: 'supervisor-actual', title: '主管处理数量不足', description: `${order.completedQty} / ${order.plannedQty} ${order.qtyUnit}`, confirmLabel: '按实际数量继续交出', content: '<p class="text-sm">确认后将以当前完成数量作为可交出数量，并保留处理记录。</p>' })
  return renderSimpleConfirmDialog({ prefix: 'factory-water-soluble', closeAction: 'close-overlay', confirmAction: 'confirm-handover', title: '确认交出', description: order.waterOrderNo, confirmLabel: `确认交出 ${order.handoverQty ?? order.completedQty} ${order.qtyUnit}`, content: '<p class="text-sm">交出后等待对方收货，本页面不伪造收货完成。</p>' })
}

export function renderCraftDyeingWaterSolubleOrdersPage(): string {
  const factoryId = getCurrentFactoryId()
  return `<div class="space-y-4 p-4" data-testid="factory-water-soluble-orders-page"><header><h1 class="text-xl font-semibold">水溶加工单</h1><p class="text-sm text-muted-foreground">${factoryId ? `当前染厂：${escapeHtml(factoryId)}` : '当前为染厂管理预览；通过工厂上下文进入时只显示该染厂任务。'} 仅含独立水溶加工单，含水溶染色任务仍在染色加工单。</p></header><select class="h-9 rounded-md border px-3 text-sm" data-factory-water-soluble-field="status"><option value="">全部状态</option>${Object.entries(WATER_SOLUBLE_STATUS_LABEL).map(([v,l]) => `<option value="${v}" ${state.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${renderListRegion()}<div data-factory-water-soluble-overlay>${overlay()}</div>${renderToastContainer('top-right')}</div>`
}

function refreshList() { const node = document.querySelector<HTMLElement>('[data-factory-water-soluble-list-region]'); if (node) node.outerHTML = renderListRegion() }
function refreshOverlay() { const node = document.querySelector<HTMLElement>('[data-factory-water-soluble-overlay]'); if (node) node.innerHTML = overlay() }
function toast(result: WaterSolubleActionResult) { const root = document.querySelector<HTMLElement>('[data-toast-container]'); if (root) root.insertAdjacentHTML('afterbegin', renderToast({ title: result.ok ? '操作成功' : '无法操作', description: result.message, variant: result.ok ? 'success' : 'danger' })) }
function run(result: WaterSolubleActionResult) { toast(result); if (result.ok) { state.overlay = null; refreshOverlay(); refreshList() } }

export function handleCraftDyeingWaterSolubleOrdersEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLSelectElement>('[data-factory-water-soluble-field]')
  if (field) {
    if (field.dataset.factoryWaterSolubleField === 'status') state.status = field.value
    if (field.dataset.factoryWaterSolubleField === 'pageSize') state.pageSize = Number(field.value) || 10
    state.page = 1
    refreshList()
    return true
  }
  const node = target.closest<HTMLElement>('[data-factory-water-soluble-action]')
  if (!node) return false
  const action = node.dataset.factoryWaterSolubleAction || ''; const orderId = node.dataset.orderId || state.overlay?.orderId || ''
  if (action === 'open-detail' || action === 'open-supervisor' || action === 'open-handover') {
    const type = action.replace('open-', '') as 'detail' | 'supervisor' | 'handover'
    state.overlay = { type, orderId }
    refreshOverlay()
    return true
  }
  if (action === 'close-overlay') { state.overlay = null; refreshOverlay(); return true }
  if (action === 'material-ready') run(markWaterSolubleMaterialReady(orderId))
  else if (action === 'start') run(startWaterSoluble(orderId))
  else if (action === 'complete') { const order = listWaterSolubleWorkOrders().find((item) => item.waterOrderId === orderId); const value = window.prompt('请输入实际完成数量', String(order?.plannedQty || 0)); if (value !== null) run(completeWaterSoluble(orderId, Number(value), Number(value) === order?.plannedQty ? '' : '现场数量与计划不一致')) }
  else if (action === 'supervisor-actual') run(resolveWaterSolublePause(orderId, 'CONTINUE_WITH_ACTUAL_QTY'))
  else if (action === 'confirm-handover') { const order = listWaterSolubleWorkOrders().find((item) => item.waterOrderId === orderId); run(submitWaterSolubleHandover(orderId, order?.handoverQty ?? order?.completedQty ?? 0)) }
  else if (action === 'prev-page') { state.page = Math.max(1, state.page - 1); refreshList() }
  else if (action === 'next-page') { state.page += 1; refreshList() }
  else return false
  return true
}

export function isCraftDyeingWaterSolubleOverlayOpen(): boolean { return state.overlay !== null }
export function closeCraftDyeingWaterSolubleOverlay(): void { state.overlay = null; refreshOverlay() }
