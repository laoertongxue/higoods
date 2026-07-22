import {
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftPreferredWarehousePath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import { buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  getSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../../../data/fcs/special-craft-task-orders.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from '../cutting/layout.helpers.ts'
import {
  formatQty,
  formatSpecialCraftFactoryLabel,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
} from './shared.ts'

type TaskTimeRange = 'TODAY' | '7D' | '30D' | 'ALL'
type TaskFilterField = 'keyword' | 'factoryId' | 'status' | 'abnormalStatus' | 'timeRange'

export interface SpecialCraftTaskListState {
  keyword: string
  factoryId: string
  status: string
  abnormalStatus: string
  timeRange: TaskTimeRange
  page: number
  pageSize: number
}

const initialTaskListState: SpecialCraftTaskListState = {
  keyword: '',
  factoryId: '全部',
  status: '全部',
  abnormalStatus: '全部',
  timeRange: 'ALL',
  page: 1,
  pageSize: 20,
}

const taskListStateByOperation = new Map<string, SpecialCraftTaskListState>()

type PersistedSpecialCraftTaskListState = Omit<SpecialCraftTaskListState, 'page'>

export interface SpecialCraftTaskListPreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function buildSpecialCraftTaskListStorageKey(operationSlug: string): string {
  return `fcs:special-craft:task-orders:${operationSlug}:filters`
}

function getTaskListStorageKey(operationId: string): string {
  return buildSpecialCraftTaskListStorageKey(buildSpecialCraftOperationSlug(operationId))
}

function getBrowserStorage(): SpecialCraftTaskListPreferenceStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function writeSpecialCraftTaskListPreference(
  storage: SpecialCraftTaskListPreferenceStorage | null,
  operationSlug: string,
  state: SpecialCraftTaskListState,
): void {
  if (!storage) return
  const persisted: PersistedSpecialCraftTaskListState = {
    keyword: state.keyword,
    factoryId: state.factoryId,
    status: state.status,
    abnormalStatus: state.abnormalStatus,
    timeRange: state.timeRange,
    pageSize: state.pageSize,
  }
  try {
    storage.setItem(buildSpecialCraftTaskListStorageKey(operationSlug), JSON.stringify(persisted))
  } catch {
    // 原型在无 localStorage 的脚本检查环境中仍可使用内存状态。
  }
}

const TASK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待领料', label: '待领料' },
  { value: '已入待加工仓', label: '已入待加工仓' },
  { value: '加工中', label: '加工中' },
  { value: '已完成', label: '已完成' },
  { value: '待交出', label: '待交出' },
  { value: '已交出', label: '已交出' },
  { value: '已回写', label: '已回写' },
  { value: '差异', label: '差异' },
  { value: '异议中', label: '异议中' },
  { value: '异常', label: '异常' },
]

const TASK_ABNORMAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '无异常', label: '无异常' },
  { value: '数量差异', label: '数量差异' },
  { value: '破损', label: '破损' },
  { value: '错片', label: '错片' },
  { value: '延期', label: '延期' },
  { value: '设备异常', label: '设备异常' },
  { value: '其他异常', label: '其他异常' },
]

const TASK_TIME_RANGE_OPTIONS: Array<{ value: TaskTimeRange; label: string }> = [
  { value: 'TODAY', label: '今日' },
  { value: '7D', label: '近 7 天' },
  { value: '30D', label: '近 30 天' },
  { value: 'ALL', label: '全部时间' },
]

function normalizeAllSelection(value: unknown): string | null {
  if (value === '' || value === 'ALL' || value === '全部') return '全部'
  return typeof value === 'string' ? value : null
}

export function readSpecialCraftTaskListPreference(
  storage: SpecialCraftTaskListPreferenceStorage | null,
  operationSlug: string,
  availableFactoryIds: readonly string[],
): SpecialCraftTaskListState {
  let parsed: Partial<PersistedSpecialCraftTaskListState> = {}
  try {
    const source = storage?.getItem(buildSpecialCraftTaskListStorageKey(operationSlug))
    const value = source ? JSON.parse(source) as unknown : null
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parsed = value as Partial<PersistedSpecialCraftTaskListState>
    }
  } catch {
    parsed = {}
  }

  const normalizedFactoryId = normalizeAllSelection(parsed.factoryId)
  const normalizedStatus = normalizeAllSelection(parsed.status)
  const normalizedAbnormalStatus = normalizeAllSelection(parsed.abnormalStatus)
  return {
    keyword: typeof parsed.keyword === 'string' ? parsed.keyword : initialTaskListState.keyword,
    factoryId: normalizedFactoryId === '全部' || (normalizedFactoryId && availableFactoryIds.includes(normalizedFactoryId))
      ? normalizedFactoryId
      : initialTaskListState.factoryId,
    status: normalizedStatus && TASK_STATUS_OPTIONS.some((item) => item.value === normalizedStatus)
      ? normalizedStatus
      : initialTaskListState.status,
    abnormalStatus: normalizedAbnormalStatus && TASK_ABNORMAL_OPTIONS.some((item) => item.value === normalizedAbnormalStatus)
      ? normalizedAbnormalStatus
      : initialTaskListState.abnormalStatus,
    timeRange: TASK_TIME_RANGE_OPTIONS.some((item) => item.value === parsed.timeRange)
      ? parsed.timeRange as TaskTimeRange
      : initialTaskListState.timeRange,
    page: 1,
    pageSize: [10, 20, 50].includes(Number(parsed.pageSize)) ? Number(parsed.pageSize) : initialTaskListState.pageSize,
  }
}

function listAvailableFactoryIds(operationId: string): string[] {
  return [...new Set(
    getSpecialCraftTaskOrders(operationId, { timeRange: 'ALL' })
      .map((item) => item.factoryId)
      .filter(Boolean),
  )]
}

function getTaskListState(operationId: string): SpecialCraftTaskListState {
  const storageKey = getTaskListStorageKey(operationId)
  const current = taskListStateByOperation.get(storageKey)
  if (current) return current
  const next = readSpecialCraftTaskListPreference(
    getBrowserStorage(),
    buildSpecialCraftOperationSlug(operationId),
    listAvailableFactoryIds(operationId),
  )
  taskListStateByOperation.set(storageKey, next)
  return next
}

function setTaskListState(operationId: string, patch: Partial<SpecialCraftTaskListState>): void {
  const storageKey = getTaskListStorageKey(operationId)
  const current = getTaskListState(operationId)
  const next = { ...current, ...patch }
  taskListStateByOperation.set(storageKey, next)
  writeSpecialCraftTaskListPreference(getBrowserStorage(), buildSpecialCraftOperationSlug(operationId), next)
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

function buildTaskOrderLightweightSummary(taskOrder: SpecialCraftTaskOrder) {
  const linkedFeiTicketCount = taskOrder.feiTicketNos.length
  const completedFeiTicketCount = taskOrder.completedQty > 0 ? linkedFeiTicketCount : 0
  const receivedFeiTicketCount = taskOrder.receivedQty > 0 ? linkedFeiTicketCount : 0
  const returnedFeiTicketCount = (taskOrder.returnedQty || 0) > 0 || taskOrder.status === '已交出' || taskOrder.status === '已回写'
    ? linkedFeiTicketCount
    : 0
  const hasDifference = taskOrder.status === '差异' || taskOrder.abnormalStatus === '数量差异'

  return {
    linkedFeiTicketCount,
    currentQty: taskOrder.currentQty ?? taskOrder.receivedQty,
    returnedFeiTicketCount,
    returnStatus:
      taskOrder.waitHandoverQty > 0
        ? '待回仓'
        : returnedFeiTicketCount > 0
          ? '已回仓'
          : linkedFeiTicketCount > 0
            ? '待绑定'
            : '无菲票',
    hasDifference,
    demandLineCount: taskOrder.demandLines?.length || 0,
  }
}

function buildFactoryOptions(taskOrders: SpecialCraftTaskOrder[]): Array<{ value: string; label: string }> {
  const seen = new Set<string>()
  const options = taskOrders
    .map((taskOrder) => ({
      value: taskOrder.factoryId,
      label: formatSpecialCraftFactoryLabel(taskOrder.factoryName, taskOrder.factoryId),
    }))
    .filter((option) => {
      if (!option.value || seen.has(option.value)) return false
      seen.add(option.value)
      return true
    })
  return [{ value: '全部', label: '全部' }, ...options]
}

function buildTaskFilters(state: SpecialCraftTaskListState) {
  return {
    factoryId: state.factoryId === '全部' ? undefined : state.factoryId,
    status: state.status === '全部' ? undefined : state.status,
    abnormalStatus: state.abnormalStatus === '全部' ? undefined : state.abnormalStatus,
    keyword: state.keyword,
    timeRange: state.timeRange,
  }
}

function renderTaskFilterSelect(
  label: string,
  field: TaskFilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
  operationId: string,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-special-craft-task-field="${field}"
        data-operation-id="${escapeHtml(operationId)}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderTaskQuickFilterRow(operationId: string, state: SpecialCraftTaskListState): string {
  const options: Array<{ value: string; label: string; tone: 'blue' | 'amber' | 'emerald' | 'rose' }> = [
    { value: '全部', label: '全部任务', tone: 'blue' },
    { value: '待领料', label: '待领料', tone: 'amber' },
    { value: '已入待加工仓', label: '待加工', tone: 'blue' },
    { value: '加工中', label: '加工中', tone: 'blue' },
    { value: '待交出', label: '待交出', tone: 'amber' },
    { value: '已完成', label: '已完成', tone: 'emerald' },
    { value: '差异', label: '差异', tone: 'rose' },
  ]
  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">快捷筛选</span>
      ${options
        .map((option) =>
          renderWorkbenchFilterChip(
            option.label,
            `data-special-craft-task-action="set-status" data-status="${option.value}" data-operation-id="${operationId}"`,
            state.status === option.value ? option.tone : 'blue',
          ),
        )
        .join('')}
    </div>
  `
}

function renderTaskFilters(
  operationId: string,
  state: SpecialCraftTaskListState,
  allTaskOrders: SpecialCraftTaskOrder[],
): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      ${renderTaskQuickFilterRow(operationId, state)}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label class="space-y-2 md:col-span-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.keyword)}"
            placeholder="加工单号 / 生产单 / 工厂 / 菲票 / 中转袋"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-special-craft-task-field="keyword"
            data-operation-id="${escapeHtml(operationId)}"
          />
        </label>
        ${renderTaskFilterSelect('工厂', 'factoryId', state.factoryId, buildFactoryOptions(allTaskOrders), operationId)}
        ${renderTaskFilterSelect('当前状态', 'status', state.status, TASK_STATUS_OPTIONS, operationId)}
        ${renderTaskFilterSelect('异常状态', 'abnormalStatus', state.abnormalStatus, TASK_ABNORMAL_OPTIONS, operationId)}
        ${renderTaskFilterSelect('时间范围', 'timeRange', state.timeRange, TASK_TIME_RANGE_OPTIONS, operationId)}
      </div>
    </div>
  `)
}

function renderTaskStateBar(operationId: string, state: SpecialCraftTaskListState): string {
  const chips = [
    state.keyword ? `关键词：${state.keyword}` : '',
    state.factoryId !== '全部' ? `工厂：${state.factoryId}` : '',
    state.status !== '全部' ? `状态：${state.status}` : '',
    state.abnormalStatus !== '全部' ? `异常：${state.abnormalStatus}` : '',
    state.timeRange !== 'ALL' ? `时间：${TASK_TIME_RANGE_OPTIONS.find((item) => item.value === state.timeRange)?.label || state.timeRange}` : '',
  ].filter(Boolean)
  return renderWorkbenchStateBar({
    summary: '当前筛选条件',
    chips: chips.map((label) => renderWorkbenchFilterChip(label, `data-special-craft-task-action="clear-filters" data-operation-id="${operationId}"`, 'blue')),
    clearAttrs: `data-special-craft-task-action="clear-filters" data-operation-id="${operationId}"`,
  })
}

function renderStatsCards(taskOrders: SpecialCraftTaskOrder[]): string {
  const taskCount = taskOrders.length
  const waitPickupCount = taskOrders.filter((item) => item.status === '待领料').length
  const waitProcessCount = taskOrders.filter((item) => item.status === '已入待加工仓').length
  const processingCount = taskOrders.filter((item) => item.status === '加工中').length
  const waitHandoverCount = taskOrders.filter((item) => item.status === '待交出').length
  const differenceCount = taskOrders.filter((item) => item.status === '差异' || item.abnormalStatus === '数量差异').length
  const totalPlanQty = taskOrders.reduce((sum, item) => sum + item.planQty, 0)

  return `
    <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      ${renderCompactKpiCard('加工单', taskCount, '当前筛选结果', 'text-blue-600')}
      ${renderCompactKpiCard('待领料', waitPickupCount, '待进入待加工仓', 'text-amber-600')}
      ${renderCompactKpiCard('待加工', waitProcessCount, '已在待加工仓', 'text-slate-900')}
      ${renderCompactKpiCard('加工中', processingCount, '现场执行中', 'text-blue-600')}
      ${renderCompactKpiCard('待交出', waitHandoverCount, '待进入待交出仓', 'text-amber-600')}
      ${renderCompactKpiCard('计划数量', formatQty(totalPlanQty), `差异 ${differenceCount} 单`, differenceCount ? 'text-rose-600' : 'text-emerald-600')}
    </section>
  `
}

function renderTaskOrdersTable(
  operationId: string,
  taskOrders: SpecialCraftTaskOrder[],
  state: SpecialCraftTaskListState,
): string {
  const pagination = paginateItems(taskOrders, state.page, state.pageSize)
  const rows = pagination.items
    .map((taskOrder) => {
      const detailHref = buildSpecialCraftTaskDetailPath(
        {
          operationId: taskOrder.operationId,
          operationName: taskOrder.operationName,
          managementDomain: taskOrder.managementDomain,
        },
        taskOrder.taskOrderId,
      )
      const warehouseHref = buildSpecialCraftPreferredWarehousePath(taskOrder)
      const summary = buildTaskOrderLightweightSummary(taskOrder)
      const objectText = [taskOrder.targetObject, taskOrder.partName, taskOrder.fabricColor, taskOrder.sizeCode]
        .filter(Boolean)
        .join(' / ')
      const sourceText = [
        `来源纸样 ${taskOrder.sourcePatternFileIds?.length || 0} 个`,
        `来源裁片明细 ${taskOrder.sourcePieceRowIds?.length || 0} 条`,
        `明细数 ${summary.demandLineCount} 条`,
      ].join(' / ')
      return `
        <tr class="align-top hover:bg-muted/20">
          <td class="px-3 py-3">
            <button type="button" class="text-left hover:underline" data-nav="${escapeHtml(detailHref)}">${escapeHtml(taskOrder.taskOrderNo)}</button>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(taskOrder.sourceTriggerLabel || '生产单生成')}</div>
            <div class="mt-1 text-xs text-muted-foreground">截止 ${escapeHtml(taskOrder.dueAt.slice(0, 10))}</div>
          </td>
          <td class="px-3 py-3">
            ${renderProductionOrderIdentityCell(taskOrder.productionOrderNo)}
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(taskOrder.techPackVersion || '正式版')}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(taskOrder.operationName)}</div>
          </td>
          <td class="px-3 py-3">
            <div class="font-medium">${escapeHtml(objectText || '—')}</div>
            <div class="mt-1 text-xs text-muted-foreground">菲票 ${summary.linkedFeiTicketCount} 张 / ${escapeHtml(summary.returnStatus)}</div>
          </td>
          <td class="px-3 py-3">${escapeHtml(formatSpecialCraftFactoryLabel(taskOrder.factoryName, taskOrder.factoryId))}</td>
          <td class="px-3 py-3">
            <div class="font-medium tabular-nums">计划 ${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}</div>
            <div class="mt-1 text-xs leading-5 text-muted-foreground">接收 ${formatQty(taskOrder.receivedQty)} / 完成 ${formatQty(taskOrder.completedQty)} / 待交出 ${formatQty(taskOrder.waitHandoverQty)}</div>
          </td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">${renderStatusBadge(taskOrder.status)}${renderStatusBadge(taskOrder.abnormalStatus)}</div>
            <div class="mt-2 text-xs leading-5 text-muted-foreground">分配状态：${escapeHtml(taskOrder.assignmentStatusLabel || '待分配')}</div>
            <div class="text-xs leading-5 text-muted-foreground">执行状态：${escapeHtml(taskOrder.executionStatusLabel || taskOrder.status)}</div>
          </td>
          <td class="px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(sourceText)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看详情</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId))}">打印流转卡</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(warehouseHref)}">查看仓库</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  const table = `
    <table class="w-full min-w-[1280px] table-auto border-collapse text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-left text-slate-600">
        <tr>
          ${[
            '加工单号',
            `${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 技术包`,
            '加工对象',
            '承接工厂',
            '数量进度',
            '状态',
            '来源链路',
            '操作',
          ].map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody class="divide-y bg-card">${rows || `<tr><td colspan="8" class="py-10 text-center text-muted-foreground">当前筛选条件下暂无加工单。</td></tr>`}</tbody>
    </table>
  `

  return `
    <section class="rounded-lg border bg-card shadow-sm">
      <div class="flex items-center justify-between border-b px-3 py-2.5">
        <h2 class="text-sm font-semibold text-foreground">加工单列表</h2>
        <span class="text-xs text-muted-foreground">共 ${taskOrders.length} 条</span>
      </div>
      ${renderStickyTableScroller(table)}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-special-craft-task-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-special-craft-task-page-size',
        extraAttrs: `data-operation-id="${escapeHtml(operationId)}"`,
        pageSizeOptions: [10, 20, 50],
      })}
    </section>
  `
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

  const state = getTaskListState(operation.operationId)
  const allTaskOrders = getSpecialCraftTaskOrders(operation.operationId, { timeRange: 'ALL' })
  const taskOrders = getSpecialCraftTaskOrders(operation.operationId, buildTaskFilters(state))
  if (state.page > Math.max(1, Math.ceil(taskOrders.length / state.pageSize))) {
    state.page = 1
  }

  const content = `
    <div class="space-y-3">
      ${renderStatsCards(taskOrders)}
      ${renderTaskFilters(operation.operationId, state, allTaskOrders)}
      ${renderTaskStateBar(operation.operationId, state)}
      ${renderTaskOrdersTable(operation.operationId, taskOrders, state)}
    </div>
  `

  return renderSpecialCraftPageLayout({
    operation,
    title: `${operation.operationName}加工单`,
    description: '',
    activeSubNav: 'tasks',
    content,
  })
}

export function handleSpecialCraftTaskOrdersEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-special-craft-task-page-size]')
  if (pageSizeNode) {
    const operationId = pageSizeNode.dataset.operationId
    if (!operationId) return false
    setTaskListState(operationId, { pageSize: Number((pageSizeNode as HTMLSelectElement).value) || 20, page: 1 })
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-special-craft-task-field]')
  if (fieldNode) {
    const operationId = fieldNode.dataset.operationId
    const field = fieldNode.dataset.specialCraftTaskField as TaskFilterField | undefined
    if (!operationId || !field) return false
    setTaskListState(operationId, { [field]: (fieldNode as HTMLInputElement | HTMLSelectElement).value, page: 1 })
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-special-craft-task-action]')
  const action = actionNode?.dataset.specialCraftTaskAction
  if (!actionNode || !action) return false
  const operationId = actionNode.dataset.operationId
  if (!operationId) return false

  if (action === 'set-status') {
    setTaskListState(operationId, { status: actionNode.dataset.status || '全部', page: 1 })
    return true
  }
  if (action === 'clear-filters') {
    setTaskListState(operationId, { ...initialTaskListState })
    return true
  }
  if (action === 'set-page') {
    setTaskListState(operationId, { page: Number(actionNode.dataset.page) || 1 })
    return true
  }

  return false
}
