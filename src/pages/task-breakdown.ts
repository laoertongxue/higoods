import { productionOrders, type ProductionOrder } from '../data/fcs/production-orders'
import {
  getProcessDefinitionByCode,
  isExternalTaskProcess,
} from '../data/fcs/process-craft-dict'
import {
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  listRuntimeTaskSplitGroupsByOrder,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks'
import {
  resolveTaskStandardTimeSnapshot,
  sumTaskStandardTimeTotals,
} from '../data/fcs/process-tasks'
import { listGeneratedProductionDemandArtifacts } from '../data/fcs/production-artifact-generation'
import { getTaskTypeDisplayName } from '../data/fcs/page-adapters/task-execution-adapter'
import {
  formatTaskDetailDimensionsText,
  summarizeTaskDetailRows,
} from '../data/fcs/task-detail-rows'
import { escapeHtml, toClassName } from '../utils'

type TaskBreakdownTab = 'by-order' | 'all'

interface TaskBreakdownState {
  keyword: string
  activeTab: TaskBreakdownTab
  chainDetailOrderId: string | null
}

interface OrderRow {
  order: ProductionOrder
  tasks: RuntimeProcessTask[]
  sorted: RuntimeProcessTask[]
  orderTotalStandardTime?: number
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
  activeTab: 'by-order',
  chainDetailOrderId: null,
}

const STAGE_ORDER = ['PREP', 'CUTTING', 'SEWING', 'SPECIAL', 'POST']
const DEFAULT_POST_CHILD_TEXT = '开扣眼、装扣子、熨烫、包装'

function taskDisplayName(task: RuntimeProcessTask): string {
  return getTaskTypeDisplayName(task)
}

function taskDisplayNo(task: RuntimeProcessTask): string {
  return task.taskNo || task.taskId
}

const splitTaskStatusLabel: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: '待执行',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '暂停',
  CANCELLED: '已取消',
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
    if (task.processBusinessCode && isExternalTaskProcess(task.processBusinessCode)) return true
    if (task.processBusinessCode) {
      const process = getProcessDefinitionByCode(task.processBusinessCode)
      if (process) return process.generatesExternalTask
    }
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

function formatStandardTimeMinutes(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return `${Number(value).toLocaleString()} 分钟`
}

function getTaskDetailRows(task: RuntimeProcessTask) {
  if (task.scopeDetailRows && task.scopeDetailRows.length > 0) return task.scopeDetailRows
  return task.detailRows ?? []
}

function renderTaskDetailSummary(task: RuntimeProcessTask): string {
  const detailRows = getTaskDetailRows(task)
  const rolledUpChildNames = task.rolledUpChildProcessNames?.length
    ? task.rolledUpChildProcessNames.join('、')
    : DEFAULT_POST_CHILD_TEXT
  if (detailRows.length === 0) {
    return `
      <p class="mt-1 text-[11px] text-muted-foreground">任务明细行：0 条</p>
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
    <p class="mt-1 text-[11px] text-muted-foreground">任务明细行：${summary.count} 条（合计 ${summary.totalQty}件）</p>
    <p class="text-[11px] text-muted-foreground">${escapeHtml(previewText)}</p>
    <p class="text-[11px] text-muted-foreground">维度：${escapeHtml(firstRowDimensions)}</p>
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
                  <th class="px-3 py-2 text-left font-medium">任务名称</th>
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
        orderTotalStandardTime: sumTaskStandardTimeTotals(executionTasks),
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

function renderByOrderTable(orderRows: OrderRow[]): string {
  return `
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/40">
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">主工厂</th>
            <th class="px-3 py-2 text-center font-medium">任务总数</th>
            <th class="px-3 py-2 text-left font-medium">总标准工时</th>
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
                  .map(({ order, tasks, orderTotalStandardTime, mainCount, subCount, dyeCount, materialCount, qcCount, splitGroupCount, splitResultCount, splitSourceCount, executionTaskCount, chain }) => {
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
                        <td class="px-3 py-3 font-mono text-sm">
                          <div>${escapeHtml(order.productionOrderId)}</div>
                        </td>
                        <td class="px-3 py-3 text-sm">${escapeHtml(order.mainFactorySnapshot?.name ?? '—')}</td>
                        <td class="px-3 py-3 text-center text-sm">${tasks.length}</td>
                        <td class="px-3 py-3 text-sm font-medium">${escapeHtml(formatStandardTimeMinutes(orderTotalStandardTime))}</td>
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
                            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-breakdown-action="open-chain-detail" data-order-id="${escapeHtml(order.productionOrderId)}">
                              任务链详情
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
  `
}

function renderAllTasksTable(
  allTaskRows: RuntimeProcessTask[],
  allTasks: RuntimeProcessTask[],
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
): string {
  return `
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/40">
            <th class="w-10 px-3 py-2 text-left font-medium">序</th>
            <th class="px-3 py-2 text-left font-medium">任务ID</th>
            <th class="px-3 py-2 text-left font-medium">任务名称</th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">总标准工时</th>
            <th class="px-3 py-2 text-left font-medium">前置任务</th>
            <th class="px-3 py-2 text-left font-medium">后置任务</th>
            <th class="px-3 py-2 text-left font-medium">链路类型</th>
            <th class="px-3 py-2 text-center font-medium">染印承接</th>
            <th class="px-3 py-2 text-center font-medium">领料需求</th>
            <th class="px-3 py-2 text-center font-medium">质检标准</th>
            <th class="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            allTaskRows.length === 0
              ? '<tr><td colspan="12" class="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</td></tr>'
              : allTaskRows
                  .map((task, idx) => {
                    const hasDye = taskDyeSet.has(task.taskId)
                    const hasMaterial = taskMaterialSet.has(task.taskId)
                    const hasQc = taskQcSet.has(task.taskId)
                    const orderTasks = allTasks.filter((item) => item.productionOrderId === task.productionOrderId)
                    const chainTypeClass = hasDye
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                    const chainTypeLabel = hasDye ? '相关流程' : '当前生产流程'
                    const displayName = taskDisplayName(task)
                    const standardTime = resolveTaskStandardTimeSnapshot(task)
                    const standardTimeText = task.isSplitSource
                      ? '拆分来源任务'
                      : formatStandardTimeMinutes(standardTime.totalStandardTime)
                    const standardTimeHint = task.isSplitSource
                      ? '以子任务重算结果为准'
                      : standardTime.standardTimePerUnit && standardTime.standardTimeUnit
                        ? `单位标准工时 ${standardTime.standardTimePerUnit.toLocaleString()} ${standardTime.standardTimeUnit}`
                        : '—'

                    return `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-2 text-xs text-muted-foreground">${idx + 1}</td>
                        <td class="px-3 py-2 font-mono text-xs">
                          <div>${escapeHtml(taskDisplayNo(task))}</div>
                          ${
                            taskDisplayNo(task) !== task.taskId
                              ? `<div class="text-[10px] text-muted-foreground">${escapeHtml(task.taskId)}</div>`
                              : ''
                          }
                        </td>
                        <td class="px-3 py-2 text-sm font-medium">
                          <div class="space-y-0.5">
                            <p>${escapeHtml(displayName)}</p>
                            ${renderTaskDetailSummary(task)}
                            ${renderTaskSplitSummary(task, orderTasks)}
                          </div>
                        </td>
                        <td class="px-3 py-2 font-mono text-xs text-muted-foreground">${escapeHtml(task.productionOrderId || '—')}</td>
                        <td class="px-3 py-2 text-sm">
                          <div class="${task.isSplitSource ? 'text-muted-foreground' : 'font-medium'}">${escapeHtml(standardTimeText)}</div>
                          <div class="text-[11px] text-muted-foreground">${escapeHtml(standardTimeHint)}</div>
                        </td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(prevNames(task, orderTasks))}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(nextNames(task, orderTasks))}</td>
                        <td class="px-3 py-2">
                          <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${chainTypeClass}">${chainTypeLabel}</span>
                        </td>
                        <td class="px-3 py-2 text-center">${renderNeedBadge(hasDye, 'bg-indigo-50 text-indigo-700 border-indigo-200')}</td>
                        <td class="px-3 py-2 text-center">${renderNeedBadge(hasMaterial, 'bg-amber-50 text-amber-700 border-amber-200')}</td>
                        <td class="px-3 py-2 text-center">${renderNeedBadge(hasQc, 'bg-cyan-50 text-cyan-700 border-cyan-200')}</td>
                        <td class="px-3 py-2">
                          <div class="flex gap-1">
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(task.productionOrderId)}">生产单</button>
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
                        </td>
                      </tr>
                    `
                  })
                  .join('')
          }
        </tbody>
      </table>
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

  const stats = {
    orderCount: productionOrders.length,
    total: allTasks.length,
    mainCount: allTasks.filter((task) => !taskDyeSet.has(task.taskId)).length,
    subCount: allTasks.filter((task) => taskDyeSet.has(task.taskId)).length,
    materialCount: allTasks.filter(
      (task) => taskMaterialSet.has(task.taskId),
    ).length,
    qcCount: allTasks.filter(
      (task) => taskQcSet.has(task.taskId),
    ).length,
  }

  const chainDetailOrder = state.chainDetailOrderId
    ? productionOrders.find((order) => order.productionOrderId === state.chainDetailOrderId) ?? null
    : null
  const chainDetailTasks = state.chainDetailOrderId
    ? topoSort(allTasks.filter((task) => task.productionOrderId === state.chainDetailOrderId))
    : []

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-2xl font-semibold text-foreground">任务清单</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          展示生产单已生成任务的组成与顺序关系。
        </p>
      </header>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">生产单数</h2>
            <i data-lucide="file-text" class="h-4 w-4 text-muted-foreground"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.orderCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">任务总数</h2>
            <i data-lucide="layers" class="h-4 w-4 text-muted-foreground"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.total}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">当前流程任务数</h2>
            <i data-lucide="chevron-right" class="h-4 w-4 text-slate-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.mainCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">相关流程任务数</h2>
            <i data-lucide="chevron-right" class="h-4 w-4 text-indigo-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.subCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">需领料任务数</h2>
            <i data-lucide="clipboard-list" class="h-4 w-4 text-amber-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.materialCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">需质检标准任务数</h2>
            <i data-lucide="check-square" class="h-4 w-4 text-cyan-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.qcCount}</p></div>
        </article>
      </section>

      <section class="flex gap-2">
        <div class="relative max-w-xs flex-1">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            data-breakdown-field="keyword"
            value="${escapeHtml(state.keyword)}"
            placeholder="生产单号 / 任务名称 / 关键词"
            class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
          />
        </div>
      </section>

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
            data-tab="by-order"
          >
            按生产单查看
          </button>
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm',
              state.activeTab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-breakdown-action="switch-tab"
            data-tab="all"
          >
            全部任务
          </button>
        </div>

        ${state.activeTab === 'by-order' ? renderByOrderTable(orderRows) : ''}
        ${state.activeTab === 'all' ? renderAllTasksTable(allTaskRows, allTasks, taskDyeSet, taskMaterialSet, taskQcSet) : ''}
      </section>

      ${renderChainDetailDialog(
        state.chainDetailOrderId,
        chainDetailOrder,
        chainDetailTasks,
        taskDyeSet,
        taskMaterialSet,
        taskQcSet,
      )}
    </div>
  `
}

export function handleTaskBreakdownEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-breakdown-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.breakdownField
    if (field === 'keyword') {
      state.keyword = fieldNode.value
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

  if (action === 'open-chain-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.chainDetailOrderId = orderId
    return true
  }

  if (action === 'close-dialog') {
    state.chainDetailOrderId = null
    return true
  }

  return false
}

export function isTaskBreakdownDialogOpen(): boolean {
  return state.chainDetailOrderId !== null
}
