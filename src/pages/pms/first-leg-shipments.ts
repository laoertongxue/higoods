// @page-pattern: list
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  advancePmsFirstLegBatchStatus,
  batchLoadPmsFirstLegBatches,
  batchShipPmsFirstLegBatches,
  consumePmsFirstLegTargetBatchNo,
  createPmsFirstLegBatch,
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
import { getPmsMaterial } from '../../data/pms/materials.ts'
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
  | { kind: 'detail'; batchNo: string; clientActionId: string; note: string }
  | { kind: 'create'; clientActionId: string }
  | { kind: 'edit'; batchNo: string; clientActionId: string }

interface BatchPageState extends ProcessOrderListControllerState {
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
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
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
  if (currency === 'IDR') return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`
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
    render: (row) => `<div class="text-sm tabular-nums">${row.records.length} 条物流 · ${formatPmsQty(row.records.reduce((sum, record) => sum + record.qty, 0))}</div><div class="mt-1 text-sm tabular-nums">${formatPmsMoney(row.fee, row.feeCurrency === 'USD' ? 'USD' : 'RMB')}</div><div class="mt-1 text-xs text-slate-500">卷数 ${row.records.reduce((sum, record) => sum + record.rolls, 0)}</div>`,
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
  pageSizeOptions: [10, 20, 50],
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
    ? batch.records.map((record) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(record.trackingNo)}</td><td class="px-3 py-2"><div class="flex items-center gap-2">${renderPmsBusinessImage(getPmsMaterial(record.materialCode)?.imageUrl ?? '', `${record.materialName}（${record.materialCode}）实物图`, 'h-9 w-9')}<div class="text-sm">${escapeHtml(record.materialName)}<div class="text-xs text-slate-500">${escapeHtml(record.purchaseOrderNo)} · ${escapeHtml(record.styleName)}</div></div></div></td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(record.qty, record.unit)}</td><td class="px-3 py-2 text-sm tabular-nums">${record.rolls}</td><td class="px-3 py-2 text-sm tabular-nums">${record.boxCount}</td></tr>`).join('')
    : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="5">暂无物流记录</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="头程单详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[820px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(batch.batchNo)} · ${escapeHtml(batch.batchName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(batch.carrierName)} · ${escapeHtml(batch.channelName)} · ${renderPmsStatusBadge(batch.status, statusTone(batch.status))}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">${renderPmsOverlayError(state.overlayError)}
    <dl class="grid grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">转运中心</dt><dd class="mt-1">${escapeHtml(batch.transferCenter)}</dd></div><div><dt class="text-xs text-muted-foreground">目的仓</dt><dd class="mt-1">${escapeHtml(batch.destinationWarehouse)}</dd></div><div><dt class="text-xs text-muted-foreground">计划起运</dt><dd class="mt-1">${escapeHtml(batch.plannedShipDate || '待定')}</dd></div><div><dt class="text-xs text-muted-foreground">运输方式 / 时效</dt><dd class="mt-1">${escapeHtml(batch.transportMethod)} · ${batch.estimatedTransitDays}天</dd></div><div><dt class="text-xs text-muted-foreground">计费 / 税</dt><dd class="mt-1">${escapeHtml(batch.billingMethod)} · ${escapeHtml(batch.taxMethod)}</dd></div><div><dt class="text-xs text-muted-foreground">头程费用</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(batch.fee, batch.feeCurrency === 'USD' ? 'USD' : 'RMB')}</dd></div></dl>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">批次聚合</h3><dl class="mt-3 grid grid-cols-4 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">总箱数</dt><dd class="mt-1 tabular-nums">${aggregate.boxCount === null ? '—' : aggregate.boxCount}</dd></div><div><dt class="text-xs text-muted-foreground">总重量</dt><dd class="mt-1 tabular-nums">${aggregate.totalWeightKg === null ? '—' : `${formatPmsQty(aggregate.totalWeightKg)} kg`}</dd></div><div><dt class="text-xs text-muted-foreground">总体积</dt><dd class="mt-1 tabular-nums">${aggregate.totalVolumeM3 === null ? '—' : `${formatPmsQty(aggregate.totalVolumeM3)} m³`}</dd></div><div><dt class="text-xs text-muted-foreground">转运天数</dt><dd class="mt-1 tabular-nums">${aggregate.transitDays === null ? '—' : `${aggregate.transitDays} 天`}</dd></div></dl></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">提货与入库信息</h3><dl class="mt-3 grid grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">提单号</dt><dd class="mt-1">${escapeHtml(batch.billOfLadingNo || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">船司名</dt><dd class="mt-1">${escapeHtml(batch.shippingLineName || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">提单号备注</dt><dd class="mt-1">${escapeHtml(batch.billOfLadingRemark || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">货源地区</dt><dd class="mt-1">${escapeHtml(batch.sourceRegion)}</dd></div><div><dt class="text-xs text-muted-foreground">货运类型</dt><dd class="mt-1">${escapeHtml(batch.cargoType)}</dd></div><div><dt class="text-xs text-muted-foreground">货运公司</dt><dd class="mt-1">${escapeHtml(batch.logisticsCompany || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">仓库 / 区域</dt><dd class="mt-1">${escapeHtml(batch.warehouse || '—')}${batch.area ? ` · ${escapeHtml(batch.area)}` : ''}</dd></div><div><dt class="text-xs text-muted-foreground">入库状态</dt><dd class="mt-1">${escapeHtml(batch.inboundStatus)}</dd></div><div><dt class="text-xs text-muted-foreground">预计送达万隆</dt><dd class="mt-1">${escapeHtml(batch.estimatedArrivalAt || '待定')}</dd></div></dl></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">费用明细</h3><div class="mt-3 grid grid-cols-2 gap-2">${PMS_FIRST_LEG_FEE_FIELDS.map((field) => `<div class="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"><span class="text-muted-foreground">${field.label}（${field.currency}）</span><span class="tabular-nums">${formatFeeAmount(batch.fees[field.key], field.currency)}</span></div>`).join('')}${(['RMB', 'USD', 'IDR'] as const).map((currency) => `<div class="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold"><span>${currency} 小计</span><span class="tabular-nums">${formatFeeAmount(pmsFirstLegFeeSubtotal(batch.fees, currency), currency)}</span></div>`).join('')}</div></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">节点推进</h3><div class="mt-3 flex flex-wrap gap-2">${advanceButtons || '<span class="text-xs text-slate-500">已完成，无后续动作</span>'}<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-${EVENT_PREFIX}-action="open-edit" data-batch-no="${escapeHtml(batchNo)}" data-skip-page-rerender="true" ${batch.status === '待起运' ? '' : 'disabled'}>编辑计划与费用</button></div><label class="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">推进备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(note)}" placeholder="选填，如柜号、船名" data-${EVENT_PREFIX}-advance-note data-skip-page-rerender="true" /></label><p class="mt-2 text-xs text-slate-500">到仓动作会同步签收已加入头程的物流记录；已完成不可回退。</p></section>
    <section><h3 class="mb-2 text-sm font-semibold">物流记录（${batch.records.length}）</h3><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 720px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">物料 / 采购单</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">卷数</th><th class="px-3 py-2">箱数</th></tr></thead><tbody>${recordsHtml}</tbody></table></div></section>
  </div></section></div>`
}

function renderCreateOverlay(): string {
  const joinable = listPmsJoinableLogisticsRows()
  const carriers = listPmsFirstLegCarriers().filter((carrier) => carrier.status === '启用')
  const channels = listPmsFirstLegChannels().filter((channel) => channel.status === '启用')
  const carrierOptions = carriers.map((carrier) => `<option value="${escapeHtml(carrier.carrierCode)}">${escapeHtml(carrier.shortName)} · ${escapeHtml(carrier.carrierName)}</option>`).join('')
  const channelOptions = channels.map((channel) => `<option value="${escapeHtml(channel.channelCode)}" data-carrier-id="${escapeHtml(channel.carrierId)}">${escapeHtml(channel.channelName)} · ${channel.transportMethod} · ${channel.estimatedTransitDays}天</option>`).join('')
  const defaultBatchNo = `FL-2026-${String(listPmsFirstLegBatches().length + 1).padStart(4, '0')}`
  const rowsHtml = joinable.length
    ? joinable.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2"><input type="checkbox" data-${EVENT_PREFIX}-create-check="${escapeHtml(item.record.recordNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2 text-sm">${escapeHtml(item.record.trackingNo)}</td><td class="px-3 py-2"><div class="flex items-center gap-2">${renderPmsBusinessImage(getPmsMaterial(item.record.materialCode)?.imageUrl ?? '', `${item.record.materialName}（${item.record.materialCode}）实物图`, 'h-9 w-9')}<div class="text-sm">${escapeHtml(item.record.materialName)}<div class="text-xs text-slate-500">${escapeHtml(item.record.purchaseOrderNo)}</div></div></div></td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(item.joinableQty, item.record.unit)}</td><td class="px-3 py-2 text-sm tabular-nums">${item.joinableRolls}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${item.joinableQty}" data-${EVENT_PREFIX}-create-qty="${escapeHtml(item.record.recordNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-20 rounded-md border px-2 text-sm" type="number" min="0" step="1" value="${item.joinableRolls}" data-${EVENT_PREFIX}-create-rolls="${escapeHtml(item.record.recordNo)}" data-skip-page-rerender="true" /></td></tr>`).join('')
    : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">没有可加入头程的国内物流记录（需先在国内物流签收）</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="新建头程单" data-pms-fls-create-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭新建"></button><section class="relative z-10 flex h-full w-[920px] max-w-[97vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">新建头程物流单</h2><p class="mt-1 text-xs text-slate-500">勾选国内物流记录，填写加入数量与卷数；单号不可重复</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程物流单号<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(defaultBatchNo)}" data-${EVENT_PREFIX}-create-field="batchNo" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">计划起运日期<input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-06-20" data-${EVENT_PREFIX}-create-field="plannedShipDate" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">物流商<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="carrierId" data-skip-page-rerender="true">${carrierOptions}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">渠道<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="channelId" data-skip-page-rerender="true">${channelOptions}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程费用（RMB）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="0" data-${EVENT_PREFIX}-create-field="fee" data-skip-page-rerender="true" /></label>
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

function renderOverlays(): string {
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
      showHeader: false,
    title: '头程物流',
    feedbackHtml: `${targetBanner}${renderPmsFeedback(state.feedback, state.feedbackOk)}`,
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条${state.selectedBatchNos.length ? ` · 已选 ${state.selectedBatchNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">状态：待起运 → 已装柜 → 头程中 → 已到仓 → 已完成</span>${renderSecondaryButton('批量装柜', { prefix: EVENT_PREFIX, action: 'batch-load' }, 'list-checks').replace('<button', `<button ${state.selectedBatchNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('批量确认出运', { prefix: EVENT_PREFIX, action: 'batch-ship' }, 'check-check').replace('<button', `<button ${state.selectedBatchNos.length === 0 ? 'disabled' : ''}`)}${renderPrimaryButton('新建头程单', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-fls-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-fls-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-fls-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
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
      return [row.batchNo, row.batchName, row.carrierName, row.channelName, row.transportMethod, row.status, row.transferCenter, row.destinationWarehouse, row.plannedShipDate, row.billOfLadingNo, row.shippingLineName, row.cargoType, row.sourceRegion, row.warehouse, row.area, row.logisticsCompany, row.inboundStatus, row.estimatedArrivalAt, row.containerLoadedAt, row.actualShipDate, row.arrivedAt, row.completedAt, row.records.length, row.records.reduce((sum, record) => sum + record.qty, 0), row.records.reduce((sum, record) => sum + record.rolls, 0), aggregate.boxCount ?? '', aggregate.totalWeightKg ?? '', aggregate.totalVolumeM3 ?? '', aggregate.transitDays ?? '', row.fee, ...PMS_FIRST_LEG_FEE_FIELDS.map((field) => row.fees[field.key]), pmsFirstLegFeeSubtotal(row.fees, 'RMB'), pmsFirstLegFeeSubtotal(row.fees, 'USD'), pmsFirstLegFeeSubtotal(row.fees, 'IDR')]
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
    .map((channel) => `<option value="${escapeHtml(channel.channelCode)}">${escapeHtml(channel.channelName)} · ${channel.transportMethod} · ${channel.estimatedTransitDays}天</option>`)
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

function submitCreate(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-create-root]')
  if (!surface) return
  const checked = [...surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-check]`)].filter((input) => input.checked)
  if (checked.length === 0) {
    state.overlayError = '请至少勾选一条国内物流记录加入头程'
    refreshOverlays()
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
    const batch = createPmsFirstLegBatch(
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
    refreshOverlays()
  }
}

function submitEdit(batchNo: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-edit-root]')
  if (!surface) return
  const fee = readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="fee"]`)
  try {
    updatePmsFirstLegBatch(
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
    refreshOverlays()
  }
}

export function renderPmsFirstLegShipmentsPage(): string {
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

export function handlePmsFirstLegShipmentsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeTopOverlay()
    return true
  }

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
    refreshAll()
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
        ? batchLoadPmsFirstLegBatches(state.selectedBatchNos, PMS_BUYER_ACTOR)
        : batchShipPmsFirstLegBatches(state.selectedBatchNos, PMS_BUYER_ACTOR)
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
    if (state.overlay?.kind === 'edit') submitEdit(state.overlay.batchNo)
    return true
  }
  if (action === 'submit-create') {
    submitCreate()
    return true
  }
  if (action === 'advance-status') {
    const batchNo = actionNode?.dataset.batchNo || ''
    const nextStatus = actionNode?.dataset.nextStatus as PmsFirstLegBatchStatus | undefined
    if (!nextStatus) return true
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-fls-overlays]')
    const note = surface ? readTextField(surface, `[data-${EVENT_PREFIX}-advance-note]`) : ''
    try {
      advancePmsFirstLegBatchStatus(batchNo, nextStatus, PMS_BUYER_ACTOR, note)
      state.feedback = `${batchNo} 已推进为${nextStatus}。`
      state.feedbackOk = true
      state.overlay = { kind: 'detail', batchNo, clientActionId: nextPmsActionId('pms-fls-detail'), note: '' }
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '状态推进失败'
      refreshOverlays()
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
