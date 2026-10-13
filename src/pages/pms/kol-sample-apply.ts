// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsKolApplyRow,
  type PmsKolApplyStatus,
  filterPmsKolApply,
  getPmsKolApply,
  summarizePmsKolApply,
} from '../../data/pms/kol-sample-apply.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsBusinessImage, renderPmsFeedback, renderPmsOverlayError } from './shared.ts'

const EVENT_PREFIX = 'pms-kap'
const ROOT_SELECTOR = '[data-pms-kap-root]'

interface KolApplyPageState extends ProcessOrderListControllerState {
  search: string
  status: '' | PmsKolApplyStatus
  submittedAtFrom: string
  submittedAtTo: string
  detailId: string
  feedback: string
  feedbackOk: boolean
}

const state: KolApplyPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  search: '',
  status: '',
  submittedAtFrom: '',
  submittedAtTo: '',
  detailId: '',
  feedback: '',
  feedbackOk: true,
}

const STATUS_OPTIONS: Array<'' | PmsKolApplyStatus> = ['', '待审核', '已通过', '已驳回']

function filteredRows(): PmsKolApplyRow[] {
  return filterPmsKolApply({
    search: state.search,
    status: state.status,
    submittedAtFrom: state.submittedAtFrom,
    submittedAtTo: state.submittedAtTo,
  })
}

function renderSampleList(samples: PmsKolApplyRow['samples']): string {
  return samples.map((s) => `<div class="flex items-center gap-2 rounded border bg-slate-50 px-2 py-1">
    <div class="shrink-0">${renderPmsBusinessImage(s.imageUrl, `${s.spu} ${s.sku}`, 'h-9 w-9')}</div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs font-medium">${escapeHtml(s.sku)} <span class="text-slate-400">× ${s.qty}</span></div>
      <div class="truncate text-[11px] text-slate-500">${escapeHtml(s.spu)}</div>
    </div>
  </div>`).join('')
}

function renderAuditTrail(row: PmsKolApplyRow): string {
  if (row.auditTrail.length === 0) return '<span class="text-xs text-slate-400">暂无审核记录</span>'
  return row.auditTrail.map((a) => `<div class="rounded border bg-slate-50 px-2 py-1 text-xs"><div class="font-medium">${escapeHtml(a.reviewer)} ${escapeHtml(a.reviewedAt)}</div><div class="mt-0.5 text-slate-600">${escapeHtml(a.remark)}</div></div>`).join('')
}

const columns: StandardListColumn<PmsKolApplyRow>[] = [
  {
    key: 'applyInfo',
    title: '申请信息',
    width: 220,
    required: true,
    render: (row) => `<div class="font-mono text-xs font-medium text-blue-700">${escapeHtml(row.id)}</div><div class="mt-0.5 text-[11px] text-slate-500">提交: ${escapeHtml(row.submittedAt)}</div><div class="text-[11px] text-slate-500">code: <span class="font-mono">${escapeHtml(row.linkCode)}</span></div>`,
  },
  {
    key: 'applicantInfo',
    title: '达人信息',
    width: 180,
    render: (row) => `<div class="font-medium">${escapeHtml(row.applicantHandle)}</div><div class="mt-0.5 text-[11px] text-slate-500">WhatsApp: ${escapeHtml(row.applicantContact)}</div><div class="text-[11px] text-slate-500">平台: ${escapeHtml(row.applicantPlatform)}</div>`,
  },
  {
    key: 'recipientInfo',
    title: '收货信息',
    width: 240,
    render: (row) => `<div class="font-medium">${escapeHtml(row.recipientName)}</div><div class="mt-0.5 text-[11px] text-slate-500 line-clamp-2">${escapeHtml(row.recipientAddress)}</div>`,
  },
  {
    key: 'samples',
    title: '申请样品',
    width: 320,
    render: (row) => `<div class="grid grid-cols-1 gap-1">${renderSampleList(row.samples)}</div>`,
  },
  {
    key: 'totalQty',
    title: '件数',
    width: 70,
    sortable: true,
    sortValue: (row) => row.totalQty,
    render: (row) => `<span class="tabular-nums text-base font-semibold">${row.totalQty}</span>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 90,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => {
      const colors: Record<PmsKolApplyStatus, string> = {
        '待审核': 'bg-amber-50 text-amber-700',
        '已通过': 'bg-emerald-50 text-emerald-700',
        '已驳回': 'bg-rose-50 text-rose-700',
      }
      return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs ${colors[row.status]}">${escapeHtml(row.status)}</span>`
    },
  },
  {
    key: 'auditTrail',
    title: '审核记录',
    width: 220,
    render: (row) => renderAuditTrail(row),
  },
  {
    key: 'borrowOrderNo',
    title: '借出单号',
    width: 130,
    render: (row) => row.borrowOrderNo === '-'
      ? '<span class="text-xs text-slate-400">—</span>'
      : `<span class="font-mono text-xs">${escapeHtml(row.borrowOrderNo)}</span>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    actionColumn: true,
    required: true,
    render: (row) => `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">详情</button>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/kol-sample-apply',
  pageSizeOptions: [10, 20, 50, 100],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-kap-table-surface]',
  paginationSurfaceSelector: '[data-pms-kap-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-kap-overlays]',
  defaultFrozenKeys: ['applyInfo'],
  columnSettingsTitle: '手动寄样申请列设置',
  emptyText: '当前条件下暂无手动寄样申请',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = STATUS_OPTIONS.map((opt) => `<option value="${opt}" ${state.status === opt ? 'selected' : ''}>${opt || '全部'}</option>`).join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">检索</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="申请单号 / 达人 / 收货人 / 出库单号" value="${escapeHtml(state.search)}" data-${EVENT_PREFIX}-field="search" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    <label class="min-w-0 col-span-2"><span class="mb-1 block text-xs text-muted-foreground">申请时间</span><div class="flex items-center gap-1"><input class="h-9 w-full rounded-md border px-3 text-sm" type="date" value="${escapeHtml(state.submittedAtFrom)}" data-${EVENT_PREFIX}-field="submittedAtFrom" data-skip-page-rerender="true" /><span class="text-xs text-slate-400">~</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="date" value="${escapeHtml(state.submittedAtTo)}" data-${EVENT_PREFIX}-field="submittedAtTo" data-skip-page-rerender="true" /></div></label>
  </div>
  <div class="mt-3 flex w-full flex-wrap items-center gap-2">
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
  </div>
  </div>`
}

function renderStats(): string {
  const stats = summarizePmsKolApply({
    search: state.search,
    status: state.status,
    submittedAtFrom: state.submittedAtFrom,
    submittedAtTo: state.submittedAtTo,
  })
  const items = [
    { label: '申请单数', value: stats.totalApply },
    { label: '申请总件数', value: stats.totalSamples },
    { label: '待审核', value: stats.pending },
    { label: '已通过', value: stats.approved },
    { label: '已驳回', value: stats.rejected },
  ]
  return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">${items.map((item) => `<div class="rounded-lg border bg-white p-3"><div class="text-xs text-slate-500">${escapeHtml(item.label)}</div><div class="mt-1 text-2xl font-semibold tabular-nums">${item.value}</div></div>`).join('')}</div>`
}

function renderDetailOverlay(id: string): string {
  const row = getPmsKolApply(id)
  if (!row) return renderPmsOverlayError('未找到对应的申请单')
  const borrowBlock = row.borrowOrderNo === '-'
    ? '<span class="text-xs text-slate-400">尚未生成</span>'
    : `<span class="font-mono text-sm">${escapeHtml(row.borrowOrderNo)}</span>`
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="手动寄样申请详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-detail" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[560px] max-w-[95vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">手动寄样申请详情</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.id)} · ${escapeHtml(row.status)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-detail' }, 'x')}</header><div class="space-y-4 overflow-y-auto p-4">
    <section><h3 class="mb-2 text-sm font-semibold text-slate-700">申请信息</h3><div class="rounded-md border bg-slate-50 p-3 text-sm"><div>申请单号: <span class="font-mono">${escapeHtml(row.id)}</span></div><div class="mt-1">提交时间: ${escapeHtml(row.submittedAt)}</div><div class="mt-1">code: <span class="font-mono">${escapeHtml(row.linkCode)}</span></div></div></section>
    <section><h3 class="mb-2 text-sm font-semibold text-slate-700">达人信息</h3><div class="rounded-md border bg-slate-50 p-3 text-sm"><div>${escapeHtml(row.applicantHandle)}</div><div class="mt-1 text-xs text-slate-500">平台: ${escapeHtml(row.applicantPlatform)} · 联系方式: ${escapeHtml(row.applicantContact)}</div></div></section>
    <section><h3 class="mb-2 text-sm font-semibold text-slate-700">收货信息</h3><div class="rounded-md border bg-slate-50 p-3 text-sm"><div>${escapeHtml(row.recipientName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.recipientAddress)}</div></div></section>
    <section><h3 class="mb-2 text-sm font-semibold text-slate-700">申请样品(${row.totalQty} 件)</h3><div class="grid grid-cols-1 gap-2">${renderSampleList(row.samples)}</div></section>
    <section><h3 class="mb-2 text-sm font-semibold text-slate-700">审核记录</h3><div class="space-y-2">${renderAuditTrail(row)}</div></section>
    <section><h3 class="mb-2 text-sm font-semibold text-slate-700">借出单号</h3><div class="rounded-md border bg-slate-50 p-3 text-sm">${borrowBlock}</div></section>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
    ${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-detail' }, 'x')}
  </footer></section></div>`
}

function renderTopNav(): string {
  return `<nav class="flex flex-wrap gap-2 rounded-lg border bg-white p-3" aria-label="KOL 样衣申请导航">
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" href="/pms/kol-sample-stock">KOL库存</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-link">对外样品池链接</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-stock/lock-log">锁定操作记录</a>
  </nav>`
}

function renderOverlays(): string {
  if (!state.detailId) return ''
  return renderDetailOverlay(state.detailId)
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: false,
    title: '手动寄样申请',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: `<div class="space-y-2">${renderTopNav()}${renderFilters()}</div>`,
    statsHtml: stats,
    listTitle: `共 ${filteredRows().length} 条手动寄样申请`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-kap-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-kap-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-kap-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.dataset[`${EVENT_PREFIX}Field`]
  if (!field) return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'search': state.search = value; break
    case 'status': state.status = value as '' | PmsKolApplyStatus; break
    case 'submittedAtFrom': state.submittedAtFrom = value; break
    case 'submittedAtTo': state.submittedAtTo = value; break
  }
}

function handleActionEvent(target: HTMLElement): void {
  const action = target.dataset[`${EVENT_PREFIX}Action`]
  if (!action) return
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset':
      state.search = ''
      state.status = ''
      state.submittedAtFrom = ''
      state.submittedAtTo = ''
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    case 'export': {
      const rows = filteredRows()
      downloadPmsCsv(
        'higood-pms-kol-sample-apply.csv',
        ['申请单号', '提交时间', '达人', '平台', '联系方式', '收货人', '收货地址', '样品', '件数', '状态', '借出单号'],
        rows.map((r) => [
          r.id,
          r.submittedAt,
          r.applicantHandle,
          r.applicantPlatform,
          r.applicantContact,
          r.recipientName,
          r.recipientAddress,
          r.samples.map((s) => `${s.sku}×${s.qty}`).join(' / '),
          r.totalQty,
          r.status,
          r.borrowOrderNo,
        ]),
      )
      state.feedback = '已导出当前数据为 CSV'
      state.feedbackOk = true
      break
    }
    case 'open-detail':
      state.detailId = target.dataset.id ?? ''
      break
    case 'close-detail':
      state.detailId = ''
      break
  }
}

export function renderPmsKolApplyPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = renderBody()
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
  })
  return html
}

export function handlePmsKolApplyEvent(event: Event): void {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable || !rootElement()?.contains(actionable)) return
  if (actionable.dataset[`${EVENT_PREFIX}Action`]) {
    handleActionEvent(actionable)
  } else if (actionable.dataset[`${EVENT_PREFIX}Field`]) {
    handleFieldEvent(actionable)
  }
}

export function closePmsKolApplyOverlays(): void {
  state.detailId = ''
}
