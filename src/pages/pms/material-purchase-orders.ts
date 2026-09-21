// @page-pattern: list
import { getTmfMaterialPurchase, reviseTmfMaterialPurchase, type TmfPurchaseActor } from '../../data/pms/tmf-material-purchases.ts'
import { renderTmfPurchaseRevision, renderTmfPurchaseRevisionHistory } from './tmf-purchase-revision.ts'
import { renderTmfTipPurchaseForm, readTmfTipPurchaseForm, updateTmfTipPurchaseSource } from './tmf-tip-purchase-form.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  createPmsTmfTipPurchase, batchAdvancePmsMaterialPurchaseOrders,
  closePmsMaterialPurchaseOrder,
  getPmsMaterialPurchaseOrder,
  importPmsMaterialLogistics,
  listPmsMaterialLogisticsRecords,
  listPmsMaterialPurchaseLogs,
  listPmsMaterialPurchaseOrders,
  pmsAllowedMaterialOrderNextStatuses,
  registerPmsMaterialPurchaseArrival,
  validatePmsLogisticsImportRow,
  type PmsLogisticsImportRow,
  type PmsMaterialLogisticsRecord,
  type PmsMaterialPurchaseOrder,
  type PmsMaterialPurchaseOrderStatus,
} from '../../data/pms/material-purchase-orders.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv, buildPmsHtmlTemplateFile, downloadPmsFile } from '../../utils/pms-export.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  formatPmsTime,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

interface ImportPreviewRow {
  row: PmsLogisticsImportRow
  error: string
}

type MpoOverlay =
  | null
  | { kind: 'tmf-revision'; orderNo: string; clientActionId: string }
  | { kind: 'tip-purchase'; clientActionId: string }
  | { kind: 'detail'; orderNo: string; clientActionId: string }
  | { kind: 'arrival'; orderNo: string; clientActionId: string }
  | { kind: 'close'; orderNo: string; clientActionId: string }
  | { kind: 'import'; rows: ImportPreviewRow[]; clientActionId: string }

interface MpoPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsMaterialPurchaseOrderStatus
  logisticsFilter: '' | '未导入' | '已导入'
  selectedOrderNos: string[]
  overlay: MpoOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-mpo'
const ROOT_SELECTOR = '[data-pms-mpo-root]'

const state: MpoPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  logisticsFilter: '',
  selectedOrderNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function orderLogistics(orderNo: string): PmsMaterialLogisticsRecord[] {
  return listPmsMaterialLogisticsRecords().filter((record) => record.purchaseOrderNo === orderNo)
}

function filteredRows(): PmsMaterialPurchaseOrder[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsMaterialPurchaseOrders().filter((order) => {
    if (state.status && order.status !== state.status) return false
    if (state.logisticsFilter) {
      const hasLogistics = orderLogistics(order.purchaseOrderNo).length > 0
      if (state.logisticsFilter === '已导入' && !hasLogistics) return false
      if (state.logisticsFilter === '未导入' && hasLogistics) return false
    }
    if (!keyword) return true
    return [order.purchaseOrderNo, order.materialName, order.materialCode, order.styleName, order.supplierName, ...orderLogistics(order.purchaseOrderNo).map((record) => record.trackingNo)].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsMaterialPurchaseOrderStatus): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '待采购' || status === '已采购') return 'yellow'
  if (status === '部分到货') return 'blue'
  if (status === '已到货' || status === '已入库') return 'green'
  return 'slate'
}

const columns: StandardListColumn<PmsMaterialPurchaseOrder>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.map((row) => row.purchaseOrderNo), new Set(state.selectedOrderNos), EVENT_PREFIX),
    render: (row) => `<input type="checkbox" aria-label="选择 ${escapeHtml(row.purchaseOrderNo)}" data-${EVENT_PREFIX}-field="select-row" data-order-no="${escapeHtml(row.purchaseOrderNo)}" ${state.selectedOrderNos.includes(row.purchaseOrderNo) ? 'checked' : ''} data-skip-page-rerender="true" />`,
  },
  {
    key: 'order',
    title: '采购单 / 状态',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.purchaseOrderNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.purchaseOrderNo)}</div><div class="mt-1">${renderPmsStatusBadge(row.status, statusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.requirementNo ? `来源 ${row.requirementNo}` : '手工采购')}${row.supplierConfirmed ? ' · 供应商已确认' : ''}</div>`,
  },
  {
    key: 'material',
    title: '物料与款式',
    width: 280,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.materialImageUrl, `${row.materialName}（${row.materialCode}）实物图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.materialCode)} · ${escapeHtml(row.unit)}</div><div class="mt-1 flex items-center gap-2 text-xs text-slate-500">${renderPmsBusinessImage(row.styleImageUrl, `${row.styleName}款式图`, 'h-6 w-6')}<span>${escapeHtml(row.styleName)} · ${escapeHtml(row.styleCode)}</span></div></div></div>`,
  },
  {
    key: 'supplier',
    title: '供应商 / 仓库',
    width: 190,
    sortable: true,
    sortValue: (row) => row.supplierName,
    render: (row) => `<div class="font-medium">${escapeHtml(row.supplierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.warehouse)}</div><div class="mt-1 text-xs text-slate-500">交期 ${escapeHtml(row.expectedArrivalDate || '待定')}</div>`,
  },
  {
    key: 'qty',
    title: '采购 / 已到货',
    width: 150,
    sortable: true,
    sortValue: (row) => row.orderedQty,
    render: (row) => `<div class="text-sm tabular-nums">采购 <strong>${formatPmsQty(row.orderedQty, row.unit)}</strong></div><div class="mt-1 text-sm tabular-nums ${row.receivedQty >= row.orderedQty ? 'text-emerald-700' : 'text-amber-700'}">到货 <strong>${formatPmsQty(row.receivedQty, row.unit)}</strong></div><div class="mt-1 text-xs tabular-nums">${formatPmsMoney(row.orderedQty * row.unitPrice)}</div>`,
  },
  {
    key: 'logistics',
    title: '物流',
    width: 230,
    render: (row) => {
      const records = orderLogistics(row.purchaseOrderNo)
      if (records.length === 0) return '<span class="text-xs text-amber-700">未导入快递信息</span>'
      return `<div class="space-y-1">${records.map((record) => `<div class="text-xs"><div class="font-medium">${escapeHtml(record.company)}</div><div class="text-slate-500">${escapeHtml(record.trackingNo)} · ${formatPmsQty(record.qty, record.unit)}</div><div class="${record.domesticSigned ? 'text-emerald-700' : 'text-amber-700'}">${record.domesticSigned ? '国内已签收' : '国内未签收'}${record.headBatchNo ? ` · ${record.headSigned ? '头程已签收' : `头程 ${escapeHtml(record.headBatchNo)}`}` : ''}</div></div>`).join('')}</div>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 190,
    actionColumn: true,
    render: (row) => `<div class="flex items-center justify-end gap-1.5"><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-order-no="${escapeHtml(row.purchaseOrderNo)}" data-skip-page-rerender="true">详情</button><button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-arrival" data-order-no="${escapeHtml(row.purchaseOrderNo)}" data-skip-page-rerender="true" ${row.tmfTipSource || row.status === '已关闭' || row.status === '已入库' ? 'disabled' : ''}>登记到货</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-purchase-orders',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mpo-table-surface]',
  paginationSurfaceSelector: '[data-pms-mpo-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mpo-overlays]',
  defaultFrozenKeys: ['order', 'material'],
  columnSettingsTitle: '面辅料采购单列设置',
  emptyText: '当前条件下暂无面辅料采购单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function syncBatchButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="batch-purchased"], [data-${EVENT_PREFIX}-action="batch-inbound"]`).forEach((button) => {
    button.disabled = state.selectedOrderNos.length === 0
  })
  const count = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selected-count]`)
  if (count) count.textContent = `已选 ${state.selectedOrderNos.length} 张`
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedOrderNos.length ? ` · 已选 ${state.selectedOrderNos.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function renderFilters(): string {
  const statuses: Array<'' | PmsMaterialPurchaseOrderStatus> = ['', '待采购', '已采购', '部分到货', '已到货', '已入库', '已关闭']
  const statusOptions = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const logisticsOptions = ['', '未导入', '已导入'].map((value) => `<option value="${value}" ${state.logisticsFilter === value ? 'selected' : ''}>${value || '全部物流'}</option>`).join('')
  const advancedCount = state.logisticsFilter ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="采购单号 / 物料 / 供应商 / 物流单号" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购单状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">物流</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="logisticsFilter" data-skip-page-rerender="true">${logisticsOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('导入快递信息', { prefix: EVENT_PREFIX, action: 'open-import' }, 'upload')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '采购单总数', value: rows.length },
    { label: '待采购 / 已采购', value: rows.filter((row) => row.status === '待采购' || row.status === '已采购').length },
    { label: '未导入物流', value: rows.filter((row) => orderLogistics(row.purchaseOrderNo).length === 0).length },
    { label: '采购金额', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.orderedQty * row.unitPrice, 0)) },
  ])
}

function renderDetailOverlay(orderNo: string): string {
  const order = getPmsMaterialPurchaseOrder(orderNo)
  if (!order) return ''
  const records = orderLogistics(orderNo)
  const nextStatuses = pmsAllowedMaterialOrderNextStatuses(order.status)
  const advanceButtons = nextStatuses
    .filter((status) => status !== '已关闭' && (!order.tmfTipSource || status === '已采购'))
    .map((status) => renderSecondaryButton(`推进为${status}`, { prefix: EVENT_PREFIX, action: 'advance-status' }, 'arrow-right').replace('<button', `<button data-order-no="${escapeHtml(orderNo)}" data-next-status="${status}"`))
    .join('')
  const recordsHtml = records.length
    ? records.map((record) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(record.company)}</td><td class="px-3 py-2 text-sm">${escapeHtml(record.trackingNo)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(record.qty, record.unit)}</td><td class="px-3 py-2 text-sm">${escapeHtml(record.shipDate || '—')}</td><td class="px-3 py-2">${record.domesticSigned ? renderPmsStatusBadge('国内已签收', 'green') : renderPmsStatusBadge('国内未签收', 'yellow')}</td><td class="px-3 py-2">${record.headBatchNo ? (record.headSigned ? renderPmsStatusBadge(`头程已签收 ${record.headBatchNo}`, 'green') : renderPmsStatusBadge(`头程 ${record.headBatchNo}`, 'blue')) : renderPmsStatusBadge('未加入头程', 'slate')}</td></tr>`).join('')
    : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="6">还没有导入快递信息</td></tr>'
  const logs = listPmsMaterialPurchaseLogs(orderNo)
  const logItems = logs.length
    ? logs.map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></li>`).join('')
    : '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="面辅料采购单详情" data-pms-mpo-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[820px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(order.purchaseOrderNo)} · ${escapeHtml(order.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.supplierName)} · ${escapeHtml(order.warehouse)} · ${escapeHtml(order.status)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(order.materialImageUrl, `${order.materialName}（${order.materialCode}）实物图`, 'h-20 w-20')}<div class="w-40 shrink-0"><div class="font-medium">${escapeHtml(order.materialName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(order.materialCode)} · ${escapeHtml(order.unit)}</div></div><dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">采购数量</dt><dd class="mt-1 font-semibold tabular-nums">${formatPmsQty(order.orderedQty, order.unit)}</dd></div><div><dt class="text-xs text-muted-foreground">已到货</dt><dd class="mt-1 tabular-nums">${formatPmsQty(order.receivedQty, order.unit)}</dd></div><div><dt class="text-xs text-muted-foreground">采购金额</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(order.orderedQty * order.unitPrice)}</dd></div>${getTmfMaterialPurchase(orderNo) && !order.styleCode ? '<div><dt class="text-xs text-muted-foreground">备货用途</dt><dd class="mt-1">基础备货</dd></div>' : `<div><dt class="text-xs text-muted-foreground">款式</dt><dd class="mt-1 flex items-center gap-2">${renderPmsBusinessImage(order.styleImageUrl, `${order.styleName}款式图`, 'h-6 w-6')}<span>${escapeHtml(order.styleName)} · ${escapeHtml(order.styleCode)}</span></dd></div>`}<div><dt class="text-xs text-muted-foreground">交期</dt><dd class="mt-1">${escapeHtml(order.expectedArrivalDate || '待定')}</dd></div><div><dt class="text-xs text-muted-foreground">供应商确认</dt><dd class="mt-1">${order.supplierConfirmed ? renderPmsStatusBadge('已确认', 'green') : renderPmsStatusBadge('待确认', 'yellow')}</dd></div></dl></div>
    ${order.tmfTipSource ? `<section data-pms-tip-purchase-origin class="rounded-lg border p-4 text-sm"><h3 class="font-semibold">端头辅材采购来源</h3><p>生产单 ${escapeHtml(order.tmfTipSource.productionOrderNo)}；采用版本 ${escapeHtml(order.tmfTipSource.versionId)}</p><p>快照 ${escapeHtml(order.tmfTipSource.snapshotId)}；辅材 BOM ${escapeHtml(order.tmfTipSource.materialBomItemId)}</p><p class="mt-2">到货、入库数量来自仓库实际实收，不能手改累计。<a href="/wls/accessory-receipts" class="text-blue-700 underline">前往辅料仓收货</a>，选择“织带投入料采购”。</p></section>` : ''}
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">可执行动作</h3><div class="mt-3 flex flex-wrap gap-2">${getTmfMaterialPurchase(orderNo) && !['已关闭','已入库'].includes(order.status) ? renderSecondaryButton('变更基础采购数量',{prefix:EVENT_PREFIX,action:'open-tmf-revision'}).replace('<button',`<button data-order-no="${escapeHtml(orderNo)}"`) : ''}${advanceButtons}${renderSecondaryButton('登记到货', { prefix: EVENT_PREFIX, action: 'open-arrival' }, 'package-check').replace('<button', `<button data-order-no="${escapeHtml(orderNo)}" ${order.tmfTipSource || order.status === '已关闭' || order.status === '已入库' ? 'disabled' : ''}`)}${nextStatuses.includes('已关闭') ? renderDangerButton('关闭采购单', { prefix: EVENT_PREFIX, action: 'open-close' }, 'x-circle').replace('<button', `<button data-order-no="${escapeHtml(orderNo)}"`) : ''}</div><p class="mt-2 text-xs text-slate-500">状态顺序：待采购 → 已采购 → 部分到货/已到货 → 已入库；已关闭不可恢复。</p></section>
    <section><h3 class="mb-2 text-sm font-semibold">物流记录（${records.length}）</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 760px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">物流公司</th><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">发货日期</th><th class="px-3 py-2">国内签收</th><th class="px-3 py-2">头程</th></tr></thead><tbody>${recordsHtml}</tbody></table></div></section>
    ${getTmfMaterialPurchase(orderNo) ? renderTmfPurchaseRevisionHistory(orderNo) : ''}
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logItems}</ul></section>
  </div></section></div>`
}

function renderArrivalOverlay(orderNo: string): string {
  const order = getPmsMaterialPurchaseOrder(orderNo)
  if (!order) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="登记到货" data-pms-mpo-arrival-root><section class="w-full max-w-lg rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">登记到货 · ${escapeHtml(orderNo)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.materialName)} · 采购 ${formatPmsQty(order.orderedQty, order.unit)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-3 p-4">${renderPmsOverlayError(state.overlayError)}<label class="flex flex-col gap-1 text-xs text-muted-foreground">本次累计到货数量（${escapeHtml(order.unit)}）
    <input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${order.receivedQty > 0 ? order.receivedQty : order.orderedQty}" data-${EVENT_PREFIX}-arrival-qty data-skip-page-rerender="true" />
  </label><p class="text-xs text-slate-500">到货数量小于采购数量记为“部分到货”，等于采购数量记为“已到货”。</p></div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存到货', { prefix: EVENT_PREFIX, action: 'submit-arrival' }, 'check-check')}</footer></section></div>`
}

function renderImportOverlay(rows: ImportPreviewRow[]): string {
  const errorCount = rows.filter((item) => item.error).length
  const previewRows = rows.length
    ? rows.map((item) => `<tr class="border-b last:border-b-0 ${item.error ? 'bg-red-50' : ''}"><td class="px-3 py-2 text-sm">${escapeHtml(item.row.purchaseOrderNo)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.row.company)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.row.trackingNo)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.row.shipDate || '—')}</td><td class="px-3 py-2 text-sm tabular-nums">${item.row.boxCount}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(item.row.qty)}</td><td class="px-3 py-2 text-sm tabular-nums">¥${item.row.fee.toFixed(2)}</td><td class="px-3 py-2 text-xs ${item.error ? 'text-red-700' : 'text-emerald-700'}">${escapeHtml(item.error || '校验通过')}</td></tr>`).join('')
    : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">请选择模板文件，或先下载模板填写后上传</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="导入快递信息" data-pms-mpo-import-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭导入"></button><section class="relative z-10 flex h-full w-[980px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">导入快递信息</h2><p class="mt-1 text-xs text-slate-500">支持模板 .xls / .xlsx / CSV；物流单号不可重复，错误行会在确认时阻断</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
      ${renderSecondaryButton('下载导入模板', { prefix: EVENT_PREFIX, action: 'download-template' }, 'download')}
      <label class="flex items-center gap-2 text-sm">选择文件
        <input type="file" accept=".xlsx,.xls,.csv,.txt" class="text-xs" data-${EVENT_PREFIX}-field="import-file" data-skip-page-rerender="true" />
      </label>
      <span class="text-xs text-slate-500">共解析 ${rows.length} 行${errorCount > 0 ? `，其中 ${errorCount} 行存在错误` : ''}</span>
    </div>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 900px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">采购单号</th><th class="px-3 py-2">物流公司</th><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">发货日期</th><th class="px-3 py-2">箱数</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">运费</th><th class="px-3 py-2">校验</th></tr></thead><tbody>${previewRows}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认导入', { prefix: EVENT_PREFIX, action: 'submit-import' }, 'check-check').replace('<button', `<button ${rows.length > 0 && errorCount === 0 ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderCloseOverlay(orderNo: string): string {
  const order = getPmsMaterialPurchaseOrder(orderNo)
  if (!order) return ''
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="关闭面辅料采购单" data-pms-mpo-close-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">关闭 ${escapeHtml(orderNo)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.materialName)} · ${escapeHtml(order.status)} · 关闭后不可恢复</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">关闭原因（必填）<textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" placeholder="如供应商无法交付、终端取消" data-${EVENT_PREFIX}-close-reason data-skip-page-rerender="true"></textarea></label>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认关闭', { prefix: EVENT_PREFIX, action: 'submit-close' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-mpo-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'tmf-revision') return `${columnSettings}${renderTmfPurchaseRevision(state.overlay.orderNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'tip-purchase') return `${columnSettings}${renderTmfTipPurchaseForm()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.orderNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'arrival') return `${columnSettings}${renderArrivalOverlay(state.overlay.orderNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'close') return `${columnSettings}${renderCloseOverlay(state.overlay.orderNo)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderImportOverlay(state.overlay.rows)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '面辅料采购单',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条${state.selectedOrderNos.length ? ` · 已选 ${state.selectedOrderNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('创建端头辅材采购', { prefix: EVENT_PREFIX, action: 'open-tip-purchase' }, 'plus')}<span class="text-xs text-muted-foreground">快递信息导入后自动同步采购跟踪</span><span class="text-xs text-muted-foreground" data-pms-mpo-selected-count>已选 ${state.selectedOrderNos.length} 张</span>${renderSecondaryButton('标记已采购', { prefix: EVENT_PREFIX, action: 'batch-purchased' }, 'list-checks').replace('<button', `<button ${state.selectedOrderNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('标记已入库', { prefix: EVENT_PREFIX, action: 'batch-inbound' }, 'list-checks').replace('<button', `<button ${state.selectedOrderNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-mpo-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mpo-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mpo-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
  syncProcessSelectionHeader(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的面辅料采购单。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料采购单.csv',
    ['采购单号', '来源需求', '物料编码', '物料名称', '款式', '单位', '采购数量', '已到货', '单价', '金额', '供应商', '仓库', '状态', '交期', '物流单号', '供应商确认'],
    rows.map((row) => [row.purchaseOrderNo, row.requirementNo, row.materialCode, row.materialName, row.styleName, row.unit, row.orderedQty, row.receivedQty, row.unitPrice, (row.orderedQty * row.unitPrice).toFixed(2), row.supplierName, row.warehouse, row.status, row.expectedArrivalDate, orderLogistics(row.purchaseOrderNo).map((record) => record.trackingNo).join('、'), row.supplierConfirmed ? '已确认' : '待确认']),
  )
  state.feedback = `已导出 ${rows.length} 张面辅料采购单（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function downloadTemplate(): void {
  const html = buildPmsHtmlTemplateFile(
    '快递信息导入模板',
    ['采购单号', '物流公司', '物流单号', '发货日期', '预计到达日期', '箱数', '卷数', '数量', '运费', '备注'],
    [
      ['CGF-2026-0001', '顺丰速运', 'SF1368000123456', '2026-06-10', '2026-06-13', 6, 6, 552, 380, ''],
      ['CGF-2026-0004', '德邦物流', 'DB6600123987', '2026-06-11', '2026-06-14', 8, 8, 800, 460, ''],
    ],
  )
  downloadPmsFile('快递信息导入模板.xls', html, 'application/vnd.ms-excel')
}

function mapImportRows(rawRows: string[][]): ImportPreviewRow[] {
  const start = rawRows.length > 0 && /采购单号/.test(rawRows[0][0] ?? '') ? 1 : 0
  const existing = new Set(listPmsMaterialLogisticsRecords().map((record) => record.trackingNo))
  const seen = new Set<string>()
  return rawRows
    .slice(start)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      const row: PmsLogisticsImportRow = {
        purchaseOrderNo: (cells[0] ?? '').trim(),
        company: (cells[1] ?? '').trim(),
        trackingNo: (cells[2] ?? '').trim(),
        shipDate: (cells[3] ?? '').trim(),
        estimatedArrival: (cells[4] ?? '').trim(),
        boxCount: Number.parseInt(cells[5] ?? '0', 10) || 0,
        rolls: Number.parseInt(cells[6] ?? '0', 10) || 0,
        qty: Number.parseFloat(cells[7] ?? '') || 0,
        fee: Number.parseFloat(cells[8] ?? '') || 0,
        remark: (cells[9] ?? '').trim(),
      }
      const error = validatePmsLogisticsImportRow(row, existing, seen)
      if (!error) seen.add(row.trackingNo)
      return { row, error }
    })
}

function handleImportFile(file: File): void {
  parsePmsExcelRows(file)
    .then((rows) => {
      state.overlay = { kind: 'import', rows: mapImportRows(rows), clientActionId: nextPmsActionId('pms-mpo-import') }
      state.overlayError = ''
      refreshOverlays()
    })
    .catch((error: unknown) => {
      state.overlayError = error instanceof Error ? error.message : '解析文件失败，请使用导入模板'
      refreshOverlays()
    })
}

function submitArrival(orderNo: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-arrival-root]')
  if (!surface) return
  const qty = Number.parseFloat(readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-arrival-qty]`))
  try {
    const order = registerPmsMaterialPurchaseArrival(orderNo, qty, PMS_BUYER_ACTOR)
    state.feedback = `${orderNo} 已登记到货 ${formatPmsQty(order.receivedQty, order.unit)}，状态为${order.status}。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '登记到货失败'
    refreshOverlays()
  }
}

function submitImport(rows: ImportPreviewRow[]): void {
  try {
    const imported = importPmsMaterialLogistics(rows.map((item) => item.row), PMS_BUYER_ACTOR)
    state.feedback = `已导入 ${imported.length} 条快递信息，采购跟踪已同步。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '导入快递信息失败'
    refreshOverlays()
  }
}

function batchAdvance(nextStatus: PmsMaterialPurchaseOrderStatus): void {
  try {
    const updated = batchAdvancePmsMaterialPurchaseOrders([...state.selectedOrderNos], nextStatus, PMS_BUYER_ACTOR)
    state.feedback = `已将 ${updated.length} 张采购单推进为${nextStatus}。`
    state.feedbackOk = true
    state.selectedOrderNos = []
    refreshAll()
  } catch (error) {
    state.feedback = error instanceof PmsDomainError ? error.message : '批量状态推进失败'
    state.feedbackOk = false
    refreshAll()
  }
}

export function renderPmsMaterialPurchaseOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-mpo-root data-skip-page-rerender="true"><style>[data-pms-mpo-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsMaterialPurchaseOrderOverlays(): boolean {
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

export function handlePmsMaterialPurchaseOrdersEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMpoField
  if (field && fieldName) {
    if (fieldName === 'tip-purchase-source') {
      const form = rootElement()?.querySelector('[data-pms-tip-purchase-form]')
      if (form) updateTmfTipPurchaseSource(form)
      return true
    }
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as MpoPageState['status']
      return true
    }
    if (fieldName === 'logisticsFilter') {
      state.logisticsFilter = field.value as MpoPageState['logisticsFilter']
      return true
    }
    if (fieldName === 'select-row') {
      const orderNo = field.dataset.orderNo || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedOrderNos = [...new Set([...state.selectedOrderNos, orderNo])]
      } else {
        state.selectedOrderNos = state.selectedOrderNos.filter((no) => no !== orderNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') {
        state.selectedOrderNos = []
      } else if (scope === 'page') {
        state.selectedOrderNos = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`) ?? [])].map((box) => box.dataset.orderNo || '')
      } else {
        state.selectedOrderNos = filteredRows().map((row) => row.purchaseOrderNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'import-file') {
      if (field instanceof HTMLInputElement && field.files?.[0]) handleImportFile(field.files[0])
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsMpoAction
  if (!action) return false

  if (action === 'open-tip-purchase') {
    state.overlay = { kind: 'tip-purchase', clientActionId: `TMF-TIP-PURCHASE:${crypto.randomUUID()}` }
    state.overlayError = ''
    refreshOverlays()
    rootElement()?.querySelector<HTMLSelectElement>('[data-pms-tip-purchase-form] [name="source"]')?.focus()
    return true
  }
  if (action === 'submit-tip-purchase' && state.overlay?.kind === 'tip-purchase') {
    const form = rootElement()?.querySelector('[data-pms-tip-purchase-form]')
    if (!form) return true
    try {
      const order = createPmsTmfTipPurchase(readTmfTipPurchaseForm(form), PMS_BUYER_ACTOR, state.overlay.clientActionId)
      state.keyword = order.purchaseOrderNo; state.status = ''; state.logisticsFilter = ''; state.currentPage = 1
      state.overlay = null; state.overlayError = ''
      state.feedback = `${order.purchaseOrderNo} 已创建，物料与生产采用版本关联。请核对后下达采购。`; state.feedbackOk = true
      refreshAll()
    } catch (error) {
      const message = form.querySelector('[data-pms-tip-purchase-error]')
      if (message) message.textContent = error instanceof Error ? error.message : '采购未保存，请重试。'
    }
    return true
  }
  if (action === 'toggle-page') {
    const checked = actionNode instanceof HTMLInputElement && actionNode.checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const orderNo = box.dataset.orderNo || ''
      if (checked) state.selectedOrderNos = [...new Set([...state.selectedOrderNos, orderNo])]
      else state.selectedOrderNos = state.selectedOrderNos.filter((no) => no !== orderNo)
    })
    controller.refresh({ overlays: false })
    syncBatchButtons()
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
    state.logisticsFilter = ''
    state.selectedOrderNos = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-mpo-column-key]')?.dataset.pmsMpoColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
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
    state.overlay = { kind: 'detail', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-mpo-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-tmf-revision') {
    state.overlay = { kind: 'tmf-revision', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('tmf-purchase-revision') }
    state.overlayError = ''; refreshOverlays(); return true
  }
  if (action === 'submit-tmf-revision' && state.overlay?.kind === 'tmf-revision') {
    const form = rootElement()?.querySelector<HTMLElement>('[data-tmf-purchase-revision]')
    if (!form) return true
    try {
      const quantity = Number(form.querySelector<HTMLInputElement>('[name="orderedQty"]')!.value)
      const order = getTmfMaterialPurchase(state.overlay.orderNo)
      if (order?.orderedQty === quantity) throw new Error('数量未变化，请修改数量或取消。')
      reviseTmfMaterialPurchase(state.overlay.orderNo, { orderedQty: quantity,
        expectedVersion: Number(form.dataset.version), reason: form.querySelector<HTMLInputElement>('[name="reason"]')!.value.trim(),
        confirmed: form.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked }, PMS_BUYER_ACTOR as TmfPurchaseActor, state.overlay.clientActionId)
      state.feedback = '采购数量变更已保存。请核对基础计划版本及是否需要重新接单或处置。'; state.feedbackOk = true
      state.overlay = {kind:'detail',orderNo:order!.purchaseOrderNo,clientActionId:nextPmsActionId('pms-mpo-detail')}
      refreshAll()
    } catch (error) {
      form.querySelector('[data-tmf-purchase-revision-error]')!.textContent = error instanceof Error ? error.message : '变更未保存，请重试。'
    }
    return true
  }
  if (action === 'open-arrival') {
    state.overlay = { kind: 'arrival', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-mpo-arrival') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-close') {
    state.overlay = { kind: 'close', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-mpo-close') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'submit-close') {
    if (state.overlay?.kind !== 'close') return true
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-close-root]')
    const reason = surface ? readTextField(surface, `[data-${EVENT_PREFIX}-close-reason]`) : ''
    try {
      closePmsMaterialPurchaseOrder(state.overlay.orderNo, reason, PMS_BUYER_ACTOR)
      state.feedback = `已关闭 ${state.overlay.orderNo}，原因已记录。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '关闭采购单失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'open-import') {
    state.overlay = { kind: 'import', rows: [], clientActionId: nextPmsActionId('pms-mpo-import') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'download-template') {
    downloadTemplate()
    return true
  }
  if (action === 'submit-arrival') {
    if (state.overlay?.kind === 'arrival') submitArrival(state.overlay.orderNo)
    return true
  }
  if (action === 'submit-import') {
    if (state.overlay?.kind === 'import') submitImport(state.overlay.rows)
    return true
  }
  if (action === 'batch-purchased') {
    batchAdvance('已采购')
    return true
  }
  if (action === 'batch-inbound') {
    batchAdvance('已入库')
    return true
  }
  if (action === 'advance-status') {
    const orderNo = actionNode?.dataset.orderNo || ''
    const nextStatus = actionNode?.dataset.nextStatus as PmsMaterialPurchaseOrderStatus | undefined
    if (!nextStatus) return true
    try {
      batchAdvancePmsMaterialPurchaseOrders([orderNo], nextStatus, PMS_BUYER_ACTOR)
      state.feedback = `${orderNo} 已推进为${nextStatus}。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '状态推进失败'
      refreshOverlays()
    }
    return true
  }
  return false
}

export function getPmsMaterialPurchaseOrderRowCountForTest(): number {
  return filteredRows().length
}
