// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  listPmsMaterialLogisticsRecords,
  signPmsMaterialLogistics,
  type PmsMaterialLogisticsRecord,
} from '../../data/pms/material-purchase-orders.ts'
import { getPmsMaterial } from '../../data/pms/materials.ts'
import {
  createPmsFirstLegBatch,
  isPmsLogisticsJoinable,
  listPmsFirstLegBatches,
  listPmsFirstLegCarriers,
  listPmsFirstLegChannels,
  type PmsFirstLegAllocationInput,
} from '../../data/pms/first-leg-logistics.ts'
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

type TrackingOverlay = null | { kind: 'join'; recordNos: string[]; clientActionId: string }

interface TrackingPageState extends ProcessOrderListControllerState {
  keyword: string
  domesticFilter: '' | '未签收' | '已签收'
  headFilter: '' | '未加入' | '已加入' | '未签收' | '已签收'
  selectedRecordNos: string[]
  overlay: TrackingOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-mtrk'
const ROOT_SELECTOR = '[data-pms-mtrk-root]'

const state: TrackingPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  domesticFilter: '',
  headFilter: '',
  selectedRecordNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsMaterialLogisticsRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsMaterialLogisticsRecords().filter((record) => {
    if (state.domesticFilter === '未签收' && record.domesticSigned) return false
    if (state.domesticFilter === '已签收' && !record.domesticSigned) return false
    if (state.headFilter === '未加入' && record.headBatchNo) return false
    if (state.headFilter === '已加入' && !record.headBatchNo) return false
    if (state.headFilter === '未签收' && (!record.headBatchNo || record.headSigned)) return false
    if (state.headFilter === '已签收' && !record.headSigned) return false
    if (!keyword) return true
    return [record.trackingNo, record.company, record.purchaseOrderNo, record.materialName, record.styleName, record.headBatchNo].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsMaterialLogisticsRecord>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.map((row) => row.recordNo), new Set(state.selectedRecordNos), EVENT_PREFIX),
    render: (row) => `<input type="checkbox" aria-label="选择 ${escapeHtml(row.trackingNo)}" data-${EVENT_PREFIX}-field="select-row" data-record-no="${escapeHtml(row.recordNo)}" ${state.selectedRecordNos.includes(row.recordNo) ? 'checked' : ''} data-skip-page-rerender="true" />`,
  },
  {
    key: 'record',
    title: '物流记录',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.trackingNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.company)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.trackingNo)}</div><div class="mt-1 text-xs text-slate-500">发货 ${escapeHtml(row.shipDate || '—')} · 预计 ${escapeHtml(row.estimatedArrival || '—')}</div>`,
  },
  {
    key: 'material',
    title: '物料与采购单',
    width: 260,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.materialImageUrl, `${row.materialName}（${row.materialCode}）实物图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.purchaseOrderNo)} · ${escapeHtml(row.unit)}</div><div class="mt-1 flex items-center gap-2 text-xs text-slate-500">${renderPmsBusinessImage(row.styleImageUrl, `${row.styleName}款式图`, 'h-6 w-6')}<span>${escapeHtml(row.styleName)}</span></div></div></div>`,
  },
  {
    key: 'domestic',
    title: '国内物流',
    width: 200,
    render: (row) => `<div class="text-sm tabular-nums">数量 <strong>${formatPmsQty(row.qty, row.unit)}</strong></div><div class="mt-1 text-xs tabular-nums">卷数 ${row.rolls} · 箱数 ${row.boxCount}</div><div class="mt-1 text-xs tabular-nums">运费 ${formatPmsMoney(row.fee)}</div><div class="mt-1">${row.domesticSigned ? renderPmsStatusBadge('国内已签收', 'green') : renderPmsStatusBadge('国内未签收', 'yellow')}</div>`,
  },
  {
    key: 'head',
    title: '头程物流',
    width: 200,
    render: (row) => {
      if (!row.headBatchNo) return renderPmsStatusBadge('未加入头程', 'slate')
      const remaining = Math.max(0, row.qty - row.headLogisticsQty)
      return `<div class="font-medium">${escapeHtml(row.headBatchNo)}</div><div class="mt-1 text-xs tabular-nums">已加入 ${formatPmsQty(row.headLogisticsQty, row.unit)} · 剩余 ${formatPmsQty(remaining, row.unit)}</div><div class="mt-1">${row.headSigned ? renderPmsStatusBadge('头程已签收', 'green') : renderPmsStatusBadge('头程未签收', 'blue')}</div>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    actionColumn: true,
    render: (row) => {
      const joinable = isPmsLogisticsJoinable(row.recordNo)
      return `<div class="flex items-center justify-end gap-1.5">
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="sign-domestic" data-record-no="${escapeHtml(row.recordNo)}" data-skip-page-rerender="true" ${row.domesticSigned ? 'disabled' : ''}>签收</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="join-head" data-record-no="${escapeHtml(row.recordNo)}" data-skip-page-rerender="true" ${joinable ? '' : 'disabled'}>加入头程</button>
      </div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-purchase-tracking',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mtrk-table-surface]',
  paginationSurfaceSelector: '[data-pms-mtrk-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mtrk-overlays]',
  defaultFrozenKeys: ['record', 'material'],
  columnSettingsTitle: '面辅料采购跟踪列设置',
  emptyText: '当前条件下暂无物流记录',
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
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="batch-sign"], [data-${EVENT_PREFIX}-action="open-join"]`).forEach((button) => {
    button.disabled = state.selectedRecordNos.length === 0
  })
  const count = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selected-count]`)
  if (count) count.textContent = `已选 ${state.selectedRecordNos.length} 条`
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedRecordNos.length ? ` · 已选 ${state.selectedRecordNos.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function materialThumbnailUrl(record: PmsMaterialLogisticsRecord): string {
  return getPmsMaterial(record.materialCode)?.imageUrl ?? record.materialImageUrl
}

function renderFilters(): string {
  const domesticOptions = ['', '未签收', '已签收'].map((value) => `<option value="${value}" ${state.domesticFilter === value ? 'selected' : ''}>${value || '全部国内状态'}</option>`).join('')
  const headOptions = ['', '未加入', '已加入', '未签收', '已签收'].map((value) => `<option value="${value}" ${state.headFilter === value ? 'selected' : ''}>${value || '全部头程状态'}</option>`).join('')
  const advancedCount = state.headFilter ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="物流单号 / 公司 / 采购单 / 物料 / 头程单" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">国内物流</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="domesticFilter" data-skip-page-rerender="true">${domesticOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">头程物流</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="headFilter" data-skip-page-rerender="true">${headOptions}</select></label>
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
    { label: '物流记录', value: rows.length },
    { label: '国内未签收', value: rows.filter((row) => !row.domesticSigned).length },
    { label: '头程未签收', value: rows.filter((row) => row.headBatchNo && !row.headSigned).length },
    { label: '头程已到仓', value: rows.filter((row) => row.headSigned).length },
  ])
}

function renderJoinOverlay(recordNos: string[]): string {
  const records = listPmsMaterialLogisticsRecords().filter((record) => recordNos.includes(record.recordNo))
  const carriers = listPmsFirstLegCarriers().filter((carrier) => carrier.status === '启用')
  const channels = listPmsFirstLegChannels().filter((channel) => channel.status === '启用')
  const carrierOptions = carriers.map((carrier) => `<option value="${escapeHtml(carrier.carrierCode)}">${escapeHtml(carrier.shortName)} · ${escapeHtml(carrier.carrierName)}</option>`).join('')
  const channelOptions = channels.map((channel) => `<option value="${escapeHtml(channel.channelCode)}" data-carrier-id="${escapeHtml(channel.carrierId)}">${escapeHtml(channel.channelName)} · ${channel.transportMethod} · ${channel.estimatedTransitDays}天</option>`).join('')
  const existingBatchNos = new Set(listPmsFirstLegBatches().map((batch) => batch.batchNo))
  const defaultBatchNo = `FL-2026-${String(existingBatchNos.size + 1).padStart(4, '0')}`
  const rowsHtml = records
    .map((record) => {
      const remainingQty = Math.max(0, record.qty - record.headLogisticsQty)
      const remainingRolls = Math.max(0, record.rolls - record.headLogisticsRolls)
      return `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(record.trackingNo)}</td><td class="px-3 py-2 text-sm"><div class="flex items-center gap-3">${renderPmsBusinessImage(materialThumbnailUrl(record), `${record.materialName}（${record.materialCode}）实物图`, 'h-10 w-10')}<div><div class="font-medium">${escapeHtml(record.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(record.purchaseOrderNo)}</div></div></div></td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(remainingQty, record.unit)}</td><td class="px-3 py-2 text-sm tabular-nums">${remainingRolls}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${remainingQty}" data-${EVENT_PREFIX}-join-qty="${escapeHtml(record.recordNo)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-20 rounded-md border px-2 text-sm" type="number" min="0" step="1" value="${remainingRolls}" data-${EVENT_PREFIX}-join-rolls="${escapeHtml(record.recordNo)}" data-skip-page-rerender="true" /></td></tr>`
    })
    .join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="加入头程" data-pms-mtrk-join-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭加入头程"></button><section class="relative z-10 flex h-full w-[880px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">加入头程物流单</h2><p class="mt-1 text-xs text-slate-500">已选 ${records.length} 条国内物流；加入数量必须在 0 到剩余数量之间，卷数必须是非负整数</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程物流单号
        <input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(defaultBatchNo)}" data-${EVENT_PREFIX}-join-field="batchNo" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">计划起运日期
        <input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-06-20" data-${EVENT_PREFIX}-join-field="plannedShipDate" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程物流商
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-join-field="carrierId" data-skip-page-rerender="true">${carrierOptions}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">渠道
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-join-field="channelId" data-skip-page-rerender="true">${channelOptions}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">头程费用（RMB）
        <input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="0" data-${EVENT_PREFIX}-join-field="fee" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">备注
        <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-join-field="remark" data-skip-page-rerender="true" />
      </label>
    </div>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 760px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">物料 / 采购单</th><th class="px-3 py-2">剩余数量</th><th class="px-3 py-2">剩余卷数</th><th class="px-3 py-2">加入数量</th><th class="px-3 py-2">加入卷数</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('创建头程单', { prefix: EVENT_PREFIX, action: 'submit-join' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-mtrk-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  return `${columnSettings}${renderJoinOverlay(state.overlay.recordNos)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '面辅料采购跟踪',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条${state.selectedRecordNos.length ? ` · 已选 ${state.selectedRecordNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">国内物流签收后才能加入头程；头程到仓自动签收</span><span class="text-xs text-muted-foreground" data-pms-mtrk-selected-count>已选 ${state.selectedRecordNos.length} 条</span>${renderSecondaryButton('批量签收（国内）', { prefix: EVENT_PREFIX, action: 'batch-sign' }, 'list-checks').replace('<button', `<button ${state.selectedRecordNos.length === 0 ? 'disabled' : ''}`)}${renderPrimaryButton('加入头程', { prefix: EVENT_PREFIX, action: 'open-join' }, 'check-check').replace('<button', `<button ${state.selectedRecordNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-mtrk-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mtrk-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mtrk-overlays>${renderOverlays()}</div>`,
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
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mtrk-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function refreshJoinChannelOptions(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mtrk-join-root]')
  if (!surface) return
  const carrierId = readTextField(surface, `[data-${EVENT_PREFIX}-join-field="carrierId"]`)
  const select = surface.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-join-field="channelId"]`)
  if (!select) return
  select.innerHTML = listPmsFirstLegChannels()
    .filter((channel) => channel.status === '启用' && channel.carrierId === carrierId)
    .map((channel) => `<option value="${escapeHtml(channel.channelCode)}">${escapeHtml(channel.channelName)} · ${channel.transportMethod} · ${channel.estimatedTransitDays}天</option>`)
    .join('')
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的物流记录。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料采购跟踪.csv',
    ['物流记录号', '物流公司', '物流单号', '采购单号', '物料编码', '物料名称', '款式', '单位', '国内数量', '卷数', '箱数', '运费', '国内签收', '头程单号', '头程已加入', '头程签收'],
    rows.map((row) => [row.recordNo, row.company, row.trackingNo, row.purchaseOrderNo, row.materialCode, row.materialName, row.styleName, row.unit, row.qty, row.rolls, row.boxCount, row.fee, row.domesticSigned ? '已签收' : '未签收', row.headBatchNo, row.headLogisticsQty, row.headSigned ? '已签收' : row.headBatchNo ? '未签收' : '未加入']),
  )
  state.feedback = `已导出 ${rows.length} 条物流记录（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function submitJoin(recordNos: string[]): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mtrk-join-root]')
  if (!surface) return
  const batchNo = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-field="batchNo"]`)
  const plannedShipDate = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-field="plannedShipDate"]`)
  const carrierId = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-field="carrierId"]`)
  const channelId = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-field="channelId"]`)
  const fee = readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-field="fee"]`)
  const remark = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-field="remark"]`)
  const allocations: PmsFirstLegAllocationInput[] = recordNos.map((recordNo) => ({
    recordNo,
    qty: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-qty="${recordNo}"]`),
    rolls: readNumberField(surface as ParentNode, `[data-${EVENT_PREFIX}-join-rolls="${recordNo}"]`),
  }))
  try {
    const batch = createPmsFirstLegBatch(
      {
        batchNo,
        batchName: '',
        carrierId,
        channelId,
        transferCenter: '',
        destinationWarehouse: '',
        plannedShipDate,
        fee: Number.isFinite(fee) ? fee : 0,
        remark,
        allocations,
      },
      PMS_BUYER_ACTOR,
    )
    state.feedback = `已创建头程物流单 ${batch.batchNo}（${batch.records.length} 条物流），可在“头程物流”继续装柜与出运。`
    state.feedbackOk = true
    state.selectedRecordNos = []
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '创建头程物流单失败'
    refreshOverlays()
  }
}

export function renderPmsMaterialPurchaseTrackingPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-mtrk-root data-skip-page-rerender="true"><style>[data-pms-mtrk-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsMaterialPurchaseTrackingOverlays(): boolean {
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

export function handlePmsMaterialPurchaseTrackingEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMtrkField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'domesticFilter') {
      state.domesticFilter = field.value as TrackingPageState['domesticFilter']
      return true
    }
    if (fieldName === 'headFilter') {
      state.headFilter = field.value as TrackingPageState['headFilter']
      return true
    }
    if (fieldName === 'select-row') {
      const recordNo = field.dataset.recordNo || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedRecordNos = [...new Set([...state.selectedRecordNos, recordNo])]
      } else {
        state.selectedRecordNos = state.selectedRecordNos.filter((no) => no !== recordNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') {
        state.selectedRecordNos = []
      } else if (scope === 'page') {
        state.selectedRecordNos = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`) ?? [])].map((box) => box.dataset.recordNo || '')
      } else {
        state.selectedRecordNos = filteredRows().map((row) => row.recordNo)
      }
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

  const joinCarrierField = target.closest<HTMLSelectElement>(`[data-${EVENT_PREFIX}-join-field="carrierId"]`)
  if (joinCarrierField) {
    refreshJoinChannelOptions()
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsMtrkAction
  if (!action) return false

  if (action === 'toggle-page') {
    const checked = actionNode instanceof HTMLInputElement && actionNode.checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const recordNo = box.dataset.recordNo || ''
      if (checked) state.selectedRecordNos = [...new Set([...state.selectedRecordNos, recordNo])]
      else state.selectedRecordNos = state.selectedRecordNos.filter((no) => no !== recordNo)
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
    state.domesticFilter = ''
    state.headFilter = ''
    state.selectedRecordNos = []
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-mtrk-column-key]')?.dataset.pmsMtrkColumnKey || ''
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
  if (action === 'sign-domestic') {
    const recordNo = actionNode?.dataset.recordNo || ''
    try {
      signPmsMaterialLogistics([recordNo], 'domestic', PMS_BUYER_ACTOR)
      state.feedback = `物流记录 ${recordNo} 已国内签收。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.feedback = error instanceof PmsDomainError ? error.message : '签收失败'
      state.feedbackOk = false
      refreshAll()
    }
    return true
  }
  if (action === 'batch-sign') {
    try {
      const signed = signPmsMaterialLogistics([...state.selectedRecordNos], 'domestic', PMS_BUYER_ACTOR)
      state.feedback = `已批量签收 ${signed.length} 条国内物流。`
      state.feedbackOk = true
      state.selectedRecordNos = []
      refreshAll()
    } catch (error) {
      state.feedback = error instanceof PmsDomainError ? error.message : '批量签收失败'
      state.feedbackOk = false
      refreshAll()
    }
    return true
  }
  if (action === 'join-head') {
    state.overlay = { kind: 'join', recordNos: [actionNode?.dataset.recordNo || ''], clientActionId: nextPmsActionId('pms-mtrk-join') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-join') {
    if (state.selectedRecordNos.length === 0) return true
    state.overlay = { kind: 'join', recordNos: [...state.selectedRecordNos], clientActionId: nextPmsActionId('pms-mtrk-join') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'submit-join') {
    if (state.overlay?.kind === 'join') submitJoin(state.overlay.recordNos)
    return true
  }
  return false
}

export function getPmsMaterialTrackingRowCountForTest(): number {
  return filteredRows().length
}
