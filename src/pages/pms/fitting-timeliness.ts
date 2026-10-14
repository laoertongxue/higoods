import { createPmsLocalListInteractions } from './local-list-interactions.ts'
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
  hydratePmsFittingTimeliness,
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
  confirmPmsAction,
  hydratePmsSurface,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsOverlayError,
} from './shared.ts'

const EVENT_PREFIX = 'pms-fit'
const ROOT_SELECTOR = '[data-pms-fit-root]'
let savingTime = false

interface TimelinessPageState extends ProcessOrderListControllerState {
  orderType: '' | '首单' | '翻单'
  garmentPurchaseOrderNo: string
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
  orderType: '',
  garmentPurchaseOrderNo: '',
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

function filteredRows(): PmsFittingTimelinessRow[] {
  return filterPmsFittingTimeliness({
    orderType: state.orderType || undefined,
    garmentPurchaseOrderNo: state.garmentPurchaseOrderNo,
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
    freezeable: true,
    title: '成衣SPU',
    width: 130,
    required: true,
    sortable: true,
    sortValue: (row) => row.garmentSpu,
    render: (row) => `<div class="font-medium text-blue-700">${escapeHtml(row.garmentSpu)}</div><div class="text-[11px] text-slate-500">${escapeHtml(row.orderType)}</div>`,
  },
  {
    key: 'fittingSku',
    freezeable: true,
    title: '面辅料 / SKU',
    width: 200,
    required: true,
    sortable: true,
    sortValue: (row) => row.fittingSku,
    render: (row) => `<div class="flex items-center gap-2">${renderPmsBusinessImage(row.fittingImageUrl, `${row.fittingSku} 面辅料图`)}<div class="min-w-0 break-words font-medium">${escapeHtml(row.fittingSku)}</div></div>`,
  },
  {
    key: 'purchaseLocation',
    freezeable: true,
    title: '采购地点',
    width: 90,
    render: (row) => `<span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">${escapeHtml(row.purchaseLocation)}</span>`,
  },
  {
    key: 'purchaseOrderNo',
    freezeable: true,
    title: '辅料采购单',
    width: 110,
    render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.purchaseOrderNo)}</span>`,
  },
  {
    key: 'initiatedAt',
    freezeable: true,
    title: '发起时间',
    width: 145,
    sortable: true,
    sortValue: (row) => row.initiatedAt,
    render: renderTimeField('initiatedAt'),
  },
  {
    key: 'confirmedAt',
    freezeable: true,
    title: '确认时间',
    width: 145,
    sortable: true,
    sortValue: (row) => row.confirmedAt,
    render: renderTimeField('confirmedAt'),
  },
  {
    key: 'shippedAt',
    freezeable: true,
    title: '出货时间',
    width: 110,
    sortable: true,
    sortValue: (row) => row.shippedAt,
    render: renderTimeField('shippedAt'),
  },
  {
    key: 'arrivedLongmailAt',
    freezeable: true,
    title: '到达龙邮',
    width: 110,
    render: renderTimeField('arrivedLongmailAt'),
  },
  {
    key: 'arrivedShenzhenAt',
    freezeable: true,
    title: '到达深圳',
    width: 110,
    sortable: true,
    sortValue: (row) => row.arrivedShenzhenAt,
    render: renderTimeField('arrivedShenzhenAt'),
  },
  {
    key: 'arrivedJakartaAt',
    freezeable: true,
    title: '到达雅加达',
    width: 110,
    render: renderTimeField('arrivedJakartaAt'),
  },
  {
    key: 'arrivedBandungAt',
    freezeable: true,
    title: '到达万隆',
    width: 110,
    render: renderTimeField('arrivedBandungAt'),
  },
  {
    key: 'batchNo',
    freezeable: true,
    title: '批次号',
    width: 130,
    render: (row) => row.batchNo
      ? `<span class="font-mono text-xs">${escapeHtml(row.batchNo)}</span>`
      : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'logisticsChannel',
    freezeable: true,
    title: '物流时效',
    width: 220,
    render: (row) => row.logisticsChannel
      ? `<span class="text-xs text-slate-600">${escapeHtml(row.logisticsChannel)}</span>`
      : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'purchaseOrderStatus',
    freezeable: true,
    title: '采购单状态',
    width: 110,
    render: (row) => {
      const status = row.purchaseOrderStatus
      const isArrived = status === '已入库'
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
    freezeable: true,
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
  const locationOptions = ['全部', ...listPmsFittingTimelinessPurchaseLocations()].map((value) => `<option value="${escapeHtml(value)}" ${state.purchaseLocation === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')
  const statusOptions = ['全部', ...listPmsFittingTimelinessPurchaseOrderStatuses()].map((value) => `<option value="${escapeHtml(value)}" ${state.purchaseOrderStatus === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')
  const advancedCount = [state.fittingSku, state.purchaseOrderNo, state.purchaseLocation, state.purchaseOrderStatus, state.initiatedAtFrom, state.initiatedAtTo].filter((v) => v !== '' && v !== '全部').length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">首翻单</span><select class="h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-field="orderType">${['','首单','翻单'].map(type=>`<option value="${type}" ${state.orderType===type?'selected':''}>${type || '全部'}</option>`).join('')}</select></label>
    ${state.orderType==='翻单'?`<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">商品采购单</span><input class="h-9 w-full rounded border px-2" value="${escapeHtml(state.garmentPurchaseOrderNo)}" data-${EVENT_PREFIX}-field="garmentPurchaseOrderNo"></label>`:''}
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
    orderType: state.orderType || undefined,
    garmentPurchaseOrderNo: state.garmentPurchaseOrderNo,
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

function timelineObjectLabel(id: string): string {
  const row = listPmsFittingTimelinessRows().find(item => item.id === id)
  return row ? `${row.purchaseOrderNo} · ${row.fittingSku}` : '采购时效记录'
}

function renderConfirmOverlay(id: string, confirmedAt: string, clientActionId: string): string {
  const saved = listPmsFittingTimelinessRows().find(row => row.id === id)?.confirmedAt || confirmedAt
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(saved)
  const label = dateOnly ? '确认日期' : '确认时间'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="设置${label}"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[420px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">设置${label}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(timelineObjectLabel(id))}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}
      <input class="h-9 rounded-md border bg-background px-2 text-sm" type="${dateOnly ? 'date' : 'datetime-local'}" value="${escapeHtml(confirmedAt.replace(' ', 'T'))}" data-${EVENT_PREFIX}-overlay-confirm="1" data-skip-page-rerender="true" />
    </label>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-fit-confirm="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存' + label, { prefix: EVENT_PREFIX, action: 'submit-confirm' }, 'check-check')}</footer></section></div>`
}

function renderShipOverlay(id: string, shippedAt: string, clientActionId: string): string {
  const saved = listPmsFittingTimelinessRows().find(row => row.id === id)?.shippedAt || shippedAt
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(saved) || !saved
  const label = dateOnly ? '出货日期' : '出货时间'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="设置${label}"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[420px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">设置${label}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(timelineObjectLabel(id))}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">${label}
      <input class="h-9 rounded-md border bg-background px-2 text-sm" type="${dateOnly ? 'date' : 'datetime-local'}" value="${escapeHtml(shippedAt.replace(' ', 'T'))}" data-${EVENT_PREFIX}-overlay-ship="1" data-skip-page-rerender="true" />
    </label>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-fit-ship="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存' + label, { prefix: EVENT_PREFIX, action: 'submit-ship' }, 'check-check')}</footer></section></div>`
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
  return renderStandardListPage({className:'pms-compact-list',
    showHeader: true,
    title: '面辅料采购时效',
    feedbackHtml: `<div data-${EVENT_PREFIX}-feedback>${renderPmsFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div data-${EVENT_PREFIX}-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-${EVENT_PREFIX}-stats>${stats}</div>`,
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
  const field = target.getAttribute(`data-${EVENT_PREFIX}-field`)
  if (!field) return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'orderType':state.orderType=value as TimelinessPageState['orderType'];local.refresh(true);break
    case 'garmentPurchaseOrderNo':state.garmentPurchaseOrderNo=value;break
    case 'garmentSpu': state.garmentSpu = value; break
    case 'fittingSku': state.fittingSku = value; break
    case 'purchaseOrderNo': state.purchaseOrderNo = value; break
    case 'purchaseLocation': state.purchaseLocation = value; break
    case 'purchaseOrderStatus': state.purchaseOrderStatus = value; break
    case 'initiatedAtFrom': state.initiatedAtFrom = value; break
    case 'initiatedAtTo': state.initiatedAtTo = value; break
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
    case 'reset': {
      state.garmentPurchaseOrderNo=''
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
      const rows = filteredRows()
      if(!rows.length) throw new Error('当前筛选没有可导出的时效记录')
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
      if (savingTime) return
      if (!state.overlay || state.overlay.kind !== 'confirm') return
      const value = readOverlayInput('overlay-confirm')
      state.overlay.confirmedAt = value
      if (!value) {
        state.overlayError = '请填写确认时间'
        return
      }
      savingTime = true
      try {
        await updatePmsFittingTimelinessConfirmedAt(state.overlay.id, value,state.overlay.clientActionId)
        state.feedback = `已保存 ${timelineObjectLabel(state.overlay.id)} 确认时间 ${value}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      } finally { savingTime = false }
      break
    }
    case 'submit-ship': {
      if (savingTime) return
      if (!state.overlay || state.overlay.kind !== 'ship') return
      const value = readOverlayInput('overlay-ship')
      state.overlay.shippedAt = value
      if (!value) {
        state.overlayError = '请填写出货时间'
        return
      }
      savingTime = true
      try {
        await updatePmsFittingTimelinessShippedAt(state.overlay.id, value,state.overlay.clientActionId)
        state.feedback = `已保存 ${timelineObjectLabel(state.overlay.id)} 出货时间 ${value}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      } finally { savingTime = false }
      break
    }
  }
}

export async function renderPmsFittingTimelinessPage(): Promise<string> {
  try {await hydratePmsFittingTimeliness()} catch(error) {state.feedback=error instanceof Error?error.message:'用户数据不可读';state.feedbackOk=false}
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
  filters: () => renderFilters(), stats: renderStats,
  feedback: () => renderPmsFeedback(state.feedback, state.feedbackOk), overlays: renderOverlays,
})

export async function handlePmsFittingTimelinessEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement()?.contains(target)) return false
  if (local.handle(target, event)) return true
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable) return false
  const action = actionable.getAttribute(`data-${EVENT_PREFIX}-action`)
  if (action) {
    if (event && event.type !== 'click') return true
    if (savingTime) return true
    if (action === 'close-overlay') { await closePmsFittingTimelinessOverlays(); return true }
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

async function tryCloseTimelineOverlay(): Promise<boolean> {
  if(!state.overlay && !state.showColumnSettings)return false
  if (savingTime) return false
  if (state.overlay) {
    const row = listPmsFittingTimelinessRows().find(item => item.id === state.overlay!.id)
    const field = state.overlay.kind === 'confirm' ? 'confirmedAt' : 'shippedAt'
    const value = readOverlayInput(state.overlay.kind === 'confirm' ? 'overlay-confirm' : 'overlay-ship')
    const saved = row?.[field] ?? ''
    if (state.overlay.kind === 'confirm') state.overlay.confirmedAt = value
    else state.overlay.shippedAt = value
    const before = Date.parse(saved.replace(' ', 'T')), after = Date.parse(value.replace(' ', 'T'))
    const changed = saved !== value && !(Number.isFinite(before) && before === after)
    if (changed && !await confirmPmsAction(`${timelineObjectLabel(state.overlay.id)} 的时间尚未保存。关闭会丢弃本次填写。`, '放弃填写并关闭', '采购时效未保存')) return false
  }
  state.overlay = null
  state.overlayError = ''
  state.showColumnSettings=false
  return true
}

export async function closePmsFittingTimelinessOverlays(): Promise<boolean> {
  if (!rootElement()) return false
  const hadOverlay = Boolean(state.overlay || state.showColumnSettings)
  if (await tryCloseTimelineOverlay()) local.overlays()
  return hadOverlay
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => {
  if (!rootElement() || !state.overlay) return
  const row = listPmsFittingTimelinessRows().find(item => item.id === state.overlay!.id)
  const field = state.overlay.kind === 'confirm' ? 'confirmedAt' : 'shippedAt'
  const value = readOverlayInput(state.overlay.kind === 'confirm' ? 'overlay-confirm' : 'overlay-ship')
  const saved = row?.[field] ?? ''
  const before = Date.parse(saved.replace(' ', 'T')), after = Date.parse(value.replace(' ', 'T'))
  if (savingTime || (saved !== value && !(Number.isFinite(before) && before === after))) {
    event.preventDefault(); event.returnValue = ''
  }
})
