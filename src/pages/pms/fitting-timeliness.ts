// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsFittingTimelinessRow,
  filterPmsFittingTimeliness,
  listPmsFittingTimelinessPurchaseLocations,
  listPmsFittingTimelinessPurchaseOrderStatuses,
  listPmsFittingTimelinessRows,
  summarizePmsFittingTimeliness,
  updatePmsFittingTimelinessConfirmedAt,
  updatePmsFittingTimelinessShippedAt,
} from '../../data/pms/fitting-timeliness.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  hydratePmsSurface,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsOverlayError,
} from './shared.ts'

const EVENT_PREFIX = 'pms-fit'
const ROOT_SELECTOR = '[data-pms-fit-root]'

interface TimelinessPageState extends ProcessOrderListControllerState {
  garmentSpu: string
  fittingSku: string
  purchaseOrderNo: string
  purchaseLocation: string
  purchaseOrderStatus: string
  initiatedAtFrom: string
  initiatedAtTo: string
  overlay:
    | null
    | { kind: 'confirm'; id: string; clientActionId: string; confirmedAt: string }
    | { kind: 'ship'; id: string; clientActionId: string; shippedAt: string }
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const state: TimelinessPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  garmentSpu: '',
  fittingSku: '',
  purchaseOrderNo: '',
  purchaseLocation: '',
  purchaseOrderStatus: '',
  initiatedAtFrom: '',
  initiatedAtTo: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

const LOCATION_OPTIONS = ['全部', ...listPmsFittingTimelinessPurchaseLocations()]
const STATUS_OPTIONS = ['全部', ...listPmsFittingTimelinessPurchaseOrderStatuses()]

function filteredRows(): PmsFittingTimelinessRow[] {
  return filterPmsFittingTimeliness({
    garmentSpu: state.garmentSpu,
    fittingSku: state.fittingSku,
    purchaseOrderNo: state.purchaseOrderNo,
    purchaseLocation: state.purchaseLocation,
    purchaseOrderStatus: state.purchaseOrderStatus,
    initiatedAtFrom: state.initiatedAtFrom,
    initiatedAtTo: state.initiatedAtTo,
  })
}

function formatTime(row: PmsFittingTimelinessRow, _index: number, field: keyof PmsFittingTimelinessRow): string {
  const value = String(row[field] ?? '')
  if (!value) return '<span class="text-xs text-slate-400">—</span>'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return escapeHtml(value)
  return `<span class="tabular-nums text-xs">${escapeHtml(value)}</span>`
}

function renderTimeField(field: keyof PmsFittingTimelinessRow): (row: PmsFittingTimelinessRow, index: number) => string {
  return (row, index) => formatTime(row, index, field)
}

const columns: StandardListColumn<PmsFittingTimelinessRow>[] = [
  {
    key: 'garmentSpu',
    title: '成衣SPU',
    width: 130,
    sortable: true,
    sortValue: (row) => row.garmentSpu,
    render: (row) => `<div class="font-medium text-blue-700">${escapeHtml(row.garmentSpu)}</div><div class="text-[11px] text-slate-500">${escapeHtml(row.orderType)}</div>`,
  },
  {
    key: 'fittingImage',
    title: '采购辅料图片',
    width: 110,
    render: (row) => renderPmsBusinessImage(row.fittingImageUrl, `${row.fittingSku} 面辅料图`),
  },
  {
    key: 'fittingSku',
    title: 'SKU',
    width: 200,
    sortable: true,
    sortValue: (row) => row.fittingSku,
    render: (row) => `<div class="font-medium">${escapeHtml(row.fittingSku)}</div>`,
  },
  {
    key: 'purchaseLocation',
    title: '采购地点',
    width: 90,
    render: (row) => `<span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">${escapeHtml(row.purchaseLocation)}</span>`,
  },
  {
    key: 'purchaseOrderNo',
    title: '辅料采购单',
    width: 110,
    render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.purchaseOrderNo)}</span>`,
  },
  {
    key: 'initiatedAt',
    title: '发起时间',
    width: 145,
    sortable: true,
    sortValue: (row) => row.initiatedAt,
    render: renderTimeField('initiatedAt'),
  },
  {
    key: 'confirmedAt',
    title: '确认时间',
    width: 145,
    sortable: true,
    sortValue: (row) => row.confirmedAt,
    render: renderTimeField('confirmedAt'),
  },
  {
    key: 'shippedAt',
    title: '出货时间',
    width: 110,
    sortable: true,
    sortValue: (row) => row.shippedAt,
    render: renderTimeField('shippedAt'),
  },
  {
    key: 'arrivedLongmailAt',
    title: '到达龙邮',
    width: 110,
    render: renderTimeField('arrivedLongmailAt'),
  },
  {
    key: 'arrivedShenzhenAt',
    title: '到达深圳',
    width: 110,
    sortable: true,
    sortValue: (row) => row.arrivedShenzhenAt,
    render: renderTimeField('arrivedShenzhenAt'),
  },
  {
    key: 'arrivedJakartaAt',
    title: '到达雅加达',
    width: 110,
    render: renderTimeField('arrivedJakartaAt'),
  },
  {
    key: 'arrivedBandungAt',
    title: '到达万隆',
    width: 110,
    render: renderTimeField('arrivedBandungAt'),
  },
  {
    key: 'batchNo',
    title: '批次号',
    width: 130,
    render: (row) => row.batchNo
      ? `<span class="font-mono text-xs">${escapeHtml(row.batchNo)}</span>`
      : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'logisticsChannel',
    title: '物流时效',
    width: 220,
    render: (row) => row.logisticsChannel
      ? `<span class="text-xs text-slate-600">${escapeHtml(row.logisticsChannel)}</span>`
      : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'purchaseOrderStatus',
    title: '采购单状态',
    width: 110,
    render: (row) => {
      const status = row.purchaseOrderStatus
      const isArrived = status === '全部入库'
      const color = isArrived
        ? 'bg-emerald-50 text-emerald-700'
        : status === '驳回'
          ? 'bg-rose-50 text-rose-700'
          : 'bg-amber-50 text-amber-700'
      return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs ${color}">${escapeHtml(status)}</span>`
    },
  },
  {
    key: 'followUpPersonnel',
    title: '跟进员',
    width: 110,
    render: (row) => row.followUpPersonnel
      ? `<span class="text-xs">${escapeHtml(row.followUpPersonnel)}</span>`
      : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'actions',
    title: '操作',
    width: 170,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center justify-end gap-1.5">
      <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-confirm" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">${row.confirmedAt ? '重设确认' : '设置确认'}</button>
      <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-ship" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">${row.shippedAt ? '重设出货' : '设置出货'}</button>
    </div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/fitting-timeliness',
  pageSizeOptions: [10, 20, 50, 100],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-fit-table-surface]',
  paginationSurfaceSelector: '[data-pms-fit-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-fit-overlays]',
  defaultFrozenKeys: ['garmentSpu'],
  columnSettingsTitle: '面辅料采购时效列设置',
  emptyText: '当前条件下暂无面辅料采购时效记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const locationOptions = LOCATION_OPTIONS.map((value) => `<option value="${value}" ${state.purchaseLocation === value ? 'selected' : ''}>${value}</option>`).join('')
  const statusOptions = STATUS_OPTIONS.map((value) => `<option value="${value}" ${state.purchaseOrderStatus === value ? 'selected' : ''}>${value}</option>`).join('')
  const advancedCount = [state.fittingSku, state.purchaseOrderNo, state.purchaseLocation, state.purchaseOrderStatus, state.initiatedAtFrom, state.initiatedAtTo].filter((v) => v !== '' && v !== '全部').length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">成衣SPU</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="多个逗号分隔" value="${escapeHtml(state.garmentSpu)}" data-${EVENT_PREFIX}-field="garmentSpu" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">辅料采购单</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="多个逗号分隔" value="${escapeHtml(state.purchaseOrderNo)}" data-${EVENT_PREFIX}-field="purchaseOrderNo" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">SKU</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="多个逗号分隔" value="${escapeHtml(state.fittingSku)}" data-${EVENT_PREFIX}-field="fittingSku" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购地点</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="purchaseLocation" data-skip-page-rerender="true">${locationOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购单状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="purchaseOrderStatus" data-skip-page-rerender="true">${statusOptions}</select></label>
  </div>
  <div class="mt-2 grid gap-2 lg:grid-cols-4">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">创建时间</span><div class="flex items-center gap-1"><input class="h-9 w-full rounded-md border px-3 text-sm" type="date" value="${escapeHtml(state.initiatedAtFrom)}" data-${EVENT_PREFIX}-field="initiatedAtFrom" data-skip-page-rerender="true" /><span class="text-xs text-slate-400">~</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="date" value="${escapeHtml(state.initiatedAtTo)}" data-${EVENT_PREFIX}-field="initiatedAtTo" data-skip-page-rerender="true" /></div></label>
  </div>
  <div class="mt-3 flex w-full flex-wrap items-center gap-2">
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    <span class="ml-2 text-xs text-slate-500" data-pms-fit-advanced-count ${advancedCount ? '' : 'hidden'}>${advancedCount} 个高级条件展开中</span>
    <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="toggle-advanced" data-skip-page-rerender="true">更多条件</button>
  </div>
  <div data-pms-fit-advanced ${advancedCount ? '' : 'hidden'} class="mt-2 text-xs text-slate-500">高级过滤项:SKU、采购地点、采购单状态、创建时间范围</div>
  </div>`
}

function renderStats(): string {
  const summary = summarizePmsFittingTimeliness({
    garmentSpu: state.garmentSpu,
    fittingSku: state.fittingSku,
    purchaseOrderNo: state.purchaseOrderNo,
    purchaseLocation: state.purchaseLocation,
    purchaseOrderStatus: state.purchaseOrderStatus,
    initiatedAtFrom: state.initiatedAtFrom,
    initiatedAtTo: state.initiatedAtTo,
  })
  const items = [
    { label: '记录数', value: summary.total },
    { label: '待完整到达', value: summary.pending },
    { label: '已全部到达万隆', value: summary.fullyArrived },
  ]
  return renderProcessOrderStats(items)
}

function renderConfirmOverlay(id: string, confirmedAt: string, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="设置确认时间"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[420px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">设置确认时间</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(id)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">确认时间
      <input class="h-9 rounded-md border bg-background px-2 text-sm" type="datetime-local" value="${escapeHtml(confirmedAt.replace(' ', 'T'))}" data-${EVENT_PREFIX}-overlay-confirm="1" data-skip-page-rerender="true" />
    </label>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-fit-confirm="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存', { prefix: EVENT_PREFIX, action: 'submit-confirm' }, 'check-check')}</footer></section></div>`
}

function renderShipOverlay(id: string, shippedAt: string, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="设置出货时间"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[420px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">设置出货时间</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(id)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">出货时间
      <input class="h-9 rounded-md border bg-background px-2 text-sm" type="datetime-local" value="${escapeHtml(shippedAt.replace(' ', 'T'))}" data-${EVENT_PREFIX}-overlay-ship="1" data-skip-page-rerender="true" />
    </label>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-fit-ship="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存', { prefix: EVENT_PREFIX, action: 'submit-ship' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  if (!state.overlay) return ''
  if (state.overlay.kind === 'confirm') {
    return renderConfirmOverlay(state.overlay.id, state.overlay.confirmedAt, state.overlay.clientActionId)
  }
  return renderShipOverlay(state.overlay.id, state.overlay.shippedAt, state.overlay.clientActionId)
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: false,
    title: '面辅料采购时效',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: stats,
    listTitle: `共 ${filteredRows().length} 条面辅料采购时效记录`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-fit-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-fit-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-fit-overlays>${renderOverlays()}</div>`,
  })
}

function readOverlayInput(selectorAttr: string): string {
  if (typeof document === 'undefined') return ''
  const overlayRoot = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-overlays]`)
  if (!overlayRoot) return ''
  const input = overlayRoot.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-${selectorAttr}="1"]`)
  if (!input?.value) return ''
  return input.value.replace('T', ' ')
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.dataset[`${EVENT_PREFIX}Field`]
  if (!field) return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'garmentSpu': state.garmentSpu = value; break
    case 'fittingSku': state.fittingSku = value; break
    case 'purchaseOrderNo': state.purchaseOrderNo = value; break
    case 'purchaseLocation': state.purchaseLocation = value; break
    case 'purchaseOrderStatus': state.purchaseOrderStatus = value; break
    case 'initiatedAtFrom': state.initiatedAtFrom = value; break
    case 'initiatedAtTo': state.initiatedAtTo = value; break
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
    case 'reset': {
      state.garmentSpu = ''
      state.fittingSku = ''
      state.purchaseOrderNo = ''
      state.purchaseLocation = ''
      state.purchaseOrderStatus = ''
      state.initiatedAtFrom = ''
      state.initiatedAtTo = ''
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    }
    case 'export': {
      const rows = listPmsFittingTimelinessRows()
      downloadPmsCsv(
        'higood-pms-fitting-timeliness.csv',
        ['成衣SPU', '首单翻单', 'SKU', '采购地点', '辅料采购单', '采购单状态', '发起时间', '确认时间', '出货时间', '到达龙邮', '到达深圳', '到达雅加达', '到达万隆', '批次号', '物流时效', '跟进员'],
        rows.map((r) => [r.garmentSpu, r.orderType, r.fittingSku, r.purchaseLocation, r.purchaseOrderNo, r.purchaseOrderStatus, r.initiatedAt, r.confirmedAt, r.shippedAt, r.arrivedLongmailAt, r.arrivedShenzhenAt, r.arrivedJakartaAt, r.arrivedBandungAt, r.batchNo, r.logisticsChannel, r.followUpPersonnel]),
      )
      state.feedback = '已导出当前数据为 CSV'
      state.feedbackOk = true
      break
    }
    case 'toggle-advanced': {
      const root = rootElement()
      const advanced = root?.querySelector<HTMLElement>('[data-pms-fit-advanced]')
      advanced?.toggleAttribute('hidden')
      const counter = root?.querySelector<HTMLElement>('[data-pms-fit-advanced-count]')
      counter?.remove()
      break
    }
    case 'open-confirm': {
      const id = target.dataset.id ?? ''
      const row = listPmsFittingTimelinessRows().find((r) => r.id === id)
      state.overlay = { kind: 'confirm', id, clientActionId: `fit-confirm-${Date.now()}`, confirmedAt: row?.confirmedAt ?? '' }
      state.overlayError = ''
      break
    }
    case 'open-ship': {
      const id = target.dataset.id ?? ''
      const row = listPmsFittingTimelinessRows().find((r) => r.id === id)
      state.overlay = { kind: 'ship', id, clientActionId: `fit-ship-${Date.now()}`, shippedAt: row?.shippedAt ?? '' }
      state.overlayError = ''
      break
    }
    case 'submit-confirm': {
      if (!state.overlay || state.overlay.kind !== 'confirm') return
      const value = readOverlayInput('overlay-confirm')
      if (!value) {
        state.overlayError = '请填写确认时间'
        return
      }
      try {
        updatePmsFittingTimelinessConfirmedAt(state.overlay.id, value)
        state.feedback = `已保存 ${state.overlay.id} 确认时间 ${value}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'submit-ship': {
      if (!state.overlay || state.overlay.kind !== 'ship') return
      const value = readOverlayInput('overlay-ship')
      if (!value) {
        state.overlayError = '请填写出货时间'
        return
      }
      try {
        updatePmsFittingTimelinessShippedAt(state.overlay.id, value)
        state.feedback = `已保存 ${state.overlay.id} 出货时间 ${value}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'close-overlay':
      state.overlay = null
      state.overlayError = ''
      break
  }
}

export function renderPmsFittingTimelinessPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = renderBody()
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
  })
  return html
}

export function handlePmsFittingTimelinessEvent(event: Event): void {
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

export function closePmsFittingTimelinessOverlays(): void {
  state.overlay = null
  state.overlayError = ''
}
