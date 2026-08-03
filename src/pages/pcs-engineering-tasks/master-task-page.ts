// 工程专业任务标准页工厂：任务骨架字段统一读取工程主单任务事实。

import type { EngineeringTaskRecord, EngineeringTaskType } from '../../data/pcs-engineering-master-types.ts'
import { getEngineeringMasterOrderById } from '../../data/pcs-engineering-master-repository.ts'
import { getEngineeringTaskDefinition } from '../../data/pcs-engineering-dependency-policy.ts'
import { escapeHtml, formatDateTime } from '../../utils.ts'
import type { ListState, EngineeringListRow, ModuleKey } from './shared.ts'
import {
  createEngineeringListColumns,
  renderEmptyDetail,
  renderEngineeringStandardListPage,
  renderHeaderMeta,
  renderListFilters,
  renderMetricButton,
  renderStatusBadge,
  registerEngineeringListModule,
} from './shared.ts'
import {
  ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
  getEngineeringTaskDetail,
  getEngineeringTaskSourceOptions,
  getEngineeringTaskTeamOptions,
  listEngineeringTasksByType,
  renderTaskDependencyCard,
  renderTaskLogsCard,
  renderTaskMasterCard,
  renderTaskMaterialLinesCard,
  renderTaskReworkRoundsCard,
  renderTaskSummaryCard,
} from './master-task-common.ts'

export interface MasterTaskPageConfig {
  module: ModuleKey
  title: string
  path: string
  taskTypes: readonly EngineeringTaskType[]
  listState: ListState
}

export function createMasterTaskPage(config: MasterTaskPageConfig): {
  renderList: () => string
  renderDetail: (taskId: string) => string
} {
  const columns = createEngineeringListColumns([
    { key: 'task', title: config.title, width: 230, required: true, freezeable: true, sortable: true },
    { key: 'master', title: '工程主单', width: 150, required: true, freezeable: true, sortable: true },
    { key: 'style', title: '款式', width: 180, required: true, sortable: true },
    { key: 'status', title: '状态', width: 120, required: true, sortable: true },
    { key: 'team', title: '负责团队', width: 120, sortable: true },
    { key: 'dependency', title: '前置任务', width: 110, sortable: true },
    { key: 'submitted', title: '提交时间', width: 170, sortable: true },
    { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true },
  ])

  const allTasks = (): EngineeringTaskRecord[] => listEngineeringTasksByType(config.taskTypes)
  const filtered = (): EngineeringTaskRecord[] => {
    const keyword = config.listState.search.trim().toLowerCase()
    return allTasks().filter((task) => {
      const master = getEngineeringMasterOrderById(task.masterOrderId)
      const definition = getEngineeringTaskDefinition(task.taskType)
      const text = [task.taskId, definition.taskName, master?.masterOrderCode, master?.styleCode, master?.styleName, task.ownerTeamName]
        .filter(Boolean).join(' ').toLowerCase()
      if (keyword && !text.includes(keyword)) return false
      if (config.listState.status !== 'all' && task.status !== config.listState.status) return false
      if (config.listState.owner !== 'all' && task.ownerTeamName !== config.listState.owner) return false
      if (config.listState.source !== 'all' && definition.taskName !== config.listState.source) return false
      if (config.listState.quickFilter !== 'all' && task.status !== config.listState.quickFilter) return false
      return true
    })
  }

  const rows = (): EngineeringListRow[] => filtered().map((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const definition = getEngineeringTaskDefinition(task.taskType)
    return {
      cells: {
        task: `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="${config.path}/${escapeHtml(task.taskId)}">${escapeHtml(definition.taskName)}</button><p class="text-xs text-slate-500">${escapeHtml(task.taskId)}</p>`,
        master: master ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/engineering/masters/${escapeHtml(master.masterOrderId)}">${escapeHtml(master.masterOrderCode)}</button>` : '-',
        style: escapeHtml(master ? `${master.styleCode} · ${master.styleName}` : '-'),
        status: renderStatusBadge(task.status),
        team: escapeHtml(task.ownerTeamName || '-'),
        dependency: escapeHtml(`${task.dependsOnTaskIds.length} 项`),
        submitted: escapeHtml(task.submittedAt ? formatDateTime(task.submittedAt) : '-'),
        actions: `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700" data-nav="${config.path}/${escapeHtml(task.taskId)}">查看</button>`,
      },
      sortValues: {
        task: definition.taskName,
        master: master?.masterOrderCode || '', style: master?.styleCode || '', status: task.status,
        team: task.ownerTeamName, dependency: task.dependsOnTaskIds.length, submitted: task.submittedAt,
      },
    }
  })

  const stats = (): string => {
    const tasks = allTasks()
    return `<section class="flex flex-wrap gap-3">
      ${renderMetricButton('全部任务', tasks.length, config.listState.quickFilter === 'all', 'all', `set-${config.module}-quick-filter`)}
      ${renderMetricButton('待开始', tasks.filter((task) => task.status === '待开始').length, config.listState.quickFilter === '待开始', '待开始', `set-${config.module}-quick-filter`)}
      ${renderMetricButton('进行中', tasks.filter((task) => task.status === '进行中').length, config.listState.quickFilter === '进行中', '进行中', `set-${config.module}-quick-filter`)}
      ${renderMetricButton('待审核', tasks.filter((task) => task.status === '待审核').length, config.listState.quickFilter === '待审核', '待审核', `set-${config.module}-quick-filter`)}
      ${renderMetricButton('已完成', tasks.filter((task) => task.status === '已完成').length, config.listState.quickFilter === '已完成', '已完成', `set-${config.module}-quick-filter`)}
    </section>`
  }

  const renderList = (): string => renderEngineeringStandardListPage({
    module: config.module,
    title: config.title,
    createLabel: '查看工程主单', createAction: 'nav:/pcs/engineering/masters',
    filtersHtml: renderListFilters({
      searchPlaceholder: '搜索任务编号 / 主单编号 / 款式 / 负责团队', listState: config.listState,
      searchField: `${config.module}-search`, statusField: `${config.module}-status`, ownerField: `${config.module}-owner`, sourceField: `${config.module}-source`,
      statusOptions: ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
      ownerOptions: getEngineeringTaskTeamOptions(allTasks()), sourceOptions: getEngineeringTaskSourceOptions(allTasks()),
    }),
    statsHtml: stats(), rows: rows(), columns, listState: config.listState,
    emptyText: `暂无${config.title}数据`,
  })

  const renderDetail = (taskId: string): string => {
    const detail = getEngineeringTaskDetail(taskId)
    if (!detail || !config.taskTypes.includes(detail.task.taskType)) return renderEmptyDetail(config.title, config.path)
    const { task, master } = detail
    return `<div class="space-y-5 p-4">
      ${renderHeaderMeta(`${task.taskName} · ${task.taskId}`, `${master.masterOrderCode} · ${master.styleCode} · ${master.styleName}`, renderStatusBadge(task.status), `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700" data-nav="${config.path}">返回列表</button>`)}
      ${renderTaskSummaryCard(task, master)}${renderTaskMasterCard(master)}${renderTaskMaterialLinesCard(task)}
      ${renderTaskReworkRoundsCard(task)}${renderTaskDependencyCard(task)}${renderTaskLogsCard(task, master, config.module)}
    </div>`
  }

  registerEngineeringListModule(config.module, { getColumns: () => columns, getRows: rows, getState: () => config.listState, getEmptyText: () => `暂无${config.title}数据`, getStatsHtml: stats })
  return { renderList, renderDetail }
}
