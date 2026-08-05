// @page-pattern: list
// 标准列表契约由 renderEngineeringStandardListPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 产前版样衣任务：任务骨架、状态、依赖、负责人和时间只读工程主单任务事实。
// 制作团队提交图片与数量即完成，不设置任务级验收或二次确认。

import type { EngineeringTaskRecord } from '../../data/pcs-engineering-master-types'
import {
  getEngineeringMasterOrderById,
  submitEngineeringTaskResult,
} from '../../data/pcs-engineering-master-repository'
import { escapeHtml, formatDateTime } from '../../utils'
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
} from './shared'
import {
  ENGINEERING_TASK_FILTER_STATUS_OPTIONS,
  getEngineeringTaskDetail,
  getEngineeringTaskSourceOptions,
  getEngineeringTaskTeamOptions,
  listEngineeringTasksByType,
  renderTaskDependencyCard,
  renderTaskLogsCard,
  renderTaskWorkbenchHeader,
} from './master-task-common'

const TASK_TYPES = ['PRE_PRODUCTION_SAMPLE'] as const
const LIST_PATH = '/pcs/samples/first-sample'
const resultDrafts = new Map<string, { imageIds: string; quantity: string; submittedBy: string; note: string }>()

function getResultDraft(task: EngineeringTaskRecord) {
  const current = resultDrafts.get(task.taskId)
  if (current) return current
  const created = {
    imageIds: task.resultImageIds.join(', '),
    quantity: task.resultQuantity > 0 ? String(task.resultQuantity) : '',
    submittedBy: task.resultSubmittedBy,
    note: '',
  }
  resultDrafts.set(task.taskId, created)
  return created
}

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
  const draft = getResultDraft(task)
  const canSubmit = task.status === '进行中'
  const resultSummary = `
    <div class="grid gap-3 md:grid-cols-4">
      <div><p class="text-xs text-slate-500">结果图片</p><p class="mt-1 text-sm text-slate-900">${task.resultImageIds.length} 张</p></div>
      <div><p class="text-xs text-slate-500">制作数量</p><p class="mt-1 text-sm text-slate-900">${task.resultQuantity} 件</p></div>
      <div><p class="text-xs text-slate-500">提交人</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(task.resultSubmittedBy || '-')}</p></div>
      <div><p class="text-xs text-slate-500">提交时间</p><p class="mt-1 text-sm text-slate-900">${escapeHtml(task.submittedAt ? formatDateTime(task.submittedAt) : '-')}</p></div>
    </div>
    ${task.resultImageIds.length > 0 ? `<div class="mt-4 grid gap-3 sm:grid-cols-3">${task.resultImageIds.map((imageUrl, index) => `<button type="button" class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left" data-first-sample-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-alt="${escapeHtml(`产前版样衣成果图 ${index + 1}`)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`产前版样衣成果图 ${index + 1}`)}" class="h-36 w-full object-contain" loading="lazy"><span class="block px-3 py-2 text-xs text-slate-500">点击查看大图</span></button>`).join('')}</div>` : ''}`
  if (!canSubmit) return renderSectionCard('样衣成果', resultSummary)
  return renderSectionCard('样衣成果', `${resultSummary}
    <div class="mt-5 border-t border-slate-100 pt-5" data-first-sample-form="${escapeHtml(task.taskId)}">
      <div data-first-sample-feedback class="mb-3 hidden rounded-md px-3 py-2 text-sm" role="alert"></div>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="text-sm text-slate-600">成果图片地址（多个用逗号分隔）<input class="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" value="${escapeHtml(draft.imageIds)}" data-first-sample-field="imageIds" data-task-id="${escapeHtml(task.taskId)}" placeholder="https://..."></label>
        <label class="text-sm text-slate-600">制作数量（件）<input type="number" min="1" class="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" value="${escapeHtml(draft.quantity)}" data-first-sample-field="quantity" data-task-id="${escapeHtml(task.taskId)}"></label>
        <label class="text-sm text-slate-600">制作说明<input class="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" value="${escapeHtml(draft.note)}" data-first-sample-field="note" data-task-id="${escapeHtml(task.taskId)}"></label>
      </div>
      <div class="mt-4 flex justify-end"><button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-first-sample-action="submit-result" data-task-id="${escapeHtml(task.taskId)}">提交成果并完成任务</button></div>
    </div>`)
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
  return `<div class="space-y-5 p-4" data-first-sample-detail="${escapeHtml(task.taskId)}" data-engineering-task-detail="firstSample:${escapeHtml(task.taskId)}">
    ${renderTaskWorkbenchHeader(task, master, 'firstSample', LIST_PATH)}
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

export function handleFirstSampleTaskInput(target: Element): boolean {
  const node = target.closest<HTMLInputElement>('[data-first-sample-field]')
  if (!node) return false
  const taskId = node.dataset.taskId || ''
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) return false
  const draft = getResultDraft(detail.task)
  const field = node.dataset.firstSampleField as keyof typeof draft
  if (!(field in draft)) return false
  draft[field] = node.value
  return true
}

export function handleFirstSampleTaskEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-first-sample-action]')
  if (!node) return false
  const action = node.dataset.firstSampleAction || ''
  if (action === 'preview-image') {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6'
    overlay.dataset.firstSamplePreview = 'true'
    overlay.innerHTML = `<button type="button" aria-label="关闭大图" class="absolute right-6 top-6 rounded-full bg-white px-3 py-2 text-slate-800" data-first-sample-action="close-preview">关闭</button><img src="${escapeHtml(node.dataset.imageUrl || '')}" alt="${escapeHtml(node.dataset.imageAlt || '产前版样衣大图')}" class="max-h-full max-w-full object-contain">`
    document.body.appendChild(overlay)
    return true
  }
  if (action === 'close-preview') {
    node.closest<HTMLElement>('[data-first-sample-preview]')?.remove()
    return true
  }
  if (action !== 'submit-result') return false
  const taskId = node.dataset.taskId || ''
  const detail = getEngineeringTaskDetail(taskId)
  const feedback = document.querySelector<HTMLElement>(`[data-first-sample-form="${CSS.escape(taskId)}"] [data-first-sample-feedback]`)
  try {
    if (!detail) throw new Error('未找到产前版样衣任务。')
    const draft = getResultDraft(detail.task)
    submitEngineeringFirstSampleResult(taskId, {
      resultImageIds: draft.imageIds.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      resultQuantity: Number(draft.quantity),
      submittedBy: detail.task.assigneeName || detail.task.ownerTeamName,
    })
    resultDrafts.delete(taskId)
    const host = document.querySelector<HTMLElement>(`[data-first-sample-detail="${CSS.escape(taskId)}"]`)
    if (host) host.outerHTML = renderPcsFirstSampleTaskDetailPage(taskId)
    return true
  } catch (error) {
    if (feedback) {
      feedback.hidden = false
      feedback.className = 'mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
      feedback.textContent = error instanceof Error ? error.message : '提交失败，请重试。'
    }
    return true
  }
}

export function isFirstSampleTaskDialogOpen(): boolean {
  return Boolean(document.querySelector('[data-first-sample-preview]'))
}
