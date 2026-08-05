// @page-pattern: list
// 标准列表契约由 renderEngineeringStandardListPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 技术包确认任务模块：读取工程主单任务记录，列表 / 详情渲染与列表分派注册。
// 页面只读展示任务记录，任务状态推进在工程主单详情完成。

import type { EngineeringTaskRecord } from '../../data/pcs-engineering-master-types'
import { getEngineeringMasterOrderById } from '../../data/pcs-engineering-master-repository'
import { getEngineeringTaskDefinition } from '../../data/pcs-engineering-dependency-policy'
import {
  createEngineeringMasterTechPackDraft,
  getEngineeringTechPackTaskView,
} from '../../data/pcs-engineering-tech-pack-workspace'
import { escapeHtml, formatDateTime } from '../../utils'
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
} from './shared'
import {
  ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
  getEngineeringTaskDetail,
  getEngineeringTaskSourceOptions,
  getEngineeringTaskTeamOptions,
  listEngineeringTasksByType,
  renderTaskDependencyCard,
  renderTaskLogsCard,
  renderTaskMaterialLinesCard,
  renderTaskReworkRoundsCard,
  renderTaskWorkbenchHeader,
  startEngineeringTaskFromDetail,
} from './master-task-common'

const TECH_PACK_TASK_TYPES = ['TECH_PACK_CONFIRMATION'] as const
const TECH_PACK_LIST_PATH = '/pcs/engineering/tech-pack'
const operatorDrafts = new Map<string, string>()

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
  const view = getEngineeringTechPackTaskView(master.masterOrderId)
  const version = view.latestVersion
  const versionCard = `<section class="rounded-lg border border-slate-200 bg-white" data-tech-pack-task-workspace="${escapeHtml(task.taskId)}">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 class="font-semibold text-slate-900">当前技术包版本</h2><p class="mt-1 text-xs text-slate-500">确认任务由技术包显式发布自动完成，不能人工标记完成。</p></div>${version ? `<button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-nav="/pcs/products/styles/${escapeHtml(version.styleId)}/technical-data/${escapeHtml(version.technicalVersionId)}">进入技术包</button>` : ''}</div>
    <div data-tech-pack-task-feedback class="mx-5 mt-4 hidden rounded-md px-3 py-2 text-sm" role="alert"></div>
    ${version ? `<div class="grid gap-4 p-5 sm:grid-cols-4"><div><p class="text-xs text-slate-500">版本</p><p class="mt-1 font-medium text-slate-900">${escapeHtml(version.versionLabel)}</p></div><div><p class="text-xs text-slate-500">状态</p><p class="mt-1 font-medium text-slate-900">${escapeHtml(version.versionStatus === 'PUBLISHED' ? '已发布' : version.reviewStage || '草稿')}</p></div><div><p class="text-xs text-slate-500">完整度</p><p class="mt-1 font-medium text-slate-900">${version.completenessScore}%</p></div><div><p class="text-xs text-slate-500">缺失模块</p><p class="mt-1 text-sm text-slate-700">${escapeHtml(view.missingModules.join('、') || '无')}</p></div></div>` : `<div class="p-5"><p class="text-sm ${view.canGenerate ? 'text-slate-600' : 'text-amber-700'}">${escapeHtml(view.generateBlockedReason || '专业任务均已完成，可以生成技术包草稿。')}</p><div class="mt-4 flex flex-wrap items-end gap-3"><label class="text-sm text-slate-600">操作人<input class="mt-1 block h-9 w-52 rounded-md border border-slate-200 px-3" value="${escapeHtml(operatorDrafts.get(task.taskId) || master.merchandiserName)}" data-tech-pack-task-field="operator" data-task-id="${escapeHtml(task.taskId)}"></label><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-40" ${view.canGenerate ? '' : 'disabled'} data-tech-pack-task-action="generate-draft" data-task-id="${escapeHtml(task.taskId)}">生成技术包草稿</button></div></div>`}
  </section>`
  const sources = `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="font-semibold text-slate-900">资料来源与完整度</h2></div><div class="overflow-x-auto"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">模块</th><th class="px-4 py-3">来源任务／主单</th><th class="px-4 py-3">状态</th></tr></thead><tbody>${view.moduleSources.map((item) => `<tr class="border-t border-slate-100"><td class="px-4 py-3 font-medium">${escapeHtml(item.module)}</td><td class="px-4 py-3">${escapeHtml(item.source)}</td><td class="px-4 py-3">${escapeHtml(item.status)}</td></tr>`).join('')}</tbody></table></div></section>`
  const review = version ? `<section class="rounded-lg border border-slate-200 bg-white"><div class="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 class="font-semibold text-slate-900">审核与退回</h2><button type="button" class="text-sm font-medium text-blue-700" data-nav="/pcs/products/styles/${escapeHtml(version.styleId)}/technical-data/${escapeHtml(version.technicalVersionId)}?reviewDetail=1">查看审核记录</button></div><div class="grid gap-3 p-5 md:grid-cols-3">${view.reviews.map((item) => `<div class="rounded-md bg-slate-50 p-3"><p class="text-xs text-slate-500">${escapeHtml(item.role)}</p><p class="mt-1 font-medium text-slate-900">${escapeHtml(item.status)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(item.reviewer)} · ${escapeHtml(item.opinion)}</p></div>`).join('')}</div>${view.returnedModules.length ? `<p class="border-t border-slate-100 px-5 py-4 text-sm text-rose-700">已退回：${escapeHtml(view.returnedModules.join('、'))}</p>` : ''}</section>` : ''
  return `
    <div class="space-y-5 p-4" data-tech-pack-task-detail="${escapeHtml(task.taskId)}" data-engineering-task-detail="techPack:${escapeHtml(task.taskId)}">
      ${renderTaskWorkbenchHeader(task, master, 'techPack', TECH_PACK_LIST_PATH)}
      ${versionCard}${sources}${review}
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

export function handleTechPackTaskInput(target: Element): boolean {
  const node = target.closest<HTMLInputElement>('[data-tech-pack-task-field="operator"]')
  if (!node) return false
  operatorDrafts.set(node.dataset.taskId || '', node.value)
  return true
}

export function handleTechPackTaskEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-tech-pack-task-action]')
  if (!node) return false
  if (node.dataset.techPackTaskAction !== 'generate-draft') return false
  const taskId = node.dataset.taskId || ''
  const detail = getEngineeringTaskDetail(taskId)
  const feedback = document.querySelector<HTMLElement>(`[data-tech-pack-task-workspace="${CSS.escape(taskId)}"] [data-tech-pack-task-feedback]`)
  try {
    if (!detail) throw new Error('未找到技术包确认任务。')
    createEngineeringMasterTechPackDraft(detail.master.masterOrderId, operatorDrafts.get(taskId) || detail.master.merchandiserName)
    if (detail.task.status === '待开始') startEngineeringTaskFromDetail(taskId)
    const host = document.querySelector<HTMLElement>(`[data-tech-pack-task-detail="${CSS.escape(taskId)}"]`)
    if (host) host.outerHTML = renderTechPackDetailPage(taskId)
    return true
  } catch (error) {
    if (feedback) {
      feedback.hidden = false
      feedback.className = 'mx-5 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
      feedback.textContent = error instanceof Error ? error.message : '生成失败，请重试。'
    }
    return true
  }
}
