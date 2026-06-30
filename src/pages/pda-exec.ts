import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { type ProcessTask } from '../data/fcs/process-tasks'
import {
  getTaskProcessDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  getPdaTaskFlowTaskById,
  getPdaCuttingTaskSnapshot,
  isCuttingSpecialTask,
  listPdaCuttingExecutionRowsByTaskId,
  resolvePdaTaskDetailPath,
  resolvePdaTaskExecPath,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { listPdaGenericTasksByProcess } from '../data/fcs/pda-task-mock-factory.ts'
import { getWoolWorkOrderByTaskId } from '../data/fcs/wool-task-domain.ts'
import {
  getMobileExecutionTaskById,
  getMobileTaskTabKey,
  listMobileExecutionTasks,
  matchMobileTaskKeyword,
  type MobileExecutionTaskStatusTab,
} from '../data/fcs/mobile-execution-task-index.ts'
import {
  getMobileTaskExecutionState,
  getMobileTaskProcessType,
  listPdaMobileExecutionTasks,
} from '../data/fcs/process-mobile-task-binding.ts'
import { canFactoryAccessSpecialCraftPdaTask } from '../data/fcs/special-craft-pda-scope.ts'
import { getPrintWorkOrderByTaskId } from '../data/fcs/printing-task-domain.ts'
import { getDyeWorkOrderByTaskId } from '../data/fcs/dyeing-task-domain.ts'
import {
  getPostFinishingTaskById,
  getPostFinishingWorkOrderBySourceTaskId,
} from '../data/fcs/post-finishing-domain.ts'
import {
  formatProcessQuantityWithUnit,
  getQuantityLabel,
} from '../data/fcs/process-quantity-labels.ts'
import {
  formatRemainingHours,
  getStartPrerequisite,
  getTaskStartDueInfo,
  syncPdaStartRiskAndExceptions,
} from '../data/fcs/pda-start-link'
import {
  getPauseHandleStatus,
  getTaskMilestoneState,
  getTaskMilestoneWarningText,
  isTaskMilestoneReported,
  syncMilestoneOverdueExceptions,
} from '../data/fcs/pda-exec-link'
import { renderPdaFrame } from './pda-shell'
import {
  ensurePdaSessionForAction,
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'

type TaskStatusTab = MobileExecutionTaskStatusTab

interface PdaExecState {
  selectedFactoryId: string
  activeTab: TaskStatusTab
  searchKeyword: string
  riskParam: string
}

const TAB_CONFIG: Array<{ key: TaskStatusTab; label: string }> = [
  { key: 'NOT_STARTED', label: '待开工' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'BLOCKED', label: '生产暂停' },
  { key: 'DONE', label: '已完工' },
]

const state: PdaExecState = {
  selectedFactoryId: '',
  activeTab: 'NOT_STARTED',
  searchKeyword: '',
  riskParam: '',
}

function listTaskFacts(): ProcessTask[] {
  return listPdaMobileExecutionTasks()
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getMobileExecutionTaskById(taskId)
}

function getTaskDisplayNo(task: ProcessTask): string {
  return task.taskNo || task.taskId
}

function getTaskRootNo(task: ProcessTask): string {
  return task.rootTaskNo || task.taskNo || task.taskId
}

function getQtyUnitLabel(unit: string | undefined): string {
  if (!unit) return '件'
  if (unit === 'PIECE' || unit === '件') return '件'
  if (unit === '片') return '片'
  if (unit === 'ROLL' || unit === '卷') return '卷'
  if (unit === 'LAYER' || unit === '层') return '层'
  return unit
}

function resolveTaskQtyDisplayMeta(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): { label: string; valueText: string } {
  const woolOrder = getWoolWorkOrderByTaskId(task.taskId)
  if (woolOrder) {
    const label = woolOrder.kind === 'PART_PANEL' ? '本单毛织部位片数（片）' : '本单毛织整件数（件）'
    return {
      label,
      valueText: `${label.replace(/（.*$/, '')}：${woolOrder.plannedQty} ${woolOrder.qtyUnit}`,
    }
  }

  const printOrder = getPrintWorkOrderByTaskId(task.taskId)
  if (printOrder) {
    const context = {
      processType: 'PRINT',
      sourceType: 'PRINT_WORK_ORDER',
      sourceId: printOrder.printOrderId,
      objectType: printOrder.objectType,
      qtyUnit: printOrder.qtyUnit,
      qtyPurpose: '计划' as const,
      isPiecePrinting: printOrder.isPiecePrinting,
      isFabricPrinting: printOrder.isFabricPrinting,
    }
    const label = getQuantityLabel(context)
    return {
      label,
      valueText: `${label}：${formatProcessQuantityWithUnit(printOrder.plannedQty, context)}`,
    }
  }

  const dyeOrder = getDyeWorkOrderByTaskId(task.taskId)
  if (dyeOrder) {
    const context = {
      processType: 'DYE',
      sourceType: 'DYE_WORK_ORDER',
      sourceId: dyeOrder.dyeOrderId,
      objectType: '面料',
      qtyUnit: dyeOrder.qtyUnit,
      qtyPurpose: '计划' as const,
    }
    const label = getQuantityLabel(context)
    return {
      label,
      valueText: `${label}：${formatProcessQuantityWithUnit(dyeOrder.plannedQty, context)}`,
    }
  }

  const unitLabel = getQtyUnitLabel(task.qtyUnit)
  if (unitLabel === '卷') {
    return {
      label: '本单布卷数（卷）',
      valueText: `本单布卷数：${task.qty} 卷`,
    }
  }
  if (unitLabel === '层') {
    return {
      label: '本单铺布层数（层）',
      valueText: `本单铺布层数：${task.qty} 层`,
    }
  }

  const shouldUsePieceSemantics =
    unitLabel === '片'
    || (unitLabel === '件' && (isCuttingSpecialTask(task) || getMobileTaskProcessType(task) === 'SPECIAL_CRAFT' || /裁片|入仓|交接/.test(displayProcessName)))

  if (shouldUsePieceSemantics) {
    return {
      label: '本单裁片片数（片）',
      valueText: `本单裁片片数：${task.qty} 片`,
    }
  }

  return {
    label: '本单成衣件数（件）',
    valueText: `本单成衣件数：${task.qty} 件`,
  }
}

const TAB_PARAM_MAP: Record<string, TaskStatusTab> = {
  blocked: 'BLOCKED',
  BLOCKED: 'BLOCKED',
  'in-progress': 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  'not-started': 'NOT_STARTED',
  NOT_STARTED: 'NOT_STARTED',
  done: 'DONE',
  DONE: 'DONE',
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function syncTabWithQuery(): void {
  const searchParams = getCurrentSearchParams()
  const rawTab = searchParams.get('tab') || ''
  const mapped = TAB_PARAM_MAP[rawTab] || 'NOT_STARTED'
  state.activeTab = mapped
  state.riskParam = searchParams.get('risk') || ''
  if (searchParams.has('keyword')) {
    state.searchKeyword = searchParams.get('keyword') || ''
  }
}

function buildPdaExecListPath(tab = state.activeTab): string {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (state.riskParam) params.set('risk', state.riskParam)
  if (state.searchKeyword.trim()) params.set('keyword', state.searchKeyword.trim())
  return `/fcs/pda/exec?${params.toString()}`
}

function appendExecDetailAction(path: string, action: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}action=${encodeURIComponent(action)}`
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getCurrentFactoryId(): string {
  const runtime = getPdaRuntimeContext()
  state.selectedFactoryId = runtime?.factoryId ?? ''
  return state.selectedFactoryId
}

function blockReasonLabel(reason: string | undefined): string {
  if (!reason) return '未知原因'
  const map: Record<string, string> = {
    MATERIAL: '物料',
    CAPACITY: '产能/排期',
    QUALITY: '质量处理',
    TECH: '工艺/技术资料',
    EQUIPMENT: '设备',
    OTHER: '其他',
    ALLOCATION_GATE: '分配开始条件',
  }
  return map[reason] ?? reason
}

function getDeadlineStatus(
  taskDeadline?: string,
  finishedAt?: string,
): { label: string; textClass: string; hintClass: string } | null {
  if (!taskDeadline || finishedAt) return null
  const diff = parseDateMs(taskDeadline) - Date.now()

  if (diff < 0) {
    return {
      label: '执行逾期',
      textClass: 'text-destructive font-medium',
      hintClass: 'bg-red-50 text-red-700',
    }
  }

  if (diff < 24 * 3600 * 1000) {
    return {
      label: '即将逾期',
      textClass: 'text-amber-600 font-medium',
      hintClass: 'bg-amber-50 text-amber-700',
    }
  }

  return {
    label: '正常',
    textClass: 'text-muted-foreground',
    hintClass: '',
  }
}

function showPdaExecToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-exec-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'

  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'

    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function mutateFinishTask(taskId: string, by: string): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return
  if (getPrintWorkOrderByTaskId(taskId) || getDyeWorkOrderByTaskId(taskId)) return

  task.status = 'DONE'
  task.finishedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-FINISH-${Date.now()}`,
      action: 'FINISH_TASK',
      detail: '任务完工',
      at: now,
      by,
    },
  ]
}

function getAcceptedTasks(factoryId: string): ProcessTask[] {
  return listMobileExecutionTasks({
    currentFactoryId: factoryId,
  }).filter((task) => canFactoryAccessSpecialCraftPdaTask(factoryId, task))
}

function getFilteredTasks(
  tasksByStatus: Record<TaskStatusTab, ProcessTask[]>,
  activeTab: TaskStatusTab,
): ProcessTask[] {
  let tasks = tasksByStatus[activeTab]

  if (activeTab === 'IN_PROGRESS' && state.riskParam === 'due-soon') {
    const nowMs = Date.now()
    tasks = tasks.filter((task) => {
      const taskDeadline = (task as ProcessTask & { taskDeadline?: string }).taskDeadline
      if (!taskDeadline) return false
      const diff = parseDateMs(taskDeadline) - nowMs
      return diff >= 0 && diff < 24 * 3600 * 1000
    })
  }

  if (activeTab === 'NOT_STARTED' && state.riskParam === 'start-due-soon') {
    tasks = tasks.filter((task) => getTaskStartDueInfo(task).startRiskStatus === 'DUE_SOON')
  }

  if (activeTab === 'NOT_STARTED') {
    tasks = sortNotStartedTasks(tasks)
  }

  const keyword = state.searchKeyword.trim()
  if (!keyword) return tasks

  return tasks.filter((task) => matchMobileTaskKeyword(task, keyword))
}

function renderSourceBadge(mode: string): string {
  if (mode === 'DIRECT') {
    return `
      <span class="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-700">
        <i data-lucide="tag" class="h-2.5 w-2.5"></i>
        直接派发
      </span>
    `
  }

  return `
    <span class="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-medium text-green-700">
      <i data-lucide="tag" class="h-2.5 w-2.5"></i>
      分配接收
    </span>
  `
}

function renderCoveredProcessSummary(task: ProcessTask): string {
  const coveredProcesses = task.coveredProcesses ?? []
  if (coveredProcesses.length === 0) return ''
  const text = coveredProcesses
    .map((item) => item.craftName ? `${item.processName}/${item.craftName}` : item.processName)
    .join('、')
  return `<div class="rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">覆盖工序：${escapeHtml(text)}</div>`
}

function isSimpleFiveStepTask(task: ProcessTask): boolean {
  return task.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP'
}

function getTaskStatusLabel(task: ProcessTask): string {
  const postTask = getPostFinishingTaskById(task.taskId)
  if (postTask) return postTask.currentStatus
  const postOrder = getPostFinishingWorkOrderBySourceTaskId(task.taskId)
  if (postOrder) return postOrder.currentStatus
  return getMobileTaskExecutionState(task)
}

function renderTaskStatusBadge(task: ProcessTask): string {
  return `
    <span class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
      执行：${escapeHtml(getTaskStatusLabel(task))}
    </span>
  `
}

function buildPdaExecTasksByStatus(acceptedTasks: ProcessTask[]): Record<TaskStatusTab, ProcessTask[]> {
  const tasksByStatus: Record<TaskStatusTab, ProcessTask[]> = {
    NOT_STARTED: [],
    IN_PROGRESS: [],
    BLOCKED: [],
    DONE: [],
  }

  for (const task of acceptedTasks) {
    tasksByStatus[getMobileTaskTabKey(task)].push(task)
  }

  return tasksByStatus
}

type CuttingExecutionRow = ReturnType<typeof listPdaCuttingExecutionRowsByTaskId>[number]

function getPrimaryCuttingExecutionRow(task: ProcessTask): CuttingExecutionRow | null {
  if (!isCuttingSpecialTask(task)) return null
  return listPdaCuttingExecutionRowsByTaskId(task.taskId)[0] ?? null
}

type CuttingTaskDetail = NonNullable<ReturnType<typeof getPdaCuttingTaskSnapshot>>

function getCuttingTaskDetail(task: ProcessTask): CuttingTaskDetail | null {
  if (!isCuttingSpecialTask(task)) return null
  return getPdaCuttingTaskSnapshot(task.taskId)
}

function getCuttingTaskListSummary(detail: CuttingTaskDetail | null): string {
  if (!detail) return ''
  return `${detail.cutOrderGroups.length} 张裁片单 · ${detail.cutPieceOrderCount} 张铺布单 · 下一步 ${detail.nextRecommendedAction}`
}

function joinDisplayParts(parts: Array<string | undefined | null>): string {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' · ')
}

function getStartConditionLabel(prereq: ReturnType<typeof getStartPrerequisite>): string {
  if (prereq.met) return '可开工'
  if (/领料|收货|入仓|来料/.test(prereq.blocker)) return '待领料确认'
  if (/绑定/.test(prereq.blocker)) return '待绑定裁片单'
  if (/执行明细|同步/.test(prereq.blocker)) return '待执行明细同步'
  if (/上游|连续流转/.test(prereq.blocker)) return '待前置完成'
  return '待前置完成'
}

function getNotStartedPrimaryAction(
  task: ProcessTask,
  prereq: ReturnType<typeof getStartPrerequisite>,
): { label: string; icon: string; action: 'go-start' | 'go-prerequisite' | 'go-handover'; className: string } {
  if (prereq.met) {
    return {
      label: isSimpleFiveStepTask(task) ? '确认领料 / 开始做' : isCuttingSpecialTask(task) ? '进入裁片任务' : '开工',
      icon: 'play',
      action: 'go-start',
      className: 'bg-primary text-primary-foreground hover:bg-primary/90',
    }
  }

  if (isCuttingSpecialTask(task) && /领料|入仓|来料/.test(prereq.blocker)) {
    return {
      label: '去交接确认',
      icon: 'arrow-left-right',
      action: 'go-prerequisite',
      className: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
    }
  }

  if (isSimpleFiveStepTask(task) && /领料|收货|入仓|来料/.test(prereq.blocker)) {
    return {
      label: '去交接确认',
      icon: 'arrow-left-right',
      action: 'go-handover',
      className: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
    }
  }

  if (isCuttingSpecialTask(task) && /绑定/.test(prereq.blocker)) {
    return {
      label: '处理绑定',
      icon: 'link',
      action: 'go-prerequisite',
      className: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
    }
  }

  return {
    label: '查看前置状态',
    icon: 'eye',
    action: 'go-prerequisite',
    className: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
  }
}

function getNotStartedSortRank(task: ProcessTask): number {
  const prereq = getStartPrerequisite(task)
  const startInfo = getTaskStartDueInfo(task)
  if (prereq.met && startInfo.startRiskStatus === 'OVERDUE') return 0
  if (prereq.met && startInfo.startRiskStatus === 'DUE_SOON') return 1
  if (prereq.met) return 2
  if (/领料|收货|入仓|来料/.test(prereq.blocker)) return 3
  if (/绑定/.test(prereq.blocker)) return 4
  return 5
}

function compareOptionalDate(left?: string, right?: string): number {
  const leftMs = left ? parseDateMs(left) : Number.POSITIVE_INFINITY
  const rightMs = right ? parseDateMs(right) : Number.POSITIVE_INFINITY
  if (Number.isNaN(leftMs) && Number.isNaN(rightMs)) return 0
  if (Number.isNaN(leftMs)) return 1
  if (Number.isNaN(rightMs)) return -1
  return leftMs - rightMs
}

function sortNotStartedTasks(tasks: ProcessTask[]): ProcessTask[] {
  return [...tasks].sort((left, right) => {
    const rankDiff = getNotStartedSortRank(left) - getNotStartedSortRank(right)
    if (rankDiff !== 0) return rankDiff
    const leftDeadline = (left as ProcessTask & { taskDeadline?: string }).taskDeadline
    const rightDeadline = (right as ProcessTask & { taskDeadline?: string }).taskDeadline
    const deadlineDiff = compareOptionalDate(leftDeadline, rightDeadline)
    if (deadlineDiff !== 0) return deadlineDiff
    return getTaskDisplayNo(left).localeCompare(getTaskDisplayNo(right), 'zh-Hans-CN')
  })
}

function getPdaExecEmptyStateText(acceptedTasks: ProcessTask[]): string {
  if (acceptedTasks.length === 0) return '当前工厂暂无可执行任务'
  if (state.searchKeyword.trim()) return '当前关键词未找到任务'
  if (state.activeTab === 'IN_PROGRESS' && state.riskParam === 'due-soon') return '当前暂无即将逾期任务'
  if (state.activeTab === 'NOT_STARTED' && state.riskParam === 'start-due-soon') return '当前暂无开工预期任务'
  return '当前筛选条件下暂无任务'
}

function renderPdaExecCardList(filteredTasks: ProcessTask[], emptyStateText: string): string {
  if (filteredTasks.length === 0) {
    return `<div class="py-10 text-center text-sm text-muted-foreground">${escapeHtml(emptyStateText)}</div>`
  }

  return filteredTasks
    .map((task) => {
      if (state.activeTab === 'NOT_STARTED') return renderNotStartedCard(task)
      if (state.activeTab === 'IN_PROGRESS') return renderInProgressCard(task)
      if (state.activeTab === 'BLOCKED') return renderBlockedCard(task)
      return renderDoneCard(task)
    })
    .join('')
}

function updatePdaExecCardListInPlace(): void {
  const listNode = document.querySelector<HTMLElement>('[data-testid="pda-exec-card-list"]')
  if (!listNode) return

  const selectedFactoryId = getCurrentFactoryId()
  const acceptedTasks = getAcceptedTasks(selectedFactoryId)
  const tasksByStatus = buildPdaExecTasksByStatus(acceptedTasks)
  const filteredTasks = getFilteredTasks(tasksByStatus, state.activeTab)
  listNode.innerHTML = renderPdaExecCardList(filteredTasks, getPdaExecEmptyStateText(acceptedTasks))
}

function resolvePdaExecCardDetailPath(taskId: string): string {
  const currentPath = appStore.getState().pathname
  const task = getPdaTaskFlowTaskById(taskId)
  if (task && isCuttingSpecialTask(task)) return resolvePdaTaskDetailPath(taskId, currentPath)
  return resolvePdaTaskExecPath(taskId, currentPath)
}

function renderNotStartedCard(task: ProcessTask): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const prereq = getStartPrerequisite(task)
  const taskDeadline = (task as ProcessTask & { taskDeadline?: string }).taskDeadline
  const deadline = getDeadlineStatus(taskDeadline, task.finishedAt)
  const startInfo = getTaskStartDueInfo(task)
  const startDueAt = startInfo.startDueAt || '—'
  const cuttingDetail = getCuttingTaskDetail(task)
  const cuttingRow = getPrimaryCuttingExecutionRow(task)
  const startConditionLabel = getStartConditionLabel(prereq)
  const primaryAction = getNotStartedPrimaryAction(task, prereq)
  const title = cuttingDetail
    ? getTaskDisplayNo(task)
    : cuttingRow
      ? `${task.productionOrderId}｜${cuttingRow.executionOrderNo}`
    : getTaskDisplayNo(task)
  const subtitle = cuttingDetail
    ? getCuttingTaskListSummary(cuttingDetail)
    : cuttingRow
      ? joinDisplayParts([
          getTaskDisplayNo(task),
          cuttingRow.cutOrderNo ? `裁片单 ${cuttingRow.cutOrderNo}` : '裁片单待绑定',
          cuttingRow.markerPlanNo ? `唛架 ${cuttingRow.markerPlanNo}` : '',
        ])
    : getTaskRootNo(task)
  const materialText = cuttingDetail
    ? joinDisplayParts([
        cuttingDetail.materialAlias || cuttingDetail.materialSku,
        cuttingDetail.materialTypeLabel,
      ]) || '待确认'
    : cuttingRow
    ? joinDisplayParts([
        cuttingRow.materialAlias || cuttingRow.materialSku,
        cuttingRow.colorLabel,
        cuttingRow.materialTypeLabel,
      ]) || '待确认'
    : ''
  const quantityText = cuttingDetail
    ? `${(cuttingDetail.orderQty || task.qty).toLocaleString('zh-CN')} 件`
    : cuttingRow
    ? `${task.qty.toLocaleString('zh-CN')} 片`
    : qtyDisplayMeta.valueText
  const startRiskNote =
    startInfo.startRiskStatus === 'DUE_SOON' && typeof startInfo.remainingMs === 'number'
      ? `距开工时限不足 ${formatRemainingHours(startInfo.remainingMs)} 小时，请尽快补齐开工信息`
      : startInfo.startRiskStatus === 'OVERDUE'
        ? '开工已逾期，请立即补录开工信息'
        : ''

  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold">${escapeHtml(title)}</div>
            <div class="mt-0.5 truncate text-[11px] text-muted-foreground">${escapeHtml(subtitle)}</div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            ${renderTaskStatusBadge(task)}
            ${renderSourceBadge(task.assignmentMode)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${
            cuttingDetail
              ? `
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${escapeHtml(displayProcessName)}</div>
                  <div class="text-muted-foreground">裁片单</div>
                  <div class="truncate font-medium">${escapeHtml(`${cuttingDetail.cutOrderGroups.length} 张`)}</div>
                  <div class="text-muted-foreground">铺布单</div>
                  <div class="truncate font-medium">${escapeHtml(`${cuttingDetail.cutPieceOrderCount} 张`)}</div>
                  <div class="text-muted-foreground">下一步</div>
                  <div class="truncate font-medium">${escapeHtml(cuttingDetail.nextRecommendedAction)}</div>
                  <div class="text-muted-foreground">面料</div>
                  <div class="truncate font-medium">${escapeHtml(materialText)}</div>
                `
              : cuttingRow
              ? `
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${escapeHtml(displayProcessName)}</div>
                  <div class="text-muted-foreground">铺布单</div>
                  <div class="truncate font-medium">${escapeHtml(cuttingRow.executionOrderNo)}</div>
                  <div class="text-muted-foreground">裁片单</div>
                  <div class="truncate font-medium">${escapeHtml(cuttingRow.cutOrderNo || '待绑定')}</div>
                  <div class="text-muted-foreground">唛架</div>
                  <div class="truncate font-medium">${escapeHtml(cuttingRow.markerPlanNo || '待确认')}</div>
                  <div class="text-muted-foreground">面料</div>
                  <div class="truncate font-medium">${escapeHtml(materialText)}</div>
                `
              : `
                  <div class="text-muted-foreground">生产单号</div>
                  <div class="truncate font-medium">${escapeHtml(task.productionOrderId)}</div>
                  <div class="text-muted-foreground">原始任务</div>
                  <div class="truncate font-medium">${escapeHtml(getTaskRootNo(task))}</div>
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${escapeHtml(displayProcessName)}</div>
                `
          }
          <div class="text-muted-foreground">数量</div>
          <div class="font-medium">${escapeHtml(quantityText)}</div>
          ${
            taskDeadline
              ? `
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${deadline && deadline.label !== '正常' ? deadline.textClass : ''}">${escapeHtml(taskDeadline || '')}</div>
                `
              : ''
          }
          <div class="text-muted-foreground">开工时限</div>
          <div class="font-medium ${startInfo.startRiskStatus === 'OVERDUE' ? 'text-red-700' : startInfo.startRiskStatus === 'DUE_SOON' ? 'text-amber-700' : ''}">${escapeHtml(startDueAt)}</div>
        </div>

        ${renderCoveredProcessSummary(task)}

        <div class="space-y-0.5 rounded-md border px-3 py-2 text-xs ${toClassName(
          prereq.met ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50',
        )}">
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-foreground">开工条件</span>
            <span class="rounded px-1.5 py-0.5 font-medium ${prereq.met ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(startConditionLabel)}</span>
          </div>
          <p class="mt-1 font-medium ${prereq.met ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(prereq.statusLabel)}</p>
        </div>

        ${
          startRiskNote
            ? `<div class="rounded-md border px-3 py-1.5 text-xs ${startInfo.startRiskStatus === 'OVERDUE' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${escapeHtml(startRiskNote)}</div>`
            : ''
        }

        <div class="flex gap-2 pt-1">
          <button
            class="inline-flex min-h-8 items-center rounded-md px-3 text-xs font-medium ${primaryAction.className}"
            data-pda-exec-action="${primaryAction.action}"
            data-task-id="${escapeHtml(task.taskId)}"
            ${primaryAction.action === 'go-handover' ? 'data-tab="pickup"' : ''}
          >
            <i data-lucide="${primaryAction.icon}" class="mr-1 h-3 w-3"></i>
            ${escapeHtml(primaryAction.label)}
          </button>

          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${escapeHtml(task.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `
}

function renderInProgressCard(task: ProcessTask): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const cuttingDetail = getCuttingTaskDetail(task)
  const isProcessDomainTask = Boolean(cuttingDetail || getPrintWorkOrderByTaskId(task.taskId) || getDyeWorkOrderByTaskId(task.taskId))
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )
  const milestone = getTaskMilestoneState(task)
  const milestoneWarningText = getTaskMilestoneWarningText(task)
  const milestoneTag = milestone.required
    ? milestone.status === 'REPORTED'
      ? '<span class="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">已上报关键节点</span>'
      : `<span class="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">待上报关键节点</span>`
    : ''

  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
          <div class="flex items-center gap-1.5">
            ${renderTaskStatusBadge(task)}
            ${renderSourceBadge(task.assignmentMode)}
            ${milestoneTag}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${
            cuttingDetail
              ? `
                  <div class="text-muted-foreground">生产单号</div>
                  <div class="truncate font-medium">${escapeHtml(cuttingDetail.productionOrderNo)}</div>
                  <div class="text-muted-foreground">裁片单</div>
                  <div class="truncate font-medium">${escapeHtml(`${cuttingDetail.cutOrderGroups.length} 张`)}</div>
                  <div class="text-muted-foreground">铺布单</div>
                  <div class="font-medium">${escapeHtml(`${cuttingDetail.cutPieceOrderCount} 张`)}</div>
                  <div class="text-muted-foreground">下一步</div>
                  <div class="truncate font-medium">${escapeHtml(cuttingDetail.nextRecommendedAction)}</div>
                `
              : `
                  <div class="text-muted-foreground">生产单号</div>
                  <div class="truncate font-medium">${escapeHtml(task.productionOrderId)}</div>
                  <div class="text-muted-foreground">原始任务</div>
                  <div class="truncate font-medium">${escapeHtml(getTaskRootNo(task))}</div>
                  <div class="text-muted-foreground">当前工序</div>
                  <div class="font-medium">${escapeHtml(displayProcessName)}</div>
                  <div class="text-muted-foreground">${escapeHtml(qtyDisplayMeta.label)}</div>
                  <div class="font-medium">${escapeHtml(qtyDisplayMeta.valueText)}</div>
                `
          }

          ${
            task.startedAt
              ? `
                  <div class="text-muted-foreground">开工时间</div>
                  <div class="flex items-center gap-0.5 font-medium">
                    <i data-lucide="clock" class="h-3 w-3 text-muted-foreground"></i>
                    ${escapeHtml(task.startedAt)}
                  </div>
                `
              : ''
          }

          ${
            (task as ProcessTask & { taskDeadline?: string }).taskDeadline
              ? `
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${deadline ? deadline.textClass : ''}">${escapeHtml((task as ProcessTask & { taskDeadline?: string }).taskDeadline || '')}</div>
                `
              : ''
          }
        </div>

        ${renderCoveredProcessSummary(task)}

        ${
          deadline && deadline.label !== '正常'
            ? `<div class="rounded px-2 py-1 text-xs ${deadline.hintClass}">时限状态：${escapeHtml(deadline.label)}</div>`
            : ''
        }

        ${
          milestone.required && milestone.status !== 'REPORTED' && milestoneWarningText
            ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">需${escapeHtml(milestoneWarningText)}</div>`
            : ''
        }

        ${
          task.blockReason
            ? `
                <div class="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  当前卡点：${escapeHtml(blockReasonLabel(task.blockReason))}
                  ${task.blockRemark ? ` — ${escapeHtml(task.blockRemark)}` : ''}
                </div>
              `
            : ''
        }

        <div class="flex gap-2 pt-1">
          <button
            class="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-muted"
            data-pda-exec-action="open-detail-action"
            data-task-id="${escapeHtml(task.taskId)}"
            data-action="pause"
          >
            <i data-lucide="alert-triangle" class="mr-1 h-3 w-3"></i>
            上报暂停
          </button>

          ${
            cuttingDetail
              ? `
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="open-detail"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    <i data-lucide="play" class="mr-1 h-3 w-3"></i>
                    进入裁片
                  </button>
                `
              : isSimpleFiveStepTask(task)
                ? `
                  <button
                    class="inline-flex h-7 items-center rounded-md border border-blue-200 px-3 text-xs text-blue-700 hover:bg-blue-50"
                    data-pda-exec-action="open-detail-action"
                    data-task-id="${escapeHtml(task.taskId)}"
                    data-action="milestone"
                  >
                    <i data-lucide="upload" class="mr-1 h-3 w-3"></i>
                    上传进度
                  </button>
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="go-handover"
                    data-tab="handout"
                  >
                    <i data-lucide="arrow-left-right" class="mr-1 h-3 w-3"></i>
                    去交接交出
                  </button>
                `
              : isProcessDomainTask
                ? ''
              : `
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="finish-task"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    <i data-lucide="check-circle" class="mr-1 h-3 w-3"></i>
                    完工
                  </button>
                `
          }

          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${escapeHtml(task.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `
}

function renderBlockedCard(task: ProcessTask): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )

  const pauseStatus = getPauseHandleStatus(task)
  const pauseReason = (task as ProcessTask & { pauseReasonLabel?: string | null }).pauseReasonLabel
  const pauseAt = (task as ProcessTask & { pauseReportedAt?: string | null }).pauseReportedAt
  return `
    <article class="cursor-pointer rounded-lg border border-red-200 transition-colors hover:border-red-400" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
          <div class="flex shrink-0 items-center gap-1.5">
            ${renderTaskStatusBadge(task)}
            ${renderSourceBadge(task.assignmentMode)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div class="text-muted-foreground">生产单号</div>
          <div class="truncate font-medium">${escapeHtml(task.productionOrderId)}</div>
          <div class="text-muted-foreground">原始任务</div>
          <div class="truncate font-medium">${escapeHtml(getTaskRootNo(task))}</div>
          <div class="text-muted-foreground">当前工序</div>
          <div class="font-medium">${escapeHtml(displayProcessName)}</div>
          ${
            (task as ProcessTask & { taskDeadline?: string }).taskDeadline
              ? `
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${deadline ? deadline.textClass : ''}">${escapeHtml((task as ProcessTask & { taskDeadline?: string }).taskDeadline || '')}</div>
                `
              : ''
          }
        </div>

        ${renderCoveredProcessSummary(task)}

        <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-red-700">${escapeHtml(pauseReason || blockReasonLabel(task.blockReason) || '已上报暂停')}</span>
            <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${pauseStatus.className}">${pauseStatus.label}</span>
          </div>
          ${task.blockRemark ? `<p class="mt-1 text-red-600">${escapeHtml(task.blockRemark)}</p>` : ''}
          ${pauseAt ? `<p class="mt-1 flex items-center gap-1 text-muted-foreground"><i data-lucide="clock" class="h-3 w-3"></i>上报时间：${escapeHtml(pauseAt)}</p>` : ''}
        </div>

        <div class="flex gap-2 pt-1">
          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${escapeHtml(task.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `
}

function renderDoneCard(task: ProcessTask): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const handoutStatus =
    (task as ProcessTask & { handoutStatus?: 'PENDING' | 'HANDED_OUT' }).handoutStatus || 'PENDING'
  const handoutLabel = handoutStatus === 'HANDED_OUT' ? '已交出' : '待交出'

  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
          <div class="flex shrink-0 items-center gap-1.5">
            ${renderTaskStatusBadge(task)}
            ${renderSourceBadge(task.assignmentMode)}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div class="text-muted-foreground">生产单号</div>
          <div class="truncate font-medium">${escapeHtml(task.productionOrderId)}</div>
          <div class="text-muted-foreground">原始任务</div>
          <div class="truncate font-medium">${escapeHtml(getTaskRootNo(task))}</div>
          <div class="text-muted-foreground">当前工序</div>
          <div class="font-medium">${escapeHtml(displayProcessName)}</div>
          <div class="text-muted-foreground">${escapeHtml(qtyDisplayMeta.label)}</div>
          <div class="font-medium">${escapeHtml(qtyDisplayMeta.valueText)}</div>

          ${
            task.finishedAt
              ? `
                  <div class="text-muted-foreground">完工时间</div>
                  <div class="flex items-center gap-0.5 font-medium">
                    <i data-lucide="clock" class="h-3 w-3 text-muted-foreground"></i>
                    ${escapeHtml(task.finishedAt)}
                  </div>
                `
              : ''
          }

          <div class="text-muted-foreground">交接状态</div>
          <div class="font-medium ${handoutStatus === 'HANDED_OUT' ? 'text-green-700' : 'text-amber-700'}">${handoutLabel}</div>
        </div>

        ${renderCoveredProcessSummary(task)}

        ${
          handoutStatus !== 'HANDED_OUT'
            ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">完工不等于结束，请尽快完成交出交接</div>'
            : ''
        }

        <div class="flex gap-2 pt-1">
          <button
            class="inline-flex h-7 items-center rounded-md border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50"
            data-pda-exec-action="go-handover"
            data-tab="handout"
          >
            <i data-lucide="arrow-left-right" class="mr-1 h-3 w-3"></i>
            去交出
          </button>

          <button
            class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
            data-pda-exec-action="open-detail"
            data-task-id="${escapeHtml(task.taskId)}"
          >
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>
    </article>
  `
}

export function renderPdaExecPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) {
    return renderPdaLoginRedirect()
  }

  queueMicrotask(() => {
    syncPdaStartRiskAndExceptions()
    syncMilestoneOverdueExceptions()
  })
  syncTabWithQuery()

  const selectedFactoryId = getCurrentFactoryId()
  const acceptedTasks = getAcceptedTasks(selectedFactoryId)

  const tasksByStatus: Record<TaskStatusTab, ProcessTask[]> = {
    NOT_STARTED: [],
    IN_PROGRESS: [],
    BLOCKED: [],
    DONE: [],
  }

  for (const task of acceptedTasks) {
    const tabKey = getMobileTaskTabKey(task)
    tasksByStatus[tabKey].push(task)
  }

  const filteredTasks = getFilteredTasks(tasksByStatus, state.activeTab)
  const emptyStateText = getPdaExecEmptyStateText(acceptedTasks)

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background" data-testid="pda-exec-page">
      <header class="sticky top-0 z-30 border-b bg-background p-4">
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="搜索任务号 / 加工单号 / 生产单号"
            data-pda-exec-field="searchKeyword"
            value="${escapeHtml(state.searchKeyword)}"
          />
        </div>
      </header>

      <div class="z-20 grid grid-cols-4 border-b bg-background" data-testid="pda-exec-tabs">
        ${TAB_CONFIG.map((tab) => {
          const active = tab.key === state.activeTab
          return `
            <button
              class="border-b-2 py-2.5 text-xs font-medium transition-colors ${toClassName(
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}"
              data-pda-exec-action="switch-tab"
              data-tab="${tab.key}"
            >
              ${escapeHtml(tab.label)}
              <span class="ml-1 text-[10px] opacity-70">(${tasksByStatus[tab.key].length})</span>
            </button>
          `
        }).join('')}
      </div>

      <div class="flex-1 space-y-3 p-4" data-testid="pda-exec-card-list">
        ${renderPdaExecCardList(filteredTasks, emptyStateText)}
      </div>
    </div>
  `

  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

export function handlePdaExecEvent(target: HTMLElement): boolean {
  if (!ensurePdaSessionForAction()) return true

  const fieldNode = target.closest<HTMLElement>('[data-pda-exec-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pdaExecField
    if (!field) return true

    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      updatePdaExecCardListInPlace()
      return false
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-exec-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TaskStatusTab | undefined
    if (tab && TAB_CONFIG.some((item) => item.key === tab)) {
      state.activeTab = tab
      appStore.navigate(buildPdaExecListPath(tab))
    }
    return true
  }

  if (action === 'open-detail') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      appStore.navigate(resolvePdaExecCardDetailPath(taskId))
    }
    return true
  }

  if (action === 'open-detail-action') {
    const taskId = actionNode.dataset.taskId
    const detailAction = actionNode.dataset.action
    if (taskId && detailAction) {
      const targetPath = resolvePdaTaskExecPath(taskId, appStore.getState().pathname)
      appStore.navigate(targetPath.includes('/fcs/pda/cutting/') ? targetPath : appendExecDetailAction(targetPath, detailAction))
    }
    return true
  }

  if (action === 'go-start') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      const targetPath = resolvePdaTaskExecPath(taskId, appStore.getState().pathname)
      appStore.navigate(targetPath.includes('/fcs/pda/cutting/') ? targetPath : appendExecDetailAction(targetPath, 'start'))
    }
    return true
  }

  if (action === 'go-prerequisite') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      appStore.navigate(resolvePdaTaskExecPath(taskId, appStore.getState().pathname))
    }
    return true
  }

  if (action === 'go-handover') {
    const tab = actionNode.dataset.tab || 'wait-process'
    appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    return true
  }

  if (action === 'go-warehouse') {
    appStore.navigate('/fcs/pda/warehouse/wait-process')
    return true
  }

  if (action === 'finish-task') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true
    if (getPrintWorkOrderByTaskId(taskId) || getDyeWorkOrderByTaskId(taskId)) {
      showPdaExecToast('请进入任务详情按当前节点操作')
      return true
    }
    if (isSimpleFiveStepTask(task)) {
      showPdaExecToast(`请先上传进度并交给${task.handoverReceiverName || '仓库'}，仓库待确认后才能完工`)
      appStore.navigate(resolvePdaExecCardDetailPath(taskId))
      return true
    }

    if (!isTaskMilestoneReported(task)) {
      showPdaExecToast('请先完成关键节点上报')
      return true
    }

    mutateFinishTask(taskId, 'PDA')
    showPdaExecToast('完工成功')
    return true
  }

  return false
}
