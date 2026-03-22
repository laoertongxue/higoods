import {
  state,
  syncPdaStartRiskAndExceptions,
  syncMilestoneOverdueExceptions,
  syncPresetFromQuery,
  getFilteredTasks,
  getPoViewRows,
  renderBadge,
  type ProcessTask,
} from './context'
import { renderTaskDimension, renderTaskDrawer, renderBlockDialog, renderBatchConfirmDialog } from './task-domain'
import { renderOrderDimension, renderOrderDrawer } from './order-domain'

function renderHeader(filteredTasks: ProcessTask[]): string {
  const selectedCount = state.selectedTaskIds.length

  return `
    <header class="flex items-center justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="kanban-square" class="h-5 w-5"></i>
          任务进度看板
        </h1>
        <p class="text-sm text-muted-foreground">按任务/生产单双维度追踪执行进度、生产暂停与风险</p>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex rounded-md border">
          <button class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.dimension === 'task' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-dimension" data-dimension="task">
            <i data-lucide="clipboard-list" class="mr-1.5 h-4 w-4"></i>任务维度
          </button>
          <button class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.dimension === 'order' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-dimension" data-dimension="order">
            <i data-lucide="layers" class="mr-1.5 h-4 w-4"></i>生产单维度
          </button>
        </div>

        ${
          state.dimension === 'task' && selectedCount > 0
            ? `
              ${renderBadge(`已选择 ${selectedCount} 项`, 'border-border bg-background text-foreground')}
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-urge">
                <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>批量催办
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-start">
                <i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>批量标记开始
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-finish">
                <i data-lucide="check-circle-2" class="mr-1.5 h-4 w-4"></i>批量标记完工
              </button>
            `
            : ''
        }

        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>

        <div class="flex rounded-md border">
          <button class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-view" data-view="list">
            <i data-lucide="list" class="mr-1.5 h-4 w-4"></i>列表视图
          </button>
          <button class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-view" data-view="kanban">
            <i data-lucide="kanban-square" class="mr-1.5 h-4 w-4"></i>看板视图
          </button>
        </div>
      </div>
    </header>
  `
}

export function renderProgressBoardPage(): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
  syncPresetFromQuery()

  const filteredTasks = getFilteredTasks()
  const poRows = getPoViewRows()

  return `
    <div class="space-y-4">
      ${renderHeader(filteredTasks)}
      ${state.dimension === 'task' ? renderTaskDimension(filteredTasks) : renderOrderDimension(poRows)}
      ${renderTaskDrawer()}
      ${renderOrderDrawer(poRows)}
      ${renderBlockDialog()}
      ${renderBatchConfirmDialog()}
    </div>
  `
}
