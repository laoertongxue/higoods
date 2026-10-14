import {pmsBusinessNumber} from '../../utils/pms-business-number.ts'
import {getPmsProductPurchaseOrder,hydratePmsProductPurchaseOrdersFromIdb} from '../../data/pms/product-purchase-orders.ts'
import {getPmsMaterialPurchaseOrder,hydratePmsMaterialPurchaseOrdersFromIdb} from '../../data/pms/material-purchase-orders.ts'
import { renderCode128Barcode } from '../../components/real-barcode.ts'
import { listPurchaseGoodsReferences } from '../../data/pms/canonical-purchase-references.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
// @page-pattern: list
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  savePmsFirstLegBox, movePmsFirstLegBox, sealOrDeletePmsFirstLegBox, movePmsFirstLegBoxItem, updatePmsFirstLegManifest, type PmsFirstLegBox,
  advancePmsFirstLegBatchStatus,
  batchLoadPmsFirstLegBatches,
  batchShipPmsFirstLegBatches,
  consumePmsFirstLegTargetBatchNo,
  createPmsFirstLegBatch,
  hydratePmsFirstLegFromIdb,
  getPmsFirstLegBatch,
  listPmsFirstLegBatches,
  listPmsFirstLegCarriers,
  listPmsFirstLegChannels,
  listPmsJoinableLogisticsRows,
  pmsAllowedBatchNextStatuses,
  pmsFirstLegBatchAggregate,
  pmsFirstLegFeeSubtotal,
  PMS_FIRST_LEG_FEE_FIELDS,
  updatePmsFirstLegBatch,
  type PmsFirstLegBatch,
  type PmsFirstLegBatchStatus,
  type PmsFirstLegCargoType,
  type PmsFirstLegFeeBreakdown,
  type PmsFirstLegInboundStatus,
  type PmsFirstLegSourceRegion,
} from '../../data/pms/first-leg-logistics.ts'
import { getPurchaseMaterialReference } from '../../data/pms/canonical-purchase-references.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  formatPmsTime,
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

type BatchOverlay =
  | null
  | {kind:'box-import';batchNo:string;fileName:string;items:PmsFirstLegBox['items'];clientActionId:string}
  | { kind: 'box'; batchNo:string; boxNo:string; clientActionId:string }
  | { kind: 'manifest'; batchNo:string; mode:'keyword'|'delivery'|'dimensions'|'move'|'move-item'|'seal'|'delete'; boxNo:string; code?:string; clientActionId:string }
  | { kind: 'detail'; batchNo: string; clientActionId: string; note: string }
  | { kind: 'create'; clientActionId: string }
  | { kind: 'edit'; batchNo: string; clientActionId: string }

interface BatchPageState extends ProcessOrderListControllerState {
  boxKeyword:string
  boxChoicePage:number
  boxItemQuantities:Record<string,string>
  boxDraft:Record<string,string>
  keyword: string
  status: '' | PmsFirstLegBatchStatus
  carrierFilter: string
  targetBatchNo: string
  selectedBatchNos: string[]
  overlay: BatchOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-fls'
const ROOT_SELECTOR = '[data-pms-fls-root]'

const state: BatchPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 5 },
  preferencesLoaded: false,
  showColumnSettings: false,
  boxKeyword:'',boxChoicePage:1,boxItemQuantities:{},boxDraft:{},
  keyword: '',
  status: '',
  carrierFilter: '',
  targetBatchNo: '',
  selectedBatchNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsFirstLegBatch[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsFirstLegBatches().filter((batch) => {
    if (state.status && batch.status !== state.status) return false
    if (state.carrierFilter && batch.carrierId !== state.carrierFilter) return false
    if (!keyword) return true
    return [batch.batchNo, batch.batchName, batch.carrierName, batch.channelName, ...batch.records.map((record) => record.trackingNo)].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsFirstLegBatchStatus): 'blue' | 'green' | 'yellow' | 'slate' {
  if (status === '待起运') return 'yellow'
  if (status === '已装柜' || status === '头程中') return 'blue'
  if (status === '已到仓') return 'green'
  return 'slate'
}

function formatFeeAmount(value: number, currency: 'RMB' | 'USD' | 'IDR'): string {
  return formatPmsMoney(value, currency)
}

function syncBatchButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="batch-load"], [data-${EVENT_PREFIX}-action="batch-ship"]`).forEach((button) => {
    button.disabled = state.selectedBatchNos.length === 0
  })
  const title = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (title) title.textContent = `共 ${filteredRows().length} 条${state.selectedBatchNos.length ? ` · 已选 ${state.selectedBatchNos.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function isBatchSelectable(batch: PmsFirstLegBatch): boolean {
  return batch.status === '待起运' || batch.status === '已装柜'
}

function batchUnitTotals(batch:PmsFirstLegBatch):string{return [...new Set(batch.records.map(record=>record.unit))].map(unit=>formatPmsQty(batch.records.filter(record=>record.unit===unit).reduce((sum,record)=>sum+record.qty,0),unit)).join(' · ')}
const columns: StandardListColumn<PmsFirstLegBatch>[] = [
  {
    key: 'select',
    title: '',
    width: 72,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.filter((row) => isBatchSelectable(row)).map((row) => row.batchNo), new Set(state.selectedBatchNos), EVENT_PREFIX),
    render: (row) => {
      const disabled = !isBatchSelectable(row)
      return `<input type="checkbox" aria-label="选择 ${escapeHtml(row.batchNo)}" data-${EVENT_PREFIX}-field="select-row" data-batch-no="${escapeHtml(row.batchNo)}" ${state.selectedBatchNos.includes(row.batchNo) ? 'checked' : ''} ${disabled ? 'disabled' : ''} data-skip-page-rerender="true" />`
    },
  },
  {
    key: 'batch',
    title: '头程单 / 状态',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.batchNo,
    render: (row) => `<div class="font-semibold ${state.targetBatchNo === row.batchNo ? 'text-blue-700' : ''}">${escapeHtml(row.batchNo)}${state.targetBatchNo === row.batchNo ? ' · 已定位' : ''}</div><div class="mt-1">${renderPmsStatusBadge(row.status, statusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.creator)} · ${formatPmsTime(row.createdAt)}</div>`,
  },
  {
    key: 'carrier',
    title: '物流商 / 渠道',
    width: 240,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.carrierName,
    render: (row) => `<div class="font-medium">${escapeHtml(row.carrierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.channelName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.transportMethod)} · ${row.estimatedTransitDays}天 · ${escapeHtml(row.billingMethod)} · ${escapeHtml(row.taxMethod)}</div>`,
  },
  {
    key: 'route',
    title: '转运 / 目的仓',
    width: 190,
    render: (row) => `<div class="text-sm">${escapeHtml(row.transferCenter)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.destinationWarehouse)}</div><div class="mt-1 text-xs text-slate-500">计划起运 ${escapeHtml(row.plannedShipDate || '待定')}</div>`,
  },
  {
    key: 'entry',
    title: '提货与入库',
    width: 230,
    render: (row) => `<div class="text-sm">${escapeHtml(row.billOfLadingNo || '未填提单号')}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.shippingLineName || '未填船司')} · ${escapeHtml(row.cargoType)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.warehouse || '未填仓库')}${row.area ? ` · ${escapeHtml(row.area)}` : ''} · 预计送达 ${escapeHtml(row.estimatedArrivalAt || '待定')}</div>`,
  },
  {
    key: 'summary',
    title: '数量 / 费用',
    width: 190,
    sortable: true,
    sortValue: (row) => row.records.reduce((sum, record) => sum + record.qty, 0),
    render: (row) => `<div class="text-sm tabular-nums">${row.records.length} 条物流 · ${batchUnitTotals(row)}</div><div class="mt-1 text-sm tabular-nums">${formatPmsMoney(row.fee, row.feeCurrency === 'USD' ? 'USD' : 'RMB')}</div><div class="mt-1 text-xs text-slate-500">卷数 ${row.records.reduce((sum, record) => sum + record.rolls, 0)}</div>`,
  },
  {
    key: 'aggregate',
    title: '聚合（箱 / 重量 / 体积 / 转运）',
    width: 220,
    sortable: true,
    sortValue: (row) => pmsFirstLegBatchAggregate(row).boxCount ?? 0,
    render: (row) => {
      const aggregate = pmsFirstLegBatchAggregate(row)
      const boxText = aggregate.boxCount === null ? '—' : String(aggregate.boxCount)
      const weightText = aggregate.totalWeightKg === null ? '—' : `${formatPmsQty(aggregate.totalWeightKg)} kg`
      const volumeText = aggregate.totalVolumeM3 === null ? '—' : `${formatPmsQty(aggregate.totalVolumeM3)} m³`
      const transitText = aggregate.transitDays === null ? '—' : `${aggregate.transitDays} 天`
      return `<div class="text-sm tabular-nums">总箱 ${boxText} · 重量 ${weightText}</div><div class="mt-1 text-sm tabular-nums">体积 ${volumeText}</div><div class="mt-1 text-xs text-slate-500">转运天数 ${transitText}</div>`
    },
  },
  {
    key: 'timeline',
    title: '节点',
    width: 220,
    render: (row) => `<div class="space-y-1 text-xs"><div>${row.containerLoadedAt ? `✅ 装柜 ${formatPmsTime(row.containerLoadedAt)}` : '○ 未装柜'}</div><div>${row.actualShipDate ? `✅ 出运 ${formatPmsTime(row.actualShipDate)}` : '○ 未出运'}</div><div>${row.arrivedAt ? `✅ 到仓 ${formatPmsTime(row.arrivedAt)}` : '○ 未到仓'}</div><div>${row.completedAt ? `✅ 完成 ${formatPmsTime(row.completedAt)}` : '○ 未完成'}</div></div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    actionColumn: true,
    render: (row) => `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-batch-no="${escapeHtml(row.batchNo)}" data-skip-page-rerender="true">详情与推进</button>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/first-leg-shipments',
  pageSizeOptions: [5, 10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-fls-table-surface]',
  paginationSurfaceSelector: '[data-pms-fls-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-fls-overlays]',
  defaultFrozenKeys: ['batch', 'carrier'],
  columnSettingsTitle: '头程物流列设置',
  emptyText: '当前条件下暂无头程物流单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function readTargetBatchFromRuntime(): void {
  const target = consumePmsFirstLegTargetBatchNo()
  if (target) {
    state.targetBatchNo = target
    state.keyword = target
  }
}

function renderFilters(): string {
  const statuses: Array<'' | PmsFirstLegBatchStatus> = ['', '待起运', '已装柜', '头程中', '已到仓', '已完成']
  const statusOptions = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const carrierOptions = [`<option value="">全部物流商</option>`, ...listPmsFirstLegCarriers().map((carrier) => `<option value="${escapeHtml(carrier.carrierCode)}" ${state.carrierFilter === carrier.carrierCode ? 'selected' : ''}>${escapeHtml(carrier.shortName)}</option>`)].join('')
  const advancedCount = state.carrierFilter ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="头程单号 / 物流商 / 渠道 / 物流单号" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">头程状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">物流商</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="carrierFilter" data-skip-page-rerender="true">${carrierOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '头程单总数', value: rows.length },
    { label: '在途（装柜/头程中）', value: rows.filter((row) => row.status === '已装柜' || row.status === '头程中').length },
    { label: '已到仓', value: rows.filter((row) => row.status === '已到仓').length },
    { label: '头程费用', value: formatPmsMoney(rows.reduce((sum, row) => sum + row.fee, 0)) },
  ])
}

function renderDetailOverlay(batchNo: string, note: string): string {
  const batch = getPmsFirstLegBatch(batchNo)
  if (!batch) return ''
  const aggregate = pmsFirstLegBatchAggregate(batch)
  const nextStatuses = pmsAllowedBatchNextStatuses(batch.status)
  const advanceButtons = nextStatuses
    .map((status) => `<button type="button" class="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="advance-status" data-batch-no="${escapeHtml(batchNo)}" data-next-status="${status}" data-skip-page-rerender="true">推进为${status}</button>`)
    .join('')
  const recordsHtml = batch.records.length
    ? batch.records.map((record) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(record.trackingNo)}</td><td class="px-3 py-2"><div class="flex items-center gap-2">${renderPmsBusinessImage(getPmsMaterialPurchaseOrder(record.purchaseOrderNo)?.materialImageUrl || getPurchaseMaterialReference(record.materialCode)?.imageUrl || '', `${record.materialName}（${record.materialCode}）实物图`, 'h-9 w-9')}<div class="text-sm">${escapeHtml(record.materialName)}<div class="text-xs text-slate-500">${escapeHtml(pmsBusinessNumber(record.purchaseOrderNo))}${record.styleName?` · ${escapeHtml(record.styleName)}`:''}</div></div></div></td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(record.qty, record.unit)}</td><td class="px-3 py-2 text-sm tabular-nums">${record.rolls}</td><td class="px-3 py-2 text-sm tabular-nums">${record.boxCount}</td></tr>`).join('')
    : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="5">暂无物流记录</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="头程单详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[820px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(batch.batchNo)} · ${escapeHtml(batch.batchName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(batch.carrierName)} · ${escapeHtml(batch.channelName)} · ${renderPmsStatusBadge(batch.status, statusTone(batch.status))}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">${renderPmsOverlayError(state.overlayError)}
    <dl class="grid grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">转运中心</dt><dd class="mt-1">${escapeHtml(batch.transferCenter)}</dd></div><div><dt class="text-xs text-muted-foreground">目的仓</dt><dd class="mt-1">${escapeHtml(batch.destinationWarehouse)}</dd></div><div><dt class="text-xs text-muted-foreground">计划起运</dt><dd class="mt-1">${escapeHtml(batch.plannedShipDate || '待定')}</dd></div><div><dt class="text-xs text-muted-foreground">运输方式 / 时效</dt><dd class="mt-1">${escapeHtml(batch.transportMethod)} · ${batch.estimatedTransitDays}天</dd></div><div><dt class="text-xs text-muted-foreground">计费 / 税</dt><dd class="mt-1">${escapeHtml(batch.billingMethod)} · ${escapeHtml(batch.taxMethod)}</dd></div><div><dt class="text-xs text-muted-foreground">头程费用</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(batch.fee, batch.feeCurrency === 'USD' ? 'USD' : 'RMB')}</dd></div></dl>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">批次聚合</h3><dl class="mt-3 grid grid-cols-4 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">总箱数</dt><dd class="mt-1 tabular-nums">${aggregate.boxCount === null ? '—' : aggregate.boxCount}</dd></div><div><dt class="text-xs text-muted-foreground">总重量</dt><dd class="mt-1 tabular-nums">${aggregate.totalWeightKg === null ? '—' : `${formatPmsQty(aggregate.totalWeightKg)} kg`}</dd></div><div><dt class="text-xs text-muted-foreground">总体积</dt><dd class="mt-1 tabular-nums">${aggregate.totalVolumeM3 === null ? '—' : `${formatPmsQty(aggregate.totalVolumeM3)} m³`}</dd></div><div><dt class="text-xs text-muted-foreground">转运天数</dt><dd class="mt-1 tabular-nums">${aggregate.transitDays === null ? '—' : `${aggregate.transitDays} 天`}</dd></div></dl></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">提货与入库信息</h3><dl class="mt-3 grid grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">提单号</dt><dd class="mt-1">${escapeHtml(batch.billOfLadingNo || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">船司名</dt><dd class="mt-1">${escapeHtml(batch.shippingLineName || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">提单号备注</dt><dd class="mt-1">${escapeHtml(batch.billOfLadingRemark || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">货源地区</dt><dd class="mt-1">${escapeHtml(batch.sourceRegion)}</dd></div><div><dt class="text-xs text-muted-foreground">货运类型</dt><dd class="mt-1">${escapeHtml(batch.cargoType)}</dd></div><div><dt class="text-xs text-muted-foreground">货运公司</dt><dd class="mt-1">${escapeHtml(batch.logisticsCompany || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">仓库 / 区域</dt><dd class="mt-1">${escapeHtml(batch.warehouse || '—')}${batch.area ? ` · ${escapeHtml(batch.area)}` : ''}</dd></div><div><dt class="text-xs text-muted-foreground">入库状态</dt><dd class="mt-1">${escapeHtml(batch.inboundStatus)}</dd></div><div><dt class="text-xs text-muted-foreground">预计送达万隆</dt><dd class="mt-1">${escapeHtml(batch.estimatedArrivalAt || '待定')}</dd></div></dl></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">费用明细</h3><div class="mt-3 grid grid-cols-2 gap-2">${PMS_FIRST_LEG_FEE_FIELDS.map((field) => `<div class="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"><span class="text-muted-foreground">${field.label}（${field.currency}）</span><span class="tabular-nums">${formatFeeAmount(batch.fees[field.key], field.currency)}</span></div>`).join('')}${(['RMB', 'USD', 'IDR'] as const).map((currency) => `<div class="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold"><span>${currency} 小计</span><span class="tabular-nums">${formatFeeAmount(pmsFirstLegFeeSubtotal(batch.fees, currency), currency)}</span></div>`).join('')}</div></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">节点推进</h3><div class="mt-3 flex flex-wrap gap-2">${advanceButtons || '<span class="text-xs text-slate-500">已完成，无后续动作</span>'}<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-${EVENT_PREFIX}-action="open-edit" data-batch-no="${escapeHtml(batchNo)}" data-skip-page-rerender="true" ${batch.status === '待起运' ? '' : 'disabled'}>编辑计划与费用</button></div><label class="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">推进备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(note)}" placeholder="选填，如柜号、船名" data-${EVENT_PREFIX}-advance-note data-skip-page-rerender="true" /></label><p class="mt-2 text-xs text-slate-500">到仓动作会同步签收已加入头程的物流记录；已完成不可回退。</p></section>
    ${renderBoxes(batch)}
    <section><h3 class="mb-2 text-sm font-semibold">物流记录（${batch.records.length}）</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 720px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">物料 / 采购单</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">卷数</th><th class="px-3 py-2">箱数</th></tr></thead><tbody>${recordsHtml}</tbody></table></div></section>
  </div></section></div>`
}

function renderCreateOverlay(): string {
  const joinable = listPmsJoinableLogisticsRows()
  const carriers = listPmsFirstLegCarriers().filter((carrier) => carrier.status === '启用')
  const channels = listPmsFirstLegChannels().filter((channel) => channel.status === '启用')
  const carrierOptions = carriers.map((carrier) => `<option value="${escapeHtml(carrier.carrierCode)}">${escapeHtml(carrier.shortName)} · ${escapeHtml(carrier.carrierName)}</option>`).join('')
  const channelOptions = channels.map((channel) => `<option value="${escapeHtml(channel.channelCode)}" data-carrier-id="${escapeHtml(channel.carrierId)}">${escapeHtml(channel.channelName)} · ${escapeHtml(channel.currency)} · ${channel.transportMethod} · ${channel.estimatedTransitDays}天</option>`).join('')
  const defaultBatchNo = `FL-2026-${String(listPmsFirstLegBatches().length + 1).padStart(4, '0')}`
  const rowsHtml = joinable.length
    ? joinable.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2"><input type="checkbox" data-${EVENT_PREFIX}-create-check="${escapeHtml(item.record.recordNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2 text-sm">${escapeHtml(item.record.trackingNo)}</td><td class="px-3 py-2"><div class="flex items-center gap-2">${renderPmsBusinessImage(getPurchaseMaterialReference(item.record.materialCode)?.imageUrl ?? '', `${item.record.materialName}（${item.record.materialCode}）实物图`, 'h-9 w-9')}<div class="text-sm">${escapeHtml(item.record.materialName)}<div class="text-xs text-slate-500">${escapeHtml(item.record.purchaseOrderNo)}</div></div></div></td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(item.joinableQty, item.record.unit)}</td><td class="px-3 py-2 text-sm tabular-nums">${item.joinableRolls}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${item.joinableQty}" data-${EVENT_PREFIX}-create-qty="${escapeHtml(item.record.recordNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-20 rounded-md border px-2 text-sm" type="number" min="0" step="1" value="${item.joinableRolls}" data-${EVENT_PREFIX}-create-rolls="${escapeHtml(item.record.recordNo)}" data-skip-page-rerender="true" /></td></tr>`).join('')
    : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">没有可加入头程的国内物流记录（需先在国内物流签收）</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="新建头程单" data-pms-fls-create-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭新建"></button><section class="relative z-10 flex h-full w-[920px] max-w-[97vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">新建头程物流单</h2><p class="mt-1 text-xs text-slate-500">勾选国内物流记录，填写加入数量与卷数；单号不可重复</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程物流单号<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(defaultBatchNo)}" data-${EVENT_PREFIX}-create-field="batchNo" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">计划起运日期<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-06-20" data-${EVENT_PREFIX}-create-field="plannedShipDate" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">物流商<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="carrierId" data-skip-page-rerender="true">${carrierOptions}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">渠道<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="channelId" data-skip-page-rerender="true">${channelOptions}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程费用（按渠道币种）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="0" data-${EVENT_PREFIX}-create-field="fee" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">转运中心<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="默认按物流商城市" data-${EVENT_PREFIX}-create-field="transferCenter" data-skip-page-rerender="true" /></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="remark" data-skip-page-rerender="true" /></label>
    </div>
    <section class="rounded-lg border p-3"><h3 class="text-xs font-semibold text-muted-foreground">提货与入库信息</h3><div class="mt-3 grid grid-cols-3 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">提单号<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="billOfLadingNo" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">船司名<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="shippingLineName" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">货运类型<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="cargoType" data-skip-page-rerender="true"><option>海运</option><option>空运</option><option>陆运</option><option>快递</option></select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">货源地区<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="sourceRegion" data-skip-page-rerender="true"><option>中国</option><option>印尼</option><option>美国</option><option>其他</option></select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">仓库<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="warehouse" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">区域<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="area" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">货运公司<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="logisticsCompany" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">入库状态<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="inboundStatus" data-skip-page-rerender="true"><option>待交货</option><option>已交货</option><option>已发货</option><option>已入库</option></select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">预计送达万隆时间<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" data-${EVENT_PREFIX}-create-field="estimatedArrivalAt" data-skip-page-rerender="true" /></label>
      <label class="col-span-3 flex flex-col gap-1 text-xs text-muted-foreground">提单号备注<input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="billOfLadingRemark" data-skip-page-rerender="true" /></label>
    </div></section>
    <section class="rounded-lg border p-3"><h3 class="text-xs font-semibold text-muted-foreground">费用明细（非负数字，默认 0）</h3><div class="mt-3 grid grid-cols-3 gap-3">${PMS_FIRST_LEG_FEE_FIELDS.map((field) => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${field.label}（${field.currency}）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="0" data-${EVENT_PREFIX}-create-fee="${field.key}" data-skip-page-rerender="true" /></label>`).join('')}</div></section>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 840px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-12 px-3 py-2">选择</th><th class="w-40 px-3 py-2">物流单号</th><th class="w-56 px-3 py-2">物料 / 采购单</th><th class="w-28 px-3 py-2">可加入数量</th><th class="w-24 px-3 py-2">可加入卷数</th><th class="w-28 px-3 py-2">加入数量</th><th class="w-24 px-3 py-2">加入卷数</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('创建头程单', { prefix: EVENT_PREFIX, action: 'submit-create' }, 'check-check')}</footer></section></div>`
}

function renderEditOverlay(batchNo: string): string {
  const batch = getPmsFirstLegBatch(batchNo)
  if (!batch) return ''
  const cargoTypes: PmsFirstLegCargoType[] = ['空运', '海运', '陆运', '快递']
  const sourceRegions: PmsFirstLegSourceRegion[] = ['中国', '印尼', '美国', '其他']
  const inboundStatuses: PmsFirstLegInboundStatus[] = ['待交货', '已交货', '已发货', '已入库']
  const selectField = (name: string, options: string[], value: string) => `<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="${name}" data-skip-page-rerender="true">${options.map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('')}</select>`
  const textField = (name: string, value: string) => `<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(value)}" data-${EVENT_PREFIX}-edit-field="${name}" data-skip-page-rerender="true" />`
  const feeFields = PMS_FIRST_LEG_FEE_FIELDS.map((field) => `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${field.label}（${field.currency}）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${batch.fees[field.key]}" data-${EVENT_PREFIX}-edit-fee="${field.key}" data-skip-page-rerender="true" /></label>`).join('')
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="编辑头程单" data-pms-fls-edit-root><section class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><h2 class="font-semibold">编辑 ${escapeHtml(batchNo)}</h2>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-edit' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-3 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">计划起运日期<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="${escapeHtml(batch.plannedShipDate)}" data-${EVENT_PREFIX}-edit-field="plannedShipDate" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程费用（结算币种）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${batch.fee}" data-${EVENT_PREFIX}-edit-field="fee" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">预计送达万隆时间<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="${escapeHtml(batch.estimatedArrivalAt)}" data-${EVENT_PREFIX}-edit-field="estimatedArrivalAt" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">提单号${textField('billOfLadingNo', batch.billOfLadingNo)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">船司名${textField('shippingLineName', batch.shippingLineName)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">货运类型${selectField('cargoType', cargoTypes, batch.cargoType)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">货源地区${selectField('sourceRegion', sourceRegions, batch.sourceRegion)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">仓库${textField('warehouse', batch.warehouse)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">区域${textField('area', batch.area)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">货运公司${textField('logisticsCompany', batch.logisticsCompany)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">入库状态${selectField('inboundStatus', inboundStatuses, batch.inboundStatus)}</label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">提单号备注${textField('billOfLadingRemark', batch.billOfLadingRemark)}</label>
      <label class="col-span-3 flex flex-col gap-1 text-xs text-muted-foreground">备注${textField('remark', batch.remark)}</label>
    </div>
    <section class="mt-4 rounded-lg border p-3"><h3 class="text-xs font-semibold text-muted-foreground">费用明细（非负数字）</h3><div class="mt-3 grid grid-cols-3 gap-3">${feeFields}</div></section>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-edit' }, 'x')}${renderPrimaryButton('保存修改', { prefix: EVENT_PREFIX, action: 'submit-edit' }, 'check-check')}</footer></section></div>`
}

function renderBoxes(batch:PmsFirstLegBatch):string {
  const button=(label:string,action:string,boxNo='',code='')=>{
    const box=batch.boxes?.find(row=>row.boxNo===boxNo)
    const mutating=['open-box','manifest-move','manifest-seal','manifest-delete','manifest-move-item','manifest-dimensions','manifest-keyword','manifest-delivery'].includes(action)
    const disabled=mutating && (batch.status!=='待起运' || Boolean(box?.sealed))
    return renderSecondaryButton(label,{prefix:EVENT_PREFIX,action}).replace('<button',`<button ${disabled?'disabled aria-disabled="true"':''} data-batch-no="${escapeHtml(batch.batchNo)}" data-box-no="${escapeHtml(boxNo)}" data-code="${escapeHtml(code)}"`)
  }
  return `<section class="rounded border p-4"><div class="mb-3 flex flex-wrap gap-2"><h3 class="mr-auto font-semibold">货箱（${batch.boxes?.length || 0}）</h3>${button('展开全部','expand-boxes')}${button('收起全部','collapse-boxes')}${button('刷新货箱与汇总','refresh-boxes')}${button('新增货箱','open-box')}${button('一键编辑长宽高','manifest-dimensions')}${button('标识关键字','manifest-keyword')}${button('确认交货','manifest-delivery')}${button('货箱条码','print-box-barcodes')}<select class="h-8 rounded border px-2 text-xs" data-pms-fls-export-manifest="${escapeHtml(batch.batchNo)}" aria-label="导出批次明细"><option value="">导出明细</option>${['装箱单','装箱单明细','本土做货数量','成衣商品明细','物流明细'].map(label=>`<option>${label}</option>`).join('')}</select><label class="rounded border px-2 py-1 text-xs">导入面辅料 / 测款（支持 .xls / .xlsx / CSV）<input class="mt-1 block max-w-44 text-xs" type="file" accept=".xlsx,.xls,.csv" data-pms-fls-box-import="${escapeHtml(batch.batchNo)}"></label></div>${(batch.boxes || []).map(box=>`<details class="mb-3 rounded border p-3" open><summary class="cursor-pointer text-sm font-semibold">${escapeHtml(box.boxNo)} · ${box.cargoType} · ${box.sealed?'已封箱':'未封箱'} · ${box.weightKg} kg · ${box.lengthCm}×${box.widthCm}×${box.heightCm} cm</summary><div class="my-2 flex flex-wrap gap-2">${button('编辑 / 换箱号','open-box',box.boxNo)}${button('换批次','manifest-move',box.boxNo)}${button('封箱','manifest-seal',box.boxNo)}${button('删除空箱','manifest-delete',box.boxNo)}</div>${box.items.map(item=>`<div class="flex items-center gap-2 border-t py-2">${renderPmsBusinessImage(item.imageUrl,item.name,'h-9 w-9')}<span class="flex-1 text-sm">${escapeHtml(item.code)} · ${escapeHtml(item.name)} · ${item.qty} ${escapeHtml(item.unit)}</span>${button('换箱','manifest-move-item',box.boxNo,item.code)}</div>`).join('') || '<p class="text-sm text-slate-500">空箱</p>'}</details>`).join('')}<div class="text-xs text-slate-500">${(batch.keywords || []).map(item=>`${escapeHtml(item.keyword)} ${escapeHtml(item.remark)}`).join(' · ')}</div></section>`
}
function boxChoiceRows(){const keyword=state.boxKeyword.trim().toLowerCase();return listPurchaseGoodsReferences().filter(row=>row.active&&row.imageUrl&&(!keyword||[row.materialCode,row.materialName].some(value=>value.toLowerCase().includes(keyword))))}
function renderBoxChoices():string{
 const rows=boxChoiceRows(),pages=Math.max(1,Math.ceil(rows.length/10));state.boxChoicePage=Math.min(state.boxChoicePage,pages);const selected=Object.values(state.boxItemQuantities).filter(value=>Number(value)>0).length
 return `<p class="my-2 text-xs text-slate-500">共 ${rows.length} 个SKU · 已填写 ${selected} 个。数量为0不装箱。</p>${rows.slice((state.boxChoicePage-1)*10,state.boxChoicePage*10).map(row=>`<label class="mb-2 flex items-center gap-2 text-sm">${renderPmsBusinessImage(row.imageUrl,row.materialName,'h-8 w-8')}<span class="flex-1">${escapeHtml(row.materialCode)} · ${escapeHtml(row.materialName)}</span><input class="h-9 w-20 rounded border px-2" type="number" min="0" step="any" value="${escapeHtml(state.boxItemQuantities[row.materialCode]||'0')}" data-box-qty="${escapeHtml(row.materialCode)}" aria-label="${escapeHtml(row.materialCode)} 装箱数量"><span>${escapeHtml(row.unit)}</span></label>`).join('')||'<p class="py-5 text-sm">没有匹配SKU，修改关键词重新查询。</p>'}<div class="mt-3 flex items-center justify-end gap-3 text-sm"><button class="rounded border px-3 py-1 disabled:text-slate-300" data-pms-fls-action="box-prev" ${state.boxChoicePage<=1?'disabled':''}>上一页SKU</button><span>${state.boxChoicePage} / ${pages}</span><button class="rounded border px-3 py-1 disabled:text-slate-300" data-pms-fls-action="box-next" ${state.boxChoicePage>=pages?'disabled':''}>下一页SKU</button></div>`
}
function refreshBoxChoices():void{const surface=rootElement()?.querySelector<HTMLElement>('[data-box-item-choices]');if(surface){surface.innerHTML=renderBoxChoices();hydratePmsSurface(surface)}}
function renderBoxOverlay(batchNo:string,boxNo:string):string {
  const box=getPmsFirstLegBatch(batchNo)?.boxes?.find(row=>row.boxNo===boxNo)
  const input=(key:string,label:string,value:unknown,type='text')=>`<label class="block text-xs text-slate-500">${label}<input class="mt-1 h-9 w-full rounded border px-2 text-sm" type="${type}" value="${escapeHtml(state.boxDraft[key]??String(value??''))}" data-box-field="${key}"></label>`
  return `<div class="fixed inset-0 z-[60] flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="货箱表单"><section class="flex h-full w-[650px] max-w-[95vw] flex-col bg-white"><header class="border-b p-4 font-semibold">${box?'编辑货箱':'新增货箱'} · ${escapeHtml(batchNo)}</header><div class="flex-1 space-y-4 overflow-auto p-4"><div class="grid grid-cols-2 gap-3">${input('boxNo','箱号',box?.boxNo || '')}<label class="block text-xs text-slate-500">货箱类型<select class="mt-1 h-9 w-full rounded border px-2" data-box-field="cargoType">${['普通货箱','裁片货箱','辅料货箱'].map(type=>`<option ${(state.boxDraft.cargoType||box?.cargoType)===type?'selected':''}>${type}</option>`).join('')}</select></label>${input('weightKg','重量（kg）',box?.weightKg || 0,'number')}${input('lengthCm','长（cm）',box?.lengthCm || 0,'number')}${input('widthCm','宽（cm）',box?.widthCm || 0,'number')}${input('heightCm','高（cm）',box?.heightCm || 0,'number')}${input('remark','备注',box?.remark || '')}</div><fieldset><legend class="text-sm font-semibold">装箱商品 / 物料</legend><label class="mt-2 block text-sm">SKU / 名称<input class="mt-1 h-9 w-full rounded border px-2" value="${escapeHtml(state.boxKeyword)}" data-box-keyword></label><div class="mt-2 flex gap-2">${renderSecondaryButton('查询SKU',{prefix:EVENT_PREFIX,action:'box-query'},'search')}${renderSecondaryButton('重置SKU查询',{prefix:EVENT_PREFIX,action:'box-reset'},'rotate-ccw')}</div><div data-box-item-choices>${renderBoxChoices()}</div></fieldset></div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-box'})}${renderPrimaryButton('保存货箱',{prefix:EVENT_PREFIX,action:'save-box'})}</footer></section></div>`
}
function renderManifestOverlay():string {
  if(state.overlay?.kind!=='manifest') return ''
  const overlay=state.overlay,batch=getPmsFirstLegBatch(overlay.batchNo)
  if(!batch) return ''
  const input=(key:string,label:string,type='text')=>`<label class="block text-sm">${label}<input class="mt-1 h-9 w-full rounded border px-2" type="${type}" data-manifest-field="${key}"></label>`
  const fields=overlay.mode==='keyword'?input('keyword','标识关键字')+input('remark','备注'):overlay.mode==='delivery'?`<p class="text-sm">确认将本批次 ${batch.boxes?.length || 0} 个货箱交给 ${escapeHtml(batch.carrierName)}，状态改为已交货。</p>`+input('deliveredAt','交货日期','date'):overlay.mode==='dimensions'?input('lengthCm','长（cm）','number')+input('widthCm','宽（cm）','number')+input('heightCm','高（cm）','number'):overlay.mode==='move'?`<label class="block text-sm">目标批次<select class="mt-1 h-9 w-full rounded border px-2" data-manifest-field="targetBatchNo">${listPmsFirstLegBatches().filter(row=>row.batchNo!==batch.batchNo && row.status==='待起运').map(row=>`<option>${escapeHtml(row.batchNo)}</option>`).join('')}</select></label>`:overlay.mode==='move-item'?`<label class="block text-sm">目标货箱<select class="mt-1 h-9 w-full rounded border px-2" data-manifest-field="targetBoxNo">${(batch.boxes || []).filter(box=>box.boxNo!==overlay.boxNo && !box.sealed).map(box=>`<option>${escapeHtml(box.boxNo)}</option>`).join('')}</select></label>`+input('qty','换箱数量','number'):`<p class="text-sm">${overlay.mode==='seal'?'确认封箱后禁止修改货箱信息。':'仅空箱可以删除。'}箱号 ${escapeHtml(overlay.boxNo)}</p>`
  const saveLabel = { keyword:'保存关键字', delivery:'确认交货', dimensions:'保存长宽高', move:'确认换批次', 'move-item':'确认换箱', seal:'确认封箱', delete:'删除空箱' }[overlay.mode]
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="装箱确认"><section class="w-[460px] max-w-full rounded bg-white p-5"><h2 class="mb-4 font-semibold">${escapeHtml(overlay.batchNo)} 装箱操作</h2><div class="space-y-3">${fields}</div><footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-box'})}${renderPrimaryButton(saveLabel,{prefix:EVENT_PREFIX,action:'save-manifest'})}</footer></section></div>`
}
function renderOverlays(): string {
  if(state.overlay?.kind==='box-import'){const overlay=state.overlay;return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="装箱导入预览"><section class="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-lg bg-white p-5"><h2 class="font-semibold">装箱导入预览</h2><p>${escapeHtml(overlay.fileName)} · ${overlay.items.length} 个SKU</p>${overlay.items.map(item=>`<div class="flex gap-3 border-t py-2">${renderPmsBusinessImage(item.imageUrl,item.name,'h-10 w-10')}<span>${escapeHtml(item.code)} · ${escapeHtml(item.name)}<br>${item.qty} ${escapeHtml(item.unit)}</span></div>`).join('')}<footer class="flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('确认导入货箱',{prefix:EVENT_PREFIX,action:'save-import-box'})}</footer></section></div>${renderPmsImagePreview()}`}

  if(state.overlay?.kind==='box') return renderBoxOverlay(state.overlay.batchNo,state.overlay.boxNo)+renderPmsImagePreview()
  if(state.overlay?.kind==='manifest') return renderManifestOverlay()+renderPmsImagePreview()

  const columnSettings = `<div data-pms-fls-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.batchNo, state.overlay.note)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'create') return `${columnSettings}${renderCreateOverlay()}${renderPmsImagePreview()}`
  return `${columnSettings}${renderDetailOverlay(state.overlay.batchNo, '')}${renderEditOverlay(state.overlay.batchNo)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const targetBanner = state.targetBatchNo
    ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">已从物流费用对账定位头程单 <strong>${escapeHtml(state.targetBatchNo)}</strong>，列表已按单号过滤。</div>`
    : ''
  return renderStandardListPage({
      showHeader: true,
    title: '头程物流',
    primaryActionsHtml: `${renderPrimaryButton('新建头程单', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus')}`,
    feedbackHtml: `<div data-pms-fls-feedback>${targetBanner}${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-pms-fls-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-pms-fls-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条${state.selectedBatchNos.length ? ` · 已选 ${state.selectedBatchNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">状态：待起运 → 已装柜 → 头程中 → 已到仓 → 已完成</span>${renderSecondaryButton('批量装柜', { prefix: EVENT_PREFIX, action: 'batch-load' }, 'list-checks').replace('<button', `<button ${state.selectedBatchNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('批量确认出运', { prefix: EVENT_PREFIX, action: 'batch-ship' }, 'check-check').replace('<button', `<button ${state.selectedBatchNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-fls-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-fls-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-fls-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(resetFilters=false):void {
  const root=rootElement();if(!root) return
  controller.refresh({overlays:false})
  const update=(part:string,html:string)=>{const region=root.querySelector<HTMLElement>(`[data-pms-fls-${part}]`);if(region){region.innerHTML=html;hydratePmsSurface(region)}}
  const title=root.querySelector<HTMLElement>('[data-standard-list-table-section] h2');if(title) title.textContent=`共 ${filteredRows().length} 条`
  update('stats',renderStats());update('feedback',renderPmsFeedback(state.feedback,state.feedbackOk));if(resetFilters) update('filters',renderFilters())
  refreshOverlays();syncProcessSelectionHeader(root);syncBatchButtons()
}
function preserveEditingError():void {
  const root=rootElement();if(!root) return
  const panel=root.querySelector('[role="dialog"] section')
  let alert=panel?.querySelector<HTMLElement>('[data-pms-edit-error]')
  if(!alert && panel){alert=document.createElement('p');alert.dataset.pmsEditError='';alert.className='rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700';alert.setAttribute('role','alert');panel.prepend(alert)}
  if(alert) alert.textContent=state.overlayError
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function closeTopOverlay(): void {
  if (state.overlay?.kind === 'edit') {
    state.overlay = { kind: 'detail', batchNo: state.overlay.batchNo, clientActionId: nextPmsActionId('pms-fls-detail'), note: '' }
    state.overlayError = ''
    refreshOverlays()
    return
  }
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的头程单。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '头程物流.csv',
    ['头程单号', '名称', '物流商', '渠道', '运输方式', '状态', '转运中心', '目的仓', '计划起运', '提单号', '船司名', '货运类型', '货源地区', '仓库', '区域', '货运公司', '入库状态', '预计送达万隆', '装柜时间', '出运时间', '到仓时间', '完成时间', '物流条数', '总数量', '卷数', '总箱数', '总重量(kg)', '总体积(m³)', '转运天数', '费用', ...PMS_FIRST_LEG_FEE_FIELDS.map((field) => `${field.label}(${field.currency})`), '费用明细RMB小计', '费用明细USD小计', '费用明细IDR小计'],
    rows.map((row) => {
      const aggregate = pmsFirstLegBatchAggregate(row)
      return [row.batchNo, row.batchName, row.carrierName, row.channelName, row.transportMethod, row.status, row.transferCenter, row.destinationWarehouse, row.plannedShipDate, row.billOfLadingNo, row.shippingLineName, row.cargoType, row.sourceRegion, row.warehouse, row.area, row.logisticsCompany, row.inboundStatus, row.estimatedArrivalAt, row.containerLoadedAt, row.actualShipDate, row.arrivedAt, row.completedAt, row.records.length, batchUnitTotals(row), row.records.reduce((sum, record) => sum + record.rolls, 0), aggregate.boxCount ?? '', aggregate.totalWeightKg ?? '', aggregate.totalVolumeM3 ?? '', aggregate.transitDays ?? '', row.fee, ...PMS_FIRST_LEG_FEE_FIELDS.map((field) => row.fees[field.key]), pmsFirstLegFeeSubtotal(row.fees, 'RMB'), pmsFirstLegFeeSubtotal(row.fees, 'USD'), pmsFirstLegFeeSubtotal(row.fees, 'IDR')]
    }),
  )
  state.feedback = `已导出 ${rows.length} 张头程单（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function refreshCreateChannelOptions(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-create-root]')
  if (!surface) return
  const carrierId = readTextField(surface, `[data-${EVENT_PREFIX}-create-field="carrierId"]`)
  const select = surface.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-create-field="channelId"]`)
  if (!select) return
  select.innerHTML = listPmsFirstLegChannels()
    .filter((channel) => channel.status === '启用' && channel.carrierId === carrierId)
    .map((channel) => `<option value="${escapeHtml(channel.channelCode)}">${escapeHtml(channel.channelName)} · ${escapeHtml(channel.currency)} · ${channel.transportMethod} · ${channel.estimatedTransitDays}天</option>`)
    .join('')
}

function readCreateFees(surface: ParentNode): Partial<PmsFirstLegFeeBreakdown> {
  const fees: Partial<PmsFirstLegFeeBreakdown> = {}
  PMS_FIRST_LEG_FEE_FIELDS.forEach((field) => {
    fees[field.key] = readNumberField(surface, `[data-${EVENT_PREFIX}-create-fee="${field.key}"]`)
  })
  return fees
}

function readEditFees(surface: ParentNode): Partial<PmsFirstLegFeeBreakdown> {
  const fees: Partial<PmsFirstLegFeeBreakdown> = {}
  PMS_FIRST_LEG_FEE_FIELDS.forEach((field) => {
    fees[field.key] = readNumberField(surface, `[data-${EVENT_PREFIX}-edit-fee="${field.key}"]`)
  })
  return fees
}

async function submitCreate(): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-create-root]')
  if (!surface) return
  const checked = [...surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-check]`)].filter((input) => input.checked)
  if (checked.length === 0) {
    state.overlayError = '请至少勾选一条国内物流记录加入头程'
    preserveEditingError()
    return
  }
  const allocations = checked.map((input) => {
    const recordNo = input.dataset.pmsFlsCreateCheck || ''
    return {
      recordNo,
      qty: readNumberField(surface, `[data-${EVENT_PREFIX}-create-qty="${recordNo}"]`),
      rolls: readNumberField(surface, `[data-${EVENT_PREFIX}-create-rolls="${recordNo}"]`),
    }
  })
  const fee = readNumberField(surface, `[data-${EVENT_PREFIX}-create-field="fee"]`)
  try {
    const batch = await createPmsFirstLegBatch(
      {
        batchNo: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="batchNo"]`),
        batchName: '',
        carrierId: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="carrierId"]`),
        channelId: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="channelId"]`),
        transferCenter: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="transferCenter"]`),
        destinationWarehouse: '',
        plannedShipDate: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="plannedShipDate"]`),
        fee: Number.isFinite(fee) ? fee : 0,
        remark: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="remark"]`),
        billOfLadingNo: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="billOfLadingNo"]`),
        billOfLadingRemark: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="billOfLadingRemark"]`),
        shippingLineName: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="shippingLineName"]`),
        sourceRegion: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="sourceRegion"]`) as PmsFirstLegSourceRegion,
        warehouse: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="warehouse"]`),
        cargoType: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="cargoType"]`) as PmsFirstLegCargoType,
        area: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="area"]`),
        logisticsCompany: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="logisticsCompany"]`),
        inboundStatus: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="inboundStatus"]`) as PmsFirstLegInboundStatus,
        estimatedArrivalAt: readTextField(surface, `[data-${EVENT_PREFIX}-create-field="estimatedArrivalAt"]`),
        fees: readCreateFees(surface),
        allocations,
      },
      PMS_BUYER_ACTOR,
    )
    state.feedback = `已创建头程单 ${batch.batchNo}，${batch.records.length} 条物流已加入头程。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '创建头程单失败，请检查填写内容'
    preserveEditingError()
  }
}

async function submitEdit(batchNo: string): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-edit-root]')
  if (!surface) return
  const fee = readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="fee"]`)
  try {
    await updatePmsFirstLegBatch(
      batchNo,
      {
        plannedShipDate: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="plannedShipDate"]`),
        fee: Number.isFinite(fee) ? fee : 0,
        remark: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="remark"]`),
        billOfLadingNo: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="billOfLadingNo"]`),
        billOfLadingRemark: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="billOfLadingRemark"]`),
        shippingLineName: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="shippingLineName"]`),
        sourceRegion: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="sourceRegion"]`) as PmsFirstLegSourceRegion,
        warehouse: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="warehouse"]`),
        cargoType: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="cargoType"]`) as PmsFirstLegCargoType,
        area: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="area"]`),
        logisticsCompany: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="logisticsCompany"]`),
        inboundStatus: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="inboundStatus"]`) as PmsFirstLegInboundStatus,
        estimatedArrivalAt: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="estimatedArrivalAt"]`),
        fees: readEditFees(surface),
      },
      PMS_BUYER_ACTOR,
    )
    state.feedback = `${batchNo} 的计划与费用已更新。`
    state.feedbackOk = true
    state.overlay = { kind: 'detail', batchNo, clientActionId: nextPmsActionId('pms-fls-detail'), note: '' }
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存头程单失败'
    preserveEditingError()
  }
}

export async function renderPmsFirstLegShipmentsPage(): Promise<string> {
  try{await Promise.all([hydratePmsFirstLegFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb(),hydratePmsProductPurchaseOrdersFromIdb()])}catch(error){state.feedback=error instanceof Error?error.message:'用户数据不可读';state.feedbackOk=false}
  state.selectedBatchNos = []
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  readTargetBatchFromRuntime()
  controller.installColumnDragEvents()
  return `<div data-pms-fls-root data-skip-page-rerender="true"><style>[data-pms-fls-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsFirstLegShipmentOverlays(): boolean {
  if (state.overlay) {
    closeTopOverlay()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export async function handlePmsFirstLegShipmentsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
  if(state.overlay?.kind==='box'){const quantity=target.closest<HTMLInputElement>('[data-box-qty]');if(quantity){state.boxItemQuantities[quantity.dataset.boxQty||'']=quantity.value;return true}const field=target.closest<HTMLInputElement|HTMLSelectElement>('[data-box-field]');if(field){state.boxDraft[field.dataset.boxField||'']=field.value;return true}const keyword=target.closest<HTMLInputElement>('[data-box-keyword]');if(keyword){state.boxKeyword=keyword.value;return true}}
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeTopOverlay()
    return true
  }

  const exportField=target.closest<HTMLSelectElement>('[data-pms-fls-export-manifest]')
  if(exportField && exportField.value){const batch=getPmsFirstLegBatch(exportField.dataset.pmsFlsExportManifest || '');if(batch){const boxes=batch.boxes || [],allItems=boxes.flatMap(box=>box.items.map(item=>[box.boxNo,item.code,item.name,item.qty,item.unit]));const title=exportField.value;const items=title==='成衣商品明细'?allItems.filter(row=>listPurchaseGoodsReferences().find(ref=>ref.materialCode===row[1])?.category==='成衣'):allItems;const localOrders=[...new Set(batch.records.map(row=>getPmsMaterialPurchaseOrder(row.purchaseOrderNo)?.sourceProductPurchaseOrderNo).filter(Boolean))].map(no=>getPmsProductPurchaseOrder(no!)).filter(row=>row?.purchaseType==='做货'&&row.area==='印尼');const rows=title==='本土做货数量'?localOrders.flatMap(order=>order!.lines.map(line=>[order!.purchaseOrderNo,order!.spu,line.sku,line.qty,'件'])):title==='装箱单'?boxes.map(box=>[box.boxNo,box.cargoType,box.weightKg,box.lengthCm,box.widthCm,box.heightCm]):title==='物流明细'?batch.records.map(row=>[row.trackingNo,row.purchaseOrderNo,row.materialCode,row.qty,row.unit]):items;if(rows.length) downloadPmsCsv(`${title}-${batch.batchNo}.csv`,title==='本土做货数量'?['商品采购单','SPU','SKU','商品采购计划数量','单位']:title==='装箱单'?['箱号','货箱类型','重量kg','长cm','宽cm','高cm']:['箱号 / 物流单','SKU / 采购单','商品名称 / SKU','数量','单位'],rows);else {state.feedback='该导出范围暂无明细';state.feedbackOk=false;refreshAll()}}exportField.value='';return true}
  const importField=target.closest<HTMLInputElement>('[data-pms-fls-box-import]')
  if(importField?.files?.[0]){try{const batchNo=importField.dataset.pmsFlsBoxImport || '';const rows=await parsePmsExcelRows(importField.files[0]);const refs=listPurchaseGoodsReferences();const items=rows.slice(rows[0]?.[0]?.includes('SKU')?1:0).filter(row=>row.some(Boolean)).map(cells=>{const ref=refs.find(item=>item.materialCode===cells[0]);if(!ref) throw new Error(`SKU ${cells[0]} 不存在`);return {code:ref.materialCode,name:ref.materialName,imageUrl:ref.imageUrl,unit:ref.unit,qty:Number(cells[1])}});if(!items.length) throw new Error('导入文件没有 SKU 数量行');if(new Set(items.map(row=>row.code)).size!==items.length || items.some(row=>!Number.isFinite(row.qty)||row.qty<=0))throw new Error('SKU不能重复，数量须大于0');state.overlay={kind:'box-import',batchNo,fileName:importField.files[0].name,items,clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays()}catch(error){state.overlayError=error instanceof Error?error.message:'导入未保存';preserveEditingError()};return true}
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsFlsField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      state.targetBatchNo = ''
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as BatchPageState['status']
      return true
    }
    if (fieldName === 'carrierFilter') {
      state.carrierFilter = field.value
      return true
    }
    if (fieldName === 'select-row') {
      const batchNo = field.dataset.batchNo || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedBatchNos = [...new Set([...state.selectedBatchNos, batchNo])]
      } else {
        state.selectedBatchNos = state.selectedBatchNos.filter((value) => value !== batchNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') state.selectedBatchNos = []
      else if (scope === 'page') {
        const pageIds = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="select-row"]`) ?? [])]
          .filter((input) => !input.disabled)
          .map((input) => input.dataset.batchNo || '')
          .filter(Boolean)
        state.selectedBatchNos = [...new Set([...state.selectedBatchNos, ...pageIds])]
      } else {
        state.selectedBatchNos = filteredRows().filter((row) => isBatchSelectable(row)).map((row) => row.batchNo)
      }
      if (field instanceof HTMLSelectElement) field.value = ''
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }

  if (target.closest(`[data-${EVENT_PREFIX}-create-field="carrierId"]`)) {
    refreshCreateChannelOptions()
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsFlsAction
  if (!action) return false

  if(action==='expand-boxes'||action==='collapse-boxes'){rootElement()?.querySelectorAll<HTMLDetailsElement>('[role="dialog"] details').forEach(node=>node.open=action==='expand-boxes');return true}
  if(action==='refresh-boxes'){try{await Promise.all([hydratePmsFirstLegFromIdb(true),hydratePmsMaterialPurchaseOrdersFromIdb(true)]);state.feedback='已重新读取本地货箱与汇总';state.feedbackOk=true;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'未能重新读取货箱';preserveEditingError()}return true}
  if(action==='open-box'){state.boxKeyword='';state.boxChoicePage=1;state.boxItemQuantities={};state.boxDraft={};const box=getPmsFirstLegBatch(actionNode?.dataset.batchNo||'')?.boxes?.find(row=>row.boxNo===actionNode?.dataset.boxNo);for(const item of box?.items||[])state.boxItemQuantities[item.code]=String(item.qty);state.overlay={kind:'box',batchNo:actionNode?.dataset.batchNo || '',boxNo:actionNode?.dataset.boxNo || '',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='box-query'||action==='box-reset'||action==='box-prev'||action==='box-next'){if(action==='box-query')state.boxChoicePage=1;if(action==='box-reset'){state.boxKeyword='';state.boxChoicePage=1;const input=rootElement()?.querySelector<HTMLInputElement>('[data-box-keyword]');if(input)input.value=''}if(action==='box-prev')state.boxChoicePage-=1;if(action==='box-next')state.boxChoicePage+=1;refreshBoxChoices();return true}
  if(action==='close-box'){const batchNo=state.overlay && 'batchNo' in state.overlay?state.overlay.batchNo:'';state.overlay=batchNo?{kind:'detail',batchNo,clientActionId:crypto.randomUUID(),note:''}:null;refreshOverlays();return true}
  if(action==='save-import-box' && state.overlay?.kind==='box-import'){const overlay=state.overlay;try{await savePmsFirstLegBox(overlay.batchNo,{boxNo:`BOX-${overlay.clientActionId.replaceAll('-','').slice(0,10).toUpperCase()}`,cargoType:'辅料货箱',weightKg:0,lengthCm:0,widthCm:0,heightCm:0,remark:`导入 ${overlay.fileName}`,sealed:false,items:overlay.items},'',PMS_BUYER_ACTOR,overlay.clientActionId);state.feedback='装箱明细已导入';state.feedbackOk=true;state.overlay={kind:'detail',batchNo:overlay.batchNo,clientActionId:crypto.randomUUID(),note:''};refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'导入未保存';preserveEditingError()}return true}
  if(action==='save-box' && state.overlay?.kind==='box'){const {batchNo,boxNo,clientActionId}=state.overlay;const text=(key:string)=>rootElement()?.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-box-field="${key}"]`)?.value || '';try{const refs=listPurchaseGoodsReferences();if(Object.values(state.boxItemQuantities).some(value=>!Number.isFinite(Number(value))||Number(value)<0))throw new Error('装箱数量须为非负数');const items=Object.entries(state.boxItemQuantities).filter(([,value])=>Number(value)>0).map(([code,value])=>{const ref=refs.find(row=>row.materialCode===code);if(!ref?.active||!ref.imageUrl)throw new Error(`SKU ${code} 已不可用，重新选择`);return{code:ref.materialCode,name:ref.materialName,imageUrl:ref.imageUrl,unit:ref.unit,qty:Number(value)}});await savePmsFirstLegBox(batchNo,{boxNo:text('boxNo'),cargoType:text('cargoType') as PmsFirstLegBox['cargoType'],weightKg:Number(text('weightKg')),lengthCm:Number(text('lengthCm')),widthCm:Number(text('widthCm')),heightCm:Number(text('heightCm')),remark:text('remark'),sealed:false,items},boxNo,PMS_BUYER_ACTOR,clientActionId);state.overlay={kind:'detail',batchNo,clientActionId:crypto.randomUUID(),note:''};state.feedback='货箱已保存';state.feedbackOk=true;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'货箱未保存';preserveEditingError()};return true}
  if(action.startsWith('manifest-')){state.overlay={kind:'manifest',batchNo:actionNode?.dataset.batchNo || '',mode:action.slice(9) as 'keyword'|'delivery'|'dimensions'|'move'|'move-item'|'seal'|'delete',boxNo:actionNode?.dataset.boxNo || '',code:actionNode?.dataset.code,clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='save-manifest' && state.overlay?.kind==='manifest'){const overlay=state.overlay;const text=(key:string)=>rootElement()?.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-manifest-field="${key}"]`)?.value || '';try{if(overlay.mode==='move') await movePmsFirstLegBox(overlay.batchNo,overlay.boxNo,text('targetBatchNo'),PMS_BUYER_ACTOR,overlay.clientActionId);else if(overlay.mode==='move-item') await movePmsFirstLegBoxItem(overlay.batchNo,overlay.boxNo,overlay.code || '',text('targetBoxNo'),Number(text('qty')),PMS_BUYER_ACTOR,overlay.clientActionId);else if(overlay.mode==='seal'||overlay.mode==='delete') await sealOrDeletePmsFirstLegBox(overlay.batchNo,overlay.boxNo,overlay.mode,PMS_BUYER_ACTOR,overlay.clientActionId);else await updatePmsFirstLegManifest(overlay.batchNo,overlay.mode==='keyword'?{keyword:text('keyword'),keywordRemark:text('remark')}:overlay.mode==='delivery'?{deliveredAt:text('deliveredAt')}:{dimensions:{lengthCm:Number(text('lengthCm')),widthCm:Number(text('widthCm')),heightCm:Number(text('heightCm'))}},PMS_BUYER_ACTOR,overlay.clientActionId);state.overlay={kind:'detail',batchNo:overlay.batchNo,clientActionId:crypto.randomUUID(),note:''};state.feedback='装箱操作已保存';state.feedbackOk=true;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'装箱操作未保存';preserveEditingError()};return true}
  if(action==='print-box-barcodes'){const batch=getPmsFirstLegBatch(actionNode?.dataset.batchNo || '');if(batch?.boxes?.length){const popup=window.open('','_blank');if(popup){popup.document.write(`<html lang="zh-CN"><head><title>货箱条码 ${escapeHtml(batch.batchNo)}</title></head><body><button onclick="print()">打印货箱条码</button>${batch.boxes.map(box=>`<section style="padding:20px;page-break-inside:avoid"><h2>${escapeHtml(batch.batchNo)} · ${escapeHtml(box.boxNo)}</h2>${renderCode128Barcode(`${batch.batchNo}/${box.boxNo}`,`货箱 ${box.boxNo} 条码`)}<p>${box.weightKg} kg</p></section>`).join('')}</body></html>`);popup.document.close()}}else {state.feedback='暂无货箱可打印';state.feedbackOk=false;refreshAll()};return true}
  if (action === 'toggle-page') {
    const checked = (actionNode as HTMLInputElement).checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const batchNo = box.dataset.batchNo || ''
      if (!batchNo || box.disabled) return
      if (checked) {
        if (!state.selectedBatchNos.includes(batchNo)) state.selectedBatchNos = [...state.selectedBatchNos, batchNo]
      } else {
        state.selectedBatchNos = state.selectedBatchNos.filter((value) => value !== batchNo)
      }
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
    state.carrierFilter = ''
    state.targetBatchNo = ''
    state.selectedBatchNos = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll(true)
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'batch-load' || action === 'batch-ship') {
    const label = action === 'batch-load' ? '装柜' : '确认出运'
    try {
      const outcome = action === 'batch-load'
        ? await batchLoadPmsFirstLegBatches(state.selectedBatchNos, PMS_BUYER_ACTOR)
        : await batchShipPmsFirstLegBatches(state.selectedBatchNos, PMS_BUYER_ACTOR)
      const skippedText = outcome.skipped.length > 0 ? `；跳过 ${outcome.skipped.length} 张：${outcome.skipped.map((item) => `${item.batchNo}（${item.reason}）`).join('、')}` : ''
      state.feedback = `已批量${label} ${outcome.updated.length} 张头程单${skippedText}。`
      state.feedbackOk = true
      state.selectedBatchNos = []
    } catch (error) {
      state.feedback = error instanceof PmsDomainError ? error.message : `批量${label}失败`
      state.feedbackOk = false
    }
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-fls-column-key]')?.dataset.pmsFlsColumnKey || ''
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
    state.overlay = { kind: 'detail', batchNo: actionNode?.dataset.batchNo || '', clientActionId: nextPmsActionId('pms-fls-detail'), note: '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-create') {
    state.overlay = { kind: 'create', clientActionId: nextPmsActionId('pms-fls-create') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    state.overlay = { kind: 'edit', batchNo: actionNode?.dataset.batchNo || '', clientActionId: nextPmsActionId('pms-fls-edit') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-edit') {
    closeTopOverlay()
    return true
  }
  if (action === 'submit-edit') {
    if (state.overlay?.kind === 'edit') await submitEdit(state.overlay.batchNo)
    return true
  }
  if (action === 'submit-create') {
    await submitCreate()
    return true
  }
  if (action === 'advance-status') {
    const batchNo = actionNode?.dataset.batchNo || ''
    const nextStatus = actionNode?.dataset.nextStatus as PmsFirstLegBatchStatus | undefined
    if (!nextStatus) return true
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-overlays]')
    const note = surface ? readTextField(surface, `[data-${EVENT_PREFIX}-advance-note]`) : ''
    try {
      await advancePmsFirstLegBatchStatus(batchNo, nextStatus, PMS_BUYER_ACTOR, note)
      state.feedback = `${batchNo} 已推进为${nextStatus}。`
      state.feedbackOk = true
      state.overlay = { kind: 'detail', batchNo, clientActionId: nextPmsActionId('pms-fls-detail'), note: '' }
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '状态推进失败'
      preserveEditingError()
    }
    return true
  }
  if (action === 'close-overlay') {
    closeTopOverlay()
    return true
  }
  return false
}

export function getPmsFirstLegBatchRowCountForTest(): number {
  return filteredRows().length
}
