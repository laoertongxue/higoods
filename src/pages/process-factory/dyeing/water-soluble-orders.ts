import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { normalizeListColumnPreferences, loadListColumnPreferences, saveListColumnPreferences, sortStandardListRows, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderProcessOrderStats, renderProcessFilterToggle, handleProcessFilterPresentation } from '../../../components/ui/process-order-list-presentation.ts'
import { getWaterSolubleReceivedMaterialQty } from '../../../data/fcs/water-soluble-task-domain.ts'
import { getWaterSolubleMaterialReceiptOptions, executeWaterSolubleInputReceipt } from '../../../data/fcs/water-soluble-material-receipts.ts'
import {
  PROCESS_ORDER_HANDOVER_STATUS_LABEL,
  PROCESS_ORDER_PROCESSING_STATUS_LABEL,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
} from '../../../data/fcs/process-order-flow-contract.ts'
import { getWaterSolubleWorkOrderThreeAxisView } from '../../../data/fcs/process-order-three-axis-view.ts'
import { getWaterSolubleOrderImageManifest } from '../../../data/fcs/process-order-image-manifest.ts'
// @page-pattern: list

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
import {
  canWaterSolubleRolePerform,
  WATER_SOLUBLE_ROLE_ERROR,
  type WaterSolublePdaRoleAction,
} from '../../../data/fcs/water-soluble-pda-actor.ts'
import { getPdaRuntimeContext } from '../../pda-runtime.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

type Overlay =
  | { type: 'detail' | 'supervisor' | 'handover' | 'completion'; orderId: string }
  | { type: 'completion-overage'; orderId: string }
  | { type: 'supervisor-confirm'; orderId: string; decision: WaterSolubleSupervisorDecision }
  | null
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const state = {
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

function scopedOrders(): WaterSolubleWorkOrder[] {
  const runtime = getPdaRuntimeContext()
  const requestedFactoryId = getRequestedFactoryId()
  return listWaterSolubleWorkOrders().filter((order) => {
    if (!order.factoryId) return false
    if (runtime && order.factoryId !== runtime.factoryId) return false
    if (runtime && requestedFactoryId && requestedFactoryId !== runtime.factoryId) return false
    if (!runtime && requestedFactoryId && order.factoryId !== requestedFactoryId) return false
    return true
  })
}

function getAuthorizedOrder(orderId: string, expectedStatuses?: WaterSolubleWorkOrder['status'][], roleAction?: WaterSolublePdaRoleAction): { order: WaterSolubleWorkOrder | null; message: string } {
  const runtime = getPdaRuntimeContext()
  if (!runtime) {
    if (!roleAction && !expectedStatuses) { const order = scopedOrders().find(item => item.waterOrderId === orderId); return { order: order ?? null, message: order ? '' : '加工单不在当前查看范围内。' } }
    return { order: null, message: '当前为管理预览，只能查看，不能执行工厂动作。' }
  }
  const order = getWaterSolubleWorkOrderById(orderId)
  if (!order) return { order: null, message: `未找到水溶加工单“${orderId}”。` }
  if (!order.factoryId || order.factoryId !== runtime.factoryId) {
    return { order: null, message: '当前账号不属于该加工单工厂，不能执行此操作。' }
  }
  if (roleAction && !canWaterSolubleRolePerform(runtime.roleId, roleAction)) {
    return { order: null, message: WATER_SOLUBLE_ROLE_ERROR[roleAction] }
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

function axisTone(status: string) {
  if (['RECEIVED', 'COMPLETED', 'FULL_HANDOVER'].includes(status)) return 'success' as const
  if (['RECEIPT_DIFFERENCE', 'CANCELLED'].includes(status)) return 'danger' as const
  if (['PARTIAL_RECEIVED', 'PARTIAL_HANDOVER', 'PROCESSING'].includes(status)) return 'info' as const
  if (['WAIT_SOURCE', 'WAIT_RECEIVE', 'WAIT_HANDOVER'].includes(status)) return 'warning' as const
  return 'neutral' as const
}

function renderOrderImage(order: WaterSolubleWorkOrder, kind: 'product' | 'material'): string {
  const images = getWaterSolubleOrderImageManifest(order.waterOrderId)!
  const url = images[kind]
  const label = kind === 'product' ? `${order.productionOrderNo} 款式图` : `${order.materialName} 实物图`
  return `<button type="button" class="relative h-16 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(label)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(label)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(url)}" alt="${escapeHtml(label)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}

function lastLog(order: WaterSolubleWorkOrder): { actor: string; summary: string } {
  const log = [...order.actionLogs].reverse().find(item => item.operatorName?.trim() && !item.operatorName.startsWith('系统')) || order.actionLogs.at(-1)
  if (!log) return { actor: '系统', summary: '加工单已生成，尚无人工操作' }
  return { actor: escapeHtml(log.operatorName?.trim()||'原记录未留操作人'), summary: `${escapeHtml(log.action)} · ${escapeHtml(log.at)}` }
}

function getRoleActionForStatus(status: WaterSolubleWorkOrder['status']): WaterSolublePdaRoleAction | null {
  if (['WAIT_MATERIAL', 'WAIT_WATER_SOLUBLE', 'WATER_SOLUBLE_IN_PROGRESS'].includes(status)) return 'OPERATE'
  if (status === 'PRODUCTION_PAUSED') return 'SUPERVISE'
  if (status === 'WAIT_HANDOVER') return 'HANDOVER'
  return null
}

function renderMaterialReceiptFields(order: WaterSolubleWorkOrder): string {
  return `<a class="block rounded border px-3 py-2 text-blue-700" href="/fcs/craft/dyeing/pending-receipts?factory=${encodeURIComponent(order.factoryId||'')}&orderId=${encodeURIComponent(order.waterOrderId)}">前往染厂待接收登记实收和库位</a>`
}

function renderPrimaryAction(order: WaterSolubleWorkOrder, roleId: string | null): string {
  const hasNewInput=['WATER_SOLUBLE_IN_PROGRESS','WAIT_HANDOVER'].includes(order.status)&&getWaterSolubleReceivedMaterialQty(order.waterOrderId)>(order.inputQty??0)
  const roleAction = hasNewInput?'OPERATE':getRoleActionForStatus(order.status)
  if (!roleId) return '<div class="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">只读查看</div>'
  if (roleAction && !canWaterSolubleRolePerform(roleId, roleAction)) return '<div class="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">等待有权限角色处理</div>'
  const current = getWaterSolubleCurrentAction(order.waterOrderId)
  if (!current) return ''
  if (hasNewInput) return withSkipPageRerender(renderButton({label:'投入本批来料',variant:'primary',action:{prefix:'factory-water-soluble',action:'start'},className:'w-full'})).replace('<button',`<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'PRODUCTION_PAUSED') return withSkipPageRerender(renderButton({ label: '主管处理', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'open-supervisor' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_HANDOVER') return withSkipPageRerender(renderButton({ label: '现在交出', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'open-handover' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WAIT_MATERIAL') {
    return renderMaterialReceiptFields(order)
  }
  if (order.status === 'WAIT_WATER_SOLUBLE') return withSkipPageRerender(renderButton({ label: '开始水溶', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'start' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') return withSkipPageRerender(renderButton({ label: '上报完成数量', variant: 'primary', action: { prefix: 'factory-water-soluble', action: 'complete' }, className: 'w-full' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`) + `<details class="mt-2"><summary class="text-sm">继续接收原料</summary>${renderMaterialReceiptFields(order)}</details>`
  return `<div class="rounded-md bg-muted px-3 py-2 text-center text-sm">${escapeHtml(current.actionName)}</div>`
}

function renderCard(order: WaterSolubleWorkOrder): string {
  const runtime = getPdaRuntimeContext()
  const canOperate = Boolean(runtime && order.factoryId === runtime.factoryId)
  const current = getWaterSolubleCurrentAction(order.waterOrderId)
  if(current&&['WATER_SOLUBLE_IN_PROGRESS','WAIT_HANDOVER'].includes(order.status)&&getWaterSolubleReceivedMaterialQty(order.waterOrderId)>(order.inputQty??0)){current.actionName='投入本批来料';current.message='补收来料已入库，确认投入后开始加工。'}
  const recentLog = lastLog(order)
  const axes = getWaterSolubleWorkOrderThreeAxisView(order)
  const sourceName = axes.sourceMode === 'CENTRAL_TRANSFER' ? '中央仓调拨' : axes.sourceMode === 'UPSTREAM_HANDOUT' ? '上游交出' : '来源待到位'
  return `<article class="rounded-xl border bg-card p-4 shadow-sm" data-testid="factory-water-soluble-card" data-order-id="${escapeHtml(order.waterOrderId)}">
    <div class="flex items-start gap-3">${renderOrderImage(order, 'product')}${renderOrderImage(order, 'material')}<div class="min-w-0 flex-1"><div class="font-mono text-xs text-muted-foreground">${escapeHtml(order.waterOrderNo)}</div><h2 class="mt-1 font-semibold">${escapeHtml(order.materialName)}</h2><p class="break-all text-xs text-muted-foreground">${escapeHtml(order.materialCode)} · ${escapeHtml(order.productionOrderNo)}</p></div></div>
    <div class="mt-3 grid grid-cols-3 gap-2"><div><div class="text-[11px] text-muted-foreground">接收状态</div>${renderBadge(PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus], axisTone(axes.receiptStatus))}</div><div><div class="text-[11px] text-muted-foreground">加工状态</div>${renderBadge(PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus], axisTone(axes.processingStatus))}</div><div><div class="text-[11px] text-muted-foreground">交出状态</div>${renderBadge(PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus], axisTone(axes.handoverStatus))}</div></div>
    <div class="mt-3 grid gap-1 text-xs"><div><span class="text-muted-foreground">投入来源：</span>${sourceName} · ${escapeHtml(axes.sourceDocumentNos.join(' / ') || '尚未到位')}</div><div><span class="text-muted-foreground">唯一接收方：</span>${escapeHtml(axes.receiver.receiverName)} · ${escapeHtml(axes.receiver.receiverWarehouseName)}</div></div>
    <div class="mt-4 rounded-lg bg-blue-50 p-3"><div class="text-xs text-blue-700">当前要做什么</div><div class="mt-1 font-semibold text-blue-900">${escapeHtml(current?.actionName || '查看状态')}</div><p class="mt-1 text-xs text-blue-700">${escapeHtml(current?.message || '')}</p></div>
    <dl class="mt-4 grid grid-cols-3 gap-2 text-center"><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">计划</dt><dd class="mt-1 font-medium">${qty(order.plannedQty, order.qtyUnit)}</dd></div><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">完成</dt><dd class="mt-1 font-medium">${qty(order.completedQty, order.qtyUnit)}</dd></div><div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">差异</dt><dd class="mt-1 font-medium ${order.completedQty < order.plannedQty ? 'text-amber-700' : ''}">${difference(order)}</dd></div></dl>
    <div class="mt-3 text-xs text-muted-foreground">最近操作：${recentLog.actor} · ${recentLog.summary}</div>${order.exceptionReason ? `<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">${escapeHtml(order.exceptionReason)}</div>` : ''}
    <div class="mt-4 space-y-2">${renderPrimaryAction(order, canOperate ? runtime!.roleId : null)}${canOperate ? `<button data-skip-page-rerender="true" class="w-full text-center text-sm text-blue-600 hover:underline" data-factory-water-soluble-action="open-detail" data-order-id="${escapeHtml(order.waterOrderId)}">查看任务详情与记录</button>` : ''}</div>
  </article>`
}

function renderListRegion(): string {
  if (!getPdaRuntimeContext()) return renderManagementList()
  const all = scopedOrders()
  const totalPages = Math.max(1, Math.ceil(all.length / state.pageSize))
  state.page = Math.min(state.page, totalPages)
  const from = (state.page - 1) * state.pageSize
  return `<section data-factory-water-soluble-list-region><div class="grid gap-4 xl:grid-cols-2">${all.slice(from, from + state.pageSize).map(renderCard).join('') || '<div class="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">当前查看范围暂无独立水溶加工单</div>'}</div><div class="mt-4 overflow-hidden rounded-lg border bg-card" data-testid="factory-water-soluble-pagination">${withSkipPageRerender(renderTablePagination({ total: all.length, from: all.length ? from + 1 : 0, to: Math.min(from + state.pageSize, all.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'factory-water-soluble', fieldPrefix: 'factory-water-soluble', pageSizeOptions: [...PAGE_SIZE_OPTIONS] }))}</div></section>`
}

const managementPrefix = 'water-list'
const preferenceKey = '/fcs/craft/dyeing/water-soluble-orders:columns'
const management = {
  keyword: '', receipt: '', processing: '', handover: '', factory: '', receiver: '', start: '', end: '',
  sort: null as StandardListSortState | null, settings: false,
  preferences: null as ReturnType<typeof normalizeListColumnPreferences> | null,
}
const managementButton = (label: string, action: string, icon?: string) => renderButton({ label, icon, variant: action === 'query' ? 'primary' : 'secondary', action: { prefix: managementPrefix, action, skipPageRerender: true } })
function smallImage(order: WaterSolubleWorkOrder, kind: 'product' | 'material') { return renderOrderImage(order, kind).replace('h-16 w-16', 'h-10 w-10').replace('rounded-lg', 'rounded') }
const managementColumns: StandardListColumn<WaterSolubleWorkOrder>[] = [
  { key: 'order', title: '加工单／商品', width: 200, required: true, freezeable: true, sortable: true, sortValue: order => order.waterOrderNo, render: order => `<div class="space-y-2"><button class="text-xs text-blue-700" data-factory-water-soluble-action="open-detail" data-order-id="${escapeHtml(order.waterOrderId)}" data-skip-page-rerender="true">${escapeHtml(order.waterOrderNo)}</button><div class="flex gap-2">${smallImage(order, 'product')}<div class="text-xs">${escapeHtml(order.productionOrderNo)}<div class="text-muted-foreground">生产单自动生成</div></div></div></div>` },
  { key: 'input', title: '加工投入／上游', width: 235, required: true, freezeable: true, render: order => { const axes = getWaterSolubleWorkOrderThreeAxisView(order); return `<div class="flex gap-2">${smallImage(order, 'material')}<div class="text-xs"><div>${escapeHtml(order.materialName)}</div><div class="text-muted-foreground">${escapeHtml(order.materialCode)}</div><div>${escapeHtml(order.materialSpec)}</div></div></div><div class="mt-2 text-xs">投入来源：${axes.sourceMode === 'CENTRAL_TRANSFER' ? '中央仓调拨' : '上游交出'}：${escapeHtml(axes.sourceDocumentNos.join(' / ') || '待到位')}<div>计划 ${qty(order.plannedQty, order.qtyUnit)} · 已收 ${qty(axes.receivedInputQty, order.qtyUnit)}</div></div>` } },
  { key: 'requirements', title: '加工要求', width: 150, freezeable: true, render: order => `${renderBadge('水溶', 'neutral')}<div class="mt-2 text-xs">${escapeHtml(getWaterSolubleCurrentAction(order.waterOrderId)?.actionName || WATER_SOLUBLE_STATUS_LABEL[order.status])}</div>${order.exceptionReason ? `<div class="mt-2 text-xs text-amber-700">${escapeHtml(order.exceptionReason)}</div>` : ''}` },
  { key: 'status', title: '接收／加工／交出', width: 190, required: true, freezeable: true, render: order => { const axes = getWaterSolubleWorkOrderThreeAxisView(order); return `<div class="space-y-2 text-xs"><div>接收 ${renderBadge(PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus], axisTone(axes.receiptStatus))}</div><div>加工 ${renderBadge(PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus], axisTone(axes.processingStatus))}</div><div>交出 ${renderBadge(PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus], axisTone(axes.handoverStatus))}</div></div>` } },
  { key: 'output', title: '加工产出／下游', width: 220, freezeable: true, render: order => { const axes = getWaterSolubleWorkOrderThreeAxisView(order); return `<div class="space-y-1 text-xs"><div>完成 ${qty(axes.completedQty, order.qtyUnit)}</div><div>已交 ${qty(axes.handedOverQty, order.qtyUnit)}</div><div>下游已收 ${qty(axes.downstreamReceivedQty, order.qtyUnit)}</div><div>唯一接收方：${escapeHtml(axes.receiver.receiverName)} ${escapeHtml(axes.receiver.receiverWarehouseName)}</div><div class="text-amber-700">产出实物图待补齐</div></div>` } },
  { key: 'factory', title: '加工厂／时间', width: 175, freezeable: true, sortable: true, sortValue: order => order.createdAt, render: order => `<div class="space-y-1 text-xs"><div>${escapeHtml(order.factoryName || order.factoryId || '待分配')}</div><div>下单 ${escapeHtml(order.createdAt)}</div><div>更新 ${escapeHtml(order.updatedAt)}</div><div class="text-muted-foreground">${lastLog(order).actor}</div></div>` },
  { key: 'actions', title: '操作', width: 110, required: true, actionColumn: true, render: order => `<button class="min-h-7 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" data-factory-water-soluble-action="open-detail" data-order-id="${escapeHtml(order.waterOrderId)}" data-skip-page-rerender="true">查看详情</button>` },
]
function managementPreferences() {
  if (!management.preferences) {
    const defaults = normalizeListColumnPreferences(managementColumns, { order: managementColumns.map(c => c.key), visibleKeys: managementColumns.map(c => c.key), frozenKeys: ['order'], pageSize: 10 }, [...PAGE_SIZE_OPTIONS])
    management.preferences = typeof window === 'undefined' ? defaults : loadListColumnPreferences(window.localStorage, preferenceKey, managementColumns, defaults, [...PAGE_SIZE_OPTIONS])
  }
  return management.preferences
}
function managementRows() {
  return scopedOrders().filter(order => {
    const axes = getWaterSolubleWorkOrderThreeAxisView(order)
    return (!management.keyword || `${order.waterOrderNo} ${order.productionOrderNo} ${order.taskNo} ${order.materialName} ${order.materialCode}`.toLowerCase().includes(management.keyword.toLowerCase()))
      && (!management.receipt || axes.receiptStatus === management.receipt) && (!management.processing || axes.processingStatus === management.processing) && (!management.handover || axes.handoverStatus === management.handover)
      && (!management.factory || order.factoryId === management.factory) && (!management.receiver || axes.receiver.receiverName === management.receiver)
      && (!management.start || order.createdAt.slice(0, 10) >= management.start) && (!management.end || order.createdAt.slice(0, 10) <= management.end)
  })
}
function renderManagementList(): string {
  const all = scopedOrders(), rows = managementRows(), preferences = managementPreferences()
  const select = (key: 'receipt' | 'processing' | 'handover' | 'factory' | 'receiver', label: string, options: Record<string, string>) => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-9 w-full rounded-md border px-3 text-sm" data-water-filter="${key}"><option value="">全部</option>${Object.entries(options).map(([value, text]) => `<option value="${escapeHtml(value)}" ${management[key] === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`
  const advanced = Boolean(management.receiver || management.start || management.end)
  const filters = `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"><label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border px-3 text-sm" data-water-filter="keyword" value="${escapeHtml(management.keyword)}" placeholder="单号、商品、物料或任务"></label>${select('receipt', '接收状态', PROCESS_ORDER_RECEIPT_STATUS_LABEL)}${select('processing', '加工状态', PROCESS_ORDER_PROCESSING_STATUS_LABEL)}${select('handover', '交出状态', PROCESS_ORDER_HANDOVER_STATUS_LABEL)}${select('factory', '加工厂', Object.fromEntries(all.map(order => [order.factoryId!, order.factoryName || order.factoryId!])) )}</div><div data-process-advanced ${advanced ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">${select('receiver', '下游接收方', Object.fromEntries(all.map(order => { const name = getWaterSolubleWorkOrderThreeAxisView(order).receiver.receiverName; return [name, name] })))}${(['start','end'] as const).map(key => `<label><span class="mb-1 block text-xs text-muted-foreground">下单${key === 'start' ? '开始' : '结束'}日期</span><input type="date" class="h-9 w-full rounded-md border px-3 text-sm" data-water-filter="${key}" value="${management[key]}"></label>`).join('')}</div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${managementButton('查询','query','search')}${managementButton('重置','reset','rotate-ccw')}${managementButton('导出','export','download')}${renderProcessFilterToggle(advanced ? 1 : 0)}</div></div>`
  const sum = (get: (order: WaterSolubleWorkOrder) => number) => { const units = new Map<string, number>(); rows.forEach(order => units.set(order.qtyUnit, (units.get(order.qtyUnit) || 0) + get(order))); return [...units].map(([unit, value]) => `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`).join(' / ') || '0' }
  const sorted = sortStandardListRows(rows, management.sort, (row, key) => managementColumns.find(c => c.key === key)?.sortValue?.(row))
  state.pageSize = preferences.pageSize; const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize)); state.page = Math.min(state.page, totalPages); const from = (state.page - 1) * state.pageSize
  return `<section data-factory-water-soluble-list-region>${withSkipPageRerender(renderStandardListPage({ title: '水溶加工单', primaryActionsHtml: '<span class="text-xs text-muted-foreground">管理查看（只读）</span>', filtersHtml: filters, statsHtml: renderProcessOrderStats([{ label: '加工单数', value: rows.length }, { label: '计划投入', value: sum(order => order.plannedQty) }, { label: '已接收', value: sum(order => getWaterSolubleReceivedMaterialQty(order.waterOrderId)) }, { label: '完成数量', value: sum(order => order.completedQty) }, { label: '已交出', value: sum(order => order.handoverQty || 0) }, { label: '下游待接收', value: sum(order => Math.max(0, (order.handoverQty || 0) - (order.receivedQty || 0))) }]), listTitle: `共 ${rows.length} 条`, listActionsHtml: managementButton('列设置','columns','settings-2'), tableHtml: renderStandardListTable({ columns: managementColumns, rows: sorted.slice(from, from + state.pageSize), preferences, sort: management.sort, eventPrefix: managementPrefix, emptyText: '暂无符合条件的水溶加工单' }), paginationHtml: '<div data-testid="factory-water-soluble-pagination">' + renderTablePagination({ total: rows.length, from: rows.length ? from + 1 : 0, to: Math.min(from + state.pageSize, rows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: managementPrefix, fieldPrefix: managementPrefix, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }) + '</div>', overlaysHtml: management.settings ? renderStandardListColumnSettings({ title: '水溶加工单列设置', columns: managementColumns, preferences, eventPrefix: managementPrefix, maxFrozenWidth: 520 }) : '' }))}</section>`
}
function handleManagementList(target: HTMLElement): boolean {
  if (getPdaRuntimeContext()) return false
  const root = target.closest<HTMLElement>('[data-factory-water-soluble-list-region]'); if (!root) return false
  if (handleProcessFilterPresentation(root, target)) return true
  if (target.closest('[data-water-filter]')) return true
  const pageSize = target.closest<HTMLSelectElement>('[data-water-list-field="pageSize"]')
  if (pageSize) { managementPreferences().pageSize = normalizePageSize(pageSize.value); saveListColumnPreferences(window.localStorage, preferenceKey, managementPreferences()); state.page = 1; refreshList(); return true }
  const node = target.closest<HTMLElement>('[data-water-list-action]'); if (!node) return false
  const action = node.dataset.waterListAction, preferences = managementPreferences()
  if (action === 'query') { for (const key of ['keyword','receipt','processing','handover','factory','receiver','start','end'] as const) management[key] = root.querySelector<HTMLInputElement>(`[data-water-filter="${key}"]`)?.value.trim() || ''; state.page = 1 }
  else if (action === 'reset') { for (const key of ['keyword','receipt','processing','handover','factory','receiver','start','end'] as const) management[key] = ''; state.page = 1 }
  else if (action === 'export') { const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`; const rows = [['水溶单','生产单','物料','计划','完成','单位','加工厂'], ...managementRows().map(order => [order.waterOrderNo,order.productionOrderNo,order.materialName,order.plannedQty,order.completedQty,order.qtyUnit,order.factoryName])]; const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'})); const link = document.createElement('a'); link.href = url; link.download = '水溶加工单.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true }
  else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page++
  else if (action === 'columns') management.settings = true
  else if (action === 'close-column-settings') management.settings = false
  else if (action === 'sort-column') { const key = node.dataset.columnKey!; management.sort = management.sort?.key !== key ? {key,direction:'asc'} : management.sort.direction === 'asc' ? {key,direction:'desc'} : null; state.page = 1 }
  else if (action === 'restore-column-settings') { window.localStorage.removeItem(preferenceKey); management.preferences = null }
  else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { const key = node.dataset.waterListColumnKey || node.closest<HTMLElement>('[data-water-list-column-key]')?.dataset.waterListColumnKey || ''; const column = managementColumns.find(c => c.key === key); if (column && !column.actionColumn) { const list = action === 'toggle-column-visibility' ? 'visibleKeys' : 'frozenKeys'; if (!(list === 'visibleKeys' && column.required)) preferences[list] = preferences[list].includes(key) ? preferences[list].filter(value => value !== key) : [...preferences[list], key] } }
  else return false
  management.preferences = normalizeListColumnPreferences(managementColumns, managementPreferences(), [...PAGE_SIZE_OPTIONS])
  saveListColumnPreferences(window.localStorage, preferenceKey, management.preferences); refreshList(); return true
}

function detailDrawer(order: WaterSolubleWorkOrder): string {
  const axes = getWaterSolubleWorkOrderThreeAxisView(order)
  const sourceName = axes.sourceMode === 'CENTRAL_TRANSFER' ? '中央仓调拨' : axes.sourceMode === 'UPSTREAM_HANDOUT' ? '上游交出' : '来源待到位'
  const batches = (order.handoverBatches ?? []).map((batch, index) => `<div class="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-xs"><span>第 ${index + 1} 批</span><span>交出 ${qty(batch.handoverQty, order.qtyUnit)}</span><span>${batch.receivedQty === undefined ? '待接收' : `已收 ${qty(batch.receivedQty, order.qtyUnit)}`}</span></div>`).join('')
  return withSkipPageRerender(renderDetailDrawer({ title: '水溶任务详情', subtitle: order.waterOrderNo, closeAction: { prefix: 'factory-water-soluble', action: 'close-overlay' }, width: 'md' }, `<div class="space-y-4">
    <section class="flex gap-3">${renderOrderImage(order, 'product')}${renderOrderImage(order, 'material')}<div class="min-w-0"><div class="font-semibold">${escapeHtml(order.materialName)}</div><div class="mt-1 break-all text-xs text-muted-foreground">${escapeHtml(order.materialCode)}</div><div class="mt-1 text-xs">${escapeHtml(order.productionOrderNo)}</div></div></section>
    <section class="grid grid-cols-3 gap-2 rounded-lg border p-3"><div><div class="text-[11px] text-muted-foreground">接收</div>${renderBadge(PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus], axisTone(axes.receiptStatus))}</div><div><div class="text-[11px] text-muted-foreground">加工</div>${renderBadge(PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus], axisTone(axes.processingStatus))}</div><div><div class="text-[11px] text-muted-foreground">交出</div>${renderBadge(PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus], axisTone(axes.handoverStatus))}</div></section>
    <section class="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"><div><div class="text-xs text-muted-foreground">投入来源</div><div class="mt-1 font-medium">${sourceName}</div><div class="mt-1 break-all text-xs">${escapeHtml(axes.sourceDocumentNos.join(' / ') || '尚无可接收单据')}</div></div><div><div class="text-xs text-muted-foreground">唯一接收方</div><div class="mt-1 font-medium">${escapeHtml(axes.receiver.receiverName)}</div><div class="mt-1 text-xs">${escapeHtml(axes.receiver.receiverWarehouseName)}</div></div><div>计划 ${qty(order.plannedQty, order.qtyUnit)}</div><div>已收 ${qty(axes.receivedInputQty, order.qtyUnit)}</div><div>完成 ${qty(axes.completedQty, order.qtyUnit)}</div><div>已交 ${qty(axes.handedOverQty, order.qtyUnit)}</div></section>
    <section><h3 class="font-semibold">交出批次</h3><div class="mt-2 space-y-2">${batches || '<div class="text-sm text-muted-foreground">尚未交出</div>'}</div></section>
    <section><h3 class="font-semibold">操作记录</h3><ul class="mt-2 space-y-2">${order.actionLogs.map(log => `<li class="rounded-md bg-muted/40 p-2 text-sm">${escapeHtml(log.action)}<div class="text-xs text-muted-foreground">${escapeHtml(log.detail)} · ${escapeHtml(log.at)}</div></li>`).join('')}</ul></section>
  </div>`))
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
    `<div class="space-y-4"><label class="block text-sm font-medium">累计完成数量（${escapeHtml(order.qtyUnit)}）<input type="text" inputmode="decimal" class="mt-1 h-10 w-full rounded-md border px-3" value="${escapeHtml(draft.completedQty)}" data-factory-water-soluble-field="completedQty"></label><label class="block text-sm font-medium">异常结束原因<textarea class="mt-1 min-h-20 w-full rounded-md border p-3" placeholder="正常分批留空；提前结束或超量时填写" data-factory-water-soluble-field="completionReason">${escapeHtml(draft.reason)}</textarea></label><p class="text-xs text-muted-foreground">正常分批可直接上报并交出；填写短量结束原因后转主管确认；超量需要再次确认。</p><button type="button" class="h-10 w-full rounded-md bg-blue-600 font-medium text-white" data-factory-water-soluble-action="confirm-completion" data-order-id="${escapeHtml(order.waterOrderId)}" data-overlay-token="${escapeHtml(state.overlayToken)}">确认上报</button></div>`,
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
  const roleActionByOverlay: Partial<Record<NonNullable<Overlay>['type'], WaterSolublePdaRoleAction>> = {
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
  return withSkipPageRerender(renderSimpleConfirmDialog({ prefix: 'factory-water-soluble', closeAction: 'close-overlay', confirmAction: 'confirm-handover', title: '确认交出', description: order.waterOrderNo, confirmLabel: `确认交出 ${order.handoverQty ?? order.completedQty} ${order.qtyUnit}`, content: '<p class="text-sm">交出后由唯一接收方确认实际收货数量。</p>' }).replace('data-factory-water-soluble-action="confirm-handover"', `data-factory-water-soluble-action="confirm-handover" data-order-id="${escapeHtml(order.waterOrderId)}" data-overlay-token="${escapeHtml(state.overlayToken)}"`))
}

export function renderCraftDyeingWaterSolubleOrdersPage(): string {
  installManagementColumnDrag()
  const runtime = getPdaRuntimeContext()
  const requestedFactoryId = getRequestedFactoryId()
  const scopeMessage = runtime
    ? requestedFactoryId && requestedFactoryId !== runtime.factoryId
      ? `当前工厂：${escapeHtml(runtime.factoryName)}，只能查看本厂加工单。`
      : `当前工厂：${escapeHtml(runtime.factoryName)}`
    : requestedFactoryId
      ? `管理查看（只读）：${escapeHtml(requestedFactoryId)}`
      : '管理查看（只读）'
  if (!runtime) return `<div data-testid="factory-water-soluble-orders-page" data-skip-page-rerender="true">${renderListRegion()}<div data-factory-water-soluble-overlay>${overlay()}</div>${renderToastContainer('top-right')}</div>`
  return `<div class="space-y-4 p-4" data-testid="factory-water-soluble-orders-page" data-skip-page-rerender="true"><header><h1 class="text-xl font-semibold">水溶加工单</h1><p class="text-sm text-muted-foreground">${scopeMessage}</p></header>${renderListRegion()}<div data-factory-water-soluble-overlay>${overlay()}</div>${renderToastContainer('top-right')}</div>`
}

function refreshList() { const node = document.querySelector<HTMLElement>('[data-factory-water-soluble-list-region]'); if (node) { node.outerHTML = renderListRegion(); const region = document.querySelector<HTMLElement>('[data-factory-water-soluble-list-region]'); if (region) hydrateIcons(region) } }
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
  if (handleManagementList(target)) return true
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
    const completedQtyInput = state.completionDraft.completedQty.trim()
    if (!completedQtyInput) { rejectAction('请填写完成数量。'); return true }
    const completedQty = Number(completedQtyInput)
    if (!Number.isFinite(completedQty)) { rejectAction('完成数量必须是有限数字。'); return true }
    if (completedQty < 0) { rejectAction('完成数量不能小于 0。'); return true }
    const reason = state.completionDraft.reason.trim()
    if ((completedQty === 0 || completedQty > access.order.plannedQty) && !reason) { rejectAction('数量与计划不一致，请填写原因。'); return true }
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

  const accessRuleByAction: Record<string, { statuses: WaterSolubleWorkOrder['status'][]; roleAction: WaterSolublePdaRoleAction }> = {
    'receive-input': { statuses: ['WAIT_MATERIAL', 'WATER_SOLUBLE_IN_PROGRESS'], roleAction: 'OPERATE' },
    start: { statuses: ['WAIT_WATER_SOLUBLE','WATER_SOLUBLE_IN_PROGRESS','WAIT_HANDOVER'], roleAction: 'OPERATE' },
    'confirm-supervisor-decision': { statuses: ['PRODUCTION_PAUSED'], roleAction: 'SUPERVISE' },
    'confirm-handover': { statuses: ['WAIT_HANDOVER'], roleAction: 'HANDOVER' },
  }
  const accessRule = accessRuleByAction[action]
  if (accessRule) {
    const access = getAuthorizedOrder(orderId, accessRule.statuses, accessRule.roleAction)
    if (!access.order) { rejectAction(access.message); return true }
  }
  const actor = getPdaSession()
  if ((action === 'receive-input' || action === 'start' || action === 'confirm-supervisor-decision') && !actor) {
    rejectAction('当前登录已失效，请重新登录。')
    return true
  }
  const currentOrder = getWaterSolubleWorkOrderById(orderId)
  if (action === 'receive-input') {
    const card = node.closest('[data-testid="factory-water-soluble-card"]')
    run(executeWaterSolubleInputReceipt({ action: 'RECEIVE_INPUT', orderId, taskId: currentOrder?.taskId || '', expectedStatus: currentOrder?.status as 'WAIT_MATERIAL' | 'WATER_SOLUBLE_IN_PROGRESS', expectedNode: currentOrder?.status === 'WAIT_MATERIAL' ? 'WAIT_MATERIAL' : 'COMPLETE', qty: Number(card?.querySelector<HTMLInputElement>('[data-water-material-qty]')?.value), receiptId: card?.querySelector<HTMLElement>('[data-water-material-receipt]')?.dataset.receiptId, upstreamRecordId: card?.querySelector<HTMLSelectElement>('[data-water-material-source]')?.value, actor: actor! }))
  }
  else if (action === 'start') run(executeWaterSolublePdaAction({ action: 'START', orderId, taskId: currentOrder?.taskId || '', expectedStatus: currentOrder!.status as 'WAIT_WATER_SOLUBLE'|'WATER_SOLUBLE_IN_PROGRESS'|'WAIT_HANDOVER', expectedNode: currentOrder!.status==='WAIT_HANDOVER'?'HANDOVER':currentOrder!.status==='WATER_SOLUBLE_IN_PROGRESS'?'COMPLETE':'START', actor: actor! }))
  else if (action === 'confirm-supervisor-decision') {
    const decision = node.dataset.decision as WaterSolubleSupervisorDecision | undefined
    if (!decision || !Object.hasOwn(SUPERVISOR_DECISION_LABEL, decision)) { rejectAction('请选择有效的主管处理方式。'); return true }
    if (!hasCurrentOverlay('supervisor-confirm', orderId) || state.overlay?.type !== 'supervisor-confirm' || state.overlay.decision !== decision) { rejectAction('当前主管确认已失效，请重新选择处理方式。'); return true }
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

let managementDragInstalled = false
function installManagementColumnDrag(): void {
  if (managementDragInstalled || typeof document === 'undefined') return
  managementDragInstalled = true
  let dragged = ''
  document.addEventListener('dragstart', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-factory-water-soluble-list-region] [data-standard-list-column-drag]') : null
    if (node) { dragged = node.dataset.dragSource || ''; event.dataTransfer?.setData('text/plain', dragged) }
  })
  document.addEventListener('dragover', event => { if (event.target instanceof Element && event.target.closest('[data-factory-water-soluble-list-region] [data-drop-target]')) event.preventDefault() })
  document.addEventListener('drop', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-factory-water-soluble-list-region] [data-drop-target]') : null
    const to = node?.dataset.dropTarget; if (!to || !dragged || to === dragged) return
    event.preventDefault()
    const preferences = managementPreferences(), order = preferences.order.filter(key => key !== dragged && key !== 'actions'), index = order.indexOf(to)
    if (index < 0) return
    order.splice(index, 0, dragged); preferences.order = [...order, 'actions']; dragged = ''
    saveListColumnPreferences(window.localStorage, preferenceKey, preferences); refreshList()
  })
}
