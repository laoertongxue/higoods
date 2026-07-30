// @page-pattern: list

import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  resetStandardListEntryTransientStateOnRouteEntry,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { createProcessOrderListController } from '../../../components/ui/process-order-list-controller.ts'
import {
  changeWoolMachineAvailability,
  captureWoolMachineAvailabilitySnapshot,
  listWoolMachineAssociations,
  listWoolMachineViews,
  listWoolWorkOrders,
  type WoolMachineAvailability,
  type WoolMachineAvailabilitySnapshot,
  type WoolMachineStatus,
  type WoolMachineView,
  type WoolWorkOrder,
} from '../../../data/fcs/wool-task-domain.ts'
import { buildWoolMachineAssociationsLink } from '../../../data/fcs/fcs-route-links.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

const EVENT_PREFIX = 'wool-machines'
const PREFERENCE_KEY = '/fcs/craft/wool/machines:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface MachineFilters {
  keyword: string
  status: '' | WoolMachineStatus
}

interface MachineArchiveRow {
  machine: WoolMachineView
  order?: WoolWorkOrder
  associatedAt?: string
}

export interface WoolMachineAvailabilityImpact {
  machineId: string
  machineNo: string
  machineName: string
  woolOrderId: string
  woolOrderNo: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  associatedAt: string
  baseStatus: WoolMachineAvailability
}

export interface WoolMachinesRouteEntryState {
  routeKey: string
  overlayMachineId: string
  selectedNextStatus: WoolMachineAvailability | ''
  selectedReason: string
  impactConfirmed: boolean
  confirmedImpactFingerprint?: string
  confirmedAssociationSnapshot?: WoolMachineAvailabilitySnapshot
  overlayError: string
}

const DEFAULT_FILTERS: MachineFilters = { keyword: '', status: '' }
const state: {
  routeKey: string
  filters: MachineFilters
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  overlayMachineId: string
  selectedNextStatus: WoolMachineAvailability | ''
  selectedReason: string
  impactConfirmed: boolean
  confirmedImpactFingerprint: string
  confirmedAssociationSnapshot?: WoolMachineAvailabilitySnapshot
  overlayError: string
  feedback: string
} = {
  routeKey: '',
  filters: { ...DEFAULT_FILTERS },
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['machine'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  overlayMachineId: '',
  selectedNextStatus: '',
  selectedReason: '',
  impactConfirmed: false,
  confirmedImpactFingerprint: '',
  overlayError: '',
  feedback: '',
}

let filterDebounce: ReturnType<typeof setTimeout> | undefined

function currentRouteKey(): string {
  const storePath = appStore.getState().pathname || ''
  if (storePath.startsWith('/fcs/craft/wool/machines')) return storePath
  if (typeof window !== 'undefined') return `${window.location.pathname}${window.location.search}`
  return '/fcs/craft/wool/machines'
}

export function resolveWoolMachinesRouteEntry(
  previous: WoolMachinesRouteEntryState | undefined,
  input: { routeKey: string; hasMountedRoot: boolean },
): WoolMachinesRouteEntryState {
  if (input.hasMountedRoot && previous?.routeKey === input.routeKey) return { ...previous }
  return {
    routeKey: input.routeKey,
    overlayMachineId: '',
    selectedNextStatus: '',
    selectedReason: '',
    impactConfirmed: false,
    confirmedImpactFingerprint: '',
    confirmedAssociationSnapshot: undefined,
    overlayError: '',
  }
}

export function cancelWoolMachinesFilterRefresh(): void {
  if (filterDebounce) clearTimeout(filterDebounce)
  filterDebounce = undefined
}

export function scheduleWoolMachinesFilterRefresh(
  callback: () => void = refreshResults,
  delay = 180,
): void {
  cancelWoolMachinesFilterRefresh()
  filterDebounce = setTimeout(() => {
    filterDebounce = undefined
    callback()
  }, delay)
}

function statusLabel(status: WoolMachineStatus): string {
  return status === 'IDLE'
    ? '空闲'
    : status === 'PRODUCING'
      ? '生产中'
      : status === 'REPAIR'
        ? '维修'
        : '停用'
}

export function buildWoolMachineAvailabilityImpact(
  machineId: string,
): WoolMachineAvailabilityImpact | undefined {
  const machine = listWoolMachineViews().find((item) => item.machineId === machineId)
  const association = listWoolMachineAssociations().find((item) => item.machineId === machineId)
  if (!machine || !association) return undefined
  const order = listWoolWorkOrders().find((item) => item.woolOrderId === association.woolOrderId)
  if (!order) return undefined
  return {
    machineId,
    machineNo: machine.machineNo,
    machineName: machine.machineName,
    woolOrderId: order.woolOrderId,
    woolOrderNo: order.woolOrderNo,
    productionOrderNo: order.productionOrderNo,
    styleNo: order.styleNo,
    styleName: order.styleName,
    associatedAt: association.associatedAt,
    baseStatus: captureWoolMachineAvailabilitySnapshot(machineId).baseStatus,
  }
}

export function buildWoolMachineAvailabilityImpactFingerprint(
  machineId: string,
  nextStatus: WoolMachineAvailability,
  snapshot: WoolMachineAvailabilitySnapshot,
): string {
  return JSON.stringify({
    machineId,
    nextStatus,
    baseStatus: snapshot.baseStatus,
    association: snapshot.association
      ? {
          machineId: snapshot.association.machineId,
          woolOrderId: snapshot.association.woolOrderId,
          associatedAt: snapshot.association.associatedAt,
        }
      : null,
  })
}

function machineRows(): MachineArchiveRow[] {
  const orders = new Map(listWoolWorkOrders().map((order) => [order.woolOrderId, order]))
  const associations = new Map(listWoolMachineAssociations().map((item) => [item.machineId, item]))
  const keyword = state.filters.keyword.trim().toLocaleLowerCase()
  return listWoolMachineViews()
    .map((machine) => {
      const association = associations.get(machine.machineId)
      return {
        machine,
        order: association ? orders.get(association.woolOrderId) : undefined,
        associatedAt: association?.associatedAt,
      }
    })
    .filter((row) => !state.filters.status || row.machine.status === state.filters.status)
    .filter((row) => {
      if (!keyword) return true
      return [
        row.machine.machineId,
        row.machine.machineNo,
        row.machine.machineName,
        row.order?.woolOrderNo,
        row.order?.productionOrderNo,
        row.order?.styleNo,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(keyword))
    })
}

function statusBadge(status: WoolMachineStatus): string {
  const tone = status === 'IDLE'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'PRODUCING'
      ? 'bg-blue-50 text-blue-700'
      : status === 'REPAIR'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-700'
  return `<span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}">${escapeHtml(statusLabel(status))}</span>`
}

function actions(row: MachineArchiveRow): string {
  return `<div class="flex flex-col items-start gap-1">
    <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolMachineAssociationsLink(undefined, row.machine.machineId))}">查看当前生产关联</button>
    <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-machines-action="open-status" data-machine-id="${escapeHtml(row.machine.machineId)}" data-skip-page-rerender="true">修改状态</button>
  </div>`
}

const columns: StandardListColumn<MachineArchiveRow>[] = [
  {
    key: 'machine',
    title: '设备编号 / 名称',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.machine.machineNo,
    render: (row) => `<div><div class="font-mono text-xs font-medium">${escapeHtml(row.machine.machineNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.machine.machineName)}</div></div>`,
  },
  {
    key: 'status',
    title: '当前状态',
    width: 115,
    required: true,
    sortable: true,
    sortValue: (row) => statusLabel(row.machine.status),
    render: (row) => statusBadge(row.machine.status),
  },
  {
    key: 'specification',
    title: '机型 / 针型',
    width: 180,
    required: true,
    sortable: true,
    sortValue: (row) => `${row.machine.machineModel} ${row.machine.needleType}`,
    render: (row) => `<div><div class="font-medium">${escapeHtml(row.machine.machineModel)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.machine.needleType)}</div></div>`,
  },
  {
    key: 'currentOrder',
    title: '当前关联加工单',
    width: 210,
    required: true,
    sortable: true,
    sortValue: (row) => row.order?.woolOrderNo,
    render: (row) => row.order
      ? `<div><div class="font-mono text-xs font-medium text-blue-700">${escapeHtml(row.order.woolOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">ID：${escapeHtml(row.order.woolOrderId)}</div></div>`
      : '<span class="text-muted-foreground">未关联</span>',
  },
  {
    key: 'productionOrder',
    title: '生产单',
    width: 165,
    sortable: true,
    sortValue: (row) => row.order?.productionOrderNo,
    render: (row) => escapeHtml(row.order?.productionOrderNo || '—'),
  },
  {
    key: 'style',
    title: '款号 / 款名',
    width: 230,
    sortable: true,
    sortValue: (row) => row.order?.styleNo,
    render: (row) => row.order
      ? `${escapeHtml(row.order.styleNo)} ${escapeHtml(row.order.styleName)}`
      : '—',
  },
  {
    key: 'associatedAt',
    title: '当前关联时间',
    width: 165,
    sortable: true,
    sortValue: (row) => row.associatedAt,
    render: (row) => escapeHtml(row.associatedAt || '—'),
  },
  {
    key: 'updatedAt',
    title: '档案更新时间',
    width: 165,
    sortable: true,
    sortValue: (row) => row.machine.updatedAt,
    render: (row) => escapeHtml(row.machine.updatedAt),
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    required: true,
    actionColumn: true,
    render: actions,
  },
]

const listController = createProcessOrderListController({
  state,
  columns,
  preferenceKey: PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-wool-machines-root]',
  tableSurfaceSelector: '[data-wool-machines-table-surface]',
  paginationSurfaceSelector: '[data-wool-machines-pagination-surface]',
  overlaysSurfaceSelector: '[data-wool-machines-column-overlays]',
  defaultFrozenKeys: ['machine'],
  columnSettingsTitle: '横机设备列设置',
  emptyText: '当前条件下暂无横机设备',
  getRows: machineRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('[data-wool-machines-root]')
}

function hydrate(surface: ParentNode | null): void {
  if (!surface) return
  void import('../../../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(surface))
    .catch(() => undefined)
}

function filterBar(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
    <label class="min-w-[20rem] flex-1"><span class="mb-1 block text-xs text-muted-foreground">设备 / 加工单 / 生产单 / 款号</span><input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.filters.keyword)}" placeholder="输入关键字" data-wool-machines-field="keyword" data-skip-page-rerender="true"></label>
    <label class="min-w-[11rem]"><span class="mb-1 block text-xs text-muted-foreground">设备状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-machines-field="status" data-skip-page-rerender="true"><option value="">全部状态</option>${(['IDLE', 'PRODUCING', 'REPAIR', 'DISABLED'] as WoolMachineStatus[]).map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label>
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filters', skipPageRerender: true }, 'rotate-ccw')}
  </div>`
}

function renderFeedback(): string {
  return state.feedback
    ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">${escapeHtml(state.feedback)}</div>`
    : ''
}

function statusOptions(machine: WoolMachineView): WoolMachineAvailability[] {
  if (machine.status === 'PRODUCING' || machine.status === 'IDLE') return ['REPAIR', 'DISABLED']
  return ['IDLE']
}

function statusDialog(): string {
  if (!state.overlayMachineId) return ''
  const machine = listWoolMachineViews().find((item) => item.machineId === state.overlayMachineId)
  if (!machine) return ''
  const impact = buildWoolMachineAvailabilityImpact(machine.machineId)
  const options = statusOptions(machine)
  const selectedStatus = options.includes(state.selectedNextStatus as WoolMachineAvailability)
    ? state.selectedNextStatus
    : options[0]
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-wool-machine-status-dialog>
    <section class="w-full max-w-2xl overflow-hidden rounded-lg border bg-background shadow-2xl">
      <header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">修改横机状态</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(machine.machineNo)}｜${escapeHtml(machine.machineName)}｜当前 ${escapeHtml(statusLabel(machine.status))}</p></div><button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-machines-action="close-status" data-skip-page-rerender="true">关闭</button></header>
      <div class="p-4">
        ${state.overlayError ? `<div class="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>` : ''}
        <label class="block text-sm"><span class="mb-1 block text-xs text-muted-foreground">修改为</span><select class="h-9 w-full rounded-md border px-3" data-wool-machines-dialog-field="nextStatus" data-skip-page-rerender="true">${options.map((status) => `<option value="${status}" ${selectedStatus === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label>
        <label class="mt-3 block text-sm"><span class="mb-1 block text-xs text-muted-foreground">变更原因（必填）</span><textarea class="min-h-20 w-full rounded-md border p-3" data-wool-machines-dialog-field="reason" data-skip-page-rerender="true">${escapeHtml(state.selectedReason)}</textarea></label>
        ${impact ? `<section class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><h3 class="font-semibold">生产中设备影响确认</h3><div class="mt-2">当前加工单：${escapeHtml(impact.woolOrderNo)}（${escapeHtml(impact.woolOrderId)}）</div><div class="mt-1">生产单：${escapeHtml(impact.productionOrderNo)}｜款式：${escapeHtml(impact.styleNo)} ${escapeHtml(impact.styleName)}</div><div class="mt-1">关联时间：${escapeHtml(impact.associatedAt)}</div><div class="mt-2 text-xs">确认后系统将一次完成：解除该设备的当前关联、修改为${escapeHtml(statusLabel(selectedStatus as WoolMachineAvailability))}、写入关联日志和设备操作日志。</div>${state.impactConfirmed ? '<div class="mt-3 font-medium">请再次点击“确认影响并修改状态”。</div>' : ''}</section>` : ''}
      </div>
      <footer class="flex justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-status', skipPageRerender: true })}${renderPrimaryButton(impact && state.impactConfirmed ? '确认影响并修改状态' : '保存状态', { prefix: EVENT_PREFIX, action: 'save-status', skipPageRerender: true })}</footer>
    </section>
  </div>`
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const view = listController.getView()
  return renderStandardListPage({
    title: '横机设备',
    primaryActionsHtml: '',
    feedbackHtml: `<div data-wool-machines-feedback>${renderFeedback()}</div>`,
    filtersHtml: `<div data-wool-machines-filters>${filterBar()}</div>`,
    listTitle: '横机设备档案',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings', skipPageRerender: true }, 'settings-2'),
    tableHtml: `<div data-wool-machines-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wool-machines-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wool-machines-column-overlays>${listController.renderColumnSettings()}</div><div data-wool-machines-business-overlay>${statusDialog()}</div>`,
  })
}

export function renderCraftWoolMachinesPage(): string {
  const hasMountedRoot = typeof document !== 'undefined' && Boolean(rootElement())
  const routeKey = currentRouteKey()
  const isNewEntry = !hasMountedRoot || state.routeKey !== routeKey
  const routeState = resolveWoolMachinesRouteEntry(state, { routeKey, hasMountedRoot })
  resetStandardListEntryTransientStateOnRouteEntry(
    state,
    !isNewEntry,
  )
  if (isNewEntry) {
    cancelWoolMachinesFilterRefresh()
    state.filters = { ...DEFAULT_FILTERS }
    state.showColumnSettings = false
    state.feedback = ''
  }
  Object.assign(state, routeState)
  listController.installColumnDragEvents()
  return `<div data-wool-machines-root>${renderWorkspace()}</div>`
}

function refreshResults(): void {
  listController.refresh()
  const feedback = rootElement()?.querySelector<HTMLElement>('[data-wool-machines-feedback]')
  if (feedback) feedback.innerHTML = renderFeedback()
}

function refreshFilters(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-machines-filters]')
  if (surface) {
    surface.innerHTML = filterBar()
    hydrate(surface)
  }
}

function refreshDialog(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-machines-business-overlay]')
  if (surface) {
    surface.innerHTML = statusDialog()
    hydrate(surface)
  }
}

function dialogField(name: string): string {
  return rootElement()?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `[data-wool-machines-dialog-field="${name}"]`,
  )?.value.trim() || ''
}

function saveStatus(): void {
  const machine = listWoolMachineViews().find((item) => item.machineId === state.overlayMachineId)
  if (!machine) return
  const nextStatus = dialogField('nextStatus') as WoolMachineAvailability
  const reason = dialogField('reason')
  const impact = buildWoolMachineAvailabilityImpact(machine.machineId)
  const currentSnapshot = captureWoolMachineAvailabilitySnapshot(machine.machineId)
  const currentFingerprint = buildWoolMachineAvailabilityImpactFingerprint(
    machine.machineId,
    nextStatus,
    currentSnapshot,
  )
  if (
    state.impactConfirmed
    && state.confirmedImpactFingerprint !== currentFingerprint
  ) {
    state.impactConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    state.overlayError = '关联已变化，请重新确认'
    refreshDialog()
    return
  }
  if (impact && !state.impactConfirmed) {
    if (!reason) {
      state.overlayError = '请先填写维修或停用原因。'
      refreshDialog()
      return
    }
    state.selectedNextStatus = nextStatus
    state.selectedReason = reason
    state.impactConfirmed = true
    state.confirmedImpactFingerprint = currentFingerprint
    state.confirmedAssociationSnapshot = currentSnapshot
    state.overlayError = ''
    refreshDialog()
    return
  }
  try {
    changeWoolMachineAvailability(machine.machineId, {
      nextStatus,
      reason,
      operatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operatedBy: 'Web 端设备主管',
      confirmedImpact: Boolean(impact),
      expectedAssociationSnapshot: state.confirmedAssociationSnapshot ?? currentSnapshot,
    })
    state.feedback = impact
      ? `${machine.machineNo} 已解除当前关联并改为${statusLabel(nextStatus)}。`
      : `${machine.machineNo} 已改为${statusLabel(nextStatus)}。`
    state.overlayMachineId = ''
    state.selectedNextStatus = ''
    state.selectedReason = ''
    state.impactConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    state.overlayError = ''
    refreshDialog()
    refreshResults()
  } catch (error) {
    state.overlayError = error instanceof Error ? error.message : '设备状态未保存，请检查后重试。'
    if (state.overlayError.includes('关联已变化')) {
      state.impactConfirmed = false
      state.confirmedImpactFingerprint = ''
      state.confirmedAssociationSnapshot = undefined
    }
    refreshDialog()
  }
}

export async function handleCraftWoolMachinesEvent(target: HTMLElement): Promise<boolean> {
  const root = target.closest<HTMLElement>('[data-wool-machines-root]')
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wool-machines-field]')
  if (field?.dataset.woolMachinesField) {
    const name = field.dataset.woolMachinesField as keyof MachineFilters | 'pageSize'
    if (name === 'pageSize') {
      listController.setPageSize(Number(field.value))
      listController.refresh()
      return true
    }
    state.filters = { ...state.filters, [name]: field.value }
    state.currentPage = 1
    if (name === 'keyword') {
      scheduleWoolMachinesFilterRefresh()
    } else {
      refreshResults()
    }
    return true
  }
  const dialogStatus = target.closest<HTMLSelectElement>('[data-wool-machines-dialog-field="nextStatus"]')
  if (dialogStatus) {
    state.selectedReason = dialogField('reason')
    state.selectedNextStatus = dialogStatus.value as WoolMachineAvailability
    state.impactConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    refreshDialog()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wool-machines-action]')
  const action = actionNode?.dataset.woolMachinesAction
  if (!actionNode || !action) return false
  if (action === 'prev-page' || action === 'next-page') {
    listController.stepPage(action === 'prev-page' ? -1 : 1)
    listController.refresh()
    return true
  }
  if (action === 'sort-column') {
    listController.cycleSort(actionNode.dataset.columnKey || '')
    listController.refresh()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    listController.refresh({ table: false, pagination: false, overlays: true })
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    listController.refresh({ table: false, pagination: false, overlays: true })
    return true
  }
  if (action === 'restore-column-settings') {
    listController.restorePreferences()
    listController.refresh({ overlays: true })
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    listController.updateColumnPreference(
      action,
      actionNode.dataset.woolMachinesColumnKey
        || actionNode.closest<HTMLElement>('[data-wool-machines-column-key]')?.dataset.woolMachinesColumnKey
        || '',
      actionNode.closest<HTMLInputElement>('input')?.checked,
    )
    listController.refresh({ overlays: true })
    return true
  }
  if (action === 'reset-filters') {
    state.filters = { ...DEFAULT_FILTERS }
    state.currentPage = 1
    refreshFilters()
    refreshResults()
    return true
  }
  if (action === 'open-status') {
    state.overlayMachineId = actionNode.dataset.machineId || ''
    state.selectedNextStatus = ''
    state.selectedReason = ''
    state.impactConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    state.overlayError = ''
    refreshDialog()
    return true
  }
  if (action === 'close-status') {
    state.overlayMachineId = ''
    state.selectedNextStatus = ''
    state.selectedReason = ''
    state.impactConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    state.overlayError = ''
    refreshDialog()
    return true
  }
  if (action === 'save-status') {
    saveStatus()
    return true
  }
  return true
}
