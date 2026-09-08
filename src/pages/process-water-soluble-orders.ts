// @page-pattern: list

import { renderBadge } from '../components/ui/badge.ts'
import { renderButton } from '../components/ui/button.ts'
import { renderDetailDrawer, renderSimpleDrawer } from '../components/ui/drawer.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
// renderStandardListTable 和 renderTablePagination 由现有列表控制器统一渲染。
import { renderToast, renderToastContainer } from '../components/ui/toast.ts'
import { canAssignWaterSolubleFactory, assignWaterSolubleFactory, listWaterSolubleWorkOrders, WATER_SOLUBLE_STATUS_LABEL, type WaterSolubleWorkOrder, type WaterSolubleWorkOrderStatus } from '../data/fcs/water-soluble-task-domain.ts'
import { listBusinessFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { renderProcessOrderTaskRelations } from './process-order-task-relations.ts'

type Overlay = { type: 'detail' | 'assign'; orderId: string } | null
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const state = { keyword: '', status: '', factoryId: '', due: '', exception: '', currentPage: 1, sort: null as ProcessOrderListControllerState['sort'], preferences: { order: [], visibleKeys: [], frozenKeys: ['waterOrderNo'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, overlay: null as Overlay }

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

function getOrderImage(order: WaterSolubleWorkOrder, kind: 'style' | 'material'): string {
  const snapshot = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)?.techPackSnapshot
  if (!snapshot || snapshot.sourceTechPackVersionId !== order.techPackVersionId) return ''
  const bom = snapshot.bomItems.find((item) => item.id === order.bomItemId && item.materialCode === order.materialCode)
  const candidate = kind === 'style' ? snapshot.imageSnapshot.styleImages[0] : bom?.materialImageUrl
  const url = candidate?.trim() || ''
  // 这批旧演示快照中的通用白T、布样和文字SVG不能代表印花款式或12毫米水溶花边。
  if (!url || url.startsWith('data:image/svg') || ['/tshirt-sample.jpg', '/materials/fabric-main.jpg', '/materials/fabric-contrast.jpg', '/placeholder.svg'].includes(url)) return ''
  return /^(?:https?:\/\/|\/|data:image\/(?:png|jpeg|webp);)/i.test(url) ? url : ''
}

function renderOrderObject(order: WaterSolubleWorkOrder, kind: 'style' | 'material'): string {
  const label = kind === 'style' ? getOrderStyleLabel(order) : order.materialName
  const description = kind === 'style' ? '' : `${order.materialCode} · ${order.materialSpec}`
  const imageUrl = getOrderImage(order, kind)
  const imageHtml = imageUrl
    ? `<button type="button" class="relative h-12 w-12 shrink-0 overflow-hidden rounded border bg-white" data-skip-page-rerender="true" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}大图"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white text-[10px] text-muted-foreground">图片加载中</span></button>`
    : ''
  return `<div class="flex items-start gap-2" data-water-soluble-object="${kind}">${imageHtml}<div class="min-w-0"><div class="break-words">${escapeHtml(label)}</div>${description ? `<div class="text-xs text-muted-foreground">${escapeHtml(description)}</div>` : ''}${imageUrl ? '' : `<p class="mt-1 text-xs text-amber-700">${kind === 'style' ? '款式' : '物料'}原图缺失，待补准确素材</p>`}</div></div>`
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

const columns: StandardListColumn<WaterSolubleWorkOrder>[] = [
  { key: 'waterOrderNo', width: 190, freezeable: true, required: true, sortable: true, sortValue: (o) => o.waterOrderNo,  title: '加工单号', render: (o) => `<div class="font-mono text-xs">${escapeHtml(o.waterOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(o.productionOrderNo)}</div>` },
  { key: 'materialName', width: 200, freezeable: true, sortable: true, sortValue: (o) => o.materialName,  title: '物料', render: (o) => renderOrderObject(o, 'material') },
  { key: 'style', width: 180, freezeable: true, sortable: true, sortValue: (o) => getOrderStyleLabel(o),  title: '款号或款式', render: (o) => renderOrderObject(o, 'style') },
  { key: 'plannedQty', width: 145, freezeable: true, sortable: true, sortValue: (o) => o.plannedQty,  title: '计划 / 完成', render: (o) => `${o.plannedQty.toLocaleString('zh-CN')} / ${o.completedQty.toLocaleString('zh-CN')} ${escapeHtml(o.qtyUnit)}` },
  { key: 'factoryName', width: 150, freezeable: true, sortable: true, sortValue: (o) => o.factoryName,  title: '染厂', render: (o) => escapeHtml(o.factoryName || '待分配') },
  { key: 'status', width: 140, freezeable: true, sortable: true, sortValue: (o) => WATER_SOLUBLE_STATUS_LABEL[o.status],  title: '状态', render: (o) => renderBadge(WATER_SOLUBLE_STATUS_LABEL[o.status], statusTone(o.status)) },
  { key: 'createdAt', width: 130, freezeable: true, sortable: true, sortValue: (o) => '未排期',  title: '计划交期', render: () => '<span class="text-muted-foreground">未排期</span>' },
  { key: 'exceptionReason', width: 160, freezeable: true, sortable: true, sortValue: (o) => o.exceptionReason,  title: '异常', render: (o) => o.exceptionReason ? renderBadge(o.exceptionReason, 'danger') : '无异常' },
  { key: 'techPackVersionId', width: 170, freezeable: true, sortable: true, sortValue: (o) => o.techPackVersionId,  title: '技术包版本', render: (o) => escapeHtml(o.techPackVersionId) },
  { key: 'actions', width: 260, required: true, actionColumn: true,  title: '操作', render: renderActions },
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

const listController = createProcessOrderListController({
  state, columns,
  preferenceKey: '/fcs/process/water-soluble-orders:list-columns',
  pageSizeOptions: [...PAGE_SIZE_OPTIONS], eventPrefix: 'water-soluble',
  rootSelector: '[data-testid="water-soluble-orders-page"]',
  tableSurfaceSelector: '[data-water-soluble-list-region]',
  paginationSurfaceSelector: '[data-testid="water-soluble-pagination"]',
  overlaysSurfaceSelector: '[data-water-soluble-column-overlay]',
  defaultFrozenKeys: ['waterOrderNo'], columnSettingsTitle: '水溶加工单列设置',
  emptyText: '暂无符合条件的独立水溶加工单', getRows: filteredOrders, locallyManagedEvents: true,
})

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
  const content = `<div class="space-y-5"><section class="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2"><div>来源生产单：${escapeHtml(order.productionOrderNo)}</div><div>款号或款式：${renderOrderObject(order, 'style')}</div><div>技术包版本：${escapeHtml(order.techPackVersionId)}</div><div>来源产物：${escapeHtml(order.sourceArtifactId)}</div><div>BOM 物料：${escapeHtml(order.bomItemId)}</div></section>${renderProcessOrderTaskRelations(order.waterOrderId)}<section><h3 class="font-semibold">物料与数量</h3><div class="mt-2">${renderOrderObject(order, 'material')}</div><p>${order.completedQty} / ${order.plannedQty} ${escapeHtml(order.qtyUnit)}，差异 ${order.completedQty - order.plannedQty} ${escapeHtml(order.qtyUnit)}</p></section><section><h3 class="font-semibold">工艺要求</h3><p class="mt-2">独立水溶加工；物料 ${escapeHtml(order.materialName)}，规格 ${escapeHtml(order.materialSpec)}。</p><p class="text-sm text-muted-foreground">按正式技术包版本 ${escapeHtml(order.techPackVersionId)} 执行。本单仅做水溶，不包含染色；数量沿用原 BOM 单位 ${escapeHtml(order.qtyUnit)}。</p></section><section><h3 class="font-semibold">PDA 执行记录</h3><p class="mt-2">任务号：${escapeHtml(order.taskNo)}；当前状态：${WATER_SOLUBLE_STATUS_LABEL[order.status]}。</p><p class="text-sm text-muted-foreground">领域暂未记录结构化 PDA 操作人；以下只展示真实领域动作。</p><ul class="mt-2 space-y-3">${logs}</ul></section><section><h3 class="font-semibold">交接与收货结果</h3><p class="mt-2">交出数量：${order.handoverQty === undefined ? '未发生' : `${order.handoverQty} ${escapeHtml(order.qtyUnit)}`}；收货数量：${order.receivedQty === undefined ? '未发生' : `${order.receivedQty} ${escapeHtml(order.qtyUnit)}`}。</p><p class="text-sm text-muted-foreground">当前状态：${WATER_SOLUBLE_STATUS_LABEL[order.status]}。</p></section><section><h3 class="font-semibold">主管处理记录</h3><p class="mt-2">处理决定：${supervisorDecisionLabel(order)}。</p>${supervisorLogs.length ? `<ul class="mt-2 space-y-2">${supervisorLogs.map((log) => `<li>${escapeHtml(log.action)} · ${escapeHtml(log.detail)} · ${escapeHtml(log.at)}</li>`).join('')}</ul>` : '<p class="text-sm text-muted-foreground">暂无主管处理记录。</p>'}</section></div>`
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
  resetStandardListEntryTransientStateOnRouteEntry(state, typeof document !== 'undefined' && Boolean(document.querySelector('[data-testid="water-soluble-orders-page"]')))
  listController.installColumnDragEvents()
  const view = listController.getView()
  return `<div data-testid="water-soluble-orders-page" data-skip-page-rerender="true">${renderStandardListPage({
    title: '水溶加工单',
    feedbackHtml: '<p class="text-sm text-muted-foreground">仅展示由 BOM 物料“仅水溶”生成的独立加工单；含水溶的染色单仍在染色加工单管理。</p>',
    filtersHtml: renderFilters(), listTitle: '水溶加工单',
    listActionsHtml: withSkipPageRerender(renderButton({ label: '列设置', size: 'sm', action: { prefix: 'water-soluble', action: 'open-column-settings' } })),
    tableHtml: `<div data-water-soluble-list-region>${view.tableHtml}</div>`,
    paginationHtml: `<div data-testid="water-soluble-pagination">${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-water-soluble-column-overlay>${listController.renderColumnSettings()}</div><div data-water-soluble-overlay>${renderOverlay()}</div>${renderToastContainer('top-right')}`,
  })}</div>`
}

function refreshList(): void { listController.refresh() }

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
      listController.setPageSize(pageSize)
    }
    state.currentPage = 1; refreshList(); return true
  }
  const actionNode = target.closest<HTMLElement>('[data-water-soluble-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.waterSolubleAction || ''
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    state.showColumnSettings = action === 'open-column-settings'
    listController.refresh({ table: false, pagination: false, overlays: true }); return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset.waterSolubleColumnKey || actionNode.closest<HTMLElement>('[data-water-soluble-column-key]')?.dataset.waterSolubleColumnKey || ''
    listController.updateColumnPreference(action, key, actionNode instanceof HTMLInputElement ? actionNode.checked : undefined)
    listController.refresh({ overlays: true }); return true
  }
  if (action === 'restore-column-settings') { listController.restorePreferences(); listController.refresh({ overlays: true }); return true }
  if (action === 'open-task') { const taskId = actionNode.dataset.taskId || ''; if (!taskId) return false; appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(taskId)}`); return true }
  if (action === 'open-handover') { const handoverOrderId = actionNode.dataset.handoverOrderId || ''; if (!handoverOrderId) return false; appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(handoverOrderId)}`); return true }
  if (action === 'open-detail' || action === 'open-assign') { state.overlay = { type: action === 'open-detail' ? 'detail' : 'assign', orderId: actionNode.dataset.orderId || '' }; refreshOverlay(); return true }
  if (action === 'close-overlay') { state.overlay = null; refreshOverlay(); return true }
  if (action === 'confirm-assign') { const factoryId = document.querySelector<HTMLSelectElement>('[data-water-soluble-field="assignFactoryId"]')?.value || ''; const result = assignWaterSolubleFactory(actionNode.dataset.orderId || '', factoryId); showToast(result.message, result.ok); if (result.ok) { state.overlay = null; refreshOverlay(); refreshList() } return true }
  if (action === 'prev-page') listController.stepPage(-1)
  else if (action === 'next-page') listController.stepPage(1)
  else if (action === 'sort-column') listController.cycleSort(actionNode.dataset.columnKey || '')
  else return false
  refreshList(); return true
}

export function isProcessWaterSolubleOrdersOverlayOpen(): boolean { return state.overlay !== null || state.showColumnSettings }
export function closeProcessWaterSolubleOrdersOverlay(): void { state.overlay = null; state.showColumnSettings = false; refreshOverlay(); listController.refresh({ table: false, pagination: false, overlays: true }) }
