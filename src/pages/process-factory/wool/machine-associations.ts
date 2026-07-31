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
  buildWoolMachineWorkbenchProjectionFromStore,
  captureWoolReplaceMachineAssociationSnapshot,
  listWoolMachineAssociations,
  listWoolMachineViews,
  listWoolWorkOrders,
  readWoolStore,
  replaceWoolMachineAssociations,
  type WoolMachineStatus,
  type WoolMachineView,
  type ReplaceWoolMachineAssociationsInput,
  type WoolDomainStore,
  type WoolReplaceMachineAssociationSnapshot,
  type WoolWorkOrder,
} from '../../../data/fcs/wool-task-domain.ts'
import { buildWoolMachinesLink } from '../../../data/fcs/fcs-route-links.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderKindBadge, renderStatusBadge } from './shared.ts'

const EVENT_PREFIX = 'wool-machine-associations'
const PREFERENCE_KEY = '/fcs/process-factory/wool/machine-associations:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

type AssociationFilterStatus = '' | WoolMachineStatus
type AssociationFilterLinked = '' | 'LINKED' | 'UNLINKED'

interface AssociationFilters {
  keyword: string
  status: AssociationFilterStatus
  linked: AssociationFilterLinked
}

interface MachineAssociationRow {
  machine: WoolMachineView
  order?: WoolWorkOrder
  associatedAt?: string
  associatedBy?: string
}

export interface WoolMachineTransferImpact {
  machineId: string
  machineNo: string
  fromWoolOrderId: string
  fromWoolOrderNo: string
  fromProductionOrderNo: string
  fromStyleNo: string
  associatedAt: string
}

export interface WoolMachineWorkbenchMachine {
  machineId: string
  machineNo: string
  machineName: string
  status: WoolMachineStatus
  selected: boolean
  selectable: boolean
  currentWoolOrderId?: string
  currentWoolOrderNo?: string
  currentProductionOrderNo?: string
}

export interface WoolMachineAssociationWorkbenchModel {
  lockedWoolOrderId: string
  canSave: boolean
  lockError: string
  selectedProductionOrderId: string
  selectedWoolOrderId: string
  productionOrders: Array<{
    productionOrderId: string
    productionOrderNo: string
    styleNo: string
    styleName: string
    orderCount: number
  }>
  orderOptions: WoolWorkOrder[]
  selectedOrder?: WoolWorkOrder
  readinessSummaries: Record<string, string>
  machines: WoolMachineWorkbenchMachine[]
}

export interface WoolMachineAssociationRouteEntryState {
  routeKey: string
  focusedMachineId: string
  overlayOpen: boolean
  lockedWoolOrderId: string
  selectedProductionOrderId: string
  selectedWoolOrderId: string
  selectedMachineIds: string[]
  transferConfirmed: boolean
  confirmedImpactFingerprint: string
  confirmedAssociationSnapshot?: WoolReplaceMachineAssociationSnapshot
  overlayError: string
}

const DEFAULT_FILTERS: AssociationFilters = { keyword: '', status: '', linked: '' }
const state: {
  routeKey: string
  focusedMachineId: string
  filters: AssociationFilters
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  overlayOpen: boolean
  lockedWoolOrderId: string
  selectedProductionOrderId: string
  selectedWoolOrderId: string
  selectedMachineIds: string[]
  transferConfirmed: boolean
  confirmedImpactFingerprint: string
  confirmedAssociationSnapshot?: WoolReplaceMachineAssociationSnapshot
  overlayError: string
  feedback: string
} = {
  routeKey: '',
  focusedMachineId: '',
  filters: { ...DEFAULT_FILTERS },
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['machine'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  overlayOpen: false,
  lockedWoolOrderId: '',
  selectedProductionOrderId: '',
  selectedWoolOrderId: '',
  selectedMachineIds: [],
  transferConfirmed: false,
  confirmedImpactFingerprint: '',
  overlayError: '',
  feedback: '',
}

let filterDebounce: ReturnType<typeof setTimeout> | undefined

function statusLabel(status: WoolMachineStatus): string {
  return status === 'IDLE'
    ? '空闲'
    : status === 'PRODUCING'
      ? '生产中'
      : status === 'REPAIR'
        ? '维修'
        : '停用'
}

function queryParams(): URLSearchParams {
  const [, storeQuery = ''] = (appStore.getState().pathname || '').split('?')
  if (storeQuery) return new URLSearchParams(storeQuery)
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function currentRouteKey(
  requestedWoolOrderId: string,
  requestedMachineId: string,
): string {
  const storePath = appStore.getState().pathname || ''
  const browserPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : ''
  const currentPath = storePath.startsWith('/fcs/process-factory/wool/machine-associations')
    ? storePath
    : browserPath.startsWith('/fcs/process-factory/wool/machine-associations')
      ? browserPath
      : '/fcs/process-factory/wool/machine-associations'
  const [pathname, query = ''] = currentPath.split('?')
  const params = new URLSearchParams(query)
  if (requestedWoolOrderId) params.set('woolOrderId', requestedWoolOrderId)
  else params.delete('woolOrderId')
  if (requestedMachineId) params.set('machineId', requestedMachineId)
  else params.delete('machineId')
  const normalizedQuery = params.toString()
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname
}

function uniqueProductionOrders(orders: WoolWorkOrder[]) {
  const groups = new Map<string, WoolWorkOrder[]>()
  orders.forEach((order) => groups.set(order.productionOrderId, [
    ...(groups.get(order.productionOrderId) ?? []),
    order,
  ]))
  return [...groups.entries()]
    .map(([productionOrderId, grouped]) => ({
      productionOrderId,
      productionOrderNo: grouped[0].productionOrderNo,
      styleNo: grouped[0].styleNo,
      styleName: grouped[0].styleName,
      orderCount: grouped.length,
    }))
    .sort((left, right) => left.productionOrderNo.localeCompare(right.productionOrderNo))
}

export function buildWoolMachineAssociationWorkbenchModel(input: {
  productionOrderId?: string
  woolOrderId?: string
  selectedWoolOrderId?: string
} = {}, readStore: () => WoolDomainStore = readWoolStore): WoolMachineAssociationWorkbenchModel {
  const projection = buildWoolMachineWorkbenchProjectionFromStore(readStore())
  const allOrders = projection.orders.map((item) => item.order)
  const orderProjectionById = new Map(
    projection.orders.map((item) => [item.order.woolOrderId, item]),
  )
  const lockedWoolOrderId = input.woolOrderId?.trim() || ''
  const lockedOrder = lockedWoolOrderId
    ? allOrders.find((order) => order.woolOrderId === lockedWoolOrderId)
    : undefined
  const maintainableOrders = projection.orders
    .filter((item) => item.canMaintainAssociation)
    .map((item) => item.order)
  let selectedProductionOrderId = ''
  let orderOptions: WoolWorkOrder[] = []
  let selectedOrder: WoolWorkOrder | undefined
  let lockError = ''
  let canSave = false
  if (lockedWoolOrderId) {
    if (!lockedOrder) {
      lockError = `找不到毛织加工单 ${lockedWoolOrderId}，不可保存横机关联。`
    } else {
      selectedProductionOrderId = lockedOrder.productionOrderId
      orderOptions = [lockedOrder]
      selectedOrder = lockedOrder
      const lockedProjection = orderProjectionById.get(lockedOrder.woolOrderId)
      canSave = Boolean(lockedProjection?.canMaintainAssociation)
      if (!canSave) {
        lockError = lockedProjection?.completed
          ? `毛织加工单 ${lockedOrder.woolOrderNo} 已完成，不可维护横机关联。`
          : `毛织加工单 ${lockedOrder.woolOrderNo} 当前不可维护横机关联。`
      }
    }
  } else {
    selectedProductionOrderId = input.productionOrderId || ''
    orderOptions = selectedProductionOrderId
      ? maintainableOrders.filter((order) => order.productionOrderId === selectedProductionOrderId)
      : []
    const requestedOrder = input.selectedWoolOrderId
      ? orderOptions.find((order) => order.woolOrderId === input.selectedWoolOrderId)
      : undefined
    selectedOrder = requestedOrder || (orderOptions.length === 1 ? orderOptions[0] : undefined)
    canSave = Boolean(selectedOrder)
  }
  const associations = projection.associations
  const associationsByMachine = new Map(associations.map((item) => [item.machineId, item]))
  const currentForTarget = new Set(
    selectedOrder
      ? associations.filter((item) => item.woolOrderId === selectedOrder.woolOrderId).map((item) => item.machineId)
      : [],
  )
  const ordersById = new Map(allOrders.map((order) => [order.woolOrderId, order]))
  return {
    lockedWoolOrderId,
    canSave,
    lockError,
    selectedProductionOrderId,
    selectedWoolOrderId: selectedOrder?.woolOrderId || '',
    productionOrders: uniqueProductionOrders(maintainableOrders),
    orderOptions,
    selectedOrder,
    readinessSummaries: Object.fromEntries(
      projection.orders.map((item) => [item.order.woolOrderId, item.readinessSummary]),
    ),
    machines: projection.machines.map((machine) => {
      const association = associationsByMachine.get(machine.machineId)
      const currentOrder = association ? ordersById.get(association.woolOrderId) : undefined
      return {
        machineId: machine.machineId,
        machineNo: machine.machineNo,
        machineName: machine.machineName,
        status: machine.status,
        selected: currentForTarget.has(machine.machineId),
        selectable: machine.status === 'IDLE' || machine.status === 'PRODUCING',
        ...(currentOrder
          ? {
              currentWoolOrderId: currentOrder.woolOrderId,
              currentWoolOrderNo: currentOrder.woolOrderNo,
              currentProductionOrderNo: currentOrder.productionOrderNo,
            }
          : {}),
      }
    }),
  }
}

export function saveWoolMachineAssociationSelection(
  model: WoolMachineAssociationWorkbenchModel,
  machineIds: string[],
  actor: ReplaceWoolMachineAssociationsInput,
) {
  if (!model.canSave || !model.selectedWoolOrderId) {
    throw new Error(
      model.lockError || '当前未选择可维护的毛织加工单，不可保存横机关联。',
    )
  }
  return replaceWoolMachineAssociations(model.selectedWoolOrderId, machineIds, actor)
}

export function resolveWoolMachineAssociationRouteEntry(
  previous: WoolMachineAssociationRouteEntryState | undefined,
  input: {
    routeKey: string
    hasMountedRoot: boolean
    requestedWoolOrderId: string
    requestedMachineId?: string
  },
): WoolMachineAssociationRouteEntryState {
  const isNewEntry = !input.hasMountedRoot || previous?.routeKey !== input.routeKey
  if (!isNewEntry && previous) return { ...previous }
  const clean: WoolMachineAssociationRouteEntryState = {
    routeKey: input.routeKey,
    focusedMachineId: input.requestedMachineId?.trim() || '',
    overlayOpen: false,
    lockedWoolOrderId: '',
    selectedProductionOrderId: '',
    selectedWoolOrderId: '',
    selectedMachineIds: [],
    transferConfirmed: false,
    confirmedImpactFingerprint: '',
    confirmedAssociationSnapshot: undefined,
    overlayError: '',
  }
  const requestedWoolOrderId = input.requestedWoolOrderId.trim()
  if (!requestedWoolOrderId) return clean
  const model = buildWoolMachineAssociationWorkbenchModel({
    woolOrderId: requestedWoolOrderId,
  })
  return {
    ...clean,
    overlayOpen: true,
    lockedWoolOrderId: model.lockedWoolOrderId,
    selectedProductionOrderId: model.selectedProductionOrderId,
    selectedWoolOrderId: model.selectedWoolOrderId,
    selectedMachineIds: model.machines
      .filter((item) => item.selected)
      .map((item) => item.machineId),
    overlayError: model.lockError,
  }
}

export function cancelWoolMachineAssociationFilterRefresh(): void {
  if (filterDebounce) clearTimeout(filterDebounce)
  filterDebounce = undefined
}

export function scheduleWoolMachineAssociationFilterRefresh(
  callback: () => void = refreshResults,
  delay = 180,
): void {
  cancelWoolMachineAssociationFilterRefresh()
  filterDebounce = setTimeout(() => {
    filterDebounce = undefined
    callback()
  }, delay)
}

export function getWoolMachineTransferImpacts(
  woolOrderId: string,
  machineIds: string[],
): WoolMachineTransferImpact[] {
  const selected = new Set(machineIds)
  const orders = new Map(listWoolWorkOrders().map((order) => [order.woolOrderId, order]))
  const machines = new Map(listWoolMachineViews().map((machine) => [machine.machineId, machine]))
  return listWoolMachineAssociations()
    .filter((association) =>
      selected.has(association.machineId) && association.woolOrderId !== woolOrderId,
    )
    .map((association) => {
      const order = orders.get(association.woolOrderId)
      const machine = machines.get(association.machineId)
      return {
        machineId: association.machineId,
        machineNo: machine?.machineNo || association.machineId,
        fromWoolOrderId: association.woolOrderId,
        fromWoolOrderNo: order?.woolOrderNo || association.woolOrderId,
        fromProductionOrderNo: order?.productionOrderNo || '—',
        fromStyleNo: order?.styleNo || '—',
        associatedAt: association.associatedAt,
      }
    })
    .sort((left, right) => left.machineNo.localeCompare(right.machineNo, 'zh-CN'))
}

export function buildWoolMachineAssociationImpactFingerprint(
  woolOrderId: string,
  machineIds: string[],
  impacts: WoolMachineTransferImpact[],
): string {
  return JSON.stringify({
    woolOrderId,
    machineIds: [...new Set(machineIds)].sort(),
    impacts: impacts
      .map(({ machineId, fromWoolOrderId, associatedAt }) => ({
        machineId,
        fromWoolOrderId,
        associatedAt,
      }))
      .sort((left, right) =>
        left.machineId.localeCompare(right.machineId)
        || left.fromWoolOrderId.localeCompare(right.fromWoolOrderId)
        || left.associatedAt.localeCompare(right.associatedAt),
      ),
  })
}

function associationRows(): MachineAssociationRow[] {
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
        associatedBy: association?.associatedBy,
      }
    })
    .filter((row) => !state.filters.status || row.machine.status === state.filters.status)
    .filter((row) => !state.focusedMachineId || row.machine.machineId === state.focusedMachineId)
    .filter((row) =>
      !state.filters.linked
      || (state.filters.linked === 'LINKED' ? Boolean(row.order) : !row.order),
    )
    .filter((row) => {
      if (!keyword) return true
      return [
        row.machine.machineId,
        row.machine.machineNo,
        row.machine.machineName,
        row.order?.woolOrderId,
        row.order?.woolOrderNo,
        row.order?.productionOrderNo,
        row.order?.styleNo,
        row.order?.styleName,
        row.order?.internalStyleCode,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(keyword))
    })
}

function renderStatus(status: WoolMachineStatus): string {
  const tone = status === 'IDLE'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'PRODUCING'
      ? 'bg-blue-50 text-blue-700'
      : status === 'REPAIR'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-700'
  return `<span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}">${escapeHtml(statusLabel(status))}</span>`
}

function actionButton(row: MachineAssociationRow): string {
  if (row.machine.status === 'REPAIR' || row.machine.status === 'DISABLED') {
    return '<span class="text-xs text-muted-foreground">设备不可关联</span>'
  }
  const label = row.order ? '编辑关联 / 解除关联' : '关联生产单'
  const woolOrderId = row.order?.woolOrderId || ''
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-wool-machine-associations-action="open-association" data-wool-order-id="${escapeHtml(woolOrderId)}" data-machine-id="${escapeHtml(row.machine.machineId)}" data-skip-page-rerender="true">${escapeHtml(label)}</button>`
}

const columns: StandardListColumn<MachineAssociationRow>[] = [
  {
    key: 'machine',
    title: '设备编号 / 名称',
    width: 200,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.machine.machineNo,
    render: (row) => `<div><div class="font-mono text-xs font-medium">${escapeHtml(row.machine.machineNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.machine.machineName)}</div></div>`,
  },
  {
    key: 'status',
    title: '当前状态',
    width: 110,
    required: true,
    sortable: true,
    sortValue: (row) => statusLabel(row.machine.status),
    render: (row) => renderStatus(row.machine.status),
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
    key: 'woolOrder',
    title: '当前毛织加工单',
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
    title: '款号 / 款名 / 内部货号',
    width: 260,
    sortable: true,
    sortValue: (row) => row.order?.styleNo,
    render: (row) => row.order
      ? `<div><div class="font-medium">${escapeHtml(row.order.styleNo)} ${escapeHtml(row.order.styleName)}</div><div class="mt-1 text-xs text-muted-foreground">内部货号：${escapeHtml(row.order.internalStyleCode || '—')}</div></div>`
      : '—',
  },
  {
    key: 'operator',
    title: '关联人',
    width: 130,
    sortable: true,
    sortValue: (row) => row.associatedBy,
    render: (row) => escapeHtml(row.associatedBy || '—'),
  },
  {
    key: 'associatedAt',
    title: '关联时间',
    width: 165,
    sortable: true,
    sortValue: (row) => row.associatedAt,
    render: (row) => escapeHtml(row.associatedAt || '—'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    required: true,
    actionColumn: true,
    render: actionButton,
  },
]

const listController = createProcessOrderListController({
  state,
  columns,
  preferenceKey: PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-wool-machine-associations-root]',
  tableSurfaceSelector: '[data-wool-machine-associations-table-surface]',
  paginationSurfaceSelector: '[data-wool-machine-associations-pagination-surface]',
  overlaysSurfaceSelector: '[data-wool-machine-associations-column-overlays]',
  defaultFrozenKeys: ['machine'],
  columnSettingsTitle: '横机生产关联列设置',
  emptyText: '当前条件下暂无横机设备',
  getRows: associationRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('[data-wool-machine-associations-root]')
}

function hydrate(surface: ParentNode | null): void {
  if (!surface) return
  void import('../../../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(surface))
    .catch(() => undefined)
}

function filtersHtml(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
    <label class="min-w-[18rem] flex-1"><span class="mb-1 block text-xs text-muted-foreground">生产单 / 加工单 / 款号 / 内部货号 / 设备</span><input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.filters.keyword)}" placeholder="输入关键字" data-wool-machine-associations-field="keyword" data-skip-page-rerender="true"></label>
    <label class="min-w-[10rem]"><span class="mb-1 block text-xs text-muted-foreground">设备状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-machine-associations-field="status" data-skip-page-rerender="true"><option value="">全部状态</option>${(['IDLE', 'PRODUCING', 'REPAIR', 'DISABLED'] as WoolMachineStatus[]).map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label>
    <label class="min-w-[10rem]"><span class="mb-1 block text-xs text-muted-foreground">是否关联</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-machine-associations-field="linked" data-skip-page-rerender="true"><option value="">全部</option><option value="LINKED" ${state.filters.linked === 'LINKED' ? 'selected' : ''}>已关联</option><option value="UNLINKED" ${state.filters.linked === 'UNLINKED' ? 'selected' : ''}>未关联</option></select></label>
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filters', skipPageRerender: true }, 'rotate-ccw')}
  </div>`
}

function renderFeedback(): string {
  return state.feedback
    ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">${escapeHtml(state.feedback)}</div>`
    : ''
}

function readinessSummary(
  model: WoolMachineAssociationWorkbenchModel,
  order: WoolWorkOrder,
): string {
  return model.readinessSummaries[order.woolOrderId] || '当前不可维护横机关联'
}

function associationDialog(): string {
  if (!state.overlayOpen) return ''
  const model = buildWoolMachineAssociationWorkbenchModel({
    productionOrderId: state.selectedProductionOrderId,
    ...(state.lockedWoolOrderId
      ? { woolOrderId: state.lockedWoolOrderId }
      : { selectedWoolOrderId: state.selectedWoolOrderId }),
  })
  const selectedWoolOrderId = model.selectedWoolOrderId
  const selectedIds = state.selectedWoolOrderId === selectedWoolOrderId
    ? new Set(state.selectedMachineIds)
    : new Set(model.machines.filter((item) => item.selected).map((item) => item.machineId))
  const transferImpacts = selectedWoolOrderId
    ? getWoolMachineTransferImpacts(selectedWoolOrderId, [...selectedIds])
    : []
  const orderOptions = model.orderOptions.map((order) =>
    `<option value="${escapeHtml(order.woolOrderId)}" ${selectedWoolOrderId === order.woolOrderId ? 'selected' : ''}>${escapeHtml(`${order.woolOrderNo}｜${order.kind === 'WHOLE_GARMENT' ? '整件毛织' : '部位毛织'}｜${readinessSummary(model, order)}`)}</option>`,
  ).join('')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-wool-machine-association-dialog>
    <section class="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border bg-background shadow-2xl">
      <header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">关联生产单</h2><p class="mt-1 text-xs text-muted-foreground">关系最终保存到具体毛织加工单 woolOrderId；所选横机是保存后的整组真相。</p></div><button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-machine-associations-action="close-association" data-skip-page-rerender="true">关闭</button></header>
      <div class="max-h-[70vh] overflow-y-auto p-4">
        ${state.overlayError ? `<div class="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>` : ''}
        ${model.lockError && model.lockError !== state.overlayError ? `<div class="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(model.lockError)}</div>` : ''}
        <div class="grid gap-3 md:grid-cols-2">
          <label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">生产单</span><select class="h-9 w-full rounded-md border px-3" data-wool-machine-associations-dialog-field="productionOrderId" data-skip-page-rerender="true" ${model.lockedWoolOrderId ? 'disabled' : ''}><option value="">请选择生产单</option>${model.productionOrders.map((item) => `<option value="${escapeHtml(item.productionOrderId)}" ${model.selectedProductionOrderId === item.productionOrderId ? 'selected' : ''}>${escapeHtml(`${item.productionOrderNo}｜${item.styleNo} ${item.styleName}｜${item.orderCount} 张可维护加工单`)}</option>`).join('')}</select></label>
          <label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">具体毛织加工单</span><select class="h-9 w-full rounded-md border px-3" data-wool-machine-associations-dialog-field="woolOrderId" data-skip-page-rerender="true" ${model.lockedWoolOrderId || model.orderOptions.length === 1 ? 'disabled' : ''}><option value="">${model.orderOptions.length > 1 ? '请选择具体加工单' : '请先选择生产单'}</option>${orderOptions}</select></label>
        </div>
        ${model.selectedOrder ? `<section class="mt-3 rounded-md border bg-muted/20 p-3 text-sm"><div class="font-medium">${escapeHtml(model.selectedOrder.woolOrderNo)}｜${model.selectedOrder.kind === 'WHOLE_GARMENT' ? '整件毛织' : '部位毛织'}</div><div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(model.selectedOrder.productionOrderNo)}｜款式：${escapeHtml(model.selectedOrder.styleNo)} ${escapeHtml(model.selectedOrder.styleName)}｜齐料摘要：${escapeHtml(readinessSummary(model, model.selectedOrder))}</div></section>` : ''}
        <section class="mt-4"><div class="mb-2 flex items-center justify-between"><h3 class="text-sm font-semibold">选择横机设备</h3><span class="text-xs text-muted-foreground">可选空闲、生产中；维修、停用可见但禁用。取消全部选择即解除本单全部关联。</span></div><div class="grid gap-2 md:grid-cols-2">${model.machines.map((machine) => `<label class="flex items-start gap-3 rounded-md border p-3 ${machine.selectable ? '' : 'bg-muted/40 text-muted-foreground'}"><input type="checkbox" class="mt-1" data-wool-machine-associations-machine-id="${escapeHtml(machine.machineId)}" data-skip-page-rerender="true" ${selectedIds.has(machine.machineId) ? 'checked' : ''} ${machine.selectable ? '' : 'disabled'}><span><span class="font-medium">${escapeHtml(machine.machineNo)}｜${escapeHtml(machine.machineName)}</span><span class="mt-1 block text-xs">${escapeHtml(statusLabel(machine.status))}${machine.currentWoolOrderNo ? `｜当前：${escapeHtml(machine.currentWoolOrderNo)} / ${escapeHtml(machine.currentProductionOrderNo || '—')}` : '｜当前未关联'}</span></span></label>`).join('')}</div></section>
        ${transferImpacts.length ? `<section class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3"><h3 class="text-sm font-semibold text-amber-900">跨单转移影响</h3>${transferImpacts.map((impact) => `<div class="mt-2 text-xs text-amber-900">${escapeHtml(impact.machineNo)} 将从 ${escapeHtml(impact.fromWoolOrderNo)}（生产单 ${escapeHtml(impact.fromProductionOrderNo)}，款号 ${escapeHtml(impact.fromStyleNo)}，关联时间 ${escapeHtml(impact.associatedAt)}）转移到当前加工单。</div>`).join('')}${state.transferConfirmed ? '<div class="mt-3 font-medium text-amber-900">请再次点击“确认跨单转移并保存”。</div>' : ''}</section>` : ''}
      </div>
      <footer class="flex justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-association', skipPageRerender: true })}${model.canSave ? renderPrimaryButton(transferImpacts.length && state.transferConfirmed ? '确认跨单转移并保存' : '保存整组关联', { prefix: EVENT_PREFIX, action: 'save-association', skipPageRerender: true }) : '<button type="button" class="h-9 rounded-md border bg-muted px-4 text-sm text-muted-foreground" disabled>不可保存</button>'}</footer>
    </section>
  </div>`
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const view = listController.getView()
  return renderStandardListPage({
    title: '横机生产关联',
    primaryActionsHtml: `<div class="flex gap-2">${renderPrimaryButton('关联生产单', { prefix: EVENT_PREFIX, action: 'open-association', skipPageRerender: true }, 'link')}${`<button type="button" class="h-9 rounded-md border px-4 text-sm" data-nav="${escapeHtml(buildWoolMachinesLink())}">横机设备</button>`}</div>`,
    feedbackHtml: `<div data-wool-machine-associations-feedback>${renderFeedback()}</div>`,
    filtersHtml: `<div data-wool-machine-associations-filters>${filtersHtml()}</div>`,
    listTitle: '全部横机当前生产关系',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings', skipPageRerender: true }, 'settings-2'),
    tableHtml: `<div data-wool-machine-associations-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wool-machine-associations-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wool-machine-associations-column-overlays>${listController.renderColumnSettings()}</div><div data-wool-machine-associations-business-overlay>${associationDialog()}</div>`,
  })
}

export function renderCraftWoolMachineAssociationsPage(): string {
  const params = queryParams()
  const requestedOrderId = params.get('woolOrderId') || ''
  const requestedMachineId = params.get('machineId') || ''
  const hasMountedRoot = typeof document !== 'undefined' && Boolean(rootElement())
  const routeKey = currentRouteKey(requestedOrderId, requestedMachineId)
  const isNewEntry = !hasMountedRoot || state.routeKey !== routeKey
  const routeState = resolveWoolMachineAssociationRouteEntry(state, {
    routeKey,
    hasMountedRoot,
    requestedWoolOrderId: requestedOrderId,
    requestedMachineId,
  })
  resetStandardListEntryTransientStateOnRouteEntry(
    state,
    !isNewEntry,
  )
  if (isNewEntry) {
    cancelWoolMachineAssociationFilterRefresh()
    state.filters = { ...DEFAULT_FILTERS }
    state.showColumnSettings = false
    state.feedback = ''
  }
  Object.assign(state, routeState)
  listController.installColumnDragEvents()
  return `<div data-wool-machine-associations-root>${renderWorkspace()}</div>`
}

function refreshResults(): void {
  listController.refresh()
  const feedback = rootElement()?.querySelector<HTMLElement>('[data-wool-machine-associations-feedback]')
  if (feedback) feedback.innerHTML = renderFeedback()
}

function refreshFilters(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-machine-associations-filters]')
  if (surface) {
    surface.innerHTML = filtersHtml()
    hydrate(surface)
  }
}

function refreshOverlay(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-machine-associations-business-overlay]')
  if (surface) {
    surface.innerHTML = associationDialog()
    hydrate(surface)
  }
}

function openAssociation(woolOrderId = ''): void {
  const model = buildWoolMachineAssociationWorkbenchModel({ woolOrderId })
  state.overlayOpen = true
  state.lockedWoolOrderId = woolOrderId
  state.selectedProductionOrderId = model.selectedProductionOrderId
  state.selectedWoolOrderId = model.selectedWoolOrderId
  state.selectedMachineIds = model.machines.filter((item) => item.selected).map((item) => item.machineId)
  state.transferConfirmed = false
  state.confirmedImpactFingerprint = ''
  state.confirmedAssociationSnapshot = undefined
  state.overlayError = model.lockError
  refreshOverlay()
}

function readCheckedMachineIds(): string[] {
  return Array.from(
    rootElement()?.querySelectorAll<HTMLInputElement>('[data-wool-machine-associations-machine-id]:checked')
      ?? [],
  ).map((item) => item.dataset.woolMachineAssociationsMachineId || '').filter(Boolean)
}

function saveAssociation(): void {
  const model = buildWoolMachineAssociationWorkbenchModel({
    productionOrderId: state.selectedProductionOrderId,
    ...(state.lockedWoolOrderId
      ? { woolOrderId: state.lockedWoolOrderId }
      : { selectedWoolOrderId: state.selectedWoolOrderId }),
  })
  if (!model.canSave || !model.selectedWoolOrderId) {
    state.overlayError = model.lockError
      || '同一生产单存在多张可维护加工单时，请先选择具体毛织加工单。'
    refreshOverlay()
    return
  }
  const woolOrderId = model.selectedWoolOrderId
  const machineIds = readCheckedMachineIds()
  const impacts = getWoolMachineTransferImpacts(woolOrderId, machineIds)
  const impactFingerprint = buildWoolMachineAssociationImpactFingerprint(
    woolOrderId,
    machineIds,
    impacts,
  )
  if (
    state.transferConfirmed
    && state.confirmedImpactFingerprint !== impactFingerprint
  ) {
    state.selectedMachineIds = machineIds
    state.transferConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    state.overlayError = '关联已变化，请重新确认'
    refreshOverlay()
    return
  }
  if (impacts.length && !state.transferConfirmed) {
    state.selectedMachineIds = machineIds
    state.transferConfirmed = true
    state.confirmedImpactFingerprint = impactFingerprint
    state.confirmedAssociationSnapshot = captureWoolReplaceMachineAssociationSnapshot(
      woolOrderId,
      machineIds,
    )
    state.overlayError = ''
    refreshOverlay()
    return
  }
  try {
    saveWoolMachineAssociationSelection(model, machineIds, {
      operatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operatedBy: 'Web 端毛织主管',
      expectedAssociationSnapshot: state.confirmedAssociationSnapshot
        ?? captureWoolReplaceMachineAssociationSnapshot(woolOrderId, machineIds),
    })
    state.feedback = machineIds.length
      ? '横机整组关联已保存。'
      : '当前加工单的横机关联已全部解除。'
    state.overlayOpen = false
    state.lockedWoolOrderId = ''
    state.selectedProductionOrderId = ''
    state.selectedWoolOrderId = ''
    state.selectedMachineIds = []
    state.transferConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    refreshOverlay()
    refreshResults()
  } catch (error) {
    state.overlayError = error instanceof Error ? error.message : '关联未保存，请检查后重试。'
    if (state.overlayError.includes('关联已变化')) {
      state.transferConfirmed = false
      state.confirmedImpactFingerprint = ''
      state.confirmedAssociationSnapshot = undefined
    }
    refreshOverlay()
  }
}

export async function handleCraftWoolMachineAssociationsEvent(target: HTMLElement): Promise<boolean> {
  const root = target.closest<HTMLElement>('[data-wool-machine-associations-root]')
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wool-machine-associations-field]')
  if (field?.dataset.woolMachineAssociationsField) {
    const name = field.dataset.woolMachineAssociationsField as keyof AssociationFilters | 'pageSize'
    if (name === 'pageSize') {
      listController.setPageSize(Number(field.value))
      listController.refresh()
      return true
    }
    state.filters = { ...state.filters, [name]: field.value }
    state.currentPage = 1
    if (name === 'keyword') {
      scheduleWoolMachineAssociationFilterRefresh()
    } else {
      refreshResults()
    }
    return true
  }
  const dialogField = target.closest<HTMLSelectElement>('[data-wool-machine-associations-dialog-field]')
  if (dialogField) {
    if (dialogField.dataset.woolMachineAssociationsDialogField === 'productionOrderId') {
      state.selectedProductionOrderId = dialogField.value
      const model = buildWoolMachineAssociationWorkbenchModel({ productionOrderId: dialogField.value })
      state.selectedWoolOrderId = model.selectedWoolOrderId
      state.selectedMachineIds = model.machines.filter((item) => item.selected).map((item) => item.machineId)
    } else {
      state.selectedWoolOrderId = dialogField.value
      const model = buildWoolMachineAssociationWorkbenchModel({
        productionOrderId: state.selectedProductionOrderId,
        selectedWoolOrderId: dialogField.value,
      })
      state.selectedMachineIds = model.machines.filter((item) => item.selected).map((item) => item.machineId)
    }
    state.transferConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    refreshOverlay()
    return true
  }
  const machineCheckbox = target.closest<HTMLInputElement>('[data-wool-machine-associations-machine-id]')
  if (machineCheckbox) {
    state.selectedMachineIds = readCheckedMachineIds()
    state.transferConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    refreshOverlay()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wool-machine-associations-action]')
  const action = actionNode?.dataset.woolMachineAssociationsAction
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
      actionNode.dataset.woolMachineAssociationsColumnKey
        || actionNode.closest<HTMLElement>('[data-wool-machine-associations-column-key]')?.dataset.woolMachineAssociationsColumnKey
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
  if (action === 'open-association') {
    openAssociation(actionNode.dataset.woolOrderId || '')
    return true
  }
  if (action === 'close-association') {
    state.overlayOpen = false
    state.lockedWoolOrderId = ''
    state.overlayError = ''
    state.transferConfirmed = false
    state.confirmedImpactFingerprint = ''
    state.confirmedAssociationSnapshot = undefined
    refreshOverlay()
    return true
  }
  if (action === 'save-association') {
    saveAssociation()
    return true
  }
  return true
}
