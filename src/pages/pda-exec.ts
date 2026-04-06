import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { type ProcessTask } from '../data/fcs/process-tasks'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  getTaskProcessDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  listPdaTaskFlowTasks,
  resolvePdaTaskExecPath,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  formatRemainingHours,
  formatStartDueSourceText,
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

type TaskStatusTab = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

interface PdaExecState {
  selectedFactoryId: string
  activeTab: TaskStatusTab
  searchKeyword: string
  riskParam: string
  rawTabParam: string
  bannerVisible: boolean
  querySignature: string
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
  rawTabParam: '',
  bannerVisible: true,
  querySignature: '',
}

function listTaskFacts(): ProcessTask[] {
  return listPdaTaskFlowTasks()
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getPdaTaskFlowTaskById(taskId) ?? null
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
    || (unitLabel === '件' && (isCuttingSpecialTask(task) || /裁片|入仓|交接/.test(displayProcessName)))

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
  const pathname = appStore.getState().pathname
  if (state.querySignature !== pathname) {
    state.querySignature = pathname
    state.bannerVisible = true
  }

  const searchParams = getCurrentSearchParams()
  const rawTab = searchParams.get('tab') || ''
  const mapped = TAB_PARAM_MAP[rawTab] || 'NOT_STARTED'
  state.activeTab = mapped
  state.rawTabParam = rawTab
  state.riskParam = searchParams.get('risk') || ''
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getCurrentFactoryId(): string {
  if (state.selectedFactoryId) return state.selectedFactoryId
  if (typeof window === 'undefined') return 'ID-F001'

  try {
    const localFactoryId = window.localStorage.getItem('fcs_pda_factory_id')
    if (localFactoryId) {
      state.selectedFactoryId = localFactoryId
      return localFactoryId
    }

    const rawSession = window.localStorage.getItem('fcs_pda_session')
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as { factoryId?: string }
      if (parsed.factoryId) {
        state.selectedFactoryId = parsed.factoryId
        return parsed.factoryId
      }
    }
  } catch {
    // ignore parse errors
  }

  state.selectedFactoryId = 'ID-F001'
  return state.selectedFactoryId
}

function getFactoryName(factoryId: string): string {
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory?.name ?? factoryId
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
  return listTaskFacts().filter(
    (task) => task.assignedFactoryId === factoryId && task.acceptanceStatus === 'ACCEPTED',
  )
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

  const keyword = state.searchKeyword.trim().toLowerCase()
  if (!keyword) return tasks

  return tasks.filter(
    (task) =>
      task.taskId.toLowerCase().includes(keyword) ||
      (task.taskNo || '').toLowerCase().includes(keyword) ||
      task.productionOrderId.toLowerCase().includes(keyword) ||
      getTaskProcessDisplayName(task).toLowerCase().includes(keyword),
  )
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

function renderNotStartedCard(task: ProcessTask): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
  const prereq = getStartPrerequisite(task)
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )
  const startInfo = getTaskStartDueInfo(task)
  const startDueAt = startInfo.startDueAt || '—'
  const dueSourceText = formatStartDueSourceText(startInfo.startDueSource)
  const startRiskNote =
    startInfo.startRiskStatus === 'DUE_SOON' && typeof startInfo.remainingMs === 'number'
      ? `距开工时限不足 ${formatRemainingHours(startInfo.remainingMs)} 小时，请尽快补齐开工信息`
      : startInfo.startRiskStatus === 'OVERDUE'
        ? '开工已逾期，请立即补录开工信息'
        : ''

  return `
    <article class="cursor-pointer rounded-lg border transition-colors hover:border-primary" data-testid="pda-exec-task-card" data-pda-exec-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">
      <div class="space-y-2.5 p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-mono text-sm font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
          ${renderSourceBadge(task.assignmentMode)}
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
            (task as ProcessTask & { taskDeadline?: string }).taskDeadline
              ? `
                  <div class="text-muted-foreground">任务截止</div>
                  <div class="font-medium ${deadline ? deadline.textClass : ''}">${escapeHtml((task as ProcessTask & { taskDeadline?: string }).taskDeadline || '')}</div>
                `
              : ''
          }
          <div class="text-muted-foreground">开工时限</div>
          <div class="font-medium ${startInfo.startRiskStatus === 'OVERDUE' ? 'text-red-700' : startInfo.startRiskStatus === 'DUE_SOON' ? 'text-amber-700' : ''}">${escapeHtml(startDueAt)}</div>
        </div>

        <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p class="font-medium">起算依据：${escapeHtml(dueSourceText)}</p>
          ${
            startInfo.startRiskStatus === 'OVERDUE'
              ? '<p class="mt-1 text-red-700">状态：开工已逾期</p>'
              : startInfo.startRiskStatus === 'DUE_SOON' && typeof startInfo.remainingMs === 'number'
                ? `<p class="mt-1 text-amber-700">状态：距开工时限不足 ${escapeHtml(formatRemainingHours(startInfo.remainingMs))} 小时</p>`
                : '<p class="mt-1 text-muted-foreground">状态：开工时限正常</p>'
          }
        </div>

        <div class="space-y-0.5 rounded-md border px-3 py-2 text-xs ${toClassName(
          prereq.met ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50',
        )}">
          <div class="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span class="text-muted-foreground">前置条件</span>
            <span class="font-medium">${escapeHtml(prereq.conditionLabel)}</span>
            <span class="text-muted-foreground">当前状态</span>
            <span class="font-medium ${prereq.met ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(prereq.statusLabel)}</span>
            <span class="text-muted-foreground">来源方</span>
            <span class="font-medium">领料记录</span>
          </div>
          <p class="mt-1 ${prereq.met ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(prereq.hint)}</p>
        </div>

        ${
          startRiskNote
            ? `<div class="rounded-md border px-3 py-1.5 text-xs ${startInfo.startRiskStatus === 'OVERDUE' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${escapeHtml(startRiskNote)}</div>`
            : ''
        }

        <div class="flex gap-2 pt-1">
          ${
            prereq.met
              ? `
                  <button
                    class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    data-pda-exec-action="go-start"
                    data-task-id="${escapeHtml(task.taskId)}"
                  >
                    <i data-lucide="play" class="mr-1 h-3 w-3"></i>
                    去开工
                  </button>
                `
              : `
                  <button
                    class="inline-flex h-7 items-center rounded-md border border-amber-300 px-3 text-xs text-amber-700 hover:bg-amber-50"
                    data-pda-exec-action="go-handover"
                    data-tab="pickup"
                  >
                    <i data-lucide="arrow-left-right" class="mr-1 h-3 w-3"></i>
                    去领料
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

function renderInProgressCard(task: ProcessTask): string {
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)
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
            ${renderSourceBadge(task.assignmentMode)}
            ${milestoneTag}
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

          <button
            class="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
            data-pda-exec-action="finish-task"
            data-task-id="${escapeHtml(task.taskId)}"
          >
            <i data-lucide="check-circle" class="mr-1 h-3 w-3"></i>
            完工
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
          ${renderSourceBadge(task.assignmentMode)}
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

        <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-red-700">${escapeHtml(pauseReason || blockReasonLabel(task.blockReason) || '已上报暂停')}</span>
            <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${pauseStatus.className}">${pauseStatus.label}</span>
          </div>
          ${task.blockRemark ? `<p class="mt-1 text-red-600">${escapeHtml(task.blockRemark)}</p>` : ''}
          ${pauseAt ? `<p class="mt-1 flex items-center gap-1 text-muted-foreground"><i data-lucide="clock" class="h-3 w-3"></i>上报时间：${escapeHtml(pauseAt)}</p>` : ''}
          <p class="mt-1 text-muted-foreground">平台允许继续前，当前任务不可继续操作</p>
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
          ${renderSourceBadge(task.assignmentMode)}
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
            去交接
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
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
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
    const status = task.status || 'NOT_STARTED'
    if (status === 'NOT_STARTED') tasksByStatus.NOT_STARTED.push(task)
    else if (status === 'IN_PROGRESS') tasksByStatus.IN_PROGRESS.push(task)
    else if (status === 'BLOCKED') tasksByStatus.BLOCKED.push(task)
    else if (status === 'DONE' || status === 'CANCELLED') tasksByStatus.DONE.push(task)
  }

  const filteredTasks = getFilteredTasks(tasksByStatus, state.activeTab)
  const fromNotify = !!state.rawTabParam
  const bannerText =
    state.rawTabParam === 'blocked' || state.rawTabParam === 'BLOCKED'
      ? '已为您定位到生产暂停任务'
      : (state.rawTabParam === 'in-progress' || state.rawTabParam === 'IN_PROGRESS') &&
            state.riskParam === 'due-soon'
          ? '已为您定位到即将逾期任务'
          : (state.rawTabParam === 'not-started' || state.rawTabParam === 'NOT_STARTED') &&
                state.riskParam === 'start-due-soon'
            ? '已为您定位到开工预期任务'
          : ''

  const content = `
    <div class="flex min-h-[760px] flex-col bg-background" data-testid="pda-exec-page">
      <header class="sticky top-0 z-30 space-y-4 border-b bg-background p-4">
        <h1 class="text-lg font-semibold">执行</h1>

        ${
          fromNotify && bannerText && state.bannerVisible
            ? `
                <div class="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <span>${escapeHtml(bannerText)}</span>
                  <button class="text-base leading-none text-blue-400 hover:text-blue-700" data-pda-exec-action="close-banner">×</button>
                </div>
              `
            : ''
        }

        <div class="flex items-center gap-2">
          <span class="shrink-0 text-sm text-muted-foreground">当前工厂:</span>
          <select class="h-9 flex-1 rounded-md border bg-background px-3 text-sm" data-pda-exec-field="factoryId">
            ${indonesiaFactories
              .map(
                (factory) =>
                  `<option value="${escapeHtml(factory.id)}" ${factory.id === selectedFactoryId ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`,
              )
              .join('')}
          </select>
        </div>

        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="搜索任务编号 / 生产单号 / 工序"
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
        ${
          filteredTasks.length === 0
            ? `<div class="py-10 text-center text-sm text-muted-foreground">${
                state.activeTab === 'IN_PROGRESS' && state.riskParam === 'due-soon'
                  ? '当前暂无即将逾期任务'
                  : state.activeTab === 'NOT_STARTED' && state.riskParam === 'start-due-soon'
                    ? '当前暂无开工预期任务'
                  : `暂无${TAB_CONFIG.find((tab) => tab.key === state.activeTab)?.label || ''}任务`
              }</div>`
            : filteredTasks
                .map((task) => {
                  if (state.activeTab === 'NOT_STARTED') return renderNotStartedCard(task)
                  if (state.activeTab === 'IN_PROGRESS') return renderInProgressCard(task)
                  if (state.activeTab === 'BLOCKED') return renderBlockedCard(task)
                  return renderDoneCard(task)
                })
                .join('')
        }
      </div>
    </div>
  `

  return renderPdaFrame(content, 'exec')
}

export function handlePdaExecEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-exec-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pdaExecField
    if (!field) return true

    if (field === 'factoryId') {
      state.selectedFactoryId = fieldNode.value
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('fcs_pda_factory_id', fieldNode.value)
        } catch {
          // ignore storage errors
        }
      }
      return true
    }

    if (field === 'searchKeyword') {
      state.searchKeyword = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-exec-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecAction
  if (!action) return false

  if (action === 'close-banner') {
    state.bannerVisible = false
    return true
  }

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TaskStatusTab | undefined
    if (tab && TAB_CONFIG.some((item) => item.key === tab)) {
      state.activeTab = tab
      const maybeRisk = state.riskParam ? `&risk=${state.riskParam}` : ''
      appStore.navigate(`/fcs/pda/exec?tab=${tab}${maybeRisk}`)
    }
    return true
  }

  if (action === 'open-detail') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      appStore.navigate(resolvePdaTaskExecPath(taskId, appStore.getState().pathname))
    }
    return true
  }

  if (action === 'open-detail-action') {
    const taskId = actionNode.dataset.taskId
    const detailAction = actionNode.dataset.action
    if (taskId && detailAction) {
      const targetPath = resolvePdaTaskExecPath(taskId, appStore.getState().pathname)
      appStore.navigate(targetPath.includes('/fcs/pda/cutting/') ? targetPath : `${targetPath}?action=${detailAction}`)
    }
    return true
  }

  if (action === 'go-start') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      const targetPath = resolvePdaTaskExecPath(taskId, appStore.getState().pathname)
      appStore.navigate(targetPath.includes('/fcs/pda/cutting/') ? targetPath : `${targetPath}?action=start`)
    }
    return true
  }

  if (action === 'go-handover') {
    const tab = actionNode.dataset.tab || 'pickup'
    appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    return true
  }

  if (action === 'finish-task') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true

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
