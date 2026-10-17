import { createSpecialCraftDisplayColumns, resetSpecialCraftDisplayContext } from './order-display.ts'
import { renderProcessOrderStats } from '../../../components/ui/process-order-list-presentation.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderPrimaryButton } from '../../../components/ui/button.ts'
import {handleWoolCraftActionUi} from '../wool/craft-actions.ts'
// @page-pattern: list

import {
  buildSpecialCraftTaskDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../../../data/fcs/special-craft-task-orders.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  getFastSpecialCraftWebActions,
  getSpecialCraftWorkObjectMeta,
} from './shared.ts'
import { appStore } from '../../../state/store.ts'

import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'

const PREF_STORAGE_KEY = 'higood:list-page:/fcs/craft/special-craft/work-orders:dye-layout-v1'
const PAGE_SIZES = [10, 20, 50]
const MAX_FROZEN_WIDTH = 360

interface ExpandedTaskOrderRow { taskOrder: SpecialCraftTaskOrder }

const TASK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '全部', label: '全部加工单' },
  { value: '待接收', label: '待接收' },
  { value: '加工中', label: '加工中' },
  { value: '已完结', label: '已完结' },
]

const TASK_TIME_RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'TODAY', label: '今日' },
  { value: '7D', label: '近 7 天' },
  { value: '30D', label: '近 30 天' },
  { value: 'ALL', label: '全部时间' },
]

const COLUMNS: StandardListColumn<ExpandedTaskOrderRow>[] = [
  ...createSpecialCraftDisplayColumns(order => `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(buildSpecialCraftTaskDetailPath(order, order.taskOrderId))}">${escapeHtml(order.taskOrderNo)}</button>`).map(column => ({
    ...column,
    render: (row: ExpandedTaskOrderRow, index: number) => column.render(row.taskOrder, index),
    renderHeader: column.renderHeader ? (rows: readonly ExpandedTaskOrderRow[]) => column.renderHeader!(rows.map(row => row.taskOrder)) : undefined,
    sortValue: column.sortValue ? (row: ExpandedTaskOrderRow) => column.sortValue!(row.taskOrder) : undefined,
  })),
  {
    key: 'actions', title: '操作', width: 160, actionColumn: true, required: true,
    render(row) {
      const detailHref = buildSpecialCraftTaskDetailPath(
        { operationId: row.taskOrder.operationId },
        row.taskOrder.taskOrderId,
      )
      const webActions = getFastSpecialCraftWebActions(row.taskOrder)
      const actionable = webActions.filter((a) => !a.disabledReason && a.actionCode !== 'SPECIAL_CRAFT_COMPLETE_ORDER').slice(0, 3)
      const objectMeta = row.taskOrder.woolPieceKey ? {objectType:'毛织片',objectLabel:'毛织片',qtyUnit:'片'} : getSpecialCraftWorkObjectMeta(row.taskOrder)
      const objectType = objectMeta.objectType
      const objectQty = row.taskOrder.quantityMode === 'TICKET_INPUT_OUTPUT'
        ? row.taskOrder.outputQty || row.taskOrder.inputTicketCount || 1
        : row.taskOrder.currentQty || row.taskOrder.planQty || 1
      const qtyUnit = objectMeta.qtyUnit
      const quickButtons = actionable
        .map((a) => {
          const quantityField = a.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE'
            ? `本次实收${objectMeta.objectLabel}数量`
            : a.actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT'
              ? `本次完工${objectMeta.objectLabel}数量`
              : a.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
                ? `本次交出${objectMeta.objectLabel}数量`
                : ''
          const requiredFields = [
            ...(quantityField ? [quantityField] : []),
            ...a.requiredFields,
          ]
            .map((f) => objectType === '裁片' ? f : f.replaceAll('裁片', objectMeta.objectLabel))
          const optionalFields = a.optionalFields
            .map((f) => objectType === '裁片' ? f : f.replaceAll('裁片', objectMeta.objectLabel))
          const actionLabel = objectType === '裁片' ? a.actionLabel : a.actionLabel.replaceAll('裁片', objectMeta.objectLabel)
          const confirmText = objectType === '裁片' ? a.confirmText : a.confirmText.replaceAll('裁片', objectMeta.objectLabel)
          return `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
            data-skip-page-rerender="true"
            data-special-craft-web-action="open-web-status-action-dialog"
            data-source-id="${escapeHtml(row.taskOrder.taskOrderId)}"
            data-action-code="${escapeHtml(a.actionCode)}"
            data-action-label="${escapeHtml(actionLabel)}"
            data-from-status="${escapeHtml(a.fromStatus)}"
            data-to-status="${escapeHtml(a.toStatus)}"
            data-required-fields="${escapeHtml(requiredFields.join('|'))}"
            data-optional-fields="${escapeHtml(optionalFields.join('|'))}"
            data-confirm-text="${escapeHtml(confirmText)}"
            data-object-type="${escapeHtml(objectType)}"
            data-object-qty="${escapeHtml(String(objectQty))}"
            data-qty-unit="${escapeHtml(qtyUnit)}">${escapeHtml(actionLabel)}</button>`
        })
        .join('')
      return `<div class="grid grid-cols-2 gap-x-1 gap-y-0.5">
        ${quickButtons}
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-nav="${escapeHtml(detailHref)}">详情</button>
      </div>`
    },
  },
]
const columnRules = COLUMNS.map(({key, required, freezeable, actionColumn}) => ({key, required, freezeable, actionColumn}))
const defaultPreferences: StandardListColumnPreferences = { order: COLUMNS.map(c => c.key), visibleKeys: COLUMNS.map(c => c.key), frozenKeys: ['order'], pageSize: 10 }

interface TaskListState {
  page: number
  sort: StandardListSortState | null
  prefs: StandardListColumnPreferences
  keyword: string
  statusFilter: string
  timeRange: string
  columnSettingsOpen: boolean
  draggedColumnKey: string
  prefsLoaded: boolean
}

const stateByOperation = new Map<string, TaskListState>()

function getState(operationId: string): TaskListState {
  const existing = stateByOperation.get(operationId)
  if (existing) return existing
  const fresh: TaskListState = {
    page: 1,
    sort: null,
    prefs: normalizeListColumnPreferences(columnRules, defaultPreferences, PAGE_SIZES),
    keyword: '',
    statusFilter: '全部',
    timeRange: 'ALL',
    columnSettingsOpen: false,
    draggedColumnKey: '',
    prefsLoaded: false,
  }
  stateByOperation.set(operationId, fresh)
  return fresh
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function storageKey(operationId: string): string {
  return `${PREF_STORAGE_KEY}:${operationId}`
}

function loadPrefs(operationId: string): void {
  const state = getState(operationId)
  if (state.prefsLoaded) return
  state.prefsLoaded = true
  const storage = getStorage()
  if (!storage) return
  state.prefs = loadListColumnPreferences(
    storage,
    storageKey(operationId),
    columnRules,
    defaultPreferences,
    PAGE_SIZES,
  )
}

function savePrefs(operationId: string): void {
  const storage = getStorage()
  if (!storage) return
  saveListColumnPreferences(storage, storageKey(operationId), getState(operationId).prefs)
}

function getActiveOperationId(): string | null {
  const pathname = typeof window !== 'undefined'
    ? window.location.pathname
    : (appStore.getState().pathname || '')
  const match = pathname.match(/\/fcs\/process-factory\/special-craft\/([^/]+)\/work-orders/)
  if (!match) return null
  const operation = getSpecialCraftOperationBySlug(decodeURIComponent(match[1]))
  return operation?.operationId || null
}

function renderMissingOperation(): string {
  return renderSpecialCraftPageLayout({
    operation: {
      operationId: 'UNKNOWN',
      craftCode: '',
      craftName: '特殊工艺',
      processCode: 'SPECIAL_CRAFT',
      processName: '特殊工艺',
      managementDomain: 'SPECIAL_CRAFT_FACTORY',
      managementDomainName: '特种工艺工厂管理',
      operationName: '特殊工艺',
      supportedTargetObjects: [],
      supportedTargetObjectLabels: [],
      defaultTargetObject: '已裁部位',
      targetObject: '已裁部位',
      quantityMode: 'SAME_UNIT',
      inputUnit: '片',
      outputUnit: '片',
      receiverWarehouseName: '裁床厂待加工仓',
      visibleFactoryTypes: [],
      visibleFactoryIds: [],
      requiresTaskOrder: true,
      requiresFactoryWarehouse: true,
      requiresFeiTicketScan: false,
      mustReturnToCuttingFactory: false,
      isEnabled: false,
      remark: '',
    },
    title: '工艺加工单',
    description: '未找到对应特殊工艺，请从左侧菜单重新进入。',
    activeSubNav: 'tasks',
    content: renderEmptyState('未找到对应特殊工艺。'),
  })
}

function renderFilters(state: TaskListState): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input type="text" value="${escapeHtml(state.keyword)}" placeholder="加工单号、生产单、工厂、部位或物料 SKU" class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-special-craft-task-list-field="keyword"></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-special-craft-task-list-field="statusFilter">${TASK_STATUS_OPTIONS.map(option => `<option value="${option.value}" ${state.statusFilter === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">建单时间</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-special-craft-task-list-field="timeRange">${TASK_TIME_RANGE_OPTIONS.map(option => `<option value="${option.value}" ${state.timeRange === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', {prefix:'special-craft-task-list',action:'apply-filters'},'search')}${renderSecondaryButton('重置', {prefix:'special-craft-task-list',action:'reset-filters'},'rotate-ccw')}</div></div>`
}
function renderStats(taskOrders: SpecialCraftTaskOrder[]): string {
  return renderProcessOrderStats([
    {label:'加工单数',value:taskOrders.length},
    ...['待接收','加工中','已完结'].map(status => ({label:status,value:taskOrders.filter(order => order.status === status).length})),
  ])
}

function renderColumnSettings(state: TaskListState): string {
  if (!state.columnSettingsOpen) return ''
  return renderStandardListColumnSettings({
    title: '列显示设置',
    columns: COLUMNS,
    preferences: state.prefs,
    eventPrefix: 'special-craft-task-list',
    maxFrozenWidth: MAX_FROZEN_WIDTH,
  })
}

function buildFilters(state: TaskListState) {
  return {
    keyword: state.keyword || undefined,
    status: state.statusFilter === '全部' ? undefined : state.statusFilter,
    timeRange: state.timeRange as 'TODAY' | '7D' | '30D' | 'ALL',
  }
}

function expandRows(taskOrders: SpecialCraftTaskOrder[]): ExpandedTaskOrderRow[] {
  return taskOrders.map(taskOrder => ({taskOrder}))
}

export function renderSpecialCraftTaskOrdersPage(operationSlug: string): string {
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  if (!operation) return renderMissingOperation()

  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: `${operation.operationName}加工单`,
      description: '',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }

  const state = getState(operation.operationId)
  loadPrefs(operation.operationId)

  if (typeof document !== 'undefined' && document.querySelector<HTMLElement>('[data-craft-orders-root]')?.dataset.operationId !== operation.operationId) {
    state.page = 1
    state.sort = null
    state.columnSettingsOpen = false
  }
  const taskOrders = getSpecialCraftTaskOrders(operation.operationId, {...buildFilters(state), factoryId: factoryGuard.factoryId || undefined})
  resetSpecialCraftDisplayContext()
  const expandedRows = expandRows(taskOrders)

  const sorted = state.sort
    ? sortStandardListRows(expandedRows, state.sort, (row, key) =>
        COLUMNS.find((c) => c.key === key)?.sortValue?.(row),
      )
    : expandedRows
  const slice = paginateStandardListRows(sorted, state.page, state.prefs.pageSize)
  state.page = slice.currentPage

  const uniqueTaskOrders = [...new Set(expandedRows.map((r) => r.taskOrder.taskOrderId))]
    .map((id) => expandedRows.find((r) => r.taskOrder.taskOrderId === id)!.taskOrder)

  const content = renderStandardListPage({
    title: `${operation.operationName}加工单`,
    primaryActionsHtml: ['AUX-OP-EMBROIDERY', 'AUX-OP-HEAT-TRANSFER'].includes(operation.operationId) ? `<button class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/process/material-plans?processType=${operation.operationId==='AUX-OP-EMBROIDERY'?'EMBROIDERY':'HEAT_TRANSFER'}">物料加工计划</button>` : '',
    filtersHtml: `<div data-craft-filters>${renderFilters(state)}</div>`,
    statsHtml: `<div data-craft-stats>${renderStats(uniqueTaskOrders)}</div>`,
    listTitle: `加工单列表（${taskOrders.length}）`,
    listActionsHtml: renderSecondaryButton(
      '列设置',
      { prefix: 'special-craft-task-list', action: 'open-column-settings' },
      'columns-3',
    ),
    tableHtml: `<div data-craft-table>${renderStandardListTable({
      columns: COLUMNS,
      rows: slice.rows,
      preferences: state.prefs,
      sort: state.sort,
      eventPrefix: 'special-craft-task-list',
      emptyText: '暂无加工单',
      skipPageRerender: true,
    })}</div>`,
    paginationHtml: `<div data-craft-pagination>${renderTablePagination({
      total: slice.total,
      from: slice.from,
      to: slice.to,
      currentPage: slice.currentPage,
      totalPages: slice.totalPages,
      pageSize: slice.pageSize,
      actionPrefix: 'special-craft-task-list',
      fieldPrefix: 'special-craft-task-list',
      pageSizeOptions: PAGE_SIZES,
      skipPageRerender: true,
    })}</div>`,
    overlaysHtml: `<div data-craft-overlays>${renderColumnSettings(state)}</div>`,
    className: 'space-y-3',
  })

  return `<div data-craft-orders-root data-operation-id="${escapeHtml(operation.operationId)}" data-skip-page-rerender="true">${content}</div>`
}

function handleTaskListEvent(target: Element, event?: Event): boolean {
  if(handleWoolCraftActionUi(target as HTMLElement))return true
  const operationId = getActiveOperationId()
  if (!operationId) return false

  const state = getState(operationId)

  const internalDragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined

  if (event?.type === 'dragend') {
    if (!internalDragEvent?.higoodStandardListColumnDrag) return false
    state.draggedColumnKey = ''
    return true
  }

  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (
    dragNode
    && event
    && internalDragEvent?.higoodStandardListColumnDrag
    && ['dragstart', 'dragover', 'drop'].includes(event.type)
  ) {
    const columnKey = dragNode.dataset.specialCraftTaskListColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    const column = COLUMNS.find((item) => item.key === columnKey && !item.actionColumn)

    if (event.type === 'dragstart') {
      state.draggedColumnKey = column?.key || ''
      if (!column) return false
      internalDragEvent.dataTransfer?.setData('application/x-higood-list-column-key', column.key)
      if (internalDragEvent.dataTransfer) internalDragEvent.dataTransfer.effectAllowed = 'move'
      return true
    }

    const sourceKey = internalDragEvent.higoodStandardListColumnKey || ''
    const sourceColumn = COLUMNS.find((item) => item.key === sourceKey && !item.actionColumn)
    const targetColumn = COLUMNS.find((item) => item.key === columnKey && !item.actionColumn)
    if (
      !sourceColumn
      || !targetColumn
      || state.draggedColumnKey !== sourceColumn.key
      || sourceColumn.key === targetColumn.key
    ) {
      if (event.type === 'drop') state.draggedColumnKey = ''
      return false
    }

    if (event.type === 'dragover') {
      event.preventDefault()
      if (internalDragEvent.dataTransfer) internalDragEvent.dataTransfer.dropEffect = 'move'
      return true
    }

    state.draggedColumnKey = ''
    event.preventDefault()
    const order = state.prefs.order.filter((key) => key !== sourceColumn.key)
    const targetIndex = order.indexOf(targetColumn.key)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceColumn.key)
    state.prefs = normalizeListColumnPreferences(columnRules, {
      ...state.prefs,
      order,
    }, PAGE_SIZES)
    savePrefs(operationId)
    return true
  }

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-special-craft-task-list-field]')
  const field = fieldNode?.dataset.specialCraftTaskListField
  if (field === 'pageSize') {
    if (event?.type !== 'change') return false
    const pageSize = Number(fieldNode!.value)
    if (PAGE_SIZES.includes(pageSize)) {
      state.prefs = normalizeListColumnPreferences(columnRules, {
        ...state.prefs,
        pageSize,
      }, PAGE_SIZES)
      state.page = 1
      savePrefs(operationId)
      return true
    }
    return true
  }

  if (field === 'keyword') {
    if (event?.type !== 'input' && event?.type !== 'change') return false
    return true
  }

  if (field === 'statusFilter') {
    if (event?.type !== 'change') return false
    return true
  }

  if (field === 'timeRange') {
    if (event?.type !== 'change') return false
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-special-craft-task-list-action]')
  const action = actionNode?.dataset.specialCraftTaskListAction
  if (!actionNode || !action) return false

  if (action === 'prev-page' || action === 'next-page') {
    state.page += action === 'prev-page' ? -1 : 1
    return true
  }

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = COLUMNS.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    state.sort = state.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.page = 1
    return true
  }

  if (action === 'open-column-settings') {
    state.columnSettingsOpen = true
    return true
  }

  if (action === 'close-column-settings') {
    state.columnSettingsOpen = false
    return true
  }

  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.specialCraftTaskListColumnKey || actionNode.dataset.columnKey || ''
    const rule = columnRules.find((item) => item.key === columnKey)
    if (!rule || rule.required || rule.actionColumn) return true
    const visibleKeys = new Set(state.prefs.visibleKeys)
    const frozenKeys = new Set(state.prefs.frozenKeys)
    if (visibleKeys.has(columnKey)) {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    } else {
      visibleKeys.add(columnKey)
    }
    state.prefs = normalizeListColumnPreferences(columnRules, {
      ...state.prefs,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    }, PAGE_SIZES)
    if (!visibleKeys.has(columnKey) && state.sort?.key === columnKey) state.sort = null
    savePrefs(operationId)
    return true
  }

  if (action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.specialCraftTaskListColumnKey || actionNode.dataset.columnKey || ''
    const column = COLUMNS.find((item) => item.key === columnKey)
    if (!column?.freezeable || column.actionColumn) return true
    const frozenKeys = new Set(state.prefs.frozenKeys)
    if (frozenKeys.has(columnKey)) {
      frozenKeys.delete(columnKey)
    } else {
      frozenKeys.add(columnKey)
    }
    const nextPrefs = normalizeListColumnPreferences(columnRules, {
      ...state.prefs,
      frozenKeys: [...frozenKeys],
    }, PAGE_SIZES)
    state.prefs = nextPrefs
    savePrefs(operationId)
    return true
  }

  if (action === 'restore-column-settings') {
    state.prefs = normalizeListColumnPreferences(columnRules, defaultPreferences, PAGE_SIZES)
    state.page = 1
    state.sort = null
    const storage = getStorage()
    if (storage) clearListColumnPreferences(storage, storageKey(operationId))
    return true
  }

  if (action === 'apply-filters') {
    const keywordInput = document.querySelector<HTMLInputElement>('[data-special-craft-task-list-field="keyword"]')
    const timeRangeSelect = document.querySelector<HTMLSelectElement>('[data-special-craft-task-list-field="timeRange"]')
    const statusSelect = document.querySelector<HTMLSelectElement>('[data-special-craft-task-list-field="statusFilter"]')
    state.keyword = keywordInput?.value || ''
    state.timeRange = timeRangeSelect?.value || 'ALL'
    state.statusFilter = statusSelect?.value || '全部'
    state.page = 1
    return true
  }

  if (action === 'reset-filters') {
    state.keyword = ''
    state.statusFilter = '全部'
    state.timeRange = 'ALL'
    state.page = 1
    return true
  }


  return false
}

export function handleSpecialCraftTaskOrdersEvent(target: Element, event?: Event): boolean {
  const operationId = getActiveOperationId()
  const root = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-craft-orders-root]')
  if (!operationId || !root) return handleTaskListEvent(target,event)
  const state = getState(operationId)
  const action = target.closest<HTMLElement>('[data-special-craft-task-list-action]')?.dataset.specialCraftTaskListAction
  if (!handleTaskListEvent(target,event)) return false
  if (event && ['dragstart','dragover','dragend'].includes(event.type)) return true
  const field = target.closest<HTMLElement>('[data-special-craft-task-list-field]')?.dataset.specialCraftTaskListField
  if (field && ['keyword','timeRange','statusFilter'].includes(field)) return true
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    const overlays = root.querySelector<HTMLElement>('[data-craft-overlays]')
    if (overlays) { overlays.innerHTML = renderColumnSettings(state); hydrateIcons(overlays) }
    return true
  }
  if (!action && !field && !event?.type.startsWith('drag') && event?.type !== 'drop') return true
  const next = document.createElement('div')
  next.innerHTML = renderSpecialCraftTaskOrdersPage(operationId)
  const surfaces = action === 'open-column-settings' || action === 'close-column-settings'
    ? ['[data-craft-overlays]']
    : ['[data-craft-table]','[data-craft-pagination]','[data-craft-stats]','[data-craft-overlays]','[data-standard-list-table-section] > header']
  if (action === 'reset-filters') surfaces.push('[data-craft-filters]')
  for (const selector of surfaces) {
    const current = root.querySelector<HTMLElement>(selector)
    const replacement = next.querySelector<HTMLElement>(selector)
    if (!current || !replacement) continue
    const scroll = current.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft || 0
    current.innerHTML = replacement.innerHTML
    const newScroll = current.querySelector<HTMLElement>('[data-standard-list-scroll]')
    if (newScroll) newScroll.scrollLeft = scroll
    hydrateIcons(current)
  }
  return true
}
