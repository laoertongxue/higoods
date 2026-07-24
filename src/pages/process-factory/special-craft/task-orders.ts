// @page-pattern: list

import {
  buildSpecialCraftTaskDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../../../data/fcs/special-craft-task-orders.ts'
import { renderProductionOrderIdentityCell } from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  formatSpecialCraftFactoryLabel,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  getFastSpecialCraftWebActions,
  resolveSpuImageUrl,
} from './shared.ts'
import { appStore } from '../../../state/store.ts'

import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'

const PREF_STORAGE_KEY = 'higood:list-page:/fcs/craft/special-craft/task-orders'
const PAGE_SIZES = [10, 20, 50]
const MAX_FROZEN_WIDTH = 360

interface ExpandedTaskOrderRow {
  taskOrder: SpecialCraftTaskOrder
  rowType: 'garment-sku' | 'cut-piece-fei'
  // garment
  garmentColor: string
  garmentSize: string
  garmentPlanQty: number
  // cut piece
  feiTicketNo: string
  feiPartName: string
  feiColor: string
  feiSize: string
  feiPlanQty: number
}

const TASK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '全部', label: '全部任务' },
  { value: '待领料', label: '待领料' },
  { value: '加工中', label: '加工中' },
  { value: '已完结', label: '已完结' },
]

const TASK_TIME_RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'TODAY', label: '今日' },
  { value: '7D', label: '近 7 天' },
  { value: '30D', label: '近 30 天' },
  { value: 'ALL', label: '全部时间' },
]

const columnRules: StandardListColumnRule[] = [
  { key: 'thumbnail', required: true, freezeable: true },
  { key: 'taskOrderNo', required: true, freezeable: true },
  { key: 'productionOrder', freezeable: true },
  { key: 'targetObject', freezeable: true },
  { key: 'factory' },
  { key: 'qtyProgress' },
  { key: 'status', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]

const defaultPreferences: StandardListColumnPreferences = {
  order: columnRules.map((c) => c.key),
  visibleKeys: columnRules.map((c) => c.key),
  frozenKeys: [],
  pageSize: 10,
}

const COLUMNS: StandardListColumn<ExpandedTaskOrderRow>[] = [
  {
    key: 'thumbnail', title: '', width: 56, freezeable: true, required: true,
    render(row) {
      const src = resolveSpuImageUrl(row.taskOrder)
      return `<img src="${escapeHtml(src)}" class="h-10 w-10 cursor-pointer rounded object-cover"
        data-special-craft-task-list-action="view-image"
        data-image-src="${escapeHtml(src)}"
        alt="商品图" loading="lazy" />`
    },
  },
  {
    key: 'taskOrderNo', title: '加工单号', width: 180, sortable: true, required: true, freezeable: true,
    render(row) {
      return `<div class="text-sm font-medium">${escapeHtml(row.taskOrder.taskOrderNo)}</div>
        <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(row.taskOrder.sourceTriggerLabel || '生产单生成')}</div>`
    },
    sortValue: (row) => row.taskOrder.taskOrderNo,
  },
  {
    key: 'productionOrder', title: '生产单', width: 140, sortable: true, freezeable: true,
    render(row) { return renderProductionOrderIdentityCell(row.taskOrder.productionOrderNo) },
    sortValue: (row) => row.taskOrder.productionOrderNo,
  },
  {
    key: 'targetObject', title: '加工对象', width: 160, freezeable: true,
    render(row) {
      if (row.rowType === 'garment-sku') {
        return `<div class="text-sm">${escapeHtml(`${row.garmentColor} / ${row.garmentSize}`)}</div>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(row.taskOrder.targetObject)}</div>`
      }
      if (row.feiTicketNo) {
        return `<button type="button" class="text-sm text-blue-700 hover:underline font-mono text-xs"
          data-special-craft-task-list-action="view-fei-ticket"
          data-fei-ticket-no="${escapeHtml(row.feiTicketNo)}">${escapeHtml(row.feiTicketNo)}</button>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(`${row.feiPartName} / ${row.feiColor} / ${row.feiSize}`)}</div>`
      }
      return `<div class="text-sm">${escapeHtml(`${row.feiPartName} / ${row.feiColor} / ${row.feiSize}`)}</div>`
    },
  },
  {
    key: 'factory', title: '承接工厂', width: 120, sortable: true,
    render(row) { return escapeHtml(formatSpecialCraftFactoryLabel(row.taskOrder.factoryName, row.taskOrder.factoryId)) },
    sortValue: (row) => row.taskOrder.factoryName,
  },
  {
    key: 'qtyProgress', title: '数量进度', width: 160, align: 'right',
    render(row) {
      return `<div class="text-sm tabular-nums">计划 ${formatQty(row.taskOrder.planQty)}${escapeHtml(row.taskOrder.unit)}</div>
        <div class="mt-0.5 text-xs text-muted-foreground tabular-nums">接收 ${formatQty(row.taskOrder.receivedQty)} / 完成 ${formatQty(row.taskOrder.completedQty)} / 待交出 ${formatQty(row.taskOrder.waitHandoverQty)}</div>`
    },
  },
  {
    key: 'status', title: '状态', width: 100, freezeable: true,
    render(row) {
      return renderStatusBadge(row.taskOrder.status)
    },
  },
  {
    key: 'actions', title: '操作', width: 160, actionColumn: true, required: true,
    render(row) {
      const detailHref = buildSpecialCraftTaskDetailPath(
        { operationId: row.taskOrder.operationId },
        row.taskOrder.taskOrderId,
      )
      const webActions = getFastSpecialCraftWebActions(row.taskOrder)
      const actionable = webActions.filter((a) => !a.disabledReason).slice(0, 2)
      const objectType = row.taskOrder.targetObject === '成衣' ? '成衣' : '裁片'
      const objectQty = row.taskOrder.currentQty || row.taskOrder.planQty || 1
      const qtyUnit = row.taskOrder.unit || '件'
      const quickButtons = actionable
        .map((a) => {
          const requiredFields = a.requiredFields
            .map((f) => objectType === '裁片' ? f : f.replaceAll('裁片', '成衣'))
          const optionalFields = a.optionalFields
            .map((f) => objectType === '裁片' ? f : f.replaceAll('裁片', '成衣'))
          const actionLabel = objectType === '裁片' ? a.actionLabel : a.actionLabel.replaceAll('裁片', '成衣')
          const confirmText = objectType === '裁片' ? a.confirmText : a.confirmText.replaceAll('裁片', '成衣')
          return `<button type="button" class="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100"
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
      return `<div class="flex items-center gap-1">
        ${quickButtons}
        <button type="button" class="rounded border px-1.5 py-0.5 text-[11px] hover:bg-slate-50" data-nav="${escapeHtml(detailHref)}">详情</button>
      </div>`
    },
  },
]

interface TaskListState {
  page: number
  sort: StandardListSortState | null
  prefs: StandardListColumnPreferences
  keyword: string
  statusFilter: string
  timeRange: string
  columnSettingsOpen: boolean
  draggedColumnKey: string
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
  const match = pathname.match(/\/fcs\/process-factory\/special-craft\/([^/]+)\/tasks/)
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
  return `
    <section class="rounded-lg border bg-card p-4 mx-4">
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex-1 min-w-[160px]">
          <input type="text" value="${escapeHtml(state.keyword)}" placeholder="关键词（加工单号 / 生产单 / 工厂）"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-special-craft-task-list-field="keyword" />
        </div>
        <select class="h-10 w-[140px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-special-craft-task-list-field="statusFilter">
          ${TASK_STATUS_OPTIONS
            .map((option) => `<option value="${escapeHtml(option.value)}" ${state.statusFilter === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <select class="h-10 w-[120px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-special-craft-task-list-field="timeRange">
          ${TASK_TIME_RANGE_OPTIONS
            .map((option) => `<option value="${escapeHtml(option.value)}" ${state.timeRange === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          data-special-craft-task-list-action="apply-filters">筛选</button>
        <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted"
          data-special-craft-task-list-action="reset-filters">重置</button>
      </div>
    </section>
  `
}

function renderStats(taskOrders: SpecialCraftTaskOrder[]): string {
  return renderStandardListStats([
    { label: '加工单数', value: String(taskOrders.length) },
    { label: '待领料', value: String(taskOrders.filter((t) => t.status === '待领料').length) },
    { label: '加工中', value: String(taskOrders.filter((t) => t.status === '加工中').length) },
    { label: '已完结', value: String(taskOrders.filter((t) => t.status === '已完结').length) },
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
  const rows: ExpandedTaskOrderRow[] = []
  taskOrders.forEach((taskOrder) => {
    const lines = taskOrder.demandLines || []
    const isGarment = taskOrder.targetObject === '成衣'

    if (isGarment) {
      const skuGroups = new Map<string, { colorName: string; sizeCode: string; planQty: number }>()
      lines.forEach((line) => {
        const key = `${line.colorName}::${line.sizeCode}`
        const existing = skuGroups.get(key)
        if (existing) {
          existing.planQty += line.planPieceQty
        } else {
          skuGroups.set(key, { colorName: line.colorName, sizeCode: line.sizeCode, planQty: line.planPieceQty })
        }
      })
      skuGroups.forEach((group) => {
        const [color, size] = group.colorName && group.sizeCode
          ? [group.colorName, group.sizeCode]
          : group.colorName.includes('::')
            ? group.colorName.split('::')
            : [group.colorName, '-']
        rows.push({
          taskOrder,
          rowType: 'garment-sku',
          garmentColor: color, garmentSize: size, garmentPlanQty: group.planQty,
          feiTicketNo: '', feiPartName: '', feiColor: '', feiSize: '', feiPlanQty: 0,
        })
      })
    } else {
      const feiGroups = new Map<string, { partName: string; colorName: string; sizeCode: string; planQty: number }>()
      lines.forEach((line) => {
        (line.feiTicketNos?.length ? line.feiTicketNos : ['—']).forEach((ticketNo) => {
          if (feiGroups.has(ticketNo)) {
            feiGroups.get(ticketNo)!.planQty += line.planPieceQty
          } else {
            feiGroups.set(ticketNo, { partName: line.partName, colorName: line.colorName, sizeCode: line.sizeCode, planQty: line.planPieceQty })
          }
        })
      })
      if (feiGroups.size === 0) {
        rows.push({
          taskOrder, rowType: 'cut-piece-fei',
          garmentColor: '', garmentSize: '', garmentPlanQty: 0,
          feiTicketNo: '', feiPartName: taskOrder.partName || '', feiColor: taskOrder.fabricColor || '', feiSize: taskOrder.sizeCode || '', feiPlanQty: taskOrder.planQty,
        })
      } else {
        feiGroups.forEach((group, ticketNo) => {
          rows.push({
            taskOrder, rowType: 'cut-piece-fei',
            garmentColor: '', garmentSize: '', garmentPlanQty: 0,
            feiTicketNo: ticketNo, feiPartName: group.partName, feiColor: group.colorName, feiSize: group.sizeCode, feiPlanQty: group.planQty,
          })
        })
      }
    }
  })
  return rows
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

  const taskOrders = getSpecialCraftTaskOrders(operation.operationId, buildFilters(state))
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
    filtersHtml: renderFilters(state),
    statsHtml: renderStats(uniqueTaskOrders),
    listTitle: '加工单列表',
    listActionsHtml: renderSecondaryButton(
      '列设置',
      { prefix: 'special-craft-task-list', action: 'open-column-settings' },
      'columns-3',
    ),
    tableHtml: renderStandardListTable({
      columns: COLUMNS,
      rows: slice.rows,
      preferences: state.prefs,
      sort: state.sort,
      eventPrefix: 'special-craft-task-list',
      emptyText: '暂无加工单',
    }),
    paginationHtml: renderTablePagination({
      total: slice.total,
      from: slice.from,
      to: slice.to,
      currentPage: slice.currentPage,
      totalPages: slice.totalPages,
      pageSize: slice.pageSize,
      actionPrefix: 'special-craft-task-list',
      fieldPrefix: 'special-craft-task-list',
      pageSizeOptions: PAGE_SIZES,
    }),
    overlaysHtml: renderColumnSettings(state),
    className: '!py-0 space-y-3',
  })

  return renderSpecialCraftPageLayout({
    operation,
    title: '',
    description: '',
    activeSubNav: 'tasks',
    content,
  })
}

export function handleSpecialCraftTaskOrdersEvent(target: Element, event?: Event): boolean {
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
    state.keyword = (fieldNode as HTMLInputElement).value
    return true
  }

  if (field === 'statusFilter') {
    if (event?.type !== 'change') return false
    state.statusFilter = (fieldNode as HTMLSelectElement).value
    return true
  }

  if (field === 'timeRange') {
    if (event?.type !== 'change') return false
    state.timeRange = (fieldNode as HTMLSelectElement).value
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

  if (action === 'view-image') {
    const src = actionNode.dataset.imageSrc || ''
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-black/60 cursor-pointer'
    overlay.innerHTML = `<img src="${escapeHtml(src)}" class="max-h-[80vh] max-w-[80vw] rounded-lg shadow-2xl" alt="大图" />`
    overlay.addEventListener('click', () => overlay.remove())
    document.body.appendChild(overlay)
    return true
  }

  return false
}
