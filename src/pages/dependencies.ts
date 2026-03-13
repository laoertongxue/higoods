import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import { initialAllocationByTaskId } from '../data/fcs/store-domain-quality-seeds'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

interface DependenciesState {
  dialogOpen: boolean
  editingTaskId: string | null
  selectedDeps: string[]
  dialogSearch: string
}

const state: DependenciesState = {
  dialogOpen: false,
  editingTaskId: null,
  selectedDeps: [],
  dialogSearch: '',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getTaskDeps(task: ProcessTask): string[] {
  return (
    (task as ProcessTask & { dependencyTaskIds?: string[]; predecessorTaskIds?: string[] })
      .dependsOnTaskIds ??
    (task as ProcessTask & { dependencyTaskIds?: string[]; predecessorTaskIds?: string[] })
      .dependencyTaskIds ??
    (task as ProcessTask & { dependencyTaskIds?: string[]; predecessorTaskIds?: string[] })
      .predecessorTaskIds ??
    []
  )
}

function shortId(taskId: string): string {
  return taskId.split('-').slice(-1)[0] || taskId
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return processTasks.find((task) => task.taskId === taskId)
}

function syncAllocationGates(by: string): void {
  const now = nowTimestamp()

  for (const task of processTasks) {
    const depIds = getTaskDeps(task)
    if (!depIds.length) continue

    const gateOk = depIds.every((depId) => (initialAllocationByTaskId[depId]?.availableQty ?? 0) > 0)

    if (!gateOk) {
      if (task.status === 'DONE' || task.status === 'CANCELLED') continue
      if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') continue
      if (task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE') continue

      const depNames = depIds.map((id) => getTaskById(id)?.processNameZh ?? id)
      const noteZh = `等待上游放行：${depNames.join('、')}（可用量=0）`

      task.status = 'BLOCKED'
      task.blockReason = 'ALLOCATION_GATE'
      task.blockRemark = noteZh
      task.blockNoteZh = noteZh
      task.blockedAt = now
      task.updatedAt = now
      task.auditLogs = [
        ...task.auditLogs,
        {
          id: `AL-GATE-BLOCK-${Date.now()}-${task.taskId}`,
          action: 'BLOCK_BY_ALLOCATION_GATE',
          detail: noteZh,
          at: now,
          by,
        },
      ]
      continue
    }

    if (task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE') {
      task.status = 'NOT_STARTED'
      task.blockReason = undefined
      task.blockRemark = undefined
      task.blockNoteZh = undefined
      task.blockedAt = undefined
      task.updatedAt = now
      task.auditLogs = [
        ...task.auditLogs,
        {
          id: `AL-GATE-UNBLOCK-${Date.now()}-${task.taskId}`,
          action: 'UNBLOCK_BY_ALLOCATION_GATE',
          detail: '上游已放行，门禁解除',
          at: now,
          by,
        },
      ]
    }
  }
}

function updateTaskDependencies(
  taskId: string,
  dependsOnTaskIds: string[],
  by: string,
): { ok: boolean; message?: string } {
  const task = getTaskById(taskId)
  if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }

  const oldDeps = getTaskDeps(task)
  const candidateIds = new Set(processTasks.map((item) => item.taskId))

  const cleaned = [...new Set(dependsOnTaskIds)]
    .filter((id) => id !== taskId)
    .filter((id) => candidateIds.has(id))

  const now = nowTimestamp()
  const detail = `dependsOnTaskIds：[${oldDeps.join(', ')}] → [${cleaned.join(', ')}]（操作人：${by}）`

  task.dependsOnTaskIds = cleaned
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-DEP-${Date.now()}-${taskId}`,
      action: 'UPDATE_DEPENDENCIES',
      detail,
      at: now,
      by,
    },
  ]

  syncAllocationGates('系统')

  return { ok: true }
}

function openEditDialog(taskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return

  state.editingTaskId = taskId
  state.selectedDeps = [...getTaskDeps(task)]
  state.dialogSearch = ''
  state.dialogOpen = true
}

function closeDialog(): void {
  state.dialogOpen = false
  state.editingTaskId = null
  state.selectedDeps = []
  state.dialogSearch = ''
}

function renderEditDialog(editingTask: ProcessTask | null): string {
  if (!state.dialogOpen || !editingTask) return ''

  const query = state.dialogSearch.trim().toLowerCase()
  const candidates = processTasks
    .filter((task) => task.taskId !== editingTask.taskId)
    .filter((task) => {
      if (!query) return true
      return (
        task.processNameZh.toLowerCase().includes(query) ||
        task.taskId.toLowerCase().includes(query)
      )
    })

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dep-action="close-dialog" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dep-action="close-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">编辑上游依赖</h3>

        <p class="-mt-0.5 mt-2 text-sm text-muted-foreground">
          当前任务：
          <span class="font-medium text-foreground">${escapeHtml(editingTask.processNameZh)}</span>
          <span class="ml-1 text-xs">（编号尾段：${escapeHtml(shortId(editingTask.taskId))}）</span>
        </p>

        <div class="mt-4">
          <input
            data-dep-field="dialog-search"
            value="${escapeHtml(state.dialogSearch)}"
            placeholder="搜索任务名称或编号"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div class="mt-3 max-h-60 overflow-y-auto rounded-md border">
          ${
            candidates.length === 0
              ? '<p class="py-4 text-center text-sm text-muted-foreground">无可选任务</p>'
              : candidates
                  .map((task) => {
                    const checked = state.selectedDeps.includes(task.taskId)
                    return `
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                        data-dep-action="toggle-candidate"
                        data-candidate-id="${escapeHtml(task.taskId)}"
                      >
                        <input type="checkbox" class="h-4 w-4 rounded border" ${checked ? 'checked' : ''} tabindex="-1" aria-hidden="true" />
                        <span class="flex-1">${escapeHtml(task.processNameZh)}</span>
                        <span class="shrink-0 text-xs text-muted-foreground">…${escapeHtml(shortId(task.taskId))}</span>
                      </button>
                    `
                  })
                  .join('')
          }
        </div>

        ${
          state.selectedDeps.length > 0
            ? `<p class="mt-2 text-xs text-muted-foreground">已选 ${state.selectedDeps.length} 项上游依赖</p>`
            : ''
        }

        <div class="mt-5 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dep-action="close-dialog">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-dep-action="save-dialog">保存</button>
        </div>
      </div>
    </div>
  `
}

export function renderDependenciesPage(): string {
  const editingTask = state.editingTaskId ? getTaskById(state.editingTaskId) ?? null : null

  return `
    <div class="space-y-4">
      <header>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="settings-2" class="h-5 w-5"></i>
          依赖关系配置
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">配置任务的上游依赖，用于 Allocation 门禁自动阻塞/放行</p>
      </header>

      <section class="rounded-lg border bg-card">
        <header class="px-6 pb-3 pt-6">
          <h2 class="text-base font-semibold">任务列表</h2>
          <p class="mt-1 text-sm text-muted-foreground">共 ${processTasks.length} 个任务</p>
        </header>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-4 py-2 font-medium">任务</th>
                <th class="px-4 py-2 font-medium">上游依赖（多选）</th>
                <th class="px-4 py-2 font-medium">当前门禁状态</th>
                <th class="w-[180px] px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${processTasks
                .map((task) => {
                  const deps = getTaskDeps(task)
                  const isGated = task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE'
                  const depNames = deps.map((id) => getTaskById(id)?.processNameZh ?? `…${shortId(id)}`)

                  return `
                    <tr class="border-b last:border-b-0">
                      <td class="px-4 py-3">
                        <div class="text-sm font-medium">${escapeHtml(task.processNameZh)}</div>
                        <div class="mt-0.5 text-xs text-muted-foreground">…${escapeHtml(shortId(task.taskId))}</div>
                      </td>

                      <td class="px-4 py-3">
                        ${
                          deps.length === 0
                            ? '<span class="text-sm text-muted-foreground">—</span>'
                            : `<div class="flex flex-wrap gap-1">${depNames
                                .map(
                                  (name) =>
                                    `<span class="inline-flex rounded-md border bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">${escapeHtml(name)}</span>`,
                                )
                                .join('')}</div>`
                        }
                      </td>

                      <td class="px-4 py-3">
                        ${
                          isGated
                            ? `
                              <div class="space-y-1">
                                <span class="inline-flex rounded-md border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs text-orange-800">门禁阻塞</span>
                                ${
                                  task.blockNoteZh
                                    ? `<p class="text-xs leading-snug text-muted-foreground">${escapeHtml(task.blockNoteZh)}</p>`
                                    : ''
                                }
                              </div>
                            `
                            : '<span class="text-sm text-muted-foreground">未阻塞</span>'
                        }
                      </td>

                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <button
                            class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                            data-dep-action="open-edit"
                            data-task-id="${escapeHtml(task.taskId)}"
                          >
                            编辑依赖
                          </button>

                          ${
                            deps.length > 0
                              ? `
                                <button
                                  class="inline-flex h-8 items-center rounded-md px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-600"
                                  data-dep-action="clear-deps"
                                  data-task-id="${escapeHtml(task.taskId)}"
                                >
                                  清空依赖
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
        </div>
      </section>

      ${renderEditDialog(editingTask)}
    </div>
  `
}

export function handleDependenciesEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-dep-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.depField
    if (field === 'dialog-search') {
      state.dialogSearch = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-dep-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.depAction
  if (!action) return false

  if (action === 'open-edit') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    openEditDialog(taskId)
    return true
  }

  if (action === 'clear-deps') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    updateTaskDependencies(taskId, [], '管理员')
    return true
  }

  if (action === 'toggle-candidate') {
    const candidateId = actionNode.dataset.candidateId
    if (!candidateId) return true

    state.selectedDeps = state.selectedDeps.includes(candidateId)
      ? state.selectedDeps.filter((id) => id !== candidateId)
      : [...state.selectedDeps, candidateId]

    return true
  }

  if (action === 'save-dialog') {
    if (state.editingTaskId) {
      updateTaskDependencies(state.editingTaskId, state.selectedDeps, '管理员')
    }
    closeDialog()
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  return false
}

export function isDependenciesDialogOpen(): boolean {
  return state.dialogOpen
}
