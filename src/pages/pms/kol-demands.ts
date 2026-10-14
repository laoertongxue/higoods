// @page-pattern: list
import { refreshPmsCoreRegion, refreshPmsCoreOverlay, setPmsCoreSavePending, handlePmsCoreListControls, renderPmsCorePagination } from './core-interactions.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  getPmsKolDemand,
  hydratePmsPurchaseSuggestionsFromIdb,
  createPmsKolDemand,
  commitPmsKolDemandBatch,
  inboundPmsKolDemand,
  listPmsKolDemands,
  listPmsKolLogs,
  rejectPmsKolDemand,
  updatePmsKolRemark,
  type PmsKolDemand,
  type PmsKolDemandStatus,
} from '../../data/pms/purchase-suggestions.ts'
import { listPmsPurchaseProductCandidates } from '../../data/pms/product-purchase-orders.ts'
import { getPurchaseStyleImage } from '../../data/pms/canonical-purchase-references.ts'
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
  | { kind: 'new'; clientActionId: string; keyword: string; spu: string }
  | { kind: 'audit'; clientActionId: string; demandNos: string[] }
  | { kind: 'batch-remark'; clientActionId: string; demandNos: string[] }

interface KolPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsKolDemandStatus
  statuses: PmsKolDemandStatus[]
  shops: string[]
  positions: string[]
  appliedFrom: string
  appliedTo: string
  inboundFrom: string
  inboundTo: string
  mode: 'SPU' | 'SKU'
  selectedDemandNos: string[]
  overlay: KolOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
  saving: boolean
}

const EVENT_PREFIX = 'pms-kol'
const ROOT_SELECTOR = '[data-pms-kol-root]'

const state: KolPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 5 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  statuses: [], shops: [], positions: [], appliedFrom: '', appliedTo: '', inboundFrom: '', inboundTo: '', mode: 'SPU',
  selectedDemandNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  saving: false,
}

function filteredDemandRows(): PmsKolDemand[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsKolDemands().filter((demand) => {
    if (state.status && demand.status !== state.status) return false
    if (state.statuses.length && !state.statuses.includes(demand.status)) return false
    if (state.shops.length && !state.shops.includes(demand.shop ?? '')) return false
    if (state.positions.length && !state.positions.includes(demand.position ?? '')) return false
    if (state.appliedFrom && demand.appliedAt.slice(0,10) < state.appliedFrom) return false
    if (state.appliedTo && demand.appliedAt.slice(0,10) > state.appliedTo) return false
    const lastInbound = demand.inboundRecords[0]?.occurredAt.slice(0,10) ?? ''
    if (state.inboundFrom && lastInbound < state.inboundFrom) return false
    if (state.inboundTo && (!lastInbound || lastInbound > state.inboundTo)) return false
    if (!keyword) return true
    return [demand.demandNo, demand.spu, demand.sku, demand.productName, demand.applicant, ...(demand.skuLines ?? []).map(line => line.sku)].some(value => value.toLowerCase().includes(keyword))
  })
}
function filteredRows(): PmsKolDemand[] {
  const rows = filteredDemandRows()
  return state.mode === 'SPU' ? rows : rows.flatMap(row => (row.skuLines ?? [{sku:row.sku,color:row.color,size:row.size,imageUrl:row.imageUrl,applyQty:row.applyQty,inboundQty:row.inboundQty,remark:row.remark}]).map(line => ({...row,...line,skuLines:[line]})))
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
    renderHeader: (rows) => renderProcessSelectionHeader([...new Set(rows.map(row => row.demandNo))], new Set(state.selectedDemandNos), EVENT_PREFIX),
    render: (row) => {
      const disabled = false
      return `<input type="checkbox" data-preserve-native-click="true" aria-label="选择 ${escapeHtml(row.demandNo)}" data-${EVENT_PREFIX}-field="select-row" data-demand-no="${escapeHtml(row.demandNo)}" ${state.selectedDemandNos.includes(row.demandNo) ? 'checked' : ''} ${disabled ? 'disabled' : ''} data-skip-page-rerender="true" />`
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
  pageSizeOptions: [5, 10, 20, 50],
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

const STATUS_OPTIONS: Array<'' | PmsKolDemandStatus> = ['', '草稿', '待审核', '待入库', '部分入库', '全部入库', '已驳回', '强制完成']

function renderFilters(): string {
  const statusOptions = STATUS_OPTIONS.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.statuses.length + state.shops.length + state.positions.length + [state.appliedFrom,state.appliedTo,state.inboundFrom,state.inboundTo].filter(Boolean).length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="需求单号 / 款号 / SKU / 申请人" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">模式</span><select class="h-9 w-full rounded border px-3 text-sm" data-${EVENT_PREFIX}-field="mode" data-skip-page-rerender="true"><option value="SPU" ${state.mode==='SPU'?'selected':''}>SPU</option><option value="SKU" ${state.mode==='SKU'?'selected':''}>SKU</option></select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    ${renderKolMultiFilter('statuses','状态',STATUS_OPTIONS.filter(Boolean))}${renderKolMultiFilter('shops','店铺',[...new Set(listPmsKolDemands().map(row=>row.shop ?? '').filter(Boolean))])}${renderKolMultiFilter('positions','商品定位',[...new Set(listPmsKolDemands().map(row=>row.position ?? '').filter(Boolean))])}
    ${[['appliedFrom','申请开始'],['appliedTo','申请结束'],['inboundFrom','入库开始'],['inboundTo','入库结束']].map(([key,label])=>`<label class="text-xs text-muted-foreground">${label}<input type="date" value="${state[key as 'appliedFrom'|'appliedTo'|'inboundFrom'|'inboundTo']}" class="mt-1 h-9 w-full rounded border px-2 text-sm" data-${EVENT_PREFIX}-field="${key}" data-skip-page-rerender="true" /></label>`).join('')}

    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出需求', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('导出明细', { prefix: EVENT_PREFIX, action: 'export-detail' }, 'download')}
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
    <section><h3 class="mb-2 text-sm font-semibold">SKU申请明细</h3><table class="w-full text-sm"><thead><tr><th>SKU / 颜色 / 尺码</th><th>申请（件）</th><th>已入库（件）</th><th>备注</th></tr></thead><tbody>${(demand.skuLines ?? [{sku:demand.sku,color:demand.color,size:demand.size,applyQty:demand.applyQty,inboundQty:demand.inboundQty,remark:demand.remark}]).map(line=>`<tr class="border-t"><td class="p-2">${escapeHtml(line.sku)} · ${escapeHtml(line.color)} / ${escapeHtml(line.size)}</td><td>${line.applyQty}</td><td>${line.inboundQty}</td><td>${escapeHtml(line.remark||'')}</td></tr>`).join('')}</tbody></table><p class="mt-2 text-sm">店铺 ${escapeHtml(demand.shop||'未填写')} · ${escapeHtml(demand.position||'未填写')} · ${formatPmsTime(demand.appliedAt)}</p></section><section><h3 class="mb-2 text-sm font-semibold">入库记录</h3><div class="overflow-hidden rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">记录号</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">操作人</th><th class="px-3 py-2">时间</th><th class="px-3 py-2">说明</th></tr></thead><tbody>${inboundRecords}</tbody></table></div></section>
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logRows}</ul></section>
  </div></section></div>`
}

function renderInboundOverlay(overlay: Extract<NonNullable<KolOverlay>, { kind: 'inbound' }>): string {
  const demands = overlay.demandNos.map((demandNo) => getPmsKolDemand(demandNo)).filter((demand): demand is PmsKolDemand => Boolean(demand))
  const rowsHtml = demands.flatMap(demand => (demand.skuLines ?? [{ sku: demand.sku, color: demand.color, size: demand.size, applyQty: demand.applyQty, inboundQty: demand.inboundQty }]).map(line => {
    const remaining = Math.max(0, line.applyQty - line.inboundQty)
    return `<tr class="border-b"><td class="px-3 py-2 text-sm">${escapeHtml(demand.demandNo)}</td><td class="px-3 py-2 text-sm">${escapeHtml(demand.productName)}<div class="text-xs">${escapeHtml(line.sku)} · ${escapeHtml(line.color)} / ${escapeHtml(line.size)}</div></div></div></td><td class="px-3 py-2 text-sm">${line.inboundQty}</td><td class="px-3 py-2 text-sm">${remaining}</td><td class="px-3 py-2"><input type="number" min="0" max="${remaining}" step="1" value="${demands.length === 1 ? remaining : 0}" class="h-8 w-24 rounded border px-2" data-${EVENT_PREFIX}-inbound-demand="${escapeHtml(demand.demandNo)}" data-${EVENT_PREFIX}-inbound-sku="${escapeHtml(line.sku)}" /></td></tr>`
  })).join('')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="KOL 需求入库" data-pms-kol-inbound-root><section class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">KOL 需求入库</h2><p class="mt-1 text-xs text-slate-500">按SKU填写本次实际数量，未到货填0；不能超过待入库数量</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">${renderPmsOverlayError(state.overlayError)}
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
  return demand.imageUrl || getPurchaseStyleImage(demand.spu) || ''
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

function renderKolMultiFilter(key: 'statuses' | 'shops' | 'positions', label: string, values: string[]): string {
  const selected = state[key] as string[]
  return `<details class="relative min-w-0 rounded-md border bg-white" data-${EVENT_PREFIX}-multi="${key}"><summary class="cursor-pointer px-3 py-2 text-sm">${label}${selected.length ? `（${selected.length}）` : ''}</summary><div class="absolute z-20 mt-1 max-h-64 min-w-48 overflow-auto rounded-md border bg-white p-3 shadow-lg"><div class="mb-2 flex gap-3"><button type="button" class="text-xs text-blue-700" data-${EVENT_PREFIX}-action="filter-all" data-filter-key="${key}" data-skip-page-rerender="true">全选</button><button type="button" class="text-xs text-blue-700" data-${EVENT_PREFIX}-action="filter-clear" data-filter-key="${key}" data-skip-page-rerender="true">清空</button></div>${values.map(value=>`<label class="flex items-center gap-2 py-1 text-sm"><input type="checkbox" data-preserve-native-click="true" value="${escapeHtml(value)}" data-${EVENT_PREFIX}-multi-field="${key}" ${selected.includes(value)?'checked':''} data-skip-page-rerender="true" />${escapeHtml(value)}</label>`).join('') || '<p class="text-xs text-slate-500">暂无候选</p>'}</div></details>`
}

function renderKolNewSkuRows(spu: string): string {
  const product = listPmsPurchaseProductCandidates().find(row => row.spu === spu)
  if (!product) return '<p class="p-4 text-sm text-slate-500">请选择商品后填写SKU申请数量。</p>'
  return `<div class="mb-3 flex items-center gap-3">${renderPmsBusinessImage(product.imageUrl, product.productName, 'h-12 w-12')}<div class="text-sm font-medium">${escapeHtml(product.productName)}<div class="text-xs text-slate-500">${escapeHtml(product.spu)}</div></div></div><div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b bg-slate-50"><tr><th class="p-2"><input type="checkbox" data-preserve-native-click="true" aria-label="选择全部SKU" data-${EVENT_PREFIX}-action="new-select-all" data-skip-page-rerender="true" /></th><th class="p-2">SKU / 颜色 / 尺码</th><th class="p-2">申请数量（件）</th><th class="p-2">SKU备注</th></tr></thead><tbody>${product.skus.map(line => `<tr class="border-b"><td class="p-2"><input type="checkbox" data-preserve-native-click="true" aria-label="选择 ${escapeHtml(line.sku)}" data-${EVENT_PREFIX}-new-select="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td><td class="p-2"><div class="flex gap-2">${renderPmsBusinessImage(line.imageUrl,`${line.sku} ${line.color} ${line.size}`,'h-10 w-10')}<div>${escapeHtml(line.sku)}<div class="text-xs text-slate-500">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</div></div></div></td><td class="p-2"><input type="number" min="1" step="1" value="1" class="h-9 w-24 rounded border px-2" data-${EVENT_PREFIX}-new-qty="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td><td class="p-2"><input class="h-9 min-w-32 rounded border px-2" data-${EVENT_PREFIX}-new-note="${escapeHtml(line.sku)}" data-skip-page-rerender="true" /></td></tr>`).join('')}</tbody></table></div>`
}

function renderKolNewOverlay(overlay: Extract<NonNullable<KolOverlay>,{kind:'new'}>): string {
  const candidates = listPmsPurchaseProductCandidates(overlay.keyword).slice(0,20)
  const shops = [...new Set(listPmsKolDemands().map(row=>row.shop).filter(Boolean))]
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="新增KOL需求"><button class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" aria-label="关闭" data-skip-page-rerender="true"></button><section class="relative z-10 flex h-full w-[850px] max-w-[96vw] flex-col bg-white"><header class="flex items-center justify-between border-b p-4"><h2 class="font-semibold">新增KOL需求</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4" data-pms-kol-new-root>${renderPmsOverlayError(state.overlayError)}<div class="grid grid-cols-2 gap-3"><label class="text-sm">申请人<input class="mt-1 h-9 w-full rounded border px-2" value="${escapeHtml(PMS_BUYER_ACTOR.name)}" data-${EVENT_PREFIX}-new-field="applicant" data-skip-page-rerender="true" /></label><label class="text-sm">店铺<input class="mt-1 h-9 w-full rounded border px-2" list="pms-kol-shop-options" data-${EVENT_PREFIX}-new-field="shop" data-skip-page-rerender="true" /><datalist id="pms-kol-shop-options">${shops.map(shop=>`<option value="${escapeHtml(shop!)}"></option>`).join('')}</datalist></label><label class="text-sm">申请时间（雅加达）<input type="datetime-local" class="mt-1 h-9 w-full rounded border px-2" value="${new Date().toLocaleString('sv-SE',{timeZone:'Asia/Jakarta'}).slice(0,16).replace(' ','T')}" data-${EVENT_PREFIX}-new-field="appliedAt" data-skip-page-rerender="true" /></label><label class="text-sm">商品定位<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-new-field="position" data-skip-page-rerender="true"><option>测新</option><option>主推</option></select></label><label class="text-sm">是否可售爆款<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-new-field="canSellHot" data-skip-page-rerender="true"><option value="否">否</option><option value="是">是</option></select></label></div><div class="flex gap-2"><input class="h-9 flex-1 rounded border px-2" placeholder="SPU / 商品名称 / SKU" value="${escapeHtml(overlay.keyword)}" data-${EVENT_PREFIX}-new-search data-skip-page-rerender="true" />${renderSecondaryButton('搜索商品',{prefix:EVENT_PREFIX,action:'new-spu-search'},'search')}</div><label class="block text-sm">商品<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-new-field="spu" data-skip-page-rerender="true"><option value="">请选择</option>${candidates.map(row=>`<option value="${escapeHtml(row.spu)}" ${overlay.spu===row.spu?'selected':''}>${escapeHtml(row.spu)} · ${escapeHtml(row.productName)}</option>`).join('')}</select></label><div data-pms-kol-new-skus>${renderKolNewSkuRows(overlay.spu)}</div><label class="block text-sm">申请说明<textarea class="mt-1 min-h-20 w-full rounded border p-2" data-${EVENT_PREFIX}-new-field="remark" data-skip-page-rerender="true"></textarea></label></div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${renderSecondaryButton('保存草稿',{prefix:EVENT_PREFIX,action:'submit-new-draft'},'save')}${renderPrimaryButton('提交申请',{prefix:EVENT_PREFIX,action:'submit-new'},'check')}</footer></section></div>`
}

function renderKolBatchOverlay(overlay: Extract<NonNullable<KolOverlay>,{kind:'audit'|'batch-remark'}>): string {
  const title = overlay.kind === 'audit' ? '审核通过KOL需求' : '批量备注'
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="${title}"><section class="w-full max-w-lg rounded-xl bg-white p-5"><h2 class="font-semibold">${title}</h2><p class="my-3 text-sm">已选${overlay.demandNos.length}张：${escapeHtml(overlay.demandNos.join('、'))}</p>${renderPmsOverlayError(state.overlayError)}${overlay.kind==='audit'?'<p class="text-sm">通过后进入待入库，需求数量将计入采购建议。</p>':''}<textarea class="mt-3 min-h-24 w-full rounded border p-2" aria-label="说明或备注" data-${EVENT_PREFIX}-batch-remark data-skip-page-rerender="true"></textarea><footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${renderPrimaryButton(overlay.kind==='audit'?'审核通过':'保存备注',{prefix:EVENT_PREFIX,action:'submit-batch-extra'},'check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-kol-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'new') return `${columnSettings}${renderKolNewOverlay(state.overlay)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'audit' || state.overlay.kind === 'batch-remark') return `${columnSettings}${renderKolBatchOverlay(state.overlay)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.demandNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'inbound') return `${columnSettings}${renderInboundOverlay(state.overlay)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'reject') return `${columnSettings}${renderRejectOverlay(state.overlay.demandNos)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderRemarkOverlay(state.overlay.demandNo)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({className:'pms-compact-list',
      showHeader: true,
    title: 'KOL 采购需求',
    primaryActionsHtml: renderPrimaryButton('新增KOL需求', { prefix: EVENT_PREFIX, action: 'open-new' }, 'plus'),
    feedbackHtml: `<div data-pms-kol-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-pms-kol-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-pms-kol-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条${state.selectedDemandNos.length ? ` · 已选 ${state.selectedDemandNos.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground" data-pms-kol-selected-count>已选 ${state.selectedDemandNos.length} 张待处理需求</span>${renderSecondaryButton('批量驳回', { prefix: EVENT_PREFIX, action: 'open-batch-reject' }, 'list-checks').replace('<button', `<button ${state.selectedDemandNos.filter((no) => isRejectable(no)).length === 0 ? 'disabled' : ''}`)}${renderPrimaryButton('批量入库', { prefix: EVENT_PREFIX, action: 'open-batch-inbound' }, 'list-checks').replace('<button', `<button ${state.selectedDemandNos.length === 0 ? 'disabled' : ''}`)}${renderSecondaryButton('批量审核通过', {prefix:EVENT_PREFIX,action:'open-batch-audit'},'check')}${renderSecondaryButton('批量备注', {prefix:EVENT_PREFIX,action:'open-batch-remark'},'pencil')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-kol-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-kol-pagination-surface>${renderPmsCorePagination(view.paginationHtml, EVENT_PREFIX, state.currentPage)}</div>`,
    overlaysHtml: `<div data-pms-kol-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  refreshPmsCoreRegion(root, '[data-pms-kol-filters]', renderFilters())
  refreshPmsCoreRegion(root, '[data-pms-kol-stats]', renderStats())
  refreshPmsCoreRegion(root, '[data-pms-kol-feedback]', renderPmsFeedback(state.feedback, state.feedbackOk))
  controller.refresh({ overlays: false })
  refreshOverlays()
  syncBatchButtons()
}

function refreshOverlays(): void {
  refreshPmsCoreOverlay(rootElement(), '[data-pms-kol-overlays]', renderOverlays(), state.overlay?.clientActionId ?? '', state.saving)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(details = false): void {
  const rows = filteredDemandRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的 KOL 需求。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  if (details) {
    downloadPmsCsv('KOL采购需求明细.csv',['需求单','店铺','SPU','SKU','颜色','尺码','申请','入库','备注'],rows.flatMap(row=>(row.skuLines??[{sku:row.sku,color:row.color,size:row.size,applyQty:row.applyQty,inboundQty:row.inboundQty,remark:row.remark}]).map(line=>[row.demandNo,row.shop??'',row.spu,line.sku,line.color,line.size,line.applyQty,line.inboundQty,line.remark])))
    state.feedback = '已生成当前筛选的SKU明细文件'; state.feedbackOk = true; refreshAll(); return
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

async function submitInbound(overlay: Extract<NonNullable<KolOverlay>, { kind: 'inbound' }>): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-inbound-root]')
  if (!surface) return
  const note = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-inbound-note]`)
  const groups = new Map<string, Array<{sku:string;qty:number}>>()
  for(const input of surface.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-inbound-sku]`)) {
    const demandNo=input.getAttribute(`data-${EVENT_PREFIX}-inbound-demand`)!,sku=input.getAttribute(`data-${EVENT_PREFIX}-inbound-sku`)!,qty=Number(input.value)
    if(!Number.isInteger(qty)||qty<0){state.overlayError='入库数量必须为非负整数';refreshOverlays();return}
    const lines=groups.get(demandNo)||[];lines.push({sku,qty});groups.set(demandNo,lines)
  }
  const entries=[...groups].map(([demandNo,lines])=>({demandNo,lines,qty:lines.reduce((sum,line)=>sum+line.qty,0)})).filter(entry=>entry.qty>0)
  if(!entries.length){state.overlayError='请填写本次实际入库数量';refreshOverlays();return}
  try {
    state.saving = true; setPmsCoreSavePending(rootElement(),true)
    const results = await commitPmsKolDemandBatch(entries, '确认入库', note, PMS_BUYER_ACTOR, overlay.clientActionId)
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
    state.overlayError = error instanceof Error ? error.message : 'KOL入库未保存'
  } finally { state.saving = false; refreshOverlays() }
}

async function submitReject(overlay: Extract<NonNullable<KolOverlay>, { kind: 'reject' }>): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-reject-root]')
  if (!surface) return
  const reason = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-reject-reason]`)
  if (!reason.trim()) {
    state.overlayError = '驳回必须填写原因'
    refreshOverlays()
    return
  }
  state.saving = true; setPmsCoreSavePending(rootElement(),true)
  try { await commitPmsKolDemandBatch(overlay.demandNos.map(demandNo=>({demandNo})), '驳回', reason, PMS_BUYER_ACTOR, overlay.clientActionId); state.feedback = `已驳回${overlay.demandNos.length}张需求`; state.feedbackOk = true; state.overlay = null; state.selectedDemandNos = []; refreshAll() }
  catch(error) { state.overlayError = error instanceof Error ? error.message : '驳回未保存' }
  finally { state.saving = false; refreshOverlays() }
}

async function submitRemark(overlay: Extract<NonNullable<KolOverlay>, { kind: 'remark' }>): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-remark-root]')
  if (!surface) return
  const remark = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-remark-text]`)
  try {
    state.saving = true; setPmsCoreSavePending(rootElement(),true)
    await updatePmsKolRemark(overlay.demandNo, remark, PMS_BUYER_ACTOR, overlay.clientActionId)
    state.feedback = `已更新 ${overlay.demandNo} 的备注。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof Error ? error.message : '备注未保存'
  } finally { state.saving = false; refreshOverlays() }
}

export async function renderPmsKolDemandsPage(): Promise<string> {
  try { await hydratePmsPurchaseSuggestionsFromIdb() } catch(error) { state.feedback = error instanceof Error ? error.message : '用户需求不可读取，当前为固定演示记录'; state.feedbackOk = false }
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

export async function handlePmsKolDemandsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
if(target.closest('summary'))return true
   if (state.saving) return true
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (handlePmsCoreListControls(target, EVENT_PREFIX, state, controller, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const multiField = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-multi-field]`)
  if (multiField) {
    const key = multiField.getAttribute(`data-${EVENT_PREFIX}-multi-field`) as 'statuses'|'shops'|'positions'
    const values = [...(multiField.closest('details')?.querySelectorAll<HTMLInputElement>('input:checked') ?? [])].map(input=>input.value)
    if (key === 'statuses') state.statuses = values as PmsKolDemandStatus[]
    else state[key] = values
    return true
  }
  const newField = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-new-field]`)
  if (newField && state.overlay?.kind === 'new') {
    if (newField.getAttribute(`data-${EVENT_PREFIX}-new-field`) === 'spu') {
      state.overlay.spu = newField.value
      refreshPmsCoreRegion(rootElement(), '[data-pms-kol-new-skus]', renderKolNewSkuRows(newField.value))
    }
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsKolField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'mode') { state.mode = field.value === 'SKU' ? 'SKU' : 'SPU'; return true }
    if (['appliedFrom','appliedTo','inboundFrom','inboundTo'].includes(fieldName)) { state[fieldName as 'appliedFrom'|'appliedTo'|'inboundFrom'|'inboundTo'] = field.value; return true }
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

  if (action === 'filter-all' || action === 'filter-clear') {
    const key = actionNode?.dataset.filterKey as 'statuses'|'shops'|'positions'
    const checkboxes = [...(actionNode?.closest('details')?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-preserve-native-click="true"]') ?? [])]
    checkboxes.forEach(input=>{input.checked=action==='filter-all'})
    const values = checkboxes.filter(input=>input.checked).map(input=>input.value)
    if (key === 'statuses') state.statuses = values as PmsKolDemandStatus[]
    else if (key === 'shops' || key === 'positions') state[key] = values
    return true
  }
  if (action === 'open-new') {
    state.overlay = {kind:'new',clientActionId:nextPmsActionId('kol-new'),keyword:'',spu:''}; state.overlayError=''; refreshOverlays(); return true
  }
  if (action === 'new-spu-search' && state.overlay?.kind === 'new') {
    state.overlay.keyword = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-new-search]`)?.value.trim() ?? ''
    refreshOverlays(); return true
  }
  if (action === 'new-select-all') {
    const checked = actionNode instanceof HTMLInputElement && actionNode.checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-new-select]`).forEach(input=>{input.checked=checked})
    return true
  }
  if ((action === 'submit-new' || action === 'submit-new-draft') && state.overlay?.kind === 'new') {
    const overlay = state.overlay
    const form = rootElement()?.querySelector<HTMLElement>('[data-pms-kol-new-root]')
    if (!form) return true
    const read = (key:string)=>readTextField(form,`[data-${EVENT_PREFIX}-new-field="${key}"]`)
    const lines = [...form.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-new-select]:checked`)].map(input=>{
      const sku=input.getAttribute(`data-${EVENT_PREFIX}-new-select`)??''
      return {sku,qty:Number(form.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-new-qty="${CSS.escape(sku)}"]`)?.value),remark:form.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-new-note="${CSS.escape(sku)}"]`)?.value??''}
    })
    state.saving=true;setPmsCoreSavePending(rootElement(),true)
    try { const created=await createPmsKolDemand({draft:action==='submit-new-draft',spu:overlay.spu,applicant:read('applicant'),shop:read('shop'),appliedAt:new Date(`${read('appliedAt')}:00+07:00`).toISOString(),position:read('position'),canSellHot:read('canSellHot')==='是',remark:read('remark'),lines},PMS_BUYER_ACTOR,overlay.clientActionId); state.overlay=null;state.feedback=`${created.status==='草稿'?'草稿已保存':'申请已提交'}：${created.demandNo}，${created.skuLines?.length??1}个SKU/${created.applyQty}件`;state.feedbackOk=true;refreshAll() }
    catch(error){state.overlayError=error instanceof Error?error.message:'需求未保存'}
    finally{state.saving=false;refreshOverlays()}
    return true
  }
  if (action === 'open-batch-audit' || action === 'open-batch-remark') {
    if (!state.selectedDemandNos.length) {state.feedback='请先选择KOL需求';state.feedbackOk=false;refreshAll();return true}
    state.overlay={kind:action==='open-batch-audit'?'audit':'batch-remark',clientActionId:nextPmsActionId('kol-batch'),demandNos:[...new Set(state.selectedDemandNos)]}
    state.overlayError='';refreshOverlays();return true
  }
  if (action === 'submit-batch-extra' && (state.overlay?.kind==='audit'||state.overlay?.kind==='batch-remark')) {
    const overlay=state.overlay
    const remark=rootElement()?.querySelector<HTMLTextAreaElement>(`[data-${EVENT_PREFIX}-batch-remark]`)?.value??''
    state.saving=true;setPmsCoreSavePending(rootElement(),true)
    try {await commitPmsKolDemandBatch(overlay.demandNos.map(demandNo=>({demandNo})),overlay.kind==='audit'?'审核通过':'备注',remark,PMS_BUYER_ACTOR,overlay.clientActionId);state.overlay=null;state.selectedDemandNos=[];state.feedback=overlay.kind==='audit'?'所选需求已审核通过':'所选需求备注已保存';state.feedbackOk=true;refreshAll()}
    catch(error){state.overlayError=error instanceof Error?error.message:'批量操作未保存'}
    finally{state.saving=false;refreshOverlays()}
    return true
  }

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
    state.status = ''; state.statuses = []; state.shops = []; state.positions = []; state.appliedFrom = ''; state.appliedTo = ''; state.inboundFrom = ''; state.inboundTo = ''; state.mode = 'SPU'
    state.selectedDemandNos = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export' || action === 'export-detail') {
    exportRows(action === 'export-detail')
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
    if (state.overlay?.kind === 'inbound') await submitInbound(state.overlay)
    return true
  }
  if (action === 'submit-reject') {
    if (state.overlay?.kind === 'reject') await submitReject(state.overlay)
    return true
  }
  if (action === 'submit-remark') {
    if (state.overlay?.kind === 'remark') await submitRemark(state.overlay)
    return true
  }
  return false
}

export function getPmsKolDemandRowCountForTest(): number {
  return filteredRows().length
}
