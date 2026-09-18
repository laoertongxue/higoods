// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  PMS_MATERIAL_BILL_IMPORT_HEADERS,
  PMS_MATERIAL_FEE_ITEMS,
  batchConfirmPmsMaterialReconciliationFees,
  confirmAllPmsMaterialReconciliationFees,
  confirmPmsMaterialReconciliation,
  confirmPmsMaterialReconciliationDifference,
  confirmPmsMaterialReconciliationFees,
  getPmsMaterialReconciliation,
  importPmsMaterialSupplierBills,
  listPmsMaterialReconciliations,
  pmsMaterialEffectiveLogisticsFee,
  pmsMaterialEffectivePurchaseAmount,
  updatePmsMaterialReconciliation,
  validatePmsMaterialBillImportRow,
  type PmsMaterialBillImportRow,
  type PmsMaterialFeeKey,
  type PmsMaterialReconciliation,
} from '../../data/pms/reconciliations.ts'
import { getPmsMaterial } from '../../data/pms/materials.ts'
import { setPmsMaterialPaymentDraft } from '../../data/pms/payment-requests.ts'
import { PmsDomainError } from '../../data/pms/runtime.ts'
import { appStore } from '../../state/store.ts'
import { buildPmsHtmlTemplateFile, downloadPmsCsv, downloadPmsFile } from '../../utils/pms-export.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

interface ImportPreviewRow {
  row: PmsMaterialBillImportRow
  error: string
}

type MaterialReconOverlay = null | { kind: 'detail'; id: string } | { kind: 'import'; rows: ImportPreviewRow[] }

interface MaterialReconPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsMaterialReconciliation['status']
  selectedIds: string[]
  overlay: MaterialReconOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
  armedConfirm: string
}

const EVENT_PREFIX = 'pms-mrec'
const ROOT_SELECTOR = '[data-pms-mrec-root]'
const FINANCE = { id: 'USR-PMS-LIU', name: '刘财务', role: '财务' as const }
const ARMED_CONFIRM_ACTIONS = new Set(['confirm-all-fees', 'confirm-difference', 'confirm-recon', 'batch-confirm-all', 'batch-confirm-partial'])

const state: MaterialReconPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
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

function materialStatusTone(status: PmsMaterialReconciliation['status']): 'green' | 'yellow' | 'blue' {
  if (status === '已确认') return 'green'
  if (status === '部分确认') return 'blue'
  return 'yellow'
}

function isRowSelectable(row: PmsMaterialReconciliation): boolean {
  return row.status !== '已确认' || !row.paymentRequestNo
}

function filteredRows(): PmsMaterialReconciliation[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsMaterialReconciliations().filter((row) => {
    if (state.status && row.status !== state.status) return false
    if (!keyword) return true
    return [row.id, row.supplierName, row.materialName, row.materialCode, ...row.purchaseOrderNos].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsMaterialReconciliation>[] = [
  {
    key: 'select',
    title: '',
    width: 72,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.filter((row) => isRowSelectable(row)).map((row) => row.id), new Set(state.selectedIds), EVENT_PREFIX),
    render: (row) => `<input type="checkbox" aria-label="选择 ${escapeHtml(row.id)}" data-${EVENT_PREFIX}-field="select-row" data-recon-id="${escapeHtml(row.id)}" ${state.selectedIds.includes(row.id) ? 'checked' : ''} ${isRowSelectable(row) ? '' : 'disabled'} data-skip-page-rerender="true" />`,
  },
  {
    key: 'recon',
    title: '对账记录 / 状态',
    width: 230,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.id,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.id)}</div><div class="mt-1">${renderPmsStatusBadge(row.status, materialStatusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">${row.paymentRequestNo ? `请款单 ${escapeHtml(row.paymentRequestNo)}` : '未生成请款单'}</div>`,
  },
  {
    key: 'supplier',
    title: '供应商 / 物料',
    width: 260,
    required: true,
    freezeable: true,
    render: (row) => `<div class="font-medium">${escapeHtml(row.supplierName)}</div><div class="mt-1 flex items-center gap-2 text-xs text-slate-500">${renderMaterialThumb(row.materialCode, row.materialName, 'h-8 w-8')}<span>${escapeHtml(row.materialName)} · ${escapeHtml(row.materialCode)}</span></div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.purchaseOrderNos.join('、'))} · ${escapeHtml(row.currency)}</div>`,
  },
  {
    key: 'payable',
    title: '最终应付',
    width: 220,
    sortable: true,
    sortValue: (row) => row.finalPayable,
    render: (row) => `<div class="text-xs text-slate-500">预计 采购 ${formatPmsMoney(row.purchaseAmount)} + 物流 ${formatPmsMoney(row.domesticLogisticsFee)}</div><div class="text-xs text-slate-500">实际 采购 ${formatPmsMoney(pmsMaterialEffectivePurchaseAmount(row))}${row.actualUnitPrice !== null ? `（单价 ${formatPmsMoney(row.actualUnitPrice)}）` : ''} + 物流 ${formatPmsMoney(pmsMaterialEffectiveLogisticsFee(row))} + 调整 ${formatPmsMoney(row.adjustment)}</div><div class="mt-1 text-sm font-semibold tabular-nums">${formatPmsMoney(row.finalPayable, row.currency === 'USD' ? 'USD' : 'RMB')}</div>`,
  },
  {
    key: 'bill',
    title: '供应商账单 / 差异',
    width: 230,
    sortable: true,
    sortValue: (row) => row.difference,
    render: (row) => `<div class="text-sm tabular-nums">账单 ${formatPmsMoney(row.supplierBillAmount, row.currency === 'USD' ? 'USD' : 'RMB')}</div><div class="mt-1 text-sm tabular-nums ${row.difference === 0 ? 'text-emerald-700' : row.difference > 0 ? 'text-amber-700' : 'text-blue-700'}">差异 ${formatPmsMoney(row.difference)}${row.difference !== 0 && row.differenceConfirmed ? '（已确认）' : row.difference !== 0 ? '（待确认）' : ''}</div>`,
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
  preferenceKey: 'higood:list:/pms/material-reconciliations',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mrec-table-surface]',
  paginationSurfaceSelector: '[data-pms-mrec-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mrec-overlays]',
  defaultFrozenKeys: ['recon', 'supplier'],
  columnSettingsTitle: '面辅料采购对账列设置',
  emptyText: '当前条件下暂无对账记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '待确认', '部分确认', '已确认'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="对账记录 / 供应商 / 物料 / 采购单" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('导入供应商账单', { prefix: EVENT_PREFIX, action: 'open-import' }, 'upload')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const pending = rows.filter((row) => row.status === '待确认')
  const partial = rows.filter((row) => row.status === '部分确认')
  const confirmed = rows.filter((row) => row.status === '已确认' && !row.paymentRequestNo)
  return renderProcessOrderStats([
    { label: '对账记录', value: rows.length },
    { label: '待确认', value: pending.length },
    { label: '部分确认', value: partial.length },
    { label: '差异合计', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.difference, 0)) },
    { label: '可请款金额', value: formatPmsMoney(confirmed.reduce((sum, row) => sum + row.finalPayable, 0)) },
  ])
}

function renderDetailOverlay(id: string): string {
  const row = getPmsMaterialReconciliation(id)
  if (!row) return ''
  const editable = row.status !== '已确认'
  const allFeesConfirmed = row.feeConfirmations.length === PMS_MATERIAL_FEE_ITEMS.length
  const allFeesArmed = state.armedConfirm === armedKey('confirm-all-fees', id)
  const differenceArmed = state.armedConfirm === armedKey('confirm-difference', id)
  const reconArmed = state.armedConfirm === armedKey('confirm-recon', id)
  const differenceConfirmButton = editable && row.difference !== 0 && !row.differenceConfirmed
    ? `<button type="button" class="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800" data-${EVENT_PREFIX}-action="confirm-difference" data-recon-id="${escapeHtml(id)}" data-skip-page-rerender="true">${differenceArmed ? '再次点击确认差异' : '确认差异'} ${formatPmsMoney(row.difference)}</button>`
    : ''
  const confirmArmedHint = allFeesArmed || differenceArmed || reconArmed
    ? `<p class="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-pms-mrec-armed-hint>该操作会推进对账结算：请再次点击“再次点击确认…”按钮完成；点击其它操作或关闭覆盖层可取消。</p>`
    : ''
  const confirmDisabled = row.status === '已确认' || !allFeesConfirmed || (row.difference !== 0 && !row.differenceConfirmed)
  const money = (value: number) => formatPmsMoney(value, row.currency === 'USD' ? 'USD' : 'RMB')
  const effectivePurchase = pmsMaterialEffectivePurchaseAmount(row)
  const effectiveLogistics = pmsMaterialEffectiveLogisticsFee(row)
  const feeValue = (key: PmsMaterialFeeKey, layer: 'estimated' | 'actual'): number => {
    if (key === 'purchaseAmount') return layer === 'estimated' ? row.purchaseAmount : effectivePurchase
    if (key === 'domesticLogisticsFee') return layer === 'estimated' ? row.domesticLogisticsFee : effectiveLogistics
    if (key === 'supplierBillAmount') return row.supplierBillAmount
    return row.adjustment
  }
  const feeRows = PMS_MATERIAL_FEE_ITEMS.map((item) => {
    const confirmed = row.feeConfirmations.includes(item.key)
    const dualLayer = item.key === 'purchaseAmount' || item.key === 'domesticLogisticsFee'
    return `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${item.label}</td><td class="px-3 py-2 text-sm tabular-nums">${dualLayer ? money(feeValue(item.key, 'estimated')) : '—'}</td><td class="px-3 py-2 text-sm tabular-nums">${dualLayer ? money(feeValue(item.key, 'actual')) : money(feeValue(item.key, 'actual'))}</td><td class="px-3 py-2 text-sm">${confirmed ? '<span class="text-emerald-700">已确认</span>' : '<span class="text-amber-700">待确认</span>'}</td><td class="px-3 py-2 text-right">${editable && !confirmed ? `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="confirm-fee-item" data-recon-id="${escapeHtml(id)}" data-fee-key="${item.key}" data-skip-page-rerender="true">确认该项</button>` : ''}</td></tr>`
  }).join('')
  const feeTable = `<div class="mt-3 overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 560px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">费用项</th><th class="px-3 py-2">预计</th><th class="px-3 py-2">实际</th><th class="px-3 py-2">确认状态</th><th class="px-3 py-2 text-right">操作</th></tr></thead><tbody>${feeRows}</tbody></table></div>`
  const confirmAllButton = editable && !allFeesConfirmed
    ? `<div class="mt-3">${renderSecondaryButton(allFeesArmed ? '再次点击确认全部费用' : '确认全部费用', { prefix: EVENT_PREFIX, action: 'confirm-all-fees' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}"`)}</div>`
    : ''
  const actualInput = (name: string, label: string, value: number | null, step = '0.01') => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" step="${step}" value="${value === null ? '' : value}" placeholder="为空按预计层计算" data-${EVENT_PREFIX}-edit-field="${name}" data-skip-page-rerender="true" /></label>`
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="面辅料对账处理" data-pms-mrec-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭对账处理"></button><section class="relative z-10 flex h-full w-[720px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(row.id)} · ${escapeHtml(row.supplierName)}</h2><p class="mt-1 flex items-center gap-2 text-xs text-slate-500">${renderMaterialThumb(row.materialCode, row.materialName, 'h-8 w-8')}<span>${escapeHtml(row.materialName)} · ${escapeHtml(row.purchaseOrderNos.join('、'))} · ${renderPmsStatusBadge(row.status, materialStatusTone(row.status))}</span></p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">${renderPmsOverlayError(state.overlayError)}${confirmArmedHint}
    <section class="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm"><div><dt class="text-xs text-muted-foreground">预计采购货款</dt><dd class="mt-1 tabular-nums">${money(row.purchaseAmount)}</dd></div><div><dt class="text-xs text-muted-foreground">实际采购货款</dt><dd class="mt-1 tabular-nums">${money(effectivePurchase)}</dd></div><div><dt class="text-xs text-muted-foreground">采购数量 × 预计单价</dt><dd class="mt-1 tabular-nums">${row.orderedQty} × ${money(row.estimatedUnitPrice)}</dd></div><div><dt class="text-xs text-muted-foreground">预计国内物流费</dt><dd class="mt-1 tabular-nums">${money(row.domesticLogisticsFee)}</dd></div><div><dt class="text-xs text-muted-foreground">实际国内物流费</dt><dd class="mt-1 tabular-nums">${money(effectiveLogistics)}</dd></div><div><dt class="text-xs text-muted-foreground">调整金额</dt><dd class="mt-1 tabular-nums">${money(row.adjustment)}</dd></div><div><dt class="text-xs text-muted-foreground">最终应付</dt><dd class="mt-1 font-semibold tabular-nums">${money(row.finalPayable)}</dd></div><div><dt class="text-xs text-muted-foreground">供应商账单</dt><dd class="mt-1 tabular-nums">${money(row.supplierBillAmount)}</dd></div><div><dt class="text-xs text-muted-foreground">差异</dt><dd class="mt-1 tabular-nums ${row.difference === 0 ? 'text-emerald-700' : 'text-amber-700'}">${money(row.difference)}</dd></div></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">费用项确认</h3><p class="mt-1 text-xs text-slate-500">全部费用项确认后才能确认对账；任一项修改后该确认自动失效。</p>${feeTable}${confirmAllButton}</section>
    ${editable ? `<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">实际层与账单编辑</h3><div class="mt-3 grid grid-cols-2 gap-3">
      ${actualInput('actualUnitPrice', '实际单价', row.actualUnitPrice)}
      ${actualInput('actualPurchaseAmount', '实际采购货款', row.actualPurchaseAmount)}
      ${actualInput('actualDomesticLogisticsFee', '实际国内物流费', row.actualDomesticLogisticsFee)}
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">调整金额<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" step="0.01" value="${row.adjustment}" data-${EVENT_PREFIX}-edit-field="adjustment" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">供应商账单金额<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${row.supplierBillAmount}" data-${EVENT_PREFIX}-edit-field="supplierBillAmount" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">发票号<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.invoiceNo)}" data-${EVENT_PREFIX}-edit-field="invoiceNo" data-skip-page-rerender="true" /></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.remark)}" data-${EVENT_PREFIX}-edit-field="remark" data-skip-page-rerender="true" /></label>
    </div><div class="mt-3">${renderSecondaryButton('保存费用调整', { prefix: EVENT_PREFIX, action: 'save-fees' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}"`)}</div></section>` : '<p class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">对账已确认，费用字段锁定。</p>'}
    ${editable ? `<section class="flex flex-wrap items-center gap-2 rounded-lg border p-4">${differenceConfirmButton}${renderPrimaryButton(reconArmed ? '再次点击确认对账' : '确认对账', { prefix: EVENT_PREFIX, action: 'confirm-recon' }, 'check-check').replace('<button', `<button data-recon-id="${escapeHtml(id)}" ${confirmDisabled ? 'disabled' : ''}`)}<span class="text-xs text-slate-500">需先确认全部费用项；差异不为 0 时还必须确认差异。当前已确认 ${row.feeConfirmations.length}/${PMS_MATERIAL_FEE_ITEMS.length} 项。</span></section>` : ''}
    <section class="rounded-lg border p-4 text-sm"><h3 class="text-sm font-semibold">请款信息</h3><p class="mt-2 text-slate-600">${row.paymentRequestNo ? `已生成请款单 ${escapeHtml(row.paymentRequestNo)}` : '尚未生成请款单，确认对账后可在列表勾选生成。'}</p><p class="mt-1 text-xs text-slate-500">确认人 ${escapeHtml(row.confirmedBy || '—')} · ${escapeHtml(row.confirmedAt || '—')}</p></section>
  </div></section></div>`
}

function renderImportOverlay(rows: ImportPreviewRow[]): string {
  const errorCount = rows.filter((item) => item.error).length
  const amount = (value: number | undefined) => value === undefined ? '—' : formatPmsMoney(value)
  const previewRows = rows.length
    ? rows.map((item) => `<tr class="border-b last:border-b-0 ${item.error ? 'bg-red-50' : ''}"><td class="px-3 py-2 text-sm">${escapeHtml(item.row.purchaseOrderNo)}<div class="text-xs text-slate-500">${escapeHtml(item.row.materialCode)}</div></td><td class="px-3 py-2 text-sm tabular-nums">${amount(item.row.actualUnitPrice)} / ${amount(item.row.actualPurchaseAmount)}</td><td class="px-3 py-2 text-sm tabular-nums">${amount(item.row.actualDomesticLogisticsFee)} / ${amount(item.row.supplierBillAmount)}</td><td class="px-3 py-2 text-xs ${item.error ? 'text-red-700' : 'text-emerald-700'}">${escapeHtml(item.error || '校验通过')}</td></tr>`).join('')
    : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="4">请选择账单文件，或先下载模板填写后上传</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="导入供应商账单" data-pms-mrec-import-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭导入"></button><section class="relative z-10 flex h-full w-[640px] max-w-[94vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">导入供应商账单</h2><p class="mt-1 text-xs text-slate-500">支持 .xls / .xlsx / CSV；按采购单号 + 物料编码匹配，覆盖实际层费用，不自动确认对账</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
      ${renderSecondaryButton('下载导入模板', { prefix: EVENT_PREFIX, action: 'download-template' }, 'download')}
      <label class="flex items-center gap-2 text-sm">选择文件<input type="file" accept=".xlsx,.xls,.csv,.txt" class="text-xs" data-${EVENT_PREFIX}-field="import-file" data-skip-page-rerender="true" /></label>
      <span class="text-xs text-slate-500">共解析 ${rows.length} 行${errorCount > 0 ? `，其中 ${errorCount} 行存在错误` : ''}</span>
    </div>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">采购单 / 物料</th><th class="px-3 py-2">实际单价 / 采购货款</th><th class="px-3 py-2">实际物流费 / 账单</th><th class="px-3 py-2">校验</th></tr></thead><tbody>${previewRows}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认导入', { prefix: EVENT_PREFIX, action: 'submit-import' }, 'check-check').replace('<button', `<button ${rows.length > 0 && errorCount === 0 ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-mrec-column-overlays>${controller.renderColumnSettings()}</div>`
  const imagePreview = renderPmsImagePreview()
  if (!state.overlay) return `${columnSettings}${imagePreview}`
  if (state.overlay.kind === 'import') return `${columnSettings}${renderImportOverlay(state.overlay.rows)}${imagePreview}`
  return `${columnSettings}${renderDetailOverlay(state.overlay.id)}${imagePreview}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '面辅料采购对账',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条${state.selectedIds.length ? ` · 已选 ${state.selectedIds.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">已选 <span data-pms-mrec-selection-count>${state.selectedIds.length}</span> 条 · 仅“已确认且未生成请款”可请款</span>${renderSecondaryButton(state.armedConfirm === armedKey('batch-confirm-all', '') ? '再次点击批量确认费用' : '批量确认费用', { prefix: EVENT_PREFIX, action: 'batch-confirm-all' }, 'list-checks').replace('<button', `<button ${state.selectedIds.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton(state.armedConfirm === armedKey('batch-confirm-partial', '') ? '再次点击批量部分确认' : '批量部分确认', { prefix: EVENT_PREFIX, action: 'batch-confirm-partial' }, 'check-check').replace('<button', `<button ${state.selectedIds.length === 0 ? 'disabled' : ''}`)}${renderPrimaryButton('生成请款单', { prefix: EVENT_PREFIX, action: 'generate-payment' }, 'wallet').replace('<button', `<button ${state.selectedIds.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-mrec-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mrec-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mrec-overlays>${renderOverlays()}</div>`,
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

function mapImportRows(rawRows: string[][]): ImportPreviewRow[] {
  const start = rawRows.length > 0 && /采购单号/.test(rawRows[0][0] ?? '') ? 1 : 0
  const seen = new Set<string>()
  const optionalNumber = (cell: string | undefined): number | undefined => {
    const text = (cell ?? '').trim()
    if (!text) return undefined
    return Number.parseFloat(text)
  }
  return rawRows
    .slice(start)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      const row: PmsMaterialBillImportRow = {
        purchaseOrderNo: (cells[0] ?? '').trim(),
        materialCode: (cells[1] ?? '').trim(),
        actualUnitPrice: optionalNumber(cells[2]),
        actualPurchaseAmount: optionalNumber(cells[3]),
        actualDomesticLogisticsFee: optionalNumber(cells[4]),
        supplierBillAmount: optionalNumber(cells[5]),
        adjustment: optionalNumber(cells[6]),
        remark: (cells[7] ?? '').trim(),
        reconciliationId: (cells[8] ?? '').trim(),
      }
      const error = validatePmsMaterialBillImportRow(row, seen)
      if (!error) seen.add(`${row.purchaseOrderNo}::${row.materialCode}`)
      return { row, error }
    })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mrec-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function syncSelectionButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="batch-confirm-all"], [data-${EVENT_PREFIX}-action="batch-confirm-partial"], [data-${EVENT_PREFIX}-action="generate-payment"]`).forEach((button) => {
    button.disabled = state.selectedIds.length === 0
  })
  const count = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selection-count]`)
  if (count) count.textContent = `已选 ${state.selectedIds.length} 条`
}

function readOptionalAmount(surface: ParentNode, selector: string): number | null {
  const field = surface.querySelector<HTMLInputElement>(selector)
  if (!field || field.value.trim() === '') return null
  return Number(field.value)
}

function saveFees(id: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mrec-detail-root]')
  if (!surface) return
  try {
    updatePmsMaterialReconciliation(
      id,
      {
        actualUnitPrice: readOptionalAmount(surface, `[data-${EVENT_PREFIX}-edit-field="actualUnitPrice"]`),
        actualPurchaseAmount: readOptionalAmount(surface, `[data-${EVENT_PREFIX}-edit-field="actualPurchaseAmount"]`),
        actualDomesticLogisticsFee: readOptionalAmount(surface, `[data-${EVENT_PREFIX}-edit-field="actualDomesticLogisticsFee"]`),
        adjustment: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="adjustment"]`),
        supplierBillAmount: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="supplierBillAmount"]`),
        invoiceNo: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="invoiceNo"]`),
        remark: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="remark"]`),
      },
      FINANCE,
    )
    const row = getPmsMaterialReconciliation(id)
    state.feedback = `${id} 费用已更新：最终应付 ${row?.finalPayable}，差异 ${row?.difference}（需重新确认差异）。`
    state.feedbackOk = true
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存费用失败'
    refreshOverlays()
  }
}

export function renderPmsMaterialReconciliationsPage(): string {
  state.selectedIds = []
  state.armedConfirm = ''
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-mrec-root data-skip-page-rerender="true"><style>[data-pms-mrec-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsMaterialReconciliationOverlays(): boolean {
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

export function handlePmsMaterialReconciliationsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closePmsMaterialReconciliationOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMrecField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as MaterialReconPageState['status']
      return true
    }
    if (fieldName === 'select-row') {
      const id = field.dataset.reconId || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedIds = [...new Set([...state.selectedIds, id])]
      } else {
        state.selectedIds = state.selectedIds.filter((item) => item !== id)
      }
      state.armedConfirm = ''
      controller.refresh({ overlays: false })
      syncSelectionButtons()
      return true
    }
    if (fieldName === 'import-file') {
      if (field instanceof HTMLInputElement && field.files?.[0]) handleImportFile(field.files[0])
      return true
    }
    if (fieldName === 'select-all') {
      const rows = filteredRows()
      state.selectedIds = field instanceof HTMLInputElement && field.checked
        ? rows.filter((row) => isRowSelectable(row)).map((row) => row.id)
        : []
      state.armedConfirm = ''
      controller.refresh({ overlays: false })
      syncSelectionButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field instanceof HTMLSelectElement ? field.value : ''
      if (scope === 'clear') {
        state.selectedIds = []
      } else if (scope === 'page') {
        const pageIds = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="select-row"]`) ?? [])]
          .filter((input) => !input.disabled)
          .map((input) => input.dataset.reconId || '')
        state.selectedIds = pageIds.filter(Boolean)
      } else if (scope === 'all') {
        state.selectedIds = filteredRows().filter((row) => isRowSelectable(row)).map((row) => row.id)
      }
      state.armedConfirm = ''
      if (field instanceof HTMLSelectElement) field.value = ''
      controller.refresh({ overlays: false })
      syncSelectionButtons()
      return true
    }
    if (target.closest(`[data-${EVENT_PREFIX}-action="toggle-page"]`)) {
      const pageInputs = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="select-row"]`) ?? [])].filter((input) => !input.disabled)
      const allChecked = pageInputs.length > 0 && pageInputs.every((input) => input.checked)
      state.selectedIds = allChecked
        ? state.selectedIds.filter((id) => !pageInputs.some((input) => input.dataset.reconId === id))
        : [...new Set([...state.selectedIds, ...pageInputs.map((input) => input.dataset.reconId || '')])]
      state.armedConfirm = ''
      controller.refresh({ overlays: false })
      syncSelectionButtons()
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
  const action = actionNode?.dataset.pmsMrecAction
  if (!action) return false
  if (state.armedConfirm && !ARMED_CONFIRM_ACTIONS.has(action)) {
    state.armedConfirm = ''
  }
  if (action === 'open-import') {
    state.overlay = { kind: 'import', rows: [] }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'download-template') {
    downloadPmsFile(
      '供应商账单导入模板.xls',
      buildPmsHtmlTemplateFile('供应商账单导入模板', PMS_MATERIAL_BILL_IMPORT_HEADERS, [
        ['CGF-2026-0004', 'MAT-0004', 16.5, 24288, 460, 24480, -18, '实际单价较预计低', 'MR-2026-0004'],
        ['CGF-2026-0006', 'MAT-0006', '', 6400, 520, 6410, 0, '账单少量差异', 'MR-2026-0006'],
      ]),
      'application/vnd.ms-excel',
    )
    return true
  }
  if (action === 'submit-import') {
    if (state.overlay?.kind !== 'import') return true
    try {
      const imported = importPmsMaterialSupplierBills(state.overlay.rows.map((item) => item.row), FINANCE)
      state.feedback = `已导入 ${imported} 条供应商账单；导入只覆盖账单金额，对账仍需人工确认差异。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '导入供应商账单失败'
      refreshOverlays()
    }
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
    state.selectedIds = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    const rows = filteredRows()
    if (rows.length === 0) {
      state.feedback = '当前查询条件下没有可导出的对账记录。'
      state.feedbackOk = false
      refreshAll()
      return true
    }
    downloadPmsCsv(
      '面辅料采购对账.csv',
      ['对账记录', '供应商', '物料', '采购单', '币种', '预计采购货款', '实际采购货款', '预计国内物流费', '实际国内物流费', '调整金额', '最终应付', '供应商账单', '差异', '差异确认', '已确认费用项', '状态', '请款单', '备注'],
      rows.map((row) => [row.id, row.supplierName, row.materialName, row.purchaseOrderNos.join('、'), row.currency, row.purchaseAmount, pmsMaterialEffectivePurchaseAmount(row), row.domesticLogisticsFee, pmsMaterialEffectiveLogisticsFee(row), row.adjustment, row.finalPayable, row.supplierBillAmount, row.difference, row.differenceConfirmed ? '已确认' : '待确认', row.feeConfirmations.length, row.status, row.paymentRequestNo, row.remark]),
    )
    state.feedback = `已导出 ${rows.length} 条对账记录（当前查询条件全量）。`
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-mrec-column-key]')?.dataset.pmsMrecColumnKey || ''
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
  if (action === 'save-fees') {
    saveFees(actionNode?.dataset.reconId || '')
    return true
  }
  if (action === 'confirm-fee-item') {
    const key = actionNode?.dataset.feeKey as PmsMaterialFeeKey
    try {
      confirmPmsMaterialReconciliationFees(actionNode?.dataset.reconId || '', [key], FINANCE)
      state.feedback = `已确认费用项，当前对账状态已更新。`
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
      confirmAllPmsMaterialReconciliationFees(reconId, FINANCE)
      state.feedback = '已确认全部费用项，如存在差异请继续确认差异。'
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '确认全部费用失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'batch-confirm-all' || action === 'batch-confirm-partial') {
    const armed = armedKey(action, '')
    if (state.armedConfirm !== armed) {
      state.armedConfirm = armed
      state.feedback = '请再次点击确认批量操作。'
      state.feedbackOk = false
      refreshAll()
      return true
    }
    state.armedConfirm = ''
    const keys: PmsMaterialFeeKey[] = action === 'batch-confirm-all'
      ? PMS_MATERIAL_FEE_ITEMS.map((item) => item.key)
      : ['purchaseAmount', 'domesticLogisticsFee']
    const label = action === 'batch-confirm-all' ? '确认全部费用' : '部分确认（采购货款与国内物流费）'
    try {
      const outcome = batchConfirmPmsMaterialReconciliationFees([...state.selectedIds], keys, FINANCE)
      const skippedText = outcome.skipped.length > 0 ? `；跳过 ${outcome.skipped.length} 条：${outcome.skipped.map((item) => `${item.id}（${item.reason}）`).join('、')}` : ''
      state.feedback = `已批量${label} ${outcome.updated.length} 条对账记录${skippedText}。`
      state.feedbackOk = true
      state.selectedIds = []
    } catch (error) {
      state.feedback = error instanceof PmsDomainError ? error.message : '批量确认费用失败'
      state.feedbackOk = false
    }
    refreshAll()
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
      confirmPmsMaterialReconciliationDifference(reconId, FINANCE)
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
      const row = confirmPmsMaterialReconciliation(reconId, FINANCE)
      state.feedback = `${row.id} 对账已确认，可勾选生成请款单。`
      state.feedbackOk = true
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '确认对账失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'generate-payment') {
    try {
      const draft = setPmsMaterialPaymentDraft([...state.selectedIds])
      state.selectedIds = []
      state.feedback = `已生成请款草稿（${draft.objectName} · ${draft.totalAmount}），正在跳转到请款页确认。`
      state.feedbackOk = true
      refreshAll()
      appStore.navigate('/pms/material-payment-requests')
    } catch (error) {
      state.feedback = error instanceof PmsDomainError ? error.message : '生成请款草稿失败'
      state.feedbackOk = false
      refreshAll()
    }
    return true
  }
  if (action === 'close-overlay') {
    closePmsMaterialReconciliationOverlays()
    return true
  }
  return false
}
