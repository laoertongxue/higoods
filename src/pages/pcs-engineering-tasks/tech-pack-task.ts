// @page-pattern: list
// 标准列表契约由 renderEngineeringStandardListPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 技术包确认任务模块：读取工程主单任务记录，列表 / 详情渲染与列表分派注册。
// 页面只读展示任务记录，任务状态推进在工程主单详情完成。

import type { EngineeringTaskRecord } from '../../data/pcs-engineering-master-types.ts'
import { getEngineeringMasterOrderById } from '../../data/pcs-engineering-master-repository.ts'
import { getEngineeringTaskDefinition } from '../../data/pcs-engineering-dependency-policy.ts'
import { escapeHtml, formatDateTime } from '../../utils.ts'
import {
  type EngineeringListRow,
  createEngineeringListColumns,
  renderEmptyDetail,
  renderEngineeringStandardListPage,
  renderHeaderMeta,
  renderListFilters,
  renderMetricButton,
  renderStatusBadge,
  registerEngineeringListModule,
  state,
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

const TECH_PACK_TASK_TYPES = ['TECH_PACK_CONFIRMATION'] as const
const TECH_PACK_LIST_PATH = '/pcs/engineering/tech-pack'

function getTechPackTasksFiltered(): EngineeringTaskRecord[] {
  const tasks = listEngineeringTasksByType(TECH_PACK_TASK_TYPES)
  const keyword = state.techPackList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const definition = getEngineeringTaskDefinition(task.taskType)
    if (keyword) {
      const haystack = [
        task.taskId,
        task.taskName,
        definition.taskName,
        master?.masterOrderCode || '',
        master?.styleCode || '',
        master?.styleName || '',
        task.ownerTeamName,
      ].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.techPackList.status !== 'all' && task.status !== state.techPackList.status) return false
    if (state.techPackList.owner !== 'all' && task.ownerTeamName !== state.techPackList.owner) return false
    if (state.techPackList.source !== 'all' && definition.taskName !== state.techPackList.source) return false
    if (state.techPackList.quickFilter === 'in-progress' && task.status !== '进行中') return false
    if (state.techPackList.quickFilter === 'pending-review' && task.status !== '待审核') return false
    if (state.techPackList.quickFilter === 'rework' && task.status !== '返工中') return false
    if (state.techPackList.quickFilter === 'completed' && task.status !== '已完成') return false
    return true
  })
}

const TECH_PACK_LIST_COLUMNS = createEngineeringListColumns([
  { key: 'task', title: '技术包确认任务', width: 210, required: true, freezeable: true, sortable: true },
  { key: 'master', title: '工程主单', width: 160, required: true, freezeable: true, sortable: true },
  { key: 'status', title: '状态', width: 130, required: true, freezeable: true, sortable: true },
  { key: 'team', title: '负责团队', width: 120, sortable: true },
  { key: 'rework', title: '返工', width: 100, sortable: true },
  { key: 'started', title: '开始时间', width: 170, sortable: true },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true },
])

function getTechPackListRows(): EngineeringListRow[] {
  return getTechPackTasksFiltered().map((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const definition = getEngineeringTaskDefinition(task.taskType)
    return {
      cells: {
        task: `<div class="space-y-1">
          <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="${TECH_PACK_LIST_PATH}/${escapeHtml(task.taskId)}">${escapeHtml(definition.taskName)}</button>
          <p class="text-xs text-slate-500">${escapeHtml(task.taskId)}</p>
        </div>`,
        master: master
          ? `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/engineering/masters/${escapeHtml(master.masterOrderId)}">${escapeHtml(master.masterOrderCode)}</button>`
          : escapeHtml(task.masterOrderId),
        status: renderStatusBadge(task.status),
        team: escapeHtml(task.ownerTeamName || '-'),
        rework: task.reworkRounds.length > 0
          ? `<span class="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">${task.reworkRounds.length} 轮</span>`
          : '<span class="text-slate-400">无</span>',
        started: escapeHtml(task.startedAt ? formatDateTime(task.startedAt) : '-'),
        actions: `<div class="flex flex-wrap gap-2">
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="${TECH_PACK_LIST_PATH}/${escapeHtml(task.taskId)}">查看</button>
        </div>`,
      },
      sortValues: {
        task: definition.taskName,
        master: master?.masterOrderCode || '',
        status: task.status,
        team: task.ownerTeamName || '',
        rework: task.reworkRounds.length,
        started: task.startedAt,
      },
    }
  })
}

function renderTechPackListStats(): string {
  const tasks = listEngineeringTasksByType(TECH_PACK_TASK_TYPES)
  return `<section class="flex flex-wrap gap-3">
    ${renderMetricButton('全部任务', tasks.length, state.techPackList.quickFilter === 'all', 'all', 'set-tech-pack-quick-filter')}
    ${renderMetricButton('进行中', tasks.filter((item) => item.status === '进行中').length, state.techPackList.quickFilter === 'in-progress', 'in-progress', 'set-tech-pack-quick-filter')}
    ${renderMetricButton('待审核', tasks.filter((item) => item.status === '待审核').length, state.techPackList.quickFilter === 'pending-review', 'pending-review', 'set-tech-pack-quick-filter')}
    ${renderMetricButton('返工中', tasks.filter((item) => item.status === '返工中').length, state.techPackList.quickFilter === 'rework', 'rework', 'set-tech-pack-quick-filter')}
    ${renderMetricButton('已完成', tasks.filter((item) => item.status === '已完成').length, state.techPackList.quickFilter === 'completed', 'completed', 'set-tech-pack-quick-filter')}
  </section>`
}

function renderTechPackListPage(): string {
  const tasks = listEngineeringTasksByType(TECH_PACK_TASK_TYPES)
  return renderEngineeringStandardListPage({
    module: 'techPack',
    title: '技术包确认任务',
    createLabel: '查看工程主单',
    createAction: 'nav:/pcs/engineering/masters',
    filtersHtml: renderListFilters({
      searchPlaceholder: '搜索任务编号 / 任务名称 / 主单编号 / 款式编码 / 负责团队',
      listState: state.techPackList,
      searchField: 'tech-pack-search',
      statusField: 'tech-pack-status',
      ownerField: 'tech-pack-owner',
      sourceField: 'tech-pack-source',
      statusOptions: ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
      ownerOptions: getEngineeringTaskTeamOptions(tasks),
      sourceOptions: getEngineeringTaskSourceOptions(tasks),
    }),
    statsHtml: renderTechPackListStats(),
    rows: getTechPackListRows(),
    columns: TECH_PACK_LIST_COLUMNS,
    listState: state.techPackList,
    emptyText: '暂无技术包确认任务数据',
  })
}

function renderTechPackDetailPage(taskId: string): string {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) return renderEmptyDetail('技术包确认任务', TECH_PACK_LIST_PATH)
  const { task, master } = detail
  const definition = getEngineeringTaskDefinition(task.taskType)
  const header = renderHeaderMeta(
    `${definition.taskName} · ${task.taskId}`,
    `${master.masterOrderCode} · ${master.styleCode} · ${master.styleName}`,
    renderStatusBadge(task.status),
    `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="${TECH_PACK_LIST_PATH}">返回列表</button>`,
  )
  return `
    <div class="space-y-5 p-4">
      ${header}
      ${renderTaskSummaryCard(task, master)}
      ${renderTaskMasterCard(master)}
      ${renderTaskMaterialLinesCard(task)}
      ${renderTaskReworkRoundsCard(task)}
      ${renderTaskDependencyCard(task)}
      ${renderTaskLogsCard(task, master, 'techPack')}
    </div>
  `
}

registerEngineeringListModule('techPack', {
  getColumns: () => TECH_PACK_LIST_COLUMNS,
  getRows: () => getTechPackListRows(),
  getState: () => state.techPackList,
  getEmptyText: () => '暂无技术包确认任务数据',
  getStatsHtml: () => renderTechPackListStats(),
})

export function renderPcsTechPackTaskPage(): string {
  return renderTechPackListPage()
}

export function renderPcsTechPackTaskDetailPage(taskId: string): string {
  return renderTechPackDetailPage(taskId)
}
