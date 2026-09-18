// @page-pattern: list
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  PMS_LOGISTICS_FEE_ITEMS,
  PMS_LOGISTICS_IMPORT_HEADERS,
  confirmAllPmsLogisticsReconciliationFees,
  confirmPmsLogisticsReconciliation,
  confirmPmsLogisticsReconciliationDifference,
  confirmPmsLogisticsReconciliationFeeItem,
  getPmsLogisticsReconciliation,
  importPmsLogisticsActualFees,
  listPmsLogisticsReconciliationPurchases,
  listPmsLogisticsReconciliationShipments,
  listPmsLogisticsReconciliations,
  updatePmsLogisticsReconciliationBill,
  updatePmsLogisticsReconciliationFee,
  validatePmsLogisticsActualImportRow,
  type PmsLogisticsActualImportRow,
  type PmsLogisticsFeeKey,
  type PmsLogisticsReconciliation,
} from '../../data/pms/reconciliations.ts'
import { setPmsFirstLegTargetBatchNo } from '../../data/pms/first-leg-logistics.ts'
import { getPmsMaterial } from '../../data/pms/materials.ts'
import { setPmsLogisticsPaymentDraft } from '../../data/pms/payment-requests.ts'
import { PmsDomainError } from '../../data/pms/runtime.ts'
import { appStore } from '../../state/store.ts'
import { buildPmsHtmlTemplateFile, downloadPmsCsv, downloadPmsFile } from '../../utils/pms-export.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readNumberField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

interface ImportPreviewRow {
  row: PmsLogisticsActualImportRow
  error: string
}

type LogisticsReconOverlay =
  | null
  | { kind: 'detail'; id: string }
  | { kind: 'import'; rows: ImportPreviewRow[] }

interface LogisticsReconPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsLogisticsReconciliation['status']
  carrierFilter: string
  transportFilter: string
  selectedIds: string[]
  overlay: LogisticsReconOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
  armedConfirm: string
}

const EVENT_PREFIX = 'pms-lrec'
const ROOT_SELECTOR = '[data-pms-lrec-root]'
const FINANCE = { id: 'USR-PMS-LIU', name: '刘财务', role: '财务' as const }
const ARMED_CONFIRM_ACTIONS = new Set(['confirm-all-fees', 'confirm-difference', 'confirm-recon'])

const state: LogisticsReconPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  carrierFilter: '',
  transportFilter: '',
  selectedIds: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  armedConfirm: '',
}

function armedKey(action: string, reconId: string): string {
  return `${action}::${reconId}`
}

function renderMaterialThumb(materialCode: string, materialName: string, sizeClass: string): string {
  const imageUrl = getPmsMaterial(materialCode)?.imageUrl
  return imageUrl ? renderPmsBusinessImage(imageUrl, `${materialName}（${materialCode}）物料图`, sizeClass) : ''
}

function logisticsStatusTone(status: PmsLogisticsReconciliation['status']): 'green' | 'yellow' | 'blue' {
  if (status === '已确认') return 'green'
  if (status === '部分确认') return 'blue'
  return 'yellow'
}

function filteredRows(): PmsLogisticsReconciliation[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsLogisticsReconciliations().filter((row) => {
    if (state.status && row.status !== state.status) return false
    if (state.carrierFilter && row.carrierId !== state.carrierFilter) return false
    if (state.transportFilter && row.transportMethod !== state.transportFilter) return false
    if (!keyword) return true
    return [row.id, row.batchNo, row.carrierName, row.channelName].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsLogisticsReconciliation>[] = [
  {
    key: 'select',
    title: '',
    width: 72,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.filter((row) => row.status === '已确认' && !row.paymentRequestNo).map((row) => row.id), new Set(state.selectedIds), EVENT_PREFIX),
    render: (row) => {
      const selectable = row.status === '已确认' && !row.paymentRequestNo
      return `<input type="checkbox" aria-label="选择 ${escapeHtml(row.id)}" data-${EVENT_PREFIX}-field="select-row" data-recon-id="${escapeHtml(row.id)}" ${state.selectedIds.includes(row.id) ? 'checked' : ''} ${selectable ? '' : 'disabled'} data-skip-page-rerender="true" />`
    },
  },
  {
    key: 'recon',
    title: '对账记录 / 状态',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.id,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.id)}</div><div class="mt-1">${renderPmsStatusBadge(row.status, logisticsStatusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">${row.paymentRequestNo ? `请款单 ${escapeHtml(row.paymentRequestNo)}` : '未生成请款单'}</div>`,
  },
  {
    key: 'batch',
    title: '头程单 / 物流商',
    width: 260,
    required: true,
    freezeable: true,
    render: (row) => `<div class="font-medium">${escapeHtml(row.batchNo)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.carrierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.channelName)} · ${escapeHtml(row.currency)}</div>`,
  },
  {
    key: 'estimated',
    title: '预计费用',
    width: 150,
    sortable: true,
    sortValue: (row) => row.estimatedTotal,
    render: (row) => `<div class="text-sm tabular-nums">${formatPmsMoney(row.estimatedTotal)}</div><div class="mt-1 text-xs text-slate-500">${row.fees.filter((fee) => fee.estimated > 0).length} 项</div>`,
  },
  {
    key: 'actual',
    title: '实际 / 差异',
    width: 220,
    sortable: true,
    sortValue: (row) => row.actualTotal,
    render: (row) => `<div class="text-sm tabular-nums">实际 ${row.actualTotal > 0 ? formatPmsMoney(row.actualTotal) : '未导入'}</div><div class="mt-1 text-xs tabular-nums text-slate-500">预计/实际差异 ${row.actualTotal > 0 ? formatPmsMoney(row.feeDifference) : '未导入'}</div><div class="mt-1 text-sm tabular-nums ${row.difference === 0 ? 'text-emerald-700' : 'text-amber-700'}">账单 ${formatPmsMoney(row.supplierBillAmount)} · 差异 ${formatPmsMoney(row.difference)}</div>${row.importedAt ? `<div class="mt-1 text-xs text-slate-500">导入 ${escapeHtml(row.importedAt.slice(0, 16).replace('T', ' '))}</div>` : ''}`,
  },
  {
    key: 'shipment',
    title: '运单 / 货件 / 签收',
    width: 220,
    render: (row) => {
      const shipments = listPmsLogisticsReconciliationShipments(row.batchNo)
      if (shipments.length === 0) return '<span class="text-xs text-slate-500">无关联物流记录</span>'
      const totalIssued = shipments.reduce((sum, item) => sum + item.issuedQty, 0)
      const totalSigned = shipments.reduce((sum, item) => sum + item.signedQty, 0)
      return `<div class="text-sm">${shipments.length} 个运单 · ${shipments[0].trackingNo}${shipments.length > 1 ? ' 等' : ''}</div><div class="mt-1 text-xs tabular-nums text-slate-500">发出 ${formatPmsQty(totalIssued)} / 签收 ${formatPmsQty(totalSigned)}</div><div class="mt-1 text-xs text-slate-500">货件 ${shipments.map((item) => item.recordNo).slice(0, 2).join('、')}${shipments.length > 2 ? ' 等' : ''}</div>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 130,
    actionColumn: true,
    render: (row) => `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-recon-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">对账处理</button>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/logistics-reconciliations',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-lrec-table-surface]',
  paginationSurfaceSelector: '[data-pms-lrec-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-lrec-overlays]',
  defaultFrozenKeys: ['recon', 'batch'],
  columnSettingsTitle: '物流费用对账列设置',
  emptyText: '当前条件下暂无物流对账记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '待确认', '部分确认', '已确认'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const carriers = [...new Map(listPmsLogisticsReconciliations().map((row) => [row.carrierId, row.carrierName])).entries()].filter(([id]) => id)
  const carrierOptions = [`<option value="">全部物流商</option>`, ...carriers.map(([id, name]) => `<option value="${escapeHtml(id)}" ${state.carrierFilter === id ? 'selected' : ''}>${escapeHtml(name)}</option>`)].join('')
  const transportOptions = ['', '海卡', '海派', '空卡', '空派', '铁路', '快递', '卡航'].map((value) => `<option value="${value}" ${state.transportFilter === value ? 'selected' : ''}>${value || '全部运输方式'}</option>`).join('')
  const advancedCount = (state.carrierFilter ? 1 : 0) + (state.transportFilter ? 1 : 0)
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="对账记录 / 头程单 / 物流商 / 渠道" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">物流商</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="carrierFilter" data-skip-page-rerender="true">${carrierOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">运输方式</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="transportFilter" data-skip-page-rerender="true">${transportOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('导入实际费用', { prefix: EVENT_PREFIX, action: 'open-import' }, 'upload')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '对账记录', value: rows.length },
    { label: '待确认', value: rows.filter((row) => row.status === '待确认').length },
    { label: '部分确认', value: rows.filter((row) => row.status === '部分确认').length },
    { label: '实际费用合计', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.actualTotal, 0)) },
    { label: '差异合计', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.difference, 0)) },
  ])
}

function renderDetailOverlay(id: string): string {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) return ''
  const editable = row.status !== '已确认'
  const allFeesArmed = state.armedConfirm === armedKey('confirm-all-fees', id)
  const differenceArmed = state.armedConfirm === armedKey('confirm-difference', id)
  const reconArmed = state.armedConfirm === armedKey('confirm-recon', id)
  const feeRows = row.fees
    .map((fee) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(fee.label)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(fee.estimated)}</td><td class="px-3 py-2">${editable ? `<input class="h-8 w-28 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${fee.actual}" data-${EVENT_PREFIX}-fee-key="${fee.key}" data-skip-page-rerender="true" />` : `<span class="tabular-nums">${fee.actual > 0 ? formatPmsMoney(fee.actual) : '未录入'}</span>`}</td><td class="px-3 py-2">${fee.confirmed ? renderPmsStatusBadge('已确认', 'green') : fee.actual > 0 ? (editable ? `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="confirm-fee" data-recon-id="${escapeHtml(id)}" data-fee-key="${fee.key}" data-skip-page-rerender="true">确认</button>` : renderPmsStatusBadge('未确认', 'red')) : renderPmsStatusBadge('待录入', 'slate')}</td></tr>`)
    .join('')
  const differenceConfirmButton = editable && row.difference !== 0 && !row.differenceConfirmed
    ? `<button type="button" class="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800" data-${EVENT_PREFIX}-action="confirm-difference" data-recon-id="${escapeHtml(id)}" data-skip-page-rerender="true">${differenceArmed ? '再次点击确认差异' : '确认差异'} ${formatPmsMoney(row.difference)}</button>`
    : ''
  const confirmArmedHint = allFeesArmed || differenceArmed || reconArmed
    ? `<p class="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-pms-lrec-armed-hint>该操作会推进对账结算：请再次点击“再次点击确认…”按钮完成；点击其它操作或关闭覆盖层可取消。</p>`
    : ''
  const purchases = listPmsLogisticsReconciliationPurchases(row.batchNo)
  const allFeesConfirmed = row.fees.every((fee) => fee.confirmed)
  const confirmDisabled = row.status === '已确认' || row.actualTotal <= 0 || !allFeesConfirmed || (row.difference !== 0 && !row.differenceConfirmed)
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="物流费用对账处理" data-pms-lrec-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭对账处理"></button><section class="relative z-10 flex h-full w-[720px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(row.id)} · ${escapeHtml(row.batchNo)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.carrierName)} · ${escapeHtml(row.channelName)}${row.transportMethod ? ` · ${escapeHtml(row.transportMethod)}` : ''} · ${renderPmsStatusBadge(row.status, logisticsStatusTone(row.status))}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">${renderPmsOverlayError(state.overlayError)}${confirmArmedHint}
    <section class="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm"><div><dt class="text-xs text-muted-foreground">预计合计</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(row.estimatedTotal)}</dd></div><div><dt class="text-xs text-muted-foreground">实际合计 / 预计差异</dt><dd class="mt-1 font-semibold tabular-nums">${row.actualTotal > 0 ? formatPmsMoney(row.actualTotal) : '未导入'}<span class="ml-2 text-xs font-normal ${row.feeDifference === 0 ? 'text-emerald-700' : 'text-amber-700'}">${row.actualTotal > 0 ? formatPmsMoney(row.feeDifference) : '未导入'}</span></dd></div><div><dt class="text-xs text-muted-foreground">供应商账单 / 差异</dt><dd class="mt-1 tabular-nums">${editable ? `<input class="h-8 w-32 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${row.supplierBillAmount}" data-${EVENT_PREFIX}-bill-amount data-skip-page-rerender="true" />` : formatPmsMoney(row.supplierBillAmount)} · <span class="${row.difference === 0 ? 'text-emerald-700' : 'text-amber-700'}">${formatPmsMoney(row.difference)}</span></dd></div></section>
    <section class="overflow-hidden rounded-lg border"><header class="flex items-center justify-between border-b bg-muted/30 px-4 py-3"><h3 class="text-sm font-semibold">费用明细（7 项）</h3>${editable ? `<div class="flex items-center gap-2">${renderSecondaryButton('保存实际费用', { prefix: EVENT_PREFIX, action: 'save-fees' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}"`)}${renderSecondaryButton(allFeesArmed ? '再次点击确认全部费用' : '确认全部费用', { prefix: EVENT_PREFIX, action: 'confirm-all-fees' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}"`)}${renderSecondaryButton('保存供应商账单', { prefix: EVENT_PREFIX, action: 'save-bill' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}"`)}</div>` : ''}</header><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">费用项</th><th class="px-3 py-2">预计金额</th><th class="px-3 py-2">实际金额</th><th class="px-3 py-2">确认</th></tr></thead><tbody>${feeRows}</tbody></table></section>
    ${editable ? `<section class="flex flex-wrap items-center gap-2 rounded-lg border p-4">${differenceConfirmButton}${renderPrimaryButton(reconArmed ? '再次点击确认对账' : '确认对账', { prefix: EVENT_PREFIX, action: 'confirm-recon' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}" ${confirmDisabled ? 'disabled' : ''}`)}<span class="text-xs text-slate-500">需先录入实际费用并逐项确认（或确认全部费用）；差异不为 0 时必须先确认差异。</span></section>` : `<p class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">对账已确认，费用字段锁定。</p>`}
    <section class="rounded-lg border p-4 text-sm"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold">关联采购单（${purchases.length}）</h3>${renderSecondaryButton('查看头程完整信息', { prefix: EVENT_PREFIX, action: 'open-first-leg' }, 'eye').replace('<button', `<button data-batch-no="${escapeHtml(id === '' ? '' : row.batchNo)}"`)}</div>${purchases.length > 0 ? `<div class="mt-2 overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 760px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">采购单号</th><th class="px-3 py-2">物料</th><th class="px-3 py-2">款式</th><th class="px-3 py-2">采购数量</th><th class="px-3 py-2">单价 / 金额</th><th class="px-3 py-2">供应商</th><th class="px-3 py-2">状态</th></tr></thead><tbody>${purchases.map((purchase) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(purchase.purchaseOrderNo)}</td><td class="px-3 py-2 text-sm"><div class="flex items-center gap-2">${renderMaterialThumb(purchase.materialCode, purchase.materialName, 'h-8 w-8')}<div><div class="font-medium">${escapeHtml(purchase.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(purchase.materialCode)}</div></div></div></td><td class="px-3 py-2 text-sm">${escapeHtml(purchase.styleName)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(purchase.qty, purchase.unit)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(purchase.unitPrice)} · ${formatPmsMoney(purchase.amount)}</td><td class="px-3 py-2 text-sm">${escapeHtml(purchase.supplierName)}</td><td class="px-3 py-2 text-sm">${escapeHtml(purchase.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mt-2 text-xs text-slate-500">暂无通过头程加入的采购单。</p>'}</section>
    <p class="text-xs text-slate-500">最近导入：${row.importedAt ? escapeHtml(row.importedAt.slice(0, 16).replace('T', ' ')) : '未导入'}${row.shipmentNo ? ` · 货件号 ${escapeHtml(row.shipmentNo)}` : ''}${row.remark ? ` · ${escapeHtml(row.remark)}` : ''}</p>
    <section class="rounded-lg border p-4 text-sm"><h3 class="text-sm font-semibold">请款信息</h3><p class="mt-2 text-slate-600">${row.paymentRequestNo ? `已生成请款单 ${escapeHtml(row.paymentRequestNo)}` : '尚未生成请款单，确认对账后可在列表勾选生成。'}</p><p class="mt-1 text-xs text-slate-500">确认人 ${escapeHtml(row.confirmedBy || '—')} · ${escapeHtml(row.confirmedAt || '—')}</p></section>
  </div></section></div>`
}

function renderImportOverlay(rows: ImportPreviewRow[]): string {
  const errorCount = rows.filter((item) => item.error).length
  const previewRows = rows.length
    ? rows.map((item) => `<tr class="border-b last:border-b-0 ${item.error ? 'bg-red-50' : ''}"><td class="px-3 py-2 text-sm">${escapeHtml(item.row.batchNo)}</td><td class="px-3 py-2 text-xs">${escapeHtml(item.row.carrierName || '—')}</td><td class="px-3 py-2 text-xs">${escapeHtml(item.row.trackingNos || '—')}</td><td class="px-3 py-2 text-xs">${escapeHtml(item.row.shipmentNo || '—')}</td>${PMS_LOGISTICS_FEE_ITEMS.map((fee) => `<td class="px-3 py-2 text-sm tabular-nums">${item.row.fees[fee.key] ?? '—'}</td>`).join('')}<td class="px-3 py-2 text-xs">${escapeHtml(item.row.remark || '—')}</td><td class="px-3 py-2 text-xs ${item.error ? 'text-red-700' : 'text-emerald-700'}">${escapeHtml(item.error || '校验通过')}</td></tr>`).join('')
    : `<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="${PMS_LOGISTICS_FEE_ITEMS.length + 6}">请选择费用文件，或先下载模板填写后上传</td></tr>`
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="导入实际费用" data-pms-lrec-import-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭导入"></button><section class="relative z-10 flex h-full w-[900px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">导入物流实际费用</h2><p class="mt-1 text-xs text-slate-500">支持 .xls / .xlsx / CSV；导入只覆盖实际层，不自动确认对账</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
      ${renderSecondaryButton('下载导入模板', { prefix: EVENT_PREFIX, action: 'download-template' }, 'download')}
      <label class="flex items-center gap-2 text-sm">选择文件<input type="file" accept=".xlsx,.xls,.csv,.txt" class="text-xs" data-${EVENT_PREFIX}-field="import-file" data-skip-page-rerender="true" /></label>
      <span class="text-xs text-slate-500">共解析 ${rows.length} 行${errorCount > 0 ? `，其中 ${errorCount} 行存在错误` : ''}</span>
    </div>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 1180px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">头程单号</th><th class="px-3 py-2">物流商</th><th class="px-3 py-2">运单号</th><th class="px-3 py-2">货件号</th>${PMS_LOGISTICS_FEE_ITEMS.map((fee) => `<th class="px-3 py-2">${fee.label}</th>`).join('')}<th class="px-3 py-2">备注</th><th class="px-3 py-2">校验</th></tr></thead><tbody>${previewRows}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认导入', { prefix: EVENT_PREFIX, action: 'submit-import' }, 'check-check').replace('<button', `<button ${rows.length > 0 && errorCount === 0 ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-lrec-column-overlays>${controller.renderColumnSettings()}</div>`
  const imagePreview = renderPmsImagePreview()
  if (!state.overlay) return `${columnSettings}${imagePreview}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.id)}${imagePreview}`
  return `${columnSettings}${renderImportOverlay(state.overlay.rows)}${imagePreview}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '物流费用对账',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条${state.selectedIds.length ? ` · 已选 ${state.selectedIds.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">物流费用由 7 项构成；实际费用可从模板导入，导入不自动确认</span><span class="text-xs text-muted-foreground" data-pms-lrec-selection-count>已选 ${state.selectedIds.length} 条</span>${renderPrimaryButton('生成请款单', { prefix: EVENT_PREFIX, action: 'generate-payment' }, 'wallet').replace('<button', `<button ${state.selectedIds.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-lrec-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-lrec-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-lrec-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-lrec-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function syncSelectionButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="generate-payment"]`).forEach((button) => {
    button.disabled = state.selectedIds.length === 0
  })
  const count = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selection-count]`)
  if (count) count.textContent = `已选 ${state.selectedIds.length} 条`
  const title = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (title) title.textContent = `共 ${filteredRows().length} 条${state.selectedIds.length ? ` · 已选 ${state.selectedIds.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function downloadTemplate(): void {
  downloadPmsFile(
    '物流实际费用导入模板.xls',
    buildPmsHtmlTemplateFile('物流实际费用导入模板', PMS_LOGISTICS_IMPORT_HEADERS, [
      ['FL-2026-0001', '深圳市迅达国际物流有限公司', 'SFTEST-LR-001', 'HB-0001', 4950, 0, 0, 0, 300, 180, 0, '海运附加费已含'],
      ['FL-2026-0002', '广州市洋帆国际货运代理有限公司', 'SFTEST-LR-002', 'HB-0002', 27200, 600, 0, 0, 820, 0, 400, '整柜费用'],
    ]),
    'application/vnd.ms-excel',
  )
}

function mapImportRows(rawRows: string[][]): ImportPreviewRow[] {
  const start = rawRows.length > 0 && /头程单号/.test(rawRows[0][0] ?? '') ? 1 : 0
  const seen = new Set<string>()
  return rawRows
    .slice(start)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      const row: PmsLogisticsActualImportRow = {
        batchNo: (cells[0] ?? '').trim(),
        carrierName: (cells[1] ?? '').trim(),
        trackingNos: (cells[2] ?? '').trim(),
        shipmentNo: (cells[3] ?? '').trim(),
        fees: {},
        remark: (cells[11] ?? '').trim(),
      }
      PMS_LOGISTICS_FEE_ITEMS.forEach((fee, index) => {
        const raw = (cells[index + 4] ?? '').trim()
        if (raw !== '') (row.fees as Record<PmsLogisticsFeeKey, number>)[fee.key] = Number(raw)
      })
      const error = validatePmsLogisticsActualImportRow(row, seen)
      if (!error) seen.add(row.batchNo)
      return { row, error }
    })
}

function handleImportFile(file: File): void {
  parsePmsExcelRows(file)
    .then((rows) => {
      state.overlay = { kind: 'import', rows: mapImportRows(rows) }
      state.overlayError = ''
      refreshOverlays()
    })
    .catch((error: unknown) => {
      state.overlayError = error instanceof Error ? error.message : '解析文件失败，请使用导入模板'
      refreshOverlays()
    })
}

function saveFees(id: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-lrec-detail-root]')
  if (!surface) return
  try {
    PMS_LOGISTICS_FEE_ITEMS.forEach((fee) => {
      updatePmsLogisticsReconciliationFee(id, fee.key, { actual: readNumberField(surface, `[data-${EVENT_PREFIX}-fee-key="${fee.key}"]`) }, FINANCE)
    })
    const row = getPmsLogisticsReconciliation(id)
    state.feedback = `${id} 实际费用已保存：合计 ${row?.actualTotal}，差异 ${row?.difference}（需重新确认差异）。`
    state.feedbackOk = true
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存实际费用失败'
    refreshOverlays()
  }
}

export function renderPmsLogisticsReconciliationsPage(): string {
  state.armedConfirm = ''
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-lrec-root data-skip-page-rerender="true"><style>[data-pms-lrec-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsLogisticsReconciliationOverlays(): boolean {
  if (state.overlay) {
    state.overlay = null
    state.overlayError = ''
    state.armedConfirm = ''
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

export function handlePmsLogisticsReconciliationsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closePmsLogisticsReconciliationOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsLrecField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as LogisticsReconPageState['status']
      return true
    }
    if (fieldName === 'carrierFilter') {
      state.carrierFilter = field.value
      return true
    }
    if (fieldName === 'transportFilter') {
      state.transportFilter = field.value
      return true
    }
    if (fieldName === 'select-row') {
      const id = field.dataset.reconId || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedIds = [...new Set([...state.selectedIds, id])]
      } else {
        state.selectedIds = state.selectedIds.filter((item) => item !== id)
      }
      controller.refresh({ overlays: false })
      syncSelectionButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') state.selectedIds = []
      else if (scope === 'page') {
        const pageIds = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="select-row"]`) ?? [])]
          .filter((input) => !input.disabled)
          .map((input) => input.dataset.reconId || '')
          .filter(Boolean)
        state.selectedIds = [...new Set([...state.selectedIds, ...pageIds])]
      } else {
        state.selectedIds = filteredRows().filter((row) => row.status === '已确认' && !row.paymentRequestNo).map((row) => row.id)
      }
      if (field instanceof HTMLSelectElement) field.value = ''
      controller.refresh({ overlays: false })
      syncSelectionButtons()
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
  const action = actionNode?.dataset.pmsLrecAction
  if (!action) return false
  if (state.armedConfirm && !ARMED_CONFIRM_ACTIONS.has(action)) {
    state.armedConfirm = ''
  }
  if (action === 'toggle-page') {
    const checked = (actionNode as HTMLInputElement).checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const id = box.dataset.reconId || ''
      if (!id || box.disabled) return
      if (checked) {
        if (!state.selectedIds.includes(id)) state.selectedIds = [...state.selectedIds, id]
      } else {
        state.selectedIds = state.selectedIds.filter((item) => item !== id)
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
    state.carrierFilter = ''
    state.transportFilter = ''
    state.selectedIds = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    const rows = filteredRows()
    if (rows.length === 0) {
      state.feedback = '当前查询条件下没有可导出的物流对账记录。'
      state.feedbackOk = false
      refreshAll()
      return true
    }
    downloadPmsCsv(
      '物流费用对账.csv',
      ['对账记录', '头程单', '物流商', '渠道', '币种', '预计合计', '实际合计', '供应商账单', '差异', '差异确认', '状态', '请款单', '导入时间'],
      rows.map((row) => [row.id, row.batchNo, row.carrierName, row.channelName, row.currency, row.estimatedTotal, row.actualTotal, row.supplierBillAmount, row.difference, row.differenceConfirmed ? '已确认' : '待确认', row.status, row.paymentRequestNo, row.importedAt]),
    )
    state.feedback = `已导出 ${rows.length} 条物流对账记录（当前查询条件全量）。`
    state.feedbackOk = true
    refreshAll()
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-lrec-column-key]')?.dataset.pmsLrecColumnKey || ''
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
    state.overlay = { kind: 'detail', id: actionNode?.dataset.reconId || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-first-leg') {
    const batchNo = actionNode?.dataset.batchNo || ''
    if (batchNo) setPmsFirstLegTargetBatchNo(batchNo)
    appStore.navigate('/pms/first-leg-shipments')
    return true
  }
  if (action === 'open-import') {
    state.overlay = { kind: 'import', rows: [] }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'download-template') {
    downloadTemplate()
    return true
  }
  if (action === 'save-fees') {
    saveFees(actionNode?.dataset.reconId || '')
    return true
  }
  if (action === 'save-bill') {
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-lrec-detail-root]')
    if (!surface) return true
    try {
      const row = updatePmsLogisticsReconciliationBill(actionNode?.dataset.reconId || '', readNumberField(surface, `[data-${EVENT_PREFIX}-bill-amount]`), FINANCE)
      state.feedback = `${row.id} 供应商账单已更新：账单 ${row.supplierBillAmount}，差异 ${row.difference}（需重新确认差异）。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '保存供应商账单失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'confirm-fee') {
    try {
      confirmPmsLogisticsReconciliationFeeItem(actionNode?.dataset.reconId || '', (actionNode?.dataset.feeKey || '') as PmsLogisticsFeeKey, FINANCE)
      state.feedback = `${actionNode?.dataset.reconId} 费用项已确认。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '确认费用项失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'confirm-all-fees') {
    const reconId = actionNode?.dataset.reconId || ''
    if (state.armedConfirm !== armedKey(action, reconId)) {
      state.armedConfirm = armedKey(action, reconId)
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    state.armedConfirm = ''
    try {
      const row = confirmAllPmsLogisticsReconciliationFees(reconId, FINANCE)
      state.feedback = `${row.id} 7 项费用已全部确认。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '确认全部费用失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'confirm-difference') {
    const reconId = actionNode?.dataset.reconId || ''
    if (state.armedConfirm !== armedKey(action, reconId)) {
      state.armedConfirm = armedKey(action, reconId)
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    state.armedConfirm = ''
    try {
      confirmPmsLogisticsReconciliationDifference(reconId, FINANCE)
      state.feedback = `${reconId} 差异已确认，可执行确认对账。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '确认差异失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'confirm-recon') {
    const reconId = actionNode?.dataset.reconId || ''
    if (state.armedConfirm !== armedKey(action, reconId)) {
      state.armedConfirm = armedKey(action, reconId)
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    state.armedConfirm = ''
    try {
      const row = confirmPmsLogisticsReconciliation(reconId, FINANCE)
      state.feedback = `${row.id} 对账已确认，可勾选生成物流请款单。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '确认对账失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'submit-import') {
    if (state.overlay?.kind !== 'import') return true
    try {
      const imported = importPmsLogisticsActualFees(state.overlay.rows.map((item) => item.row), FINANCE)
      state.feedback = `已导入 ${imported} 条物流实际费用；导入仅覆盖实际层，对账仍需人工确认。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '导入实际费用失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'generate-payment') {
    try {
      const draft = setPmsLogisticsPaymentDraft([...state.selectedIds])
      state.selectedIds = []
      state.feedback = `已生成物流请款草稿（${draft.objectName} · ${draft.totalAmount}），正在跳转到请款页确认。`
      state.feedbackOk = true
      refreshAll()
      appStore.navigate('/pms/logistics-payment-requests')
    } catch (error) {
      state.feedback = error instanceof PmsDomainError ? error.message : '生成请款草稿失败'
      state.feedbackOk = false
      refreshAll()
    }
    return true
  }
  if (action === 'close-overlay') {
    closePmsLogisticsReconciliationOverlays()
    return true
  }
  return false
}
