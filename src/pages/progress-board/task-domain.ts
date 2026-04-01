import {
  state,
  TASK_RISK_LABEL,
  TASK_STATUS_LABEL,
  ASSIGNMENT_STATUS_LABEL,
  STATUS_COLOR_CLASS,
  ASSIGNMENT_STATUS_COLOR_CLASS,
  BLOCK_REASON_LABEL,
  stageLabels,
  getHandoverLedgerRows,
  getTaskHandoverSummary,
  getOrderById,
  getFactoryById,
  getTaskRisks,
  getTaskDisplayName,
  getOrderSpuCode,
  getOrderSpuName,
  getTaskTenderId,
  getTenderById,
  getTaskById,
  getTaskKpiStats,
  getTaskKanbanGroups,
  BLOCK_REASON_OPTIONS,
  renderBadge,
  escapeAttr,
  escapeHtml,
  type TaskRiskFlag,
  type ProcessTask,
  type ProcessStage,
} from './context'
import { resolveTaskStandardTimeSnapshot } from '../../data/fcs/process-tasks'

function formatStandardTimeMinutes(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return `${Number(value).toLocaleString()} 分钟`
}

function formatStandardTimePerUnit(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return Number(value).toLocaleString()
}

function renderTaskRiskBadges(risks: TaskRiskFlag[]): string {
  if (!risks.length) return '<span class="text-xs text-muted-foreground">—</span>'

  const tags = risks.slice(0, 2).map((risk) => renderBadge(TASK_RISK_LABEL[risk], 'border-red-200 bg-red-100 text-red-700'))
  if (risks.length > 2) {
    tags.push(renderBadge(`+${risks.length - 2}`, 'border-border bg-background text-foreground'))
  }

  return `<div class="flex flex-wrap gap-1">${tags.join('')}</div>`
}

function renderTaskActionMenu(task: ProcessTask): string {
  const isOpen = state.taskActionMenuId === task.taskId
  const po = task.productionOrderId

  return `
    <div class="relative inline-flex" data-progress-task-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="toggle-task-menu" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-30 w-48 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-update-progress" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                <i data-lucide="search" class="mr-2 h-4 w-4"></i>更新进度
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-view-exception" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>异常定位与处理
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-handover" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>交接链路
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="package" class="mr-2 h-4 w-4"></i>领料进度
              </button>
              <div class="my-1 h-px bg-border"></div>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生产单生命周期
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-dispatch" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderTaskListView(filteredTasks: ProcessTask[]): string {
  const handoverRows = getHandoverLedgerRows()
  const allSelected = filteredTasks.length > 0 && filteredTasks.every((task) => state.selectedTaskIds.includes(task.taskId))

  return `
    <section class="rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1650px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="w-10 px-3 py-2 font-medium">
                <input type="checkbox" class="h-4 w-4 rounded border" data-progress-action="select-all" ${allSelected ? 'checked' : ''} />
              </th>
              <th class="px-3 py-2 font-medium">任务ID</th>
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">SPU</th>
              <th class="px-3 py-2 font-medium">工序</th>
              <th class="px-3 py-2 font-medium">阶段</th>
              <th class="px-3 py-2 font-medium">数量</th>
              <th class="px-3 py-2 font-medium">分配方式</th>
              <th class="px-3 py-2 font-medium">分配状态</th>
              <th class="px-3 py-2 font-medium">执行工厂</th>
              <th class="px-3 py-2 font-medium">执行状态</th>
              <th class="px-3 py-2 font-medium">风险</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredTasks.length === 0
                ? `
                  <tr>
                    <td colspan="13" class="px-3 py-10 text-center text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : filteredTasks
                    .map((task) => {
                      const order = getOrderById(task.productionOrderId)
                      const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                      const risks = getTaskRisks(task)
                      const handoverSummary = getTaskHandoverSummary(task.taskId, handoverRows)

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-progress-action="open-task-detail" data-task-id="${escapeAttr(task.taskId)}">
                          <td class="px-3 py-2" data-progress-stop="true">
                            <input
                              type="checkbox"
                              class="h-4 w-4 rounded border"
                              data-progress-action="toggle-task-select"
                              data-task-id="${escapeAttr(task.taskId)}"
                              ${state.selectedTaskIds.includes(task.taskId) ? 'checked' : ''}
                            />
                          </td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              <span class="font-mono text-xs">${escapeHtml(task.taskId)}</span>
                              <button class="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted" data-progress-action="copy-task-id" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                                <i data-lucide="copy" class="h-3 w-3"></i>
                              </button>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <button class="inline-flex items-center text-xs text-primary hover:underline" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}" data-progress-stop="true">
                              ${escapeHtml(task.productionOrderId)}
                              <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
                            </button>
                          </td>
                          <td class="px-3 py-2">
                            <div class="text-xs">
                              <div class="font-medium">${escapeHtml(getOrderSpuCode(order, '-'))}</div>
                              <div class="max-w-[140px] truncate text-muted-foreground">${escapeHtml(getOrderSpuName(order) || '-')}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="text-xs">
                              <div>${escapeHtml(getTaskDisplayName(task))}</div>
                              <div class="text-muted-foreground">${escapeHtml(task.processCode)}</div>
                              <div class="text-blue-600">交接：${escapeHtml(handoverSummary.processStatusLabel)}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2">${renderBadge(stageLabels[task.stage as ProcessStage], 'border-border bg-background text-foreground')}</td>
                          <td class="px-3 py-2 text-xs">${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : escapeHtml(task.qtyUnit)}</td>
                          <td class="px-3 py-2">
                            ${
                              task.assignmentMode === 'DIRECT'
                                ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                                : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                            }
                          </td>
                          <td class="px-3 py-2">${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(factory?.name ?? (task.assignmentStatus === 'BIDDING' ? '待定标' : '-'))}</td>
                          <td class="px-3 py-2">${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}</td>
                          <td class="px-3 py-2">${renderTaskRiskBadges(risks)}</td>
                          <td class="px-3 py-2 text-right" data-progress-stop="true">${renderTaskActionMenu(task)}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderTaskKanbanView(filteredTasks: ProcessTask[]): string {
  const groups = getTaskKanbanGroups(filteredTasks)
  const columns: Array<{ status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; icon: string; color: string }> = [
    { status: 'NOT_STARTED', icon: 'clock', color: 'text-slate-500' },
    { status: 'IN_PROGRESS', icon: 'play-circle', color: 'text-blue-500' },
    { status: 'BLOCKED', icon: 'pause', color: 'text-red-500' },
    { status: 'DONE', icon: 'check-circle-2', color: 'text-green-500' },
  ]

  return `
    <div class="grid grid-cols-4 gap-4">
      ${columns
        .map(({ status, icon, color }) => {
          const items = groups[status]
          return `
            <section class="space-y-3">
              <div class="flex items-center justify-between px-2">
                <h3 class="flex items-center gap-2 font-medium">
                  <i data-lucide="${icon}" class="h-4 w-4 ${color}"></i>
                  ${TASK_STATUS_LABEL[status]}
                </h3>
                ${renderBadge(String(items.length), 'border-border bg-background text-foreground')}
              </div>
              <div class="h-[calc(100vh-410px)] overflow-y-auto pr-1">
                <div class="space-y-2">
                  ${
                    items.length === 0
                      ? '<div class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无任务</div>'
                      : items
                          .map((task) => {
                            const order = getOrderById(task.productionOrderId)
                            const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                            const risks = getTaskRisks(task)

                            return `
                              <article class="cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition hover:shadow-md" data-progress-action="open-task-detail" data-task-id="${escapeAttr(task.taskId)}">
                                <div class="flex items-center justify-between">
                                  <span class="font-mono text-xs text-muted-foreground">${escapeHtml(task.taskId)}</span>
                                  ${
                                    task.assignmentMode === 'DIRECT'
                                      ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                                      : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                                  }
                                </div>
                                <div class="mt-2 truncate text-sm font-medium">${escapeHtml(getOrderSpuName(order) || getOrderSpuCode(order, task.productionOrderId))}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getTaskDisplayName(task))}</div>
                                <div class="mt-2 flex items-center justify-between text-xs">
                                  <span class="truncate text-muted-foreground">${escapeHtml(factory?.name ?? (task.assignmentStatus === 'BIDDING' ? '待定标' : '-'))}</span>
                                  ${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}
                                </div>
                                ${
                                  risks.length > 0
                                    ? `<div class="mt-2">${renderTaskRiskBadges(risks)}</div>`
                                    : ''
                                }
                                <button class="mt-2 inline-flex h-6 w-full items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}" data-progress-stop="true">
                                  <i data-lucide="layers" class="mr-1 h-3 w-3"></i>查看生产单生命周期
                                </button>
                              </article>
                            `
                          })
                          .join('')
                  }
                </div>
              </div>
            </section>
          `
        })
        .join('')}
    </div>
  `
}

function renderTaskDimension(filteredTasks: ProcessTask[]): string {
  const kpi = getTaskKpiStats()

  return `
    <section class="space-y-4">
      <div class="grid grid-cols-6 gap-4">
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="notStarted">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">待开始</span>
            <i data-lucide="clock" class="h-4 w-4 text-slate-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold">${kpi.notStarted}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="inProgress">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">进行中</span>
            <i data-lucide="play-circle" class="h-4 w-4 text-blue-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-blue-600">${kpi.inProgress}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="blocked">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">生产暂停</span>
            <i data-lucide="pause" class="h-4 w-4 text-red-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-red-600">${kpi.blocked}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="done">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">已完成</span>
            <i data-lucide="check-circle-2" class="h-4 w-4 text-green-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-green-600">${kpi.done}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="unassigned">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">待分配</span>
            <i data-lucide="alert-circle" class="h-4 w-4 text-orange-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-orange-600">${kpi.unassigned}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="tenderOverdue">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">竞价逾期</span>
            <i data-lucide="alert-triangle" class="h-4 w-4 text-red-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-red-600">${kpi.tenderOverdue}</div>
        </button>
      </div>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid grid-cols-8 gap-3">
          <div class="col-span-2">
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="任务ID / 生产单号 / SPU / 工厂"
              value="${escapeAttr(state.keyword)}"
              data-progress-field="keyword"
            />
          </div>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="statusFilter">
            <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
            <option value="NOT_STARTED" ${state.statusFilter === 'NOT_STARTED' ? 'selected' : ''}>待开始</option>
            <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>进行中</option>
            <option value="BLOCKED" ${state.statusFilter === 'BLOCKED' ? 'selected' : ''}>生产暂停</option>
            <option value="DONE" ${state.statusFilter === 'DONE' ? 'selected' : ''}>已完成</option>
            <option value="CANCELLED" ${state.statusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="assignmentStatusFilter">
            <option value="ALL" ${state.assignmentStatusFilter === 'ALL' ? 'selected' : ''}>全部分配状态</option>
            <option value="UNASSIGNED" ${state.assignmentStatusFilter === 'UNASSIGNED' ? 'selected' : ''}>待分配</option>
            <option value="ASSIGNING" ${state.assignmentStatusFilter === 'ASSIGNING' ? 'selected' : ''}>分配中</option>
            <option value="ASSIGNED" ${state.assignmentStatusFilter === 'ASSIGNED' ? 'selected' : ''}>已派单</option>
            <option value="BIDDING" ${state.assignmentStatusFilter === 'BIDDING' ? 'selected' : ''}>竞价中</option>
            <option value="AWARDED" ${state.assignmentStatusFilter === 'AWARDED' ? 'selected' : ''}>已中标</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="assignmentModeFilter">
            <option value="ALL" ${state.assignmentModeFilter === 'ALL' ? 'selected' : ''}>全部分配方式</option>
            <option value="DIRECT" ${state.assignmentModeFilter === 'DIRECT' ? 'selected' : ''}>派单</option>
            <option value="BIDDING" ${state.assignmentModeFilter === 'BIDDING' ? 'selected' : ''}>竞价</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="stageFilter">
            <option value="ALL" ${state.stageFilter === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${Object.entries(stageLabels)
              .map(([key, label]) => `<option value="${key}" ${state.stageFilter === key ? 'selected' : ''}>${escapeHtml(label)}</option>`)
              .join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="riskFilter">
            <option value="ALL" ${state.riskFilter === 'ALL' ? 'selected' : ''}>全部风险</option>
            <option value="blockedOnly" ${state.riskFilter === 'blockedOnly' ? 'selected' : ''}>仅生产暂停</option>
            <option value="tenderOverdueOnly" ${state.riskFilter === 'tenderOverdueOnly' ? 'selected' : ''}>仅竞价逾期</option>
            <option value="rejectedOnly" ${state.riskFilter === 'rejectedOnly' ? 'selected' : ''}>仅派单拒绝</option>
            <option value="taskOverdueOnly" ${state.riskFilter === 'taskOverdueOnly' ? 'selected' : ''}>仅任务逾期</option>
          </select>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="reset-task-filters">重置</button>
        </div>
      </section>

      ${state.viewMode === 'list' ? renderTaskListView(filteredTasks) : renderTaskKanbanView(filteredTasks)}
    </section>
  `
}

function renderTaskDrawer(): string {
  if (!state.detailTaskId) return ''

  const task = getTaskById(state.detailTaskId)
  if (!task) return ''

  const order = getOrderById(task.productionOrderId)
  const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
  const taskTenderId = getTaskTenderId(task)
  const tender = taskTenderId ? getTenderById(taskTenderId) : undefined
  const taskRisks = getTaskRisks(task)
  const taskHandoverSummary = getTaskHandoverSummary(task.taskId)
  const standardTime = resolveTaskStandardTimeSnapshot(task)
  const activeTab = task.status === 'BLOCKED' ? state.taskDetailTab : state.taskDetailTab === 'block' ? 'basic' : state.taskDetailTab

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-task-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[600px] overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="flex items-center gap-2 text-lg font-semibold">
                任务详情
                ${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}
              </h3>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskId)} · ${escapeHtml(getTaskDisplayName(task))}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="close-task-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
          <div class="mt-4 grid grid-cols-5 gap-1 rounded-md border p-1 text-sm">
            <button class="rounded px-2 py-1 ${activeTab === 'basic' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="basic">基本信息</button>
            <button class="rounded px-2 py-1 ${activeTab === 'assignment' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="assignment">分配信息</button>
            <button class="rounded px-2 py-1 ${activeTab === 'progress' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="progress">进度操作</button>
            ${
              task.status === 'BLOCKED'
                ? `<button class="rounded px-2 py-1 ${activeTab === 'block' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="block">生产暂停信息</button>`
                : '<span class="rounded px-2 py-1 text-center text-muted-foreground">—</span>'
            }
            <button class="rounded px-2 py-1 ${activeTab === 'logs' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="logs">审计日志</button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          ${
            activeTab === 'basic'
              ? `
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">任务ID</p>
                    <p class="font-mono">${escapeHtml(task.taskId)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">生产单号</p>
                    <button class="inline-flex items-center text-primary hover:underline" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}">
                      ${escapeHtml(task.productionOrderId)}
                      <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
                    </button>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">工序</p>
                    <p>${escapeHtml(getTaskDisplayName(task))} (${escapeHtml(task.processCode)})</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">阶段</p>
                    <p>${escapeHtml(stageLabels[task.stage as ProcessStage])}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">数量</p>
                    <p>${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : escapeHtml(task.qtyUnit)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">分配方式</p>
                    <p>${task.assignmentMode === 'DIRECT' ? '派单' : '竞价'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">单位标准工时</p>
                    <p>${escapeHtml(formatStandardTimePerUnit(standardTime.standardTimePerUnit))}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">工时单位</p>
                    <p>${escapeHtml(standardTime.standardTimeUnit || '--')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">任务总标准工时</p>
                    <p>${escapeHtml(formatStandardTimeMinutes(standardTime.totalStandardTime))}</p>
                  </div>
                  ${
                    task.difficulty
                      ? `<div><p class="text-xs text-muted-foreground">难度</p><p>${task.difficulty === 'EASY' ? '简单' : task.difficulty === 'MEDIUM' ? '中等' : '困难'}</p></div>`
                      : ''
                  }
                </div>
                <div class="rounded-md border bg-blue-50 p-3 text-sm">
                  <p class="text-xs text-blue-700">交接情况</p>
                  <p class="mt-1 text-blue-700">当前状态：${escapeHtml(taskHandoverSummary.processStatusLabel)}</p>
                  <p class="mt-1 text-blue-700">下一步：${escapeHtml(taskHandoverSummary.nextActionHint)}</p>
                  <button class="mt-2 inline-flex h-8 items-center rounded-md border border-blue-200 bg-white px-3 text-sm text-blue-700 hover:bg-blue-100" data-progress-action="task-action-handover" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="scan-line" class="mr-1.5 h-4 w-4"></i>查看交接链路
                  </button>
                </div>
                ${
                  task.qcPoints.length > 0
                    ? `
                      <div>
                        <p class="text-xs text-muted-foreground">质检点</p>
                        <div class="mt-1 flex flex-wrap gap-1">${task.qcPoints
                          .map((item) => renderBadge(item, 'border-border bg-background text-foreground'))
                          .join('')}</div>
                      </div>
                    `
                    : ''
                }
                ${
                  task.attachments.length > 0
                    ? `
                      <div>
                        <p class="text-xs text-muted-foreground">附件</p>
                        <div class="mt-1 space-y-1 text-sm">
                          ${task.attachments
                            .map((item) => `<div class="text-blue-600 hover:underline">${escapeHtml(item.name)}</div>`)
                            .join('')}
                        </div>
                      </div>
                    `
                    : ''
                }
                <div class="border-t pt-3">
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生产单生命周期
                  </button>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'assignment'
              ? `
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">分配方式</p>
                    <p class="mt-1">${
                      task.assignmentMode === 'DIRECT'
                        ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                        : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                    }</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">分配状态</p>
                    <p class="mt-1">${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}</p>
                  </div>
                </div>

                ${
                  task.assignedFactoryId
                    ? `
                      <div class="text-sm">
                        <p class="text-xs text-muted-foreground">执行工厂</p>
                        <p>${escapeHtml(factory?.name ?? task.assignedFactoryId)}</p>
                      </div>
                    `
                    : ''
                }

                ${
                  taskTenderId
                    ? `
                      <div class="space-y-2 text-sm">
                        <div>
                          <p class="text-xs text-muted-foreground">竞价ID</p>
                          <p class="font-mono">${escapeHtml(taskTenderId)}</p>
                        </div>
                        ${
                          tender
                            ? `
                              <div>
                                <p class="text-xs text-muted-foreground">竞价截止时间</p>
                                <div class="flex items-center gap-2">
                                  <span>${escapeHtml(tender.deadline)}</span>
                                  ${
                                    tender.status === 'OVERDUE' || parseDateTime(tender.deadline) < Date.now()
                                      ? renderBadge('已逾期', 'border-red-200 bg-red-100 text-red-700')
                                      : ''
                                  }
                                </div>
                              </div>
                            `
                            : ''
                        }
                      </div>
                    `
                    : ''
                }

                <div class="flex flex-wrap gap-2 border-t pt-3">
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-dispatch" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
                  </button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="package" class="mr-2 h-4 w-4"></i>领料进度
                  </button>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'progress'
              ? `
                <div class="text-sm">
                  <p class="text-xs text-muted-foreground">当前状态</p>
                  <div class="mt-1">${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}</div>
                </div>
                ${
                  taskRisks.length > 0
                    ? `<div><p class="text-xs text-muted-foreground">风险标签</p><div class="mt-1">${renderTaskRiskBadges(taskRisks)}</div></div>`
                    : ''
                }
                <div class="flex flex-wrap gap-2 border-t pt-3">
                  ${
                    task.status === 'NOT_STARTED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-start" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>标记开始</button>`
                      : ''
                  }
                  ${
                    task.status === 'IN_PROGRESS'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-finish" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="check-circle-2" class="mr-1.5 h-4 w-4"></i>标记完工</button>`
                      : ''
                  }
                  ${
                    task.status === 'NOT_STARTED' || task.status === 'IN_PROGRESS'
                      ? `<button class="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100" data-progress-action="task-status-block" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="pause" class="mr-1.5 h-4 w-4"></i>标记生产暂停</button>`
                      : ''
                  }
                  ${
                    task.status === 'BLOCKED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-unblock" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>恢复执行</button>`
                      : ''
                  }
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-cancel" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>取消任务</button>
                </div>

                ${
                  task.assignedFactoryId && !['DONE', 'CANCELLED'].includes(task.status)
                    ? `
                      <div class="border-t pt-3">
                        <p class="text-xs text-muted-foreground">催办与通知</p>
                        <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-send-urge" data-task-id="${escapeAttr(task.taskId)}">
                          <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>催办工厂
                        </button>
                      </div>
                    `
                    : ''
                }
              `
              : ''
          }

          ${
            activeTab === 'block' && task.status === 'BLOCKED'
              ? `
                <div class="space-y-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">当前无法继续的原因</p>
                    <div class="mt-1">${renderBadge(BLOCK_REASON_LABEL[task.blockReason ?? 'OTHER'], 'border-red-200 bg-red-100 text-red-700')}</div>
                  </div>
                  ${
                    task.blockRemark
                      ? `
                        <div>
                          <p class="text-xs text-muted-foreground">生产暂停备注</p>
                          <div class="mt-1 rounded-md bg-muted p-2">${escapeHtml(task.blockRemark)}</div>
                        </div>
                      `
                      : ''
                  }
                  ${
                    task.blockedAt
                      ? `
                        <div>
                          <p class="text-xs text-muted-foreground">生产暂停开始时间</p>
                          <div class="mt-1">${escapeHtml(task.blockedAt)}</div>
                        </div>
                      `
                      : ''
                  }
                  <div class="border-t pt-3">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-view-exception" data-task-id="${escapeAttr(task.taskId)}">
                      <i data-lucide="file-warning" class="mr-1.5 h-4 w-4"></i>查看异常定位与处理
                    </button>
                  </div>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'logs'
              ? `
                <div class="overflow-hidden rounded-md border">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b bg-muted/40 text-left">
                        <th class="px-3 py-2 font-medium">动作</th>
                        <th class="px-3 py-2 font-medium">详情</th>
                        <th class="px-3 py-2 font-medium">时间</th>
                        <th class="px-3 py-2 font-medium">操作人</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        task.auditLogs.length === 0
                          ? '<tr><td colspan="4" class="px-3 py-6 text-center text-muted-foreground">暂无数据</td></tr>'
                          : task.auditLogs
                              .map(
                                (log) => `
                                  <tr class="border-b">
                                    <td class="px-3 py-2">${renderBadge(log.action, 'border-border bg-background text-foreground')}</td>
                                    <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                                    <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                                    <td class="px-3 py-2 text-xs">${escapeHtml(log.by)}</td>
                                  </tr>
                                `,
                              )
                              .join('')
                      }
                    </tbody>
                  </table>
                </div>
              `
              : ''
          }
        </div>
      </section>
    </div>
  `
}


function renderBlockDialog(): string {
  if (!state.blockDialogTaskId) return ''

  const task = getTaskById(state.blockDialogTaskId)
  if (!task) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-block-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">标记生产暂停</h3>
          <p class="text-sm text-muted-foreground">任务 ${escapeHtml(task.taskId)} - ${escapeHtml(getTaskDisplayName(task))}</p>
        </header>

        <div class="mt-4 space-y-4">
          <div>
            <label class="text-sm">当前无法继续的原因 *</label>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-progress-field="blockReason">
              ${BLOCK_REASON_OPTIONS.map((item) => `<option value="${item.value}" ${state.blockReason === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm">备注</label>
            <textarea class="mt-1 min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入备注..." data-progress-field="blockRemark">${escapeHtml(state.blockRemark)}</textarea>
          </div>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-progress-action="close-block-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-4 text-sm text-red-700 hover:bg-red-100" data-progress-action="confirm-block">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderBatchConfirmDialog(): string {
  if (!state.confirmDialogType) return ''

  const title = state.confirmDialogType === 'start' ? '批量标记开始' : '批量标记完工'
  const desc =
    state.confirmDialogType === 'start'
      ? '确认将选中的任务批量标记为进行中？'
      : '确认将选中的任务批量标记为已完成？'

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-batch-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">${title}</h3>
          <p class="text-sm text-muted-foreground">${desc}</p>
        </header>
        <p class="mt-4 text-sm">将更新 <strong>${state.confirmTaskIds.length}</strong> 个任务</p>
        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-progress-action="close-batch-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-progress-action="confirm-batch">确认</button>
        </footer>
      </section>
    </div>
  `
}

export { renderTaskDimension, renderTaskDrawer, renderBlockDialog, renderBatchConfirmDialog }
