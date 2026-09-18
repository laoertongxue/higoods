// @page-pattern: list
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  getPmsSubjectOperation,
  listPmsSubjectOperationDataGaps,
  listPmsSubjectOperations,
  PMS_SUBJECT_REVENUE_STATUSES,
  updatePmsSubjectOperation,
  type PmsSubjectOperation,
  type PmsSubjectRevenueStatus,
} from '../../data/pms/subject-operations.ts'
import { PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  renderPmsFeedback,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type SubjectOverlay = null | { kind: 'detail'; operationId: string } | { kind: 'edit'; operationId: string }

interface SubjectPageState extends ProcessOrderListControllerState {
  keyword: string
  overlay: SubjectOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-so'
const ROOT_SELECTOR = '[data-pms-so-root]'
const FINANCE = { id: 'USR-PMS-LIU', name: '刘财务', role: '财务' as const }

const state: SubjectPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsSubjectOperation[] {
  const keyword = state.keyword.trim().toLowerCase()
  if (!keyword) return listPmsSubjectOperations()
  return listPmsSubjectOperations().filter((row) => [row.subjectName, row.subjectCode, row.period].some((value) => value.toLowerCase().includes(keyword)))
}

function marginTone(margin: number): 'green' | 'yellow' | 'red' {
  if (margin >= 25) return 'green'
  if (margin >= 10) return 'yellow'
  return 'red'
}

function money(row: PmsSubjectOperation, value: number): string {
  return formatPmsMoney(value, row.currency === 'USD' ? 'USD' : 'RMB')
}

function renderCostBreakdown(row: PmsSubjectOperation): string {
  return `<div class="grid grid-cols-2 gap-1 text-xs"><span>采购 ${money(row, row.purchaseCost)}</span><span>国内运费 ${money(row, row.domesticFreight)}</span><span>头程海运 ${money(row, row.firstLegOceanFreight)}</span><span>目的港 ${money(row, row.destinationPortFee)}</span><span>末端配送 ${money(row, row.lastMileDeliveryFee)}</span><span>关税 ${money(row, row.customsDuty)}</span><span>增值税 ${money(row, row.vat)}</span><span>清关费 ${money(row, row.clearanceFee)}</span><span>其他 ${money(row, row.otherCost)}</span><span class="${row.adjustment < 0 ? 'text-red-700' : ''}">调整 ${money(row, row.adjustment)}</span></div>`
}

function renderIncomeStatus(row: PmsSubjectOperation): string {
  const tone = row.revenueStatus === '已确认' ? 'green' : row.revenueStatus === '部分确认' ? 'yellow' : 'slate'
  const gaps = listPmsSubjectOperationDataGaps(row)
  const missing = gaps.length ? `<div class="mt-1 text-xs text-amber-700">数据缺失：${gaps.map((item) => escapeHtml(item)).join('、')}</div>` : ''
  return `<div>${renderPmsStatusBadge(row.revenueStatus, tone)}</div><div class="mt-1 text-xs tabular-nums">已确认 ${row.confirmedRevenue === null ? '—' : money(row, row.confirmedRevenue)}</div>${missing}`
}

const columns: StandardListColumn<PmsSubjectOperation>[] = [
  {
    key: 'subject',
    title: '贸易主体 / 期间',
    width: 230,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.subjectName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.subjectName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.subjectCode)} · ${escapeHtml(row.period)} · ${escapeHtml(row.currency)}</div>`,
  },
  {
    key: 'sales',
    title: '销售金额',
    width: 150,
    sortable: true,
    sortValue: (row) => row.salesAmount,
    render: (row) => `<div class="text-sm font-semibold tabular-nums">${formatPmsMoney(row.salesAmount, row.currency === 'USD' ? 'USD' : 'RMB')}</div>`,
  },
  {
    key: 'cost',
    title: '成本构成（9 项 + 调整）',
    width: 340,
    render: renderCostBreakdown,
  },
  {
    key: 'income',
    title: '收入状态 / 已确认收入',
    width: 190,
    render: renderIncomeStatus,
  },
  {
    key: 'total',
    title: '总成本 / 毛利',
    width: 200,
    sortable: true,
    sortValue: (row) => row.totalCost,
    render: (row) => `<div class="text-sm tabular-nums">总成本 ${formatPmsMoney(row.totalCost, row.currency === 'USD' ? 'USD' : 'RMB')}</div><div class="mt-1 text-sm tabular-nums ${row.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}">毛利 ${formatPmsMoney(row.grossProfit, row.currency === 'USD' ? 'USD' : 'RMB')}</div>`,
  },
  {
    key: 'margin',
    title: '毛利率',
    width: 120,
    sortable: true,
    sortValue: (row) => row.grossMargin,
    render: (row) => `<div class="text-lg font-semibold tabular-nums ${marginTone(row.grossMargin) === 'green' ? 'text-emerald-700' : marginTone(row.grossMargin) === 'yellow' ? 'text-amber-700' : 'text-red-700'}">${row.grossMargin}%</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-operation-id="${escapeHtml(row.operationId)}" data-skip-page-rerender="true">明细</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-edit" data-operation-id="${escapeHtml(row.operationId)}" data-skip-page-rerender="true">调整</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/subject-operations',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-so-table-surface]',
  paginationSurfaceSelector: '[data-pms-so-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-so-overlays]',
  defaultFrozenKeys: ['subject'],
  columnSettingsTitle: '主体经营明细列设置',
  emptyText: '当前条件下暂无经营明细',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar>
    <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="主体名称 / 编码 / 期间" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div>
    <div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
      ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
      ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
      ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
      <span class="ml-auto text-xs text-muted-foreground">总成本 = 采购成本 + 国内段运费 + 头程海运费 + 目的港费 + 末端配送费 + 关税 + 增值税 + 清关费 + 其他费用 + 调整金额；毛利率 = 毛利 ÷ 销售金额</span>
    </div>
  </div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const sales = rows.reduce((sum, row) => sum + row.salesAmount, 0)
  const profit = rows.reduce((sum, row) => sum + row.grossProfit, 0)
  return renderProcessOrderStats([
    { label: '主体数', value: rows.length },
    { label: '销售合计', value: formatPmsMoney(sales) },
    { label: '毛利合计', value: formatPmsMoney(profit) },
    { label: '综合毛利率', value: sales > 0 ? `${Math.round((profit / sales) * 10000) / 100}%` : '—' },
  ])
}

function renderDetailOverlay(operationId: string): string {
  const row = getPmsSubjectOperation(operationId)
  if (!row) return ''
  const gaps = listPmsSubjectOperationDataGaps(row)
  const missingNotice = gaps.length
    ? `<div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">数据缺失提醒：${gaps.map((item) => escapeHtml(item)).join('、')} 尚未补齐，总成本按已回传金额计算。</div>`
    : ''
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="主体经营明细"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭明细"></button><section class="relative z-10 flex h-full w-[620px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(row.subjectName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.subjectCode)} · ${escapeHtml(row.period)} · ${escapeHtml(row.currency)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${missingNotice}
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">收入</h3><dl class="mt-2 grid grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">销售金额</dt><dd class="mt-1 tabular-nums">${money(row, row.salesAmount)}</dd></div><div><dt class="text-xs text-muted-foreground">收入状态</dt><dd class="mt-1">${renderPmsStatusBadge(row.revenueStatus, row.revenueStatus === '已确认' ? 'green' : row.revenueStatus === '部分确认' ? 'yellow' : 'slate')}</dd></div><div><dt class="text-xs text-muted-foreground">已确认收入金额</dt><dd class="mt-1 tabular-nums">${row.confirmedRevenue === null ? '—' : money(row, row.confirmedRevenue)}</dd></div><div><dt class="text-xs text-muted-foreground">毛利 / 毛利率</dt><dd class="mt-1 tabular-nums ${row.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}">${money(row, row.grossProfit)} · ${row.grossMargin}%</dd></div></dl></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">成本明细（9 项 + 调整）</h3><dl class="mt-2 grid grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">采购成本</dt><dd class="mt-1 tabular-nums">${money(row, row.purchaseCost)}</dd></div><div><dt class="text-xs text-muted-foreground">国内段运费</dt><dd class="mt-1 tabular-nums">${money(row, row.domesticFreight)}</dd></div><div><dt class="text-xs text-muted-foreground">头程海运费</dt><dd class="mt-1 tabular-nums">${money(row, row.firstLegOceanFreight)}</dd></div><div><dt class="text-xs text-muted-foreground">目的港费</dt><dd class="mt-1 tabular-nums">${money(row, row.destinationPortFee)}</dd></div><div><dt class="text-xs text-muted-foreground">末端配送费</dt><dd class="mt-1 tabular-nums">${money(row, row.lastMileDeliveryFee)}</dd></div><div><dt class="text-xs text-muted-foreground">关税</dt><dd class="mt-1 tabular-nums">${money(row, row.customsDuty)}</dd></div><div><dt class="text-xs text-muted-foreground">增值税</dt><dd class="mt-1 tabular-nums">${money(row, row.vat)}</dd></div><div><dt class="text-xs text-muted-foreground">清关费</dt><dd class="mt-1 tabular-nums">${money(row, row.clearanceFee)}</dd></div><div><dt class="text-xs text-muted-foreground">其他费用</dt><dd class="mt-1 tabular-nums">${money(row, row.otherCost)}</dd></div><div><dt class="text-xs text-muted-foreground">调整金额</dt><dd class="mt-1 tabular-nums ${row.adjustment < 0 ? 'text-red-700' : ''}">${money(row, row.adjustment)}</dd></div><div><dt class="text-xs text-muted-foreground">物流费小计</dt><dd class="mt-1 tabular-nums">${money(row, row.logisticsCost)}</dd></div><div><dt class="text-xs text-muted-foreground">分摊费用小计</dt><dd class="mt-1 tabular-nums">${money(row, row.allocatedCost)}</dd></div><div><dt class="text-xs text-muted-foreground">总成本（系统重算）</dt><dd class="mt-1 font-semibold tabular-nums">${money(row, row.totalCost)}</dd></div></dl></section>
    <dl class="grid grid-cols-2 gap-3 text-sm"><div class="col-span-2"><dt class="text-xs text-muted-foreground">备注</dt><dd class="mt-1 text-slate-600">${escapeHtml(row.remark || '—')}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">最近更新</dt><dd class="mt-1 text-slate-600">${escapeHtml(row.updatedBy)} · ${escapeHtml(row.updatedAt)}</dd></div></dl>
  </div></section></div>`
}

function renderEditOverlay(operationId: string): string {
  const row = getPmsSubjectOperation(operationId)
  if (!row) return ''
  const numberField = (label: string, field: string, value: number | string, allowNegative = false) =>
    `<label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" ${allowNegative ? '' : 'min="0" '}step="0.01" value="${value}" data-${EVENT_PREFIX}-edit-field="${field}" data-skip-page-rerender="true" /></label>`
  const gaps = listPmsSubjectOperationDataGaps(row)
  const gapsNotice = gaps.length ? `<div class="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">数据缺失：${gaps.map((item) => escapeHtml(item)).join('、')}；保存对应字段后提醒自动消除。</div>` : ''
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="调整经营明细" data-pms-so-edit-root><section class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">调整经营明细</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.subjectName)} · ${escapeHtml(row.period)} · 总成本由 9 项成本明细加调整金额重算</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}${gapsNotice}
    <div class="mt-3 grid grid-cols-2 gap-3">
      ${numberField('销售金额', 'salesAmount', row.salesAmount)}
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">收入状态<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="revenueStatus" data-skip-page-rerender="true">${PMS_SUBJECT_REVENUE_STATUSES.map((value) => `<option value="${value}" ${row.revenueStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">已确认收入金额<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${row.confirmedRevenue ?? ''}" placeholder="缺失时留空" data-${EVENT_PREFIX}-edit-field="confirmedRevenue" data-skip-page-rerender="true" /></label>
      ${numberField('采购成本', 'purchaseCost', row.purchaseCost)}
      ${numberField('国内段运费', 'domesticFreight', row.domesticFreight)}
      ${numberField('头程海运费', 'firstLegOceanFreight', row.firstLegOceanFreight)}
      ${numberField('目的港费', 'destinationPortFee', row.destinationPortFee)}
      ${numberField('末端配送费', 'lastMileDeliveryFee', row.lastMileDeliveryFee)}
      ${numberField('关税', 'customsDuty', row.customsDuty)}
      ${numberField('增值税', 'vat', row.vat)}
      ${numberField('清关费', 'clearanceFee', row.clearanceFee)}
      ${numberField('其他费用', 'otherCost', row.otherCost)}
      ${numberField('调整金额（可为负数）', 'adjustment', row.adjustment, true)}
      ${numberField('费用分摊小计（SRM 口径）', 'allocatedCost', row.allocatedCost)}
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.remark)}" data-${EVENT_PREFIX}-edit-field="remark" data-skip-page-rerender="true" /></label>
    </div>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存调整', { prefix: EVENT_PREFIX, action: 'submit-edit' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-so-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.operationId)}`
  return `${columnSettings}${renderDetailOverlay(state.overlay.operationId)}${renderEditOverlay(state.overlay.operationId)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '主体经营明细',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-so-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-so-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-so-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-so-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function readOptionalAmount(surface: HTMLElement, field: string): number | null {
  const node = surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-field="${field}"]`)
  if (!node || node.value.trim() === '') return null
  return Number(node.value)
}

function submitEdit(operationId: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-so-edit-root]')
  if (!surface) return
  try {
    const row = updatePmsSubjectOperation(
      operationId,
      {
        salesAmount: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="salesAmount"]`),
        purchaseCost: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="purchaseCost"]`),
        domesticFreight: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="domesticFreight"]`),
        firstLegOceanFreight: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="firstLegOceanFreight"]`),
        destinationPortFee: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="destinationPortFee"]`),
        lastMileDeliveryFee: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="lastMileDeliveryFee"]`),
        customsDuty: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="customsDuty"]`),
        vat: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="vat"]`),
        clearanceFee: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="clearanceFee"]`),
        otherCost: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="otherCost"]`),
        adjustment: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="adjustment"]`),
        allocatedCost: readNumberField(surface, `[data-${EVENT_PREFIX}-edit-field="allocatedCost"]`),
        revenueStatus: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="revenueStatus"]`) as PmsSubjectRevenueStatus,
        confirmedRevenue: readOptionalAmount(surface, 'confirmedRevenue'),
        remark: readTextField(surface, `[data-${EVENT_PREFIX}-edit-field="remark"]`),
      },
      FINANCE,
    )
    state.feedback = `${row.subjectName} 经营明细已更新：总成本 ${row.totalCost}，毛利率 ${row.grossMargin}%。`
    state.feedbackOk = true
    state.overlay = { kind: 'detail', operationId }
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存经营明细失败'
    refreshOverlays()
  }
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的经营明细。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '主体经营明细.csv',
    ['主体编码', '主体名称', '期间', '币种', '销售金额', '采购成本', '物流费', '费用分摊', '其他费用', '总成本', '毛利', '毛利率(%)'],
    rows.map((row) => [row.subjectCode, row.subjectName, row.period, row.currency, row.salesAmount, row.purchaseCost, row.logisticsCost, row.allocatedCost, row.otherCost, row.totalCost, row.grossProfit, row.grossMargin]),
  )
  state.feedback = `已导出 ${rows.length} 条经营明细（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsSubjectOperationsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-so-root data-skip-page-rerender="true"><style>[data-pms-so-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsSubjectOperationOverlays(): boolean {
  if (state.overlay?.kind === 'edit') {
    state.overlay = { kind: 'detail', operationId: state.overlay.operationId }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
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

export function handlePmsSubjectOperationsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closePmsSubjectOperationOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    state.keyword = field.value
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsSoAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-so-column-key]')?.dataset.pmsSoColumnKey || ''
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
    state.overlay = { kind: 'detail', operationId: actionNode?.dataset.operationId || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    state.overlay = { kind: 'edit', operationId: actionNode?.dataset.operationId || '' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'submit-edit') {
    if (state.overlay?.kind === 'edit') submitEdit(state.overlay.operationId)
    return true
  }
  if (action === 'close-overlay') {
    closePmsSubjectOperationOverlays()
    return true
  }
  return false
}
