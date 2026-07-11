import { renderBadge } from '../../../components/ui/badge.ts'
import { renderButton } from '../../../components/ui/button.ts'
import { renderDialog, renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'
import { renderDetailDrawer } from '../../../components/ui/drawer.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderToast, renderToastContainer } from '../../../components/ui/toast.ts'
import {
  WATER_SOLUBLE_STATUS_LABEL,
  executeWaterSolublePdaAction,
  getWaterSolubleCurrentAction,
  getWaterSolubleWorkOrderById,
  listWaterSolubleWorkOrders,
  type WaterSolubleActionResult,
  type WaterSolubleSupervisorDecision,
  type WaterSolubleWorkOrder,
} from '../../../data/fcs/water-soluble-task-domain.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { ensureHandoverOrderForStartedTask } from '../../../data/fcs/pda-handover-events.ts'
import { getPdaRuntimeContext } from '../../pda-runtime.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

type Overlay =
  | { type: 'detail' | 'supervisor' | 'handover' | 'completion'; orderId: string }
  | { type: 'completion-overage'; orderId: string }
  | { type: 'supervisor-confirm'; orderId: string; decision: WaterSolubleSupervisorDecision }
  | null
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
type WaterSolubleRoleAction = 'OPERATE' | 'SUPERVISE' | 'HANDOVER'
const ACTION_ALLOWED_ROLE_IDS: Record<WaterSolubleRoleAction, readonly string[]> = {
  OPERATE: ['ROLE_OPERATOR', 'ROLE_PRODUCTION', 'ROLE_ADMIN'],
  SUPERVISE: ['ROLE_PRODUCTION', 'ROLE_ADMIN'],
  HANDOVER: ['ROLE_HANDOVER', 'ROLE_ADMIN'],
}
const ACTION_ROLE_ERROR: Record<WaterSolubleRoleAction, string> = {
  OPERATE: '当前角色不能执行水溶操作。',
  SUPERVISE: '当前角色不能处理生产暂停。',
  HANDOVER: '当前角色不能确认交出。',
}
const state = {
  status: '',
  page: 1,
  pageSize: 10,
  overlay: null as Overlay,
  overlayToken: '',
  completionDraft: { orderId: '', completedQty: '', reason: '' },
}
let overlaySequence = 0

function setOverlay(overlay: NonNullable<Overlay>): void {
  state.overlay = overlay
  state.overlayToken = `${overlay.orderId}:${++overlaySequence}`
}

function clearOverlay(): void {
  state.overlay = null
  state.overlayToken = ''
}

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('<button', '<button data-skip-page-rerender="true"')
    .replaceAll('<select', '<select data-skip-page-rerender="true"')
    .replaceAll('<input', '<input data-skip-page-rerender="true"')
}

function getRequestedFactoryId(): string | null {
  const [, query = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(query)
  return params.get('factoryId') || params.get('currentFactoryId') || params.get('pdaFactoryId')
}

function normalizePageSize(value: unknown): number {
  const normalized = Number(value)
  return PAGE_SIZE_OPTIONS.includes(normalized as (typeof PAGE_SIZE_OPTIONS)[number]) ? normalized : 10
}

function canRolePerformWaterSolubleAction(roleId: string, action: WaterSolubleRoleAction): boolean {
  return ACTION_ALLOWED_ROLE_IDS[action].includes(roleId)
}

function scopedOrders(): WaterSolubleWorkOrder[] {
  const runtime = getPdaRuntimeContext()
  const requestedFactoryId = getRequestedFactoryId()
  return listWaterSolubleWorkOrders().filter((order) => {
    if (!order.factoryId) return false
    if (runtime && order.factoryId !== runtime.factoryId) return false
    if (runtime && requestedFactoryId && requestedFactoryId !== runtime.factoryId) return false
    if (!runtime && requestedFactoryId && order.factoryId !== requestedFactoryId) return false
    return !state.status || order.status === state.status
  })
}

function getAuthorizedOrder(orderId: string, expectedStatuses?: WaterSolubleWorkOrder['status'][], roleAction?: WaterSolubleRoleAction): { order: WaterSolubleWorkOrder | null; message: string } {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return { order: null, message: '当前为管理预览，只能查看，不能执行工厂动作。' }
  const order = getWaterSolubleWorkOrderById(orderId)
  if (!order) return { order: null, message: `未找到水溶加工单“${orderId}”。` }
  if (!order.factoryId || order.factoryId !== runtime.factoryId) {
    return { order: null, message: '当前账号不属于该加工单工厂，不能执行此操作。' }
  }
  if (roleAction && !canRolePerformWaterSolubleAction(runtime.roleId, roleAction)) {
    return { order: null, message: ACTION_ROLE_ERROR[roleAction] }
  }
  if (expectedStatuses && !expectedStatuses.includes(order.status)) {
    return { order: null, message: `当前状态为“${WATER_SOLUBLE_STATUS_LABEL[order.status]}”，不能执行此操作。` }
  }
  return { order, message: '' }
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

function getRoleActionForStatus(status: WaterSolubleWorkOrder['status']): WaterSolubleRoleAction | null {
  if (['WAIT_MATERIAL', 'WAIT_WATER_SOLUBLE', 'WATER_SOLUBLE_IN_PROGRESS'].includes(status)) return 'OPERATE'
  if (status === 'PRODUCTION_PAUSED') return 'SUPERVISE'
  if (status === 'WAIT_HANDOVER') return 'HANDOVER'
  return null
}

function renderPrimaryAction(order: WaterSolubleWorkOrder, roleId: string | null): string {
  const roleAction = getRoleActionForStatus(order.status)
  if (!roleId) return '<div class="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">只读查看</div>'
  if (roleAction && !canRolePerformWaterSolubleAction(roleId, roleAction)) return '<div class="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">等待有权限角色处理</div>'
  const current = getWaterSolubleCurrentAction(order.waterOrderId)
  if (!current) return ''
  if (order.status === 'PRODUCTION_PAUSED') return withSkipPageRerender(renderButton({ label: '主管处理', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'open-supervisor' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_HANDOVER') return withSkipPageRerender(renderButton({ label: '现在交出', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'open-handover' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_MATERIAL') return withSkipPageRerender(renderButton({ label: '确认原料到位', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'material-ready' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_WATER_SOLUBLE') return withSkipPageRerender(renderButton({ label: '开始水溶', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'start' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') return withSkipPageRerender(renderButton({ label: '上报完成数量', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'complete' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  return `<div class="rounded-md bg-muted px-3 py-2 text-center text-sm">${escapeHtml(current.actionName)}</div>`
}

function renderCard(order: WaterSolubleWorkOrder): string {
  const runtime = getPdaRuntimeContext()
  const canOperate = Boolean(runtime && order.factoryId === runtime.factoryId)
  const current = getWaterSolubleCurrentAction(order.waterOrderId)
  return `<article class="rounded-xl border bg-card p-4 shadow-sm" data-testid="factory-water-soluble-card" data-order-id="${escapeHtml(order.waterOrderId)}">
    <div class="flex flex-wrap items-start justify-between gap-2"><div><div class="font-mono text-xs text-muted-foreground">${escapeHtml(order.waterOrderNo)}</div><h2 class="mt-1 font-semibold">${escapeHtml(order.materialName)}</h2><p class="text-xs text-muted-foreground">${escapeHtml(order.materialCode)} · ${escapeHtml(order.productionOrderNo)}</p></div>${renderBadge(WATER_SOLUBLE_STATUS_LABEL[order.status], order.exceptionReason ? 'danger' : order.status === 'WATER_SOLUBLE_IN_PROGRESS' ? 'info' : 'warning')}</div>
    <div class="mt-4 rounded-lg bg-blue-50 p-3"><div class="text-xs text-blue-700">当前要做什么</div><div class="mt-1 font-semibold text-blue-900">${escapeHtml(current?.actionName || '查看状态')}</div><p class="mt-1 text-xs text-blue-700">${escapeHtml(current?.message || '')}</p></div>
    <dl class="mt-4 grid grid-cols-3 gap-2 text-center"><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">计划</dt><dd class="mt-1 font-medium">${qty(order.plannedQty, order.qtyUnit)}</dd></div><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">完成</dt><dd class="mt-1 font-medium">${qty(order.completedQty, order.qtyUnit)}</dd></div><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">差异</dt><dd class="mt-1 font-medium ${order.completedQty < order.plannedQty ? 'text-amber-700' : ''}">${difference(order)}</dd></div></dl>
    <div class="mt-3 text-xs text-muted-foreground">PDA 操作人：领域暂未记录 · 最近操作：${lastLog(order)}</div>${order.exceptionReason ? `<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">${escapeHtml(order.exceptionReason)}</div>` : ''}
    <div class="mt-4 space-y-2">${renderPrimaryAction(order, canOperate ? runtime!.roleId : null)}${canOperate ? `<button data-skip-page-rerender="true" class="w-full text-center text-sm text-blue-600 hover:underline" data-factory-water-soluble-action="open-detail" data-order-id="${escapeHtml(order.waterOrderId)}">查看任务详情与记录</button>` : ''}</div>
  </article>`
}

function renderListRegion(): string {
  const all = scopedOrders()
  const totalPages = Math.max(1, Math.ceil(all.length / state.pageSize))
  state.page = Math.min(state.page, totalPages)
  const from = (state.page - 1) * state.pageSize
  return `<section data-factory-water-soluble-list-region><div class="grid gap-4 xl:grid-cols-2">${all.slice(from, from + state.pageSize).map(renderCard).join('') || '<div class="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">当前查看范围暂无独立水溶加工单</div>'}</div><div class="mt-4 overflow-hidden rounded-lg border bg-card" data-testid="factory-water-soluble-pagination">${withSkipPageRerender(renderTablePagination({ total: all.length, from: all.length ? from + 1 : 0, to: Math.min(from + state.pageSize, all.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'factory-water-soluble', fieldPrefix: 'factory-water-soluble', pageSizeOptions: [...PAGE_SIZE_OPTIONS] }))}</div></section>`
}

function detailDrawer(order: WaterSolubleWorkOrder): string {
  return withSkipPageRerender(renderDetailDrawer({ title: '水溶任务详情', subtitle: order.waterOrderNo, closeAction: { prefix: 'factory-water-soluble', action: 'close-overlay' }, width: 'md' }, `<div class="space-y-4"><section><h3 class="font-semibold">当前任务</h3><p class="mt-2">${escapeHtml(order.materialName)} · ${qty(order.plannedQty, order.qtyUnit)}</p><p>${WATER_SOLUBLE_STATUS_LABEL[order.status]} · ${escapeHtml(order.factoryName || '')}</p></section><section><h3 class="font-semibold">执行记录</h3><ul class="mt-2 space-y-2">${order.actionLogs.map((log) => `<li class="rounded-md bg-muted/40 p-2 text-sm">${escapeHtml(log.action)}<div class="text-xs text-muted-foreground">${escapeHtml(log.detail)} · ${escapeHtml(log.at)}</div></li>`).join('')}</ul></section></div>`))
}

const SUPERVISOR_DECISION_LABEL: Record<WaterSolubleSupervisorDecision, string> = {
  CONTINUE_PROCESSING: '继续补做',
  CONTINUE_WITH_ACTUAL_QTY: '按实际数量继续交出',
  RETURN_FOR_REWORK: '退回重做',
}

function supervisorDecisionButton(orderId: string, decision: WaterSolubleSupervisorDecision): string {
  return renderButton({ label: SUPERVISOR_DECISION_LABEL[decision], variant: decision === 'RETURN_FOR_REWORK' ? 'danger' : decision === 'CONTINUE_WITH_ACTUAL_QTY' ? 'primary' : 'secondary', action: { prefix: 'factory-water-soluble', action: 'select-supervisor-decision' }, className: 'w-full' })
    .replace('<button', `<button data-order-id="${escapeHtml(orderId)}" data-decision="${decision}"`)
}

function renderSupervisorDialog(order: WaterSolubleWorkOrder): string {
  return withSkipPageRerender(renderDialog({ title: '主管处理数量不足', description: `${order.completedQty} / ${order.plannedQty} ${order.qtyUnit}`, closeAction: { prefix: 'factory-water-soluble', action: 'close-overlay' }, width: 'md' }, `<p class="mb-4 text-sm text-muted-foreground">请选择一种处理方式。选择后还需二次确认，避免误点。</p><div class="space-y-2">${supervisorDecisionButton(order.waterOrderId, 'CONTINUE_PROCESSING')}${supervisorDecisionButton(order.waterOrderId, 'CONTINUE_WITH_ACTUAL_QTY')}${supervisorDecisionButton(order.waterOrderId, 'RETURN_FOR_REWORK')}</div>`))
}

function renderCompletionDialog(order: WaterSolubleWorkOrder): string {
  const draft = state.completionDraft.orderId === order.waterOrderId
    ? state.completionDraft
    : { orderId: order.waterOrderId, completedQty: String(order.plannedQty), reason: '' }
  return withSkipPageRerender(renderDialog(
    {
      title: '上报完成数量',
      description: `${order.waterOrderNo} · 计划 ${qty(order.plannedQty, order.qtyUnit)}`,
      closeAction: { prefix: 'factory-water-soluble', action: 'close-overlay' },
      width: 'md',
    },
    `<div class="space-y-4"><label class="block text-sm font-medium">实际完成数量（${escapeHtml(order.qtyUnit)}）<input type="text" inputmode="decimal" class="mt-1 h-10 w-full rounded-md border px-3" value="${escapeHtml(draft.completedQty)}" data-factory-water-soluble-field="completedQty"></label><label class="block text-sm font-medium">数量差异原因<textarea class="mt-1 min-h-20 w-full rounded-md border p-3" placeholder="数量与计划不一致时必填" data-factory-water-soluble-field="completionReason">${escapeHtml(draft.reason)}</textarea></label><p class="text-xs text-muted-foreground">等量可直接上报；短量会转主管处理；超量需要再次确认。</p><button type="button" class="h-10 w-full rounded-md bg-blue-600 font-medium text-white" data-factory-water-soluble-action="confirm-completion" data-order-id="${escapeHtml(order.waterOrderId)}" data-overlay-token="${escapeHtml(state.overlayToken)}">确认上报</button></div>`,
  ))
}

function renderCompletionOverageDialog(order: WaterSolubleWorkOrder): string {
  return withSkipPageRerender(renderSimpleConfirmDialog({
    prefix: 'factory-water-soluble',
    closeAction: 'cancel-completion-overage',
    confirmAction: 'confirm-completion-overage',
    title: '确认超量完成',
    description: `${state.completionDraft.completedQty} / ${order.plannedQty} ${order.qtyUnit}`,
    confirmLabel: '确认超量并上报',
    danger: true,
    content: `<p class="text-sm">实际数量超过计划。确认后将按实际数量进入待交出，并保留原因“${escapeHtml(state.completionDraft.reason)}”。</p>`,
  }).replace('data-factory-water-soluble-action="confirm-completion-overage"', `data-factory-water-soluble-action="confirm-completion-overage" data-order-id="${escapeHtml(order.waterOrderId)}" data-overlay-token="${escapeHtml(state.overlayToken)}"`))
}

function overlay(): string {
  if (!state.overlay) return ''
  const expectedStatuses: Partial<Record<NonNullable<Overlay>['type'], WaterSolubleWorkOrder['status'][]>> = {
    supervisor: ['PRODUCTION_PAUSED'],
    'supervisor-confirm': ['PRODUCTION_PAUSED'],
    handover: ['WAIT_HANDOVER'],
    completion: ['WATER_SOLUBLE_IN_PROGRESS'],
    'completion-overage': ['WATER_SOLUBLE_IN_PROGRESS'],
  }
  const roleActionByOverlay: Partial<Record<NonNullable<Overlay>['type'], WaterSolubleRoleAction>> = {
    supervisor: 'SUPERVISE',
    'supervisor-confirm': 'SUPERVISE',
    handover: 'HANDOVER',
    completion: 'OPERATE',
    'completion-overage': 'OPERATE',
  }
  const access = getAuthorizedOrder(state.overlay.orderId, expectedStatuses[state.overlay.type], roleActionByOverlay[state.overlay.type])
  const order = access.order
  if (!order) return ''
  if (state.overlay.type === 'detail') return detailDrawer(order)
  if (state.overlay.type === 'supervisor') return renderSupervisorDialog(order)
  if (state.overlay.type === 'completion') return renderCompletionDialog(order)
  if (state.overlay.type === 'completion-overage') return renderCompletionOverageDialog(order)
  if (state.overlay.type === 'supervisor-confirm') {
    const label = SUPERVISOR_DECISION_LABEL[state.overlay.decision]
    return withSkipPageRerender(renderSimpleConfirmDialog({ prefix: 'factory-water-soluble', closeAction: 'close-overlay', confirmAction: 'confirm-supervisor-decision', title: `确认${label}`, description: order.waterOrderNo, confirmLabel: label, danger: state.overlay.decision === 'RETURN_FOR_REWORK', content: `<p class="text-sm">确认后将按“${label}”更新加工单，并记录主管处理结果。</p>` }).replace('data-factory-water-soluble-action="confirm-supervisor-decision"', `data-factory-water-soluble-action="confirm-supervisor-decision" data-order-id="${escapeHtml(order.waterOrderId)}" data-decision="${state.overlay.decision}" data-overlay-token="${escapeHtml(state.overlayToken)}"`))
  }
  return withSkipPageRerender(renderSimpleConfirmDialog({ prefix: 'factory-water-soluble', closeAction: 'close-overlay', confirmAction: 'confirm-handover', title: '确认交出', description: order.waterOrderNo, confirmLabel: `确认交出 ${order.handoverQty ?? order.completedQty} ${order.qtyUnit}`, content: '<p class="text-sm">交出后等待对方收货，本页面不伪造收货完成。</p>' }).replace('data-factory-water-soluble-action="confirm-handover"', `data-factory-water-soluble-action="confirm-handover" data-order-id="${escapeHtml(order.waterOrderId)}" data-overlay-token="${escapeHtml(state.overlayToken)}"`))
}

export function renderCraftDyeingWaterSolubleOrdersPage(): string {
  const runtime = getPdaRuntimeContext()
  const requestedFactoryId = getRequestedFactoryId()
  const scopeMessage = runtime
    ? requestedFactoryId && requestedFactoryId !== runtime.factoryId
      ? `当前登录工厂：${escapeHtml(runtime.factoryName)}。查看条件不属于当前登录工厂，不能扩大查看或操作范围。`
      : `当前登录工厂：${escapeHtml(runtime.factoryName)}。只显示并操作本厂加工单。`
    : requestedFactoryId
      ? `当前为管理预览，只读查看工厂 ${escapeHtml(requestedFactoryId)}，URL 查看条件不能开启动作。`
      : '当前为管理预览，只读查看；登录有效工厂账号后才能执行动作。'
  return `<div class="space-y-4 p-4" data-testid="factory-water-soluble-orders-page" data-skip-page-rerender="true"><header><h1 class="text-xl font-semibold">水溶加工单</h1><p class="text-sm text-muted-foreground">${scopeMessage} 仅含独立水溶加工单，含水溶染色任务仍在染色加工单。</p></header><select data-skip-page-rerender="true" class="h-9 rounded-md border px-3 text-sm" data-factory-water-soluble-field="status"><option value="">全部状态</option>${Object.entries(WATER_SOLUBLE_STATUS_LABEL).map(([v,l]) => `<option value="${v}" ${state.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${renderListRegion()}<div data-factory-water-soluble-overlay>${overlay()}</div>${renderToastContainer('top-right')}</div>`
}

function refreshList() { const node = document.querySelector<HTMLElement>('[data-factory-water-soluble-list-region]'); if (node) node.outerHTML = renderListRegion() }
function refreshOverlay() { const node = document.querySelector<HTMLElement>('[data-factory-water-soluble-overlay]'); if (node) node.innerHTML = overlay() }
function toast(result: WaterSolubleActionResult) { const root = document.querySelector<HTMLElement>('[data-toast-container]'); if (root) root.insertAdjacentHTML('afterbegin', renderToast({ title: result.ok ? '操作成功' : '无法操作', description: result.message, variant: result.ok ? 'success' : 'danger' })) }
function run(result: WaterSolubleActionResult) { toast(result); if (result.ok) { clearOverlay(); refreshOverlay(); refreshList() } }
function rejectAction(message: string): void { toast({ ok: false, message }) }

function clearCompletionDraft(): void {
  state.completionDraft = { orderId: '', completedQty: '', reason: '' }
}

function hasCurrentOverlay(type: NonNullable<Overlay>['type'], orderId: string): boolean {
  return state.overlay?.type === type && state.overlay.orderId === orderId
}

export function handleCraftDyeingWaterSolubleOrdersEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-factory-water-soluble-field]')
  if (field) {
    const fieldName = field.dataset.factoryWaterSolubleField
    if (fieldName === 'completedQty') {
      state.completionDraft.completedQty = field.value
      return true
    }
    if (fieldName === 'completionReason') {
      state.completionDraft.reason = field.value
      return true
    }
    if (fieldName === 'status') state.status = field.value
    if (fieldName === 'pageSize') state.pageSize = normalizePageSize(field.value)
    state.page = 1
    refreshList()
    return true
  }
  const node = target.closest<HTMLElement>('[data-factory-water-soluble-action]')
  if (!node) return false
  const action = node.dataset.factoryWaterSolubleAction || ''; const orderId = node.dataset.orderId || state.overlay?.orderId || ''
  if (action === 'open-detail' || action === 'open-supervisor' || action === 'open-handover') {
    const expected = action === 'open-supervisor' ? ['PRODUCTION_PAUSED'] as WaterSolubleWorkOrder['status'][] : action === 'open-handover' ? ['WAIT_HANDOVER'] as WaterSolubleWorkOrder['status'][] : undefined
    const roleAction = action === 'open-supervisor' ? 'SUPERVISE' : action === 'open-handover' ? 'HANDOVER' : undefined
    const access = getAuthorizedOrder(orderId, expected, roleAction)
    if (!access.order) { rejectAction(access.message); return true }
    if (action === 'open-handover') {
      try {
        const ensured = ensureHandoverOrderForStartedTask(access.order.taskId)
        appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(ensured.handoverOrderId)}?action=new-record`)
      } catch (error) {
        rejectAction(error instanceof Error ? error.message : '交出单创建失败，请重试。')
      }
      return true
    }
    const type = action.replace('open-', '') as 'detail' | 'supervisor' | 'handover'
    setOverlay({ type, orderId })
    refreshOverlay()
    return true
  }
  if (action === 'select-supervisor-decision') {
    const access = getAuthorizedOrder(orderId, ['PRODUCTION_PAUSED'], 'SUPERVISE')
    if (!access.order) { rejectAction(access.message); return true }
    const decision = node.dataset.decision as WaterSolubleSupervisorDecision | undefined
    if (!decision || !Object.hasOwn(SUPERVISOR_DECISION_LABEL, decision)) { rejectAction('请选择有效的主管处理方式。'); return true }
    setOverlay({ type: 'supervisor-confirm', orderId, decision })
    refreshOverlay()
    return true
  }
  if (action === 'close-overlay') { clearOverlay(); clearCompletionDraft(); refreshOverlay(); return true }
  if (action === 'cancel-completion-overage') {
    const access = getAuthorizedOrder(orderId, ['WATER_SOLUBLE_IN_PROGRESS'], 'OPERATE')
    if (!access.order) { clearOverlay(); clearCompletionDraft(); refreshOverlay(); rejectAction(access.message); return true }
    setOverlay({ type: 'completion', orderId })
    refreshOverlay()
    return true
  }
  if (action === 'complete') {
    const access = getAuthorizedOrder(orderId, ['WATER_SOLUBLE_IN_PROGRESS'], 'OPERATE')
    if (!access.order) { rejectAction(access.message); return true }
    state.completionDraft = { orderId, completedQty: String(access.order.plannedQty), reason: '' }
    setOverlay({ type: 'completion', orderId })
    refreshOverlay()
    return true
  }
  if (action === 'confirm-completion' || action === 'confirm-completion-overage') {
    const requiredOverlay = action === 'confirm-completion' ? 'completion' : 'completion-overage'
    if (!hasCurrentOverlay(requiredOverlay, orderId)) { rejectAction('当前确认已失效，请重新打开加工单。'); return true }
    if (!state.overlayToken || node.dataset.overlayToken !== state.overlayToken) { rejectAction('当前确认令牌已失效，请重新打开加工单。'); return true }
    const access = getAuthorizedOrder(orderId, ['WATER_SOLUBLE_IN_PROGRESS'], 'OPERATE')
    if (!access.order) { rejectAction(access.message); return true }
    if (state.completionDraft.orderId !== orderId) { rejectAction('当前填写内容已失效，请重新打开加工单。'); return true }
    const completedQty = Number(state.completionDraft.completedQty.trim())
    if (!Number.isFinite(completedQty)) { rejectAction('完成数量必须是有限数字。'); return true }
    if (completedQty <= 0) { rejectAction('完成数量必须大于 0。'); return true }
    const reason = state.completionDraft.reason.trim()
    if (completedQty !== access.order.plannedQty && !reason) { rejectAction('数量与计划不一致，请填写原因。'); return true }
    if (completedQty > access.order.plannedQty && action === 'confirm-completion') {
      setOverlay({ type: 'completion-overage', orderId })
      refreshOverlay()
      return true
    }
    const actor = getPdaSession()
    if (!actor) { rejectAction('当前登录已失效，请重新登录。'); return true }
    const result = executeWaterSolublePdaAction({ action: 'COMPLETE', orderId, taskId: access.order.taskId, expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS', expectedNode: 'COMPLETE', completedQty, reason, actor })
    if (result.ok) clearCompletionDraft()
    run(result)
    return true
  }

  const accessRuleByAction: Record<string, { statuses: WaterSolubleWorkOrder['status'][]; roleAction: WaterSolubleRoleAction }> = {
    'material-ready': { statuses: ['WAIT_MATERIAL'], roleAction: 'OPERATE' },
    start: { statuses: ['WAIT_WATER_SOLUBLE'], roleAction: 'OPERATE' },
    'confirm-supervisor-decision': { statuses: ['PRODUCTION_PAUSED'], roleAction: 'SUPERVISE' },
    'confirm-handover': { statuses: ['WAIT_HANDOVER'], roleAction: 'HANDOVER' },
  }
  const accessRule = accessRuleByAction[action]
  if (accessRule) {
    const access = getAuthorizedOrder(orderId, accessRule.statuses, accessRule.roleAction)
    if (!access.order) { rejectAction(access.message); return true }
  }
  const actor = getPdaSession()
  if ((action === 'material-ready' || action === 'start' || action === 'confirm-supervisor-decision') && !actor) {
    rejectAction('当前登录已失效，请重新登录。')
    return true
  }
  const currentOrder = getWaterSolubleWorkOrderById(orderId)
  if (action === 'material-ready') run(executeWaterSolublePdaAction({ action: 'MATERIAL_READY', orderId, taskId: currentOrder?.taskId || '', expectedStatus: 'WAIT_MATERIAL', expectedNode: 'WAIT_MATERIAL', actor: actor! }))
  else if (action === 'start') run(executeWaterSolublePdaAction({ action: 'START', orderId, taskId: currentOrder?.taskId || '', expectedStatus: 'WAIT_WATER_SOLUBLE', expectedNode: 'START', actor: actor! }))
  else if (action === 'confirm-supervisor-decision') {
    const decision = node.dataset.decision as WaterSolubleSupervisorDecision | undefined
    if (!decision || !Object.hasOwn(SUPERVISOR_DECISION_LABEL, decision)) { rejectAction('请选择有效的主管处理方式。'); return true }
    if (!hasCurrentOverlay('supervisor-confirm', orderId) || state.overlay?.decision !== decision) { rejectAction('当前主管确认已失效，请重新选择处理方式。'); return true }
    if (!state.overlayToken || node.dataset.overlayToken !== state.overlayToken) { rejectAction('当前主管确认令牌已失效，请重新选择处理方式。'); return true }
    run(executeWaterSolublePdaAction({ action: 'RESOLVE_PAUSE', orderId, taskId: currentOrder?.taskId || '', expectedStatus: 'PRODUCTION_PAUSED', expectedNode: 'SUPERVISOR', decision, actor: actor! }))
  }
  else if (action === 'confirm-handover') {
    if (!hasCurrentOverlay('handover', orderId)) { rejectAction('当前交出确认已失效，请重新打开加工单。'); return true }
    if (!state.overlayToken || node.dataset.overlayToken !== state.overlayToken) { rejectAction('当前交出确认令牌已失效，请重新打开加工单。'); return true }
    if (!actor) { rejectAction('当前登录已失效，请重新登录。'); return true }
    try {
      const ensured = ensureHandoverOrderForStartedTask(currentOrder?.taskId || '')
      clearOverlay()
      refreshOverlay()
      appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(ensured.handoverOrderId)}?action=new-record`)
    } catch (error) {
      rejectAction(error instanceof Error ? error.message : '交出单创建失败，请重试。')
    }
  }
  else if (action === 'prev-page') { state.page = Math.max(1, state.page - 1); refreshList() }
  else if (action === 'next-page') { state.page += 1; refreshList() }
  else return false
  return true
}

export function isCraftDyeingWaterSolubleOverlayOpen(): boolean { return state.overlay !== null }
export function closeCraftDyeingWaterSolubleOverlay(): void { clearOverlay(); clearCompletionDraft(); refreshOverlay() }
