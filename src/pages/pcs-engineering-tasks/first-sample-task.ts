// @page-pattern: list
// 标准列表契约由 renderEngineeringStandardListPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 产前版样衣任务：任务骨架、状态、依赖、负责人和时间只读工程主单任务事实。
// 制作团队提交图片与数量即完成，不设置任务级验收或二次确认。

import type { EngineeringTaskRecord } from '../../data/pcs-engineering-master-types.ts'
import {
  getEngineeringMasterOrderById,
  submitEngineeringTaskResult,
} from '../../data/pcs-engineering-master-repository.ts'
import { escapeHtml, formatDateTime } from '../../utils.ts'
import {
  type EngineeringListRow,
  createEngineeringListColumns,
  renderEmptyDetail,
  renderEngineeringStandardListPage,
  renderHeaderMeta,
  renderListFilters,
  renderMetricButton,
  renderSectionCard,
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
  renderTaskSummaryCard,
} from './master-task-common.ts'

const TASK_TYPES = ['PRE_PRODUCTION_SAMPLE'] as const
const LIST_PATH = '/pcs/samples/first-sample'

function filteredTasks(): EngineeringTaskRecord[] {
  const keyword = state.firstSampleList.search.trim().toLowerCase()
  return listEngineeringTasksByType(TASK_TYPES).filter((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const text = [task.taskId, task.taskName, master?.masterOrderCode, master?.styleCode, master?.styleName, task.ownerTeamName]
      .filter(Boolean).join(' ').toLowerCase()
    if (keyword && !text.includes(keyword)) return false
    if (state.firstSampleList.status !== 'all' && task.status !== state.firstSampleList.status) return false
    if (state.firstSampleList.owner !== 'all' && task.ownerTeamName !== state.firstSampleList.owner) return false
    if (state.firstSampleList.quickFilter === 'in-progress' && task.status !== '进行中') return false
    if (state.firstSampleList.quickFilter === 'completed' && task.status !== '已完成') return false
    return true
  })
}

const COLUMNS = createEngineeringListColumns([
  { key: 'task', title: '产前版样衣任务', width: 240, required: true, freezeable: true, sortable: true },
  { key: 'master', title: '工程主单', width: 150, required: true, freezeable: true, sortable: true },
  { key: 'style', title: '款式', width: 180, required: true, sortable: true },
  { key: 'status', title: '状态', width: 120, required: true, sortable: true },
  { key: 'team', title: '负责团队', width: 120, sortable: true },
  { key: 'result', title: '成果', width: 170, sortable: true },
  { key: 'submitted', title: '提交时间', width: 170, sortable: true },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true },
])

function rows(): EngineeringListRow[] {
  return filteredTasks().map((task) => {
    const master = getEngineeringMasterOrderById(task.masterOrderId)
    const resultText = task.resultImageIds.length > 0
      ? `${task.resultImageIds.length} 张 / ${task.resultQuantity} 件`
      : '未提交'
    return {
      cells: {
        task: `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="${LIST_PATH}/${escapeHtml(task.taskId)}">${escapeHtml(task.taskName)}</button><p class="text-xs text-slate-500">${escapeHtml(task.taskId)}</p>`,
        master: master ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/engineering/masters/${escapeHtml(master.masterOrderId)}">${escapeHtml(master.masterOrderCode)}</button>` : '-',
        style: escapeHtml(master ? `${master.styleCode} · ${master.styleName}` : '-'),
        status: renderStatusBadge(task.status),
        team: escapeHtml(task.ownerTeamName || '-'),
        result: escapeHtml(resultText),
        submitted: escapeHtml(task.submittedAt ? formatDateTime(task.submittedAt) : '-'),
        actions: `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700" data-nav="${LIST_PATH}/${escapeHtml(task.taskId)}">查看</button>`,
      },
      sortValues: {
        task: task.taskName,
        master: master?.masterOrderCode || '',
        style: master?.styleCode || '',
        status: task.status,
        team: task.ownerTeamName,
        result: resultText,
        submitted: task.submittedAt,
      },
    }
  })
}

function stats(): string {
  const tasks = listEngineeringTasksByType(TASK_TYPES)
  return `<section class="flex flex-wrap gap-3">
    ${renderMetricButton('全部任务', tasks.length, state.firstSampleList.quickFilter === 'all', 'all', 'set-first-sample-quick-filter')}
    ${renderMetricButton('进行中', tasks.filter((task) => task.status === '进行中').length, state.firstSampleList.quickFilter === 'in-progress', 'in-progress', 'set-first-sample-quick-filter')}
    ${renderMetricButton('已完成', tasks.filter((task) => task.status === '已完成').length, state.firstSampleList.quickFilter === 'completed', 'completed', 'set-first-sample-quick-filter')}
  </section>`
}

function renderResult(task: EngineeringTaskRecord): string {
  return renderSectionCard('样衣成果', `
    <div class="grid gap-3 md:grid-cols-4">
      <div><p class="text-xs text-slate-500">结果图片</p><p class="mt-1 text-sm text-slate-900">${task.resultImageIds.length} 张</p></div>
      <div><p class="text-xs text-slate-500">制作数量</p><p class="mt-1 text-sm text-slate-900">${task.resultQuantity} 件</p></div>
      <div><p class="text-xs text-slate-500">提交人</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(task.resultSubmittedBy || '-')}</p></div>
      <div><p class="text-xs text-slate-500">提交时间</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(task.submittedAt ? formatDateTime(task.submittedAt) : '-')}</p></div>
    </div>
  `)
}

registerEngineeringListModule('firstSample', {
  getColumns: () => COLUMNS,
  getRows: () => rows(),
  getState: () => state.firstSampleList,
  getEmptyText: () => '暂无产前版样衣任务数据',
  getStatsHtml: () => stats(),
})

export function renderPcsFirstSampleTaskPage(): string {
  const tasks = listEngineeringTasksByType(TASK_TYPES)
  return renderEngineeringStandardListPage({
    module: 'firstSample',
    title: '产前版样衣任务',
    createLabel: '查看工程主单',
    createAction: 'nav:/pcs/engineering/masters',
    filtersHtml: renderListFilters({
      searchPlaceholder: '搜索任务编号 / 主单编号 / 款式 / 负责团队',
      listState: state.firstSampleList,
      searchField: 'first-sample-search',
      statusField: 'first-sample-status',
      ownerField: 'first-sample-owner',
      sourceField: 'first-sample-source',
      statusOptions: ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
      ownerOptions: getEngineeringTaskTeamOptions(tasks),
      sourceOptions: getEngineeringTaskSourceOptions(tasks),
    }),
    statsHtml: stats(), rows: rows(), columns: COLUMNS,
    listState: state.firstSampleList,
    emptyText: '暂无产前版样衣任务数据',
  })
}

export function renderPcsFirstSampleTaskDetailPage(taskId: string): string {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) return renderEmptyDetail('产前版样衣任务', LIST_PATH)
  const { task, master } = detail
  return `<div class="space-y-5 p-4">
    ${renderHeaderMeta(`${task.taskName} · ${task.taskId}`, `${master.masterOrderCode} · ${master.styleCode} · ${master.styleName}`, renderStatusBadge(task.status), `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700" data-nav="${LIST_PATH}">返回列表</button>`)}
    ${renderTaskSummaryCard(task, master)}
    ${renderTaskMasterCard(master)}
    ${renderResult(task)}
    ${renderTaskDependencyCard(task)}
    ${renderTaskLogsCard(task, master, 'firstSample')}
  </div>`
}

export function submitEngineeringFirstSampleResult(
  taskId: string,
  input: { resultImageIds: string[]; resultQuantity: number; submittedBy: string },
): EngineeringTaskRecord {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail || detail.task.taskType !== 'PRE_PRODUCTION_SAMPLE') throw new Error('未找到产前版样衣任务。')
  if (input.resultImageIds.length === 0) throw new Error('请至少上传一张结果图片。')
  if (!Number.isFinite(input.resultQuantity) || input.resultQuantity <= 0) throw new Error('制作数量必须大于 0。')
  if (!input.submittedBy.trim()) throw new Error('请填写提交人。')
  return submitEngineeringTaskResult(detail.master.masterOrderId, taskId, input).task
}
