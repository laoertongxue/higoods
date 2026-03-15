import { type ProcessTask, type TaskStatus, processTasks } from '../data/fcs/process-tasks'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml, formatDateTime } from '../utils'

applyQualitySeedBootstrap()

type KindFilter = 'ALL' | 'REWORK' | 'REMAKE'
type StatusFilter = 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'

interface ReworkState {
  keyword: string
  kindFilter: KindFilter
  statusFilter: StatusFilter
}

const TASK_STATUS_ZH: Record<TaskStatus, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '暂不能继续',
  CANCELLED: '已取消',
}

const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  DONE: 'bg-green-100 text-green-700 border-green-200',
  BLOCKED: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
}

const KIND_ZH: Record<'REWORK' | 'REMAKE', string> = {
  REWORK: '返工',
  REMAKE: '重做',
}

const KIND_BADGE: Record<'REWORK' | 'REMAKE', string> = {
  REWORK: 'bg-orange-100 text-orange-700 border-orange-200',
  REMAKE: 'bg-purple-100 text-purple-700 border-purple-200',
}

const state: ReworkState = {
  keyword: '',
  kindFilter: 'ALL',
  statusFilter: 'ALL',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showReworkToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'rework-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'

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

function resolveKind(task: ProcessTask): 'REWORK' | 'REMAKE' {
  if (task.taskKind === 'REMAKE') return 'REMAKE'
  if (task.processCode === 'PROC_REMAKE' || task.processNameZh === '重做') return 'REMAKE'
  return 'REWORK'
}

function getReworkTasks(): ProcessTask[] {
  return processTasks.filter((task) => {
    if (task.taskKind === 'REWORK' || task.taskKind === 'REMAKE') return true
    if (
      task.sourceQcId &&
      (task.processCode === 'PROC_REWORK' ||
        task.processCode === 'PROC_REMAKE' ||
        task.processNameZh === '返工' ||
        task.processNameZh === '重做')
    ) {
      return true
    }
    return false
  })
}

function getFilteredTasks(reworkTasks: ProcessTask[]): ProcessTask[] {
  const keyword = state.keyword.trim().toLowerCase()

  return reworkTasks.filter((task) => {
    const kind = resolveKind(task)
    if (state.kindFilter !== 'ALL' && kind !== state.kindFilter) return false
    if (state.statusFilter !== 'ALL' && task.status !== state.statusFilter) return false

    if (keyword) {
      const matched =
        task.taskId.toLowerCase().includes(keyword) ||
        task.processNameZh.toLowerCase().includes(keyword) ||
        (task.sourceQcId ?? '').toLowerCase().includes(keyword) ||
        (task.productionOrderId ?? '').toLowerCase().includes(keyword) ||
        (task.sourceProductionOrderId ?? '').toLowerCase().includes(keyword)
      if (!matched) return false
    }

    return true
  })
}

function getStats(reworkTasks: ProcessTask[]): {
  pending: number
  rework: number
  remake: number
  done: number
} {
  const pending = reworkTasks.filter(
    (task) =>
      task.status === 'NOT_STARTED' ||
      task.status === 'IN_PROGRESS' ||
      task.status === 'BLOCKED',
  ).length
  const rework = reworkTasks.filter((task) => resolveKind(task) === 'REWORK').length
  const remake = reworkTasks.filter((task) => resolveKind(task) === 'REMAKE').length
  const done = reworkTasks.filter((task) => task.status === 'DONE').length

  return { pending, rework, remake, done }
}

function completeReworkTask(taskId: string, by: string): { ok: boolean; message?: string } {
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }

  const isReworkTask =
    task.taskKind === 'REWORK' ||
    task.taskKind === 'REMAKE' ||
    task.processCode === 'PROC_REWORK' ||
    task.processCode === 'PROC_REMAKE'

  if (!isReworkTask) {
    return { ok: false, message: '仅允许对返工/重做任务执行此操作' }
  }

  if (task.status === 'DONE') {
    return { ok: true }
  }

  const now = nowTimestamp()
  const kind = resolveKind(task)
  task.status = 'DONE'
  task.finishedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-RWDONE-${Date.now()}-${randomSuffix(4)}`,
      action: 'COMPLETE_REWORK_TASK',
      detail: `${kind === 'REWORK' ? '返工' : '重做'}任务标记完成`,
      at: now,
      by,
    },
  ]

  return { ok: true }
}

export function renderReworkPage(): string {
  const reworkTasks = getReworkTasks()
  const filtered = getFilteredTasks(reworkTasks)
  const stats = getStats(reworkTasks)

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">返工/重做</h1>
          <p class="mt-1 text-sm text-muted-foreground">跟踪由质检不合格自动生成的返工/重做任务进度</p>
        </div>
        <span class="text-sm text-muted-foreground">共 ${filtered.length} 条</span>
      </div>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-xs text-muted-foreground">待处理数</p>
            <p class="mt-1 text-2xl font-bold text-orange-600">${stats.pending}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-xs text-muted-foreground">返工数</p>
            <p class="mt-1 text-2xl font-bold text-orange-700">${stats.rework}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-xs text-muted-foreground">重做数</p>
            <p class="mt-1 text-2xl font-bold text-purple-700">${stats.remake}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-xs text-muted-foreground">已完成数</p>
            <p class="mt-1 text-2xl font-bold text-green-700">${stats.done}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-[200px] max-w-sm flex-1">
          <i data-lucide="search" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            data-rework-filter="keyword"
            value="${escapeHtml(state.keyword)}"
            placeholder="任务ID / 任务名称 / QC单号 / 生产单号"
          />
        </div>

        <select class="h-9 w-[110px] rounded-md border bg-background px-3 text-sm" data-rework-filter="kind">
          <option value="ALL" ${state.kindFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
          <option value="REWORK" ${state.kindFilter === 'REWORK' ? 'selected' : ''}>返工</option>
          <option value="REMAKE" ${state.kindFilter === 'REMAKE' ? 'selected' : ''}>重做</option>
        </select>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-rework-filter="status">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="NOT_STARTED" ${state.statusFilter === 'NOT_STARTED' ? 'selected' : ''}>未开始</option>
          <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>进行中</option>
          <option value="DONE" ${state.statusFilter === 'DONE' ? 'selected' : ''}>已完成</option>
          <option value="BLOCKED" ${state.statusFilter === 'BLOCKED' ? 'selected' : ''}>暂不能继续</option>
        </select>

        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted" data-rework-action="reset">
          <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
        </button>
      </section>

      ${
        filtered.length === 0
          ? `
            <section class="rounded-lg border border-dashed py-24 text-center">
              <p class="text-sm font-medium text-muted-foreground">暂无返工/重做任务</p>
              <p class="mt-1 text-xs text-muted-foreground">当质检单标记为不合格并指定处置方式后，系统将自动生成返工/重做任务</p>
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-lg border">
              <table class="w-full min-w-[1160px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">任务ID</th>
                    <th class="px-4 py-2 font-medium">类型</th>
                    <th class="px-4 py-2 font-medium">任务名称</th>
                    <th class="px-4 py-2 font-medium">原任务</th>
                    <th class="px-4 py-2 font-medium">关联QC</th>
                    <th class="px-4 py-2 font-medium">生产单</th>
                    <th class="px-4 py-2 font-medium">当前状态</th>
                    <th class="px-4 py-2 font-medium">更新时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map((task) => {
                      const kind = resolveKind(task)
                      const poId = task.sourceProductionOrderId ?? task.productionOrderId
                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(task.taskId)}</td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${KIND_BADGE[kind]}">${KIND_ZH[kind]}</span>
                          </td>
                          <td class="px-4 py-3 text-sm">${escapeHtml(task.processNameZh)}</td>
                          <td class="px-4 py-3 font-mono text-xs text-muted-foreground">${escapeHtml(task.sourceTaskId ?? task.parentTaskId ?? '—')}</td>
                          <td class="px-4 py-3 font-mono text-xs">
                            ${
                              task.sourceQcId
                                ? `<button class="text-primary hover:underline" data-nav="/fcs/quality/qc-records/${escapeHtml(task.sourceQcId)}">${escapeHtml(task.sourceQcId)}</button>`
                                : '—'
                            }
                          </td>
                          <td class="px-4 py-3 font-mono text-xs text-muted-foreground">${escapeHtml(poId ?? '—')}</td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${TASK_STATUS_BADGE[task.status]}">${TASK_STATUS_ZH[task.status]}</span>
                          </td>
                          <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(task.updatedAt))}</td>
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-1">
                              ${
                                task.sourceQcId
                                  ? `
                                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700" data-nav="/fcs/quality/qc-records/${escapeHtml(task.sourceQcId)}">
                                      查看质检
                                      <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
                                    </button>
                                  `
                                  : ''
                              }
                              ${
                                task.status !== 'DONE' && task.status !== 'CANCELLED'
                                  ? `
                                    <button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700" data-rework-action="complete" data-task-id="${escapeHtml(task.taskId)}">
                                      <i data-lucide="check-circle-2" class="mr-1 h-3 w-3"></i>
                                      标记完成
                                    </button>
                                  `
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </section>
          `
      }
    </div>
  `
}

export function handleReworkEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-rework-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.reworkFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'kind') {
      state.kindFilter = filterNode.value as KindFilter
      return true
    }
    if (field === 'status') {
      state.statusFilter = filterNode.value as StatusFilter
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-rework-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.reworkAction
  if (!action) return false

  if (action === 'reset') {
    state.keyword = ''
    state.kindFilter = 'ALL'
    state.statusFilter = 'ALL'
    return true
  }

  if (action === 'complete') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    const result = completeReworkTask(taskId, '管理员')
    if (result.ok) {
      showReworkToast('已标记为完成')
    } else {
      showReworkToast(result.message ?? '操作失败', 'error')
    }
    return true
  }

  return true
}

export function isReworkDialogOpen(): boolean {
  return false
}
