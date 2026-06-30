import { productionOrders, type ProductionOrder } from '../data/fcs/production-orders.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity.ts'
import {
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  listRuntimeTaskSplitGroupsByOrder,
  mergeContinuousRuntimeTasks,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import {
  resolveTaskOutputValueSnapshot,
  sumTaskOutputValueTotals,
} from '../data/fcs/process-tasks.ts'
import { getTaskStartRuleState } from '../data/fcs/pda-start-link.ts'
import { getTaskMilestoneState } from '../data/fcs/pda-exec-link.ts'
import { listGeneratedProductionDemandArtifacts } from '../data/fcs/production-artifact-generation.ts'
import { getTaskTypeDisplayName } from '../data/fcs/page-adapters/task-execution-adapter.ts'
import {
  formatTaskDetailDimensionsText,
  summarizeTaskDetailRows,
} from '../data/fcs/task-detail-rows.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type TaskBreakdownTab = 'by-order' | 'all'
type TaskBreakdownPageScope = 'order' | 'all'

interface TaskBreakdownState {
  keyword: string
  activeTab: TaskBreakdownTab
  chainDetailOrderId: string | null
  continuousMergeOrderId: string | null
  selectedContinuousMergeTaskIds: string[]
  continuousMergeError: string
  orderPage: number
  allTaskPage: number
}

interface OrderRow {
  order: ProductionOrder
  tasks: RuntimeProcessTask[]
  sorted: RuntimeProcessTask[]
  orderTotalOutputValue?: number
  mainCount: number
  subCount: number
  dyeCount: number
  materialCount: number
  qcCount: number
  splitGroupCount: number
  splitResultCount: number
  splitSourceCount: number
  executionTaskCount: number
  chain: string
}

const state: TaskBreakdownState = {
  keyword: '',
  activeTab: 'all',
  chainDetailOrderId: null,
  continuousMergeOrderId: null,
  selectedContinuousMergeTaskIds: [],
  continuousMergeError: '',
  orderPage: 1,
  allTaskPage: 1,
}

const STAGE_ORDER = ['PREP', 'CUTTING', 'SEWING', 'SPECIAL', 'POST']
const DEFAULT_POST_CHILD_TEXT = '开扣眼、装扣子、熨烫、包装'
const TASK_BREAKDOWN_ORDER_PAGE_SIZE = 8
const TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE = 8

function taskDisplayName(task: RuntimeProcessTask): string {
  return getTaskTypeDisplayName(task)
}

function taskDisplayNo(task: RuntimeProcessTask): string {
  return task.taskNo || task.taskId
}

function getTaskUnitTypeLabel(task: RuntimeProcessTask): string {
  if (task.taskUnitType === 'WHOLE_ORDER_TASK') return '整单任务'
  if (task.taskUnitType === 'COMBINED_PROCESS_TASK') return '组合工序任务'
  if (task.taskUnitType === 'INDEPENDENT_WORK_ORDER_TASK') return '独立加工单任务'
  return '单工序任务'
}

function getCoveredProcessText(task: RuntimeProcessTask): string {
  const processes = task.coveredProcesses ?? []
  if (processes.length === 0) return task.processBusinessName || task.processNameZh || '—'
  return processes
    .map((item) => item.craftName ? `${item.processName}/${item.craftName}` : item.processName)
    .join('、')
}

function getTaskRuleSourceText(task: RuntimeProcessTask): string {
  return task.generationRuleName || task.ruleSource || '默认任务生成规则'
}

function getTaskAcceptanceModeText(task: RuntimeProcessTask): string {
  if (task.acceptanceMode === 'WHOLE_ORDER') return '整单承接'
  if (task.acceptanceMode === 'CONTINUOUS_PROCESS') return '连续工序承接'
  return '单工序承接'
}

function getTaskHandoverReceiverText(task: RuntimeProcessTask): string {
  return task.handoverReceiverName || task.receiverName || '仓库'
}

function isMergeableSingleTask(task: RuntimeProcessTask): boolean {
  return isRuntimeTaskExecutionTask(task)
    && task.defaultDocType !== 'DEMAND'
    && task.taskUnitType === 'SINGLE_PROCESS_TASK'
    && !task.isSplitSource
    && !task.isSplitResult
    && task.assignmentStatus === 'UNASSIGNED'
    && task.status === 'NOT_STARTED'
}

function getContinuousMergeCandidates(tasks: RuntimeProcessTask[]): Array<{ prev: RuntimeProcessTask; next: RuntimeProcessTask }> {
  const sorted = topoSort(tasks).filter(isMergeableSingleTask)
  const candidates: Array<{ prev: RuntimeProcessTask; next: RuntimeProcessTask }> = []
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]
    const next = sorted[index]
    const isContinuous = next.dependsOnTaskIds?.includes(prev.taskId) || next.seq === prev.seq + 1
    if (isContinuous) candidates.push({ prev, next })
  }
  return candidates
}

function getInitialContinuousMergeSelection(tasks: RuntimeProcessTask[], preferredTaskId?: string): string[] {
  const candidates = getContinuousMergeCandidates(tasks)
  const matched = preferredTaskId
    ? candidates.find(({ prev, next }) => prev.taskId === preferredTaskId || next.taskId === preferredTaskId)
    : candidates[0]
  return matched ? [matched.prev.taskId, matched.next.taskId] : []
}

function isSelectedContinuousMergeTaskContiguous(tasks: RuntimeProcessTask[], selectedTaskIds: string[]): boolean {
  const selected = topoSort(tasks)
    .filter((task) => selectedTaskIds.includes(task.taskId))
  if (selected.length < 2) return false
  for (let index = 1; index < selected.length; index += 1) {
    const prev = selected[index - 1]
    const next = selected[index]
    if (!(next.dependsOnTaskIds?.includes(prev.taskId) || next.seq === prev.seq + 1)) {
      return false
    }
  }
  return true
}

const splitTaskStatusLabel: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: '待执行',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '暂停',
  CANCELLED: '已取消',
}

const taskAssignmentStatusLabel: Record<RuntimeProcessTask['assignmentStatus'], string> = {
  UNASSIGNED: '待分配',
  ASSIGNING: '分配中',
  ASSIGNED: '已分配',
  BIDDING: '招标中',
  AWARDED: '已中标',
}

const taskExecutionStatusLabel: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: '未开工',
  IN_PROGRESS: '执行中',
  DONE: '已完工',
  BLOCKED: '暂停',
  CANCELLED: '已取消',
}

function getTaskSaleTypeText(task: RuntimeProcessTask): string {
  if (task.saleTypeSnapshot) return task.saleTypeSnapshot
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  return order?.demandSnapshot.saleType ?? '—'
}

function getTaskPlanQtyText(task: RuntimeProcessTask): string {
  const summary = summarizeTaskDetailRows(getTaskDetailRows(task), 0)
  const qty = summary.count > 0 ? summary.totalQty : task.qty
  if (!Number.isFinite(qty)) return '—'
  return `${Number(qty).toLocaleString()}${task.qtyUnit === 'SET' ? '套' : '件'}`
}

function getTaskCurrentStepText(task: RuntimeProcessTask): string {
  if (task.status === 'DONE') return '已完工'
  if (task.status === 'CANCELLED') return '已取消'
  if (task.status === 'BLOCKED') return '暂停待处理'
  if (task.assignmentStatus === 'UNASSIGNED') return '待分配'

  if (task.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP') {
    if (task.status === 'NOT_STARTED') return '待领料'
    if (task.status === 'IN_PROGRESS') return '执行中 / 待交仓库'
  }

  if (task.status === 'NOT_STARTED') return '待开工'
  if (task.status === 'IN_PROGRESS') return '执行中'
  return taskExecutionStatusLabel[task.status]
}

function stageScore(task: RuntimeProcessTask): number {
  const stageCode = task.stageCode || task.stage
  const idx = STAGE_ORDER.findIndex((stage) => stage === stageCode)
  return idx === -1 ? 99 : idx
}

function topoSort(tasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  if (tasks.length === 0) return []

  const ids = new Set(tasks.map((task) => task.taskId))
  const indegree: Record<string, number> = {}

  for (const task of tasks) {
    indegree[task.taskId] = (task.dependsOnTaskIds ?? []).filter((id) => ids.has(id)).length
  }

  const queue = tasks
    .filter((task) => indegree[task.taskId] === 0)
    .sort((a, b) => stageScore(a) - stageScore(b))

  const result: RuntimeProcessTask[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current.taskId)) continue

    visited.add(current.taskId)
    result.push(current)

    for (const next of tasks.filter((task) => (task.dependsOnTaskIds ?? []).includes(current.taskId))) {
      indegree[next.taskId] = Math.max(0, indegree[next.taskId] - 1)
      if (indegree[next.taskId] === 0) {
        queue.push(next)
      }
    }
  }

  for (const task of tasks) {
    if (!visited.has(task.taskId)) {
      result.push(task)
    }
  }

  return result
}

function getAllProcessTasks(): RuntimeProcessTask[] {
  const runtimeTasks = listRuntimeProcessTasks()
  const tasksByOrder = new Map<string, RuntimeProcessTask[]>()

  for (const task of runtimeTasks) {
    const current = tasksByOrder.get(task.productionOrderId) ?? []
    current.push(task)
    tasksByOrder.set(task.productionOrderId, current)
  }

  const result: RuntimeProcessTask[] = []
  for (const tasks of tasksByOrder.values()) {
    result.push(...tasks)
  }

  return result.filter((task) => {
    if (task.defaultDocType === 'DEMAND') return false
    return true
  })
}

function getTaskMaterialSet(allTasks: RuntimeProcessTask[]): Set<string> {
  const set = new Set<string>()

  for (const task of allTasks) {
    // 本页仅切换事实源，不改 UI 结构：领料需求按 runtime 任务字段判定，
    // 不再读取旧 material issue seed。
    if (
      task.defaultDocType === 'TASK'
      || Boolean(task.hasMaterialRequest)
      || Boolean(task.materialRequestNo)
    ) {
      set.add(task.taskId)
    }
  }
  return set
}

function getTaskQcSet(allTasks: RuntimeProcessTask[]): Set<string> {
  const set = new Set<string>()

  for (const task of allTasks) {
    // 使用任务事实上下文（工序/阶段）推导质检挂接，不再依赖旧 PROC_* 编码判断。
    if (
      task.processBusinessCode === 'QC'
      || task.stageCode === 'POST'
      || task.stage === 'POST'
    ) {
      set.add(task.taskId)
    }
  }
  return set
}

function getTaskDyeSet(allTasks: RuntimeProcessTask[]): Set<string> {
  const set = new Set<string>()
  const prepDemandOrderIds = new Set(
    listGeneratedProductionDemandArtifacts()
      .filter((artifact) => artifact.stageCode === 'PREP' && (artifact.processCode === 'PRINT' || artifact.processCode === 'DYE'))
      .map((artifact) => artifact.orderId),
  )

  if (prepDemandOrderIds.size > 0) {
    const orderFirstTask = new Map<string, RuntimeProcessTask>()
    for (const task of allTasks) {
      if (!prepDemandOrderIds.has(task.productionOrderId)) continue
      const current = orderFirstTask.get(task.productionOrderId)
      if (!current || task.seq < current.seq) {
        orderFirstTask.set(task.productionOrderId, task)
      }
    }

    for (const task of orderFirstTask.values()) {
      set.add(task.taskId)
    }
  }

  return set
}

function prevNames(task: RuntimeProcessTask, allTasks: RuntimeProcessTask[]): string {
  const ids = task.dependsOnTaskIds ?? []
  if (ids.length === 0) return '起始任务'
  return ids
    .map((id) => {
      const matched = allTasks.find((item) => item.taskId === id)
      return matched ? taskDisplayName(matched) : id
    })
    .join('、')
}

function nextNames(task: RuntimeProcessTask, allTasks: RuntimeProcessTask[]): string {
  const downstream = allTasks.filter((item) => (item.dependsOnTaskIds ?? []).includes(task.taskId))
  if (downstream.length === 0) return '末端任务'
  return downstream.map((item) => taskDisplayName(item)).join('、')
}

function chainSummaryText(
  sorted: RuntimeProcessTask[],
  taskDyeSet: Set<string>,
  materialTaskIds: Set<string>,
  qcTaskIds: Set<string>,
): string {
  if (sorted.length === 0) return '—'

  return sorted
    .map((task) => {
      let label = taskDisplayName(task)

      if (taskDyeSet.has(task.taskId)) {
        label += '（相关流程）'
      }

      if (materialTaskIds.has(task.taskId)) {
        label += '（需领料）'
      }

      if (qcTaskIds.has(task.taskId)) {
        label += '（需质检）'
      }

      return label
    })
    .join(' → ')
}

function renderNeedBadge(need: boolean, className: string): string {
  if (!need) {
    return '<span class="text-xs text-muted-foreground">不需要</span>'
  }
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-[11px] ${className}">需要</span>`
}

function clampPage(page: number, total: number, pageSize: number): number {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  return Math.min(Math.max(1, page), pageCount)
}

function renderTaskBreakdownPagination(
  scope: TaskBreakdownPageScope,
  total: number,
  currentPage: number,
  pageSize: number,
): string {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = clampPage(currentPage, total, pageSize)
  const startNo = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endNo = Math.min(total, safePage * pageSize)
  const pages: number[] = []
  const start = Math.max(1, safePage - 2)
  const end = Math.min(pageCount, start + 4)

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  return `
    <div class="flex flex-wrap items-center justify-between gap-2 pt-3">
      <div class="text-xs text-muted-foreground">显示 ${startNo}-${endNo} / 共 ${total} 条，第 ${safePage} / ${pageCount} 页</div>
      <div class="flex flex-wrap items-center gap-1">
        <button
          class="h-8 rounded-md border px-2.5 text-xs ${safePage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
          data-fast-page-render="true"
          data-breakdown-action="change-page"
          data-breakdown-page-scope="${scope}"
          data-page="${safePage - 1}"
        >上一页</button>
        ${pages
          .map((page) => `
            <button
              class="h-8 min-w-8 rounded-md border px-2.5 text-xs ${page === safePage ? 'border-blue-600 bg-blue-600 text-white' : 'hover:bg-muted'}"
              data-fast-page-render="true"
              data-breakdown-action="change-page"
              data-breakdown-page-scope="${scope}"
              data-page="${page}"
            >${page}</button>
          `)
          .join('')}
        <button
          class="h-8 rounded-md border px-2.5 text-xs ${safePage >= pageCount ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
          data-fast-page-render="true"
          data-breakdown-action="change-page"
          data-breakdown-page-scope="${scope}"
          data-page="${safePage + 1}"
        >下一页</button>
      </div>
    </div>
  `
}

function resetTaskBreakdownPages(): void {
  state.orderPage = 1
  state.allTaskPage = 1
}

function formatOutputValue(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return `${Number(value).toLocaleString()} 产值`
}

function getTaskDetailRows(task: RuntimeProcessTask) {
  if (task.scopeDetailRows && task.scopeDetailRows.length > 0) return task.scopeDetailRows
  return task.detailRows ?? []
}

function renderTaskExecutionRuleSummary(task: RuntimeProcessTask): string {
  const startRule = getTaskStartRuleState(task)
  const milestone = getTaskMilestoneState(task)
  const milestoneText = milestone.required ? milestone.ruleLabel : '不要求关键节点上报'
  const milestoneProofText = milestone.required ? milestone.proofRequirementLabel : '—'

  return `
    <p class="text-[11px] text-muted-foreground">开工：${escapeHtml(startRule.ruleLabel)}；开工凭证：${escapeHtml(startRule.proofRequirementLabel)}</p>
    <p class="text-[11px] text-muted-foreground">关键节点：${escapeHtml(milestoneText)}；节点凭证：${escapeHtml(milestoneProofText)}</p>
  `
}

function renderTaskDetailSummary(task: RuntimeProcessTask): string {
  const detailRows = getTaskDetailRows(task)
  const taskUnitText = getTaskUnitTypeLabel(task)
  const coveredProcessText = getCoveredProcessText(task)
  const ruleSourceText = getTaskRuleSourceText(task)
  const rolledUpChildNames = task.rolledUpChildProcessNames?.length
    ? task.rolledUpChildProcessNames.join('、')
    : DEFAULT_POST_CHILD_TEXT
  if (detailRows.length === 0) {
    return `
      <p class="mt-1 text-[11px] text-muted-foreground">任务类型：${escapeHtml(taskUnitText)}；覆盖工序：${escapeHtml(coveredProcessText)}；规则来源：${escapeHtml(ruleSourceText)}</p>
      <p class="mt-1 text-[11px] text-muted-foreground">任务明细行：0 条</p>
      ${renderTaskExecutionRuleSummary(task)}
      ${
        task.processBusinessCode === 'POST_FINISHING'
          ? `<p class="text-[11px] text-muted-foreground">内含：${escapeHtml(rolledUpChildNames)}</p>`
          : ''
      }
    `
  }

  const summary = summarizeTaskDetailRows(detailRows, 2)
  const firstRowDimensions = formatTaskDetailDimensionsText(detailRows[0])
  const previewText =
    summary.previewText.length > 0
      ? `${summary.previewText}${detailRows.length > 2 ? ' 等' : ''}`
      : '-'

  return `
    <p class="mt-1 text-[11px] text-muted-foreground">任务类型：${escapeHtml(taskUnitText)}；覆盖工序：${escapeHtml(coveredProcessText)}；规则来源：${escapeHtml(ruleSourceText)}</p>
    <p class="mt-1 text-[11px] text-muted-foreground">任务明细行：${summary.count} 条（合计 ${summary.totalQty}件）</p>
    <p class="text-[11px] text-muted-foreground">${escapeHtml(previewText)}</p>
    <p class="text-[11px] text-muted-foreground">维度：${escapeHtml(firstRowDimensions)}</p>
    ${renderTaskExecutionRuleSummary(task)}
    ${
      task.processBusinessCode === 'POST_FINISHING'
        ? `<p class="text-[11px] text-muted-foreground">内含：${escapeHtml(rolledUpChildNames)}</p>`
        : ''
    }
  `
}

function getSplitResultTasks(task: RuntimeProcessTask, allTasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  if (!task.splitGroupId) return []
  return allTasks
    .filter((item) => item.splitGroupId === task.splitGroupId && item.isSplitResult)
    .sort((a, b) => (a.splitSeq ?? 0) - (b.splitSeq ?? 0))
}

function renderTaskSplitSummary(task: RuntimeProcessTask, allTasks: RuntimeProcessTask[]): string {
  const splitGroup = task.splitGroupId || '-'

  if (task.isSplitResult) {
    const detailSummary = summarizeTaskDetailRows(getTaskDetailRows(task), 1)
    const sourceTaskNo = task.splitFromTaskNo || task.rootTaskNo || '-'
    const factoryName = task.assignedFactoryName || '-'
    return `
      <p class="text-[11px] text-muted-foreground">原始任务：${escapeHtml(sourceTaskNo)} · 拆分组：${escapeHtml(splitGroup)} · 拆分序号：${task.splitSeq ?? 0}</p>
      <p class="text-[11px] text-muted-foreground">承接明细：${escapeHtml(detailSummary.previewText || '-')}（${detailSummary.count}条） · 工厂：${escapeHtml(factoryName)} · 状态：${escapeHtml(splitTaskStatusLabel[task.status])}</p>
    `
  }

  if (task.isSplitSource) {
    const splitResults = getSplitResultTasks(task, allTasks)
    const splitResultText =
      splitResults.length === 0
        ? '暂无拆分结果'
        : splitResults
            .map((item) => `${taskDisplayNo(item)}（${item.assignedFactoryName || '-'}，${splitTaskStatusLabel[item.status]}）`)
            .join('；')

    return `
      <p class="text-[11px] text-muted-foreground">拆分来源任务（不再执行） · 拆分组：${escapeHtml(splitGroup)}</p>
      <p class="text-[11px] text-muted-foreground">拆分结果：${escapeHtml(splitResultText)}</p>
    `
  }

  return '<p class="text-[11px] text-muted-foreground">拆分关系：未拆分</p>'
}

function renderChainDetailDialog(
  chainDetailOrderId: string | null,
  chainDetailOrder: ProductionOrder | null,
  chainDetailTasks: RuntimeProcessTask[],
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
): string {
  if (!chainDetailOrderId) return ''

  const subtitle = chainDetailOrder
    ? `${chainDetailOrder.productionOrderId}${
        chainDetailOrder.mainFactorySnapshot?.name
          ? `・${chainDetailOrder.mainFactorySnapshot.name}`
          : ''
      }`
    : chainDetailOrderId

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-breakdown-action="close-dialog" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-h-[80vh] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-breakdown-action="close-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
        <h3 class="text-lg font-semibold">
          任务链详情
          <span class="ml-2 text-sm font-normal text-muted-foreground">${escapeHtml(subtitle)}</span>
        </h3>

        <div class="rounded-md border mt-2">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-muted/40">
                  <th class="w-10 px-3 py-2 text-left font-medium">序</th>
                  <th class="px-3 py-2 text-left font-medium">任务类型</th>
                  <th class="px-3 py-2 text-left font-medium">前置任务</th>
                  <th class="px-3 py-2 text-left font-medium">后置任务</th>
                  <th class="px-3 py-2 text-left font-medium">链路类型</th>
                  <th class="px-3 py-2 text-center font-medium">染印承接</th>
                  <th class="px-3 py-2 text-center font-medium">领料需求</th>
                  <th class="px-3 py-2 text-center font-medium">质检标准</th>
                </tr>
              </thead>
              <tbody>
                ${
                  chainDetailTasks.length === 0
                    ? '<tr><td colspan="8" class="py-8 text-center text-sm text-muted-foreground">暂无任务数据</td></tr>'
                    : chainDetailTasks
                        .map((task, idx) => {
                          const hasDye = taskDyeSet.has(task.taskId)
                          const hasMaterial = taskMaterialSet.has(task.taskId)
                          const hasQc = taskQcSet.has(task.taskId)
                          const chainTypeClass = hasDye
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                          const chainTypeLabel = hasDye ? '相关流程' : '当前生产流程'
                          return `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2 text-xs text-muted-foreground">${idx + 1}</td>
                              <td class="px-3 py-2 text-sm font-medium">
                                <div class="space-y-0.5">
                                  <p>${escapeHtml(taskDisplayName(task))}</p>
                                  ${renderTaskDetailSummary(task)}
                                  ${renderTaskSplitSummary(task, chainDetailTasks)}
                                </div>
                              </td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(prevNames(task, chainDetailTasks))}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(nextNames(task, chainDetailTasks))}</td>
                              <td class="px-3 py-2">
                                <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${chainTypeClass}">${chainTypeLabel}</span>
                              </td>
                              <td class="px-3 py-2 text-center">${renderNeedBadge(hasDye, 'bg-indigo-50 text-indigo-700 border-indigo-200')}</td>
                              <td class="px-3 py-2 text-center">${renderNeedBadge(hasMaterial, 'bg-amber-50 text-amber-700 border-amber-200')}</td>
                              <td class="px-3 py-2 text-center">${renderNeedBadge(hasQc, 'bg-cyan-50 text-cyan-700 border-cyan-200')}</td>
                            </tr>
                          `
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
      </div>
    </div>
  `
}

function renderContinuousMergeDialog(
  mergeOrderId: string | null,
  mergeOrder: ProductionOrder | null,
  mergeTasks: RuntimeProcessTask[],
): string {
  if (!mergeOrderId) return ''
  const mergeableTasks = topoSort(mergeTasks).filter(isMergeableSingleTask)
  const mergeableTaskIds = new Set(mergeableTasks.map((task) => task.taskId))
  const selectedContinuousMergeTaskIds = state.selectedContinuousMergeTaskIds.filter((taskId) => mergeableTaskIds.has(taskId))
  const canMerge = isSelectedContinuousMergeTaskContiguous(mergeableTasks, selectedContinuousMergeTaskIds)
  const subtitle = mergeOrder
    ? `${mergeOrder.productionOrderId}${mergeOrder.mainFactorySnapshot?.name ? `・${mergeOrder.mainFactorySnapshot.name}` : ''}`
    : mergeOrderId

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-breakdown-action="close-dialog" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-h-[76vh] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-breakdown-action="close-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
        <h3 class="text-lg font-semibold">
          合并连续工序
          <span class="ml-2 text-sm font-normal text-muted-foreground">${escapeHtml(subtitle)}</span>
        </h3>
        <p class="mt-1 text-xs text-muted-foreground">勾选同一生产单下需要合并的连续工序。</p>
        <div class="mt-4 rounded-md border">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/40">
                <th class="w-12 px-3 py-2 text-left font-medium">选择</th>
                <th class="px-3 py-2 text-left font-medium">工序任务</th>
                <th class="px-3 py-2 text-left font-medium">任务号</th>
                <th class="px-3 py-2 text-left font-medium">前置任务</th>
              </tr>
            </thead>
            <tbody>
              ${
                mergeableTasks.length === 0
                  ? '<tr><td colspan="4" class="py-8 text-center text-sm text-muted-foreground">暂无可合并的工序任务</td></tr>'
                  : mergeableTasks.map((task) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border"
                          data-fast-page-render="true"
                          data-breakdown-field="continuous-merge-task"
                          data-task-id="${escapeHtml(task.taskId)}"
                          ${selectedContinuousMergeTaskIds.includes(task.taskId) ? 'checked' : ''}
                        />
                      </td>
                      <td class="px-3 py-2 font-medium">${escapeHtml(taskDisplayName(task))}</td>
                      <td class="px-3 py-2 font-mono text-xs text-muted-foreground">${escapeHtml(taskDisplayNo(task))}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(prevNames(task, mergeTasks))}</td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex items-center justify-between gap-3">
          <p class="text-xs ${canMerge ? 'text-muted-foreground' : 'text-amber-700'}">
            ${escapeHtml(state.continuousMergeError || (canMerge ? '已选择连续工序，可合并。' : '请选择至少两个前后连续的未分配工序。'))}
          </p>
          <button
            class="${toClassName(
              'inline-flex h-9 items-center rounded-md border px-3 text-sm',
              canMerge ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
            )}"
            data-breakdown-action="confirm-continuous-merge"
            ${canMerge ? '' : 'disabled'}
          >合并所选工序</button>
        </div>
      </div>
    </div>
  `
}

function getOrderRows(
  allTasks: RuntimeProcessTask[],
  keyword: string,
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
): OrderRow[] {
  return productionOrders
    .filter((order) => {
      if (!keyword) return true
      return (
        order.productionOrderId.toLowerCase().includes(keyword) ||
        (order.mainFactorySnapshot?.name ?? '').includes(keyword)
      )
    })
    .map((order) => {
      const tasks = allTasks.filter((task) => task.productionOrderId === order.productionOrderId)
      const executionTasks = tasks.filter((task) => isRuntimeTaskExecutionTask(task) && task.defaultDocType !== 'DEMAND')
      const sorted = topoSort(tasks)
      const mainCount = sorted.filter((task) => !taskDyeSet.has(task.taskId)).length
      const subCount = sorted.filter((task) => taskDyeSet.has(task.taskId)).length
      const dyeCount = tasks.filter((task) => taskDyeSet.has(task.taskId)).length
      const materialCount = tasks.filter((task) => taskMaterialSet.has(task.taskId)).length
      const qcCount = tasks.filter((task) => taskQcSet.has(task.taskId)).length
      const splitGroupCount = listRuntimeTaskSplitGroupsByOrder(order.productionOrderId).length
      const splitResultCount = tasks.filter((task) => task.isSplitResult).length
      const splitSourceCount = tasks.filter((task) => task.isSplitSource).length
      const executionTaskCount = tasks.filter((task) => isRuntimeTaskExecutionTask(task)).length
      const chain = tasks.length > 0 ? chainSummaryText(sorted, taskDyeSet, taskMaterialSet, taskQcSet) : '—'

      return {
        order,
        tasks,
        sorted,
        orderTotalOutputValue: sumTaskOutputValueTotals(executionTasks),
        mainCount,
        subCount,
        dyeCount,
        materialCount,
        qcCount,
        splitGroupCount,
        splitResultCount,
        splitSourceCount,
        executionTaskCount,
        chain,
      }
    })
}

function renderTaskBreakdownResultSummary(
  orderRows: OrderRow[],
  taskRows: RuntimeProcessTask[],
  taskMaterialSet: Set<string>,
): string {
  const summaryItems = [
    {
      label: '生产单',
      value: orderRows.length,
      className: 'text-slate-900',
    },
    {
      label: '任务总数',
      value: taskRows.length,
      className: 'text-blue-700',
    },
    {
      label: '整单任务',
      value: taskRows.filter((task) => task.taskUnitType === 'WHOLE_ORDER_TASK').length,
      className: 'text-violet-700',
    },
    {
      label: '连续工序任务',
      value: taskRows.filter((task) => task.taskUnitType === 'COMBINED_PROCESS_TASK').length,
      className: 'text-indigo-700',
    },
    {
      label: '待分配',
      value: taskRows.filter((task) => task.assignmentStatus === 'UNASSIGNED').length,
      className: 'text-orange-600',
    },
    {
      label: '需领料',
      value: taskRows.filter((task) => taskMaterialSet.has(task.taskId)).length,
      className: 'text-emerald-700',
    },
  ]

  return `
    <section class="rounded-2xl border bg-card p-2 shadow-sm" aria-label="搜索结果统计">
      <div class="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        ${summaryItems
          .map((item) => `
            <div class="flex min-h-12 items-center justify-between rounded-lg border bg-background px-3 py-2">
              <span class="text-sm text-muted-foreground">${escapeHtml(item.label)}：</span>
              <span class="text-lg font-semibold ${item.className}">${item.value}</span>
            </div>
          `)
          .join('')}
      </div>
    </section>
  `
}

function renderByOrderTable(orderRows: OrderRow[], totalRows: number, currentPage: number): string {
  return `
    <div class="space-y-3">
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1320px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40">
              <th class="px-3 py-2 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-3 py-2 text-left font-medium">主工厂</th>
              <th class="px-3 py-2 text-center font-medium">任务总数</th>
              <th class="px-3 py-2 text-left font-medium">总产值</th>
              <th class="px-3 py-2 text-center font-medium">当前生产流程</th>
              <th class="px-3 py-2 text-center font-medium">相关流程</th>
              <th class="min-w-[320px] px-3 py-2 text-left font-medium">任务流程</th>
              <th class="px-3 py-2 text-left font-medium">开工准备</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              orderRows.length === 0
                ? '<tr><td colspan="9" class="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</td></tr>'
                : orderRows
                    .map(({ order, tasks, orderTotalOutputValue, mainCount, subCount, dyeCount, materialCount, qcCount, splitGroupCount, splitResultCount, splitSourceCount, executionTaskCount, chain }) => {
                      const continuousCandidates = getContinuousMergeCandidates(tasks)
                      const prepSummary =
                        tasks.length === 0
                          ? '—'
                          : [
                              dyeCount > 0 ? '含染印' : null,
                              materialCount > 0 ? `领料需求：${materialCount}个任务` : null,
                              qcCount > 0 ? `质检标准：${qcCount}个任务` : null,
                              splitGroupCount > 0 ? `拆分组：${splitGroupCount}` : '拆分组：0',
                              splitResultCount > 0 ? `拆分结果任务：${splitResultCount}` : null,
                              splitSourceCount > 0 ? `拆分来源任务：${splitSourceCount}` : null,
                              `执行任务：${executionTaskCount}`,
                            ]
                              .filter(Boolean)
                              .join('；') || '无执行准备挂载'

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3">${renderProductionOrderIdentityCell(order.productionOrderId)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(order.mainFactorySnapshot?.name ?? '—')}</td>
                          <td class="px-3 py-3 text-center text-sm">${tasks.length}</td>
                          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(formatOutputValue(orderTotalOutputValue))}</td>
                          <td class="px-3 py-3 text-center">
                            <span class="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">${mainCount}</span>
                          </td>
                          <td class="px-3 py-3 text-center">
                            ${
                              subCount > 0
                                ? `<span class="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">${subCount}</span>`
                                : '<span class="text-xs text-muted-foreground">—</span>'
                            }
                          </td>
                          <td class="max-w-[360px] px-3 py-3">
                            ${
                              tasks.length === 0
                                ? '<span class="text-xs italic text-muted-foreground">暂无任务</span>'
                                : `
                                    <div>
                                      <p class="text-xs leading-relaxed text-muted-foreground">${escapeHtml(chain)}</p>
                                      ${
                                        dyeCount > 0 || materialCount > 0 || qcCount > 0 || splitGroupCount > 0
                                          ? `
                                              <div class="mt-1.5 flex flex-wrap gap-1">
                                                ${
                                                  dyeCount > 0
                                                    ? `<span class="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0 text-[10px] text-indigo-700">染印×${dyeCount}</span>`
                                                    : ''
                                                }
                                                ${
                                                  materialCount > 0
                                                    ? `<span class="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0 text-[10px] text-amber-700">领料×${materialCount}</span>`
                                                    : ''
                                                }
                                                ${
                                                  qcCount > 0
                                                    ? `<span class="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0 text-[10px] text-cyan-700">质检×${qcCount}</span>`
                                                    : ''
                                                }
                                                ${
                                                  splitGroupCount > 0
                                                    ? `<span class="inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-0 text-[10px] text-violet-700">拆分组×${splitGroupCount}</span>`
                                                    : ''
                                                }
                                              </div>
                                            `
                                          : ''
                                      }
                                    </div>
                                  `
                            }
                          </td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(prepSummary)}</td>
                          <td class="px-3 py-3">
                            <div class="flex gap-1.5">
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-fast-page-render="true" data-breakdown-action="open-chain-detail" data-order-id="${escapeHtml(order.productionOrderId)}">
                                任务链详情
                              </button>
                              <button class="${toClassName(
                                'inline-flex h-7 items-center rounded-md border px-2 text-xs',
                                continuousCandidates.length > 0 ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
                              )}" data-fast-page-render="true" data-breakdown-action="open-continuous-merge" data-order-id="${escapeHtml(order.productionOrderId)}" ${continuousCandidates.length > 0 ? '' : 'disabled'}>
                                合并连续工序
                              </button>
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(order.productionOrderId)}">
                                查看生产单
                              </button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${renderTaskBreakdownPagination('order', totalRows, currentPage, TASK_BREAKDOWN_ORDER_PAGE_SIZE)}
    </div>
  `
}

function renderAllTasksTable(
  allTaskRows: RuntimeProcessTask[],
  allTasks: RuntimeProcessTask[],
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
  totalRows: number,
  currentPage: number,
): string {
  return `
    <div class="space-y-3">
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1680px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40">
              <th class="px-3 py-2 text-left font-medium">任务号</th>
              <th class="px-3 py-2 text-left font-medium">生产单号</th>
              <th class="px-3 py-2 text-left font-medium">售卖类型</th>
              <th class="px-3 py-2 text-left font-medium">任务类型</th>
              <th class="px-3 py-2 text-left font-medium">任务名称</th>
              <th class="px-3 py-2 text-left font-medium">覆盖工序</th>
              <th class="px-3 py-2 text-left font-medium">承接方式</th>
              <th class="px-3 py-2 text-left font-medium">承接工厂</th>
              <th class="px-3 py-2 text-left font-medium">计划数量</th>
              <th class="px-3 py-2 text-left font-medium">分配状态</th>
              <th class="px-3 py-2 text-left font-medium">执行状态</th>
              <th class="px-3 py-2 text-left font-medium">当前步骤</th>
              <th class="px-3 py-2 text-left font-medium">交出对象</th>
              <th class="px-3 py-2 text-left font-medium">规则来源</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              allTaskRows.length === 0
                ? '<tr><td colspan="15" class="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</td></tr>'
                : allTaskRows
                    .map((task) => {
                      const hasDye = taskDyeSet.has(task.taskId)
                      const hasMaterial = taskMaterialSet.has(task.taskId)
                      const hasQc = taskQcSet.has(task.taskId)
                      const orderTasks = allTasks.filter((item) => item.productionOrderId === task.productionOrderId)
                      const continuousCandidates = getContinuousMergeCandidates(orderTasks)
                      const hasContinuousMergeCandidate = continuousCandidates.some(
                        ({ prev, next }) => prev.taskId === task.taskId || next.taskId === task.taskId,
                      )
                      const displayName = taskDisplayName(task)
                      const outputValue = resolveTaskOutputValueSnapshot(task)
                      const isMergedDetailOutputValue = Boolean(
                        task.isMergedTaskUnit && task.outputValueUnit === '按覆盖工序明细计算',
                      )
                      const outputValueText = task.isSplitSource
                        ? '拆分来源任务'
                        : outputValue.totalOutputValue
                          ? formatOutputValue(outputValue.totalOutputValue)
                          : isMergedDetailOutputValue
                            ? '按覆盖工序明细计算'
                            : formatOutputValue(outputValue.totalOutputValue)
                      const outputValueHint = task.isSplitSource
                        ? '以子任务重算结果为准'
                        : isMergedDetailOutputValue
                          ? '按覆盖工序明细计算，不取首个工序单价'
                          : outputValue.outputValuePerUnit && outputValue.outputValueUnit
                          ? `单位产值 ${outputValue.outputValuePerUnit.toLocaleString()} ${outputValue.outputValueUnit}`
                          : '—'

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-mono text-xs">
                            <div>${escapeHtml(taskDisplayNo(task))}</div>
                            ${
                              taskDisplayNo(task) !== task.taskId
                                ? `<div class="text-[10px] text-muted-foreground">${escapeHtml(task.taskId)}</div>`
                              : ''
                            }
                          </td>
                          <td class="px-3 py-2 text-xs font-medium">${escapeHtml(task.productionOrderId || '—')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getTaskSaleTypeText(task))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getTaskUnitTypeLabel(task))}</td>
                          <td class="px-3 py-2 text-sm font-medium">
                            <div class="space-y-0.5">
                              <p>${escapeHtml(displayName)}</p>
                              ${renderTaskDetailSummary(task)}
                              ${renderTaskSplitSummary(task, orderTasks)}
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getCoveredProcessText(task))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getTaskAcceptanceModeText(task))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(task.assignedFactoryName || '待分配')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">
                            <div>${escapeHtml(getTaskPlanQtyText(task))}</div>
                            <div class="text-[11px] text-muted-foreground">${escapeHtml(outputValueText)}</div>
                            ${
                              outputValueHint !== '—'
                                ? `<div class="text-[10px] text-muted-foreground">${escapeHtml(outputValueHint)}</div>`
                                : ''
                            }
                          </td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(taskAssignmentStatusLabel[task.assignmentStatus])}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(taskExecutionStatusLabel[task.status])}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getTaskCurrentStepText(task))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getTaskHandoverReceiverText(task))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(getTaskRuleSourceText(task))}</td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-fast-page-render="true" data-breakdown-action="open-chain-detail" data-order-id="${escapeHtml(task.productionOrderId)}">查看任务</button>
                              <button class="${toClassName(
                                'inline-flex h-7 items-center rounded-md border px-2 text-xs',
                                hasContinuousMergeCandidate ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
                              )}" data-fast-page-render="true" data-breakdown-action="open-continuous-merge" data-order-id="${escapeHtml(task.productionOrderId)}" data-task-id="${escapeHtml(task.taskId)}" ${hasContinuousMergeCandidate ? '' : 'disabled'}>合并连续工序</button>
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(task.productionOrderId)}">查看生产单</button>
                              <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/pda/exec/${escapeHtml(task.taskId)}">PDA预览</button>
                              ${
                                hasDye
                                  ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/dye-orders">染印</button>'
                                  : ''
                              }
                              ${
                                hasMaterial
                                  ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/material-issue">领料</button>'
                                  : ''
                              }
                            </div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              ${hasDye ? '<span class="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0 text-[10px] text-indigo-700">染印承接</span>' : ''}
                              ${hasMaterial ? '<span class="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0 text-[10px] text-amber-700">需领料</span>' : ''}
                              ${hasQc ? '<span class="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0 text-[10px] text-cyan-700">需质检</span>' : ''}
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${renderTaskBreakdownPagination('all', totalRows, currentPage, TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE)}
    </div>
  `
}

export function renderTaskBreakdownPage(): string {
  const allTasks = getAllProcessTasks()
  const taskMaterialSet = getTaskMaterialSet(allTasks)
  const taskQcSet = getTaskQcSet(allTasks)
  const taskDyeSet = getTaskDyeSet(allTasks)
  const keyword = state.keyword.trim().toLowerCase()

  const allTaskRows = allTasks
    .filter((task) => {
      if (!keyword) return true
      const displayName = taskDisplayName(task)
      return (
        task.taskId.toLowerCase().includes(keyword) ||
        displayName.toLowerCase().includes(keyword) ||
        task.productionOrderId.toLowerCase().includes(keyword)
      )
    })
    .sort((a, b) =>
      a.productionOrderId !== b.productionOrderId
        ? a.productionOrderId.localeCompare(b.productionOrderId)
        : a.seq - b.seq,
    )

  const orderRows = getOrderRows(allTasks, keyword, taskDyeSet, taskMaterialSet, taskQcSet)
  const orderPage = clampPage(state.orderPage, orderRows.length, TASK_BREAKDOWN_ORDER_PAGE_SIZE)
  const allTaskPage = clampPage(state.allTaskPage, allTaskRows.length, TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE)
  const pagedOrderRows = orderRows.slice(
    (orderPage - 1) * TASK_BREAKDOWN_ORDER_PAGE_SIZE,
    orderPage * TASK_BREAKDOWN_ORDER_PAGE_SIZE,
  )
  const pagedAllTaskRows = allTaskRows.slice(
    (allTaskPage - 1) * TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE,
    allTaskPage * TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE,
  )

  const chainDetailOrder = state.chainDetailOrderId
    ? productionOrders.find((order) => order.productionOrderId === state.chainDetailOrderId) ?? null
    : null
  const chainDetailTasks = state.chainDetailOrderId
    ? topoSort(allTasks.filter((task) => task.productionOrderId === state.chainDetailOrderId))
    : []
  const continuousMergeOrder = state.continuousMergeOrderId
    ? productionOrders.find((order) => order.productionOrderId === state.continuousMergeOrderId) ?? null
    : null
  const continuousMergeTasks = state.continuousMergeOrderId
    ? allTasks.filter((task) => task.productionOrderId === state.continuousMergeOrderId)
    : []

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-2xl font-semibold text-foreground">任务清单</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          展示生产单已有任务的组成与顺序关系。
        </p>
      </header>

      <section class="flex gap-2">
        <div class="relative max-w-xs flex-1">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            data-breakdown-field="keyword"
            data-fast-page-render="true"
            value="${escapeHtml(state.keyword)}"
            placeholder="生产单号 / 任务名称 / 关键词"
            class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
          />
        </div>
      </section>

      ${renderTaskBreakdownResultSummary(orderRows, allTaskRows, taskMaterialSet)}

      <section class="space-y-3">
        <div class="inline-flex items-center rounded-md bg-muted p-1 text-sm">
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm',
              state.activeTab === 'by-order'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-breakdown-action="switch-tab"
            data-fast-page-render="true"
            data-tab="by-order"
          >
            按生产单汇总
          </button>
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm',
              state.activeTab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-breakdown-action="switch-tab"
            data-fast-page-render="true"
            data-tab="all"
          >
            全部任务
          </button>
        </div>

        ${state.activeTab === 'by-order' ? renderByOrderTable(pagedOrderRows, orderRows.length, orderPage) : ''}
        ${state.activeTab === 'all' ? renderAllTasksTable(pagedAllTaskRows, allTasks, taskDyeSet, taskMaterialSet, taskQcSet, allTaskRows.length, allTaskPage) : ''}
      </section>

      ${renderChainDetailDialog(
        state.chainDetailOrderId,
        chainDetailOrder,
        chainDetailTasks,
        taskDyeSet,
        taskMaterialSet,
        taskQcSet,
      )}
      ${renderContinuousMergeDialog(state.continuousMergeOrderId, continuousMergeOrder, continuousMergeTasks)}
    </div>
  `
}

export function handleTaskBreakdownEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-breakdown-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.breakdownField
    if (field === 'keyword') {
      state.keyword = fieldNode.value
      resetTaskBreakdownPages()
      return true
    }
    if (field === 'continuous-merge-task') {
      const taskId = fieldNode.dataset.taskId
      if (!taskId) return true
      state.selectedContinuousMergeTaskIds = fieldNode.checked
        ? Array.from(new Set([...state.selectedContinuousMergeTaskIds, taskId]))
        : state.selectedContinuousMergeTaskIds.filter((id) => id !== taskId)
      state.continuousMergeError = ''
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-breakdown-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.breakdownAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TaskBreakdownTab | undefined
    if (tab === 'by-order' || tab === 'all') {
      state.activeTab = tab
      return true
    }
    return false
  }

  if (action === 'change-page') {
    const pageScope = actionNode.dataset.breakdownPageScope as TaskBreakdownPageScope | undefined
    const page = Number(actionNode.dataset.page || '1')
    const safePage = Number.isFinite(page) ? Math.max(1, page) : 1
    if (pageScope === 'order') {
      state.orderPage = safePage
      return true
    }
    if (pageScope === 'all') {
      state.allTaskPage = safePage
      return true
    }
    return false
  }

  if (action === 'open-chain-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.chainDetailOrderId = orderId
    state.continuousMergeOrderId = null
    state.selectedContinuousMergeTaskIds = []
    state.continuousMergeError = ''
    return true
  }

  if (action === 'open-continuous-merge') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    const preferredTaskId = actionNode.dataset.taskId
    const orderTasks = getAllProcessTasks().filter((task) => task.productionOrderId === orderId)
    state.continuousMergeOrderId = orderId
    state.selectedContinuousMergeTaskIds = getInitialContinuousMergeSelection(orderTasks, preferredTaskId)
    state.continuousMergeError = ''
    state.chainDetailOrderId = null
    return true
  }

  if (action === 'confirm-continuous-merge') {
    const merged = mergeContinuousRuntimeTasks(state.selectedContinuousMergeTaskIds, '生产计划员')
    if (!merged) {
      state.continuousMergeError = '合并失败：请选择同一生产单下前后连续、未分配、未开工的独立工序。'
      return true
    }
    state.continuousMergeOrderId = null
    state.selectedContinuousMergeTaskIds = []
    state.continuousMergeError = ''
    return true
  }

  if (action === 'close-dialog') {
    state.chainDetailOrderId = null
    state.continuousMergeOrderId = null
    state.selectedContinuousMergeTaskIds = []
    state.continuousMergeError = ''
    return true
  }

  return false
}

export function isTaskBreakdownDialogOpen(): boolean {
  return state.chainDetailOrderId !== null || state.continuousMergeOrderId !== null
}
