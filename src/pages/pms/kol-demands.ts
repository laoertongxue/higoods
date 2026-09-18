// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  getPmsKolDemand,
  inboundPmsKolDemand,
  listPmsKolDemands,
  listPmsKolLogs,
  rejectPmsKolDemand,
  updatePmsKolRemark,
  type PmsKolDemand,
  type PmsKolDemandStatus,
} from '../../data/pms/purchase-suggestions.ts'
import { getPmsProductSkuRow } from '../../data/pms/product-skus.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
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

type KolOverlay =
  | null
  | { kind: 'detail'; demandNo: string; clientActionId: string }
  | { kind: 'inbound'; demandNos: string[]; clientActionId: string; overConfirm: boolean }
  | { kind: 'reject'; demandNos: string[]; clientActionId: string; batch: boolean }
  | { kind: 'remark'; demandNo: string; clientActionId: string }

interface KolPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsKolDemandStatus
  selectedDemandNos: string[]
  overlay: KolOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-kol'
const ROOT_SELECTOR = '[data-pms-kol-root]'

const state: KolPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  selectedDemandNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsKolDemand[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsKolDemands().filter((demand) => {
    if (state.status && demand.status !== state.status) return false
    if (!keyword) return true
    return [demand.demandNo, demand.sku, demand.productName, demand.applicant].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsKolDemandStatus): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '待入库') return 'yellow'
  if (status === '部分入库') return 'blue'
  if (status === '全部入库') return 'green'
  if (status === '已驳回') return 'red'
  return 'slate'
}

const columns: StandardListColumn<PmsKolDemand>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.filter((row) => row.status === '待入库' || row.status === '部分入库').map((row) => row.demandNo), new Set(state.selectedDemandNos), EVENT_PREFIX),
    render: (row) => {
      const disabled = row.status !== '待入库' && row.status !== '部分入库'
      return `<input type="checkbox" aria-label="选择 ${escapeHtml(row.demandNo)}" data-${EVENT_PREFIX}-field="select-row" data-demand-no="${escapeHtml(row.demandNo)}" ${state.selectedDemandNos.includes(row.demandNo) ? 'checked' : ''} ${disabled ? 'disabled' : ''} data-skip-page-rerender="true" />`
    },
  },
  {
    key: 'demand',
    title: '需求单',
    width: 200,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.demandNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.demandNo)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.applicant)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.appliedAt)}</div>`,
  },
  {
    key: 'product',
    title: '款式与 SKU',
    width: 260,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.imageUrl, `${row.productName}（${row.sku}）款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.spu)}</div><div class="text-xs text-slate-500">${escapeHtml(row.sku)} · ${escapeHtml(row.color)} / ${escapeHtml(row.size)}</div></div></div>`,
  },
  {
    key: 'qty',
    title: '申请 / 已入库 / 待入库',
    width: 210,
    render: (row) => {
      const remaining = Math.max(0, row.applyQty - row.inboundQty)
      return `<div class="space-y-1 text-sm"><div>申请 <strong class="tabular-nums">${formatPmsQty(row.applyQty, '件')}</strong></div><div>已入库 <strong class="tabular-nums">${formatPmsQty(row.inboundQty, '件')}</strong></div><div class="${remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}">待入库 <strong class="tabular-nums">${formatPmsQty(remaining, '件')}</strong></div></div>`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, statusTone(row.status)),
  },
  {
    key: 'remark',
    title: '备注 / 驳回原因',
    width: 220,
    render: (row) => `<div class="text-xs text-slate-600">${escapeHtml(row.remark || '—')}</div>${row.rejectReason ? `<div class="mt-1 text-xs text-red-700">驳回：${escapeHtml(row.rejectReason)}</div>` : ''}`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 230,
    actionColumn: true,
    render: (row) => {
      const canInbound = row.status === '待入库' || row.status === '部分入库'
      const canReject = canInbound || row.status === '草稿'
      return `<div class="flex items-center justify-end gap-1.5">
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-demand-no="${escapeHtml(row.demandNo)}" data-skip-page-rerender="true">明细</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-remark" data-demand-no="${escapeHtml(row.demandNo)}" data-skip-page-rerender="true">备注</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-inbound" data-demand-no="${escapeHtml(row.demandNo)}" data-skip-page-rerender="true" ${canInbound ? '' : 'disabled'}>入库</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-reject" data-demand-no="${escapeHtml(row.demandNo)}" data-skip-page-rerender="true" ${canReject ? '' : 'disabled'}>驳回</button>
      </div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/kol-demands',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-kol-table-surface]',
  paginationSurfaceSelector: '[data-pms-kol-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-kol-overlays]',
  defaultFrozenKeys: ['demand', 'product'],
  columnSettingsTitle: 'KOL 采购需求列设置',
  emptyText: '当前条件下暂无 KOL 采购需求',
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
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="open-batch-inbound"]`).forEach((button) => {
    button.disabled = state.selectedDemandNos.length === 0
  })
  const rejectDisabled = state.selectedDemandNos.filter((no) => isRejectable(no)).length === 0
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="open-batch-reject"]`).forEach((button) => {
    button.disabled = rejectDisabled
  })
  const count = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selected-count]`)
  if (count) count.textContent = `已选 ${state.selectedDemandNos.length} 张待处理需求`
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedDemandNos.length ? ` · 已选 ${state.selectedDemandNos.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

const STATUS_OPTIONS: Array<'' | PmsKolDemandStatus> = ['', '草稿', '待入库', '部分入库', '全部入库', '已驳回']

function renderFilters(): string {
  const statusOptions = STATUS_OPTIONS.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="需求单号 / 款号 / SKU / 申请人" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">需求状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
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
    { label: '需求单总数', value: rows.length },
    { label: '待入库 / 部分入库', value: rows.filter((row) => row.status === '待入库' || row.status === '部分入库').length },
    { label: '待入库数量', value: formatPmsQty(rows.reduce((sum, row) => sum + Math.max(0, row.applyQty - row.inboundQty), 0), '件') },
    { label: '已驳回', value: rows.filter((row) => row.status === '已驳回').length },
  ])
}

function renderDetailOverlay(demandNo: string): string {
  const demand = getPmsKolDemand(demandNo)
  if (!demand) return ''
  const logs = listPmsKolLogs(demandNo)
  const inboundRecords = demand.inboundRecords.length
    ? demand.inboundRecords.map((record) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(record.recordNo)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(record.qty, '件')}</td><td class="px-3 py-2 text-sm">${escapeHtml(record.actorName)}</td><td class="px-3 py-2 text-sm">${formatPmsTime(record.occurredAt)}</td><td class="px-3 py-2 text-xs text-slate-500">${escapeHtml(record.note || '—')}</td></tr>`).join('')
    : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="5">暂无入库记录</td></tr>'
  const logRows = logs.length
    ? logs.map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></li>`).join('')
    : '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="KOL 需求明细"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭明细"></button><section class="relative z-10 flex h-full w-[720px] max-w-[92vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div class="flex items-center gap-3">${renderPmsBusinessImage(demandStyleImage(demand), `${demand.productName}（${demand.sku}）款式图`, 'h-10 w-10')}<div><h2 class="font-semibold">${escapeHtml(demand.demandNo)} · ${escapeHtml(demand.productName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(demand.sku)} · ${escapeHtml(demand.color)} / ${escapeHtml(demand.size)} · 申请人 ${escapeHtml(demand.applicant)}</p></div></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(demand.imageUrl, `${demand.productName}（${demand.sku}）款式图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(demand.status, statusTone(demand.status))}</dd></div><div><dt class="text-xs text-muted-foreground">申请数量</dt><dd class="mt-1 font-semibold tabular-nums">${formatPmsQty(demand.applyQty, '件')}</dd></div><div><dt class="text-xs text-muted-foreground">已入库</dt><dd class="mt-1 font-semibold tabular-nums">${formatPmsQty(demand.inboundQty, '件')}</dd></div><div class="col-span-3"><dt class="text-xs text-muted-foreground">备注</dt><dd class="mt-1 text-slate-600">${escapeHtml(demand.remark || '—')}</dd></div>${demand.rejectReason ? `<div class="col-span-3"><dt class="text-xs text-muted-foreground">驳回原因</dt><dd class="mt-1 text-red-700">${escapeHtml(demand.rejectReason)}</dd></div>` : ''}</dl></div>
    <section><h3 class="mb-2 text-sm font-semibold">入库记录</h3><div class="overflow-hidden rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">记录号</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">操作人</th><th class="px-3 py-2">时间</th><th class="px-3 py-2">说明</th></tr></thead><tbody>${inboundRecords}</tbody></table></div></section>
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logRows}</ul></section>
  </div></section></div>`
}

function renderInboundOverlay(overlay: Extract<NonNullable<KolOverlay>, { kind: 'inbound' }>): string {
  const demands = overlay.demandNos.map((demandNo) => getPmsKolDemand(demandNo)).filter((demand): demand is PmsKolDemand => Boolean(demand))
  const rowsHtml = demands
    .map((demand) => {
      const remaining = Math.max(0, demand.applyQty - demand.inboundQty)
      return `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(demand.demandNo)}</td><td class="px-3 py-2 text-sm">${escapeHtml(demand.productName)}<div class="text-xs text-slate-500">${escapeHtml(demand.sku)} · ${escapeHtml(demand.color)} / ${escapeHtml(demand.size)}</div></td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(demand.inboundQty, '件')}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(remaining, '件')}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="1" step="1" value="${overlay.demandNos.length === 1 ? remaining : 0}" data-${EVENT_PREFIX}-inbound-qty="${escapeHtml(demand.demandNo)}" data-skip-page-rerender="true" /></td></tr>`
    })
    .join('')
  const overHint = overlay.overConfirm
    ? '<div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">入库数量超过待入库数量，请确认后再次点击“确认入库”。</div>'
    : ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="KOL 需求入库" data-pms-kol-inbound-root><section class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">KOL 需求入库</h2><p class="mt-1 text-xs text-slate-500">${demands.length > 1 ? '批量入库不允许超量；' : ''}入库数量按实际可得件数填写</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">${renderPmsOverlayError(state.overlayError)}${overHint}
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-40 px-3 py-2">需求单</th><th class="w-56 px-3 py-2">款式 / SKU</th><th class="w-24 px-3 py-2">已入库</th><th class="w-24 px-3 py-2">待入库</th><th class="w-28 px-3 py-2">本次入库</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">入库说明
      <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如首批发货、返场首单" data-${EVENT_PREFIX}-inbound-note data-skip-page-rerender="true" />
    </label>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认入库', { prefix: EVENT_PREFIX, action: 'submit-inbound' }, 'check-check')}</footer></section></div>`
}

function isRejectable(demandNo: string): boolean {
  const demand = getPmsKolDemand(demandNo)
  return Boolean(demand && demand.status !== '已驳回' && demand.status !== '全部入库')
}

function demandStyleImage(demand: PmsKolDemand): string {
  return demand.imageUrl || getPmsProductSkuRow('garment', demand.spu)?.imageUrl || getPmsProductSkuRow('sample', demand.spu)?.imageUrl || ''
}

function renderRejectOverlay(demandNos: string[]): string {
  const first = getPmsKolDemand(demandNos[0] ?? '')
  if (!first) return ''
  const title = demandNos.length === 1 ? `驳回 ${demandNos[0]}` : `批量驳回 ${demandNos.length} 张需求`
  const summary = demandNos.length === 1
    ? `${escapeHtml(first.productName)} · 申请 ${formatPmsQty(first.applyQty, '件')}`
    : demandNos.map((no) => escapeHtml(no)).join('、')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="驳回 KOL 需求" data-pms-kol-reject-root><section class="w-full max-w-lg rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${title}</h2><p class="mt-1 text-xs text-slate-500">${summary}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-3 p-4">${renderPmsOverlayError(state.overlayError)}<label class="flex flex-col gap-1 text-xs text-muted-foreground">驳回原因（必填）
    <textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" placeholder="说明为什么驳回，方便运营调整直播计划" data-${EVENT_PREFIX}-reject-reason data-skip-page-rerender="true"></textarea>
  </label></div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认驳回', { prefix: EVENT_PREFIX, action: 'submit-reject' }, 'check-check')}</footer></section></div>`
}

function renderRemarkOverlay(demandNo: string): string {
  const demand = getPmsKolDemand(demandNo)
  if (!demand) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="KOL 需求备注" data-pms-kol-remark-root><section class="w-full max-w-lg rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">备注 ${escapeHtml(demandNo)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(demand.productName)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-3 p-4">${renderPmsOverlayError(state.overlayError)}<label class="flex flex-col gap-1 text-xs text-muted-foreground">备注
    <textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" data-${EVENT_PREFIX}-remark-text data-skip-page-rerender="true">${escapeHtml(demand.remark)}</textarea>
  </label></div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存备注', { prefix: EVENT_PREFIX, action: 'submit-remark' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-kol-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.demandNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'inbound') return `${columnSettings}${renderInboundOverlay(state.overlay)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'reject') return `${columnSettings}${renderRejectOverlay(state.overlay.demandNos)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderRemarkOverlay(state.overlay.demandNo)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: 'KOL 采购需求',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条${state.selectedDemandNos.length ? ` · 已选 ${state.selectedDemandNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">草稿与已驳回需求不计入商品采购建议缺口</span><span class="text-xs text-muted-foreground" data-pms-kol-selected-count>已选 ${state.selectedDemandNos.length} 张待处理需求</span>${renderSecondaryButton('批量驳回', { prefix: EVENT_PREFIX, action: 'open-batch-reject' }, 'list-checks').replace('<button', `<button ${state.selectedDemandNos.filter((no) => isRejectable(no)).length === 0 ? 'disabled' : ''}`)}${renderPrimaryButton('批量入库', { prefix: EVENT_PREFIX, action: 'open-batch-inbound' }, 'list-checks').replace('<button', `<button ${state.selectedDemandNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-kol-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-kol-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-kol-overlays>${renderOverlays()}</div>`,
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
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-overlays]')
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
    state.feedback = '当前查询条件下没有可导出的 KOL 需求。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    'KOL采购需求.csv',
    ['需求单号', '款式', 'SPU', 'SKU', '颜色', '尺码', '申请人', '申请数量', '已入库', '待入库', '状态', '备注', '驳回原因'],
    rows.map((row) => [row.demandNo, row.productName, row.spu, row.sku, row.color, row.size, row.applicant, row.applyQty, row.inboundQty, Math.max(0, row.applyQty - row.inboundQty), row.status, row.remark, row.rejectReason]),
  )
  state.feedback = `已导出 ${rows.length} 条 KOL 需求（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function submitInbound(overlay: Extract<NonNullable<KolOverlay>, { kind: 'inbound' }>): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-inbound-root]')
  if (!surface) return
  const note = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-inbound-note]`)
  const entries: Array<{ demandNo: string; qty: number }> = []
  surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-inbound-qty]`).forEach((input) => {
    entries.push({ demandNo: input.dataset.pmsKolInboundQty || '', qty: Number.parseInt(input.value, 10) })
  })
  const invalid = entries.find((entry) => !Number.isInteger(entry.qty) || entry.qty <= 0)
  if (invalid) {
    state.overlayError = '入库数量必须是大于 0 的整数；没有到货的需求请留空或取消本次入库。'
    refreshOverlays()
    return
  }
  if (overlay.demandNos.length > 1) {
    const over = entries.find((entry) => {
      const demand = getPmsKolDemand(entry.demandNo)
      return demand ? entry.qty > demand.applyQty - demand.inboundQty : false
    })
    if (over) {
      state.overlayError = `批量入库不允许超量：${over.demandNo} 超出待入库数量。`
      refreshOverlays()
      return
    }
  }
  try {
    const results = entries.map((entry) => inboundPmsKolDemand(entry.demandNo, { qty: entry.qty, note, overConfirm: overlay.overConfirm }, PMS_BUYER_ACTOR))
    const totalQty = results.reduce((sum, demand) => sum + demand.inboundRecords[0].qty, 0)
    state.feedback = `已完成 ${results.length} 张 KOL 需求入库，合计 ${formatPmsQty(totalQty, '件')}。`
    state.feedbackOk = true
    state.selectedDemandNos = state.selectedDemandNos.filter((no) => !overlay.demandNos.includes(no))
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    if (error instanceof PmsDomainError && error.code === 'KOL_OVER_CONFIRM_REQUIRED') {
      state.overlayError = error.message
      state.overlay = { ...overlay, overConfirm: true }
      refreshOverlays()
      return
    }
    state.overlayError = error instanceof PmsDomainError ? error.message : 'KOL 入库失败，请检查填写内容'
    refreshOverlays()
  }
}

function submitReject(overlay: Extract<NonNullable<KolOverlay>, { kind: 'reject' }>): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-reject-root]')
  if (!surface) return
  const reason = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-reject-reason]`)
  if (!reason.trim()) {
    state.overlayError = '驳回必须填写原因'
    refreshOverlays()
    return
  }
  const failed: string[] = []
  overlay.demandNos.forEach((demandNo) => {
    try {
      rejectPmsKolDemand(demandNo, reason, PMS_BUYER_ACTOR)
    } catch {
      failed.push(demandNo)
    }
  })
  const succeeded = overlay.demandNos.length - failed.length
  if (succeeded === 0) {
    state.overlayError = `驳回失败：${failed.join('、')}`
    refreshOverlays()
    return
  }
  state.feedback = failed.length > 0
    ? `已驳回 ${succeeded} 张需求；${failed.join('、')} 驳回失败已跳过。`
    : overlay.batch
      ? `已批量驳回 ${succeeded} 张需求，不再计入采购建议缺口。`
      : `已驳回 ${overlay.demandNos[0]}，该需求不再计入采购建议缺口。`
  state.feedbackOk = failed.length === 0
  state.selectedDemandNos = state.selectedDemandNos.filter((no) => !overlay.demandNos.includes(no))
  state.overlay = null
  state.overlayError = ''
  refreshAll()
}

function submitRemark(overlay: Extract<NonNullable<KolOverlay>, { kind: 'remark' }>): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-remark-root]')
  if (!surface) return
  const remark = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-remark-text]`)
  try {
    updatePmsKolRemark(overlay.demandNo, remark, PMS_BUYER_ACTOR)
    state.feedback = `已更新 ${overlay.demandNo} 的备注。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存备注失败'
    refreshOverlays()
  }
}

export function renderPmsKolDemandsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-kol-root data-skip-page-rerender="true"><style>[data-pms-kol-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsKolDemandsOverlays(): boolean {
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

export function handlePmsKolDemandsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsKolField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as KolPageState['status']
      return true
    }
    if (fieldName === 'select-row') {
      const demandNo = field.dataset.demandNo || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedDemandNos = [...new Set([...state.selectedDemandNos, demandNo])]
      } else {
        state.selectedDemandNos = state.selectedDemandNos.filter((no) => no !== demandNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') {
        state.selectedDemandNos = []
      } else if (scope === 'page') {
        state.selectedDemandNos = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`) ?? [])].filter((box) => !box.disabled).map((box) => box.dataset.demandNo || '')
      } else {
        state.selectedDemandNos = filteredRows().filter((row) => row.status === '待入库' || row.status === '部分入库').map((row) => row.demandNo)
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

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsKolAction
  if (!action) return false

  if (action === 'toggle-page') {
    const checked = actionNode instanceof HTMLInputElement && actionNode.checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const demandNo = box.dataset.demandNo || ''
      if (checked) {
        if (!box.disabled) state.selectedDemandNos = [...new Set([...state.selectedDemandNos, demandNo])]
      } else {
        state.selectedDemandNos = state.selectedDemandNos.filter((no) => no !== demandNo)
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
    state.selectedDemandNos = []
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-kol-column-key]')?.dataset.pmsKolColumnKey || ''
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
    state.overlay = { kind: 'detail', demandNo: actionNode?.dataset.demandNo || '', clientActionId: nextPmsActionId('pms-kol-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-inbound') {
    state.overlay = { kind: 'inbound', demandNos: [actionNode?.dataset.demandNo || ''], clientActionId: nextPmsActionId('pms-kol-inbound'), overConfirm: false }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-batch-inbound') {
    if (state.selectedDemandNos.length === 0) return true
    state.overlay = { kind: 'inbound', demandNos: [...state.selectedDemandNos], clientActionId: nextPmsActionId('pms-kol-batch'), overConfirm: false }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-reject') {
    state.overlay = { kind: 'reject', demandNos: [actionNode?.dataset.demandNo || ''], clientActionId: nextPmsActionId('pms-kol-reject'), batch: false }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-batch-reject') {
    const rejectable = state.selectedDemandNos.filter((no) => isRejectable(no))
    if (rejectable.length === 0) {
      state.feedback = '所选需求都已驳回或已全部入库，不能驳回。'
      state.feedbackOk = false
      refreshAll()
      return true
    }
    if (rejectable.length < state.selectedDemandNos.length) {
      state.feedback = `已跳过 ${state.selectedDemandNos.length - rejectable.length} 张不可驳回需求（已全部入库/已驳回）。`
      state.feedbackOk = false
      state.selectedDemandNos = rejectable
    }
    state.overlay = { kind: 'reject', demandNos: rejectable, clientActionId: nextPmsActionId('pms-kol-batch-reject'), batch: true }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-remark') {
    state.overlay = { kind: 'remark', demandNo: actionNode?.dataset.demandNo || '', clientActionId: nextPmsActionId('pms-kol-remark') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'submit-inbound') {
    if (state.overlay?.kind === 'inbound') submitInbound(state.overlay)
    return true
  }
  if (action === 'submit-reject') {
    if (state.overlay?.kind === 'reject') submitReject(state.overlay)
    return true
  }
  if (action === 'submit-remark') {
    if (state.overlay?.kind === 'remark') submitRemark(state.overlay)
    return true
  }
  return false
}

export function getPmsKolDemandRowCountForTest(): number {
  return filteredRows().length
}
