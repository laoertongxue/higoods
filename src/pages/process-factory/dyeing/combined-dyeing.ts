// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderButton, renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderFormDialog, renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'
import { renderDetailDrawer, renderFormDrawer } from '../../../components/ui/drawer.ts'
import { renderFormField, renderInput, renderTextarea } from '../../../components/ui/form.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderTable, renderTableActions } from '../../../components/ui/table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderToast } from '../../../components/ui/toast.ts'
import {
  completeCombinedDyeingTask,
  correctCombinedDyeingResult,
  createCombinedDyeingTask,
  deleteCombinedDyeingTask,
  getActiveCombinedDyeingMembership,
  getCombinedDyeingTaskById,
  getEffectiveDyeingFulfillment,
  listCombinedDyeingTasks,
  type CombinedDyeingAllocationVersion,
  type CombinedDyeingSatisfaction,
  type CombinedDyeingTask,
} from '../../../data/fcs/combined-dyeing-domain.ts'
import {
  listDyeWorkOrders,
  type DyeWorkOrder,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  removeCombinedDyeingTaskIdFromUrl,
  resolveCombinedDyeingDeepLink,
  resolveCombinedDyeingOverlayUrl,
  shouldClearCombinedDyeingOverlay,
} from '../../../data/fcs/combined-dyeing-deep-link.ts'

const EVENT_PREFIX = 'combined-dyeing'
const PREFERENCE_KEY = '/fcs/craft/dyeing/combined-dyeing:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const OVERLAY_PAGE_SIZE = 10
const DEFAULT_OPERATOR = '染厂主管'

type OverlayPageScope = 'candidates' | 'members' | 'versions' | 'deletions'
type OverlayPageState = Record<OverlayPageScope, { currentPage: number; pageSize: number }>

type OverlayState =
  | { kind: 'create' }
  | { kind: 'detail'; taskId: string }
  | { kind: 'complete'; taskId: string }
  | { kind: 'correct'; taskId: string }
  | { kind: 'delete'; taskId: string }
  | { kind: 'columns' }
  | null

const state: {
  currentPage: number
  keyword: string
  includeDeleted: boolean
  selectedWorkOrderIds: string[]
  overlay: OverlayState
  deepLinkedTaskId: string
  overlayError: string
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  overlayPages: OverlayPageState
} = {
  currentPage: 1,
  keyword: '',
  includeDeleted: false,
  selectedWorkOrderIds: [],
  overlay: null,
  deepLinkedTaskId: '',
  overlayError: '',
  sort: null,
  preferences: {
    order: [],
    visibleKeys: [],
    frozenKeys: ['taskNo'],
    pageSize: 10,
  },
  preferencesLoaded: false,
  overlayPages: {
    candidates: { currentPage: 1, pageSize: OVERLAY_PAGE_SIZE },
    members: { currentPage: 1, pageSize: OVERLAY_PAGE_SIZE },
    versions: { currentPage: 1, pageSize: OVERLAY_PAGE_SIZE },
    deletions: { currentPage: 1, pageSize: OVERLAY_PAGE_SIZE },
  },
}

let columnDragEventsInstalled = false
let draggedColumnKey = ''

function nowBusinessTimestamp(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function currentVersion(task: CombinedDyeingTask): CombinedDyeingAllocationVersion | undefined {
  return task.allocationVersions.find((version) => version.current)
}

export function getCombinedDyeingCurrentExcess(task: CombinedDyeingTask): number | undefined {
  return currentVersion(task)?.excessQty
}

function sumRequired(task: CombinedDyeingTask): number {
  return task.members.reduce((sum, member) => sum + member.requiredQty - member.effectiveSatisfiedQtyBeforeTask, 0)
}

function currentUnmet(task: CombinedDyeingTask): number {
  const version = currentVersion(task)
  return version ? version.allocations.reduce((sum, allocation) => sum + allocation.unmetQty, 0) : sumRequired(task)
}

function taskStatusLabel(status: CombinedDyeingTask['status']): string {
  if (status === 'WAIT_DYEING') return '待染色'
  if (status === 'COMPLETED') return '已完成'
  return '已删除'
}

function satisfactionLabel(value: CombinedDyeingSatisfaction): string {
  if (value === 'FULL') return '已满足'
  if (value === 'PARTIAL') return '部分满足'
  return '未满足'
}

function quantity(value: number | undefined, unit: string): string {
  return value === undefined ? '—' : `${value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} ${escapeHtml(unit)}`
}

function renderTaskStatus(task: CombinedDyeingTask): string {
  return renderBadge(
    taskStatusLabel(task.status),
    task.status === 'COMPLETED' ? 'success' : task.status === 'WAIT_DYEING' ? 'warning' : 'neutral',
  )
}

function renderRowActions(task: CombinedDyeingTask): string {
  const buttons = [
    { label: '查看详情', action: { prefix: EVENT_PREFIX, action: 'open-detail' }, icon: 'eye' },
  ]
  if (task.status === 'WAIT_DYEING') {
    buttons.push({ label: '完成染色', action: { prefix: EVENT_PREFIX, action: 'open-complete' }, icon: 'check-circle-2' })
  }
  if (task.status === 'COMPLETED') {
    buttons.push({ label: '更正染色结果', action: { prefix: EVENT_PREFIX, action: 'open-correct' }, icon: 'file-pen-line' })
  }
  if (task.status !== 'DELETED') {
    buttons.push({ label: '删除任务', action: { prefix: EVENT_PREFIX, action: 'open-delete' }, icon: 'trash-2', variant: 'danger' as const })
  }
  return renderTableActions(buttons, task.taskId)
}

const columns: StandardListColumn<CombinedDyeingTask>[] = [
  { key: 'taskNo', title: '合并染色任务号', width: 160, required: true, freezeable: true, sortable: true, render: (task) => `<button class="font-medium text-blue-600 hover:underline" data-combined-dyeing-action="open-detail" data-combined-dyeing-id="${escapeHtml(task.taskId)}">${escapeHtml(task.taskNo)}</button>`, sortValue: (task) => task.taskNo },
  { key: 'factory', title: '染厂', width: 170, required: true, freezeable: true, sortable: true, render: (task) => escapeHtml(task.dyeFactoryName), sortValue: (task) => task.dyeFactoryName },
  { key: 'material', title: '面料', width: 210, required: true, freezeable: true, sortable: true, render: (task) => `<div><div>${escapeHtml(task.materialName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(task.rawMaterialSku)}</div></div>`, sortValue: (task) => task.materialName },
  { key: 'color', title: '目标颜色', width: 120, sortable: true, render: (task) => escapeHtml(task.targetColor), sortValue: (task) => task.targetColor },
  { key: 'process', title: '染色工艺', width: 120, sortable: true, render: (task) => escapeHtml(task.dyeProcessName), sortValue: (task) => task.dyeProcessName },
  { key: 'members', title: '成员数', width: 90, align: 'right', sortable: true, render: (task) => String(task.members.length), sortValue: (task) => task.members.length },
  { key: 'required', title: '需求合计', width: 130, align: 'right', sortable: true, render: (task) => quantity(sumRequired(task), task.qtyUnit), sortValue: sumRequired },
  { key: 'input', title: '实际投入', width: 130, align: 'right', sortable: true, render: (task) => quantity(task.actualInputQty, task.qtyUnit), sortValue: (task) => task.actualInputQty },
  { key: 'output', title: '实际产出', width: 130, align: 'right', sortable: true, render: (task) => quantity(task.actualOutputQty, task.qtyUnit), sortValue: (task) => task.actualOutputQty },
  { key: 'unmet', title: '未满足数量', width: 140, align: 'right', sortable: true, render: (task) => quantity(currentUnmet(task), task.qtyUnit), sortValue: currentUnmet },
  { key: 'excess', title: '超出数量', width: 130, align: 'right', sortable: true, render: (task) => quantity(getCombinedDyeingCurrentExcess(task), task.qtyUnit), sortValue: getCombinedDyeingCurrentExcess },
  { key: 'status', title: '状态', width: 100, required: true, sortable: true, render: renderTaskStatus, sortValue: (task) => task.status },
  { key: 'createdAt', title: '创建时间', width: 150, sortable: true, render: (task) => escapeHtml(formatDateTime(task.createdAt)), sortValue: (task) => task.createdAt },
  { key: 'completedAt', title: '完成时间', width: 150, sortable: true, render: (task) => escapeHtml(formatDateTime(task.completedAt || '')), sortValue: (task) => task.completedAt },
  { key: 'actions', title: '操作', width: 300, required: true, actionColumn: true, render: renderRowActions },
]

const columnRules = columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))
export function createDefaultCombinedDyeingPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map((column) => column.key),
    visibleKeys: columns.map((column) => column.key),
    frozenKeys: ['taskNo'],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

export function restoreCombinedDyeingPreferences(
  storage?: { removeItem(key: string): unknown },
): StandardListColumnPreferences {
  if (storage) clearListColumnPreferences(storage, PREFERENCE_KEY)
  return createDefaultCombinedDyeingPreferences()
}

export function paginateCombinedDyeingOverlayRows<T>(
  rows: readonly T[],
  currentPage: number,
  pageSize = OVERLAY_PAGE_SIZE,
) {
  return paginateStandardListRows(rows, currentPage, pageSize)
}

export function toggleCombinedDyeingSelection(selectedIds: readonly string[], workOrderId: string): string[] {
  return selectedIds.includes(workOrderId)
    ? selectedIds.filter((id) => id !== workOrderId)
    : [...selectedIds, workOrderId]
}

export function parseCombinedDyeingResultInputs(
  rawActualInputQty: string,
  rawActualOutputQty: string,
): { actualInputQty: number; actualOutputQty: number } {
  const inputText = rawActualInputQty.trim()
  const outputText = rawActualOutputQty.trim()
  if (!inputText) throw new Error('实际投入总量不能为空')
  if (!outputText) throw new Error('实际产出总量不能为空')
  return { actualInputQty: Number(inputText), actualOutputQty: Number(outputText) }
}

export function submitCombinedDyeingResultInputs<T>(
  rawActualInputQty: string,
  rawActualOutputQty: string,
  submit: (quantities: { actualInputQty: number; actualOutputQty: number }) => T,
): T {
  return submit(parseCombinedDyeingResultInputs(rawActualInputQty, rawActualOutputQty))
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = createDefaultCombinedDyeingPreferences()
  state.preferences = typeof window === 'undefined'
    ? defaults
    : loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaults, PAGE_SIZE_OPTIONS)
}

function filteredTasks(): CombinedDyeingTask[] {
  const keyword = state.keyword.trim().toLocaleLowerCase('zh-CN')
  return listCombinedDyeingTasks({ includeDeleted: state.includeDeleted })
    .filter((task) => state.includeDeleted || task.status !== 'DELETED')
    .filter((task) => !keyword || [task.taskNo, task.dyeFactoryName, task.materialName, task.rawMaterialSku, task.targetColor, task.dyeProcessName]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword)))
}

function renderFilters(): string {
  return `
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div class="min-w-[16rem] flex-1">
        <label class="mb-1 block text-xs text-muted-foreground">任务号 / 染厂 / 面料 / 颜色 / 工艺</label>
        ${renderInput({ value: state.keyword, placeholder: '输入关键词后查询', prefix: EVENT_PREFIX, field: 'keyword' })}
      </div>
      <label class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
        <input type="checkbox" class="h-4 w-4" data-combined-dyeing-field="includeDeleted" ${state.includeDeleted ? 'checked' : ''}>
        查看已删除任务
      </label>
      ${renderSecondaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}
      ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}
    </div>
  `
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const tasks = filteredTasks()
  const sorted = sortStandardListRows(tasks, state.sort, (task, key) => columns.find((column) => column.key === key)?.sortValue?.(task))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const tableHtml = renderStandardListTable({
    columns,
    rows: paging.rows,
    preferences: state.preferences,
    sort: state.sort,
    eventPrefix: EVENT_PREFIX,
    emptyText: state.includeDeleted ? '当前筛选下暂无合并染色任务' : '暂无当前合并染色任务，可由染厂主管手工创建',
  })
  const paginationHtml = renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: EVENT_PREFIX,
    fieldPrefix: EVENT_PREFIX,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  })
  const activeTasks = listCombinedDyeingTasks()

  return renderStandardListPage({
    title: '合并染色',
    primaryActionsHtml: renderPrimaryButton('创建合并染色', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus'),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待染色', value: activeTasks.filter((task) => task.status === 'WAIT_DYEING').length },
      { label: '已完成', value: activeTasks.filter((task) => task.status === 'COMPLETED').length },
      { label: '本次筛选', value: tasks.length },
      { label: '当前未满足', value: activeTasks.reduce((sum, task) => sum + currentUnmet(task), 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 }) },
    ]),
    listTitle: '合并染色任务',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml,
    paginationHtml,
  })
}

function productionCandidates(): DyeWorkOrder[] {
  return listDyeWorkOrders().filter((order) => order.sourceType === 'PRODUCTION_ORDER')
}

function remainingNeedForCandidate(order: DyeWorkOrder): number {
  const fulfillment = getEffectiveDyeingFulfillment(order.dyeOrderId)
  return fulfillment.requiredQty > 0 ? fulfillment.remainingNeedQty : order.plannedQty
}

type CombinedDyeingCandidateIdentity = Pick<DyeWorkOrder, 'dyeOrderId' | 'dyeFactoryId' | 'materialId' | 'targetColor' | 'dyeProcessCode' | 'dyeProcessName'>

export function getCombinedDyeingCandidateReason(input: {
  order: CombinedDyeingCandidateIdentity
  selectedFirst?: CombinedDyeingCandidateIdentity
  selectedIds: readonly string[]
  activeTaskNo?: string
}): string {
  const { order, selectedFirst, selectedIds, activeTaskNo } = input
  if (activeTaskNo && !selectedIds.includes(order.dyeOrderId)) return `已参加 ${activeTaskNo}`
  if (!selectedFirst || selectedIds.includes(order.dyeOrderId)) return ''
  if (order.dyeFactoryId !== selectedFirst.dyeFactoryId) return '染厂不同'
  if (order.materialId !== selectedFirst.materialId) return '面料不同'
  if (order.targetColor !== selectedFirst.targetColor) return '目标颜色不同'
  if (order.dyeProcessCode !== selectedFirst.dyeProcessCode || order.dyeProcessName !== selectedFirst.dyeProcessName) return '染色工艺不同'
  return ''
}

function candidateReason(order: DyeWorkOrder, selectedFirst?: DyeWorkOrder): string {
  const membership = getActiveCombinedDyeingMembership(order.dyeOrderId)
  return getCombinedDyeingCandidateReason({
    order,
    selectedFirst,
    selectedIds: state.selectedWorkOrderIds,
    activeTaskNo: membership?.taskNo,
  })
}

function renderOverlayPagination(
  scope: OverlayPageScope,
  paging: { total: number; from: number; to: number; currentPage: number; totalPages: number; pageSize: number },
): string {
  return renderTablePagination({
    ...paging,
    actionPrefix: EVENT_PREFIX,
    fieldPrefix: EVENT_PREFIX,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }).replace('<footer ', `<footer data-combined-dyeing-page-scope="${scope}" `)
}

function renderCreateDrawer(): string {
  const candidates = productionCandidates()
  const paging = paginateCombinedDyeingOverlayRows(candidates, state.overlayPages.candidates.currentPage, state.overlayPages.candidates.pageSize)
  state.overlayPages.candidates.currentPage = paging.currentPage
  const first = state.selectedWorkOrderIds.length > 0 ? candidates.find((order) => order.dyeOrderId === state.selectedWorkOrderIds[0]) : undefined
  const selectedOrders = state.selectedWorkOrderIds.map((id) => candidates.find((order) => order.dyeOrderId === id)).filter((order): order is DyeWorkOrder => Boolean(order))
  const selectedQty = selectedOrders.reduce((sum, order) => sum + remainingNeedForCandidate(order), 0)
  const table = renderTable([
    {
      key: 'select', title: '选择', width: '56px', render: (order: DyeWorkOrder) => {
        const reason = candidateReason(order, first)
        const checked = state.selectedWorkOrderIds.includes(order.dyeOrderId)
        return `<input type="checkbox" class="h-4 w-4" data-combined-dyeing-action="toggle-member" data-combined-dyeing-id="${escapeHtml(order.dyeOrderId)}" ${checked ? 'checked' : ''} ${reason && !checked ? 'disabled' : ''}>`
      },
    },
    { key: 'dyeOrderNo', title: '平台加工单号', minWidth: '160px', render: (order: DyeWorkOrder) => `<div class="font-medium">${escapeHtml(order.dyeOrderNo)}</div><div class="text-xs text-muted-foreground">只读，不可改号</div>` },
    { key: 'productionOrder', title: '生产单 / 下单时间', minWidth: '180px', render: (order: DyeWorkOrder) => `<div>${escapeHtml(order.sourceProductionOrderNo || '—')}</div><div class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(order.productionOrderOrderedAt || ''))}</div>` },
    { key: 'material', title: '面料 / 颜色 / 工艺', minWidth: '220px', render: (order: DyeWorkOrder) => `<div>${escapeHtml(order.composition || order.rawMaterialSku)}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.targetColor)} · ${escapeHtml(order.dyeProcessName)}</div>` },
    { key: 'qty', title: '剩余需求', width: '110px', align: 'right' as const, render: (order: DyeWorkOrder) => quantity(remainingNeedForCandidate(order), order.qtyUnit) },
    { key: 'reason', title: '校验结果', minWidth: '130px', render: (order: DyeWorkOrder) => { const reason = candidateReason(order, first); return reason ? `<span class="text-xs text-amber-700">${escapeHtml(reason)}</span>` : '<span class="text-xs text-emerald-700">可选择</span>' } },
  ], paging.rows, { compact: true, emptyText: '暂无生产单来源染色加工单' })

  const content = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <div><span class="text-muted-foreground">已选加工单：</span><strong>${selectedOrders.length} 张</strong></div>
        <div><span class="text-muted-foreground">需求合计：</span><strong>${quantity(selectedQty, first?.qtyUnit || 'Yard')}</strong></div>
      </div>
      <p class="text-sm text-muted-foreground">首张加工单确定染厂、面料、目标颜色和染色工艺；其他不兼容项会明确原因并禁选。创建后成员立即锁定，不能增删。</p>
      ${state.overlayError ? `<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(state.overlayError)}</p>` : ''}
      <div data-combined-dyeing-page-scope="candidates" class="rounded-lg border">
        <div class="max-h-[46vh] overflow-auto">${table}</div>
        ${renderOverlayPagination('candidates', paging)}
      </div>
    </div>
  `
  return renderFormDrawer({
    title: '创建合并染色',
    subtitle: '由染厂主管手工选择生产单来源染色加工单',
    closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' },
    submitAction: { prefix: EVENT_PREFIX, action: 'submit-create', label: '创建并锁定成员' },
    submitDisabled: selectedOrders.length < 2,
    width: 'xl',
  }, content)
}

function renderMemberTable(task: CombinedDyeingTask): string {
  const version = currentVersion(task)
  const allocationByOrder = new Map(version?.allocations.map((allocation) => [allocation.dyeWorkOrderId, allocation]))
  const orderedMembers = [...task.members].sort((left, right) => {
    const orderedAtComparison = left.productionOrderOrderedAt.localeCompare(right.productionOrderOrderedAt)
    return orderedAtComparison || left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
  })
  const paging = paginateCombinedDyeingOverlayRows(orderedMembers, state.overlayPages.members.currentPage, state.overlayPages.members.pageSize)
  state.overlayPages.members.currentPage = paging.currentPage
  const table = renderTable([
    { key: 'sequence', title: '顺序', width: '64px', align: 'center' as const, render: (_member, index) => String(paging.from + index) },
    { key: 'workOrderNo', title: '平台加工单号', minWidth: '150px', render: (member) => `<div class="font-medium">${escapeHtml(member.dyeWorkOrderNo)}</div><div class="text-xs text-muted-foreground">成员已锁定</div>` },
    { key: 'productionOrder', title: '生产单 / 下单时间', minWidth: '180px', render: (member) => `<div>${escapeHtml(member.productionOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(member.productionOrderOrderedAt))}</div>` },
    { key: 'required', title: '需求量', width: '110px', align: 'right' as const, render: (member) => quantity(member.requiredQty - member.effectiveSatisfiedQtyBeforeTask, member.qtyUnit) },
    { key: 'allocated', title: '有效分配', width: '110px', align: 'right' as const, render: (member) => quantity(allocationByOrder.get(member.dyeWorkOrderId)?.allocatedQty ?? 0, member.qtyUnit) },
    { key: 'satisfaction', title: '满足状态', width: '100px', render: (member) => { const value = allocationByOrder.get(member.dyeWorkOrderId)?.satisfaction ?? 'UNMET'; return renderBadge(satisfactionLabel(value), value === 'FULL' ? 'success' : value === 'PARTIAL' ? 'warning' : 'neutral') } },
    { key: 'unmet', title: '未满足', width: '110px', align: 'right' as const, render: (member) => quantity(allocationByOrder.get(member.dyeWorkOrderId)?.unmetQty ?? member.requiredQty - member.effectiveSatisfiedQtyBeforeTask, member.qtyUnit) },
  ], paging.rows, { compact: true })
  return `<div data-combined-dyeing-page-scope="members">${table}${renderOverlayPagination('members', paging)}</div>`
}

function renderVersionHistory(task: CombinedDyeingTask): string {
  const paging = paginateCombinedDyeingOverlayRows(task.allocationVersions, state.overlayPages.versions.currentPage, state.overlayPages.versions.pageSize)
  state.overlayPages.versions.currentPage = paging.currentPage
  const table = renderTable([
    { key: 'versionNo', title: '版本', width: '70px', render: (version: CombinedDyeingAllocationVersion) => `第 ${version.versionNo} 版${version.current ? '（当前）' : ''}` },
    { key: 'input', title: '实际投入', width: '110px', align: 'right' as const, render: (version: CombinedDyeingAllocationVersion) => quantity(version.actualInputQty, task.qtyUnit) },
    { key: 'output', title: '实际产出', width: '110px', align: 'right' as const, render: (version: CombinedDyeingAllocationVersion) => quantity(version.actualOutputQty, task.qtyUnit) },
    { key: 'excess', title: '超出数量', width: '110px', align: 'right' as const, render: (version: CombinedDyeingAllocationVersion) => quantity(version.excessQty, task.qtyUnit) },
    { key: 'operator', title: '操作人 / 时间', minWidth: '170px', render: (version: CombinedDyeingAllocationVersion) => `<div>${escapeHtml(version.operator)}</div><div class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(version.operatedAt))}</div>` },
    { key: 'reason', title: '备注 / 更正原因', minWidth: '180px', render: (version: CombinedDyeingAllocationVersion) => escapeHtml(version.reason || '—') },
  ], paging.rows, { compact: true, emptyText: '尚未登记染色结果' })
  return `<div data-combined-dyeing-page-scope="versions">${table}${renderOverlayPagination('versions', paging)}</div>`
}

function renderDeletionHistory(task: CombinedDyeingTask): string {
  const rows = task.deletedAt ? [{ operator: task.deletedBy || '—', deletedAt: task.deletedAt, reason: task.deleteReason || '—' }] : []
  const paging = paginateCombinedDyeingOverlayRows(rows, state.overlayPages.deletions.currentPage, state.overlayPages.deletions.pageSize)
  state.overlayPages.deletions.currentPage = paging.currentPage
  const table = renderTable([
    { key: 'operator', title: '操作人', width: '120px', render: (row: typeof rows[number]) => escapeHtml(row.operator) },
    { key: 'deletedAt', title: '删除时间', width: '160px', render: (row: typeof rows[number]) => escapeHtml(formatDateTime(row.deletedAt)) },
    { key: 'reason', title: '删除原因', minWidth: '180px', render: (row: typeof rows[number]) => escapeHtml(row.reason) },
  ], paging.rows, { compact: true, emptyText: '当前无删除记录' })
  return `<div data-combined-dyeing-page-scope="deletions">${table}${renderOverlayPagination('deletions', paging)}</div>`
}

function renderDetailDrawerContent(task: CombinedDyeingTask): string {
  const version = currentVersion(task)
  return `
    <div class="space-y-5">
      <section class="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div><span class="text-muted-foreground">任务号：</span><strong>${escapeHtml(task.taskNo)}</strong></div>
        <div><span class="text-muted-foreground">状态：</span>${renderTaskStatus(task)}</div>
        <div><span class="text-muted-foreground">染厂：</span>${escapeHtml(task.dyeFactoryName)}</div>
        <div><span class="text-muted-foreground">面料：</span>${escapeHtml(task.materialName)}</div>
        <div><span class="text-muted-foreground">目标颜色：</span>${escapeHtml(task.targetColor)}</div>
        <div><span class="text-muted-foreground">染色工艺：</span>${escapeHtml(task.dyeProcessName)}</div>
      </section>
      <section><h3 class="mb-2 font-semibold">成员与自动分配</h3><div class="overflow-auto rounded-lg border">${renderMemberTable(task)}</div></section>
      <section class="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
        <div><span class="text-muted-foreground">实际投入：</span><strong>${quantity(task.actualInputQty, task.qtyUnit)}</strong></div>
        <div><span class="text-muted-foreground">实际产出：</span><strong>${quantity(task.actualOutputQty, task.qtyUnit)}</strong></div>
        <div><span class="text-muted-foreground">超出数量：</span><strong>${quantity(version?.excessQty, task.qtyUnit)}</strong></div>
        <div><span class="text-muted-foreground">完成人：</span>${escapeHtml(task.completedBy || '—')}</div>
        <div><span class="text-muted-foreground">完成时间：</span>${escapeHtml(formatDateTime(task.completedAt || ''))}</div>
        <div><span class="text-muted-foreground">备注：</span>${escapeHtml(task.remark || '—')}</div>
      </section>
      <section><h3 class="mb-2 font-semibold">执行与更正历史</h3><div class="overflow-auto rounded-lg border">${renderVersionHistory(task)}</div></section>
      <section class="rounded-lg border p-4 text-sm">
        <h3 class="mb-2 font-semibold">删除历史</h3>
        <div class="overflow-auto rounded-lg border">${renderDeletionHistory(task)}</div>
      </section>
    </div>
  `
}

function renderDetailOverlay(taskId: string): string {
  const task = getCombinedDyeingTaskById(taskId)
  if (!task) return ''
  const actions = [
    task.status === 'WAIT_DYEING' ? renderPrimaryButton('完成染色', { prefix: EVENT_PREFIX, action: 'open-complete' }) : '',
    task.status === 'COMPLETED' ? renderSecondaryButton('更正染色结果', { prefix: EVENT_PREFIX, action: 'open-correct' }) : '',
    task.status !== 'DELETED' ? renderDangerButton('删除任务', { prefix: EVENT_PREFIX, action: 'open-delete' }) : '',
  ].filter(Boolean).join('')
  return `<div data-combined-dyeing-id="${escapeHtml(task.taskId)}">${renderDetailDrawer({
    title: `合并染色详情 · ${task.taskNo}`,
    subtitle: '成员创建后锁定；分配顺序只由生产单下单时间和生产单号决定',
    closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' },
    width: 'xl',
  }, renderDetailDrawerContent(task), actions)}</div>`
}

function renderResultDialog(task: CombinedDyeingTask, correction: boolean): string {
  const content = `
    <div class="space-y-4" data-combined-dyeing-id="${escapeHtml(task.taskId)}">
      <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm">一次填写本次合并染色的实际投入总量和实际产出总量。系统按生产单顺序自动分配，短产部分直接记为未满足并终止，不再继续染。</p>
      ${state.overlayError ? `<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(state.overlayError)}</p>` : ''}
      ${renderFormField({ label: '实际投入总量', required: true, hint: `单位：${task.qtyUnit}` }, renderInput({ name: 'actualInputQty', value: String(task.actualInputQty ?? ''), type: 'number', placeholder: '请输入实际投入总量' }))}
      ${renderFormField({ label: '实际产出总量', required: true, hint: `单位：${task.qtyUnit}` }, renderInput({ name: 'actualOutputQty', value: String(task.actualOutputQty ?? ''), type: 'number', placeholder: '可填 0，表示本次无产出' }))}
      ${correction
        ? renderFormField({ label: '更正原因', required: true }, renderTextarea({ name: 'reason', placeholder: '填写本次更正原因', rows: 3 }))
        : renderFormField({ label: '备注' }, renderTextarea({ name: 'remark', placeholder: '选填', rows: 3 }))}
    </div>
  `
  return `<div data-combined-dyeing-id="${escapeHtml(task.taskId)}">${renderFormDialog({
    title: correction ? '更正染色结果' : '完成染色',
    description: `${task.taskNo} · ${task.members.length} 张加工单`,
    closeAction: { prefix: EVENT_PREFIX, action: 'close-overlay' },
    submitAction: { prefix: EVENT_PREFIX, action: correction ? 'submit-correct' : 'submit-complete', label: correction ? '确认更正并重新分配' : '确认完成并自动分配' },
    width: 'lg',
  }, content)}</div>`
}

function renderDeleteDialog(task: CombinedDyeingTask): string {
  return `<div data-combined-dyeing-id="${escapeHtml(task.taskId)}">${renderSimpleConfirmDialog({
    prefix: EVENT_PREFIX,
    closeAction: 'close-overlay',
    confirmAction: 'submit-delete',
    title: '删除任务',
    description: '待染色和已完成任务始终允许删除，执行与分配记录会永久保留。',
    confirmLabel: '确认删除任务',
    danger: true,
    content: `${state.overlayError ? `<p class="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(state.overlayError)}</p>` : ''}${renderFormField({ label: '删除原因', required: true }, renderTextarea({ name: 'deleteReason', placeholder: '填写删除原因', rows: 3 }))}`,
  })}</div>`
}

function renderOverlay(): string {
  if (!state.overlay) return ''
  if (state.overlay.kind === 'create') return renderCreateDrawer()
  if (state.overlay.kind === 'columns') return renderStandardListColumnSettings({ title: '合并染色列表列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 })
  const task = getCombinedDyeingTaskById(state.overlay.taskId)
  if (!task) return ''
  if (state.overlay.kind === 'detail') return renderDetailOverlay(task.taskId)
  if (state.overlay.kind === 'complete') return renderResultDialog(task, false)
  if (state.overlay.kind === 'correct') return renderResultDialog(task, true)
  return renderDeleteDialog(task)
}

export function syncCombinedDyeingDeepLink(search: string): void {
  const resolution = resolveCombinedDyeingDeepLink(
    search,
    listCombinedDyeingTasks({ includeDeleted: true }),
  )
  if (resolution.kind === 'detail') {
    state.overlay = { kind: 'detail', taskId: resolution.taskId }
    state.deepLinkedTaskId = resolution.taskId
    state.overlayError = ''
    return
  }
  if (shouldClearCombinedDyeingOverlay(resolution, state.deepLinkedTaskId)) {
    state.overlay = null
    state.deepLinkedTaskId = ''
    state.overlayError = ''
  }
}

export function renderCraftCombinedDyeingPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  if (typeof window !== 'undefined') syncCombinedDyeingDeepLink(window.location.search)
  installCombinedDyeingColumnDragEvents()
  return `
    <div data-combined-dyeing-root data-testid="combined-dyeing-root" data-skip-page-rerender="true">
      <div data-combined-dyeing-workspace>${renderWorkspace()}</div>
      <div data-combined-dyeing-overlay>${renderOverlay()}</div>
      <div data-combined-dyeing-toast-region class="fixed right-4 top-20 z-[80] w-full max-w-sm"></div>
    </div>
  `
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-combined-dyeing-root]')
}

function hydrateRegion(region: ParentNode | null): void {
  if (region) hydrateIcons(region)
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-combined-dyeing-workspace]')
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateRegion(region)
}

function refreshOverlay(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-combined-dyeing-overlay]')
  if (!region) return
  region.innerHTML = renderOverlay()
  hydrateRegion(region)
}

function showToast(title: string, description?: string, danger = false): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-combined-dyeing-toast-region]')
  if (!region) return
  region.innerHTML = renderToast({ title, description, variant: danger ? 'danger' : 'success', duration: 2600 }, `combined-dyeing-${Date.now()}`)
  hydrateRegion(region)
  window.setTimeout(() => { if (region.isConnected) region.replaceChildren() }, 2800)
}

function openOverlay(overlay: NonNullable<OverlayState>): void {
  if (typeof window !== 'undefined') {
    const nextUrl = resolveCombinedDyeingOverlayUrl(window.location.href, state.deepLinkedTaskId, overlay.kind)
    if (nextUrl !== window.location.href) window.history.replaceState(window.history.state, '', nextUrl)
  }
  state.overlay = overlay
  state.deepLinkedTaskId = ''
  state.overlayError = ''
  if (overlay.kind === 'create') {
    state.selectedWorkOrderIds = []
    state.overlayPages.candidates = { currentPage: 1, pageSize: OVERLAY_PAGE_SIZE }
  }
  if (overlay.kind === 'detail') {
    state.overlayPages.members.currentPage = 1
    state.overlayPages.versions.currentPage = 1
    state.overlayPages.deletions.currentPage = 1
  }
  refreshOverlay()
}

function taskIdFromTarget(target: HTMLElement): string {
  return target.closest<HTMLElement>('[data-combined-dyeing-id]')?.dataset.combinedDyeingId || ''
}

function fieldValue(name: string): string {
  const field = rootElement()?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)
  return field?.value.trim() || ''
}

function rawFieldValue(name: string): string {
  return rootElement()?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? ''
}

function overlayPageScope(target: Element): OverlayPageScope | null {
  const value = target.closest<HTMLElement>('[data-combined-dyeing-page-scope]')?.dataset.combinedDyeingPageScope
  return value === 'candidates' || value === 'members' || value === 'versions' || value === 'deletions' ? value : null
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
}

function installCombinedDyeingColumnDragEvents(): void {
  if (columnDragEventsInstalled || typeof document === 'undefined') return
  columnDragEventsInstalled = true
  document.addEventListener('dragstart', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-combined-dyeing-root] [data-standard-list-column-drag]')
      : null
    if (!target) return
    draggedColumnKey = target.dataset.dragSource || ''
    event.dataTransfer?.setData('text/plain', draggedColumnKey)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  })
  document.addEventListener('dragover', (event) => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('[data-combined-dyeing-root] [data-drop-target]')) event.preventDefault()
  })
  document.addEventListener('drop', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-combined-dyeing-root] [data-drop-target]')
      : null
    const sourceKey = draggedColumnKey || event.dataTransfer?.getData('text/plain') || ''
    const targetKey = target?.dataset.dropTarget || ''
    draggedColumnKey = ''
    if (!sourceKey || !targetKey || sourceKey === targetKey) return
    const regularOrder = state.preferences.order.filter((key) => key !== 'actions' && key !== sourceKey)
    const targetIndex = regularOrder.indexOf(targetKey)
    if (targetIndex < 0) return
    event.preventDefault()
    regularOrder.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(columnRules, {
      ...state.preferences,
      order: [...regularOrder, 'actions'],
    }, PAGE_SIZE_OPTIONS)
    persistPreferences()
    refreshWorkspace()
    refreshOverlay()
  })
}

function updateColumnPreference(action: string, columnKey: string): void {
  const column = columns.find((item) => item.key === columnKey)
  if (!column || column.actionColumn) return
  let visibleKeys = [...state.preferences.visibleKeys]
  let frozenKeys = [...state.preferences.frozenKeys]
  if (action === 'toggle-column-visibility' && !column.required) {
    visibleKeys = visibleKeys.includes(columnKey)
      ? state.preferences.visibleKeys.filter((key) => key !== columnKey)
      : [...state.preferences.visibleKeys, columnKey]
  }
  if (action === 'toggle-column-freeze' && column.freezeable) {
    frozenKeys = frozenKeys.includes(columnKey)
      ? state.preferences.frozenKeys.filter((key) => key !== columnKey)
      : [...state.preferences.frozenKeys, columnKey]
  }
  state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, visibleKeys, frozenKeys }, PAGE_SIZE_OPTIONS)
  persistPreferences()
  refreshWorkspace()
  refreshOverlay()
}

export function handleCraftCombinedDyeingEvent(target: HTMLElement, event?: Event): boolean {
  const root = target.closest<HTMLElement>('[data-combined-dyeing-root]')
  if (!root) return false

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-combined-dyeing-field]')
  if (fieldNode && event?.type === 'input') return true
  if (fieldNode && event?.type === 'change') {
    const field = fieldNode.dataset.combinedDyeingField
    if (field === 'includeDeleted' && fieldNode instanceof HTMLInputElement) {
      state.includeDeleted = fieldNode.checked
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    if (field === 'pageSize') {
      const size = Number(fieldNode.value)
      const scope = overlayPageScope(fieldNode)
      if (scope) {
        state.overlayPages[scope] = { currentPage: 1, pageSize: PAGE_SIZE_OPTIONS.includes(size) ? size : OVERLAY_PAGE_SIZE }
        refreshOverlay()
        return true
      }
      state.preferences = { ...state.preferences, pageSize: PAGE_SIZE_OPTIONS.includes(size) ? size : 10 }
      state.currentPage = 1
      persistPreferences()
      refreshWorkspace()
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-combined-dyeing-action]')
  if (!actionNode) return Boolean(fieldNode)
  const action = actionNode.dataset.combinedDyeingAction || ''
  const taskId = taskIdFromTarget(actionNode)

  if (action === 'open-create') { openOverlay({ kind: 'create' }); return true }
  if (action === 'open-detail' && taskId) { openOverlay({ kind: 'detail', taskId }); return true }
  if (action === 'open-complete' && taskId) { openOverlay({ kind: 'complete', taskId }); return true }
  if (action === 'open-correct' && taskId) { openOverlay({ kind: 'correct', taskId }); return true }
  if (action === 'open-delete' && taskId) { openOverlay({ kind: 'delete', taskId }); return true }
  if (action === 'open-column-settings') { openOverlay({ kind: 'columns' }); return true }
  if (action === 'close-overlay' || action === 'close-column-settings') {
    const closesDeepLink = Boolean(state.deepLinkedTaskId)
    state.overlay = null
    state.deepLinkedTaskId = ''
    state.overlayError = ''
    if (closesDeepLink && typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', removeCombinedDyeingTaskIdFromUrl(window.location.href))
    }
    refreshOverlay()
    return true
  }

  if (action === 'toggle-member') {
    const workOrderId = actionNode.dataset.combinedDyeingId || ''
    state.selectedWorkOrderIds = toggleCombinedDyeingSelection(state.selectedWorkOrderIds, workOrderId)
    state.overlayError = ''
    refreshOverlay()
    return true
  }

  if (action === 'submit-create') {
    try {
      const task = createCombinedDyeingTask({ dyeWorkOrderIds: state.selectedWorkOrderIds, createdBy: DEFAULT_OPERATOR, createdAt: nowBusinessTimestamp() })
      state.overlay = { kind: 'detail', taskId: task.taskId }
      state.overlayError = ''
      refreshWorkspace()
      refreshOverlay()
      showToast('合并染色任务已创建', `${task.taskNo} 的成员已锁定`)
    } catch (error) {
      state.overlayError = error instanceof Error ? error.message : '创建失败'
      refreshOverlay()
    }
    return true
  }

  if (action === 'submit-complete' && taskId) {
    try {
      submitCombinedDyeingResultInputs(rawFieldValue('actualInputQty'), rawFieldValue('actualOutputQty'), (quantities) => (
        completeCombinedDyeingTask(taskId, { ...quantities, remark: fieldValue('remark'), completedBy: DEFAULT_OPERATOR, completedAt: nowBusinessTimestamp() })
      ))
      state.overlay = { kind: 'detail', taskId }
      state.overlayError = ''
      refreshWorkspace(); refreshOverlay(); showToast('染色结果已登记', '未满足数量已终止，不会自动生成继续染或补染任务')
    } catch (error) { state.overlayError = error instanceof Error ? error.message : '完成失败'; refreshOverlay() }
    return true
  }

  if (action === 'submit-correct' && taskId) {
    try {
      submitCombinedDyeingResultInputs(rawFieldValue('actualInputQty'), rawFieldValue('actualOutputQty'), (quantities) => (
        correctCombinedDyeingResult(taskId, { ...quantities, reason: fieldValue('reason'), correctedBy: DEFAULT_OPERATOR, correctedAt: nowBusinessTimestamp() })
      ))
      state.overlay = { kind: 'detail', taskId }
      state.overlayError = ''
      refreshWorkspace(); refreshOverlay(); showToast('染色结果已更正', '系统已按原生产单顺序重新计算分配')
    } catch (error) { state.overlayError = error instanceof Error ? error.message : '更正失败'; refreshOverlay() }
    return true
  }

  if (action === 'submit-delete' && taskId) {
    try {
      deleteCombinedDyeingTask(taskId, { reason: fieldValue('deleteReason'), deletedBy: DEFAULT_OPERATOR, deletedAt: nowBusinessTimestamp() })
      state.overlay = null
      state.overlayError = ''
      refreshWorkspace(); refreshOverlay(); showToast('任务已删除', '执行、分配和删除记录已保留')
    } catch (error) { state.overlayError = error instanceof Error ? error.message : '删除失败'; refreshOverlay() }
    return true
  }

  if (action === 'apply-filter') {
    state.keyword = root.querySelector<HTMLInputElement>('[data-combined-dyeing-field="keyword"]')?.value.trim() || ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') { state.keyword = ''; state.includeDeleted = false; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'prev-page' || action === 'next-page') {
    const scope = overlayPageScope(actionNode)
    if (scope) {
      state.overlayPages[scope].currentPage = Math.max(1, state.overlayPages[scope].currentPage + (action === 'next-page' ? 1 : -1))
      refreshOverlay()
      return true
    }
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key !== columnKey ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc' ? { key: columnKey, direction: 'desc' }
        : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.combinedDyeingColumnKey || actionNode.closest<HTMLElement>('[data-combined-dyeing-column-key]')?.dataset.combinedDyeingColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    state.preferences = restoreCombinedDyeingPreferences(typeof window === 'undefined' ? undefined : window.localStorage)
    state.sort = null
    state.currentPage = 1
    refreshWorkspace(); refreshOverlay()
    return true
  }

  return false
}
