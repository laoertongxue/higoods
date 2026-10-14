import { pmsBusinessNumber } from '../../utils/pms-business-number.ts'
import { createPmsLocalListInteractions } from './local-list-interactions.ts'
// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsKolLockLogRow,
  type PmsKolLockOpType,
  PmsKolLockOpTypeList,
  filterPmsKolLockLog,
  listPmsKolLockLog,
  hydratePmsKolLockLog,
  summarizePmsKolLockLog,
} from '../../data/pms/kol-sample-stock-lock-log.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsFeedback } from './shared.ts'

const EVENT_PREFIX = 'pms-klk'
const ROOT_SELECTOR = '[data-pms-klk-root]'

interface LockLogPageState extends ProcessOrderListControllerState {
  search: string
  opType: '' | '全部' | PmsKolLockOpType
  lockDate: string
  applyId: string
  feedback: string
  feedbackOk: boolean
}

const state: LockLogPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  search: '',
  opType: '全部',
  lockDate: '',
  applyId: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsKolLockLogRow[] {
  return filterPmsKolLockLog({
    search: state.search,
    opType: state.opType,
    lockDate: state.lockDate,
    applyId: state.applyId,
  })
}

function opTypeBadge(op: PmsKolLockOpType): string {
  const colors: Record<PmsKolLockOpType, string> = {
    '手动锁定': 'bg-amber-50 text-amber-700',
    '手动释放': 'bg-emerald-50 text-emerald-700',
    '申请单自动占用': 'bg-blue-50 text-blue-700',
    '驳回释放占用': 'bg-rose-50 text-rose-700',
    '跨日占用归零': 'bg-slate-200 text-slate-600',
  }
  return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs ${colors[op]}">${escapeHtml(op)}</span>`
}

const columns: StandardListColumn<PmsKolLockLogRow>[] = [
  {
    key: 'operatedAt',
    title: '操作时间',
    width: 160,
    required: true,
    sortable: true,
    sortValue: (row) => row.operatedAt,
    render: (row) => `<span class="tabular-nums text-xs">${escapeHtml(row.operatedAt)}</span>`,
  },
  {
    key: 'lockDate',
    title: '锁定日期',
    width: 110,
    render: (row) => `<span class="tabular-nums text-xs">${escapeHtml(row.lockDate)}</span>`,
  },
  {
    key: 'opType',
    title: '操作类型',
    width: 130,
    sortable: true,
    sortValue: (row) => row.opType,
    render: (row) => opTypeBadge(row.opType),
  },
  {
    key: 'skuSpu',
    title: 'SKU / SPU',
    width: 240,
    render: (row) => `<div class="font-medium">${escapeHtml(row.sku)}</div><div class="text-[11px] text-slate-500 font-mono">${escapeHtml(row.spu)}</div>`,
  },
  {
    key: 'deltaQty',
    title: '变化数量',
    width: 110,
    sortable: true,
    sortValue: (row) => row.deltaQty,
    render: (row) => {
      const color = row.deltaQty > 0 ? 'text-emerald-700' : row.deltaQty < 0 ? 'text-rose-700' : 'text-slate-500'
      const sign = row.deltaQty > 0 ? '+' : ''
      return `<span class="tabular-nums font-semibold ${color}">${sign}${row.deltaQty}</span>`
    },
  },
  {
    key: 'manualPool',
    title: '手动锁定池(前 → 后)',
    width: 180,
    render: (row) => `<span class="tabular-nums text-xs">${row.manualPoolBefore} → ${row.manualPoolAfter}</span>`,
  },
  {
    key: 'occupied',
    title: '锁定已占用(前 → 后)',
    width: 180,
    render: (row) => `<span class="tabular-nums text-xs">${row.occupiedBefore} → ${row.occupiedAfter}</span>`,
  },
  {
    key: 'free',
    title: '锁定未占用(前 → 后)',
    width: 180,
    render: (row) => `<span class="tabular-nums text-xs">${row.freeBefore} → ${row.freeAfter}</span>`,
  },
  {
    key: 'related',
    title: '关联申请单 / code',
    width: 240,
    render: (row) => row.relatedApplyId === '-'
      ? '<span class="text-xs text-slate-400">—</span>'
      : `<div class="font-mono text-xs">${escapeHtml(pmsBusinessNumber(row.relatedApplyId))}</div><div class="mt-0.5 font-mono text-[11px] text-slate-500">${row.relatedApplyCode===row.relatedApplyId?'':escapeHtml(row.relatedApplyCode)}</div>`,
  },
  {
    key: 'operator',
    title: '操作人',
    width: 110,
    render: (row) => `<span class="text-xs">${escapeHtml(row.operator)}</span>`,
  },
  {
    key: 'remark',
    title: '备注',
    width: 200,
    render: (row) => `<span class="text-xs text-slate-600">${escapeHtml(row.remark)}</span>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/kol-sample-stock/lock-log',
  pageSizeOptions: [10, 20, 50, 100, 200, 300, 500, 1000],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-klk-table-surface]',
  paginationSurfaceSelector: '[data-pms-klk-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-klk-overlays]',
  defaultFrozenKeys: ['operatedAt'],
  columnSettingsTitle: '锁定操作记录列设置',
  emptyText: '当前条件下暂无锁定操作记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderTopNav(): string {
  return `<nav class="flex flex-wrap gap-2 rounded-lg border bg-white p-3" aria-label="KOL 样衣申请导航">
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-stock">« 返回 KOL库存</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-apply">手动寄样申请</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-link">对外样品池链接</a>
  </nav>`
}

function renderFilters(): string {
  const opTypeOptions = ['全部', ...PmsKolLockOpTypeList]
    .map((opt) => `<option value="${opt}" ${state.opType === opt ? 'selected' : ''}>${opt}</option>`).join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">SKU / SPU / 操作人</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="请输入" value="${escapeHtml(state.search)}" data-${EVENT_PREFIX}-field="search" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">操作类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="opType" data-skip-page-rerender="true">${opTypeOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">锁定日期</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="date" value="${escapeHtml(state.lockDate)}" data-${EVENT_PREFIX}-field="lockDate" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">申请单号</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="KS..." value="${escapeHtml(state.applyId)}" data-${EVENT_PREFIX}-field="applyId" data-skip-page-rerender="true" /></label>
  </div>
  <div class="mt-3 flex w-full flex-wrap items-center gap-2">
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
  </div>
  </div>`
}

function renderStats(): string {
  const stats = summarizePmsKolLockLog({
    search: state.search,
    opType: state.opType,
    lockDate: state.lockDate,
    applyId: state.applyId,
  })
  const items = [
    { label: '记录总数', value: stats.total },
    { label: '手动锁定', value: stats.manualLock },
    { label: '手动释放', value: stats.manualRelease },
    { label: '申请单占用', value: stats.applyOccupy },
    { label: '驳回释放', value: stats.rejectRelease },
    { label: '跨日归零', value: stats.dailyReset },
  ]
  return renderProcessOrderStats(items)
}

function renderOverlays(): string {
  return ''
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: true,
    title: '锁定操作记录',
    feedbackHtml: `<div data-${EVENT_PREFIX}-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-${EVENT_PREFIX}-filters>${`<div class="space-y-2">${renderTopNav()}${renderFilters()}</div>`}</div>`,
    statsHtml: `<div data-${EVENT_PREFIX}-stats>${stats}</div>`,
    listTitle: `共 ${filteredRows().length} 条锁定操作记录`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-klk-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-klk-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-klk-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.getAttribute(`data-${EVENT_PREFIX}-field`)
  if (!field) return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'search': state.search = value; break
    case 'opType': state.opType = value as LockLogPageState['opType']; break
    case 'lockDate': state.lockDate = value; break
    case 'applyId': state.applyId = value; break
  }
}

async function handleActionEvent(target: HTMLElement): Promise<void> {
  const action = target.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (!action) return
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset':
      state.search = ''
      state.opType = '全部'
      state.lockDate = ''
      state.applyId = ''
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    case 'export': {
      const rows = filteredRows()
      downloadPmsCsv(
        'higood-pms-kol-lock-log.csv',
        ['操作时间', '锁定日期', '操作类型', 'SKU', 'SPU', '变化数量', '手动锁定池(前→后)', '锁定已占用(前→后)', '锁定未占用(前→后)', '关联申请单', '申请code', '操作人', '备注'],
        rows.map((r) => [r.operatedAt, r.lockDate, r.opType, r.sku, r.spu, r.deltaQty, `${r.manualPoolBefore}→${r.manualPoolAfter}`, `${r.occupiedBefore}→${r.occupiedAfter}`, `${r.freeBefore}→${r.freeAfter}`, r.relatedApplyId, r.relatedApplyCode, r.operator, r.remark]),
      )
      state.feedback = '已导出锁定操作记录为 CSV'
      state.feedbackOk = true
      break
    }
  }
}

export async function renderPmsKolLockLogPage(): Promise<string> {
  try { ; await hydratePmsKolLockLog() } catch(error) { state.feedback=error instanceof Error?error.message:"用户数据不可读";state.feedbackOk=false }
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true">${renderBody()}</div>`
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
    local.mount()
  })
  return html
}

const local = createPmsLocalListInteractions({
  prefix: EVENT_PREFIX, state, controller,
  listTitle: () => `共 ${filteredRows().length} 条`,
  filters: () => `<div class="space-y-2">${renderTopNav()}${renderFilters()}</div>`, stats: renderStats,
  feedback: () => renderPmsFeedback(state.feedback, state.feedbackOk), overlays: renderOverlays,
})

export async function handlePmsKolLockLogEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement()?.contains(target)) return false
  if (local.handle(target, event)) return true
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable) return false
  const action = actionable.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (action) {
    if (event && event.type !== 'click') return true
    try { await handleActionEvent(actionable) } catch (error) {
      state.feedback = error instanceof Error ? error.message : '操作未保存'
      state.feedbackOk = false
    }
    local.refresh(action === 'reset')
  } else {
    handleFieldEvent(actionable)
  }
  return true
}

export function closePmsKolLockLogOverlays(): void {
  // 当前没有弹出层
}
