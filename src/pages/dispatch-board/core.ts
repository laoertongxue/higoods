import {
  state,
  getVisibleRows,
  getDyePendingTaskIds,
  getQcPendingOrderIds,
  getExceptionTaskIds,
  deriveKanbanCol,
  isAffectedByTaskSet,
  getDispatchDialogTasks,
  getCreateTenderTask,
  getViewTenderTask,
  getPriceSnapshotTask,
  getFactoryOptions,
  escapeHtml,
} from './context'
import { renderDirectDispatchDialog } from './dispatch-domain'
import {
  renderCreateTenderSheet,
  renderViewTenderSheet,
  renderPriceSnapshotSheet,
} from './tender-domain'
import { renderKanbanView, renderListView } from './board-domain'
function renderDispatchBoardInner(): string {
  const allRows = getVisibleRows()
  const dyePendingTaskIds = getDyePendingTaskIds()
  const qcPendingOrderIds = getQcPendingOrderIds()
  const exceptionTaskIds = getExceptionTaskIds()

  const stats = {
    unassigned: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'UNASSIGNED').length,
    directAssigned: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'DIRECT_ASSIGNED').length,
    bidding: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'BIDDING').length,
    awaitAward: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'AWAIT_AWARD').length,
    awarded: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'AWARDED').length,
    hold: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'HOLD').length,
    exception: allRows.filter((task) => deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) === 'EXCEPTION').length,
  }

  const createTenderTask = getCreateTenderTask()
  const viewTenderTask = getViewTenderTask()
  const priceSnapshotTask = getPriceSnapshotTask()
  const dispatchDialogTasks = getDispatchDialogTasks()
  const factoryOptions = getFactoryOptions()

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-2xl font-bold">任务分配</h1>
        <p class="mt-0.5 text-sm text-muted-foreground">对任务进行直接派单、竞价或暂不分配处理，支持看板视图与列表视图，分别承接运营推进与批量处理。</p>
      </header>

      <section class="grid grid-cols-4 gap-2 md:grid-cols-7">
        ${[
          { key: 'UNASSIGNED', label: '未分配', value: stats.unassigned, color: 'text-gray-700' },
          { key: 'DIRECT_ASSIGNED', label: '已直接派单', value: stats.directAssigned, color: 'text-blue-600' },
          { key: 'BIDDING', label: '招标中', value: stats.bidding, color: 'text-orange-600' },
          { key: 'AWAIT_AWARD', label: '待定标', value: stats.awaitAward, color: 'text-purple-600' },
          { key: 'AWARDED', label: '已定标', value: stats.awarded, color: 'text-green-600' },
          { key: 'HOLD', label: '暂不分配', value: stats.hold, color: 'text-slate-600' },
          { key: 'EXCEPTION', label: '异常', value: stats.exception, color: 'text-red-600' },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border bg-card" data-dispatch-stat-card="${item.key}">
                <div class="p-3 text-center">
                  <p class="text-2xl font-bold ${item.color}">${item.value}</p>
                  <p class="mt-0.5 text-xs leading-tight text-muted-foreground">${item.label}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="flex items-center gap-3">
        <div class="relative w-full max-w-xs">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" data-dispatch-field="filter.keyword" placeholder="关键词（任务ID / 执行范围 / 生产单号）" value="${escapeHtml(state.keyword)}" />
        </div>
        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-dispatch-action="clear-keyword"><i data-lucide="refresh-cw" class="h-4 w-4"></i></button>
        <p class="ml-auto text-sm text-muted-foreground">共 ${allRows.length} 条任务</p>
      </section>

      <section class="rounded-lg border bg-muted/40 px-4 py-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">自动分配</p>
            <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              根据当前任务约束与规则，系统会推荐每个待分配任务走以下路径之一：
              <span class="font-medium">直接派单</span>（最终需确认工厂、时间、价格）、
              <span class="font-medium">竞价</span>（按"一任务一招标单"进入招标流程）、
              <span class="font-medium">暂不分配</span>（存在上一步生产暂停或异常）。
              仅对尚未明确设置分配路径的任务生效。
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            ${
              state.autoAssignDone
                ? '<span class="flex items-center gap-1 text-xs text-green-600"><i data-lucide="check-circle-2" class="h-3.5 w-3.5"></i>已执行自动分配</span>'
                : ''
            }
            <button class="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-dispatch-action="run-auto-assign">执行自动分配</button>
          </div>
        </div>
      </section>

      <section class="space-y-2">
        <div class="inline-flex items-center rounded-md bg-muted p-1 text-sm">
          <button class="rounded-md px-3 py-1.5 text-sm ${
            state.view === 'kanban'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }" data-dispatch-action="switch-view" data-view="kanban"><i data-lucide="layout-grid" class="mr-1 inline h-4 w-4"></i>看板视图</button>
          <button class="rounded-md px-3 py-1.5 text-sm ${
            state.view === 'list'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }" data-dispatch-action="switch-view" data-view="list"><i data-lucide="list" class="mr-1 inline h-4 w-4"></i>列表视图</button>
        </div>

        ${
          state.view === 'kanban'
            ? renderKanbanView(allRows, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds)
            : renderListView(allRows, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds)
        }
      </section>

      ${renderDirectDispatchDialog(dispatchDialogTasks, factoryOptions)}
      ${renderCreateTenderSheet(createTenderTask)}
      ${renderViewTenderSheet(viewTenderTask)}
      ${renderPriceSnapshotSheet(priceSnapshotTask)}
    </div>
  `
}

export function renderDispatchBoardPage(): string {
  return renderDispatchBoardInner()
}
