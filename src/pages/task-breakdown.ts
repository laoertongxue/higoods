// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import { classifyTaskFulfillmentPolicy } from '../data/fcs/task-fulfillment-policy.ts'
import { isAssignableProductionExecutionTask } from '../data/fcs/merged-production-task.ts'
import { escapeHtml } from '../utils.ts'

type TaskListType = 'ALL' | 'SEWING' | 'NON_SEWING' | 'MERGED' | 'WHOLE_ORDER'

interface TaskBreakdownState {
  keyword: string
  type: TaskListType
  status: 'ALL' | RuntimeProcessTask['assignmentStatus']
  page: number
  detailTaskId: string | null
}

const state: TaskBreakdownState = {
  keyword: '',
  type: 'ALL',
  status: 'ALL',
  page: 1,
  detailTaskId: null,
}

const TASK_IMAGES = ['/shirt-sample.jpg', '/dress-sample-1.jpg', '/cardigan-sample.jpg', '/tshirt-sample.jpg']

function taskImage(task: RuntimeProcessTask): string {
  const index = Math.abs([...task.productionOrderId].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % TASK_IMAGES.length
  return TASK_IMAGES[index]
}

function taskType(task: RuntimeProcessTask): Exclude<TaskListType, 'ALL'> {
  if (task.taskUnitType === 'WHOLE_ORDER_TASK') return 'WHOLE_ORDER'
  const policy = classifyTaskFulfillmentPolicy(task)
  if (policy.mergedTaskType) return 'MERGED'
  if (policy.startsWithSewing) return 'SEWING'
  return 'NON_SEWING'
}

function taskTypeLabel(task: RuntimeProcessTask): string {
  if (task.taskUnitType === 'WHOLE_ORDER_TASK') return '整单任务'
  return classifyTaskFulfillmentPolicy(task).taskTypeLabel
}

function assignmentStatusLabel(status: RuntimeProcessTask['assignmentStatus']): string {
  return ({
    UNASSIGNED: '待分配',
    DIRECT_ASSIGNED: '已直接派单',
    BIDDING: '竞价中',
    AWARDED: '已定标',
    ASSIGNED: '已分配',
    REJECTED: '已拒绝',
  } as Record<string, string>)[status] || status
}

function processNames(task: RuntimeProcessTask): string[] {
  const names = task.coveredProcesses?.length
    ? task.coveredProcesses.map((item) => item.processName).filter(Boolean)
    : [task.processNameZh]
  return Array.from(new Set(names))
}

function listRows(): RuntimeProcessTask[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listRuntimeProcessTasks()
    .filter(isAssignableProductionExecutionTask)
    .filter((task) => state.type === 'ALL' || taskType(task) === state.type)
    .filter((task) => state.status === 'ALL' || task.assignmentStatus === state.status)
    .filter((task) => !keyword || [
      task.productionOrderNo,
      task.productionOrderId,
      task.taskNo,
      task.taskId,
      task.processNameZh,
      task.assignedFactoryName,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)))
}

const columns: StandardListColumn<RuntimeProcessTask>[] = [
  {
    key: 'identity',
    title: '生产单 / 任务',
    width: 280,
    required: true,
    freezeable: true,
    render: (task) => `<div class="flex gap-3"><button data-task-list-action="preview-image" data-image="${taskImage(task)}" data-label="${escapeHtml(task.productionOrderNo || task.productionOrderId)}"><img src="${taskImage(task)}" alt="${escapeHtml(task.productionOrderNo || task.productionOrderId)}款式实拍图" class="h-14 w-12 rounded border object-cover"/></button><div><b>${escapeHtml(task.productionOrderNo || task.productionOrderId)}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</p><p class="text-xs text-muted-foreground">${escapeHtml(task.scopeLabel)} · ${task.scopeQty.toLocaleString()}件</p></div></div>`,
  },
  {
    key: 'type',
    title: '任务类型',
    width: 220,
    required: true,
    render: (task) => `<b>${escapeHtml(taskTypeLabel(task))}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(processNames(task).join(' + '))}</p>`,
  },
  {
    key: 'scope',
    title: '任务范围',
    width: 190,
    render: (task) => {
      const policy = classifyTaskFulfillmentPolicy(task)
      return `<p>${policy.assignmentGranularity === 'SKU' ? '完整SKU' : policy.assignmentGranularity === 'ORDER' ? '整张任务' : escapeHtml(policy.assignmentGranularity)}</p><p class="mt-1 text-xs text-muted-foreground">${task.scopeSkuLines.length || 1}个SKU · ${task.scopeQty.toLocaleString()}件</p>`
    },
  },
  {
    key: 'status',
    title: '状态 / 工厂',
    width: 190,
    render: (task) => `<b>${escapeHtml(assignmentStatusLabel(task.assignmentStatus))}</b><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.assignedFactoryName || '尚未确定工厂')}</p>`,
  },
  {
    key: 'lineage',
    title: '来源关系',
    width: 220,
    render: (task) => task.mergeSourceTaskIds?.length
      ? `<span class="rounded bg-violet-50 px-2 py-1 text-xs text-violet-700">由${task.mergeSourceTaskIds.length}张源任务合并</span><p class="mt-2 text-xs text-muted-foreground">源任务保留历史，不能再单独分配</p>`
      : '<span class="text-sm text-muted-foreground">独立生成</span>',
  },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    required: true,
    actionColumn: true,
    render: (task) => `<div class="flex gap-3"><button class="text-blue-600" data-task-list-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">详情</button><a class="text-blue-600" href="/fcs/dispatch/workbench?keyword=${encodeURIComponent(task.taskNo || task.taskId)}">去分配</a></div>`,
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['identity'],
  pageSize: 20,
}

function renderDetail(): string {
  const task = state.detailTaskId ? getRuntimeTaskById(state.detailTaskId) : null
  if (!task) return ''
  const policy = classifyTaskFulfillmentPolicy(task)
  const sourceTasks = (task.mergeSourceTaskIds ?? []).map((id) => getRuntimeTaskById(id)).filter((item): item is RuntimeProcessTask => Boolean(item))
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><button class="absolute inset-0 bg-slate-900/40" data-task-list-action="close-detail"></button><section class="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(taskTypeLabel(task))}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</p></div><button data-task-list-action="close-detail">关闭</button></header><div class="grid gap-4 p-5 md:grid-cols-2"><section class="rounded border p-4"><h3 class="font-semibold">任务范围</h3><dl class="mt-3 space-y-2 text-sm"><div><dt class="text-muted-foreground">生产单</dt><dd>${escapeHtml(task.productionOrderNo || task.productionOrderId)}</dd></div><div><dt class="text-muted-foreground">工序责任</dt><dd>${escapeHtml(processNames(task).join(' + '))}</dd></div><div><dt class="text-muted-foreground">分配颗粒度</dt><dd>${policy.assignmentGranularity === 'SKU' ? '完整SKU' : '整张任务'}</dd></div><div><dt class="text-muted-foreground">目标数量</dt><dd>${task.scopeQty.toLocaleString()}件</dd></div></dl></section><section class="rounded border p-4"><h3 class="font-semibold">当前状态</h3><p class="mt-3 text-sm">${escapeHtml(assignmentStatusLabel(task.assignmentStatus))}</p><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.assignedFactoryName || '尚未确定工厂')}</p></section>${sourceTasks.length ? `<section class="md:col-span-2 rounded border p-4"><h3 class="font-semibold">源任务留痕</h3><ul class="mt-3 divide-y text-sm">${sourceTasks.map((source) => `<li class="py-2">${escapeHtml(source.taskNo || source.taskId)} · ${escapeHtml(source.processNameZh)} · 已并入当前合并任务</li>`).join('')}</ul></section>` : ''}<section class="md:col-span-2 rounded border p-4"><h3 class="font-semibold">操作记录</h3><ul class="mt-3 space-y-2 text-sm">${task.auditLogs.slice().reverse().map((log) => `<li><span class="text-muted-foreground">${escapeHtml(log.at)}</span> · ${escapeHtml(log.detail)}</li>`).join('')}</ul></section></div></section></div>`
}

function renderImagePreview(): string {
  return '<div data-task-list-image-preview></div>'
}

export function renderTaskBreakdownPage(): string {
  const rows = listRows()
  const all = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const pageRows = rows.slice((state.page - 1) * pageSize, state.page * pageSize)
  const content = renderStandardListPage({
    title: '任务清单',
    description: '仅展示可执行生产任务。生产准备工序不进入任务清单，合并任务统一前往任务分配页面创建。',
    primaryActionsHtml: '<a class="rounded bg-blue-600 px-4 py-2 text-sm text-white" href="/fcs/dispatch/workbench">前往任务分配</a>',
    filtersHtml: `<div class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3"><input class="h-9 rounded border px-3 text-sm" placeholder="生产单 / 任务号 / 工序 / 工厂" data-task-list-field="keyword" value="${escapeHtml(state.keyword)}"/><select class="h-9 rounded border px-3 text-sm" data-task-list-field="type"><option value="ALL">全部任务</option><option value="SEWING" ${state.type === 'SEWING' ? 'selected' : ''}>独立车缝</option><option value="NON_SEWING" ${state.type === 'NON_SEWING' ? 'selected' : ''}>非车缝独立生产任务</option><option value="MERGED" ${state.type === 'MERGED' ? 'selected' : ''}>合并任务</option><option value="WHOLE_ORDER" ${state.type === 'WHOLE_ORDER' ? 'selected' : ''}>整单任务</option></select><select class="h-9 rounded border px-3 text-sm" data-task-list-field="status"><option value="ALL">全部分配状态</option><option value="UNASSIGNED" ${state.status === 'UNASSIGNED' ? 'selected' : ''}>待分配</option><option value="BIDDING" ${state.status === 'BIDDING' ? 'selected' : ''}>竞价中</option><option value="ASSIGNED" ${state.status === 'ASSIGNED' ? 'selected' : ''}>已分配</option><option value="AWARDED" ${state.status === 'AWARDED' ? 'selected' : ''}>已定标</option></select></div>`,
    statsHtml: renderStandardListStats([
      { label: '可执行任务', value: all.length },
      { label: '独立车缝', value: all.filter((task) => taskType(task) === 'SEWING').length },
      { label: '合并任务', value: all.filter((task) => taskType(task) === 'MERGED').length },
      { label: '待分配', value: all.filter((task) => task.assignmentStatus === 'UNASSIGNED').length },
    ]),
    listTitle: '生产任务',
    listActionsHtml: '<span class="text-xs text-muted-foreground">合并任务仅支持车缝+烫包、裁剪+车缝+烫包</span>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences, sort: null, eventPrefix: 'task-list', emptyText: '当前条件下没有可执行生产任务' }),
    paginationHtml: renderTablePagination({ total: rows.length, from: rows.length ? (state.page - 1) * pageSize + 1 : 0, to: Math.min(state.page * pageSize, rows.length), currentPage: state.page, totalPages, pageSize, actionPrefix: 'task-list', fieldPrefix: 'task-list', pageSizeOptions: [20] }),
    overlaysHtml: `${renderDetail()}${renderImagePreview()}`,
  })
  return `<div data-task-breakdown-page data-skip-page-rerender="true">${content}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-task-breakdown-page]')
  if (root) root.outerHTML = renderTaskBreakdownPage()
}

export function handleTaskBreakdownEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-task-list-field]')
  if (field) {
    const name = field.dataset.taskListField
    if (name === 'keyword') state.keyword = field.value
    if (name === 'type') state.type = field.value as TaskListType
    if (name === 'status') state.status = field.value as TaskBreakdownState['status']
    state.page = 1
    refresh()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-task-list-action], [data-task-list-pagination-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.taskListAction || actionNode.dataset.taskListPaginationAction
  if (action === 'open-detail') state.detailTaskId = actionNode.dataset.taskId || null
  if (action === 'close-detail') state.detailTaskId = null
  if (action === 'previous-page' || action === 'prev-page') state.page = Math.max(1, state.page - 1)
  if (action === 'next-page') state.page += 1
  if (action === 'preview-image') {
    const host = document.querySelector<HTMLElement>('[data-task-list-image-preview]')
    if (host) host.innerHTML = `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6" data-task-list-action="close-image"><button class="absolute right-6 top-6 rounded bg-white px-3 py-2">关闭</button><img src="${escapeHtml(actionNode.dataset.image || '')}" alt="${escapeHtml(actionNode.dataset.label || '高清预览')}" class="max-h-full max-w-full object-contain"/></div>`
    return true
  }
  if (action === 'close-image') {
    const host = document.querySelector<HTMLElement>('[data-task-list-image-preview]')
    if (host) host.innerHTML = ''
    return true
  }
  refresh()
  return true
}

export function isTaskBreakdownDialogOpen(): boolean {
  return state.detailTaskId !== null
}
