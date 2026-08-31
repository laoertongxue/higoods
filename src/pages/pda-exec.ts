import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { getProcessTaskQtyDisplayMeta, getProcessTaskQtyDisplayUnit, type ProcessTask } from '../data/fcs/process-tasks'
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
import {
  getWaterSolubleCurrentAction,
  getWaterSolubleWorkOrderByTaskId,
  WATER_SOLUBLE_STATUS_LABEL,
  type WaterSolubleWorkOrder,
} from '../data/fcs/water-soluble-task-domain.ts'
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
import { listWoolWorkOrders } from '../data/fcs/wool-task-domain.ts'
import {
  resolveWoolPdaScan,
  type WoolPdaScanCandidate,
} from '../data/fcs/wool-pda-scan.ts'
import {
  getSpecialCraftPdaCandidateByWorkOrderId,
  hasSpecialCraftOrdersForFactory,
  resolveSpecialCraftPdaScan,
  type SpecialCraftPdaScanCandidate,
} from '../data/fcs/special-craft-pda-scan.ts'
import { listSpecialCraftTaskOrders } from '../data/fcs/special-craft-task-orders.ts'
import {
  getBindingProcessPdaCandidateByWorkOrderId,
  hasBindingProcessOrdersForFactory,
  resolveBindingProcessPdaScan,
  type BindingProcessPdaScanCandidate,
} from '../data/fcs/binding-process-pda-scan.ts'
import { buildBindingProcessOrders } from './process-factory/cutting/binding-strip-orders.ts'
import {
  getPostFinishingTaskById,
  getPostFinishingWorkOrderBySourceTaskId,
} from '../data/fcs/post-finishing-domain.ts'
import { getKolGotoHandoutQty } from '../data/fcs/kol-goto-pda-domain.ts'
import { isKolGotoFactory, isKolGotoWholeOrderTask, normalizeKolGotoFactoryId } from '../data/fcs/kol-goto-special-flow.ts'
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
  buildPdaExecPageSlice,
  renderPdaExecPaginationControls,
} from './pda-exec-pagination.ts'
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
  page: number
  woolScanMessage: string
  woolScanTone: 'info' | 'error'
  woolScanCandidates: WoolPdaScanCandidate[]
  woolLastResolvedCode: string
  specialCraftScanMessage: string
  specialCraftScanTone: 'info' | 'error'
  specialCraftScanCandidates: SpecialCraftPdaScanCandidate[]
  specialCraftLastResolvedCode: string
  specialCraftTab: TaskStatusTab
  bindingScanKeyword: string
  bindingScanMessage: string
  bindingScanTone: 'info' | 'error'
  bindingScanCandidates: BindingProcessPdaScanCandidate[]
  bindingLastResolvedCode: string
  bindingTab: TaskStatusTab
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
  page: 1,
  woolScanMessage: '',
  woolScanTone: 'info',
  woolScanCandidates: [],
  woolLastResolvedCode: '',
  specialCraftScanMessage: '',
  specialCraftScanTone: 'info',
  specialCraftScanCandidates: [],
  specialCraftLastResolvedCode: '',
  specialCraftTab: 'IN_PROGRESS',
  bindingScanKeyword: '',
  bindingScanMessage: '',
  bindingScanTone: 'info',
  bindingScanCandidates: [],
  bindingLastResolvedCode: '',
  bindingTab: 'IN_PROGRESS',
}

const PDA_EXEC_PAGE_SIZE = 10

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
  if (getMobileTaskProcessType(task) === 'WOOL') {
    const label = task.woolKind === 'PART_PANEL' ? '本单毛织部位片数（片）' : '本单毛织整件数（件）'
    const qtyUnit = task.qtyDisplayUnit || (task.woolKind === 'PART_PANEL' ? '片' : '件')
    return {
      label,
      valueText: `${label.replace(/（.*$/, '')}：${task.qty} ${qtyUnit}`,
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

  const unitLabel = getProcessTaskQtyDisplayUnit(task)
  if (task.qtyDisplayUnit?.trim()) {
    return getProcessTaskQtyDisplayMeta(task)
  }
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
  const hasKeywordParam = searchParams.has('keyword')
  const rawTab = searchParams.get('tab') || ''
  const mapped = TAB_PARAM_MAP[rawTab] || 'NOT_STARTED'
  const nextRisk = searchParams.get('risk') || ''
  const nextKeyword = hasKeywordParam
    ? searchParams.get('keyword') || ''
    : state.searchKeyword
  if (state.activeTab !== mapped || state.riskParam !== nextRisk || state.searchKeyword !== nextKeyword) {
    state.page = 1
  }
  state.activeTab = mapped
  state.riskParam = nextRisk
  state.searchKeyword = nextKeyword
  if (hasKeywordParam) state.bindingScanKeyword = nextKeyword
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
  if (getPrintWorkOrderByTaskId(taskId) || getDyeWorkOrderByTaskId(taskId) || getMobileTaskProcessType(task) === 'WOOL') return

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
  const resolvedFactoryId = normalizeKolGotoFactoryId(factoryId) ?? factoryId
  return listMobileExecutionTasks({
    currentFactoryId: resolvedFactoryId,
  })
    .filter((task) => canFactoryAccessSpecialCraftPdaTask(resolvedFactoryId, task))
    .filter((task) => {
      const processType = getMobileTaskProcessType(task)
      if (processType === 'SPECIAL_CRAFT') return false
      if (processType !== 'WOOL') return true
      if (task.woolProcessingStatus === 'COMPLETED') return true
      return ['REPORT_PROCESS', 'ASSOCIATE_MACHINE', 'COMPLETE']
        .some((action) => task.woolAllowedActions?.includes(action))
    })
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

function getTaskStatusLabel(task: ProcessTask): string {
  const printOrder = getPrintWorkOrderByTaskId(task.taskId)
  if (printOrder?.status === 'HANDOVER_WAIT_RECEIVE') return '待对方收货'
  const dyeOrder = getDyeWorkOrderByTaskId(task.taskId)
  if (dyeOrder?.status === 'HANDOVER_WAIT_RECEIVE') return '待对方收货'
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
  if (/接收|收货|入仓|来料/.test(prereq.blocker)) return '待接收确认'
  if (/绑定/.test(prereq.blocker)) return '待绑定裁片单'
  if (/执行明细|同步/.test(prereq.blocker)) return '待执行明细同步'
  if (/上游|连续流转/.test(prereq.blocker)) return '待前置完成'
  return '待前置完成'
}

function getNotStartedPrimaryAction(
  task: ProcessTask,
  prereq: ReturnType<typeof getStartPrerequisite>,
): { label: string; icon: string; action: 'go-start' | 'go-prerequisite' | 'go-handover'; className: string } {
  if (isKolGotoWholeOrderTask(task)) {
    return {
      label: '去加工领料',
      icon: 'package-open',
      action: 'go-prerequisite',
      className: 'bg-primary text-primary-foreground hover:bg-primary/90',
    }
  }

  if (prereq.met) {
    return {
      label: isCuttingSpecialTask(task) ? '进入裁片任务' : '开工',
      icon: 'play',
      action: 'go-start',
      className: 'bg-primary text-primary-foreground hover:bg-primary/90',
    }
  }

  if (isCuttingSpecialTask(task) && /接收|入仓|来料/.test(prereq.blocker)) {
    return {
      label: '去交接确认',
      icon: 'arrow-left-right',
      action: 'go-prerequisite',
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
  if (/接收|收货|入仓|来料/.test(prereq.blocker)) return 3
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

function renderWoolFactCard(task: ProcessTask): string {
  const primaryAction = (['REPORT_PROCESS', 'ASSOCIATE_MACHINE', 'COMPLETE'] as const)
    .find((action) => task.woolAllowedActions?.includes(action))
  const actionLabel = primaryAction === 'REPORT_PROCESS'
    ? '加工填报'
    : primaryAction === 'ASSOCIATE_MACHINE'
      ? '关联横机设备'
      : primaryAction === 'COMPLETE'
        ? '完成加工单'
        : '查看加工单'
  const readyOutputSkuCodes = task.woolReadyOutputSkuCodes || []
  const missingYarnSkus = task.woolMissingYarnSkus || []
  const yarnText = readyOutputSkuCodes.length
    ? `已有可填报款色：${readyOutputSkuCodes.join('、')}`
    : missingYarnSkus.length
      ? `尚缺纱线：${missingYarnSkus.join('、')}`
      : '等待确认接收纱线'
  const styleImageUrl = /^(?:https?:\/\/|\/|data:image\/)/i.test(task.woolStyleImageUrl?.trim() || '')
    ? task.woolStyleImageUrl!.trim()
    : ''
  const styleImageTitle = task.woolStyleNo || '毛织款式'

  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="flex gap-3 p-3">
        ${styleImageUrl ? `<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${escapeHtml(styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(styleImageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(styleImageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(styleImageUrl)}" alt="${escapeHtml(task.woolStyleNo || '')}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="text-xs text-muted-foreground">暂无款式图</span></div>'}
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">${escapeHtml(task.woolOrderNo || task.taskNo)}</div>
              <div class="mt-0.5 truncate text-[11px] text-muted-foreground">${escapeHtml(task.woolStyleNo || '')} · ${escapeHtml(task.productionOrderNo)}</div>
            </div>
            <span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">${escapeHtml(task.woolProcessingStatusLabel || '待处理')}</span>
          </div>
          <div class="text-xs">加工对象：${escapeHtml(task.woolOutputSummary || '待确认')}</div>
          <div class="rounded-md border px-2 py-1.5 text-xs ${readyOutputSkuCodes.length ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${escapeHtml(yarnText)}</div>
          <button type="button" class="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">${escapeHtml(actionLabel)}</button>
        </div>
      </div>
    </article>
  `
}

const SPECIAL_CRAFT_TAB_CONFIG: Array<{ key: TaskStatusTab; label: string }> = [
  { key: 'NOT_STARTED', label: '待接收' },
  { key: 'IN_PROGRESS', label: '加工中' },
  { key: 'BLOCKED', label: '待交出' },
  { key: 'DONE', label: '已完成' },
]

function getSpecialCraftWorkOrderTab(candidate: SpecialCraftPdaScanCandidate): TaskStatusTab {
  const { order } = candidate
  if (order.status === '待接收') return 'NOT_STARTED'
  if (order.status === '已完结') return 'DONE'
  if (order.completedQty > (order.returnedQty || 0)) return 'BLOCKED'
  return 'IN_PROGRESS'
}

function buildSpecialCraftWorkOrderPath(candidate: SpecialCraftPdaScanCandidate): string {
  const tab = getSpecialCraftWorkOrderTab(candidate)
  const returnTo = '/fcs/pda/exec'
  if (tab === 'NOT_STARTED') {
    return `/fcs/pda/exec/${candidate.sourceType}/${encodeURIComponent(candidate.workOrderId)}?surface=handover&handoverAction=receive&returnTo=${encodeURIComponent('/fcs/pda/handover?tab=pickup')}`
  }
  if (tab === 'BLOCKED') {
    return `/fcs/pda/exec/${candidate.sourceType}/${encodeURIComponent(candidate.workOrderId)}?surface=handover&handoverAction=handout&returnTo=${encodeURIComponent('/fcs/pda/handover?tab=handout')}`
  }
  return `/fcs/pda/exec/${candidate.sourceType}/${encodeURIComponent(candidate.workOrderId)}?returnTo=${encodeURIComponent(returnTo)}`
}

function listSpecialCraftCandidatesForFactory(factoryId: string): SpecialCraftPdaScanCandidate[] {
  const keyword = state.searchKeyword.trim().toLocaleLowerCase()
  return listSpecialCraftTaskOrders()
    .filter((order) => order.factoryId === factoryId)
    .map((order) => getSpecialCraftPdaCandidateByWorkOrderId(order.taskOrderId))
    .filter((candidate): candidate is SpecialCraftPdaScanCandidate => Boolean(candidate))
    .filter((candidate) => {
      if (!keyword) return true
      return [
        candidate.workOrderNo,
        candidate.workOrderId,
        candidate.sourceTaskNo,
        candidate.sourceTaskId,
        candidate.order.productionOrderNo,
        candidate.order.productionOrderId,
        candidate.order.operationName,
        candidate.order.targetObject,
      ].some((value) => value.toLocaleLowerCase().includes(keyword))
    })
    .sort((left, right) => (right.order.updatedAt || '').localeCompare(left.order.updatedAt || ''))
}

function renderSpecialCraftFactCard(candidate: SpecialCraftPdaScanCandidate): string {
  const { order } = candidate
  const imageTitle = `${candidate.styleNo} · ${candidate.styleName}`
  const tab = getSpecialCraftWorkOrderTab(candidate)
  const actionLabel = tab === 'NOT_STARTED' ? '确认接收' : tab === 'BLOCKED' ? '发起交出' : tab === 'DONE' ? '查看加工记录' : '加工填报'
  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-work-order-card" data-pda-exec-action="open-special-craft-work-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}" data-source-task-id="${escapeHtml(candidate.sourceTaskId)}">
      <div class="flex gap-3 p-3">
        ${candidate.styleImageUrl ? `<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${escapeHtml(candidate.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(candidate.styleImageUrl)}" alt="${escapeHtml(imageTitle)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="text-xs text-muted-foreground">款式图缺失</span></div>'}
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">${escapeHtml(order.taskOrderNo)}</div>
              <div class="mt-0.5 truncate text-[11px] text-muted-foreground">${escapeHtml(candidate.styleNo)} · ${escapeHtml(order.productionOrderNo)}</div>
            </div>
            <span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">${escapeHtml(order.status)}</span>
          </div>
          <div class="text-xs">${escapeHtml(order.operationName)} · ${escapeHtml(order.targetObject)}</div>
          <div class="text-[11px] text-muted-foreground">来源任务：${escapeHtml(candidate.sourceTaskNo || candidate.sourceTaskId || '—')}</div>
          <div class="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">已接收 ${order.receivedQty} / 已完成 ${order.completedQty} ${escapeHtml(order.unit)}</div>
          <button type="button" class="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-special-craft-work-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}" data-source-task-id="${escapeHtml(candidate.sourceTaskId)}">${escapeHtml(actionLabel)}</button>
        </div>
      </div>
    </article>
  `
}

function renderSpecialCraftWorkOrderSection(factoryId: string): string {
  const candidates = listSpecialCraftCandidatesForFactory(factoryId)
  if (!candidates.length) return ''
  const counts = Object.fromEntries(SPECIAL_CRAFT_TAB_CONFIG.map((tab) => [tab.key, 0])) as Record<TaskStatusTab, number>
  candidates.forEach((candidate) => { counts[getSpecialCraftWorkOrderTab(candidate)] += 1 })
  const matchedTabs = [...new Set(candidates.map(getSpecialCraftWorkOrderTab))]
  if (state.searchKeyword.trim() && matchedTabs.length === 1) state.specialCraftTab = matchedTabs[0]
  const rows = candidates.filter((candidate) => getSpecialCraftWorkOrderTab(candidate) === state.specialCraftTab)
  const page = buildPdaExecPageSlice(rows, state.page, PDA_EXEC_PAGE_SIZE)
  state.page = page.currentPage
  return `
    <section class="space-y-3" data-pda-special-craft-work-order-list>
      <div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">工艺加工单</h2><span class="text-[11px] text-muted-foreground">任务仅作来源追溯</span></div>
      <div class="grid grid-cols-4 rounded-lg border bg-background">
        ${SPECIAL_CRAFT_TAB_CONFIG.map((tab) => `<button type="button" class="border-b-2 py-2 text-[11px] ${tab.key === state.specialCraftTab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}" data-pda-exec-action="switch-special-craft-tab" data-tab="${tab.key}">${tab.label}<span class="ml-1 opacity-70">(${counts[tab.key]})</span></button>`).join('')}
      </div>
      <div class="space-y-3">${page.rows.length ? page.rows.map(renderSpecialCraftFactCard).join('') : '<div class="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">当前没有此状态的加工单</div>'}</div>
      ${renderPdaExecPaginationControls(page)}
    </section>
  `
}

function getBindingWorkOrderTab(candidate: BindingProcessPdaScanCandidate): TaskStatusTab {
  const { order } = candidate
  if (order.status === '已完成') return 'DONE'
  if (order.actualOutputQty > (order.handedOverQty || 0)) return 'BLOCKED'
  if (order.status === '待加工') return 'NOT_STARTED'
  return 'IN_PROGRESS'
}

function buildBindingWorkOrderPath(candidate: BindingProcessPdaScanCandidate): string {
  const tab = getBindingWorkOrderTab(candidate)
  if (tab === 'NOT_STARTED') {
    return `/fcs/pda/exec/${candidate.sourceType}/${encodeURIComponent(candidate.workOrderId)}?surface=handover&handoverAction=receive&returnTo=${encodeURIComponent('/fcs/pda/handover?tab=pickup')}`
  }
  if (tab === 'BLOCKED') {
    return `/fcs/pda/exec/${candidate.sourceType}/${encodeURIComponent(candidate.workOrderId)}?surface=handover&handoverAction=handout&returnTo=${encodeURIComponent('/fcs/pda/handover?tab=handout')}`
  }
  return `/fcs/pda/exec/${candidate.sourceType}/${encodeURIComponent(candidate.workOrderId)}?returnTo=${encodeURIComponent('/fcs/pda/exec')}`
}

function listBindingCandidatesForFactory(factoryId: string): BindingProcessPdaScanCandidate[] {
  const keyword = state.searchKeyword.trim().toLocaleLowerCase()
  return buildBindingProcessOrders()
    .filter((order) => order.factoryId === factoryId)
    .map((order) => getBindingProcessPdaCandidateByWorkOrderId(order.bindingOrderId))
    .filter((candidate): candidate is BindingProcessPdaScanCandidate => Boolean(candidate))
    .filter((candidate) => !keyword || [
      candidate.workOrderId,
      candidate.workOrderNo,
      candidate.sourceTaskId,
      candidate.sourceTaskNo,
      candidate.order.sourceProductionOrderId,
      candidate.order.sourceProductionOrderNo,
      candidate.order.materialIdentity.materialSku,
      ...candidate.order.sourceFeiTicketNos,
    ].some((value) => value.toLocaleLowerCase().includes(keyword)))
    .sort((left, right) => right.workOrderNo.localeCompare(left.workOrderNo, 'zh-CN'))
}

function renderBindingFactCard(candidate: BindingProcessPdaScanCandidate): string {
  const { order } = candidate
  const tab = getBindingWorkOrderTab(candidate)
  const actionLabel = tab === 'NOT_STARTED' ? '确认接收' : tab === 'BLOCKED' ? '发起交出' : tab === 'DONE' ? '查看加工记录' : '加工填报'
  const imageTitle = `${order.materialIdentity.materialSku} · ${order.materialIdentity.materialName}`
  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-binding-work-order-card" data-pda-exec-action="open-binding-work-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}">
      <div class="flex gap-3 p-3">
        ${order.materialIdentity.materialImageUrl ? `<button type="button" class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30" data-pda-image-preview-url="${escapeHtml(order.materialIdentity.materialImageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(order.materialIdentity.materialImageUrl)}" alt="${escapeHtml(imageTitle)}物料图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted/30"><span class="px-1 text-center text-xs text-muted-foreground">物料图缺失</span></div>'}
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="truncate text-sm font-semibold">${escapeHtml(order.bindingOrderNo)}</div><div class="mt-0.5 truncate text-[11px] text-muted-foreground">${escapeHtml(order.sourceProductionOrderNo)} · ${escapeHtml(order.materialIdentity.materialSku)}</div></div><span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">${escapeHtml(order.status)}</span></div>
          <div class="text-xs">${order.bindingSpecificationCount} 个规格 · 计划 ${order.plannedOutputQty} 米</div>
          <div class="text-[11px] text-muted-foreground">来源任务：${escapeHtml(order.sourceTaskNo)}</div>
          <div class="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">实收 ${order.receivedMaterialLength} / 已加工 ${order.actualOutputQty} / 已交出 ${order.handedOverQty || 0} 米</div>
          <button type="button" class="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-binding-work-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}">${escapeHtml(actionLabel)}</button>
        </div>
      </div>
    </article>`
}

function renderBindingWorkOrderSection(factoryId: string): string {
  const candidates = listBindingCandidatesForFactory(factoryId)
  if (!candidates.length) return ''
  const counts = Object.fromEntries(SPECIAL_CRAFT_TAB_CONFIG.map((tab) => [tab.key, 0])) as Record<TaskStatusTab, number>
  candidates.forEach((candidate) => { counts[getBindingWorkOrderTab(candidate)] += 1 })
  const matchedTabs = [...new Set(candidates.map(getBindingWorkOrderTab))]
  if (state.searchKeyword.trim() && matchedTabs.length === 1) state.bindingTab = matchedTabs[0]
  const rows = candidates.filter((candidate) => getBindingWorkOrderTab(candidate) === state.bindingTab)
  const page = buildPdaExecPageSlice(rows, state.page, PDA_EXEC_PAGE_SIZE)
  state.page = page.currentPage
  return `<section class="space-y-3" data-pda-binding-work-order-list>
    <div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">捆条加工单</h2><span class="text-[11px] text-muted-foreground">按加工单和规格执行</span></div>
    <div class="grid grid-cols-4 rounded-lg border bg-background">${SPECIAL_CRAFT_TAB_CONFIG.map((tab) => `<button type="button" class="border-b-2 py-2 text-[11px] ${tab.key === state.bindingTab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}" data-pda-exec-action="switch-binding-tab" data-tab="${tab.key}">${tab.label}<span class="ml-1 opacity-70">(${counts[tab.key]})</span></button>`).join('')}</div>
    <div class="space-y-3">${page.rows.length ? page.rows.map(renderBindingFactCard).join('') : '<div class="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">当前没有此状态的捆条加工单</div>'}</div>
    ${renderPdaExecPaginationControls(page)}
  </section>`
}

function renderPdaExecCardList(filteredTasks: ProcessTask[], emptyStateText: string): string {
  const page = buildPdaExecPageSlice(filteredTasks, state.page, PDA_EXEC_PAGE_SIZE)
  state.page = page.currentPage
  const cards = page.rows.length
    ? page.rows.map((task) => {
      if (getMobileTaskProcessType(task) === 'WOOL') return renderWoolFactCard(task)
      if (getMobileTaskProcessType(task) === 'WATER_SOLUBLE') return renderWaterSolubleCard(task)
      if (state.activeTab === 'NOT_STARTED') return renderNotStartedCard(task)
      if (state.activeTab === 'IN_PROGRESS') return renderInProgressCard(task)
      if (state.activeTab === 'BLOCKED') return renderBlockedCard(task)
      return renderDoneCard(task)
    }).join('')
    : `<div class="py-10 text-center text-sm text-muted-foreground">${escapeHtml(emptyStateText)}</div>`
  return `${cards}
    ${renderPdaExecPaginationControls(page)}`
}

export function renderWaterSolubleCard(
  task: ProcessTask,
  order: WaterSolubleWorkOrder | null = getWaterSolubleWorkOrderByTaskId(task.taskId),
): string {
  if (!order) return ''
  const currentAction = getWaterSolubleCurrentAction(order.waterOrderId)
  const nextAction = order.status === 'PRODUCTION_PAUSED'
    ? '查看主管处理'
    : currentAction?.actionName || '查看任务'
  const isPaused = order.status === 'PRODUCTION_PAUSED'

  return `
    <article class="cursor-pointer rounded-lg border ${isPaused ? 'border-red-200' : ''} transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-semibold">水溶加工单</div>
            <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">${escapeHtml(order.waterOrderNo)}</div>
          </div>
          ${renderTaskStatusBadge(task)}
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div class="text-muted-foreground">物料</div>
          <div class="truncate font-medium">${escapeHtml(`${order.materialName} / ${order.materialCode}`)}</div>
          <div class="text-muted-foreground">计划数量</div>
          <div class="font-medium">${escapeHtml(`${order.plannedQty.toLocaleString('zh-CN')} ${order.qtyUnit}`)}</div>
          <div class="text-muted-foreground">当前步骤</div>
          <div class="font-medium">${escapeHtml(WATER_SOLUBLE_STATUS_LABEL[order.status])}</div>
          <div class="text-muted-foreground">下一步</div>
          <div class="font-medium">${escapeHtml(nextAction)}</div>
          <div class="text-muted-foreground">生产单号</div>
          <div class="truncate font-medium">${escapeHtml(order.productionOrderNo)}</div>
        </div>

        ${isPaused
          ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><div class="font-medium">生产暂停</div><p class="mt-1">${escapeHtml(order.exceptionReason || '等待主管处理')}</p></div>`
          : ''}

        <button
          class="inline-flex min-h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-exec-action="open-detail"
          data-task-id="${escapeHtml(task.taskId)}"
        >
          查看任务
        </button>
      </div>
    </article>
  `
}

function updatePdaExecCardListInPlace(): void {
  const listNode = document.querySelector<HTMLElement>('[data-testid="pda-exec-card-list"]')
  if (!listNode) return

  const selectedFactoryId = getCurrentFactoryId()
  const acceptedTasks = getAcceptedTasks(selectedFactoryId)
  if (isKolGotoFactory(selectedFactoryId)) {
    listNode.innerHTML = renderKolGotoExecCardList(acceptedTasks)
    return
  }
  const tasksByStatus = buildPdaExecTasksByStatus(acceptedTasks)
  const filteredTasks = getFilteredTasks(tasksByStatus, state.activeTab)
  listNode.innerHTML = `${renderBindingWorkOrderSection(selectedFactoryId)}${renderSpecialCraftWorkOrderSection(selectedFactoryId)}${acceptedTasks.length ? `<section class="space-y-3" data-pda-general-task-list><h2 class="text-sm font-semibold">其他执行任务</h2>${renderPdaExecCardList(filteredTasks, getPdaExecEmptyStateText(acceptedTasks))}</section>` : ''}`
}

function renderKolGotoExecCardList(acceptedTasks: ProcessTask[]): string {
  const uniqueTasks = Array.from(
    new Map(
      acceptedTasks
        .filter((task) => isKolGotoWholeOrderTask(task))
        .map((task) => [task.taskId, task]),
    ).values(),
  )
  const keyword = state.searchKeyword.trim()
  const tasks = keyword
    ? uniqueTasks.filter((task) => matchMobileTaskKeyword(task, keyword))
    : uniqueTasks
  if (tasks.length === 0) {
    return `<div class="py-12 text-center text-sm text-muted-foreground">${keyword ? '当前关键词未找到 KOL 整单任务' : '当前暂无 KOL 整单任务'}</div>`
  }

  return tasks.map((task) => {
    const handedQty = getKolGotoHandoutQty(task.taskId)
    const remainingQty = Math.max(task.qty - handedQty, 0)
    const canHandout = task.status === 'IN_PROGRESS' && remainingQty > 0
    const canComplete = task.status !== 'DONE' && handedQty === task.qty
    const statusLabel = task.status === 'DONE' ? '已完成' : task.status === 'IN_PROGRESS' ? '加工中' : '未开工'
    return `
      <article class="rounded-xl border bg-card p-4" data-testid="pda-exec-task-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0"><div class="truncate text-sm font-semibold">KOL 整单任务</div><div class="mt-1 truncate font-mono text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</div></div>
          <span class="shrink-0 rounded-full px-2 py-1 text-[11px] ${task.status === 'DONE' ? 'bg-green-50 text-green-700' : task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}">${statusLabel}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div class="text-muted-foreground">生产单</div><div class="truncate font-medium">${escapeHtml(task.productionOrderNo || task.productionOrderId || '-')}</div>
          <div class="text-muted-foreground">售卖类型</div><div class="font-medium">${escapeHtml(task.saleTypeSnapshot || '-')}</div>
          <div class="text-muted-foreground">任务数量</div><div class="font-medium">${task.qty} 件</div>
          <div class="text-muted-foreground">已加工 / 已交出</div><div class="font-medium">${handedQty} 件</div>
          <div class="text-muted-foreground">固定总价</div><div class="font-medium">${Number(task.fixedTotalPrice || 0).toLocaleString('id-ID')} ${escapeHtml(task.fixedTotalPriceCurrency || 'IDR')} / 整单</div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <button class="min-h-11 rounded-xl border px-2 text-xs font-semibold ${task.status === 'DONE' ? 'opacity-40' : ''}" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}" ${task.status === 'DONE' ? 'disabled' : ''}>去加工领料</button>
          <button class="min-h-11 rounded-xl border px-2 text-xs font-semibold ${canHandout ? 'border-blue-300 text-blue-700' : 'opacity-40'}" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}" ${canHandout ? '' : 'disabled'}>发起交出</button>
          <button class="min-h-11 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground ${canComplete ? '' : task.status === 'DONE' ? 'bg-green-600' : 'opacity-40'}" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}" ${canComplete ? '' : 'disabled'}>${task.status === 'DONE' ? '已完成' : '完成'}</button>
        </div>
      </article>
    `
  }).join('')
}

function renderKolGotoExecListPage(acceptedTasks: ProcessTask[]): string {
  const content = `
    <div class="flex min-h-[760px] flex-col bg-background" data-testid="pda-exec-page" data-kol-exec-list>
      <header class="sticky top-0 z-30 space-y-3 border-b bg-background p-4">
        <div><h1 class="text-base font-semibold">执行</h1><p class="mt-1 text-xs text-muted-foreground">仅保留加工领料、发起交出和完成；加工领料与发起交出均可多次。</p></div>
        <div class="relative"><i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i><input class="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm" placeholder="搜索任务号 / 生产单号" data-pda-exec-field="searchKeyword" data-skip-page-rerender="true" value="${escapeHtml(state.searchKeyword)}" /></div>
      </header>
      <main class="flex-1 space-y-3 p-4" data-testid="pda-exec-card-list">${renderKolGotoExecCardList(acceptedTasks)}</main>
    </div>
  `
  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
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
  const isKolGotoTask = isKolGotoWholeOrderTask(task)

  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
          <div class="flex items-center gap-1.5">
            ${renderTaskStatusBadge(task)}
            ${renderSourceBadge(task.assignmentMode)}
            ${isKolGotoTask ? '' : milestoneTag}
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
          !isKolGotoTask && milestone.required && milestone.status !== 'REPORTED' && milestoneWarningText
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
          ${isKolGotoTask ? '' : `
            <button
              class="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-muted"
              data-pda-exec-action="open-detail-action"
              data-task-id="${escapeHtml(task.taskId)}"
              data-action="pause"
            >
              <i data-lucide="alert-triangle" class="mr-1 h-3 w-3"></i>
              上报暂停
            </button>
          `}

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
              : isKolGotoTask
                ? `
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="open-detail"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    <i data-lucide="play" class="mr-1 h-3 w-3"></i>
                    继续处理
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

function hasWoolOrdersForFactory(factoryId: string): boolean {
  return listWoolWorkOrders().some((order) => order.factoryId === factoryId)
}

function renderWoolScanCandidate(candidate: WoolPdaScanCandidate): string {
  const order = candidate.order
  const imageUrl = /^(?:https?:\/\/|\/|data:image\/)/i.test(order.styleImageUrl?.trim() || '')
    ? order.styleImageUrl!.trim()
    : ''
  const outputSummary = order.outputPlanLines
    .map((line) => [line.colorName, line.sizeCode, line.woolPartName].filter(Boolean).join('/'))
    .filter(Boolean)
    .join('、') || '待核对加工对象'
  const imageTitle = `${order.styleNo} · ${order.styleName}`
  return `<article class="rounded-lg border bg-background p-3" data-pda-wool-scan-candidate>
    <div class="flex gap-3">
      ${imageUrl ? `<button type="button" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${order.styleName}款式图片`)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted/30"><span class="px-1 text-center text-[10px] text-muted-foreground">暂无款式图</span></div>'}
      <div class="min-w-0 flex-1 text-xs">
        <div class="font-semibold">${escapeHtml(order.woolOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(order.productionOrderNo)}</div>
        <div class="mt-1">${escapeHtml(order.styleNo)} · ${escapeHtml(outputSummary)}</div>
      </div>
    </div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(order.taskId)}">选择此加工单</button>
  </article>`
}

function renderWoolExecutionScanFeedback(): string {
  const message = state.woolScanMessage
    ? `<div class="rounded border px-3 py-2 text-xs ${state.woolScanTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}">${escapeHtml(state.woolScanMessage)}</div>`
    : ''
  const candidates = state.woolScanCandidates.length > 0
    ? `<div class="space-y-2">${state.woolScanCandidates.map(renderWoolScanCandidate).join('')}</div>`
    : ''
  return `<div class="mt-3 space-y-2" data-pda-exec-wool-scan-feedback>${message}${candidates}</div>`
}

function renderWoolExecutionScanHeader(): string {
  return `<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-exec-wool-scan>
    <div class="flex items-start gap-2">
      <i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
      <div><div class="text-sm font-semibold text-blue-950">扫码进入加工填报</div><div class="mt-1 text-xs text-blue-800">优先扫描生产单码或毛织加工单码；一个生产单有多张加工单时再选择。</div></div>
    </div>
    <div class="mt-3 flex gap-2">
      <input
        class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="扫描生产单 / 加工单"
        data-pda-exec-field="searchKeyword"
        data-pda-scan-enter="true"
        data-skip-page-rerender="true"
        value="${escapeHtml(state.searchKeyword)}"
      />
      <button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-exec-action="scan-wool-order">识别加工单</button>
    </div>
    <div class="mt-2 text-[11px] text-blue-700">“执行”只处理加工填报、关联横机设备、完成加工单。</div>
    ${renderWoolExecutionScanFeedback()}
  </section>`
}

function runWoolExecutionScan(rawCode: string): void {
  state.woolLastResolvedCode = rawCode.trim()
  const result = resolveWoolPdaScan(rawCode, getCurrentFactoryId(), 'EXECUTION')
  state.woolScanMessage = result.message
  state.woolScanTone = result.status === 'MATCH' || result.status === 'MULTIPLE' ? 'info' : 'error'
  state.woolScanCandidates = result.candidates
  if (result.status === 'MATCH') {
    appStore.navigate(resolvePdaExecCardDetailPath(result.candidates[0].order.taskId))
  }
}

function updateWoolExecutionScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-exec-wool-scan-feedback]')
  if (target) target.outerHTML = renderWoolExecutionScanFeedback()
}

function renderSpecialCraftScanCandidate(candidate: SpecialCraftPdaScanCandidate): string {
  const { order } = candidate
  const imageTitle = `${candidate.styleNo} · ${candidate.styleName}`
  return `<article class="rounded-lg border bg-background p-3" data-pda-special-craft-scan-candidate>
    <div class="flex gap-3">
      ${candidate.styleImageUrl ? `<button type="button" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30" data-pda-image-preview-url="${escapeHtml(candidate.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(imageTitle)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageTitle)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(candidate.styleImageUrl)}" alt="${escapeHtml(imageTitle)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>` : '<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted/30"><span class="px-1 text-center text-[10px] text-muted-foreground">款式图缺失</span></div>'}
      <div class="min-w-0 flex-1 text-xs">
        <div class="font-semibold">${escapeHtml(order.taskOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(order.productionOrderNo)}</div>
        <div class="mt-1">${escapeHtml(order.operationName)} · ${escapeHtml(order.targetObject)} · ${order.planQty} ${escapeHtml(order.unit)}</div>
      </div>
    </div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="select-special-craft-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}" data-source-task-id="${escapeHtml(candidate.sourceTaskId)}">选择此加工单</button>
  </article>`
}

function renderSpecialCraftExecutionScanFeedback(): string {
  const message = state.specialCraftScanMessage
    ? `<div class="rounded border px-3 py-2 text-xs ${state.specialCraftScanTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}">${escapeHtml(state.specialCraftScanMessage)}</div>`
    : ''
  const candidates = state.specialCraftScanCandidates.length > 0
    ? `<div class="space-y-2">${state.specialCraftScanCandidates.map(renderSpecialCraftScanCandidate).join('')}</div>`
    : ''
  return `<div class="mt-3 space-y-2" data-pda-exec-special-craft-scan-feedback>${message}${candidates}</div>`
}

function renderSpecialCraftExecutionScanHeader(): string {
  return `<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-exec-special-craft-scan>
    <div class="flex items-start gap-2">
      <i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
      <div><div class="text-sm font-semibold text-blue-950">扫码进入加工填报</div><div class="mt-1 text-xs text-blue-800">优先扫描生产单码或加工单码；一个生产单有多张加工单时再选择。</div></div>
    </div>
    <div class="mt-3 flex gap-2">
      <input
        class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="扫描生产单 / 加工单"
        data-pda-exec-field="searchKeyword"
        data-pda-scan-enter="true"
        data-skip-page-rerender="true"
        value="${escapeHtml(state.searchKeyword)}"
      />
      <button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-exec-action="scan-special-craft-order">识别加工单</button>
    </div>
    <div class="mt-2 text-[11px] text-blue-700">“执行”只处理加工填报和完成加工单。</div>
    ${renderSpecialCraftExecutionScanFeedback()}
  </section>`
}

function runSpecialCraftExecutionScan(rawCode: string): void {
  state.specialCraftLastResolvedCode = rawCode.trim()
  const result = resolveSpecialCraftPdaScan(rawCode, getCurrentFactoryId(), 'EXECUTION')
  state.specialCraftScanMessage = result.message
  state.specialCraftScanTone = result.status === 'MATCH' || result.status === 'MULTIPLE' ? 'info' : 'error'
  state.specialCraftScanCandidates = result.candidates
  if (result.status === 'MATCH') {
    appStore.navigate(buildSpecialCraftWorkOrderPath(result.candidates[0]))
  }
}

function updateSpecialCraftExecutionScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-exec-special-craft-scan-feedback]')
  if (target) target.outerHTML = renderSpecialCraftExecutionScanFeedback()
}

function renderBindingScanCandidate(candidate: BindingProcessPdaScanCandidate): string {
  const { order } = candidate
  return `<article class="rounded-lg border bg-background p-3" data-pda-binding-scan-candidate>
    <div class="text-xs"><div class="font-semibold">${escapeHtml(order.bindingOrderNo)}</div><div class="mt-1 text-muted-foreground">生产单：${escapeHtml(order.sourceProductionOrderNo)}</div><div class="mt-1">${escapeHtml(order.materialIdentity.materialSku)} · ${order.bindingSpecificationCount} 个规格 · ${order.plannedOutputQty} 米</div><div class="mt-1 text-muted-foreground">来源任务：${escapeHtml(order.sourceTaskNo)}</div></div>
    <button type="button" class="mt-3 h-10 w-full rounded bg-primary text-sm font-medium text-primary-foreground" data-pda-exec-action="select-binding-order" data-source-type="${candidate.sourceType}" data-work-order-id="${escapeHtml(candidate.workOrderId)}">选择此捆条加工单</button>
  </article>`
}

function renderBindingExecutionScanFeedback(): string {
  const message = state.bindingScanMessage
    ? `<div class="rounded border px-3 py-2 text-xs ${state.bindingScanTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}">${escapeHtml(state.bindingScanMessage)}</div>`
    : ''
  const candidates = state.bindingScanCandidates.length
    ? `<div class="space-y-2">${state.bindingScanCandidates.map(renderBindingScanCandidate).join('')}</div>`
    : ''
  return `<div class="mt-3 space-y-2" data-pda-exec-binding-scan-feedback>${message}${candidates}</div>`
}

function renderBindingExecutionScanHeader(): string {
  return `<section class="rounded-xl border border-blue-200 bg-blue-50/70 p-3" data-pda-exec-binding-scan>
    <div class="flex items-start gap-2"><i data-lucide="scan-line" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i><div><div class="text-sm font-semibold text-blue-950">扫码进入捆条加工</div><div class="mt-1 text-xs text-blue-800">优先扫描捆条加工单或规格菲票；对应多张加工单时必须选择。</div></div></div>
    <div class="mt-3 flex gap-2"><input class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="扫描捆条加工单 / 菲票" data-pda-exec-field="bindingSearchKeyword" data-pda-scan-enter="true" data-skip-page-rerender="true" value="${escapeHtml(state.bindingScanKeyword)}"><button type="button" class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-pda-exec-action="scan-binding-order">识别加工单</button></div>
    <div class="mt-2 text-[11px] text-blue-700">按规格填写本次米数。</div>
    ${renderBindingExecutionScanFeedback()}
  </section>`
}

function runBindingExecutionScan(rawCode: string): void {
  state.bindingLastResolvedCode = rawCode.trim()
  const result = resolveBindingProcessPdaScan(rawCode, getCurrentFactoryId(), 'EXECUTION')
  state.bindingScanMessage = result.message
  state.bindingScanTone = result.status === 'MATCH' || result.status === 'MULTIPLE' ? 'info' : 'error'
  state.bindingScanCandidates = result.candidates
  if (result.status === 'MATCH') appStore.navigate(buildBindingWorkOrderPath(result.candidates[0]))
}

function updateBindingExecutionScanFeedbackInPlace(): void {
  const target = document.querySelector<HTMLElement>('[data-pda-exec-binding-scan-feedback]')
  if (target) target.outerHTML = renderBindingExecutionScanFeedback()
}

export function renderPdaExecPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) {
    return renderPdaLoginRedirect()
  }

  syncTabWithQuery()

  const selectedFactoryId = getCurrentFactoryId()
  const acceptedTasks = getAcceptedTasks(selectedFactoryId)
  if (isKolGotoFactory(selectedFactoryId)) {
    return renderKolGotoExecListPage(acceptedTasks)
  }

  queueMicrotask(() => {
    syncPdaStartRiskAndExceptions()
    syncMilestoneOverdueExceptions()
  })
  const hasWoolOrders = hasWoolOrdersForFactory(selectedFactoryId)
  const hasSpecialCraftOrders = hasSpecialCraftOrdersForFactory(selectedFactoryId)
  const hasBindingOrders = hasBindingProcessOrdersForFactory(selectedFactoryId)

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
      <header class="sticky top-0 z-30 space-y-3 border-b bg-background p-4">
        ${hasBindingOrders ? renderBindingExecutionScanHeader() : ''}
        ${hasSpecialCraftOrders ? renderSpecialCraftExecutionScanHeader() : ''}
        ${hasWoolOrders ? renderWoolExecutionScanHeader() : ''}
        ${!hasWoolOrders && !hasSpecialCraftOrders && !hasBindingOrders ? `<div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="搜索任务号 / 加工单号 / 生产单号 / 物料"
            data-pda-exec-field="searchKeyword"
            data-skip-page-rerender="true"
            value="${escapeHtml(state.searchKeyword)}"
          />
        </div>` : ''}
      </header>

      ${acceptedTasks.length ? `<div class="z-20 grid grid-cols-4 border-b bg-background" data-testid="pda-exec-tabs">
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
      </div>` : ''}

      <div class="flex-1 space-y-3 p-4" data-testid="pda-exec-card-list">
        ${selectedFactoryId === 'ID-F002' ? `<section class="rounded-xl border border-blue-200 bg-blue-50 p-3" data-pda-post-finishing-entry><div class="text-sm font-semibold text-blue-950">后道现场执行</div><div class="mt-1 text-xs text-blue-800">精确扫描后道任务或复检单；质检仅在 Web 进行。</div><div class="mt-3 grid grid-cols-2 gap-2"><button type="button" class="h-10 rounded-xl bg-blue-600 text-xs font-semibold text-white" data-nav="/fcs/pda/post-finishing/execute">后道加工</button><button type="button" class="h-10 rounded-xl border border-blue-300 bg-white text-xs font-semibold text-blue-800" data-nav="/fcs/pda/post-finishing/recheck">后道复检</button></div></section>` : ''}
        ${renderBindingWorkOrderSection(selectedFactoryId)}
        ${renderSpecialCraftWorkOrderSection(selectedFactoryId)}
        ${acceptedTasks.length ? `<section class="space-y-3" data-pda-general-task-list><h2 class="text-sm font-semibold">其他执行任务</h2>${renderPdaExecCardList(filteredTasks, emptyStateText)}</section>` : ''}
      </div>
    </div>
  `

  return renderPdaFrame(content, 'exec', { disableTodoAutoOpen: true })
}

export function handlePdaExecEvent(target: HTMLElement, event?: Event): boolean {
  if (!ensurePdaSessionForAction()) return true

  const fieldNode = target.closest<HTMLElement>('[data-pda-exec-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pdaExecField
    if (!field) return true

    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      state.page = 1
      if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
        const factoryId = getCurrentFactoryId()
        if (hasWoolOrdersForFactory(factoryId)) runWoolExecutionScan(fieldNode.value)
        else if (hasSpecialCraftOrdersForFactory(factoryId)) runSpecialCraftExecutionScan(fieldNode.value)
        else updatePdaExecCardListInPlace()
        return true
      }
      if (fieldNode.value.trim() !== state.woolLastResolvedCode) {
        state.woolScanMessage = ''
        state.woolScanCandidates = []
      }
      if (fieldNode.value.trim() !== state.specialCraftLastResolvedCode) {
        state.specialCraftScanMessage = ''
        state.specialCraftScanCandidates = []
      }
      updatePdaExecCardListInPlace()
      updateWoolExecutionScanFeedbackInPlace()
      updateSpecialCraftExecutionScanFeedbackInPlace()
      return true
    }
    if (field === 'bindingSearchKeyword') {
      state.bindingScanKeyword = fieldNode.value
      if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
        runBindingExecutionScan(fieldNode.value)
        return true
      }
      if (fieldNode.value.trim() !== state.bindingLastResolvedCode) {
        state.bindingScanMessage = ''
        state.bindingScanCandidates = []
      }
      updateBindingExecutionScanFeedbackInPlace()
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-exec-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecAction
  if (!action) return false

  if (action === 'scan-wool-order') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-exec-wool-scan] [data-pda-exec-field="searchKeyword"]')
    state.searchKeyword = input?.value || state.searchKeyword
    runWoolExecutionScan(state.searchKeyword)
    return true
  }

  if (action === 'scan-special-craft-order') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-exec-special-craft-scan] [data-pda-exec-field="searchKeyword"]')
    state.searchKeyword = input?.value || state.searchKeyword
    runSpecialCraftExecutionScan(state.searchKeyword)
    return true
  }

  if (action === 'scan-binding-order') {
    const input = document.querySelector<HTMLInputElement>('[data-pda-exec-binding-scan] [data-pda-exec-field="bindingSearchKeyword"]')
    state.bindingScanKeyword = input?.value || state.bindingScanKeyword
    runBindingExecutionScan(state.bindingScanKeyword)
    return true
  }

  if (action === 'select-binding-order' || action === 'open-binding-work-order') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) {
      const candidate = getBindingProcessPdaCandidateByWorkOrderId(workOrderId)
      if (candidate) appStore.navigate(buildBindingWorkOrderPath(candidate))
    }
    return true
  }

  if (action === 'select-special-craft-order') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) {
      const candidate = getSpecialCraftPdaCandidateByWorkOrderId(workOrderId)
      if (candidate) appStore.navigate(buildSpecialCraftWorkOrderPath(candidate))
    }
    return true
  }

  if (action === 'open-special-craft-work-order') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) {
      const candidate = getSpecialCraftPdaCandidateByWorkOrderId(workOrderId)
      if (candidate) appStore.navigate(buildSpecialCraftWorkOrderPath(candidate))
    }
    return true
  }

  if (action === 'switch-special-craft-tab') {
    const tab = actionNode.dataset.tab as TaskStatusTab | undefined
    if (tab && SPECIAL_CRAFT_TAB_CONFIG.some((item) => item.key === tab)) {
      state.specialCraftTab = tab
      state.page = 1
      updatePdaExecCardListInPlace()
    }
    return true
  }

  if (action === 'switch-binding-tab') {
    const tab = actionNode.dataset.tab as TaskStatusTab | undefined
    if (tab && SPECIAL_CRAFT_TAB_CONFIG.some((item) => item.key === tab)) {
      state.bindingTab = tab
      state.page = 1
      updatePdaExecCardListInPlace()
    }
    return true
  }

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TaskStatusTab | undefined
    if (tab && TAB_CONFIG.some((item) => item.key === tab)) {
      state.activeTab = tab
      state.page = 1
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

  if (action === 'page') {
    state.page = Math.max(1, Number(actionNode.dataset.page || 1))
    updatePdaExecCardListInPlace()
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
    if (getPrintWorkOrderByTaskId(taskId) || getDyeWorkOrderByTaskId(taskId) || getMobileTaskProcessType(task) === 'WOOL') {
      showPdaExecToast('请进入任务详情按当前节点操作')
      return true
    }
    if (isKolGotoWholeOrderTask(task)) {
      showPdaExecToast('请进入任务详情，通过“完成”按钮结束整单任务')
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
