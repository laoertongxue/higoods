import { renderBadge } from '../components/ui/badge.ts'
import { renderButton } from '../components/ui/button.ts'
import { renderDetailDrawer, renderSimpleDrawer } from '../components/ui/drawer.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { renderTable } from '../components/ui/table.ts'
import type { TableColumn } from '../components/ui/types.ts'
import { renderToast, renderToastContainer } from '../components/ui/toast.ts'
import { canAssignWaterSolubleFactory, assignWaterSolubleFactory, listWaterSolubleWorkOrders, WATER_SOLUBLE_STATUS_LABEL, type WaterSolubleWorkOrder, type WaterSolubleWorkOrderStatus } from '../data/fcs/water-soluble-task-domain.ts'
import { listBusinessFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'

type Overlay = { type: 'detail' | 'assign'; orderId: string } | null
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const state = { keyword: '', status: '', factoryId: '', due: '', exception: '', page: 1, pageSize: 10, overlay: null as Overlay }

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('<button', '<button data-skip-page-rerender="true"')
    .replaceAll('<select', '<select data-skip-page-rerender="true"')
    .replaceAll('<input', '<input data-skip-page-rerender="true"')
}

function getOrderStyleLabel(order: WaterSolubleWorkOrder): string {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)
  const styleCode = productionOrder?.demandSnapshot.spuCode?.trim() || ''
  const styleName = productionOrder?.demandSnapshot.spuName?.trim() || ''
  if (styleCode && styleName) return `${styleCode} / ${styleName}`
  return styleCode || styleName || '未记录'
}

function statusTone(status: WaterSolubleWorkOrderStatus) {
  if (status === 'DONE') return 'success' as const
  if (status === 'PRODUCTION_PAUSED' || status === 'RECEIPT_DIFFERENCE') return 'danger' as const
  if (status === 'WAIT_FACTORY_ASSIGNMENT' || status === 'WAIT_HANDOVER') return 'warning' as const
  return 'info' as const
}

function filteredOrders(): WaterSolubleWorkOrder[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listWaterSolubleWorkOrders().filter((order) => {
    if (keyword && ![order.waterOrderNo, order.productionOrderNo, order.materialCode, order.materialName].some((value) => value.toLowerCase().includes(keyword))) return false
    if (state.status && order.status !== state.status) return false
    if (state.factoryId && order.factoryId !== state.factoryId) return false
    if (state.due === 'UNSCHEDULED' && false) return false
    if (state.exception === 'YES' && !order.exceptionReason) return false
    if (state.exception === 'NO' && order.exceptionReason) return false
    return true
  })
}

function renderActions(order: WaterSolubleWorkOrder): string {
  const detail = withSkipPageRerender(renderButton({ label: '查看详情', size: 'sm', action: { prefix: 'water-soluble', action: 'open-detail' }, className: `!px-2`, }))
    .replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  const assign = order.status === 'WAIT_FACTORY_ASSIGNMENT'
    ? withSkipPageRerender(renderButton({ label: '分配染厂', size: 'sm', variant: 'primary', action: { prefix: 'water-soluble', action: 'open-assign' }, className: '!px-2' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
    : ''
  const task = order.taskId
    ? withSkipPageRerender(renderButton({ label: '查看任务', size: 'sm', action: { prefix: 'water-soluble', action: 'open-task' }, className: '!px-2' }))
      .replace('<button', `<button data-task-id="${escapeHtml(order.taskId)}"`)
    : '<span class="text-xs text-muted-foreground">任务入口未就绪</span>'
  const handover = order.handoverOrderId
    ? withSkipPageRerender(renderButton({ label: '查看交接', size: 'sm', action: { prefix: 'water-soluble', action: 'open-handover' }, className: '!px-2' }))
      .replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}" data-handover-order-id="${escapeHtml(order.handoverOrderId)}"`)
    : ''
  return `<div class="flex min-w-[210px] flex-wrap gap-2">${detail}${assign}${task}${handover}<span class="text-xs text-muted-foreground">执行、异常与交接在详情中查看</span></div>`
}

const columns: TableColumn<WaterSolubleWorkOrder>[] = [
  { key: 'waterOrderNo', title: '加工单号', minWidth: '190px', render: (o) => `<div class="font-mono text-xs">${escapeHtml(o.waterOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(o.productionOrderNo)}</div>` },
  { key: 'materialName', title: '物料', minWidth: '170px', render: (o) => `<div>${escapeHtml(o.materialName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(o.materialCode)} · ${escapeHtml(o.materialSpec)}</div>` },
  { key: 'style', title: '款号或款式', minWidth: '160px', render: (o) => escapeHtml(getOrderStyleLabel(o)) },
  { key: 'plannedQty', title: '计划 / 完成', minWidth: '120px', render: (o) => `${o.plannedQty.toLocaleString('zh-CN')} / ${o.completedQty.toLocaleString('zh-CN')} ${escapeHtml(o.qtyUnit)}` },
  { key: 'factoryName', title: '染厂', render: (o) => escapeHtml(o.factoryName || '待分配') },
  { key: 'status', title: '状态', render: (o) => renderBadge(WATER_SOLUBLE_STATUS_LABEL[o.status], statusTone(o.status)) },
  { key: 'createdAt', title: '计划交期', render: () => '<span class="text-muted-foreground">未排期</span>' },
  { key: 'exceptionReason', title: '异常', render: (o) => o.exceptionReason ? renderBadge(o.exceptionReason, 'danger') : '无异常' },
  { key: 'techPackVersionId', title: '技术包版本', minWidth: '150px', render: (o) => escapeHtml(o.techPackVersionId) },
  { key: 'actions', title: '操作', minWidth: '230px', render: renderActions },
]

function renderFilters(): string {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true }).filter((factory) => canAssignWaterSolubleFactory(factory.id).ok)
  return withSkipPageRerender(`<section class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
    <input class="h-9 rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="加工单号 / 生产单号 / 物料" data-water-soluble-field="keyword">
    <select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="status"><option value="">全部状态</option>${Object.entries(WATER_SOLUBLE_STATUS_LABEL).map(([v,l]) => `<option value="${v}" ${state.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="factoryId"><option value="">全部染厂</option>${factories.map((f) => `<option value="${escapeHtml(f.id)}" ${state.factoryId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}</select>
    <select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="due"><option value="">全部交期</option><option value="UNSCHEDULED" ${state.due === 'UNSCHEDULED' ? 'selected' : ''}>未排期</option></select>
    <select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="exception"><option value="">全部异常</option><option value="YES" ${state.exception === 'YES' ? 'selected' : ''}>仅异常</option><option value="NO" ${state.exception === 'NO' ? 'selected' : ''}>无异常</option></select>
  </section>`)
}

function renderListRegion(): string {
  const all = filteredOrders()
  const totalPages = Math.max(1, Math.ceil(all.length / state.pageSize))
  state.page = Math.min(state.page, totalPages)
  const from = (state.page - 1) * state.pageSize
  const rows = all.slice(from, from + state.pageSize)
  return `<section class="overflow-hidden rounded-lg border bg-card" data-water-soluble-list-region>${renderTable(columns, rows, { compact: true, emptyText: '暂无符合条件的独立水溶加工单', className: 'min-w-[1580px]' })}<div data-testid="water-soluble-pagination">${withSkipPageRerender(renderTablePagination({ total: all.length, from: all.length ? from + 1 : 0, to: Math.min(from + state.pageSize, all.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'water-soluble', fieldPrefix: 'water-soluble', pageSizeOptions: [...PAGE_SIZE_OPTIONS] }))}</div></section>`
}

function supervisorDecisionLabel(order: WaterSolubleWorkOrder): string {
  const labels = {
    CONTINUE_PROCESSING: '继续补做',
    CONTINUE_WITH_ACTUAL_QTY: '按实际数量继续交出',
    RETURN_FOR_REWORK: '退回重做',
  } as const
  return order.supervisorDecision ? labels[order.supervisorDecision] : '未处理'
}

function renderDetail(order: WaterSolubleWorkOrder): string {
  const logs = order.actionLogs.map((log) => `<li class="border-l-2 pl-3"><div class="font-medium">${escapeHtml(log.action)}</div><div class="text-xs text-muted-foreground">${escapeHtml(log.at)} · ${escapeHtml(log.detail)}</div></li>`).join('')
  const supervisorLogs = order.actionLogs.filter((log) => log.action.includes('主管'))
  const content = `<div class="space-y-5"><section class="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2"><div>来源生产单：${escapeHtml(order.productionOrderNo)}</div><div>款号或款式：${escapeHtml(getOrderStyleLabel(order))}</div><div>技术包版本：${escapeHtml(order.techPackVersionId)}</div><div>来源产物：${escapeHtml(order.sourceArtifactId)}</div><div>BOM 物料：${escapeHtml(order.bomItemId)}</div></section><section><h3 class="font-semibold">物料与数量</h3><p class="mt-2">${escapeHtml(order.materialName)}（${escapeHtml(order.materialCode)}）</p><p>${order.completedQty} / ${order.plannedQty} ${escapeHtml(order.qtyUnit)}，差异 ${order.completedQty - order.plannedQty} ${escapeHtml(order.qtyUnit)}</p></section><section><h3 class="font-semibold">工艺要求</h3><p class="mt-2">独立水溶加工；物料 ${escapeHtml(order.materialName)}，规格 ${escapeHtml(order.materialSpec)}。</p><p class="text-sm text-muted-foreground">按正式技术包版本 ${escapeHtml(order.techPackVersionId)} 执行。本单仅做水溶，不包含染色；数量沿用原 BOM 单位 ${escapeHtml(order.qtyUnit)}。</p></section><section><h3 class="font-semibold">PDA 执行记录</h3><p class="mt-2">任务号：${escapeHtml(order.taskNo)}；当前状态：${WATER_SOLUBLE_STATUS_LABEL[order.status]}。</p><p class="text-sm text-muted-foreground">领域暂未记录结构化 PDA 操作人；以下只展示真实领域动作。</p><ul class="mt-2 space-y-3">${logs}</ul></section><section><h3 class="font-semibold">交接与收货结果</h3><p class="mt-2">交出数量：${order.handoverQty === undefined ? '未发生' : `${order.handoverQty} ${escapeHtml(order.qtyUnit)}`}；收货数量：${order.receivedQty === undefined ? '未发生' : `${order.receivedQty} ${escapeHtml(order.qtyUnit)}`}。</p><p class="text-sm text-muted-foreground">当前状态：${WATER_SOLUBLE_STATUS_LABEL[order.status]}。</p></section><section><h3 class="font-semibold">主管处理记录</h3><p class="mt-2">处理决定：${supervisorDecisionLabel(order)}。</p>${supervisorLogs.length ? `<ul class="mt-2 space-y-2">${supervisorLogs.map((log) => `<li>${escapeHtml(log.action)} · ${escapeHtml(log.detail)} · ${escapeHtml(log.at)}</li>`).join('')}</ul>` : '<p class="text-sm text-muted-foreground">暂无主管处理记录。</p>'}</section></div>`
  return withSkipPageRerender(renderDetailDrawer({ title: '水溶加工单详情', subtitle: order.waterOrderNo, closeAction: { prefix: 'water-soluble', action: 'close-overlay' }, width: 'lg' }, content))
}

function renderAssign(order: WaterSolubleWorkOrder): string {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .filter((factory) => canAssignWaterSolubleFactory(factory.id).ok)
  return withSkipPageRerender(renderSimpleDrawer({ prefix: 'water-soluble', closeAction: 'close-overlay', title: '分配染厂', subtitle: order.waterOrderNo, width: 'sm', content: `<p class="mb-3 text-sm text-muted-foreground">只能选择具备水溶能力且允许派单的染厂；领域规则会在提交时再次校验。</p><select class="h-10 w-full rounded-md border px-3" data-water-soluble-field="assignFactoryId"><option value="">请选择染厂</option>${factories.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('')}</select><button class="mt-4 h-10 w-full rounded-md bg-blue-600 text-white" data-water-soluble-action="confirm-assign" data-order-id="${escapeHtml(order.waterOrderId)}">确认分配</button>` }))
}

function renderOverlay(): string {
  if (!state.overlay) return ''
  const order = listWaterSolubleWorkOrders().find((item) => item.waterOrderId === state.overlay?.orderId)
  if (!order) return ''
  return state.overlay.type === 'detail' ? renderDetail(order) : renderAssign(order)
}

export function renderProcessWaterSolubleOrdersPage(): string {
  return `<div class="space-y-4 p-4" data-testid="water-soluble-orders-page" data-skip-page-rerender="true"><header><h1 class="text-xl font-semibold">水溶加工单</h1><p class="text-sm text-muted-foreground">仅展示由 BOM 物料“仅水溶”生成的独立加工单；含水溶的染色单仍在染色加工单管理。</p></header>${renderFilters()}${renderListRegion()}<div data-water-soluble-overlay>${renderOverlay()}</div>${renderToastContainer('top-right')}</div>`
}

function refreshList(): void { const node = document.querySelector<HTMLElement>('[data-water-soluble-list-region]'); if (node) node.outerHTML = renderListRegion() }
function refreshOverlay(): void { const node = document.querySelector<HTMLElement>('[data-water-soluble-overlay]'); if (node) node.innerHTML = renderOverlay() }
function showToast(message: string, ok: boolean): void { const root = document.querySelector<HTMLElement>('[data-toast-container]'); if (root) root.insertAdjacentHTML('afterbegin', renderToast({ title: ok ? '操作成功' : '无法操作', description: message, variant: ok ? 'success' : 'danger' })) }

export function handleProcessWaterSolubleOrdersEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-water-soluble-field]')
  if (field) {
    const name = field.dataset.waterSolubleField
    if (name === 'assignFactoryId') return true
    if (name === 'keyword') state.keyword = field.value
    else if (name === 'status') state.status = field.value
    else if (name === 'factoryId') state.factoryId = field.value
    else if (name === 'due') state.due = field.value
    else if (name === 'exception') state.exception = field.value
    else if (name === 'pageSize') {
      const pageSize = Number(field.value)
      state.pageSize = PAGE_SIZE_OPTIONS.includes(pageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? pageSize : 10
    }
    state.page = 1; refreshList(); return true
  }
  const actionNode = target.closest<HTMLElement>('[data-water-soluble-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.waterSolubleAction || ''
  if (action === 'open-task') { const taskId = actionNode.dataset.taskId || ''; if (!taskId) return false; appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(taskId)}`); return true }
  if (action === 'open-handover') { const handoverOrderId = actionNode.dataset.handoverOrderId || ''; if (!handoverOrderId) return false; appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(handoverOrderId)}`); return true }
  if (action === 'open-detail' || action === 'open-assign') { state.overlay = { type: action === 'open-detail' ? 'detail' : 'assign', orderId: actionNode.dataset.orderId || '' }; refreshOverlay(); return true }
  if (action === 'close-overlay') { state.overlay = null; refreshOverlay(); return true }
  if (action === 'confirm-assign') { const factoryId = document.querySelector<HTMLSelectElement>('[data-water-soluble-field="assignFactoryId"]')?.value || ''; const result = assignWaterSolubleFactory(actionNode.dataset.orderId || '', factoryId); showToast(result.message, result.ok); if (result.ok) { state.overlay = null; refreshOverlay(); refreshList() } return true }
  if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refreshList(); return true
}

export function isProcessWaterSolubleOrdersOverlayOpen(): boolean { return state.overlay !== null }
export function closeProcessWaterSolubleOrdersOverlay(): void { state.overlay = null; refreshOverlay() }
